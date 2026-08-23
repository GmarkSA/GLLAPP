import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Modal, Form,
  message, Tabs, Popover, Tooltip, Drawer, InputNumber, Divider, Badge, Select,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ShopOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, DollarOutlined, StopOutlined,
  SettingOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getBills, deleteBill, voidBill,
  BILL_STATUS_CONFIG, BILL_TYPE_CONFIG,
  type PurchaseInvoice, type BillStatus,
} from '../../../api/compras'
import { getPaymentTermLabel } from '../../../components/PaymentTermsSelect'
import ColumnConfigurator, {
  loadColConfig, saveColConfig,
  type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'
import ResponsiveTable from '../../../components/responsive/ResponsiveTable'
import MobileCard from '../../../components/responsive/MobileCard'

const { Title, Text } = Typography


// ── Formato moneda ────────────────────────────────────────────────────────────
const fmtGTQ = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

function FmtDual({ amount, currency, exchangeRate, bold }: {
  amount: number | string; currency?: string; exchangeRate?: number | string; bold?: boolean
}) {
  const n = Number(amount); const cur = currency ?? 'GTQ'; const fx = Number(exchangeRate ?? 1)
  if (cur !== 'GTQ' && fx > 1) {
    return (
      <div style={{ textAlign: 'right' }}>
        <Text style={{ fontSize: 13, color: '#374151', fontWeight: bold ? 700 : 600 }}>
          {cur} {n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </Text>
        <br />
        <Text style={{ fontSize: 11, color: '#6b7280' }}>
          Q {(n * fx).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </Text>
      </div>
    )
  }
  return <Text strong={bold} style={{ fontSize: 13 }}>{fmtGTQ(n)}</Text>
}

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_facturas_proveedor'

const ALL_COL_META: ColMeta[] = [
  { key: 'invoiceNumber',       label: '# Factura',              description: 'Número interno del sistema' },
  { key: 'vendorInvoiceNumber', label: '# Fact. Proveedor',      description: 'Número de la factura del proveedor' },
  { key: 'vendor',              label: 'Proveedor',              description: 'Nombre y NIT del proveedor' },
  { key: 'vendorTaxId',         label: 'NIT Proveedor',          description: 'Solo el NIT, en columna separada' },
  { key: 'invoiceType',         label: 'Tipo de Factura',        description: 'Bienes, Servicios, Combustible...' },
  { key: 'invoiceDate',         label: 'Fecha Factura' },
  { key: 'accountingDate',      label: 'Fecha Contabiliz.',      description: 'Período contable (si difiere de la fecha)' },
  { key: 'felSerie',            label: 'Serie FEL' },
  { key: 'felNumber',           label: 'Número SAT' },
  { key: 'currency',            label: 'Moneda' },
  { key: 'exchangeRate',        label: 'Tipo de Cambio' },
  { key: 'paymentTerms',        label: 'Términos de Pago' },
  { key: 'dueDate',             label: 'Fecha Vencimiento' },
  { key: 'subtotal',            label: 'Subtotal (Base)' },
  { key: 'taxAmount',           label: 'IVA' },
  { key: 'idpAmount',           label: 'IDP',                    description: 'Impuesto a Distribución de Petróleo' },
  { key: 'isrRetentionAmount',  label: 'Retención ISR' },
  { key: 'ivaRetentionAmount',  label: 'Retención IVA' },
  { key: 'total',               label: 'Total Factura' },
  { key: 'paidAmount',          label: 'Pagado' },
  { key: 'balance',             label: 'Saldo' },
  { key: 'status',              label: 'Estado' },
  { key: 'notes',               label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['invoiceNumber', 'vendor', 'invoiceType', 'invoiceDate', 'dueDate', 'total', 'balance', 'status'].includes(c.key),
  sortOrder: i + 1,
}))

const COL_WIDTHS: Record<string, number> = {
  invoiceNumber: 140, vendorInvoiceNumber: 140, vendor: 200,
  vendorTaxId: 120, invoiceType: 130, invoiceDate: 105,
  accountingDate: 115, felSerie: 80, felNumber: 100,
  currency: 75, exchangeRate: 90, paymentTerms: 130,
  dueDate: 105, subtotal: 110, taxAmount: 100,
  idpAmount: 90, isrRetentionAmount: 100, ivaRetentionAmount: 100,
  total: 130, paidAmount: 110, balance: 130,
  status: 110, notes: 160,
}

// ── Definiciones de columna por clave ────────────────────────────────────────
function buildColDef(
  key: string,
  navigate: (path: string) => void,
  openPay: (b: PurchaseInvoice) => void,
  setVoidTarget: (b: PurchaseInvoice) => void,
  setVoidModal: (v: boolean) => void,
  handleDelete: (id: string) => void,
): ColumnsType<PurchaseInvoice>[number] | null {
  const base = { key }
  switch (key) {
    case 'invoiceNumber':
      return { ...base, title: '# Factura', dataIndex: 'invoiceNumber', width: 140, fixed: 'left' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? ''),
        render: (v: string) => <Text strong style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text> }
    case 'vendorInvoiceNumber':
      return { ...base, title: '# Fact. Proveedor', dataIndex: 'vendorInvoiceNumber', width: 140,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.vendorInvoiceNumber ?? '').localeCompare(b.vendorInvoiceNumber ?? ''),
        render: (v: string) => v ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'vendor':
      return { ...base, title: 'Proveedor', width: 200,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.vendorName ?? '').localeCompare(b.vendorName ?? ''),
        render: (_: any, r: PurchaseInvoice) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.vendorName}</div>
            {r.vendorTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.vendorTaxId}</Text>}
          </div>
        ) }
    case 'vendorTaxId':
      return { ...base, title: 'NIT Proveedor', dataIndex: 'vendorTaxId', width: 120,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.vendorTaxId ?? '').localeCompare(b.vendorTaxId ?? ''),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'invoiceType':
      return { ...base, title: 'Tipo', dataIndex: 'invoiceType', width: 130,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.invoiceType ?? '').localeCompare(b.invoiceType ?? ''),
        render: (v: string) => {
          const cfg = BILL_TYPE_CONFIG[v as keyof typeof BILL_TYPE_CONFIG]
          return cfg ? <Tag style={{ fontSize: 11 }}>{cfg.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'invoiceDate':
      return { ...base, title: 'Fecha Factura', dataIndex: 'invoiceDate', width: 105,
        defaultSortOrder: 'descend' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.invoiceDate ?? '').localeCompare(b.invoiceDate ?? ''),
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'accountingDate':
      return { ...base, title: 'Fecha Contabiliz.', dataIndex: 'accountingDate', width: 115,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.accountingDate ?? a.invoiceDate ?? '').localeCompare(b.accountingDate ?? b.invoiceDate ?? ''),
        render: (v: string, r: PurchaseInvoice) => {
          const diff = v && r.invoiceDate && new Date(v).toDateString() !== new Date(r.invoiceDate as any).toDateString()
          return <span style={{ fontSize: 12, color: diff ? '#ff7f00' : undefined, fontWeight: diff ? 600 : undefined }}>
            {v ? dayjs(v).format('DD/MM/YYYY') : '—'}
          </span>
        } }
    case 'felSerie':
      return { ...base, title: 'Serie FEL', dataIndex: 'felSerie', width: 80,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.felSerie ?? '').localeCompare(b.felSerie ?? ''),
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'felNumber':
      return { ...base, title: 'No. SAT', dataIndex: 'felNumber', width: 100,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.felNumber ?? '').localeCompare(b.felNumber ?? ''),
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 75,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.currency ?? '').localeCompare(b.currency ?? ''),
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'exchangeRate':
      return { ...base, title: 'T/C', dataIndex: 'exchangeRate', width: 90, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) =>
          (r.currency && r.currency !== 'GTQ')
            ? <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{Number(v).toFixed(4)}</span>
            : <Text type="secondary">—</Text> }
    case 'paymentTerms':
      return { ...base, title: 'Términos Pago', dataIndex: 'paymentTerms', width: 130,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.paymentTerms ?? '').localeCompare(b.paymentTerms ?? ''),
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? getPaymentTermLabel(v) : '—'}</span> }
    case 'dueDate':
      return { ...base, title: 'Vence', dataIndex: 'dueDate', width: 105,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''),
        render: (v: string, r: PurchaseInvoice) => {
          if (!v) return <Text type="secondary">—</Text>
          const isOver = r.status === 'overdue'
          return <span style={{ fontSize: 12, color: isOver ? '#e5484d' : undefined, fontWeight: isOver ? 600 : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        } }
    case 'subtotal':
      return { ...base, title: 'Subtotal', dataIndex: 'subtotal', width: 110, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.subtotal) - Number(b.subtotal),
        render: (v: number, r: PurchaseInvoice) => <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} /> }
    case 'taxAmount':
      return { ...base, title: 'IVA', dataIndex: 'taxAmount', width: 100, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.taxAmount) - Number(b.taxAmount),
        render: (v: number, r: PurchaseInvoice) => <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} /> }
    case 'idpAmount':
      return { ...base, title: 'IDP', dataIndex: 'idpAmount', width: 90, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.idpAmount) - Number(b.idpAmount),
        render: (v: number) => Number(v) > 0 ? <span style={{ fontSize: 12, color: '#ff7f00' }}>{fmtGTQ(v)}</span> : <Text type="secondary">—</Text> }
    case 'isrRetentionAmount':
      return { ...base, title: 'Ret. ISR', dataIndex: 'isrRetentionAmount', width: 100, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.isrRetentionAmount) - Number(b.isrRetentionAmount),
        render: (v: number) => Number(v) > 0 ? <span style={{ fontSize: 12, color: '#ff7f00' }}>{fmtGTQ(v)}</span> : <Text type="secondary">—</Text> }
    case 'ivaRetentionAmount':
      return { ...base, title: 'Ret. IVA', dataIndex: 'ivaRetentionAmount', width: 100, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.ivaRetentionAmount) - Number(b.ivaRetentionAmount),
        render: (v: number) => Number(v) > 0 ? <span style={{ fontSize: 12, color: '#ff7f00' }}>{fmtGTQ(v)}</span> : <Text type="secondary">—</Text> }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 130, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.total) - Number(b.total),
        render: (v: number, r: PurchaseInvoice) => <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} bold /> }
    case 'paidAmount':
      return { ...base, title: 'Pagado', dataIndex: 'paidAmount', width: 110, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.paidAmount) - Number(b.paidAmount),
        render: (v: number, r: PurchaseInvoice) =>
          Number(v) > 0
            ? <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} />
            : <Text type="secondary">—</Text> }
    case 'balance':
      return { ...base, title: 'Saldo', dataIndex: 'balance', width: 130, align: 'right' as const,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => Number(a.balance) - Number(b.balance),
        render: (v: number, r: PurchaseInvoice) => {
          const isFx = r.currency && r.currency !== 'GTQ' && Number(r.exchangeRate) > 1
          if (isFx) return (
            <div style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: Number(v) > 0 ? '#374151' : '#2ea172' }}>
                {r.currency} {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <br />
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                Q {(Number(v) * Number(r.exchangeRate)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          )
          return <Text style={{ fontWeight: 700, color: Number(v) > 0 ? '#e5484d' : '#2ea172' }}>{fmtGTQ(v)}</Text>
        } }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 110,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.status ?? '').localeCompare(b.status ?? ''),
        render: (v: BillStatus) => {
          const cfg = BILL_STATUS_CONFIG[v]
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 160, ellipsis: true,
        sorter: (a: PurchaseInvoice, b: PurchaseInvoice) => (a.notes ?? '').localeCompare(b.notes ?? ''),
        render: (v: string) => v ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text> : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface FpAdFilters {
  filterVendor?: string
  filterVendorTaxId?: string
  filterInvoiceNumber?: string
  filterVendorInvoiceNumber?: string
  filterStatus?: string[]
  filterCurrency?: string[]
  filterInvoiceType?: string[]
  filterTotalMin?: number | null
  filterTotalMax?: number | null
  filterBalanceMin?: number | null
  filterBalanceMax?: number | null
}

const FP_EMPTY: FpAdFilters = {}

function applyFpFilters(data: PurchaseInvoice[], f: FpAdFilters): PurchaseInvoice[] {
  return data.filter(r => {
    if (f.filterVendor && !r.vendorName?.toLowerCase().includes(f.filterVendor.toLowerCase())) return false
    if (f.filterVendorTaxId && !r.vendorTaxId?.toLowerCase().includes(f.filterVendorTaxId.toLowerCase())) return false
    if (f.filterInvoiceNumber && !r.invoiceNumber?.toLowerCase().includes(f.filterInvoiceNumber.toLowerCase())) return false
    if (f.filterVendorInvoiceNumber && !r.vendorInvoiceNumber?.toLowerCase().includes(f.filterVendorInvoiceNumber.toLowerCase())) return false
    if (f.filterStatus?.length && !f.filterStatus.includes(r.status ?? '')) return false
    if (f.filterCurrency?.length && !f.filterCurrency.includes(r.currency ?? 'GTQ')) return false
    if (f.filterInvoiceType?.length && !f.filterInvoiceType.includes(r.invoiceType ?? '')) return false
    if (f.filterTotalMin != null && Number(r.total ?? 0) < f.filterTotalMin) return false
    if (f.filterTotalMax != null && Number(r.total ?? 0) > f.filterTotalMax) return false
    if (f.filterBalanceMin != null && Number(r.balance ?? 0) < f.filterBalanceMin) return false
    if (f.filterBalanceMax != null && Number(r.balance ?? 0) > f.filterBalanceMax) return false
    return true
  })
}

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: 'all',     label: 'Todos'        },
  { key: 'draft',   label: 'Borrador'     },
  { key: 'open',    label: 'Pendiente'    },
  { key: 'partial', label: 'Pago parcial' },
  { key: 'paid',    label: 'Pagada'       },
  { key: 'overdue', label: 'Vencida'      },
  { key: 'voided',  label: 'Anulada'      },
]

