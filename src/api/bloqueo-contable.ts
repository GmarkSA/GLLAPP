import api from './axios'

/**
 * unwrap seguro para respuestas que pueden ser null.
 * El TransformInterceptor devuelve { success, data, timestamp, path }.
 * Cuando data es null, r.data?.data ?? r.data retorna el objeto wrapper (bug).
 * Esta versión detecta la forma del wrapper explícitamente.
 */
const unwrap = (r: any) => {
  const body = r.data
  if (body && typeof body === 'object' && 'success' in body) return body.data
  return body
}

export type ModuloBloqueable =
  | 'TODOS' | 'VENTAS' | 'COMPRAS' | 'BANCOS'
  | 'CONTABILIDAD' | 'INVENTARIO' | 'PROYECTOS'
  | 'REPORTES' | 'AUTOMATIZACION' | 'CONFIGURACION'

export type EstadoBloqueo = 'BLOQUEADO' | 'DESBLOQUEADO_PARCIAL' | 'DESBLOQUEADO'

export interface BloqueoContable {
  id:                    string
  companyId:             string
  modulo:                ModuloBloqueable
  periodoInicio:         string | null
  periodoFin:            string
  motivo:                string
  estado:                EstadoBloqueo
  desbloqueoParcialDesde: string | null
  desbloqueoParcialHasta: string | null
  motivoDesbloqueo:      string | null
  bloqueadoPorUsuarioId: string
  fechaCreacion:         string
}

const BASE = '/contabilidad/bloqueos'

export const getBloqueos = (params?: { modulo?: string; estado?: string }) =>
  api.get(BASE, { params }).then(unwrap) as Promise<BloqueoContable[]>

export const getBloqueoVigente = (modulo?: ModuloBloqueable) =>
  api.get(`${BASE}/vigente`, { params: { modulo } }).then(unwrap) as Promise<BloqueoContable | null>

export const bloquear = (dto: {
  modulo: ModuloBloqueable
  periodoInicio?: string
  periodoFin: string
  motivo: string
}) => api.post(BASE, dto).then(unwrap) as Promise<BloqueoContable>

export const bloquearMasivo = (dto: {
  modulos: string[]
  meses?: string[]
  rango?: { inicio: string; fin: string }
  motivo: string
}) => api.post(`${BASE}/masivo`, dto).then(unwrap) as Promise<{
  creados: number
  duplicadosOmitidos: number
  registros: BloqueoContable[]
}>

export const desbloquear = (id: string, motivo: string) =>
  api.patch(`${BASE}/${id}/desbloquear`, { motivo }).then(unwrap)

export const desbloquearParcial = (id: string, dto: { desde: string; hasta: string; motivo: string }) =>
  api.patch(`${BASE}/${id}/desbloquear-parcial`, dto).then(unwrap)

export const eliminarBloqueo = (id: string, motivo: string) =>
  api.delete(`${BASE}/${id}`, { data: { motivo } }).then(unwrap)
