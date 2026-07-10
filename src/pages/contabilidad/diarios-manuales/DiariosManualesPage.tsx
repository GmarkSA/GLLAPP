import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Space, Popconfirm, message, DatePicker, Select,
  Typography, Tooltip, Input,
} from 'antd'
import {
  PlusOutlined, FileTextOutlined, CheckCircleOutlined,
  StopOutlined, RollbackOutlined, DeleteOutlined, ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  getAsientos, getAsiento, postAsiento, voidAsiento, reverseAsiento, deleteAsiento,
  type AsientoListItem, type GetAsientosParams,
} from '../../../api/asientos'

const { Title } = Typography
const { RangePicker } = DatePicker

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', POSTED: 'success', VOID: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', POSTED: 'Publicado', VOID: 'Anulado',
}
const TYPE_LABEL: Record<string, string> = {
  MANUAL: 'Manual', AUTO: 'Automático', RECURRING: 'Recurrente',
  OPENING: 'Apertura', CLOSING: 'Cierre', ADJUSTMENT: 'Ajuste',
}

export default function DiariosManualesPage() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<AsientoListItem[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [page,    setPage]    = useState(1)

  const [search,       setSearch]       = useState('')
  const [rango,        setRango]        = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string | undefined>()
  const [filtroTipo,   setFiltroTipo]   = useState<string | undefined>()
  const [acting,       setActing]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: GetAsientosParams = { page, limit: 50, soloManuales: true }
      if (search)       params.search     = search
      if (filtroEstado) params.estado     = filtroEstado
      if (filtroTipo)   params.tipo       = filtroTipo
      if (rango?.[0])   params.fechaDesde = rango[0].format('YYYY-MM-DD')
      if (rango?.[1])   params.fechaHasta = rango[1].format('YYYY-MM-DD')
      const res = await getAsientos(params)
      setData(res.data)
      setTotal(res.total)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [page, search, filtroEstado, filtroTipo, rango])

  useEffect(() => { load() }, [load])

  const act = async (id: string, fn: () => Promise<any>, ok: string) => {
    setActing(id)
    try { await fn(); message.success(ok); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
    finally { setActing(null) }
  }

  const handleClonar = async (id: string) => {
    setActing(id)
    try {
      const full = await getAsiento(id)
      navigate('/contabilidad/diarios-manuales/nuevo', { state: { clonarDe: full } })
    } catch { message.error('Error al cargar datos para clonar') }
    finally { setActing(null) }
  }

  const columns = [
    {
      title: 'Fecha', dataIndex: 'entryDate', width: 100,
      sorter: (a: AsientoListItem, b: AsientoListItem) =>
        a.entryDate.localeCompare(b.entryDate),
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'N.º del diario', dataIndex: 'entryNumber', width: 150,
      render: (v: string, r: AsientoListItem) => (
        <Button type="link" size="small" style={{ padding: 0 }}
          onClick={() => navigate(`/contabilidad/diarios-manuales/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Número de referencia', dataIndex: 'reference', width: 180,
      render: (v?: string) => v || '—',
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Tipo', dataIndex: 'type', width: 110,
      render: (v: string) => TYPE_LABEL[v] ?? v,
    },
    {
      title: 'Notas', dataIndex: 'description', ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}><span style={{ color: '#666' }}>{v}</span></Tooltip>
      ),
    },
    {
      title: 'Importe', dataIndex: 'totalDebit', width: 140, align: 'right' as const,
      render: (v: number) =>
        `GTQ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Acciones', width: 200,
      render: (_: any, r: AsientoListItem) => (
        <Space size={4}>
          {/* Ver / Editar */}
          <Tooltip title="Ver / Editar">
            <Button size="small" icon={<FileTextOutlined />}
              onClick={() => navigate(`/contabilidad/diarios-manuales/${r.id}`)} />
          </Tooltip>

          {/* Clonar (siempre disponible) */}
          <Tooltip title="Clonar asiento">
            <Button size="small" icon={<CopyOutlined />}
              loading={acting === r.id}
              onClick={() => handleClonar(r.id)} />
          </Tooltip>

          {/* Publicar (solo DRAFT) */}
          {r.status === 'DRAFT' && (
            <Tooltip title="Publicar / Contabilizar">
              <Popconfirm title="¿Publicar este asiento? Quedará registrado en los reportes financieros."
                okText="Publicar"
                onConfirm={() => act(r.id, () => postAsiento(r.id), 'Asiento publicado')}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  style={{ background: '#1B3A6B' }} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Revertir (solo POSTED) */}
          {r.status === 'POSTED' && (
            <Tooltip title="Crear asiento de reversión">
              <Popconfirm title="¿Crear asiento de reversión? Se generará un borrador con débitos y créditos invertidos."
                okText="Revertir"
                onConfirm={() => act(r.id, () => reverseAsiento(r.id), 'Reversión creada como borrador')}>
                <Button size="small" icon={<RollbackOutlined />} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Anular (solo POSTED) */}
          {r.status === 'POSTED' && (
            <Tooltip title="Anular">
              <Popconfirm title="¿Anular este asiento? Esta acción no puede deshacerse."
                okText="Anular" okButtonProps={{ danger: true }}
                onConfirm={() => act(r.id, () => voidAsiento(r.id), 'Asiento anulado')}>
                <Button size="small" danger icon={<StopOutlined />} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Eliminar borrador (solo DRAFT) */}
          {r.status === 'DRAFT' && (
            <Tooltip title="Eliminar borrador">
              <Popconfirm title="¿Eliminar este borrador permanentemente?"
                okText="Eliminar" okButtonProps={{ danger: true }}
                onConfirm={() => act(r.id, () => deleteAsiento(r.id), 'Borrador eliminado')}>
                <Button size="small" danger icon={<DeleteOutlined />} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Todos los diarios manuales</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#1B3A6B' }}
            onClick={() => navigate('/contabilidad/diarios-manuales/nuevo')}>
            Nuevo
          </Button>
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Buscar por N.º, referencia o notas..."
          onSearch={v => { setSearch(v); setPage(1) }}
          allowClear style={{ width: 260 }}
        />
        <RangePicker
          format="DD/MM/YYYY"
          placeholder={['Desde', 'Hasta']}
          onChange={v => { setRango(v as any); setPage(1) }}
          style={{ width: 240 }}
        />
        <Select
          placeholder="Estado" allowClear style={{ width: 130 }}
          onChange={v => { setFiltroEstado(v); setPage(1) }}
          options={[
            { label: 'Borrador',  value: 'DRAFT' },
            { label: 'Publicado', value: 'POSTED' },
            { label: 'Anulado',   value: 'VOID' },
          ]}
        />
        <Select
          placeholder="Tipo" allowClear style={{ width: 140 }}
          onChange={v => { setFiltroTipo(v); setPage(1) }}
          options={[
            { label: 'Manual',     value: 'MANUAL' },
            { label: 'Recurrente', value: 'RECURRING' },
            { label: 'Apertura',   value: 'OPENING' },
            { label: 'Cierre',     value: 'CLOSING' },
            { label: 'Ajuste',     value: 'ADJUSTMENT' },
          ]}
        />
      </Space>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        onRow={r => ({ onDoubleClick: () => navigate(`/contabilidad/diarios-manuales/${r.id}`) })}
        pagination={{
          current: page, pageSize: 50, total,
          onChange: p => setPage(p),
          showTotal: t => `${t} registros`,
        }}
      />
    </div>
  )
}
