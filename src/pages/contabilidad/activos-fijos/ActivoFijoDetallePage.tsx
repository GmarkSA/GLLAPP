import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Tabs, Table, Tag, Typography, Space, message,
  Popconfirm, Modal, Form, Select, InputNumber, Divider,
  DatePicker, Input, Spin, Card, Statistic,
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, EditOutlined,
  DollarOutlined, StopOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import {
  getActivoFijo, getHistorialDepreciacion, depreciarActivo, activarActivoFijo,
  actualizarActivoFijo, venderActivoFijo, darDeBajaActivoFijo,
  type ActivoFijo, type HistorialDepreciacion, type EstadoActivoFijo,
} from '../../../api/activos-fijos'
import { getClasesActivoFijo, type ClaseActivoFijo } from '../../../api/clases-activo-fijo'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title, Text } = Typography
const Q = (n: number | string) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const ESTADO_COLOR: Record<EstadoActivoFijo, string> = {
  BORRADOR: 'default', ACTIVO: 'success', VENDIDO: 'processing', DADO_DE_BAJA: 'error',
}
const ESTADO_LABEL: Record<EstadoActivoFijo, string> = {
  BORRADOR: 'Borrador', ACTIVO: 'Activo', VENDIDO: 'Vendido', DADO_DE_BAJA: 'Dado de Baja',
}

// ── Previsión de depreciación (cálculo local, línea recta) ────────────────────
interface PrevisionRow {
  fecha: string
  periodo: string
  cuota: number
  depAcumulada: number
  valorLibro: number
}

