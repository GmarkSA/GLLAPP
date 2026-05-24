import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, Input, Button,
  Card, Breadcrumb, Spin, Space, message,
} from 'antd'
import {
  SaveOutlined, ShoppingCartOutlined, HomeOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createPurchaseOrder, updatePurchaseOrder, getPurchaseOrder,
  getVendors,
} from '../../../api/compras'
import { getTaxes, type Tax } from '../../../api/impuestos'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import DocumentTotals from '../../../components/DocumentForm/DocumentTotals'

interface VendorOption { value: string; label: string }

export default function OrdenCompraFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [items, setItems] = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => message.error('No se pudieron cargar los impuestos'))
  }, [])

  useEffect(() => {
    fetchVendors('')
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPurchaseOrder(id)
      .then((po) => {
        form.setFieldsValue({
          vendorId: po.vendorId,
          orderDate: po.orderDate ? dayjs(po.orderDate) : undefined,
          expectedDeliveryDate: po.expectedDeliveryDate ? dayjs(po.expectedDeliveryDate) : undefined,
          notes: po.notes ?? '',
        })
        if (po.vendorId && po.vendorName) {
          setVendors([{ value: po.vendorId, label: po.vendorName }])
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
        setVendors(list.map((v) => ({ value: v.id, label: v.name })))
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
    const lineItems = items.map(({ productId, description, unit, quantity, unitPrice, discountPercent, taxPercent, taxId, accountId, projectId }) => ({
      productId,
      description,
      unit,
      quantity,
      unitPrice,
      discountPercent,
      taxPercent,
      taxId,
      accountId,
      projectId,
    }))
    return {
      vendorId: vals.vendorId,
      orderDate: vals.orderDate ? vals.orderDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      expectedDeliveryDate: vals.expectedDeliveryDate
        ? vals.expectedDeliveryDate.format('YYYY-MM-DD')
        : undefined,
      notes: vals.notes || undefined,
      status,
      items: lineItems,
    }
  }

  const handleSave = async (asDraft: boolean) => {
    try {
      await form.validateFields(['vendorId', 'orderDate'])
    } catch {
      return
    }
    setSaving(true)
    try {
      const dto = buildDto(asDraft ? 'draft' : 'sent')
      let result: any
      if (id) {
        result = await updatePurchaseOrder(id, dto as any)
      } else {
        result = await createPurchaseOrder(dto as any)
      }
      message.success(asDraft ? 'Borrador guardado' : 'Orden de compra creada')
      navigate(`/compras/ordenes/${result.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? 'Error al guardar la orden de compra')
    } finally {
      setSaving(false)
    }
  }

  const totals    = calcTotals(items)
  const watchCurr = Form.useWatch('currency', form) ?? 'GTQ'

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Cargando orden de compra…" />
      </div>
    )
  }

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
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header fields */}
          <Card title={<span style={{ color: '#1B3A6B', fontWeight: 600 }}>{id ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}</span>}>
            <Form form={form} layout="vertical">
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
                  />
                </Form.Item>

                <div /> {/* spacer to keep grid alignment */}

                <Form.Item
                  name="orderDate"
                  label="Fecha de Orden"
                  rules={[{ required: true, message: 'Ingrese la fecha' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="expectedDeliveryDate" label="Fecha Estimada de Entrega">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </div>
            </Form>
          </Card>

          {/* Line Items */}
          <Card title="Líneas de Orden" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="po"
            />
          </Card>

          {/* Notes */}
          <Card title="Notas">
            <Form form={form} layout="vertical">
              <Form.Item name="notes" label="Notas / Instrucciones al Proveedor">
                <Input.TextArea rows={4} placeholder="Instrucciones de entrega, condiciones especiales…" />
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
              currency={watchCurr}
            />
          </Card>

          {/* Actions */}
          <Card title="Acciones">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                icon={<SaveOutlined />}
                loading={saving}
                onClick={() => handleSave(true)}
                style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
              >
                Guardar borrador
              </Button>
              <Button
                block
                type="primary"
                icon={<ShoppingCartOutlined />}
                loading={saving}
                onClick={() => handleSave(false)}
                style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }}
              >
                Crear orden
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  )
}

