import api from './axios'

export type VendorPaymentMode = 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'other'
export type VendorPaymentStatus = 'draft' | 'issued' | 'cleared' | 'voided'
export type CheckType = 'physical' | 'electronic'

export interface AppliedInvoice {
  purchaseInvoiceId: string
  invoiceNumber:     string
  amount:            number
}

export interface VendorPayment {
  id:                string
  paymentNumber:     string
  vendorId?:         string
  vendorName?:       string
  purchaseInvoiceId?: string
  appliedInvoices?:  AppliedInvoice[]
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
  vendorId:       string
  invoiceIds:     string[]           // Una o varias facturas
  amounts?:       Record<string, number>  // Si se pagan montos parciales distintos
  paymentDate:    string
  mode:           VendorPaymentMode
  currency?:      string
  exchangeRate?:  number
  reference?:     string
  checkType?:     CheckType
  bankAccountId?: string
  notes?:         string
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
