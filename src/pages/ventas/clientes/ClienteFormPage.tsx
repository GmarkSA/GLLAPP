import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Tabs, Row, Col, Switch,
  Typography, Space, Card, Divider, Tag, Alert, message,
  InputNumber, Radio, Spin,
} from 'antd'
import {
  SaveOutlined, ArrowLeftOutlined, UserOutlined, BankOutlined,
  PercentageOutlined, BookOutlined, EnvironmentOutlined,
  TeamOutlined, PlusOutlined, DeleteOutlined,
} from '@ant-design/icons'
import {
  getCustomer, createCustomer, updateCustomer,
  type Customer, type ContactPerson, type Address,
} from '../../../api/contactos'
import { getTaxes, type Tax } from '../../../api/impuestos'
import AccountSelect from '../../../components/AccountSelect'
import PaymentTermsSelect from '../../../components/PaymentTermsSelect'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Constantes ─────────────────────────────────────────────────────────────

const TAX_TREATMENTS = [
  { value: 'taxable',                label: 'Contribuyente — IVA 12%',                  desc: 'Aplica IVA estándar. El cliente paga el IVA completo.' },
  { value: 'exempt',                 label: 'Exento de IVA',                            desc: 'No aplica IVA (exportaciones, medicamentos, etc.).' },
  { value: 'contribuyente_especial', label: 'Contribuyente especial — Retención IVA',   desc: 'SAT designó a este cliente como retenedor de IVA (15% o 30%).' },
  { value: 'gobierno',               label: 'Entidad de gobierno — Retención 65%',      desc: 'Entidades del Estado retienen el 65% del IVA.' },
  { value: 'exportador',             label: 'Exportador — IVA 0%',                      desc: 'Operaciones de exportación, tasa cero.' },
]

const IVA_RETENTION_OPTIONS = [
  { value: 'IVARET15', label: 'IVARET15 — Retención 15% del IVA' },
  { value: 'IVARET30', label: 'IVARET30 — Retención 30% del IVA' },
  { value: 'IVARET65', label: 'IVARET65 — Retención 65% del IVA (Gobierno)' },
]

const SALUTATIONS = ['Sr.', 'Sra.', 'Lic.', 'Ing.', 'Dr.', 'Dra.', 'Arq.']
const CURRENCIES  = ['GTQ', 'USD', 'EUR', 'MXN']
const COUNTRIES   = ['Guatemala', 'México', 'El Salvador', 'Honduras', 'Costa Rica', 'Estados Unidos', 'Otro']

// ── Sub-formulario: Dirección ───────────────────────────────────────────────
function AddressForm({ prefix }: { prefix: string }) {
  return (
    <Row gutter={16}>
      <Col span={24}>
        <Form.Item name={[prefix, 'attention']} label="Atención a">
          <Input placeholder="Nombre del contacto en esta dirección" />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item name={[prefix, 'address']} label="Dirección">
          <Input placeholder="5a Avenida 4-50 Zona 1" />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item name={[prefix, 'street2']} label="Dirección 2">
          <Input placeholder="Oficina, Local, Bodega..." />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name={[prefix, 'city']} label="Ciudad">
          <Input placeholder="Ciudad de Guatemala" />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name={[prefix, 'state']} label="Departamento">
          <Input placeholder="Guatemala" />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name={[prefix, 'zip']} label="Código postal">
          <Input placeholder="01001" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={[prefix, 'country']} label="País">
          <Select placeholder="País" allowClear>
            {COUNTRIES.map(c => <Option key={c} value={c}>{c}</Option>)}
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={[prefix, 'phone']} label="Teléfono en esta dirección">
          <Input placeholder="+502 2345-6789" />
        </Form.Item>
      </Col>
    </Row>
  )
}

