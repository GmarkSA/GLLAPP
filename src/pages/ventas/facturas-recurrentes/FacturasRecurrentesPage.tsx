import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Button, Table, Typography, Tag, Badge, Space, Select, Input,
  Popconfirm, message, Tooltip, Modal, Drawer, Divider,
} from 'antd'
import {
  PlusOutlined, PauseCircleOutlined, PlayCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, HistoryOutlined, DeleteOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getFacturasRecurrentes, pausarFacturaRecurrente, reanudarFacturaRecurrente,
  cancelarFacturaRecurrente, generarAhoraFacturaRecurrente,
  getHistorialFacturaRecurrente, eliminarHistorialFacturaRecurrente,
  FRECUENCIA_LABELS, ESTADO_CONFIG,
  type FacturaRecurrente, type HistorialGeneracion,
  type EstadoFacturaRecurrente,
} from '../../../api/facturas-recurrentes'

const { Text, Title } = Typography

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface RecAdFilters {
  filterEstado?: string[]
  filterFrecuencia?: string[]
}
function applyRecFilters(data: FacturaRecurrente[], f: RecAdFilters): FacturaRecurrente[] {
  return data.filter(r => {
    if (f.filterEstado?.length    && !f.filterEstado.includes(r.estado))       return false
    if (f.filterFrecuencia?.length && !f.filterFrecuencia.includes(r.frecuencia)) return false
    return true
  })
}

