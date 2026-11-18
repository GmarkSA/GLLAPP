import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fechaQuePropone } from './CargaMasivaContactos'
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
 * Subir el archivo de LUUM: 52 filas sin NIT, diez nombres repetidos y dos que
 * ya existen. La pantalla tiene que decirlo ANTES de importar.
 */
describe('al subir un archivo, la revisión se ve antes de importar', () => {
  const archivoDePrueba = () => {
    const filas = [
      { nombre: 'Punto AG El Campo', saldo_inicial: 50.10, notas: '701188696' },
      { nombre: 'Punto AG El Campo', saldo_inicial: 60.20, notas: '1897549401' },
      { nombre: 'GMARK, SOCIEDAD ANÓNIMA', saldo_inicial: 100 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(filas, { header: ['nombre', 'saldo_inicial', 'notas'] }),
      'Proveedores')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  const subir = async () => {
    const entrada = host.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([archivoDePrueba()], 'Proveedores.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    // jsdom no deja asignar `files`: se define a mano, que es lo que lee rc-upload.
    Object.defineProperty(entrada, 'files', { value: [file], configurable: true })
    await act(async () => { entrada.dispatchEvent(new Event('change', { bubbles: true })) })
    for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() })
  }

  it('avisa de las filas sin NIT y de los nombres repetidos', async () => {
    await render()
    await subir()

    const texto = document.body.textContent ?? ''
    expect(texto).toContain('sin NIT')
    expect(texto).toContain('Punto AG El Campo')
    expect(texto).toContain('2 filas')
  })

  it('y suma el saldo inicial que entraría', async () => {
    await render()
    await subir()

    expect(document.body.textContent).toContain('210.30')
  })

  /** Un contacto con saldo suelto en quetzales no inventa moneda ni tasa. */
  it('el saldo suelto deja vacías la moneda y la tasa', async () => {
    await render()
    await subir()

    const celdas = [...document.querySelectorAll('.ant-table-tbody tr')]
      .map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent?.trim()))
    const fila = celdas.find(c => c.some(x => x?.includes('GMARK')))!

    expect(fila).toContain('—')
    expect(fila.some(c => c?.startsWith('Q 100.00'))).toBe(true)
  })
})

/**
 * La cartera en dólares, en la pantalla de revisión.
 *
 * Cuando el saldo viene por documentos, la columna `saldo_inicial` va vacía y
 * la pantalla mostraba «—»: los dos proveedores de LUUM parecían entrar sin
 * nada, cuando entraban USD 3,265.48. Hay que ver las tres cosas: lo que debe
 * en su moneda, a qué tasa y cuánto es en quetzales.
 */
