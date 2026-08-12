import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Empty, Input, InputNumber, Modal, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckCircleOutlined, HistoryOutlined, LockOutlined, MailOutlined, PrinterOutlined, ReloadOutlined, RobotOutlined, RollbackOutlined, SafetyOutlined, SearchOutlined, SendOutlined, SyncOutlined, UnlockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  autoMatchReconciliation,
  getBankAccount,
  getTransactions,
  getPendingReconciliation,
  getReconciliationSummary,
  listReconciliationPeriods,
  saveReconciliationPeriod,
  approveReconciliationPeriod,
  reabrirReconciliationPeriod,
  reconcileTransaction,
  unreconcileTransaction,
  sendEmailConciliacion,
  TRANSACTION_STATUS_CONFIG,
  type BankAccount,
  type BankTransaction,
  type ReconciliationSummary,
  type ReconciliationPeriod,
  type TransactionStatus,
} from '../../api/bancos'
import { moneyFmt, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography

type StatusFilter = 'pending' | 'categorized' | 'matched' | 'reconciled' | undefined

export default function ConciliacionPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [urlParams] = useSearchParams()
  // Parámetros de sesión pasados al iniciar conciliación desde la cuenta
  const urlMonth  = Number(urlParams.get('month')  || 0) || null
  const urlYear   = Number(urlParams.get('year')   || 0) || null
  const urlSaldo  = Number(urlParams.get('refSaldo') || 0) || null
  const [periodTxs, setPeriodTxs] = useState<BankTransaction[]>([])
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [rows, setRows] = useState<BankTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined)
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [periods, setPeriods] = useState<ReconciliationPeriod[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeMes, setCloseMes]     = useState<number>(dayjs().month() + 1)
  const [closeAnio, setCloseAnio]   = useState<number>(dayjs().year())
  const [closeSaldo, setCloseSaldo] = useState<number | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo]     = useState('')
  const [emailCc, setEmailCc]     = useState('')
  const [selectedTxIds, setSelectedTxIds] = useState<React.Key[]>([])
  const [savingReconcile, setSavingReconcile] = useState(false)
  const [sessionSearch, setSessionSearch] = useState('')
  const [emailMes, setEmailMes]   = useState<number>(dayjs().month() + 1)
  const [emailAnio, setEmailAnio] = useState<number>(dayjs().year())
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (!id) return
    getBankAccount(id).then(setAccount).catch(() => navigate('/bancos'))
    listReconciliationPeriods(id).then(setPeriods).catch(() => null)
    // Pre-rellenar valores del modal de cierre si vienen en la URL
    if (urlMonth) setCloseMes(urlMonth)
    if (urlYear)  setCloseAnio(urlYear)
    if (urlSaldo != null) setCloseSaldo(urlSaldo)
    // Persistir sesión en localStorage para que TransaccionesPage detecte sesión activa
    if (urlMonth && urlYear && urlSaldo != null) {
      localStorage.setItem(`conciliacion_${id}`, JSON.stringify({ month: urlMonth, year: urlYear, saldo: urlSaldo }))
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar transacciones del período de sesión para el panel de referencia
  useEffect(() => {
    if (!id || !urlMonth || !urlYear) return
    const fromDate = `${urlYear}-${String(urlMonth).padStart(2, '0')}-01`
    const toDate   = dayjs(fromDate).endOf('month').format('YYYY-MM-DD')
    getTransactions(id, { limit: 2000, fromDate, toDate })
      .then(r => setPeriodTxs(r.data || []))
      .catch(() => null)
  }, [id, urlMonth, urlYear])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [pending, sum] = await Promise.all([
        getPendingReconciliation(id, {
          page,
          limit: 50,
          search: search || undefined,
          status: statusFilter ?? undefined,
        }),
        getReconciliationSummary(id).catch(() => null),
      ])
      setRows(Array.isArray(pending.data) ? pending.data : [])
      setTotal(pending.total || 0)
      setSummary(sum)
      // Refrescar transacciones del período de sesión para actualizar el panel de referencia
      if (urlMonth && urlYear) {
        const fromDate = `${urlYear}-${String(urlMonth).padStart(2, '0')}-01`
        const toDate   = dayjs(fromDate).endOf('month').format('YYYY-MM-DD')
        getTransactions(id, { limit: 2000, fromDate, toDate })
          .then(r => setPeriodTxs(r.data || []))
          .catch(() => null)
      }
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [id, page, search, statusFilter])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => ({
    nonReconciled: (summary?.pending ?? 0) + (summary?.categorized ?? 0) + (summary?.matched ?? 0),
    matched:    summary?.matched ?? 0,
    reconciled: summary?.reconciled ?? 0,
    difference: account?.bankBalance == null ? null : Number(account.bankBalance) - Number(account.currentBalance),
  }), [account, summary])

  // Conjunto de "año-mes" cuyos períodos están aprobados → transacciones bloqueadas
  const approvedKeys = useMemo(
    () => new Set(periods.filter(p => p.status === 'approved').map(p => `${p.year}-${p.month}`)),
    [periods],
  )
  const isTxLocked = (tx: BankTransaction) => {
    const d = dayjs(tx.transactionDate)
    return approvedKeys.has(`${d.year()}-${d.month() + 1}`)
  }

  const isSessionMode = !!(urlMonth && urlYear && urlSaldo != null)

  // Transacciones del período de sesión visibles en modo conciliacion (excluye anuladas/excluidas)
  const sessionRows = useMemo(() => {
    const base = periodTxs.filter(t => t.status !== 'excluded' && t.status !== 'voided')
    if (!sessionSearch.trim()) return base
    const q = sessionSearch.toLowerCase()
    return base.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.reference?.toLowerCase().includes(q) ||
      t.accountName?.toLowerCase().includes(q),
    )
  }, [periodTxs, sessionSearch])

  const handleBatchReconcile = async () => {
    if (!id || !selectedTxIds.length) { message.warning('Selecciona al menos una transaccion'); return }
    setSavingReconcile(true)
    try {
      await Promise.all((selectedTxIds as string[]).map(txId => reconcileTransaction({ transactionId: txId })))
      message.success(`${selectedTxIds.length} transacciones marcadas como conciliadas`)
      setSelectedTxIds([])
      if (urlMonth && urlYear) {
        const fromDate = `${urlYear}-${String(urlMonth).padStart(2, '0')}-01`
        const toDate   = dayjs(fromDate).endOf('month').format('YYYY-MM-DD')
        const r = await getTransactions(id, { limit: 2000, fromDate, toDate })
        setPeriodTxs(r.data || [])
      }
      listReconciliationPeriods(id).then(setPeriods).catch(() => null)
    } catch {
      message.error('No se pudo guardar los cambios')
    } finally {
      setSavingReconcile(false)
    }
  }

  const sessionColumns: ColumnsType<BankTransaction> = [
    { title: 'Fecha', dataIndex: 'transactionDate', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Descripcion', dataIndex: 'description', ellipsis: true,
      render: (v, row) => (
        <div>
          <Text strong style={{ color: row.status === 'reconciled' ? '#9ca3af' : undefined }}>{v}</Text>
          {row.reference && <div style={{ fontSize: 12, color: '#9ca3af' }}>Ref. {row.reference}</div>}
        </div>
      ),
    },
    { title: 'Tipo', dataIndex: 'type', width: 90, render: v => <Tag color={v === 'credit' ? '#2ea172' : '#e5484d'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
    {
      title: 'Monto', dataIndex: 'amount', width: 140, align: 'right',
      render: (v, row) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', color: row.status === 'reconciled' ? '#9ca3af' : row.type === 'credit' ? '#2ea172' : '#e5484d' }}>
          {moneyFmt(Number(v), account?.currency)}
        </Text>
      ),
    },
    {
      title: 'Cuenta contable', dataIndex: 'accountName', width: 200,
      render: (v, row) => row.accountName
        ? <Text style={{ fontSize: 12, color: '#374151' }}>{row.accountName}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>Sin categorizar</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 120,
      filters: [
        { text: 'Pendiente',       value: 'pending' },
        { text: 'Con coincidencia', value: 'matched' },
        { text: 'Categorizada',    value: 'categorized' },
        { text: 'Conciliada',      value: 'reconciled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: v => {
        const cfg = TRANSACTION_STATUS_CONFIG[v as TransactionStatus] || TRANSACTION_STATUS_CONFIG.pending
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
  ]

  const rowSelection = {
    selectedRowKeys: selectedTxIds,
    onChange: (keys: React.Key[]) => setSelectedTxIds(keys),
    getCheckboxProps: (row: BankTransaction) => ({
      disabled: row.status === 'reconciled' || isTxLocked(row),
    }),
  }

  const handleFilterClick = (filter: StatusFilter) => {
    setStatusFilter(prev => prev === filter ? undefined : filter)
    setPage(1)
  }

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const openCloseModal = () => {
    const defaultMonth = account?.lastStatementDate
      ? dayjs(account.lastStatementDate).month() + 1
      : dayjs().month() + 1
    const defaultYear  = account?.lastStatementDate
      ? dayjs(account.lastStatementDate).year()
      : dayjs().year()
    setCloseMes(defaultMonth)
    setCloseAnio(defaultYear)
    setCloseSaldo(null)
    setShowCloseModal(true)
  }

  const handleSavePeriod = async () => {
    if (!id || !account) return
    if (closeSaldo == null) {
      message.warning('Ingresa el saldo al cierre según el estado de cuenta bancario')
      return
    }
    setSavingPeriod(true)
    try {
      // Calcular balances y totales desde las transacciones reales del período
      const fromDate = `${closeAnio}-${String(closeMes).padStart(2, '0')}-01`
      const toDate   = dayjs(fromDate).endOf('month').format('YYYY-MM-DD')
      const txRes    = await getTransactions(id, { limit: 2000, fromDate, toDate })
      const periodTxs = txRes.data || []

      const totalCredito    = periodTxs.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
      const totalDebito     = periodTxs.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0)
      const reconciledCount = periodTxs.filter(t => t.status === 'reconciled').length
      const pendingCount    = periodTxs.filter(t => t.status === 'pending').length

      // saldoBanco = lo que el usuario declaró del estado de cuenta; fallback a runningBalance
      const lastTx = [...periodTxs].sort((a, b) => a.transactionDate > b.transactionDate ? -1 : 1)[0]
      const saldoBanco = closeSaldo != null
        ? closeSaldo
        : lastTx?.runningBalance != null
          ? Number(lastTx.runningBalance)
          : Number(account.bankBalance ?? account.currentBalance)

      // diferencia = monto de transacciones no conciliadas del período
      const diferencia = periodTxs
        .filter(t => t.status === 'pending')
        .reduce((s, t) => s + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0)
      const saldoSistema = saldoBanco - diferencia

      const saved = await saveReconciliationPeriod(id, {
        month: closeMes,
        year:  closeAnio,
        saldoBanco,
        saldoSistema,
        diferencia,
        totalCredito,
        totalDebito,
        totalTransactions: periodTxs.length,
        reconciledCount,
        pendingCount,
      })
      setPeriods(prev => {
        const idx = prev.findIndex(p => p.month === closeMes && p.year === closeAnio)
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
        return [saved, ...prev]
      })
      message.success(`Período ${meses[closeMes - 1]} ${closeAnio} guardado correctamente`)
      localStorage.removeItem(`conciliacion_${id}`)
      setShowCloseModal(false)
      navigate(`/bancos/${id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar el período')
    } finally {
      setSavingPeriod(false)
    }
  }

  // Recalcula los saldos de un período ya guardado usando las transacciones reales del mes
  const recalcularPeriodo = async (month: number, year: number) => {
    if (!id || !account) return
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`
    const toDate   = dayjs(fromDate).endOf('month').format('YYYY-MM-DD')
    try {
      const txRes     = await getTransactions(id, { limit: 2000, fromDate, toDate })
      const periodTxs = txRes.data || []

      const totalCredito    = periodTxs.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
      const totalDebito     = periodTxs.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0)
      const reconciledCount = periodTxs.filter(t => t.status === 'reconciled').length
      const pendingCount    = periodTxs.filter(t => t.status === 'pending').length

      const lastTx = [...periodTxs].sort((a, b) => a.transactionDate > b.transactionDate ? -1 : 1)[0]
      const saldoBanco = lastTx?.runningBalance != null
        ? Number(lastTx.runningBalance)
        : Number(account.bankBalance ?? account.currentBalance)

      const diferencia   = periodTxs
        .filter(t => t.status === 'pending')
        .reduce((s, t) => s + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0)
      const saldoSistema = saldoBanco - diferencia

      const saved = await saveReconciliationPeriod(id, {
        month, year, saldoBanco, saldoSistema, diferencia,
        totalCredito, totalDebito,
        totalTransactions: periodTxs.length,
        reconciledCount, pendingCount,
      })
      setPeriods(prev => prev.map(p => (p.month === month && p.year === year) ? saved : p))
      message.success(`Saldos de ${meses[month - 1]} ${year} recalculados`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo recalcular')
    }
  }

  const handleSendEmail = async () => {
    if (!id || !emailTo) return
    setSendingEmail(true)
    try {
      const res = await sendEmailConciliacion(id, { to: emailTo, cc: emailCc || undefined, month: emailMes, year: emailAnio })
      if (res.sent) {
        message.success(`Correo enviado a ${emailTo}`)
        setShowEmailModal(false)
      } else {
        message.warning('El servidor de correo no está configurado. Usa la opción de imprimir y enviar manualmente.')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo enviar el correo')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleAutoMatch = async () => {
    if (!id) return
    setMatching(true)
    try {
      const res = await autoMatchReconciliation(id)
      message.success(res.message || `Coincidencias encontradas: ${res.matched}`)
      load()
    } catch {
      message.error('No se pudo ejecutar la conciliacion automatica')
    } finally {
      setMatching(false)
    }
  }

  const handleReconcile = (row: BankTransaction) => {
    Modal.confirm({
      title: 'Confirmar conciliacion',
      content: 'La transaccion quedara vinculada como conciliada para esta cuenta.',
      okText: 'Conciliar',
      okButtonProps: { style: { background: NAVY } },
      onOk: async () => {
        await reconcileTransaction({ transactionId: row.id, accountId: row.accountId })
        message.success('Transaccion conciliada')
        load()
      },
    })
  }

  const handleUnreconcile = (row: BankTransaction) => {
    const isReconciled = row.status === 'reconciled'
    Modal.confirm({
      title: isReconciled ? 'Anular conciliacion' : 'Marcar como pendiente',
      content: 'La transaccion volvera a estado Pendiente. Esta accion no anula el cobro o pago vinculado.',
      okText: isReconciled ? 'Anular conciliacion' : 'Marcar pendiente',
      okType: 'danger',
      onOk: async () => {
        try {
          await unreconcileTransaction({ transactionId: row.id })
          message.success('Transaccion marcada como Pendiente')
          setStatusFilter(undefined)
          setPage(1)
        } catch (e: any) {
          message.error(e?.response?.data?.message || 'No se pudo actualizar la transaccion')
          throw e
        }
      },
    })
  }

  const cardStyle = (active: boolean) => ({
    ...panelStyle,
    cursor: 'pointer',
    border: active ? `2px solid ${NAVY}` : '1px solid rgba(10,10,10,0.08)',
    transition: 'border 0.15s',
  })

  const columns: ColumnsType<BankTransaction> = [
    { title: 'Fecha', dataIndex: 'transactionDate', width: 110, fixed: 'left', render: v => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Movimiento bancario',
      dataIndex: 'description',
      width: 360,
      ellipsis: true,
      render: (v, row) => (
        <div>
          <Text strong>{v}</Text>
          {row.reference && <div style={{ fontSize: 12, color: '#6b7280' }}>Ref. {row.reference}</div>}
        </div>
      ),
    },
    { title: 'Tipo', dataIndex: 'type', width: 100, render: v => <Tag color={v === 'credit' ? '#2ea172' : '#e5484d'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
    { title: 'Monto', dataIndex: 'amount', width: 150, align: 'right', render: (v, row) => <Text style={{ fontVariantNumeric: 'tabular-nums', color: row.type === 'credit' ? '#2ea172' : '#e5484d' }}>{moneyFmt(Number(v), account?.currency)}</Text> },
    { title: 'Estado', dataIndex: 'status', width: 150, render: v => {
      const cfg = TRANSACTION_STATUS_CONFIG[v as TransactionStatus] || TRANSACTION_STATUS_CONFIG.pending
      return <Tag color={cfg.color}>{cfg.label}</Tag>
    } },
    { title: 'Sugerencia', key: 'match', width: 200, render: (_, row) => row.matchedPaymentId || row.matchedInvoiceId || row.matchedJournalEntryId ? <Tag color="#6b7280">Coincidencia detectada</Tag> : <Text type="secondary">Sin coincidencia</Text> },
    {
      title: '',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, row) => {
        if (isTxLocked(row)) {
          return (
            <Tooltip title="Período aprobado — usa 'Habilitar conciliación' en el Historial para editar">
              <LockOutlined style={{ color: '#9ca3af', fontSize: 16 }} />
            </Tooltip>
          )
        }
        if (row.status === 'reconciled') {
          return (
            <Button size="small" danger icon={<RollbackOutlined />} onClick={() => handleUnreconcile(row)}>
              Desconciliar
            </Button>
          )
        }
        if (row.status === 'categorized') {
          return (
            <Button size="small" icon={<RollbackOutlined />} onClick={() => handleUnreconcile(row)}>
              Marcar pendiente
            </Button>
          )
        }
        return (
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: NAVY }} onClick={() => handleReconcile(row)}>
            Conciliar
          </Button>
        )
      },
    },
  ]

  if (!account) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/bancos/${account.id}`)} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
              {isSessionMode ? `Conciliando ${meses[(urlMonth ?? 1) - 1]} ${urlYear}` : 'Conciliacion bancaria'}
            </Title>
            <Text type="secondary">{account.name} - {account.bankName}</Text>
          </div>
        </div>
        <Space wrap>
          {isSessionMode && (
            <>
              <Button
                size="small"
                onClick={() => setSelectedTxIds([])}
                disabled={!selectedTxIds.length}
              >
                Limpiar seleccion
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={savingReconcile}
                disabled={!selectedTxIds.length}
                style={{ background: '#2ea172', borderColor: '#2ea172' }}
                onClick={handleBatchReconcile}
              >
                Guardar cambios ({selectedTxIds.length})
              </Button>
              <Button
                size="small"
                icon={<SendOutlined />}
                disabled={savingReconcile}
                onClick={() => {
                  setSelectedTxIds([])
                  load()
                }}
              >
                Continuar conciliando
              </Button>
            </>
          )}
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Actualizar</Button>
          {!isSessionMode && (
            <>
              <Button icon={<HistoryOutlined />} onClick={() => setShowHistory(true)}>
                Historial ({periods.length})
              </Button>
              <Button icon={<LockOutlined />} onClick={openCloseModal}>
                Cerrar período
              </Button>
              <Button icon={<PrinterOutlined />} onClick={() => {
                const lastClosed = [...periods]
                  .filter(p => p.status === 'closed' || p.status === 'approved')
                  .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month)[0]
                const month = lastClosed ? lastClosed.month
                  : account.lastStatementDate ? dayjs(account.lastStatementDate).month() + 1
                  : dayjs().month() + 1
                const year  = lastClosed ? lastClosed.year
                  : account.lastStatementDate ? dayjs(account.lastStatementDate).year()
                  : dayjs().year()
                window.open(`/bancos/${account.id}/conciliacion/imprimir?month=${month}&year=${year}`, '_blank')
              }}>
                Imprimir / PDF
              </Button>
              <Button icon={<MailOutlined />} onClick={() => {
                const defaultMonth = account?.lastStatementDate ? dayjs(account.lastStatementDate).month() + 1 : dayjs().month() + 1
                const defaultYear  = account?.lastStatementDate ? dayjs(account.lastStatementDate).year() : dayjs().year()
                setEmailMes(defaultMonth); setEmailAnio(defaultYear)
                setShowEmailModal(true)
              }}>
                Enviar por correo
              </Button>
            </>
          )}
          <Button type="primary" icon={<RobotOutlined />} loading={matching} style={{ background: NAVY }} onClick={handleAutoMatch}>
            Buscar coincidencias
          </Button>
        </Space>
      </div>

      {!isSessionMode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <Card
            size="small"
            style={cardStyle(statusFilter === undefined)}
            onClick={() => handleFilterClick(undefined)}
          >
            <Statistic
              title={<span>Pendientes{statusFilter === undefined && <Tag color={NAVY} style={{ marginLeft: 6, fontSize: 10 }}>Activo</Tag>}</span>}
              value={totals.nonReconciled}
              valueStyle={{ color: '#ff7f00', fontSize: 18 }}
            />
          </Card>
          <Card
            size="small"
            style={cardStyle(statusFilter === 'matched')}
            onClick={() => handleFilterClick('matched')}
          >
            <Statistic
              title={<span>Con coincidencia{statusFilter === 'matched' && <Tag color={NAVY} style={{ marginLeft: 6, fontSize: 10 }}>Activo</Tag>}</span>}
              value={totals.matched}
              valueStyle={{ color: '#6b7280', fontSize: 18 }}
            />
          </Card>
          <Card
            size="small"
            style={cardStyle(statusFilter === 'reconciled')}
            onClick={() => handleFilterClick('reconciled')}
          >
            <Statistic
              title={<span>Conciliadas{statusFilter === 'reconciled' && <Tag color={NAVY} style={{ marginLeft: 6, fontSize: 10 }}>Activo</Tag>}</span>}
              value={totals.reconciled}
              valueStyle={{ color: '#2ea172', fontSize: 18 }}
            />
          </Card>
          <Card size="small" style={panelStyle}>
            <Statistic
              title="Diferencia"
              value={totals.difference ?? 0}
              formatter={v => totals.difference == null ? 'Sin saldo banco' : moneyFmt(Number(v), account.currency)}
              valueStyle={{ color: totals.difference != null && Math.abs(totals.difference) > 0.01 ? '#e5484d' : NAVY, fontSize: 18 }}
            />
          </Card>
        </div>
      )}

      {urlSaldo != null && urlMonth && urlYear && (() => {
        const reconciledTxs = periodTxs.filter(t => t.status === 'reconciled')
        const pendingTxs    = periodTxs.filter(t => t.status === 'pending')
        const reconciledAmt = reconciledTxs.reduce((s, t) => s + Number(t.amount), 0)
        const pendingAmt    = pendingTxs.reduce((s, t) => s + Number(t.amount), 0)
        const cuadrado      = pendingAmt < 0.01 && periodTxs.length > 0
        const totalTxs      = periodTxs.filter(t => t.status !== 'excluded' && t.status !== 'voided').length
        return (
          <Card size="small" style={{ ...panelStyle, marginBottom: 12, border: `2px solid ${cuadrado ? '#2ea172' : '#ff7f00'}` }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Conciliacion {meses[urlMonth - 1]} {urlYear}
                {cuadrado && <Tag color="#2ea172" style={{ marginLeft: 8 }}>Cuadrado ✓</Tag>}
              </Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Saldo banco (estado de cuenta)</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{moneyFmt(urlSaldo, account.currency)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Conciliado este mes</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>{moneyFmt(reconciledAmt, account.currency)}</div>
                <Text type="secondary" style={{ fontSize: 10 }}>{reconciledTxs.length} de {totalTxs} transacciones</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Sin conciliar</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: cuadrado ? '#2ea172' : '#e5484d', fontVariantNumeric: 'tabular-nums' }}>
                  {moneyFmt(pendingAmt, account.currency)}
                </div>
                <Text type="secondary" style={{ fontSize: 10 }}>{pendingTxs.length} transacciones pendientes</Text>
              </div>
            </div>
          </Card>
        )
      })()}

      {!isSessionMode && (
        <Card size="small" style={{ ...panelStyle, marginBottom: 12 }}>
          <Space wrap>
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Buscar descripcion o referencia"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onPressEnter={() => { setPage(1); load() }}
              style={{ width: 320 }}
            />
            <Button size="small" onClick={() => { setPage(1); load() }}>Filtrar</Button>
            {statusFilter && (
              <Button size="small" onClick={() => { setStatusFilter(undefined); setPage(1) }}>
                Limpiar filtro
              </Button>
            )}
          </Space>
        </Card>
      )}

      {isSessionMode && (
        <Card size="small" style={{ ...panelStyle, marginBottom: 12 }}>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {sessionRows.filter(t => t.status === 'reconciled').length} de {sessionRows.length} transacciones conciliadas
              {selectedTxIds.length > 0 && <Tag color={NAVY} style={{ marginLeft: 8 }}>{selectedTxIds.length} seleccionadas</Tag>}
            </Text>
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Buscar en este mes"
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              style={{ width: 260 }}
            />
          </Space>
        </Card>
      )}

      <Card size="small" style={panelStyle} styles={{ body: { padding: 0 } }}>
        {isSessionMode ? (
          <Table<BankTransaction>
            columns={sessionColumns}
            dataSource={sessionRows}
            rowKey="id"
            size="small"
            loading={loading || savingReconcile}
            rowSelection={rowSelection}
            scroll={{ x: 'max-content', y: 'calc(100vh - 420px)' }}
            pagination={sessionRows.length > 100 ? { pageSize: 100, showTotal: t => `${t} movimientos del mes` } : false}
            locale={{ emptyText: <Empty description="Sin movimientos en este mes" /> }}
            rowClassName={row => row.status === 'reconciled' ? 'tx-reconciled-row' : ''}
          />
        ) : (
          <Table<BankTransaction>
            columns={columns}
            dataSource={rows}
            rowKey="id"
            size="small"
            loading={loading}
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            pagination={{ current: page, pageSize: 50, total, showTotal: t => `${t} registros`, onChange: setPage }}
            locale={{ emptyText: <Empty description="Sin movimientos en este estado" /> }}
          />
        )}
      </Card>

      {/* ── Modal cerrar período ────────────────────────────────────────────── */}
      <Modal
        title={<><LockOutlined /> Cerrar período de conciliación</>}
        open={showCloseModal}
        onCancel={() => setShowCloseModal(false)}
        okText="Guardar período"
        okButtonProps={{ style: { background: NAVY }, loading: savingPeriod }}
        onOk={handleSavePeriod}
        width={440}
      >
        <Alert
          type="info" showIcon
          message="Se guardará una instantánea del estado actual de conciliación para la cuenta seleccionada. Podrás reimprimirla en cualquier momento."
          style={{ marginBottom: 18 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Mes</Text>
            <Select size="small" value={closeMes} onChange={setCloseMes} style={{ width: '100%' }}>
              {meses.map((m, i) => <Select.Option key={i + 1} value={i + 1}>{m}</Select.Option>)}
            </Select>
          </div>
          <div>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Año</Text>
            <Select size="small" value={closeAnio} onChange={setCloseAnio} style={{ width: '100%' }}>
              {Array.from({ length: 5 }, (_, i) => dayjs().year() - i).map(y =>
                <Select.Option key={y} value={y}>{y}</Select.Option>
              )}
            </Select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Saldo al cierre según estado de cuenta bancario <Text type="danger">*</Text>
          </Text>
          <InputNumber
            size="small"
            prefix="Q"
            style={{ width: '100%' }}
            value={closeSaldo}
            onChange={v => setCloseSaldo(v)}
            precision={2}
            min={0}
            placeholder="Ingresa el saldo que muestra el banco al final del período"
          />
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
            Este es el saldo oficial del banco al {dayjs(`${closeAnio}-${String(closeMes).padStart(2,'0')}-01`).endOf('month').format('DD/MM/YYYY')}
          </Text>
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Cuenta: </Text>
          <Text strong style={{ fontSize: 12 }}>{account.name}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>Período: </Text>
          <Text strong style={{ fontSize: 12, color: NAVY }}>{meses[closeMes - 1]} {closeAnio}</Text>
        </div>
      </Modal>

      {/* ── Modal enviar por correo ─────────────────────────────────────────── */}
      <Modal
        title={<><MailOutlined /> Enviar conciliación por correo</>}
        open={showEmailModal}
        onCancel={() => setShowEmailModal(false)}
        footer={null}
        width={480}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Selector de período */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Período — Mes</Text>
              <Select size="small" value={emailMes} onChange={setEmailMes} style={{ width: '100%' }}>
                {meses.map((m, i) => <Select.Option key={i + 1} value={i + 1}>{m}</Select.Option>)}
              </Select>
            </div>
            <div>
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Año</Text>
              <Select size="small" value={emailAnio} onChange={setEmailAnio} style={{ width: '100%' }}>
                {Array.from({ length: 5 }, (_, i) => dayjs().year() - i).map(y =>
                  <Select.Option key={y} value={y}>{y}</Select.Option>
                )}
              </Select>
            </div>
          </div>

          {/* Destinatarios */}
          <div>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Para (requerido)</Text>
            <Input
              size="small"
              placeholder="correo@empresa.com"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
            />
          </div>
          <div>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Con copia (Cc — opcional)</Text>
            <Input
              size="small"
              placeholder="copia@empresa.com"
              value={emailCc}
              onChange={e => setEmailCc(e.target.value)}
            />
          </div>

          {/* Preview de lo que se enviará */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
            <div><Text type="secondary">Asunto: </Text><Text>Conciliación Bancaria — {account.name} — {meses[emailMes - 1]} {emailAnio}</Text></div>
            <div style={{ marginTop: 4 }}><Text type="secondary">Contenido: </Text><Text>Resumen de saldos + enlace al PDF</Text></div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setShowEmailModal(false)}>Cancelar</Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              style={{ background: NAVY, color: 'white' }}
              disabled={!emailTo}
              loading={sendingEmail}
              onClick={handleSendEmail}
            >
              Enviar correo
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal historial de períodos ─────────────────────────────────────── */}
      <Modal
        title={<><HistoryOutlined /> Historial de conciliaciones — {account.name}</>}
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        footer={null}
        width={960}
      >
        {periods.length === 0 ? (
          <Empty description="Sin períodos guardados. Usa 'Cerrar período' para guardar el estado actual." />
        ) : (
          <Table<ReconciliationPeriod>
            size="small"
            rowKey="id"
            dataSource={periods}
            pagination={false}
            scroll={{ y: 420 }}
            columns={[
              {
                title: 'Período',
                key: 'period',
                width: 120,
                render: (_, r) => {
                  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                  return <Text strong>{meses[r.month - 1]} {r.year}</Text>
                },
              },
              {
                title: 'Estado',
                dataIndex: 'status',
                width: 100,
                render: v => (
                  <Tag color={v === 'approved' ? '#2ea172' : v === 'closed' ? NAVY : '#6b7280'}>
                    {v === 'approved' ? 'Aprobado' : v === 'closed' ? 'Cerrado' : 'Borrador'}
                  </Tag>
                ),
              },
              {
                title: 'Saldo banco',
                dataIndex: 'saldoBanco',
                width: 130,
                align: 'right',
                render: v => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{moneyFmt(Number(v), account.currency)}</Text>,
              },
              {
                title: 'Diferencia',
                dataIndex: 'diferencia',
                width: 110,
                align: 'right',
                render: v => (
                  <Text style={{ fontVariantNumeric: 'tabular-nums', color: Math.abs(Number(v)) < 0.01 ? '#2ea172' : '#e5484d' }}>
                    {moneyFmt(Number(v), account.currency)}
                  </Text>
                ),
              },
              {
                title: 'Cerrado por',
                dataIndex: 'closedByName',
                ellipsis: true,
                render: (v, r) => v ? (
                  <Tooltip title={r.closedAt ? dayjs(r.closedAt).format('DD/MM/YYYY HH:mm') : ''}>
                    <Text style={{ fontSize: 12 }}>{v}</Text>
                  </Tooltip>
                ) : <Text type="secondary">—</Text>,
              },
              {
                title: 'Acciones',
                key: 'actions',
                width: 120,
                render: (_, r) => (
                  <Space size={4}>
                    <Tooltip title="Recalcular saldos del período">
                      <Button size="small" icon={<SyncOutlined />}
                        onClick={() => recalcularPeriodo(r.month, r.year)} />
                    </Tooltip>
                    <Tooltip title="Reimprimir PDF">
                      <Button size="small" icon={<PrinterOutlined />}
                        onClick={() => window.open(`/bancos/${account.id}/conciliacion/imprimir?month=${r.month}&year=${r.year}`, '_blank')} />
                    </Tooltip>
                    {r.status === 'closed' && (
                      <Tooltip title="Aprobar período">
                        <Button size="small" icon={<SafetyOutlined />} style={{ color: '#2ea172', borderColor: '#2ea172' }}
                          onClick={() => {
                            Modal.confirm({
                              title: 'Aprobar período',
                              content: 'Marcar este período como revisado y aprobado.',
                              okText: 'Aprobar',
                              okButtonProps: { style: { background: '#2ea172', borderColor: '#2ea172' } },
                              onOk: async () => {
                                const updated = await approveReconciliationPeriod(account.id, r.id)
                                setPeriods(prev => prev.map(p => p.id === r.id ? updated : p))
                                message.success('Período aprobado')
                              },
                            })
                          }} />
                      </Tooltip>
                    )}
                    {r.status === 'approved' && (
                      <Tooltip title="Habilitar conciliación (revertir a Cerrado para editar)">
                        <Button size="small" icon={<UnlockOutlined />} style={{ color: '#d97706', borderColor: '#d97706' }}
                          onClick={() => {
                            Modal.confirm({
                              title: 'Habilitar conciliación',
                              content: `El período ${meses[r.month - 1]} ${r.year} volverá a estado Cerrado. Las transacciones de ese mes quedarán desbloqueadas para edición.`,
                              okText: 'Habilitar',
                              okButtonProps: { style: { background: '#d97706', borderColor: '#d97706' } },
                              onOk: async () => {
                                const updated = await reabrirReconciliationPeriod(account.id, r.id)
                                setPeriods(prev => prev.map(p => p.id === r.id ? updated : p))
                                message.success(`Conciliación de ${meses[r.month - 1]} ${r.year} habilitada para edición`)
                              },
                            })
                          }} />
                      </Tooltip>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}
