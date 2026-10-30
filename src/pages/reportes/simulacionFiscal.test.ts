import { describe, it, expect } from 'vitest'
import {
  simularFactura, gastoParaIvaCero, simulaciones,
} from './simulacionFiscal'
import type { Recomendacion } from '../../api/consolidacion'

/**
 * Las cifras de una recomendación de planificación fiscal.
 *
 * La recomendación lo dice en un párrafo: «Mario puede facturar Q 22,429.33 +
 * IVA Q 2,691.52 a Kaizen y su IVA por pagar baja de Q 9,301.95 a Q 6,610.43».
 * Puesto en el cuadro se lee de un vistazo.
 */
const MARIO  = { id: 'mario',  nombre: 'Mario Alberto de Paz' }
const KAIZEN = { id: 'kaizen', nombre: 'KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA' }

const EMPRESAS = [
  { companyId: 'kaizen', legalName: KAIZEN.nombre, ivaPorPagar: 9301.95 },
  { companyId: 'mario',  legalName: MARIO.nombre,  ivaPorPagar: -2691.52 },
]

const RECOMENDACION: Recomendacion = {
  tipo: 'facturar_entre_empresas',
  prioridad: 'media',
  descripcion: 'Mario puede facturar servicios a Kaizen antes del cierre',
  nota: 'Verificar que la operación tenga sustento económico real',
  emisor: MARIO,
  receptor: KAIZEN,
  montoSugerido: 22429.33,
  ahorroEstimadoIva: 2691.52,
}

describe('la factura que propone la recomendación', () => {
  it('trae quién factura a quién', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    expect(s.emisor).toBe('Mario Alberto de Paz')
    expect(s.receptor).toContain('KAIZEN')
  })

  it('la base, el IVA y el total de la factura', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    expect(s.base).toBeCloseTo(22429.33, 2)
    expect(s.iva).toBeCloseTo(2691.52, 2)
    expect(s.total).toBeCloseTo(25120.85, 2)
  })

  /** Es el número que el usuario quiere ver: cuánto deja de pagar Kaizen. */
  it('el IVA del receptor, antes y después', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    expect(s.ivaAntes).toBeCloseTo(9301.95, 2)
    expect(s.ivaDespues).toBeCloseTo(6610.43, 2)
  })

  it('deduce la tasa de la propia recomendación, no la asume', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    expect(s.tasa).toBeCloseTo(12, 1)
  })

  /**
   * Comprar más no convierte el IVA por pagar en saldo a favor: solo deja de
   * haber débito que cubrir.
   */
  it('el IVA después nunca baja de cero', () => {
    const s = simularFactura(
      { ...RECOMENDACION, montoSugerido: 100000, ahorroEstimadoIva: 12000 },
      EMPRESAS)!
    expect(s.ivaDespues).toBe(0)
  })

  it('si el receptor no está en el cuadro, parte de cero', () => {
    const s = simularFactura(RECOMENDACION, [])!
    expect(s.ivaAntes).toBe(0)
    expect(s.ivaDespues).toBe(0)
  })
})

describe('qué recomendaciones NO se simulan', () => {
  /** Sin esos datos no se puede calcular nada: no se inventan. */
  it('una sin emisor o sin receptor', () => {
    expect(simularFactura({ ...RECOMENDACION, emisor: undefined }, EMPRESAS)).toBeNull()
    expect(simularFactura({ ...RECOMENDACION, receptor: undefined }, EMPRESAS)).toBeNull()
  })

  it('una sin monto o sin ahorro de IVA', () => {
    expect(simularFactura({ ...RECOMENDACION, montoSugerido: 0 }, EMPRESAS)).toBeNull()
    expect(simularFactura({ ...RECOMENDACION, ahorroEstimadoIva: undefined }, EMPRESAS)).toBeNull()
  })

  it('una recomendación de otro tipo, sin esos campos, se ignora', () => {
    const otra: Recomendacion = {
      tipo: 'revisar_retenciones', prioridad: 'baja',
      descripcion: 'Revisar retenciones', nota: '',
    }
    expect(simulaciones([otra, RECOMENDACION], EMPRESAS)).toHaveLength(1)
  })

  it('sin recomendaciones, no hay simulaciones', () => {
    expect(simulaciones([], EMPRESAS)).toEqual([])
  })
})

/**
 * El renglón de referencia: llevar el IVA a CERO.
 *
 * Después de la factura entre empresas Kaizen todavía paga Q 6,610.43. Para
 * borrar ese saldo comprándole a un tercero tendría que desembolsar
 * Q 55,086.92 más IVA. Puesto al lado del renglón verde, deja clara la
 * diferencia entre mover una factura dentro del grupo y gastar de verdad.
 */
describe('el gasto que dejaría el IVA en cero', () => {
  it('la base sale de dividir el IVA pendiente entre la tasa', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    const g = gastoParaIvaCero(s)!

    expect(g.base).toBeCloseTo(55086.92, 2)
    expect(g.iva).toBeCloseTo(6610.43, 2)
    expect(g.total).toBeCloseTo(61697.35, 2)
  })

  /** El IVA de esa compra es exactamente el que quedaba por pagar. */
  it('el IVA de la compra borra el saldo, ni más ni menos', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    const g = gastoParaIvaCero(s)!

    expect(g.iva).toBeCloseTo(s.ivaDespues, 2)
  })

  /**
   * El contraste que justifica el renglón: ahorrarse el impuesto cuesta nueve
   * veces esa cifra en efectivo.
   */
  it('el desembolso es muchas veces mayor que el impuesto que evita', () => {
    const s = simularFactura(RECOMENDACION, EMPRESAS)!
    const g = gastoParaIvaCero(s)!

    expect(g.total).toBeGreaterThan(g.iva * 9)
  })

  /** Sin saldo que borrar no hay nada que simular. */
  it('si el IVA ya quedó en cero, no hay gasto que mostrar', () => {
    const s = simularFactura(
      { ...RECOMENDACION, montoSugerido: 100000, ahorroEstimadoIva: 12000 },
      EMPRESAS)!

    expect(s.ivaDespues).toBe(0)
    expect(gastoParaIvaCero(s)).toBeNull()
  })

  /** Usa la tasa de la recomendación, no un 12% fijo. */
  it('respeta la tasa de la recomendación', () => {
    const s = simularFactura(
      { ...RECOMENDACION, montoSugerido: 10000, ahorroEstimadoIva: 1000 }, EMPRESAS)!
    const g = gastoParaIvaCero(s)!

    expect(s.tasa).toBeCloseTo(10, 2)
    // Quedan 8,301.95 de IVA; al 10% la base es 83,019.50
    expect(g.base).toBeCloseTo(83019.50, 2)
  })
})
