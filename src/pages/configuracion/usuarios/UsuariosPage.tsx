import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Button, Tag, Avatar, Space, Typography, Modal, Form,
  Input, Select, Tooltip, Badge, Popconfirm, message, Checkbox,
  Tabs, Divider, Empty, Spin, Collapse, Switch, Alert,
} from 'antd'
import {
  PlusOutlined, EditOutlined, UserOutlined, CrownOutlined,
  TeamOutlined, BankOutlined, KeyOutlined, DeleteOutlined,
  LockOutlined, SettingOutlined, SaveOutlined, UnlockOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getUsers, getRoles, getPermissions, createUser, updateUser, deleteUser,
  resetUserPassword, bloquearUser, desbloquearUser,
  createRole, updateRolePermissions, deleteRole,
  type TenantUser, type RoleSummary, type PermissionSummary,
} from '../../../api/usuarios'
import { companiesApi } from '../../../api/companies'
import { getBillingState } from '../../../api/billing'
import type { Company } from '../../../store/authStore'
import { useAuthStore } from '../../../store/authStore'

const ROLE_ORDER = ['superadmin', 'admin', 'contador', 'ventas', 'compras', 'planillas', 'tesoreria', 'cajero', 'lector', 'inventario']
const sortRoles = (list: RoleSummary[]) =>
  [...list].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.name.toLowerCase())
    const bi = ROLE_ORDER.indexOf(b.name.toLowerCase())
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

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
  bancos:        'Bancos y Tesorería',
  contabilidad:  'Contabilidad',
  inventario:    'Inventario',
  planillas:     'Planillas',
  proyectos:     'Proyectos',
  reportes:      'Reportes',
  configuracion: 'Configuración',
  fel:           'FEL',
  platform:      'Plataforma',
}

// Etiquetas genéricas por submodulo (aplica en todos los módulos)
const SUBMODULE_LABELS: Record<string, string> = {
  '_': 'General',
  // ventas
  clientes:              'Clientes',
  estimaciones:          'Cotizaciones',
  facturas:              'Facturas',
  'facturas-recurrentes': 'Facturas recurrentes',
  'notas-credito':       'Notas de crédito',
  pagos:                 'Pagos',
  'dte-sat':             'DTE SAT',
  // compras
  proveedores:           'Proveedores',
  oc:                    'Órdenes de compra',
  anticipos:             'Anticipos a proveedores',
  gastos:                'Gastos',
  // bancos
  cuentas:               'Cuentas bancarias',
  'pagos-realizados':    'Pagos a proveedores',
  'lote-cheques':        'Lote de cheques',
  config:                'Config. cheques y ACH',
  conciliacion:          'Conciliación',
  transferencias:        'Transferencias',
  // contabilidad
  catalogo:              'Catálogo de cuentas',
  asientos:              'Diarios manuales',
  'diarios-recurrentes': 'Diarios recurrentes',
  'activos-fijos':       'Activos fijos',
  'clases-activo-fijo':  'Clases de activo fijo',
  presupuesto:           'Presupuestos',
  'ajuste-moneda':       'Ajustes de moneda',
  'bloqueo-transacciones': 'Bloqueo de transacciones',
  'centros-costo':       'Centros de costo',
  'centros-beneficio':   'Centros de beneficio',
  // inventario
  articulos:             'Artículos',
  grupos:                'Grupos de artículos',
  almacenes:             'Almacenes',
  entregas:              'Entregas',
  expedientes:           'Expediente de importación',
  produccion:            'Producción',
  ubicaciones:           'Ubicación / POS',
  movimientos:           'Movimientos MIGO',
  // planillas
  corridas:              'Corridas de planilla',
  empleados:             'Empleados',
  finiquitos:            'Finiquitos',
  'parametros-fiscales': 'Parámetros fiscales',
  'datos-patrono':       'Datos del patrono',
  'cuentas-contables':   'Cuentas contables',
  'centros-trabajo':     'Centros de trabajo',
  // proyectos
  tareas:                'Tareas',
  // reportes
  'balance-general':     'Balance General',
  'estado-resultados':   'Estado de Resultados',
  'flujo-efectivo':      'Flujo de Caja',
  'tasas-rendimiento':   'Tasas de Rendimiento',
  'movimiento-capital':  'Movimiento de Capital',
  balanza:               'Balanza de Comprobación',
  'libro-diario':        'Libro Diario',
  'libro-compras':       'Libro de Compras',
  'libro-ventas':        'Libro de Ventas',
  'ap-aging':            'AP Aging (CxP)',
  'ar-aging':            'AR Aging (CxC)',
  'proyectado-pagos':    'Proyectado de Pagos',
  // configuracion
  general:               'General',
  empresas:              'Empresas',
  sucursales:            'Sucursales',
  series:                'Series de documentos',
  'facturacion-electronica': 'Facturación Electrónica',
  'bancos-perfiles':     'Perfiles bancarios',
  'unidades-medida':     'Unidades de medida',
  monedas:               'Monedas',
  integraciones:         'Integraciones',
  apikeys:               'API Keys',
  // platform
  tenants:               'Tenants',
  planes:                'Planes',
  suscripciones:         'Suscripciones',
}

