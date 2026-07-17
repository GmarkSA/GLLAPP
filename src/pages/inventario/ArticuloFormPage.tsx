import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Form, Input, Select, Switch, Button, Row, Col,
  Typography, Space, InputNumber, Divider, message, Spin,
  Alert, Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, InfoCircleOutlined,
  InboxOutlined, DollarOutlined, LinkOutlined, TagOutlined,
} from '@ant-design/icons'
import AccountSelect from '../../components/AccountSelect'
import {
  getProduct, createProduct, updateProduct,
  ITEM_TYPE_CONFIG, ITEM_CATEGORY_CONFIG, UNITS,
  type Product,
} from '../../api/inventario'

const { Title, Text } = Typography
const { Option }      = Select
const { TextArea }    = Input

const fmtQ = (v: number) => 'Q ' + Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })

export default function ArticuloFormPage() {
  const navigate   = useNavigate()
  const { id }     = useParams<{ id: string }>()
  const isEdit     = Boolean(id)
  const [form]     = Form.useForm()
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // Live-watch fields to conditionally show sections
  const isInventoriable = Form.useWatch('isInventoriable', form)
  const currency        = Form.useWatch('currency', form) ?? 'GTQ'
  const currencySymbol  = currency === 'GTQ' ? 'Q' : '$'

  // ── Load for edit ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    getProduct(id!)
      .then((p: Product) => form.setFieldsValue(p))
      .catch(() => { message.error('No se pudo cargar el artículo'); navigate('/inventario') })
      .finally(() => setLoading(false))
  }, [id, isEdit, form, navigate])

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (values: any) => {
    setSaving(true)
    try {
      if (isEdit) {
        await updateProduct(id!, values)
        message.success('Artículo actualizado')
        navigate('/inventario')
      } else {
        const created = await createProduct(values)
        message.success(`Artículo creado · SKU: ${created.sku}`)
        navigate('/inventario')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventario')} />
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            {isEdit ? 'Editar artículo' : 'Nuevo artículo'}
          </Title>
          <Text type="secondary">
            {isEdit ? 'Modifica los datos del artículo' : 'Completa los datos del producto o servicio'}
          </Text>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          itemType: 'bien',
          usageType: 'both',
          currency: 'GTQ',
          isInventoriable: true,
          isProduced: false,
          trackingType: 'none',
          purchasePrice: 0,
          salesPrice: 0,
          averageCost: 0,
          lastCost: 0,
          stockOnHand: 0,
        }}
      >

        {/* ── Card 1: Identificación y clasificación ───────────────────── */}
        <Card
          title={<Space><TagOutlined style={{ color: '#1faec2' }} /> Identificación y clasificación</Space>}
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nombre del artículo" rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder='Ej: "Cemento Portland 42.5 kg"' size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="sku"
                label="SKU / Código"
                tooltip="Si lo dejas vacío, se genera automáticamente"
              >
                <Input placeholder="Se genera automáticamente" style={{ fontVariantNumeric: 'tabular-nums' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="itemType" label="Tipo de artículo" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(ITEM_TYPE_CONFIG).map(([k, v]) => (
                    <Option key={k} value={k}>
                      <Tag color={v.color} style={{ marginRight: 6 }}>{v.label}</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>{v.description}</Text>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="usageType" label="Uso" rules={[{ required: true }]}>
                <Select>
                  <Option value="purchase">Solo compra</Option>
                  <Option value="sale">Solo venta</Option>
                  <Option value="both">Compra y venta</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="unit" label="Unidad de medida">
                <Select showSearch allowClear placeholder="Seleccionar unidad">
                  {UNITS.map(u => <Option key={u} value={u}>{u}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="category" label="Familia / Categoría">
                <Input placeholder="Ej: Materiales de construcción" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="brand" label="Marca">
                <Input placeholder="Ej: Cementos Progreso" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="barCodes" label="Códigos de barras" tooltip="Separados por coma">
                <Input placeholder="7501000123456, 7501000654321" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Card 2: Flags de inventario ──────────────────────────────── */}
        <Card
          title={<Space><InboxOutlined style={{ color: '#2ea172' }} /> Control de inventario</Space>}
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <Row gutter={32}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="isInventoriable"
                valuePropName="checked"
                label={
                  <Space>
                    ¿Lleva control de stock?
                    <Tooltip title="Activa el seguimiento de existencias físicas. Los servicios normalmente no son inventariables.">
                      <InfoCircleOutlined style={{ color: '#6b7280' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            {isInventoriable && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="isProduced"
                  valuePropName="checked"
                  label={
                    <Space>
                      ¿Se produce internamente?
                      <Tooltip title="Indica que este artículo se fabrica a partir de materias primas (vs. comprado a proveedor).">
                        <InfoCircleOutlined style={{ color: '#6b7280' }} />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Switch checkedChildren="Sí" unCheckedChildren="No" />
                </Form.Item>
              </Col>
            )}
          </Row>

          {isInventoriable && (
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="itemCategory" label="Categoría de inventario">
                  <Select allowClear placeholder="Seleccionar categoría">
                    {Object.entries(ITEM_CATEGORY_CONFIG).map(([k, v]) => (
                      <Option key={k} value={k}>
                        <Tag color={v.color}>{v.label}</Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="trackingType"
                  label="Control de trazabilidad"
                  tooltip="Ninguno: solo stock total. Por lote: tracking por número de lote. Por serie: cada unidad tiene número de serie único."
                >
                  <Select>
                    <Option value="none">Ninguno</Option>
                    <Option value="lot">Por lote</Option>
                    <Option value="serial">Por serie (N/S)</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}
        </Card>

        {/* ── Card 3: Precios y costos ─────────────────────────────────── */}
        <Card
          title={<Space><DollarOutlined style={{ color: '#ff7f00' }} /> Precios y costos</Space>}
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={6}>
              <Form.Item name="currency" label="Moneda">
                <Select>
                  <Option value="GTQ">🇬🇹 GTQ — Quetzal</Option>
                  <Option value="USD">🇺🇸 USD — Dólar</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={9}>
              <Form.Item name="purchasePrice" label={`Precio de compra (${currencySymbol})`}>
                <InputNumber<number>
                  style={{ width: '100%' }} precision={4} min={0}
                  formatter={v => `${currencySymbol} ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/[^0-9.]/g, ''))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={9}>
              <Form.Item name="salesPrice" label={`Precio de venta (${currencySymbol})`}>
                <InputNumber<number>
                  style={{ width: '100%' }} precision={4} min={0}
                  formatter={v => `${currencySymbol} ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/[^0-9.]/g, ''))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={9}>
              <Form.Item
                name="averageCost"
                label={`Costo promedio (${currencySymbol})`}
                tooltip="Se puede editar manualmente. El sistema lo actualizará automáticamente al confirmar compras e importaciones."
              >
                <InputNumber
                  style={{ width: '100%' }} precision={4}
                  formatter={v => `${currencySymbol} ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/[^0-9.]/g, '')) as number}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={9}>
              <Form.Item
                name="lastCost"
                label={`Último costo (${currencySymbol})`}
                tooltip="Último costo de compra o importación registrado."
              >
                <InputNumber
                  style={{ width: '100%' }} precision={4}
                  formatter={v => `${currencySymbol} ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/[^0-9.]/g, '')) as number}
                />
              </Form.Item>
            </Col>
          </Row>

          {isEdit && (
            <Alert
              type="info" showIcon style={{ marginTop: 4 }}
              message="El sistema actualizará el costo promedio y último costo automáticamente al confirmar compras e importaciones. Puedes editarlos manualmente para pruebas."
            />
          )}
        </Card>

        {/* ── Card 4: Control de stock (solo si inventariable) ─────────── */}
        {isInventoriable && (
          <Card
            title="Stock y puntos de reorden"
            style={{ borderRadius: 10, marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="stockOnHand"
                  label="Existencia actual"
                  tooltip="Para ajustar el stock usa el módulo de Ajustes de inventario."
                >
                  <InputNumber style={{ width: '100%' }} precision={2} disabled={isEdit} min={0} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="reorderPoint" label="Punto de reorden">
                  <InputNumber style={{ width: '100%' }} precision={2} min={0}
                    placeholder="Alerta al llegar a este nivel" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="reorderQuantity" label="Cantidad de reorden sugerida">
                  <InputNumber style={{ width: '100%' }} precision={2} min={0} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="minimumStock" label="Stock mínimo">
                  <InputNumber style={{ width: '100%' }} precision={2} min={0}
                    placeholder="Nivel crítico" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="maximumStock" label="Stock máximo">
                  <InputNumber style={{ width: '100%' }} precision={2} min={0} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="weight" label="Peso (kg)">
                  <InputNumber style={{ width: '100%' }} precision={4} min={0}
                    placeholder="Peso por unidad" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        )}

        {/* ── Card 5: Vinculación contable ─────────────────────────────── */}
        <Card
          title={<Space><LinkOutlined style={{ color: '#6b7280' }} /> Vinculación contable</Space>}
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <Row gutter={16}>
            {isInventoriable && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="inventoryAccountId"
                  label="Cuenta de inventario (Activo)"
                  tooltip="Cuenta del grupo 130 — Inventarios vinculada como 'Cuenta de inventario' en el catálogo"
                >
                  <AccountSelect
                    filter={{ isInventoryAccount: true }}
                    placeholder="Buscar cuenta de inventario..."
                  />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={12}>
              <Form.Item
                name="salesAccountId"
                label="Cuenta de ingresos (ventas)"
                tooltip="Cuenta donde se registran los ingresos al vender este artículo"
              >
                <AccountSelect
                  filter={{ isCustomerAccount: false }}
                  placeholder="Buscar cuenta de ingresos..."
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {isInventoriable && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="costAccountId"
                  label="Cuenta de costo de ventas (COGS)"
                  tooltip="Cuenta del grupo 510/511 — Costo de ventas"
                >
                  <AccountSelect
                    filter={{}}
                    placeholder="Buscar cuenta de costo de ventas..."
                  />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={12}>
              <Form.Item
                name="purchaseAccountId"
                label="Cuenta de compras / gastos"
                tooltip="Cuenta donde se registran las compras de este artículo (si no lleva inventario)"
              >
                <AccountSelect
                  filter={{ isVendorAccount: true }}
                  placeholder="Buscar cuenta de compras..."
                />
              </Form.Item>
            </Col>
          </Row>

          {isInventoriable && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="adjustmentAccountId"
                  label="Cuenta de ajustes de inventario"
                  tooltip="Cuenta para diferencias en ajustes y tomas físicas"
                >
                  <AccountSelect
                    filter={{}}
                    placeholder="Buscar cuenta de ajustes..."
                  />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Card>

        {/* ── Card 6: Vinculación fiscal ─────────────────────────────────── */}
        <Card
          title="Vinculación fiscal (FEL)"
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <Alert
            type="info" showIcon style={{ marginBottom: 14 }}
            message={
              <span>
                Los <strong>códigos fiscales del receptor (NIT / Régimen)</strong> se configuran en el
                perfil de cada <a href="/ventas/clientes" target="_blank" rel="noreferrer">cliente</a>.
                Aquí puedes indicar el <strong>tipo de impuesto que aplica al artículo</strong> para cálculo automático en facturas y FEL.
              </span>
            }
          />
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="salesTaxId"
                label={<Tooltip title="Tasa de IVA aplicada al vender este artículo. En Guatemala: 12% IVA estándar."><span>Impuesto de ventas <InfoCircleOutlined /></span></Tooltip>}
              >
                <Select allowClear placeholder="Seleccionar tasa de IVA ventas">
                  <Option value="iva_12">IVA 12% (estándar Guatemala)</Option>
                  <Option value="iva_0">Exento (0%)</Option>
                  <Option value="iva_especial">Factura especial (retención)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="purchaseTaxId"
                label={<Tooltip title="Tasa de IVA para compras / gastos de este artículo."><span>Impuesto de compras <InfoCircleOutlined /></span></Tooltip>}
              >
                <Select allowClear placeholder="Seleccionar tasa de IVA compras">
                  <Option value="iva_12">IVA 12% (estándar Guatemala)</Option>
                  <Option value="iva_0">Exento (0%)</Option>
                  <Option value="iva_especial">Factura especial (retención)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Card 7: Notas ─────────────────────────────────────────────── */}
        <Card
          title="Descripción y notas"
          style={{ borderRadius: 10, marginBottom: 24 }}
        >
          <Form.Item name="description" label="Descripción">
            <TextArea rows={3} placeholder="Descripción detallada del artículo..." />
          </Form.Item>
        </Card>

        {/* ── Acciones ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => navigate('/inventario')}>Cancelar</Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            style={{ background: '#1faec2' }}
          >
            {isEdit ? 'Guardar cambios' : 'Crear artículo'}
          </Button>
        </div>
      </Form>
    </div>
  )
}

// Needed for Tag inside Select optionRender
function Tag({ color, children, style }: { color: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0 6px', borderRadius: 4,
      background: `${color}20`, color, border: `1px solid ${color}40`,
      fontSize: 11, fontWeight: 600, marginRight: 4, ...style,
    }}>
      {children}
    </span>
  )
}
