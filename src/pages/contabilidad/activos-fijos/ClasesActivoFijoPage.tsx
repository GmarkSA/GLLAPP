import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, message, InputNumber,
  Switch, Typography, Alert, Popconfirm, Modal, Form, Input,
} from 'antd'
import {
  ReloadOutlined, LockOutlined, UnlockOutlined,
  DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import AccountSelect from '../../../components/AccountSelect'
import {
  getClasesActivoFijo, actualizarClaseActivoFijo, eliminarClaseActivoFijo, seedGuatemalaClases,
  type ClaseActivoFijo,
} from '../../../api/clases-activo-fijo'

const { Title } = Typography

type EditForm = Omit<ClaseActivoFijo, 'id' | 'companyId' | 'activo'>

export default function ClasesActivoFijoPage() {
  const [data,    setData]    = useState<ClaseActivoFijo[]>([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState<ClaseActivoFijo | null>(null)
  const [form]  = Form.useForm<EditForm>()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getClasesActivoFijo()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (r: ClaseActivoFijo) => {
    setEditing(r)
    form.setFieldsValue({
      nombre:                      r.nombre,
      tasaDepreciacionAnual:        r.tasaDepreciacionAnual,
      vidaUtilMeses:                r.vidaUtilMeses ?? undefined,
      esNoDepreciable:              r.esNoDepreciable,
      cuentaAltasId:                r.cuentaAltasId ?? undefined,
      cuentaDepreciacionAcumuladaId: r.cuentaDepreciacionAcumuladaId ?? undefined,
      cuentaGastoDepreciacionId:    r.cuentaGastoDepreciacionId ?? undefined,
      cuentaGananciaPorVentaId:     r.cuentaGananciaPorVentaId ?? undefined,
      cuentaPerdidaPorDeterioro:    r.cuentaPerdidaPorDeterioro ?? undefined,
      cuentaPerdidaPorVentaId:      r.cuentaPerdidaPorVentaId ?? undefined,
      cuentaGananciaActivoFijoId:   r.cuentaGananciaActivoFijoId ?? undefined,
    } as any)
    setModal(true)
  }

  const handleSave = async () => {
    if (!editing?.id) return
    const vals = form.getFieldsValue()
    setSaving(true)
    try {
      await actualizarClaseActivoFijo(editing.id, vals)
      message.success(`${editing.codigo} guardado`)
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleBloquear = async (r: ClaseActivoFijo) => {
    if (!r.id) return
    try {
      await actualizarClaseActivoFijo(r.id, { activo: !r.activo })
      message.success(r.activo ? 'Clase bloqueada' : 'Clase desbloqueada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const handleEliminar = async (r: ClaseActivoFijo) => {
    if (!r.id) return
    try {
      await eliminarClaseActivoFijo(r.id)
      message.success('Clase eliminada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try { await seedGuatemalaClases(); message.success('Clases Guatemala generadas'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
    finally { setSeeding(false) }
  }

  const countCuentas = (r: ClaseActivoFijo) =>
    [r.cuentaAltasId, r.cuentaDepreciacionAcumuladaId, r.cuentaGastoDepreciacionId,
     r.cuentaGananciaPorVentaId, r.cuentaPerdidaPorDeterioro, r.cuentaPerdidaPorVentaId,
     r.cuentaGananciaActivoFijoId].filter(Boolean).length

  const columns = [
    {
      title: 'Código', dataIndex: 'codigo', width: 80,
      render: (v: string, r: ClaseActivoFijo) => (
        <span style={{ fontFamily: 'monospace', color: '#1B3A6B', fontWeight: 600 }}>
          {v}{!r.id && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>plantilla</Tag>}
        </span>
      ),
    },
    { title: 'Clase de Activo', dataIndex: 'nombre', ellipsis: true },
    {
      title: 'Tasa Anual', width: 100, align: 'right' as const,
      render: (_: unknown, r: ClaseActivoFijo) => (
        <span style={{ fontFamily: 'monospace' }}>
          {((r.tasaDepreciacionAnual || 0) * 100).toFixed(2)}%
        </span>
      ),
    },
    {
      title: 'Vida Útil', width: 90, align: 'right' as const,
      render: (_: unknown, r: ClaseActivoFijo) =>
        r.vidaUtilMeses ? `${r.vidaUtilMeses} m` : '—',
    },
    {
      title: 'No Dep.', width: 75, align: 'center' as const,
      render: (_: unknown, r: ClaseActivoFijo) =>
        r.esNoDepreciable ? <Tag color="orange">Sí</Tag> : <Tag color="default">No</Tag>,
    },
    {
      title: 'Cuentas', width: 85, align: 'center' as const,
      render: (_: unknown, r: ClaseActivoFijo) => {
        const n = countCuentas(r)
        return <Tag color={n === 7 ? 'success' : n > 0 ? 'warning' : 'default'}>{n}/7</Tag>
      },
    },
    {
      title: 'Estado', width: 90,
      render: (_: unknown, r: ClaseActivoFijo) => r.id
        ? <Tag color={r.activo ? 'success' : 'default'}>{r.activo ? 'Activo' : 'Bloqueado'}</Tag>
        : <Tag color="blue">Plantilla</Tag>,
    },
    {
      title: 'Acciones', width: 150,
      render: (_: unknown, r: ClaseActivoFijo) => !r.id ? null : (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            Editar
          </Button>
          <Popconfirm
            title={r.activo ? '¿Bloquear?' : '¿Desbloquear?'}
            onConfirm={() => handleBloquear(r)}
          >
            <Button size="small"
              icon={r.activo ? <LockOutlined /> : <UnlockOutlined />}
              danger={r.activo}
              style={!r.activo ? { color: '#52c41a', borderColor: '#52c41a' } : undefined}
            />
          </Popconfirm>
          <Popconfirm title="¿Eliminar esta clase?" onConfirm={() => handleEliminar(r)}
            okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
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
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Sin clases configuradas"
          description='Haz clic en "Generar clases Guatemala" para crear las clases del ISR Art. 19 bis automáticamente.' />
      )}

      <Table
        dataSource={data}
        columns={columns}
        rowKey={r => r.id ?? r.codigo}
        loading={loading}
        size="small"
        pagination={false}
      />

      {/* ── Modal de edición ─────────────────────────────────────── */}
      <Modal
        title={`Configurar: ${editing?.codigo} — ${editing?.nombre}`}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={handleSave}
        okText="Guardar"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={600}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="nombre" label="Nombre de la clase">
            <Input />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="tasaDepreciacionAnual" label="Tasa anual">
              <InputNumber
                style={{ width: '100%' }} min={0} max={1} precision={4} step={0.05}
                formatter={v => `${((Number(v) || 0) * 100).toFixed(2)}%`}
                parser={v => (Number(v?.replace('%', '').trim()) / 100) as 0 | 1}
              />
            </Form.Item>
            <Form.Item name="vidaUtilMeses" label="Vida útil (meses)">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="ej: 60" />
            </Form.Item>
            <Form.Item name="esNoDepreciable" label="No depreciable" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <div style={{ borderTop: '1px dashed #d9d9d9', paddingTop: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Cuentas contables</span>
          </div>

          <Form.Item name="cuentaAltasId" label="Altas (costo del activo)">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
          <Form.Item name="cuentaDepreciacionAcumuladaId" label="Depreciación Acumulada">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
          <Form.Item name="cuentaGastoDepreciacionId" label="Gasto de Depreciación">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
          <Form.Item name="cuentaGananciaPorVentaId" label="Ganancia por Venta de AF">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
          <Form.Item name="cuentaPerdidaPorDeterioro" label="Pérdida por Deterioro de AF">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
          <Form.Item name="cuentaPerdidaPorVentaId" label="Pérdida por Venta de AF">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
          <Form.Item name="cuentaGananciaActivoFijoId" label="Ganancia en AF (otras)">
            <AccountSelect filter={{}} placeholder="Selecciona cuenta..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
