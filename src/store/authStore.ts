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
  createdAt?: string
  isTemplate?: boolean
  templateDisplayName?: string
  templateDescription?: string
  templateIcon?: string
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

// sessionStorage → aislado por pestaña
// Cada pestaña mantiene su propia sesión (usuario + empresa + tokens)
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenantId: sessionStorage.getItem('tenantId'),
  tenantGroupName: sessionStorage.getItem('tenantGroupName'),
  isAuthenticated: !!sessionStorage.getItem('accessToken'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data: raw } = await api.post('/auth/login', { email, password })
      const payload = raw?.data ?? raw
      const accessToken  = payload?.accessToken
      const refreshToken = payload?.refreshToken
      const user         = payload?.user

      if (!accessToken) throw new Error('Token no recibido')

      sessionStorage.setItem('accessToken', accessToken)
      sessionStorage.setItem('refreshToken', refreshToken)
      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        sessionStorage.setItem('tenantId', tenantId)
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

      sessionStorage.setItem('accessToken', accessToken)
      sessionStorage.setItem('refreshToken', refreshToken)
      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        sessionStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      set({ user, isAuthenticated: true })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    sessionStorage.clear()
    window.location.href = '/login'
  },

  setTenant: (tenantId) => {
    sessionStorage.setItem('tenantId', tenantId)
    set({ tenantId })
  },

  setTenantGroupName: (name) => {
    if (name) sessionStorage.setItem('tenantGroupName', name)
    else sessionStorage.removeItem('tenantGroupName')
    set({ tenantGroupName: name })
  },

  bootstrapAuth: async () => {
    if (!sessionStorage.getItem('accessToken')) return
    set({ isLoading: true })
    try {
      const { data: raw } = await api.get('/auth/me')
      const user = raw?.data ?? raw
      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        sessionStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      set({ user })

      const profile = await tenantsApi.getProfile().catch(() => null)
      const groupName = profile?.settings?.groupName ?? null
      if (groupName) sessionStorage.setItem('tenantGroupName', groupName)
      else sessionStorage.removeItem('tenantGroupName')
      set({ tenantGroupName: groupName })
    } catch {
      // Token inválido — el interceptor de 401 maneja el logout
    } finally {
      set({ isLoading: false })
    }
  },
}))
