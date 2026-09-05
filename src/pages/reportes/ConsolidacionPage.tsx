import { useState, useEffect, useCallback } from 'react'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Empty, Row, Select,
  Space, Spin, Statistic, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import {
  ApartmentOutlined, BankOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, FileTextOutlined, RiseOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCompanyStore } from '../../store/companyStore'
import { getBillingState } from '../../api/billing'
import {
  getBalanceGeneral, getEstadoResultados, getPlanificacionFiscal,
  type ConsolidacionQuery, type ResultadoConsolidado,
  type PlanificacionFiscal, type Recomendacion,
} from '../../api/consolidacion'

const { Title, Text } = Typography
const Q = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Tabla de filas consolidadas ────────────────────────────────────────────
function TablaConsolidada({ data, companyNames }: { data: ResultadoConsolidado; companyNames: Record<string, string> }) {
  const cols: any[] = [
    {
      title: 'Cuenta',
      dataIndex: 'accountName',
      width: 280,
      render: (v: string, r: any) => (
        <span>
          <Text type="secondary" style={{ fontSize: 10, marginRight: 6 }}>{r.subType}</Text>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </span>
      ),
    },
    ...data.companyIds.map(id => ({
      title: <span style={{ fontSize: 11 }}>{companyNames[id] ?? id.slice(0, 8)}</span>,
      key: id,
      align: 'right' as const,
      width: 140,
      render: (_: any, r: any) => {
        const v = r.porEmpresa[id] ?? 0
        const display = r.normalBalance === 'credit' ? -v : v
        return <span style={{ color: display < 0 ? '#cf1322' : undefined }}>{Q(display)}</span>
      },
    })),
    {
      title: 'Total',
      key: 'total',
      align: 'right' as const,
      width: 150,
      render: (_: any, r: any) => {
        const display = r.normalBalance === 'credit' ? -r.total : r.total
        return <Text strong style={{ color: display < 0 ? '#cf1322' : '#1B3A6B' }}>{Q(display)}</Text>
      },
    },
  ]

  const typeLabel: Record<string, string> = {
    asset: 'Activo', liability: 'Pasivo', equity: 'Capital',
    income: 'Ingresos', expense: 'Gastos', contra: 'Cuentas Contrarias',
  }

  // Agrupar por type para mostrar subtotales
  const grouped: Record<string, any[]> = {}
  for (const r of data.filas) { (grouped[r.type] ??= []).push(r) }

  const allRows: any[] = []
  for (const [type, filas] of Object.entries(grouped)) {
    allRows.push({ _isHeader: true, accountName: typeLabel[type] ?? type, type, filas })
    allRows.push(...filas.map(f => ({ ...f, key: `${f.type}_${f.accountName}` })))
    // Subtotal
    const subtotal: any = { _isSubtotal: true, type, accountName: `Subtotal ${typeLabel[type] ?? type}`, porEmpresa: {}, total: 0, normalBalance: filas[0]?.normalBalance ?? 'debit' }
    for (const id of data.companyIds) subtotal.porEmpresa[id] = filas.reduce((s, f) => s + (f.porEmpresa[id] ?? 0), 0)
    subtotal.total = filas.reduce((s, f) => s + f.total, 0)
    allRows.push(subtotal)
  }

  return (
    <Table
      dataSource={allRows}
      columns={cols}
      size="small"
      rowKey={(r: any) => r.key ?? r.accountName + r.type + Math.random()}
      pagination={false}
      scroll={{ x: 'max-content' }}
      rowClassName={(r: any) => r._isHeader ? 'bg-section-header' : r._isSubtotal ? 'bg-subtotal' : ''}
      components={{
        body: {
          row: (props: any) => {
            const r = allRows[props['data-row-key']] ?? {}
            if (r._isHeader) return <tr {...props} style={{ background: '#f0f5ff', fontWeight: 700 }} />
            if (r._isSubtotal) return <tr {...props} style={{ background: '#fafbfc', fontWeight: 600, borderTop: '1px solid #e5e7eb' }} />
            return <tr {...props} />
          },
        },
      }}
    />
  )
}

