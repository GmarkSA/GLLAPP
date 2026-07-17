import { useEffect, useState } from 'react'
import { LineChartOutlined } from '@ant-design/icons'
import { Card, Col, Row, Table, Typography, Divider, Statistic, Progress, Space, Switch, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import AccountDrilldownDrawer, { type DrilldownTarget } from '../../components/AccountDrilldownDrawer'
import { getEstadoResultados, type EstadoResultadosData, type AccountRow } from '../../api/reportes'
import { getMonthRanges, getColConfig, fmtCol, fmtTotal, type MonthRange } from '../../utils/reportMonthly'

const { Text } = Typography

const fmtQ   = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const accent = (n: number) => (n >= 0 ? '#2ea172' : '#e5484d')

// ─── Single-period helpers (existing view) ────────────────────────────────────

function SubtotalRow({ label, value, highlight, border }: { label: string; value: number; highlight?: boolean; border?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 16px',
      borderTop: border ? '2px solid rgba(10,10,10,0.08)' : undefined,
      background: highlight ? (value >= 0 ? 'rgba(10,10,10,0.04)' : '#fdecec') : '#fafbfc',
      borderRadius: highlight ? 6 : 0, margin: highlight ? '4px 0' : 0,
    }}>
      <Text strong={highlight} style={{ fontSize: highlight ? 13 : 12, color: highlight ? accent(value) : '#0a0a0a' }}>{label}</Text>
      <Text strong={highlight} style={{ fontVariantNumeric: 'tabular-nums', fontSize: highlight ? 14 : 12, color: accent(value) }}>{fmtQ(value)}</Text>
    </div>
  )
}

function AccountTable({ accounts, total, label, negate, onDrilldown }: { accounts: AccountRow[]; total: number; label: string; negate?: boolean; onDrilldown?: (id: string, name: string) => void }) {
  if (!accounts || accounts.length === 0) return null
  return (
    <Table size="small" dataSource={accounts} rowKey="id" pagination={false} showHeader={false} style={{ marginBottom: 0 }}
      summary={() => (
        <Table.Summary.Row style={{ background: '#fafbfc' }}>
          <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 12 }}>Total {label}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{negate ? `(${fmtQ(total)})` : fmtQ(total)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        { dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280' }}>{v}</Text> },
        { dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
        { dataIndex: 'balance', width: 140, align: 'right' as const, render: (v: number, row: AccountRow) => {
          const txt = <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{negate ? `(${fmtQ(v)})` : fmtQ(v)}</Text>
          if (!onDrilldown || !row.id) return txt
          return (
            <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
              onClick={() => onDrilldown(row.id, row.name)}>
              {txt}
            </span>
          )
        }},
      ]}
    />
  )
}

// ─── Monthly table ─────────────────────────────────────────────────────────────

type RowKind = 'hdr' | 'acct' | 'sub' | 'grand' | 'grand2'
type AnyRow  = { key: string; _kind: RowKind; _name: string; _code?: string; _color?: string; _accountId?: string; _total: number; [ym: string]: any }

function buildERRows(md: Array<{ month: MonthRange; data: EstadoResultadosData | null }>): AnyRow[] {
  const months = md.map(m => m.month)
  const empty  = Object.fromEntries(months.map(m => [m.yearMonth, null]))

  const collect = (getter: (d: EstadoResultadosData) => AccountRow[]) => {
    const map = new Map<string, { code: string; name: string }>()
    md.forEach(({ data }) => data && getter(data).forEach(a => map.set(a.id, { code: a.code, name: a.name })))
    return [...map.entries()].map(([id, info]) => ({ id, ...info }))
  }

  const aVals = (getter: (d: EstadoResultadosData) => AccountRow[], id: string) =>
    Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, data ? (getter(data).find(a => a.id === id)?.balance ?? 0) : 0]))

  const sVals = (getter: (d: EstadoResultadosData) => number) =>
    Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, data ? getter(data) : 0]))

  const sum  = (v: Record<string, number>) => Object.values(v).filter(x => x != null).reduce((s, x) => s + x, 0)
  const hdr  = (key: string, name: string, color?: string): AnyRow => ({ key, _kind: 'hdr',  _name: name, _color: color, _total: 0, ...empty })
  const acct = (key: string, id: string, code: string, name: string, vals: Record<string, number>): AnyRow => ({ key, _kind: 'acct', _code: code, _name: name, _accountId: id || undefined, _total: sum(vals), ...vals })
  const sub  = (key: string, name: string, vals: Record<string, number>, kind: RowKind = 'sub'): AnyRow => ({ key, _kind: kind, _name: name, _total: sum(vals), ...vals })

  const rows: AnyRow[] = []

  rows.push(hdr('hdr-ing', 'INGRESOS ORDINARIOS', '#0a0a0a'))
  collect(d => d.ingresos.accounts).forEach(a => rows.push(acct(`ai-${a.id}`, a.id, a.code, a.name, aVals(d => d.ingresos.accounts, a.id))))

  if (md.some(m => m.data && m.data.otrosIngresos.accounts.length > 0)) {
    rows.push(hdr('hdr-oing', 'OTROS INGRESOS', '#0a0a0a'))
    collect(d => d.otrosIngresos.accounts).forEach(a => rows.push(acct(`aoi-${a.id}`, a.id, a.code, a.name, aVals(d => d.otrosIngresos.accounts, a.id))))
  }

  const ingTot = Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, (data?.ingresos.total ?? 0) + (data?.otrosIngresos.total ?? 0)]))
  rows.push(sub('sub-ing', 'Total Ingresos', ingTot))

  rows.push(hdr('hdr-cos', 'COSTOS DE VENTA', '#0a0a0a'))
  collect(d => d.costos.accounts).forEach(a => rows.push(acct(`ac-${a.id}`, a.id, a.code, a.name, aVals(d => d.costos.accounts, a.id))))
  rows.push(sub('sub-cos', 'Total Costos', sVals(d => d.costos.total)))

  rows.push(sub('grand-ub', 'UTILIDAD BRUTA', sVals(d => d.utilidadBruta), 'grand'))

  rows.push(hdr('hdr-gas', 'GASTOS DE OPERACIÓN', '#0a0a0a'))
  collect(d => d.gastos.accounts).forEach(a => rows.push(acct(`ag-${a.id}`, a.id, a.code, a.name, aVals(d => d.gastos.accounts, a.id))))

  if (md.some(m => m.data && m.data.otrosGastos.accounts.length > 0)) {
    rows.push(hdr('hdr-ogas', 'OTROS GASTOS', '#0a0a0a'))
    collect(d => d.otrosGastos.accounts).forEach(a => rows.push(acct(`aog-${a.id}`, a.id, a.code, a.name, aVals(d => d.otrosGastos.accounts, a.id))))
  }

  const gasTot = Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, (data?.gastos.total ?? 0) + (data?.otrosGastos.total ?? 0)]))
  rows.push(sub('sub-gas', 'Total Gastos', gasTot))
  rows.push(sub('grand-uo', 'UTILIDAD DE OPERACIÓN', sVals(d => d.utilidadOperativa), 'grand'))
  rows.push(sub('grand-un', 'UTILIDAD NETA DEL PERÍODO', sVals(d => d.utilidadNeta), 'grand2'))

  const nonZeroMonths = (r: AnyRow) => months.some(m => (r[m.yearMonth] ?? 0) !== 0)
  return rows.filter(r => r._kind !== 'acct' || r._total !== 0 || nonZeroMonths(r))
}

