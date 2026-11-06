/**
 * Lo que vale una línea de un documento.
 *
 * El cálculo vive aquí, fuera del editor de líneas, porque además de la
 * pantalla donde se captura lo necesitan las que solo muestran: el detalle de
 * una cotización y su impresión leen el monto que viene guardado, y las
 * cotizaciones guardadas antes de arreglar esto no lo traen. Sin un lugar
 * común, la misma fórmula terminaría escrita cuatro veces.
 *
 * Es el mismo cálculo que `montos-de-linea.ts` en el backend.
 */

/** Redondeo a centavos. Se aplica línea por línea, no al final. */
const centavos = (n: number) => Math.round(n * 100) / 100

export interface MontosDeLinea {
  /** Base: lo que vale la línea sin impuesto. */
  lineNet:   number
  /** El impuesto de la línea. */
  lineTax:   number
  /** Lo que se cobra por la línea: base más impuesto. */
  lineTotal: number
}

/**
 * Los montos de una línea a partir de lo que el usuario escribió.
 *
 * `taxInclusive` es lo normal en Guatemala: el precio ya trae el IVA dentro y
 * de ahí se extrae la base. Un descuento en quetzales exactos manda sobre el
 * porcentaje — es como lo trae el DTE del SAT.
 */
export function montosDeLinea(item: any): MontosDeLinea {
  const cantidad = Number(item?.quantity ?? 0)  || 0
  const precio   = Number(item?.unitPrice ?? 0) || 0
  const tasa     = Number(item?.taxPercent ?? 0) || 0
  const dtoPct   = Number(item?.discountPercent ?? 0) || 0
  const dtoQ     = Number(item?.discountAmount ?? 0)  || 0

  const bruto = dtoQ > 0
    ? Math.max(0, cantidad * precio - dtoQ)
    : cantidad * precio * (1 - dtoPct / 100)

  if (item?.taxInclusive && tasa > 0) {
    // El precio YA incluye el impuesto → extraer la base
    const lineNet   = centavos(bruto / (1 + tasa / 100))
    const lineTotal = centavos(bruto)
    return { lineNet, lineTax: centavos(lineTotal - lineNet), lineTotal }
  }

  // El precio excluye el impuesto → sumarlo sobre la base
  const lineNet = centavos(bruto)
  const lineTax = centavos(lineNet * (tasa / 100))
  return { lineNet, lineTax, lineTotal: centavos(lineNet + lineTax) }
}

/**
 * El total de una línea para mostrarlo.
 *
 * Usa el monto guardado si lo hay, y si no lo calcula. Las cotizaciones se
 * guardaban sin él —la pantalla mandaba solo lo que el usuario escribió— y la
 * columna entera salía «Q NaN». El backend ya lo guarda, pero las que se
 * crearon antes solo lo tendrán si alguien las vuelve a guardar, y esas
 * también tienen que poder verse e imprimirse.
 */
export function totalDeLinea(item: any): number {
  const guardado = Number(item?.lineTotal)
  return Number.isFinite(guardado) ? guardado : montosDeLinea(item).lineTotal
}
