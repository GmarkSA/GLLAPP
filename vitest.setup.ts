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
