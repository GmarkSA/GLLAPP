import { useEffect, useState } from 'react'
import { Card, Col, Row, Table, Typography, Divider, Statistic, Progress, Tag, Space, Switch } from 'antd'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import { getEstadoResultados, type EstadoResultadosData, type AccountRow } from '../../api/reportes'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const pct = (n: number) => `${n.toFixed(1)}%`

const accentColor = (n: number) => (n >= 0 ? '#389e0d' : '#cf1322')

function AccountTable({ accounts, total, label, negate }: { accounts: AccountRow[]; total: number; label: string; negate?: boolean }) {
  if (!accounts || accounts.length === 0) return null
  return (
    <Table
      size="small"
      dataSource={accounts}
      rowKey="id"
      pagination={false}
      showHeader={false}
      style={{ marginBottom: 0 }}
      summary={() => (
        <Table.Summary.Row style={{ background: '#fafafa' }}>
          <Table.Summary.Cell index={0}>
            <Text strong style={{ fontSize: 12 }}>Total {label}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <Text strong style={{ fontFamily: 'monospace' }}>
              {negate ? `(${fmtQ(total)})` : fmtQ(total)}
            </Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        { dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{v}</Text> },
        { dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
        {
          dataIndex: 'balance', width: 140, align: 'right' as const,
          render: (v: number) => (
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {negate ? `(${fmtQ(v)})` : fmtQ(v)}
            </Text>
          ),
        },
      ]}
    />
  )
}

function SubtotalRow({ label, value, highlight, border }: { label: string; value: number; highlight?: boolean; border?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 16px',
      borderTop: border ? '2px solid #d9d9d9' : undefined,
      background: highlight ? (value >= 0 ? '#f6ffed' : '#fff2f0') : '#fafafa',
      borderRadius: highlight ? 6 : 0,
      margin: highlight ? '4px 0' : 0,
    }}>
      <Text strong={highlight} style={{ fontSize: highlight ? 13 : 12, color: highlight ? accentColor(value) : '#262626' }}>
        {label}
      </Text>
      <Text strong={highlight} style={{
        fontFamily: 'monospace', fontSize: highlight ? 14 : 12,
        color: accentColor(value),
      }}>
        {fmtQ(value)}
      </Text>
    </div>
  )
}

