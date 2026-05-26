import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, InputNumber, Input, Button,
  Card, Breadcrumb, Typography, Spin, Divider, message,
  Tag, Alert, Space,
} from 'antd'
import {
  SaveOutlined, CheckOutlined, HomeOutlined, ThunderboltOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createBill, updateBill, getBill, approveBill, getVendors,
  type BillType, type PaymentTerms,
  BILL_TYPE_CONFIG, PAYMENT_TERMS_CONFIG, IDP_RATES,
} from '../../../api/compras'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getAccounts, type Account } from '../../../api/catalogo'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'

const { Text } = Typography

const fmt = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Calcula ISR progresivo por tramos (igual que la vista previa de configuración fiscal).
 *  tiers deben tener upTo (null = sin límite) y rate (%). */
function calcProgressiveISR(base: number, tiers: { upTo: number | null; rate: number }[]): number {
  const sorted = [...tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
  let total    = 0
  let prevLimit = 0
  for (const tier of sorted) {
    if (base <= prevLimit) break
    const limit   = tier.upTo ?? Infinity
    const taxable = Math.min(base, limit) - prevLimit
    total    += taxable * tier.rate / 100
    prevLimit = limit
  }
  return Math.round(total * 100) / 100
}

const BILL_TYPES: { value: BillType; label: string }[] = [
  { value: 'goods',         label: BILL_TYPE_CONFIG.goods.label         },
  { value: 'services',      label: BILL_TYPE_CONFIG.services.label      },
  { value: 'reimbursement', label: BILL_TYPE_CONFIG.reimbursement.label },
  { value: 'special',       label: BILL_TYPE_CONFIG.special.label       },
  { value: 'fuel',          label: BILL_TYPE_CONFIG.fuel.label          },
]

const PAYMENT_TERMS_OPTIONS = Object.entries(PAYMENT_TERMS_CONFIG).map(([v, l]) => ({ value: v, label: l }))

const IDP_FUEL_OPTS = [
  { value: 'super',   label: `Super (Q${IDP_RATES.super}/gal)`   },
  { value: 'regular', label: `Regular (Q${IDP_RATES.regular}/gal)` },
  { value: 'diesel',  label: `Diesel (Q${IDP_RATES.diesel}/gal)` },
]

export default function FacturaProveedorFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromPO   = !id ? (location.state as any)?.fromPO as { purchaseOrderId: string; vendorId: string; vendorName: string; items: LineItem[] } | undefined : undefined
  const [form] = Form.useForm()

  const [items, setItems]               = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes]               = useState<Tax[]>([])
  const [vendors, setVendors]           = useState<{ value: string; label: string; defaultPurchaseTaxId?: string; tdsEnabled?: boolean; tdsTaxCode?: string }[]>([])
  const [accounts, setAccounts]         = useState<Account[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loading, setLoading]           = useState(!!id)
  const [saving, setSaving]             = useState(false)
  const [approving, setApproving]       = useState(false)
  const [billStatus, setBillStatus]         = useState<string>('draft')
  const [purchaseOrderId, setPurchaseOrderId]         = useState<string | undefined>(fromPO?.purchaseOrderId)
  const [vendorDefaultTaxId, setVendorDefaultTaxId]   = useState<string | undefined>()
  const [vendorIsrTax, setVendorIsrTax]               = useState<Tax | undefined>()
  const [isrAppliedRate, setIsrAppliedRate]           = useState(0)  // tasa efectiva (puede ser tier)
  const [loadedIsrAccountId, setLoadedIsrAccountId]   = useState<string | undefined>()

  // Retention amounts (controlled outside form for live calculation)
  const [isrAmount, setIsrAmount]       = useState(0)
  const [ivaRetAmount, setIvaRetAmount] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Watched form values
  const invoiceType   = Form.useWatch('invoiceType',   form) as BillType   ?? 'goods'
  const paymentTerms  = Form.useWatch('paymentTerms',  form) as PaymentTerms ?? 'immediate'
  const fuelType      = Form.useWatch('fuelType',      form) as string     ?? 'super'
  const invoiceDate   = Form.useWatch('invoiceDate',   form)
  const customDays    = Form.useWatch('paymentTermsDays', form) as number
  const watchCurr     = Form.useWatch('currency',      form) ?? 'GTQ'
  const watchVendorId = Form.useWatch('vendorId',      form) as string | undefined

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getAccounts({ limit: 200 })
      .then((res: any) => {
        const list: Account[] = Array.isArray(res) ? res : (res?.data ?? [])
        setAccounts(list.filter(a => a.isActive && !a.isHeader))
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchVendors('') }, [])

  // Pre-fill from Purchase Order when converting OC → Factura Proveedor
  useEffect(() => {
    if (!fromPO) return
    setPurchaseOrderId(fromPO.purchaseOrderId)
    if (fromPO.vendorId && fromPO.vendorName) {
      setVendors(prev => {
        if (prev.find(v => v.value === fromPO.vendorId)) return prev
        return [{ value: fromPO.vendorId, label: fromPO.vendorName }, ...prev]
      })
      form.setFieldValue('vendorId', fromPO.vendorId)
    }
    if (fromPO.items?.length) {
      setItems(fromPO.items.map(it => newLineItem({
        productId:       it.productId,
        description:     it.description,
        unit:            it.unit,
        quantity:        Number(it.quantity),
        unitPrice:       Number(it.unitPrice),
        discountPercent: Number(it.discountPercent ?? 0),
        taxPercent:      Number(it.taxPercent ?? 12),
        taxId:           it.taxId,
        accountId:       it.accountId,
        projectId:       it.projectId,
      })))
    }
    form.setFieldValue('invoiceDate', dayjs())
  // run once on mount when fromPO is present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getBill(id)
      .then((bill) => {
        setBillStatus(bill.status)
        form.setFieldsValue({
          vendorId:            bill.vendorId,
          invoiceType:         bill.invoiceType    ?? 'goods',
          invoiceDate:         bill.invoiceDate ? dayjs(bill.invoiceDate) : undefined,
          dueDate:             bill.dueDate    ? dayjs(bill.dueDate)    : undefined,
          paymentTerms:        bill.paymentTerms   ?? 'immediate',
          paymentTermsDays:    bill.paymentTermsDays,
          currency:            bill.currency       ?? 'GTQ',
          vendorInvoiceNumber: bill.vendorInvoiceNumber ?? '',
          accountId:           bill.accountId,
          // FEL
          felSerie:            bill.felSerie,
          felNumber:           bill.felNumber,
          felUuid:             bill.felUuid,
          felAuthNumber:       bill.felAuthNumber,
          felMessage:          bill.felMessage,
          felCertDate:         bill.felCertDate ? dayjs(bill.felCertDate) : undefined,
          // Reimbursement
          employeeId:          bill.employeeId,
          employeePayableAccountId: bill.employeePayableAccountId,
          // IDP
          fuelType:            undefined,
          idpAccountId:        bill.idpAccountId,
          // Notes
          notes:               bill.notes,
        })
        if (bill.vendorId && bill.vendorName) {
          setVendors(prev => {
            if (prev.find(v => v.value === bill.vendorId)) return prev
            return [{ value: bill.vendorId, label: bill.vendorName }, ...prev]
          })
        }
        setIsrAmount(Number(bill.isrRetentionAmount ?? 0))
        setIvaRetAmount(Number(bill.ivaRetentionAmount ?? 0))
        setLoadedIsrAccountId(bill.isrRetentionAccountId ?? undefined)
        const loadedItems: LineItem[] = (bill.items ?? []).map(it =>
          newLineItem({
            _key: it.id ?? undefined,
            productId: it.productId,
            description: it.description,
            unit: it.unit,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discountPercent: Number(it.discountPercent ?? 0),
            taxPercent: Number(it.taxPercent ?? 12),
            taxId: it.taxId,
            accountId: it.accountId,
            projectId: it.projectId,
          }),
        )
        setItems(loadedItems.length ? loadedItems : [newLineItem()])
      })
      .catch(() => message.error('No se pudo cargar la factura de proveedor'))
      .finally(() => setLoading(false))
  }, [id, form])

  // Auto-update due date when payment terms change
  useEffect(() => {
    if (!invoiceDate || paymentTerms === 'immediate') {
      form.setFieldValue('dueDate', undefined)
      return
    }
    const base = dayjs(invoiceDate)
    const daysMap: Record<string, number> = {
      net_15: 15, net_30: 30, net_60: 60, net_90: 90,
    }
    const days = daysMap[paymentTerms] ?? (paymentTerms === 'custom' ? (customDays ?? 30) : 0)
    if (days > 0) form.setFieldValue('dueDate', base.add(days, 'day'))
  }, [paymentTerms, invoiceDate, customDays, form])

  // Sincroniza impuesto por defecto del proveedor cuando llega la lista o cambia el vendorId
  useEffect(() => {
    if (!watchVendorId) return
    const found = vendors.find(v => v.value === watchVendorId)
    if (found) setVendorDefaultTaxId(found.defaultPurchaseTaxId)
  }, [vendors, watchVendorId])

  // Resuelve el Tax de ISR configurado en el proveedor y determina la tasa inicial
  useEffect(() => {
    if (!watchVendorId || !taxes.length) { setVendorIsrTax(undefined); setIsrAppliedRate(0); return }
    const vendor = vendors.find(v => v.value === watchVendorId)
    if (vendor?.tdsEnabled && vendor.tdsTaxCode) {
      const tax = taxes.find(t => t.code === vendor.tdsTaxCode && t.isActive)
      setVendorIsrTax(tax)
      if (tax) {
        const defaultRate = tax.subtype === 'progressive' && tax.tiers?.length
          ? Math.min(...tax.tiers.map(t => t.rate))  // tasa mínima del tramo como punto de partida
          : Number(tax.rate)
        setIsrAppliedRate(defaultRate)
      }
    } else {
      setVendorIsrTax(undefined)
      setIsrAppliedRate(0)
    }
  }, [vendors, watchVendorId, taxes])

  // Auto-calcula ISR solo en facturas nuevas (no en edición — el monto guardado prevalece)
  useEffect(() => {
    if (id || !vendorIsrTax) return
    const subtotal = calcTotals(items).subtotal
    const amount = vendorIsrTax.subtype === 'progressive' && vendorIsrTax.tiers?.length
      ? calcProgressiveISR(subtotal, vendorIsrTax.tiers)
      : Math.round(subtotal * isrAppliedRate / 100 * 100) / 100
    setIsrAmount(amount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, vendorIsrTax, isrAppliedRate])

  // ── Vendor search ──────────────────────────────────────────────────────────

  const fetchVendors = useCallback((search: string) => {
    setLoadingVendors(true)
    getVendors({ search, limit: 30 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setVendors(prev => {
          const map = new Map(prev.map(v => [v.value, v]))
          list.forEach((v: any) => map.set(v.id, {
            value: v.id,
            label: v.name,
            defaultPurchaseTaxId: v.defaultPurchaseTaxId ?? undefined,
            tdsEnabled:           v.tdsEnabled ?? false,
            tdsTaxCode:           v.tdsTaxCode ?? undefined,
          }))
          return [...map.values()]
        })
      })
      .catch(() => {})
      .finally(() => setLoadingVendors(false))
  }, [])

  const handleVendorSearch = (val: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchVendors(val), 300)
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totals = calcTotals(items)

  // IDP calculation: total quantity of all lines × rate per fuel type
  const totalQty    = items.reduce((s, it) => s + Number(it.quantity || 0), 0)
  const idpRate     = IDP_RATES[fuelType] ?? 0
  const idpAmount   = invoiceType === 'fuel' ? Math.round(totalQty * idpRate * 100) / 100 : 0

  // For special invoices, IVA retention = taxAmount (buyer retains it)
  const ivaRetForSpecial = invoiceType === 'special' ? totals.taxAmount : ivaRetAmount
  const totalRetention   = isrAmount + (invoiceType === 'special' ? ivaRetForSpecial : ivaRetAmount)
  const netPayable       = Math.round((totals.total + idpAmount - totalRetention) * 100) / 100

  // ── Account options ────────────────────────────────────────────────────────

  const expenseAccounts = accounts.filter(a =>
    a.type === 'expense' || a.type === 'asset'
  ).map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))

  const allAccounts = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))

  // ── Save ───────────────────────────────────────────────────────────────────

  const buildDto = (status: string) => {
    const vals = form.getFieldsValue()
    const lineItems = items.map(it => ({
      productId: it.productId,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      taxInclusive: it.taxInclusive ?? true,
      taxId: it.taxId,
      accountId: it.accountId,
      projectId: it.projectId,
    }))
    const isReimbursement = vals.invoiceType === 'reimbursement'
    return {
      vendorId:            vals.vendorId,
      invoiceDate:         vals.invoiceDate ? vals.invoiceDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      dueDate:             vals.dueDate ? vals.dueDate.format('YYYY-MM-DD') : undefined,
      currency:            vals.currency ?? 'GTQ',
      invoiceType:         vals.invoiceType ?? 'goods',
      paymentTerms:        vals.paymentTerms ?? 'immediate',
      paymentTermsDays:    vals.paymentTerms === 'custom' ? vals.paymentTermsDays : undefined,
      vendorInvoiceNumber: vals.vendorInvoiceNumber || undefined,
      accountId:           vals.accountId,
      // FEL
      felSerie:            vals.felSerie   || undefined,
      felNumber:           vals.felNumber  || undefined,
      felUuid:             vals.felUuid    || undefined,
      felAuthNumber:       vals.felAuthNumber || undefined,
      felMessage:          vals.felMessage   || undefined,
      felCertDate:         vals.felCertDate ? vals.felCertDate.toISOString() : undefined,
      // Retenciones
      isrRetentionAmount:    isrAmount,
      ivaRetentionAmount:    invoiceType === 'special' ? totals.taxAmount : ivaRetAmount,
      isrRetentionAccountId: vendorIsrTax?.retentionAccountId ?? loadedIsrAccountId,
      // Reembolso
      isExpenseReimbursement: isReimbursement,
      employeeId:          isReimbursement ? vals.employeeId : undefined,
      employeeName:        isReimbursement
        ? vendors.find(v => v.value === vals.employeeId)?.label
        : undefined,
      employeePayableAccountId: isReimbursement ? vals.employeePayableAccountId : undefined,
      // IDP
      idpAmount:           idpAmount,
      idpAccountId:        vals.invoiceType === 'fuel' ? vals.idpAccountId : undefined,
      status,
      notes: vals.notes,
      items: lineItems,
      purchaseOrderId: purchaseOrderId ?? undefined,
    }
  }

  const handleSave = async (asDraft: boolean) => {
    try { await form.validateFields(['vendorId', 'invoiceDate']) } catch { return }
    setSaving(true)
    try {
      const dto  = buildDto(asDraft ? 'draft' : 'draft')
      let result: any
      if (id) {
        result = await updateBill(id, dto as any)
      } else {
        result = await createBill(dto as any)
      }
      message.success(asDraft ? 'Borrador guardado' : 'Factura guardada')
      navigate(`/compras/facturas/${result.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!id) return
    setApproving(true)
    try {
      const dto = buildDto('draft')
      await updateBill(id, dto as any)
    } catch (err: any) {
      message.error('Error al guardar: ' + (err?.response?.data?.message ?? 'intente de nuevo'))
      setApproving(false)
      return
    }
    try {
      await approveBill(id)
      message.success('Factura aprobada — asiento contable generado')
      navigate(`/compras/facturas`)
    } catch (err: any) {
      message.error('Error al generar asiento: ' + (err?.response?.data?.message ?? 'contacte soporte'))
    } finally {
      setApproving(false)
    }
  }

  const canApprove = !!id && ['draft', 'pending_approval'].includes(billStatus)

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  )

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/compras/facturas">Facturas Proveedor</Link> },
          { title: id ? 'Editar' : 'Nueva Factura Proveedor' },
        ]}
      />

      {fromPO && (
        <Alert
          type="info"
          icon={<SwapOutlined />}
          showIcon
          message="Factura creada desde Orden de Compra"
          description={`Proveedor, líneas e importes copiados de la OC. Completa los datos FEL y guarda.`}
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <Card title={<span style={{ color: '#1B3A6B', fontWeight: 600 }}>
            {id ? 'Editar Factura Proveedor' : 'Nueva Factura Proveedor'}
          </span>}>
            <Form form={form} layout="vertical" size="small" initialValues={{ currency: 'GTQ', invoiceType: 'goods', paymentTerms: 'immediate' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>

                <Form.Item name="invoiceType" label="Tipo de factura" rules={[{ required: true }]}>
                  <Select options={BILL_TYPES} />
                </Form.Item>

                <Form.Item name="vendorId" label="Proveedor / Empleado" rules={[{ required: true, message: 'Seleccione un proveedor' }]}>
                  <Select
                    showSearch
                    placeholder="Buscar…"
                    filterOption={false}
                    loading={loadingVendors}
                    onSearch={handleVendorSearch}
                    options={vendors}
                    notFoundContent={loadingVendors ? 'Buscando…' : 'Sin resultados'}
                  />
                </Form.Item>

                <Form.Item name="vendorInvoiceNumber" label="No. Factura del Proveedor">
                  <Input placeholder="F001-000123" />
                </Form.Item>

                <Form.Item name="accountId" label="Cuenta de gasto / activo">
                  <Select showSearch placeholder="Seleccionar cuenta…" filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())} options={expenseAccounts} allowClear />
                </Form.Item>

                <Form.Item name="invoiceDate" label="Fecha de factura" rules={[{ required: true, message: 'Ingrese la fecha' }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="paymentTerms" label="Términos de pago">
                  <Select options={PAYMENT_TERMS_OPTIONS} />
                </Form.Item>

                {paymentTerms === 'custom' && (
                  <Form.Item name="paymentTermsDays" label="Días de crédito">
                    <InputNumber min={1} max={365} style={{ width: '100%' }} />
                  </Form.Item>
                )}

                <Form.Item name="dueDate" label="Fecha de vencimiento">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="currency" label="Moneda">
                  <Select options={[
                    { value: 'GTQ', label: 'GTQ — Quetzal' },
                    { value: 'USD', label: 'USD — Dólar' },
                  ]} />
                </Form.Item>
              </div>
            </Form>
          </Card>

          {/* FEL — always visible */}
          <Card
            title={<span style={{ color: '#1B3A6B', fontWeight: 600 }}>FEL — Factura Electrónica SAT</span>}
            styles={{ body: { paddingBottom: 4 } }}
          >
            <Form form={form} layout="vertical" size="small">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="felSerie"      label="Serie FEL">       <Input placeholder="A" /> </Form.Item>
                <Form.Item name="felNumber"     label="Número SAT">      <Input placeholder="00001" /> </Form.Item>
                <Form.Item name="felUuid"       label="UUID" style={{ gridColumn: 'span 2' }}>
                  <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </Form.Item>
                <Form.Item name="felAuthNumber" label="Autorización SAT" style={{ gridColumn: 'span 2' }}>
                  <Input placeholder="Número de autorización" />
                </Form.Item>
                <Form.Item name="felCertDate"   label="Fecha certificación">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" showTime />
                </Form.Item>
                <Form.Item name="felMessage"    label="Mensaje SAT">
                  <Input placeholder="Ej. CERTIFICADA" />
                </Form.Item>
              </div>
            </Form>
          </Card>

          {/* Reemboolso — solo si type = reimbursement */}
          {invoiceType === 'reimbursement' && (
            <Card title={<span style={{ color: '#7c3aed', fontWeight: 600 }}>Reembolso de Gastos</span>}>
              <Form form={form} layout="vertical" size="small">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <Form.Item name="employeeId" label="Empleado (mismo que proveedor)">
                    <Select
                      showSearch placeholder="Seleccionar empleado…"
                      filterOption={false}
                      loading={loadingVendors}
                      onSearch={handleVendorSearch}
                      options={vendors}
                      notFoundContent={loadingVendors ? 'Buscando…' : 'Sin resultados'}
                      onChange={(v) => form.setFieldValue('vendorId', v)}
                    />
                  </Form.Item>
                  <Form.Item name="employeePayableAccountId" label="Cuenta puente empleado">
                    <Select showSearch placeholder="Cuenta transitoria…" filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())} options={allAccounts} allowClear />
                  </Form.Item>
                </div>
                <div style={{ padding: '8px 12px', background: '#f5f0ff', borderRadius: 8, fontSize: 12, color: '#6b21a8' }}>
                  El reembolso se registra como deuda con el empleado en la cuenta puente, no como CxP proveedor.
                </div>
              </Form>
            </Card>
          )}

          {/* Line items + Retenciones & Neto a Pagar */}
          <Card title="Líneas de Factura" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor items={items} taxes={taxes} onChange={setItems} docType="bill" vendorDefaultTaxId={vendorDefaultTaxId} />

            {/* ── Retenciones & Neto a Pagar ─────────────────────────────── */}
            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
              <div style={{ maxWidth: 560, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* ISR — con info del proveedor si está configurado */}
                {vendorIsrTax ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <Space size={6} style={{ marginBottom: 2 }}>
                        <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>{vendorIsrTax.code}</Tag>
                        <Text style={{ fontSize: 12, color: '#531dab', fontWeight: 500 }}>{vendorIsrTax.name}</Text>
                      </Space>
                      {/* Impuesto progresivo: el selector de tramo no aplica — se calculan todos los tramos */}
                      {vendorIsrTax.subtype === 'progressive' && vendorIsrTax.tiers?.length ? (
                        <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 2 }}>
                          Cálculo progresivo por tramos — Base Q {fmt(totals.subtotal)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 2 }}>
                          Base Q {fmt(totals.subtotal)} × {isrAppliedRate}%
                        </Text>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2 }}>
                      <Text style={{ fontSize: 13, color: '#531dab', fontWeight: 600 }}>−</Text>
                      <InputNumber
                        size="small" min={0} step={0.01} prefix="Q"
                        value={isrAmount} onChange={(v) => setIsrAmount(v ?? 0)}
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Retención ISR</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#6b7280' }}>−</Text>
                      <InputNumber
                        size="small" min={0} step={0.01} prefix="Q"
                        value={isrAmount} onChange={(v) => setIsrAmount(v ?? 0)}
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>
                )}

                {/* IVA Retention */}
                {invoiceType === 'special' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>IVA Retenido — Factura Especial</Text>
                      <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>El comprador retiene el 100% del IVA</Text>
                    </div>
                    <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>− Q {fmt(totals.taxAmount)}</Text>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Retención IVA</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#6b7280' }}>−</Text>
                      <InputNumber
                        size="small" min={0} step={0.01} prefix="Q"
                        value={ivaRetAmount} onChange={(v) => setIvaRetAmount(v ?? 0)}
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>
                )}

                {/* IDP row (combustible) */}
                {idpAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#d97706' }}>IDP Combustible</Text>
                    <Text style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>+ Q {fmt(idpAmount)}</Text>
                  </div>
                )}

                {/* Neto a Pagar — solo cuando hay retenciones o IDP */}
                {(totalRetention > 0 || idpAmount > 0) && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#1B3A6B', borderRadius: 8, padding: '10px 16px', marginTop: 2,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: 600, color: '#adc6ff' }}>Neto a Pagar Proveedor</Text>
                    <Text style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                      {watchCurr} {fmt(netPayable)}
                    </Text>
                  </div>
                )}

              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card title="Notas">
            <Form form={form} layout="vertical" size="small">
              <Form.Item name="notes">
                <Input.TextArea rows={3} placeholder="Notas internas sobre esta factura…" />
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* IDP — solo si fuel */}
          {invoiceType === 'fuel' && (
            <Card title={<span style={{ color: '#d97706', fontWeight: 600 }}>IDP — Combustible</span>}>
              <Form form={form} layout="vertical" size="small">
                <Form.Item name="fuelType" label="Tipo de combustible" initialValue="super">
                  <Select options={IDP_FUEL_OPTS} />
                </Form.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Total galones (sum. líneas)</Text>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>{fmt(totalQty)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#8c8c8c' }}>IDP calculado</Text>
                  <Text style={{ fontSize: 14, fontWeight: 700, color: '#d97706' }}>Q {fmt(idpAmount)}</Text>
                </div>
                <Form.Item name="idpAccountId" label="Cuenta IDP por acreditar">
                  <Select showSearch placeholder="Ej. 1106 — IDP por Acreditar" filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())} options={allAccounts} allowClear />
                </Form.Item>
              </Form>
            </Card>
          )}

          {/* Actions */}
          <Card title="Acciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <Button
                block icon={<SaveOutlined />} loading={saving}
                onClick={() => handleSave(true)}
                style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
              >
                Guardar borrador
              </Button>
              <Button
                block type="primary" icon={<CheckOutlined />} loading={saving}
                onClick={() => handleSave(false)}
              >
                Guardar cambios
              </Button>
              {canApprove && (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <Button
                    block type="primary" icon={<ThunderboltOutlined />} loading={approving}
                    onClick={handleApprove}
                    style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  >
                    Aprobar y generar asiento
                  </Button>
                  <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                    Genera póliza contable automática (CxP + IVA CF)
                  </div>
                </>
              )}
              {billStatus && (
                <Tag color={
                  billStatus === 'paid' ? 'green' :
                  billStatus === 'voided' ? 'volcano' :
                  billStatus === 'pending_approval' ? 'purple' :
                  billStatus === 'open' ? 'orange' : 'default'
                } style={{ width: '100%', textAlign: 'center', marginTop: 4 }}>
                  Estado: {billStatus === 'pending_approval' ? 'Pendiente aprobación' : billStatus}
                </Tag>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
