/**
 * El régimen fiscal del emisor, para lo que se imprime.
 *
 * Un Pequeño Contribuyente no traslada IVA: paga una cuota fija sobre sus
 * ventas. Un documento suyo con una columna «IVA%» y una línea «IVA (12%)»
 * dice algo que no es cierto, aunque los montos salgan en cero.
 *
 * El código llega con el emisor (`getEmisor`), resuelto por el servidor desde
 * el registro de la empresa, sus ajustes o su perfil FEL.
 */

export const REGIMEN_PEQUENO_CONTRIBUYENTE = 'gt_pequeno_contribuyente'

/** ¿El emisor es Pequeño Contribuyente? */
export const esPequenoContribuyente = (codigo?: string | null): boolean =>
  (codigo ?? '').trim().toLowerCase() === REGIMEN_PEQUENO_CONTRIBUYENTE

/**
 * La leyenda que la SAT exige en los documentos del régimen.
 *
 * Va al pie de la impresión. En una cotización no es obligatoria —no es un
 * documento fiscal—, pero deja claro desde el principio que el precio no
 * lleva IVA y que el cliente no va a tener crédito fiscal por esta compra.
 */
export const LEYENDA_PEQUENO_CONTRIBUYENTE =
  'Factura Pequeño Contribuyente — No genera derecho a crédito fiscal'

/**
 * La tasa de IVA que el documento realmente usó.
 *
 * Es la de sus líneas, no un 12% fijo: un documento puede ser exento, de
 * exportación, o traer varias tasas. Devuelve `null` cuando ninguna línea
 * lleva impuesto, que es cuando no hay nada de IVA que mostrar.
 */
export function tasaDeIvaDelDocumento(items: any[] | null | undefined): number | null {
  const tasas = (items ?? [])
    .map(i => Number(i?.taxPercent ?? 0))
    .filter(t => Number.isFinite(t) && t > 0)

  if (tasas.length === 0) return null
  // Con varias tasas en el mismo documento, ninguna etiqueta sola es correcta.
  return tasas.every(t => t === tasas[0]) ? tasas[0] : null
}
