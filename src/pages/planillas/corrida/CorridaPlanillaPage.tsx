import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, InputNumber, Popconfirm, Row, Space, Spin,
  Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, ReloadOutlined, CheckCircleOutlined, DeleteOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPeriodoPlanilla, recalcularPeriodoPlanilla, actualizarDetallePlanilla,
  aprobarPeriodoPlanilla, eliminarPeriodoPlanilla,
  type PeriodoPlanillaDetalle, type DetallePlanilla,
} from '../../../api/planillas-corrida'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO_COLOR: Record<string, string> = { BORRADOR: 'orange', APROBADA: 'green', PAGADA: 'blue' }

/** Celda numérica con estado local — commitea al salir del campo (onBlur) */
function CellNumber({ value, onCommit, disabled, max, precision = 2 }: {
  value: number
  onCommit: (v: number) => void
  disabled?: boolean
  max?: number
  precision?: number
}) {
  const [local, setLocal] = useState<number | null>(Number(value))
  useEffect(() => { setLocal(Number(value)) }, [value])
  if (disabled) {
    return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{Number(value).toFixed(precision)}</span>
  }
  return (
    <InputNumber
      size="small" style={{ width: '100%' }} min={0} max={max} precision={precision}
      value={local} onChange={setLocal}
      onBlur={() => {
        const v = Number(local ?? 0)
        if (v !== Number(value)) onCommit(v)
      }}
      onPressEnter={e => (e.target as HTMLInputElement).blur()}
    />
  )
}

