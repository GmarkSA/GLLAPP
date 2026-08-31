import { useState, useEffect } from 'react'
import {
  Card, Table, Button, Tag, Space, Form, Modal, Input,
  Switch, Typography, Popconfirm, message, Tooltip, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  KeyOutlined, CheckCircleOutlined, StopOutlined,
  LockOutlined, UnlockOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getUsers, createUser, updateUser, resetUserPassword, deleteUser,
  bloquearUser, desbloquearUser,
  type TenantUser,
} from '../../api/usuarios'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activo',    color: 'success' },
  inactive:  { label: 'Inactivo', color: 'default' },
  suspended: { label: 'Suspendido', color: 'error' },
  pending_verification: { label: 'Pendiente', color: 'warning' },
}

const bloqueoTemporal = (r: TenantUser) => !!r.lockedUntil && dayjs(r.lockedUntil).isAfter(dayjs())

export default function UsuariosPage() {
  const currentUserId = useAuthStore(s => s.user?.id)
  const me = useAuthStore(s => s.user)
  // Solo Super Admin administra usuarios (estilo SAP SU01) — el backend también lo exige
  const esAdmin = !!me?.isSuperAdmin || (me?.roles ?? []).some(r => ['superadmin', 'admin'].includes(r))

  const [users,   setUsers]   = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'create' | 'edit' | 'password' | null>(null)
  const [editing, setEditing] = useState<TenantUser | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [form]    = Form.useForm()
  const [pwForm]  = Form.useForm()

  const load = async () => {
    setLoading(true)
    try   { setUsers(await getUsers()) }
    catch { message.error('Error cargando usuarios') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (esAdmin) load() }, [])  // sin permiso no se consulta (evita 403 en consola)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ isSuperAdmin: false })
    setModal('create')
  }

  const openEdit = (u: TenantUser) => {
    setEditing(u)
    form.setFieldsValue({
      firstName:   u.firstName,
      lastName:    u.lastName,
      status:      u.status === 'active',
      isSuperAdmin: u.isSuperAdmin,
    })
    setModal('edit')
  }

  const openResetPassword = (u: TenantUser) => {
    setEditing(u)
    pwForm.resetFields()
    setModal('password')
  }

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      if (modal === 'create') {
        await createUser({
          firstName:   vals.firstName,
          lastName:    vals.lastName,
          email:       vals.email,
          password:    vals.password,
          isSuperAdmin: vals.isSuperAdmin ?? false,
        })
        message.success('Usuario creado')
      } else if (modal === 'edit' && editing) {
        await updateUser(editing.id, {
          firstName:   vals.firstName,
          lastName:    vals.lastName,
          status:      vals.status ? 'active' : 'inactive',
          isSuperAdmin: vals.isSuperAdmin,
        })
        message.success('Usuario actualizado')
      }
      setModal(null)
      load()
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? 'Error al guardar'
      message.error(Array.isArray(raw) ? raw.join(' · ') : String(raw), 6)
    } finally { setSaving(false) }
  }

  const handleResetPassword = async () => {
    try {
      const vals = await pwForm.validateFields()
      setSaving(true)
      await resetUserPassword(editing!.id, vals.newPassword)
      message.success('Contraseña actualizada — las sesiones activas fueron cerradas')
      setModal(null)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al cambiar contraseña')
    } finally { setSaving(false) }
  }

  const handleBloquear = async (id: string) => {
    try { await bloquearUser(id); message.success('Usuario bloqueado — sus sesiones fueron cerradas'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo bloquear', 6) }
  }

  const handleDesbloquear = async (id: string) => {
    try { await desbloquearUser(id); message.success('Usuario desbloqueado'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo desbloquear', 6) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id)
      message.success('Usuario eliminado')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se puede eliminar')
    }
  }

  const columns: ColumnsType<TenantUser> = [
    {
      title: 'Nombre',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.firstName} {r.lastName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
        </Space>
      ),
    },
    {
      title: 'Rol',
      dataIndex: 'isSuperAdmin',
      width: 130,
      render: (v: boolean) => v
        ? <Tag color="gold" style={{ fontSize: 11 }}>Superadmin</Tag>
        : <Tag color="#1faec2" style={{ fontSize: 11 }}>Usuario</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 190,
      render: (v: string, r) => {
        if (v === 'suspended') return <Tag color="error" style={{ fontSize: 11 }}>🚫 Bloqueado por admin</Tag>
        if (bloqueoTemporal(r)) {
          const min = Math.max(1, dayjs(r.lockedUntil).diff(dayjs(), 'minute') + 1)
          return (
            <Tooltip title={`${r.failedLoginAttempts ?? 0} intento(s) fallido(s) — se desbloquea solo o con el botón`}>
              <Tag color="warning" style={{ fontSize: 11 }}>🔒 Bloqueado · {min} min</Tag>
            </Tooltip>
          )
        }
        const s = STATUS_LABELS[v] ?? { label: v, color: 'default' }
        return (
          <Space size={4}>
            <Badge status={s.color as any} text={<Text style={{ fontSize: 12 }}>{s.label}</Text>} />
            {r.mustChangePassword && (
              <Tooltip title="Tiene una clave temporal asignada por el admin; deberá cambiarla al entrar">
                <Tag color="processing" style={{ fontSize: 10 }}>Clave temporal</Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Último acceso',
      dataIndex: 'lastLoginAt',
      width: 150,
      render: (v: string) => v
        ? <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>Sin acceso</Text>,
    },
    {
      title: '',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Editar">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Cambiar contraseña">
            <Button size="small" type="text" icon={<KeyOutlined />} onClick={() => openResetPassword(r)} />
          </Tooltip>
          {r.id !== currentUserId && r.status !== 'suspended' && !bloqueoTemporal(r) && (
            <Popconfirm
              title="¿Bloquear este usuario?"
              description="No podrá ingresar hasta que lo desbloquees; sus sesiones se cierran de inmediato."
              okText="Bloquear" cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleBloquear(r.id)}
            >
              <Tooltip title="Bloquear">
                <Button size="small" type="text" icon={<LockOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {(r.status === 'suspended' || bloqueoTemporal(r)) && (
            <Tooltip title="Desbloquear (no cambia la contraseña)">
              <Button size="small" type="text" style={{ color: '#2ea172' }} icon={<UnlockOutlined />} onClick={() => handleDesbloquear(r.id)} />
            </Tooltip>
          )}
          {r.id !== currentUserId && (
            <Popconfirm
              title="¿Eliminar este usuario?"
              description="Perderá acceso al sistema inmediatamente."
              okText="Eliminar" cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(r.id)}
            >
              <Tooltip title="Eliminar">
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  if (!esAdmin) {
    return (
      <Card bordered={false} style={{ borderRadius: 10, textAlign: 'center', padding: '32px 16px' }}>
        <LockOutlined style={{ fontSize: 28, color: '#9aa1ab' }} />
        <Title level={5} style={{ marginTop: 12 }}>Solo un Super Admin puede administrar usuarios</Title>
        <Text type="secondary">Pide a tu administrador que gestione altas, bloqueos y contraseñas.</Text>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Usuarios y Roles</Title>
          <Text type="secondary">Gestiona los usuarios con acceso a tu empresa</Text>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={openCreate}
          style={{ background: '#1faec2' }}
        >
          Nuevo usuario
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={false}
          locale={{ emptyText: 'Sin usuarios' }}
        />
      </Card>

      {/* Modal crear / editar */}
      <Modal
        title={modal === 'create' ? 'Nuevo usuario' : `Editar — ${editing?.firstName} ${editing?.lastName}`}
        open={modal === 'create' || modal === 'edit'}
        onCancel={() => { setModal(null); form.resetFields() }}
        onOk={handleSave}
        okText="Guardar"
        okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
        cancelText="Cancelar"
        width={460}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="firstName" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="César" />
            </Form.Item>
            <Form.Item name="lastName" label="Apellido" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Gómez" />
            </Form.Item>
          </div>
          {modal === 'create' && (
            <>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Requerido' },
                  { type: 'email', message: 'Email inválido' },
                ]}
              >
                <Input placeholder="correo@empresa.com" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Contraseña inicial"
                rules={[{ required: true, message: 'Requerido' }, { min: 6, message: 'Mínimo 6 caracteres' }]}
              >
                <Input.Password placeholder="Contraseña temporal" />
              </Form.Item>
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            {modal === 'edit' && (
              <Form.Item name="status" label="Activo" valuePropName="checked">
                <Switch
                  checkedChildren={<CheckCircleOutlined />}
                  unCheckedChildren={<StopOutlined />}
                />
              </Form.Item>
            )}
            <Form.Item name="isSuperAdmin" label="Superadmin" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Modal cambiar contraseña */}
      <Modal
        title={`Cambiar contraseña — ${editing?.firstName} ${editing?.lastName}`}
        open={modal === 'password'}
        onCancel={() => { setModal(null); pwForm.resetFields() }}
        onOk={handleResetPassword}
        okText="Cambiar contraseña"
        okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
        cancelText="Cancelar"
        width={400}
      >
        <Form form={pwForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item
            name="newPassword"
            label="Nueva contraseña"
            rules={[{ required: true, message: 'Requerido' }, { min: 6, message: 'Mínimo 6 caracteres' }]}
          >
            <Input.Password placeholder="Nueva contraseña" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirmar contraseña"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Requerido' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject('Las contraseñas no coinciden')
                },
              }),
            ]}
          >
            <Input.Password placeholder="Repetir contraseña" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
