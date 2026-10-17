import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
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

  it('conserva la plantilla CSV de saldos, que ya se usaba', async () => {
    await render()
    await abrirInventario()
    expect(boton('Plantilla CSV')).toBeTruthy()
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
