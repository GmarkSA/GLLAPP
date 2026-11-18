import { describe, it, expect } from 'vitest'
import { revisarContactos } from './revisarContactos'

/**
 * El archivo real de LUUM, en pequeño.
 *
 * 52 filas, ninguna con NIT, diez nombres repetidos —«Punto AG El Campo» once
 * veces, una fila por factura— y dos que ya estaban cargados. Importado tal
 * cual: 52 proveedores nuevos, once «Punto AG El Campo» y «La Paneria»
 * duplicada, sin un solo aviso.
 */
const EXISTENTES = [
  { name: 'LA PANERIA SOCIEDAD ANONIMA', taxId: '28155106', vendorNumber: 'PL-00014' },
  { name: 'PALACE SOCIEDAD ANONIMA',     taxId: '4761065',  vendorNumber: 'PL-00016' },
]

const fila = (nombre: string, saldo: number, nit = '', notas = '') =>
  ({ nombre, saldo_inicial: saldo, nit, notas })

describe('lo que va a pasar al importar', () => {
  it('cuenta las filas que vienen sin NIT', () => {
    const r = revisarContactos([fila('CEMACO', 498.62), fila('CACTUS GRILL', 657)])

    expect(r.sinNit).toBe(2)
    expect(r.total).toBe(2)
  })

  /** Once filas del mismo proveedor: once proveedores, uno por factura. */
  it('señala los nombres que se repiten dentro del archivo', () => {
    const r = revisarContactos([
      fila('Punto AG El Campo', 50.10, '', '701188696'),
      fila('Punto AG El Campo', 60.20, '', '1897549401'),
      fila('Punto AG El Campo', 70.30, '', '4286923535'),
      fila('CEMACO', 498.62),
    ])

    expect(r.repetidos).toHaveLength(1)
    expect(r.repetidos[0].nombre).toBe('Punto AG El Campo')
    expect(r.repetidos[0].veces).toBe(3)
    expect(r.repetidos[0].suma).toBe(180.60)
  })

  /** El nombre llega escrito de otra forma; es el mismo proveedor. */
  it('reconoce a los que ya existen aunque cambien tildes y mayúsculas', () => {
    const r = revisarContactos([fila('La Paneria Sociedad Anonima', 685.30)], EXISTENTES)

    expect(r.yaExisten).toHaveLength(1)
    expect(r.yaExisten[0].numero).toBe('PL-00014')
    expect(r.yaExisten[0].porNit).toBe(false)
  })

  /** Con NIT la coincidencia es segura: el importador hace exactamente eso. */
  it('con NIT lo marca como coincidencia segura', () => {
    const r = revisarContactos([fila('PANADERIA LA PANERIA', 100, '28155106')], EXISTENTES)

    expect(r.yaExisten[0].porNit).toBe(true)
    expect(r.sinNit).toBe(0)
  })

  it('el NIT con guiones es el mismo NIT', () => {
    const r = revisarContactos([fila('Otro nombre', 100, '2815510-6')], EXISTENTES)

    expect(r.yaExisten).toHaveLength(1)
  })

  it('suma lo que entraría de saldo inicial', () => {
    const r = revisarContactos([
      fila('CEMACO', 498.62), fila('CACTUS GRILL', 657), fila('SIN SALDO', 0),
    ])

    expect(r.conSaldo).toBe(2)
    expect(r.sumaDeSaldos).toBe(1155.62)
  })

  it('un archivo limpio no tiene nada que avisar', () => {
    const r = revisarContactos([
      fila('NUEVO UNO', 100, '111111'), fila('NUEVO DOS', 200, '222222'),
    ], EXISTENTES)

    expect(r.sinNit).toBe(0)
    expect(r.repetidos).toHaveLength(0)
    expect(r.yaExisten).toHaveLength(0)
  })

  it('no se cae con un archivo vacío', () => {
    const r = revisarContactos([], EXISTENTES)

    expect(r.total).toBe(0)
    expect(r.sumaDeSaldos).toBe(0)
  })
})

/**
 * La cartera en dólares: dos proveedores, seis facturas, cinco tasas distintas.
 *
 * El caso real de LUUM. La pantalla mostraba «—» en la columna de saldo porque
 * leía `saldo_inicial`, que va vacío cuando el saldo viene por documentos:
 * parecía que los dos proveedores entraban sin nada. Lo que hace falta ver es
 * lo que deben en dólares, a qué tasa y cuánto es en quetzales.
 */
