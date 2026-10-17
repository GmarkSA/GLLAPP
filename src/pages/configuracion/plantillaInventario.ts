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
  /** El `id` permite resolver lo que el artículo guarda por id, no por código. */
  cuentas:   Array<{ id?: string; code: string; name: string }>
  impuestos: Array<{ id?: string; code: string; name: string; rate?: number }>
  grupos:    Array<{ id?: string; code: string; name: string }>
  unidades:  string[]
  almacenes: Array<{ id?: string; code: string; name: string }>
}

/** Para que el usuario vea, antes de cargar, qué se espera en cada columna. */
export type TipoDeColumna = 'texto' | 'moneda' | 'numero' | 'si_no' | 'opcion'

export interface ColumnaDePlantilla {
  clave:      string
  titulo:     string
  requerida:  boolean
  /** Qué clase de dato lleva. Por omisión, texto. */
  tipo?:      TipoDeColumna
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
  { clave: 'tipo_articulo', titulo: 'tipo_articulo', requerida: false, tipo: 'opcion', pestana: 'Identificación',
    ayuda: 'bien (producto físico) o servicio. Por omisión: bien.',
    alias: ['Tipo de artículo', 'Tipo'] },
  { clave: 'uso', titulo: 'uso', requerida: false, tipo: 'opcion', pestana: 'Identificación',
    ayuda: 'compra_venta, solo_venta o solo_compra. Por omisión: compra_venta.',
    alias: ['Uso'] },
  { clave: 'unidad', titulo: 'unidad', requerida: false, pestana: 'Identificación',
    ayuda: 'Unidad de medida. «UN» se guarda como UND. Ver la hoja Listas.',
    alias: ['Unidad de medida', 'Unidad', 'Usage unit', 'UoM'] },
  { clave: 'grupo', titulo: 'grupo', requerida: false, pestana: 'Identificación',
    ayuda: 'Código del grupo de artículos. De él salen las cuentas por defecto.',
    alias: ['Grupo', 'Grupo de artículos'] },
  { clave: 'almacen', titulo: 'almacen', requerida: false, pestana: 'Identificación',
    ayuda: 'Código del almacén donde se guarda. Con más de uno, sin esto no se sabe dónde entra. Ver la hoja Listas.',
    alias: ['Almacén', 'Almacen', 'Bodega', 'Warehouse'] },
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
  { clave: 'precio_venta', titulo: 'precio_venta', requerida: true, tipo: 'moneda', pestana: 'Ventas, compra e inventario',
    ayuda: 'Precio de venta SIN impuesto.',
    alias: ['Precio de venta (GTQ)', 'Precio de venta', 'Rate', 'Selling Price'] },
  { clave: 'cuenta_ingresos', titulo: 'cuenta_ingresos', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de ingresos. Si se deja vacío, se toma la del grupo.',
    alias: ['Cuenta de ingresos', 'Cuenta de ingresos (ventas)'] },
  { clave: 'impuesto_ventas', titulo: 'impuesto_ventas', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código del impuesto de ventas. Vacío = el artículo no lleva impuesto.',
    alias: ['Impuesto de ventas', 'Tax'] },
  { clave: 'precio_compra', titulo: 'precio_compra', requerida: false, tipo: 'moneda', pestana: 'Ventas, compra e inventario',
    ayuda: 'Costo de compra. Es también el costo promedio de arranque.',
    alias: ['Costo Zoho FIFO (GTQ)', 'Precio de compra', 'Costo', 'Purchase Rate', 'Cost Price'] },
  { clave: 'cuenta_costo', titulo: 'cuenta_costo', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de costo de ventas (COGS).',
    alias: ['Cuenta de costo de ventas (COGS)', 'Cuenta de costo'] },
  { clave: 'impuesto_compras', titulo: 'impuesto_compras', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código del impuesto de compras.',
    alias: ['Impuesto de compras'] },
  { clave: 'lleva_stock', titulo: 'lleva_stock', requerida: false, tipo: 'si_no', pestana: 'Ventas, compra e inventario',
    ayuda: 'Sí / No. Un servicio va en No y entonces no necesita cuentas de inventario ni costo.',
    alias: ['¿Lleva control de stock?', 'Lleva stock', 'Inventariable'] },
  { clave: 'categoria_inventario', titulo: 'categoria_inventario', requerida: false, tipo: 'opcion', pestana: 'Ventas, compra e inventario',
    ayuda: 'Producto terminado, Materia prima, etc.', alias: ['Categoría de inventario'] },
  { clave: 'trazabilidad', titulo: 'trazabilidad', requerida: false, tipo: 'opcion', pestana: 'Ventas, compra e inventario',
    ayuda: 'ninguno, lote o serie. Por omisión: ninguno.', alias: ['Control de trazabilidad'] },
  { clave: 'cuenta_inventario', titulo: 'cuenta_inventario', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de inventario (Activo).',
    alias: ['Cuenta de inventario', 'Cuenta de inventario (Activo)'] },
  { clave: 'cuenta_ajustes', titulo: 'cuenta_ajustes', requerida: false, pestana: 'Ventas, compra e inventario',
    ayuda: 'Código de la cuenta de ajustes de inventario.',
    alias: ['Cuenta de ajustes de inventario', 'Cuenta de ajustes'] },
  { clave: 'costo_promedio', titulo: 'costo_promedio', requerida: false, tipo: 'moneda', pestana: 'Ventas, compra e inventario',
    ayuda: 'Si se deja vacío se usa el precio de compra.', alias: ['Costo promedio', 'Costo promedio (Q)'] },
  { clave: 'existencia_actual', titulo: 'existencia_actual', requerida: false, tipo: 'numero', pestana: 'Ventas, compra e inventario',
    ayuda: 'Cantidad en existencia. NO entra con los artículos: entra por la carga de saldos iniciales, que genera su póliza.',
    alias: ['Cantidad', 'Existencia actual', 'Stock on Hand', 'Quantity'] },
  { clave: 'punto_reorden', titulo: 'punto_reorden', requerida: false, tipo: 'numero', pestana: 'Ventas, compra e inventario',
    ayuda: 'Nivel de alerta de bajo stock.', alias: ['Punto de reorden', 'Reorder Point'] },
  { clave: 'peso', titulo: 'peso', requerida: false, tipo: 'numero', pestana: 'Ventas, compra e inventario',
    ayuda: 'Peso por unidad, en libras.', alias: ['Peso', 'Peso (lb)', 'Weight'] },

