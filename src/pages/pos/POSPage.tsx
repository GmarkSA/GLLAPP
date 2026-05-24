import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Input, Button, Badge, Tag, Modal, message, Select,
  Divider, InputNumber, Radio, Typography, Spin, Empty, Form,
} from 'antd'
import {
  SearchOutlined, PlusOutlined, MinusOutlined, DeleteOutlined,
  ShoppingCartOutlined, CheckCircleOutlined,
  ArrowLeftOutlined, ReloadOutlined, PrinterOutlined, UserAddOutlined,
  SettingOutlined, BankOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getProducts, type Product } from '../../api/inventario'
import { getCustomers, createCustomer, type Customer } from '../../api/contactos'
import { createPOSVenta, getUbicacion, type Ubicacion } from '../../api/expedientes'
import { getBankAccounts, addTransaction, type BankAccount } from '../../api/bancos'

const { Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem {
  product: Product
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
}

const IVA_RATE = 0.12
const CF_CUSTOMER: Customer = { id: 'consumidor-final', name: 'Consumidor Final' }

const PAYMENT_METHODS = [
  { value: 'efectivo',      label: '💵 Efectivo' },
  { value: 'tarjeta',       label: '💳 Tarjeta' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'mixto',         label: '🔀 Mixto' },
]

// ─── Bank config per POS ──────────────────────────────────────────────────────
interface POSBankConfig {
  efectivo?:      string   // bankAccountId
  tarjeta?:       string
  transferencia?: string
  mixto?:         string
}

function bankConfigKey(posId: string | null) {
  return `pos_bank_cfg_${posId ?? 'default'}`
}
function loadBankConfig(posId: string | null): POSBankConfig {
  try { return JSON.parse(localStorage.getItem(bankConfigKey(posId)) || '{}') } catch { return {} }
}
function saveBankConfig(posId: string | null, cfg: POSBankConfig) {
  localStorage.setItem(bankConfigKey(posId), JSON.stringify(cfg))
}

// ─── Bank Config Modal ────────────────────────────────────────────────────────
function BankConfigModal({ open, posId, accounts, onClose }: {
  open: boolean
  posId: string | null
  accounts: BankAccount[]
  onClose: () => void
}) {
  const [cfg, setCfg] = useState<POSBankConfig>({})

  useEffect(() => {
    if (open) setCfg(loadBankConfig(posId))
  }, [open, posId])

  const accountOptions = [
    { value: '', label: '— Sin vincular —' },
    ...accounts.map(a => ({
      value: a.id,
      label: `${a.type === 'petty_cash' ? '💵' : a.type === 'checking' ? '🏦' : a.type === 'credit_card' ? '💳' : '🏛️'} ${a.name}${a.currentBalance != null ? ` (Q ${Number(a.currentBalance).toLocaleString('es-GT', { minimumFractionDigits: 2 })})` : ''}`,
    })),
  ]

  const handleSave = () => {
    saveBankConfig(posId, cfg)
    message.success('Configuración de cuentas guardada')
    onClose()
  }

  const row = (label: string, icon: string, key: keyof POSBankConfig) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <div style={{ minWidth: 130, fontSize: 13 }}>{icon} {label}</div>
      <Select
        style={{ flex: 1 }} value={cfg[key] || ''} allowClear
        placeholder="Sin vincular (opcional)"
        onChange={v => setCfg(prev => ({ ...prev, [key]: v || undefined }))}
        options={accountOptions}
      />
    </div>
  )

  return (
    <Modal
      title={<><BankOutlined /> Cuentas bancarias del POS</>}
      open={open} onOk={handleSave} onCancel={onClose}
      okText="Guardar configuración" width={520}
      okButtonProps={{ style: { background: '#1B3A6B' } }}
    >
      <div style={{ background: '#f0f5ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#555' }}>
        <BankOutlined style={{ marginRight: 6 }} />
        Cada cobro registrará automáticamente un <strong>ingreso en la cuenta seleccionada</strong>.
        Si no vinculas una cuenta, la venta se procesa igual pero <strong>sin registro bancario</strong>.
      </div>
      {accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb' }}>
          <BankOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
          No hay cuentas bancarias registradas en el ERP.
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Crea cuentas en <strong>Bancos → Cuentas bancarias</strong>.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {row('Efectivo / Caja', '💵', 'efectivo')}
          {row('Tarjeta', '💳', 'tarjeta')}
          {row('Transferencia', '🏦', 'transferencia')}
          {row('Pago mixto', '🔀', 'mixto')}
        </div>
      )}
    </Modal>
  )
}

