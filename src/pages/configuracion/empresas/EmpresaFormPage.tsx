import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Card, message, Spin, Row, Col, Divider, Typography,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { companiesApi } from '../../../api/companies'
import { fiscalRegimesApi, type FiscalRegime } from '../../../api/fiscalRegimes'

const { Title } = Typography
const { Option } = Select

const COUNTRIES = [
  { code: 'GT', name: 'Guatemala',    currency: 'GTQ' },
  { code: 'HN', name: 'Honduras',     currency: 'HNL' },
  { code: 'SV', name: 'El Salvador',  currency: 'USD' },
  { code: 'PA', name: 'Panamá',       currency: 'PAB' },
  { code: 'CR', name: 'Costa Rica',   currency: 'CRC' },
  { code: 'MX', name: 'México',       currency: 'MXN' },
]

const TIMEZONES = [
  'America/Guatemala', 'America/Tegucigalpa', 'America/El_Salvador',
  'America/Panama', 'America/Costa_Rica', 'America/Mexico_City',
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

  useEffect(() => {
    fiscalRegimesApi.getAll().then(setRegimes).catch(() => {})
    if (isEdit) {
      setLoading(true)
      companiesApi.getOne(id!).then(company => {
        form.setFieldsValue(company)
        setCountry(company.countryCode)
      }).catch(() => message.error('Error al cargar empresa'))
        .finally(() => setLoading(false))
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
