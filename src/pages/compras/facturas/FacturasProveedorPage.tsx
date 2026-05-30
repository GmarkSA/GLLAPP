import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Modal, Form, InputNumber, DatePicker, Select,
  message, Tabs, Popover, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ShopOutlined, MoreOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getBills, deleteBill, voidBill, recordBillPayment,
  BILL_STATUS_CONFIG, BILL_TYPE_CONFIG,
  type PurchaseInvoice, type BillStatus,
} from '../../../api/compras'
import { getPaymentTermLabel } from '../../../components/PaymentTermsSelect'
import ColumnConfigurator, {
  loadColConfig, saveColConfig,
  type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Title, Text } = Typography
const { Option } = Select

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
        <Text style={{ fontSize: 13, color: '#0369a1', fontWeight: bold ? 700 : 600 }}>
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
      return { ...base, title: '# Factura', dataIndex: 'invoiceNumber', width: 140,
        render: (v: string) => <Text strong style={{ color: '#1B3A6B', fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> }
    case 'vendorInvoiceNumber':
      return { ...base, title: '# Fact. Proveedor', dataIndex: 'vendorInvoiceNumber', width: 140,
        render: (v: string) => v ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'vendor':
      return { ...base, title: 'Proveedor', width: 200,
        render: (_: any, r: PurchaseInvoice) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.vendorName}</div>
            {r.vendorTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.vendorTaxId}</Text>}
          </div>
        ) }
    case 'vendorTaxId':
      return { ...base, title: 'NIT Proveedor', dataIndex: 'vendorTaxId', width: 120,
        render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</Text> }
    case 'invoiceType':
      return { ...base, title: 'Tipo', dataIndex: 'invoiceType', width: 130,
        render: (v: string) => {
          const cfg = BILL_TYPE_CONFIG[v as keyof typeof BILL_TYPE_CONFIG]
          return cfg ? <Tag style={{ fontSize: 11 }}>{cfg.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'invoiceDate':
      return { ...base, title: 'Fecha Factura', dataIndex: 'invoiceDate', width: 105,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'accountingDate':
      return { ...base, title: 'Fecha Contabiliz.', dataIndex: 'accountingDate', width: 115,
        render: (v: string, r: PurchaseInvoice) => {
          const diff = v && r.invoiceDate && new Date(v).toDateString() !== new Date(r.invoiceDate as any).toDateString()
          return <span style={{ fontSize: 12, color: diff ? '#d97706' : undefined, fontWeight: diff ? 600 : undefined }}>
            {v ? dayjs(v).format('DD/MM/YYYY') : '—'}
          </span>
        } }
    case 'felSerie':
      return { ...base, title: 'Serie FEL', dataIndex: 'felSerie', width: 80,
        render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v || '—'}</span> }
    case 'felNumber':
      return { ...base, title: 'No. SAT', dataIndex: 'felNumber', width: 100,
        render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v || '—'}</span> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 75,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'exchangeRate':
      return { ...base, title: 'T/C', dataIndex: 'exchangeRate', width: 90, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) =>
          (r.currency && r.currency !== 'GTQ')
            ? <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{Number(v).toFixed(4)}</span>
            : <Text type="secondary">—</Text> }
    case 'paymentTerms':
      return { ...base, title: 'Términos Pago', dataIndex: 'paymentTerms', width: 130,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? getPaymentTermLabel(v) : '—'}</span> }
    case 'dueDate':
      return { ...base, title: 'Vence', dataIndex: 'dueDate', width: 105,
        render: (v: string, r: PurchaseInvoice) => {
          if (!v) return <Text type="secondary">—</Text>
          const isOver = r.status === 'overdue'
          return <span style={{ fontSize: 12, color: isOver ? '#ff4d4f' : undefined, fontWeight: isOver ? 600 : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        } }
    case 'subtotal':
      return { ...base, title: 'Subtotal', dataIndex: 'subtotal', width: 110, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) => <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} /> }
    case 'taxAmount':
      return { ...base, title: 'IVA', dataIndex: 'taxAmount', width: 100, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) => <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} /> }
    case 'idpAmount':
      return { ...base, title: 'IDP', dataIndex: 'idpAmount', width: 90, align: 'right' as const,
        render: (v: number) => Number(v) > 0 ? <span style={{ fontSize: 12, color: '#d97706' }}>{fmtGTQ(v)}</span> : <Text type="secondary">—</Text> }
    case 'isrRetentionAmount':
      return { ...base, title: 'Ret. ISR', dataIndex: 'isrRetentionAmount', width: 100, align: 'right' as const,
        render: (v: number) => Number(v) > 0 ? <span style={{ fontSize: 12, color: '#7c3aed' }}>{fmtGTQ(v)}</span> : <Text type="secondary">—</Text> }
    case 'ivaRetentionAmount':
      return { ...base, title: 'Ret. IVA', dataIndex: 'ivaRetentionAmount', width: 100, align: 'right' as const,
        render: (v: number) => Number(v) > 0 ? <span style={{ fontSize: 12, color: '#7c3aed' }}>{fmtGTQ(v)}</span> : <Text type="secondary">—</Text> }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 130, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) => <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} bold /> }
    case 'paidAmount':
      return { ...base, title: 'Pagado', dataIndex: 'paidAmount', width: 110, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) =>
          Number(v) > 0
            ? <FmtDual amount={v} currency={r.currency} exchangeRate={r.exchangeRate} />
            : <Text type="secondary">—</Text> }
    case 'balance':
      return { ...base, title: 'Saldo', dataIndex: 'balance', width: 130, align: 'right' as const,
        render: (v: number, r: PurchaseInvoice) => {
          const isFx = r.currency && r.currency !== 'GTQ' && Number(r.exchangeRate) > 1
          if (isFx) return (
            <div style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: Number(v) > 0 ? '#0369a1' : '#52c41a' }}>
                {r.currency} {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <br />
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                Q {(Number(v) * Number(r.exchangeRate)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          )
          return <Text style={{ fontWeight: 700, color: Number(v) > 0 ? '#cf1322' : '#52c41a' }}>{fmtGTQ(v)}</Text>
        } }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 110,
        render: (v: BillStatus) => {
          const cfg = BILL_STATUS_CONFIG[v]
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 160, ellipsis: true,
        render: (v: string) => v ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text> : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Constantes ────────────────────────────────────────────────────────────────
const PAYMENT_MODES = [
  { value: 'cash',          label: 'Efectivo'               },
  { value: 'bank_transfer', label: 'Transferencia bancaria'  },
  { value: 'check',         label: 'Cheque'                  },
  { value: 'credit_card',   label: 'Tarjeta de crédito'     },
  { value: 'debit_card',    label: 'Tarjeta de débito'      },
]

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
  const [statusTab, setStatusTab]     = useState('all')

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Void modal
  const [voidModal, setVoidModal]     = useState(false)
  const [voidTarget, setVoidTarget]   = useState<PurchaseInvoice | null>(null)
  const [voidReason, setVoidReason]   = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  // Pay modal
  const [payModal, setPayModal]       = useState(false)
  const [payTarget, setPayTarget]     = useState<PurchaseInvoice | null>(null)
  const [payLoading, setPayLoading]   = useState(false)
  const [payForm]                     = Form.useForm()
  const [payExchangeRate, setPayExchangeRate] = useState<number>(1)
  const payAmount = Form.useWatch('amount', payForm) as number | undefined

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getBills(params)
      setBills(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando facturas de proveedor')
      setBills([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, statusTab])

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

  const handlePay = async () => {
    if (!payTarget) return
    try {
      const values = await payForm.validateFields()
      setPayLoading(true)
      const isFx = (payTarget.currency ?? 'GTQ') !== 'GTQ'
      await recordBillPayment(payTarget.id, {
        amount:        values.amount,
        currency:      payTarget.currency ?? 'GTQ',
        exchangeRate:  isFx ? payExchangeRate : 1,
        paymentDate:   values.paymentDate.format('YYYY-MM-DD'),
        mode:          values.mode,
        reference:     values.reference,
        bankAccountId: values.bankAccountId,
      })
      message.success('Pago registrado')
      setPayModal(false); payForm.resetFields(); setPayTarget(null)
      fetchBills()
    } catch (e: any) {
      if (e?.response) message.error(e?.response?.data?.message || 'No se pudo registrar el pago')
    } finally { setPayLoading(false) }
  }

  const openPay = (bill: PurchaseInvoice) => {
    setPayTarget(bill)
    const fx = Number(bill.exchangeRate ?? 1)
    setPayExchangeRate(fx > 1 ? fx : 1)
    payForm.setFieldsValue({ amount: bill.balance, paymentDate: dayjs(), mode: 'bank_transfer' })
    setPayModal(true)
  }

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
      title: '',
      width: 50,
      render: (_: any, r: PurchaseInvoice) => {
        const isDraft  = r.status === 'draft'
        const isPaid   = r.status === 'paid'
        const isVoided = r.status === 'voided'
        const items: any[] = [{ key: 'view', label: 'Ver' }]
        if (isDraft) items.push({ key: 'edit', label: 'Editar' })
        if (!isPaid && !isVoided) items.push({ key: 'pay', label: 'Registrar pago' })
        if (!isVoided) items.push({ key: 'void', label: 'Anular' })
        items.push({ type: 'divider' })
        items.push({ key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Eliminar</span> })
        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view')   navigate(`/compras/facturas/${r.id}`)
                if (key === 'edit')   navigate(`/compras/facturas/${r.id}/editar`)
                if (key === 'pay')    openPay(r)
                if (key === 'void')   { setVoidTarget(r); setVoidModal(true) }
                if (key === 'delete') handleDelete(r.id)
              },
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShopOutlined style={{ fontSize: 24, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Facturas de proveedor</Title>
            <Text type="secondary">Registro de facturas recibidas de proveedores</Text>
          </div>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/compras/facturas/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva factura proveedor
        </Button>
      </div>

      {/* Filters + Tabs */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0 }}
        bodyStyle={{ padding: '12px 16px 0' }}
      >
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space style={{ paddingBottom: 8 }}>
              <Input
                placeholder="Buscar factura, proveedor..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 240 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                size="small"
              />
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
                      border: colPopover ? '1px solid #1B3A6B' : undefined,
                      color:  colPopover ? '#1B3A6B' : undefined,
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
        <Table
          columns={activeColumns}
          dataSource={bills}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 'max-content' }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/facturas/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} facturas`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin facturas de proveedor' }}
        />
      </Card>

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

      {/* Pay Modal */}
      <Modal
        title={`Registrar pago — ${payTarget?.invoiceNumber}`}
        open={payModal}
        onCancel={() => { setPayModal(false); payForm.resetFields(); setPayTarget(null) }}
        onOk={handlePay}
        okText="Registrar pago"
        okButtonProps={{ loading: payLoading, style: { background: '#1B3A6B' } }}
        cancelText="Cancelar"
        width={480}
      >
        {payTarget && (() => {
          const isFx  = (payTarget.currency ?? 'GTQ') !== 'GTQ'
          const cur   = payTarget.currency ?? 'GTQ'
          const gtqEq = isFx ? Number(payTarget.balance) * payExchangeRate : Number(payTarget.balance)
          const amountGTQ = isFx && payAmount ? payAmount * payExchangeRate : undefined
          return (
            <>
              <div style={{ background: isFx ? '#eff6ff' : '#f0f5ff', border: `1px solid ${isFx ? '#bfdbfe' : '#d6e4ff'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Saldo pendiente:</Text>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 14, color: isFx ? '#0369a1' : '#1B3A6B' }}>
                      {isFx ? `${cur} ` : 'Q '}{Number(payTarget.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </Text>
                    {isFx && <><br /><Text style={{ fontSize: 11, color: '#6b7280' }}>Q {gtqEq.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (al tipo de cambio actual)</Text></>}
                  </div>
                </div>
              </div>
              <Form form={payForm} layout="vertical" size="small">
                <Form.Item name="amount" label={`Monto a pagar${isFx ? ` (${cur})` : ''}`} rules={[{ required: true, message: 'Ingresa el monto' }]}>
                  <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} prefix={isFx ? cur : 'Q'} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </Form.Item>
                {isFx && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <Form.Item label={`Tipo de cambio (${cur} → GTQ)`}>
                      <InputNumber style={{ width: '100%' }} value={payExchangeRate} min={0.000001} step={0.01} precision={6} onChange={v => setPayExchangeRate(Number(v ?? 1))} />
                    </Form.Item>
                    <Form.Item label="Equivalente en GTQ">
                      <div style={{ height: 32, padding: '4px 11px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                        <Text strong style={{ color: '#1B3A6B', fontSize: 13 }}>
                          Q {amountGTQ ? amountGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '—'}
                        </Text>
                      </div>
                    </Form.Item>
                  </div>
                )}
                {isFx && payExchangeRate !== Number(payTarget.exchangeRate ?? 1) && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#92400e' }}>
                    ⚠️ El tipo de cambio difiere del registrado en la factura ({Number(payTarget.exchangeRate ?? 1).toFixed(6)}). Se generará un asiento de <strong>diferencial cambiario</strong> automáticamente.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <Form.Item name="paymentDate" label="Fecha de pago" rules={[{ required: true, message: 'Selecciona la fecha' }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item name="mode" label="Forma de pago">
                    <Select placeholder="Selecciona...">
                      {PAYMENT_MODES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
                    </Select>
                  </Form.Item>
                </div>
                <Form.Item name="reference" label="Referencia / No. documento">
                  <Input placeholder="Número de transferencia, cheque..." />
                </Form.Item>
              </Form>
            </>
          )
        })()}
      </Modal>
    </div>
  )
}
