import { Form, Input, Button, Card, Typography, message } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

export default function RegisterPage() {
  const { register, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async (values: any) => {
    try {
      await register(values)
      navigate('/onboarding')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al crear la cuenta')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1faec2 0%, #0e8fa0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 460, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
            <Input.Password placeholder="Ej: MiClave123!" />
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
