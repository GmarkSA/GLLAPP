import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, Spin, Tag, Statistic, Row, Col,
} from 'antd'
import {
  HomeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons'

import { getApAging, type ApAgingRow, type ApAgingBucket } from '../../../api/compras'

const { Title, Text } = Typography

const fmt = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const ageBucketColor: Record<string, string> = {
  current: '#16a34a',
  days_30: '#2563eb',
  days_60: '#d97706',
  days_90: '#dc2626',
  over_90:  '#7c3aed',
}

const columns = [
  {
    title: 'Factura',
    dataIndex: 'invoiceNumber',
    width: 140,
    render: (v: string, row: ApAgingRow) => (
      <Link to={`/compras/facturas/${row.id}`} style={{ fontWeight: 600, fontSize: 13 }}>{v}</Link>
    ),
  },
  {
    title: 'Proveedor',
    dataIndex: 'vendorName',
    ellipsis: true,
  },
  {
    title: 'Fecha',
    dataIndex: 'invoiceDate',
    width: 100,
    render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
  },
  {
    title: 'Vencimiento',
    dataIndex: 'dueDate',
    width: 110,
    render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
  },
  {
    title: 'Días vencido',
    dataIndex: 'daysOverdue',
    width: 110,
    align: 'right' as const,
    render: (v: number) => v <= 0
      ? <Tag color="green">Vigente</Tag>
      : <Tag color={v > 90 ? 'purple' : v > 60 ? 'red' : v > 30 ? 'orange' : 'blue'}>{v} días</Tag>,
  },
  {
    title: 'Total',
    dataIndex: 'total',
    width: 120,
    align: 'right' as const,
    render: (v: number) => <Text style={{ fontSize: 13 }}>{fmt(v)}</Text>,
  },
  {
    title: 'Saldo',
    dataIndex: 'balance',
    width: 120,
    align: 'right' as const,
    render: (v: number) => <Text style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 13 }}>{fmt(v)}</Text>,
  },
]

interface BucketCardProps { label: string; bucket: ApAgingBucket; color: string; expanded: boolean; onToggle: () => void }

function BucketCard({ label, bucket, color, expanded, onToggle }: BucketCardProps) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 12, border: `1px solid ${color}22` }}
      styles={{ header: { background: `${color}11`, borderBottom: `2px solid ${color}` } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color, fontWeight: 700 }}>{label}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{bucket.count} facturas</Text>
            <Text style={{ fontWeight: 700, color, fontSize: 14 }}>{fmt(bucket.total)}</Text>
            <Button size="small" type="text" onClick={onToggle} style={{ color: '#9ca3af', fontSize: 12 }}>
              {expanded ? 'Ocultar' : 'Ver detalle'}
            </Button>
          </div>
        </div>
      }
    >
      {expanded && bucket.items.length > 0 && (
        <Table
          dataSource={bucket.items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginTop: 4 }}
        />
      )}
      {expanded && bucket.items.length === 0 && (
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Sin facturas en este rango.</Text>
      )}
    </Card>
  )
}

export default function ApAgingPage() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    current: false, days_30: false, days_60: false, days_90: false, over_90: false,
  })

  const load = () => {
    setLoading(true)
    getApAging()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Auto-load on mount
  useState(() => { load() })

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Compras' },
          { title: 'AP Aging — Antigüedad de Saldos' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          AP Aging — Cuentas por Pagar
        </Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Actualizar
        </Button>
      </div>

      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {data && (
        <>
          {/* Summary stats */}
          <Row gutter={12} style={{ marginBottom: 20 }}>
            <Col span={4}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#16a34a22' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#16a34a' }}>Vigente</span>}
                  value={data.buckets.current.total}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 16, color: '#16a34a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#2563eb22' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#2563eb' }}>1-30 días</span>}
                  value={data.buckets.days_30.total}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 16, color: '#2563eb' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#d9770622' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#d97706' }}>31-60 días</span>}
                  value={data.buckets.days_60.total}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 16, color: '#d97706' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#dc262622' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#dc2626' }}>61-90 días</span>}
                  value={data.buckets.days_90.total}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 16, color: '#dc2626' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#7c3aed22' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#7c3aed' }}>+90 días</span>}
                  value={data.buckets.over_90.total}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 16, color: '#7c3aed' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ textAlign: 'center', background: '#1B3A6B', borderColor: '#1B3A6B' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>TOTAL CxP</span>}
                  value={data.grandTotal}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 16, color: '#fff', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Overdue alert */}
          {(data.buckets.days_90.total + data.buckets.over_90.total) > 0 && (
            <div style={{
              padding: '10px 16px', background: '#fef2f2', borderRadius: 8,
              border: '1px solid #fca5a5', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <WarningOutlined style={{ color: '#dc2626' }} />
              <Text style={{ color: '#dc2626', fontWeight: 500, fontSize: 13 }}>
                Tiene saldos vencidos por más de 60 días: {fmt(data.buckets.days_90.total + data.buckets.over_90.total)}
              </Text>
            </div>
          )}

          {(data.buckets.current.total + data.buckets.days_30.total + data.buckets.days_60.total + data.buckets.days_90.total + data.buckets.over_90.total) === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#16a34a', marginBottom: 12 }} />
              <div><Text style={{ color: '#16a34a', fontSize: 15 }}>No hay saldos pendientes de pago.</Text></div>
            </div>
          )}

          {/* Bucket cards */}
          {(Object.entries(data.buckets) as [string, ApAgingBucket][]).map(([key, bucket]) => (
            <BucketCard
              key={key}
              label={bucket.label}
              bucket={bucket}
              color={ageBucketColor[key] ?? '#6b7280'}
              expanded={expanded[key]}
              onToggle={() => toggle(key)}
            />
          ))}

          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
            Generado: {new Date(data.generatedAt).toLocaleString('es-GT')}
          </Text>
        </>
      )}
    </div>
  )
}
