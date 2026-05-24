import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Row, Col, Button, Typography, Space, Tag, Table, Modal,
  Form, Input, InputNumber, Select, DatePicker, message, Spin,
  Statistic, Divider, Popconfirm, Tooltip, Steps, Badge, Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  CalculatorOutlined, CheckCircleOutlined, FileAddOutlined,
  GlobalOutlined, LinkOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getExpediente, createExpediente, addExpedienteDocumento, removeExpedienteDocumento,
  addExpedienteLinea, removeExpedienteLinea, recalcularExpediente,
  confirmarExpediente, updateExpedienteStatus,
  EXPEDIENTE_STATUS, DOCUMENT_TYPE_CONFIG,
  type Expediente, type ExpedienteDocumento, type ExpedienteLinea,
} from '../../api/expedientes'
import { getProducts, type Product } from '../../api/inventario'
import { getBills, getExpenses, type PurchaseInvoice, type Expense } from '../../api/compras'

const { Title, Text } = Typography
const { Option }      = Select

const fmtQ = (v: number, d = 2) =>
  'Q ' + Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── Status steps ─────────────────────────────────────────────────────────────
const STATUS_ORDER = ['abierto', 'en_transito', 'en_aduana', 'bodega', 'confirmado']

// ── Modal: Agregar documento (con vinculación real a Compras) ─────────────────
function AddDocumentoModal({ expedienteId, open, onClose, onSaved }: {
  expedienteId: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form]        = Form.useForm()
  const [saving,      setSaving]      = useState(false)
  const [facturas,    setFacturas]    = useState<PurchaseInvoice[]>([])
  const [gastos,      setGastos]      = useState<Expense[]>([])
  const [loadingComp, setLoadingComp] = useState(false)
  const [searchComp,  setSearchComp]  = useState('')
  const docType = Form.useWatch('documentType', form)
  const isFob   = docType === 'factura_fob'
  const isGasto = docType && !isFob

  // Search compras or gastos when type changes
  useEffect(() => {
    if (!docType) return
    setLoadingComp(true)
    if (isFob) {
      getBills({ search: searchComp || undefined, limit: 40 } as any)
        .then(r => setFacturas(Array.isArray(r) ? r : (r as any).data ?? []))
        .catch(() => setFacturas([]))
        .finally(() => setLoadingComp(false))
    } else {
      getExpenses({ search: searchComp || undefined, limit: 40 } as any)
        .then(r => setGastos(Array.isArray(r) ? r : (r as any).data ?? []))
        .catch(() => setGastos([]))
        .finally(() => setLoadingComp(false))
    }
  }, [docType, searchComp, isFob])

  const handleLinkCompra = (facturaId: string) => {
    const f = facturas.find(x => x.id === facturaId)
    if (!f) return
    form.setFieldsValue({
      compraId:       f.id,
      documentNumber: f.vendorInvoiceNumber || f.invoiceNumber,
      supplierName:   f.vendorName,
      amount:         f.total,
      currency:       f.currency,
      exchangeRate:   f.exchangeRate,
    })
    message.success(`Vinculado: ${f.invoiceNumber} — ${f.vendorName}`)
  }

  const handleLinkGasto = (gastoId: string) => {
    const g = gastos.find(x => x.id === gastoId)
    if (!g) return
    form.setFieldsValue({
      gastoId:        g.id,
      documentNumber: g.reference || g.expenseNumber,
      supplierName:   g.vendorName || g.categoryName,
      amount:         g.total,
      currency:       g.currency || 'GTQ',
      exchangeRate:   1,
    })
    message.success(`Vinculado: ${g.expenseNumber} — ${g.categoryName}`)
  }

  const handleOk = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const amountGTQ = (values.amount || 0) * (values.exchangeRate || 1)
      await addExpedienteDocumento(expedienteId, { ...values, amountGTQ })
      message.success('Documento agregado')
      form.resetFields()
      onSaved()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al agregar documento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={<Space><FileAddOutlined /> Agregar documento de costo</Space>}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose() }}
      okText="Agregar"
      okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}
        initialValues={{ currency: 'GTQ', exchangeRate: 1 }}>

        {/* Step 1: Tipo */}
        <Form.Item name="documentType" label="Tipo de documento" rules={[{ required: true }]}>
          <Select placeholder="Seleccionar tipo">
            {Object.entries(DOCUMENT_TYPE_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}>
                <Tag color={v.color} style={{ fontSize: 11 }}>{v.label}</Tag>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Step 2: Vincular a Compras (Option 4) */}
        {docType && (
          <>
            <div style={{
              background: '#f0f7ff', border: '1px solid #bae0ff',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <LinkOutlined style={{ color: '#1677ff' }} />
                <Text strong style={{ color: '#1677ff', fontSize: 13 }}>
                  {isFob ? 'Vincular a factura de proveedor (módulo Compras)' : 'Vincular a gasto registrado (módulo Compras)'}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {isFob
                  ? 'Selecciona la factura del proveedor ya registrada en Compras para vincular y auto-completar los datos.'
                  : 'Selecciona el gasto ya registrado en Compras para vincular y auto-completar el monto.'}
              </Text>
              <Select
                showSearch
                allowClear
                loading={loadingComp}
                placeholder={isFob ? 'Buscar factura de proveedor...' : 'Buscar gasto...'}
                filterOption={false}
                onSearch={setSearchComp}
                style={{ width: '100%' }}
                onSelect={isFob ? handleLinkCompra : handleLinkGasto}
                options={
                  isFob
                    ? facturas.map(f => ({
                        value: f.id,
                        label: `${f.invoiceNumber} — ${f.vendorName} — Q${Number(f.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
                      }))
                    : gastos.map(g => ({
                        value: g.id,
                        label: `${g.expenseNumber} — ${g.categoryName} — Q${Number(g.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
                      }))
                }
                notFoundContent={loadingComp ? 'Buscando...' : 'Sin resultados'}
              />
              <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                También puedes ingresar los datos manualmente sin vincular.
              </Text>
            </div>

            {/* Hint texts */}
            <Alert
              type="info" showIcon style={{ marginBottom: 12, padding: '6px 12px' }}
              message={
                docType === 'factura_fob'
                  ? 'Factura principal FOB — base del prorrateo. El monto en GTQ equivalente se usa para distribuir costos.'
                  : docType === 'dai'
                  ? 'DAI (DUA) emitido por SAT. Ingresa el total de derechos arancelarios.'
                  : docType === 'iva_importacion'
                  ? 'IVA 12% = (FOB + Flete + Seguro + DAI) × 12%. Puedes calcularlo automáticamente.'
                  : `${DOCUMENT_TYPE_CONFIG[docType as keyof typeof DOCUMENT_TYPE_CONFIG]?.label}`
              }
            />
          </>
        )}

        {/* Hidden IDs (set by selector) */}
        <Form.Item name="compraId" hidden><Input /></Form.Item>
        <Form.Item name="gastoId"  hidden><Input /></Form.Item>

        {/* Document data */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="documentNumber" label="No. factura / DUA / referencia">
              <Input placeholder="Número del documento" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="supplierName" label="Proveedor / Emisor">
              <Input placeholder="Nombre del emisor" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Descripción adicional">
          <Input placeholder="Observaciones (opcional)" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="currency" label="Moneda">
              <Select>
                <Option value="GTQ">GTQ</Option>
                <Option value="USD">USD</Option>
                <Option value="EUR">EUR</Option>
                <Option value="MXN">MXN</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="exchangeRate" label="Tipo de cambio">
              <InputNumber style={{ width: '100%' }} precision={6} min={0.000001} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="amount" label="Monto" rules={[{ required: true, message: 'Requerido' }]}>
              <InputNumber style={{ width: '100%' }} precision={2} min={0} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

// ── Modal: Agregar artículo ───────────────────────────────────────────────────
function AddLineaModal({ expedienteId, open, onClose, onSaved }: {
  expedienteId: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form]     = Form.useForm()
  const [saving,   setSaving]   = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingP, setLoadingP] = useState(false)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    if (!open) return
    setLoadingP(true)
    getProducts({ limit: 50, search: search || undefined })
      .then(res => setProducts(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingP(false))
  }, [open, search])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const product  = products.find(p => p.id === values.productId)
      const totalFob = (values.quantity || 0) * (values.unitCostFob || 0)
      await addExpedienteLinea(expedienteId, {
        ...values, totalFob,
        productSku:  product?.sku,
        productName: product?.name,
      })
      message.success('Artículo agregado')
      form.resetFields()
      onSaved()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al agregar artículo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={<Space><PlusOutlined /> Agregar artículo a importar</Space>}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose() }}
      okText="Agregar"
      okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="productId" label="Artículo" rules={[{ required: true }]}>
          <Select
            showSearch filterOption={false}
            loading={loadingP}
            onSearch={setSearch}
            placeholder="Buscar por nombre o SKU..."
            notFoundContent={loadingP ? 'Buscando...' : 'Sin resultados'}
          >
            {products.map(p => (
              <Option key={p.id} value={p.id}>
                <Space>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>{p.sku}</Text>
                  {p.name}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="quantity" label="Cantidad" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0.0001} precision={4} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="unitCostFob" label="Costo FOB/u (Q)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={4} prefix="Q" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="weight" label="Peso (kg)">
              <InputNumber style={{ width: '100%' }} min={0} precision={4} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="volume" label="Volumen (m³)">
              <InputNumber style={{ width: '100%' }} min={0} precision={4} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpedienteDetallePage() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()
  const isNew    = !id || id === 'nuevo'

  const [exp,          setExp]          = useState<Expediente | null>(null)
  const [loading,      setLoading]      = useState(!isNew)
  const [recalcing,    setRecalcing]    = useState(false)
  const [confirming,   setConfirming]   = useState(false)
  const [addDocOpen,   setAddDocOpen]   = useState(false)
  const [addLinOpen,   setAddLinOpen]   = useState(false)

  // New expediente form
  const [newForm] = Form.useForm()
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (isNew || !id) return
    setLoading(true)
    try {
      const data = await getExpediente(id)
      setExp(data)
    } catch {
      message.error('Expediente no encontrado')
      navigate('/inventario/expedientes')
    } finally {
      setLoading(false)
    }
  }, [id, isNew, navigate])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: any) => {
    setCreating(true)
    try {
      const created = await createExpediente({
        ...values,
        openedDate: values.openedDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        expectedDate: values.expectedDate?.format('YYYY-MM-DD'),
        status: 'abierto',
      })
      message.success(`Expediente ${created.expedienteNo} creado`)
      navigate(`/inventario/expedientes/${created.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al crear expediente')
    } finally {
      setCreating(false)
    }
  }

  const handleRecalcular = async () => {
    if (!id) return
    setRecalcing(true)
    try {
      const updated = await recalcularExpediente(id)
      setExp(updated)
      message.success('Prorrateo recalculado')
    } catch {
      message.error('Error al recalcular')
    } finally {
      setRecalcing(false)
    }
  }

  const handleConfirmar = async () => {
    if (!id) return
    setConfirming(true)
    try {
      await confirmarExpediente(id)
      message.success('Expediente confirmado — costos promedio actualizados')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al confirmar')
    } finally {
      setConfirming(false)
    }
  }

  const handleRemoveDoc = async (docId: string) => {
    if (!id) return
    try {
      await removeExpedienteDocumento(id, docId)
      load()
    } catch {
      message.error('Error al eliminar documento')
    }
  }

  const handleRemoveLin = async (lineaId: string) => {
    if (!id) return
    try {
      await removeExpedienteLinea(id, lineaId)
      load()
    } catch {
      message.error('Error al eliminar línea')
    }
  }

  const handleChangeStatus = async (newStatus: string) => {
    if (!id) return
    try {
      await updateExpedienteStatus(id, newStatus)
      load()
    } catch {
      message.error('Error al cambiar estado')
    }
  }

  // ── NEW EXPEDIENTE FORM ───────────────────────────────────────────────────
  if (isNew) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventario/expedientes')} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Nuevo expediente de importación</Title>
            <Text type="secondary">Se generará automáticamente el número de expediente (IMP-YYYY-NNN)</Text>
          </div>
        </div>
        <Card style={{ borderRadius: 10 }}>
          <Form form={newForm} layout="vertical" onFinish={handleCreate}
            initialValues={{ prorationMethod: 'by_value', openedDate: dayjs() }}>
            <Form.Item name="description" label="Descripción del expediente">
              <Input placeholder='Ej: "Importación maquinaria industrial Q1 2026"' size="large" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="openedDate" label="Fecha de apertura" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="expectedDate" label="Fecha estimada de llegada">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="prorationMethod" label="Método de prorrateo por defecto">
              <Select>
                <Option value="by_value">Por valor FOB (recomendado)</Option>
                <Option value="by_quantity">Por cantidad</Option>
                <Option value="by_weight">Por peso</Option>
                <Option value="by_volume">Por volumen</Option>
              </Select>
            </Form.Item>
            <Form.Item name="notes" label="Notas">
              <Input.TextArea rows={2} placeholder="Observaciones iniciales..." />
            </Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button onClick={() => navigate('/inventario/expedientes')}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={creating} style={{ background: '#1B3A6B' }}>
                Crear expediente
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    )
  }

  if (loading || !exp) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  const isEditable = exp.status === 'abierto'
  const statusIdx  = STATUS_ORDER.indexOf(exp.status)
  const cfg        = EXPEDIENTE_STATUS[exp.status as keyof typeof EXPEDIENTE_STATUS]

  // Document columns
  const docCols: ColumnsType<ExpedienteDocumento> = [
    {
      title: 'Tipo',
      dataIndex: 'documentType',
      width: 180,
      render: v => {
        const c = DOCUMENT_TYPE_CONFIG[v as keyof typeof DOCUMENT_TYPE_CONFIG]
        return c ? <Tag color={c.color} style={{ fontSize: 11 }}>{c.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    { title: 'No. Documento', dataIndex: 'documentNumber', width: 130,
      render: v => v ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> : '—' },
    { title: 'Proveedor/Emisor', dataIndex: 'supplierName', ellipsis: true,
      render: v => v || '—' },
    { title: 'Moneda', dataIndex: 'currency', width: 80,
      render: (c, r) => <Tooltip title={`Tasa: ${r.exchangeRate}`}><Tag>{c}</Tag></Tooltip> },
    { title: 'Monto orig.', dataIndex: 'amount', width: 110, align: 'right',
      render: (v, r) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {r.currency} {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
      </Text> },
    { title: 'Monto GTQ', dataIndex: 'amountGTQ', width: 110, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
    { title: 'Ref. Contable', width: 100,
      render: (_, r) => (r.compraId || r.gastoId)
        ? <Tag color="purple">Vinculado</Tag>
        : <Tag color="default">Sin vínculo</Tag> },
    ...(isEditable ? [{
      title: '', width: 48,
      render: (_: any, row: ExpedienteDocumento) => (
        <Popconfirm title="¿Eliminar este documento?" onConfirm={() => handleRemoveDoc(row.id)} okText="Sí" cancelText="No">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ]

  // Linea columns
  const linCols: ColumnsType<ExpedienteLinea> = [
    { title: 'SKU', dataIndex: 'productSku', width: 100,
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text> },
    { title: 'Artículo', dataIndex: 'productName', ellipsis: true },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right',
      render: v => Number(v).toLocaleString('es-GT', { maximumFractionDigits: 4 }) },
    { title: 'FOB/u', dataIndex: 'unitCostFob', width: 100, align: 'right',
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v, 4)}</Text> },
    { title: 'Total FOB', dataIndex: 'totalFob', width: 110, align: 'right',
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
    { title: 'Flete', dataIndex: 'proratedFlete', width: 90, align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text> },
    { title: 'Seguro', dataIndex: 'proratedSeguro', width: 80, align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text> },
    { title: 'DAI', dataIndex: 'proratedDai', width: 80, align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text> },
    { title: 'IVA', dataIndex: 'proratedIva', width: 80, align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text> },
    { title: 'Costo Aterrizaje/u', dataIndex: 'landedCostPerUnit', width: 150, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B', fontSize: 13 }}>{fmtQ(v, 4)}</Text> },
    ...(isEditable ? [{
      title: '', width: 48,
      render: (_: any, row: ExpedienteLinea) => (
        <Popconfirm title="¿Eliminar este artículo?" onConfirm={() => handleRemoveLin(row.id)} okText="Sí" cancelText="No">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventario/expedientes')} />
          <div>
            <Space>
              <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
                <GlobalOutlined style={{ marginRight: 8 }} />
                {exp.expedienteNo}
              </Title>
              <Badge color={cfg?.color} text={cfg?.label} />
            </Space>
            <Text type="secondary" style={{ fontSize: 13 }}>{exp.description || 'Sin descripción'}</Text>
          </div>
        </div>
        <Space>
          {isEditable && (
            <>
              <Button icon={<CalculatorOutlined />} loading={recalcing} onClick={handleRecalcular}>
                Calcular prorrateo
              </Button>
              <Popconfirm
                title="Confirmar expediente"
                description="Se actualizará el costo promedio ponderado (CPP) de cada artículo. Esta acción no se puede deshacer."
                onConfirm={handleConfirmar}
                okText="Confirmar" cancelText="Cancelar"
                okButtonProps={{ style: { background: '#52c41a' }, loading: confirming }}
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={confirming}
                  disabled={(exp.lineas?.length || 0) === 0 || (exp.documentos?.length || 0) === 0}
                  style={{ background: '#1B3A6B' }}
                >
                  Confirmar
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </div>

      {/* Progress stepper */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Steps
          size="small"
          current={statusIdx === -1 ? 0 : statusIdx}
          status={exp.status === 'anulado' ? 'error' : undefined}
          items={[
            { title: 'Abierto' },
            { title: 'En tránsito',
              subTitle: isEditable ? (
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }}
                  onClick={() => handleChangeStatus('en_transito')}>
                  → Avanzar
                </Button>
              ) : undefined,
            },
            { title: 'En aduana',
              subTitle: exp.status === 'en_transito' ? (
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }}
                  onClick={() => handleChangeStatus('en_aduana')}>
                  → Avanzar
                </Button>
              ) : undefined,
            },
            { title: 'En bodega',
              subTitle: exp.status === 'en_aduana' ? (
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }}
                  onClick={() => handleChangeStatus('bodega')}>
                  → Avanzar
                </Button>
              ) : undefined,
            },
            { title: 'Confirmado' },
          ]}
        />
      </Card>

      {/* KPIs */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 11 }}>Total FOB</span>}
              value={exp.totalFob} precision={2} prefix="Q"
              valueStyle={{ fontSize: 15, fontFamily: 'monospace', color: '#1B3A6B' }}
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 11 }}>Costos adicionales</span>}
              value={exp.totalCosts} precision={2} prefix="Q"
              valueStyle={{ fontSize: 15, fontFamily: 'monospace', color: '#fa8c16' }}
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 11 }}>Costo total aterrizaje</span>}
              value={exp.totalLandedCost} precision={2} prefix="Q"
              valueStyle={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color: '#52c41a' }}
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 11 }}>Factor aterrizaje</span>}
              value={exp.totalFob > 0 ? ((exp.totalLandedCost / exp.totalFob) || 1) : 1}
              precision={6}
              prefix="×"
              valueStyle={{ fontSize: 15, fontFamily: 'monospace', color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      {/* Documents table */}
      <Card
        title={<Space><FileAddOutlined /> Documentos de costo ({exp.documentos?.length || 0})</Space>}
        style={{ borderRadius: 10, marginBottom: 16 }}
        extra={isEditable && (
          <Button size="small" type="primary" icon={<PlusOutlined />}
            onClick={() => setAddDocOpen(true)} style={{ background: '#1B3A6B' }}>
            Agregar documento
          </Button>
        )}
      >
        {(exp.documentos?.length || 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div>Agrega los documentos de costo vinculados a esta importación</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Factura del proveedor, flete, seguro, DAI, agente aduanal, etc.</div>
          </div>
        ) : (
          <Table<ExpedienteDocumento>
            dataSource={exp.documentos} columns={docCols}
            rowKey="id" size="small" scroll={{ x: 900 }} pagination={false}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <Text strong>TOTAL GTQ</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ fontFamily: 'monospace' }}>
                    {fmtQ((exp.documentos || []).reduce((s, d) => s + Number(d.amountGTQ), 0))}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} colSpan={2} />
              </Table.Summary.Row>
            )}
          />
        )}
      </Card>

      {/* Articles table */}
      <Card
        title={<Space>📦 Artículos a importar ({exp.lineas?.length || 0})</Space>}
        style={{ borderRadius: 10 }}
        extra={isEditable && (
          <Button size="small" type="primary" icon={<PlusOutlined />}
            onClick={() => setAddLinOpen(true)} style={{ background: '#1B3A6B' }}>
            Agregar artículo
          </Button>
        )}
      >
        {(exp.lineas?.length || 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            <div>Agrega los artículos que se están importando con sus cantidades y costo FOB</div>
          </div>
        ) : (
          <Table<ExpedienteLinea>
            dataSource={exp.lineas} columns={linCols}
            rowKey="id" size="small" scroll={{ x: 1100 }} pagination={false}
          />
        )}
        {isEditable && (exp.lineas?.length || 0) > 0 && (exp.documentos?.length || 0) > 0 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button icon={<CalculatorOutlined />} onClick={handleRecalcular} loading={recalcing}>
              Recalcular prorrateo
            </Button>
          </div>
        )}
      </Card>

      <AddDocumentoModal
        expedienteId={id!}
        open={addDocOpen}
        onClose={() => setAddDocOpen(false)}
        onSaved={load}
      />
      <AddLineaModal
        expedienteId={id!}
        open={addLinOpen}
        onClose={() => setAddLinOpen(false)}
        onSaved={load}
      />
    </div>
  )
}
