import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Space, Popconfirm, message, Modal, Form, Input,
  InputNumber, Select, DatePicker, Typography, Tooltip, Drawer,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, CheckCircleOutlined,
  DollarOutlined, StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getActivosFijos, crearActivoFijo, actualizarActivoFijo,
  activarActivoFijo, venderActivoFijo, darDeBajaActivoFijo,
  type ActivoFijo, type EstadoActivoFijo,
} from '../../../api/activos-fijos'
import { getClasesActivoFijo, type ClaseActivoFijo } from '../../../api/clases-activo-fijo'
import SelectorDimensionesAnaliticas, { type DimensionesValue } from '../../../components/SelectorDimensionesAnaliticas'

const { Title } = Typography

const ESTADO_COLOR: Record<EstadoActivoFijo, string> = {
  BORRADOR:    'default',
  ACTIVO:      'success',
  VENDIDO:     'processing',
  DADO_DE_BAJA: 'error',
}

const ESTADO_LABEL: Record<EstadoActivoFijo, string> = {
  BORRADOR:    'Borrador',
  ACTIVO:      'Activo',
  VENDIDO:     'Vendido',
  DADO_DE_BAJA: 'Dado de Baja',
}

export default function ActivosFijosPage() {
  const navigate = useNavigate()
  const [data,       setData]       = useState<ActivoFijo[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [clases,     setClases]     = useState<ClaseActivoFijo[]>([])
  const [page,       setPage]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string | undefined>()

  // Formulario crear/editar
  const [modalForm,  setModalForm]  = useState(false)
  const [editing,    setEditing]    = useState<ActivoFijo | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]  = Form.useForm()

  // Acciones
  const [modalVender, setModalVender] = useState(false)
  const [modalBaja,   setModalBaja]   = useState(false)
  const [actionId,    setActionId]    = useState<string | null>(null)
  const [actLoading,  setActLoading]  = useState(false)
  const [formVender]  = Form.useForm()
  const [formBaja]    = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getActivosFijos({ search, estado: filtroEstado, page })
      setData(res.data)
      setTotal(res.total)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [search, filtroEstado, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getClasesActivoFijo().then(setClases).catch(() => {})
  }, [])

  // ── Crear / Editar ──────────────────────────────────────────────────────────

  const openNew = () => { setEditing(null); form.resetFields(); setModalForm(true) }
  const openEdit = (r: ActivoFijo) => {
    setEditing(r)
    form.setFieldsValue({
      name: r.name,
      description: r.description,
      claseActivoFijoId: r.claseActivoFijoId,
      acquisitionDate: r.acquisitionDate ? dayjs(r.acquisitionDate) : null,
      originalCost: r.originalCost,
      salvageValue: r.salvageValue,
      location: r.location,
      serialNumber: r.serialNumber,
      dimensiones: {
        centroCostoId:    r.centroCostoId    ?? null,
        centroBeneficioId: r.centroBeneficioId ?? null,
      } satisfies DimensionesValue,
    })
    setModalForm(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      const dim = vals.dimensiones as DimensionesValue | undefined
      const { dimensiones: _dim, ...rest } = vals
      void _dim
      const payload = {
        ...rest,
        acquisitionDate:   vals.acquisitionDate?.format('YYYY-MM-DD'),
        centroCostoId:     dim?.centroCostoId    ?? null,
        centroBeneficioId: dim?.centroBeneficioId ?? null,
      }
      if (editing) {
        await actualizarActivoFijo(editing.id, payload)
        message.success('Activo fijo actualizado')
      } else {
        await crearActivoFijo(payload)
        message.success('Activo fijo creado en borrador')
      }
      setModalForm(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  // ── Activar ─────────────────────────────────────────────────────────────────

  const handleActivar = async (id: string) => {
    setActLoading(true)
    try {
      await activarActivoFijo(id)
      message.success('Activo activado — póliza de alta generada')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al activar')
    } finally { setActLoading(false) }
  }

  // ── Vender ──────────────────────────────────────────────────────────────────

  const handleVender = async () => {
    const vals = await formVender.validateFields()
    setActLoading(true)
    try {
      await venderActivoFijo(actionId!, {
        fechaVenta: vals.fechaVenta.format('YYYY-MM-DD'),
        precioVenta: vals.precioVenta,
        motivo: vals.motivo,
      })
      message.success('Venta registrada — póliza contable generada')
      setModalVender(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al registrar venta')
    } finally { setActLoading(false) }
  }

  // ── Dar de Baja ─────────────────────────────────────────────────────────────

  const handleBaja = async () => {
    const vals = await formBaja.validateFields()
    setActLoading(true)
    try {
      await darDeBajaActivoFijo(actionId!, {
        fecha: vals.fecha.format('YYYY-MM-DD'),
        motivo: vals.motivo,
      })
      message.success('Baja registrada — póliza contable generada')
      setModalBaja(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al dar de baja')
    } finally { setActLoading(false) }
  }

  // ── Tabla ────────────────────────────────────────────────────────────────────

  const columns = [
    { title: 'Número', dataIndex: 'assetNumber', width: 110 },
    { title: 'Nombre', dataIndex: 'name' },
    {
      title: 'Clase', dataIndex: 'claseActivoFijoId', width: 160,
      render: (v: string) => clases.find(c => c.id === v)?.nombre ?? '—',
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 110,
      render: (v: EstadoActivoFijo) => (
        <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v]}</Tag>
      ),
    },
    {
      title: 'Costo Original', dataIndex: 'originalCost', width: 130, align: 'right' as const,
      render: (v: number) => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Valor en Libros', dataIndex: 'currentBookValue', width: 130, align: 'right' as const,
      render: (v: number) => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Cuota Mensual', dataIndex: 'depreciacionMensual', width: 130, align: 'right' as const,
      render: (v: number | null) => v
        ? `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
        : '—',
    },
    {
      title: 'Adquisición', dataIndex: 'acquisitionDate', width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Acciones', width: 170,
      render: (_: any, r: ActivoFijo) => (
        <Space size={4}>
          <Tooltip title="Ver detalle e historial">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/contabilidad/activos-fijos/${r.id}`)} />
          </Tooltip>
          {r.estado === 'BORRADOR' && (
            <Tooltip title="Activar activo">
              <Popconfirm
                title="¿Activar este activo? Se generará póliza de alta."
                onConfirm={() => handleActivar(r.id)}
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  style={{ background: '#1B3A6B' }} loading={actLoading} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.estado === 'ACTIVO' && (
            <>
              <Tooltip title="Registrar venta">
                <Button size="small" icon={<DollarOutlined />}
                  onClick={() => { setActionId(r.id); formVender.resetFields(); setModalVender(true) }} />
              </Tooltip>
              <Tooltip title="Dar de baja">
                <Button size="small" danger icon={<StopOutlined />}
                  onClick={() => { setActionId(r.id); formBaja.resetFields(); setModalBaja(true) }} />
              </Tooltip>
            </>
          )}
          {(r.estado === 'BORRADOR' || r.estado === 'ACTIVO') && (
            <Button size="small" onClick={() => openEdit(r)}>Editar</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Activos Fijos</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
          style={{ background: '#1B3A6B' }}>Nuevo Activo</Button>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Buscar por nombre, número o serie..."
          onSearch={v => { setSearch(v); setPage(1) }}
          allowClear style={{ width: 280 }}
        />
        <Select
          placeholder="Estado" allowClear style={{ width: 140 }}
          onChange={v => { setFiltroEstado(v); setPage(1) }}
          options={[
            { label: 'Borrador',      value: 'BORRADOR' },
            { label: 'Activo',        value: 'ACTIVO' },
            { label: 'Vendido',       value: 'VENDIDO' },
            { label: 'Dado de Baja',  value: 'DADO_DE_BAJA' },
          ]}
        />
      </Space>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{
          current: page, pageSize: 50, total,
          onChange: p => setPage(p),
          showTotal: t => `${t} activos`,
        }}
      />

      {/* Modal: Nuevo / Editar */}
      <Modal
        title={editing ? `Editar ${editing.assetNumber}` : 'Nuevo Activo Fijo'}
        open={modalForm} onCancel={() => setModalForm(false)}
        onOk={handleSave} okText="Guardar" confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={640}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Form.Item name="name" label="Nombre del activo" rules={[{ required: true }]}>
              <Input placeholder="Vehículo Toyota Hilux 2024" />
            </Form.Item>
            <Form.Item name="claseActivoFijoId" label="Clase" rules={[{ required: true }]}>
              <Select
                showSearch placeholder="Clase"
                optionFilterProp="label"
                options={clases.map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id }))}
              />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="acquisitionDate" label="Fecha de adquisición" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="originalCost" label="Costo original (Q)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
            <Form.Item name="salvageValue" label="Valor residual (Q)">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="location" label="Ubicación">
              <Input placeholder="Bodega Central" />
            </Form.Item>
            <Form.Item name="serialNumber" label="Número de serie">
              <Input placeholder="SN-12345" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dimensiones" style={{ marginBottom: 0 }}>
            <SelectorDimensionesAnaliticas layout="form" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Vender */}
      <Modal
        title={<><DollarOutlined /> Registrar Venta de Activo</>}
        open={modalVender} onCancel={() => setModalVender(false)}
        onOk={handleVender} okText="Registrar venta"
        confirmLoading={actLoading}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={formVender} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="fechaVenta" label="Fecha de venta" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="precioVenta" label="Precio de venta (Q)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>
          <Form.Item name="motivo" label="Motivo / referencia">
            <Input placeholder="Venta a tercero, placa XYZ..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Dar de baja */}
      <Modal
        title={<><StopOutlined /> Dar de Baja Activo</>}
        open={modalBaja} onCancel={() => setModalBaja(false)}
        onOk={handleBaja} okText="Registrar baja" okButtonProps={{ danger: true }}
        confirmLoading={actLoading}
      >
        <Form form={formBaja} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <Form.Item name="fecha" label="Fecha de baja" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo (deterioro / siniestro)" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Ej: Siniestro total por accidente de tránsito" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
