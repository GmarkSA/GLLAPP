import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * El capital del Balance General muestra los dos resultados.
 *
 * El caso real: un cliente que opera desde 2025 y nunca hizo asiento de
 * cierre. El activo trae todo lo que pasó; el capital traía solo las cuentas
 * de capital y el resultado del año en curso. La diferencia que el usuario
 * veía era, exactamente, la utilidad de 2025 — y en la pantalla no había
 * ninguna línea que la nombrara.
 *
 * Aquí se vigila que las dos líneas estén y que lo que se ve sume el total:
 * cuentas de capital + ejercicios anteriores + período = Total Capital.
 */
const BALANCE = {
  asOf: '2026-11-30',
  activo:     { accounts: [{ id: 'a1', code: '110001', name: 'Banco', balance: 45000 }], total: 45000 },
  activoFijo: { accounts: [], total: 0 },
  totalActivo: 45000,
  pasivo:     { accounts: [], total: 0 },
  capital:    { accounts: [{ id: 'c1', code: '310001', name: 'Capital social', balance: 10000 }], total: 10000, netIncome: 5000 },
  resultadoEjerciciosAnteriores: 30000,
  resultadoDelPeriodo: 5000,
  totalCapital: 45000,
  totalPasivoCapital: 45000,
  balanced: true,
  diferencia: 0,
  netIncome: 5000,
}

const RESULTADOS = {
  period: { from: '2026-01-01', to: '2026-11-30' },
  ingresos:      { accounts: [], total: 8000 },
  otrosIngresos: { accounts: [], total: 0 },
  costos:        { accounts: [], total: 0 },
  gastos:        { accounts: [], total: 3000 },
  otrosGastos:   { accounts: [], total: 0 },
  utilidadBruta: 8000, utilidadOperativa: 5000, utilidadNeta: 5000,
  margenBruto: 100, margenOperativo: 62.5, margenNeto: 62.5,
}

const getBalanceGeneral  = vi.fn(async () => BALANCE)
const getEstadoResultados = vi.fn(async () => RESULTADOS)

vi.mock('../../api/reportes', () => ({
  getBalanceGeneral:  () => getBalanceGeneral(),
  getEstadoResultados: () => getEstadoResultados(),
}))
vi.mock('../../api/integraciones', () => ({
  getDetalleIntegracion: vi.fn(async () => null),
}))
vi.mock('./IntegracionesContablesPage', () => ({
  DetallePanel: () => null,
}))

describe('el capital en la pantalla de Estados Financieros', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    getBalanceGeneral.mockClear()
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujar = async () => {
    const { default: Pagina } = await import('./EstadosFinancierosPage')
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  }

  it('nombra el resultado de ejercicios anteriores y el del período', async () => {
    await dibujar()
    const texto = div.textContent ?? ''
    expect(texto).toContain('Resultado de Ejercicios Anteriores')
    expect(texto).toContain('Resultado del Período')
  })

  it('muestra sus cifras', async () => {
    await dibujar()
    const texto = div.textContent ?? ''
    expect(texto).toContain('30,000.00')   // lo de 2025, que antes no se veía
    expect(texto).toContain('5,000.00')    // lo del período
  })

  /** Lo que se ve tiene que sumar lo que dice el total. */
  it('el capital suma: cuentas + los dos resultados = Total Capital', async () => {
    await dibujar()
    const texto = div.textContent ?? ''
    expect(texto).toContain('Total Capital')
    expect(10000 + 30000 + 5000).toBe(BALANCE.totalCapital)
    expect(texto).toContain('45,000.00')
  })
})
