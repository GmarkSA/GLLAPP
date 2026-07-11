import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Button, Tag, Space, message, Form, InputNumber,
  Switch, Typography, Alert, Popconfirm, Spin, Divider,
} from 'antd'
import {
  ReloadOutlined, LockOutlined, UnlockOutlined, DeleteOutlined, SaveOutlined,
} from '@ant-design/icons'
import AccountSelect from '../../../components/AccountSelect'
import {
  getClasesActivoFijo, actualizarClaseActivoFijo, eliminarClaseActivoFijo, seedGuatemalaClases,
  type ClaseActivoFijo,
} from '../../../api/clases-activo-fijo'

const { Title, Text } = Typography

const CUENTAS = [
  { name: 'cuentaAltasId',                label: 'Altas (costo activo)' },
  { name: 'cuentaDepreciacionAcumuladaId', label: 'Depreciación Acumulada' },
  { name: 'cuentaGastoDepreciacionId',     label: 'Gasto de Depreciación' },
  { name: 'cuentaGananciaPorVentaId',      label: 'Ganancia por Venta AF' },
  { name: 'cuentaPerdidaPorDeterioro',     label: 'Pérdida por Deterioro' },
  { name: 'cuentaPerdidaPorVentaId',       label: 'Pérdida por Venta AF' },
  { name: 'cuentaGananciaActivoFijoId',    label: 'Ganancia en AF (otras)' },
]

// ─── Fila editable de una clase ──────────────────────────────────────────────
function ClaseRow({ record, onSaved, onDeleted }: {
  record: ClaseActivoFijo
  onSaved: () => void
  onDeleted: () => void
}) {
  const [form]    = Form.useForm()
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)
  const hasId = !!record.id

  // Cargar valores al montar o cuando cambia el record externo
  const prevId = useRef<string | null>(null)
  useEffect(() => {
    if (prevId.current !== record.id) {
      form.setFieldsValue({ ...record })
      setDirty(false)
      prevId.current = record.id
    }
  }, [record, form])

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await actualizarClaseActivoFijo(record.id!, vals)
      message.success(`${record.codigo} — guardado`)
      setDirty(false)
      onSaved()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleBloquear = async () => {
    try {
      await actualizarClaseActivoFijo(record.id!, { activo: !record.activo })
      message.success(record.activo ? 'Clase bloqueada' : 'Clase desbloqueada')
      onSaved()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const handleEliminar = async () => {
    try {
      await eliminarClaseActivoFijo(record.id!)
      message.success('Clase eliminada')
      onDeleted()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const configured = CUENTAS.filter(f => !!(record as any)[f.name]).length

  return (
    <div style={{
      border: '1px solid #e8e8e8',
      borderRadius: 8,
      marginBottom: 8,
      background: record.activo ? '#fff' : '#fafafa',
      opacity: record.activo ? 1 : 0.75,
    }}>
      {/* ── Cabecera de la fila ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        background: '#f5f7fa',
        borderRadius: '8px 8px 0 0',
        borderBottom: '1px solid #e8e8e8',
      }}>
        <Text strong style={{ color: '#1B3A6B', fontFamily: 'monospace', fontSize: 13, minWidth: 50 }}>
          {record.codigo}
        </Text>
        <Text strong style={{ flex: 1 }}>{record.nombre}</Text>
        <Tag color={configured === 7 ? 'success' : configured > 0 ? 'warning' : 'default'} style={{ margin: 0 }}>
          {configured}/7 cuentas
        </Tag>
        <Tag color={record.activo ? 'success' : 'default'} style={{ margin: 0 }}>
          {record.activo ? 'Activo' : 'Bloqueado'}
        </Tag>

        {/* Acciones */}
        <Space size={4}>
          {dirty && (
            <Button size="small" type="primary" icon={<SaveOutlined />}
              loading={saving} onClick={handleSave}
              style={{ background: '#1B3A6B' }}>
              Guardar
            </Button>
          )}
          {hasId && (
            <Popconfirm
              title={record.activo ? '¿Bloquear esta clase?' : '¿Desbloquear esta clase?'}
              onConfirm={handleBloquear}
            >
              <Button size="small"
                icon={record.activo ? <LockOutlined /> : <UnlockOutlined />}
                danger={record.activo}
                style={!record.activo ? { color: '#52c41a', borderColor: '#52c41a' } : undefined}
              >
                {record.activo ? 'Bloquear' : 'Desbloquear'}
              </Button>
            </Popconfirm>
          )}
          {hasId && (
            <Popconfirm title="¿Eliminar esta clase permanentemente?" onConfirm={handleEliminar}
              okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* ── Cuerpo — todos los campos visibles ── */}
      <div style={{ padding: '12px 16px' }}>
        <Form form={form} layout="vertical" size="small" onValuesChange={() => hasId && setDirty(true)}>
          {/* Parámetros numéricos */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 160px 1fr', gap: '0 16px', marginBottom: 4 }}>
            <Form.Item name="tasaDepreciacionAnual" label="Tasa anual (decimal)" style={{ marginBottom: 8 }}>
              <InputNumber style={{ width: '100%' }} min={0} max={1} precision={4} step={0.01} />
            </Form.Item>
            <Form.Item name="vidaUtilMeses" label="Vida útil (meses)" style={{ marginBottom: 8 }}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="esNoDepreciable" label="No depreciable" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch />
            </Form.Item>
          </div>

          <Divider style={{ margin: '4px 0 10px' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Cuentas Contables</Text>
          </Divider>

          {/* 7 cuentas en 2 columnas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {CUENTAS.map(f => (
              <Form.Item key={f.name} name={f.name}
                label={<Text style={{ fontSize: 11, color: '#595959' }}>{f.label}</Text>}
                style={{ marginBottom: 8 }}>
                <AccountSelect filter={{}} placeholder="Seleccionar cuenta..." />
              </Form.Item>
            ))}
          </div>
        </Form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ClasesActivoFijoPage() {
  const [data,    setData]    = useState<ClaseActivoFijo[]>([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)

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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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

      {loading
        ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        : data.map(r => (
            <ClaseRow
              key={r.id ?? r.codigo}
              record={r}
              onSaved={load}
              onDeleted={load}
            />
          ))
      }
    </div>
  )
}
