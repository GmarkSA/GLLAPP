import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Button, Table, Tag, Space, message, Modal, Form,
  Select, DatePicker, Input, Typography, Alert, Popconfirm,
  Tooltip, Checkbox, Badge, Divider, Radio,
} from 'antd'
import { LockOutlined, UnlockOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  getBloqueos, getBloqueoVigente, bloquearMasivo, desbloquear, desbloquearParcial,
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

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

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

// ─── Modal: desbloqueo parcial ────────────────────────────────────────────────

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
      open={!!bloqueo} onCancel={onClose}
      onOk={handleOk} okText="Aplicar desbloqueo"
      okButtonProps={{ style: { background: '#1B3A6B' } }}
      confirmLoading={saving} width={460} destroyOnClose
    >
      <Alert type="info" showIcon
        message="El bloqueo principal se mantiene. Solo se permitirán transacciones dentro del rango indicado."
        style={{ marginBottom: 16 }} />
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
  // ── Datos ──────────────────────────────────────────────────────────────────
  const [data,        setData]       = useState<BloqueoContable[]>([])
  const [loading,     setLoading]    = useState(false)
  const [vigente,     setVigente]    = useState<BloqueoContable | null>(null)
  const [bloqueoParc, setBloqueoParc]= useState<BloqueoContable | null>(null)
  const [filtroModulo, setFiltroModulo] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  // ── Estado del formulario inline ───────────────────────────────────────────
  const [modulosSel,  setModulosSel] = useState<string[]>([])
  const [modoFecha,   setModoFecha]  = useState<'meses' | 'rango'>('meses')
  const [mesesSel,    setMesesSel]   = useState<string[]>([])
  const [gridYear,    setGridYear]   = useState(dayjs().year())
  const [rango,       setRango]      = useState<[dayjs.Dayjs|null, dayjs.Dayjs|null]>([null, null])
  const [motivo,      setMotivo]     = useState('')
  const [saving,      setSaving]     = useState(false)

  const resetForm = () => {
    setModulosSel([]); setModoFecha('meses'); setMesesSel([])
    setGridYear(dayjs().year()); setRango([null, null]); setMotivo('')
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────
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

  // ── Acciones formulario ────────────────────────────────────────────────────
  const toggleModulo = (v: string) => {
    if (v === 'TODOS') {
      setModulosSel(prev => prev.includes('TODOS') ? [] : ['TODOS'])
      return
    }
    setModulosSel(prev => {
      const sinTodos = prev.filter(m => m !== 'TODOS')
      return sinTodos.includes(v) ? sinTodos.filter(m => m !== v) : [...sinTodos, v]
    })
  }

  const toggleMes = (mes: string) =>
    setMesesSel(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes])

  const allMesKeys = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => `${gridYear}-${String(i + 1).padStart(2, '0')}`),
    [gridYear])

  const allMesSelected = allMesKeys.every(m => mesesSel.includes(m))

  const toggleAllMeses = () => {
    if (allMesSelected) setMesesSel(prev => prev.filter(m => !allMesKeys.includes(m)))
    else setMesesSel(prev => [...new Set([...prev, ...allMesKeys])])
  }

  const canSave = useMemo(() => {
    if (!modulosSel.length) return false
    if (modoFecha === 'meses' && !mesesSel.length) return false
    if (modoFecha === 'rango' && (!rango[0] || !rango[1])) return false
    if (!motivo.trim()) return false
    return true
  }, [modulosSel, modoFecha, mesesSel, rango, motivo])

  const handleBloquear = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const dto: any = { modulos: modulosSel, motivo: motivo.trim() }
      if (modoFecha === 'meses') dto.meses = mesesSel
      else dto.rango = { inicio: rango[0]!.format('YYYY-MM-DD'), fin: rango[1]!.format('YYYY-MM-DD') }
      const res = await bloquearMasivo(dto)
      message.success(
        `${res.creados} bloqueo(s) creado(s)${res.duplicadosOmitidos ? ` · ${res.duplicadosOmitidos} ya existía(n)` : ''}`
      )
      resetForm()
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al bloquear')
    } finally { setSaving(false) }
  }

  // ── Acciones tabla ─────────────────────────────────────────────────────────
  const handleDesbloquear = async (id: string) => {
    const motivoD = prompt('Motivo del desbloqueo completo:')
    if (!motivoD) return
    try {
      await desbloquear(id, motivoD)
      message.success('Período desbloqueado')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    }
  }

  // ── Cálculo de agrupación ──────────────────────────────────────────────────
  const { sorted, spans } = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const ma = a.modulo.localeCompare(b.modulo)
      return ma !== 0 ? ma : b.periodoFin.localeCompare(a.periodoFin)
    })
    const spans: Record<string, number> = {}
    const seen:  Record<string, boolean> = {}
    sorted.forEach(row => {
      if (!seen[row.modulo]) {
        seen[row.modulo] = true
        spans[row.id] = sorted.filter(r => r.modulo === row.modulo).length
      } else { spans[row.id] = 0 }
    })
    return { sorted, spans }
  }, [data])

  const badgesPorModulo = useMemo(() => {
    const result: Record<string, number> = {}
    data.forEach(b => {
      if (b.estado !== 'DESBLOQUEADO')
        result[b.modulo] = (result[b.modulo] ?? 0) + 1
    })
    return result
  }, [data])

  // ── Columnas de la tabla ───────────────────────────────────────────────────
  const columns = [
    {
      title: 'Módulo', dataIndex: 'modulo', width: 150,
      render: (v: string, r: BloqueoContable) => {
        const span = spans[r.id]
        if (span === 0) return { children: null, props: { rowSpan: 0 } }
        const meta = MODULO_META[v]
        return {
          children: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color={meta?.color} style={{ margin: 0 }}>{meta?.label ?? v}</Tag>
              {badgesPorModulo[v] ? <Badge count={badgesPorModulo[v]} size="small" color="#1B3A6B" /> : null}
            </div>
          ),
          props: { rowSpan: span, style: { verticalAlign: 'top', paddingTop: 10 } },
        }
      },
    },
    {
      title: 'Período', width: 160,
      render: (_: any, r: BloqueoContable) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{fmtPeriodo(r)}</Text>
          {r.estado === 'DESBLOQUEADO_PARCIAL' && r.desbloqueoParcialDesde && (
            <div style={{ fontSize: 11, color: '#d46b08', marginTop: 2 }}>
              Abierto: {dayjs(r.desbloqueoParcialDesde).format('DD/MM')}–{dayjs(r.desbloqueoParcialHasta!).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 100,
      render: (v: string) => <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Motivo', dataIndex: 'motivo', ellipsis: true,
      render: (v: string, r: BloqueoContable) => (
        <div>
          <div style={{ fontSize: 12 }}>{v}</div>
          {r.motivoDesbloqueo && (
            <div style={{ fontSize: 11, color: '#389e0d' }}>↳ {r.motivoDesbloqueo}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Creado', dataIndex: 'fechaCreacion', width: 110,
      render: (v: string) => (
        <Text style={{ fontSize: 11 }} type="secondary">{dayjs(v).format('DD/MM/YY HH:mm')}</Text>
      ),
    },
    {
      title: '', width: 130,
      render: (_: any, r: BloqueoContable) => {
        if (r.estado === 'DESBLOQUEADO') return null
        return (
          <Space size={4}>
            <Popconfirm title="¿Desbloquear completamente?" onConfirm={() => handleDesbloquear(r.id)} okText="Sí" cancelText="No">
              <Tooltip title="Liberar completamente">
                <Button size="small" icon={<UnlockOutlined />}>Liberar</Button>
              </Tooltip>
            </Popconfirm>
            {r.estado === 'BLOQUEADO' && (
              <Button size="small" onClick={() => setBloqueoParc(r)}>Parcial</Button>
            )}
          </Space>
        )
      },
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>
      {/* Cabecera */}
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          <LockOutlined style={{ marginRight: 8 }} />
          Bloqueo de Transacciones
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Controla qué períodos y módulos están cerrados para nuevas transacciones
        </Text>
      </div>

      {/* Banner vigente */}
      {vigente?.periodoFin && vigente?.motivo && (
        <Alert type="warning" showIcon icon={<WarningOutlined />}
          message={
            <span>
              <strong>Período bloqueado</strong>
              {` ${fmtPeriodo(vigente)} — `}
              <Tag color={MODULO_META[vigente.modulo]?.color}>
                {MODULO_META[vigente.modulo]?.label ?? vigente.modulo}
              </Tag>
            </span>
          }
          description={`Motivo: ${vigente.motivo}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Layout principal: formulario izquierda + tabla derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Panel izquierdo: formulario ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          padding: '16px',
          position: 'sticky',
          top: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <LockOutlined style={{ color: '#1B3A6B', fontSize: 15 }} />
            <Text strong style={{ fontSize: 14, color: '#1B3A6B' }}>Nuevo Bloqueo</Text>
          </div>

          {/* 1. Módulos */}
          <div style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#595959', display: 'block', marginBottom: 8 }}>
              1. Módulos a bloquear
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {MODULOS.map((m, idx) => {
                const checked = modulosSel.includes(m.value)
                return (
                  <div key={m.value}>
                    {idx === 1 && <Divider style={{ margin: '4px 0' }} />}
                    <div
                      onClick={() => toggleModulo(m.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${checked ? '#1B3A6B' : '#e8e8e8'}`,
                        background: checked ? '#e6f0ff' : '#fafafa',
                        userSelect: 'none',
                      }}
                    >
                      <Checkbox checked={checked} onChange={() => {}} />
                      <Tag color={m.color} style={{ margin: 0, fontSize: 11 }}>{m.label}</Tag>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Divider style={{ margin: '10px 0' }} />

          {/* 2. Período */}
          <div style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#595959', display: 'block', marginBottom: 8 }}>
              2. Período a bloquear
            </Text>
            <Radio.Group
              value={modoFecha}
              onChange={e => { setModoFecha(e.target.value); setMesesSel([]); setRango([null, null]) }}
              style={{ marginBottom: 10 }}
              size="small"
            >
              <Radio value="meses">Por mes</Radio>
              <Radio value="rango">Rango de fechas</Radio>
            </Radio.Group>

            {modoFecha === 'meses' ? (
              <>
                {/* Navegación de año */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Button size="small" onClick={() => setGridYear(y => y - 1)}>{'<'}</Button>
                  <Text strong style={{ minWidth: 34, textAlign: 'center', fontSize: 13 }}>{gridYear}</Text>
                  <Button size="small" onClick={() => setGridYear(y => y + 1)}>{'>'}</Button>
                  <Checkbox checked={allMesSelected} onChange={toggleAllMeses} style={{ marginLeft: 4, fontSize: 11 }}>
                    Todos
                  </Checkbox>
                </div>
                {/* 12 meses en fila horizontal */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {MESES_ES.map((mes, i) => {
                    const key = allMesKeys[i]
                    const checked = mesesSel.includes(key)
                    return (
                      <div
                        key={key}
                        onClick={() => toggleMes(key)}
                        style={{
                          flex: 1,
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '6px 0',
                          borderRadius: 5,
                          border: `2px solid ${checked ? '#1B3A6B' : '#d9d9d9'}`,
                          background: checked ? '#1B3A6B' : '#fafafa',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: checked ? '#fff' : '#595959',
                          lineHeight: 1,
                        }}>
                          {mes}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {mesesSel.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#1B3A6B', display: 'block', marginTop: 6 }}>
                    {mesesSel.length} mes(es) seleccionado(s)
                  </Text>
                )}
              </>
            ) : (
              <DatePicker.RangePicker
                style={{ width: '100%' }} format="DD/MM/YYYY" size="small"
                value={rango}
                onChange={v => setRango(v ? [v[0], v[1]] : [null, null])}
              />
            )}
          </div>

          <Divider style={{ margin: '10px 0' }} />

          {/* 3. Motivo */}
          <div style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#595959', display: 'block', marginBottom: 6 }}>
              3. Motivo
            </Text>
            <Input.TextArea
              rows={2} size="small"
              placeholder="Ej: Cierre mensual junio 2026"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>

          <Button
            type="primary" danger block icon={<LockOutlined />}
            loading={saving} disabled={!canSave}
            onClick={handleBloquear}
            size="middle"
          >
            Bloquear
          </Button>
        </div>

        {/* ── Panel derecho: tabla de bloqueos ── */}
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Select
              style={{ width: 170 }} size="small"
              placeholder="Filtrar por módulo" allowClear
              value={filtroModulo || undefined}
              onChange={v => setFiltroModulo(v ?? '')}
              options={MODULOS.map(m => ({ label: m.label, value: m.value }))}
            />
            <Select
              style={{ width: 140 }} size="small"
              placeholder="Filtrar por estado" allowClear
              value={filtroEstado || undefined}
              onChange={v => setFiltroEstado(v ?? '')}
              options={[
                { label: 'Bloqueado', value: 'BLOQUEADO' },
                { label: 'Parcial',   value: 'DESBLOQUEADO_PARCIAL' },
                { label: 'Abierto',   value: 'DESBLOQUEADO' },
              ]}
            />
            {Object.values(badgesPorModulo).reduce((s, n) => s + n, 0) > 0 && (
              <Badge
                count={Object.values(badgesPorModulo).reduce((s, n) => s + n, 0)}
                color="#faad14"
                style={{ alignSelf: 'center' }}
              >
                <Text type="secondary" style={{ fontSize: 12, paddingRight: 8 }}>activos</Text>
              </Badge>
            )}
          </div>

          <Table
            dataSource={sorted}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 30, hideOnSinglePage: true }}
            locale={{ emptyText: 'No hay bloqueos registrados' }}
          />
        </div>
      </div>

      {/* Modal desbloqueo parcial */}
      <ModalDesbloquearParcial
        bloqueo={bloqueoParc}
        onClose={() => setBloqueoParc(null)}
        onSuccess={load}
      />
    </div>
  )
}
