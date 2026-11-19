import { describe, it, expect } from 'vitest'
import { esLocal, fmtMoneda, enQuetzales } from './ClienteDetallePage'

/**
 * La ficha del cliente, homologada con la del proveedor.
 *
 * Formateaba todo con «Q» y sumaba sin convertir: una cartera en dólares
 * salía con el número en dólares y el signo de quetzales, y el cuadro de
 * Cuentas por Cobrar quedaba en una séptima parte de la deuda real.
 */
describe('el monto del cliente se muestra en su moneda', () => {
  it('una factura en dólares dice USD', () => {
    expect(fmtMoneda(1182.28, 'USD')).toBe('USD 1,182.28')
  })

  it('y una en quetzales sigue diciendo Q', () => {
    expect(fmtMoneda(280, 'GTQ')).toBe('Q 280.00')
    expect(esLocal(undefined)).toBe(true)
  })

  it('el equivalente sale de la tasa del propio documento', () => {
    expect(enQuetzales(1182.28, { currency: 'USD', exchangeRate: 7.675855127 })).toBeCloseTo(9075.01, 2)
  })

  it('una factura local no se convierte', () => {
    expect(enQuetzales(500, { currency: 'GTQ', exchangeRate: 7.7 })).toBe(500)
  })

  it('sin tipo de cambio se queda como está', () => {
    expect(enQuetzales(100, { currency: 'USD', exchangeRate: null })).toBe(100)
  })
})
