import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Form, Modal, Select, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPeriodosPlanilla, crearPeriodoPlanilla, type PeriodoPlanilla,
} from '../../../api/planillas-corrida'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'orange', APROBADA: 'green', CONTABILIZADA: 'blue', PAGADA: 'purple',
}

export default function PeriodosPlanillaPage() {
  const navigate = useNavigate()
  const [periodos, setPeriodos] = useState<PeriodoPlanilla[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [creando, setCreando] = useState(false)
  const [form] = Form.useForm()

  const cargar = () => {
    setLoading(true)
    getPeriodosPlanilla()
      .then(setPeriodos)
      .catch(() => message.error('Error cargando períodos'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const crear = async () => {
    try {
      const vals = await form.validateFields()
      setCreando(true)
      const periodo = await crearPeriodoPlanilla(vals)
      message.success(`Corrida ${MESES[vals.mes - 1]} ${vals.anio} — ${vals.quincena === 1 ? '1ra' : '2da'} quincena creada con ${periodo.totalEmpleados} empleados`)
      setModalOpen(false)
      navigate(`/planillas/corridas/${periodo.id}`)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error creando la corrida')
    } finally {
      setCreando(false)
    }
  }

  const columns: ColumnsType<PeriodoPlanilla> = [
    {
      title: 'Período', key: 'periodo', width: 200,
      render: (_, p) => (
        <div>
          <Text strong style={{ fontSize: 12, color: NAVY }}>{MESES[p.mes - 1]} {p.anio}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{p.quincena === 1 ? '1ra quincena (1-15)' : '2da quincena (16-fin)'}</div>
        </div>
      ),
      sorter: (a, b) => (a.anio * 10000 + a.mes * 10 + a.quincena) - (b.anio * 10000 + b.mes * 10 + b.quincena),
      defaultSortOrder: 'descend',
    },
    { title: 'Empleados', dataIndex: 'totalEmpleados', width: 100, align: 'center' },
    {
      title: 'Devengado', dataIndex: 'totalDevengado', width: 140, align: 'right',
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Deducciones', dataIndex: 'totalDeducciones', width: 130, align: 'right',
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Neto a pagar', dataIndex: 'totalNeto', width: 140, align: 'right',
      render: (v: number) => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Cuota patronal', dataIndex: 'totalCuotaPatronal', width: 130, align: 'right',
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 110,
      render: (v: string) => <Tag color={ESTADO_COLOR[v]} style={{ fontSize: 10 }}>{v}</Tag>,
    },
  ]

  const anioActual = dayjs().year()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>
            <CalendarOutlined style={{ marginRight: 8 }} />Corridas de planilla
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Quincenal (1-15 y 16-fin de mes) · BORRADOR editable → APROBADA congelada
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }}
          onClick={() => {
            const dia = dayjs().date()
            form.setFieldsValue({ anio: anioActual, mes: dayjs().month() + 1, quincena: dia <= 15 ? 1 : 2 })
            setModalOpen(true)
          }}>
          Nueva corrida
        </Button>
      </div>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={loading}
          dataSource={periodos} columns={columns}
          pagination={false}
          onRow={p => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/planillas/corridas/${p.id}`),
          })}
          locale={{ emptyText: 'Sin corridas. Crea la primera con "Nueva corrida" — se genera una línea por cada empleado activo.' }}
        />
      </Card>

      <Modal
        title="Nueva corrida de planilla"
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={crear} okText="Crear corrida" cancelText="Cancelar"
        confirmLoading={creando}
      >
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="anio" label="Año" rules={[{ required: true }]}>
              <Select options={[anioActual - 1, anioActual, anioActual + 1].map(y => ({ value: y, label: y }))} />
            </Form.Item>
            <Form.Item name="mes" label="Mes" rules={[{ required: true }]}>
              <Select options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />
            </Form.Item>
            <Form.Item name="quincena" label="Quincena" rules={[{ required: true }]}>
              <Select options={[
                { value: 1, label: '1ra (días 1-15)' },
                { value: 2, label: '2da (16-fin de mes)' },
              ]} />
            </Form.Item>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            1ra quincena: paga la mitad del salario, sin deducciones. 2da quincena: paga la
            otra mitad + horas extra + bonificación incentivo completa, y ahí se descuentan
            IGSS, ISR y otras deducciones calculados sobre el mes completo.
          </Text>
        </Form>
      </Modal>
    </div>
  )
}
