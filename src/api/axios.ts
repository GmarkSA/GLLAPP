import axios from 'axios'

const getAuthStore = () => import('../store/authStore').then(m => m.useAuthStore)

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/public/']

api.interceptors.request.use((config) => {
  const token           = localStorage.getItem('accessToken')
  const tenantId        = localStorage.getItem('tenantId')
  const activeCompanyId = localStorage.getItem('activeCompanyId')

  if (token)           config.headers.Authorization   = `Bearer ${token}`
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
let refreshingPromise: Promise<string> | null = null

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
          const refreshToken = localStorage.getItem('refreshToken')
          refreshingPromise = axios
            .post<any>(`${BASE_URL}/auth/refresh`, { refreshToken })
            .then((r) => {
              const payload = r.data?.data ?? r.data
              localStorage.setItem('accessToken',  payload.accessToken)
              localStorage.setItem('refreshToken', payload.refreshToken)
              return payload.accessToken
            })
            .finally(() => { refreshingPromise = null })
        }

        const newToken = await refreshingPromise
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        // Refresh falló → cerrar sesión de forma limpia
        refreshingPromise = null
        localStorage.clear()
        getAuthStore().then(store => store.getState().logout())
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export default api
