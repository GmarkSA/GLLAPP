import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Button, Card, Col, DatePicker, Empty, Row, Space, Spin, Statistic,
  Switch, Table, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, PrinterOutlined, BulbOutlined, PieChartOutlined,
  WarningOutlined, CloseCircleOutlined, InfoCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import AccountDrilldownDrawer, { type DrilldownTarget } from '../../components/AccountDrilldownDrawer'
import {
  getRentabilidadCentrosBeneficio,
  type RentabilidadCBData, type CentroBeneficioPyG,
} from '../../api/reportes-analiticos'
import { insightsCentrosBeneficio, type Insight, type InsightNivel } from '../../utils/insightsAnaliticos'

const { Text } = Typography
const { RangePicker } = DatePicker

const ACTION = '#1faec2'
const fmtQ = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtCol = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const PRESETS = [
  { label: 'Este año', from: dayjs().startOf('year').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') },
  { label: 'Este mes', from: dayjs().startOf('month').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') },
  { label: 'Mes pasado', from: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), to: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD') },
  { label: 'Q1', from: dayjs().startOf('year').format('YYYY-MM-DD'), to: dayjs().month(2).endOf('month').format('YYYY-MM-DD') },
  { label: 'Q2', from: dayjs().month(3).startOf('month').format('YYYY-MM-DD'), to: dayjs().month(5).endOf('month').format('YYYY-MM-DD') },
]

const INSIGHT_META: Record<InsightNivel, { color: string; icon: React.ReactNode }> = {
  danger:  { color: '#e5484d', icon: <CloseCircleOutlined /> },
  warning: { color: '#ff7f00', icon: <WarningOutlined /> },
  info:    { color: '#1faec2', icon: <InfoCircleOutlined /> },
  success: { color: '#2ea172', icon: <CheckCircleOutlined /> },
}

function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <Card
      size="small" style={{ borderRadius: 8, marginBottom: 16 }}
      title={<Space size={6}><BulbOutlined style={{ color: '#ff7f00' }} /><Text strong style={{ fontSize: 13 }}>Análisis automático</Text></Space>}
      styles={{ body: { padding: '8px 16px' } }}
    >
      {insights.map((ins, i) => {
        const meta = INSIGHT_META[ins.nivel]
        return (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: i > 0 ? '1px solid rgba(10,10,10,0.08)' : undefined }}>
            <span style={{ color: meta.color, fontSize: 15, marginTop: 1 }}>{meta.icon}</span>
            <div>
              <Text strong style={{ fontSize: 12, color: meta.color }}>{ins.titulo}</Text>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{ins.detalle}</div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// ─── Matriz P&L: filas = conceptos, columnas = centros ────────────────────────

type FilaKind = 'seccion' | 'cuenta' | 'sub' | 'grand' | 'pct'
interface FilaMatriz {
  key:    string
  kind:   FilaKind
  label:  string
  seccionKey?: 'ingresos' | 'otrosIngresos' | 'costos' | 'gastos' | 'otrosGastos'
  negate?: boolean
  accountId?: string
  accountName?: string
  values: Record<string, number | null>   // centroKey → valor
  children?: FilaMatriz[]
}

function centroKey(c: CentroBeneficioPyG) { return c.centroId ?? 'sin-asignar' }

const BALANCE_TYPE_SECCION: Record<string, string> = {
  ingresos: 'Ingresos', otrosIngresos: 'Otros Ingresos',
  costos: 'Costos', gastos: 'Gastos', otrosGastos: 'Otros Gastos',
}

function buildMatriz(cols: CentroBeneficioPyG[], totales: RentabilidadCBData['totales']): FilaMatriz[] {
  const val = (get: (c: { [k: string]: any }) => number | null): Record<string, number | null> => {
    const rec: Record<string, number | null> = {}
    cols.forEach(c => { rec[centroKey(c)] = get(c) })
    rec['__total'] = get(totales as any)
    return rec
  }

  // Filas hijas: cuentas de la sección, con su saldo en cada centro
  const cuentasDeSeccion = (seccionKey: string, negate?: boolean): FilaMatriz[] | undefined => {
    const bt = BALANCE_TYPE_SECCION[seccionKey]
    const info = new Map<string, { code: string; name: string }>()
    cols.forEach(c => c.cuentas.filter(x => x.balanceType === bt)
      .forEach(x => info.set(x.accountId, { code: x.code, name: x.name })))
    if (info.size === 0) return undefined
    return [...info.entries()]
      .sort((a, b) => a[1].code.localeCompare(b[1].code))
      .map(([accountId, i]) => {
        const values: Record<string, number | null> = {}
        let tot = 0
        cols.forEach(c => {
          const cta = c.cuentas.find(x => x.accountId === accountId && x.balanceType === bt)
          values[centroKey(c)] = cta ? cta.balance : null
          tot += cta?.balance ?? 0
        })
        values['__total'] = tot
        return {
          key: `cta-${seccionKey}-${accountId}`, kind: 'cuenta' as const,
          label: `${i.code} · ${i.name}`, accountId, accountName: i.name, negate, values,
        }
      })
  }

  const seccion = (key: FilaMatriz['seccionKey'] & string, label: string, negate?: boolean): FilaMatriz => ({
    key, kind: 'seccion', label, seccionKey: key, negate,
    values: val(c => c[key]), children: cuentasDeSeccion(key, negate),
  })

  const filas: FilaMatriz[] = [seccion('ingresos', 'Ingresos')]
  if ((totales.otrosIngresos ?? 0) !== 0 || cuentasDeSeccion('otrosIngresos')) {
    filas.push(seccion('otrosIngresos', 'Otros ingresos'))
  }
  filas.push(
    seccion('costos', 'Costos de venta', true),
    { key: 'ub', kind: 'grand', label: 'Utilidad bruta', values: val(c => c.utilidadBruta) },
    seccion('gastos', 'Gastos de operación', true),
  )
  if ((totales.otrosGastos ?? 0) !== 0 || cuentasDeSeccion('otrosGastos')) {
    filas.push(seccion('otrosGastos', 'Otros gastos', true))
  }
  filas.push(
    { key: 'uo', kind: 'grand', label: 'Utilidad operativa', values: val(c => c.utilidadOperativa) },
    { key: 'margen', kind: 'pct', label: 'Margen operativo %', values: val(c => c.margenOperativo) },
  )

  // Contribución a la utilidad total (solo si la utilidad total es positiva)
  const utilTotal = totales.utilidadOperativa
  if (utilTotal > 0) {
    const contrib: Record<string, number | null> = {}
    cols.forEach(c => { contrib[centroKey(c)] = Math.round((c.utilidadOperativa / utilTotal) * 1000) / 10 })
    contrib['__total'] = 100
    filas.push({ key: 'contrib', kind: 'pct', label: 'Contribución a utilidad %', values: contrib })
  }
  return filas
}

export default function RentabilidadCentrosBeneficioPage() {
  const navigate = useNavigate()
  const [from, setFrom] = useState(PRESETS[0].from)
  const [to, setTo] = useState(PRESETS[0].to)
  const [compare, setCompare] = useState(false)
  const [data, setData] = useState<RentabilidadCBData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)
  const [detalleCentro, setDetalleCentro] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    const days = dayjs(to).diff(dayjs(from), 'day') + 1
    const compFrom = compare ? dayjs(from).subtract(days, 'day').format('YYYY-MM-DD') : undefined
    const compTo   = compare ? dayjs(from).subtract(1, 'day').format('YYYY-MM-DD') : undefined
    getRentabilidadCentrosBeneficio({ fromDate: from, toDate: to, compFrom, compTo })
      .then(setData)
      .catch(e => setError(e?.response?.data?.message || 'Error cargando el reporte'))
      .finally(() => setLoading(false))
  }, [from, to, compare])

  const insights = useMemo(() => data ? insightsCentrosBeneficio(data) : [], [data])

  const columnas = useMemo(() => {
    if (!data) return []
    // Un centro es visible si tiene cuentas con movimiento, aunque su neto sea 0
    // (p.ej. una reclasificación que carga una cuenta y abona otra)
    const conMovimiento = data.data.filter(c => c.cuentas.length > 0)
    const tieneSinAsignar = data.sinAsignar.cuentas.length > 0
    return tieneSinAsignar ? [...conMovimiento, data.sinAsignar] : conMovimiento
  }, [data])

  const filas = useMemo(() =>
    data && columnas.length > 0 ? buildMatriz(columnas, data.totales) : [], [data, columnas])

  // KPIs
  const kpis = useMemo(() => {
    if (!data) return null
    const rentables = columnas.filter(c => c.centroId && c.utilidadOperativa > 0)
    const lider = [...rentables].sort((a, b) => (b.margenOperativo ?? -1) - (a.margenOperativo ?? -1))[0]
    const riesgo = [...columnas].filter(c => c.centroId).sort((a, b) => a.utilidadOperativa - b.utilidadOperativa)[0]
    return { lider, riesgo: riesgo && riesgo.utilidadOperativa < 0 ? riesgo : null }
  }, [data, columnas])

  // Gráfica: barras de utilidad operativa por centro
  const chartOption = useMemo(() => {
    const cs = columnas.filter(c => c.centroId)
    if (cs.length === 0) return null
    return {
      grid: { left: 8, right: 30, top: 10, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtCol(v) } },
      yAxis: { type: 'category', data: cs.map(c => c.nombre), axisLabel: { fontSize: 11 } },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: number) => fmtQ(Number(v)),
      },
      series: [{
        name: 'Utilidad operativa',
        type: 'bar',
        data: cs.map(c => ({
          value: Math.round(c.utilidadOperativa * 100) / 100,
          itemStyle: { color: c.utilidadOperativa >= 0 ? ACTION : '#e5484d' },
        })),
        barMaxWidth: 22,
        label: { show: true, position: 'right', fontSize: 10, formatter: (p: any) => fmtCol(p.value) },
      }],
    }
  }, [columnas])

  // Tendencia mensual de margen por centro
  const trendOption = useMemo(() => {
    if (!data) return null
    const cs = columnas.filter(c => c.centroId)
    if (cs.length === 0) return null
    const yms = [...new Set(data.tendencia.map(t => t.ym))].sort()
    if (yms.length < 2) return null
    const series = cs.map(c => ({
      name: c.nombre,
      type: 'line' as const,
      smooth: true,
      symbolSize: 5,
      data: yms.map(ym => {
        const t = data.tendencia.find(x => x.centroId === c.centroId && x.ym === ym)
        return t ? Math.round((t.ingresos - t.egresos) * 100) / 100 : 0
      }),
    }))
    return {
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtQ(Number(v)) },
      xAxis: { type: 'category', data: yms.map(ym => dayjs(`${ym}-01`).format('MMM YY')), axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtCol(v) } },
      series,
    }
  }, [data, columnas])

  // Tabla matriz
  const tableColumns: ColumnsType<FilaMatriz> = useMemo(() => {
    const cellStyle = (row: FilaMatriz): React.CSSProperties => ({
      fontVariantNumeric: 'tabular-nums', fontSize: row.kind === 'cuenta' ? 11 : 12,
      fontWeight: row.kind === 'grand' ? 700 : 400,
    })
    const renderVal = (v: number | null, row: FilaMatriz) => {
      if (v == null) return <Text type="secondary">—</Text>
      if (row.kind === 'pct') {
        const color = v < 0 ? '#e5484d' : v > 0 ? '#2ea172' : '#6b7280'
        return <span style={{ ...cellStyle(row), color }}>{v.toFixed(1)}%</span>
      }
      const shown = row.negate ? -v : v
      const color = row.kind === 'grand' ? (v < 0 ? '#e5484d' : '#2ea172') : (shown < 0 ? '#e5484d' : undefined)
      const content = <span style={{ ...cellStyle(row), color }}>{fmtCol(shown)}</span>
      if (row.kind === 'cuenta' && row.accountId) {
        return (
          <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
            onClick={() => setDrilldown({ accountId: row.accountId!, accountName: row.accountName ?? row.label, fromDate: from, toDate: to })}>
            {content}
          </span>
        )
      }
      return content
    }
    return [
      {
        title: 'Concepto', dataIndex: 'label', fixed: 'left', width: 230,
        render: (v: string, row) => (
          <Text strong={row.kind !== 'seccion' && row.kind !== 'cuenta'}
            style={{
              fontSize: row.kind === 'cuenta' ? 11 : 12,
              color: row.kind === 'grand' ? ACTION : row.kind === 'cuenta' ? '#6b7280' : undefined,
            }}>
            {v}
          </Text>
        ),
      },
      ...columnas.map(c => ({
        title: (
          <Tooltip title={c.responsable ? `Responsable: ${c.responsable}` : undefined}>
            <div style={{ fontSize: 11, lineHeight: 1.3, textAlign: 'center' as const, cursor: c.centroId ? 'pointer' : undefined }}
              onClick={() => c.centroId && setDetalleCentro(centroKey(c))}>
              <div style={{ fontWeight: 700, color: c.centroId ? ACTION : '#6b7280' }}>{c.nombre}</div>
              <div style={{ color: '#6b7280', fontWeight: 400 }}>{c.codigo}</div>
            </div>
          </Tooltip>
        ),
        key: centroKey(c),
        width: 130,
        align: 'right' as const,
        render: (_: any, row: FilaMatriz) => renderVal(row.values[centroKey(c)] ?? null, row),
      })),
      {
        title: <div style={{ fontSize: 11, fontWeight: 700 }}>Total</div>,
        key: '__total', width: 135, align: 'right' as const,
        onCell: () => ({ style: { background: '#fafbfc' } }),
        render: (_: any, row: FilaMatriz) => renderVal(row.values['__total'] ?? null, row),
      },
    ]
  }, [columnas, from, to])

  // Detalle de cuentas del centro seleccionado
  const centroDetalle = detalleCentro
    ? columnas.find(c => centroKey(c) === detalleCentro) ?? null
    : null

  const sinDatos = !loading && data && columnas.length === 0

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <PieChartOutlined style={{ fontSize: 22, color: '#1faec2', marginTop: 4 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0a0a0a' }}>Rentabilidad por División</div>
            <Text type="secondary" style={{ fontSize: 12 }}>Estado de resultados analítico por línea de negocio</Text>
          </div>
        </Space>
        <Space wrap size={8}>
          <Space size={4} wrap>
            {PRESETS.map(p => (
              <Button key={p.label} size="small"
                type={from === p.from && to === p.to ? 'primary' : 'default'}
                onClick={() => { setFrom(p.from); setTo(p.to) }}
                style={{ fontSize: 11, padding: '0 8px' }}>
                {p.label}
              </Button>
            ))}
            <RangePicker
              value={[dayjs(from), dayjs(to)]}
              onChange={vals => {
                if (vals?.[0] && vals?.[1]) { setFrom(vals[0].format('YYYY-MM-DD')); setTo(vals[1].format('YYYY-MM-DD')) }
              }}
              allowClear={false} size="small" style={{ width: 220 }}
            />
          </Space>
          <Space size={4}>
            <Switch size="small" checked={compare} onChange={setCompare} />
            <Text style={{ fontSize: 12 }}>vs. período anterior</Text>
          </Space>
          <Tooltip title="Imprimir">
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} />
          </Tooltip>
        </Space>
      </div>

      {error && <Alert type="warning" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Spin spinning={loading}>
        {sinDatos ? (
          <Empty description="No hay movimientos con División en el período. Asigna una División en las líneas de tus documentos y pólizas." style={{ padding: 48 }} />
        ) : data && (
          <>
            {/* KPIs */}
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Ingresos del período</span>}
                    value={data.totales.ingresos + data.totales.otrosIngresos} precision={2} prefix="Q"
                    valueStyle={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: ACTION }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
                  {data.totalesComp && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      vs {fmtCol(data.totalesComp.ingresos + data.totalesComp.otrosIngresos)} anterior
                    </Text>
                  )}
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Utilidad operativa</span>}
                    value={data.totales.utilidadOperativa} precision={2} prefix="Q"
                    valueStyle={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: data.totales.utilidadOperativa >= 0 ? '#2ea172' : '#e5484d' }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Margen {data.totales.margenOperativo != null ? `${data.totales.margenOperativo.toFixed(1)}%` : '—'}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Centro líder</span>}
                    value={kpis?.lider?.nombre ?? '—'}
                    valueStyle={{ fontSize: 14, fontWeight: 600, color: '#2ea172' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {kpis?.lider?.margenOperativo != null ? `${kpis.lider.margenOperativo.toFixed(1)}% margen` : 'sin datos'}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>En riesgo</span>}
                    value={kpis?.riesgo?.nombre ?? 'Ninguno'}
                    valueStyle={{ fontSize: 14, fontWeight: 600, color: kpis?.riesgo ? '#e5484d' : '#2ea172' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {kpis?.riesgo ? `pérdida de ${fmtCol(Math.abs(kpis.riesgo.utilidadOperativa))}` : 'todos con utilidad'}
                  </Text>
                </Card>
              </Col>
            </Row>

            <InsightsPanel insights={insights} />

            {/* Matriz P&L */}
            <Card style={{ borderRadius: 8, marginBottom: 16 }} styles={{ body: { padding: 0 } }}
              title={<Text strong style={{ fontSize: 13 }}>Estado de resultados por División</Text>}
              extra={<Text type="secondary" style={{ fontSize: 11 }}>Expande una sección para ver sus cuentas · clic en un monto para ver movimientos</Text>}>
              <Table
        sticky={{ offsetHeader: 60 }}
                size="small" dataSource={filas} columns={tableColumns} rowKey="key"
                pagination={false} scroll={{ x: 'max-content' }}
                expandable={{ indentSize: 12 }}
                onRow={row => ({
                  style: {
                    background: row.kind === 'grand' ? '#fafbfc' : row.kind === 'pct' ? '#fafbfc' : row.kind === 'cuenta' ? '#fcfcfc' : undefined,
                    borderTop: row.kind === 'grand' ? `2px solid rgba(10,10,10,0.08)` : undefined,
                  },
                })}
              />
            </Card>

            {/* Detalle de cuentas del centro */}
            {centroDetalle && (
              <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}
                title={<Text strong style={{ fontSize: 13 }}>Cuentas de {centroDetalle.nombre} ({centroDetalle.codigo})</Text>}
                extra={<Button size="small" onClick={() => setDetalleCentro(null)}>Cerrar</Button>}
                styles={{ body: { padding: 0 } }}>
                <Table
                  size="small" rowKey="accountId" pagination={false}
                  dataSource={[...centroDetalle.cuentas].sort((a, b) => a.code.localeCompare(b.code))}
                  columns={[
                    { title: 'Código', dataIndex: 'code', width: 110, render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280' }}>{v}</Text> },
                    { title: 'Cuenta', dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                    { title: 'Sección', dataIndex: 'balanceType', width: 130, render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag> },
                    {
                      title: 'Saldo', dataIndex: 'balance', width: 140, align: 'right',
                      render: (v: number, row) => (
                        <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: v < 0 ? '#e5484d' : undefined }}
                          onClick={() => setDrilldown({ accountId: row.accountId, accountName: row.name, fromDate: from, toDate: to })}>
                          {fmtQ(v)}
                        </span>
                      ),
                    },
                  ]}
                />
              </Card>
            )}

            {/* Gráficas */}
            <Row gutter={12} style={{ marginBottom: 16 }}>
              {chartOption && (
                <Col xs={24} lg={10}>
                  <Card size="small" style={{ borderRadius: 8, height: '100%' }}
                    title={<Text strong style={{ fontSize: 13 }}>Utilidad operativa por centro</Text>}>
                    <ReactECharts option={chartOption} style={{ height: Math.max(180, columnas.filter(c => c.centroId).length * 42 + 40) }} />
                  </Card>
                </Col>
              )}
              {trendOption && (
                <Col xs={24} lg={14}>
                  <Card size="small" style={{ borderRadius: 8, height: '100%' }}
                    title={<Text strong style={{ fontSize: 13 }}>Tendencia mensual de utilidad (últimos 12 meses)</Text>}>
                    <ReactECharts option={trendOption} style={{ height: 260 }} />
                  </Card>
                </Col>
              )}
            </Row>
          </>
        )}
      </Spin>

      <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
    </div>
  )
}
