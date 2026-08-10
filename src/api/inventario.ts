import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Types ───────────────────────────────────────────────────────────────────

export type ItemType = 'bien' | 'servicio' | 'exento' | 'importado'
export type UsageType = 'purchase' | 'sale' | 'both'
export type ItemCategory = 'finished_good' | 'raw_material' | 'work_in_progress' | 'supply'

export interface Product {
  id: string
  sku: string
  name: string
  description?: string
  itemType: ItemType
  usageType: UsageType
  itemCategory?: ItemCategory
  category?: string
  brand?: string
  unit?: string
  isInventoriable: boolean
  isProduced: boolean
  trackingType: 'none' | 'lot' | 'serial'
  purchasePrice: number
  salesPrice: number
  averageCost: number
  lastCost: number
  currency: string
  salesTaxId?: string
  purchaseTaxId?: string
  inventoryAccountId?: string
  salesAccountId?: string
  purchaseAccountId?: string
  costAccountId?: string
  adjustmentAccountId?: string
  stockOnHand: number
  minimumStock?: number
  maximumStock?: number
  reorderPoint?: number
  reorderQuantity?: number
  weight?: number
  barCodes?: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ImportacionLinea {
  id: string
  importacionId: string
  productId: string
  productSku?: string
  productName?: string
  quantity: number
  unitCostFob: number
  totalFob: number
  proratedFreight: number
  proratedInsurance: number
  proratedCustomsDuty: number
  proratedIva: number
  proratedOther: number
  totalLandedCost: number
  landedCostPerUnit: number
  weight?: number
  volume?: number
}

export interface Importacion {
  id: string
  date: string
  supplierId?: string
  supplierName?: string
  invoiceNumber?: string
  currency: string
  exchangeRate: number
  prorationMethod: 'by_value' | 'by_quantity' | 'by_weight' | 'by_volume'
  status: 'draft' | 'confirmed' | 'posted'
  totalFob: number
  freight: number
  insurance: number
  customsDuty: number
  ivaImport: number
  otherCharges: number
  totalLandedCost: number
  notes?: string
  lineas?: ImportacionLinea[]
  createdAt: string
}

// ─── Products ─────────────────────────────────────────────────────────────────
const BASE = '/inventario/articulos'

export const getProducts = (params?: { page?: number; limit?: number; search?: string; itemType?: string; usageType?: string; lowStock?: boolean }) =>
  api.get(BASE, { params }).then(unwrap) as Promise<{ data: Product[]; total: number; page: number; limit: number }>

export const getProduct = (id: string) => api.get(`${BASE}/${id}`).then(unwrap) as Promise<Product>
export const createProduct = (dto: Partial<Product>) => api.post(BASE, dto).then(unwrap) as Promise<Product>
export const updateProduct = (id: string, dto: Partial<Product>) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<Product>
export const deleteProduct = (id: string) => api.delete(`${BASE}/${id}`)
export const getProductStock = (id: string) => api.get(`${BASE}/${id}/stock`).then(unwrap)

// ─── Importaciones ────────────────────────────────────────────────────────────
const IMP = '/inventario/importaciones'

export const getImportaciones = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(IMP, { params }).then(unwrap) as Promise<{ data: Importacion[]; total: number }>

export const getImportacion = (id: string) => api.get(`${IMP}/${id}`).then(unwrap) as Promise<Importacion>
export const createImportacion = (dto: Partial<Importacion>) => api.post(IMP, dto).then(unwrap) as Promise<Importacion>
export const addImportacionLinea = (id: string, dto: Partial<ImportacionLinea>) =>
  api.post(`${IMP}/${id}/lineas`, dto).then(unwrap) as Promise<ImportacionLinea>
export const removeImportacionLinea = (id: string, lineaId: string) => api.delete(`${IMP}/${id}/lineas/${lineaId}`)
export const recalcularProrrateo = (id: string) => api.post(`${IMP}/${id}/recalcular`).then(unwrap)
export const confirmarImportacion = (id: string) => api.post(`${IMP}/${id}/confirmar`).then(unwrap)
export const deleteImportacion = (id: string) => api.delete(`${IMP}/${id}`)

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; color: string; description: string }> = {
  bien:      { label: 'Bien',      color: '#1faec2', description: 'Producto físico con inventario' },
  servicio:  { label: 'Servicio',  color: '#2ea172', description: 'Servicio sin inventario físico' },
  exento:    { label: 'Exento',    color: '#6b7280', description: 'Bien o servicio exento de IVA' },
  importado: { label: 'Importado', color: '#6b7280', description: 'Bien importado del exterior' },
}

export const USAGE_TYPE_CONFIG: Record<UsageType, { label: string; color: string }> = {
  purchase: { label: 'Solo compra',    color: '#ff7f00' },
  sale:     { label: 'Solo venta',     color: '#1faec2'   },
  both:     { label: 'Compra y venta', color: '#2ea172'  },
}

export const ITEM_CATEGORY_CONFIG: Record<ItemCategory, { label: string; color: string }> = {
  finished_good:    { label: 'Producto terminado', color: '#1faec2' },
  raw_material:     { label: 'Materia prima',      color: '#ff7f00' },
  work_in_progress: { label: 'En proceso',         color: '#6b7280' },
  supply:           { label: 'Suministro',          color: '#2ea172' },
}

export const UNITS = ['und', 'caja', 'kg', 'g', 'lb', 'lt', 'ml', 'mt', 'cm', 'hr', 'día', 'par', 'docena', 'resma', 'rollo']

export interface SaldoInicialInventarioItem {
  sku?: string
  productId?: string
  quantity: number
  unitCost: number
  warehouseId?: string
}

export interface SaldoInicialInventarioResult {
  ajusteId: string
  created:  number
  errors:   string[]
}

export const importSaldosInicialesInventario = (dto: {
  fecha: string
  defaultWarehouseId?: string
  items: SaldoInicialInventarioItem[]
}) => api.post('/inventario/ajustes/saldos-iniciales', dto).then(unwrap) as Promise<SaldoInicialInventarioResult>
