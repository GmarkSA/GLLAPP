/**
 * Cómo se ve un estado financiero mensualizado.
 *
 * Esto es tipografía y nada más: tamaño, peso, color y mayúsculas del texto.
 * No toca un dato, ni una cifra, ni un fondo, ni un borde, ni el alto de las
 * filas. Vive aparte porque la idea es homologarlo después al Estado de
 * Resultados, al Flujo y a la Balanza, que hoy comparten el mismo motor de
 * columnas pero cada uno escribe sus tamaños a mano.
 *
 * Lo que cambia respecto de lo que había:
 *
 *  - **La letra no se encoge.** La regla anterior bajaba la cifra a 10px en
 *    cuanto el reporte pasaba de nueve meses, para que las trece columnas
 *    cupieran sin desplazarse. A doce meses eso deja un balance ilegible.
 *    Aquí el tamaño es el mismo con tres columnas que con trece, y cuando no
 *    caben la tabla se corre de lado.
 *  - **Los encabezados de columna** son etiquetas, no títulos: minúscula
 *    alta, gris, con espaciado entre letras. Pesan menos que las cifras, que
 *    es lo que se viene a leer.
 *  - **Las cifras de una cuenta y las de un total miden igual.** Antes de
 *    distinguirlas por tamaño las distingue el peso: un total va en negrita.
 */

/** Los tamaños y colores del reporte, iguales para cualquier número de meses. */
export const PRESENTACION = {
  /** Las cifras: cuentas y totales, el mismo tamaño. */
  cifra: 13,
  /** El nombre de la cuenta o del grupo. */
  nombre: 13,
  /** El código de cuenta, que acompaña sin competir. */
  codigo: 12,
  /** El encabezado de cada columna. */
  encabezado: 11,
  /** El gris de los encabezados y del código. */
  grisEtiqueta: '#6c718a',
  /** El color de una cifra normal y el de una en negativo. */
  cifraNormal: '#21263c',
  cifraNegativa: '#e5484d',
} as const

/**
 * El ancho de las columnas.
 *
 * No es decoración: es la consecuencia aritmética de la letra. Un monto como
 * «587,748.19» a 13px mide unos 72px, y la columna anterior tenía 78 con 16
 * de relleno — 62 útiles—, así que la cifra se partiría en dos renglones. El
 * ancho solo acompaña al tamaño que ya se decidió.
 */
export const ANCHOS = {
  codigo: 64,
  nombre: 260,
  mes: 104,
  /** El acumulado se lee más que los meses: un poco más de sitio. */
  acumulado: 120,
} as const

/** El estilo de un encabezado de columna, que es una etiqueta y no un título. */
export const estiloEncabezado = (alinear: 'left' | 'right' | 'center' = 'right') => ({
  fontSize: PRESENTACION.encabezado,
  fontWeight: 700 as const,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: PRESENTACION.grisEtiqueta,
  textAlign: alinear,
  lineHeight: 1.3,
})
