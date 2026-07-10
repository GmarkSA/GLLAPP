import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, message, Modal, Form, Input, InputNumber,
  Switch, Typography, Tooltip, Alert,
} from 'antd'
import { EditOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  getClasesActivoFijo, actualizarClaseActivoFijo, seedGuatemalaClases,
  type ClaseActivoFijo,
} from '../../../api/clases-activo-fijo'

const { Title } = Typography

export default function ClasesActivoFijoPage() {
  const [data,    setData]    = useState<ClaseActivoFijo[]>([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState<ClaseActivoFijo | null>(null)
  const [form]  = Form.useForm()

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

  const openEdit = (r: ClaseActivoFijo) => {
    setEditing(r)
    form.setFieldsValue({ ...r })
    setModal(true)
  }

  const handleSave = async () => {
    if (!editing?.id) return
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await actualizarClaseActivoFijo(editing.id, vals)
      message.success('Clase actualizada')
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', width: 80 },
    { title: 'Clase', dataIndex: 'nombre' },
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
      title: 'Cuentas config.', width: 120,
      render: (_: any, r: ClaseActivoFijo) => {
        const configured = [
          r.cuentaAltasId, r.cuentaDepreciacionAcumuladaId, r.cuentaGastoDepreciacionId,
          r.cuentaGananciaPorVentaId, r.cuentaPerdidaPorDeterioro, r.cuentaPerdidaPorVentaId,
          r.cuentaGananciaActivoFijoId,
        ].filter(Boolean).length
        return <Tag color={configured === 7 ? 'success' : configured > 0 ? 'warning' : 'default'}>{configured}/7</Tag>
      },
    },
    {
      title: 'Acciones', width: 80,
      render: (_: any, r: ClaseActivoFijo) => (
        <Tooltip title="Configurar cuentas contables">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        </Tooltip>
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
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="Sin clases configuradas"
          description="Haz clic en «Generar clases Guatemala» para crear las clases del ISR Art. 19 bis automáticamente."
        />
      )}

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{ pageSize: 50 }}
      />

      <Modal
        title={`Configurar cuentas: ${editing?.codigo} — ${editing?.nombre}`}
        open={modal} onCancel={() => setModal(false)}
        onOk={handleSave} okText="Guardar" confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={560}
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Pega el ID (UUID) de la cuenta contable correspondiente en cada campo. Puedes encontrar los IDs en el Catálogo de Cuentas." />
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {[
              { name: 'cuentaAltasId', label: 'Altas (costo del activo)' },
              { name: 'cuentaDepreciacionAcumuladaId', label: 'Depreciación Acumulada (contra-activo)' },
              { name: 'cuentaGastoDepreciacionId', label: 'Gasto de Depreciación' },
              { name: 'cuentaGananciaPorVentaId', label: 'Ganancia por Venta AF' },
              { name: 'cuentaPerdidaPorDeterioro', label: 'Pérdida por Deterioro AF' },
              { name: 'cuentaPerdidaPorVentaId', label: 'Pérdida por Venta AF' },
              { name: 'cuentaGananciaActivoFijoId', label: 'Ganancia en AF (otras)' },
            ].map(f => (
              <Form.Item key={f.name} name={f.name} label={f.label} style={{ marginBottom: 4 }}>
                <Input placeholder="UUID de cuenta contable" />
              </Form.Item>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <Form.Item name="tasaDepreciacionAnual" label="Tasa anual (decimal)">
              <InputNumber style={{ width: '100%' }} min={0} max={1} precision={4} step={0.01} />
            </Form.Item>
            <Form.Item name="vidaUtilMeses" label="Vida útil (meses)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="esNoDepreciable" label="No depreciable" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
