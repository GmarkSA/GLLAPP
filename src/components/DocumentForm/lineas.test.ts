import { describe, it, expect } from 'vitest'
import { recalc, calcTotals, newLineItem, type LineItem } from './LineItemsEditor'

/**
 * El cálculo de las líneas de un documento.
 *
 * Es el punto donde se decide cuánto paga el cliente y cuánto IVA se declara, y
 * lo usan facturas, cotizaciones y notas de crédito. En Guatemala el precio de
 * venta normalmente YA lleva el IVA incluido, así que la base se extrae del
 * precio en lugar de sumarse.
 */
const linea = (extra: Partial<LineItem>): LineItem =>
  recalc(newLineItem({ quantity: 1, unitPrice: 0, taxPercent: 0, taxInclusive: false, ...extra }))

describe('Cálculo de una línea', () => {
  describe('con el IVA incluido en el precio, que es lo normal en Guatemala', () => {
    it('separa base e impuesto de un precio de 112 al 12 por ciento', () => {
      const l = linea({ unitPrice: 112, taxPercent: 12, taxInclusive: true })
      expect(l.lineNet).toBe(100)
      expect(l.lineTax).toBe(12)
      expect(l.lineTotal).toBe(112)
    })

    it('la base más el impuesto siempre dan el total de la línea', () => {
      for (const precio of [1, 7.5, 99.99, 1234.56, 10000]) {
        const l = linea({ unitPrice: precio, taxPercent: 12, taxInclusive: true })
        expect(Math.round((l.lineNet + l.lineTax) * 100) / 100).toBe(l.lineTotal)
      }
    })

    it('multiplica por la cantidad', () => {
      const l = linea({ quantity: 3, unitPrice: 112, taxPercent: 12, taxInclusive: true })
      expect(l.lineNet).toBe(300)
      expect(l.lineTax).toBe(36)
      expect(l.lineTotal).toBe(336)
    })
  })

  describe('con el IVA por fuera del precio', () => {
    it('suma el impuesto sobre la base', () => {
      const l = linea({ unitPrice: 100, taxPercent: 12, taxInclusive: false })
      expect(l.lineNet).toBe(100)
      expect(l.lineTax).toBe(12)
      expect(l.lineTotal).toBe(112)
    })
  })

  describe('exento', () => {
    it('no calcula impuesto y el total es el precio', () => {
      const l = linea({ unitPrice: 250, taxPercent: 0, taxInclusive: true })
      expect(l.lineTax).toBe(0)
      expect(l.lineNet).toBe(250)
      expect(l.lineTotal).toBe(250)
    })
  })

  describe('descuentos', () => {
    it('aplica el descuento en porcentaje antes del impuesto', () => {
      const l = linea({ quantity: 2, unitPrice: 100, discountPercent: 10, taxPercent: 12, taxInclusive: false })
      expect(l.lineNet).toBe(180)
      expect(l.lineTax).toBe(21.6)
    })

    // El DTE del SAT trae el descuento en quetzales, no en porcentaje
    it('el descuento en quetzales manda sobre el porcentaje', () => {
      const l = linea({ unitPrice: 100, discountPercent: 50, discountAmount: 30, taxPercent: 0 })
      expect(l.lineNet).toBe(70)
    })

    it('un descuento mayor que la línea no produce importes negativos', () => {
      const l = linea({ unitPrice: 100, discountAmount: 150, taxPercent: 12, taxInclusive: true })
      expect(l.lineNet).toBe(0)
      expect(l.lineTotal).toBe(0)
    })
  })

  describe('redondeo', () => {
    it('nunca deja más de dos decimales', () => {
      for (const precio of [0.01, 3.33, 33.33, 66.67, 999.99]) {
        const l = linea({ quantity: 3, unitPrice: precio, taxPercent: 12, taxInclusive: true })
        for (const valor of [l.lineNet, l.lineTax, l.lineTotal]) {
          expect(Math.round(valor * 100) / 100).toBe(valor)
        }
      }
    })
  })
})

describe('Totales del documento', () => {
  it('suma las líneas y separa el impuesto', () => {
    const items = [
      linea({ unitPrice: 112, taxPercent: 12, taxInclusive: true, taxId: 'iva', taxName: 'IVA 12%' }),
      linea({ unitPrice: 224, taxPercent: 12, taxInclusive: true, taxId: 'iva', taxName: 'IVA 12%' }),
    ]
    const t = calcTotals(items)
    expect(t.subtotal).toBe(300)
    expect(t.taxAmount).toBe(36)
    expect(t.total).toBe(336)
  })

  it('agrupa el desglose por tipo de impuesto', () => {
    const items = [
      linea({ unitPrice: 112, taxPercent: 12, taxInclusive: true, taxId: 'iva', taxName: 'IVA 12%' }),
      linea({ unitPrice: 112, taxPercent: 12, taxInclusive: true, taxId: 'iva', taxName: 'IVA 12%' }),
      linea({ unitPrice: 50, taxPercent: 0, taxInclusive: true, taxId: 'exento', taxName: 'Exento' }),
    ]
    const t = calcTotals(items)
    expect(t.taxBreakdown).toHaveLength(1)
    expect(t.taxBreakdown[0]).toMatchObject({ name: 'IVA 12%', rate: 12, amount: 24 })
  })

  // Una factura mixta: parte gravada y parte exenta, que es lo que rompía el libro de compras
  it('maneja un documento con líneas gravadas y exentas', () => {
    const items = [
      linea({ unitPrice: 112, taxPercent: 12, taxInclusive: true, taxId: 'iva', taxName: 'IVA 12%' }),
      linea({ unitPrice: 200, taxPercent: 0, taxInclusive: true, taxId: 'exento', taxName: 'Exento' }),
    ]
    const t = calcTotals(items)
    expect(t.subtotal).toBe(300)
    expect(t.taxAmount).toBe(12)
    expect(t.total).toBe(312)
  })

  it('un documento vacío da todo en cero', () => {
    const t = calcTotals([])
    expect(t).toMatchObject({ subtotal: 0, taxAmount: 0, total: 0 })
    expect(t.taxBreakdown).toEqual([])
  })

  it('avisa si alguna línea trae el impuesto incluido, para mostrarlo en pantalla', () => {
    expect(calcTotals([linea({ unitPrice: 112, taxPercent: 12, taxInclusive: true })]).hasInclusive).toBe(true)
    expect(calcTotals([linea({ unitPrice: 100, taxPercent: 12, taxInclusive: false })]).hasInclusive).toBe(false)
  })
})

describe('Una línea nueva', () => {
  // Cada línea necesita su propia clave: sin ella, editar una modificaba todas
  it('nace con una clave propia', () => {
    const a = newLineItem()
    const b = newLineItem()
    expect(a._key).toBeTruthy()
    expect(a._key).not.toBe(b._key)
  })

  it('nace con el IVA incluido, como se factura en Guatemala', () => {
    expect(newLineItem().taxInclusive).toBe(true)
  })
})
