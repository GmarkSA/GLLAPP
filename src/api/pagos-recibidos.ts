import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type PaymentMode =
  | 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'paypal' | 'other'

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash:          'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  check:         'Cheque',
  credit_card:   'Tarjeta de crédito',
  debit_card:    'Tarjeta de débito',
  paypal:        'PayPal',
  other:         'Otro',
}

export interface PagoRecibido {
  id:             string
  paymentNumber:  string
  customerId:     string
  customerName?:  string
  customerTaxId?: string
  invoiceId?:     string
  invoiceNumber?: string
  invoiceTotal?:  number
  invoiceStatus?: string
  invoiceType?:   string
  paymentDate:    string
  amount:         number
  currency:       string
  exchangeRate?:  number
  mode?:          PaymentMode
  reference?:     string
  bankAccountId?: string
  notes?:         string
  journalEntryId?: string
  createdAt:      string
  // anticipo flags
  isAdvance?:        boolean
  advanceInvoiceId?: string
  advanceNumber?:    string
  // detail only
  invoice?:       any
  customer?:      any
  bankAccount?:   any
  journalEntry?:  any
}

export interface CreatePagoRecibidoDto {
  customerId:     string
  invoiceId?:     string
  isAdvance?:     boolean
  paymentDate:    string
  amount:         number
  mode?:          PaymentMode
  reference?:     string
  bankAccountId?: string
  notes?:         string
  currency?:      string
  exchangeRate?:  number
}

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = '/ventas/pagos-recibidos'

export const getPagosRecibidos = (params?: {
  page?: number; limit?: number; search?: string
  customerId?: string; invoiceId?: string; fromDate?: string; toDate?: string; mode?: string
}) => api.get(BASE, { params }).then(unwrap) as Promise<{ data: PagoRecibido[]; total: number }>

export const getPagoRecibido = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<PagoRecibido>

export const createPagoRecibido = (dto: CreatePagoRecibidoDto) =>
  api.post(BASE, dto).then(unwrap) as Promise<PagoRecibido>

export const deletePagoRecibido = (id: string) =>
  api.delete(`${BASE}/${id}`)

export const reprocessPagoJournal = (id: string) =>
  api.patch(`${BASE}/${id}/reprocess-journal`).then(unwrap) as Promise<{ message: string; journalEntryId?: string; entryNumber?: string; bankAccount?: string; cxcAccount?: string }>
