import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Form, Input, Select, Switch, Button, Row, Col, Divider,
  Typography, Space, InputNumber, DatePicker, message, Spin, Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, BankOutlined,
  InfoCircleOutlined, LinkOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AccountSelect from '../../components/AccountSelect'
import {
  getBankAccount, createBankAccount, updateBankAccount,
  ACCOUNT_TYPE_CONFIG, BANK_NAMES_GT, type BankAccount,
} from '../../api/bancos'

const { Title, Text } = Typography
const { Option }      = Select
const { TextArea }    = Input

export default function BancoFormPage() {
  const navigate      = useNavigate()
  const { id }        = useParams<{ id: string }>()
  const isEdit        = Boolean(id)
  const [form]        = Form.useForm()
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [glAccountId, setGlAccountId] = useState<string | undefined>()

  // ── Load existing account ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    getBankAccount(id!)
      .then((acc: BankAccount) => {
        form.setFieldsValue({
          ...acc,
          openingBalanceDate: acc.openingBalanceDate ? dayjs(acc.openingBalanceDate) : undefined,
        })
        setGlAccountId(acc.glAccountId)
      })
      .catch(() => { message.error('No se pudo cargar la cuenta bancaria'); navigate('/bancos') })
      .finally(() => setLoading(false))
  }, [id, isEdit, form, navigate])

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (values: any) => {
    setSaving(true)
    try {
      const dto = {
        ...values,
        openingBalanceDate: values.openingBalanceDate
          ? values.openingBalanceDate.format('YYYY-MM-DD')
          : undefined,
      }
      if (isEdit) {
        await updateBankAccount(id!, dto)
        message.success('Cuenta bancaria actualizada')
      } else {
        const created = await createBankAccount(dto)
        message.success('Cuenta bancaria creada')
        navigate(`/bancos/${created.id}`)
        return
      }
      navigate('/bancos')
    } catch (err: any) {
      const msg = err?.response?.data?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bancos')} />
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            {isEdit ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
          </Title>
          <Text type="secondary">
            {isEdit ? 'Modifica los datos de la cuenta' : 'Completa los datos para registrar una nueva cuenta'}
          </Text>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ currency: 'GTQ', type: 'checking', isPrimary: false, feedsEnabled: false, openingBalance: 0 }}
      >
        {/* ── Identificación ─────────────────────────────────────────────── */}
        <Card
          title={<Space><BankOutlined style={{ color: '#1faec2' }} /> Información de la cuenta</Space>}
          style={{ borderRadius: 10, marginBottom: 16 }}
          bodyStyle={{ paddingBottom: 4 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nombre de la cuenta" rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder='Ej: "Cuenta Monetaria BanRural Q"' />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="type" label="Tipo de cuenta" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(ACCOUNT_TYPE_CONFIG).map(([k, v]) => (
                    <Option key={k} value={k}>{v.icon} {v.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="bankName" label="Banco">
                <Select showSearch allowClear placeholder="Seleccionar banco" optionFilterProp="children">
                  {BANK_NAMES_GT.map(b => <Option key={b} value={b}>{b}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="branchName" label="Sucursal">
                <Input placeholder="Ej: Zona 10, Ciudad de Guatemala" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="accountNumber" label="Número de cuenta">
                <Input placeholder="0000-0000-0000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="routingNumber" label="Número de ruta (ACH)">
                <Input placeholder="Para transferencias ACH" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="swiftCode" label="Código SWIFT/BIC">
                <Input placeholder="Para transferencias internacionales" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="iban" label="IBAN">
                <Input placeholder="Código IBAN (si aplica)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item
                name="isPrimary"
                label="Cuenta principal"
                valuePropName="checked"
                tooltip="Marca esta cuenta como la principal de la empresa"
              >
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Moneda y saldo ──────────────────────────────────────────────── */}
        <Card
          title="Moneda y saldo inicial"
          style={{ borderRadius: 10, marginBottom: 16 }}
          bodyStyle={{ paddingBottom: 4 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}>
                <Select>
                  <Option value="GTQ">GTQ - Quetzal guatemalteco</Option>
                  <Option value="USD">USD - Dolar estadounidense</Option>
                  <Option value="HNL">HNL - Lempira hondureno</Option>`r`n                  <Option value="NIO">NIO - Cordoba nicaraguense</Option>`r`n                  <Option value="EUR">EUR - Euro</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="openingBalance"
                label="Saldo inicial"
                tooltip="Saldo con el que se registra la cuenta. Puede ser 0 si ya está vinculada al catálogo y el saldo se calculará desde asientos."
              >
                <InputNumber<number>
                  style={{ width: '100%' }}
                  precision={2}
                  min={-999999999}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/,/g, ''))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="openingBalanceDate" label="Fecha de saldo inicial">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Vinculación contable ────────────────────────────────────────── */}
        <Card
          title={
            <Space>
              <LinkOutlined style={{ color: '#6b7280' }} />
              Vinculación al catálogo contable
              <Tooltip title="Vincula esta cuenta bancaria con una cuenta de Balance en el catálogo contable. El saldo se calculará automáticamente desde los asientos contables registrados.">
                <InfoCircleOutlined style={{ color: '#6b7280', fontSize: 14 }} />
              </Tooltip>
            </Space>
          }
          style={{ borderRadius: 10, marginBottom: 16 }}
          bodyStyle={{ paddingBottom: 4 }}
        >
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="glAccountId"
                label="Cuenta del catálogo (Balance)"
                extra="Selecciona la cuenta del catálogo que representa esta cuenta bancaria (ej: 110xxx Cajas y Bancos)."
              >
                <AccountSelect
                  placeholder="Buscar y seleccionar cuenta de balance..."
                  value={glAccountId}
                  onChange={(val) => {
                    setGlAccountId(val)
                    form.setFieldValue('glAccountId', val)
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Contacto del banco ──────────────────────────────────────────── */}
        <Card
          title="Datos de contacto del banco"
          style={{ borderRadius: 10, marginBottom: 16 }}
          bodyStyle={{ paddingBottom: 4 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="contactPerson" label="Ejecutivo de cuenta">
                <Input placeholder="Nombre del ejecutivo" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="contactPhone" label="Teléfono">
                <Input placeholder="+502 0000-0000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="contactEmail" label="Correo electrónico">
                <Input placeholder="ejecutivo@banco.com" type="email" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Notas ───────────────────────────────────────────────────────── */}
        <Card
          title="Notas adicionales"
          style={{ borderRadius: 10, marginBottom: 24 }}
          bodyStyle={{ paddingBottom: 4 }}
        >
          <Form.Item name="notes">
            <TextArea rows={3} placeholder="Información adicional sobre la cuenta..." />
          </Form.Item>
        </Card>

        {/* ── Acciones ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => navigate('/bancos')}>Cancelar</Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            style={{ background: '#1faec2' }}
          >
            {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
