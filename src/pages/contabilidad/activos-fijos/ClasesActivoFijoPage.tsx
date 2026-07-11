import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, message, Form, InputNumber,
  Switch, Typography, Alert, Popconfirm, Divider,
} from 'antd'
import {
  ReloadOutlined, LockOutlined, UnlockOutlined,
  DeleteOutlined, SettingOutlined, UpOutlined,
} from '@ant-design/icons'
import AccountSelect from '../../../components/AccountSelect'
import {
  getClasesActivoFijo, actualizarClaseActivoFijo, eliminarClaseActivoFijo, seedGuatemalaClases,
  type ClaseActivoFijo,
} from '../../../api/clases-activo-fijo'

const { Title, Text } = Typography

const CUENTAS_FIELDS = [
  { name: 'cuentaAltasId',                label: 'Altas (costo del activo)' },
  { name: 'cuentaDepreciacionAcumuladaId', label: 'Depreciación Acumulada (contra-activo)' },
  { name: 'cuentaGastoDepreciacionId',     label: 'Gasto de Depreciación' },
  { name: 'cuentaGananciaPorVentaId',      label: 'Ganancia por Venta AF' },
  { name: 'cuentaPerdidaPorDeterioro',     label: 'Pérdida por Deterioro AF' },
  { name: 'cuentaPerdidaPorVentaId',       label: 'Pérdida por Venta AF' },
  { name: 'cuentaGananciaActivoFijoId',    label: 'Ganancia en AF (otras)' },
]

function InlineForm({ record, onSaved }: { record: ClaseActivoFijo; onSaved: () => void }) {
  const [form]   = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => { form.setFieldsValue({ ...record }) }, [record, form])

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await actualizarClaseActivoFijo(record.id!, vals)
      message.success('Clase actualizada')
      onSaved()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '12px 24px 16px', background: '#fafafa', borderTop: '1px solid #e8e8e8' }}>
      <Form form={form} layout="vertical" size="small">
        {/* Cuentas contables — 2 columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          {CUENTAS_FIELDS.map(f => (
            <Form.Item key={f.name} name={f.name} label={<Text style={{ fontSize: 11 }}>{f.label}</Text>} style={{ marginBottom: 8 }}>
              <AccountSelect filter={{}} placeholder="Seleccionar cuenta..." />
            </Form.Item>
          ))}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* Parámetros de depreciación */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr', gap: '0 24px', alignItems: 'end' }}>
          <Form.Item name="tasaDepreciacionAnual" label="Tasa anual (decimal)" style={{ marginBottom: 0 }}>
            <InputNumber style={{ width: '100%' }} min={0} max={1} precision={4} step={0.01} />
          </Form.Item>
          <Form.Item name="vidaUtilMeses" label="Vida útil (meses)" style={{ marginBottom: 0 }}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="esNoDepreciable" label="No depreciable" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
        </div>

        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button type="primary" size="small" loading={saving} onClick={handleSave}
            style={{ background: '#1B3A6B' }}>
            Guardar cambios
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default function ClasesActivoFijoPage() {
  const [data,       setData]       = useState<ClaseActivoFijo[]>([])
  const [loading,    setLoading]    = useState(false)
  const [seeding,    setSeeding]    = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getClasesActivoFijo()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedGuatemalaClases()
      message.success('Clases de activo fijo Guatemala ISR generadas')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al generar clases')
    } finally { setSeeding(false) }
  }

  const handleBloquear = async (r: ClaseActivoFijo) => {
    try {
      await actualizarClaseActivoFijo(r.id!, { activo: !r.activo })
      message.success(r.activo ? 'Clase bloqueada' : 'Clase desbloqueada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const handleEliminar = async (id: string) => {
    try {
      await eliminarClaseActivoFijo(id)
      message.success('Clase eliminada')
      if (expandedId === id) setExpandedId(null)
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', width: 80 },
    { title: 'Clase',  dataIndex: 'nombre' },
    {
      title: 'Tasa Anual', dataIndex: 'tasaDepreciacionAnual', width: 100, align: 'right' as const,
      render: (v: number) => `${(Number(v) * 100).toFixed(2)}%`,
    },
    {
      title: 'Vida Útil', dataIndex: 'vidaUtilMeses', width: 100,
      render: (v: number | null) => v ? `${v} meses` : '—',
    },
    {
      title: 'Depreciable', dataIndex: 'esNoDepreciable', width: 100,
      render: (v: boolean) => <Tag color={v ? 'default' : 'success'}>{v ? 'No' : 'Sí'}</Tag>,
    },
    {
      title: 'Cuentas', width: 90,
      render: (_: any, r: ClaseActivoFijo) => {
        const n = [
          r.cuentaAltasId, r.cuentaDepreciacionAcumuladaId, r.cuentaGastoDepreciacionId,
          r.cuentaGananciaPorVentaId, r.cuentaPerdidaPorDeterioro, r.cuentaPerdidaPorVentaId,
          r.cuentaGananciaActivoFijoId,
        ].filter(Boolean).length
        return <Tag color={n === 7 ? 'success' : n > 0 ? 'warning' : 'default'}>{n}/7</Tag>
      },
    },
    {
      title: 'Estado', dataIndex: 'activo', width: 80,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Bloqueado'}</Tag>,
    },
    {
      title: 'Acciones', width: 220,
      render: (_: any, r: ClaseActivoFijo) => {
        const isExpanded = expandedId === r.id
        const hasId = !!r.id
        return (
          <Space size={4}>
            <Button
              size="small"
              icon={isExpanded ? <UpOutlined /> : <SettingOutlined />}
              onClick={() => setExpandedId(isExpanded ? null : (r.id ?? null))}
              disabled={!hasId}
              type={isExpanded ? 'primary' : 'default'}
              style={isExpanded ? { background: '#1B3A6B' } : undefined}
            >
              {isExpanded ? 'Cerrar' : 'Configurar'}
            </Button>
            <Popconfirm
              title={r.activo ? '¿Bloquear esta clase?' : '¿Desbloquear esta clase?'}
              onConfirm={() => handleBloquear(r)}
              disabled={!hasId}
            >
              <Button
                size="small"
                icon={r.activo ? <LockOutlined /> : <UnlockOutlined />}
                danger={r.activo}
                disabled={!hasId}
                style={!r.activo && hasId ? { color: '#52c41a', borderColor: '#52c41a' } : undefined}
              >
                {r.activo ? 'Bloquear' : 'Desbloquear'}
              </Button>
            </Popconfirm>
            <Popconfirm
              title="¿Eliminar esta clase de activo fijo?"
              onConfirm={() => handleEliminar(r.id!)}
              disabled={!hasId}
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!hasId} />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Clases de Activo Fijo (ISR Guatemala)</Title>
        <Button icon={<ReloadOutlined />} loading={seeding} onClick={handleSeed}>
          Generar clases Guatemala
        </Button>
      </div>

      {data.length === 0 && !loading && (
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="Sin clases configuradas"
          description='Haz clic en "Generar clases Guatemala" para crear las clases del ISR Art. 19 bis automáticamente.'
        />
      )}

      <Table
        dataSource={data}
        columns={columns}
        rowKey={r => r.id ?? r.codigo}
        loading={loading}
        size="small"
        pagination={{ pageSize: 50 }}
        expandable={{
          expandedRowKeys: expandedId ? [expandedId] : [],
          showExpandColumn: false,
          expandedRowRender: (r: ClaseActivoFijo) => (
            <InlineForm record={r} onSaved={load} />
          ),
          rowExpandable: (r: ClaseActivoFijo) => !!r.id,
        }}
      />
    </div>
  )
}
