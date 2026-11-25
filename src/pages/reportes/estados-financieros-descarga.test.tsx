import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * La descarga de los Estados Financieros la arma el servidor.
 *
 * Allá está el logo de la empresa y la integración de cada cuenta sale al
 * lado de la base. Pero una descarga que no baja es peor que una descarga sin
 * portada: si el servidor no puede, el navegador arma la suya, que es la que
 * había antes. Esto vigila las dos cosas.
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
  totalCapital: 45000, totalPasivoCapital: 45000,
  balanced: true, diferencia: 0, netIncome: 5000,
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

const descargar = vi.fn(async (_mes: number, _anio: number) => undefined)
const getDetalleIntegracion = vi.fn(async () => ({ lineas: [] }))

vi.mock('../../api/reportes', () => ({
  getBalanceGeneral:   async () => BALANCE,
  getEstadoResultados: async () => RESULTADOS,
  descargarEstadosFinancierosExcel: (mes: number, anio: number) => descargar(mes, anio),
}))
vi.mock('../../api/integraciones', () => ({
  getDetalleIntegracion: () => getDetalleIntegracion(),
}))
vi.mock('./IntegracionesContablesPage', () => ({ DetallePanel: () => null }))

/** El navegador no escribe archivos en la prueba: solo se cuenta la llamada. */
const escribirArchivo = vi.fn()
vi.mock('xlsx', () => ({
  utils: {
    book_new: () => ({}),
    aoa_to_sheet: () => ({}),
    book_append_sheet: () => undefined,
  },
  writeFile: (...args: any[]) => escribirArchivo(...args),
}))

describe('la descarga de los Estados Financieros', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    descargar.mockClear(); escribirArchivo.mockClear(); getDetalleIntegracion.mockClear()
    descargar.mockResolvedValue(undefined)
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujarYDescargar = async () => {
    const { default: Pagina } = await import('./EstadosFinancierosPage')
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })

    const boton = [...div.querySelectorAll('button')]
      .find(b => (b.textContent ?? '').includes('Excel con integración'))
    expect(boton, 'no apareció el botón de la descarga').toBeTruthy()
    await act(async () => { boton!.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
  }

  it('se la pide al servidor, con el mes y el año de la pantalla', async () => {
    await dibujarYDescargar()
    expect(descargar).toHaveBeenCalledTimes(1)
    const [mes, anio] = descargar.mock.calls[0]
    expect(mes).toBeGreaterThanOrEqual(1)
    expect(mes).toBeLessThanOrEqual(12)
    expect(anio).toBeGreaterThan(2000)
  })

  it('y no arma la del navegador cuando el servidor respondió', async () => {
    await dibujarYDescargar()
    expect(escribirArchivo).not.toHaveBeenCalled()
  })

  /** Una versión vieja del servidor, un 404: la descarga igual tiene que bajar. */
  it('si el servidor no puede, el navegador arma la suya', async () => {
    descargar.mockRejectedValue(new Error('404'))
    await dibujarYDescargar()
    expect(descargar).toHaveBeenCalledTimes(1)
    expect(escribirArchivo).toHaveBeenCalled()
  })
})
