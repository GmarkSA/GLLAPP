import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpedienteStatus = 'abierto' | 'en_transito' | 'en_aduana' | 'bodega' | 'confirmado' | 'anulado'
export type DocumentType = 'factura_fob' | 'flete' | 'seguro' | 'dai' | 'agente_aduanal' | 'almacenaje' | 'iva_importacion' | 'otro'
export type ProrationMethod = 'by_value' | 'by_quantity' | 'by_weight' | 'by_volume'

export interface ExpedienteDocumento {
  id: string
  expedienteId: string
  documentType: DocumentType
  documentNumber?: string
  supplierName?: string
  description?: string
  amount: number
  currency: string
  exchangeRate: number
  amountGTQ: number
  compraId?: string
  gastoId?: string
  createdAt: string
}

export interface ExpedienteLinea {
  id: string
  expedienteId: string
  productId: string
  productSku?: string
  productName?: string
  quantity: number
  unitCostFob: number
  totalFob: number
  weight?: number
  volume?: number
  proratedFlete: number
  proratedSeguro: number
  proratedDai: number
  proratedIva: number
  proratedOtros: number
  totalLandedCost: number
  landedCostPerUnit: number
}

export interface Expediente {
  id: string
  expedienteNo: string
  status: ExpedienteStatus
  openedDate: string
  expectedDate?: string
  receivedDate?: string
  description?: string
  prorationMethod: ProrationMethod
  totalFob: number
  totalCosts: number
  totalLandedCost: number
  notes?: string
  documentos?: ExpedienteDocumento[]
  lineas?: ExpedienteLinea[]
  createdAt: string
}

export interface Almacen {
  id: string
  code: string
  name: string
  description?: string
  address?: string
  manager?: string
  centroId?: string
  branchId?: string
  isActive: boolean
  isPrimary: boolean
  createdAt: string
}

export interface Centro {
  id: string
  code: string
  name: string
  description?: string
  parentId?: string
  isActive: boolean
  glAccountId?: string
  createdAt: string
}

export interface GrupoArticulo {
  id: string
  code: string
  name: string
  description?: string
  parentId?: string
  inventoryAccountId?: string
  salesAccountId?: string
  costAccountId?: string
  purchaseAccountId?: string
  defaultTaxId?: string
  isActive: boolean
  createdAt: string
}

export interface AjusteInventario {
  id: string
  code: string
  ajusteType: 'entrada' | 'salida' | 'conteo_fisico' | 'merma' | 'devolucion'
  date: string
  reason?: string
  notes?: string
  warehouseId?: string
  centroId?: string
  status: 'draft' | 'confirmed'
  lineas?: AjusteLinea[]
  createdAt: string
}

export interface AjusteLinea {
  id: string
  ajusteId: string
  productId: string
  productSku?: string
  productName?: string
  quantity: number
  unitCost?: number
  totalCost?: number
  previousStock?: number
  newStock?: number
}

// ─── Expedientes ──────────────────────────────────────────────────────────────
const EXP = '/inventario/expedientes'

export const getExpedientes = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(EXP, { params }).then(unwrap) as Promise<{ data: Expediente[]; total: number }>

export const getExpediente = (id: string) => api.get(`${EXP}/${id}`).then(unwrap) as Promise<Expediente>
export const createExpediente = (dto: Partial<Expediente>) => api.post(EXP, dto).then(unwrap) as Promise<Expediente>
export const updateExpedienteStatus = (id: string, newStatus: string) =>
  api.post(`${EXP}/${id}/estado`, { newStatus }).then(unwrap)
export const addExpedienteDocumento = (id: string, dto: Partial<ExpedienteDocumento>) =>
  api.post(`${EXP}/${id}/documentos`, dto).then(unwrap) as Promise<ExpedienteDocumento>
export const removeExpedienteDocumento = (id: string, docId: string) =>
  api.delete(`${EXP}/${id}/documentos/${docId}`)
export const addExpedienteLinea = (id: string, dto: Partial<ExpedienteLinea>) =>
  api.post(`${EXP}/${id}/lineas`, dto).then(unwrap) as Promise<ExpedienteLinea>
export const removeExpedienteLinea = (id: string, lineaId: string) =>
  api.delete(`${EXP}/${id}/lineas/${lineaId}`)
export const recalcularExpediente = (id: string) => api.post(`${EXP}/${id}/recalcular`).then(unwrap)
export const confirmarExpediente = (id: string) => api.post(`${EXP}/${id}/confirmar`).then(unwrap)
export const deleteExpediente = (id: string) => api.delete(`${EXP}/${id}`)