const EN_DOLARES = [
  { nit: 'CF',       documento: 'INV-016944',        monto: 772.50,  moneda: 'USD', tipo_cambio: 7.664504854 },
  { nit: 'CF',       documento: 'INV-017523',        monto: 750,     moneda: 'USD', tipo_cambio: 7.664506667 },
  { nit: 'CF',       documento: 'INV-017524',        monto: 280,     moneda: 'USD', tipo_cambio: 7.6645 },
  { nit: 'CF',       documento: 'INV-017525',        monto: 280,     moneda: 'USD', tipo_cambio: 7.6645 },
  { nit: '41555384', documento: '3205384016',        monto: 0.70,    moneda: 'USD', tipo_cambio: 7.671428571 },
  { nit: 'CF',       documento: '318-2025-00022636', monto: 1182.28, moneda: 'USD', tipo_cambio: 7.675855127 },
]

const EN_DOLARES_FILAS = [
  { nombre: 'The Conscious Home, LLC', nit: 'CF' },
  { nombre: 'ALEJANDRO , TORUN ENGELBERG', nit: '41555384' },
]

describe('el saldo que llega por documentos', () => {
  const r = () => revisarContactos(EN_DOLARES_FILAS, [], EN_DOLARES)

  it('muestra lo que debe en su moneda y en quetzales, por contacto', () => {
    const llc = r().porDocumentos['CF']

    expect(llc.documentos).toBe(5)
    expect(llc.moneda).toBe('USD')
    expect(llc.monto).toBeCloseTo(3264.78, 2)
    expect(llc.enQuetzales).toBeCloseTo(25036.34, 2)
  })

  /** Cada factura a SU tasa: el rango se ve, no se promedia. */
  it('con varias tasas, guarda la menor y la mayor', () => {
    const llc = r().porDocumentos['CF']

    expect(llc.tasaMin).toBeCloseTo(7.6645, 6)
    expect(llc.tasaMax).toBeCloseTo(7.675855127, 6)
  })

  it('con una sola factura, la tasa es una sola', () => {
    const torun = r().porDocumentos['41555384']

    expect(torun.documentos).toBe(1)
    expect(torun.tasaMin).toBe(torun.tasaMax)
    expect(torun.enQuetzales).toBeCloseTo(5.37, 2)
  })

  it('el total es la suma de los documentos, no un promedio', () => {
    expect(r().documentos).toBe(6)
    expect(r().documentosEnQuetzales).toBeCloseTo(25041.71, 2)
  })

  /** El NIT se compara tal cual: «CF» une por «CF», igual que en el servidor. */
  it('une por el NIT escrito, no solo por sus dígitos', () => {
    expect(Object.keys(r().porDocumentos).sort()).toEqual(['41555384', 'CF'])
  })

  it('un contacto con facturas en dos monedas queda marcado', () => {
    const mixto = revisarContactos([{ nombre: 'X', nit: '99' }], [], [
      { nit: '99', monto: 100, moneda: 'USD', tipo_cambio: 7.7 },
      { nit: '99', monto: 500, moneda: 'GTQ' },
    ]).porDocumentos['99']

    expect(mixto.moneda).toBe('MIXTA')
    expect(mixto.monto).toBe(0)                    // sumar dos monedas no significa nada
    expect(mixto.enQuetzales).toBeCloseTo(1270, 2) // 770 + 500
  })

  /** Sin tasa el servidor no lo carga: se avisa antes, no después. */
  it('cuenta los documentos en moneda extranjera sin tipo de cambio', () => {
    const r2 = revisarContactos([{ nombre: 'X', nit: '99' }], [], [
      { nit: '99', monto: 100, moneda: 'USD' },
      { nit: '99', monto: 200, moneda: 'USD', tipo_cambio: 7.7 },
    ])

    expect(r2.documentosSinTasa).toBe(1)
    expect(r2.documentos).toBe(1)
    expect(r2.documentosEnQuetzales).toBeCloseTo(1540, 2)
  })

  it('sin hoja de saldos pendientes no hay nada que mostrar', () => {
    const r2 = revisarContactos(EN_DOLARES_FILAS)

    expect(r2.documentos).toBe(0)
    expect(r2.porDocumentos).toEqual({})
  })
})
