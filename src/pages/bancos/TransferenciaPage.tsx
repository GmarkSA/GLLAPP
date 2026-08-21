import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, SaveOutlined, SwapOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCompanyStore } from '../../store/companyStore'
import { getApiError } from '../../api/axios'
import {
  createBankTransfer,
  getBankAccounts,
  getBankTransfers,
  money,
  type BankAccount,
  type BankTransfer,
} from '../../api/bancos'
import { formGrid, NAVY, pageHeaderStyle, panelStyle, wideFormGrid } from './bancosShared'

const { Title, Text } = Typography
const { TextArea } = Input

export default function TransferenciaPage() {
  const navigate = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transfers, setTransfers] = useState<BankTransfer[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBankAccounts({ status: 'active', companyId: activeCompany?.id })
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]))
    getBankTransfers({ page: 1, limit: 50 })
      .then(res => setTransfers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTransfers([]))
  }, [activeCompany?.id])

  const accountOptions = useMemo(() => accounts.map(account => ({
    value: account.id,
    label: `${account.name} - ${account.currency} - ${money(Number(account.currentBalance), account.currency)}`,
    account,
  })), [accounts])

  const handleSubmit = async (values: any) => {
    if (!activeCompany?.id) {
      message.warning('Selecciona una empresa antes de guardar')
      return
    }
    if (values.fromAccountId === values.toAccountId) {
      message.warning('La cuenta origen y destino deben ser distintas')
      return
    }

    setSaving(true)
    try {
      await createBankTransfer({
        companyId: activeCompany.id,
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        amount: values.amount,
        currency: values.currency,
        exchangeRate: values.exchangeRate || 1,
        transferDate: values.transferDate.format('YYYY-MM-DD'),
        reference: values.reference,
        notes: values.notes,
      })
      message.success('Transferencia registrada')
      form.resetFields()
      setLoading(true)
      const res = await getBankTransfers({ page: 1, limit: 50 })
      setTransfers(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      message.error(getApiError(e, 'No se pudo registrar la transferencia'))
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  const columns: ColumnsType<BankTransfer> = [
    { title: 'Fecha', dataIndex: 'transferDate', width: 110, render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Origen', dataIndex: 'fromAccountId', width: 220, render: v => accounts.find(a => a.id === v)?.name || v },
    { title: 'Destino', dataIndex: 'toAccountId', width: 220, render: v => accounts.find(a => a.id === v)?.name || v },
    { title: 'Monto', dataIndex: 'amount', width: 150, align: 'right', render: (v, row) => <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(Number(v), row.currency)}</Text> },
    { title: 'Referencia', dataIndex: 'reference', width: 180 },
    { title: 'Estado', dataIndex: 'status', width: 120, render: v => <Tag color={v === 'posted' ? '#2ea172' : v === 'voided' ? '#e5484d' : '#1faec2'}>{v || 'draft'}</Tag> },
  ]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bancos')} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Transferencia entre cuentas</Title>
            <Text type="secondary">Movimiento interno entre bancos, tarjetas o caja chica</Text>
          </div>
        </div>
      </div>

      <Card title={<><SwapOutlined /> Nueva transferencia</>} size="small" style={{ ...panelStyle, marginBottom: 12 }}>
        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={handleSubmit}
          initialValues={{ currency: 'GTQ', exchangeRate: 1, transferDate: dayjs() }}
        >
          <div style={wideFormGrid}>
            <Form.Item name="fromAccountId" label="Cuenta origen" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={accountOptions} />
            </Form.Item>
            <Form.Item name="toAccountId" label="Cuenta destino" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={accountOptions} />
            </Form.Item>
          </div>
          <div style={formGrid}>
            <Form.Item name="transferDate" label="Fecha" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
              <InputNumber<number>
                min={0}
                precision={2}
                style={{ width: '100%' }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number((v || '').replace(/,/g, ''))}
              />
            </Form.Item>
            <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}>
              <Select options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]} />
            </Form.Item>
            <Form.Item name="exchangeRate" label="Tipo de cambio">
              <InputNumber<number> min={0} precision={6} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={wideFormGrid}>
            <Form.Item name="reference" label="Referencia">
              <Input placeholder="No. transferencia, cheque o nota interna" />
            </Form.Item>
            <Form.Item name="notes" label="Notas">
              <TextArea rows={2} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: NAVY }}>
              Registrar transferencia
            </Button>
          </div>
        </Form>
      </Card>

      <Card title="Transferencias recientes" size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankTransfer>
          columns={columns}
          dataSource={transfers}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content', y: 'calc(100vh - 330px)' }}
          sticky={{ offsetHeader: 60 }}
          pagination={{ pageSize: 50, showTotal: t => `${t} registros` }}
        />
      </Card>
    </div>
  )
}
