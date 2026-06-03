import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, DatePicker, Empty, Progress, Row, Skeleton,
  Space, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BankOutlined, BarChartOutlined, DollarOutlined, FileTextOutlined,
  LineChartOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons'
import { Dayjs } from 'dayjs'
import {
  getExecutiveDashboard,
  type ExecutiveAgingRow,
  type ExecutiveDashboardData,
  type RatioItem,
} from '../api/reportes'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const bucketMeta = [
  { key: 'current', label: 'Corriente', color: '#0ea5e9' },
  { key: 'days_1_30', label: '1-30', color: '#16a34a' },
  { key: 'days_31_60', label: '31-60', color: '#d97706' },
  { key: 'days_61_90', label: '61-90', color: '#f97316' },
  { key: 'over_90', label: '+90', color: '#dc2626' },
] as const

function toNum(value: unknown): number {
  return Number(value ?? 0) || 0
}

function money(value: unknown, currency = 'GTQ'): string {
  const amount = toNum(value)
  try {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

function pct(value: unknown): string {
  return `${toNum(value).toFixed(1)}%`
}

function entityName(row: ExecutiveAgingRow, kind: 'ar' | 'ap'): string {
  return kind === 'ar'
    ? row.customer_name ?? row.customer_id ?? 'Cliente'
    : row.vendor_name ?? row.vendor_id ?? 'Proveedor'
}

function riskColor(value: number): string {
  if (value >= 50) return '#dc2626'
  if (value >= 25) return '#f97316'
  return '#16a34a'
}

function SummaryCard({
  title, value, subtitle, icon, color, currency, isMoney = true,
}: {
  title: string
  value: number | null | undefined
  subtitle?: string
  icon: React.ReactNode
  color: string
  currency: string
  isMoney?: boolean
}) {
  return (
    <Card bordered={false} style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Statistic
          title={<Text style={{ fontSize: 12, color: '#5f6b7a' }}>{title}</Text>}
          value={isMoney ? money(value, currency) : toNum(value)}
          valueStyle={{ color: '#102a56', fontSize: 22, fontWeight: 700 }}
        />
        <div style={{
          width: 42, height: 42, borderRadius: 8, background: `${color}14`,
          color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
        }}>
          {icon}
        </div>
      </div>
      {subtitle && <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>}
    </Card>
  )
}

function BucketBar({ row, currency }: { row: ExecutiveAgingRow; currency: string }) {
  const total = Math.max(toNum(row.total), 1)
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', background: '#edf1f7' }}>
        {bucketMeta.map(bucket => {
          const width = Math.max((toNum(row[bucket.key]) / total) * 100, 0)
          return <div key={bucket.key} style={{ width: `${width}%`, background: bucket.color }} />
        })}
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>{money(row.total, currency)}</Text>
    </div>
  )
}

function AgingTable({
  rows, kind, currency,
}: {
  rows: ExecutiveAgingRow[]
  kind: 'ar' | 'ap'
  currency: string
}) {
  const columns: ColumnsType<ExecutiveAgingRow> = [
    {
      title: kind === 'ar' ? 'Cliente' : 'Proveedor',
      render: (_, row) => (
        <div>
          <Text strong>{entityName(row, kind)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {kind === 'ar' ? row.customer_id : row.vendor_id}
          </Text>
        </div>
      ),
    },
    ...bucketMeta.map(bucket => ({
      title: bucket.label,
      dataIndex: bucket.key,
      align: 'right' as const,
      width: 110,
      render: (value: number) => (
        <Text style={{ color: bucket.color, fontSize: 12 }}>{money(value, currency)}</Text>
      ),
    })),
    {
      title: 'Distribucion',
      width: 180,
      render: (_, row) => <BucketBar row={row} currency={currency} />,
    },
  ]

  return (
    <Table
      rowKey={(row) => `${kind}-${row.customer_id ?? row.vendor_id ?? entityName(row, kind)}`}
      columns={columns}
      dataSource={rows}
      pagination={{ pageSize: 8, size: 'small' }}
      size="small"
      scroll={{ x: 900 }}
    />
  )
}

function AgingPanel({
  title, section, kind, currency,
}: {
  title: string
  section: ExecutiveDashboardData['receivables']
  kind: 'ar' | 'ap'
  currency: string
}) {
  const overdueColor = riskColor(section.overduePct)
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <SummaryCard title={`Total ${title}`} value={section.total} icon={<FileTextOutlined />} color="#0ea5e9" currency={currency} />
        </Col>
        <Col xs={24} md={6}>
          <SummaryCard title="Vencido" value={section.overdue} subtitle={pct(section.overduePct)} icon={<WarningOutlined />} color={overdueColor} currency={currency} />
        </Col>
        <Col xs={24} md={6}>
          <SummaryCard title="+90 dias" value={section.critical} subtitle={pct(section.criticalPct)} icon={<WarningOutlined />} color="#dc2626" currency={currency} />
        </Col>
        <Col xs={24} md={6}>
          <Card bordered={false} style={cardStyle}>
            <Text type="secondary">Riesgo de vencimiento</Text>
            <Progress percent={Math.min(100, Math.round(section.overduePct))} strokeColor={overdueColor} />
            <Text type="secondary" style={{ fontSize: 12 }}>Corte: {section.asOf}</Text>
          </Card>
        </Col>
      </Row>
      <Card bordered={false} style={cardStyle} title={`Aging ${title}`}>
        {section.rows.length ? <AgingTable rows={section.rows} kind={kind} currency={currency} /> : <Empty description="Sin saldos abiertos" />}
      </Card>
    </Space>
  )
}

function CashFlowPanel({ data, currency }: { data: ExecutiveDashboardData; currency: string }) {
  const cash = data.cashFlow
  if (!cash) return <Empty description="Sin datos de flujo de caja" />
  const flows = [
    { label: 'Operacion', value: cash.operating.total, color: '#16a34a' },
    { label: 'Inversion', value: cash.investing.total, color: '#0ea5e9' },
    { label: 'Financiacion', value: cash.financing.total, color: '#7c3aed' },
  ]
  const max = Math.max(...flows.map(item => Math.abs(toNum(item.value))), 1)
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <SummaryCard title="Variacion neta de caja" value={cash.netCashChange} icon={<BankOutlined />} color={toNum(cash.netCashChange) < 0 ? '#dc2626' : '#16a34a'} currency={currency} />
      </Col>
      <Col xs={24} md={8}>
        <SummaryCard title="Caja final estimada" value={cash.totalCashEnd} icon={<DollarOutlined />} color="#0ea5e9" currency={currency} />
      </Col>
      <Col xs={24} md={8}>
        <SummaryCard title="Cuentas de caja" value={cash.cashAccounts.length} icon={<BankOutlined />} color="#7c3aed" currency={currency} isMoney={false} />
      </Col>
      <Col xs={24} lg={14}>
        <Card bordered={false} style={cardStyle} title="Flujo por actividad">
          <Space direction="vertical" style={{ width: '100%' }} size={14}>
            {flows.map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{item.label}</Text>
                  <Text strong style={{ color: toNum(item.value) < 0 ? '#dc2626' : item.color }}>{money(item.value, currency)}</Text>
                </div>
                <Progress percent={Math.round(Math.abs(toNum(item.value)) / max * 100)} showInfo={false} strokeColor={item.color} />
              </div>
            ))}
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card bordered={false} style={cardStyle} title="Cuentas bancarias y caja">
          {cash.cashAccounts.length ? (
            <Table
              dataSource={cash.cashAccounts}
              rowKey={(row) => `${row.code}-${row.name}`}
              pagination={false}
              size="small"
              columns={[
                { title: 'Cuenta', render: (_, row) => <Text>{row.code} {row.name}</Text> },
                { title: 'Cambio', align: 'right', render: (_, row) => <Text strong>{money(row.change, currency)}</Text> },
              ]}
            />
          ) : <Empty description={cash.note ?? 'Sin cuentas vinculadas'} />}
        </Card>
      </Col>
    </Row>
  )
}

