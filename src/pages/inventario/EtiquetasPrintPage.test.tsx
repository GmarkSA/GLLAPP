import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import EtiquetasPrintPage from './EtiquetasPrintPage'

/**
 * La hoja de etiquetas tiene que pintarse.
 *
 * El dueño reportó que al mandar a imprimir no se visualiza nada. Esta prueba
 * renderiza la página de verdad con un artículo, para ver si el problema está
 * en la página o en cómo se abre.
 */
const UNO = {
  id: 'a-1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE',
  salesPrice: 23, barCodes: ['ABA-GRAN'], stockOnHand: 1,
}

const getProducts = vi.fn(async () => ({ data: [UNO], total: 1 }))
vi.mock('../../api/inventario', () => ({ getProducts: () => getProducts() }))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = async (query: string) => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/inventario/etiquetas${query}`]}>
        <Routes><Route path="/inventario/etiquetas" element={<EtiquetasPrintPage />} /></Routes>
      </MemoryRouter>,
    )
  })
  // El QR se genera de forma asíncrona después de traer los artículos.
  await act(async () => { await new Promise(r => setTimeout(r, 50)) })
}

beforeEach(() => {
  getProducts.mockClear()
  window.print = vi.fn()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('la hoja de etiquetas', () => {
  it('pinta la etiqueta del artículo', async () => {
    await render('?formato=hoja-24&copias=1')
    expect(host.textContent).toContain('ABACO BACO GRANDE')
  })

  it('pinta el QR, no un recuadro vacío', async () => {
    await render('?formato=hoja-24&copias=1')
    const img = host.querySelector('img')
    expect(img?.getAttribute('src')).toMatch(/^data:image\//)
  })

  it('muestra el código y el precio', async () => {
    await render('?formato=hoja-24&copias=1')
    expect(host.textContent).toContain('ABA-GRAN')
    expect(host.textContent).toContain('Q 23.00')
  })

  it('manda a imprimir sola', async () => {
    await render('?formato=hoja-24&copias=1')
    await act(async () => { await new Promise(r => setTimeout(r, 700)) })
    expect(window.print).toHaveBeenCalled()
  })

  it('el filtro de código interno no deja fuera al artículo cuyo código es su SKU', async () => {
    await render('?formato=hoja-24&copias=1&soloSinCodigoPropio=1')
    expect(host.textContent).toContain('ABACO BACO GRANDE')
  })

  it('con «una por existencia» imprime según el stock', async () => {
    getProducts.mockResolvedValueOnce({ data: [{ ...UNO, stockOnHand: 3 }], total: 1 } as any)
    await render('?formato=hoja-24&porExistencia=1')
    expect(host.querySelectorAll('.etiqueta')).toHaveLength(3)
  })

  it('sin etiquetas explica por qué, en vez de quedarse en blanco', async () => {
    getProducts.mockResolvedValueOnce({ data: [], total: 0 } as any)
    await render('?formato=hoja-24&copias=1')
    expect(host.textContent).toContain('No hay etiquetas que imprimir')
  })
})
