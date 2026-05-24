import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Avatar, Badge, Popconfirm, message, Select,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  MoreOutlined, UserOutlined, BankOutlined, MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getVendors, deleteVendor, type Vendor } from '../../../api/contactos'

const { Title, Text } = Typography
const { Option } = Select

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activo',   color: 'success' },
  inactive: { label: 'Inactivo', color: 'default' },
}

const TAX_TREATMENT_CONFIG: Record<string, { label: string; color: string }> = {
  taxable:                { label: 'Contribuyente',    color: 'blue'    },
  exempt:                 { label: 'Exento',           color: 'default' },
  contribuyente_especial: { label: 'C. Especial',      color: 'orange'  },
  gobierno:               { label: 'Gobierno',         color: 'purple'  },
  exportador:             { label: 'Exportador',       color: 'cyan'    },
}

export default function ProveedoresPage() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVendors({ search, page, limit: 20 })
      if (Array.isArray(res)) {
        setVendors(res); setTotal(res.length)
      } else {
        setVendors(res.data ?? res.items ?? [])
        setTotal(res.meta?.total ?? res.total ?? 0)
      }
    } catch {
      setVendors([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const handleDelete = async (id: string) => {
    try {
      await deleteVendor(id)
      message.success('Proveedor eliminado')
      fetchVendors()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const columns: ColumnsType<Vendor> = [
    {
      title: 'Proveedor',
      render: (_, r) => (
        <Space>
          <Avatar
            style={{ background: r.type === 'individual' ? '#7c3aed' : '#1B3A6B', flexShrink: 0 }}
            size={36}
            icon={r.type === 'individual' ? <UserOutlined /> : <BankOutlined />}
          >
            {!r.name ? 'P' : r.name[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1B3A6B', lineHeight: 1.3 }}>
              {r.name}
            </div>
            {r.legalName && r.legalName !== r.name && (
              <Text type="secondary" style={{ fontSize: 11 }}>{r.legalName}</Text>
            )}
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              {r.vendorNumber} {r.taxId && `· NIT: ${r.taxId}`}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Contacto',
      width: 200,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          {r.email && (
            <div><MailOutlined style={{ color: '#8c8c8c', marginRight: 4 }} />{r.email}</div>
          )}
          {r.phone && (
            <div style={{ marginTop: 2 }}>
              <PhoneOutlined style={{ color: '#8c8c8c', marginRight: 4 }} />{r.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tipo fiscal',
      dataIndex: 'taxTreatment',
      width: 145,
      render: (v: string) => {
        const c = TAX_TREATMENT_CONFIG[v]
        return c ? <Tag color={c.color}>{c.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Impuesto',
      width: 110,
      render: (_, r) => (
        <Space size={4} direction="vertical" style={{ gap: 2 }}>
          {r.taxCode && <Tag color="blue" style={{ fontSize: 11 }}>{r.taxCode}</Tag>}
          {r.tdsEnabled && r.tdsTaxCode && (
            <Tag color="purple" style={{ fontSize: 11 }}>ISR: {r.tdsTaxCode}</Tag>
          )}
          {r.ivaRetentionCode && (
            <Tag color="orange" style={{ fontSize: 11 }}>{r.ivaRetentionCode}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Saldo',
      dataIndex: 'balance',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: Number(v) > 0 ? '#1B3A6B' : '#8c8c8c' }}>
          {Number(v) > 0 ? `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—'}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const c = STATUS_CONFIG[v ?? 'active']
        return <Badge status={c?.color as any} text={c?.label} />
      },
    },
    {
      title: '',
      width: 60,
      render: (_, r) => (
        <Dropdown
          menu={{
            items: [
              { key: 'edit', label: 'Editar', icon: <EditOutlined /> },
              { type: 'divider' },
              {
                key: 'delete', label: (
                  <Popconfirm
                    title="¿Eliminar este proveedor?"
                    onConfirm={() => handleDelete(r.id!)}
                    okText="Sí" cancelText="No"
                    okButtonProps={{ danger: true }}
                  >
                    <span style={{ color: '#ff4d4f' }}>Eliminar</span>
                  </Popconfirm>
                ),
              },
            ],
            onClick: ({ key }) => {
              if (key === 'edit') navigate(`/compras/proveedores/${r.id}`)
            },
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Proveedores</Title>
          <Text type="secondary">Datos maestros de proveedores vinculados a impuestos y contabilidad</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/compras/proveedores/nuevo')}
          style={{ background: '#1B3A6B' }}
        >
          Nuevo proveedor
        </Button>
      </div>

      {/* Filtros */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Input
            placeholder="Buscar por nombre, NIT, correo..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            style={{ width: 280 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Select placeholder="Tipo fiscal" style={{ width: 170 }} allowClear>
            {Object.entries(TAX_TREATMENT_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}><Tag color={v.color}>{v.label}</Tag></Option>
            ))}
          </Select>
          <Select placeholder="Estado" style={{ width: 130 }} allowClear>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* Tabla */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={vendors}
          rowKey="id"
          loading={loading}
          size="middle"
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/proveedores/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} proveedores`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin proveedores — crea el primero con el botón "Nuevo proveedor"' }}
        />
      </Card>
    </div>
  )
}
