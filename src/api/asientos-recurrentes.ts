import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type FrecuenciaAsiento = 'SEMANAL' | 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export interface LineaPlantilla {
  accountId?:         string
  accountCode:        string
  accountName:        string
  debit:              number
  credit:             number
  description?:       string
  centroCostoId?:     string
  centroBeneficioId?: string
}

export interface AsientoRecurrente {
  id:               string
  companyId:        string
  nombre:           string
  descripcion:      string | null
  referencia:       string | null
  frecuencia:       FrecuenciaAsiento
  diaEjecucion:     number
  fechaInicio:      string | null
  fechaFin:         string | null
  nuncaVence:       boolean
  activo:           boolean
  autoPublicar:     boolean
  lineas:           LineaPlantilla[]
  proximaEjecucion: string | null
  createdById:      string | null
  createdAt:        string
  updatedAt:        string
}

export interface HistorialAsientoRecurrente {
  id:                         string
  asientoRecurrenteId:        string
  companyId:                  string
  periodo:                    string
  asientoGeneradoId:          string | null
  asientoGeneradoEntryNumber: string | null
  totalDebit:                 number | null
  asientoStatus:              string | null
  estado:                     string
  errorMsg:                   string | null
  fechaGeneracion:            string
}

export interface CreateAsientoRecurrenteDto {
  nombre:        string
  descripcion?:  string
  referencia?:   string
  frecuencia:    FrecuenciaAsiento
  fechaInicio:   string
  fechaFin?:     string | null
  nuncaVence?:   boolean
  autoPublicar?: boolean
  lineas:        LineaPlantilla[]
}

export const getAsientosRecurrentes = () =>
  api.get('/contabilidad/asientos-recurrentes').then(unwrap) as Promise<AsientoRecurrente[]>

export const getAsientoRecurrente = (id: string) =>
  api.get(`/contabilidad/asientos-recurrentes/${id}`).then(unwrap) as Promise<AsientoRecurrente>

export const createAsientoRecurrente = (dto: CreateAsientoRecurrenteDto) =>
  api.post('/contabilidad/asientos-recurrentes', dto).then(unwrap) as Promise<AsientoRecurrente>

export const updateAsientoRecurrente = (id: string, dto: Partial<CreateAsientoRecurrenteDto> & { activo?: boolean }) =>
  api.patch(`/contabilidad/asientos-recurrentes/${id}`, dto).then(unwrap) as Promise<AsientoRecurrente>

export const generarAsientoRecurrente = (id: string) =>
  api.post(`/contabilidad/asientos-recurrentes/${id}/generar`).then(unwrap)

export const getHistorialAsientoRecurrente = (id: string) =>
  api.get(`/contabilidad/asientos-recurrentes/${id}/historial`).then(unwrap) as Promise<HistorialAsientoRecurrente[]>

export const deleteAsientoRecurrente = (id: string) =>
  api.delete(`/contabilidad/asientos-recurrentes/${id}`)
