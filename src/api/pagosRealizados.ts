import api from './axios'

export type VendorPaymentMode   = 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'other'
export type VendorPaymentStatus = 'draft' | 'issued' | 'cleared' | 'voided'
export type VendorPaymentType   = 'regular' | 'advance'
export type CheckType           = 'physical' | 'electronic'

export interface AppliedInvoice {
  purchaseInvoiceId: string
  invoiceNumber:     string
  amount:            number
}

export interface VendorPayment {
  id:                string
  paymentNumber:     string
  type:              VendorPaymentType
  vendorId?:         string
  vendorName?:       string
  purchaseInvoiceId?: string
  appliedInvoices?:  AppliedInvoice[]
  concept?:          string
  advanceBalance?:   number
  paymentDate:       string
  amount:            number
  currency:          string
  exchangeRate:      number
  mode:              VendorPaymentMode
  reference?:        string
  checkNumber?:      string
  checkType?:        CheckType
  bankName?:         string
  bankAccountId?:    string
  journalEntryId?:   string
  status:            VendorPaymentStatus
  notes?:            string
  createdAt:         string
}

export interface AdvancePayment {
  id:             string
  paymentNumber:  string
  paymentDate:    string
  amount:         number
  advanceBalance: number
  concept?:       string
  currency:       string
  mode:           VendorPaymentMode
}

export interface PendingInvoicesByVendor {
  vendorId:   string
  vendorName: string
  invoices:   PendingInvoice[]
}

export interface PendingInvoice {
  id:            string
  invoiceNumber: string
  invoiceDate:   string
  dueDate?:      string
  total:         number
  paidAmount:    number
  balance:       number
  currency:      string
  status:        string
}

export interface CreateVendorPaymentDto {
  type?:          VendorPaymentType
  vendorId:       string
  invoiceIds?:    string[]
  amounts?:       Record<string, number>
  concept?:       string              // Requerido para anticipos
  amount?:        number              // Requerido para anticipos
  paymentDate:    string
  mode:           VendorPaymentMode
  currency?:      string
  exchangeRate?:  number
  reference?:     string
  checkType?:     CheckType
  bankAccountId?: string
  notes?:         string
}

export interface BatchPaymentResult {
  payments: VendorPayment[]
  checks:   { id: string; paymentNumber: string; checkNumber: string | null; vendorName: string }[]
}

export interface CashFlowBucketItem {
  id:            string
  invoiceNumber: string
  vendorId:      string
  vendorName:    string
  invoiceDate:   string
  dueDate?:      string
  daysLeft:      number
  currency:      string
  exchangeRate:  number
  balance:       number
  balanceGTQ:    number
  status:        string
}

export interface CashFlowBucket {
  label:   string
  from:    number
  to:      number
  items:   CashFlowBucketItem[]
  total:   number
}

export interface CashFlowProjection {
  buckets:    Record<string, CashFlowBucket>
  grandTotal: number
  refDate:    string
  total:      number
}

const unwrap = (r: any) => r.data?.data ?? r.data

export const getPagosRealizados = async (params?: {
  page?: number
  limit?: number
  search?: string
  status?: string
  mode?: string
}): Promise<{ data: VendorPayment[]; total: number }> => {
  const res = await api.get('/compras/pagos-realizados', { params })
  const raw = unwrap(res)
  if (Array.isArray(raw)) return { data: raw, total: raw.length }
  return { data: raw.data ?? [], total: raw.total ?? 0 }
}

export const getPagoRealizado = async (id: string): Promise<VendorPayment> => {
  const res = await api.get(`/compras/pagos-realizados/${id}`)
  return unwrap(res)
}

export const createPagoRealizado = async (dto: CreateVendorPaymentDto): Promise<VendorPayment> => {
  const res = await api.post('/compras/pagos-realizados', dto)
  return unwrap(res)
}

export const anularPagoRealizado = async (id: string): Promise<{ ok: boolean }> => {
  const res = await api.post(`/compras/pagos-realizados/${id}/anular`)
  return unwrap(res)
}

export const deletePagoRealizado = async (id: string): Promise<void> => {
  await api.delete(`/compras/pagos-realizados/${id}`)
}

export const getPendingInvoicesByVendor = async (vendorId: string): Promise<PendingInvoice[]> => {
  const res = await api.get(`/compras/pagos-realizados/pending-by-vendor/${vendorId}`)
  return unwrap(res)
}

export const getCashFlowProjection = async (refDate?: string): Promise<CashFlowProjection> => {
  const res = await api.get('/compras/pagos-realizados/cash-flow-projection', {
    params: refDate ? { refDate } : undefined,
  })
  return unwrap(res)
}

export const createBatchPayment = async (
  payments: CreateVendorPaymentDto[],
): Promise<BatchPaymentResult> => {
  const res = await api.post('/compras/pagos-realizados/batch', { payments })
  return unwrap(res)
}

export const getPendingInvoicesAllVendors = async (): Promise<PendingInvoicesByVendor[]> => {
  const res = await api.get('/compras/pagos-realizados/pending-all-vendors')
  return unwrap(res) ?? []
}

export const getAvailableAdvancesByVendor = async (vendorId: string): Promise<AdvancePayment[]> => {
  const res = await api.get(`/compras/pagos-realizados/advances/vendor/${vendorId}`)
  return unwrap(res) ?? []
}

export const applyAdvanceToInvoices = async (
  advanceId: string,
  dto: { invoiceIds: string[]; amounts?: Record<string, number> },
): Promise<VendorPayment> => {
  const res = await api.post(`/compras/pagos-realizados/${advanceId}/aplicar-anticipo`, dto)
  return unwrap(res)
}

// ── Configuración de cheques y ACH por cuenta bancaria ────────────────────
export type CheckFormat    = 'generic' | 'bi' | 'bac' | 'gt' | 'banrural' | 'banoro' | 'citi'
export type AchFileFormat  = 'txt_fixed' | 'csv' | 'xlsx' | 'xml'

export interface BankPaymentConfig {
  id?:                  string
  bankAccountId:        string
  bankAccountName?:     string
  bankName?:            string
  checkPrefix?:         string
  currentCheckSeq?:     number
  checkRangeFrom?:      number
  checkRangeTo?:        number
  checkFormat?:         CheckFormat
  checkFieldPositions?: Record<string, any> | null
  achEnabled?:          boolean
  achBankCode?:         string
  achCompanyId?:        string
  achCompanyName?:      string
  achFileFormat?:       AchFileFormat | null
  achNomenclature?:     string
  notes?:               string
  isActive?:            boolean
}

export const getBankPaymentConfigs      = () =>
  api.get('/bancos/config-pagos').then(r => unwrap(r) ?? [])

export const getBankPaymentConfigByAccount = (bankAccountId: string) =>
  api.get(`/bancos/config-pagos/by-account/${bankAccountId}`).then(r => unwrap(r))

export const createBankPaymentConfig    = (dto: BankPaymentConfig) =>
  api.post('/bancos/config-pagos', dto).then(r => unwrap(r))

export const updateBankPaymentConfig    = (id: string, dto: Partial<BankPaymentConfig>) =>
  api.put(`/bancos/config-pagos/${id}`, dto).then(r => unwrap(r))

export const deleteBankPaymentConfig    = (id: string) =>
  api.delete(`/bancos/config-pagos/${id}`)
