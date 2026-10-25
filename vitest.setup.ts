import { afterEach, afterAll } from 'vitest'

/**
 * Lo que el navegador trae de fábrica y jsdom no.
 *
 * Sin esto no se puede dibujar ninguna pantalla en las pruebas: Ant Design
 * consulta el ancho de la ventana al montarse y jsdom no implementa esa consulta,
 * así que cualquier componente suyo revienta antes de aparecer.
 */

// Ant Design pregunta por el tamaño de pantalla para decidir el diseño.
// Se responde siempre «no coincide», que equivale a la vista de escritorio.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener:    () => {},   // retirado del estándar, pero Ant Design aún lo usa
    removeListener: () => {},
    addEventListener:    () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
}

// Varias piezas de Ant Design (la tabla, el selector de rango de fechas) vigilan el
// tamaño de su contenedor. jsdom no trae ese vigilante, así que se le pone uno que
// no hace nada: en pruebas nadie cambia de tamaño.
if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// React necesita saber que está en pruebas para agrupar los repintados dentro de
// `act`; sin esta marca avisa en cada prueba que dibuja algo.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Dejar que React termine lo que agendó, antes de que vitest apague jsdom.
 *
 * Desmontar un componente agenda trabajo en el planificador de React, que
 * corre en un turno posterior del bucle de eventos. Si el archivo de pruebas
 * termina antes de ese turno, vitest desmonta el entorno del navegador y lo
 * que quedó en vuelo revienta contra un `window` o un `sessionStorage` que ya
 * no existen. Vitest lo reporta como «unhandled error» y devuelve código 1
 * aunque las 384 pruebas hayan pasado — ya tumbó el CI dos veces, y al azar:
 * depende de si el turno alcanza a correr o no.
 *
 * Los hooks del archivo de configuración se registran antes que los de cada
 * prueba, así que este corre de último: después del `unmount` de cada suite.
 * Un turno vacío basta para que el planificador termine con el entorno vivo.
 */
afterEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
})

/**
 * Dejar que el proceso de pruebas vacíe su buzón antes de cerrarse.
 *
 * Cada línea que una prueba manda a la consola —un aviso de Ant Design, uno de
 * React— viaja por un canal hacia el proceso principal. Si el archivo termina
 * con una de esas líneas todavía en vuelo, vitest cierra el canal y aborta con
 * «Closing rpc while onUserConsoleLog was pending»: código 1 con las 384
 * pruebas en verde. Pasa al azar, y ya tumbó el CI.
 *
 * Una espera corta al final de cada archivo —no de cada prueba— le da tiempo
 * de vaciarse. Son 27 archivos: medio segundo en toda la corrida.
 */
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 20))
})

/**
 * Un lienzo de mentira, solo para medir texto.
 *
 * jsbarcode mide el ancho del texto legible del código de barras con un canvas
 * —lo único que necesita es `measureText`— y jsdom no trae canvas. Para eso se
 * había agregado el paquete nativo `canvas`, que se compila con node-gyp: en
 * la imagen `node:20-alpine` del Dockerfile no están las librerías de C que
 * pide (cairo, pango, libjpeg), así que `npm ci` fallaba y el despliegue de
 * Railway quedó parado desde entonces.
 *
 * Ya no hace falta: el código de barras se dibuja en SVG, no en PNG, y la
 * medida solo decide si el texto sobresale del símbolo —en un EAN-13 nunca
 * sobresale—. Con responder un ancho aproximado alcanza, y el proyecto se
 * queda sin dependencias que haya que compilar.
 */
const ANCHO_POR_LETRA = 0.6   // proporción habitual de una tipografía de palo seco
window.HTMLCanvasElement.prototype.getContext = function (): any {
  return {
    font: '',
    measureText(texto: string) {
      const tamano = parseFloat(String(this.font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '10')
      return { width: String(texto).length * tamano * ANCHO_POR_LETRA }
    },
  }
}
