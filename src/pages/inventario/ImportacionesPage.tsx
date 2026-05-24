import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Button, Table, Tag, Space, Input, Select,
  Card, message, Popconfirm, Tooltip, Badge,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckCircleOutlined, DeleteOutlined, GlobalOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getImportaciones, confirmarImportacion, deleteImportacion,
  type Importacion,
} from '../../api/inventario'

const { Title, Text } = Typography
const { Option }      = Select

const fmtQ = (v: number) =>
  'Q ' + Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })

const STATUS_TAG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Borrador',      color: 'orange'  },
  confirmed: { label: 'Confirmada',    color: 'green'   },
  posted:    { label: 'Contabilizada', color: 'blue'    },
}

const PRORRATION_LABEL: Record<string, string> = {
  by_value:    'Por valor FOB',
  by_quantity: 'Por cantidad',
  by_weight:   'Por peso',
  by_volume:   'Por volumen',
}

export default function ImportacionesPage() {
  const navigate = useNavigate()

  const [items,   setItems]   = useState<Importacion[]>([])
  const [loading, setLoading] = useState(false)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getImportaciones({ page, limit: 20, search: search || undefined, status })
      setItems(Array.isArray(res?.data) ? res.data : [])
      setTotal(res?.total ?? 0)
    } catch {
      message.error('Error al cargar importaciones')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (id: string) => {
    try {
      await confirmarImportacion(id)
      message.success('Importación confirmada — costos de artículos actualizados')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al confirmar importación')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteImportacion(id)
      message.success('Importación eliminada')
      load()
    } catch {
      message.error('Error al eliminar')
    }
  }

  const columns: ColumnsType<Importacion> = [
    {
      title: 'Fecha',
      dataIndex: 'date',
      width: 100,
      render: d => dayjs(d).format('DD/MM/YYYY'),
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: 'No. Factura',
      dataIndex: 'invoiceNumber',
      width: 120,
      render: v => v ? <Text style={{ fontFamily: 'monospace' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Proveedor',
      dataIndex: 'supplierName',
      ellipsis: true,
      render: v => v || <Text type="secondary">Sin especificar</Text>,
    },
    {
      title: 'Moneda',
      dataIndex: 'currency',
      width: 80,
      render: (currency, r) => (
        <Tooltip title={`Tasa: ${r.exchangeRate}`}>
          <Tag>{currency}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Prorrateo',
      dataIndex: 'prorationMethod',
      width: 130,
      render: v => <Text style={{ fontSize: 12 }}>{PRORRATION_LABEL[v] || v}</Text>,
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
        <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B3A6B', fontSize: 12 }}>
          {fmtQ(v)}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 130,
      render: s => {
        const cfg = STATUS_TAG[s] || { label: s, color: 'default' }
        return <Badge color={cfg.color} text={cfg.label} />
      },
    },
    {
      title: 'Acciones',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button
              size="small" type="text" icon={<EyeOutlined />}
              onClick={() => navigate(`/inventario/importaciones/${row.id}`)}
            />
          </Tooltip>
          {row.status === 'draft' && (
            <>
              <Popconfirm
                title="Confirmar importación"
                description="Se actualizarán los costos promedio de los artículos. Esta acción no se puede deshacer."
                onConfirm={() => handleConfirm(row.id)}
                okText="Confirmar" cancelText="Cancelar"
                okButtonProps={{ style: { background: '#52c41a' } }}
              >
                <Tooltip title="Confirmar importación">
                  <Button size="small" type="text" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title="¿Eliminar este borrador?"
                onConfirm={() => handleDelete(row.id)}
                okText="Sí" cancelText="No"
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            Importaciones
          </Title>
          <Text type="secondary">Registro de importaciones con cálculo de costo de aterrizaje y prorrateo</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/inventario/importaciones/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva importación
        </Button>
      </div>

      {/* Filtros */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Space wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Buscar por No. factura, proveedor..."
            style={{ width: 280 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Select
            style={{ width: 160 }}
            placeholder="Estado"
            allowClear
            value={status}
            onChange={v => { setStatus(v); setPage(1) }}
          >
            <Option value="draft">Borrador</Option>
            <Option value="confirmed">Confirmada</Option>
            <Option value="posted">Contabilizada</Option>
          </Select>
        </Space>
      </Card>

      {/* Tabla */}
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showSizeChanger: false,
            showTotal: t => `${t} importaciones`,
            onChange: p => setPage(p),
          }}
          locale={{ emptyText: 'Sin importaciones registradas' }}
        />
      </Card>
    </div>
  )
}
