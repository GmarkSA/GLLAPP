import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Layout, Typography, List, Tag, Button, Table, Space, Tooltip,
  Modal, Form, Input, InputNumber, Select, Switch, message, Popconfirm,
  Divider, Badge, Dropdown, Alert,
} from 'antd'
import type { InputRef } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, ShopOutlined, ToolOutlined,
  AuditOutlined, ReloadOutlined, CheckOutlined, CloseOutlined, InfoCircleOutlined,
  MinusCircleOutlined, DownOutlined, SyncOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined,
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
  'Activo':          '#1faec2',
  'Activo Fijo':     '#1faec2',
  'Pasivo':          '#e5484d',
  'Capital':         '#2ea172',
  'Ingresos':        '#2ea172',
  'Costos':          '#ff7f00',
  'Gastos':          '#ff7f00',
  'Otros Ingresos':  '#2ea172',
  'Otros Gastos':    '#ff7f00',
  'Cuentas de Orden':'#6b7280',
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
      <span style={{ color: active ? '#1faec2' : 'rgba(10,10,10,0.08)', fontSize: 15 }}>{icon}</span>
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
  const isEdit    = !!record?.id
  const isSystem  = !!(record as any)?.isSystem
  const typeValue = Form.useWatch('type', form)
  const isContra  = typeValue === 'contra'

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (record) {
      form.setFieldsValue({ isActive: true, normalBalance: 'debit', ...record })
      if (record.groupCode && !record.id) handleGroupChange(record.groupCode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record])

  const handleGroupChange = async (code: string) => {
    const g = groups.find(g => g.groupCode === code)
    if (!g) return
    form.setFieldsValue({
      rangeStart: g.rangeStart, rangeEnd: g.rangeEnd,
      balanceType: g.balanceType, type: g.type, normalBalance: g.normalBalance,
    })
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
        // Cuentas del sistema: el backend no permite cambiar código ni tipo
        if (isSystem) {
          const { code: _c, groupCode: _g, type: _t, rangeStart: _rs, rangeEnd: _re, balanceType: _bt, normalBalance: _nb, ...rest } = values
          await updateAccount(record!.id!, rest)
        } else {
          await updateAccount(record!.id!, values)
        }
        message.success('Cuenta actualizada')
      } else {
        await createAccount(values)
        message.success('Cuenta creada')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  const switchRow = (name: string, label: string, tooltip?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(10,10,10,0.05)' }}>
      <Space size={4}>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        {tooltip && <Tooltip title={tooltip}><InfoCircleOutlined style={{ color: '#9aa1ab', fontSize: 12 }} /></Tooltip>}
      </Space>
      <Form.Item name={name} valuePropName="checked" style={{ margin: 0 }}>
        <Switch size="small" />
      </Form.Item>
    </div>
  )

  return (
    <Modal
      title={
        <Space>
          {isEdit ? 'Editar cuenta contable' : 'Nueva cuenta contable'}
          {isSystem && <Badge color="#ff7f00" text={<Text style={{ fontSize: 12, color: '#ff7f00' }}>Cuenta del sistema</Text>} />}
        </Space>
      }
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      width={780}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{ isActive: true, normalBalance: 'debit', isCustomerAccount: false, isVendorAccount: false, isFixedAsset: false, requiresReconciliation: false, isInventoryAccount: false, requiresCostCenter: false, requiresProfitCenter: false }}
      >
        <Form.Item name="type" hidden><Input /></Form.Item>

        {isSystem && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '6px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
            Cuenta del sistema: código, grupo y tipo no se pueden modificar. El resto de campos sí son editables.
          </div>
        )}

        {/* ── 2 columnas ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', alignItems: 'start' }}>

          {/* ── Bloque 1: Identificación ── */}
          <div>
            <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', display: 'block', marginBottom: 8 }}>
              Identificación
            </Text>

            <Form.Item name="groupCode" label="Grupo contable" rules={[{ required: !isSystem, message: 'Seleccione un grupo' }]}>
              <Select
                placeholder="Seleccione grupo"
                showSearch
                optionFilterProp="label"
                onChange={handleGroupChange}
                disabled={isSystem}
                options={groups.map(g => ({ value: g.groupCode, label: `${g.groupCode} — ${g.name}` }))}
              />
            </Form.Item>

            <Form.Item
              name="code"
              label="Código"
              rules={isSystem ? [] : [
                { required: true, message: 'Ingrese el código' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const grp = groups.find(g => g.groupCode === getFieldValue('groupCode'))
                    if (!grp || !value) return Promise.resolve()
                    const num = parseInt(value, 10)
                    if (isNaN(num) || num < (grp.rangeStart ?? 0) || num > (grp.rangeEnd ?? 999999))
                      return Promise.reject(new Error(`Código debe estar entre ${grp.rangeStart} y ${grp.rangeEnd}`))
                    return Promise.resolve()
                  },
                }),
              ]}
            >
              <Input placeholder="Ej: 110001" disabled={isSystem} />
            </Form.Item>

            <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Ingrese el nombre' }]}>
              <Input placeholder="Nombre de la cuenta" />
            </Form.Item>

            <Form.Item name="description" label="Descripción">
              <Input.TextArea rows={2} placeholder="Descripción opcional" style={{ resize: 'none' }} />
            </Form.Item>

            <Divider style={{ margin: '8px 0', fontSize: 11, color: '#9aa1ab' }}>Del grupo</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
              <Form.Item name="balanceType" label="Tipo balance" style={{ marginBottom: 6 }}>
                <Input disabled />
              </Form.Item>
              <Form.Item name="normalBalance" label="Saldo normal" style={{ marginBottom: 6 }}>
                <Input disabled />
              </Form.Item>
              <Form.Item name="rangeStart" label="Rango inicio" style={{ marginBottom: 6 }}>
                <InputNumber disabled style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="rangeEnd" label="Rango fin" style={{ marginBottom: 6 }}>
                <InputNumber disabled style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
              <Form.Item name="openingBalance" label="Saldo inicial" style={{ marginBottom: 0 }}>
                <InputNumber style={{ width: '100%' }} precision={2} prefix="Q" placeholder="0.00" />
              </Form.Item>
              <Form.Item name="isActive" label="Estado" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch checkedChildren="Activa" unCheckedChildren="Inactiva" />
              </Form.Item>
            </div>

          </div>

          {/* ── Bloque 2: Comportamiento ── */}
          <div>
            <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', display: 'block', marginBottom: 8 }}>
              Comportamiento
            </Text>

            {switchRow('isCustomerAccount', 'Cuenta de clientes (CxC)')}
            {switchRow('isVendorAccount',   'Cuenta de proveedores (CxP)')}
            {switchRow('isFixedAsset',      'Activos fijos', 'Habilita depreciación/amortización (grupos 160, 170)')}
            {switchRow('requiresReconciliation', 'Requiere conciliación', 'Conciliar periódicamente con estado externo (banco, tarjeta, etc.)')}
            {switchRow('isInventoryAccount', 'Cuenta de inventario', 'Vincula con artículos del módulo de Inventario (grupo 130)')}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(10,10,10,0.05)' }}>
              <Space size={4}>
                <MinusCircleOutlined style={{ color: isContra ? '#e5484d' : '#9aa1ab' }} />
                <Text style={{ fontSize: 13 }}>Cuenta contra-activo</Text>
                <Tooltip title="Saldo se resta al activo relacionado en el Balance General (Depreciación Acumulada, etc.)">
                  <InfoCircleOutlined style={{ color: '#9aa1ab', fontSize: 12 }} />
                </Tooltip>
              </Space>
              <Switch
                size="small"
                checked={isContra}
                onChange={v => {
                  if (v) {
                    form.setFieldValue('type', 'contra')
                    form.setFieldValue('normalBalance', 'credit')
                  } else {
                    const grp = groups.find(g => g.groupCode === form.getFieldValue('groupCode'))
                    form.setFieldValue('type', grp?.type ?? 'asset')
                    form.setFieldValue('normalBalance', grp?.normalBalance ?? 'debit')
                  }
                }}
              />
            </div>

            <Divider style={{ margin: '12px 0 6px', fontSize: 11, color: '#9aa1ab' }}>Dimensiones analíticas</Divider>

            {switchRow('requiresCostCenter',   'Exige Centro de Costo',     'Líneas de póliza deben tener Centro de Costo (típico en Costos 5xxx y Gastos 6xxx)')}
            {switchRow('requiresProfitCenter', 'Exige Centro de Beneficio', 'Líneas de póliza deben tener Centro de Beneficio asignado')}

            {/* ── Guía de comportamiento ── */}
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid rgba(10,10,10,0.07)',
              fontSize: 11,
              color: '#6b7280',
              lineHeight: 1.6,
            }}>
              <Text strong style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>
                ¿Cuándo activar cada opción?
              </Text>
              Usa <strong>CxC</strong> en cuentas de Clientes Locales y del Exterior, y <strong>CxP</strong> en cuentas de Proveedores — habilita auxiliares por cliente/proveedor.
              Marca <strong>Activos fijos</strong> en cuentas de Propiedad, Planta y Equipo para vincularlas al módulo de activos.
              Activa <strong>Exige Centro de Costo</strong> en cuentas de Gastos y Costos, y <strong>Exige Centro de Beneficio</strong> en cuentas de Ingresos, para que el sistema solicite esa dimensión al contabilizar.
            </div>
          </div>
        </div>
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

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

  const handleSeed = async (mode: 'complement' | 'sync_properties' = 'complement') => {
    setSeeding(true)
    try {
      const result = await seedGLL(mode)
      if (mode === 'sync_properties') {
        message.success(`Sincronizado: ${result.created} cuentas nuevas, ${result.updated} propiedades actualizadas, ${result.skipped} sin cambios`)
      } else {
        message.success(`Catálogo completado: ${result.created} cuentas nuevas, ${result.skipped} ya existían`)
      }
      loadGroups()
      loadAccounts()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al procesar catálogo'))
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

  const handleBulkDelete = (force = false) => {
    const selected  = accounts.filter(a => selectedRowKeys.includes(a.id))
    const canDelete = selected.filter(a => Number(a.currentBalance ?? 0) === 0)
    const blocked   = selected.filter(a => Number(a.currentBalance ?? 0) !== 0)

    Modal.confirm({
      title: `Eliminar ${selected.length} cuenta(s) seleccionada(s)`,
      icon: <ExclamationCircleOutlined style={{ color: '#e5484d' }} />,
      width: 540,
      content: (
        <div style={{ marginTop: 8 }}>
          {force && (
            <Alert
              type="warning"
              showIcon
              message="Modo limpieza activo"
              description="Se eliminarán cuentas del sistema con saldo cero aunque tengan historial de movimientos. Úsalo solo para resetear datos de prueba."
              style={{ marginBottom: 12 }}
            />
          )}
          {canDelete.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#2ea172', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleOutlined /> {canDelete.length} cuenta(s) se eliminarán (saldo cero):
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto', paddingLeft: 4 }}>
                {canDelete.map(a => (
                  <div key={a.id} style={{ fontSize: 12, color: '#374151' }}>
                    <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.code}</Tag> {a.name}
                  </div>
                ))}
              </div>
            </div>
          )}
          {blocked.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`${blocked.length} cuenta(s) tienen saldo y NO se eliminarán:`}
              description={
                <div style={{ maxHeight: 100, overflowY: 'auto', marginTop: 4 }}>
                  {blocked.map(a => (
                    <div key={a.id} style={{ fontSize: 12 }}>
                      <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.code}</Tag>
                      {a.name} — <strong>Q {Number(a.currentBalance).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  ))}
                </div>
              }
            />
          )}
          {canDelete.length === 0 && blocked.length === 0 && (
            <Alert type="error" showIcon message="No hay cuentas válidas para eliminar." />
          )}
        </div>
      ),
      okText: canDelete.length > 0 ? `Eliminar ${canDelete.length} cuenta(s)` : 'Sin cuentas eliminables',
      okButtonProps: { danger: true, disabled: canDelete.length === 0 },
      cancelText: 'Cancelar',
      onOk: async () => {
        setBulkDeleting(true)
        const errors: string[] = []
        let deleted = 0
        for (const acc of canDelete) {
          try { await deleteAccount(acc.id, force); deleted++ }
          catch { errors.push(acc.code) }
        }
        setBulkDeleting(false)
        setSelectedRowKeys([])
        if (deleted > 0) { message.success(`${deleted} cuenta(s) eliminada(s)`); loadAccounts(); loadGroups() }
        if (errors.length > 0) message.error(`No se pudieron eliminar: ${errors.join(', ')}`)
      },
    })
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
      render: (v: string) => <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, margin: 0 }}>{v}</Tag>,
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
        <Tag color={v === 'debit' ? '#1faec2' : '#e5484d'}>
          {v === 'debit' ? 'Débito' : 'Crédito'}
        </Tag>
      ),
    },
    {
      title: 'Flags',
      width: 120,
      render: (_: any, r: Account) => (
        <Space size={6}>
          <FlagIcon active={r.isCustomerAccount}   icon={<UserOutlined />}         title="Cuenta clientes (CxC)" />
          <FlagIcon active={r.isVendorAccount}     icon={<ShopOutlined />}         title="Cuenta proveedores (CxP)" />
          <FlagIcon active={r.isFixedAsset}        icon={<ToolOutlined />}         title="Activos fijos" />
          <FlagIcon active={r.type === 'contra'}   icon={<MinusCircleOutlined />}  title="Cuenta contra-activo (resta al activo)" />
        </Space>
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
          borderRight: '1px solid rgba(10,10,10,0.08)',
          overflow: 'auto',
          height: '100%',
        }}
      >
        <div style={{ padding: '16px 12px 8px' }}>
          <Title level={5} style={{ margin: 0, color: '#0a0a0a' }}>
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
            background: selectedGroup === null ? '#e6fafd' : 'transparent',
            borderRight: selectedGroup === null ? '3px solid #1faec2' : '3px solid transparent',
            marginBottom: 4,
          }}
        >
          <Text strong={selectedGroup === null} style={{ color: selectedGroup === null ? '#1faec2' : undefined }}>
            Todos
          </Text>
          <Tag style={{ marginLeft: 8, fontSize: 10 }} color="default">{accounts.length}</Tag>
        </div>

        {loadingGroups ? (
          <div style={{ padding: 16, color: '#6b7280' }}>Cargando...</div>
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
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderTop: '1px solid #fafbfc',
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
                          background: isSelected ? '#e6fafd' : 'transparent',
                          borderRight: isSelected ? '3px solid #1faec2' : '3px solid transparent',
                          borderBottom: 'none',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, flexShrink: 0 }} color={isSelected ? '#1faec2' : 'default'}>
                            {g.groupCode}
                          </Tag>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isSelected ? '#1faec2' : undefined,
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
      <Content style={{ padding: 20, overflow: 'auto', background: '#fafbfc' }}>
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
                        style={{ fontSize: 18, fontWeight: 600, width: 380, color: '#0a0a0a' }}
                      />
                      <Button size="small" type="text" icon={<CheckOutlined style={{ color: '#2ea172' }} />} onClick={saveGroupName} />
                      <Button size="small" type="text" icon={<CloseOutlined style={{ color: '#e5484d' }} />} onClick={() => setEditingGroupId(null)} />
                    </Space>
                  ) : (
                    <Space size={6} align="center">
                      <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
                        {selectedGroupInfo.name}
                      </Title>
                      <Tooltip title="Editar nombre del grupo">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined style={{ color: '#6b7280' }} />}
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
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
                Todas las cuentas contables
              </Title>
            )}
          </div>

          <Space>
            {selectedRowKeys.length > 0 && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'normal',
                      icon: <DeleteOutlined />,
                      label: `Eliminar seleccionadas (${selectedRowKeys.length})`,
                      onClick: () => handleBulkDelete(false),
                    },
                    { type: 'divider' },
                    {
                      key: 'force',
                      icon: <ExclamationCircleOutlined style={{ color: '#e5484d' }} />,
                      label: (
                        <Tooltip title="Elimina cuentas del sistema con saldo cero aunque tengan historial. Solo para resetear datos de prueba.">
                          <span style={{ color: '#e5484d' }}>Forzar eliminación (limpieza)</span>
                        </Tooltip>
                      ),
                      onClick: () => handleBulkDelete(true),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button danger icon={<DeleteOutlined />} loading={bulkDeleting}>
                  Eliminar ({selectedRowKeys.length}) <DownOutlined />
                </Button>
              </Dropdown>
            )}
            {(() => {
              const complete = groups.length >= 68
              const btn = (
                <Dropdown
                  disabled={complete || seeding}
                  menu={{
                    items: [
                      {
                        key: 'complement',
                        icon: <ReloadOutlined />,
                        label: (
                          <Tooltip title="Agrega las cuentas del template GLL que aún no existen. No toca las cuentas existentes.">
                            {groups.length === 0 ? 'Inicializar catálogo GLL' : `Completar catálogo GLL (${groups.length}/68 grupos)`}
                          </Tooltip>
                        ),
                        onClick: () => handleSeed('complement'),
                      },
                      {
                        key: 'sync',
                        icon: <SyncOutlined />,
                        label: (
                          <Tooltip title="Actualiza propiedades del sistema (tipo, balance, clasificación) en cuentas existentes, sin cambiar nombres ni saldos. Agrega las faltantes.">
                            Sincronizar propiedades con template GLL
                          </Tooltip>
                        ),
                        onClick: () => handleSeed('sync_properties'),
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button
                    type="default"
                    icon={complete ? <CheckCircleOutlined /> : <ReloadOutlined />}
                    loading={seeding}
                    disabled={complete}
                    style={complete
                      ? { borderColor: '#d9d9d9', color: '#9ca3af', cursor: 'not-allowed' }
                      : { borderColor: '#1faec2', color: '#0a0a0a' }}
                  >
                    {complete ? `Catálogo GLL completo (${groups.length}/68)` : 'Catálogo GLL'} {!complete && <DownOutlined />}
                  </Button>
                </Dropdown>
              )
              return complete ? (
                <Tooltip title="El catálogo GLL ya está completo. Volver a cargarlo duplicaría cuentas existentes. Si necesitas sincronizar propiedades, habilita el botón borrando algún grupo primero.">
                  {btn}
                </Tooltip>
              ) : btn
            })()}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openNew}
              style={{ background: '#1faec2' }}
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
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
          }}
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
