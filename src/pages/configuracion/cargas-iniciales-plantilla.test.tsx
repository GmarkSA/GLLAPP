import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as XLSX from 'xlsx'
import CargasInicialesPage from './CargasInicialesPage'

/**
 * El botón de la plantilla en Cargas Iniciales › Inventario.
 *
 * La plantilla Excel existía y estaba probada, pero el botón seguía
 * descargando el CSV viejo de cuatro columnas (sku, nombre, cantidad,
 * costo_unitario): servía para el saldo, no para crear el artículo. El dueño
 * lo descubrió al descargarla después de aprobar el PR.
 *
 * Esta prueba fija el cableado: que el botón esté, que arme el .xlsx y que
 * pida el catálogo de la empresa para meterlo dentro.
 */
const getAccounts = vi.fn(async () => ([
  { code: '130001', name: 'Inventario de Mercaderías', isActive: true },
  { code: '410001', name: 'Ventas Gravadas',           isActive: true },
  { code: '520001', name: 'Costo de Mercaderías Vendidas', isActive: true },
  { code: '540001', name: 'Variaciones de Inventario', isActive: true },
]))
const getTaxes = vi.fn(async () => ([
  { code: 'PC-V01', name: 'Venta de bienes — registrada sin IVA', rate: 0 },
  { code: 'PC-C01', name: 'Compra de bienes (IVA no acreditable)', rate: 12 },
]))
const getGrupos = vi.fn(async () => ([{ code: 'PAP', name: 'Papelería' }]))

vi.mock('../../api/catalogo', () => ({
  getAccounts: () => getAccounts(),
  setSaldosApertura: vi.fn(),
}))
vi.mock('../../api/impuestos', () => ({ getTaxes: () => getTaxes() }))
vi.mock('../../api/expedientes', () => ({
  getAlmacenes: vi.fn(async () => [{ id: 'w1', code: 'PRIN', name: 'Bodega Principal' }]),
  getGrupos: () => getGrupos(),
}))
vi.mock('../../api/inventario', () => ({
  getProducts: vi.fn(async () => ({ data: [], total: 0 })),
  importSaldosInicialesInventario: vi.fn(),
}))
vi.mock('../../api/contactos', () => ({
  batchImportClientes: vi.fn(), batchImportProveedores: vi.fn(),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let descargado: { nombre: string; bytes: number } | null = null

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter><CargasInicialesPage /></MemoryRouter>)
  })
}

const click = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await act(async () => { await Promise.resolve() })
}

const boton = (texto: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(texto))

/** Abre el panel de Inventario, que viene plegado. */
const abrirInventario = async () => {
  const cabecera = Array.from(document.querySelectorAll('.ant-collapse-header'))
    .find(h => h.textContent?.includes('Inventario'))
  if (cabecera) await click(cabecera)
}