// Etiquetas módulo:submodulo para resolver ambigüedades (mismo submodulo en varios módulos)
const MODULE_SUBMODULE_LABELS: Record<string, string> = {
  'ventas:pagos':          'Pagos recibidos',
  'ventas:dte-sat':        'DTE SAT Emitidos',
  'ventas:notas-credito':  'Notas de crédito cliente',
  'compras:pagos':         'Pagos a proveedores',
  'compras:dte-sat':       'DTE SAT Recibidos',
  'compras:notas-credito': 'Notas de crédito proveedor',
  'reportes:activos-fijos':     'Reporte Activos fijos',
  'reportes:centros-beneficio': 'Rentabilidad C. Beneficio',
  'reportes:centros-costo':     'Ejecución C. Costo',
}

// Orden de acciones en columnas (las primeras 5 son fijas; el resto son "otros")
const MAIN_ACTIONS  = ['read', 'create', 'update', 'delete', 'export']
const EXTRA_ACTIONS = ['approve', 'send', 'import', 'manage', 'certify', 'cancel', 'write', 'admin']

// Orden de módulos y submodulos — coincide con el sidebar
const MODULE_ORDER: Record<string, string[]> = {
  ventas:        ['clientes', 'estimaciones', 'facturas', 'facturas-recurrentes', 'notas-credito', 'pagos', 'dte-sat'],
  compras:       ['proveedores', 'oc', 'facturas', 'notas-credito', 'dte-sat', 'anticipos', 'pagos', 'gastos'],
  bancos:        ['cuentas', 'pagos-realizados', 'lote-cheques', 'config', 'conciliacion', 'transferencias'],
  contabilidad:  ['catalogo', 'asientos', 'diarios-recurrentes', 'activos-fijos', 'clases-activo-fijo', 'presupuesto', 'ajuste-moneda', 'bloqueo-transacciones', 'centros-costo', 'centros-beneficio', '_'],
  inventario:    ['articulos', 'grupos', 'almacenes', 'entregas', 'expedientes', 'produccion', 'ubicaciones', 'movimientos'],
  planillas:     ['corridas', 'empleados', 'finiquitos', 'parametros-fiscales', 'datos-patrono', 'cuentas-contables', 'centros-trabajo'],
  proyectos:     ['_', 'tareas'],
  reportes:      ['balance-general', 'estado-resultados', 'flujo-efectivo', 'tasas-rendimiento', 'movimiento-capital', 'balanza', 'libro-diario', 'libro-compras', 'libro-ventas', 'ap-aging', 'ar-aging', 'proyectado-pagos', 'activos-fijos', 'centros-beneficio', 'centros-costo'],
  configuracion: ['general', 'empresas', 'sucursales', 'series', 'facturacion-electronica', 'bancos-perfiles', 'unidades-medida', 'monedas', 'integraciones', 'apikeys'],
  fel:           ['_'],
}

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
  const moduleOrder = Object.keys(MODULE_ORDER)
  return Object.entries(map)
    .sort(([a], [b]) => {
      const ia = moduleOrder.indexOf(a), ib = moduleOrder.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    .map(([module, subs]) => {
      const subOrder = MODULE_ORDER[module] ?? []
      const sorted = Object.entries(subs).sort(([a], [b]) => {
        const ia = subOrder.indexOf(a), ib = subOrder.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      return { module, submodules: sorted.map(([submodule, perms]) => ({ submodule, perms })) }
    })
}

// ── Componente principal ────────────────────────────────────────────────────

const bloqueoTemporal = (r: TenantUser) => !!r.lockedUntil && new Date(r.lockedUntil).getTime() > Date.now()
const minutosBloqueo   = (r: TenantUser) => Math.max(1, Math.ceil((new Date(r.lockedUntil as string).getTime() - Date.now()) / 60000))

export default function UsuariosPage() {
  const soySuperAdmin = !!useAuthStore(s => s.user?.isSuperAdmin)
  const me = useAuthStore(s => s.user)
  // Solo Super Admin administra usuarios (estilo SAP SU01) — el backend también lo exige
  const esAdmin = soySuperAdmin || (me?.roles ?? []).some(r => ['superadmin', 'admin'].includes(r))
  const [users, setUsers]         = useState<TenantUser[]>([])
  const [roles, setRoles]         = useState<RoleSummary[]>([])
  const [allPerms, setAllPerms]   = useState<PermissionSummary[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [maxUsers, setMaxUsers]   = useState<number>(Infinity)
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [modal, setModal]         = useState<'create' | 'edit' | 'companies' | 'newRole' | 'password' | null>(null)
  const [selected, setSelected]   = useState<TenantUser | null>(null)
  const [form] = Form.useForm()
  const [pwForm] = Form.useForm()
  const [roleForm] = Form.useForm()

  // Asignación de empresas
  const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([])
  const [loadingAssigned, setLoadingAssigned]       = useState(false)
  // moduleOverrides por empresa: companyId → { module: 'full'|'read'|'none' }
  const [companyOverrides, setCompanyOverrides] = useState<Record<string, Record<string, 'full' | 'read' | 'none'>>>({})
  const [savingOverride, setSavingOverride]     = useState<string | null>(null) // companyId saving

  // Dropdown de roles (se cierra tras cada selección)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)

  // Editor de permisos de rol
  const [editingRole, setEditingRole]     = useState<RoleSummary | null>(null)
  const [checkedSlugs, setCheckedSlugs]   = useState<Set<string>>(new Set())
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
    getBillingState()
      .then(b => {
        const plan = b.plans.find(pl => pl.plan === b.subscription?.plan)
        if (plan?.maxUsers) setMaxUsers(plan.maxUsers)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (roles.length > 0 && !editingRole) {
      const first = roles[0]
      setEditingRole(first)
      setCheckedSlugs(new Set(first.permissions.map(p => p.slug)))
    }
  }, [roles, editingRole])

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
      isSuperAdmin: u.isSuperAdmin,
    })
    setModal('edit')
  }

  const openCompanies = async (u: TenantUser) => {
    setSelected(u)
    setModal('companies')
    setLoadingAssigned(true)
    setCompanyOverrides({})
    try {
      const results = await Promise.all(
        companies.map(async c => {
          const cu: any[] = await companiesApi.getCompanyUsers(c.id).catch(() => [])
          const entry = cu.find((a: any) => a.userId === u.id)
          if (entry) {
            setCompanyOverrides(prev => ({ ...prev, [c.id]: entry.moduleOverrides ?? {} }))
            return c.id
          }
          return null
        }),
      )
      setAssignedCompanyIds(results.filter(Boolean) as string[])
    } catch { setAssignedCompanyIds([]) }
    finally { setLoadingAssigned(false) }
  }

  const handleCreate = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      const invitar = vals.invitar !== false
      await createUser({
        firstName: vals.firstName,
        lastName:  vals.lastName,
        email:     vals.email,
        ...(invitar ? { sendInvitation: true } : { password: vals.password }),
        roleIds:   vals.roleIds ?? [],
        ...(soySuperAdmin ? { isSuperAdmin: vals.isSuperAdmin ?? false } : {}),
      })
      message.success(invitar ? 'Invitación enviada por correo' : 'Usuario creado')
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
        ...(soySuperAdmin ? { isSuperAdmin: vals.isSuperAdmin ?? false } : {}),
      })
      message.success('Usuario actualizado')
      setModal(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al actualizar')
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

  const openResetPassword = (u: TenantUser) => { setSelected(u); pwForm.resetFields(); setModal('password') }

  const handleResetPassword = async () => {
    try {
      const vals = await pwForm.validateFields()
      setSaving(true)
      await resetUserPassword(selected!.id, vals.newPassword)
      message.success('Contraseña temporal asignada — el usuario deberá cambiarla al entrar y sus sesiones fueron cerradas', 6)
      setModal(null); load()
    } catch (e: any) {
      const raw = e?.response?.data?.message
      if (raw) message.error(Array.isArray(raw) ? raw.join(' · ') : String(raw), 6)
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
        setCompanyOverrides(prev => ({ ...prev, [companyId]: {} }))
        message.success('Empresa asignada')
      } else {
        await companiesApi.removeCompanyUser(companyId, selected.id)
        setAssignedCompanyIds(prev => prev.filter(id => id !== companyId))
        setCompanyOverrides(prev => { const n = { ...prev }; delete n[companyId]; return n })
        message.success('Empresa removida')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al actualizar empresas')
    }
  }

  const handleSaveModuleOverride = async (companyId: string, mod: string, val: 'full' | 'read' | 'none') => {
    if (!selected) return
    const updated = { ...(companyOverrides[companyId] ?? {}), [mod]: val }
    setCompanyOverrides(prev => ({ ...prev, [companyId]: updated }))
    setSavingOverride(companyId)
    try {
      await companiesApi.updateCompanyUser(companyId, selected.id, { moduleOverrides: updated })
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar permiso')
    } finally { setSavingOverride(null) }
  }

  // ── Handlers de roles ─────────────────────────────────────────────────────

  const selectRole = (role: RoleSummary) => {
    setEditingRole(role)
    setCheckedSlugs(new Set(role.permissions.map(p => p.slug)))
  }

  const handleSavePerms = async () => {
    if (!editingRole) return
    setSavingPerms(true)
    try {
      const updated = await updateRolePermissions(editingRole.id, Array.from(checkedSlugs))
      message.success('Permisos guardados')
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
      setEditingRole(updated)
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
          <Avatar style={{ background: '#1faec2', fontSize: 12 }} size={34}>
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
      render: (_, r) => r.roles?.length
        ? r.roles.map(role => <Tag key={role.id} color="#1faec2" icon={<TeamOutlined />}>{role.name}</Tag>)
        : r.isSuperAdmin
          ? <Tag color="#e5484d" icon={<CrownOutlined />}>Super Admin</Tag>
          : <Tag color="default">Sin rol</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 190,
      render: (v: string, r) => {
        if (v === 'suspended') return <Tag color="error" style={{ fontSize: 11 }}>🚫 Bloqueado por admin</Tag>
        if (bloqueoTemporal(r)) return (
          <Tooltip title={`${r.failedLoginAttempts ?? 0} intento(s) fallido(s) — se desbloquea solo o con el botón`}>
            <Tag color="warning" style={{ fontSize: 11 }}>🔒 Bloqueado · {minutosBloqueo(r)} min</Tag>
          </Tooltip>
        )
        return (
          <Space size={4}>
            <Badge
              status={v === 'active' ? 'success' : v === 'pending_verification' ? 'warning' : 'default'}
              text={v === 'active' ? 'Activo' : v === 'pending_verification' ? 'Pendiente' : 'Inactivo'}
            />
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
          <Tooltip title="Cambiar contraseña (queda como temporal)">
            <Button size="small" icon={<KeyOutlined />} onClick={() => openResetPassword(r)} />
          </Tooltip>
          {r.id !== me?.id && r.status !== 'suspended' && !bloqueoTemporal(r) && (
            <Popconfirm
              title="¿Bloquear este usuario?"
              description="No podrá ingresar hasta que lo desbloquees; sus sesiones se cierran de inmediato."
              okText="Bloquear" cancelText="Cancelar" okButtonProps={{ danger: true }}
              onConfirm={() => handleBloquear(r.id)}
            >
              <Tooltip title="Bloquear">
                <Button size="small" icon={<LockOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {(r.status === 'suspended' || bloqueoTemporal(r)) && (
            <Tooltip title="Desbloquear (no cambia la contraseña)">
              <Button size="small" style={{ color: '#2ea172', borderColor: '#2ea172' }} icon={<UnlockOutlined />} onClick={() => handleDesbloquear(r.id)} />
            </Tooltip>
          )}
          <Tooltip title="Eliminar">
            <Popconfirm title="¿Eliminar este usuario?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────


  if (!esAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px' }}>
        <LockOutlined style={{ fontSize: 28, color: '#9aa1ab' }} />
        <Title level={5} style={{ marginTop: 12 }}>Solo un Super Admin puede administrar usuarios</Title>
        <Text type="secondary">Pide a tu administrador que gestione altas, bloqueos y contraseñas.</Text>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <TeamOutlined style={{ fontSize: 22, color: '#1faec2' }} />
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Usuarios y Roles</Title>
          <Text type="secondary">Gestiona quién tiene acceso al tenant y qué puede hacer</Text>
        </div>
      </div>

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key:   'users',
            label: <Space><UserOutlined />Usuarios</Space>,
            children: (
              <>
                {users.length >= maxUsers && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`Límite de usuarios alcanzado (${users.length}/${maxUsers})`}
                    description={
                      <span>
                        Tu plan actual no permite agregar más usuarios.{' '}
                        <a href="/billing/subscription">Actualiza tu suscripción</a> para desbloquear más.
                      </span>
                    }
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Tooltip title={users.length >= maxUsers ? `Límite de ${maxUsers} usuario${maxUsers !== 1 ? 's' : ''} alcanzado` : undefined}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
                      disabled={users.length >= maxUsers}
                      style={{ background: users.length >= maxUsers ? undefined : '#1faec2' }}>
                      Nuevo usuario
                    </Button>
                  </Tooltip>
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
                    style={{ background: '#1faec2' }}>
                    Nuevo rol
                  </Button>
                </div>
                <Tabs
                  type="card"
                  activeKey={editingRole?.id}
                  onChange={key => { const r = roles.find(x => x.id === key); if (r) selectRole(r) }}
                  items={sortRoles(roles).map(role => {
                    const userCount = users.filter(u => u.roles?.some(ur => ur.id === role.id)).length
                    const isActive  = editingRole?.id === role.id
                    return {
                      key:   role.id,
                      label: (
                        <Space size={4}>
                          <span style={{ textTransform: 'capitalize' }}>{role.name}</span>
                          {role.isSystem
                            ? <Tag color="#1faec2" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>S</Tag>
                            : <Tag color="#2ea172" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>C</Tag>}
                        </Space>
                      ),
                      children: (
                        <div>
                          {/* Cabecera del rol */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                              <Text strong style={{ fontSize: 15, textTransform: 'capitalize' }}>{role.name}</Text>
                              {role.description && (
                                <Text type="secondary" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{role.description}</Text>
                              )}
                              <Space style={{ marginTop: 6 }}>
                                <Tag color={role.isSystem ? '#1faec2' : '#2ea172'}>{role.isSystem ? 'Sistema' : 'Personalizado'}</Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>{role.permissions.length} permisos</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>{userCount} usuario{userCount !== 1 ? 's' : ''}</Text>
                              </Space>
                            </div>
                            <Space>
                              {!role.isSystem && (
                                <Popconfirm title="¿Eliminar este rol?" onConfirm={() => handleDeleteRole(role.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />}>Eliminar</Button>
                                </Popconfirm>
                              )}
                              {role.name !== 'superadmin' && (
                                <Button type="primary" size="small" loading={savingPerms} onClick={handleSavePerms}
                                  icon={<SaveOutlined />} style={{ background: '#1faec2' }}>
                                  Guardar permisos
                                </Button>
                              )}
                            </Space>
                          </div>

                          {/* Matriz de permisos */}
                          {role.name === 'superadmin' ? (
                            <Empty description="El rol superadmin tiene acceso total y no puede modificarse." />
                          ) : isActive ? (
                            matrix.length === 0 ? <Spin /> : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
                            {matrix.map(group => (
                              <div key={group.module} style={{ marginBottom: 20 }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  background: '#f0f4ff', padding: '8px 12px', borderRadius: 6, marginBottom: 4,
                                }}>
                                  <Checkbox
                                    checked={isModuleComplete(group)}
                                    indeterminate={!isModuleComplete(group) && isModulePartial(group)}
                                    onChange={e => toggleModule(group, e.target.checked)}
                                  />
                                  <Text strong style={{ color: '#1faec2', fontSize: 13 }}>
                                    {MODULE_LABELS[group.module] ?? group.module}
                                  </Text>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: '#fafbfc' }}>
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
                                        <tr key={row.submodule} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                          <td style={tdStyle}>{MODULE_SUBMODULE_LABELS[`${group.module}:${row.submodule}`] ?? SUBMODULE_LABELS[row.submodule] ?? row.submodule}</td>
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
                                              ) : <span style={{ color: '#9aa1ab' }}>—</span>}
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
                                              : <span style={{ color: '#9aa1ab', fontSize: 11 }}>—</span>}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                                <Divider style={{ margin: '10px 0' }} />
                              </div>
                            ))}
                            </div>)
                          ) : null}
                        </div>
                      ),
                    }
                  })}
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
        okButtonProps={{ style: { background: '#1faec2' } }}
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
          <Form.Item name="invitar" valuePropName="checked" initialValue={true} style={{ marginBottom: 8 }}>
            <Checkbox>Enviar invitación por correo — el usuario define su propia contraseña</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.invitar !== cur.invitar}>
            {({ getFieldValue }) => getFieldValue('invitar') === false ? (
              <Form.Item name="password" label="Contraseña" rules={[{ required: true, min: 8, message: 'Mínimo 8 caracteres' }]}>
                <Input.Password />
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item name="roleIds" label="Rol">
            <Select mode="multiple" placeholder="Selecciona rol(es)"
              open={roleDropdownOpen}
              onOpenChange={setRoleDropdownOpen}
              onSelect={() => setRoleDropdownOpen(false)}
              options={roles.filter(r => r.name !== 'superadmin').map(r => ({
                value: r.id, label: r.name,
              }))} />
          </Form.Item>
          {soySuperAdmin && (
            <Form.Item
              name="isSuperAdmin"
              label={<Space><CrownOutlined style={{ color: '#e5484d' }} />Super Admin de plataforma</Space>}
              valuePropName="checked"
              initialValue={false}
              tooltip="Acceso total a la administración de la plataforma (todos los tenants). Otórgalo solo a personas de confianza."
            >
              <Switch />
            </Form.Item>
          )}
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
        okButtonProps={{ style: { background: '#1faec2' } }}
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
              { value: 'suspended', label: 'Bloqueado por admin' },
              { value: 'pending_verification', label: 'Pendiente de activación (aún no define su contraseña)', disabled: true },
            ]} />
          </Form.Item>
          <Form.Item name="roleIds" label="Rol">
            <Select mode="multiple" placeholder="Selecciona rol(es)"
              open={roleDropdownOpen}
              onOpenChange={setRoleDropdownOpen}
              onSelect={() => setRoleDropdownOpen(false)}
              options={roles.filter(r => r.name !== 'superadmin').map(r => ({
                value: r.id, label: r.name,
              }))} />
          </Form.Item>
          {soySuperAdmin && (
            <Form.Item
              name="isSuperAdmin"
              label={<Space><CrownOutlined style={{ color: '#e5484d' }} />Super Admin de plataforma</Space>}
              valuePropName="checked"
              tooltip="Acceso total a la administración de la plataforma (todos los tenants). Otórgalo solo a personas de confianza."
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Modal asignar empresas + moduleOverrides */}
      <Modal
        title={<Space><BankOutlined />Empresas — {selected?.firstName} {selected?.lastName}</Space>}
        open={modal === 'companies'}
        onCancel={() => setModal(null)}
        footer={<Button onClick={() => setModal(null)}>Cerrar</Button>}
        width={560}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Activa las empresas y ajusta el acceso por módulo para este usuario:
        </Text>
        {loadingAssigned
          ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          : companies.map(c => {
              const assigned = assignedCompanyIds.includes(c.id)
              const overrides = companyOverrides[c.id] ?? {}
              const moduleItems = Object.entries(MODULE_LABELS).filter(([k]) => k !== 'platform')
              return (
                <div key={c.id} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)', paddingBottom: 8, marginBottom: 8 }}>
                  {/* Fila empresa + checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                    <Space>
                      <BankOutlined style={{ color: '#1faec2' }} />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.legalName}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{c.countryCode} · {c.currencyCode}</Text>
                      </div>
                    </Space>
                    <Checkbox
                      checked={assigned}
                      onChange={e => handleToggleCompany(c.id, e.target.checked)}
                    />
                  </div>
                  {/* Panel de módulos — solo si está asignado */}
                  {assigned && (
                    <Collapse
                      ghost
                      size="small"
                      items={[{
                        key: 'mods',
                        label: (
                          <Space style={{ color: '#666', fontSize: 12 }}>
                            <SettingOutlined />
                            Acceso por módulo
                            {savingOverride === c.id && <Spin size="small" />}
                          </Space>
                        ),
                        children: (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', paddingTop: 4 }}>
                            {moduleItems.map(([mod, label]) => (
                              <div key={mod} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: '#444' }}>{label}</span>
                                <Select
                                  size="small"
                                  style={{ width: 120 }}
                                  value={overrides[mod] ?? 'full'}
                                  onChange={(val: 'full' | 'read' | 'none') => handleSaveModuleOverride(c.id, mod, val)}
                                  options={[
                                    { value: 'full',  label: 'Completo' },
                                    { value: 'read',  label: 'Solo lectura' },
                                    { value: 'none',  label: 'Sin acceso' },
                                  ]}
                                />
                              </div>
                            ))}
                          </div>
                        ),
                      }]}
                    />
                  )}
                </div>
              )
            })
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
        okButtonProps={{ style: { background: '#1faec2' } }}
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

      {/* Modal: contraseña temporal (estilo SAP — el usuario deberá cambiarla al entrar) */}
      <Modal
        title={`Cambiar contraseña — ${selected?.firstName ?? ''} ${selected?.lastName ?? ''}`}
        open={modal === 'password'}
        onCancel={() => setModal(null)}
        onOk={handleResetPassword}
        okText="Asignar contraseña temporal"
        okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
        cancelText="Cancelar"
        width={420}
      >
        <Form form={pwForm} layout="vertical" size="middle" style={{ marginTop: 8 }}>
          <Form.Item name="newPassword" label="Nueva contraseña temporal"
            rules={[{ required: true, message: 'Requerida' }, { min: 8, message: 'Mínimo 8 caracteres' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            El usuario quedará activo y desbloqueado, sus sesiones se cerrarán y al entrar estará obligado a definir su propia contraseña.
          </Text>
        </Form>
      </Modal>

    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#555',
  borderBottom: '1px solid rgba(10,10,10,0.08)',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid rgba(10,10,10,0.08)',
  verticalAlign: 'middle',
}
