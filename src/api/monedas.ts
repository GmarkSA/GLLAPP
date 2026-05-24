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

const unwrap = (r: any) => r.data?.data ?? r.data

export const getCurrencies   = ()                              => api.get('/configuracion/monedas').then(unwrap)
export const createCurrency  = (dto: Partial<Currency>)       => api.post('/configuracion/monedas', dto).then(unwrap)
export const updateRate      = (id: string, rate: number)     => api.patch(`/configuracion/monedas/${id}/tasa`, { rate }).then(unwrap)
export const removeCurrency  = (id: string)                   => api.delete(`/configuracion/monedas/${id}`)
