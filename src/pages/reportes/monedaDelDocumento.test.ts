import { describe, it, expect } from 'vitest'
import {
  formatearImporte, importeAMostrar, hayMonedaExtranjera, simboloDe, esMonedaLocal,
  formatearTotal, totalEnVista,
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

/**
 * Los totales: un tramo solo va en dólares si TODO lo que lo compone son
 * dólares.
 *
 * Los tramos de antigüedad son sumas de documentos, y esos documentos pueden
 * estar en monedas distintas. Sumar dólares con quetzales y rotular el
 * resultado «USD» daría un número que no existe y que no cuadra con nada.
 */
describe('el total de un grupo de documentos', () => {
  const SOLO_USD = [
    { currency: 'USD', balance: 301.93,  balanceGTQ: 2314.15 },
    { currency: 'USD', balance: 9064.00, balanceGTQ: 69471.12 },
  ]
  const MEZCLADO = [
    { currency: 'USD', balance: 301.93, balanceGTQ: 2314.15 },
    { currency: 'GTQ', balance: 8940,   balanceGTQ: 8940 },
  ]

  it('en la vista funcional, siempre quetzales', () => {
    expect(formatearTotal(SOLO_USD, 'funcional')).toBe('Q 71,785.27')
  })

  /** Es lo que el usuario pidió ver: el total del cliente en su moneda. */
  it('si todo es de una moneda, el total va en esa moneda', () => {
    expect(formatearTotal(SOLO_USD, 'documento')).toBe('USD 9,365.93')
  })

  /**
   * Con monedas mezcladas el único denominador común es el quetzal. Sumar
   * dólares con quetzales sería inventar una cifra.
   */
  it('con monedas mezcladas se queda en quetzales y lo declara', () => {
    const t = totalEnVista(MEZCLADO, 'documento')

    expect(t.simbolo).toBe('Q')
    expect(t.mixto).toBe(true)
    expect(t.valor).toBeCloseTo(11254.15, 2)
  })

  it('un grupo solo de quetzales no es mezcla', () => {
    const t = totalEnVista([{ currency: 'GTQ', balance: 100, balanceGTQ: 100 }], 'documento')
    expect(t.simbolo).toBe('Q')
    expect(t.mixto).toBe(false)
  })

  it('un grupo vacío vale cero en quetzales', () => {
    expect(formatearTotal([], 'documento')).toBe('Q 0.00')
  })

  /** La suma en divisa usa los importes originales, no los convertidos. */
  it('no reconvierte: suma los importes originales', () => {
    expect(totalEnVista(SOLO_USD, 'documento').valor).toBeCloseTo(9365.93, 2)
  })
})

/**
 * La pantalla completa de The Concious Home LLC.
 *
 * Seis facturas, todas en dólares: tanto el detalle como el total del cliente
 * tienen que poder verse en USD.
 */
describe('el total de un cliente que factura solo en dólares', () => {
  const SUS_FACTURAS = [
    { currency: 'USD', balance: 301.93,  balanceGTQ: 2314.15 },
    { currency: 'USD', balance: 9064.00, balanceGTQ: 69471.12 },
    { currency: 'USD', balance: 872.32,  balanceGTQ: 6685.91 },
    { currency: 'USD', balance: 9003.00, balanceGTQ: 69003.58 },
    { currency: 'USD', balance: 9654.00, balanceGTQ: 74001.87 },
    { currency: 'USD', balance: 9276.00, balanceGTQ: 71095.99 },
  ]

  it('en quetzales cuadra con lo que está en libros', () => {
    expect(formatearTotal(SUS_FACTURAS, 'funcional')).toBe('Q 292,572.62')
  })

  it('en su moneda, el total es el que el cliente reconoce', () => {
    expect(formatearTotal(SUS_FACTURAS, 'documento')).toBe('USD 38,171.25')
  })
})

/**
 * Los tramos vacíos.
 *
 * Un tramo sin documentos no tiene moneda propia. En la pantalla quedaban
 * «Q 0.00» al lado de tramos en USD: tres tarjetas en dólares y dos en
 * quetzales, lo que hace dudar de todo el reporte.
 */
describe('un grupo sin documentos', () => {
  it('hereda la moneda del reporte', () => {
    expect(formatearTotal([], 'documento', 'USD')).toBe('USD 0.00')
  })

  it('sin moneda del reporte, se queda en quetzales', () => {
    expect(formatearTotal([], 'documento')).toBe('Q 0.00')
  })

  /** En la vista funcional todo es quetzales, aunque se pase otra moneda. */
  it('en la vista funcional no hereda nada', () => {
    expect(formatearTotal([], 'funcional', 'USD')).toBe('Q 0.00')
  })

  it('un grupo con documentos no hereda: manda su propia moneda', () => {
    expect(formatearTotal(
      [{ currency: 'GTQ', balance: 100, balanceGTQ: 100 }], 'documento', 'USD'))
      .toBe('Q 100.00')
  })
})
