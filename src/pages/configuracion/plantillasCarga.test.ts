import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { analizarArchivo, leerFilas } from './plantillaCarga'
import {
  construirPlantillaProveedores, ESPECIFICACION_PROVEEDORES, COLUMNAS_PROVEEDORES,
} from './plantillaProveedores'
import {
  construirPlantillaCuentas, ESPECIFICACION_CUENTAS, COLUMNAS_CUENTAS,
} from './plantillaCuentas'
import { construirPlantillaClientes } from './plantillaClientes'
import { ESPECIFICACION_SALDOS, COLUMNAS_SALDOS } from './plantillaSaldosPendientes'

/**
 * Las plantillas de proveedores y del catálogo de cuentas.
 *
 * Las dos salen del mismo motor que la de clientes; lo que se prueba aquí es
 * lo que cada una tiene de propio: que el proveedor nombre su cuenta POR PAGAR
 * y no la de clientes, y que el catálogo de cuentas traiga el tipo y el saldo
 * normal, que son los dos campos que, mal cargados, desordenan el balance
 * entero.
 */
const hojas = (datos: ArrayBuffer) => XLSX.read(datos, { type: 'array' }).SheetNames
const filasDe = (datos: ArrayBuffer, hoja: string) =>
  XLSX.utils.sheet_to_json<Record<string, unknown>>(
    XLSX.read(datos, { type: 'array' }).Sheets[hoja], { defval: '' })

const archivoCon = (hoja: string, filas: Array<Record<string, unknown>>): ArrayBuffer => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), hoja)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

const CAT_PROVEEDORES = {
  cuentas: [
    { code: '210101', name: 'Proveedores nacionales', type: 'liability' },
    { code: '610001', name: 'Gastos de administración', type: 'expense' },
    { code: '110201', name: 'Clientes nacionales', type: 'asset' },
  ],
  impuestos: [{ code: 'IVA-C', name: 'IVA por cobrar', rate: 12 }],
  monedas: ['GTQ', 'USD'],
}

describe('la plantilla de proveedores', () => {
  it('nombra la cuenta POR PAGAR, no la de clientes', () => {
    const titulos = COLUMNAS_PROVEEDORES.map(c => c.titulo)
    expect(titulos).toContain('cuenta_por_pagar')
    expect(titulos).toContain('cuenta_gastos')
    expect(titulos).not.toContain('cuenta_por_cobrar')
  })

  /**
   * El Excel dice «cuenta_por_pagar» y el backend espera «cuenta_contacto»,
   * que es el campo genérico que comparten cliente y proveedor. Si esa
   * traducción se rompe, la cuenta del proveedor se pierde en silencio.
   */
  it('al leer, la cuenta por pagar llega como la cuenta del contacto', () => {
    const [fila] = leerFilas(
      archivoCon('Proveedores', [{ nombre: 'X', cuenta_por_pagar: '210101', cuenta_gastos: '610001' }]),
      ESPECIFICACION_PROVEEDORES)

    expect(fila.cuenta_contacto).toBe('210101')
    expect(fila.cuenta_contrapartida).toBe('610001')
  })

  it('ofrece las cuentas de pasivo y gasto, no las de clientes', () => {
    const cuentas = filasDe(construirPlantillaProveedores(CAT_PROVEEDORES), 'Cuentas')
      .map(c => c.codigo)
    expect(cuentas).toContain('210101')
    expect(cuentas).toContain('610001')
    expect(cuentas).not.toContain('110201')
  })

  it('el libro trae la hoja de datos, el ejemplo, los saldos y las listas', () => {
    expect(hojas(construirPlantillaProveedores(CAT_PROVEEDORES))).toEqual([
      'Proveedores', 'Ejemplo',
      'Saldos pendientes', 'Ejemplo Saldos pendientes',
      'Instrucciones', 'Cuentas', 'Impuestos', 'Monedas',
    ])
  })

  it('admite el régimen de pequeño contribuyente, que el de clientes no tiene', () => {
    const [fila] = leerFilas(
      archivoCon('Proveedores', [{ nombre: 'X', tratamiento_fiscal: 'pequeño contribuyente' }]),
      ESPECIFICACION_PROVEEDORES)
    expect(fila.tratamiento_fiscal).toBe('pequeno_contribuyente')
  })
})