// ─── Almacenes ────────────────────────────────────────────────────────────────
const ALM = '/inventario/almacenes'
export const getAlmacenes = (params?: any) => api.get(ALM, { params }).then(unwrap) as Promise<Almacen[]>
export const getAlmacen = (id: string) => api.get(`${ALM}/${id}`).then(unwrap) as Promise<Almacen>
export const createAlmacen = (dto: Partial<Almacen>) => api.post(ALM, dto).then(unwrap) as Promise<Almacen>
export const updateAlmacen = (id: string, dto: Partial<Almacen>) => api.patch(`${ALM}/${id}`, dto).then(unwrap) as Promise<Almacen>
export const deleteAlmacen = (id: string) => api.delete(`${ALM}/${id}`)

// ─── Centros ──────────────────────────────────────────────────────────────────
const CTR = '/inventario/centros'
export const getCentros = (params?: any) => api.get(CTR, { params }).then(unwrap) as Promise<Centro[]>
export const getCentro = (id: string) => api.get(`${CTR}/${id}`).then(unwrap) as Promise<Centro>
export const createCentro = (dto: Partial<Centro>) => api.post(CTR, dto).then(unwrap) as Promise<Centro>
export const updateCentro = (id: string, dto: Partial<Centro>) => api.patch(`${CTR}/${id}`, dto).then(unwrap) as Promise<Centro>
export const deleteCentro = (id: string) => api.delete(`${CTR}/${id}`)

// ─── Grupos de artículos ──────────────────────────────────────────────────────
const GRP = '/inventario/grupos'
export const getGrupos = (params?: any) => api.get(GRP, { params }).then(unwrap) as Promise<GrupoArticulo[]>
export const getGrupo = (id: string) => api.get(`${GRP}/${id}`).then(unwrap) as Promise<GrupoArticulo>
export const createGrupo = (dto: Partial<GrupoArticulo>) => api.post(GRP, dto).then(unwrap) as Promise<GrupoArticulo>
export const updateGrupo = (id: string, dto: Partial<GrupoArticulo>) => api.patch(`${GRP}/${id}`, dto).then(unwrap) as Promise<GrupoArticulo>
export const deleteGrupo = (id: string) => api.delete(`${GRP}/${id}`)

// ─── Ajustes de inventario ────────────────────────────────────────────────────
const AJ = '/inventario/ajustes'
export const getAjustes = (params?: any) => api.get(AJ, { params }).then(unwrap) as Promise<{ data: AjusteInventario[]; total: number }>
export const getAjuste = (id: string) => api.get(`${AJ}/${id}`).then(unwrap) as Promise<AjusteInventario>
export const createAjuste = (dto: any) => api.post(AJ, dto).then(unwrap) as Promise<AjusteInventario>

// ─── Ubicaciones ─────────────────────────────────────────────────────────────
export type UbicacionType = 'bodega' | 'pos' | 'transito' | 'scrap'

export interface Ubicacion {
  id: string
  code: string
  name: string
  description?: string
  almacenId?: string
  type: UbicacionType
  isActive: boolean
  isDefault: boolean
  address?: string
  manager?: string
  createdAt: string
}

export interface StockUbicacion {
  id: string
  productId: string
  ubicacionId: string
  quantity: number
  reservedQuantity: number
  updatedAt: string
}

const UBC = '/inventario/ubicaciones'
export const getUbicaciones = (params?: { almacenId?: string; type?: string; search?: string; isActive?: boolean }) =>
  api.get(UBC, { params }).then(unwrap) as Promise<Ubicacion[]>
export const getUbicacion = (id: string) => api.get(`${UBC}/${id}`).then(unwrap) as Promise<Ubicacion>
export const createUbicacion = (dto: Partial<Ubicacion>) => api.post(UBC, dto).then(unwrap) as Promise<Ubicacion>
export const updateUbicacion = (id: string, dto: Partial<Ubicacion>) => api.patch(`${UBC}/${id}`, dto).then(unwrap) as Promise<Ubicacion>
export const deleteUbicacion = (id: string) => api.delete(`${UBC}/${id}`)
export const getStockUbicacion = (id: string) => api.get(`${UBC}/${id}/stock`).then(unwrap) as Promise<StockUbicacion[]>

