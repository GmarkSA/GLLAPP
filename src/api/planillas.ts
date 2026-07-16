import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/planillas/configuracion'

// ─── Parámetros fiscales ──────────────────────────────────────────────────────

export interface ParametroFiscalAnual {
  id: string
  companyId: string
  anio: number
  deduccionISRFija: number
  deduccionISRExtraordinaria: number
  usaDeduccionDinamica: boolean
  tramoISRUnoLimite: number
  tramoISRUnoTasa: number
  tramoISRDosMontoFijo: number
  tramoISRDosTasaExcedente: number
  tasaIGSSLaboral: number
  tasaIGSSPatronal: number
  tasaINTECAP: number
  tasaIRTRA: number
  montoBonificacionIncentivo: number
  aguinaldoPeriodoInicio: string
  aguinaldoPeriodoFin: string
  bono14PeriodoInicio: string
  bono14PeriodoFin: string
  horasSemanalesDiurna: number
  limiteHorasExtraDia: number
}

export const getParametrosFiscales = () =>
  api.get(`${BASE}/parametros-fiscales`).then(unwrap) as Promise<ParametroFiscalAnual[]>

export const getParametroFiscal = (anio: number) =>
  api.get(`${BASE}/parametros-fiscales/${anio}`).then(unwrap) as Promise<ParametroFiscalAnual | null>

export const guardarParametroFiscal = (anio: number, dto: Partial<ParametroFiscalAnual>) =>
  api.put(`${BASE}/parametros-fiscales/${anio}`, dto).then(unwrap) as Promise<ParametroFiscalAnual>

// ─── Salarios mínimos ─────────────────────────────────────────────────────────

export interface SalarioMinimoVigente {
  id: string
  anio: number
  circunscripcionEconomica: 'CE1' | 'CE2'
  tipoActividadEconomica: 'AGRICOLA' | 'NO_AGRICOLA' | 'EXPORTACION_MAQUILA'
  montoDiario: number
  montoMensual: number
  fechaVigenciaDesde: string | null
  fechaVigenciaHasta: string | null
}

export const getSalariosMinimos = (anio?: number) =>
  api.get(`${BASE}/salarios-minimos`, { params: anio ? { anio } : {} })
    .then(unwrap) as Promise<SalarioMinimoVigente[]>

export const seedSalariosMinimos2026 = () =>
  api.post(`${BASE}/salarios-minimos/seed-2026`).then(unwrap) as Promise<{ creados: number; total: number }>

export const guardarSalarioMinimo = (dto: Partial<SalarioMinimoVigente>) =>
  api.put(`${BASE}/salarios-minimos`, dto).then(unwrap) as Promise<SalarioMinimoVigente>

// ─── Patrono ──────────────────────────────────────────────────────────────────

export interface ConfiguracionPatrono {
  id?: string
  razonSocial: string
  nombreComercial?: string | null
  nit: string
  numeroPatronalIGSS?: string | null
  direccionFiscal?: string | null
  departamento?: string | null
  municipio?: string | null
  representanteLegalNombre?: string | null
  representanteLegalDPI?: string | null
  actividadEconomica?: string | null
  codigoActividadEconomicaIGSS?: string | null
  tipoPlanillaNombreIGSS?: string
  regimenFiscal?: string | null
  telefono?: string | null
  email?: string | null
}

export const getPatrono = () =>
  api.get(`${BASE}/patrono`).then(unwrap) as Promise<ConfiguracionPatrono | null>

export const guardarPatrono = (dto: ConfiguracionPatrono) =>
  api.put(`${BASE}/patrono`, dto).then(unwrap) as Promise<ConfiguracionPatrono>

// ─── Cuentas contables de planilla ────────────────────────────────────────────

export interface ConceptoCuentaPlanilla {
  campo: string
  etiqueta: string
  naturaleza: 'gasto' | 'pasivo'
  obligatoria: boolean
}

export interface CuentasPlanillaData {
  configuracion: Record<string, string | null> | null
  conceptos: ConceptoCuentaPlanilla[]
}

export const getCuentasPlanilla = () =>
  api.get(`${BASE}/cuentas`).then(unwrap) as Promise<CuentasPlanillaData>

export const guardarCuentasPlanilla = (dto: Record<string, string | null>) =>
  api.put(`${BASE}/cuentas`, dto).then(unwrap)

export const validarCuentasPlanilla = () =>
  api.get(`${BASE}/cuentas/validar`).then(unwrap) as Promise<{
    completo: boolean
    faltantes: Array<{ campo: string; etiqueta: string }>
  }>
