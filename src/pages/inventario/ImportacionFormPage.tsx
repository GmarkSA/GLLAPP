import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Form, Input, Select, Button, Row, Col, Typography, Space,
  InputNumber, DatePicker, Table, Modal, message, Spin, Statistic,
  Divider, Popconfirm, Alert, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  CalculatorOutlined, CheckCircleOutlined, SaveOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getImportacion, createImportacion, confirmarImportacion,
  getProducts, type Importacion, type ImportacionLinea, type Product,
} from '../../api/inventario'

const { Title, Text } = Typography
const { Option }      = Select
const { TextArea }    = Input

const fmtQ = (v: number, d = 2) =>
  'Q ' + Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── Types for local state ────────────────────────────────────────────────────
interface LocalLinea extends Partial<ImportacionLinea> {
  _key: number
  productName?: string
  productSku?: string
  productId: string
  quantity: number
  unitCostFob: number
  totalFob: number
  weight?: number
  volume?: number
  proratedFreight: number
  proratedInsurance: number
  proratedCustomsDuty: number
  proratedIva: number
  proratedOther: number
  totalLandedCost: number
  landedCostPerUnit: number
}

// ── Proration engine ─────────────────────────────────────────────────────────
function calcProrrateo(
  lineas: LocalLinea[],
  costs: { freight: number; insurance: number; customsDuty: number; ivaImport: number; otherCharges: number },
  method: string,
): LocalLinea[] {
  if (!lineas.length) return lineas

  const totalFobSum  = lineas.reduce((s, l) => s + (l.totalFob || 0), 0)
  const totalQty     = lineas.reduce((s, l) => s + (l.quantity || 0), 0)
  const totalWeight  = lineas.reduce((s, l) => s + (l.weight || 0), 0)
  const totalVolume  = lineas.reduce((s, l) => s + (l.volume || 0), 0)

  const { freight, insurance, customsDuty, ivaImport, otherCharges } = costs

  return lineas.map(l => {
    const prop = (() => {
      switch (method) {
        case 'by_value':    return totalFobSum  > 0 ? (l.totalFob  || 0) / totalFobSum  : 1 / lineas.length
        case 'by_quantity': return totalQty     > 0 ? (l.quantity  || 0) / totalQty     : 1 / lineas.length
        case 'by_weight':   return totalWeight  > 0 ? (l.weight    || 0) / totalWeight  : 1 / lineas.length
        case 'by_volume':   return totalVolume  > 0 ? (l.volume    || 0) / totalVolume  : 1 / lineas.length
        default:            return totalFobSum  > 0 ? (l.totalFob  || 0) / totalFobSum  : 1 / lineas.length
      }
    })()
    const pFreight      = freight      * prop
    const pInsurance    = insurance    * prop
    const pDuty         = customsDuty  * prop
    const pIva          = ivaImport    * prop
    const pOther        = otherCharges * prop
    const totalLanded   = (l.totalFob || 0) + pFreight + pInsurance + pDuty + pIva + pOther
    const landedPerUnit = (l.quantity || 0) > 0 ? totalLanded / (l.quantity || 1) : 0

    return {
      ...l,
      proratedFreight:      pFreight,
      proratedInsurance:    pInsurance,
      proratedCustomsDuty:  pDuty,
      proratedIva:          pIva,
      proratedOther:        pOther,
      totalLandedCost:      totalLanded,
      landedCostPerUnit:    landedPerUnit,
    }
  })
}

