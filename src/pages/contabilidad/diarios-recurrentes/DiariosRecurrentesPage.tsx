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

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const formatPeriodo = (periodo: string) => {
  const [year, month] = periodo.split('-')
  return `${MESES[Number(month) - 1]} ${year}`
}

export default function DiariosRecurrentesPage() {
  const navigate = useNavigate()
  const [data,     setData]     = useState<AsientoRecurrente[]>([])
  const [loading,  setLoading]  = useState(false)
  const [acting,   setActing]   = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialAsientoRecurrente[]>([])
  const [histModal, setHistModal] = useState(false)
  const [histTitle,   setHistTitle]   = useState('')
  const [histLoading, setHistLoading] = useState(false)

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
    setHistTitle(`Historial — ${r.nombre}`)
    setHistModal(true)
    setHistLoading(true)
    try {
      setHistorial(await getHistorialAsientoRecurrente(r.id))
    } catch { message.error('Error al cargar historial') }
    finally { setHistLoading(false) }
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
    {
      title: 'Nombre del perfil',
      render: (_: any, r: AsientoRecurrente) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.nombre}</div>
          {r.descripcion && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.descripcion}</div>}
          {r.autoPublicar && <div style={{ fontSize: 10, color: '#1faec2', marginTop: 2 }}>⚡ Auto-publica</div>}
        </div>
      ),
    },
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
                style={{ background: '#1faec2' }}
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
    {
      title: 'Período', dataIndex: 'periodo', width: 140,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{formatPeriodo(v)}</span>,
    },
    {
      title: 'Generación', dataIndex: 'estado', width: 110,
      render: (v: string) => (
        <Tag color={v === 'generado' ? 'success' : 'error'}>
          {v === 'generado' ? 'OK' : 'Error'}
        </Tag>
      ),
    },
    {
      title: 'N.º Asiento', width: 165,
      render: (_: any, r: HistorialAsientoRecurrente) => {
        if (!r.asientoGeneradoId) return '—'
        const label = r.asientoGeneradoEntryNumber ?? 'Ver asiento'
        return (
          <Button type="link" size="small" style={{ padding: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
            onClick={() => { setHistModal(false); navigate(`/contabilidad/diarios-manuales/${r.asientoGeneradoId}`) }}>
            {label}
          </Button>
        )
      },
    },
    {
      title: 'Estado asiento', dataIndex: 'asientoStatus', width: 120,
      render: (v: string | null) => {
        if (!v) return '—'
        const m: Record<string, { color: string; label: string }> = {
          draft:  { color: 'default', label: 'Borrador' },
          posted: { color: 'success', label: 'Publicado' },
          void:   { color: 'error',   label: 'Anulado' },
        }
        const s = m[v] ?? { color: 'default', label: v }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Total', dataIndex: 'totalDebit', width: 140, align: 'right' as const,
      render: (v: number | null) => v != null
        ? `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
        : '—',
    },
    {
      title: 'Fecha generación', dataIndex: 'fechaGeneracion', width: 145,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Error', dataIndex: 'errorMsg',
      render: (v: string | null) => v
        ? <Tooltip title={v}><span style={{ color: '#e5484d', fontSize: 11 }}>⚠ {v.slice(0, 50)}{v.length > 50 ? '…' : ''}</span></Tooltip>
        : '—',
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Diarios recurrentes</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#1faec2' }}
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
        onCancel={() => setHistModal(false)} footer={null} width={1000}>
        <Table
          dataSource={historial} columns={histColumns} rowKey="id"
          size="small" pagination={false} loading={histLoading}
          locale={{ emptyText: 'Sin generaciones registradas' }}
        />
      </Modal>
    </div>
  )
}
