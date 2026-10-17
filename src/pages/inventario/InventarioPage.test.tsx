import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InventarioPage from './InventarioPage'

/**
 * El listado de inventario, con lo que el dueño reportó al cargar su primer
 * artículo: el ojo no abría nada, no había forma de bajar lo ya creado, y la
 * tabla mostraba siete columnas fijas de los veintiséis campos que tiene un
 * artículo.
 */
const ARTICULO = {
  id: 'a-1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE',
  itemType: 'bien', usageType: 'both', unit: 'UND', category: 'Papelería',
  stockOnHand: 1, averageCost: 0, salesPrice: 23,
  isInventoriable: true, isActive: true, barCodes: ['ABA-GRAN'],
}

vi.mock('../../api/inventario', () => ({
  getProducts: vi.fn(async () => ({ data: [ARTICULO], total: 1 })),
  ITEM_TYPE_CONFIG:  { bien: { label: 'Bien', color: '#1faec2' } },
  USAGE_TYPE_CONFIG: { both: { label: 'Compra y venta', color: '#2ea172' } },
}))
vi.mock('../../api/catalogo',    () => ({ getAccounts: vi.fn(async () => []) }))
vi.mock('../../api/impuestos',   () => ({ getTaxes: vi.fn(async () => []) }))
vi.mock('../../api/expedientes', () => ({ getGrupos: vi.fn(async () => []) }))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let descargado: { nombre: string; bytes: number } | null = null

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/inventario']}>
        <Routes>
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/inventario/:id" element={<div data-destino="detalle" />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

const click = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise(r => setTimeout(r, 20)) })
}

const boton = (texto: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(texto))

const encabezados = () =>
  Array.from(host.querySelectorAll('thead th')).map(th => th.textContent?.trim() ?? '')

