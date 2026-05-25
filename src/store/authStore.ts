import { create } from 'zustand'
import api from '../api/axios'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  tenantIds: string[]
  isSuperAdmin?: boolean
}

interface AuthState {
  user: User | null
  tenantId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  setTenant: (tenantId: string) => void
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  companyName: string
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenantId: localStorage.getItem('tenantId'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data: raw } = await api.post('/auth/login', { email, password })
      // El backend puede devolver { data: {...} } o directamente {...}
      const payload = raw?.data ?? raw
      const accessToken  = payload?.accessToken
      const refreshToken = payload?.refreshToken
      const user         = payload?.user

      if (!accessToken) throw new Error('Token no recibido')

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        localStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      set({ user, isAuthenticated: true })
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const { data: raw } = await api.post('/auth/register', data)
      const payload = raw?.data ?? raw
      const accessToken  = payload?.accessToken
      const refreshToken = payload?.refreshToken
      const user         = payload?.user

      if (!accessToken) throw new Error('Token no recibido')

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        localStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      set({ user, isAuthenticated: true })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false, tenantId: null })
  },

  setTenant: (tenantId) => {
    localStorage.setItem('tenantId', tenantId)
    set({ tenantId })
  },
}))
