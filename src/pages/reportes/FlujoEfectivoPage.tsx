import { useEffect, useState } from 'react'
import { Card, Col, Row, Typography, Statistic, Tag, Space, Alert, Table, Spin } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, BankOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import { getFlujoEfectivo, type FlujoEfectivoData } from '../../api/reportes'
import { getMonthRanges, getColConfig, fmtCol, fmtTotal, type MonthRange } from '../../utils/reportMonthly'

const { Text } = Typography

const fmtQ = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ─── Single-period section card ───────────────────────────────────────────────

function FlowSection({ title, total, items, color, icon }: {
  title: string; total: number; items: { label: string; amount: number }[]; color: string; icon: React.ReactNode
}) {
  return (
    <Card size="small" style={{ borderRadius: 8, marginBottom: 12, borderLeft: `3px solid ${color}` }}
      styles={{ body: { padding: 0 } }}
      title={<Space>{icon}<Text strong style={{ fontSize: 13, color }}>{title}</Text></Space>}
      extra={<Text strong style={{ fontFamily: 'monospace', color: total >= 0 ? '#389e0d' : '#cf1322' }}>{fmtQ(total)}</Text>}
    >
      <Table size="small" dataSource={items} rowKey="label" pagination={false} showHeader={false}
        columns={[
          { dataIndex: 'label', render: (v: string) => <Text style={{ fontSize: 12, paddingLeft: 8 }}>{v}</Text> },
          {
            dataIndex: 'amount', width: 160, align: 'right' as const,
            render: (v: number) => (
              <Space size={4}>
                {v >= 0 ? <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 10 }} /> : <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />}
                <Text style={{ fontFamily: 'monospace', fontSize: 12, color: v >= 0 ? '#389e0d' : '#cf1322' }}>{fmtQ(Math.abs(v))}</Text>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}

// ─── Monthly table ─────────────────────────────────────────────────────────────

type FKind = 'hdr' | 'acct' | 'sub' | 'grand'
type FRow  = { key: string; _kind: FKind; _name: string; _color?: string; _total: number; [ym: string]: any }

function buildFlujoRows(md: Array<{ month: MonthRange; data: FlujoEfectivoData | null }>): FRow[] {
  const months = md.map(m => m.month)
  const empty  = Object.fromEntries(months.map(m => [m.yearMonth, null]))
  const sum    = (v: Record<string, number>) => Object.values(v).filter(x => x != null).reduce((s, x) => s + x, 0)

  const hdr  = (key: string, name: string, color?: string): FRow => ({ key, _kind: 'hdr',  _name: name, _color: color, _total: 0, ...empty })
  const acct = (key: string, name: string, vals: Record<string, number>): FRow => ({ key, _kind: 'acct', _name: name, _total: sum(vals), ...vals })
  const sub  = (key: string, name: string, vals: Record<string, number>, kind: FKind = 'sub'): FRow => ({ key, _kind: kind, _name: name, _total: sum(vals), ...vals })

  const sVals = (getter: (d: FlujoEfectivoData) => number) =>
    Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, data ? getter(data) : 0]))

  // Collect all unique adjustment labels
  const adjLabels = [...new Set(md.flatMap(m => m.data?.operating.adjustments.map(a => a.label) ?? []))]
  const invLabels = [...new Set(md.flatMap(m => m.data?.investing.items.map(a => a.label) ?? []))]
  const finLabels = [...new Set(md.flatMap(m => m.data?.financing.items.map(a => a.label) ?? []))]

  const labelVals = (section: 'adj' | 'inv' | 'fin', label: string) =>
    Object.fromEntries(md.map(({ month: m, data }) => {
      let items: { label: string; amount: number }[] = []
      if (section === 'adj') items = data?.operating.adjustments ?? []
      if (section === 'inv') items = data?.investing.items ?? []
      if (section === 'fin') items = data?.financing.items ?? []
      return [m.yearMonth, items.find(i => i.label === label)?.amount ?? 0]
    }))

  const rows: FRow[] = []

  // OPERACIÓN
  rows.push(hdr('hdr-op', 'ACTIVIDADES DE OPERACIÓN', '#1677ff'))
  rows.push(acct('op-ni', 'Utilidad Neta del Período', sVals(d => d.operating.netIncome)))
  adjLabels.forEach(lbl => rows.push(acct(`op-adj-${lbl}`, lbl, labelVals('adj', lbl))))
  rows.push(sub('sub-op', 'Total Operación', sVals(d => d.operating.total)))

  // INVERSIÓN
  rows.push(hdr('hdr-inv', 'ACTIVIDADES DE INVERSIÓN', '#722ed1'))
  invLabels.forEach(lbl => rows.push(acct(`inv-${lbl}`, lbl, labelVals('inv', lbl))))
  rows.push(sub('sub-inv', 'Total Inversión', sVals(d => d.investing.total)))

  // FINANCIACIÓN
  rows.push(hdr('hdr-fin', 'ACTIVIDADES DE FINANCIACIÓN', '#fa8c16'))
  finLabels.forEach(lbl => rows.push(acct(`fin-${lbl}`, lbl, labelVals('fin', lbl))))
  rows.push(sub('sub-fin', 'Total Financiación', sVals(d => d.financing.total)))

  rows.push(sub('grand-net', 'CAMBIO NETO EN EFECTIVO', sVals(d => d.netCashChange), 'grand'))

  const nonZeroMonths = (r: FRow) => months.some(m => (r[m.yearMonth] ?? 0) !== 0)
  return rows.filter(r => r._kind !== 'acct' || r._total !== 0 || nonZeroMonths(r))
}

