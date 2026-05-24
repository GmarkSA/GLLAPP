import { useEffect, useState } from 'react'
import { Card, Col, Row, Typography, Statistic, Tag, Table, Space, Divider } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import { getMovimientoCapital, type MovimientoCapitalData } from '../../api/reportes'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const accentColor = (n: number) => (n >= 0 ? '#389e0d' : '#cf1322')

function CapitalRow({ label, value, indent = 0, highlight = false, border = false }: {
  label: string; value: number; indent?: number; highlight?: boolean; border?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${highlight ? 10 : 6}px ${16 + indent * 16}px`,
      borderTop: border ? '2px solid #d9d9d9' : undefined,
      background: highlight ? (value >= 0 ? '#f6ffed' : '#fff2f0') : undefined,
      borderRadius: highlight ? 6 : 0,
      margin: highlight ? '4px 0' : 0,
    }}>
      <Text strong={highlight} style={{ fontSize: highlight ? 13 : 12, color: highlight ? accentColor(value) : '#262626' }}>
        {label}
      </Text>
      <Text strong={highlight} style={{ fontFamily: 'monospace', fontSize: highlight ? 14 : 12, color: accentColor(value) }}>
        {fmtQ(value)}
      </Text>
    </div>
  )
}

export default function MovimientoCapitalPage() {
  const [from,    setFrom]    = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,      setTo]      = useState(dayjs().format('YYYY-MM-DD'))
  const [data,    setData]    = useState<MovimientoCapitalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = async (f: string, t: string) => {
    setLoading(true); setError(null)
    try {
      const res = await getMovimientoCapital({ fromDate: f, toDate: t })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando Movimiento de Capital')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(from, to) }, [from, to])

  return (
    <ReportLayout
      title="Movimiento de Capital"
      subtitle="Estado de Cambios en el Patrimonio · NIC 1"
      tipoExport="movimiento-capital"
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

          {/* KPI strip */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Saldo Inicial Capital', value: data.openingBalance,    color: '#1B3A6B' },
              { label: 'Movimientos del Período', value: data.accounts.reduce((s: number, a: any) => s + a.balance, 0), color: '#722ed1' },
              { label: 'Utilidad del Período',  value: data.netIncomePeriod,  color: accentColor(data.netIncomePeriod) },
              { label: 'Saldo Final Capital',   value: data.closingBalance,   color: accentColor(data.closingBalance) },
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

          {/* Summary reconciliation */}
          <Card
            size="small"
            title={<Text strong style={{ fontSize: 13 }}>Resumen de Capital</Text>}
            style={{ borderRadius: 8, marginBottom: 16 }}
            bodyStyle={{ padding: 0 }}
          >
            <CapitalRow label="Saldo inicial de Capital" value={data.openingBalance} />
            <Divider style={{ margin: 0 }} />
            {data.capitalContribuciones.accounts.length > 0 && (
              <>
                <div style={{ padding: '6px 16px', color: '#8c8c8c', fontSize: 11, fontWeight: 600, background: '#fafafa' }}>
                  CAPITAL APORTADO
                </div>
                {data.capitalContribuciones.accounts.map((a: any) => (
                  <CapitalRow key={a.id} label={`${a.code} ${a.name}`} value={a.balance} indent={1} />
                ))}
                <CapitalRow label="Subtotal Capital Aportado" value={data.capitalContribuciones.total} indent={0} />
              </>
            )}
            {data.utilidadesRetenidas.accounts.length > 0 && (
              <>
                <Divider style={{ margin: 0 }} />
                <div style={{ padding: '6px 16px', color: '#8c8c8c', fontSize: 11, fontWeight: 600, background: '#fafafa' }}>
                  UTILIDADES RETENIDAS
                </div>
                {data.utilidadesRetenidas.accounts.map((a: any) => (
                  <CapitalRow key={a.id} label={`${a.code} ${a.name}`} value={a.balance} indent={1} />
                ))}
                <CapitalRow label="Subtotal Utilidades Retenidas" value={data.utilidadesRetenidas.total} indent={0} />
              </>
            )}
            <Divider style={{ margin: 0 }} />
            <CapitalRow label="Utilidad / Pérdida del Período" value={data.netIncomePeriod} indent={1} />
            <CapitalRow label="SALDO FINAL DE CAPITAL" value={data.closingBalance} highlight border />
          </Card>

          {/* Movement detail */}
          {data.movements.length > 0 && (
            <Card
              size="small"
              title={<Text strong style={{ fontSize: 13 }}>Movimientos Detallados</Text>}
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 0 }}
            >
              <Table
                size="small"
                dataSource={data.movements}
                rowKey={(r: any) => `${r.entry_number}-${r.code}`}
                pagination={{ pageSize: 25, showTotal: t => `${t} movimientos` }}
                columns={[
                  {
                    title: 'Fecha',
                    dataIndex: 'entry_date',
                    width: 100,
                    render: (v: string) => <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{v?.substring(0, 10)}</Text>,
                  },
                  {
                    title: 'Asiento',
                    dataIndex: 'entry_number',
                    width: 110,
                    render: (v: string) => <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#1677ff' }}>{v}</Text>,
                  },
                  {
                    title: 'Cuenta',
                    render: (_: any, r: any) => (
                      <div>
                        <Text style={{ fontSize: 12, fontWeight: 600 }}>{r.code}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{r.name}</Text>
                      </div>
                    ),
                  },
                  {
                    title: 'Descripción',
                    dataIndex: 'description',
                    render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text>,
                  },
                  {
                    title: 'Débito',
                    dataIndex: 'debit',
                    width: 110,
                    align: 'right' as const,
                    render: (v: number) => v > 0 ? <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Crédito',
                    dataIndex: 'credit',
                    width: 110,
                    align: 'right' as const,
                    render: (v: number) => v > 0 ? <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Movimiento',
                    dataIndex: 'net_movement',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number) => (
                      <Space size={4}>
                        {v >= 0
                          ? <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 10 }} />
                          : <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />}
                        <Text style={{ fontFamily: 'monospace', fontSize: 11, color: accentColor(v) }}>
                          {fmtQ(Math.abs(v))}
                        </Text>
                      </Space>
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
