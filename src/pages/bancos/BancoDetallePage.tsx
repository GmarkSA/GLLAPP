import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Row, Col, Button, Typography, Space, Tag, Badge, Tooltip,
  Table, Modal, Form, Input, InputNumber, Select, DatePicker,
  message, Spin, Statistic, Divider, Upload, Popconfirm, Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, ControlOutlined, EditOutlined, ReloadOutlined, PlusOutlined,
  UploadOutlined, DeleteOutlined, LinkOutlined, CheckCircleOutlined,
  FileTextOutlined, BankOutlined, SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AccountSelect from '../../components/AccountSelect'
import {
  getBankAccount, getTransactions, addTransaction, updateTransaction,
  deleteTransaction, importStatement, refreshBankBalance,
  ACCOUNT_TYPE_CONFIG,
  type BankAccount, type BankTransaction,
} from '../../api/bancos'

const { Title, Text } = Typography
const { Option }      = Select
const { RangePicker } = DatePicker

const fmtQ = (n: number, currency = 'GTQ') =>
  `${currency === 'GTQ' ? 'Q' : '$'} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  pending:    'orange',
  reconciled: 'green',
  excluded:   'default',
}
const STATUS_LABEL: Record<string, string> = {
  pending:    'Pendiente',
  reconciled: 'Conciliado',
  excluded:   'Excluido',
}

// ── Modal: Agregar movimiento manual ────────────────────────────────────────
function AddTransactionModal({ accountId, currency, open, onClose, onSaved }: {
  accountId: string; currency: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form]   = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await addTransaction(accountId, {
        ...values,
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
      })
      message.success('Movimiento registrado')
      form.resetFields()
      onSaved()
      onClose()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('Error al registrar movimiento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={<Space><PlusOutlined /> Agregar movimiento manual</Space>}
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleOk}
      okText="Registrar"
      okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}
        initialValues={{ type: 'debit', transactionDate: dayjs() }}>
        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="transactionDate" label="Fecha" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
              <Select>
                <Option value="debit">
                  <span style={{ color: '#cf1322' }}>↓ Débito (salida)</span>
                </Option>
                <Option value="credit">
                  <span style={{ color: '#389e0d' }}>↑ Crédito (entrada)</span>
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="Descripción" rules={[{ required: true, message: 'Requerido' }]}>
          <Input placeholder="Descripción del movimiento" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="amount" label={`Monto (${currency})`} rules={[{ required: true, message: 'Requerido' }]}>
              <InputNumber<number>
                style={{ width: '100%' }} min={0} precision={2}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number(v!.replace(/,/g, ''))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reference" label="Referencia / No. cheque">
              <Input placeholder="Opcional" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

// ── Modal: Importar extracto CSV ────────────────────────────────────────────
function ImportModal({ accountId, open, onClose, onSaved }: {
  accountId: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [rows,    setRows]    = useState<any[]>([])
  const [saving,  setSaving]  = useState(false)
  const [preview, setPreview] = useState(false)

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n')
    const parsed: any[] = []
    for (const line of lines.slice(1)) {         // skip header
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 4) continue
      // Expected: date,description,amount,type[,reference]
      const [date, description, amountStr, type, reference] = cols
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''))
      if (!date || !description || isNaN(amount)) continue
      parsed.push({ date, description, amount: Math.abs(amount), type: type === 'credit' ? 'credit' : 'debit', reference })
    }
    return parsed
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setRows(parseCsv(text))
      setPreview(true)
    }
    reader.readAsText(file)
    return false  // prevent auto upload
  }

  const handleImport = async () => {
    if (!rows.length) return
    setSaving(true)
    try {
      const res = await importStatement(accountId, { rows })
      message.success(`Importados: ${res.imported} · Omitidos (duplicados): ${res.skipped}`)
      setRows([]); setPreview(false)
      onSaved(); onClose()
    } catch {
      message.error('Error al importar extracto')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<any> = [
    { title: 'Fecha',       dataIndex: 'date',        width: 100 },
    { title: 'Descripción', dataIndex: 'description', ellipsis: true },
    { title: 'Tipo',        dataIndex: 'type',        width: 80,
      render: t => <Tag color={t === 'credit' ? 'green' : 'red'}>{t === 'credit' ? 'Entrada' : 'Salida'}</Tag> },
    { title: 'Monto',       dataIndex: 'amount',      width: 110, align: 'right',
      render: n => n.toLocaleString('es-GT', { minimumFractionDigits: 2 }) },
  ]

  return (
    <Modal
      title={<Space><UploadOutlined /> Importar extracto bancario</Space>}
      open={open}
      width={680}
      onCancel={() => { setRows([]); setPreview(false); onClose() }}
      footer={preview ? [
        <Button key="back" onClick={() => setPreview(false)}>Atrás</Button>,
        <Button key="import" type="primary" loading={saving} onClick={handleImport}
          style={{ background: '#1B3A6B' }}>
          Importar {rows.length} movimientos
        </Button>,
      ] : null}
      destroyOnClose
    >
      {!preview ? (
        <div>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Formato del archivo CSV"
            description={
              <div style={{ fontSize: 12 }}>
                <div>El archivo debe tener la siguiente estructura (incluir encabezados):</div>
                <code style={{ display: 'block', marginTop: 6, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  date,description,amount,type,reference<br />
                  2024-01-15,Pago proveedor,5000.00,debit,CHK001<br />
                  2024-01-16,Depósito cliente,12000.00,credit,DEP002
                </code>
                <div style={{ marginTop: 6 }}>
                  <b>type:</b> <code>credit</code> (entrada) o <code>debit</code> (salida)
                </div>
              </div>
            }
          />
          <Upload.Dragger
            accept=".csv,.txt"
            beforeUpload={handleFile}
            showUploadList={false}
            style={{ borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 32, color: '#1677ff' }} /></p>
            <p className="ant-upload-text">Haz clic o arrastra un archivo CSV aquí</p>
            <p className="ant-upload-hint">Solo archivos .csv con el formato indicado</p>
          </Upload.Dragger>
        </div>
      ) : (
        <div>
          <Alert type="success" showIcon message={`${rows.length} movimientos listos para importar`} style={{ marginBottom: 12 }} />
          <Table
            dataSource={rows} columns={columns} rowKey={(_, i) => String(i)}
            size="small" pagination={{ pageSize: 8, size: 'small' }}
            scroll={{ x: true }}
          />
        </div>
      )}
    </Modal>
  )
}

// ── Modal: Categorizar movimiento ───────────────────────────────────────────
function CategorizeModal({ tx, open, onClose, onSaved, accountId }: {
  tx: BankTransaction | null; open: boolean; onClose: () => void; onSaved: () => void; accountId: string
}) {
  const [form]   = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tx) form.setFieldsValue({ accountId: tx.accountId, status: tx.status })
  }, [tx, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await updateTransaction(accountId, tx!.id, { ...values, status: values.accountId ? 'reconciled' : tx!.status })
      message.success('Movimiento categorizado')
      onSaved(); onClose()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('Error al categorizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={<Space><LinkOutlined /> Categorizar movimiento</Space>}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Guardar categoría"
      okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      destroyOnClose
    >
      {tx && (
        <div>
          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{dayjs(tx.transactionDate).format('DD/MM/YYYY')}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{tx.description}</div>
            <div style={{ fontSize: 16, fontFamily: 'monospace', color: tx.type === 'credit' ? '#389e0d' : '#cf1322' }}>
              {tx.type === 'credit' ? '+' : '-'} {Number(tx.amount).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <Form form={form} layout="vertical">
            <Form.Item name="accountId" label="Cuenta contable">
              <AccountSelect filter={{}} placeholder="Vincular a cuenta del catálogo..." />
            </Form.Item>
            <Form.Item name="status" label="Estado">
              <Select>
                <Option value="pending">Pendiente</Option>
                <Option value="reconciled">Conciliado</Option>
                <Option value="excluded">Excluir</Option>
              </Select>
            </Form.Item>
          </Form>
        </div>
      )}
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function BancoDetallePage() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()

  const [account,  setAccount]  = useState<BankAccount | null>(null)
  const [txs,      setTxs]      = useState<BankTransaction[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [txLoad,   setTxLoad]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [dates,    setDates]    = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [addOpen,       setAddOpen]       = useState(false)
  const [importOpen,    setImportOpen]    = useState(false)
  const [categorizeOpen, setCategorizeOpen] = useState(false)
  const [selectedTx,    setSelectedTx]    = useState<BankTransaction | null>(null)

  // ── Fetch account ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getBankAccount(id)
      .then(setAccount)
      .catch(() => { message.error('Cuenta no encontrada'); navigate('/bancos') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  // ── Fetch transactions ─────────────────────────────────────────────────
  const fetchTxs = useCallback(async () => {
    if (!id) return
    setTxLoad(true)
    try {
      const params: any = { page, limit: 25 }
      if (search) params.search = search
      if (status) params.status = status
      if (dates) {
        params.fromDate = dates[0].format('YYYY-MM-DD')
        params.toDate   = dates[1].format('YYYY-MM-DD')
      }
      const res = await getTransactions(id, params)
      setTxs(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
    } catch {
      setTxs([])
    } finally {
      setTxLoad(false)
    }
  }, [id, page, search, status, dates])

  useEffect(() => { fetchTxs() }, [fetchTxs])

  const handleRefreshBalance = async () => {
    if (!id) return
    setRefreshing(true)
    try {
      const res = await refreshBankBalance(id)
      message.success(`Saldo actualizado: ${fmtQ(res.balance, account?.currency)}`)
      getBankAccount(id).then(setAccount)
    } catch {
      message.error('Error actualizando saldo')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDeleteTx = async (txId: string) => {
    try {
      await deleteTransaction(id!, txId)
      message.success('Movimiento eliminado')
      fetchTxs()
    } catch {
      message.error('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!account) return null

  const cfg = ACCOUNT_TYPE_CONFIG[account.type]

  const fmtDate = (d: string) => {
    const s = String(d || '').split('T')[0]
    if (!s || s <= '1970-01-01') return <Text type="secondary">—</Text>
    const [y, m, day] = s.split('-')
    return `${day}/${m}/${y}`
  }

  const columns: ColumnsType<BankTransaction> = [
    {
      title: 'Fecha',
      dataIndex: 'transactionDate',
      width: 100,
      render: fmtDate,
      sorter: (a, b) => a.transactionDate.localeCompare(b.transactionDate),
    },
    {
      title: 'Descripción / Referencia',
      dataIndex: 'description',
      ellipsis: true,
      render: (desc, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{desc}</div>
          {row.reference && <div style={{ fontSize: 11, color: '#8c8c8c' }}>Ref: {row.reference}</div>}
        </div>
      ),
    },
    {
      title: 'Haber (Ingreso)',
      key: 'haber',
      width: 150,
      align: 'right',
      render: (_, row) => row.type === 'credit'
        ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#389e0d' }}>
            + {Number(row.amount).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </span>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Debe (Egreso)',
      key: 'debe',
      width: 150,
      align: 'right',
      render: (_, row) => row.type === 'debit'
        ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#cf1322' }}>
            - {Number(row.amount).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </span>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cuenta contable',
      key: 'account',
      width: 180,
      render: (_, row) => row.accountCode
        ? <Tooltip title={row.accountName}><Tag color="purple">{row.accountCode}</Tag></Tooltip>
        : <Tag color="orange">Sin categorizar</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: s => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      fixed: 'right',
      align: 'center',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Categorizar">
            <Button
              size="small" type="text" icon={<LinkOutlined />}
              onClick={() => { setSelectedTx(row); setCategorizeOpen(true) }}
            />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar este movimiento?"
            onConfirm={() => handleDeleteTx(row.id)}
            okText="Sí" cancelText="No"
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bancos')} />
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${cfg.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {cfg.icon}
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
              {account.name}
              {account.isPrimary && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>Principal</Tag>}
            </Title>
            <Space size={6}>
              <Tag color={cfg.color}>{cfg.label}</Tag>
              <Tag>{account.currency}</Tag>
              {account.bankName && <Text type="secondary" style={{ fontSize: 12 }}>{account.bankName}</Text>}
              {account.accountNumber && (
                <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                  ···{account.accountNumber.slice(-4)}
                </Text>
              )}
            </Space>
          </div>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            loading={refreshing}
            onClick={handleRefreshBalance}
          >
            Actualizar saldo
          </Button>
          <Button
            icon={<ControlOutlined />}
            onClick={() => navigate('/bancos/reglas')}
          >
            Reglas bancarias
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/bancos/${id}/editar`)}
          >
            Editar
          </Button>
        </Space>
      </div>

      {/* KPI strip */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Saldo actual</span>}
              value={account.currentBalance}
              precision={2}
              prefix={account.currency === 'GTQ' ? 'Q' : '$'}
              valueStyle={{ fontFamily: 'monospace', fontSize: 18, color: Number(account.currentBalance) >= 0 ? '#1B3A6B' : '#cf1322' }}
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Total movimientos</span>}
              value={total}
              valueStyle={{ fontSize: 18, color: '#1B3A6B' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Sin categorizar</span>}
              value={account.uncategorizedCount || 0}
              valueStyle={{ fontSize: 18, color: (account.uncategorizedCount || 0) > 0 ? '#d46b08' : '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '12px 16px' }}>
            {account.glAccountCode ? (
              <div>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Cuenta contable vinculada</div>
                <Space>
                  <LinkOutlined style={{ color: '#722ed1' }} />
                  <Text style={{ fontFamily: 'monospace', color: '#722ed1', fontWeight: 600 }}>
                    {account.glAccountCode}
                  </Text>
                  <Text ellipsis style={{ fontSize: 12, maxWidth: 100 }}>{account.glAccountName}</Text>
                </Space>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Cuenta contable</div>
                <Text type="warning" style={{ fontSize: 12 }}>Sin vincular</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Movimientos */}
      <Card
        title={<Space><FileTextOutlined /> Movimientos</Space>}
        style={{ borderRadius: 10 }}
        extra={
          <Space>
            <Button size="small" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Importar extracto
            </Button>
            <Button size="small" type="primary" icon={<PlusOutlined />}
              onClick={() => setAddOpen(true)} style={{ background: '#1B3A6B' }}>
              Agregar
            </Button>
          </Space>
        }
      >
        {/* Filters */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Buscar descripción, referencia..."
            style={{ width: 260 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <RangePicker
            format="DD/MM/YYYY"
            onChange={v => { setDates(v as any); setPage(1) }}
            style={{ width: 220 }}
          />
          <Select
            style={{ width: 140 }}
            placeholder="Estado"
            allowClear
            value={status || undefined}
            onChange={v => { setStatus(v || ''); setPage(1) }}
          >
            <Option value="pending">Pendiente</Option>
            <Option value="reconciled">Conciliado</Option>
            <Option value="excluded">Excluido</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchTxs} loading={txLoad}>
            Actualizar
          </Button>
        </Space>

        <Table<BankTransaction>
          dataSource={txs}
          columns={columns}
          rowKey="id"
          loading={txLoad}
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 460px)' }}
          pagination={{
            current: page,
            pageSize: 25,
            total,
            onChange: p => setPage(p),
            showTotal: (t, r) => `${r[0]}-${r[1]} de ${t} movimientos`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin movimientos. Agrega uno manualmente o importa un extracto bancario.' }}
          rowClassName={row => row.status === 'excluded' ? 'ant-table-row-muted' : ''}
        />
      </Card>

      {/* Modals */}
      <AddTransactionModal
        accountId={id!}
        currency={account.currency}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={fetchTxs}
      />
      <ImportModal
        accountId={id!}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={() => { fetchTxs(); getBankAccount(id!).then(setAccount) }}
      />
      <CategorizeModal
        accountId={id!}
        tx={selectedTx}
        open={categorizeOpen}
        onClose={() => { setCategorizeOpen(false); setSelectedTx(null) }}
        onSaved={fetchTxs}
      />
    </div>
  )
}
