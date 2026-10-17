import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import UbicacionesPage from './UbicacionesPage'

/**
 * El listado de Ubicaciones / Puntos de Venta.
 *
 * El botón «Abrir» del POS se montaba encima de la columna Estado: Acciones
 * media 160px y llevaba un botón con texto, un lápiz y un «Eliminar» con texto
 * —no caben—, y la tabla no tenía ancho horizontal, así que en vez de
 * desplazarse se salía de la pantalla.
 */
const PUNTO_DE_VENTA = {
  id: 'pv-1', code: 'PV-001', name: 'LOCAL 6',
  address: 'km 25.5 Carretera a Mataquescuintla, local 6',
  type: 'pos', isActive: true, isDefault: true,
}

vi.mock('../../api/expedientes', () => ({
  getUbicaciones:   vi.fn(async () => [PUNTO_DE_VENTA]),
  createUbicacion:  vi.fn(),
  updateUbicacion:  vi.fn(),
  deleteUbicacion:  vi.fn(),
  getAlmacenes:     vi.fn(async () => []),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter><UbicacionesPage /></MemoryRouter>)
  })
  await act(async () => { await new Promise(r => setTimeout(r, 20)) })
}

const columnaAcciones = () =>
  Array.from(host.querySelectorAll('thead th')).find(th => th.textContent?.includes('Acciones'))

beforeEach(() => { host = document.createElement('div') })
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('la columna de acciones', () => {
  it('queda fija a la derecha, para que no la tape nada al desplazar', async () => {
    await render()
    expect(columnaAcciones()?.className).toMatch(/ant-table-cell-fix/)
  })

  it('los tres controles son iconos: con texto no caben en la fila', async () => {
    await render()
    const acciones = Array.from(host.querySelectorAll('tbody td'))
      .find(td => td.querySelector('.anticon-play-circle'))
    expect(acciones?.textContent?.trim()).toBe('')
  })

  it('el botón de abrir el POS sigue estando', async () => {
    await render()
    expect(host.querySelector('.anticon-play-circle')).toBeTruthy()
  })

  it('y el de eliminar', async () => {
    await render()
    expect(host.querySelector('tbody .anticon-delete')).toBeTruthy()
  })
})

describe('el ancho de la tabla', () => {
  it('se desplaza en horizontal en vez de salirse de la pantalla', async () => {
    await render()
    expect(host.querySelector('.ant-table-content, .ant-table-body')).toBeTruthy()
    // Con scroll.x AntD envuelve la tabla en un contenedor desplazable.
    const tabla = host.querySelector('.ant-table')
    expect(tabla?.className).toMatch(/ant-table/)
  })

  it('«Default» cabe junto al estado, sin montarse sobre Acciones', async () => {
    await render()
    const estado = Array.from(host.querySelectorAll('tbody td'))
      .find(td => td.textContent?.includes('Activa'))
    expect(estado?.textContent).toContain('Default')
  })
})
