import { useEffect, useState } from 'react'
import {
  Alert, Button, Card, Form, InputNumber, Input, Select, Space, Spin, Switch,
  Table, Tag, Typography, message,
} from 'antd'
import { SaveOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getParametroFiscal, guardarParametroFiscal, type ParametroFiscalAnual,
  getSalariosMinimos, seedSalariosMinimos2026, type SalarioMinimoVigente,
} from '../../../api/planillas'

const { Text, Title } = Typography

const NAVY = '#1B3A6B'
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const ACTIVIDAD_LABEL: Record<string, string> = {
  NO_AGRICOLA: 'No agrícola',
  AGRICOLA: 'Agrícola',
  EXPORTACION_MAQUILA: 'Exportación / maquila',
}

export default function ParametrosFiscalesPage() {
  const currentYear = dayjs().year()
  const [anio, setAnio] = useState(currentYear)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existe, setExiste] = useState(false)
  const [salarios, setSalarios] = useState<SalarioMinimoVigente[]>([])
  const [seeding, setSeeding] = useState(false)

  const cargar = () => {
    setLoading(true)
    Promise.all([getParametroFiscal(anio), getSalariosMinimos(anio)])
      .then(([p, s]) => {
        setExiste(!!p)
        setSalarios(s)
        form.setFieldsValue(p ?? {
          deduccionISRFija: 48000,
          deduccionISRExtraordinaria: anio === 2026 ? 3024 : 0,
          usaDeduccionDinamica: anio >= 2027,
          tramoISRUnoLimite: 300000,
          tramoISRUnoTasa: 5,
          tramoISRDosMontoFijo: 15000,
          tramoISRDosTasaExcedente: 7,
          tasaIGSSLaboral: 4.83,
          tasaIGSSPatronal: 10.67,
          tasaINTECAP: 1,
          tasaIRTRA: 1,
          montoBonificacionIncentivo: 250,
          aguinaldoPeriodoInicio: '12-01',
          aguinaldoPeriodoFin: '11-30',
          bono14PeriodoInicio: '07-01',
          bono14PeriodoFin: '06-30',
          horasSemanalesDiurna: 44,
          limiteHorasExtraDia: 4,
        })
      })
      .catch(() => message.error('Error cargando parámetros'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [anio]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      await guardarParametroFiscal(anio, vals)
      message.success(`Parámetros ${anio} guardados`)
      setExiste(true)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const seed = async () => {
    setSeeding(true)
    try {
      const r = await seedSalariosMinimos2026()
      message.success(`Salarios mínimos 2026: ${r.creados} registros creados`)
      setSalarios(await getSalariosMinimos(anio))
    } catch {
      message.error('Error sembrando salarios mínimos')
    } finally {
      setSeeding(false)
    }
  }

  const numItem = (name: string, label: string, opts?: { suffix?: string; precision?: number }) => (
    <Form.Item name={name} label={label} rules={[{ required: true, message: 'Requerido' }]}>
      <InputNumber
        style={{ width: '100%' }} min={0}
        precision={opts?.precision ?? 2}
        addonAfter={opts?.suffix}
      />
    </Form.Item>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>Parámetros fiscales y laborales</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ISR (Dto. 10-2012 / 13-2026) · IGSS · Bonificación incentivo (Dto. 78-89) · Jornadas (CT Arts. 116-124)
          </Text>
        </div>
        <Space>
          <Select
            value={anio} onChange={setAnio} style={{ width: 160 }}
            options={Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)
              .map(y => ({ value: y, label: `Año fiscal ${y}` }))}
          />
          {existe
            ? <Tag color="green">año configurado</Tag>
            : <Tag color="orange">sin configurar — se muestran valores de ley</Tag>}
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={guardar}
            style={{ background: NAVY }}>
            Guardar {anio}
          </Button>
        </Space>
      </div>

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Los valores legales son parámetros por año fiscal, nunca constantes."
        description="Cuando cambie la ley (nueva deducción ISR, nuevo salario mínimo), se crea o edita el año correspondiente sin tocar código. La edición de un año se bloqueará cuando ese año tenga planillas aprobadas."
      />

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

            <Card size="small" title={<Text strong>ISR sobre salarios</Text>} style={{ borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                {numItem('deduccionISRFija', 'Deducción fija anual (Q)')}
                {numItem('deduccionISRExtraordinaria', 'Deducción extraordinaria (Q)')}
                {numItem('tramoISRUnoLimite', 'Límite tramo 1 (Q)')}
                {numItem('tramoISRUnoTasa', 'Tasa tramo 1', { suffix: '%' })}
                {numItem('tramoISRDosMontoFijo', 'Monto fijo tramo 2 (Q)')}
                {numItem('tramoISRDosTasaExcedente', 'Tasa excedente tramo 2', { suffix: '%' })}
              </div>
              <Form.Item name="usaDeduccionDinamica" label="Deducción dinámica (12 × salario mínimo no agrícola más alto + bonificación) — rige desde 2027" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Card>

            <Card size="small" title={<Text strong>IGSS y bonificación incentivo</Text>} style={{ borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                {numItem('tasaIGSSLaboral', 'Cuota laboral', { suffix: '%' })}
                {numItem('tasaIGSSPatronal', 'Cuota patronal IGSS', { suffix: '%' })}
                {numItem('tasaINTECAP', 'INTECAP', { suffix: '%' })}
                {numItem('tasaIRTRA', 'IRTRA', { suffix: '%' })}
                {numItem('montoBonificacionIncentivo', 'Bonificación incentivo (Q/mes)')}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                La bonificación incentivo no paga IGSS ni entra a la base de aguinaldo, Bono 14 o indemnización; sí paga ISR.
              </Text>
            </Card>

            <Card size="small" title={<Text strong>Períodos de prestaciones</Text>} style={{ borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="aguinaldoPeriodoInicio" label="Aguinaldo — inicio (MM-DD)" rules={[{ required: true, pattern: /^\d{2}-\d{2}$/, message: 'Formato MM-DD' }]}>
                  <Input placeholder="12-01" />
                </Form.Item>
                <Form.Item name="aguinaldoPeriodoFin" label="Aguinaldo — fin (MM-DD)" rules={[{ required: true, pattern: /^\d{2}-\d{2}$/, message: 'Formato MM-DD' }]}>
                  <Input placeholder="11-30" />
                </Form.Item>
                <Form.Item name="bono14PeriodoInicio" label="Bono 14 — inicio (MM-DD)" rules={[{ required: true, pattern: /^\d{2}-\d{2}$/, message: 'Formato MM-DD' }]}>
                  <Input placeholder="07-01" />
                </Form.Item>
                <Form.Item name="bono14PeriodoFin" label="Bono 14 — fin (MM-DD)" rules={[{ required: true, pattern: /^\d{2}-\d{2}$/, message: 'Formato MM-DD' }]}>
                  <Input placeholder="06-30" />
                </Form.Item>
              </div>
            </Card>

            <Card size="small" title={<Text strong>Jornadas y horas extra</Text>} style={{ borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                {numItem('horasSemanalesDiurna', 'Horas semanales jornada diurna', { precision: 1 })}
                {numItem('limiteHorasExtraDia', 'Límite horas extra por día', { precision: 1 })}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Art. 116 CT: jornada diurna de 44 horas efectivas semanales (equivalen a 48 para pago). Art. 124: jornada total máxima 12h/día.
              </Text>
            </Card>
          </div>
        </Form>

        <Card
          size="small" style={{ borderRadius: 8, marginTop: 16 }}
          title={<Text strong>Salarios mínimos {anio} — Acuerdo Gubernativo 256-2025</Text>}
          extra={anio === 2026 && (
            <Button size="small" icon={<DownloadOutlined />} loading={seeding} onClick={seed}>
              Cargar valores oficiales 2026
            </Button>
          )}
          styles={{ body: { padding: 0 } }}
        >
          {salarios.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Text type="secondary">
                No hay salarios mínimos cargados para {anio}.
                {anio === 2026 ? ' Usa "Cargar valores oficiales 2026".' : ''}
              </Text>
            </div>
          ) : (
            <Table
              size="small" rowKey="id" pagination={false} dataSource={salarios}
              columns={[
                { title: 'Actividad económica', dataIndex: 'tipoActividadEconomica', render: (v: string) => ACTIVIDAD_LABEL[v] ?? v },
                { title: 'Circunscripción', dataIndex: 'circunscripcionEconomica', width: 190, render: (v: string) => v === 'CE1' ? 'CE1 — Depto. Guatemala' : 'CE2 — Resto del país' },
                { title: 'Diario', dataIndex: 'montoDiario', width: 130, align: 'right', render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
                { title: 'Mensual', dataIndex: 'montoMensual', width: 140, align: 'right', render: (v: number) => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
              ]}
            />
          )}
        </Card>
      </Spin>
    </div>
  )
}
