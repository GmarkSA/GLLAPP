import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Layout, Menu, Form, Input, Button, Select, Upload, Avatar,
  Typography, Card, Row, Col, Divider, message, Spin, Space, Tag,
  Modal, Table, Popconfirm, InputNumber, Switch, Collapse, Alert,
} from 'antd'
import {
  BankOutlined, GlobalOutlined, DollarOutlined,
  MailOutlined, PhoneOutlined, EnvironmentOutlined,
  CameraOutlined, SaveOutlined, TeamOutlined,
  ApiOutlined, AppstoreOutlined, CopyOutlined,
  FileTextOutlined, ClockCircleOutlined, PercentageOutlined,
  PlusOutlined, DeleteOutlined, StarFilled, CodeOutlined, SyncOutlined,
  CreditCardOutlined, LockOutlined, AuditOutlined, SwapOutlined,
  ThunderboltOutlined, RocketOutlined, ArrowLeftOutlined, SettingOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { fiscalRegimesApi, type FiscalRegime } from '../../api/fiscalRegimes'
import { guideHighlight, markSetupStepDone, SETUP_ROUTES } from '../../hooks/setupProgress'
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
  getCurrencies, createCurrency, updateRate, syncBanguatRate, removeCurrency, updateCurrency,
  type Currency,
} from '../../api/monedas'
import { getApiError } from '../../api/axios'
import { getAccounts, type Account } from '../../api/catalogo'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'
import { companiesApi } from '../../api/companies'

