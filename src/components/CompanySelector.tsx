import { useState, useEffect } from 'react'
import { Dropdown, Space, Typography, Spin, message } from 'antd'
import { BankOutlined, DownOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { companiesApi } from '../api/companies'
import type { Company } from '../store/authStore'

const { Text } = Typography

export default function CompanySelector() {
  const navigate         = useNavigate()
  const activeCompany    = useAuthStore(s => s.activeCompany)
  const activeCompanyId  = useAuthStore(s => s.activeCompanyId)
  const setActiveCompany = useAuthStore(s => s.setActiveCompany)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    setLoading(true)
    companiesApi.getAll()
      .then(data => {
        setCompanies(data)
        // Si no hay empresa activa, seleccionar la default automáticamente
        if (!activeCompanyId && data.length > 0) {
          const def = data.find(c => c.isDefault) ?? data[0]
          setActiveCompany(def)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (company: Company) => {
    setActiveCompany(company)
    message.success(`Empresa: ${company.legalName}`)
  }

  const items = [
    ...companies.map(c => ({
      key: c.id,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <BankOutlined />
            <span>{c.legalName}</span>
            <Text type="secondary" style={{ fontSize: 11 }}>{c.countryCode} · {c.currencyCode}</Text>
          </Space>
          {c.id === activeCompanyId && <CheckOutlined style={{ color: '#1677ff' }} />}
        </Space>
      ),
      onClick: () => handleSelect(c),
    })),
    { type: 'divider' as const },
    {
      key: 'nueva',
      label: (
        <Space>
          <PlusOutlined />
          <span>Nueva Empresa</span>
        </Space>
      ),
      onClick: () => navigate('/configuracion/empresas/nueva'),
    },
    {
      key: 'gestionar',
      label: 'Gestionar empresas',
      onClick: () => navigate('/configuracion/empresas'),
    },
  ]

  if (loading) return <Spin size="small" style={{ margin: '8px 16px' }} />

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomLeft">
      <div style={{
        margin: '4px 8px 8px',
        padding: '6px 10px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.08)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'white',
        fontSize: 13,
        transition: 'background 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      >
        <BankOutlined style={{ fontSize: 14 }} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeCompany?.legalName ?? 'Seleccionar empresa'}
          </div>
          {activeCompany && (
            <div style={{ fontSize: 10, opacity: 0.7 }}>
              {activeCompany.countryCode} · {activeCompany.currencyCode}
            </div>
          )}
        </div>
        <DownOutlined style={{ fontSize: 10, opacity: 0.7 }} />
      </div>
    </Dropdown>
  )
}
