import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import AnticipoDeAperturaModal, {
  anticipoEnQuetzales, esMonedaLocal,
} from './AnticipoDeAperturaModal'

/**
 * Registrar un anticipo que ya existía antes de Lucía.
 *
 * Los anticipos nacen de un movimiento de banco —el de proveedor desde Pagos
 * Realizados, el de cliente desde Pagos Recibidos— y por eso los dos exigen
 * cuenta bancaria. No había dónde cargar uno migrado: ese dinero se movió
 * antes de Lucía, y pedir un banco obligaba a inventar un movimiento que nunca
 * ocurrió.
 */
describe('cuánto vale el anticipo en quetzales', () => {
  it('en quetzales, el monto es el monto', () => {
    expect(anticipoEnQuetzales(825.72, 'GTQ')).toBe(825.72)
  })

  /** Si el contacto factura en quetzales no hay conversión que hacer. */
  it('en quetzales, una tasa escrita por error no altera nada', () => {
    expect(anticipoEnQuetzales(825.72, 'GTQ', 7.7)).toBe(825.72)
  })

  it('en dólares, se multiplica por su tipo de cambio', () => {
    expect(anticipoEnQuetzales(1000, 'USD', 7.65)).toBe(7650)
  })

  it('en dólares sin tipo de cambio todavía no vale nada', () => {
    expect(anticipoEnQuetzales(1000, 'USD')).toBe(0)
  })

  it('sin monto, vale cero', () => {
    expect(anticipoEnQuetzales(undefined, 'USD', 7.65)).toBe(0)
  })

  it('GTQ y vacío son moneda local; USD no', () => {
    expect(esMonedaLocal('GTQ')).toBe(true)
    expect(esMonedaLocal(undefined)).toBe(true)
    expect(esMonedaLocal('USD')).toBe(false)
  })
})

let contenedor: HTMLDivElement
let root: Root

const CONTACTOS = [
  { id: 'c1', name: 'COMPAÑÍA PROMOTORA DE SERVICIOS, S.A.', currency: 'GTQ' },
  { id: 'c2', name: 'LUUM, S.A.', currency: 'USD' },
]

const montar = (lado: 'cliente' | 'proveedor' = 'proveedor') => {
  act(() => {
    root.render(
      <AnticipoDeAperturaModal
        open
        onClose={() => {}}
        lado={lado}
        contactos={CONTACTOS}
        onGuardar={async () => {}}
      />,
    )
  })
}

/** El modal se monta en un portal: el texto vive en document.body. */
const texto = () => document.body.textContent ?? ''

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  root = createRoot(contenedor)
})

afterEach(() => {
  act(() => root.unmount())
  contenedor.remove()
  document.body.innerHTML = ''
})

describe('el formulario de anticipo de saldo inicial', () => {
  /**
   * Es la razón de existir del modal: no pedir banco. El resto de pantallas de
   * anticipo lo exigen porque ahí sí hay movimiento bancario.
   */
  it('no pide cuenta bancaria', () => {
    montar()
    expect(texto()).not.toContain('Cuenta bancaria')
    expect(texto()).not.toContain('cuenta de caja')
  })

  it('explica contra qué queda la contrapartida', () => {
    montar()
    expect(texto()).toContain('cuenta de saldos de apertura')
  })

  it('pide referencia y fecha', () => {
    montar()
    expect(texto()).toContain('Referencia')
    expect(texto()).toContain('Fecha')
  })

  /** Sin contacto elegido todavía no se sabe la moneda: se asume la local. */
  it('arranca sin pedir tipo de cambio', () => {
    montar()
    expect(texto()).not.toContain('Tipo de cambio')
  })

  it('nombra al contacto según el lado', () => {
    montar('proveedor')
    expect(texto()).toContain('Proveedor')

    act(() => root.unmount())
    document.body.innerHTML = ''
    contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)

    montar('cliente')
    expect(texto()).toContain('Cliente')
  })

  it('dice que se podrá aplicar a facturas', () => {
    montar()
    expect(texto()).toContain('aplicar a facturas')
  })
})
