import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
  Spin,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import AccountSelect from '../../components/AccountSelect'
import { useCompanyStore } from '../../store/companyStore'
import {
  ACCOUNT_TYPE_CONFIG,
  TRANSACTION_STATUS_CONFIG,
  addTransaction,
  getBankAccount,
  getTransactions,
  importStatement,
  updateTransaction,
  type BankAccount,
  type BankTransaction,
  type TransactionStatus,
  type TransactionType,
} from '../../api/bancos'
import { accountTypeIcon, formGrid, moneyFmt, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function TransactionModal({ open, account, onClose, onSaved }: {
  open: boolean
  account: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!account) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      await addTransaction(account.id, {
        ...values,
        companyId: activeCompany?.id,
        bankAccountId: account.id,
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
        currency: account.currency,
        exchangeRate: values.exchangeRate || 1,
      })
      message.success('Transaccion registrada')
      form.resetFields()
      onSaved()
      onClose()
    } catch {
      message.error('No se pudo registrar la transaccion')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Agregar transaccion"
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleSave}
      okText="Registrar"
      okButtonProps={{ loading: saving, style: { background: NAVY } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" size="small" initialValues={{ transactionDate: dayjs(), type: 'debit', exchangeRate: 1 }}>
        <div style={formGrid}>
          <Form.Item name="transactionDate" label="Fecha" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
            <Select options={[
              { value: 'credit', label: 'Ingreso' },
              { value: 'debit', label: 'Egreso' },
            ]} />
          </Form.Item>
          <Form.Item name="amount" label={`Monto ${account?.currency || ''}`} rules={[{ required: true }]}>
            <InputNumber<number>
              min={0}
              precision={2}
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number((v || '').replace(/,/g, ''))}
            />
          </Form.Item>
          <Form.Item name="exchangeRate" label="Tipo de cambio">
            <InputNumber<number> min={0} precision={6} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="description" label="Descripcion" rules={[{ required: true }]}>
          <Input placeholder="Detalle de la transaccion" />
        </Form.Item>
        <div style={formGrid}>
          <Form.Item name="reference" label="Referencia">
            <Input placeholder="Cheque, deposito, transferencia" />
          </Form.Item>
          <Form.Item name="accountId" label="Cuenta contable">
            <AccountSelect size="small" filter={{}} placeholder="Categorizar con cuenta contable" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

function ImportModal({ open, account, onClose, onSaved }: {
  open: boolean
  account: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const parseRows = (rawRows: any[][]) => {
    const [, ...body] = rawRows
    return body
      .map(cols => {
        const [date, description, debit, credit, reference, balance] = cols
        const debitAmount = Number(String(debit ?? '').replace(/[^0-9.-]/g, ''))
        const creditAmount = Number(String(credit ?? '').replace(/[^0-9.-]/g, ''))
        const amount = creditAmount > 0 ? creditAmount : Math.abs(debitAmount)
        if (!date || !description || !amount) return null
        return {
          date: dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DD') : String(date),
          transactionDate: dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DD') : String(date),
          description: String(description),
          amount,
          type: creditAmount > 0 ? 'credit' : 'debit',
          reference: reference ? String(reference) : undefined,
          runningBalance: balance ? Number(String(balance).replace(/[^0-9.-]/g, '')) : undefined,
        }
      })
      .filter(Boolean)
  }

  const beforeUpload = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const parsed = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    setRows(parseRows(parsed))
    return false
  }

  const handleImport = async () => {
    if (!account || rows.length === 0) return
    setSaving(true)
    try {
      const res = await importStatement(account.id, rows)
      message.success(`Importadas: ${res.imported} - Duplicadas/omitidas: ${res.skipped}`)
      setRows([])
      onSaved()
      onClose()
    } catch {
      message.error('No se pudo importar el estado de cuenta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Importar estado de cuenta"
      open={open}
      width={760}
      onCancel={() => { setRows([]); onClose() }}
      footer={[
        <Button key="cancel" onClick={() => { setRows([]); onClose() }}>Cancelar</Button>,
        <Button key="import" type="primary" disabled={!rows.length} loading={saving} onClick={handleImport} style={{ background: NAVY }}>
          Importar {rows.length || ''} movimientos
        </Button>,
      ]}
      destroyOnClose
    >
      <Upload.Dragger beforeUpload={beforeUpload} showUploadList={false} accept=".xlsx,.xls,.csv">
        <p className="ant-upload-drag-icon"><FileExcelOutlined style={{ color: NAVY }} /></p>
        <p className="ant-upload-text">Arrastra o selecciona un archivo Excel/CSV</p>
        <p className="ant-upload-hint">Columnas sugeridas: fecha, descripcion, debito, credito, referencia, saldo.</p>
      </Upload.Dragger>
      {rows.length > 0 && (
        <Table
          style={{ marginTop: 12 }}
          size="small"
          dataSource={rows}
          rowKey={(_, i) => String(i)}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 60 }}
          columns={[
            { title: 'Fecha', dataIndex: 'transactionDate', width: 100 },
            { title: 'Descripcion', dataIndex: 'description', ellipsis: true },
            { title: 'Tipo', dataIndex: 'type', width: 90, render: v => <Tag color={v === 'credit' ? 'green' : 'red'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
            { title: 'Monto', dataIndex: 'amount', width: 120, align: 'right', render: v => moneyFmt(Number(v), account?.currency) },
          ]}
        />
      )}
    </Modal>
  )
}

export default function TransaccionesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TransactionStatus | undefined>()
  const [type, setType] = useState<TransactionType | undefined>()
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    getBankAccount(id)
      .then(setAccount)
      .catch(() => {
        message.error('Cuenta bancaria no encontrada')
        navigate('/bancos')
      })
  }, [id, navigate])

  const loadTransactions = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getTransactions(id, {
        page,
        limit: 50,
        search: search || undefined,
        status,
        type,
        fromDate: dates?.[0]?.format('YYYY-MM-DD'),
        toDate: dates?.[1]?.format('YYYY-MM-DD'),
      })
      setTransactions(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
    } catch {
      setTransactions([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [dates, id, page, search, status, type])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const summary = useMemo(() => {
    const incoming = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0)
    const outgoing = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0)
    const pending = transactions.filter(t => t.status === 'pending').length
    return { incoming, outgoing, pending }
  }, [transactions])

  const columns: ColumnsType<BankTransaction> = [
    { title: 'Fecha', dataIndex: 'transactionDate', width: 110, fixed: 'left', render: v => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Descripcion',
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
    { title: 'Monto', dataIndex: 'amount', width: 150, align: 'right', render: (v, row) => <Text strong style={{ fontFamily: 'monospace', color: row.type === 'credit' ? '#389e0d' : '#cf1322' }}>{row.type === 'credit' ? '+' : '-'} {moneyFmt(Number(v), account?.currency)}</Text> },
    { title: 'Saldo', dataIndex: 'runningBalance', width: 140, align: 'right', render: v => v == null ? <Text type="secondary">-</Text> : <Text style={{ fontFamily: 'monospace' }}>{moneyFmt(Number(v), account?.currency)}</Text> },
    { title: 'Estado', dataIndex: 'status', width: 150, render: v => {
      const cfg = TRANSACTION_STATUS_CONFIG[v as TransactionStatus] || TRANSACTION_STATUS_CONFIG.pending
      return <Tag color={cfg.color}>{cfg.label}</Tag>
    } },
    { title: 'Cuenta contable', dataIndex: 'accountName', width: 220, render: (_, row) => row.accountName || row.accountCode ? <Tag color="purple">{row.accountCode || row.accountName}</Tag> : <Tag color="orange">Sin categorizar</Tag> },
    {
      title: '',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, row) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            Modal.confirm({
              title: 'Marcar como conciliada',
              content: 'Esta accion deja preparada la transaccion para conciliacion formal.',
              okText: 'Confirmar',
              okButtonProps: { style: { background: NAVY } },
              onOk: async () => {
                await updateTransaction(id!, row.id, { status: 'reconciled' })
                loadTransactions()
              },
            })
          }}
        />
      ),
    },
  ]

  if (!account) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <Spin size="large" />
      </div>
    )
  }

  const cfg = ACCOUNT_TYPE_CONFIG[account.type]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bancos')} />
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: `${cfg.color}16`,
          }}>
            {accountTypeIcon(account.type, cfg.color)}
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: NAVY }}>{account.name}</Title>
            <Text type="secondary">{account.bankName} - {account.currency}</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<CheckCircleOutlined />} onClick={() => navigate(`/bancos/${account.id}/conciliacion`)}>Conciliacion</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Importar estado</Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }} onClick={() => setTransactionOpen(true)}>Agregar transaccion</Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card size="small" style={panelStyle}><Statistic title="Saldo sistema" value={account.currentBalance} formatter={v => moneyFmt(Number(v), account.currency)} valueStyle={{ color: NAVY, fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Ingresos filtrados" value={summary.incoming} formatter={v => moneyFmt(Number(v), account.currency)} valueStyle={{ color: '#389e0d', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Egresos filtrados" value={summary.outgoing} formatter={v => moneyFmt(Number(v), account.currency)} valueStyle={{ color: '#cf1322', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Pendientes" value={summary.pending} valueStyle={{ color: summary.pending ? '#d46b08' : '#389e0d', fontSize: 18 }} /></Card>
      </div>

      <Card size="small" style={{ ...panelStyle, marginBottom: 12 }}>
        <Space wrap>
          <Input.Search size="small" allowClear placeholder="Buscar descripcion o referencia" value={search} onChange={e => setSearch(e.target.value)} onSearch={() => { setPage(1); loadTransactions() }} style={{ width: 280 }} />
          <RangePicker size="small" format="DD/MM/YYYY" onChange={v => { setDates(v as any); setPage(1) }} />
          <Select allowClear size="small" placeholder="Tipo" value={type} onChange={v => { setType(v); setPage(1) }} style={{ width: 130 }} options={[
            { value: 'credit', label: 'Ingresos' },
            { value: 'debit', label: 'Egresos' },
          ]} />
          <Select allowClear size="small" placeholder="Estado" value={status} onChange={v => { setStatus(v); setPage(1) }} style={{ width: 170 }} options={Object.entries(TRANSACTION_STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))} />
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={loadTransactions}>Actualizar</Button>
        </Space>
      </Card>

      <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankTransaction>
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 60 }}
          pagination={{ current: page, pageSize: 50, total, showTotal: t => `${t} registros`, onChange: setPage }}
        />
      </Card>

      <TransactionModal open={transactionOpen} account={account} onClose={() => setTransactionOpen(false)} onSaved={loadTransactions} />
      <ImportModal open={importOpen} account={account} onClose={() => setImportOpen(false)} onSaved={loadTransactions} />
    </div>
  )
}
