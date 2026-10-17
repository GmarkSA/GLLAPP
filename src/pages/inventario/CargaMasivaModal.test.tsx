import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act, useEffect } from 'react'
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
  // La captura va en un efecto: asignar durante el render es un efecto
  // secundario y el render puede repetirse.
  const UploadEspia = (props: any) => {
    useEffect(() => { subir = props.beforeUpload }, [props.beforeUpload])
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

describe('confirmar la carga', () => {
  /**
   * El Select de AntD abre con mousedown, no con click: en jsdom un click
   * sintético no despliega las opciones y la prueba parecía fallar por la
   * pantalla cuando era por el arnés.
   */
  const elegirGrupo = async () => {
    // El primer Select del paso 2 es el de grupo de artículos.
    const selector = document.querySelectorAll('.ant-select')[0]!
    await act(async () => {
      selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    await esperar()
    const opcion = Array.from(document.querySelectorAll('.ant-select-item-option'))
      .find(o => o.textContent?.includes('Papelería'))!
    await act(async () => {
      opcion.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await esperar()
  }

  const conGrupo = async () => {
    await render()
    await subirArchivo()
    await elegirGrupo()
  }

  it('crea los artículos con el grupo elegido', async () => {
    await conGrupo()
    await click(boton('Cargar 3 artículos')!)

    expect(cargaMasivaArticulos).toHaveBeenCalled()
    const [, opciones] = cargaMasivaArticulos.mock.calls[0] as any[]
    expect(opciones.grupoId).toBe('g1')
  })

  it('después carga la existencia con la fecha de contabilización', async () => {
    await conGrupo()
    await click(boton('Cargar 3 artículos')!)

    expect(importSaldos).toHaveBeenCalled()
    const [dto] = importSaldos.mock.calls[0] as any[]
    expect(dto.fechaContabilizacion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('manda la existencia y el costo de cada fila', async () => {
    await conGrupo()
    await click(boton('Cargar 3 artículos')!)

    const [dto] = importSaldos.mock.calls[0] as any[]
    const abaco = dto.items.find((i: any) => i.sku === 'ABA-GRAN')
    expect(abaco.quantity).toBe(1)
    expect(abaco.unitCost).toBe(17)
  })

  it('los artículos van PRIMERO y los saldos después', async () => {
    await conGrupo()
    await click(boton('Cargar 3 artículos')!)

    expect(cargaMasivaArticulos.mock.invocationCallOrder[0])
      .toBeLessThan(importSaldos.mock.invocationCallOrder[0])
  })

  it('al terminar dice el número de la póliza de apertura', async () => {
    await conGrupo()
    await click(boton('Cargar 3 artículos')!)

    expect(document.body.textContent).toContain('POL-00001')
    expect(document.body.textContent).toContain('Diarios')
  })

  it('si el servidor rechaza filas, las lista con su motivo', async () => {
    cargaMasivaArticulos.mockResolvedValueOnce({
      creados: 2, actualizados: 0, omitidos: 0,
      errores: [{ fila: 3, sku: 'ABAC-JOC-KREA', nombre: 'ABACO',
        motivo: 'No se pudo resolver la cuenta de inventario.' }],
      avisos: [],
    } as any)

    await conGrupo()
    await click(boton('Cargar 3 artículos')!)

    expect(document.body.textContent).toContain('1 filas NO se importaron')
    expect(document.body.textContent).toContain('cuenta de inventario')
  })
})
