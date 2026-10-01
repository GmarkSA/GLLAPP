import { useEffect, useState } from 'react'
import { Dropdown, Empty, Input, Spin, Tag, Tooltip } from 'antd'
import { ApartmentOutlined, CheckOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons'
import { getMisOrganizaciones, type Organizacion } from '../api/tenants'
import { useAuthStore, recordarOrganizacion } from '../store/authStore'

/**
 * Selector de ORGANIZACIÓN (cliente), hermano del de empresa.
 *
 * Un mismo correo puede tener acceso a varios clientes —un contador externo, por
 * ejemplo— y cada cliente es una base aparte. Solo aparece cuando hay más de una:
 * quien tiene una sola no ve nada nuevo.
 *
 * Al cambiar se recarga la aplicación entera a propósito: empresas, permisos,
 * módulos habilitados y perfil pertenecen al cliente anterior.
 */
export default function OrganizationSelector() {
  const tenantId  = useAuthStore(s => s.tenantId)
  const user      = useAuthStore(s => s.user)
  const setTenant = useAuthStore(s => s.setTenant)

  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto]   = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    getMisOrganizaciones()
      .then(setOrganizaciones)
      .catch(() => setOrganizaciones([]))
      .finally(() => setCargando(false))
  }, [])

  // Con una sola organización no hay nada que elegir
  if (cargando || organizaciones.length < 2) return null

  const actual = organizaciones.find(o => o.id === tenantId)
  const filtradas = organizaciones.filter(o =>
    !busqueda
    || o.name?.toLowerCase().includes(busqueda.toLowerCase())
    || o.legalName?.toLowerCase().includes(busqueda.toLowerCase())
    || o.taxId?.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const cambiar = (org: Organizacion) => {
    if (org.id === tenantId) { setAbierto(false); return }
    setTenant(org.id)
    recordarOrganizacion(user?.id, org.id)
    // La empresa activa es de la organización anterior: se suelta antes de recargar
    sessionStorage.removeItem('activeCompanyId')
    sessionStorage.removeItem('tenantGroupName')
    window.location.assign('/dashboard')
  }

  const overlay = (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.15)', width: 320, overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar organización..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          size="small"
          allowClear
        />
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {filtradas.length === 0 && (
          <Empty description="Sin resultados" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 16 }} />
        )}
        {filtradas.map(o => (
          <div
            key={o.id}
            onClick={() => cambiar(o)}
            style={{
              padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              background: o.id === tenantId ? '#e6f4ff' : 'transparent', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (o.id !== tenantId) e.currentTarget.style.background = '#fafbfc' }}
            onMouseLeave={e => { e.currentTarget.style.background = o.id === tenantId ? '#e6f4ff' : 'transparent' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: o.id === tenantId ? 600 : 400, fontSize: 13, lineHeight: 1.3 }}>
                {o.name}
              </div>
              {o.legalName && o.legalName !== o.name && (
                <div style={{ fontSize: 11, color: '#6b7280' }}>{o.legalName}</div>
              )}
              <div style={{ marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                {o.plan && <Tag style={{ fontSize: 10, padding: '0 5px', margin: 0 }}>{o.plan}</Tag>}
                {o.taxId && <span style={{ fontSize: 10, color: '#aaa' }}>NIT: {o.taxId}</span>}
              </div>
            </div>
            {o.id === tenantId && <CheckOutlined style={{ color: '#1faec2', fontSize: 13 }} />}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(10,10,10,0.08)', padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>
        Al cambiar de organización se recarga Lucía: cada una tiene sus propias empresas y datos.
      </div>
    </div>
  )

  return (
    <Dropdown open={abierto} onOpenChange={setAbierto} dropdownRender={() => overlay} trigger={['click']} placement="bottomLeft">
      <Tooltip title="Organización (cliente). Tenés acceso a varias.">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          padding: '0 10px', height: 28, borderRadius: 20,
          background: abierto ? 'rgba(27,58,107,0.12)' : 'rgba(27,58,107,0.06)',
          border: '1px solid rgba(27,58,107,0.18)', transition: 'background 0.2s', maxWidth: 220,
        }}>
          <ApartmentOutlined style={{ fontSize: 12, color: '#1B3A6B' }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#1B3A6B',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {actual?.name ?? 'Organización'}
          </span>
          <DownOutlined style={{ fontSize: 9, color: '#1B3A6B' }} />
        </div>
      </Tooltip>
    </Dropdown>
  )
}
