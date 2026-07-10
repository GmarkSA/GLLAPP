import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Button, Form, Input, DatePicker, Select, Typography, Divider,
  Table, InputNumber, Space, Tag, message, Checkbox, Radio,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  createAsientoRecurrente, getAsientoRecurrente, updateAsientoRecurrente,
  type AsientoRecurrente, type LineaPlantilla,
} from '../../../api/asientos-recurrentes'
import { type AsientoDetalle } from '../../../api/asientos'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title } = Typography

interface LineState {
  key:         string
  accountId:   string
  accountCode: string
  accountName: string
  description: string
  debit:       number | null
  credit:      number | null
}

const emptyLine = (): LineState => ({
  key:         Math.random().toString(36).slice(2),
  accountId:   '', accountCode: '', accountName: '',
  description: '', debit: null, credit: null,
})

const toLineState = (l: LineaPlantilla): LineState => ({
  key:         Math.random().toString(36).slice(2),
  accountId:   l.accountId ?? '',
  accountCode: l.accountCode,
  accountName: l.accountName,
  description: l.description ?? '',
  debit:       Number(l.debit)  || null,
  credit:      Number(l.credit) || null,
})

function AccountSelect({
  value, accounts, onChange,
}: {
  value: string; accounts: Account[]
  onChange: (id: string, code: string, name: string) => void
}) {
  return (
    <Select
      size="small" showSearch value={value || undefined}
      placeholder="Seleccione una cuenta"
      optionFilterProp="label" style={{ width: '100%' }}
      options={accounts
        .filter(a => !a.isHeader && a.isActive)
        .map(a => ({ label: `${a.code} - ${a.name}`, value: a.id, code: a.code, acname: a.name }))}
      onChange={(_: string, opt: any) => onChange(_, opt.code, opt.acname)}
    />
  )
}

export default function DiarioRecurrenteFormPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const location   = useLocation()
  const desdeDiario = (location.state as any)?.desdeDiario as AsientoDetalle | undefined
  const isNew      = !id || id === 'nueva'

  const [form]      = Form.useForm()
  const [plantilla, setPlantilla]  = useState<AsientoRecurrente | null>(null)
  const [lines,     setLines]      = useState<LineState[]>([emptyLine(), emptyLine()])
  const [accounts,  setAccounts]   = useState<Account[]>([])
  const [saving,    setSaving]     = useState(false)
  const [nuncaVence, setNuncaVence] = useState(true)

  const totalDebit  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  const diferencia  = totalDebit - totalCredit

  const loadAccounts = useCallback(async () => {
    try {
      const all = await getAccounts({ activas: true })
      setAccounts(Array.isArray(all) ? all : [])
    } catch { setAccounts([]) }
  }, [])

  const loadPlantilla = useCallback(async () => {
    if (isNew || !id) return
    try {
      const p = await getAsientoRecurrente(id)
      setPlantilla(p)
      const nv = p.nuncaVence !== false
      setNuncaVence(nv)
      form.setFieldsValue({
        nombre:       p.nombre,
        descripcion:  p.descripcion,
        referencia:   p.referencia,
        frecuencia:   p.frecuencia,
        diaEjecucion: p.diaEjecucion,
        fechaInicio:  p.fechaInicio ? dayjs(p.fechaInicio) : null,
        fechaFin:     p.fechaFin    ? dayjs(p.fechaFin)    : null,
        nuncaVence:   nv,
        autoPublicar: p.autoPublicar,
      })
      setLines(p.lineas.map(toLineState))
    } catch { message.error('Error al cargar la plantilla') }
  }, [id, isNew, form])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  useEffect(() => {
    if (desdeDiario) {
      // Pre-llenar desde un asiento manual existente
      form.setFieldsValue({
        nombre:      `Recurrente: ${desdeDiario.description}`,
        descripcion: desdeDiario.description,
        referencia:  desdeDiario.reference,
        frecuencia:  'MENSUAL',
        diaEjecucion: 1,
        fechaInicio:  dayjs(),
        nuncaVence:   true,
        autoPublicar: false,
      })
      setNuncaVence(true)
      setLines(desdeDiario.lines.map(l => ({
        key:         Math.random().toString(36).slice(2),
        accountId:   l.accountId ?? '',
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description ?? '',
        debit:       Number(l.debit)  || null,
        credit:      Number(l.credit) || null,
      })))
    } else {
      loadPlantilla()
    }
  }, [desdeDiario, loadPlantilla, form])

  const updateLine = (key: string, field: keyof LineState, value: any) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))

  const setLineAccount = (key: string, id: string, code: string, name: string) =>
    setLines(prev => prev.map(l => l.key === key
      ? { ...l, accountId: id, accountCode: code, accountName: name }
      : l
    ))

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (key: string) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter(l => l.key !== key))
  }

  const handleSave = async () => {
    try { await form.validateFields() } catch { return }

    const validLines = lines.filter(l => l.accountCode || l.accountId)
    if (validLines.length < 1) {
      message.warning('La plantilla debe tener al menos una línea con cuenta asignada')
      return
    }
    if (Math.abs(diferencia) > 0.01) {
      message.warning(`Las líneas no cuadran — diferencia: Q ${Math.abs(diferencia).toFixed(2)}`)
      return
    }

    const vals = form.getFieldsValue()
    const dto = {
      nombre:       vals.nombre,
      descripcion:  vals.descripcion || undefined,
      referencia:   vals.referencia  || undefined,
      frecuencia:   vals.frecuencia,
      diaEjecucion: vals.diaEjecucion ?? 1,
      fechaInicio:  vals.fechaInicio?.format('YYYY-MM-DD'),
      fechaFin:     nuncaVence ? undefined : vals.fechaFin?.format('YYYY-MM-DD'),
      nuncaVence,
      autoPublicar: vals.autoPublicar === true,
      lineas: validLines.map((l, i) => ({
        accountId:   l.accountId   || undefined,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description || undefined,
        debit:       l.debit  ?? 0,
        credit:      l.credit ?? 0,
      })),
    }

    setSaving(true)
    try {
      if (isNew || desdeDiario) {
        await createAsientoRecurrente(dto)
        message.success('Plantilla recurrente creada')
        navigate('/contabilidad/diarios-recurrentes', { replace: true, state: null })
      } else {
        await updateAsientoRecurrente(id!, dto)
        message.success('Plantilla actualizada')
        loadPlantilla()
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const lineColumns = [
    {
      title: 'Cuenta', width: 260,
      render: (_: any, r: LineState) => (
        <AccountSelect
          value={r.accountId} accounts={accounts}
          onChange={(id, code, name) => setLineAccount(r.key, id, code, name)}
        />
      ),
    },
    {
      title: 'Descripción',
      render: (_: any, r: LineState) => (
        <Input size="small" value={r.description}
          onChange={e => updateLine(r.key, 'description', e.target.value)}
          placeholder="Descripción de la línea" />
      ),
    },
    {
      title: 'Débitos', width: 130, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber
          size="small" style={{ width: '100%' }} min={0} precision={2}
          value={r.debit} placeholder="0.00"
          onChange={v => {
            updateLine(r.key, 'debit', v)
            if (v && v > 0) updateLine(r.key, 'credit', null)
          }}
        />
      ),
    },
    {
      title: 'Créditos', width: 130, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber
          size="small" style={{ width: '100%' }} min={0} precision={2}
          value={r.credit} placeholder="0.00"
          onChange={v => {
            updateLine(r.key, 'credit', v)
            if (v && v > 0) updateLine(r.key, 'debit', null)
          }}
        />
      ),
    },
    {
      title: '', width: 40,
      render: (_: any, r: LineState) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          disabled={lines.length <= 2}
          onClick={() => removeLine(r.key)} />
      ),
    },
  ]

  const Q = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

  const pageTitle = desdeDiario
    ? `Nuevo diario recurrente (desde ${desdeDiario.entryNumber})`
    : isNew
    ? 'Nuevo diario recurrente'
    : plantilla
    ? `Editar plantilla: ${plantilla.nombre}`
    : 'Cargando...'

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/contabilidad/diarios-recurrentes')}>
          Volver
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{pageTitle}</Title>
        {plantilla && (
          <Tag color={plantilla.activo ? 'success' : 'default'}>
            {plantilla.activo ? 'Activa' : 'Inactiva'}
          </Tag>
        )}
      </div>

      <Form form={form} layout="vertical" size="small"
        initialValues={{ frecuencia: 'MENSUAL', diaEjecucion: 1, nuncaVence: true, autoPublicar: false, fechaInicio: dayjs() }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {/* Columna izquierda */}
          <div>
            <Form.Item label="Nombre del perfil" name="nombre"
              rules={[{ required: true, message: 'El nombre es requerido' }]}>
              <Input placeholder="Ej. Honorarios mensuales, Depreciación, etc." />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Repetir todo (frecuencia)" name="frecuencia"
                rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Semanal',    value: 'SEMANAL' },
                    { label: 'Mensual',    value: 'MENSUAL' },
                    { label: 'Bimestral',  value: 'BIMESTRAL' },
                    { label: 'Trimestral', value: 'TRIMESTRAL' },
                    { label: 'Semestral',  value: 'SEMESTRAL' },
                    { label: 'Anual',      value: 'ANUAL' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="Día de ejecución" name="diaEjecucion">
                <InputNumber style={{ width: '100%' }} min={1} max={28}
                  placeholder="1" />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
              <Form.Item label="Comenzar el" name="fechaInicio">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item label="Finaliza el" name="fechaFin">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY"
                  disabled={nuncaVence} />
              </Form.Item>
            </div>
            <Form.Item name="nuncaVence" valuePropName="checked" style={{ marginTop: -8 }}>
              <Checkbox onChange={e => setNuncaVence(e.target.checked)}>Nunca vence</Checkbox>
            </Form.Item>
          </div>

          {/* Columna derecha */}
          <div>
            <Form.Item label="N.º de referencia" name="referencia">
              <Input placeholder="Número de referencia para los asientos generados" />
            </Form.Item>

            <Form.Item label="Notas" name="descripcion"
              rules={[{ required: true, message: 'Las notas son requeridas' }]}>
              <Input.TextArea rows={3} maxLength={500} showCount
                placeholder="500 caracteres como máximo" />
            </Form.Item>

            <Form.Item label="Método de generación de informes" name="reportingMethod">
              <Radio.Group defaultValue="ACCRUAL_CASH">
                <Radio value="ACCRUAL_CASH">Acumulación y efectivo</Radio>
                <Radio value="ACCRUAL">Solo devengo</Radio>
                <Radio value="CASH">Sólo efectivo</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="Moneda">
              <Select disabled value="GTQ"
                options={[{ label: 'GTQ — Guatemalan Quetzal', value: 'GTQ' }]} />
            </Form.Item>

            <Form.Item name="autoPublicar" valuePropName="checked">
              <Checkbox>
                Publicar automáticamente al generar (sin revisión manual)
              </Checkbox>
            </Form.Item>
          </div>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        {/* ── Líneas ──────────────────────────────────────────── */}
        <Table
          dataSource={lines} columns={lineColumns} rowKey="key"
          size="small" pagination={false}
          locale={{ emptyText: 'Sin líneas' }}
        />
        <Button type="dashed" icon={<PlusOutlined />}
          style={{ marginTop: 8, width: '100%' }}
          onClick={addLine}>
          Añadir nueva fila
        </Button>

        {/* ── Totales ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 340 }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 20px', color: '#666' }}>Subtotal</td>
                <td style={{ padding: '4px 20px', textAlign: 'right' }}>{Q(totalDebit)}</td>
                <td style={{ padding: '4px 20px', textAlign: 'right' }}>{Q(totalCredit)}</td>
              </tr>
              <tr style={{ fontWeight: 700, fontSize: 14 }}>
                <td style={{ padding: '4px 20px', borderTop: '1px solid #f0f0f0' }}>Total (GTQ)</td>
                <td style={{ padding: '4px 20px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>{Q(totalDebit)}</td>
                <td style={{ padding: '4px 20px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>{Q(totalCredit)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 20px', color: diferencia !== 0 ? '#f5222d' : '#52c41a' }}>Diferencia</td>
                <td colSpan={2} style={{
                  padding: '4px 20px', textAlign: 'right',
                  color: diferencia !== 0 ? '#f5222d' : '#52c41a', fontWeight: 600,
                }}>
                  {Q(Math.abs(diferencia))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Divider style={{ margin: '16px 0' }} />
        <Space>
          <Button type="primary" icon={<SaveOutlined />}
            style={{ background: '#1B3A6B' }} loading={saving}
            disabled={Math.abs(diferencia) > 0.01}
            onClick={handleSave}>
            {isNew || desdeDiario ? 'Crear plantilla' : 'Guardar cambios'}
          </Button>
          <Button onClick={() => navigate('/contabilidad/diarios-recurrentes')}>Cancelar</Button>
        </Space>
      </Form>
    </div>
  )
}
