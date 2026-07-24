import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Progress } from 'antd'
import { RocketOutlined, CloseOutlined } from '@ant-design/icons'
import { useCompanyStore } from '../store/companyStore'
import { companiesApi } from '../api/companies'
import { getAccounts } from '../api/catalogo'
import { getTaxes } from '../api/impuestos'
import { tenantsApi } from '../api/tenants'

const DISMISS_KEY = 'setup_banner_dismissed'

export default function SetupProgressBanner() {
  const navigate      = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [completed, setCompleted] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const TOTAL = 5

  useEffect(() => {
    // No mostrar si el usuario lo cerró en esta sesión
    if (sessionStorage.getItem(DISMISS_KEY)) { setDismissed(true); return }
    if (!activeCompany) return

    Promise.all([
      companiesApi.getOne(activeCompany.id).catch(() => null),
      getAccounts({ limit: 1 }).catch(() => []),
      tenantsApi.getProfile().catch(() => null),
      getTaxes().catch(() => []),
    ]).then(([company, accounts, profile, taxes]) => {
      let done = 1  // paso 1 (empresa) siempre completo
      if (company?.legalName && company?.taxId) done++
      if (Array.isArray(accounts) ? accounts.length > 0 : !!(accounts as any)) done++
      if (profile?.settings?.accountDefaults &&
          Object.values(profile.settings.accountDefaults).some(Boolean)) done++
      if (Array.isArray(taxes) && taxes.length > 0) done++
      setCompleted(done)
    })
  }, [activeCompany])

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  // No mostrar si: cargando, cerrado o todo completo
  if (dismissed || completed === null || completed >= TOTAL) return null

  const pending = TOTAL - completed

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fafe 0%, #e8f7fa 100%)',
      border: '1.5px solid #b2e6f0',
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Ícono */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #1faec2, #0e8fa0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <RocketOutlined style={{ color: '#fff', fontSize: 18 }} />
      </div>

      {/* Texto + barra */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0a0a0a', marginBottom: 2 }}>
          Configura tu empresa — {pending} {pending === 1 ? 'paso pendiente' : 'pasos pendientes'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress
            percent={Math.round((completed / TOTAL) * 100)}
            strokeColor="#1faec2"
            trailColor="rgba(10,10,10,0.10)"
            showInfo={false}
            strokeWidth={6}
            style={{ flex: 1, margin: 0 }}
          />
          <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
            {completed} de {TOTAL}
          </span>
        </div>
      </div>

      {/* Botón acción */}
      <Button
        type="primary"
        size="small"
        style={{ background: '#1faec2', borderColor: '#1faec2', flexShrink: 0 }}
        onClick={() => navigate('/onboarding/setup')}
      >
        Continuar configuración →
      </Button>

      {/* Cerrar sesión */}
      <Button
        type="text"
        size="small"
        icon={<CloseOutlined style={{ fontSize: 11 }} />}
        style={{ color: '#9aa1ab', flexShrink: 0, padding: '0 4px' }}
        onClick={handleDismiss}
        title="Ocultar hasta el próximo inicio de sesión"
      />
    </div>
  )
}
