import { useEffect, useState } from 'react'

/**
 * Los tres tamaños de pantalla de Lucía.
 *
 * Son los cortes estándar de un ERP, y cada uno pide una forma distinta de
 * mostrar lo mismo:
 *
 *   Teléfono   320–767    menú oculto tras la hamburguesa; las tablas se
 *                         vuelven tarjetas de una columna.
 *   Tablet     768–1024   menú lateral colapsable; formularios en dos
 *                         columnas; las tablas SIGUEN siendo tablas, con
 *                         desplazamiento horizontal.
 *   Escritorio 1025+      menú fijo, varias columnas, la tabla completa con
 *                         todas sus acciones a la vista.
 *
 * El corte importa: una tablet en vertical mide 810px y antes caía del lado
 * del teléfono —le salían tarjetas donde cabe perfectamente una tabla—, y una
 * de 1024 caía del lado del escritorio, con el menú fijo comiéndose el ancho.
 *
 * Los cortes viven SOLO aquí. Una pantalla que invente su propio número
 * rompe la coherencia del sistema.
 */

/** Suscribe a un media query y devuelve si coincide (reactivo al redimensionar). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export type Dispositivo = 'telefono' | 'tablet' | 'escritorio'

/** Los anchos, en un solo lugar. */
export const CORTES = {
  telefono: '(max-width: 767px)',
  tablet:   '(min-width: 768px) and (max-width: 1024px)',
} as const

/** En qué tamaño de pantalla se está viendo la aplicación. */
export function useDispositivo(): Dispositivo {
  const esTelefono = useMediaQuery(CORTES.telefono)
  const esTablet   = useMediaQuery(CORTES.tablet)
  if (esTelefono) return 'telefono'
  if (esTablet)   return 'tablet'
  return 'escritorio'
}

/**
 * ¿Las tablas se muestran como tarjetas?
 *
 * Solo en teléfono. En tablet la tabla cabe y se lee mejor que una pila de
 * tarjetas; lo que necesita es poder correrse de lado.
 */
export const useTarjetas = (): boolean => useMediaQuery(CORTES.telefono)

/**
 * ¿El menú lateral deja de estar fijo?
 *
 * En teléfono y en tablet: hasta 1024 el ancho se necesita para el contenido.
 */
export const useMenuColapsable = (): boolean => useMediaQuery('(max-width: 1024px)')

/**
 * @deprecated El nombre no dice de qué tamaño habla. Usa `useTarjetas()` si
 * se trata de cómo se muestran los datos, o `useMenuColapsable()` si se trata
 * del menú. Se mantiene porque varias pantallas lo usan para alternar entre
 * una vista densa y una compacta, que es el caso del teléfono.
 */
export const useIsMobile = (): boolean => useTarjetas()
