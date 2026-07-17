import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Statistic, Row, Col, Modal, Form, DatePicker,
  message, Tabs, Popover, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, DollarOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
  CheckSquareOutlined, SettingOutlined, StopOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../../components/ui/PageHeader'
import type { ColumnsType } from 'antd/es/table'
import type { RangePickerProps } from 'antd/es/date-picker'
import dayjs from 'dayjs'
import {
  getInvoices, deleteInvoice, voidInvoice, marcarEnviadasMasivo,
  INVOICE_STATUS_CONFIG, type Invoice, type InvoiceStatus,
} from '../../../api/facturas'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_facturas_venta'

const ALL_COL_META: ColMeta[] = [
  { key: 'invoiceNumber',  label: '# Factura',          description: 'Número interno del sistema' },
  { key: 'customer',       label: 'Cliente',             description: 'Nombre y NIT del cliente' },
  { key: 'customerTaxId',  label: 'NIT Cliente',         description: 'Solo el NIT, columna separada' },
  { key: 'invoiceDate',    label: 'Fecha Factura' },
  { key: 'accountingDate', label: 'Fecha Contabiliz.',   description: 'Período contable (si difiere)' },
  { key: 'felSerie',       label: 'Serie FEL' },
  { key: 'felNumero',      label: 'Número SAT' },
  { key: 'currency',       label: 'Moneda' },
  { key: 'exchangeRate',   label: 'Tipo de Cambio' },
  { key: 'dueDate',        label: 'Fecha Vencimiento' },
  { key: 'subtotal',       label: 'Subtotal (Base)' },
  { key: 'discountAmount', label: 'Descuento' },
  { key: 'taxAmount',      label: 'IVA' },
  { key: 'total',          label: 'Total' },
  { key: 'paidAmount',     label: 'Pagado' },
  { key: 'balance',        label: 'Saldo' },
  { key: 'status',         label: 'Estado' },
  { key: 'notes',          label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['invoiceNumber', 'customer', 'invoiceDate', 'dueDate', 'total', 'balance', 'status'].includes(c.key),
  sortOrder: i + 1,
}))

// Anchos de cada columna para calcular scroll.x dinámicamente
const COL_WIDTHS: Record<string, number> = {
  invoiceNumber: 120, customer: 220, customerTaxId: 120,
  invoiceDate: 110, accountingDate: 115, felSerie: 80,
  felNumero: 100, currency: 80, exchangeRate: 90,
  dueDate: 105, subtotal: 120, discountAmount: 105,
  taxAmount: 105, total: 130, paidAmount: 120,
  balance: 120, status: 105, notes: 160,
}

