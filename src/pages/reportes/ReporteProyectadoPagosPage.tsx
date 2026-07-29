import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Typography, Tag, Space, Button, Row, Col,
  Statistic, Tooltip, DatePicker, Badge,
} from 'antd'
import {
  ReloadOutlined, CalendarOutlined, WarningOutlined,
  DollarOutlined, ArrowRightOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getCashFlowProjection,
  type CashFlowProjection, type CashFlowBucketItem,
} from '../../api/pagosRealizados'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const BUCKET_ORDER = ['overdue', 'd7', 'd15', 'd30', 'd60', 'd90plus']

const BUCKET_STYLE: Record<string, { color: string; badgeColor: string; bg: string }> = {
  overdue:  { color: '#e5484d', badgeColor: '#e5484d',    bg: '#fdecec' },
  d7:       { color: '#ff7f00', badgeColor: '#ff7f00', bg: '#fff2e5' },
  d15:      { color: '#b35900', badgeColor: '#ff7f00',   bg: '#fff2e5' },
  d30:      { color: '#1faec2', badgeColor: '#1faec2',   bg: '#e6fafd' },
  d60:      { color: '#2ea172', badgeColor: '#2ea172',  bg: '#e8f5ef' },
  d90plus:  { color: '#555',    badgeColor: 'default', bg: '#fafbfc' },
}

