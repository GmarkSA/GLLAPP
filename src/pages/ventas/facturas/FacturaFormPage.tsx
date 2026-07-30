import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, InputNumber, Input, Button, Checkbox,
  Card, Breadcrumb, Typography, Spin, Divider, Space, message, Tag, Alert,
} from 'antd'
import {
  SaveOutlined, SendOutlined, HomeOutlined,
  GlobalOutlined, SafetyCertificateOutlined, FileTextOutlined,
  CheckCircleFilled, CloseCircleFilled, LoadingOutlined, LinkOutlined,
  EditOutlined, CheckOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../../components/ui/PageHeader'
import dayjs from 'dayjs'

import {
  createInvoice, updateInvoice, getInvoice, emitirFelInvoice,
  FEL_TIPOS_DOCUMENTO, FEL_TIPOS_FRASE, INCOTERMS,
  type CreateInvoiceDto, type FelFrase,
} from '../../../api/facturas'
import { companyIntegrationsApi } from '../../../api/companyIntegrations'
import { useCompanyStore } from '../../../store/companyStore'
import { getCustomers, getCustomer } from '../../../api/contactos'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getExchangeRateForDate } from '../../../api/monedas'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import PaymentTermsSelect, { getPaymentTermDays } from '../../../components/PaymentTermsSelect'
import SelectorDimensionesAnaliticas, { type DimensionesValue } from '../../../components/SelectorDimensionesAnaliticas'

const { Text } = Typography

const fmt = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2 })

interface CustomerOption {
  value: string
  label: string
  commercialName?: string
  taxCode?: string
  tdsEnabled?: boolean
  tdsTaxCode?: string
}

