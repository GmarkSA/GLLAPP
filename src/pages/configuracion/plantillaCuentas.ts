import {
  armarLibro, type ColumnaDePlantilla, type EspecificacionDeCarga,
  type HojaDeApoyo, type Vocabulario,
} from './plantillaCarga'

/**
 * La plantilla Excel del catálogo de cuentas.
 *
 * El catálogo es lo primero que se carga al montar una empresa y lo que más
 * cuesta rehacer: una cuenta que entra sin su tipo o con el saldo normal al
 * revés desordena el balance entero, y corregirlo después significa tocar
 * todas las pólizas que ya la usaron.
 *
 * Por eso la plantilla lleva también los interruptores —cuenta de clientes,
 * de proveedores, de inventario, exige centro de costo—: son los que hacen que
 * el resto del sistema encuentre sus cuentas solo. Una cuenta por cobrar que
 * entra sin la marca de «cuenta de clientes» deja al módulo de ventas sin
 * dónde contabilizar.
 */

export interface CatalogoDeCuentas {
  /** Las cuentas que ya existen, para poder nombrar la cuenta padre. */
  existentes: Array<{ code: string; name: string }>
  grupos: string[]
}

/** Los cinco tipos del balance. Decide de qué lado del estado cae la cuenta. */
const TIPO_DE_CUENTA: Vocabulario = {
  asset:     ['activo', 'asset', 'activos'],
  liability: ['pasivo', 'liability', 'pasivos'],
  equity:    ['patrimonio', 'equity', 'capital'],
  revenue:   ['ingreso', 'revenue', 'ingresos', 'venta', 'ventas'],
  expense:   ['gasto', 'expense', 'gastos', 'costo', 'costos'],
}

/**
 * De qué lado aumenta la cuenta.
 *
 * Al revés, el balance queda cuadrado pero con los signos invertidos: la
 * cuenta aparece en negativo y nadie entiende por qué.
 */
const SALDO_NORMAL: Vocabulario = {
  debit:  ['deudor', 'debit', 'debe', 'deudora'],
  credit: ['acreedor', 'credit', 'haber', 'acreedora'],
}

const ESTADO: Vocabulario = {
  activa:   ['activa', 'active', 'si', 'habilitada'],
  inactiva: ['inactiva', 'inactive', 'no', 'deshabilitada'],
}

