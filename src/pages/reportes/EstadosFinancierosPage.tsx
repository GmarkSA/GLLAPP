import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select, Tabs, Spin, Empty, Typography, Card, Button, Switch, Space, message } from 'antd'
import { ArrowLeftOutlined, PrinterOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import {
  getBalanceGeneral, getEstadoResultados, descargarEstadosFinancierosExcel,
  type BalanceGeneralData, type EstadoResultadosData, type AccountRow,
} from '../../api/reportes'
import { getDetalleIntegracion, type DetalleResult } from '../../api/integraciones'
import {
  construirHoja, cuentasAIntegrar,
  type BloqueDeHoja, type CuentaConIntegracion,
} from './excelConIntegracion'
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

// ─── Línea de resultado (no es una cuenta del catálogo) ──────────────────────
function LineaDeResultado({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {Q(value)}
      </Text>
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
  /** Avance de la descarga con integración: null cuando no se está armando. */
  const [avanceExcel, setAvanceExcel] = useState<{ hechas: number; total: number } | null>(null)

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

  // ── Impresión (PDF por ruta real) y exportación a Excel ───────────────────
  const printUrl = `/reportes/estados-financieros/${anio}/${mes}/imprimir`

  const exportEstadosExcel = () => {
    const wb = XLSX.utils.book_new()
    const pushGroup = (rows: any[][], title: string, g?: { accounts: AccountRow[]; total: number }) => {
      if (!g) return
      rows.push([title])
      g.accounts.filter(a => Number(a.balance) !== 0).forEach(a => rows.push([a.code, a.name, Number(a.balance)]))
      rows.push(['', `Total ${title}`, Number(g.total)])
    }
    if (bg) {
      const r: any[][] = [['Balance General', `Al ${dayjs(endOfMonth).format('DD/MM/YYYY')}`], []]
      pushGroup(r, 'Activo Circulante', bg.activo)
      pushGroup(r, 'Activo Fijo', bg.activoFijo)
      r.push(['', 'TOTAL ACTIVOS', Number(bg.totalActivo)])
      pushGroup(r, 'Pasivo', bg.pasivo)
      pushGroup(r, 'Capital', bg.capital)
      r.push(['', 'Resultado de Ejercicios Anteriores', Number(bg.resultadoEjerciciosAnteriores ?? 0)])
      r.push(['', 'Resultado del Período', Number(bg.resultadoDelPeriodo ?? bg.netIncome)])
      r.push(['', 'Total Capital', Number(bg.totalCapital)])
      r.push(['', 'TOTAL PASIVO + CAPITAL', Number(bg.totalPasivoCapital)])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), 'Balance General')
    }
    if (er) {
      const r: any[][] = [['Estado de Resultados', `Del ${dayjs(jan1).format('DD/MM/YYYY')} al ${dayjs(endOfMonth).format('DD/MM/YYYY')}`], []]
      pushGroup(r, 'Ingresos', er.ingresos)
      pushGroup(r, 'Otros Ingresos', er.otrosIngresos)
      pushGroup(r, 'Costos', er.costos)
      r.push(['', 'UTILIDAD BRUTA', Number(er.utilidadBruta)])
      pushGroup(r, 'Gastos', er.gastos)
      pushGroup(r, 'Otros Gastos', er.otrosGastos)
      r.push(['', 'UTILIDAD NETA', Number(er.utilidadNeta)])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), 'Estado de Resultados')
    }
    XLSX.writeFile(wb, `estados_financieros_${anio}_${String(mes).padStart(2, '0')}.xlsx`)
  }

  /**
   * El Excel con la integración de cada cuenta, desplegable.
   *
   * Hay que traer el detalle cuenta por cuenta: se usa el MISMO endpoint que
   * alimenta el panel de la derecha, no una segunda versión del cálculo. Son
   * muchas llamadas, así que van de cinco en cinco y el botón va contando —
   * una cuenta que falle no tumba la descarga: baja sin su detalle y el resto
   * sigue.
   */
  const traerIntegraciones = async (
    cuentas: { id: string; code: string; name: string; balance: number }[],
    esResultado: boolean,
    avanzar: () => void,
  ): Promise<CuentaConIntegracion[]> => {
    const resultado: CuentaConIntegracion[] = new Array(cuentas.length)
    const porTanda = 5
    for (let i = 0; i < cuentas.length; i += porTanda) {
      const tanda = cuentas.slice(i, i + porTanda)
      await Promise.all(tanda.map(async (c, j) => {
        const base = { code: c.code, name: c.name, balance: Number(c.balance) }
        try {
          const det = await getDetalleIntegracion(c.id, mes, anio, esResultado ? jan1 : undefined)
          resultado[i + j] = { ...base, lineas: det?.lineas ?? [] }
        } catch {
          resultado[i + j] = { ...base, lineas: [] }
        } finally {
          avanzar()
        }
      }))
    }
    return resultado
  }

  /**
   * La descarga: la arma el servidor.
   *
   * Allá está el logo de la empresa —vive en R2— y la integración de cada
   * cuenta sale al lado de la base, no en cien viajes desde el navegador. Si
   * el servidor no puede (una versión vieja, un 404), se cae a la versión que
   * arma el navegador, que es la que había: una descarga que no baja es peor
   * que una descarga sin portada.
   */
  const exportarConIntegracion = async () => {
    if (!bg && !er) return
    setAvanceExcel({ hechas: 0, total: 0 })
    try {
      await descargarEstadosFinancierosExcel(mes, anio)
      message.success('Listo: abre el signo + de cada cuenta para ver su integración')
      return
    } catch {
      message.info('Armando la descarga desde el navegador…')
    } finally {
      setAvanceExcel(null)
    }
    await exportarConIntegracionLocal()
  }

  const exportarConIntegracionLocal = async () => {
    if (!bg && !er) return
    const conSaldo = (g?: { accounts: AccountRow[] }) =>
      (g?.accounts ?? []).filter(a => Number(a.balance) !== 0)

    const gruposBalance: { titulo: string; cuentas: AccountRow[]; total: number }[] = bg ? [
      { titulo: 'Activo Circulante', cuentas: conSaldo(bg.activo),     total: Number(bg.activo?.total ?? 0) },
      { titulo: 'Activo Fijo',       cuentas: conSaldo(bg.activoFijo), total: Number(bg.activoFijo?.total ?? 0) },
      { titulo: 'Pasivo',            cuentas: conSaldo(bg.pasivo),     total: Number(bg.pasivo?.total ?? 0) },
      { titulo: 'Capital',           cuentas: conSaldo(bg.capital),    total: Number(bg.capital?.total ?? 0) },
    ] : []

    const gruposResultado: { titulo: string; cuentas: AccountRow[]; total: number }[] = er ? [
      { titulo: 'Ingresos',       cuentas: conSaldo(er.ingresos),      total: Number(er.ingresos?.total ?? 0) },
      { titulo: 'Otros Ingresos', cuentas: conSaldo(er.otrosIngresos), total: Number(er.otrosIngresos?.total ?? 0) },
      { titulo: 'Costos',         cuentas: conSaldo(er.costos),        total: Number(er.costos?.total ?? 0) },
      { titulo: 'Gastos',         cuentas: conSaldo(er.gastos),        total: Number(er.gastos?.total ?? 0) },
      { titulo: 'Otros Gastos',   cuentas: conSaldo(er.otrosGastos),   total: Number(er.otrosGastos?.total ?? 0) },
    ] : []

    const total = [...gruposBalance, ...gruposResultado].reduce((n, g) => n + g.cuentas.length, 0)
    if (total === 0) { message.info('No hay cuentas con movimiento para integrar'); return }

    let hechas = 0
    setAvanceExcel({ hechas: 0, total })
    const avanzar = () => { hechas += 1; setAvanceExcel({ hechas, total }) }

    try {
      const wb = XLSX.utils.book_new()

      const armarHoja = async (
        titulo: string, subtitulo: string,
        grupos: { titulo: string; cuentas: AccountRow[]; total: number }[],
        esResultado: boolean,
        totalesFinales: { etiqueta: string; valor: number }[],
        totalesIntermedios: Record<string, { etiqueta: string; valor: number }> = {},
      ) => {
        const bloques: BloqueDeHoja[] = []
        for (const g of grupos) {
          const cuentas = await traerIntegraciones(g.cuentas, esResultado, avanzar)
          bloques.push({ tipo: 'grupo', grupo: { titulo: g.titulo, cuentas, total: g.total } })
          const intermedio = totalesIntermedios[g.titulo]
          if (intermedio) bloques.push({ tipo: 'total', total: intermedio })
        }
        for (const t of totalesFinales) bloques.push({ tipo: 'total', total: t })

        const hoja = construirHoja(titulo, subtitulo, bloques)
        const ws = XLSX.utils.aoa_to_sheet(hoja.aoa)
        ws['!rows'] = hoja.rows
        ws['!cols'] = hoja.anchos
        // El signo +/− va ARRIBA del detalle, en la fila de la cuenta.
        ;(ws as any)['!outline'] = { above: true }
        XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
      }

      if (bg) {
        await armarHoja(
          'Balance General', `Al ${dayjs(endOfMonth).format('DD/MM/YYYY')}`,
          gruposBalance, false,
          [{ etiqueta: 'TOTAL PASIVO + CAPITAL', valor: Number(bg.totalPasivoCapital) }],
          { 'Activo Fijo': { etiqueta: 'TOTAL ACTIVOS', valor: Number(bg.totalActivo) } },
        )
      }
      if (er) {
        await armarHoja(
          'Estado de Resultados',
          `Del ${dayjs(jan1).format('DD/MM/YYYY')} al ${dayjs(endOfMonth).format('DD/MM/YYYY')}`,
          gruposResultado, true,
          [{ etiqueta: 'UTILIDAD NETA', valor: Number(er.utilidadNeta) }],
          { Costos: { etiqueta: 'UTILIDAD BRUTA', valor: Number(er.utilidadBruta) } },
        )
      }

      XLSX.writeFile(wb, `estados_financieros_integrado_${anio}_${String(mes).padStart(2, '0')}.xlsx`)
      message.success('Listo: abre el signo + de cada cuenta para ver sus movimientos')
    } catch {
      message.error('No se pudo armar el archivo con la integración')
    } finally {
      setAvanceExcel(null)
    }
  }

  const printExcelBtns = (
    <Space size={6}>
      <Button size="small" icon={<PrinterOutlined />}
        onClick={() => window.open(printUrl, '_blank', 'width=900,height=700')}>
        Imprimir
      </Button>
      <Button size="small" icon={<DownloadOutlined />} onClick={exportEstadosExcel}>
        Excel
      </Button>
      <Button
        size="small" type="primary" icon={<DownloadOutlined />}
        style={{ background: NAVY }}
        loading={!!avanceExcel}
        onClick={exportarConIntegracion}
      >
        {!avanceExcel
          ? 'Excel con integración'
          : avanceExcel.total
            ? `Integrando ${avanceExcel.hechas}/${avanceExcel.total}…`
            : 'Preparando…'}
      </Button>
    </Space>
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
          {/*
            Los dos resultados. No son cuentas del catálogo —viven en ingresos
            y gastos—, pero el capital no suma su total sin ellos: el de los
            años que no se cerraron era, exactamente, la diferencia que el
            balance no cuadraba.
          */}
          <LineaDeResultado label="Resultado de Ejercicios Anteriores" value={bg.resultadoEjerciciosAnteriores ?? 0} />
          <LineaDeResultado label="Resultado del Período" value={bg.resultadoDelPeriodo ?? bg.netIncome} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Total Capital</Text>
            <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {Q(bg.totalCapital)}
            </Text>
          </div>
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
              <Tabs items={tabs} size="small" tabBarExtraContent={printExcelBtns} />
            </Spin>
          </div>
        </Card>

        {/* Derecha: Integración / detalle de la cuenta — crece con el contenido */}
        <Card size="small" style={{ flex: '1 1 520px', minWidth: 380, borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
          <div style={{ padding: 16, minHeight: 200 }}>
            {!selected ? (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
                <Empty description="Selecciona una cuenta a la izquierda para ver su detalle e integración" />
              </div>
            ) : loadingDet ? (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}><Spin /></div>
            ) : detalle ? (
              <DetallePanel detalle={detalle} mes={mes} anio={anio} />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
                <Empty description={`Sin detalle para ${selected.code} — ${selected.name}`} />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
