import { describe, it, expect } from 'vitest'
import {
  BALANCE_TYPE_ORDER, BALANCE_TYPE_COLOR, moduloQueAlimenta,
} from './CargasInicialesPage'

/**
 * Las cuentas de orden en la captura de saldos de apertura.
 *
 * La pantalla agrupa las cuentas por `balanceType` y solo dibuja los grupos
 * que están en esta lista. «Cuentas de Orden» faltaba, así que todo el rango
 * 8xx era invisible — y ahí vive la 800001, que es justamente la cuenta contra
 * la que cuadra toda la carga inicial. No se podía capturar ni revisar.
 */
const agrupar = (cuentas: Array<{ code: string; balanceType?: string }>) =>
  BALANCE_TYPE_ORDER
    .map(bt => ({ bt, items: cuentas.filter(c => (c.balanceType ?? 'Otros') === bt) }))
    .filter(g => g.items.length > 0)

const CATALOGO = [
  { code: '110001', balanceType: 'Activo' },
  { code: '211001', balanceType: 'Pasivo' },
  { code: '310001', balanceType: 'Capital' },
  { code: '410001', balanceType: 'Ingresos' },
  { code: '800001', balanceType: 'Cuentas de Orden' },
]

describe('los grupos que muestra la captura', () => {
  it('incluye Cuentas de Orden', () => {
    expect(BALANCE_TYPE_ORDER).toContain('Cuentas de Orden')
  })

  it('la 800001 queda en su grupo y no se pierde', () => {
    const grupos = agrupar(CATALOGO)
    const orden = grupos.find(g => g.bt === 'Cuentas de Orden')

    expect(orden).toBeDefined()
    expect(orden!.items.map(i => i.code)).toEqual(['800001'])
  })

  it('ninguna cuenta del catálogo se queda fuera', () => {
    const mostradas = agrupar(CATALOGO).flatMap(g => g.items.map(i => i.code))
    expect(mostradas.sort()).toEqual(CATALOGO.map(c => c.code).sort())
  })

  /** Sin color, el encabezado del grupo sale sin distintivo. */
  it('el grupo tiene su color', () => {
    expect(BALANCE_TYPE_COLOR['Cuentas de Orden']).toBeTruthy()
  })

  /** Las cuentas de orden van después del estado de resultados, antes de Otros. */
  it('va al final, después de los grupos del estado de resultados', () => {
    expect(BALANCE_TYPE_ORDER.indexOf('Cuentas de Orden'))
      .toBeGreaterThan(BALANCE_TYPE_ORDER.indexOf('Gasto'))
    expect(BALANCE_TYPE_ORDER.indexOf('Cuentas de Orden'))
      .toBeLessThan(BALANCE_TYPE_ORDER.indexOf('Otros'))
  })
})

/**
 * Qué cuentas NO se capturan en esta pantalla.
 *
 * Clientes y proveedores entran por su ficha o su Excel, inventario y activos
 * fijos por su módulo, y cada uno genera su propia póliza contra la cuenta de
 * orden. Capturar aquí el mismo saldo lo contabilizaría dos veces, y la cuenta
 * de orden nunca llegaría a cero — que es la señal de que la apertura está
 * completa.
 */
describe('las cuentas que alimenta otro módulo', () => {
  it('la cuenta de clientes viene de Clientes', () => {
    expect(moduloQueAlimenta({ isCustomerAccount: true })).toBe('Clientes')
  })

  it('la de proveedores, de Proveedores', () => {
    expect(moduloQueAlimenta({ isVendorAccount: true })).toBe('Proveedores')
  })

  it('la de inventario, de Inventario', () => {
    expect(moduloQueAlimenta({ isInventoryAccount: true })).toBe('Inventario')
  })

  it('la de activos fijos, de Activos Fijos', () => {
    expect(moduloQueAlimenta({ isFixedAsset: true })).toBe('Activos Fijos')
  })

  /** Las demás sí se capturan aquí: no deben llevar aviso. */
  it('una cuenta de banco o de impuestos se captura aquí', () => {
    expect(moduloQueAlimenta({})).toBeNull()
    expect(moduloQueAlimenta({
      isCustomerAccount: false, isVendorAccount: false,
      isInventoryAccount: false, isFixedAsset: false,
    })).toBeNull()
  })
})