beforeEach(() => {
  descargado = null
  getAccounts.mockClear(); getTaxes.mockClear(); getGrupos.mockClear()
  // El navegador de pruebas no descarga: se intercepta para ver qué se generó.
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

describe('Cargas Iniciales › Inventario', () => {
  it('ofrece la plantilla Excel', async () => {
    await render()
    await abrirInventario()
    expect(boton('Descargar plantilla Excel')).toBeTruthy()
  })

  it('la plantilla Excel es la única: el CSV de 4 columnas se quitó', async () => {
    await render()
    await abrirInventario()
    expect(boton('Descargar plantilla Excel')).toBeTruthy()
    expect(boton('Plantilla CSV')).toBeUndefined()
  })

  it('al descargarla pide las cuentas, impuestos y grupos de la empresa', async () => {
    await render()
    await abrirInventario()
    await click(boton('Descargar plantilla Excel')!)

    expect(getAccounts).toHaveBeenCalled()
    expect(getTaxes).toHaveBeenCalled()
    expect(getGrupos).toHaveBeenCalled()
  })

  it('descarga un archivo .xlsx con contenido, no un CSV vacío', async () => {
    await render()
    await abrirInventario()
    await click(boton('Descargar plantilla Excel')!)

    expect(descargado?.nombre).toMatch(/\.xlsx$/)
    expect(descargado?.bytes ?? 0).toBeGreaterThan(2000)
  })

  it('acepta subir Excel, no solo CSV', async () => {
    await render()
    await abrirInventario()
    const entradas = Array.from(document.querySelectorAll('input[type="file"]'))
    expect(entradas.some(e => (e as HTMLInputElement).accept.includes('xlsx'))).toBe(true)
  })
})

describe('Cargas Iniciales › Inventario — el archivo manda', () => {
  it('ya no ofrece la plantilla CSV de solo saldos', async () => {
    await render()
    await abrirInventario()
    expect(boton('Plantilla CSV')).toBeUndefined()
  })

  it('el botón de subir habla de Excel, que es lo que se descarga', async () => {
    await render()
    await abrirInventario()
    expect(boton('Subir archivo Excel')).toBeTruthy()
  })

  it('explica que la columna del archivo manda sobre el almacén destino', async () => {
    await render()
    await abrirInventario()
    const texto = document.body.textContent ?? ''
    expect(texto).toContain('manda sobre esta selección')
  })
})

describe('el paso «Revisar» enseña qué se leyó del archivo', () => {
  /**
   * El dueño subió su archivo y la carga terminó con «Fila 1: SKU 'ABA-GRAN'
   * no encontrado» y nada más: ni qué columna se leyó mal, ni qué dato no se
   * estaba leyendo, ni qué hacer al respecto. Ahora el paso de revisión
   * muestra columna por columna lo que entendió, con el tipo de dato y un
   * ejemplo del propio archivo.
   */
  const archivo = (filas: any[]) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Artículos')
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return new File([bytes], 'inventario.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  const FILA = {
    nombre: 'ABACO BACO GRANDE', sku: 'ABA-GRAN',
    precio_venta: 23, precio_compra: 17, existencia_actual: 2,
  }

  /** Sube el archivo por el mismo camino que el botón de la pantalla. */
  const subir = async (filas: any[]) => {
    await render()
    await abrirInventario()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeTruthy()
    const f = archivo(filas)
    Object.defineProperty(input, 'files', { value: [f], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
  }

  it('llega al paso de revisión con el archivo leído', async () => {
    await subir([FILA])
    expect(document.body.textContent).toContain('Qué leyó Lucía de tu archivo')
  })

  it('dice cuántas columnas reconoció', async () => {
    await subir([FILA])
    expect(document.body.textContent).toMatch(/\d+ columnas reconocidas/)
  })

  it('avisa que el artículo no existe, en vez de fallar al final sin decir por qué', async () => {
    await subir([FILA])
    expect(document.body.textContent).toContain('no existen todavía en Lucía')
  })

  it('y dice dónde crearlos: esta carga solo registra el saldo', async () => {
    await subir([FILA])
    expect(document.body.textContent).toContain('Cargar inventario')
  })

  it('las filas sin existencia se avisan, no se descartan en silencio', async () => {
    await subir([FILA, { ...FILA, sku: 'SIN-STOCK', existencia_actual: 0 }])
    expect(document.body.textContent).toContain('no traen existencia')
  })
})

describe('el panel de columnas se ve sin tener que abrirlo', () => {
  /**
   * El panel existía pero venía plegado, así que el usuario seguía sin saber
   * qué estaba leyendo del archivo. Tiene que verse de entrada.
   */
  const subirUno = async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { nombre: 'ABACO BACO GRANDE', sku: 'ABA-GRAN', precio_venta: 23, existencia_actual: 2 },
    ]), 'Artículos')
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    await render()
    await abrirInventario()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File([bytes], 'inv.xlsx')], configurable: true,
    })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
  }

  it('la tabla de columnas ya está desplegada', async () => {
    await subirUno()
    expect(document.body.textContent).toContain('Columna del archivo')
  })

  it('y muestra el campo de Lucía al que corresponde cada una', async () => {
    await subirUno()
    expect(document.body.textContent).toContain('Campo en Lucía')
  })

  it('con el tipo de dato que espera', async () => {
    await subirUno()
    expect(document.body.textContent).toContain('Moneda Q')
  })

  it('y el valor que trae el archivo, para ver que se está llenando', async () => {
    await subirUno()
    expect(document.body.textContent).toContain('Se está llenando')
  })
})
