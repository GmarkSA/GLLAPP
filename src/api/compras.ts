import api from './axios'
import { getOrganizationProfile } from './configuracion'
import { requestUploadUrl, uploadToR2, deleteDocument } from './storage'
import { useCompanyStore } from '../store/companyStore'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Account Defaults ─────────────────────────────────────────────────────────
export interface AccountDefaults {
  customerAdvanceAccountCode?: string
  vendorAdvanceAccountCode?:   string
  employeeAdvanceAccountCode?: string
}

export const getAccountDefaults = async (): Promise<AccountDefaults> => {
  const profile = await getOrganizationProfile().catch(() => ({} as any))
  return (profile as any)?.settings?.accountDefaults ?? {}
}

// ─── Anticipos Proveedor ──────────────────────────────────────────────────────
export interface VendorAdvance {
  id:                 string
  advanceNumber:      string
  vendorId?:          string
  vendorName?:        string
  advanceDate:        string
  amount:             number
  currency:           string
  exchangeRate:       number
  amountGTQ:          number
  balance:            number
  status:             'open' | 'partial' | 'applied' | 'voided'
  bankAccountId?:     string
  advanceAccountCode?: string
  advanceAccountName?: string
  journalEntryId?:    string
  reference?:         string
  journalLines?:      { accountCode: string; accountName: string; debit: number; credit: number }[]
}

export const createVendorAdvance = (dto: {
  vendorId?:           string
  vendorName?:         string
  amount:              number
  date?:               string
  currency?:           string
  exchangeRate?:       number
  reference?:          string
  notes?:              string
  bankAccountId?:      string
  advanceAccountCode?: string
}) => api.post('/compras/anticipos-proveedor', dto).then(unwrap) as Promise<VendorAdvance>

export const getVendorAdvances = (params?: { vendorId?: string; status?: string; page?: number; limit?: number }) =>
  api.get('/compras/anticipos-proveedor', { params }).then(unwrap) as Promise<{ data: VendorAdvance[]; total: number }>

export const voidVendorAdvance = (id: string, dto?: { date?: string }) =>
  api.patch(`/compras/anticipos-proveedor/${id}/void`, dto ?? {}).then(unwrap) as Promise<VendorAdvance>

export const unvoidVendorAdvance = (id: string) =>
  api.patch(`/compras/anticipos-proveedor/${id}/unvoid`).then(unwrap) as Promise<VendorAdvance>

export const applyVendorAdvanceRefund = (
  id: string,
  dto: { bankAccountId?: string; date?: string; reference?: string; notes?: string },
) => api.patch(`/compras/anticipos-proveedor/${id}/apply-refund`, dto).then(unwrap) as Promise<{
  advance: VendorAdvance
  payment: { id: string; paymentNumber: string }
  journalEntry: { id: string; entryNumber: string; lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }> }
}>

export const desaplicarAnticipoProveedor = (advanceId: string) =>
  api.post(`/compras/anticipos-proveedor/${advanceId}/desaplicar`, {}).then(unwrap)

export const applyVendorAdvanceToBill = (
  advanceId: string,
  invoiceId: string,
  amount?: number,
  date?: string,
) => api.post(`/compras/anticipos-proveedor/${advanceId}/apply`, {
  invoiceIds: [invoiceId],
  ...(amount !== undefined ? { amounts: { [invoiceId]: amount } } : {}),
  ...(date ? { date } : {}),
}).then(unwrap) as Promise<VendorAdvance>

// ─── Types ────────────────────────────────────────────────────────────────────
export type BillStatus   = 'draft' | 'pending_approval' | 'open' | 'partial' | 'paid' | 'overdue' | 'voided'
export type BillType     = 'goods' | 'services' | 'reimbursement' | 'special' | 'fuel' | 'credit_note' | 'exempt' | 'donation' | 'small_taxpayer' | 'fixed_asset'
export type PaymentTerms = 'immediate' | 'net_15' | 'net_30' | 'net_60' | 'net_90' | 'custom'
export type POStatus     = 'draft' | 'sent' | 'received' | 'billed' | 'cancelled'

export type IdpFuelType = 'super' | 'regular' | 'diesel' | 'other'

