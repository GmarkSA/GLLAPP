import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Card, message, Spin, Typography,
  Radio, Checkbox, Alert,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, CopyOutlined, PlusCircleOutlined } from '@ant-design/icons'
import { companiesApi } from '../../../api/companies'
import { fiscalRegimesApi, type FiscalRegime } from '../../../api/fiscalRegimes'
import type { Company } from '../../../store/authStore'

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
  const [regimes, setRegimes]   = useState<FiscalRegime[]>([])
  const [country, setCountry]   = useState<string>('GT')

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
      companiesApi.getOne(id!).then(company => {
        form.setFieldsValue(company)
        setCountry(company.countryCode)
      }).catch(() => message.error('Error al cargar empresa'))
        .finally(() => setLoading(false))
    } else {
      // Cargar empresas existentes para poder clonar
      companiesApi.getAll().then(setAllCompanies).catch(() => {})
    }
  }, [id])

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
