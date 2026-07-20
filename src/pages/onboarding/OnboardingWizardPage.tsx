import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Steps, Button, Form, Input, Select, Card, Checkbox, message,
  Typography, Space, Tag, Result, Spin,
} from 'antd'
import {
  TeamOutlined, BankOutlined, FileTextOutlined,
  UserOutlined, AppstoreOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { companiesApi } from '../../api/companies'
import { fiscalRegimesApi, type FiscalRegime } from '../../api/fiscalRegimes'
import { getUsers, type TenantUser } from '../../api/usuarios'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'
import { tenantsApi } from '../../api/tenants'
import { seedGLL } from '../../api/catalogo'

const { Title, Text } = Typography

const COUNTRIES = [
  { code: 'GT', name: 'Guatemala',   currency: 'GTQ', flag: 'GT' },
  { code: 'HN', name: 'Honduras',    currency: 'HNL', flag: 'HN' },
  { code: 'NI', name: 'Nicaragua',   currency: 'NIO', flag: 'NI' },
  { code: 'SV', name: 'El Salvador', currency: 'USD', flag: 'SV' },
  { code: 'PA', name: 'Panama',      currency: 'USD', flag: 'PA' },
  { code: 'CR', name: 'Costa Rica',  currency: 'CRC', flag: 'CR' },
  { code: 'MX', name: 'Mexico',      currency: 'MXN', flag: 'MX' },
]
const MODULES: Array<{ value: string; label: string; icon: string; desc: string; locked?: boolean }> = [
  { value: 'contabilidad', label: 'Contabilidad',  icon: '📊', desc: 'Catálogo de cuentas, diarios, reportes financieros', locked: true },
  { value: 'ventas',       label: 'Ventas',        icon: '🛒', desc: 'Clientes, facturas, cotizaciones, cobros' },
  { value: 'compras',      label: 'Compras',       icon: '🏪', desc: 'Proveedores, órdenes de compra, facturas proveedor' },
  { value: 'bancos',       label: 'Tesorería',     icon: '🏦', desc: 'Cuentas bancarias, pagos, conciliación bancaria' },
  { value: 'inventario',   label: 'Inventario',    icon: '📦', desc: 'Artículos, almacenes, movimientos de stock' },
  { value: 'planillas',    label: 'Planillas',     icon: '👥', desc: 'Empleados, corridas de planilla, IGSS, finiquitos' },
  { value: 'fel',          label: 'FEL',           icon: '📄', desc: 'Factura Electrónica en Línea — SAT Guatemala' },
]

export default function OnboardingWizardPage() {
  const navigate         = useNavigate()
  const loadCompanies      = useCompanyStore(s => s.loadCompanies)
  const setActiveCompany   = useCompanyStore(s => s.setActiveCompany)
  const setTenantGroupName = useAuthStore(s => s.setTenantGroupName)

  const [current, setCurrent]     = useState(0)
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState(false)
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null)

  // Paso 1 — Grupo empresarial
  const [step1Form] = Form.useForm()

  // Paso 2 — Primera empresa
  const [step2Form] = Form.useForm()
  const [regimes, setRegimes]     = useState<FiscalRegime[]>([])
  const [loadingRegimes, setLoadingRegimes] = useState(false)

  // Paso 3 — Régimen fiscal (selección)
  const [selectedRegime, setSelectedRegime] = useState<string | null>(null)

  // Paso 4 — Plan de cuentas
  const [selectedCOA, setSelectedCOA]       = useState<string>('gll')

  // Paso 5 — Usuarios
  const [tenantUsers, setTenantUsers]       = useState<TenantUser[]>([])
  const [selectedUsers, setSelectedUsers]   = useState<string[]>([])

  // Paso 6 — Módulos (contabilidad siempre activo)
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'contabilidad', 'ventas', 'compras', 'bancos',
  ])

  const loadStep = useCallback(async (step: number) => {
    if (step === 2) {
      const country = step1Form.getFieldValue('country') ?? 'GT'
      setLoadingRegimes(true)
      fiscalRegimesApi.getAll(country).then(setRegimes).catch(() => {}).finally(() => setLoadingRegimes(false))
    }
    if (step === 4) {
      getUsers().then(u => setTenantUsers(Array.isArray(u) ? u : [])).catch(() => {})
    }
  }, [step1Form])

  const getCountryMeta = (code: string) => COUNTRIES.find(c => c.code === code)

  const getTimezone = (code: string) => {
    const timezones: Record<string, string> = {
      GT: 'America/Guatemala',
      HN: 'America/Tegucigalpa',
      NI: 'America/Managua',
      SV: 'America/El_Salvador',
      PA: 'America/Panama',
      CR: 'America/Costa_Rica',
      MX: 'America/Mexico_City',
    }
    return timezones[code] ?? 'America/Guatemala'
  }

  const next = async () => {
    if (current === 0) {
      await step1Form.validateFields()
    }
    if (current === 1) {
      await step2Form.validateFields()
    }
    const nextStep = current + 1
    setCurrent(nextStep)
    loadStep(nextStep)
  }

  const prev = () => setCurrent(c => c - 1)

  const finish = async () => {
    setSaving(true)
    try {
      const step1 = step1Form.getFieldsValue()
      const step2 = step2Form.getFieldsValue()

      // 1. Crear la empresa
      const companyPayload: any = {
        legalName:      step2.legalName,
        tradeName:      step2.tradeName,
        taxId:          step2.taxId,
        countryCode:    step1.country,
        currencyCode:   getCountryMeta(step1.country)?.currency ?? 'GTQ',
        fiscalRegimeId: selectedRegime ?? undefined,
        timezone:       getTimezone(step1.country),
      }
      const company: any = await companiesApi.create(companyPayload)
      setCreatedCompanyId(company.id)

      // 2. Activar la empresa nueva ANTES de sembrar el catálogo.
      // El interceptor de axios lee activeCompanyId del localStorage;
      // sin este paso, seedGLL() sembraría en la empresa anterior.
      await setActiveCompany(company)

      // 3. Inicializar plan de cuentas (X-Company-ID ya apunta a la empresa nueva)
      if (selectedCOA === 'gll') {
        await seedGLL().catch(() => {})
      }

      // 4. Asignar usuarios seleccionados
      for (const userId of selectedUsers) {
        await companiesApi.assignUser(company.id, { userId }).catch(() => {})
      }

      // 5. Persistir nombre del grupo empresarial en el tenant
      const groupName = step1Form.getFieldValue('groupName')
      if (groupName) {
        const profile = await tenantsApi.getProfile().catch(() => null)
        const currentSettings = profile?.settings ?? {}
        await tenantsApi.updateProfile({ settings: { ...currentSettings, groupName } }).catch(() => {})
        setTenantGroupName(groupName)
      }

      // 6. Recargar lista de empresas (setActiveCompany ya fue llamado)
      await loadCompanies()

      setDone(true)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error durante el onboarding')
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { title: 'Grupo',   icon: <TeamOutlined /> },
    { title: 'Empresa', icon: <BankOutlined /> },
    { title: 'Fiscal',  icon: <FileTextOutlined /> },
    { title: 'Cuentas', icon: <FileTextOutlined /> },
    { title: 'Usuarios',icon: <UserOutlined /> },
    { title: 'Módulos', icon: <AppstoreOutlined /> },
  ]

  if (done) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: '#2ea172' }} />}
          title="¡Empresa configurada exitosamente!"
          subTitle={`Tu empresa está lista. Módulos activos: ${selectedModules.join(', ')}`}
          extra={[
            <Button key="go" type="primary" style={{ background: '#1faec2' }}
              onClick={() => navigate('/dashboard')}>
              Ir al Dashboard
            </Button>,
            <Button key="cfg" onClick={() => navigate('/configuracion/empresas')}>
              Ver empresas
            </Button>,
          ]}
        />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>
          🚀 Onboarding Enterprise
        </Title>
        <Text type="secondary">Configure su primera empresa en ConTaERP</Text>
      </div>

      <Steps current={current} items={steps} style={{ marginBottom: 32 }} size="small" />

      {/* ── Paso 0: Grupo empresarial ───────────────────────────────────────── */}
      {current === 0 && (
        <Card title="Información del Grupo Empresarial">
          <Form form={step1Form} layout="vertical" size="small">
            <Form.Item label="Nombre del grupo" name="groupName" rules={[{ required: true }]}>
              <Input placeholder="Ej: Grupo Castillo, GLL Consulting" />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item label="País principal" name="country" initialValue="GT" rules={[{ required: true }]}>
                <Select
                  options={COUNTRIES.map(c => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
                  onChange={(code) => {
                    step1Form.setFieldValue('currency', getCountryMeta(code)?.currency ?? 'GTQ')
                  }}
                />
              </Form.Item>
              <Form.Item label="Moneda principal" name="currency" initialValue="GTQ">
                <Input />
              </Form.Item>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Paso 1: Primera empresa ─────────────────────────────────────────── */}
      {current === 1 && (
        <Card title="Datos de la Primera Empresa">
          <Form form={step2Form} layout="vertical" size="small">
            <Form.Item label="Nombre Legal" name="legalName" rules={[{ required: true }]}>
              <Input placeholder="Castillo Guatemala S.A." />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item label="Nombre Comercial" name="tradeName">
                <Input />
              </Form.Item>
              <Form.Item label="NIT / Tax ID" name="taxId">
                <Input placeholder="1234567-8" />
              </Form.Item>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Paso 2: Régimen fiscal ──────────────────────────────────────────── */}
      {current === 2 && (
        <Card title="Régimen Fiscal">
          {loadingRegimes ? <Spin /> : (
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
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: selectedRegime === r.id ? '#fafbfc' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    {r.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.description}</div>}
                    <Space size={4} style={{ marginTop: 4 }}>
                      <Tag>{r.taxConfig?.mainTaxName} {r.taxConfig?.mainTaxRate}%</Tag>
                      <Tag>{r.taxConfig?.currencyCode}</Tag>
                      {r.taxConfig?.hasFEL && <Tag color="#1faec2">FEL</Tag>}
                    </Space>
                  </div>
                ))}
              {selectedRegime === null && (
                <div
                  onClick={() => setSelectedRegime('skip')}
                  style={{
                    padding: '12px 16px', border: '2px solid rgba(10,10,10,0.08)',
                    borderRadius: 8, cursor: 'pointer', color: '#6b7280',
                  }}
                >
                  Configurar más adelante
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Paso 3: Plan de cuentas ─────────────────────────────────────────── */}
      {current === 3 && (
        <Card title="Plan de Cuentas">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { value: 'gll', label: 'Plantilla GLL — Guatemala', desc: '68 grupos, plan estándar Guatemala (Decreto 27-92)', flag: '🇬🇹' },
              { value: 'blank', label: 'Plan en blanco', desc: 'Empezar sin cuentas predefinidas', flag: '📋' },
            ].map(opt => (
              <div
                key={opt.value}
                onClick={() => setSelectedCOA(opt.value)}
                style={{
                  padding: '14px 16px',
                  border: `2px solid ${selectedCOA === opt.value ? '#1faec2' : 'rgba(10,10,10,0.08)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  background: selectedCOA === opt.value ? '#fafbfc' : '#fff',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.flag} {opt.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Paso 4: Usuarios ─────────────────────────────────────────────────── */}
      {current === 4 && (
        <Card title="Asignar Usuarios a la Empresa">
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Seleccione qué usuarios del tenant tendrán acceso a esta empresa:
          </Text>
          <Checkbox.Group
            value={selectedUsers}
            onChange={vals => setSelectedUsers(vals as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {tenantUsers.map(u => (
              <Checkbox key={u.id} value={u.id}>
                <Space>
                  <span style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>{u.email}</Text>
                  {u.isSuperAdmin && <Tag color="#e5484d" style={{ fontSize: 11 }}>SuperAdmin</Tag>}
                </Space>
              </Checkbox>
            ))}
            {tenantUsers.length === 0 && (
              <Text type="secondary">No hay otros usuarios en este tenant.</Text>
            )}
          </Checkbox.Group>
        </Card>
      )}

      {/* ── Paso 5: Módulos ──────────────────────────────────────────────────── */}
      {current === 5 && (
        <Card title="Módulos a Activar">
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Seleccione los módulos que utilizará esta empresa. Puede activar más desde Configuración en cualquier momento.
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
                    background: active ? (mod.locked ? '#f0fafe' : '#fafbfc') : '#fff',
                    opacity: 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22 }}>{mod.icon}</span>
                    {mod.locked
                      ? <Tag style={{ fontSize: 10, margin: 0 }}>Requerido</Tag>
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

      {/* ── Navegación ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <div>
          <Button onClick={() => navigate('/configuracion/empresas')} style={{ marginRight: 8 }}>
            Cancelar
          </Button>
          {current > 0 && <Button onClick={prev}>Anterior</Button>}
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
              Finalizar onboarding
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
