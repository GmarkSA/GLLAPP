/**
 * El texto que cierra una cotización.
 *
 * Va al final del documento, después del detalle, y es lo último que lee el
 * cliente: por eso se puede editar justo antes de enviarla, cuando ya se sabe
 * con quién se está hablando.
 *
 * Nace con un borrador para que nadie tenga que escribirlo desde cero cada
 * vez. El borrador es a propósito neutro —no promete plazos, descuentos ni
 * condiciones de pago—, porque lo que se deje escrito aquí le llega al
 * cliente tal cual y compromete a la empresa.
 */

export const BORRADOR_DE_CIERRE =
  'Agradecemos la oportunidad de presentarle esta cotización. '
  + 'Quedamos a su disposición para ampliar cualquier punto o ajustar la propuesta '
  + 'a lo que necesite.'

/**
 * Con qué texto se abre el cuadro de envío.
 *
 * Si la cotización ya trae notas escritas, esas mandan: alguien las redactó
 * para este cliente y el borrador no tiene por qué pisarlas.
 */
export function textoDeCierreInicial(notas?: string | null): string {
  const escrito = (notas ?? '').trim()
  return escrito || BORRADOR_DE_CIERRE
}
