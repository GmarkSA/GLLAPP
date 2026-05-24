import { Form, Input, Button, Card, Typography, Divider, message } from 'antd'
import { UserOutlined, LockOutlined, BookOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

export default function LoginPage() {
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password)
      message.success('Bienvenido a ContaERP')
      navigate('/dashboard')
    } catch {
      message.error('Credenciales incorrectas. Verifica tu email y contraseña.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1B3A6B 0%, #2563eb 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 420, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'linear-gradient(135deg, #1B3A6B, #2563eb)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <BookOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0, color: '#1B3A6B' }}>ContaERP</Title>
          <Text type="secondary">Sistema ERP — GLL Consulting</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish} size="large" autoComplete="on">
          <Form.Item
            name="email"
            label="Correo electrónico"
            rules={[{ required: true, type: 'email', message: 'Ingresa un correo válido' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="usuario@empresa.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" autoComplete="current-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isLoading}
              style={{ height: 44, background: '#1B3A6B' }}
            >
              Iniciar Sesión
            </Button>
          </Form.Item>
        </Form>

        <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>¿No tienes cuenta?</Text></Divider>

        <Link to="/register">
          <Button block size="large" style={{ height: 44 }}>
            Crear empresa gratis
          </Button>
        </Link>
      </Card>
    </div>
  )
}