// ── Panel de planificación fiscal ─────────────────────────────────────────
function PanelFiscal({ data }: { data: PlanificacionFiscal }) {
  const situacionColor = (s: string) => s === 'rentable' ? 'green' : s === 'perdida' ? 'red' : 'orange'
  const prioridadColor = (p: string) => p === 'alta' ? 'red' : p === 'media' ? 'orange' : 'blue'

  return (
    <div>
      {/* Resumen KPIs */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic title="Ingresos consolidados" value={data.totalIngresos}
              prefix="Q" precision={2} valueStyle={{ color: '#2ea172', fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic title="Gastos consolidados" value={data.totalGastos}
              prefix="Q" precision={2} valueStyle={{ color: '#cf1322', fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic title="Utilidad consolidada" value={data.utilidadConsolidada}
              prefix="Q" precision={2} valueStyle={{ color: data.utilidadConsolidada >= 0 ? '#2ea172' : '#cf1322', fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic title="ISR proyectado total" value={data.isrConsolidado}
              prefix="Q" precision={2} valueStyle={{ color: '#d46b08', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {/* Tabla por empresa */}
      <Table
        dataSource={data.empresas}
        rowKey="companyId"
        size="small"
        pagination={false}
        style={{ marginBottom: 20 }}
        columns={[
          { title: 'Empresa', dataIndex: 'legalName', render: (v, r: any) => <><b>{v}</b><div style={{ fontSize: 11, color: '#6b7280' }}>{r.regNombre} · NIT {r.taxId}</div></> },
          { title: 'Ingresos', dataIndex: 'ingresos', align: 'right', render: (v: number) => <span style={{ color: '#2ea172' }}>{Q(v)}</span> },
          { title: 'Gastos', dataIndex: 'gastos', align: 'right', render: (v: number) => <span style={{ color: '#cf1322' }}>{Q(v)}</span> },
          { title: 'Utilidad', dataIndex: 'utilidad', align: 'right', render: (v: number) => <Text strong style={{ color: v >= 0 ? '#2ea172' : '#cf1322' }}>{Q(v)}</Text> },
          { title: 'Tasa ISR', dataIndex: 'tasaIsr', align: 'center', render: (v: number) => `${(v * 100).toFixed(0)}%` },
          { title: 'ISR Proyectado', dataIndex: 'isrProyectado', align: 'right', render: (v: number) => <Text strong style={{ color: '#d46b08' }}>{Q(v)}</Text> },
          { title: 'Situación', dataIndex: 'situacion', align: 'center', render: (v: string) => <Tag color={situacionColor(v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</Tag> },
        ]}
      />

      {/* Recomendaciones */}
      {data.recomendaciones.length === 0 ? (
        <Alert type="success" icon={<CheckCircleOutlined />} showIcon
          message="Sin oportunidades de optimización fiscal identificadas para este período." />
      ) : (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 12, color: '#1B3A6B' }}>
            Recomendaciones de planificación fiscal
          </Text>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {data.recomendaciones.map((r: Recomendacion, i) => (
              <Alert
                key={i}
                type={r.prioridad === 'alta' ? 'error' : r.prioridad === 'media' ? 'warning' : 'info'}
                icon={r.tipo === 'intercompany_billing' ? <RiseOutlined /> : <WarningOutlined />}
                showIcon
                style={{ borderRadius: 8 }}
                message={
                  <Space>
                    <Tag color={prioridadColor(r.prioridad)} style={{ fontSize: 10 }}>Prioridad {r.prioridad}</Tag>
                    {r.ahorroEstimadoIsr && (
                      <Tag color="green" style={{ fontSize: 10 }}>Ahorro ISR estimado: {Q(r.ahorroEstimadoIsr)}</Tag>
                    )}
                  </Space>
                }
                description={
                  <div style={{ marginTop: 4 }}>
                    <div style={{ marginBottom: 4 }}>{r.descripcion}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>⚠ {r.nota}</Text>
                  </div>
                }
              />
            ))}
          </Space>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ConsolidacionPage() {
  const { companies } = useCompanyStore()
  const [maxCompanies, setMaxCompanies] = useState<number>(10)

  const [selectedIds, setSelectedIds]   = useState<string[]>([])
  const [period, setPeriod]             = useState(dayjs().subtract(1, 'month'))
  const [activeTab, setActiveTab]       = useState('balance')

  const [bgData,   setBgData]   = useState<ResultadoConsolidado | null>(null)
  const [erData,   setErData]   = useState<ResultadoConsolidado | null>(null)
  const [pfData,   setPfData]   = useState<PlanificacionFiscal  | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    getBillingState().then(s => setMaxCompanies(s.subscription?.maxCompanies ?? s.plans?.find(p => p.plan === s.tenant?.plan)?.maxCompanies ?? 10)).catch(() => {})
  }, [])

  const companyNames: Record<string, string> = Object.fromEntries(
    companies.map(c => [c.id, c.tradeName || c.legalName])
  )

  const activeCompanies = companies.filter(c => (c as any).isActive !== false)

  const toggleEmpresa = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= maxCompanies) return prev
      return [...prev, id]
    })
  }

  const query: ConsolidacionQuery = {
    companyIds: selectedIds,
    year:  period.year(),
    month: period.month() + 1,
  }

  const generar = useCallback(async () => {
    if (selectedIds.length < 2) return
    setLoading(true)
    setError(null)
    try {
      const [bg, er, pf] = await Promise.all([
        getBalanceGeneral(query),
        getEstadoResultados(query),
        getPlanificacionFiscal(query),
      ])
      setBgData(bg)
      setErData(er)
      setPfData(pf)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al generar el reporte consolidado')
    } finally {
      setLoading(false)
    }
  }, [selectedIds, period])

  const hayResultados = bgData || erData || pfData

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          <ApartmentOutlined style={{ marginRight: 8 }} />
          Consolidación Financiera
        </Title>
        <Text type="secondary">
          Selecciona las empresas y el período para generar reportes consolidados y planificación fiscal.
        </Text>
      </div>

      {/* Panel de configuración */}
      <Card style={{ borderRadius: 12, marginBottom: 20 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={14}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Empresas a consolidar
              <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                (máx. {maxCompanies} según tu plan — seleccionadas: {selectedIds.length})
              </Text>
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {activeCompanies.map(c => {
                const checked = selectedIds.includes(c.id)
                const disabled = !checked && selectedIds.length >= maxCompanies
                return (
                  <div
                    key={c.id}
                    onClick={() => !disabled && toggleEmpresa(c.id)}
                    style={{
                      border: `2px solid ${checked ? '#1faec2' : '#e5e7eb'}`,
                      borderRadius: 8, padding: '8px 14px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: checked ? '#e6f9fc' : '#fafbfc',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <Checkbox checked={checked} disabled={disabled} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.tradeName || c.legalName}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{(c as any).taxId ?? ''}</div>
                    </div>
                  </div>
                )
              })}
              {activeCompanies.length === 0 && (
                <Text type="secondary">No hay empresas activas en este tenant.</Text>
              )}
            </div>
          </Col>

          <Col xs={24} md={6}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Período</Text>
            <DatePicker
              picker="month"
              value={period}
              onChange={v => v && setPeriod(v)}
              format="MMMM YYYY"
              style={{ width: '100%' }}
              disabledDate={d => d.isAfter(dayjs())}
            />
          </Col>

          <Col xs={24} md={4}>
            <Button
              type="primary"
              block
              size="large"
              icon={<FileTextOutlined />}
              disabled={selectedIds.length < 2}
              loading={loading}
              onClick={generar}
              style={{ background: '#1faec2', borderColor: '#1faec2', marginTop: 24 }}
            >
              Generar
            </Button>
            {selectedIds.length < 2 && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>
                Selecciona al menos 2 empresas
              </Text>
            )}
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16, borderRadius: 8 }} showIcon />}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#6b7280' }}>Consolidando datos…</div>
        </div>
      )}

      {/* Resultados */}
      {!loading && hayResultados && (
        <Card style={{ borderRadius: 12 }}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Período: <strong>{MESES[query.month - 1]} {query.year}</strong> ·
              Empresas: <strong>{selectedIds.map(id => companyNames[id] ?? id).join(', ')}</strong>
            </Text>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'balance',
                label: <span><BankOutlined /> Balance General</span>,
                children: bgData
                  ? <TablaConsolidada data={bgData} companyNames={companyNames} />
                  : <Empty description="Sin datos" />,
              },
              {
                key: 'resultados',
                label: <span><RiseOutlined /> Estado de Resultados</span>,
                children: erData
                  ? <TablaConsolidada data={erData} companyNames={companyNames} />
                  : <Empty description="Sin datos" />,
              },
              {
                key: 'fiscal',
                label: (
                  <span>
                    <ExclamationCircleOutlined />
                    {' '}Planificación Fiscal
                    {pfData?.recomendaciones?.length
                      ? <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>{pfData.recomendaciones.length}</Tag>
                      : null}
                  </span>
                ),
                children: pfData
                  ? <PanelFiscal data={pfData} />
                  : <Empty description="Sin datos" />,
              },
            ]}
          />
        </Card>
      )}

      {!loading && !hayResultados && (
        <Empty
          image={<ApartmentOutlined style={{ fontSize: 64, color: '#d1d5db' }} />}
          description={<Text type="secondary">Selecciona las empresas y el período, luego haz clic en Generar.</Text>}
          style={{ padding: '60px 0' }}
        />
      )}
    </div>
  )
}
