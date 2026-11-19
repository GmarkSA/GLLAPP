import { describe, it, expect } from 'vitest'
import { buildBGRows } from './BalanceGeneralPage'

/**
 * La tabla mensual tiene que decir la diferencia, no dejarla al ojo.
 *
 * Mostraba «TOTAL ACTIVOS 802,252.12» y «TOTAL PASIVO + CAPITAL 778,817.80»
 * sin una sola línea que dijera que faltan 23,434.32 — y menos aún dónde
 * están: en la cuenta de orden de los saldos iniciales, que no entra en
 * ningún reporte mientras la apertura esté incompleta.
 */
const vacio = { accounts: [], total: 0 }

const mes = (yearMonth: string, totalActivo: number, totalPasivoCapital: number, diferencia: number) => ({
  month: { yearMonth, label: yearMonth, to: `${yearMonth}-28` } as any,
  data: {
    asOf: `${yearMonth}-28`,
    activo: vacio, activoFijo: vacio, pasivo: vacio,
    capital: { accounts: [], total: 0, netIncome: 0 },
    totalActivo, totalCapital: 0, totalPasivoCapital,
    balanced: Math.abs(diferencia) < 0.01,
    diferencia,
    sinClasificar: diferencia
      ? { accounts: [{ id: 'c1', code: '800001', name: 'Cuentas de Orden', balance: diferencia } as any], total: diferencia }
      : { accounts: [], total: 0 },
    netIncome: 0,
  } as any,
})

describe('la tabla mensual del balance', () => {
  const conDiferencia = [mes('2025-12', 802252.12, 778817.80, 23434.32)]

  it('agrega la línea de la diferencia', () => {
    const filas = buildBGRows(conDiferencia as any)
    const dif = filas.find(f => f.key === 'grand3-dif')

    expect(dif).toBeTruthy()
    expect(dif!._name).toContain('DIFERENCIA')
    expect(Number(dif!._total)).toBeCloseTo(23434.32, 2)
  })

  it('y nombra la cuenta que la provoca', () => {
    const filas = buildBGRows(conDiferencia as any)
    const cuenta = filas.find(f => f._code === '800001')

    expect(cuenta).toBeTruthy()
    expect(cuenta!._name).toContain('Cuentas de Orden')
  })

  /** Si cuadra, la tabla queda como siempre: sin líneas de más. */
  it('cuando cuadra no agrega nada', () => {
    const filas = buildBGRows([mes('2025-12', 500, 500, 0)] as any)

    expect(filas.find(f => f.key === 'grand3-dif')).toBeUndefined()
    expect(filas.find(f => f._code === '800001')).toBeUndefined()
  })
})
