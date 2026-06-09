import { useEffect, useState } from 'react'
import { Card, Col, Row, Space, Table, Tag, Typography, Divider, Statistic, Switch, Spin } from 'antd'
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import ReportLayout from '../../components/ReportLayout'
import { getBalanceGeneral, type BalanceGeneralData, type AccountRow } from '../../api/reportes'
import { getMonthRanges, getColConfig, fmtCol, fmtTotal, type MonthRange } from '../../utils/reportMonthly'

const { Text, Title } = Typography

const fmtQ      = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const accColor  = (n: number) => (n >= 0 ? '#1B3A6B' : '#cf1322')

// ─── Single-period components ─────────────────────────────────────────────────

function AccountTable({ accounts, total, label }: { accounts: AccountRow[]; total: number; label: string }) {
  if (accounts.length === 0)
    return <div style={{ padding: '8px 16px', color: '#8c8c8c', fontSize: 12 }}>Sin cuentas para {label}</div>
  return (
    <Table size="small" dataSource={accounts} rowKey="id" pagination={false} showHeader={false} style={{ marginBottom: 0 }}
      summary={() => (
        <Table.Summary.Row style={{ background: '#fafafa' }}>
          <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 12 }}>Total {label}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <Text strong style={{ fontFamily: 'monospace', color: accColor(total) }}>{fmtQ(total)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        { dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{v}</Text> },
        { dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
        { dataIndex: 'balance', width: 140, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: accColor(v) }}>{fmtQ(v)}</Text> },
      ]}
    />
  )
}

function SectionCard({ title, color, children, total }: { title: string; color: string; children: React.ReactNode; total: number }) {
  return (
    <Card size="small" title={<Text strong style={{ color, fontSize: 13 }}>{title}</Text>}
      style={{ marginBottom: 12, borderRadius: 8 }} styles={{ body: { padding: 0 } }}
      extra={<Text strong style={{ fontFamily: 'monospace', color: accColor(total) }}>{fmtQ(total)}</Text>}>
      {children}
    </Card>
  )
}

// ─── Monthly table ─────────────────────────────────────────────────────────────

type BGKind = 'hdr' | 'subhdr' | 'acct' | 'sub' | 'grand' | 'grand2'
type BGRow  = { key: string; _kind: BGKind; _name: string; _code?: string; _color?: string; _total: number; [ym: string]: any }

