import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select, Tabs, Spin, Empty, Typography, Card, Button, Switch } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBalanceGeneral, getEstadoResultados,
  type BalanceGeneralData, type EstadoResultadosData, type AccountRow,
} from '../../api/reportes'
import { getDetalleIntegracion, type DetalleResult } from '../../api/integraciones'
import { DetallePanel } from './IntegracionesContablesPage'

const { Title, Text } = Typography

const Q = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const NAVY = '#1B3A6B'

type Selected = { id: string; code: string; name: string; esResultado?: boolean } | null

// ─── Fila de cuenta clicable ─────────────────────────────────────────────────
function AccountRowItem({ acc, active, onClick }: {
  acc: AccountRow; active: boolean; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        padding: '5px 10px', borderRadius: 6,
        background: active ? '#eff6ff' : 'transparent',
        borderLeft: active ? `3px solid ${NAVY}` : '3px solid transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9aa1ab', width: 66, flexShrink: 0 }}>
        {acc.code}
      </Text>
      <Text style={{ fontSize: 13, flex: 1 }} ellipsis>{acc.name}</Text>
      <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {Q(acc.balance)}
      </Text>
    </div>
  )
}

// ─── Grupo de cuentas con subtotal ───────────────────────────────────────────
function Group({ title, accounts, total, selectedId, onSelect, color = '#6b7280' }: {
  title: string; accounts: AccountRow[]; total: number
  selectedId?: string; onSelect: (a: AccountRow) => void; color?: string
}) {
  if (!accounts.length && total === 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        color, borderBottom: '1px solid #e2e8f0', padding: '4px 10px 4px', marginBottom: 2,
      }}>
        {title}
      </div>
      {accounts.map(a => (
        <AccountRowItem key={a.id} acc={a} active={selectedId === a.id} onClick={() => onSelect(a)} />
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', marginTop: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Total {title}</Text>
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {Q(total)}
        </Text>
      </div>
    </div>
  )
}

// ─── Fila de total mayor ─────────────────────────────────────────────────────
function GrandTotal({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 10px', background: '#eff6ff', borderRadius: 6, marginBottom: 12,
    }}>
      <Text style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{label}</Text>
      <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>
        {Q(value)}
      </Text>
    </div>
  )
}

