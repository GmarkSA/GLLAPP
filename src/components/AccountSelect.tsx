import { useEffect, useState } from 'react'
import { Select, Tag, Space } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { getAccounts, type Account } from '../api/catalogo'

export interface AccountFilter {
  groupCode?:             string
  balanceType?:           string
  isCustomerAccount?:     boolean
  isVendorAccount?:       boolean
  bankLinking?:           boolean
  isFixedAsset?:          boolean
  requiresReconciliation?: boolean
  isInventoryAccount?:    boolean
}

interface AccountSelectProps {
  filter?:            AccountFilter
  placeholder?:       string
  value?:             string
  onChange?:          (value: string | undefined) => void
  onChangeAccount?:   (account: Account | undefined) => void
  disabled?:          boolean
  size?:              'small' | 'middle' | 'large'
}

const BALANCE_COLOR: Record<string, string> = {
  'Activo':          'blue',
  'Activo Fijo':     'geekblue',
  'Pasivo':          'red',
  'Capital':         'purple',
  'Ingresos':        'green',
  'Costos':          'orange',
  'Gastos':          'volcano',
  'Otros Ingresos':  'cyan',
  'Otros Gastos':    'magenta',
  'Cuentas de Orden':'default',
}

export default function AccountSelect({
  filter, placeholder = 'Selecciona una cuenta...', value, onChange, onChangeAccount, disabled, size,
}: AccountSelectProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    setLoading(true)
    // Build query params — only include defined boolean flags
    const params: Record<string, string> = {}
    if (filter?.groupCode)                              params.groupCode = filter.groupCode
    if (filter?.balanceType)                            params.balanceType = filter.balanceType
    if (filter?.isCustomerAccount     !== undefined)    params.isCustomerAccount = String(filter.isCustomerAccount)
    if (filter?.isVendorAccount       !== undefined)    params.isVendorAccount = String(filter.isVendorAccount)
    if (filter?.bankLinking           !== undefined)    params.bankLinking = String(filter.bankLinking)
    if (filter?.isFixedAsset          !== undefined)    params.isFixedAsset = String(filter.isFixedAsset)
    if (filter?.requiresReconciliation !== undefined)   params.requiresReconciliation = String(filter.requiresReconciliation)
    if (filter?.isInventoryAccount     !== undefined)   params.isInventoryAccount = String(filter.isInventoryAccount)

    getAccounts(params)
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Select
      showSearch
      allowClear
      loading={loading}
      disabled={disabled}
      size={size}
      value={value}
      onChange={(id, opt) => {
        onChange?.(id)
        if (onChangeAccount) {
          const acc = id ? (opt as any)?.account as Account : undefined
          onChangeAccount(acc)
        }
      }}
      placeholder={
        <Space>
          <BookOutlined style={{ color: '#bbb' }} />
          {placeholder}
        </Space>
      }
      optionFilterProp="label"
      style={{ width: '100%' }}
      notFoundContent={loading ? 'Cargando...' : 'Sin cuentas disponibles — crea una en Contabilidad → Catálogo'}
      options={accounts.map(a => ({
        value: a.id,
        label: `${a.code} ${a.name}`,   // used for search
        account: a,
      }))}
      optionRender={opt => {
        const a = (opt.data as any).account as Account
        return (
          <Space size={6}>
            <Tag
              color={BALANCE_COLOR[a.balanceType ?? ''] ?? 'default'}
              style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, minWidth: 52, textAlign: 'center' }}
            >
              {a.code}
            </Tag>
            <span style={{ fontSize: 13 }}>{a.name}</span>
          </Space>
        )
      }}
      labelRender={opt => {
        const acct = accounts.find(a => a.id === opt.value)
        if (!acct) return <span>{opt.label}</span>
        return (
          <Space size={6}>
            <BookOutlined style={{ color: '#1faec2', fontSize: 12 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{acct.code}</span>
            <span style={{ fontSize: 13 }}>{acct.name}</span>
          </Space>
        )
      }}
    />
  )
}
