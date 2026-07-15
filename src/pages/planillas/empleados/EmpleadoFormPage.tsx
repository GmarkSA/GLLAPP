import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, Collapse, DatePicker, Form, Input, InputNumber, Modal,
  Popconfirm, Select, Space, Spin, Table, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, DollarOutlined, UserDeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import SelectorDimensionesAnaliticas from '../../../components/SelectorDimensionesAnaliticas'
import {
  getEmpleado, crearEmpleado, actualizarEmpleado, cambiarSalario, darDeBajaEmpleado,
  nombreCompleto, type EmpleadoDetalle, type ContratoLaboral,
} from '../../../api/planillas-empleados'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MOTIVO_LABEL: Record<string, string> = {
  ALTA: 'Alta', AUMENTO: 'Aumento', AJUSTE: 'Ajuste', CAMBIO_PUESTO: 'Cambio de puesto', OTRO: 'Otro',
}

export default function EmpleadoFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const esNuevo = !id || id === 'nuevo'
  const [form] = Form.useForm()
  const [salarioForm] = Form.useForm()
  const [empleado, setEmpleado] = useState<EmpleadoDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalSalario, setModalSalario] = useState(false)

  const cargar = () => {
    if (esNuevo) return
    setLoading(true)
    getEmpleado(id!)
      .then(e => {
        setEmpleado(e)
        form.setFieldsValue({
          ...e,
          fechaAlta: e.fechaAlta ? dayjs(e.fechaAlta) : null,
          fechaNacimiento: e.fechaNacimiento ? dayjs(e.fechaNacimiento) : null,
          fechaAntiguedad: e.fechaAntiguedad ? dayjs(e.fechaAntiguedad) : null,
          dimensiones: { centroCostoId: e.centroCostoId, centroBeneficioId: e.centroBeneficioId },
        })
      })
      .catch(() => message.error('Error cargando empleado'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      const dto: any = {
        ...vals,
        fechaAlta: vals.fechaAlta?.format('YYYY-MM-DD'),
        fechaNacimiento: vals.fechaNacimiento?.format('YYYY-MM-DD') ?? null,
        fechaAntiguedad: vals.fechaAntiguedad?.format('YYYY-MM-DD') ?? null,
        centroCostoId: vals.dimensiones?.centroCostoId ?? null,
        centroBeneficioId: vals.dimensiones?.centroBeneficioId ?? null,
      }
      delete dto.dimensiones

      if (esNuevo) {
        const creado = await crearEmpleado(dto)
        if (creado.advertenciaSalarioMinimo) {
          Modal.warning({ title: 'Advertencia de salario mínimo', content: creado.advertenciaSalarioMinimo })
        }
        message.success('Empleado creado')
        navigate(`/planillas/empleados/${creado.id}`, { replace: true })
      } else {
        delete dto.salarioInicial
        await actualizarEmpleado(id!, dto)
        message.success('Empleado actualizado')
        cargar()
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const aplicarCambioSalario = async () => {
    try {
      const vals = await salarioForm.validateFields()
      const r = await cambiarSalario(id!, {
        salarioOrdinarioMensual: vals.salarioOrdinarioMensual,
        fechaInicio: vals.fechaInicio.format('YYYY-MM-DD'),
        motivoCambio: vals.motivoCambio,
        notas: vals.notas,
      })
      if (r.advertenciaSalarioMinimo) {
        Modal.warning({ title: 'Advertencia de salario mínimo', content: r.advertenciaSalarioMinimo })
      }
      message.success('Salario actualizado — vigencia anterior cerrada')
      setModalSalario(false)
      salarioForm.resetFields()
      cargar()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error al cambiar salario')
    }
  }

  const baja = async () => {
    try {
      await darDeBajaEmpleado(id!, dayjs().format('YYYY-MM-DD'))
      message.success('Empleado dado de baja. El finiquito con prestaciones se calculará desde el módulo de Finiquitos (próxima fase).')
      cargar()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al dar de baja')
    }
  }

  const historialColumns = [
    { title: 'Vigencia desde', dataIndex: 'fechaInicio', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Hasta', dataIndex: 'fechaFin', width: 120,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : <Tag color="green" style={{ fontSize: 10 }}>vigente</Tag>,
    },
    {
      title: 'Salario mensual', dataIndex: 'salarioOrdinarioMensual', width: 140, align: 'right' as const,
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    { title: 'Motivo', dataIndex: 'motivoCambio', width: 130, render: (v: string) => MOTIVO_LABEL[v] ?? v },
    { title: 'Notas', dataIndex: 'notas', render: (v: string | null) => <Text style={{ fontSize: 12 }}>{v ?? ''}</Text> },
  ]

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/planillas/empleados')} style={{ marginTop: 2 }} />
          <div>
            <Title level={4} style={{ margin: 0, color: NAVY }}>
              {esNuevo ? 'Nuevo empleado' : empleado ? nombreCompleto(empleado) : 'Empleado'}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {esNuevo
                ? 'Alta con salario inicial y saldos de adopción'
                : `Código ${empleado?.codigo ?? ''} · ${empleado?.estado ?? ''}`}
            </Text>
          </div>
        </Space>
        <Space wrap>
          {!esNuevo && empleado?.estado === 'ACTIVO' && (
            <>
              <Button icon={<DollarOutlined />} onClick={() => setModalSalario(true)}>Cambiar salario</Button>
              <Popconfirm
                title="¿Dar de baja al empleado?"
                description="Cambia el estado a BAJA con fecha de hoy. El finiquito se calcula en el módulo de Finiquitos."
                okText="Dar de baja" cancelText="Cancelar" onConfirm={baja}>
                <Button danger icon={<UserDeleteOutlined />}>Dar de baja</Button>
              </Popconfirm>
            </>
          )}
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={guardar} style={{ background: NAVY }}>
            {esNuevo ? 'Crear empleado' : 'Guardar cambios'}
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" size="small" labelWrap
          initialValues={{
            tipoActividadEconomica: 'NO_AGRICOLA',
            circunscripcionEconomica: 'CE1',
            tipoJornada: 'DIURNA',
            tipoContrato: 'TIEMPO_COMPLETO',
            ingresosAcumuladosInicial: 0,
            isrRetenidoInicial: 0,
            igssLaboralInicial: 0,
            vacacionesDiasPendientesInicial: 0,
          }}>

          <Card size="small" title={<Text strong>Identificación</Text>} style={{ borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 12px' }}>
              <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="EMP-001" />
              </Form.Item>
              <Form.Item name="primerNombre" label="Primer nombre" rules={[{ required: true, message: 'Requerido' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="segundoNombre" label="Segundo nombre">
                <Input />
              </Form.Item>
              <Form.Item name="fechaNacimiento" label="Fecha de nacimiento">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="primerApellido" label="Primer apellido" rules={[{ required: true, message: 'Requerido' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="segundoApellido" label="Segundo apellido">
                <Input />
              </Form.Item>
              <Form.Item name="apellidoCasada" label="Apellido de casada"
                tooltip="El archivo IGSS lo pide como campo separado">
                <Input />
              </Form.Item>
              <Form.Item name="dpi" label="DPI">
                <Input />
              </Form.Item>
              <Form.Item name="nit" label="NIT">
                <Input />
              </Form.Item>
              <Form.Item name="telefono" label="Teléfono">
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Correo electrónico" rules={[{ type: 'email', message: 'Correo inválido' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="direccion" label="Dirección">
                <Input />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" title={<Text strong>Datos laborales</Text>} style={{ borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 12px' }}>
              <Form.Item name="puesto" label="Puesto">
                <Input />
              </Form.Item>
              <Form.Item name="tipoJornada" label="Tipo de jornada"
                tooltip="Arts. 116-117 CT — Diurna 8h/día, Nocturna 6h, Mixta 7h. Define el divisor del valor-hora.">
                <Select options={[
                  { value: 'DIURNA', label: 'Diurna (06:00–18:00)' },
                  { value: 'NOCTURNA', label: 'Nocturna (18:00–06:00)' },
                  { value: 'MIXTA', label: 'Mixta' },
                ]} />
              </Form.Item>
              <Form.Item name="tipoContrato" label="Tipo de contrato">
                <Select options={[
                  { value: 'TIEMPO_COMPLETO', label: 'Tiempo completo' },
                  { value: 'TIEMPO_PARCIAL', label: 'Tiempo parcial' },
                ]} />
              </Form.Item>
              <Form.Item name="fechaAlta" label="Fecha de alta" rules={[{ required: true, message: 'Requerido' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="tipoActividadEconomica" label="Actividad económica"
                tooltip="Determina el salario mínimo aplicable (AG 256-2025)">
                <Select options={[
                  { value: 'NO_AGRICOLA', label: 'No agrícola' },
                  { value: 'AGRICOLA', label: 'Agrícola' },
                  { value: 'EXPORTACION_MAQUILA', label: 'Exportación / maquila' },
                ]} />
              </Form.Item>
              <Form.Item name="circunscripcionEconomica" label="Circunscripción"
                tooltip="CE1 = Departamento de Guatemala · CE2 = resto del país">
                <Select options={[
                  { value: 'CE1', label: 'CE1 — Depto. Guatemala' },
                  { value: 'CE2', label: 'CE2 — Resto del país' },
                ]} />
              </Form.Item>
              <Form.Item name="numeroAfiliadoIGSS" label="No. afiliado IGSS">
                <Input />
              </Form.Item>
              <Form.Item name="codigoOcupacionIGSS" label="Código ocupación IGSS">
                <Input />
              </Form.Item>
            </div>
            {esNuevo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 12px', borderTop: '1px dashed #d9d9d9', paddingTop: 12 }}>
                <Form.Item name="salarioInicial" label="Salario ordinario mensual (Q)"
                  tooltip="Crea la primera vigencia del historial salarial. Los cambios posteriores se hacen con 'Cambiar salario' para no perder trazabilidad."
                  rules={[{ required: true, message: 'Requerido' }]}>
                  <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
                </Form.Item>
              </div>
            )}
          </Card>

          <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}
            title={<Text strong>Dimensiones analíticas por defecto</Text>}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Se heredan en cada corrida de planilla; se pueden sobreescribir por período</Text>}>
            <Form.Item name="dimensiones" noStyle>
              <SelectorDimensionesAnaliticas layout="form" size="small" />
            </Form.Item>
          </Card>

          <Collapse
            style={{ marginBottom: 16 }}
            items={[{
              key: 'saldos',
              label: <Text strong style={{ fontSize: 13 }}>Saldos iniciales — adopción del módulo a mitad de año</Text>,
              children: (
                <>
                  <Alert type="info" showIcon style={{ marginBottom: 12 }}
                    message="Solo si el empleado ya trabajaba antes de usar este módulo."
                    description="Estos acumulados permiten que la proyección de ISR, las vacaciones y la antigüedad para prestaciones sean correctas desde la primera planilla." />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 12px' }}>
                    <Form.Item name="fechaAntiguedad" label="Fecha real de inicio laboral"
                      tooltip="Si es anterior al alta en el sistema. Base para antigüedad de indemnización y vacaciones.">
                      <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                    <Form.Item name="saldosInicialesAnio" label="Año de los acumulados">
                      <InputNumber style={{ width: '100%' }} min={2020} max={2100} precision={0} placeholder={String(dayjs().year())} />
                    </Form.Item>
                    <Form.Item name="vacacionesDiasPendientesInicial" label="Días de vacaciones pendientes">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                    </Form.Item>
                    <Form.Item name="ingresosAcumuladosInicial" label="Ingresos gravados acumulados (Q)"
                      tooltip="Lo ya pagado en el año fiscal antes de la primera planilla en el sistema — insumo de la proyección de ISR.">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                    </Form.Item>
                    <Form.Item name="isrRetenidoInicial" label="ISR ya retenido (Q)">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                    </Form.Item>
                    <Form.Item name="igssLaboralInicial" label="IGSS laboral ya pagado (Q)"
                      tooltip="Deducible de la renta imponible en la proyección de ISR.">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                    </Form.Item>
                  </div>
                </>
              ),
            }]}
          />

          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        {!esNuevo && empleado && (
          <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}
            title={<Text strong>Historial salarial</Text>}
            extra={
              empleado.salarioVigente != null && (
                <Text style={{ fontSize: 12 }}>
                  Vigente: <Text strong style={{ fontFamily: 'monospace' }}>{fmtQ(empleado.salarioVigente)}</Text>
                </Text>
              )
            }>
            <Table
              size="small" rowKey="id" pagination={false}
              dataSource={empleado.historialSalarios} columns={historialColumns}
            />
          </Card>
        )}
      </Spin>

      <Modal
        title="Cambiar salario"
        open={modalSalario}
        onCancel={() => setModalSalario(false)}
        onOk={aplicarCambioSalario}
        okText="Aplicar cambio" cancelText="Cancelar"
        destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="La vigencia actual se cierra el día anterior y se abre una nueva."
          description="El historial completo se conserva para calcular aguinaldo y Bono 14 proporcionales con el salario correcto de cada mes." />
        <Form form={salarioForm} layout="vertical" size="small"
          initialValues={{ motivoCambio: 'AUMENTO', fechaInicio: dayjs() }}>
          <Form.Item name="salarioOrdinarioMensual" label="Nuevo salario ordinario mensual (Q)"
            rules={[{ required: true, message: 'Requerido' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="fechaInicio" label="Vigente desde" rules={[{ required: true, message: 'Requerido' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="motivoCambio" label="Motivo">
            <Select options={Object.entries(MOTIVO_LABEL).filter(([k]) => k !== 'ALTA')
              .map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
