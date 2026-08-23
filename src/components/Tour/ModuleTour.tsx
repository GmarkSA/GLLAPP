import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Tour, Modal, Button, Space, Typography } from 'antd'
import type { TourProps } from 'antd'
import { useAuthStore } from '../../store/authStore'
import { getTourForPath, isTourSeen, markTour, type ModuleTourDef } from './moduleTours'

const TEAL = '#1faec2'
const { Title, Text } = Typography

/**
 * Motor de micro-tours por módulo. Se monta una vez en MainLayout.
 * - Primera visita a la ruta del módulo → bienvenida breve → tour (Tour nativo de AntD) → acción final.
 * - Relanzable con el evento `lucia:abrir-tour` (botón "Tour de este módulo" en la ayuda).
 * - No se muestra en pantallas angostas (los resaltados no caben).
 */
export default function ModuleTour() {
  const location = useLocation()
  const navigate = useNavigate()
  const userId   = useAuthStore(s => (s.user as any)?.id as string | undefined)
  const [tour,    setTour]    = useState<ModuleTourDef | null>(null)
  const [welcome, setWelcome] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [current, setCurrent] = useState(0)

  // Disparo automático: primera visita a la ruta del módulo
  useEffect(() => {
    const t = getTourForPath(location.pathname)
    if (!t || location.pathname !== t.route || isTourSeen(userId, t.key) || window.innerWidth < 900) return
    const id = window.setTimeout(() => { setTour(t); setCurrent(0); setWelcome(true) }, 900) // dejar montar la pantalla
    return () => window.clearTimeout(id)
  }, [location.pathname, userId])

  // Relanzar desde la ayuda (navega a la ruta del módulo si hace falta)
  useEffect(() => {
    const handler = () => {
      const t = getTourForPath(location.pathname)
      if (!t) return
      const delay = location.pathname === t.route ? 150 : 900
      if (location.pathname !== t.route) navigate(t.route)
      window.setTimeout(() => { setTour(t); setCurrent(0); setWelcome(false); setOpen(true) }, delay)
    }
    window.addEventListener('lucia:abrir-tour', handler)
    return () => window.removeEventListener('lucia:abrir-tour', handler)
  }, [location.pathname, navigate])

  const finish = (completed: boolean) => {
    if (tour) markTour(userId, tour.key, completed ? 'done' : 'skipped')
    setOpen(false); setWelcome(false)
    if (completed && tour?.ctaRoute) navigate(tour.ctaRoute)
  }

  const steps: TourProps['steps'] = (tour?.steps ?? []).map((s, i, arr) => ({
    title:       s.title,
    description: s.description,
    placement:   s.placement as any,
    target:      () => document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`) as HTMLElement,
    nextButtonProps: i === arr.length - 1 && s.cta ? { children: s.cta, style: { background: '#2ea172', borderColor: '#2ea172' } } : undefined,
  }))

  if (!tour) return null
  return (
    <>
      <Modal open={welcome} footer={null} closable={false} centered width={440} onCancel={() => finish(false)}>
        <div style={{ textAlign: 'center', padding: '6px 4px' }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, margin: '0 auto 12px', background: 'linear-gradient(135deg,#1faec2,#0e8fa0)', color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {tour.name.charAt(0)}
          </div>
          <Title level={4} style={{ margin: '0 0 6px' }}>Bienvenido a {tour.name}</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 14 }}>{tour.intro}</Text>
          <Space size={14} style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            <span><b>{tour.steps.length}</b> pasos</span><span><b>~{tour.minutes}</b> minuto</span><span>Puedes <b>saltarlo</b> cuando quieras</span>
          </Space>
          <div>
            <Space>
              <Button onClick={() => finish(false)}>Ahora no</Button>
              <Button type="primary" style={{ background: TEAL, borderColor: TEAL }} onClick={() => { setWelcome(false); setCurrent(0); setOpen(true) }}>Empezar →</Button>
            </Space>
          </div>
        </div>
      </Modal>
      <Tour
        open={open}
        current={current}
        onChange={setCurrent}
        steps={steps}
        onClose={() => finish(false)}
        onFinish={() => finish(true)}
        indicatorsRender={(c, total) => <span style={{ fontSize: 12, color: '#6b7280' }}>{tour.name} · paso {c + 1} de {total}</span>}
      />
    </>
  )
}
