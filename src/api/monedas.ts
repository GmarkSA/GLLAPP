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

const unwrap = (r: any) => r.data?.data ?? r.data

export const getCurrencies   = ()                              => api.get('/configuracion/monedas').then(unwrap)
export const createCurrency  = (dto: Partial<Currency>)       => api.post('/configuracion/monedas', dto).then(unwrap)
export const updateRate      = (id: string, rate: number)     => api.patch(`/configuracion/monedas/${id}/tasa`, { rate }).then(unwrap)
export const syncBanguatRate = ()                              => api.post('/configuracion/monedas/sincronizar-banguat').then(unwrap) as Promise<BanguatExchangeRateSyncResult>
export const getExchangeRateHistory = (currency = 'USD', limit = 30) =>
  api.get('/configuracion/monedas/historial', { params: { currency, limit } }).then(unwrap) as Promise<CurrencyExchangeRate[]>
export const getExchangeRateForDate = (currency = 'USD', date?: string) =>
  api.get('/configuracion/monedas/tipo-cambio', { params: { currency, date } }).then(unwrap) as Promise<ExchangeRateForDate>
export const removeCurrency  = (id: string)                   => api.delete(`/configuracion/monedas/${id}`)
