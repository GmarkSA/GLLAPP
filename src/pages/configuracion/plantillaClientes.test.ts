import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  construirPlantillaClientes, ESPECIFICACION_CLIENTES, COLUMNAS_CLIENTES,
  type CatalogoDeClientes,
} from './plantillaClientes'
import { analizarArchivo, leerFilas } from './plantillaCarga'

/**
 * La plantilla de carga masiva de clientes.
 *
 * La anterior era un CSV de cuatro columnas: nombre, NIT, correo y teléfono.
 * Un cliente cargado así entra sin tratamiento fiscal, sin cuenta por cobrar y
 * sin términos de pago — hay que abrir los 300 uno por uno después, que es
 * justo lo que la carga viene a evitar. Esta lleva los campos de las cinco
 * pestañas de la pantalla de crear cliente.
 */
const CATALOGO: CatalogoDeClientes = {
  cuentas: [
    { code: '110201', name: 'Clientes nacionales', type: 'asset' },
    { code: '410001', name: 'Ventas de mercadería', type: 'revenue' },
    { code: '610001', name: 'Gastos de administración', type: 'expense' },
  ],
  impuestos: [{ code: 'IVA-V', name: 'IVA por pagar', rate: 12 }],
  monedas: ['GTQ', 'USD'],
}

const hojas = (datos: ArrayBuffer) => XLSX.read(datos, { type: 'array' }).SheetNames
const filasDe = (datos: ArrayBuffer, hoja: string) =>
  XLSX.utils.sheet_to_json<Record<string, unknown>>(
    XLSX.read(datos, { type: 'array' }).Sheets[hoja], { defval: '' })

/** Escribe un archivo como lo haría el usuario, para leerlo de vuelta. */
const archivoCon = (filas: Array<Record<string, unknown>>): ArrayBuffer => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Clientes')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('la plantilla de clientes', () => {
  it('lleva los campos de las cinco pestañas de la pantalla', () => {
    const pestanas = new Set(COLUMNAS_CLIENTES.map(c => c.pestana))
    expect([...pestanas].sort()).toEqual(
      ['Cuentas', 'Dirección', 'Impuestos', 'Info principal', 'Otros'])
  })

  it('trae los campos que la plantilla vieja no tenía', () => {
    const claves = COLUMNAS_CLIENTES.map(c => c.clave)
    for (const campo of ['tratamiento_fiscal', 'cuenta_por_cobrar', 'terminos_pago',
                         'limite_credito', 'moneda', 'cuenta_ingresos']) {
      expect([campo, claves.includes(campo)]).toEqual([campo, true])
    }
  })

  it('solo el nombre es obligatorio', () => {
    expect(COLUMNAS_CLIENTES.filter(c => c.requerida).map(c => c.clave)).toEqual(['nombre'])
  })

  it('el libro trae la hoja de datos, el ejemplo, los saldos y las listas', () => {
    expect(hojas(construirPlantillaClientes(CATALOGO))).toEqual([
      'Clientes', 'Ejemplo',
      // Los saldos pendientes van documento por documento: cada factura vieja
      // trae su propio tipo de cambio y una cifra única no puede representarlo.
      'Saldos pendientes', 'Ejemplo Saldos pendientes',
      'Instrucciones', 'Cuentas', 'Impuestos', 'Monedas',
    ])
  })

  it('la hoja de datos nace vacía: solo encabezados', () => {
    expect(filasDe(construirPlantillaClientes(CATALOGO), 'Clientes')).toHaveLength(0)
  })

  /**
   * El ejemplo va aparte. Como primera fila de la hoja de datos se cargaría
   * junto con las de verdad y aparecería un cliente inventado en la cartera.
   */
  it('el ejemplo está en su propia hoja, no mezclado con los datos', () => {
    const libro = construirPlantillaClientes(CATALOGO)
    expect(filasDe(libro, 'Ejemplo')).toHaveLength(1)
    expect(filasDe(libro, 'Clientes')).toHaveLength(0)
  })

  it('las listas son las de la empresa, no ejemplos inventados', () => {
    const libro = construirPlantillaClientes(CATALOGO)
    expect(filasDe(libro, 'Cuentas').map(f => f.codigo)).toContain('110201')
    expect(filasDe(libro, 'Impuestos').map(f => f.codigo)).toContain('IVA-V')
    expect(filasDe(libro, 'Monedas').map(f => f.moneda)).toEqual(['GTQ', 'USD'])
  })

  it('las instrucciones dicen de qué tipo es cada columna y qué valores admite', () => {
    const inst = filasDe(construirPlantillaClientes(CATALOGO), 'Instrucciones')
    const fiscal = inst.find(f => f.columna === 'tratamiento_fiscal')!
    expect(fiscal.tipo_de_dato).toBe('Una de las opciones')
    expect(String(fiscal.valores_admitidos)).toContain('exportador')
  })
})

