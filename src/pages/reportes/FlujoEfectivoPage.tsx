import { useEffect, useState } from 'react'
import { Card, Col, Row, Typography, Statistic, Tag, Space, Alert, Table } from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined, BankOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import { getFlujoEfectivo, type FlujoEfectivoData } from '../../api/reportes'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function FlowSection({
  title, total, items, color, icon,
}: {
  title: string
  total: number
  items: { label: string; amount: number }[]
  color: string
  icon: React.ReactNode
}) {
  return (
    <Card
      size="small"
      style={{ borderRadius: 8, marginBottom: 12, borderLeft: `3px solid ${color}` }}
      bodyStyle={{ padding: 0 }}
      title={
        <Space>
          {icon}
          <Text strong style={{ fontSize: 13, color }}>{title}</Text>
        </Space>
      }
      extra={
        <Text strong style={{ fontFamily: 'monospace', color: total >= 0 ? '#389e0d' : '#cf1322' }}>
          {fmtQ(total)}
        </Text>
      }
    >
      <Table
        size="small"
        dataSource={items}
        rowKey="label"
        pagination={false}
        showHeader={false}
        columns={[
          {
            dataIndex: 'label',
            render: (v: string) => <Text style={{ fontSize: 12, paddingLeft: 8 }}>{v}</Text>,
          },
          {
            dataIndex: 'amount',
            width: 160,
            align: 'right' as const,
            render: (v: number) => (
              <Space size={4}>
                {v >= 0
                  ? <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 10 }} />
                  : <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />
                }
                <Text style={{ fontFamily: 'monospace', fontSize: 12, color: v >= 0 ? '#389e0d' : '#cf1322' }}>
                  {fmtQ(Math.abs(v))}
                </Text>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}

export default function FlujoEfectivoPage() {
  const [from,    setFrom]    = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,      setTo]      = useState(dayjs().format('YYYY-MM-DD'))
  const [data,    setData]    = useState<FlujoEfectivoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = async (f: string, t: string) => {
    setLoading(true); setError(null)
    try {
      const res = await getFlujoEfectivo({ fromDate: f, toDate: t })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando Flujo de Efectivo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(from, to) }, [from, to])

  return (
    <ReportLayout
      title="Flujo de Caja"
      subtitle="Estado de Flujo de Efectivo · Método Indirecto · NIC 7"
      tipoExport="flujo-efectivo"
      loading={loading}
      error={error}
      fromDate={from}
      toDate={to}
      onRangeChange={(f, t) => { setFrom(f); setTo(t) }}
      exportParams={{ fromDate: from, toDate: to }}
    >
      {data && (
        <>
          <Tag style={{ marginBottom: 16 }}>Del {data.period.from} al {data.period.to}</Tag>

          {data.note && (
            <Alert
              type="info" showIcon message={data.note}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* KPI strip */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Flujo Operativo',    value: data.operating.total,   color: '#1B3A6B' },
              { label: 'Flujo Inversión',    value: data.investing.total,   color: '#722ed1' },
              { label: 'Flujo Financiación', value: data.financing.total,   color: '#fa8c16' },
              { label: 'Cambio Neto Caja',   value: data.netCashChange,     color: data.netCashChange >= 0 ? '#389e0d' : '#cf1322' },
            ].map(k => (
              <Col xs={12} sm={6} key={k.label}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                    value={k.value}
                    precision={2}
                    prefix="Q"
                    valueStyle={{ fontSize: 13, fontFamily: 'monospace', color: k.color }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Sections */}
          <FlowSection
            title="Actividades de Operación"
            total={data.operating.total}
            color="#1677ff"
            icon={<BankOutlined style={{ color: '#1677ff' }} />}
            items={[
              { label: 'Utilidad Neta del Período', amount: data.operating.netIncome },
              ...data.operating.adjustments,
            ]}
          />

          <FlowSection
            title="Actividades de Inversión"
            total={data.investing.total}
            color="#722ed1"
            icon={<ArrowUpOutlined style={{ color: '#722ed1' }} />}
            items={data.investing.items}
          />

          <FlowSection
            title="Actividades de Financiación"
            total={data.financing.total}
            color="#fa8c16"
            icon={<ArrowDownOutlined style={{ color: '#fa8c16' }} />}
            items={data.financing.items}
          />

          {/* Net change */}
          <Card
            size="small"
            style={{
              borderRadius: 8,
              background: data.netCashChange >= 0 ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${data.netCashChange >= 0 ? '#b7eb8f' : '#ffa39e'}`,
            }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ fontSize: 13 }}>Cambio Neto en Efectivo</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Suma de flujos: Operación + Inversión + Financiación
                  </Text>
                </div>
              </div>
              <Text strong style={{
                fontFamily: 'monospace', fontSize: 16,
                color: data.netCashChange >= 0 ? '#389e0d' : '#cf1322',
              }}>
                {fmtQ(data.netCashChange)}
              </Text>
            </div>
          </Card>

          {/* Cash accounts detail */}
          {data.cashAccounts.length > 0 && (
            <Card
              size="small"
              title={<Text strong style={{ fontSize: 12 }}>Cuentas de Efectivo y Equivalentes</Text>}
              style={{ marginTop: 12, borderRadius: 8 }}
              bodyStyle={{ padding: 0 }}
            >
              <Table
                size="small"
                dataSource={data.cashAccounts}
                rowKey="code"
                pagination={false}
                columns={[
                  { dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{v}</Text> },
                  { dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                  {
                    dataIndex: 'change', width: 140, align: 'right' as const,
                    render: (v: number) => (
                      <Text style={{ fontFamily: 'monospace', fontSize: 12, color: v >= 0 ? '#389e0d' : '#cf1322' }}>
                        {fmtQ(v)}
                      </Text>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </>
      )}
    </ReportLayout>
  )
}
