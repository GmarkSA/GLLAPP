import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout, Menu, Form, Input, Button, Select, Upload, Avatar,
  Typography, Card, Row, Col, Divider, message, Spin, Space, Tag,
  Modal, Table, Popconfirm, InputNumber, Switch,
} from 'antd'
import {
  BankOutlined, GlobalOutlined, DollarOutlined,
  MailOutlined, PhoneOutlined, EnvironmentOutlined,
  CameraOutlined, SaveOutlined, TeamOutlined,
  SecurityScanOutlined, ApiOutlined, BellOutlined,
  FileTextOutlined, ClockCircleOutlined, PercentageOutlined,
  PlusOutlined, DeleteOutlined, StarFilled,
} from '@ant-design/icons'
import ImpuestosPage  from './impuestos/ImpuestosPage'
import LibroSATPage   from './libros-sat/LibroSATPage'
import type { UploadChangeParam } from 'antd/es/upload'
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  uploadLogo,
  type OrganizationProfile,
} from '../../api/configuracion'
import {
  getCurrencies, createCurrency, updateRate, removeCurrency,
  type Currency,
} from '../../api/monedas'
import { getAccounts, type Account } from '../../api/catalogo'
import { useCompanyStore } from '../../store/companyStore'

const { Sider, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// â”€â”€ Sidebar sections (Zoho Books pattern) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sections = [
  { key: 'organization',    icon: <BankOutlined />,         label: 'Perfil de organizaciÃ³n' },
  { key: 'fiscal',          icon: <FileTextOutlined />,     label: 'ConfiguraciÃ³n fiscal' },
  { key: 'taxes',           icon: <PercentageOutlined />,   label: 'Impuestos' },
  { key: 'librosSAT',       icon: <FileTextOutlined />,     label: 'Columnas Libros SAT' },
  { key: 'currency',        icon: <DollarOutlined />,       label: 'Monedas' },
  { key: 'accountDefaults', icon: <ApiOutlined />,          label: 'Cuentas por defecto' },
  { key: 'users',           icon: <TeamOutlined />,         label: 'Usuarios y roles' },
  { key: 'notifications',   icon: <BellOutlined />,         label: 'Notificaciones' },
  { key: 'integrations',    icon: <ApiOutlined />,          label: 'Integraciones' },
  { key: 'security',        icon: <SecurityScanOutlined />, label: 'Seguridad' },
]

const COUNTRIES = [
  'Guatemala', 'MÃ©xico', 'El Salvador', 'Honduras', 'Costa Rica',
  'PanamÃ¡', 'Colombia', 'Estados Unidos', 'EspaÃ±a', 'Otro',
]

const TIMEZONES = [
  { value: 'America/Guatemala',    label: '(GMT-6) Guatemala' },
  { value: 'America/Mexico_City',  label: '(GMT-6) Ciudad de MÃ©xico' },
  { value: 'America/Bogota',       label: '(GMT-5) BogotÃ¡' },
  { value: 'America/New_York',     label: '(GMT-5) Nueva York' },
  { value: 'America/Los_Angeles',  label: '(GMT-8) Los Ãngeles' },
  { value: 'Europe/Madrid',        label: '(GMT+1) Madrid' },
]

const CURRENCIES = [
  { code: 'GTQ', label: 'Quetzal guatemalteco (Q)' },
  { code: 'USD', label: 'DÃ³lar estadounidense ($)' },
  { code: 'HNL', label: 'Lempira hondureno (L)' },
  { code: 'NIO', label: 'Cordoba nicaraguense (C$)' },
  { code: 'MXN', label: 'Peso mexicano ($)' },
  { code: 'EUR', label: 'Euro (â‚¬)' },
  { code: 'COP', label: 'Peso colombiano ($)' },
]

const FISCAL_MONTHS = [
  { value: '01', label: 'Enero' },  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },   { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]

