import { useState, useEffect, useRef } from 'react'
import { Dropdown, Input, Space, Tag, Spin, Empty, Tooltip } from 'antd'
import {
  BankOutlined, DownOutlined, CheckOutlined, PlusOutlined,
  SearchOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'
import type { Company } from '../store/authStore'

const COUNTRY_FLAG: Record<string, string> = {
  GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', PA: '🇵🇦', CR: '🇨🇷', MX: '🇲🇽',
}

const STATUS_COLOR: Record<string, string> = {
  active: '#52c41a', suspended: '#faad14', liquidated: '#ff4d4f',
}

export default function CompanySelector() {
  const navigate         = useNavigate()
  const activeCompany    = useCompanyStore(s => s.activeCompany)
  const companies        = useCompanyStore(s => s.companies)
  const isLoading        = useCompanyStore(s => s.isLoading)
  const setActiveCompany = useCompanyStore(s => s.setActiveCompany)
  const loadCompanies    = useCompanyStore(s => s.loadCompanies)

  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const searchRef = useRef<any>(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 100)
  }, [open])

  const filtered = companies.filter(c =>
    !search || c.legalName.toLowerCase().includes(search.toLowerCase()) ||
    c.tradeName?.toLowerCase().includes(search.toLowerCase()) ||
    c.taxId?.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelect = async (company: Company) => {
    await setActiveCompany(company)
    setOpen(false)
    setSearch('')
    // Recargar la página actual para que todos los datos se refresquen
    window.location.reload()
  }

  const overlay = (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
      width: 320,
      overflow: 'hidden',
    }}>
      {/* Header búsqueda */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          ref={searchRef}
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          allowClear
        />
      </div>

      {/* Lista de empresas */}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <Empty description="Sin resultados" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 16 }} />
        )}
        {!isLoading && filtered.map(c => (
          <div
            key={c.id}
            onClick={() => handleSelect(c)}
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: c.id === activeCompany?.id ? '#e6f4ff' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (c.id !== activeCompany?.id) e.currentTarget.style.background = '#fafafa' }}
            onMouseLeave={e => { e.currentTarget.style.background = c.id === activeCompany?.id ? '#e6f4ff' : 'transparent' }}
          >
            {/* Icono estado */}
            <Tooltip title={c.status === 'active' ? 'Activa' : 'Inactiva'}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: STATUS_COLOR[c.status] ?? '#d9d9d9',
                flexShrink: 0,
              }} />
            </Tooltip>

            {/* Info empresa */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: c.id === activeCompany?.id ? 600 : 400, fontSize: 13, lineHeight: 1.3 }}>
                {COUNTRY_FLAG[c.countryCode] ?? '🏢'} {c.legalName}
              </div>
              {c.tradeName && c.tradeName !== c.legalName && (
                <div style={{ fontSize: 11, color: '#888' }}>{c.tradeName}</div>
              )}
              <Space size={4} style={{ marginTop: 2 }}>
                <Tag style={{ fontSize: 10, padding: '0 5px', margin: 0 }}>{c.countryCode}</Tag>
                <Tag color="blue" style={{ fontSize: 10, padding: '0 5px', margin: 0 }}>{c.currencyCode}</Tag>
                {c.taxId && <span style={{ fontSize: 10, color: '#aaa' }}>NIT: {c.taxId}</span>}
              </Space>
            </div>

            {/* Check activa */}
            {c.id === activeCompany?.id && (
              <CheckOutlined style={{ color: '#1677ff', fontSize: 13 }} />
            )}
          </div>
        ))}
      </div>

      {/* Footer acciones */}
      <div style={{ borderTop: '1px solid #f0f0f0', padding: '6px 8px', display: 'flex', gap: 4 }}>
        <div
          onClick={() => { setOpen(false); loadCompanies() }}
          style={{ flex: 1, padding: '5px 8px', cursor: 'pointer', borderRadius: 4, color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ReloadOutlined /> Recargar
        </div>
        <div
          onClick={() => { setOpen(false); navigate('/configuracion/empresas/nueva') }}
          style={{ flex: 1, padding: '5px 8px', cursor: 'pointer', borderRadius: 4, color: '#1677ff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <PlusOutlined /> Nueva empresa
        </div>
        <div
          onClick={() => { setOpen(false); navigate('/configuracion/empresas') }}
          style={{ flex: 1, padding: '5px 8px', cursor: 'pointer', borderRadius: 4, color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <BankOutlined /> Gestionar
        </div>
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => overlay}
      trigger={['click']}
      placement="bottomLeft"
    >
      <div style={{
        margin: '4px 8px 8px',
        padding: '8px 10px',
        borderRadius: 6,
        background: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'white',
        transition: 'background 0.2s',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
        onMouseEnter={e => !open && (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
        onMouseLeave={e => !open && (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      >
        <BankOutlined style={{ fontSize: 15, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeCompany
              ? `${COUNTRY_FLAG[activeCompany.countryCode] ?? ''} ${activeCompany.legalName}`
              : 'Seleccionar empresa'}
          </div>
          {activeCompany && (
            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>
              {activeCompany.countryCode} · {activeCompany.currencyCode}
              {companies.length > 1 && ` · ${companies.length} empresas`}
            </div>
          )}
        </div>
        <DownOutlined style={{ fontSize: 9, opacity: 0.7, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
    </Dropdown>
  )
}
