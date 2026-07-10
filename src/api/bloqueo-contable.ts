import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type ModuloBloqueable = 'TODOS' | 'VENTAS' | 'COMPRAS' | 'BANCOS' | 'CONTABILIDAD' | 'INVENTARIO'
export type EstadoBloqueo = 'BLOQUEADO' | 'DESBLOQUEADO_PARCIAL' | 'DESBLOQUEADO'

export interface BloqueoContable {
  id: string
  companyId: string
  modulo: ModuloBloqueable
  fechaBloqueo: string
  motivo: string
  estado: EstadoBloqueo
  desbloqueoParcialDesde: string | null
  desbloqueoParcialHasta: string | null
  motivoDesbloqueo: string | null
  bloqueadoPorUsuarioId: string
  fechaCreacion: string
}

const BASE = '/contabilidad/bloqueos'

export const getBloqueos = () =>
  api.get(BASE).then(unwrap) as Promise<BloqueoContable[]>

export const getBloqueoVigente = (modulo?: ModuloBloqueable) =>
  api.get(`${BASE}/vigente`, { params: { modulo } }).then(unwrap) as Promise<BloqueoContable | null>

export const bloquear = (dto: { modulo: ModuloBloqueable; fechaBloqueo: string; motivo: string }) =>
  api.post(BASE, dto).then(unwrap) as Promise<BloqueoContable>

export const desbloquear = (id: string, motivo: string) =>
  api.patch(`${BASE}/${id}/desbloquear`, { motivo }).then(unwrap)

export const desbloquearParcial = (id: string, dto: { desde: string; hasta: string; motivo: string }) =>
  api.patch(`${BASE}/${id}/desbloquear-parcial`, dto).then(unwrap)
