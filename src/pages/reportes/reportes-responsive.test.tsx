import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import ResponsiveTable from '../../components/responsive/ResponsiveTable'

/**
 * Los reportes en el teléfono y en la tablet.
 *
 * Un reporte NO se convierte en tarjetas, y es a propósito: un balance, una
 * balanza, un libro mayor o una antigüedad de saldos se leen comparando
 * columnas —debe contra haber, un período contra el anterior, los tramos de
 * 30/60/90 días—. Apilar esas cifras en una tarjeta por fila destruye
 * justamente la comparación que es el reporte; y además estos reportes
 * existen para exportarse e imprimirse, donde la forma de tabla es la
 * correcta.
 *
 * Lo que sí cambia: hasta 1024px la tabla SE CORRE DE LADO en vez de
 * apretarse. Apretar un balance en 375px no lo hace legible, lo hace
 * inservible.
 *
 * AntD marca ese «correrse de lado» en el DOM —clase
 * `ant-table-scroll-horizontal` y `overflow-x: auto` en su contenedor—, así
 * que eso es lo que se mide aquí.
 */

/** Finge una pantalla de ese ancho para `window.matchMedia`. */
function pantallaDe(ancho: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    const min = /min-width:\s*(\d+)px/.exec(query)
    const cumpleMax = max ? ancho <= Number(max[1]) : true
    const cumpleMin = min ? ancho >= Number(min[1]) : true
    return {
      matches: cumpleMax && cumpleMin,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }
  }) as any
}

const HISTORIAL = [
  {
    id: 'tc-1', baseCurrencyCode: 'GTQ', targetCurrencyCode: 'USD',
    effectiveDate: '2026-10-31', rate: 0.12987013, officialRate: 7.701234,
    source: 'banguat', createdAt: '', updatedAt: '',
  },
  {
    id: 'tc-2', baseCurrencyCode: 'GTQ', targetCurrencyCode: 'USD',
    effectiveDate: '2026-09-30', rate: 0.13071895, officialRate: 7.650000,
    source: 'manual', createdAt: '', updatedAt: '',
  },
]

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../../api/monedas', () => ({
  getExchangeRateHistory:   vi.fn(async () => HISTORIAL),
  syncBanguatRate:          vi.fn(async () => ({ rate: 0.13, banguatRate: 7.70, effectiveDate: '2026-10-31' })),
  importarHistorialBanguat: vi.fn(async () => ({ desde: '', hasta: '', registrados: 0, actualizados: 0, respetadosManual: 0 })),
}))

describe('los reportes en pantalla chica', () => {
  let div: HTMLDivElement
  let root: Root
  const original = window.matchMedia

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
    window.matchMedia = original
  })

  const dibujar = async () => {
    const { default: Pagina } = await import('./TiposCambioPage')
    await act(async () => { root.render(<Pagina />) })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  }

  /**
   * ¿La tabla se corre de lado? AntD lo marca en el DOM: pone la clase
   * `ant-table-scroll-horizontal` y deja su contenedor con
   * `overflow-x: auto`. Eso es lo que se mide, no un píxel —jsdom no hace
   * layout—, y es exactamente la diferencia entre correrse y apretarse.
   */
  const seCorreDeLado = () => {
    const marca = div.querySelector('.ant-table-scroll-horizontal')
    const caja  = div.querySelector('.ant-table-content') as HTMLElement | null
    return !!marca && caja?.style.overflowX === 'auto'
  }

  /** Una tabla de reporte cualquiera: columnas de cifras, sin tarjeta. */
  const TablaDeReporte = () => (
    <ResponsiveTable
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={[{ id: '1', cuenta: '110001 Banco', debe: 45000, haber: 0, saldo: 45000 }]}
      columns={[
        { title: 'Cuenta', dataIndex: 'cuenta' },
        { title: 'Debe',   dataIndex: 'debe',  align: 'right' as const },
        { title: 'Haber',  dataIndex: 'haber', align: 'right' as const },
        { title: 'Saldo',  dataIndex: 'saldo', align: 'right' as const },
      ]}
    />
  )

  const dibujarTabla = async () => {
    await act(async () => { root.render(<TablaDeReporte />) })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
  }

  describe('la tabla de un reporte, que no tiene tarjeta', () => {
    it('en el teléfono se corre de lado en vez de apretarse', async () => {
      pantallaDe(375)
      await dibujarTabla()
      expect(div.querySelectorAll('table').length).toBe(1)
      expect(seCorreDeLado()).toBe(true)
    })

    it('en tablet, igual', async () => {
      pantallaDe(810)
      await dibujarTabla()
      expect(seCorreDeLado()).toBe(true)
    })

    /**
     * En escritorio no se toca nada: la tabla se reparte el ancho como
     * siempre, que es lo que hace legible un reporte de muchas columnas en
     * una pantalla grande.
     */
    it('en escritorio queda como estaba', async () => {
      pantallaDe(1440)
      await dibujarTabla()
      expect(seCorreDeLado()).toBe(false)
    })
  })

  describe('un reporte de verdad, con sus datos', () => {
    it('en el teléfono sigue siendo tabla, no una pila de tarjetas', async () => {
      pantallaDe(375)
      await dibujar()
      expect(div.querySelectorAll('table').length).toBeGreaterThan(0)
      // Y con sus cifras: la tasa oficial y su fecha, que es lo que se consulta.
      expect(div.textContent).toContain('31/10/2026')
      expect(div.textContent).toContain('7.701234')
    })

    it('en escritorio tambien', async () => {
      pantallaDe(1440)
      await dibujar()
      expect(div.querySelectorAll('table').length).toBeGreaterThan(0)
      expect(div.textContent).toContain('7.701234')
    })
  })

  /**
   * El marco del reporte —el que trae el título, el rango y los botones de
   * exportar— se aprieta en el teléfono: 24px por lado son 48 de los 375
   * que hay, y ese ancho se necesita para las cifras.
   */
  describe('el marco del reporte', () => {
    const dibujarMarco = async () => {
      const { default: ReportLayout } = await import('../../components/ReportLayout')
      await act(async () => {
        root.render(
          <ReportLayout title="Balanza" subtitle="de comprobación" tipoExport="balanza"
            fromDate="2026-01-01" toDate="2026-11-30">
            <div>contenido</div>
          </ReportLayout>,
        )
      })
      await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    }

    const relleno = () => {
      const marco = div.firstElementChild as HTMLElement | null
      return marco?.style.padding ?? null
    }

    it('en el teléfono deja 12px por lado, no 24', async () => {
      pantallaDe(375)
      await dibujarMarco()
      expect(relleno()).toBe('12px')
      expect(div.textContent).toContain('Balanza')
    })

    it('en tablet y escritorio se queda en 24', async () => {
      pantallaDe(810)
      await dibujarMarco()
      expect(relleno()).toBe('24px')
      act(() => { root.unmount() })
      root = createRoot(div)
      pantallaDe(1440)
      await dibujarMarco()
      expect(relleno()).toBe('24px')
    })
  })
})
