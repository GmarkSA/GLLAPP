import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  Card, Select, Button, Space, Tag, Typography,
  InputNumber, Tooltip, message, Spin, Divider, Input,
} from 'antd'
import {
  CalculatorOutlined, FileProtectOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined, CloseOutlined, FileDoneOutlined,
  ArrowLeftOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useCompanyStore } from '../../store/companyStore'
import {
  type DeclaracionIsr,
  getDeclaracionesIsr, generarBorradorIsr,
  generarPolizaBorradorIsr, marcarIsrPresentada, actualizarDeclaracionIsr,
  sincronizarEstadoIsr,
} from '../../api/reportes'

const { Title, Text } = Typography
const { Option } = Select

const BD    = '1px solid #d0d5dd'
const CELL: CSSProperties = { padding: '4px 10px', borderBottom: BD, fontSize: 12, verticalAlign: 'middle' }
const NUM:  CSSProperties = { ...CELL, textAlign: 'right', width: 130, borderLeft: BD, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const SEC:  CSSProperties = { padding: '5px 10px', background: '#1B3A6B', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, borderBottom: BD, textAlign: 'center' }
const SEC2: CSSProperties = { ...SEC, background: '#3b5998', fontSize: 10.5 }
const SUB:  CSSProperties = { ...CELL, background: '#eef2fb', fontWeight: 700 }
const SNUM: CSSProperties = { ...NUM,  background: '#eef2fb', fontWeight: 700 }
const ECELL:CSSProperties = { ...CELL, background: '#fffbe6' }
const ENUM: CSSProperties = { ...NUM,  background: '#fffbe6' }
const PCELL:CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const PNUM: CSSProperties = { ...NUM,  background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const GCELL:CSSProperties = { ...CELL, background: '#f0fdf4', fontWeight: 700, color: '#16a34a' }
const GNUM: CSSProperties = { ...NUM,  background: '#f0fdf4', fontWeight: 700, color: '#16a34a' }
const ZERO: CSSProperties = { ...NUM,  color: '#9ca3af' }

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  borrador:        { color: 'default', label: 'Borrador' },
  poliza_generada: { color: 'blue',    label: 'Póliza Borrador' },
  presentada:      { color: 'green',   label: 'Presentada' },
}

const MESES = [
  { value: 1,  label: 'Enero' },      { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },      { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },       { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },      { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },  { value: 12, label: 'Diciembre' },
]

const r2  = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const addBusinessDays = (date: Dayjs, n: number): Dayjs => {
  let count = 0; let d = date
  while (count < n) { d = d.add(1, 'day'); if (d.day() !== 0 && d.day() !== 6) count++ }
  return d
}

// Tramos graduados SAT-1311: Q30k × 5% + excedente × 7%
const calcIsr = (imponible: number) => {
  if (imponible <= 0) return 0
  if (imponible <= 30000) return r2(imponible * 0.05)
  return r2(30000 * 0.05 + (imponible - 30000) * 0.07)
}

function NI({ val, onChange, disabled }: { val: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <InputNumber
      size="small" value={val} min={0} step={0.01} disabled={disabled}
      formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      parser={v => Number(String(v).replace(/,/g, ''))}
      onChange={v => onChange(Number(v ?? 0))}
      style={{ width: 126, textAlign: 'right', fontSize: 12 }}
    />
  )
}

export default function Declaracion1311Page() {
  const navigate      = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)

  const now = dayjs()
  const [mes,  setMes]  = useState(now.month() + 1)
  const [anio, setAnio] = useState(now.year())

  const [lista,    setLista]    = useState<DeclaracionIsr[]>([])
  const [loading,  setLoading]  = useState(false)
  const [acting,   setActing]   = useState(false)
  const [selected, setSelected] = useState<DeclaracionIsr | null>(null)
  const [editing,  setEditing]  = useState(false)

  // Sección 3 (campos principales)
  const [liveRenta,     setLiveRenta]     = useState(0)
  const [liveExentas,   setLiveExentas]   = useState(0)
  const [liveRet,       setLiveRet]       = useState(0)
  const [liveRemanente, setLiveRemanente] = useState(0)

  // Sección 4 (ISO + incentivos — editables, guardados en snapshot)
  const [liveISOPagado,    setLiveISOPagado]    = useState(0)
  const [liveISOAcred,     setLiveISOAcred]     = useState(0)
  const [liveIncentivos,   setLiveIncentivos]   = useState(0)
  const [liveNumResolucion,setLiveNumResolucion] = useState('')

  const syncIfPosted = useCallback(async (decl: DeclaracionIsr, lista: DeclaracionIsr[]) => {
    if (decl.status !== 'poliza_generada') return lista
    try {
      const updated = await sincronizarEstadoIsr(decl.id)
      if (updated.status !== decl.status) {
        setSelected(updated)
        syncEdit(updated)
        return lista.map(d => d.id === updated.id ? updated : d)
      }
    } catch { /* silencioso */ }
    return lista
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarLista = useCallback(async (selectedDecl?: DeclaracionIsr | null) => {
    setLoading(true)
    try {
      let lista = await getDeclaracionesIsr()
      // Auto-sincronizar cualquier póliza_generada de la lista contra el estado del diario
      const pendientes = lista.filter(d => d.status === 'poliza_generada')
      for (const d of pendientes) {
        lista = await syncIfPosted(d, lista)
      }
      setLista(lista)
      // Si hay una seleccionada que fue sincronizada, actualizarla
      if (selectedDecl) {
        const fresh = lista.find(d => d.id === selectedDecl.id)
        if (fresh && fresh.status !== selectedDecl.status) {
          setSelected(fresh); syncEdit(fresh)
        }
      }
    }
    catch { setLista([]) }
    finally { setLoading(false) }
  }, [syncIfPosted]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarLista() }, [cargarLista])

  // Re-sincronizar al volver el foco (usuario regresa de Diarios Manuales)
  useEffect(() => {
    const onFocus = () => cargarLista(selected)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [selected, cargarLista])

  const syncEdit = (d: DeclaracionIsr) => {
    setLiveRenta(r2(Number(d.rentaActividadesLucrativas ?? 0)))
    setLiveExentas(r2(Number(d.rentasExentas ?? 0)))
    setLiveRet(r2(Number(d.retencionesPeriodo ?? 0)))
    setLiveRemanente(r2(Number(d.remanenteAnterior ?? 0)))
    const snap = d.snapshot ?? {}
    setLiveISOPagado(r2(Number(snap.isoPagado ?? 0)))
    setLiveISOAcred(r2(Number(snap.isoAcred ?? 0)))
    setLiveIncentivos(r2(Number(snap.incentivos ?? 0)))
    setLiveNumResolucion(snap.numResolucion ?? '')
  }

  const selectDecl = (d: DeclaracionIsr) => { setSelected(d); setEditing(false); syncEdit(d) }

  // Cálculos en vivo
  const liveImponible  = r2(liveRenta - liveExentas)
  const liveImpuesto   = calcIsr(liveImponible)
  const liveSaldoISO   = r2(Math.max(0, liveISOPagado - liveISOAcred))
  const liveSaldoBruto = r2(liveImpuesto - liveRet - liveRemanente - liveSaldoISO - liveIncentivos)
  const liveSaldo      = r2(Math.max(0, liveSaldoBruto))
  const liveExcedente  = r2(Math.max(0, -liveSaldoBruto))

  const liveTramo1 = Math.min(liveImponible, 30000)
  const liveTramo2 = Math.max(0, liveImponible - 30000)

  // Valores guardados
  const n = (f: keyof DeclaracionIsr) => r2(Number(selected?.[f] ?? 0))
  const rentaBase     = n('rentaActividadesLucrativas')
  const exentasBase   = n('rentasExentas')
  const imponibleBase = n('rentaImponible')
  const impuestoBase  = n('impuestoDeterminado')
  const retBase       = n('retencionesPeriodo')
  const remanenteBase = n('remanenteAnterior')
  const saldoBase     = n('saldoAPagar')
  const excedenteBase = n('excedenteParaSiguiente')

  const snap            = selected?.snapshot ?? {}
  const isoPagadoBase   = r2(Number(snap.isoPagado   ?? 0))
  const isoAcredBase    = r2(Number(snap.isoAcred    ?? 0))
  const saldoISOBase    = r2(Math.max(0, isoPagadoBase - isoAcredBase))
  const incentivosBase  = r2(Number(snap.incentivos   ?? 0))
  const numResBase      = snap.numResolucion ?? ''

  // Tramos guardados
  const tramos     = snap.tramos as { base: number; tasa: number; impuesto: number }[] | undefined
  const tramo1Saved = tramos?.[0] ?? { base: Math.min(imponibleBase, 30000), tasa: 0.05, impuesto: r2(Math.min(imponibleBase, 30000) * 0.05) }
  const tramo2Saved = tramos?.[1] ?? (imponibleBase > 30000 ? { base: imponibleBase - 30000, tasa: 0.07, impuesto: r2((imponibleBase - 30000) * 0.07) } : null)

  const editMark = editing ? <span style={{ color: '#d48806', fontSize: 10, marginLeft: 4 }}>✎</span> : null

  const fechaLimite = selected
    ? addBusinessDays(dayjs(`${selected.anio}-${String(selected.mes).padStart(2, '0')}-01`).endOf('month'), 10)
    : null

  const mesLabel = (m: number): string => MESES.find(x => x.value === m)?.label ?? String(m)

  // Handlers
  const handleGenerarBorrador = async () => {
    setActing(true)
    try {
      const d = await generarBorradorIsr(mes, anio)
      await cargarLista(); selectDecl(d)
      message.success('Borrador ISR calculado')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al generar borrador')
    } finally { setActing(false) }
  }

  const handleGuardar = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await actualizarDeclaracionIsr(selected.id, {
        rentaActividadesLucrativas: liveRenta,
        rentasExentas:              liveExentas,
        retencionesPeriodo:         liveRet,
        remanenteAnterior:          liveRemanente,
      })
      await cargarLista(); selectDecl(d); setEditing(false)
      message.success('Declaración actualizada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setActing(false) }
  }

  const handlePoliza = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await generarPolizaBorradorIsr(selected.id)
      await cargarLista(); selectDecl(d)
      message.success('Póliza borrador generada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al generar póliza')
    } finally { setActing(false) }
  }

  const handleSincronizar = async () => {
    if (!selected) return
    setActing(true)
    try { const d = await sincronizarEstadoIsr(selected.id); await cargarLista(); selectDecl(d) }
    catch { } finally { setActing(false) }
  }

  const handlePresentada = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await marcarIsrPresentada(selected.id)
      await cargarLista(); selectDecl(d)
      message.success('Declaración marcada como presentada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setActing(false) }
  }

  const cancelEdit = () => { if (selected) syncEdit(selected); setEditing(false) }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/reportes')} />
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>ISR Opcional Mensual — SAT-1311</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Declaración mensual del Impuesto Sobre la Renta. Plazo: 10 días hábiles.
          </Text>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* ── Panel izquierdo ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Select value={mes} onChange={setMes} size="small" style={{ width: '100%' }}>
                  {MESES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
                </Select>
                <Select value={anio} onChange={setAnio} size="small" style={{ width: '100%' }}>
                  {[now.year(), now.year() - 1, now.year() - 2].map(y =>
                    <Option key={y} value={y}>{y}</Option>)}
                </Select>
              </div>
              <Button type="primary" icon={<CalculatorOutlined />} size="small"
                style={{ background: '#1B3A6B', width: '100%' }}
                loading={acting} onClick={handleGenerarBorrador}>
                Calcular borrador
              </Button>
            </Space>
          </Card>

          <Card size="small" title={<span style={{ fontSize: 12, fontWeight: 700 }}>Historial</span>}
            style={{ borderRadius: 8 }}>
            {loading
              ? <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
              : lista.length === 0
                ? <Text type="secondary" style={{ fontSize: 11 }}>Sin declaraciones aún</Text>
                : lista.map(r => (
                  <div key={r.id} onClick={() => selectDecl(r)}
                    style={{
                      padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                      background: selected?.id === r.id ? '#e6f4ff' : 'transparent',
                      border: selected?.id === r.id ? '1px solid #91caff' : '1px solid transparent',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 12 }}>{mesLabel(r.mes)} {r.anio}</Text>
                      <Tag color={STATUS_TAG[r.status]?.color ?? 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {STATUS_TAG[r.status]?.label ?? r.status}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>ISR det.</Text>
                      <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        Q {fmt(Number(r.impuestoDeterminado))}
                      </Text>
                    </div>
                    {Number(r.saldoAPagar) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>A pagar</Text>
                        <Text style={{ fontSize: 11, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                          Q {fmt(Number(r.saldoAPagar))}
                        </Text>
                      </div>
                    )}
                    {Number(r.excedenteParaSiguiente) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Excedente</Text>
                        <Text style={{ fontSize: 11, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                          Q {fmt(Number(r.excedenteParaSiguiente))}
                        </Text>
                      </div>
                    )}
                  </div>
                ))
            }
          </Card>
        </div>

        {/* ── Panel derecho: formulario ─────────────────────── */}
        {!selected
          ? (
            <Card style={{ borderRadius: 8, textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Selecciona un período o calcula un borrador nuevo.</Text>
            </Card>
          )
          : (
            <Card size="small" style={{ borderRadius: 8 }}
              title={
                <Space>
                  <Text strong style={{ color: '#1B3A6B' }}>{mesLabel(selected.mes)} {selected.anio}</Text>
                  <Tag color={STATUS_TAG[selected.status]?.color ?? 'default'}>
                    {STATUS_TAG[selected.status]?.label ?? selected.status}
                  </Tag>
                  {fechaLimite && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Plazo: {fechaLimite.format('DD/MM/YYYY')}
                    </Text>
                  )}
                </Space>
              }
              extra={
                <Space size={4}>
                  {!editing && selected.status !== 'presentada' && (
                    <Tooltip title="Editar valores manualmente">
                      <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)} />
                    </Tooltip>
                  )}
                  {editing && (
                    <>
                      <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>Cancelar</Button>
                      <Button size="small" type="primary" icon={<SaveOutlined />}
                        style={{ background: '#1B3A6B' }} loading={acting} onClick={handleGuardar}>
                        Guardar
                      </Button>
                    </>
                  )}
                  {!editing && selected.status !== 'presentada' && (
                    <Button size="small" icon={<FileProtectOutlined />} loading={acting} onClick={handlePoliza}>
                      Generar póliza
                    </Button>
                  )}
                  {!editing && selected.status === 'poliza_generada' && (
                    <Button size="small" icon={<SyncOutlined />} loading={acting} onClick={handleSincronizar}>
                      Sincronizar
                    </Button>
                  )}
                  {!editing && selected.status !== 'borrador' && selected.status !== 'presentada' && (
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                      style={{ background: '#2ea172' }} loading={acting} onClick={handlePresentada}>
                      Presentada
                    </Button>
                  )}
                  {selected.status === 'presentada' && (
                    <FileDoneOutlined style={{ fontSize: 16, color: '#2ea172' }} />
                  )}
                </Space>
              }
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', border: BD }}>
                <tbody>

                  {/* ── 1. NIT DEL CONTRIBUYENTE ─────────────────────── */}
                  <tr><td colSpan={2} style={SEC}>1. NIT DEL CONTRIBUYENTE *</td></tr>
                  <tr>
                    <td colSpan={2} style={{ ...CELL, textAlign: 'center', padding: '8px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{activeCompany?.taxId ?? '—'}</div>
                      <div style={{ fontWeight: 600, textTransform: 'uppercase', color: '#374151' }}>
                        {activeCompany?.legalName ?? ''}
                      </div>
                    </td>
                  </tr>

                  {/* ── 2. PERÍODO DE IMPOSICIÓN ─────────────────────── */}
                  <tr><td colSpan={2} style={SEC}>2. PERÍODO DE IMPOSICIÓN *</td></tr>
                  <tr>
                    <td colSpan={2} style={{ ...CELL, textAlign: 'center', padding: '6px 8px' }}>
                      MES:&nbsp;<strong>{mesLabel(selected.mes).toUpperCase()}</strong>
                      &nbsp;&nbsp;&nbsp;AÑO:&nbsp;<strong>{selected.anio}</strong>
                    </td>
                  </tr>

                  {/* ── 3. RENTA IMPONIBLE Y DETERMINACIÓN ───────────── */}
                  <tr><td colSpan={2} style={SEC}>3. RENTA IMPONIBLE Y DETERMINACIÓN DEL IMPUESTO</td></tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      Rentas de actividades lucrativas{editMark}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={liveRenta} onChange={setLiveRenta} /> : fmt(rentaBase)}
                    </td>
                  </tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (–) Monto total de rentas exentas{editMark}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={liveExentas} onChange={setLiveExentas} /> : fmt(exentasBase)}
                    </td>
                  </tr>

                  <tr>
                    <td style={SUB}>Renta imponible</td>
                    <td style={SNUM}>{fmt(editing ? liveImponible : imponibleBase)}</td>
                  </tr>

                  {/* Desglose tramos */}
                  {(editing
                    ? [{ base: liveTramo1, tasa: 0.05, imp: r2(liveTramo1 * 0.05) },
                       ...(liveTramo2 > 0 ? [{ base: liveTramo2, tasa: 0.07, imp: r2(liveTramo2 * 0.07) }] : [])]
                    : [tramo1Saved, ...(tramo2Saved ? [tramo2Saved] : [])]
                       .map(t => ({ base: t.base, tasa: t.tasa, imp: (t as any).imp ?? (t as any).impuesto ?? 0 }))
                  ).map((t, i) => (
                    <tr key={i} style={{ background: '#fafafa' }}>
                      <td style={{ ...CELL, paddingLeft: 20, color: '#6b7280', fontSize: 11 }}>
                        Base Q {fmt(t.base)} × {(t.tasa * 100).toFixed(0)}%
                      </td>
                      <td style={{ ...NUM, color: '#6b7280', fontSize: 11 }}>{fmt(t.imp)}</td>
                    </tr>
                  ))}

                  <tr>
                    <td style={SUB}>Impuesto determinado</td>
                    <td style={SNUM}>{fmt(editing ? liveImpuesto : impuestoBase)}</td>
                  </tr>

                  <tr><td colSpan={2}><Divider style={{ margin: '2px 0' }} /></td></tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (–) Valor de las retenciones que le practicaron en este período{editMark}
                      <div style={{ fontSize: 10, color: '#6b7280' }}>Cuenta 125003 — débitos del período</div>
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={liveRet} onChange={setLiveRet} /> : fmt(retBase)}
                    </td>
                  </tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (–) Remanente de retenciones del período anterior{editMark}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={liveRemanente} onChange={setLiveRemanente} /> : fmt(remanenteBase)}
                    </td>
                  </tr>

                  <tr>
                    <td style={SUB}>Saldo del impuesto a pagar (antes de ISO e incentivos)</td>
                    <td style={SNUM}>{fmt(editing ? Math.max(0, liveImpuesto - liveRet - liveRemanente) : saldoBase)}</td>
                  </tr>

                  {/* ── 3.1 INFORMACIÓN COMPLEMENTARIA ───────────────── */}
                  <tr><td colSpan={2} style={SEC2}>3.1 INFORMACIÓN COMPLEMENTARIA A RENTAS DE ACTIVIDADES LUCRATIVAS</td></tr>
                  <tr>
                    <td style={{ ...CELL, color: '#6b7280', fontSize: 11 }}>
                      Rentas de capital, facturas con retención definitiva
                    </td>
                    <td style={ZERO}>—</td>
                  </tr>
                  <tr>
                    <td style={{ ...CELL, color: '#6b7280', fontSize: 11 }}>
                      Rentas de capital, facturas con pago directo del impuesto
                    </td>
                    <td style={ZERO}>—</td>
                  </tr>
                  <tr>
                    <td style={{ ...CELL, color: '#6b7280', fontSize: 11 }}>
                      Otras rentas de capital sujetas a retención definitiva
                    </td>
                    <td style={ZERO}>—</td>
                  </tr>

                  {/* ── 4. LIQUIDACIÓN Y DETERMINACIÓN DEL IMPUESTO A PAGAR ── */}
                  <tr><td colSpan={2} style={SEC}>4. LIQUIDACIÓN Y DETERMINACIÓN DEL IMPUESTO A PAGAR</td></tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      Saldo del Impuesto de Solidaridad debidamente pagado en períodos anteriores{editMark}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing
                        ? <NI val={liveISOPagado} onChange={setLiveISOPagado} />
                        : fmt(isoPagadoBase)}
                    </td>
                  </tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (–) Acreditamiento del Impuesto de Solidaridad para este período{editMark}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing
                        ? <NI val={liveISOAcred} onChange={setLiveISOAcred} />
                        : fmt(isoAcredBase)}
                    </td>
                  </tr>

                  <tr>
                    <td style={CELL}>Saldo de Impuesto de Solidaridad por acreditar</td>
                    <td style={NUM}>{fmt(editing ? liveSaldoISO : saldoISOBase)}</td>
                  </tr>

                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>(–) Incentivos Fiscales, Dtos. 29-89, 65-89, 52-2003 y otros (Valor){editMark}</span>
                      </div>
                      {editing && (
                        <div style={{ marginTop: 4 }}>
                          <Input
                            size="small" placeholder="N.º Resolución de Incentivos Fiscales"
                            value={liveNumResolucion}
                            onChange={e => setLiveNumResolucion(e.target.value)}
                            style={{ fontSize: 11, width: 260 }}
                          />
                        </div>
                      )}
                      {!editing && numResBase && (
                        <div style={{ fontSize: 10, color: '#6b7280' }}>Resolución: {numResBase}</div>
                      )}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing
                        ? <NI val={liveIncentivos} onChange={setLiveIncentivos} />
                        : fmt(incentivosBase)}
                    </td>
                  </tr>

                  <tr><td colSpan={2}><Divider style={{ margin: '2px 0' }} /></td></tr>

                  {/* ── Resultado final ────────────────────────────────── */}
                  {(editing ? liveSaldo : saldoBase) > 0
                    ? (
                      <tr>
                        <td style={PCELL}>Impuesto a pagar</td>
                        <td style={PNUM}>Q {fmt(editing ? liveSaldo : saldoBase)}</td>
                      </tr>
                    )
                    : (
                      <tr>
                        <td style={GCELL}>Excedente de retenciones a aplicar en el período siguiente</td>
                        <td style={GNUM}>Q {fmt(editing ? liveExcedente : excedenteBase)}</td>
                      </tr>
                    )
                  }

                  <tr>
                    <td style={CELL}>Cantidad de Facturas emitidas incluyendo las anuladas</td>
                    <td style={NUM}>{selected.cantidadFacturas}</td>
                  </tr>

                </tbody>
              </table>

              {/* ── Pie: póliza + metadatos ───────────────────────── */}
              <div style={{ marginTop: 8, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Calculado: {dayjs(selected.updatedAt).format('DD/MM/YYYY HH:mm')}
                </Text>
              </div>

              {selected.polizaId && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', background: '#f0f5ff',
                  borderRadius: 6, border: '1px solid #adc6ff', fontSize: 12,
                }}>
                  <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>
                    Póliza contable — {STATUS_TAG[selected.status]?.label}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>
                      <Text type="secondary">ID: </Text>
                      <code style={{ fontSize: 11 }}>{selected.polizaId.slice(0, 8)}…</code>
                    </span>
                    <span>
                      <Text type="secondary">Débito 630013: </Text>
                      <strong>Q {fmt(Math.min(Number(selected.impuestoDeterminado), Number(selected.retencionesPeriodo) + Number(selected.remanenteAnterior)))}</strong>
                    </span>
                    <span>
                      <Text type="secondary">Crédito 125003: </Text>
                      <strong>Q {fmt(Math.min(Number(selected.impuestoDeterminado), Number(selected.retencionesPeriodo) + Number(selected.remanenteAnterior)))}</strong>
                    </span>
                  </div>
                </div>
              )}

              {saldoBase > 0 && (
                <div style={{
                  marginTop: 8, padding: '6px 10px', background: '#fff7e6',
                  borderRadius: 4, border: '1px solid #ffe58f', fontSize: 11, color: '#92400e',
                }}>
                  <strong>Impuesto a pagar:</strong> Q {fmt(saldoBase)} — registrar pago bancario a SAT el día 10 del siguiente mes.
                </div>
              )}
            </Card>
          )
        }
      </div>
    </div>
  )
}