function calcPrevision(activo: ActivoFijo, clase: ClaseActivoFijo | undefined): PrevisionRow[] {
  if (!clase || clase.esNoDepreciable || !activo.depreciacionMensual) return []
  const cuota        = Number(activo.depreciacionMensual)
  const salvage      = Number(activo.salvageValue)
  const vidaMeses    = clase.vidaUtilMeses ?? 0
  if (vidaMeses <= 0) return []

  const rows: PrevisionRow[] = []
  let depAcum   = 0
  let valorLibro = Number(activo.originalCost)
  const inicio  = dayjs(activo.acquisitionDate).add(1, 'month').startOf('month')

  for (let i = 0; i < vidaMeses; i++) {
    const cuotaReal = Math.min(cuota, Math.max(0, valorLibro - salvage))
    if (cuotaReal <= 0) break
    depAcum   += cuotaReal
    valorLibro -= cuotaReal
    const fecha = inicio.add(i, 'month')
    rows.push({
      fecha:        fecha.format('DD MMM YYYY'),
      periodo:      fecha.format('YYYY-MM'),
      cuota:        Math.round(cuotaReal * 100) / 100,
      depAcumulada: Math.round(depAcum   * 100) / 100,
      valorLibro:   Math.round(Math.max(valorLibro, salvage) * 100) / 100,
    })
  }
  return rows
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ActivoFijoDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [activo,    setActivo]    = useState<ActivoFijo | null>(null)
  const [historial, setHistorial] = useState<HistorialDepreciacion[]>([])
  const [clases,    setClases]    = useState<ClaseActivoFijo[]>([])
  const [accounts,  setAccounts]  = useState<Account[]>([])
  const [loading,   setLoading]   = useState(false)

  // Modales
  const [modalActivar, setModalActivar] = useState(false)
  const [savingAct,    setSavingAct]    = useState(false)
  const [formActivar]  = Form.useForm()

  const [modalDep,  setModalDep]  = useState(false)
  const [savingDep, setSavingDep] = useState(false)
  const [formDep]   = Form.useForm()

  const [modalEdit,  setModalEdit]  = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [formEdit]   = Form.useForm()

  const [modalVender, setModalVender] = useState(false)
  const [savingVenta, setSavingVenta] = useState(false)
  const [formVender]  = Form.useForm()

  const [modalBaja,  setModalBaja]  = useState(false)
  const [savingBaja, setSavingBaja] = useState(false)
  const [formBaja]   = Form.useForm()

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [af, hist] = await Promise.all([getActivoFijo(id), getHistorialDepreciacion(id)])
      setActivo(af)
      setHistorial(hist)
    } catch { message.error('Error al cargar activo fijo') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    getClasesActivoFijo().then(setClases).catch(() => {})
    getAccounts({ activas: true })
      .then((r: any) => setAccounts(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [id])

  const clase   = clases.find(c => c.id === activo?.claseActivoFijoId)
  const prevision = useMemo(() => activo && clase ? calcPrevision(activo, clase) : [], [activo, clase])

  // Períodos para manual depreciation
  const periodos = Array.from({ length: 12 }, (_, i) => {
    const d = dayjs().subtract(i, 'month')
    return { label: d.format('MMMM YYYY'), value: d.format('YYYY-MM') }
  })

  // ── Acciones ──────────────────────────────────────────────────────────────

  const handleActivar = async () => {
    const vals = formActivar.getFieldsValue()
    setSavingAct(true)
    try {
      await activarActivoFijo(id!, { cuentaContrapartidaId: vals.cuentaContrapartidaId })
      message.success('Activo activado — póliza de alta generada')
      setModalActivar(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al activar')
    } finally { setSavingAct(false) }
  }

  const handleDepreciar = async () => {
    const vals = await formDep.validateFields()
    setSavingDep(true)
    try {
      await depreciarActivo(id!, vals.periodo)
      message.success(`Depreciación ${vals.periodo} registrada`)
      setModalDep(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al depreciar')
    } finally { setSavingDep(false) }
  }

  const handleEdit = async () => {
    const vals = formEdit.getFieldsValue()
    setSavingEdit(true)
    try {
      await actualizarActivoFijo(id!, {
        name:              vals.name,
        description:       vals.description,
        claseActivoFijoId: vals.claseActivoFijoId,
        acquisitionDate:   vals.acquisitionDate?.format('YYYY-MM-DD'),
        location:          vals.location,
        serialNumber:      vals.serialNumber,
      })
      message.success('Activo actualizado')
      setModalEdit(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSavingEdit(false) }
  }

  const openEdit = () => {
    if (!activo) return
    formEdit.setFieldsValue({
      name:              activo.name,
      description:       activo.description,
      claseActivoFijoId: activo.claseActivoFijoId,
      acquisitionDate:   activo.acquisitionDate ? dayjs(activo.acquisitionDate) : null,
      location:          activo.location,
      serialNumber:      activo.serialNumber,
    })
    setModalEdit(true)
  }

  const handleVender = async () => {
    const vals = await formVender.validateFields()
    setSavingVenta(true)
    try {
      await venderActivoFijo(id!, {
        fechaVenta:   vals.fechaVenta.format('YYYY-MM-DD'),
        precioVenta:  vals.precioVenta,
        cuentaCobro:  vals.cuentaCobro,
        motivo:       vals.motivo,
      })
      message.success('Activo vendido — póliza generada')
      setModalVender(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al registrar venta')
    } finally { setSavingVenta(false) }
  }

  const handleBaja = async () => {
    const vals = await formBaja.validateFields()
    setSavingBaja(true)
    try {
      await darDeBajaActivoFijo(id!, {
        fecha:  vals.fecha.format('YYYY-MM-DD'),
        motivo: vals.motivo,
      })
      message.success('Activo dado de baja — póliza generada')
      setModalBaja(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al dar de baja')
    } finally { setSavingBaja(false) }
  }

  // ── Chart ECharts ─────────────────────────────────────────────────────────
  const chartOption = useMemo(() => {
    if (prevision.length === 0) return null
    const labels = prevision.map(r => r.periodo)
    const valores = [Number(activo?.originalCost ?? 0), ...prevision.map(r => r.valorLibro)]
    const labelsExt = ['Inicio', ...labels]
    // Marcar meses ya depreciados (historial real)
    const depreciados = new Set(historial.map(h => h.periodo))

    return {
      tooltip: { trigger: 'axis', formatter: (params: any[]) => {
        const p = params[0]
        return `${p.name}<br/>Valor en libros: <b>${Q(p.value)}</b>`
      }},
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: labelsExt, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `Q ${(v/1000).toFixed(0)}k`, fontSize: 10 } },
      series: [{
        type: 'line',
        data: valores,
        smooth: false,
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: (params: any) => depreciados.has(labelsExt[params.dataIndex]) ? '#389e0d' : '#1B3A6B' },
        lineStyle: { color: '#1B3A6B', width: 2 },
        areaStyle: { color: 'rgba(27,58,107,0.08)' },
      }],
    }
  }, [prevision, historial, activo])

  // ── Columnas historial ────────────────────────────────────────────────────
  const historialColumns = [
    {
      title: 'Período', dataIndex: 'periodo', width: 100,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    { title: 'Cuota',           dataIndex: 'cuota',                   width: 130, align: 'right' as const, render: (v: number) => Q(v) },
    { title: 'Dep. Acumulada',  dataIndex: 'depreciacionAcumuladaFin', width: 140, align: 'right' as const, render: (v: number) => <Text type="warning">{Q(v)}</Text> },
    { title: 'Valor en Libros', dataIndex: 'valorLibroFin',            width: 140, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#1B3A6B' }}>{Q(v)}</Text> },
    { title: 'Fecha',           dataIndex: 'fechaCalculo',             width: 130, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
  ]

  // ── Columnas previsión ────────────────────────────────────────────────────
  const previsionColumns = [
    {
      title: 'Fecha depreciación', dataIndex: 'fecha', width: 160,
      render: (v: string, r: PrevisionRow) => {
        const done = historial.some(h => h.periodo === r.periodo)
        return (
          <Space size={6}>
            {done && <Tag color="success" style={{ margin: 0, fontSize: 10 }}>Registrado</Tag>}
            <Text style={{ fontSize: 12 }}>{v}</Text>
          </Space>
        )
      },
    },
    { title: 'Valor depreciación',          dataIndex: 'cuota',        align: 'right' as const, render: (v: number) => Q(v) },
    { title: 'Dep. acumulada',              dataIndex: 'depAcumulada', align: 'right' as const, render: (v: number) => <Text type="warning">{Q(v)}</Text> },
    { title: 'Valor actual',                dataIndex: 'valorLibro',   align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#1B3A6B' }}>{Q(v)}</Text> },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!activo) return null

  const esBorrador = activo.estado === 'BORRADOR'
  const esActivo   = activo.estado === 'ACTIVO'
  const esDisposed = ['VENDIDO', 'DADO_DE_BAJA'].includes(activo.estado)
  const depreciable = !clase?.esNoDepreciable && !!activo.depreciacionMensual

  // Cuenta names desde accounts
  const cuentaName = (id: string | null | undefined) => {
    if (!id) return '—'
    const a = accounts.find(a => a.id === id)
    return a ? `${a.code} — ${a.name}` : id
  }

  return (
    <div style={{ padding: '0 24px 24px' }}>

      {/* ── Cabecera ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        padding: '14px 0 12px', borderBottom: '1px solid #f0f0f0', marginBottom: 20,
      }}>
        <Button size="small" icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/contabilidad/activos-fijos')}>
          Activos Fijos
        </Button>
        <Divider type="vertical" />
        <Title level={5} style={{ margin: 0, color: '#1B3A6B', fontWeight: 700 }}>
          {activo.name}
        </Title>
        <Tag color={ESTADO_COLOR[activo.estado as EstadoActivoFijo]} style={{ margin: 0 }}>
          {ESTADO_LABEL[activo.estado as EstadoActivoFijo]}
        </Tag>
        <div style={{ flex: 1 }} />

        {/* Acciones */}
        <Space size={6}>
          {!esDisposed && (
            <Button size="small" icon={<EditOutlined />} onClick={openEdit}>Editar</Button>
          )}
          {esBorrador && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />}
              style={{ background: '#389e0d', borderColor: '#389e0d' }}
              onClick={() => { formActivar.resetFields(); setModalActivar(true) }}>
              Marcar como activo
            </Button>
          )}
          {esActivo && depreciable && (
            <Button size="small" icon={<ThunderboltOutlined />}
              style={{ color: '#722ed1', borderColor: '#722ed1' }}
              onClick={() => { formDep.resetFields(); setModalDep(true) }}>
              Registrar depreciación
            </Button>
          )}
          {esActivo && (
            <Button size="small" icon={<DollarOutlined />}
              onClick={() => { formVender.resetFields(); formVender.setFieldsValue({ fechaVenta: dayjs() }); setModalVender(true) }}>
              Vender
            </Button>
          )}
          {esActivo && (
            <Popconfirm
              title="¿Dar de baja este activo?"
              description="Se generará una póliza contable de baja."
              onConfirm={() => { formBaja.resetFields(); formBaja.setFieldsValue({ fecha: dayjs() }); setModalBaja(true) }}
              okText="Continuar" cancelText="Cancelar">
              <Button size="small" danger icon={<StopOutlined />}>Dar de baja</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* ── Cards resumen ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <Card size="small" style={{ borderRadius: 10 }}>
          <Statistic
            title={<Text style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo de activo fijo</Text>}
            value={clase ? `${clase.codigo} — ${clase.nombre}` : 'Sin clase asignada'}
            valueStyle={{ fontSize: 14, color: '#1B3A6B', fontWeight: 600 }}
          />
        </Card>
        <Card size="small" style={{ borderRadius: 10 }}>
          <Statistic
            title={<Text style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor de compra</Text>}
            value={Q(activo.originalCost)}
            valueStyle={{ fontSize: 16, color: '#1B3A6B', fontFamily: 'monospace', fontWeight: 700 }}
          />
        </Card>
        <Card size="small" style={{ borderRadius: 10 }}>
          <Statistic
            title={<Text style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor actual (en libros)</Text>}
            value={Q(activo.currentBookValue)}
            valueStyle={{
              fontSize: 16,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: Number(activo.currentBookValue) < Number(activo.originalCost) ? '#fa8c16' : '#389e0d',
            }}
          />
        </Card>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs
        defaultActiveKey="info"
        items={[
          // ─── Tab: Información general ────────────────────────────────────────
          {
            key: 'info',
            label: 'Información general',
            children: (
              <div style={{ display: 'grid', gap: 20 }}>

                {/* Detalles del activo */}
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                    Detalles del activo
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 32px', fontSize: 13 }}>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Nombre del activo</Text><Text strong>{activo.name}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Número de activo</Text><Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{activo.assetNumber}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Fecha de compra</Text><Text>{dayjs(activo.acquisitionDate).format('DD MMM YYYY')}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Valor residual</Text><Text>{Q(activo.salvageValue)}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Dep. acumulada</Text><Text style={{ color: '#fa8c16' }}>{Q(activo.accumulatedDepreciation)}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Ubicación</Text><Text>{activo.location ?? '—'}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Número de serie</Text><Text style={{ fontFamily: 'monospace' }}>{activo.serialNumber ?? '—'}</Text></div>
                    {activo.description && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Descripción</Text>
                        <Text>{activo.description}</Text>
                      </div>
                    )}
                  </div>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                {/* Detalles de la depreciación */}
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                    Detalles de la depreciación
                  </Text>
                  {clase?.esNoDepreciable ? (
                    <Tag color="default">No depreciable</Tag>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 32px', fontSize: 13 }}>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Método</Text><Text>Línea recta</Text></div>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Frecuencia</Text><Text>Mensual</Text></div>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Tasa anual</Text><Text>{clase ? `${(Number(clase.tasaDepreciacionAnual) * 100).toFixed(2)}%` : '—'}</Text></div>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Vida útil (meses)</Text><Text>{clase?.vidaUtilMeses ?? '—'}</Text></div>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuota mensual</Text><Text style={{ fontFamily: 'monospace', color: '#722ed1' }}>{activo.depreciacionMensual ? Q(activo.depreciacionMensual) : esBorrador ? 'Se calcula al activar' : '—'}</Text></div>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Inicio depreciación</Text><Text>{dayjs(activo.acquisitionDate).add(1, 'month').startOf('month').format('DD MMM YYYY')}</Text></div>
                    </div>
                  )}
                </div>

                <Divider style={{ margin: '4px 0' }} />

                {/* Detalles de la cuenta */}
                {clase && (clase.cuentaAltasId || clase.cuentaDepreciacionAcumuladaId || clase.cuentaGastoDepreciacionId) && (
                  <div>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                      Detalles de la cuenta
                    </Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 32px', fontSize: 13 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuenta de activo fijo</Text>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{cuentaName(clase.cuentaAltasId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuenta depreciación acumulada</Text>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{cuentaName(clase.cuentaDepreciacionAcumuladaId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuenta gastos de depreciación</Text>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{cuentaName(clase.cuentaGastoDepreciacionId)}</Text>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ),
          },

          // ─── Tab: Depreciación ────────────────────────────────────────────────
          {
            key: 'depreciacion',
            label: `Depreciación${historial.length > 0 ? ` (${historial.length} registros)` : ''}`,
            children: (
              <div>
                {/* Gráfica */}
                {chartOption && (
                  <div style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                      Curva de depreciación — Valor en libros
                    </Text>
                    <ReactECharts option={chartOption} style={{ height: 220 }} />
                  </div>
                )}

                {/* Previsión */}
                {prevision.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                      Previsión de depreciación
                    </Text>
                    <Table
                      dataSource={prevision}
                      columns={previsionColumns}
                      rowKey="periodo"
                      size="small"
                      pagination={{ pageSize: 24, size: 'small' }}
                      rowClassName={r => historial.some(h => h.periodo === r.periodo) ? 'row-dep-done' : ''}
                    />
                  </>
                )}

                {/* Historial real */}
                {historial.length > 0 && (
                  <>
                    <Divider style={{ margin: '20px 0 12px' }} />
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                      Historial registrado
                    </Text>
                    <Table
                      dataSource={historial}
                      columns={historialColumns}
                      rowKey="id"
                      size="small"
                      pagination={false}
                    />
                  </>
                )}

                {prevision.length === 0 && historial.length === 0 && (
                  <Text type="secondary">Sin datos de depreciación. Asigna una clase con vida útil y activa el activo.</Text>
                )}
              </div>
            ),
          },
        ]}
      />

      <style>{`
        .row-dep-done td { background: #f6ffed !important; }
      `}</style>

      {/* ── Modal: Marcar como activo ──────────────────────────────────────── */}
      <Modal
        title="Activar activo fijo"
        open={modalActivar}
        onCancel={() => setModalActivar(false)}
        onOk={handleActivar}
        confirmLoading={savingAct}
        okText="Activar"
        okButtonProps={{ style: { background: '#389e0d', borderColor: '#389e0d' } }}
        width={420}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Se generará la póliza de alta del activo fijo.
          Selecciona la cuenta de contrapartida (CxP proveedor o banco).
        </Text>
        <Form form={formActivar} layout="vertical" size="small">
          <Form.Item name="cuentaContrapartidaId" label="Cuenta contrapartida (opcional)">
            <Select
              showSearch allowClear placeholder="Cuentas por Pagar (por defecto)"
              optionFilterProp="label"
              options={accounts.filter(a => !a.isHeader).map(a => ({
                value: a.id,
                label: `${a.code} — ${a.name}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Registrar depreciación manual ───────────────────────────── */}
      <Modal
        title="Registrar depreciación"
        open={modalDep}
        onCancel={() => setModalDep(false)}
        onOk={handleDepreciar}
        confirmLoading={savingDep}
        okText="Registrar"
        okButtonProps={{ style: { background: '#722ed1', borderColor: '#722ed1' } }}
        width={360}
      >
        <Form form={formDep} layout="vertical" size="small">
          <Form.Item name="periodo" label="Período" rules={[{ required: true, message: 'Selecciona período' }]}>
            <Select placeholder="Selecciona el período..." options={periodos} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Editar ─────────────────────────────────────────────────── */}
      <Modal
        title={`Editar ${activo.assetNumber}`}
        open={modalEdit}
        onCancel={() => setModalEdit(false)}
        onOk={handleEdit}
        confirmLoading={savingEdit}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={540}
      >
        <Form form={formEdit} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="name" label="Nombre del activo" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="claseActivoFijoId" label="Clase">
              <Select allowClear optionFilterProp="label"
                options={clases.map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))} />
            </Form.Item>
            <Form.Item name="acquisitionDate" label="Fecha de adquisición">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="location" label="Ubicación">
              <Input />
            </Form.Item>
            <Form.Item name="serialNumber" label="Número de serie">
              <Input style={{ fontFamily: 'monospace' }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Vender ─────────────────────────────────────────────────── */}
      <Modal
        title="Vender activo fijo"
        open={modalVender}
        onCancel={() => setModalVender(false)}
        onOk={handleVender}
        confirmLoading={savingVenta}
        okText="Registrar venta"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={420}
      >
        <Form form={formVender} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="fechaVenta" label="Fecha de venta" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="precioVenta" label="Precio de venta (Q)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>
          <Form.Item name="cuentaCobro" label="Cuenta de cobro">
            <Select showSearch allowClear optionFilterProp="label"
              placeholder="Efectivo/Bancos (por defecto)"
              options={accounts.filter(a => !a.isHeader).map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo / referencia">
            <Input placeholder="Ej: Venta a tercero, reemplazo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Dar de baja ─────────────────────────────────────────────── */}
      <Modal
        title="Dar de baja"
        open={modalBaja}
        onCancel={() => setModalBaja(false)}
        onOk={handleBaja}
        confirmLoading={savingBaja}
        okText="Confirmar baja"
        okButtonProps={{ danger: true }}
        width={380}
      >
        <Form form={formBaja} layout="vertical" size="small">
          <Form.Item name="fecha" label="Fecha de baja" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo" rules={[{ required: true, message: 'El motivo es requerido' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Robo, siniestro, obsolescencia..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