export default function EstadosFinancierosPage() {
  const navigate = useNavigate()
  const now = dayjs()
  const [mes,  setMes]  = useState(now.month() + 1)
  const [anio, setAnio] = useState(now.year())

  const [bg, setBg] = useState<BalanceGeneralData | null>(null)
  const [er, setEr] = useState<EstadoResultadosData | null>(null)
  const [loadingLeft, setLoadingLeft] = useState(true)

  const [soloConMovimiento, setSoloConMovimiento] = useState(false)
  const [selected, setSelected] = useState<Selected>(null)
  const [detalle,  setDetalle]  = useState<DetalleResult | null>(null)
  const [loadingDet, setLoadingDet] = useState(false)

  const endOfMonth = dayjs(`${anio}-${String(mes).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD')
  const jan1       = `${anio}-01-01`

  // Balance (saldos acumulados al fin de mes) + Estado de Resultados (01-ene → fin de mes)
  useEffect(() => {
    setLoadingLeft(true)
    Promise.all([
      getBalanceGeneral({ date: endOfMonth }),
      getEstadoResultados({ fromDate: jan1, toDate: endOfMonth }),
    ])
      .then(([b, e]) => { setBg(b); setEr(e) })
      .catch(() => { setBg(null); setEr(null) })
      .finally(() => setLoadingLeft(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio])

  // Detalle de la cuenta seleccionada (drill-down)
  useEffect(() => {
    if (!selected) { setDetalle(null); return }
    setLoadingDet(true)
    const fromDate = selected.esResultado ? jan1 : undefined
    getDetalleIntegracion(selected.id, mes, anio, fromDate)
      .then(setDetalle)
      .catch(() => setDetalle(null))
      .finally(() => setLoadingDet(false))
  }, [selected, mes, anio])

  const onSelectBalance   = (a: AccountRow) => setSelected({ id: a.id, code: a.code, name: a.name, esResultado: false })
  const onSelectResultado = (a: AccountRow) => setSelected({ id: a.id, code: a.code, name: a.name, esResultado: true  })
  const selId = selected?.id
  const fil = (accs: AccountRow[]) => soloConMovimiento ? accs.filter(a => a.balance !== 0) : accs

  const filtroSwitch = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Switch size="small" checked={soloConMovimiento} onChange={setSoloConMovimiento} />
      <Text style={{ fontSize: 11, color: '#6b7280' }}>Solo con movimiento</Text>
    </div>
  )

  const tabs = [
    {
      key: 'balance',
      label: 'Balance General',
      children: !bg ? <Empty description="Sin datos" /> : (
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
            Saldos acumulados al {dayjs(endOfMonth).format('DD/MM/YYYY')}
          </Text>
          {filtroSwitch}
          <Group title="Activo Circulante" accounts={fil(bg.activo.accounts)} total={bg.activo.total} selectedId={selId} onSelect={onSelectBalance} color={NAVY} />
          <Group title="Activo Fijo" accounts={fil(bg.activoFijo.accounts)} total={bg.activoFijo.total} selectedId={selId} onSelect={onSelectBalance} color={NAVY} />
          <GrandTotal label="TOTAL ACTIVOS" value={bg.totalActivo} />
          <Group title="Pasivo" accounts={fil(bg.pasivo.accounts)} total={bg.pasivo.total} selectedId={selId} onSelect={onSelectBalance} color="#b45309" />
          <Group title="Capital" accounts={fil(bg.capital.accounts)} total={bg.capital.total} selectedId={selId} onSelect={onSelectBalance} color="#7c3aed" />
          <GrandTotal label="TOTAL PASIVO + CAPITAL" value={bg.totalPasivoCapital} />
        </div>
      ),
    },
    {
      key: 'resultados',
      label: 'Estado de Resultados',
      children: !er ? <Empty description="Sin datos" /> : (
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
            Del {dayjs(jan1).format('DD/MM/YYYY')} al {dayjs(endOfMonth).format('DD/MM/YYYY')} (acumulado)
          </Text>
          {filtroSwitch}
          <Group title="Ingresos" accounts={fil(er.ingresos.accounts)} total={er.ingresos.total} selectedId={selId} onSelect={onSelectResultado} color="#2ea172" />
          <Group title="Otros Ingresos" accounts={fil(er.otrosIngresos.accounts)} total={er.otrosIngresos.total} selectedId={selId} onSelect={onSelectResultado} color="#2ea172" />
          <Group title="Costos" accounts={fil(er.costos.accounts)} total={er.costos.total} selectedId={selId} onSelect={onSelectResultado} color="#e5484d" />
          <GrandTotal label="UTILIDAD BRUTA" value={er.utilidadBruta} />
          <Group title="Gastos" accounts={fil(er.gastos.accounts)} total={er.gastos.total} selectedId={selId} onSelect={onSelectResultado} color="#e5484d" />
          <Group title="Otros Gastos" accounts={fil(er.otrosGastos.accounts)} total={er.otrosGastos.total} selectedId={selId} onSelect={onSelectResultado} color="#e5484d" />
          <GrandTotal label="UTILIDAD NETA" value={er.utilidadNeta} />
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Estados Financieros</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>Balance General y Estado de Resultados con integraciones por cuenta</Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select value={mes} onChange={setMes} style={{ width: 130 }}
            options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />
          <Select value={anio} onChange={setAnio} style={{ width: 90 }}
            options={Array.from({ length: 4 }, (_, i) => ({ value: now.year() - i, label: String(now.year() - i) }))} />
        </div>
      </div>

      {/* Split layout — paneles con scroll independiente */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Izquierda: Balance / Estado de Resultados — scroll independiente */}
        <Card size="small" style={{ flex: '1 1 420px', minWidth: 340, borderRadius: 10, position: 'sticky', top: 0 }} bodyStyle={{ padding: 0 }}>
          <div style={{ height: 'calc(100vh - 130px)', overflowY: 'auto', padding: '4px 12px 12px' }}>
            <Spin spinning={loadingLeft}>
              <Tabs items={tabs} size="small" />
            </Spin>
          </div>
        </Card>

        {/* Derecha: Integración / detalle — misma altura del bloque izquierdo, scroll independiente */}
        <Card size="small" style={{ flex: '1 1 520px', minWidth: 380, borderRadius: 10, position: 'sticky', top: 0 }} bodyStyle={{ padding: 0 }}>
          <div style={{ height: 'calc(100vh - 130px)', overflowY: 'auto', padding: 16 }}>
            {!selected ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <Empty description="Selecciona una cuenta a la izquierda para ver su detalle e integración" />
              </div>
            ) : loadingDet ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Spin /></div>
            ) : detalle ? (
              <DetallePanel detalle={detalle} mes={mes} anio={anio} />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <Empty description={`Sin detalle para ${selected.code} — ${selected.name}`} />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
