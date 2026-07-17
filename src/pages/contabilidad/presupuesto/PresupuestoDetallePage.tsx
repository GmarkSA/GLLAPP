import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Typography, Divider, InputNumber, Spin, message, Modal, Form,
  Select, Tabs, Tag, Space, Tooltip, Input, Tree,
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, CopyOutlined,
  PlusOutlined, MinusOutlined, BarChartOutlined, SearchOutlined,
  CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import dayjs from 'dayjs'
import {
  getPresupuesto, upsertLines, addCuentas, removeCuentas, prefillPresupuesto,
  copyPresupuesto, type Budget, type BudgetLine, type BudgetPeriodo,
  PERIODO_LABELS, STATUS_COLOR, STATUS_LABEL,
} from '../../../api/presupuesto'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getCentrosCosto, type CentroCosto } from '../../../api/centros-costo'
import { getCentrosBeneficio, type CentroBeneficio } from '../../../api/centros-beneficio'

const { Title, Text } = Typography

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = dayjs().year() - 1 + i
  return { label: String(y), value: y }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupLinesByAccount(lines: BudgetLine[], periodo: BudgetPeriodo) {
  const labels = PERIODO_LABELS[periodo]
  const map = new Map<string, { code: string; name: string; type: string | null; periodos: Record<number, number> }>()
  for (const l of lines) {
    if (!map.has(l.accountId)) {
      map.set(l.accountId, { code: l.accountCode, name: l.accountName, type: l.accountType, periodos: {} })
    }
    map.get(l.accountId)!.periodos[l.periodo] = Number(l.monto)
  }
  return { map, labels }
}

function buildTree(accounts: Account[]): { nodes: DataNode[]; leafIds: string[] } {
  const leafIds: string[] = []
  const byId = new Map(accounts.map(a => [a.id, a]))
  const children = new Map<string | null, Account[]>()
  for (const a of accounts) {
    const pid = (a.parentId && byId.has(a.parentId)) ? a.parentId : null
    if (!children.has(pid)) children.set(pid, [])
    children.get(pid)!.push(a)
  }
  const toNode = (a: Account): DataNode => {
    const kids = children.get(a.id) ?? []
    if (a.isHeader || kids.length > 0) return {
      key: a.id, title: <span style={{ fontWeight: 600 }}>{a.name}</span>,
      children: kids.map(toNode), selectable: false,
    }
    leafIds.push(a.id)
    return { key: a.id, title: `${a.code} — ${a.name}` }
  }
  return { nodes: (children.get(null) ?? []).map(toNode), leafIds }
}

// ── Celda editable con debounce ───────────────────────────────────────────────