export interface BillItem {
  id?:             string
  productId?:      string
  description:     string
  unit?:           string
  quantity:        number
  unitPrice:       number
  discountPercent:  number
  discountAmount?:  number
  taxPercent:       number
  taxId?:          string
  lineTotal:       number
  accountId?:      string
  projectId?:      string
  // IDP (combustible)
  idpType?:        IdpFuelType
  idpAmount?:      number
}

export interface PurchaseInvoice {
  id:                      string
  invoiceNumber:           string
  vendorInvoiceNumber?:    string
  status:                  BillStatus
  invoiceType:             BillType
  vendorId:                string
  vendorName:              string
  vendorTaxId?:            string
  invoiceDate:             string
  accountingDate?:         string   // Fecha de contabilización (período contable)
  dueDate?:                string

  // Términos de pago
  paymentTerms:            PaymentTerms
  paymentTermsDays?:       number

  // Moneda
  currency:                string
  exchangeRate:            number

  // Totales
  subtotal:                number
  taxAmount:               number
  retentionAmount:         number
  isrRetentionAmount:      number
  ivaRetentionAmount:      number
  isrRetentionAccountId?:  string
  idpAmount:               number
  total:                   number
  paidAmount:              number
  balance:                 number

  // FEL (Factura Electrónica SAT Guatemala)
  felSerie?:               string
  felNumber?:              string
  felUuid?:                string
  felAuthNumber?:          string
  felMessage?:             string
  felCertDate?:            string

  // Reembolso de gastos
  isExpenseReimbursement?: boolean
  employeeId?:             string
  employeeName?:           string
  employeePayableAccountId?: string

  // Cuentas
  accountId?:              string
  idpAccountId?:           string
  timbrePrensaAmount?:     number
  timbrePrensaAccountId?:  string
  turismoAmount?:          number
  turismoAccountId?:       string
  journalEntryId?:         string
  reclassificationJournalEntryId?: string

  purchaseOrderId?:        string
  originalInvoiceId?:      string
  creditNoteReason?:       string
  notes?:                  string
  centroCostoId?:          string
  centroBeneficioId?:      string
  items:                   BillItem[]
  attachments?:            any[]
  customFields?:           Record<string, any>
  createdAt:               string
  updatedAt?:              string
}

export interface PurchaseOrder {
  id:                    string
  orderNumber:           string
  status:                POStatus
  vendorId:              string
  vendorName:            string
  vendorTaxId?:          string
  orderDate:             string
  expectedDeliveryDate?: string
  currency:              string
  paymentTerms?:         string
  paymentTermsDays?:     number
  total:                 number
  notes?:                string
  items:                 BillItem[]
  customFields?:         Record<string, any>
  createdAt:             string
}

// ─── Gastos ───────────────────────────────────────────────────────────────────
export interface Expense {
  id: string; expenseNumber: string; status: string
  vendorId?: string; vendorName?: string; categoryId: string; categoryName: string
  expenseDate: string; amount: number; taxAmount: number; total: number
  currency: string; reference?: string; notes?: string
}

// ─── Proveedores ──────────────────────────────────────────────────────────────
export interface Vendor {
  id: string; code?: string; name: string; tradeName?: string
  taxId?: string; email?: string; phone?: string; isActive: boolean
  defaultPurchaseTaxId?: string
}

// ─── AP Aging ────────────────────────────────────────────────────────────────
export interface ApAgingRow {
  id:                      string
  invoiceNumber:           string
  vendorId:                string
  vendorName:              string
  isExpenseReimbursement?: boolean
  invoiceDate:             string
  dueDate?:                string
  currency:                string
  exchangeRate:            number
  total:                   number
  totalGTQ:                number
  balance:                 number
  balanceGTQ:              number
  daysOverdue:             number
}

export interface ApAgingBucket {
  label: string
  total: number
  count: number
  items: ApAgingRow[]
}

export interface ApAgingReport {
  buckets: {
    current:  ApAgingBucket
    days_30:  ApAgingBucket
    days_60:  ApAgingBucket
    days_90:  ApAgingBucket
    over_90:  ApAgingBucket
  }
  grandTotal:   number
  generatedAt:  string
}

