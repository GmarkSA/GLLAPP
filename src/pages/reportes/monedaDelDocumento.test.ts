import { describe, it, expect } from 'vitest'
import {
  formatearImporte, importeAMostrar, hayMonedaExtranjera, simboloDe, esMonedaLocal,
} from './monedaDelDocumento'

/**
 * Ver cada documento en SU moneda, para poder conciliar.
 *
 * El primer intento fue un total agregado —«USD 49,350.75»— y no servía:
 * conciliar con un cliente que factura en dólares se hace documento por
 * documento, no contra una suma. Lo que hace falta es poder cambiar la vista
 * del detalle a la moneda de cada documento.
 */
const EN_DOLARES = { currency: 'USD', original: 302.24, enQuetzales: 2314.15 }
const EN_QUETZALES = { currency: 'GTQ', original: 8940, enQuetzales: 8940 }

describe('qué importe se muestra', () => {
  it('en la vista funcional, siempre quetzales', () => {
    expect(formatearImporte(EN_DOLARES, 'funcional')).toBe('Q 2,314.15')
  })

  /** Es el número que el cliente reconoce: el de su factura. */
  it('en la vista por documento, su propia moneda', () => {
    expect(formatearImporte(EN_DOLARES, 'documento')).toBe('USD 302.24')
  })

  /**
   * Un documento en quetzales no cambia: su moneda ya es la funcional, y
   * mostrarlo distinto solo confundiría.
   */
  it('un documento en quetzales se ve igual en las dos vistas', () => {
    expect(formatearImporte(EN_QUETZALES, 'funcional')).toBe('Q 8,940.00')
    expect(formatearImporte(EN_QUETZALES, 'documento')).toBe('Q 8,940.00')
  })

  it('el símbolo acompaña a la moneda', () => {
    expect(simboloDe('USD')).toBe('USD')
    expect(simboloDe('GTQ')).toBe('Q')
    expect(simboloDe(undefined)).toBe('Q')
  })

  it('sin equivalente, usa el importe original', () => {
    expect(importeAMostrar({ currency: 'GTQ', original: 500 }, 'funcional').valor).toBe(500)
  })

  it('un importe ausente vale cero, no NaN', () => {
    expect(formatearImporte({ currency: 'USD' }, 'documento')).toBe('USD 0.00')
    expect(formatearImporte({}, 'funcional')).toBe('Q 0.00')
  })
})

describe('cuándo tiene sentido el interruptor', () => {
  /** Un botón que no cambia nada solo estorba. */
  it('con toda la cartera en quetzales, no', () => {
    expect(hayMonedaExtranjera([
      { currency: 'GTQ' }, { currency: 'GTQ' }, {},
    ])).toBe(false)
  })

  it('con un solo documento en dólares, sí', () => {
    expect(hayMonedaExtranjera([
      { currency: 'GTQ' }, { currency: 'USD' },
    ])).toBe(true)
  })

  it('sin documentos, no', () => {
    expect(hayMonedaExtranjera([])).toBe(false)
  })

  it('GTQ y vacío cuentan como moneda local', () => {
    expect(esMonedaLocal('gtq')).toBe(true)
    expect(esMonedaLocal(undefined)).toBe(true)
    expect(esMonedaLocal('USD')).toBe(false)
  })
})

/**
 * El caso de la pantalla: diez documentos de The Concious Home LLC.
 *
 * El cliente concilia contra sus facturas en dólares; los libros llevan el
 * equivalente en quetzales. Las dos cifras tienen que poder verse, pero
 * documento por documento.
 */
describe('conciliando con un cliente en dólares', () => {
  const INV_116 = { currency: 'USD', original: 302.24, enQuetzales: 2314.15 }

  it('el contacto ve su factura', () => {
    expect(formatearImporte(INV_116, 'documento')).toBe('USD 302.24')
  })

  it('la contabilidad ve lo que está en libros', () => {
    expect(formatearImporte(INV_116, 'funcional')).toBe('Q 2,314.15')
  })
})
