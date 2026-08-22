import { useEffect, useState, useCallback } from 'react'
import { useCompanyStore } from '../store/companyStore'
import { getAccounts } from '../api/catalogo'
import { getTaxes } from '../api/impuestos'
import { tenantsApi } from '../api/tenants'
import { getCustomers, getVendors } from '../api/contactos'
import { getBankAccounts } from '../api/bancos'
import { getClasesActivoFijo } from '../api/clases-activo-fijo'
import { getSetupStepFlags, SETUP_ROUTES, SKIPPED } from './setupProgress'

export interface SetupStep {
  id:    string
  num:   number
  label: string
  desc:  string
  route: string
  done:  boolean
  /** Hay datos en el sistema aunque el usuario aún no haya revisado el paso desde la guía */
  detected?: boolean
  hint?: string
  /** Datos maestros: el usuario eligió "Omitir por ahora" */
  skipped?: boolean
  /** La tarjeta ofrece "Omitir por ahora" */
  skippable?: boolean
  /** Ya hay datos: la tarjeta ofrece "Confirmar" sin salir de la guía */
  confirmable?: boolean
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
      getAccounts({ limit: 1 }).catch(() => []),
      tenantsApi.getProfile().catch(() => null),
      getTaxes().catch(() => []),
      getClasesActivoFijo().catch(() => []),
      getCustomers({ limit: 1 }).catch(() => []),
      getVendors({ limit: 1 }).catch(() => []),
      getBankAccounts({ status: 'active' }).catch(() => []),
      getSetupStepFlags(activeCompany.id),
    ]).then(([accounts, profile, taxes, clases, customers, vendors, banks, flags]) => {
      // Datos de empresa tomados del store — sin llamada extra al backend
      const co            = activeCompany as any
      const perfilOk      = !!(co.legalName && co.taxId && co.fiscalRegimeId)
      const catalogoOk    = countOf(accounts) > 0
      const defaultsOk    = !!(profile?.settings?.accountDefaults &&
                              Object.values(profile.settings.accountDefaults).some(Boolean))
      // Clases AF: el backend devuelve las clases Guatemala en memoria (id null) cuando no hay ninguna guardada →
      // contar solo las GUARDADAS, si no el paso sale verde sin haber hecho nada.
      const clasesOk      = Array.isArray(clases) ? clases.filter((c: any) => !!c?.id).length > 0 : countOf(clases) > 0
      const impuestosOk   = countOf(taxes) > 0
      const clientesOk    = countOf(customers) > 0
      const proveedoresOk = countOf(vendors) > 0
      const bancosOk      = countOf(banks) > 0
      // Guía paso a paso: los pasos 1-3 se completan cuando el usuario los revisa y guarda DESDE la guía
      // (bandera en company_settings.settingsJson.setupSteps). Empresas que ya operaban antes de la guía
      // (sin banderas y con cuentas por defecto vinculadas) conservan el criterio anterior por datos.
      const legacy        = flags === null && defaultsOk
      const guiado        = (id: string) => !!flags?.[id]
      const omitido       = (id: string) => flags?.[id] === SKIPPED
      // Datos maestros (7-9): si ya hay registros (plantilla o creados desde el módulo) se confirma desde la tarjeta
      const maestro       = (id: string, ok: boolean) => ({
        done: legacy ? ok : guiado(id), detected: ok, skipped: omitido(id),
        hint: ok && !legacy && !guiado(id) ? 'Ya hay registros — confirmar' : undefined,
        confirmable: ok && !legacy && !guiado(id),
      })

      setSteps([
        {
          id: 'empresa', num: 1,
          label: 'Empresa creada',
          desc:  'Datos de la empresa registrados en el sistema.',
          route: SETUP_ROUTES.empresa(activeCompany.id),
          done:  legacy ? true : guiado('empresa'),
          detected: true,
        },
        {
          id: 'perfil', num: 2,
          label: 'Perfil de organización',
          desc:  'Nombre legal, NIT y régimen fiscal completos.',
          route: SETUP_ROUTES.perfil,
          done:  legacy ? perfilOk : guiado('perfil'),
          detected: perfilOk,
        },
        {
          id: 'catalogo', num: 3,
          label: 'Catálogo de cuentas',
          desc:  'Catálogo contable cargado y revisado.',
          route: SETUP_ROUTES.catalogo,
          done:  legacy ? catalogoOk : guiado('catalogo'),
          detected: catalogoOk,
          hint:  catalogoOk && !legacy && !guiado('catalogo') ? 'Cargado desde plantilla — revisar y confirmar' : undefined,
        },
        {
          id: 'contabilidad', num: 4,
          label: 'Cuentas por defecto',
          desc:  'Cuentas contables del sistema vinculadas.',
          route: SETUP_ROUTES.contabilidad,
          done:  legacy ? defaultsOk : guiado('contabilidad'),
          detected: defaultsOk,
          hint:  defaultsOk && !legacy && !guiado('contabilidad') ? 'Ya hay cuentas vinculadas — revisar y confirmar' : undefined,
        },
        {
          id: 'clases_af', num: 5,
          label: 'Clases de activo fijo',
          desc:  'Clases ISR Guatemala generadas y cuentas vinculadas.',
          route: SETUP_ROUTES.clases_af,
          done:  legacy ? clasesOk : guiado('clases_af'),
          detected: clasesOk,
          hint:  clasesOk && !legacy && !guiado('clases_af') ? 'Ya hay clases guardadas — revisar y confirmar' : undefined,
        },
        {
          id: 'impuestos', num: 6,
          label: 'Plantilla de impuestos',
          desc:  'Impuestos fiscales (IVA, ISR, retenciones) cargados.',
          route: SETUP_ROUTES.impuestos,
          done:  legacy ? impuestosOk : guiado('impuestos'),
          detected: impuestosOk,
          hint:  impuestosOk && !legacy && !guiado('impuestos') ? 'Ya hay impuestos cargados — revisar y confirmar' : undefined,
        },
        {
          id: 'clientes', num: 7,
          label: 'Primer cliente',
          desc:  'Al menos un cliente registrado en el sistema.',
          route: clientesOk ? '/ventas/clientes' : SETUP_ROUTES.clientes,
          ...maestro('clientes', clientesOk),
          skippable: true,
        },
        {
          id: 'proveedores', num: 8,
          label: 'Primer proveedor',
          desc:  'Al menos un proveedor registrado en el sistema.',
          route: proveedoresOk ? '/compras/proveedores' : SETUP_ROUTES.proveedores,
          ...maestro('proveedores', proveedoresOk),
          skippable: true,
        },
        {
          id: 'bancos', num: 9,
          label: 'Cuenta bancaria',
          desc:  'Cuenta bancaria configurada para tesorería.',
          route: bancosOk ? '/bancos' : SETUP_ROUTES.bancos,
          ...maestro('bancos', bancosOk),
        },
      ])
    }).finally(() => setLoading(false))
  }, [activeCompany])

  useEffect(() => { load() }, [load])

  const completedCount     = steps.filter(s => s.done).length
  const completionPercent  = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

  return { steps, loading, completedCount, completionPercent, reload: load }
}
