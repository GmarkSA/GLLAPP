import api from './axios'

const unwrap = (r: any) => {
  const body = r.data
  if (body && typeof body === 'object' && 'success' in body) return body.data
  return body
}

export interface CentroCosto {
  id: string
  companyId: string
  codigo: string
  nombre: string
  grupo: string | null
  responsable: string | null
  area: string | null
  activo: boolean
  fechaCreacion: string
}

const BASE = '/contabilidad/centros-costo'

export const getCentrosCosto = () =>
  api.get(BASE).then(unwrap) as Promise<CentroCosto[]>

export const getCentroCosto = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<CentroCosto>

export const crearCentroCosto = (dto: {
  codigo: string; nombre: string; grupo?: string;
  responsable?: string; area?: string;
}) => api.post(BASE, dto).then(unwrap) as Promise<CentroCosto>

export const actualizarCentroCosto = (id: string, dto: Partial<{
  codigo: string; nombre: string; grupo: string;
  responsable: string; area: string; activo: boolean;
}>) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<CentroCosto>

export const eliminarCentroCosto = (id: string) =>
  api.delete(`${BASE}/${id}`).then(unwrap)
