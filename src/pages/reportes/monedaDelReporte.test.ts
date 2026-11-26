import { describe, it, expect } from 'vitest'
import {
  enDolares, filasEnDolares, mesesSinTasa, fmtMonto,
} from './monedaDelReporte'

/**
 * Ver los estados financieros en dólares.
 *
 * Lo que se cuida aquí es la regla contable, no el formato: cada mes se
 * convierte con SU tasa de fin de mes; un acumulado en dólares es la suma de
 * los meses ya convertidos —no el acumulado en quetzales dividido entre una
 * sola tasa—; y un saldo se convierte con la tasa del corte.
 *
 * Esos dos números no son el mismo, y confundirlos es la forma típica de
 * entregar un estado en dólares que no cuadra.
 */
const MESES = ['2026-01', '2026-02', '2026-03']

/** Marzo se devaluó: 7.70 → 7.80. */
const TASAS: Record<string, number> = { '2026-01': 7.70, '2026-02': 7.70, '2026-03': 7.80 }
const tasaDe = (mes: string) => TASAS[mes] ?? null

describe('pasar quetzales a dólares', () => {
  it('divide entre los quetzales que cuesta un dólar', () => {
    expect(enDolares(7_700, 7.7)).toBeCloseTo(1_000, 6)
  })

  /** Una tasa que no sirve no se inventa: mejor una raya que una cifra falsa. */
  it('sin tasa útil no devuelve número', () => {
    expect(enDolares(1_000, 0)).toBeNull()
    expect(enDolares(1_000, -7.7)).toBeNull()
    expect(enDolares(1_000, null)).toBeNull()
    expect(enDolares(1_000, undefined)).toBeNull()
  })
})

describe('las filas de un reporte de flujo —estado de resultados, flujo de efectivo', () => {
  const FILAS = [
    { key: 'ventas', _kind: 'acct', _name: 'Ventas', '2026-01': 7_700, '2026-02': 7_700, '2026-03': 7_800, _total: 23_200 },
  ]

  it('convierte cada mes con su propia tasa', () => {
    const [fila] = filasEnDolares(FILAS, MESES, tasaDe, 'suma')
    expect(fila['2026-01']).toBeCloseTo(1_000, 6)
    expect(fila['2026-03']).toBeCloseTo(1_000, 6)   // 7,800 / 7.80
  })

  /**
   * El acumulado en dólares son 3,000, no 23,200/7.80 = 2,974.36. La
   * diferencia es la devaluación de marzo, y se pierde si se convierte el
   * acumulado de una sola vez.
   */
  it('el acumulado es la suma de los meses ya convertidos', () => {
    const [fila] = filasEnDolares(FILAS, MESES, tasaDe, 'suma')
    expect(fila._total).toBeCloseTo(3_000, 6)
    expect(fila._total).not.toBeCloseTo(23_200 / 7.8, 2)
  })

  it('no toca las filas originales', () => {
    filasEnDolares(FILAS, MESES, tasaDe, 'suma')
    expect(FILAS[0]['2026-01']).toBe(7_700)
    expect(FILAS[0]._total).toBe(23_200)
  })
})

describe('las filas de un reporte de saldos —balance general', () => {
  const FILAS = [
    { key: 'banco', _kind: 'acct', _name: 'Banco', '2026-01': 7_700, '2026-02': 15_400, '2026-03': 23_400, _total: 23_400 },
  ]

  /** El activo al corte vale lo que vale ese día, no la suma del año. */
  it('el total se convierte con la tasa del corte', () => {
    const [fila] = filasEnDolares(FILAS, MESES, tasaDe, 'saldoFinal')
    expect(fila._total).toBeCloseTo(3_000, 6)       // 23,400 / 7.80
    expect(fila['2026-01']).toBeCloseTo(1_000, 6)   // 7,700 / 7.70
  })
})

describe('cuando falta un tipo de cambio', () => {
  const soloEnero = (mes: string) => mes === '2026-01' ? 7.7 : null
  const FILAS = [{ key: 'x', '2026-01': 7_700, '2026-02': 7_700, '2026-03': 7_800, _total: 23_200 }]

  it('el mes sin tasa queda en blanco, no en quetzales', () => {
    const [fila] = filasEnDolares(FILAS, MESES, soloEnero, 'suma')
    expect(fila['2026-01']).toBeCloseTo(1_000, 6)
    expect(fila['2026-02']).toBeNull()
    expect(fila['2026-03']).toBeNull()
  })

  it('y el acumulado solo cuenta lo que sí se pudo convertir', () => {
    const [fila] = filasEnDolares(FILAS, MESES, soloEnero, 'suma')
    expect(fila._total).toBeCloseTo(1_000, 6)
  })

  it('sin ninguna tasa, el total tampoco se inventa', () => {
    const [fila] = filasEnDolares(FILAS, MESES, () => null, 'suma')
    expect(fila._total).toBeNull()
  })

  /** Y se puede avisar exactamente qué meses faltan. */
  it('dice qué meses no se pudieron convertir', () => {
    expect(mesesSinTasa(MESES, soloEnero)).toEqual(['2026-02', '2026-03'])
    expect(mesesSinTasa(MESES, tasaDe)).toEqual([])
  })
})

describe('cómo se escribe cada cifra', () => {
  it('lleva el signo de la moneda en que se está viendo', () => {
    expect(fmtMonto(1_234.5, 'GTQ')).toBe('Q 1,234.50')
    expect(fmtMonto(1_234.5, 'USD')).toBe('US$ 1,234.50')
  })

  it('una celda sin valor es una raya, nunca un cero', () => {
    expect(fmtMonto(null, 'USD')).toBe('—')
    expect(fmtMonto(undefined, 'USD')).toBe('—')
  })
})
