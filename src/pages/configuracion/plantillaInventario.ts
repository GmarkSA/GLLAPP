import * as XLSX from 'xlsx'

/**
 * La plantilla Excel de la carga masiva de inventario.
 *
 * Lleva los campos de las tres pestañas del artículo —Identificación; Ventas,
 * compra e inventario; POS y otros— porque un artículo que entra incompleto
 * hay que abrirlo uno por uno después, que es justo lo que la carga viene a
 * evitar.
 *
 * El modelo se arma con las cuentas, impuestos, grupos y unidades REALES del
 * cliente, no con ejemplos inventados: así nadie tiene que adivinar que su
 * cuenta de ingresos es la 410001 ni que su impuesto se llama PC-V01.
 */

export interface CatalogoDeLaEmpresa {
  cuentas:   Array<{ code: string; name: string }>
  impuestos: Array<{ code: string; name: string; rate?: number }>
  grupos:    Array<{ code: string; name: string }>
  unidades:  string[]
  almacenes: Array<{ code: string; name: string }>
}

export interface ColumnaDePlantilla {
  clave:      string
  titulo:     string
  requerida:  boolean
  pestana:    'Identificación' | 'Ventas, compra e inventario' | 'POS y otros'
  ayuda:      string
  /** Nombres que puede traer esa columna en un archivo de otro sistema. */
  alias?:     string[]
}

