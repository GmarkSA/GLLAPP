import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import AccountSelect from '../../components/AccountSelect'
import { useCompanyStore } from '../../store/companyStore'
import {
  applyBankRules,
  createBankRule,
  deleteBankRule,
  getBankAccounts,
  getBankRules,
  type BankAccount,
  type BankRule,
  type BankRuleCondition,
} from '../../api/bancos'
import { formGrid, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography

const fieldOptions = [
  { value: 'description', label: 'Descripcion' },
  { value: 'reference', label: 'Referencia' },
  { value: 'amount', label: 'Monto' },
  { value: 'type', label: 'Tipo' },
  { value: 'currency', label: 'Moneda' },
]

const operatorOptions = [
  { value: 'contains', label: 'Contiene' },
  { value: 'equals', label: 'Igual a' },
  { value: 'startsWith', label: 'Inicia con' },
  { value: 'endsWith', label: 'Termina con' },
  { value: 'gt', label: 'Mayor que' },
  { value: 'gte', label: 'Mayor o igual' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor o igual' },
]

function RuleModal({ open, accounts, onClose, onSaved }: {
  open: boolean
  accounts: BankAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await createBankRule({
        companyId: activeCompany?.id,
        name: values.name,
        isActive: values.isActive,
        bankAccountId: values.bankAccountId,
        applyTo: values.applyTo,
        matchMode: values.matchMode,
        conditions: values.conditions,
        action: {
          accountId: values.accountId,
          status: values.accountId ? 'categorized' : 'pending',
        },
      })
      message.success('Regla creada')
      form.resetFields()
      onSaved()
      onClose()
    } catch {
      message.error('No se pudo crear la regla')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva regla bancaria"
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleSave}
      okText="Guardar"
      okButtonProps={{ loading: saving, style: { background: NAVY } }}
      width={760}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          isActive: true,
          applyTo: 'all',
          matchMode: 'any',
          conditions: [{ field: 'description', operator: 'contains' }],
        }}
      >
        <div style={formGrid}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej. Comisiones bancarias BI" />
          </Form.Item>
          <Form.Item name="bankAccountId" label="Cuenta bancaria">
            <Select allowClear placeholder="Todas las cuentas" options={accounts.map(a => ({ value: a.id, label: a.name }))} />
          </Form.Item>
          <Form.Item name="applyTo" label="Aplicar a">
            <Select options={[
              { value: 'all', label: 'Todos' },
              { value: 'credit', label: 'Ingresos' },
              { value: 'debit', label: 'Egresos' },
            ]} />
          </Form.Item>
          <Form.Item name="matchMode" label="Criterios">
            <Select options={[
              { value: 'any', label: 'Cualquiera' },
              { value: 'all', label: 'Todos' },
            ]} />
          </Form.Item>
        </div>

        <Form.List name="conditions">
          {(fields, { add, remove }) => (
            <div>
              {fields.map(field => (
                <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr auto', gap: 8, alignItems: 'center' }}>
                  <Form.Item {...field} name={[field.name, 'field']} rules={[{ required: true }]}>
                    <Select options={fieldOptions} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'operator']} rules={[{ required: true }]}>
                    <Select options={operatorOptions} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'value']} rules={[{ required: true }]}>
                    <Input placeholder="Valor a buscar" />
                  </Form.Item>
                  <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                </div>
              ))}
              <Button size="small" icon={<PlusOutlined />} onClick={() => add({ field: 'description', operator: 'contains' })}>
                Agregar criterio
              </Button>
            </div>
          )}
        </Form.List>

        <div style={{ ...formGrid, marginTop: 16 }}>
          <Form.Item name="accountId" label="Cuenta contable a asignar">
            <AccountSelect size="small" filter={{}} placeholder="Selecciona cuenta contable" />
          </Form.Item>
          <Form.Item name="isActive" label="Estado" valuePropName="checked">
            <Switch checkedChildren="Activa" unCheckedChildren="Inactiva" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default function ReglasBancariasPage() {
  const [rules, setRules] = useState<BankRule[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [bankAccountId, setBankAccountId] = useState<string>()

  const load = async () => {
    setLoading(true)
    try {
      const [rulesRes, accountRes] = await Promise.all([
        getBankRules({ limit: 100, bankAccountId }),
        getBankAccounts({ status: 'active' }),
      ])
      setRules(rulesRes.data || [])
      setAccounts(accountRes || [])
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [bankAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = async (ruleId?: string) => {
    setLoading(true)
    try {
      const res = await applyBankRules({ bankAccountId, ruleId })
      message.success(`Revisadas ${res.reviewed}; aplicadas ${res.applied}`)
      await load()
    } catch {
      message.error('No se pudieron aplicar las reglas')
    } finally {
      setLoading(false)
    }
  }

  const accountName = (id?: string) => accounts.find(a => a.id === id)?.name || 'Todas'

  const columns: ColumnsType<BankRule> = [
    { title: 'Regla', dataIndex: 'name', fixed: 'left', width: 220, render: (v, row) => (
      <div>
        <Text strong>{v}</Text>
        <div><Text type="secondary">{accountName(row.bankAccountId)}</Text></div>
      </div>
    ) },
    { title: 'Tipo', dataIndex: 'applyTo', width: 110, render: v => <Tag>{v === 'credit' ? 'Ingresos' : v === 'debit' ? 'Egresos' : 'Todos'}</Tag> },
    { title: 'Criterios', dataIndex: 'conditions', ellipsis: true, render: (conditions: BankRuleCondition[]) => (
      <Space wrap>{(conditions || []).map((c, i) => <Tag key={i}>{c.field} {c.operator} {String(c.value)}</Tag>)}</Space>
    ) },
    { title: 'Cuenta contable', dataIndex: ['action', 'accountCode'], width: 160, render: (_, row) => row.action?.accountCode || row.action?.accountName || <Text type="secondary">Sin asignar</Text> },
    { title: 'Aplicada', dataIndex: 'timesApplied', width: 100, align: 'right' },
    { title: 'Estado', dataIndex: 'isActive', width: 100, render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag> },
    { title: '', key: 'actions', fixed: 'right', width: 120, render: (_, row) => (
      <Space>
        <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleApply(row.id)} />
        <Popconfirm title="Eliminar regla" okText="Eliminar" cancelText="Cancelar" onConfirm={async () => { await deleteBankRule(row.id); await load() }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>Reglas bancarias</Title>
          <Text type="secondary">Automatiza la categorizacion de movimientos importados por descripcion, referencia, monto, tipo o moneda.</Text>
        </div>
        <Space wrap>
          <Select
            allowClear
            placeholder="Todas las cuentas"
            value={bankAccountId}
            onChange={setBankAccountId}
            style={{ width: 240 }}
            options={accounts.map(a => ({ value: a.id, label: a.name }))}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Actualizar</Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => handleApply()}>Aplicar reglas</Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }} onClick={() => setOpen(true)}>Nueva regla</Button>
        </Space>
      </div>

      <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankRule>
          columns={columns}
          dataSource={rules}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 60 }}
          pagination={{ pageSize: 50, showTotal: t => `${t} registros` }}
        />
      </Card>

      <RuleModal open={open} accounts={accounts} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  )
}
