import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Form, Input, Select, message, Spin, Steps, Typography, Tag, Space,
} from 'antd'
import {
  RocketOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { companiesApi } from '../../api/companies'
import { platformTemplatesApi, type PlatformTemplate } from '../../api/platformTemplates'

const { Title, Text } = Typography

const STEP_ITEMS = [
  { title: 'Elige una plantilla' },
  { title: 'Datos de tu empresa' },
]

const COUNTRIES = [
  { code: 'GT', name: 'Guatemala',   currency: 'GTQ' },
  { code: 'HN', name: 'Honduras',    currency: 'HNL' },
  { code: 'NI', name: 'Nicaragua',   currency: 'NIO' },
  { code: 'SV', name: 'El Salvador', currency: 'USD' },
  { code: 'PA', name: 'Panamá',      currency: 'USD' },
  { code: 'CR', name: 'Costa Rica',  currency: 'CRC' },
  { code: 'MX', name: 'México',      currency: 'MXN' },
]

export default function OnboardingRapidoPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<PlatformTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selected, setSelected] = useState<PlatformTemplate | null>(null)
  const [done, setDone] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    platformTemplatesApi.list()
      .then(tpls => setTemplates(tpls.filter(t => t.isActive)))
      .catch(() => message.error('Error al cargar plantillas'))
      .finally(() => setLoadingTemplates(false))
  }, [])

  const handlePickTemplate = (tpl: PlatformTemplate) => {
    setSelected(tpl)
    setStep(1)
  }

  const onCountryChange = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code)
    if (c) form.setFieldsValue({ currencyCode: c.currency })
  }

  const onFinish = async (values: any) => {
    if (!selected) return
    setSaving(true)
    try {
      await companiesApi.cloneFromTemplate(selected.id, { targetCompany: values })
      setDone(true)
    } catch {
      message.error('Error al crear la empresa. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <Title level={3} style={{ margin: '0 0 8px' }}>¡Empresa creada exitosamente!</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 28, fontSize: 15 }}>
          Tu empresa fue configurada con la plantilla <strong>{selected?.displayName}</strong>.
          Solo quedan tus datos específicos.
        </Text>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button type="primary" icon={<ArrowRightOutlined />} size="large" block
            style={{ background: '#1faec2' }}
            onClick={() => navigate('/onboarding/setup')}>
            Ver pasos pendientes
          </Button>
          <Button size="large" block onClick={() => navigate('/dashboard')}>
            Ir al inicio
          </Button>
        </Space>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => step === 0 ? navigate(-1) : setStep(0)} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Configuración rápida</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Elige una plantilla y tu empresa queda lista en 2 pasos
          </Text>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button type="link" size="small" onClick={() => navigate('/onboarding')}
            style={{ color: '#9aa1ab', fontSize: 12 }}>
            Prefiero configurar desde cero →
          </Button>
        </div>
      </div>

      <Steps current={step} size="small" items={STEP_ITEMS} style={{ marginBottom: 32 }} />

      {/* ── Paso 0: selección de plantilla ───────────────────────────────── */}
      {step === 0 && (
        <>
          {loadingTemplates ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
          ) : templates.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text type="secondary">No hay plantillas disponibles aún.</Text>
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={() => navigate('/onboarding')}
                  style={{ background: '#1faec2' }}>
                  Configurar desde cero
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
                marginBottom: 28,
              }}>
                {templates.map(tpl => (
                  <Card
                    key={tpl.id}
                    hoverable
                    style={{
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: selected?.id === tpl.id ? '2px solid #1faec2' : undefined,
                      transition: 'border-color 0.15s',
                    }}
                    onClick={() => handlePickTemplate(tpl)}
                  >
                    <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>
                      {tpl.icon || '🏢'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                      {tpl.displayName}
                    </div>
                    {tpl.description && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {tpl.description}
                      </Text>
                    )}
                    <div style={{ marginTop: 14 }}>
                      <Button type="primary" size="small" icon={<ArrowRightOutlined />}
                        style={{ background: '#1faec2' }}>
                        Usar esta plantilla
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <div style={{
                textAlign: 'center',
                padding: '16px 0',
                borderTop: '1px solid rgba(10,10,10,0.08)',
              }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  ¿Ninguna encaja?{' '}
                </Text>
                <Button type="link" style={{ padding: '0 4px', fontSize: 13 }}
                  onClick={() => navigate('/onboarding')}>
                  Configurar desde cero (9 pasos)
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Paso 1: datos de la empresa ───────────────────────────────────── */}
      {step === 1 && selected && (
        <div style={{ maxWidth: 640 }}>
          {/* Plantilla seleccionada */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: '#f0fafe', border: '1px solid #b2e6f0',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24,
          }}>
            <span style={{ fontSize: 36 }}>{selected.icon || '🏢'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.displayName}</div>
              {selected.description && (
                <Text type="secondary" style={{ fontSize: 12 }}>{selected.description}</Text>
              )}
            </div>
            <Tag color="cyan" icon={<CheckCircleOutlined />}>Seleccionada</Tag>
            <Button size="small" onClick={() => setStep(0)}>Cambiar</Button>
          </div>

          <Form
            form={form}
            layout="vertical"
            size="small"
            onFinish={onFinish}
            initialValues={{ countryCode: 'GT', currencyCode: 'GTQ', taxIdLabel: 'NIT' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Form.Item
                label="Nombre Legal de la Empresa"
                name="legalName"
                rules={[{ required: true, message: 'Requerido' }]}
                style={{ gridColumn: '1 / -1' }}
              >
                <Input placeholder="Mi Empresa S.A." size="middle" />
              </Form.Item>

              <Form.Item label="Nombre Comercial" name="tradeName">
                <Input placeholder="Nombre en documentos (opcional)" />
              </Form.Item>

              <Form.Item label="País" name="countryCode" rules={[{ required: true }]}>
                <Select onChange={onCountryChange}
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
              <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>
                Volver
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<RocketOutlined />}
                size="middle"
                style={{ background: '#1faec2' }}
              >
                Crear mi empresa
              </Button>
            </div>
          </Form>
        </div>
      )}
    </div>
  )
}
