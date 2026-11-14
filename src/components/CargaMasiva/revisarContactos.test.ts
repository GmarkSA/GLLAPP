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