// ─── Libro de Compras ─────────────────────────────────────────────────────────
export interface LibroComprasRow {
  folio:                number
  tipoDocumento:        BillType
  fecha:                string
  felSerie:             string
  felNumero:            string
  referencia:           string
  nitProveedor:         string
  nombreProveedor:      string
  // VALOR BASE por categoría SAT
  compraBienes:         number
  compraServicios:      number
  compraCombustibles:   number
  importacion:          number
  pequenoContribuyente: number
  exento:               number
  // Impuestos adicionales (no forman parte de la base IVA)
  idp:                  number
  turismo:              number
  iva:                  number
  total:                number
  retencionIsr:         number
  retencionIva:         number
  // Meta
  uuid:                 string
  numeroInterno:        string
  status:               BillStatus
  categoria:            string
}

export interface LibroComprasResumenCategoria {
  categoria: string
  cantidad:  number
  base:      number
  iva:       number
  total:     number
}

export interface LibroComprasReport {
  from:               string
  to:                 string
  items:              LibroComprasRow[]
  totals:             {
    compraBienes: number; compraServicios: number; compraCombustibles: number
    importacion: number; pequenoContribuyente: number; exento: number
    idp: number; turismo: number; iva: number; total: number; retencionIsr: number; retencionIva: number
  }
  resumenCategoria:   LibroComprasResumenCategoria[]
  count:              number
}

// ─── Journal Entry ───────────────────────────────────────────────────────────
export interface JournalEntryLine {
  id:                string
  accountId:         string
  accountCode:       string
  accountName:       string
  description?:      string
  debit:             number
  credit:            number
  sortOrder:         number
  centroCostoId?:    string | null
  centroBeneficioId?: string | null
}

export interface JournalEntry {
  id:               string
  entryNumber:      string
  type:             string
  status:           string
  entryDate:        string
  accountingDate?:  string | null
  description:      string
  reference?:       string
  totalDebit:       number
  totalCredit:      number
  currency:         string
  lines:            JournalEntryLine[]
}

export const getJournalEntry = (id: string) =>
  api.get(`/contabilidad/asientos/${id}`).then(unwrap) as Promise<JournalEntry>

// ─── Bills (Facturas de Proveedor) ────────────────────────────────────────────
const BILL = '/compras/facturas-proveedor'

export const getBills = (params?: { page?: number; limit?: number; search?: string; status?: string; vendorId?: string }) =>
  api.get(BILL, { params }).then(unwrap) as Promise<{ data: PurchaseInvoice[]; total: number }>

export const getBill = (id: string) =>
  api.get(`${BILL}/${id}`).then(unwrap) as Promise<PurchaseInvoice>

export const createBill = (dto: Partial<PurchaseInvoice>) =>
  api.post(BILL, dto).then(unwrap) as Promise<PurchaseInvoice>

export const updateBill = (id: string, dto: Partial<PurchaseInvoice>) =>
  api.patch(`${BILL}/${id}`, dto).then(unwrap) as Promise<PurchaseInvoice>

export const approveBill = (id: string) =>
  api.post(`${BILL}/${id}/aprobar`).then(unwrap) as Promise<PurchaseInvoice>

export const regenerateBillJournalEntry = (id: string) =>
  api.post(`${BILL}/${id}/regenerar-asiento`).then(unwrap) as Promise<PurchaseInvoice>

export const recordBillPayment = (id: string, dto: {
  amount: number
  currency?: string
  exchangeRate?: number
  paymentDate: string
  mode?: string
  reference?: string
  bankAccountId?: string
  bankTransactionId?: string
}) => api.post(`${BILL}/${id}/registrar-pago`, dto).then(unwrap)

export const voidBill = (id: string, reason?: string) =>
  api.post(`${BILL}/${id}/anular`, { reason }).then(unwrap)

export const deleteBill = (id: string) =>
  api.delete(`${BILL}/${id}`)

export const getApAging = (asOf?: string) =>
  api.get(`${BILL}/reportes/ap-aging`, { params: asOf ? { asOf } : undefined }).then(unwrap) as Promise<ApAgingReport>

