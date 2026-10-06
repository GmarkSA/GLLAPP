import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * Pólizas automáticas en la pantalla de Diarios.
 *
 * Caso real: se contabilizó la planilla de enero —POL-2026-00001— y no se veía
 * aquí, porque el listado solo trae los diarios que se capturan a mano. Ahora
 * el filtro de tipo ofrece «Automática».
 *
 * Al hacerlas visibles aparecen también sus botones de acción, y eso sí sería
 * un problema: anular o borrar la póliza desde aquí dejaría a la planilla
 * marcada como contabilizada apuntando a un asiento que ya no existe. Por eso
 * una póliza automática desde esta pantalla solo se consulta.
 */
const asientos = vi.fn(async (_params?: any) => ({ data: filas, total: filas.length }))
let filas: any[] = []

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../api/axios', () => ({
  default: {},
  getApiError: (e: any, d: string) => e?.response?.data?.error?.message ?? d,
}))
vi.mock('../../../api/asientos', () => ({
  getAsientos: (p?: any) => asientos(p),
  getAsiento: vi.fn(), postAsiento: vi.fn(), voidAsiento: vi.fn(),
  reverseAsiento: vi.fn(), deleteAsiento: vi.fn(), resetToDraftAsiento: vi.fn(),
  createAsiento: vi.fn(),
}))

import DiariosManualesPage, { TIPOS_DE_DIARIO } from './DiariosManualesPage'

const fila = (extra: Record<string, unknown> = {}) => ({
  id: 'a-1', entryNumber: 'POL-2026-00001', type: 'auto', status: 'posted',
  entryDate: '2026-01-31', description: 'Planilla enero 2026',
  reference: 'PLANILLA-2026-01', totalDebit: 25000, totalCredit: 25000,
  currency: 'GTQ', ...extra,
})

describe('Pólizas automáticas en Diarios', () => {
  let cont: HTMLDivElement
  let root: Root

  const pintar = async () => {
    await act(async () => { root.render(<DiariosManualesPage />) })
    await act(async () => { await Promise.resolve() })
  }
  /** Iconos de las acciones de una fila: anticon-stop, anticon-delete, ... */
  const iconosDeFila = () =>
    [...cont.querySelectorAll('tbody button .anticon')]
      .flatMap(i => [...i.classList].filter(c => c.startsWith('anticon-')))

  beforeEach(() => {
    filas = [fila()]
    cont = document.createElement('div')
    document.body.appendChild(cont)
    root = createRoot(cont)
  })
  afterEach(() => {
    act(() => root.unmount())
    cont.remove()
    vi.clearAllMocks()
    document.querySelectorAll('.ant-select-dropdown').forEach(d => d.remove())
  })

  it('el filtro de tipo ofrece «Automática», que es la vía para encontrarlas', () => {
    expect(TIPOS_DE_DIARIO).toContainEqual({ label: 'Automática', value: 'auto' })
  })

  it('sin tocar nada, el listado sigue pidiendo solo los manuales', async () => {
    await pintar()

    expect(asientos).toHaveBeenCalledWith(
      expect.objectContaining({ soloManuales: true }))
    expect(asientos.mock.calls[0][0]).not.toHaveProperty('tipo')
  })

  /**
   * El desplegable de tipos no bastó: el dueño siguió sin verlas porque la
   * salida estaba escondida entre seis opciones. La casilla va a la vista en
   * la barra, y pide el listado SIN acotar a manuales — así no depende de
   * ningún cambio del servidor para funcionar.
   */
  describe('la casilla «Incluir pólizas automáticas»', () => {
    const casilla = () =>
      [...cont.querySelectorAll('label.ant-checkbox-wrapper')]
        .find(l => l.textContent?.includes('Incluir pólizas automáticas'))

    it('está a la vista en la barra de filtros', async () => {
      await pintar()

      expect(casilla()).toBeTruthy()
    })

    it('el vacío explica cómo llegar a las automáticas, en vez de «No hay datos»', async () => {
      filas = []

      await pintar()

      expect(cont.textContent).toContain('Incluir pólizas automáticas')
      expect(cont.textContent).toContain('planilla, factura o pago')
    })

    it('al marcarla pide el listado completo, sin acotar a manuales', async () => {
      await pintar()

      await act(async () => {
        casilla()!.querySelector('input')!.click()
      })

      const ultima = asientos.mock.calls[asientos.mock.calls.length - 1][0]
      expect(ultima).toMatchObject({ soloManuales: false })
    })
  })

  it('una póliza automática se puede consultar', async () => {
    await pintar()

    expect(cont.textContent).toContain('POL-2026-00001')
    expect(cont.textContent).toContain('Planilla enero 2026')
  })

  it('y queda marcada como automática', async () => {
    await pintar()

    const etiquetas = [...cont.querySelectorAll('tbody .ant-tag')].map(t => t.textContent)
    expect(etiquetas).toContain('automática')
  })

  it('no ofrece anularla ni borrarla desde aquí', async () => {
    await pintar()

    const iconos = iconosDeFila()
    expect(iconos).not.toContain('anticon-stop')      // anular
    expect(iconos).not.toContain('anticon-delete')    // eliminar
    expect(iconos).not.toContain('anticon-rollback')  // revertir
    expect(iconos).not.toContain('anticon-edit')      // regresar a borrador
    expect(iconos).toContain('anticon-file-text')     // ver, que sí debe estar
  })

  it('un diario capturado a mano conserva todas sus acciones', async () => {
    filas = [fila({ id: 'a-2', entryNumber: 'DM-2026-00001', type: 'manual', description: 'Reclasificación' })]

    await pintar()

    const iconos = iconosDeFila()
    expect(iconos).toContain('anticon-stop')
    expect(iconos).toContain('anticon-rollback')
    expect([...cont.querySelectorAll('tbody .ant-tag')].map(t => t.textContent))
      .not.toContain('automática')
  })

  /**
   * Lo que de verdad dejaba al dueño sin respuesta: la pantalla se tragaba
   * cualquier error y pintaba «No hay datos». Un permiso que falta, un 500 o
   * la red caída se veían idénticos a un listado vacío de verdad.
   */
  describe('cuando la petición falla', () => {
    it('lo dice, en vez de fingir que no hay datos', async () => {
      asientos.mockRejectedValueOnce({
        response: { data: { error: { message: 'No tienes permiso para ver asientos contables' } } },
      })

      await pintar()

      expect(cont.textContent).toContain('No se pudo cargar el listado')
      expect(cont.textContent).toContain('No tienes permiso para ver asientos contables')
    })

    it('ofrece reintentar', async () => {
      asientos.mockRejectedValueOnce(new Error('Network Error'))

      await pintar()

      const reintentar = [...cont.querySelectorAll('button')]
        .find(b => b.textContent?.includes('Reintentar'))
      expect(reintentar).toBeTruthy()
    })
  })
})
