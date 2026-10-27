import {
  armarLibro, type ColumnaDePlantilla, type EspecificacionDeCarga,
  type HojaDeApoyo, type Vocabulario,
} from './plantillaCarga'
import { ESPECIFICACION_SALDOS, ejemplosDeSaldos } from './plantillaSaldosPendientes'

/**
 * La plantilla Excel de la carga masiva de proveedores.
 *
 * Es casi la de clientes: lo que cambia es la cuenta —por pagar en vez de por
 * cobrar—, la contrapartida —gastos en vez de ingresos— y el impuesto, que
 * aquí es el de compras. Las columnas se declaran aparte y no se comparten
 * con las de clientes a propósito: la ayuda de cada una habla del proveedor, y
 * un texto genérico que sirva para los dos no le sirve bien a ninguno.
 */

export interface CatalogoDeProveedores {
  cuentas:   Array<{ code: string; name: string; type?: string }>
  impuestos: Array<{ code: string; name: string; rate?: number }>
  monedas:   string[]
}

const TIPO_PROVEEDOR: Vocabulario = {
  company:    ['empresa', 'company', 'juridica', 'persona juridica', 'sociedad'],
  individual: ['persona', 'individual', 'natural', 'persona natural'],
  employee:   ['empleado', 'employee', 'colaborador'],
}

/**
 * El tratamiento fiscal del proveedor, que decide qué se le retiene.
 *
 * Un pequeño contribuyente al que se le factura como contribuyente normal
 * termina con un IVA acreditable que la SAT no reconoce.
 */
const TRATAMIENTO_FISCAL: Vocabulario = {
  taxable:                 ['contribuyente', 'taxable', 'iva 12', 'normal', 'gravado'],
  exempt:                  ['exento', 'exempt', 'exenta'],
  pequeno_contribuyente:   ['pequeno_contribuyente', 'pequeño contribuyente', 'pequeno', 'regimen pequeno'],
  contribuyente_especial:  ['contribuyente_especial', 'especial', 'retenedor'],
  gobierno:                ['gobierno', 'government', 'estado'],
}

const ESTADO: Vocabulario = {
  active:      ['activo', 'active', 'alta'],
  inactive:    ['inactivo', 'inactive', 'baja'],
  blacklisted: ['bloqueado', 'blacklisted', 'lista negra'],
}

const TERMINOS_DE_PAGO: Vocabulario = {
  due_on_receipt: ['contado', 'due_on_receipt', 'al contado', 'inmediato', 'de contado'],
  net_15:         ['15_dias', 'net_15', '15 dias', 'neto 15'],
  net_30:         ['30_dias', 'net_30', '30 dias', 'neto 30'],
  net_45:         ['45_dias', 'net_45', '45 dias', 'neto 45'],
  net_60:         ['60_dias', 'net_60', '60 dias', 'neto 60'],
}