export const getLibroCompras = (from: string, to: string) =>
  api.get(`${BILL}/reportes/libro-compras`, { params: { from, to } }).then(unwrap) as Promise<LibroComprasReport>

export const downloadLibroComprasExcel = async (from: string, to: string, filename: string) => {
  const res = await api.get(`${BILL}/reportes/libro-compras/excel`, { params: { from, to }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Purchase Orders (Órdenes de Compra) ──────────────────────────────────────
const PO = '/compras/ordenes-compra'

export const getPurchaseOrders = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(PO, { params }).then(unwrap) as Promise<{ data: PurchaseOrder[]; total: number }>

export const getPurchaseOrder = (id: string) =>
  api.get(`${PO}/${id}`).then(unwrap) as Promise<PurchaseOrder>

export const createPurchaseOrder = (dto: Partial<PurchaseOrder>) =>
  api.post(PO, dto).then(unwrap) as Promise<PurchaseOrder>

export const updatePurchaseOrder = (id: string, dto: Partial<PurchaseOrder>) =>
  api.patch(`${PO}/${id}`, dto).then(unwrap) as Promise<PurchaseOrder>

export const approvePurchaseOrder = (id: string) =>
  api.post(`${PO}/${id}/aprobar`).then(unwrap)

export const sendPurchaseOrder = (id: string, dto: { to: string; subject?: string; message?: string }) =>
  api.post(`${PO}/${id}/enviar`, dto).then(unwrap)

export const deletePurchaseOrder = (id: string) =>
  api.delete(`${PO}/${id}`)

// ─── Gastos ───────────────────────────────────────────────────────────────────
const GASTO = '/compras/gastos'
export const getExpenses = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(GASTO, { params }).then(unwrap) as Promise<{ data: Expense[]; total: number } | Expense[]>
export const getExpense = (id: string) =>
  api.get(`${GASTO}/${id}`).then(unwrap) as Promise<Expense>

// ─── Proveedores ──────────────────────────────────────────────────────────────
const PROV = '/compras/proveedores'
export const getVendors = (params?: { search?: string; isActive?: boolean; limit?: number; page?: number; type?: string }) =>
  api.get(PROV, { params }).then(unwrap)

// ─── Status helpers ───────────────────────────────────────────────────────────
export const BILL_STATUS_CONFIG: Record<BillStatus, { label: string; color: string }> = {
  draft:            { label: 'Borrador',          color: 'default'  },
  pending_approval: { label: 'Pendiente aprobación', color: '#6b7280' },
  open:             { label: 'Pendiente',          color: '#ff7f00'  },
  partial:          { label: 'Pago parcial',       color: '#1faec2'},
  paid:             { label: 'Pagada',             color: '#2ea172'   },
  overdue:          { label: 'Vencida',            color: '#e5484d'     },
  voided:           { label: 'Anulada',            color: 'volcano' },
}

export const BILL_TYPE_CONFIG: Record<BillType, { label: string }> = {
  goods:          { label: 'Compra de bienes'          },
  services:       { label: 'Servicios'                 },
  reimbursement:  { label: 'Reembolso de gastos'       },
  special:        { label: 'Factura Especial (SAT)'    },
  fuel:           { label: 'Combustible (con IDP)'     },
  credit_note:    { label: 'Nota de Crédito'           },
  exempt:         { label: 'Exenta'                    },
  donation:       { label: 'Recibo Donación'           },
  small_taxpayer: { label: 'Pequeño Contribuyente'     },
  fixed_asset:    { label: 'Activo Fijo'               },
}

// ─── Notas de crédito de proveedor ───────────────────────────────────────────
const CREDIT_NOTE = `${BILL}/notas-credito`

export const getCreditNotes = (params?: { page?: number; limit?: number; search?: string; status?: string; vendorId?: string }) =>
  api.get(CREDIT_NOTE, { params }).then(unwrap) as Promise<{ data: PurchaseInvoice[]; total: number }>

export const createCreditNote = (dto: Partial<PurchaseInvoice>) =>
  api.post(CREDIT_NOTE, dto).then(unwrap) as Promise<PurchaseInvoice>

export const approveCreditNote = (id: string) =>
  api.post(`${CREDIT_NOTE}/${id}/aprobar`).then(unwrap) as Promise<PurchaseInvoice>

export const PAYMENT_TERMS_CONFIG: Record<PaymentTerms, string> = {
  immediate: 'Contado',
  net_15:    'Neto 15 días',
  net_30:    'Neto 30 días',
  net_60:    'Neto 60 días',
  net_90:    'Neto 90 días',
  custom:    'Personalizado',
}

export const IDP_RATES: Record<string, number> = {
  super:    4.70,
  regular:  4.60,
  aviacion: 4.70,
  diesel:   1.30,
  propano:  0.60,
  bunker:   0.55,
  kerosina: 0.50,
  other:    0.50,
}

export const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string }> = {
  draft:     { label: 'Borrador',   color: 'default' },
  sent:      { label: 'Enviada',    color: '#1faec2'    },
  received:  { label: 'Recibida',   color: 'cyan'    },
  billed:    { label: 'Facturada',  color: '#2ea172'   },
  cancelled: { label: 'Cancelada',  color: 'volcano' },
}

export type SatDteStatus = 'pending' | 'ready' | 'duplicate' | 'posted' | 'error'
export type SatImportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface SatDte {
  id: string
  status: SatDteStatus
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
  vendorId?: string
  purchaseInvoiceId?: string
  expenseId?: string
  errorMessage?: string
  items?: Array<{ descripcion?: string; description?: string; cantidad?: string; precio_unitario?: string; total_linea?: string; iva?: string }>
  /** Derivado del portal SAT (rawData.tabla_sat.ESTADO): true si la factura está anulada. */
  anulado?: boolean
  createdAt: string
  updatedAt?: string
}

export interface SatImportJob {
  id: string
  status: SatImportJobStatus
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

const DTE_SAT = '/compras/dte-sat'

export const startSatDteImport = (dto: { fechaInicio: string; fechaFin: string }) =>
  api.post(`${DTE_SAT}/importar`, dto).then(unwrap) as Promise<SatImportJob>

export const syncSatDteJob = (id: string) =>
  api.post(`${DTE_SAT}/jobs/${id}/sincronizar`).then(unwrap) as Promise<SatImportJob>

export const getSatDteDocuments = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(`${DTE_SAT}/documentos`, { params }).then(unwrap) as Promise<{ data: SatDte[]; total: number }>

export const getSatDteJobs = (params?: { page?: number; limit?: number }) =>
  api.get(`${DTE_SAT}/jobs`, { params }).then(unwrap) as Promise<{ data: SatImportJob[]; total: number }>

export const getSatDteStats = () =>
  api.get(`${DTE_SAT}/stats`).then(unwrap) as Promise<Record<SatDteStatus, { count: number; total: number }>>

export const resolveSatDteVendor = (id: string) =>
  api.post(`${DTE_SAT}/documentos/${id}/resolver-proveedor`).then(unwrap)

export const createSatDteVendor = (id: string, dto?: {
  name?: string
  legalName?: string
  currency?: string
  paymentTerms?: string
  paymentTermsDays?: number
  payableAccountId?: string
  expenseAccountId?: string
  defaultPurchaseTaxId?: string
}) => api.post(`${DTE_SAT}/documentos/${id}/crear-proveedor`, dto ?? {}).then(unwrap)

export const deleteSatDte = (id: string) =>
  api.post(`${DTE_SAT}/documentos/${id}/eliminar`).then(unwrap) as Promise<{ deleted: boolean; id: string }>

export const reactivateSatDte = (id: string) =>
  api.post(`${DTE_SAT}/documentos/${id}/reactivar`).then(unwrap)

export const resubirR2SatDte = (id: string) =>
  api.post(`${DTE_SAT}/documentos/${id}/re-subir-r2`).then(unwrap)

// ─── Bill Attachments & Email ─────────────────────────────────────────────────
type AttachmentMeta = { name: string; size: number; at: string; by: string; key: string; contentType: string }

export const attachBillFile = async (id: string, file: File, bill: PurchaseInvoice): Promise<{ attached: boolean; name: string }> => {
  const empresaId     = sessionStorage.getItem('activeCompanyId') ?? 'default'
  const activeCompany = useCompanyStore.getState().activeCompany
  const empresaNombre = activeCompany?.legalName ?? activeCompany?.tradeName ?? undefined
  const ext           = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType   = file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream')
  const uuid          = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const { uploadUrl, key } = await requestUploadUrl({ fileName: file.name, contentType, docType: 'fel-pdf', empresaId, empresaNombre, uuid })
  await uploadToR2(uploadUrl, file, contentType)

  const existing: AttachmentMeta[] = (bill.customFields?.attachments as AttachmentMeta[]) ?? bill.attachments ?? []
  const updated = [...existing, { name: file.name, size: file.size, at: new Date().toISOString(), by: '', key, contentType }]
  await updateBill(id, { customFields: { ...(bill.customFields ?? {}), attachments: updated } } as any)
  return { attached: true, name: file.name }
}

export const removeBillAttachment = async (id: string, key: string, bill: PurchaseInvoice): Promise<void> => {
  const list: AttachmentMeta[] = (bill.customFields?.attachments as AttachmentMeta[]) ?? bill.attachments ?? []
  const updated = list.filter(a => a.key !== key)
  await updateBill(id, { customFields: { ...(bill.customFields ?? {}), attachments: updated } } as any)
  try { await deleteDocument(key) } catch { /* ignore */ }
}

export const sendBill = (id: string, dto: { to: string; subject?: string; message?: string }) =>
  api.post(`${BILL}/${id}/enviar`, dto).then(unwrap)

// ─── PO Attachments ───────────────────────────────────────────────────────────
export const attachPoFile = async (id: string, file: File, po: PurchaseOrder): Promise<{ attached: boolean; name: string }> => {
  const empresaId     = sessionStorage.getItem('activeCompanyId') ?? 'default'
  const activeCompany = useCompanyStore.getState().activeCompany
  const empresaNombre = activeCompany?.legalName ?? activeCompany?.tradeName ?? undefined
  const ext           = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType   = file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream')
  const uuid          = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const { uploadUrl, key } = await requestUploadUrl({ fileName: file.name, contentType, docType: 'fel-pdf', empresaId, empresaNombre, uuid })
  await uploadToR2(uploadUrl, file, contentType)

  const existing: AttachmentMeta[] = (po.customFields?.attachments as AttachmentMeta[]) ?? []
  const updated = [...existing, { name: file.name, size: file.size, at: new Date().toISOString(), by: '', key, contentType }]
  await updatePurchaseOrder(id, { customFields: { ...(po.customFields ?? {}), attachments: updated } } as any)
  return { attached: true, name: file.name }
}

export const removePoAttachment = async (id: string, key: string, po: PurchaseOrder): Promise<void> => {
  const list: AttachmentMeta[] = (po.customFields?.attachments as AttachmentMeta[]) ?? []
  const updated = list.filter(a => a.key !== key)
  await updatePurchaseOrder(id, { customFields: { ...(po.customFields ?? {}), attachments: updated } } as any)
  try { await deleteDocument(key) } catch { /* ignore */ }
}

// ─── DTE SAT ─────────────────────────────────────────────────────────────────
export const postSatDte = (id: string, dto: {
  taxId?: string
  invoiceType?: string
  accountId?: string
  paymentTerms: string
  paymentTermsDays?: number
  accountingDate?: string
  notes?: string
  purchaseOrderId?: string
  isExpenseReimbursement?: boolean
  employeeId?: string
  idpAccountId?: string
  idpType?: string
  defaultUnit?: string
  originalInvoiceId?: string
  creditNoteReason?: string
  timbrePrensaAmount?: number
  timbrePrensaAccountId?: string
  turismoAmount?: number
  turismoAccountId?: string
  forceZeroAmount?: boolean
  lineAccounts?: Array<{ index: number; accountId: string }>
}) => api.post(`${DTE_SAT}/documentos/${id}/contabilizar`, dto).then(unwrap) as Promise<{
  invoice: PurchaseInvoice
  dte: SatDte
}>
