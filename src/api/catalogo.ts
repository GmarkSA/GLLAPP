import api from './axios'

export interface Account {
  id:          string
  code:        string
  name:        string
  description?: string
  type:        string
  subType?:    string
  groupCode?:  string
  rangeStart?: number
  rangeEnd?:   number
  balanceType?: string
  normalBalance?: string
  isHeader:    boolean
  isSystem:    boolean
  isActive:    boolean
  openItems:   boolean
  bankLinking: boolean
  isCustomerAccount: boolean
  isVendorAccount:   boolean
  isFixedAsset:      boolean
  requiresReconciliation: boolean
  isInventoryAccount: boolean
  isPlanillasAccount: boolean
  requiresCostCenter:   boolean
  requiresProfitCenter: boolean
  openingBalance: number
  currentBalance: number
  parentId?:   string
}

const unwrap = (r: any) => r.data?.data ?? r.data

export const getAccountGroups = () => api.get('/contabilidad/catalogo/groups').then(unwrap)
export const getAccounts = (params?: any) => api.get('/contabilidad/catalogo/flat', { params }).then(unwrap)
export const getAccount = (id: string) => api.get(`/contabilidad/catalogo/${id}`).then(unwrap)
export const createAccount = (dto: Partial<Account>) => api.post('/contabilidad/catalogo', dto).then(unwrap)
export const updateAccount = (id: string, dto: Partial<Account>) => api.patch(`/contabilidad/catalogo/${id}`, dto).then(unwrap)
export const deleteAccount = (id: string, force = false) =>
  api.delete(`/contabilidad/catalogo/${id}`, force ? { params: { force: 'true' } } : undefined)
export const seedGLL = (mode: 'complement' | 'sync_properties' = 'complement') =>
  api.get('/contabilidad/catalogo/seed/gll', { params: { mode } }).then(unwrap)

export interface SaldoAperturaLinea {
  accountId: string
  debit: number
  credit: number
  /**
   * Para las cuentas que son una cuenta de banco en moneda extranjera: con la
   * moneda y la tasa, el backend deja el saldo de la cuenta bancaria EN SU
   * MONEDA, que es el número que se concilia contra el estado de cuenta.
   */
  moneda?: string
  tipoCambio?: number
}
export interface SaldosAperturaResult {
  polizaId: string
  updated: number
  /** true = se reemplazó la póliza anterior en vez de agregar otra. */
  reemplazo?: boolean
}

/**
 * El borrador de la captura, para seguir mañana donde se quedó hoy.
 *
 * Cargar la apertura de una empresa no se hace de una sentada: primero las
 * cuentas de mayor sin integración, después cuentas por cobrar, por pagar,
 * inventario, activos fijos y los anticipos.
 */
export interface BorradorApertura {
  fecha?: string | null
  descripcion?: string | null
  lineas: SaldoAperturaLinea[]
  /** La póliza que generó esta captura, si ya se generó. */
  journalEntryId?: string | null
  generadaEn?: string | null
}

export const getBorradorApertura = () =>
  api.get('/contabilidad/catalogo/saldos-apertura/borrador')
    .then(unwrap) as Promise<BorradorApertura | null>

export const guardarBorradorApertura = (dto: {
  fecha?: string
  descripcion?: string
  lineas: SaldoAperturaLinea[]
}) => api.put('/contabilidad/catalogo/saldos-apertura/borrador', dto).then(unwrap)


export const setSaldosApertura = (dto: {
  fecha: string
  descripcion?: string
  lineas: SaldoAperturaLinea[]
}) => api.post('/contabilidad/catalogo/saldos-apertura', dto).then(unwrap) as Promise<SaldosAperturaResult>

export interface ImportarCatalogoResult {
  imported: number
  updated: number
  errors: string[]
  avisos: string[]
}

/**
 * Carga masiva del catálogo de cuentas desde la plantilla Excel.
 *
 * El backend recorre las filas dos veces —primero las cuentas, después los
 * padres—, así que el orden del archivo no importa: una hija puede venir
 * antes que su madre.
 */
export const importarCatalogo = (rows: Array<Record<string, unknown>>) =>
  api.post('/contabilidad/catalogo/importar', { accounts: rows })
    .then(unwrap) as Promise<ImportarCatalogoResult>