export const COLUMNAS_PROVEEDORES: ColumnaDePlantilla[] = [
  // ── Info principal ─────────────────────────────────────────────────────────
  { clave: 'nombre', titulo: 'nombre', requerida: true, pestana: 'Info principal',
    ayuda: 'Nombre con el que aparece en compras y pagos. Es el único campo obligatorio.',
    alias: ['Nombre', 'Proveedor', 'Display Name', 'Company Name', 'Nombre del proveedor'] },
  { clave: 'tipo', titulo: 'tipo', requerida: false, tipo: 'opcion', vocabulario: TIPO_PROVEEDOR,
    pestana: 'Info principal', ayuda: 'empresa o persona. Por omisión: empresa.',
    alias: ['Tipo de proveedor', 'Tipo', 'Vendor Type'] },
  { clave: 'razon_social', titulo: 'razon_social', requerida: false, pestana: 'Info principal',
    ayuda: 'Razón social, si difiere del nombre con que se le conoce.',
    alias: ['Nombre comercial', 'Razón social', 'Razon social', 'Legal Name'] },
  { clave: 'nit', titulo: 'nit', requerida: false, pestana: 'Info principal',
    ayuda: 'NIT. Es la llave: si ya existe un proveedor con ese NIT, se actualiza en vez de duplicarse.',
    alias: ['NIT', 'NIT / CUI', 'Tax ID', 'Identificación'] },
  { clave: 'nombres', titulo: 'nombres', requerida: false, pestana: 'Info principal',
    ayuda: 'Solo para persona: nombre de pila.', alias: ['Nombre de pila', 'First Name'] },
  { clave: 'apellidos', titulo: 'apellidos', requerida: false, pestana: 'Info principal',
    ayuda: 'Solo para persona: apellidos.', alias: ['Apellido', 'Apellidos', 'Last Name'] },
  { clave: 'email', titulo: 'email', requerida: false, pestana: 'Info principal',
    ayuda: 'Correo donde se le envían las órdenes de compra.',
    alias: ['Correo electrónico', 'Correo', 'Email', 'E-mail'] },
  { clave: 'telefono', titulo: 'telefono', requerida: false, pestana: 'Info principal',
    ayuda: 'Teléfono fijo.', alias: ['Teléfono', 'Telefono', 'Phone'] },
  { clave: 'celular', titulo: 'celular', requerida: false, pestana: 'Info principal',
    ayuda: 'Teléfono móvil.', alias: ['Celular', 'Móvil', 'Mobile'] },
  { clave: 'sitio_web', titulo: 'sitio_web', requerida: false, pestana: 'Info principal',
    ayuda: 'Página web, libre.', alias: ['Sitio web', 'Website', 'Web'] },
  { clave: 'moneda', titulo: 'moneda', requerida: false, pestana: 'Info principal',
    ayuda: 'GTQ por omisión. Ver la hoja Monedas.', alias: ['Moneda', 'Currency'] },
  { clave: 'terminos_pago', titulo: 'terminos_pago', requerida: false, tipo: 'opcion',
    vocabulario: TERMINOS_DE_PAGO, pestana: 'Info principal',
    ayuda: 'De aquí sale la fecha de vencimiento de cada factura de compra. Por omisión: contado.',
    alias: ['Términos de pago', 'Terminos de pago', 'Payment Terms', 'Condiciones de pago'] },
  { clave: 'estado', titulo: 'estado', requerida: false, tipo: 'opcion', vocabulario: ESTADO,
    pestana: 'Info principal', ayuda: 'activo o inactivo. Por omisión: activo.',
    alias: ['Estado', 'Status'] },

  // ── Impuestos ──────────────────────────────────────────────────────────────
  { clave: 'tratamiento_fiscal', titulo: 'tratamiento_fiscal', requerida: false, tipo: 'opcion',
    vocabulario: TRATAMIENTO_FISCAL, pestana: 'Impuestos',
    ayuda: 'Decide qué se le retiene y si su IVA es acreditable. Por omisión: contribuyente.',
    alias: ['Tratamiento fiscal', 'Régimen', 'Regimen'] },
  { clave: 'impuesto_iva', titulo: 'impuesto_iva', requerida: false, pestana: 'Impuestos',
    ayuda: 'Código del impuesto de COMPRAS que se le aplica. Ver la hoja Impuestos.',
    alias: ['Impuesto de compras', 'Impuesto IVA', 'Impuesto', 'Tax'] },
  { clave: 'retencion_iva', titulo: 'retencion_iva', requerida: false, pestana: 'Impuestos',
    ayuda: 'Porcentaje de retención de IVA que se le aplica al pagarle.',
    alias: ['Porcentaje de retención IVA', 'Retención IVA'] },
  { clave: 'retiene_isr', titulo: 'retiene_isr', requerida: false, tipo: 'si_no',
    pestana: 'Impuestos', ayuda: 'Sí / No. ¿Hay que retenerle ISR al pagarle?',
    alias: ['¿Retener ISR?', 'Retiene ISR'] },
  { clave: 'impuesto_isr', titulo: 'impuesto_isr', requerida: false, pestana: 'Impuestos',
    ayuda: 'Código del impuesto de ISR, solo si se le retiene.',
    alias: ['Impuesto ISR aplicable', 'Impuesto ISR'] },

  // ── Cuentas ────────────────────────────────────────────────────────────────
  { clave: 'cuenta_contacto', titulo: 'cuenta_por_pagar', requerida: false, pestana: 'Cuentas',
    ayuda: 'Código de su cuenta por pagar. Vacío = la cuenta por defecto de la empresa. Ver la hoja Cuentas.',
    alias: ['Cuenta por pagar (CxP)', 'Cuenta por pagar', 'CxP'] },
  { clave: 'cuenta_contrapartida', titulo: 'cuenta_gastos', requerida: false, pestana: 'Cuentas',
    ayuda: 'Código de la cuenta de gasto por defecto para sus facturas.',
    alias: ['Cuenta de gastos por defecto', 'Cuenta de gastos', 'Cuenta de gasto'] },

  // ── Dirección ──────────────────────────────────────────────────────────────
  { clave: 'direccion', titulo: 'direccion', requerida: false, pestana: 'Dirección',
    ayuda: 'Dirección fiscal.', alias: ['Dirección', 'Direccion', 'Address', 'Billing Address'] },
  { clave: 'ciudad', titulo: 'ciudad', requerida: false, pestana: 'Dirección',
    ayuda: 'Ciudad.', alias: ['Ciudad', 'City'] },
  { clave: 'departamento', titulo: 'departamento', requerida: false, pestana: 'Dirección',
    ayuda: 'Departamento.', alias: ['Departamento', 'State', 'Estado/Provincia'] },
  { clave: 'codigo_postal', titulo: 'codigo_postal', requerida: false, pestana: 'Dirección',
    ayuda: 'Código postal.', alias: ['Código postal', 'Codigo postal', 'Zip'] },
  { clave: 'pais', titulo: 'pais', requerida: false, pestana: 'Dirección',
    ayuda: 'País. GT por omisión.', alias: ['País', 'Pais', 'Country'] },

  // ── Otros ──────────────────────────────────────────────────────────────────
  { clave: 'saldo_inicial', titulo: 'saldo_inicial', requerida: false, tipo: 'moneda',
    pestana: 'Otros',
    ayuda: 'Una cifra única en quetzales. Si la cartera está en dólares o son varias facturas con distinto tipo de cambio, deja esto vacío y usa la hoja «Saldos pendientes».',
    alias: ['Saldo inicial (Q)', 'Saldo inicial', 'Opening Balance', 'Saldo'] },
  { clave: 'fecha_saldo_inicial', titulo: 'fecha_saldo_inicial', requerida: false, tipo: 'fecha',
    pestana: 'Otros',
    ayuda: 'Fecha del saldo inicial. Vacío = la fecha de migración de la empresa.',
    alias: ['Fecha de saldo inicial', 'Fecha saldo inicial', 'Opening Balance Date'] },
  { clave: 'notas', titulo: 'notas', requerida: false, pestana: 'Otros',
    ayuda: 'Notas internas, libre. El proveedor no las ve.',
    alias: ['Notas internas', 'Notas', 'Notes'] },
]

