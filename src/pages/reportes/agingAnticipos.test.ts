import { describe, it, expect } from 'vitest'
import { buildClientRows } from './ArAgingPage'
import { buildVendorRows } from './ApAgingPage'

/**
 * Los anticipos en los reportes de antigüedad.
 *
 * Dos cosas se fijan aquí, y las dos salieron de la misma línea de código.
 *
 * 1. El neto restaba DÓLARES a un total en QUETZALES. Los tramos se acumulan
 *    con `balanceGTQ` y el anticipo se sumaba con `balance`, que está en la
 *    moneda del documento. A un cliente con USD 15,212 de anticipo se le
 *    descontaban 15,212 en vez de su equivalente en quetzales, y el neto
 *    salía inflado por el tipo de cambio: Q 277,360.62 donde correspondía
 *    Q 175,967.62.
 *
 * 2. El anticipo no aparecía en el detalle del contacto. Solo sumaba al
 *    total, así que no se podía ver el orden de la operación —cuándo entró
 *    el adelanto frente a las facturas que cubre—, que es justo lo que se
 *    revisa al cobrar o antes de pagar.
 */
const TC = 7.665

/** El caso real: The Concious Home LLC, enero 2026. */
const agingCliente = {
  buckets: {
    days_60: {
      items: [
        { id: 'f1', customerId: 'c1', customerName: 'The Concious Home LLC',
          invoiceNumber: 'INV-000119', invoiceDate: '2025-12-31', dueDate: '2025-12-31',
          currency: 'USD', balance: 9276, balanceGTQ: 9276 * TC, total: 9276 },
      ],
    },
  },
  advances: [
    { id: 'a1', customerId: 'c1', customerName: 'The Concious Home LLC',
      advanceNumber: 'ANT-0001', advanceDate: '2025-11-15',
      currency: 'USD', balance: 1000, balanceGTQ: 1000 * TC, amount: 1000 },
  ],
}

describe('el neto de un cliente con anticipo en dólares', () => {
  const [fila] = buildClientRows(agingCliente)

  it('el anticipo se acumula en quetzales, como los tramos', () => {
    expect(fila.anticipo).toBeCloseTo(1000 * TC, 2)
  })

  /** Si restara los dólares sin convertir, el neto saldría ~6,665 más alto. */
  it('el neto resta el equivalente en quetzales, no los dólares', () => {
    expect(fila.neto).toBeCloseTo((9276 - 1000) * TC, 2)
    expect(fila.neto).not.toBeCloseTo(9276 * TC - 1000, 2)
  })
})

describe('el anticipo en el detalle del cliente', () => {
  const [fila] = buildClientRows(agingCliente)

  it('aparece junto a las facturas', () => {
    expect(fila.invoices).toHaveLength(2)
    expect(fila.invoices.some((i: any) => i.esAnticipo)).toBe(true)
  })

  it('se identifica por su número de anticipo', () => {
    const anticipo = fila.invoices.find((i: any) => i.esAnticipo) as any
    expect(anticipo.invoiceNumber).toBe('ANT-0001')
  })

  /** Un anticipo no vence: es dinero que el cliente ya entregó. */
  it('no trae vencimiento ni tramo de antigüedad', () => {
    const anticipo = fila.invoices.find((i: any) => i.esAnticipo) as any
    expect(anticipo.dueDate).toBeNull()
    expect(anticipo.bucket).toBeNull()
  })

  /** El orden de la operación: lo más viejo primero. */
  it('el detalle queda en orden cronológico', () => {
    expect(fila.invoices.map((i: any) => i.invoiceDate))
      .toEqual(['2025-11-15', '2025-12-31'])
  })
})

/**
 * Cuentas por pagar lleva exactamente la misma función: el mismo defecto
 * estaba en los dos reportes, porque son el mismo código escrito dos veces.
 */
describe('proveedores: el mismo trato', () => {
  const agingProveedor = {
    buckets: {
      days_60: {
        items: [
          { id: 'f1', vendorId: 'p1', vendorName: 'Proveedor del Sur',
            invoiceNumber: 'FP-001', invoiceDate: '2025-12-31', dueDate: '2025-12-31',
            currency: 'USD', balance: 5000, balanceGTQ: 5000 * TC, total: 5000 },
        ],
      },
    },
    advances: [
      { id: 'a1', vendorId: 'p1', vendorName: 'Proveedor del Sur',
        advanceNumber: 'ANTP-0001', advanceDate: '2025-10-01',
        currency: 'USD', balance: 800, balanceGTQ: 800 * TC, amount: 800 },
    ],
  }
  const [fila] = buildVendorRows(agingProveedor)

  it('el neto resta el equivalente en quetzales', () => {
    expect(fila.neto).toBeCloseTo((5000 - 800) * TC, 2)
  })

  it('el anticipo aparece en el detalle del proveedor', () => {
    expect(fila.invoices.some((i: any) => i.esAnticipo)).toBe(true)
  })

  it('y el detalle queda en orden cronológico', () => {
    expect(fila.invoices.map((i: any) => i.invoiceDate))
      .toEqual(['2025-10-01', '2025-12-31'])
  })
})

/** Sin anticipos nada cambia: el reporte se comporta como siempre. */
describe('sin anticipos', () => {
  it('el neto es el total y el detalle solo trae facturas', () => {
    const [fila] = buildClientRows({ ...agingCliente, advances: [] })

    expect(fila.anticipo).toBe(0)
    expect(fila.neto).toBeCloseTo(9276 * TC, 2)
    expect(fila.invoices).toHaveLength(1)
  })
})
