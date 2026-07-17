import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Card, Col, Row, Typography, Space, Tag } from 'antd'
import {
  BarChartOutlined, LineChartOutlined, FundOutlined,
  AuditOutlined, RiseOutlined, AccountBookOutlined,
  FileTextOutlined, BookOutlined, ShopOutlined,
  PieChartOutlined, DashboardOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const REPORTS = [
  {
    key: 'balance-general',
    icon: <AuditOutlined style={{ fontSize: 28, color: '#1faec2' }} />,
    title: 'Balance General',
    subtitle: 'Estado de Situación Financiera',
    description: 'Activos, pasivos y capital al cierre de un período. Cumple con NIC 1.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/balance-general',
    color: '#e6fafd',
  },
  {
    key: 'estado-resultados',
    icon: <LineChartOutlined style={{ fontSize: 28, color: '#2ea172' }} />,
    title: 'Estado de Resultados',
    subtitle: 'Estado de Pérdidas y Ganancias',
    description: 'Ingresos, costos, gastos y utilidad neta. Incluye márgenes de rentabilidad.',
    tags: ['SAT', 'Mensual'],
    path: '/reportes/estado-resultados',
    color: '#e8f5ef',
  },
  {
    key: 'flujo-efectivo',
    icon: <FundOutlined style={{ fontSize: 28, color: '#1faec2' }} />,
    title: 'Flujo de Caja',
    subtitle: 'Estado de Flujo de Efectivo',
    description: 'Movimientos de efectivo: operación, inversión y financiamiento.',
    tags: ['NIC 7'],
    path: '/reportes/flujo-efectivo',
    color: '#e6fafd',
  },
  {
    key: 'tasas-rendimiento',
    icon: <RiseOutlined style={{ fontSize: 28, color: '#ff7f00' }} />,
    title: 'Tasas de Rendimiento',
    subtitle: 'Ratios e Indicadores Financieros',
    description: 'Liquidez, endeudamiento, rentabilidad ROA/ROE y eficiencia operacional.',
    tags: ['Análisis'],
    path: '/reportes/tasas-rendimiento',
    color: '#fff2e5',
  },
  {
    key: 'movimiento-capital',
    icon: <BarChartOutlined style={{ fontSize: 28, color: '#e5484d' }} />,
    title: 'Movimiento de Capital',
    subtitle: 'Estado de Cambios en el Patrimonio',
    description: 'Variaciones en capital, utilidades retenidas y distribuciones del período.',
    tags: ['NIC 1'],
    path: '/reportes/movimiento-capital',
    color: '#fdecec',
  },
  {
    key: 'balanza',
    icon: <AccountBookOutlined style={{ fontSize: 28, color: '#1faec2' }} />,
    title: 'Balanza de Comprobación',
    subtitle: 'Verificación de partida doble',
    description: 'Resumen de débitos y créditos por cuenta. Base para los estados financieros.',
    tags: ['SAT', 'Libro Mayor'],
    path: '/reportes/balanza',
    color: '#e6fafd',
  },
  {
    key: 'libro-diario',
    icon: <FileTextOutlined style={{ fontSize: 28, color: '#1faec2' }} />,
    title: 'Libro Diario',
    subtitle: 'Registro cronológico de asientos',
    description: 'Todas las pólizas contables en orden cronológico con detalle de líneas. Requerido por el SAT.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-diario',
    color: '#e6fafd',
  },
  {
    key: 'libro-mayor',
    icon: <BookOutlined style={{ fontSize: 28, color: '#2ea172' }} />,
    title: 'Libro Mayor',
    subtitle: 'Movimientos por cuenta contable',
    description: 'Saldo inicial, movimientos del período y saldo final por cada cuenta del catálogo.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-mayor',
    color: '#e8f5ef',
  },
  {
    key: 'libro-compras',
    icon: <ShopOutlined style={{ fontSize: 28, color: '#ff7f00' }} />,
    title: 'Libro de Compras',
    subtitle: 'Registro de facturas de proveedor',
    description: 'Detalle de compras del período con IVA, impuestos y totales. Requerido por el SAT.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-compras',
    color: '#fff2e5',
  },
  {
    key: 'libro-ventas',
    icon: <LineChartOutlined style={{ fontSize: 28, color: '#e5484d' }} />,
    title: 'Libro de Ventas',
    subtitle: 'Registro de facturas emitidas',
    description: 'Detalle de ventas del período con IVA, impuestos y totales. Requerido por el SAT.',
    tags: ['SAT', 'Obligatorio'],
    path: '/reportes/libro-ventas',
    color: '#fdecec',
  },
  {
    key: 'ap-aging',
    icon: <AuditOutlined style={{ fontSize: 28, color: '#ff7f00' }} />,
    title: 'AP Aging — CxP',
    subtitle: 'Antigüedad de Saldos por Pagar',
    description: 'Cuentas por pagar clasificadas por antigüedad: vigentes, 1-30, 31-60, 61-90 y +90 días.',
    tags: ['CxP', 'Análisis'],
    path: '/reportes/ap-aging',
    color: '#fff2e5',
  },
  {
    key: 'centros-beneficio',
    icon: <PieChartOutlined style={{ fontSize: 28, color: '#1faec2' }} />,
    title: 'Rentabilidad por Centro de Beneficio',
    subtitle: 'P&L analítico por línea de negocio',
    description: 'Ingresos, costos y margen por centro de beneficio, con análisis automático de concentración, pérdidas y tendencia.',
    tags: ['Analítico', 'Decisión'],
    path: '/reportes/centros-beneficio',
    color: '#e6fafd',
  },
  {
    key: 'centros-costo',
    icon: <DashboardOutlined style={{ fontSize: 28, color: '#ff7f00' }} />,
    title: 'Ejecución por Centro de Costo',
    subtitle: 'Control presupuestario y proyección',
    description: 'Gasto real vs presupuesto por centro de costo, proyección al cierre, mes de agotamiento y alertas de gasto atípico.',
    tags: ['Analítico', 'Presupuesto'],
    path: '/reportes/centros-costo',
    color: '#fff2e5',
  },
]

export default function ReportesPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const isHub     = location.pathname === '/reportes' || location.pathname === '/reportes/'

  if (!isHub) return <Outlet />

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChartOutlined style={{ fontSize: 22, color: '#1faec2' }} />
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Reportes Financieros</Title>
          <Text type="secondary">
            Estados financieros dinámicos · Exportación a Excel y PDF · Cumplimiento SAT Guatemala
          </Text>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {REPORTS.map(r => (
          <Col xs={24} sm={12} xl={8} key={r.key}>
            <Card
              hoverable
              style={{ borderRadius: 12, cursor: 'pointer', height: '100%', border: '1px solid rgba(10,10,10,0.08)' }}
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
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1faec2', lineHeight: 1.3 }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{r.subtitle}</div>
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