describe('leer el archivo que sube el usuario', () => {
  it('convierte cada columna al tipo que le toca', () => {
    const [fila] = leerFilas(archivoCon([{
      nombre: 'FERRETERÍA LA ROCA', limite_credito: 'Q 25,000.00',
      retiene_isr: 'Sí', fecha_saldo_inicial: '15/03/2026',
      tratamiento_fiscal: 'exportador',
    }]), ESPECIFICACION_CLIENTES)

    expect(fila.nombre).toBe('FERRETERÍA LA ROCA')
    expect(fila.limite_credito).toBe(25000)
    expect(fila.retiene_isr).toBe(true)
    expect(fila.fecha_saldo_inicial).toBe('2026-03-15')
    expect(fila.tratamiento_fiscal).toBe('exportador')
  })

  /**
   * Guatemala es UTC-6. Leer «15/03/2026» con `new Date(...)` lo interpreta
   * como medianoche UTC y al mostrarlo retrocede al 14: el saldo inicial
   * quedaría un día antes del que escribió el contador.
   */
  it('la fecha no retrocede un día', () => {
    const [fila] = leerFilas(archivoCon([
      { nombre: 'X', fecha_saldo_inicial: '01/01/2026' }]), ESPECIFICACION_CLIENTES)
    expect(fila.fecha_saldo_inicial).toBe('2026-01-01')
  })

  it('reconoce los encabezados de otro sistema', () => {
    const [fila] = leerFilas(archivoCon([{
      'Display Name': 'CLIENTE DE ZOHO', 'Tax ID': '9876543-2',
      'Payment Terms': '30 dias', 'Credit Limit': 1000,
    }]), ESPECIFICACION_CLIENTES)

    expect(fila.nombre).toBe('CLIENTE DE ZOHO')
    expect(fila.nit).toBe('9876543-2')
    expect(fila.terminos_pago).toBe('net_30')
    expect(fila.limite_credito).toBe(1000)
  })

  /**
   * Una columna que el archivo no trae no debe aparecer como vacía: si
   * apareciera, la carga borraría el dato que el cliente ya tiene guardado.
   */
  it('una columna que el archivo no trae no llega como vacía', () => {
    const [fila] = leerFilas(archivoCon([{ nombre: 'SOLO NOMBRE' }]), ESPECIFICACION_CLIENTES)
    expect(Object.keys(fila)).toEqual(['nombre'])
  })
})

describe('la revisión antes de cargar', () => {
  it('dice cuántas filas trae y qué columnas reconoció', () => {
    const a = analizarArchivo(archivoCon([
      { nombre: 'UNO', nit: '1-1' }, { nombre: 'DOS', nit: '2-2' },
    ]), ESPECIFICACION_CLIENTES)

    expect(a.filas).toBe(2)
    expect(a.columnas.map(c => c.encabezado)).toEqual(['nombre', 'nit'])
    expect(a.columnas.every(c => c.reconocida)).toBe(true)
  })

  it('marca la columna que no reconoce, en vez de ignorarla en silencio', () => {
    const a = analizarArchivo(archivoCon([
      { nombre: 'UNO', color_favorito: 'azul' }]), ESPECIFICACION_CLIENTES)
    expect(a.columnas.find(c => c.encabezado === 'color_favorito')!.reconocida).toBe(false)
  })

  it('avisa cuando un número no es un número', () => {
    const a = analizarArchivo(archivoCon([
      { nombre: 'UNO', limite_credito: 'mucho' }]), ESPECIFICACION_CLIENTES)
    expect(a.columnas.find(c => c.encabezado === 'limite_credito')!.problema)
      .toContain('no es un número')
  })

  it('avisa cuando una opción no está entre las admitidas, y dice cuáles son', () => {
    const a = analizarArchivo(archivoCon([
      { nombre: 'UNO', tratamiento_fiscal: 'regimen raro' }]), ESPECIFICACION_CLIENTES)
    const problema = a.columnas.find(c => c.encabezado === 'tratamiento_fiscal')!.problema!
    expect(problema).toContain('no es un valor admitido')
    expect(problema).toContain('exportador')
  })

  it('avisa cuando falta el nombre, que es lo único obligatorio', () => {
    const a = analizarArchivo(archivoCon([{ nit: '1-1' }]), ESPECIFICACION_CLIENTES)
    expect(a.faltantes).toEqual(['nombre'])
  })

  it('la plantilla en blanco se analiza sin datos y no reporta faltantes', () => {
    const a = analizarArchivo(construirPlantillaClientes(CATALOGO), ESPECIFICACION_CLIENTES)
    expect(a.filas).toBe(0)
    expect(a.faltantes).toEqual([])
    expect(a.columnas.every(c => c.reconocida)).toBe(true)
  })
})

/**
 * Excel no guarda las fechas como texto: una celda con formato de fecha llega
 * como el número de días desde 1900. El contador que escribe la fecha en la
 * celda y le da formato no debería ver su saldo inicial sin fecha.
 */
describe('fechas escritas en Excel, no a mano', () => {
  it('una celda con formato de fecha se lee igual que uno escrito a mano', () => {
    const wb = XLSX.utils.book_new()
    const hoja = XLSX.utils.json_to_sheet([
      { nombre: 'CON FECHA REAL', fecha_saldo_inicial: new Date(2026, 0, 15) }])
    XLSX.utils.book_append_sheet(wb, hoja, 'Clientes')
    const datos = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const [fila] = leerFilas(datos, ESPECIFICACION_CLIENTES)
    expect(fila.fecha_saldo_inicial).toBe('2026-01-15')
  })
})
