import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Select, Table, Tag, Spin, Empty, Button, Typography, Divider,
  Alert, Tooltip, message,
} from 'antd'
import { PrinterOutlined, ArrowLeftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getCierreIntegraciones, getDetalleIntegracion,
} from '../../api/integraciones'
import type {
  AccountIntegracion, DetalleResult, IntegrationType,
  BancoEspecifico, CxcEspecifico, CxpEspecifico,
  InventarioEspecifico, ActivoFijoEspecifico, LineaPoliza,
} from '../../api/integraciones'

const { Title, Text } = Typography

const Q = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtDate = (v: string) => <span style={{ whiteSpace: 'nowrap' }}>{dayjs(v).format('DD/MM/YYYY')}</span>

const TYPE_LABEL: Record<IntegrationType, { label: string; color: string }> = {
  banco:       { label: 'Banco',        color: '#1B3A6B' },
  cxc:         { label: 'CxC',          color: '#1faec2' },
  cxp:         { label: 'CxP',          color: '#f59e0b' },
  inventario:  { label: 'Inventario',   color: '#2ea172' },
  activo_fijo: { label: 'Activos Fijos', color: '#6b7280' },
  resultado:   { label: 'Resultado',    color: '#8b5cf6' },
  generico:    { label: 'General',      color: '#9aa1ab' },
}

