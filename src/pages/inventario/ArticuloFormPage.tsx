import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Form, Input, Select, Switch, Button, Row, Col,
  Typography, Space, InputNumber, Divider, message, Spin,
  Alert, Tooltip, Steps,
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, InfoCircleOutlined,
  InboxOutlined, DollarOutlined, TagOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import AccountSelect from '../../components/AccountSelect'
import SelectorDimensionesAnaliticas from '../../components/SelectorDimensionesAnaliticas'
import { getTaxes, type Tax } from '../../api/impuestos'
import {
  getProduct, createProduct, updateProduct,
  ITEM_TYPE_CONFIG, ITEM_CATEGORY_CONFIG, UNITS,
  type Product,
} from '../../api/inventario'

const { Title, Text } = Typography
const { Option }      = Select
const { TextArea }    = Input

// Impuestos de la pestaña IVA (Configuración › Impuestos): excluye ISR y Retenciones de IVA
const IVA_CATS = ['iva', 'iva_exento', 'iva_pequeno_contribuyente']
const taxLabel = (t: Tax) =>
  `${t.code} — ${t.name}${Number(t.rate) ? ` (${t.rate}%)` : ' (Exento)'}`

export default function ArticuloFormPage() {
  const navigate   = useNavigate()
  const { id }     = useParams<{ id: string }>()
  const isEdit     = Boolean(id)
  const [form]     = Form.useForm()
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [step,     setStep]     = useState(0)
  const [taxes,    setTaxes]    = useState<Tax[]>([])

  // Live-watch fields to conditionally show sections
  const itemType          = Form.useWatch('itemType', form)
  const isInventoriable   = Form.useWatch('isInventoriable', form)
  const currency          = Form.useWatch('currency', form) ?? 'GTQ'
  const currencySymbol    = currency === 'GTQ' ? 'Q' : '$'
  const centroBeneficioId = Form.useWatch('centroBeneficioId', form)

  // Impuestos filtrados por uso (misma lista del módulo de Impuestos, pestaña IVA)
  const salesTaxes    = taxes.filter(t => t.isActive && IVA_CATS.includes(t.category) && ['sales', 'both'].includes(t.applicability))
  const purchaseTaxes = taxes.filter(t => t.isActive && IVA_CATS.includes(t.category) && ['purchases', 'both'].includes(t.applicability))

  // ── Cargar impuestos (fuente: Configuración › Impuestos) ──────────────────
  useEffect(() => {
    getTaxes()
      .then((t: Tax[]) => setTaxes(Array.isArray(t) ? t : []))
      .catch(() => setTaxes([]))
  }, [])

  // Un servicio no lleva inventario: al elegir "servicio" se apaga el control de stock
  useEffect(() => {
    if (itemType === 'servicio') form.setFieldValue('isInventoriable', false)
  }, [itemType, form])

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

  const moneyFormatter = (v: any) => `${currencySymbol} ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const moneyParser    = (v: any) => Number(String(v).replace(/[^0-9.]/g, ''))

  const STEPS = [
    { title: 'Identificación',                icon: <TagOutlined /> },
    { title: 'Ventas, compra e inventario',   icon: <DollarOutlined /> },
    { title: 'POS y otros',                   icon: <ShopOutlined /> },
  ]
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))
  const isLast = step === STEPS.length - 1

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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

      <Steps
        current={step}
        onChange={setStep}
        items={STEPS}
        size="small"
        style={{ marginBottom: 20 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={() => setStep(0)}
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

        {/* ═══════════════ PASO 1 · Identificación ═══════════════ */}
        <div style={{ display: step === 0 ? 'block' : 'none' }}>
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
                <Form.Item name="sku" label="SKU / Código" tooltip="Si lo dejas vacío, se genera automáticamente">
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
                {/* División — lista compartida de Financiero › División */}
                <SelectorDimensionesAnaliticas
                  layout="form"
                  showCentroCosto={false}
                  value={{ centroBeneficioId }}
                  onChange={v => form.setFieldValue('centroBeneficioId', v.centroBeneficioId ?? null)}
                />
                <div style={{ fontSize: 11, color: '#8b9aa8', marginTop: 4 }}>
                  Lista compartida: se crea en <b>Financiero › División</b>.
                </div>
              </Col>
            </Row>

            <Form.Item name="description" label="Descripción" style={{ marginTop: 8, marginBottom: 0 }}>
              <TextArea rows={3} placeholder="Descripción detallada del artículo..." />
            </Form.Item>
          </Card>
        </div>

        {/* ═══════════════ PASO 2 · Ventas, compra e inventario ═══════════════ */}
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <Card
            title={<Space><DollarOutlined style={{ color: '#ff7f00' }} /> Ventas, compra e inventario</Space>}
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
            </Row>

            {/* ── Información de ventas ── */}
            <Divider titlePlacement="start" style={{ margin: '4px 0 16px' }}>
              <Text style={{ fontSize: 13, color: '#1faec2', fontWeight: 600 }}>Información de ventas</Text>
            </Divider>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="salesPrice" label={`Precio de venta (${currencySymbol})`}>
                  <InputNumber<number>
                    style={{ width: '100%' }} precision={4} min={0}
                    formatter={moneyFormatter} parser={moneyParser}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="salesAccountId"
                  label="Cuenta de ingresos (ventas)"
                  tooltip="Cuenta donde se registran los ingresos al vender este artículo"
                >
                  <AccountSelect filter={{ balanceType: 'Ingresos' }} placeholder="Buscar cuenta de ingresos..." />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="salesTaxId"
                  label={<Tooltip title="Tasa de IVA aplicada al vender este artículo (FEL)."><span>Impuesto de ventas <InfoCircleOutlined /></span></Tooltip>}
                >
                  <Select allowClear showSearch optionFilterProp="label" placeholder="IVA de ventas">
                    {salesTaxes.map(t => (
                      <Option key={t.id} value={t.id} label={taxLabel(t)}>{taxLabel(t)}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* ── Información de la compra ── */}
            <Divider titlePlacement="start" style={{ margin: '4px 0 16px' }}>
              <Text style={{ fontSize: 13, color: '#1faec2', fontWeight: 600 }}>Información de la compra</Text>
            </Divider>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="purchasePrice" label={`Precio de compra (${currencySymbol})`}>
                  <InputNumber<number>
                    style={{ width: '100%' }} precision={4} min={0}
                    formatter={moneyFormatter} parser={moneyParser}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="costAccountId"
                  label="Cuenta de costo de ventas (COGS)"
                  tooltip="Cuenta del grupo 5 (costo) o 6 (gasto) que se debita al vender/consumir este artículo"
                >
                  <AccountSelect filter={{ balanceTypes: ['Costos', 'Gastos'] }} placeholder="Buscar cuenta de costo..." />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="purchaseTaxId"
                  label={<Tooltip title="Tasa de IVA para compras / gastos de este artículo (FEL)."><span>Impuesto de compras <InfoCircleOutlined /></span></Tooltip>}
                >
                  <Select allowClear showSearch optionFilterProp="label" placeholder="IVA de compras">
                    {purchaseTaxes.map(t => (
                      <Option key={t.id} value={t.id} label={taxLabel(t)}>{taxLabel(t)}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <div style={{ fontSize: 11, color: '#8b9aa8', marginTop: -6, marginBottom: 8 }}>
              Los impuestos se administran en <b>Configuración › Impuestos</b> (pestaña IVA).
            </div>

            {/* ── Seguimiento de inventario ── */}
            <Divider titlePlacement="start" style={{ margin: '10px 0 16px' }}>
              <Text style={{ fontSize: 13, color: '#1faec2', fontWeight: 600 }}>Seguimiento de inventario</Text>
            </Divider>
            <Row gutter={32}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="isInventoriable"
                  valuePropName="checked"
                  label={
                    <Space>¿Lleva control de stock?
                      <Tooltip title="Activa el seguimiento de existencias físicas. Los servicios normalmente no son inventariables.">
                        <InfoCircleOutlined style={{ color: '#6b7280' }} />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Switch checkedChildren="Sí" unCheckedChildren="No" disabled={itemType === 'servicio'} />
                </Form.Item>
                {itemType === 'servicio' && (
                  <div style={{ fontSize: 11, color: '#8b9aa8', marginTop: -12, marginBottom: 8 }}>
                    Un <b>servicio</b> no lleva inventario: el control de stock queda desactivado.
                  </div>
                )}
              </Col>
              {isInventoriable && (
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="isProduced"
                    valuePropName="checked"
                    label={
                      <Space>¿Se produce internamente?
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
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="itemCategory" label="Categoría de inventario">
                      <Select allowClear placeholder="Seleccionar categoría">
                        {Object.entries(ITEM_CATEGORY_CONFIG).map(([k, v]) => (
                          <Option key={k} value={k}><Tag color={v.color}>{v.label}</Tag></Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="trackingType"
                      label="Control de trazabilidad"
                      tooltip="Ninguno: solo stock total. Por lote: tracking por número de lote. Por serie: cada unidad con N/S único."
                    >
                      <Select>
                        <Option value="none">Ninguno</Option>
                        <Option value="lot">Por lote</Option>
                        <Option value="serial">Por serie (N/S)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    {/* Método de valoración — hoy el motor cableado es Costo promedio ponderado (por empresa). */}
                    <Form.Item
                      label={<Tooltip title="Método de costeo del inventario. En Guatemala se usa normalmente Costo promedio ponderado."><span>Método de valoración <InfoCircleOutlined /></span></Tooltip>}
                    >
                      <Select defaultValue="average">
                        <Option value="average">Costo promedio ponderado (recomendado GT)</Option>
                        <Option value="fifo" disabled>FIFO / PEPS — próximamente</Option>
                        <Option value="standard" disabled>Estándar — próximamente</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ fontSize: 11, color: '#8b9aa8', marginTop: -6, marginBottom: 12 }}>
                  <b>Promedio ponderado:</b> cada compra/importación recalcula el costo unitario = (existencia × costo actual + entrada × costo nuevo) ÷ total; la venta descarga a ese costo. <i>FIFO queda para una fase posterior.</i>
                </div>

                {/* Cuentas contables de inventario */}
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="inventoryAccountId"
                      label="Cuenta de inventario (Activo)"
                      tooltip="Cuenta del grupo 130 — Inventarios"
                    >
                      <AccountSelect filter={{ isInventoryAccount: true }} placeholder="Buscar cuenta de inventario..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="adjustmentAccountId"
                      label="Cuenta de ajustes de inventario"
                      tooltip="Cuenta para diferencias en ajustes y tomas físicas"
                    >
                      <AccountSelect filter={{}} placeholder="Buscar cuenta de ajustes..." />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Costos */}
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="averageCost"
                      label={`Costo promedio (${currencySymbol})`}
                      tooltip="Se actualiza automáticamente al confirmar compras e importaciones. Editable para pruebas."
                    >
                      <InputNumber style={{ width: '100%' }} precision={4} formatter={moneyFormatter} parser={moneyParser} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="lastCost"
                      label={`Último costo (${currencySymbol})`}
                      tooltip="Último costo de compra o importación registrado."
                    >
                      <InputNumber style={{ width: '100%' }} precision={4} formatter={moneyFormatter} parser={moneyParser} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="weight" label="Peso (kg)">
                      <InputNumber style={{ width: '100%' }} precision={4} min={0} placeholder="Peso por unidad" />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Stock y reorden */}
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="stockOnHand"
                      label="Existencia actual"
                      tooltip="Se actualiza sola con ingresos, ventas, ajustes y movimientos. Para corregirla usa el módulo de Ajustes de inventario."
                    >
                      <InputNumber style={{ width: '100%' }} precision={2} disabled={isEdit} min={0} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="reorderPoint"
                      label="Punto de reorden"
                      tooltip="Al bajar de este nivel, el artículo se marca en alerta de bajo stock (lista de artículos y reporte de inventario)."
                    >
                      <InputNumber style={{ width: '100%' }} precision={2} min={0} placeholder="Nivel de alerta de bajo stock" />
                    </Form.Item>
                  </Col>
                </Row>

                {isEdit && (
                  <Alert
                    type="info" showIcon style={{ marginTop: 4 }}
                    message="El sistema actualizará el costo promedio y último costo automáticamente al confirmar compras e importaciones."
                  />
                )}
              </>
            )}

            {!isInventoriable && (
              <Alert
                type="info" showIcon
                icon={<InboxOutlined />}
                message="Sin control de stock"
                description="Este artículo no lleva inventario (típico de servicios). Se conservan Ventas y Compra; no se registra existencia ni costeo."
              />
            )}
          </Card>
        </div>

        {/* ═══════════════ PASO 3 · POS y otros ═══════════════ */}
        <div style={{ display: step === 2 ? 'block' : 'none' }}>
          <Card
            title={<Space><ShopOutlined style={{ color: '#6b7280' }} /> Punto de venta (POS)</Space>}
            style={{ borderRadius: 10, marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="barCodes" label="Códigos de barras" tooltip="Separados por coma">
                  <Input placeholder="7501000123456, 7501000654321" />
                </Form.Item>
              </Col>
            </Row>
            <Alert
              type="success" showIcon
              message="Listo para vender en POS"
              description="Con precio de venta, IVA y código de barras, el artículo queda disponible en la Terminal POS y para facturar con FEL."
            />
          </Card>
        </div>

        {/* Campo oculto para registrar la División en el submit/carga */}
        <Form.Item name="centroBeneficioId" hidden><Input /></Form.Item>

        {/* ── Navegación del asistente ────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
          <Button onClick={() => (step === 0 ? navigate('/inventario') : prev())}>
            {step === 0 ? 'Cancelar' : '← Regresar'}
          </Button>
          {!isLast ? (
            <Button type="primary" style={{ background: '#1faec2' }} onClick={next}>
              Continuar →
            </Button>
          ) : (
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              style={{ background: '#1faec2' }}
            >
              {isEdit ? 'Guardar cambios' : 'Crear artículo'}
            </Button>
          )}
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
