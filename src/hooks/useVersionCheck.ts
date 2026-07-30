import { useEffect, useState } from 'react'

export function useVersionCheck(intervalMs = 2 * 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let baseline: string | null = null
    let notified = false

    const check = async () => {
      if (notified) return
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const v = String(data.v ?? '')
        if (!v || v === 'dev') return
        if (baseline === null) {
          baseline = v
        } else if (v !== baseline) {
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
