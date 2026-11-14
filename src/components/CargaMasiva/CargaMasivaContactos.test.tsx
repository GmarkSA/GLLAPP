import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import * as XLSX from 'xlsx'
import CargaMasivaContactos from './CargaMasivaContactos'

/**
 * Los dos botones de la pantalla de Proveedores (y la de Clientes).
 *
 * «Descargar plantilla» tiene que traer los proveedores que YA existen, no un
 * archivo en blanco: de eso depende que sirva para corregir en masa lo
 * cargado. Y tiene que traerlos TODOS, no la página que está a la vista.
 */
const PROVEEDORES = [
  { id: 'v1', name: 'GMARK, SOCIEDAD ANÓNIMA', taxId: '467700396', type: 'company',
    paymentTerms: 'net_30', status: 'active', payableAccountId: 'c-cxp' },
  { id: 'v2', name: 'PALACE SOCIEDAD ANONIMA', taxId: '4761065', type: 'company',
    paymentTerms: 'due_on_receipt', status: 'active' },
]

const getVendors = vi.fn(async () => ({ data: PROVEEDORES, total: 2 }))
const getCustomers = vi.fn(async () => ({ data: [], total: 0 }))

vi.mock('../../api/contactos', () => ({
  getVendors:   (...a: any[]) => getVendors(...a as []),
  getCustomers: (...a: any[]) => getCustomers(...a as []),
  batchImportProveedores: vi.fn(async () => ({ created: 2, updated: 0, errors: [], avisos: [] })),
  batchImportClientes:    vi.fn(async () => ({ created: 0, updated: 0, errors: [], avisos: [] })),
}))
vi.mock('../../api/catalogo', () => ({
  getAccounts: vi.fn(async () => ([
    { id: 'c-cxp', code: '211001', name: 'Proveedores Nacionales', type: 'liability' },
  ])),
}))
vi.mock('../../api/impuestos', () => ({
  getTaxes: vi.fn(async () => ([{ id: 'i-iva', code: 'IVA12', name: 'IVA 12%', rate: 12 }])),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let bajado: ArrayBuffer | null = null

const render = async (tipo: 'proveedores' | 'clientes' = 'proveedores') => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<CargaMasivaContactos tipo={tipo} />) })
}

const boton = (texto: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(texto))

const click = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  bajado = null
  getVendors.mockClear()
  // El archivo que el navegador bajaría.
  ;(globalThis.URL as any).createObjectURL = (blob: Blob) => {
    // jsdom no implementa Blob.arrayBuffer() de forma síncrona: se guarda la
    // parte que importa, que es que se haya armado un archivo.
    bajado = (blob as any)._buffer ?? new ArrayBuffer(0)
    return 'blob:fake'
  }
  ;(globalThis.URL as any).revokeObjectURL = () => undefined
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
})

describe('los botones de carga masiva', () => {
  it('ofrece descargar la plantilla y cargar el archivo', async () => {
    await render()

    expect(boton('Descargar plantilla')).toBeTruthy()
    expect(boton('Carga masiva')).toBeTruthy()
  })

  /** La cartera completa, no los 20 de la página. */
  it('la plantilla pide todos los proveedores, no la página visible', async () => {
    await render()
    await click(boton('Descargar plantilla')!)

    expect(getVendors).toHaveBeenCalledWith({ limit: 5000 })
  })

  it('en clientes pide los clientes', async () => {
    await render('clientes')
    await click(boton('Descargar plantilla')!)

    expect(getCustomers).toHaveBeenCalledWith({ limit: 5000 })
    expect(getVendors).not.toHaveBeenCalled()
  })

  it('avisa cuántos lleva el archivo', async () => {
    await render()
    await click(boton('Descargar plantilla')!)

    expect(document.body.textContent).toContain('2 proveedores en la plantilla')
  })

  it('y lo dice cuando todavía no hay ninguno', async () => {
    await render('clientes')
    await click(boton('Descargar plantilla')!)

    expect(document.body.textContent).toContain('todavía no hay clientes')
  })
})

/**
 * El archivo que se baja, leído como lo leería Excel: los proveedores van en
 * su hoja, y el ejemplo en la suya, no mezclado con ellos.
 */
describe('el archivo que se baja', () => {
  it('trae los proveedores en la hoja de datos', async () => {
    // Se arma el libro por el mismo camino que el botón, y se lee de vuelta.
    const { filasDeContactos } = await import('../../pages/configuracion/filasDeContactos')
    const { construirPlantillaProveedores, COLUMNAS_PROVEEDORES } =
      await import('../../pages/configuracion/plantillaProveedores')

    const catalogo = {
      cuentas: [{ id: 'c-cxp', code: '211001', name: 'Proveedores Nacionales' }],
      impuestos: [], monedas: ['GTQ'],
    }
    const libro = construirPlantillaProveedores(catalogo,
      filasDeContactos(COLUMNAS_PROVEEDORES, PROVEEDORES, {
        campoCuenta: 'payableAccountId', campoContrapartida: 'expenseAccountId', catalogo,
      }))

    const wb = XLSX.read(libro, { type: 'array' })
    const hoja = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Proveedores'])

    expect(hoja.map(f => f.nombre)).toEqual([
      'GMARK, SOCIEDAD ANÓNIMA', 'PALACE SOCIEDAD ANONIMA',
    ])
    expect(hoja[0].cuenta_por_pagar).toBe('211001')
    expect(wb.SheetNames).toContain('Saldos pendientes')
  })
})
