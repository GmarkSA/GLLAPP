import { Form, Input, Button, Card, Typography, message, Tag, Spin } from 'antd'
import { BookOutlined, CheckOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'

const { Title, Text } = Typography

interface PlanOption {
  plan: string
  displayName: string
  priceMonthly: number
  currency: string
  maxCompanies: number
  maxUsers: number
  features: string[]
}

const PLAN_COLOR: Record<string, string> = {
  basic:        '#6b7280',
  contador:     '#1B3A6B',
  professional: '#1faec2',
  enterprise:   '#ff7f00',
}

export default function RegisterPage() {
  const { register, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [plans, setPlans]           = useState<PlanOption[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string>('basic')

  useEffect(() => {
    setLoadingPlans(true)
    api.get('/auth/plans')
      .then(r => {
        const data: PlanOption[] = r.data?.data ?? r.data ?? []
        setPlans(data)
        if (data.length > 0 && !data.find(p => p.plan === selectedPlan)) {
          setSelectedPlan(data[0].plan)
        }
      })
      .catch(() => {/* sin planes = solo se registra sin selección */})
      .finally(() => setLoadingPlans(false))
  }, [])

  const onFinish = async (values: any) => {
    try {
      await register({ ...values, plan: selectedPlan })
      navigate('/onboarding')
    } catch (err: any) {
      if (err?.response?.status === 409) {
        message.error('Este correo ya está registrado. Ve a Iniciar sesión.', 8)
        return
      }
      const raw = err?.response?.data?.message
      const text = Array.isArray(raw) ? raw.join(' · ') : (raw || 'Error al crear la cuenta')
      message.error(text, 6)
    }
  }

  const fmtPrice = (p: PlanOption) => {
    if (p.priceMonthly === 0) return 'Gratis'
    return `${p.currency === 'GTQ' ? 'Q' : '$'} ${p.priceMonthly}/mes`
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1faec2 0%, #0e8fa0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: plans.length > 0 ? 700 : 460, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'linear-gradient(135deg, #1faec2, #0e8fa0)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <BookOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>Crear cuenta</Title>
          <Text type="secondary">Configura tu empresa en minutos</Text>
        </div>

        {/* Selección de plan */}
        {loadingPlans && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Spin size="small" />
          </div>
        )}
        {!loadingPlans && plans.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>
              Elige tu plan
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`, gap: 10 }}>
              {plans.map(p => {
                const active = selectedPlan === p.plan
                const color  = PLAN_COLOR[p.plan] ?? '#1B3A6B'
                return (
                  <div
                    key={p.plan}
                    onClick={() => setSelectedPlan(p.plan)}
                    style={{
                      border: `2px solid ${active ? color : '#e5e7eb'}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      background: active ? `${color}08` : '#fff',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {active && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 18, height: 18, borderRadius: '50%',
                        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CheckOutlined style={{ color: '#fff', fontSize: 10 }} />
                      </div>
                    )}
                    <Tag color={color} style={{ marginBottom: 6, fontWeight: 700 }}>
                      {p.displayName}
                    </Tag>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? color : '#0a0a0a' }}>
                      {fmtPrice(p)}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      {p.maxCompanies >= 999 ? 'Ilimitadas' : p.maxCompanies} emp · {p.maxUsers >= 999 ? 'Ilimitados' : p.maxUsers} usu
                    </div>
                    {p.features?.slice(0, 2).map((f, i) => (
                      <div key={i} style={{ fontSize: 10, color: '#9aa1ab', marginTop: 2 }}>✓ {f}</div>
                    ))}
                  </div>
                )
              })}
            </div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              30 días de trial gratis · Sin tarjeta requerida al registrar
            </Text>
          </div>
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="firstName" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Juan" />
            </Form.Item>
            <Form.Item name="lastName" label="Apellido" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="García" />
            </Form.Item>
          </div>

          <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email', message: 'Correo inválido' }]}>
            <Input placeholder="juan@miempresa.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[
              { required: true, message: 'Requerido' },
              { min: 8, message: 'Mínimo 8 caracteres' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
                message: 'Debe tener mayúscula, minúscula, número y símbolo (@$!%*?&)',
              },
            ]}
          >
            <Input.Password placeholder="Ej: MiClave123!" autoComplete="new-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isLoading}
              style={{ height: 44, background: '#1faec2' }}
            >
              Crear cuenta
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Text type="secondary">¿Ya tienes cuenta? </Text>
          <Link to="/login">Iniciar sesión</Link>
        </div>
      </Card>
    </div>
  )
}
