import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, Input, Button,
  Card, Breadcrumb, Spin, Space, message, Tag,
  Divider, Popconfirm, Modal,
} from 'antd'
import {
  SaveOutlined, ShoppingCartOutlined, HomeOutlined, SendOutlined,
  DeleteOutlined, SwapOutlined, FilePdfOutlined, MailOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createPurchaseOrder, updatePurchaseOrder, getPurchaseOrder,
  sendPurchaseOrder, deletePurchaseOrder, approvePurchaseOrder,
  getVendors, PO_STATUS_CONFIG, type POStatus,
} from '../../../api/compras'
import { getTaxes, type Tax } from '../../../api/impuestos'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import DocumentTotals from '../../../components/DocumentForm/DocumentTotals'

interface VendorOption { value: string; label: string; defaultPurchaseTaxId?: string }

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
  const [emailModal, setEmailModal]     = useState(false)
  const [emailTo, setEmailTo]           = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchVendors('') }, [])

  // Cuando la lista de vendors llega (o cuando cambia el vendorId), sincroniza el impuesto
  useEffect(() => {
    if (!vendorId) return
    const found = vendors.find(v => v.value === vendorId)
    if (found) setVendorDefaultTaxId(found.defaultPurchaseTaxId)
  }, [vendors, vendorId])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPurchaseOrder(id)
      .then((po) => {
        setPoStatus(po.status as POStatus)
        setVendorId(po.vendorId)
        setVendorName(po.vendorName)
        form.setFieldsValue({
          vendorId: po.vendorId,
          orderDate: po.orderDate ? dayjs(po.orderDate) : undefined,
          expectedDeliveryDate: po.expectedDeliveryDate ? dayjs(po.expectedDeliveryDate) : undefined,
          notes: po.notes ?? '',
        })
        if (po.vendorId && po.vendorName) {
          setVendors(prev => {
            if (prev.find(v => v.value === po.vendorId)) return prev
            return [{ value: po.vendorId, label: po.vendorName }, ...prev]
          })
        }
        const loadedItems: LineItem[] = (po.items ?? []).map((it) =>
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
      .catch(() => message.error('No se pudo cargar la orden de compra'))
      .finally(() => setLoading(false))
  }, [id, form])

  const fetchVendors = useCallback((search: string) => {
    setLoadingVendors(true)
    getVendors({ search, limit: 20 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setVendors(prev => {
          // Conservar proveedores ya seleccionados (con su defaultPurchaseTaxId)
          const keepMap = new Map(prev.map(v => [v.value, v]))
          list.forEach((v: any) => keepMap.set(v.id, {
            value: v.id,
            label: v.name,
            defaultPurchaseTaxId: v.defaultPurchaseTaxId ?? undefined,
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
    const lineItems = items.map(({ productId, description, unit, quantity, unitPrice, discountPercent, taxPercent, taxInclusive, taxId, accountId, projectId }) => ({
      productId, description, unit, quantity, unitPrice, discountPercent, taxPercent, taxInclusive: taxInclusive ?? true, taxId, accountId, projectId,
    }))
    return {
      vendorId: vals.vendorId,
      orderDate: vals.orderDate ? vals.orderDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      expectedDeliveryDate: vals.expectedDeliveryDate ? vals.expectedDeliveryDate.format('YYYY-MM-DD') : undefined,
      notes: vals.notes || undefined,
      status,
      items: lineItems,
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
  const watchCurr = Form.useWatch('currency', form) ?? 'GTQ'
  const isEditable = !poStatus || poStatus === 'draft' || poStatus === 'sent'
  const statusCfg  = poStatus ? PO_STATUS_CONFIG[poStatus] : null

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  )

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
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
          <Card title={<span style={{ color: '#1B3A6B', fontWeight: 600 }}>{id ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}</span>}>
            <Form form={form} layout="vertical" size="small">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Form.Item
                  name="vendorId"
                  label="Proveedor"
                  rules={[{ required: true, message: 'Seleccione un proveedor' }]}
                >
                  <Select
                    showSearch
                    placeholder="Buscar proveedor…"
                    filterOption={false}
                    loading={loadingVendors}
                    onSearch={handleVendorSearch}
                    options={vendors}
                    notFoundContent={loadingVendors ? 'Buscando…' : 'Sin resultados'}
                    onChange={(v) => {
                      const selected = vendors.find(vn => vn.value === v)
                      setVendorId(v)
                      setVendorName(selected?.label)
                      setVendorDefaultTaxId(selected?.defaultPurchaseTaxId)
                    }}
                    disabled={!isEditable}
                  />
                </Form.Item>

                <div />

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
            </Form>
          </Card>

          <Card title="Líneas de Orden" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="po"
              vendorDefaultTaxId={vendorDefaultTaxId}
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
                  style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
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
                  style={{ borderColor: '#1890ff', color: '#1890ff' }}
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
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                >
                  Marcar como recibida
                </Button>
              )}

              {/* Imprimir */}
              {id && (
                <Button
                  block icon={<FilePdfOutlined />}
                  onClick={handlePrint}
                  style={{ borderColor: '#fa8c16', color: '#fa8c16' }}
                >
                  Imprimir / PDF
                </Button>
              )}

              {/* Enviar por correo */}
              {id && poStatus !== 'cancelled' && poStatus !== 'billed' && (
                <Button
                  block icon={<MailOutlined />}
                  onClick={() => setEmailModal(true)}
                  style={{ borderColor: '#52c41a', color: '#52c41a' }}
                >
                  Enviar por correo
                </Button>
              )}

              {/* Convertir a Factura Proveedor */}
              {id && poStatus !== 'cancelled' && poStatus !== 'billed' && poStatus !== 'draft' && (
                <Button
                  block icon={<SwapOutlined />} loading={converting}
                  onClick={handleConvert}
                  style={{ borderColor: '#52c41a', color: '#52c41a' }}
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
        okButtonProps={{ loading: sendingEmail, disabled: !emailTo.trim(), style: { background: '#1B3A6B' } }}
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
