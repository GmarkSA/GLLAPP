import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select,
  Space, Spin, Statistic, Switch, Table, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CalculatorOutlined, SaveOutlined, BookOutlined, BankOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getEmpleado, nombreCompleto, type EmpleadoDetalle } from '../../../api/planillas-empleados'
import {
  calcularFiniquito, guardarFiniquito, getFiniquito, contabilizarFiniquito, pagarFiniquito,
  getSugerenciasUltimoPago,
  type CalculoFiniquito, type Finiquito, type MotivoBajaFiniquito, type DtoFiniquito,
} from '../../../api/planillas-finiquito'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'
import { getApiError } from '../../../api/axios'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MOTIVO_LABEL: Record<MotivoBajaFiniquito, string> = {
  RENUNCIA: 'Renuncia',
  DESPIDO_JUSTIFICADO: 'Despido justificado',
  DESPIDO_INJUSTIFICADO: 'Despido injustificado',
  MUTUO_ACUERDO: 'Mutuo acuerdo',
  OTRO: 'Otro',
}

const INDEMNIZACION_DEFAULT: Record<MotivoBajaFiniquito, boolean> = {
  DESPIDO_INJUSTIFICADO: true, RENUNCIA: false, DESPIDO_JUSTIFICADO: false, MUTUO_ACUERDO: false, OTRO: false,
}

const ESTADO_COLOR: Record<string, string> = { BORRADOR: 'orange', CONTABILIZADO: 'blue', PAGADO: 'purple' }

