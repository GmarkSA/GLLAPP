import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { construirPlantillaInventario, leerArchivoDeArticulos, exportarArticulos, COLUMNAS_PLANTILLA, analizarArchivoDeArticulos } from './plantillaInventario'

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

describe('exportar los artículos ya creados', () => {
  /**
   * El dueño pidió bajar lo que ya está cargado en el MISMO formato de la
   * plantilla: así revisa en Excel, corrige y vuelve a subir sin traducir
   * columnas a mano.
   */
  const CREADOS = [
    {
      id: '1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE', unit: 'UND',
      salesPrice: 23, purchasePrice: 17, averageCost: 17, stockOnHand: 1,
      isInventoriable: true, barCodes: ['ABA-GRAN'], currency: 'GTQ',
      category: 'Papelería', itemType: 'bien',
    },
    {
      id: '2', sku: 'SERV-EMP', name: 'EMPAQUE DE REGALO', unit: 'UND',
      salesPrice: 15, isInventoriable: false, barCodes: [], currency: 'GTQ',
      itemType: 'servicio',
    },
  ]

  const hojaExportada = () => {
    const wb = XLSX.read(exportarArticulos(CREADOS as any, CATALOGO), { type: 'array' })
    return XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })
  }

  it('baja una fila por artículo', () => {
    expect(hojaExportada()).toHaveLength(2)
  })

  it('usa las mismas columnas que la plantilla', () => {
    const columnas = Object.keys(hojaExportada()[0])
    for (const c of COLUMNAS_PLANTILLA.map(c => c.titulo)) {
      expect(columnas).toContain(c)
    }
  })

  it('trae los datos del artículo, no ejemplos', () => {
    const [primero] = hojaExportada()
    expect(primero.nombre).toBe('ABACO BACO GRANDE')
    expect(Number(primero.precio_venta)).toBe(23)
    expect(Number(primero.precio_compra)).toBe(17)
    expect(primero.codigo_barras).toBe('ABA-GRAN')
  })

  it('el interruptor de stock se exporta como Sí / No', () => {
    const [bien, servicio] = hojaExportada()
    expect(bien.lleva_stock).toBe('Sí')
    expect(servicio.lleva_stock).toBe('No')
  })

  it('lo exportado se puede volver a leer con el mismo lector', () => {
    const datos = exportarArticulos(CREADOS as any, CATALOGO)
    const filas = leerArchivoDeArticulos(datos)
    expect(filas).toHaveLength(2)
    expect(filas[0].sku).toBe('ABA-GRAN')
    expect(filas[0].precioVenta).toBe(23)
  })

  it('conserva las hojas de referencia, para corregir sin adivinar códigos', () => {
    const wb = XLSX.read(exportarArticulos(CREADOS as any, CATALOGO), { type: 'array' })
    expect(wb.SheetNames).toContain('Cuentas')
    expect(wb.SheetNames).toContain('Impuestos')
  })
})

describe('las cuentas del artículo en la exportación', () => {
  /**
   * El artículo guarda los ids de sus cuentas, no los códigos. Sin resolverlos
   * contra el catálogo, las columnas cuenta_ingresos y cuenta_inventario salían
   * VACÍAS: el archivo exportado no se podía volver a subir sin escribirlas a
   * mano, que es justo lo que la ida y vuelta viene a evitar.
   */
  const CON_IDS = [{
    id: '1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE',
    salesPrice: 23, purchasePrice: 17, isInventoriable: true,
    salesAccountId: 'id-410', inventoryAccountId: 'id-130', costAccountId: 'id-520',
  }]

  const CATALOGO_CON_IDS = {
    ...CATALOGO,
    cuentas: [
      { id: 'id-130', code: '130001', name: 'Inventario de Mercaderías' },
      { id: 'id-410', code: '410001', name: 'Ventas Gravadas' },
      { id: 'id-520', code: '520001', name: 'Costo de Mercaderías Vendidas' },
    ],
  }

  const exportadas = () => {
    const wb = XLSX.read(exportarArticulos(CON_IDS as any, CATALOGO_CON_IDS), { type: 'array' })
    return XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })
  }

  it('la cuenta de ingresos sale con su código', () => {
    expect(exportadas()[0].cuenta_ingresos).toBe('410001')
  })

  it('la de inventario también', () => {
    expect(exportadas()[0].cuenta_inventario).toBe('130001')
  })

  it('y la de costo', () => {
    expect(exportadas()[0].cuenta_costo).toBe('520001')
  })

  it('el precio de compra sale como viene del artículo', () => {
    expect(Number(exportadas()[0].precio_compra)).toBe(17)
  })

  it('una cuenta que ya no existe en el catálogo sale vacía, no con el id', () => {
    const wb = XLSX.read(exportarArticulos(
      [{ ...CON_IDS[0], salesAccountId: 'id-borrada' }] as any, CATALOGO_CON_IDS,
    ), { type: 'array' })
    const [fila] = XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })
    expect(fila.cuenta_ingresos).toBe('')
  })
})