function buildBGRows(md: Array<{ month: MonthRange; data: BalanceGeneralData | null }>): BGRow[] {
  const months   = md.map(m => m.month)
  const empty    = Object.fromEntries(months.map(m => [m.yearMonth, null]))
  const lastData = md[md.length - 1]?.data

  const collect = (getter: (d: BalanceGeneralData) => AccountRow[]) => {
    const map = new Map<string, { code: string; name: string }>()
    md.forEach(({ data }) => data && getter(data).forEach(a => map.set(a.id, { code: a.code, name: a.name })))
    return [...map.entries()].map(([id, info]) => ({ id, ...info }))
  }

  const aVals = (getter: (d: BalanceGeneralData) => AccountRow[], id: string) =>
    Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, data ? (getter(data).find(a => a.id === id)?.balance ?? 0) : 0]))

  const sVals = (getter: (d: BalanceGeneralData) => number) =>
    Object.fromEntries(md.map(({ month: m, data }) => [m.yearMonth, data ? getter(data) : 0]))

  // For balance sheet (stock): _total = last month value, not sum
  const last  = (getter: (d: BalanceGeneralData) => number) => lastData ? getter(lastData) : 0
  const lastA = (getter: (d: BalanceGeneralData) => AccountRow[], id: string) => lastData ? (getter(lastData).find(a => a.id === id)?.balance ?? 0) : 0

  const hdr    = (key: string, name: string, color?: string): BGRow => ({ key, _kind: 'hdr',    _name: name, _color: color, _total: 0,         ...empty })
  const subhdr = (key: string, name: string, color?: string): BGRow => ({ key, _kind: 'subhdr', _name: name, _color: color, _total: 0,         ...empty })
  const acct   = (key: string, code: string, name: string, vals: Record<string, number>, tot: number): BGRow =>
    ({ key, _kind: 'acct', _code: code, _name: name, _total: tot, ...vals })
  const sub    = (key: string, name: string, tot: number, vals: Record<string, number>, kind: BGKind = 'sub'): BGRow =>
    ({ key, _kind: kind, _name: name, _total: tot, ...vals })

  const rows: BGRow[] = []

  rows.push(hdr('hdr-activos', 'ACTIVOS', '#1B3A6B'))
  rows.push(subhdr('sh-ac', 'Activo Circulante'))
  collect(d => d.activo.accounts).forEach(a => rows.push(acct(`aac-${a.id}`, a.code, a.name, aVals(d => d.activo.accounts, a.id), lastA(d => d.activo.accounts, a.id))))
  rows.push(sub('sub-ac', 'Total Activo Circulante', last(d => d.activo.total), sVals(d => d.activo.total)))

  rows.push(subhdr('sh-af', 'Activo Fijo'))
  collect(d => d.activoFijo.accounts).forEach(a => rows.push(acct(`aaf-${a.id}`, a.code, a.name, aVals(d => d.activoFijo.accounts, a.id), lastA(d => d.activoFijo.accounts, a.id))))
  rows.push(sub('sub-af', 'Total Activo Fijo', last(d => d.activoFijo.total), sVals(d => d.activoFijo.total)))

  rows.push(sub('grand-ta', 'TOTAL ACTIVOS', last(d => d.totalActivo), sVals(d => d.totalActivo), 'grand'))

  rows.push(hdr('hdr-pc', 'PASIVO Y CAPITAL', '#595959'))
  rows.push(subhdr('sh-pas', 'Pasivo', '#cf1322'))
  collect(d => d.pasivo.accounts).forEach(a => rows.push(acct(`aps-${a.id}`, a.code, a.name, aVals(d => d.pasivo.accounts, a.id), lastA(d => d.pasivo.accounts, a.id))))
  rows.push(sub('sub-pas', 'Total Pasivo', last(d => d.pasivo.total), sVals(d => d.pasivo.total)))

  rows.push(subhdr('sh-cap', 'Capital Contable', '#389e0d'))
  collect(d => d.capital.accounts).forEach(a => rows.push(acct(`acap-${a.id}`, a.code, a.name, aVals(d => d.capital.accounts, a.id), lastA(d => d.capital.accounts, a.id))))
  rows.push(acct('acap-ni', '', 'Utilidad del Período', sVals(d => d.netIncome), last(d => d.netIncome)))
  rows.push(sub('sub-cap', 'Total Capital', last(d => d.totalCapital), sVals(d => d.totalCapital)))

  rows.push(sub('grand2-tpc', 'TOTAL PASIVO + CAPITAL', last(d => d.totalPasivoCapital), sVals(d => d.totalPasivoCapital), 'grand2'))

  const nonZeroMonths = (r: BGRow) => months.some(m => (r[m.yearMonth] ?? 0) !== 0)
  return rows.filter(r => r._kind !== 'acct' || r._total !== 0 || nonZeroMonths(r))
}

