import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { companiesApi } from '../api/companies'
import { branchesApi } from '../api/branches'
import type { Company } from './authStore'
import type { Branch } from '../api/branches'

interface CompanyStore {
  activeCompany:   Company | null
  activeBranch:    Branch | null
  companies:       Company[]
  branches:        Branch[]
  // null = todos los módulos habilitados; array = solo esos módulos visibles
  enabledModules:  string[] | null
  settingsLoaded:  boolean   // false hasta que el backend confirme los módulos
  isLoading:       boolean
  lastLoaded:      number | null

  setActiveCompany:  (company: Company) => Promise<void>
  setActiveBranch:   (branch: Branch)  => void
  loadCompanies:     ()                 => Promise<void>
  clearCompany:      ()                 => void
  isModuleEnabled:   (module: string)  => boolean
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set, get) => ({
      activeCompany:  null,
      activeBranch:   null,
      companies:      [],
      branches:       [],
      enabledModules: null,
      settingsLoaded: false,
      isLoading:      false,
      lastLoaded:     null,

      isModuleEnabled: (module: string) => {
        const { enabledModules, settingsLoaded } = get()
        if (!settingsLoaded) return false
        if (!enabledModules || enabledModules.length === 0) return true
        return enabledModules.includes(module)
      },

      loadCompanies: async () => {
        // Evitar recargas en menos de 30 segundos
        const now = Date.now()
        if (get().lastLoaded && now - get().lastLoaded! < 30_000) return

        set({ isLoading: true })
        try {
          const companies = await companiesApi.getAll()
          set({ companies, lastLoaded: now })

          // Validar que la empresa activa pertenece a este usuario.
          // Si no está en la lista (sesión de otro usuario en esta pestaña),
          // limpiarla para que se seleccione la correcta.
          const current = get().activeCompany
          if (current && !companies.find(c => c.id === current.id)) {
            set({ activeCompany: null, activeBranch: null, branches: [] })
            sessionStorage.removeItem('activeCompanyId')
            sessionStorage.removeItem('activeCompany')
          }

          // Auto-seleccionar empresa si no hay activa
          const active = get().activeCompany
          if (!active && companies.length > 0) {
            const def = companies.find(c => c.isDefault) ?? companies[0]
            await get().setActiveCompany(def)
          } else if (active) {
            if (!sessionStorage.getItem('activeCompanyId')) {
              sessionStorage.setItem('activeCompanyId', active.id)
              sessionStorage.setItem('activeCompany', JSON.stringify(active))
            }
            // Recargar settings para reflejar módulos configurados desde el último login
            const s = await companiesApi.getSettings(active.id).catch(() => null)
            const mods = s?.enabledModules
            set({
              enabledModules: (Array.isArray(mods) && mods.length > 0) ? mods : null,
              settingsLoaded: true,
            })
          }
        } catch {
          // silent — no interrumpir la UI
        } finally {
          set({ isLoading: false })
        }
      },

      setActiveCompany: async (company) => {
        // sessionStorage → aislado por pestaña (multi-empresa simultáneo)
        sessionStorage.setItem('activeCompanyId', company.id)
        sessionStorage.setItem('activeCompany', JSON.stringify(company))
        set({ activeCompany: company, activeBranch: null, branches: [], enabledModules: null, settingsLoaded: false })

        // Cargar sucursales y settings de la empresa seleccionada en paralelo
        const [branchResult, settingsResult] = await Promise.allSettled([
          branchesApi.getAll(company.id),
          companiesApi.getSettings(company.id),
        ])

        if (branchResult.status === 'fulfilled') {
          const branches = branchResult.value
          const defaultBranch = branches.find(b => b.isDefault && b.isActive) ?? branches.find(b => b.isActive) ?? null
          set({ branches, activeBranch: defaultBranch })
        } else {
          set({ branches: [], activeBranch: null })
        }

        if (settingsResult.status === 'fulfilled') {
          const mods = settingsResult.value?.enabledModules
          set({ enabledModules: (Array.isArray(mods) && mods.length > 0) ? mods : null, settingsLoaded: true })
        } else {
          set({ settingsLoaded: true })
        }
      },

      setActiveBranch: (branch) => {
        set({ activeBranch: branch })
      },

      clearCompany: () => {
        set({ activeCompany: null, activeBranch: null, companies: [], branches: [], lastLoaded: null })
      },
    }),
    {
      name: 'contaerp-company',
      storage: createJSONStorage(() => sessionStorage),
      // Solo persiste empresa y sucursal — módulos siempre se recargan desde el backend
      partialize: (state) => ({
        activeCompany: state.activeCompany,
        activeBranch:  state.activeBranch,
      }),
    },
  ),
)