function MonthlyERTable({ monthData, loading }: { monthData: Array<{ month: MonthRange; data: EstadoResultadosData | null }>; loading: boolean }) {
  const months = monthData.map(m => m.month)
  const n      = months.length
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

  if (n === 0) return <Spin spinning={loading}><div style={{ height: 120 }} /></Spin>

  const cfg  = getColConfig(n)
  const rows = buildERRows(monthData)

  const cell = (v: number | null, kind: RowKind) => {
    if (v == null || kind === 'hdr') return null
    const bold = kind !== 'acct'
    const c    = bold ? (v < 0 ? '#e5484d' : v > 0 ? '#2ea172' : '#6b7280') : (v < 0 ? '#e5484d' : undefined)
    return <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: cfg.cellFont, fontWeight: bold ? 700 : 400, color: c }}>{fmtCol(v, cfg.useDecimals)}</span>
  }

  const clickable = (content: React.ReactNode, row: AnyRow, fromDate: string, toDate: string) => {
    if (!content || row._kind !== 'acct' || !row._accountId) return content
    return (
      <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
        onClick={() => setDrilldown({ accountId: row._accountId!, accountName: row._name, fromDate, toDate })}>
        {content}
      </span>
    )
  }

  const yearFrom = months[0].from
  const yearTo   = months[months.length - 1].to

  const columns: ColumnsType<AnyRow> = [
    ...(cfg.codeW ? [{
      key: '_code', dataIndex: '_code' as const, width: cfg.codeW,
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: cfg.cellFont - 1, color: '#6b7280' }}>{v ?? ''}</span>,
    }] : []),
    {
      key: '_name', dataIndex: '_name' as const, width: cfg.nameW, ellipsis: true,
      render: (v: string, row) => (
        <span style={{ fontSize: cfg.nameFont, fontWeight: row._kind === 'acct' ? 400 : 600, color: row._color ?? undefined, paddingLeft: row._kind === 'acct' ? 10 : 0 }}>
          {v}
        </span>
      ),
    },
    ...months.map(m => ({
      key: m.yearMonth, dataIndex: m.yearMonth as keyof AnyRow,
      width: cfg.colW, align: 'right' as const,
      title: <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'center' as const, lineHeight: 1.3 }}>{m.label}</div>,
      render: (v: number | null, row: AnyRow) => clickable(cell(v, row._kind), row, m.from, m.to),
    })),
    {
      key: '_total', dataIndex: '_total' as const, width: cfg.colW + 14, align: 'right' as const,
      title: <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textAlign: 'center' as const, lineHeight: 1.3 }}>Año a<br />la fecha</div>,
      render: (v: number, row) => {
        if (row._kind === 'hdr') return null
        const bold = row._kind !== 'acct'
        const c    = bold ? (v < 0 ? '#e5484d' : '#2ea172') : (v < 0 ? '#e5484d' : undefined)
        const content = <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: cfg.cellFont, fontWeight: bold ? 700 : 400, color: c }}>{fmtTotal(v)}</span>
        return clickable(content, row, yearFrom, yearTo)
      },
    },
  ]

  const rowBg: Record<RowKind, string | undefined> = {
    hdr:    '#fafbfc',
    acct:   undefined,
    sub:    undefined,
    grand:  undefined,
    grand2: undefined,
  }

  return (
    <>
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
              background: row._kind === 'grand2' && row._total < 0
                ? '#fdecec'
                : rowBg[row._kind],
              borderTop: (row._kind === 'grand' || row._kind === 'grand2') ? '2px solid rgba(10,10,10,0.08)' : undefined,
            },
          })}
        />
      </Spin>
      <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EstadoResultadosPage() {
  const [from,   setFrom]   = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,     setTo]     = useState(dayjs().format('YYYY-MM-DD'))
  const [preset, setPreset] = useState<string | null>('Este año')
  const [compare, setCompare] = useState(false)

  const [single,  setSingle]  = useState<EstadoResultadosData | null>(null)
  const [sLoading, setSLoading] = useState(false)
  const [sError,   setSError]   = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

  const [monthly,  setMonthly]  = useState<Array<{ month: MonthRange; data: EstadoResultadosData | null }>>([])
  const [mLoading, setMLoading] = useState(false)

  const isMonthly = !!preset

  // Single period
  useEffect(() => {
    if (isMonthly) return
    setSLoading(true); setSError(null)
    const compFrom = compare ? dayjs(from).subtract(1, 'year').format('YYYY-MM-DD') : undefined
    const compTo   = compare ? dayjs(to).subtract(1, 'year').format('YYYY-MM-DD')   : undefined
    getEstadoResultados({ fromDate: from, toDate: to, compFrom, compTo })
      .then(setSingle).catch(e => setSError(e?.response?.data?.message || 'Error cargando Estado de Resultados'))
      .finally(() => setSLoading(false))
  }, [from, to, isMonthly, compare])

  // Monthly parallel
  useEffect(() => {
    if (!isMonthly) return
    const months = getMonthRanges(from, to)
    if (months.length === 0) return
    setMLoading(true)
    Promise.all(months.map(m => getEstadoResultados({ fromDate: m.from, toDate: m.to }).catch(() => null)))
      .then(results => setMonthly(months.map((m, i) => ({ month: m, data: results[i] }))))
      .finally(() => setMLoading(false))
  }, [from, to, isMonthly])

  const kpis = single && [
    { label: 'Ingresos',       value: single.ingresos.total,   color: '#374151' },
    { label: 'Utilidad Bruta', value: single.utilidadBruta,    color: accent(single.utilidadBruta) },
    { label: 'Utilidad Neta',  value: single.utilidadNeta,     color: accent(single.utilidadNeta) },
    { label: 'Margen Neto',    value: single.margenNeto,       color: accent(single.margenNeto), suffix: '%', precision: 1 },
  ]

  const openDrilldown = (id: string, name: string) =>
    setDrilldown({ accountId: id, accountName: name, fromDate: from, toDate: to })

  return (
    <>
    <ReportLayout
      icon={<LineChartOutlined />}
      title="Estado de Resultados"
      subtitle="Estado de Pérdidas y Ganancias · SAT Guatemala"
      tipoExport="estado-resultados"
      loading={isMonthly ? false : sLoading}
      error={isMonthly ? null : sError}
      fromDate={from}
      toDate={to}
      onRangeChange={(f, t) => { setFrom(f); setTo(t) }}
      onPresetChange={setPreset}
      exportParams={{ fromDate: from, toDate: to }}
      extra={
        !isMonthly ? (
          <Space size={4}>
            <Switch size="small" checked={compare} onChange={setCompare} />
            <Text style={{ fontSize: 12 }}>vs. año anterior</Text>
          </Space>
        ) : undefined
      }
    >
      {isMonthly ? (
        <MonthlyERTable monthData={monthly} loading={mLoading} />
      ) : (
        single && (
          <>
            {/* KPI strip */}
            <Row gutter={12} style={{ marginBottom: 16 }}>
              {kpis!.map(k => (
                <Col xs={12} sm={6} key={k.label}>
                  <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                      value={k.value} precision={k.precision ?? 2}
                      prefix={k.suffix ? undefined : 'Q'} suffix={k.suffix}
                      // eslint-disable-next-line @typescript-eslint/no-deprecated
                      valueStyle={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: k.color, fontWeight: 600 }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: k.precision ?? 2 })}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Margin bars */}
            <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
              <Row gutter={24}>
                {[
                  { label: 'Margen Bruto',     value: single.margenBruto },
                  { label: 'Margen Operativo', value: single.margenOperativo },
                  { label: 'Margen Neto',      value: single.margenNeto },
                ].map(m => (
                  <Col xs={24} sm={8} key={m.label}>
                    <div style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>{m.label}</Text>
                      <Text strong style={{ float: 'right', fontSize: 12 }}>{m.value.toFixed(1)}%</Text>
                    </div>
                    <Progress percent={Math.min(Math.abs(m.value), 100)} showInfo={false}
                      strokeColor={m.value >= 0 ? '#2ea172' : '#e5484d'} size="small" />
                  </Col>
                ))}
              </Row>
            </Card>

            {/* Detail */}
            <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}
              title={<Text strong style={{ fontSize: 13 }}>Estado de Resultados Detallado</Text>}>
              <div style={{ padding: '10px 16px 4px', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                <Text strong style={{ color: '#0a0a0a', fontSize: 12 }}>INGRESOS ORDINARIOS</Text>
              </div>
              <AccountTable accounts={single.ingresos.accounts} total={single.ingresos.total} label="Ingresos" onDrilldown={openDrilldown} />
              {single.otrosIngresos.accounts.length > 0 && <>
                <div style={{ padding: '10px 16px 4px', borderTop: '1px solid rgba(10,10,10,0.08)', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                  <Text strong style={{ color: '#0a0a0a', fontSize: 12 }}>OTROS INGRESOS</Text>
                </div>
                <AccountTable accounts={single.otrosIngresos.accounts} total={single.otrosIngresos.total} label="Otros Ingresos" onDrilldown={openDrilldown} />
              </>}
              <SubtotalRow label="Total Ingresos" value={single.ingresos.total + single.otrosIngresos.total} />
              <Divider style={{ margin: 0 }} />
              <div style={{ padding: '10px 16px 4px', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                <Text strong style={{ color: '#0a0a0a', fontSize: 12 }}>COSTOS DE VENTA</Text>
              </div>
              <AccountTable accounts={single.costos.accounts} total={single.costos.total} label="Costos" negate onDrilldown={openDrilldown} />
              <SubtotalRow label="Total Costos" value={-single.costos.total} />
              <SubtotalRow label="UTILIDAD BRUTA" value={single.utilidadBruta} highlight border />
              <Divider style={{ margin: 0 }} />
              <div style={{ padding: '10px 16px 4px', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                <Text strong style={{ color: '#0a0a0a', fontSize: 12 }}>GASTOS DE OPERACIÓN</Text>
              </div>
              <AccountTable accounts={single.gastos.accounts} total={single.gastos.total} label="Gastos" negate onDrilldown={openDrilldown} />
              {single.otrosGastos.accounts.length > 0 && <>
                <div style={{ padding: '6px 16px 4px', borderTop: '1px solid rgba(10,10,10,0.08)', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                  <Text strong style={{ color: '#0a0a0a', fontSize: 12 }}>OTROS GASTOS</Text>
                </div>
                <AccountTable accounts={single.otrosGastos.accounts} total={single.otrosGastos.total} label="Otros Gastos" negate onDrilldown={openDrilldown} />
              </>}
              <SubtotalRow label="Total Gastos" value={-(single.gastos.total + single.otrosGastos.total)} />
              <SubtotalRow label="UTILIDAD DE OPERACIÓN" value={single.utilidadOperativa} highlight border />
              <Divider style={{ margin: 0 }} />
              <SubtotalRow label="UTILIDAD NETA DEL PERÍODO" value={single.utilidadNeta} highlight border />
            </Card>
          </>
        )
      )}
    </ReportLayout>
    <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
    </>
  )
}
