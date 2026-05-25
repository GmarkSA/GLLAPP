import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Layout, Typography, List, Tag, Button, Table, Space, Tooltip,
  Modal, Form, Input, InputNumber, Select, Switch, message, Popconfirm,
  Divider, Badge,
} from 'antd'
import type { InputRef } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  BankOutlined, UserOutlined, ShopOutlined, ToolOutlined,
  AuditOutlined, ReloadOutlined, CheckOutlined, CloseOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getAccountGroups, getAccounts, createAccount, updateAccount, deleteAccount, seedGLL,
  type Account,
} from '../../api/catalogo'

const { Sider, Content } = Layout
const { Title, Text } = Typography

// ─── Color map ────────────────────────────────────────────────────────────────
const BALANCE_TYPE_COLOR: Record<string, string> = {
  'Activo':          'blue',
  'Activo Fijo':     'geekblue',
  'Pasivo':          'red',
  'Capital':         'purple',
  'Ingresos':        'green',
  'Costos':          'orange',
  'Gastos':          'volcano',
  'Otros Ingresos':  'cyan',
  'Otros Gastos':    'magenta',
  'Cuentas de Orden':'default',
}

const BALANCE_TYPE_ORDER = [
  'Activo', 'Activo Fijo', 'Pasivo', 'Capital',
  'Ingresos', 'Costos', 'Gastos',
  'Otros Ingresos', 'Otros Gastos', 'Cuentas de Orden',
]

// ─── Flag icon helper ─────────────────────────────────────────────────────────
function FlagIcon({ active, icon, title }: { active: boolean; icon: React.ReactNode; title: string }) {
  return (
    <Tooltip title={title}>
      <span style={{ color: active ? '#1677ff' : '#d9d9d9', fontSize: 15 }}>{icon}</span>
    </Tooltip>
  )
}

// ─── Account Modal ────────────────────────────────────────────────────────────
interface AccountModalProps {
  open: boolean
  record: Partial<Account> | null
  groups: Account[]
  onClose: () => void
  onSaved: () => void
}

