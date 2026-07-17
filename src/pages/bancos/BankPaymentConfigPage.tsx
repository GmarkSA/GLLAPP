import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  InputNumber, Switch, Divider, message, Typography, Tooltip,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { getBankAccounts, type BankAccount } from '../../api/bancos'
import {
  getBankPaymentConfigs, createBankPaymentConfig,
  updateBankPaymentConfig, deleteBankPaymentConfig,
  type BankPaymentConfig, type CheckFormat, type AchFileFormat, type PrinterType,
} from '../../api/pagosRealizados'
import CheckLayoutEditor from '../../components/CheckLayoutEditor'

const { Title, Text } = Typography
const { Option } = Select

const CHECK_FORMATS: { value: CheckFormat; label: string }[] = [
  { value: 'generic',  label: 'Genérico' },
  { value: 'bi',       label: 'Banco Industrial (BI)' },
  { value: 'bac',      label: 'BAC Credomatic' },
  { value: 'gt',       label: 'G&T Continental' },
  { value: 'banrural', label: 'Banrural' },
  { value: 'banoro',   label: 'Banoro' },
  { value: 'citi',     label: 'Citibank' },
]

const ACH_FORMATS: { value: AchFileFormat; label: string }[] = [
  { value: 'csv',       label: 'CSV delimitado' },
  { value: 'txt_fixed', label: 'Texto fijo (BI/Banrural)' },
  { value: 'xlsx',      label: 'Excel (BAC, G&T)' },
  { value: 'xml',       label: 'XML' },
]

