import { Row, Col, Card, Statistic, Typography, Table, Tag, Space } from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined,
  DollarOutlined, FileTextOutlined,
  ShoppingCartOutlined, WarningOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const recentInvoices = [
  { id: 'FAC-2024-00001', client: 'Empresa ABC S.A.', amount: 'Q 12,500.00', status: 'paid',    date: '01/05/2024' },
  { id: 'FAC-2024-00002', client: 'Comercial XYZ',    amount: 'Q  3,200.00', status: 'pending', date: '03/05/2024' },
  { id: 'FAC-2024-00003', client: 'Grupo Industrial', amount: 'Q  8,750.00', status: 'overdue', date: '28/04/2024' },
  { id: 'FAC-2024-00004', client: 'Tech Solutions GT', amount: 'Q  1,980.00', status: 'draft',  date: '05/05/2024' },
]

const statusColors: Record<string, string> = {
  paid: 'success', pending: 'processing', overdue: 'error', draft: 'default',
}
const statusLabels: Record<string, string> = {
  paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida', draft: 'Borrador',
}

const columns = [
  { title: 'Número',  dataIndex: 'id',     key: 'id', render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
  { title: 'Cliente', dataIndex: 'client', key: 'client' },
  { title: 'Monto',   dataIndex: 'amount', key: 'amount', render: (v: string) => <Text strong>{v}</Text> },
  { title: 'Fecha',   dataIndex: 'date',   key: 'date',   render: (v: string) => <Text type="secondary">{v}</Text> },
  { title: 'Estado',  dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag> },
]

export default function DashboardPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
        <Text type="secondary">Resumen general del período — Mayo 2024</Text>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Ventas del mes',       value: 125800, prefix: 'Q', icon: <DollarOutlined />,      color: '#1B3A6B', trend: '+12%', up: true },
          { title: 'Por cobrar',           value: 48200,  prefix: 'Q', icon: <FileTextOutlined />,    color: '#2563eb', trend: '-5%',  up: false },
          { title: 'Compras del mes',      value: 67300,  prefix: 'Q', icon: <ShoppingCartOutlined />, color: '#7c3aed', trend: '+8%',  up: true },
          { title: 'Facturas vencidas',    value: 3,      prefix: '',  icon: <WarningOutlined />,     color: '#dc2626', trend: '+1',   up: false },
        ].map((kpi) => (
          <Col xs={24} sm={12} lg={6} key={kpi.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Statistic
                  title={<Text style={{ fontSize: 13 }}>{kpi.title}</Text>}
                  value={kpi.value}
                  prefix={kpi.prefix}
                  precision={kpi.prefix === 'Q' ? 2 : 0}
                  valueStyle={{ color: kpi.color, fontSize: 22, fontWeight: 700 }}
                />
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: `${kpi.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: kpi.color, fontSize: 20,
                }}>
                  {kpi.icon}
                </div>
              </div>
              <Space style={{ marginTop: 8 }}>
                {kpi.up ? <ArrowUpOutlined style={{ color: '#52c41a' }} /> : <ArrowDownOutlined style={{ color: '#ff4d4f' }} />}
                <Text style={{ color: kpi.up ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>{kpi.trend} vs mes anterior</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla de facturas recientes */}
      <Card
        title="Facturas recientes"
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        extra={<Text type="secondary" style={{ fontSize: 12, cursor: 'pointer', color: '#1B3A6B' }}>Ver todas →</Text>}
      >
        <Table
          dataSource={recentInvoices}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}
