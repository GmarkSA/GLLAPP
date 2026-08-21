import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Space, Popconfirm, message, DatePicker, Select,
  Typography, Tooltip, Input, Drawer, InputNumber, Divider, Badge,
} from 'antd'
import {
  PlusOutlined, FileTextOutlined, CheckCircleOutlined,
  StopOutlined, RollbackOutlined, DeleteOutlined, ReloadOutlined,
  CopyOutlined, EditOutlined, FilterOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  getAsientos, getAsiento, postAsiento, voidAsiento, reverseAsiento, deleteAsiento, resetToDraftAsiento,
  type AsientoListItem, type GetAsientosParams,
} from '../../../api/asientos'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', posted: 'success', void: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', posted: 'Publicado', void: 'Anulado',
}
const TYPE_LABEL: Record<string, string> = {
  manual: 'Manual', auto: 'Automático', recurring: 'Recurrente',
  opening: 'Apertura', closing: 'Cierre', adjustment: 'Ajuste',
}

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface DmAdFilters {
  filterEntryNumber?: string
  filterReference?: string
  filterTotalMin?: number | null
  filterTotalMax?: number | null
}

const DM_EMPTY: DmAdFilters = {}

function applyDmFilters(data: AsientoListItem[], f: DmAdFilters): AsientoListItem[] {
  return data.filter(r => {
    if (f.filterEntryNumber && !r.entryNumber?.toLowerCase().includes(f.filterEntryNumber.toLowerCase())) return false
    if (f.filterReference && !r.reference?.toLowerCase().includes(f.filterReference.toLowerCase())) return false
    if (f.filterTotalMin != null && Number(r.totalDebit ?? 0) < f.filterTotalMin) return false
    if (f.filterTotalMax != null && Number(r.totalDebit ?? 0) > f.filterTotalMax) return false
    return true
  })
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

  // Filtros avanzados
  const [dmFilters,    setDmFilters]    = useState<DmAdFilters>(DM_EMPTY)
  const [dmDraft,      setDmDraft]      = useState<DmAdFilters>(DM_EMPTY)
  const [dmFilterOpen, setDmFilterOpen] = useState(false)

  const dmActiveCount = useMemo(() =>
    Object.entries(dmFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [dmFilters])

  const filteredData = useMemo(() => applyDmFilters(data, dmFilters), [data, dmFilters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: GetAsientosParams = { page, limit: 200, soloManuales: true }
      if (search)       params.search     = search
      if (filtroEstado) params.estado     = filtroEstado
      if (filtroTipo)   params.tipo       = filtroTipo
      if (rango?.[0])   params.fechaDesde = rango[0].format('YYYY-MM-DD')
      if (rango?.[1])   params.fechaHasta = rango[1].format('YYYY-MM-DD')
      const res = await getAsientos(params)
      setData(res.data)
      setTotal((res as any)?.meta?.total ?? res.total ?? 0)
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

  const openDmFilters = () => { setDmDraft(dmFilters); setDmFilterOpen(true) }
  const applyDmFiltersHandler = () => { setDmFilters(dmDraft); setDmFilterOpen(false) }
  const clearDmFilters = () => { setDmDraft(DM_EMPTY); setDmFilters(DM_EMPTY) }

  const columns = [
    {
      title: 'Fecha', dataIndex: 'entryDate', width: 105,
      defaultSortOrder: 'descend' as const,
      sorter: (a: AsientoListItem, b: AsientoListItem) =>
        a.entryDate.localeCompare(b.entryDate),
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'N.º Diario', dataIndex: 'entryNumber', width: 145,
      sorter: (a: AsientoListItem, b: AsientoListItem) => (a.entryNumber ?? '').localeCompare(b.entryNumber ?? ''),
      render: (v: string, r: AsientoListItem) => (
        <Button type="link" size="small" style={{ padding: 0, fontWeight: 500 }}
          onClick={() => navigate(`/contabilidad/diarios-manuales/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Descripción', dataIndex: 'description', ellipsis: true,
      sorter: (a: AsientoListItem, b: AsientoListItem) => (a.description ?? '').localeCompare(b.description ?? ''),
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ color: '#0a0a0a' }}>{v || <span style={{ color: '#9aa1ab' }}>—</span>}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Referencia', dataIndex: 'reference', width: 150,
      sorter: (a: AsientoListItem, b: AsientoListItem) => (a.reference ?? '').localeCompare(b.reference ?? ''),
      render: (v?: string) => v
        ? <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        : <span style={{ color: '#9aa1ab' }}>—</span>,
    },
    {
      title: 'Tipo', dataIndex: 'type', width: 105,
      sorter: (a: AsientoListItem, b: AsientoListItem) => (a.type ?? '').localeCompare(b.type ?? ''),
      render: (v: string) => TYPE_LABEL[v] ?? v,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 105,
      sorter: (a: AsientoListItem, b: AsientoListItem) => (a.status ?? '').localeCompare(b.status ?? ''),
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Total', dataIndex: 'totalDebit', width: 150, align: 'right' as const,
      sorter: (a: AsientoListItem, b: AsientoListItem) => Number(a.totalDebit ?? 0) - Number(b.totalDebit ?? 0),
      render: (v: number, r: AsientoListItem) => (
        <span style={{ fontWeight: 500 }}>
          <span style={{ color: '#6b7280', fontSize: 11, marginRight: 4 }}>{r.currency ?? 'GTQ'}</span>
          {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </span>
      ),
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

          {/* Publicar (solo draft) */}
          {r.status === 'draft' && (
            <Tooltip title="Publicar / Contabilizar">
              <Popconfirm title="¿Publicar este asiento? Quedará registrado en los reportes financieros."
                okText="Publicar"
                onConfirm={() => act(r.id, () => postAsiento(r.id), 'Asiento publicado')}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  style={{ background: '#1faec2' }} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Colocar en borrador (solo posted) */}
          {r.status === 'posted' && (
            <Tooltip title="Colocar en borrador">
              <Popconfirm title="¿Regresar a borrador? El asiento dejará de afectar los reportes financieros."
                okText="Sí, borrador"
                onConfirm={() => act(r.id, () => resetToDraftAsiento(r.id), 'Asiento regresado a borrador')}>
                <Button size="small" icon={<EditOutlined />} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Revertir (solo posted) */}
          {r.status === 'posted' && (
            <Tooltip title="Crear asiento de reversión">
              <Popconfirm title="¿Crear asiento de reversión? Se generará un borrador con débitos y créditos invertidos."
                okText="Revertir"
                onConfirm={() => act(r.id, () => reverseAsiento(r.id), 'Reversión creada como borrador')}>
                <Button size="small" icon={<RollbackOutlined />} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Anular (solo posted) */}
          {r.status === 'posted' && (
            <Tooltip title="Anular">
              <Popconfirm title="¿Anular este asiento? Esta acción no puede deshacerse."
                okText="Anular" okButtonProps={{ danger: true }}
                onConfirm={() => act(r.id, () => voidAsiento(r.id), 'Asiento anulado')}>
                <Button size="small" danger icon={<StopOutlined />} loading={acting === r.id} />
              </Popconfirm>
            </Tooltip>
          )}

          {/* Eliminar (draft o void) */}
          {(r.status === 'draft' || r.status === 'void') && (
            <Tooltip title="Eliminar">
              <Popconfirm title="¿Eliminar este asiento permanentemente?"
                okText="Eliminar" okButtonProps={{ danger: true }}
                onConfirm={() => act(r.id, () => deleteAsiento(r.id), 'Asiento eliminado')}>
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
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Todos los diarios manuales</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#1faec2' }}
            onClick={() => navigate('/contabilidad/diarios-manuales/nuevo')}>
            Nuevo
          </Button>
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Buscar por N.º, referencia o descripción..."
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
            { label: 'Borrador',  value: 'draft' },
            { label: 'Publicado', value: 'posted' },
            { label: 'Anulado',   value: 'void' },
          ]}
        />
        <Select
          placeholder="Tipo" allowClear style={{ width: 140 }}
          onChange={v => { setFiltroTipo(v); setPage(1) }}
          options={[
            { label: 'Manual',     value: 'manual' },
            { label: 'Recurrente', value: 'recurring' },
            { label: 'Apertura',   value: 'opening' },
            { label: 'Cierre',     value: 'closing' },
            { label: 'Ajuste',     value: 'adjustment' },
          ]}
        />
        <Badge count={dmActiveCount} size="small">
          <Button
            icon={<FilterOutlined />}
            onClick={openDmFilters}
            style={dmActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
          >
            Filtros
          </Button>
        </Badge>
      </Space>

      <Table
        dataSource={filteredData} columns={columns} rowKey="id"
        loading={loading} size="small"
        showSorterTooltip={false}
        onRow={r => ({ onDoubleClick: () => navigate(`/contabilidad/diarios-manuales/${r.id}`) })}
        pagination={{
          current: page, pageSize: 200, total,
          onChange: p => setPage(p),
          showTotal: t => `${t} registros`,
        }}
      />

      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={340}
        open={dmFilterOpen}
        onClose={() => setDmFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearDmFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyDmFiltersHandler}>Aplicar</Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Identificación</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="N.° Diario" size="small" value={dmDraft.filterEntryNumber ?? ''} onChange={e => setDmDraft(d => ({ ...d, filterEntryNumber: e.target.value || undefined }))} allowClear />
          <Input placeholder="Referencia" size="small" value={dmDraft.filterReference ?? ''} onChange={e => setDmDraft(d => ({ ...d, filterReference: e.target.value || undefined }))} allowClear />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Monto total</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={dmDraft.filterTotalMin ?? null} onChange={v => setDmDraft(d => ({ ...d, filterTotalMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={dmDraft.filterTotalMax ?? null} onChange={v => setDmDraft(d => ({ ...d, filterTotalMax: v ?? null }))} min={0} prefix="Q" />
        </div>
      </Drawer>
    </div>
  )
}