export default function BankPaymentConfigPage() {
  const [configs, setConfigs]     = useState<BankPaymentConfig[]>([])
  const [accounts, setAccounts]   = useState<BankAccount[]>([])
  const [loading, setLoading]     = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<BankPaymentConfig | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form]                    = Form.useForm()

  const reload = async () => {
    setLoading(true)
    try {
      const [cfgs, accs] = await Promise.all([
        getBankPaymentConfigs(),
        getBankAccounts({ status: 'active' }),
      ])
      setConfigs(Array.isArray(cfgs) ? cfgs : [])
      setAccounts(Array.isArray(accs) ? accs : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const openNew = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      checkFormat: 'generic',
      printerType: 'matrix',
      matrixCpi: 10,
      currentCheckSeq: 1,
      achEnabled: false,
      achFileFormat: 'csv',
      achNomenclature: 'ACH_{BANCO}_{YYYYMMDD}_{SEQ}.csv',
    })
    setModalOpen(true)
  }

  const openEdit = (cfg: BankPaymentConfig) => {
    setEditing(cfg)
    form.setFieldsValue(cfg)
    setModalOpen(true)
  }

  const handleSave = async () => {
    let values: any
    try { values = await form.validateFields() } catch { return }

    setSaving(true)
    try {
      if (editing?.id) {
        await updateBankPaymentConfig(editing.id, values)
        message.success('Configuración actualizada')
      } else {
        await createBankPaymentConfig(values)
        message.success('Configuración creada')
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

  const handleDelete = async (cfg: BankPaymentConfig) => {
    if (!cfg.id) return
    try {
      await deleteBankPaymentConfig(cfg.id)
      message.success('Configuración eliminada')
      await reload()
    } catch {
      message.error('Error al eliminar')
    }
  }

  const columns = [
    {
      title: 'Cuenta bancaria',
      key: 'account',
      render: (_: any, r: BankPaymentConfig) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.bankAccountName ?? r.bankAccountId}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.bankName ?? ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Correlativo cheques',
      key: 'check',
      render: (_: any, r: BankPaymentConfig) => (
        <Space direction="vertical" size={0}>
          <Text>
            {r.checkPrefix ? `${r.checkPrefix}-` : ''}{String(r.currentCheckSeq ?? 1).padStart(5, '0')}
          </Text>
          {r.checkRangeFrom && r.checkRangeTo && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Chequera: {r.checkRangeFrom} → {r.checkRangeTo}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Formato / Impresora',
      key: 'fmt',
      render: (_: any, r: BankPaymentConfig) => (
        <Space direction="vertical" size={0}>
          <Tag>{CHECK_FORMATS.find(f => f.value === r.checkFormat)?.label ?? r.checkFormat}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.printerType === 'laser' ? '🖨 Láser' : '🖨 Matriz'}{r.matrixCpi ? ` ${r.matrixCpi} cpi` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'ACH',
      key: 'ach',
      render: (_: any, r: BankPaymentConfig) => r.achEnabled
        ? (
          <Space direction="vertical" size={0}>
            <Tag color="#1faec2">{ACH_FORMATS.find(f => f.value === r.achFileFormat)?.label ?? r.achFileFormat}</Tag>
            <Text type="secondary" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              {r.achNomenclature ?? ''}
            </Text>
          </Space>
        )
        : <Text type="secondary">Deshabilitado</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: BankPaymentConfig) => (
        <Space>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar esta configuración?"
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
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <SettingOutlined /> Configuración de Cheques y ACH
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          Nueva configuración
        </Button>
      </div>

      <Table
        size="small"
        dataSource={configs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'No hay configuraciones. Agrega una para cada cuenta bancaria.' }}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Editar configuración' : 'Nueva configuración de cheques/ACH'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Guardar"
        confirmLoading={saving}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          {/* Cuenta */}
          <Form.Item
            label="Cuenta bancaria"
            name="bankAccountId"
            rules={[{ required: true, message: 'Selecciona la cuenta bancaria' }]}
          >
            <Select
              showSearch
              placeholder="Selecciona la cuenta..."
              optionFilterProp="children"
              onChange={(id) => {
                const acc = accounts.find(a => a.id === id)
                if (acc) {
                  form.setFieldsValue({ bankAccountName: acc.name, bankName: acc.bankName })
                }
              }}
            >
              {accounts.map(a => (
                <Option key={a.id} value={a.id}>
                  {a.name} {a.bankName ? `— ${a.bankName}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="bankAccountName" hidden><Input /></Form.Item>
          <Form.Item name="bankName"        hidden><Input /></Form.Item>

          {/* Correlativo */}
          <Divider orientation={"left" as any} plain style={{ fontSize: 12 }}>Correlativo de cheques</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '0 12px' }}>
            <Form.Item label="Prefijo" name="checkPrefix">
              <Input placeholder="CHK-BI" maxLength={20} />
            </Form.Item>
            <Form.Item label="Próximo No." name="currentCheckSeq">
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item label="Desde (chequera)" name="checkRangeFrom">
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item label="Hasta (chequera)" name="checkRangeTo">
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </div>

          {/* Formato cheque */}
          <Divider orientation={"left" as any} plain style={{ fontSize: 12 }}>Formato de impresión del cheque</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Form.Item label="Formato base" name="checkFormat">
              <Select>
                {CHECK_FORMATS.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Tipo de impresora"
              name="printerType"
              extra="Matriz: Courier monoespaciado, sin colores. Láser: fuente proporcional, con sombras."
            >
              <Select>
                <Option value="matrix">🖨 Matriz de puntos (cinta)</Option>
                <Option value="laser">🖨 Láser / Inkjet</Option>
              </Select>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(p, c) => p.printerType !== c.printerType}>
              {({ getFieldValue }) => getFieldValue('printerType') === 'matrix' ? (
                <Form.Item
                  label="Caracteres por pulgada (CPI)"
                  name="matrixCpi"
                  extra="10 cpi = estándar. 12/15/17 = comprimido. Afecta al ancho efectivo de los campos."
                >
                  <Select>
                    <Option value={10}>10 cpi — Normal</Option>
                    <Option value={12}>12 cpi — Condensado</Option>
                    <Option value={15}>15 cpi — Semi-fino</Option>
                    <Option value={17}>17 cpi — Fino</Option>
                    <Option value={20}>20 cpi — Ultra-fino</Option>
                  </Select>
                </Form.Item>
              ) : null}
            </Form.Item>
          </div>

          {/* Editor visual de layout */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.checkFormat !== cur.checkFormat}>
            {({ getFieldValue }) => (
              <Form.Item name="checkFieldPositions" noStyle>
                <CheckLayoutEditor baseFormat={getFieldValue('checkFormat') ?? 'generic'} />
              </Form.Item>
            )}
          </Form.Item>

          {/* ACH */}
          <Divider orientation={"left" as any} plain style={{ fontSize: 12 }}>Pagos electrónicos ACH guateACH</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Habilitar pagos ACH" name="achEnabled" valuePropName="checked">
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>
            <Form.Item label="Formato de archivo" name="achFileFormat">
              <Select allowClear>
                {ACH_FORMATS.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Código banco ACH emisor" name="achBankCode">
              <Input placeholder="115 (Banco Industrial)" />
            </Form.Item>
            <Form.Item label="ID empresa ante el banco" name="achCompanyId">
              <Input placeholder="GLLCONSULTING01" />
            </Form.Item>
          </div>
          <Form.Item label="Nombre empresa en archivo ACH" name="achCompanyName">
            <Input placeholder="GLL CONSULTING S.A." />
          </Form.Item>
          <Form.Item
            label="Nomenclatura del archivo"
            name="achNomenclature"
            extra="Tokens: {BANCO} {YYYYMMDD} {SEQ} {COUNT} — Ej: ACH_{BANCO}_{YYYYMMDD}_{SEQ}.csv"
          >
            <Input placeholder="ACH_{BANCO}_{YYYYMMDD}_{SEQ}.csv" />
          </Form.Item>
          <Form.Item label="Notas" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
