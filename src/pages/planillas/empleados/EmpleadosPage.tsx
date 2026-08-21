import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Input, Space, Switch, Table, Tag, Typography, message,
  Drawer, InputNumber, Divider, Badge, Select,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, SearchOutlined, TeamOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getEmpleados, nombreCompleto, type Empleado } from '../../../api/planillas-empleados'

const { Text, Title } = Typography
const NAVY = '#1faec2'
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const JORNADA_LABEL: Record<string, string> = { DIURNA: 'Diurna', NOCTURNA: 'Nocturna', MIXTA: 'Mixta' }
const ESTADO_COLOR: Record<string, string> = { ACTIVO: '#2ea172', SUSPENDIDO: '#ff7f00', BAJA: 'default' }

interface EmpAdFilters {
  puesto?: string
  jornada?: string[]
  estado?: string[]
  salarioMin?: number | null
  salarioMax?: number | null
}

const EMPTY_EMP: EmpAdFilters = { puesto: '', jornada: [], estado: [], salarioMin: null, salarioMax: null }

function applyEmpFilters(list: Empleado[], f: EmpAdFilters): Empleado[] {
  return list.filter(e => {
    if (f.puesto && !(e.puesto ?? '').toLowerCase().includes(f.puesto.toLowerCase())) return false
    if (f.jornada?.length && !f.jornada.includes(e.tipoJornada)) return false
    if (f.estado?.length && !f.estado.includes(e.estado)) return false
    if (f.salarioMin != null && (e.salarioVigente ?? 0) < f.salarioMin) return false
    if (f.salarioMax != null && (e.salarioVigente ?? 0) > f.salarioMax) return false
    return true
  })
}

