import type { Recomendacion } from '../../api/consolidacion'

/**
 * Qué pasa si se sigue una recomendación de planificación fiscal.
 *
 * La recomendación dice «Mario puede facturar Q 22,429.33 + IVA a Kaizen y su
 * IVA por pagar baja de Q 9,301.95 a Q 6,610.43», pero eso vive dentro de un
 * párrafo. Puesto en el cuadro, debajo de las empresas, se lee de un vistazo:
 * cuánto factura uno, cuánto deja de pagar el otro.
 *
 * Y hace falta un segundo renglón, de referencia: cuánto habría tenido que
 * GASTAR la empresa para lograr la misma rebaja comprándole a un tercero. Es
 * la misma cifra —el IVA se calcula sobre la misma base—, pero con una
 * diferencia que decide el asunto: ese dinero sale del grupo y no vuelve,
 * mientras que facturando entre empresas se queda adentro.
 */

export interface SimulacionDeFactura {
  emisor: string
  receptor: string
  /** La base que se facturaría. */
  base: number
  /** El IVA de esa factura, que es la rebaja que consigue el receptor. */
  iva: number
  /** Base + IVA: lo que dice la factura. */
  total: number
  /** Lo que el receptor pagaba de IVA antes. */
  ivaAntes: number
  /** Lo que pagaría después. */
  ivaDespues: number
  /** La tasa implícita, deducida de la propia recomendación. */
  tasa: number
}

const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * La empresa que recibiría la factura, buscada en el cuadro.
 *
 * Se necesita su IVA por pagar actual: la recomendación trae la rebaja, no el
 * punto de partida.
 */
export interface EmpresaDelCuadro {
  companyId: string
  legalName?: string
  ivaPorPagar?: number
}

/**
 * Traduce una recomendación a cifras, o devuelve null si no es de las que se
 * pueden simular.
 *
 * Solo aplica a las que proponen facturar entre empresas: hace falta quién
 * emite, quién recibe, por cuánto y cuánto IVA se ahorra. Una recomendación de
 * otro tipo —o incompleta— no se simula en vez de inventarle los datos que le
 * falten.
 */
export function simularFactura(
  r: Recomendacion,
  empresas: EmpresaDelCuadro[],
): SimulacionDeFactura | null {
  const base = Number(r.montoSugerido ?? 0)
  const iva  = Number(r.ahorroEstimadoIva ?? 0)

  if (!r.emisor || !r.receptor) return null
  if (base <= 0.005 || iva <= 0.005) return null

  const receptor = (empresas ?? []).find(e => e.companyId === r.receptor?.id)
  const ivaAntes = centavos(Number(receptor?.ivaPorPagar ?? 0))

  return {
    emisor:   r.emisor.nombre,
    receptor: r.receptor.nombre,
    base:     centavos(base),
    iva:      centavos(iva),
    total:    centavos(base + iva),
    ivaAntes,
    // Nunca baja de cero: el IVA por pagar no se vuelve saldo a favor por
    // comprar más, solo deja de haber débito que cubrir.
    ivaDespues: centavos(Math.max(0, ivaAntes - iva)),
    // En porcentaje: 2,691.52 sobre 22,429.33 son 12.00, no 0.12.
    tasa:     Math.round((iva / base) * 10000) / 100,
  }
}

export interface GastoEquivalente {
  /** La base que habría que comprarle a un tercero. */
  base: number
  iva: number
  /** Lo que saldría de la caja. */
  total: number
}

/**
 * Cuánto habría que gastar con un tercero para lograr la misma rebaja.
 *
 * Da la misma cifra que la factura entre empresas, y eso es justamente lo que
 * hay que mostrar: el IVA se calcula sobre la misma base, así que la «compra»
 * cuesta lo mismo. Lo que cambia es a dónde va el dinero — a un tercero no
 * vuelve; al grupo, sí.
 */
export function gastoEquivalente(sim: SimulacionDeFactura): GastoEquivalente {
  return { base: sim.base, iva: sim.iva, total: sim.total }
}

/**
 * Las simulaciones de todas las recomendaciones que se pueden simular.
 *
 * Varias recomendaciones pueden proponer facturas distintas; cada una se lee
 * por separado porque no son acumulables sin más: la segunda parte de un IVA
 * que la primera ya bajó.
 */
export const simulaciones = (
  recomendaciones: Recomendacion[],
  empresas: EmpresaDelCuadro[],
): SimulacionDeFactura[] =>
  (recomendaciones ?? [])
    .map(r => simularFactura(r, empresas))
    .filter((s): s is SimulacionDeFactura => s !== null)
