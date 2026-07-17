import { useEffect, useCallback } from 'react'
import { Result, Button, Spin } from 'antd'
import { BankOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'

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
  const companies     = useCompanyStore(s => s.companies)
  const isLoading     = useCompanyStore(s => s.isLoading)
  const lastLoaded    = useCompanyStore(s => s.lastLoaded)
  const loadCompanies = useCompanyStore(s => s.loadCompanies)

  // Hooks siempre al tope — antes de cualquier return condicional
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Result
          icon={<BankOutlined style={{ color: '#1faec2' }} />}
          title="Sin empresas asignadas"
          subTitle="No tiene empresas asignadas a su usuario. Contacte a su administrador para obtener acceso."
          extra={
            <Button type="primary" style={{ background: '#1faec2' }} onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}