// ─── Helper: extract array from any API response shape ────────────────────────
function extractList(r: any): any[] {
  // After unwrap: plain array | { data: [...], total } | { items: [...] }
  if (Array.isArray(r))        return r
  if (Array.isArray(r?.data))  return r.data
  if (Array.isArray(r?.items)) return r.items
  return []
}

// ─── Quick Create Customer Modal ──────────────────────────────────────────────
function QuickCreateCustomerModal({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: (c: Customer) => void
}) {
  const [form]  = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) form.resetFields() }, [open, form])

  const handleSave = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)

      // Build payload — only include fields present in CreateCustomerDto
      // (forbidNonWhitelisted is ON in backend; no extra props allowed)
      const payload: any = {
        name:     v.name,
        type:     'individual',
        currency: 'GTQ',
      }
      // Only set taxId if provided — 'CF' is reserved for anonymous sales (not stored as customer)
      const nit = v.taxId?.trim()
      if (nit) payload.taxId = nit
      if (v.email?.trim()) payload.email = v.email.trim()
      if (v.phone?.trim()) payload.phone = v.phone.trim()

      const newCustomer: any = await createCustomer(payload)
      message.success(`Cliente "${newCustomer.name}" creado`)
      onCreated(newCustomer)
      onClose()
    } catch (err: any) {
      // NestJS may return message as string or string[]
      const msg = err?.response?.data?.message
      const text = Array.isArray(msg) ? msg.join(' · ') : (msg || 'Error al crear cliente')
      message.error(text)
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={<><UserAddOutlined /> Nuevo cliente</>}
      open={open} onOk={handleSave} onCancel={onClose}
      okText="Crear cliente" width={440}
      okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      destroyOnClose
    >
      <div style={{ background: '#f0f5ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1B3A6B' }}>
        El cliente quedará registrado en el <strong>maestro de clientes del ERP</strong> y disponible para futuras ventas.
      </div>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Nombre completo / Empresa" rules={[{ required: true, message: 'Requerido' }]}>
          <Input placeholder="Ej: Juan García / Ferretería Los Pinos" autoFocus />
        </Form.Item>
        <Form.Item name="taxId" label="NIT Guatemala"
          tooltip="Déjalo vacío si es consumidor final sin NIT. Usa 'CF' solo si el cliente lo solicita explícitamente.">
          <Input placeholder="Ej: 1234567-8  (vacío = sin NIT)" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="email" label="Correo electrónico" style={{ flex: 1 }}>
            <Input placeholder="correo@ejemplo.com" type="email" />
          </Form.Item>
          <Form.Item name="phone" label="Teléfono" style={{ flex: 1 }}>
            <Input placeholder="5555-1234" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const stock   = Number(product.stockOnHand ?? 0)
  const noStock = stock <= 0
  return (
    <div
      onClick={() => !noStock && onAdd()}
      style={{
        background: noStock ? '#fafafa' : '#fff',
        border: `1.5px solid ${noStock ? '#f0f0f0' : '#e8e8e8'}`,
        borderRadius: 10, padding: '12px 10px',
        cursor: noStock ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', opacity: noStock ? 0.55 : 1, userSelect: 'none',
      }}
      onMouseEnter={e => { if (!noStock) (e.currentTarget as HTMLDivElement).style.borderColor = '#1B3A6B' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = noStock ? '#f0f0f0' : '#e8e8e8' }}
    >
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: noStock ? '#f5f5f5' : '#f0f5ff', borderRadius: 8, marginBottom: 8, fontSize: 26,
      }}>
        {product.itemType === 'servicio' ? '🛠️' : '📦'}
      </div>
      {product.sku && (
        <div style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace', marginBottom: 2 }}>{product.sku}</div>
      )}
      <div style={{
        fontSize: 12, fontWeight: 600, color: '#1B3A6B', lineHeight: 1.3,
        marginBottom: 6, minHeight: 28, overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {product.name}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', marginBottom: 4 }}>
        Q {Number(product.salesPrice ?? 0).toFixed(2)}
      </div>
      <Badge
        count={noStock ? 'Sin stock' : `Stock: ${stock}`}
        style={{ background: noStock ? '#ff4d4f' : stock < 5 ? '#faad14' : '#52c41a', fontSize: 10 }}
      />
    </div>
  )
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────────
function CartRow({ item, onQty, onRemove }: {
  item: CartItem; onQty: (d: number) => void; onRemove: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1B3A6B', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.product.name}
        </div>
        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
          Q {Number(item.unitPrice).toFixed(2)} c/u
          {item.discount > 0 && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>-{item.discount}%</Tag>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Button size="small" type="text" icon={<MinusOutlined />} onClick={() => onQty(-1)} disabled={item.quantity <= 1} />
        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{item.quantity}</span>
        <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => onQty(1)} />
      </div>
      <div style={{ minWidth: 65, textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1B3A6B' }}>
        Q {item.lineTotal.toFixed(2)}
      </div>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </div>
  )
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────
function ReceiptModal({ open, data, onClose }: {
  open: boolean
  data: { invoiceNumber?: string; felUuid?: string; total: number; paymentMethod: string; customerName: string; items: CartItem[]; change?: number; received?: number } | null
  onClose: () => void
}) {
  if (!data) return null
  const now = new Date()
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={380} title={null} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '24px 28px', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <CheckCircleOutlined style={{ fontSize: 44, color: '#52c41a' }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>¡Venta completada!</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {now.toLocaleDateString('es-GT')} {now.toLocaleTimeString('es-GT')}
          </div>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        {data.invoiceNumber && (
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <Tag color="blue" style={{ fontSize: 13 }}>Factura: {data.invoiceNumber}</Tag>
          </div>
        )}
        {data.felUuid && (
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <Tag color="green" style={{ fontSize: 11 }}>FEL UUID: {data.felUuid.slice(0, 16)}...</Tag>
          </div>
        )}
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          <Text type="secondary">Cliente: </Text><strong>{data.customerName}</strong>
        </div>
        <div style={{ background: '#fafafa', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}>
          {data.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>{item.quantity}x {item.product.name}</span>
              <span>Q {item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Subtotal</span><span>Q {(data.total / 1.12).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>IVA (12%)</span><span>Q {(data.total - data.total / 1.12).toFixed(2)}</span>
          </div>
          <Divider style={{ margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
            <span>TOTAL</span>
            <span style={{ color: '#1B3A6B' }}>Q {data.total.toFixed(2)}</span>
          </div>
          {data.paymentMethod === 'efectivo' && data.received != null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#8c8c8c' }}>
                <span>Recibido</span><span>Q {Number(data.received).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52c41a', fontWeight: 700 }}>
                <span>Cambio</span><span>Q {Math.max(0, data.change ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<PrinterOutlined />} style={{ flex: 1 }} onClick={() => window.print()}>Imprimir</Button>
          <Button type="primary" style={{ flex: 1, background: '#1B3A6B' }} onClick={onClose}>Nueva venta</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main POS Page ────────────────────────────────────────────────────────────
export default function POSPage() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const posId        = searchParams.get('pos')

  const [products,      setProducts]      = useState<Product[]>([])
  const [loadingProds,  setLoadingProds]  = useState(false)
  const [search,        setSearch]        = useState('')
  const [cart,          setCart]          = useState<CartItem[]>([])

  // ── Customer state ─────────────────────────────────────────────────────────
  const [customer,         setCustomer]         = useState<Customer>(CF_CUSTOMER)
  const [customers,        setCustomers]         = useState<Customer[]>([])
  const [custSearch,       setCustSearch]        = useState('')
  const [searchingCust,    setSearchingCust]     = useState(false)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)

  // ── POS / payment state ────────────────────────────────────────────────────
  const [posInfo,        setPosInfo]        = useState<Ubicacion | null>(null)
  const [paymentMethod,  setPaymentMethod]  = useState<string>('efectivo')
  const [receivedAmt,    setReceivedAmt]    = useState<number | null>(null)
  const [processing,     setProcessing]     = useState(false)
  const [receiptData,    setReceiptData]    = useState<any>(null)
  const [receiptOpen,    setReceiptOpen]    = useState(false)
  const [clock,          setClock]          = useState(new Date())

  // ── Banking integration state ──────────────────────────────────────────────
  const [bankAccounts,   setBankAccounts]   = useState<BankAccount[]>([])
  const [bankConfig,     setBankConfig]     = useState<POSBankConfig>(() => loadBankConfig(posId))
  const [showBankConfig, setShowBankConfig] = useState(false)

  const searchRef = useRef<any>(null)

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load POS info
  useEffect(() => {
    if (posId) getUbicacion(posId).then(setPosInfo).catch(() => {})
  }, [posId])

  // Load bank accounts (for payment configuration)
  useEffect(() => {
    getBankAccounts({ status: 'active' })
      .then(r => setBankAccounts(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  // ── Load products ──────────────────────────────────────────────────────────
  const loadProducts = useCallback(async (q = '') => {
    setLoadingProds(true)
    try {
      const res = await getProducts({ search: q || undefined, limit: 80 })
      setProducts(extractList(res))
    } finally { setLoadingProds(false) }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  useEffect(() => {
    const t = setTimeout(() => loadProducts(search), 250)
    return () => clearTimeout(t)
  }, [search, loadProducts])

  // ── Load customers (initial + search) ─────────────────────────────────────
  const loadCustomers = useCallback(async (q = '') => {
    setSearchingCust(true)
    try {
      const res = await getCustomers({ search: q || undefined, limit: 30, page: 1 })
      setCustomers(extractList(res))
    } catch {
      setCustomers([])
    } finally { setSearchingCust(false) }
  }, [])

  // Load customers on mount
  useEffect(() => { loadCustomers() }, [loadCustomers])

  // Search customers with debounce
  useEffect(() => {
    const t = setTimeout(() => loadCustomers(custSearch), 250)
    return () => clearTimeout(t)
  }, [custSearch, loadCustomers])

  // Build Select options: CF always first, then ERP customers
  const customerOptions = [
    {
      value: CF_CUSTOMER.id,
      label: '👤 Consumidor Final',
      customer: CF_CUSTOMER,
    },
    ...customers.map(c => ({
      value: c.id!,
      label: `${c.name}${c.taxId && c.taxId !== 'CF' ? ` — NIT: ${c.taxId}` : ''}`,
      customer: c,
    })),
  ]

  // ── Cart operations ────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    const price = Number(product.salesPrice ?? 0)
    setCart(prev => {
      const idx = prev.findIndex(c => c.product.id === product.id)
      if (idx >= 0) {
        return prev.map((c, i) => i === idx
          ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice }
          : c)
      }
      return [...prev, { product, quantity: 1, unitPrice: price, discount: 0, lineTotal: price }]
    })
  }

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => prev.map((c, i) => {
      if (i !== idx) return c
      const qty = Math.max(1, c.quantity + delta)
      return { ...c, quantity: qty, lineTotal: qty * c.unitPrice * (1 - c.discount / 100) }
    }))
  }

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx))

  // ── Totals ─────────────────────────────────────────────────────────────────
  const grandTotal     = cart.reduce((s, c) => s + c.lineTotal, 0)
  const subtotalSinIva = grandTotal / (1 + IVA_RATE)
  const ivaTotal       = grandTotal - subtotalSinIva
  const change         = (receivedAmt ?? 0) - grandTotal

  // ── Checkout ───────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) { message.warning('El carrito está vacío'); return }
    if (paymentMethod === 'efectivo' && receivedAmt != null && receivedAmt < grandTotal) {
      message.error('Monto recibido insuficiente'); return
    }
    setProcessing(true)
    try {
      const items = cart.map(c => ({
        productId: c.product.id,
        description: c.product.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        discountPercent: c.discount,
        taxPercent: IVA_RATE * 100,
        lineTotal: Number(c.lineTotal.toFixed(2)),
      }))

      const result: any = await createPOSVenta({
        customerId: customer.id || 'consumidor-final',
        customerName: customer.name,
        items,
        subtotal: Number(subtotalSinIva.toFixed(2)),
        taxAmount: Number(ivaTotal.toFixed(2)),
        total: Number(grandTotal.toFixed(2)),
        paymentMethod,
        notes: posInfo ? `POS: ${posInfo.name}` : undefined,
        posId: posId ?? undefined,
      }).catch(() => null)

      message.success('Venta procesada exitosamente')

      // ── Register bank transaction (fire-and-forget, graceful) ──────────────
      const linkedAccountId = bankConfig[paymentMethod as keyof POSBankConfig]
      if (linkedAccountId) {
        const today = new Date().toISOString().split('T')[0]
        const invoiceRef = result?.invoiceNumber
        addTransaction(linkedAccountId, {
          transactionDate: today,
          description: `POS - ${customer.name}${invoiceRef ? ` - ${invoiceRef}` : ''}`,
          type: 'credit',
          amount: Number(grandTotal.toFixed(2)),
          reference: invoiceRef,
        }).catch(() => {})   // never block the POS on bank errors
      }

      setReceiptData({
        invoiceNumber: result?.invoiceNumber,
        felUuid: result?.felUuid,
        total: grandTotal,
        paymentMethod,
        customerName: customer.name,
        items: [...cart],
        received: receivedAmt,
        change,
      })
      setReceiptOpen(true)
      setCart([])
      setCustomer(CF_CUSTOMER)
      setCustSearch('')
      setReceivedAmt(null)
      setTimeout(() => searchRef.current?.focus(), 100)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al procesar venta')
    } finally { setProcessing(false) }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F10') { e.preventDefault(); handleCheckout() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f2f5', overflow: 'hidden' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52, background: '#1B3A6B', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button type="text" icon={<ArrowLeftOutlined />}
            style={{ color: '#fff' }} onClick={() => navigate(-1)}>
            Salir
          </Button>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>🛒 Terminal POS</span>
            {posInfo && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 8 }}>— {posInfo.name}</span>}
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'monospace' }}>
          {clock.toLocaleTimeString('es-GT')} · {clock.toLocaleDateString('es-GT')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            size="small" type="text"
            icon={<BankOutlined />}
            style={{
              color: Object.values(bankConfig).some(Boolean)
                ? '#60a5fa'        // blue = at least one account linked
                : 'rgba(255,255,255,0.45)',
            }}
            title={Object.values(bankConfig).some(Boolean)
              ? 'Cuentas bancarias vinculadas — clic para editar'
              : 'Vincular cuentas bancarias al POS'}
            onClick={() => setShowBankConfig(true)}
          />
          <Button size="small" type="text" icon={<ReloadOutlined />}
            style={{ color: 'rgba(255,255,255,0.7)' }}
            onClick={() => { loadProducts(search); loadCustomers(custSearch) }}
            title="Recargar catálogo y clientes" />
        </div>
      </div>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: Product catalog ────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 12px 12px 16px' }}>
          <Input
            ref={searchRef}
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Buscar artículo por nombre o SKU... (F2)"
            value={search} onChange={e => setSearch(e.target.value)}
            allowClear size="large" style={{ marginBottom: 10, borderRadius: 8 }}
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingProds ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <Spin size="large" />
              </div>
            ) : products.length === 0 ? (
              <Empty description="Sin artículos" style={{ marginTop: 60 }} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, paddingBottom: 16 }}>
                {products.map(p => (
                  <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', paddingTop: 6 }}>
            {products.length} artículo(s) · F2 = buscar · F10 = cobrar
          </div>
        </div>

        {/* ── RIGHT: Cart + Checkout ───────────────────────────────────────── */}
        <div style={{
          width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: '#fff', borderLeft: '1px solid #e8e8e8', overflow: 'hidden',
        }}>

          {/* Customer selector */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>CLIENTE</span>
              <Button
                type="link" size="small" icon={<UserAddOutlined />}
                style={{ padding: 0, fontSize: 11, height: 'auto' }}
                onClick={() => setShowCreateCustomer(true)}
              >
                Nuevo cliente
              </Button>
            </div>
            <Select
              showSearch
              filterOption={false}
              value={customer.id || CF_CUSTOMER.id}
              style={{ width: '100%' }}
              loading={searchingCust}
              placeholder="Consumidor Final"
              searchValue={custSearch}
              onSearch={v => setCustSearch(v)}
              onSelect={(_val: any, opt: any) => {
                setCustomer(opt.customer)
                setCustSearch('')
              }}
              notFoundContent={searchingCust ? <Spin size="small" /> : 'Sin resultados'}
              options={customerOptions}
              optionFilterProp="label"
            />
            {customer.id !== CF_CUSTOMER.id && (
              <div style={{ fontSize: 11, color: '#52c41a', marginTop: 4 }}>
                ✓ {customer.name}
                {(customer as any).taxId && (customer as any).taxId !== 'CF'
                  ? ` — NIT: ${(customer as any).taxId}` : ''}
                <Button type="link" size="small" style={{ fontSize: 11, padding: '0 0 0 8px', color: '#ff4d4f', height: 'auto' }}
                  onClick={() => { setCustomer(CF_CUSTOMER); setCustSearch('') }}>
                  ✕ Quitar
                </Button>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                <ShoppingCartOutlined style={{ fontSize: 40, marginBottom: 8, display: 'block' }} />
                Carrito vacío — selecciona un artículo
              </div>
            ) : (
              cart.map((item, idx) => (
                <CartRow key={item.product.id} item={item}
                  onQty={delta => updateQty(idx, delta)}
                  onRemove={() => removeFromCart(idx)} />
              ))
            )}
          </div>

          {/* Totals + Payment */}
          <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c', marginBottom: 3 }}>
              <span>Subtotal (sin IVA)</span><span>Q {subtotalSinIva.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
              <span>IVA (12%)</span><span>Q {ivaTotal.toFixed(2)}</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 20, fontWeight: 800, color: '#1B3A6B',
              background: '#f0f5ff', borderRadius: 8, padding: '8px 10px', marginBottom: 10,
            }}>
              <span>TOTAL</span><span>Q {grandTotal.toFixed(2)}</span>
            </div>

            {/* Payment method */}
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>FORMA DE PAGO</span>
              {(() => {
                const linkedId  = bankConfig[paymentMethod as keyof POSBankConfig]
                const linkedAcc = linkedId ? bankAccounts.find(a => a.id === linkedId) : null
                return linkedAcc ? (
                  <span style={{ fontSize: 10, color: '#52c41a' }}>
                    🏦 {linkedAcc.name}
                  </span>
                ) : bankAccounts.length > 0 ? (
                  <button
                    style={{ fontSize: 10, color: '#faad14', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setShowBankConfig(true)}
                  >
                    Sin cuenta vinculada — configurar
                  </button>
                ) : null
              })()}
            </div>
            <Radio.Group
              value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}
            >
              {PAYMENT_METHODS.map(m => (
                <Radio.Button key={m.value} value={m.value}
                  style={{ textAlign: 'center', fontSize: 12, borderRadius: 6 }}>
                  {m.label}
                </Radio.Button>
              ))}
            </Radio.Group>

            {/* Efectivo: amount + change */}
            {paymentMethod === 'efectivo' && (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>Recibido (Q)</div>
                    <InputNumber
                      style={{ width: '100%' }} min={0} step={10} prefix="Q"
                      placeholder="0.00" value={receivedAmt} onChange={v => setReceivedAmt(v)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>Cambio (Q)</div>
                    <div style={{
                      height: 32, lineHeight: '32px', textAlign: 'center', borderRadius: 6,
                      background: change >= 0 ? '#f6ffed' : '#fff1f0',
                      fontWeight: 700, fontSize: 15,
                      color: change >= 0 ? '#52c41a' : '#ff4d4f',
                      border: `1px solid ${change >= 0 ? '#b7eb8f' : '#ffa39e'}`,
                    }}>
                      Q {Math.max(0, change).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[20, 50, 100, 200, 500].map(amt => (
                    <Button key={amt} size="small" style={{ borderRadius: 6, fontSize: 11 }}
                      onClick={() => setReceivedAmt(amt)}>Q{amt}</Button>
                  ))}
                  <Button size="small" style={{ borderRadius: 6, fontSize: 11 }}
                    onClick={() => setReceivedAmt(Math.ceil(grandTotal / 10) * 10)}>
                    Exacto
                  </Button>
                </div>
              </>
            )}

            {/* COBRAR */}
            <Button
              type="primary" block size="large" loading={processing}
              disabled={cart.length === 0} onClick={handleCheckout}
              style={{
                background: cart.length > 0 ? '#1B3A6B' : undefined,
                height: 52, fontSize: 17, fontWeight: 700, borderRadius: 8, letterSpacing: 1,
              }}
              icon={<CheckCircleOutlined />}
            >
              COBRAR — Q {grandTotal.toFixed(2)}
            </Button>

            {cart.length > 0 && (
              <Button type="text" danger size="small" block style={{ marginTop: 6 }}
                onClick={() => setCart([])}>
                Limpiar carrito
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick create customer */}
      <QuickCreateCustomerModal
        open={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onCreated={newCustomer => {
          setCustomers(prev => [newCustomer, ...prev])
          setCustomer(newCustomer)
        }}
      />

      {/* Receipt */}
      <ReceiptModal open={receiptOpen} data={receiptData} onClose={() => setReceiptOpen(false)} />

      {/* Bank account configuration */}
      <BankConfigModal
        open={showBankConfig}
        posId={posId}
        accounts={bankAccounts}
        onClose={() => {
          setShowBankConfig(false)
          // Re-read config in case it was saved
          setBankConfig(loadBankConfig(posId))
        }}
      />
    </div>
  )
}
