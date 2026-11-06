/**
 * Qué se acepta como logo de la empresa.
 *
 * Estos límites tienen que ser los MISMOS que los del servidor
 * (`shared/identidad/logo-de-la-empresa.ts`). Estuvieron desalineados —la
 * pantalla rechazaba a 1 MB y el servidor aceptaba hasta 2 MB—, así que un
 * logo de tamaño normal se rechazaba antes de salir del navegador y parecía
 * que la subida no funcionaba.
 *
 * El tope manda sobre el peso, no sobre las dimensiones: un PNG de 1600 px a
 * todo color pesa más de 1 MB sin ser un archivo raro.
 */

/** Megabytes, para el texto de la pantalla. */
export const MB_DE_LOGO = 2

export const LIMITE_DE_LOGO = MB_DE_LOGO * 1024 * 1024

/** Lo que el navegador muestra y el servidor sabe guardar. */
export const FORMATOS_DE_LOGO = [
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
]