export default function CorridaPlanillaPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [periodo, setPeriodo] = useState<PeriodoPlanillaDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const cargar = () => {
    setLoading(true)
    getPeriodoPlanilla(id!)
      .then(setPeriodo)
      .catch(() => message.error('Error cargando la corrida'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const editable = periodo?.estado === 'BORRADOR'

  const commit = async (detalleId: string, campo: string, valor: number) => {
    try {
      setProcesando(true)
      const actualizado = await actualizarDetallePlanilla(detalleId, { [campo]: valor })
      setPeriodo(actualizado)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al actualizar')
      cargar()
    } finally {
      setProcesando(false)
    }
  }

  const recalcular = async () => {
    try {
      setProcesando(true)
      setPeriodo(await recalcularPeriodoPlanilla(id!))
      message.success('Corrida recalculada')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al recalcular')
    } finally {
      setProcesando(false)
    }
  }

  const aprobar = async () => {
    try {
      setProcesando(true)
      setPeriodo(await aprobarPeriodoPlanilla(id!))
      message.success('Planilla aprobada — los montos quedaron congelados')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al aprobar')
    } finally {
      setProcesando(false)
    }
  }

  const eliminar = async () => {
    try {
      await eliminarPeriodoPlanilla(id!)
      message.success('Corrida eliminada')
      navigate('/planillas/corridas')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar')
    }
  }

  const columns: ColumnsType<DetallePlanilla> = [
    {
      title: 'Empleado', key: 'empleado', fixed: 'left', width: 190,
      render: (_, d) => (
        <div>
          <Text strong style={{ fontSize: 12, color: NAVY }}>{d.empleadoNombre}</Text>
          <div style={{ fontSize: 10, color: '#8c8c8c' }}>
            {d.empleadoCodigo} · {d.tipoJornada.toLowerCase()}
            {d.advertencias && (
              <Tooltip title={d.advertencias}>
                <WarningOutlined style={{ color: '#d46b08', marginLeft: 6 }} />
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Salario', dataIndex: 'salarioMensual', width: 105, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span>,
    },
    {
      title: 'Días', key: 'diasTrabajados', width: 80, align: 'right',
      render: (_, d) => <CellNumber value={d.diasTrabajados} max={31} precision={1} disabled={!editable}
        onCommit={v => commit(d.id, 'diasTrabajados', v)} />,
    },
    {
      title: <Tooltip title="Horas extra en jornada hábil — recargo 50% (Art. 121 CT)">HE hábil</Tooltip>,
      key: 'horasExtraHabil', width: 85, align: 'right',
      render: (_, d) => <CellNumber value={d.horasExtraHabil} precision={1} disabled={!editable}
        onCommit={v => commit(d.id, 'horasExtraHabil', v)} />,
    },
    {
      title: <Tooltip title="Horas extra nocturnas, descanso o feriado — recargo 100%">HE esp.</Tooltip>,
      key: 'horasExtraEspecial', width: 85, align: 'right',
      render: (_, d) => <CellNumber value={d.horasExtraEspecial} precision={1} disabled={!editable}
        onCommit={v => commit(d.id, 'horasExtraEspecial', v)} />,
    },
    {
      title: 'M. extras', dataIndex: 'montoHorasExtra', width: 95, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span>,
    },
    {
      title: <Tooltip title="Q250 de ley (Dto. 78-89), proporcional a días — no paga IGSS">Bonif.</Tooltip>,
      dataIndex: 'bonificacionIncentivo', width: 85, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span>,
    },
    {
      title: 'Otros ing.', key: 'otrosIngresos', width: 100, align: 'right',
      render: (_, d) => <CellNumber value={d.otrosIngresos} disabled={!editable}
        onCommit={v => commit(d.id, 'otrosIngresos', v)} />,
    },
    {
      title: 'Devengado', dataIndex: 'totalDevengado', width: 110, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: <Tooltip title="4.83% sobre salario + horas extra (sin bonificación)">IGSS</Tooltip>,
      dataIndex: 'cuotaIGSSLaboral', width: 90, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span>,
    },
    {
      title: <Tooltip title="Retención mensual por proyección anual (Dto. 10-2012/13-2026)">ISR</Tooltip>,
      dataIndex: 'isrRetenido', width: 90, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span>,
    },
    {
      title: 'Otras ded.', key: 'otrasDeducciones', width: 100, align: 'right',
      render: (_, d) => <CellNumber value={d.otrasDeducciones} disabled={!editable}
        onCommit={v => commit(d.id, 'otrasDeducciones', v)} />,
    },
    {
      title: 'Neto a pagar', dataIndex: 'netoAPagar', width: 120, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(v)}</Text>,
    },
    {
      title: <Tooltip title="IGSS 10.67% + INTECAP 1% + IRTRA 1% — gasto del patrono">C. patronal</Tooltip>,
      key: 'patronal', width: 105, align: 'right',
      render: (_, d) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#8c8c8c' }}>
          {fmtQ(Number(d.cuotaPatronalIGSS) + Number(d.cuotaINTECAP) + Number(d.cuotaIRTRA))}
        </span>
      ),
    },
    {
      title: 'Banco', key: 'banco', width: 130,
      render: (_, d) => d.metodoPago === 'INSTITUCION_FINANCIERA' && d.bancoNombre
        ? (
          <Tooltip title={`${d.bancoNombre} · ${d.numeroCuentaBancaria ?? 'sin cuenta'}`}>
            <Text style={{ fontSize: 11 }}>{d.bancoNombre.length > 16 ? `${d.bancoNombre.slice(0, 16)}…` : d.bancoNombre}</Text>
          </Tooltip>
        )
        : <Tag style={{ fontSize: 10 }}>{d.metodoPago === 'CHEQUE' ? 'Cheque' : d.metodoPago === 'BILLETERA_ELECTRONICA' ? 'Billetera' : 'Otro'}</Tag>,
    },
  ]

  if (!periodo) return <Spin spinning={loading}><div style={{ height: 200 }} /></Spin>

  const advertenciasCount = periodo.detalles.filter(d => d.advertencias).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/planillas/corridas')} style={{ marginTop: 2 }} />
          <div>
            <Title level={4} style={{ margin: 0, color: NAVY }}>
              Planilla {MESES[periodo.mes - 1]} {periodo.anio}
              <Tag color={ESTADO_COLOR[periodo.estado]} style={{ marginLeft: 10, fontSize: 11, verticalAlign: 'middle' }}>{periodo.estado}</Tag>
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(periodo.fechaInicio).format('DD/MM/YYYY')} — {dayjs(periodo.fechaFin).format('DD/MM/YYYY')} · {periodo.totalEmpleados} empleados
              {periodo.aprobadoAt && ` · aprobada ${dayjs(periodo.aprobadoAt).format('DD/MM/YYYY HH:mm')}${periodo.aprobadoPor ? ` por ${periodo.aprobadoPor}` : ''}`}
            </Text>
          </div>
        </Space>
        {editable && (
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={procesando} onClick={recalcular}>Recalcular</Button>
            <Popconfirm title="¿Eliminar esta corrida en borrador?" okText="Eliminar" cancelText="Cancelar" onConfirm={eliminar}>
              <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
            </Popconfirm>
            <Popconfirm
              title="¿Aprobar la planilla?"
              description="Los montos quedan congelados y ya no se podrá editar. Requiere el mapeo de cuentas contables completo."
              okText="Aprobar" cancelText="Cancelar" onConfirm={aprobar}>
              <Button type="primary" icon={<CheckCircleOutlined />} loading={procesando} style={{ background: '#389e0d' }}>
                Aprobar planilla
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>

      {advertenciasCount > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message={`${advertenciasCount} línea(s) con advertencias`}
          description="Pasa el cursor sobre el ícono naranja de cada empleado para ver el detalle (límite de horas extra, exceso de ISR retenido…)." />
      )}

      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total devengado', value: periodo.totalDevengado, color: NAVY },
          { label: 'Total deducciones', value: periodo.totalDeducciones, color: '#cf1322' },
          { label: 'Neto a pagar', value: periodo.totalNeto, color: '#389e0d' },
          { label: 'Cuota patronal (gasto)', value: periodo.totalCuotaPatronal, color: '#8c8c8c' },
        ].map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
              <Statistic title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                value={k.value} precision={2} prefix="Q"
                valueStyle={{ fontSize: 14, fontFamily: 'monospace', color: k.color }}
                formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}
        title={<Text strong style={{ fontSize: 13 }}>Detalle por empleado</Text>}
        extra={editable && <Text type="secondary" style={{ fontSize: 11 }}>Edita días, horas extra y otros montos — el cálculo se actualiza al salir de la celda</Text>}>
        <Spin spinning={loading || procesando}>
          <Table
            size="small" rowKey="id" dataSource={periodo.detalles} columns={columns}
            pagination={false} scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </div>
  )
}
