import {
  armarLibro, type ColumnaDePlantilla, type EspecificacionDeCarga,
  type HojaDeApoyo, type Vocabulario,
} from './plantillaCarga'

/**
 * La plantilla Excel de la carga masiva de clientes.
 *
 * Lleva los campos de las cinco pestañas de la pantalla de crear cliente
 * —Info principal, Impuestos, Cuentas, Dirección y Otros— y no los cuatro de
 * la plantilla CSV anterior (nombre, NIT, correo, teléfono). Un cliente que
 * entra sin su tratamiento fiscal, sin su cuenta por cobrar y sin sus términos
 * de pago hay que abrirlo uno por uno después, que es justo lo que la carga
 * viene a evitar.
 *
 * El modelo se arma con las cuentas, impuestos y monedas REALES del cliente,
 * no con ejemplos inventados: así nadie tiene que adivinar que su cuenta por
 * cobrar es la 110201.
 */

export interface CatalogoDeClientes {
  cuentas:   Array<{ code: string; name: string; type?: string }>
  impuestos: Array<{ code: string; name: string; rate?: number }>
  monedas:   string[]
}

/** Persona o empresa. Decide si se piden nombre y apellido o razón social. */
const TIPO_CLIENTE: Vocabulario = {
  company:    ['empresa', 'company', 'juridica', 'persona juridica', 'sociedad'],
  individual: ['persona', 'individual', 'natural', 'persona natural'],
  employee:   ['empleado', 'employee', 'colaborador'],
}

/**
 * El tratamiento fiscal, que es lo que decide el IVA de cada factura.
 *
 * Es el campo que más duele cargar mal: un cliente que debía ser exportador y
 * entra como contribuyente factura con IVA 12% una exportación.
 */
const TRATAMIENTO_FISCAL: Vocabulario = {
  taxable:                 ['contribuyente', 'taxable', 'iva 12', 'normal', 'gravado'],
  exempt:                  ['exento', 'exempt', 'exenta'],
  contribuyente_especial:  ['contribuyente_especial', 'especial', 'retenedor', 'retenedor iva'],
  gobierno:                ['gobierno', 'government', 'estado', 'entidad de gobierno'],
  exportador:              ['exportador', 'exporter', 'exportacion', 'iva 0'],
}

const ESTADO: Vocabulario = {
  active:      ['activo', 'active', 'alta'],
  inactive:    ['inactivo', 'inactive', 'baja'],
  blacklisted: ['bloqueado', 'blacklisted', 'lista negra'],
}

/** Los términos de pago tal como los nombra la pantalla. */
const TERMINOS_DE_PAGO: Vocabulario = {
  due_on_receipt: ['contado', 'due_on_receipt', 'al contado', 'inmediato', 'de contado'],
  net_15:         ['15_dias', 'net_15', '15 dias', 'neto 15'],
  net_30:         ['30_dias', 'net_30', '30 dias', 'neto 30'],
  net_45:         ['45_dias', 'net_45', '45 dias', 'neto 45'],
  net_60:         ['60_dias', 'net_60', '60 dias', 'neto 60'],
}