export default function ReporteProyectadoPagosPage() {
  const navigate   = useNavigate()
  const [data,     setData]    = useState<CashFlowProjection | null>(null)
  const [loading,  setLoading] = useState(false)
  const [refDate,  setRefDate] = useState<dayjs.Dayjs>(dayjs())
  const [expanded, setExpanded] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCashFlowProjection(refDate.format('YYYY-MM-DD'))
      setData(res)
      // Expandir todos los buckets con items por defecto
      setExpanded(BUCKET_ORDER.filter(k => (res.buckets[k]?.items?.length ?? 0) > 0))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [refDate])

  useEffect(() => { load() }, [load])

  const invoiceColumns: ColumnsType<CashFlowBucketItem> = [
    {
      title: 'Proveedor', dataIndex: 'vendorName', ellipsis: true,
      render: (v) => <Text>{v}</Text>,
    },
    {
      title: 'Factura', dataIndex: 'invoiceNumber', width: 145,
      render: (v) => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{v}</Text>,
    },
    {
      title: 'F. Factura', dataIndex: 'invoiceDate', width: 105,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Vence', dataIndex: 'dueDate', width: 105,
      render: (v, r) => {
        if (!v) return <Text type="secondary">—</Text>
        const d = r.daysLeft
        const label = d < 0
          ? `Vencida (${Math.abs(d)}d)`
          : d === 0 ? 'Hoy' : `En ${d}d`
        const color = d < 0 ? '#e5484d' : d <= 7 ? '#ff7f00' : '#1faec2'
        return (
          <Tooltip title={dayjs(v).format('DD/MM/YYYY')}>
            <Tag color={color} style={{ fontSize: 11 }}>{label}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Moneda', dataIndex: 'currency', width: 75, align: 'center',
      render: (v) => v !== 'GTQ' ? <Tag color="#6b7280">{v}</Tag> : null,
    },
    {
      title: 'Saldo', dataIndex: 'balanceGTQ', width: 130, align: 'right',
      render: (v) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(v)}</Text>,
    },
    {
      key: 'action', width: 100, align: 'center',
      render: (_, r) => (
        <Tooltip title="Ir a pagar">
          <Button
            size="small"
            type="primary"
            ghost
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/bancos/pagos-realizados/nuevo', { state: { vendorId: r.vendorId } })}
          >
            Pagar
          </Button>
        </Tooltip>
      ),
    },
  ]

  const overdueTotal = data?.buckets?.overdue?.total ?? 0
  const d7Total      = data?.buckets?.d7?.total ?? 0
  const d15Total     = data?.buckets?.d15?.total ?? 0
  const d30Total     = data?.buckets?.d30?.total ?? 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <CalendarOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Reporte Proyectado de Pagos</Title>
            <Text type="secondary">Flujo de caja por vencimientos CxP</Text>
          </div>
        </div>
        <Space>
          <Text style={{ fontSize: 12 }}>Fecha de referencia:</Text>
          <DatePicker
            format="DD/MM/YYYY"
            value={refDate}
            onChange={d => d && setRefDate(d)}
            style={{ width: 130 }}
            size="small"
          />
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading} size="small">
            Actualizar
          </Button>
        </Space>
      </div>

      {/* KPIs semáforo */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { key: 'overdue', label: 'Vencidas',        value: overdueTotal, color: '#e5484d', icon: <WarningOutlined /> },
          { key: 'd7',      label: 'Vence en 7 días', value: d7Total,      color: '#ff7f00', icon: <DollarOutlined /> },
          { key: 'd15',     label: 'Vence en 15 días', value: d15Total,    color: '#ad6800', icon: <DollarOutlined /> },
          { key: 'd30',     label: 'Vence en 30 días', value: d30Total,    color: '#1faec2', icon: <DollarOutlined /> },
          { key: 'total',   label: 'Total CxP pendiente', value: data?.grandTotal ?? 0, color: '#555', icon: <DollarOutlined /> },
        ].map(kpi => (
          <Col span={4} key={kpi.key} style={{ minWidth: 160 }}>
            <Card
              bordered={false}
              style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderTop: `3px solid ${kpi.color}` }}
            >
              <Statistic
                title={kpi.label}
                value={kpi.value}
                formatter={v => fmtQ(Number(v))}
                valueStyle={{ fontSize: 15, color: kpi.color }}
                prefix={kpi.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Buckets por vencimiento */}
      {data && BUCKET_ORDER.map(key => {
        const bucket = data.buckets[key]
        if (!bucket || bucket.items.length === 0) return null
        const style = BUCKET_STYLE[key]
        const isOpen = expanded.includes(key)

        return (
          <Card
            key={key}
            bordered={false}
            style={{
              borderRadius: 10,
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              marginBottom: 12,
              borderLeft: `4px solid ${style.color}`,
            }}
            bodyStyle={{ padding: 0 }}
          >
            {/* Cabecera del bucket */}
            <div
              style={{
                padding: '10px 16px',
                background: style.bg,
                borderRadius: '10px 10px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setExpanded(prev =>
                prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
              )}
            >
              <Space>
                <Badge
                  count={bucket.items.length}
                  style={{ backgroundColor: style.color }}
                />
                <Text strong style={{ color: style.color, fontSize: 14 }}>{bucket.label}</Text>
              </Space>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: style.color, fontSize: 15 }}>
                {fmtQ(bucket.total)}
              </Text>
            </div>

            {/* Tabla de facturas */}
            {isOpen && (
              <Table
                columns={invoiceColumns}
                dataSource={bucket.items}
                rowKey="id"
                loading={loading}
                size="small"
                pagination={false}
                scroll={{ x: 800 }}
                summary={() => (
                  <Table.Summary.Row style={{ background: style.bg }}>
                    <Table.Summary.Cell index={0} colSpan={5}>
                      <Text strong style={{ fontSize: 12 }}>
                        Subtotal — {bucket.items.length} factura{bucket.items.length !== 1 ? 's' : ''}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: style.color }}>
                        {fmtQ(bucket.total)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} />
                  </Table.Summary.Row>
                )}
                locale={{ emptyText: 'Sin facturas' }}
              />
            )}
          </Card>
        )
      })}

      {/* Total general */}
      {data && data.grandTotal > 0 && (
        <Card
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', background: '#fafbfc' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 14 }}>
              Total CxP pendiente al {refDate.format('DD/MM/YYYY')} — {data.total} factura{data.total !== 1 ? 's' : ''}
            </Text>
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 20, color: '#1faec2' }}>
              {fmtQ(data.grandTotal)}
            </Text>
          </div>
        </Card>
      )}

      {data && data.grandTotal === 0 && !loading && (
        <Card bordered={false} style={{ borderRadius: 10, textAlign: 'center', padding: 32 }}>
          <Text type="secondary">No hay facturas de proveedor pendientes de pago</Text>
        </Card>
      )}
    </div>
  )
}
