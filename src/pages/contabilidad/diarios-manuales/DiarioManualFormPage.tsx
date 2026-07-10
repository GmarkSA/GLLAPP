import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Button, Form, Input, DatePicker, Select, Typography, Divider,
  Table, InputNumber, Space, Tooltip, Tag, message, Popconfirm, Radio,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, StopOutlined,
  RollbackOutlined, ArrowLeftOutlined, SaveOutlined, CopyOutlined,
  RetweetOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  createAsiento, getAsiento, updateAsiento, postAsiento,
  voidAsiento, reverseAsiento,
  type AsientoDetalle,
} from '../../../api/asientos'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title } = Typography

const STATUS_COLOR: Record<string, string> = { DRAFT: 'default', POSTED: 'success', VOID: 'error' }
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', POSTED: 'Publicado', VOID: 'Anulado' }

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
  accountId:   '',
  accountCode: '',
  accountName: '',
  description: '',
  debit:       null,
  credit:      null,
})

const detailToLines = (lines: AsientoDetalle['lines']): LineState[] =>
  lines.map(l => ({
    key:         Math.random().toString(36).slice(2),
    accountId:   l.accountId ?? '',
    accountCode: l.accountCode,
    accountName: l.accountName,
    description: l.description ?? '',
    debit:       Number(l.debit)  || null,
    credit:      Number(l.credit) || null,
  }))

function AccountSelect({
  value, accounts, disabled, onChange,
}: {
  value: string; accounts: Account[]; disabled?: boolean
  onChange: (id: string, code: string, name: string) => void
}) {
  return (
    <Select
      size="small"
      showSearch
      disabled={disabled}
      value={value || undefined}
      placeholder="Seleccione una cuenta"
      optionFilterProp="label"
      style={{ width: '100%' }}
      options={accounts
        .filter(a => !a.isHeader && a.isActive)
        .map(a => ({ label: `${a.code} - ${a.name}`, value: a.id, code: a.code, acname: a.name }))}
      onChange={(_: string, opt: any) => onChange(_, opt.code, opt.acname)}
    />
  )
}

