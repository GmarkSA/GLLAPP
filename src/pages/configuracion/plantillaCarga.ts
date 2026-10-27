import * as XLSX from 'xlsx'

/**
 * El motor de las plantillas de carga masiva.
 *
 * La carga de inventario resolvió un problema concreto: una plantilla Excel
 * que lleva TODOS los campos de la pantalla de creación —no cuatro— armada
 * con las cuentas, impuestos y listas REALES del cliente, y una revisión que
 * dice, columna por columna, qué entendió Lucía antes de cargar nada. Un
 * registro que entra incompleto hay que abrirlo uno por uno después, que es
 * justo lo que la carga viene a evitar.
 *
 * Clientes, proveedores, cuentas de mayor y activos fijos necesitan lo mismo.
 * Lo único que cambia entre ellos son las columnas y las listas de apoyo, así
 * que eso es lo que se declara por módulo; el resto —leer, analizar, armar el
 * libro— vive aquí una sola vez.
 */

/** Qué clase de dato lleva una columna. El usuario lo ve antes de cargar. */
export type TipoDeColumna = 'texto' | 'moneda' | 'numero' | 'si_no' | 'opcion' | 'fecha'

/**
 * Las traducciones de una columna de opción fija.
 *
 * La base guarda `taxable`; la pantalla muestra «Contribuyente — IVA 12%»; la
 * plantilla documenta `contribuyente`. Las tres hablan de lo mismo, así que la
 * traducción vive en un solo lugar: el archivo se escribe con el término de la
 * plantilla —el primero de cada lista— y se lee aceptando cualquiera de los
 * tres, para que un archivo escrito a mano también cargue.
 */
export type Vocabulario = Record<string, string[]>

export interface ColumnaDePlantilla {
  /** Nombre interno, el que usa el código. */
  clave:     string
  /** Encabezado que se escribe en el Excel. */
  titulo:    string
  requerida: boolean
  /** Por omisión, texto. */
  tipo?:     TipoDeColumna
  /** La pestaña de la pantalla de creación donde vive este campo. */
  pestana:   string
  ayuda:     string
  /** Nombres que puede traer esa columna viniendo de otro sistema. */
  alias?:    string[]
  /** Solo para tipo 'opcion': los valores admitidos y sus sinónimos. */
  vocabulario?: Vocabulario
}

/** Una hoja de apoyo del libro: las cuentas del cliente, sus impuestos, etc. */
export interface HojaDeApoyo {
  nombre: string
  filas:  Array<Record<string, unknown>>
}

export interface EspecificacionDeCarga {
  /** Nombre de la hoja de datos: «Clientes», «Proveedores»… */
  hoja:     string
  columnas: ColumnaDePlantilla[]
}

// ─── Lectura de valores ───────────────────────────────────────────────────────

const SI = new Set(['si', 'sí', 's', 'yes', 'y', 'true', '1', 'verdadero'])
const NO = new Set(['no', 'n', 'false', '0', 'falso'])

/** Sin tildes, sin mayúsculas y sin espacios de sobra: así se comparan. */
export const llano = (v: unknown) =>
  String(v ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')

export const texto = (v: unknown) => String(v ?? '').trim()

export const numero = (v: unknown): number | undefined => {
  const limpio = texto(v).replace(/[^0-9.-]/g, '')
  if (!limpio) return undefined
  const n = Number(limpio)
  return Number.isFinite(n) ? n : undefined
}

export const interruptor = (v: unknown): boolean | undefined => {
  const t = llano(v)
  if (!t) return undefined
  if (SI.has(t)) return true
  if (NO.has(t)) return false
  return undefined
}

/**
 * La fecha, siempre como YYYY-MM-DD.
 *
 * Excel guarda las fechas como un número de días desde 1900, así que una celda
 * con formato de fecha llega como 45658 y no como texto. Y lo que el usuario
 * escribe a mano suele venir en DD/MM/YYYY, que es como se escribe aquí.
 * Guatemala es UTC-6 y leer con `new Date(...)` en UTC retrocede un día, así
 * que la fecha se arma con sus tres números y nunca se pasa por la zona
 * horaria del navegador.
 */
export const fecha = (v: unknown): string | undefined => {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  const t = texto(v)
  if (!t) return undefined

  // Número de serie de Excel
  if (/^\d{5}$/.test(t)) {
    const d = XLSX.SSF.parse_date_code(Number(t))
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)

  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) {
    const [, dia, mes, anio] = m
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }
  return undefined
}

