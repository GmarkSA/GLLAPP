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

export interface SaldoAperturaLinea { accountId: string; debit: number; credit: number }
export interface SaldosAperturaResult { polizaId: string; updated: number }

export const setSaldosApertura = (dto: {
  fecha: string
  descripcion?: string
  lineas: SaldoAperturaLinea[]
}) => api.post('/contabilidad/catalogo/saldos-apertura', dto).then(unwrap) as Promise<SaldosAperturaResult>
