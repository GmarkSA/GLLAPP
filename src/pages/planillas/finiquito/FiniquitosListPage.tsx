import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Table, Tag, Typography, message } from 'antd'
import { SolutionOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { listarFiniquitos, type Finiquito, type MotivoBajaFiniquito } from '../../../api/planillas-finiquito'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MOTIVO_LABEL: Record<MotivoBajaFiniquito, string> = {
  RENUNCIA: 'Renuncia', DESPIDO_JUSTIFICADO: 'Despido justificado', DESPIDO_INJUSTIFICADO: 'Despido injustificado',
  MUTUO_ACUERDO: 'Mutuo acuerdo', OTRO: 'Otro',
}
const ESTADO_COLOR: Record<string, string> = { BORRADOR: 'orange', CONTABILIZADO: 'blue', PAGADO: 'purple' }

export default function FiniquitosListPage() {
  const navigate = useNavigate()
  const [finiquitos, setFiniquitos] = useState<Finiquito[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    listarFiniquitos().then(setFiniquitos).catch(() => message.error('Error cargando finiquitos')).finally(() => setLoading(false))
  }, [])

  const columns: ColumnsType<Finiquito> = [
    { title: 'Empleado', key: 'empleado', render: (_, f) => (
      <div><Text strong style={{ fontSize: 12, color: NAVY }}>{f.empleadoNombre}</Text><div style={{ fontSize: 11, color: '#8c8c8c' }}>{f.empleadoCodigo}</div></div>
    ) },
    { title: 'Motivo', dataIndex: 'motivoBaja', width: 160, render: (v: MotivoBajaFiniquito) => MOTIVO_LABEL[v] ?? v },
    { title: 'Fecha de baja', dataIndex: 'fechaBaja', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Neto a pagar', dataIndex: 'netoAPagar', width: 140, align: 'right', render: (v: number) => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(v)}</Text> },
    { title: 'Estado', dataIndex: 'estado', width: 130, render: (v: string) => <Tag color={ESTADO_COLOR[v]}>{v}</Tag> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}><SolutionOutlined style={{ marginRight: 8 }} />Finiquitos</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Liquidaciones laborales — se generan desde la ficha del empleado ("Dar de baja / Finiquito")</Text>
        </div>
        <Button onClick={() => navigate('/planillas/empleados')}>Ir a empleados</Button>
      </div>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          scroll={{ y: 'calc(100vh - 330px)' }}
          size="small" rowKey="id" loading={loading}
          dataSource={finiquitos} columns={columns} pagination={false}
          onRow={f => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/planillas/finiquitos/${f.id}`) })}
          locale={{ emptyText: 'Sin finiquitos registrados' }}
        />
      </Card>
    </div>
  )
}
