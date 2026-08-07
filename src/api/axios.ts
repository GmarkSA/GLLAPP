import axios from 'axios'

const getAuthStore = () => import('../store/authStore').then(m => m.useAuthStore)

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/public/',
  '/auth/accept-invitation', '/auth/forgot-password', '/auth/reset-password']

// sessionStorage → cada pestaña tiene sus propios tokens (usuario y empresa aislados por tab)
api.interceptors.request.use((config) => {
  // Si hay una sesión de impersonación activa, usamos su token y tenantId
  const impersonationToken    = sessionStorage.getItem('impersonationToken')
  const impersonationTenantId = sessionStorage.getItem('impersonationTenantId')

  const token           = impersonationToken    ?? sessionStorage.getItem('accessToken')
  const tenantId        = impersonationTenantId ?? sessionStorage.getItem('tenantId')
  const activeCompanyId = sessionStorage.getItem('activeCompanyId')

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
        if (!refreshingPromise) {
          const refreshToken = sessionStorage.getItem('refreshToken')
          refreshingPromise = axios
            .post<any>(`${BASE_URL}/auth/refresh`, { refreshToken })
            .then((r) => {
              const payload = r.data?.data ?? r.data
              sessionStorage.setItem('accessToken',  payload.accessToken)
              sessionStorage.setItem('refreshToken', payload.refreshToken)
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
        sessionStorage.clear()
        getAuthStore().then(store => store.getState().logout())
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export default api

/** Extrae el mensaje de error del formato del HttpExceptionFilter del backend.
 *  La respuesta tiene forma: { success: false, error: { message: "..." } }
 */
export const getApiError = (e: any, fallback = 'Error inesperado'): string =>
  e?.response?.data?.error?.message ?? e?.response?.data?.message ?? fallback
