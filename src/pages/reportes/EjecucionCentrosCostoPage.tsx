import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Button, Card, Col, Empty, Progress, Row, Select, Space, Spin,
  Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, PrinterOutlined, BulbOutlined, DashboardOutlined,
  WarningOutlined, CloseCircleOutlined, InfoCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import AccountDrilldownDrawer, { type DrilldownTarget } from '../../components/AccountDrilldownDrawer'
import { getEjecucionCentrosCosto, type EjecucionCCData } from '../../api/reportes-analiticos'
import {
  calcularEjecucion, insightsCentrosCosto,
  type EjecucionCentro, type Insight, type InsightNivel,
} from '../../utils/insightsAnaliticos'

const { Text } = Typography

const ACTION = '#1faec2'
const fmtQ = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtCol = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

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

const ESTADO_META: Record<EjecucionCentro['estado'], { color: string; label: string }> = {
  ok:                { color: '#2ea172', label: 'En línea' },
  warning:           { color: '#ff7f00', label: 'Vigilar' },
  danger:            { color: '#e5484d', label: 'Excedido' },
  'sin-presupuesto': { color: '#6b7280', label: 'Sin presupuesto' },
}

/** Composición del gasto de un centro por cuenta (fila expandida) */
function ComposicionCentro({ centro, data, onDrill }: {
  centro: EjecucionCentro
  data: EjecucionCCData
  onDrill: (accountId: string, name: string) => void
}) {
  const porCuenta = useMemo(() => {
    const map = new Map<string, { accountId: string; code: string; name: string; total: number; meses: number[] }>()
    data.real.filter(r => r.centroId === centro.centroId).forEach(r => {
      if (!map.has(r.accountId)) {
        map.set(r.accountId, { accountId: r.accountId, code: r.code, name: r.name, total: 0, meses: Array(12).fill(0) })
      }
      const e = map.get(r.accountId)!
      e.total += r.total
      e.meses[r.mes - 1] += r.total
    })
    return [...map.values()].filter(c => c.total !== 0).sort((a, b) => b.total - a.total)
  }, [centro, data])

  const total = porCuenta.reduce((s, c) => s + c.total, 0)

  return (
    <Table
      size="small" rowKey="accountId" pagination={false} dataSource={porCuenta}
      columns={[
        { title: 'Código', dataIndex: 'code', width: 100, render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280' }}>{v}</Text> },
        { title: 'Cuenta', dataIndex: 'name', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
        {
          title: 'Gasto acumulado', dataIndex: 'total', width: 140, align: 'right',
          render: (v: number, row) => (
            <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}
              onClick={() => onDrill(row.accountId, row.name)}>
              {fmtQ(v)}
            </span>
          ),
        },
        {
          title: '% del centro', key: 'pct', width: 160,
          render: (_: any, row) => {
            const pct = total > 0 ? (row.total / total) * 100 : 0
            return (
              <Space size={8}>
                <Progress percent={Math.round(pct)} size="small" showInfo={false} strokeColor={ACTION} style={{ width: 80 }} />
                <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</Text>
              </Space>
            )
          },
        },
      ]}
    />
  )
}

export default function EjecucionCentrosCostoPage() {
  const navigate = useNavigate()
  const currentYear = dayjs().year()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<EjecucionCCData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    getEjecucionCentrosCosto({ year })
      .then(setData)
      .catch(e => setError(e?.response?.data?.message || 'Error cargando el reporte'))
      .finally(() => setLoading(false))
  }, [year])

  const centros = useMemo(() => data ? calcularEjecucion(data) : [], [data])
  const centrosConDatos = useMemo(() =>
    centros.filter(c => c.realYTD !== 0 || c.presupuestoAnual !== 0), [centros])
  const insights = useMemo(() =>
    data ? insightsCentrosCosto(centros, data) : [], [centros, data])

  const kpis = useMemo(() => {
    if (!data) return null
    const conPresupuesto = centrosConDatos.filter(c => c.presupuestoAnual > 0)
    const gastoTotal = centrosConDatos.reduce((s, c) => s + c.realYTD, 0)
    const presTotal = conPresupuesto.reduce((s, c) => s + c.presupuestoAnual, 0)
    const presYTD = conPresupuesto.reduce((s, c) => s + c.presupuestoYTD, 0)
    const realConPres = conPresupuesto.reduce((s, c) => s + c.realYTD, 0)
    const proyeccion = centrosConDatos.reduce((s, c) => s + (c.proyeccionCierre ?? 0), 0)
    const excedidos = conPresupuesto.filter(c => c.estado === 'danger').length
    return {
      gastoTotal,
      ejecucionPct: presTotal > 0 ? (realConPres / presTotal) * 100 : null,
      esperadoPct: presTotal > 0 ? (presYTD / presTotal) * 100 : null,
      proyeccion,
      presTotal,
      excedidos,
      totalConPres: conPresupuesto.length,
    }
  }, [data, centrosConDatos])

  // Gráfica: acumulado real vs presupuesto mes a mes (todos los centros con presupuesto)
  const chartOption = useMemo(() => {
    if (!data || data.mesActual === 0) return null
    const conPres = centrosConDatos.filter(c => c.presupuestoAnual > 0)
    if (conPres.length === 0 && centrosConDatos.length === 0) return null
    const fuente = conPres.length > 0 ? conPres : centrosConDatos
    const mesesEje = MESES_CORTO
    let cumReal = 0, cumPres = 0
    const serieReal: (number | null)[] = []
    const seriePres: number[] = []
    for (let i = 0; i < 12; i++) {
      cumReal += fuente.reduce((s, c) => s + c.gastoMensual[i], 0)
      cumPres += fuente.reduce((s, c) => s + c.presupuestoMensualArr[i], 0)
      serieReal.push(i < data.mesActual ? Math.round(cumReal * 100) / 100 : null)
      seriePres.push(Math.round(cumPres * 100) / 100)
    }
    return {
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v != null ? fmtQ(Number(v)) : '—' },
      xAxis: { type: 'category', data: mesesEje, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtCol(v) } },
      series: [
        { name: 'Gasto acumulado', type: 'line', smooth: true, symbolSize: 5, data: serieReal, lineStyle: { width: 3, color: ACTION }, itemStyle: { color: ACTION } },
        ...(conPres.length > 0 ? [{ name: 'Presupuesto acumulado', type: 'line' as const, symbol: 'none', data: seriePres, lineStyle: { type: 'dashed' as const, color: '#6b7280' }, itemStyle: { color: '#6b7280' } }] : []),
      ],
    }
  }, [data, centrosConDatos])

  const columns: ColumnsType<EjecucionCentro> = [
    {
      title: 'Centro de costo', key: 'nombre', fixed: 'left', width: 200,
      render: (_, c) => (
        <div>
          <Text strong style={{ fontSize: 12, color: c.centroId ? ACTION : '#6b7280' }}>{c.nombre}</Text>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {c.codigo}{c.responsable ? ` · ${c.responsable}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Presupuesto anual', key: 'pres', width: 135, align: 'right',
      render: (_, c) => c.presupuestoAnual > 0
        ? <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtCol(c.presupuestoAnual)}</span>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Gasto acumulado', key: 'real', width: 130, align: 'right',
      render: (_, c) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtCol(c.realYTD)}</span>,
    },
    {
      title: 'Disponible', key: 'disp', width: 120, align: 'right',
      render: (_, c) => c.disponible != null
        ? <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: c.disponible < 0 ? '#e5484d' : '#2ea172' }}>{fmtCol(c.disponible)}</span>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Ejecución', key: 'ejec', width: 210,
      render: (_, c) => {
        if (c.ejecucionPct == null) return <Text type="secondary" style={{ fontSize: 11 }}>sin presupuesto</Text>
        const meta = ESTADO_META[c.estado]
        return (
          <Tooltip title={c.esperadoPct != null ? `Avance esperado a la fecha: ${c.esperadoPct.toFixed(0)}%` : undefined}>
            <div>
              <Progress
                percent={Math.min(Math.round(c.ejecucionPct), 100)}
                success={c.esperadoPct != null ? { percent: 0 } : undefined}
                size="small" strokeColor={meta.color} showInfo={false}
              />
              <Text style={{ fontSize: 11, color: meta.color }}>
                {c.ejecucionPct.toFixed(0)}%{c.esperadoPct != null ? ` (esperado ${c.esperadoPct.toFixed(0)}%)` : ''}
              </Text>
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: 'Proyección cierre', key: 'proy', width: 140, align: 'right',
      render: (_, c) => {
        if (c.proyeccionCierre == null) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        const excede = c.desviacionProyectada != null && c.desviacionProyectada > 0
        return (
          <Tooltip title={c.desviacionProyectada != null
            ? `${excede ? 'Excedería' : 'Quedaría bajo'} el presupuesto por ${fmtQ(Math.abs(c.desviacionProyectada))}`
            : 'Run-rate a 12 meses'}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: excede ? '#e5484d' : undefined }}>
              {fmtCol(c.proyeccionCierre)}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Estado', key: 'estado', width: 130,
      render: (_, c) => {
        const meta = ESTADO_META[c.estado]
        return (
          <div>
            <Tag color={c.estado === 'ok' ? '#2ea172' : c.estado === 'warning' ? '#ff7f00' : c.estado === 'danger' ? '#e5484d' : undefined} style={{ fontSize: 10 }}>
              {meta.label}
            </Tag>
            {c.mesAgotamiento != null && c.mesAgotamiento <= 12 && (
              <div style={{ fontSize: 10, color: '#e5484d', marginTop: 2 }}>
                se agota en {MESES[c.mesAgotamiento - 1]}
              </div>
            )}
          </div>
        )
      },
    },
  ]

  const sinDatos = !loading && data && centrosConDatos.length === 0

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <DashboardOutlined style={{ fontSize: 22, color: '#1faec2', marginTop: 4 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0a0a0a' }}>Ejecución por Centro de Costo</div>
            <Text type="secondary" style={{ fontSize: 12 }}>Control presupuestario, proyección al cierre y alertas de desviación</Text>
          </div>
        </Space>
        <Space wrap size={8}>
          <Select
            value={year} onChange={setYear} style={{ width: 170 }}
            options={Array.from({ length: 5 }, (_, i) => currentYear - 3 + i + 1)
              .map(y => ({ value: y, label: `Ejercicio ${y}` }))}
          />
          <Tooltip title="Imprimir">
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} />
          </Tooltip>
        </Space>
      </div>

      {error && <Alert type="warning" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Spin spinning={loading}>
        {sinDatos ? (
          <Empty description="No hay gasto ni presupuesto por centros de costo en este ejercicio. Asigna centros de costo en las líneas de tus documentos y pólizas." style={{ padding: 48 }} />
        ) : data && kpis && (
          <>
            {/* KPIs */}
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Gasto acumulado {year}</span>}
                    value={kpis.gastoTotal} precision={2} prefix="Q"
                    valueStyle={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: ACTION }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Ejecución del presupuesto</span>}
                    value={kpis.ejecucionPct ?? 0} precision={0} suffix="%"
                    valueStyle={{
                      fontSize: 14, fontVariantNumeric: 'tabular-nums',
                      color: kpis.ejecucionPct != null && kpis.esperadoPct != null && kpis.ejecucionPct > kpis.esperadoPct ? '#ff7f00' : '#2ea172',
                    }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {kpis.esperadoPct != null ? `esperado ${kpis.esperadoPct.toFixed(0)}% a la fecha` : 'sin presupuesto activo'}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Proyección al cierre</span>}
                    value={kpis.proyeccion} precision={2} prefix="Q"
                    valueStyle={{
                      fontSize: 14, fontVariantNumeric: 'tabular-nums',
                      color: kpis.presTotal > 0 && kpis.proyeccion > kpis.presTotal ? '#e5484d' : ACTION,
                    }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
                  {kpis.presTotal > 0 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {kpis.proyeccion > kpis.presTotal
                        ? `+${Math.round(((kpis.proyeccion - kpis.presTotal) / kpis.presTotal) * 100)}% sobre presupuesto`
                        : 'dentro del presupuesto'}
                    </Text>
                  )}
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>Centros excedidos</span>}
                    value={kpis.excedidos} suffix={kpis.totalConPres > 0 ? `de ${kpis.totalConPres}` : undefined}
                    valueStyle={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: kpis.excedidos > 0 ? '#e5484d' : '#2ea172' }} />
                </Card>
              </Col>
            </Row>

            <InsightsPanel insights={insights} />

            {/* Tabla principal */}
            <Card style={{ borderRadius: 8, marginBottom: 16 }} styles={{ body: { padding: 0 } }}
              title={<Text strong style={{ fontSize: 13 }}>Ejecución por centro de costo · ejercicio {year}</Text>}
              extra={<Text type="secondary" style={{ fontSize: 11 }}>Expande una fila para ver la composición del gasto</Text>}>
              <Table
                size="small" dataSource={centrosConDatos} columns={columns}
                rowKey={c => c.centroId ?? 'sin-asignar'}
                pagination={false} scroll={{ x: 'max-content', y: 'calc(100vh - 420px)' }}
                expandable={{
                  expandedRowRender: c => (
                    <ComposicionCentro centro={c} data={data}
                      onDrill={(accountId, name) => setDrilldown({
                        accountId, accountName: name,
                        fromDate: `${year}-01-01`, toDate: `${year}-12-31`,
                      })} />
                  ),
                  rowExpandable: c => data.real.some(r => r.centroId === c.centroId),
                }}
              />
            </Card>

            {/* Gráfica acumulada */}
            {chartOption && (
              <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}
                title={<Text strong style={{ fontSize: 13 }}>Gasto acumulado vs presupuesto</Text>}>
                <ReactECharts option={chartOption} style={{ height: 280 }} />
              </Card>
            )}
          </>
        )}
      </Spin>

      <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
    </div>
  )
}
