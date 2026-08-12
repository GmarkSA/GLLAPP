import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  Card, Select, Button, Space, Tag, Typography, Table,
  InputNumber, Tooltip, message, Spin, Badge, Divider,
} from 'antd'
import {
  CalculatorOutlined, FileProtectOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined, CloseOutlined, FileDoneOutlined,
  ArrowLeftOutlined,
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
const CELL: CSSProperties = { padding: '3px 8px', borderBottom: BD, fontSize: 12, verticalAlign: 'middle' }
const NUM:  CSSProperties = { ...CELL, textAlign: 'right', width: 130, borderLeft: BD, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const SEC:  CSSProperties = { padding: '4px 8px', background: '#1B3A6B', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, borderBottom: BD }
const CHD:  CSSProperties = { ...NUM, background: '#1B3A6B', color: '#fff', fontWeight: 700, textAlign: 'center', borderBottom: BD }
const SUB:  CSSProperties = { ...CELL, background: '#eef2fb', fontWeight: 700 }
const SNUM: CSSProperties = { ...NUM,  background: '#eef2fb', fontWeight: 700 }
const ECELL:CSSProperties = { ...CELL, background: '#fffbe6' }
const ENUM: CSSProperties = { ...NUM,  background: '#fffbe6' }
const PCELL:CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const PNUM: CSSProperties = { ...NUM,  background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }

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

const calcIsr = (rentaImponible: number) =>
  rentaImponible <= 0 ? 0 : rentaImponible <= 30000
    ? r2(rentaImponible * 0.05)
    : r2(rentaImponible * 0.07)

interface NiProps { val: number; onChange: (v: number) => void }
function NI({ val, onChange }: NiProps) {
  return (
    <InputNumber
      size="small" value={val} min={0} step={0.01}
      formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      parser={v => Number(String(v).replace(/,/g, ''))}
      onChange={v => onChange(Number(v ?? 0))}
      style={{ width: 126, textAlign: 'right', fontSize: 12 }}
    />
  )
}

export default function Declaracion1311Page() {
  const navigate  = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const companyId = activeCompany?.id

  const now = dayjs()
  const [mes,  setMes]  = useState(now.month() + 1)
  const [anio, setAnio] = useState(now.year())

  const [lista,    setLista]    = useState<DeclaracionIsr[]>([])
  const [loading,  setLoading]  = useState(false)
  const [acting,   setActing]   = useState(false)
  const [selected, setSelected] = useState<DeclaracionIsr | null>(null)
  const [editing,  setEditing]  = useState(false)

  // Campos editables en modo edición
  const [liveRenta,     setLiveRenta]     = useState(0)
  const [liveExentas,   setLiveExentas]   = useState(0)
  const [liveRet,       setLiveRet]       = useState(0)
  const [liveRemanente, setLiveRemanente] = useState(0)

  const cargarLista = useCallback(async () => {
    setLoading(true)
    try { setLista(await getDeclaracionesIsr()) }
    catch { setLista([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargarLista() }, [cargarLista])

  const syncEdit = (d: DeclaracionIsr) => {
    setLiveRenta(r2(Number(d.rentaActividadesLucrativas ?? 0)))
    setLiveExentas(r2(Number(d.rentasExentas ?? 0)))
    setLiveRet(r2(Number(d.retencionesPeriodo ?? 0)))
    setLiveRemanente(r2(Number(d.remanenteAnterior ?? 0)))
  }

  const selectDecl = (d: DeclaracionIsr) => {
    setSelected(d); setEditing(false); syncEdit(d)
  }

  // Cálculos en vivo (modo edición)
  const liveImponible = r2(liveRenta - liveExentas)
  const liveImpuesto  = calcIsr(liveImponible)
  const liveSaldoBruto = r2(liveImpuesto - liveRet - liveRemanente)
  const liveSaldo      = r2(Math.max(0, liveSaldoBruto))
  const liveExcedente  = r2(Math.max(0, -liveSaldoBruto))
  const liveTasa       = liveImponible <= 30000 ? '5%' : '7%'

  // Valores actuales del registro guardado
  const rentaBase = r2(Number(selected?.rentaActividadesLucrativas ?? 0))
  const exentasBase = r2(Number(selected?.rentasExentas ?? 0))
  const imponibleBase = r2(Number(selected?.rentaImponible ?? 0))
  const impuestoBase = r2(Number(selected?.impuestoDeterminado ?? 0))
  const retencionesBase = r2(Number(selected?.retencionesPeriodo ?? 0))
  const remanenteBase = r2(Number(selected?.remanenteAnterior ?? 0))
  const saldoBase = r2(Number(selected?.saldoAPagar ?? 0))
  const excedenteBase = r2(Number(selected?.excedenteParaSiguiente ?? 0))

  const editMark = editing ? <span style={{ color: '#d48806', fontSize: 10, marginLeft: 4 }}>✎</span> : null

  // Fecha límite de presentación: 10 días hábiles desde cierre de mes
  const fechaLimite = selected
    ? addBusinessDays(dayjs(`${selected.anio}-${String(selected.mes).padStart(2, '0')}-01`).endOf('month'), 10)
    : null

  const handleGenerarBorrador = async () => {
    setActing(true)
    try {
      const d = await generarBorradorIsr(mes, anio)
      await cargarLista()
      selectDecl(d)
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
        rentasExentas: liveExentas,
        retencionesPeriodo: liveRet,
        remanenteAnterior: liveRemanente,
      })
      await cargarLista()
      selectDecl(d)
      setEditing(false)
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
      await cargarLista()
      selectDecl(d)
      message.success('Póliza borrador generada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al generar póliza')
    } finally { setActing(false) }
  }

  const handleSincronizar = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await sincronizarEstadoIsr(selected.id)
      await cargarLista()
      selectDecl(d)
    } catch { } finally { setActing(false) }
  }

  const handlePresentada = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await marcarIsrPresentada(selected.id)
      await cargarLista()
      selectDecl(d)
      message.success('Declaración marcada como presentada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setActing(false) }
  }

  const cancelEdit = () => {
    if (selected) syncEdit(selected)
    setEditing(false)
  }

  // ── Tabla de historial ────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Período', dataIndex: 'mes', width: 100,
      render: (_: any, r: DeclaracionIsr) =>
        `${MESES.find(m => m.value === r.mes)?.label ?? r.mes} ${r.anio}`,
    },
    {
      title: 'ISR det.', dataIndex: 'impuestoDeterminado', width: 110, align: 'right' as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>Q {fmt(Number(v))}</Text>,
    },
    {
      title: 'Saldo', dataIndex: 'saldoAPagar', width: 110, align: 'right' as const,
      render: (v: number, r: DeclaracionIsr) => {
        const saldo = Number(r.saldoAPagar)
        const exc   = Number(r.excedenteParaSiguiente)
        if (exc > 0) return <Text style={{ color: '#2ea172', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>+Q {fmt(exc)}</Text>
        return <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>Q {fmt(saldo)}</Text>
      },
    },
    {
      title: 'Estado', dataIndex: 'status', width: 120,
      render: (v: string) => {
        const s = STATUS_TAG[v] ?? { color: 'default', label: v }
        return <Tag color={s.color} style={{ fontSize: 11 }}>{s.label}</Tag>
      },
    },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Panel izquierdo — selector + historial */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Select value={mes} onChange={setMes} size="small" style={{ width: '100%' }}>
                  {MESES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
                </Select>
                <Select value={anio} onChange={setAnio} size="small" style={{ width: '100%' }}>
                  {[now.year(), now.year() - 1, now.year() - 2].map(y =>
                    <Option key={y} value={y}>{y}</Option>)}
                </Select>
              </div>
              <Button
                type="primary" icon={<CalculatorOutlined />} size="small"
                style={{ background: '#1B3A6B', width: '100%' }}
                loading={acting} onClick={handleGenerarBorrador}
              >
                Calcular borrador
              </Button>
            </Space>
          </Card>

          <Card size="small" title={<span style={{ fontSize: 12 }}>Historial</span>}
            style={{ borderRadius: 8 }}>
            {loading
              ? <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
              : lista.length === 0
                ? <Text type="secondary" style={{ fontSize: 12 }}>Sin declaraciones aún</Text>
                : <Table
                    dataSource={lista} columns={columns} rowKey="id" size="small"
                    pagination={false} showHeader={false}
                    onRow={r => ({
                      onClick: () => selectDecl(r),
                      style: {
                        cursor: 'pointer',
                        background: selected?.id === r.id ? '#e6f4ff' : undefined,
                        fontWeight: selected?.id === r.id ? 600 : undefined,
                      },
                    })}
                    rowClassName={r => selected?.id === r.id ? 'isr-row-selected' : ''}
                  />
            }
          </Card>
        </div>

        {/* Panel derecho — formulario */}
        <div>
          {!selected
            ? (
              <Card style={{ borderRadius: 8, textAlign: 'center', padding: 40 }}>
                <Text type="secondary">Selecciona un período del historial o calcula un borrador nuevo.</Text>
              </Card>
            )
            : (
              <Card size="small" style={{ borderRadius: 8 }}
                title={
                  <Space>
                    <span style={{ fontWeight: 700, color: '#1B3A6B' }}>
                      {MESES.find(m => m.value === selected.mes)?.label} {selected.anio}
                    </span>
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
                      <Tooltip title="Generar póliza contable borrador">
                        <Button size="small" icon={<FileProtectOutlined />}
                          loading={acting} onClick={handlePoliza}>
                          Generar póliza
                        </Button>
                      </Tooltip>
                    )}
                    {!editing && selected.status === 'poliza_generada' && (
                      <Tooltip title="Sincronizar estado con asiento contable">
                        <Button size="small" loading={acting} onClick={handleSincronizar}>
                          Sincronizar
                        </Button>
                      </Tooltip>
                    )}
                    {!editing && selected.status !== 'borrador' && selected.status !== 'presentada' && (
                      <Tooltip title="Marcar como presentada al SAT">
                        <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                          style={{ background: '#2ea172' }} loading={acting} onClick={handlePresentada}>
                          Presentada
                        </Button>
                      </Tooltip>
                    )}
                    {selected.status === 'presentada' && (
                      <Badge dot color="#2ea172">
                        <FileDoneOutlined style={{ fontSize: 16, color: '#2ea172' }} />
                      </Badge>
                    )}
                  </Space>
                }
              >
                {/* Tabla SAT-1311 */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: BD }}>
                  <thead>
                    <tr>
                      <th style={SEC}>Concepto</th>
                      <th style={CHD}>Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sección 1: Renta */}
                    <tr>
                      <td style={CELL}>
                        Renta de actividades lucrativas{editMark}
                      </td>
                      <td style={editing ? ENUM : NUM}>
                        {editing
                          ? <NI val={liveRenta} onChange={setLiveRenta} />
                          : fmt(rentaBase)
                        }
                      </td>
                    </tr>
                    <tr>
                      <td style={CELL}>
                        (–) Rentas exentas{editMark}
                      </td>
                      <td style={editing ? ENUM : NUM}>
                        {editing
                          ? <NI val={liveExentas} onChange={setLiveExentas} />
                          : fmt(exentasBase)
                        }
                      </td>
                    </tr>

                    {/* Renta imponible */}
                    <tr>
                      <td style={SUB}>Renta imponible</td>
                      <td style={SNUM}>{fmt(editing ? liveImponible : imponibleBase)}</td>
                    </tr>

                    {/* ISR determinado */}
                    <tr>
                      <td style={CELL}>
                        <span>ISR determinado</span>
                        <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
                          (tasa {editing ? liveTasa : (imponibleBase <= 30000 ? '5%' : '7%')})
                        </span>
                      </td>
                      <td style={NUM}>{fmt(editing ? liveImpuesto : impuestoBase)}</td>
                    </tr>

                    <tr><td colSpan={2}><Divider style={{ margin: '4px 0' }} /></td></tr>

                    {/* Retenciones */}
                    <tr>
                      <td style={CELL}>
                        (–) Retenciones ISR practicadas en el período{editMark}
                        <div style={{ fontSize: 10, color: '#6b7280' }}>Cuenta 125003 — clientes que retuvieron ISR</div>
                      </td>
                      <td style={editing ? ENUM : NUM}>
                        {editing
                          ? <NI val={liveRet} onChange={setLiveRet} />
                          : fmt(retencionesBase)
                        }
                      </td>
                    </tr>

                    {/* Remanente período anterior */}
                    <tr>
                      <td style={CELL}>
                        (–) Remanente / excedente del período anterior{editMark}
                      </td>
                      <td style={editing ? ENUM : NUM}>
                        {editing
                          ? <NI val={liveRemanente} onChange={setLiveRemanente} />
                          : fmt(remanenteBase)
                        }
                      </td>
                    </tr>

                    <tr><td colSpan={2}><Divider style={{ margin: '4px 0' }} /></td></tr>

                    {/* Saldo a pagar / Excedente */}
                    {(editing ? liveSaldo : saldoBase) > 0
                      ? (
                        <tr>
                          <td style={PCELL}>TOTAL A PAGAR A LA SAT</td>
                          <td style={PNUM}>Q {fmt(editing ? liveSaldo : saldoBase)}</td>
                        </tr>
                      )
                      : (
                        <tr>
                          <td style={{ ...SUB, color: '#2ea172' }}>Excedente para el período siguiente</td>
                          <td style={{ ...SNUM, color: '#2ea172' }}>Q {fmt(editing ? liveExcedente : excedenteBase)}</td>
                        </tr>
                      )
                    }
                  </tbody>
                </table>

                {/* Detalle: número de facturas y tasas */}
                <div style={{ marginTop: 10, display: 'flex', gap: 24 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Facturas: <strong>{selected.cantidadFacturas}</strong>
                  </Text>
                  {selected.polizaId && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Póliza: <strong>{selected.polizaId.slice(0, 8)}…</strong>
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Calculado: {dayjs(selected.updatedAt).format('DD/MM/YYYY HH:mm')}
                  </Text>
                </div>

                {/* Nota si hay saldo a pagar */}
                {saldoBase > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: '#fff7e6', borderRadius: 4, border: '1px solid #ffe58f', fontSize: 11, color: '#92400e' }}>
                    <strong>Saldo a pagar:</strong> Q {fmt(saldoBase)} — registrar pago bancario a SAT el día 10 del siguiente mes.
                  </div>
                )}
              </Card>
            )
          }
        </div>
      </div>
    </div>
  )
}
