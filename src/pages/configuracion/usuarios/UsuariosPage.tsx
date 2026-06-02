import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Tag, Avatar, Space, Typography, Modal, Form,
  Input, Select, Tooltip, Badge, Popconfirm, message, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, UserOutlined, CrownOutlined,
  TeamOutlined, BankOutlined, KeyOutlined, DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getUsers, getRoles, createUser, updateUser, deleteUser, type TenantUser, type RoleSummary } from '../../../api/usuarios'
import { companiesApi } from '../../../api/companies'
import type { Company } from '../../../store/authStore'

const { Title, Text } = Typography

export default function UsuariosPage() {
  const [users, setUsers]           = useState<TenantUser[]>([])
  const [roles, setRoles]           = useState<RoleSummary[]>([])
  const [companies, setCompanies]   = useState<Company[]>([])
  const [loading, setLoading]       = useState(false)
  const [modal, setModal]           = useState<'create' | 'edit' | 'companies' | null>(null)
  const [selected, setSelected]     = useState<TenantUser | null>(null)
  const [saving, setSaving]         = useState(false)
  const [form] = Form.useForm()

  // Para el modal de empresas — IDs asignadas al usuario seleccionado
  const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([])
  const [loadingAssigned, setLoadingAssigned]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, c, r] = await Promise.all([getUsers(), companiesApi.getAll(), getRoles().catch(() => [])])
      setUsers(Array.isArray(u) ? u : [])
      setCompanies(Array.isArray(c) ? c : [])
      setRoles(Array.isArray(r) ? r : [])
    } catch { message.error('Error al cargar usuarios') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setSelected(null)
    form.resetFields()
    setModal('create')
  }

  const openEdit = (u: TenantUser) => {
    setSelected(u)
    form.setFieldsValue({ firstName: u.firstName, lastName: u.lastName, status: u.status })
    setModal('edit')
  }

  const openCompanies = async (u: TenantUser) => {
    setSelected(u)
    setModal('companies')
    setLoadingAssigned(true)
    try {
      // Para cada empresa, verificar si el usuario está asignado
      const results = await Promise.all(
        companies.map(c =>
          companiesApi.getCompanyUsers(c.id)
            .then((cu: any[]) => cu.some((a: any) => a.userId === u.id) ? c.id : null)
            .catch(() => null),
        ),
      )
      setAssignedCompanyIds(results.filter(Boolean) as string[])
    } catch { setAssignedCompanyIds([]) }
    finally { setLoadingAssigned(false) }
  }

  const handleCreate = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await createUser({
        firstName: vals.firstName,
        lastName: vals.lastName,
        email: vals.email,
        password: vals.password,
      })
      message.success('Usuario creado')
      setModal(null)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al crear usuario')
    } finally { setSaving(false) }
  }

  const handleEdit = async () => {
    const vals = await form.validateFields()
    if (!selected) return
    setSaving(true)
    try {
      await updateUser(selected.id, {
        firstName: vals.firstName,
        lastName: vals.lastName,
        status: vals.status,
      })
      message.success('Usuario actualizado')
      setModal(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al actualizar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id)
      message.success('Usuario eliminado')
      load()
    } catch { message.error('Error al eliminar usuario') }
  }

  const handleToggleCompany = async (companyId: string, assign: boolean) => {
    if (!selected) return
    try {
      if (assign) {
        await companiesApi.assignUser(companyId, { userId: selected.id })
        setAssignedCompanyIds(prev => [...prev, companyId])
        message.success('Empresa asignada')
      } else {
        await companiesApi.removeCompanyUser(companyId, selected.id)
        setAssignedCompanyIds(prev => prev.filter(id => id !== companyId))
        message.success('Empresa removida')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al actualizar empresas')
    }
  }

  const columns: ColumnsType<TenantUser> = [
    {
      title: 'Usuario',
      render: (_, r) => (
        <Space>
          <Avatar style={{ background: '#1B3A6B', fontSize: 12 }} size={34}>
            {r.firstName?.[0]}{r.lastName?.[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.firstName} {r.lastName}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Rol',
      width: 220,
      render: (_, r) => r.isSuperAdmin
        ? <Tag color="red" icon={<CrownOutlined />}>Super Admin</Tag>
        : (r.roles?.length
          ? r.roles.map(role => <Tag key={role.id ?? role.name} color="blue" icon={<TeamOutlined />}>{role.name}</Tag>)
          : <Tag color="blue" icon={<TeamOutlined />}>Usuario</Tag>),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => (
        <Badge
          status={v === 'active' ? 'success' : v === 'suspended' ? 'warning' : 'default'}
          text={v === 'active' ? 'Activo' : v === 'suspended' ? 'Suspendido' : 'Inactivo'}
        />
      ),
    },
    {
      title: 'Último acceso',
      dataIndex: 'lastLoginAt',
      width: 150,
      render: (v?: string) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{new Date(v).toLocaleDateString('es-GT')}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Acciones',
      width: 130,
      render: (_, r) => (
        <Space>
          <Tooltip title="Editar usuario">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Asignar empresas">
            <Button size="small" icon={<BankOutlined />} onClick={() => openCompanies(r)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Popconfirm title="¿Eliminar este usuario?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Usuarios y Roles</Title>
          <Text type="secondary">Gestiona quién tiene acceso al tenant y a qué empresas</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#1B3A6B' }}>
          Nuevo usuario
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Sin usuarios' }}
      />

      {/* Modal crear usuario */}
      <Modal
        title={<Space><UserOutlined /> Nuevo usuario</Space>}
        open={modal === 'create'}
        onCancel={() => { setModal(null); form.resetFields() }}
        onOk={handleCreate}
        confirmLoading={saving}
        okText="Crear"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="firstName" label="Nombre" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Apellido" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Contraseña" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal editar usuario */}
      <Modal
        title={<Space><EditOutlined /> Editar usuario</Space>}
        open={modal === 'edit'}
        onCancel={() => setModal(null)}
        onOk={handleEdit}
        confirmLoading={saving}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="firstName" label="Nombre" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Apellido" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="status" label="Estado">
            <Select>
              <Select.Option value="active">Activo</Select.Option>
              <Select.Option value="inactive">Inactivo</Select.Option>
              <Select.Option value="suspended">Suspendido</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal asignar empresas */}
      <Modal
        title={<Space><BankOutlined /> Empresas — {selected?.firstName} {selected?.lastName}</Space>}
        open={modal === 'companies'}
        onCancel={() => setModal(null)}
        footer={<Button onClick={() => setModal(null)}>Cerrar</Button>}
        width={460}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Selecciona las empresas a las que tiene acceso:
        </Text>
        {loadingAssigned
          ? <div style={{ textAlign: 'center', padding: 24 }}>Cargando...</div>
          : companies.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #f5f5f5',
            }}>
              <Space>
                <BankOutlined style={{ color: '#1B3A6B' }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{c.legalName}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{c.countryCode} · {c.currencyCode}</Text>
                </div>
              </Space>
              <Checkbox
                checked={assignedCompanyIds.includes(c.id)}
                onChange={e => handleToggleCompany(c.id, e.target.checked)}
              />
            </div>
          ))
        }
      </Modal>

      {/* Mapa de roles */}
      <div style={{ marginTop: 24, padding: '14px 16px', background: '#f9f9fb', borderRadius: 8 }}>
        <Space style={{ marginBottom: 12 }}>
          <KeyOutlined />
          <strong>Mapa de roles y accesos</strong>
        </Space>
        <Table<RoleSummary>
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={roles}
          locale={{ emptyText: 'No hay roles configurados todavía' }}
          columns={[
            {
              title: 'Rol',
              width: 180,
              render: (_, role) => (
                <div>
                  <Tag color={role.name === 'admin' ? 'geekblue' : 'default'}>{role.name}</Tag>
                  {role.description && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{role.description}</div>}
                </div>
              ),
            },
            {
              title: 'Accesos',
              render: (_, role) => {
                const grouped = role.permissions.reduce<Record<string, Set<string>>>((acc, permission) => {
                  const key = `${permission.module}:${permission.submodule}`
                  if (!acc[key]) acc[key] = new Set()
                  acc[key].add(permission.action)
                  return acc
                }, {})
                return (
                  <Space size={[4, 4]} wrap>
                    {Object.entries(grouped).map(([scope, actions]) => (
                      <Tag key={scope} style={{ fontSize: 11 }}>
                        {scope.replace(':', ' / ')}: {Array.from(actions).join(', ')}
                      </Tag>
                    ))}
                  </Space>
                )
              },
            },
          ]}
        />
      </div>
    </div>
  )
}
