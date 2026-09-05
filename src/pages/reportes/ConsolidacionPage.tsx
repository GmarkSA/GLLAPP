import { useState, useEffect, useCallback } from 'react'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Empty, Row, Select,
  Space, Spin, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import {
  ApartmentOutlined, BankOutlined, CheckCircleOutlined,
  DownloadOutlined, ExclamationCircleOutlined, FileTextOutlined,
  FundOutlined, RiseOutlined, SwapOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useCompanyStore } from '../../store/companyStore'
import { getBillingState } from '../../api/billing'
import {
  getBalanceGeneral, getEstadoResultados, getPlanificacionFiscal,
  getFlujoCaja, getMovimientoCapital, getEliminacionIntercompany,
  type ConsolidacionQuery, type ResultadoConsolidado,
  type PlanificacionFiscal, type Recomendacion,
  type FlujoCaja, type MovimientoCapital, type EliminacionIntercompany,
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

  const grouped: Record<string, any[]> = {}
  for (const r of data.filas) { (grouped[r.type] ??= []).push(r) }

  const allRows: any[] = []
  for (const [type, filas] of Object.entries(grouped)) {
    allRows.push({ _isHeader: true, accountName: typeLabel[type] ?? type, type, filas })
    allRows.push(...filas.map(f => ({ ...f, key: `${f.type}_${f.accountName}` })))
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

// ── Panel de Flujo de Caja ─────────────────────────────────────────────────
function PanelFlujoCaja({ data, companyNames }: { data: FlujoCaja; companyNames: Record<string, string> }) {
  const colStyle = (v: number) => ({ color: v < 0 ? '#cf1322' : v > 0 ? '#2ea172' : undefined })

  const filas = [
    { label: 'Utilidad neta del período',          key: 'utilidad',     section: 'Actividades de Operación' },
    { label: '(+/-) Variación Cuentas por Cobrar', key: 'arChange',     section: 'Actividades de Operación', inv: true },
    { label: '(+/-) Variación Cuentas por Pagar',  key: 'apChange',     section: 'Actividades de Operación' },
    { label: 'Flujo neto de operación',             key: 'operating',    section: 'Subtotal', bold: true },
    { label: 'Compra/venta de activos fijos',       key: 'faInvesting',  section: 'Actividades de Inversión' },
    { label: 'Flujo neto de inversión',             key: 'investing',    section: 'Subtotal', bold: true },
    { label: '(+/-) Variación de Capital',          key: 'capChange',    section: 'Actividades de Financiamiento' },
    { label: 'Flujo neto de financiamiento',        key: 'financing',    section: 'Subtotal', bold: true },
    { label: 'FLUJO NETO TOTAL',                    key: 'netCash',      section: 'Total', bold: true },
  ] as const

  const getVal = (e: any, key: string) => Number((e as any)[key] ?? 0)

  const cols: any[] = [
    { title: 'Concepto', dataIndex: 'label', width: 280, render: (v: string, r: any) => <span style={{ fontWeight: r.bold ? 700 : 400 }}>{v}</span> },
    ...data.porEmpresa.map(e => ({
      title: <span style={{ fontSize: 11 }}>{companyNames[e.companyId] ?? e.companyId.slice(0, 8)}</span>,
      key: e.companyId,
      align: 'right' as const,
      width: 150,
      render: (_: any, r: any) => {
        const v = getVal(e, r.key)
        return <span style={{ ...colStyle(v), fontWeight: r.bold ? 700 : 400 }}>{Q(v)}</span>
      },
    })),
    {
      title: 'Consolidado',
      key: 'consolidado',
      align: 'right' as const,
      width: 160,
      render: (_: any, r: any) => {
        const v = getVal(data.consolidado, r.key)
        return <Text strong style={{ color: v < 0 ? '#cf1322' : v > 0 ? '#1B3A6B' : undefined }}>{Q(v)}</Text>
      },
    },
  ]

  // Agrupar por sección para mostrar headers
  const sections: string[] = []
  const rowsWithHeaders: any[] = []
  for (const f of filas) {
    if (!sections.includes(f.section) && f.section !== 'Subtotal' && f.section !== 'Total') {
      sections.push(f.section)
      rowsWithHeaders.push({ _isHeader: true, label: f.section, key: `hdr_${f.section}` })
    }
    rowsWithHeaders.push({ ...f })
  }

  return (
    <Table
      dataSource={rowsWithHeaders}
      columns={cols}
      size="small"
      rowKey="key"
      pagination={false}
      scroll={{ x: 'max-content' }}
      rowClassName={(r: any) => r._isHeader ? 'bg-section-header' : ''}
      components={{
        body: {
          row: (props: any) => {
            const idx = rowsWithHeaders.findIndex(r => r.key === props['data-row-key'])
            const r = rowsWithHeaders[idx]
            if (!r) return <tr {...props} />
            if (r._isHeader) return <tr {...props} style={{ background: '#f0f5ff', fontWeight: 700 }} />
            if (r.section === 'Total') return <tr {...props} style={{ background: '#1B3A6B10', fontWeight: 700, borderTop: '2px solid #1B3A6B' }} />
            if (r.section === 'Subtotal') return <tr {...props} style={{ background: '#fafbfc', fontWeight: 600, borderTop: '1px solid #e5e7eb' }} />
            return <tr {...props} />
          },
        },
      }}
    />
  )
}

// ── Panel de Movimiento de Capital ─────────────────────────────────────────
function PanelMovimientoCapital({ data, companyNames }: { data: MovimientoCapital; companyNames: Record<string, string> }) {
  const filas = [
    { label: 'Saldo inicial de capital',  key: 'saldoInicial',      bold: false },
    { label: '+ Utilidad del período',    key: 'utilidad',          bold: false },
    { label: '+ Movimientos de capital',  key: 'movimientoCapital', bold: false },
    { label: 'SALDO FINAL DE CAPITAL',    key: 'saldoFinal',        bold: true  },
  ]

  const cols: any[] = [
    { title: 'Concepto', dataIndex: 'label', width: 280, render: (v: string, r: any) => <span style={{ fontWeight: r.bold ? 700 : 400 }}>{v}</span> },
    ...data.porEmpresa.map(e => ({
      title: <span style={{ fontSize: 11 }}>{companyNames[e.companyId] ?? e.companyId.slice(0, 8)}</span>,
      key: e.companyId,
      align: 'right' as const,
      width: 150,
      render: (_: any, r: any) => {
        const v = Number((e as any)[r.key] ?? 0)
        return <span style={{ color: v < 0 ? '#cf1322' : undefined, fontWeight: r.bold ? 700 : 400 }}>{Q(v)}</span>
      },
    })),
    {
      title: 'Consolidado',
      key: 'consolidado',
      align: 'right' as const,
      width: 160,
      render: (_: any, r: any) => {
        const v = Number((data.consolidado as any)[r.key] ?? 0)
        return <Text strong style={{ color: v < 0 ? '#cf1322' : '#1B3A6B' }}>{Q(v)}</Text>
      },
    },
  ]

  return (
    <div>
      <Table
        dataSource={filas}
        columns={cols}
        size="small"
        rowKey="key"
        pagination={false}
        scroll={{ x: 'max-content' }}
        components={{
          body: {
            row: (props: any) => {
              const r = filas.find(f => f.key === props['data-row-key'])
              if (r?.bold) return <tr {...props} style={{ background: '#1B3A6B10', fontWeight: 700, borderTop: '2px solid #1B3A6B' }} />
              return <tr {...props} />
            },
          },
        }}
      />

      {/* Detalle de movimientos por empresa */}
      {data.porEmpresa.some(e => e.movimientos.length > 0) && (
        <div style={{ marginTop: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 12, color: '#1B3A6B' }}>
            Detalle de movimientos de capital por empresa
          </Text>
          <Row gutter={[16, 16]}>
            {data.porEmpresa.filter(e => e.movimientos.length > 0).map(e => (
              <Col key={e.companyId} xs={24} md={12}>
                <Card size="small" title={companyNames[e.companyId] ?? e.companyId} style={{ borderRadius: 8 }}>
                  <Table
                    dataSource={e.movimientos}
                    rowKey="code"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Código', dataIndex: 'code', width: 80 },
                      { title: 'Cuenta', dataIndex: 'name' },
                      { title: 'Movimiento', dataIndex: 'movimiento', align: 'right', render: (v: number) => <span style={{ color: v < 0 ? '#cf1322' : '#2ea172' }}>{Q(v)}</span> },
                    ]}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  )
}

// ── Panel de Eliminación Intercompany ─────────────────────────────────────
function PanelIntercompany({ data, companyNames }: { data: EliminacionIntercompany; companyNames: Record<string, string> }) {
  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic
              title="Transacciones intercompany"
              value={data.transacciones.length}
              valueStyle={{ color: '#1B3A6B', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic
              title="Total a eliminar"
              value={data.totalEliminado}
              prefix="Q"
              precision={2}
              valueStyle={{ color: data.totalEliminado > 0 ? '#d46b08' : '#6b7280', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {data.transacciones.length === 0 ? (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          message={data.nota ?? 'No se encontraron transacciones intercompany en el período seleccionado.'}
        />
      ) : (
        <>
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            style={{ marginBottom: 16, borderRadius: 8 }}
            message={data.nota}
          />
          <Table
            dataSource={data.transacciones}
            rowKey="invoiceNumber"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Fecha', dataIndex: 'fecha', width: 100 },
              { title: 'Número', dataIndex: 'invoiceNumber', width: 120 },
              { title: 'Empresa emisora', dataIndex: 'emisorNombre', render: (v, r: any) => companyNames[r.emisorId] ?? v },
              { title: 'Empresa receptora', dataIndex: 'receptorEmpresaNombre' },
              { title: 'NIT receptor', dataIndex: 'receptorNit', width: 110 },
              { title: 'Moneda', dataIndex: 'currency', width: 80, align: 'center' },
              { title: 'Total', dataIndex: 'total', align: 'right', width: 140, render: (v: number) => <Text strong style={{ color: '#d46b08' }}>{Q(v)}</Text> },
            ]}
          />
        </>
      )}
    </div>
  )
}

// ── Exportar a Excel ───────────────────────────────────────────────────────
function exportarExcel(params: {
  periodo: string
  companyNames: Record<string, string>
  bgData:  ResultadoConsolidado | null
  erData:  ResultadoConsolidado | null
  pfData:  PlanificacionFiscal  | null
  fcData:  FlujoCaja            | null
  mcData:  MovimientoCapital    | null
  icData:  EliminacionIntercompany | null
}) {
  const wb = XLSX.utils.book_new()
  const { periodo, companyNames, bgData, erData, pfData, fcData, mcData, icData } = params

  const toSheet = (filas: ResultadoConsolidado) => {
    const headers = ['Tipo', 'SubTipo', 'Cuenta', ...filas.companyIds.map(id => companyNames[id] ?? id), 'Total']
    const rows = filas.filas.map(f => [
      f.type, f.subType, f.accountName,
      ...filas.companyIds.map(id => f.porEmpresa[id] ?? 0),
      f.total,
    ])
    return XLSX.utils.aoa_to_sheet([headers, ...rows])
  }

  if (bgData) XLSX.utils.book_append_sheet(wb, toSheet(bgData), 'Balance General')
  if (erData) XLSX.utils.book_append_sheet(wb, toSheet(erData), 'Est. Resultados')

  if (pfData) {
    const headers = ['Empresa', 'NIT', 'Régimen', 'Ingresos', 'Gastos', 'Utilidad', 'Tasa ISR', 'ISR Proyectado', 'Situación']
    const rows = pfData.empresas.map(e => [
      e.legalName, e.taxId, e.regNombre, e.ingresos, e.gastos, e.utilidad, e.tasaIsr, e.isrProyectado, e.situacion,
    ])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Plan. Fiscal')
  }

  if (fcData) {
    const empHeaders = fcData.porEmpresa.map(e => companyNames[e.companyId] ?? e.companyId)
    const keys = ['utilidad','arChange','apChange','operating','faInvesting','investing','capChange','financing','netCash'] as const
    const labels: Record<string, string> = {
      utilidad: 'Utilidad neta', arChange: 'Var. CxC', apChange: 'Var. CxP',
      operating: 'Flujo operación', faInvesting: 'Activos fijos', investing: 'Flujo inversión',
      capChange: 'Var. capital', financing: 'Flujo financiamiento', netCash: 'Flujo neto total',
    }
    const headers = ['Concepto', ...empHeaders, 'Consolidado']
    const rows = keys.map(k => [labels[k], ...fcData.porEmpresa.map(e => (e as any)[k] ?? 0), (fcData.consolidado as any)[k] ?? 0])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Flujo de Caja')
  }

  if (mcData) {
    const empHeaders = mcData.porEmpresa.map(e => companyNames[e.companyId] ?? e.companyId)
    const keys = ['saldoInicial','utilidad','movimientoCapital','saldoFinal'] as const
    const labels: Record<string, string> = {
      saldoInicial: 'Saldo inicial', utilidad: 'Utilidad', movimientoCapital: 'Movimientos capital', saldoFinal: 'Saldo final',
    }
    const headers = ['Concepto', ...empHeaders, 'Consolidado']
    const rows = keys.map(k => [labels[k], ...mcData.porEmpresa.map(e => (e as any)[k] ?? 0), (mcData.consolidado as any)[k] ?? 0])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Mov. Capital')
  }

  if (icData && icData.transacciones.length > 0) {
    const headers = ['Fecha', 'Número', 'Emisor', 'Receptor', 'NIT', 'Moneda', 'Total']
    const rows = icData.transacciones.map(t => [t.fecha, t.invoiceNumber, t.emisorNombre, t.receptorEmpresaNombre, t.receptorNit, t.currency, t.total])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Intercompany')
  }

  XLSX.writeFile(wb, `Consolidacion_${periodo.replace(/\s/g, '_')}.xlsx`)
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
  const [fcData,   setFcData]   = useState<FlujoCaja            | null>(null)
  const [mcData,   setMcData]   = useState<MovimientoCapital    | null>(null)
  const [icData,   setIcData]   = useState<EliminacionIntercompany | null>(null)
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
      const [bg, er, pf, fc, mc, ic] = await Promise.all([
        getBalanceGeneral(query),
        getEstadoResultados(query),
        getPlanificacionFiscal(query),
        getFlujoCaja(query),
        getMovimientoCapital(query),
        getEliminacionIntercompany(query),
      ])
      setBgData(bg)
      setErData(er)
      setPfData(pf)
      setFcData(fc)
      setMcData(mc)
      setIcData(ic)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al generar el reporte consolidado')
    } finally {
      setLoading(false)
    }
  }, [selectedIds, period])

  const hayResultados = bgData || erData || pfData

  const periodoLabel = `${MESES[query.month - 1]} ${query.year}`

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
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Período: <strong>{periodoLabel}</strong> ·
              Empresas: <strong>{selectedIds.map(id => companyNames[id] ?? id).join(', ')}</strong>
            </Text>
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => exportarExcel({ periodo: periodoLabel, companyNames, bgData, erData, pfData, fcData, mcData, icData })}
            >
              Exportar Excel
            </Button>
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
              {
                key: 'flujo',
                label: <span><FundOutlined /> Flujo de Caja</span>,
                children: fcData
                  ? <PanelFlujoCaja data={fcData} companyNames={companyNames} />
                  : <Empty description="Sin datos" />,
              },
              {
                key: 'capital',
                label: <span><BankOutlined /> Mov. Capital</span>,
                children: mcData
                  ? <PanelMovimientoCapital data={mcData} companyNames={companyNames} />
                  : <Empty description="Sin datos" />,
              },
              {
                key: 'intercompany',
                label: (
                  <span>
                    <SwapOutlined /> Intercompany
                    {icData && icData.transacciones.length > 0
                      ? <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>{icData.transacciones.length}</Tag>
                      : null}
                  </span>
                ),
                children: icData
                  ? <PanelIntercompany data={icData} companyNames={companyNames} />
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
