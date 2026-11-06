import { describe, it, expect } from 'vitest'
import { montosDeLinea, totalDeLinea } from './montosDeLinea'
import { recalc } from './LineItemsEditor'

/**
 * El monto de una línea en las pantallas que solo muestran.
 *
 * El detalle de una cotización y su impresión leen `lineTotal` de cada línea.
 * Las cotizaciones se guardaban sin él —la pantalla mandaba solo lo que el
 * usuario escribió—, así que el detalle mostraba «Q NaN» en toda la columna y
 * el PDF la mostraba en cero. El backend ya lo guarda; esto es para las que
 * se crearon antes, que nadie va a volver a guardar solo para poder verlas.
 */
describe('el total de una línea para mostrarla', () => {
  it('usa el monto guardado cuando está', () => {
    expect(totalDeLinea({ quantity: 2, unitPrice: 15, lineTotal: 29.5 })).toBe(29.5)
  })

  /** El caso de la cotización que lo destapó. */
  it('lo calcula cuando la línea no lo trae', () => {
    expect(totalDeLinea({ quantity: 2, unitPrice: 15, taxPercent: 0 })).toBe(30)
  })

  it('un monto guardado en cero es un monto, no una ausencia', () => {
    expect(totalDeLinea({ quantity: 2, unitPrice: 15, lineTotal: 0 })).toBe(0)
  })

  it('un monto guardado como texto se entiende', () => {
    expect(totalDeLinea({ quantity: 2, unitPrice: 15, lineTotal: '30.00' })).toBe(30)
  })

  it('con un monto guardado ilegible, lo calcula', () => {
    expect(totalDeLinea({ quantity: 2, unitPrice: 15, taxPercent: 0, lineTotal: 'x' })).toBe(30)
  })

  /** Nunca NaN: es lo único que el usuario no puede interpretar. */
  it('una línea vacía da cero, no NaN', () => {
    expect(totalDeLinea({ description: 'Observación' })).toBe(0)
    expect(totalDeLinea({})).toBe(0)
    expect(totalDeLinea(null)).toBe(0)
  })
})

describe('el cálculo de la línea', () => {
  it('con IVA incluido, extrae la base del precio', () => {
    expect(montosDeLinea({ quantity: 2, unitPrice: 15, taxPercent: 12, taxInclusive: true }))
      .toEqual({ lineNet: 26.79, lineTax: 3.21, lineTotal: 30 })
  })

  it('con IVA por fuera, lo suma sobre la base', () => {
    expect(montosDeLinea({ quantity: 2, unitPrice: 15, taxPercent: 12, taxInclusive: false }))
      .toEqual({ lineNet: 30, lineTax: 3.6, lineTotal: 33.6 })
  })

  it('el descuento en quetzales manda sobre el porcentaje', () => {
    expect(montosDeLinea({ quantity: 1, unitPrice: 100, discountPercent: 50, discountAmount: 10 }).lineTotal)
      .toBe(90)
  })

  it('un descuento mayor que la línea la deja en cero', () => {
    expect(montosDeLinea({ quantity: 1, unitPrice: 50, discountAmount: 80 }).lineTotal).toBe(0)
  })
})

/**
 * El editor de líneas y las pantallas que muestran tienen que dar lo mismo.
 *
 * Si el formulario calculara distinto de como se muestra después, el usuario
 * vería un número al capturar y otro al imprimir. Por eso `recalc` usa esta
 * misma función, y esto lo deja fijo.
 */
describe('capturar y mostrar dan el mismo número', () => {
  const CASOS = [
    { quantity: 3,   unitPrice: 13.33, taxPercent: 12, taxInclusive: true },
    { quantity: 7,   unitPrice: 1.95,  taxPercent: 12, taxInclusive: false },
    { quantity: 1,   unitPrice: 18.5,  taxPercent: 0,  taxInclusive: true },
    { quantity: 2.5, unitPrice: 40,    taxPercent: 12, taxInclusive: true, discountPercent: 15 },
    { quantity: 1,   unitPrice: 100,   taxPercent: 12, taxInclusive: true, discountAmount: 25 },
  ]

  it.each(CASOS)('%o', (caso) => {
    const delEditor  = recalc({ _key: '1', description: '', discountPercent: 0, ...caso } as any)
    const deMostrarlo = montosDeLinea(caso)

    expect(delEditor.lineTotal).toBe(deMostrarlo.lineTotal)
    expect(delEditor.lineNet).toBe(deMostrarlo.lineNet)
    expect(delEditor.lineTax).toBe(deMostrarlo.lineTax)
  })
})
