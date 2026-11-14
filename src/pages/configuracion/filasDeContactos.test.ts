import { describe, it, expect } from 'vitest'
import { filasDeContactos } from './filasDeContactos'
import { leerFilas } from './plantillaCarga'
import {
  COLUMNAS_PROVEEDORES, ESPECIFICACION_PROVEEDORES, construirPlantillaProveedores,
} from './plantillaProveedores'

/**
 * Bajar los proveedores actuales y volver a subirlos.
 *
 * La plantilla en blanco sirve para empezar de cero. Para corregir en masa lo
 * que ya está cargado hace falta la lista actual EN EL MISMO formato que la
 * carga acepta: se baja, se edita en Excel y se vuelve a subir.
 *
 * Eso solo funciona si lo que se escribe es exactamente lo que la carga lee.
 * Si la plantilla baja «company» y la carga espera «empresa», el archivo
 * vuelve con el tipo vacío y sesenta proveedores pierden un dato que ya
 * tenían. Por eso la prueba es de ida y vuelta: se escribe, se lee y tiene
 * que salir lo mismo.
 */
const CATALOGO = {
  cuentas: [
    { id: 'c-cxp',    code: '211001', name: 'Proveedores Nacionales' },
    { id: 'c-gasto',  code: '510001', name: 'Gastos generales' },
  ],
  impuestos: [
    { id: 'i-iva', code: 'IVA12', name: 'IVA 12%' },
    { id: 'i-isr', code: 'ISR',   name: 'Retención ISR' },
  ],
  monedas: ['GTQ', 'USD'],
}

const PROVEEDOR = {
  name: 'GMARK, SOCIEDAD ANÓNIMA',
  type: 'company',
  legalName: 'GMARK, SOCIEDAD ANONIMA',
  taxId: '467700396',
  email: 'pagos@gmark.gt',
  phone: '2222-3333',
  mobile: '5555-6666',
  website: 'gmark.gt',
  currency: 'GTQ',
  paymentTerms: 'net_30',
  status: 'active',
  taxTreatment: 'taxable',
  taxCode: 'i-iva',
  ivaRetentionCode: '',
  tdsEnabled: true,
  tdsTaxCode: 'i-isr',
  payableAccountId: 'c-cxp',
  expenseAccountId: 'c-gasto',
  billingAddress: { address: '12 Avenida 5-30 zona 1', city: 'Guatemala', state: 'Guatemala', zipCode: '01001', country: 'GT' },
  openingBalance: 2965,
  openingBalanceDate: '2026-01-29',
  notes: 'Proveedor de servicios',
}

const OPCIONES = {
  campoCuenta: 'payableAccountId',
  campoContrapartida: 'expenseAccountId',
  catalogo: CATALOGO,
}

const comoSeEscribe = () => filasDeContactos(COLUMNAS_PROVEEDORES, [PROVEEDOR], OPCIONES)[0]

/** Lo que la carga leería del archivo bajado. */
const idaYVuelta = () => {
  const libro = construirPlantillaProveedores(CATALOGO, [comoSeEscribe()])
  return leerFilas(libro, ESPECIFICACION_PROVEEDORES)[0]
}

describe('los proveedores actuales escritos en la plantilla', () => {
  it('lleva una fila por proveedor', () => {
    expect(filasDeContactos(COLUMNAS_PROVEEDORES, [PROVEEDOR, PROVEEDOR], OPCIONES)).toHaveLength(2)
  })

  it('escribe una columna por cada una de la plantilla', () => {
    const fila = comoSeEscribe()
    for (const col of COLUMNAS_PROVEEDORES) {
      expect(Object.keys(fila)).toContain(col.titulo)
    }
  })

  /** Las cuentas y los impuestos se guardan por id; nadie escribe un id a mano. */
  it('las cuentas salen por código, no por id', () => {
    const fila = comoSeEscribe()

    expect(fila.cuenta_por_pagar).toBe('211001')
    expect(fila.cuenta_gastos).toBe('510001')
    expect(fila.impuesto_iva).toBe('IVA12')
  })

  it('las palabras son las del vocabulario, no los códigos internos', () => {
    const fila = comoSeEscribe()

    expect(fila.tipo).toBe('empresa')
    expect(fila.terminos_pago).toBe('30_dias')
    expect(fila.estado).toBe('activo')
    expect(fila.tratamiento_fiscal).toBe('contribuyente')
    expect(fila.retiene_isr).toBe('Sí')
  })

  it('la fecha va como se escribe en Guatemala', () => {
    expect(comoSeEscribe().fecha_saldo_inicial).toBe('29/01/2026')
  })

  it('la dirección se reparte en sus columnas', () => {
    const fila = comoSeEscribe()

    expect(fila.direccion).toBe('12 Avenida 5-30 zona 1')
    expect(fila.ciudad).toBe('Guatemala')
    expect(fila.codigo_postal).toBe('01001')
  })

  it('un campo vacío queda vacío, no dice «undefined»', () => {
    const fila = filasDeContactos(COLUMNAS_PROVEEDORES, [{ name: 'Solo el nombre' }], OPCIONES)[0]

    expect(fila.nombre).toBe('Solo el nombre')
    expect(fila.email).toBe('')
    expect(String(JSON.stringify(fila))).not.toContain('undefined')
  })
})

describe('lo que se baja se puede volver a subir', () => {
  it('el proveedor vuelve igual', () => {
    const leido = idaYVuelta()

    expect(leido.nombre).toBe('GMARK, SOCIEDAD ANÓNIMA')
    expect(leido.nit).toBe('467700396')
    expect(leido.email).toBe('pagos@gmark.gt')
  })

  /** Lo que la carga vuelve a traducir a códigos internos. */
  it('el tipo, los términos y el estado se reconocen', () => {
    const leido = idaYVuelta()

    expect(leido.tipo).toBe('company')
    expect(leido.terminos_pago).toBe('net_30')
    expect(leido.estado).toBe('active')
    expect(leido.tratamiento_fiscal).toBe('taxable')
    expect(leido.retiene_isr).toBe(true)
  })

  it('las cuentas vuelven por su código', () => {
    const leido = idaYVuelta()

    expect(leido.cuenta_contacto).toBe('211001')
    expect(leido.cuenta_contrapartida).toBe('510001')
  })

  it('el saldo y su fecha sobreviven el viaje', () => {
    const leido = idaYVuelta()

    expect(leido.saldo_inicial).toBe(2965)
    expect(leido.fecha_saldo_inicial).toBe('2026-01-29')
  })

  /**
   * La hoja de ejemplo va aparte, no mezclada con los datos: una fila de
   * ejemplo entre las de verdad se carga junto con ellas y aparece una
   * «IMPORTADORA EJEMPLO» en la cartera.
   */
  it('el ejemplo no se cuela entre los proveedores', () => {
    const libro = construirPlantillaProveedores(CATALOGO, [comoSeEscribe()])
    const filas = leerFilas(libro, ESPECIFICACION_PROVEEDORES)

    expect(filas).toHaveLength(1)
    expect(filas.map(f => f.nombre)).not.toContain('IMPORTADORA EJEMPLO, S.A.')
  })
})
