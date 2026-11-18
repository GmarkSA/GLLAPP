import { describe, it, expect } from 'vitest'
import { esLocal, fmtMoneda, enQuetzales } from './ProveedorDetallePage'

/**
 * La ficha del proveedor en dólares.
 *
 * Formateaba todo con «Q» y sumaba sin convertir: las cinco facturas de «The
 * Conscious Home, LLC» por USD 3,264.78 salían como «Q 3,264.78» —ni dólares
 * ni quetzales—, cuando la deuda real son Q 25,036.34. El número que se ve
 * tiene que decir en qué moneda está, y el total tiene que estar convertido
 * con la tasa de CADA documento, no con la de hoy.
 */
const LLC = [
  { total: 772.50,  balance: 772.50,  currency: 'USD', exchangeRate: 7.664504854 },
  { total: 750,     balance: 750,     currency: 'USD', exchangeRate: 7.664506667 },
  { total: 280,     balance: 280,     currency: 'USD', exchangeRate: 7.6645 },
  { total: 280,     balance: 280,     currency: 'USD', exchangeRate: 7.6645 },
  { total: 1182.28, balance: 1182.28, currency: 'USD', exchangeRate: 7.675855127 },
]

describe('el monto se muestra en su moneda', () => {
  it('una factura en dólares dice USD, no Q', () => {
    expect(fmtMoneda(1182.28, 'USD')).toBe('USD 1,182.28')
  })

  it('y una en quetzales sigue diciendo Q', () => {
    expect(fmtMoneda(280, 'GTQ')).toBe('Q 280.00')
    expect(fmtMoneda(280, undefined)).toBe('Q 280.00')
  })

  it('sin moneda, se trata como local', () => {
    expect(esLocal(undefined)).toBe(true)
    expect(esLocal('gtq')).toBe(true)
    expect(esLocal('USD')).toBe(false)
  })
})

describe('el equivalente en quetzales', () => {
  it('sale de la tasa del propio documento', () => {
    expect(enQuetzales(1182.28, LLC[4])).toBeCloseTo(9075.01, 2)
    expect(enQuetzales(772.50, LLC[0])).toBeCloseTo(5920.83, 2)
  })

  it('una factura local no se convierte', () => {
    expect(enQuetzales(500, { currency: 'GTQ', exchangeRate: 7.7 })).toBe(500)
  })

  /** Sin tasa no se inventa una: queda en su número, no multiplicado por la de hoy. */
  it('sin tipo de cambio se queda como está', () => {
    expect(enQuetzales(100, { currency: 'USD', exchangeRate: null })).toBe(100)
  })

  /** El caso del encabezado: la suma de las cinco, cada una a su tasa. */
  it('el saldo del proveedor son Q 25,036.34, no Q 3,264.78', () => {
    const total = LLC.reduce((s, b) => s + enQuetzales(b.balance, b), 0)

    expect(Math.round(total * 100) / 100).toBeCloseTo(25036.34, 2)
    expect(total).not.toBeCloseTo(3264.78, 2)
  })
})
