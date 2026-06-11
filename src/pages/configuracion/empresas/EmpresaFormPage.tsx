import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Card, message, Spin, Typography,
  Radio, Checkbox, Alert, Switch, Tag, Space,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, CopyOutlined, PlusCircleOutlined, AppstoreOutlined } from '@ant-design/icons'
import { companiesApi, type CompanySettings } from '../../../api/companies'
import { fiscalRegimesApi, type FiscalRegime } from '../../../api/fiscalRegimes'
import type { Company } from '../../../store/authStore'

const ALL_MODULES = [
  { key: 'ventas',        label: 'Ventas' },
  { key: 'compras',       label: 'Compras' },
  { key: 'contabilidad',  label: 'Contabilidad' },
  { key: 'bancos',        label: 'Bancos y Tesorería' },
  { key: 'inventario',    label: 'Inventario' },
  { key: 'reportes',      label: 'Reportes' },
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
  const navigate      = useNavigate()
  const { id }        = useParams<{ id: string }>()
  const isEdit        = !!id && id !== 'nueva'
  const [form]        = Form.useForm()
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [regimes, setRegimes]           = useState<FiscalRegime[]>([])
  const [country, setCountry]           = useState<string>('GT')
  const [settings, setSettings]         = useState<CompanySettings | null>(null)
  const [enabledMods, setEnabledMods]   = useState<string[]>([]) // vacío = todos
  const [savingMods, setSavingMods]     = useState(false)

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
        navigate('/configuracion/empresas')
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
        message.success('Empresa actualizada')
      } else {
        await companiesApi.create(values)
        message.success('Empresa creada')
      }
      navigate('/configuracion/empresas')
    } catch {
      message.error('Error al guardar empresa')
    } finally {
      setSaving(false)
    }
  }

  const filteredRegimes = regimes.filter(r => r.countryCode === country)

  return (
    <div style={{ padding: '24px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/configuracion/empresas')} />
        <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Editar Empresa' : 'Nueva Empresa'}</Title>
      </div>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" size="small" onFinish={onFinish}
          initialValues={{ countryCode: 'GT', currencyCode: 'GTQ', language: 'es', timezone: 'America/Guatemala' }}>

          {/* ── Template Engine (solo en modo crear) ────────────────────────── */}
          {!isEdit && (
            <Card
              title={<span><CopyOutlined style={{ marginRight: 6 }} />Método de creación</span>}
              style={{ marginBottom: 16, borderColor: '#1B3A6B' }}
            >
              <Radio.Group
                value={createMode}
                onChange={e => setCreateMode(e.target.value)}
                style={{ marginBottom: createMode === 'clone' ? 16 : 0 }}
              >
                <Radio value="empty">
                  <span><PlusCircleOutlined style={{ marginRight: 6, color: '#52c41a' }} />Empresa vacía</span>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2, marginLeft: 22 }}>
                    Comienza desde cero — catálogo de cuentas, series y configuración vacíos
                  </div>
                </Radio>
                <Radio value="clone" style={{ marginTop: 10 }}>
                  <span><CopyOutlined style={{ marginRight: 6, color: '#1677ff' }} />Copiar empresa existente</span>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2, marginLeft: 22 }}>
                    Hereda configuración de una empresa ya configurada (plan de cuentas, series, sucursales…)
                  </div>
                </Radio>
              </Radio.Group>

              {createMode === 'clone' && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
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

          <Card title="Identificación" style={{ marginBottom: 16 }}>
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

          <Card title="Datos Fiscales" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item label="Número de Identificación Fiscal" name="taxId">
                <Input placeholder="NIT / RFC / RTN..." />
              </Form.Item>
              <Form.Item label="Tipo de ID" name="taxIdLabel">
                <Input placeholder="NIT" />
              </Form.Item>
              <Form.Item label="Régimen Fiscal" name="fiscalRegimeId">
                <Select placeholder="Seleccionar régimen" allowClear>
                  {filteredRegimes.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
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

          <Card title="Regional" style={{ marginBottom: 16 }}>
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

          <Card title="Contacto" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item label="Representante Legal" name="legalRepresentative">
                <Input />
              </Form.Item>
              <Form.Item label="Teléfono" name="phone">
                <Input />
              </Form.Item>
              <Form.Item label="Email" name="email">
                <Input />
              </Form.Item>
            </div>
          </Card>

          {/* ── Módulos habilitados (solo en edición) ───────────────────────── */}
          {isEdit && (
            <Card
              title={<Space><AppstoreOutlined />Módulos habilitados</Space>}
              style={{ marginBottom: 16 }}
              extra={
                enabledMods.length === 0
                  ? <Tag color="green">Todos activos</Tag>
                  : <Tag color="orange">{enabledMods.length} de {ALL_MODULES.length} activos</Tag>
              }
            >
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                Desactiva módulos que esta empresa no utiliza. Se ocultarán del menú lateral para todos sus usuarios.
              </Typography.Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 24px' }}>
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

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate('/configuracion/empresas')}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}
              style={{ background: '#1B3A6B' }}>
              {isEdit ? 'Guardar Cambios' : 'Crear Empresa'}
            </Button>
          </div>
        </Form>
      </Spin>
    </div>
  )
}
