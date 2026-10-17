import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import * as XLSX from 'xlsx'
import CargaMasivaModal from './CargaMasivaModal'

/**
 * La carga masiva de punta a punta.
 *
 * Son dos pasos que van en orden y no se pueden invertir: primero los artículos
 * —con sus cuentas e impuestos— y después la existencia, que es la que genera
 * la póliza de apertura. Meter el stock en el primer paso dejaría inventario en
 * bodega sin contabilidad.
 */
const cargaMasivaArticulos = vi.fn(async () => ({
  creados: 3, actualizados: 0, omitidos: 0, errores: [], avisos: [],
}))
const importSaldos = vi.fn(async () => ({
  ajusteId: 'aj-1', created: 3, errors: [],
  journalEntryId: 'je-1', entryNumber: 'POL-00001',
}))

vi.mock('../../api/inventario', () => ({
  cargaMasivaArticulos: (...a: any[]) => (cargaMasivaArticulos as any)(...a),
  importSaldosInicialesInventario: (...a: any[]) => (importSaldos as any)(...a),
  getProducts: vi.fn(async () => ({
    data: [
      { id: 'p1', sku: 'ABA-GRAN' },
      { id: 'p2', sku: 'ACUA-FAST' },
      { id: 'p3', sku: 'ABAC-JOC-KREA' },
    ],
    total: 3,
  })),
}))
vi.mock('../../api/expedientes', () => ({
  getGrupos:    vi.fn(async () => [{ id: 'g1', code: 'PAP', name: 'Papelería' }]),
  getAlmacenes: vi.fn(async () => [{ id: 'w1', code: 'PRIN', name: 'Bodega Principal' }]),
}))
vi.mock('../../api/impuestos', () => ({
  getTaxes: vi.fn(async () => [{ id: 't1', code: 'PC-V01', name: 'Venta sin IVA', rate: 0 }]),
}))
vi.mock('../../api/catalogo', () => ({
  getAccounts: vi.fn(async () => [{ id: 'c1', code: '410001', name: 'Ventas Gravadas' }]),
}))

/** Tres filas del archivo real de la librería */
const ARCHIVO = () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { 'SKU': 'ABA-GRAN', 'Nombre': 'ABACO BACO GRANDE', 'Unidad de medida': 'UN',
      'Cantidad': 1, 'Costo Zoho FIFO (GTQ)': 17, 'Precio de venta (GTQ)': 23 },
    { 'SKU': 'ACUA-FAST', 'Nombre': 'ACUARELA FAST 12 COLORES', 'Unidad de medida': 'UN',
      'Cantidad': 5, 'Costo Zoho FIFO (GTQ)': 9.75, 'Precio de venta (GTQ)': 18.5 },
    { 'SKU': 'ABAC-JOC-KREA', 'Nombre': 'ABACO JOCAR PEQ KREA', 'Unidad de medida': 'UN',
      'Cantidad': 6, 'Costo Zoho FIFO (GTQ)': 7.75, 'Precio de venta (GTQ)': 10 },
  ]), 'Artículos')
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return {
    name: 'inventario.xlsx',
    arrayBuffer: async () => bytes,
  } as unknown as File
}

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let subir: ((f: File) => any) | null = null

/**
 * Captura el beforeUpload del Upload de AntD: en jsdom no se puede soltar un
 * archivo de verdad, y lo que importa probar es qué hace la pantalla con él.
 */
vi.mock('antd', async () => {
  const real = await vi.importActual<any>('antd')
  const UploadReal = real.Upload
  const UploadEspia = (props: any) => {
    subir = props.beforeUpload
    return <UploadReal {...props} />
  }
  Object.assign(UploadEspia, UploadReal)
  return { ...real, Upload: UploadEspia }
})

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<CargaMasivaModal open onClose={() => {}} onCargado={() => {}} />) })
}

const esperar = async (ms = 30) => {
  await act(async () => { await new Promise(r => setTimeout(r, ms)) })
}

const click = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await esperar()
}

const boton = (texto: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(texto))

const subirArchivo = async () => {
  await act(async () => { await subir!(ARCHIVO()) })
  await esperar()
}

beforeEach(() => {
  subir = null
  cargaMasivaArticulos.mockClear()
  importSaldos.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('subir el archivo', () => {
  it('lee el export de Zoho tal como sale', async () => {
    await render()
    await subirArchivo()

    expect(document.body.textContent).toContain('3 artículos listos')
  })

  it('dice cuánto vale el inventario que se va a cargar', async () => {
    await render()
    await subirArchivo()

    // 1×17 + 5×9.75 + 6×7.75 = 112.25
    expect(document.body.textContent).toContain('112.25')
  })

  it('muestra las filas para revisarlas antes de confirmar', async () => {
    await render()
    await subirArchivo()

    expect(document.body.textContent).toContain('ABACO BACO GRANDE')
    expect(document.body.textContent).toContain('ACUARELA FAST 12 COLORES')
  })

  it('pide la fecha de contabilización antes de cargar', async () => {
    await render()
    await subirArchivo()

    expect(document.body.textContent).toContain('Fecha de contabilización')
  })

  it('no deja cargar sin elegir grupo: de ahí salen las cuentas', async () => {
    await render()
    await subirArchivo()

    expect(boton('Cargar 3 artículos')?.hasAttribute('disabled')).toBe(true)
  })
})

/**
 * PENDIENTE: las pruebas de confirmar la carga necesitan manejar el Select de
 * AntD en jsdom, que no responde al click sintético. El recorrido de subida sí
 * queda cubierto arriba; la confirmación está verificada en el backend
 * (inventario-carga-masiva y inventario-saldo-inicial-contabiliza) pero NO
 * desde esta pantalla.
 */
