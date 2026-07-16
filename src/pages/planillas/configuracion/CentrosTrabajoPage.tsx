import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, EditOutlined, EnvironmentOutlined } from '@ant-design/icons'
import {
  getCentrosTrabajo, guardarCentroTrabajo, type CentroTrabajo,
} from '../../../api/planillas-empleados'
import { DEPARTAMENTOS_GUATEMALA } from '../../../constants/guatemalaGeografia'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'

export default function CentrosTrabajoPage() {
  const [centros, setCentros] = useState<CentroTrabajo[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState<CentroTrabajo | null>(null)
  const [departamentoSel, setDepartamentoSel] = useState<string | null>(null)
  const [form] = Form.useForm()

  const cargar = () => {
    setLoading(true)
    getCentrosTrabajo()
      .then(setCentros)
      .catch(() => message.error('Error cargando centros de trabajo'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const abrirNuevo = () => {
    setEditando(null)
    setDepartamentoSel(null)
    form.resetFields()
    form.setFieldsValue({ activo: true })
    setModalOpen(true)
  }

  const abrirEditar = (c: CentroTrabajo) => {
    setEditando(c)
    setDepartamentoSel(c.departamento ?? null)
    form.setFieldsValue(c)
    setModalOpen(true)
  }

  const guardar = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      await guardarCentroTrabajo({ ...vals, id: editando?.id })
      message.success(editando ? 'Centro de trabajo actualizado' : 'Centro de trabajo creado')
      setModalOpen(false)
      cargar()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const nombreDepto = (codigo: string | null) => DEPARTAMENTOS_GUATEMALA.find(d => d.code === codigo)?.name ?? codigo ?? '—'
  const nombreMuni = (deptoCodigo: string | null, muniCodigo: string | null) =>
    DEPARTAMENTOS_GUATEMALA.find(d => d.code === deptoCodigo)?.municipios.find(m => m.code === muniCodigo)?.name ?? muniCodigo ?? '—'

  const municipiosDelDepto = DEPARTAMENTOS_GUATEMALA.find(d => d.code === departamentoSel)?.municipios ?? []

  const columns = [
    { title: 'Código', dataIndex: 'codigo', width: 90 },
    { title: 'Nombre', dataIndex: 'nombre' },
    {
      title: 'Departamento / Municipio', key: 'geo', width: 240,
      render: (_: any, c: CentroTrabajo) => (
        <Text style={{ fontSize: 12 }}>{nombreDepto(c.departamento)} / {nombreMuni(c.departamento, c.municipio)}</Text>
      ),
    },
    { title: 'Actividad IGSS', dataIndex: 'codigoActividadEconomica', width: 130 },
    {
      title: 'Estado', dataIndex: 'activo', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: '', key: 'acciones', width: 60,
      render: (_: any, c: CentroTrabajo) => (
        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => abrirEditar(c)} />
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>
            <EnvironmentOutlined style={{ marginRight: 8 }} />Centros de trabajo
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Alimentan la sección [centros] del archivo de planilla electrónica IGSS v2.2.0
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={abrirNuevo} style={{ background: NAVY }}>
          Nuevo centro
        </Button>
      </div>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={loading}
          dataSource={centros} columns={columns} pagination={false}
          locale={{ emptyText: 'Sin centros de trabajo. Crea al menos uno para poder generar el archivo IGSS.' }}
        />
      </Card>

      <Modal
        title={editando ? 'Editar centro de trabajo' : 'Nuevo centro de trabajo'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={guardar} okText="Guardar" cancelText="Cancelar"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 12px' }}>
            <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="1" />
            </Form.Item>
            <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Oficinas centrales" />
            </Form.Item>
          </div>
          <Form.Item name="direccion" label="Dirección">
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="zona" label="Zona">
              <Input />
            </Form.Item>
            <Form.Item name="telefono" label="Teléfono">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="departamento" label="Departamento" rules={[{ required: true, message: 'Requerido' }]}
              tooltip="Código oficial INE — lo exige el archivo IGSS">
              <Select
                showSearch optionFilterProp="label"
                options={DEPARTAMENTOS_GUATEMALA.map(d => ({ value: d.code, label: d.name }))}
                onChange={(v) => { setDepartamentoSel(v); form.setFieldValue('municipio', undefined) }}
              />
            </Form.Item>
            <Form.Item name="municipio" label="Municipio" rules={[{ required: true, message: 'Requerido' }]}>
              <Select
                showSearch optionFilterProp="label" disabled={!departamentoSel}
                placeholder={departamentoSel ? 'Seleccionar municipio' : 'Elige primero el departamento'}
                options={municipiosDelDepto.map(m => ({ value: m.code, label: m.name }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="codigoActividadEconomica" label="Código de actividad económica"
            tooltip="Código IGSS/CIIU de la actividad económica de este centro de trabajo">
            <Input />
          </Form.Item>
          <Form.Item name="activo" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
