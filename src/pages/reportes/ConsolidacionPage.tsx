import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Checkbox, Col, DatePicker, Empty, Row,
  Segmented, Space, Spin, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import {
  ApartmentOutlined, ArrowLeftOutlined, BankOutlined, CheckCircleOutlined,
  DownloadOutlined, ExclamationCircleOutlined, FileTextOutlined, HomeOutlined,
  FundOutlined, RiseOutlined, SwapOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
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
const qStyle = { fontVariantNumeric: 'tabular-nums' as const }
const neg = (v: number) => v < 0 ? '#e5484d' : undefined
const posneg = (v: number) => v < 0 ? '#e5484d' : '#2ea172'

type PeriodMode = 'mes' | 'trimestre' | 'año'

function computeRange(mode: PeriodMode, pick: Dayjs): { startDate: string; endDate: string; label: string } {
  if (mode === 'mes') {
    return {
      startDate: pick.startOf('month').format('YYYY-MM-DD'),
      endDate:   pick.endOf('month').format('YYYY-MM-DD'),
      label:     pick.format('MMMM YYYY'),
    }
  }
  if (mode === 'trimestre') {
    const q = Math.floor(pick.month() / 3)
    const start = pick.month(q * 3).startOf('month')
    const end   = pick.month(q * 3 + 2).endOf('month')
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate:   end.format('YYYY-MM-DD'),
      label:     `Q${q + 1} ${pick.year()}`,
    }
  }
  // año
  return {
    startDate: pick.startOf('year').format('YYYY-MM-DD'),
    endDate:   pick.endOf('year').format('YYYY-MM-DD'),
    label:     `Año ${pick.year()}`,
  }
}

