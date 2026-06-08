import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Card, Col, Row, Typography, Space, Tag } from 'antd'
import {
  BarChartOutlined, LineChartOutlined, FundOutlined,
  AuditOutlined, RiseOutlined, AccountBookOutlined,
  FileTextOutlined, BookOutlined, ShopOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const REPORTS = [
  {
    key: 'balance-general',
    icon: <AuditOutlined style={{ fontSize: 28, color: '#1677ff' }} />,
    title: 'Balance General',
    subtitle: 'Estado de Situación Financiera',
    description: 'Activos, pasivos y capital al cierre de un período. Cumple con NIC 1.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/balance-general',
    color: '#e6f4ff',
  },
  {
    key: 'estado-resultados',
    icon: <LineChartOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    title: 'Estado de Resultados',
    subtitle: 'Estado de Pérdidas y Ganancias',
    description: 'Ingresos, costos, gastos y utilidad neta. Incluye márgenes de rentabilidad.',
    tags: ['SAT', 'Mensual'],
    path: '/reportes/estado-resultados',
    color: '#f6ffed',
  },
  {
    key: 'flujo-efectivo',
    icon: <FundOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    title: 'Flujo de Caja',
    subtitle: 'Estado de Flujo de Efectivo',
    description: 'Movimientos de efectivo: operación, inversión y financiamiento.',
    tags: ['NIC 7'],
    path: '/reportes/flujo-efectivo',
    color: '#f9f0ff',
  },
  {
    key: 'tasas-rendimiento',
    icon: <RiseOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
    title: 'Tasas de Rendimiento',
    subtitle: 'Ratios e Indicadores Financieros',
    description: 'Liquidez, endeudamiento, rentabilidad ROA/ROE y eficiencia operacional.',
    tags: ['Análisis'],
    path: '/reportes/tasas-rendimiento',
    color: '#fff7e6',
  },
  {
    key: 'movimiento-capital',
    icon: <BarChartOutlined style={{ fontSize: 28, color: '#eb2f96' }} />,
    title: 'Movimiento de Capital',
    subtitle: 'Estado de Cambios en el Patrimonio',
    description: 'Variaciones en capital, utilidades retenidas y distribuciones del período.',
    tags: ['NIC 1'],
    path: '/reportes/movimiento-capital',
    color: '#fff0f6',
  },
  {
    key: 'balanza',
    icon: <AccountBookOutlined style={{ fontSize: 28, color: '#13c2c2' }} />,
    title: 'Balanza de Comprobación',
    subtitle: 'Verificación de partida doble',
    description: 'Resumen de débitos y créditos por cuenta. Base para los estados financieros.',
    tags: ['SAT', 'Libro Mayor'],
    path: '/reportes/balanza',
    color: '#e6fffb',
  },
  {
    key: 'libro-diario',
    icon: <FileTextOutlined style={{ fontSize: 28, color: '#1B3A6B' }} />,
    title: 'Libro Diario',
    subtitle: 'Registro cronológico de asientos',
    description: 'Todas las pólizas contables en orden cronológico con detalle de líneas. Requerido por el SAT.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-diario',
    color: '#e6eeff',
  },
  {
    key: 'libro-mayor',
    icon: <BookOutlined style={{ fontSize: 28, color: '#389e0d' }} />,
    title: 'Libro Mayor',
    subtitle: 'Movimientos por cuenta contable',
    description: 'Saldo inicial, movimientos del período y saldo final por cada cuenta del catálogo.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-mayor',
    color: '#f6ffed',
  },
  {
    key: 'libro-compras',
    icon: <ShopOutlined style={{ fontSize: 28, color: '#d46b08' }} />,
    title: 'Libro de Compras',
    subtitle: 'Registro de facturas de proveedor',
    description: 'Detalle de compras del período con IVA, impuestos y totales. Requerido por el SAT.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-compras',
    color: '#fff7e6',
  },
  {
    key: 'libro-ventas',
    icon: <LineChartOutlined style={{ fontSize: 28, color: '#cf1322' }} />,
    title: 'Libro de Ventas',
    subtitle: 'Registro de facturas emitidas',
    description: 'Detalle de ventas del período con IVA, impuestos y totales. Requerido por el SAT.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-ventas',
    color: '#fff1f0',
  },
  {
    key: 'ap-aging',
    icon: <AuditOutlined style={{ fontSize: 28, color: '#7c3aed' }} />,
    title: 'AP Aging — CxP',
    subtitle: 'Antigüedad de Saldos por Pagar',
    description: 'Cuentas por pagar clasificadas por antigüedad: vigentes, 1-30, 31-60, 61-90 y +90 días.',
    tags: ['CxP', 'Análisis'],
    path: '/reportes/ap-aging',
    color: '#f5f3ff',
  },
]

export default function ReportesPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const isHub     = location.pathname === '/reportes' || location.pathname === '/reportes/'

  if (!isHub) return <Outlet />

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Reportes Financieros</Title>
        <Text type="secondary">
          Estados financieros dinámicos · Exportación a Excel y PDF · Cumplimiento SAT Guatemala
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {REPORTS.map(r => (
          <Col xs={24} sm={12} xl={8} key={r.key}>
            <Card
              hoverable
              style={{ borderRadius: 12, cursor: 'pointer', height: '100%', border: '1px solid #f0f0f0' }}
              bodyStyle={{ padding: 20 }}
              onClick={() => navigate(r.path)}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {r.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1B3A6B', lineHeight: 1.3 }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 1 }}>{r.subtitle}</div>
                </div>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>{r.description}</Text>
                <Space size={4} wrap>
                  {r.tags.map(t => (
                    <Tag key={t} style={{ fontSize: 10, borderRadius: 4, margin: 0 }}>{t}</Tag>
                  ))}
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
