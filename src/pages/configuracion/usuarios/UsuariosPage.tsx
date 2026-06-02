import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Button, Tag, Avatar, Space, Typography, Modal, Form,
  Input, Select, Tooltip, Badge, Popconfirm, message, Checkbox,
  Tabs, Drawer, Divider, Empty, Spin,
} from 'antd'
import {
  PlusOutlined, EditOutlined, UserOutlined, CrownOutlined,
  TeamOutlined, BankOutlined, KeyOutlined, DeleteOutlined,
  LockOutlined, CheckSquareOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getUsers, getRoles, getPermissions, createUser, updateUser, deleteUser,
  createRole, updateRolePermissions, deleteRole,
  type TenantUser, type RoleSummary, type PermissionSummary,
} from '../../../api/usuarios'
import { companiesApi } from '../../../api/companies'
import type { Company } from '../../../store/authStore'

const { Title, Text } = Typography

// ── Labels de acciones ──────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  read:    'Ver',
  create:  'Crear',
  update:  'Editar',
  delete:  'Eliminar',
  export:  'Exportar',
  approve: 'Aprobar',
  send:    'Enviar',
  import:  'Importar',
}

const MODULE_LABELS: Record<string, string> = {
  ventas:        'Ventas',
  compras:       'Compras',
  contabilidad:  'Contabilidad',
  bancos:        'Bancos',
  inventario:    'Inventario',
  reportes:      'Reportes',
  configuracion: 'Configuración',
  platform:      'Plataforma',
}

const SUBMODULE_LABELS: Record<string, string> = {
  clientes: 'Clientes', estimaciones: 'Estimaciones', facturas: 'Facturas',
  'facturas-anticipo': 'Anticipos', 'notas-credito': 'Notas de crédito',
  'pagos-recibidos': 'Pagos recibidos', proveedores: 'Proveedores',
  'ordenes-compra': 'Órdenes de compra', 'facturas-proveedor': 'Facturas proveedor',
  'pagos-realizados': 'Pagos realizados', gastos: 'Gastos',
  catalogo: 'Catálogo', asientos: 'Asientos', 'libro-diario': 'Libro diario',
  'libro-mayor': 'Libro mayor', 'estados-financieros': 'Estados financieros',
  cuentas: 'Cuentas', conciliacion: 'Conciliación', transferencias: 'Transferencias',
  articulos: 'Artículos', almacenes: 'Almacenes', ubicaciones: 'Ubicaciones',
  movimientos: 'Movimientos', ajustes: 'Ajustes', importaciones: 'Importaciones',
  empresas: 'Empresas', usuarios: 'Usuarios', roles: 'Roles',
  perfil: 'Perfil', fiscal: 'Fiscal', impuestos: 'Impuestos',
  'libros-fiscales': 'Libros fiscales', monedas: 'Monedas',
  'cuentas-defecto': 'Cuentas por defecto', integraciones: 'Integraciones',
  seguridad: 'Seguridad', tenants: 'Tenants', planes: 'Planes',
  suscripciones: 'Suscripciones',
}

// Orden de acciones en columnas (las primeras 5 son fijas; el resto son "otros")
const MAIN_ACTIONS  = ['read', 'create', 'update', 'delete', 'export']
const EXTRA_ACTIONS = ['approve', 'send', 'import']

// ── Tipos internos ──────────────────────────────────────────────────────────

interface ModuleGroup {
  module:      string
  submodules:  SubmoduleRow[]
}