export default function FacturasRecurrentesPage() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<FacturaRecurrente[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoFacturaRecurrente | undefined>()

  const [historialModal, setHistorialModal] = useState(false)
  const [historialRows,  setHistorialRows]  = useState<HistorialGeneracion[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [historialTitulo,  setHistorialTitulo]  = useState('')
  const [historialPlantillaId, setHistorialPlantillaId] = useState<string | null>(null)

  // Filtros avanzados
  const [recFilters,    setRecFilters]    = useState<RecAdFilters>({})
  const [recDraft,      setRecDraft]      = useState<RecAdFilters>({})
  const [recFilterOpen, setRecFilterOpen] = useState(false)
  const recActiveCount = useMemo(() => Object.entries(recFilters).filter(([, v]) =>
    v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
  ).length, [recFilters])
  const openRecFilters  = () => { setRecDraft({ ...recFilters }); setRecFilterOpen(true) }
  const applyRecFilters2 = () => { setRecFilters({ ...recDraft }); setRecFilterOpen(false) }
  const clearRecFilters  = () => { setRecDraft({}); setRecFilters({}); setRecFilterOpen(false) }
  const filteredRec = useMemo(() => {
    const afterSearch = search
      ? data.filter(r => r.clienteNombre?.toLowerCase().includes(search.toLowerCase()) || r.codigoPlantilla?.toLowerCase().includes(search.toLowerCase()))
      : data
    return applyRecFilters(afterSearch, recFilters)
  }, [data, search, recFilters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFacturasRecurrentes({ estado: filtroEstado, page, limit: 20 })
      const rows: FacturaRecurrente[] = res?.data ?? res ?? []
      setData(rows)
      setTotal(res?.total ?? rows.length)
    } catch { setData([]); setTotal(0) }
    finally { setLoading(false) }
  }, [filtroEstado, page])

  useEffect(() => { load() }, [load])

  const handlePausar = async (id: string) => {
    try { await pausarFacturaRecurrente(id); message.success('Pausada'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }
  const handleReanudar = async (id: string) => {
    try { await reanudarFacturaRecurrente(id); message.success('Reanudada'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }
  const handleCancelar = async (id: string) => {
    try { await cancelarFacturaRecurrente(id); message.success('Cancelada'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }
  const handleGenerarAhora = async (id: string, codigo: string) => {
    try {
      const res = await generarAhoraFacturaRecurrente(id)
      message.success(`Factura ${res.invoiceNumber} generada`)
      load()
      navigate(`/ventas/facturas/${res.facturaId}`)
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error al generar') }
  }
  const handleVerHistorial = async (r: FacturaRecurrente) => {
    setHistorialTitulo(`${r.codigoPlantilla} — ${r.clienteNombre}`)
    setHistorialPlantillaId(r.id)
    setHistorialModal(true)
    setHistorialLoading(true)
    try {
      const rows = await getHistorialFacturaRecurrente(r.id)
      setHistorialRows(rows)
    } catch { setHistorialRows([]) }
    finally { setHistorialLoading(false) }
  }

  const handleEliminarHistorial = async (historialId: string) => {
    if (!historialPlantillaId) return
    try {
      await eliminarHistorialFacturaRecurrente(historialPlantillaId, historialId)
      setHistorialRows(prev => prev.filter(r => r.id !== historialId))
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error al eliminar') }
  }

  const filtered = search
    ? data.filter(r => r.clienteNombre?.toLowerCase().includes(search.toLowerCase()) || r.codigoPlantilla?.toLowerCase().includes(search.toLowerCase()))
    : data

  const columns = [
    {
      title: 'Código',
      dataIndex: 'codigoPlantilla',
      width: 110,
      sorter: (a: FacturaRecurrente, b: FacturaRecurrente) => String(a.codigoPlantilla ?? '').localeCompare(String(b.codigoPlantilla ?? '')),
      render: (v: string, r: FacturaRecurrente) => (
        <Link to={`/ventas/facturas-recurrentes/${r.id}/editar`} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{v}</Link>
      ),
    },
    {
      title: 'Cliente',
      dataIndex: 'clienteNombre',
      sorter: (a: FacturaRecurrente, b: FacturaRecurrente) => String(a.clienteNombre ?? '').localeCompare(String(b.clienteNombre ?? '')),
      render: (v: string, r: FacturaRecurrente) => (
        <div>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.clienteNit}</Text>
        </div>
      ),
    },
    {
      title: 'Frecuencia',
      dataIndex: 'frecuencia',
      width: 110,
      sorter: (a: FacturaRecurrente, b: FacturaRecurrente) => String(a.frecuencia ?? '').localeCompare(String(b.frecuencia ?? '')),
      render: (v: string) => <Tag color="#1faec2">{FRECUENCIA_LABELS[v as keyof typeof FRECUENCIA_LABELS] ?? v}</Tag>,
    },
    {
      title: 'Próxima generación',
      dataIndex: 'fechaProximaGeneracion',
      width: 140,
      sorter: (a: FacturaRecurrente, b: FacturaRecurrente) => String(a.fechaProximaGeneracion ?? '').localeCompare(String(b.fechaProximaGeneracion ?? '')),
      render: (v: string) => {
        const d = dayjs(v)
        const atrasada = d.isBefore(dayjs(), 'day')
        return <Text style={{ color: atrasada ? '#e5484d' : '#1faec2', fontSize: 13 }}>{d.format('DD/MM/YYYY')}</Text>
      },
    },
    {
      title: 'Ocurrencias',
      width: 100,
      render: (_: any, r: FacturaRecurrente) => (
        <Text style={{ fontSize: 12 }}>
          {r.ocurrenciasGeneradas}
          {r.numeroMaximoOcurrencias ? ` / ${r.numeroMaximoOcurrencias}` : ''}
        </Text>
      ),
    },
    {
      title: 'FEL',
      dataIndex: 'generarFEL',
      width: 60,
      align: 'center' as const,
      render: (v: boolean) => v ? <Tag color="#2ea172" style={{ fontSize: 10 }}>FEL</Tag> : <Text type="secondary" style={{ fontSize: 10 }}>—</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 100,
      sorter: (a: FacturaRecurrente, b: FacturaRecurrente) => String(a.estado ?? '').localeCompare(String(b.estado ?? '')),
      render: (v: EstadoFacturaRecurrente) => {
        const cfg = ESTADO_CONFIG[v]
        return <Badge status={cfg?.color as any} text={cfg?.label ?? v} />
      },
    },
    {
      title: '',
      width: 160,
      render: (_: any, r: FacturaRecurrente) => (
        <Space size={4}>
          <Tooltip title="Ver historial">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => handleVerHistorial(r)} />
          </Tooltip>
          {r.estado === 'activa' && (
            <>
              <Tooltip title="Generar ahora">
                <Popconfirm title="¿Generar factura ahora?" onConfirm={() => handleGenerarAhora(r.id, r.codigoPlantilla)} okText="Sí" cancelText="No">
                  <Button size="small" icon={<ThunderboltOutlined />} type="primary" />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Pausar">
                <Popconfirm title="¿Pausar recurrencia?" onConfirm={() => handlePausar(r.id)} okText="Sí" cancelText="No">
                  <Button size="small" icon={<PauseCircleOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {r.estado === 'pausada' && (
            <Tooltip title="Reanudar">
              <Popconfirm title="¿Reanudar recurrencia?" onConfirm={() => handleReanudar(r.id)} okText="Sí" cancelText="No">
                <Button size="small" icon={<PlayCircleOutlined />} type="primary" ghost />
              </Popconfirm>
            </Tooltip>
          )}
          {(r.estado === 'activa' || r.estado === 'pausada') && (
            <Tooltip title="Cancelar">
              <Popconfirm title="¿Cancelar definitivamente?" onConfirm={() => handleCancelar(r.id)} okText="Sí" cancelText="No">
                <Button size="small" icon={<CloseCircleOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const historialCols = [
    { title: 'Fecha', dataIndex: 'fechaGeneracion', width: 150, render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    {
      title: 'Factura generada', dataIndex: 'numeroFactura', render: (v: string, r: HistorialGeneracion) => {
        if (!r.facturaGeneradaId) return <Text type="secondary">—</Text>
        if (r.facturaExiste === false) return (
          <Space size={6}>
            <Tooltip title="Esta factura fue eliminada">
              <Text delete type="secondary" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>
            </Tooltip>
            <Popconfirm title="¿Eliminar este registro del historial?" okText="Sí" cancelText="No" onConfirm={() => handleEliminarHistorial(r.id)}>
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          </Space>
        )
        return <Link to={`/ventas/facturas/${r.facturaGeneradaId}`} style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{v}</Link>
      }
    },
    { title: 'UUID FEL', dataIndex: 'felUuid', width: 200, render: (v: string) => v ? <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{v}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Estado', dataIndex: 'estadoGeneracion', width: 90,
      render: (v: string) => <Tag color={v === 'EXITOSA' ? 'success' : 'error'}>{v}</Tag>,
    },
    { title: 'Error', dataIndex: 'mensajeError', render: (v: string) => v ? <Text type="danger" style={{ fontSize: 11 }}>{v}</Text> : null },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HistoryOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Facturas Recurrentes</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Plantillas de facturación automática</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }} onClick={() => navigate('/ventas/facturas-recurrentes/nueva')}>
          Nueva plantilla
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search placeholder="Buscar por cliente o código..." style={{ maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
        <Badge count={recActiveCount} size="small" color="#1faec2" offset={[-4, 4]}>
          <Button size="small" icon={<FilterOutlined />} onClick={openRecFilters}
            style={recActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}>
            Filtros
          </Button>
        </Badge>
      </div>

      <Table
        dataSource={filteredRec}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        showSorterTooltip={false}
        pagination={{ total, pageSize: 20, current: page, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 'max-content', y: 'calc(100vh - 330px)' }}
        style={{ background: '#fff', borderRadius: 10 }}
      />

      <Modal
        title={<><HistoryOutlined /> Historial — {historialTitulo}</>}
        open={historialModal}
        onCancel={() => setHistorialModal(false)}
        footer={null}
        width={860}
      >
        <Table
          dataSource={historialRows}
          columns={historialCols}
          rowKey="id"
          loading={historialLoading}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Modal>

      {/* Drawer filtros avanzados */}
      <Drawer
        title={<Space><FilterOutlined style={{ color: '#1faec2' }} /><span>Filtros avanzados</span></Space>}
        open={recFilterOpen}
        onClose={() => setRecFilterOpen(false)}
        width={400}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={clearRecFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyRecFilters2}>
              Aplicar{recActiveCount > 0 ? ` (${recActiveCount})` : ''}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Estado</Text>
            <div style={{ marginTop: 6 }}>
              <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todos los estados"
                value={recDraft.filterEstado ?? []}
                options={Object.entries(ESTADO_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                onChange={v => setRecDraft(d => ({ ...d, filterEstado: v.length ? v : undefined }))} />
            </div>
          </div>
          <Divider style={{ margin: '4px 0' }} />
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Frecuencia</Text>
            <div style={{ marginTop: 6 }}>
              <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todas las frecuencias"
                value={recDraft.filterFrecuencia ?? []}
                options={Object.entries(FRECUENCIA_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                onChange={v => setRecDraft(d => ({ ...d, filterFrecuencia: v.length ? v : undefined }))} />
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