// ── Sub-formulario: Persona de contacto ────────────────────────────────────
function ContactPersonRow({
  index, onRemove, isOnly,
}: {
  index: number; onRemove: () => void; isOnly: boolean
}) {
  return (
    <Card
      size="small"
      bordered={false}
      style={{ background: '#f8faff', borderRadius: 8, marginBottom: 12 }}
      extra={
        !isOnly && (
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={onRemove} />
        )
      }
      title={<Text style={{ fontSize: 13, color: '#1B3A6B' }}>Contacto {index + 1}</Text>}
    >
      <Row gutter={12}>
        <Col xs={24} md={4}>
          <Form.Item name={['contacts', index, 'salutation']} label="Tratamiento">
            <Select placeholder="Sr." allowClear size="small">
              {SALUTATIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name={['contacts', index, 'firstName']} label="Nombre">
            <Input placeholder="Juan" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name={['contacts', index, 'lastName']} label="Apellido">
            <Input placeholder="García" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={4}>
          <Form.Item name={['contacts', index, 'isPrimary']} label="Principal" valuePropName="checked">
            <Switch size="small" checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Form.Item name={['contacts', index, 'email']} label="Correo">
            <Input placeholder="juan@empresa.com" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={7}>
          <Form.Item name={['contacts', index, 'phone']} label="Teléfono">
            <Input placeholder="+502 2345-6789" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={7}>
          <Form.Item name={['contacts', index, 'mobile']} label="Celular">
            <Input placeholder="+502 5678-9012" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={['contacts', index, 'designation']} label="Puesto">
            <Input placeholder="Gerente de compras" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={['contacts', index, 'department']} label="Departamento">
            <Input placeholder="Administración" size="small" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

// ── Página principal ────────────────────────────────────────────────────────
export default function ClienteFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const isNew     = !id || id === 'nuevo'

  const [loading,      setLoading]      = useState(!isNew)
  const [saving,       setSaving]       = useState(false)
  const [taxes,        setTaxes]        = useState<Tax[]>([])
  const [contactCount, setContactCount] = useState(1)
  const [taxTreatment, setTaxTreatment] = useState<string>('taxable')
  const [clientType,   setClientType]   = useState<string>('company')

  // Cargar impuestos y datos del cliente
  useEffect(() => {
    getTaxes().then((t: Tax[]) => setTaxes(Array.isArray(t) ? t : [])).catch(() => {})

    if (!isNew && id) {
      setLoading(true)
      getCustomer(id)
        .then((c: Customer) => {
          form.setFieldsValue({
            ...c,
            openingBalanceDate: c.openingBalanceDate
              ? String(c.openingBalanceDate).slice(0, 10)
              : undefined,
          })
          setContactCount(c.contacts?.length || 1)
          setTaxTreatment(c.taxTreatment ?? 'taxable')
          setClientType(c.type ?? 'company')
        })
        .catch(() => message.error('No se pudo cargar el cliente'))
        .finally(() => setLoading(false))
    } else {
      // Valores por defecto para nuevo cliente
      form.setFieldsValue({
        type: 'company', currency: 'GTQ', paymentTerms: 'net_30',
        taxTreatment: 'taxable', taxCode: 'IVA12',
        tdsEnabled: false,
        contacts: [{ firstName: '', isPrimary: true }],
        billingAddress: { country: 'Guatemala' },
      })
    }
  }, [id, isNew, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      // name (comercial) puede quedar vacío — usar razón social como fallback
      if (!values.name) values.name = values.legalName
      setSaving(true)
      if (isNew) {
        await createCustomer(values)
        message.success('✓ Cliente creado exitosamente')
      } else {
        await updateCustomer(id!, values)
        message.success('✓ Cliente actualizado')
      }
      navigate('/ventas/clientes')
    } catch (e: any) {
      if (e?.errorFields) {
        const names = e.errorFields.map((f: any) => f.name?.join(' › ')).join(', ')
        message.error(`Completa los campos requeridos: ${names}`, 6)
        return
      }
      const data    = e?.response?.data
      const raw     = data?.message ?? data?.error ?? data
      const errMsg  = Array.isArray(raw) ? raw.join(' | ') : (typeof raw === 'string' ? raw : JSON.stringify(raw))
      const status  = e?.response?.status ? ` (HTTP ${e.response.status})` : ''
      message.error(errMsg ? `${errMsg}${status}` : `Error al guardar${status} — revisa la consola del navegador`, 8)
      console.error('[ClienteForm] error:', e?.response?.data ?? e)
    } finally {
      setSaving(false)
    }
  }

  const ivaTaxes = taxes.filter(t => t.category === 'iva' || t.category === 'iva_exento')
  const isrTaxes = taxes.filter(t => t.category === 'isr')
  const showRetention = ['contribuyente_especial', 'gobierno'].includes(taxTreatment)

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button
            type="text" icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/ventas/clientes')}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
              {isNew ? 'Nuevo cliente' : 'Editar cliente'}
            </Title>
            <Text type="secondary">
              {isNew
                ? 'Completa la información del cliente. Los campos de impuestos son críticos para la facturación.'
                : 'Actualiza los datos del cliente'}
            </Text>
          </div>
          <Button
            type="primary" icon={<SaveOutlined />}
            onClick={handleSave} loading={saving}
            style={{ marginLeft: 'auto', background: '#1B3A6B', minWidth: 140 }}
          >
            {isNew ? 'Crear cliente' : 'Guardar cambios'}
          </Button>
        </div>

        <Form form={form} layout="vertical">
          <Tabs
            defaultActiveKey="info"
            type="card"
            items={[
              // ── TAB 1: Info principal ─────────────────────────────────
              {
                key: 'info', label: <><UserOutlined /> Info principal</>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    {/* Tipo de cliente */}
                    <Form.Item name="type" label="Tipo de cliente">
                      <Radio.Group
                        onChange={e => setClientType(e.target.value)}
                        buttonStyle="solid"
                      >
                        <Radio.Button value="company">
                          <BankOutlined /> Empresarial
                        </Radio.Button>
                        <Radio.Button value="individual">
                          <UserOutlined /> Individual
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    <Row gutter={16}>
                      {/* Para individuales: saludo + nombre */}
                      {clientType === 'individual' && (
                        <>
                          <Col xs={24} md={4}>
                            <Form.Item name="salutation" label="Tratamiento">
                              <Select placeholder="Sr." allowClear>
                                {SALUTATIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="firstName" label="Nombre">
                              <Input placeholder="Juan" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="lastName" label="Apellido">
                              <Input placeholder="García" />
                            </Form.Item>
                          </Col>
                        </>
                      )}

                      <Col xs={24} md={clientType === 'individual' ? 12 : 16}>
                        <Form.Item
                          name="legalName"
                          label={clientType === 'company' ? 'Razón social (SAT)' : 'Nombre completo (SAT)'}
                          rules={[{ required: true, message: 'La razón social es requerida' }]}
                        >
                          <Input
                            placeholder={clientType === 'company' ? 'EMPRESA ABC SOCIEDAD ANÓNIMA' : 'JUAN CARLOS PÉREZ LÓPEZ'}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={clientType === 'individual' ? 12 : 8}>
                        <Form.Item name="name" label="Nombre comercial">
                          <Input placeholder="Empresa ABC S.A." />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item name="taxId" label="NIT">
                          <Input placeholder="1234567-8" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="email" label="Correo electrónico"
                          rules={[{ type: 'email', message: 'Email inválido' }]}>
                          <Input placeholder="info@empresa.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="phone" label="Teléfono">
                          <Input placeholder="+502 2345-6789" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="mobile" label="Celular">
                          <Input placeholder="+502 5678-9012" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="website" label="Sitio web">
                          <Input placeholder="https://empresa.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="currency" label="Moneda">
                          <Select>
                            {CURRENCIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="paymentTerms" label="Términos de pago">
                          <PaymentTermsSelect />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="creditLimit" label="Límite de crédito (Q)">
                          <InputNumber<number>
                            style={{ width: '100%' }}
                            formatter={v => `Q ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={v => Number(v?.replace(/Q\s?|(,*)/g, '') ?? 0)}
                            min={0}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },

              // ── TAB 2: Impuestos & Contabilidad ──────────────────────
              {
                key: 'taxes',
                label: <><PercentageOutlined /> Impuestos y contabilidad</>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <Alert
                      message="Vinculación fiscal — clave para facturación automática"
                      description="Los impuestos aquí configurados se aplican automáticamente al crear facturas de venta para este cliente. No es necesario seleccionarlos manualmente en cada factura."
                      type="info" showIcon style={{ marginBottom: 20 }}
                    />

                    {/* Tratamiento fiscal */}
                    <Form.Item
                      name="taxTreatment"
                      label="Tratamiento fiscal del cliente"
                      rules={[{ required: true }]}
                    >
                      <Select
                        onChange={v => setTaxTreatment(v)}
                        size="large"
                      >
                        {TAX_TREATMENTS.map(t => (
                          <Option key={t.value} value={t.value}>
                            <div>
                              <div style={{ fontWeight: 500 }}>{t.label}</div>
                              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{t.desc}</div>
                            </div>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Row gutter={20}>
                      {/* IVA */}
                      <Col xs={24} md={12}>
                        <Card
                          size="small" bordered={false}
                          style={{ background: '#f0f7ff', borderRadius: 8, marginBottom: 16 }}
                        >
                          <div style={{ fontWeight: 600, color: '#1B3A6B', marginBottom: 8 }}>
                            IVA aplicable en facturas de venta
                          </div>
                          <Form.Item name="taxCode" label="Impuesto IVA" style={{ marginBottom: 0 }}>
                            <Select placeholder="Selecciona impuesto IVA" allowClear>
                              {ivaTaxes.length > 0
                                ? ivaTaxes.map(t => (
                                  <Option key={t.code} value={t.code}>
                                    <Space>
                                      <Tag color="blue">{t.code}</Tag>
                                      {t.name}
                                    </Space>
                                  </Option>
                                ))
                                : <Option disabled value="">Sin impuestos — configúralos en Configuración → Impuestos</Option>
                              }
                            </Select>
                          </Form.Item>
                        </Card>
                      </Col>

                      {/* IVA Retenida — solo para contribuyente especial / gobierno */}
                      {showRetention && (
                        <Col xs={24} md={12}>
                          <Card
                            size="small" bordered={false}
                            style={{ background: '#fff7e6', borderRadius: 8, marginBottom: 16 }}
                          >
                            <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: 8 }}>
                              Retención de IVA (cliente retenedor)
                            </div>
                            <Form.Item name="ivaRetentionCode" label="Porcentaje de retención IVA" style={{ marginBottom: 0 }}>
                              <Select placeholder="Retención aplicable" allowClear>
                                {IVA_RETENTION_OPTIONS.map(o => (
                                  <Option key={o.value} value={o.value}>{o.label}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Card>
                        </Col>
                      )}

                      {/* ISR / TDS */}
                      <Col xs={24} md={12}>
                        <Card
                          size="small" bordered={false}
                          style={{ background: '#f9f0ff', borderRadius: 8, marginBottom: 16 }}
                        >
                          <div style={{ fontWeight: 600, color: '#531dab', marginBottom: 8 }}>
                            ISR — Impuesto Sobre la Renta (retención en origen)
                          </div>
                          <Form.Item name="tdsEnabled" label="¿Este cliente retiene ISR?" valuePropName="checked">
                            <Switch
                              checkedChildren="Sí, aplica retención ISR"
                              unCheckedChildren="No aplica retención ISR"
                            />
                          </Form.Item>
                          <Form.Item
                            name="tdsTaxCode"
                            label="Impuesto ISR aplicable"
                            style={{ marginBottom: 0 }}
                          >
                            <Select placeholder="Selecciona impuesto ISR" allowClear>
                              {isrTaxes.length > 0
                                ? isrTaxes.map(t => (
                                  <Option key={t.code} value={t.code}>
                                    <Space>
                                      <Tag color="purple">{t.code}</Tag>
                                      {t.name}
                                    </Space>
                                  </Option>
                                ))
                                : <Option disabled value="">Sin ISR configurado — ve a Configuración → Impuestos</Option>
                              }
                            </Select>
                          </Form.Item>
                        </Card>
                      </Col>
                    </Row>

                    <Divider titlePlacement="left">Cuentas contables</Divider>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="receivableAccountId"
                          label="Cuenta por cobrar (CxC)"
                          tooltip="Solo muestra cuentas marcadas como 'Cuenta de clientes' en el catálogo. Registra las facturas pendientes de cobro."
                        >
                          <AccountSelect
                            filter={{ isCustomerAccount: true }}
                            placeholder="Buscar cuenta CxC..."
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="incomeAccountId"
                          label="Cuenta de ingresos por defecto"
                          tooltip="Solo muestra cuentas de tipo Ingresos. Se usa automáticamente al crear facturas para este cliente."
                        >
                          <AccountSelect
                            filter={{ balanceType: 'Ingresos' }}
                            placeholder="Buscar cuenta de ingresos..."
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider titlePlacement="left">Saldo inicial</Divider>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item name="openingBalance" label="Saldo inicial (Q)">
                          <InputNumber<number>
                            style={{ width: '100%' }}
                            formatter={v => `Q ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={v => Number(v?.replace(/Q\s?|(,*)/g, '') ?? 0)}
                            min={0}
                            placeholder="0.00"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="openingBalanceDate" label="Fecha de saldo inicial">
                          <Input type="date" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },

              // ── TAB 3: Dirección ──────────────────────────────────────
              {
                key: 'address', label: <><EnvironmentOutlined /> Dirección</>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <Title level={5} style={{ color: '#1B3A6B', marginBottom: 16 }}>
                      Dirección de facturación
                    </Title>
                    <AddressForm prefix="billingAddress" />

                    <Divider />
                    <Title level={5} style={{ color: '#1B3A6B', marginBottom: 8 }}>
                      Dirección de envío
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
                      Si es la misma que la de facturación, déjala vacía.
                    </Text>
                    <AddressForm prefix="shippingAddress" />
                  </div>
                ),
              },

              // ── TAB 4: Personas de contacto ───────────────────────────
              {
                key: 'contacts', label: <><TeamOutlined /> Contactos ({contactCount})</>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <Text type="secondary">
                        Agrega las personas de contacto en la empresa. El contacto marcado como "Principal" recibirá las facturas.
                      </Text>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => {
                          const contacts = form.getFieldValue('contacts') || []
                          form.setFieldValue('contacts', [...contacts, { firstName: '', isPrimary: false }])
                          setContactCount(c => c + 1)
                        }}
                      >
                        Agregar contacto
                      </Button>
                    </div>

                    <Form.List name="contacts">
                      {(fields, { remove }) =>
                        fields.map((field, index) => (
                          <ContactPersonRow
                            key={field.key}
                            index={index}
                            isOnly={fields.length === 1}
                            onRemove={() => { remove(field.name); setContactCount(c => c - 1) }}
                          />
                        ))
                      }
                    </Form.List>
                  </div>
                ),
              },

              // ── TAB 5: Otros ──────────────────────────────────────────
              {
                key: 'other', label: 'Otros',
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item name="notes" label="Notas internas">
                          <TextArea rows={4} placeholder="Observaciones sobre el cliente (no visibles en documentos)" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="portalEnabled" label="Portal del cliente" valuePropName="checked">
                          <Switch checkedChildren="Habilitado" unCheckedChildren="Deshabilitado" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </div>
    </Spin>
  )
}
