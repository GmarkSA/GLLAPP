import { useState } from 'react'
import { Form, Input, Button, message, Result } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'

const CARD: React.CSSProperties = {
  width: '100%', maxWidth: 420, background: '#ffffff', borderRadius: 16,
  border: '1px solid rgba(10,10,10,0.08)', boxShadow: '0 8px 40px rgba(10,10,10,0.08)',
  padding: '44px 46px',
}

/** Solicita el correo de recuperación. Siempre muestra el mismo mensaje (no revela si el email existe). */
export default function OlvideContrasenaPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#fbfcfe', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={CARD}>{children}</div>
    </div>
  )

  const onFinish = async (vals: { email: string }) => {
    setLoading(true)
    try {
      await forgotPassword(vals.email)
    } catch {
      // No revelamos errores — mismo mensaje siempre.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return wrap(
      <Result status="success" title="Revisá tu correo"
        subTitle="Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Vence en 1 hora."
        extra={<Link to="/login"><Button type="primary">Volver al inicio de sesión</Button></Link>} />,
    )
  }

  return wrap(
    <>
      <img src="/lucia-logo.svg?v=3" alt="Lucía" style={{ height: 48, marginBottom: 20 }} />
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0a0a0a', marginBottom: 4 }}>¿Olvidaste tu contraseña?</div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Ingresá tu correo y te enviamos un enlace para restablecerla.</div>

      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Ingresá un correo válido' }]} style={{ marginBottom: 12 }}>
          <Input prefix={<UserOutlined style={{ color: '#9aa1ab' }} />} placeholder="Correo electrónico" size="large"
            style={{ height: 44, borderRadius: 10, background: '#fbfcfe', borderColor: 'rgba(10,10,10,0.14)' }} autoComplete="email" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" block loading={loading}
            style={{ height: 44, borderRadius: 9, background: '#1faec2', border: 'none', fontWeight: 500 }}>
            Enviar enlace
          </Button>
        </Form.Item>
      </Form>
      <div style={{ textAlign: 'center' }}>
        <Link to="/login" style={{ fontSize: 13, color: '#0a6d7f' }}>Volver al inicio de sesión</Link>
      </div>
    </>,
  )
}
