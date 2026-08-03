import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, InputNumber, Input, Button,
  Card, Breadcrumb, Typography, Spin, Divider, Space, message,
  Tag, Popconfirm, Modal,
} from 'antd'
import {
  SaveOutlined, FileTextOutlined, HomeOutlined, SendOutlined,
  DeleteOutlined, SwapOutlined, FilePdfOutlined, MailOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createEstimate, updateEstimate, getEstimate, sendEstimate, deleteEstimate, convertEstimate,
  type CreateEstimateDto, ESTIMATE_STATUS_CONFIG, type EstimateStatus,
} from '../../../api/facturas'
import { getCustomers, getCustomer } from '../../../api/contactos'
import SelectorDimensionesAnaliticas, { type DimensionesValue } from '../../../components/SelectorDimensionesAnaliticas'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getProduct } from '../../../api/inventario'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import DocumentTotals from '../../../components/DocumentForm/DocumentTotals'

const { Title, Text } = Typography

const fmt = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

interface CustomerOption { value: string; label: string; commercialName?: string }

export default function EstimacionFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [items, setItems] = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertModal, setConvertModal] = useState(false)
  const [status, setStatus] = useState<EstimateStatus | null>(null)
  const [emailModal, setEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const [customerNit, setCustomerNit] = useState<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => message.error('No se pudieron cargar los impuestos'))
  }, [])

  useEffect(() => {
    fetchCustomers('')
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getEstimate(id)
      .then((est) => {
        setStatus(est.status as EstimateStatus)
        if (est.customerTaxId) setCustomerNit(est.customerTaxId)
        form.setFieldsValue({
          customerId: est.customerId,
          estimateDate: est.estimateDate ? dayjs(est.estimateDate) : undefined,
          expiryDate: est.expiryDate ? dayjs(est.expiryDate) : undefined,
          currency: est.currency ?? 'GTQ',
          discountPercent: 0,
          notes: est.notes ?? '',
          termsAndConditions: est.termsAndConditions ?? '',
          dimensiones: { centroBeneficioId: est.centroBeneficioId ?? null, centroCostoId: null },
        })
        if (est.customerId && est.customerName) {
          setCustomers([{ value: est.customerId, label: est.customerName }])
        }
        const loadedItems: LineItem[] = (est.items ?? []).map((it) =>
          newLineItem({
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

        // Actualizar stockOnHand con datos actuales de inventario
        const productIds = [...new Set(loadedItems.map(i => i.productId).filter(Boolean))] as string[]
        if (productIds.length > 0) {
          Promise.all(productIds.map(pid => getProduct(pid).catch(() => null))).then(products => {
            const stockMap = new Map(
              products.filter(Boolean).map(p => [p!.id, { stock: Number(p!.stockOnHand ?? 0), inventoriable: p!.isInventoriable ?? false }])
            )
            setItems(prev => prev.map(item => {
              if (!item.productId) return item
              const info = stockMap.get(item.productId)
              return info ? { ...item, stockOnHand: info.stock, isInventoriable: info.inventoriable } : item
            }))
          })
        }

        setItems(loadedItems.length ? loadedItems : [newLineItem()])
      })
      .catch(() => message.error('No se pudo cargar la cotización'))
      .finally(() => setLoading(false))
  }, [id, form])

  const fetchCustomers = useCallback((search: string) => {
    setLoadingCustomers(true)
    getCustomers({ search, limit: 20 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map((c) => ({
          value: c.id,
          label: c.legalName ?? c.name,
          commercialName: c.name,
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))
  }, [])

  const handleCustomerSearch = (val: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCustomers(val), 300)
  }

  const handleCustomerSelect = (customerId: string) => {
    getCustomer(customerId)
      .then((cust: any) => setCustomerNit(cust?.taxId ?? ''))
      .catch(() => setCustomerNit(''))
  }

  const buildDto = (): CreateEstimateDto => {
    const vals = form.getFieldsValue()
    const lineItems = items.map(({ productId, description, unit, quantity, unitPrice, discountPercent, taxPercent, taxInclusive, taxId, accountId, projectId }) => ({
      productId,
      description,
      unit,
      quantity,
      unitPrice,
      discountPercent,
      taxPercent,
      taxInclusive: taxInclusive ?? true,
      taxId,
      accountId,
      projectId,
    }))
    const dimensiones: DimensionesValue | undefined = vals.dimensiones
    return {
      customerId: vals.customerId,
      estimateDate: vals.estimateDate ? vals.estimateDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      expiryDate: vals.expiryDate ? vals.expiryDate.format('YYYY-MM-DD') : undefined,
      currency: vals.currency ?? 'GTQ',
      discountPercent: vals.discountPercent ?? 0,
      notes: vals.notes || undefined,
      termsAndConditions: vals.termsAndConditions || undefined,
      items: lineItems,
      centroBeneficioId: dimensiones?.centroBeneficioId ?? null,
    }
  }

  const handleSave = async (asDraft: boolean) => {
    try {
      await form.validateFields(['customerId', 'estimateDate'])
    } catch {
      return
    }
    setSaving(true)
    try {
      const dto = buildDto()
      const statusDto = asDraft ? { ...dto, status: 'draft' } : dto
      let result: any
      if (id) {
        result = await updateEstimate(id, statusDto as any)
      } else {
        result = await createEstimate(statusDto as any)
      }
      message.success(asDraft ? 'Borrador guardado' : 'Cotización guardada')
      navigate(`/ventas/estimaciones/${result.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? 'Error al guardar la cotización')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    if (!id) return
    setSending(true)
    try {
      await sendEstimate(id, { to: '' })
      setStatus('sent')
      message.success('Cotización marcada como Enviada')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al enviar')
    } finally { setSending(false) }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await deleteEstimate(id)
      message.success('Cotización eliminada')
      navigate('/ventas/estimaciones')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const handlePrint = () => {
    if (id) window.open(`/ventas/estimaciones/${id}/imprimir`, '_blank')
  }

  const handleSendEmail = async () => {
    if (!id) return
    setSendingEmail(true)
    try {
      await sendEstimate(id, { to: emailTo })
      setStatus('sent')
      setEmailModal(false)
      setEmailTo('')
      message.success('Cotización enviada y marcada como Enviada')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al enviar')
    } finally { setSendingEmail(false) }
  }

  const handleConvert = async () => {
    if (!id) return
    setConverting(true)
    try {
      const invoice = await convertEstimate(id)
      setConvertModal(false)
      message.success('Cotización convertida a factura exitosamente')
      navigate(`/ventas/facturas/${invoice.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo convertir')
    } finally { setConverting(false) }
  }

  const totals      = calcTotals(items)
  const discountPct = Form.useWatch('discountPercent', form) ?? 0
  const watchCurr   = Form.useWatch('currency', form) ?? 'GTQ'

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Cargando cotización…" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', background: '#fafbfc', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/ventas/estimaciones">Cotizaciones</Link> },
          { title: id ? 'Editar Cotización' : 'Nueva Cotización' },
        ]}
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header fields */}
          <Card title={<span style={{ color: '#1faec2', fontWeight: 600 }}>{id ? 'Editar Cotización' : 'Nueva Cotización'}</span>}>
            <Form form={form} layout="vertical" initialValues={{ currency: 'GTQ', discountPercent: 0 }}>
              {/* Fila 1: NIT | Cliente | División */}
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 220px', gap: '0 12px' }}>
                <Form.Item label="NIT" style={{ marginBottom: 8 }}>
                  <Input
                    value={customerNit}
                    onChange={e => setCustomerNit(e.target.value)}
                    placeholder="1234567-8"
                    size="small"
                  />
                </Form.Item>
                <Form.Item
                  name="customerId"
                  label="Cliente"
                  rules={[{ required: true, message: 'Seleccione un cliente' }]}
                  style={{ marginBottom: 8 }}
                >
                  <Select
                    showSearch
                    placeholder="Buscar por Razón Social o nombre comercial…"
                    filterOption={false}
                    loading={loadingCustomers}
                    onSearch={handleCustomerSearch}
                    onSelect={handleCustomerSelect}
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
                <Form.Item name="dimensiones" label="División" style={{ marginBottom: 8 }}>
                  <SelectorDimensionesAnaliticas layout="compact" showCentroCosto={false} size="small" />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Form.Item name="currency" label="Moneda">
                  <Select options={[
                    { value: 'GTQ', label: 'GTQ — Quetzal' },
                    { value: 'USD', label: 'USD — Dólar' },
                  ]} />
                </Form.Item>

                <Form.Item
                  name="estimateDate"
                  label="Fecha de Cotización"
                  rules={[{ required: true, message: 'Ingrese la fecha' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="expiryDate" label="Fecha de Expiración">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="discountPercent" label="Descuento Global (%)" style={{ gridColumn: 'span 2' }}>
                  <InputNumber min={0} max={100} step={1} suffix="%" style={{ width: 160 }} />
                </Form.Item>
              </div>
            </Form>
          </Card>

          {/* Line Items */}
          <Card title="Líneas de Cotización" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="estimate"
            />
          </Card>

          {/* Notes & Terms */}
          <Card title="Notas y Términos">
            <Form form={form} layout="vertical">
              <Form.Item name="notes" label="Notas">
                <Input.TextArea rows={3} placeholder="Notas visibles en la cotización…" />
              </Form.Item>
              <Form.Item name="termsAndConditions" label="Términos y Condiciones">
                <Input.TextArea rows={3} placeholder="Términos y condiciones…" />
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Totals */}
          <Card title="Resumen" styles={{ body: { padding: '16px' } }}>
            <DocumentTotals
              subtotal={totals.subtotal}
              taxAmount={totals.taxAmount}
              total={totals.total}
              hasInclusive={totals.hasInclusive}
              taxBreakdown={totals.taxBreakdown}
              discountPercent={discountPct}
              currency={watchCurr}
              showDiscountInput
              onDiscountChange={v => form.setFieldValue('discountPercent', v)}
            />
          </Card>

          {/* Actions */}
          <Card title={
            <Space>
              Acciones
              {id && status && (() => {
                const cfg = ESTIMATE_STATUS_CONFIG[status]
                return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : null
              })()}
            </Space>
          }>
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* Save actions — only for editable statuses */}
              {(!id || status === 'draft' || status === 'sent') && (
                <Button
                  block
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => handleSave(true)}
                  style={{ borderColor: '#1faec2', color: '#1faec2' }}
                >
                  Guardar borrador
                </Button>
              )}
              {(!id || status === 'draft' || status === 'sent') && (
                <Button
                  block
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={saving}
                  onClick={() => handleSave(false)}
                  style={{ background: '#1faec2', borderColor: '#1faec2' }}
                >
                  Guardar cotización
                </Button>
              )}

              {/* Send — only for draft */}
              {id && status === 'draft' && (
                <Button
                  block
                  icon={<SendOutlined />}
                  loading={sending}
                  onClick={handleSend}
                  style={{ borderColor: '#1faec2', color: '#1faec2' }}
                >
                  Marcar como enviada
                </Button>
              )}

              {/* PDF / Print */}
              {id && (
                <Button
                  block
                  icon={<FilePdfOutlined />}
                  onClick={handlePrint}
                  style={{ borderColor: '#ff7f00', color: '#ff7f00' }}
                >
                  Descargar / Imprimir PDF
                </Button>
              )}

              {/* Send by email */}
              {id && status !== 'invoiced' && status !== 'declined' && (
                <Button
                  block
                  icon={<MailOutlined />}
                  onClick={() => setEmailModal(true)}
                  style={{ borderColor: '#2ea172', color: '#2ea172' }}
                >
                  Enviar por correo
                </Button>
              )}

              {/* Convert to Invoice */}
              {id && status !== 'invoiced' && status !== 'declined' && (
                <>
                  <Button
                    block
                    icon={<SwapOutlined />}
                    onClick={() => setConvertModal(true)}
                    style={{ borderColor: '#2ea172', color: '#2ea172' }}
                  >
                    Convertir a Factura
                  </Button>
                </>
              )}

              {/* Delete */}
              {id && (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <Popconfirm
                    title="¿Eliminar esta cotización?"
                    description="Esta acción no se puede deshacer."
                    onConfirm={handleDelete}
                    okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
                  >
                    <Button block danger icon={<DeleteOutlined />}>
                      Eliminar cotización
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </Card>
        </div>
      </div>

      {/* Email modal */}
      <Modal
        title="Enviar cotización por correo"
        open={emailModal}
        onCancel={() => { setEmailModal(false); setEmailTo('') }}
        onOk={handleSendEmail}
        okText="Enviar"
        okButtonProps={{ loading: sendingEmail, disabled: !emailTo.trim(), style: { background: '#1faec2' } }}
        cancelText="Cancelar"
      >
        <p style={{ marginBottom: 12 }}>
          Ingresa el correo del cliente al que deseas enviar esta cotización.
        </p>
        <Input
          type="email"
          prefix={<MailOutlined />}
          placeholder="correo@cliente.com"
          value={emailTo}
          onChange={e => setEmailTo(e.target.value)}
          onPressEnter={handleSendEmail}
          autoFocus
        />
        <p style={{ marginTop: 10, color: '#6b7280', fontSize: 12 }}>
          La cotización quedará marcada como <strong>Enviada</strong>.
        </p>
      </Modal>

      {/* Convert to Invoice modal */}
      <Modal
        title="Convertir a Factura"
        open={convertModal}
        onCancel={() => setConvertModal(false)}
        onOk={handleConvert}
        okText="Convertir"
        okButtonProps={{ loading: converting, style: { background: '#1faec2' } }}
        cancelText="Cancelar"
      >
        <p>¿Convertir esta cotización a factura de venta?</p>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Se creará una nueva factura en borrador con los mismos ítems y montos.
          La cotización quedará marcada como <em>Facturada</em>.
        </p>
      </Modal>
    </div>
  )
}

