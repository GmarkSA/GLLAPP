import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Progress, Spin, Tag, Typography } from 'antd'
import {
  CheckCircleFilled,
  BankOutlined,
  FileTextOutlined,
  BookOutlined,
  SettingOutlined,
  PercentageOutlined,
} from '@ant-design/icons'
import { useCompanyStore } from '../../store/companyStore'
import { companiesApi } from '../../api/companies'
import { getAccounts } from '../../api/catalogo'
import { getTaxes } from '../../api/impuestos'
import { tenantsApi } from '../../api/tenants'

const { Title, Text } = Typography

interface Step {
  id: string
  num: number
  icon: React.ReactNode
  title: string
  desc: string
  route: string
  done: boolean
}

export default function SetupGuidePage() {
  const navigate      = useNavigate()
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [loading, setLoading] = useState(true)
  const [steps, setSteps]     = useState<Step[]>([])

  useEffect(() => {
    if (!activeCompany) return

    const checks = Promise.all([
      // Paso 2: perfil — legalName + taxId completos
      companiesApi.getOne(activeCompany.id).catch(() => null),
      // Paso 3: catálogo — al menos 1 cuenta
      getAccounts({ limit: 1 }).catch(() => []),
      // Paso 4: cuentas por defecto
      tenantsApi.getProfile().catch(() => null),
      // Paso 5: impuestos
      getTaxes().catch(() => []),
    ])

    checks.then(([company, accounts, profile, taxes]) => {
      const perfilOk   = !!(company?.legalName && company?.taxId)
      const catalogoOk = Array.isArray(accounts) ? accounts.length > 0 : !!(accounts as any)
      const defaultsOk = !!(profile?.settings?.accountDefaults &&
        Object.values(profile.settings.accountDefaults).some(Boolean))
      const impuestosOk = Array.isArray(taxes) && taxes.length > 0

      setSteps([
        {
          id: 'empresa',
          num: 1,
          icon: <BankOutlined style={{ fontSize: 22 }} />,
          title: 'Empresa creada',
          desc: 'Tu empresa fue registrada exitosamente en el sistema.',
          route: '',
          done: true,
        },
        {
          id: 'perfil',
          num: 2,
          icon: <FileTextOutlined style={{ fontSize: 22 }} />,
          title: 'Perfil de organización',
          desc: 'Completa el nombre legal, NIT y régimen fiscal de tu empresa.',
          route: `/configuracion/empresas/${activeCompany.id}`,
          done: perfilOk,
        },
        {
          id: 'catalogo',
          num: 3,
          icon: <BookOutlined style={{ fontSize: 22 }} />,
          title: 'Catálogo de cuentas',
          desc: 'Carga la nomenclatura contable base. Para Guatemala ya está precargada.',
          route: '/contabilidad/catalogo',
          done: catalogoOk,
        },
        {
          id: 'contabilidad',
          num: 4,
          icon: <SettingOutlined style={{ fontSize: 22 }} />,
          title: 'Cuentas por defecto',
          desc: 'Vincula las cuentas contables del sistema (ventas, IVA, caja, bancos).',
          route: '/configuracion?tab=contabilidad',
          done: defaultsOk,
        },
        {
          id: 'impuestos',
          num: 5,
          icon: <PercentageOutlined style={{ fontSize: 22 }} />,
          title: 'Plantilla de impuestos',
          desc: 'Carga la plantilla fiscal de tu país (IVA, ISR, retenciones).',
          route: '/configuracion?tab=taxes',
          done: impuestosOk,
        },
      ])
    }).finally(() => setLoading(false))
  }, [activeCompany])

  const completedCount = steps.filter(s => s.done).length
  const totalCount     = steps.length
  const nextPending    = steps.find(s => !s.done)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>
          Configura tu empresa
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Completa estos pasos antes de empezar a operar. Puedes volver aquí en cualquier momento.
        </Text>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0a' }}>
              Progreso de configuración
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>
              {completedCount} de {totalCount} pasos
            </Text>
          </div>
          <Progress
            percent={Math.round((completedCount / totalCount) * 100)}
            strokeColor="#1faec2"
            trailColor="rgba(10,10,10,0.08)"
            showInfo={false}
            strokeWidth={8}
            style={{ margin: 0 }}
          />
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {steps.map(step => {
          const isCurrent = !step.done && step === nextPending

          let borderColor = 'rgba(10,10,10,0.08)'
          let background  = '#fafbfc'
          if (step.done)    { borderColor = '#bbf7d0'; background = '#f0fdf4' }
          if (isCurrent)    { borderColor = '#1faec2'; background = '#fff' }

          return (
            <div
              key={step.id}
              style={{
                padding: '18px 20px',
                borderRadius: 10,
                border: `2px solid ${borderColor}`,
                background,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                position: 'relative',
                boxShadow: isCurrent ? '0 4px 16px rgba(31,174,194,0.12)' : 'none',
              }}
            >
              {/* Status badge top-right */}
              {step.done ? (
                <CheckCircleFilled
                  style={{
                    position: 'absolute', top: 14, right: 14,
                    fontSize: 18, color: '#2ea172',
                  }}
                />
              ) : (
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 22, height: 22, borderRadius: '50%',
                  background: isCurrent ? '#1faec2' : 'rgba(10,10,10,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: isCurrent ? '#fff' : '#9aa1ab',
                }}>
                  {step.num}
                </div>
              )}

              {/* Icon + title */}
              <div style={{
                color: step.done ? '#2ea172' : isCurrent ? '#1faec2' : '#9aa1ab',
              }}>
                {step.icon}
              </div>

              <div>
                <div style={{
                  fontWeight: 700, fontSize: 13, color: '#0a0a0a',
                  marginBottom: 4,
                }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: '1.5' }}>
                  {step.desc}
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                {step.done ? (
                  <Tag
                    style={{
                      background: '#dcfce7', borderColor: '#bbf7d0',
                      color: '#15803d', fontWeight: 600, fontSize: 11,
                    }}
                  >
                    Completado
                  </Tag>
                ) : step.route ? (
                  <Button
                    type={isCurrent ? 'primary' : 'default'}
                    size="small"
                    style={isCurrent
                      ? { background: '#1faec2', borderColor: '#1faec2', fontWeight: 600 }
                      : { color: '#6b7280' }
                    }
                    onClick={() => navigate(step.route)}
                  >
                    {isCurrent ? 'Completar ahora →' : 'Ir'}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer nav */}
      <div style={{
        marginTop: 28, paddingTop: 20,
        borderTop: '1px solid rgba(10,10,10,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Button type="link" style={{ color: '#9aa1ab', padding: 0 }} onClick={() => navigate('/dashboard')}>
          Continuar sin configurar
        </Button>
        {completedCount === totalCount && (
          <Button
            type="primary"
            style={{ background: '#2ea172', borderColor: '#2ea172' }}
            onClick={() => navigate('/dashboard')}
          >
            ¡Todo listo — Ir al Dashboard!
          </Button>
        )}
      </div>
    </div>
  )
}
