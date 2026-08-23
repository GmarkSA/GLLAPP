import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
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
  Drawer,
  InputNumber,
  Divider,
  Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApartmentOutlined,
  BankOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  SwapOutlined,
  FilterOutlined,
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

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface CbAdFilters {
  filterBankName?: string
  filterCurrency?: string[]
  filterBalanceMin?: number | null
  filterBalanceMax?: number | null
}

const CB_EMPTY: CbAdFilters = {}

function applyCbFilters(data: BankAccount[], f: CbAdFilters): BankAccount[] {
  return data.filter(r => {
    if (f.filterBankName && !r.bankName?.toLowerCase().includes(f.filterBankName.toLowerCase())) return false
    if (f.filterCurrency?.length && !f.filterCurrency.includes(r.currency ?? '')) return false
    if (f.filterBalanceMin != null && Number(r.currentBalance ?? 0) < f.filterBalanceMin) return false
    if (f.filterBalanceMax != null && Number(r.currentBalance ?? 0) > f.filterBalanceMax) return false
    return true
  })
}

export default function CuentasBancariasPage() {
  const navigate = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<BankAccountType | undefined>()
  const [status, setStatus] = useState<string>('active')

  // Filtros avanzados
  const [cbFilters,    setCbFilters]    = useState<CbAdFilters>(CB_EMPTY)
  const [cbDraft,      setCbDraft]      = useState<CbAdFilters>(CB_EMPTY)
  const [cbFilterOpen, setCbFilterOpen] = useState(false)

  const cbActiveCount = useMemo(() =>
    Object.entries(cbFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [cbFilters])

  const filteredAccounts = useMemo(() => applyCbFilters(accounts, cbFilters), [accounts, cbFilters])

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

  const openCbFilters = () => { setCbDraft(cbFilters); setCbFilterOpen(true) }
  const applyCbFiltersHandler = () => { setCbFilters(cbDraft); setCbFilterOpen(false) }
  const clearCbFilters = () => { setCbDraft(CB_EMPTY); setCbFilters(CB_EMPTY) }

  const columns: ColumnsType<BankAccount> = [
    {
      title: 'Cuenta',
      dataIndex: 'name',
      width: 300,
      fixed: 'left',
      sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
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
      sorter: (a, b) => (a.type ?? '').localeCompare(b.type ?? ''),
      render: (v: BankAccountType) => {
        const cfg = ACCOUNT_TYPE_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Moneda',
      dataIndex: 'currency',
      width: 90,
      sorter: (a, b) => (a.currency ?? '').localeCompare(b.currency ?? ''),
      render: v => <Tag>{v}</Tag>,
    },
    {
      title: 'Saldo sistema',
      dataIndex: 'currentBalance',
      width: 160,
      align: 'right',
      sorter: (a, b) => Number(a.currentBalance ?? 0) - Number(b.currentBalance ?? 0),
      render: (v, row) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: Number(v) < 0 ? '#e5484d' : NAVY }}>{moneyFmt(Number(v), row.currency)}</Text>,
    },
    {
      title: 'Saldo banco',
      dataIndex: 'bankBalance',
      width: 160,
      align: 'right',
      render: (v, row) => v == null ? <Text type="secondary">Pendiente</Text> : <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{moneyFmt(Number(v), row.currency)}</Text>,
    },
    {
      title: 'Diferencia',
      key: 'difference',
      width: 140,
      align: 'right',
      render: (_, row) => {
        if (row.bankBalance == null) return <Text type="secondary">-</Text>
        const diff = Number(row.bankBalance) - Number(row.currentBalance)
        return <Text style={{ fontVariantNumeric: 'tabular-nums', color: Math.abs(diff) > 0.01 ? '#e5484d' : '#2ea172' }}>{moneyFmt(diff, row.currency)}</Text>
      },
    },
    {
      title: 'Cuenta contable',
      dataIndex: 'glAccountCode',
      width: 130,
      render: (_, row) => row.glAccountCode
        ? <Tooltip title={row.glAccountName}><Tag color="#6b7280">{row.glAccountCode}</Tag></Tooltip>
        : <Tag color="#ff7f00">Sin vincular</Tag>,
    },
    {
      title: 'Pendientes',
      dataIndex: 'uncategorizedCount',
      width: 110,
      align: 'center',
      render: v => <Tag color={Number(v || 0) > 0 ? '#ff7f00' : '#2ea172'}>{Number(v || 0)}</Tag>,
    },
    {
      title: 'Ultimo estado',
      dataIndex: 'lastStatementDate',
      width: 130,
      render: v => {
        if (!v) return <Text type="secondary">Sin importar</Text>
        const d = dayjs(v)
        if (!d.isValid() || d.year() < 2000 || d.year() > 2100) return <Text type="secondary">Sin importar</Text>
        return d.format('DD/MM/YYYY')
      },
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 80,
      render: v => <Tag color={v === 'active' ? '#2ea172' : 'default'}>{v === 'active' ? 'Activa' : 'Inactiva'}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <Space size={2}>
          <Tooltip title="Ver movimientos">
            <Button size="small" type="text" icon={<FileSearchOutlined />} onClick={() => navigate(`/bancos/${row.id}`)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => navigate(`/bancos/${row.id}/editar`)} />
          </Tooltip>
          <Tooltip title="Conciliación">
            <Button size="small" type="text" icon={<CheckCircleOutlined />} onClick={() => navigate(`/bancos/${row.id}/conciliacion`)} />
          </Tooltip>
          <Tooltip title="Actualizar saldo">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => handleRefreshBalance(row)} />
          </Tooltip>
          <Tooltip title={row.status === 'active' ? 'Desactivar' : 'Activar'}>
            <Button
              size="small" type="text"
              icon={row.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
              danger={row.status === 'active'}
              onClick={() => handleToggleStatus(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BankOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Bancos y Tesorería</Title>
            <Text type="secondary">
              Cuentas bancarias, tarjetas y saldos por empresa
              {activeCompany ? ` - ${activeCompany.tradeName || activeCompany.legalName}` : ''}
            </Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<SwapOutlined />} onClick={() => navigate('/bancos/transferencias/nueva')}>Agregar transacción</Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }} onClick={() => navigate('/bancos/nuevo')}>
            <span data-tour="bancos-cuenta-nueva">Nueva cuenta</span>
          </Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card size="small" style={panelStyle}><Statistic title="Saldo activo" value={totals.balance} formatter={v => moneyFmt(Number(v))} valueStyle={{ color: NAVY, fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Cuentas activas" value={totals.active} prefix={<BankOutlined />} valueStyle={{ color: '#2ea172', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Tarjetas" value={totals.cards} prefix={<ApartmentOutlined />} valueStyle={{ color: '#e5484d', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Sin categorizar" value={totals.pending} prefix={<BranchesOutlined />} valueStyle={{ color: totals.pending ? '#ff7f00' : '#2ea172', fontSize: 18 }} /></Card>
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
          <Badge count={cbActiveCount} size="small">
            <Button
              size="small"
              icon={<FilterOutlined />}
              onClick={openCbFilters}
              style={cbActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
            >
              Filtros
            </Button>
          </Badge>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
        </Space>
      </Card>

      <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankAccount>
          columns={columns}
          dataSource={filteredAccounts}
          rowKey="id"
          size="small"
          loading={loading}
          showSorterTooltip={false}
          scroll={{ x: 'max-content', y: 'calc(100vh - 352px)' }}
          pagination={{ pageSize: 50, showTotal: t => `${t} registros` }}
          locale={{ emptyText: <Empty description="Sin cuentas bancarias" /> }}
        />
      </Card>

      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={340}
        open={cbFilterOpen}
        onClose={() => setCbFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearCbFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyCbFiltersHandler}>Aplicar</Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Banco</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="Nombre del banco" size="small" value={cbDraft.filterBankName ?? ''} onChange={e => setCbDraft(d => ({ ...d, filterBankName: e.target.value || undefined }))} allowClear />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Moneda</Text>
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <Select
            mode="multiple" size="small" placeholder="Moneda"
            value={cbDraft.filterCurrency ?? []}
            onChange={v => setCbDraft(d => ({ ...d, filterCurrency: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]}
          />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Saldo sistema</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={cbDraft.filterBalanceMin ?? null} onChange={v => setCbDraft(d => ({ ...d, filterBalanceMin: v ?? null }))} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={cbDraft.filterBalanceMax ?? null} onChange={v => setCbDraft(d => ({ ...d, filterBalanceMax: v ?? null }))} prefix="Q" />
        </div>
      </Drawer>
    </div>
  )
}
