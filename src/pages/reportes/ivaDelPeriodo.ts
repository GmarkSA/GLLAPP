/**
 * Cómo se lee el IVA del período en el cuadro consolidado.
 *
 * La columna decía «Q 9,301.95 pagado» y «Q 2,691.52 a favor»: dos cifras
 * positivas que solo se distinguen por una palabra al final. Quien revisa el
 * cuadro tiene que leer cada celda para saber de qué lado está.
 *
 * Con la convención contable de siempre se ve sin leer: lo que se debe va
 * entre paréntesis —negativo, por pagar— y lo que está a favor lleva signo
 * más, igual que la columna de crédito fiscal. El ojo recorre la columna y
 * encuentra solo. Es además como lo presenta cualquier declaración.
 */

const Q = (n: number) =>
  `Q ${Math.abs(Number(n)).toLocaleString('es-GT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`

/** Por debajo de medio centavo no hay saldo que mostrar de un lado ni del otro. */
const CERO = 0.005

export type LadoDelIva = 'por_pagar' | 'a_favor' | 'sin_saldo'

export interface IvaDelPeriodo {
  /** Lo que se escribe en la celda. */
  texto: string
  lado: LadoDelIva
  /** Naranja lo que se debe, verde lo que está a favor. */
  color: string
}

/**
 * El saldo tal como lo guarda el sistema: positivo es POR PAGAR, negativo es
 * a favor. Es la convención del cálculo —débito menos crédito—, y es justo la
 * que confunde al leerla: en la pantalla, lo que se debe se muestra en
 * negativo.
 */
export function ivaDelPeriodo(valor?: number | null): IvaDelPeriodo {
  const v = Number(valor ?? 0)

  if (v > CERO) {
    // Paréntesis: lo que hay que pagar.
    return { texto: `(${Q(v)})`, lado: 'por_pagar', color: '#d46b08' }
  }

  if (v < -CERO) {
    // Signo más: crédito a favor, como en la columna de crédito fiscal.
    return { texto: `+${Q(v)}`, lado: 'a_favor', color: '#2ea172' }
  }

  return { texto: Q(0), lado: 'sin_saldo', color: '#6b7280' }
}

/** El encabezado de la columna. */
export const TITULO_IVA_PERIODO = 'IVA x Pagar / IVA x Cobrar'

/** Lo que explica la convención al pasar el cursor por el encabezado. */
export const AYUDA_IVA_PERIODO =
  'Entre paréntesis, lo que queda POR PAGAR. Con signo más, el crédito a favor '
  + 'que se arrastra al período siguiente. '
  + 'Suma el IVA de los meses YA DECLARADOS del período, con su remanente ya resuelto: '
  + 'los meses sin declaración generada todavía no cuentan aquí, así que puede no '
  + 'coincidir con Débito − Crédito de este cuadro, que sí es la actividad completa. '
  + 'Clic para revisar los documentos y lo declarado.'
