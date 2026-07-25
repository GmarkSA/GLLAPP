import { useEffect, useState, useCallback } from 'react'
import { useCompanyStore } from '../store/companyStore'
import { companiesApi } from '../api/companies'
import { getAccounts } from '../api/catalogo'
import { getTaxes } from '../api/impuestos'
import { tenantsApi } from '../api/tenants'
import { getCustomers, getVendors } from '../api/contactos'
import { getBankAccounts } from '../api/bancos'

export interface SetupStep {
  id:    string
  num:   number
  label: string
  desc:  string
  route: string
  done:  boolean
}

function countOf(res: any): number {
  if (Array.isArray(res)) return res.length
  return res?.total ?? res?.meta?.total ?? (res?.data ? countOf(res.data) : 0)
}

export function useSetupSteps() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [steps,   setSteps]   = useState<SetupStep[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!activeCompany) return
    setLoading(true)

    Promise.all([
      companiesApi.getOne(activeCompany.id).catch(() => null),
      getAccounts({ limit: 1 }).catch(() => []),
      tenantsApi.getProfile().catch(() => null),
      getTaxes().catch(() => []),
      getCustomers({ limit: 1 }).catch(() => []),
      getVendors({ limit: 1 }).catch(() => []),
      getBankAccounts({ status: 'active' }).catch(() => []),
    ]).then(([company, accounts, profile, taxes, customers, vendors, banks]) => {
      const co = company as any

      const perfilOk      = !!(co?.legalName && co?.taxId && co?.fiscalRegimeId)
      const catalogoOk    = countOf(accounts) > 0
      const defaultsOk    = !!(profile?.settings?.accountDefaults &&
                              Object.values(profile.settings.accountDefaults).some(Boolean))
      const impuestosOk   = countOf(taxes) > 0
      const clientesOk    = countOf(customers) > 0
      const proveedoresOk = countOf(vendors) > 0
      const bancosOk      = countOf(banks) > 0

      setSteps([
        {
          id: 'empresa', num: 1,
          label: 'Empresa creada',
          desc:  'Datos de la empresa registrados en el sistema.',
          route: `/configuracion/empresas/${activeCompany.id}?from=setup`,
          done:  true,
        },
        {
          id: 'perfil', num: 2,
          label: 'Perfil de organización',
          desc:  'Nombre legal, NIT y régimen fiscal completos.',
          route: '/configuracion?from=setup',
          done:  perfilOk,
        },
        {
          id: 'catalogo', num: 3,
          label: 'Catálogo de cuentas',
          desc:  'Catálogo contable cargado y revisado.',
          route: '/contabilidad/catalogo',
          done:  catalogoOk,
        },
        {
          id: 'contabilidad', num: 4,
          label: 'Cuentas por defecto',
          desc:  'Cuentas contables del sistema vinculadas.',
          route: '/configuracion?tab=contabilidad',
          done:  defaultsOk,
        },
        {
          id: 'impuestos', num: 5,
          label: 'Plantilla de impuestos',
          desc:  'Impuestos fiscales (IVA, ISR, retenciones) cargados.',
          route: '/configuracion?tab=taxes',
          done:  impuestosOk,
        },
        {
          id: 'clientes', num: 6,
          label: 'Primer cliente',
          desc:  'Al menos un cliente registrado en el sistema.',
          route: '/ventas/clientes',
          done:  clientesOk,
        },
        {
          id: 'proveedores', num: 7,
          label: 'Primer proveedor',
          desc:  'Al menos un proveedor registrado en el sistema.',
          route: '/compras/proveedores',
          done:  proveedoresOk,
        },
        {
          id: 'bancos', num: 8,
          label: 'Cuenta bancaria',
          desc:  'Cuenta bancaria configurada para tesorería.',
          route: '/bancos',
          done:  bancosOk,
        },
      ])
    }).finally(() => setLoading(false))
  }, [activeCompany])

  useEffect(() => { load() }, [load])

  const completedCount     = steps.filter(s => s.done).length
  const completionPercent  = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

  return { steps, loading, completedCount, completionPercent, reload: load }
}