describe('un archivo con saldos en dólares', () => {
  const archivoEnDolares = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { nombre: 'The Conscious Home, LLC', nit: 'CF' },
      { nombre: 'ALEJANDRO , TORUN ENGELBERG', nit: '41555384' },
    ], { header: ['nombre', 'nit'] }), 'Proveedores')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { nit: 'CF',       documento: 'INV-016944', monto: 772.50,  moneda: 'USD', tipo_cambio: 7.664504854 },
      { nit: 'CF',       documento: 'INV-017523', monto: 750,     moneda: 'USD', tipo_cambio: 7.664506667 },
      { nit: 'CF',       documento: 'INV-017524', monto: 280,     moneda: 'USD', tipo_cambio: 7.6645 },
      { nit: 'CF',       documento: 'INV-017525', monto: 280,     moneda: 'USD', tipo_cambio: 7.6645 },
      { nit: '41555384', documento: '3205384016', monto: 0.70,    moneda: 'USD', tipo_cambio: 7.671428571 },
      { nit: 'CF',       documento: '318-2025-00022636', monto: 1182.28, moneda: 'USD', tipo_cambio: 7.675855127 },
    ], { header: ['nit', 'documento', 'monto', 'moneda', 'tipo_cambio'] }), 'Saldos pendientes')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  const subirDolares = async () => {
    const entrada = host.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([archivoEnDolares()], 'Proveedores USD.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    Object.defineProperty(entrada, 'files', { value: [file], configurable: true })
    await act(async () => { entrada.dispatchEvent(new Event('change', { bubbles: true })) })
    for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() })
  }

  it('muestra el monto en dólares y su conversión a quetzales', async () => {
    await render()
    await subirDolares()

    const texto = document.body.textContent ?? ''
    expect(texto).toContain('USD 3,264.78')
    expect(texto).toContain('25,036.34')
  })

  /**
   * Cada dato en su columna: con sesenta proveedores, todo junto en una celda
   * no se puede recorrer con la vista ni comparar un monto con el de abajo.
   */
  it('en tres columnas: moneda, tasa y quetzales', async () => {
    await render()
    await subirDolares()

    const encabezados = [...document.querySelectorAll('.ant-table-thead th')]
      .map(th => th.textContent?.trim())
    expect(encabezados).toContain('Saldo en su moneda')
    expect(encabezados).toContain('Tipo de cambio')
    expect(encabezados).toContain('Saldo en Q')
  })

  /** Un NIT escrito distinto en las dos hojas deja documentos sin dueño. */
  it('avisa de los documentos que no corresponden a ningún contacto', async () => {
    await render()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      [{ nombre: 'Proveedor A', nit: '111' }], { header: ['nombre', 'nit'] }), 'Proveedores')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      [{ nit: '222', documento: 'FAC-1', monto: 100, moneda: 'GTQ' }],
      { header: ['nit', 'documento', 'monto', 'moneda'] }), 'Saldos pendientes')
    const entrada = host.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer],
      'x.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    Object.defineProperty(entrada, 'files', { value: [file], configurable: true })
    await act(async () => { entrada.dispatchEvent(new Event('change', { bubbles: true })) })
    for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() })

    expect(document.body.textContent).toContain('no corresponden a ningún contacto')
  })

  it('cada fila lleva sus tres valores separados', async () => {
    await render()
    await subirDolares()

    const celdas = [...document.querySelectorAll('.ant-table-tbody tr')]
      .map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent?.trim()))
    const llc = celdas.find(c => c.some(x => x?.includes('Conscious')))!

    expect(llc).toContain('USD 3,264.78')
    expect(llc).toContain('7.664500 – 7.675855')
    expect(llc.some(c => c?.startsWith('Q 25,036.34'))).toBe(true)
  })


  it('con el tipo de cambio de cada contacto', async () => {
    await render()
    await subirDolares()

    const texto = document.body.textContent ?? ''
    expect(texto).toContain('7.664500 – 7.675855')   // las cinco facturas de la LLC
    expect(texto).toContain('7.671429')              // la única de Torun
  })

  /** El total no se revisa: se revisan las facturas que lo forman. */
  it('abre el detalle de los documentos de un contacto', async () => {
    await render()
    await subirDolares()

    const expandir = [...document.querySelectorAll('.ant-table-row-expand-icon')]
    expect(expandir.length).toBe(2)                     // uno por contacto

    await act(async () => {
      expandir[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => { await Promise.resolve() })

    const texto = document.body.textContent ?? ''
    expect(texto).toContain('INV-016944')
    expect(texto).toContain('INV-017523')
    expect(texto).toContain('318-2025-00022636')
    expect(texto).toContain('7.664505')                 // la tasa de esa factura
    expect(texto).toContain('5,920.83')                 // 772.50 × 7.664504854
  })


  /**
   * Son dos fechas distintas y la pantalla tiene que distinguirlas: la del
   * documento es trazabilidad y no se toca; la de contabilización es con la
   * que la póliza entra al mayor.
   */
  it('se pide aparte de la fecha de cada documento', async () => {
    await render()
    await subirDolares()

    const texto = document.body.textContent ?? ''
    expect(texto).toContain('Fecha de contabilización')
    expect(texto).toContain('Cada documento conserva la suya')
  })

  it('el detalle dice que esa fecha es la del documento', async () => {
    await render()
    await subirDolares()

    const expandir = [...document.querySelectorAll('.ant-table-row-expand-icon')]
    await act(async () => {
      expandir[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => { await Promise.resolve() })

    expect(document.body.textContent).toContain('Fecha del documento')
  })

  it('y el total de los seis documentos', async () => {
    await render()
    await subirDolares()

    expect(document.body.textContent).toContain('6 documento(s) pendientes — Q 25,041.71')
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


/**
 * La fecha de la póliza de apertura.
 *
 * Esta pantalla no mandaba ninguna, así que el servidor fechaba la póliza HOY:
 * los saldos en dólares de LUUM —una migración al 31/12/2025— entraron al
 * balance con fecha 18/11/2026, en otro ejercicio. La POL-00128 salió así.
 */
describe('qué fecha se propone para la apertura', () => {
  it('la del saldo inicial de los contactos, la más reciente', () => {
    const f = fechaQuePropone([
      { fecha_saldo_inicial: '2025-12-31' },
      { fecha_saldo_inicial: '2025-06-30' },
    ], [])

    expect(f?.format('YYYY-MM-DD')).toBe('2025-12-31')
  })

  /** Cuando el saldo viene por documentos, los contactos no traen fecha. */
  it('si no la traen, la del último documento', () => {
    const f = fechaQuePropone([{ nombre: 'X' }], [
      { fecha: '2024-07-01' }, { fecha: '2025-12-01' }, { fecha: '2025-09-29' },
    ])

    expect(f?.format('YYYY-MM-DD')).toBe('2025-12-01')
  })

  it('la de los contactos manda sobre la de los documentos', () => {
    const f = fechaQuePropone([{ fecha_saldo_inicial: '2025-12-31' }], [{ fecha: '2024-07-01' }])

    expect(f?.format('YYYY-MM-DD')).toBe('2025-12-31')
  })

  /** Nunca «hoy» en silencio: sin fecha en el archivo, la elige el usuario. */
  it('sin ninguna fecha en el archivo, no propone nada', () => {
    expect(fechaQuePropone([{ nombre: 'X' }], [])).toBeNull()
  })
})

describe('la fecha viaja al servidor', () => {
  const archivoConFecha = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      [{ nombre: 'Proveedor A', nit: '111', saldo_inicial: 500, fecha_saldo_inicial: '31/12/2025' }],
      { header: ['nombre', 'nit', 'saldo_inicial', 'fecha_saldo_inicial'] }), 'Proveedores')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  it('la carga manda la fecha del archivo, no la de hoy', async () => {
    const { batchImportProveedores } = await import('../../api/contactos')
    vi.mocked(batchImportProveedores).mockClear()

    await render()
    const entrada = host.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([archivoConFecha()], 'x.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    Object.defineProperty(entrada, 'files', { value: [file], configurable: true })
    await act(async () => { entrada.dispatchEvent(new Event('change', { bubbles: true })) })
    for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() })

    const importar = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Importar'))!
    await act(async () => { importar.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve() })

    expect(vi.mocked(batchImportProveedores).mock.calls[0][1]).toBe('2025-12-31')
  })
})
