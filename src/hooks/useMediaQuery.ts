import { useEffect, useState } from 'react'

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

/** Móvil o tablet en modo portrait (< 992px): el sidebar pasa a menú hamburguesa off-canvas. */
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 991px)')
