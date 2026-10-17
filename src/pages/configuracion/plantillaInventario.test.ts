import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { construirPlantillaInventario, leerArchivoDeArticulos, COLUMNAS_PLANTILLA } from './plantillaInventario'

/**
 * La plantilla Excel de la carga de inventario.
 *
 * El dueño pidió que el modelo se descargue desde Cargas Iniciales y que lleve
 * la MISMA información que las tres pestañas del artículo — Identificación;
 * Ventas, compra e inventario; POS y otros—. Si falta un campo, el artículo
 * entra incompleto y hay que abrirlo uno por uno después, que es justo lo que
 * una carga masiva viene a evitar.
 *
 * La plantilla se arma con las cuentas, impuestos y grupos REALES del cliente,
 * no con ejemplos: así nadie tiene que adivinar que su cuenta de ingresos es
 * la 410001 ni que su impuesto de ventas se llama PC-V01.
 */
const CATALOGO = {
  cuentas: [
    { code: '130001', name: 'Inventario de Mercaderías' },
    { code: '410001', name: 'Ventas Gravadas' },
    { code: '520001', name: 'Costo de Mercaderías Vendidas' },
    { code: '540001', name: 'Variaciones de Inventario' },
  ],
  impuestos: [
    { code: 'PC-V01', name: 'Venta de bienes — registrada sin IVA', rate: 0 },
    { code: 'PC-C01', name: 'Compra de bienes (IVA no acreditable)', rate: 12 },
  ],
  grupos:    [{ code: 'PAP', name: 'Papelería' }],
  unidades:  ['UND', 'CAJA', 'YARDA'],
  almacenes: [{ code: 'PRIN', name: 'Bodega Principal' }],
}

const hojas = () => {
  const wb = XLSX.read(construirPlantillaInventario(CATALOGO), { type: 'array' })
  return { wb, nombres: wb.SheetNames }
}

const filasDe = (nombre: string) => {
  const { wb } = hojas()
  return XLSX.utils.sheet_to_json<any>(wb.Sheets[nombre], { defval: '' })
}

describe('la plantilla de carga de inventario', () => {
  it('trae una hoja de artículos', () => {
    expect(hojas().nombres).toContain('Artículos')
  })

  it('trae las instrucciones de cada columna', () => {
    expect(hojas().nombres).toContain('Instrucciones')
  })

  describe('lleva los campos de las tres pestañas del artículo', () => {
    const columnas = () => Object.keys(filasDe('Artículos')[0] ?? {})

    it('Identificación: nombre, SKU, tipo, uso, unidad, grupo, categoría, marca, descripción', () => {
      const c = columnas()
      for (const campo of ['nombre', 'sku', 'tipo_articulo', 'uso', 'unidad',
                           'grupo', 'categoria', 'marca', 'descripcion']) {
        expect(c).toContain(campo)
      }
    })

    it('Ventas y compra: precios, cuentas e impuestos', () => {
      const c = columnas()
      for (const campo of ['precio_venta', 'cuenta_ingresos', 'impuesto_ventas',
                           'precio_compra', 'cuenta_costo', 'impuesto_compras', 'moneda']) {
        expect(c).toContain(campo)
      }
    })

    it('Inventario: control de stock, cuentas, costos y existencia', () => {
      const c = columnas()
      for (const campo of ['lleva_stock', 'cuenta_inventario', 'cuenta_ajustes',
                           'costo_promedio', 'existencia_actual', 'punto_reorden',
                           'categoria_inventario', 'trazabilidad', 'peso']) {
        expect(c).toContain(campo)
      }
    })

    it('POS y otros: el código de barras del lector', () => {
      expect(columnas()).toContain('codigo_barras')
    })
  })

  describe('el modelo trae los datos reales del cliente, no ejemplos', () => {
    it('una hoja con sus cuentas contables', () => {
      const filas = filasDe('Cuentas')
      expect(filas.some(f => String(f.codigo) === '410001')).toBe(true)
      expect(filas.some(f => String(f.codigo) === '540001')).toBe(true)
    })

    it('una hoja con sus impuestos, por código', () => {
      const filas = filasDe('Impuestos')
      expect(filas.some(f => String(f.codigo) === 'PC-V01')).toBe(true)
      expect(filas.some(f => String(f.codigo) === 'PC-C01')).toBe(true)
    })

    it('una hoja con sus grupos y unidades', () => {
      expect(hojas().nombres).toContain('Listas')
    })
  })

  describe('la fila de ejemplo', () => {
    it('viene llena, para que se vea qué poner en cada columna', () => {
      const [ejemplo] = filasDe('Artículos')
      expect(String(ejemplo.nombre)).not.toBe('')
      expect(String(ejemplo.cuenta_ingresos)).toBe('410001')
    })

    it('usa el impuesto del régimen del cliente', () => {
      const [ejemplo] = filasDe('Artículos')
      expect(String(ejemplo.impuesto_ventas)).toBe('PC-V01')
    })
  })
})

describe('leer el archivo que sube el usuario', () => {
  const archivoCon = (filas: any[]) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Artículos')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  it('lee un Excel con las columnas de la plantilla', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { sku: 'ABA-GRAN', nombre: 'ABACO BACO GRANDE', unidad: 'UN',
        precio_compra: 17, precio_venta: 23, cuenta_ingresos: '410001' },
    ]))

    expect(filas).toHaveLength(1)
    expect(filas[0].sku).toBe('ABA-GRAN')
    expect(filas[0].costo).toBe(17)
    expect(filas[0].precioVenta).toBe(23)
    expect(filas[0].cuentaIngresosCodigo).toBe('410001')
  })

  it('acepta los encabezados tal como los exporta Zoho', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { 'SKU': 'ACUA-FAST', 'Nombre': 'ACUARELA FAST 12 COLORES',
        'Unidad de medida': 'UN', 'Costo Zoho FIFO (GTQ)': 9.75,
        'Precio de venta (GTQ)': 18.5 },
    ]))

    expect(filas[0].sku).toBe('ACUA-FAST')
    expect(filas[0].nombre).toBe('ACUARELA FAST 12 COLORES')
    expect(filas[0].costo).toBe(9.75)
    expect(filas[0].precioVenta).toBe(18.5)
  })

  it('«Sí» y «No» se leen como interruptores, no como texto', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { sku: 'SERV-1', nombre: 'EMPAQUE', lleva_stock: 'No' },
    ]))
    expect(filas[0].inventariable).toBe(false)
  })

  it('ignora las filas vacías que deja Excel al final', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { sku: 'A-1', nombre: 'UNO' },
      { sku: '',    nombre: '' },
      { sku: '',    nombre: '' },
    ]))
    expect(filas).toHaveLength(1)
  })

  it('un archivo sin columnas conocidas lo dice, en vez de devolver filas vacías', () => {
    expect(() => leerArchivoDeArticulos(archivoCon([{ cosa: 1, otra: 2 }])))
      .toThrow(/columna/i)
  })

  it('la lista de columnas es la misma que usa la plantilla', () => {
    expect(COLUMNAS_PLANTILLA.map(c => c.clave)).toContain('nombre')
    expect(COLUMNAS_PLANTILLA.find(c => c.clave === 'nombre')!.requerida).toBe(true)
  })
})
