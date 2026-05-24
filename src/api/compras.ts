import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Types ────────────────────────────────────────────────────────────────────
export type BillStatus = 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'voided'
export type POStatus   = 'draft' | 'sent' | 'received' | 'billed' | 'cancelled'

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
}

export interface PurchaseInvoice {
  id:                  string
  invoiceNumber:       string
  vendorInvoiceNumber?: string
  status:              BillStatus
  vendorId:            string
  vendorName:          string
  vendorTaxId?:        string
  invoiceDate:         string
  dueDate?:            string
  currency:            string
  exchangeRate:        number
  subtotal:            number
  taxAmount:           number
  retentionAmount:     number
  total:               number
  paidAmount:          number
  balance:             number
  purchaseOrderId?:    string
  notes?:              string
  items:               BillItem[]
  createdAt:           string
}

export interface PurchaseOrder {
  id:                   string
  orderNumber:          string
  status:               POStatus
  vendorId:             string
  vendorName:           string
  orderDate:            string
  expectedDeliveryDate?: string
  currency:             string
  total:                number
  notes?:               string
  items:                BillItem[]
  createdAt:            string
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
}

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

export const recordBillPayment = (id: string, dto: { amount: number; paymentDate: string; mode?: string; reference?: string; bankAccountId?: string }) =>
  api.post(`${BILL}/${id}/registrar-pago`, dto).then(unwrap)

export const voidBill = (id: string, reason?: string) =>
  api.post(`${BILL}/${id}/anular`, { reason }).then(unwrap)

export const deleteBill = (id: string) =>
  api.delete(`${BILL}/${id}`)

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
export const getVendors = (params?: { search?: string; isActive?: boolean; limit?: number; page?: number }) =>
  api.get(PROV, { params }).then(unwrap)

// ─── Status helpers ───────────────────────────────────────────────────────────
export const BILL_STATUS_CONFIG: Record<BillStatus, { label: string; color: string }> = {
  draft:    { label: 'Borrador',     color: 'default' },
  open:     { label: 'Pendiente',    color: 'orange'  },
  partial:  { label: 'Pago parcial', color: 'geekblue'},
  paid:     { label: 'Pagada',       color: 'green'   },
  overdue:  { label: 'Vencida',      color: 'red'     },
  voided:   { label: 'Anulada',      color: 'volcano' },
}

export const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string }> = {
  draft:     { label: 'Borrador',   color: 'default' },
  sent:      { label: 'Enviada',    color: 'blue'    },
  received:  { label: 'Recibida',   color: 'cyan'    },
  billed:    { label: 'Facturada',  color: 'green'   },
  cancelled: { label: 'Cancelada',  color: 'volcano' },
}
