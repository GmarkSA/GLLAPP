import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Tabs, Row, Col, Switch,
  Typography, Space, Card, Divider, Tag, Alert, message,
  InputNumber, Radio, Spin,
} from 'antd'
import {
  SaveOutlined, ArrowLeftOutlined, UserOutlined, BankOutlined,
  BookOutlined, PlusOutlined, DeleteOutlined, SearchOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CheckOutlined,
} from '@ant-design/icons'
import {
  getCustomer, createCustomer, updateCustomer,
  type Customer, type ContactPerson, type Address,
} from '../../../api/contactos'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { satLookupApi } from '../../../api/satLookup'
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


const SALUTATIONS = ['Sr.', 'Sra.', 'Lic.', 'Ing.', 'Dr.', 'Dra.', 'Arq.']
const CURRENCIES  = ['GTQ', 'USD', 'EUR', 'MXN']
const COUNTRIES   = ['Guatemala', 'México', 'El Salvador', 'Honduras', 'Costa Rica', 'Estados Unidos', 'Otro']

// ── Navegación guiada entre pestañas ────────────────────────────────────────
const TAB_ORDER = ['info', 'taxes', 'address', 'contacts', 'other']
const TAB_REQUIRED_FIELDS: Record<string, string[]> = {
  info: ['legalName'],
  taxes: ['taxTreatment'],
  address: [],
  contacts: [],
  other: [],
}

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
      style={{ background: '#e6fafd', borderRadius: 8, marginBottom: 12 }}
      extra={
        !isOnly && (
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={onRemove} />
        )
      }
      title={<Text style={{ fontSize: 13, color: '#1faec2' }}>Contacto {index + 1}</Text>}
    >
      <Row gutter={12}>
        <Col xs={24} md={4}>
          <Form.Item name={[index, 'salutation']} label="Tratamiento">
            <Select placeholder="Sr." allowClear size="small">
              {SALUTATIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name={[index, 'firstName']} label="Nombre">
            <Input placeholder="Juan" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name={[index, 'lastName']} label="Apellido">
            <Input placeholder="García" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={4}>
          <Form.Item name={[index, 'isPrimary']} label="Principal" valuePropName="checked">
            <Switch size="small" checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Form.Item name={[index, 'email']} label="Correo">
            <Input placeholder="juan@empresa.com" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={7}>
          <Form.Item name={[index, 'phone']} label="Teléfono">
            <Input placeholder="+502 2345-6789" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={7}>
          <Form.Item name={[index, 'mobile']} label="Celular">
            <Input placeholder="+502 5678-9012" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={[index, 'designation']} label="Puesto">
            <Input placeholder="Gerente de compras" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={[index, 'department']} label="Departamento">
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
  const [lookingUp,    setLookingUp]    = useState(false)
  const [lookupStatus, setLookupStatus] = useState<'found' | 'not_found' | null>(null)
  const [activeTab,     setActiveTab]     = useState('info')
  const [completedTabs, setCompletedTabs] = useState<Set<string>>(new Set())

  const handleSatLookup = async (tipo: 'NIT' | 'CUI') => {
    const valor = form.getFieldValue('taxId')?.trim()
    if (!valor) return
    setLookingUp(true)
    setLookupStatus(null)
    try {
      const res = await satLookupApi.lookup(tipo, valor)
      if (res.found) {
        form.setFieldsValue({
          legalName: res.legalName,
          name:      res.tradeName || res.legalName,
          type:      res.type ?? form.getFieldValue('type'),
          ...(res.address && { billingAddress: { ...form.getFieldValue('billingAddress'), address: res.address, city: res.city } }),
          ...(res.phone   && { phone: res.phone }),
        })
        if (res.type) setClientType(res.type === 'individual' ? 'individual' : 'company')
        setLookupStatus('found')
        message.success(`Datos cargados: ${res.legalName}`)
      } else {
        setLookupStatus('not_found')
      }
    } catch {
      setLookupStatus('not_found')
    } finally { setLookingUp(false) }
  }

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
    } finally {
      setSaving(false)
    }
  }

  const ivaTaxes = taxes.filter(t =>
    (t.category === 'iva' || t.category === 'iva_exento' || t.category === 'iva_pequeno_contribuyente') &&
    (t.applicability === 'sales' || t.applicability === 'both')
  )
  const isrTaxes          = taxes.filter(t => t.category === 'isr')
  const ivaRetentionTaxes = taxes.filter(t => t.isWithholding && (t.category === 'iva' || t.category === 'iva_retenida'))
  const showRetention = ['contribuyente_especial', 'gobierno'].includes(taxTreatment)

  const tabIndex  = TAB_ORDER.indexOf(activeTab)
  const isLastTab = tabIndex === TAB_ORDER.length - 1

  const handleContinue = async () => {
    const fields = TAB_REQUIRED_FIELDS[activeTab]
    if (fields.length) {
      try {
        await form.validateFields(fields)
      } catch {
        return
      }
    }
    setCompletedTabs(prev => new Set(prev).add(activeTab))
    if (isLastTab) {
      handleSave()
    } else {
      setActiveTab(TAB_ORDER[tabIndex + 1])
    }
  }

  const handleBack = () => {
    if (tabIndex > 0) setActiveTab(TAB_ORDER[tabIndex - 1])
  }

  const renderTabLabel = (key: string, text: React.ReactNode) => {
    const isComplete = completedTabs.has(key)
    const isCurrent  = activeTab === key
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 16, height: 16, borderRadius: '50%', flex: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${isComplete ? '#52c41a' : isCurrent ? '#1B3A6B' : '#d9d9d9'}`,
            background: isComplete ? '#52c41a' : 'transparent',
            transition: 'all .2s',
          }}
        >
          {isComplete && <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />}
        </span>
        {text}
      </span>
    )
  }

  return (
    <Spin spinning={loading}>
      <style>{`.compact-form .ant-form-item { margin-bottom: 8px; }`}</style>
      <div className="compact-form" style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button
            type="text" icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/ventas/clientes')}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
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
            style={{ marginLeft: 'auto', background: '#1faec2', minWidth: 140 }}
          >
            {isNew ? 'Crear cliente' : 'Guardar cambios'}
          </Button>
        </div>

        <Form form={form} layout="vertical" size="small">
          <div
            style={{
              background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10,
              overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04)',
            }}
          >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            renderTabBar={(props, DefaultTabBar) => (
              <div>
                <DefaultTabBar {...props} style={{ marginBottom: 0, padding: '0 16px' }} />
                <div style={{ height: 3, background: '#f0f0f0' }}>
                  <div
                    style={{
                      height: '100%', background: '#52c41a', transition: 'width .3s ease',
                      width: `${(completedTabs.size / TAB_ORDER.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
            items={[
              // ── TAB 1: Info principal ─────────────────────────────────
              {
                key: 'info', label: renderTabLabel('info', 'Info principal'),
                children: (
                  <div style={{ padding: '20px 24px' }}>
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
                        <Form.Item label="NIT / CUI">
                          <Space.Compact style={{ width: '100%' }}>
                            <Form.Item name="taxId" noStyle>
                              <Input placeholder="1234567-8 o CUI" onPressEnter={() => handleSatLookup('NIT')}
                                onChange={() => setLookupStatus(null)} />
                            </Form.Item>
                            <Button loading={lookingUp} icon={<SearchOutlined />} onClick={() => handleSatLookup('NIT')} title="Buscar NIT" />
                            <Button loading={lookingUp} onClick={() => handleSatLookup('CUI')} style={{ fontSize: 11 }} title="Buscar CUI">CUI</Button>
                          </Space.Compact>
                          {lookupStatus === 'found' && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#2ea172' }}>
                              <CheckCircleOutlined /> Datos cargados del registro
                            </div>
                          )}
                          {lookupStatus === 'not_found' && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#ff7f00' }}>
                              <ExclamationCircleOutlined /> NIT/CUI no encontrado — completa manualmente
                            </div>
                          )}
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
                label: renderTabLabel('taxes', 'Impuestos y contabilidad'),
                children: (
                  <div style={{ padding: '20px 24px' }}>
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
                        optionLabelProp="label"
                      >
                        {TAX_TREATMENTS.map(t => (
                          <Option key={t.value} value={t.value} label={t.label}>
                            <div>
                              <div style={{ fontWeight: 500 }}>{t.label}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{t.desc}</div>
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
                          style={{ background: '#e6fafd', borderRadius: 8, marginBottom: 16 }}
                        >
                          <div style={{ fontWeight: 600, color: '#1faec2', marginBottom: 8 }}>
                            IVA aplicable en facturas de venta
                          </div>
                          <Form.Item name="taxCode" label="Impuesto IVA" style={{ marginBottom: 0 }}>
                            <Select placeholder="Selecciona impuesto IVA" allowClear>
                              {ivaTaxes.length > 0
                                ? ivaTaxes.map(t => (
                                  <Option key={t.code} value={t.code}>
                                    <Space>
                                      <Tag color="#1faec2">{t.code}</Tag>
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
                            style={{ background: '#fff2e5', borderRadius: 8, marginBottom: 16 }}
                          >
                            <div style={{ fontWeight: 600, color: '#ff7f00', marginBottom: 8 }}>
                              Retención de IVA (cliente retenedor)
                            </div>
                            <Form.Item name="ivaRetentionCode" label="Porcentaje de retención IVA" style={{ marginBottom: 0 }}>
                              <Select placeholder="Retención aplicable" allowClear>
                                {ivaRetentionTaxes.length > 0
                                  ? ivaRetentionTaxes.map(t => (
                                    <Option key={t.code} value={t.code}>
                                      <Space>
                                        <Tag color="#e84817" style={{ fontSize: 10 }}>{t.code}</Tag>
                                        {t.name}
                                      </Space>
                                    </Option>
                                  ))
                                  : <Option disabled value="">Sin retenciones IVA configuradas — ve a Configuración → Impuestos</Option>
                                }
                              </Select>
                            </Form.Item>
                          </Card>
                        </Col>
                      )}

                      {/* ISR / TDS */}
                      <Col xs={24} md={12}>
                        <Card
                          size="small" bordered={false}
                          style={{ background: '#fafbfc', borderRadius: 8, marginBottom: 16 }}
                        >
                          <div style={{ fontWeight: 600, color: '#0a0a0a', marginBottom: 8 }}>
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
                                      <Tag color="#6b7280">{t.code}</Tag>
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
                key: 'address', label: renderTabLabel('address', 'Dirección'),
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <Title level={5} style={{ color: '#0a0a0a', marginBottom: 16 }}>
                      Dirección de facturación
                    </Title>
                    <AddressForm prefix="billingAddress" />

                    <Divider />
                    <Title level={5} style={{ color: '#0a0a0a', marginBottom: 8 }}>
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
                key: 'contacts', label: renderTabLabel('contacts', `Contactos (${contactCount})`),
                children: (
                  <div style={{ padding: '20px 24px' }}>
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
                key: 'other', label: renderTabLabel('other', 'Otros'),
                children: (
                  <div style={{ padding: '20px 24px' }}>
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

          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa',
            }}
          >
            <Button onClick={handleBack} disabled={tabIndex === 0}>
              ← Anterior
            </Button>
            <Button
              type="primary"
              loading={saving}
              onClick={handleContinue}
              style={{ background: '#1B3A6B' }}
            >
              {isLastTab ? 'Guardar y finalizar ✓' : 'Continuar →'}
            </Button>
          </div>
          </div>
        </Form>
      </div>
    </Spin>
  )
}
