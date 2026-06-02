import { Space, Tag, Tooltip, Typography } from 'antd'
import { BankOutlined, BranchesOutlined, GlobalOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useCompanyStore } from '../store/companyStore'
import { useAuthStore } from '../store/authStore'

const { Text } = Typography

const COUNTRY_FLAG: Record<string, string> = {
  GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', PA: '🇵🇦', CR: '🇨🇷', MX: '🇲🇽',
}

const CURRENCY_COLOR: Record<string, string> = {
  GTQ: '#1B3A6B', USD: '#155724', HNL: '#721c24', EUR: '#856404',
}

export default function CompanyContextBar() {
  const activeCompany    = useCompanyStore(s => s.activeCompany)
  const activeBranch     = useCompanyStore(s => s.activeBranch)
  const tenantGroupName  = useAuthStore(s => s.tenantGroupName)

  if (!activeCompany) return null

  const flag = COUNTRY_FLAG[activeCompany.countryCode] ?? <GlobalOutlined />
  const currColor = CURRENCY_COLOR[activeCompany.currencyCode] ?? '#1B3A6B'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 4px',
      borderLeft: '1px solid #f0f0f0',
      marginLeft: 8,
    }}>
      {/* Grupo empresarial */}
      {tenantGroupName && (
        <Tooltip title="Grupo empresarial">
          <Space size={4} style={{ cursor: 'default' }}>
            <ApartmentOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{tenantGroupName}</Text>
          </Space>
        </Tooltip>
      )}

      {/* Empresa activa */}
      <Tooltip title="Empresa activa">
        <Space size={4} style={{ cursor: 'default' }}>
          <BankOutlined style={{ color: '#1B3A6B', fontSize: 13 }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#1B3A6B' }}>
            {flag} {activeCompany.legalName}
          </Text>
        </Space>
      </Tooltip>

      {/* Badges */}
      <Tag
        style={{
          fontSize: 11, padding: '0 7px', fontWeight: 600,
          background: currColor, color: '#fff', border: 'none',
          borderRadius: 4,
        }}
      >
        {activeCompany.currencyCode}
      </Tag>

      <Tag style={{ fontSize: 11, padding: '0 7px', margin: 0 }}>
        {activeCompany.countryCode}
      </Tag>

      {/* Sucursal activa */}
      {activeBranch && (
        <Tooltip title="Sucursal activa">
          <Space size={4} style={{ cursor: 'default', color: '#666' }}>
            <BranchesOutlined style={{ fontSize: 12 }} />
            <Text style={{ fontSize: 11, color: '#666' }}>{activeBranch.name}</Text>
          </Space>
        </Tooltip>
      )}
    </div>
  )
}
