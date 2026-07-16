import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Space, Spin, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons'
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

  /** Encabezado corto con tooltip del nombre completo — para que la tabla quepa sin scroll horizontal */
  const th = (corto: string, completo: string) => (
    <Tooltip title={completo}><span>{corto}</span></Tooltip>
  )

  const fmtCell = (v: number, color?: string, strong?: boolean) => v !== 0
    ? <Text strong={strong} style={{ fontFamily: 'monospace', fontSize: 11, color }}>{fmtQ(v)}</Text>
    : <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11 }}>—</Text>

  const columnasEmpleado: ColumnsType<EmpleadoDetalleMensual> = [
    { title: 'Empleado', key: 'empleado', fixed: 'left', width: 130, render: (_, e) => (
      <div>
        <Text strong style={{ fontSize: 11, color: NAVY }}>{e.empleadoNombre}</Text>
        <div style={{ fontSize: 10, color: '#8c8c8c' }}>{e.empleadoCodigo}</div>
      </div>
    ) },
    { title: th('Días', 'Días trabajados en el mes'), dataIndex: 'dias', width: 45, align: 'right', render: v => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span> },
    { title: th('Sueldo', 'Sueldo base devengado'), dataIndex: 'sueldoBase', width: 78, align: 'right', render: v => fmtCell(v) },
    { title: th('Bonif.', 'Bonificación incentivo (Dto. 78-89)'), dataIndex: 'bonificacion', width: 60, align: 'right', render: v => fmtCell(v) },
    { title: th('Comis.', 'Comisiones y otros ingresos'), dataIndex: 'comisiones', width: 65, align: 'right', render: v => fmtCell(v) },
    { title: th('H.Extra', 'Monto de horas extra'), dataIndex: 'montoHorasExtra', width: 65, align: 'right', render: v => fmtCell(v) },
    { title: th('IGSS-P', 'Cuota patronal IGSS + INTECAP + IRTRA'), dataIndex: 'igssPatronal', width: 65, align: 'right', render: v => fmtCell(v, '#8c8c8c') },
    { title: th('IGSS-L', 'Cuota laboral IGSS (retenida al empleado)'), dataIndex: 'igssLaboral', width: 65, align: 'right', render: v => fmtCell(v, '#cf1322') },
    { title: th('ISR', 'Retención ISR'), dataIndex: 'isrEmpleados', width: 60, align: 'right', render: v => fmtCell(v, '#cf1322') },
    { title: th('Otras', 'Otras deducciones (anticipos, etc.)'), dataIndex: 'otrasDeducciones', width: 60, align: 'right', render: v => fmtCell(v, '#cf1322') },
    { title: th('P.Agui', 'Provisión mensual de aguinaldo (salario ÷ 12) — contabilizada en la póliza de la 2da quincena'), dataIndex: 'provisionAguinaldo', width: 62, align: 'right', render: v => fmtCell(v, '#8c8c8c') },
    { title: th('P.B14', 'Provisión mensual de Bono 14 (salario ÷ 12) — contabilizada en la póliza de la 2da quincena'), dataIndex: 'provisionBono14', width: 60, align: 'right', render: v => fmtCell(v, '#8c8c8c') },
    { title: th('P.Vac', 'Provisión mensual de vacaciones (15 días÷12 meses) — contabilizada en la póliza de la 2da quincena'), dataIndex: 'provisionVacaciones', width: 60, align: 'right', render: v => fmtCell(v, '#8c8c8c') },
    { title: th('P.Ind', 'Provisión mensual de indemnización (salario ÷ 12) — contabilizada en la póliza de la 2da quincena'), dataIndex: 'provisionIndemnizacion', width: 60, align: 'right', render: v => fmtCell(v, '#8c8c8c') },
    { title: th('Deveng.', 'Total devengado del mes'), dataIndex: 'totalDevengado', width: 78, align: 'right', render: v => fmtCell(v, undefined, true) },
    { title: th('Neto', 'Neto a pagar del mes'), dataIndex: 'netoAPagar', width: 82, align: 'right', render: v => fmtCell(v, '#389e0d', true) },
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
            <Alert type="info" showIcon icon={<InfoCircleOutlined />} style={{ marginBottom: 16 }}
              message="Las columnas P.Agui, P.B14, P.Vac y P.Ind son la provisión mensual de prestaciones (salario ÷ 12; vacaciones 15 días÷12 meses) — se contabilizan automáticamente en la póliza de la 2da quincena (gasto dimensionado por centro + pasivo por pagar). El pago real de estos conceptos se libera con el aguinaldo/bono14 anual o al finiquito." />
            <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
              <Tabs
                defaultActiveKey="empleados"
                style={{ padding: '0 16px' }}
                items={[
                  {
                    key: 'empleados',
                    label: 'Detalle de empleados',
                    children: (
                      <Table
                        size="small" rowKey="empleadoId" pagination={false}
                        dataSource={data.empleados} columns={columnasEmpleado}
                        summary={() => {
                          const cell = (v: number, color?: string) => (
                            <Table.Summary.Cell index={0} align="right">
                              <Text strong style={{ fontFamily: 'monospace', fontSize: 11, color }}>{fmtQ(v)}</Text>
                            </Table.Summary.Cell>
                          )
                          return (
                            <Table.Summary.Row style={{ background: '#fafafa' }}>
                              <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 11 }}>Total</Text></Table.Summary.Cell>
                              <Table.Summary.Cell index={0} align="right"><Text strong style={{ fontFamily: 'monospace', fontSize: 11 }}>{data.totales.dias}</Text></Table.Summary.Cell>
                              {cell(data.totales.sueldoBase)}
                              {cell(data.totales.bonificacion)}
                              {cell(data.totales.comisiones)}
                              {cell(data.totales.montoHorasExtra)}
                              {cell(data.totales.igssPatronal, '#8c8c8c')}
                              {cell(data.totales.igssLaboral, '#cf1322')}
                              {cell(data.totales.isrEmpleados, '#cf1322')}
                              {cell(data.totales.otrasDeducciones, '#cf1322')}
                              {cell(data.totales.provisionAguinaldo, '#8c8c8c')}
                              {cell(data.totales.provisionBono14, '#8c8c8c')}
                              {cell(data.totales.provisionVacaciones, '#8c8c8c')}
                              {cell(data.totales.provisionIndemnizacion, '#8c8c8c')}
                              {cell(data.totales.totalDevengado)}
                              {cell(data.totales.netoAPagar, '#389e0d')}
                            </Table.Summary.Row>
                          )
                        }}
                      />
                    ),
                  },
                  {
                    key: 'poliza',
                    label: 'Póliza',
                    children: (
                      <div style={{ maxWidth: 700 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                          Nomenclatura contable del mes completo — suma de las líneas de ambas quincenas, agrupadas por cuenta y centro
                        </Text>
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
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}