export const COLUMNAS_PLANTILLA: ColumnaDePlantilla[] = [
  // ── Pestaña 1 · Identificación ─────────────────────────────────────────────
  { clave: 'nombre', titulo: 'nombre', requerida: true, pestana: 'Identificación',
    ayuda: 'Nombre del artículo. Es el único campo obligatorio junto con el precio.',
    alias: ['Nombre', 'Nombre del artículo', 'Item Name', 'Descripción del producto'] },
  { clave: 'sku', titulo: 'sku', requerida: false, pestana: 'Identificación',
    ayuda: 'Código del artículo. Si se deja vacío, Lucía genera uno correlativo.',
    alias: ['SKU', 'Código', 'Codigo', 'Item Code', 'SKU / Código'] },
  { clave: 'tipo_articulo', titulo: 'tipo_articulo', requerida: false, pestana: 'Identificación',
    ayuda: 'bien (producto físico) o servicio. Por omisión: bien.',
    alias: ['Tipo de artículo', 'Tipo'] },
  { clave: 'uso', titulo: 'uso', requerida: false, pestana: 'Identificación',
    ayuda: 'compra_venta, solo_venta o solo_compra. Por omisión: compra_venta.',
    alias: ['Uso'] },
  { clave: 'unidad', titulo: 'unidad', requerida: false, pestana: 'Identificación',
    ayuda: 'Unidad de medida. «UN» se guarda como UND. Ver la hoja Listas.',
    alias: ['Unidad de medida', 'Unidad', 'Usage unit', 'UoM'] },
  { clave: 'grupo', titulo: 'grupo', requerida: false, pestana: 'Identificación',
    ayuda: 'Código del grupo de artículos. De él salen las cuentas por defecto.',
    alias: ['Grupo', 'Grupo de artículos'] },
  { clave: 'categoria', titulo: 'categoria', requerida: false, pestana: 'Identificación',
    ayuda: 'Familia o categoría, libre.',
    alias: ['Familia / Categoría', 'Categoría', 'Categoria', 'Category'] },
  { clave: 'marca', titulo: 'marca', requerida: false, pestana: 'Identificación',
    ayuda: 'Marca del artículo, libre.',
    alias: ['Marca', 'Brand'] },
  { clave: 'descripcion', titulo: 'descripcion', requerida: false, pestana: 'Identificación',
    ayuda: 'Descripción detallada, libre.',
    alias: ['Descripción', 'Descripcion', 'Description'] },

  // ── Pestaña 2 · Ventas, compra e inventario ────────────────────────────────
  { clave: 'moneda', titulo: 'moneda', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'GTQ por omisión.', alias: ['Moneda', 'Currency'] },
  { clave: 'precio_venta', titulo: 'precio_venta', requerida: true, pestana: 'Ventas, compra e inventario',
    ayuda: 'Precio de venta SIN impuesto.',
    alias: ['Precio de venta (GTQ)', 'Precio de venta', 'Rate', 'Selling Price'] },
  { clave: 'cuenta_ingresos', titulo: 'cuenta_ingresos', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de ingresos. Si se deja vacío, se toma la del grupo.',
    alias: ['Cuenta de ingresos', 'Cuenta de ingresos (ventas)'] },
  { clave: 'impuesto_ventas', titulo: 'impuesto_ventas', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código del impuesto de ventas. Vacío = el artículo no lleva impuesto.',
    alias: ['Impuesto de ventas', 'Tax'] },
  { clave: 'precio_compra', titulo: 'precio_compra', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Costo de compra. Es también el costo promedio de arranque.',
    alias: ['Costo Zoho FIFO (GTQ)', 'Precio de compra', 'Costo', 'Purchase Rate', 'Cost Price'] },
  { clave: 'cuenta_costo', titulo: 'cuenta_costo', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de costo de ventas (COGS).',
    alias: ['Cuenta de costo de ventas (COGS)', 'Cuenta de costo'] },
  { clave: 'impuesto_compras', titulo: 'impuesto_compras', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código del impuesto de compras.',
    alias: ['Impuesto de compras'] },
  { clave: 'lleva_stock', titulo: 'lleva_stock', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Sí / No. Un servicio va en No y entonces no necesita cuentas de inventario ni costo.',
    alias: ['¿Lleva control de stock?', 'Lleva stock', 'Inventariable'] },
  { clave: 'categoria_inventario', titulo: 'categoria_inventario', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Producto terminado, Materia prima, etc.', alias: ['Categoría de inventario'] },
  { clave: 'trazabilidad', titulo: 'trazabilidad', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'ninguno, lote o serie. Por omisión: ninguno.', alias: ['Control de trazabilidad'] },
  { clave: 'cuenta_inventario', titulo: 'cuenta_inventario', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de inventario (Activo).',
    alias: ['Cuenta de inventario', 'Cuenta de inventario (Activo)'] },
  { clave: 'cuenta_ajustes', titulo: 'cuenta_ajustes', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de ajustes de inventario.',
    alias: ['Cuenta de ajustes de inventario', 'Cuenta de ajustes'] },
  { clave: 'costo_promedio', titulo: 'costo_promedio', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Si se deja vacío se usa el precio de compra.', alias: ['Costo promedio', 'Costo promedio (Q)'] },
  { clave: 'existencia_actual', titulo: 'existencia_actual', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Cantidad en existencia. NO entra con los artículos: entra por la carga de saldos iniciales, que genera su póliza.',
    alias: ['Cantidad', 'Existencia actual', 'Stock on Hand', 'Quantity'] },
  { clave: 'punto_reorden', titulo: 'punto_reorden', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Nivel de alerta de bajo stock.', alias: ['Punto de reorden', 'Reorder Point'] },
  { clave: 'peso', titulo: 'peso', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Peso por unidad, en libras.', alias: ['Peso', 'Peso (lb)', 'Weight'] },

  // ── Pestaña 3 · POS y otros ────────────────────────────────────────────────
  { clave: 'codigo_barras', titulo: 'codigo_barras', requerida: false, pestana: 'POS y otros',
    ayuda: 'Código que lee el escáner del POS. Si se deja vacío se usa el SKU.',
    alias: ['Código de barras', 'Codigo de barras', 'Barcode', 'EAN', 'UPC'] },
]

const SI = new Set(['si', 'sí', 's', 'yes', 'y', 'true', '1', 'verdadero'])
const NO = new Set(['no', 'n', 'false', '0', 'falso'])

const texto = (v: unknown) => String(v ?? '').trim()

const numero = (v: unknown): number | undefined => {
  const limpio = texto(v).replace(/[^0-9.\-]/g, '')
  if (!limpio) return undefined
  const n = Number(limpio)
  return Number.isFinite(n) ? n : undefined
}

const interruptor = (v: unknown): boolean | undefined => {
  const t = texto(v).toLowerCase()
  if (!t) return undefined
  if (SI.has(t)) return true
  if (NO.has(t)) return false
  return undefined
}

/** El índice de encabezados reconocidos: el de la plantilla y sus alias. */
const indiceDeEncabezados = (): Map<string, string> => {
  const indice = new Map<string, string>()
  const normal = (s: string) => s.trim().toLowerCase()
  for (const col of COLUMNAS_PLANTILLA) {
    indice.set(normal(col.clave), col.clave)
    indice.set(normal(col.titulo), col.clave)
    for (const alias of col.alias ?? []) indice.set(normal(alias), col.clave)
  }
  return indice
}

/** Una fila lista para el backend, con los nombres que espera la carga. */
export interface FilaDeArticulo {
  sku?: string
  nombre?: string
  descripcion?: string
  unidad?: string
  categoria?: string
  marca?: string
  costo?: number
  precioVenta?: number
  codigoBarras?: string
  inventariable?: boolean
  existencia?: number
  puntoReorden?: number
  peso?: number
  grupoCodigo?: string
  cuentaIngresosCodigo?: string
  cuentaCostoCodigo?: string
  cuentaInventarioCodigo?: string
  cuentaAjustesCodigo?: string
  impuestoVentasCodigo?: string
  impuestoComprasCodigo?: string
  moneda?: string
  tipoArticulo?: string
  uso?: string
  categoriaInventario?: string
  trazabilidad?: string
}

/**
 * Lee el archivo que sube el usuario —Excel o CSV— y lo deja normalizado.
 *
 * Reconoce los encabezados de la plantilla y también los que exporta Zoho, para
 * que el archivo se pueda subir tal como sale del otro sistema.
 */
export function leerArchivoDeArticulos(datos: ArrayBuffer | Uint8Array): FilaDeArticulo[] {
  const wb = XLSX.read(datos, { type: 'array' })
  const hoja = wb.Sheets[wb.SheetNames.find(n => /art[ií]culo/i.test(n)) ?? wb.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja con datos.')

  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
  const indice = indiceDeEncabezados()

  const encabezadosConocidos = new Set<string>()
  for (const encabezado of Object.keys(crudas[0] ?? {})) {
    const clave = indice.get(encabezado.trim().toLowerCase())
    if (clave) encabezadosConocidos.add(clave)
  }
  if (encabezadosConocidos.size === 0) {
    throw new Error(
      'No se reconoció ninguna columna del archivo. Descarga la plantilla y usa sus encabezados, ' +
      'o renombra las columnas de tu archivo para que coincidan.',
    )
  }

  const filas: FilaDeArticulo[] = []
  for (const cruda of crudas) {
    const v: Record<string, unknown> = {}
    for (const [encabezado, valor] of Object.entries(cruda)) {
      const clave = indice.get(encabezado.trim().toLowerCase())
      if (clave) v[clave] = valor
    }
    // Excel arrastra filas vacías al final del rango; una fila sin nombre ni
    // SKU no es un artículo a medias, es relleno.
    if (!texto(v.nombre) && !texto(v.sku)) continue

    filas.push({
      sku:          texto(v.sku) || undefined,
      nombre:       texto(v.nombre) || undefined,
      descripcion:  texto(v.descripcion) || undefined,
      unidad:       texto(v.unidad) || undefined,
      categoria:    texto(v.categoria) || undefined,
      marca:        texto(v.marca) || undefined,
      costo:        numero(v.precio_compra) ?? numero(v.costo_promedio),
      precioVenta:  numero(v.precio_venta),
      codigoBarras: texto(v.codigo_barras) || undefined,
      inventariable: interruptor(v.lleva_stock),
      existencia:   numero(v.existencia_actual),
      puntoReorden: numero(v.punto_reorden),
      peso:         numero(v.peso),
      grupoCodigo:            texto(v.grupo) || undefined,
      cuentaIngresosCodigo:   texto(v.cuenta_ingresos) || undefined,
      cuentaCostoCodigo:      texto(v.cuenta_costo) || undefined,
      cuentaInventarioCodigo: texto(v.cuenta_inventario) || undefined,
      cuentaAjustesCodigo:    texto(v.cuenta_ajustes) || undefined,
      impuestoVentasCodigo:   texto(v.impuesto_ventas) || undefined,
      impuestoComprasCodigo:  texto(v.impuesto_compras) || undefined,
      moneda:                 texto(v.moneda) || undefined,
      tipoArticulo:           texto(v.tipo_articulo) || undefined,
      uso:                    texto(v.uso) || undefined,
      categoriaInventario:    texto(v.categoria_inventario) || undefined,
      trazabilidad:           texto(v.trazabilidad) || undefined,
    })
  }
  return filas
}

/** Arma el archivo .xlsx del modelo con los datos reales de la empresa. */
export function construirPlantillaInventario(catalogo: CatalogoDeLaEmpresa): ArrayBuffer {
  const cuenta = (prefijo: string) =>
    catalogo.cuentas.find(c => c.code.startsWith(prefijo))?.code ?? ''
  const impuesto = (patron: RegExp) =>
    catalogo.impuestos.find(i => patron.test(i.code) || patron.test(i.name))?.code ?? ''

  // Dos filas de ejemplo: una de inventario y una de servicio, que es donde se
  // ve que un servicio no necesita cuentas de inventario ni de costo.
  const ejemplos = [
    {
      nombre: 'ABACO BACO GRANDE', sku: 'ABA-GRAN',
      tipo_articulo: 'bien', uso: 'compra_venta', unidad: 'UND',
      grupo: catalogo.grupos[0]?.code ?? '', categoria: 'Papelería', marca: '',
      descripcion: '',
      moneda: 'GTQ',
      precio_venta: 23, cuenta_ingresos: cuenta('4'), impuesto_ventas: impuesto(/V0|venta/i),
      precio_compra: 17, cuenta_costo: cuenta('5'), impuesto_compras: impuesto(/C0|compra/i),
      lleva_stock: 'Sí', categoria_inventario: 'Producto terminado', trazabilidad: 'ninguno',
      cuenta_inventario: cuenta('13'), cuenta_ajustes: cuenta('54'),
      costo_promedio: 17, existencia_actual: 1, punto_reorden: '', peso: '',
      codigo_barras: 'ABA-GRAN',
    },
    {
      nombre: 'EMPAQUE DE REGALO', sku: 'SERV-EMP',
      tipo_articulo: 'servicio', uso: 'solo_venta', unidad: 'UND',
      grupo: '', categoria: 'Servicios', marca: '', descripcion: '',
      moneda: 'GTQ',
      precio_venta: 15, cuenta_ingresos: cuenta('4'), impuesto_ventas: impuesto(/V0|venta/i),
      precio_compra: '', cuenta_costo: '', impuesto_compras: '',
      lleva_stock: 'No', categoria_inventario: '', trazabilidad: '',
      cuenta_inventario: '', cuenta_ajustes: '',
      costo_promedio: '', existencia_actual: '', punto_reorden: '', peso: '',
      codigo_barras: '',
    },
  ]

  const orden = COLUMNAS_PLANTILLA.map(c => c.titulo)
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(ejemplos, { header: orden }), 'Artículos')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    COLUMNAS_PLANTILLA.map(c => ({
      columna: c.titulo,
      pestaña_en_Lucía: c.pestana,
      obligatoria: c.requerida ? 'Sí' : 'No',
      qué_poner: c.ayuda,
    }))), 'Instrucciones')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    catalogo.cuentas.map(c => ({ codigo: c.code, nombre: c.name }))), 'Cuentas')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    catalogo.impuestos.map(i => ({ codigo: i.code, nombre: i.name, tasa: i.rate ?? '' }))), 'Impuestos')

  const listas = Math.max(
    catalogo.grupos.length, catalogo.unidades.length, catalogo.almacenes.length, 1)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    Array.from({ length: listas }, (_, i) => ({
      grupo:   catalogo.grupos[i] ? `${catalogo.grupos[i].code} — ${catalogo.grupos[i].name}` : '',
      unidad:  catalogo.unidades[i] ?? '',
      almacen: catalogo.almacenes[i] ? `${catalogo.almacenes[i].code} — ${catalogo.almacenes[i].name}` : '',
    }))), 'Listas')

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