describe('qué pasa si el usuario borra columnas de la plantilla', () => {
  /**
   * Pregunta del dueño: las columnas que no llevan valor, ¿las puede borrar sin
   * romper el archivo? El lector mapea por NOMBRE de encabezado, no por
   * posición, así que borrar una columna es lo mismo que dejarla vacía. Esto lo
   * deja fijado.
   */
  const archivoCon = (filas: any[]) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Artículos')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  it('con solo nombre y precio, se lee', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { nombre: 'ABACO BACO GRANDE', precio_venta: 23 },
    ]))
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('ABACO BACO GRANDE')
  })

  it('borrar las columnas de cuentas no rompe nada: las pone el grupo', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { sku: 'ABA-GRAN', nombre: 'ABACO', precio_venta: 23, precio_compra: 17 },
    ]))
    expect(filas[0].cuentaIngresosCodigo).toBeUndefined()
    expect(filas[0].precioVenta).toBe(23)
  })

  it('el orden de las columnas no importa: se mapea por nombre', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { codigo_barras: '750', precio_venta: 23, nombre: 'ABACO', sku: 'ABA-GRAN' },
    ]))
    expect(filas[0].sku).toBe('ABA-GRAN')
    expect(filas[0].codigoBarras).toBe('750')
  })

  it('una columna de más, que Lucía no conoce, se ignora sin quejarse', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { nombre: 'ABACO', precio_venta: 23, mi_columna_propia: 'lo que sea' },
    ]))
    expect(filas).toHaveLength(1)
  })

  it('borrarlas TODAS sí avisa, en vez de devolver filas vacías', () => {
    expect(() => leerArchivoDeArticulos(archivoCon([{ cosa: 1 }])))
      .toThrow(/columna/i)
  })

  it('toda columna de la plantilla la entiende el lector: están homologadas', () => {
    const fila: Record<string, unknown> = {}
    for (const c of COLUMNAS_PLANTILLA) fila[c.titulo] = c.clave === 'nombre' ? 'PRUEBA' : '1'
    const filas = leerArchivoDeArticulos(archivoCon([fila]))
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('PRUEBA')
  })
})

describe('el almacén en la plantilla', () => {
  /**
   * Con más de un almacén no hay forma de decir en cuál entra cada artículo: ni
   * en la pantalla de creación ni en el archivo. La columna lo resuelve, y la
   * hoja «Listas» ya trae los códigos de los almacenes de la empresa.
   */
  const archivoCon = (filas: any[]) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Artículos')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  it('la plantilla trae la columna', () => {
    const wb = XLSX.read(construirPlantillaInventario(CATALOGO), { type: 'array' })
    const [ejemplo] = XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })
    expect(Object.keys(ejemplo)).toContain('almacen')
  })

  it('el ejemplo usa un almacén real de la empresa', () => {
    const wb = XLSX.read(construirPlantillaInventario(CATALOGO), { type: 'array' })
    const [ejemplo] = XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })
    expect(ejemplo.almacen).toBe('PRIN')
  })

  it('el lector lo devuelve por código', () => {
    const filas = leerArchivoDeArticulos(archivoCon([
      { sku: 'ABA-GRAN', nombre: 'ABACO', almacen: 'PRIN' },
    ]))
    expect(filas[0].almacenCodigo).toBe('PRIN')
  })

  it('sin almacén la fila se lee igual: es opcional', () => {
    const filas = leerArchivoDeArticulos(archivoCon([{ sku: 'A', nombre: 'UNO' }]))
    expect(filas[0].almacenCodigo).toBeUndefined()
  })

  it('lo exportado trae el almacén del artículo', () => {
    const datos = exportarArticulos(
      [{ sku: 'A', name: 'UNO', warehouseId: 'w1' }] as any,
      { ...CATALOGO, almacenes: [{ id: 'w1', code: 'PRIN', name: 'Bodega Principal' }] } as any,
    )
    const wb = XLSX.read(datos, { type: 'array' })
    const [fila] = XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })
    expect(fila.almacen).toBe('PRIN')
  })
})

