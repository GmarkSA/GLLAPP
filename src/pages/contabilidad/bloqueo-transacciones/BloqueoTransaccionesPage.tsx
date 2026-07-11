import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Button, Table, Tag, Space, message, Modal, Form, Select,
  DatePicker, Input, Typography, Alert, Popconfirm, Tooltip,
  Checkbox, Badge, Divider, Radio,
} from 'antd'
import {
  LockOutlined, UnlockOutlined, PlusOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  getBloqueos, getBloqueoVigente, bloquearMasivo, desbloquear, desbloquearParcial,
  eliminarBloqueo,
  type BloqueoContable, type ModuloBloqueable,
} from '../../../api/bloqueo-contable'

dayjs.locale('es')

const { Title, Text } = Typography

// ─── Constantes ──────────────────────────────────────────────────────────────

const MODULOS: { label: string; value: ModuloBloqueable; color: string }[] = [
  { label: 'Todos los módulos', value: 'TODOS',         color: 'red'    },
  { label: 'Ventas',            value: 'VENTAS',         color: 'blue'   },
  { label: 'Compras',           value: 'COMPRAS',        color: 'orange' },
  { label: 'Bancos',            value: 'BANCOS',         color: 'cyan'   },
  { label: 'Contabilidad',      value: 'CONTABILIDAD',   color: 'purple' },
  { label: 'Inventario',        value: 'INVENTARIO',     color: 'green'  },
  { label: 'Proyectos',         value: 'PROYECTOS',      color: 'lime'   },
  { label: 'Reportes',          value: 'REPORTES',       color: 'gold'   },
  { label: 'Automatización',    value: 'AUTOMATIZACION', color: 'volcano'},
  { label: 'Configuración',     value: 'CONFIGURACION',  color: 'default'},
]

const MODULO_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  MODULOS.map(m => [m.value, { label: m.label, color: m.color }]),
)

const ESTADO_COLOR: Record<string, string> = {
  BLOQUEADO:            'error',
  DESBLOQUEADO_PARCIAL: 'warning',
  DESBLOQUEADO:         'success',
}

const ESTADO_LABEL: Record<string, string> = {
  BLOQUEADO:            'Bloqueado',
  DESBLOQUEADO_PARCIAL: 'Parcial',
  DESBLOQUEADO:         'Abierto',
}

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPeriodo(b: BloqueoContable): string {
  if (!b.periodoInicio) return `hasta ${dayjs(b.periodoFin).format('DD/MM/YYYY')}`
  const ini = dayjs(b.periodoInicio)
  const fin = dayjs(b.periodoFin)
  if (ini.year() === fin.year() && ini.month() === fin.month()) {
    return `${MESES_ES[ini.month()]} ${ini.year()}`
  }
  return `${ini.format('DD/MM/YYYY')} – ${fin.format('DD/MM/YYYY')}`
}

// ─── Componente: selector de meses ───────────────────────────────────────────

