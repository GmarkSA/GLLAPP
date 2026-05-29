import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Types ────────────────────────────────────────────────────────────────────
export type BillStatus   = 'draft' | 'pending_approval' | 'open' | 'partial' | 'paid' | 'overdue' | 'voided'
export type BillType     = 'goods' | 'services' | 'reimbursement' | 'special' | 'fuel'
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
  discountPercent: number
  taxPercent:      number
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
  journalEntryId?:         string
  reclassificationJournalEntryId?: string

  purchaseOrderId?:        string
  notes?:                  string
  items:                   BillItem[]
  attachments?:            any[]
  createdAt:               string
  updatedAt?:              string
}

export interface PurchaseOrder {
  id:                    string
  orderNumber:           string
  status:                POStatus
  vendorId:              string
  vendorName:            string
  orderDate:             string
  expectedDeliveryDate?: string
  currency:              string
  paymentTerms?:         string
  paymentTermsDays?:     number
  total:                 number
  notes?:                string
  items:                 BillItem[]
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
  // Impuestos
  idp:                  number
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
    idp: number; iva: number; total: number; retencionIsr: number; retencionIva: number
  }
  resumenCategoria:   LibroComprasResumenCategoria[]
  count:              number
}

// ─── Journal Entry ───────────────────────────────────────────────────────────
export interface JournalEntryLine {
  id:           string
  accountId:    string
  accountCode:  string
  accountName:  string
  description?: string
  debit:        number
  credit:       number
  sortOrder:    number
}

export interface JournalEntry {
  id:           string
  entryNumber:  string
  type:         string
  status:       string
  entryDate:    string
  description:  string
  reference?:   string
  totalDebit:   number
  totalCredit:  number
  currency:     string
  lines:        JournalEntryLine[]
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
}) => api.post(`${BILL}/${id}/registrar-pago`, dto).then(unwrap)

export const voidBill = (id: string, reason?: string) =>
  api.post(`${BILL}/${id}/anular`, { reason }).then(unwrap)

export const deleteBill = (id: string) =>
  api.delete(`${BILL}/${id}`)

export const getApAging = () =>
  api.get(`${BILL}/reportes/ap-aging`).then(unwrap) as Promise<ApAgingReport>

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

export const sendPurchaseOrder = (id: string, dto: { to: string }) =>
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
  pending_approval: { label: 'Pendiente aprobación', color: 'purple' },
  open:             { label: 'Pendiente',          color: 'orange'  },
  partial:          { label: 'Pago parcial',       color: 'geekblue'},
  paid:             { label: 'Pagada',             color: 'green'   },
  overdue:          { label: 'Vencida',            color: 'red'     },
  voided:           { label: 'Anulada',            color: 'volcano' },
}

export const BILL_TYPE_CONFIG: Record<BillType, { label: string }> = {
  goods:         { label: 'Compra de bienes'          },
  services:      { label: 'Servicios'                 },
  reimbursement: { label: 'Reembolso de gastos'       },
  special:       { label: 'Factura Especial (SAT)'    },
  fuel:          { label: 'Combustible (con IDP)'     },
}

export const PAYMENT_TERMS_CONFIG: Record<PaymentTerms, string> = {
  immediate: 'Contado',
  net_15:    'Neto 15 días',
  net_30:    'Neto 30 días',
  net_60:    'Neto 60 días',
  net_90:    'Neto 90 días',
  custom:    'Personalizado',
}

export const IDP_RATES: Record<string, number> = {
  super:   4.70,
  regular: 4.60,
  diesel:  1.30,
  other:   0,
}

export const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string }> = {
  draft:     { label: 'Borrador',   color: 'default' },
  sent:      { label: 'Enviada',    color: 'blue'    },
  received:  { label: 'Recibida',   color: 'cyan'    },
  billed:    { label: 'Facturada',  color: 'green'   },
  cancelled: { label: 'Cancelada',  color: 'volcano' },
}