// ─── Movimientos de Inventario (MIGO) ─────────────────────────────────────────
export type TipoMovimiento =
  'entrada_compra' | 'entrada_produccion' | 'entrada_devolucion' |
  'salida_venta' | 'salida_produccion' | 'salida_baja' |
  'salida_devolucion_prov' | 'entrada_reversa' | 'salida_reversa' |
  'traslado' | 'ajuste'

export interface MovimientoLinea {
  id: string
  movimientoId: string
  productId: string
  productSku?: string
  productName?: string
  quantity: number
  unitCost: number
  totalCost: number
  lote?: string
  notes?: string
}

export interface Movimiento {
  id: string
  code: string
  tipoMovimiento: TipoMovimiento
  date: string
  ubicacionOrigenId?: string
  ubicacionDestinoId?: string
  reason?: string
  notes?: string
  adjustmentAccountId?: string
  status: 'draft' | 'confirmed'
  expedienteId?: string
  ordenProduccionId?: string
  compraId?: string
  ventaId?: string
  reversalOfId?: string
  reversedByMovimientoId?: string
  lineas?: MovimientoLinea[]
  createdAt: string
}

const MOV = '/inventario/movimientos'
export const getMovimientos = (params?: { page?: number; limit?: number; search?: string; tipoMovimiento?: string; status?: string; dateFrom?: string; dateTo?: string; productId?: string; almacenId?: string; sucursalId?: string }) =>
  api.get(MOV, { params }).then(unwrap) as Promise<{ data: Movimiento[]; total: number }>
export const getMovimiento = (id: string) => api.get(`${MOV}/${id}`).then(unwrap) as Promise<Movimiento>
export const createMovimiento = (dto: Partial<Movimiento>) => api.post(MOV, dto).then(unwrap) as Promise<Movimiento>
export const addMovimientoLinea = (id: string, dto: Partial<MovimientoLinea>) => api.post(`${MOV}/${id}/lineas`, dto).then(unwrap) as Promise<MovimientoLinea>
export const removeMovimientoLinea = (lineaId: string) => api.delete(`${MOV}/lineas/${lineaId}`)
export const confirmarMovimiento = (id: string) => api.post(`${MOV}/${id}/confirmar`).then(unwrap) as Promise<Movimiento>
export const reversarMovimiento = (id: string) => api.post(`${MOV}/${id}/reversar`).then(unwrap) as Promise<Movimiento>
export const deleteMovimiento = (id: string) => api.delete(`${MOV}/${id}`)

