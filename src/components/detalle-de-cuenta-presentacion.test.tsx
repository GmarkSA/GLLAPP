import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { PRESENTACION } from '../pages/reportes/presentacionDelReporte'

/**
 * La presentación del detalle de una cuenta.
 *
 * Es el panel que se abre al pulsar una cifra en un reporte, y lo comparten
 * seis: Balance General, Estado de Resultados, Balanza, Movimiento de
 * Capital, Ejecución de Centros de Costo y Rentabilidad por División.
 *
 * El defecto que se corrige: sus encabezados —Fecha, Tipo, No. Documento,
 * Débito…— nunca se definieron, así que salían con el tamaño por defecto de
 * Ant Design, 14px en negrita. Eran MÁS GRANDES que las cifras que
 * encabezan, al revés de lo que se quiere: el encabezado es una etiqueta y
 * la cifra es el dato. Y el resto convivía en tres tamaños —10, 11 y 12—
 * sin una jerarquía detrás.
 *
 * Aquí se vigila que el panel use la misma escala que el reporte del que
 * viene, para que pulsar una cifra de 13px no lleve a una tabla de 12.
 */
const MOVIMIENTOS = [
  {
    date: '2026-05-14', entryNumber: 'AS-0001', docNumber: 'FV-00044',
    sourceType: 'invoice', sourceId: 'inv-1', entryType: null,
    reference: 'FV-00044', contactName: 'GUATEMALA COUNTRY CLUB',
    description: 'Factura FV-00044', debit: 29307.05, credit: 0, balance: 29307.05,
  },
  {
    date: '2026-05-29', entryNumber: 'AS-0002', docNumber: 'PC-00037',
    sourceType: 'payment', sourceId: 'pay-1', entryType: null,
    reference: 'FV-00044', contactName: 'GUATEMALA COUNTRY CLUB',
    description: 'Abono factura FV-00044', debit: 0, credit: 29307.05, balance: 0,
  },
]

const LIBRO = {
  account: { id: 'acc-1', code: '120001', name: 'Clientes Locales' },
  openingBalance: 0,
  totalDebit: 93682.72,
  totalCredit: 86073.30,
  closingBalance: 7609.42,
  movements: MOVIMIENTOS,
}

vi.mock('../api/reportes', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getLibroMayor: vi.fn(async () => LIBRO) }
})

describe('cómo se ve el detalle de una cuenta', () => {
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

  /** El panel se dibuja fuera del contenedor, así que se mira todo el cuerpo. */
  const dibujar = async () => {
    const { default: Panel } = await import('./AccountDrilldownDrawer')
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Panel
            target={{
              accountId: 'acc-1', accountName: 'Clientes Locales',
              fromDate: '2026-05-01', toDate: '2026-05-31',
            }}
            onClose={() => {}}
          />
        </MemoryRouter>,
      )
    })
    await act(async () => { await new Promise(r => setTimeout(r, 120)) })
  }

  const enCuerpo = <T extends HTMLElement>(sel: string) =>
    [...document.body.querySelectorAll<T>(sel)]

  it('los encabezados dejan de ser más grandes que las cifras', async () => {
    await dibujar()
    const encabezados = enCuerpo<HTMLElement>('.ant-drawer thead div')
      .filter(e => e.style.textTransform === 'uppercase')
    expect(encabezados.length, 'los encabezados no quedaron como etiqueta').toBeGreaterThan(6)
    for (const e of encabezados) {
      expect(e.style.fontSize).toBe(`${PRESENTACION.encabezado}px`)
      expect(Number(e.style.fontSize.replace('px', ''))).toBeLessThan(PRESENTACION.cifra)
      expect(e.style.letterSpacing).toBe('0.03em')
    }
  })

  it('y están los diez: fecha, tipo, documento, referencia, contacto y las cifras', async () => {
    await dibujar()
    const texto = document.body.textContent ?? ''
    for (const t of ['Fecha', 'Tipo', 'No. Documento', 'FEL / Ref.', 'Contacto', 'Descripción', 'Débito', 'Crédito', 'Saldo']) {
      expect(texto, `falta el encabezado ${t}`).toContain(t)
    }
  })

  it('las cifras del detalle miden lo mismo que las del reporte del que vienen', async () => {
    await dibujar()
    const cifras = enCuerpo<HTMLElement>('.ant-drawer tbody span')
      .filter(e => e.style.fontVariantNumeric === 'tabular-nums')
    expect(cifras.length, 'no se encontró ninguna cifra').toBeGreaterThan(0)
    for (const c of cifras) {
      const px = Number(c.style.fontSize.replace('px', ''))
      // La referencia FEL va un punto más chica, como el código de cuenta.
      expect(px).toBeGreaterThanOrEqual(PRESENTACION.codigo)
      expect(px).toBeLessThanOrEqual(PRESENTACION.cifra)
    }
  })

  it('el resumen de arriba se lee como resumen, no como una fila más', async () => {
    await dibujar()
    const cifrasResumen = enCuerpo<HTMLElement>('.ant-statistic-content-value')
    expect(cifrasResumen.length).toBe(4)
    for (const c of cifrasResumen) {
      const padre = c.closest('.ant-statistic')?.querySelector<HTMLElement>('.ant-statistic-content')
      expect(padre?.style.fontSize).toBe('16px')
    }
  })

  /** Y el contenido sigue siendo el mismo: no se tocó ni una consulta. */
  it('los movimientos y sus totales siguen ahí', async () => {
    await dibujar()
    const texto = document.body.textContent ?? ''
    expect(texto).toContain('Clientes Locales')
    expect(texto).toContain('120001')
    expect(texto).toContain('FV-00044')
    expect(texto).toContain('GUATEMALA COUNTRY CLUB')
    expect(texto).toContain('29,307.05')
    expect(texto).toContain('Totales del período')
    expect(texto).toContain('7,609.42')
  })
})
