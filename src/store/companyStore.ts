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
  isLoading:       boolean
  lastLoaded:      number | null

  setActiveCompany: (company: Company) => Promise<void>
  setActiveBranch:  (branch: Branch)  => void
  loadCompanies:    ()                 => Promise<void>
  clearCompany:     ()                 => void
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set, get) => ({
      activeCompany: null,
      activeBranch:  null,
      companies:     [],
      branches:      [],
      isLoading:     false,
      lastLoaded:    null,

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
        set({ activeCompany: company, activeBranch: null, branches: [] })

        // Cargar sucursales de la empresa seleccionada
        try {
          const branches = await branchesApi.getAll(company.id)
          const defaultBranch = branches.find(b => b.isDefault && b.isActive) ?? branches.find(b => b.isActive) ?? null
          set({ branches, activeBranch: defaultBranch })
        } catch {
          set({ branches: [], activeBranch: null })
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
      // Solo persiste empresa y sucursal activa — las listas se recargan
      partialize: (state) => ({
        activeCompany: state.activeCompany,
        activeBranch:  state.activeBranch,
      }),
    },
  ),
)
