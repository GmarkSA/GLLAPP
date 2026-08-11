import { useState, useEffect, useCallback } from 'react'
import {
  Select, Table, Tag, Spin, Empty, Button, Typography, Statistic, Divider,
  Alert, Tooltip, message,
} from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
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

function MovimientosTable({ lineas }: { lineas: LineaPoliza[] }) {
  if (!lineas.length) {
    return <Alert type="info" message="Sin movimientos contables en el período" showIcon style={{ fontSize: 12 }} />
  }
  const totDebe  = lineas.reduce((s, l) => s + l.debe,  0)
  const totHaber = lineas.reduce((s, l) => s + l.haber, 0)
  return (
    <Table
      size="small"
      dataSource={lineas}
      rowKey={(_, i) => String(i)}
      pagination={false}
      scroll={{ y: 280 }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={3}>
            <Text strong>Total</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right">
            <Text strong style={{ color: '#e5484d' }}>{Q(totDebe)}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            <Text strong style={{ color: '#2ea172' }}>{Q(totHaber)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        { title: 'Fecha',       dataIndex: 'fecha',       width: 95,
          render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: 'Póliza',     dataIndex: 'codigoPoliza', width: 110 },
        { title: 'Descripción', key: 'desc', ellipsis: true,
          render: (_: any, r: LineaPoliza) => r.glosa || r.descripcion },
        { title: 'Debe',       dataIndex: 'debe',  width: 120, align: 'right',
          render: (v: number) => v > 0
            ? <Text style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>{Q(v)}</Text>
            : <Text type="secondary">—</Text> },
        { title: 'Haber',      dataIndex: 'haber', width: 120, align: 'right',
          render: (v: number) => v > 0
            ? <Text style={{ color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>{Q(v)}</Text>
            : <Text type="secondary">—</Text> },
      ]}
    />
  )
}

// ─── Paneles específicos por tipo ─────────────────────────────────────────────

function BancoPanel({ data }: { data: BancoEspecifico }) {
  const ba = data.bankAccount
  const r  = data.reconciliation
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Statistic title="Banco"        value={ba.bankName}       valueStyle={{ fontSize: 14 }} />
        <Statistic title="No. Cuenta"   value={ba.accountNumber}  valueStyle={{ fontSize: 14 }} />
        <Statistic title="Saldo Sistema" value={Q(ba.currentBalance)}
          valueStyle={{ fontSize: 14, color: '#1B3A6B' }} />
      </div>
      {r && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px' }}>
          <Text strong style={{ fontSize: 12 }}>Conciliación Bancaria — {MESES[r.month - 1]} {r.year}</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <Statistic title="Saldo Banco"   value={Q(r.saldoBanco)}   valueStyle={{ fontSize: 13 }} />
            <Statistic title="Saldo Sistema" value={Q(r.saldoSistema)} valueStyle={{ fontSize: 13 }} />
            <Statistic title="Diferencia"    value={Q(r.diferencia)}
              valueStyle={{ fontSize: 13, color: Math.abs(r.diferencia) < 0.01 ? '#2ea172' : '#e5484d' }} />
          </div>
          {r.notes && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>{r.notes}</Text>}
        </div>
      )}
      {!r && <Alert type="info" message="Sin conciliación registrada para este mes" showIcon style={{ fontSize: 12 }} />}
      <Table
        size="small"
        dataSource={data.transactions}
        rowKey={(_, i) => String(i)}
        pagination={false}
        scroll={{ y: 220 }}
        locale={{ emptyText: 'Sin movimientos bancarios en el período' }}
        columns={[
          { title: 'Fecha',       dataIndex: 'date',           width: 90,
            render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
          { title: 'Descripción', dataIndex: 'description',    ellipsis: true },
          { title: 'Ref',         dataIndex: 'reference',      width: 90, ellipsis: true },
          { title: 'Tipo',        dataIndex: 'type',           width: 80,
            render: (t: string) => <Tag style={{ fontSize: 11 }}>{t}</Tag> },
          { title: 'Monto',       dataIndex: 'amount',         width: 110, align: 'right',
            render: (v: number) => <span style={{ color: v >= 0 ? '#2ea172' : '#e5484d' }}>{Q(v)}</span> },
          { title: 'Saldo',       dataIndex: 'runningBalance', width: 110, align: 'right', render: Q },
        ]}
      />
    </div>
  )
}

function PartidaTable({ partidas, titulo }: { partidas: Array<any>; titulo: string }) {
  return (
    <Table
      size="small"
      dataSource={partidas}
      rowKey={(_, i) => String(i)}
      pagination={false}
      scroll={{ y: 260 }}
      locale={{ emptyText: 'Sin partidas abiertas' }}
      columns={[
        { title: 'Nombre',      dataIndex: 'nombre',      ellipsis: true },
        { title: titulo,        dataIndex: 'numero',      width: 120 },
        { title: 'Fecha',       dataIndex: 'fecha',       width: 90,
          render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '—' },
        { title: 'Vencimiento', dataIndex: 'vencimiento', width: 90,
          render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '—' },
        { title: 'Total',       dataIndex: 'total',       width: 110, align: 'right', render: Q },
        { title: 'Saldo',       dataIndex: 'saldo',       width: 110, align: 'right',
          render: (v: number) => <Text strong style={{ color: '#e5484d' }}>{Q(v)}</Text> },
      ]}
    />
  )
}

function InventarioPanel({ data }: { data: InventarioEspecifico }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Statistic title="Valor total inventario" value={Q(data.totalValor)}
          valueStyle={{ fontSize: 14, color: '#2ea172' }} />
      </div>
      <Table
        size="small"
        dataSource={data.articulos}
        rowKey="sku"
        pagination={false}
        scroll={{ y: 260 }}
        columns={[
          { title: 'SKU',         dataIndex: 'sku',           width: 90 },
          { title: 'Artículo',    dataIndex: 'name',          ellipsis: true },
          { title: 'Stock',       dataIndex: 'stock',         width: 80, align: 'right' },
          { title: 'Costo Prom.', dataIndex: 'costoPromedio', width: 110, align: 'right', render: Q },
          { title: 'Valor Total', dataIndex: 'valorTotal',    width: 110, align: 'right',
            render: (v: number) => <Text strong>{Q(v)}</Text> },
        ]}
      />
    </div>
  )
}