export default function EmpleadosPage() {
  const navigate = useNavigate()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [incluirBajas, setIncluirBajas] = useState(false)
  const [empFilters, setEmpFilters] = useState<EmpAdFilters>(EMPTY_EMP)
  const [empDraft, setEmpDraft] = useState<EmpAdFilters>(EMPTY_EMP)
  const [empFilterOpen, setEmpFilterOpen] = useState(false)

  const activeCount = useMemo(() =>
    Object.entries(empFilters).filter(([, v]) => v != null && (Array.isArray(v) ? v.length > 0 : v !== '')).length,
    [empFilters])

  useEffect(() => {
    setLoading(true)
    getEmpleados(incluirBajas)
      .then(setEmpleados)
      .catch(() => message.error('Error cargando empleados'))
      .finally(() => setLoading(false))
  }, [incluirBajas])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const bySearch = !q ? empleados : empleados.filter(e =>
      e.codigo.toLowerCase().includes(q) ||
      nombreCompleto(e).toLowerCase().includes(q) ||
      (e.puesto ?? '').toLowerCase().includes(q) ||
      (e.nit ?? '').toLowerCase().includes(q))
    return applyEmpFilters(bySearch, empFilters)
  }, [empleados, busqueda, empFilters])

  const columns: ColumnsType<Empleado> = [
    {
      title: 'Código', dataIndex: 'codigo', width: 90,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>,
      sorter: (a, b) => a.codigo.localeCompare(b.codigo),
    },
    {
      title: 'Nombre', key: 'nombre',
      render: (_, e) => (
        <div>
          <Text strong style={{ fontSize: 12, color: NAVY }}>{nombreCompleto(e)}</Text>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{e.puesto ?? 'sin puesto'}</div>
        </div>
      ),
      sorter: (a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)),
    },
    {
      title: 'Jornada', dataIndex: 'tipoJornada', width: 100,
      render: v => <Tag style={{ fontSize: 10 }}>{JORNADA_LABEL[v] ?? v}</Tag>,
      sorter: (a, b) => (a.tipoJornada ?? '').localeCompare(b.tipoJornada ?? ''),
    },
    {
      title: 'Salario vigente', key: 'salario', width: 140, align: 'right',
      render: (_, e) => e.salarioVigente != null
        ? (
          <div>
            <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(e.salarioVigente)}</Text>
            {e.salarioDesde && <div style={{ fontSize: 10, color: '#6b7280' }}>desde {dayjs(e.salarioDesde).format('DD/MM/YYYY')}</div>}
          </div>
        )
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
      sorter: (a, b) => (a.salarioVigente ?? 0) - (b.salarioVigente ?? 0),
    },
    {
      title: 'Afiliado IGSS', dataIndex: 'numeroAfiliadoIGSS', width: 130,
      render: v => v
        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v}</Text>
        : <Tag color="#ff7f00" style={{ fontSize: 10 }}>pendiente</Tag>,
    },
    {
      title: 'Alta', dataIndex: 'fechaAlta', width: 105,
      render: v => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text>,
      sorter: (a, b) => a.fechaAlta.localeCompare(b.fechaAlta),
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 100,
      render: v => <Tag color={ESTADO_COLOR[v]} style={{ fontSize: 10 }}>{v}</Tag>,
      sorter: (a, b) => a.estado.localeCompare(b.estado),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TeamOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Empleados</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Expediente laboral, historial salarial y datos IGSS
            </Text>
          </div>
        </div>
        <Space wrap>
          <Input
            placeholder="Buscar por código, nombre, puesto o NIT"
            prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            allowClear style={{ width: 280 }}
          />
          <Space size={4}>
            <Switch size="small" checked={incluirBajas} onChange={setIncluirBajas} />
            <Text style={{ fontSize: 12 }}>incluir bajas</Text>
          </Space>
          <Badge count={activeCount} size="small">
            <Button icon={<FilterOutlined />} onClick={() => { setEmpDraft(empFilters); setEmpFilterOpen(true) }}>
              Filtros
            </Button>
          </Badge>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }}
            onClick={() => navigate('/planillas/empleados/nuevo')}>
            Nuevo empleado
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          scroll={{ y: 'calc(100vh - 330px)' }}
          size="small" rowKey="id" loading={loading}
          dataSource={filtrados} columns={columns}
          showSorterTooltip={false}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          onRow={e => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/planillas/empleados/${e.id}`),
          })}
          locale={{ emptyText: 'Sin empleados registrados. Crea el primero con "Nuevo empleado".' }}
        />
      </Card>

      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={340}
        open={empFilterOpen}
        onClose={() => setEmpFilterOpen(false)}
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setEmpFilters(EMPTY_EMP); setEmpDraft(EMPTY_EMP); setEmpFilterOpen(false) }}>
              Limpiar
            </Button>
            <Button type="primary" style={{ background: NAVY }} onClick={() => { setEmpFilters(empDraft); setEmpFilterOpen(false) }}>
              Aplicar
            </Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#374151' }}>Puesto</Text>
        <Input
          placeholder="Filtrar por puesto"
          value={empDraft.puesto ?? ''}
          onChange={e => setEmpDraft(d => ({ ...d, puesto: e.target.value }))}
          allowClear style={{ marginTop: 6 }}
        />

        <Divider style={{ margin: '16px 0 12px' }} />
        <Text strong style={{ fontSize: 12, color: '#374151' }}>Clasificación</Text>

        <div style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>Jornada</Text>
          <Select
            mode="multiple" allowClear placeholder="Todas"
            value={empDraft.jornada ?? []}
            onChange={v => setEmpDraft(d => ({ ...d, jornada: v }))}
            style={{ width: '100%', marginTop: 4 }}
            options={[
              { value: 'DIURNA', label: 'Diurna' },
              { value: 'NOCTURNA', label: 'Nocturna' },
              { value: 'MIXTA', label: 'Mixta' },
            ]}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>Estado</Text>
          <Select
            mode="multiple" allowClear placeholder="Todos"
            value={empDraft.estado ?? []}
            onChange={v => setEmpDraft(d => ({ ...d, estado: v }))}
            style={{ width: '100%', marginTop: 4 }}
            options={[
              { value: 'ACTIVO', label: 'Activo' },
              { value: 'SUSPENDIDO', label: 'Suspendido' },
              { value: 'BAJA', label: 'Baja' },
            ]}
          />
        </div>

        <Divider style={{ margin: '16px 0 12px' }} />
        <Text strong style={{ fontSize: 12, color: '#374151' }}>Salario vigente</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <div>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>Mínimo (Q)</Text>
            <InputNumber
              placeholder="0.00" style={{ width: '100%', marginTop: 4 }}
              value={empDraft.salarioMin ?? undefined}
              onChange={v => setEmpDraft(d => ({ ...d, salarioMin: v ?? null }))}
              min={0} step={100}
            />
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>Máximo (Q)</Text>
            <InputNumber
              placeholder="0.00" style={{ width: '100%', marginTop: 4 }}
              value={empDraft.salarioMax ?? undefined}
              onChange={v => setEmpDraft(d => ({ ...d, salarioMax: v ?? null }))}
              min={0} step={100}
            />
          </div>
        </div>
      </Drawer>
    </div>
  )
}