/** El término que entiende el sistema, venga como venga escrito en el archivo. */
export const interno = (vocabulario: Vocabulario, v: unknown): string | undefined => {
  const t = llano(v)
  if (!t) return undefined
  for (const [clave, sinonimos] of Object.entries(vocabulario)) {
    if (llano(clave) === t || sinonimos.some(s => llano(s) === t)) return clave
  }
  return undefined
}

/** El término de la plantilla, para escribirlo en el archivo que se descarga. */
export const deLaPlantilla = (vocabulario: Vocabulario, v: unknown): string => {
  const clave = interno(vocabulario, v)
  return clave ? vocabulario[clave][0] : ''
}

// ─── Lectura del archivo ──────────────────────────────────────────────────────

/**
 * Por qué nombre puede venir cada columna.
 *
 * Se aceptan el título de la plantilla, la clave interna y los alias que
 * declare el módulo: un archivo exportado de Zoho trae «Display Name» donde
 * nosotros decimos «nombre», y obligar al usuario a renombrar encabezados a
 * mano es pedirle que haga el trabajo que la carga tiene que hacer.
 */
const indiceDeEncabezados = (spec: EspecificacionDeCarga): Map<string, string> => {
  const indice = new Map<string, string>()
  for (const col of spec.columnas) {
    for (const nombre of [col.titulo, col.clave, ...(col.alias ?? [])]) {
      indice.set(llano(nombre), col.clave)
    }
  }
  return indice
}

const hojaDeDatos = (datos: ArrayBuffer | Uint8Array, spec: EspecificacionDeCarga) => {
  const wb = XLSX.read(datos, { type: 'array', cellDates: true })
  const buscada = wb.SheetNames.find(n => llano(n) === llano(spec.hoja))
  const hoja = wb.Sheets[buscada ?? wb.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja con datos.')
  return hoja
}

/**
 * Las filas del archivo, con las claves internas y los tipos ya convertidos.
 *
 * Una columna que el archivo no trae simplemente no aparece en la fila: así el
 * que carga puede borrar las columnas que no usa sin que eso signifique
 * «ponlo en vacío».
 */
export function leerFilas(
  datos: ArrayBuffer | Uint8Array,
  spec: EspecificacionDeCarga,
): Array<Record<string, unknown>> {
  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    hojaDeDatos(datos, spec), { defval: '' })
  const indice = indiceDeEncabezados(spec)
  const porClave = new Map(spec.columnas.map(c => [c.clave, c]))

  return crudas.map(cruda => {
    const fila: Record<string, unknown> = {}
    for (const [encabezado, valor] of Object.entries(cruda)) {
      const clave = indice.get(llano(encabezado))
      if (!clave) continue
      const col = porClave.get(clave)!
      if (texto(valor) === '' && !(valor instanceof Date)) continue

      switch (col.tipo) {
        case 'moneda':
        case 'numero': fila[clave] = numero(valor); break
        case 'si_no':  fila[clave] = interruptor(valor); break
        case 'fecha':  fila[clave] = fecha(valor); break
        case 'opcion': fila[clave] = col.vocabulario ? interno(col.vocabulario, valor) : texto(valor); break
        default:       fila[clave] = texto(valor)
      }
      if (fila[clave] === undefined) delete fila[clave]
    }
    return fila
  })
}

// ─── Revisión previa ──────────────────────────────────────────────────────────