function ActivoFijoPanel({ data }: { data: ActivoFijoEspecifico }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Statistic title="Valor en libros total" value={Q(data.totalValorLibros)}
          valueStyle={{ fontSize: 14, color: '#1B3A6B' }} />
      </div>
      <Table
        size="small"
        dataSource={data.activos}
        rowKey="codigo"
        pagination={false}
        scroll={{ y: 260 }}
        columns={[
          { title: 'Código',       dataIndex: 'codigo',           width: 90 },
          { title: 'Activo',       dataIndex: 'name',             ellipsis: true },
          { title: 'Adquisición',  dataIndex: 'fechaAdquisicion', width: 100,
            render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '—' },
          { title: 'Costo Orig.',  dataIndex: 'costoOriginal',    width: 110, align: 'right', render: Q },
          { title: 'Dep. Acum.',   dataIndex: 'depAcumulada',     width: 110, align: 'right',
            render: (v: number) => <span style={{ color: '#e5484d' }}>{Q(v)}</span> },
          { title: 'Valor Libros', dataIndex: 'valorLibros',      width: 110, align: 'right',
            render: (v: number) => <Text strong style={{ color: '#1B3A6B' }}>{Q(v)}</Text> },
        ]}
      />
    </div>
  )
}

// ─── Panel de detalle de cuenta ──────────────────────────────────────────────

