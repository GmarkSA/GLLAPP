import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Button, Typography, Space, Tag, Badge, Tooltip,
  Dropdown, Popconfirm, message, Input, Select, Empty, Spin, Statistic,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, MoreOutlined, EditOutlined,
  DeleteOutlined, SyncOutlined, EyeOutlined, CheckCircleOutlined,
  StopOutlined, ReloadOutlined, BankOutlined, LinkOutlined,
} from '@ant-design/icons'
import {
  getBankAccounts, getBankSummary, deleteBankAccount,
  activateBankAccount, deactivateBankAccount, refreshBankBalance,
  ACCOUNT_TYPE_CONFIG, type BankAccount,
} from '../../api/bancos'

const { Title, Text } = Typography
const { Option } = Select

const fmtQ = (n: number, currency = 'GTQ') =>
  `${currency === 'GTQ' ? 'Q' : '$'} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

function BankCard({ account, onEdit, onRefresh }: {
  account: BankAccount
  onEdit: (id: string) => void
  onRefresh: () => void
}) {
  const navigate = useNavigate()
  const cfg      = ACCOUNT_TYPE_CONFIG[account.type]
  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshBalance = async () => {
    setRefreshing(true)
    try {
      const res = await refreshBankBalance(account.id)
      message.success(`Saldo actualizado: ${fmtQ(res.balance, account.currency)}`)
      onRefresh()
    } catch {
      message.error('Error actualizando saldo')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      await deactivateBankAccount(account.id)
      message.success('Cuenta desactivada')
      onRefresh()
    } catch { message.error('Error al desactivar') }
  }

  const handleActivate = async () => {
    try {
      await activateBankAccount(account.id)
      message.success('Cuenta activada')
      onRefresh()
    } catch { message.error('Error al activar') }
  }

  const menuItems = [
    { key: 'view',     label: 'Ver movimientos', icon: <EyeOutlined /> },
    { key: 'edit',     label: 'Editar',           icon: <EditOutlined /> },
    { key: 'balance',  label: 'Actualizar saldo', icon: <ReloadOutlined /> },
    { type: 'divider' as const },
    account.status === 'active'
      ? { key: 'deactivate', label: <span style={{ color: '#ff7f00' }}>Desactivar</span>, icon: <StopOutlined style={{ color: '#ff7f00' }} /> }
      : { key: 'activate',   label: <span style={{ color: '#2ea172' }}>Activar</span>,    icon: <CheckCircleOutlined style={{ color: '#2ea172' }} /> },
    { type: 'divider' as const },
    {
      key: 'delete', label: (
        <Popconfirm
          title="¿Desactivar esta cuenta bancaria?"
          description="Los movimientos registrados no se eliminarán."
          onConfirm={handleDeactivate}
          okText="Sí" cancelText="No"
        >
          <span style={{ color: '#e5484d' }}>Eliminar</span>
        </Popconfirm>
      ),
      icon: <DeleteOutlined style={{ color: '#e5484d' }} />,
    },
  ]

  return (
    <Card
      style={{
        borderRadius: 12,
        border: account.isPrimary ? '2px solid #1faec2' : '1px solid rgba(10,10,10,0.08)',
        opacity: account.status === 'inactive' ? 0.6 : 1,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      bodyStyle={{ padding: 20 }}
      hoverable
      onClick={() => navigate(`/bancos/${account.id}`)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <Space size={10} align="start">
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: `${cfg.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            {cfg.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1faec2', lineHeight: 1.3 }}>
              {account.name}
              {account.isPrimary && (
                <Tag color="#1faec2" style={{ fontSize: 10, marginLeft: 6, verticalAlign: 'middle' }}>Principal</Tag>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {account.bankName && <span>{account.bankName}</span>}
              {account.accountNumber && (
                <span style={{ marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>
                  ···{account.accountNumber.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </Space>
        <Dropdown
          menu={{
            items: menuItems,
            onClick: ({ key }) => {
              if (key === 'view')     navigate(`/bancos/${account.id}`)
              if (key === 'edit')     onEdit(account.id)
              if (key === 'balance')  handleRefreshBalance()
              if (key === 'activate') handleActivate()
            },
          }}
          trigger={['click']}
        >
          <Button
            type="text" size="small" icon={<MoreOutlined />}
            loading={refreshing}
            onClick={e => e.stopPropagation()}
          />
        </Dropdown>
      </div>

      {/* Tags */}
      <Space size={4} wrap style={{ marginBottom: 14 }}>
        <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>
        <Tag style={{ fontSize: 11 }}>{account.currency}</Tag>
        {account.status === 'inactive' && <Tag color="default" style={{ fontSize: 11 }}>Inactiva</Tag>}
        {account.glAccountCode && (
          <Tooltip title={`Vinculada a: ${account.glAccountCode} ${account.glAccountName}`}>
            <Tag icon={<LinkOutlined />} color="#6b7280" style={{ fontSize: 11 }}>
              {account.glAccountCode}
            </Tag>
          </Tooltip>
        )}
      </Space>

      {/* Balance */}
      <div style={{
        background: Number(account.currentBalance) < 0 ? '#fdecec' : '#e8f5ef',
        borderRadius: 8, padding: '10px 14px',
      }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Saldo actual</div>
        <div style={{
          fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: Number(account.currentBalance) < 0 ? '#e5484d' : '#1faec2',
        }}>
          {fmtQ(account.currentBalance, account.currency)}
        </div>
        {account.uncategorizedCount && account.uncategorizedCount > 0 ? (
          <div style={{ marginTop: 4 }}>
            <Badge
              count={account.uncategorizedCount}
              style={{ backgroundColor: '#ff7f00', fontSize: 10 }}
            />
            <Text style={{ fontSize: 11, color: '#ff7f00', marginLeft: 6 }}>
              transacciones sin categorizar
            </Text>
          </div>
        ) : null}
      </div>

      {/* GL link info */}
      {account.glAccountName && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280' }}>
          <LinkOutlined style={{ marginRight: 4 }} />
          {account.glAccountCode} · {account.glAccountName}
        </div>
      )}
    </Card>
  )
}

export default function BancosPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [totalBalance, setTotalBalance] = useState(0)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getBankAccounts({ search, status: statusFilter || undefined, type: typeFilter || undefined })
      const arr = Array.isArray(res) ? res : []
      setAccounts(arr)
      setTotalBalance(arr.filter(a => a.status === 'active').reduce((s, a) => s + Number(a.currentBalance), 0))
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BankOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Bancos y Tesorería</Title>
            <Text type="secondary">Gestión de cuentas bancarias vinculadas al plan contable</Text>
          </div>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/bancos/nuevo')}
          style={{ background: '#1faec2' }}
        >
          Nueva cuenta
        </Button>
      </div>

      {/* KPI strip */}
      {!loading && accounts.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Total en cuentas activas</span>}
                value={totalBalance}
                precision={2}
                prefix="Q"
                valueStyle={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', color: totalBalance >= 0 ? '#1faec2' : '#e5484d' }}
                formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Cuentas activas</span>}
                value={accounts.filter(a => a.status === 'active').length}
                valueStyle={{ fontSize: 15, color: '#2ea172' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Sin vincular al catálogo</span>}
                value={accounts.filter(a => !a.glAccountId).length}
                valueStyle={{ fontSize: 15, color: accounts.filter(a => !a.glAccountId).length > 0 ? '#ff7f00' : '#2ea172' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Pendiente categorizar</span>}
                value={accounts.reduce((s, a) => s + (a.uncategorizedCount || 0), 0)}
                valueStyle={{ fontSize: 15, color: '#ff7f00' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filtros */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Input
            placeholder="Buscar cuenta, banco, número..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            style={{ width: 280 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Tipo de cuenta"
            style={{ width: 190 }}
            allowClear
            value={typeFilter || undefined}
            onChange={v => setTypeFilter(v || '')}
          >
            {Object.entries(ACCOUNT_TYPE_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}>
                {v.icon} {v.label}
              </Option>
            ))}
          </Select>
          <Select
            style={{ width: 130 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="all">Todas</Option>
            <Option value="active">Activas</Option>
            <Option value="inactive">Inactivas</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchAccounts} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </Card>

      {/* Grid de cuentas */}
      <Spin spinning={loading}>
        {accounts.length === 0 && !loading ? (
          <Empty
            image={<BankOutlined style={{ fontSize: 56, color: '#9aa1ab' }} />}
            description={
              <div>
                <div style={{ fontWeight: 600, color: '#1faec2', marginBottom: 4 }}>Sin cuentas bancarias</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Crea tu primera cuenta bancaria y vincúlala al catálogo contable
                </div>
              </div>
            }
            style={{ marginTop: 60, marginBottom: 60 }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/bancos/nuevo')}
              style={{ background: '#1faec2' }}>
              Nueva cuenta bancaria
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {accounts.map(a => (
              <Col xs={24} sm={12} xl={8} key={a.id}>
                <BankCard
                  account={a}
                  onEdit={id => navigate(`/bancos/${id}/editar`)}
                  onRefresh={fetchAccounts}
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  )
}