  // ── Pestaña 3 · POS y otros ────────────────────────────────────────────────
  { clave: 'codigo_barras', titulo: 'codigo_barras', requerida: false, pestana: 'POS y otros',
    ayuda: 'Código que lee el escáner del POS. Si se deja vacío se usa el SKU.',
    alias: ['Código de barras', 'Codigo de barras', 'Barcode', 'EAN', 'UPC'] },
]

const SI = new Set(['si', 'sí', 's', 'yes', 'y', 'true', '1', 'verdadero'])
const NO = new Set(['no', 'n', 'false', '0', 'falso'])

/**
 * El vocabulario de las columnas de opción fija.
 *
 * La base guarda `both`, `finished_good`, `none`; la pantalla muestra «Compra
 * y venta», «Producto terminado», «Ninguno»; y la plantilla documenta
 * `compra_venta`, `producto_terminado`, `ninguno`. Las tres hablan de lo
 * mismo, así que la traducción vive aquí y en un solo lugar: el archivo se
 * escribe con el término de la plantilla —el primero de cada lista— y se lee
 * aceptando cualquiera de los tres, para que un archivo descargado antes de
 * esto, o escrito a mano, siga cargando.
 */
type Vocabulario = Record<string, string[]>

const USO: Vocabulario = {
  both:     ['compra_venta', 'both', 'compra y venta', 'ambos', 'compraventa'],
  sale:     ['solo_venta', 'sale', 'venta', 'solo venta', 'ventas'],
  purchase: ['solo_compra', 'purchase', 'compra', 'solo compra', 'compras'],
}

const TIPO_ARTICULO: Vocabulario = {
  bien:      ['bien', 'producto', 'good', 'goods', 'bienes'],
  servicio:  ['servicio', 'service', 'servicios'],
  exento:    ['exento', 'exempt'],
  importado: ['importado', 'imported', 'importacion'],
}

