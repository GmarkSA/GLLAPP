import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Space, Popconfirm, message, Typography, Empty, Card, Dropdown,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, FundProjectionScreenOutlined, MoreOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPresupuestos, deletePresupuesto, updatePresupuesto, type Budget, type BudgetStatus,
  STATUS_COLOR, STATUS_LABEL,
} from '../../../api/presupuesto'

const { Title, Text } = Typography

export default function PresupuestosPage() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<Budget[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await getPresupuestos()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    try { await deletePresupuesto(id); message.success('Presupuesto eliminado'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error al eliminar') }
  }

  const handleStatus = async (id: string, status: BudgetStatus) => {
    try { await updatePresupuesto(id, { status }); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error al cambiar estado') }
  }

  const statusMenuItems = (r: Budget) => {
    const items = []
    if (r.status === 'BORRADOR') items.push({ key: 'ACTIVO',   label: '✓ Activar' })
    if (r.status === 'ACTIVO')   items.push({ key: 'BORRADOR', label: '↩ Volver a Borrador' })
    if (r.status === 'ACTIVO')   items.push({ key: 'CERRADO',  label: '🔒 Cerrar' })
    if (r.status === 'CERRADO')  items.push({ key: 'ACTIVO',   label: '↩ Reabrir' })
    return items
  }

  const columns = [
    {
      title: 'Nombre', dataIndex: 'nombre',
      render: (v: string, r: Budget) => (
        <a onClick={() => navigate(`/contabilidad/presupuesto/${r.id}`)} style={{ fontWeight: 600 }}>{v}</a>
      ),
    },
    { title: 'Año Fiscal', dataIndex: 'anioFiscal', width: 100, align: 'center' as const },
    {
      title: 'Período', dataIndex: 'periodo', width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: BudgetStatus) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: 'Creado', dataIndex: 'createdAt', width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: '', width: 200, align: 'right' as const,
      render: (_: any, r: Budget) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/contabilidad/presupuesto/${r.id}`)}>
            Editar
          </Button>
          <Button size="small" icon={<FundProjectionScreenOutlined />}
            onClick={() => navigate(`/contabilidad/presupuesto/${r.id}/vs-real`)}>
            Vs Real
          </Button>
          <Dropdown
            menu={{
              items: statusMenuItems(r),
              onClick: ({ key }) => handleStatus(r.id, key as BudgetStatus),
            }}
            trigger={['click']}
          >
            <Button size="small" icon={<MoreOutlined />} title="Cambiar estado" />
          </Dropdown>
          <Popconfirm title="¿Eliminar este presupuesto?" okText="Eliminar" okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Presupuestos</Title>
        <Button type="primary" icon={<PlusOutlined />}
          style={{ background: '#1faec2' }}
          onClick={() => navigate('/contabilidad/presupuesto/nuevo')}>
          Nuevo
        </Button>
      </div>

      {!loading && data.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '60px 0' }}>
          <Empty
            image={<FundProjectionScreenOutlined style={{ fontSize: 64, color: '#9aa1ab' }} />}
            imageStyle={{ height: 80 }}
            description={
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0a', marginBottom: 8 }}>
                  Presupueste las finanzas de su negocio. Esté al tanto de sus gastos.
                </div>
                <Text type="secondary">
                  Cree presupuestos para las diversas actividades de su negocio, compárelos con los reales y vea cómo está funcionando su empresa.
                </Text>
              </div>
            }
          >
            <Button type="primary" size="large" style={{ background: '#1faec2', marginTop: 16 }}
              onClick={() => navigate('/contabilidad/presupuesto/nuevo')}>
              CREAR PRESUPUESTO
            </Button>
          </Empty>
        </Card>
      ) : (
        <Table
          dataSource={data} columns={columns} rowKey="id"
          loading={loading} size="small"
          pagination={{ pageSize: 20, showTotal: t => `${t} presupuestos` }}
        />
      )}
    </div>
  )
}