function MonthlyFlujoTable({ monthData, loading }: { monthData: Array<{ month: MonthRange; data: FlujoEfectivoData | null }>; loading: boolean }) {
  const months = monthData.map(m => m.month)
  const n      = months.length
  if (n === 0) return <Spin spinning={loading}><div style={{ height: 120 }} /></Spin>

  const cfg  = getColConfig(n)
  const rows = buildFlujoRows(monthData)

  const rowBg: Record<FKind, string | undefined> = {
    hdr:   '#f0f5ff',
    acct:  undefined,
    sub:   '#fafafa',
    grand: undefined,
  }

  const cell = (v: number | null, kind: FKind) => {
    if (v == null || kind === 'hdr') return null
    const bold = kind !== 'acct'
    const c    = bold ? (v < 0 ? '#cf1322' : '#389e0d') : (v < 0 ? '#cf1322' : undefined)
    return <span style={{ fontFamily: 'monospace', fontSize: cfg.cellFont, fontWeight: bold ? 700 : 400, color: c }}>{fmtCol(v, cfg.useDecimals)}</span>
  }

  const columns: ColumnsType<FRow> = [
    {
      key: '_name', dataIndex: '_name' as const, width: cfg.nameW, ellipsis: true,
      render: (v: string, row) => (
        <span style={{ fontSize: cfg.nameFont, fontWeight: row._kind === 'acct' ? 400 : 600, color: row._color, paddingLeft: row._kind === 'acct' ? 14 : 0 }}>
          {v}
        </span>
      ),
    },
    ...months.map(m => ({
      key: m.yearMonth, dataIndex: m.yearMonth as keyof FRow,
      width: cfg.colW, align: 'right' as const,
      title: <div style={{ fontSize: 11, textAlign: 'center' as const, lineHeight: 1.3 }}>{m.label}</div>,
      render: (v: number | null, row: FRow) => cell(v, row._kind),
    })),
    {
      key: '_total', dataIndex: '_total' as const, width: cfg.colW + 14, align: 'right' as const,
      title: <div style={{ fontSize: 11, textAlign: 'center' as const, lineHeight: 1.3, fontWeight: 700 }}>AÑO A<br />LA FECHA</div>,
      render: (v: number, row) => {
        if (row._kind === 'hdr') return null
        const bold = row._kind !== 'acct'
        const c    = bold ? (v < 0 ? '#cf1322' : '#389e0d') : (v < 0 ? '#cf1322' : undefined)
        return <span style={{ fontFamily: 'monospace', fontSize: cfg.cellFont, fontWeight: bold ? 700 : 400, color: c }}>{fmtTotal(v)}</span>
      },
    },
  ]

  return (
    <Spin spinning={loading}>
      <Table
        size="small"
        dataSource={rows}
        columns={columns}
        rowKey="key"
        pagination={false}
        showHeader
        scroll={{ x: 'max-content' }}
        onRow={row => ({
          style: {
            background: row._kind === 'grand'
              ? (row._total >= 0 ? '#f6ffed' : '#fff2f0')
              : rowBg[row._kind],
            borderTop: row._kind === 'grand' ? '2px solid #d9d9d9' : undefined,
          },
        })}
      />
    </Spin>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function FlujoEfectivoPage() {
  const [from,    setFrom]    = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,      setTo]      = useState(dayjs().format('YYYY-MM-DD'))
  const [preset,  setPreset]  = useState<string | null>('Este año')

  const [single,   setSingle]   = useState<FlujoEfectivoData | null>(null)
  const [sLoading, setSLoading] = useState(false)
  const [sError,   setSError]   = useState<string | null>(null)

  const [monthly,  setMonthly]  = useState<Array<{ month: MonthRange; data: FlujoEfectivoData | null }>>([])
  const [mLoading, setMLoading] = useState(false)

  const isMonthly = !!preset

  useEffect(() => {
    if (isMonthly) return
    setSLoading(true); setSError(null)
    getFlujoEfectivo({ fromDate: from, toDate: to })
      .then(setSingle).catch(e => setSError(e?.response?.data?.message || 'Error cargando Flujo de Efectivo'))
      .finally(() => setSLoading(false))
  }, [from, to, isMonthly])

  useEffect(() => {
    if (!isMonthly) return
    const months = getMonthRanges(from, to)
    if (months.length === 0) return
    setMLoading(true)
    Promise.all(months.map(m => getFlujoEfectivo({ fromDate: m.from, toDate: m.to }).catch(() => null)))
      .then(results => setMonthly(months.map((m, i) => ({ month: m, data: results[i] }))))
      .finally(() => setMLoading(false))
  }, [from, to, isMonthly])

  return (
    <ReportLayout
      title="Flujo de Caja"
      subtitle="Estado de Flujo de Efectivo · Método Indirecto · NIC 7"
      tipoExport="flujo-efectivo"
      loading={isMonthly ? false : sLoading}
      error={isMonthly ? null : sError}
      fromDate={from}
      toDate={to}
      onRangeChange={(f, t) => { setFrom(f); setTo(t) }}
      onPresetChange={setPreset}
      exportParams={{ fromDate: from, toDate: to }}
    >
      {isMonthly ? (
        <MonthlyFlujoTable monthData={monthly} loading={mLoading} />
      ) : (
        single && (
          <>
            <Tag style={{ marginBottom: 16 }}>Del {single.period.from} al {single.period.to}</Tag>

            {single.note && <Alert type="info" showIcon message={single.note} style={{ marginBottom: 16 }} />}

            <Row gutter={12} style={{ marginBottom: 16 }}>
              {[
                { label: 'Flujo Operativo',    value: single.operating.total,  color: '#1B3A6B' },
                { label: 'Flujo Inversión',    value: single.investing.total,  color: '#722ed1' },
                { label: 'Flujo Financiación', value: single.financing.total,  color: '#fa8c16' },
                { label: 'Cambio Neto Caja',   value: single.netCashChange,    color: single.netCashChange >= 0 ? '#389e0d' : '#cf1322' },
              ].map(k => (
                <Col xs={12} sm={6} key={k.label}>
                  <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                      value={k.value} precision={2} prefix="Q"
                      valueStyle={{ fontSize: 13, fontFamily: 'monospace', color: k.color }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <FlowSection title="Actividades de Operación" total={single.operating.total} color="#1677ff"
              icon={<BankOutlined style={{ color: '#1677ff' }} />}
              items={[{ label: 'Utilidad Neta del Período', amount: single.operating.netIncome }, ...single.operating.adjustments]}
            />
            <FlowSection title="Actividades de Inversión" total={single.investing.total} color="#722ed1"
              icon={<ArrowUpOutlined style={{ color: '#722ed1' }} />} items={single.investing.items}
            />
            <FlowSection title="Actividades de Financiación" total={single.financing.total} color="#fa8c16"
              icon={<ArrowDownOutlined style={{ color: '#fa8c16' }} />} items={single.financing.items}
            />

            <Card size="small"
              style={{ borderRadius: 8, background: single.netCashChange >= 0 ? '#f6ffed' : '#fff2f0', border: `1px solid ${single.netCashChange >= 0 ? '#b7eb8f' : '#ffa39e'}` }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong style={{ fontSize: 13 }}>Cambio Neto en Efectivo</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>Operación + Inversión + Financiación</Text></div>
                </div>
                <Text strong style={{ fontFamily: 'monospace', fontSize: 16, color: single.netCashChange >= 0 ? '#389e0d' : '#cf1322' }}>
                  {fmtQ(single.netCashChange)}
                </Text>
              </div>
            </Card>

            {single.cashAccounts.length > 0 && (
              <Card size="small" title={<Text strong style={{ fontSize: 12 }}>Cuentas de Efectivo y Equivalentes</Text>}
                style={{ marginTop: 12, borderRadius: 8 }} styles={{ body: { padding: 0 } }}
              >
                <Table size="small" dataSource={single.cashAccounts} rowKey="code" pagination={false}
                  columns={[
                    { dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{v}</Text> },
                    { dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                    { dataIndex: 'change', width: 140, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: v >= 0 ? '#389e0d' : '#cf1322' }}>{fmtQ(v)}</Text> },
                  ]}
                />
              </Card>
            )}
          </>
        )
      )}
    </ReportLayout>
  )
}
