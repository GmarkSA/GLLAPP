import api from './axios'

const unwrap = (r: any) => {
  const body = r.data
  if (body && typeof body === 'object' && 'success' in body) return body.data
  return body
}

export interface CentroBeneficio {
  id: string
  companyId: string
  codigo: string
  nombre: string
  grupo: string | null
  responsable: string | null
  activo: boolean
  fechaCreacion: string
}

const BASE = '/contabilidad/centros-beneficio'

export const getCentrosBeneficio = () =>
  api.get(BASE).then(unwrap) as Promise<CentroBeneficio[]>

export const getCentroBeneficio = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<CentroBeneficio>

export const crearCentroBeneficio = (dto: {
  codigo: string; nombre: string; grupo?: string; responsable?: string;
}) => api.post(BASE, dto).then(unwrap) as Promise<CentroBeneficio>

export const actualizarCentroBeneficio = (id: string, dto: Partial<{
  codigo: string; nombre: string; grupo: string; responsable: string; activo: boolean;
}>) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<CentroBeneficio>

export const eliminarCentroBeneficio = (id: string) =>
  api.delete(`${BASE}/${id}`).then(unwrap)
