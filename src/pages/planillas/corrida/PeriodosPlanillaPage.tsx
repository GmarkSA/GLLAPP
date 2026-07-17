import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Form, Modal, Select, Space, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, CalendarOutlined, BookOutlined, BankOutlined, FileTextOutlined, PrinterOutlined,
  SafetyCertificateOutlined, GiftOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPeriodosPlanilla, crearPeriodoPlanilla, crearCorridaEspecial, descargarArchivoIGSS, type PeriodoPlanilla,
} from '../../../api/planillas-corrida'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'orange', APROBADA: 'green', CONTABILIZADA: 'blue', PAGADA: 'purple',
}

export default function PeriodosPlanillaPage() {
  const navigate = useNavigate()
  const [periodos, setPeriodos] = useState<PeriodoPlanilla[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [creando, setCreando] = useState(false)
  const [form] = Form.useForm()

  const cargar = () => {
    setLoading(true)
    getPeriodosPlanilla()
      .then(setPeriodos)
      .catch(() => message.error('Error cargando períodos'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  // Combinaciones año/mes/quincena que ya tienen corrida — se muestran en
  // gris en el modal para que el usuario no las vuelva a correr. Solo
  // anulando la planilla (pago → planilla → póliza) vuelven a habilitarse.
  const anioSel = Form.useWatch('anio', form)
  const mesSel = Form.useWatch('mes', form)
  const tipoSel = Form.useWatch('tipo', form) ?? 'ORDINARIA'
  const esEspecial = tipoSel !== 'ORDINARIA'
  const yaCorrida = (anio: number, mes: number, quincena: number) =>
    periodos.some(p => p.anio === anio && p.mes === mes && p.quincena === quincena)
  const yaCorridaEspecial = (anio: number, tipo: string) =>
    periodos.some(p => p.anio === anio && p.tipo === tipo)

  const crear = async () => {
    try {
      const vals = await form.validateFields()
      setCreando(true)
      const periodo = vals.tipo !== 'ORDINARIA'
        ? await crearCorridaEspecial({ anio: vals.anio, tipo: vals.tipo })
        : await crearPeriodoPlanilla(vals)
      message.success(vals.tipo !== 'ORDINARIA'
        ? `Corrida de ${vals.tipo === 'BONO14' ? 'Bono 14' : 'Aguinaldo'} ${vals.anio} creada con ${periodo.totalEmpleados} empleados`
        : `Corrida ${MESES[vals.mes - 1]} ${vals.anio} — ${vals.quincena === 1 ? '1ra' : '2da'} quincena creada con ${periodo.totalEmpleados} empleados`)
      setModalOpen(false)
      navigate(`/planillas/corridas/${periodo.id}`)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Error creando la corrida')
    } finally {
      setCreando(false)
    }
  }

  const columns: ColumnsType<PeriodoPlanilla> = [
    {
      title: 'Período', key: 'periodo', width: 200,
      render: (_, p) => p.quincena === 0 ? (
        <div>
          <Text strong style={{ fontSize: 12, color: NAVY }}>{p.tipo === 'BONO14' ? 'Bono 14' : 'Aguinaldo'} {p.anio}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {p.tipo === 'BONO14' ? `jul/${p.anio - 1} → jun/${p.anio}` : `dic/${p.anio - 1} → nov/${p.anio}`} · corrida anual
          </div>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: 12, color: NAVY }}>{MESES[p.mes - 1]} {p.anio}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{p.quincena === 1 ? '1ra quincena (1-15)' : '2da quincena (16-fin)'}</div>
        </div>
      ),
      sorter: (a, b) => (a.anio * 10000 + a.mes * 10 + a.quincena) - (b.anio * 10000 + b.mes * 10 + b.quincena),
      defaultSortOrder: 'descend',
    },
    { title: 'Empleados', dataIndex: 'totalEmpleados', width: 100, align: 'center' },
    {
      title: 'Devengado', dataIndex: 'totalDevengado', width: 140, align: 'right',
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Deducciones', dataIndex: 'totalDeducciones', width: 130, align: 'right',
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Neto a pagar', dataIndex: 'totalNeto', width: 140, align: 'right',
      render: (v: number) => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Cuota patronal', dataIndex: 'totalCuotaPatronal', width: 130, align: 'right',
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Estado', key: 'estado', width: 105,
      render: (_, p) => (
        <Space direction="vertical" size={4}>
          <Tag color={ESTADO_COLOR[p.estado]} style={{ fontSize: 10, width: 'fit-content' }}>{p.estado}</Tag>
          <Space size={4}>
            {p.asientoContableId && (
              <Tooltip title="Póliza de planilla">
                <Button type="text" size="small" icon={<BookOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    navigate(`/contabilidad/diarios-manuales/${p.asientoContableId}`, { state: { volverA: '/planillas/corridas' } })
                  }} />
              </Tooltip>
            )}
            {p.asientoPagoId && (
              <Tooltip title="Póliza de pago">
                <Button type="text" size="small" icon={<BankOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    navigate(`/contabilidad/diarios-manuales/${p.asientoPagoId}`, { state: { volverA: '/planillas/corridas' } })
                  }} />
              </Tooltip>
            )}
            {p.quincena === 2 && (
              <Tooltip title="Detalle de planilla mensual">
                <Button type="text" size="small" icon={<FileTextOutlined />}
                  onClick={e => { e.stopPropagation(); navigate(`/planillas/mensual/${p.anio}/${p.mes}`) }} />
              </Tooltip>
            )}
            {p.quincena === 2 && (
              <Tooltip title="Imprimir boletas de pago (todos los empleados, media carta)">
                <Button type="text" size="small" icon={<PrinterOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    const url = `/planillas/mensual/${p.anio}/${p.mes}/imprimir-boletas?format=media-carta`
                    const win = window.open(url, '_blank', 'width=880,height=1020,menubar=no,toolbar=no,location=no,scrollbars=yes')
                    if (!win) message.warning('Permite ventanas emergentes en este sitio para poder imprimir.')
                  }} />
              </Tooltip>
            )}
            {p.quincena === 2 && (
              <Tooltip title="Descargar archivo de planilla electrónica IGSS (.txt)">
                <Button type="text" size="small" icon={<SafetyCertificateOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    descargarArchivoIGSS(p.anio, p.mes)
                      .catch((err: any) => message.error(err?.response?.data?.message || 'Error al generar el archivo IGSS'))
                  }} />
              </Tooltip>
            )}
          </Space>
        </Space>
      ),
    },
  ]

  const anioActual = dayjs().year()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>
            <CalendarOutlined style={{ marginRight: 8 }} />Corridas de planilla
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Quincenal (1-15 y 16-fin de mes) · BORRADOR editable → APROBADA congelada
          </Text>
        </div>
        <Space wrap>
          <Button icon={<GiftOutlined />}
            onClick={() => {
              form.setFieldsValue({ tipo: 'BONO14', anio: anioActual, mes: undefined, quincena: undefined })
              setModalOpen(true)
            }}>
            Planilla Bono 14
          </Button>
          <Button icon={<GiftOutlined />}
            onClick={() => {
              form.setFieldsValue({ tipo: 'AGUINALDO', anio: anioActual, mes: undefined, quincena: undefined })
              setModalOpen(true)
            }}>
            Planilla Aguinaldo
          </Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }}
            onClick={() => {
              const dia = dayjs().date()
              form.setFieldsValue({ tipo: 'ORDINARIA', anio: anioActual, mes: dayjs().month() + 1, quincena: dia <= 15 ? 1 : 2 })
              setModalOpen(true)
            }}>
            Generar planilla
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={loading}
          dataSource={periodos} columns={columns}
          pagination={false}
          onRow={p => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/planillas/corridas/${p.id}`),
          })}
          locale={{ emptyText: 'Sin corridas. Crea la primera con "Nueva corrida" — se genera una línea por cada empleado activo.' }}
        />
      </Card>

      <Modal
        title={tipoSel === 'BONO14' ? 'Planilla de Bono 14'
          : tipoSel === 'AGUINALDO' ? 'Planilla de Aguinaldo'
          : 'Generar planilla quincenal'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={crear} okText="Crear corrida" cancelText="Cancelar"
        confirmLoading={creando}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="tipo" hidden rules={[{ required: true }]}>
            <Select options={[
              { value: 'ORDINARIA' }, { value: 'BONO14' }, { value: 'AGUINALDO' },
            ]} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="anio" label="Año" rules={[{ required: true }]}>
              <Select options={[anioActual - 1, anioActual, anioActual + 1].map(y => {
                const corrida = esEspecial && yaCorridaEspecial(y, tipoSel)
                return { value: y, label: corrida ? `${y} — ya corrida` : y, disabled: corrida }
              })} />
            </Form.Item>
            {!esEspecial && (
              <Form.Item name="mes" label="Mes" rules={[{ required: !esEspecial }]}>
                <Select options={MESES.map((m, i) => {
                  const completo = !!anioSel && yaCorrida(anioSel, i + 1, 1) && yaCorrida(anioSel, i + 1, 2)
                  return { value: i + 1, label: completo ? `${m} — ya corrido` : m, disabled: completo }
                })} />
              </Form.Item>
            )}
            {!esEspecial && (
              <Form.Item name="quincena" label="Quincena" rules={[{ required: !esEspecial }]}>
                <Select options={[
                  { value: 1, label: '1ra (días 1-15)' },
                  { value: 2, label: '2da (16-fin de mes)' },
                ].map(o => {
                  const corrida = !!anioSel && !!mesSel && yaCorrida(anioSel, mesSel, o.value)
                  return { ...o, label: corrida ? `${o.label} — ya corrida` : o.label, disabled: corrida }
                })} />
              </Form.Item>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {esEspecial
              ? (tipoSel === 'BONO14'
                ? 'Calcula el Bono 14 de cada empleado (Dto. 42-92): salario × días trabajados del 1/jul al 30/jun ÷ 365, por tramo salarial. Exento de IGSS e ISR; el asiento liquida la provisión acumulada y solo postea el ajuste.'
                : 'Calcula el Aguinaldo de cada empleado (Dto. 76-78): salario × días trabajados del 1/dic al 30/nov ÷ 365, por tramo salarial. Exento de IGSS e ISR; el asiento liquida la provisión acumulada y solo postea el ajuste.')
              : '1ra quincena: paga la mitad del salario, sin deducciones. 2da quincena: paga la otra mitad + horas extra + bonificación incentivo completa, y ahí se descuentan IGSS, ISR y otras deducciones calculados sobre el mes completo.'}
          </Text>
        </Form>
      </Modal>
    </div>
  )
}
