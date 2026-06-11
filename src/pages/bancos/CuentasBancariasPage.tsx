import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApartmentOutlined,
  BankOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCompanyStore } from '../../store/companyStore'
import {
  ACCOUNT_TYPE_CONFIG,
  activateBankAccount,
  deactivateBankAccount,
  getBankAccounts,
  refreshBankBalance,
  type BankAccount,
  type BankAccountType,
} from '../../api/bancos'
import { accountTypeIcon, moneyFmt, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography

export default function CuentasBancariasPage() {
  const navigate = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<BankAccountType | undefined>()
  const [status, setStatus] = useState<string>('active')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBankAccounts({
        companyId: activeCompany?.id,
        search: search || undefined,
        type,
        status: status || undefined,
      })
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      setAccounts([])
      message.error('No se pudieron cargar las cuentas bancarias')
    } finally {
      setLoading(false)
    }
  }, [activeCompany?.id, search, status, type])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    const active = accounts.filter(a => a.status === 'active')
    return {
      balance: active.reduce((sum, a) => sum + Number(a.currentBalance || 0), 0),
      active: active.length,
      cards: accounts.filter(a => a.type === 'credit_card').length,
      pending: accounts.reduce((sum, a) => sum + Number(a.uncategorizedCount || 0), 0),
    }
  }, [accounts])

  const handleRefreshBalance = async (account: BankAccount) => {
    try {
      const res = await refreshBankBalance(account.id)
      message.success(`Saldo actualizado: ${moneyFmt(res.balance, account.currency)}`)
      load()
    } catch {
      message.error('No se pudo actualizar el saldo')
    }
  }

  const handleToggleStatus = async (account: BankAccount) => {
    try {
      if (account.status === 'active') {
        await deactivateBankAccount(account.id)
        message.success('Cuenta desactivada')
      } else {
        await activateBankAccount(account.id)
        message.success('Cuenta activada')
      }
      load()
    } catch {
      message.error('No se pudo actualizar el estado')
    }
  }

  const columns: ColumnsType<BankAccount> = [
    {
      title: 'Cuenta',
      dataIndex: 'name',
      width: 300,
      fixed: 'left',
      render: (_, row) => {
        const cfg = ACCOUNT_TYPE_CONFIG[row.type]
        return (
          <Space align="start">
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              background: `${cfg.color}16`,
            }}>
              {accountTypeIcon(row.type, cfg.color)}
            </div>
            <div>
              <Button type="link" style={{ padding: 0, height: 'auto', color: NAVY, fontWeight: 700 }}
                onClick={() => navigate(`/bancos/${row.id}`)}>
                {row.name}
              </Button>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {row.bankName || 'Banco no indicado'}
                {row.accountNumber ? ` - ****${row.accountNumber.slice(-4)}` : ''}
              </div>
            </div>
          </Space>
        )
      },
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      width: 160,
      render: (v: BankAccountType) => {
        const cfg = ACCOUNT_TYPE_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Moneda',
      dataIndex: 'currency',
      width: 90,
      render: v => <Tag>{v}</Tag>,
    },
    {
      title: 'Saldo sistema',
      dataIndex: 'currentBalance',
      width: 160,
      align: 'right',
      render: (v, row) => <Text strong style={{ fontFamily: 'monospace', color: Number(v) < 0 ? '#cf1322' : NAVY }}>{moneyFmt(Number(v), row.currency)}</Text>,
    },
    {
      title: 'Saldo banco',
      dataIndex: 'bankBalance',
      width: 160,
      align: 'right',
      render: (v, row) => v == null ? <Text type="secondary">Pendiente</Text> : <Text style={{ fontFamily: 'monospace' }}>{moneyFmt(Number(v), row.currency)}</Text>,
    },
    {
      title: 'Diferencia',
      key: 'difference',
      width: 140,
      align: 'right',
      render: (_, row) => {
        if (row.bankBalance == null) return <Text type="secondary">-</Text>
        const diff = Number(row.bankBalance) - Number(row.currentBalance)
        return <Text style={{ fontFamily: 'monospace', color: Math.abs(diff) > 0.01 ? '#cf1322' : '#389e0d' }}>{moneyFmt(diff, row.currency)}</Text>
      },
    },
    {
      title: 'Cuenta contable',
      dataIndex: 'glAccountCode',
      width: 220,
      render: (_, row) => row.glAccountCode
        ? <Tooltip title={row.glAccountName}><Tag color="purple">{row.glAccountCode}</Tag></Tooltip>
        : <Tag color="orange">Sin vincular</Tag>,
    },
    {
      title: 'Pendientes',
      dataIndex: 'uncategorizedCount',
      width: 110,
      align: 'center',
      render: v => <Tag color={Number(v || 0) > 0 ? 'orange' : 'green'}>{Number(v || 0)}</Tag>,
    },
    {
      title: 'Ultimo estado',
      dataIndex: 'lastStatementDate',
      width: 130,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : <Text type="secondary">Sin importar</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? 'Activa' : 'Inactiva'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      fixed: 'right',
      render: (_, row) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'movements', label: 'Ver movimientos', icon: <FileSearchOutlined /> },
              { key: 'edit', label: 'Editar', icon: <EditOutlined /> },
              { key: 'reconcile', label: 'Conciliacion', icon: <CheckCircleOutlined /> },
              { key: 'refresh', label: 'Actualizar saldo', icon: <ReloadOutlined /> },
              { type: 'divider' },
              row.status === 'active'
                ? { key: 'toggle', label: 'Desactivar', icon: <StopOutlined />, danger: true }
                : { key: 'toggle', label: 'Activar', icon: <CheckCircleOutlined /> },
            ],
            onClick: ({ key }) => {
              if (key === 'movements') navigate(`/bancos/${row.id}`)
              if (key === 'edit') navigate(`/bancos/${row.id}/editar`)
              if (key === 'reconcile') navigate(`/bancos/${row.id}/conciliacion`)
              if (key === 'refresh') handleRefreshBalance(row)
              if (key === 'toggle') handleToggleStatus(row)
            },
          }}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>Bancos y Tesoreria</Title>
          <Text type="secondary">
            Cuentas bancarias, tarjetas y saldos por empresa
            {activeCompany ? ` - ${activeCompany.tradeName || activeCompany.legalName}` : ''}
          </Text>
        </div>
        <Space wrap>
          <Button icon={<SwapOutlined />} onClick={() => navigate('/bancos/transferencias/nueva')}>Transferencia</Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }} onClick={() => navigate('/bancos/nuevo')}>
            Nueva cuenta
          </Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card size="small" style={panelStyle}><Statistic title="Saldo activo" value={totals.balance} formatter={v => moneyFmt(Number(v))} valueStyle={{ color: NAVY, fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Cuentas activas" value={totals.active} prefix={<BankOutlined />} valueStyle={{ color: '#389e0d', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Tarjetas" value={totals.cards} prefix={<ApartmentOutlined />} valueStyle={{ color: '#ff4d4f', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Sin categorizar" value={totals.pending} prefix={<BranchesOutlined />} valueStyle={{ color: totals.pending ? '#d46b08' : '#389e0d', fontSize: 18 }} /></Card>
      </div>

      <Card size="small" style={{ ...panelStyle, marginBottom: 12 }}>
        <Space wrap>
          <Input
            allowClear
            size="small"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={load}
            placeholder="Buscar cuenta, banco o numero"
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            size="small"
            placeholder="Tipo"
            value={type}
            onChange={setType}
            style={{ width: 190 }}
            options={Object.entries(ACCOUNT_TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))}
          />
          <Select
            size="small"
            value={status}
            onChange={setStatus}
            style={{ width: 130 }}
            options={[
              { value: 'active', label: 'Activas' },
              { value: 'inactive', label: 'Inactivas' },
              { value: 'all', label: 'Todas' },
            ]}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
        </Space>
      </Card>

      <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankAccount>
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 60 }}
          pagination={{ pageSize: 50, showTotal: t => `${t} registros` }}
          locale={{ emptyText: <Empty description="Sin cuentas bancarias" /> }}
        />
      </Card>
    </div>
  )
}