function DetallePanel({ detalle, mes, anio }: { detalle: DetalleResult; mes: number; anio: number }) {
  const { cuenta, integrationType, especifico, saldoFinal, lineas } = detalle
  const cfg = TYPE_LABEL[integrationType]

  const printUrl = `/reportes/integraciones/${anio}/${mes}/imprimir?accountId=${cuenta.id}`

  // Tipos que tienen su propia tabla específica
  const hasEspecifico = especifico !== null
  // Tipos que muestran movimientos del libro mayor como sección principal
  const showLineas = ['generico', 'resultado'].includes(integrationType) || !hasEspecifico

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header cuenta */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Tag color={cfg.color} style={{ marginBottom: 4 }}>{cfg.label}</Tag>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>
            {cuenta.code} — {cuenta.name}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>{cuenta.balanceType}</Text>
          <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>{TYPE_TITULO[integrationType]}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Statistic title="Saldo al corte" value={Q(saldoFinal)} valueStyle={{ fontSize: 14, color: '#1B3A6B' }} />
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => window.open(printUrl, '_blank', 'width=900,height=700')}
          >
            Imprimir
          </Button>
        </div>
      </div>

      <Divider style={{ margin: '0' }} />

      {/* Sección específica por tipo */}
      {hasEspecifico && (
        <div>
          {integrationType === 'banco' && <BancoPanel data={especifico as BancoEspecifico} />}
          {integrationType === 'cxc' && (
            <>
              <Statistic title="Saldo CxC al corte" value={Q((especifico as CxcEspecifico).total)}
                valueStyle={{ fontSize: 14, color: '#1faec2', marginBottom: 8 }} />
              <PartidaTable partidas={(especifico as CxcEspecifico).partidas} titulo="No. Factura" />
            </>
          )}
          {integrationType === 'cxp' && (
            <>
              <Statistic title="Saldo CxP al corte" value={Q((especifico as CxpEspecifico).total)}
                valueStyle={{ fontSize: 14, color: '#f59e0b', marginBottom: 8 }} />
              <PartidaTable partidas={(especifico as CxpEspecifico).partidas} titulo="No. Factura" />
            </>
          )}
          {integrationType === 'inventario'  && <InventarioPanel  data={especifico as InventarioEspecifico} />}
          {integrationType === 'activo_fijo' && <ActivoFijoPanel  data={especifico as ActivoFijoEspecifico} />}
        </div>
      )}

      {/* Movimientos del libro mayor — para generico/resultado o cuando no hay especifico */}
      {showLineas && (
        <div>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Movimientos del período — {MESES[mes - 1]} {anio}
          </Text>
          <MovimientosTable lineas={lineas} />
        </div>
      )}
    </div>
  )
}

// ─── Chip de cuenta (barra horizontal) ───────────────────────────────────────

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
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.01em' }}>{acc.code}</span>
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
  const [mes, setMes]         = useState(now.month() + 1)
  const [anio, setAnio]       = useState(now.year())
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<AccountIntegracion[]>([])
  const [selected, setSelected] = useState<AccountIntegracion | null>(null)
  const [detalle, setDetalle]   = useState<DetalleResult | null>(null)
  const [detLoading, setDetLoading] = useState(false)

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

  const anioOptions = Array.from({ length: 6 }, (_, i) => ({ value: now.year() - i, label: String(now.year() - i) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Integraciones Contables</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Cierre mensual — conciliación de saldos por cuenta
          </Text>
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
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {accounts.map(acc => (
              <AccountChip
                key={acc.id}
                acc={acc}
                isActive={selected?.id === acc.id}
                onClick={() => handleSelect(acc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel de detalle — ancho completo */}
      <div style={{ background: '#fff', border: '1px solid rgba(10,10,10,0.07)', borderRadius: 8, padding: 20, minHeight: 380 }}>
        {!selected && !loading && (
          <Empty description="Selecciona una cuenta para ver el detalle" style={{ marginTop: 60 }} />
        )}
        {selected && detLoading && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin tip="Cargando detalle..." /></div>
        )}
        {selected && !detLoading && detalle && (
          <DetallePanel detalle={detalle} mes={mes} anio={anio} />
        )}
      </div>
    </div>
  )
}