export default function FacturaFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [items, setItems] = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [felFrases, setFelFrases] = useState<FelFrase[]>([])
  const [isExenta, setIsExenta] = useState(false)
  const [customerTermsDays, setCustomerTermsDays] = useState<number | null>(null)
  const [customerTermsLabel, setCustomerTermsLabel] = useState<string | null>(null)
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false)
  const [exchangeRateMeta, setExchangeRateMeta] = useState<{ effectiveDate: string; source: string } | null>(null)
  const [certifying, setCertifying] = useState(false)
  const [felCertResult, setFelCertResult] = useState<{ success: boolean; uuid?: string; serie?: string; numero?: string; url?: string; mensaje: string } | null>(null)
  const activeCompany = useCompanyStore(s => s.activeCompany)
  // Mejora 1 — impuesto preferido del cliente
  const [customerDefaultTaxId, setCustomerDefaultTaxId] = useState<string | undefined>()
  // Mejora 2 — ISR retención en origen
  const [customerIsrTax, setCustomerIsrTax] = useState<Tax | undefined>()
  const [isrAmount, setIsrAmount] = useState(0)
  const [editingIsr, setEditingIsr] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Load taxes & customers ─────────────────────────────────────────────────
  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchCustomers('') }, [])

  // ── Auto-cargar defaultDocumentType del perfil FEL activo ─────────────────
  useEffect(() => {
    if (id || !activeCompany) return  // solo en nueva factura
    companyIntegrationsApi.getEInvoicing(activeCompany.id)
      .then(profiles => {
        const active = profiles.find(p => p.status === 'active')
        const defaultType = active?.apiConfigurationJson?.defaultDocumentType
        if (defaultType) form.setFieldValue('felTipoDocumento', defaultType)
      })
      .catch(() => {})
  }, [activeCompany?.id])

  // ── Load existing invoice (edit mode) ──────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getInvoice(id)
      .then((inv) => {
        form.setFieldsValue({
          customerId:             inv.customerId,
          invoiceDate:            inv.invoiceDate      ? dayjs(inv.invoiceDate)        : undefined,
          accountingDate:         inv.accountingDate   ? dayjs(inv.accountingDate)    : undefined,
          dueDate:                inv.dueDate          ? dayjs(inv.dueDate)            : undefined,
          currency:               inv.currency         ?? 'GTQ',
          exchangeRate:           Number(inv.exchangeRate ?? 1),
          reference:              inv.purchaseOrderRef ?? '',
          discountPercent:        inv.discountPercent  ?? 0,
          notes:                  inv.notes            ?? '',
          termsAndConditions:     inv.termsAndConditions ?? '',
          // FEL — certificador
          felSerie:               inv.felSerie          ?? '',
          felNumero:              inv.felNumero          ?? '',
          felAutorizacion:        inv.felAutorizacion    ?? '',
          felMensaje:             inv.felMensaje         ?? '',
          felUrl:                 inv.felUrl             ?? '',
          felUuid:                inv.felUuid            ?? '',
          felCertificadaAt:       inv.felCertificadaAt  ? dayjs(inv.felCertificadaAt) : undefined,
          // FEL — configuración
          felTipoDocumento:       inv.felTipoDocumento      ?? 'FACT',
          lugarExpedicion:        inv.lugarExpedicion        ?? '',
          facturaExenta:          inv.facturaExenta          ?? false,
          nombreConsignatario:    inv.nombreConsignatario    ?? '',
          direccionConsignatario: inv.direccionConsignatario ?? '',
          incoterm:               inv.incoterm               ?? undefined,
          dimensiones: {
            centroCostoId:    inv.centroCostoId    ?? null,
            centroBeneficioId: inv.centroBeneficioId ?? null,
          } satisfies DimensionesValue,
        })
        if (inv.customerId && inv.customerName) {
          setCustomers([{ value: inv.customerId, label: inv.customerName }])
        }
        setFelFrases(inv.felFrases ?? [])
        setIsExenta(inv.facturaExenta ?? false)

        const loadedItems: LineItem[] = (inv.items ?? []).map((it) =>
          newLineItem({
            _key:            it.id ?? undefined,
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
          }),
        )
        setItems(loadedItems.length ? loadedItems : [newLineItem()])
      })
      .catch(() => message.error('No se pudo cargar la factura'))
      .finally(() => setLoading(false))
  }, [id, form])

  // ── Customer search ────────────────────────────────────────────────────────
  const fetchCustomers = useCallback((search: string) => {
    setLoadingCustomers(true)
    getCustomers({ search, limit: 20 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map((c) => ({
          value:      c.id,
          label:      c.legalName ?? c.name,
          commercialName: c.name,
          taxCode:    c.taxCode    ?? undefined,
          tdsEnabled: c.tdsEnabled ?? false,
          tdsTaxCode: c.tdsTaxCode ?? undefined,
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))
  }, [])

  const handleCustomerSearch = (val: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCustomers(val), 300)
  }

  // Calcula y fija la fecha de vencimiento basada en días de términos de pago
  const applyDueDate = (termsDays: number) => {
    const invoiceDate = form.getFieldValue('invoiceDate')
    const base = invoiceDate ? dayjs(invoiceDate) : dayjs()
    form.setFieldValue('dueDate', base.add(termsDays, 'day'))
  }

  const handleCustomerSelect = async (customerId: string) => {
    try {
      const cust: any = await getCustomer(customerId)
      // Términos de pago
      const termValue = cust?.paymentTerms as string | undefined
      const stdDays   = termValue ? getPaymentTermDays(termValue) : null
      const days: number | null = cust?.paymentTermsDays
        ? Number(cust.paymentTermsDays)
        : stdDays
      const label = days != null && days > 0
        ? `Neto ${days} días`
        : days === 0 ? 'Pago inmediato' : null
      setCustomerTermsDays(days)
      setCustomerTermsLabel(label)
      if (days != null && days > 0) applyDueDate(days)

      // Mejora 1 — impuesto IVA preferido del cliente
      if (cust?.taxCode && taxes.length) {
        const matched = taxes.find(t => t.code === cust.taxCode && t.isActive)
        setCustomerDefaultTaxId(matched?.id)
      } else {
        setCustomerDefaultTaxId(undefined)
      }

      // Mejora 2 — ISR retención en origen
      if (cust?.tdsEnabled && cust?.tdsTaxCode && taxes.length) {
        const isrTax = taxes.find(t => t.code === cust.tdsTaxCode && t.isActive)
        setCustomerIsrTax(isrTax)
      } else {
        setCustomerIsrTax(undefined)
        setIsrAmount(0)
      }
    } catch {
      setCustomerTermsDays(null)
      setCustomerTermsLabel(null)
      setCustomerDefaultTaxId(undefined)
      setCustomerIsrTax(undefined)
      setIsrAmount(0)
    }
  }

  // Auto-cálculo ISR cuando cambian los ítems (solo facturas nuevas)
  useEffect(() => {
    if (id || !customerIsrTax) return
    const { subtotal } = calcTotals(items)
    let amount: number
    if (customerIsrTax.subtype === 'progressive' && customerIsrTax.tiers?.length) {
      const sorted = [...customerIsrTax.tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
      let total = 0; let prev = 0
      for (const tier of sorted) {
        if (subtotal <= prev) break
        const limit   = tier.upTo ?? Infinity
        const taxable = Math.min(subtotal, limit) - prev
        total += taxable * tier.rate / 100
        prev   = limit
      }
      amount = Math.round(total * 100) / 100
    } else {
      amount = Math.round(subtotal * Number(customerIsrTax.rate) / 100 * 100) / 100
    }
    setIsrAmount(amount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, customerIsrTax])

  const handleInvoiceDateChange = (date: dayjs.Dayjs | null) => {
    if (date && customerTermsDays != null && customerTermsDays > 0) {
      form.setFieldValue('dueDate', date.add(customerTermsDays, 'day'))
    }
  }

  // ── FEL frases toggle ──────────────────────────────────────────────────────
  const toggleFrase = (tipoFrase: number, codigoEscenario: number) => {
    setFelFrases(prev => {
      const exists = prev.some(f => f.tipoFrase === tipoFrase && f.codigoEscenario === codigoEscenario)
      return exists
        ? prev.filter(f => !(f.tipoFrase === tipoFrase && f.codigoEscenario === codigoEscenario))
        : [...prev, { tipoFrase, codigoEscenario }]
    })
  }

  // ── Build DTO (sin status — se añade en handleSave) ───────────────────────
  const buildDto = (): Omit<CreateInvoiceDto, 'status'> => {
    const v = form.getFieldsValue()
    const dim = v.dimensiones as DimensionesValue | undefined
    const lineItems = items.map(({ productId, description, unit, quantity, unitPrice, discountPercent, taxPercent, taxId, taxInclusive, accountId, projectId }) => ({
      productId, description, unit, quantity, unitPrice, discountPercent, taxPercent, taxId, taxInclusive, accountId, projectId,
    }))
    return {
      customerId:       v.customerId,
      invoiceDate:      v.invoiceDate ? v.invoiceDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      accountingDate:   v.accountingDate ? v.accountingDate.format('YYYY-MM-DD') : undefined,
      dueDate:          v.dueDate ? v.dueDate.format('YYYY-MM-DD') : undefined,
      currency:         v.currency ?? 'GTQ',
      exchangeRate:     v.exchangeRate ?? 1,
      discountPercent:  v.discountPercent ?? 0,
      purchaseOrderRef: v.reference || undefined,
      notes:            v.notes || undefined,
      termsAndConditions: v.termsAndConditions || undefined,
      items:            lineItems,
      // FEL configuración
      felTipoDocumento:       v.felTipoDocumento      || 'FACT',
      lugarExpedicion:        v.lugarExpedicion        || undefined,
      facturaExenta:          v.facturaExenta          ?? false,
      felFrases,
      nombreConsignatario:    v.nombreConsignatario    || undefined,
      direccionConsignatario: v.direccionConsignatario || undefined,
      incoterm:               v.incoterm               || undefined,
      // FEL certificador
      felSerie:        v.felSerie        || undefined,
      felNumero:       v.felNumero       || undefined,
      felAutorizacion: v.felAutorizacion || undefined,
      felMensaje:      v.felMensaje      || undefined,
      felUrl:          v.felUrl          || undefined,
      felUuid:         v.felUuid         || undefined,
      felCertificadaAt: v.felCertificadaAt ? v.felCertificadaAt.toISOString() : undefined,
      centroCostoId:    dim?.centroCostoId    || undefined,
      centroBeneficioId: dim?.centroBeneficioId || undefined,
      isrRetentionAmount:    isrAmount > 0 ? isrAmount : undefined,
      isrRetentionAccountId: isrAmount > 0 ? (customerIsrTax?.salesAccountId ?? undefined) : undefined,
    }
  }

  const handleCertify = async () => {
    if (!id) return
    setCertifying(true)
    setFelCertResult(null)
    try {
      const updated = await emitirFelInvoice(id)
      if (updated.felUuid) {
        setFelCertResult({ success: true, uuid: updated.felUuid, serie: updated.felSerie, numero: updated.felNumero, url: updated.felUrl, mensaje: 'Factura certificada correctamente' })
        message.success('¡Factura certificada ante SAT!')
        // Actualizar campos FEL en el formulario
        form.setFieldsValue({ felUuid: updated.felUuid, felSerie: updated.felSerie, felNumero: updated.felNumero, felAutorizacion: updated.felAutorizacion, felUrl: updated.felUrl, felMensaje: updated.felMensaje })
      } else {
        setFelCertResult({ success: false, mensaje: updated.felMensaje ?? 'Error desconocido del certificador' })
        message.error(updated.felMensaje ?? 'Error al certificar')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error de conexión con el certificador'
      setFelCertResult({ success: false, mensaje: msg })
      message.error(msg)
    } finally { setCertifying(false) }
  }

  const handleSave = async (status: 'draft' | 'sent') => {
    try { await form.validateFields(['customerId', 'invoiceDate']) } catch { return }
    setSaving(true)
    try {
      const dto: CreateInvoiceDto = { ...buildDto(), status: status as any }
      const result = id
        ? await updateInvoice(id, dto)
        : await createInvoice(dto)
      message.success(status === 'draft' ? 'Borrador guardado' : 'Factura emitida')
      navigate(`/ventas/facturas/${result.id}`)
    } catch (err: any) {
      // El backend puede devolver message como string o como string[], anidado en error.message
      const raw = err?.response?.data?.error?.message ?? err?.response?.data?.message
      const msg = Array.isArray(raw) ? raw.join(' | ') : (raw ?? 'Error al guardar la factura')
      message.error(msg, 6)
    } finally { setSaving(false) }
  }

  // ── Form.useWatch — TODOS deben estar aquí, nunca dentro del JSX ──────────
  const watchDiscountPct  = Form.useWatch('discountPercent',   form) ?? 0
  const watchCurrency     = Form.useWatch('currency',          form) ?? 'GTQ'
  const watchInvoiceDate  = Form.useWatch('invoiceDate',       form)
  const watchTipoDoc      = Form.useWatch('felTipoDocumento',  form)
  const watchSerie        = Form.useWatch('felSerie',          form)
  const watchNumero       = Form.useWatch('felNumero',         form)
  const watchUuid         = Form.useWatch('felUuid',           form)

  useEffect(() => {
    if (watchCurrency !== 'USD') {
      form.setFieldValue('exchangeRate', 1)
      setExchangeRateMeta(null)
      return
    }

    const date = watchInvoiceDate ? dayjs(watchInvoiceDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    setLoadingExchangeRate(true)
    getExchangeRateForDate('USD', date)
      .then((result) => {
        const rate = result.officialRate ?? (result.rate > 0 ? 1 / result.rate : 1)
        form.setFieldValue('exchangeRate', Number(rate.toFixed(6)))
        setExchangeRateMeta({ effectiveDate: result.effectiveDate, source: result.source })
      })
      .catch(() => {
        message.warning('No se pudo cargar el tipo de cambio histórico para la fecha seleccionada')
      })
      .finally(() => setLoadingExchangeRate(false))
  }, [watchCurrency, watchInvoiceDate, form])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Cargando factura…" />
      </div>
    )
  }

  // (felCollapseItems eliminado — FEL ahora siempre visible como Card)

  return (
    <div style={{ padding: '12px 16px', background: '#fafbfc', minHeight: '100vh' }}>
      <PageHeader
        icon={<FileTextOutlined />}
        title={id ? 'Editar Factura' : 'Nueva Factura'}
        subtitle={<Link to="/ventas/facturas">← Volver a facturas</Link>}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── 1. Datos generales ─────────────────────────────────────────── */}
          <Card
            size="small"
            title={<span style={{ color: '#1faec2', fontWeight: 600 }}>{id ? 'Editar Factura' : 'Nueva Factura'}</span>}
            styles={{ body: { padding: '12px 16px 4px' } }}
          >
            <Form
              form={form}
              layout="vertical"
              size="small"
              initialValues={{ currency: 'GTQ', discountPercent: 0, felTipoDocumento: 'FACT', facturaExenta: false, accountingDate: dayjs() }}
            >
              {/* Fila 1: Cliente (ancho completo) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0 12px' }}>
                <Form.Item name="customerId" label="Cliente" style={{ marginBottom: 8 }}
                  rules={[{ required: true, message: 'Seleccione un cliente' }]}
                >
                  <Select
                    showSearch placeholder="Buscar por Razón Social o nombre comercial…"
                    filterOption={false} loading={loadingCustomers}
                    onSearch={handleCustomerSearch} onSelect={handleCustomerSelect}
                    notFoundContent={loadingCustomers ? 'Buscando…' : 'Sin resultados'}
                    optionRender={(opt) => {
                      const c = customers.find(x => x.value === opt.value)
                      return (
                        <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                          {c?.commercialName && c.commercialName !== opt.label?.toString() && (
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{c.commercialName}</div>
                          )}
                        </div>
                      )
                    }}
                    options={customers.map(c => ({ value: c.value, label: c.label }))}
                  />
                </Form.Item>
              </div>

              {/* Fila 2: Moneda | Fecha Factura | Vencimiento | F. Contabilización | Referencia | Desc.% */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="currency" label="Moneda" style={{ marginBottom: 8 }}>
                  <Select options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]} />
                </Form.Item>

                <Form.Item name="invoiceDate" label="Fecha Factura" style={{ marginBottom: 8 }}
                  rules={[{ required: true, message: 'Ingrese la fecha' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" onChange={handleInvoiceDateChange} />
                </Form.Item>

                <Form.Item name="dueDate" style={{ marginBottom: 8 }}
                  label={
                    <span>Vencimiento{customerTermsLabel && (
                      <Tag color="#1faec2" style={{ fontSize: 10, marginLeft: 4 }}>{customerTermsLabel}</Tag>
                    )}</span>
                  }
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="accountingDate" label="Fecha Contabilización" style={{ marginBottom: 8 }}
                  tooltip="Período contable. Si difiere de la fecha de factura, la póliza y el libro se registran en este período."
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="reference" label="Referencia / PO" style={{ marginBottom: 8 }}>
                  <Input placeholder="OC-2024-001" />
                </Form.Item>

                <Form.Item name="discountPercent" label="Desc. Global %" style={{ marginBottom: 8 }}>
                  <InputNumber min={0} max={100} step={1} suffix="%" style={{ width: '100%' }} />
                </Form.Item>
              </div>

              {/* Dimensiones analíticas */}
              <Form.Item name="dimensiones" style={{ marginBottom: 8 }}>
                <SelectorDimensionesAnaliticas layout="form" />
              </Form.Item>

              {watchCurrency === 'USD' && (
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '0 12px', alignItems: 'end' }}>
                  <Form.Item
                    name="exchangeRate"
                    label="Tipo de cambio"
                    style={{ marginBottom: 8 }}
                    tooltip="Se obtiene del historial segun la fecha de factura."
                  >
                    <InputNumber
                      min={0.000001}
                      precision={6}
                      step={0.000001}
                      addonBefore="1 USD ="
                      addonAfter="GTQ"
                      disabled={loadingExchangeRate}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <div style={{ marginBottom: 11, fontSize: 12, color: '#6b7280' }}>
                    {loadingExchangeRate
                      ? 'Consultando historial...'
                      : exchangeRateMeta
                        ? `Tasa aplicada del ${dayjs(exchangeRateMeta.effectiveDate).format('DD/MM/YYYY')} (${exchangeRateMeta.source}).`
                        : 'Selecciona fecha para aplicar la tasa historica.'}
                  </div>
                </div>
              )}
            </Form>
          </Card>

          {/* ── 2. FEL — siempre visible ───────────────────────────────────── */}
          <Card
            size="small"
            style={{ borderColor: '#d6e4ff' }}
            styles={{ header: { background: '#fafbfc', borderBottom: '1px solid #d6e4ff', minHeight: 36 }, body: { padding: '10px 14px 4px' } }}
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#1faec2', fontSize: 13 }} />
                <span style={{ color: '#1faec2', fontWeight: 600, fontSize: 13 }}>
                  Datos FEL — Factura Electrónica SAT Guatemala
                </span>
                <Tag color="#1faec2" style={{ fontSize: 10 }}>SAT</Tag>
              </Space>
            }
          >
            <Form form={form} layout="vertical" size="small">
              {/* Fila 1: Tipo doc, Serie, Número */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="felTipoDocumento" label="Tipo Documento" style={{ marginBottom: 8 }}>
                  <Select options={FEL_TIPOS_DOCUMENTO} placeholder="FACT" />
                </Form.Item>
                <Form.Item name="felSerie" label="Serie FEL" style={{ marginBottom: 8 }}>
                  <Input placeholder="Serie certificador" />
                </Form.Item>
                <Form.Item name="felNumero" label="Número SAT" style={{ marginBottom: 8 }}>
                  <Input placeholder="Número SAT" />
                </Form.Item>
              </div>

              {/* Fila 2: UUID, URL, Autorización, Fecha + Exenta */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="felUuid" label="UUID" style={{ marginBottom: 8 }}>
                  <Input placeholder="UUID SAT" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }} />
                </Form.Item>
                <Form.Item name="felUrl" label="URL Verificación" style={{ marginBottom: 8 }}>
                  <Input placeholder="https://report.feel.com.gt/..." prefix={<GlobalOutlined style={{ color: '#6b7280' }} />} />
                </Form.Item>
                <Form.Item name="felAutorizacion" label="Autorización" style={{ marginBottom: 8 }}>
                  <Input placeholder="No. autorización SAT" />
                </Form.Item>
                <Form.Item name="felCertificadaAt" label="Fecha Certificación" style={{ marginBottom: 8 }}>
                  <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YY HH:mm" />
                </Form.Item>
              </div>

              {/* Frases SAT + Exenta */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, paddingBottom: 8 }}>
                <Form.Item name="facturaExenta" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox onChange={(e) => setIsExenta(e.target.checked)}>Exenta de IVA</Checkbox>
                </Form.Item>
                <Divider type="vertical" style={{ height: 18, margin: '0 4px' }} />
                {FEL_TIPOS_FRASE.map((f) => {
                  const active = felFrases.some(x => x.tipoFrase === f.tipoFrase && x.codigoEscenario === f.codigoEscenario)
                  return (
                    <Tag key={`${f.tipoFrase}-${f.codigoEscenario}`}
                      color={active ? '#1faec2' : 'default'}
                      style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 11 }}
                      onClick={() => toggleFrase(f.tipoFrase, f.codigoEscenario)}
                    >
                      {active ? '✓ ' : ''}{f.label}
                    </Tag>
                  )
                })}
              </div>

              {/* Exportación — solo para facturas de exportación */}
              <div style={{ borderTop: '1px dashed rgba(10,10,10,0.08)', paddingTop: 8, marginTop: 2 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500, letterSpacing: '.02em' }}>
                  EXPORTACIÓN / CONSIGNACIÓN
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '0 12px' }}>
                  <Form.Item name="incoterm" label="INCOTERM" style={{ marginBottom: 8 }}>
                    <Select allowClear placeholder="Comercio exterior" options={INCOTERMS} />
                  </Form.Item>
                  <Form.Item name="lugarExpedicion" label="Lugar de Expedición" style={{ marginBottom: 8 }}>
                    <Input placeholder="Ciudad de Guatemala, Guatemala" />
                  </Form.Item>
                  <Form.Item name="nombreConsignatario" label="Consignatario" style={{ marginBottom: 8 }}>
                    <Input placeholder="Nombre del consignatario" />
                  </Form.Item>
                  <Form.Item name="direccionConsignatario" label="Dirección Consignatario" style={{ marginBottom: 8 }}>
                    <Input placeholder="Dirección destino" />
                  </Form.Item>
                </div>
              </div>
            </Form>
          </Card>

          {/* ── 3. Líneas de factura ────────────────────────────────────────── */}
          <Card
            size="small"
            title={<span style={{ color: '#1faec2', fontWeight: 600 }}>Líneas de Factura</span>}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="invoice"
              vendorDefaultTaxId={customerDefaultTaxId}
            />

            {/* ── ISR Retención en origen ──────────────────────────────────── */}
            {(customerIsrTax || isrAmount > 0) && (
              <div style={{ borderTop: '1px solid rgba(10,10,10,0.08)', marginTop: 12, paddingTop: 12 }}>
                <div style={{ maxWidth: 480, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      {customerIsrTax ? (
                        <>
                          <Space size={6} style={{ marginBottom: 2 }}>
                            <Tag color="#6b7280" style={{ margin: 0, fontSize: 11 }}>{customerIsrTax.code}</Tag>
                            <Text style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 500 }}>{customerIsrTax.name}</Text>
                          </Space>
                          <Text style={{ fontSize: 11, color: '#9aa1ab', display: 'block', marginTop: 2 }}>
                            Base Q {fmt(calcTotals(items).subtotal)} × {customerIsrTax.rate}%
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Retención ISR</Text>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 13, color: '#0a0a0a', fontWeight: 600 }}>−</Text>
                      {editingIsr ? (
                        <>
                          <InputNumber
                            size="small" min={0} step={0.01} prefix="Q" precision={2}
                            value={isrAmount} onChange={v => setIsrAmount(v ?? 0)}
                            style={{ width: 120 }}
                            formatter={v => { const p = `${v ?? ''}`.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.') }}
                            parser={v => parseFloat((v ?? '').replace(/,/g, '')) || 0}
                          />
                          <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => setEditingIsr(false)} style={{ color: '#2ea172' }} />
                        </>
                      ) : (
                        <>
                          <Text style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a', fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
                            Q {fmt(isrAmount)}
                          </Text>
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingIsr(true)} style={{ color: '#9aa1ab' }} />
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <Text style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Neto a Cobrar</Text>
                    <Text style={{ fontSize: 15, fontWeight: 700, color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>
                      Q {fmt(Math.max(0, calcTotals(items).total - isrAmount))}
                    </Text>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div style={{ width: 270, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>

          {/* Acciones */}
          <Card size="small" title={<span style={{ color: '#1faec2', fontWeight: 600 }}>Acciones</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button block icon={<SaveOutlined />} loading={saving}
                onClick={() => handleSave('draft')}
                style={{ borderColor: '#1faec2', color: '#1faec2' }}
              >
                Guardar borrador
              </Button>
              <Button block icon={<SendOutlined />} loading={saving}
                onClick={() => handleSave('sent')}
                style={{ borderColor: '#1faec2', color: '#1faec2' }}
              >
                Guardar y marcar enviada
              </Button>
              {id && (
                <Button block type="primary" icon={<SafetyCertificateOutlined />}
                  loading={certifying}
                  onClick={handleCertify}
                  style={{ background: '#096dd9' }}
                  disabled={!!watchSerie}
                >
                  {watchSerie ? 'Ya certificada' : 'Certificar ante SAT'}
                </Button>
              )}
            </div>
          </Card>

          {/* FEL — estado de certificación */}
          <Card size="small"
            style={{ borderColor: felCertResult?.success ? '#c3e5d8' : watchSerie ? '#c3e5d8' : '#91d5ff' }}
            styles={{ header: { background: watchSerie || felCertResult?.success ? '#e8f5ef' : '#e6fafd', borderBottom: '1px solid', minHeight: 36 } }}
            title={
              <Space style={{ fontSize: 12 }}>
                {watchSerie
                  ? <CheckCircleFilled style={{ color: '#2ea172', fontSize: 13 }} />
                  : felCertResult?.success === false
                    ? <CloseCircleFilled style={{ color: '#e5484d', fontSize: 13 }} />
                    : certifying
                      ? <LoadingOutlined style={{ color: '#1faec2', fontSize: 13 }} />
                      : <SafetyCertificateOutlined style={{ color: '#1faec2', fontSize: 13 }} />
                }
                <span style={{ color: watchSerie ? '#2ea172' : '#1faec2', fontWeight: 600 }}>
                  FEL Guatemala
                </span>
              </Space>
            }
          >
            <div style={{ fontSize: 12, lineHeight: 1.9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Tipo doc.</Text>
                <Tag color="#1faec2" style={{ fontSize: 10 }}>{watchTipoDoc || 'FACT'}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Exenta IVA</Text>
                <Text strong style={{ fontSize: 12 }}>{isExenta ? 'Sí' : 'No'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Frases</Text>
                <Text strong style={{ fontSize: 12 }}>{felFrases.length} seleccionada(s)</Text>
              </div>
              {(watchSerie || felCertResult?.serie) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Serie</Text>
                  <Text code style={{ fontSize: 10 }}>{watchSerie || felCertResult?.serie}</Text>
                </div>
              )}
              {(watchNumero || felCertResult?.numero) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Número</Text>
                  <Text code style={{ fontSize: 10 }}>{watchNumero || felCertResult?.numero}</Text>
                </div>
              )}
              {(felCertResult?.uuid || watchUuid) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">UUID</Text>
                  <Text code style={{ fontSize: 9, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {felCertResult?.uuid}
                  </Text>
                </div>
              )}
              {(felCertResult?.url) && (
                <div style={{ marginTop: 6 }}>
                  <a href={felCertResult.url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                    <LinkOutlined /> Ver PDF en SAT
                  </a>
                </div>
              )}
              {felCertResult?.success === false && (
                <div style={{ marginTop: 6, color: '#e5484d', fontSize: 11 }}>
                  {felCertResult.mensaje}
                </div>
              )}
            </div>
          </Card>

          {/* Notas y Términos — compacto */}
          <Card size="small" title={<span style={{ color: '#1faec2', fontWeight: 600 }}>Notas y Términos</span>}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <Form form={form} layout="vertical" size="small">
              <Form.Item name="notes" label="Notas internas" style={{ marginBottom: 8 }}>
                <Input.TextArea rows={2} placeholder="Notas visibles en la factura…" />
              </Form.Item>
              <Form.Item name="termsAndConditions" label="Términos y Condiciones" style={{ marginBottom: 4 }}>
                <Input.TextArea rows={2} placeholder="Términos y condiciones…" />
              </Form.Item>
            </Form>
          </Card>

          {/* Alerta FEL */}
          <Alert
            type="info" showIcon
            style={{ fontSize: 11, padding: '6px 10px' }}
            message="Al emitir, el sistema conectará con el certificador FEL para obtener el UUID y autorización SAT."
          />
        </div>
      </div>
    </div>
  )
}
