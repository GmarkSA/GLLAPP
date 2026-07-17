import { Space, Tag, Tooltip, Typography } from 'antd'
import { BankOutlined, BranchesOutlined, GlobalOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useCompanyStore } from '../store/companyStore'
import { useAuthStore } from '../store/authStore'

const { Text } = Typography

const COUNTRY_FLAG: Record<string, string> = {
  GT: 'GT', HN: 'HN', NI: 'NI', SV: 'SV', PA: 'PA', CR: 'CR', MX: 'MX',
}

const CURRENCY_COLOR: Record<string, string> = {
  GTQ: '#1faec2', USD: '#155724', HNL: '#721c24', NIO: '#0f766e', EUR: '#856404',
}

export default function CompanyContextBar() {
  const activeCompany    = useCompanyStore(s => s.activeCompany)
  const activeBranch     = useCompanyStore(s => s.activeBranch)
  const tenantGroupName  = useAuthStore(s => s.tenantGroupName)

  if (!activeCompany) return null

  const flag = COUNTRY_FLAG[activeCompany.countryCode] ?? <GlobalOutlined />
  const currColor = CURRENCY_COLOR[activeCompany.currencyCode] ?? '#1faec2'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 4px',
      borderLeft: '1px solid rgba(10,10,10,0.08)',
      marginLeft: 8,
    }}>
      {/* Grupo empresarial */}
      {tenantGroupName && (
        <Tooltip title="Grupo empresarial">
          <Space size={4} style={{ cursor: 'default' }}>
            <ApartmentOutlined style={{ color: '#6b7280', fontSize: 12 }} />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>{tenantGroupName}</Text>
          </Space>
        </Tooltip>
      )}

      {/* Empresa activa */}
      <Tooltip title="Empresa activa">
        <Space size={4} style={{ cursor: 'default' }}>
          <BankOutlined style={{ color: '#1faec2', fontSize: 13 }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#1faec2' }}>
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
