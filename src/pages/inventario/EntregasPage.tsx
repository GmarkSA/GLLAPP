import { Typography, Button, Card, Empty, message } from 'antd'
import { PlusOutlined, CarOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function EntregasPage() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <CarOutlined style={{ marginRight: 8 }} /> Entregas
          </Title>
          <Text type="secondary">Notas de entrega y remisiones vinculadas a pedidos de venta</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }}
          onClick={() => message.info('Formulario de entrega próximamente')}>
          Nueva entrega
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '📄', title: 'Borrador',  desc: 'Preparar nota de entrega desde pedido' },
          { icon: '📦', title: 'Enviada',   desc: 'Mercancía despachada, stock reducido' },
          { icon: '✅', title: 'Entregada', desc: 'Confirmación de recepción por cliente' },
        ].map(step => (
          <Card key={step.title} size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{step.icon}</div>
            <div style={{ fontWeight: 600, color: '#1faec2' }}>{step.title}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{step.desc}</Text>
          </Card>
        ))}
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Empty
          image={<CarOutlined style={{ fontSize: 56, color: '#9aa1ab' }} />}
          description={
            <div>
              <div style={{ fontWeight: 600, color: '#1faec2', marginBottom: 8 }}>Módulo de entregas próximamente</div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Las notas de entrega permiten controlar el despacho de mercancía a clientes,
                reduciendo el inventario al confirmar la salida física.
              </Text>
            </div>
          }
          style={{ padding: '40px 20px' }}
        />
      </Card>
    </div>
  )
}
