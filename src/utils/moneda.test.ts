import { describe, it, expect } from 'vitest'
import { esLocal, fmtQ, fmtMoneda, enQuetzales, fmtTasa } from './moneda'

/** El caso real de LUUM: cartera en dólares que se leía como quetzales. */
const EN_DOLARES = { currency: 'USD', exchangeRate: 7.675855127 }

describe('una empresa con dos monedas', () => {
  it('lo local se muestra con una sola cifra', () => {
    expect(fmtMoneda(1234.5, 'GTQ')).toBe('Q 1,234.50')
    expect(fmtMoneda(1234.5, null)).toBe('Q 1,234.50')
    expect(fmtTasa({ currency: 'GTQ', exchangeRate: 7.7 })).toBe('—')
  })

  it('lo extranjero dice su moneda', () => {
    expect(fmtMoneda(1182.28, 'USD')).toBe('USD 1,182.28')
    expect(fmtMoneda(1182.28, 'usd')).toBe('USD 1,182.28')
  })

  it('y su equivalente sale de la tasa del documento, no de la de hoy', () => {
    expect(enQuetzales(1182.28, EN_DOLARES)).toBeCloseTo(9075.01, 2)
    expect(fmtTasa(EN_DOLARES)).toBe('7.675855')
  })

  it('un documento local no se convierte', () => {
    expect(enQuetzales(500, { currency: 'GTQ', exchangeRate: 7.7 })).toBe(500)
    expect(esLocal(undefined)).toBe(true)
  })

  /** Sin tasa no se inventa una: se deja el monto como está. */
  it('sin tipo de cambio no multiplica por nada', () => {
    expect(enQuetzales(100, { currency: 'USD', exchangeRate: null })).toBe(100)
    expect(enQuetzales(100, undefined)).toBe(100)
  })

  it('los quetzales llevan centavos, no milésimas', () => {
    expect(fmtQ(40866.2956)).toBe('Q 40,866.30')
    expect(fmtQ(871365.8423)).toBe('Q 871,365.84')
  })
})
