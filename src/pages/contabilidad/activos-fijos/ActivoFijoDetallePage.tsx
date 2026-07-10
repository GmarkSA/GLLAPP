import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Tabs, Table, Tag, Descriptions, Typography, Space, message,
  Popconfirm, Modal, Form, Select, InputNumber, Divider,
} from 'antd'
import {
  ArrowLeftOutlined, ThunderboltOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getActivoFijo, getHistorialDepreciacion, depreciarActivo,
  type ActivoFijo, type HistorialDepreciacion, type EstadoActivoFijo,
} from '../../../api/activos-fijos'
import { getClasesActivoFijo, type ClaseActivoFijo } from '../../../api/clases-activo-fijo'

const { Title, Text } = Typography

const ESTADO_COLOR: Record<EstadoActivoFijo, string> = {
  BORRADOR: 'default', ACTIVO: 'success', VENDIDO: 'processing', DADO_DE_BAJA: 'error',
}
const ESTADO_LABEL: Record<EstadoActivoFijo, string> = {
  BORRADOR: 'Borrador', ACTIVO: 'Activo', VENDIDO: 'Vendido', DADO_DE_BAJA: 'Dado de Baja',
}

const Q = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function ActivoFijoDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [activo,    setActivo]    = useState<ActivoFijo | null>(null)
  const [historial, setHistorial] = useState<HistorialDepreciacion[]>([])
  const [clases,    setClases]    = useState<ClaseActivoFijo[]>([])
  const [loading,   setLoading]   = useState(false)

  const [modalDep,  setModalDep]  = useState(false)
  const [savingDep, setSavingDep] = useState(false)
  const [formDep]   = Form.useForm()

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [af, hist] = await Promise.all([
        getActivoFijo(id),
        getHistorialDepreciacion(id),
      ])
      setActivo(af)
      setHistorial(hist)
    } catch { message.error('Error al cargar activo fijo') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    getClasesActivoFijo().then(setClases).catch(() => {})
  }, [id])

  const handleDepreciar = async () => {
    const vals = await formDep.validateFields()
    setSavingDep(true)
    try {
      await depreciarActivo(id!, vals.periodo)
      message.success(`Depreciación ${vals.periodo} registrada — póliza contable generada`)
      setModalDep(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al depreciar')
    } finally { setSavingDep(false) }
  }

  const clase = clases.find(c => c.id === activo?.claseActivoFijoId)

  // Generar opciones de período (12 meses anteriores + actual)
  const periodos = Array.from({ length: 12 }, (_, i) => {
    const d = dayjs().subtract(i, 'month')
    return { label: d.format('MMMM YYYY'), value: d.format('YYYY-MM') }
  })

  const historialColumns = [
    { title: 'Período', dataIndex: 'periodo', width: 100 },
    {
      title: 'Cuota', dataIndex: 'cuota', width: 130, align: 'right' as const,
      render: (v: number) => Q(v),
    },
    {
      title: 'Dep. Acumulada', dataIndex: 'depreciacionAcumuladaFin', width: 140, align: 'right' as const,
      render: (v: number) => Q(v),
    },
    {
      title: 'Valor en Libros', dataIndex: 'valorLibroFin', width: 130, align: 'right' as const,
      render: (v: number) => Q(v),
    },
    {
      title: 'Fecha Cálculo', dataIndex: 'fechaCalculo', width: 130,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
  ]

  if (!activo && !loading) return null

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contabilidad/activos-fijos')}>
          Volver
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          {activo?.assetNumber} — {activo?.name}
        </Title>
        {activo && (
          <Tag color={ESTADO_COLOR[activo.estado as EstadoActivoFijo]}>
            {ESTADO_LABEL[activo.estado as EstadoActivoFijo]}
          </Tag>
        )}
      </div>

      <Tabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: 'Información',
            children: activo ? (
              <>
                <Descriptions bordered size="small" column={3}>
                  <Descriptions.Item label="Número">{activo.assetNumber}</Descriptions.Item>
                  <Descriptions.Item label="Nombre" span={2}>{activo.name}</Descriptions.Item>
                  <Descriptions.Item label="Clase" span={3}>
                    {clase ? `${clase.codigo} — ${clase.nombre}` : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Fecha adquisición">
                    {dayjs(activo.acquisitionDate).format('DD/MM/YYYY')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Costo original">
                    <Text strong>{Q(activo.originalCost)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Valor residual">
                    {Q(activo.salvageValue)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Dep. acumulada">
                    <Text type="warning">{Q(activo.accumulatedDepreciation)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Valor en libros">
                    <Text strong style={{ color: '#1B3A6B' }}>{Q(activo.currentBookValue)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Cuota mensual">
                    {activo.depreciacionMensual ? Q(activo.depreciacionMensual) : '—'}
                  </Descriptions.Item>
                  {clase && (
                    <>
                      <Descriptions.Item label="Tasa depreciación anual">
                        {(Number(clase.tasaDepreciacionAnual) * 100).toFixed(2)}%
                      </Descriptions.Item>
                      <Descriptions.Item label="Vida útil">
                        {clase.vidaUtilMeses ? `${clase.vidaUtilMeses} meses` : 'No depreciable'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Depreciable">
                        <Tag color={clase.esNoDepreciable ? 'default' : 'success'}>
                          {clase.esNoDepreciable ? 'No' : 'Sí'}
                        </Tag>
                      </Descriptions.Item>
                    </>
                  )}
                  {activo.location && (
                    <Descriptions.Item label="Ubicación">{activo.location}</Descriptions.Item>
                  )}
                  {activo.serialNumber && (
                    <Descriptions.Item label="Número de serie">{activo.serialNumber}</Descriptions.Item>
                  )}
                  {activo.description && (
                    <Descriptions.Item label="Descripción" span={3}>{activo.description}</Descriptions.Item>
                  )}
                </Descriptions>

                {activo.estado === 'ACTIVO' && !clase?.esNoDepreciable && (
                  <div style={{ marginTop: 16 }}>
                    <Button type="primary" icon={<ThunderboltOutlined />}
                      style={{ background: '#1B3A6B' }}
                      onClick={() => { formDep.resetFields(); setModalDep(true) }}>
                      Registrar Depreciación
                    </Button>
                  </div>
                )}
              </>
            ) : null,
          },
          {
            key: 'historial',
            label: `Historial Depreciación (${historial.length})`,
            children: (
              <Table
                dataSource={historial} columns={historialColumns} rowKey="id"
                size="small" loading={loading}
                pagination={false}
                locale={{ emptyText: 'Sin depreciaciones registradas' }}
              />
            ),
          },
        ]}
      />

      {/* Modal: Depreciar */}
      <Modal
        title={<><ThunderboltOutlined /> Registrar Depreciación</>}
        open={modalDep} onCancel={() => setModalDep(false)}
        onOk={handleDepreciar} okText="Registrar"
        confirmLoading={savingDep}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <div style={{ marginBottom: 12, color: '#666' }}>
          Cuota mensual: <strong>{activo?.depreciacionMensual ? Q(activo.depreciacionMensual) : '—'}</strong>
          {' '}/ Valor en libros actual: <strong>{activo ? Q(activo.currentBookValue) : '—'}</strong>
        </div>
        <Form form={formDep} layout="vertical" size="small">
          <Form.Item name="periodo" label="Período a depreciar (YYYY-MM)" rules={[{ required: true }]}>
            <Select options={periodos} placeholder="Seleccionar período" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