export default function DiarioManualFormPage() {
  const { id }          = useParams<{ id: string }>()
  const navigate        = useNavigate()
  const location        = useLocation()
  const clonarDe        = (location.state as any)?.clonarDe as AsientoDetalle | undefined
  const isNew           = !id || id === 'nuevo'

  const [form]     = Form.useForm()
  const [asiento,  setAsiento]  = useState<AsientoDetalle | null>(null)
  const [lines,    setLines]    = useState<LineState[]>([emptyLine(), emptyLine()])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saving,   setSaving]   = useState(false)
  const [acting,   setActing]   = useState(false)

  const totalDebit  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  const diferencia  = totalDebit - totalCredit

  const isReadonly = asiento?.status === 'POSTED' || asiento?.status === 'VOID'

  useCallback(async () => {
    try {
      const all = await getAccounts({ activas: true })
      setAccounts(Array.isArray(all) ? all : [])
    } catch { setAccounts([]) }
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      const all = await getAccounts({ activas: true })
      setAccounts(Array.isArray(all) ? all : [])
    } catch { setAccounts([]) }
  }, [])

  const loadAsiento = useCallback(async () => {
    if (isNew || !id) return
    try {
      const a = await getAsiento(id)
      setAsiento(a)
      form.setFieldsValue({
        entryDate:   dayjs(a.entryDate),
        description: a.description,
        reference:   a.reference,
        type:        a.type,
      })
      setLines(detailToLines(a.lines))
    } catch { message.error('Error al cargar el asiento') }
  }, [id, isNew, form])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  useEffect(() => {
    if (clonarDe) {
      // Modo clonación: pre-llenamos con datos del asiento fuente
      form.setFieldsValue({
        entryDate:   dayjs(),
        description: `Copia de ${clonarDe.entryNumber}: ${clonarDe.description}`,
        reference:   clonarDe.reference,
        type:        clonarDe.type === 'MANUAL' ? 'MANUAL' : 'MANUAL',
      })
      setLines(detailToLines(clonarDe.lines))
    } else {
      loadAsiento()
    }
  }, [clonarDe, loadAsiento, form])

  const updateLine = (key: string, field: keyof LineState, value: any) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }

  const setLineAccount = (key: string, id: string, code: string, name: string) => {
    setLines(prev => prev.map(l => l.key === key
      ? { ...l, accountId: id, accountCode: code, accountName: name }
      : l
    ))
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])

  const removeLine = (key: string) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter(l => l.key !== key))
  }

  const buildPayload = (autoPost: boolean) => {
    const vals = form.getFieldsValue()
    return {
      entryDate:   vals.entryDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
      description: vals.description,
      reference:   vals.reference || undefined,
      type:        vals.type ?? 'MANUAL',
      autoPost,
      lines: lines
        .filter(l => l.accountCode || l.accountId)
        .map((l, i) => ({
          accountId:   l.accountId || undefined,
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.description || undefined,
          debit:       l.debit  ?? 0,
          credit:      l.credit ?? 0,
          sortOrder:   i,
        })),
    }
  }

  const handleSave = async (autoPost: boolean) => {
    try { await form.validateFields() } catch { return }

    const validLines = lines.filter(l => l.accountCode || l.accountId)
    if (validLines.length < 2) {
      message.warning('Se necesitan al menos 2 líneas con cuenta asignada')
      return
    }
    if (Math.abs(diferencia) > 0.01) {
      message.warning(`El asiento no cuadra — diferencia: Q ${Math.abs(diferencia).toFixed(2)}`)
      return
    }

    setSaving(true)
    try {
      if (isNew || clonarDe) {
        const created = await createAsiento(buildPayload(autoPost))
        message.success(autoPost ? 'Asiento publicado y contabilizado' : 'Borrador guardado')
        navigate(`/contabilidad/diarios-manuales/${created.id}`, { replace: true, state: null })
      } else {
        const vals = form.getFieldsValue()
        await updateAsiento(id!, {
          entryDate:   vals.entryDate?.format('YYYY-MM-DD'),
          description: vals.description,
          reference:   vals.reference,
        })
        if (autoPost) {
          await postAsiento(id!)
          message.success('Asiento publicado y contabilizado')
        } else {
          message.success('Borrador actualizado')
        }
        loadAsiento()
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const actFn = async (fn: () => Promise<any>, ok: string) => {
    setActing(true)
    try {
      const result = await fn()
      message.success(ok)
      // Si es reversión, navegar al nuevo asiento generado
      if (result?.id && result?.id !== id) {
        navigate(`/contabilidad/diarios-manuales/${result.id}`)
      } else {
        loadAsiento()
      }
    }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
    finally { setActing(false) }
  }

  const handleClonar = async () => {
    if (!asiento) return
    navigate('/contabilidad/diarios-manuales/nuevo', { state: { clonarDe: asiento } })
  }

  const handleHacerRecurrente = () => {
    if (!asiento) return
    navigate('/contabilidad/diarios-recurrentes/nueva', { state: { desdeDiario: asiento } })
  }

  const lineColumns = [
    {
      title: 'Cuenta', width: 260,
      render: (_: any, r: LineState) => (
        <AccountSelect
          value={r.accountId}
          accounts={accounts}
          disabled={isReadonly}
          onChange={(id, code, name) => setLineAccount(r.key, id, code, name)}
        />
      ),
    },
    {
      title: 'Descripción',
      render: (_: any, r: LineState) => (
        <Input
          size="small"
          value={r.description}
          onChange={e => updateLine(r.key, 'description', e.target.value)}
          placeholder="Descripción de la línea"
          disabled={isReadonly}
        />
      ),
    },
    {
      title: 'Débitos', width: 130, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber
          size="small" style={{ width: '100%' }}
          min={0} precision={2} value={r.debit} placeholder="0.00"
          disabled={isReadonly}
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
          size="small" style={{ width: '100%' }}
          min={0} precision={2} value={r.credit} placeholder="0.00"
          disabled={isReadonly}
          onChange={v => {
            updateLine(r.key, 'credit', v)
            if (v && v > 0) updateLine(r.key, 'debit', null)
          }}
        />
      ),
    },
    ...(!isReadonly ? [{
      title: '', width: 40,
      render: (_: any, r: LineState) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          disabled={lines.length <= 2}
          onClick={() => removeLine(r.key)} />
      ),
    }] : []),
  ]

  const Q = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

  const pageTitle = clonarDe
    ? `Nuevo diario (clon de ${clonarDe.entryNumber})`
    : isNew
    ? 'Nuevo diario'
    : asiento
    ? `Diario ${asiento.entryNumber}`
    : 'Cargando...'

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/contabilidad/diarios-manuales')}>
          Volver
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{pageTitle}</Title>
        {asiento?.status && (
          <Tag color={STATUS_COLOR[asiento.status]}>{STATUS_LABEL[asiento.status]}</Tag>
        )}
      </div>

      <Form form={form} layout="vertical" size="small"
        initialValues={{ type: 'MANUAL', currency: 'GTQ', entryDate: dayjs() }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {/* Columna izquierda */}
          <div>
            <Form.Item label="Fecha" name="entryDate"
              rules={[{ required: true, message: 'La fecha es requerida' }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY"
                disabled={isReadonly} />
            </Form.Item>

            <Form.Item label="N.º de referencia" name="reference">
              <Input placeholder="Número de referencia" disabled={isReadonly} />
            </Form.Item>

            <Form.Item label="Notas" name="description"
              rules={[{ required: true, message: 'Las notas son requeridas' }]}>
              <Input.TextArea
                rows={3} maxLength={500} showCount
                placeholder="500 caracteres como máximo"
                disabled={isReadonly}
              />
            </Form.Item>
          </div>

          {/* Columna derecha */}
          <div>
            {!isNew && asiento && (
              <Form.Item label="N.º del diario">
                <Input value={asiento.entryNumber} disabled style={{ fontWeight: 600 }} />
              </Form.Item>
            )}

            <Form.Item label="Tipo de asiento" name="type">
              <Select
                disabled={isReadonly || (!isNew && !clonarDe)}
                options={[
                  { label: 'Manual',   value: 'MANUAL' },
                  { label: 'Apertura', value: 'OPENING' },
                  { label: 'Cierre',   value: 'CLOSING' },
                  { label: 'Ajuste',   value: 'ADJUSTMENT' },
                ]}
              />
            </Form.Item>

            <Form.Item label="Método de generación de informes" name="reportingMethod">
              <Radio.Group disabled={isReadonly} defaultValue="ACCRUAL_CASH">
                <Radio value="ACCRUAL_CASH">Acumulación y efectivo</Radio>
                <Radio value="ACCRUAL">Solo devengo</Radio>
                <Radio value="CASH">Sólo efectivo</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="Moneda">
              <Select disabled value="GTQ"
                options={[{ label: 'GTQ — Guatemalan Quetzal', value: 'GTQ' }]} />
            </Form.Item>
          </div>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        {/* ── Tabla de líneas ──────────────────────────────────── */}
        <Table
          dataSource={lines}
          columns={lineColumns}
          rowKey="key"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Sin líneas' }}
        />

        {!isReadonly && (
          <Button type="dashed" icon={<PlusOutlined />}
            style={{ marginTop: 8, width: '100%' }}
            onClick={addLine}>
            Añadir nueva fila
          </Button>
        )}

        {/* ── Totales ──────────────────────────────────────────── */}
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
                  color: diferencia !== 0 ? '#f5222d' : '#52c41a',
                  fontWeight: 600,
                }}>
                  {Q(Math.abs(diferencia))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Acciones ─────────────────────────────────────────── */}
        <Divider style={{ margin: '16px 0' }} />
        <Space wrap>
          {/* Guardar / Publicar */}
          {!isReadonly && (
            <>
              <Button type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#1B3A6B' }} loading={saving}
                disabled={Math.abs(diferencia) > 0.01}
                onClick={() => handleSave(true)}>
                Guardar y publicar
              </Button>
              <Button icon={<SaveOutlined />} loading={saving}
                onClick={() => handleSave(false)}>
                Guardar como borrador
              </Button>
            </>
          )}

          {/* Clonar (disponible en modo vista) */}
          {asiento && (
            <Tooltip title="Crear un nuevo asiento con los mismos datos">
              <Button icon={<CopyOutlined />} onClick={handleClonar}>Clonar</Button>
            </Tooltip>
          )}

          {/* Revertir (solo POSTED) */}
          {asiento?.status === 'POSTED' && (
            <Popconfirm
              title="¿Crear asiento de reversión? Se generará un borrador con débitos y créditos invertidos."
              okText="Revertir"
              onConfirm={() => actFn(() => reverseAsiento(id!), 'Reversión creada como borrador')}>
              <Button icon={<RollbackOutlined />} loading={acting}>Revertir</Button>
            </Popconfirm>
          )}

          {/* Anular (solo POSTED) */}
          {asiento?.status === 'POSTED' && (
            <Popconfirm
              title="¿Anular este asiento? Esta acción no puede deshacerse."
              okText="Anular" okButtonProps={{ danger: true }}
              onConfirm={() => actFn(() => voidAsiento(id!), 'Asiento anulado')}>
              <Button danger icon={<StopOutlined />} loading={acting}>Anular</Button>
            </Popconfirm>
          )}

          {/* Hacer recurrente (disponible en modo vista de asiento guardado) */}
          {asiento && (
            <Tooltip title="Crear plantilla recurrente a partir de este asiento">
              <Button icon={<RetweetOutlined />} onClick={handleHacerRecurrente}>
                Hacer recurrente
              </Button>
            </Tooltip>
          )}

          <Button onClick={() => navigate('/contabilidad/diarios-manuales')}>Cancelar</Button>
        </Space>
      </Form>
    </div>
  )
}
