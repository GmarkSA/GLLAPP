import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Space, Spin, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons'
import {
  getDetalleMensualPlanilla,
  type DetalleMensualPlanilla, type EmpleadoDetalleMensual, type NomenclaturaLinea,
} from '../../../api/planillas-corrida'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'
const fmtQ = (n: number) => Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'orange', APROBADA: 'green', CONTABILIZADA: 'blue', PAGADA: 'purple',
}

export default function DetalleMensualPlanillaPage() {
  const navigate = useNavigate()
  const { anio, mes } = useParams<{ anio: string; mes: string }>()
  const [data, setData] = useState<DetalleMensualPlanilla | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    getDetalleMensualPlanilla(Number(anio), Number(mes))
      .then(setData)
      .catch(e => setError(e?.response?.data?.message || 'Error cargando el detalle mensual'))
      .finally(() => setLoading(false))
  }, [anio, mes])

  const columnasEmpleado: ColumnsType<EmpleadoDetalleMensual> = [
    { title: 'Empleado', key: 'empleado', fixed: 'left', width: 190, render: (_, e) => (
      <div>
        <Text strong style={{ fontSize: 12, color: NAVY }}>{e.empleadoNombre}</Text>
        <div style={{ fontSize: 10, color: '#8c8c8c' }}>{e.empleadoCodigo}</div>
      </div>
    ) },
    { title: 'Días', dataIndex: 'dias', width: 70, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: 'Sueldo base', dataIndex: 'sueldoBase', width: 105, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> },
    { title: 'Bonif.', dataIndex: 'bonificacion', width: 85, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> },
    { title: 'Comisiones/Otros', dataIndex: 'comisiones', width: 110, align: 'right', render: v => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> : null },
    { title: 'Horas extra', dataIndex: 'montoHorasExtra', width: 95, align: 'right', render: v => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> : null },
    { title: 'IGSS patronal', dataIndex: 'igssPatronal', width: 105, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#8c8c8c' }}>{fmtQ(v)}</span> },
    { title: 'IGSS laboral', dataIndex: 'igssLaboral', width: 100, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span> },
    { title: 'ISR', dataIndex: 'isrEmpleados', width: 85, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span> },
    { title: 'Otras ded.', dataIndex: 'otrasDeducciones', width: 95, align: 'right', render: v => v ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</span> : null },
    { title: 'Devengado', dataIndex: 'totalDevengado', width: 110, align: 'right', render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
    { title: 'Neto a pagar', dataIndex: 'netoAPagar', width: 115, align: 'right', render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(v)}</Text> },
    {
      title: 'Estado', key: 'estado', width: 100,
      render: (_, e) => <Tag color={e.pagadoCompleto ? 'purple' : 'orange'} style={{ fontSize: 10 }}>{e.pagadoCompleto ? 'Pagado' : 'Pendiente'}</Tag>,
    },
  ]

  const columnasNomenclatura: ColumnsType<NomenclaturaLinea> = [
    { title: 'Cuenta', key: 'cuenta', width: 260, render: (_, l) => <Text style={{ fontSize: 12 }}><Text style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>{l.accountCode}</Text> {l.accountName}</Text> },
    { title: 'Centro', key: 'centro', render: (_, l) => (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {[l.centroCostoNombre, l.centroBeneficioNombre].filter(Boolean).join(' · ') || '—'}
      </Text>
    ) },
    { title: 'Debe', dataIndex: 'debit', width: 120, align: 'right', render: (v: number) => v > 0 ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> : null },
    { title: 'Haber', dataIndex: 'credit', width: 120, align: 'right', render: (v: number) => v > 0 ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</span> : null },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space align="start">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/planillas/corridas')} style={{ marginTop: 2 }} />
          <div>
            <Title level={4} style={{ margin: 0, color: NAVY }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              Detalle de Planilla Mensual — {MESES[Number(mes) - 1]} {anio}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Consolida la 1ra y 2da quincena por empleado, más la nomenclatura contable combinada
            </Text>
          </div>
        </Space>
        {data && (
          <Space>
            {data.quincena1 ? (
              <Tag color={ESTADO_COLOR[data.quincena1.estado]} style={{ fontSize: 10 }}>1ra quincena: {data.quincena1.estado}</Tag>
            ) : <Tag style={{ fontSize: 10 }}>1ra quincena: no creada</Tag>}
            {data.quincena2 ? (
              <Tag color={ESTADO_COLOR[data.quincena2.estado]} style={{ fontSize: 10 }}>2da quincena: {data.quincena2.estado}</Tag>
            ) : <Tag style={{ fontSize: 10 }}>2da quincena: no creada</Tag>}
          </Space>
        )}
      </div>

      {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Spin spinning={loading}>
        {data && (
          <>
            <Card style={{ borderRadius: 8, marginBottom: 16 }} styles={{ body: { padding: 0 } }}
              title={<Text strong style={{ fontSize: 13 }}>Detalle por empleado</Text>}>
              <Table
                size="small" rowKey="empleadoId" pagination={false} scroll={{ x: 'max-content' }}
                dataSource={data.empleados} columns={columnasEmpleado}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 12 }}>Total</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{data.totales.dias}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.sueldoBase)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.bonificacion)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.comisiones)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.montoHorasExtra)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.igssPatronal)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.igssLaboral)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.isrEmpleados)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={9} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.otrasDeducciones)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={10} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totales.totalDevengado)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={11} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>{fmtQ(data.totales.netoAPagar)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={12} />
                  </Table.Summary.Row>
                )}
              />
            </Card>

            <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}
              title={<Text strong style={{ fontSize: 13 }}>Nomenclatura contable (mes completo)</Text>}
              extra={<Text type="secondary" style={{ fontSize: 11 }}>Suma de las líneas de ambas quincenas, agrupadas por cuenta y centro</Text>}>
              <Table
                size="small" rowKey={(_, i) => String(i)} pagination={false}
                dataSource={data.nomenclatura} columns={columnasNomenclatura}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong style={{ fontSize: 12 }}>Total {data.cuadra ? '— cuadra' : '— NO CUADRA'}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totalDebit)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(data.totalCredit)}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}
