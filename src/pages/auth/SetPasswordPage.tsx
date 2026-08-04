import { useState } from 'react'
import { Form, Input, Button, message, Result } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { acceptInvitation, resetPassword } from '../../api/auth'

const CARD: React.CSSProperties = {
  width: '100%', maxWidth: 420, background: '#ffffff', borderRadius: 16,
  border: '1px solid rgba(10,10,10,0.08)', boxShadow: '0 8px 40px rgba(10,10,10,0.08)',
  padding: '44px 46px',
}
const INPUT: React.CSSProperties = { height: 44, borderRadius: 10, background: '#fbfcfe', borderColor: 'rgba(10,10,10,0.14)' }

/** Pantalla para definir contraseña vía token: modo invitación (activar cuenta) o reset (recuperación). */
export default function SetPasswordPage({ mode }: { mode: 'invite' | 'reset' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const esInvite = mode === 'invite'
  const titulo = esInvite ? 'Definí tu contraseña' : 'Restablecer contraseña'
  const subtitulo = esInvite ? 'Elegí una contraseña para activar tu cuenta.' : 'Elegí una nueva contraseña para tu cuenta.'

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#fbfcfe', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={CARD}>{children}</div>
    </div>
  )

  if (!token) {
    return wrap(
      <Result status="warning" title="Enlace inválido"
        subTitle="El enlace no tiene un token válido. Solicitá uno nuevo."
        extra={<Link to="/login"><Button type="primary">Ir al inicio de sesión</Button></Link>} />,
    )
  }

  if (done) {
    return wrap(
      <Result status="success" title="¡Listo!"
        subTitle="Tu contraseña quedó configurada. Ya podés iniciar sesión."
        extra={<Link to="/login"><Button type="primary">Iniciar sesión</Button></Link>} />,
    )
  }

  const onFinish = async (vals: { password: string }) => {
    setLoading(true)
    try {
      if (esInvite) await acceptInvitation(token, vals.password)
      else await resetPassword(token, vals.password)
      setDone(true)
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'El enlace no es válido o venció. Solicitá uno nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return wrap(
    <>
      <img src="/lucia-logo.svg?v=3" alt="Lucía" style={{ height: 48, marginBottom: 20 }} />
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0a0a0a', marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{subtitulo}</div>

      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="password" rules={[{ required: true, min: 8, message: 'Mínimo 8 caracteres' }]} style={{ marginBottom: 12 }}>
          <Input.Password prefix={<LockOutlined style={{ color: '#9aa1ab' }} />} placeholder="Nueva contraseña" size="large" style={INPUT} autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" dependencies={['password']} style={{ marginBottom: 12 }}
          rules={[
            { required: true, message: 'Confirmá la contraseña' },
            ({ getFieldValue }) => ({
              validator: (_, v) => (!v || getFieldValue('password') === v) ? Promise.resolve() : Promise.reject(new Error('Las contraseñas no coinciden')),
            }),
          ]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#9aa1ab' }} />} placeholder="Repetí la contraseña" size="large" style={INPUT} autoComplete="new-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" block loading={loading}
            style={{ height: 44, borderRadius: 9, background: '#1faec2', border: 'none', fontWeight: 500 }}>
            {esInvite ? 'Activar cuenta' : 'Guardar contraseña'}
          </Button>
        </Form.Item>
      </Form>
    </>,
  )
}