describe('la plantilla del catálogo de cuentas', () => {
  const CAT = {
    existentes: [{ code: '1101', name: 'Caja y bancos' }],
    grupos: ['Activo corriente', 'Pasivo corriente'],
  }

  it('el código, el nombre y el tipo son obligatorios', () => {
    expect(COLUMNAS_CUENTAS.filter(c => c.requerida).map(c => c.clave))
      .toEqual(['codigo', 'nombre', 'tipo'])
  })

  it('traduce los cinco tipos del balance', () => {
    const filas = leerFilas(archivoCon('Cuentas', [
      { codigo: '1', nombre: 'A', tipo: 'activo' },
      { codigo: '2', nombre: 'B', tipo: 'pasivo' },
      { codigo: '3', nombre: 'C', tipo: 'patrimonio' },
      { codigo: '4', nombre: 'D', tipo: 'ingresos' },
      { codigo: '5', nombre: 'E', tipo: 'gasto' },
    ]), ESPECIFICACION_CUENTAS)

    expect(filas.map(f => f.tipo))
      .toEqual(['asset', 'liability', 'equity', 'revenue', 'expense'])
  })

  /**
   * Al revés el balance cuadra pero con los signos invertidos: la cuenta sale
   * en negativo y nadie entiende por qué.
   */
  it('entiende el saldo normal como deudor o acreedor', () => {
    const filas = leerFilas(archivoCon('Cuentas', [
      { codigo: '1', nombre: 'A', tipo: 'activo', saldo_normal: 'deudor' },
      { codigo: '2', nombre: 'B', tipo: 'pasivo', saldo_normal: 'acreedora' },
    ]), ESPECIFICACION_CUENTAS)

    expect(filas.map(f => f.saldo_normal)).toEqual(['debit', 'credit'])
  })

  it('lleva los interruptores que hacen que el resto del sistema encuentre sus cuentas', () => {
    const claves = COLUMNAS_CUENTAS.map(c => c.clave)
    for (const flag of ['es_cuenta_clientes', 'es_cuenta_proveedores',
                        'es_cuenta_inventario', 'es_activo_fijo',
                        'exige_centro_costo', 'exige_centro_beneficio']) {
      expect([flag, claves.includes(flag)]).toEqual([flag, true])
    }
  })

  it('los interruptores se leen como Sí / No', () => {
    const [fila] = leerFilas(archivoCon('Cuentas', [
      { codigo: '110201', nombre: 'Clientes', tipo: 'activo',
        es_cuenta_clientes: 'Sí', es_titulo: 'No' }]), ESPECIFICACION_CUENTAS)

    expect(fila.es_cuenta_clientes).toBe(true)
    expect(fila.es_titulo).toBe(false)
  })

  it('avisa cuando falta el tipo, que es obligatorio', () => {
    const a = analizarArchivo(archivoCon('Cuentas', [
      { codigo: '1', nombre: 'A' }]), ESPECIFICACION_CUENTAS)
    expect(a.faltantes).toEqual(['tipo'])
  })

  it('avisa cuando el tipo no es uno de los cinco, y dice cuáles son', () => {
    const a = analizarArchivo(archivoCon('Cuentas', [
      { codigo: '1', nombre: 'A', tipo: 'cuenta rara' }]), ESPECIFICACION_CUENTAS)
    const problema = a.columnas.find(c => c.encabezado === 'tipo')!.problema!
    expect(problema).toContain('no es un valor admitido')
    expect(problema).toContain('patrimonio')
  })

  /**
   * El ejemplo son tres filas encadenadas —una de título con dos hijas—
   * porque el catálogo se entiende por su estructura, no por una fila suelta.
   */
  it('el ejemplo enseña cómo se encadenan las cuentas con su padre', () => {
    const ejemplo = filasDe(construirPlantillaCuentas(CAT), 'Ejemplo')
    // Varias filas encadenadas: lo que enseña es la estructura, no el número.
    expect(ejemplo.length).toBeGreaterThanOrEqual(3)
    expect(ejemplo[0].es_titulo).toBe('Sí')
    expect(ejemplo[1].cuenta_padre).toBe(ejemplo[0].codigo)
  })

  it('trae las cuentas que ya existen, para poder nombrar la cuenta padre', () => {
    expect(filasDe(construirPlantillaCuentas(CAT), 'Cuentas existentes').map(c => c.codigo))
      .toContain('1101')
  })

  it('la plantilla en blanco se analiza sin faltantes', () => {
    const a = analizarArchivo(construirPlantillaCuentas(CAT), ESPECIFICACION_CUENTAS)
    expect(a.filas).toBe(0)
    expect(a.faltantes).toEqual([])
    expect(a.columnas.every(c => c.reconocida)).toBe(true)
  })
})

/**
 * Saldos de apertura en moneda extranjera.
 *
 * El dueño necesita cargar USD 68.54 al 31 de diciembre en su cuenta de banco
 * en dólares. Sin moneda ni tipo de cambio en la plantilla, lo único que podía
 * hacer era escribir el equivalente en quetzales — y entonces la cuenta
 * bancaria se quedaba en cero, porque ella lleva su saldo en dólares.
 */
