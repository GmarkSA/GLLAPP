import { useEffect, useState } from 'react'

export function useVersionCheck(intervalMs = 2 * 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    // Versión con la que se compiló el bundle que se está ejecutando AHORA.
    // Comparar contra esta constante (no contra la primera lectura del servidor)
    // permite detectar que corremos código viejo incluso en la carga inicial —
    // el caso de un index.html cacheado apuntando a un bundle anterior.
    const current = String(__APP_VERSION__ ?? '')
    let notified = false

    const check = async () => {
      if (notified) return
      if (!current || current === 'dev') return
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const v = String(data.v ?? '')
        if (!v || v === 'dev') return
        if (v !== current) {
          notified = true
          setHasUpdate(true)
        }
      } catch {
        // ignorar errores de red silenciosamente
      }
    }

    // Check on visibility change — cuando el usuario vuelve a la pestaña
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)

    check()
    const id = setInterval(check, intervalMs)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])

  return hasUpdate
}
