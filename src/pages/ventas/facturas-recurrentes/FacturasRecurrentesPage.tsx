import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Button, Table, Typography, Tag, Badge, Space, Select, Input,
  Popconfirm, message, Tooltip, Modal,
} from 'antd'
import {
  PlusOutlined, PauseCircleOutlined, PlayCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, HistoryOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getFacturasRecurrentes, pausarFacturaRecurrente, reanudarFacturaRecurrente,
  cancelarFacturaRecurrente, generarAhoraFacturaRecurrente,
  getHistorialFacturaRecurrente,
  FRECUENCIA_LABELS, ESTADO_CONFIG,
  type FacturaRecurrente, type HistorialGeneracion,
  type EstadoFacturaRecurrente,
} from '../../../api/facturas-recurrentes'

const { Text, Title } = Typography

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

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
    setHistorialModal(true)
    setHistorialLoading(true)
    try {
      const rows = await getHistorialFacturaRecurrente(r.id)
      setHistorialRows(rows)
    } catch { setHistorialRows([]) }
    finally { setHistorialLoading(false) }
  }

  const filtered = search
    ? data.filter(r => r.clienteNombre?.toLowerCase().includes(search.toLowerCase()) || r.codigoPlantilla?.toLowerCase().includes(search.toLowerCase()))
    : data

  const columns = [
    {
      title: 'Código',
      dataIndex: 'codigoPlantilla',
      width: 110,
      render: (v: string, r: FacturaRecurrente) => (
        <Link to={`/ventas/facturas-recurrentes/${r.id}/editar`} style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{v}</Link>
      ),
    },
    {
      title: 'Cliente',
      dataIndex: 'clienteNombre',
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
      render: (v: string) => <Tag color="blue">{FRECUENCIA_LABELS[v as keyof typeof FRECUENCIA_LABELS] ?? v}</Tag>,
    },
    {
      title: 'Próxima generación',
      dataIndex: 'fechaProximaGeneracion',
      width: 140,
      render: (v: string) => {
        const d = dayjs(v)
        const atrasada = d.isBefore(dayjs(), 'day')
        return <Text style={{ color: atrasada ? '#ff4d4f' : '#1B3A6B', fontSize: 13 }}>{d.format('DD/MM/YYYY')}</Text>
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
      render: (v: boolean) => v ? <Tag color="green" style={{ fontSize: 10 }}>FEL</Tag> : <Text type="secondary" style={{ fontSize: 10 }}>—</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 100,
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
      title: 'Factura generada', dataIndex: 'numeroFactura', render: (v: string, r: HistorialGeneracion) =>
        r.facturaGeneradaId ? <Link to={`/ventas/facturas/${r.facturaGeneradaId}`} style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Link>
          : <Text type="secondary">—</Text>
    },
    { title: 'UUID FEL', dataIndex: 'felUuid', width: 200, render: (v: string) => v ? <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Estado', dataIndex: 'estadoGeneracion', width: 90,
      render: (v: string) => <Tag color={v === 'EXITOSA' ? 'success' : 'error'}>{v}</Tag>,
    },
    { title: 'Error', dataIndex: 'mensajeError', render: (v: string) => v ? <Text type="danger" style={{ fontSize: 11 }}>{v}</Text> : null },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Facturas Recurrentes</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Plantillas de facturación automática</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }} onClick={() => navigate('/ventas/facturas-recurrentes/nueva')}>
          Nueva plantilla
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input.Search placeholder="Buscar por cliente o código..." style={{ maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
        <Select placeholder="Estado" allowClear style={{ width: 160 }} value={filtroEstado} onChange={setFiltroEstado}>
          {Object.entries(ESTADO_CONFIG).map(([k, v]) => <Select.Option key={k} value={k}>{v.label}</Select.Option>)}
        </Select>
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ total, pageSize: 20, current: page, onChange: setPage, showSizeChanger: false }}
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
    </div>
  )
}