const CATEGORIA_INVENTARIO: Vocabulario = {
  finished_good:    ['producto_terminado', 'finished_good', 'producto terminado', 'terminado'],
  raw_material:     ['materia_prima', 'raw_material', 'materia prima'],
  work_in_progress: ['en_proceso', 'work_in_progress', 'en proceso', 'proceso'],
  supply:           ['suministro', 'supply', 'suministros', 'insumo'],
}

const TRAZABILIDAD: Vocabulario = {
  none:   ['ninguno', 'none', 'ninguna', 'sin', 'no'],
  lot:    ['lote', 'lot', 'lotes'],
  serial: ['serie', 'serial', 'series', 'numero de serie'],
}

/** Sin tildes, sin mayúsculas y sin espacios de sobra: así se comparan. */
const llano = (v: unknown) =>
  String(v ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')

/** El término que entiende el sistema, venga como venga escrito en el archivo. */
const interno = (vocabulario: Vocabulario, v: unknown): string | undefined => {
  const t = llano(v)
  if (!t) return undefined
  for (const [clave, sinonimos] of Object.entries(vocabulario)) {
    if (clave === t || sinonimos.some(s => llano(s) === t)) return clave
  }
  return undefined
}

/** El término de la plantilla, para escribirlo en el archivo que se descarga. */
const deLaPlantilla = (vocabulario: Vocabulario, v: unknown): string => {
  const clave = interno(vocabulario, v)
  return clave ? vocabulario[clave][0] : ''
}

const texto = (v: unknown) => String(v ?? '').trim()

const numero = (v: unknown): number | undefined => {
  const limpio = texto(v).replace(/[^0-9.-]/g, '')
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
  almacenCodigo?: string
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
      almacenCodigo:          texto(v.almacen) || undefined,
      cuentaIngresosCodigo:   texto(v.cuenta_ingresos) || undefined,
      cuentaCostoCodigo:      texto(v.cuenta_costo) || undefined,
      cuentaInventarioCodigo: texto(v.cuenta_inventario) || undefined,
      cuentaAjustesCodigo:    texto(v.cuenta_ajustes) || undefined,
      impuestoVentasCodigo:   texto(v.impuesto_ventas) || undefined,
      impuestoComprasCodigo:  texto(v.impuesto_compras) || undefined,
      moneda:                 texto(v.moneda) || undefined,
      // Las de opción fija se guardan ya traducidas al término del sistema: el
      // backend recibe siempre `both`, no a veces «Compra y venta».
      tipoArticulo:           interno(TIPO_ARTICULO, v.tipo_articulo),
      uso:                    interno(USO, v.uso),
      categoriaInventario:    interno(CATEGORIA_INVENTARIO, v.categoria_inventario),
      trazabilidad:           interno(TRAZABILIDAD, v.trazabilidad),
    })
  }
  return filas
}

/** Lo que Lucía entendió de UNA columna del archivo que subió el usuario. */
export interface AnalisisDeColumna {
  /** El encabezado tal como viene escrito en el archivo. */
  encabezado:  string
  /** La columna de la plantilla a la que corresponde, si se reconoció. */
  titulo?:     string
  reconocida:  boolean
  tipo:        TipoDeColumna
  /** El primer valor con contenido, para ver que la columna se está llenando. */
  ejemplo:     string
  /** Sin un solo valor en todo el archivo: no va a llenar nada. */
  vacia:       boolean
  /** Qué tiene de malo el dato, cuando no corresponde con el tipo. */
  problema?:   string
}

export interface AnalisisDelArchivo {
  filas:     number
  columnas:  AnalisisDeColumna[]
  /** Columnas obligatorias de la plantilla que el archivo no trae. */
  faltantes: string[]
}

/**
 * Qué entendió Lucía del archivo, ANTES de cargarlo.
 *
 * Sin esto el usuario sube el archivo a ciegas y solo se entera de lo que
 * falló cuando la carga termina —con un «SKU no encontrado» que no dice qué
 * columna se leyó mal ni qué dato no se estaba leyendo—. Aquí se ve columna
 * por columna: cuál reconoció, de qué tipo la espera, con qué valor del
 * propio archivo, y qué no cuadra.
 */
