import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Tour, Modal, Button, Space, Typography } from 'antd'
import type { TourProps } from 'antd'
import { useAuthStore } from '../../store/authStore'
import { getTourByKey, getTourForPath, markTour, type ModuleTourDef } from './moduleTours'

const TEAL = '#1faec2'
const { Title, Text } = Typography

/** Espera a que el ancla exista en el DOM (la pantalla puede estar cargando). */
function waitForAnchor(anchor: string, timeoutMs = 4000): Promise<void> {
  return new Promise(resolve => {
    const t0 = Date.now()
    const tick = () => {
      if (document.querySelector(`[data-tour="${anchor}"]`) || Date.now() - t0 > timeoutMs) return resolve()
      window.setTimeout(tick, 120)
    }
    tick()
  })
}

/** El ancla puede ser el texto dentro de un botón: se resalta el botón completo. */
function resolveTarget(anchor: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`)
  if (!el) return null
  return (el.closest('.ant-btn') as HTMLElement | null) ?? el
}

/**
 * Motor de tours por módulo (montado una vez en MainLayout). NO se dispara solo:
 * se abre con el evento `lucia:abrir-tour` (detail.key) desde la guía de configuración o la ayuda.
 * Cada parada vive en su pantalla: el motor navega, espera el ancla y resalta el botón real.
 */
export default function ModuleTour() {
  const location = useLocation()
  const navigate = useNavigate()
  const userId   = useAuthStore(s => (s.user as any)?.id as string | undefined)
  const [tour,    setTour]    = useState<ModuleTourDef | null>(null)
  const [welcome, setWelcome] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [current, setCurrent] = useState(0)
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  // Ir a una parada: navegar si hace falta, esperar el ancla y mostrarla
  const goTo = async (t: ModuleTourDef, i: number) => {
    const step = t.steps[i]
    if (!step) return
    setOpen(false)
    if (pathRef.current !== step.route) navigate(step.route)
    await waitForAnchor(step.anchor)
    setCurrent(i)
    setOpen(true)
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail?.key as string | undefined
      const t = (key ? getTourByKey(key) : undefined) ?? getTourForPath(pathRef.current)
      if (!t) return
      setTour(t); setCurrent(0); setOpen(false); setWelcome(true)
    }
    window.addEventListener('lucia:abrir-tour', handler)
    return () => window.removeEventListener('lucia:abrir-tour', handler)
  }, [])

  const finish = (completed: boolean) => {
    if (tour) markTour(userId, tour.key, completed ? 'done' : 'skipped')
    setOpen(false); setWelcome(false)
    // Encadenar con el siguiente módulo (p. ej. Ventas → Compras) sin volver a pedir confirmación
    const next = completed && tour?.nextKey ? getTourByKey(tour.nextKey) : undefined
    if (next) { setTour(next); setCurrent(0); void goTo(next, 0); return }
    // Fin del recorrido: llevar al usuario a la pantalla principal para que elija por dónde empezar
    if (completed && tour?.finishRoute) navigate(tour.finishRoute)
  }

  const steps: TourProps['steps'] = (tour?.steps ?? []).map((s, i, arr) => ({
    title:       s.title,
    description: s.description,
    placement:   s.placement as any,
    target:      () => resolveTarget(s.anchor) as HTMLElement,
    nextButtonProps: i === arr.length - 1 && s.cta ? { children: s.cta, style: { background: '#2ea172', borderColor: '#2ea172' } } : undefined,
  }))

  if (!tour) return null
  return (
    <>
      <Modal open={welcome} footer={null} closable={false} centered width={460} onCancel={() => finish(false)}>
        <div style={{ textAlign: 'center', padding: '6px 4px' }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, margin: '0 auto 12px', background: 'linear-gradient(135deg,#1faec2,#0e8fa0)', color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {tour.name.charAt(0)}
          </div>
          <Title level={4} style={{ margin: '0 0 6px' }}>Tour de {tour.name}</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 14 }}>{tour.intro}</Text>
          <Space size={14} style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            <span><b>{tour.steps.length}</b> paradas</span><span><b>~{tour.seconds}</b> segundos</span><span>Te lleva a cada pantalla · puedes <b>saltarlo</b> cuando quieras</span>
          </Space>
          <div>
            <Space>
              <Button onClick={() => finish(false)}>Ahora no</Button>
              <Button type="primary" style={{ background: TEAL, borderColor: TEAL }} onClick={() => { setWelcome(false); void goTo(tour, 0) }}>Empezar →</Button>
            </Space>
          </div>
        </div>
      </Modal>
      <Tour
        open={open}
        current={current}
        onChange={(i) => { void goTo(tour, i) }}
        steps={steps}
        onClose={() => finish(false)}
        onFinish={() => finish(true)}
        indicatorsRender={(c, total) => <span style={{ fontSize: 12, color: '#6b7280' }}>{tour.name} · parada {c + 1} de {total}</span>}
      />
    </>
  )
}
