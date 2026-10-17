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

const getProducts = vi.fn(async (_p?: any) => ({ data: [UNO], total: 1 }))
vi.mock('../../api/inventario', () => ({ getProducts: (p?: any) => getProducts(p) }))

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
  // El código de barras se pinta después de traer los artículos.
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

  it('pinta el código de barras, no un recuadro vacío', async () => {
    await render('?formato=hoja-24&copias=1')
    const img = host.querySelector('img')
    expect(img?.getAttribute('src')).toMatch(/^data:image\//)
  })

  it('muestra el precio', async () => {
    await render('?formato=hoja-24&copias=1')
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

describe('traer los artículos', () => {
  /**
   * El listado topa el límite en 500 por página. Se pedían 2000 de un golpe: el
   * servidor respondía 400 y el error se tragaba, así que la hoja decía «No hay
   * etiquetas que imprimir» con el inventario lleno. Y aunque el límite lo
   * permitiera, 1,584 artículos no caben en una página.
   */
  it('nunca pide más de lo que el servidor admite', async () => {
    await render('?formato=hoja-24&copias=1')
    for (const llamada of getProducts.mock.calls) {
      const limite = Number((llamada[0] as any)?.limit ?? 0)
      expect(limite).toBeLessThanOrEqual(500)
    }
  })

  it('recorre las páginas hasta traerlos todos', async () => {
    const pagina = (desde: number, cuantos: number) => ({
      data: Array.from({ length: cuantos }, (_, i) => ({
        ...UNO, id: `a-${desde + i}`, sku: `SKU-${desde + i}`,
      })),
      total: 600,
    })
    getProducts
      .mockResolvedValueOnce(pagina(1, 500) as any)
      .mockResolvedValueOnce(pagina(501, 100) as any)

    await render('?formato=hoja-24&copias=1')

    expect(getProducts).toHaveBeenCalledTimes(2)
    expect(host.querySelectorAll('.etiqueta')).toHaveLength(600)
  })

  it('si el servidor falla, lo dice: no finge que no hay artículos', async () => {
    getProducts.mockRejectedValueOnce({
      response: { status: 400, data: { error: { message: 'limit must not be greater than 500' } } },
    })

    await render('?formato=hoja-24&copias=1')

    expect(host.textContent).toContain('No se pudieron traer los artículos')
    expect(host.textContent).toContain('limit must not be greater than 500')
  })
})