export const COLUMNAS_CUENTAS: ColumnaDePlantilla[] = [
  // ── Identificación ─────────────────────────────────────────────────────────
  { clave: 'codigo', titulo: 'codigo', requerida: true, pestana: 'Identificación',
    ayuda: 'Código de la cuenta. Es la llave: si ya existe, se actualiza en vez de duplicarse.',
    alias: ['Código', 'Codigo', 'Cuenta', 'Account Code', 'No. de cuenta'] },
  { clave: 'nombre', titulo: 'nombre', requerida: true, pestana: 'Identificación',
    ayuda: 'Nombre de la cuenta, como aparece en los estados financieros.',
    alias: ['Nombre', 'Descripción de la cuenta', 'Account Name'] },
  { clave: 'tipo', titulo: 'tipo', requerida: true, tipo: 'opcion', vocabulario: TIPO_DE_CUENTA,
    pestana: 'Identificación',
    ayuda: 'activo, pasivo, patrimonio, ingreso o gasto. Decide en qué estado financiero aparece.',
    alias: ['Tipo', 'Tipo de cuenta', 'Clasificación', 'Account Type'] },
  { clave: 'saldo_normal', titulo: 'saldo_normal', requerida: false, tipo: 'opcion',
    vocabulario: SALDO_NORMAL, pestana: 'Identificación',
    ayuda: 'deudor o acreedor. De qué lado aumenta. Por omisión se deduce del tipo.',
    alias: ['Saldo normal', 'Naturaleza', 'Tipo balance', 'Normal Balance'] },
  { clave: 'cuenta_padre', titulo: 'cuenta_padre', requerida: false, pestana: 'Identificación',
    ayuda: 'Código de la cuenta de la que cuelga. Vacío = cuenta de primer nivel.',
    alias: ['Cuenta padre', 'Padre', 'Parent Account', 'Cuenta mayor'] },
  { clave: 'es_titulo', titulo: 'es_titulo', requerida: false, tipo: 'si_no',
    pestana: 'Identificación',
    ayuda: 'Sí / No. Una cuenta de título agrupa y NO recibe movimientos: solo suma las que cuelgan de ella.',
    alias: ['Es título', 'Cuenta de título', 'Es de agrupación', 'Header'] },
  { clave: 'grupo', titulo: 'grupo', requerida: false, pestana: 'Identificación',
    ayuda: 'Grupo contable al que pertenece. Ver la hoja Listas.',
    alias: ['Grupo contable', 'Grupo', 'Group'] },
  { clave: 'descripcion', titulo: 'descripcion', requerida: false, pestana: 'Identificación',
    ayuda: 'Para qué sirve la cuenta, libre.',
    alias: ['Descripción', 'Descripcion', 'Description'] },
  { clave: 'estado', titulo: 'estado', requerida: false, tipo: 'opcion', vocabulario: ESTADO,
    pestana: 'Identificación', ayuda: 'activa o inactiva. Por omisión: activa.',
    alias: ['Estado', 'Activa', 'Status'] },

  // ── Para qué sirve ─────────────────────────────────────────────────────────
  { clave: 'es_cuenta_clientes', titulo: 'es_cuenta_clientes', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. Marca la cuenta por cobrar. Sin esto el módulo de ventas no sabe dónde contabilizar.',
    alias: ['Cuenta de clientes (CxC)', 'Cuenta de clientes', 'CxC'] },
  { clave: 'es_cuenta_proveedores', titulo: 'es_cuenta_proveedores', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. Marca la cuenta por pagar, que usa el módulo de compras.',
    alias: ['Cuenta de proveedores (CxP)', 'Cuenta de proveedores', 'CxP'] },
  { clave: 'es_cuenta_inventario', titulo: 'es_cuenta_inventario', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. La vincula con los artículos del módulo de Inventario.',
    alias: ['Cuenta de inventario', 'Inventario'] },
  { clave: 'es_activo_fijo', titulo: 'es_activo_fijo', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. Habilita depreciación y amortización sobre esta cuenta.',
    alias: ['Activos fijos', 'Activo fijo'] },
  { clave: 'requiere_conciliacion', titulo: 'requiere_conciliacion', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. Hay que conciliarla con un estado externo: banco, tarjeta.',
    alias: ['Requiere conciliación', 'Conciliable'] },
  { clave: 'exige_centro_costo', titulo: 'exige_centro_costo', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. Las líneas de póliza con esta cuenta deben traer centro de costo.',
    alias: ['Exige Centro de Costo', 'Centro de costo'] },
  { clave: 'exige_centro_beneficio', titulo: 'exige_centro_beneficio', requerida: false, tipo: 'si_no',
    pestana: 'Para qué sirve',
    ayuda: 'Sí / No. Las líneas de póliza con esta cuenta deben traer centro de beneficio.',
    alias: ['Exige Centro de Beneficio', 'Centro de beneficio'] },

  // ── Saldo de apertura ──────────────────────────────────────────────────────
  { clave: 'saldo_inicial', titulo: 'saldo_inicial', requerida: false, tipo: 'moneda',
    pestana: 'Saldo de apertura',
    ayuda: 'Saldo con el que la cuenta empieza en Lucía, EN SU PROPIA MONEDA. Se carga con signo positivo; el tipo y el saldo normal deciden si va al debe o al haber.',
    alias: ['Saldo inicial', 'Saldo de apertura', 'Opening Balance', 'Saldo'] },
  { clave: 'moneda', titulo: 'moneda', requerida: false, pestana: 'Saldo de apertura',
    ayuda: 'Moneda del saldo. GTQ por omisión. Para una cuenta de banco en dólares, USD.',
    alias: ['Moneda', 'Currency'] },
  { clave: 'tipo_cambio', titulo: 'tipo_cambio', requerida: false, tipo: 'numero',
    pestana: 'Saldo de apertura',
    ayuda: 'Cuántos quetzales vale una unidad de esa moneda, a la fecha del saldo. OBLIGATORIO si la moneda no es GTQ: sin él el saldo no se carga, porque anotarlo a 1 × 1 metería la cuenta al balance por una séptima parte de su valor.',
    alias: ['Tipo de cambio', 'TC', 'Exchange Rate', 'Tasa'] },
]

