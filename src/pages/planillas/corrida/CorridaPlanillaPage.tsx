import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, DatePicker, Form, InputNumber, Modal, Popconfirm, Row, Select, Space, Spin,
  Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, ReloadOutlined, CheckCircleOutlined, DeleteOutlined,
  WarningOutlined, BookOutlined, BankOutlined, EyeOutlined, DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPeriodoPlanilla, recalcularPeriodoPlanilla, actualizarDetallePlanilla,
  aprobarPeriodoPlanilla, eliminarPeriodoPlanilla,
  contabilizarPeriodoPlanilla, pagarPeriodoPlanilla, previsualizarAsientoPlanilla,
  type PeriodoPlanillaDetalle, type DetallePlanilla, type PreviewAsiento,
} from '../../../api/planillas-corrida'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'orange', APROBADA: 'green', CONTABILIZADA: 'blue', PAGADA: 'purple',
}

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
  const [modalPago, setModalPago] = useState(false)
  const [cuentas, setCuentas] = useState<BankAccount[]>([])
  const [formPago] = Form.useForm()
  const [preview, setPreview] = useState<PreviewAsiento | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const cargarPreview = () => {
    setPreviewLoading(true)
    previsualizarAsientoPlanilla(id!)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }

  const cargar = () => {
    setLoading(true)
    getPeriodoPlanilla(id!)
      .then(setPeriodo)
      .catch(() => message.error('Error cargando la corrida'))
      .finally(() => setLoading(false))
    cargarPreview()
  }

  useEffect(cargar, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const editable = periodo?.estado === 'BORRADOR'

  const commit = async (detalleId: string, campo: string, valor: number) => {
    try {
      setProcesando(true)
      const actualizado = await actualizarDetallePlanilla(detalleId, { [campo]: valor })
      setPeriodo(actualizado)
      cargarPreview()
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
      cargarPreview()
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

  const contabilizar = async () => {
    try {
      setProcesando(true)
      const r = await contabilizarPeriodoPlanilla(id!)
      message.success(`Asiento ${r.entryNumber} generado — planilla contabilizada`)
      cargar()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al contabilizar')
    } finally {
      setProcesando(false)
    }
  }

  const abrirModalPago = () => {
    getBankAccounts().then(r => setCuentas(Array.isArray(r) ? r : (r as any)?.data ?? []))
      .catch(() => message.error('Error cargando cuentas bancarias'))
    formPago.setFieldsValue({ fecha: dayjs() })
    setModalPago(true)
  }

  const descargarArchivoBanco = () => {
    if (!periodo) return
    const conBanco = periodo.detalles.filter(d => d.metodoPago === 'INSTITUCION_FINANCIERA')
    const filas = [
      ['CodigoBanco', 'Banco', 'NoCuenta', 'CodigoEmpleado', 'NombreEmpleado', 'Monto'],
      ...conBanco.map(d => [
        d.bancoCodigo ?? '', d.bancoNombre ?? '', d.numeroCuentaBancaria ?? '',
        d.empleadoCodigo, d.empleadoNombre, Number(d.netoAPagar).toFixed(2),
      ]),
    ]
    const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lote-pago-planilla-${periodo.anio}${String(periodo.mes).padStart(2, '0')}-Q${periodo.quincena}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pagar = async () => {
    try {
      const vals = await formPago.validateFields()
      setProcesando(true)
      const r = await pagarPeriodoPlanilla(id!, {
        bankAccountId: vals.bankAccountId,
        fecha: vals.fecha.format('YYYY-MM-DD'),
      })
      message.success(`Pago registrado — asiento ${r.entryNumber} por ${fmtQ(r.totalPago)}`)
      setModalPago(false)
      cargar()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error al registrar el pago')
    } finally {
      setProcesando(false)
    }
  }

  const esQuincena1 = periodo?.quincena === 1
  const diasEnMesActual = periodo ? dayjs(`${periodo.anio}-${String(periodo.mes).padStart(2, '0')}-01`).daysInMonth() : 30
  const maxDias = esQuincena1 ? 15 : diasEnMesActual - 15

  const columnasComunes: ColumnsType<DetallePlanilla> = [
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
      title: <Tooltip title={`Días trabajados en esta quincena (máx. ${maxDias})`}>Días</Tooltip>,
      key: 'diasTrabajados', width: 80, align: 'right',
      render: (_, d) => <CellNumber value={d.diasTrabajados} max={maxDias} precision={1} disabled={!editable}
        onCommit={v => commit(d.id, 'diasTrabajados', v)} />,
    },
  ]

  const columnasSoloQuincena2: ColumnsType<DetallePlanilla> = [
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
      title: <Tooltip title="Q250 de ley (Dto. 78-89), proporcional a días del mes completo — no paga IGSS">Bonif.</Tooltip>,
      dataIndex: 'bonificacionIncentivo', width: 85, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span>,
    },
  ]

  const columnasIntermedias: ColumnsType<DetallePlanilla> = [
    {
      title: 'Otros ing.', key: 'otrosIngresos', width: 100, align: 'right',
      render: (_, d) => <CellNumber value={d.otrosIngresos} disabled={!editable}
        onCommit={v => commit(d.id, 'otrosIngresos', v)} />,
    },
    {
      title: 'Devengado', dataIndex: 'totalDevengado', width: 110, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
  ]

  const columnasDeduccionesQuincena2: ColumnsType<DetallePlanilla> = [
    {
      title: <Tooltip title="4.83% sobre el mes completo (Q1+Q2) — sin bonificación">IGSS</Tooltip>,
      dataIndex: 'cuotaIGSSLaboral', width: 90, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span>,
    },
    {
      title: <Tooltip title="Retención mensual por proyección anual (Dto. 10-2012/13-2026), calculada sobre el mes completo">ISR</Tooltip>,
      dataIndex: 'isrRetenido', width: 90, align: 'right',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span>,
    },
    {
      title: 'Otras ded.', key: 'otrasDeducciones', width: 100, align: 'right',
      render: (_, d) => <CellNumber value={d.otrasDeducciones} disabled={!editable}
        onCommit={v => commit(d.id, 'otrasDeducciones', v)} />,
    },
  ]

  const columnasFinales: ColumnsType<DetallePlanilla> = [
    {
      title: 'Neto a pagar', dataIndex: 'netoAPagar', width: 120, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(v)}</Text>,
    },
    ...(esQuincena1 ? [] : [{
      title: <Tooltip title="IGSS 10.67% + INTECAP 1% + IRTRA 1% — gasto del patrono, sobre el mes completo">C. patronal</Tooltip>,
      key: 'patronal', width: 105, align: 'right' as const,
      render: (_: any, d: DetallePlanilla) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#8c8c8c' }}>
          {fmtQ(Number(d.cuotaPatronalIGSS) + Number(d.cuotaINTECAP) + Number(d.cuotaIRTRA))}
        </span>
      ),
    }]),
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

  const columns: ColumnsType<DetallePlanilla> = esQuincena1
    ? [...columnasComunes, ...columnasIntermedias, ...columnasFinales]
    : [...columnasComunes, ...columnasSoloQuincena2, ...columnasIntermedias, ...columnasDeduccionesQuincena2, ...columnasFinales]

  if (!periodo) return <Spin spinning={loading}><div style={{ height: 200 }} /></Spin>

  const advertenciasCount = periodo.detalles.filter(d => d.advertencias).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/planillas/corridas')} style={{ marginTop: 2 }} />
          <div>
            <Title level={4} style={{ margin: 0, color: NAVY }}>
              Planilla {MESES[periodo.mes - 1]} {periodo.anio} — {periodo.quincena === 1 ? '1ra' : '2da'} quincena
              <Tag color={ESTADO_COLOR[periodo.estado]} style={{ marginLeft: 10, fontSize: 11, verticalAlign: 'middle' }}>{periodo.estado}</Tag>
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(periodo.fechaInicio).format('DD/MM/YYYY')} — {dayjs(periodo.fechaFin).format('DD/MM/YYYY')} · {periodo.totalEmpleados} empleados
              {esQuincena1 ? ' · solo salario, sin deducciones' : ' · incluye IGSS/ISR/bonificación del mes completo'}
              {periodo.aprobadoAt && ` · aprobada ${dayjs(periodo.aprobadoAt).format('DD/MM/YYYY HH:mm')}${periodo.aprobadoPor ? ` por ${periodo.aprobadoPor}` : ''}`}
            </Text>
          </div>
        </Space>
        <Space wrap>
          {editable && (
            <>
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
            </>
          )}
          {periodo.estado === 'APROBADA' && (
            <Popconfirm
              title="¿Contabilizar la planilla?"
              description="Genera el asiento contable: gasto dimensionado por centro y pasivo agrupado por concepto."
              okText="Contabilizar" cancelText="Cancelar" onConfirm={contabilizar}>
              <Button type="primary" icon={<BookOutlined />} loading={procesando} style={{ background: NAVY }}>
                Contabilizar
              </Button>
            </Popconfirm>
          )}
          {periodo.estado === 'CONTABILIZADA' && (
            <Button type="primary" icon={<BankOutlined />} loading={procesando} onClick={abrirModalPago} style={{ background: NAVY }}>
              Registrar pago
            </Button>
          )}
        </Space>
      </div>

      {(periodo.asientoContableId || periodo.asientoPagoId) && (
        <Space direction="vertical" size={2} style={{ marginBottom: 16 }}>
          {periodo.asientoContableId && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <BookOutlined style={{ marginRight: 6 }} />
              Contabilizada {periodo.contabilizadoAt && dayjs(periodo.contabilizadoAt).format('DD/MM/YYYY HH:mm')}
              {periodo.contabilizadoPor ? ` por ${periodo.contabilizadoPor}` : ''} — ver en Libro Diario
            </Text>
          )}
          {periodo.asientoPagoId && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <BankOutlined style={{ marginRight: 6 }} />
              Pagada {periodo.pagadoAt && dayjs(periodo.pagadoAt).format('DD/MM/YYYY HH:mm')}
              {periodo.pagadoPor ? ` por ${periodo.pagadoPor}` : ''}
            </Text>
          )}
        </Space>
      )}

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

      <Card style={{ borderRadius: 8, marginBottom: 16 }} styles={{ body: { padding: 0 } }}
        title={<Space size={6}><EyeOutlined style={{ color: NAVY }} /><Text strong style={{ fontSize: 13 }}>Vista previa de la póliza contable</Text></Space>}
        extra={<Text type="secondary" style={{ fontSize: 11 }}>Así se registrará al contabilizar — valida antes de aprobar</Text>}>
        <Spin spinning={previewLoading}>
          {!preview || preview.lines.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Sin datos suficientes para previsualizar la póliza todavía.</Text>
            </div>
          ) : (
            <>
              {(preview.sinConfiguracionCuentas || preview.faltantes.length > 0) && (
                <Alert type="warning" showIcon style={{ margin: 12 }}
                  message={preview.sinConfiguracionCuentas
                    ? 'No hay cuentas contables de planilla configuradas.'
                    : `Faltan cuentas mapeadas: ${preview.faltantes.join(', ')}.`}
                  description="Ve a Planillas → Cuentas contables para completarlas — no se podrá contabilizar hasta entonces." />
              )}
              <Table
                size="small" rowKey={(_, i) => String(i)} pagination={false}
                dataSource={preview.lines}
                columns={[
                  { title: 'Cuenta', key: 'cuenta', width: 220, render: (_, l) => <Text style={{ fontSize: 12 }}><Text style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>{l.accountCode}</Text> {l.accountName}</Text> },
                  { title: 'Concepto', dataIndex: 'concepto', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                  { title: 'Centro', key: 'centro', width: 90, render: (_, l) => l.centroCostoId || l.centroBeneficioId ? <Tag style={{ fontSize: 10 }}>dimensionado</Tag> : null },
                  { title: 'Debe', dataIndex: 'debit', width: 110, align: 'right', render: (v: number) => v > 0 ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> : null },
                  { title: 'Haber', dataIndex: 'credit', width: 110, align: 'right', render: (v: number) => v > 0 ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> : null },
                ]}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={3}><Text strong style={{ fontSize: 12 }}>Total {preview.cuadra ? '— cuadra' : '— NO CUADRA'}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(preview.totalDebit)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(preview.totalCredit)}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </>
          )}
        </Spin>
      </Card>

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

      <Modal
        title="Registrar pago de planilla"
        open={modalPago} onCancel={() => setModalPago(false)}
        onOk={pagar} okText="Registrar pago" cancelText="Cancelar"
        confirmLoading={procesando}
        width={720}
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="Revierte el pasivo contra la cuenta bancaria."
          description={`Se generará un asiento que debita Sueldos/IGSS/ISR por pagar (el gasto ya se reconoció al contabilizar) y acredita la cuenta bancaria por el total: Q ${fmtQ(periodo.totalDevengado + periodo.totalCuotaPatronal)}.`} />
        <Form form={formPago} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="bankAccountId" label="Cuenta bancaria" rules={[{ required: true, message: 'Requerido' }]}>
              <Select
                placeholder="Seleccionar cuenta"
                options={cuentas.map(c => ({ value: c.id, label: `${c.bankName ?? c.name} — ${c.accountNumber ?? ''}` }))}
              />
            </Form.Item>
            <Form.Item name="fecha" label="Fecha de pago" rules={[{ required: true, message: 'Requerido' }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>Detalle del pago por empleado</Text>
          <Button size="small" icon={<DownloadOutlined />} onClick={descargarArchivoBanco}>
            Descargar archivo para banco
          </Button>
        </div>
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={periodo.detalles}
          columns={[
            { title: 'Empleado', key: 'empleado', render: (_, d) => <Text style={{ fontSize: 12 }}>{d.empleadoNombre}</Text> },
            {
              title: 'Banco / cuenta', key: 'banco',
              render: (_, d) => d.metodoPago === 'INSTITUCION_FINANCIERA'
                ? <Text style={{ fontSize: 12 }}>{d.bancoNombre} · {d.numeroCuentaBancaria ?? 'sin cuenta'}</Text>
                : <Tag style={{ fontSize: 10 }}>{d.metodoPago === 'CHEQUE' ? 'Cheque' : d.metodoPago === 'BILLETERA_ELECTRONICA' ? 'Billetera' : 'Otro'}</Tag>,
            },
            {
              title: 'Monto', dataIndex: 'netoAPagar', width: 110, align: 'right',
              render: (v: number) => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
            },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 11 }}>
          El archivo solo incluye empleados con método de pago "Institución financiera". Formato genérico
          (código de banco, cuenta, nombre y monto) — adaptar según el layout de carga masiva de tu banco.
        </Text>
      </Modal>
    </div>
  )
}