const { Sider, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Sidebar sections (Zoho Books pattern) ──────────────────────────────────
const sections = [
  { key: 'setup-guide',       icon: <RocketOutlined />,       label: 'Guía de inicio' },
  { key: 'organization',      icon: <BankOutlined />,         label: 'Perfil de organización' },
  { key: 'modules',           icon: <AppstoreOutlined />,     label: 'Módulos del sistema' },
  { key: 'taxes',             icon: <PercentageOutlined />,   label: 'Impuestos' },
  { key: 'librosSAT',         icon: <FileTextOutlined />,     label: 'Columnas Libros SAT' },
  { key: 'currency',          icon: <DollarOutlined />,       label: 'Monedas' },
  { key: 'contabilidad',      icon: <AuditOutlined />,        label: 'Contabilidad' },
  { key: 'cargas-iniciales',  icon: <ImportOutlined />,       label: 'Cargas Iniciales' },
  { key: 'users',             icon: <TeamOutlined />,         label: 'Usuarios y roles' },
  { key: 'subscription',      icon: <CreditCardOutlined />,   label: 'Suscripción y Facturación' },
  { key: 'integrations',      icon: <ApiOutlined />,          label: 'Integraciones' },
  { key: 'devspace',          icon: <CodeOutlined />,         label: 'Espacio de desarrollo' },
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

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', NI: 'Nicaragua',
  SV: 'El Salvador', PA: 'Panama', CR: 'Costa Rica', MX: 'México',
}

function OrganizationSection({
  profile, loading, onSave, guided, saveRef,
}: {
  profile: OrganizationProfile | null
  loading: boolean
  onSave: (values: Partial<OrganizationProfile>) => Promise<void>
  guided?: boolean
  saveRef?: React.MutableRefObject<null | (() => Promise<void>)>
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const activeCompany  = useCompanyStore(s => s.activeCompany)
  const authUser       = useAuthStore(s => s.user)
  const [fullCompany, setFullCompany] = useState<any>(null)

  const [logoUrl, setLogoUrl] = useState<string | undefined>(profile?.logoUrl)
  const [uploading, setUploading] = useState(false)

  // Cargar datos completos de la empresa (phone, email, legalRepresentative no están en el store)
  useEffect(() => {
    if (activeCompany?.id) {
      companiesApi.getOne(activeCompany.id).then(setFullCompany).catch(() => {})
    }
  }, [activeCompany?.id])

  useEffect(() => {
    if (profile && fullCompany !== null) {
      const co  = fullCompany as any
      const bas = activeCompany as any
      form.setFieldsValue({
        ...profile,
        // tradeName para Nombre comercial, legalName para Razón social
        name:      co?.tradeName  || bas?.tradeName  || co?.legalName  || bas?.legalName  || profile.name,
        legalName: co?.legalName  || bas?.legalName  || profile.legalName,
        taxId:     co?.taxId      || bas?.taxId       || profile.taxId,
        country:   profile.country || COUNTRY_CODE_TO_NAME[co?.countryCode ?? bas?.countryCode] || '',
        // Contacto: email del perfil → email empresa → email auth; teléfono de la empresa
        email:     profile.email || co?.email || (authUser as any)?.email || '',
        phone:     profile.phone || co?.phone || '',
      })
      setLogoUrl(profile.logoUrl)
    }
  }, [profile, form, activeCompany, authUser, fullCompany])

  const handleLogoUpload = async (info: UploadChangeParam) => {
    const file = info.file.originFileObj
    if (!file) return

    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp']
    if (!ALLOWED.includes(file.type)) {
      message.error('Formato no admitido. Usa JPG, PNG, GIF o BMP.')
      return
    }
    if (file.size > 1024 * 1024) {
      message.error('El archivo supera 1 MB. Reduce el tamaño de la imagen.')
      return
    }

    setUploading(true)
    try {
      const url = await uploadLogo(file)
      setLogoUrl(url)
      message.success('Logo actualizado')
    } catch {
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
  if (saveRef) saveRef.current = handleSave

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        {/* Logo row */}
        <Card bordered={false} style={cardStyle} bodyStyle={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative', borderRadius: '50%', ...(guided ? guideHighlight : {}) }}>
              <Avatar
                size={96}
                src={logoUrl}
                style={{
                  background: logoUrl ? 'transparent' : '#1faec2',
                  fontSize: 32, fontWeight: 700,
                  border: '3px solid #e8edf5',
                }}
              >
                {!logoUrl && ((fullCompany as any)?.legalName?.[0] || (activeCompany as any)?.legalName?.[0] || profile?.name?.[0] || 'E')}
              </Avatar>
              <Upload
                accept=".jpg,.jpeg,.png,.gif,.bmp"
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
                {(fullCompany as any)?.legalName || (activeCompany as any)?.legalName || profile?.name || 'Tu empresa'}
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Haz clic en el ícono de cámara para cambiar el logo
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                JPG, PNG, GIF, BMP — máximo 1 MB, recomendado 240×240 px @ 72 ppp
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
                  <TextArea
                    placeholder="MI EMPRESA SOCIEDAD ANÓNIMA"
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    style={{ fontSize: 16, paddingTop: 7, paddingBottom: 7, resize: 'none' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="taxId" label="NIT / RFC / RUC" style={{ marginBottom: 6 }}>
                  <Input placeholder="1234567-8" size="large" prefix={<FileTextOutlined style={{ color: '#bbb' }} />} />
                </Form.Item>
                {activeCompany?.id && (() => {
                  const shortCode = String(parseInt(activeCompany.id.replace(/-/g, '').slice(0, 8), 16))
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#f0f9ff', border: '1px solid #bae0ed',
                      borderRadius: 6, padding: '6px 12px', marginBottom: 8,
                    }}>
                      <span style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>ID organización:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#1faec2', flex: 1 }}>
                        {shortCode}
                      </span>
                      <Button
                        size="small" type="text" icon={<CopyOutlined />}
                        onClick={() => { navigator.clipboard.writeText(shortCode); message.success('ID copiado') }}
                        style={{ color: '#1faec2', padding: '0 4px' }}
                      />
                    </div>
                  )
                })()}
              </Col>
              <Col xs={24} md={12}>
                <div style={guided ? { padding: '6px 10px 0', borderRadius: 10, ...guideHighlight } : undefined}>
                <Form.Item name="industry" label="Industria" style={{ marginBottom: 16 }}>
                  <Select placeholder="Selecciona una industria" size="large">
                    {['Comercio', 'Manufactura', 'Servicios profesionales', 'Tecnología',
                      'Construcción', 'Salud', 'Educación', 'Agricultura', 'Otro'].map(i =>
                      <Option key={i} value={i}>{i}</Option>
                    )}
                  </Select>
                </Form.Item>
                </div>
              </Col>
              <Col xs={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  El NIT y la Razón social se usan como emisor en Facturación Electrónica FEL (SAT Guatemala)
                </Text>
              </Col>
            </Row>
          </SectionCard>

          {/* Contact + Address */}
          <SectionCard title="Contacto y dirección" icon={<MailOutlined />} highlight={guided}>
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
  profile, loading, onSave, guided, saveRef,
}: {
  profile: OrganizationProfile | null
  loading: boolean
  onSave: (values: Partial<OrganizationProfile>) => Promise<void>
  guided?: boolean
  saveRef?: React.MutableRefObject<null | (() => Promise<void>)>
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [regimes, setRegimes] = useState<FiscalRegime[]>([])
  const activeCompany = useCompanyStore(s => s.activeCompany)
  // Empresa completa: el régimen elegido al crearla y su NIT son la fuente de verdad del perfil fiscal
  const [fullCompany, setFullCompany] = useState<any>(null)
  useEffect(() => {
    if (activeCompany?.id) companiesApi.getOne(activeCompany.id).then(setFullCompany).catch(() => {})
  }, [activeCompany?.id])
  const companyCountryCode = countryCodeFromValue((activeCompany as any)?.countryCode ?? (activeCompany as any)?.country ?? profile?.country)
  const watchedCountry = Form.useWatch(['settings', 'fiscalCountryCode'], form)
  const fiscalCountryCode = countryCodeFromValue(watchedCountry ?? companyCountryCode)
  const fiscalMeta = COUNTRY_FISCAL_CONFIG[fiscalCountryCode] ?? COUNTRY_FISCAL_CONFIG.GT
  const watchedRegimeId = Form.useWatch(['settings', 'fiscalRegimeId'], form)
  const selectedRegime = regimes.find(r => r.id === watchedRegimeId)

  useEffect(() => {
    fiscalRegimesApi.getAll(fiscalCountryCode).then(setRegimes).catch(() => {})
  }, [fiscalCountryCode])

  useEffect(() => {
    if (profile) {
      const s = (profile as any).settings ?? {}
      form.setFieldsValue({
        ...profile,
        settings: {
          ...s,
          fiscalCountryCode: s.fiscalCountryCode ?? companyCountryCode,
          // Heredados de la empresa cuando el perfil aún no los tiene
          fiscalRegimeId: s.fiscalRegimeId ?? fullCompany?.fiscalRegimeId ?? undefined,
          satNit:         s.satNit         ?? fullCompany?.taxId         ?? undefined,
        },
      })
    }
  }, [profile, form, companyCountryCode, fullCompany])

  const handleSave = async () => {
    const values = await form.validateFields()
    const existingSettings = (profile as any)?.settings ?? {}
    setSaving(true)
    try {
      await onSave({
        ...values,
        settings: { ...existingSettings, ...values.settings },
      })
      // La empresa es la fuente de verdad del régimen: si se cambió aquí, se actualiza también en la empresa
      const regimeId = values.settings?.fiscalRegimeId
      if (regimeId && fullCompany?.id && regimeId !== fullCompany.fiscalRegimeId) {
        await companiesApi.update(fullCompany.id, { fiscalRegimeId: regimeId } as any).catch(() => {})
        setFullCompany((c: any) => c ? { ...c, fiscalRegimeId: regimeId } : c)
        useCompanyStore.getState().loadCompanies().catch(() => {})
      }
    }
    finally { setSaving(false) }
  }
  if (saveRef) saveRef.current = handleSave

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

              {/* ── Régimen fiscal ─────────────────────────────────────────── */}
              <Col xs={24} style={{ marginTop: 8 }}>
                <Form.Item name={['settings', 'fiscalRegimeId']} label="Régimen fiscal" style={{ marginBottom: 4 }}>
                  <Select
                    size="large"
                    placeholder="Selecciona el régimen fiscal de la empresa"
                    allowClear
                    options={regimes.map(r => ({ value: r.id, label: r.name }))}
                  />
                </Form.Item>
                {fullCompany?.fiscalRegimeId && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Régimen elegido al crear la empresa. Si lo cambias aquí, se actualiza también en la empresa.
                  </Text>
                )}
                {selectedRegime && (
                  <div style={{
                    background: '#f0fafe', borderRadius: 8, padding: '8px 12px',
                    border: '1px solid #bae0ed', fontSize: 12, color: '#374151',
                    display: 'flex', gap: 16, flexWrap: 'wrap',
                  }}>
                    {selectedRegime.description && (
                      <span>{selectedRegime.description}</span>
                    )}
                    <span>
                      <strong>IVA:</strong> {selectedRegime.taxConfig.mainTaxName} {selectedRegime.taxConfig.mainTaxRate}%
                    </span>
                    {selectedRegime.taxConfig.hasFEL && (
                      <Tag color="#1faec2" style={{ fontSize: 11 }}>FEL</Tag>
                    )}
                  </div>
                )}
              </Col>
            </Row>
          </SectionCard>

          <SectionCard title="Acceso SAT" icon={<LockOutlined />} highlight={guided}>
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
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
              Tu contraseña de Agencia Virtual se usa únicamente para importar los DTE emitidos y recibidos desde SAT.
            </Text>
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
  const navigate = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading,    setLoading]    = useState(true)
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
      // El backend responde { error: { message } } — antes se leía data.message y
      // cualquier error (ya existe, permisos, etc.) quedaba en silencio.
      const msg = getApiError(e, '')
      if (msg) message.error(msg)
      // errores de validación del formulario: sin mensaje (AntD ya los marca)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeCurrency(id)
      message.success(`Moneda ${name} desactivada`)
      fetchCurrencies()
    } catch (e: any) {
      message.error(getApiError(e, 'No se pudo desactivar'))
    }
  }

  const handleActivate = async (id: string, name: string) => {
    try {
      await updateCurrency(id, { isActive: true })
      message.success(`Moneda ${name} activada`)
      fetchCurrencies()
    } catch (e: any) {
      message.error(getApiError(e, 'No se pudo activar'))
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

  // Solo las ACTIVAS cuentan: una moneda desactivada debe poder re-agregarse/activarse
  const activeCodes  = currencies.filter(c => c.isActive).map(c => c.code)
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
                  {!r.isActive && <Tag>Inactiva</Tag>}
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
              render: (_, r) => r.code === localCurrencyCode ? null : !r.isActive ? (
                <Button type="link" size="small" onClick={() => handleActivate(r.id, r.name)}>Activar</Button>
              ) : (
                <Popconfirm
                  title={`¿Desactivar ${r.name}?`}
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

      {/* El historial de tipos de cambio vive en Reportes › Tipos de cambio */}
      <Card bordered={false} style={{ ...cardStyle, marginTop: 16 }} bodyStyle={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Desde que activas USD, el tipo de cambio oficial de Banguat se registra todos los días.
        </Text>
        <Button type="link" icon={<SyncOutlined />} onClick={() => navigate('/reportes/tipos-cambio')} style={{ padding: 0 }}>
          Ver historial en Reportes → Tipos de cambio
        </Button>
      </Card>

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

function AccountDefaultsSection({ guided, saveRef }: { guided?: boolean; saveRef?: React.MutableRefObject<null | (() => Promise<boolean>)> } = {}) {
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
      return true
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar la configuración')
      return false
    } finally {
      setSaving(false)
    }
  }

  if (saveRef) saveRef.current = handleSave

  const sugerirCuentas = () => {
    const GLL: Record<keyof AccountDefaults, string> = {
      customerAdvanceAccountCode:  '214001',
      vendorAdvanceAccountCode:    '150001',
      employeeAdvanceAccountCode:  '122001',
      fxGainAccountCode:           '700002',
      fxLossAccountCode:           '710003',
    }
    const byCode = (code: string) => accounts.find(a => a.code === code)?.code
    setDefaults(prev => ({
      ...prev,
      ...Object.fromEntries(
        (Object.entries(GLL) as [keyof AccountDefaults, string][])
          .filter(([, code]) => !!byCode(code))
          .map(([key, code]) => [key, byCode(code)!]),
      ),
    }))
    message.success('Cuentas GLL sugeridas aplicadas. Haga clic en Guardar para confirmar.')
  }

  const accountOptions = accounts.map(a => ({
    value: a.code,
    label: `${a.code} — ${a.name}`,
  }))

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button
            icon={<ThunderboltOutlined />}
            style={{ color: '#1faec2', borderColor: '#1faec2', ...(guided ? guideHighlight : {}) }}
            onClick={sugerirCuentas}
          >
            Usar catálogo sugerido
          </Button>
        </div>
        {guided && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12, textAlign: 'right' }}>
            Pulsa «Usar catálogo sugerido» para vincular las cuentas del catálogo GLL; revisa y luego «Guardar y continuar».
          </Text>
        )}
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

// ── Impuestos Especiales ───────────────────────────────────────────────────────

const IDP_FUEL_TYPES = [
  { key: 'super',    label: 'Gasolina superior',          default: 4.70 },
  { key: 'regular',  label: 'Gasolina regular',           default: 4.60 },
  { key: 'aviacion', label: 'Gasolina de aviación',       default: 4.70 },
  { key: 'diesel',   label: 'Diésel y gas oil',           default: 1.30 },
  { key: 'propano',  label: 'Gas propano (vehicular)',    default: 0.60, note: 'doméstico exento' },
  { key: 'bunker',   label: 'Fuel oil / Bunker C',        default: 0.55 },
  { key: 'kerosina', label: 'Kerosina (DPK)',             default: 0.50 },
  { key: 'other',    label: 'Otros derivados',            default: 0.50 },
]

const DEFAULT_IDP_RATES = Object.fromEntries(IDP_FUEL_TYPES.map(f => [f.key, f.default]))

interface ImpuestosEspecialesConfig {
  idp:              { rates: Record<string, number>; accountCode?: string }
  turismo:          { rate: number; accountCode?: string }
  timbre_prensa:    { rate: number; accountCode?: string }
  timbres_fiscales: { rate: number; accountCode?: string }
}

const DEFAULT_IMPUESTOS_ESPECIALES: ImpuestosEspecialesConfig = {
  idp:              { rates: { ...DEFAULT_IDP_RATES } },
  turismo:          { rate: 10 },
  timbre_prensa:    { rate: 0.5 },
  timbres_fiscales: { rate: 3 },
}

function ImpuestosEspecialesSection() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [cfg, setCfg] = useState<ImpuestosEspecialesConfig>(DEFAULT_IMPUESTOS_ESPECIALES)

  useEffect(() => {
    Promise.all([
      getAccounts({ limit: 1000, isActive: true })
        .then((data: any) => {
          const list: Account[] = Array.isArray(data) ? data : (data?.data ?? [])
          setAccounts(list.filter((a: Account) => !a.isHeader))
        })
        .catch(() => setAccounts([])),
      getOrganizationProfile()
        .then((profile: any) => {
          const saved = profile?.settings?.impuestosEspeciales
          if (saved) {
            setCfg(prev => ({
              ...prev,
              ...saved,
              idp: { ...prev.idp, ...saved.idp, rates: { ...DEFAULT_IDP_RATES, ...(saved.idp?.rates ?? {}) } },
            }))
          }
        })
        .catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  const setIdpRate = (key: string, value: number) =>
    setCfg(prev => ({ ...prev, idp: { ...prev.idp, rates: { ...prev.idp.rates, [key]: value } } }))

  const setIdpAccount = (code: string) =>
    setCfg(prev => ({ ...prev, idp: { ...prev.idp, accountCode: code } }))

  const setOtherTax = (tax: 'turismo' | 'timbre_prensa' | 'timbres_fiscales', field: 'rate' | 'accountCode', value: number | string) =>
    setCfg(prev => ({ ...prev, [tax]: { ...prev[tax], [field]: value } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const profile = await getOrganizationProfile().catch(() => ({} as any))
      const existingSettings = (profile as any)?.settings ?? {}
      await updateOrganizationProfile({
        settings: { ...existingSettings, impuestosEspeciales: cfg },
      } as any)
      message.success('Impuestos especiales guardados')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar')
    } finally {
      setSaving(false) }
  }

  const accountOptions = accounts.map(a => ({ value: a.code, label: `${a.code} — ${a.name}` }))

  const OTHER_TAXES: { key: 'turismo' | 'timbre_prensa' | 'timbres_fiscales'; label: string; desc: string; decreto: string }[] = [
    { key: 'turismo',          label: 'Impuesto de Turismo',       desc: 'Sobre la tarifa de alojamiento en hoteles y hospedajes inscritos ante INGUAT',    decreto: 'Ley Orgánica INGUAT' },
    { key: 'timbre_prensa',    label: 'Timbre de Prensa (IPSP)',   desc: 'Sobre facturas de publicidad y propaganda (excluye IVA en régimen general)',       decreto: 'Dto. 56-90' },
    { key: 'timbres_fiscales', label: 'Timbres Fiscales',          desc: 'Sobre actos y contratos no gravados con IVA (documentos notariales, civiles…)',    decreto: 'Dto. 37-92' },
  ]

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 1100 }}>

        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span style={{ fontSize: 12 }}>
              Si no encuentras las cuentas en la lista, créalas primero en <strong>Contabilidad → Catálogo</strong>.
              Ejemplos: <code>1106 IDP por Acreditar</code>, <code>2310 Impuesto Turismo por Pagar</code>, <code>2315 Timbres por Enterar</code>.
            </span>
          }
        />

        {/* ── Layout horizontal: IDP izquierda | otros impuestos derecha ── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* IDP */}
          <div style={{ flex: '0 0 52%' }}>
            <SectionCard title="IDP — Impuesto de Distribución de Petróleo (Dto. 38-92)" icon={<ThunderboltOutlined />}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 14 }}>
                Tarifa específica por galón americano. Se aplica al registrar facturas de compra con tipo <Text code>Combustible con IDP</Text>.
                Actualizar cuando exista reforma legislativa.
              </Text>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e8e8e8' }}>Producto</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e8e8e8', width: 140 }}>Tarifa Q/galón</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e8e8e8', width: 130 }}>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {IDP_FUEL_TYPES.map((ft, i) => (
                    <tr key={ft.key} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>{ft.label}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                        <InputNumber
                          value={cfg.idp.rates[ft.key] ?? ft.default}
                          min={0} step={0.01} precision={2}
                          prefix="Q"
                          size="small"
                          style={{ width: 110 }}
                          onChange={v => setIdpRate(ft.key, v ?? 0)}
                        />
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                        {ft.note
                          ? <Text type="secondary" style={{ fontSize: 12 }}>{ft.note}</Text>
                          : <Text type="secondary" style={{ fontSize: 12 }}>Dto. 38-92, Art. 2</Text>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 14 }}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Cuenta contable — IDP</Text>
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="Ej: 1106 — IDP por Acreditar"
                  value={cfg.idp.accountCode || undefined}
                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={accountOptions}
                  onChange={setIdpAccount}
                  allowClear
                />
              </div>
            </SectionCard>
          </div>

          {/* Turismo, Timbre de Prensa, Timbres Fiscales — apilados verticalmente */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {OTHER_TAXES.map(tax => (
              <Card
                key={tax.key}
                bordered={false}
                style={{ ...cardStyle }}
                bodyStyle={{ padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#1faec2', fontSize: 14 }}><PercentageOutlined /></span>
                  <span style={{ fontWeight: 600, color: '#0a0a0a', fontSize: 13 }}>{tax.label}</span>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
                  {tax.desc}
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0 12px', alignItems: 'end' }}>
                  <div>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tasa (%)</Text>
                    <InputNumber
                      value={cfg[tax.key].rate}
                      min={0} max={100} step={0.1} precision={2}
                      addonAfter="%"
                      size="small"
                      style={{ width: '100%' }}
                      onChange={v => setOtherTax(tax.key, 'rate', v ?? 0)}
                    />
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cuenta contable</Text>
                    <Select
                      showSearch
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="Selecciona cuenta"
                      value={cfg[tax.key].accountCode || undefined}
                      filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      options={accountOptions}
                      onChange={v => setOtherTax(tax.key, 'accountCode', v)}
                      allowClear
                    />
                  </div>
                </div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8, color: '#9ca3af' }}>
                  {tax.decreto}
                </Text>
              </Card>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
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

// ── Módulos del sistema ────────────────────────────────────────────────────

const ALL_MODULES_CFG = [
  { key: 'ventas',        label: 'Ventas' },
  { key: 'compras',       label: 'Compras' },
  { key: 'contabilidad',  label: 'Contabilidad' },
  { key: 'bancos',        label: 'Bancos y Tesorería' },
  { key: 'inventario',    label: 'Inventario' },
  { key: 'planillas',     label: 'Planillas' },
  { key: 'pos',           label: 'Terminal POS' },
  { key: 'proyectos',     label: 'Proyectos' },
  { key: 'reportes',      label: 'Reportes' },
  { key: 'fel',           label: 'FEL' },
]

function ModulesSection() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const setEnabledModules = useCompanyStore(s => s.setEnabledModules)
  const [enabledMods, setEnabledMods] = useState<string[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (!activeCompany?.id) { setLoading(false); return }
    companiesApi.getSettings(activeCompany.id)
      .then(s => {
        const mods = s?.enabledModules
        setEnabledMods(Array.isArray(mods) && mods.length > 0 ? mods : [])
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [activeCompany?.id])

  const handleToggle = async (modKey: string, checked: boolean) => {
    if (!activeCompany?.id) return
    setSaving(true)
    try {
      const base = enabledMods.length === 0 ? ALL_MODULES_CFG.map(m => m.key) : enabledMods
      const next = checked
        ? (base.includes(modKey) ? base : [...base, modKey])
        : base.filter(k => k !== modKey)
      const updated = next.length === ALL_MODULES_CFG.length ? [] : next
      setEnabledMods(updated)
      await companiesApi.updateSettings(activeCompany.id, { enabledModules: updated } as any)
      // Refrescar el store global para que el menú lateral se actualice al instante,
      // sin necesidad de recargar ni volver a iniciar sesión.
      setEnabledModules(updated)
      message.success('Módulo actualizado')
    } catch {
      message.error('No se pudo actualizar')
    } finally { setSaving(false) }
  }

  const activeCount = enabledMods.length === 0 ? ALL_MODULES_CFG.length : enabledMods.length

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Módulos del sistema</Title>
          <Text type="secondary">Activa o desactiva módulos según los servicios que usa esta empresa</Text>
        </div>

        <Card bordered={false} style={cardStyle} bodyStyle={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Los módulos desactivados se ocultan del menú lateral para todos los usuarios de esta empresa.
            </Text>
            <Tag color={activeCount === ALL_MODULES_CFG.length ? '#2ea172' : '#ff7f00'}>
              {activeCount} de {ALL_MODULES_CFG.length} activos
            </Tag>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
            {ALL_MODULES_CFG.map(mod => {
              const active = enabledMods.length === 0 || enabledMods.includes(mod.key)
              return (
                <div key={mod.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Text style={{ fontSize: 14 }}>{mod.label}</Text>
                  <Switch
                    size="small"
                    checked={active}
                    loading={saving}
                    onChange={checked => handleToggle(mod.key, checked)}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </Spin>
  )
}

// ── Helper components ──────────────────────────────────────────────────────

function SectionCard({ title, icon, children, highlight }: { title: string; icon: React.ReactNode; children: React.ReactNode; highlight?: boolean }) {
  return (
    <Card
      bordered={false}
      style={{ ...cardStyle, marginBottom: 12, ...(highlight ? guideHighlight : {}) }}
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

// ── Hub data ───────────────────────────────────────────────────────────────

const HUB_GROUPS = [
  {
    groupTitle: 'Configuraciones de la organización',
    cards: [
      {
        key: 'org',
        color: '#1faec2', bg: '#e8fafa',
        title: 'Organización',
        desc: 'Datos de tu empresa, régimen fiscal y estructura de sucursales.',
        icon: 'bank',
        links: [
          { label: 'Perfil de organización',  sectionKey: 'organization'                          },
          { label: 'Configuración fiscal',     sectionKey: 'organization'                          },
          { label: 'Empresa',                  sectionKey: '/configuracion/empresas'               },
          { label: 'Sucursales',               sectionKey: '/configuracion/empresas/sucursales'    },
          { label: 'Módulos del sistema',      sectionKey: 'modules'                               },
        ],
      },
      {
        key: 'users',
        color: '#7c5cfc', bg: '#f3f0ff',
        title: 'Usuarios y roles',
        desc: 'Gestioná el acceso de tu equipo, roles y permisos.',
        icon: 'team',
        links: [
          { label: 'Usuarios y permisos', sectionKey: '/configuracion/usuarios' },
        ],
      },
      {
        key: 'install',
        color: '#ff7f00', bg: '#fff7e6',
        title: 'Instalación y config.',
        desc: 'Series, facturación electrónica, bancos y catálogos base.',
        icon: 'setting',
        links: [
          { label: 'Series de documentos',      sectionKey: '/configuracion/empresas/series'                   },
          { label: 'Facturación Electrónica',   sectionKey: '/configuracion/empresas/facturacion-electronica'  },
          { label: 'Perfiles Bancarios',         sectionKey: '/configuracion/empresas/bancos'                   },
          { label: 'Unidades de Medida',         sectionKey: '/configuracion/unidades-medida'                   },
          { label: 'Monedas y tipos de cambio',  sectionKey: 'currency'                                         },
        ],
      },
      {
        key: 'personalizacion',
        color: '#c026d3', bg: '#fdf4ff',
        title: 'Personalización',
        desc: 'Diseño de tus facturas y correos.',
        icon: 'appstore',
        links: [
          { label: 'Plantillas de impresión', sectionKey: '/configuracion/plantillas-impresion' },
          { label: 'Plantillas de correo',     sectionKey: '/configuracion/plantillas-correo'   },
        ],
      },
      {
        key: 'sub',
        color: '#e5484d', bg: '#fff0f0',
        title: 'Suscripción',
        desc: 'Tu plan, facturación y consumo.',
        icon: 'credit',
        links: [
          { label: 'Plan y facturación', sectionKey: '/configuracion/suscripcion' },
        ],
      },
    ],
  },
  {
    groupTitle: 'Contabilidad y cumplimiento',
    cards: [
      {
        key: 'taxes',
        color: '#f59e0b', bg: '#fffbeb',
        title: 'Impuestos',
        desc: 'IVA, retenciones y columnas de los libros SAT.',
        icon: 'percent',
        links: [
          { label: 'Impuestos generales',  sectionKey: 'taxes'     },
          { label: 'Columnas libros SAT',  sectionKey: 'librosSAT' },
        ],
      },
      {
        key: 'accounting',
        color: '#1B3A6B', bg: '#eff3fa',
        title: 'Contabilidad',
        desc: 'Cuentas por defecto, dimensiones e impuestos especiales.',
        icon: 'audit',
        links: [
          { label: 'Cuentas por defecto',    sectionKey: 'contabilidad'                    },
          { label: 'Dimensiones analíticas', sectionKey: 'contabilidad'                    },
          { label: 'Impuestos especiales',   sectionKey: 'contabilidad'                    },
          { label: 'Cargas iniciales',        sectionKey: '/configuracion/cargas-iniciales' },
        ],
      },
      {
        key: 'tech',
        color: '#059669', bg: '#ecfdf5',
        title: 'Integraciones',
        desc: 'Conectá servicios externos y accedé a la API.',
        icon: 'api',
        links: [
          { label: 'Integraciones',         sectionKey: '/configuracion/integraciones' },
          { label: 'Espacio de desarrollo',  sectionKey: 'devspace'                    },
        ],
      },
    ],
  },
]

// ── Main page ──────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeKey, setActiveKey] = useState<string | null>(searchParams.get('tab'))
  const fromSetup = searchParams.get('from') === 'setup'
  // Guía (paso 2): un solo "Guardar y continuar" guarda ambas secciones del perfil
  const orgSaveRef    = useRef<null | (() => Promise<void>)>(null)
  const fiscalSaveRef = useRef<null | (() => Promise<void>)>(null)
  const [guidedSaving, setGuidedSaving] = useState(false)
  const saveOkRef = useRef(true)   // resultado del último guardado (para no avanzar en la guía si falló)
  const defaultsSaveRef = useRef<null | (() => Promise<boolean>)>(null)   // paso 4: Cuentas por defecto
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
      saveOkRef.current = true
      message.success('✓ Cambios guardados correctamente')
      // Desde la guía: en Perfil navega el botón "Guardar y continuar"; en otras pestañas se vuelve a la guía
      if (fromSetup && activeKey !== 'organization') {
        navigate(SETUP_ROUTES.guide)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message
      const detail = Array.isArray(msg) ? msg.join(', ') : msg
      message.error(detail ? `Error: ${detail}` : 'No se pudo guardar. Intenta de nuevo.')
      saveOkRef.current = false
    }
  }

  const handleGuidedContinue = async () => {
    const companyId = useCompanyStore.getState().activeCompany?.id
    setGuidedSaving(true)
    try {
      saveOkRef.current = true
      await orgSaveRef.current?.()
      if (!saveOkRef.current) return
      await fiscalSaveRef.current?.()
      if (!saveOkRef.current) return
      if (companyId) await markSetupStepDone(companyId, 'perfil').catch(() => {})
      navigate(SETUP_ROUTES.catalogo)
    } catch {
      // validación o guardado fallido: el mensaje ya se mostró
    } finally {
      setGuidedSaving(false)
    }
  }

  const handleGuidedContinueDefaults = async () => {
    const companyId = useCompanyStore.getState().activeCompany?.id
    setGuidedSaving(true)
    try {
      const ok = await defaultsSaveRef.current?.()
      if (ok === false) return
      if (companyId) await markSetupStepDone(companyId, 'contabilidad').catch(() => {})
      navigate(SETUP_ROUTES.clases_af)
    } finally {
      setGuidedSaving(false)
    }
  }

  const renderContent = () => {
    switch (activeKey) {
      case 'setup-guide':
        navigate('/onboarding/setup')
        return null
      case 'organization':
        return (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
                Perfil de organización
                {fromSetup && <Tag color="#1faec2" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Paso 2 de 9 — Completa logo, industria, contacto y acceso SAT</Tag>}
              </Title>
              <Text type="secondary">Información general y configuración fiscal de tu empresa</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <OrganizationSection profile={profile} loading={loading} onSave={handleSave} guided={fromSetup} saveRef={orgSaveRef} />
              <FiscalSection profile={profile} loading={loading} onSave={handleSave} guided={fromSetup} saveRef={fiscalSaveRef} />
            </div>
            {fromSetup && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(10,10,10,0.06)' }}>
                <Button onClick={() => navigate(SETUP_ROUTES.guide)}>Volver a la guía</Button>
                <Button type="primary" size="large" loading={guidedSaving} onClick={handleGuidedContinue} style={{ background: '#1faec2', minWidth: 200 }}>
                  Guardar y continuar →
                </Button>
              </div>
            )}
          </div>
        )
      case 'modules':
        return <ModulesSection />
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
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
                Contabilidad
                {fromSetup && <Tag color="#1faec2" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Paso 4 de 9 — Vincula las cuentas por defecto del sistema</Tag>}
              </Title>
              <Text type="secondary">Dimensiones analíticas, cuentas por defecto, impuestos especiales y preferencias del sistema</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div>
                <ContabilidadSection />
                <div style={{ marginTop: 16 }}><PreferencesSection /></div>
              </div>
              <div>
                <AccountDefaultsSection guided={fromSetup} saveRef={defaultsSaveRef} />
              </div>
            </div>
            {fromSetup && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(10,10,10,0.06)' }}>
                <Button onClick={() => navigate(SETUP_ROUTES.guide)}>Volver a la guía</Button>
                <Button type="primary" size="large" loading={guidedSaving} onClick={handleGuidedContinueDefaults} style={{ background: '#1faec2', minWidth: 200 }}>
                  Guardar y continuar →
                </Button>
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 15, color: '#0a0a0a' }}>Impuestos especiales</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                  Tarifas y cuentas contables para IDP, Turismo (INGUAT), Timbre de Prensa y Timbres Fiscales
                </Text>
              </div>
              <ImpuestosEspecialesSection />
            </div>
          </div>
        )
      case 'users':
        navigate('/configuracion/usuarios')
        return null
      case 'subscription':
        navigate('/configuracion/suscripcion')
        return null
      case 'cargas-iniciales':
        navigate('/configuracion/cargas-iniciales')
        return null
      case 'integrations':
        return <IntegracionesPage />
      case 'devspace':
        return <EspacioDesarrolloPage />
      default:
        return null
    }
  }

  const ICON_MAP: Record<string, React.ReactNode> = {
    bank:     <BankOutlined />,
    team:     <TeamOutlined />,
    setting:  <SettingOutlined />,
    credit:   <CreditCardOutlined />,
    percent:  <PercentageOutlined />,
    audit:    <AuditOutlined />,
    api:      <ApiOutlined />,
    appstore: <AppstoreOutlined />,
  }

  const handleHubClick = (sectionKey: string) => {
    if (sectionKey === 'setup-guide') { navigate('/onboarding/setup'); return }
    if (sectionKey.startsWith('/'))   { navigate(sectionKey);          return }
    setActiveKey(sectionKey)
  }

  // ── Hub view ─────────────────────────────────────────────────────────────
  if (activeKey === null) {
    return (
      <div style={{ minHeight: 'calc(100vh - 112px)' }}>
        <div style={{ marginBottom: 8 }}>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Configuración</Title>
          <Text type="secondary">Administra tu empresa, usuarios y preferencias del sistema</Text>
        </div>

        {HUB_GROUPS.map(group => (
          <div key={group.groupTitle} style={{ marginTop: 26 }}>
            {/* Encabezado de sección */}
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9aa1ab', margin: '0 0 12px' }}>
              {group.groupTitle}
            </div>

            {/* Grilla de tarjetas — se ajustan a su contenido (align-items: start) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
              {group.cards.map(card => (
                <div
                  key={card.key}
                  style={{
                    background: '#fff', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 14,
                    padding: '18px 18px 12px', boxShadow: '0 1px 2px rgba(10,10,10,0.03)',
                    transition: 'box-shadow .15s, border-color .15s',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 6px 20px rgba(10,10,10,0.08)'; el.style.borderColor = 'rgba(10,10,10,0.14)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 2px rgba(10,10,10,0.03)'; el.style.borderColor = 'rgba(10,10,10,0.08)' }}
                >
                  {/* Ícono + título */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: card.bg, color: card.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>
                      {ICON_MAP[card.icon]}
                    </div>
                    <Text strong style={{ fontSize: 14, color: '#111827' }}>{card.title}</Text>
                  </div>

                  {/* Descripción */}
                  {card.desc && (
                    <div style={{ fontSize: 12, color: '#9aa1ab', margin: '0 0 12px', lineHeight: 1.45 }}>{card.desc}</div>
                  )}

                  {/* Links */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {card.links.map(link => (
                      <div
                        key={link.label}
                        onClick={() => handleHubClick(link.sectionKey)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: 13, color: '#4b5563', padding: '7px 8px', margin: '0 -8px',
                          borderRadius: 8, cursor: 'pointer', transition: 'background .12s, color .12s',
                        }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = '#f6f8fb'; el.style.color = '#0a0a0a' }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'transparent'; el.style.color = '#4b5563' }}
                      >
                        <span>{link.label}</span>
                        <span style={{ fontSize: 12, color: '#c4c9d2' }}>›</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Section view ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: 'calc(100vh - 112px)' }}>
      <div style={{ marginBottom: 20 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => setActiveKey(null)}
          style={{ padding: '4px 8px', color: '#6b7280', fontSize: 13 }}
        >
          Configuración
        </Button>
      </div>
      {renderContent()}
    </div>
  )
}