export const ESPECIFICACION_PROVEEDORES: EspecificacionDeCarga = {
  hoja: 'Proveedores',
  columnas: COLUMNAS_PROVEEDORES,
}

/**
 * Las hojas de apoyo con las listas de ESTA empresa.
 *
 * Para proveedores interesan las cuentas de pasivo y de gasto; con el catálogo
 * entero delante, encontrar la que va en «cuenta_por_pagar» es otro trabajo
 * manual. Si el filtro no deja nada, se mandan todas antes que ninguna.
 */
export function hojasDeProveedores(catalogo: CatalogoDeProveedores): HojaDeApoyo[] {
  const utiles = catalogo.cuentas.filter(c =>
    c.type === 'liability' || c.type === 'expense' || /^[256]/.test(c.code))
  const cuentas = utiles.length ? utiles : catalogo.cuentas

  return [
    { nombre: 'Cuentas',   filas: cuentas.map(c => ({ codigo: c.code, nombre: c.name })) },
    { nombre: 'Impuestos', filas: catalogo.impuestos.map(i => ({ codigo: i.code, nombre: i.name, tasa: i.rate ?? '' })) },
    { nombre: 'Monedas',   filas: catalogo.monedas.map(m => ({ moneda: m })) },
  ]
}

const ejemploDeProveedor = (catalogo: CatalogoDeProveedores): Record<string, unknown> => {
  const cuenta = (patron: RegExp) => catalogo.cuentas.find(c => patron.test(c.code))?.code ?? ''
  const iva = catalogo.impuestos.find(i => /iva/i.test(i.name) || /iva/i.test(i.code))?.code ?? ''
  return {
    nombre: 'IMPORTADORA EJEMPLO, S.A.', tipo: 'empresa',
    razon_social: 'IMPORTADORA EJEMPLO, SOCIEDAD ANONIMA',
    nit: '8765432-1', nombres: '', apellidos: '',
    email: 'ventas@ejemplo.com.gt', telefono: '2222-4444', celular: '',
    sitio_web: '', moneda: catalogo.monedas[0] ?? 'GTQ',
    terminos_pago: '30_dias', estado: 'activo',
    tratamiento_fiscal: 'contribuyente', impuesto_iva: iva,
    retencion_iva: '', retiene_isr: 'No', impuesto_isr: '',
    cuenta_por_pagar: cuenta(/^21/), cuenta_gastos: cuenta(/^[56]/),
    direccion: '12 Avenida 5-30 zona 1', ciudad: 'Guatemala',
    departamento: 'Guatemala', codigo_postal: '01001', pais: 'GT',
    saldo_inicial: 8500, fecha_saldo_inicial: '01/01/2026', notas: '',
  }
}

export function construirPlantillaProveedores(catalogo: CatalogoDeProveedores): ArrayBuffer {
  return armarLibro(
    ESPECIFICACION_PROVEEDORES, [], hojasDeProveedores(catalogo),
    [ejemploDeProveedor(catalogo)],
    { spec: ESPECIFICACION_SALDOS, ejemplos: ejemplosDeSaldos('8765432-1') })
}