function MesGrid({
  year, onYearChange, selectedMeses, onToggle,
}: {
  year: number
  onYearChange: (y: number) => void
  selectedMeses: string[]
  onToggle: (mes: string) => void
}) {
  const allKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const allSelected = allKeys.every(m => selectedMeses.includes(m))

  const toggleAll = () => {
    if (allSelected) {
      allKeys.forEach(m => { if (selectedMeses.includes(m)) onToggle(m) })
    } else {
      allKeys.forEach(m => { if (!selectedMeses.includes(m)) onToggle(m) })
    }
  }

  return (
    <div>
      {/* Navegación de año */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Button size="small" onClick={() => onYearChange(year - 1)}>{'<'}</Button>
        <Text strong style={{ minWidth: 36, textAlign: 'center' }}>{year}</Text>
        <Button size="small" onClick={() => onYearChange(year + 1)}>{'>'}</Button>
        <Checkbox checked={allSelected} onChange={toggleAll} style={{ marginLeft: 8 }}>
          Seleccionar todos
        </Checkbox>
      </div>
      {/* 12 meses en fila horizontal */}
      <div style={{ display: 'flex', gap: 6 }}>
        {MESES_ES.map((mes, i) => {
          const key = allKeys[i]
          const checked = selectedMeses.includes(key)
          return (
            <div
              key={key}
              onClick={() => onToggle(key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 2px',
                borderRadius: 6,
                border: `2px solid ${checked ? '#1B3A6B' : '#d9d9d9'}`,
                background: checked ? '#e6f0ff' : '#fafafa',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Checkbox checked={checked} onChange={() => {}} style={{ pointerEvents: 'none' }} />
              <span style={{ fontSize: 11, fontWeight: checked ? 700 : 400, color: checked ? '#1B3A6B' : '#595959' }}>
                {mes}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Componente: modal nuevo bloqueo masivo ──────────────────────────────────

function ModalNuevoBloqueo({
  open, onClose, onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>([])
  const [modoFecha, setModoFecha] = useState<'meses' | 'rango'>('meses')
  const [selectedMeses, setSelectedMeses] = useState<string[]>([])
  const [gridYear, setGridYear] = useState(dayjs().year())
  const [rango, setRango] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [motivo, setMotivo] = useState('')
  const [motivoError, setMotivoError] = useState(false)

  const resetForm = () => {
    setModulosSeleccionados([])
    setModoFecha('meses')
    setSelectedMeses([])
    setGridYear(dayjs().year())
    setRango([null, null])
    setMotivo('')
    setMotivoError(false)
  }

  useEffect(() => { if (!open) resetForm() }, [open])

  const toggleMes = (mes: string) => {
    setSelectedMeses(prev =>
      prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]
    )
  }

  const toggleModulo = (v: string) => {
    if (v === 'TODOS') {
      setModulosSeleccionados(prev => prev.includes('TODOS') ? [] : ['TODOS'])
      return
    }
    setModulosSeleccionados(prev => {
      const sinTodos = prev.filter(m => m !== 'TODOS')
      return sinTodos.includes(v)
        ? sinTodos.filter(m => m !== v)
        : [...sinTodos, v]
    })
  }

  const canSave = useMemo(() => {
    if (!modulosSeleccionados.length) return false
    if (modoFecha === 'meses' && !selectedMeses.length) return false
    if (modoFecha === 'rango' && (!rango[0] || !rango[1])) return false
    if (!motivo.trim()) return false
    return true
  }, [modulosSeleccionados, modoFecha, selectedMeses, rango, motivo])

  const handleSave = async () => {
    if (!motivo.trim()) { setMotivoError(true); return }
    setMotivoError(false)
    setSaving(true)
    try {
      const dto: any = {
        modulos: modulosSeleccionados,
        motivo: motivo.trim(),
      }
      if (modoFecha === 'meses') {
        dto.meses = selectedMeses
      } else {
        dto.rango = {
          inicio: rango[0]!.format('YYYY-MM-DD'),
          fin:    rango[1]!.format('YYYY-MM-DD'),
        }
      }
      const res = await bloquearMasivo(dto)
      message.success(
        `${res.creados} bloqueo(s) creado(s)${res.duplicadosOmitidos ? ` · ${res.duplicadosOmitidos} ya existía(n)` : ''}`
      )
      onSuccess()
      onClose()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al bloquear')
    } finally { setSaving(false) }
  }

  const resumenLabel = useMemo(() => {
    const mods = modulosSeleccionados.length === 1 && modulosSeleccionados[0] === 'TODOS'
      ? 'Todos los módulos'
      : modulosSeleccionados.map(m => MODULO_META[m]?.label ?? m).join(', ')
    if (modoFecha === 'meses' && selectedMeses.length) {
      const ordenados = [...selectedMeses].sort()
      return `${mods} — ${ordenados.length} mes(es)`
    }
    if (modoFecha === 'rango' && rango[0] && rango[1]) {
      return `${mods} — ${rango[0].format('DD/MM/YYYY')} a ${rango[1].format('DD/MM/YYYY')}`
    }
    return null
  }, [modulosSeleccionados, modoFecha, selectedMeses, rango])

  return (
    <Modal
      title={<><LockOutlined style={{ marginRight: 6 }} />Nuevo Bloqueo de Transacciones</>}
      open={open}
      onCancel={onClose}
      width={640}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginTop: 8 }}>
        {/* 1 — Módulos */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            1. Módulos a bloquear *
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {MODULOS.map((m, idx) => {
              const checked = modulosSeleccionados.includes(m.value)
              return (
                <>
                  {idx === 1 && (
                    <Divider style={{ margin: '4px 0' }} />
                  )}
                  <div
                    key={m.value}
                    onClick={() => toggleModulo(m.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: `1px solid ${checked ? '#1B3A6B' : '#e8e8e8'}`,
                      background: checked ? '#e6f0ff' : '#fafafa',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <Checkbox checked={checked} onChange={() => {}} />
                    <Tag color={m.color} style={{ margin: 0, minWidth: 90, textAlign: 'center' }}>
                      {m.label}
                    </Tag>
                  </div>
                </>
              )
            })}
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 2 — Período */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            2. Período a bloquear *
          </Text>
          <Radio.Group
            value={modoFecha}
            onChange={e => { setModoFecha(e.target.value); setSelectedMeses([]); setRango([null, null]) }}
            style={{ marginBottom: 12 }}
          >
            <Radio value="meses">Seleccionar meses</Radio>
            <Radio value="rango">Rango de fechas</Radio>
          </Radio.Group>

          {modoFecha === 'meses' ? (
            <MesGrid
              year={gridYear}
              onYearChange={setGridYear}
              selectedMeses={selectedMeses}
              onToggle={toggleMes}
            />
          ) : (
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={rango}
              onChange={v => setRango(v ? [v[0], v[1]] : [null, null])}
            />
          )}
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 3 — Motivo */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>3. Motivo *</Text>
          <Input.TextArea
            rows={2}
            placeholder="Ej: Cierre mensual junio 2026"
            value={motivo}
            onChange={e => { setMotivo(e.target.value); if (e.target.value.trim()) setMotivoError(false) }}
            status={motivoError ? 'error' : undefined}
          />
          {motivoError && <Text type="danger" style={{ fontSize: 12 }}>El motivo es obligatorio</Text>}
        </div>

        {/* Resumen */}
        {resumenLabel && (
          <Alert
            type="info" showIcon
            message={`Se crearán bloqueos para: ${resumenLabel}`}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            type="primary" danger icon={<LockOutlined />}
            loading={saving} disabled={!canSave}
            onClick={handleSave}
          >
            Bloquear
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Componente: modal desbloqueo parcial ────────────────────────────────────

function ModalDesbloquearParcial({
  bloqueo, onClose, onSuccess,
}: {
  bloqueo: BloqueoContable | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await desbloquearParcial(bloqueo!.id, {
        desde:  vals.desde.format('YYYY-MM-DD'),
        hasta:  vals.hasta.format('YYYY-MM-DD'),
        motivo: vals.motivo,
      })
      message.success('Desbloqueo parcial aplicado')
      onSuccess()
      onClose()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={<><UnlockOutlined style={{ marginRight: 6 }} />Desbloqueo Parcial</>}
      open={!!bloqueo}
      onCancel={onClose}
      onOk={handleOk}
      okText="Aplicar desbloqueo"
      okButtonProps={{ style: { background: '#1B3A6B' } }}
      confirmLoading={saving}
      width={460}
      destroyOnClose
    >
      <Alert
        type="info" showIcon
        message="El bloqueo principal se mantiene. Solo se permitirán transacciones dentro del rango indicado."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" size="small">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="desde" label="Desde" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="hasta" label="Hasta" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
        <Form.Item name="motivo" label="Motivo" rules={[{ required: true }]}>
          <Input.TextArea rows={2} placeholder="Corrección de factura julio 2026" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function BloqueoTransaccionesPage() {
  const [data,    setData]    = useState<BloqueoContable[]>([])
  const [loading, setLoading] = useState(false)
  const [vigente, setVigente] = useState<BloqueoContable | null>(null)
  const [modalNuevo, setModalNuevo]     = useState(false)
  const [bloqueoParc, setBloqueoParc]   = useState<BloqueoContable | null>(null)
  const [filtroModulo, setFiltroModulo] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, vig] = await Promise.all([
        getBloqueos({ modulo: filtroModulo || undefined, estado: filtroEstado || undefined }),
        getBloqueoVigente(),
      ])
      setData(Array.isArray(rows) ? rows : [])
      setVigente(vig)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [filtroModulo, filtroEstado])

  useEffect(() => { load() }, [load])

  const handleDesbloquear = async (id: string) => {
    const motivo = prompt('Motivo del desbloqueo completo:')
    if (!motivo) return
    try {
      await desbloquear(id, motivo)
      message.success('Período desbloqueado')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    }
  }

  // Calcular rowSpan para columna Módulo (agrupación visual)
  const rowSpanMap = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const ma = a.modulo.localeCompare(b.modulo)
      return ma !== 0 ? ma : b.periodoFin.localeCompare(a.periodoFin)
    })
    const spans: Record<string, number> = {}
    const seen: Record<string, boolean> = {}
    sorted.forEach((row, idx) => {
      if (!seen[row.modulo]) {
        seen[row.modulo] = true
        spans[row.id] = sorted.filter(r => r.modulo === row.modulo).length
      } else {
        spans[row.id] = 0
      }
    })
    return { sorted, spans }
  }, [data])

  // Contar activos por módulo para badges
  const badgesPorModulo = useMemo(() => {
    const result: Record<string, number> = {}
    data.forEach(b => {
      if (b.estado === 'BLOQUEADO' || b.estado === 'DESBLOQUEADO_PARCIAL') {
        result[b.modulo] = (result[b.modulo] ?? 0) + 1
      }
    })
    return result
  }, [data])

  const totalActivos = Object.values(badgesPorModulo).reduce((s, n) => s + n, 0)

  const columns = [
    {
      title: 'Módulo',
      dataIndex: 'modulo',
      width: 160,
      render: (v: string, r: BloqueoContable) => {
        const span = rowSpanMap.spans[r.id]
        if (span === 0) return { children: null, props: { rowSpan: 0 } }
        const meta = MODULO_META[v]
        return {
          children: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color={meta?.color}>{meta?.label ?? v}</Tag>
              {badgesPorModulo[v] ? (
                <Badge count={badgesPorModulo[v]} size="small" color="#1B3A6B" />
              ) : null}
            </div>
          ),
          props: { rowSpan: span, style: { verticalAlign: 'top', paddingTop: 10 } },
        }
      },
    },
    {
      title: 'Período',
      width: 180,
      render: (_: any, r: BloqueoContable) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{fmtPeriodo(r)}</Text>
          {r.estado === 'DESBLOQUEADO_PARCIAL' && r.desbloqueoParcialDesde && (
            <div style={{ fontSize: 11, color: '#d46b08', marginTop: 2 }}>
              Ventana abierta: {dayjs(r.desbloqueoParcialDesde).format('DD/MM')} – {dayjs(r.desbloqueoParcialHasta!).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 110,
      render: (v: string) => (
        <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Motivo',
      dataIndex: 'motivo',
      ellipsis: true,
      render: (v: string, r: BloqueoContable) => (
        <div>
          <div style={{ fontSize: 13 }}>{v}</div>
          {r.motivoDesbloqueo && (
            <div style={{ fontSize: 11, color: '#389e0d' }}>
              Desbloqueo: {r.motivoDesbloqueo}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Creado',
      dataIndex: 'fechaCreacion',
      width: 120,
      render: (v: string) => (
        <Text style={{ fontSize: 12 }} type="secondary">
          {dayjs(v).format('DD/MM/YYYY HH:mm')}
        </Text>
      ),
    },
    {
      title: 'Acciones',
      width: 160,
      render: (_: any, r: BloqueoContable) => {
        if (r.estado === 'DESBLOQUEADO') return null
        return (
          <Space size={4}>
            <Popconfirm
              title="¿Desbloquear completamente este período?"
              onConfirm={() => handleDesbloquear(r.id)}
              okText="Sí" cancelText="No"
            >
              <Tooltip title="Liberar completamente">
                <Button size="small" icon={<UnlockOutlined />}>Liberar</Button>
              </Tooltip>
            </Popconfirm>
            {r.estado === 'BLOQUEADO' && (
              <Tooltip title="Abrir ventana parcial de fechas">
                <Button
                  size="small"
                  onClick={() => setBloqueoParc(r)}
                >
                  Parcial
                </Button>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
      }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
            <LockOutlined style={{ marginRight: 8 }} />
            Bloqueo de Transacciones
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Controla qué períodos y módulos están cerrados para nuevas transacciones
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {totalActivos > 0 && (
            <Badge count={totalActivos} color="#faad14">
              <Text type="secondary" style={{ fontSize: 12 }}>períodos activos</Text>
            </Badge>
          )}
          <Button
            type="primary" danger icon={<LockOutlined />}
            onClick={() => setModalNuevo(true)}
          >
            <PlusOutlined /> Nuevo Bloqueo
          </Button>
        </div>
      </div>

      {/* Banner bloqueo vigente */}
      {vigente && vigente.periodoFin && vigente.motivo && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={
            <span>
              <strong>Período bloqueado</strong>
              {vigente.periodoInicio
                ? ` ${fmtPeriodo(vigente)}`
                : ` hasta ${dayjs(vigente.periodoFin).format('DD MMMM YYYY')}`}
              {' — '}
              <Tag color={MODULO_META[vigente.modulo]?.color}>
                {MODULO_META[vigente.modulo]?.label ?? vigente.modulo}
              </Tag>
            </span>
          }
          description={`Motivo: ${vigente.motivo}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Select
          style={{ width: 180 }}
          placeholder="Filtrar por módulo"
          allowClear
          value={filtroModulo || undefined}
          onChange={v => setFiltroModulo(v ?? '')}
          options={MODULOS.map(m => ({ label: m.label, value: m.value }))}
          size="small"
        />
        <Select
          style={{ width: 150 }}
          placeholder="Filtrar por estado"
          allowClear
          value={filtroEstado || undefined}
          onChange={v => setFiltroEstado(v ?? '')}
          options={[
            { label: 'Bloqueado',   value: 'BLOQUEADO' },
            { label: 'Parcial',     value: 'DESBLOQUEADO_PARCIAL' },
            { label: 'Abierto',     value: 'DESBLOQUEADO' },
          ]}
          size="small"
        />
      </div>

      {/* Tabla */}
      <Table
        dataSource={rowSpanMap.sorted}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        locale={{ emptyText: 'No hay bloqueos registrados' }}
        rowClassName={r =>
          r.estado === 'BLOQUEADO' ? 'bloqueo-row-activo' : ''
        }
      />

      {/* Modales */}
      <ModalNuevoBloqueo
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        onSuccess={load}
      />
      <ModalDesbloquearParcial
        bloqueo={bloqueoParc}
        onClose={() => setBloqueoParc(null)}
        onSuccess={load}
      />
    </div>
  )
}
