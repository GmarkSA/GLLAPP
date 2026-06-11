import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Input, Modal, Space, Statistic, Table, Tag, Typography, message, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckCircleOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  autoMatchReconciliation,
  getBankAccount,
  getPendingReconciliation,
  getReconciliationSummary,
  reconcileTransaction,
  TRANSACTION_STATUS_CONFIG,
  type BankAccount,
  type BankTransaction,
  type ReconciliationSummary,
  type TransactionStatus,
} from '../../api/bancos'
import { moneyFmt, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography

export default function ConciliacionPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [rows, setRows] = useState<BankTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    if (!id) return
    getBankAccount(id).then(setAccount).catch(() => navigate('/bancos'))
  }, [id, navigate])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [pending, sum] = await Promise.all([
        getPendingReconciliation(id, { page, limit: 50, search: search || undefined }),
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
  }, [id, page, search])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => ({
    pending: summary?.pending ?? rows.length,
    matched: summary?.matched ?? rows.filter(r => r.status === 'matched').length,
    reconciled: summary?.reconciled ?? 0,
    difference: account?.bankBalance == null ? null : Number(account.bankBalance) - Number(account.currentBalance),
  }), [account, rows, summary])

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
    { title: 'Tipo', dataIndex: 'type', width: 100, render: v => <Tag color={v === 'credit' ? 'green' : 'red'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
    { title: 'Monto', dataIndex: 'amount', width: 150, align: 'right', render: (v, row) => <Text style={{ fontFamily: 'monospace', color: row.type === 'credit' ? '#389e0d' : '#cf1322' }}>{moneyFmt(Number(v), account?.currency)}</Text> },
    { title: 'Estado', dataIndex: 'status', width: 150, render: v => {
      const cfg = TRANSACTION_STATUS_CONFIG[v as TransactionStatus] || TRANSACTION_STATUS_CONFIG.pending
      return <Tag color={cfg.color}>{cfg.label}</Tag>
    } },
    { title: 'Sugerencia', key: 'match', width: 240, render: (_, row) => row.matchedPaymentId || row.matchedInvoiceId || row.matchedJournalEntryId ? <Tag color="purple">Coincidencia detectada</Tag> : <Text type="secondary">Sin coincidencia</Text> },
    { title: '', key: 'actions', width: 120, fixed: 'right', render: (_, row) => <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: NAVY }} onClick={() => handleReconcile(row)}>Conciliar</Button> },
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
            <Title level={4} style={{ margin: 0, color: NAVY }}>Conciliacion bancaria</Title>
            <Text type="secondary">{account.name} - {account.bankName}</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Actualizar</Button>
          <Button type="primary" icon={<RobotOutlined />} loading={matching} style={{ background: NAVY }} onClick={handleAutoMatch}>
            Buscar coincidencias
          </Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card size="small" style={panelStyle}><Statistic title="Pendientes" value={totals.pending} valueStyle={{ color: '#d46b08', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Con coincidencia" value={totals.matched} valueStyle={{ color: '#722ed1', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Conciliadas" value={totals.reconciled} valueStyle={{ color: '#389e0d', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Diferencia" value={totals.difference ?? 0} formatter={v => totals.difference == null ? 'Sin saldo banco' : moneyFmt(Number(v), account.currency)} valueStyle={{ color: totals.difference && Math.abs(totals.difference) > 0.01 ? '#cf1322' : NAVY, fontSize: 18 }} /></Card>
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
        </Space>
      </Card>

      <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankTransaction>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 60 }}
          pagination={{ current: page, pageSize: 50, total, showTotal: t => `${t} registros`, onChange: setPage }}
          locale={{ emptyText: <Empty description="Sin movimientos pendientes de conciliar" /> }}
        />
      </Card>
    </div>
  )
}
