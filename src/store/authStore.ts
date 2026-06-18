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
  // sessionActive es un hint no-secreto: el token real vive en cookie httpOnly
  isAuthenticated: !!localStorage.getItem('sessionActive'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data: raw } = await api.post('/auth/login', { email, password })
      const payload = raw?.data ?? raw
      const user    = payload?.user

      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        localStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      localStorage.setItem('sessionActive', '1')
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
      const user    = payload?.user

      const tenantId = user?.tenantIds?.[0]
      if (tenantId) {
        localStorage.setItem('tenantId', tenantId)
        set({ tenantId })
      }
      localStorage.setItem('sessionActive', '1')
      set({ user, isAuthenticated: true })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('tenantId')
    localStorage.removeItem('tenantGroupName')
    localStorage.removeItem('activeCompanyId')
    localStorage.removeItem('sessionActive')
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
    if (!localStorage.getItem('sessionActive')) return
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

      const profile = await tenantsApi.getProfile().catch(() => null)
      const groupName = profile?.settings?.groupName ?? null
      if (groupName) localStorage.setItem('tenantGroupName', groupName)
      else localStorage.removeItem('tenantGroupName')
      set({ tenantGroupName: groupName })
    } catch {
      localStorage.removeItem('sessionActive')
      set({ isAuthenticated: false })
    } finally {
      set({ isLoading: false })
    }
  },
}))