export const TIPO_MOVIMIENTO_CONFIG: Record<TipoMovimiento, {
  label: string; icon: string; color: string
  needsOrigen: boolean; needsDestino: boolean; flow: 'entrada' | 'salida' | 'traslado' | 'ajuste'
}> = {
  entrada_compra:     { label: 'Entrada por compra',          icon: '📥', color: '#2ea172', needsOrigen: false, needsDestino: true,  flow: 'entrada'  },
  entrada_produccion: { label: 'Entrada por producción',      icon: '🏭', color: '#1faec2', needsOrigen: false, needsDestino: true,  flow: 'entrada'  },
  entrada_devolucion: { label: 'Devolución de cliente',       icon: '↩️', color: '#1faec2', needsOrigen: false, needsDestino: true,  flow: 'entrada'  },
  salida_venta:       { label: 'Salida por venta',            icon: '📤', color: '#e5484d', needsOrigen: true,  needsDestino: false, flow: 'salida'   },
  salida_produccion:  { label: 'Consumo para producción',     icon: '⚙️', color: '#ff7f00', needsOrigen: true,  needsDestino: false, flow: 'salida'   },
  salida_baja:        { label: 'Baja / Merma / Scrap',        icon: '🗑️', color: '#6b7280', needsOrigen: true,  needsDestino: false, flow: 'salida'   },
  salida_devolucion_prov: { label: 'Devolución a proveedor',  icon: '↩️', color: '#e5484d', needsOrigen: true,  needsDestino: false, flow: 'salida'   },
  entrada_reversa:    { label: 'Reversa (entrada)',           icon: '⏮️', color: '#6b7280', needsOrigen: false, needsDestino: true,  flow: 'entrada'  },
  salida_reversa:     { label: 'Reversa (salida)',            icon: '⏮️', color: '#6b7280', needsOrigen: true,  needsDestino: false, flow: 'salida'   },
  traslado:           { label: 'Traslado entre ubicaciones',  icon: '🔄', color: '#6b7280', needsOrigen: true,  needsDestino: true,  flow: 'traslado' },
  ajuste:             { label: 'Ajuste de inventario',        icon: '⚖️', color: '#ff7f00', needsOrigen: false, needsDestino: false, flow: 'ajuste'   },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const EXPEDIENTE_STATUS: Record<ExpedienteStatus, { label: string; color: string }> = {
  abierto:     { label: 'Abierto',       color: '#1faec2'    },
  en_transito: { label: 'En tránsito',   color: '#ff7f00'  },
  en_aduana:   { label: 'En aduana',     color: '#6b7280'  },
  bodega:      { label: 'En bodega',     color: 'cyan'    },
  confirmado:  { label: 'Confirmado',    color: '#2ea172'   },
  anulado:     { label: 'Anulado',       color: 'default' },
}

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, { label: string; color: string; isFob: boolean }> = {
  factura_fob:    { label: 'Factura FOB (proveedor)', color: '#1faec2', isFob: true  },
  flete:          { label: 'Flete / Transporte',       color: '#ff7f00', isFob: false },
  seguro:         { label: 'Seguro',                    color: '#2ea172', isFob: false },
  dai:            { label: 'DAI (Derechos Arancelarios)', color: '#e5484d', isFob: false },
  agente_aduanal: { label: 'Agente Aduanal',           color: '#6b7280', isFob: false },
  almacenaje:     { label: 'Almacenaje / Bodegaje',    color: '#1faec2', isFob: false },
  iva_importacion:{ label: 'IVA de Importación (12%)', color: '#eb2f96', isFob: false },
  otro:           { label: 'Otro cargo',               color: '#6b7280', isFob: false },
}

export const AJUSTE_TYPE_CONFIG = {
  entrada:      { label: 'Entrada',           color: '#2ea172',   sign: +1 },
  salida:       { label: 'Salida',            color: '#e5484d',     sign: -1 },
  conteo_fisico:{ label: 'Conteo físico',     color: '#1faec2',    sign:  0 },
  merma:        { label: 'Merma / Pérdida',   color: '#ff7f00',  sign: -1 },
  devolucion:   { label: 'Devolución',        color: '#6b7280',  sign: +1 },
}

// ─── Producción ───────────────────────────────────────────────────────────────
export interface OrdenProduccionLinea {
  id?: string
  ordenId?: string
  productId: string
  productSku?: string
  productName?: string
  cantidadRequerida: number
  cantidadConsumida?: number
  unitCost?: number
}
export interface OrdenProduccion {
  id: string
  codigo: string
  productoId: string
  productoNombre?: string
  productoSku?: string
  cantidadOrdenada: number
  cantidadProducida: number
  status: 'borrador' | 'en_proceso' | 'completada' | 'cancelada'
  almacenId?: string
  fechaEstimada?: string
  fechaInicio?: string
  fechaCompletada?: string
  costoManoObra?: number
  costoIndirecto?: number
  notas?: string
  lineas?: OrdenProduccionLinea[]
  createdAt: string
}
const PROD = '/inventario/produccion'
export const getOrdenes = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(PROD, { params }).then(unwrap) as Promise<{ data: OrdenProduccion[]; total: number }>
export const getOrden = (id: string) => api.get(`${PROD}/${id}`).then(unwrap) as Promise<OrdenProduccion>
export const createOrden = (dto: any) => api.post(PROD, dto).then(unwrap) as Promise<OrdenProduccion>
export const iniciarOrden = (id: string) => api.post(`${PROD}/${id}/iniciar`).then(unwrap) as Promise<OrdenProduccion>
export const completarOrden = (id: string, dto?: any) => api.post(`${PROD}/${id}/completar`, dto ?? {}).then(unwrap) as Promise<OrdenProduccion>
export const cancelarOrden = (id: string) => api.post(`${PROD}/${id}/cancelar`).then(unwrap) as Promise<OrdenProduccion>
export const deleteOrden = (id: string) => api.delete(`${PROD}/${id}`)

// ─── POS Ventas ───────────────────────────────────────────────────────────────
export interface POSVentaItem {
  productId: string
  description: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  taxPercent?: number
  lineTotal: number
}
export const createPOSVenta = (dto: {
  customerId:       string
  customerName:     string
  customerTaxId?:   string
  items:            POSVentaItem[]
  subtotal:         number
  taxAmount:        number
  total:            number
  paymentMethod:    string
  bankAccountId?:   string   // se pasa aquí — el backend crea el movimiento bancario
  notes?:           string
  posId?:           string
  lugarExpedicion?: string
}) => api.post('/ventas/facturas/pos-venta', dto).then(unwrap)
