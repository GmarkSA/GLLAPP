import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  Card, Select, Button, Space, Tag, Typography, Table,
  InputNumber, message, Spin, Badge, Divider,
} from 'antd'
import {
  CalculatorOutlined, FileProtectOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined, CloseOutlined, FileDoneOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'

const addBusinessDays = (date: Dayjs, n: number): Dayjs => {
  let count = 0; let d = date
  while (count < n) { d = d.add(1, 'day'); if (d.day() !== 0 && d.day() !== 6) count++ }
  return d
}
const businessDaysForMonth = (mes: number) => (mes === 7 ? 20 : 30)
import { useCompanyStore } from '../../store/companyStore'
import {
  type DeclaracionIva,
  getDeclaracionesIva, generarBorradorIva,
  generarPolizaBorradorIva, marcarIvaPresentada, actualizarDeclaracionIva,
} from '../../api/reportes'

const { Title, Text } = Typography
const { Option } = Select

const BD    = '1px solid #d0d5dd'
const CELL: CSSProperties = { padding: '5px 10px', borderBottom: BD, fontSize: 13, verticalAlign: 'middle' }
const NUM:  CSSProperties = { ...CELL, textAlign: 'right', width: 140, borderLeft: BD, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const SEC:  CSSProperties = { padding: '6px 10px', background: '#1B3A6B', color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 0.3, borderBottom: BD }
const BOLD: CSSProperties = { ...CELL, fontWeight: 700 }
const BNUM: CSSProperties = { ...NUM,  fontWeight: 700 }
const ECELL:CSSProperties = { ...CELL, background: '#fffbe6' }
const ENUM: CSSProperties = { ...NUM,  background: '#fffbe6' }
const PCELL:CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c', fontSize: 14 }
const PNUM: CSSProperties = { ...NUM,  background: '#fff1f0', fontWeight: 700, color: '#b91c1c', fontSize: 14 }

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

interface Edit2046 {
  ingresos:    number
  impuesto:    number
  retencionIva: number
}

const toEdit = (d: DeclaracionIva): Edit2046 => {
  const ingresos = Number(d.baseVentas ?? 0)
  return {
    ingresos,
    impuesto:    Number(d.ivaDebitoFiscal ?? r2(ingresos * 0.05)),
    retencionIva: Number(d.retencionIva ?? 0),
  }
}

export default function Declaracion2046() {
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
  const [ev, setEv] = useState<Edit2046>({ ingresos: 0, impuesto: 0, retencionIva: 0 })

  const syncEdit = useCallback((d: DeclaracionIva) => setEv(toEdit(d)), [])

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
      const result = await actualizarDeclaracionIva(decl.id, {
        baseVentas:       ev.ingresos,
        ivaDebitoFiscal:  ev.impuesto,
        ivaCreditoFiscal: 0,
        baseCompras:      0,
        retencionIva:     ev.retencionIva,
        ventasDesglose:   { ingresos: ev.ingresos, impuesto: ev.impuesto } as Record<string, unknown>,
        comprasDesglose:  { retencionIva: ev.retencionIva } as Record<string, unknown>,
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

  // Con ingresos editables, el impuesto se recalcula automáticamente
  const liveImpuesto = r2(ev.ingresos * 0.05)
  const livePagar    = r2(Math.max(0, ev.impuesto - ev.retencionIva))

  const mesNombre   = MESES.find(m => m.value === mes)?.label ?? ''
  const anioOptions = Array.from({ length: 5 }, (_, i) => now.year() - i)
  const fechaVenc   = addBusinessDays(
    dayjs(`${anio}-${String(mes).padStart(2, '0')}-01`).endOf('month'),
    businessDaysForMonth(mes),
  ).format('DD/MM/YYYY')

  const editMark = editing
    ? <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>▼</span>
    : null

  const NI = ({ val, onChange }: { val: number; onChange: (v: number) => void }) =>
    editing ? (
      <InputNumber size="small" value={val} onChange={v => onChange(v ?? 0)}
        min={0} precision={2} controls={false}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
    ) : (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{val !== 0 ? fmt(val) : ''}</span>
    )

  return (
    <div style={{ padding: 24 }}>
      <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/reportes')}
        style={{ marginBottom: 8 }}>
        Reportes
      </Button>
      <Title level={4} style={{ marginBottom: 0 }}>Declaración IVA — SAT Formulario 2046</Title>
      <Text type="secondary">IVA Pequeño Contribuyente · Régimen de Pequeño Contribuyente · Declaración jurada simplificada mensual (5%)</Text>
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

          {/* ═══ FORMULARIO SAT-2046 ════════════════════════════════════════════ */}
          <div style={{ border: BD, background: '#fff', marginBottom: 16, maxWidth: 620 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup><col /><col style={{ width: 140 }} /></colgroup>
              <tbody>

                {/* Encabezado */}
                <tr>
                  <td colSpan={2} style={{ padding: '12px 16px', background: '#f5f7ff', borderBottom: BD }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1B3A6B' }}>IVA PEQUEÑO CONTRIBUYENTE</div>
                        <div style={{ fontSize: 11, color: '#555' }}>
                          Impuesto al Valor Agregado · Régimen de Pequeño Contribuyente<br />
                          Declaración jurada simplificada y pago mensual
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#1B3A6B' }}>SAT-2046</div>
                        <Tag color={STATUS_TAG[decl.status]?.color}>{STATUS_TAG[decl.status]?.label}</Tag>
                      </div>
                    </div>
                  </td>
                </tr>

                {/* 1. NIT */}
                <tr><td colSpan={2} style={SEC}>1. NIT DEL CONTRIBUYENTE</td></tr>
                <tr>
                  <td colSpan={2} style={{ ...CELL, textAlign: 'center', padding: '10px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{activeCompany?.taxId ?? '—'}</div>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{activeCompany?.legalName ?? ''}</div>
                  </td>
                </tr>

                {/* 2. Período */}
                <tr><td colSpan={2} style={SEC}>2. PERÍODO DE IMPOSICIÓN</td></tr>
                <tr>
                  <td colSpan={2} style={{ ...CELL, textAlign: 'center', padding: '8px' }}>
                    MES:&nbsp;<strong>{mesNombre.toUpperCase()}</strong>
                    &nbsp;&nbsp;&nbsp;AÑO:&nbsp;<strong>{anio}</strong>
                  </td>
                </tr>

                {/* 3. Régimen PC */}
                <tr><td colSpan={2} style={SEC}>3. RÉGIMEN DE PEQUEÑO CONTRIBUYENTE</td></tr>

                <tr>
                  <td style={editing ? ECELL : CELL}>
                    Ingresos por venta de bienes y/o prestación de servicios{editMark}
                  </td>
                  <td style={editing ? ENUM : NUM}>
                    <NI val={ev.ingresos}
                      onChange={v => setEv(p => ({ ...p, ingresos: v, impuesto: r2(v * 0.05) }))} />
                  </td>
                </tr>

                <tr>
                  <td style={BOLD}>
                    Impuesto determinado
                    <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 11, marginLeft: 6 }}>(5% de ingresos)</span>
                  </td>
                  <td style={BNUM}>
                    {fmt(editing ? liveImpuesto : ev.impuesto)}
                  </td>
                </tr>

                <tr>
                  <td style={CELL}>(-) Remanente de retenciones del IVA del período anterior</td>
                  <td style={NUM}>0.00</td>
                </tr>

                <tr>
                  <td style={editing ? ECELL : CELL}>
                    (-) Valor de constancias de retención del IVA recibidas en el período{editMark}
                  </td>
                  <td style={editing ? ENUM : NUM}>
                    <NI val={ev.retencionIva}
                      onChange={v => setEv(p => ({ ...p, retencionIva: v }))} />
                  </td>
                </tr>

                <tr>
                  <td style={CELL}>Saldo de retenciones para el período siguiente</td>
                  <td style={NUM}>0.00</td>
                </tr>

                <tr>
                  <td style={PCELL}>Impuesto a pagar</td>
                  <td style={PNUM}>{fmt(livePagar)}</td>
                </tr>

                {/* 5. Accesorios */}
                <tr><td colSpan={2} style={SEC}>5. ACCESORIOS</td></tr>
                <tr>
                  <td style={CELL}>
                    <span style={{ fontWeight: 600 }}>Fecha máxima de pago sin accesorios</span>
                    <br /><span style={{ fontSize: 11, color: '#666' }}>Según calendario tributario SAT</span>
                  </td>
                  <td style={{ ...NUM, fontWeight: 600 }}>{fechaVenc}</td>
                </tr>
                <tr>
                  <td style={CELL}>(+) Multa formal (por presentación extemporánea)</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td style={CELL}>(+) Intereses</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td style={CELL}>(+) Mora</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td style={CELL}>(=) Accesorios a pagar</td>
                  <td style={NUM}>0.00</td>
                </tr>
                <tr>
                  <td style={PCELL}>TOTAL A PAGAR</td>
                  <td style={PNUM}>{fmt(livePagar)}</td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* ═══ Botones de acción ════════════════════════════════════════════════ */}
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
                <Button icon={<CalculatorOutlined />} onClick={handleCalcular} loading={calcLoading}>
                  Recalcular del sistema
                </Button>
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
                  Modo edición — ingrese el valor real de ingresos del período (▼)
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

      {/* ═══ Historial ════════════════════════════════════════════════════════════ */}
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
              { title: 'Ingresos', dataIndex: 'baseVentas', align: 'right',
                render: v => `Q ${fmt(Number(v))}` },
              { title: 'Impuesto (5%)', dataIndex: 'ivaDebitoFiscal', align: 'right',
                render: v => `Q ${fmt(Number(v))}` },
              { title: 'Retenciones', dataIndex: 'retencionIva', align: 'right',
                render: v => Number(v) > 0 ? `Q ${fmt(Number(v))}` : '—' },
              { title: 'A Pagar', key: 'pagar', align: 'right',
                render: (_, r) => {
                  const p = Math.max(0, Number(r.ivaDebitoFiscal) - Number(r.retencionIva ?? 0))
                  return <Text strong style={{ color: '#dc2626' }}>Q {fmt(p)}</Text>
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
