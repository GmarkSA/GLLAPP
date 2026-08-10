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
  type DeclaracionIva,
  getDeclaracionesIva, generarBorradorIva,
  generarPolizaBorradorIva, marcarIvaPresentada, actualizarDeclaracionIva,
  sincronizarEstadoIva,
} from '../../api/reportes'

const { Title, Text } = Typography
const { Option } = Select

const BD    = '1px solid #d0d5dd'
const CELL: CSSProperties = { padding: '3px 8px', borderBottom: BD, fontSize: 12, verticalAlign: 'middle' }
const NUM:  CSSProperties = { ...CELL, textAlign: 'right', width: 112, borderLeft: BD, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const SEC:  CSSProperties = { padding: '4px 8px', background: '#1B3A6B', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, borderBottom: BD }
const CHD:  CSSProperties = { ...NUM, background: '#1B3A6B', color: '#fff', fontWeight: 700, textAlign: 'center', borderBottom: BD }
const SUB:  CSSProperties = { ...CELL, background: '#eef2fb', fontWeight: 700 }
const SNUM: CSSProperties = { ...NUM,  background: '#eef2fb', fontWeight: 700 }
const ECELL:CSSProperties = { ...CELL, background: '#fffbe6' }
const ENUM: CSSProperties = { ...NUM,  background: '#fffbe6' }
const PCELL:CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const PNUM: CSSProperties = { ...NUM,  background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const CCELL:CSSProperties = { ...CELL, fontSize: 10.5, color: '#6b7280' }
const CODE: CSSProperties = { fontSize: 9, color: '#9ca3af', fontFamily: 'monospace', marginLeft: 5, letterSpacing: 0.5 }

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
// Julio tiene plazo reducido de 20 días hábiles; el resto 30 (SAT Guatemala)
const businessDaysForMonth = (mes: number) => (mes === 7 ? 20 : 30)

// ─── Tipos de desglose ────────────────────────────────────────────────────────
interface CatBI { base: number; iva: number }
interface CatB  { base: number }

interface EditVentas {
  exento:           CatB
  vehiculosAntiguos: CatB    // Exento — vehículos 2+ años
  vehiculosNuevos:  CatBI    // Gravado — vehículos año en curso/siguiente/anterior
  bienes:           CatBI    // RG-V01
  servicios:        CatBI    // RG-V02
  exportacion:      CatBI    // RG-V03
}

interface EditCompras {
  medicamentos:           CatB    // Exento
  pequenoContribuyente:   CatB    // RG-C06 — sin crédito IVA
  vehiculosAntiguos:      CatB    // Exento — vehículos 2+ años
  vehiculosNuevos:        CatBI   // Gravado — vehículos año en curso
  exento:                 CatB    // RG-C04 — sin crédito (incluye IDP y Turismo)
  combustibles:           CatBI   // RG-C08
  bienes:                 CatBI   // RG-C01
  servicios:              CatBI   // RG-C02
  fyduca:                 CatBI   // FYDUCA — Factura Única CA
  importacion:            CatBI   // RG-C03
  activosFijos:           CatBI   // RG-C05 — locales
  activosFijosImportados: CatBI   // Activos fijos importados
  retencionIva:           number  // Constancias recibidas de clientes
}

interface EditValues { ventas: EditVentas; compras: EditCompras }

interface CountPair { emitidas: number; recibidas: number }
interface EditCounts {
  facturas:     CountPair
  fyduca:       CountPair
  exencion:     CountPair
  insumos:      CountPair
  retencionIva: CountPair
  especiales:   CountPair
  notasCredito: CountPair
  notasDebito:  CountPair
}

const EMPTY_COUNTS: EditCounts = {
  facturas:     { emitidas: 0, recibidas: 0 },
  fyduca:       { emitidas: 0, recibidas: 0 },
  exencion:     { emitidas: 0, recibidas: 0 },
  insumos:      { emitidas: 0, recibidas: 0 },
  retencionIva: { emitidas: 0, recibidas: 0 },
  especiales:   { emitidas: 0, recibidas: 0 },
  notasCredito: { emitidas: 0, recibidas: 0 },
  notasDebito:  { emitidas: 0, recibidas: 0 },
}

const EMPTY_V: EditVentas = {
  exento:            { base: 0 },
  vehiculosAntiguos: { base: 0 },
  vehiculosNuevos:   { base: 0, iva: 0 },
  bienes:            { base: 0, iva: 0 },
  servicios:         { base: 0, iva: 0 },
  exportacion:       { base: 0, iva: 0 },
}
const EMPTY_C: EditCompras = {
  medicamentos:           { base: 0 },
  pequenoContribuyente:   { base: 0 },
  vehiculosAntiguos:      { base: 0 },
  vehiculosNuevos:        { base: 0, iva: 0 },
  exento:                 { base: 0 },
  combustibles:           { base: 0, iva: 0 },
  bienes:                 { base: 0, iva: 0 },
  servicios:              { base: 0, iva: 0 },
  fyduca:                 { base: 0, iva: 0 },
  importacion:            { base: 0, iva: 0 },
  activosFijos:           { base: 0, iva: 0 },
  activosFijosImportados: { base: 0, iva: 0 },
  retencionIva:           0,
}

const snapshotToEdit = (d: DeclaracionIva): EditValues => {
  const vd = d.snapshot?.ventasDesglose
  const cd = d.snapshot?.comprasDesglose
  if (vd && cd) {
    return {
      ventas: {
        exento:            { base: Number(vd.exento?.base             ?? 0) },
        vehiculosAntiguos: { base: Number(vd.vehiculosAntiguos?.base  ?? 0) },
        vehiculosNuevos:   { base: Number(vd.vehiculosNuevos?.base    ?? 0), iva: Number(vd.vehiculosNuevos?.iva ?? 0) },
        bienes:            { base: Number(vd.bienes?.base             ?? 0), iva: Number(vd.bienes?.iva         ?? 0) },
        servicios:         { base: Number(vd.servicios?.base          ?? 0), iva: Number(vd.servicios?.iva      ?? 0) },
        exportacion:       { base: Number(vd.exportacion?.base        ?? 0), iva: Number(vd.exportacion?.iva    ?? 0) },
      },
      compras: {
        medicamentos:           { base: Number(cd.medicamentos?.base           ?? 0) },
        pequenoContribuyente:   { base: Number(cd.pequenoContribuyente?.base   ?? 0) },
        vehiculosAntiguos:      { base: Number(cd.vehiculosAntiguos?.base      ?? 0) },
        vehiculosNuevos:        { base: Number(cd.vehiculosNuevos?.base        ?? 0), iva: Number(cd.vehiculosNuevos?.iva        ?? 0) },
        exento:                 { base: Number(cd.exento?.base                 ?? 0) },
        combustibles:           { base: Number(cd.combustibles?.base           ?? 0), iva: Number(cd.combustibles?.iva           ?? 0) },
        bienes:                 { base: Number(cd.bienes?.base                 ?? 0), iva: Number(cd.bienes?.iva                 ?? 0) },
        servicios:              { base: Number(cd.servicios?.base              ?? 0), iva: Number(cd.servicios?.iva              ?? 0) },
        fyduca:                 { base: Number(cd.fyduca?.base                 ?? 0), iva: Number(cd.fyduca?.iva                 ?? 0) },
        importacion:            { base: Number(cd.importacion?.base            ?? 0), iva: Number(cd.importacion?.iva            ?? 0) },
        activosFijos:           { base: Number(cd.activosFijos?.base           ?? 0), iva: Number(cd.activosFijos?.iva           ?? 0) },
        activosFijosImportados: { base: Number(cd.activosFijosImportados?.base ?? 0), iva: Number(cd.activosFijosImportados?.iva ?? 0) },
        retencionIva:           Number(cd.retencionIva ?? d.retencionIva ?? 0),
      },
    }
  }
  // Fallback para snapshots sin desglose guardado
  return {
    ventas:  { ...EMPTY_V, servicios: { base: Number(d.baseVentas), iva: Number(d.ivaDebitoFiscal) } },
    compras: { ...EMPTY_C, bienes: { base: Number(d.baseCompras), iva: Number(d.ivaCreditoFiscal) }, retencionIva: Number(d.retencionIva) },
  }
}

const snapshotToCounts = (d: DeclaracionIva): EditCounts => {
  const saved = (d.snapshot?.comprasDesglose as any)?.counts9_1 as EditCounts | undefined
  if (saved) return saved
  return {
    ...EMPTY_COUNTS,
    facturas: {
      emitidas:  d.snapshot?.ventas?.count  ?? 0,
      recibidas: d.snapshot?.compras?.count ?? 0,
    },
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Declaracion2237() {
  const now = dayjs()
  const navigate = useNavigate()
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
  const [ec, setEc] = useState<EditCounts>(EMPTY_COUNTS)

  const syncEdit = useCallback((d: DeclaracionIva) => {
    setEv(snapshotToEdit(d))
    setEc(snapshotToCounts(d))
  }, [])

  const updateDecl = (result: DeclaracionIva) => {
    setDecl(result); syncEdit(result)
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

  // Si la póliza ya fue publicada en Diarios Manuales, sincroniza el estado automáticamente
  useEffect(() => {
    if (!decl || decl.status !== 'poliza_generada' || !decl.polizaId) return
    sincronizarEstadoIva(decl.id).then(updated => {
      if (updated.status !== decl.status) updateDecl(updated)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decl?.id, decl?.status])

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
      const v = ev.ventas; const c = ev.compras
      const ivaDebitoFiscal  = r2(v.vehiculosNuevos.iva + v.bienes.iva + v.servicios.iva + v.exportacion.iva)
      const ivaCreditoFiscal = r2(c.vehiculosNuevos.iva + c.combustibles.iva + c.bienes.iva + c.servicios.iva + c.fyduca.iva + c.importacion.iva + c.activosFijos.iva + c.activosFijosImportados.iva)
      const baseVentas  = r2(v.exento.base + v.vehiculosAntiguos.base + v.vehiculosNuevos.base + v.bienes.base + v.servicios.base + v.exportacion.base)
      const baseCompras = r2(c.medicamentos.base + c.pequenoContribuyente.base + c.vehiculosAntiguos.base + c.vehiculosNuevos.base + c.exento.base + c.combustibles.base + c.bienes.base + c.servicios.base + c.fyduca.base + c.importacion.base + c.activosFijos.base + c.activosFijosImportados.base)
      const result = await actualizarDeclaracionIva(decl.id, {
        ivaDebitoFiscal, ivaCreditoFiscal, baseVentas, baseCompras,
        retencionIva: c.retencionIva,
        ventasDesglose:  v as unknown as Record<string, unknown>,
        comprasDesglose: { ...c, counts9_1: ec } as unknown as Record<string, unknown>,
      })
      updateDecl(result); setEditing(false)
      message.success(result.polizaId ? 'Valores actualizados y póliza regenerada' : 'Valores actualizados')
    } catch (e) { catchMsg(e, 'Error al guardar') }
    finally { setSaveLoading(false) }
  }

  const handlePoliza = async () => {
    if (!decl) return; setLoading(true)
    try {
      const result = await generarPolizaBorradorIva(decl.id)
      updateDecl(result); message.success('Póliza borrador generada — revísela en Contabilidad')
    } catch (e) { catchMsg(e, 'Error al generar póliza') }
    finally { setLoading(false) }
  }

  const handlePresentada = async () => {
    if (!decl) return; setLoading(true)
    try {
      const result = await marcarIvaPresentada(decl.id)
      updateDecl(result); message.success('Declaración marcada como presentada')
    } catch (e) { catchMsg(e, 'Error') }
    finally { setLoading(false) }
  }

  const handleSelectHistorial = (record: DeclaracionIva) => {
    setMes(record.mes); setAnio(record.anio)
    setDecl(record); syncEdit(record); setEditing(false)
  }

  // ─── Totales en vivo ──────────────────────────────────────────────────────
  const v = ev.ventas; const c = ev.compras
  const liveDebito  = r2(v.vehiculosNuevos.iva + v.bienes.iva + v.servicios.iva + v.exportacion.iva)
  const liveBaseV   = r2(v.exento.base + v.vehiculosAntiguos.base + v.vehiculosNuevos.base + v.bienes.base + v.servicios.base + v.exportacion.base)
  const liveCredito = r2(c.vehiculosNuevos.iva + c.combustibles.iva + c.bienes.iva + c.servicios.iva + c.fyduca.iva + c.importacion.iva + c.activosFijos.iva + c.activosFijosImportados.iva)
  const liveBaseC   = r2(c.medicamentos.base + c.pequenoContribuyente.base + c.vehiculosAntiguos.base + c.vehiculosNuevos.base + c.exento.base + c.combustibles.base + c.bienes.base + c.servicios.base + c.fyduca.base + c.importacion.base + c.activosFijos.base + c.activosFijosImportados.base)
  const liveRet     = c.retencionIva
  const liveNeto    = liveDebito - liveCredito
  const livePagar   = Math.max(0, liveNeto) - liveRet

  const snapshot    = decl?.snapshot ?? {}
  const mesNombre   = MESES.find(m => m.value === mes)?.label ?? ''
  const anioOptions = Array.from({ length: 5 }, (_, i) => now.year() - i)
  const fechaVenc   = addBusinessDays(
    dayjs(`${anio}-${String(mes).padStart(2, '0')}-01`).endOf('month'),
    businessDaysForMonth(mes),
  ).format('DD/MM/YYYY')

  const editMark = editing ? <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>▼</span> : null

  // ─── Helpers de render ────────────────────────────────────────────────────
  const NI = ({ val, onChange }: { val: number; onChange: (v: number) => void }) =>
    editing ? (
      <InputNumber size="small" value={val} onChange={nv => onChange(nv ?? 0)}
        min={0} precision={2} controls={false}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
    ) : (
      <span>{val !== 0 ? fmt(val) : ''}</span>
    )

  // Fila estática sin código de impuesto vinculado (siempre 0 para este régimen)
  const ZRow = ({ label }: { label: string }) => (
    <tr><td style={CCELL}>{label}</td><td style={NUM}></td><td style={NUM}></td></tr>
  )

  // InputNumber entero para cantidades de operaciones
  const NIcount = ({ val, onChange }: { val: number; onChange: (v: number) => void }) =>
    editing ? (
      <InputNumber size="small" value={val} onChange={nv => onChange(nv ?? 0)}
        min={0} precision={0} controls={false}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }} />
    ) : (
      <span>{val !== 0 ? val : ''}</span>
    )

  // Fila de conteo (sección 9.1) con emitidas y recibidas
  const CRow = ({ label, em, onEm, re, onRe }: {
    label: string; em: number; onEm: (v: number) => void; re: number; onRe: (v: number) => void
  }) => (
    <tr>
      <td style={editing ? ECELL : CELL}>{label}{editing ? editMark : null}</td>
      <td style={{ ...(editing ? ENUM : NUM), textAlign: 'center' }}><NIcount val={em} onChange={onEm} /></td>
      <td style={{ ...(editing ? ENUM : NUM), textAlign: 'center' }}><NIcount val={re} onChange={onRe} /></td>
    </tr>
  )

  const setCount = (key: keyof EditCounts, field: 'emitidas' | 'recibidas', val: number) =>
    setEc(p => ({ ...p, [key]: { ...p[key], [field]: val } }))

  // Fila editable: BASE + IVA opcional; taxCode es informativo
  const ERow = ({ label, taxCode, baseVal, onBase, ivaVal, onIva }: {
    label: string; taxCode?: string
    baseVal: number; onBase: (v: number) => void
    ivaVal?: number; onIva?: (v: number) => void
  }) => (
    <tr>
      <td style={editing ? ECELL : CELL}>
        {label}{editMark}
        {taxCode && <span style={CODE}>{taxCode}</span>}
      </td>
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
      <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/reportes')}
        style={{ marginBottom: 8 }}>
        Reportes
      </Button>
      <Title level={4} style={{ marginBottom: 0 }}>Declaración IVA — SAT Formulario 2237</Title>
      <Text type="secondary">Impuesto al Valor Agregado · Régimen General · Declaración jurada mensual</Text>
      <Divider style={{ margin: '12px 0' }} />

      {/* Selector de período */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Período:</Text>
          <Select value={mes} onChange={nv => { setMes(nv); setEditing(false) }} style={{ width: 140 }}>
            {MESES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
          </Select>
          <Select value={anio} onChange={nv => { setAnio(nv); setEditing(false) }} style={{ width: 90 }}>
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

          {/* ═══ FORMULARIO SAT-2237 ══════════════════════════════════════════ */}
          <div style={{ border: BD, background: '#fff', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col /><col style={{ width: 112 }} /><col style={{ width: 112 }} />
              </colgroup>
              <tbody>

                {/* Encabezado */}
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

                {/* 1. NIT */}
                <tr><td colSpan={3} style={SEC}>1. NIT DEL CONTRIBUYENTE</td></tr>
                <tr>
                  <td colSpan={3} style={{ ...CELL, textAlign: 'center', padding: '8px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{activeCompany?.taxId ?? '—'}</div>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{activeCompany?.legalName ?? ''}</div>
                  </td>
                </tr>

                {/* 2. Período */}
                <tr><td colSpan={3} style={SEC}>2. PERÍODO DE IMPOSICIÓN</td></tr>
                <tr>
                  <td colSpan={3} style={{ ...CELL, textAlign: 'center', padding: '6px 8px' }}>
                    MES:&nbsp;<strong>{mesNombre.toUpperCase()}</strong>
                    &nbsp;&nbsp;&nbsp;AÑO:&nbsp;<strong>{anio}</strong>
                  </td>
                </tr>

                {/* 3. DÉBITO FISCAL */}
                <tr>
                  <td style={SEC}>3. DÉBITO FISCAL POR OPERACIONES LOCALES</td>
                  <td style={CHD}>BASE</td>
                  <td style={CHD}>DÉBITOS</td>
                </tr>
                <ERow label="Ventas exentas y servicios exentos" taxCode="RG-V05"
                  baseVal={v.exento.base} onBase={val => setV('exento', 'base', val)} />
                <ZRow label="Ventas de medicamentos genéricos, alternativos y antirretrovirales" />
                <ZRow label="Ventas no afectas realizadas a contribuyentes calificados (Decreto 29-89)" />
                <ERow label="Ventas de vehículos terrestres — modelo de 2 años o más anteriores al año en curso (exento)"
                  baseVal={v.vehiculosAntiguos.base} onBase={val => setV('vehiculosAntiguos', 'base', val)} />
                <ERow label="Ventas de vehículos terrestres — modelo del año en curso, siguiente o anterior"
                  baseVal={v.vehiculosNuevos.base} onBase={val => setV('vehiculosNuevos', 'base', val)}
                  ivaVal={v.vehiculosNuevos.iva}   onIva={val  => setV('vehiculosNuevos', 'iva',  val)} />
                <ERow label="Ventas gravadas (bienes)" taxCode="RG-V01"
                  baseVal={v.bienes.base}    onBase={val => setV('bienes', 'base', val)}
                  ivaVal={v.bienes.iva}       onIva={val  => setV('bienes', 'iva',  val)} />
                <ERow label="Servicios gravados" taxCode="RG-V02"
                  baseVal={v.servicios.base}  onBase={val => setV('servicios', 'base', val)}
                  ivaVal={v.servicios.iva}    onIva={val  => setV('servicios', 'iva',  val)} />
                <ERow label="Exportaciones" taxCode="RG-V03"
                  baseVal={v.exportacion.base} onBase={val => setV('exportacion', 'base', val)}
                  ivaVal={v.exportacion.iva}   onIva={val  => setV('exportacion', 'iva',  val)} />
                <tr>
                  <td style={SUB}>Sumatoria BASE y DÉBITOS</td>
                  <td style={SNUM}>{fmt(liveBaseV)}</td>
                  <td style={SNUM}>{fmt(liveDebito)}</td>
                </tr>

                {/* 5. CRÉDITO FISCAL */}
                <tr>
                  <td style={SEC}>5. CRÉDITO FISCAL POR OPERACIONES LOCALES</td>
                  <td style={CHD}>BASE</td>
                  <td style={CHD}>CRÉDITOS</td>
                </tr>
                <ERow label="Compras de medicamentos genéricos, alternativos y antirretrovirales (exento)"
                  baseVal={c.medicamentos.base} onBase={val => setC('medicamentos', 'base', val)} />
                <ERow label="Compras y servicios de pequeños contribuyentes (sin crédito IVA)" taxCode="RG-C06"
                  baseVal={c.pequenoContribuyente.base} onBase={val => setC('pequenoContribuyente', 'base', val)} />
                <ERow label="Compras de vehículos terrestres — modelo de 2 años o más anteriores al año en curso (exento)"
                  baseVal={c.vehiculosAntiguos.base} onBase={val => setC('vehiculosAntiguos', 'base', val)} />
                <ERow label="Compras de vehículos terrestres — modelo del año en curso, siguiente o anterior"
                  baseVal={c.vehiculosNuevos.base} onBase={val => setC('vehiculosNuevos', 'base', val)}
                  ivaVal={c.vehiculosNuevos.iva}   onIva={val  => setC('vehiculosNuevos', 'iva',  val)} />
                <ERow label="Compras que no generan derecho a compensación del crédito fiscal (Art. 7/8 — incluye IDP y Turismo)" taxCode="RG-C04"
                  baseVal={c.exento.base} onBase={val => setC('exento', 'base', val)} />
                <ERow label="Compras de combustibles" taxCode="RG-C08"
                  baseVal={c.combustibles.base} onBase={val => setC('combustibles', 'base', val)}
                  ivaVal={c.combustibles.iva}   onIva={val  => setC('combustibles', 'iva',  val)} />
                <ERow label="Otras compras y adquisición de bienes" taxCode="RG-C01"
                  baseVal={c.bienes.base} onBase={val => setC('bienes', 'base', val)}
                  ivaVal={c.bienes.iva}   onIva={val  => setC('bienes', 'iva',  val)} />
                <ERow label="Servicios adquiridos" taxCode="RG-C02"
                  baseVal={c.servicios.base} onBase={val => setC('servicios', 'base', val)}
                  ivaVal={c.servicios.iva}   onIva={val  => setC('servicios', 'iva',  val)} />
                <ERow label="Adquisiciones con FYDUCA (Factura Única Centroamericana)"
                  baseVal={c.fyduca.base} onBase={val => setC('fyduca', 'base', val)}
                  ivaVal={c.fyduca.iva}   onIva={val  => setC('fyduca', 'iva',  val)} />
                <ERow label="Importaciones de Centroamérica y del resto del mundo" taxCode="RG-C03"
                  baseVal={c.importacion.base} onBase={val => setC('importacion', 'base', val)}
                  ivaVal={c.importacion.iva}   onIva={val  => setC('importacion', 'iva',  val)} />
                <ERow label="Compras de activos fijos directamente vinculados con el proceso productivo" taxCode="RG-C05"
                  baseVal={c.activosFijos.base} onBase={val => setC('activosFijos', 'base', val)}
                  ivaVal={c.activosFijos.iva}   onIva={val  => setC('activosFijos', 'iva',  val)} />
                <ERow label="Importaciones de activos fijos directamente vinculados con el proceso productivo"
                  baseVal={c.activosFijosImportados.base} onBase={val => setC('activosFijosImportados', 'base', val)}
                  ivaVal={c.activosFijosImportados.iva}   onIva={val  => setC('activosFijosImportados', 'iva',  val)} />
                <ZRow label="IVA conforme constancias de exención recibidas" />
                <ZRow label="Remanente de crédito fiscal del período anterior" />
                <tr>
                  <td style={SUB}>Sumatoria BASE y CRÉDITOS</td>
                  <td style={SNUM}>{fmt(liveBaseC)}</td>
                  <td style={SNUM}>{fmt(liveCredito)}</td>
                </tr>

                {/* 7. DETERMINACIÓN */}
                <tr><td colSpan={3} style={SEC}>7. DETERMINACIÓN DEL CRÉDITO FISCAL O IMPUESTO A PAGAR</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>
                    Crédito fiscal para el período siguiente — resultado de créditos mayores que débitos del presente mes (Créditos &gt; Débitos)
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
                    (-) Constancias de retenciones del IVA recibidas en el período — constancias recibidas de clientes{editMark}
                  </td>
                  <td style={editing ? ENUM : NUM}>
                    <NI val={liveRet}
                      onChange={val => setEv(p => ({ ...p, compras: { ...p.compras, retencionIva: val } }))} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>
                    Saldo de retenciones para el período siguiente
                    <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
                      (si hay crédito se acumulan; si hay débito se aplican para rebajar el débito)
                    </span>
                  </td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td colSpan={2} style={PCELL}>IMPUESTO A PAGAR</td>
                  <td style={PNUM}>{fmt(Math.max(0, livePagar))}</td>
                </tr>

                {/* 8. INDICADORES */}
                <tr><td colSpan={3} style={SEC}>8. INDICADORES COMERCIALES</td></tr>
                <tr>
                  <td colSpan={2} style={CELL}>Indicadores comerciales (base débitos − base créditos)</td>
                  <td style={NUM}>{fmt(liveBaseV - liveBaseC)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={CELL}>Razón ventas y compras (base débitos ÷ base créditos)</td>
                  <td style={NUM}>{liveBaseC > 0 ? (liveBaseV / liveBaseC).toFixed(2) : '0.00'}</td>
                </tr>

                {/* 9.1 CANTIDAD DE OPERACIONES */}
                <tr>
                  <td style={SEC}>9.1 CANTIDAD DE OPERACIONES REALIZADAS</td>
                  <td style={CHD}>EMITIDAS</td>
                  <td style={CHD}>RECIBIDAS</td>
                </tr>
                <CRow label="Facturas (incluir las anuladas)"
                  em={ec.facturas.emitidas}     onEm={v => setCount('facturas', 'emitidas', v)}
                  re={ec.facturas.recibidas}    onRe={v => setCount('facturas', 'recibidas', v)} />
                <CRow label="Factura y Declaración Única Centroamericana FYDUCA"
                  em={ec.fyduca.emitidas}       onEm={v => setCount('fyduca', 'emitidas', v)}
                  re={ec.fyduca.recibidas}      onRe={v => setCount('fyduca', 'recibidas', v)} />
                <CRow label="Constancias de exención"
                  em={ec.exencion.emitidas}     onEm={v => setCount('exencion', 'emitidas', v)}
                  re={ec.exencion.recibidas}    onRe={v => setCount('exencion', 'recibidas', v)} />
                <CRow label="Constancias de adquisición de insumos de producción local"
                  em={ec.insumos.emitidas}      onEm={v => setCount('insumos', 'emitidas', v)}
                  re={ec.insumos.recibidas}     onRe={v => setCount('insumos', 'recibidas', v)} />
                <CRow label="Constancias de retención de IVA"
                  em={ec.retencionIva.emitidas} onEm={v => setCount('retencionIva', 'emitidas', v)}
                  re={ec.retencionIva.recibidas} onRe={v => setCount('retencionIva', 'recibidas', v)} />
                <CRow label="Facturas especiales"
                  em={ec.especiales.emitidas}   onEm={v => setCount('especiales', 'emitidas', v)}
                  re={ec.especiales.recibidas}  onRe={v => setCount('especiales', 'recibidas', v)} />
                <CRow label="Notas de crédito"
                  em={ec.notasCredito.emitidas} onEm={v => setCount('notasCredito', 'emitidas', v)}
                  re={ec.notasCredito.recibidas} onRe={v => setCount('notasCredito', 'recibidas', v)} />
                <CRow label="Notas de débito"
                  em={ec.notasDebito.emitidas}  onEm={v => setCount('notasDebito', 'emitidas', v)}
                  re={ec.notasDebito.recibidas} onRe={v => setCount('notasDebito', 'recibidas', v)} />

                {/* 9.2 MONTO DE OPERACIONES */}
                <tr>
                  <td style={SEC}>9.2 MONTO DE OPERACIONES REALIZADAS</td>
                  <td style={CHD}>EMITIDAS</td>
                  <td style={CHD}>RECIBIDAS</td>
                </tr>
                <tr>
                  <td style={CELL}>
                    Valor de las notas de crédito del período
                    <span style={CODE}>RG-V07 (emitidas) · RG-C07 (recibidas)</span>
                  </td>
                  <td style={NUM}>{snapshot?.notasCredito?.emitidas ? fmt(Number(snapshot.notasCredito.emitidas)) : ''}</td>
                  <td style={NUM}>{snapshot?.notasCredito?.recibidas ? fmt(Number(snapshot.notasCredito.recibidas)) : ''}</td>
                </tr>
                <tr>
                  <td style={CELL}>Valor de las notas de débito del período</td>
                  <td style={NUM}></td>
                  <td style={NUM}></td>
                </tr>

                {/* 11. ACCESORIOS */}
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

          {/* ═══ Botones de acción ══════════════════════════════════════════════ */}
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

      {/* ═══ Historial de declaraciones ════════════════════════════════════════ */}
      {lista.length > 0 && (
        <Card size="small" title="Historial de Declaraciones" style={{ marginTop: 8 }}>
          <Table
            size="small" rowKey="id" pagination={false} dataSource={lista}
            onRow={record => ({ onClick: () => handleSelectHistorial(record), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'Período', key: 'periodo', width: 130,
                render: (_, r) => `${MESES.find(m => m.value === r.mes)?.label} ${r.anio}` },
              { title: 'Estado', dataIndex: 'status', width: 140,
                render: val => <Tag color={STATUS_TAG[val]?.color}>{STATUS_TAG[val]?.label}</Tag> },
              { title: 'Débito Fiscal', dataIndex: 'ivaDebitoFiscal', align: 'right',
                render: val => fmt(Number(val)) },
              { title: 'Crédito Fiscal', dataIndex: 'ivaCreditoFiscal', align: 'right',
                render: val => fmt(Number(val)) },
              { title: 'IVA Neto', dataIndex: 'ivaNeto', align: 'right',
                render: val => {
                  const n = Number(val)
                  return <Text strong style={{ color: n < 0 ? '#059669' : '#dc2626' }}>{fmt(Math.abs(n))}</Text>
                } },
              { title: 'Póliza', dataIndex: 'polizaId', width: 70, align: 'center',
                render: val => val ? <Badge status="success" text="Sí" /> : <Badge status="default" text="No" /> },
              { title: 'Actualizado', dataIndex: 'updatedAt', width: 110,
                render: val => dayjs(val).format('DD/MM/YYYY') },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
