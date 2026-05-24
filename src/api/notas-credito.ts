import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type NcStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'voided'

export interface NcItem {
  id?:             string
  productId?:      string
  description:     string
  unit?:           string
  quantity:        number
  unitPrice:       number
  discountPercent: number
  discountAmount?: number
  taxPercent:      number
  taxId?:          string
  taxAmount?:      number
  lineTotal:       number
  accountId?:      string
  sortOrder?:      number
}

export interface OriginalInvoiceRef {
  id:            string
  invoiceNumber: string
  total:         number
  status:        string
  invoiceDate:   string
  customerName:  string
}

export interface NotaCredito {
  id:                  string
  invoiceNumber:       string
  status:              NcStatus
  customerId:          string
  customerName:        string
  customerTaxId?:      string
  invoiceDate:         string
  currency:            string
  exchangeRate:        number
  subtotal:            number
  taxAmount:           number
  total:               number
  creditBalance:       number
  appliedCreditAmount: number
  originalInvoiceId?:  string
  originalInvoice?:    OriginalInvoiceRef
  creditNoteReason?:   string
  notes?:              string
  // FEL
  felTipoDocumento?:  string
  felUuid?:           string
  felSerie?:          string
  felNumero?:         string
  felAutorizacion?:   string
  felMensaje?:        string
  felUrl?:            string
  felStatus?:         string
  felCertificadaAt?:  string
  lugarExpedicion?:   string
  facturaExenta?:     boolean
  journalEntryId?:        string
  costJournalEntryId?:    string
  journalLines?:          any[]
  items?:             NcItem[]
  history?:           Array<{ action: string; by: string; at: string }>
  createdAt:          string
  updatedAt:          string
}

export interface CreateNotaCreditoDto {
  originalInvoiceId?: string
  customerId:         string
  invoiceDate:        string
  reason:             string
  currency?:          string
  exchangeRate?:      number
  items:              Omit<NcItem, 'id' | 'discountAmount' | 'taxAmount' | 'lineTotal'>[]
  notes?:             string
  felTipoDocumento?:  'NCRE' | 'NABN'   // NCRE (≤60 días) | NABN (>60 días) — regla SAT Guatemala
  lugarExpedicion?:   string
  facturaExenta?:     boolean
  felFrases?:         Array<{ tipoFrase: number; codigoEscenario: number }>
}

export interface ApplyCreditDto {
  invoiceId: string
  amount:    number
}

export interface RefundCreditDto {
  amount:        number
  paymentDate:   string
  mode?:         string
  bankAccountId?: string
  reference?:    string
  notes?:        string
}

// ─── Configuración de estado ──────────────────────────────────────────────────
export const NC_STATUS_CONFIG: Record<NcStatus, { label: string; color: string }> = {
  draft:   { label: 'Borrador',          color: 'default'  },
  sent:    { label: 'Emitida',           color: 'blue'     },
  partial: { label: 'Aplicada parcial',  color: 'geekblue' },
  paid:    { label: 'Aplicada total',    color: 'green'    },
  voided:  { label: 'Anulada',           color: 'volcano'  },
}

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = '/ventas/notas-credito'

export const getNotasCredito = (params?: {
  page?: number; limit?: number; search?: string
  status?: string; customerId?: string; fromDate?: string; toDate?: string
}) => api.get(BASE, { params }).then(unwrap) as Promise<{ data: NotaCredito[]; total: number }>

export const getNotaCredito = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<NotaCredito>

export const createNotaCredito = (dto: CreateNotaCreditoDto) =>
  api.post(BASE, dto).then(unwrap) as Promise<NotaCredito>

export const emitirNotaCredito = (id: string) =>
  api.post(`${BASE}/${id}/emitir`).then(unwrap) as Promise<NotaCredito>

export const recomputeJournalNC = (id: string) =>
  api.post(`${BASE}/${id}/recompute-journal`).then(unwrap) as Promise<NotaCredito>

export const aplicarNotaCredito = (id: string, dto: ApplyCreditDto) =>
  api.post(`${BASE}/${id}/aplicar`, dto).then(unwrap)

export const reembolsarNotaCredito = (id: string, dto: RefundCreditDto) =>
  api.post(`${BASE}/${id}/reembolso`, dto).then(unwrap)

export const updateNotaCredito = (id: string, dto: Partial<CreateNotaCreditoDto> & { items?: any[] }) =>
  api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<NotaCredito>

export const anularNotaCredito = (id: string, reason: string) =>
  api.post(`${BASE}/${id}/anular`, { reason }).then(unwrap) as Promise<NotaCredito>

export const deleteNotaCredito = (id: string) =>
  api.delete(`${BASE}/${id}`)
