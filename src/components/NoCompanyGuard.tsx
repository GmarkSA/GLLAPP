import { useEffect, useCallback } from 'react'
import { Result, Button, Space, Spin } from 'antd'
import { BankOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'
import { useAuthStore } from '../store/authStore'

// Rutas accesibles aunque el usuario no tenga empresas — permiten crear la primera
const BYPASS_PATHS = [
  '/configuracion/empresas',
  '/onboarding',
  '/admin/platform',
]

interface Props {
  children: React.ReactNode
}

export default function NoCompanyGuard({ children }: Props) {
  const location      = useLocation()
  const navigate      = useNavigate()
  const companies     = useCompanyStore(s => s.companies)
  const isLoading     = useCompanyStore(s => s.isLoading)
  const lastLoaded    = useCompanyStore(s => s.lastLoaded)
  const loadCompanies = useCompanyStore(s => s.loadCompanies)
  const user          = useAuthStore(s => s.user)

  const init = useCallback(() => { loadCompanies() }, [loadCompanies])
  useEffect(() => { init() }, [init])

  // Rutas de gestión de empresas pasan siempre
  if (BYPASS_PATHS.some(p => location.pathname.startsWith(p))) {
    return <>{children}</>
  }

  if (isLoading || lastLoaded === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" style={{ display: 'block', margin: '0 auto' }} />
      </div>
    )
  }

  if (!isLoading && lastLoaded !== null && companies.length === 0) {
    // Determinar si el usuario puede crear empresas (admin o superadmin)
    const userRoles = (user?.roles ?? []).map((r: any) =>
      (typeof r === 'string' ? r : (r?.name ?? '')).toLowerCase()
    )
    const canCreate = user?.isSuperAdmin || userRoles.includes('admin')

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Result
          icon={<BankOutlined style={{ color: '#1faec2' }} />}
          title={canCreate ? 'Configura tu primera empresa' : 'Sin empresas asignadas'}
          subTitle={
            canCreate
              ? 'Completa el proceso de configuración para comenzar a operar.'
              : 'No tienes empresas asignadas. Contacta a tu administrador para obtener acceso.'
          }
          extra={
            canCreate ? (
              <Space>
                <Button
                  type="primary"
                  size="large"
                  style={{ background: '#1faec2' }}
                  onClick={() => navigate('/onboarding')}
                >
                  Configurar empresa
                </Button>
              </Space>
            ) : (
              <Button type="primary" style={{ background: '#1faec2' }} onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            )
          }
        />
      </div>
    )
  }

  return <>{children}</>
}
