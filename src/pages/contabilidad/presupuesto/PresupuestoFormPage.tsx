import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form, Input, Select, Button, Typography, Steps, Modal, Checkbox,
  Tree, Space, message, Divider, Card, Spin, InputNumber, Radio, Alert,
} from 'antd'
import { SearchOutlined, CheckCircleOutlined, ThunderboltOutlined, EditOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import dayjs from 'dayjs'
import { getAccounts, type Account } from '../../../api/catalogo'
import { createPresupuesto, prefillPresupuesto, type BudgetPeriodo } from '../../../api/presupuesto'
import { getCentrosCosto, type CentroCosto } from '../../../api/centros-costo'
import { getCentrosBeneficio, type CentroBeneficio } from '../../../api/centros-beneficio'

const { Title, Text } = Typography

const PERIODOS: { label: string; value: BudgetPeriodo }[] = [
  { label: 'Mensual',    value: 'MENSUAL' },
  { label: 'Trimestral', value: 'TRIMESTRAL' },
  { label: 'Semestral',  value: 'SEMESTRAL' },
  { label: 'Anual',      value: 'ANUAL' },
]

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = dayjs().year() - 1 + i
  return { label: `${y}  (${dayjs(`${y}-01-01`).format('MMM YYYY')} – ${dayjs(`${y}-12-31`).format('MMM YYYY')})`, value: y }
})

const GROWTH_PRESETS = [0, 5, 10, 15, 20]
const ANIO_FUENTE_OPTIONS = Array.from({ length: 4 }, (_, i) => {
  const y = dayjs().year() - 1 - i
  return { label: String(y), value: y }
})

// Construye árbol para Ant Design Tree
function buildTree(accounts: Account[]): { nodes: DataNode[]; leafIds: string[] } {
  const leafIds: string[] = []
  const byId = new Map(accounts.map(a => [a.id, a]))

  // Agrupar por parentId. Si el padre no está en la lista (p.ej. encabezado excluido
  // por findFlat), se trata como raíz para que el nodo sea visible en el árbol.
  const children = new Map<string | null, Account[]>()
  for (const a of accounts) {
    const pid = (a.parentId && byId.has(a.parentId)) ? a.parentId : null
    if (!children.has(pid)) children.set(pid, [])
    children.get(pid)!.push(a)
  }

  const toNode = (a: Account): DataNode => {
    const kids = children.get(a.id) ?? []
    if (a.isHeader || kids.length > 0) {
      return {
        key:      a.id,
        title:    <span style={{ fontWeight: 600 }}>{a.name}</span>,
        children: kids.map(toNode),
        selectable: false,
      }
    }
    leafIds.push(a.id)
    return { key: a.id, title: `${a.code} — ${a.name}` }
  }

  const roots = children.get(null) ?? []
  return { nodes: roots.map(toNode), leafIds }
}

interface AccountSelectorModalProps {
  open: boolean
  accounts: Account[]
  selected: string[]
  title: string
  onClose: () => void
  onChange: (ids: string[]) => void
}

function AccountSelectorModal({ open, accounts, selected, title, onClose, onChange }: AccountSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<string[]>(selected)

  useEffect(() => { setChecked(selected) }, [selected, open])

  const filtered = search
    ? accounts.filter(a => !a.isHeader && (a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)))
    : accounts

  const { nodes, leafIds } = buildTree(filtered)

  const selectAll = () => setChecked([...new Set([...checked, ...leafIds])])

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <Space>
          <Button type="primary" style={{ background: '#1faec2' }} onClick={() => { onChange(checked); onClose() }}>
            Actualizar
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#e5484d', fontWeight: 500 }}>Seleccionar cuentas *</span>
        <a onClick={selectAll} style={{ color: '#1faec2', fontSize: 12 }}>Seleccionar todo</a>
      </div>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Buscar cuenta..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 4, padding: 8 }}>
        {nodes.length ? (
          <Tree
            checkable
            defaultExpandAll
            treeData={nodes}
            checkedKeys={checked}
            onCheck={(keys: any) => setChecked(Array.isArray(keys) ? keys : keys.checked)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>Sin resultados</div>
        )}
      </div>
    </Modal>
  )
}