export const COLUMNAS_CLIENTES: ColumnaDePlantilla[] = [
  // ── Info principal ─────────────────────────────────────────────────────────
  { clave: 'nombre', titulo: 'nombre', requerida: true, pestana: 'Info principal',
    ayuda: 'Nombre con el que aparece en facturas y listados. Es el único campo obligatorio.',
    alias: ['Nombre', 'Cliente', 'Display Name', 'Company Name', 'Nombre del cliente'] },
  { clave: 'tipo', titulo: 'tipo', requerida: false, tipo: 'opcion', vocabulario: TIPO_CLIENTE,
    pestana: 'Info principal', ayuda: 'empresa o persona. Por omisión: empresa.',
    alias: ['Tipo de cliente', 'Tipo', 'Customer Type'] },
  { clave: 'razon_social', titulo: 'razon_social', requerida: false, pestana: 'Info principal',
    ayuda: 'Nombre comercial o razón social, si difiere del nombre.',
    alias: ['Nombre comercial', 'Razón social', 'Razon social', 'Legal Name'] },
  { clave: 'nit', titulo: 'nit', requerida: false, pestana: 'Info principal',
    ayuda: 'NIT o CUI. «CF» para consumidor final. Es la llave: si ya existe un cliente con ese NIT, se actualiza en vez de duplicarse.',
    alias: ['NIT', 'NIT / CUI', 'CUI', 'Tax ID', 'RFC', 'Identificación'] },
  { clave: 'nombres', titulo: 'nombres', requerida: false, pestana: 'Info principal',
    ayuda: 'Solo para persona: nombre de pila.', alias: ['Nombre de pila', 'First Name'] },
  { clave: 'apellidos', titulo: 'apellidos', requerida: false, pestana: 'Info principal',
    ayuda: 'Solo para persona: apellidos.', alias: ['Apellido', 'Apellidos', 'Last Name'] },
  { clave: 'email', titulo: 'email', requerida: false, pestana: 'Info principal',
    ayuda: 'Correo donde se le envían las facturas.',
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
    ayuda: 'De aquí sale la fecha de vencimiento de cada factura. Por omisión: contado.',
    alias: ['Términos de pago', 'Terminos de pago', 'Payment Terms', 'Condiciones de pago'] },
  { clave: 'limite_credito', titulo: 'limite_credito', requerida: false, tipo: 'moneda',
    pestana: 'Info principal', ayuda: 'Cuánto se le permite deber. Vacío = sin límite.',
    alias: ['Límite de crédito (Q)', 'Límite de crédito', 'Credit Limit'] },
  { clave: 'estado', titulo: 'estado', requerida: false, tipo: 'opcion', vocabulario: ESTADO,
    pestana: 'Info principal', ayuda: 'activo o inactivo. Por omisión: activo.',
    alias: ['Estado', 'Status'] },

  // ── Impuestos ──────────────────────────────────────────────────────────────
  { clave: 'tratamiento_fiscal', titulo: 'tratamiento_fiscal', requerida: false, tipo: 'opcion',
    vocabulario: TRATAMIENTO_FISCAL, pestana: 'Impuestos',
    ayuda: 'Decide el IVA de sus facturas. Por omisión: contribuyente.',
    alias: ['Tratamiento fiscal del cliente', 'Tratamiento fiscal', 'Régimen'] },
  { clave: 'impuesto_iva', titulo: 'impuesto_iva', requerida: false, pestana: 'Impuestos',
    ayuda: 'Código del impuesto de IVA que se le aplica. Ver la hoja Impuestos.',
    alias: ['Impuesto IVA', 'Impuesto', 'Tax'] },
  { clave: 'retencion_iva', titulo: 'retencion_iva', requerida: false, pestana: 'Impuestos',
    ayuda: 'Porcentaje de retención de IVA, solo si es contribuyente especial o gobierno.',
    alias: ['Porcentaje de retención IVA', 'Retención IVA'] },
  { clave: 'retiene_isr', titulo: 'retiene_isr', requerida: false, tipo: 'si_no',
    pestana: 'Impuestos', ayuda: 'Sí / No. ¿Este cliente retiene ISR al pagar?',
    alias: ['¿Este cliente retiene ISR?', 'Retiene ISR'] },
  { clave: 'impuesto_isr', titulo: 'impuesto_isr', requerida: false, pestana: 'Impuestos',
    ayuda: 'Código del impuesto de ISR, solo si retiene.',
    alias: ['Impuesto ISR aplicable', 'Impuesto ISR'] },

  // ── Cuentas ────────────────────────────────────────────────────────────────
  { clave: 'cuenta_por_cobrar', titulo: 'cuenta_por_cobrar', requerida: false, pestana: 'Cuentas',
    ayuda: 'Código de su cuenta por cobrar. Vacío = la cuenta por defecto de la empresa. Ver la hoja Cuentas.',
    alias: ['Cuenta por cobrar (CxC)', 'Cuenta por cobrar', 'CxC'] },
  { clave: 'cuenta_ingresos', titulo: 'cuenta_ingresos', requerida: false, pestana: 'Cuentas',
    ayuda: 'Código de la cuenta de ingresos por defecto para sus facturas.',
    alias: ['Cuenta de ingresos por defecto', 'Cuenta de ingresos'] },

  // ── Dirección ──────────────────────────────────────────────────────────────
  { clave: 'direccion', titulo: 'direccion', requerida: false, pestana: 'Dirección',
    ayuda: 'Dirección de facturación.', alias: ['Dirección', 'Direccion', 'Address', 'Billing Address'] },
  { clave: 'ciudad', titulo: 'ciudad', requerida: false, pestana: 'Dirección',
    ayuda: 'Ciudad.', alias: ['Ciudad', 'City'] },
  { clave: 'departamento', titulo: 'departamento', requerida: false, pestana: 'Dirección',
    ayuda: 'Departamento.', alias: ['Departamento', 'State', 'Estado/Provincia'] },
  { clave: 'codigo_postal', titulo: 'codigo_postal', requerida: false, pestana: 'Dirección',
    ayuda: 'Código postal.', alias: ['Código postal', 'Codigo postal', 'Zip', 'ZIP Code'] },
  { clave: 'pais', titulo: 'pais', requerida: false, pestana: 'Dirección',
    ayuda: 'País. GT por omisión.', alias: ['País', 'Pais', 'Country'] },

  // ── Otros ──────────────────────────────────────────────────────────────────
  { clave: 'saldo_inicial', titulo: 'saldo_inicial', requerida: false, tipo: 'moneda',
    pestana: 'Otros',
    ayuda: 'Lo que el cliente ya debía al empezar en Lucía. Genera su partida de apertura.',
    alias: ['Saldo inicial (Q)', 'Saldo inicial', 'Opening Balance', 'Saldo'] },
  { clave: 'fecha_saldo_inicial', titulo: 'fecha_saldo_inicial', requerida: false, tipo: 'fecha',
    pestana: 'Otros',
    ayuda: 'Fecha del saldo inicial. Vacío = la fecha de migración de la empresa.',
    alias: ['Fecha de saldo inicial', 'Fecha saldo inicial', 'Opening Balance Date'] },
  { clave: 'portal_habilitado', titulo: 'portal_habilitado', requerida: false, tipo: 'si_no',
    pestana: 'Otros', ayuda: 'Sí / No. ¿Puede entrar al portal del cliente?',
    alias: ['Portal del cliente', 'Portal'] },
  { clave: 'notas', titulo: 'notas', requerida: false, pestana: 'Otros',
    ayuda: 'Notas internas, libre. El cliente no las ve.',
    alias: ['Notas internas', 'Notas', 'Notes'] },
]

