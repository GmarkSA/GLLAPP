import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import SaldosPorMoneda from './SaldosPorMoneda'

/**
 * La cartera vista en su propia moneda.
 *
 * Los reportes de antigüedad mostraban todo convertido a quetzales. Es
 * correcto para los tramos —la moneda funcional es la que permite sumarlos
 * entre sí—, pero una cartera en dólares también hay que verla EN DÓLARES: es
 * el saldo que el contacto reconoce y el que se revalúa.
 */
let contenedor: HTMLDivElement
let root: Root

const montar = (saldos: any, lado: 'cliente' | 'proveedor' = 'proveedor') => {
  act(() => { root.render(<SaldosPorMoneda saldos={saldos} lado={lado} />) })
}

const texto = () => contenedor.textContent ?? ''

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  root = createRoot(contenedor)
})

afterEach(() => {
  act(() => root.unmount())
  contenedor.remove()
})

const CARTERA = [
  { moneda: 'GTQ', saldo: 8940,     saldoGTQ: 8940,     documentos: 1 },
  { moneda: 'USD', saldo: 10259.26, saldoGTQ: 78799.07, documentos: 2 },
]

describe('el panel de saldos por moneda', () => {
  it('muestra el saldo en su propia moneda', () => {
    montar(CARTERA)
    expect(texto()).toContain('USD 10,259.26')
  })

  /** Es lo que tiene que cuadrar con la cuenta del Balance. */
  it('muestra el equivalente que está en libros', () => {
    montar(CARTERA)
    expect(texto()).toContain('Q 78,799.07')
    expect(texto()).toContain('en libros')
  })

  it('dice cuántos documentos componen cada saldo', () => {
    montar(CARTERA)
    expect(texto()).toContain('2 docs')
    expect(texto()).toContain('1 doc')
  })

  /**
   * Sin cartera en otra moneda no hay nada que separar: el total en quetzales
   * que ya está arriba lo dice todo.
   */
  it('no aparece si todo está en quetzales', () => {
    montar([{ moneda: 'GTQ', saldo: 8940, saldoGTQ: 8940, documentos: 1 }])
    expect(texto()).toBe('')
  })

  it('no aparece si no hay saldos', () => {
    montar([])
    expect(texto()).toBe('')
    montar(undefined)
    expect(texto()).toBe('')
  })

  it('explica que el equivalente es el revaluado', () => {
    montar(CARTERA)
    expect(texto()).toContain('revaluado')
    expect(texto()).toContain('Balance')
  })

  it('nombra el auxiliar según el lado', () => {
    montar(CARTERA, 'cliente')
    expect(texto()).toContain('auxiliar de clientes')
  })
})
