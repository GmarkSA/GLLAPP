import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { PRESENTACION } from './presentacionDelReporte'

/**
 * La misma letra en los tres reportes mensualizados.
 *
 * El Balance ya la tiene. El Estado de Resultados y el Flujo de Efectivo
 * venían del mismo motor de columnas y arrastraban el mismo defecto: la
 * cifra se encogía a 10px en cuanto el reporte pasaba de nueve meses, para
 * que las trece columnas cupieran sin desplazarse.
 *
 * Lo que NO se homologa, y es a propósito: el color de las cifras. En el
 * Estado de Resultados y en el Flujo, el verde de un resultado positivo y
 * el rojo de uno negativo dicen algo; en el Balance no decían nada. Igualar
 * los colores habría borrado información, que no es presentación.
 */

const CUENTAS = (prefijo: string) => ([
  { id: `${prefijo}1`, code: '400001', name: 'Ventas de servicios', balance: 412500.75 },
  { id: `${prefijo}2`, code: '500001', name: 'Costo de ventas',     balance: -180250.3 },
])

const RESULTADOS = {
  period: { from: '2026-01-01', to: '2026-11-30' },
  ingresos:      { accounts: CUENTAS('i'), total: 412500.75 },
  otrosIngresos: { accounts: [], total: 0 },
  costos:        { accounts: [], total: 180250.30 },
  gastos:        { accounts: [{ id: 'g1', code: '600001', name: 'Sueldos y salarios', balance: 95000 }], total: 95000 },
  otrosGastos:   { accounts: [], total: 0 },
  utilidadBruta: 232250.45, utilidadOperativa: 137250.45, utilidadNeta: 137250.45,
  margenBruto: 56.3, margenOperativo: 33.3, margenNeto: 33.3,
}

const FLUJO = {
  period: { from: '2026-01-01', to: '2026-11-30' },
  operating: {
    netIncome: 137250.45,
    adjustments: [{ label: 'Depreciación del período', amount: 4073.81 }],
    total: 141324.26,
  },
  investing: { items: [{ label: 'Compra de equipo de cómputo', amount: -12107.14 }], total: -12107.14 },
  financing: { items: [], total: 0 },
  cashAccounts: [{ code: '113001', name: 'Banco GTQ — Principal', change: 129217.12 }],
  netCashChange: 129217.12,
  totalCashEnd: 587748.19,
  note: null,
}

vi.mock('../../api/reportes', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getEstadoResultados: vi.fn(async () => RESULTADOS),
    getFlujoEfectivo:    vi.fn(async () => FLUJO),
    exportReporte:       vi.fn(),
    nextCorrelativo:     vi.fn(async () => null),
  }
})

vi.mock('../../api/monedas', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getExchangeRateForDate: vi.fn(async () => null) }
})

describe('la presentación homologada de los reportes mensualizados', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujar = async (ruta: string) => {
    const { default: Pagina } = await import(/* @vite-ignore */ ruta)
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 150)) })
  }

  const cifras = () =>
    [...div.querySelectorAll<HTMLElement>('tbody span')]
      .filter(e => e.style.fontVariantNumeric === 'tabular-nums' && e.style.fontSize)

  const encabezados = () =>
    [...div.querySelectorAll<HTMLElement>('thead div')]
      .filter(e => e.style.textTransform === 'uppercase')

  for (const [nombre, ruta, etiquetaIzquierda] of [
    ['Estado de Resultados', './EstadoResultadosPage', 'Cuenta'],
    ['Flujo de Efectivo',    './FlujoEfectivoPage',    'Concepto'],
  ] as const) {
    describe(nombre, () => {
      it('la cifra mide 13px con los doce meses puestos', async () => {
        await dibujar(ruta)
        const todas = cifras()
        expect(todas.length, 'no se encontró ninguna cifra').toBeGreaterThan(0)
        for (const c of todas) {
          const px = Number(c.style.fontSize.replace('px', ''))
          expect(px).toBeGreaterThanOrEqual(PRESENTACION.codigo)
          expect(px).toBeLessThanOrEqual(PRESENTACION.cifra)
        }
      })

      it('ninguna letra del cuerpo baja de 12px', async () => {
        await dibujar(ruta)
        const chicas = [...div.querySelectorAll<HTMLElement>('tbody span')]
          .map(e => Number(e.style.fontSize.replace('px', '')))
          .filter(n => n > 0 && n < 12)
        expect(chicas, `quedaron ${chicas.length} textos por debajo de 12px`).toHaveLength(0)
      })

      it('los encabezados de columna son etiquetas, como en el Balance', async () => {
        await dibujar(ruta)
        const enc = encabezados()
        expect(enc.length, 'los encabezados no quedaron como etiqueta').toBeGreaterThan(10)
        for (const e of enc) {
          expect(e.style.fontSize).toBe(`${PRESENTACION.encabezado}px`)
          expect(e.style.letterSpacing).toBe('0.03em')
        }
      })

      it('y la columna de la izquierda estrena su encabezado', async () => {
        await dibujar(ruta)
        expect(div.textContent).toContain(etiquetaIzquierda)
        expect(div.textContent).toContain('Acumulado')
      })
    })
  }

  /**
   * El verde y el rojo del Estado de Resultados no se tocaron: una utilidad
   * positiva se sigue viendo distinta de una pérdida.
   */
  it('el Estado de Resultados conserva el color de sus cifras', async () => {
    await dibujar('./EstadoResultadosPage')
    const colores = new Set(cifras().map(c => c.style.color).filter(Boolean))
    expect(colores.size, 'las cifras quedaron todas del mismo color').toBeGreaterThan(1)
  })

  it('y siguen estando los datos de siempre', async () => {
    await dibujar('./EstadoResultadosPage')
    const texto = div.textContent ?? ''
    expect(texto).toContain('Ventas de servicios')
    expect(texto).toContain('400001')
    expect(texto).toContain('Sueldos y salarios')
  })
})
