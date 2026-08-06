import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Empty, Input, Modal, Space, Statistic, Steps, Table, Tag, Tooltip, Typography, message, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckCircleOutlined, HistoryOutlined, LockOutlined, MailOutlined, PrinterOutlined, ReloadOutlined, RobotOutlined, RollbackOutlined, SafetyOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  autoMatchReconciliation,
  getBankAccount,
  getPendingReconciliation,
  getReconciliationSummary,
  listReconciliationPeriods,
  saveReconciliationPeriod,
  approveReconciliationPeriod,
  reconcileTransaction,
  unreconcileTransaction,
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
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailStep, setEmailStep] = useState(0)
  const [emailTo, setEmailTo] = useState('')
  const [emailCc, setEmailCc] = useState('')

  useEffect(() => {
    if (!id) return
    getBankAccount(id).then(setAccount).catch(() => navigate('/bancos'))
    listReconciliationPeriods(id).then(setPeriods).catch(() => null)
  }, [id, navigate])

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

  const handleFilterClick = (filter: StatusFilter) => {
    setStatusFilter(prev => prev === filter ? undefined : filter)
    setPage(1)
  }

  const handleSavePeriod = async () => {
    if (!id || !account || !summary) return
    const month = account.lastStatementDate
      ? dayjs(account.lastStatementDate).month() + 1
      : dayjs().month() + 1
    const year  = account.lastStatementDate
      ? dayjs(account.lastStatementDate).year()
      : dayjs().year()
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const periodo = `${meses[month - 1]} ${year}`

    Modal.confirm({
      title: `Cerrar período de conciliación — ${periodo}`,
      content: `Se guardará una instantánea del estado actual de conciliación para ${account.name}. Podrás reimprimirla en cualquier momento.`,
      okText: 'Guardar período',
      okButtonProps: { style: { background: NAVY } },
      onOk: async () => {
        setSavingPeriod(true)
        try {
          const saldoBanco   = Number(account.bankBalance ?? account.currentBalance)
          const saldoSistema = Number(account.currentBalance)
          const saved = await saveReconciliationPeriod(id, {
            month,
            year,
            saldoBanco,
            saldoSistema,
            diferencia:        saldoBanco - saldoSistema,
            totalCredito:      0,
            totalDebito:       0,
            totalTransactions: summary.total,
            reconciledCount:   summary.reconciled,
            pendingCount:      summary.pending,
          })
          setPeriods(prev => {
            const idx = prev.findIndex(p => p.month === month && p.year === year)
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
            return [saved, ...prev]
          })
          message.success(`Período ${periodo} guardado correctamente`)
        } catch (e: any) {
          message.error(e?.response?.data?.message || 'No se pudo guardar el período')
        } finally {
          setSavingPeriod(false)
        }
      },
    })
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
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Conciliacion bancaria</Title>
            <Text type="secondary">{account.name} - {account.bankName}</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Actualizar</Button>
          <Button icon={<HistoryOutlined />} onClick={() => setShowHistory(true)}>
            Historial ({periods.length})
          </Button>
          <Button icon={<LockOutlined />} loading={savingPeriod} onClick={handleSavePeriod}>
            Cerrar período
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => {
            const month = account.lastStatementDate
              ? dayjs(account.lastStatementDate).month() + 1
              : dayjs().month() + 1
            const year  = account.lastStatementDate
              ? dayjs(account.lastStatementDate).year()
              : dayjs().year()
            window.open(`/bancos/${account.id}/conciliacion/imprimir?month=${month}&year=${year}`, '_blank')
          }}>
            Imprimir / PDF
          </Button>
          <Button icon={<MailOutlined />} onClick={() => { setEmailStep(0); setShowEmailModal(true) }}>
            Enviar por correo
          </Button>
          <Button type="primary" icon={<RobotOutlined />} loading={matching} style={{ background: NAVY }} onClick={handleAutoMatch}>
            Buscar coincidencias
          </Button>
        </Space>
      </div>

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

      <Card size="small" style={panelStyle} styles={{ body: { padding: 0 } }}>
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
      </Card>

      {/* ── Modal enviar por correo ─────────────────────────────────────────── */}
      {(() => {
        const month = account.lastStatementDate
          ? dayjs(account.lastStatementDate).month() + 1
          : dayjs().month() + 1
        const year  = account.lastStatementDate
          ? dayjs(account.lastStatementDate).year()
          : dayjs().year()
        const meses  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const periodo = `${meses[month - 1]} ${year}`
        const printUrl = `${window.location.origin}/bancos/${account.id}/conciliacion/imprimir?month=${month}&year=${year}`

        const openMailto = () => {
          const subject = encodeURIComponent(`Conciliación Bancaria — ${account.name} — ${periodo}`)
          const body    = encodeURIComponent(
            `Estimados,\n\nAdjunto la conciliación bancaria de la cuenta:\n` +
            `  Cuenta: ${account.name}\n` +
            `  Banco: ${account.bankName || '—'}\n` +
            `  Período: ${periodo}\n\n` +
            `El documento PDF se puede consultar también en:\n${printUrl}\n\n` +
            `Saludos.`
          )
          const toParam  = emailTo  ? encodeURIComponent(emailTo)  : ''
          const ccParam  = emailCc  ? `&cc=${encodeURIComponent(emailCc)}`  : ''
          window.location.href = `mailto:${toParam}?subject=${subject}${ccParam}&body=${body}`
        }

        return (
          <Modal
            title={<><MailOutlined /> Enviar conciliación por correo</>}
            open={showEmailModal}
            onCancel={() => setShowEmailModal(false)}
            footer={null}
            width={520}
          >
            <Steps
              size="small"
              current={emailStep}
              style={{ marginBottom: 24 }}
              items={[
                { title: 'Generar PDF' },
                { title: 'Destinatario' },
                { title: 'Enviar' },
              ]}
            />

            {emailStep === 0 && (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message="Paso 1 — Descarga el PDF"
                  description={
                    <>
                      Haz clic en el botón para abrir el documento de conciliación.
                      En la pantalla que se abre usa <strong>Ctrl+P → Guardar como PDF</strong>{' '}
                      (o el botón "Imprimir / Guardar PDF"). Luego regresa aquí para continuar.
                    </>
                  }
                  style={{ marginBottom: 20 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    style={{ flex: 1, background: NAVY }}
                    onClick={() => {
                      window.open(printUrl, '_blank')
                      setEmailStep(1)
                    }}
                  >
                    Abrir PDF de conciliación — {periodo}
                  </Button>
                </div>
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <Button type="link" onClick={() => setEmailStep(1)}>
                    Ya tengo el PDF, continuar →
                  </Button>
                </div>
              </div>
            )}

            {emailStep === 1 && (
              <div>
                <Alert
                  type="success"
                  showIcon
                  message="Paso 2 — Ingresa el destinatario"
                  description="Indica a quién va dirigida la conciliación. Luego adjunta el PDF que descargaste."
                  style={{ marginBottom: 20 }}
                />
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Para (requerido)</Text>
                    <Input
                      size="small"
                      placeholder="correo@empresa.com"
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      onPressEnter={() => emailTo && setEmailStep(2)}
                    />
                  </div>
                  <div>
                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Con copia (Cc)</Text>
                    <Input
                      size="small"
                      placeholder="copia@empresa.com (opcional)"
                      value={emailCc}
                      onChange={e => setEmailCc(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEmailStep(0)}>Atrás</Button>
                  <Button type="primary" style={{ background: NAVY }} disabled={!emailTo}
                    onClick={() => setEmailStep(2)}>
                    Continuar →
                  </Button>
                </div>
              </div>
            )}

            {emailStep === 2 && (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  message="Paso 3 — Abre tu cliente de correo y adjunta el PDF"
                  description={
                    <>
                      Al hacer clic se abrirá tu cliente de correo con asunto y cuerpo pre-llenados.{' '}
                      <strong>Adjunta manualmente el PDF</strong> que descargaste en el paso 1.
                    </>
                  }
                  style={{ marginBottom: 20 }}
                />
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                  <div><Text type="secondary">Para:</Text> <Text strong>{emailTo}</Text></div>
                  {emailCc && <div><Text type="secondary">Cc:</Text> <Text>{emailCc}</Text></div>}
                  <div><Text type="secondary">Asunto:</Text> <Text>Conciliación Bancaria — {account.name} — {periodo}</Text></div>
                  <div style={{ marginTop: 6 }}><Text type="secondary">PDF:</Text> <Text type="warning">Adjuntar manualmente</Text></div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEmailStep(1)}>Atrás</Button>
                  <Button type="primary" icon={<MailOutlined />} style={{ background: NAVY }}
                    onClick={() => { openMailto(); setShowEmailModal(false) }}>
                    Abrir cliente de correo
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ── Modal historial de períodos ─────────────────────────────────────── */}
      <Modal
        title={<><HistoryOutlined /> Historial de conciliaciones — {account.name}</>}
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        footer={null}
        width={720}
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