export function analizarArchivoDeArticulos(datos: ArrayBuffer | Uint8Array): AnalisisDelArchivo {
  const wb   = XLSX.read(datos, { type: 'array' })
  const hoja = wb.Sheets[wb.SheetNames.find(n => /art[ií]culo/i.test(n)) ?? wb.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja con datos.')

  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
  const indice = indiceDeEncabezados()
  const porClave = new Map(COLUMNAS_PLANTILLA.map(c => [c.clave, c]))

  const vocabularioDe: Record<string, Vocabulario> = {
    tipo_articulo: TIPO_ARTICULO, uso: USO,
    categoria_inventario: CATEGORIA_INVENTARIO, trazabilidad: TRAZABILIDAD,
  }

  const encabezados = Object.keys(crudas[0] ?? {})
  const columnas: AnalisisDeColumna[] = encabezados.map(encabezado => {
    const clave  = indice.get(encabezado.trim().toLowerCase())
    const def    = clave ? porClave.get(clave) : undefined
    const tipo   = def?.tipo ?? 'texto'
    const todos  = crudas.map(f => texto(f[encabezado]))
    const ejemplo = todos.find(v => v !== '') ?? ''

    let problema: string | undefined
    if (ejemplo) {
      if ((tipo === 'moneda' || tipo === 'numero') && numero(ejemplo) === undefined) {
        problema = `«${ejemplo}» no es un número.`
      } else if (tipo === 'si_no' && interruptor(ejemplo) === undefined) {
        problema = `«${ejemplo}» no se entiende como Sí o No.`
      } else if (tipo === 'opcion' && clave && vocabularioDe[clave]
                 && interno(vocabularioDe[clave], ejemplo) === undefined) {
        problema = `«${ejemplo}» no es un valor admitido. Se admite: `
          + Object.values(vocabularioDe[clave]).map(v => v[0]).join(', ') + '.'
      }
    }

    return {
      encabezado,
      titulo: def?.titulo,
      reconocida: Boolean(clave),
      tipo,
      ejemplo,
      vacia: ejemplo === '',
      problema,
    }
  })

  const reconocidas = new Set(columnas.filter(c => c.reconocida).map(c => c.titulo))
  const faltantes = COLUMNAS_PLANTILLA
    .filter(c => c.requerida && !reconocidas.has(c.titulo))
    .map(c => c.titulo)

  return { filas: crudas.length, columnas, faltantes }
}

/** Un artículo ya creado, tal como lo devuelve el listado de inventario. */
export interface ArticuloExportable {
  sku?: string
  name?: string
  description?: string
  unit?: string
  category?: string
  brand?: string
  itemType?: string
  usageType?: string
  currency?: string
  salesPrice?: number
  purchasePrice?: number
  averageCost?: number
  stockOnHand?: number
  reorderPoint?: number
  weight?: number
  isInventoriable?: boolean
  itemCategory?: string
  trackingType?: string
  barCodes?: string[]
  /** El artículo guarda sus cuentas por id; se resuelven contra el catálogo. */
  salesAccountId?: string
  inventoryAccountId?: string
  costAccountId?: string
  adjustmentAccountId?: string
  purchaseAccountId?: string
  warehouseId?: string
  /** El impuesto y el grupo también viven por id en el artículo. */
  salesTaxId?: string
  purchaseTaxId?: string
  groupId?: string
  /** Códigos ya resueltos, si el listado los trae. */
  cuentaIngresosCodigo?: string
  cuentaCostoCodigo?: string
  cuentaInventarioCodigo?: string
  cuentaAjustesCodigo?: string
  impuestoVentasCodigo?: string
  impuestoComprasCodigo?: string
  grupoCodigo?: string
}

const siNo = (v: unknown): string => (v === false ? 'No' : v === true ? 'Sí' : '')

const numeroOVacio = (v: unknown): number | '' => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : ''
}

/**
 * Baja los artículos ya creados en el MISMO formato de la plantilla.
 *
 * Así se revisa en Excel, se corrige y se vuelve a subir sin traducir columnas
 * a mano: lo exportado lo lee el mismo lector que lee la plantilla.
 */
