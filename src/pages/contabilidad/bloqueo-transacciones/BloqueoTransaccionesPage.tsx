import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, message, Modal, Form, Select, DatePicker,
  Input, Typography, Alert, Popconfirm, Tooltip,
} from 'antd'
import { LockOutlined, UnlockOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBloqueos, getBloqueoVigente, bloquear, desbloquear, desbloquearParcial,
  type BloqueoContable, type ModuloBloqueable,
} from '../../../api/bloqueo-contable'

const { Title, Text } = Typography

const MODULOS: { label: string; value: ModuloBloqueable }[] = [
  { label: 'Todos los módulos', value: 'TODOS' },
  { label: 'Ventas',            value: 'VENTAS' },
  { label: 'Compras',           value: 'COMPRAS' },
  { label: 'Bancos',            value: 'BANCOS' },
  { label: 'Contabilidad',      value: 'CONTABILIDAD' },
  { label: 'Inventario',        value: 'INVENTARIO' },
]

const ESTADO_COLOR: Record<string, string> = {
  BLOQUEADO:            'error',
  DESBLOQUEADO_PARCIAL: 'warning',
  DESBLOQUEADO:         'success',
}

export default function BloqueoTransaccionesPage() {
  const [data,    setData]    = useState<BloqueoContable[]>([])
  const [loading, setLoading] = useState(false)
  const [vigente, setVigente] = useState<BloqueoContable | null>(null)
  const [modal,   setModal]   = useState<'nuevo' | 'parcial' | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [target,  setTarget]  = useState<string | null>(null)
  const [form]  = Form.useForm()
  const [formParcial] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, vig] = await Promise.all([getBloqueos(), getBloqueoVigente()])
      setData(rows)
      setVigente(vig)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleBloquear = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await bloquear({ ...vals, fechaBloqueo: vals.fechaBloqueo.format('YYYY-MM-DD') })
      message.success('Período bloqueado')
      setModal(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al bloquear')
    } finally { setSaving(false) }
  }

  const handleDesbloquear = async (id: string) => {
    const motivo = prompt('Motivo del desbloqueo:')
    if (!motivo) return
    try { await desbloquear(id, motivo); message.success('Desbloqueado'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const handleParcial = async () => {
    const vals = await formParcial.validateFields()
    setSaving(true)
    try {
      await desbloquearParcial(target!, {
        desde: vals.desde.format('YYYY-MM-DD'),
        hasta: vals.hasta.format('YYYY-MM-DD'),
        motivo: vals.motivo,
      })
      message.success('Desbloqueo parcial aplicado')
      setModal(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setSaving(false) }
  }

  const columns = [
    {
      title: 'Módulo', dataIndex: 'modulo', width: 140,
      render: (v: string) => <Tag color={v === 'TODOS' ? 'red' : 'orange'}>{v}</Tag>,
    },
    {
      title: 'Bloqueado hasta', dataIndex: 'fechaBloqueo', width: 140,
      render: (v: string) => <Text strong>{dayjs(v).format('DD/MM/YYYY')}</Text>,
    },
    { title: 'Motivo', dataIndex: 'motivo' },
    {
      title: 'Estado', dataIndex: 'estado', width: 160,
      render: (v: string, r: BloqueoContable) => (
        <Space direction="vertical" size={0}>
          <Tag color={ESTADO_COLOR[v]}>{v.replace('_', ' ')}</Tag>
          {v === 'DESBLOQUEADO_PARCIAL' && r.desbloqueoParcialDesde && (
            <Text style={{ fontSize: 11 }} type="secondary">
              {dayjs(r.desbloqueoParcialDesde).format('DD/MM')} – {dayjs(r.desbloqueoParcialHasta!).format('DD/MM/YYYY')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Creado', dataIndex: 'fechaCreacion', width: 130,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Acciones', width: 160,
      render: (_: any, r: BloqueoContable) => r.estado === 'DESBLOQUEADO' ? null : (
        <Space size={4}>
          <Tooltip title="Desbloquear completamente">
            <Popconfirm title="¿Desbloquear completamente este período?" onConfirm={() => handleDesbloquear(r.id)}>
              <Button size="small" icon={<UnlockOutlined />}>Desbloquear</Button>
            </Popconfirm>
          </Tooltip>
          {r.estado === 'BLOQUEADO' && (
            <Tooltip title="Abrir ventana parcial">
              <Button size="small" onClick={() => { setTarget(r.id); formParcial.resetFields(); setModal('parcial') }}>
                Parcial
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Bloqueo de Transacciones</Title>
        <Button type="primary" danger icon={<LockOutlined />}
          onClick={() => { form.resetFields(); setModal('nuevo') }}>
          Nuevo Bloqueo
        </Button>
      </div>

      {vigente && (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          message={`Período bloqueado hasta ${dayjs(vigente.fechaBloqueo).format('DD/MM/YYYY')} — ${vigente.modulo}`}
          description={`Motivo: ${vigente.motivo}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{ pageSize: 20 }}
      />

      {/* Modal: Nuevo bloqueo */}
      <Modal
        title={<><LockOutlined /> Bloquear Período Contable</>}
        open={modal === 'nuevo'} onCancel={() => setModal(null)}
        onOk={handleBloquear} okText="Bloquear" okButtonProps={{ danger: true }}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <Form.Item name="modulo" label="Módulo a bloquear" rules={[{ required: true }]} initialValue="TODOS">
            <Select options={MODULOS} />
          </Form.Item>
          <Form.Item name="fechaBloqueo" label="Bloquear transacciones hasta (inclusive)" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
              placeholder="Fecha límite del período bloqueado" />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Cierre mensual julio 2026" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Desbloqueo parcial */}
      <Modal
        title={<><UnlockOutlined /> Desbloqueo Parcial</>}
        open={modal === 'parcial'} onCancel={() => setModal(null)}
        onOk={handleParcial} okText="Aplicar desbloqueo parcial"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Alert type="info" showIcon
          message="El bloqueo principal se mantiene. Solo se permitirán transacciones dentro del rango de fechas indicado."
          style={{ marginBottom: 16 }} />
        <Form form={formParcial} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="desde" label="Desde" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="hasta" label="Hasta" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>
          <Form.Item name="motivo" label="Motivo del desbloqueo parcial" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Corrección de factura julio 2026" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
