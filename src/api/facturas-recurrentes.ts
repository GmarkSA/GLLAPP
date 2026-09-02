import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type FrecuenciaRecurrencia = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
export type EstadoFacturaRecurrente = 'activa' | 'pausada' | 'finalizada' | 'cancelada'
export type TipoVigencia = 'indefinida' | 'por_fecha_fin' | 'por_numero_ocurrencias'

export const FRECUENCIA_LABELS: Record<FrecuenciaRecurrencia, string> = {
  diaria:      'Diaria',
  semanal:     'Semanal',
  quincenal:   'Quincenal',
  mensual:     'Mensual',
  bimestral:   'Bimestral',
  trimestral:  'Trimestral',
  semestral:   'Semestral',
  anual:       'Anual',
}

export const ESTADO_CONFIG: Record<EstadoFacturaRecurrente, { label: string; color: string }> = {
  activa:     { label: 'Activa',     color: 'success' },
  pausada:    { label: 'Pausada',    color: 'warning' },
  finalizada: { label: 'Finalizada', color: 'default' },
  cancelada:  { label: 'Cancelada',  color: 'error'   },
}

export interface DetalleFacturaRecurrenteDto {
  itemId?:              string
  descripcion:          string
  unidad?:              string
  cantidad:             number
  precioUnitario:       number
  descuentoPorcentaje?: number
  descuentoValor?: number // descuento en Q exacto — prioridad sobre el %
  impuestoPorcentaje?:  number
  impuestoId?:          string
  cuentaContableId?:    string
  orden?:               number
}

export interface CrearFacturaRecurrenteDto {
  clienteId:                   string
  frecuencia:                  FrecuenciaRecurrencia
  tipoVigencia:                TipoVigencia
  fechaInicio:                 string
  fechaFin?:                   string
  numeroMaximoOcurrencias?:    number
  diasAnticipacionGeneracion?: number
  moneda?:                     string
  tipoCambioReferencia?:       number
  condicionPago?:              string
  proyectoId?:                 string
  cuentaContableIngresoId?:    string
  centroCostoId?:              string
  generarFEL?:                 boolean
  felTipoDocumento?:           string
  facturaExenta?:              boolean
  felFrases?:                  Array<{ tipoFrase: number; codigoEscenario: number }>
  incoterm?:                   string
  lugarExpedicion?:            string
  nombreConsignatario?:        string
  direccionConsignatario?:     string
  notificarClientePorEmail?:   boolean
  emailNotificacion?:          string
  emailAdicionalNotificacion?: string
  observaciones?:              string
  detalles:                    DetalleFacturaRecurrenteDto[]
}

export interface FacturaRecurrente {
  id:                          string
  companyId:                   string
  clienteId:                   string
  clienteNombre:               string
  clienteNit:                  string
  codigoPlantilla:             string
  frecuencia:                  FrecuenciaRecurrencia
  tipoVigencia:                TipoVigencia
  fechaInicio:                 string
  fechaFin:                    string | null
  numeroMaximoOcurrencias:     number | null
  ocurrenciasGeneradas:        number
  diasAnticipacionGeneracion:  number
  fechaProximaGeneracion:      string
  fechaUltimaGeneracion:       string | null
  moneda:                      string
  tipoCambioReferencia:        number | null
  condicionPago:               string | null
  generarFEL:                  boolean
  felTipoDocumento:            string
  facturaExenta:               boolean
  felFrases:                   Array<{ tipoFrase: number; codigoEscenario: number }>
  incoterm:                    string | null
  lugarExpedicion:             string | null
  nombreConsignatario:         string | null
  direccionConsignatario:      string | null
  notificarClientePorEmail:    boolean
  emailNotificacion:           string | null
  emailAdicionalNotificacion:  string | null
  estado:                      EstadoFacturaRecurrente
  observaciones:               string | null
  detalles:                    Array<DetalleFacturaRecurrenteDto & { id: string }>
  fechaCreacion:               string
  fechaModificacion:           string
}

// Suscripciones para enlazar la plantilla (solo SuperAdmin). El value del enlace
// es el id interno de la suscripción; idSuscripcionQpaypro es solo informativo.
export interface QpayproSubscriptionOption {
  id:                   string
  tenantName:           string
  plan:                 string
  status:               string
  idSuscripcionQpaypro: number | null
}
export const listQpayproSubscriptions = () =>
  api.get('/admin/subscriptions').then(unwrap) as Promise<QpayproSubscriptionOption[]>

export interface HistorialGeneracion {
  id:                  string
  facturaRecurrenteId: string
  facturaGeneradaId:   string | null
  numeroFactura:       string | null
  felUuid:             string | null
  felSerie:            string | null
  felNumero:           string | null
  estadoGeneracion:    'EXITOSA' | 'FALLIDA'
  mensajeError:        string | null
  fechaGeneracion:     string
  facturaExiste:       boolean | null
}

const BASE = '/ventas/facturas-recurrentes'

export const getFacturasRecurrentes = (params?: {
  estado?:    EstadoFacturaRecurrente
  clienteId?: string
  frecuencia?: FrecuenciaRecurrencia
  page?:      number
  limit?:     number
}) => api.get(BASE, { params }).then(unwrap)

export const getFacturaRecurrente = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<FacturaRecurrente>

export const createFacturaRecurrente = (dto: CrearFacturaRecurrenteDto) =>
  api.post(BASE, dto).then(unwrap) as Promise<FacturaRecurrente>

export const updateFacturaRecurrente = (id: string, dto: Partial<CrearFacturaRecurrenteDto>) =>
  api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<FacturaRecurrente>

export const pausarFacturaRecurrente  = (id: string) => api.patch(`${BASE}/${id}/pausar`).then(unwrap)
export const reanudarFacturaRecurrente = (id: string) => api.patch(`${BASE}/${id}/reanudar`).then(unwrap)
export const cancelarFacturaRecurrente = (id: string) => api.patch(`${BASE}/${id}/cancelar`).then(unwrap)

export const getHistorialFacturaRecurrente = (id: string) =>
  api.get(`${BASE}/${id}/historial`).then(unwrap) as Promise<HistorialGeneracion[]>

export const eliminarHistorialFacturaRecurrente = (id: string, historialId: string) =>
  api.delete(`${BASE}/${id}/historial/${historialId}`).then(unwrap)

export const generarAhoraFacturaRecurrente = (id: string) =>
  api.post(`${BASE}/${id}/generar-ahora`).then(unwrap) as Promise<{ facturaId: string; invoiceNumber: string }>
