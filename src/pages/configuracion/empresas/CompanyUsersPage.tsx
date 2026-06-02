import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Select, Space, Popconfirm,
  message, Typography, Tag, Avatar, Tooltip,
} from 'antd'
import { PlusOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi } from '../../../api/companies'
import { getUsers, type TenantUser } from '../../../api/usuarios'
import { useCompanyStore } from '../../../store/companyStore'

const { Title } = Typography

interface CompanyUser {
  id:        string
  userId:    string
  companyId: string
  roleIds:   string[]
  isActive:  boolean
}

export default function CompanyUsersPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [assignments, setAssignments] = useState<CompanyUser[]>([])
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [loading, setLoading]         = useState(false)
  const [modal, setModal]             = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)

  const load = useCallback(async () => {
    if (!activeCompany) return
    setLoading(true)
    try {
      const [users, all] = await Promise.all([
        companiesApi.getCompanyUsers(activeCompany.id),
        getUsers(),
      ])
      setAssignments(Array.isArray(users) ? users : [])
      setTenantUsers(Array.isArray(all) ? all : [])
    } catch {
      message.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [activeCompany])

  useEffect(() => { load() }, [load])

  const getUser = (userId: string) => tenantUsers.find(u => u.id === userId)

  const handleAssign = async () => {
    if (!activeCompany || !selectedUser) return
    setSaving(true)
    try {
      await companiesApi.assignUser(activeCompany.id, { userId: selectedUser })
      message.success('Usuario asignado correctamente')
      setModal(false)
      setSelectedUser(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al asignar usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!activeCompany) return
    try {
      await companiesApi.removeCompanyUser(activeCompany.id, userId)
      message.success('Acceso revocado')
      load()
    } catch {
      message.error('Error al revocar acceso')
    }
  }

  // Usuarios del tenant que aún NO están asignados
  const assignedIds = new Set(assignments.map(a => a.userId))
  const availableUsers = tenantUsers.filter(u => !assignedIds.has(u.id))

  const columns: ColumnsType<CompanyUser> = [
    {
      title: 'Usuario',
      key: 'user',
      render: (_: any, r: CompanyUser) => {
        const u = getUser(r.userId)
        if (!u) return <span style={{ color: '#bbb' }}>{r.userId.slice(0, 8)}…</span>
        const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase()
        return (
          <Space>
            <Avatar size={28} style={{ background: '#1B3A6B', fontSize: 11 }}>{initials || <UserOutlined />}</Avatar>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{u.firstName} {u.lastName}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
            </div>
          </Space>
        )
      },
    },
    {
      title: 'Estado',
      key: 'status',
      width: 100,
      render: (_: any, r: CompanyUser) => {
        const u = getUser(r.userId)
        return u
          ? <Tag color={u.status === 'active' ? 'success' : 'default'}>{u.status}</Tag>
          : null
      },
    },
    {
      title: 'Rol',
      key: 'role',
      width: 130,
      render: (_: any, r: CompanyUser) => {
        const u = getUser(r.userId)
        return u?.isSuperAdmin
          ? <Tag color="red">Super Admin</Tag>
          : <Tag>Usuario</Tag>
      },
    },
    {
      title: '',
      width: 60,
      render: (_: any, r: CompanyUser) => (
        <Tooltip title="Revocar acceso">
          <Popconfirm title="¿Revocar acceso de este usuario?" onConfirm={() => handleRemove(r.userId)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      ),
    },
  ]

  if (!activeCompany) {
    return <div style={{ padding: 24, color: '#999' }}>Seleccione una empresa para gestionar sus usuarios.</div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <UserOutlined style={{ marginRight: 8, color: '#1B3A6B' }} />
            Usuarios — {activeCompany.legalName}
          </Title>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {assignments.length} usuario{assignments.length !== 1 ? 's' : ''} con acceso
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ background: '#1B3A6B' }}
          onClick={() => setModal(true)}
          disabled={availableUsers.length === 0}
        >
          Asignar usuario
        </Button>
      </div>

      <Table
        rowKey="userId"
        columns={columns}
        dataSource={assignments}
        loading={loading}
        size="small"
        pagination={false}
        locale={{ emptyText: 'Ningún usuario asignado a esta empresa' }}
      />

      <Modal
        title="Asignar usuario a empresa"
        open={modal}
        onCancel={() => { setModal(false); setSelectedUser(null) }}
        onOk={handleAssign}
        confirmLoading={saving}
        okText="Asignar"
        okButtonProps={{ style: { background: '#1B3A6B' }, disabled: !selectedUser }}
      >
        <div style={{ marginTop: 16 }}>
          <Select
            style={{ width: '100%' }}
            placeholder="Seleccionar usuario..."
            showSearch
            optionFilterProp="label"
            value={selectedUser}
            onChange={setSelectedUser}
            options={availableUsers.map(u => ({
              value: u.id,
              label: `${u.firstName} ${u.lastName} (${u.email})`,
            }))}
          />
          {availableUsers.length === 0 && (
            <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
              Todos los usuarios del tenant ya tienen acceso a esta empresa.
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
