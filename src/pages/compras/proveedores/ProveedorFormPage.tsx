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
  TeamOutlined, PlusOutlined, DeleteOutlined, IdcardOutlined,
  SearchOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import {
  getVendor, createVendor, updateVendor,
  type Vendor, type ContactPerson, type Address,
} from '../../../api/contactos'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { satLookupApi } from '../../../api/satLookup'
import AccountSelect from '../../../components/AccountSelect'
import PaymentTermsSelect from '../../../components/PaymentTermsSelect'
import VendorBankAccountsSection from '../../../components/VendorBankAccountsSection'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Constantes ─────────────────────────────────────────────────────────────

const TAX_TREATMENTS = [
  { value: 'taxable',                label: 'Contribuyente — IVA 12%',                desc: 'Aplica IVA estándar. El proveedor cobra el IVA completo.' },
  { value: 'exempt',                 label: 'Exento de IVA',                          desc: 'No aplica IVA (exportaciones, medicamentos, etc.).' },
  { value: 'contribuyente_especial', label: 'Contribuyente especial — Retención IVA', desc: 'SAT designó a este proveedor como retenedor de IVA (15% o 30%).' },
  { value: 'gobierno',               label: 'Entidad de gobierno — Retención 65%',    desc: 'Entidades del Estado retienen el 65% del IVA.' },
  { value: 'exportador',             label: 'Exportador — IVA 0%',                    desc: 'Operaciones de exportación, tasa cero.' },
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
            <Input placeholder="Gerente de ventas" size="small" />
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
export default function ProveedorFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const isNew     = !id || id === 'nuevo'

  const [loading,      setLoading]      = useState(!isNew)
  const [saving,       setSaving]       = useState(false)
  const [taxes,        setTaxes]        = useState<Tax[]>([])
  const [contactCount, setContactCount] = useState(1)
  const [taxTreatment, setTaxTreatment] = useState<string>('taxable')
  const [vendorType,   setVendorType]   = useState<string>('company')
  const [lookingUp,    setLookingUp]    = useState(false)
  const [lookupStatus, setLookupStatus] = useState<'found' | 'not_found' | null>(null)

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
        if (res.type) setVendorType(res.type === 'individual' ? 'individual' : 'company')
        setLookupStatus('found')
        message.success(`Datos cargados: ${res.legalName}`)
      } else {
        setLookupStatus('not_found')
      }
    } catch {
      setLookupStatus('not_found')
    } finally { setLookingUp(false) }
  }

  // Cargar impuestos y datos del proveedor
  useEffect(() => {
    getTaxes().then((t: Tax[]) => setTaxes(Array.isArray(t) ? t : [])).catch(() => {})

    if (!isNew && id) {
      setLoading(true)
      getVendor(id)
        .then((v: Vendor) => {
          form.setFieldsValue({
            ...v,
            openingBalanceDate: v.openingBalanceDate
              ? String(v.openingBalanceDate).slice(0, 10)
              : undefined,
          })
          setContactCount(v.contacts?.length || 1)
          setTaxTreatment(v.taxTreatment ?? 'taxable')
          setVendorType(v.type ?? 'company')
        })
        .catch(() => message.error('No se pudo cargar el proveedor'))
        .finally(() => setLoading(false))
    } else {
      // Valores por defecto para nuevo proveedor/empleado
      form.resetFields()
      form.setFieldsValue({
        type: 'company', currency: 'GTQ', paymentTerms: 'net_30',
        taxTreatment: 'taxable', taxCode: 'IVA12',
        tdsEnabled: false,
        contacts: [{ firstName: '', isPrimary: true }],
        billingAddress: { country: 'Guatemala' },
      })
    }
  }, [id, isNew, form])

  // Ajusta valores por defecto cuando el usuario cambia el tipo
  const handleTypeChange = (type: string) => {
    setVendorType(type)
    if (type === 'employee') {
      form.setFieldsValue({
        taxTreatment: 'exempt',
        taxCode: undefined,
        tdsEnabled: false,
        currency: 'GTQ',
      })
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (!values.name) values.name = values.legalName
      setSaving(true)
      if (isNew) {
        await createVendor(values)
        message.success('Proveedor creado exitosamente')
      } else {
        await updateVendor(id!, values)
        message.success('Proveedor actualizado')
      }
      navigate('/compras/proveedores')
    } catch (e: any) {
      if (e?.errorFields) return // validación del form
      const serverMsg = e?.response?.data?.error?.message || e?.response?.data?.message
      const display = Array.isArray(serverMsg) ? serverMsg[0] : (serverMsg || 'Error al guardar')
      message.error(display)
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
            onClick={() => navigate('/compras/proveedores')}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
              {isNew ? 'Nuevo proveedor' : 'Editar proveedor'}
            </Title>
            <Text type="secondary">
              {isNew
                ? 'Completa la información del proveedor. Los campos de impuestos son críticos para las compras.'
                : 'Actualiza los datos del proveedor'}
            </Text>
          </div>
          <Button
            type="primary" icon={<SaveOutlined />}
            onClick={handleSave} loading={saving}
            style={{ marginLeft: 'auto', background: '#1B3A6B', minWidth: 140 }}
          >
            {isNew ? 'Crear proveedor' : 'Guardar cambios'}
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
                    {/* Alerta empleado */}
                    {vendorType === 'employee' && (
                      <Alert
                        icon={<IdcardOutlined />}
                        showIcon
                        type="warning"
                        message="Ficha de empleado — para reembolsos de gastos"
                        description="Este registro permite documentar y pagar reembolsos al empleado. Configura la cuenta puente en la pestaña 'Impuestos y contabilidad' para que se registre automáticamente al crear la factura de reembolso."
                        style={{ marginBottom: 20 }}
                      />
                    )}

                    {/* Tipo de proveedor */}
                    <Form.Item name="type" label="Tipo de proveedor">
                      <Radio.Group
                        onChange={e => handleTypeChange(e.target.value)}
                        buttonStyle="solid"
                      >
                        <Radio.Button value="company">
                          <BankOutlined /> Empresarial
                        </Radio.Button>
                        <Radio.Button value="individual">
                          <UserOutlined /> Individual
                        </Radio.Button>
                        <Radio.Button value="employee">
                          <IdcardOutlined /> Empleado
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    <Row gutter={16}>
                      {/* Para individuales y empleados: saludo + nombre */}
                      {(vendorType === 'individual' || vendorType === 'employee') && (
                        <>
                          <Col xs={24} md={4}>
                            <Form.Item name="salutation" label="Tratamiento">
                              <Select placeholder="Sr." allowClear>
                                {SALUTATIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="firstName" label="Nombre" rules={vendorType === 'employee' ? [{ required: true, message: 'Requerido' }] : []}>
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

                      <Col xs={24} md={vendorType !== 'company' ? 12 : 16}>
                        <Form.Item
                          name="legalName"
                          label={
                            vendorType === 'company'   ? 'Razón social (SAT)'    :
                            vendorType === 'employee'  ? 'Nombre completo (SAT)' :
                                                         'Nombre completo (SAT)'
                          }
                          rules={[{ required: true, message: 'El nombre es requerido' }]}
                        >
                          <Input
                            placeholder={
                              vendorType === 'company'  ? 'EMPRESA XYZ SOCIEDAD ANÓNIMA' :
                              vendorType === 'employee' ? 'JUAN CARLOS PÉREZ LÓPEZ'      :
                                                          'JUAN CARLOS PÉREZ LÓPEZ'
                            }
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      {vendorType !== 'employee' && (
                        <Col xs={24} md={vendorType === 'individual' ? 12 : 8}>
                          <Form.Item name="name" label="Nombre comercial">
                            <Input placeholder="Empresa XYZ S.A." />
                          </Form.Item>
                        </Col>
                      )}
                    </Row>

                    {/* ── Datos específicos del empleado ─────────────────── */}
                    {vendorType === 'employee' && (
                      <Card
                        size="small"
                        style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 16 }}
                      >
                        <div style={{ fontWeight: 600, color: '#874d00', marginBottom: 12, fontSize: 13 }}>
                          <IdcardOutlined style={{ marginRight: 6 }} />
                          Datos del empleado
                        </div>
                        <Row gutter={16}>
                          <Col xs={24} md={8}>
                            <Form.Item name={['customFields', 'dpi']} label="DPI / CUI">
                              <Input placeholder="1234 56789 0101" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name={['customFields', 'cargo']} label="Cargo / Puesto">
                              <Input placeholder="Contador, Vendedor..." />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name={['customFields', 'departamento']} label="Departamento / Área">
                              <Input placeholder="Administración, Ventas..." />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name={['customFields', 'fechaIngreso']} label="Fecha de ingreso">
                              <Input type="date" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    )}

                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item label={vendorType === 'employee' ? 'NIT / CUI (CF si no tiene)' : 'NIT / CUI'}>
                          <Space.Compact style={{ width: '100%' }}>
                            <Form.Item name="taxId" noStyle>
                              <Input placeholder="1234567-8 o CUI" onPressEnter={() => handleSatLookup('NIT')}
                                onChange={() => setLookupStatus(null)} />
                            </Form.Item>
                            <Button loading={lookingUp} icon={<SearchOutlined />} onClick={() => handleSatLookup('NIT')} title="Buscar NIT en SAT" />
                            <Button loading={lookingUp} onClick={() => handleSatLookup('CUI')} style={{ fontSize: 11 }} title="Buscar CUI en SAT">CUI</Button>
                          </Space.Compact>
                          {lookupStatus === 'found' && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#52c41a' }}>
                              <CheckCircleOutlined /> Datos cargados desde SAT
                            </div>
                          )}
                          {lookupStatus === 'not_found' && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#fa8c16' }}>
                              <ExclamationCircleOutlined /> NIT/CUI no encontrado — completa manualmente
                            </div>
                          )}
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="email" label="Correo electrónico"
                          rules={[{ type: 'email', message: 'Email inválido' }]}>
                          <Input placeholder={vendorType === 'employee' ? 'empleado@empresa.com' : 'info@proveedor.com'} />
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
                      {vendorType !== 'employee' && (
                        <>
                          <Col xs={24} md={8}>
                            <Form.Item name="website" label="Sitio web">
                              <Input placeholder="https://proveedor.com" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="currency" label="Moneda">
                              <Select>
                                {CURRENCIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                              </Select>
                            </Form.Item>
                          </Col>
                        </>
                      )}
                      <Col xs={24} md={8}>
                        <Form.Item name="paymentTerms" label="Términos de pago">
                          <PaymentTermsSelect />
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

                    {vendorType === 'employee' ? (
                      /* ── Vista simplificada para empleados ────────────── */
                      <>
                        <Alert
                          message="Configuración de reembolsos de empleado"
                          description="La cuenta puente es la cuenta transitoria que se usa al registrar una factura de reembolso. Debe ser una cuenta de pasivo (ej. 2105 — Por pagar a empleados). El ISR aplica si el empleado recibe pagos sujetos a retención."
                          type="info" showIcon style={{ marginBottom: 20 }}
                        />

                        <Row gutter={20}>
                          {/* Cuenta puente */}
                          <Col xs={24} md={12}>
                            <Card
                              size="small" bordered={false}
                              style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 16 }}
                            >
                              <div style={{ fontWeight: 600, color: '#874d00', marginBottom: 8 }}>
                                Cuenta puente (transitoria para reembolsos)
                              </div>
                              <Form.Item
                                name="payableAccountId"
                                label="Cuenta puente del empleado"
                                tooltip="Cuenta de pasivo transitoria que registra la obligación con el empleado. Se acredita al aprobar el reembolso y se debita al pagar."
                                style={{ marginBottom: 0 }}
                              >
                                <AccountSelect
                                  filter={{ isVendorAccount: true }}
                                  placeholder="Ej. 2105 — Por pagar a empleados..."
                                />
                              </Form.Item>
                            </Card>
                          </Col>

                          {/* Cuenta transitoria (empleados) */}
                          <Col xs={24} md={12}>
                            <Card
                              size="small" bordered={false}
                              style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: 8, marginBottom: 16 }}
                            >
                              <div style={{ fontWeight: 600, color: '#c41d7f', marginBottom: 8 }}>
                                Cuenta transitoria
                              </div>
                              <Form.Item
                                name="expenseAccountId"
                                label="Cuenta de pasivo"
                                style={{ marginBottom: 0 }}
                              >
                                <AccountSelect
                                  filter={{ balanceType: 'Pasivo' }}
                                  placeholder="Buscar cuenta de pasivo..."
                                />
                              </Form.Item>
                            </Card>
                          </Col>

                          {/* ISR del empleado */}
                          <Col xs={24} md={12}>
                            <Card
                              size="small" bordered={false}
                              style={{ background: '#f9f0ff', border: '1px dashed #d3adf7', borderRadius: 8, marginBottom: 16 }}
                            >
                              <div style={{ fontWeight: 600, color: '#531dab', marginBottom: 8 }}>
                                ISR — Retención sobre pagos al empleado
                              </div>
                              <Form.Item name="tdsEnabled" label="¿Aplica retención ISR en pagos a este empleado?" valuePropName="checked">
                                <Switch
                                  checkedChildren="Sí, retener ISR"
                                  unCheckedChildren="No aplica"
                                />
                              </Form.Item>
                              <Form.Item name="tdsTaxCode" label="Código ISR aplicable" style={{ marginBottom: 0 }}>
                                <Select placeholder="Selecciona impuesto ISR" allowClear>
                                  {isrTaxes.length > 0
                                    ? isrTaxes.map(t => (
                                      <Option key={t.code} value={t.code}>
                                        <Space><Tag color="purple">{t.code}</Tag>{t.name}</Space>
                                      </Option>
                                    ))
                                    : <Option disabled value="">Sin ISR configurado</Option>
                                  }
                                </Select>
                              </Form.Item>
                            </Card>
                          </Col>
                        </Row>
                      </>
                    ) : (
                      /* ── Vista estándar para proveedor/empresa ─────────── */
                      <>
                        <Alert
                          message="Vinculación fiscal — clave para registro de compras automático"
                          description="Los impuestos aquí configurados se aplican automáticamente al registrar facturas de compra de este proveedor. No es necesario seleccionarlos manualmente en cada factura."
                          type="info" showIcon style={{ marginBottom: 20 }}
                        />

                        {/* Tratamiento fiscal */}
                        <Form.Item
                          name="taxTreatment"
                          label="Tratamiento fiscal del proveedor"
                          rules={[{ required: true }]}
                        >
                          <Select onChange={v => setTaxTreatment(v)} size="large">
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
                                IVA aplicable en facturas de compra
                              </div>
                              <Form.Item name="taxCode" label="Impuesto IVA" style={{ marginBottom: 0 }}>
                                <Select placeholder="Selecciona impuesto IVA" allowClear>
                                  {ivaTaxes.length > 0
                                    ? ivaTaxes.map(t => (
                                      <Option key={t.code} value={t.code}>
                                        <Space><Tag color="blue">{t.code}</Tag>{t.name}</Space>
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
                                  Retención de IVA (proveedor retenedor)
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
                              <Form.Item name="tdsEnabled" label="¿Debemos retener ISR al pagar a este proveedor?" valuePropName="checked">
                                <Switch
                                  checkedChildren="Sí, aplica retención ISR"
                                  unCheckedChildren="No aplica retención ISR"
                                />
                              </Form.Item>
                              <Form.Item name="tdsTaxCode" label="Impuesto ISR aplicable" style={{ marginBottom: 0 }}>
                                <Select placeholder="Selecciona impuesto ISR" allowClear>
                                  {isrTaxes.length > 0
                                    ? isrTaxes.map(t => (
                                      <Option key={t.code} value={t.code}>
                                        <Space><Tag color="purple">{t.code}</Tag>{t.name}</Space>
                                      </Option>
                                    ))
                                    : <Option disabled value="">Sin ISR configurado — ve a Configuración → Impuestos</Option>
                                  }
                                </Select>
                              </Form.Item>
                            </Card>
                          </Col>
                        </Row>

                        <Divider titlePlacement="left">Cuentas contables e impuesto</Divider>
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="payableAccountId"
                              label="Cuenta por pagar (CxP)"
                              tooltip="Solo muestra cuentas marcadas como 'Cuenta de proveedores' en el catálogo. Registra las facturas pendientes de pago."
                            >
                              <AccountSelect
                                filter={{ isVendorAccount: true }}
                                placeholder="Buscar cuenta CxP..."
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="expenseAccountId"
                              label="Cuenta de gastos por defecto"
                              tooltip="Solo muestra cuentas de tipo Gastos. Se usa automáticamente al registrar facturas de compra de este proveedor."
                            >
                              <AccountSelect
                                filter={{ balanceType: 'Gastos' }}
                                placeholder="Buscar cuenta de gastos..."
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="defaultPurchaseTaxId"
                              label="Impuesto de compra por defecto (IVA)"
                              tooltip="Al agregar un artículo en una orden de compra o factura proveedor, se aplicará automáticamente este impuesto."
                            >
                              <Select
                                placeholder="Seleccionar impuesto IVA…"
                                allowClear
                                options={taxes
                                  .filter(t => t.isActive && !t.isWithholding && (t.applicability === 'purchases' || t.applicability === 'both'))
                                  .map((t: Tax) => ({
                                    value: t.id,
                                    label: `${t.name} (${Number(t.rate)}%)`,
                                  }))}
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
                      </>
                    )}
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
                        Agrega las personas de contacto en el proveedor. El contacto marcado como "Principal" recibirá las comunicaciones.
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
                          <TextArea rows={4} placeholder="Observaciones sobre el proveedor (no visibles en documentos)" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider titlePlacement="left">Cuentas bancarias del proveedor (guateACH)</Divider>
                    <VendorBankAccountsSection vendorId={id} />
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