export default function EstadoResultadosPage() {
  const [from,   setFrom]   = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,     setTo]     = useState(dayjs().format('YYYY-MM-DD'))
  const [compare, setCompare] = useState(false)
  const [data,   setData]   = useState<EstadoResultadosData | null>(null)
  const [loading,setLoading]= useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const fetch = async (f: string, t: string) => {
    setLoading(true); setError(null)
    try {
      const compFrom = compare ? dayjs(f).subtract(1,'year').format('YYYY-MM-DD') : undefined
      const compTo   = compare ? dayjs(t).subtract(1,'year').format('YYYY-MM-DD') : undefined
      const res = await getEstadoResultados({ fromDate: f, toDate: t, compFrom, compTo })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando Estado de Resultados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(from, to) }, [from, to, compare])

  return (
    <ReportLayout
      title="Estado de Resultados"
      subtitle="Estado de Pérdidas y Ganancias · SAT Guatemala"
      tipoExport="estado-resultados"
      loading={loading}
      error={error}
      fromDate={from}
      toDate={to}
      onRangeChange={(f, t) => { setFrom(f); setTo(t) }}
      exportParams={{ fromDate: from, toDate: to }}
      extra={
        <Space size={4}>
          <Switch size="small" checked={compare} onChange={setCompare} />
          <Text style={{ fontSize: 12 }}>vs. año anterior</Text>
        </Space>
      }
    >
      {data && (
        <>
          <Tag style={{ marginBottom: 16 }}>
            Del {data.period.from} al {data.period.to}
          </Tag>

          {/* KPI strip */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Ingresos',          value: data.ingresos.total,     color: '#1B3A6B' },
              { label: 'Utilidad Bruta',   value: data.utilidadBruta,       color: accentColor(data.utilidadBruta) },
              { label: 'Utilidad Neta',    value: data.utilidadNeta,        color: accentColor(data.utilidadNeta) },
              { label: 'Margen Neto',      value: data.margenNeto,          color: accentColor(data.margenNeto), suffix: '%', precision: 1 },
            ].map(k => (
              <Col xs={12} sm={6} key={k.label}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                    value={k.value}
                    precision={k.precision ?? 2}
                    prefix={k.suffix ? undefined : 'Q'}
                    suffix={k.suffix}
                    valueStyle={{ fontSize: 14, fontFamily: 'monospace', color: k.color }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: k.precision ?? 2 })}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Margin progress bars */}
          <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
            <Row gutter={24}>
              {[
                { label: 'Margen Bruto',      value: data.margenBruto },
                { label: 'Margen Operativo',  value: data.margenOperativo },
                { label: 'Margen Neto',       value: data.margenNeto },
              ].map(m => (
                <Col xs={24} sm={8} key={m.label}>
                  <div style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 12 }}>{m.label}</Text>
                    <Text strong style={{ float: 'right', fontSize: 12 }}>{pct(m.value)}</Text>
                  </div>
                  <Progress
                    percent={Math.min(Math.abs(m.value), 100)}
                    showInfo={false}
                    strokeColor={m.value >= 0 ? '#52c41a' : '#ff4d4f'}
                    size="small"
                  />
                </Col>
              ))}
            </Row>
          </Card>

          {/* P&L Statement */}
          <Card
            style={{ borderRadius: 8 }}
            bodyStyle={{ padding: 0 }}
            title={<Text strong style={{ fontSize: 13 }}>Estado de Resultados Detallado</Text>}
          >
            {/* Ingresos */}
            <div style={{ padding: '10px 16px 4px', borderBottom: '1px solid #f0f0f0' }}>
              <Text strong style={{ color: '#1B3A6B', fontSize: 12 }}>INGRESOS ORDINARIOS</Text>
            </div>
            <AccountTable accounts={data.ingresos.accounts} total={data.ingresos.total} label="Ingresos" />
            {data.otrosIngresos.accounts.length > 0 && <>
              <div style={{ padding: '10px 16px 4px', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>
                <Text strong style={{ color: '#1B3A6B', fontSize: 12 }}>OTROS INGRESOS</Text>
              </div>
              <AccountTable accounts={data.otrosIngresos.accounts} total={data.otrosIngresos.total} label="Otros Ingresos" />
            </>}
            <SubtotalRow label="Total Ingresos" value={data.ingresos.total + data.otrosIngresos.total} />

            <Divider style={{ margin: 0 }} />

            {/* Costos */}
            <div style={{ padding: '10px 16px 4px', borderBottom: '1px solid #f0f0f0' }}>
              <Text strong style={{ color: '#cf1322', fontSize: 12 }}>COSTOS DE VENTA</Text>
            </div>
            <AccountTable accounts={data.costos.accounts} total={data.costos.total} label="Costos" negate />
            <SubtotalRow label="Total Costos" value={-data.costos.total} />
            <SubtotalRow label="UTILIDAD BRUTA" value={data.utilidadBruta} highlight border />

            <Divider style={{ margin: 0 }} />

            {/* Gastos */}
            <div style={{ padding: '10px 16px 4px', borderBottom: '1px solid #f0f0f0' }}>
              <Text strong style={{ color: '#d46b08', fontSize: 12 }}>GASTOS DE OPERACIÓN</Text>
            </div>
            <AccountTable accounts={data.gastos.accounts} total={data.gastos.total} label="Gastos" negate />
            {data.otrosGastos.accounts.length > 0 && <>
              <div style={{ padding: '6px 16px 4px', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>
                <Text strong style={{ color: '#d46b08', fontSize: 12 }}>OTROS GASTOS</Text>
              </div>
              <AccountTable accounts={data.otrosGastos.accounts} total={data.otrosGastos.total} label="Otros Gastos" negate />
            </>}
            <SubtotalRow label="Total Gastos" value={-(data.gastos.total + data.otrosGastos.total)} />
            <SubtotalRow label="UTILIDAD DE OPERACIÓN" value={data.utilidadOperativa} highlight border />

            <Divider style={{ margin: 0 }} />
            <SubtotalRow label="UTILIDAD NETA DEL PERÍODO" value={data.utilidadNeta} highlight border />
          </Card>
        </>
      )}
    </ReportLayout>
  )
}
