import axios from 'axios'

// Import is deferred to avoid circular dependency — authStore imports axios indirectly
const getAuthStore = () => import('../store/authStore').then(m => m.useAuthStore)

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Inyectar token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  const tenantId = localStorage.getItem('tenantId')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (tenantId) config.headers['X-Tenant-ID'] = tenantId
  return config
})

// Refresh automático si el token expira
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
        const { data: raw } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken })
        const payload = raw?.data ?? raw
        localStorage.setItem('accessToken', payload.accessToken)
        localStorage.setItem('refreshToken', payload.refreshToken)
        original.headers.Authorization = `Bearer ${payload.accessToken}`
        return api(original)
      } catch {
        localStorage.clear()
        // Use zustand store logout so React Router handles navigation (no blank screen)
        getAuthStore().then(store => store.getState().logout())
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
