import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
      isLoading:      false,
      lastLoaded:     null,

      isModuleEnabled: (module: string) => {
        const { enabledModules } = get()
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

          // Auto-seleccionar empresa si no hay activa
          const current = get().activeCompany
          if (!current && companies.length > 0) {
            const def = companies.find(c => c.isDefault) ?? companies[0]
            await get().setActiveCompany(def)
          } else if (current && !localStorage.getItem('activeCompanyId')) {
            // Zustand persist restauró activeCompany pero localStorage.activeCompanyId
            // puede faltar (clave separada). El interceptor de axios la necesita para
            // enviar X-Company-ID. Re-sincronizar sin llamar setActiveCompany completo.
            localStorage.setItem('activeCompanyId', current.id)
            localStorage.setItem('activeCompany', JSON.stringify(current))
          }
        } catch {
          // silent — no interrumpir la UI
        } finally {
          set({ isLoading: false })
        }
      },

      setActiveCompany: async (company) => {
        // Sync con localStorage para que el interceptor de axios lo lea
        localStorage.setItem('activeCompanyId', company.id)
        localStorage.setItem('activeCompany', JSON.stringify(company))
        set({ activeCompany: company, activeBranch: null, branches: [], enabledModules: null })

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
          const settings = settingsResult.value
          const mods = settings?.enabledModules
          set({ enabledModules: (Array.isArray(mods) && mods.length > 0) ? mods : null })
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
      // Solo persiste empresa, sucursal y módulos activos — las listas se recargan
      partialize: (state) => ({
        activeCompany:  state.activeCompany,
        activeBranch:   state.activeBranch,
        enabledModules: state.enabledModules,
      }),
    },
  ),
)
