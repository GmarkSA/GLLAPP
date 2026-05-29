import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data
const BASE = '/configuracion/unidades-medida'

export interface UnidadMedida {
  id:          string
  code:        string
  name:        string
  description?: string
  isActive:    boolean
  isSystem:    boolean
  sortOrder:   number
}

export const getUnidades       = ()                                     => api.get(BASE).then(unwrap)           as Promise<UnidadMedida[]>
export const getUnidadesActivas = ()                                    => api.get(`${BASE}/activas`).then(unwrap) as Promise<UnidadMedida[]>
export const createUnidad      = (dto: { code: string; name: string; description?: string; sortOrder?: number }) =>
  api.post(BASE, dto).then(unwrap)                                                                               as Promise<UnidadMedida>
export const updateUnidad      = (id: string, dto: Partial<Omit<UnidadMedida,'id'|'code'|'isSystem'>>) =>
  api.patch(`${BASE}/${id}`, dto).then(unwrap)                                                                   as Promise<UnidadMedida>
export const deleteUnidad      = (id: string)                           => api.delete(`${BASE}/${id}`)