describe('el saldo de apertura en dólares', () => {
  it('la plantilla trae moneda y tipo de cambio', () => {
    const titulos = COLUMNAS_CUENTAS.map(c => c.titulo)
    expect(titulos).toContain('moneda')
    expect(titulos).toContain('tipo_cambio')
  })

  it('se leen con su tipo: el monto y la tasa como números', () => {
    const [fila] = leerFilas(archivoCon('Cuentas', [{
      codigo: '114001', nombre: 'Banco USD', tipo: 'activo',
      saldo_inicial: '68.54', moneda: 'USD', tipo_cambio: '7.663360',
    }]), ESPECIFICACION_CUENTAS)

    expect(fila.saldo_inicial).toBe(68.54)
    expect(fila.moneda).toBe('USD')
    expect(fila.tipo_cambio).toBeCloseTo(7.66336, 5)
  })

  it('la instrucción avisa que sin tipo de cambio el saldo no entra', () => {
    const inst = filasDe(construirPlantillaCuentas(
      { existentes: [], grupos: [] }), 'Instrucciones')
    const tc = inst.find(f => f.columna === 'tipo_cambio')!
    expect(String(tc.qué_poner)).toContain('OBLIGATORIO')
  })

  it('el ejemplo incluye una cuenta de banco en dólares', () => {
    const ejemplo = filasDe(construirPlantillaCuentas(
      { existentes: [], grupos: [] }), 'Ejemplo')
    const enDolares = ejemplo.find(f => f.moneda === 'USD')
    expect(enDolares).toBeTruthy()
    expect(Number(enDolares!.tipo_cambio)).toBeGreaterThan(7)
  })
})

/**
 * La hoja de saldos pendientes, documento por documento.
 *
 * El dueño confirmó que cada factura vieja trae su propio tipo de cambio. Una
 * sola cifra por contacto no puede representar eso: promediar las tasas daría
 * un número que no coincide con ninguna factura. Y un saldo suelto tampoco
 * tiene vencimiento, así que el reporte de antigüedad no puede clasificarlo.
 */
describe('los saldos pendientes por documento', () => {
  const CAT_CLI = {
    cuentas: [{ code: '110201', name: 'Clientes', type: 'asset' }],
    impuestos: [{ code: 'IVA-V', name: 'IVA', rate: 12 }],
    monedas: ['GTQ', 'USD'],
  }

  it('la plantilla de clientes trae la hoja', () => {
    expect(hojas(construirPlantillaClientes(CAT_CLI as any))).toContain('Saldos pendientes')
  })

  it('y la de proveedores también', () => {
    expect(hojas(construirPlantillaProveedores(CAT_PROVEEDORES))).toContain('Saldos pendientes')
  })

  it('nace vacía: es para llenar', () => {
    expect(filasDe(construirPlantillaClientes(CAT_CLI as any), 'Saldos pendientes')).toHaveLength(0)
  })

  it('cada documento lleva su propio tipo de cambio', () => {
    const filas = leerFilas(archivoCon('Saldos pendientes', [
      { nit: '1-1', documento: 'FAC-1', monto: 2500, moneda: 'USD', tipo_cambio: 7.712340 },
      { nit: '1-1', documento: 'FAC-2', monto: 1800, moneda: 'USD', tipo_cambio: 7.668900 },
    ]), ESPECIFICACION_SALDOS)

    expect(filas).toHaveLength(2)
    expect(filas[0].tipo_cambio).toBeCloseTo(7.71234, 5)
    expect(filas[1].tipo_cambio).toBeCloseTo(7.66890, 5)
    // El mismo contacto, dos tasas: justo lo que una cifra única no representa.
    expect(filas[0].nit).toBe(filas[1].nit)
  })

  it('el NIT y el monto son lo único obligatorio', () => {
    expect(COLUMNAS_SALDOS.filter(c => c.requerida).map(c => c.clave)).toEqual(['nit', 'monto'])
  })

  it('avisa si falta el monto', () => {
    const a = analizarArchivo(archivoCon('Saldos pendientes', [
      { nit: '1-1', documento: 'FAC-1' }]), ESPECIFICACION_SALDOS)
    expect(a.faltantes).toEqual(['monto'])
  })

  it('las fechas se leen sin retroceder un día', () => {
    const [fila] = leerFilas(archivoCon('Saldos pendientes', [
      { nit: '1-1', monto: 100, fecha: '15/11/2025', vencimiento: '15/12/2025' },
    ]), ESPECIFICACION_SALDOS)

    expect(fila.fecha).toBe('2025-11-15')
    expect(fila.vencimiento).toBe('2025-12-15')
  })

  it('el ejemplo enseña el caso que motiva la hoja: un contacto con dos tasas', () => {
    const ej = filasDe(construirPlantillaClientes(CAT_CLI as any), 'Ejemplo Saldos pendientes')
    const enDolares = ej.filter(f => f.moneda === 'USD')
    expect(enDolares.length).toBeGreaterThanOrEqual(2)
    expect(enDolares[0].tipo_cambio).not.toBe(enDolares[1].tipo_cambio)
  })

  it('las instrucciones incluyen las columnas de las dos hojas', () => {
    const inst = filasDe(construirPlantillaClientes(CAT_CLI as any), 'Instrucciones')
      .map(f => f.columna)
    expect(inst).toContain('tratamiento_fiscal')   // de la hoja de clientes
    expect(inst).toContain('tipo_cambio')          // de la de saldos
  })
})