const COUNTRY_FISCAL_CONFIG: Record<string, { country: string; taxIdLabel: string; authority: string; invoiceName: string; timezone: string; currency: string }> = {
  GT: { country: 'Guatemala', taxIdLabel: 'NIT del emisor', authority: 'SAT Guatemala', invoiceName: 'Facturacion electronica FEL', timezone: 'America/Guatemala', currency: 'GTQ' },
  HN: { country: 'Honduras', taxIdLabel: 'RTN del emisor', authority: 'SAR Honduras', invoiceName: 'Facturacion electronica', timezone: 'America/Tegucigalpa', currency: 'HNL' },
  NI: { country: 'Nicaragua', taxIdLabel: 'RUC del emisor', authority: 'DGI Nicaragua', invoiceName: 'Facturacion electronica', timezone: 'America/Managua', currency: 'NIO' },
  SV: { country: 'El Salvador', taxIdLabel: 'NIT del emisor', authority: 'Ministerio de Hacienda', invoiceName: 'Facturacion electronica', timezone: 'America/El_Salvador', currency: 'USD' },
  CR: { country: 'Costa Rica', taxIdLabel: 'Cedula juridica del emisor', authority: 'Ministerio de Hacienda CR', invoiceName: 'Facturacion electronica', timezone: 'America/Costa_Rica', currency: 'CRC' },
  PA: { country: 'Panama', taxIdLabel: 'RUC del emisor', authority: 'DGI Panama', invoiceName: 'Facturacion electronica', timezone: 'America/Panama', currency: 'USD' },
}

