import { useEffect, useState } from 'react'
import { Card, Col, Row, Typography, Statistic, Tag, Space, Tooltip, Progress, Table } from 'antd'
import { InfoCircleOutlined, CheckOutlined, CloseOutlined, MinusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import { getTasasRendimiento, type TasasRendimientoData, type RatioItem } from '../../api/reportes'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtN = (n: number, decimals = 2) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

type RatioStatus = 'good' | 'warn' | 'bad' | 'neutral'

function evalRatio(item: RatioItem): RatioStatus {
  if (item.valor === null || item.valor === undefined) return 'neutral'
  const ideal = item.ideal || ''
  if (ideal.startsWith('>=')) {
    const threshold = parseFloat(ideal.replace('>=', '').replace('%', ''))
    if (isNaN(threshold)) return 'neutral'
    return item.valor >= threshold ? 'good' : item.valor >= threshold * 0.7 ? 'warn' : 'bad'
  }
  if (ideal.startsWith('<=')) {
    const threshold = parseFloat(ideal.replace('<=', '').replace('%', ''))
    if (isNaN(threshold)) return 'neutral'
    return item.valor <= threshold ? 'good' : item.valor <= threshold * 1.3 ? 'warn' : 'bad'
  }
  if (ideal === 'Positivo') return item.valor >= 0 ? 'good' : 'bad'
  return 'neutral'
}

const STATUS_COLOR: Record<RatioStatus, string> = {
  good:    '#389e0d',
  warn:    '#d46b08',
  bad:     '#cf1322',
  neutral: '#8c8c8c',
}

const STATUS_ICON: Record<RatioStatus, React.ReactNode> = {
  good:    <CheckOutlined style={{ color: '#52c41a' }} />,
  warn:    <MinusOutlined style={{ color: '#fa8c16' }} />,
  bad:     <CloseOutlined style={{ color: '#ff4d4f' }} />,
  neutral: <MinusOutlined style={{ color: '#d9d9d9' }} />,
}

function RatioCard({ item }: { item: RatioItem }) {
  const status = evalRatio(item)
  const color  = STATUS_COLOR[status]
  const val    = item.valor

  return (
    <Card
      size="small"
      style={{ borderRadius: 10, border: `1px solid #f0f0f0`, height: '100%' }}
      bodyStyle={{ padding: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#262626' }}>{item.nombre}</Text>
          {item.descripcion && (
            <Tooltip title={item.descripcion}>
              <InfoCircleOutlined style={{ color: '#bbb', marginLeft: 4, fontSize: 11 }} />
            </Tooltip>
          )}
        </div>
        {STATUS_ICON[status]}
      </div>
      <div style={{ marginBottom: 4 }}>
        <Text strong style={{ fontSize: 22, fontFamily: 'monospace', color }}>
          {val === null ? 'N/A' : `${fmtN(val)}${item.unidad || 'x'}`}
        </Text>
      </div>
      {item.ideal && (
        <Tag color={status === 'good' ? 'success' : status === 'warn' ? 'warning' : status === 'bad' ? 'error' : 'default'}
          style={{ fontSize: 10 }}>
          Ideal: {item.ideal}
        </Tag>
      )}
    </Card>
  )
}

function RatioSection({ title, items, color }: { title: string; items: RatioItem[]; color: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Title level={5} style={{ color, marginBottom: 10, fontSize: 13 }}>{title}</Title>
      <Row gutter={[12, 12]}>
        {items.map(item => (
          <Col xs={24} sm={12} md={8} lg={6} key={item.nombre}>
            <RatioCard item={item} />
          </Col>
        ))}
      </Row>
    </div>
  )
}

export default function TasasRendimientoPage() {
  const [from,    setFrom]    = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,      setTo]      = useState(dayjs().format('YYYY-MM-DD'))
  const [data,    setData]    = useState<TasasRendimientoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = async (f: string, t: string) => {
    setLoading(true); setError(null)
    try {
      const res = await getTasasRendimiento({ fromDate: f, toDate: t })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando Tasas de Rendimiento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(from, to) }, [from, to])

  return (
    <ReportLayout
      title="Tasas de Rendimiento"
      subtitle="Ratios e Indicadores Financieros · Análisis de Rentabilidad"
      tipoExport="tasas-rendimiento"
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

          {/* Base numbers */}
          <Card size="small" style={{ borderRadius: 8, marginBottom: 20 }} bodyStyle={{ padding: '12px 16px' }}>
            <Text strong style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>
              BASE DEL ANÁLISIS
            </Text>
            <Row gutter={16}>
              {Object.entries({
                'Total Activos':   data.resumen.totalActivo,
                'Total Pasivos':   data.resumen.totalPasivo,
                'Capital':         data.resumen.totalCapital,
                'Ingresos':        data.resumen.ingresos,
                'Util. Bruta':    data.resumen.utilidadBruta,
                'Util. Neta':     data.resumen.utilidadNeta,
              }).map(([k, v]) => (
                <Col xs={12} sm={8} md={4} key={k}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10 }}>{k}</Text>
                    <div>
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: Number(v) < 0 ? '#cf1322' : '#262626' }}>
                        {fmtQ(Number(v))}
                      </Text>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>

          <RatioSection title="🏦 Liquidez" items={data.liquidez} color="#1677ff" />
          <RatioSection title="📊 Endeudamiento" items={data.endeudamiento} color="#722ed1" />
          <RatioSection title="📈 Rentabilidad" items={data.rentabilidad} color="#389e0d" />
          <RatioSection title="⚙️ Eficiencia" items={data.eficiencia} color="#fa8c16" />

          {/* Legend */}
          <Card size="small" style={{ borderRadius: 8, marginTop: 8 }} bodyStyle={{ padding: '10px 16px' }}>
            <Space size={16} wrap>
              <Space size={4}><CheckOutlined style={{ color: '#52c41a' }} /><Text style={{ fontSize: 11 }}>Óptimo</Text></Space>
              <Space size={4}><MinusOutlined style={{ color: '#fa8c16' }} /><Text style={{ fontSize: 11 }}>Aceptable</Text></Space>
              <Space size={4}><CloseOutlined style={{ color: '#ff4d4f' }} /><Text style={{ fontSize: 11 }}>Requiere atención</Text></Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Nota: La liquidez circulante usa 60% del pasivo como proxy del pasivo corriente. Configure sub-tipos de cuentas para cálculo exacto.
              </Text>
            </Space>
          </Card>
        </>
      )}
    </ReportLayout>
  )
}
