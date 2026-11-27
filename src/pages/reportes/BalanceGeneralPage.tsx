import { useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Space, Table, Tag, Typography, Divider, Statistic, Switch, Spin } from 'antd'
import { CheckCircleOutlined, WarningOutlined, AuditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import ReportLayout from '../../components/ReportLayout'
import AccountDrilldownDrawer, { type DrilldownTarget } from '../../components/AccountDrilldownDrawer'
import { getBalanceGeneral, type BalanceGeneralData, type AccountRow } from '../../api/reportes'
import { getMonthRanges, getColConfig, fmtCol, fmtTotal, type MonthRange } from '../../utils/reportMonthly'
import { useMonedaDelReporte, SwitchDeMoneda } from './useMonedaDelReporte'
import type { MonedaDelReporte } from './monedaDelReporte'
import ResponsiveTable from '../../components/responsive/ResponsiveTable'
import { PRESENTACION, ANCHOS, estiloEncabezado } from './presentacionDelReporte'

const { Text, Title } = Typography

const fmtQ      = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const accColor  = (n: number) => (n >= 0 ? '#374151' : '#e5484d')

// ─── Single-period components ─────────────────────────────────────────────────

function AccountTable({ accounts, total, label, onDrilldown }: { accounts: AccountRow[]; total: number; label: string; onDrilldown?: (id: string, name: string) => void }) {
  if (accounts.length === 0)
    return <div style={{ padding: '8px 16px', color: '#6b7280', fontSize: 12 }}>Sin cuentas para {label}</div>
  return (
    <Table size="small" dataSource={accounts} rowKey="id" pagination={false} showHeader={false} style={{ marginBottom: 0 }}
      summary={() => (
        <Table.Summary.Row style={{ background: '#fafbfc' }}>
          <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 12 }}>Total {label}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: accColor(total) }}>{fmtQ(total)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        { dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280' }}>{v}</Text> },
        { dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
        { dataIndex: 'balance', width: 140, align: 'right' as const, render: (v: number, row: AccountRow) => {
          const txt = <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: accColor(v) }}>{fmtQ(v)}</Text>
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

function SectionCard({ title, color, children, total }: { title: string; color: string; children: React.ReactNode; total: number }) {
  return (
    <Card size="small" title={<Text strong style={{ color, fontSize: 13 }}>{title}</Text>}
      style={{ marginBottom: 12, borderRadius: 8 }} styles={{ body: { padding: 0 } }}
      extra={<Text strong style={{ fontVariantNumeric: 'tabular-nums', color: accColor(total) }}>{fmtQ(total)}</Text>}>
      {children}
    </Card>
  )
}

// ─── Monthly table ─────────────────────────────────────────────────────────────

type BGKind = 'hdr' | 'subhdr' | 'acct' | 'sub' | 'grand' | 'grand2'
type BGRow  = { key: string; _kind: BGKind; _name: string; _code?: string; _color?: string; _accountId?: string; _total: number; [ym: string]: any }

export function buildBGRows(md: Array<{ month: MonthRange; data: BalanceGeneralData | null }>): BGRow[] {
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
  const acct   = (key: string, id: string, code: string, name: string, vals: Record<string, number>, tot: number): BGRow =>
    ({ key, _kind: 'acct', _code: code, _name: name, _accountId: id || undefined, _total: tot, ...vals })
  const sub    = (key: string, name: string, tot: number, vals: Record<string, number>, kind: BGKind = 'sub'): BGRow =>
    ({ key, _kind: kind, _name: name, _total: tot, ...vals })

  const rows: BGRow[] = []

  rows.push(hdr('hdr-activos', 'ACTIVOS', '#0a0a0a'))
  rows.push(subhdr('sh-ac', 'Activo Circulante'))
  collect(d => d.activo.accounts).forEach(a => rows.push(acct(`aac-${a.id}`, a.id, a.code, a.name, aVals(d => d.activo.accounts, a.id), lastA(d => d.activo.accounts, a.id))))
  rows.push(sub('sub-ac', 'Total Activo Circulante', last(d => d.activo.total), sVals(d => d.activo.total)))

  rows.push(subhdr('sh-af', 'Activo Fijo'))
  collect(d => d.activoFijo.accounts).forEach(a => rows.push(acct(`aaf-${a.id}`, a.id, a.code, a.name, aVals(d => d.activoFijo.accounts, a.id), lastA(d => d.activoFijo.accounts, a.id))))
  rows.push(sub('sub-af', 'Total Activo Fijo', last(d => d.activoFijo.total), sVals(d => d.activoFijo.total)))

  rows.push(sub('grand-ta', 'TOTAL ACTIVOS', last(d => d.totalActivo), sVals(d => d.totalActivo), 'grand'))

  rows.push(hdr('hdr-pc', 'PASIVO Y CAPITAL', '#0a0a0a'))
  rows.push(subhdr('sh-pas', 'Pasivo', '#0a0a0a'))
  collect(d => d.pasivo.accounts).forEach(a => rows.push(acct(`aps-${a.id}`, a.id, a.code, a.name, aVals(d => d.pasivo.accounts, a.id), lastA(d => d.pasivo.accounts, a.id))))
  rows.push(sub('sub-pas', 'Total Pasivo', last(d => d.pasivo.total), sVals(d => d.pasivo.total)))

  rows.push(subhdr('sh-cap', 'Capital Contable', '#0a0a0a'))
  collect(d => d.capital.accounts).forEach(a => rows.push(acct(`acap-${a.id}`, a.id, a.code, a.name, aVals(d => d.capital.accounts, a.id), lastA(d => d.capital.accounts, a.id))))
  /**
   * Los dos resultados. El de ejercicios anteriores viene de las cuentas de
   * ingresos y gastos de los años que no se cerraron: sin esa línea el
   * capital no suma su total y el balance parecía descuadrado.
   */
  rows.push(acct('acap-ant', '', '', 'Resultado de Ejercicios Anteriores',
    sVals(d => d.resultadoEjerciciosAnteriores ?? 0), last(d => d.resultadoEjerciciosAnteriores ?? 0)))
  rows.push(acct('acap-ni', '', '', 'Utilidad del Período', sVals(d => d.netIncome), last(d => d.netIncome)))
  rows.push(sub('sub-cap', 'Total Capital', last(d => d.totalCapital), sVals(d => d.totalCapital)))

  rows.push(sub('grand2-tpc', 'TOTAL PASIVO + CAPITAL', last(d => d.totalPasivoCapital), sVals(d => d.totalPasivoCapital), 'grand2'))

  /**
   * La diferencia, mes a mes, cuando la hay.
   *
   * Esta tabla mostraba los dos totales y dejaba la resta al ojo del lector:
   * «Total activos 802,252.12» y «Total pasivo + capital 778,817.80» sin una
   * sola línea que dijera que faltan 23,434.32.
   *
   * Casi siempre es una cuenta que no entra en ningún reporte —la de orden de
   * los saldos iniciales, mientras la apertura esté incompleta—. Debajo, la
   * fila la nombra.
   */
  const difVals    = sVals(d => Number(d.diferencia ?? (d.totalActivo - d.totalPasivoCapital)))
  const difUltimo  = last(d => Number(d.diferencia ?? (d.totalActivo - d.totalPasivoCapital)))
  const hayDif     = Math.abs(difUltimo) > 0.005 || months.some(m => Math.abs(difVals[m.yearMonth] ?? 0) > 0.005)

  if (hayDif) {
    rows.push(sub('grand3-dif', 'DIFERENCIA (no cuadra)', difUltimo, difVals, 'grand2'))

    // Las cuentas que quedaron fuera de los dos reportes, con su nombre.
    const fuera = collect(d => d.sinClasificar?.accounts ?? [])
    fuera.forEach(a => rows.push(acct(
      `adif-${a.id}`, a.id, a.code, `${a.name} — fuera del balance`,
      aVals(d => d.sinClasificar?.accounts ?? [], a.id),
      lastA(d => d.sinClasificar?.accounts ?? [], a.id))))
  }

  const nonZeroMonths = (r: BGRow) => months.some(m => (r[m.yearMonth] ?? 0) !== 0)
  return rows.filter(r => r._kind !== 'acct' || r._total !== 0 || nonZeroMonths(r))
}

function MonthlyBGTable({ monthData, loading, enMoneda, moneda }: {
  monthData: Array<{ month: MonthRange; data: BalanceGeneralData | null }>
  loading:   boolean
  /** Las filas en la moneda que se esté viendo. */
  enMoneda:  <T extends Record<string, any>>(filas: T[]) => T[]
  moneda:    MonedaDelReporte
}) {
  const months = monthData.map(m => m.month)
  const n      = months.length
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

  if (n === 0) return <Spin spinning={loading}><div style={{ height: 120 }} /></Spin>

  const cfg  = getColConfig(n)
  const rows = enMoneda(buildBGRows(monthData))

  const rowBg: Record<BGKind, string | undefined> = {
    hdr:    '#fafbfc',
    subhdr: undefined,
    acct:   undefined,
    sub:    undefined,
    grand:  undefined,
    grand2: undefined,
  }

  const cell = (v: number | null, kind: BGKind) => {
    if (v == null || kind === 'hdr' || kind === 'subhdr') return null
    const bold = kind !== 'acct'
    const c    = v < 0 ? PRESENTACION.cifraNegativa : PRESENTACION.cifraNormal
    return <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: PRESENTACION.cifra, fontWeight: bold ? 700 : 400, color: c }}>{fmtCol(v, cfg.useDecimals)}</span>
  }

  /**
   * Cada cifra de una cuenta abre su detalle.
   *
   * El subrayado punteado se quita: eran ciento y pico de líneas de puntos a
   * la vez y el reporte se leía sucio. La cifra sigue siendo pulsable —el
   * cursor lo dice al pasar por encima, y el título explica qué hace—, así
   * que el detalle no se toca: solo deja de anunciarse en todas las celdas a
   * la vez.
   */
  const clickable = (content: React.ReactNode, row: BGRow, fromDate: string, toDate: string) => {
    if (!content || row._kind !== 'acct' || !row._accountId) return content
    return (
      <span style={{ cursor: 'pointer' }}
        title={`Ver el movimiento de ${row._name}`}
        onClick={() => setDrilldown({ accountId: row._accountId!, accountName: row._name, fromDate, toDate })}>
        {content}
      </span>
    )
  }

  const yearFrom = months[0].from
  const yearTo   = months[months.length - 1].to

  const columns: ColumnsType<BGRow> = [
    {
      key: '_code', dataIndex: '_code' as const, width: ANCHOS.codigo,
      title: <div style={estiloEncabezado('left')}>Código</div>,
      render: (v: string) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: PRESENTACION.codigo, color: PRESENTACION.grisEtiqueta }}>
          {v ?? ''}
        </span>
      ),
    },
    {
      key: '_name', dataIndex: '_name' as const, width: ANCHOS.nombre,
      title: <div style={estiloEncabezado('left')}>Cuenta</div>,
      /**
       * El nombre ya no se corta con puntos suspensivos: «Total para Efectivo
       * y equivalente de efectivo» se lee entero, en dos líneas si hace falta.
       */
      render: (v: string, row) => (
        <span style={{
          fontSize: PRESENTACION.nombre,
          fontWeight: (row._kind === 'acct') ? 400 : 700,
          color: row._color ?? PRESENTACION.cifraNormal,
          paddingLeft: row._kind === 'acct' ? 18 : row._kind === 'subhdr' ? 8 : 0,
          display: 'inline-block',
        }}>{v}</span>
      ),
    },
    ...months.map(m => ({
      key: m.yearMonth, dataIndex: m.yearMonth as keyof BGRow,
      width: ANCHOS.mes, align: 'right' as const,
      title: <div style={estiloEncabezado()}>{m.label}</div>,
      render: (v: number | null, row: BGRow) => clickable(cell(v, row._kind), row, m.from, m.to),
    })),
    {
      key: '_total', dataIndex: '_total' as const, width: ANCHOS.acumulado, align: 'right' as const,
      title: <div style={estiloEncabezado()}>Acumulado</div>,
      render: (v: number | null, row) => {
        if (row._kind === 'hdr' || row._kind === 'subhdr') return null
        if (v == null) return <span style={{ color: '#9aa1ab' }}>—</span>
        const bold = row._kind !== 'acct'
        const c    = v < 0 ? PRESENTACION.cifraNegativa : PRESENTACION.cifraNormal
        const content = <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: PRESENTACION.cifra, fontWeight: bold ? 700 : 400, color: c }}>{fmtTotal(v)}</span>
        return clickable(content, row, yearFrom, yearTo)
      },
    },
  ]

  return (
    <>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
        {moneda === 'USD'
          ? 'Cifras en dólares — cada mes convertido al tipo de cambio de su fin de mes'
          : 'Cifras en quetzales'}
      </Text>
      <Spin spinning={loading}>
        <ResponsiveTable
          size="small"
          dataSource={rows}
          columns={columns}
          rowKey="key"
          pagination={false}
          showHeader
          scroll={{ x: 'max-content', y: 'calc(100vh - 330px)' }}
          onRow={row => ({
            style: {
              background: rowBg[row._kind],
              borderTop: (row._kind === 'grand' || row._kind === 'grand2') ? '2px solid rgba(10,10,10,0.08)' : undefined,
            },
          })}
        />
      </Spin>
      <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
    </>
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
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

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

  /** El balance es una foto: su total se convierte con la tasa del corte. */
  const { moneda, setMoneda, enMoneda, cargando, sinTasa } =
    useMonedaDelReporte(monthly.map(m => m.month), 'saldoFinal')

  const openDrilldown = (id: string, name: string) =>
    setDrilldown({ accountId: id, accountName: name, fromDate: from, toDate: to })

  return (
    <>
    <ReportLayout
      icon={<AuditOutlined />}
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
        isMonthly ? (
          <SwitchDeMoneda moneda={moneda} onChange={setMoneda} cargando={cargando} sinTasa={sinTasa} />
        ) : (
          <Space size={4}>
            <Switch size="small" checked={compare} onChange={setCompare} />
            <Text style={{ fontSize: 12 }}>Comparar año anterior</Text>
          </Space>
        )
      }
    >
      {isMonthly ? (
        <MonthlyBGTable monthData={monthly} loading={mLoading} enMoneda={enMoneda} moneda={moneda} />
      ) : (
        single && (
          <>
            <div style={{ marginBottom: 16 }}>
              {single.balanced ? (
                <Tag icon={<CheckCircleOutlined />} color="success">Balance cuadrado · Activos = Pasivo + Capital</Tag>
              ) : (
                <Tag icon={<WarningOutlined />} color="error">
                  Desequilibrio: diferencia Q {fmtQ(Math.abs(single.diferencia ?? (single.totalActivo - single.totalPasivoCapital)))}
                </Tag>
              )}
              <Tag style={{ marginLeft: 8 }}>Al {single.asOf}</Tag>

              {/*
                * La diferencia, con nombre y apellido.
                *
                * Decir «desequilibrio Q X» y nada más obliga a buscar a ciegas
                * en todo el catálogo. El balance lee Activo, Activo Fijo,
                * Pasivo y Capital; el estado de resultados, ingresos y gastos.
                * Una cuenta con cualquier otro tipo —las de orden, o una mal
                * clasificada— no sale en ninguno de los dos, y su saldo ES la
                * diferencia. Aquí se nombran esas cuentas.
                */}
              {!single.balanced && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginTop: 10 }}
                  message={`Faltan Q ${fmtQ(Math.abs(single.diferencia ?? 0))} para cuadrar`}
                  description={
                    single.sinClasificar?.accounts?.length ? (
                      <>
                        <div style={{ marginBottom: 6 }}>
                          Estas cuentas tienen saldo y no entran ni en el Balance ni en el
                          Estado de Resultados, porque su tipo no es de balance ni de resultados:
                        </div>
                        <ul style={{ paddingLeft: 18, margin: 0 }}>
                          {single.sinClasificar.accounts.slice(0, 10).map((c: any) => (
                            <li key={c.id ?? c.code}>
                              <strong>{c.code} {c.name}</strong> — Q {fmtQ(Math.abs(Number(c.balance ?? 0)))}
                              {c.balance_type ? ` · tipo «${c.balance_type}»` : ' · sin tipo'}
                            </li>
                          ))}
                          {single.sinClasificar.accounts.length > 10 && (
                            <li>y {single.sinClasificar.accounts.length - 10} más…</li>
                          )}
                        </ul>
                        {Math.abs(Math.abs(single.sinClasificar.total) - Math.abs(single.diferencia ?? 0)) > 0.01 && (
                          <div style={{ marginTop: 6 }}>
                            Ojo: estas cuentas suman Q {fmtQ(Math.abs(single.sinClasificar.total))}, que no es toda la
                            diferencia. El resto viene de otro lado — una póliza publicada sin cuadrar.
                          </div>
                        )}
                      </>
                    ) : (
                      'Ninguna cuenta quedó fuera de los reportes, así que la diferencia viene de una '
                      + 'póliza publicada sin cuadrar. Revisá el Libro Diario del período.'
                    )
                  }
                />
              )}
            </div>

            <Row gutter={12} style={{ marginBottom: 16 }}>
              {[
                { label: 'Total Activos',        value: single.totalActivo,          color: '#374151' },
                { label: 'Total Pasivos',         value: single.pasivo.total,         color: '#e5484d' },
                { label: 'Capital Contable',      value: single.totalCapital,         color: '#2ea172' },
                { label: 'Utilidad del Período', value: single.netIncome,            color: single.netIncome >= 0 ? '#2ea172' : '#e5484d' },
              ].map(k => (
                <Col xs={12} sm={6} key={k.label}>
                  <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                      value={k.value} precision={2} prefix="Q"
                      valueStyle={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: k.color, fontWeight: 600 }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Title level={5} style={{ color: '#0a0a0a', marginBottom: 8 }}>ACTIVOS</Title>
                <SectionCard title="Activo Circulante" color="#1faec2" total={single.activo.total}>
                  <AccountTable accounts={single.activo.accounts} total={single.activo.total} label="Activo Circulante" onDrilldown={openDrilldown} />
                </SectionCard>
                <SectionCard title="Activo Fijo" color="#1faec2" total={single.activoFijo.total}>
                  <AccountTable accounts={single.activoFijo.accounts} total={single.activoFijo.total} label="Activo Fijo" onDrilldown={openDrilldown} />
                </SectionCard>
                <Divider dashed style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#e6fafd', borderRadius: 6 }}>
                  <Text strong style={{ color: '#0a0a0a' }}>TOTAL ACTIVOS</Text>
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#0a0a0a' }}>{fmtQ(single.totalActivo)}</Text>
                </div>
              </Col>

              <Col xs={24} lg={12}>
                <Title level={5} style={{ color: '#0a0a0a', marginBottom: 8 }}>PASIVO Y CAPITAL</Title>
                <SectionCard title="Pasivo" color="#e5484d" total={single.pasivo.total}>
                  <AccountTable accounts={single.pasivo.accounts} total={single.pasivo.total} label="Pasivo" onDrilldown={openDrilldown} />
                </SectionCard>
                <SectionCard title="Capital Contable" color="#2ea172" total={single.totalCapital}>
                  <AccountTable accounts={single.capital.accounts} total={single.capital.total} label="Capital" onDrilldown={openDrilldown} />
                  {/* El resultado de los años que no se cerraron: sin esta línea el capital no suma su total. */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', borderTop: '1px solid rgba(10,10,10,0.08)' }}>
                    <Text style={{ fontSize: 12 }}>Resultado de Ejercicios Anteriores</Text>
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: accColor(single.resultadoEjerciciosAnteriores ?? 0) }}>
                      {fmtQ(single.resultadoEjerciciosAnteriores ?? 0)}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px' }}>
                    <Text style={{ fontSize: 12 }}>Utilidad del Período</Text>
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: accColor(single.netIncome) }}>{fmtQ(single.netIncome)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', background: '#fafbfc' }}>
                    <Text strong style={{ fontSize: 12 }}>Total Capital</Text>
                    <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(single.totalCapital)}</Text>
                  </div>
                </SectionCard>
                <Divider dashed style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#e8f5ef', borderRadius: 6 }}>
                  <Text strong style={{ color: '#2ea172' }}>TOTAL PASIVO + CAPITAL</Text>
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#2ea172' }}>{fmtQ(single.totalPasivoCapital)}</Text>
                </div>
              </Col>
            </Row>
          </>
        )
      )}
    </ReportLayout>
    <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
    </>
  )
}
