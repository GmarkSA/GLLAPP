import api from './axios'

export interface Currency {
  id:           string
  code:         string
  name:         string
  symbol:       string
  exchangeRate: number
  isBase:       boolean
  isActive:     boolean
  updatedRateAt?: string
}

export interface BanguatExchangeRateSyncResult {
  currency?: Currency
  rate: number
  banguatRate?: number
  source: 'banguat'
  effectiveDate: string
  baseCurrencyCode?: string
  targetCurrencyCode?: string
}

export interface CurrencyExchangeRate {
  id: string
  baseCurrencyCode: string
  targetCurrencyCode: string
  effectiveDate: string
  rate: number
  officialRate?: number
  source: string
  createdAt: string
  updatedAt: string
}

export interface ExchangeRateForDate {
  rate: number
  effectiveDate: string
  requestedDate: string
  baseCurrencyCode: string
  targetCurrencyCode: string
  source: string
  officialRate?: number
}

/**
 * El tipo de cambio con el que se contabiliza: el oficial de Banguat,
 * «1 USD = X GTQ», que es por el que se multiplica para llegar a quetzales.
 *
 * La respuesta trae las dos caras porque la moneda base del historial es el
 * quetzal: `officialRate` es la de Banguat y `rate` la inversa (1 GTQ = 0.13 USD).
 * Tomar `rate` por error contabiliza los dólares en una octava parte.
 */
export const tipoDeCambioOficial = (
  r?: Pick<ExchangeRateForDate, 'rate' | 'officialRate'> | null,
): number => {
  const oficial = Number(r?.officialRate)
  if (oficial > 0) return oficial
  const inverso = Number(r?.rate)
  if (inverso > 0) return Math.round((1 / inverso) * 1_000_000) / 1_000_000
  return 1
}

const unwrap = (r: any) => r.data?.data ?? r.data

export const getCurrencies   = ()                              => api.get('/configuracion/monedas').then(unwrap)
export const createCurrency  = (dto: Partial<Currency>)       => api.post('/configuracion/monedas', dto).then(unwrap)
export const updateRate      = (id: string, rate: number)     => api.patch(`/configuracion/monedas/${id}/tasa`, { rate }).then(unwrap)
export const syncBanguatRate = ()                              => api.post('/configuracion/monedas/sincronizar-banguat').then(unwrap) as Promise<BanguatExchangeRateSyncResult>
/** Trae de Banguat el tipo de cambio oficial de todo un rango y lo registra en el historial. */
export const importarHistorialBanguat = (desde: string, hasta: string) =>
  api.post('/configuracion/monedas/importar-banguat', { desde, hasta }).then(unwrap) as
    Promise<{ desde: string; hasta: string; registrados: number; actualizados: number; respetadosManual: number }>

export const getExchangeRateHistory = (currency = 'USD', limit = 30) =>
  api.get('/configuracion/monedas/historial', { params: { currency, limit } }).then(unwrap) as Promise<CurrencyExchangeRate[]>
export const getExchangeRateForDate = (currency = 'USD', date?: string) =>
  api.get('/configuracion/monedas/tipo-cambio', { params: { currency, date } }).then(unwrap) as Promise<ExchangeRateForDate>
export const removeCurrency  = (id: string)                   => api.delete(`/configuracion/monedas/${id}`)
export const updateCurrency  = (id: string, dto: Partial<Currency>) => api.patch(`/configuracion/monedas/${id}`, dto).then(unwrap)