// ── Modal: Agregar artículo ──────────────────────────────────────────────────
function AddLineaModal({ open, onClose, onAdd, showWeight, showVolume }: {
  open: boolean
  onClose: () => void
  onAdd: (linea: Omit<LocalLinea, '_key' | 'proratedFreight' | 'proratedInsurance' | 'proratedCustomsDuty' | 'proratedIva' | 'proratedOther' | 'totalLandedCost' | 'landedCostPerUnit'>) => void
  showWeight: boolean
  showVolume: boolean
}) {
  const [form]     = Form.useForm()
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getProducts({ limit: 50, search: search || undefined, itemType: 'importado' })
      .then(res => setProducts(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [open, search])

  const handleOk = async () => {
    const values = await form.validateFields()
    const product = products.find(p => p.id === values.productId)
    const totalFob = (values.quantity || 0) * (values.unitCostFob || 0)
    onAdd({
      productId:   values.productId,
      productName: product?.name,
      productSku:  product?.sku,
      quantity:    values.quantity,
      unitCostFob: values.unitCostFob,
      totalFob,
      weight:      values.weight,
      volume:      values.volume,
    })
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={<Space><PlusOutlined /> Agregar artículo a importar</Space>}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose() }}
      okText="Agregar"
      okButtonProps={{ style: { background: '#1B3A6B' } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="productId" label="Artículo" rules={[{ required: true, message: 'Selecciona un artículo' }]}>
          <Select
            showSearch
            loading={loading}
            filterOption={false}
            onSearch={setSearch}
            placeholder="Buscar artículo por nombre o SKU..."
            notFoundContent={loading ? 'Buscando...' : 'Sin resultados'}
          >
            {products.map(p => (
              <Option key={p.id} value={p.id}>
                <Space>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>{p.sku}</Text>
                  <Text>{p.name}</Text>
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="quantity" label="Cantidad" rules={[{ required: true, message: 'Requerido' }]}>
              <InputNumber style={{ width: '100%' }} min={0.0001} precision={4} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="unitCostFob" label="Costo FOB unitario" rules={[{ required: true, message: 'Requerido' }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={4} prefix="Q" />
            </Form.Item>
          </Col>
        </Row>

        {showWeight && (
          <Form.Item name="weight" label="Peso (kg)">
            <InputNumber style={{ width: '100%' }} min={0} precision={4} />
          </Form.Item>
        )}
        {showVolume && (
          <Form.Item name="volume" label="Volumen (m³)">
            <InputNumber style={{ width: '100%' }} min={0} precision={4} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ImportacionFormPage() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()
  const isView   = Boolean(id)

  const [form]         = Form.useForm()
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [confirming,   setConfirming]   = useState(false)
  const [addOpen,      setAddOpen]      = useState(false)
  const [lineas,       setLineas]       = useState<LocalLinea[]>([])
  const [keyCounter,   setKeyCounter]   = useState(0)
  const [confirmed,    setConfirmed]    = useState(false)

  // Cost fields — watched to trigger live proration
  const freight      = Form.useWatch('freight',      form) ?? 0
  const insurance    = Form.useWatch('insurance',    form) ?? 0
  const customsDuty  = Form.useWatch('customsDuty',  form) ?? 0
  const ivaImport    = Form.useWatch('ivaImport',    form) ?? 0
  const otherCharges = Form.useWatch('otherCharges', form) ?? 0
  const prorationMethod = Form.useWatch('prorationMethod', form) ?? 'by_value'

  const totalFobSum = lineas.reduce((s, l) => s + (l.totalFob || 0), 0)
  const totalLandedSum = freight + insurance + customsDuty + ivaImport + otherCharges + totalFobSum

  // Load existing importacion if viewing
  useEffect(() => {
    if (!isView) return
    setLoading(true)
    getImportacion(id!)
      .then(imp => {
        form.setFieldsValue({
          ...imp,
          date: imp.date ? dayjs(imp.date) : undefined,
        })
        if (imp.lineas) {
          const localLineas: LocalLinea[] = imp.lineas.map((l, i) => ({ ...l, _key: i }))
          setLineas(localLineas)
          setKeyCounter(imp.lineas.length)
        }
        setConfirmed(imp.status === 'confirmed' || imp.status === 'posted')
      })
      .catch(() => { message.error('No se pudo cargar la importación'); navigate('/inventario/importaciones') })
      .finally(() => setLoading(false))
  }, [id, isView, form, navigate])

  // ── Live proration recalculation ──────────────────────────────────────
  const recalc = useCallback(() => {
    setLineas(prev => calcProrrateo(prev, { freight, insurance, customsDuty, ivaImport, otherCharges }, prorationMethod))
  }, [freight, insurance, customsDuty, ivaImport, otherCharges, prorationMethod])

  useEffect(() => {
    recalc()
  }, [recalc])

  // ── Add linea ─────────────────────────────────────────────────────────
  const handleAddLinea = (linea: any) => {
    const newLinea: LocalLinea = {
      ...linea,
      _key: keyCounter,
      proratedFreight:     0,
      proratedInsurance:   0,
      proratedCustomsDuty: 0,
      proratedIva:         0,
      proratedOther:       0,
      totalLandedCost:     linea.totalFob,
      landedCostPerUnit:   linea.unitCostFob,
    }
    setKeyCounter(k => k + 1)
    const updated = [...lineas, newLinea]
    setLineas(calcProrrateo(updated, { freight, insurance, customsDuty, ivaImport, otherCharges }, prorationMethod))
  }

  // ── Remove linea ──────────────────────────────────────────────────────
  const handleRemoveLinea = (key: number) => {
    const updated = lineas.filter(l => l._key !== key)
    setLineas(calcProrrateo(updated, { freight, insurance, customsDuty, ivaImport, otherCharges }, prorationMethod))
  }

  // ── Calculate 12% IVA ────────────────────────────────────────────────
  const handleCalcIva = () => {
    const base = totalFobSum + freight + insurance + customsDuty
    form.setFieldValue('ivaImport', Math.round(base * 0.12 * 100) / 100)
  }

  // ── Save draft ────────────────────────────────────────────────────────
  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const dto: Partial<Importacion> = {
        ...values,
        date: values.date?.format('YYYY-MM-DD'),
        totalFob: totalFobSum,
        totalLandedCost: totalLandedSum,
        lineas: lineas.map(l => ({
          productId:           l.productId,
          productName:         l.productName,
          productSku:          l.productSku,
          quantity:            l.quantity,
          unitCostFob:         l.unitCostFob,
          totalFob:            l.totalFob,
          weight:              l.weight,
          volume:              l.volume,
          proratedFreight:     l.proratedFreight,
          proratedInsurance:   l.proratedInsurance,
          proratedCustomsDuty: l.proratedCustomsDuty,
          proratedIva:         l.proratedIva,
          proratedOther:       l.proratedOther,
          totalLandedCost:     l.totalLandedCost,
          landedCostPerUnit:   l.landedCostPerUnit,
        })),
      } as any
      const created = await createImportacion(dto)
      message.success('Importación guardada como borrador')
      navigate(`/inventario/importaciones/${created.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  // ── Confirm importacion ───────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!id) { message.warning('Primero guarda el borrador'); return }
    setConfirming(true)
    try {
      await confirmarImportacion(id)
      message.success('Importación confirmada — costos de artículos actualizados con CPP')
      setConfirmed(true)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al confirmar')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  const showWeight = prorationMethod === 'by_weight'
  const showVolume = prorationMethod === 'by_volume'

  // ── Columns for the lineas table ──────────────────────────────────────
  const lineaCols: ColumnsType<LocalLinea> = [
    {
      title: 'SKU',
      dataIndex: 'productSku',
      width: 100,
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Artículo',
      dataIndex: 'productName',
      ellipsis: true,
    },
    {
      title: 'Cant.',
      dataIndex: 'quantity',
      width: 70,
      align: 'right',
      render: v => Number(v).toLocaleString('es-GT', { maximumFractionDigits: 4 }),
    },
    {
      title: 'Costo FOB/u',
      dataIndex: 'unitCostFob',
      width: 100,
      align: 'right',
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>,
    },
    {
      title: 'Total FOB',
      dataIndex: 'totalFob',
      width: 110,
      align: 'right',
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Flete',
      dataIndex: 'proratedFreight',
      width: 90,
      align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text>,
    },
    {
      title: 'Seguro',
      dataIndex: 'proratedInsurance',
      width: 90,
      align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text>,
    },
    {
      title: 'DAI',
      dataIndex: 'proratedCustomsDuty',
      width: 90,
      align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text>,
    },
    {
      title: 'IVA imp.',
      dataIndex: 'proratedIva',
      width: 90,
      align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text>,
    },
    {
      title: 'Otros',
      dataIndex: 'proratedOther',
      width: 80,
      align: 'right',
      render: v => <Text style={{ fontSize: 11, color: '#595959' }}>{fmtQ(v, 4)}</Text>,
    },
    {
      title: 'Costo aterrizaje/u',
      dataIndex: 'landedCostPerUnit',
      width: 140,
      align: 'right',
      render: v => (
        <Text style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1B3A6B', fontSize: 13 }}>
          {fmtQ(v, 4)}
        </Text>
      ),
    },
    ...(showWeight ? [{
      title: 'Peso (kg)',
      dataIndex: 'weight',
      width: 80,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 11 }}>{v || 0}</Text>,
    }] : []),
    ...(!confirmed ? [{
      title: '',
      width: 50,
      align: 'center' as const,
      render: (_: any, row: LocalLinea) => (
        <Button
          size="small" type="text" danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveLinea(row._key)}
        />
      ),
    }] : []),
  ]

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventario/importaciones')} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
              {isView ? 'Detalle de importación' : 'Nueva importación'}
            </Title>
            <Text type="secondary">
              Registra la importación y calcula automáticamente el costo de aterrizaje por artículo
            </Text>
          </div>
        </div>
        {confirmed && (
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '6px 16px' }}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: '#389e0d', fontWeight: 600 }}>Importación confirmada</Text>
            </Space>
          </div>
        )}
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          currency: 'USD',
          exchangeRate: 1,
          prorationMethod: 'by_value',
          freight: 0,
          insurance: 0,
          customsDuty: 0,
          ivaImport: 0,
          otherCharges: 0,
          date: dayjs(),
        }}
      >
        <Row gutter={16}>
          {/* ── Col izquierda: encabezado + costos ──────────────────────── */}
          <Col xs={24} lg={8}>
            {/* Encabezado */}
            <Card
              title="Encabezado"
              size="small"
              style={{ borderRadius: 10, marginBottom: 12 }}
            >
              <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabled={confirmed} />
              </Form.Item>
              <Form.Item name="invoiceNumber" label="No. de factura / DUA">
                <Input placeholder="Número de factura del proveedor" disabled={confirmed} />
              </Form.Item>
              <Form.Item name="supplierName" label="Proveedor (nombre)">
                <Input placeholder="Nombre del proveedor o exportador" disabled={confirmed} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="currency" label="Moneda factura">
                    <Select disabled={confirmed}>
                      <Option value="USD">🇺🇸 USD</Option>
                      <Option value="EUR">🇪🇺 EUR</Option>
                      <Option value="GTQ">🇬🇹 GTQ</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="exchangeRate" label="Tasa de cambio">
                    <InputNumber style={{ width: '100%' }} precision={6} min={0.000001} disabled={confirmed} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="prorationMethod" label="Método de prorrateo">
                <Select disabled={confirmed}>
                  <Option value="by_value">Por valor FOB</Option>
                  <Option value="by_quantity">Por cantidad</Option>
                  <Option value="by_weight">Por peso</Option>
                  <Option value="by_volume">Por volumen</Option>
                </Select>
              </Form.Item>
              <Form.Item name="notes" label="Notas">
                <TextArea rows={2} placeholder="Observaciones..." disabled={confirmed} />
              </Form.Item>
            </Card>

            {/* Costos de importación */}
            <Card
              title={
                <Space>
                  <CalculatorOutlined style={{ color: '#fa8c16' }} />
                  Costos a prorratear
                  <Tooltip title="Estos costos se distribuyen entre todos los artículos según el método de prorrateo seleccionado.">
                    <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
                  </Tooltip>
                </Space>
              }
              size="small"
              style={{ borderRadius: 10, marginBottom: 12 }}
            >
              <div style={{ marginBottom: 12 }}>
                <Statistic
                  title="Total FOB (artículos)"
                  value={totalFobSum}
                  precision={2}
                  prefix="Q"
                  valueStyle={{ fontSize: 16, fontFamily: 'monospace', color: '#1B3A6B' }}
                  formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                />
              </div>
              <Divider style={{ margin: '8px 0' }} />

              <Form.Item name="freight" label="Flete" style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} precision={2} min={0} prefix="Q" disabled={confirmed} />
              </Form.Item>
              <Form.Item name="insurance" label="Seguro" style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} precision={2} min={0} prefix="Q" disabled={confirmed} />
              </Form.Item>
              <Form.Item name="customsDuty" label="DAI — Derechos Arancelarios" style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} precision={2} min={0} prefix="Q" disabled={confirmed} />
              </Form.Item>
              <Form.Item
                name="ivaImport"
                label={
                  <Space>
                    IVA de importación (12%)
                    {!confirmed && (
                      <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} onClick={handleCalcIva}>
                        Calcular 12%
                      </Button>
                    )}
                  </Space>
                }
                style={{ marginBottom: 8 }}
              >
                <InputNumber style={{ width: '100%' }} precision={2} min={0} prefix="Q" disabled={confirmed} />
              </Form.Item>
              <Form.Item name="otherCharges" label="Otros cargos (agente, almacenaje)" style={{ marginBottom: 16 }}>
                <InputNumber style={{ width: '100%' }} precision={2} min={0} prefix="Q" disabled={confirmed} />
              </Form.Item>

              <Divider style={{ margin: '0 0 12px' }} />
              <Statistic
                title="Total Costo de Aterrizaje"
                value={totalLandedSum}
                precision={2}
                prefix="Q"
                valueStyle={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 700, color: '#52c41a' }}
                formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              />
              {totalFobSum > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                  Factor de aterrizaje: ×{((totalLandedSum / totalFobSum) || 0).toFixed(6)}
                </div>
              )}
            </Card>
          </Col>

          {/* ── Col derecha: tabla de artículos ─────────────────────────── */}
          <Col xs={24} lg={16}>
            <Card
              title={
                <Space>
                  Artículos a importar
                  {lineas.length > 0 && (
                    <span style={{ fontSize: 12, color: '#8c8c8c' }}>({lineas.length} artículos)</span>
                  )}
                </Space>
              }
              size="small"
              style={{ borderRadius: 10, marginBottom: 12 }}
              extra={!confirmed && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setAddOpen(true)}
                  style={{ background: '#1B3A6B' }}
                >
                  Agregar artículo
                </Button>
              )}
            >
              {lineas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8c8c8c' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                  <div>Agrega los artículos que se están importando</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>El prorrateo se calculará automáticamente</div>
                </div>
              ) : (
                <Table<LocalLinea>
                  dataSource={lineas}
                  columns={lineaCols}
                  rowKey="_key"
                  size="small"
                  scroll={{ x: 1000 }}
                  pagination={false}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={4}>
                        <Text strong>TOTALES</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right">
                        <Text strong style={{ fontFamily: 'monospace' }}>{fmtQ(totalFobSum)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right">
                        <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(lineas.reduce((s, l) => s + l.proratedFreight, 0), 4)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={6} align="right">
                        <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(lineas.reduce((s, l) => s + l.proratedInsurance, 0), 4)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(lineas.reduce((s, l) => s + l.proratedCustomsDuty, 0), 4)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right">
                        <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(lineas.reduce((s, l) => s + l.proratedIva, 0), 4)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={9} align="right">
                        <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmtQ(lineas.reduce((s, l) => s + l.proratedOther, 0), 4)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={10} align="right">
                        <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(totalLandedSum)}</Text>
                      </Table.Summary.Cell>
                      {!confirmed && <Table.Summary.Cell index={11} />}
                    </Table.Summary.Row>
                  )}
                />
              )}
            </Card>

            {/* Instrucciones prorrateo */}
            <Alert
              type="info"
              showIcon
              style={{ borderRadius: 8, marginBottom: 12 }}
              message="Cálculo de prorrateo automático"
              description={
                <div style={{ fontSize: 12 }}>
                  <div>Los costos adicionales (Flete, Seguro, DAI, IVA, Otros) se distribuyen entre los artículos de forma proporcional según el método seleccionado.</div>
                  <div style={{ marginTop: 4 }}>
                    Al <strong>confirmar</strong> la importación, el <strong>Costo Promedio Ponderado (CPP)</strong> de cada artículo se actualiza automáticamente:
                    <br />
                    <code>Nuevo CPP = (Stock existente × CPP anterior + Cantidad importada × Costo Aterrizaje/u) / (Stock existente + Cantidad importada)</code>
                  </div>
                </div>
              }
            />

            {/* Botones de acción */}
            {!confirmed && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button onClick={() => navigate('/inventario/importaciones')}>
                  Cancelar
                </Button>
                {!isView && (
                  <Button
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                    disabled={lineas.length === 0}
                  >
                    Guardar borrador
                  </Button>
                )}
                {isView && (
                  <Popconfirm
                    title="Confirmar importación"
                    description={
                      <div style={{ maxWidth: 300 }}>
                        <div>Se actualizará el <strong>Costo Promedio Ponderado</strong> de cada artículo con los costos de aterrizaje calculados.</div>
                        <div style={{ marginTop: 8, color: '#ff4d4f' }}>Esta acción no se puede deshacer.</div>
                      </div>
                    }
                    onConfirm={handleConfirm}
                    okText="Confirmar" cancelText="Cancelar"
                    okButtonProps={{ style: { background: '#1B3A6B' }, loading: confirming }}
                  >
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      loading={confirming}
                      disabled={lineas.length === 0}
                      style={{ background: '#1B3A6B' }}
                    >
                      Confirmar importación
                    </Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </Col>
        </Row>
      </Form>

      {/* Modal agregar artículo */}
      <AddLineaModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddLinea}
        showWeight={showWeight}
        showVolume={showVolume}
      />
    </div>
  )
}