// ── Definiciones de columna ───────────────────────────────────────────────────
function buildColDef(
  key: string,
  openVoid: (inv: Invoice) => void,
  handleDelete: (inv: Invoice) => void,
  navigate: (path: string) => void,
): ColumnsType<Invoice>[number] | null {
  const base = { key }
  switch (key) {
    case 'invoiceNumber':
      return { ...base, title: '# Factura', dataIndex: 'invoiceNumber', width: 120, fixed: 'left' as const,
        render: (v: string) => <Text strong style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text> }
    case 'customer':
      return { ...base, title: 'Cliente', width: 220,
        render: (_: any, r: Invoice) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.customerName}</div>
            {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.customerTaxId}</Text>}
          </div>
        ) }
    case 'customerTaxId':
      return { ...base, title: 'NIT Cliente', dataIndex: 'customerTaxId', width: 120,
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'invoiceDate':
      return { ...base, title: 'Fecha Factura', dataIndex: 'invoiceDate', width: 110,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'accountingDate':
      return { ...base, title: 'Fecha Contabiliz.', dataIndex: 'accountingDate', width: 115,
        render: (v: string, r: Invoice) => {
          const diff = v && r.invoiceDate && new Date(v).toDateString() !== new Date(r.invoiceDate).toDateString()
          return <span style={{ fontSize: 12, color: diff ? '#ff7f00' : undefined, fontWeight: diff ? 600 : undefined }}>
            {v ? dayjs(v).format('DD/MM/YYYY') : '—'}
          </span>
        } }
    case 'felSerie':
      return { ...base, title: 'Serie FEL', dataIndex: 'felSerie', width: 80,
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'felNumero':
      return { ...base, title: 'No. SAT', dataIndex: 'felNumero', width: 100,
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'exchangeRate':
      return { ...base, title: 'T/C', dataIndex: 'exchangeRate', width: 90, align: 'right' as const,
        render: (v: number, r: Invoice) =>
          r.currency && r.currency !== 'GTQ'
            ? <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{Number(v).toFixed(4)}</span>
            : <Text type="secondary">—</Text> }
    case 'dueDate':
      return { ...base, title: 'Vence', dataIndex: 'dueDate', width: 105,
        render: (v: string, r: Invoice) => {
          if (!v) return <Text type="secondary">—</Text>
          const isOver = r.status === 'overdue'
          return <span style={{ fontSize: 12, color: isOver ? '#e5484d' : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        } }
    case 'subtotal':
      return { ...base, title: 'Subtotal', dataIndex: 'subtotal', width: 120, align: 'right' as const,
        render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span> }
    case 'discountAmount':
      return { ...base, title: 'Descuento', dataIndex: 'discountAmount', width: 105, align: 'right' as const,
        render: (v: number) => Number(v) > 0
          ? <span style={{ fontSize: 12, color: '#059669' }}>- {fmt(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'taxAmount':
      return { ...base, title: 'IVA', dataIndex: 'taxAmount', width: 105, align: 'right' as const,
        render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span> }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 130, align: 'right' as const,
        render: (v: number) => <Text strong style={{ fontSize: 13 }}>{fmt(v)}</Text> }
    case 'paidAmount':
      return { ...base, title: 'Pagado', dataIndex: 'paidAmount', width: 120, align: 'right' as const,
        render: (v: number) => Number(v) > 0
          ? <span style={{ fontSize: 12, color: '#2ea172' }}>{fmt(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'balance':
      return { ...base, title: 'Saldo', dataIndex: 'balance', width: 120, align: 'right' as const,
        render: (v: number) => (
          <Text style={{ fontWeight: 700, fontSize: 13, color: Number(v) > 0 ? '#e5484d' : '#2ea172' }}>
            {fmt(v)}
          </Text>
        ) }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 105,
        render: (v: InvoiceStatus) => {
          const cfg = INVOICE_STATUS_CONFIG[v]
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 160, ellipsis: true,
        render: (v: string) => v
          ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Status tabs ───────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: 'all',     label: 'Todos'        },
  { key: 'draft',   label: 'Borradores'   },
  { key: 'pending', label: 'Pendiente'    },
  { key: 'sent',    label: 'Emitidas'     },
  { key: 'partial', label: 'Pago parcial' },
  { key: 'paid',    label: 'Pagadas'      },
  { key: 'overdue', label: 'Vencidas'     },
  { key: 'voided',  label: 'Anuladas'     },
]

// ── Página principal ──────────────────────────────────────────────────────────
export default function FacturasPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [statusTab, setStatusTab]       = useState('all')
  const [dateRange, setDateRange]       = useState<[string, string] | null>(null)

  // Row selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [bulkLoading, setBulkLoading]         = useState(false)

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Void modal
  const [voidModal, setVoidModal]     = useState(false)
  const [voidTarget, setVoidTarget]   = useState<Invoice | null>(null)
  const [voidReason, setVoidReason]   = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      if (dateRange) { params.fromDate = dateRange[0]; params.toDate = dateRange[1] }
      const res = await getInvoices(params)
      setInvoices(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando facturas')
      setInvoices([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, statusTab, dateRange])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const stats = {
    totalFacturado: invoices.reduce((s, i) => s + Number(i.total), 0),
    pendiente:      invoices.filter(i => ['draft', 'sent', 'partial'].includes(i.status)).reduce((s, i) => s + Number(i.balance), 0),
    vencidas:       invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.balance), 0),
    cobradas:       invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
  }

  const handleDelete = (inv: Invoice) => {
    Modal.confirm({
      title: 'Eliminar factura',
      content: `¿Eliminar permanentemente la factura ${inv.invoiceNumber}? Esta acción no se puede deshacer.`,
      okText: 'Eliminar', okButtonProps: { danger: true }, cancelText: 'Cancelar',
      onOk: async () => {
        try { await deleteInvoice(inv.id); message.success('Factura eliminada'); fetchInvoices() }
        catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
      },
    })
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    setVoidLoading(true)
    try {
      await voidInvoice(voidTarget.id, voidReason)
      message.success('Factura anulada')
      setVoidModal(false); setVoidReason(''); setVoidTarget(null)
      fetchInvoices()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo anular')
    } finally { setVoidLoading(false) }
  }

  const openVoid = (inv: Invoice) => { setVoidTarget(inv); setVoidModal(true) }

  const handleBulkMarcarEnviadas = async () => {
    if (!selectedRowKeys.length) return
    setBulkLoading(true)
    try {
      const res = await marcarEnviadasMasivo(selectedRowKeys as string[])
      const errors = res.errors?.length ?? 0
      if (errors > 0) message.warning(`${res.updated} marcadas. ${errors} con error.`)
      else message.success(`${res.updated} factura(s) marcadas como enviadas.`)
      setSelectedRowKeys([])
      fetchInvoices()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al marcar')
    } finally { setBulkLoading(false) }
  }

  // ── Scroll horizontal dinámico según columnas visibles ──────────────────────
  const scrollX = useMemo(() => {
    const dataWidth = colConfig
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (COL_WIDTHS[c.key] ?? 120), 0)
    return dataWidth + 160 + 50 // +acciones +checkbox
  }, [colConfig])

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<Invoice> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key, openVoid, handleDelete, navigate))
      .filter((c): c is ColumnsType<Invoice>[number] => c !== null),
    {
      key: '_actions',
      title: 'Acciones',
      align: 'center' as const,
      width: 160,
      fixed: 'right' as const,
      render: (_: any, r: Invoice) => {
        const isPaid   = r.status === 'paid'
        const isVoided = r.status === 'voided'
        return (
          <Space size={6}>
            <Tooltip title="Ver detalle">
              <Button size="small" icon={<EyeOutlined />}
                onClick={() => navigate(`/ventas/facturas/${r.id}`)} />
            </Tooltip>
            {!isPaid && !isVoided && (
              <Tooltip title="Registrar pago">
                <Button size="small" icon={<DollarOutlined />}
                  onClick={() => navigate(`/ventas/facturas/${r.id}?accion=pago`)}
                  style={{ color: '#2ea172', borderColor: '#2ea172' }} />
              </Tooltip>
            )}
            {!isVoided && (
              <Tooltip title="Anular factura">
                <Button size="small" danger icon={<StopOutlined />}
                  onClick={() => openVoid(r)} />
              </Tooltip>
            )}
            <Tooltip title="Eliminar permanentemente">
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => handleDelete(r)} />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  const onDateChange: RangePickerProps['onChange'] = (_, strs) => {
    setDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        icon={<FileTextOutlined />}
        title="Facturas de venta"
        subtitle="Gestión de facturas emitidas a clientes"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ventas/facturas/nueva')} style={{ background: '#1faec2' }}>
            Nueva factura
          </Button>
        }
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total Facturado', value: stats.totalFacturado, icon: <DollarOutlined />,            color: '#1faec2' },
          { title: 'Pendiente',       value: stats.pendiente,       icon: <ClockCircleOutlined />,        color: '#ff7f00' },
          { title: 'Vencidas',        value: stats.vencidas,        icon: <ExclamationCircleOutlined />,  color: '#e5484d' },
          { title: 'Cobradas',        value: stats.cobradas,        icon: <CheckCircleOutlined />,        color: '#2ea172' },
        ].map(s => (
          <Col span={6} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                value={s.value}
                prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
                formatter={(v) => fmt(Number(v))}
                valueStyle={{ fontSize: 18, color: s.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0 }} bodyStyle={{ padding: '12px 16px 0' }}>
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space style={{ paddingBottom: 8 }}>
              <RangePicker format="YYYY-MM-DD" onChange={onDateChange} size="small" placeholder={['Desde', 'Hasta']} />
              <Input
                placeholder="Buscar factura, cliente..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 220 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                size="small"
              />
              <Popover
                open={colPopover}
                onOpenChange={setColPopover}
                trigger="click"
                placement="bottomRight"
                title={null}
                content={
                  <ColumnConfigurator
                    config={colConfig}
                    allColMeta={ALL_COL_META}
                    defaultConfig={DEFAULT_COL_CONFIG}
                    storageKey={STORAGE_KEY}
                    onChange={setColConfig}
                  />
                }
              >
                <Tooltip title="Configurar columnas">
                  <Button size="small" icon={<SettingOutlined />}
                    style={{ border: colPopover ? '1px solid #1faec2' : undefined, color: colPopover ? '#1faec2' : undefined }}>
                    Columnas
                  </Button>
                </Tooltip>
              </Popover>
            </Space>
          }
        />
      </Card>

      {/* Bulk action bar */}
      {selectedRowKeys.length > 0 && (
        <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8, padding: '8px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ color: '#1faec2' }}>{selectedRowKeys.length} factura(s) seleccionada(s)</Text>
          <Button type="primary" size="small" icon={<CheckSquareOutlined />} loading={bulkLoading} onClick={handleBulkMarcarEnviadas} style={{ background: '#2ea172', borderColor: '#2ea172' }}>
            Marcar como Enviadas
          </Button>
          <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>Deseleccionar</Button>
        </div>
      )}

      {/* Table */}
      <Card bordered={false} style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={activeColumns}
          dataSource={invoices}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: scrollX, y: 'calc(100vh - 340px)' }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (r) => ({ disabled: r.status === 'voided' || r.status === 'written_off' }),
          }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/ventas/facturas/${r.id}`) })}
          pagination={{ total, current: page, pageSize: 20, onChange: setPage, showTotal: (t) => `${t} facturas`, showSizeChanger: false }}
          locale={{ emptyText: 'Sin facturas' }}
        />
      </Card>

      {/* Void Modal */}
      <Modal
        title="Anular factura"
        open={voidModal}
        onCancel={() => { setVoidModal(false); setVoidReason(''); setVoidTarget(null) }}
        onOk={handleVoid}
        okText="Anular"
        okButtonProps={{ danger: true, loading: voidLoading, disabled: !voidReason.trim() }}
        cancelText="Cancelar"
      >
        <p>¿Anular la factura <strong>{voidTarget?.invoiceNumber}</strong>? Esta acción no se puede deshacer.</p>
        <Form layout="vertical">
          <Form.Item label="Motivo de anulación" required>
            <Input.TextArea rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Ingresa el motivo..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
