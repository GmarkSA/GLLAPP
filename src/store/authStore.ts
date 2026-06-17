import { create } from 'zustand'
import api from '../api/axios'
import { tenantsApi } from '../api/tenants'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName?: string
  roles?: string[]
  tenantIds: string[]
  isSuperAdmin?: boolean
}

export interface Company {
  id: string
  companyNumber: string
  legalName: string
  tradeName?: string
  taxId?: string
  taxIdLabel?: string
  countryCode: string
  currencyCode: string
  timezone: string
  isDefault: boolean
  status: string
}

interface AuthState {
  user: User | null
  tenantId: string | null
  tenantGroupName: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  setTenant: (tenantId: string) => void
  setTenantGroupName: (name: string | null) => void
  bootstrapAuth: () => Promise<void>
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
  tenantGroupName: localStorage.getItem('tenantGroupName'),
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
    set({ user: null, isAuthenticated: false, tenantId: null, tenantGroupName: null })
  },

  setTenant: (tenantId) => {
    localStorage.setItem('tenantId', tenantId)
    set({ tenantId })
  },

  setTenantGroupName: (name) => {
    if (name) localStorage.setItem('tenantGroupName', name)
    else localStorage.removeItem('tenantGroupName')
    set({ tenantGroupName: name })
  },

  bootstrapAuth: async () => {
    if (!localStorage.getItem('accessToken')) return
    set({ isLoading: true })
    try {
      const { data: raw } = await api.get('/auth/me')
      const user = raw?.data ?? raw
      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        localStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      set({ user })

      // Cargar grupo empresarial del tenant
      const profile = await tenantsApi.getProfile().catch(() => null)
      const groupName = profile?.settings?.groupName ?? null
      if (groupName) localStorage.setItem('tenantGroupName', groupName)
      else localStorage.removeItem('tenantGroupName')
      set({ tenantGroupName: groupName })
    } catch {
      // Token inválido — el interceptor de 401 maneja el logout
    } finally {
      set({ isLoading: false })
    }
  },
}))
