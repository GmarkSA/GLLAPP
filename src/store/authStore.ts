import { create } from 'zustand'
import api from '../api/axios'
import { tenantsApi } from '../api/tenants'

/** Los roles llegan como string[] (login/JWT) o como objetos {name, permissions} (/auth/me) */
export type UserRole = string | { id?: string; name: string; permissions?: Array<{ slug: string }> }

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName?: string
  roles?: UserRole[]
  tenantIds: string[]
  isSuperAdmin?: boolean
  /** Clave inicial asignada por el admin: debe cambiarla antes de operar (estilo SAP) */
  mustChangePassword?: boolean
}

const ROLES_ACCESO_TOTAL = new Set(['superadmin', 'admin'])
const nombreRol = (r: UserRole): string => (typeof r === 'string' ? r : (r?.name ?? '')).toLowerCase()

/** Slugs de permiso (modulo:submodulo:accion) del usuario — solo /auth/me los trae anidados en roles */
const extraerPermisos = (user: User | null | undefined): Set<string> => {
  const slugs = new Set<string>()
  for (const r of user?.roles ?? []) {
    if (typeof r === 'string') continue
    for (const p of r?.permissions ?? []) if (p?.slug) slugs.add(p.slug)
  }
  return slugs
}
/** Administrador (rol admin/superadmin del tenant o Super Admin de plataforma) → todo permitido */
const esAdminTotal = (user: User | null | undefined): boolean =>
  !!user?.isSuperAdmin || (user?.roles ?? []).some(r => ROLES_ACCESO_TOTAL.has(nombreRol(r)))

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
  /** Permisos efectivos (slugs modulo:submodulo:accion) — vacío hasta que /auth/me los cargue */
  permissions: Set<string>
  /** ¿Tiene el permiso exacto? Admin/superadmin → siempre true */
  can: (slug: string) => boolean
  /** ¿Tiene algún permiso que empiece por el prefijo? (p. ej. 'inventario:' o 'reportes:balanza:') */
  canAny: (prefix: string) => boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  setTenant: (tenantId: string) => void
  setTenantGroupName: (name: string | null) => void
  bootstrapAuth: () => Promise<void>
  /** Recarga usuario + permisos desde /auth/me (tras login el JWT solo trae nombres de rol) */
  loadPermissions: () => Promise<void>
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
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenantId: sessionStorage.getItem('tenantId'),
  tenantGroupName: sessionStorage.getItem('tenantGroupName'),
  isAuthenticated: !!sessionStorage.getItem('accessToken'),
  isLoading: false,
  permissions: new Set<string>(),

  can: (slug) => esAdminTotal(get().user) || get().permissions.has(slug),
  canAny: (prefix) => {
    if (esAdminTotal(get().user)) return true
    for (const s of get().permissions) if (s.startsWith(prefix)) return true
    return false
  },

  loadPermissions: async () => {
    const { data: raw } = await api.get('/auth/me')
    const user = raw?.data ?? raw
    if (user) set({ user, permissions: extraerPermisos(user) })
  },

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
      set({ user, permissions: extraerPermisos(user), isAuthenticated: true })
      // El JWT solo trae nombres de rol: cargar los permisos reales sin bloquear el login
      get().loadPermissions().catch(() => {})
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
      set({ user, permissions: extraerPermisos(user), isAuthenticated: true })
      // El JWT solo trae nombres de rol: cargar los permisos reales sin bloquear el login
      get().loadPermissions().catch(() => {})
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
      set({ user, permissions: extraerPermisos(user) })

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
