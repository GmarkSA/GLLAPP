import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, InputNumber, Input, Button,
  Card, Breadcrumb, Typography, Spin, Divider, Space, message,
} from 'antd'
import {
  SaveOutlined, CheckOutlined, HomeOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import { createBill, updateBill, getBill, getVendors, type Vendor } from '../../../api/compras'
import { getTaxes, type Tax } from '../../../api/impuestos'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import DocumentTotals from '../../../components/DocumentForm/DocumentTotals'

const { Title, Text } = Typography

const fmt = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

interface VendorOption { value: string; label: string }

export default function FacturaProveedorFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [items, setItems] = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [retentionAmount, setRetentionAmount] = useState<number>(0)

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
    getBill(id)
      .then((bill) => {
        form.setFieldsValue({
          vendorId: bill.vendorId,
          invoiceDate: bill.invoiceDate ? dayjs(bill.invoiceDate) : undefined,
          dueDate: bill.dueDate ? dayjs(bill.dueDate) : undefined,
          currency: bill.currency ?? 'GTQ',
          vendorInvoiceNumber: bill.vendorInvoiceNumber ?? '',
        })
        if (bill.vendorId && bill.vendorName) {
          setVendors([{ value: bill.vendorId, label: bill.vendorName }])
        }
        setRetentionAmount(Number(bill.retentionAmount ?? 0))
        const loadedItems: LineItem[] = (bill.items ?? []).map((it) =>
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
      invoiceDate: vals.invoiceDate ? vals.invoiceDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      dueDate: vals.dueDate ? vals.dueDate.format('YYYY-MM-DD') : undefined,
      currency: vals.currency ?? 'GTQ',
      vendorInvoiceNumber: vals.vendorInvoiceNumber || undefined,
      retentionAmount: retentionAmount || 0,
      status,
      items: lineItems,
    }
  }

  const handleSave = async (asDraft: boolean) => {
    try {
      await form.validateFields(['vendorId', 'invoiceDate'])
    } catch {
      return
    }
    setSaving(true)
    try {
      const dto = buildDto(asDraft ? 'draft' : 'open')
      let result: any
      if (id) {
        result = await updateBill(id, dto as any)
      } else {
        result = await createBill(dto as any)
      }
      message.success(asDraft ? 'Borrador guardado' : 'Factura registrada')
      navigate(`/compras/facturas/${result.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? 'Error al guardar la factura')
    } finally {
      setSaving(false)
    }
  }

  const totals      = calcTotals(items)
  const watchCurr   = Form.useWatch('currency', form) ?? 'GTQ'
  const netTotal    = Math.round((totals.total - retentionAmount) * 100) / 100

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Cargando factura…" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/compras/facturas">Facturas Proveedor</Link> },
          { title: id ? 'Editar Factura' : 'Nueva Factura Proveedor' },
        ]}
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header fields */}
          <Card title={<span style={{ color: '#1B3A6B', fontWeight: 600 }}>{id ? 'Editar Factura Proveedor' : 'Nueva Factura Proveedor'}</span>}>
            <Form form={form} layout="vertical" initialValues={{ currency: 'GTQ' }}>
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

                <Form.Item name="vendorInvoiceNumber" label="No. Factura Proveedor">
                  <Input placeholder="Ej. F001-000123" />
                </Form.Item>

                <Form.Item
                  name="invoiceDate"
                  label="Fecha de Factura"
                  rules={[{ required: true, message: 'Ingrese la fecha' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="dueDate" label="Fecha de Vencimiento">
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

          {/* Line Items */}
          <Card title="Líneas de Factura" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="bill"
            />
          </Card>

          {/* Notes */}
          <Card title="Notas">
            <Form form={form} layout="vertical">
              <Form.Item name="notes" label="Notas internas">
                <Input.TextArea rows={3} placeholder="Notas internas sobre esta factura…" />
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
            <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#8c8c8c' }}>Retención ISR</Text>
                <InputNumber
                  size="small"
                  min={0}
                  step={0.01}
                  prefix="Q"
                  value={retentionAmount}
                  onChange={(v) => setRetentionAmount(v ?? 0)}
                  style={{ width: 120 }}
                />
              </div>
              {retentionAmount > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginTop: 10, background: '#fff7e6', borderRadius: 6,
                  padding: '8px 12px', border: '1px solid #ffd591',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: 600, color: '#d46b08' }}>Neto a Pagar</Text>
                  <Text style={{ fontSize: 15, fontWeight: 700, color: '#d46b08' }}>
                    {watchCurr} {netTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </Text>
                </div>
              )}
            </div>
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
                icon={<CheckOutlined />}
                loading={saving}
                onClick={() => handleSave(false)}
                style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }}
              >
                Registrar factura
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  )
}

