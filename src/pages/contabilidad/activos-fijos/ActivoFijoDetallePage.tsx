import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Tabs, Table, Tag, Typography, Space, message,
  Popconfirm, Modal, Form, Select, InputNumber, Divider,
  DatePicker, Input, Spin, Card, Statistic, Steps, Result, Alert,
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, EditOutlined,
  DollarOutlined, StopOutlined, ThunderboltOutlined, FileSearchOutlined, RollbackOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { getApiError } from '../../../api/axios'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import {
  getActivoFijo, getHistorialDepreciacion, depreciarActivo, activarActivoFijo,
  actualizarActivoFijo, venderActivoFijo, darDeBajaActivoFijo, revertirVentaActivoFijo, revertirBajaActivoFijo,
  revertirActivacionActivoFijo, getPolizasActivoFijo, eliminarActivoFijo,
  type ActivoFijo, type HistorialDepreciacion, type EstadoActivoFijo, type PolizaActivo,
} from '../../../api/activos-fijos'
import { getClasesActivoFijo, type ClaseActivoFijo } from '../../../api/clases-activo-fijo'
import { getAccounts, type Account } from '../../../api/catalogo'
import SelectorDimensionesAnaliticas, { type DimensionesValue, useCentrosOptions } from '../../../components/SelectorDimensionesAnaliticas'

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
  const inicio  = dayjs(activo.acquisitionDate).add(1, 'month').date(25)

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
  const [polizas,   setPolizas]   = useState<PolizaActivo[]>([])
  const [clases,    setClases]    = useState<ClaseActivoFijo[]>([])
  const [accounts,  setAccounts]  = useState<Account[]>([])
  const [loading,   setLoading]   = useState(false)

  // Modales
  const [savingAct, setSavingAct] = useState(false)

  const [modalDep,  setModalDep]  = useState(false)
  const [savingDep, setSavingDep] = useState(false)
  const [formDep]   = Form.useForm()

  const [modalEdit,  setModalEdit]  = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [formEdit]   = Form.useForm()
  const [centrosEdit, setCentrosEdit] = useState<DimensionesValue>({})
  const [centrosCosto, centrosBeneficio] = useCentrosOptions()

  const [modalVender,         setModalVender]         = useState(false)
  const [savingVenta,         setSavingVenta]         = useState(false)
  const [formVender]          = Form.useForm()
  const [ventaStep,           setVentaStep]           = useState(0)
  const [ventaPrecioLive,     setVentaPrecioLive]     = useState<number | null>(null)
  const [ventaCuentaCobroLive, setVentaCuentaCobroLive] = useState<string | null>(null)

  const [savingRevertir,    setSavingRevertir]    = useState(false)
  const [savingRevertirBaja, setSavingRevertirBaja] = useState(false)

  const [modalBaja,  setModalBaja]  = useState(false)
  const [savingBaja, setSavingBaja] = useState(false)
  const [formBaja]   = Form.useForm()

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [af, hist, pols] = await Promise.all([
        getActivoFijo(id),
        getHistorialDepreciacion(id),
        getPolizasActivoFijo(id),
      ])
      setActivo(af)
      setHistorial(hist)
      setPolizas(pols)
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
    setSavingAct(true)
    try {
      await activarActivoFijo(id!, {})
      message.success('Activo activado')
      load()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al activar'))
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
      message.error(getApiError(e, 'Error al depreciar'))
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
        centroCostoId:     centrosEdit.centroCostoId    ?? undefined,
        centroBeneficioId: centrosEdit.centroBeneficioId ?? undefined,
      })
      message.success('Activo actualizado')
      setModalEdit(false)
      load()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al guardar'))
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
    setCentrosEdit({ centroCostoId: activo.centroCostoId, centroBeneficioId: activo.centroBeneficioId })
    setModalEdit(true)
  }

  const openVender = () => {
    formVender.resetFields()
    const defaultCuenta = clase?.cuentaCostoVentaAFId ?? null
    formVender.setFieldsValue({ fechaVenta: dayjs(), cuentaCobro: defaultCuenta })
    setVentaStep(0)
    setVentaPrecioLive(null)
    setVentaCuentaCobroLive(defaultCuenta)
    setModalVender(true)
  }

  const closeVenderModal = () => {
    setModalVender(false)
    setVentaStep(0)
    setVentaPrecioLive(null)
    setVentaCuentaCobroLive(null)
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
      load()
      setVentaStep(1)
    } catch (e: any) {
      message.error(getApiError(e, 'Error al registrar venta'))
    } finally { setSavingVenta(false) }
  }

  const handleRevertirVenta = async () => {
    setSavingRevertir(true)
    try {
      await revertirVentaActivoFijo(id!)
      message.success('Venta revertida — activo restaurado a ACTIVO')
      load()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al revertir la venta'))
    } finally { setSavingRevertir(false) }
  }

  const handleRevertirBaja = async () => {
    setSavingRevertirBaja(true)
    try {
      await revertirBajaActivoFijo(id!)
      message.success('Baja revertida — activo restaurado a ACTIVO')
      load()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al revertir la baja'))
    } finally { setSavingRevertirBaja(false) }
  }

  const handleRevertirActivacion = async () => {
    try {
      await revertirActivacionActivoFijo(id!)
      message.success('Activación revertida — póliza de alta eliminada, activo regresó a BORRADOR')
      load()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al revertir la activación'))
    }
  }

  const handleEliminar = async () => {
    try {
      await eliminarActivoFijo(id!)
      message.success('Activo eliminado')
      navigate('/contabilidad/activos-fijos')
    } catch (e: any) {
      message.error(getApiError(e, 'Error al eliminar el activo'))
    }
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
      message.error(getApiError(e, 'Error al dar de baja'))
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
        itemStyle: { color: (params: any) => depreciados.has(labelsExt[params.dataIndex]) ? '#2ea172' : '#1faec2' },
        lineStyle: { color: '#1faec2', width: 2 },
        areaStyle: { color: 'rgba(27,58,107,0.08)' },
      }],
    }
  }, [prevision, historial, activo])

  // ── Columnas historial ────────────────────────────────────────────────────
  const historialColumns = [
    {
      title: 'Período', dataIndex: 'periodo', width: 100,
      render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>,
    },
    { title: 'Cuota',           dataIndex: 'cuota',                   width: 130, align: 'right' as const, render: (v: number) => Q(v) },
    { title: 'Dep. Acumulada',  dataIndex: 'depreciacionAcumuladaFin', width: 140, align: 'right' as const, render: (v: number) => <Text type="warning">{Q(v)}</Text> },
    { title: 'Valor en Libros', dataIndex: 'valorLibroFin',            width: 140, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#1faec2' }}>{Q(v)}</Text> },
    { title: 'Fecha',           dataIndex: 'fechaCalculo',             width: 130, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Póliza', dataIndex: 'asientoId', width: 90,
      render: (asientoId: string | null) => asientoId ? (
        <Button
          type="link" size="small" icon={<FileSearchOutlined />}
          onClick={() => navigate(`/contabilidad/diarios-manuales/${asientoId}`)}
          style={{ padding: 0 }}
        >
          Ver
        </Button>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
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
    { title: 'Valor actual',                dataIndex: 'valorLibro',   align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#1faec2' }}>{Q(v)}</Text> },
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

  // ── Póliza de baja: solo elimina el activo de libros ─────────────────────
  // La ganancia/pérdida neta se reconoce cuando se emite la factura en Ventas.
  // depAcum + valorLibro = costoOriginal → siempre cuadra sin cuenta puente.
  const calcVentaPoliza = (precioVenta: number, cuentaCobroId?: string | null) => {
    if (!clase) return null
    const originalCost = Number(activo.originalCost)
    const depAcum      = Number(activo.accumulatedDepreciation)
    const valorLibro   = Number(activo.currentBookValue)
    const ganancia     = precioVenta - valorLibro

    const getNombre = (cuentaId: string | null | undefined, label: string) => {
      if (!cuentaId) return `⚠ Sin configurar (${label})`
      const found = accounts.find(a => a.id === cuentaId)
      return found ? `${found.code} — ${found.name}` : cuentaId
    }

    type VLine = { key: string; cuenta: string; debit: number; credit: number; tipo: string }
    const lines: VLine[] = []

    // Dr Banco/CxC — efectivo recibido
    lines.push({ key: '0', cuenta: getNombre(cuentaCobroId, 'Banco / CxC'), debit: precioVenta, credit: 0, tipo: 'cobro' })

    // Dr DepAcum — elimina depreciación acumulada
    if (depAcum > 0)
      lines.push({ key: '1', cuenta: getNombre(clase.cuentaDepreciacionAcumuladaId, 'Dep. Acumulada'), debit: depAcum, credit: 0, tipo: 'depAcum' })

    // Dr Pérdida — si el precio es menor al valor en libros
    if (ganancia < 0)
      lines.push({ key: '2p', cuenta: getNombre(clase.cuentaPerdidaPorVentaId, 'Pérdida Venta AF'), debit: Math.abs(ganancia), credit: 0, tipo: 'perdida' })

    // Cr Activo Fijo — retira el activo al costo original
    lines.push({ key: '3', cuenta: getNombre(clase.cuentaAltasId, 'Activo Fijo'), debit: 0, credit: originalCost, tipo: 'activo' })

    // Cr Ganancia — base imponible ISR 10% (Art. 84 LUE Guatemala)
    if (ganancia > 0)
      lines.push({ key: '4', cuenta: getNombre(clase.cuentaGananciaPorVentaId, 'Ganancia Venta AF'), debit: 0, credit: ganancia, tipo: 'ganancia' })

    return {
      lines,
      ganancia,
      isr: ganancia > 0 ? ganancia * 0.10 : 0,
      totalDebit:  lines.reduce((s, l) => s + l.debit,  0),
      totalCredit: lines.reduce((s, l) => s + l.credit, 0),
    }
  }

  const polizaPreview = (ventaPrecioLive != null && ventaPrecioLive > 0)
    ? calcVentaPoliza(ventaPrecioLive, ventaCuentaCobroLive)
    : null

  const calcBajaPoliza = () => {
    if (!activo) return null
    const originalCost = Number(activo.originalCost)
    const depAcum      = Number(activo.accumulatedDepreciation)
    const valorLibro   = Number(activo.currentBookValue)

    const getNombre = (cuentaId: string | null | undefined, label: string) => {
      if (!cuentaId) return `⚠ Sin configurar (${label})`
      const found = accounts.find(a => a.id === cuentaId)
      return found ? `${found.code} — ${found.name}` : cuentaId
    }

    type BLine = { key: string; cuenta: string; debit: number; credit: number; tipo: string }
    const lines: BLine[] = []
    if (depAcum > 0)
      lines.push({ key: '1', cuenta: getNombre(clase?.cuentaDepreciacionAcumuladaId, 'Dep. Acumulada'), debit: depAcum, credit: 0, tipo: 'depAcum' })
    if (valorLibro > 0)
      lines.push({ key: '2', cuenta: getNombre(clase?.cuentaPerdidaPorDeterioro, 'Pérdida por Deterioro'), debit: valorLibro, credit: 0, tipo: 'perdida' })
    lines.push({ key: '3', cuenta: getNombre(clase?.cuentaAltasId, 'Activo Fijo'), debit: 0, credit: originalCost, tipo: 'activo' })

    return {
      lines, valorLibro,
      totalDebit:  lines.reduce((s, l) => s + l.debit,  0),
      totalCredit: lines.reduce((s, l) => s + l.credit, 0),
    }
  }
  const polizaBajaPreview = calcBajaPoliza()

  return (
    <div style={{ padding: '0 24px 24px' }}>

      {/* ── Cabecera ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        padding: '14px 0 12px', borderBottom: '1px solid rgba(10,10,10,0.08)', marginBottom: 20,
      }}>
        <Button size="small" icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/contabilidad/activos-fijos')}>
          Activos Fijos
        </Button>
        <Divider type="vertical" />
        <Title level={5} style={{ margin: 0, color: '#0a0a0a', fontWeight: 700 }}>
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
            <Popconfirm
              title="¿Eliminar este activo fijo?"
              description="Esta acción no se puede deshacer. Solo se permite eliminar activos en estado Borrador."
              onConfirm={handleEliminar}
              okText="Eliminar" cancelText="Cancelar"
              okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />}>Eliminar</Button>
            </Popconfirm>
          )}
          {esBorrador && (
            <Popconfirm
              title="¿Activar este activo fijo?"
              description={
                activo.purchaseInvoiceId
                  ? 'El estado cambiará a Activo. No se generará póliza contable (ya fue contabilizado con la factura de compra).'
                  : 'El estado cambiará a Activo. Se generará la póliza de alta con contrapartida a Cuentas por Pagar.'
              }
              onConfirm={handleActivar}
              okText="Activar" cancelText="Cancelar"
              okButtonProps={{ style: { background: '#2ea172', borderColor: '#2ea172' } }}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#2ea172', borderColor: '#2ea172' }}>
                Marcar como activo
              </Button>
            </Popconfirm>
          )}
          {esActivo && depreciable && (
            <Button size="small" icon={<ThunderboltOutlined />}
              style={{ color: '#6b7280', borderColor: '#6b7280' }}
              onClick={() => { formDep.resetFields(); setModalDep(true) }}>
              Registrar depreciación
            </Button>
          )}
          {esActivo && (
            <Button size="small" icon={<DollarOutlined />} onClick={openVender}>
              Vender
            </Button>
          )}
          {esActivo && (
            <Button size="small" danger icon={<StopOutlined />}
              onClick={() => { formBaja.resetFields(); formBaja.setFieldsValue({ fecha: dayjs() }); setModalBaja(true) }}>
              Dar de baja
            </Button>
          )}
          {activo.estado === 'VENDIDO' && (
            <Popconfirm
              title="¿Revertir la venta de este activo?"
              description="Se anulará la póliza de baja y el activo volverá a estado Activo."
              onConfirm={handleRevertirVenta}
              okText="Revertir" cancelText="Cancelar"
              okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<RollbackOutlined />} loading={savingRevertir}>
                Revertir venta
              </Button>
            </Popconfirm>
          )}
          {esActivo && (
            <Popconfirm
              title="¿Revertir la activación?"
              description="Se eliminará la póliza de alta y el activo regresará a BORRADOR para corregir y reactivar."
              onConfirm={handleRevertirActivacion}
              okText="Revertir" cancelText="Cancelar"
              okButtonProps={{ danger: true }}>
              <Button size="small" icon={<RollbackOutlined />} style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>
                Revertir activación
              </Button>
            </Popconfirm>
          )}
          {activo.estado === 'DADO_DE_BAJA' && (
            <Popconfirm
              title="¿Revertir la baja de este activo?"
              description="Se anulará la póliza de baja y el activo volverá a estado Activo."
              onConfirm={handleRevertirBaja}
              okText="Revertir" cancelText="Cancelar"
              okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<RollbackOutlined />} loading={savingRevertirBaja}>
                Revertir baja
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* ── Cards resumen ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <Card size="small" style={{ borderRadius: 10 }}>
          <Statistic
            title={<Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo de activo fijo</Text>}
            value={clase ? `${clase.codigo} — ${clase.nombre}` : 'Sin clase asignada'}
            valueStyle={{ fontSize: 14, color: '#0a0a0a', fontWeight: 600 }}
          />
        </Card>
        <Card size="small" style={{ borderRadius: 10 }}>
          <Statistic
            title={<Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor de compra</Text>}
            value={Q(activo.originalCost)}
            valueStyle={{ fontSize: 16, color: '#0a0a0a', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
          />
        </Card>
        <Card size="small" style={{ borderRadius: 10 }}>
          <Statistic
            title={<Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor actual (en libros)</Text>}
            value={Q(activo.currentBookValue)}
            valueStyle={{
              fontSize: 16,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: Number(activo.currentBookValue) < Number(activo.originalCost) ? '#ff7f00' : '#2ea172',
            }}
          />
        </Card>
      </div>

      {/* ── Resultado de la venta (solo VENDIDO) ────────────────────────────── */}
      {activo.estado === 'VENDIDO' && activo.disposalValue != null && (() => {
        const precioNeto = Number(activo.disposalValue)
        const valorLibro = Number(activo.currentBookValue)
        const resultado  = precioNeto - valorLibro
        return (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20,
            padding: '14px 16px', borderRadius: 10,
            background: resultado > 0 ? '#e8f5ef' : resultado < 0 ? '#fff1f0' : '#fafbfc',
            border: `1px solid ${resultado > 0 ? '#c3e5d8' : resultado < 0 ? '#f8c9cb' : 'rgba(10,10,10,0.08)'}`,
          }}>
            <div>
              <Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Fecha de venta</Text>
              <Text strong>{activo.disposedAt ? dayjs(activo.disposedAt).format('DD/MM/YYYY') : '—'}</Text>
            </div>
            <div>
              <Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Precio de venta (neto)</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{Q(precioNeto)}</Text>
            </div>
            <div>
              <Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Valor en libros</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#ff7f00' }}>{Q(valorLibro)}</Text>
            </div>
            <div>
              <Text style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', fontWeight: 700,
                color: resultado > 0 ? '#2ea172' : resultado < 0 ? '#e5484d' : '#6b7280',
              }}>
                {resultado > 0 ? '↑ Ganancia en venta' : resultado < 0 ? '↓ Pérdida en venta' : 'Sin resultado'}
              </Text>
              <Text strong style={{
                fontVariantNumeric: 'tabular-nums', fontSize: 15,
                color: resultado > 0 ? '#2ea172' : resultado < 0 ? '#e5484d' : '#6b7280',
              }}>
                {resultado !== 0 ? Q(Math.abs(resultado)) : '—'}
              </Text>
            </div>
          </div>
        )
      })()}

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
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                    Detalles del activo
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 32px', fontSize: 13 }}>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Nombre del activo</Text><Text strong>{activo.name}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Número de activo</Text><Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{activo.assetNumber}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Fecha de compra</Text><Text>{dayjs(activo.acquisitionDate).format('DD MMM YYYY')}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Valor residual</Text><Text>{Q(activo.salvageValue)}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Dep. acumulada</Text><Text style={{ color: '#ff7f00' }}>{Q(activo.accumulatedDepreciation)}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Ubicación</Text><Text>{activo.location ?? '—'}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Número de serie</Text><Text style={{ fontVariantNumeric: 'tabular-nums' }}>{activo.serialNumber ?? '—'}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Centro de Costo</Text><Text>{activo.centroCostoId ? (centrosCosto.find(c => c.id === activo.centroCostoId)?.nombre ?? activo.centroCostoId) : '—'}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Centro de Beneficio</Text><Text>{activo.centroBeneficioId ? (centrosBeneficio.find(c => c.id === activo.centroBeneficioId)?.nombre ?? activo.centroBeneficioId) : '—'}</Text></div>
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
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
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
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuota mensual</Text><Text style={{ fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{activo.depreciacionMensual ? Q(activo.depreciacionMensual) : esBorrador ? 'Se calcula al activar' : '—'}</Text></div>
                      <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Inicio depreciación</Text><Text>{dayjs(activo.acquisitionDate).add(1, 'month').startOf('month').format('DD MMM YYYY')}</Text></div>
                    </div>
                  )}
                </div>

                <Divider style={{ margin: '4px 0' }} />

                {/* Detalles de la cuenta */}
                {clase && (clase.cuentaAltasId || clase.cuentaDepreciacionAcumuladaId || clase.cuentaGastoDepreciacionId) && (
                  <div>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                      Detalles de la cuenta
                    </Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 32px', fontSize: 13 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuenta de activo fijo</Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{cuentaName(clase.cuentaAltasId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuenta depreciación acumulada</Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{cuentaName(clase.cuentaDepreciacionAcumuladaId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cuenta gastos de depreciación</Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{cuentaName(clase.cuentaGastoDepreciacionId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Costo de Venta AF</Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{cuentaName(clase.cuentaCostoVentaAFId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Ganancia por Venta AF</Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{cuentaName(clase.cuentaGananciaPorVentaId)}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Pérdida por Venta AF</Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{cuentaName(clase.cuentaPerdidaPorVentaId)}</Text>
                      </div>
                    </div>
                  </div>
                )}


                {/* ── Historial de pólizas ─────────────────────────────────── */}
                {polizas.filter(p => ['activo_fijo_alta', 'activo_fijo_baja', 'activo_fijo_venta'].includes(p.sourceDocumentType)).map(pol => {
                  const labelMap: Record<string, string> = {
                    activo_fijo_alta:  'Póliza de alta',
                    activo_fijo_venta: 'Póliza de venta',
                    activo_fijo_baja:  'Póliza de baja',
                  }
                  return (
                  <div key={pol.id}>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {labelMap[pol.sourceDocumentType] ?? pol.sourceDocumentType}
                        </Text>
                        <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontSize: 12, fontWeight: 600 }}>
                          {pol.entryNumber}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(pol.entryDate).format('DD/MM/YYYY')}
                        </Text>
                        <Button
                          size="small" type="link" icon={<FileSearchOutlined />}
                          style={{ padding: 0, fontSize: 12 }}
                          onClick={() => navigate(`/contabilidad/diarios-manuales/${pol.id}`)}>
                          Ver póliza
                        </Button>
                      </div>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="id"
                        dataSource={pol.lines}
                        style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 6, overflow: 'hidden' }}
                        columns={[
                          {
                            title: 'Cuenta', dataIndex: 'accountCode',
                            render: (_: string, r: any) => (
                              <Text style={{ fontSize: 12 }}>{r.accountCode} — {r.accountName}</Text>
                            ),
                          },
                          {
                            title: 'Descripción', dataIndex: 'description', width: 200,
                            render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
                          },
                          {
                            title: 'Débito', dataIndex: 'debit', width: 120, align: 'right' as const,
                            render: (v: number) => Number(v) > 0
                              ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(v)}</Text>
                              : null,
                          },
                          {
                            title: 'Crédito', dataIndex: 'credit', width: 120, align: 'right' as const,
                            render: (v: number) => Number(v) > 0
                              ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(v)}</Text>
                              : null,
                          },
                        ]}
                        summary={() => (
                          <Table.Summary>
                            <Table.Summary.Row style={{ background: '#fafbfc' }}>
                              <Table.Summary.Cell index={0} colSpan={2}>
                                <Text strong style={{ fontSize: 12 }}>Total</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={2} align="right">
                                <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(pol.totalDebit)}</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={3} align="right">
                                <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(pol.totalCredit)}</Text>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          </Table.Summary>
                        )}
                      />
                    </div>
                  </div>
                  )
                })}
              </div>
            ),
          },

          // ─── Tab: Depreciación ────────────────────────────────────────────────
          {
            key: 'depreciacion',
            label: `Depreciación${historial.length > 0 ? ` (${historial.length} registros)` : ''}`,
            children: (
              <div>
                {/* Gráfica — solo activos vigentes */}
                {!esDisposed && chartOption && (
                  <div style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                      Curva de depreciación — Valor en libros
                    </Text>
                    <ReactECharts option={chartOption} style={{ height: 220 }} />
                  </div>
                )}

                {/* Aviso de baja — solo cuando está dado de baja o vendido */}
                {esDisposed && (
                  <Alert
                    type={activo.estado === 'VENDIDO' ? 'info' : 'warning'}
                    showIcon
                    message={activo.estado === 'VENDIDO' ? 'Activo vendido' : 'Activo dado de baja'}
                    description={
                      activo.estado === 'VENDIDO'
                        ? `Este activo fue vendido el ${activo.disposedAt ? dayjs(activo.disposedAt).format('DD/MM/YYYY') : '—'}. No registrará más depreciación. El historial previo se muestra a continuación.`
                        : `Este activo fue dado de baja el ${activo.disposedAt ? dayjs(activo.disposedAt).format('DD/MM/YYYY') : '—'}. No registrará más depreciación. El historial previo se muestra a continuación.`
                    }
                    style={{ marginBottom: 20 }}
                  />
                )}

                {/* Previsión — solo activos vigentes */}
                {!esDisposed && prevision.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
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
                    {!esDisposed && <Divider style={{ margin: '20px 0 12px' }} />}
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
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

                {!esDisposed && prevision.length === 0 && historial.length === 0 && (
                  <Text type="secondary">Sin datos de depreciación. Asigna una clase con vida útil y activa el activo.</Text>
                )}
              </div>
            ),
          },
        ]}
      />

      <style>{`
        .row-dep-done td { background: #e8f5ef !important; }
      `}</style>

      {/* ── Modal: Registrar depreciación manual ───────────────────────────── */}
      <Modal
        title="Registrar depreciación"
        open={modalDep}
        onCancel={() => setModalDep(false)}
        onOk={handleDepreciar}
        confirmLoading={savingDep}
        okText="Registrar"
        okButtonProps={{ style: { background: '#6b7280', borderColor: '#6b7280' } }}
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
        okButtonProps={{ style: { background: '#1faec2' } }}
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
              <Input style={{ fontVariantNumeric: 'tabular-nums' }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <SelectorDimensionesAnaliticas
            layout="form"
            size="small"
            value={centrosEdit}
            onChange={setCentrosEdit}
          />
        </Form>
      </Modal>

      {/* ── Modal: Vender (2 pasos) ────────────────────────────────────────── */}
      <Modal
        title={ventaStep === 0 ? 'Vender activo fijo' : 'Venta registrada'}
        open={modalVender}
        onCancel={closeVenderModal}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Steps
          current={ventaStep}
          size="small"
          style={{ marginBottom: 20, marginTop: 8 }}
          items={[{ title: 'Datos de venta' }, { title: 'Póliza confirmada' }]}
        />

        {ventaStep === 0 && (
          <>
            <Form
              form={formVender} layout="vertical" size="small"
              onValuesChange={(_, all) => {
                setVentaPrecioLive(all.precioVenta ?? null)
                setVentaCuentaCobroLive(all.cuentaCobro ?? null)
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item name="fechaVenta" label="Fecha de venta" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item name="precioVenta" label="Precio neto de venta (sin IVA)" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                </Form.Item>
              </div>
              <Form.Item name="cuentaCobro" label="Cuenta de cobro (banco / CxC)" rules={[{ required: true, message: 'Selecciona la cuenta donde entra el dinero' }]}>
                <Select
                  showSearch optionFilterProp="label" placeholder="Seleccionar cuenta..."
                  options={accounts
                    .filter(a => a.balanceType === 'Activo' && !a.isHeader)
                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                />
              </Form.Item>
              <Form.Item name="motivo" label="Motivo / referencia" style={{ marginBottom: 0 }}>
                <Input placeholder="Ej: Venta a tercero, reemplazo..." />
              </Form.Item>
            </Form>

            {/* ── Preview en vivo de la póliza ─────────────────────────────── */}
            {polizaPreview && (
              <>
                <Divider style={{ margin: '16px 0 12px' }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Póliza de reversa que se generará</Text>
                </Divider>

                {/* Banner ganancia / pérdida + ISR estimado */}
                <div style={{
                  padding: '10px 14px', borderRadius: 6, marginBottom: 12,
                  background: polizaPreview.ganancia > 0 ? '#e8f5ef' : polizaPreview.ganancia < 0 ? '#fff1f0' : '#fafbfc',
                  border: `1px solid ${polizaPreview.ganancia > 0 ? '#c3e5d8' : polizaPreview.ganancia < 0 ? '#f8c9cb' : 'rgba(10,10,10,0.08)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Text strong style={{
                      fontSize: 13,
                      color: polizaPreview.ganancia > 0 ? '#2ea172' : polizaPreview.ganancia < 0 ? '#e5484d' : '#6b7280',
                    }}>
                      {polizaPreview.ganancia > 0 ? '↑ Ganancia en venta:'
                        : polizaPreview.ganancia < 0 ? '↓ Pérdida en venta:'
                        : '✓ Venta al valor en libros'}
                    </Text>
                    {polizaPreview.ganancia !== 0 && (
                      <Text style={{
                        fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14,
                        color: polizaPreview.ganancia > 0 ? '#2ea172' : '#e5484d',
                      }}>
                        {Q(Math.abs(polizaPreview.ganancia))}
                      </Text>
                    )}
                    <div style={{ flex: 1 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Valor en libros: {Q(activo.currentBookValue)}
                    </Text>
                  </div>
                  {polizaPreview.isr > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #c3e5d8', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#2ea172' }}>ISR estimado 10% (Art. 84 LUE):</Text>
                      <Text style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12, color: '#2ea172' }}>
                        {Q(polizaPreview.isr)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>— a pagar dentro de los 10 días del mes siguiente</Text>
                    </div>
                  )}
                </div>

                {/* Tabla de líneas contables */}
                <Table
                  size="small"
                  pagination={false}
                  rowKey="key"
                  dataSource={polizaPreview.lines}
                  style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 6, overflow: 'hidden' }}
                  columns={[
                    {
                      title: 'Cuenta', dataIndex: 'cuenta',
                      render: (v: string, r: any) => {
                        const colorMap: Record<string, string> = {
                          cobro:   '#1faec2',
                          depAcum: '#ff7f00',
                          activo:  '#6b7280',
                          ganancia:'#2ea172',
                          perdida: '#e5484d',
                        }
                        return <Text style={{ fontSize: 12, color: colorMap[r.tipo] ?? 'inherit' }}>{v}</Text>
                      },
                    },
                    {
                      title: 'Débito', dataIndex: 'debit', width: 120, align: 'right' as const,
                      render: (v: number) => v > 0
                        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(v)}</Text>
                        : null,
                    },
                    {
                      title: 'Crédito', dataIndex: 'credit', width: 120, align: 'right' as const,
                      render: (v: number) => v > 0
                        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(v)}</Text>
                        : null,
                    },
                  ]}
                  summary={() => (
                    <Table.Summary>
                      <Table.Summary.Row style={{ background: '#fafbfc' }}>
                        <Table.Summary.Cell index={0}>
                          <Text strong style={{ fontSize: 12 }}>Total</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                            {Q(polizaPreview.totalDebit)}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                            {Q(polizaPreview.totalCredit)}
                          </Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <Button onClick={closeVenderModal}>Cancelar</Button>
              <Button
                type="primary" loading={savingVenta} onClick={handleVender}
                style={{ background: '#1faec2' }} icon={<DollarOutlined />}
              >
                Registrar venta
              </Button>
            </div>
          </>
        )}

        {ventaStep === 1 && (
          <Result
            status="success"
            title="Póliza de venta registrada"
            subTitle="El activo fue retirado de libros. La ganancia/pérdida quedó explícita en las cuentas 700x/710x. Emite la factura FEL en Ventas para documentar ante SAT (puede quedar en Borrador — el asiento contable ya está registrado)."
            extra={[
              <Button
                key="ventas" type="primary"
                style={{ background: '#1faec2' }}
                onClick={() => { closeVenderModal(); navigate('/ventas/facturas/nueva') }}
              >
                Ir a Ventas → Crear factura FEL
              </Button>,
              <Button key="close" onClick={closeVenderModal}>Cerrar</Button>,
            ]}
          />
        )}
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
        width={600}
      >
        <Form form={formBaja} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="fecha" label="Fecha de baja" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <div />
          </div>
          <Form.Item name="motivo" label="Motivo" rules={[{ required: true, message: 'El motivo es requerido' }]} style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} placeholder="Ej: Robo, siniestro, obsolescencia..." />
          </Form.Item>
        </Form>

        {/* ── Preview póliza ─────────────────────────────────────────────── */}
        {polizaBajaPreview && (
          <>
            <Divider style={{ margin: '16px 0 12px' }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Póliza contable que se generará</Text>
            </Divider>

            {/* Banner valor en libros */}
            <div style={{
              padding: '10px 14px', borderRadius: 6, marginBottom: 12,
              background: polizaBajaPreview.valorLibro > 0 ? '#fff1f0' : '#fafbfc',
              border: `1px solid ${polizaBajaPreview.valorLibro > 0 ? '#f8c9cb' : 'rgba(10,10,10,0.08)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 13, color: polizaBajaPreview.valorLibro > 0 ? '#e5484d' : '#6b7280' }}>
                  {polizaBajaPreview.valorLibro > 0 ? '↓ Pérdida por deterioro:' : '✓ Activo totalmente depreciado'}
                </Text>
                {polizaBajaPreview.valorLibro > 0 && (
                  <Text style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, color: '#e5484d' }}>
                    {Q(polizaBajaPreview.valorLibro)}
                  </Text>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                El valor en libros se registra como pérdida contable al dar de baja el activo.
              </Text>
            </div>

            <Table
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={polizaBajaPreview.lines}
              style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 6, overflow: 'hidden' }}
              columns={[
                {
                  title: 'Cuenta', dataIndex: 'cuenta',
                  render: (v: string, r: any) => (
                    <Text style={{
                      fontSize: 12,
                      color: r.tipo === 'perdida' ? '#e5484d' : r.tipo === 'activo' ? '#1faec2' : 'inherit',
                    }}>
                      {v}
                    </Text>
                  ),
                },
                {
                  title: 'Débito', dataIndex: 'debit', width: 120, align: 'right' as const,
                  render: (v: number) => v > 0
                    ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(v)}</Text>
                    : null,
                },
                {
                  title: 'Crédito', dataIndex: 'credit', width: 120, align: 'right' as const,
                  render: (v: number) => v > 0
                    ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(v)}</Text>
                    : null,
                },
              ]}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row style={{ background: '#fafbfc' }}>
                    <Table.Summary.Cell index={0}>
                      <Text strong style={{ fontSize: 12 }}>Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {Q(polizaBajaPreview.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {Q(polizaBajaPreview.totalCredit)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