export function exportarArticulos(
  articulos: ArticuloExportable[],
  catalogo: CatalogoDeLaEmpresa,
): ArrayBuffer {
  // El artículo guarda los ids de sus cuentas. Sin resolverlos, estas columnas
  // salían vacías y el archivo exportado no se podía volver a subir.
  const porId = new Map<string, string>()
  for (const c of catalogo.cuentas) if (c.id) porId.set(c.id, c.code)
  // El impuesto, el grupo y el almacén también se guardan por id. Sin estos
  // tres índices las columnas salían vacías aunque la pantalla las mostrara.
  const impuestoPorId = new Map<string, string>()
  for (const i of catalogo.impuestos) if (i.id) impuestoPorId.set(i.id, i.code)
  const grupoPorId = new Map<string, string>()
  for (const g of catalogo.grupos) if (g.id) grupoPorId.set(g.id, g.code)
  const almacenPorId = new Map<string, string>()
  for (const a of catalogo.almacenes) if (a.id) almacenPorId.set(a.id, a.code)

  /** Un id que ya no está en el catálogo sale vacío: el id no le sirve a nadie. */
  const resolver = (indice: Map<string, string>, id?: string, yaResuelto?: string) =>
    yaResuelto ?? (id ? indice.get(id) ?? '' : '')
  const codigoDe = (id?: string, yaResuelto?: string) => resolver(porId, id, yaResuelto)

  const filas = articulos.map(a => ({
    nombre:        String(a.name ?? ''),
    sku:           String(a.sku ?? ''),
    tipo_articulo: deLaPlantilla(TIPO_ARTICULO, a.itemType),
    uso:           deLaPlantilla(USO, a.usageType),
    unidad:        String(a.unit ?? ''),
    grupo:         resolver(grupoPorId, a.groupId, a.grupoCodigo),
    almacen:       resolver(almacenPorId, a.warehouseId),
    categoria:     String(a.category ?? ''),
    marca:         String(a.brand ?? ''),
    descripcion:   String(a.description ?? ''),
    moneda:        String(a.currency ?? 'GTQ'),
    precio_venta:     numeroOVacio(a.salesPrice),
    cuenta_ingresos:  codigoDe(a.salesAccountId, a.cuentaIngresosCodigo),
    impuesto_ventas:  resolver(impuestoPorId, a.salesTaxId, a.impuestoVentasCodigo),
    precio_compra:    numeroOVacio(a.purchasePrice),
    cuenta_costo:     codigoDe(a.costAccountId, a.cuentaCostoCodigo),
    impuesto_compras: resolver(impuestoPorId, a.purchaseTaxId, a.impuestoComprasCodigo),
    lleva_stock:          siNo(a.isInventoriable),
    categoria_inventario: deLaPlantilla(CATEGORIA_INVENTARIO, a.itemCategory),
    trazabilidad:         deLaPlantilla(TRAZABILIDAD, a.trackingType),
    cuenta_inventario:    codigoDe(a.inventoryAccountId, a.cuentaInventarioCodigo),
    cuenta_ajustes:       codigoDe(a.adjustmentAccountId, a.cuentaAjustesCodigo),
    costo_promedio:    numeroOVacio(a.averageCost),
    existencia_actual: numeroOVacio(a.stockOnHand),
    punto_reorden:     numeroOVacio(a.reorderPoint),
    peso:              numeroOVacio(a.weight),
    codigo_barras: (a.barCodes ?? []).map(c => String(c ?? '').trim()).find(Boolean) ?? '',
  }))

  return armarLibro(filas, catalogo)
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
      grupo: catalogo.grupos[0]?.code ?? '', almacen: catalogo.almacenes[0]?.code ?? '',
      categoria: 'Papelería', marca: '',
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
      grupo: '', almacen: '', categoria: 'Servicios', marca: '', descripcion: '',
      moneda: 'GTQ',
      precio_venta: 15, cuenta_ingresos: cuenta('4'), impuesto_ventas: impuesto(/V0|venta/i),
      precio_compra: '', cuenta_costo: '', impuesto_compras: '',
      lleva_stock: 'No', categoria_inventario: '', trazabilidad: '',
      cuenta_inventario: '', cuenta_ajustes: '',
      costo_promedio: '', existencia_actual: '', punto_reorden: '', peso: '',
      codigo_barras: '',
    },
  ]

  return armarLibro(ejemplos, catalogo)
}

/** El libro con la hoja de artículos y las hojas de referencia de la empresa. */
function armarLibro(filas: Array<Record<string, unknown>>, catalogo: CatalogoDeLaEmpresa): ArrayBuffer {
  const orden = COLUMNAS_PLANTILLA.map(c => c.titulo)
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(filas, { header: orden }), 'Artículos')

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