function FilaConcepto({ nombre, dias, monto, provisionAcumulada, ajuste }: {
  nombre: string; dias: number; monto: number; provisionAcumulada: number; ajuste: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
      <Text strong style={{ fontSize: 12 }}>{nombre}</Text>
      <Text style={{ fontSize: 12, textAlign: 'right', fontFamily: 'monospace' }}>{dias.toFixed(2)} días</Text>
      <Text style={{ fontSize: 12, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmtQ(monto)}</Text>
      <Text type="secondary" style={{ fontSize: 12, textAlign: 'right', fontFamily: 'monospace' }}>{fmtQ(provisionAcumulada)}</Text>
      <Text style={{ fontSize: 12, textAlign: 'right', fontFamily: 'monospace', color: ajuste === 0 ? '#8c8c8c' : ajuste > 0 ? '#d46b08' : '#1677ff' }}>
        {ajuste === 0 ? '—' : `${ajuste > 0 ? '+' : ''}${fmtQ(ajuste)}`}
      </Text>
    </div>
  )
}

export default function FiniquitoPage() {
  const navigate = useNavigate()
  const { empleadoId, id } = useParams<{ empleadoId?: string; id?: string }>()
  const esNuevo = !!empleadoId

  const [empleado, setEmpleado] = useState<EmpleadoDetalle | null>(null)
  const [finiquito, setFiniquito] = useState<Finiquito | null>(null)
  const [calculo, setCalculo] = useState<CalculoFiniquito | null>(null)
  const [loading, setLoading] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [cuentas, setCuentas] = useState<BankAccount[]>([])
  const [form] = Form.useForm()
  const [formPago] = Form.useForm()

  useEffect(() => {
    if (esNuevo && empleadoId) {
      setLoading(true)
      Promise.all([
        getEmpleado(empleadoId),
        // Si ya hubo corrida anual de Bono 14/Aguinaldo (contabilizada o
        // pagada) donde participó el empleado, el "último pago" se toma en
        // automático del fin de su ventana legal (30/jun o 30/nov). Si no,
        // se asume que nunca se le ha pagado: desde su fecha de ingreso.
        getSugerenciasUltimoPago(empleadoId).catch(() => ({ fechaUltimoPagoBono14: null, fechaUltimoPagoAguinaldo: null })),
      ]).then(([e, sug]) => {
        setEmpleado(e)
        const fechaInicioLaboral = e.fechaAntiguedad || e.fechaAlta
        form.setFieldsValue({
          fechaBaja: dayjs(), motivoBaja: 'RENUNCIA', aplicaIndemnizacion: false, otrasDeducciones: 0,
          fechaUltimoPagoBono14: sug.fechaUltimoPagoBono14
            ? dayjs(sug.fechaUltimoPagoBono14)
            : dayjs(fechaInicioLaboral).subtract(1, 'day'),
          fechaUltimoPagoAguinaldo: sug.fechaUltimoPagoAguinaldo
            ? dayjs(sug.fechaUltimoPagoAguinaldo)
            : dayjs(fechaInicioLaboral).subtract(1, 'day'),
        })
        if (sug.fechaUltimoPagoBono14 || sug.fechaUltimoPagoAguinaldo) {
          message.info('Fechas de último pago tomadas de las corridas anuales ya registradas', 4)
        }
      })
        .catch(() => message.error('Error cargando empleado'))
        .finally(() => setLoading(false))
    } else if (id) {
      cargarFiniquito()
    }
  }, [empleadoId, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarFiniquito = () => {
    if (!id) return
    setLoading(true)
    getFiniquito(id)
      .then(setFiniquito)
      .catch(() => message.error('Error cargando el finiquito'))
      .finally(() => setLoading(false))
  }

  const fechaInicioLaboral = empleado?.fechaAntiguedad || empleado?.fechaAlta || null

  const dtoDesdeForm = (): DtoFiniquito => {
    const vals = form.getFieldsValue()
    return {
      fechaBaja: vals.fechaBaja.format('YYYY-MM-DD'),
      motivoBaja: vals.motivoBaja,
      aplicaIndemnizacion: vals.aplicaIndemnizacion,
      fechaUltimoPagoBono14: vals.fechaUltimoPagoBono14.format('YYYY-MM-DD'),
      fechaUltimoPagoAguinaldo: vals.fechaUltimoPagoAguinaldo.format('YYYY-MM-DD'),
      otrasDeducciones: vals.otrasDeducciones,
      otrasDeduccionesDescripcion: vals.otrasDeduccionesDescripcion,
    }
  }

  const calcular = async () => {
    try {
      const vals = await form.validateFields()
      void vals
      setCalculando(true)
      const resultado = await calcularFiniquito(empleadoId!, dtoDesdeForm())
      setCalculo(resultado)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(getApiError(e, 'Error al calcular el finiquito'))
    } finally {
      setCalculando(false)
    }
  }

  const guardar = async () => {
    try {
      setGuardando(true)
      const nuevo = await guardarFiniquito(empleadoId!, dtoDesdeForm())
      message.success('Finiquito guardado como borrador')
      navigate(`/planillas/finiquitos/${nuevo.id}`, { replace: true })
    } catch (e: any) {
      message.error(getApiError(e, 'Error al guardar el finiquito'))
    } finally {
      setGuardando(false)
    }
  }

  const contabilizar = async () => {
    try {
      setProcesando(true)
      const r = await contabilizarFiniquito(id!)
      message.success(`Ajuste contabilizado — asiento ${r.entryNumber}`)
      cargarFiniquito()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al contabilizar'))
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

  const pagar = async () => {
    try {
      const vals = await formPago.validateFields()
      setProcesando(true)
      const r = await pagarFiniquito(id!, { bankAccountId: vals.bankAccountId, fecha: vals.fecha.format('YYYY-MM-DD') })
      message.success(`Pago registrado — asiento ${r.entryNumber} por ${fmtQ(r.totalPago)}`)
      setModalPago(false)
      cargarFiniquito()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(getApiError(e, 'Error al registrar el pago'))
    } finally {
      setProcesando(false)
    }
  }

  if (loading) return <Spin spinning><div style={{ height: 200 }} /></Spin>

  // ── Vista de finiquito existente ──────────────────────────────────────────
  if (!esNuevo && finiquito) {
    return (
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <Space align="start">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/planillas/finiquitos')} style={{ marginTop: 2 }} />
            <div>
              <Title level={4} style={{ margin: 0, color: NAVY }}>
                Finiquito — {finiquito.empleadoNombre}
                <Tag color={ESTADO_COLOR[finiquito.estado]} style={{ marginLeft: 10, fontSize: 11, verticalAlign: 'middle' }}>{finiquito.estado}</Tag>
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {MOTIVO_LABEL[finiquito.motivoBaja]} · Baja: {dayjs(finiquito.fechaBaja).format('DD/MM/YYYY')}
              </Text>
            </div>
          </Space>
          <Space>
            {finiquito.estado === 'BORRADOR' && (
              <Button type="primary" icon={<BookOutlined />} loading={procesando} onClick={contabilizar} style={{ background: NAVY }}>
                Contabilizar
              </Button>
            )}
            {finiquito.estado === 'CONTABILIZADO' && (
              <Button type="primary" icon={<BankOutlined />} loading={procesando} onClick={abrirModalPago} style={{ background: NAVY }}>
                Registrar pago
              </Button>
            )}
          </Space>
        </div>

        <Card style={{ borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr', gap: 8, paddingBottom: 8, borderBottom: '2px solid #1B3A6B' }}>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c' }}>CONCEPTO</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>DÍAS</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>MONTO LEGAL</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>PROVISIÓN ACUM.</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>AJUSTE</Text>
          </div>
          <FilaConcepto nombre="Indemnización" dias={Number(finiquito.diasIndemnizacion)} monto={Number(finiquito.montoIndemnizacion)} provisionAcumulada={Number(finiquito.provisionAcumuladaIndemnizacion)} ajuste={r2(Number(finiquito.montoIndemnizacion) - Number(finiquito.provisionAcumuladaIndemnizacion))} />
          <FilaConcepto nombre="Vacaciones" dias={Number(finiquito.diasVacacionesPendientes)} monto={Number(finiquito.montoVacaciones)} provisionAcumulada={Number(finiquito.provisionAcumuladaVacaciones)} ajuste={r2(Number(finiquito.montoVacaciones) - Number(finiquito.provisionAcumuladaVacaciones))} />
          <FilaConcepto nombre="Bono 14" dias={Number(finiquito.diasBono14)} monto={Number(finiquito.montoBono14)} provisionAcumulada={Number(finiquito.provisionAcumuladaBono14)} ajuste={r2(Number(finiquito.montoBono14) - Number(finiquito.provisionAcumuladaBono14))} />
          <FilaConcepto nombre="Aguinaldo" dias={Number(finiquito.diasAguinaldo)} monto={Number(finiquito.montoAguinaldo)} provisionAcumulada={Number(finiquito.provisionAcumuladaAguinaldo)} ajuste={r2(Number(finiquito.montoAguinaldo) - Number(finiquito.provisionAcumuladaAguinaldo))} />

          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }} direction="vertical" align="end" size={2}>
            <Text style={{ fontSize: 12 }}>Total legal: <Text strong style={{ fontFamily: 'monospace' }}>{fmtQ(finiquito.totalLegal)}</Text></Text>
            {Number(finiquito.otrasDeducciones) > 0 && (
              <Text style={{ fontSize: 12 }}>Otras deducciones: <Text style={{ fontFamily: 'monospace', color: '#cf1322' }}>− {fmtQ(finiquito.otrasDeducciones)}</Text></Text>
            )}
            <Text style={{ fontSize: 14 }}>Neto a pagar: <Text strong style={{ fontFamily: 'monospace', color: '#389e0d', fontSize: 16 }}>{fmtQ(finiquito.netoAPagar)}</Text></Text>
          </Space>
        </Card>

        {(finiquito.asientoContableId || finiquito.asientoPagoId) && (
          <Space direction="vertical" size={2}>
            {finiquito.asientoContableId && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <BookOutlined style={{ marginRight: 6 }} />
                Contabilizado {finiquito.contabilizadoAt && dayjs(finiquito.contabilizadoAt).format('DD/MM/YYYY HH:mm')} —{' '}
                <a onClick={() => navigate(`/contabilidad/diarios-manuales/${finiquito.asientoContableId}`, { state: { volverA: `/planillas/finiquitos/${finiquito.id}` } })}>ver póliza</a>
              </Text>
            )}
            {finiquito.asientoPagoId && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <BankOutlined style={{ marginRight: 6 }} />
                Pagado {finiquito.pagadoAt && dayjs(finiquito.pagadoAt).format('DD/MM/YYYY HH:mm')} —{' '}
                <a onClick={() => navigate(`/contabilidad/diarios-manuales/${finiquito.asientoPagoId}`, { state: { volverA: `/planillas/finiquitos/${finiquito.id}` } })}>ver póliza de pago</a>
              </Text>
            )}
          </Space>
        )}

        <Modal
          title="Registrar pago de finiquito"
          open={modalPago} onCancel={() => setModalPago(false)}
          onOk={pagar} okText="Registrar pago" cancelText="Cancelar" confirmLoading={procesando}
        >
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`Se pagará Q ${fmtQ(finiquito.netoAPagar)} y el empleado quedará marcado como BAJA.`} />
          <Form form={formPago} layout="vertical" size="small">
            <Form.Item name="bankAccountId" label="Cuenta bancaria" rules={[{ required: true, message: 'Requerido' }]}>
              <Select placeholder="Seleccionar cuenta" options={cuentas.map(c => ({ value: c.id, label: `${c.bankName ?? c.name} — ${c.accountNumber ?? ''}` }))} />
            </Form.Item>
            <Form.Item name="fecha" label="Fecha de pago" rules={[{ required: true, message: 'Requerido' }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    )
  }

  // ── Nuevo finiquito ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/planillas/empleados/${empleadoId}`)} style={{ marginTop: 2 }} />
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>
            Finiquito — {empleado ? nombreCompleto(empleado) : ''}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Código {empleado?.codigo} · Indemnización, vacaciones, Bono 14 y aguinaldo proporcionales</Text>
        </div>
      </div>

      <Card size="small" title={<Text strong>Datos de la baja</Text>} style={{ borderRadius: 8, marginBottom: 16 }}
        extra={fechaInicioLaboral && <Text type="secondary" style={{ fontSize: 12 }}>Ingresó: <Text strong>{dayjs(fechaInicioLaboral).format('DD/MM/YYYY')}</Text></Text>}>
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="motivoBaja" label="Motivo de baja" rules={[{ required: true, message: 'Requerido' }]}>
              <Select
                options={Object.entries(MOTIVO_LABEL).map(([value, label]) => ({ value, label }))}
                onChange={(v: MotivoBajaFiniquito) => form.setFieldValue('aplicaIndemnizacion', INDEMNIZACION_DEFAULT[v])}
              />
            </Form.Item>
            <Form.Item name="fechaBaja" label="Fecha de baja" rules={[{ required: true, message: 'Requerido' }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
                disabledDate={d => !!fechaInicioLaboral && d.isBefore(dayjs(fechaInicioLaboral), 'day')} />
            </Form.Item>
            <Form.Item name="aplicaIndemnizacion" label="¿Aplica indemnización?" valuePropName="checked"
              tooltip="Por ley solo el despido injustificado da derecho a indemnización — pero puedes activarlo igual si la empresa decide pagarla (ej. mutuo acuerdo)">
              <Switch />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="fechaUltimoPagoBono14" label="Último pago de Bono 14" rules={[{ required: true, message: 'Requerido' }]}
              tooltip="Fecha hasta la cual ya se pagó Bono 14 — desde el día siguiente se calcula lo proporcional. Si nunca se le ha pagado, deja el día anterior a su ingreso (valor por defecto).">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
                disabledDate={d => !!fechaInicioLaboral && d.isBefore(dayjs(fechaInicioLaboral).subtract(1, 'day'), 'day')} />
            </Form.Item>
            <Form.Item name="fechaUltimoPagoAguinaldo" label="Último pago de aguinaldo" rules={[{ required: true, message: 'Requerido' }]}
              tooltip="Fecha hasta la cual ya se pagó aguinaldo — desde el día siguiente se calcula lo proporcional (normalmente 30 de noviembre del último año pagado). Si nunca se le ha pagado, deja el día anterior a su ingreso (valor por defecto).">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
                disabledDate={d => !!fechaInicioLaboral && d.isBefore(dayjs(fechaInicioLaboral).subtract(1, 'day'), 'day')} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 12px' }}>
            <Form.Item name="otrasDeducciones" label="Otras deducciones (Q)">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
            <Form.Item name="otrasDeduccionesDescripcion" label="Descripción">
              <Input placeholder="Ej. préstamo pendiente" />
            </Form.Item>
          </div>
          <Button icon={<CalculatorOutlined />} loading={calculando} onClick={calcular} block style={{ marginTop: 4 }}>
            Calcular finiquito
          </Button>
        </Form>
      </Card>

      {calculo && (
        <Card style={{ borderRadius: 8, marginBottom: 16 }}
          title={<Text strong style={{ fontSize: 13 }}>Resultado del cálculo</Text>}
          extra={<Text type="secondary" style={{ fontSize: 11 }}>Ajuste = monto legal − provisión ya acumulada mes a mes</Text>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr', gap: 8, paddingBottom: 8, borderBottom: '2px solid #1B3A6B' }}>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c' }}>CONCEPTO</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>DÍAS</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>MONTO LEGAL</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>PROVISIÓN ACUM.</Text>
            <Text strong style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'right' }}>AJUSTE</Text>
          </div>
          {calculo.aplicaIndemnizacion && (
            <FilaConcepto nombre="Indemnización" {...calculo.indemnizacion} />
          )}
          <FilaConcepto nombre={`Vacaciones${calculo.vacaciones.topeAplicado ? ' (tope 2 períodos)' : ''}`} {...calculo.vacaciones} />
          <FilaConcepto nombre="Bono 14" {...calculo.bono14} />
          <FilaConcepto nombre="Aguinaldo" {...calculo.aguinaldo} />

          <div style={{ marginTop: 16 }}>
            <Statistic title="Total legal" value={calculo.totalLegal} precision={2} prefix="Q"
              valueStyle={{ fontSize: 16, fontFamily: 'monospace' }} formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })} />
          </div>
          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 8 }} direction="vertical" align="end" size={2}>
            <Text style={{ fontSize: 14 }}>Neto a pagar: <Text strong style={{ fontFamily: 'monospace', color: '#389e0d', fontSize: 18 }}>{fmtQ(calculo.netoAPagar)}</Text></Text>
          </Space>

          <Button type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardar} block style={{ marginTop: 16, background: NAVY }}>
            Guardar finiquito
          </Button>
        </Card>
      )}
    </div>
  )
}

const r2 = (n: number) => Math.round(n * 100) / 100
