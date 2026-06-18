import axios from 'axios'

const getAuthStore = () => import('../store/authStore').then(m => m.useAuthStore)

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/public/']

api.interceptors.request.use((config) => {
  const tenantId        = localStorage.getItem('tenantId')
  const activeCompanyId = localStorage.getItem('activeCompanyId')

  if (activeCompanyId) config.headers['X-Company-ID'] = activeCompanyId

  const isPublicPath = PUBLIC_PATHS.some(p => config.url?.includes(p))
  if (!isPublicPath && !tenantId) {
    console.error('[Axios] Request bloqueado: X-Tenant-ID ausente —', config.url)
    getAuthStore().then(store => store.getState().logout())
    return Promise.reject(new axios.CanceledError('X-Tenant-ID ausente'))
  }

  if (tenantId) config.headers['X-Tenant-ID'] = tenantId
  return config
})

// Singleton refresh promise — evita que múltiples 401 simultáneos
// lancen varios refresh en paralelo, lo que rota el token y deja
// el segundo intento con un refresh token ya revocado → logout falso.
let refreshingPromise: Promise<void> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (axios.isCancel(error)) return Promise.reject(error)

    const original = error.config

    const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true

      try {
        // Todos los requests que fallan con 401 al mismo tiempo
        // comparten UNA sola petición de refresh.
        if (!refreshingPromise) {
          refreshingPromise = axios
            .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
            .then(() => undefined)
            .finally(() => { refreshingPromise = null })
        }

        await refreshingPromise
        return api(original)
      } catch {
        refreshingPromise = null
        localStorage.removeItem('tenantId')
        localStorage.removeItem('tenantGroupName')
        localStorage.removeItem('activeCompanyId')
        localStorage.removeItem('sessionActive')
        getAuthStore().then(store => store.getState().logout())
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export default api
