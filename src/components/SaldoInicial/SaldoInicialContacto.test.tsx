import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { Form } from 'antd'
import SaldoInicialContacto from './SaldoInicialContacto'

/**
 * La captura del saldo inicial en la ficha de un contacto.
 *
 * Lo que se fija aquí es la regla que pidió el dueño: si el proveedor factura
 * en quetzales NO debe aparecer la casilla de tipo de cambio —no hay
 * conversión que hacer, y una casilla ahí solo invita a escribir un número que
 * no significa nada—; si factura en dólares, sí, y con ella el equivalente en
 * quetzales.
 */
let contenedor: HTMLDivElement
let root: Root

const montar = (moneda: string | undefined, valores: unknown[] = []) => {
  act(() => {
    root.render(
      <Form initialValues={{ openingBalanceLines: valores }}>
        <SaldoInicialContacto lado="proveedor" moneda={moneda} />
      </Form>,
    )
  })
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

describe('en un proveedor en quetzales', () => {
  it('no muestra tipo de cambio ni equivalente', () => {
    montar('GTQ', [{ referencia: 'FAC-001', monto: 8940 }])

    expect(texto()).not.toContain('Tipo de cambio')
    expect(texto()).not.toContain('Equivalente')
  })

  it('el saldo que entra a los libros es el monto tal cual', () => {
    montar('GTQ', [{ referencia: 'FAC-001', monto: 8940 }])
    expect(texto()).toContain('Q 8,940.00')
  })

  it('explica que se generará la póliza contra la cuenta de orden', () => {
    montar('GTQ', [])
    expect(texto()).toContain('cuenta de orden')
  })
})

describe('en un proveedor en dólares', () => {
  it('sí muestra tipo de cambio y equivalente', () => {
    montar('USD', [{ referencia: 'FAC-001', monto: 1000, tipoCambio: 7.7 }])

    expect(texto()).toContain('Tipo de cambio')
    expect(texto()).toContain('Equivalente Q')
  })

  it('convierte cada documento a su propia tasa', () => {
    montar('USD', [
      { referencia: 'FAC-00120', monto: 2500, tipoCambio: 7.71234 },
      { referencia: 'FAC-00135', monto: 1800, tipoCambio: 7.66890 },
    ])

    // 19,280.85 + 13,804.02 = 33,084.87
    expect(texto()).toContain('Q 33,084.87')
  })

  /**
   * El aviso de que la tasa es la del documento, no la de hoy: es el error que
   * metería la cartera al balance por un valor que no corresponde.
   */
  it('avisa que la tasa es la del documento, no la de hoy', () => {
    montar('USD', [])
    expect(texto()).toContain('SE REGISTRÓ ESE DOCUMENTO')
  })

  it('muestra la moneda del contacto en el encabezado del monto', () => {
    montar('USD', [{ monto: 100, tipoCambio: 7.7 }])
    expect(texto()).toContain('Monto USD')
  })
})

describe('las columnas de captura', () => {
  it('cada documento trae referencia y fecha', () => {
    montar('GTQ', [{ monto: 500 }])

    expect(texto()).toContain('Referencia')
    expect(texto()).toContain('Fecha')
  })

  /** El botón de más, para ir agregando líneas. */
  it('siempre ofrece agregar otro documento', () => {
    montar('GTQ', [])
    expect(texto()).toContain('Agregar documento')
  })

  it('sin documentos no muestra total', () => {
    montar('GTQ', [])
    expect(texto()).not.toContain('Saldo inicial que entra a los libros')
  })
})