function BudgetCell({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <InputNumber
      controls={false}
      size="small" style={{ width: '100%', minWidth: 82 }} min={0} precision={2}
      value={local} disabled={disabled}
      onChange={v => setLocal(v ?? 0)}
      onBlur={() => { if (local !== value) onChange(local) }}
      onPressEnter={() => { if (local !== value) onChange(local) }}
    />
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PresupuestoDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [budget,  setBudget]  = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [allAccounts,      setAllAccounts]      = useState<Account[]>([])
  const [centrosCosto,     setCentrosCosto]     = useState<CentroCosto[]>([])
  const [centrosBeneficio, setCentrosBeneficio] = useState<CentroBeneficio[]>([])

  // Celdas editadas (buffer antes de guardar)
  const [edited, setEdited] = useState<Map<string, number>>(new Map())
  const hasEdits = edited.size > 0

  // Autocompletar por fila
  const [autoModal, setAutoModal] = useState<{ accountId: string; name: string } | null>(null)
  const [autoTipo,  setAutoTipo]  = useState<'FIJO' | 'AJUSTE_MONTO' | 'AJUSTE_PORCENTAJE'>('FIJO')
  const [autoValor, setAutoValor] = useState<number>(0)

  // Modales
  const [modalPrefill, setModalPrefill] = useState(false)
  const [modalCopy,    setModalCopy]    = useState(false)
  const [modalCuentas, setModalCuentas] = useState(false)
  const [modoCuentas,  setModoCuentas]  = useState<'add' | 'remove'>('add')
  const [cuentasChecked, setCuentasChecked] = useState<string[]>([])
  const [cuentasSearch,  setCuentasSearch]  = useState('')
  const [actingCuentas,  setActingCuentas]  = useState(false)

  // Forms de modales
  const [prefillForm] = Form.useForm()
  const [copyForm]    = Form.useForm()

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try { setBudget(await getPresupuesto(id)) }
    catch { message.error('Error al cargar el presupuesto') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getAccounts({ activas: true }).then((r: any) => setAllAccounts(Array.isArray(r) ? r : [])).catch(() => {})
    getCentrosCosto().then(r => setCentrosCosto(Array.isArray(r) ? r : [])).catch(() => {})
    getCentrosBeneficio().then(r => setCentrosBeneficio(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  if (loading || !budget) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>

  const { map: accountMap, labels } = groupLinesByAccount(budget.lines, budget.periodo)
  const periodoCount = labels.length
  const isReadonly   = budget.status === 'CERRADO'

  const cellKey = (accountId: string, p: number) => `${accountId}_${p}`

  const getCellValue = (accountId: string, p: number) => {
    const ev = edited.get(cellKey(accountId, p))
    return ev !== undefined ? ev : (accountMap.get(accountId)?.periodos[p] ?? 0)
  }

  const computeAutoVal = (current: number) => {
    if (autoTipo === 'FIJO')               return autoValor
    if (autoTipo === 'AJUSTE_MONTO')       return Math.round((current + autoValor) * 100) / 100
    return Math.round(current * (1 + autoValor / 100) * 100) / 100
  }

  const handleApplyAutocompletar = () => {
    if (!autoModal) return
    const updates = new Map(edited)
    for (let p = 1; p <= periodoCount; p++) {
      updates.set(cellKey(autoModal.accountId, p), computeAutoVal(getCellValue(autoModal.accountId, p)))
    }
    setEdited(updates)
    setAutoModal(null)
  }

  const handleCellChange = (accountId: string, p: number, value: number) => {
    const key = cellKey(accountId, p)
    setEdited(prev => { const n = new Map(prev); n.set(key, value); return n })
  }

  const handleSave = async () => {
    if (!edited.size) return
    setSaving(true)
    try {
      const lines: any[] = []
      for (const [key, monto] of edited.entries()) {
        const [accountId, periodoStr] = key.split('_')
        const periodo = Number(periodoStr)
        const info = accountMap.get(accountId)
        if (!info) continue
        lines.push({
          accountId, accountCode: info.code, accountName: info.name, accountType: info.type,
          periodo, año: budget.anioFiscal, monto,
        })
      }
      await upsertLines(id!, lines)
      setEdited(new Map())
      message.success(`${lines.length} valores guardados`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handlePrefill = async () => {
    try { await prefillForm.validateFields() } catch { return }
    const vals = prefillForm.getFieldsValue()
    setSaving(true)
    try {
      await prefillPresupuesto(id!, {
        tipo:            vals.tipo,
        valor:           vals.valor,
        anioFuenteDatos: vals.anioFuenteDatos ?? budget.anioFiscal - 1,
      })
      setModalPrefill(false)
      prefillForm.resetFields()
      setEdited(new Map())
      message.success('Presupuesto actualizado con datos reales')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al rellenar')
    } finally { setSaving(false) }
  }

  const handleCopy = async () => {
    try { await copyForm.validateFields() } catch { return }
    const vals = copyForm.getFieldsValue()
    setSaving(true)
    try {
      const copy = await copyPresupuesto(id!, vals.targetYear)
      setModalCopy(false)
      message.success(`Presupuesto ${vals.targetYear} creado`)
      navigate(`/contabilidad/presupuesto/${copy.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al copiar')
    } finally { setSaving(false) }
  }

  // ── Gestión de cuentas ──────────────────────────────────────────────────────
  const existingAccountIds = new Set(budget.lines.map(l => l.accountId))
  const cuentasParaAgregar = allAccounts.filter(a => !a.isHeader && !existingAccountIds.has(a.id))
  const cuentasParaQuitar  = allAccounts.filter(a => !a.isHeader && existingAccountIds.has(a.id))

  const openModalCuentas = (modo: 'add' | 'remove') => {
    setModoCuentas(modo)
    setCuentasChecked([])
    setCuentasSearch('')
    setModalCuentas(true)
  }

  const handleCuentas = async () => {
    if (!cuentasChecked.length) return
    setActingCuentas(true)
    try {
      if (modoCuentas === 'add') {
        await addCuentas(id!, cuentasChecked)
        message.success(`${cuentasChecked.length} cuentas agregadas`)
      } else {
        await removeCuentas(id!, cuentasChecked)
        message.success(`${cuentasChecked.length} cuentas eliminadas`)
      }
      setModalCuentas(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setActingCuentas(false) }
  }

  const cuentasSource = modoCuentas === 'add' ? cuentasParaAgregar : cuentasParaQuitar
  const cuentasFiltradas = cuentasSearch
    ? cuentasSource.filter(a => a.name.toLowerCase().includes(cuentasSearch.toLowerCase()) || a.code.includes(cuentasSearch))
    : cuentasSource
  const { nodes: cuentasTree } = buildTree(cuentasFiltradas)

  // ── Render tabla ────────────────────────────────────────────────────────────

  const renderTable = (filterType: 'income' | 'expense' | 'other') => {
    const typeMap: Record<typeof filterType, string[]> = {
      income:  ['income', 'INCOME'],
      expense: ['expense', 'EXPENSE', 'contra', 'CONTRA'],
      other:   ['asset', 'ASSET', 'liability', 'LIABILITY', 'equity', 'EQUITY'],
    }
    const allowed = typeMap[filterType]

    const rows = [...accountMap.entries()].filter(([, info]) => {
      if (!info.type) return filterType === 'other'
      return allowed.includes(info.type)
    })

    if (!rows.length) return <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Sin cuentas en esta sección. Agrega cuentas con el botón "Agregar O Quitar Cuentas".</div>

    const totalByPeriodo = Array.from({ length: periodoCount }, (_, i) =>
      rows.reduce((s, [aid]) => {
        const p = i + 1
        return s + (edited.get(cellKey(aid, p)) ?? accountMap.get(aid)?.periodos[p] ?? 0)
      }, 0),
    )
    const grandTotal = totalByPeriodo.reduce((s, v) => s + v, 0)

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <thead>
            <tr style={{ background: '#fafbfc', borderBottom: '2px solid rgba(10,10,10,0.08)' }}>
              <th style={thStyle}>CUENTA</th>
              {labels.map(l => <th key={l} style={{ ...thStyle, minWidth: 100, textAlign: 'right' }}>{l} {budget.anioFiscal}</th>)}
              <th style={{ ...thStyle, minWidth: 110, textAlign: 'right', fontWeight: 700 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([accountId, info]) => {
              const rowTotal = Array.from({ length: periodoCount }, (_, i) => i + 1)
                .reduce((s, p) => s + (edited.get(cellKey(accountId, p)) ?? info.periodos[p] ?? 0), 0)
              return (
                <tr key={accountId} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                  <td style={{ padding: '4px 12px', minWidth: 200, maxWidth: 260, fontWeight: 500 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={`${info.code} — ${info.name}`}>
                      {info.name}
                    </div>
                    {!isReadonly && (
                      <a
                        style={{ fontSize: 10, color: '#1faec2', opacity: 0.7, display: 'block', lineHeight: '14px' }}
                        onClick={() => { setAutoModal({ accountId, name: info.name }); setAutoTipo('FIJO'); setAutoValor(0) }}
                      >
                        Autocompletar ›
                      </a>
                    )}
                  </td>
                  {Array.from({ length: periodoCount }, (_, i) => i + 1).map(p => {
                    const savedVal = info.periodos[p] ?? 0
                    const editedVal = edited.get(cellKey(accountId, p))
                    const displayVal = editedVal !== undefined ? editedVal : savedVal
                    const isEdited = editedVal !== undefined && editedVal !== savedVal
                    return (
                      <td key={p} style={{ padding: '2px 4px', textAlign: 'right' }}>
                        <div style={{ position: 'relative' }}>
                          {isEdited && <div style={{ position: 'absolute', top: 2, left: 2, width: 6, height: 6, borderRadius: '50%', background: '#1faec2', zIndex: 1 }} />}
                          <BudgetCell
                            value={displayVal}
                            disabled={isReadonly}
                            onChange={v => handleCellChange(accountId, p, v)}
                          />
                        </div>
                      </td>
                    )
                  })}
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#1faec2' }}>
                    {rowTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f6f6f6', fontWeight: 700, borderTop: '2px solid rgba(10,10,10,0.08)' }}>
              <td style={{ padding: '6px 12px' }}>Total</td>
              {totalByPeriodo.map((t, i) => (
                <td key={i} style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {t.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                </td>
              ))}
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1faec2' }}>
                {grandTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  const tabItems = [
    {
      key: 'income-expense',
      label: 'Cuentas de ingresos y gastos',
      children: (
        <>
          <div style={{ fontWeight: 700, color: '#1faec2', padding: '8px 12px 4px', background: '#fafbfc', borderRadius: 4, marginBottom: 8 }}>
            Ingresos
          </div>
          {renderTable('income')}
          <div style={{ fontWeight: 700, color: '#0a0a0a', padding: '8px 12px 4px', background: '#fff2e5', borderRadius: 4, margin: '16px 0 8px' }}>
            Gastos
          </div>
          {renderTable('expense')}
        </>
      ),
    },
    ...(budget.incluirBalanceGeneral ? [{
      key: 'balance',
      label: 'Cuentas de activo, pasivo y capital',
      children: renderTable('other'),
    }] : []),
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contabilidad/presupuesto')}>Volver</Button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>{budget.nombre}</Title>
            <Tag color={STATUS_COLOR[budget.status]}>{STATUS_LABEL[budget.status]}</Tag>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(budget.fechaInicio).format('DD MMM YYYY')} – {dayjs(budget.fechaFin).format('DD MMM YYYY')} · {budget.periodo}
            </Text>
            {budget.centroCostoId && (() => {
              const cc = centrosCosto.find(c => c.id === budget.centroCostoId)
              return <Tag color="#1faec2" style={{ fontSize: 11 }}>CC: {cc ? `${cc.codigo} — ${cc.nombre}` : budget.centroCostoId}</Tag>
            })()}
            {budget.centroBeneficioId && (() => {
              const cb = centrosBeneficio.find(c => c.id === budget.centroBeneficioId)
              return <Tag color="#2ea172" style={{ fontSize: 11 }}>CB: {cb ? `${cb.codigo} — ${cb.nombre}` : budget.centroBeneficioId}</Tag>
            })()}
            {budget.notas             && <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>{budget.notas}</Text>}
          </div>
        </div>
      </div>

      {/* Barra de acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space wrap>
          {!isReadonly && (
            <>
              <Tooltip title="Agregar cuentas al presupuesto">
                <Button size="small" icon={<PlusOutlined />} onClick={() => openModalCuentas('add')}>Agregar O Quitar Cuentas</Button>
              </Tooltip>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => setModalPrefill(true)}>
                Rellenar previo con datos reales
              </Button>
            </>
          )}
          <Button size="small" icon={<CopyOutlined />} onClick={() => setModalCopy(true)}>
            Copiar al siguiente año
          </Button>
          <Button size="small" icon={<BarChartOutlined />}
            onClick={() => navigate(`/contabilidad/presupuesto/${id}/vs-real`)}>
            Vs Real
          </Button>
        </Space>

        {hasEdits && !isReadonly && (
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>{edited.size} cambios sin guardar</Text>
            <Button danger size="small" onClick={() => setEdited(new Map())}>Descartar</Button>
            <Button type="primary" size="small" style={{ background: '#1faec2' }}
              icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              Guardar cambios
            </Button>
          </Space>
        )}
      </div>

      <Divider style={{ margin: '0 0 16px' }} />

      <Tabs items={tabItems} />

      {/* ── Modal: Prefill desde reales ────────────────────────────────────── */}
      <Modal
        title="Autorrellenar con datos reales"
        open={modalPrefill}
        onCancel={() => { setModalPrefill(false); prefillForm.resetFields() }}
        onOk={handlePrefill}
        okText="Aplicar"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#1faec2' } }}
      >
        <Form form={prefillForm} layout="vertical" size="small"
          initialValues={{ tipo: 'FIJO', anioFuenteDatos: budget.anioFiscal - 1 }}>
          <Form.Item name="tipo" label="Autocompletar importe por" rules={[{ required: true }]}>
            <Select options={[
              { label: 'Aplicar un importe fijo para cada período',          value: 'FIJO' },
              { label: 'Importe de ajuste (real + monto fijo por período)',   value: 'AJUSTE_MONTO' },
              { label: 'Porcentaje de ajuste (real × porcentaje de cambio)', value: 'AJUSTE_PORCENTAJE' },
            ]} />
          </Form.Item>
          <Form.Item name="anioFuenteDatos" label="Año de datos reales">
            <Select options={YEAR_OPTIONS} />
          </Form.Item>
          <Form.Item name="valor" label="Importe / %" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} precision={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Copiar al siguiente año ────────────────────────────────── */}
      <Modal
        title="Copiar presupuesto al siguiente año"
        open={modalCopy}
        onCancel={() => { setModalCopy(false); copyForm.resetFields() }}
        onOk={handleCopy}
        okText="Copiar"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#1faec2' } }}
      >
        <Form form={copyForm} layout="vertical" size="small"
          initialValues={{ targetYear: budget.anioFiscal + 1 }}>
          <Form.Item name="targetYear" label="Copiar para el año" rules={[{ required: true }]}>
            <Select options={YEAR_OPTIONS.filter(o => o.value > budget.anioFiscal)} />
          </Form.Item>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Se creará un nuevo presupuesto en estado <b>Borrador</b> con las mismas cuentas y montos como punto de partida.
          </p>
        </Form>
      </Modal>

      {/* ── Modal: Agregar / Quitar cuentas ─────────────────────────────────── */}
      <Modal
        title={modoCuentas === 'add' ? 'Agregar cuentas al presupuesto' : 'Quitar cuentas del presupuesto'}
        open={modalCuentas}
        onCancel={() => setModalCuentas(false)}
        width={600}
        footer={
          <Space>
            <Button type="primary" style={{ background: modoCuentas === 'add' ? '#1faec2' : '#e5484d' }}
              loading={actingCuentas} disabled={!cuentasChecked.length}
              onClick={handleCuentas}>
              {modoCuentas === 'add' ? `Agregar ${cuentasChecked.length || ''}` : `Quitar ${cuentasChecked.length || ''}`}
            </Button>
            <Button onClick={() => setModalCuentas(false)}>Cancelar</Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 8 }}>
          <Button size="small" type={modoCuentas === 'add' ? 'primary' : 'default'} onClick={() => { setModoCuentas('add'); setCuentasChecked([]) }}>
            <PlusOutlined /> Agregar
          </Button>
          <Button size="small" danger={modoCuentas === 'remove'} type={modoCuentas === 'remove' ? 'primary' : 'default'}
            onClick={() => { setModoCuentas('remove'); setCuentasChecked([]) }}>
            <MinusOutlined /> Quitar
          </Button>
        </Space>
        <Input prefix={<SearchOutlined />} placeholder="Buscar cuenta..."
          value={cuentasSearch} onChange={e => setCuentasSearch(e.target.value)} style={{ marginBottom: 8 }} />
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 4, padding: 8 }}>
          <Tree checkable defaultExpandAll treeData={cuentasTree}
            checkedKeys={cuentasChecked}
            onCheck={(keys: any) => setCuentasChecked(Array.isArray(keys) ? keys : keys.checked)} />
        </div>
      </Modal>

      {/* ── Modal: Autocompletar por fila ────────────────────────────────────── */}
      <Modal
        title={`Autocompletar — ${autoModal?.name ?? ''}`}
        open={!!autoModal}
        onCancel={() => setAutoModal(null)}
        onOk={handleApplyAutocompletar}
        okText="Aplicar"
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={480}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>TIPO</div>
            <Select
              style={{ width: '100%' }}
              value={autoTipo}
              onChange={v => setAutoTipo(v)}
              options={[
                { label: 'Importe fijo',        value: 'FIJO' },
                { label: 'Ajuste por monto',    value: 'AJUSTE_MONTO' },
                { label: 'Ajuste por %',        value: 'AJUSTE_PORCENTAJE' },
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>
              {autoTipo === 'AJUSTE_PORCENTAJE' ? 'PORCENTAJE (%)' : 'MONTO (Q)'}
            </div>
            <InputNumber
              controls={false}
              style={{ width: '100%' }}
              precision={2}
              value={autoValor}
              onChange={v => setAutoValor(v ?? 0)}
            />
          </div>
        </div>

        {autoModal && (
          <>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>VISTA PREVIA</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                <thead>
                  <tr style={{ background: '#fafbfc' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left', color: '#6b7280' }}>Período</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', color: '#6b7280' }}>Actual</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', color: '#1faec2', fontWeight: 700 }}>Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {labels.slice(0, 6).map((label, idx) => {
                    const p = idx + 1
                    const current = getCellValue(autoModal.accountId, p)
                    const next    = computeAutoVal(current)
                    return (
                      <tr key={p} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
                        <td style={{ padding: '3px 8px' }}>{label}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', color: '#6b7280' }}>
                          {current.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 600, color: '#1faec2' }}>
                          {next.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                  {periodoCount > 6 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '3px 8px', color: '#6b7280', textAlign: 'center' }}>
                        … y {periodoCount - 6} período(s) más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px',
  position: 'sticky', top: 0, background: '#fafbfc', zIndex: 2,
}
