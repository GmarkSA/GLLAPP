import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Statistic, Row, Col, Modal, Form, DatePicker,
  message, Tabs, Popover, Tooltip, Drawer, InputNumber, Divider, Badge, Select,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, DollarOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
  CheckSquareOutlined, SettingOutlined, StopOutlined, DeleteOutlined, SyncOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../../components/ui/PageHeader'
import type { ColumnsType } from 'antd/es/table'
import type { RangePickerProps } from 'antd/es/date-picker'
import dayjs from 'dayjs'
import {
  getInvoices, deleteInvoice, voidInvoice, marcarEnviadasMasivo,
  syncInvoiceJEDates,
  INVOICE_STATUS_CONFIG, type Invoice, type InvoiceStatus,
} from '../../../api/facturas'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'
import ResponsiveTable from '../../../components/responsive/ResponsiveTable'
import MobileCard from '../../../components/responsive/MobileCard'

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
const dateSort = (a: Invoice, b: Invoice, field: keyof Invoice) =>
  ((a[field] ?? '') as string) < ((b[field] ?? '') as string) ? -1 : 1
const numSort  = (a: Invoice, b: Invoice, field: keyof Invoice) =>
  Number(a[field] ?? 0) - Number(b[field] ?? 0)

function buildColDef(
  key: string,
  openVoid: (inv: Invoice) => void,
  handleDelete: (inv: Invoice) => void,
  navigate: (path: string) => void,
): ColumnsType<Invoice>[number] | null {
  const base = { key, showSorterTooltip: false }
  switch (key) {
    case 'invoiceNumber':
      return { ...base, title: '# Factura', dataIndex: 'invoiceNumber', width: 120, fixed: 'left' as const,
        sorter: (a: Invoice, b: Invoice) => (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? ''),
        render: (v: string) => <Text strong style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text> }
    case 'customer':
      return { ...base, title: 'Cliente', width: 220,
        sorter: (a: Invoice, b: Invoice) => (a.customerName ?? '').localeCompare(b.customerName ?? ''),
        render: (_: any, r: Invoice) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.customerName}</div>
            {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.customerTaxId}</Text>}
          </div>
        ) }
    case 'customerTaxId':
      return { ...base, title: 'NIT Cliente', dataIndex: 'customerTaxId', width: 120,
        sorter: (a: Invoice, b: Invoice) => (a.customerTaxId ?? '').localeCompare(b.customerTaxId ?? ''),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'invoiceDate':
      return { ...base, title: 'Fecha Factura', dataIndex: 'invoiceDate', width: 110,
        sorter: (a: Invoice, b: Invoice) => dateSort(a, b, 'invoiceDate'),
        defaultSortOrder: 'descend' as const,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'accountingDate':
      return { ...base, title: 'Fecha Contabiliz.', dataIndex: 'accountingDate', width: 115,
        sorter: (a: Invoice, b: Invoice) => dateSort(a, b, 'accountingDate'),
        render: (v: string, r: Invoice) => {
          const diff = v && r.invoiceDate && new Date(v).toDateString() !== new Date(r.invoiceDate).toDateString()
          return <span style={{ fontSize: 12, color: diff ? '#ff7f00' : undefined, fontWeight: diff ? 600 : undefined }}>
            {v ? dayjs(v).format('DD/MM/YYYY') : '—'}
          </span>
        } }
    case 'felSerie':
      return { ...base, title: 'Serie FEL', dataIndex: 'felSerie', width: 80,
        sorter: (a: Invoice, b: Invoice) => (a.felSerie ?? '').localeCompare(b.felSerie ?? ''),
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'felNumero':
      return { ...base, title: 'No. SAT', dataIndex: 'felNumero', width: 100,
        sorter: (a: Invoice, b: Invoice) => (a.felNumero ?? '').localeCompare(b.felNumero ?? ''),
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
        sorter: (a: Invoice, b: Invoice) => dateSort(a, b, 'dueDate'),
        render: (v: string, r: Invoice) => {
          if (!v) return <Text type="secondary">—</Text>
          const isOver = r.status === 'overdue'
          return <span style={{ fontSize: 12, color: isOver ? '#e5484d' : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        } }
    case 'subtotal':
      return { ...base, title: 'Subtotal', dataIndex: 'subtotal', width: 120, align: 'right' as const,
        sorter: (a: Invoice, b: Invoice) => numSort(a, b, 'subtotal'),
        render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span> }
    case 'discountAmount':
      return { ...base, title: 'Descuento', dataIndex: 'discountAmount', width: 105, align: 'right' as const,
        sorter: (a: Invoice, b: Invoice) => numSort(a, b, 'discountAmount'),
        render: (v: number) => Number(v) > 0
          ? <span style={{ fontSize: 12, color: '#059669' }}>- {fmt(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'taxAmount':
      return { ...base, title: 'IVA', dataIndex: 'taxAmount', width: 105, align: 'right' as const,
        sorter: (a: Invoice, b: Invoice) => numSort(a, b, 'taxAmount'),
        render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span> }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 130, align: 'right' as const,
        sorter: (a: Invoice, b: Invoice) => numSort(a, b, 'total'),
        render: (v: number) => <Text strong style={{ fontSize: 13 }}>{fmt(v)}</Text> }
    case 'paidAmount':
      return { ...base, title: 'Pagado', dataIndex: 'paidAmount', width: 120, align: 'right' as const,
        sorter: (a: Invoice, b: Invoice) => numSort(a, b, 'paidAmount'),
        render: (v: number) => Number(v) > 0
          ? <span style={{ fontSize: 12, color: '#2ea172' }}>{fmt(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'balance':
      return { ...base, title: 'Saldo', dataIndex: 'balance', width: 120, align: 'right' as const,
        sorter: (a: Invoice, b: Invoice) => numSort(a, b, 'balance'),
        render: (v: number) => (
          <Text style={{ fontWeight: 700, fontSize: 13, color: Number(v) > 0 ? '#e5484d' : '#2ea172' }}>
            {fmt(v)}
          </Text>
        ) }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 105,
        sorter: (a: Invoice, b: Invoice) => (a.status ?? '').localeCompare(b.status ?? ''),
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

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface InvAdFilters {
  filterInvoiceNumber?: string
  filterCustomerName?: string
  filterCustomerTaxId?: string
  filterCurrency?: string[]
  filterTotalMin?: number | null
  filterTotalMax?: number | null
}
function applyInvFilters(data: Invoice[], f: InvAdFilters): Invoice[] {
  return data.filter(r => {
    if (f.filterInvoiceNumber && !String(r.invoiceNumber ?? '').toLowerCase().includes(f.filterInvoiceNumber.toLowerCase())) return false
    if (f.filterCustomerName  && !String(r.customerName  ?? '').toLowerCase().includes(f.filterCustomerName.toLowerCase()))  return false
    if (f.filterCustomerTaxId && !String(r.customerTaxId ?? '').toLowerCase().includes(f.filterCustomerTaxId.toLowerCase())) return false
    if (f.filterCurrency?.length && !f.filterCurrency.includes(r.currency)) return false
    if (f.filterTotalMin != null && Number(r.total) < f.filterTotalMin) return false
    if (f.filterTotalMax != null && Number(r.total) > f.filterTotalMax) return false
    return true
  })
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FacturasPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(200)
  const [statusTab, setStatusTab]       = useState('all')
  const [dateRange, setDateRange]       = useState<[string, string] | null>(null)

  // Row selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [bulkLoading, setBulkLoading]         = useState(false)
  const [syncJELoading, setSyncJELoading]     = useState(false)

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Filtros avanzados
  const [invFilters,    setInvFilters]    = useState<InvAdFilters>({})
  const [invDraft,      setInvDraft]      = useState<InvAdFilters>({})
  const [invFilterOpen, setInvFilterOpen] = useState(false)
  const invActiveCount = useMemo(() => Object.entries(invFilters).filter(([, v]) =>
    v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
  ).length, [invFilters])
  const openInvFilters  = () => { setInvDraft({ ...invFilters }); setInvFilterOpen(true) }
  const applyInvFilters2 = () => { setInvFilters({ ...invDraft }); setInvFilterOpen(false) }
  const clearInvFilters  = () => { setInvDraft({}); setInvFilters({}); setInvFilterOpen(false) }
  const filteredInvoices = useMemo(() => applyInvFilters(invoices, invFilters), [invoices, invFilters])

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
      const params: Record<string, any> = { page, limit: pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      if (dateRange) { params.fromDate = dateRange[0]; params.toDate = dateRange[1] }
      const res = await getInvoices(params)
      setInvoices(res.data ?? [])
      setTotal((res as any)?.meta?.total ?? res.total ?? 0)
    } catch {
      message.error('Error cargando facturas')
      setInvoices([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, pageSize, debouncedSearch, statusTab, dateRange])

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

  const handleSyncJEDates = async () => {
    setSyncJELoading(true)
    try {
      const res = await syncInvoiceJEDates()
      message.success(`Pólizas sincronizadas: ${res.updated} actualizadas, ${res.skipped} sin cambio.`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al sincronizar pólizas')
    } finally { setSyncJELoading(false) }
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
          <Space>
            <Button icon={<SyncOutlined />} loading={syncJELoading} onClick={handleSyncJEDates} title="Sincroniza la fecha de las pólizas contables con la fecha contable de cada factura">
              Sincronizar pólizas
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ventas/facturas/nueva')} style={{ background: '#1faec2' }}>
              Nueva factura
            </Button>
          </Space>
        }
      />

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total Facturado', value: stats.totalFacturado, icon: <DollarOutlined />,            color: '#1faec2', tabKey: 'all'     },
          { title: 'Pendiente',       value: stats.pendiente,       icon: <ClockCircleOutlined />,        color: '#ff7f00', tabKey: 'pending' },
          { title: 'Vencidas',        value: stats.vencidas,        icon: <ExclamationCircleOutlined />,  color: '#e5484d', tabKey: 'overdue' },
          { title: 'Cobradas',        value: stats.cobradas,        icon: <CheckCircleOutlined />,        color: '#2ea172', tabKey: 'paid'    },
        ].map(s => {
          const isActive = statusTab === s.tabKey
          return (
            <Col xs={12} md={6} key={s.title}>
              <Card
                hoverable
                bordered={false}
                onClick={() => { setStatusTab(s.tabKey); setPage(1) }}
                style={{
                  borderRadius: 10,
                  boxShadow: isActive ? `0 0 0 2px ${s.color}` : '0 1px 6px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <Statistic
                  title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                  value={s.value}
                  prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
                  formatter={(v) => fmt(Number(v))}
                  valueStyle={{ fontSize: 18, color: s.color }}
                />
              </Card>
            </Col>
          )
        })}
      </Row>

      {/* Filters */}
      {/* Tabs sticky: quedan visibles bajo el header al hacer scroll (marco estilo Zoho) */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0, position: 'sticky', top: 60, zIndex: 5 }} bodyStyle={{ padding: '12px 16px 0' }}>
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space wrap style={{ paddingBottom: 8 }}>
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
              <Badge count={invActiveCount} size="small" color="#1faec2" offset={[-4, 4]}>
                <Button size="small" icon={<FilterOutlined />} onClick={openInvFilters}
                  style={invActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}>
                  Filtros
                </Button>
              </Badge>
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
        <ResponsiveTable
          columns={activeColumns}
          dataSource={filteredInvoices}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: scrollX, y: 'calc(100vh - 372px)' }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (r) => ({ disabled: r.status === 'voided' || r.status === 'written_off' }),
          }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/ventas/facturas/${r.id}`) })}
          pagination={{ total, current: page, pageSize, onChange: (p, ps) => { setPage(p); setPageSize(ps) }, showTotal: (t) => `${t} facturas`, showSizeChanger: true, pageSizeOptions: ['100', '200', '500'] }}
          locale={{ emptyText: 'Sin facturas' }}
          mobileEmptyText="Sin facturas"
          renderMobileCard={(r: Invoice) => {
            const cfg = INVOICE_STATUS_CONFIG[r.status]
            return (
              <MobileCard
                title={r.customerName}
                subtitle={
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.invoiceNumber}{r.invoiceDate ? ` · ${dayjs(r.invoiceDate).format('DD/MM/YYYY')}` : ''}
                  </span>
                }
                amount={fmt(r.total)}
                amountSub={Number(r.balance) > 0 ? `Saldo ${fmt(r.balance)}` : undefined}
                status={cfg ? <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag> : <Tag>{r.status}</Tag>}
                onClick={() => navigate(`/ventas/facturas/${r.id}`)}
              />
            )
          }}
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

      {/* Drawer filtros avanzados */}
      <Drawer
        title={<Space><FilterOutlined style={{ color: '#1faec2' }} /><span>Filtros avanzados</span></Space>}
        open={invFilterOpen}
        onClose={() => setInvFilterOpen(false)}
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={clearInvFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyInvFilters2}>
              Aplicar{invActiveCount > 0 ? ` (${invActiveCount})` : ''}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Identificación</Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>N° Factura</div>
            <Input size="small" allowClear placeholder="FACT-00001..."
              value={invDraft.filterInvoiceNumber ?? ''}
              onChange={e => setInvDraft(d => ({ ...d, filterInvoiceNumber: e.target.value || undefined }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Cliente</div>
            <Input size="small" allowClear placeholder="Nombre del cliente..."
              value={invDraft.filterCustomerName ?? ''}
              onChange={e => setInvDraft(d => ({ ...d, filterCustomerName: e.target.value || undefined }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>NIT cliente</div>
            <Input size="small" allowClear placeholder="12345678..."
              value={invDraft.filterCustomerTaxId ?? ''}
              onChange={e => setInvDraft(d => ({ ...d, filterCustomerTaxId: e.target.value || undefined }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Clasificación</Text>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Moneda</div>
            <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todas"
              value={invDraft.filterCurrency ?? []}
              options={[{ value: 'GTQ', label: 'GTQ — Quetzal' }, { value: 'USD', label: 'USD — Dólar' }]}
              onChange={v => setInvDraft(d => ({ ...d, filterCurrency: v.length ? v : undefined }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Monto total</Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Desde</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} placeholder="0.00" addonBefore="Q"
              value={invDraft.filterTotalMin ?? null}
              onChange={v => setInvDraft(d => ({ ...d, filterTotalMin: v ?? null }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Hasta</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} placeholder="sin límite" addonBefore="Q"
              value={invDraft.filterTotalMax ?? null}
              onChange={v => setInvDraft(d => ({ ...d, filterTotalMax: v ?? null }))} />
          </div>
        </div>
      </Drawer>
    </div>
  )
}