// ── Tabla de filas consolidadas ────────────────────────────────────────────
function TablaConsolidada({ data, companyNames }: { data: ResultadoConsolidado; companyNames: Record<string, string> }) {
  const typeLabel: Record<string, string> = {
    asset: 'Activo', liability: 'Pasivo', equity: 'Capital',
    income: 'Ingresos', expense: 'Gastos', contra: 'Cuentas Contrarias',
  }

  const grouped: Record<string, any[]> = {}
  for (const r of data.filas) { (grouped[r.type] ??= []).push(r) }

  const allRows: any[] = []
  for (const [type, filas] of Object.entries(grouped)) {
    allRows.push({ _kind: 'hdr', key: `hdr_${type}`, accountName: typeLabel[type] ?? type })
    for (const f of filas) allRows.push({ ...f, _kind: 'acct', key: `${f.type}_${f.accountName}` })
    const sub: any = { _kind: 'sub', key: `sub_${type}`, accountName: `Total ${typeLabel[type] ?? type}`, porEmpresa: {}, total: 0, normalBalance: filas[0]?.normalBalance ?? 'debit' }
    for (const id of data.companyIds) sub.porEmpresa[id] = filas.reduce((s, f) => s + (f.porEmpresa[id] ?? 0), 0)
    sub.total = filas.reduce((s, f) => s + f.total, 0)
    allRows.push(sub)
  }

  const cols: any[] = [
    {
      title: 'Cuenta',
      dataIndex: 'accountName',
      width: 260,
      render: (v: string, r: any) => {
        if (r._kind === 'hdr') return <span style={{ fontWeight: 700, fontSize: 12, color: '#374151' }}>{v}</span>
        if (r._kind === 'sub') return <span style={{ fontWeight: 600, fontSize: 12 }}>{v}</span>
        return (
          <span>
            <Text type="secondary" style={{ fontSize: 10, marginRight: 6 }}>{r.subType}</Text>
            <span style={{ fontSize: 12 }}>{v}</span>
          </span>
        )
      },
    },
    ...data.companyIds.map(id => ({
      title: <span style={{ fontSize: 11 }}>{companyNames[id] ?? id.slice(0, 8)}</span>,
      key: id,
      align: 'right' as const,
      width: 140,
      render: (_: any, r: any) => {
        if (r._kind === 'hdr') return null
        const v = r._kind === 'sub'
          ? (r.normalBalance === 'credit' ? -(r.porEmpresa[id] ?? 0) : (r.porEmpresa[id] ?? 0))
          : (r.normalBalance === 'credit' ? -(r.porEmpresa[id] ?? 0) : (r.porEmpresa[id] ?? 0))
        return <span style={{ ...qStyle, fontSize: 12, color: neg(v), fontWeight: r._kind === 'sub' ? 600 : 400 }}>{Q(v)}</span>
      },
    })),
    {
      title: 'Total',
      key: 'total',
      align: 'right' as const,
      width: 150,
      render: (_: any, r: any) => {
        if (r._kind === 'hdr') return null
        const v = r.normalBalance === 'credit' ? -r.total : r.total
        return <span style={{ ...qStyle, fontSize: 12, fontWeight: 700, color: neg(v) ?? '#374151' }}>{Q(v)}</span>
      },
    },
  ]

  return (
    <Table
      dataSource={allRows}
      columns={cols}
      size="small"
      rowKey="key"
      pagination={false}
      scroll={{ x: 'max-content' }}
      onRow={(r: any) => ({
        style: {
          background: r._kind === 'hdr' ? '#f8fafc' : r._kind === 'sub' ? '#fafbfc' : undefined,
          borderTop: r._kind === 'sub' ? '1px solid #e5e7eb' : undefined,
        },
      })}
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
        {[
          { title: 'Ingresos consolidados', value: data.totalIngresos, color: '#2ea172' },
          { title: 'Gastos consolidados',   value: data.totalGastos,   color: '#e5484d' },
          { title: 'Utilidad consolidada',  value: data.utilidadConsolidada, color: posneg(data.utilidadConsolidada) },
          { title: 'ISR proyectado total',  value: data.isrConsolidado, color: '#d46b08' },
        ].map(s => (
          <Col span={6} key={s.title}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title={<span style={{ fontSize: 12 }}>{s.title}</span>} value={s.value}
                prefix="Q" precision={2} valueStyle={{ color: s.color, fontSize: 18, ...qStyle }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Table
        dataSource={data.empresas}
        rowKey="companyId"
        size="small"
        pagination={false}
        style={{ marginBottom: 20 }}
        columns={[
          { title: 'Empresa', dataIndex: 'legalName', render: (v, r: any) => <><span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span><div style={{ fontSize: 11, color: '#6b7280' }}>{r.regNombre} · NIT {r.taxId}</div></> },
          { title: 'Ingresos', dataIndex: 'ingresos', align: 'right', render: (v: number) => <span style={{ ...qStyle, fontSize: 12, color: '#2ea172' }}>{Q(v)}</span> },
          { title: 'Gastos',   dataIndex: 'gastos',   align: 'right', render: (v: number) => <span style={{ ...qStyle, fontSize: 12, color: '#e5484d' }}>{Q(v)}</span> },
          { title: 'Utilidad', dataIndex: 'utilidad', align: 'right', render: (v: number) => <span style={{ ...qStyle, fontSize: 12, fontWeight: 600, color: posneg(v) }}>{Q(v)}</span> },
          { title: 'Tasa ISR', dataIndex: 'tasaIsr',  align: 'center', render: (v: number) => <span style={{ fontSize: 12 }}>{(v * 100).toFixed(0)}%</span> },
          { title: 'ISR Proyectado', dataIndex: 'isrProyectado', align: 'right', render: (v: number) => <span style={{ ...qStyle, fontSize: 12, fontWeight: 600, color: '#d46b08' }}>{Q(v)}</span> },
          { title: 'Situación', dataIndex: 'situacion', align: 'center', render: (v: string) => <Tag color={situacionColor(v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</Tag> },
        ]}
      />

      {data.recomendaciones.length === 0 ? (
        <Alert type="success" icon={<CheckCircleOutlined />} showIcon
          message="Sin oportunidades de optimización fiscal identificadas para este período." />
      ) : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Text strong style={{ color: '#374151' }}>Recomendaciones de planificación fiscal</Text>
          {data.recomendaciones.map((r: Recomendacion, i) => (
            <Alert key={i}
              type={r.prioridad === 'alta' ? 'error' : r.prioridad === 'media' ? 'warning' : 'info'}
              icon={r.tipo === 'intercompany_billing' ? <RiseOutlined /> : <WarningOutlined />}
              showIcon style={{ borderRadius: 8 }}
              message={
                <Space>
                  <Tag color={prioridadColor(r.prioridad)} style={{ fontSize: 10 }}>Prioridad {r.prioridad}</Tag>
                  {r.ahorroEstimadoIsr && <Tag color="green" style={{ fontSize: 10 }}>Ahorro ISR estimado: {Q(r.ahorroEstimadoIsr)}</Tag>}
                </Space>
              }
              description={
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>{r.descripcion}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>⚠ {r.nota}</Text>
                </div>
              }
            />
          ))}
        </Space>
      )}
    </div>
  )
}

// ── Panel de Flujo de Caja ─────────────────────────────────────────────────
function PanelFlujoCaja({ data, companyNames }: { data: FlujoCaja; companyNames: Record<string, string> }) {
  const filas = [
    { label: 'Utilidad neta del período',          key: 'utilidad',    kind: 'acct' },
    { label: '(+/-) Variación Cuentas por Cobrar', key: 'arChange',    kind: 'acct' },
    { label: '(+/-) Variación Cuentas por Pagar',  key: 'apChange',    kind: 'acct' },
    { label: 'Flujo neto de operación',             key: 'operating',   kind: 'sub',  hdr: 'Actividades de Operación' },
    { label: 'Compra/venta de activos fijos',       key: 'faInvesting', kind: 'acct', hdr: 'Actividades de Inversión' },
    { label: 'Flujo neto de inversión',             key: 'investing',   kind: 'sub' },
    { label: '(+/-) Variación de Capital',          key: 'capChange',   kind: 'acct', hdr: 'Actividades de Financiamiento' },
    { label: 'Flujo neto de financiamiento',        key: 'financing',   kind: 'sub' },
    { label: 'FLUJO NETO TOTAL',                    key: 'netCash',     kind: 'grand' },
  ] as const

  // Insertar headers de sección
  const rows: any[] = []
  let lastHdr = ''
  for (const f of filas) {
    if ((f as any).hdr && (f as any).hdr !== lastHdr) {
      lastHdr = (f as any).hdr
      rows.push({ _kind: 'hdr', key: `hdr_${lastHdr}`, label: lastHdr })
    }
    rows.push({ ...f, _kind: f.kind })
  }

  const cols: any[] = [
    {
      title: 'Concepto', dataIndex: 'label', width: 280,
      render: (v: string, r: any) => {
        if (r._kind === 'hdr') return <span style={{ fontWeight: 700, fontSize: 12, color: '#374151' }}>{v}</span>
        return <span style={{ fontSize: 12, fontWeight: r._kind !== 'acct' ? 600 : 400, paddingLeft: r._kind === 'acct' ? 12 : 0 }}>{v}</span>
      },
    },
    ...data.porEmpresa.map(e => ({
      title: <span style={{ fontSize: 11 }}>{companyNames[e.companyId] ?? e.companyId.slice(0, 8)}</span>,
      key: e.companyId, align: 'right' as const, width: 150,
      render: (_: any, r: any) => {
        if (r._kind === 'hdr') return null
        const v = Number((e as any)[r.key] ?? 0)
        return <span style={{ ...qStyle, fontSize: 12, fontWeight: r._kind !== 'acct' ? 600 : 400, color: r._kind !== 'acct' ? posneg(v) : neg(v) }}>{Q(v)}</span>
      },
    })),
    {
      title: 'Consolidado', key: 'consolidado', align: 'right' as const, width: 160,
      render: (_: any, r: any) => {
        if (r._kind === 'hdr') return null
        const v = Number((data.consolidado as any)[r.key] ?? 0)
        return <span style={{ ...qStyle, fontSize: 12, fontWeight: 700, color: posneg(v) }}>{Q(v)}</span>
      },
    },
  ]

  return (
    <Table
      dataSource={rows}
      columns={cols}
      size="small"
      rowKey="key"
      pagination={false}
      scroll={{ x: 'max-content' }}
      onRow={(r: any) => ({
        style: {
          background: r._kind === 'hdr' ? '#f8fafc' : r._kind === 'grand' ? '#eff6ff' : r._kind === 'sub' ? '#fafbfc' : undefined,
          borderTop: r._kind === 'sub' || r._kind === 'grand' ? '1px solid #e5e7eb' : undefined,
          fontWeight: r._kind === 'grand' ? 700 : undefined,
        },
      })}
    />
  )
}

// ── Panel de Movimiento de Capital ─────────────────────────────────────────
function PanelMovimientoCapital({ data, companyNames }: { data: MovimientoCapital; companyNames: Record<string, string> }) {
  const filas = [
    { label: 'Saldo inicial de capital', key: 'saldoInicial',      kind: 'acct' },
    { label: '+ Utilidad del período',   key: 'utilidad',          kind: 'acct' },
    { label: '+ Movimientos de capital', key: 'movimientoCapital', kind: 'acct' },
    { label: 'SALDO FINAL DE CAPITAL',   key: 'saldoFinal',        kind: 'grand' },
  ]

  const cols: any[] = [
    {
      title: 'Concepto', dataIndex: 'label', width: 260,
      render: (v: string, r: any) => <span style={{ fontSize: 12, fontWeight: r.kind === 'grand' ? 700 : 400 }}>{v}</span>,
    },
    ...data.porEmpresa.map(e => ({
      title: <span style={{ fontSize: 11 }}>{companyNames[e.companyId] ?? e.companyId.slice(0, 8)}</span>,
      key: e.companyId, align: 'right' as const, width: 150,
      render: (_: any, r: any) => {
        const v = Number((e as any)[r.key] ?? 0)
        return <span style={{ ...qStyle, fontSize: 12, fontWeight: r.kind === 'grand' ? 700 : 400, color: neg(v) }}>{Q(v)}</span>
      },
    })),
    {
      title: 'Consolidado', key: 'consolidado', align: 'right' as const, width: 160,
      render: (_: any, r: any) => {
        const v = Number((data.consolidado as any)[r.key] ?? 0)
        return <span style={{ ...qStyle, fontSize: 12, fontWeight: 700, color: posneg(v) }}>{Q(v)}</span>
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
        onRow={(r: any) => ({
          style: {
            background: r.kind === 'grand' ? '#eff6ff' : undefined,
            borderTop: r.kind === 'grand' ? '2px solid #1B3A6B' : undefined,
          },
        })}
      />

      {data.porEmpresa.some(e => e.movimientos.length > 0) && (
        <div style={{ marginTop: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 12, color: '#374151' }}>
            Detalle de movimientos de capital por empresa
          </Text>
          <Row gutter={[16, 16]}>
            {data.porEmpresa.filter(e => e.movimientos.length > 0).map(e => (
              <Col key={e.companyId} xs={24} md={12}>
                <Card size="small" title={<span style={{ fontSize: 12 }}>{companyNames[e.companyId] ?? e.companyId}</span>} style={{ borderRadius: 8 }}>
                  <Table
                    dataSource={e.movimientos}
                    rowKey="code"
                    size="small"
                    pagination={false}
                    showHeader={false}
                    columns={[
                      { dataIndex: 'code', width: 80, render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> },
                      { dataIndex: 'name', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
                      { dataIndex: 'movimiento', align: 'right', render: (v: number) => <span style={{ ...qStyle, fontSize: 12, color: posneg(v) }}>{Q(v)}</span> },
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
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title={<span style={{ fontSize: 12 }}>Transacciones intercompany</span>}
              value={data.transacciones.length} valueStyle={{ color: '#374151', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title={<span style={{ fontSize: 12 }}>Total a eliminar</span>}
              value={data.totalEliminado} prefix="Q" precision={2}
              valueStyle={{ color: data.totalEliminado > 0 ? '#d46b08' : '#6b7280', fontSize: 18, ...qStyle }} />
          </Card>
        </Col>
      </Row>

      {data.transacciones.length === 0 ? (
        <Alert type="success" icon={<CheckCircleOutlined />} showIcon
          message={<span style={{ fontSize: 12 }}>{data.nota ?? 'No se encontraron transacciones intercompany en el período seleccionado.'}</span>} />
      ) : (
        <>
          <Alert type="warning" icon={<WarningOutlined />} showIcon style={{ marginBottom: 16, borderRadius: 8 }}
            message={<span style={{ fontSize: 12 }}>{data.nota}</span>} />
          <Table
            dataSource={data.transacciones}
            rowKey="invoiceNumber"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Fecha',    dataIndex: 'fecha',               width: 100, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
              { title: 'Número',   dataIndex: 'invoiceNumber',        width: 120, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
              { title: 'Emisor',   dataIndex: 'emisorNombre',         render: (v, r: any) => <span style={{ fontSize: 12 }}>{companyNames[r.emisorId] ?? v}</span> },
              { title: 'Receptor', dataIndex: 'receptorEmpresaNombre',render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
              { title: 'NIT',      dataIndex: 'receptorNit',          width: 110, render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> },
              { title: 'Moneda',   dataIndex: 'currency',             width: 80, align: 'center', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
              { title: 'Total',    dataIndex: 'total',                align: 'right', width: 140,
                render: (v: number) => <span style={{ ...qStyle, fontSize: 12, fontWeight: 600, color: '#d46b08' }}>{Q(v)}</span> },
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
  bgData:  ResultadoConsolidado    | null
  erData:  ResultadoConsolidado    | null
  pfData:  PlanificacionFiscal     | null
  fcData:  FlujoCaja               | null
  mcData:  MovimientoCapital       | null
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
    const rows = pfData.empresas.map(e => [e.legalName, e.taxId, e.regNombre, e.ingresos, e.gastos, e.utilidad, e.tasaIsr, e.isrProyectado, e.situacion])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Plan. Fiscal')
  }

  if (fcData) {
    const empHeaders = fcData.porEmpresa.map(e => companyNames[e.companyId] ?? e.companyId)
    const keys = ['utilidad','arChange','apChange','operating','faInvesting','investing','capChange','financing','netCash'] as const
    const labels: Record<string, string> = { utilidad:'Utilidad neta', arChange:'Var. CxC', apChange:'Var. CxP', operating:'Flujo operación', faInvesting:'Activos fijos', investing:'Flujo inversión', capChange:'Var. capital', financing:'Flujo financiamiento', netCash:'Flujo neto total' }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Concepto', ...empHeaders, 'Consolidado'],
      ...keys.map(k => [labels[k], ...fcData.porEmpresa.map(e => (e as any)[k] ?? 0), (fcData.consolidado as any)[k] ?? 0]),
    ]), 'Flujo de Caja')
  }

  if (mcData) {
    const empHeaders = mcData.porEmpresa.map(e => companyNames[e.companyId] ?? e.companyId)
    const keys = ['saldoInicial','utilidad','movimientoCapital','saldoFinal'] as const
    const labels: Record<string, string> = { saldoInicial:'Saldo inicial', utilidad:'Utilidad', movimientoCapital:'Movimientos capital', saldoFinal:'Saldo final' }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Concepto', ...empHeaders, 'Consolidado'],
      ...keys.map(k => [labels[k], ...mcData.porEmpresa.map(e => (e as any)[k] ?? 0), (mcData.consolidado as any)[k] ?? 0]),
    ]), 'Mov. Capital')
  }

  if (icData && icData.transacciones.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Fecha','Número','Emisor','Receptor','NIT','Moneda','Total'],
      ...icData.transacciones.map(t => [t.fecha, t.invoiceNumber, t.emisorNombre, t.receptorEmpresaNombre, t.receptorNit, t.currency, t.total]),
    ]), 'Intercompany')
  }

  XLSX.writeFile(wb, `Consolidacion_${periodo.replace(/\s/g, '_')}.xlsx`)
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ConsolidacionPage() {
  const navigate = useNavigate()
  const { companies } = useCompanyStore()
  const [maxCompanies, setMaxCompanies] = useState<number>(10)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode]               = useState<PeriodMode>('mes')
  const [pick, setPick]               = useState(dayjs().subtract(1, 'month'))
  const [activeTab, setActiveTab]     = useState('balance')

  const [bgData, setBgData] = useState<ResultadoConsolidado    | null>(null)
  const [erData, setErData] = useState<ResultadoConsolidado    | null>(null)
  const [pfData, setPfData] = useState<PlanificacionFiscal     | null>(null)
  const [fcData, setFcData] = useState<FlujoCaja               | null>(null)
  const [mcData, setMcData] = useState<MovimientoCapital       | null>(null)
  const [icData, setIcData] = useState<EliminacionIntercompany | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getBillingState()
      .then(s => setMaxCompanies(s.subscription?.maxCompanies ?? s.plans?.find(p => p.plan === s.tenant?.plan)?.maxCompanies ?? 10))
      .catch(() => {})
  }, [])

  const companyNames: Record<string, string> = Object.fromEntries(
    companies.map(c => [c.id, c.tradeName || c.legalName])
  )
  const activeCompanies = companies.filter(c => (c as any).isActive !== false)

  const toggleEmpresa = (id: string) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id)
        : prev.length >= maxCompanies ? prev
        : [...prev, id]
    )

  const range = computeRange(mode, pick)

  const generar = useCallback(async () => {
    if (selectedIds.length < 2) return
    const { startDate, endDate } = computeRange(mode, pick)
    const q: ConsolidacionQuery = { companyIds: selectedIds, startDate, endDate }
    setLoading(true); setError(null)
    try {
      const [bg, er, pf, fc, mc, ic] = await Promise.all([
        getBalanceGeneral(q), getEstadoResultados(q), getPlanificacionFiscal(q),
        getFlujoCaja(q), getMovimientoCapital(q), getEliminacionIntercompany(q),
      ])
      setBgData(bg); setErData(er); setPfData(pf); setFcData(fc); setMcData(mc); setIcData(ic)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al generar el reporte consolidado')
    } finally {
      setLoading(false)
    }
  }, [selectedIds, mode, pick])

  const hayResultados = bgData || erData || pfData

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 22, color: '#1faec2', lineHeight: 1, display: 'flex', alignItems: 'center' }}><ApartmentOutlined /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0a0a0a' }}>Consolidación Financiera</div>
            <Text type="secondary" style={{ fontSize: 12 }}>Reportes consolidados multi-empresa: balance, resultados, fiscal, flujo y capital</Text>
          </div>
        </Space>
      </div>

      {/* Selector de empresas y período */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 20 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={12}>
            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              Empresas a consolidar
              <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
                máx. {maxCompanies} según tu plan · seleccionadas: {selectedIds.length}
              </Text>
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeCompanies.map(c => {
                const checked  = selectedIds.includes(c.id)
                const disabled = !checked && selectedIds.length >= maxCompanies
                return (
                  <div key={c.id} onClick={() => !disabled && toggleEmpresa(c.id)}
                    style={{
                      border: `2px solid ${checked ? '#1faec2' : '#e5e7eb'}`,
                      borderRadius: 8, padding: '6px 12px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: checked ? '#e6f9fc' : '#fafbfc',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <Checkbox checked={checked} disabled={disabled} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{c.tradeName || c.legalName}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{(c as any).taxId ?? ''}</div>
                    </div>
                  </div>
                )
              })}
              {activeCompanies.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>No hay empresas activas en este tenant.</Text>}
            </div>
          </Col>

          <Col xs={24} md={8}>
            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Período</Text>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Segmented
                size="small"
                value={mode}
                onChange={v => setMode(v as PeriodMode)}
                options={[
                  { label: 'Mes',       value: 'mes' },
                  { label: 'Trimestre', value: 'trimestre' },
                  { label: 'Año',       value: 'año' },
                ]}
                style={{ width: '100%' }}
              />
              {mode === 'mes' && (
                <DatePicker picker="month" value={pick} onChange={v => v && setPick(v)}
                  format="MMMM YYYY" style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs())} />
              )}
              {mode === 'trimestre' && (
                <DatePicker picker="quarter" value={pick} onChange={v => v && setPick(v)}
                  format="[Q]Q YYYY" style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs())} />
              )}
              {mode === 'año' && (
                <DatePicker picker="year" value={pick} onChange={v => v && setPick(v)}
                  format="YYYY" style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs())} />
              )}
            </Space>
          </Col>

          <Col xs={24} md={4}>
            <Button type="primary" block size="middle" icon={<FileTextOutlined />}
              disabled={selectedIds.length < 2} loading={loading} onClick={generar}
              style={{ background: '#1faec2', borderColor: '#1faec2', marginTop: 22 }}>
              Generar
            </Button>
            {selectedIds.length < 2 && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>
                Mínimo 2 empresas
              </Text>
            )}
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16, borderRadius: 8 }} showIcon />}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>Consolidando datos…</div>
        </div>
      )}

      {/* Resultados */}
      {!loading && hayResultados && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Período: <strong>{range.label}</strong> ({range.startDate} → {range.endDate}) ·
              Empresas: <strong>{selectedIds.map(id => companyNames[id] ?? id).join(', ')}</strong>
            </Text>
            <Button icon={<DownloadOutlined />} size="small"
              onClick={() => exportarExcel({ periodo: range.label, companyNames, bgData, erData, pfData, fcData, mcData, icData })}>
              Exportar Excel
            </Button>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: 'balance',
              label: <span style={{ fontSize: 13 }}><BankOutlined /> Balance General</span>,
              children: bgData ? <TablaConsolidada data={bgData} companyNames={companyNames} /> : <Empty description="Sin datos" />,
            },
            {
              key: 'resultados',
              label: <span style={{ fontSize: 13 }}><RiseOutlined /> Estado de Resultados</span>,
              children: erData ? <TablaConsolidada data={erData} companyNames={companyNames} /> : <Empty description="Sin datos" />,
            },
            {
              key: 'fiscal',
              label: (
                <span style={{ fontSize: 13 }}>
                  <ExclamationCircleOutlined /> Planificación Fiscal
                  {pfData?.recomendaciones?.length
                    ? <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>{pfData.recomendaciones.length}</Tag>
                    : null}
                </span>
              ),
              children: pfData ? <PanelFiscal data={pfData} /> : <Empty description="Sin datos" />,
            },
            {
              key: 'flujo',
              label: <span style={{ fontSize: 13 }}><FundOutlined /> Flujo de Caja</span>,
              children: fcData ? <PanelFlujoCaja data={fcData} companyNames={companyNames} /> : <Empty description="Sin datos" />,
            },
            {
              key: 'capital',
              label: <span style={{ fontSize: 13 }}><BankOutlined /> Mov. Capital</span>,
              children: mcData ? <PanelMovimientoCapital data={mcData} companyNames={companyNames} /> : <Empty description="Sin datos" />,
            },
            {
              key: 'intercompany',
              label: (
                <span style={{ fontSize: 13 }}>
                  <SwapOutlined /> Intercompany
                  {icData && icData.transacciones.length > 0
                    ? <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>{icData.transacciones.length}</Tag>
                    : null}
                </span>
              ),
              children: icData ? <PanelIntercompany data={icData} companyNames={companyNames} /> : <Empty description="Sin datos" />,
            },
          ]} />
        </div>
      )}

      {!loading && !hayResultados && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <ApartmentOutlined style={{ fontSize: 56, display: 'block', marginBottom: 16 }} />
          <Text type="secondary" style={{ fontSize: 13 }}>Selecciona al menos 2 empresas y el período, luego haz clic en Generar.</Text>
        </div>
      )}
    </div>
  )
}
