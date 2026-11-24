import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, Input, InputNumber, Button,
  Card, Breadcrumb, Spin, Space, message, Tag,
  Divider, Popconfirm, Modal,
} from 'antd'
import {
  SaveOutlined, ShoppingCartOutlined, HomeOutlined, SendOutlined,
  DeleteOutlined, SwapOutlined, FilePdfOutlined, MailOutlined,
  CheckCircleOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createPurchaseOrder, updatePurchaseOrder, getPurchaseOrder,
  sendPurchaseOrder, deletePurchaseOrder, approvePurchaseOrder,
  getVendors, PO_STATUS_CONFIG, type POStatus,
} from '../../../api/compras'
import { getExchangeRateForDate } from '../../../api/monedas'
import { getTaxes, type Tax } from '../../../api/impuestos'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import DocumentTotals from '../../../components/DocumentForm/DocumentTotals'
import PaymentTermsSelect, { getPaymentTermDays } from '../../../components/PaymentTermsSelect'

interface VendorOption {
  value: string
  label: string
  commercialName?: string
  defaultPurchaseTaxId?: string
  paymentTerms?: string
  paymentTermsDays?: number
  taxId?: string
  currency?: string
}

export default function OrdenCompraFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [items, setItems]               = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes]               = useState<Tax[]>([])
  const [vendors, setVendors]           = useState<VendorOption[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loading, setLoading]           = useState(!!id)
  const [saving, setSaving]             = useState(false)
  const [sending, setSending]           = useState(false)
  const [converting, setConverting]     = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [poStatus, setPoStatus]         = useState<POStatus | null>(null)
  const [vendorId, setVendorId]                 = useState<string | undefined>()
  const [vendorName, setVendorName]             = useState<string | undefined>()
  const [vendorDefaultTaxId, setVendorDefaultTaxId] = useState<string | undefined>()
  const [vendorNit, setVendorNit]               = useState('')
  const [emailModal, setEmailModal]     = useState(false)
  const [emailTo, setEmailTo]           = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /**
   * La moneda y el tipo de cambio de la orden.
   *
   * La orden no tenía NADA de esto: no había selector de moneda, el guardado
   * no mandaba `currency`, y al editar tampoco se cargaba. Toda orden nacía
   * en quetzales con tasa 1, aunque el proveedor facturara en dólares — y el
   * detalle y el PDF salían con el signo equivocado.
   *
   * Se sigue el mismo camino que la factura de proveedor: la moneda la
   * propone el proveedor, la tasa la trae Banguat para la fecha de la orden,
   * y se puede corregir a mano.
   */
  const [exchangeRate,       setExchangeRate]       = useState<number>(1)
  const [exchangeRateMeta,   setExchangeRateMeta]   = useState<{ effectiveDate: string; source: string } | null>(null)
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false)
  const [editingRate,        setEditingRate]        = useState(false)

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchVendors('') }, [])

  // Cuando cambia el vendorId: sincroniza impuesto y términos de pago del proveedor
  useEffect(() => {
    if (!vendorId) return
    const found = vendors.find(v => v.value === vendorId)
    if (!found) return
    setVendorDefaultTaxId(found.defaultPurchaseTaxId)
    // La moneda la propone el proveedor: uno en dólares cotiza en dólares.
    if (!id && found.currency) form.setFieldValue('currency', found.currency)
    // Auto-fill términos de pago en órdenes nuevas
    if (!id && found.paymentTerms) {
      form.setFieldValue('paymentTerms', found.paymentTerms)
      if (found.paymentTermsDays != null)
        form.setFieldValue('paymentTermsDays', found.paymentTermsDays)
    }
  }, [vendors, vendorId, id, form])

  // Auto-calcula fecha esperada de entrega cuando cambian los términos de pago + fecha de orden
  const watchPaymentTerms = Form.useWatch('paymentTerms', form) as string | undefined
  const watchOrderDate    = Form.useWatch('orderDate',    form)
  const watchCurr         = (Form.useWatch('currency', form) ?? 'GTQ') as string
  const enDivisa          = watchCurr !== 'GTQ'

  // El tipo de cambio del día de la orden, de Banguat — como en la factura de proveedor.
  useEffect(() => {
    if (watchCurr === 'GTQ') {
      setExchangeRate(1)
      setExchangeRateMeta(null)
      return
    }
    const fecha = watchOrderDate
      ? dayjs(watchOrderDate).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    setLoadingExchangeRate(true)
    getExchangeRateForDate(watchCurr, fecha)
      .then((result: any) => {
        const tasa = result.officialRate ?? (result.rate > 0 ? 1 / result.rate : 1)
        setExchangeRate(Number(Number(tasa).toFixed(6)))
        setExchangeRateMeta({ effectiveDate: result.effectiveDate, source: result.source })
      })
      .catch(() => message.warning('No se pudo cargar el tipo de cambio para la fecha de la orden'))
      .finally(() => setLoadingExchangeRate(false))
  }, [watchCurr, watchOrderDate])

  useEffect(() => {
    if (!watchOrderDate || !watchPaymentTerms || watchPaymentTerms === 'immediate') return
    const days = getPaymentTermDays(watchPaymentTerms)
    if (days && days > 0)
      form.setFieldValue('expectedDeliveryDate', dayjs(watchOrderDate).add(days, 'day'))
  }, [watchPaymentTerms, watchOrderDate, form])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPurchaseOrder(id)
      .then((po) => {
        setPoStatus(po.status as POStatus)
        setVendorId(po.vendorId)
        setVendorName(po.vendorName)
        form.setFieldsValue({
          vendorId:             po.vendorId,
          orderDate:            po.orderDate ? dayjs(po.orderDate) : undefined,
          expectedDeliveryDate: po.expectedDeliveryDate ? dayjs(po.expectedDeliveryDate) : undefined,
          paymentTerms:         po.paymentTerms  ?? undefined,
          paymentTermsDays:     po.paymentTermsDays ?? undefined,
          currency:             po.currency ?? 'GTQ',
          notes:                po.notes ?? '',
        })
        // La tasa guardada manda sobre la del día: es la de ESTA orden.
        if (po.currency && po.currency !== 'GTQ' && Number(po.exchangeRate) > 1) {
          setExchangeRate(Number(po.exchangeRate))
        }
        if (po.vendorId && po.vendorName) {
          setVendors(prev => {
            if (prev.find(v => v.value === po.vendorId)) return prev
            return [{ value: po.vendorId, label: po.vendorName }, ...prev]
          })
        }
        if (po.vendorTaxId) setVendorNit(po.vendorTaxId)
        const loadedItems: LineItem[] = (po.items ?? []).map((it) =>
          newLineItem({
            _key: it.id ?? undefined,
            productId: it.productId,
            description: it.description,
            unit: it.unit,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discountPercent: Number(it.discountPercent ?? 0),
            discountAmount:  Number(it.discountAmount ?? 0) || undefined,
            taxPercent: Number(it.taxPercent ?? 12),
            taxId: it.taxId,
            accountId: it.accountId,
            projectId: it.projectId,
          }),
        )
        setItems(loadedItems.length ? loadedItems : [newLineItem()])
      })
      .catch(() => message.error('No se pudo cargar la orden de compra'))
      .finally(() => setLoading(false))
  }, [id, form])

  const fetchVendors = useCallback((search: string) => {
    setLoadingVendors(true)
    getVendors({ search, limit: 20 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setVendors(prev => {
          const keepMap = new Map(prev.map(v => [v.value, v]))
          list.forEach((v: any) => keepMap.set(v.id, {
            value:                v.id,
            label:                v.legalName ?? v.name,   // Razón Social SAT
            commercialName:       v.name ?? undefined,
            defaultPurchaseTaxId: v.defaultPurchaseTaxId ?? undefined,
            paymentTerms:         v.paymentTerms ?? undefined,
            paymentTermsDays:     v.paymentTermsDays ?? undefined,
            taxId:                v.taxId ?? undefined,
            currency:             v.currency ?? undefined,
          }))
          return [...keepMap.values()]
        })
      })
      .catch(() => {})
      .finally(() => setLoadingVendors(false))
  }, [])

  const handleVendorSearch = (val: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchVendors(val), 300)
  }

  const buildDto = (status: string) => {
    const vals = form.getFieldsValue()
    const lineItems = items.map(({ productId, description, unit, quantity, unitPrice, discountPercent, discountAmount, taxPercent, taxInclusive, taxId, accountId, projectId }) => ({
      productId, description, unit, quantity, unitPrice, discountPercent, discountAmount: discountAmount || undefined, taxPercent, taxInclusive: taxInclusive ?? true, taxId, accountId, projectId,
    }))
    return {
      vendorId:             vals.vendorId,
      orderDate:            vals.orderDate ? vals.orderDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      expectedDeliveryDate: vals.expectedDeliveryDate ? vals.expectedDeliveryDate.format('YYYY-MM-DD') : undefined,
      paymentTerms:         vals.paymentTerms  ?? undefined,
      paymentTermsDays:     vals.paymentTermsDays ?? undefined,
      currency:             vals.currency ?? 'GTQ',
      // En quetzales siempre 1: el servidor la vuelve a normalizar igual.
      exchangeRate:         (vals.currency ?? 'GTQ') !== 'GTQ' ? exchangeRate : 1,
      notes:                vals.notes || undefined,
      status,
      items:                lineItems,
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async (asDraft: boolean) => {
    try { await form.validateFields(['vendorId', 'orderDate']) } catch { return }
    setSaving(true)
    try {
      const dto = buildDto(asDraft ? 'draft' : 'draft')
      let result: any
      if (id) {
        result = await updatePurchaseOrder(id, dto as any)
      } else {
        result = await createPurchaseOrder(dto as any)
      }
      message.success(asDraft ? 'Borrador guardado' : 'Orden guardada')
      navigate(`/compras/ordenes/${result.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? 'Error al guardar la orden de compra')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    if (!id) return
    setSending(true)
    try {
      await sendPurchaseOrder(id, { to: '' })
      setPoStatus('sent')
      message.success('Orden marcada como Enviada al proveedor')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al marcar como enviada')
    } finally { setSending(false) }
  }

  const handleSendEmail = async () => {
    if (!id) return
    setSendingEmail(true)
    try {
      await sendPurchaseOrder(id, { to: emailTo })
      setPoStatus('sent')
      setEmailModal(false)
      setEmailTo('')
      message.success('Orden enviada y marcada como Enviada')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al enviar')
    } finally { setSendingEmail(false) }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleConvert = async () => {
    if (!id) return
    setConverting(true)
    try {
      // Mark PO as billed/received
      await approvePurchaseOrder(id)
      setPoStatus('billed')
      message.success('Creando factura de proveedor desde la orden de compra…')
      // Navigate to new bill form pre-filled with PO data
      navigate('/compras/facturas/nueva', {
        state: {
          fromPO: {
            purchaseOrderId: id,
            vendorId,
            vendorName,
            items,
            // La factura nace en la moneda de la orden, no en quetzales.
            currency:     form.getFieldValue('currency') ?? 'GTQ',
            exchangeRate: enDivisa ? exchangeRate : 1,
          },
        },
      })
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo convertir la orden')
    } finally { setConverting(false) }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deletePurchaseOrder(id)
      message.success('Orden de compra eliminada')
      navigate('/compras/ordenes')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    } finally { setDeleting(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totals    = calcTotals(items)

  const isEditable = !poStatus || poStatus === 'draft' || poStatus === 'sent'
  const statusCfg  = poStatus ? PO_STATUS_CONFIG[poStatus] : null

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  )

  return (
    <div style={{ padding: '24px', background: '#fafbfc', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/compras/ordenes">Órdenes de Compra</Link> },
          { title: id ? 'Editar Orden' : 'Nueva Orden de Compra' },
        ]}
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title={<span style={{ color: '#1faec2', fontWeight: 600 }}>{id ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}</span>}>
            <Form form={form} layout="vertical" size="small">
              {/* Fila 1: NIT | Proveedor | Términos de pago */}
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 220px', gap: '0 12px' }}>
                <Form.Item label="NIT" style={{ marginBottom: 8 }}>
                  <Input value={vendorNit} onChange={e => setVendorNit(e.target.value)} placeholder="1234567-8" disabled={!isEditable} />
                </Form.Item>

                <Form.Item
                  name="vendorId"
                  label="Proveedor"
                  rules={[{ required: true, message: 'Seleccione un proveedor' }]}
                  style={{ marginBottom: 8 }}
                >
                  <Select
                    showSearch
                    placeholder="Buscar por Razón Social o nombre comercial…"
                    filterOption={false}
                    loading={loadingVendors}
                    onSearch={handleVendorSearch}
                    notFoundContent={loadingVendors ? 'Buscando…' : 'Sin resultados'}
                    onChange={(v) => {
                      const selected = vendors.find(vn => vn.value === v)
                      setVendorId(v)
                      setVendorName(selected?.label)
                      setVendorDefaultTaxId(selected?.defaultPurchaseTaxId)
                      setVendorNit(selected?.taxId ?? '')
                    }}
                    disabled={!isEditable}
                    optionRender={(opt) => {
                      const v = vendors.find(x => x.value === opt.value)
                      return (
                        <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                          {v?.commercialName && v.commercialName !== opt.label?.toString() && (
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{v.commercialName}</div>
                          )}
                        </div>
                      )
                    }}
                    options={vendors.map(v => ({ value: v.value, label: v.label }))}
                  />
                </Form.Item>

                <Form.Item name="paymentTerms" label="Términos de pago" style={{ marginBottom: 8 }}>
                  <PaymentTermsSelect size="small" disabled={!isEditable} />
                </Form.Item>
              </div>

              {/* Fila 2: Fechas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item
                  name="orderDate"
                  label="Fecha de Orden"
                  rules={[{ required: true, message: 'Ingrese la fecha' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabled={!isEditable} />
                </Form.Item>

                <Form.Item name="expectedDeliveryDate" label="Fecha Estimada de Entrega">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabled={!isEditable} />
                </Form.Item>
              </div>

              {/* Fila 3: Moneda — la propone el proveedor y se puede cambiar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="currency" label="Moneda" style={{ marginBottom: 8 }}>
                  <Select
                    disabled={!isEditable}
                    options={[
                      { value: 'GTQ', label: 'GTQ — Quetzal' },
                      { value: 'USD', label: 'USD — Dólar' },
                    ]}
                  />
                </Form.Item>
              </div>

              {/*
                * El tipo de cambio, solo cuando la orden no es en quetzales.
                * Es de referencia —la que manda es la de la factura cuando la
                * orden se convierte—, pero sin él no hay con qué leer la orden
                * en quetzales, que es la moneda del mayor.
                */}
              {enDivisa && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 12px', marginBottom: 12,
                  background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    1 {watchCurr} =
                  </span>
                  {editingRate ? (
                    <InputNumber
                      value={exchangeRate}
                      precision={6} min={0.000001} step={0.01}
                      style={{ width: 130 }} autoFocus addonAfter="GTQ"
                      onChange={(v: number | null) => setExchangeRate(v ?? 1)}
                      onBlur={() => setEditingRate(false)}
                      onPressEnter={() => setEditingRate(false)}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                      {loadingExchangeRate ? '...' : exchangeRate.toFixed(6)} GTQ
                    </span>
                  )}
                  <Button
                    size="small" type="text" icon={<EditOutlined />}
                    onClick={() => setEditingRate(!editingRate)}
                    title="Editar tipo de cambio manualmente"
                    style={{ color: '#374151' }}
                    disabled={loadingExchangeRate || !isEditable}
                  />
                  <span style={{ fontSize: 11, color: '#9aa1ab', marginLeft: 4 }}>
                    {loadingExchangeRate
                      ? 'Consultando Banguat...'
                      : exchangeRateMeta
                        ? `Tasa del ${dayjs(exchangeRateMeta.effectiveDate).format('DD/MM/YYYY')} (${exchangeRateMeta.source})`
                        : 'Escríbela si Banguat no la tiene'}
                  </span>
                </div>
              )}
            </Form>
          </Card>

          <Card title="Líneas de Orden" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="po"
              vendorDefaultTaxId={vendorDefaultTaxId}
              currency={watchCurr}
            />
          </Card>

          <Card title="Notas">
            <Form form={form} layout="vertical" size="small">
              <Form.Item name="notes" label="Notas / Instrucciones al Proveedor">
                <Input.TextArea rows={4} placeholder="Instrucciones de entrega, condiciones especiales…" disabled={!isEditable} />
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Resumen" styles={{ body: { padding: '16px' } }}>
            <DocumentTotals
              subtotal={totals.subtotal}
              taxAmount={totals.taxAmount}
              total={totals.total}
              hasInclusive={totals.hasInclusive}
              taxBreakdown={totals.taxBreakdown}
              currency={watchCurr}
              exchangeRate={enDivisa ? exchangeRate : undefined}
            />
          </Card>

          {/* Actions */}
          <Card
            title={
              <Space>
                Acciones
                {statusCfg && <Tag color={statusCfg.color}>{statusCfg.label}</Tag>}
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Guardar borrador */}
              {isEditable && (
                <Button
                  block icon={<SaveOutlined />} loading={saving}
                  onClick={() => handleSave(true)}
                  style={{ borderColor: '#1faec2', color: '#1faec2' }}
                >
                  Guardar borrador
                </Button>
              )}

              {/* Guardar orden */}
              {isEditable && (
                <Button
                  block type="primary" icon={<ShoppingCartOutlined />} loading={saving}
                  onClick={() => handleSave(false)}
                >
                  Guardar orden
                </Button>
              )}

              {/* Marcar como enviada */}
              {id && poStatus === 'draft' && (
                <Button
                  block icon={<SendOutlined />} loading={sending}
                  onClick={handleSend}
                  style={{ borderColor: '#1faec2', color: '#1faec2' }}
                >
                  Marcar como enviada
                </Button>
              )}

              {/* Marcar como recibida */}
              {id && poStatus === 'sent' && (
                <Button
                  block icon={<CheckCircleOutlined />} loading={sending}
                  onClick={async () => {
                    setSending(true)
                    try {
                      await approvePurchaseOrder(id)
                      setPoStatus('received')
                      message.success('Orden marcada como Recibida')
                    } catch { message.error('Error') } finally { setSending(false) }
                  }}
                  style={{ borderColor: '#2ea172', color: '#2ea172' }}
                >
                  Marcar como recibida
                </Button>
              )}

              {/* Imprimir */}
              {id && (
                <Button
                  block icon={<FilePdfOutlined />}
                  onClick={handlePrint}
                  style={{ borderColor: '#ff7f00', color: '#ff7f00' }}
                >
                  Imprimir / PDF
                </Button>
              )}

              {/* Enviar por correo */}
              {id && poStatus !== 'cancelled' && poStatus !== 'billed' && (
                <Button
                  block icon={<MailOutlined />}
                  onClick={() => setEmailModal(true)}
                  style={{ borderColor: '#2ea172', color: '#2ea172' }}
                >
                  Enviar por correo
                </Button>
              )}

              {/* Convertir a Factura Proveedor */}
              {id && poStatus !== 'cancelled' && poStatus !== 'billed' && poStatus !== 'draft' && (
                <Button
                  block icon={<SwapOutlined />} loading={converting}
                  onClick={handleConvert}
                  style={{ borderColor: '#2ea172', color: '#2ea172' }}
                >
                  Convertir a Factura Proveedor
                </Button>
              )}

              {/* Eliminar */}
              {id && poStatus !== 'billed' && (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <Popconfirm
                    title="¿Eliminar esta orden de compra?"
                    description="Esta acción no se puede deshacer."
                    onConfirm={handleDelete}
                    okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true, loading: deleting }}
                  >
                    <Button block danger icon={<DeleteOutlined />}>
                      Eliminar orden
                    </Button>
                  </Popconfirm>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Email modal */}
      <Modal
        title="Enviar orden de compra por correo"
        open={emailModal}
        onCancel={() => { setEmailModal(false); setEmailTo('') }}
        onOk={handleSendEmail}
        okText="Enviar"
        okButtonProps={{ loading: sendingEmail, disabled: !emailTo.trim(), style: { background: '#1faec2' } }}
        cancelText="Cancelar"
      >
        <p style={{ marginBottom: 12 }}>
          Ingresa el correo del proveedor al que deseas enviar esta orden.
        </p>
        <Input
          type="email"
          prefix={<MailOutlined />}
          placeholder="correo@proveedor.com"
          value={emailTo}
          onChange={e => setEmailTo(e.target.value)}
          onPressEnter={handleSendEmail}
        />
      </Modal>
    </div>
  )
}