// ── Página principal ──────────────────────────────────────────────────────────
export default function FacturasProveedorPage() {
  const navigate = useNavigate()

  // Data state
  const [bills, setBills]             = useState<PurchaseInvoice[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(200)
  const [statusTab, setStatusTab]     = useState('all')

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Filtros avanzados
  const [fpFilters,    setFpFilters]    = useState<FpAdFilters>(FP_EMPTY)
  const [fpDraft,      setFpDraft]      = useState<FpAdFilters>(FP_EMPTY)
  const [fpFilterOpen, setFpFilterOpen] = useState(false)

  const fpActiveCount = useMemo(() =>
    Object.entries(fpFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [fpFilters])

  const filteredBills = useMemo(() => applyFpFilters(bills, fpFilters), [bills, fpFilters])

  // Void modal
  const [voidModal, setVoidModal]     = useState(false)
  const [voidTarget, setVoidTarget]   = useState<PurchaseInvoice | null>(null)
  const [voidReason, setVoidReason]   = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getBills(params)
      setBills(res.data ?? [])
      setTotal((res as any)?.meta?.total ?? res.total ?? 0)
    } catch {
      message.error('Error cargando facturas de proveedor')
      setBills([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, pageSize, debouncedSearch, statusTab])

  useEffect(() => { fetchBills() }, [fetchBills])

  const handleDelete = async (id: string) => {
    try { await deleteBill(id); message.success('Factura eliminada'); fetchBills() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    setVoidLoading(true)
    try {
      await voidBill(voidTarget.id, voidReason)
      message.success('Factura anulada')
      setVoidModal(false); setVoidReason(''); setVoidTarget(null)
      fetchBills()
    } catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo anular') }
    finally { setVoidLoading(false) }
  }

  const openFpFilters = () => { setFpDraft(fpFilters); setFpFilterOpen(true) }
  const applyFpFiltersHandler = () => { setFpFilters(fpDraft); setFpFilterOpen(false) }
  const clearFpFilters = () => { setFpDraft(FP_EMPTY); setFpFilters(FP_EMPTY) }

  const openPay = (bill: PurchaseInvoice) => {
    const payeeId = bill.isExpenseReimbursement && bill.employeeId ? bill.employeeId : bill.vendorId
    navigate(`/bancos/pagos-realizados/nuevo?vendorId=${payeeId}&invoiceId=${bill.id}`)
  }

  // ── Scroll horizontal dinámico según columnas visibles ──────────────────────
  const scrollX = useMemo(() => {
    const dataWidth = colConfig
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (COL_WIDTHS[c.key] ?? 120), 0)
    return dataWidth + 200 // +acciones (5 botones posibles)
  }, [colConfig])

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<PurchaseInvoice> = [
    // Columnas configuradas por el usuario
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key, navigate, openPay, setVoidTarget, setVoidModal, handleDelete))
      .filter((c): c is ColumnsType<PurchaseInvoice>[number] => c !== null),
    // Columna de acciones siempre al final
    {
      key: '_actions',
      title: 'Acciones',
      align: 'center' as const,
      width: 200,
      fixed: 'right' as const,
      render: (_: any, r: PurchaseInvoice) => {
        const isDraft  = r.status === 'draft'
        const isPaid   = r.status === 'paid'
        const isVoided = r.status === 'voided'
        return (
          <Space size={6}>
            <Tooltip title="Ver detalle">
              <Button size="small" icon={<EyeOutlined />}
                onClick={() => navigate(`/compras/facturas/${r.id}`)} />
            </Tooltip>
            {isDraft && (
              <Tooltip title="Editar">
                <Button size="small" icon={<EditOutlined />}
                  onClick={() => navigate(`/compras/facturas/${r.id}/editar`)} />
              </Tooltip>
            )}
            {!isPaid && !isVoided && (
              <Tooltip title="Ir a Pagos a Proveedores">
                <Button size="small" icon={<DollarOutlined />}
                  style={{ color: '#2ea172', borderColor: '#2ea172' }}
                  onClick={() => openPay(r)} />
              </Tooltip>
            )}
            {!isVoided && (
              <Tooltip title="Anular factura">
                <Button size="small" danger icon={<StopOutlined />}
                  onClick={() => { setVoidTarget(r); setVoidModal(true) }} />
              </Tooltip>
            )}
            <Tooltip title="Eliminar permanentemente">
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => handleDelete(r.id)} />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShopOutlined style={{ fontSize: 24, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Facturas de proveedor</Title>
            <Text type="secondary">Registro de facturas recibidas de proveedores</Text>
          </div>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/compras/facturas/nueva')}
          style={{ background: '#1faec2' }}
        >
          <span data-tour="compras-factura-nueva">Nueva factura proveedor</span>
        </Button>
      </div>

      {/* Filters + Tabs */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0, position: 'sticky', top: 60, zIndex: 5 }}
        bodyStyle={{ padding: '12px 16px 0' }}
      >
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space wrap style={{ paddingBottom: 8 }}>
              <Input
                placeholder="Buscar factura, proveedor..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 240 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                size="small"
              />
              <Badge count={fpActiveCount} size="small">
                <Button
                  size="small"
                  icon={<FilterOutlined />}
                  onClick={openFpFilters}
                  style={fpActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
                >
                  Filtros
                </Button>
              </Badge>
              {/* Botón configurador de columnas */}
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
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    style={{
                      border: colPopover ? '1px solid #1faec2' : undefined,
                      color:  colPopover ? '#1faec2' : undefined,
                    }}
                  >
                    Columnas
                  </Button>
                </Tooltip>
              </Popover>
            </Space>
          }
        />
      </Card>

      {/* Table */}
      <Card
        bordered={false}
        style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <ResponsiveTable
          columns={activeColumns}
          dataSource={filteredBills}
          showSorterTooltip={false}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: scrollX, y: 'calc(100vh - 312px)' }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/facturas/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            showTotal: (t) => `${t} facturas`,
            showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200'],
          }}
          locale={{ emptyText: 'Sin facturas de proveedor' }}
          mobileEmptyText="Sin facturas de proveedor"
          renderMobileCard={(r: PurchaseInvoice) => {
            const cfg = BILL_STATUS_CONFIG[r.status]
            const money = (v: number) =>
              r.currency && r.currency !== 'GTQ'
                ? `${r.currency} ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                : fmtGTQ(v)
            return (
              <MobileCard
                title={r.vendorName}
                subtitle={
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.invoiceNumber}{r.invoiceDate ? ` · ${dayjs(r.invoiceDate).format('DD/MM/YYYY')}` : ''}
                  </span>
                }
                amount={money(Number(r.total))}
                amountSub={Number(r.balance) > 0 ? `Saldo ${money(Number(r.balance))}` : undefined}
                status={cfg ? <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag> : <Tag>{r.status}</Tag>}
                onClick={() => navigate(`/compras/facturas/${r.id}`)}
              />
            )
          }}
        />
      </Card>

      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={360}
        open={fpFilterOpen}
        onClose={() => setFpFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearFpFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyFpFiltersHandler}>Aplicar</Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Proveedor</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="Nombre proveedor" size="small" value={fpDraft.filterVendor ?? ''} onChange={e => setFpDraft(d => ({ ...d, filterVendor: e.target.value || undefined }))} allowClear />
          <Input placeholder="NIT proveedor" size="small" value={fpDraft.filterVendorTaxId ?? ''} onChange={e => setFpDraft(d => ({ ...d, filterVendorTaxId: e.target.value || undefined }))} allowClear />
          <Input placeholder="# Factura interna" size="small" value={fpDraft.filterInvoiceNumber ?? ''} onChange={e => setFpDraft(d => ({ ...d, filterInvoiceNumber: e.target.value || undefined }))} allowClear />
          <Input placeholder="# Factura proveedor" size="small" value={fpDraft.filterVendorInvoiceNumber ?? ''} onChange={e => setFpDraft(d => ({ ...d, filterVendorInvoiceNumber: e.target.value || undefined }))} allowClear />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Clasificación</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Select
            mode="multiple" size="small" placeholder="Estado"
            value={fpDraft.filterStatus ?? []}
            onChange={v => setFpDraft(d => ({ ...d, filterStatus: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={Object.entries(BILL_STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            mode="multiple" size="small" placeholder="Tipo de factura"
            value={fpDraft.filterInvoiceType ?? []}
            onChange={v => setFpDraft(d => ({ ...d, filterInvoiceType: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={Object.entries(BILL_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            mode="multiple" size="small" placeholder="Moneda"
            value={fpDraft.filterCurrency ?? []}
            onChange={v => setFpDraft(d => ({ ...d, filterCurrency: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]}
          />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Total factura</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, marginBottom: 16 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={fpDraft.filterTotalMin ?? null} onChange={v => setFpDraft(d => ({ ...d, filterTotalMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={fpDraft.filterTotalMax ?? null} onChange={v => setFpDraft(d => ({ ...d, filterTotalMax: v ?? null }))} min={0} prefix="Q" />
        </div>
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Saldo</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={fpDraft.filterBalanceMin ?? null} onChange={v => setFpDraft(d => ({ ...d, filterBalanceMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={fpDraft.filterBalanceMax ?? null} onChange={v => setFpDraft(d => ({ ...d, filterBalanceMax: v ?? null }))} min={0} prefix="Q" />
        </div>
      </Drawer>

      {/* Void Modal */}
      <Modal
        title="Anular factura de proveedor"
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
