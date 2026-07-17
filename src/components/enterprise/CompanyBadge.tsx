import { Tag, Tooltip } from 'antd'
import { BankOutlined } from '@ant-design/icons'
import { useCompanyStore } from '../../store/companyStore'

const COUNTRY_FLAG: Record<string, string> = {
  GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', PA: '🇵🇦', CR: '🇨🇷', MX: '🇲🇽',
}

export function CompanyBadge() {
  const c = useCompanyStore(s => s.activeCompany)
  if (!c) return null
  return (
    <Tooltip title={`Empresa activa: ${c.legalName}`}>
      <Tag icon={<BankOutlined />} color="#1faec2" style={{ fontSize: 11 }}>
        {COUNTRY_FLAG[c.countryCode] ?? ''} {c.legalName}
      </Tag>
    </Tooltip>
  )
}

export function CurrencyBadge() {
  const c = useCompanyStore(s => s.activeCompany)
  if (!c) return null
  return (
    <Tag color="#1faec2" style={{ fontSize: 11, fontWeight: 700 }}>{c.currencyCode}</Tag>
  )
}

export function CountryBadge() {
  const c = useCompanyStore(s => s.activeCompany)
  if (!c) return null
  const flag = COUNTRY_FLAG[c.countryCode]
  return (
    <Tag style={{ fontSize: 11 }}>{flag ?? ''} {c.countryCode}</Tag>
  )
}
