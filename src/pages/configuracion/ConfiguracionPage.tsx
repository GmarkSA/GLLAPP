import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Layout, Menu, Form, Input, Button, Select, Upload, Avatar,
  Typography, Card, Row, Col, Divider, message, Spin, Space, Tag,
  Modal, Table, Popconfirm, InputNumber, Switch, Collapse,
} from 'antd'
import {
  BankOutlined, GlobalOutlined, DollarOutlined,
  MailOutlined, PhoneOutlined, EnvironmentOutlined,
  CameraOutlined, SaveOutlined, TeamOutlined,
  ApiOutlined,
  FileTextOutlined, ClockCircleOutlined, PercentageOutlined,
  PlusOutlined, DeleteOutlined, StarFilled, CodeOutlined, SyncOutlined,
  CreditCardOutlined, LockOutlined, AuditOutlined, SwapOutlined,
} from '@ant-design/icons'
import ImpuestosPage          from './impuestos/ImpuestosPage'
import LibroSATPage           from './libros-sat/LibroSATPage'
import EspacioDesarrolloPage  from './EspacioDesarrolloPage'
import IntegracionesPage      from './IntegracionesPage'
import type { UploadChangeParam } from 'antd/es/upload'
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  uploadLogo,
  type OrganizationProfile,
} from '../../api/configuracion'
import {
  getCurrencies, createCurrency, updateRate, syncBanguatRate, getExchangeRateHistory, removeCurrency,
  type Currency, type CurrencyExchangeRate,
} from '../../api/monedas'
import { getAccounts, type Account } from '../../api/catalogo'
import { useCompanyStore } from '../../store/companyStore'
import { companiesApi } from '../../api/companies'

