import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Button, Table, Tag, Space, Input, Select,
  Card, message, Popconfirm, Tooltip, Steps, Badge,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  GlobalOutlined, DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getExpedientes, deleteExpediente,
  EXPEDIENTE_STATUS, type Expediente,
} from '../../api/expedientes'

const { Title, Text } = Typography
const { Option }      = Select

const fmtQ = (v: number) =>
  'Q ' + Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })

const STATUS_STEPS = ['abierto', 'en_transito', 'en_aduana', 'bodega', 'confirmado']

export default function ExpedientesPage() {
  const navigate = useNavigate()

  const [items,   setItems]   = useState<Expediente[]>([])
  const [loading, setLoading] = useState(false)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getExpedientes({ page, limit: 20, search: search || undefined, status })
      setItems(Array.isArray(res?.data) ? res.data : [])
      setTotal(res?.total ?? 0)
    } catch {
      message.error('Error al cargar expedientes')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try {
      await deleteExpediente(id)
      message.success('Expediente eliminado')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al eliminar')
    }
  }

  const columns: ColumnsType<Expediente> = [
    {
      title: 'Expediente',
      dataIndex: 'expedienteNo',
      width: 130,
      render: v => (
        <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>
      ),
    },
    {
      title: 'Fecha apertura',
      dataIndex: 'openedDate',
      width: 110,
      render: d => dayjs(d).format('DD/MM/YYYY'),
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      ellipsis: true,
      render: v => v || <Text type="secondary">Sin descripción</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 130,
      render: s => {
        const cfg = EXPEDIENTE_STATUS[s as keyof typeof EXPEDIENTE_STATUS]
        return cfg ? <Badge color={cfg.color} text={cfg.label} /> : <Tag>{s}</Tag>
      },
    },
    {
      title: 'Total FOB',
      dataIndex: 'totalFob',
      width: 120,
      align: 'right',
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Costo Aterrizaje',
      dataIndex: 'totalLandedCost',
      width: 140,
      align: 'right',
      render: v => (
        <Text style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1B3A6B', fontSize: 12 }}>
          {fmtQ(v)}
        </Text>
      ),
    },
    {
      title: 'Acciones',
      width: 100,
      align: 'center',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Abrir expediente">
            <Button
              size="small" type="text" icon={<EyeOutlined />}
              onClick={() => navigate(`/inventario/expedientes/${row.id}`)}
            />
          </Tooltip>
          {row.status === 'abierto' && (
            <Popconfirm
              title="¿Eliminar este expediente?"
              description="Solo se pueden eliminar expedientes en estado 'Abierto'."
              onConfirm={() => handleDelete(row.id)}
              okText="Sí" cancelText="No"
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            Expedientes de Importación
          </Title>
          <Text type="secondary">
            Cada expediente agrupa los documentos de costo de una importación para calcular el costo de aterrizaje
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/inventario/expedientes/nuevo')}
          style={{ background: '#1B3A6B' }}
        >
          Nuevo expediente
        </Button>
      </div>

      {/* Flujo visual */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Steps
          size="small"
          current={-1}
          items={[
            { title: 'Abierto',      description: 'Se registran artículos y documentos' },
            { title: 'En tránsito',  description: 'Mercancía en camino' },
            { title: 'En aduana',    description: 'Proceso de despacho SAT' },
            { title: 'En bodega',    description: 'Mercancía recibida' },
            { title: 'Confirmado',   description: 'CPP actualizado' },
          ]}
        />
      </Card>

      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Space wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Buscar por No. expediente, descripción..."
            style={{ width: 300 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Select
            style={{ width: 170 }}
            placeholder="Estado"
            allowClear
            value={status}
            onChange={v => { setStatus(v); setPage(1) }}
          >
            {Object.entries(EXPEDIENTE_STATUS).map(([k, v]) => (
              <Option key={k} value={k}>
                <Badge color={v.color} text={v.label} />
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: page, pageSize: 20, total,
            showSizeChanger: false,
            showTotal: t => `${t} expedientes`,
            onChange: p => setPage(p),
          }}
          locale={{ emptyText: 'Sin expedientes registrados. Crea el primero para comenzar.' }}
        />
      </Card>
    </div>
  )
}