beforeEach(() => {
  descargado = null
  localStorage.clear()
  ;(globalThis.URL as any).createObjectURL = (b: Blob) => {
    descargado = { nombre: '', bytes: (b as any).size ?? 0 }
    return 'blob:prueba'
  }
  ;(globalThis.URL as any).revokeObjectURL = () => {}
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (descargado) descargado.nombre = this.download
  }
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('ver el detalle del artículo', () => {
  /**
   * Esta prueba fija a DÓNDE navega el ojo. Que esa ruta esté registrada vive
   * en App.tsx y no se verifica aquí: el fallo que reportó el dueño fue
   * justamente que `/inventario/:id` no existía en el enrutador.
   */
  it('el ojo navega al detalle del artículo', async () => {
    await render()
    const ojo = Array.from(host.querySelectorAll('tbody button'))
      .find(b => b.querySelector('.anticon-eye'))
    expect(ojo).toBeTruthy()

    await click(ojo!)

    // Si la ruta no estuviera registrada, el listado seguiría en pantalla.
    expect(document.querySelector('[data-destino="detalle"]')).toBeTruthy()
  })
})

describe('descargar los artículos ya creados', () => {
  it('ofrece el botón junto al de etiquetas', async () => {
    await render()
    expect(boton('Descargar artículos')).toBeTruthy()
  })

  it('baja un .xlsx con contenido', async () => {
    await render()
    await click(boton('Descargar artículos')!)

    expect(descargado?.nombre).toMatch(/\.xlsx$/)
    expect(descargado?.bytes ?? 0).toBeGreaterThan(2000)
  })
})

describe('elegir qué columnas ver', () => {
  it('al entrar muestra las de siempre', async () => {
    await render()
    const cols = encabezados()
    expect(cols).toContain('SKU')
    expect(cols).toContain('Precio venta')
  })

  it('las columnas de detalle vienen ocultas, para que la tabla sea legible', async () => {
    await render()
    expect(encabezados()).not.toContain('Código de barras')
  })

  it('el selector de columnas está disponible', async () => {
    await render()
    expect(boton('Columnas')).toBeTruthy()
  })

  it('recuerda la elección entre visitas', async () => {
    localStorage.setItem('inventario.columnas',
      JSON.stringify(['SKU', 'Nombre', 'Código de barras']))

    await render()

    const cols = encabezados()
    expect(cols).toContain('Código de barras')
    expect(cols).not.toContain('Precio venta')
  })

  it('«Acciones» no se puede quitar: sin ella la fila no se abre', async () => {
    localStorage.setItem('inventario.columnas', JSON.stringify(['SKU']))

    await render()

    expect(encabezados()).toContain('Acciones')
  })

  it('el código de barras avisa cuando el artículo no tiene', async () => {
    localStorage.setItem('inventario.columnas',
      JSON.stringify(['SKU', 'Código de barras']))
    const { getProducts } = await import('../../api/inventario')
    vi.mocked(getProducts).mockResolvedValueOnce(
      { data: [{ ...ARTICULO, barCodes: [] }], total: 1 } as any)

    await render()

    expect(host.textContent).toContain('Sin código')
  })
})

describe('las columnas salen de los campos reales del artículo', () => {
  /**
   * El dueño pidió no suponer: las columnas se arman leyendo lo que el artículo
   * guarda de verdad (src/api/inventario.ts › Product), no lo que uno imagine
   * que debería tener.
   */
  const ver = async (columnas: string[]) => {
    localStorage.setItem('inventario.columnas', JSON.stringify(columnas))
    await render()
  }

  it('precio de compra', async () => {
    await ver(['SKU', 'Precio compra'])
    expect(encabezados()).toContain('Precio compra')
    expect(host.textContent).toContain('Q 0.00')
  })

  it('cuenta de ingresos, con su código y nombre', async () => {
    await ver(['SKU', 'Cuenta de ingresos'])
    expect(encabezados()).toContain('Cuenta de ingresos')
  })

  it('cuenta de inventario', async () => {
    await ver(['SKU', 'Cuenta de inventario'])
    expect(encabezados()).toContain('Cuenta de inventario')
  })

  it('un artículo sin cuenta de ingresos se marca: la factura no se contabilizaría', async () => {
    await ver(['SKU', 'Cuenta de ingresos'])
    expect(host.textContent).toContain('Sin cuenta')
  })

  it('un servicio no necesita cuenta de inventario: dice N/A, no «sin cuenta»', async () => {
    const { getProducts } = await import('../../api/inventario')
    vi.mocked(getProducts).mockResolvedValueOnce(
      { data: [{ ...ARTICULO, isInventoriable: false }], total: 1 } as any)

    await ver(['SKU', 'Cuenta de inventario'])

    expect(host.textContent).toContain('N/A')
  })

  it('están disponibles los demás campos que el artículo guarda', async () => {
    await render()
    const boton = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Columnas'))!
    await click(boton)

    const texto = document.body.textContent ?? ''
    for (const campo of ['Descripción', 'Trazabilidad', 'Grupo', 'Impuesto ventas',
                         'Cuenta de costo', 'Último costo', 'Stock mínimo', 'Peso (lb)']) {
      expect(texto).toContain(campo)
    }
  })
})

describe('reordenar las columnas', () => {
  /**
   * Las columnas se mostraban siempre en el orden del código. El usuario tiene
   * que poder ponerlas como las lee: si trabaja con cuentas, que vayan antes
   * que el stock.
   */
  it('respeta el orden guardado, no el del código', async () => {
    localStorage.setItem('inventario.columnas',
      JSON.stringify(['Precio venta', 'Nombre', 'SKU']))

    await render()

    const cols = encabezados().filter(c => c !== 'Acciones' && c !== '')
    expect(cols).toEqual(['Precio venta', 'Nombre', 'SKU'])
  })

  it('al activar una columna, se agrega al final del orden', async () => {
    localStorage.setItem('inventario.columnas', JSON.stringify(['SKU', 'Nombre']))
    await render()

    await click(boton('Columnas')!)
    const casilla = Array.from(document.querySelectorAll('.ant-dropdown input[type="checkbox"]'))
      .find(c => c.closest('label')?.textContent?.includes('Precio compra'))
    await click(casilla!)

    const cols = encabezados().filter(c => c !== 'Acciones' && c !== '')
    expect(cols[cols.length - 1]).toBe('Precio compra')
  })

  it('las opciones del selector se pueden arrastrar', async () => {
    await render()
    await click(boton('Columnas')!)

    const arrastrables = document.querySelectorAll('.ant-dropdown [draggable="true"]')
    expect(arrastrables.length).toBeGreaterThan(0)
  })
})

describe('valor en existencia', () => {
  /**
   * El valor del inventario es cantidad × COSTO PROMEDIO, que es el método de
   * valoración configurado y lo que respalda el saldo de la cuenta 130001. Con
   * el precio de compra —que es un dato maestro, no el costo de lo que hay en
   * bodega— la columna diría una cosa y el balance otra.
   *
   * Existencia con costo en cero no es un cero legítimo: es inventario sin
   * costo, y hay que verlo antes de que llegue al balance.
   */
  const conStockYCosto = async (stockOnHand: number, averageCost: number) => {
    const { getProducts } = await import('../../api/inventario')
    vi.mocked(getProducts).mockResolvedValueOnce(
      { data: [{ ...ARTICULO, stockOnHand, averageCost, purchasePrice: 17 }], total: 1 } as any)
    localStorage.setItem('inventario.columnas',
      JSON.stringify(['SKU', 'Valor en existencia']))
    await render()
  }

  it('es cantidad por costo promedio', async () => {
    await conStockYCosto(3, 17)
    expect(host.textContent).toContain('Q 51.00')
  })

  it('con existencia y costo en cero, avisa en vez de mostrar un Q 0.00 mudo', async () => {
    await conStockYCosto(1, 0)
    expect(host.textContent).toContain('Sin costo')
  })

  it('sin existencia, un cero es un cero legítimo', async () => {
    await conStockYCosto(0, 0)
    expect(host.textContent).toContain('Q 0.00')
    expect(host.textContent).not.toContain('Sin costo')
  })

  it('no usa el precio de compra: el balance se arma con el costo promedio', async () => {
    await conStockYCosto(1, 0)
    expect(host.textContent).not.toContain('Q 17.00')
  })
})