describe('los impuestos, el grupo y el almacén en la exportación', () => {
  /**
   * Lo que reportó el dueño: en la pantalla el artículo muestra PC-V01 y
   * PC-C01, pero el archivo descargado traía las dos columnas de impuesto
   * VACÍAS. El artículo guarda `salesTaxId` / `purchaseTaxId`, y la exportación
   * solo sabía leer un código ya resuelto que el listado nunca manda.
   *
   * Lo mismo pasaba con el grupo (`groupId`) y el almacén (`warehouseId`).
   * Sin esto el archivo exportado no se puede volver a subir: las tres
   * columnas entran vacías y los 1,584 artículos quedan sin impuesto.
   */
  const CATALOGO_COMPLETO = {
    ...CATALOGO,
    cuentas:   [{ id: 'id-410', code: '410001', name: 'Ventas Gravadas' }],
    impuestos: [
      { id: 'id-v', code: 'PC-V01', name: 'Venta de bienes — registrada sin IVA', rate: 0 },
      { id: 'id-c', code: 'PC-C01', name: 'Compra de bienes (IVA no acreditable)', rate: 12 },
    ],
    grupos:    [{ id: 'id-pap', code: 'PAP', name: 'Papelería' }],
    almacenes: [{ id: 'id-alm', code: 'ALM', name: 'BODEGA ALMERIA' }],
  }

  const ARTICULO = {
    sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE', salesPrice: 23, purchasePrice: 17,
    salesTaxId: 'id-v', purchaseTaxId: 'id-c',
    groupId: 'id-pap', warehouseId: 'id-alm',
  }

  const fila = (extra: any = {}) => {
    const wb = XLSX.read(
      exportarArticulos([{ ...ARTICULO, ...extra }] as any, CATALOGO_COMPLETO), { type: 'array' })
    return XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })[0]
  }

  it('el impuesto de ventas sale con su código', () => {
    expect(fila().impuesto_ventas).toBe('PC-V01')
  })

  it('y el de compras', () => {
    expect(fila().impuesto_compras).toBe('PC-C01')
  })

  it('el grupo sale con su código, no con el id', () => {
    expect(fila().grupo).toBe('PAP')
  })

  it('el almacén también', () => {
    expect(fila().almacen).toBe('ALM')
  })

  it('un impuesto que ya no existe sale vacío, no con el id', () => {
    expect(fila({ salesTaxId: 'id-borrado' }).impuesto_ventas).toBe('')
  })

  it('sin impuesto de ventas la columna va vacía: el pequeño contribuyente no lo lleva', () => {
    expect(fila({ salesTaxId: undefined }).impuesto_ventas).toBe('')
  })
})

describe('el archivo descargado se puede volver a subir', () => {
  /**
   * La ida y vuelta completa. La exportación escribía los valores internos
   * —`both`, `finished_good`, `none`— y la plantilla documenta los suyos
   * —`compra_venta`, `producto_terminado`, `ninguno`—: el archivo descargado
   * no coincidía con su propia plantilla.
   */
  const CATALOGO_COMPLETO = {
    ...CATALOGO,
    cuentas:   [{ id: 'id-410', code: '410001', name: 'Ventas Gravadas' }],
    impuestos: [{ id: 'id-v', code: 'PC-V01', name: 'Venta', rate: 0 }],
    grupos:    [{ id: 'id-pap', code: 'PAP', name: 'Papelería' }],
    almacenes: [{ id: 'id-alm', code: 'ALM', name: 'BODEGA ALMERIA' }],
  }

  const ARTICULO = {
    sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE', salesPrice: 23, purchasePrice: 17,
    itemType: 'bien', usageType: 'both', itemCategory: 'finished_good',
    trackingType: 'none', isInventoriable: true, salesTaxId: 'id-v',
    groupId: 'id-pap', warehouseId: 'id-alm', unit: 'UND',
  }

  const exportada = () => {
    const wb = XLSX.read(exportarArticulos([ARTICULO] as any, CATALOGO_COMPLETO), { type: 'array' })
    return XLSX.utils.sheet_to_json<any>(wb.Sheets['Artículos'], { defval: '' })[0]
  }
  const releida = () =>
    leerArchivoDeArticulos(exportarArticulos([ARTICULO] as any, CATALOGO_COMPLETO))[0]

  it('«uso» se escribe como lo documenta la plantilla, no como lo guarda la base', () => {
    expect(exportada().uso).toBe('compra_venta')
  })

  it('«categoria_inventario» también', () => {
    expect(exportada().categoria_inventario).toBe('producto_terminado')
  })

  it('y «trazabilidad»', () => {
    expect(exportada().trazabilidad).toBe('ninguno')
  })

  it('al releerlo, el uso vuelve a ser el que entiende el sistema', () => {
    expect(releida().uso).toBe('both')
  })

  it('la categoría de inventario también', () => {
    expect(releida().categoriaInventario).toBe('finished_good')
  })

  it('y la trazabilidad', () => {
    expect(releida().trazabilidad).toBe('none')
  })

  it('el impuesto y el almacén sobreviven la vuelta', () => {
    const r = releida()
    expect(r.impuestoVentasCodigo).toBe('PC-V01')
    expect(r.almacenCodigo).toBe('ALM')
  })

  it('un archivo con los valores internos sigue cargando: no se rompe lo ya descargado', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { nombre: 'X', uso: 'both', categoria_inventario: 'finished_good', trazabilidad: 'none' },
    ]), 'Artículos')
    const [r] = leerArchivoDeArticulos(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
    expect(r.uso).toBe('both')
    expect(r.categoriaInventario).toBe('finished_good')
    expect(r.trazabilidad).toBe('none')
  })

  it('y uno escrito a mano en español llano también', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { nombre: 'X', uso: 'Compra y venta', categoria_inventario: 'Producto terminado', trazabilidad: 'Lote' },
    ]), 'Artículos')
    const [r] = leerArchivoDeArticulos(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
    expect(r.uso).toBe('both')
    expect(r.categoriaInventario).toBe('finished_good')
    expect(r.trazabilidad).toBe('lot')
  })
})

