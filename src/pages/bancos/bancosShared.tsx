import {
  BankOutlined,
  CreditCardOutlined,
  DollarOutlined,
  LineChartOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import type { BankAccountType } from '../../api/bancos'

export const NAVY = '#1faec2'

export const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
} as const

export const wideFormGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 12,
} as const

export const pageHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 16,
} as const

export const panelStyle = {
  borderRadius: 8,
  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
} as const

export const moneyFmt = (n: number, currency = 'GTQ') =>
  `${currency === 'GTQ' ? 'Q' : currency} ${Number(n || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export const accountTypeIcon = (type: BankAccountType, color = NAVY) => {
  if (type === 'credit_card') return <CreditCardOutlined style={{ color }} />
  if (type === 'petty_cash') return <WalletOutlined style={{ color }} />
  if (type === 'investment') return <LineChartOutlined style={{ color }} />
  if (type === 'savings') return <DollarOutlined style={{ color }} />
  return <BankOutlined style={{ color }} />
}
