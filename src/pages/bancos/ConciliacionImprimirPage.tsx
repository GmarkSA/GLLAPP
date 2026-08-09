import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  getBankAccount,
  getTransactions,
  listReconciliationPeriods,
  type BankAccount,
  type BankTransaction,
  type ReconciliationPeriod,
} from '../../api/bancos'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'

dayjs.locale('es')

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_LABEL: Record<string, string> = {
  reconciled:  'Conciliada',
  categorized: 'Categorizada',
  matched:     'Coincidencia',
  pending:     'Pendiente',
  excluded:    'Excluida',
  voided:      'Anulada',
}

const STATUS_SYMBOL: Record<string, string> = {
  reconciled:  '✓',
  categorized: '◈',
  matched:     '≈',
  pending:     '○',
  excluded:    '∅',
  voided:      '✗',
}

const fmt = (n: number) =>
  `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ConciliacionImprimirPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const user = useAuthStore(s => s.user)

  const month = Number(params.get('month') || dayjs().month() + 1)
  const year  = Number(params.get('year')  || dayjs().year())

  const [account,  setAccount]  = useState<BankAccount | null>(null)
  const [period,   setPeriod]   = useState<ReconciliationPeriod | null>(null)
  const [rows,     setRows]     = useState<BankTransaction[]>([])
  const [loading,  setLoading]  = useState(true)
  const [printedAt] = useState(() => dayjs().format('DD/MM/YYYY HH:mm'))

  useEffect(() => {
    if (!id) return
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`
    const toDate   = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD')

    Promise.all([
      getBankAccount(id),
      getTransactions(id, { limit: 500, fromDate, toDate }),
      listReconciliationPeriods(id).catch(() => []),
    ]).then(([acc, txRes, periods]) => {
      setAccount(acc)
      // Filter on client side too — ensures no cross-period leakage
      const filtered = (txRes.data || []).filter((r: BankTransaction) => {
        const d = r.transactionDate?.slice(0, 10)
        return d && d >= fromDate && d <= toDate
      })
      setRows(filtered)
      // Use saved period snapshot for historical saldos
      const savedPeriod = periods.find((p: ReconciliationPeriod) => p.month === month && p.year === year)
      setPeriod(savedPeriod ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id, month, year])

  useEffect(() => {
    if (!loading && account) {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [loading, account])

  if (loading || !account) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
        Generando conciliación…
      </div>
    )
  }

  // Cálculos
  const totalCredito    = rows.filter(r => r.type === 'credit').reduce((s, r) => s + Number(r.amount), 0)
  const totalDebito     = rows.filter(r => r.type === 'debit').reduce((s, r)  => s + Number(r.amount), 0)
  const reconciledRows  = rows.filter(r => r.status === 'reconciled')
  const pendingRows     = rows.filter(r => r.status === 'pending')
  const otherRows       = rows.filter(r => !['reconciled','pending'].includes(r.status))
  // Usar saldos guardados del período cerrado; si no existe, caer al balance actual
  const saldoBanco   = period ? Number(period.saldoBanco)   : Number(account.bankBalance ?? account.currentBalance)
  const saldoSistema = period ? Number(period.saldoSistema) : Number(account.currentBalance)
  const diferencia   = period ? Number(period.diferencia)   : saldoBanco - saldoSistema
  const cuadra       = Math.abs(diferencia) < 0.015

  const periodoLabel    = `${MESES[month - 1]} ${year}`
  const companyName     = activeCompany?.tradeName || activeCompany?.legalName || ''
  const companyNit      = activeCompany?.taxId ? `NIT: ${activeCompany.taxId}` : ''
  const userName        = user ? `${user.firstName} ${user.lastName}` : ''

  const renderTxRows = (list: BankTransaction[]) =>
    list.map((r, i) => (
      <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
        <td style={td}>{dayjs(r.transactionDate).format('DD/MM/YYYY')}</td>
        <td style={{ ...td, maxWidth: 260 }}>{r.description}</td>
        <td style={{ ...td, color: '#6b7280' }}>{r.reference || '—'}</td>
        <td style={{ ...td, textAlign: 'right', color: '#2ea172' }}>
          {r.type === 'credit' ? fmt(Number(r.amount)) : ''}
        </td>
        <td style={{ ...td, textAlign: 'right', color: '#e5484d' }}>
          {r.type === 'debit' ? fmt(Number(r.amount)) : ''}
        </td>
        <td style={{ ...td, textAlign: 'center', fontSize: 11 }}>
          {STATUS_SYMBOL[r.status]} {STATUS_LABEL[r.status] || r.status}
        </td>
      </tr>
    ))

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
        body  { margin: 0; }
        @media print {
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tr    { page-break-inside: avoid; }
        }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* Barra de acciones — solo pantalla */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1B3A6B', padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600 }}>
          Conciliación Bancaria — {account.name} — {periodoLabel}
        </span>
        <button onClick={() => window.print()} style={{
          marginLeft: 'auto', background: '#fff', color: '#1B3A6B',
          border: 'none', borderRadius: 6, padding: '6px 18px', cursor: 'pointer',
          fontWeight: 700, fontSize: 13,
        }}>Imprimir / Guardar PDF</button>
        <button onClick={() => {
          const subject = encodeURIComponent(`Conciliación Bancaria — ${account.name} — ${periodoLabel}`)
          const body    = encodeURIComponent(`Adjunto conciliación bancaria de ${account.name} correspondiente a ${periodoLabel}.`)
          window.location.href = `mailto:?subject=${subject}&body=${body}`
        }} style={{
          background: 'transparent', color: '#fff',
          border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6, padding: '6px 18px',
          cursor: 'pointer', fontSize: 13,
        }}>Enviar por correo</button>
      </div>

      {/* Contenido imprimible */}
      <div style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        color: '#0a0a0a',
        padding: '52px 0 0',
        maxWidth: 780,
        margin: '0 auto',
        lineHeight: 1.4,
      }}>

        {/* ══ ENCABEZADO ══════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '3px solid #1B3A6B', paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1B3A6B', letterSpacing: 0.5 }}>{companyName}</div>
            {companyNit && <div style={{ fontSize: 11, color: '#6b7280' }}>{companyNit}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: 1 }}>
              Conciliación Bancaria
            </div>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Período: {periodoLabel}</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Impreso: {printedAt}</div>
          </div>
        </div>

        {/* ══ DATOS DE LA CUENTA ══════════════════════════════════════════ */}
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Datos de la cuenta bancaria
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 0.9fr 0.4fr 2fr', gap: '6px 12px' }}>
            <InfoRow label="Cuenta" value={account.name} />
            <InfoRow label="Banco" value={account.bankName || '—'} />
            <InfoRow label="N° cuenta" value={account.accountNumber ? `****${account.accountNumber.slice(-6)}` : '—'} />
            <InfoRow label="Moneda" value={account.currency} />
            {account.glAccountCode
              ? <InfoRow label="Cuenta contable" value={`${account.glAccountCode}${account.glAccountName ? ` — ${account.glAccountName}` : ''}`} />
              : account.branchName
              ? <InfoRow label="Agencia" value={account.branchName} />
              : <div />
            }
          </div>
        </div>

        {/* ══ RESUMEN DE CONCILIACIÓN ══════════════════════════════════════ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: 4, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Resumen de conciliación
            </div>
            {period && (
              <span style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                Período cerrado {period.closedByName ? `· ${period.closedByName}` : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Columna izquierda: saldos */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <tbody>
                <SummaryRow label="Saldo según banco" value={fmt(saldoBanco)} bold />
                <SummaryRow label="  (+) Total ingresos del período" value={fmt(totalCredito)} indent />
                <SummaryRow label="  (−) Total egresos del período" value={fmt(totalDebito)} indent />
                <tr><td colSpan={2} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 4 }} /></tr>
                <SummaryRow label="Saldo según sistema" value={fmt(saldoSistema)} bold />
                <tr><td colSpan={2} style={{ borderTop: '2px solid #1B3A6B', paddingTop: 4 }} /></tr>
                <SummaryRow
                  label="Diferencia"
                  value={fmt(diferencia)}
                  bold
                  highlight={cuadra ? 'green' : 'red'}
                />
                {cuadra && (
                  <tr>
                    <td colSpan={2} style={{ paddingTop: 4 }}>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        ✓ CUADRADO
                      </span>
                    </td>
                  </tr>
                )}
                {!cuadra && (
                  <tr>
                    <td colSpan={2} style={{ paddingTop: 4 }}>
                      <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        ✗ DIFERENCIA — REVISAR
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Columna derecha: conteo por estado */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Estado</th>
                  <th style={{ ...th, textAlign: 'right' }}>Movimientos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { status: 'reconciled',  label: 'Conciliadas' },
                  { status: 'categorized', label: 'Categorizadas' },
                  { status: 'matched',     label: 'Con coincidencia' },
                  { status: 'pending',     label: 'Pendientes' },
                  { status: 'excluded',    label: 'Excluidas' },
                ].map(({ status, label }) => {
                  const list  = rows.filter(r => r.status === status)
                  const total = list.reduce((s, r) => s + (r.type === 'credit' ? Number(r.amount) : -Number(r.amount)), 0)
                  if (!list.length) return null
                  return (
                    <tr key={status}>
                      <td style={td}>{STATUS_SYMBOL[status]} {label}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{list.length}</td>
                      <td style={{ ...td, textAlign: 'right', color: total >= 0 ? '#2ea172' : '#e5484d' }}>
                        {fmt(Math.abs(total))}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #1B3A6B' }}>
                  <td style={td}>TOTAL</td>
                  <td style={{ ...td, textAlign: 'right' }}>{rows.length}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmt(totalCredito - totalDebito)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ DETALLE DE MOVIMIENTOS ══════════════════════════════════════ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e5e7eb', paddingBottom: 4 }}>
            Detalle de movimientos — {periodoLabel}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#1B3A6B', color: '#fff' }}>
                <th style={{ ...th, width: 80 }}>Fecha</th>
                <th style={{ ...th, textAlign: 'left' }}>Descripción</th>
                <th style={{ ...th, width: 80 }}>Referencia</th>
                <th style={{ ...th, width: 100, textAlign: 'right' }}>Ingreso</th>
                <th style={{ ...th, width: 100, textAlign: 'right' }}>Egreso</th>
                <th style={{ ...th, width: 90, textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reconciledRows.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 10, padding: '4px 8px', letterSpacing: 0.4 }}>
                      ✓ MOVIMIENTOS CONCILIADOS ({reconciledRows.length})
                    </td>
                  </tr>
                  {renderTxRows(reconciledRows)}
                </>
              )}
              {otherRows.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} style={{ background: '#fef9c3', color: '#854d0e', fontWeight: 700, fontSize: 10, padding: '4px 8px', letterSpacing: 0.4 }}>
                      ◈ CATEGORIZADAS / EN PROCESO ({otherRows.length})
                    </td>
                  </tr>
                  {renderTxRows(otherRows)}
                </>
              )}
              {pendingRows.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: 10, padding: '4px 8px', letterSpacing: 0.4 }}>
                      ○ PENDIENTES DE CATEGORIZAR ({pendingRows.length})
                    </td>
                  </tr>
                  {renderTxRows(pendingRows)}
                </>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#9ca3af', padding: 16 }}>
                    Sin movimientos en el período seleccionado
                  </td>
                </tr>
              )}
              {/* Fila totales */}
              {rows.length > 0 && (
                <tr style={{ background: '#f0f4ff', fontWeight: 700, borderTop: '2px solid #1B3A6B' }}>
                  <td colSpan={3} style={{ ...td, textAlign: 'right', fontWeight: 700 }}>TOTALES DEL PERÍODO</td>
                  <td style={{ ...td, textAlign: 'right', color: '#2ea172' }}>{fmt(totalCredito)}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#e5484d' }}>{fmt(totalDebito)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{rows.length} mov.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ══ OBSERVACIONES ═══════════════════════════════════════════════ */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginBottom: 8 }}>OBSERVACIONES Y NOTAS:</div>
          <div style={{ borderBottom: '1px solid #d1d5db', marginBottom: 10, paddingBottom: 14 }} />
          <div style={{ borderBottom: '1px solid #d1d5db', marginBottom: 10, paddingBottom: 14 }} />
          <div style={{ borderBottom: '1px solid #d1d5db', paddingBottom: 14 }} />
        </div>

        {/* ══ FIRMAS ══════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 8 }}>
          <SignatureBox
            title="Preparado por"
            name={userName}
            subtitle="Responsable de tesorería"
          />
          <SignatureBox
            title="Revisado por"
            subtitle="Contador general"
          />
          <SignatureBox
            title="Autorizado por"
            subtitle="Gerente / Director financiero"
          />
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af' }}>
          <span>{companyName} — Conciliación Bancaria {periodoLabel}</span>
          <span>Generado por Lucía · {printedAt}</span>
        </div>
      </div>
    </>
  )
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, bold, indent, highlight }: {
  label: string; value: string; bold?: boolean; indent?: boolean; highlight?: 'green' | 'red'
}) {
  return (
    <tr>
      <td style={{ padding: '3px 0', paddingLeft: indent ? 12 : 0, color: indent ? '#6b7280' : undefined, fontWeight: bold ? 700 : undefined }}>
        {label}
      </td>
      <td style={{
        padding: '3px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        fontWeight: bold ? 700 : undefined,
        color: highlight === 'green' ? '#15803d' : highlight === 'red' ? '#b91c1c' : undefined,
      }}>
        {value}
      </td>
    </tr>
  )
}

function SignatureBox({ title, name, subtitle }: { title: string; name?: string; subtitle?: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontWeight: 700, fontSize: 10, color: '#1B3A6B', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ borderBottom: '1.5px solid #374151', marginBottom: 6 }} />
      {name && <div style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{name}</div>}
      {!name && <div style={{ fontSize: 9, color: '#9ca3af' }}>Nombre: ___________________</div>}
      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>
      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>Fecha: ___________________</div>
    </div>
  )
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '5px 8px',
  fontWeight: 700,
  fontSize: 10,
  textAlign: 'right',
  border: '1px solid rgba(255,255,255,0.15)',
}

const td: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #e5e7eb',
  fontSize: 10,
  verticalAlign: 'middle',
}