const countryCodeFromValue = (value?: string | null): string => {
  const raw = String(value ?? '').toUpperCase()
  if (raw === 'HN' || raw.includes('HONDURAS')) return 'HN'
  if (raw === 'NI' || raw.includes('NICARAGUA')) return 'NI'
  if (raw === 'SV' || raw.includes('SALVADOR')) return 'SV'
  if (raw === 'CR' || raw.includes('COSTA')) return 'CR'
  if (raw === 'PA' || raw.includes('PANAMA') || raw.includes('PANAM')) return 'PA'
  return raw === 'GT' || raw.includes('GUATEMALA') ? 'GT' : 'GT'
}
// â”€â”€ Sub-pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OrganizationSection({
  profile, loading, onSave,
}: {
  profile: OrganizationProfile | null
  loading: boolean
  onSave: (values: Partial<OrganizationProfile>) => Promise<void>
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const [logoUrl, setLogoUrl] = useState<string | undefined>(profile?.logoUrl)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      form.setFieldsValue(profile)
      setLogoUrl(profile.logoUrl)
    }
  }, [profile, form])

  const handleLogoUpload = async (info: UploadChangeParam) => {
    const file = info.file.originFileObj
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadLogo(file)
      setLogoUrl(url)
      message.success('Logo actualizado')
    } catch {
      // If backend logo endpoint isn't ready, show preview from local file
      const reader = new FileReader()
      reader.onload = e => setLogoUrl(e.target?.result as string)
      reader.readAsDataURL(file)
      message.info('Logo cargado localmente (endpoint en desarrollo)')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await onSave({ ...values, logoUrl })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 28 }}>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Perfil de organizaciÃ³n</Title>
          <Text type="secondary">InformaciÃ³n general de tu empresa que aparece en documentos y reportes</Text>
        </div>

        {/* Logo row */}
        <Card bordered={false} style={cardStyle} bodyStyle={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <Avatar
                size={96}
                src={logoUrl}
                style={{
                  background: logoUrl ? 'transparent' : '#1B3A6B',
                  fontSize: 32, fontWeight: 700,
                  border: '3px solid #e8edf5',
                }}
              >
                {!logoUrl && (profile?.name?.[0] || 'E')}
              </Avatar>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={() => false}
                onChange={handleLogoUpload}
              >
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#1B3A6B', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff',
                }}>
                  {uploading
                    ? <Spin size="small" />
                    : <CameraOutlined style={{ color: '#fff', fontSize: 13 }} />
                  }
                </div>
              </Upload>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#1B3A6B' }}>
                {profile?.name || 'Tu empresa'}
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Haz clic en el Ã­cono de cÃ¡mara para cambiar el logo
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                PNG, JPG o SVG â€” mÃ¡ximo 2 MB, recomendado 200Ã—200 px
              </Text>
            </div>
          </div>
        </Card>

        {/* Main form */}
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>

          {/* Basic info */}
          <SectionCard title="InformaciÃ³n bÃ¡sica" icon={<BankOutlined />}>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name="name" label="Nombre comercial" rules={[{ required: true, message: 'Requerido' }]}>
                  <Input placeholder="Mi Empresa S.A." size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="legalName" label="RazÃ³n social">
                  <Input placeholder="MI EMPRESA SOCIEDAD ANÃ“NIMA" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="taxId" label="NIT / RFC / RUC">
                  <Input placeholder="1234567-8" size="large" prefix={<FileTextOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="industry" label="Industria">
                  <Select placeholder="Selecciona una industria" size="large">
                    {['Comercio', 'Manufactura', 'Servicios profesionales', 'TecnologÃ­a',
                      'ConstrucciÃ³n', 'Salud', 'EducaciÃ³n', 'Agricultura', 'Otro'].map(i =>
                      <Option key={i} value={i}>{i}</Option>
                    )}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          {/* Contact */}
          <SectionCard title="InformaciÃ³n de contacto" icon={<MailOutlined />}>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name="email" label="Correo electrÃ³nico" rules={[{ type: 'email', message: 'Email invÃ¡lido' }]}>
                  <Input placeholder="info@miempresa.com" size="large" prefix={<MailOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label="TelÃ©fono">
                  <Input placeholder="+502 2345-6789" size="large" prefix={<PhoneOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="website" label="Sitio web">
                  <Input placeholder="https://miempresa.com" size="large" prefix={<GlobalOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          {/* Address */}
          <SectionCard title="DirecciÃ³n" icon={<EnvironmentOutlined />}>
            <Row gutter={20}>
              <Col xs={24}>
                <Form.Item name="address" label="DirecciÃ³n">
                  <TextArea
                    placeholder="5a Avenida 4-50, Zona 1"
                    rows={2}
                    size="large"
                    style={{ resize: 'none' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="city" label="Ciudad">
                  <Input placeholder="Ciudad de Guatemala" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="state" label="Departamento / Estado">
                  <Input placeholder="Guatemala" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="zipCode" label="CÃ³digo postal">
                  <Input placeholder="01001" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="country" label="PaÃ­s">
                  <Select placeholder="Selecciona un paÃ­s" size="large">
                    {COUNTRIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          {/* Save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              style={{ background: '#1B3A6B', minWidth: 160 }}
            >
              Guardar cambios
            </Button>
          </div>
        </Form>
      </div>
    </Spin>
  )
}

function FiscalSection({
  profile, loading, onSave,
}: {
  profile: OrganizationProfile | null
  loading: boolean
  onSave: (values: Partial<OrganizationProfile>) => Promise<void>
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const companyCountryCode = countryCodeFromValue((activeCompany as any)?.countryCode ?? (activeCompany as any)?.country ?? profile?.country)
  const watchedCountry = Form.useWatch(['settings', 'fiscalCountryCode'], form)
  const fiscalCountryCode = countryCodeFromValue(watchedCountry ?? companyCountryCode)
  const fiscalMeta = COUNTRY_FISCAL_CONFIG[fiscalCountryCode] ?? COUNTRY_FISCAL_CONFIG.GT

  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        ...profile,
        settings: {
          ...(profile as any).settings,
          fiscalCountryCode: (profile as any).settings?.fiscalCountryCode ?? companyCountryCode,
        },
      })
    }
  }, [profile, form, companyCountryCode])

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try { await onSave(values) }
    finally { setSaving(false) }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 28 }}>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>ConfiguraciÃ³n fiscal</Title>
          <Text type="secondary">ParÃ¡metros para la generaciÃ³n de documentos fiscales y reportes</Text>
        </div>

        <Form form={form} layout="vertical">
          <SectionCard title="Pais fiscal" icon={<GlobalOutlined />}>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name={['settings', 'fiscalCountryCode']} label="Pais / autoridad fiscal">
                  <Select size="large" placeholder="Selecciona pais fiscal">
                    {Object.entries(COUNTRY_FISCAL_CONFIG).map(([code, meta]) => (
                      <Option key={code} value={code}>{code} - {meta.country}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Moneda local / consolidacion">
                  <Input value={`${fiscalMeta.currency} / USD`} size="large" disabled />
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          <SectionCard title="AÃ±o fiscal" icon={<ClockCircleOutlined />}>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name="fiscalYearStart" label="Inicio del aÃ±o fiscal">
                  <Select placeholder="Mes de inicio" size="large">
                    {FISCAL_MONTHS.map(m => (
                      <Option key={m.value} value={m.value}>{m.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -16, marginBottom: 16 }}>
                  El anio fiscal de este pais inicia en el mes seleccionado
                </Text>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="timezone" label="Zona horaria">
                  <Select placeholder="Selecciona zona horaria" size="large">
                    {TIMEZONES.map(t => (
                      <Option key={t.value} value={t.value}>{t.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          <SectionCard title={fiscalMeta.invoiceName} icon={<FileTextOutlined />}>
            <div style={{
              background: '#f0f7ff', borderRadius: 8, padding: '16px 20px',
              border: '1px solid #bae0ff', marginBottom: 16,
            }}>
              <Space>
                <Tag color="blue">{fiscalMeta.authority}</Tag>
                <Text style={{ fontSize: 13 }}>
                  La configuracion de facturacion electronica se realiza en la seccion <strong>Integraciones</strong>
                </Text>
              </Space>
            </div>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name="taxId" label={fiscalMeta.taxIdLabel}>
                  <Input placeholder="1234567-8" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="legalName" label={`Nombre del emisor (como en ${fiscalMeta.authority})`}>
                  <Input placeholder="MI EMPRESA SOCIEDAD ANÃ“NIMA" size="large" />
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button
              type="primary" size="large" icon={<SaveOutlined />}
              loading={saving} onClick={handleSave}
              style={{ background: '#1B3A6B', minWidth: 160 }}
            >
              Guardar cambios
            </Button>
          </div>
        </Form>
      </div>
    </Spin>
  )
}

// â”€â”€ CatÃ¡logo de monedas disponibles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ALL_CURRENCIES = [
  { code: 'GTQ', name: 'Quetzal guatemalteco',   symbol: 'Q',   country: 'Guatemala' },
  { code: 'USD', name: 'DÃ³lar estadounidense',    symbol: '$',   country: 'Estados Unidos' },
  { code: 'EUR', name: 'Euro',                    symbol: 'â‚¬',   country: 'UniÃ³n Europea' },
  { code: 'MXN', name: 'Peso mexicano',           symbol: '$',   country: 'MÃ©xico' },
  { code: 'COP', name: 'Peso colombiano',         symbol: '$',   country: 'Colombia' },
  { code: 'HNL', name: 'Lempira hondureÃ±o',       symbol: 'L',   country: 'Honduras' },
  { code: 'NIO', name: 'Cordoba nicaraguense',    symbol: 'C$',  country: 'Nicaragua' },
  { code: 'CRC', name: 'ColÃ³n costarricense',     symbol: 'â‚¡',   country: 'Costa Rica' },
  { code: 'DOP', name: 'Peso dominicano',         symbol: 'RD$', country: 'Rep. Dominicana' },
  { code: 'PEN', name: 'Sol peruano',             symbol: 'S/',  country: 'PerÃº' },
  { code: 'CLP', name: 'Peso chileno',            symbol: '$',   country: 'Chile' },
  { code: 'GBP', name: 'Libra esterlina',         symbol: 'Â£',   country: 'Reino Unido' },
  { code: 'CAD', name: 'DÃ³lar canadiense',        symbol: 'CA$', country: 'CanadÃ¡' },
]


function CurrencySection() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [form] = Form.useForm()

  const fetchCurrencies = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCurrencies()
      const list: Currency[] = Array.isArray(data) ? data : []
      // Ordenar: moneda base primero
      list.sort((a, b) => (b.isBase ? 1 : 0) - (a.isBase ? 1 : 0))
      setCurrencies(list)
    } catch {
      setCurrencies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCurrencies() }, [fetchCurrencies])

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      const meta   = ALL_CURRENCIES.find(c => c.code === values.code)!
      setSaving(true)
      await createCurrency({
        code:         values.code,
        name:         meta.name,
        symbol:       meta.symbol,
        exchangeRate: values.exchangeRate ?? 1,
        isBase:       false,
        isActive:     true,
      })
      message.success(`Moneda ${meta.name} agregada`)
      setModalOpen(false)
      form.resetFields()
      fetchCurrencies()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      if (msg) message.error(msg)
      // validation errors are silently ignored
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeCurrency(id)
      message.success(`Moneda ${name} eliminada`)
      fetchCurrencies()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const handleRateChange = async (id: string, rate: number) => {
    try {
      await updateRate(id, rate)
      setCurrencies(prev => prev.map(c => c.id === id ? { ...c, exchangeRate: rate } : c))
    } catch {
      message.error('No se pudo actualizar la tasa')
    }
  }

  const activeCodes  = currencies.map(c => c.code)
  const availableToAdd = ALL_CURRENCIES.filter(c => !activeCodes.includes(c.code))
  const localCurrencyCode = activeCompany?.currencyCode ?? currencies.find(c => c.isBase)?.code ?? 'GTQ'
  const localCurrencyMeta = ALL_CURRENCIES.find(c => c.code === localCurrencyCode)
  const usdAvailable = availableToAdd.some(c => c.code === 'USD')

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Monedas</Title>
          <Text type="secondary">
            Moneda local: {localCurrencyCode}{localCurrencyMeta ? ` (${localCurrencyMeta.name})` : ''}. Consolidacion: USD.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setModalOpen(true)
            if (usdAvailable) form.setFieldsValue({ code: 'USD' })
          }}
          style={{ background: '#1B3A6B' }}
          disabled={availableToAdd.length === 0}
        >
          Agregar moneda
        </Button>
      </div>

      {/* Tabla de monedas activas */}
      <Card bordered={false} style={cardStyle} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={currencies}
          rowKey="id"
          pagination={false}
          size="middle"
          loading={loading}
          columns={[
            {
              title: 'Moneda',
              render: (_, r) => (
                <Space>
                  <Tag style={{ fontFamily: 'monospace', fontSize: 13, padding: '2px 8px' }}>
                    {r.code}
                  </Tag>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>SÃ­mbolo: {r.symbol}</Text>
                  </div>
                  {r.isBase && <Tag color="gold" icon={<StarFilled />}>Base</Tag>}
                </Space>
              ),
            },
            {
              title: `Tipo de cambio desde ${localCurrencyCode}`,
              width: 240,
              render: (_, r) => r.code === localCurrencyCode
                ? <Text type="secondary">1.0000 (moneda local)</Text>
                : (
                  <InputNumber
                    value={Number(r.exchangeRate)}
                    min={0.000001}
                    precision={4}
                    step={0.01}
                    onBlur={e => {
                      const v = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                      if (!isNaN(v)) handleRateChange(r.id, v)
                    }}
                    style={{ width: 140 }}
                    addonBefore={`1 ${localCurrencyCode} =`}
                    addonAfter={r.code}
                  />
                ),
            },
            {
              title: '',
              width: 60,
              render: (_, r) => r.code === localCurrencyCode ? null : (
                <Popconfirm
                  title={`Â¿Eliminar ${r.name}?`}
                  onConfirm={() => handleRemove(r.id, r.name)}
                  okText="SÃ­" cancelText="No"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal agregar moneda */}
      <Modal
        open={modalOpen}
        title={<Space><DollarOutlined /> Agregar moneda</Space>}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={handleAdd}
        okText="Agregar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Moneda" rules={[{ required: true, message: 'Selecciona una moneda' }]}>
            <Select
              showSearch
              placeholder="Busca por nombre o cÃ³digo..."
              size="large"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {availableToAdd.map(c => (
                <Option key={c.code} value={c.code} label={`${c.code} ${c.name}`}>
                  <Space>
                    <Tag style={{ fontFamily: 'monospace' }}>{c.code}</Tag>
                    <span>{c.name}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>({c.country})</Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="exchangeRate"
            label={`Tipo de cambio inicial (1 ${localCurrencyCode} =)`}
            rules={[{ required: true, message: 'Ingresa el tipo de cambio' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.000001}
              precision={4}
              step={0.01}
              placeholder={localCurrencyCode === 'GTQ' ? 'Ej: 0.13 para USD' : localCurrencyCode === 'HNL' ? 'Ej: 0.039 para USD' : localCurrencyCode === 'NIO' ? 'Ej: 0.027 para USD' : 'Ej: tasa hacia USD'}
              size="large"
            />
          </Form.Item>

          <Form.Item
            extra="La actualizaciÃ³n automÃ¡tica de tasas estarÃ¡ disponible prÃ³ximamente"
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Puedes actualizar la tasa manualmente en la tabla en cualquier momento.
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

interface AccountDefaults {
  customerAdvanceAccountCode?: string
  vendorAdvanceAccountCode?: string
  employeeAdvanceAccountCode?: string
}

function AccountDefaultsSection() {
  const [accounts,  setAccounts]  = useState<Account[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [defaults,  setDefaults]  = useState<AccountDefaults>({
    customerAdvanceAccountCode:  '2110',
    vendorAdvanceAccountCode:    '2500',
    employeeAdvanceAccountCode:  '1260',
  })

  useEffect(() => {
    // Load accounts list and current settings in parallel
    Promise.all([
      getAccounts({ limit: 1000, isActive: true })
        .then((data: any) => {
          const list: Account[] = Array.isArray(data) ? data : (data?.data ?? [])
          setAccounts(list)
        })
        .catch(() => setAccounts([])),
      getOrganizationProfile()
        .then((profile: any) => {
          if (profile?.settings?.accountDefaults) {
            setDefaults(prev => ({ ...prev, ...profile.settings.accountDefaults }))
          }
        })
        .catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Read current settings first to avoid overwriting other keys
      const profile = await getOrganizationProfile().catch(() => ({} as any))
      const existingSettings = (profile as any)?.settings ?? {}
      await updateOrganizationProfile({
        settings: {
          ...existingSettings,
          accountDefaults: defaults,
        },
      } as any)
      message.success('Cuentas por defecto guardadas correctamente')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar la configuraciÃ³n')
    } finally {
      setSaving(false)
    }
  }

  const accountOptions = accounts.map(a => ({
    value: a.code,
    label: `${a.code} â€” ${a.name}`,
  }))

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 28 }}>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Cuentas por defecto</Title>
          <Text type="secondary">
            Define las cuentas contables que se usarÃ¡n automÃ¡ticamente al registrar anticipos y documentos sin cuenta especÃ­fica
          </Text>
        </div>

        <SectionCard title="Anticipos" icon={<DollarOutlined />}>
          <Row gutter={20}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Anticipo de clientes</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cuenta de pasivo usada al registrar pagos anticipados de clientes sin factura
                </Text>
              </div>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={defaults.customerAdvanceAccountCode}
                placeholder="Ej: 2110 â€” Anticipos de Clientes"
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={accountOptions}
                onChange={val => setDefaults(prev => ({ ...prev, customerAdvanceAccountCode: val }))}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Valor actual: <Text code>{defaults.customerAdvanceAccountCode || '2110'}</Text>
              </Text>
            </Col>

            <Col xs={24} md={12}>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Anticipo de proveedores</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cuenta de activo usada al registrar anticipos pagados a proveedores
                </Text>
              </div>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={defaults.vendorAdvanceAccountCode}
                placeholder="Ej: 2500 â€” Anticipos a Proveedores"
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={accountOptions}
                onChange={val => setDefaults(prev => ({ ...prev, vendorAdvanceAccountCode: val }))}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Valor actual: <Text code>{defaults.vendorAdvanceAccountCode || '2500'}</Text>
              </Text>
            </Col>

            <Col xs={24} md={12} style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Anticipo de empleados</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cuenta de activo para anticipos de nÃ³mina o prÃ©stamos a empleados
                </Text>
              </div>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={defaults.employeeAdvanceAccountCode}
                placeholder="Ej: 1260 â€” Anticipos a Empleados"
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={accountOptions}
                onChange={val => setDefaults(prev => ({ ...prev, employeeAdvanceAccountCode: val }))}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Valor actual: <Text code>{defaults.employeeAdvanceAccountCode || '1260'}</Text>
              </Text>
            </Col>
          </Row>
        </SectionCard>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ background: '#1B3A6B', minWidth: 160 }}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </Spin>
  )
}

function ComingSoonSection({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{title}</Title>
        <Text type="secondary">{description}</Text>
      </div>
      <Card bordered={false} style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#8c8c8c' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>ðŸš§</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1B3A6B', marginBottom: 8 }}>
            En desarrollo
          </div>
          <div style={{ fontSize: 14 }}>Esta secciÃ³n estarÃ¡ disponible prÃ³ximamente</div>
        </div>
      </Card>
    </div>
  )
}

// â”€â”€ Helper components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card
      bordered={false}
      style={{ ...cardStyle, marginBottom: 16 }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ color: '#1B3A6B', fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 600, color: '#1B3A6B', fontSize: 14 }}>{title}</span>
      </div>
      <Divider style={{ margin: '0 0 20px' }} />
      {children}
    </Card>
  )
}

const cardStyle: React.CSSProperties = {
  borderRadius: 10,
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  background: '#fff',
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ConfiguracionPage() {
  const navigate   = useNavigate()
  const [activeKey, setActiveKey] = useState('organization')
  const [profile, setProfile] = useState<OrganizationProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const data = await getOrganizationProfile()
      setProfile(data)
    } catch {
      // Backend endpoint may not exist yet â€” use empty profile
      setProfile({ name: '', email: '', country: 'Guatemala', currency: 'GTQ', fiscalYearStart: '01', timezone: 'America/Guatemala' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: Partial<OrganizationProfile>) => {
    try {
      const updated = await updateOrganizationProfile(values)
      setProfile(prev => ({ ...prev, ...updated }))
      message.success('âœ“ Cambios guardados correctamente')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message
      const detail = Array.isArray(msg) ? msg.join(', ') : msg
      message.error(detail ? `Error: ${detail}` : 'No se pudo guardar. Intenta de nuevo.')
    }
  }

  const renderContent = () => {
    switch (activeKey) {
      case 'organization':
        return <OrganizationSection profile={profile} loading={loading} onSave={handleSave} />
      case 'fiscal':
        return <FiscalSection profile={profile} loading={loading} onSave={handleSave} />
      case 'currency':
        return <CurrencySection />
      case 'taxes':
        return <ImpuestosPage />
      case 'librosSAT':
        return <LibroSATPage />
      case 'accountDefaults':
        return <AccountDefaultsSection />
      case 'users':
        navigate('/configuracion/usuarios')
        return null
      case 'notifications':
        return <ComingSoonSection title="Notificaciones" description="Configura alertas por correo y notificaciones del sistema" />
      case 'integrations':
        return <ComingSoonSection title="Integraciones" description="Conecta ContaERP con servicios externos: FEL, bancos, pagos" />
      case 'security':
        return <ComingSoonSection title="Seguridad" description="AutenticaciÃ³n, tokens de API y registro de actividad" />
      default:
        return null
    }
  }

  return (
    <Layout style={{ background: 'transparent', minHeight: 'calc(100vh - 112px)' }}>
      {/* Left nav â€” Zoho Books style */}
      <Sider
        width={230}
        style={{
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          marginRight: 20,
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 88,
        }}
      >
        <div style={{ padding: '20px 16px 12px' }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 1 }}>
            ConfiguraciÃ³n
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => setActiveKey(key)}
          style={{ border: 'none', fontSize: 13 }}
          items={sections.map(s => ({
            key: s.key,
            icon: s.icon,
            label: s.label,
            style: {
              borderRadius: 6,
              margin: '2px 8px',
              width: 'calc(100% - 16px)',
            },
          }))}
        />
        <div style={{ height: 20 }} />
      </Sider>

      {/* Right content */}
      <Content style={{ background: 'transparent' }}>
        {renderContent()}
      </Content>
    </Layout>
  )
}


