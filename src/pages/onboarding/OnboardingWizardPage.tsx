import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Steps, Button, Form, Input, Select, Card, message,
  Typography, Space, Tag, Spin,
} from 'antd'
import {
  BankOutlined, FileTextOutlined,
  AppstoreOutlined, CheckCircleOutlined, ArrowRightOutlined,
  RocketOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import { companiesApi } from '../../api/companies'
import { platformTemplatesApi, type PlatformTemplate } from '../../api/platformTemplates'
import { fiscalRegimesApi, type FiscalRegime } from '../../api/fiscalRegimes'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'
import { tenantsApi } from '../../api/tenants'
import { updateOrganizationProfile } from '../../api/configuracion'
import { seedGLL } from '../../api/catalogo'

// La guía de configuración (paso 3) pide al usuario cargar el catálogo GLL con el botón "Catálogo GLL".
// Se conserva la siembra automática como fallback desactivado.
const AUTO_SEED_GLL_ON_CREATE = false

const { Title, Text } = Typography

const COUNTRIES = [
  { code: 'GT', name: 'Guatemala',   currency: 'GTQ' },
  { code: 'HN', name: 'Honduras',    currency: 'HNL' },
  { code: 'NI', name: 'Nicaragua',   currency: 'NIO' },
  { code: 'SV', name: 'El Salvador', currency: 'USD' },
  { code: 'PA', name: 'Panama',      currency: 'USD' },
  { code: 'CR', name: 'Costa Rica',  currency: 'CRC' },
  { code: 'MX', name: 'Mexico',      currency: 'MXN' },
]

const TIMEZONES: Record<string, string> = {
  GT: 'America/Guatemala',
  HN: 'America/Tegucigalpa',
  NI: 'America/Managua',
  SV: 'America/El_Salvador',
  PA: 'America/Panama',
  CR: 'America/Costa_Rica',
  MX: 'America/Mexico_City',
}

const MODULES: Array<{ value: string; label: string; icon: string; desc: string; locked?: boolean }> = [
  { value: 'contabilidad', label: 'Contabilidad',  icon: '📊', desc: 'Catálogo de cuentas, diarios, reportes financieros', locked: true },
  { value: 'ventas',       label: 'Ventas',        icon: '🛒', desc: 'Clientes, facturas, cotizaciones, cobros' },
  { value: 'compras',      label: 'Compras',       icon: '🏪', desc: 'Proveedores, órdenes de compra, facturas proveedor' },
  { value: 'bancos',       label: 'Tesorería',     icon: '🏦', desc: 'Cuentas bancarias, pagos, conciliación bancaria' },
  { value: 'inventario',   label: 'Inventario',    icon: '📦', desc: 'Artículos, almacenes, movimientos de stock' },
  { value: 'planillas',    label: 'Planillas',     icon: '👥', desc: 'Empleados, corridas de planilla, IGSS, finiquitos' },
  { value: 'pos',          label: 'Terminal POS',  icon: '🖥️', desc: 'Punto de venta, caja rápida para ventas al mostrador' },
  { value: 'proyectos',    label: 'Proyectos',     icon: '📋', desc: 'Gestión de proyectos, presupuestos y avance de obra' },
  { value: 'fel',          label: 'FEL',           icon: '📄', desc: 'Factura Electrónica en Línea — SAT Guatemala' },
]

export default function OnboardingWizardPage() {
  const navigate           = useNavigate()
  const [searchParams]     = useSearchParams()
  const loadCompanies      = useCompanyStore(s => s.loadCompanies)
  const setActiveCompany   = useCompanyStore(s => s.setActiveCompany)
  const setTenantGroupName = useAuthStore(s => s.setTenantGroupName)

  // mode: null = pantalla de elección, 'scratch' = wizard 3 pasos, 'template' = flujo rápido
  const [mode, setMode]   = useState<null | 'scratch' | 'template'>(
    searchParams.get('mode') === 'scratch' ? 'scratch' : null,
  )
  // Estado del flujo rápido (plantillas)
  const [templates,         setTemplates]         = useState<PlatformTemplate[]>([])
  const [loadingTemplates,  setLoadingTemplates]   = useState(true)
  const [selectedTemplate,  setSelectedTemplate]   = useState<PlatformTemplate | null>(null)
  const [templateStep,      setTemplateStep]       = useState(0)  // 0=elegir 1=datos empresa
  const [templateForm]      = Form.useForm()
  const [cloning,           setCloning]            = useState(false)
  const [cloneDone,         setCloneDone]          = useState(false)

  const [current, setCurrent] = useState(0)
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const step0Ref              = useRef<Record<string, any>>({})

  // Carga plantillas — si no hay ninguna, salta directo al wizard de 3 pasos
  useEffect(() => {
    if (mode !== null) return  // ya eligió, no cargar
    platformTemplatesApi.list()
      .then(tpls => {
        const active = tpls.filter(t => t.isActive)
        setTemplates(active)
        if (active.length === 0) setMode('scratch')  // sin plantillas → wizard directo
      })
      .catch(() => setMode('scratch'))  // error de red → wizard directo
      .finally(() => setLoadingTemplates(false))
  }, [mode])

  // Paso 0 — Tu empresa (fusión de grupo + empresa)
  const [form] = Form.useForm()

  // Paso 1 — Régimen fiscal
  const [regimes, setRegimes]           = useState<FiscalRegime[]>([])
  const [loadingRegimes, setLoadingRegimes] = useState(false)
  const [selectedRegime, setSelectedRegime] = useState<string | null>(null)

  // Paso 2 — Módulos
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'contabilidad', 'ventas', 'compras', 'bancos',
  ])

  const getCountryMeta = (code: string) => COUNTRIES.find(c => c.code === code)

  const loadRegimes = useCallback((country: string) => {
    setLoadingRegimes(true)
    setSelectedRegime(null)
    fiscalRegimesApi.getAll(country)
      .then(setRegimes)
      .catch(() => {})
      .finally(() => setLoadingRegimes(false))
  }, [])

  const next = async () => {
    if (current === 0) {
      const values = await form.validateFields()  // retorna los valores validados
      step0Ref.current = values
      loadRegimes(values.country ?? 'GT')
    }
    setCurrent(c => c + 1)
  }

  const prev = () => setCurrent(c => c - 1)

  const finish = async () => {
    const vals = step0Ref.current
    if (!vals.legalName) {
      message.error('Falta el nombre de la empresa. Regresa al paso 1.')
      setCurrent(0)
      return
    }
    setSaving(true)
    try {
      const country = vals.country ?? 'GT'

      // 1. Crear empresa
      const companyPayload: any = {
        legalName:      vals.legalName,
        tradeName:      vals.tradeName || vals.legalName,
        taxId:          vals.taxId,
        countryCode:    country,
        currencyCode:   getCountryMeta(country)?.currency ?? 'GTQ',
        fiscalRegimeId: selectedRegime && selectedRegime !== 'skip' ? selectedRegime : undefined,
        timezone:       TIMEZONES[country] ?? 'America/Guatemala',
      }
      const company: any = await companiesApi.create(companyPayload)

      // 2. Guardar módulos que eligió el usuario (contabilidad siempre activa)
      const allKeys = MODULES.map(m => m.value)
      const enabledModules = selectedModules.length >= allKeys.length ? [] : selectedModules
      await companiesApi.updateSettings(company.id, { enabledModules } as any).catch(() => {})

      // 3. Pre-llenar perfil de organización con datos del wizard (evita duplicar entrada)
      const selectedRegimeObj = regimes.find(r => r.id === selectedRegime)
      await (updateOrganizationProfile as any)({
        name:     vals.tradeName || vals.legalName,
        legalName: vals.legalName,
        taxId:    vals.taxId || undefined,
        country:  getCountryMeta(country)?.name ?? country,   // nombre completo ("Guatemala"), no código ("GT")
        currency: getCountryMeta(country)?.currency ?? 'GTQ',
        timezone: TIMEZONES[country] ?? 'America/Guatemala',
        settings: {
          fiscalCountryCode: country,
          fiscalRegimeCode:  selectedRegimeObj?.code ?? 'RG',  // para detectar plantilla en ImpuestosPage
        },
      }).catch(() => {})

      // 4. Activar empresa antes de sembrar catálogo
      await setActiveCompany(company)

      // 5. Plan de cuentas: el usuario lo carga desde la guía (paso 3). Fallback desactivado.
      if (AUTO_SEED_GLL_ON_CREATE && country === 'GT') {
        await seedGLL().catch(() => {})
      }

      // 6. Guardar nombre del grupo (opcional) en el perfil del tenant
      if (vals.groupName) {
        const profile = await tenantsApi.getProfile().catch(() => null)
        await tenantsApi.updateProfile({
          settings: { ...(profile?.settings ?? {}), groupName: vals.groupName },
        }).catch(() => {})
        setTenantGroupName(vals.groupName)
      }

      // 7. Recargar empresas
      await loadCompanies()

      setDone(true)
    } catch (e: any) {
      console.error('[Onboarding error]', e?.response?.status, e?.response?.data)
      const d = e?.response?.data
      const raw = d?.error?.message ?? d?.message
      const text = Array.isArray(raw) ? raw.join(' · ') : (raw ?? e?.message ?? 'Error durante el onboarding')
      message.error(text, 8)
    } finally {
      setSaving(false)
    }
  }

  const onCountryChangeTemplate = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code)
    if (c) templateForm.setFieldsValue({ currencyCode: c.currency })
  }

  const handleCloneTemplate = async (values: any) => {
    if (!selectedTemplate) return
    setCloning(true)
    try {
      await companiesApi.cloneFromTemplate(selectedTemplate.id, { targetCompany: values })
      await loadCompanies()
      setCloneDone(true)
    } catch {
      message.error('Error al crear la empresa. Inténtalo de nuevo.')
    } finally {
      setCloning(false)
    }
  }

  const steps = [
    { title: 'Tu empresa', icon: <BankOutlined /> },
    { title: 'Régimen',    icon: <FileTextOutlined /> },
    { title: 'Módulos',    icon: <AppstoreOutlined /> },
  ]

  // ── Pantalla final scratch ─────────────────────────────────────────────────
  if (done) {
    navigate('/onboarding/setup', { replace: true })
    return null
  }

  // ── Éxito flujo rápido ─────────────────────────────────────────────────────
  if (cloneDone) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <Title level={3} style={{ margin: '0 0 8px' }}>¡Empresa creada exitosamente!</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 28, fontSize: 15 }}>
          Tu empresa fue configurada con la plantilla <strong>{selectedTemplate?.displayName}</strong>.
          Ya puedes empezar a operar.
        </Text>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button type="primary" size="large" block icon={<ArrowRightOutlined />}
            style={{ background: '#1faec2' }} onClick={() => navigate('/onboarding/setup')}>
            Ver pasos pendientes
          </Button>
          <Button size="large" block onClick={() => navigate('/dashboard')}>
            Ir al inicio
          </Button>
        </Space>
      </div>
    )
  }

  // ── Pantalla de elección (modo null) ────────────────────────────────────────
  if (mode === null) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>Configurar mi empresa</Title>
          <Text type="secondary">¿Cómo quieres empezar?</Text>
        </div>

        {loadingTemplates ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
        ) : (
          <>
            {templates.length > 0 && (
              <>
                <Text style={{ display: 'block', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>
                  Elige una plantilla y tu empresa queda lista en 2 pasos
                </Text>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 16,
                  marginBottom: 32,
                }}>
                  {templates.map(tpl => (
                    <Card key={tpl.id} hoverable
                      style={{ textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onClick={() => { setSelectedTemplate(tpl); setMode('template'); setTemplateStep(1) }}
                    >
                      <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>{tpl.icon || '🏢'}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{tpl.displayName}</div>
                      {tpl.description && (
                        <Text type="secondary" style={{ fontSize: 12 }}>{tpl.description}</Text>
                      )}
                      <div style={{ marginTop: 14 }}>
                        <Button type="primary" size="small" icon={<RocketOutlined />}
                          style={{ background: '#1faec2' }}>
                          Usar esta plantilla
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(10,10,10,0.08)', paddingTop: 24, textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    ¿Ninguna encaja o prefieres control total?{' '}
                  </Text>
                  <Button type="link" style={{ padding: '0 4px', fontSize: 13 }}
                    onClick={() => setMode('scratch')}>
                    Configurar desde cero (3 pasos)
                  </Button>
                </div>
              </>
            )}

          </>
        )}
      </div>
    )
  }

  // ── Flujo rápido (plantilla seleccionada) ──────────────────────────────────
  if (mode === 'template' && selectedTemplate) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Button icon={<ArrowLeftOutlined />}
            onClick={() => { setMode(null); setTemplateStep(0); setSelectedTemplate(null) }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Configuración rápida</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>2 pasos y listo para operar</Text>
          </div>
        </div>

        <Steps current={templateStep} size="small"
          items={[{ title: 'Plantilla elegida' }, { title: 'Datos de tu empresa' }]}
          style={{ marginBottom: 32 }} />

        {/* Plantilla seleccionada — resumen */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#f0fafe', border: '1px solid #b2e6f0',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        }}>
          <span style={{ fontSize: 36 }}>{selectedTemplate.icon || '🏢'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedTemplate.displayName}</div>
            {selectedTemplate.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>{selectedTemplate.description}</Text>
            )}
          </div>
          <Button size="small" onClick={() => { setMode(null); setSelectedTemplate(null) }}>
            Cambiar
          </Button>
        </div>

        <Form form={templateForm} layout="vertical" size="small"
          onFinish={handleCloneTemplate}
          initialValues={{ countryCode: 'GT', currencyCode: 'GTQ', taxIdLabel: 'NIT' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Form.Item label="Nombre Legal de la Empresa" name="legalName"
              rules={[{ required: true, message: 'Requerido' }]}
              style={{ gridColumn: '1 / -1' }}>
              <Input placeholder="Mi Empresa S.A." size="middle" />
            </Form.Item>
            <Form.Item label="Nombre Comercial" name="tradeName">
              <Input placeholder="Opcional" />
            </Form.Item>
            <Form.Item label="País" name="countryCode" rules={[{ required: true }]}>
              <Select onChange={onCountryChangeTemplate}
                options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))} />
            </Form.Item>
            <Form.Item label="NIT / Número Fiscal" name="taxId">
              <Input placeholder="1234567-8" />
            </Form.Item>
            <Form.Item label="Tipo de ID" name="taxIdLabel">
              <Input placeholder="NIT" />
            </Form.Item>
            <Form.Item label="Teléfono" name="phone">
              <Input placeholder="+502 2222-2222" />
            </Form.Item>
            <Form.Item label="Email" name="email">
              <Input placeholder="contacto@miempresa.com" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button icon={<ArrowLeftOutlined />}
              onClick={() => { setMode(null); setSelectedTemplate(null) }}>
              Volver
            </Button>
            <Button type="primary" htmlType="submit" loading={cloning}
              icon={<RocketOutlined />} size="middle" style={{ background: '#1faec2' }}>
              Crear mi empresa
            </Button>
          </div>
        </Form>
      </div>
    )
  }

  // ── Wizard desde cero ───────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>Configurar mi empresa</Title>
        <Text type="secondary">3 pasos y listo para operar</Text>
      </div>

      <Steps current={current} items={steps} style={{ marginBottom: 32 }} size="small" />

      {/* Form siempre montado — display:none mantiene los Form.Items montados entre pasos */}
      <Form form={form} layout="vertical" size="small">
        <div style={{ display: current === 0 ? 'block' : 'none' }}>
          <Card>
            <Form.Item
              label="Nombre de la empresa"
              name="legalName"
              rules={[{ required: true, message: 'Ingresa el nombre legal de la empresa' }]}
            >
              <Input placeholder="Ej: Distribuidora García S.A." size="middle" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item label="NIT" name="taxId">
                <Input placeholder="1234567-8" />
              </Form.Item>
              <Form.Item label="Nombre comercial" name="tradeName">
                <Input placeholder="Opcional" />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item label="País" name="country" initialValue="GT" rules={[{ required: true }]}>
                <Select
                  options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))}
                  onChange={code => form.setFieldValue('currency', getCountryMeta(code)?.currency ?? 'GTQ')}
                />
              </Form.Item>
              <Form.Item label="Moneda" name="currency" initialValue="GTQ">
                <Input readOnly style={{ background: '#fafbfc', color: '#6b7280' }} />
              </Form.Item>
            </div>

            <div style={{ borderTop: '1px solid rgba(10,10,10,0.06)', paddingTop: 16, marginTop: 4 }}>
              <Form.Item
                label={<Text type="secondary" style={{ fontSize: 13 }}>¿Tienes más de una empresa? Nombre del grupo (opcional)</Text>}
                name="groupName"
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="Ej: Grupo García, GLL Consulting" />
              </Form.Item>
            </div>
          </Card>
        </div>
      </Form>

      {/* ── Paso 1: Régimen fiscal ─────────────────────────────────────────── */}
      {current === 1 && (
        <Card title="¿Cuál es tu régimen fiscal?">
          {loadingRegimes ? (
            <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {regimes.length === 0
                ? <Text type="secondary">No hay regímenes disponibles para el país seleccionado.</Text>
                : regimes.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRegime(r.id)}
                    style={{
                      padding: '12px 16px',
                      border: `2px solid ${selectedRegime === r.id ? '#1faec2' : 'rgba(10,10,10,0.08)'}`,
                      borderRadius: 8, cursor: 'pointer',
                      background: selectedRegime === r.id ? '#f0fafe' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    {r.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.description}</div>}
                    <Space size={4} style={{ marginTop: 6 }}>
                      <Tag>{r.taxConfig?.mainTaxName} {r.taxConfig?.mainTaxRate}%</Tag>
                      {r.taxConfig?.hasFEL && <Tag color="#1faec2">FEL</Tag>}
                    </Space>
                  </div>
                ))}
              <div
                onClick={() => setSelectedRegime('skip')}
                style={{
                  padding: '10px 16px',
                  border: `2px solid ${selectedRegime === 'skip' ? 'rgba(10,10,10,0.20)' : 'rgba(10,10,10,0.06)'}`,
                  borderRadius: 8, cursor: 'pointer', color: '#9aa1ab', fontSize: 13,
                }}
              >
                Configurar más adelante
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Paso 2: Módulos ────────────────────────────────────────────────── */}
      {current === 2 && (
        <Card title="¿Qué vas a usar?">
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            Puedes activar o desactivar módulos en cualquier momento desde Configuración.
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {MODULES.map(mod => {
              const active = selectedModules.includes(mod.value) || !!mod.locked
              return (
                <div
                  key={mod.value}
                  onClick={() => {
                    if (mod.locked) return
                    setSelectedModules(prev =>
                      active ? prev.filter(m => m !== mod.value) : [...prev, mod.value],
                    )
                  }}
                  style={{
                    padding: '12px 14px',
                    border: `2px solid ${active ? '#1faec2' : 'rgba(10,10,10,0.08)'}`,
                    borderRadius: 8,
                    cursor: mod.locked ? 'default' : 'pointer',
                    background: active ? (mod.locked ? '#f0fafe' : '#f0fafe') : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20 }}>{mod.icon}</span>
                    {mod.locked
                      ? <Tag style={{ fontSize: 10, margin: 0 }}>Siempre activo</Tag>
                      : active && <Tag color="#1faec2" style={{ fontSize: 10, margin: 0 }}>Activo</Tag>
                    }
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{mod.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: '1.4' }}>{mod.desc}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── Navegación ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <div>
          {current === 0
            ? <Button onClick={() => templates.length > 0 ? setMode(null) : navigate('/configuracion/empresas')}>
                {templates.length > 0 ? 'Volver' : 'Cancelar'}
              </Button>
            : <Button onClick={prev}>Anterior</Button>
          }
        </div>
        <div>
          {current < steps.length - 1 && (
            <Button type="primary" style={{ background: '#1faec2' }} onClick={next}>
              Siguiente
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              style={{ background: '#2ea172', borderColor: '#2ea172' }}
              loading={saving}
              onClick={finish}
            >
              Continuar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