export interface AnalisisDeColumna {
  /** El encabezado tal como viene en el archivo. */
  encabezado:  string
  /** El campo de Lucía al que corresponde, si se reconoció. */
  titulo?:     string
  reconocida:  boolean
  tipo:        TipoDeColumna
  /** Primer valor con contenido, para que el usuario vea qué se leyó. */
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
 * falló cuando la carga termina —con un error que no dice qué columna se leyó
 * mal ni qué dato no se estaba leyendo—. Aquí se ve columna por columna: cuál
 * reconoció, de qué tipo la espera, con qué valor del propio archivo, y qué no
 * cuadra.
 */
export function analizarArchivo(
  datos: ArrayBuffer | Uint8Array,
  spec: EspecificacionDeCarga,
): AnalisisDelArchivo {
  const hoja = hojaDeDatos(datos, spec)
  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
  const indice = indiceDeEncabezados(spec)
  const porClave = new Map(spec.columnas.map(c => [c.clave, c]))

  // De la fila 1, no de la primera fila de datos: la plantilla en blanco no
  // tiene datos y aun así hay que poder decir qué columnas trae.
  const [primeraFila] = XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, defval: '' })
  const encabezados = (primeraFila ?? []).map(h => texto(h)).filter(Boolean)

  const columnas: AnalisisDeColumna[] = encabezados.map(encabezado => {
    const clave   = indice.get(llano(encabezado))
    const def     = clave ? porClave.get(clave) : undefined
    const tipo    = def?.tipo ?? 'texto'
    const ejemplo = crudas.map(f => texto(f[encabezado])).find(v => v !== '') ?? ''

    let problema: string | undefined
    if (ejemplo) {
      if ((tipo === 'moneda' || tipo === 'numero') && numero(ejemplo) === undefined) {
        problema = `«${ejemplo}» no es un número.`
      } else if (tipo === 'si_no' && interruptor(ejemplo) === undefined) {
        problema = `«${ejemplo}» no se entiende como Sí o No.`
      } else if (tipo === 'fecha' && fecha(ejemplo) === undefined) {
        problema = `«${ejemplo}» no se entiende como fecha. Se admite DD/MM/AAAA o AAAA-MM-DD.`
      } else if (tipo === 'opcion' && def?.vocabulario
                 && interno(def.vocabulario, ejemplo) === undefined) {
        problema = `«${ejemplo}» no es un valor admitido. Se admite: `
          + Object.values(def.vocabulario).map(v => v[0]).join(', ') + '.'
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

  const traidas = new Set(columnas.filter(c => c.reconocida).map(c => c.titulo))
  const faltantes = spec.columnas
    .filter(c => c.requerida && !traidas.has(c.titulo))
    .map(c => c.titulo)

  return { filas: crudas.length, columnas, faltantes }
}

// ─── El libro que se descarga ─────────────────────────────────────────────────

/**
 * El libro de la plantilla: la hoja de datos, un ejemplo, las instrucciones y
 * las listas de apoyo del cliente.
 *
 * El ejemplo va en SU PROPIA hoja y no como primera fila de la de datos: una
 * fila de ejemplo mezclada con las de verdad se carga junto con ellas, y
 * aparece un «Empresa Ejemplo S.A.» en la cartera del cliente.
 */
export function armarLibro(
  spec: EspecificacionDeCarga,
  filas: Array<Record<string, unknown>>,
  hojasDeApoyo: HojaDeApoyo[] = [],
  ejemplos: Array<Record<string, unknown>> = [],
  /**
   * Otra hoja de datos para llenar, con sus propias columnas e instrucciones.
   *
   * Es la de saldos pendientes: va en el mismo archivo que los contactos
   * porque se llena en el mismo momento y con los mismos NIT.
   */
  segundaHoja?: { spec: EspecificacionDeCarga; ejemplos?: Array<Record<string, unknown>> },
): ArrayBuffer {
  const orden = spec.columnas.map(c => c.titulo)
  const wb = XLSX.utils.book_new()

  // Sin filas la hoja queda con los encabezados y nada más: es el modelo en
  // blanco, listo para escribir debajo.
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(filas, { header: orden }), spec.hoja)

  if (ejemplos.length) {
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(ejemplos, { header: orden }), 'Ejemplo')
  }

  if (segundaHoja) {
    const ordenSegunda = segundaHoja.spec.columnas.map(c => c.titulo)
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet([], { header: ordenSegunda }), segundaHoja.spec.hoja)
    if (segundaHoja.ejemplos?.length) {
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(segundaHoja.ejemplos, { header: ordenSegunda }),
        `Ejemplo ${segundaHoja.spec.hoja}`.slice(0, 31))
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    [...spec.columnas, ...(segundaHoja?.spec.columnas ?? [])].map(c => ({
      columna: c.titulo,
      pestaña_en_Lucía: c.pestana,
      obligatoria: c.requerida ? 'Sí' : 'No',
      tipo_de_dato: etiquetaDeTipo(c.tipo ?? 'texto'),
      valores_admitidos: c.vocabulario
        ? Object.values(c.vocabulario).map(v => v[0]).join(' · ')
        : '',
      qué_poner: c.ayuda,
    }))), 'Instrucciones')

  for (const apoyo of hojasDeApoyo) {
    if (!apoyo.filas.length) continue
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(apoyo.filas), apoyo.nombre)
  }

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

const ETIQUETAS: Record<TipoDeColumna, string> = {
  texto:  'Texto',
  moneda: 'Moneda (solo el número, sin Q)',
  numero: 'Número',
  si_no:  'Sí / No',
  opcion: 'Una de las opciones',
  fecha:  'Fecha (DD/MM/AAAA)',
}

export const etiquetaDeTipo = (tipo: TipoDeColumna) => ETIQUETAS[tipo]
