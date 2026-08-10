import { useState, useEffect, useCallback, type CSSProperties } from 'react'
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

const BD = '1px solid #d0d5dd'
const CELL:  CSSProperties = { padding: '3px 8px', borderBottom: BD, fontSize: 12, verticalAlign: 'middle' }
const NUM:   CSSProperties = { ...CELL, textAlign: 'right', width: 112, borderLeft: BD, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const SEC:   CSSProperties = { padding: '4px 8px', background: '#1B3A6B', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, borderBottom: BD }
const CHD:   CSSProperties = { ...NUM, background: '#1B3A6B', color: '#fff', fontWeight: 700, textAlign: 'center', borderBottom: BD }
const SUB:   CSSProperties = { ...CELL, background: '#eef2fb', fontWeight: 700 }
const SNUM:  CSSProperties = { ...NUM,  background: '#eef2fb', fontWeight: 700 }
const ECELL: CSSProperties = { ...CELL, background: '#fffbe6' }
const ENUM:  CSSProperties = { ...NUM,  background: '#fffbe6' }
const PCELL: CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const PNUM:  CSSProperties = { ...NUM,  background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }

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

interface CatBI { base: number; iva: number }
interface CatB  { base: number }

interface EditVentas {
  exento:      CatB
  bienes:      CatBI
  servicios:   CatBI
  exportacion: CatBI
}
interface EditCompras {
  pequenoContribuyente: CatB
  bienes:      CatBI
  servicios:   CatBI
  combustibles: CatBI
  importacion: CatBI
  retencionIva: number
}
interface EditValues { ventas: EditVentas; compras: EditCompras }

const EMPTY_V: EditVentas = {
  exento: { base: 0 }, bienes: { base: 0, iva: 0 },
  servicios: { base: 0, iva: 0 }, exportacion: { base: 0, iva: 0 },
}
const EMPTY_C: EditCompras = {
  pequenoContribuyente: { base: 0 }, bienes: { base: 0, iva: 0 },
  servicios: { base: 0, iva: 0 }, combustibles: { base: 0, iva: 0 },
  importacion: { base: 0, iva: 0 }, retencionIva: 0,
}

const snapshotToEdit = (d: DeclaracionIva): EditValues => {
  const vd = d.snapshot?.ventasDesglose
  const cd = d.snapshot?.comprasDesglose
  if (vd && cd) {
    return {
      ventas: {
        exento:      { base: Number(vd.exento?.base      ?? 0) },
        bienes:      { base: Number(vd.bienes?.base      ?? 0), iva: Number(vd.bienes?.iva      ?? 0) },
        servicios:   { base: Number(vd.servicios?.base   ?? 0), iva: Number(vd.servicios?.iva   ?? 0) },
        exportacion: { base: Number(vd.exportacion?.base ?? 0), iva: Number(vd.exportacion?.iva ?? 0) },
      },
      compras: {
        pequenoContribuyente: { base: Number(cd.pequenoContribuyente?.base ?? 0) },
        bienes:       { base: Number(cd.bienes?.base       ?? 0), iva: Number(cd.bienes?.iva       ?? 0) },
        servicios:    { base: Number(cd.servicios?.base    ?? 0), iva: Number(cd.servicios?.iva    ?? 0) },
        combustibles: { base: Number(cd.combustibles?.base ?? 0), iva: Number(cd.combustibles?.iva ?? 0) },
        importacion:  { base: Number(cd.importacion?.base  ?? 0), iva: Number(cd.importacion?.iva  ?? 0) },
        retencionIva: Number(cd.retencionIva ?? d.retencionIva ?? 0),
      },
    }
  }
  return {
    ventas:  { ...EMPTY_V, servicios: { base: Number(d.baseVentas), iva: Number(d.ivaDebitoFiscal) } },
    compras: { ...EMPTY_C, bienes: { base: Number(d.baseCompras), iva: Number(d.ivaCreditoFiscal) }, retencionIva: Number(d.retencionIva) },
  }
}

export default function Declaracion2237() {
  const now = dayjs()
  const activeCompany = useCompanyStore(s => s.activeCompany)

  const [mes,  setMes]  = useState<number>(now.month() + 1)
  const [anio, setAnio] = useState<number>(now.year())
  const [decl,  setDecl]  = useState<DeclaracionIva | null>(null)
  const [lista, setLista] = useState<DeclaracionIva[]>([])
  const [loading,     setLoading]     = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ev, setEv] = useState<EditValues>({ ventas: EMPTY_V, compras: EMPTY_C })

  const syncEdit = useCallback((d: DeclaracionIva) => setEv(snapshotToEdit(d)), [])

  const updateDecl = (result: DeclaracionIva) => {
    setDecl(result)
    syncEdit(result)
    setLista(prev => {
      const idx = prev.findIndex(x => x.id === result.id)
      return idx >= 0 ? prev.map((x, i) => i === idx ? result : x) : [result, ...prev]
    })
  }

  const catchMsg = (e: unknown, fallback: string) => {
    const err = e as any
    const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? fallback
    message.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }

  useEffect(() => {
    getDeclaracionesIva()
      .then(d => {
        setLista(d)
        const found = d.find(x => x.mes === mes && x.anio === anio)
        if (found) { setDecl(found); syncEdit(found) }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCalcular = async () => {
    setCalcLoading(true)
    try {
      const result = await generarBorradorIva(mes, anio)
      updateDecl(result); setEditing(false)
      message.success('Borrador calculado correctamente')
    } catch (e) { catchMsg(e, 'Error al calcular') }
    finally { setCalcLoading(false) }
  }

  const handleEditar   = () => { if (decl) { syncEdit(decl); setEditing(true) } }
  const handleCancelar = () => { if (decl) syncEdit(decl); setEditing(false) }

  const handleGuardar = async () => {
    if (!decl) return
    setSaveLoading(true)
    try {
      const ivaDebitoFiscal  = r2(ev.ventas.bienes.iva + ev.ventas.servicios.iva + ev.ventas.exportacion.iva)
      const ivaCreditoFiscal = r2(ev.compras.bienes.iva + ev.compras.servicios.iva + ev.compras.combustibles.iva + ev.compras.importacion.iva)
      const baseVentas  = r2(ev.ventas.exento.base + ev.ventas.bienes.base + ev.ventas.servicios.base + ev.ventas.exportacion.base)
      const baseCompras = r2(ev.compras.pequenoContribuyente.base + ev.compras.bienes.base + ev.compras.servicios.base + ev.compras.combustibles.base + ev.compras.importacion.base)
      const result = await actualizarDeclaracionIva(decl.id, {
        ivaDebitoFiscal, ivaCreditoFiscal, baseVentas, baseCompras,
        retencionIva: ev.compras.retencionIva,
        ventasDesglose:  ev.ventas  as unknown as Record<string, unknown>,
        comprasDesglose: ev.compras as unknown as Record<string, unknown>,
      })
      updateDecl(result); setEditing(false)
      message.success(result.polizaId ? 'Valores actualizados y póliza regenerada' : 'Valores actualizados')
    } catch (e) { catchMsg(e, 'Error al guardar') }
    finally { setSaveLoading(false) }
  }

  const handlePoliza = async () => {
    if (!decl) return
    setLoading(true)
    try {
      const result = await generarPolizaBorradorIva(decl.id)
      updateDecl(result)
      message.success('Póliza borrador generada — revísela en Contabilidad')
    } catch (e) { catchMsg(e, 'Error al generar póliza') }
    finally { setLoading(false) }
  }

  const handlePresentada = async () => {
    if (!decl) return
    setLoading(true)
    try {
      const result = await marcarIvaPresentada(decl.id)
      updateDecl(result)
      message.success('Declaración marcada como presentada')
    } catch (e) { catchMsg(e, 'Error') }
    finally { setLoading(false) }
  }

  const handleSelectHistorial = (record: DeclaracionIva) => {
    setMes(record.mes); setAnio(record.anio)
    setDecl(record); syncEdit(record); setEditing(false)
  }

  const liveDebito  = r2(ev.ventas.bienes.iva + ev.ventas.servicios.iva + ev.ventas.exportacion.iva)
  const liveBaseV   = r2(ev.ventas.exento.base + ev.ventas.bienes.base + ev.ventas.servicios.base + ev.ventas.exportacion.base)
  const liveCredito = r2(ev.compras.bienes.iva + ev.compras.servicios.iva + ev.compras.combustibles.iva + ev.compras.importacion.iva)
  const liveBaseC   = r2(ev.compras.pequenoContribuyente.base + ev.compras.bienes.base + ev.compras.servicios.base + ev.compras.combustibles.base + ev.compras.importacion.base)
  const liveRet     = ev.compras.retencionIva
  const liveNeto    = liveDebito - liveCredito
  const livePagar   = Math.max(0, liveNeto) - liveRet

  const snapshot    = decl?.snapshot ?? {}
  const mesNombre   = MESES.find(m => m.value === mes)?.label ?? ''
  const anioOptions = Array.from({ length: 5 }, (_, i) => now.year() - i)
  const fechaVenc   = dayjs().year(anio).month(mes - 1).add(1, 'month').startOf('month').format('DD/MM/YYYY')

  const editMark = editing
    ? <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>▼</span>
    : null

  const NI = ({ val, onChange }: { val: number; onChange: (v: number) => void }) =>
    editing ? (
      <InputNumber size="small" value={val} onChange={v => onChange(v ?? 0)}
        min={0} precision={2} controls={false}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
    ) : (
      <span>{val !== 0 ? fmt(val) : ''}</span>
    )

  const ZRow = ({ label }: { label: string }) => (
    <tr><td style={CELL}>{label}</td><td style={NUM}></td><td style={NUM}></td></tr>
  )

  const ERow = ({ label, baseVal, onBase, ivaVal, onIva }: {
    label: string
    baseVal: number; onBase: (v: number) => void
    ivaVal?: number; onIva?: (v: number) => void
  }) => (
    <tr>
      <td style={editing ? ECELL : CELL}>{label}{editMark}</td>
      <td style={editing ? ENUM : NUM}><NI val={baseVal} onChange={onBase} /></td>
      <td style={editing ? ENUM : NUM}>
        {ivaVal !== undefined && onIva !== undefined
          ? <NI val={ivaVal} onChange={onIva} />
          : null}
      </td>
    </tr>
  )

  const setV = (cat: keyof EditVentas, field: 'base' | 'iva', val: number) =>
    setEv(p => ({ ...p, ventas: { ...p.ventas, [cat]: { ...(p.ventas[cat] as object), [field]: val } } }))
  const setC = (cat: keyof Omit<EditCompras, 'retencionIva'>, field: 'base' | 'iva', val: number) =>
    setEv(p => ({ ...p, compras: { ...p.compras, [cat]: { ...(p.compras[cat] as object), [field]: val } } }))

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 0 }}>Declaración IVA — SAT Formulario 2237</Title>
      <Text type="secondary">Impuesto al Valor Agregado · Régimen General · Declaración jurada mensual</Text>
      <Divider style={{ margin: '12px 0' }} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Período:</Text>
          <Select value={mes} onChange={v => { setMes(v); setEditing(false) }} style={{ width: 140 }}>
            {MESES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
          </Select>
          <Select value={anio} onChange={v => { setAnio(v); setEditing(false) }} style={{ width: 90 }}>
            {anioOptions.map(y => <Option key={y} value={y}>{y}</Option>)}
          </Select>
          <Button type="primary" icon={<CalculatorOutlined />} loading={calcLoading}
            onClick={handleCalcular} style={{ background: '#1B3A6B' }}>
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

          <div style={{ border: BD, background: '#fff', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col /><col style={{ width: 112 }} /><col style={{ width: 112 }} />
              </colgroup>
              <tbody>

                <tr>
                  <td colSpan={3} style={{ padding: '10px 16px', background: '#f5f7ff', borderBottom: BD }}>
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

                <tr><td colSpan={3} style={SEC}>1. NIT DEL CONTRIBUYENTE</td></tr>
                <tr>
                  <td colSpan={3} style={{ ...CELL, textAlign: 'center', padding: '8px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{activeCompany?.taxId ?? '—'}</div>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{activeCompany?.legalName ?? ''}</div>
                  </td>
                </tr>

                <tr><td colSpan={3} style={SEC}>2. PERÍODO DE IMPOSICIÓN</td></tr>
                <tr>
                  <td colSpan={3} style={{ ...CELL, textAlign: 'center', padding: '6px 8px' }}>
                    MES:&nbsp;<strong>{mesNombre.toUpperCase()}</strong>
                    &nbsp;&nbsp;&nbsp;AÑO:&nbsp;<strong>{anio}</strong>
                  </td>
                </tr>

                <tr>
                  <td style={SEC}>3. DÉBITO FISCAL POR OPERACIONES LOCALES</td>
                  <td style={CHD}>BASE</td>
                  <td style={CHD}>DÉBITOS</td>
                </tr>
                <ERow label="Ventas exentas y servicios exentos"
                  baseVal={ev.ventas.exento.base} onBase={v => setV('exento', 'base', v)} />
                <ZRow label="Ventas de medicamentos genéricos, alternativos y antirretrovirales" />
                <ZRow label="Ventas no afectas realizadas a contribuyentes calificados (Decreto 29-89)" />
                <ERow label="Ventas gravadas (bienes)"
                  baseVal={ev.ventas.bienes.base}    onBase={v => setV('bienes', 'base', v)}
                  ivaVal={ev.ventas.bienes.iva}       onIva={v  => setV('bienes', 'iva',  v)} />
                <ERow label="Servicios gravados"
                  baseVal={ev.ventas.servicios.base}  onBase={v => setV('servicios', 'base', v)}
                  ivaVal={ev.ventas.servicios.iva}    onIva={v  => setV('servicios', 'iva',  v)} />
                <ERow label="Exportaciones"
                  baseVal={ev.ventas.exportacion.base} onBase={v => setV('exportacion', 'base', v)}
                  ivaVal={ev.ventas.exportacion.iva}   onIva={v  => setV('exportacion', 'iva',  v)} />
                <tr>
                  <td style={SUB}>Sumatoria BASE y DÉBITOS</td>
                  <td style={SNUM}>{fmt(liveBaseV)}</td>
                  <td style={SNUM}>{fmt(liveDebito)}</td>
                </tr>

                <tr>
                  <td style={SEC}>5. CRÉDITO FISCAL POR OPERACIONES LOCALES</td>
                  <td style={CHD}>BASE</td>
                  <td style={CHD}>CRÉDITOS</td>
                </tr>
                <ERow label="Compras y servicios de pequeños contribuyentes (sin crédito IVA)"
                  baseVal={ev.compras.pequenoContribuyente.base} onBase={v => setC('pequenoContribuyente', 'base', v)} />
                <ZRow label="Compras que no generan derecho a compensación del crédito fiscal" />
                <ERow label="Compras de combustibles"
                  baseVal={ev.compras.combustibles.base} onBase={v => setC('combustibles', 'base', v)}
                  ivaVal={ev.compras.combustibles.iva}   onIva={v  => setC('combustibles', 'iva',  v)} />
                <ERow label="Otras compras y adquisición de bienes"
                  baseVal={ev.compras.bienes.base} onBase={v => setC('bienes', 'base', v)}
                  ivaVal={ev.compras.bienes.iva}   onIva={v  => setC('bienes', 'iva',  v)} />
                <ERow label="Servicios adquiridos"
                  baseVal={ev.compras.servicios.base} onBase={v => setC('servicios', 'base', v)}
                  ivaVal={ev.compras.servicios.iva}   onIva={v  => setC('servicios', 'iva',  v)} />
                <ERow label="Importaciones de Centroamérica y del resto del mundo"
                  baseVal={ev.compras.importacion.base} onBase={v => setC('importacion', 'base', v)}
                  ivaVal={ev.compras.importacion.iva}   onIva={v  => setC('importacion', 'iva',  v)} />
                <ZRow label="Compras de activos fijos directamente vinculados con el proceso productivo" />
                <ZRow label="IVA conforme constancias de exención recibidas" />
                <ZRow label="Remanente de crédito fiscal del período anterior" />
                <tr>
                  <td style={SUB}>Sumatoria BASE y CRÉDITOS</td>
                  <td style={SNUM}>{fmt(liveBaseC)}</td>
                  <td style={SNUM}>{fmt(liveCredito)}</td>
                </tr>

                <tr><td colSpan={3} style={SEC}>7. DETERMINACIÓN DEL CRÉDITO FISCAL O IMPUESTO A PAGAR</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>
                    Crédito fiscal para el período siguiente (Créditos &gt; Débitos)
                  </td>
                  <td style={NUM}>{liveNeto < 0 ? fmt(Math.abs(liveNeto)) : ''}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...CELL, fontWeight: 700 }}>
                    IMPUESTO TOTAL DETERMINADO — operaciones locales (Débitos &gt; Créditos)
                  </td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{liveNeto > 0 ? fmt(liveNeto) : ''}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...CELL, fontWeight: 700 }}>SALDO DEL IMPUESTO</td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{fmt(Math.max(0, liveNeto))}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Remanente de retenciones del IVA del período anterior</td>
                  <td style={NUM}></td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(=) Remanente de retenciones del IVA recibidas en el período</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={editing ? ECELL : CELL}>
                    (-) Constancias de retenciones del IVA recibidas en el período{editMark}
                  </td>
                  <td style={editing ? ENUM : NUM}>
                    <NI val={liveRet}
                      onChange={v => setEv(p => ({ ...p, compras: { ...p.compras, retencionIva: v } }))} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Saldo de retenciones para el período siguiente</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={PCELL}>IMPUESTO A PAGAR</td>
                  <td style={PNUM}>{fmt(Math.max(0, livePagar))}</td>
                </tr>

                <tr><td colSpan={3} style={SEC}>8. INDICADORES COMERCIALES</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>Indicadores comerciales (base débitos − base créditos)</td>
                  <td style={NUM}>{fmt(liveBaseV - liveBaseC)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Razón ventas y compras (base débitos ÷ base créditos)</td>
                  <td style={NUM}>{liveBaseC > 0 ? (liveBaseV / liveBaseC).toFixed(2) : '0.00'}</td>
                </tr>

                <tr>
                  <td style={SEC}>9.1 CANTIDAD DE OPERACIONES REALIZADAS</td>
                  <td style={CHD}>EMITIDAS</td>
                  <td style={CHD}>RECIBIDAS</td>
                </tr>
                <tr>
                  <td style={CELL}>Facturas (incluir las anuladas)</td>
                  <td style={{ ...NUM, textAlign: 'center' }}>{snapshot?.ventas?.count ?? 0}</td>
                  <td style={{ ...NUM, textAlign: 'center' }}>{snapshot?.compras?.count ?? 0}</td>
                </tr>
                <tr>
                  <td style={CELL}>Facturas especiales</td>
                  <td style={{ ...NUM, textAlign: 'center' }}></td>
                  <td style={{ ...NUM, textAlign: 'center' }}></td>
                </tr>
                <tr>
                  <td style={CELL}>Notas de crédito</td>
                  <td style={{ ...NUM, textAlign: 'center' }}></td>
                  <td style={{ ...NUM, textAlign: 'center' }}></td>
                </tr>

                <tr><td colSpan={3} style={SEC}>11. ACCESORIOS</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>
                    <span style={{ fontWeight: 600 }}>Fecha máxima de pago sin accesorios</span>
                    <br /><span style={{ fontSize: 11, color: '#666' }}>Según calendario tributario SAT</span>
                  </td>
                  <td style={{ ...NUM, fontWeight: 600 }}>{fechaVenc}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(+) Multa formal (por presentación extemporánea)</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>(+) Mora</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={PCELL}>TOTAL A PAGAR</td>
                  <td style={PNUM}>{fmt(Math.max(0, livePagar))}</td>
                </tr>

              </tbody>
            </table>
          </div>

          <Space wrap style={{ marginBottom: 24 }}>
            {!editing ? (
              <>
                {decl.status !== 'presentada' && (
                  <Button icon={<EditOutlined />} onClick={handleEditar}>Editar valores</Button>
                )}
                {decl.status !== 'presentada' && (
                  <Button type="primary" icon={<FileDoneOutlined />} onClick={handlePoliza}
                    style={{ background: '#1B3A6B' }}>
                    {decl.status === 'poliza_generada' ? 'Regenerar Póliza Borrador' : 'Generar Póliza Borrador'}
                  </Button>
                )}
                {decl.status === 'poliza_generada' && (
                  <Button icon={<CheckCircleOutlined />} onClick={handlePresentada}
                    style={{ borderColor: '#059669', color: '#059669' }}>
                    Marcar como Presentada
                  </Button>
                )}
                <Tooltip title="Recalcular desde facturas y compras registradas en el sistema">
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
                <Button type="primary" icon={<SaveOutlined />} loading={saveLoading} onClick={handleGuardar}
                  style={{ background: '#059669', borderColor: '#059669' }}>
                  Guardar ajustes{decl.polizaId ? ' y regenerar póliza' : ''}
                </Button>
                <Button icon={<CloseOutlined />} onClick={handleCancelar}>Cancelar</Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Modo edición — modifique los valores resaltados en amarillo (▼)
                </Text>
              </>
            )}
          </Space>

        </Spin>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <FileProtectOutlined style={{ fontSize: 48, color: '#d1d5db' }} />
          <div style={{ marginTop: 12, color: '#6b7280' }}>
            Seleccione el período y presione <strong>Calcular del sistema</strong> para generar el borrador.
          </div>
        </Card>
      )}

      {lista.length > 0 && (
        <Card size="small" title="Historial de Declaraciones" style={{ marginTop: 8 }}>
          <Table
            size="small" rowKey="id" pagination={false} dataSource={lista}
            onRow={record => ({ onClick: () => handleSelectHistorial(record), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'Período', key: 'periodo', width: 130,
                render: (_, r) => `${MESES.find(m => m.value === r.mes)?.label} ${r.anio}` },
              { title: 'Estado', dataIndex: 'status', width: 140,
                render: v => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.label}</Tag> },
              { title: 'Débito Fiscal', dataIndex: 'ivaDebitoFiscal', align: 'right',
                render: v => fmt(Number(v)) },
              { title: 'Crédito Fiscal', dataIndex: 'ivaCreditoFiscal', align: 'right',
                render: v => fmt(Number(v)) },
              { title: 'IVA Neto', dataIndex: 'ivaNeto', align: 'right',
                render: v => {
                  const n = Number(v)
                  return <Text strong style={{ color: n < 0 ? '#059669' : '#dc2626' }}>{fmt(Math.abs(n))}</Text>
                } },
              { title: 'Póliza', dataIndex: 'polizaId', width: 70, align: 'center',
                render: v => v ? <Badge status="success" text="Sí" /> : <Badge status="default" text="No" /> },
              { title: 'Actualizado', dataIndex: 'updatedAt', width: 110,
                render: v => dayjs(v).format('DD/MM/YYYY') },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