export const ESPECIFICACION_CUENTAS: EspecificacionDeCarga = {
  hoja: 'Cuentas',
  columnas: COLUMNAS_CUENTAS,
}

export function hojasDeCuentas(catalogo: CatalogoDeCuentas): HojaDeApoyo[] {
  const largo = Math.max(catalogo.grupos.length, 1)
  return [
    {
      nombre: 'Cuentas existentes',
      filas: catalogo.existentes.map(c => ({ codigo: c.code, nombre: c.name })),
    },
    {
      nombre: 'Listas',
      filas: Array.from({ length: largo }, (_, i) => ({ grupo: catalogo.grupos[i] ?? '' })),
    },
  ]
}

/**
 * Tres filas de ejemplo y no una: el catálogo se entiende por su estructura.
 * Una cuenta de título con dos hijas enseña de un vistazo cómo se encadenan
 * con `cuenta_padre` y por qué la madre no lleva saldo.
 */
const ejemplosDeCuentas = (): Array<Record<string, unknown>> => [
  {
    codigo: '1101', nombre: 'Caja y bancos', tipo: 'activo', saldo_normal: 'deudor',
    cuenta_padre: '11', es_titulo: 'Sí', grupo: '', descripcion: 'Agrupa el efectivo',
    estado: 'activa', es_cuenta_clientes: 'No', es_cuenta_proveedores: 'No',
    es_cuenta_inventario: 'No', es_activo_fijo: 'No', requiere_conciliacion: 'No',
    exige_centro_costo: 'No', exige_centro_beneficio: 'No', saldo_inicial: '', moneda: '', tipo_cambio: '',
  },
  {
    codigo: '110101', nombre: 'Caja chica', tipo: 'activo', saldo_normal: 'deudor',
    cuenta_padre: '1101', es_titulo: 'No', grupo: '', descripcion: '',
    estado: 'activa', es_cuenta_clientes: 'No', es_cuenta_proveedores: 'No',
    es_cuenta_inventario: 'No', es_activo_fijo: 'No', requiere_conciliacion: 'No',
    exige_centro_costo: 'No', exige_centro_beneficio: 'No', saldo_inicial: 2000, moneda: 'GTQ', tipo_cambio: '',
  },
  {
    codigo: '110201', nombre: 'Clientes nacionales', tipo: 'activo', saldo_normal: 'deudor',
    cuenta_padre: '1102', es_titulo: 'No', grupo: '', descripcion: '',
    estado: 'activa', es_cuenta_clientes: 'Sí', es_cuenta_proveedores: 'No',
    es_cuenta_inventario: 'No', es_activo_fijo: 'No', requiere_conciliacion: 'No',
    exige_centro_costo: 'No', exige_centro_beneficio: 'No',
    saldo_inicial: 45000, moneda: 'GTQ', tipo_cambio: '',
  },
  {
    // Una cuenta en dólares: el saldo va en dólares y el tipo de cambio lo
    // convierte para los libros. Si está enlazada a una cuenta bancaria, su
    // saldo inicial en dólares se actualiza solo.
    codigo: '114001', nombre: 'Banco USD — Industrial-69', tipo: 'activo', saldo_normal: 'deudor',
    cuenta_padre: '1101', es_titulo: 'No', grupo: '', descripcion: '',
    estado: 'activa', es_cuenta_clientes: 'No', es_cuenta_proveedores: 'No',
    es_cuenta_inventario: 'No', es_activo_fijo: 'No', requiere_conciliacion: 'Sí',
    exige_centro_costo: 'No', exige_centro_beneficio: 'No',
    saldo_inicial: 68.54, moneda: 'USD', tipo_cambio: 7.663360,
  },
]

export function construirPlantillaCuentas(catalogo: CatalogoDeCuentas): ArrayBuffer {
  return armarLibro(ESPECIFICACION_CUENTAS, [], hojasDeCuentas(catalogo), ejemplosDeCuentas())
}