export default function PresupuestoFormPage() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [step,    setStep]    = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [centrosCosto,     setCentrosCosto]     = useState<CentroCosto[]>([])
  const [centrosBeneficio, setCentrosBeneficio] = useState<CentroBeneficio[]>([])

  // Cuentas seleccionadas
  const [selectedIngresos, setSelectedIngresos] = useState<string[]>([])
  const [selectedGastos,   setSelectedGastos]   = useState<string[]>([])
  const [selectedOtras,    setSelectedOtras]     = useState<string[]>([])

  // Modales
  const [modalIngresos, setModalIngresos] = useState(false)
  const [modalGastos,   setModalGastos]   = useState(false)
  const [modalOtras,    setModalOtras]    = useState(false)

  // Proyección inteligente
  const [proyeccion,       setProyeccion]       = useState<'inteligente' | 'blank'>('inteligente')
  const [crecimiento,      setCrecimiento]       = useState(10)
  const [crecimientoCustom, setCrecimientoCustom] = useState<number | null>(null)
  const [anioFuente,       setAnioFuente]        = useState(dayjs().year() - 1)

  const incluirBalance = Form.useWatch('incluirBalanceGeneral', form) ?? false

  useEffect(() => {
    setLoadingAccounts(true)
    getAccounts({ activas: true })
      .then((res: any) => setAccounts(Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
    getCentrosCosto().then(r => setCentrosCosto(Array.isArray(r) ? r : [])).catch(() => {})
    getCentrosBeneficio().then(r => setCentrosBeneficio(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  // Filtros de cuentas por tipo
  const ingresosAccounts = accounts.filter(a =>
    ['income', 'INCOME'].includes(a.type) || a.code?.startsWith('4'))
  const gastosAccounts   = accounts.filter(a =>
    ['expense', 'EXPENSE', 'contra', 'CONTRA'].includes(a.type) || a.code?.startsWith('5') || a.code?.startsWith('6'))
  const otrasAccounts    = accounts.filter(a =>
    ['asset', 'ASSET', 'liability', 'LIABILITY', 'equity', 'EQUITY'].includes(a.type) ||
    a.code?.startsWith('1') || a.code?.startsWith('2') || a.code?.startsWith('3')
  )

  const totalSelected = selectedIngresos.length + selectedGastos.length + selectedOtras.length

  const handleCreate = async () => {
    try { await form.validateFields() } catch { return }
    const vals = form.getFieldsValue(true)   // true = incluir campos de steps no montados
    const año  = vals.anioFiscal
    const cuentaIds = [...selectedIngresos, ...selectedGastos, ...(incluirBalance ? selectedOtras : [])]

    if (!cuentaIds.length) {
      message.warning('Seleccione al menos una cuenta de ingresos o gastos')
      return
    }

    setSaving(true)
    try {
      const budget = await createPresupuesto({
        nombre:               vals.nombre,
        anioFiscal:           año,
        fechaInicio:          `${año}-01-01`,
        fechaFin:             `${año}-12-31`,
        periodo:              vals.periodo,
        incluirBalanceGeneral: form.getFieldValue('incluirBalanceGeneral') ?? false,
        cuentaIds,
        centroCostoId:     vals.centroCostoId     ?? null,
        centroBeneficioId: vals.centroBeneficioId ?? null,
        notas:             vals.notas              ?? undefined,
      })

      if (proyeccion === 'inteligente') {
        const pct = crecimientoCustom ?? crecimiento
        try {
          const result = await prefillPresupuesto(budget.id, {
            tipo:            'AJUSTE_PORCENTAJE',
            valor:           pct,
            anioFuenteDatos: anioFuente,
            anualizar:       true,
          })
          if ((result as any)?.filledCount > 0) {
            message.success(`Presupuesto creado con proyección +${pct}% desde ${anioFuente} (${(result as any).filledCount} cuentas)`)
          } else {
            message.warning(`Presupuesto creado, pero no hay movimientos en ${anioFuente}. Las cuentas quedaron en Q 0.00 — puedes ingresar los montos manualmente.`)
          }
        } catch {
          message.warning('Presupuesto creado, pero no se pudo aplicar la proyección automática. Puedes rellenarlo manualmente.')
        }
      } else {
        message.success('Presupuesto creado')
      }

      navigate(`/contabilidad/presupuesto/${budget.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al crear')
    } finally { setSaving(false) }
  }

  const stepItems = [
    { title: 'Configuración' },
    { title: 'Cuentas' },
    { title: 'Proyección' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Title level={4} style={{ color: '#0a0a0a' }}>Nuevo presupuesto</Title>

      <Steps current={step} items={stepItems} style={{ marginBottom: 32 }} size="small" />

      <Form form={form} layout="vertical" size="middle"
        initialValues={{ periodo: 'MENSUAL', anioFiscal: dayjs().year(), incluirBalanceGeneral: false }}>

        {/* ── Paso 1: configuración básica ───────────────────────────────── */}
        {step === 0 && (
          <Card>
            <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Ingrese un nombre' }]}>
              <Input placeholder={`Presupuesto ${dayjs().year()}`} />
            </Form.Item>

            <Form.Item name="anioFiscal" label="Año fiscal" rules={[{ required: true }]}>
              <Select options={YEAR_OPTIONS} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="periodo" label="Período del presupuesto" rules={[{ required: true }]}>
              <Select options={PERIODOS} />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="centroCostoId" label="Centro de Costo (opcional)">
                <Select
                  allowClear
                  placeholder="Sin filtro por centro de costo"
                  options={centrosCosto.filter(c => c.activo).map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id }))}
                />
              </Form.Item>
              <Form.Item name="centroBeneficioId" label="Centro de Beneficio (opcional)">
                <Select
                  allowClear
                  placeholder="Sin filtro por centro de beneficio"
                  options={centrosBeneficio.filter(c => c.activo).map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id }))}
                />
              </Form.Item>
            </div>

            <Form.Item name="notas" label="Notas internas">
              <Input.TextArea rows={2} placeholder="Descripción o notas del presupuesto..." />
            </Form.Item>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" style={{ background: '#1faec2' }}
                onClick={async () => {
                  try { await form.validateFields(['nombre', 'anioFiscal', 'periodo']); setStep(1) }
                  catch { }
                }}>
                Siguiente →
              </Button>
            </div>
          </Card>
        )}

        {/* ── Paso 2: selección de cuentas ───────────────────────────────── */}
        {step === 1 && (
          <Card>
            {loadingAccounts ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : (
              <>
                <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 12, letterSpacing: 1 }}>
                  CUENTAS DE INGRESOS Y GASTOS
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ fontWeight: 500 }}>Cuentas de ingresos</span>
                  <Space>
                    {selectedIngresos.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>{selectedIngresos.length} seleccionadas</Text>
                    )}
                    <Button size="small" onClick={() => setModalIngresos(true)}>
                      {selectedIngresos.length ? 'Editar' : 'Agregar'}
                    </Button>
                  </Space>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #fafbfc' }}>
                  <span style={{ fontWeight: 500 }}>Cuentas de gastos</span>
                  <Space>
                    {selectedGastos.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>{selectedGastos.length} seleccionadas</Text>
                    )}
                    <Button size="small" onClick={() => setModalGastos(true)}>
                      {selectedGastos.length ? 'Editar' : 'Agregar'}
                    </Button>
                  </Space>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Form.Item name="incluirBalanceGeneral" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Incluir cuentas de activo, pasivo y capital en el presupuesto</Checkbox>
                  </Form.Item>
                  {incluirBalance && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 8px 24px' }}>
                      <span style={{ fontWeight: 500 }}>Cuentas de activo, pasivo y capital</span>
                      <Space>
                        {selectedOtras.length > 0 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{selectedOtras.length} seleccionadas</Text>
                        )}
                        <Button size="small" onClick={() => setModalOtras(true)}>
                          {selectedOtras.length ? 'Editar' : 'Agregar'}
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>

                {totalSelected > 0 && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
                    <CheckCircleOutlined style={{ color: '#1faec2', marginRight: 6 }} />
                    <Text style={{ color: '#374151', fontSize: 13 }}>
                      {totalSelected} cuentas seleccionadas en total
                    </Text>
                  </div>
                )}
              </>
            )}

            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setStep(0)}>← Anterior</Button>
              <Space>
                <Button onClick={() => navigate('/contabilidad/presupuesto')}>Cancelar</Button>
                <Button type="primary" style={{ background: '#1faec2' }}
                  onClick={() => {
                    if (!totalSelected) { message.warning('Seleccione al menos una cuenta'); return }
                    setStep(2)
                  }}>
                  Siguiente →
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {/* ── Paso 3: proyección inteligente ─────────────────────────────── */}
        {step === 2 && (
          <Card>
            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 16, letterSpacing: 1 }}>
              PROYECCIÓN DE MONTOS
            </div>

            <Radio.Group
              value={proyeccion}
              onChange={e => setProyeccion(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}
            >
              <Radio value="inteligente" style={{ alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>
                    <ThunderboltOutlined style={{ color: '#1faec2', marginRight: 6 }} />
                    Proyección inteligente desde histórico
                  </span>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                    El sistema toma los movimientos reales del año de referencia y proyecta cada período con el crecimiento que definas
                  </div>
                </div>
              </Radio>
              <Radio value="blank">
                <div>
                  <span style={{ fontWeight: 600 }}>
                    <EditOutlined style={{ color: '#6b7280', marginRight: 6 }} />
                    En blanco — ingresar montos manualmente
                  </span>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                    Crea el presupuesto con todos los montos en Q 0.00 para rellenarlos tú mismo
                  </div>
                </div>
              </Radio>
            </Radio.Group>

            {proyeccion === 'inteligente' && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      Año de referencia
                    </div>
                    <Select
                      value={anioFuente}
                      onChange={setAnioFuente}
                      options={ANIO_FUENTE_OPTIONS}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      Se leerán los movimientos contables de este año
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      Crecimiento esperado
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {GROWTH_PRESETS.map(pct => (
                        <Button
                          key={pct}
                          size="small"
                          type={crecimientoCustom === null && crecimiento === pct ? 'primary' : 'default'}
                          style={crecimientoCustom === null && crecimiento === pct
                            ? { background: '#1faec2', borderColor: '#1faec2' }
                            : {}}
                          onClick={() => { setCrecimiento(pct); setCrecimientoCustom(null) }}
                        >
                          {pct === 0 ? 'Sin cambio' : `+${pct}%`}
                        </Button>
                      ))}
                      <InputNumber
                        size="small"
                        placeholder="% manual"
                        min={-50} max={200}
                        style={{ width: 90 }}
                        value={crecimientoCustom}
                        onChange={v => setCrecimientoCustom(v)}
                        addonAfter="%"
                      />
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      Porcentaje aplicado sobre los montos del año {anioFuente}
                    </div>
                  </div>
                </div>

                <Alert
                  type="info"
                  showIcon
                  icon={<ThunderboltOutlined />}
                  style={{ borderRadius: 8 }}
                  message="Proyección con anualización automática"
                  description={
                    <div style={{ fontSize: 12 }}>
                      Si el año <strong>{anioFuente}</strong> tuvo actividad parcial (por ejemplo, solo 6 meses),
                      el sistema calculará el <strong>promedio mensual de los meses activos</strong> y lo distribuirá
                      uniformemente a todos los períodos del presupuesto {form.getFieldValue('anioFiscal') ?? dayjs().year()}.
                      Así el presupuesto refleja un año completo proyectado, no solo los meses donde hubo datos.
                    </div>
                  }
                />
              </div>
            )}

            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setStep(1)}>← Anterior</Button>
              <Space>
                <Button onClick={() => navigate('/contabilidad/presupuesto')}>Cancelar</Button>
                <Button type="primary" style={{ background: '#1faec2' }}
                  loading={saving} onClick={handleCreate}>
                  Crear presupuesto
                </Button>
              </Space>
            </div>
          </Card>
        )}
      </Form>

      {/* Modales de selección de cuentas */}
      <AccountSelectorModal
        open={modalIngresos} title="Cuentas de ingresos"
        accounts={ingresosAccounts}
        selected={selectedIngresos}
        onClose={() => setModalIngresos(false)}
        onChange={setSelectedIngresos}
      />
      <AccountSelectorModal
        open={modalGastos} title="Cuentas de gastos"
        accounts={gastosAccounts}
        selected={selectedGastos}
        onClose={() => setModalGastos(false)}
        onChange={setSelectedGastos}
      />
      <AccountSelectorModal
        open={modalOtras} title="Cuentas de activo, pasivo y capital"
        accounts={otrasAccounts}
        selected={selectedOtras}
        onClose={() => setModalOtras(false)}
        onChange={setSelectedOtras}
      />
    </div>
  )
}
