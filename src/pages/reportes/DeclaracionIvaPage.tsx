import { useState, useEffect, type CSSProperties } from 'react'
import {
  Card, Select, Button, Space, Tag, Typography, Table,
  InputNumber, Tooltip, message, Spin, Badge, Divider,
} from 'antd'
import {
  CalculatorOutlined, FileProtectOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined, CloseOutlined, FileDoneOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCompanyStore } from '../../store/companyStore'
import {
  type DeclaracionIva,
  getDeclaracionesIva, generarBorradorIva,
  generarPolizaBorradorIva, marcarIvaPresentada, actualizarDeclaracionIva,
} from '../../api/reportes'

const { Title, Text } = Typography
const { Option } = Select

// ─── Estilos de tabla ────────────────────────────────────────────────────────

const BORDER = '1px solid #d0d5dd'

const CELL: CSSProperties = {
  padding: '3px 8px',
  borderBottom: BORDER,
  fontSize: 12,
  verticalAlign: 'middle',
  color: '#111',
}

const NUM_CELL: CSSProperties = {
  ...CELL,
  textAlign: 'right',
  width: 110,
  borderLeft: BORDER,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const SEC_HDR: CSSProperties = {
  padding: '4px 8px',
  background: '#1B3A6B',
  color: '#fff',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: 0.3,
  borderBottom: BORDER,
}

const COL_HDR: CSSProperties = {
  padding: '4px 8px',
  background: '#1B3A6B',
  color: '#fff',
  fontWeight: 700,
  fontSize: 11,
  textAlign: 'center',
  width: 110,
  borderLeft: BORDER,
  borderBottom: BORDER,
}

const SUBTOTAL_CELL: CSSProperties = { ...CELL, background: '#eef2fb', fontWeight: 700 }
const SUBTOTAL_NUM:  CSSProperties = { ...NUM_CELL, background: '#eef2fb', fontWeight: 700 }
const EDIT_CELL: CSSProperties = { ...CELL, background: '#fffbe6' }
const EDIT_NUM:  CSSProperties = { ...NUM_CELL, background: '#fffbe6' }
const PAY_CELL:  CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const PAY_NUM:   CSSProperties = { ...NUM_CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }

// ─── Constantes ──────────────────────────────────────────────────────────────

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

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface EditValues {
  baseVentas:       number
  ivaDebitoFiscal:  number
  baseCompras:      number
  ivaCreditoFiscal: number
  retencionIva:     number
}

const EMPTY_EDIT: EditValues = {
  baseVentas: 0, ivaDebitoFiscal: 0, baseCompras: 0, ivaCreditoFiscal: 0, retencionIva: 0,
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function DeclaracionIvaPage() {
  const now = dayjs()
  const activeCompany = useCompanyStore(s => s.activeCompany)

  const [mes,  setMes]  = useState<number>(now.month() + 1)
  const [anio, setAnio] = useState<number>(now.year())
  const [decl,  setDecl]  = useState<DeclaracionIva | null>(null)
  const [lista, setLista] = useState<DeclaracionIva[]>([])
  const [loading,     setLoading]     = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [editValues, setEditValues] = useState<EditValues>(EMPTY_EDIT)

  useEffect(() => {
    getDeclaracionesIva()
      .then(d => {
        setLista(d)
        const found = d.find(x => x.mes === mes && x.anio === anio)
        if (found) { setDecl(found); syncEdit(found) }
      })
      .catch(() => {})
  }, [])

  const syncEdit = (d: DeclaracionIva) => setEditValues({
    baseVentas:       Number(d.baseVentas),
    ivaDebitoFiscal:  Number(d.ivaDebitoFiscal),
    baseCompras:      Number(d.baseCompras),
    ivaCreditoFiscal: Number(d.ivaCreditoFiscal),
    retencionIva:     Number(d.retencionIva),
  })

  const updateDecl = (result: DeclaracionIva) => {
    setDecl(result)
    syncEdit(result)
    setLista(prev => {
      const idx = prev.findIndex(x => x.id === result.id)
      return idx >= 0 ? prev.map((x, i) => i === idx ? result : x) : [result, ...prev]
    })
  }

  const catchMsg = (e: any, fallback: string) => {
    const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? fallback
    message.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }

  const handleCalcular = async () => {
    setCalcLoading(true)
    try {
      const result = await generarBorradorIva(mes, anio)
      updateDecl(result)
      setEditing(false)
      message.success('Borrador calculado correctamente')
    } catch (e: any) {
      catchMsg(e, 'Error al calcular')
    } finally {
      setCalcLoading(false)
    }
  }

  const handleEditar = () => { if (decl) { syncEdit(decl); setEditing(true) } }
  const handleCancelar = () => { if (decl) syncEdit(decl); setEditing(false) }

  const handleGuardar = async () => {
    if (!decl) return
    setSaveLoading(true)
    try {
      const result = await actualizarDeclaracionIva(decl.id, editValues)
      updateDecl(result)
      setEditing(false)
      message.success(result.polizaId ? 'Valores actualizados y póliza regenerada' : 'Valores actualizados')
    } catch (e: any) {
      catchMsg(e, 'Error al guardar')
    } finally {
      setSaveLoading(false)
    }
  }

  const handlePoliza = async () => {
    if (!decl) return
    setLoading(true)
    try {
      const result = await generarPolizaBorradorIva(decl.id)
      updateDecl(result)
      message.success('Póliza borrador generada — revísela en Contabilidad')
    } catch (e: any) {
      catchMsg(e, 'Error al generar póliza')
    } finally {
      setLoading(false)
    }
  }

  const handlePresentada = async () => {
    if (!decl) return
    setLoading(true)
    try {
      const result = await marcarIvaPresentada(decl.id)
      updateDecl(result)
      message.success('Declaración marcada como presentada')
    } catch (e: any) {
      catchMsg(e, 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHistorial = (record: DeclaracionIva) => {
    setMes(record.mes); setAnio(record.anio)
    setDecl(record); syncEdit(record); setEditing(false)
  }

  // ─── Valores en vivo (se actualizan mientras el usuario edita) ───────────

  const liveBaseV   = editing ? editValues.baseVentas       : Number(decl?.baseVentas ?? 0)
  const liveDebito  = editing ? editValues.ivaDebitoFiscal  : Number(decl?.ivaDebitoFiscal ?? 0)
  const liveBaseC   = editing ? editValues.baseCompras      : Number(decl?.baseCompras ?? 0)
  const liveCredito = editing ? editValues.ivaCreditoFiscal : Number(decl?.ivaCreditoFiscal ?? 0)
  const liveRet     = editing ? editValues.retencionIva     : Number(decl?.retencionIva ?? 0)
  const liveNeto    = liveDebito - liveCredito   // positivo = pagar; negativo = crédito acumulado
  const livePagar   = Math.max(0, liveNeto) - liveRet

  const snapshot   = decl?.snapshot ?? {}
  const mesNombre  = MESES.find(m => m.value === mes)?.label ?? ''
  const anioOptions = Array.from({ length: 5 }, (_, i) => now.year() - i)
  const fechaVenc  = dayjs().year(anio).month(mes - 1).add(1, 'month').startOf('month').format('DD/MM/YYYY')

  // InputNumber para celdas editables
  const NumInput = ({ field }: { field: keyof EditValues }) => (
    <InputNumber
      size="small"
      value={editValues[field]}
      onChange={v => setEditValues(prev => ({ ...prev, [field]: v ?? 0 }))}
      min={0}
      precision={2}
      controls={false}
      style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
    />
  )

  // Celda de valor — editable o texto
  const ValCell = ({
    field, style, numStyle, always,
  }: {
    field: keyof EditValues
    style: CSSProperties
    numStyle: CSSProperties
    always?: boolean  // mostrar siempre el valor aunque sea 0
  }) => {
    const val = field === 'baseVentas'       ? liveBaseV
              : field === 'ivaDebitoFiscal'  ? liveDebito
              : field === 'baseCompras'      ? liveBaseC
              : field === 'ivaCreditoFiscal' ? liveCredito
              : liveRet
    return (
      <td style={editing ? EDIT_NUM : numStyle}>
        {editing ? <NumInput field={field} /> : (always || val !== 0 ? fmt(val) : '')}
      </td>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 0 }}>Declaración IVA — SAT Formulario 2237</Title>
      <Text type="secondary">Impuesto al Valor Agregado · Régimen General · Declaración jurada mensual</Text>
      <Divider style={{ margin: '12px 0' }} />

      {/* Selector de período */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Período:</Text>
          <Select value={mes} onChange={v => { setMes(v); setEditing(false) }} style={{ width: 140 }}>
            {MESES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
          </Select>
          <Select value={anio} onChange={v => { setAnio(v); setEditing(false) }} style={{ width: 90 }}>
            {anioOptions.map(y => <Option key={y} value={y}>{y}</Option>)}
          </Select>
          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            loading={calcLoading}
            onClick={handleCalcular}
            style={{ background: '#1B3A6B' }}
          >
            Calcular del sistema
          </Button>
          {decl && (
            <Tag color={STATUS_TAG[decl.status]?.color} style={{ fontSize: 13, padding: '2px 10px' }}>
              {STATUS_TAG[decl.status]?.label}
            </Tag>
          )}
        </Space>
      </Card>

      {decl ? (
        <Spin spinning={loading || saveLoading}>

          {/* ═══ FORMULARIO SAT-2237 ═════════════════════════════════════ */}
          <div style={{ border: BORDER, background: '#fff', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <tbody>

                {/* ── Encabezado ── */}
                <tr>
                  <td colSpan={3} style={{ padding: '10px 16px', background: '#f5f7ff', borderBottom: BORDER }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1B3A6B' }}>IVA GENERAL</div>
                        <div style={{ fontSize: 11, color: '#555' }}>
                          Impuesto al Valor Agregado · Régimen General<br />
                          Declaración jurada y pago mensual
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#1B3A6B' }}>SAT-2237</div>
                        <Tag color={STATUS_TAG[decl.status]?.color}>{STATUS_TAG[decl.status]?.label}</Tag>
                      </div>
                    </div>
                  </td>
                </tr>

                {/* ── Sección 1: NIT ── */}
                <tr><td colSpan={3} style={SEC_HDR}>1. NIT DEL CONTRIBUYENTE</td></tr>
                <tr>
                  <td colSpan={3} style={{ ...CELL, textAlign: 'center', padding: '8px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{activeCompany?.taxId ?? '—'}</div>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                      {activeCompany?.legalName ?? ''}
                    </div>
                  </td>
                </tr>

                {/* ── Sección 2: Período ── */}
                <tr><td colSpan={3} style={SEC_HDR}>2. PERÍODO DE IMPOSICIÓN</td></tr>
                <tr>
                  <td colSpan={3} style={{ ...CELL, textAlign: 'center', padding: '6px 8px' }}>
                    MES:&nbsp;<strong>{mesNombre.toUpperCase()}</strong>
                    &nbsp;&nbsp;&nbsp;
                    AÑO:&nbsp;<strong>{anio}</strong>
                  </td>
                </tr>

                {/* ── Sección 3: Débito Fiscal ── */}
                <tr>
                  <td style={SEC_HDR}>3. DÉBITO FISCAL POR OPERACIONES LOCALES</td>
                  <td style={COL_HDR}>BASE</td>
                  <td style={COL_HDR}>DÉBITOS</td>
                </tr>
                <tr>
                  <td style={CELL}>Ventas exentas y servicios exentos</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Ventas de medicamentos genéricos, alternativos y antirretrovirales</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Ventas no afectas realizadas a contribuyentes calificados con el Decreto No. 29-89</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Ventas gravadas</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={editing ? EDIT_CELL : CELL}>
                    Servicios gravados
                    {editing && <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>▼ editable</span>}
                  </td>
                  <ValCell field="baseVentas"      style={CELL}     numStyle={NUM_CELL} always />
                  <ValCell field="ivaDebitoFiscal" style={CELL}     numStyle={NUM_CELL} always />
                </tr>
                <tr>
                  <td style={SUBTOTAL_CELL}>Sumatoria de las columnas BASE y DÉBITOS</td>
                  <td style={SUBTOTAL_NUM}>{fmt(liveBaseV)}</td>
                  <td style={SUBTOTAL_NUM}>{fmt(liveDebito)}</td>
                </tr>

                {/* ── Sección 5: Crédito Fiscal ── */}
                <tr>
                  <td style={SEC_HDR}>5. CRÉDITO FISCAL POR OPERACIONES LOCALES</td>
                  <td style={COL_HDR}>BASE</td>
                  <td style={COL_HDR}>CRÉDITOS</td>
                </tr>
                <tr>
                  <td style={CELL}>Compras y servicios adquiridos de pequeños contribuyentes</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Compras que no generan derecho a compensación del crédito fiscal</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Compras de combustibles</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={editing ? EDIT_CELL : CELL}>
                    Otras compras
                    {editing && <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>▼ editable</span>}
                  </td>
                  <ValCell field="baseCompras"      style={CELL}     numStyle={NUM_CELL} always />
                  <ValCell field="ivaCreditoFiscal" style={CELL}     numStyle={NUM_CELL} always />
                </tr>
                <tr>
                  <td style={CELL}>Servicios adquiridos</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Importaciones de Centro América</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Importaciones del resto del mundo</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Compras de activos fijos directamente vinculados con el proceso productivo</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>IVA conforme constancias de exención recibidas</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={CELL}>Remanente de crédito fiscal del período anterior</td>
                  <td style={NUM_CELL}></td><td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td style={SUBTOTAL_CELL}>Sumatoria de las columnas BASE y CRÉDITOS</td>
                  <td style={SUBTOTAL_NUM}>{fmt(liveBaseC)}</td>
                  <td style={SUBTOTAL_NUM}>{fmt(liveCredito)}</td>
                </tr>

                {/* ── Sección 7: Determinación ── */}
                <tr><td colSpan={3} style={SEC_HDR}>7. DETERMINACIÓN DEL CRÉDITO FISCAL O IMPUESTO A PAGAR</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>
                    Crédito fiscal para el período siguiente por <strong>operaciones locales</strong> (Créditos mayor que Débitos)
                  </td>
                  <td style={NUM_CELL}>{liveNeto < 0 ? fmt(Math.abs(liveNeto)) : ''}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...CELL, fontWeight: 700 }}>
                    IMPUESTO TOTAL DETERMINADO (Débitos mayor que Créditos) <strong>Operaciones locales</strong>
                  </td>
                  <td style={{ ...NUM_CELL, fontWeight: 700 }}>{liveNeto > 0 ? fmt(liveNeto) : ''}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...CELL, fontWeight: 700 }}>SALDO DEL IMPUESTO</td>
                  <td style={{ ...NUM_CELL, fontWeight: 700 }}>{fmt(Math.max(0, liveNeto))}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Remanente de retenciones del IVA del período anterior</td>
                  <td style={NUM_CELL}></td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(=) Remanente de retenciones del IVA recibidas en el período</td>
                  <td style={NUM_CELL}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={editing ? EDIT_CELL : CELL}>
                    (-) Constancias de retenciones del IVA recibidas en el período a declarar
                    {editing && <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>▼ editable</span>}
                  </td>
                  <ValCell field="retencionIva" style={CELL} numStyle={NUM_CELL} />
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Saldo de retenciones para el período siguiente</td>
                  <td style={NUM_CELL}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={PAY_CELL}>IMPUESTO A PAGAR</td>
                  <td style={PAY_NUM}>{fmt(Math.max(0, livePagar))}</td>
                </tr>

                {/* ── Sección 8: Indicadores ── */}
                <tr><td colSpan={3} style={SEC_HDR}>8. INDICADORES COMERCIALES</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>Indicadores comerciales, base débitos menos base créditos</td>
                  <td style={NUM_CELL}>{fmt(liveBaseV - liveBaseC)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Razón ventas y compras, base débitos dividido base créditos</td>
                  <td style={NUM_CELL}>
                    {liveBaseC > 0 ? (liveBaseV / liveBaseC).toFixed(2) : '0.00'}
                  </td>
                </tr>

                {/* ── Sección 9: Cantidad de Operaciones ── */}
                <tr>
                  <td style={SEC_HDR}>9.1 CANTIDAD DE OPERACIONES REALIZADAS</td>
                  <td style={COL_HDR}>EMITIDAS</td>
                  <td style={COL_HDR}>RECIBIDAS</td>
                </tr>
                <tr>
                  <td style={CELL}>Facturas (incluir las anuladas)</td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}>{snapshot?.ventas?.count ?? 0}</td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}>{snapshot?.compras?.count ?? 0}</td>
                </tr>
                <tr>
                  <td style={CELL}>Facturas especiales</td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}></td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}></td>
                </tr>
                <tr>
                  <td style={CELL}>Notas de crédito</td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}></td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}></td>
                </tr>
                <tr>
                  <td style={CELL}>Notas de débito</td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}></td>
                  <td style={{ ...NUM_CELL, textAlign: 'center' }}></td>
                </tr>

                {/* ── Sección 11: Accesorios ── */}
                <tr><td colSpan={3} style={SEC_HDR}>11. ACCESORIOS</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>
                    <span style={{ fontWeight: 600 }}>Fecha máxima de pago sin accesorios</span>
                    <br />
                    <span style={{ fontSize: 11, color: '#666' }}>Fecha de vencimiento según calendario tributario</span>
                  </td>
                  <td style={{ ...NUM_CELL, fontWeight: 600 }}>{fechaVenc}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(+) Multa formal (por presentación extemporánea)</td>
                  <td style={NUM_CELL}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(+) Intereses</td>
                  <td style={NUM_CELL}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(+) Mora</td>
                  <td style={NUM_CELL}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={PAY_CELL}>TOTAL A PAGAR</td>
                  <td style={PAY_NUM}>{fmt(Math.max(0, livePagar))}</td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* ═══ Botones de acción ══════════════════════════════════════ */}
          <Space wrap style={{ marginBottom: 24 }}>
            {!editing ? (
              <>
                {decl.status !== 'presentada' && (
                  <Button icon={<EditOutlined />} onClick={handleEditar}>
                    Editar valores
                  </Button>
                )}
                {decl.status !== 'presentada' && (
                  <Button
                    type="primary"
                    icon={<FileDoneOutlined />}
                    onClick={handlePoliza}
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
                <Tooltip title="Recalcular tomando los datos actualizados del libro de ventas y compras del sistema">
                  <Button icon={<CalculatorOutlined />} onClick={handleCalcular} loading={calcLoading}>
                    Recalcular del sistema
                  </Button>
                </Tooltip>
                {decl.polizaId && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Póliza: <code>{decl.polizaId.slice(0, 8)}…</code>
                  </Text>
                )}
              </>
            ) : (
              <>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saveLoading}
                  onClick={handleGuardar}
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  Guardar ajustes{decl.polizaId ? ' y regenerar póliza' : ''}
                </Button>
                <Button icon={<CloseOutlined />} onClick={handleCancelar}>
                  Cancelar
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Modo edición — modifique los valores resaltados en amarillo
                </Text>
              </>
            )}
          </Space>

        </Spin>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <FileProtectOutlined style={{ fontSize: 48, color: '#d1d5db' }} />
          <div style={{ marginTop: 12, color: '#6b7280' }}>
            Seleccione el período y presione <strong>Calcular del sistema</strong> para generar el borrador de declaración IVA.
          </div>
        </Card>
      )}

      {/* ═══ Historial ══════════════════════════════════════════════════ */}
      {lista.length > 0 && (
        <Card size="small" title="Historial de Declaraciones" style={{ marginTop: 8 }}>
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
                render: v => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.label}</Tag>,
              },
              {
                title: 'Débito Fiscal', dataIndex: 'ivaDebitoFiscal', align: 'right',
                render: v => fmt(Number(v)),
              },
              {
                title: 'Crédito Fiscal', dataIndex: 'ivaCreditoFiscal', align: 'right',
                render: v => fmt(Number(v)),
              },
              {
                title: 'IVA Neto', dataIndex: 'ivaNeto', align: 'right',
                render: v => {
                  const n = Number(v)
                  return (
                    <Text strong style={{ color: n < 0 ? '#059669' : '#dc2626' }}>
                      {fmt(Math.abs(n))}
                    </Text>
                  )
                },
              },
              {
                title: 'Póliza', dataIndex: 'polizaId', width: 70, align: 'center',
                render: v => v ? <Badge status="success" text="Sí" /> : <Badge status="default" text="No" />,
              },
              {
                title: 'Actualizado', dataIndex: 'updatedAt', width: 110,
                render: v => dayjs(v).format('DD/MM/YYYY'),
              },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