const TYPE_TITULO: Record<IntegrationType, string> = {
  banco:       'Conciliación Bancaria',
  cxc:         'Cuentas por Cobrar — Saldos al Corte',
  cxp:         'Cuentas por Pagar — Saldos al Corte',
  inventario:  'Valorización de Inventarios',
  activo_fijo: 'Registro de Activos Fijos',
  resultado:   'Estado de Resultados — Movimientos del Período',
  generico:    'Libro Mayor — Movimientos del Período',
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const now = dayjs()

// ─── Tabla de movimientos (lineas) ────────────────────────────────────────────

function MovimientosTable({ lineas, integrationType }: { lineas: LineaPoliza[]; integrationType?: IntegrationType }) {
  if (!lineas.length) {
    return <Alert type="info" message="Sin movimientos contables en el período" showIcon style={{ fontSize: 12 }} />
  }
  const totDebe  = lineas.reduce((s, l) => s + l.debe,  0)
  const totHaber = lineas.reduce((s, l) => s + l.haber, 0)
  const isRes = integrationType === 'resultado'
  const isAF  = integrationType === 'activo_fijo'

  const rDebe  = (v: number) => v > 0
    ? <span style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Q(v)}</span>
    : <Text type="secondary">—</Text>
  const rHaber = (v: number) => v > 0
    ? <span style={{ color: '#2ea172', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Q(v)}</span>
    : <Text type="secondary">—</Text>

  const cols = isAF ? [
    { title: 'Fecha',      dataIndex: 'fecha',        width: 100, render: (v: string) => fmtDate(v) },
    { title: 'No. Factura', key: 'fact',              width: 120,
      render: (_: any, r: LineaPoliza) => r.numeroFactura || r.referencia || r.codigoPoliza },
    { title: 'Proveedor',  key: 'prov',               width: 200, ellipsis: true,
      render: (_: any, r: LineaPoliza) => r.vendorName || r.descripcion },
    { title: 'Concepto',   key: 'concepto',           ellipsis: true,
      render: (_: any, r: LineaPoliza) => r.glosa || r.descripcion },
    { title: 'Debe',       dataIndex: 'debe',         width: 115, align: 'right' as const, render: rDebe },
    { title: 'Haber',      dataIndex: 'haber',        width: 115, align: 'right' as const, render: rHaber },
  ] : isRes ? [
    { title: 'Fecha',       dataIndex: 'fecha',        width: 100, render: (v: string) => fmtDate(v) },
    { title: 'No. Factura', key: 'fact',               width: 120,
      render: (_: any, r: LineaPoliza) => r.numeroFactura || r.referencia || r.codigoPoliza },
    { title: 'Proveedor',   key: 'prov',               ellipsis: true,
      render: (_: any, r: LineaPoliza) => r.vendorName || r.descripcion },
    { title: 'Serie',       dataIndex: 'serieFactura', width: 60 },
    { title: 'Debe',        dataIndex: 'debe',         width: 115, align: 'right' as const, render: rDebe },
    { title: 'Haber',       dataIndex: 'haber',        width: 115, align: 'right' as const, render: rHaber },
  ] : [
    { title: 'Fecha',       dataIndex: 'fecha',        width: 100, render: (v: string) => fmtDate(v) },
    { title: 'Póliza',      dataIndex: 'codigoPoliza', width: 110 },
    { title: 'Descripción', key: 'desc',               ellipsis: true,
      render: (_: any, r: LineaPoliza) => {
        const g = r.glosa; const d = r.descripcion
        if (g && d && g !== d)
          return <span>{g} <Text type="secondary" style={{ fontSize: 10 }}>· {d}</Text></span>
        return g || d
      } },
    { title: 'Debe',        dataIndex: 'debe',         width: 115, align: 'right' as const, render: rDebe },
    { title: 'Haber',       dataIndex: 'haber',        width: 115, align: 'right' as const, render: rHaber },
  ]

  const span = isAF ? 4 : isRes ? 4 : 3

  return (
    <Table
      size="small"
      dataSource={lineas}
      rowKey={(_, i) => String(i)}
      pagination={false}
      scroll={{ x: 'max-content' }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={span}><Text strong>Total</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={span} align="right">
            <Text strong style={{ color: '#e5484d', whiteSpace: 'nowrap' }}>{Q(totDebe)}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={span + 1} align="right">
            <Text strong style={{ color: '#2ea172', whiteSpace: 'nowrap' }}>{Q(totHaber)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={cols}
    />
  )
}

// ─── Paneles específicos por tipo ─────────────────────────────────────────────

function BancoPanel({ data, saldoGl, mes, anio }: { data: BancoEspecifico; saldoGl: number; mes: number; anio: number }) {
  const ba         = data.bankAccount
  const r          = data.reconciliation
  const saldoBanco = r ? Number(r.saldoBanco) : ba.currentBalance
  const fechaCierre = dayjs(`${anio}-${String(mes).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD')

  type TxnRow = BancoEspecifico['transactions'][number] & { __summary?: boolean }
  const rows: TxnRow[] = [
    ...data.transactions,
    { date: fechaCierre, description: ba.bankName, reference: ba.accountNumber,
      type: 'Monetaria', amount: saldoBanco, runningBalance: saldoBanco, __summary: true },
  ]

  return (
    <Table<TxnRow>
      size="small"
      dataSource={rows}
      rowKey={(_, i) => String(i)}
      pagination={false}
      scroll={{ x: 'max-content', ...(data.transactions.length > 0 ? { y: 260 } : {}) }}
      onRow={(r) => ({ style: r.__summary ? { background: '#eff6ff', borderTop: '2px solid #bfdbfe' } : {} })}
      columns={[
        { title: 'Fecha', dataIndex: 'date', width: 100,
          render: (d: string, r: TxnRow) => r.__summary
            ? <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#1B3A6B' }}>{dayjs(d).format('DD/MM/YYYY')}</span>
            : fmtDate(d) },
        { title: 'Descripción', dataIndex: 'description', ellipsis: true, minWidth: 200,
          render: (v: string, r: TxnRow) => r.__summary
            ? <span style={{ fontWeight: 700, color: '#1B3A6B' }}>{v}</span>
            : v },
        { title: 'Ref', dataIndex: 'reference', width: 100, ellipsis: true,
          render: (v: string, r: TxnRow) => r.__summary
            ? <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#1B3A6B' }}>{v}</span>
            : v },
        { title: 'Tipo', dataIndex: 'type', width: 75,
          render: (t: string, r: TxnRow) => r.__summary
            ? <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', background: '#dbeafe', border: 'none', color: '#1B3A6B' }}>{t}</Tag>
            : <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{t}</Tag> },
        { title: 'Monto', dataIndex: 'amount', width: 115, align: 'right' as const,
          render: (v: number, r: TxnRow) => r.__summary
            ? <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#1B3A6B' }}>{Q(v)}</span>
            : <span style={{ whiteSpace: 'nowrap', color: v >= 0 ? '#2ea172' : '#e5484d' }}>{Q(v)}</span> },
        { title: 'Saldo', dataIndex: 'runningBalance', width: 115, align: 'right' as const,
          render: (v: number, r: TxnRow) => r.__summary
            ? <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#1B3A6B' }}>{Q(v)}</span>
            : <span style={{ whiteSpace: 'nowrap' }}>{Q(v)}</span> },
      ]}
    />
  )
}

function PartidaTable({ partidas, tipo }: { partidas: Array<any>; tipo: 'cxc' | 'cxp' }) {
  const totSaldo = partidas.reduce((s: number, p: any) => s + (p.saldo ?? 0), 0)
  const totTotal = partidas.reduce((s: number, p: any) => s + (p.total ?? 0), 0)
  const colorSaldo = tipo === 'cxc' ? '#1faec2' : '#f59e0b'

  return (
    <Table
      size="small"
      dataSource={partidas}
      rowKey={(_, i) => String(i)}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'Sin partidas abiertas' }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={4}><Text strong>Total</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            <Text strong style={{ whiteSpace: 'nowrap' }}>{Q(totTotal)}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={5} align="right">
            <Text strong style={{ color: colorSaldo, whiteSpace: 'nowrap' }}>{Q(totSaldo)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        { title: '#', key: 'idx', width: 36, align: 'center' as const,
          render: (_: any, __: any, i: number) => <Text style={{ fontSize: 11, color: '#9aa1ab' }}>{i + 1}</Text> },
        { title: tipo === 'cxc' ? 'Cliente' : 'Proveedor', dataIndex: 'nombre', ellipsis: true, minWidth: 180 },
        { title: 'No. Factura', dataIndex: 'numero', width: 110 },
        { title: 'Fecha', dataIndex: 'fecha', width: 100,
          render: (d: string) => d ? fmtDate(d) : <Text type="secondary">—</Text> },
        { title: 'Total', dataIndex: 'total', width: 115, align: 'right' as const,
          render: (v: number) => <span style={{ whiteSpace: 'nowrap' }}>{Q(v ?? 0)}</span> },
        { title: 'Saldo', dataIndex: 'saldo', width: 115, align: 'right' as const,
          render: (v: number) => <Text strong style={{ color: colorSaldo, whiteSpace: 'nowrap' }}>{Q(v)}</Text> },
      ]}
    />
  )
}

function InventarioPanel({ data }: { data: InventarioEspecifico }) {
  return (
    <div>
      <div style={{ marginBottom: 8, padding: '6px 0' }}>
        <Text strong>Valor total inventario: </Text>
        <Text strong style={{ color: '#2ea172', fontSize: 14 }}>{Q(data.totalValor)}</Text>
      </div>
      <Table
        size="small"
        dataSource={data.articulos}
        rowKey="sku"
        pagination={false}
        scroll={{ x: 'max-content', y: 260 }}
        columns={[
          { title: 'SKU',         dataIndex: 'sku',           width: 90 },
          { title: 'Artículo',    dataIndex: 'name',          ellipsis: true, minWidth: 160 },
          { title: 'Stock',       dataIndex: 'stock',         width: 80,  align: 'right' as const },
          { title: 'Costo Prom.', dataIndex: 'costoPromedio', width: 115, align: 'right' as const,
            render: (v: number) => <span style={{ whiteSpace: 'nowrap' }}>{Q(v)}</span> },
          { title: 'Valor Total', dataIndex: 'valorTotal',    width: 115, align: 'right' as const,
            render: (v: number) => <Text strong style={{ whiteSpace: 'nowrap' }}>{Q(v)}</Text> },
        ]}
      />
    </div>
  )
}

function ActivoFijoPanel({ data }: { data: ActivoFijoEspecifico }) {
  return (
    <div>
      <div style={{ marginBottom: 8, padding: '6px 0' }}>
        <Text strong>Valor en libros total: </Text>
        <Text strong style={{ color: '#1B3A6B', fontSize: 14 }}>{Q(data.totalValorLibros)}</Text>
      </div>
      <Table
        size="small"
        dataSource={data.activos}
        rowKey="codigo"
        pagination={false}
        scroll={{ x: 'max-content', y: 260 }}
        columns={[
          { title: 'Código',       dataIndex: 'codigo',           width: 90 },
          { title: 'Activo',       dataIndex: 'name',             ellipsis: true, minWidth: 160 },
          { title: 'Adquisición',  dataIndex: 'fechaAdquisicion', width: 100,
            render: (d: string) => d ? fmtDate(d) : <Text type="secondary">—</Text> },
          { title: 'Costo Orig.',  dataIndex: 'costoOriginal',    width: 115, align: 'right' as const,
            render: (v: number) => <span style={{ whiteSpace: 'nowrap' }}>{Q(v)}</span> },
          { title: 'Dep. Acum.',   dataIndex: 'depAcumulada',     width: 115, align: 'right' as const,
            render: (v: number) => <span style={{ color: '#e5484d', whiteSpace: 'nowrap' }}>{Q(v)}</span> },
          { title: 'Valor Libros', dataIndex: 'valorLibros',      width: 115, align: 'right' as const,
            render: (v: number) => <Text strong style={{ color: '#1B3A6B', whiteSpace: 'nowrap' }}>{Q(v)}</Text> },
        ]}
      />
    </div>
  )
}

// ─── Panel de detalle de cuenta ──────────────────────────────────────────────

export function DetallePanel({ detalle, mes, anio }: { detalle: DetalleResult; mes: number; anio: number }) {
  const { cuenta, integrationType, especifico, saldoFinal, lineas } = detalle

  const printUrl = `/reportes/integraciones/${anio}/${mes}/imprimir?accountId=${cuenta.id}`

  const hasEspecifico = especifico !== null
  const showLineas    = ['generico', 'resultado'].includes(integrationType) || !hasEspecifico

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header cuenta */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>
            {cuenta.code} — {cuenta.name}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{TYPE_TITULO[integrationType]}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#9aa1ab' }}>Saldo al corte</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', whiteSpace: 'nowrap' }}>{Q(saldoFinal)}</div>
          </div>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => window.open(printUrl, '_blank', 'width=900,height=700')}
          >
            Imprimir
          </Button>
        </div>
      </div>

      <Divider style={{ margin: 0 }} />

      {/* Sección específica por tipo */}
      {hasEspecifico && (
        <div>
          {integrationType === 'banco' && <BancoPanel data={especifico as BancoEspecifico} saldoGl={saldoFinal} mes={mes} anio={anio} />}
          {integrationType === 'cxc' && (
            <PartidaTable partidas={(especifico as CxcEspecifico).partidas} tipo="cxc" />
          )}
          {integrationType === 'cxp' && (
            <PartidaTable partidas={(especifico as CxpEspecifico).partidas} tipo="cxp" />
          )}
          {integrationType === 'inventario'  && <InventarioPanel  data={especifico as InventarioEspecifico} />}
          {integrationType === 'activo_fijo' && <ActivoFijoPanel  data={especifico as ActivoFijoEspecifico} />}
        </div>
      )}

      {/* Movimientos del libro mayor */}
      {showLineas && (
        <div>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Movimientos del período — {MESES[mes - 1]} {anio}
          </Text>
          <MovimientosTable lineas={lineas} integrationType={integrationType} />
        </div>
      )}
    </div>
  )
}

// ─── Chip de cuenta ───────────────────────────────────────────────────────────

function AccountChip({
  acc, isActive, onClick,
}: { acc: AccountIntegracion; isActive: boolean; onClick: () => void }) {
  const cfg = TYPE_LABEL[acc.integrationType]
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0,
        cursor: 'pointer',
        padding: '6px 12px',
        borderRadius: 6,
        border: isActive ? `2px solid #1B3A6B` : '2px solid #e2e8f0',
        background: isActive ? '#eff6ff' : '#fff',
        transition: 'all 0.12s',
        minWidth: 130,
        maxWidth: 180,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0a' }}>{acc.code}</span>
        <Tag color={cfg.color} style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '16px' }}>{cfg.label}</Tag>
      </div>
      <div style={{ fontSize: 10, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
        {acc.name}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#1B3A6B' : '#374151' }}>
        {Q(acc.balance)}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function IntegracionesContablesPage() {
  const navigate = useNavigate()
  const chipsRef = useRef<HTMLDivElement>(null)
  const [mes, setMes]           = useState(now.month() + 1)
  const [anio, setAnio]         = useState(now.year())
  const [loading, setLoading]   = useState(false)
  const [accounts, setAccounts] = useState<AccountIntegracion[]>([])
  const [selected, setSelected] = useState<AccountIntegracion | null>(null)
  const [detalle, setDetalle]   = useState<DetalleResult | null>(null)
  const [detLoading, setDetLoading] = useState(false)

  const scrollChips = (dir: 'left' | 'right') => {
    if (chipsRef.current) chipsRef.current.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' })
  }

  const loadCierre = useCallback(async () => {
    setLoading(true)
    setSelected(null)
    setDetalle(null)
    try {
      const res = await getCierreIntegraciones(mes, anio)
      setAccounts(res.accounts)
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al cargar integraciones')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [mes, anio])

  useEffect(() => { loadCierre() }, [loadCierre])

  const handleSelect = async (acc: AccountIntegracion) => {
    setSelected(acc)
    setDetalle(null)
    setDetLoading(true)
    try {
      const res = await getDetalleIntegracion(acc.id, mes, anio)
      setDetalle(res)
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al cargar detalle de cuenta')
      setDetalle(null)
    } finally {
      setDetLoading(false)
    }
  }

  const printAll = () => {
    const ids = accounts.map(a => a.id).join(',')
    window.open(`/reportes/integraciones/${anio}/${mes}/imprimir?todos=1&ids=${ids}`, '_blank', 'width=900,height=700')
  }

  const anioOptions = Array.from({ length: 7 }, (_, i) => ({ value: now.year() - i, label: String(now.year() - i) }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            size="small"
            type="text"
            onClick={() => navigate('/reportes')}
            style={{ color: '#6b7280' }}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Integraciones Contables</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cierre mensual — conciliación de saldos por cuenta
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select
            value={mes}
            onChange={setMes}
            style={{ width: 120 }}
            size="small"
            options={MESES.map((m, i) => ({ value: i + 1, label: m }))}
          />
          <Select
            value={anio}
            onChange={setAnio}
            style={{ width: 80 }}
            size="small"
            options={anioOptions}
          />
          <Tooltip title="Imprimir paquete completo de integraciones">
            <Button
              icon={<PrinterOutlined />}
              size="small"
              type="primary"
              style={{ background: '#1B3A6B' }}
              disabled={accounts.length === 0}
              onClick={printAll}
            >
              Imprimir todo
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Barra horizontal de cuentas */}
      <div style={{ background: '#fff', border: '1px solid rgba(10,10,10,0.07)', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12, flexShrink: 0 }}>
            Cuentas con saldo — {MESES[mes - 1]} {anio}
          </Text>
          {!loading && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}
            </Text>
          )}
        </div>
        {loading ? (
          <div style={{ padding: '8px 0' }}><Spin size="small" /></div>
        ) : accounts.length === 0 ? (
          <Empty description="Sin cuentas con saldo" style={{ padding: 12 }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              icon={<LeftOutlined />}
              size="small"
              type="text"
              onClick={() => scrollChips('left')}
              style={{ flexShrink: 0, color: '#9aa1ab' }}
            />
            <div ref={chipsRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, flex: 1, scrollbarWidth: 'none' }}>
              {accounts.map(acc => (
                <AccountChip
                  key={acc.id}
                  acc={acc}
                  isActive={selected?.id === acc.id}
                  onClick={() => handleSelect(acc)}
                />
              ))}
            </div>
            <Button
              icon={<RightOutlined />}
              size="small"
              type="text"
              onClick={() => scrollChips('right')}
              style={{ flexShrink: 0, color: '#9aa1ab' }}
            />
          </div>
        )}
      </div>

      {/* Panel de detalle */}
      <div style={{ background: '#fff', border: '1px solid rgba(10,10,10,0.07)', borderRadius: 8, padding: '20px 24px', minHeight: 380 }}>
        {!selected && !loading && (
          <Empty description="Selecciona una cuenta para ver el detalle" style={{ marginTop: 60 }} />
        )}
        {selected && detLoading && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin /></div>
        )}
        {selected && !detLoading && detalle && (
          <DetallePanel detalle={detalle} mes={mes} anio={anio} />
        )}
      </div>
    </div>
  )
}