interface SubmoduleRow {
  submodule: string
  // action -> slug
  perms: Record<string, string>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMatrix(allPermissions: PermissionSummary[]): ModuleGroup[] {
  const map: Record<string, Record<string, Record<string, string>>> = {}
  for (const p of allPermissions) {
    if (!map[p.module]) map[p.module] = {}
    if (!map[p.module][p.submodule]) map[p.module][p.submodule] = {}
    map[p.module][p.submodule][p.action] = p.slug
  }
  return Object.entries(map).map(([module, subs]) => ({
    module,
    submodules: Object.entries(subs).map(([submodule, perms]) => ({ submodule, perms })),
  }))
}

// ── Componente principal ────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [users, setUsers]         = useState<TenantUser[]>([])
  const [roles, setRoles]         = useState<RoleSummary[]>([])
  const [allPerms, setAllPerms]   = useState<PermissionSummary[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [modal, setModal]         = useState<'create' | 'edit' | 'companies' | 'newRole' | null>(null)
  const [selected, setSelected]   = useState<TenantUser | null>(null)
  const [form] = Form.useForm()
  const [roleForm] = Form.useForm()

  // Asignación de empresas
  const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([])
  const [loadingAssigned, setLoadingAssigned]       = useState(false)

  // Editor de permisos de rol
  const [editingRole, setEditingRole]     = useState<RoleSummary | null>(null)
  const [checkedSlugs, setCheckedSlugs]   = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [savingPerms, setSavingPerms]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, c, r, p] = await Promise.all([
        getUsers(),
        companiesApi.getAll(),
        getRoles().catch(() => []),
        getPermissions().catch(() => []),
      ])
      setUsers(Array.isArray(u) ? u : [])
      setCompanies(Array.isArray(c) ? c : [])
      setRoles(Array.isArray(r) ? r : [])
      setAllPerms(Array.isArray(p) ? p : [])
    } catch { message.error('Error al cargar datos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const matrix = useMemo(() => buildMatrix(allPerms), [allPerms])

  // ── Handlers de usuarios ──────────────────────────────────────────────────

  const openCreate = () => {
    setSelected(null)
    form.resetFields()
    setModal('create')
  }

  const openEdit = (u: TenantUser) => {
    setSelected(u)
    form.setFieldsValue({
      firstName: u.firstName,
      lastName:  u.lastName,
      status:    u.status,
      roleIds:   u.roles?.map(r => r.id) ?? [],
    })
    setModal('edit')
  }

  const openCompanies = async (u: TenantUser) => {
    setSelected(u)
    setModal('companies')
    setLoadingAssigned(true)
    try {
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
        lastName:  vals.lastName,
        email:     vals.email,
        password:  vals.password,
        roleIds:   vals.roleIds ?? [],
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
        lastName:  vals.lastName,
        status:    vals.status,
        roleIds:   vals.roleIds ?? [],
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

  // ── Handlers de roles ─────────────────────────────────────────────────────

  const openRoleEditor = (role: RoleSummary) => {
    setEditingRole(role)
    setCheckedSlugs(new Set(role.permissions.map(p => p.slug)))
    setDrawerOpen(true)
  }

  const handleSavePerms = async () => {
    if (!editingRole) return
    setSavingPerms(true)
    try {
      const updated = await updateRolePermissions(editingRole.id, Array.from(checkedSlugs))
      message.success('Permisos guardados')
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
      setDrawerOpen(false)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar permisos')
    } finally { setSavingPerms(false) }
  }

  const handleCreateRole = async () => {
    const vals = await roleForm.validateFields()
    setSaving(true)
    try {
      await createRole({ name: vals.name, description: vals.description })
      message.success('Rol creado')
      setModal(null)
      roleForm.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al crear rol')
    } finally { setSaving(false) }
  }

  const handleDeleteRole = async (id: string) => {
    try {
      await deleteRole(id)
      message.success('Rol eliminado')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se puede eliminar este rol')
    }
  }

  // ── Checkbox helpers ──────────────────────────────────────────────────────

  const toggleSlug = (slug: string, checked: boolean) => {
    setCheckedSlugs(prev => {
      const next = new Set(prev)
      checked ? next.add(slug) : next.delete(slug)
      return next
    })
  }

  const toggleSubmodule = (row: SubmoduleRow, checked: boolean) => {
    setCheckedSlugs(prev => {
      const next = new Set(prev)
      Object.values(row.perms).forEach(slug => checked ? next.add(slug) : next.delete(slug))
      return next
    })
  }

  const toggleModule = (group: ModuleGroup, checked: boolean) => {
    setCheckedSlugs(prev => {
      const next = new Set(prev)
      group.submodules.forEach(row =>
        Object.values(row.perms).forEach(slug => checked ? next.add(slug) : next.delete(slug)),
      )
      return next
    })
  }

  const isSubmoduleComplete = (row: SubmoduleRow) =>
    Object.values(row.perms).every(slug => checkedSlugs.has(slug))

  const isSubmodulePartial = (row: SubmoduleRow) => {
    const vals = Object.values(row.perms)
    const checked = vals.filter(slug => checkedSlugs.has(slug)).length
    return checked > 0 && checked < vals.length
  }

  const isModuleComplete = (group: ModuleGroup) =>
    group.submodules.every(row => isSubmoduleComplete(row))

  const isModulePartial = (group: ModuleGroup) => {
    const complete = group.submodules.filter(r => isSubmoduleComplete(r)).length
    const partial  = group.submodules.some(r => isSubmodulePartial(r))
    return (complete > 0 && complete < group.submodules.length) || partial
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const userColumns: ColumnsType<TenantUser> = [
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
      width: 240,
      render: (_, r) => r.isSuperAdmin
        ? <Tag color="red" icon={<CrownOutlined />}>Super Admin</Tag>
        : (r.roles?.length
          ? r.roles.map(role => <Tag key={role.id} color="blue" icon={<TeamOutlined />}>{role.name}</Tag>)
          : <Tag color="default">Sin rol</Tag>),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
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
      width: 140,
      render: (v?: string) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{new Date(v).toLocaleDateString('es-GT')}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Acciones',
      width: 120,
      render: (_, r) => (
        <Space>
          <Tooltip title="Editar usuario">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Empresas asignadas">
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

  const roleColumns: ColumnsType<RoleSummary> = [
    {
      title: 'Rol',
      render: (_, r) => (
        <Space>
          <KeyOutlined style={{ color: '#1B3A6B' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
            {r.description && <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Tipo',
      width: 110,
      render: (_, r) => r.isSystem
        ? <Tag color="geekblue">Sistema</Tag>
        : <Tag color="green">Personalizado</Tag>,
    },
    {
      title: 'Permisos',
      width: 100,
      render: (_, r) => <Text type="secondary">{r.permissions.length} permisos</Text>,
    },
    {
      title: 'Usuarios',
      width: 100,
      render: (_, r) => {
        const count = users.filter(u => u.roles?.some(ur => ur.id === r.id)).length
        return <Text type="secondary">{count} usuario{count !== 1 ? 's' : ''}</Text>
      },
    },
    {
      title: 'Acciones',
      width: 120,
      render: (_, r) => (
        <Space>
          {r.name !== 'superadmin' && (
            <Tooltip title="Editar permisos">
              <Button size="small" icon={<CheckSquareOutlined />} onClick={() => openRoleEditor(r)} />
            </Tooltip>
          )}
          {!r.isSystem && (
            <Tooltip title="Eliminar rol">
              <Popconfirm title="¿Eliminar este rol?" onConfirm={() => handleDeleteRole(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Usuarios y Roles</Title>
        <Text type="secondary">Gestiona quién tiene acceso al tenant y qué puede hacer</Text>
      </div>

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key:   'users',
            label: <Space><UserOutlined />Usuarios</Space>,
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
                    style={{ background: '#1B3A6B' }}>
                    Nuevo usuario
                  </Button>
                </div>
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'Sin usuarios' }}
                />
              </>
            ),
          },
          {
            key:   'roles',
            label: <Space><LockOutlined />Roles</Space>,
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => { roleForm.resetFields(); setModal('newRole') }}
                    style={{ background: '#1B3A6B' }}>
                    Nuevo rol
                  </Button>
                </div>
                <Table
                  columns={roleColumns}
                  dataSource={roles}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'Sin roles' }}
                />
              </>
            ),
          },
        ]}
      />

      {/* Modal crear usuario */}
      <Modal
        title={<Space><UserOutlined />Nuevo usuario</Space>}
        open={modal === 'create'}
        onCancel={() => { setModal(null); form.resetFields() }}
        onOk={handleCreate}
        confirmLoading={saving}
        okText="Crear"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={480}
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
          <Form.Item name="roleIds" label="Rol">
            <Select mode="multiple" placeholder="Selecciona rol(es)"
              options={roles.filter(r => r.name !== 'superadmin').map(r => ({
                value: r.id, label: r.name,
              }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal editar usuario */}
      <Modal
        title={<Space><EditOutlined />Editar usuario</Space>}
        open={modal === 'edit'}
        onCancel={() => setModal(null)}
        onOk={handleEdit}
        confirmLoading={saving}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={480}
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
            <Select options={[
              { value: 'active',    label: 'Activo' },
              { value: 'inactive',  label: 'Inactivo' },
              { value: 'suspended', label: 'Suspendido' },
            ]} />
          </Form.Item>
          <Form.Item name="roleIds" label="Rol">
            <Select mode="multiple" placeholder="Selecciona rol(es)"
              options={roles.filter(r => r.name !== 'superadmin').map(r => ({
                value: r.id, label: r.name,
              }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal asignar empresas */}
      <Modal
        title={<Space><BankOutlined />Empresas — {selected?.firstName} {selected?.lastName}</Space>}
        open={modal === 'companies'}
        onCancel={() => setModal(null)}
        footer={<Button onClick={() => setModal(null)}>Cerrar</Button>}
        width={460}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Selecciona las empresas a las que tiene acceso:
        </Text>
        {loadingAssigned
          ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
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

      {/* Modal nuevo rol */}
      <Modal
        title={<Space><KeyOutlined />Nuevo rol</Space>}
        open={modal === 'newRole'}
        onCancel={() => setModal(null)}
        onOk={handleCreateRole}
        confirmLoading={saving}
        okText="Crear"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={roleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Nombre del rol" rules={[{ required: true }]}>
            <Input placeholder="ej: supervisor" />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} placeholder="Describe qué puede hacer este rol" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer editor de permisos (estilo Zoho) */}
      <Drawer
        title={
          <Space>
            <LockOutlined />
            <span>Permisos — <strong>{editingRole?.name}</strong></span>
            {editingRole?.isSystem && <Tag color="geekblue" style={{ marginLeft: 4 }}>Sistema</Tag>}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
        extra={
          editingRole?.name !== 'superadmin' && (
            <Button type="primary" loading={savingPerms} onClick={handleSavePerms}
              style={{ background: '#1B3A6B' }}>
              Guardar permisos
            </Button>
          )
        }
      >
        {editingRole?.name === 'superadmin' ? (
          <Empty description="El rol superadmin tiene acceso total y no puede modificarse." />
        ) : (
          <div>
            {matrix.length === 0 && <Spin />}
            {matrix.map(group => (
              <div key={group.module} style={{ marginBottom: 24 }}>
                {/* Cabecera de módulo */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#f0f4ff', padding: '8px 12px', borderRadius: 6,
                  marginBottom: 4,
                }}>
                  <Checkbox
                    checked={isModuleComplete(group)}
                    indeterminate={!isModuleComplete(group) && isModulePartial(group)}
                    onChange={e => toggleModule(group, e.target.checked)}
                  />
                  <Text strong style={{ color: '#1B3A6B', fontSize: 13 }}>
                    {MODULE_LABELS[group.module] ?? group.module}
                  </Text>
                </div>

                {/* Tabla de submodulos */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={thStyle}>Módulo</th>
                      <th style={{ ...thStyle, width: 56, textAlign: 'center' }}>Todo</th>
                      {MAIN_ACTIONS.map(a => (
                        <th key={a} style={{ ...thStyle, width: 72, textAlign: 'center' }}>
                          {ACTION_LABELS[a]}
                        </th>
                      ))}
                      <th style={{ ...thStyle, minWidth: 120 }}>Otros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.submodules.map((row, idx) => {
                      const extras = EXTRA_ACTIONS.filter(a => row.perms[a])
                      return (
                        <tr key={row.submodule}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={tdStyle}>
                            {SUBMODULE_LABELS[row.submodule] ?? row.submodule}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Checkbox
                              checked={isSubmoduleComplete(row)}
                              indeterminate={isSubmodulePartial(row)}
                              onChange={e => toggleSubmodule(row, e.target.checked)}
                            />
                          </td>
                          {MAIN_ACTIONS.map(action => (
                            <td key={action} style={{ ...tdStyle, textAlign: 'center' }}>
                              {row.perms[action] ? (
                                <Checkbox
                                  checked={checkedSlugs.has(row.perms[action])}
                                  onChange={e => toggleSlug(row.perms[action], e.target.checked)}
                                />
                              ) : <span style={{ color: '#d9d9d9' }}>—</span>}
                            </td>
                          ))}
                          <td style={tdStyle}>
                            {extras.length > 0
                              ? <Space size={4} wrap>
                                {extras.map(a => (
                                  <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                    <Checkbox
                                      checked={checkedSlugs.has(row.perms[a])}
                                      onChange={e => toggleSlug(row.perms[a], e.target.checked)}
                                    />
                                    <span style={{ fontSize: 11 }}>{ACTION_LABELS[a]}</span>
                                  </label>
                                ))}
                              </Space>
                              : <span style={{ color: '#d9d9d9', fontSize: 11 }}>—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <Divider style={{ margin: '12px 0' }} />
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#555',
  borderBottom: '1px solid #e8e8e8',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle',
}
