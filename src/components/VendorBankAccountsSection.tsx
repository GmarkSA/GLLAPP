import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Switch, Tooltip, Popconfirm,
  Modal, Form, Input, Select, InputNumber, Divider, message,
  Typography,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  BankOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import {
  getVendorBankAccounts, createVendorBankAccount,
  updateVendorBankAccount, deleteVendorBankAccount,
  type VendorBankAccount,
} from '../api/contactos'
import { GUATE_ACH_BANKS, ACCOUNT_TYPES } from '../constants/guateAchBanks'

const { Text } = Typography
const { Option } = Select

interface Props {
  vendorId?: string
}

export default function VendorBankAccountsSection({ vendorId }: Props) {
  const [accounts, setAccounts]   = useState<VendorBankAccount[]>([])
  const [loading, setLoading]     = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<VendorBankAccount | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form]                    = Form.useForm()

  const reload = async () => {
    if (!vendorId) return
    setLoading(true)
    try {
      const data = await getVendorBankAccounts(vendorId)
      setAccounts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [vendorId])

  const openNew = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ currency: 'GTQ', isAchEnabled: false, isDefault: false })
    setModalOpen(true)
  }

  const openEdit = (acc: VendorBankAccount) => {
    setEditing(acc)
    form.setFieldsValue(acc)
    setModalOpen(true)
  }

  const handleBankSelect = (bankCodeGTQ: string) => {
    const bank = GUATE_ACH_BANKS.find(b => b.bankCodeGTQ === bankCodeGTQ)
    if (bank) {
      form.setFieldsValue({
        bankName:      bank.name,
        bankShortName: bank.shortName,
        bankCodeGTQ:   bank.bankCodeGTQ,
        bankCodeUSD:   bank.bankCodeUSD,
      })
    }
  }

  const handleSave = async () => {
    let values: any
    try { values = await form.validateFields() } catch { return }

    if (!vendorId) {
      message.warning('Guarda el proveedor primero antes de agregar cuentas bancarias.')
      return
    }

    setSaving(true)
    try {
      if (editing?.id) {
        await updateVendorBankAccount(vendorId, editing.id, values)
        message.success('Cuenta actualizada')
      } else {
        await createVendorBankAccount(vendorId, values)
        message.success('Cuenta agregada')
      }
      setModalOpen(false)
      await reload()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al guardar'
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (acc: VendorBankAccount) => {
    if (!vendorId || !acc.id) return
    try {
      await deleteVendorBankAccount(vendorId, acc.id)
      message.success('Cuenta eliminada')
      await reload()
    } catch {
      message.error('Error al eliminar')
    }
  }

  const columns = [
    {
      title: 'Banco',
      key: 'bank',
      render: (_: any, r: VendorBankAccount) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.bankName ?? '—'}</Text>
          {r.alias && <Text type="secondary" style={{ fontSize: 11 }}>{r.alias}</Text>}
        </Space>
      ),
    },
    {
      title: 'Cuenta',
      key: 'account',
      render: (_: any, r: VendorBankAccount) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontFamily: 'monospace' }}>{r.accountNumber ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {ACCOUNT_TYPES.find(t => t.value === r.accountType)?.label ?? r.accountType ?? ''}
            {r.currency ? ` · ${r.currency}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Código ACH',
      key: 'codes',
      render: (_: any, r: VendorBankAccount) => (
        <Space direction="vertical" size={0}>
          {r.bankCodeGTQ && <Tag color="blue">GTQ: {r.bankCodeGTQ}</Tag>}
          {r.bankCodeUSD && <Tag color="green">USD: {r.bankCodeUSD}</Tag>}
        </Space>
      ),
    },
    {
      title: 'ACH',
      dataIndex: 'isAchEnabled',
      width: 60,
      render: (v: boolean) => v
        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      width: 70,
      render: (v: boolean) => v ? <Tag color="gold">Principal</Tag> : null,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: VendorBankAccount) => (
        <Space>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar esta cuenta bancaria?"
            onConfirm={() => handleDelete(r)}
            okText="Sí" cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong><BankOutlined /> Cuentas bancarias del proveedor</Text>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={openNew}
          disabled={!vendorId}
        >
          Agregar cuenta
        </Button>
      </div>

      {!vendorId && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Guarda el proveedor primero para poder agregar cuentas bancarias.
        </Text>
      )}

      <Table
        size="small"
        dataSource={accounts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Sin cuentas bancarias registradas' }}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Guardar"
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          {/* Banco */}
          <Divider orientation={"left" as any} plain style={{ fontSize: 12 }}>Banco</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Banco (catálogo guateACH)" name="bankCodeGTQ">
              <Select
                showSearch
                placeholder="Selecciona el banco..."
                optionFilterProp="children"
                onChange={handleBankSelect}
              >
                {GUATE_ACH_BANKS.map(b => (
                  <Option key={b.bankCodeGTQ} value={b.bankCodeGTQ}>
                    {b.name} ({b.shortName})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Alias / descripción" name="alias">
              <Input placeholder="Cuenta Principal GTQ, Nómina USD..." />
            </Form.Item>
          </div>

          {/* Campos ocultos auto-llenados por el selector */}
          <Form.Item name="bankName"      hidden><Input /></Form.Item>
          <Form.Item name="bankShortName" hidden><Input /></Form.Item>
          <Form.Item name="bankCodeUSD"   hidden><Input /></Form.Item>

          {/* Cuenta */}
          <Divider orientation={"left" as any} plain style={{ fontSize: 12 }}>Cuenta</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '0 16px' }}>
            <Form.Item
              label="No. de cuenta"
              name="accountNumber"
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <Input placeholder="001-123456-7" />
            </Form.Item>
            <Form.Item label="Tipo de cuenta" name="accountType">
              <Select placeholder="Tipo...">
                {ACCOUNT_TYPES.map(t => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Moneda" name="currency">
              <Select>
                <Option value="GTQ">GTQ</Option>
                <Option value="USD">USD</Option>
              </Select>
            </Form.Item>
          </div>

          {/* ACH */}
          <Divider orientation={"left" as any} plain style={{ fontSize: 12 }}>Configuración ACH guateACH</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Habilitada para ACH" name="isAchEnabled" valuePropName="checked">
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>
            <Form.Item label="Cuenta predeterminada" name="isDefault" valuePropName="checked">
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Límite participante (Límite ACH, 0 = sin límite)" name="maxAmount">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="Q" />
            </Form.Item>
            <Form.Item label="Monto máx. por transacción (0 = sin límite)" name="maxPerTransaction">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="Q" />
            </Form.Item>
          </div>
          <Form.Item label="Correo para notificación ACH" name="notificationEmail">
            <Input placeholder="pagos@proveedor.com" />
          </Form.Item>
          <Form.Item label="Notas" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
