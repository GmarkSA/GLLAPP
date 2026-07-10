import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Enums ────────────────────────────────────────────────────────────────────
export type InvoiceStatus =
  | 'draft' | 'pending' | 'sent' | 'partial' | 'paid' | 'overdue' | 'voided' | 'written_off'

export type InvoiceType = 'standard' | 'recurring' | 'proforma' | 'credit_note'

export type EstimateStatus =
  | 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced' | 'expired'

// ─── Journal ──────────────────────────────────────────────────────────────────
export interface JournalLine {
  key:         string
  accountId?:  string
  accountCode: string
  accountName: string
  debe:        number
  haber:       number
  tipo:        'activo' | 'ingreso' | 'pasivo' | 'gasto' | 'costo'
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export interface InvoiceItem {
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
  projectId?:      string
  sortOrder?:      number
}

export interface InvoicePayment {
  id:             string
  paymentNumber:  string
  paymentDate:    string
  amount:         number
  currency:       string
  mode:           string
  reference?:     string
  bankAccountId?: string
  notes?:         string
  journalEntryId?: string
  createdAt:      string
}

export interface FelFrase {
  tipoFrase:       number
  codigoEscenario: number
}

export interface Invoice {
  id:              string
  invoiceNumber:   string
  type:            InvoiceType
  status:          InvoiceStatus
  customerId:      string
  customerName:    string
  customerTaxId?:  string
  invoiceDate:     string
  accountingDate?: string
  dueDate?:        string
  currency:        string
  exchangeRate:    number
  subtotal:        number
  discountAmount:  number
  discountPercent: number
  taxAmount:       number
  total:           number
  paidAmount:      number
  balance:         number
  advanceApplied?: number
  // FEL Guatemala
  felTipoDocumento?: string
  felUuid?:          string
  felSerie?:         string
  felNumero?:        string
  felAutorizacion?:  string
  felMensaje?:       string
  felUrl?:           string
  felStatus?:        string
  felCertificadaAt?: string
  felFrases?:        FelFrase[]
  lugarExpedicion?:  string
  facturaExenta?:    boolean
  nombreConsignatario?:    string
  direccionConsignatario?: string
  incoterm?:         string
  estimateId?:     string
  purchaseOrderRef?: string
  notes?:          string
  termsAndConditions?: string
  incomeAccountId?: string
  bankAccountId?:  string
  voidedReason?:   string
  sentAt?:         string
  centroCostoId?:      string
  centroBeneficioId?:  string
  journalEntryId?:     string   // Asiento de venta (CxC / Ingresos / IVA)
  costJournalEntryId?: string   // Asiento de baja de inventario
  journalLines?:   JournalLine[]
  items?:          InvoiceItem[]
  payments?:       InvoicePayment[]
  createdAt:       string
  updatedAt:       string
}

// ─── Estimate ─────────────────────────────────────────────────────────────────
export interface Estimate {
  id:              string
  estimateNumber:  string
  status:          EstimateStatus
  customerId:      string
  customerName:    string
  customerTaxId?:  string
  estimateDate:    string
  expiryDate?:     string
  currency:        string
  exchangeRate:    number
  subtotal:        number
  discountAmount:  number
  taxAmount:       number
  total:           number
  notes?:          string
  termsAndConditions?: string
  invoiceId?:      string  // set when converted
  items:           InvoiceItem[]
  createdAt:       string
  updatedAt:       string
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────
export interface CreateInvoiceDto {
  status?:          InvoiceStatus
  customerId:       string
  invoiceDate:      string
  accountingDate?:  string
  dueDate?:         string
  currency?:       string
  exchangeRate?:   number
  discountPercent?: number
  discountAmount?: number
  items:           Omit<InvoiceItem, 'id' | 'discountAmount' | 'taxAmount' | 'lineTotal'>[]
  notes?:          string
  termsAndConditions?: string
  estimateId?:     string
  purchaseOrderRef?: string
  // FEL Guatemala — configuración
  felTipoDocumento?:       string
  lugarExpedicion?:        string
  facturaExenta?:          boolean
  felFrases?:              FelFrase[]
  nombreConsignatario?:    string
  direccionConsignatario?: string
  incoterm?:               string
  // FEL Guatemala — campos certificador (pre-llenar o recibir del certifier)
  felSerie?:        string
  felNumero?:       string
  felAutorizacion?: string
  felMensaje?:      string
  felUrl?:          string
  felUuid?:         string
  felCertificadaAt?: string
  centroCostoId?:    string
  centroBeneficioId?: string
}

export interface CreateEstimateDto {
  customerId:      string
  estimateDate:    string
  expiryDate?:     string
  currency?:       string
  discountPercent?: number
  items:           Omit<InvoiceItem, 'id' | 'discountAmount' | 'taxAmount' | 'lineTotal'>[]
  notes?:          string
  termsAndConditions?: string
}

export interface RecordPaymentDto {
  paymentDate:   string
  amount:        number
  mode?:         string
  reference?:    string
  bankAccountId?: string
  notes?:        string
  currency?:     string
}

// ─── Invoice API ──────────────────────────────────────────────────────────────
const BASE_INV = '/ventas/facturas'

// ─── Libro de Ventas ──────────────────────────────────────────────────────────

export interface LibroVentasRow {
  folio:          number
  tipoDocumento:  string
  fecha:          string
  felSerie:       string
  felNumero:      string
  referencia:     string
  nitCliente:     string
  nombreCliente:  string
  // VALOR BASE por categoría SAT
  ventaBienes:    number
  ventaServicios: number
  exportacion:    number
  exento:         number
  // Impuesto
  iva:            number
  total:          number
  // Meta
  uuid:           string
  numeroInterno:  string
  status:         string
  categoria:      string
}

export interface LibroVentasResumenCategoria {
  categoria: string
  cantidad:  number
  base:      number
  iva:       number
  total:     number
}

export interface LibroVentasReport {
  from:             string
  to:               string
  items:            LibroVentasRow[]
  totals: {
    ventaBienes: number; ventaServicios: number
    exportacion: number; exento: number; iva: number; total: number
  }
  resumenCategoria: LibroVentasResumenCategoria[]
  count:            number
}

// ─── AR Aging (CxC) ──────────────────────────────────────────────────────────

export interface ArAgingPayment {
  paymentNumber: string
  paymentDate:   string | null
  amount:        number
  mode:          string | null
  reference:     string | null
}

export interface ArAgingRow {
  id:           string
  invoiceNumber: string
  customerId:   string
  customerName: string
  invoiceDate:  string
  dueDate?:     string
  currency:     string
  exchangeRate: number
  total:        number
  totalGTQ:     number
  paidAmount:   number
  balance:      number
  balanceGTQ:   number
  daysOverdue:  number
  payments:     ArAgingPayment[]
}

export interface ArAgingBucket {
  label: string
  total: number
  count: number
  items: ArAgingRow[]
}

export interface ArAgingReport {
  buckets: {
    current:  ArAgingBucket
    days_30:  ArAgingBucket
    days_60:  ArAgingBucket
    days_90:  ArAgingBucket
    over_90:  ArAgingBucket
  }
  grandTotal:    number
  advances:      any[]
  totalAdvances: number
  netTotal:      number
  generatedAt:   string
}

export const getArAging = (asOf?: string) =>
  api.get(`${BASE_INV}/reportes/ar-aging`, { params: asOf ? { asOf } : undefined }).then(unwrap) as Promise<ArAgingReport>

export const getLibroVentas = (from: string, to: string) =>
  api.get(`${BASE_INV}/reportes/libro-ventas`, { params: { from, to } }).then(unwrap) as Promise<LibroVentasReport>

export const downloadLibroVentasExcel = async (from: string, to: string, filename: string) => {
  const res = await api.get(`${BASE_INV}/reportes/libro-ventas/excel`, { params: { from, to }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export const getInvoices = (params?: {
  page?: number; limit?: number; search?: string
  status?: string; customerId?: string; fromDate?: string; toDate?: string
}) => api.get(BASE_INV, { params }).then(unwrap) as Promise<{ data: Invoice[]; total: number }>

export const getInvoice = (id: string) =>
  api.get(`${BASE_INV}/${id}`).then(unwrap) as Promise<Invoice>

export const createInvoice = (dto: CreateInvoiceDto) =>
  api.post(BASE_INV, dto).then(unwrap) as Promise<Invoice>

export const updateInvoice = (id: string, dto: Partial<CreateInvoiceDto>) =>
  api.patch(`${BASE_INV}/${id}`, dto).then(unwrap) as Promise<Invoice>

export const recordInvoicePayment = (id: string, dto: RecordPaymentDto) =>
  api.post(`${BASE_INV}/${id}/pago`, dto).then(unwrap) as Promise<InvoicePayment>

export const voidInvoice = (id: string, reason: string) =>
  api.post(`${BASE_INV}/${id}/anular`, { reason }).then(unwrap)

export const sendInvoice = (id: string, dto: { to: string; subject?: string; message?: string }) =>
  api.post(`${BASE_INV}/${id}/enviar`, dto).then(unwrap)

export const convertEstimateToInvoice = (estimateId: string) =>
  api.post(`${BASE_INV}/convertir-desde-estimacion/${estimateId}`).then(unwrap) as Promise<Invoice>

export const emitirFelInvoice = (id: string) =>
  api.post(`${BASE_INV}/${id}/emitir-fel`).then(unwrap) as Promise<Invoice>

export const anularFelInvoice = (id: string, motivo: string) =>
  api.post(`${BASE_INV}/${id}/anular-fel`, { motivo }).then(unwrap) as Promise<Invoice>

export const writeOffInvoice = (id: string, reason: string) =>
  api.post(`${BASE_INV}/${id}/condonar`, { reason }).then(unwrap) as Promise<Invoice>

export const deleteInvoice = (id: string) =>
  api.delete(`${BASE_INV}/${id}`)

export const marcarEnviada = (id: string) =>
  api.post(`${BASE_INV}/${id}/marcar-enviada`).then(unwrap) as Promise<Invoice>

export const recomputeJournalLines = (id: string) =>
  api.post(`${BASE_INV}/${id}/recompute-journal`).then(unwrap) as Promise<Invoice>

/** Reprocesa la póliza contable de un pago (Dr Banco/Cr CxC). Funciona para pagos creados desde cualquier flujo. */
export const reprocessPaymentJournal = (paymentId: string) =>
  api.patch(`/ventas/pagos-recibidos/${paymentId}/reprocess-journal`).then((r: any) => r.data?.data ?? r.data) as Promise<{ message: string; journalEntryId?: string; entryNumber?: string }>

export const marcarEnviadasMasivo = (ids: string[]) =>
  api.post(`${BASE_INV}/masiva/marcar-enviadas`, { ids }).then(unwrap) as Promise<{
    updated: number
    errors:  Array<{ id: string; message: string }>
  }>

// ─── Anticipos API ────────────────────────────────────────────────────────────
const BASE_ANT = '/ventas/facturas-anticipo'

export interface Anticipo {
  id:           string
  invoiceNumber: string
  customerId:   string
  customerName: string
  invoiceDate:  string
  total:        number
  balance:      number
  paidAmount:   number
  currency:     string
  notes?:       string
}

export const getAnticipos = (params?: { customerId?: string; page?: number; limit?: number }) =>
  api.get(BASE_ANT, { params }).then(unwrap) as Promise<{ data: Anticipo[]; total: number }>

export const createAnticipo = (dto: { customerId: string; amount: number; date?: string; notes?: string; currency?: string; reference?: string; bankAccountId?: string }) =>
  api.post(BASE_ANT, dto).then(unwrap) as Promise<Anticipo>

export const applyAnticipo = (advanceId: string, invoiceId: string, amount?: number) =>
  api.post(`${BASE_ANT}/${advanceId}/aplicar`, { invoiceId, amount }).then(unwrap)

// ─── Estimate API ─────────────────────────────────────────────────────────────
const BASE_EST = '/ventas/estimaciones'

export const getEstimates = (params?: {
  page?: number; limit?: number; search?: string; status?: string; customerId?: string
}) => api.get(BASE_EST, { params }).then(unwrap) as Promise<{ data: Estimate[]; total: number }>

export const getEstimate = (id: string) =>
  api.get(`${BASE_EST}/${id}`).then(unwrap) as Promise<Estimate>

export const createEstimate = (dto: CreateEstimateDto) =>
  api.post(BASE_EST, dto).then(unwrap) as Promise<Estimate>

export const updateEstimate = (id: string, dto: Partial<CreateEstimateDto>) =>
  api.patch(`${BASE_EST}/${id}`, dto).then(unwrap) as Promise<Estimate>

export const sendEstimate = (id: string, dto: { to: string }) =>
  api.post(`${BASE_EST}/${id}/enviar`, dto).then(unwrap)

export const convertEstimate = (id: string) =>
  api.post(`${BASE_EST}/${id}/convertir-a-factura`).then(unwrap) as Promise<Invoice>

export const duplicateEstimate = (id: string) =>
  api.post(`${BASE_EST}/${id}/duplicar`).then(unwrap) as Promise<Estimate>

export const deleteEstimate = (id: string) =>
  api.delete(`${BASE_EST}/${id}`)

// ─── Status helpers ───────────────────────────────────────────────────────────
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft:       { label: 'Borrador',     color: 'default'  },
  pending:     { label: 'Pendiente',    color: 'orange'   },
  sent:        { label: 'Enviada',      color: 'blue'     },
  partial:     { label: 'Pago parcial', color: 'geekblue' },
  paid:        { label: 'Pagada',       color: 'green'    },
  overdue:     { label: 'Vencida',      color: 'red'      },
  voided:      { label: 'Anulada',      color: 'volcano'  },
  written_off: { label: 'Condonada',    color: 'purple'   },
}

export const ESTIMATE_STATUS_CONFIG: Record<EstimateStatus, { label: string; color: string }> = {
  draft:    { label: 'Borrador',    color: 'default' },
  sent:     { label: 'Enviada',     color: 'blue'    },
  accepted: { label: 'Aceptada',    color: 'green'   },
  declined: { label: 'Rechazada',   color: 'red'     },
  invoiced: { label: 'Facturada',   color: 'purple'  },
  expired:  { label: 'Vencida',     color: 'orange'  },
}

export const FEL_TIPOS_DOCUMENTO = [
  { value: 'FACT',  label: 'FACT — Factura estándar' },
  { value: 'FCAM',  label: 'FCAM — Factura cambiaria' },
  { value: 'FPEQ',  label: 'FPEQ — Pequeño contribuyente' },
  { value: 'FAPE',  label: 'FAPE — Exportación pequeño contribuyente' },
  { value: 'NABN',  label: 'NABN — Nota de abono' },
  { value: 'RECI',  label: 'RECI — Recibo' },
  { value: 'NDEB',  label: 'NDEB — Nota de débito' },
  { value: 'NCRE',  label: 'NCRE — Nota de crédito' },
]

export const FEL_TIPOS_FRASE = [
  { tipoFrase: 1, codigoEscenario: 1, label: 'Art. 52 Ley IVA — Exento ISR' },
  { tipoFrase: 1, codigoEscenario: 2, label: 'Art. 55 Ley IVA — Exento ISR y IVA' },
  { tipoFrase: 2, codigoEscenario: 1, label: 'Exportación' },
  { tipoFrase: 3, codigoEscenario: 1, label: 'Art. 7 Ley IVA — Exento IVA' },
  { tipoFrase: 4, codigoEscenario: 1, label: 'Especial Dominios' },
]

export const INCOTERMS = [
  { value: 'EXW', label: 'EXW — Ex Works' },
  { value: 'FCA', label: 'FCA — Free Carrier' },
  { value: 'FAS', label: 'FAS — Free Alongside Ship' },
  { value: 'FOB', label: 'FOB — Free On Board' },
  { value: 'CFR', label: 'CFR — Cost and Freight' },
  { value: 'CIF', label: 'CIF — Cost, Insurance and Freight' },
  { value: 'CPT', label: 'CPT — Carriage Paid To' },
  { value: 'CIP', label: 'CIP — Carriage and Insurance Paid' },
  { value: 'DAP', label: 'DAP — Delivered at Place' },
  { value: 'DPU', label: 'DPU — Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP — Delivered Duty Paid' },
]

export const PAYMENT_MODES = [
  { value: 'cash',          label: '💵 Efectivo' },
  { value: 'bank_transfer', label: '🏦 Transferencia bancaria' },
  { value: 'check',         label: '📄 Cheque' },
  { value: 'credit_card',   label: '💳 Tarjeta de crédito' },
  { value: 'debit_card',    label: '💳 Tarjeta de débito' },
  { value: 'online',        label: '🌐 Pago en línea' },
]

// ─── DTE SAT Emitidos ─────────────────────────────────────────────────────────

export type SatEmitidosStatus = 'pending' | 'ready' | 'duplicate' | 'posted' | 'error'
export type SatEmitidosJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface SatDteEmitidos {
  id: string
  status: SatEmitidosStatus
  uuid: string
  tipoDocumento?: string
  serie?: string
  numeroDte?: string
  fechaEmision?: string
  nitEmisor?: string
  nombreEmisor?: string
  nitReceptor?: string
  nombreReceptor?: string
  moneda: string
  subtotal: number
  totalIva: number
  total: number
  xmlUrl?: string
  pdfUrl?: string
  xmlKey?: string
  pdfKey?: string
  customerId?: string
  invoiceId?: string
  errorMessage?: string
  items?: Array<{ descripcion?: string; description?: string; cantidad?: string; precio_unitario?: string; total_linea?: string; iva?: string }>
  createdAt: string
  updatedAt?: string
}

export interface SatEmitidosJob {
  id: string
  status: SatEmitidosJobStatus
  apifyRunId?: string
  defaultDatasetId?: string
  fechaInicio: string
  fechaFin: string
  satNit?: string
  importedCount: number
  duplicateCount: number
  errorMessage?: string
  createdAt: string
  updatedAt?: string
}

const DTE_EMIT = '/ventas/dte-sat'

export const startSatEmitidosImport = (dto: { fechaInicio: string; fechaFin: string }) =>
  api.post(`${DTE_EMIT}/importar`, dto).then(unwrap) as Promise<SatEmitidosJob>

export const syncSatEmitidosJob = (id: string) =>
  api.post(`${DTE_EMIT}/jobs/${id}/sincronizar`).then(unwrap) as Promise<SatEmitidosJob>

export const getSatEmitidosDocuments = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(`${DTE_EMIT}/documentos`, { params }).then(unwrap) as Promise<{ data: SatDteEmitidos[]; total: number }>

export const getSatEmitidosJobs = (params?: { page?: number; limit?: number }) =>
  api.get(`${DTE_EMIT}/jobs`, { params }).then(unwrap) as Promise<{ data: SatEmitidosJob[]; total: number }>

export const getSatEmitidosStats = () =>
  api.get(`${DTE_EMIT}/stats`).then(unwrap) as Promise<Record<SatEmitidosStatus, { count: number; total: number }>>

export const resolveSatEmitidosCustomer = (id: string) =>
  api.post(`${DTE_EMIT}/documentos/${id}/resolver-cliente`).then(unwrap)

export const createSatEmitidosCustomer = (id: string, dto?: {
  name?: string
  legalName?: string
  currency?: string
  paymentTerms?: string
  paymentTermsDays?: number
  receivableAccountId?: string
  incomeAccountId?: string
  taxCode?: string
}) => api.post(`${DTE_EMIT}/documentos/${id}/crear-cliente`, dto ?? {}).then(unwrap)

export const deleteSatEmitidos = (id: string) =>
  api.post(`${DTE_EMIT}/documentos/${id}/eliminar`).then(unwrap) as Promise<{ deleted: boolean; id: string }>

export const clearAllSatEmitidos = () =>
  api.post(`${DTE_EMIT}/limpiar-todo`).then(unwrap) as Promise<{ deletedDtes: number; deletedJobs: number }>

export const reactivateSatEmitidos = (id: string) =>
  api.post(`${DTE_EMIT}/documentos/${id}/reactivar`).then(unwrap)

export const postSatEmitidos = (id: string, dto: {
  taxId?: string
  accountId?: string
  accountingDate?: string
  notes?: string
  estimateId?: string
  defaultUnit?: string
  creditNoteReason?: string
  originalInvoiceId?: string
}) => api.post(`${DTE_EMIT}/documentos/${id}/contabilizar`, dto).then(unwrap) as Promise<{
  invoice: Invoice
  dte: SatDteEmitidos
}>