export const ESPECIFICACION_CLIENTES: EspecificacionDeCarga = {
  hoja: 'Clientes',
  columnas: COLUMNAS_CLIENTES,
}

/**
 * Las hojas de apoyo: las cuentas, impuestos y monedas de ESTA empresa.
 *
 * Solo las cuentas por cobrar y de ingresos, no el catálogo entero: con 300
 * cuentas delante, encontrar la que va en «cuenta_por_cobrar» es otro trabajo
 * manual. Si no se puede distinguir por tipo, se mandan todas antes que
 * ninguna.
 */
export function hojasDeClientes(catalogo: CatalogoDeClientes): HojaDeApoyo[] {
  const utiles = catalogo.cuentas.filter(c =>
    c.type === 'asset' || c.type === 'revenue' || /^[14]/.test(c.code))
  const cuentas = utiles.length ? utiles : catalogo.cuentas

  return [
    { nombre: 'Cuentas',   filas: cuentas.map(c => ({ codigo: c.code, nombre: c.name })) },
    { nombre: 'Impuestos', filas: catalogo.impuestos.map(i => ({ codigo: i.code, nombre: i.name, tasa: i.rate ?? '' })) },
    { nombre: 'Monedas',   filas: catalogo.monedas.map(m => ({ moneda: m })) },
  ]
}

/** Una fila de ejemplo, en su propia hoja para que no se cargue con las de verdad. */
const ejemploDeCliente = (catalogo: CatalogoDeClientes): Record<string, unknown> => {
  const cuenta = (patron: RegExp) => catalogo.cuentas.find(c => patron.test(c.code))?.code ?? ''
  const iva = catalogo.impuestos.find(i => /iva/i.test(i.name) || /iva/i.test(i.code))?.code ?? ''
  return {
    nombre: 'DISTRIBUIDORA EJEMPLO, S.A.', tipo: 'empresa',
    razon_social: 'DISTRIBUIDORA EJEMPLO, SOCIEDAD ANONIMA',
    nit: '1234567-8', nombres: '', apellidos: '',
    email: 'cobros@ejemplo.com.gt', telefono: '2222-3333', celular: '5555-6666',
    sitio_web: '', moneda: catalogo.monedas[0] ?? 'GTQ',
    terminos_pago: '30_dias', limite_credito: 50000, estado: 'activo',
    tratamiento_fiscal: 'contribuyente', impuesto_iva: iva,
    retencion_iva: '', retiene_isr: 'No', impuesto_isr: '',
    cuenta_por_cobrar: cuenta(/^11/), cuenta_ingresos: cuenta(/^4/),
    direccion: '4a Calle 12-55 zona 10', ciudad: 'Guatemala',
    departamento: 'Guatemala', codigo_postal: '01010', pais: 'GT',
    saldo_inicial: 15000, fecha_saldo_inicial: '01/01/2026',
    portal_habilitado: 'No', notas: '',
  }
}

/** El modelo en blanco, con las listas de la empresa y una hoja de ejemplo. */
export function construirPlantillaClientes(catalogo: CatalogoDeClientes): ArrayBuffer {
  return armarLibro(
    ESPECIFICACION_CLIENTES, [], hojasDeClientes(catalogo), [ejemploDeCliente(catalogo)])
}
