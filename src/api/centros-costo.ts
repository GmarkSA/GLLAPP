import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface CentroCosto {
  id: string
  companyId: string
  codigo: string
  nombre: string
  descripcion: string | null
  responsableUsuarioId: string | null
  centroCostoPadreId: string | null
  activo: boolean
  fechaCreacion: string
}

const BASE = '/contabilidad/centros-costo'

export const getCentrosCosto = () =>
  api.get(BASE).then(unwrap) as Promise<CentroCosto[]>

export const getCentroCosto = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<CentroCosto>

export const crearCentroCosto = (dto: {
  codigo: string; nombre: string; descripcion?: string;
  responsableUsuarioId?: string; centroCostoPadreId?: string;
}) => api.post(BASE, dto).then(unwrap) as Promise<CentroCosto>

export const actualizarCentroCosto = (id: string, dto: Partial<{
  codigo: string; nombre: string; descripcion: string;
  responsableUsuarioId: string; centroCostoPadreId: string; activo: boolean;
}>) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<CentroCosto>

export const eliminarCentroCosto = (id: string) =>
  api.delete(`${BASE}/${id}`).then(unwrap)