function AccountModal({ open, record, groups, onClose, onSaved }: AccountModalProps) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const isEdit = !!record?.id

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (record) {
      form.setFieldsValue({ isActive: true, normalBalance: 'debit', ...record })
      // If creating a new account with a pre-selected group, auto-populate group fields
      if (record.groupCode && !record.id) {
        handleGroupChange(record.groupCode)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record])

  const handleGroupChange = async (code: string) => {
    const g = groups.find(g => g.groupCode === code)
    if (!g) return
    form.setFieldsValue({
      rangeStart:    g.rangeStart,
      rangeEnd:      g.rangeEnd,
      balanceType:   g.balanceType,
      type:          g.type,
      normalBalance: g.normalBalance,
    })
    // Auto-generate next available code in this group's range
    try {
      const existing: Account[] = await getAccounts({ groupCode: code })
      const arr = Array.isArray(existing) ? existing : []
      const maxCode = arr.reduce((mx, a) => {
        const n = parseInt(a.code, 10)
        return isNaN(n) ? mx : Math.max(mx, n)
      }, g.rangeStart ?? 0)
      form.setFieldValue('code', String(maxCode + 1))
    } catch {
      form.setFieldValue('code', String((g.rangeStart ?? 0) + 1))
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (isEdit) {
        await updateAccount(record!.id!, values)
        message.success('Cuenta actualizada')
      } else {
        await createAccount(values)
        message.success('Cuenta creada')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      if (e?.errorFields) return // validation error, do not close
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Editar cuenta contable' : 'Nueva cuenta contable'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ isActive: true, normalBalance: 'debit', bankLinking: false, isCustomerAccount: false, isVendorAccount: false, isFixedAsset: false, requiresReconciliation: false, isInventoryAccount: false }}>
        {/* Hidden fields needed for backend — populated by handleGroupChange */}
        <Form.Item name="type" hidden><Input /></Form.Item>

        <Form.Item name="groupCode" label="Grupo contable" rules={[{ required: true, message: 'Seleccione un grupo' }]}>
          <Select
            placeholder="Seleccione grupo"
            showSearch
            optionFilterProp="label"
            onChange={handleGroupChange}
            options={groups.map(g => ({
              value: g.groupCode,
              label: `${g.groupCode} — ${g.name}`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="code"
          label="Código"
          rules={[
            { required: true, message: 'Ingrese el código' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                const gc = getFieldValue('groupCode')
                const grp = groups.find(g => g.groupCode === gc)
                if (!grp || !value) return Promise.resolve()
                const num = parseInt(value, 10)
                if (isNaN(num) || num < (grp.rangeStart ?? 0) || num > (grp.rangeEnd ?? 999999)) {
                  return Promise.reject(new Error(`Código debe estar entre ${grp.rangeStart} y ${grp.rangeEnd}`))
                }
                return Promise.resolve()
              },
            }),
          ]}
        >
          <Input placeholder="Ej: 110001" />
        </Form.Item>

        <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Ingrese el nombre' }]}>
          <Input placeholder="Nombre de la cuenta" />
        </Form.Item>

        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} placeholder="Descripción opcional" />
        </Form.Item>

        <Divider titlePlacement="left" style={{ fontSize: 12, color: '#8c8c8c' }}>Configuración automática del grupo</Divider>

        <Space style={{ width: '100%' }} wrap>
          <Form.Item name="balanceType" label="Tipo de balance" style={{ marginBottom: 0 }}>
            <Input disabled style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="normalBalance" label="Saldo normal" style={{ marginBottom: 0 }}>
            <Input disabled style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="rangeStart" label="Rango inicio" style={{ marginBottom: 0 }}>
            <InputNumber disabled style={{ width: 110 }} />
          </Form.Item>
          <Form.Item name="rangeEnd" label="Rango fin" style={{ marginBottom: 0 }}>
            <InputNumber disabled style={{ width: 110 }} />
          </Form.Item>
        </Space>

        <Divider titlePlacement="left" style={{ fontSize: 12, color: '#8c8c8c', marginTop: 16 }}>Flags / Comportamiento</Divider>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item name="bankLinking" label="Vinculación con bancos" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="isCustomerAccount" label="Cuenta de clientes (CxC)" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="isVendorAccount" label="Cuenta de proveedores (CxP)" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Switch />
          </Form.Item>
          <Form.Item
            name="isFixedAsset"
            valuePropName="checked"
            style={{ marginBottom: 4 }}
            label={
              <Space size={4}>
                Activos fijos
                <Tooltip title="Habilita el control de depreciación y amortización para cuentas de Propiedad, Planta y Equipo (160) y Activo Diferido (170)">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="requiresReconciliation"
            valuePropName="checked"
            style={{ marginBottom: 4 }}
            label={
              <Space size={4}>
                Requiere conciliación
                <Tooltip title="La cuenta debe conciliarse periódicamente con un estado externo: banco, tarjeta de crédito o estado de cuenta de proveedor/cliente">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="isInventoryAccount"
            valuePropName="checked"
            style={{ marginBottom: 4 }}
            label={
              <Space size={4}>
                Cuenta de inventario
                <Tooltip title="Permite vincular esta cuenta con artículos del módulo de Inventario (típicamente grupo 130 — Inventarios)">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
          >
            <Switch />
          </Form.Item>
        </Space>

        <Divider style={{ marginTop: 8 }} />

        <Space>
          <Form.Item name="openingBalance" label="Saldo inicial" style={{ marginBottom: 0 }}>
            <InputNumber
              style={{ width: 160 }}
              precision={2}
              prefix="Q"
              placeholder="0.00"
            />
          </Form.Item>
          <Form.Item name="isActive" label="Activa" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CatalogoPage() {
  const [groups, setGroups] = useState<Account[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Account | null>(null) // null = "Todos"
  const [loadingGroups, setLoadingGroups] = useState(false)
  // Inline group name editing
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const editInputRef = useRef<InputRef>(null)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<Partial<Account> | null>(null)

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    try {
      const data = await getAccountGroups()
      setGroups(Array.isArray(data) ? data : [])
    } catch {
      message.error('Error al cargar grupos')
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const params = selectedGroup ? { groupCode: selectedGroup.groupCode } : undefined
      const data = await getAccounts(params)
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      message.error('Error al cargar cuentas')
    } finally {
      setLoadingAccounts(false)
    }
  }, [selectedGroup])

  useEffect(() => { loadGroups() }, [loadGroups])
  useEffect(() => { loadAccounts() }, [loadAccounts])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const result = await seedGLL()
      message.success(`Catálogo inicializado: ${result.created} grupos creados, ${result.skipped} ya existían`)
      loadGroups()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al inicializar catálogo'))
    } finally {
      setSeeding(false)
    }
  }

  const startEditGroup = (g: Account, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingGroupId(g.id)
    setEditingGroupName(g.name)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const saveGroupName = async () => {
    if (!editingGroupId || !editingGroupName.trim()) { setEditingGroupId(null); return }
    try {
      await updateAccount(editingGroupId, { name: editingGroupName.trim() })
      setGroups(prev => prev.map(g => g.id === editingGroupId ? { ...g, name: editingGroupName.trim() } : g))
      message.success('Nombre actualizado')
    } catch {
      message.error('No se pudo actualizar')
    } finally {
      setEditingGroupId(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id)
      message.success('Cuenta desactivada')
      loadAccounts()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar')
    }
  }

  const openNew = () => {
    setEditRecord(selectedGroup ? { groupCode: selectedGroup.groupCode } : {})
    setModalOpen(true)
  }

  const openEdit = (record: Account) => {
    setEditRecord(record)
    setModalOpen(true)
  }

  // Group by balanceType for sidebar
  const groupsBySection = BALANCE_TYPE_ORDER.reduce<Record<string, Account[]>>((acc, bt) => {
    const items = groups.filter(g => g.balanceType === bt)
    if (items.length) acc[bt] = items
    return acc
  }, {})

  const columns: ColumnsType<Account> = [
    {
      title: 'Código',
      dataIndex: 'code',
      width: 90,
      render: (v: string) => <Badge count={v} style={{ backgroundColor: '#f0f0f0', color: '#333', fontFamily: 'monospace' }} />,
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'balanceType',
      width: 130,
      render: (v: string) => v ? <Tag color={BALANCE_TYPE_COLOR[v] || 'default'}>{v}</Tag> : '-',
    },
    {
      title: 'Saldo normal',
      dataIndex: 'normalBalance',
      width: 110,
      render: (v: string) => (
        <Tag color={v === 'debit' ? 'blue' : 'red'}>
          {v === 'debit' ? 'Débito' : 'Crédito'}
        </Tag>
      ),
    },
    {
      title: 'Flags',
      width: 100,
      render: (_: any, r: Account) => (
        <Space size={6}>
          <FlagIcon active={r.bankLinking}         icon={<BankOutlined />} title="Vinculación bancaria" />
          <FlagIcon active={r.isCustomerAccount}   icon={<UserOutlined />} title="Cuenta clientes (CxC)" />
          <FlagIcon active={r.isVendorAccount}     icon={<ShopOutlined />} title="Cuenta proveedores (CxP)" />
        </Space>
      ),
    },
    {
      title: 'Balance Q',
      dataIndex: 'currentBalance',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Text style={{ fontFamily: 'monospace', color: v < 0 ? '#ff4d4f' : undefined }}>
          {Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      width: 90,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag>,
    },
    {
      title: 'Acciones',
      width: 90,
      render: (_: any, r: Account) => (
        <Space>
          <Tooltip title="Editar">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          {!r.isSystem && (
            <Popconfirm
              title="¿Desactivar esta cuenta?"
              onConfirm={() => handleDelete(r.id)}
              okText="Sí"
              cancelText="No"
            >
              <Tooltip title="Desactivar">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const selectedGroupInfo = selectedGroup
    ? groups.find(g => g.groupCode === selectedGroup.groupCode)
    : null

  return (
    <Layout style={{ background: 'transparent', height: 'calc(100vh - 112px)' }}>
      {/* ── Left sidebar: group list ── */}
      <Sider
        width={320}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          height: '100%',
        }}
      >
        <div style={{ padding: '16px 12px 8px' }}>
          <Title level={5} style={{ margin: 0, color: '#1B3A6B' }}>
            <AuditOutlined style={{ marginRight: 8 }} />
            Grupos contables
          </Title>
        </div>

        {/* "Todos" option */}
        <div
          onClick={() => setSelectedGroup(null)}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            background: selectedGroup === null ? '#e6f4ff' : 'transparent',
            borderRight: selectedGroup === null ? '3px solid #1677ff' : '3px solid transparent',
            marginBottom: 4,
          }}
        >
          <Text strong={selectedGroup === null} style={{ color: selectedGroup === null ? '#1677ff' : undefined }}>
            Todos
          </Text>
          <Tag style={{ marginLeft: 8, fontSize: 10 }} color="default">{accounts.length}</Tag>
        </div>

        {loadingGroups ? (
          <div style={{ padding: 16, color: '#8c8c8c' }}>Cargando...</div>
        ) : (
          BALANCE_TYPE_ORDER.map(bt => {
            const sectionGroups = groupsBySection[bt]
            if (!sectionGroups?.length) return null
            return (
              <div key={bt}>
                <div style={{
                  padding: '6px 12px 2px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#8c8c8c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderTop: '1px solid #f5f5f5',
                  marginTop: 4,
                }}>
                  <Tag color={BALANCE_TYPE_COLOR[bt]} style={{ fontSize: 10 }}>{bt}</Tag>
                </div>
                <List
                  dataSource={sectionGroups}
                  renderItem={g => {
                    const isSelected = selectedGroup?.groupCode === g.groupCode
                    return (
                      <List.Item
                        onClick={() => setSelectedGroup(g)}
                        style={{
                          padding: '6px 12px 6px 16px',
                          cursor: 'pointer',
                          background: isSelected ? '#e6f4ff' : 'transparent',
                          borderRight: isSelected ? '3px solid #1677ff' : '3px solid transparent',
                          borderBottom: 'none',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <Tag style={{ fontFamily: 'monospace', fontSize: 11, flexShrink: 0 }} color={isSelected ? 'blue' : 'default'}>
                            {g.groupCode}
                          </Tag>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isSelected ? '#1677ff' : undefined,
                              fontWeight: isSelected ? 600 : undefined,
                              whiteSpace: 'normal',
                              lineHeight: 1.3,
                            }}
                          >
                            {g.name}
                          </Text>
                        </div>
                      </List.Item>
                    )
                  }}
                />
              </div>
            )
          })
        )}
      </Sider>

      {/* ── Right content: accounts table ── */}
      <Content style={{ padding: 20, overflow: 'auto', background: '#fafafa' }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            {selectedGroupInfo ? (
              <>
                <Space align="center" style={{ marginBottom: 2 }}>
                  <Tag color={BALANCE_TYPE_COLOR[selectedGroupInfo.balanceType || ''] || 'default'} style={{ fontSize: 13 }}>
                    {selectedGroupInfo.groupCode}
                  </Tag>
                  {editingGroupId === selectedGroupInfo.id ? (
                    <Space size={4}>
                      <Input
                        ref={editInputRef}
                        value={editingGroupName}
                        onChange={e => setEditingGroupName(e.target.value)}
                        onPressEnter={saveGroupName}
                        onBlur={saveGroupName}
                        style={{ fontSize: 18, fontWeight: 600, width: 380, color: '#1B3A6B' }}
                      />
                      <Button size="small" type="text" icon={<CheckOutlined style={{ color: '#52c41a' }} />} onClick={saveGroupName} />
                      <Button size="small" type="text" icon={<CloseOutlined style={{ color: '#ff4d4f' }} />} onClick={() => setEditingGroupId(null)} />
                    </Space>
                  ) : (
                    <Space size={6} align="center">
                      <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
                        {selectedGroupInfo.name}
                      </Title>
                      <Tooltip title="Editar nombre del grupo">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined style={{ color: '#8c8c8c' }} />}
                          onClick={e => startEditGroup(selectedGroupInfo, e)}
                        />
                      </Tooltip>
                    </Space>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Rango: {selectedGroupInfo.rangeStart?.toLocaleString()} — {selectedGroupInfo.rangeEnd?.toLocaleString()}
                  {' '}·{' '}
                  Saldo normal: {selectedGroupInfo.normalBalance === 'debit' ? 'Débito' : 'Crédito'}
                </Text>
              </>
            ) : (
              <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
                Todas las cuentas contables
              </Title>
            )}
          </div>

          <Space>
            {groups.length < 68 && (
              <Button
                type="default"
                icon={<ReloadOutlined />}
                loading={seeding}
                onClick={handleSeed}
                style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
              >
                {groups.length === 0 ? 'Inicializar catálogo GLL' : `Completar catálogo GLL (${groups.length}/68)`}
              </Button>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openNew}
              style={{ background: '#1B3A6B' }}
            >
              Nueva cuenta
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={accounts}
          loading={loadingAccounts}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} cuentas` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: selectedGroupInfo ? `Sin cuentas en grupo ${selectedGroupInfo.groupCode}` : 'Sin cuentas registradas' }}
        />
      </Content>

      {/* ── Account Modal ── */}
      <AccountModal
        open={modalOpen}
        record={editRecord}
        groups={groups}
        onClose={() => setModalOpen(false)}
        onSaved={loadAccounts}
      />
    </Layout>
  )
}