const { Sider, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Sidebar sections (Zoho Books pattern) ──────────────────────────────────
const sections = [
  { key: 'organization',    icon: <BankOutlined />,         label: 'Perfil de organización' },
  { key: 'taxes',           icon: <PercentageOutlined />,   label: 'Impuestos' },
  { key: 'librosSAT',       icon: <FileTextOutlined />,     label: 'Columnas Libros SAT' },
  { key: 'currency',        icon: <DollarOutlined />,       label: 'Monedas' },
  { key: 'contabilidad',   icon: <AuditOutlined />,         label: 'Contabilidad' },
  { key: 'users',          icon: <TeamOutlined />,          label: 'Usuarios y roles' },
  { key: 'subscription',    icon: <CreditCardOutlined />,   label: 'Suscripción y Facturación' },
  { key: 'integrations',    icon: <ApiOutlined />,          label: 'Integraciones' },
  { key: 'devspace',        icon: <CodeOutlined />,         label: 'Espacio de desarrollo' },
]

const COUNTRIES = [
  'Guatemala', 'México', 'El Salvador', 'Honduras', 'Costa Rica',
  'Panamá', 'Colombia', 'Estados Unidos', 'España', 'Otro',
]

const TIMEZONES = [
  { value: 'America/Guatemala',    label: '(GMT-6) Guatemala' },
  { value: 'America/Mexico_City',  label: '(GMT-6) Ciudad de México' },
  { value: 'America/Bogota',       label: '(GMT-5) Bogotá' },
  { value: 'America/New_York',     label: '(GMT-5) Nueva York' },
  { value: 'America/Los_Angeles',  label: '(GMT-8) Los Ángeles' },
  { value: 'Europe/Madrid',        label: '(GMT+1) Madrid' },
]

const CURRENCIES = [
  { code: 'GTQ', label: 'Quetzal guatemalteco (Q)' },
  { code: 'USD', label: 'Dólar estadounidense ($)' },
  { code: 'HNL', label: 'Lempira hondureno (L)' },
  { code: 'NIO', label: 'Cordoba nicaraguense (C$)' },
  { code: 'MXN', label: 'Peso mexicano ($)' },
  { code: 'EUR', label: 'Euro (€)' },
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
// ── Sub-pages ──────────────────────────────────────────────────────────────

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
        {/* Logo row */}
        <Card bordered={false} style={cardStyle} bodyStyle={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <Avatar
                size={96}
                src={logoUrl}
                style={{
                  background: logoUrl ? 'transparent' : '#1faec2',
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
                  background: '#1faec2', cursor: 'pointer',
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
              <div style={{ fontWeight: 600, fontSize: 16, color: '#0a0a0a' }}>
                {profile?.name || 'Tu empresa'}
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Haz clic en el ícono de cámara para cambiar el logo
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                PNG, JPG o SVG — máximo 2 MB, recomendado 200×200 px
              </Text>
            </div>
          </div>
        </Card>

        {/* Main form */}
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>

          {/* Basic info */}
          <SectionCard title="Información básica" icon={<BankOutlined />}>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name="name" label="Nombre comercial" style={{ marginBottom: 16 }} rules={[{ required: true, message: 'Requerido' }]}>
                  <Input placeholder="Mi Empresa S.A." size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="legalName" label="Razón social" style={{ marginBottom: 16 }}>
                  <Input placeholder="MI EMPRESA SOCIEDAD ANÓNIMA" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="taxId" label="NIT / RFC / RUC" style={{ marginBottom: 8 }}>
                  <Input placeholder="1234567-8" size="large" prefix={<FileTextOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="industry" label="Industria" style={{ marginBottom: 16 }}>
                  <Select placeholder="Selecciona una industria" size="large">
                    {['Comercio', 'Manufactura', 'Servicios profesionales', 'Tecnología',
                      'Construcción', 'Salud', 'Educación', 'Agricultura', 'Otro'].map(i =>
                      <Option key={i} value={i}>{i}</Option>
                    )}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  El NIT y la Razón social se usan como emisor en Facturación Electrónica FEL (SAT Guatemala)
                </Text>
              </Col>
            </Row>
          </SectionCard>

          {/* Contact + Address */}
          <SectionCard title="Contacto y dirección" icon={<MailOutlined />}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={14}>
                <Form.Item name="email" label="Correo electrónico" style={{ marginBottom: 16 }} rules={[{ type: 'email', message: 'Email inválido' }]}>
                  <Input placeholder="info@miempresa.com" size="large" prefix={<MailOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item name="phone" label="Teléfono" style={{ marginBottom: 16 }}>
                  <Input placeholder="+502 2345-6789" size="large" prefix={<PhoneOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item name="address" label="Dirección" style={{ marginBottom: 16 }}>
                  <TextArea
                    placeholder="5a Avenida 4-50, Zona 1"
                    rows={1}
                    size="large"
                    style={{ resize: 'none' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="website" label="Sitio web" style={{ marginBottom: 16 }}>
                  <Input placeholder="https://miempresa.com" size="large" prefix={<GlobalOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="city" label="Ciudad" style={{ marginBottom: 0 }}>
                  <Input placeholder="Guat. Ciudad" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="state" label="Depto. / Estado" style={{ marginBottom: 0 }}>
                  <Input placeholder="Guatemala" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item name="zipCode" label="C. Postal" style={{ marginBottom: 0 }}>
                  <Input placeholder="01001" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item name="country" label="País" style={{ marginBottom: 0 }}>
                  <Select placeholder="País" size="large">
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
              style={{ background: '#1faec2', minWidth: 160 }}
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
    const existingSettings = (profile as any)?.settings ?? {}
    setSaving(true)
    try {
      await onSave({
        ...values,
        settings: { ...existingSettings, ...values.settings },
      })
    }
    finally { setSaving(false) }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <Form form={form} layout="vertical">
          <SectionCard title="País fiscal y año fiscal" icon={<GlobalOutlined />}>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name={['settings', 'fiscalCountryCode']} label="País / autoridad fiscal" style={{ marginBottom: 16 }}>
                  <Select size="large" placeholder="Selecciona país fiscal">
                    {Object.entries(COUNTRY_FISCAL_CONFIG).map(([code, meta]) => (
                      <Option key={code} value={code}>{code} - {meta.country}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Moneda local / consolidación" style={{ marginBottom: 16 }}>
                  <Input value={`${fiscalMeta.currency} / USD`} size="large" disabled />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="fiscalYearStart" label="Inicio del año fiscal" style={{ marginBottom: 4 }}>
                  <Select placeholder="Mes de inicio" size="large">
                    {FISCAL_MONTHS.map(m => (
                      <Option key={m.value} value={m.value}>{m.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 0 }}>
                  El año fiscal de este país inicia en el mes seleccionado
                </Text>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="timezone" label="Zona horaria" style={{ marginBottom: 0 }}>
                  <Select placeholder="Selecciona zona horaria" size="large">
                    {TIMEZONES.map(t => (
                      <Option key={t.value} value={t.value}>{t.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          <SectionCard title="Acceso SAT — Agencia Virtual" icon={<LockOutlined />}>
            <div style={{
              background: '#fffbeb', borderRadius: 8, padding: '10px 14px',
              border: '1px solid #fde68a', marginBottom: 14, fontSize: 12,
            }}>
              Estas credenciales se usan para importar DTE desde la Agencia Virtual del SAT.
              Se guardan cifradas y solo se envían a APIFY vía HTTPS para ejecutar la consulta.
            </div>
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name={['settings', 'satNit']} label="NIT — Agencia Virtual SAT" style={{ marginBottom: 0 }}>
                  <Input placeholder="108285685" size="large" autoComplete="off" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name={['settings', 'satAgenciaPassword']} label="Contraseña — Agencia Virtual SAT" style={{ marginBottom: 0 }}>
                  <Input.Password placeholder="••••••••" size="large" autoComplete="new-password" />
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button
              type="primary" size="large" icon={<SaveOutlined />}
              loading={saving} onClick={handleSave}
              style={{ background: '#1faec2', minWidth: 160 }}
            >
              Guardar cambios
            </Button>
          </div>
        </Form>
      </div>
    </Spin>
  )
}

// ── Catálogo de monedas disponibles ───────────────────────────────────────
const ALL_CURRENCIES = [
  { code: 'GTQ', name: 'Quetzal guatemalteco',   symbol: 'Q',   country: 'Guatemala' },
  { code: 'USD', name: 'Dólar estadounidense',    symbol: '$',   country: 'Estados Unidos' },
  { code: 'EUR', name: 'Euro',                    symbol: '€',   country: 'Unión Europea' },
  { code: 'MXN', name: 'Peso mexicano',           symbol: '$',   country: 'México' },
  { code: 'COP', name: 'Peso colombiano',         symbol: '$',   country: 'Colombia' },
  { code: 'HNL', name: 'Lempira hondureño',       symbol: 'L',   country: 'Honduras' },
  { code: 'NIO', name: 'Cordoba nicaraguense',    symbol: 'C$',  country: 'Nicaragua' },
  { code: 'CRC', name: 'Colón costarricense',     symbol: '₡',   country: 'Costa Rica' },
  { code: 'DOP', name: 'Peso dominicano',         symbol: 'RD$', country: 'Rep. Dominicana' },
  { code: 'PEN', name: 'Sol peruano',             symbol: 'S/',  country: 'Perú' },
  { code: 'CLP', name: 'Peso chileno',            symbol: '$',   country: 'Chile' },
  { code: 'GBP', name: 'Libra esterlina',         symbol: '£',   country: 'Reino Unido' },
  { code: 'CAD', name: 'Dólar canadiense',        symbol: 'CA$', country: 'Canadá' },
]


function CurrencySection() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [history,    setHistory]    = useState<CurrencyExchangeRate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [syncing,    setSyncing]    = useState(false)
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

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const data = await getExchangeRateHistory('USD', 30)
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

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

  const handleBanguatSync = async () => {
    setSyncing(true)
    try {
      const result = await syncBanguatRate()
      await fetchCurrencies()
      await fetchHistory()
      const target = result.targetCurrencyCode ? ` ${result.targetCurrencyCode}` : ''
      const officialRate = result.banguatRate ?? result.rate
      message.success(`Banguat actualizado${target}: 1 USD = ${Number(officialRate).toFixed(6)} GTQ`)
    } catch (e: any) {
      const detail = e?.response?.data?.message || e?.response?.data?.error?.message
      message.error(detail || 'No se pudo sincronizar el tipo de cambio con Banguat')
    } finally {
      setSyncing(false)
    }
  }

  const activeCodes  = currencies.map(c => c.code)
  const availableToAdd = ALL_CURRENCIES.filter(c => !activeCodes.includes(c.code))
  const localCurrencyCode = activeCompany?.currencyCode ?? currencies.find(c => c.isBase)?.code ?? 'GTQ'
  const localCurrencyMeta = ALL_CURRENCIES.find(c => c.code === localCurrencyCode)
  const usdAvailable = availableToAdd.some(c => c.code === 'USD')
  const canSyncBanguat = activeCodes.includes('USD') && activeCodes.includes('GTQ')

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Monedas</Title>
          <Text type="secondary">
            Moneda local: {localCurrencyCode}{localCurrencyMeta ? ` (${localCurrencyMeta.name})` : ''}. Consolidacion: USD.
          </Text>
        </div>
        <Space wrap>
          <Button
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={handleBanguatSync}
            disabled={!canSyncBanguat || loading}
          >
            Actualizar Banguat
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setModalOpen(true)
              if (usdAvailable) form.setFieldsValue({ code: 'USD' })
            }}
            style={{ background: '#1faec2' }}
            disabled={availableToAdd.length === 0}
          >
            Agregar moneda
          </Button>
        </Space>
      </div>

      {!canSyncBanguat && (
        <Card bordered={false} style={{ ...cardStyle, marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Para sincronizar desde Banco de Guatemala deben estar creadas las monedas GTQ y USD.
          </Text>
        </Card>
      )}

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
                  <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, padding: '2px 8px' }}>
                    {r.code}
                  </Tag>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Símbolo: {r.symbol}</Text>
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
              title: 'Actualizado',
              width: 150,
              render: (_, r) => r.updatedRateAt
                ? <Text type="secondary" style={{ fontSize: 12 }}>{new Date(r.updatedRateAt).toLocaleDateString('es-GT')}</Text>
                : <Text type="secondary" style={{ fontSize: 12 }}>Sin registro</Text>,
            },
            {
              title: '',
              width: 60,
              render: (_, r) => r.code === localCurrencyCode ? null : (
                <Popconfirm
                  title={`¿Eliminar ${r.name}?`}
                  onConfirm={() => handleRemove(r.id, r.name)}
                  okText="Sí" cancelText="No"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Collapse
        style={{ marginTop: 16, background: '#fff', borderRadius: 10 }}
        items={[{
          key: 'exchange-history',
          label: <Space><SyncOutlined /> Historial USD/GTQ</Space>,
          children: (
            <Table
              size="small"
              rowKey="id"
              loading={loadingHistory}
              dataSource={history}
              pagination={{ pageSize: 8, size: 'small' }}
              columns={[
                {
                  title: 'Fecha',
                  dataIndex: 'effectiveDate',
                  width: 140,
                  render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
                },
                {
                  title: 'Conversion GTQ a USD',
                  dataIndex: 'rate',
                  render: (v: number) => <Text code>1 GTQ = {Number(v).toFixed(8)} USD</Text>,
                },
                {
                  title: 'Oficial Banguat',
                  dataIndex: 'officialRate',
                  render: (v?: number) => v ? <Text>1 USD = {Number(v).toFixed(6)} GTQ</Text> : <Text type="secondary">Manual</Text>,
                },
                {
                  title: 'Fuente',
                  dataIndex: 'source',
                  width: 110,
                  render: (v: string) => <Tag color={v === 'banguat' ? '#1faec2' : 'default'}>{v}</Tag>,
                },
              ]}
            />
          ),
        }]}
      />

      {/* Modal agregar moneda */}
      <Modal
        open={modalOpen}
        title={<Space><DollarOutlined /> Agregar moneda</Space>}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={handleAdd}
        okText="Agregar"
        okButtonProps={{ style: { background: '#1faec2' } }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Moneda" rules={[{ required: true, message: 'Selecciona una moneda' }]}>
            <Select
              showSearch
              placeholder="Busca por nombre o código..."
              size="large"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {availableToAdd.map(c => (
                <Option key={c.code} value={c.code} label={`${c.code} ${c.name}`}>
                  <Space>
                    <Tag style={{ fontVariantNumeric: 'tabular-nums' }}>{c.code}</Tag>
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
            extra="La actualización automática de tasas estará disponible próximamente"
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
  fxGainAccountCode?: string
  fxLossAccountCode?: string
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
      message.error(e?.response?.data?.message || 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const accountOptions = accounts.map(a => ({
    value: a.code,
    label: `${a.code} — ${a.name}`,
  }))

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
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
                placeholder="Ej: 2110 — Anticipos de Clientes"
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
                placeholder="Ej: 2500 — Anticipos a Proveedores"
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
                  Cuenta de activo para anticipos de nómina o préstamos a empleados
                </Text>
              </div>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={defaults.employeeAdvanceAccountCode}
                placeholder="Ej: 1260 — Anticipos a Empleados"
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

        <SectionCard title="Diferencial Cambiario" icon={<SwapOutlined />}>
          <Row gutter={20}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Ganancia diferencial cambiario</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cuenta de ingresos financieros para registrar ganancias por tipo de cambio (series 700)
                </Text>
              </div>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={defaults.fxGainAccountCode}
                placeholder="Ej: 7001 — Ganancia diferencial cambiario"
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={accountOptions}
                onChange={val => setDefaults(prev => ({ ...prev, fxGainAccountCode: val }))}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Valor actual: <Text code>{defaults.fxGainAccountCode || 'No configurado'}</Text>
              </Text>
            </Col>

            <Col xs={24} md={12}>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Pérdida diferencial cambiario</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cuenta de gastos financieros para registrar pérdidas por tipo de cambio (series 710)
                </Text>
              </div>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={defaults.fxLossAccountCode}
                placeholder="Ej: 7101 — Pérdida diferencial cambiario"
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={accountOptions}
                onChange={val => setDefaults(prev => ({ ...prev, fxLossAccountCode: val }))}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Valor actual: <Text code>{defaults.fxLossAccountCode || 'No configurado'}</Text>
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
            style={{ background: '#1faec2', minWidth: 160 }}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </Spin>
  )
}

function PreferencesSection() {
  const { activeCompany } = useCompanyStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preventDuplicates, setPreventDuplicates] = useState(false)

  useEffect(() => {
    if (!activeCompany?.id) { setLoading(false); return }
    companiesApi.getSettings(activeCompany.id)
      .then(s => setPreventDuplicates(!!s?.settingsJson?.preventDuplicateInvoices))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [activeCompany?.id])

  const handleSave = async () => {
    if (!activeCompany?.id) return
    setSaving(true)
    try {
      const current = await companiesApi.getSettings(activeCompany.id).catch(() => ({} as any))
      await companiesApi.updateSettings(activeCompany.id, {
        settingsJson: { ...(current?.settingsJson ?? {}), preventDuplicateInvoices: preventDuplicates },
      })
      message.success('Preferencias guardadas correctamente')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <SectionCard title="Documentos" icon={<FileTextOutlined />}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '8px 0' }}>
            <Switch checked={preventDuplicates} onChange={setPreventDuplicates} />
            <div>
              <Text strong style={{ fontSize: 14 }}>No permitir facturas duplicadas (misma Serie y Número)</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 13 }}>
                Al activar esta opción, el sistema bloqueará el registro de una factura de compra o venta
                si ya existe otra con la misma Serie y Número para el mismo proveedor o cliente.
              </Text>
            </div>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ background: '#1faec2', minWidth: 160 }}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </Spin>
  )
}

function ContabilidadSection() {
  const { activeCompany } = useCompanyStore()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [exigirCC, setExigirCC] = useState(false)
  const [exigirCB, setExigirCB] = useState(false)

  useEffect(() => {
    if (!activeCompany?.id) { setLoading(false); return }
    companiesApi.getSettings(activeCompany.id)
      .then(s => {
        setExigirCC(!!s?.settingsJson?.exigirCentroCosto)
        setExigirCB(!!s?.settingsJson?.exigirCentroBeneficio)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [activeCompany?.id])

  const handleSave = async () => {
    if (!activeCompany?.id) return
    setSaving(true)
    try {
      const current = await companiesApi.getSettings(activeCompany.id).catch(() => ({} as any))
      await companiesApi.updateSettings(activeCompany.id, {
        settingsJson: {
          ...(current?.settingsJson ?? {}),
          exigirCentroCosto:      exigirCC,
          exigirCentroBeneficio:  exigirCB,
        },
      })
      message.success('Configuración contable guardada')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar')
    } finally { setSaving(false) }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <SectionCard title="Dimensiones analíticas" icon={<AuditOutlined />}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
            Estas opciones determinan si el sistema exige dimensiones analíticas al contabilizar transacciones.
            Los toggles por cuenta se configuran en <Text strong>Contabilidad → Catálogo de Cuentas</Text>.
          </Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <Switch checked={exigirCC} onChange={setExigirCC} />
              <div>
                <Text strong style={{ fontSize: 14 }}>Exigir Centro de Costo en cuentas marcadas</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Al activar, toda línea de póliza que use una cuenta con el flag "Exige Centro de Costo"
                  debe tener un Centro de Costo asignado antes de poder contabilizarse.
                  Aplica típicamente a cuentas de Costos (5xxx) y Gastos (6xxx).
                </Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0' }}>
              <Switch checked={exigirCB} onChange={setExigirCB} />
              <div>
                <Text strong style={{ fontSize: 14 }}>Exigir Centro de Beneficio en cuentas marcadas</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Al activar, toda línea de póliza que use una cuenta con el flag "Exige Centro de Beneficio"
                  debe tener un Centro de Beneficio asignado. Habilita los reportes de Estado de Resultados
                  y Balance General segmentados por línea de negocio.
                </Text>
              </div>
            </div>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            type="primary" size="large" icon={<SaveOutlined />}
            loading={saving} onClick={handleSave}
            style={{ background: '#1faec2', minWidth: 160 }}
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
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>{title}</Title>
        <Text type="secondary">{description}</Text>
      </div>
      <Card bordered={false} style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0a', marginBottom: 8 }}>
            En desarrollo
          </div>
          <div style={{ fontSize: 14 }}>Esta sección estará disponible próximamente</div>
        </div>
      </Card>
    </div>
  )
}

// ── Helper components ──────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card
      bordered={false}
      style={{ ...cardStyle, marginBottom: 12 }}
      bodyStyle={{ padding: '14px 20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: '#1faec2', fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 600, color: '#0a0a0a', fontSize: 14 }}>{title}</span>
      </div>
      <Divider style={{ margin: '0 0 14px' }} />
      {children}
    </Card>
  )
}

const cardStyle: React.CSSProperties = {
  borderRadius: 10,
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  background: '#fff',
}

// ── Main page ──────────────────────────────────────────────────────────────

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
      // Backend endpoint may not exist yet — use empty profile
      setProfile({ name: '', email: '', country: 'Guatemala', currency: 'GTQ', fiscalYearStart: '01', timezone: 'America/Guatemala' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: Partial<OrganizationProfile>) => {
    try {
      const updated = await updateOrganizationProfile(values)
      setProfile(prev => ({ ...prev, ...updated }))
      message.success('✓ Cambios guardados correctamente')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message
      const detail = Array.isArray(msg) ? msg.join(', ') : msg
      message.error(detail ? `Error: ${detail}` : 'No se pudo guardar. Intenta de nuevo.')
    }
  }

  const renderContent = () => {
    switch (activeKey) {
      case 'organization':
        return (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Perfil de organización</Title>
              <Text type="secondary">Información general y configuración fiscal de tu empresa</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <OrganizationSection profile={profile} loading={loading} onSave={handleSave} />
              <FiscalSection profile={profile} loading={loading} onSave={handleSave} />
            </div>
          </div>
        )
      case 'currency':
        return <CurrencySection />
      case 'taxes':
        return <ImpuestosPage />
      case 'librosSAT':
        return <LibroSATPage />
      case 'contabilidad':
        return (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Contabilidad</Title>
              <Text type="secondary">Dimensiones analíticas, cuentas por defecto y preferencias del sistema</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div>
                <ContabilidadSection />
                <div style={{ marginTop: 16 }}><PreferencesSection /></div>
              </div>
              <div>
                <AccountDefaultsSection />
              </div>
            </div>
          </div>
        )
      case 'users':
        navigate('/configuracion/usuarios')
        return null
      case 'subscription':
        navigate('/configuracion/suscripcion')
        return null
      case 'integrations':
        return <IntegracionesPage />
      case 'devspace':
        return <EspacioDesarrolloPage />
      default:
        return null
    }
  }

  return (
    <Layout style={{ background: 'transparent', minHeight: 'calc(100vh - 112px)' }}>
      {/* Left nav — Zoho Books style */}
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
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
            Configuración
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => setActiveKey(key)}
          style={{ border: 'none', fontSize: 13 }}
          items={sections.map(s => ({
            ...s,
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


