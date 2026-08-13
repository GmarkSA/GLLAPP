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
  // true = ya tenemos valor confirmado (persisted o cargado desde backend)
  settingsReady:   boolean
  isLoading:       boolean
  lastLoaded:      number | null

  setActiveCompany:  (company: Company) => Promise<void>
  setActiveBranch:   (branch: Branch)  => void
  loadCompanies:     ()                 => Promise<void>
  clearCompany:      ()                 => void
  isModuleEnabled:   (module: string)  => boolean
  // Refresca los módulos habilitados en caliente (tras editarlos en Configuración)
  // para que el menú lateral reaccione sin recargar ni volver a iniciar sesión.
  setEnabledModules: (modules: string[] | null) => void
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set, get) => ({
      activeCompany:  null,
      activeBranch:   null,
      companies:      [],
      branches:       [],
      enabledModules: null,
      settingsReady:  false,
      isLoading:      false,
      lastLoaded:     null,

      isModuleEnabled: (module: string) => {
        const { enabledModules, activeCompany } = get()
        if (!activeCompany) return false
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
          const current = get().activeCompany
          if (current && !companies.find(c => c.id === current.id)) {
            set({ activeCompany: null, activeBranch: null, branches: [], settingsReady: false })
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
              settingsReady:  true,
            })
          }
        } catch {
          // silent — no interrumpir la UI
          set({ settingsReady: true })
        } finally {
          set({ isLoading: false })
        }
      },

      setActiveCompany: async (company) => {
        sessionStorage.setItem('activeCompanyId', company.id)
        sessionStorage.setItem('activeCompany', JSON.stringify(company))
        // Resetear enabledModules al cambiar empresa para no mostrar el plan de la empresa anterior
        // mientras carga el plan de la nueva. null = "todos" (optimista) hasta que el API responda.
        set({ activeCompany: company, activeBranch: null, branches: [], enabledModules: null, settingsReady: false })

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
          set({ enabledModules: (Array.isArray(mods) && mods.length > 0) ? mods : null, settingsReady: true })
        } else {
          set({ settingsReady: true })
        }
      },

      setActiveBranch: (branch) => {
        set({ activeBranch: branch })
      },

      setEnabledModules: (modules) => {
        // Convención del store: null/[] = todos habilitados; array = solo esos.
        set({ enabledModules: (modules && modules.length > 0) ? modules : null, settingsReady: true })
      },

      clearCompany: () => {
        set({ activeCompany: null, activeBranch: null, companies: [], branches: [], lastLoaded: null, settingsReady: false })
      },
    }),
    {
      name: 'contaerp-company',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        activeCompany:  state.activeCompany,
        activeBranch:   state.activeBranch,
        enabledModules: state.enabledModules,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.activeCompany) {
          state.settingsReady = true
        }
      },
    },
  ),
)
