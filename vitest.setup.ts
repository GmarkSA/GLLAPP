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

// React necesita saber que está en pruebas para agrupar los repintados dentro de
// `act`; sin esta marca avisa en cada prueba que dibuja algo.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
