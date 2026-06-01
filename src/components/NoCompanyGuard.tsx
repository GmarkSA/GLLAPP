import { useEffect, useCallback } from 'react'
import { Result, Button, Spin } from 'antd'
import { BankOutlined } from '@ant-design/icons'
import { useCompanyStore } from '../store/companyStore'

interface Props {
  children: React.ReactNode
}

export default function NoCompanyGuard({ children }: Props) {
  const companies     = useCompanyStore(s => s.companies)
  const isLoading     = useCompanyStore(s => s.isLoading)
  const loadCompanies = useCompanyStore(s => s.loadCompanies)

  const init = useCallback(() => { loadCompanies() }, [loadCompanies])

  useEffect(() => { init() }, [init])

  if (isLoading && companies.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Cargando empresa..." />
      </div>
    )
  }

  if (!isLoading && companies.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Result
          icon={<BankOutlined style={{ color: '#1B3A6B' }} />}
          title="Sin empresas asignadas"
          subTitle="No tiene empresas asignadas a su usuario. Contacte a su administrador para obtener acceso."
          extra={
            <Button type="primary" style={{ background: '#1B3A6B' }} onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}