function KpiPanel({ ratios }: { ratios: ExecutiveDashboardData['ratios'] }) {
  const groups: Array<[string, RatioItem[]]> = ratios
    ? [
      ['Liquidez', ratios.liquidez],
      ['Endeudamiento', ratios.endeudamiento],
      ['Rentabilidad', ratios.rentabilidad],
      ['Eficiencia', ratios.eficiencia],
    ]
    : []
  if (!groups.length) return <Empty description="Sin KPIs financieros" />
  return (
    <Row gutter={[16, 16]}>
      {groups.map(([title, items]) => (
        <Col xs={24} lg={12} key={title}>
          <Card bordered={false} style={cardStyle} title={title}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {items.map(item => (
                <div key={item.nombre} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #f0f2f5', paddingBottom: 8 }}>
                  <div>
                    <Text strong>{item.nombre}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.descripcion ?? item.ideal}</Text>
                  </div>
                  <Text strong style={{ color: '#102a56' }}>
                    {item.valor == null ? '-' : `${toNum(item.valor).toFixed(2)}${item.unidad ?? ''}`}
                  </Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  )
}

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 6px rgba(15, 23, 42, 0.08)',
}

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = range
        ? {
          fromDate: range[0].format('YYYY-MM-DD'),
          toDate: range[1].format('YYYY-MM-DD'),
          asOf: range[1].format('YYYY-MM-DD'),
        }
        : undefined
      setData(await getExecutiveDashboard(params))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const currency = data?.currency ?? 'GTQ'
  const tabs = useMemo(() => data ? [
    {
      key: 'resumen',
      label: 'Resumen Ejecutivo',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}><SummaryCard title="CxC total" value={data.summary.arTotal} icon={<FileTextOutlined />} color="#2563eb" currency={currency} /></Col>
            <Col xs={24} md={6}><SummaryCard title="CxP total" value={data.summary.apTotal} icon={<WarningOutlined />} color="#7c3aed" currency={currency} /></Col>
            <Col xs={24} md={6}><SummaryCard title="Caja final" value={data.summary.cashEnd} icon={<BankOutlined />} color="#0ea5e9" currency={currency} /></Col>
            <Col xs={24} md={6}><SummaryCard title="Utilidad neta" value={data.summary.netIncome} icon={<LineChartOutlined />} color={data.summary.netIncome < 0 ? '#dc2626' : '#16a34a'} currency={currency} /></Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card bordered={false} style={cardStyle} title="Alertas e interpretacion">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {data.insights.map((insight, index) => (
                    <Alert
                      key={`${insight.title}-${index}`}
                      type={insight.type === 'danger' ? 'error' : insight.type === 'success' ? 'success' : 'warning'}
                      showIcon
                      message={insight.title}
                      description={insight.text}
                    />
                  ))}
                </Space>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card bordered={false} style={cardStyle} title="Indicadores clave">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><Text>CxC vencida</Text><Progress percent={Math.round(data.summary.arOverduePct)} strokeColor={riskColor(data.summary.arOverduePct)} /></div>
                  <div><Text>CxP vencida</Text><Progress percent={Math.round(data.summary.apOverduePct)} strokeColor={riskColor(data.summary.apOverduePct)} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Apalancamiento CxP/CxC</Text>
                    <Tag color={toNum(data.summary.commercialLeverage) > 1 ? 'orange' : 'green'}>
                      {data.summary.commercialLeverage == null ? '-' : `${data.summary.commercialLeverage.toFixed(2)}x`}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Margen neto</Text>
                    <Tag color={data.summary.netMargin < 0 ? 'red' : 'blue'}>{pct(data.summary.netMargin)}</Tag>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </Space>
      ),
    },
    { key: 'cxc', label: 'CxC', children: <AgingPanel title="CxC" section={data.receivables} kind="ar" currency={currency} /> },
    { key: 'cxp', label: 'CxP', children: <AgingPanel title="CxP" section={data.payables} kind="ap" currency={currency} /> },
    { key: 'flujo', label: 'Flujo de Caja', children: <CashFlowPanel data={data} currency={currency} /> },
    { key: 'kpis', label: 'KPIs', children: <KpiPanel ratios={data.ratios} /> },
  ] : [], [data, currency])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#102a56' }}>Dashboard Ejecutivo</Title>
          <Text type="secondary">
            {data ? `${data.company?.company_name ?? 'Empresa'} | ${data.period.from} - ${data.period.to} | corte ${data.period.asOf}` : 'Centro financiero de decision'}
          </Text>
        </div>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={(value) => setRange(value as [Dayjs, Dayjs] | null)}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
        </Space>
      </div>

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : data ? (
        <Tabs
          items={tabs}
          type="card"
          tabBarExtraContent={<Tag icon={<BarChartOutlined />} color="blue">Datos reales del periodo</Tag>}
        />
      ) : (
        <Card bordered={false} style={cardStyle}>
          <Empty description="No se pudo cargar el dashboard ejecutivo" />
        </Card>
      )}
    </div>
  )
}