describe('ver qué entendió Lucía del archivo', () => {
  /**
   * Lo que pidió el dueño: que antes de cargar se vea que las columnas se
   * están llenando con la información del archivo —como hace Zoho al
   * importar—, con el tipo de cada una: si es moneda, si es texto.
   *
   * El error que recibió decía «SKU no encontrado» y nada más: ni qué columna
   * se leyó mal, ni qué dato no se estaba leyendo.
   */
  const archivo = (filas: any[]) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Artículos')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  }

  const analisis = (filas: any[]) => analizarArchivoDeArticulos(archivo(filas))
  const columna  = (filas: any[], encabezado: string) =>
    analisis(filas).columnas.find(c => c.encabezado === encabezado)

  const FILA = {
    nombre: 'ABACO BACO GRANDE', sku: 'ABA-GRAN', precio_venta: 23,
    precio_compra: 17, existencia_actual: 2, lleva_stock: 'Sí',
    uso: 'compra_venta', almacen: 'ALM',
  }

  it('dice cuántas filas trae el archivo', () => {
    expect(analisis([FILA, { ...FILA, sku: 'OTRO' }]).filas).toBe(2)
  })

  it('reconoce la columna de la plantilla', () => {
    expect(columna([FILA], 'precio_venta')?.reconocida).toBe(true)
  })

  it('y dice a qué campo de Lucía corresponde', () => {
    expect(columna([FILA], 'precio_venta')?.titulo).toBe('precio_venta')
  })

  it('un precio se declara como moneda', () => {
    expect(columna([FILA], 'precio_venta')?.tipo).toBe('moneda')
  })

  it('una cantidad como número', () => {
    expect(columna([FILA], 'existencia_actual')?.tipo).toBe('numero')
  })

  it('un nombre como texto', () => {
    expect(columna([FILA], 'nombre')?.tipo).toBe('texto')
  })

  it('«lleva_stock» como sí/no', () => {
    expect(columna([FILA], 'lleva_stock')?.tipo).toBe('si_no')
  })

  it('«uso» como opción de una lista', () => {
    expect(columna([FILA], 'uso')?.tipo).toBe('opcion')
  })

  it('muestra un ejemplo del propio archivo, para ver que se está llenando', () => {
    expect(columna([FILA], 'nombre')?.ejemplo).toBe('ABACO BACO GRANDE')
  })

  it('una columna que no es de la plantilla se marca, no se calla', () => {
    const c = columna([{ ...FILA, color_favorito: 'azul' }], 'color_favorito')
    expect(c?.reconocida).toBe(false)
  })

  it('un precio que no es número se señala: ahí está el dato que no se lee', () => {
    const c = columna([{ ...FILA, precio_venta: 'veintitrés' }], 'precio_venta')
    expect(c?.problema).toMatch(/número|numero/i)
  })

  it('una opción que no existe también', () => {
    const c = columna([{ ...FILA, uso: 'alquiler' }], 'uso')
    expect(c?.problema).toMatch(/alquiler/)
  })

  it('un precio con formato de moneda —Q y comas— es válido', () => {
    const c = columna([{ ...FILA, precio_venta: 'Q 1,234.50' }], 'precio_venta')
    expect(c?.problema).toBeUndefined()
  })

  it('una columna vacía en todas las filas se avisa: no va a llenar nada', () => {
    const c = columna([{ ...FILA, marca: '' }], 'marca')
    expect(c?.vacia).toBe(true)
  })

  it('las columnas obligatorias que faltan se listan aparte', () => {
    const r = analizarArchivoDeArticulos(archivo([{ sku: 'X', precio_venta: 1 }]))
    expect(r.faltantes).toContain('nombre')
  })

  it('si están todas, no falta ninguna', () => {
    expect(analizarArchivoDeArticulos(archivo([FILA])).faltantes).toHaveLength(0)
  })
})
