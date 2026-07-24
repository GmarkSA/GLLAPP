import { useState, useEffect, useRef } from 'react'
import { Form, Input, Button, message } from 'antd'
import {
  UserOutlined, LockOutlined,
  LineChartOutlined, FileTextOutlined, SettingOutlined, WalletOutlined,
} from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const EASE = 'cubic-bezier(0.22,0.61,0.36,1)'

const SLIDES = [
  {
    icon: <LineChartOutlined style={{ fontSize: 40 }} />,
    title: 'Estados financieros en tiempo real',
    body: 'Balance, resultados y flujo de caja actualizados al instante, sin cierres manuales.',
  },
  {
    icon: <FileTextOutlined style={{ fontSize: 40 }} />,
    title: 'Facturación FEL automatizada',
    body: 'Emite y certifica ante SAT desde la app, con XML y PDF resguardados en la nube.',
  },
  {
    icon: <SettingOutlined style={{ fontSize: 40 }} />,
    title: 'Automatiza tu contabilidad',
    body: 'Reglas de flujo que registran, concilian y alertan por ti. Menos tareas, más control.',
  },
  {
    icon: <WalletOutlined style={{ fontSize: 40 }} />,
    title: 'Cartera bajo control',
    body: 'Antigüedad de saldos y gestión de cobros con visibilidad total de tu CxC y CxP.',
  },
]

export default function LoginPage() {
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const [wide, setWide] = useState(() => window.innerWidth >= 1050)
  const [activeSlide, setActiveSlide] = useState(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1050)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startAutoPlay = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setActiveSlide(prev => (prev + 1) % SLIDES.length)
    }, 4200)
  }

  useEffect(() => {
    startAutoPlay()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (idx: number) => {
    setActiveSlide(idx)
    startAutoPlay()
  }

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password)
      message.success('Bienvenido')
      const u = useAuthStore.getState().user
      const isCajero = u?.roles?.includes('cajero') && !u?.isSuperAdmin
      navigate(isCajero ? '/pos' : '/dashboard')
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401 || status === 400) {
        message.error('Credenciales incorrectas. Verifica tu email y contraseña.')
      } else if (!status) {
        message.error('No se pudo conectar al servidor. Verifica tu conexión.')
      } else {
        message.error('Error al iniciar sesión. Intenta de nuevo.')
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fbfcfe',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 880,
        display: 'grid',
        gridTemplateColumns: wide ? '1fr 1fr' : '1fr',
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid rgba(10,10,10,0.08)',
        boxShadow: '0 8px 40px rgba(10,10,10,0.08)',
        overflow: 'hidden',
        minHeight: 440,
      }}>

        {/* ── LEFT: form ──────────────────────────────────── */}
        <div style={{
          padding: '44px 46px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {/* Logo */}
          <img src="/lucia-logo.svg?v=3" alt="Lucía" style={{ height: 52, width: 'auto', marginBottom: 22 }} />

          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', color: '#0a0a0a', lineHeight: 1.2 }}>
            Iniciar sesión
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', margin: '0 0 26px' }}>
            para acceder a tu cuenta
          </div>

          <Form layout="vertical" onFinish={onFinish} autoComplete="on">
            <Form.Item
              name="email"
              rules={[{ required: true, type: 'email', message: 'Ingresa un correo válido' }]}
              style={{ marginBottom: 12 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9aa1ab' }} />}
                placeholder="Correo electrónico"
                autoComplete="email"
                size="large"
                style={{ height: 44, borderRadius: 10, background: '#fbfcfe', borderColor: 'rgba(10,10,10,0.14)' }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
              style={{ marginBottom: 6 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9aa1ab' }} />}
                placeholder="Contraseña"
                autoComplete="current-password"
                size="large"
                style={{ height: 44, borderRadius: 10, background: '#fbfcfe', borderColor: 'rgba(10,10,10,0.14)' }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 6 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={isLoading}
                style={{
                  height: 44,
                  borderRadius: 9,
                  background: '#1faec2',
                  border: 'none',
                  fontWeight: 500,
                  fontSize: 14,
                  color: '#fff',
                }}
              >
                Continuar
              </Button>
            </Form.Item>
          </Form>

          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 18, textAlign: 'center' }}>
            ¿No tienes cuenta?{' '}
            <Link to="/register" style={{ color: '#0a6d7f', fontWeight: 600 }}>
              Crear cuenta
            </Link>
          </div>
        </div>

        {/* ── RIGHT: carousel (oculto en < 1050px) ──────── */}
        {wide && (
          <div style={{
            position: 'relative',
            background: '#fbfcfe',
            borderLeft: '1px solid rgba(10,10,10,0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 44px',
          }}>
            {/* Inset cian border */}
            <div style={{
              position: 'absolute',
              top: 10, right: 10, bottom: 10, left: 10,
              border: '1.5px solid rgba(31,174,194,0.35)',
              borderRadius: 12,
              pointerEvents: 'none',
            }} />

            {/* Slides */}
            <div style={{
              position: 'relative',
              width: '100%',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 260,
            }}>
              {SLIDES.map((slide, i) => {
                const active = i === activeSlide
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: 0, right: 0, bottom: 0, left: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '0 10px',
                      opacity: active ? 1 : 0,
                      transform: active ? 'translateX(0)' : 'translateX(16px)',
                      transition: `opacity 480ms ${EASE}, transform 480ms ${EASE}`,
                      pointerEvents: active ? 'auto' : 'none',
                    }}
                  >
                    <div style={{
                      width: 88, height: 88, borderRadius: 22,
                      background: '#e6fafd',
                      color: '#0a6d7f',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 22, flexShrink: 0,
                    }}>
                      {slide.icon}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 10px', color: '#0a0a0a', lineHeight: 1.3 }}>
                      {slide.title}
                    </div>
                    <div style={{ fontSize: 14, color: '#6b7280', margin: 0, maxWidth: 280, lineHeight: 1.6 }}>
                      {slide.body}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: 7, marginTop: 24, position: 'relative', zIndex: 2 }}>
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === activeSlide ? 22 : 7,
                    height: 7,
                    borderRadius: i === activeSlide ? 4 : 20,
                    background: i === activeSlide ? '#1faec2' : 'rgba(10,10,10,0.14)',
                    cursor: 'pointer',
                    transition: `all 300ms ${EASE}`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
