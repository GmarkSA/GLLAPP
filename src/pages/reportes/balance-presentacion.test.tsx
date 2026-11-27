import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { PRESENTACION } from './presentacionDelReporte'

/**
 * La presentación del Balance General mensualizado.
 *
 * Esto no vigila ninguna cifra: vigila cómo se ven. El reporte se volvía
 * ilegible con doce meses porque la letra se encogía a 10px para que las
 * trece columnas cupieran sin desplazarse.
 *
 * Lo que se comprueba, con los doce meses puestos:
 *
 *  - la cifra mide lo mismo con doce columnas que con tres;
 *  - una cuenta y un total miden igual y se distinguen por el peso;
 *  - los encabezados de columna son etiquetas —gris, minúscula alta— y no
 *    compiten con las cifras;
 *  - y los datos siguen siendo los mismos de antes.
 */
const CUENTAS_ACTIVO = [
  { id: 'a1', code: '113001', name: 'Banco GTQ — Principal', balance: 587748.19 },
  { id: 'a2', code: '120001', name: 'Clientes Locales',      balance: 38060.52 },
]
const CUENTAS_FIJO = [
  { id: 'f1', code: '160005', name: 'Equipo de Cómputo',          balance: 12107.14 },
  { id: 'f2', code: '160010', name: 'Dep. Acumulada — Cómputo',   balance: -4073.81 },
]
const CUENTAS_PASIVO  = [{ id: 'p1', code: '210001', name: 'Proveedores locales', balance: 120000 }]
const CUENTAS_CAPITAL = [{ id: 'c1', code: '310001', name: 'Capital social',      balance: 50000 }]

const BALANCE = {
  asOf: '2026-11-30',
  activo:     { accounts: CUENTAS_ACTIVO, total: 625808.71 },
  activoFijo: { accounts: CUENTAS_FIJO,   total: 8033.33 },
  totalActivo: 633842.04,
  pasivo:     { accounts: CUENTAS_PASIVO,  total: 120000 },
  capital:    { accounts: CUENTAS_CAPITAL, total: 50000, netIncome: 400000 },
  resultadoEjerciciosAnteriores: 63842.04,
  resultadoDelPeriodo: 400000,
  totalCapital: 513842.04,
  totalPasivoCapital: 633842.04,
  balanced: true, diferencia: 0, netIncome: 400000,
}

vi.mock('../../api/reportes', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getBalanceGeneral: vi.fn(async () => BALANCE),
    exportReporte:     vi.fn(),
    nextCorrelativo:   vi.fn(async () => null),
  }
})

vi.mock('../../api/monedas', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getExchangeRateForDate: vi.fn(async () => null) }
})

describe('cómo se ve el Balance General con doce meses', () => {
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

  const dibujar = async () => {
    const { default: Pagina } = await import('./BalanceGeneralPage')
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 150)) })
  }

  /** Los tamaños de letra que de verdad quedaron en el DOM. */
  const tamanos = (selector: string) =>
    [...div.querySelectorAll<HTMLElement>(selector)]
      .map(e => e.style.fontSize)
      .filter(Boolean)

  it('la cifra de una cuenta mide 13px, no 10', async () => {
    await dibujar()
    const celdas = [...div.querySelectorAll<HTMLElement>('tbody span')]
      .filter(e => e.style.fontVariantNumeric === 'tabular-nums' && e.style.fontWeight === '400')
    expect(celdas.length, 'no se encontró ninguna cifra de cuenta').toBeGreaterThan(0)
    for (const c of celdas) {
      expect(c.style.fontSize).toBe(`${PRESENTACION.cifra}px`)
    }
  })

  /** Antes el total se distinguía además por tamaño; ahora solo por el peso. */
  it('la cifra de un total mide igual que la de una cuenta, y va en negrita', async () => {
    await dibujar()
    const totales = [...div.querySelectorAll<HTMLElement>('tbody span')]
      .filter(e => e.style.fontVariantNumeric === 'tabular-nums' && e.style.fontWeight === '700')
    expect(totales.length, 'no se encontró ninguna cifra de total').toBeGreaterThan(0)
    for (const t of totales) {
      expect(t.style.fontSize).toBe(`${PRESENTACION.cifra}px`)
    }
  })

  it('ninguna letra del cuerpo baja de 12px', async () => {
    await dibujar()
    const chicas = tamanos('tbody span')
      .map(s => parseInt(s, 10))
      .filter(n => n < 12)
    expect(chicas, `quedaron ${chicas.length} textos por debajo de 12px`).toHaveLength(0)
  })

  /** Los encabezados son etiquetas: pesan menos a la vista que las cifras. */
  it('los encabezados de columna son etiquetas en gris y minúscula alta', async () => {
    await dibujar()
    const encabezados = [...div.querySelectorAll<HTMLElement>('thead div')]
      .filter(e => e.style.textTransform === 'uppercase')
    expect(encabezados.length, 'los encabezados no quedaron como etiqueta').toBeGreaterThan(10)
    for (const e of encabezados) {
      expect(e.style.fontSize).toBe(`${PRESENTACION.encabezado}px`)
      expect(e.style.color).toBeTruthy()
      expect(e.style.letterSpacing).toBe('0.03em')
    }
  })

  it('la columna de cuenta y la de código conservan su encabezado', async () => {
    await dibujar()
    const texto = div.textContent ?? ''
    expect(texto).toContain('Cuenta')
    expect(texto).toContain('Código')
  })

  /** Y lo de siempre sigue: los doce meses, las cuentas y sus cifras. */
  it('siguen estando los doce meses y las cuentas con sus cifras', async () => {
    await dibujar()
    const texto = div.textContent ?? ''
    expect(texto).toContain('Banco GTQ — Principal')
    expect(texto).toContain('113001')
    expect(texto).toContain('Dep. Acumulada — Cómputo')
    expect(texto).toContain('Acumulado')
    expect(texto).toContain('TOTAL ACTIVOS')
    // Las cifras, con sus decimales.
    expect(texto).toContain('587,748.19')
    expect(texto).toContain('-4,073.81')
  })

  /**
   * El detalle por cuenta no se tocó: cada cifra sigue siendo pulsable, que
   * es lo que abre el movimiento de esa cuenta en ese mes.
   */
  it('las cifras de una cuenta siguen abriendo su detalle', async () => {
    await dibujar()
    const pulsables = [...div.querySelectorAll<HTMLElement>('tbody span')]
      .filter(e => e.style.cursor === 'pointer' && e.style.textDecorationStyle === 'dotted')
    expect(pulsables.length, 'se perdió el detalle por cuenta').toBeGreaterThan(0)
  })
})
