import { useState } from 'react'
import {
  Table, Button, Tag, Avatar, Space, Typography,
  Card, Modal, Form, Input, Select, Tooltip, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, MailOutlined,
  UserOutlined, CrownOutlined, TeamOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography
const { Option } = Select

// Datos de ejemplo — se conectarán al backend en la siguiente iteración
const MOCK_USERS = [
  {
    id: '1',
    firstName: 'Admin',
    lastName: 'Sistema',
    email: 'admin@miempresa.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2024-05-12',
  },
]

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin:     { label: 'Administrador', color: 'gold',    icon: <CrownOutlined /> },
  contador:  { label: 'Contador',      color: 'blue',    icon: <TeamOutlined />  },
  vendedor:  { label: 'Vendedor',      color: 'green',   icon: <TeamOutlined />  },
  bodeguero: { label: 'Bodeguero',     color: 'cyan',    icon: <TeamOutlined />  },
  readonly:  { label: 'Solo lectura',  color: 'default', icon: <TeamOutlined />  },
}

export default function UsuariosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const columns: ColumnsType<typeof MOCK_USERS[0]> = [
    {
      title: 'Usuario',
      render: (_, r) => (
        <Space>
          <Avatar style={{ background: '#1B3A6B' }} size={36}>
            {r.firstName[0]}{r.lastName[0]}
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
      dataIndex: 'role',
      width: 160,
      render: (v: string) => {
        const c = ROLE_CONFIG[v] ?? ROLE_CONFIG.readonly
        return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>
      },
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => v === 'active'
        ? <Badge status="success" text="Activo" />
        : <Badge status="default" text="Inactivo" />,
    },
    {
      title: 'Último acceso',
      dataIndex: 'lastLogin',
      width: 140,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Acciones',
      width: 100,
      render: () => (
        <Space>
          <Tooltip title="Editar">
            <Button type="text" size="small" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="Reenviar invitación">
            <Button type="text" size="small" icon={<MailOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Usuarios</Title>
          <Text type="secondary">Administra quién tiene acceso a tu empresa en ContaERP</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          style={{ background: '#1B3A6B' }}
        >
          Invitar usuario
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={MOCK_USERS}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Tarjetas de roles disponibles */}
      <div style={{ marginTop: 20 }}>
        <Text strong style={{ color: '#1B3A6B' }}>Roles disponibles</Text>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <Card
              key={key}
              size="small"
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 160 }}
            >
              <Space>
                <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
              </Space>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                {key === 'admin'     && 'Acceso total al sistema'}
                {key === 'contador'  && 'Contabilidad y reportes'}
                {key === 'vendedor'  && 'Ventas y clientes'}
                {key === 'bodeguero' && 'Inventario y almacén'}
                {key === 'readonly'  && 'Solo consulta, sin edición'}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Modal invitar usuario */}
      <Modal
        open={modalOpen}
        title={<Space><UserOutlined /> Invitar nuevo usuario</Space>}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then(() => {
          setModalOpen(false)
          form.resetFields()
        })}
        okText="Enviar invitación"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined style={{ color: '#bbb' }} />} placeholder="usuario@empresa.com" />
          </Form.Item>
          <Form.Item name="firstName" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Juan" />
          </Form.Item>
          <Form.Item name="lastName" label="Apellido" rules={[{ required: true }]}>
            <Input placeholder="García" />
          </Form.Item>
          <Form.Item name="role" label="Rol" rules={[{ required: true }]}>
            <Select placeholder="Selecciona un rol">
              {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                <Option key={key} value={key}>
                  <Tag color={cfg.color} style={{ marginRight: 8 }}>{cfg.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
