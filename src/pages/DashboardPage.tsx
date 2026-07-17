import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  Alert, Badge, Button, Card, Col, DatePicker, Empty, Progress, Row,
  Select, Skeleton, Space, Spin, Statistic, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BankOutlined, BarChartOutlined, CalendarOutlined, DollarOutlined,
  FileTextOutlined, LineChartOutlined, ReloadOutlined, RiseOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  getExecutiveDashboard,
  type ExecutiveAgingRow,
  type ExecutiveDashboardData,
  type RatioItem,
} from '../api/reportes'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ── Constantes ──────────────────────────────────────────────────────────────

const bucketMeta = [
  { key: 'current',    label: 'Corriente', color: '#2ea172' },
  { key: 'days_1_30', label: '1-30',       color: '#1faec2' },
  { key: 'days_31_60',label: '31-60',      color: '#ff7f00' },
  { key: 'days_61_90',label: '61-90',      color: '#e06f00' },
  { key: 'over_90',   label: '+90 días',   color: '#e5484d' },
] as const

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 6px rgba(15,23,42,0.08)',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number { return Number(v ?? 0) || 0 }

function money(v: unknown, cur = 'GTQ'): string {
  try {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency', currency: cur,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(toNum(v))
  } catch {
    return `${cur} ${toNum(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
  }
}

function pct(v: unknown): string { return `${toNum(v).toFixed(1)}%` }

function riskColor(v: number): string {
  if (v >= 50) return '#e5484d'
  if (v >= 25) return '#ff7f00'
  return '#2ea172'
}

function entityName(row: ExecutiveAgingRow, kind: 'ar' | 'ap'): string {
  return kind === 'ar'
    ? (row.customer_name ?? row.customer_id ?? 'Cliente')
    : (row.vendor_name ?? row.vendor_id ?? 'Proveedor')
}

// ── Presets de período ────────────────────────────────────────────────────────

const PERIOD_PRESETS = [
  {
    label: 'Este mes',
    range: (): [Dayjs, Dayjs] => [dayjs().startOf('month'), dayjs()],
  },
  {
    label: 'Mes anterior',
    range: (): [Dayjs, Dayjs] => [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
  {
    label: 'Este trimestre',
    range: (): [Dayjs, Dayjs] => [dayjs().subtract(dayjs().month() % 3, 'month').startOf('month'), dayjs()],
  },
  {
    label: 'Este año',
    range: (): [Dayjs, Dayjs] => [dayjs().startOf('year'), dayjs()],
  },
]

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  title, value, subtitle, icon, color, currency, isMoney = true, loading = false,
}: {
  title: string
  value: number | null | undefined
  subtitle?: string
  icon: React.ReactNode
  color: string
  currency: string
  isMoney?: boolean
  loading?: boolean
}) {
  return (
    <Card bordered={false} style={cardStyle}>
      <Spin spinning={loading} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <Statistic
            title={<Text style={{ fontSize: 12, color: '#6b7280' }}>{title}</Text>}
            value={isMoney ? money(value, currency) : toNum(value)}
            valueStyle={{ color: '#0a0a0a', fontSize: 20, fontWeight: 700 }}
          />
          <div style={{
            width: 42, height: 42, borderRadius: 8,
            background: `${color}14`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
            flexShrink: 0,
          }}>
            {icon}
          </div>
        </div>
        {subtitle && <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>}
      </Spin>
    </Card>
  )
}

// ── BucketBar ────────────────────────────────────────────────────────────────

function BucketBar({ row, currency }: { row: ExecutiveAgingRow; currency: string }) {
  const total = Math.max(toNum(row.total), 1)
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', background: '#edf1f7' }}>
        {bucketMeta.map(b => (
          <Tooltip key={b.key} title={`${b.label}: ${money(row[b.key], currency)}`}>
            <div style={{ width: `${Math.max((toNum(row[b.key]) / total) * 100, 0)}%`, background: b.color }} />
          </Tooltip>
        ))}
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>{money(row.total, currency)}</Text>
    </div>
  )
}

// ── AgingTable ────────────────────────────────────────────────────────────────

function AgingTable({ rows, kind, currency }: {
  rows: ExecutiveAgingRow[]
  kind: 'ar' | 'ap'
  currency: string
}) {
  const cols: ColumnsType<ExecutiveAgingRow> = [
    {
      title: kind === 'ar' ? 'Cliente' : 'Proveedor',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{entityName(r, kind)}</Text>
          {r.documents != null && (
            <span style={{ marginLeft: 6 }}>
              <Badge count={r.documents} color="#6b7280" overflowCount={999} style={{ fontSize: 10 }} />
            </span>
          )}
        </div>
      ),
    },
    ...bucketMeta.map(b => ({
      title: <span style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>,
      dataIndex: b.key,
      align: 'right' as const,
      width: 110,
      render: (v: number) => (
        v > 0
          ? <Text style={{ color: b.color, fontSize: 12, fontWeight: b.key === 'over_90' ? 700 : 400 }}>{money(v, currency)}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
      ),
    })),
    {
      title: 'Distribución',
      width: 180,
      render: (_, r) => <BucketBar row={r} currency={currency} />,
    },
  ]

  return (
    <Table
      rowKey={r => `${kind}-${r.customer_id ?? r.vendor_id ?? entityName(r, kind)}`}
      columns={cols}
      dataSource={rows}
      pagination={{ pageSize: 8, size: 'small' }}
      size="small"
      scroll={{ x: 900 }}
    />
  )
}

// ── AgingPanel ────────────────────────────────────────────────────────────────

function AgingPanel({ title, section, kind, currency }: {
  title: string
  section: ExecutiveDashboardData['receivables']
  kind: 'ar' | 'ap'
  currency: string
}) {
  const overdueColor = riskColor(section.overduePct)
  const hasCritical = section.topCritical?.length > 0

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <SummaryCard title={`Total ${title}`} value={section.total} icon={<FileTextOutlined />} color="#1faec2" currency={currency} />
        </Col>
        <Col xs={24} md={6}>
          <SummaryCard title="Vencido" value={section.overdue} subtitle={pct(section.overduePct)} icon={<WarningOutlined />} color={overdueColor} currency={currency} />
        </Col>
        <Col xs={24} md={6}>
          <SummaryCard title="+90 días" value={section.critical} subtitle={pct(section.criticalPct)} icon={<WarningOutlined />} color="#e5484d" currency={currency} />
        </Col>
        <Col xs={24} md={6}>
          <Card bordered={false} style={cardStyle}>
            <Text type="secondary" style={{ fontSize: 12 }}>Riesgo de vencimiento</Text>
            <Progress
              percent={Math.min(100, Math.round(section.overduePct))}
              strokeColor={overdueColor}
              style={{ marginTop: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {bucketMeta.slice(1).map(b => (
                <Tooltip key={b.key} title={`${b.label}: ${money(section.buckets?.[b.key] ?? 0, currency)}`}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: b.color, cursor: 'help' }} />
                </Tooltip>
              ))}
              <Text type="secondary" style={{ fontSize: 11 }}>Corte: {section.asOf}</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Críticos +90 días */}
      {hasCritical && (
        <Card
          bordered={false}
          style={{ ...cardStyle, borderLeft: '4px solid #e5484d' }}
          bodyStyle={{ padding: '12px 16px' }}
          title={
            <Space>
              <WarningOutlined style={{ color: '#e5484d' }} />
              <span style={{ color: '#e5484d', fontSize: 13, fontWeight: 600 }}>
                Top críticos +90 días — atención inmediata
              </span>
              <Tag color="#e5484d">{section.topCritical.length}</Tag>
            </Space>
          }
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {section.topCritical.map((row, i) => (
              <div key={i} style={{
                padding: '6px 12px', borderRadius: 6,
                background: '#fff1f0', border: '1px solid #ffccc7',
                minWidth: 180,
              }}>
                <Text strong style={{ fontSize: 12, display: 'block' }}>{entityName(row, kind)}</Text>
                <Text style={{ color: '#e5484d', fontSize: 13, fontWeight: 700 }}>
                  {money(row.over_90, currency)}
                </Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  Total: {money(row.total, currency)}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabla aging — unificada con netting cuando hay anticipos */}
      {(() => {
        const hasAdv = kind === 'ap' && (section.advances?.length ?? 0) > 0

        // Construir lookup de anticipos por vendorId
        const advByVendor = new Map<string, { anticipo: number; nums: string[] }>()
        if (hasAdv) {
          for (const adv of section.advances!) {
            const k = adv.vendor_id || '__sin__'
            if (!advByVendor.has(k)) advByVendor.set(k, { anticipo: 0, nums: [] })
            advByVendor.get(k)!.anticipo += toNum(adv.advance_balance)
            advByVendor.get(k)!.nums.push(adv.advance_number)
          }
        }

        type MergedRow = ExecutiveAgingRow & { anticipo: number; advanceNums: string[]; neto: number }
        const mergedRows: MergedRow[] = hasAdv
          ? section.rows.map(row => {
              const adv = advByVendor.get(row.vendor_id ?? '__sin__') ?? { anticipo: 0, nums: [] }
              return { ...row, anticipo: adv.anticipo, advanceNums: adv.nums, neto: toNum(row.total) - adv.anticipo }
            })
          : []

        const titleText = hasAdv
          ? `CxP por proveedor — posición neta`
          : `Aging ${title} — detalle por ${kind === 'ar' ? 'cliente' : 'proveedor'}`

        return (
          <Card
            bordered={false}
            style={hasAdv ? { ...cardStyle, borderLeft: '3px solid #2ea172' } : cardStyle}
            title={
              hasAdv ? (
                <Space>
                  <span style={{ fontWeight: 600 }}>{titleText}</span>
                  <Tag
                    color={(section.apNetTotal ?? 0) < 0 ? '#1faec2' : 'success'}
                    style={{ fontSize: 11 }}
                  >
                    Anticipos: {money(section.totalAdvances, currency)}
                    {' · '}
                    {(section.apNetTotal ?? 0) < 0
                      ? `A favor: ${money(Math.abs(section.apNetTotal ?? 0), currency)}`
                      : `Neto: ${money(section.apNetTotal ?? 0, currency)}`}
                  </Tag>
                </Space>
              ) : titleText
            }
          >
            {hasAdv ? (
              mergedRows.length > 0 ? (
                <Table<MergedRow>
                  rowKey={r => `ap-${r.vendor_id ?? entityName(r, 'ap')}`}
                  dataSource={mergedRows}
                  size="small"
                  pagination={{ pageSize: 8, size: 'small' }}
                  scroll={{ x: 1100 }}
                  columns={[
                    {
                      title: 'Proveedor',
                      render: (_, r) => (
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{entityName(r, 'ap')}</Text>
                          {r.documents != null && r.documents > 0 && (
                            <Badge count={r.documents} color="#6b7280" overflowCount={999}
                              style={{ marginLeft: 6, fontSize: 10 }} />
                          )}
                        </div>
                      ),
                    },
                    ...bucketMeta.map(b => ({
                      title: <span style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>,
                      dataIndex: b.key as keyof MergedRow,
                      align: 'right' as const,
                      width: 88,
                      render: (v: number) => v > 0
                        ? <Text style={{ color: b.color, fontSize: 12 }}>{money(v, currency)}</Text>
                        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
                    })),
                    {
                      title: <span style={{ color: '#2ea172', fontWeight: 600 }}>Anticipos</span>,
                      dataIndex: 'anticipo' as keyof MergedRow,
                      width: 170,
                      align: 'right' as const,
                      render: (_: any, r: MergedRow) => r.anticipo > 0 ? (
                        <div style={{ textAlign: 'right' }}>
                          {r.advanceNums.map(n => (
                            <div key={n} style={{ fontSize: 10, color: '#2ea172', fontWeight: 600 }}>{n}</div>
                          ))}
                          <Text style={{ color: '#2ea172', fontWeight: 700 }}>({money(r.anticipo, currency)})</Text>
                        </div>
                      ) : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Saldo neto',
                      dataIndex: 'neto' as keyof MergedRow,
                      width: 140,
                      align: 'right' as const,
                      render: (_: any, r: MergedRow) => (
                        <Tag
                          color={r.neto < 0 ? 'success' : r.neto === 0 ? 'default' : '#6b7280'}
                          style={{ fontWeight: 700 }}
                        >
                          {r.neto < 0
                            ? `A favor ${money(Math.abs(r.neto), currency)}`
                            : r.neto === 0 ? 'Saldado' : money(r.neto, currency)}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Distribución',
                      width: 150,
                      render: (_: any, r: MergedRow) => <BucketBar row={r} currency={currency} />,
                    },
                  ]}
                />
              ) : <Empty description="Sin saldos abiertos" />
            ) : (
              section.rows.length
                ? <AgingTable rows={section.rows} kind={kind} currency={currency} />
                : <Empty description="Sin saldos abiertos" />
            )}
          </Card>
        )
      })()}
    </Space>
  )
}

// ── CashFlowPanel ─────────────────────────────────────────────────────────────

function CashFlowPanel({ data, currency }: { data: ExecutiveDashboardData; currency: string }) {
  const cash = data.cashFlow
  if (!cash) return <Empty description="Sin datos de flujo de caja" />

  const flows = [
    { label: 'Operación',    value: cash.operating.total,   color: '#2ea172', items: cash.operating.adjustments },
    { label: 'Inversión',    value: cash.investing.total,   color: '#1faec2', items: cash.investing.items },
    { label: 'Financiación', value: cash.financing.total,   color: '#6b7280', items: cash.financing.items },
  ]
  const max = Math.max(...flows.map(f => Math.abs(toNum(f.value))), 1)

  const chartOption = {
    tooltip: { trigger: 'axis', formatter: (p: any[]) => `${p[0].name}: ${money(p[0].value, currency)}` },
    xAxis: { type: 'category', data: flows.map(f => f.label), axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => money(v, currency), fontSize: 10 } },
    series: [{
      type: 'bar', barWidth: 40,
      data: flows.map(f => ({
        value: toNum(f.value),
        itemStyle: {
          color: toNum(f.value) >= 0 ? f.color : '#e5484d',
          borderRadius: [4, 4, 0, 0],
        },
      })),
    }],
    grid: { left: '2%', right: '2%', bottom: '8%', containLabel: true },
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <SummaryCard title="Variación neta de caja" value={cash.netCashChange} icon={<BankOutlined />} color={toNum(cash.netCashChange) < 0 ? '#e5484d' : '#2ea172'} currency={currency} subtitle={toNum(cash.netCashChange) < 0 ? 'Caja decreció en el período' : 'Caja creció en el período'} />
      </Col>
      <Col xs={24} md={8}>
        <SummaryCard title="Caja final estimada" value={cash.totalCashEnd} icon={<DollarOutlined />} color="#1faec2" currency={currency} />
      </Col>
      <Col xs={24} md={8}>
        <SummaryCard title="Cuentas de caja" value={cash.cashAccounts.length} icon={<BankOutlined />} color="#1faec2" currency={currency} isMoney={false} />
      </Col>

      {/* Gráfico de barras por actividad */}
      <Col xs={24} lg={12}>
        <Card bordered={false} style={cardStyle} title="Flujo por actividad">
          <ReactECharts option={chartOption} style={{ height: 220 }} />
        </Card>
      </Col>

      {/* Detalle por actividad con items */}
      <Col xs={24} lg={12}>
        <Card bordered={false} style={cardStyle} title="Detalle de actividades">
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {flows.map(flow => (
              <div key={flow.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 13, color: flow.color }}>{flow.label}</Text>
                  <Text strong style={{ color: toNum(flow.value) < 0 ? '#e5484d' : flow.color }}>
                    {money(flow.value, currency)}
                  </Text>
                </div>
                <Progress
                  percent={Math.round(Math.abs(toNum(flow.value)) / max * 100)}
                  showInfo={false} strokeColor={toNum(flow.value) < 0 ? '#e5484d' : flow.color}
                  style={{ marginBottom: flow.items?.length ? 4 : 12 }}
                />
                {flow.items?.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12, borderLeft: `2px solid ${flow.color}33`, marginBottom: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.label}</Text>
                    <Text style={{ fontSize: 11, color: toNum(item.amount) < 0 ? '#e5484d' : '#374151' }}>
                      {money(item.amount, currency)}
                    </Text>
                  </div>
                ))}
              </div>
            ))}
          </Space>
        </Card>
      </Col>

      {/* Cuentas bancarias */}
      <Col xs={24}>
        <Card bordered={false} style={cardStyle} title="Movimiento por cuenta bancaria y caja">
          {cash.cashAccounts.length ? (
            <Table
              dataSource={cash.cashAccounts}
              rowKey={r => `${r.code}-${r.name}`}
              pagination={false}
              size="small"
              columns={[
                { title: 'Código', dataIndex: 'code', width: 100 },
                { title: 'Cuenta', dataIndex: 'name' },
                {
                  title: 'Cambio en el período', align: 'right', width: 200,
                  render: (_, r) => (
                    <Text strong style={{ color: toNum(r.change) < 0 ? '#e5484d' : '#2ea172' }}>
                      {money(r.change, currency)}
                    </Text>
                  ),
                },
              ]}
            />
          ) : <Empty description={cash.note ?? 'Sin cuentas vinculadas'} />}
        </Card>
      </Col>
    </Row>
  )
}

// ── KpiPanel ──────────────────────────────────────────────────────────────────

function ratioColor(item: RatioItem): string {
  if (item.valor == null) return '#6b7280'
  const v = toNum(item.valor)
  const ideal = item.ideal ?? ''
  // Liquidez: > 1 es bueno
  if (ideal.includes('>1') || ideal.includes('> 1') || ideal.toLowerCase().includes('mayor')) return v >= 1 ? '#2ea172' : '#e5484d'
  // Endeudamiento: menor es mejor (< 50% o < 0.5)
  if (ideal.includes('<') && (ideal.includes('%') || Number(ideal.replace(/[^0-9.]/g, '')) < 1)) {
    const limit = parseFloat(ideal.replace(/[^0-9.]/g, '')) || 50
    return v < limit ? '#2ea172' : v < limit * 1.3 ? '#ff7f00' : '#e5484d'
  }
  // Rentabilidad: positivo es bueno
  if (ideal.includes('>') && ideal.includes('0')) return v > 0 ? '#2ea172' : '#e5484d'
  return v > 0 ? '#2ea172' : v === 0 ? '#6b7280' : '#e5484d'
}

function KpiPanel({ ratios, payables, currency }: { ratios: ExecutiveDashboardData['ratios']; payables: ExecutiveDashboardData['payables']; currency: string }) {
  if (!ratios) return <Empty description="Sin KPIs financieros" />

  const totalAdv = payables?.totalAdvances ?? 0
  const apNetTotal = payables?.apNetTotal ?? payables?.total ?? 0
  const apGross    = payables?.total ?? 0

  const cxpNettingItems: RatioItem[] = totalAdv > 0 ? [
    {
      nombre: 'CxP bruta (facturas)',
      valor: apGross,
      unidad: ` ${currency}`,
      ideal: 'Menor es mejor',
      descripcion: 'Saldo pendiente de pago a proveedores (facturas)',
    },
    {
      nombre: 'Anticipos disponibles',
      valor: totalAdv,
      unidad: ` ${currency}`,
      ideal: 'Crédito a favor',
      descripcion: 'Pagos anticipados a proveedores — reducen la obligación neta',
    },
    {
      nombre: 'Neto CxP real',
      valor: apNetTotal,
      unidad: ` ${currency}`,
      ideal: '< CxP bruta',
      descripcion: 'Obligación real con proveedores después de descontar anticipos',
    },
  ] : []

  const groups: Array<{ title: string; items: RatioItem[]; icon: React.ReactNode }> = [
    { title: 'Liquidez',       items: ratios.liquidez,       icon: <DollarOutlined /> },
    { title: 'Endeudamiento',  items: ratios.endeudamiento,  icon: <WarningOutlined /> },
    { title: 'Rentabilidad',   items: ratios.rentabilidad,   icon: <RiseOutlined /> },
    { title: 'Eficiencia',     items: ratios.eficiencia,     icon: <BarChartOutlined /> },
    ...(cxpNettingItems.length > 0 ? [{ title: 'Posición CxP neta', items: cxpNettingItems, icon: <WarningOutlined /> }] : []),
  ]

  return (
    <Row gutter={[16, 16]}>
      {groups.map(({ title, items, icon }) => (
        <Col xs={24} lg={12} key={title}>
          <Card
            bordered={false}
            style={cardStyle}
            title={<Space>{icon}<span>{title}</span></Space>}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {items.map(item => {
                const color = ratioColor(item)
                const v = item.valor != null ? `${toNum(item.valor).toFixed(2)}${item.unidad ?? ''}` : '—'
                return (
                  <div key={item.nombre} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 16,
                    borderBottom: '1px solid #f0f2f5', paddingBottom: 8,
                    alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13 }}>{item.nombre}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.descripcion ?? item.ideal ?? ''}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <Tag color={color === '#2ea172' ? 'success' : color === '#e5484d' ? 'error' : color === '#ff7f00' ? 'warning' : 'default'}
                        style={{ fontSize: 13, fontWeight: 700, minWidth: 56, textAlign: 'center' }}
                      >
                        {v}
                      </Tag>
                      {item.ideal && (
                        <div style={{ fontSize: 10, color: '#9aa1ab', marginTop: 2 }}>
                          Ideal: {item.ideal}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  )
}

// ── OverdueInvoicesPanel ──────────────────────────────────────────────────────

function OverdueInvoicesPanel({ invoices, currency }: { invoices: any[]; currency: string }) {
  if (!invoices.length) return <Empty description="Sin facturas vencidas" />
  return (
    <Table
      dataSource={invoices}
      rowKey={r => r.id ?? r.invoiceNumber ?? String(Math.random())}
      size="small"
      pagination={false}
      columns={[
        { title: 'Factura', dataIndex: 'invoiceNumber', width: 130, render: v => <Text code>{v}</Text> },
        { title: 'Cliente', dataIndex: 'customerName', render: v => <Text>{v}</Text> },
        {
          title: 'Vencimiento', dataIndex: 'dueDate', width: 120,
          render: v => v ? <Text style={{ color: '#e5484d' }}>{dayjs(v).format('DD/MM/YYYY')}</Text> : '—',
        },
        {
          title: 'Días vencida', width: 110, align: 'right',
          render: (_, r) => {
            const days = r.dueDate ? dayjs().diff(dayjs(r.dueDate), 'day') : 0
            return <Tag color={days > 90 ? '#e5484d' : days > 30 ? '#ff7f00' : 'gold'}>{days}d</Tag>
          },
        },
        {
          title: 'Saldo', dataIndex: 'balance', align: 'right', width: 150,
          render: v => <Text strong style={{ color: '#e5484d' }}>{money(v, currency)}</Text>,
        },
      ]}
    />
  )
}

// ── ResumenTab ────────────────────────────────────────────────────────────────

function ResumenTab({ data, currency, loading }: {
  data: ExecutiveDashboardData
  currency: string
  loading: boolean
}) {
  const s = data.summary

  const revenueChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      formatter: (p: any[]) => p.map((item: any) => `${item.seriesName}: ${money(item.value, currency)}`).join('<br/>'),
    },
    legend: { data: ['Ventas', 'Compras', 'Utilidad Neta'], bottom: 0, textStyle: { fontSize: 11 } },
    xAxis: { type: 'category', data: ['Período actual'], axisLabel: { show: false } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k`, fontSize: 10 } },
    series: [
      { name: 'Ventas',       type: 'bar', barWidth: 45, data: [toNum(s.salesTotal)],    itemStyle: { color: '#1faec2', borderRadius: [4,4,0,0] } },
      { name: 'Compras',      type: 'bar', barWidth: 45, data: [toNum(s.purchasesTotal)],itemStyle: { color: '#ff7f00', borderRadius: [4,4,0,0] } },
      { name: 'Utilidad Neta',type: 'bar', barWidth: 45, data: [toNum(s.netIncome)],     itemStyle: { color: toNum(s.netIncome) >= 0 ? '#2ea172' : '#e5484d', borderRadius: [4,4,0,0] } },
    ],
    grid: { left: '3%', right: '3%', top: '8%', bottom: '14%', containLabel: true },
  }), [s, currency])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Fila 1: métricas P&L */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <SummaryCard loading={loading} title="Ventas del período" value={s.salesTotal} icon={<RiseOutlined />} color="#1faec2" currency={currency}
            subtitle={`Margen bruto: ${pct(s.grossMargin)}`} />
        </Col>
        <Col xs={12} md={6}>
          <SummaryCard loading={loading} title="Compras / Gastos" value={s.purchasesTotal} icon={<BarChartOutlined />} color="#ff7f00" currency={currency}
            subtitle={`Margen operativo: ${pct(s.operatingMargin)}`} />
        </Col>
        <Col xs={12} md={6}>
          <SummaryCard loading={loading} title="Utilidad neta" value={s.netIncome} icon={<LineChartOutlined />}
            color={s.netIncome < 0 ? '#e5484d' : '#2ea172'} currency={currency}
            subtitle={`Margen neto: ${pct(s.netMargin)}`} />
        </Col>
        <Col xs={12} md={6}>
          <SummaryCard loading={loading} title="Caja final estimada" value={s.cashEnd} icon={<BankOutlined />} color="#1faec2" currency={currency}
            subtitle={`Variación: ${money(s.cashNetChange, currency)}`} />
        </Col>
      </Row>

      {/* Fila 2: métricas de gestión */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <SummaryCard loading={loading} title="CxC total" value={s.arTotal} icon={<FileTextOutlined />} color="#1faec2" currency={currency}
            subtitle={`Vencido: ${money(s.arOverdue, currency)}`} />
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false} style={cardStyle}>
            <Spin spinning={loading} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>CxP total</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0a0a0a' }}>{money(s.apTotal, currency)}</div>
                  {(s.totalAdvances ?? 0) > 0 && (
                    <div style={{ marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: '#2ea172' }}>
                        Anticipos: ({money(s.totalAdvances, currency)})
                      </Text>
                      <br />
                      <Text style={{ fontSize: 12, fontWeight: 700, color: (s.apNetTotal ?? s.apTotal) <= 0 ? '#2ea172' : '#e5484d' }}>
                        Neto: {money(s.apNetTotal ?? s.apTotal, currency)}
                      </Text>
                    </div>
                  )}
                  {!(s.totalAdvances ?? 0) && (
                    <Text type="secondary" style={{ fontSize: 12 }}>Vencido: {money(s.apOverdue, currency)}</Text>
                  )}
                </div>
                <div style={{ width: 42, height: 42, borderRadius: 8, background: '#ff7f0014', color: '#ff7f00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
                  <WarningOutlined />
                </div>
              </div>
            </Spin>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false} style={cardStyle}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#6b7280' }}>Facturas vencidas</Text>}
              value={s.overdueInvoices}
              suffix="documentos"
              valueStyle={{ color: s.overdueInvoices > 0 ? '#e5484d' : '#2ea172', fontSize: 20, fontWeight: 700 }}
              prefix={<WarningOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              CxC vencida: {pct(s.arOverduePct)} · CxP vencida: {pct(s.apOverduePct)}
            </Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false} style={cardStyle}>
            <Text type="secondary" style={{ fontSize: 12 }}>Apalancamiento CxP/CxC</Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0a0a0a', margin: '4px 0' }}>
              {s.commercialLeverage == null ? '—' : `${s.commercialLeverage.toFixed(2)}x`}
            </div>
            <Tag color={s.commercialLeverage == null ? 'default' : s.commercialLeverage > 1.5 ? '#e5484d' : s.commercialLeverage > 1 ? '#ff7f00' : '#2ea172'}>
              {s.commercialLeverage == null ? 'Sin datos' : s.commercialLeverage > 1 ? 'CxP > CxC (alerta)' : 'Equilibrado'}
            </Tag>
          </Card>
        </Col>
      </Row>

      {/* Fila 3: gráfico + alertas */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card bordered={false} style={cardStyle} title="Ventas vs Compras vs Utilidad">
            <ReactECharts option={revenueChartOption} style={{ height: 220 }} />
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Margen bruto</Text>
                  <div style={{ fontSize: 15, fontWeight: 700, color: toNum(s.grossMargin) < 0 ? '#e5484d' : '#2ea172' }}>{pct(s.grossMargin)}</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Margen operativo</Text>
                  <div style={{ fontSize: 15, fontWeight: 700, color: toNum(s.operatingMargin) < 0 ? '#e5484d' : '#374151' }}>{pct(s.operatingMargin)}</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Margen neto</Text>
                  <div style={{ fontSize: 15, fontWeight: 700, color: toNum(s.netMargin) < 0 ? '#e5484d' : '#2ea172' }}>{pct(s.netMargin)}</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {/* Indicadores riesgo */}
            <Card bordered={false} style={cardStyle} bodyStyle={{ padding: '12px 16px' }}
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>Indicadores de riesgo</span>}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 12 }}>CxC vencida sobre total CxC</Text>
                    <Text strong style={{ fontSize: 12, color: riskColor(s.arOverduePct) }}>{pct(s.arOverduePct)}</Text>
                  </div>
                  <Progress percent={Math.min(100, Math.round(s.arOverduePct))} strokeColor={riskColor(s.arOverduePct)} size="small" showInfo={false} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 12 }}>CxP vencida sobre total CxP</Text>
                    <Text strong style={{ fontSize: 12, color: riskColor(s.apOverduePct) }}>{pct(s.apOverduePct)}</Text>
                  </div>
                  <Progress percent={Math.min(100, Math.round(s.apOverduePct))} strokeColor={riskColor(s.apOverduePct)} size="small" showInfo={false} />
                </div>
              </Space>
            </Card>
            {/* Alertas */}
            <Card bordered={false} style={cardStyle} bodyStyle={{ padding: '12px 16px' }}
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>Alertas e interpretación</span>}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={6}>
                {data.insights.map((ins, i) => (
                  <Alert
                    key={i}
                    type={ins.type === 'danger' ? 'error' : ins.type === 'success' ? 'success' : 'warning'}
                    showIcon message={ins.title} description={ins.text}
                    style={{ padding: '6px 10px', fontSize: 12 }}
                  />
                ))}
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* Fila 4: facturas vencidas recientes */}
      {data.recent?.overdueInvoices?.length > 0 && (
        <Card bordered={false} style={{ ...cardStyle, borderLeft: '4px solid #e5484d' }}
          title={
            <Space>
              <WarningOutlined style={{ color: '#e5484d' }} />
              <span style={{ color: '#e5484d', fontWeight: 600 }}>
                Facturas de clientes vencidas — requieren seguimiento
              </span>
              <Tag color="#e5484d">{data.recent.overdueInvoices.length}</Tag>
            </Space>
          }
        >
          <OverdueInvoicesPanel invoices={data.recent.overdueInvoices} currency={currency} />
        </Card>
      )}
    </Space>
  )
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = range
        ? { fromDate: range[0].format('YYYY-MM-DD'), toDate: range[1].format('YYYY-MM-DD'), asOf: range[1].format('YYYY-MM-DD') }
        : undefined
      setData(await getExecutiveDashboard(params))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    const t = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  const currency = data?.currency ?? 'GTQ'

  const tabs = useMemo(() => data ? [
    {
      key: 'resumen',
      label: <Space><LineChartOutlined />Resumen Ejecutivo</Space>,
      children: <ResumenTab data={data} currency={currency} loading={loading} />,
    },
    {
      key: 'cxc',
      label: (
        <Space>
          <FileTextOutlined />
          CxC
          {data.receivables.critical > 0 && <Badge dot status="error" />}
        </Space>
      ),
      children: <AgingPanel title="CxC" section={data.receivables} kind="ar" currency={currency} />,
    },
    {
      key: 'cxp',
      label: (
        <Space>
          <WarningOutlined />
          CxP
          {data.payables.critical > 0 && <Badge dot status="error" />}
        </Space>
      ),
      children: <AgingPanel title="CxP" section={data.payables} kind="ap" currency={currency} />,
    },
    {
      key: 'flujo',
      label: <Space><BankOutlined />Flujo de Caja</Space>,
      children: <CashFlowPanel data={data} currency={currency} />,
    },
    {
      key: 'kpis',
      label: <Space><BarChartOutlined />KPIs Financieros</Space>,
      children: <KpiPanel ratios={data.ratios} payables={data.payables} currency={currency} />,
    },
  ] : [], [data, currency, loading])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Dashboard Ejecutivo</Title>
          <Text type="secondary">
            {data
              ? `${data.company?.company_name ?? 'Empresa'} · ${data.period.from} — ${data.period.to}`
              : 'Centro financiero de decisión — CFO'}
          </Text>
        </div>
        <Space wrap align="center">
          {/* Presets rápidos */}
          {PERIOD_PRESETS.map(p => (
            <Button key={p.label} size="small" icon={<CalendarOutlined />}
              onClick={() => setRange(p.range())}
            >
              {p.label}
            </Button>
          ))}
          <RangePicker
            value={range}
            onChange={v => setRange(v as [Dayjs, Dayjs] | null)}
            allowClear
            placeholder={['Desde', 'Hasta']}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </div>

      {/* Contenido */}
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : data ? (
        <Tabs
          items={tabs}
          type="card"
          tabBarExtraContent={
            <Tag icon={<BarChartOutlined />} color="#1faec2">
              Datos reales · corte {data.period.asOf}
            </Tag>
          }
        />
      ) : (
        <Card bordered={false} style={cardStyle}>
          <Empty description="No se pudo cargar el dashboard ejecutivo" />
        </Card>
      )}
    </div>
  )
}
