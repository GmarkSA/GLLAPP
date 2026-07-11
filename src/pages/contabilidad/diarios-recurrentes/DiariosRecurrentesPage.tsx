import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Space, Popconfirm, message, Switch,
  Typography, Tooltip, Modal,
} from 'antd'
import {
  PlusOutlined, EditOutlined, PlayCircleOutlined,
  HistoryOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getAsientosRecurrentes, generarAsientoRecurrente,
  getHistorialAsientoRecurrente, updateAsientoRecurrente,
  deleteAsientoRecurrente,
  type AsientoRecurrente, type HistorialAsientoRecurrente,
} from '../../../api/asientos-recurrentes'

const { Title } = Typography

const FRECUENCIA_LABEL: Record<string, string> = {
  SEMANAL:    'Semanal',
  MENSUAL:    'Mensual',
  BIMESTRAL:  'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL:  'Semestral',
  ANUAL:      'Anual',
}

export default function DiariosRecurrentesPage() {
  const navigate = useNavigate()
  const [data,     setData]     = useState<AsientoRecurrente[]>([])
  const [loading,  setLoading]  = useState(false)
  const [acting,   setActing]   = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialAsientoRecurrente[]>([])
  const [histModal, setHistModal] = useState(false)
  const [histTitle, setHistTitle] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getAsientosRecurrentes()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (r: AsientoRecurrente) => {
    setActing(r.id)
    try {
      await updateAsientoRecurrente(r.id, { activo: !r.activo })
      message.success(r.activo ? 'Plantilla desactivada' : 'Plantilla activada')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setActing(null) }
  }

  const handleGenerar = async (r: AsientoRecurrente) => {
    setActing(r.id)
    try {
      await generarAsientoRecurrente(r.id)
      message.success(`Borrador generado en Diarios Manuales`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al generar')
    } finally { setActing(null) }
  }

  const handleHistorial = async (r: AsientoRecurrente) => {
    setHistTitle(`Historial: ${r.nombre}`)
    try {
      setHistorial(await getHistorialAsientoRecurrente(r.id))
      setHistModal(true)
    } catch { message.error('Error al cargar historial') }
  }

  const handleEliminar = async (id: string) => {
    setActing(id)
    try {
      await deleteAsientoRecurrente(id)
      message.success('Plantilla desactivada')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setActing(null) }
  }

  const columns = [
    { title: 'Nombre del perfil', dataIndex: 'nombre' },
    {
      title: 'Frecuencia', dataIndex: 'frecuencia', width: 120,
      render: (v: string) => FRECUENCIA_LABEL[v] ?? v,
    },
    {
      title: 'Próxima ejecución', dataIndex: 'proximaEjecucion', width: 150,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Inicio', dataIndex: 'fechaInicio', width: 100,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Vence', width: 130,
      render: (_: any, r: AsientoRecurrente) =>
        r.nuncaVence
          ? <Tag color="default">Nunca vence</Tag>
          : r.fechaFin ? dayjs(r.fechaFin).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Activo', dataIndex: 'activo', width: 80,
      render: (v: boolean, r: AsientoRecurrente) => (
        <Switch checked={v} size="small"
          loading={acting === r.id}
          onChange={() => handleToggle(r)} />
      ),
    },
    {
      title: 'Líneas', dataIndex: 'lineas', width: 70, align: 'center' as const,
      render: (v: any[]) => v?.length ?? 0,
    },
    {
      title: 'Acciones', width: 160,
      render: (_: any, r: AsientoRecurrente) => (
        <Space size={4}>
          <Tooltip title="Editar plantilla">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => navigate(`/contabilidad/diarios-recurrentes/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Generar borrador ahora">
            <Popconfirm
              title={`Generar borrador de "${r.nombre}" para el mes actual?`}
              okText="Generar"
              onConfirm={() => handleGenerar(r)}>
              <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                style={{ background: '#1B3A6B' }}
                loading={acting === r.id}
                disabled={!r.activo} />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="Ver historial">
            <Button size="small" icon={<HistoryOutlined />}
              onClick={() => handleHistorial(r)} />
          </Tooltip>
          <Tooltip title="Desactivar">
            <Popconfirm title="¿Desactivar esta plantilla?" okText="Desactivar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleEliminar(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}
                loading={acting === r.id} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const histColumns = [
    { title: 'Período', dataIndex: 'periodo', width: 90 },
    {
      title: 'Estado', dataIndex: 'estado', width: 90,
      render: (v: string) => (
        <Tag color={v === 'generado' ? 'success' : 'error'}>{v}</Tag>
      ),
    },
    {
      title: 'Asiento generado', dataIndex: 'asientoGeneradoId', width: 140,
      render: (v: string | null) => v
        ? <Button type="link" size="small" style={{ padding: 0 }}
            onClick={() => { setHistModal(false); navigate(`/contabilidad/diarios-manuales/${v}`) }}>
            Ver asiento
          </Button>
        : '—',
    },
    {
      title: 'Fecha generación', dataIndex: 'fechaGeneracion', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Error', dataIndex: 'errorMsg',
      render: (v: string | null) => v ? <span style={{ color: 'red', fontSize: 11 }}>{v}</span> : '—',
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Diarios recurrentes</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#1B3A6B' }}
            onClick={() => navigate('/contabilidad/diarios-recurrentes/nueva')}>
            Nueva plantilla
          </Button>
        </Space>
      </div>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} plantillas` }}
        locale={{ emptyText: 'Sin plantillas recurrentes — crea una nueva para automatizar asientos periódicos' }}
      />

      {/* Modal historial */}
      <Modal
        title={histTitle} open={histModal}
        onCancel={() => setHistModal(false)} footer={null} width={800}>
        <Table
          dataSource={historial} columns={histColumns} rowKey="id"
          size="small" pagination={false}
          locale={{ emptyText: 'Sin generaciones registradas' }}
        />
      </Modal>
    </div>
  )
}
