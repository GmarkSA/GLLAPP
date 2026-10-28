import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { markSetupStepDone, SETUP_ROUTES } from '../../hooks/setupProgress'
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Switch, Typography, message, Spin, Tag,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AccountSelect from '../../components/AccountSelect'
import { useCompanyStore } from '../../store/companyStore'
import {
  ACCOUNT_TYPE_CONFIG,
  BANK_NAMES_GT,
  createBankAccount,
  getBankAccount,
  updateBankAccount,
  type BankAccount,
} from '../../api/bancos'
import { formGrid, NAVY, pageHeaderStyle, panelStyle, wideFormGrid } from './bancosShared'

const { Title, Text } = Typography
const { TextArea } = Input

export default function CuentaFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const fromSetup = searchParams.get('from') === 'setup'   // llegó desde la guía de configuración
  const setupCompanyId = useCompanyStore(s => s.activeCompany?.id)
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [glAccountId, setGlAccountId] = useState<string | undefined>()
  const isEdit = Boolean(id)

  /**
   * En quetzales no hay conversión que hacer, así que el tipo de cambio del
   * saldo inicial ni se muestra.
   */
  const moneda        = (Form.useWatch('currency', form) ?? 'GTQ') as string
  const esMonedaLocal = moneda.toUpperCase() === 'GTQ'
  const saldoInicial  = Form.useWatch('openingBalance', form) as number | undefined
  const tasaInicial   = Form.useWatch('openingBalanceExchangeRate', form) as number | undefined

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getBankAccount(id)
      .then((account: BankAccount) => {
        form.setFieldsValue({
          ...account,
          openingBalanceDate: account.openingBalanceDate ? dayjs(account.openingBalanceDate) : undefined,
        })
        setGlAccountId(account.glAccountId)
      })
      .catch(() => {
        message.error('No se pudo cargar la cuenta bancaria')
        navigate(fromSetup ? SETUP_ROUTES.guide : '/bancos')
      })
      .finally(() => setLoading(false))
  }, [form, id, navigate])

  const handleSubmit = async (values: any) => {
    if (!activeCompany?.id) {
      message.warning('Selecciona una empresa antes de guardar')
      return
    }

    setSaving(true)
    try {
      const dto = {
        ...values,
        companyId: activeCompany.id,
        openingBalanceDate: values.openingBalanceDate ? values.openingBalanceDate.format('YYYY-MM-DD') : undefined,
      }
      if (isEdit) {
        await updateBankAccount(id!, dto)
        message.success('Cuenta bancaria actualizada')
        navigate(fromSetup ? SETUP_ROUTES.guide : '/bancos')
      } else {
        const created = await createBankAccount(dto)
        message.success('Cuenta bancaria creada')
        if (fromSetup) {   // paso 9 de la guía completado
          if (setupCompanyId) await markSetupStepDone(setupCompanyId, 'bancos').catch(() => {})
          navigate(SETUP_ROUTES.guide)
          return
        }
        navigate(`/bancos/${created.id}`)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'No se pudo guardar la cuenta'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(fromSetup ? SETUP_ROUTES.guide : '/bancos')} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>{isEdit ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}{fromSetup && <Tag color="#1faec2" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Paso 9 de 9 — Registra tu cuenta bancaria</Tag>}</Title>
            <Text type="secondary">Datos bancarios, moneda y vinculacion contable por empresa</Text>
          </div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        size="small"
        onFinish={handleSubmit}
        initialValues={{
          companyId: activeCompany?.id,
          currency: 'GTQ',
          type: 'checking',
          isPrimary: false,
          feedsEnabled: false,
          openingBalance: 0,
          status: 'active',
        }}
      >
        <Card title="Informacion de la cuenta" size="small" style={{ ...panelStyle, marginBottom: 12 }}>
          <div style={wideFormGrid}>
            <Form.Item name="name" label="Nombre de la cuenta" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Cuenta monetaria BI GTQ" />
            </Form.Item>
            <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
              <Select options={Object.entries(ACCOUNT_TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))} />
            </Form.Item>
            <Form.Item name="bankName" label="Banco" rules={[{ required: true, message: 'Requerido' }]}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="Seleccionar banco"
                options={BANK_NAMES_GT.map(bank => ({ value: bank, label: bank }))}
              />
            </Form.Item>
            <Form.Item name="branchName" label="Sucursal">
              <Input placeholder="Zona 10" />
            </Form.Item>
            <Form.Item name="accountNumber" label="Numero de cuenta" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="0000000000" />
            </Form.Item>
            <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}>
              <Select options={[
                { value: 'GTQ', label: 'GTQ - Quetzal' },
                { value: 'USD', label: 'USD - Dolar' },
              ]} />
            </Form.Item>
          </div>
        </Card>

        <Card title="Saldos y control" size="small" style={{ ...panelStyle, marginBottom: 12 }}>
          <div style={formGrid}>
            <Form.Item name="openingBalance" label="Saldo inicial">
              <InputNumber<number>
                style={{ width: '100%' }}
                precision={2}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number((v || '').replace(/,/g, ''))}
              />
            </Form.Item>
            <Form.Item name="openingBalanceDate" label="Fecha de saldo inicial">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            {/*
              * Solo en cuentas en moneda extranjera. Cada movimiento del banco
              * ya guarda su tasa; sin la del saldo inicial esa parte de la
              * cuenta no se puede valuar a su costo histórico y la
              * revaluación se detiene.
              */}
            {!esMonedaLocal && (
              <Form.Item
                name="openingBalanceExchangeRate"
                label="Tipo de cambio del saldo inicial"
                tooltip={`El tipo de cambio del día en que ese saldo en ${moneda} entró a los libros, `
                  + 'no el de hoy. Con él la revaluación puede calcular el diferencial de esa parte.'}
                rules={[({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!Number(getFieldValue('openingBalance') ?? 0)) return Promise.resolve()
                    if (Number(value) > 0) return Promise.resolve()
                    return Promise.reject(new Error('Requerido si hay saldo inicial'))
                  },
                })]}
              >
                <InputNumber<number>
                  style={{ width: '100%' }}
                  min={0}
                  precision={6}
                  placeholder="7.700000"
                />
              </Form.Item>
            )}
            {!esMonedaLocal && (
              <Form.Item label="Saldo inicial en quetzales">
                <div style={{
                  paddingTop: 4, fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600, color: '#1B3A6B',
                }}>
                  Q {(Number(saldoInicial ?? 0) * Number(tasaInicial ?? 0))
                    .toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </Form.Item>
            )}
            <Form.Item name="bankBalance" label="Saldo segun banco">
              <InputNumber<number>
                style={{ width: '100%' }}
                precision={2}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number((v || '').replace(/,/g, ''))}
              />
            </Form.Item>
            <Form.Item name="isPrimary" label="Cuenta principal" valuePropName="checked">
              <Switch checkedChildren="Si" unCheckedChildren="No" />
            </Form.Item>
          </div>
        </Card>

        <Card title="Vinculacion contable" size="small" style={{ ...panelStyle, marginBottom: 12 }}>
          <Form.Item
            name="glAccountId"
            label="Cuenta contable vinculada"
            extra="Selecciona la cuenta del catálogo que representa esta cuenta bancaria (ej: 110xxx Cajas y Bancos)."
          >
            <AccountSelect
              size="small"
              placeholder="Buscar cuenta contable"
              value={glAccountId}
              onChange={(value) => {
                setGlAccountId(value)
                form.setFieldValue('glAccountId', value)
              }}
            />
          </Form.Item>
        </Card>

        <Card title="Configuracion operativa" size="small" style={{ ...panelStyle, marginBottom: 12 }}>
          <div style={formGrid}>
            <Form.Item name="routingNumber" label="Ruta ACH">
              <Input placeholder="Opcional" />
            </Form.Item>
            <Form.Item name="swiftCode" label="SWIFT/BIC">
              <Input placeholder="Opcional" />
            </Form.Item>
            <Form.Item name="iban" label="IBAN">
              <Input placeholder="Opcional" />
            </Form.Item>
            <Form.Item name="feedsEnabled" label="Feed bancario" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Manual" />
            </Form.Item>
          </div>
        </Card>

        <Card title="Contacto y notas" size="small" style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={formGrid}>
            <Form.Item name="contactPerson" label="Ejecutivo">
              <Input />
            </Form.Item>
            <Form.Item name="contactPhone" label="Telefono">
              <Input />
            </Form.Item>
            <Form.Item name="contactEmail" label="Correo">
              <Input type="email" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notas">
            <TextArea rows={3} />
          </Form.Item>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => navigate(fromSetup ? SETUP_ROUTES.guide : '/bancos')}>Cancelar</Button>
          <Button htmlType="submit" type="primary" icon={<SaveOutlined />} loading={saving} style={{ background: NAVY }}>
            {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
