import { describe, it, expect } from 'vitest'
import { calcProrrateo, type LocalLinea } from './ImportacionFormPage'

/**
 * El costo de una importación en dólares, visto desde la pantalla.
 *
 * La factura del exportador viene en su moneda —USD casi siempre— y los gastos
 * de nacionalización (flete, seguro, DAI, IVA de importación) son locales, en
 * quetzales: así los pide la pantalla. El costo que termina en el kardex está
 * en quetzales.
 *
 * El prorrateo sumaba el FOB con esos gastos SIN convertirlo: USD 1,000 de
 * mercadería más Q 500 de flete daban 1,500, como si el dólar costara un
 * quetzal. El tipo de cambio del encabezado existía y no se usaba.
 */
const linea = (datos: Partial<LocalLinea> = {}): LocalLinea => ({
  _key: 1, productId: 'art-1', quantity: 10,
  unitCostFob: 100, totalFob: 1000,
  proratedFreight: 0, proratedInsurance: 0, proratedCustomsDuty: 0,
  proratedIva: 0, proratedOther: 0,
  totalLandedCost: 0, landedCostPerUnit: 0,
  ...datos,
})

const sinGastos = { freight: 0, insurance: 0, customsDuty: 0, ivaImport: 0, otherCharges: 0 }

describe('el costo de una importación en moneda extranjera', () => {
  it('el FOB se convierte con la tasa de la factura', () => {
    const [l] = calcProrrateo([linea()], sinGastos, 'by_value', 7.66777)

    expect(l.totalLandedCost).toBeCloseTo(7667.77, 2)
    expect(l.landedCostPerUnit).toBeCloseTo(766.777, 3)
  })

  it('los gastos de nacionalización ya están en quetzales', () => {
    const [l] = calcProrrateo(
      [linea()], { ...sinGastos, freight: 500, customsDuty: 300 }, 'by_value', 7.66777)

    expect(l.totalLandedCost).toBeCloseTo(8467.77, 2)
  })

  /** Sin tasa —o en quetzales— el cálculo es el de siempre. */
  it('en quetzales nada cambia', () => {
    const [l] = calcProrrateo([linea()], { ...sinGastos, freight: 500 }, 'by_value', 1)

    expect(l.totalLandedCost).toBeCloseTo(1500, 2)
  })

  /** El prorrateo reparte los gastos entre las líneas, no los multiplica. */
  it('reparte los gastos por valor entre dos artículos', () => {
    const lineas = [
      linea({ _key: 1, quantity: 10, unitCostFob: 100, totalFob: 1000 }),
      linea({ _key: 2, quantity: 10, unitCostFob: 300, totalFob: 3000 }),
    ]

    const [a, b] = calcProrrateo(lineas, { ...sinGastos, freight: 800 }, 'by_value', 7.66777)

    expect(a.proratedFreight).toBeCloseTo(200, 2)   // 1/4 del flete
    expect(b.proratedFreight).toBeCloseTo(600, 2)   // 3/4
    expect(a.totalLandedCost).toBeCloseTo(7667.77 + 200, 2)
    expect(b.totalLandedCost).toBeCloseTo(23003.31 + 600, 2)
  })
})
