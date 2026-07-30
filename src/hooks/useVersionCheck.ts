import { useEffect, useState } from 'react'

export function useVersionCheck(intervalMs = 5 * 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let baseline: string | null = null

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const v = String(data.v ?? '')
        if (!v || v === 'dev') return
        if (baseline === null) {
          baseline = v
        } else if (v !== baseline) {
          setHasUpdate(true)
        }
      } catch {
        // ignorar errores de red silenciosamente
      }
    }

    check()
    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return hasUpdate
}
