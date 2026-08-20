import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Card, message, Spin, Typography,
  Radio, Checkbox, Alert, Switch, Tag, Space,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, CopyOutlined, PlusCircleOutlined, AppstoreOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { companiesApi, type CompanySettings } from '../../../api/companies'
import { fiscalRegimesApi, type FiscalRegime } from '../../../api/fiscalRegimes'
import { satLookupApi, type SatProviderConfig } from '../../../api/satLookup'
import type { Company } from '../../../store/authStore'
import { GT_TEMPLATES } from '../../../data/guatemalaTaxTemplates'

const ALL_MODULES = [
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

const { Title } = Typography
const { Option } = Select

const COUNTRIES = [
  { code: 'GT', name: 'Guatemala',    currency: 'GTQ' },
  { code: 'HN', name: 'Honduras',     currency: 'HNL' },
  { code: 'NI', name: 'Nicaragua',    currency: 'NIO' },
  { code: 'SV', name: 'El Salvador',  currency: 'USD' },
  { code: 'PA', name: 'Panamá',       currency: 'USD' },
  { code: 'CR', name: 'Costa Rica',   currency: 'CRC' },
  { code: 'MX', name: 'México',       currency: 'MXN' },
]

const TIMEZONES = [
  'America/Guatemala', 'America/Tegucigalpa', 'America/El_Salvador',
  'America/Managua', 'America/Panama', 'America/Costa_Rica', 'America/Mexico_City',
]

export default function EmpresaFormPage() {
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const backTo           = searchParams.get('from') === 'setup' ? '/onboarding/setup' : '/configuracion/empresas'
  const { id }           = useParams<{ id: string }>()
  const isEdit        = !!id && id !== 'nueva'
  const [form]        = Form.useForm()
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [regimes, setRegimes]           = useState<FiscalRegime[]>([])
  const [country, setCountry]           = useState<string>('GT')
  const [settings, setSettings]         = useState<CompanySettings | null>(null)
  const [enabledMods, setEnabledMods]   = useState<string[]>([]) // vacío = todos
  const [savingMods, setSavingMods]     = useState(false)
  const [satConfig, setSatConfig]       = useState<SatProviderConfig>({ provider: 'felplex', apiUrl: 'https://app.felplex.com/api', entityId: '', apiKey: '', empresaId: '' })
  const [savingSat, setSavingSat]       = useState(false)
  const [testingSat, setTestingSat]     = useState(false)

  const [showSatForm, setShowSatForm] = useState(false)
  // Mostrar bloque SAT si ya tiene credenciales o el usuario lo abrió manualmente
  const showSatBlock = !!(satConfig.entityId && satConfig.apiKey) || showSatForm
  const [satTestResult, setSatTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Template Engine state (solo en modo crear)
  const [createMode, setCreateMode]         = useState<'empty' | 'clone'>('empty')
  const [sourceCompanyId, setSourceCompanyId] = useState<string | null>(null)
  const [allCompanies, setAllCompanies]     = useState<Company[]>([])
  const [cloneOptions, setCloneOptions]     = useState<string[]>([
    'copyChartOfAccounts', 'copyTaxes', 'copyDocumentSeries', 'copyBranches', 'copySettings',
  ])

  useEffect(() => {
    fiscalRegimesApi.getAll().then(setRegimes).catch(() => {})
    if (isEdit) {
      setLoading(true)
      Promise.all([
        companiesApi.getOne(id!),
        companiesApi.getSettings(id!).catch(() => null),
      ]).then(([company, s]) => {
        form.setFieldsValue(company)
        setCountry(company.countryCode)
        if (s) {
          setSettings(s)
          setEnabledMods(Array.isArray(s.enabledModules) && s.enabledModules.length > 0 ? s.enabledModules : [])
          if (s.settingsJson?.satProviderConfig) {
            setSatConfig({ provider: 'felplex', apiUrl: 'https://app.felplex.com/api', entityId: '', apiKey: '', empresaId: '', ...s.settingsJson.satProviderConfig })
          }
        }
      }).catch(() => message.error('Error al cargar empresa'))
        .finally(() => setLoading(false))
    } else {
      companiesApi.getAll().then(setAllCompanies).catch(() => {})
    }
  }, [id])

  const handleToggleModule = async (modKey: string, enabled: boolean) => {
    let updated: string[]
    if (enabled) {
      // Si activamos todos, mods vacío = todos habilitados
      const next = enabledMods.includes(modKey) ? enabledMods : [...enabledMods, modKey]
      updated = next.length === ALL_MODULES.length ? [] : next
    } else {
      // Al deshabilitar: si estaba vacío (todo hab.), inicializar con todos excepto este
      const base = enabledMods.length === 0 ? ALL_MODULES.map(m => m.key) : enabledMods
      updated = base.filter(k => k !== modKey)
    }
    setEnabledMods(updated)
    setSavingMods(true)
    try {
      await companiesApi.updateSettings(id!, { enabledModules: updated } as any)
      message.success('Módulos actualizados')
    } catch {
      message.error('Error al guardar módulos')
    } finally { setSavingMods(false) }
  }

  const handleSaveSatConfig = async () => {
    setSavingSat(true)
    setSatTestResult(null)
    try {
      const current = await companiesApi.getSettings(id!).catch(() => null)
      const existing = current?.settingsJson ?? {}
      await companiesApi.updateSettings(id!, { settingsJson: { ...existing, satProviderConfig: satConfig } } as any)
      message.success('Configuración SAT guardada')
    } catch { message.error('Error al guardar') }
    finally { setSavingSat(false) }
  }

  const handleTestSat = async () => {
    setTestingSat(true)
    setSatTestResult(null)
    try {
      const res = await satLookupApi.testConnection()
      setSatTestResult(res)
    } catch { setSatTestResult({ ok: false, message: 'Error al conectar' }) }
    finally { setTestingSat(false) }
  }

  const onCountryChange = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code)
    if (c) {
      form.setFieldsValue({ currencyCode: c.currency })
      setCountry(code)
    }
  }

  const onFinish = async (values: any) => {
    if (!isEdit && createMode === 'clone') {
      if (!sourceCompanyId) { message.error('Seleccione la empresa origen'); return }
      setSaving(true)
      try {
        const opts = Object.fromEntries(
          ['copyChartOfAccounts','copyTaxes','copyDocumentSeries','copyBranches','copySettings']
            .map(k => [k, cloneOptions.includes(k)]),
        )
        const result: any = await companiesApi.clone(sourceCompanyId, { targetCompany: values, options: opts })
        message.success(`Empresa clonada correctamente — ${result.copied?.accounts ?? 0} cuentas, ${result.copied?.documentSeries ?? 0} series`)
        navigate(backTo)
      } catch {
        message.error('Error al clonar empresa')
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        await companiesApi.update(id!, values)
        // Persistir código de régimen en settingsJson para lecturas rápidas
        if (values.fiscalRegimeId) {
          const regime = regimes.find(r => r.id === values.fiscalRegimeId)
          if (regime) {
            const existing = settings?.settingsJson ?? {}
            await companiesApi.updateSettings(id!, {
              settingsJson: { ...existing, fiscalRegimeCode: regime.code },
            } as any).catch(() => {})
          }
        }
        message.success('Empresa actualizada')
      } else {
        await companiesApi.create(values)
        message.success('Empresa creada')
      }
      navigate(backTo)
    } catch {
      message.error('Error al guardar empresa')
    } finally {
      setSaving(false)
    }
  }

  const filteredRegimes = regimes.filter(r => r.countryCode === country)

  return (
    <div style={{ padding: '24px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backTo)} />
        <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Editar Empresa' : 'Nueva Empresa'}</Title>
      </div>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" size="small" onFinish={onFinish}
          initialValues={{ countryCode: 'GT', currencyCode: 'GTQ', language: 'es', timezone: 'America/Guatemala' }}>

          {/* ── Template Engine (solo en modo crear) ────────────────────────── */}
          {!isEdit && (
            <Card
              title={<span><CopyOutlined style={{ marginRight: 6 }} />Método de creación</span>}
              style={{ marginBottom: 16, borderColor: '#1faec2' }}
            >
              <Radio.Group
                value={createMode}
                onChange={e => setCreateMode(e.target.value)}
                style={{ marginBottom: createMode === 'clone' ? 16 : 0 }}
              >
                <Radio value="empty">
                  <span><PlusCircleOutlined style={{ marginRight: 6, color: '#2ea172' }} />Empresa vacía</span>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, marginLeft: 22 }}>
                    Comienza desde cero — catálogo de cuentas, series y configuración vacíos
                  </div>
                </Radio>
                <Radio value="clone" style={{ marginTop: 10 }}>
                  <span><CopyOutlined style={{ marginRight: 6, color: '#1faec2' }} />Copiar empresa existente</span>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, marginLeft: 22 }}>
                    Hereda configuración de una empresa ya configurada (plan de cuentas, series, sucursales…)
                  </div>
                </Radio>
              </Radio.Group>

              {createMode === 'clone' && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(10,10,10,0.08)' }}>
                  <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>Empresa origen</div>
                  <Select
                    style={{ width: '100%', marginBottom: 14 }}
                    placeholder="Seleccionar empresa a copiar..."
                    showSearch
                    optionFilterProp="label"
                    value={sourceCompanyId}
                    onChange={setSourceCompanyId}
                    options={allCompanies.map(c => ({
                      value: c.id,
                      label: `${c.legalName} (${c.countryCode} · ${c.currencyCode})`,
                    }))}
                  />
                  <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>Elementos a copiar</div>
                  <Checkbox.Group
                    value={cloneOptions}
                    onChange={vals => setCloneOptions(vals as string[])}
                    style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                  >
                    <Checkbox value="copyChartOfAccounts">Plan de cuentas contable</Checkbox>
                    <Checkbox value="copyTaxes">Impuestos de la empresa</Checkbox>
                    <Checkbox value="copyDocumentSeries">Series documentales (FACT, NC, OC…)</Checkbox>
                    <Checkbox value="copyBranches">Sucursales</Checkbox>
                    <Checkbox value="copySettings">Configuración general</Checkbox>
                  </Checkbox.Group>
                  <Alert
                    style={{ marginTop: 12 }}
                    type="info"
                    showIcon
                    message="No se copian: facturas, pagos, asientos, inventario, movimientos bancarios ni activos registrados"
                  />
                </div>
              )}
            </Card>
          )}

          {/* ── Layout 2 columnas ──────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

            {/* ── Columna izquierda ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="Identificación">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <Form.Item label="Nombre Legal" name="legalName" rules={[{ required: true, message: 'Requerido' }]}>
                    <Input placeholder="Castillo Guatemala S.A." />
                  </Form.Item>
                  <Form.Item label="Nombre Comercial" name="tradeName">
                    <Input placeholder="Nombre que aparece en documentos" />
                  </Form.Item>
                  <Form.Item label="País" name="countryCode" rules={[{ required: true }]}>
                    <Select onChange={onCountryChange}>
                      {COUNTRIES.map(c => <Option key={c.code} value={c.code}>{c.name} ({c.code})</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="Moneda" name="currencyCode" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </div>
              </Card>

              <Card title="Datos Fiscales">
                {/* ID interno de la empresa — útil para integraciones externas */}
                {isEdit && id && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#f8fafc', border: '1px solid rgba(10,10,10,0.08)',
                    borderRadius: 6, padding: '6px 10px', marginBottom: 16, fontSize: 12,
                  }}>
                    <InfoCircleOutlined style={{ color: '#6b7280', flexShrink: 0 }} />
                    <span style={{ color: '#6b7280' }}>ID empresa (para integraciones):</span>
                    <code style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', flex: 1, wordBreak: 'break-all' }}>{id}</code>
                    <Button
                      size="small" type="text" icon={<CopyOutlined />}
                      onClick={() => { navigator.clipboard.writeText(id); message.success('ID copiado') }}
                      style={{ flexShrink: 0 }}
                    />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <Form.Item label="Número de Identificación Fiscal" name="taxId">
                    <Input placeholder="NIT / RFC / RTN..." />
                  </Form.Item>
                  <Form.Item label="Tipo de ID" name="taxIdLabel">
                    <Input placeholder="NIT" />
                  </Form.Item>
                  <Form.Item
                    label="Régimen Fiscal"
                    name="fiscalRegimeId"
                    tooltip="El régimen determina el tipo de IVA, formularios SAT y plantilla de impuestos a usar"
                  >
                    <Select
                      placeholder="Seleccionar régimen"
                      allowClear
                      optionLabelProp="label"
                    >
                      {filteredRegimes.map(r => {
                        // Buscar template GT relacionado por código de régimen
                        const tpl = GT_TEMPLATES.find(t =>
                          r.code?.toUpperCase().includes(t.regimeCode) ||
                          t.regimeCode === r.code?.toUpperCase()
                        )
                        return (
                          <Option key={r.id} value={r.id} label={r.name}>
                            <div style={{ lineHeight: 1.4, padding: '2px 0' }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                {tpl && (
                                  <Tag color="#1faec2" style={{ margin: 0, fontSize: 10 }}>{tpl.satForm}</Tag>
                                )}
                                <Tag style={{ margin: 0, fontSize: 10 }}>
                                  {r.taxConfig?.mainTaxName} {r.taxConfig?.mainTaxRate}%
                                </Tag>
                                {r.taxConfig?.hasFEL && (
                                  <Tag color="green" style={{ margin: 0, fontSize: 10 }}>FEL</Tag>
                                )}
                              </div>
                              {tpl && (
                                <div style={{ fontSize: 10, color: '#9aa1ab', marginTop: 2 }}>
                                  {tpl.description.length > 80 ? tpl.description.slice(0, 80) + '…' : tpl.description}
                                </div>
                              )}
                            </div>
                          </Option>
                        )
                      })}
                    </Select>
                  </Form.Item>
                  <Form.Item label="Inicio de Año Fiscal" name="fiscalYearStart">
                    <Select>
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m =>
                        <Option key={m} value={m}>Mes {m}</Option>
                      )}
                    </Select>
                  </Form.Item>
                </div>
              </Card>

              <Card title="Regional">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <Form.Item label="Zona Horaria" name="timezone">
                    <Select>
                      {TIMEZONES.map(tz => <Option key={tz} value={tz}>{tz}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="Idioma" name="language">
                    <Select>
                      <Option value="es">Español</Option>
                      <Option value="en">English</Option>
                    </Select>
                  </Form.Item>
                </div>
              </Card>
            </div>

            {/* ── Columna derecha ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="Contacto">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <Form.Item label="Representante Legal" name="legalRepresentative">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Teléfono" name="phone">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Email" name="email" style={{ gridColumn: '1 / -1' }}>
                    <Input />
                  </Form.Item>
                </div>
              </Card>

              {/* Módulos habilitados (solo en edición) */}
              {isEdit && (
                <Card
                  title={<Space><AppstoreOutlined />Módulos habilitados</Space>}
                  extra={
                    enabledMods.length === 0
                      ? <Tag color="#2ea172">Todos activos</Tag>
                      : <Tag color="#ff7f00">{enabledMods.length} de {ALL_MODULES.length} activos</Tag>
                  }
                >
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                    Desactiva módulos que esta empresa no utiliza. Se ocultarán del menú lateral para todos sus usuarios.
                  </Typography.Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                    {ALL_MODULES.map(mod => {
                      const active = enabledMods.length === 0 || enabledMods.includes(mod.key)
                      return (
                        <div key={mod.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography.Text style={{ fontSize: 13 }}>{mod.label}</Typography.Text>
                          <Switch
                            size="small"
                            checked={active}
                            loading={savingMods}
                            onChange={checked => handleToggleModule(mod.key, checked)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Proveedor SAT */}
              {isEdit && showSatBlock && (
                <Card
                  title={<Space><ApiOutlined />Proveedor SAT / RTU — Lookup de NIT y CUI</Space>}
                  extra={
                    satConfig.entityId && satConfig.apiKey
                      ? <Tag color="#2ea172">Configurado</Tag>
                      : <Tag color="#ff7f00">Sin configurar</Tag>
                  }
                >
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                    Al ingresar un NIT o CUI en Clientes, Proveedores o POS, el sistema buscará automáticamente los datos en este proveedor y los llenará en el formulario.
                  </Typography.Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <div>
                      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Proveedor</div>
                      <Select
                        size="small" style={{ width: '100%', marginBottom: 12 }}
                        value={satConfig.provider}
                        onChange={v => setSatConfig(p => ({ ...p, provider: v }))}
                        options={[
                          { value: 'felplex', label: 'FelPlex (Guatemala)' },
                          { value: 'infile',  label: 'INFILE (Guatemala)' },
                          { value: 'otro',    label: 'Otro proveedor' },
                        ]}
                      />
                    </div>
                    <div>
                      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>URL Base de la API</div>
                      <Input size="small" style={{ marginBottom: 12 }} value={satConfig.apiUrl}
                        placeholder="https://app.felplex.com/api"
                        onChange={e => setSatConfig(p => ({ ...p, apiUrl: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Entity ID / Organización</div>
                      <Input size="small" style={{ marginBottom: 12 }} value={satConfig.entityId}
                        placeholder="3754"
                        onChange={e => setSatConfig(p => ({ ...p, entityId: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>ID Empresa (header)</div>
                      <Input size="small" style={{ marginBottom: 12 }} value={satConfig.empresaId ?? ''}
                        placeholder="ID interno en Felplex (opcional)"
                        onChange={e => setSatConfig(p => ({ ...p, empresaId: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>API Key (X-Authorization)</div>
                      <Input.Password size="small" style={{ marginBottom: 12 }} value={satConfig.apiKey}
                        placeholder="Token de autorización"
                        onChange={e => setSatConfig(p => ({ ...p, apiKey: e.target.value }))} />
                    </div>
                  </div>
                  {satTestResult && (
                    <Alert
                      type={satTestResult.ok ? 'success' : 'error'}
                      icon={satTestResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      showIcon message={satTestResult.message} style={{ marginBottom: 12 }}
                    />
                  )}
                  <Space>
                    <Button size="small" loading={testingSat} onClick={handleTestSat}>
                      Probar conexión
                    </Button>
                    <Button size="small" type="primary" loading={savingSat} onClick={handleSaveSatConfig}
                      style={{ background: '#1faec2' }} icon={<SaveOutlined />}>
                      Guardar configuración SAT
                    </Button>
                  </Space>
                </Card>
              )}

              {isEdit && !showSatBlock && (
                <div>
                  <Button
                    type="link"
                    icon={<ApiOutlined />}
                    style={{ color: '#9aa1ab', padding: 0, fontSize: 12 }}
                    onClick={() => setShowSatForm(true)}
                  >
                    Configurar lookup automático de NIT/CUI (opcional)
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button onClick={() => navigate(backTo)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}
              style={{ background: '#1faec2' }}>
              {isEdit ? 'Guardar Cambios' : 'Crear Empresa'}
            </Button>
          </div>
        </Form>
      </Spin>
    </div>
  )
}