function MonthlyBGTable({ monthData, loading }: { monthData: Array<{ month: MonthRange; data: BalanceGeneralData | null }>; loading: boolean }) {
  const months = monthData.map(m => m.month)
  const n      = months.length
  if (n === 0) return <Spin spinning={loading}><div style={{ height: 120 }} /></Spin>

  const cfg  = getColConfig(n)
  const rows = buildBGRows(monthData)

  const rowBg: Record<BGKind, string | undefined> = {
    hdr:    '#f0f5ff',
    subhdr: '#f9f9f9',
    acct:   undefined,
    sub:    '#fafafa',
    grand:  '#e6f4ff',
    grand2: '#f6ffed',
  }

  const cell = (v: number | null, kind: BGKind) => {
    if (v == null || kind === 'hdr' || kind === 'subhdr') return null
    const bold = kind !== 'acct'
    const c    = bold ? (v < 0 ? '#cf1322' : '#1B3A6B') : (v < 0 ? '#cf1322' : undefined)
    return <span style={{ fontFamily: 'monospace', fontSize: cfg.cellFont, fontWeight: bold ? 700 : 400, color: c }}>{fmtCol(v, cfg.useDecimals)}</span>
  }

  const columns: ColumnsType<BGRow> = [
    ...(cfg.codeW ? [{
      key: '_code', dataIndex: '_code' as const, width: cfg.codeW,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: cfg.cellFont - 1, color: '#8c8c8c' }}>{v ?? ''}</span>,
    }] : []),
    {
      key: '_name', dataIndex: '_name' as const, width: cfg.nameW, ellipsis: true,
      render: (v: string, row) => (
        <span style={{
          fontSize: cfg.nameFont,
          fontWeight: (row._kind === 'acct') ? 400 : 600,
          color: row._color,
          paddingLeft: row._kind === 'acct' ? 18 : row._kind === 'subhdr' ? 8 : 0,
        }}>{v}</span>
      ),
    },
    ...months.map(m => ({
      key: m.yearMonth, dataIndex: m.yearMonth as keyof BGRow,
      width: cfg.colW, align: 'right' as const,
      title: <div style={{ fontSize: 11, textAlign: 'center' as const, lineHeight: 1.3 }}>{m.label}</div>,
      render: (v: number | null, row: BGRow) => cell(v, row._kind),
    })),
    {
      key: '_total', dataIndex: '_total' as const, width: cfg.colW + 14, align: 'right' as const,
      title: <div style={{ fontSize: 11, textAlign: 'center' as const, lineHeight: 1.3, fontWeight: 700 }}>ACTUAL</div>,
      render: (v: number, row) => {
        if (row._kind === 'hdr' || row._kind === 'subhdr') return null
        const bold = row._kind !== 'acct'
        const c    = bold ? (v < 0 ? '#cf1322' : '#1B3A6B') : (v < 0 ? '#cf1322' : undefined)
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
            background: rowBg[row._kind],
            borderTop: (row._kind === 'grand' || row._kind === 'grand2') ? '2px solid #d9d9d9' : undefined,
          },
        })}
      />
    </Spin>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function BalanceGeneralPage() {
  const [from,    setFrom]    = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,      setTo]      = useState(dayjs().format('YYYY-MM-DD'))
  const [preset,  setPreset]  = useState<string | null>('Este año')
  const [compare, setCompare] = useState(false)

  const [single,   setSingle]   = useState<BalanceGeneralData | null>(null)
  const [sLoading, setSLoading] = useState(false)
  const [sError,   setSError]   = useState<string | null>(null)

  const [monthly,  setMonthly]  = useState<Array<{ month: MonthRange; data: BalanceGeneralData | null }>>([])
  const [mLoading, setMLoading] = useState(false)

  const isMonthly = !!preset

  // Single mode — use `to` as cut-off date
  useEffect(() => {
    if (isMonthly) return
    setSLoading(true); setSError(null)
    getBalanceGeneral({ date: to, compPeriod: compare ? dayjs(to).subtract(1, 'year').format('YYYY-MM-DD') : undefined })
      .then(setSingle).catch(e => setSError(e?.response?.data?.message || 'Error cargando Balance General'))
      .finally(() => setSLoading(false))
  }, [to, isMonthly, compare])

  // Monthly parallel — each month's balance AT END of that month
  useEffect(() => {
    if (!isMonthly) return
    const months = getMonthRanges(from, to)
    if (months.length === 0) return
    setMLoading(true)
    Promise.all(months.map(m => getBalanceGeneral({ date: m.to }).catch(() => null)))
      .then(results => setMonthly(months.map((m, i) => ({ month: m, data: results[i] }))))
      .finally(() => setMLoading(false))
  }, [from, to, isMonthly])

  return (
    <ReportLayout
      title="Balance General"
      subtitle="Estado de Situación Financiera · NIC 1 · SAT Guatemala"
      tipoExport="balance-general"
      loading={isMonthly ? false : sLoading}
      error={isMonthly ? null : sError}
      fromDate={from}
      toDate={to}
      onRangeChange={(f, t) => { setFrom(f); setTo(t) }}
      onPresetChange={setPreset}
      exportParams={{ date: to }}
      extra={
        !isMonthly ? (
          <Space size={4}>
            <Switch size="small" checked={compare} onChange={setCompare} />
            <Text style={{ fontSize: 12 }}>Comparar año anterior</Text>
          </Space>
        ) : undefined
      }
    >
      {isMonthly ? (
        <MonthlyBGTable monthData={monthly} loading={mLoading} />
      ) : (
        single && (
          <>
            <div style={{ marginBottom: 16 }}>
              {single.balanced ? (
                <Tag icon={<CheckCircleOutlined />} color="success">Balance cuadrado · Activos = Pasivo + Capital</Tag>
              ) : (
                <Tag icon={<WarningOutlined />} color="error">
                  Desequilibrio: diferencia Q {fmtQ(Math.abs(single.totalActivo - single.totalPasivoCapital))}
                </Tag>
              )}
              <Tag style={{ marginLeft: 8 }}>Al {single.asOf}</Tag>
            </div>

            <Row gutter={12} style={{ marginBottom: 16 }}>
              {[
                { label: 'Total Activos',        value: single.totalActivo,          color: '#1B3A6B' },
                { label: 'Total Pasivos',         value: single.pasivo.total,         color: '#cf1322' },
                { label: 'Capital Contable',      value: single.totalCapital,         color: '#389e0d' },
                { label: 'Utilidad del Período', value: single.netIncome,            color: single.netIncome >= 0 ? '#389e0d' : '#cf1322' },
              ].map(k => (
                <Col xs={12} sm={6} key={k.label}>
                  <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                      value={k.value} precision={2} prefix="Q"
                      valueStyle={{ fontSize: 14, fontFamily: 'monospace', color: k.color }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Title level={5} style={{ color: '#1B3A6B', marginBottom: 8 }}>ACTIVOS</Title>
                <SectionCard title="Activo Circulante" color="#1677ff" total={single.activo.total}>
                  <AccountTable accounts={single.activo.accounts} total={single.activo.total} label="Activo Circulante" />
                </SectionCard>
                <SectionCard title="Activo Fijo" color="#1677ff" total={single.activoFijo.total}>
                  <AccountTable accounts={single.activoFijo.accounts} total={single.activoFijo.total} label="Activo Fijo" />
                </SectionCard>
                <Divider dashed style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#e6f4ff', borderRadius: 6 }}>
                  <Text strong style={{ color: '#1B3A6B' }}>TOTAL ACTIVOS</Text>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#1B3A6B' }}>{fmtQ(single.totalActivo)}</Text>
                </div>
              </Col>

              <Col xs={24} lg={12}>
                <Title level={5} style={{ color: '#1B3A6B', marginBottom: 8 }}>PASIVO Y CAPITAL</Title>
                <SectionCard title="Pasivo" color="#cf1322" total={single.pasivo.total}>
                  <AccountTable accounts={single.pasivo.accounts} total={single.pasivo.total} label="Pasivo" />
                </SectionCard>
                <SectionCard title="Capital Contable" color="#389e0d" total={single.totalCapital}>
                  <AccountTable accounts={single.capital.accounts} total={single.capital.total} label="Capital" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', borderTop: '1px solid #f0f0f0' }}>
                    <Text style={{ fontSize: 12 }}>Utilidad del Período</Text>
                    <Text style={{ fontFamily: 'monospace', fontSize: 12, color: accColor(single.netIncome) }}>{fmtQ(single.netIncome)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', background: '#fafafa' }}>
                    <Text strong style={{ fontSize: 12 }}>Total Capital</Text>
                    <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(single.totalCapital)}</Text>
                  </div>
                </SectionCard>
                <Divider dashed style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#f6ffed', borderRadius: 6 }}>
                  <Text strong style={{ color: '#389e0d' }}>TOTAL PASIVO + CAPITAL</Text>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#389e0d' }}>{fmtQ(single.totalPasivoCapital)}</Text>
                </div>
              </Col>
            </Row>
          </>
        )
      )}
    </ReportLayout>
  )
}
