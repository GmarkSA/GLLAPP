import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Steps, Button, Form, Input, Select, Card, message,
  Typography, Space, Tag, Spin,
} from 'antd'
import {
  BankOutlined, FileTextOutlined,
  AppstoreOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { companiesApi } from '../../api/companies'
import { fiscalRegimesApi, type FiscalRegime } from '../../api/fiscalRegimes'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'
import { tenantsApi } from '../../api/tenants'
import { seedGLL } from '../../api/catalogo'

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
  { value: 'fel',          label: 'FEL',           icon: '📄', desc: 'Factura Electrónica en Línea — SAT Guatemala' },
]

export default function OnboardingWizardPage() {
  const navigate           = useNavigate()
  const loadCompanies      = useCompanyStore(s => s.loadCompanies)
  const setActiveCompany   = useCompanyStore(s => s.setActiveCompany)
  const setTenantGroupName = useAuthStore(s => s.setTenantGroupName)

  const [current, setCurrent] = useState(0)
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

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
      await form.validateFields()
      const country = form.getFieldValue('country') ?? 'GT'
      loadRegimes(country)
    }
    setCurrent(c => c + 1)
  }

  const prev = () => setCurrent(c => c - 1)

  const finish = async () => {
    setSaving(true)
    try {
      const vals = form.getFieldsValue()
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

      // 2. Activar empresa antes de sembrar catálogo
      await setActiveCompany(company)

      // 3. Plan de cuentas: GLL para GT, blanco para otros
      if (country === 'GT') {
        await seedGLL().catch(() => {})
      }

      // 4. Guardar nombre del grupo (opcional) en el perfil del tenant
      if (vals.groupName) {
        const profile = await tenantsApi.getProfile().catch(() => null)
        await tenantsApi.updateProfile({
          settings: { ...(profile?.settings ?? {}), groupName: vals.groupName },
        }).catch(() => {})
        setTenantGroupName(vals.groupName)
      }

      // 5. Recargar empresas
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

  const steps = [
    { title: 'Tu empresa', icon: <BankOutlined /> },
    { title: 'Régimen',    icon: <FileTextOutlined /> },
    { title: 'Módulos',    icon: <AppstoreOutlined /> },
  ]

  // ── Pantalla final ──────────────────────────────────────────────────────────
  if (done) {
    const FIRST_OPS = [
      ...(selectedModules.includes('ventas') ? [
        { icon: '👤', label: 'Crear tu primer cliente',  desc: 'Agrega un cliente para emitir facturas',    route: '/ventas/clientes/nuevo' },
        { icon: '🧾', label: 'Crear tu primera factura', desc: 'Emite tu primera factura de venta',          route: '/ventas/facturas/nueva' },
      ] : []),
      ...(selectedModules.includes('compras') ? [
        { icon: '🏪', label: 'Crear tu primer proveedor', desc: 'Registra un proveedor para gestionar compras', route: '/compras/proveedores/nuevo' },
        { icon: '💸', label: 'Registrar tu primer gasto', desc: 'Ingresa una factura de compra o gasto',        route: '/compras/facturas/nueva' },
      ] : []),
    ]

    return (
      <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>¡Listo para operar!</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Tu empresa está configurada. ¿Por dónde empezamos?
          </Text>
        </div>

        {FIRST_OPS.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {FIRST_OPS.map(op => (
              <div
                key={op.route}
                onClick={() => navigate(op.route)}
                style={{
                  padding: '16px 18px', borderRadius: 10, cursor: 'pointer',
                  border: '2px solid rgba(10,10,10,0.08)', background: '#fff',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#1faec2')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(10,10,10,0.08)')}
              >
                <div style={{ fontSize: 26, marginBottom: 6 }}>{op.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0a0a0a', marginBottom: 3 }}>{op.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{op.desc}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(10,10,10,0.06)' }}>
          <Button type="primary" style={{ background: '#1faec2' }} onClick={() => navigate('/dashboard')}>
            Ir al Dashboard
          </Button>
          <Button onClick={() => navigate('/configuracion/empresas')}>
            Ver configuración
          </Button>
        </div>
      </div>
    )
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>Configurar mi empresa</Title>
        <Text type="secondary">3 pasos y listo para operar</Text>
      </div>

      <Steps current={current} items={steps} style={{ marginBottom: 32 }} size="small" />

      {/* Form siempre montado para que Ant Design preserve los valores entre pasos */}
      <Form form={form} layout="vertical" size="small">
        {/* ── Paso 0: Tu empresa ───────────────────────────────────────────── */}
        {current === 0 && (
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
        )}
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
            ? <Button onClick={() => navigate('/configuracion/empresas')}>Cancelar</Button>
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
