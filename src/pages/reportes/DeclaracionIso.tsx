import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  Card, Select, Button, Space, Tag, Typography,
  InputNumber, Tooltip, message, Spin, Alert,
} from 'antd'
import {
  CalculatorOutlined, FileProtectOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined, CloseOutlined, FileDoneOutlined,
  ArrowLeftOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  type DeclaracionIso,
  getDeclaracionesIso, generarBorradorIso, generarPolizaBorradorIso,
  marcarIsoPresentada, actualizarDeclaracionIso, sincronizarEstadoIso,
} from '../../api/reportes'

const { Title, Text } = Typography
const { Option } = Select

/**
 * Impuesto de Solidaridad — formulario SAT-1608 (Decreto 73-2008).
 *
 * Se lee como el papel del SAT, bloque por bloque, porque es lo que el
 * contador tiene al lado cuando lo llena. El cálculo lo hace el servidor con
 * la regla de la ley; aquí solo se corrigen las cifras de origen.
 */
const BD    = '1px solid #d0d5dd'
const CELL: CSSProperties = { padding: '4px 10px', borderBottom: BD, fontSize: 12, verticalAlign: 'middle' }
const NUM:  CSSProperties = { ...CELL, textAlign: 'right', width: 150, borderLeft: BD, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const SEC:  CSSProperties = { padding: '5px 10px', background: '#1B3A6B', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, borderBottom: BD, textAlign: 'center' }
const SUB:  CSSProperties = { ...CELL, background: '#eef2fb', fontWeight: 700 }
const SNUM: CSSProperties = { ...NUM,  background: '#eef2fb', fontWeight: 700 }
const ECELL:CSSProperties = { ...CELL, background: '#fffbe6' }
const ENUM: CSSProperties = { ...NUM,  background: '#fffbe6' }
const PCELL:CSSProperties = { ...CELL, background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const PNUM: CSSProperties = { ...NUM,  background: '#fff1f0', fontWeight: 700, color: '#b91c1c' }
const GANA: CSSProperties = { ...NUM,  background: '#f0fdf4', fontWeight: 700, color: '#16a34a' }

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  borrador:        { color: 'default', label: 'Borrador' },
  poliza_generada: { color: 'blue',    label: 'Póliza Borrador' },
  presentada:      { color: 'green',   label: 'Presentada' },
}

const TRIMESTRES = [
  { value: 1, label: '1 (enero a marzo)' },
  { value: 2, label: '2 (abril a junio)' },
  { value: 3, label: '3 (julio a septiembre)' },
  { value: 4, label: '4 (octubre a diciembre)' },
]

const r2  = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Art. 10 — se paga dentro del mes siguiente al cierre del trimestre. */
const vencimiento = (trimestre: number, anio: number) =>
  dayjs(`${anio}-${String(trimestre * 3).padStart(2, '0')}-01`).endOf('month').add(1, 'month').endOf('month')

function NI({ val, onChange, disabled }: { val: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <InputNumber
      size="small" value={val} min={0} step={0.01} disabled={disabled}
      formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      parser={v => Number(String(v).replace(/,/g, ''))}
      onChange={v => onChange(Number(v ?? 0))}
      style={{ width: 146, textAlign: 'right', fontSize: 12 }}
    />
  )
}

export default function DeclaracionIsoPage() {
  const navigate = useNavigate()
  const ahora    = dayjs()

  const [trimestre, setTrimestre] = useState(Math.floor(ahora.month() / 3) + 1)
  const [anio,      setAnio]      = useState(ahora.year())

  const [lista,    setLista]    = useState<DeclaracionIso[]>([])
  const [loading,  setLoading]  = useState(false)
  const [acting,   setActing]   = useState(false)
  const [selected, setSelected] = useState<DeclaracionIso | null>(null)
  const [editing,  setEditing]  = useState(false)

  // Las casillas de origen, editables
  const [vServicios,   setVServicios]   = useState(0)
  const [vVentas,      setVVentas]      = useState(0)
  const [vCosto,       setVCosto]       = useState(0)
  const [vActivo,      setVActivo]      = useState(0)
  const [vDeprec,      setVDeprec]      = useState(0)
  const [vAmort,       setVAmort]       = useState(0)
  const [vReserva,     setVReserva]     = useState(0)
  const [vCreditos,    setVCreditos]    = useState(0)
  const [vExclusiones, setVExclusiones] = useState(0)
  const [vIusi,        setVIusi]        = useState(0)
  const [vIsr,         setVIsr]         = useState(0)

  const syncEdit = (d: DeclaracionIso) => {
    setVServicios(r2(Number(d.ingresosServicios ?? 0)))
    setVVentas(r2(Number(d.ingresosVentas ?? 0)))
    setVCosto(r2(Number(d.costoVentas ?? 0)))
    setVActivo(r2(Number(d.activoTotal ?? 0)))
    setVDeprec(r2(Number(d.depreciacionesAcumuladas ?? 0)))
    setVAmort(r2(Number(d.amortizacionesAcumuladas ?? 0)))
    setVReserva(r2(Number(d.reservaIncobrables ?? 0)))
    setVCreditos(r2(Number(d.creditosFiscales ?? 0)))
    setVExclusiones(r2(Number(d.exclusionesIngresos ?? 0)))
    setVIusi(r2(Number(d.iusiPagado ?? 0)))
    setVIsr(r2(Number(d.isrAcreditado ?? 0)))
  }

  const cargarLista = useCallback(async (actual?: DeclaracionIso | null) => {
    setLoading(true)
    try {
      const datos = await getDeclaracionesIso()
      setLista(datos)
      if (actual) {
        const fresca = datos.find(d => d.id === actual.id)
        if (fresca && fresca.status !== actual.status) { setSelected(fresca); syncEdit(fresca) }
      }
    } catch { setLista([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargarLista() }, [cargarLista])

  const seleccionar = (d: DeclaracionIso) => { setSelected(d); setEditing(false); syncEdit(d) }

  const n = (f: keyof DeclaracionIso) => r2(Number(selected?.[f] ?? 0))

  const generarBorrador = async () => {
    setActing(true)
    try {
      const d = await generarBorradorIso(trimestre, anio)
      await cargarLista(); seleccionar(d)
      message.success(`Borrador del ISO ${trimestre}T/${anio} calculado con el cierre de ${d.anioBase}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo calcular el borrador', 8)
    } finally { setActing(false) }
  }

  const guardar = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await actualizarDeclaracionIso(selected.id, {
        ingresosServicios: vServicios, ingresosVentas: vVentas, costoVentas: vCosto,
        activoTotal: vActivo, depreciacionesAcumuladas: vDeprec,
        amortizacionesAcumuladas: vAmort, reservaIncobrables: vReserva,
        creditosFiscales: vCreditos, exclusionesIngresos: vExclusiones,
        iusiPagado: vIusi, isrAcreditado: vIsr,
      })
      await cargarLista(); seleccionar(d); setEditing(false)
      message.success('Declaración actualizada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo guardar', 8)
    } finally { setActing(false) }
  }

  const generarPoliza = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await generarPolizaBorradorIso(selected.id)
      await cargarLista(); seleccionar(d)
      message.success('Póliza borrador generada — Dr ISO por acreditar / Cr ISO por pagar')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo generar la póliza', 10)
    } finally { setActing(false) }
  }

  const sincronizar = async () => {
    if (!selected) return
    setActing(true)
    try { const d = await sincronizarEstadoIso(selected.id); await cargarLista(); seleccionar(d) }
    catch { /* informativo: si falla se conserva lo que ya se mostraba */ }
    finally { setActing(false) }
  }

  const marcarPresentada = async () => {
    if (!selected) return
    setActing(true)
    try {
      const d = await marcarIsoPresentada(selected.id)
      await cargarLista(); seleccionar(d)
      message.success('Declaración marcada como presentada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setActing(false) }
  }

  const cancelarEdicion = () => { if (selected) syncEdit(selected); setEditing(false) }

  const ganaActivo = selected?.baseAplicada === 'activo_neto'
  const marca = editing ? <span style={{ color: '#d48806', fontSize: 10, marginLeft: 4 }}>✎</span> : null

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/reportes')} />
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Impuesto de Solidaridad — SAT-1608</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Trimestral. La base sale del cierre del año anterior; se paga dentro del mes siguiente al trimestre.
          </Text>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* ── Panel izquierdo ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select value={trimestre} onChange={setTrimestre} size="small" style={{ width: '100%' }}>
                {TRIMESTRES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
              </Select>
              <Select value={anio} onChange={setAnio} size="small" style={{ width: '100%' }}>
                {[ahora.year() + 1, ahora.year(), ahora.year() - 1, ahora.year() - 2].map(y =>
                  <Option key={y} value={y}>{y}</Option>)}
              </Select>
              <Button type="primary" icon={<CalculatorOutlined />} size="small"
                style={{ background: '#1B3A6B', width: '100%' }}
                loading={acting} onClick={generarBorrador}>
                Calcular borrador
              </Button>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Se calcula con el cierre de {anio - 1}.
              </Text>
            </Space>
          </Card>

          <Card size="small" title={<span style={{ fontSize: 12, fontWeight: 700 }}>Historial</span>}
            style={{ borderRadius: 8 }}>
            {loading
              ? <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
              : lista.length === 0
                ? <Text type="secondary" style={{ fontSize: 11 }}>Sin declaraciones aún</Text>
                : lista.map(r => (
                  <div key={r.id} onClick={() => seleccionar(r)}
                    style={{
                      padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                      background: selected?.id === r.id ? '#e6f4ff' : 'transparent',
                      border: selected?.id === r.id ? '1px solid #91caff' : '1px solid transparent',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 12 }}>{r.trimestre}T {r.anio}</Text>
                      <Tag color={STATUS_TAG[r.status]?.color ?? 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {STATUS_TAG[r.status]?.label ?? r.status}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Impuesto</Text>
                      <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        Q {fmt(Number(r.impuestoDeterminado))}
                      </Text>
                    </div>
                  </div>
                ))
            }
          </Card>
        </div>

        {/* ── El formulario ────────────────────────────────────────────── */}
        {!selected
          ? (
            <Card style={{ borderRadius: 8, textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Elige un trimestre y calcula el borrador.</Text>
            </Card>
          )
          : (
            <Card size="small" style={{ borderRadius: 8 }}
              title={
                <Space>
                  <Text strong style={{ color: '#1B3A6B' }}>
                    Trimestre {selected.trimestre} — {selected.anio}
                  </Text>
                  <Tag color={STATUS_TAG[selected.status]?.color ?? 'default'}>
                    {STATUS_TAG[selected.status]?.label ?? selected.status}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Base: cierre de {selected.anioBase} · Vence {vencimiento(selected.trimestre, selected.anio).format('DD/MM/YYYY')}
                  </Text>
                </Space>
              }
              extra={
                <Space size={4}>
                  {!editing && selected.status !== 'presentada' && (
                    <Tooltip title="Corregir las cifras del formulario">
                      <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)} />
                    </Tooltip>
                  )}
                  {editing && (
                    <>
                      <Button size="small" icon={<CloseOutlined />} onClick={cancelarEdicion}>Cancelar</Button>
                      <Button size="small" type="primary" icon={<SaveOutlined />}
                        style={{ background: '#1B3A6B' }} loading={acting} onClick={guardar}>
                        Guardar
                      </Button>
                    </>
                  )}
                  {!editing && selected.status !== 'presentada' && selected.afecto && (
                    <Button size="small" icon={<FileProtectOutlined />} loading={acting} onClick={generarPoliza}>
                      Generar póliza
                    </Button>
                  )}
                  {!editing && selected.status === 'poliza_generada' && (
                    <>
                      <Button size="small" icon={<SyncOutlined />} loading={acting} onClick={sincronizar}>
                        Sincronizar
                      </Button>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                        style={{ background: '#16a34a' }} loading={acting} onClick={marcarPresentada}>
                        Presentada
                      </Button>
                    </>
                  )}
                </Space>
              }
            >
              {!selected.afecto && (
                <Alert
                  type="info" showIcon style={{ marginBottom: 12 }}
                  message={`Margen bruto de ${fmt(Number(selected.margenBrutoPct))}% — no afecto`}
                  description="La ley solo afecta a quien supera el 4% de margen bruto (art. 2 del Decreto 73-2008). Con este margen no hay ISO que pagar ni póliza que generar."
                />
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', border: BD }}>
                <tbody>
                  {/* ── 3. Margen bruto ─────────────────────────────── */}
                  <tr><td style={SEC} colSpan={2}>3. DETERMINACIÓN DEL MARGEN BRUTO %</td></tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      Total ingresos brutos por servicios prestados ({selected.anioBase}){marca}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vServicios} onChange={setVServicios} /> : fmt(n('ingresosServicios'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>Total ingresos brutos por ventas ({selected.anioBase}){marca}</td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vVentas} onChange={setVVentas} /> : fmt(n('ingresosVentas'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      Total costo de ventas (sin gastos de ventas ni administrativos){marca}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vCosto} onChange={setVCosto} /> : fmt(n('costoVentas'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={SUB}>Total ingresos brutos menos total costo de ventas</td>
                    <td style={SNUM}>{fmt(n('margenBruto'))}</td>
                  </tr>
                  <tr>
                    <td style={SUB}>MARGEN BRUTO % (afecto si es mayor al 4%)</td>
                    <td style={{ ...SNUM, color: selected.afecto ? '#16a34a' : '#b91c1c' }}>
                      {fmt(n('margenBrutoPct'))}
                    </td>
                  </tr>

                  {/* ── 4. Activo neto ──────────────────────────────── */}
                  <tr><td style={SEC} colSpan={2}>4. BASE IMPONIBLE SEGÚN ACTIVO NETO</td></tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>Activo total{marca}</td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vActivo} onChange={setVActivo} /> : fmt(n('activoTotal'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>(−) Depreciaciones acumuladas{marca}</td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vDeprec} onChange={setVDeprec} /> : fmt(n('depreciacionesAcumuladas'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>(−) Amortizaciones acumuladas{marca}</td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vAmort} onChange={setVAmort} /> : fmt(n('amortizacionesAcumuladas'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>(−) Reserva para cuentas incobrables{marca}</td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vReserva} onChange={setVReserva} /> : fmt(n('reservaIncobrables'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>(−) Créditos fiscales pendientes de reintegro{marca}</td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vCreditos} onChange={setVCreditos} /> : fmt(n('creditosFiscales'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={SUB}>Activo neto</td>
                    <td style={SNUM}>{fmt(n('activoNeto'))}</td>
                  </tr>
                  <tr>
                    <td style={SUB}>Base imponible (según activo neto)</td>
                    <td style={ganaActivo ? GANA : SNUM}>{fmt(n('baseActivoNeto'))}</td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (−) IUSI pagado en el trimestre {!ganaActivo && (
                        <Text type="secondary" style={{ fontSize: 10 }}>— solo aplica con esta base</Text>
                      )}{marca}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vIusi} onChange={setVIusi} /> : fmt(n('iusiPagado'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={SUB}>Impuesto (según activo neto)</td>
                    <td style={ganaActivo ? GANA : SNUM}>{fmt(n('impuestoActivoNeto'))}</td>
                  </tr>

                  {/* ── 5. Ingresos brutos ──────────────────────────── */}
                  <tr><td style={SEC} colSpan={2}>5. BASE IMPONIBLE SEGÚN INGRESOS BRUTOS</td></tr>
                  <tr>
                    <td style={CELL}>Ingresos brutos ({selected.anioBase})</td>
                    <td style={NUM}>{fmt(n('ingresosBrutos'))}</td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (−) Resarcimientos de seguro, reaseguro y primas cedidas{marca}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vExclusiones} onChange={setVExclusiones} /> : fmt(n('exclusionesIngresos'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={SUB}>Base imponible (según ingresos brutos)</td>
                    <td style={!ganaActivo ? GANA : SNUM}>{fmt(n('baseIngresosBrutos'))}</td>
                  </tr>
                  <tr>
                    <td style={SUB}>Impuesto (según ingresos brutos)</td>
                    <td style={!ganaActivo ? GANA : SNUM}>{fmt(n('impuestoIngresosBrutos'))}</td>
                  </tr>

                  {/* ── 6. Determinación ────────────────────────────── */}
                  <tr><td style={SEC} colSpan={2}>6. DETERMINACIÓN DEL IMPUESTO</td></tr>
                  <tr>
                    <td style={SUB}>
                      Impuesto determinado — base aplicada:{' '}
                      {ganaActivo ? 'activo neto' : 'ingresos brutos'}
                    </td>
                    <td style={SNUM}>{fmt(n('impuestoDeterminado'))}</td>
                  </tr>
                  <tr>
                    <td style={editing ? ECELL : CELL}>
                      (−) ISR trimestral acreditado al ISO (art. 11){marca}
                    </td>
                    <td style={editing ? ENUM : NUM}>
                      {editing ? <NI val={vIsr} onChange={setVIsr} /> : fmt(n('isrAcreditado'))}
                    </td>
                  </tr>
                  <tr>
                    <td style={PCELL}>TOTAL A PAGAR</td>
                    <td style={PNUM}>Q {fmt(n('impuestoAPagar'))}</td>
                  </tr>
                </tbody>
              </table>

              <Alert
                type="info" showIcon style={{ marginTop: 12 }}
                icon={<FileDoneOutlined />}
                message="El ISO no es gasto: es un derecho contra el fisco"
                description={
                  'La póliza asienta Dr «ISO por acreditar» (activo) / Cr «ISO por pagar» (pasivo). '
                  + 'El artículo 11 lo deja acreditable al ISR durante los tres años calendario siguientes; '
                  + 'solo si vence ese plazo sin acreditarse se vuelve gasto deducible. '
                  + 'Las dos cuentas se configuran en Configuración › Cuentas por defecto.'
                }
              />
            </Card>
          )
        }
      </div>
    </div>
  )
}
