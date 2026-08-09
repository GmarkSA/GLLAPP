import { useState, useEffect } from 'react'
import {
  Card, Row, Col, Select, Button, Space, Tag, Typography, Divider, Table,
  Statistic, Alert, Tooltip, message, Spin, Badge,
} from 'antd'
import {
  CalculatorOutlined, FileProtectOutlined, CheckCircleOutlined,
  InfoCircleOutlined, DollarOutlined, FileDoneOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  type DeclaracionIva, type DeclaracionIvaStatus,
  getDeclaracionesIva, generarBorradorIva,
  generarPolizaBorradorIva, marcarIvaPresentada,
} from '../../api/reportes'

const { Title, Text } = Typography
const { Option } = Select

const Q = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_TAG: Record<DeclaracionIvaStatus, { color: string; label: string }> = {
  borrador:        { color: 'default',  label: 'Borrador' },
  poliza_generada: { color: 'blue',     label: 'Póliza Borrador' },
  presentada:      { color: 'green',    label: 'Presentada' },
}

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
]

export default function DeclaracionIvaPage() {
  const now = dayjs()
  const [mes,  setMes]  = useState<number>(now.month() + 1)
  const [anio, setAnio] = useState<number>(now.year())
  const [decl, setDecl] = useState<DeclaracionIva | null>(null)
  const [lista, setLista] = useState<DeclaracionIva[]>([])
  const [loading, setLoading]   = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)

  useEffect(() => {
    getDeclaracionesIva()
      .then(d => {
        setLista(d)
        // Preselect current month if exists
        const found = d.find(x => x.mes === mes && x.anio === anio)
        if (found) setDecl(found)
      })
      .catch(() => {})
  }, [])

  const handleCalcular = async () => {
    setCalcLoading(true)
    try {
      const result = await generarBorradorIva(mes, anio)
      setDecl(result)
      setLista(prev => {
        const idx = prev.findIndex(x => x.id === result.id)
        return idx >= 0 ? prev.map((x, i) => i === idx ? result : x) : [result, ...prev]
      })
      message.success('Borrador calculado correctamente')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Error al calcular'
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setCalcLoading(false)
    }
  }

  const handlePoliza = async () => {
    if (!decl) return
    setLoading(true)
    try {
      const result = await generarPolizaBorradorIva(decl.id)
      setDecl(result)
      setLista(prev => prev.map(x => x.id === result.id ? result : x))
      message.success('Póliza borrador generada — puede revisarla en el módulo de Contabilidad')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Error al generar póliza'
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const handlePresentada = async () => {
    if (!decl) return
    setLoading(true)
    try {
      const result = await marcarIvaPresentada(decl.id)
      setDecl(result)
      setLista(prev => prev.map(x => x.id === result.id ? result : x))
      message.success('Declaración marcada como presentada')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Error'
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHistorial = (record: DeclaracionIva) => {
    setMes(record.mes)
    setAnio(record.anio)
    setDecl(record)
  }

  const neto      = decl ? Number(decl.ivaNeto) : 0
  const isCredito = neto < 0
  const ivaAPagar = Math.max(0, neto)
  const creditoAcumulado = Math.abs(Math.min(0, neto))

  const anioOptions = Array.from({ length: 5 }, (_, i) => now.year() - i)

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 0 }}>Declaración IVA — SAT Formulario 2237</Title>
      <Text type="secondary">Cierre mensual · Regularización crédito / débito fiscal</Text>

      <Divider />

      {/* Selector período */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Período:</Text>
          <Select value={mes} onChange={setMes} style={{ width: 140 }}>
            {MESES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
          </Select>
          <Select value={anio} onChange={setAnio} style={{ width: 90 }}>
            {anioOptions.map(y => <Option key={y} value={y}>{y}</Option>)}
          </Select>
          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            loading={calcLoading}
            onClick={handleCalcular}
            style={{ background: '#1B3A6B' }}
          >
            Calcular
          </Button>
          {decl && (
            <Tag color={STATUS_TAG[decl.status].color} style={{ fontSize: 13, padding: '2px 10px' }}>
              {STATUS_TAG[decl.status].label}
            </Tag>
          )}
        </Space>
      </Card>

      {decl ? (
        <Spin spinning={loading}>
          {/* KPI row */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={<><DollarOutlined /> Débito Fiscal (Ventas)</>}
                  value={Number(decl.ivaDebitoFiscal)}
                  precision={2}
                  prefix="Q"
                  valueStyle={{ color: '#1B3A6B', fontSize: 18 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Base: {Q(Number(decl.baseVentas))}
                </Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={<><DollarOutlined /> Crédito Fiscal (Compras)</>}
                  value={Number(decl.ivaCreditoFiscal)}
                  precision={2}
                  prefix="Q"
                  valueStyle={{ color: '#059669', fontSize: 18 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Base: {Q(Number(decl.baseCompras))}
                </Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={<><InfoCircleOutlined /> Retenciones IVA</>}
                  value={Number(decl.retencionIva)}
                  precision={2}
                  prefix="Q"
                  valueStyle={{ color: '#d97706', fontSize: 18 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>Retenido por clientes</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: isCredito ? '#ecfdf5' : '#fef3c7' }}>
                <Statistic
                  title={isCredito ? 'Crédito Acumulado' : 'IVA por Pagar'}
                  value={isCredito ? creditoAcumulado : ivaAPagar}
                  precision={2}
                  prefix="Q"
                  valueStyle={{ color: isCredito ? '#059669' : '#dc2626', fontSize: 18, fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {isCredito ? 'Se traslada al siguiente período' : 'A pagar al SAT'}
                </Text>
              </Card>
            </Col>
          </Row>

          {/* SAT 2237 layout */}
          <Card
            size="small"
            title="Formulario SAT-2237 — Vista Previa"
            style={{ marginBottom: 16, fontFamily: 'monospace' }}
          >
            <Row gutter={[0, 4]}>
              <Col span={24}>
                <Text strong style={{ color: '#1B3A6B' }}>
                  Período: {MESES.find(m => m.value === decl.mes)?.label} {decl.anio}
                </Text>
              </Col>
              <Col span={24}><Divider style={{ margin: '8px 0' }} /></Col>

              {/* Sección 3 — Débito Fiscal */}
              <Col span={14}><Text>Sección 3 — Débito Fiscal (Ventas)</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong>{Q(Number(decl.ivaDebitoFiscal))}</Text>
              </Col>
              <Col span={14}><Text type="secondary" style={{ paddingLeft: 16, fontSize: 12 }}>Base imponible ventas</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{Q(Number(decl.baseVentas))}</Text>
              </Col>

              <Col span={24}><Divider style={{ margin: '8px 0' }} /></Col>

              {/* Sección 5 — Crédito Fiscal */}
              <Col span={14}><Text>Sección 5 — Crédito Fiscal (Compras)</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong>{Q(Number(decl.ivaCreditoFiscal))}</Text>
              </Col>
              <Col span={14}><Text type="secondary" style={{ paddingLeft: 16, fontSize: 12 }}>Base imponible compras</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{Q(Number(decl.baseCompras))}</Text>
              </Col>
              {Number(decl.retencionIva) > 0 && (
                <>
                  <Col span={14}><Text type="secondary" style={{ paddingLeft: 16, fontSize: 12 }}>Retenciones IVA</Text></Col>
                  <Col span={10} style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{Q(Number(decl.retencionIva))}</Text>
                  </Col>
                </>
              )}

              <Col span={24}><Divider style={{ margin: '8px 0' }} /></Col>

              {/* Sección 7 — Determinación */}
              <Col span={14}><Text strong>Sección 7 — Determinación</Text></Col>
              <Col span={10}></Col>
              <Col span={14}><Text style={{ paddingLeft: 16 }}>Débito Fiscal</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}><Text>{Q(Number(decl.ivaDebitoFiscal))}</Text></Col>
              <Col span={14}><Text style={{ paddingLeft: 16 }}>(-) Crédito Fiscal</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}><Text>({Q(Number(decl.ivaCreditoFiscal))})</Text></Col>
              <Col span={14}>
                <Text strong style={{ color: isCredito ? '#059669' : '#dc2626' }}>
                  {isCredito ? 'Crédito Acumulado' : 'IVA a Pagar'}
                </Text>
              </Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong style={{ fontSize: 16, color: isCredito ? '#059669' : '#dc2626' }}>
                  {Q(isCredito ? creditoAcumulado : ivaAPagar)}
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Cuentas contables afectadas */}
          <Card size="small" title="Póliza de Regularización (Cuentas)" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              pagination={false}
              dataSource={[
                {
                  key: '216001',
                  cuenta: '216001 — IVA por Pagar',
                  tipo: 'Pasivo',
                  debe: isCredito ? 0 : Math.min(Number(decl.ivaDebitoFiscal), Number(decl.ivaCreditoFiscal)),
                  haber: isCredito ? Math.min(Number(decl.ivaDebitoFiscal), Number(decl.ivaCreditoFiscal)) : 0,
                },
                {
                  key: '125001',
                  cuenta: '125001 — Crédito Fiscal IVA',
                  tipo: 'Activo',
                  debe: isCredito ? Math.min(Number(decl.ivaDebitoFiscal), Number(decl.ivaCreditoFiscal)) : 0,
                  haber: isCredito ? 0 : Math.min(Number(decl.ivaDebitoFiscal), Number(decl.ivaCreditoFiscal)),
                },
              ]}
              columns={[
                { title: 'Cuenta', dataIndex: 'cuenta', key: 'cuenta' },
                { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 80 },
                { title: 'Débito', dataIndex: 'debe', key: 'debe', width: 140, align: 'right', render: v => Q(v) },
                { title: 'Crédito', dataIndex: 'haber', key: 'haber', width: 140, align: 'right', render: v => Q(v) },
              ]}
            />
            {decl.status !== 'presentada' && (
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="info"
                  showIcon
                  message="La póliza se genera en estado BORRADOR — revísela en Contabilidad antes de contabilizarla."
                />
              </div>
            )}
            {decl.polizaId && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Póliza ID: <code>{decl.polizaId}</code>
                </Text>
              </div>
            )}
          </Card>

          {/* Acciones */}
          <Space>
            {decl.status !== 'presentada' && (
              <Button
                type="primary"
                icon={<FileDoneOutlined />}
                onClick={handlePoliza}
                disabled={false}
                style={{ background: '#1B3A6B' }}
              >
                {decl.status === 'poliza_generada' ? 'Regenerar Póliza Borrador' : 'Generar Póliza Borrador'}
              </Button>
            )}
            {decl.status === 'poliza_generada' && (
              <Button
                icon={<CheckCircleOutlined />}
                onClick={handlePresentada}
                style={{ borderColor: '#059669', color: '#059669' }}
              >
                Marcar como Presentada
              </Button>
            )}
            <Tooltip title="Recalcular tomando datos actualizados del libro de ventas y compras">
              <Button icon={<CalculatorOutlined />} onClick={handleCalcular} loading={calcLoading}>
                Recalcular
              </Button>
            </Tooltip>
          </Space>
        </Spin>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <FileProtectOutlined style={{ fontSize: 48, color: '#d1d5db' }} />
          <div style={{ marginTop: 12, color: '#6b7280' }}>
            Selecciona el período y presiona <strong>Calcular</strong> para generar el borrador de declaración IVA.
          </div>
        </Card>
      )}

      {/* Historial */}
      {lista.length > 0 && (
        <Card size="small" title="Historial de Declaraciones" style={{ marginTop: 24 }}>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={lista}
            onRow={record => ({ onClick: () => handleSelectHistorial(record), style: { cursor: 'pointer' } })}
            columns={[
              {
                title: 'Período', key: 'periodo', width: 130,
                render: (_, r) => `${MESES.find(m => m.value === r.mes)?.label} ${r.anio}`,
              },
              {
                title: 'Estado', dataIndex: 'status', key: 'status', width: 140,
                render: v => <Tag color={STATUS_TAG[v as DeclaracionIvaStatus]?.color}>{STATUS_TAG[v as DeclaracionIvaStatus]?.label}</Tag>,
              },
              {
                title: 'Débito Fiscal', dataIndex: 'ivaDebitoFiscal', key: 'debito', align: 'right',
                render: v => Q(Number(v)),
              },
              {
                title: 'Crédito Fiscal', dataIndex: 'ivaCreditoFiscal', key: 'credito', align: 'right',
                render: v => Q(Number(v)),
              },
              {
                title: 'IVA Neto', dataIndex: 'ivaNeto', key: 'neto', align: 'right',
                render: v => {
                  const n = Number(v)
                  return <Text strong style={{ color: n < 0 ? '#059669' : '#dc2626' }}>{Q(Math.abs(n))}</Text>
                },
              },
              {
                title: 'Póliza', dataIndex: 'polizaId', key: 'poliza', width: 80, align: 'center',
                render: v => v ? <Badge status="success" text="Sí" /> : <Badge status="default" text="No" />,
              },
              {
                title: 'Calculado', dataIndex: 'updatedAt', key: 'fecha', width: 110,
                render: v => dayjs(v).format('DD/MM/YYYY'),
              },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
