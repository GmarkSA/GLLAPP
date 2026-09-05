import { useNavigate } from 'react-router-dom'
import { Alert, Button, Progress, Spin, Tag, Typography } from 'antd'
import {
  CheckCircleFilled,
  BankOutlined,
  FileTextOutlined,
  BookOutlined,
  SettingOutlined,
  PercentageOutlined,
  UserOutlined,
  ShopOutlined,
  CreditCardOutlined,
  ArrowRightOutlined,
  ApartmentOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import { useSetupSteps, type SetupStep } from '../../hooks/useSetupSteps'
import { markSetupStepDone, markSetupStepSkipped } from '../../hooks/setupProgress'
import { MODULE_TOURS, abrirTour, isTourSeen } from '../../components/Tour/moduleTours'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'
import { getBillingState } from '../../api/billing'
import { useEffect, useState } from 'react'

const { Title, Text } = Typography

const STEP_ICONS: Record<string, React.ReactNode> = {
  empresa:      <BankOutlined      style={{ fontSize: 22 }} />,
  perfil:       <FileTextOutlined  style={{ fontSize: 22 }} />,
  catalogo:     <BookOutlined      style={{ fontSize: 22 }} />,
  contabilidad: <SettingOutlined    style={{ fontSize: 22 }} />,
  clases_af:    <ApartmentOutlined  style={{ fontSize: 22 }} />,
  impuestos:    <PercentageOutlined style={{ fontSize: 22 }} />,
  clientes:     <UserOutlined      style={{ fontSize: 22 }} />,
  proveedores:  <ShopOutlined      style={{ fontSize: 22 }} />,
  bancos:       <CreditCardOutlined style={{ fontSize: 22 }} />,
}

export default function SetupGuidePage() {
  const navigate = useNavigate()
  const { steps, loading, completedCount, completionPercent, reload } = useSetupSteps()
  const companyId = useCompanyStore(s => s.activeCompany?.id)
  const userId    = useAuthStore(s => (s.user as any)?.id as string | undefined)

  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [planNombre,    setPlanNombre]    = useState<string | null>(null)

  useEffect(() => {
    getBillingState().then(data => {
      const st = data.tenant?.status ?? data.subscription?.status
      if (st === 'trialing' || st === 'trial') {
        if (data.tenant?.trialEndsAt) {
          const diff = Math.ceil((new Date(data.tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000)
          setTrialDaysLeft(Math.max(0, diff))
        } else {
          setTrialDaysLeft(0)
        }
      }
      setPlanNombre(data.plans?.find(p => p.plan === data.tenant?.plan)?.displayName ?? null)
    }).catch(() => {})
  }, [])

  const onTrial = trialDaysLeft !== null

  const nextPending = steps.find(s => !s.done)

  const goTo = (step: { id: string; route: string }) => {
    navigate(step.route)
  }
  // Datos maestros: confirmar (ya hay registros) u omitir por ahora sin salir de la guía
  const actions: CardActions = {
    confirm: async (step) => { if (companyId) await markSetupStepDone(companyId, step.id).catch(() => {}); reload() },
    skip:    async (step) => { if (companyId) await markSetupStepSkipped(companyId, step.id).catch(() => {}); reload() },
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>

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
              {completedCount} de {steps.length} pasos
            </Text>
          </div>
          <Progress
            percent={completionPercent}
            strokeColor="#1faec2"
            trailColor="rgba(10,10,10,0.08)"
            showInfo={false}
            strokeWidth={8}
            style={{ margin: 0 }}
          />
        </div>
      </div>

      {/* Banner trial */}
      {onTrial && (
        <Alert
          type={trialDaysLeft! <= 3 ? 'error' : trialDaysLeft! <= 7 ? 'warning' : 'info'}
          icon={<CrownOutlined />}
          showIcon
          style={{ marginBottom: 24, borderRadius: 10 }}
          message={
            trialDaysLeft! <= 0
              ? 'Tu período de prueba ha vencido. Elige un plan para seguir operando.'
              : `Prueba gratuita — ${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}. Al terminar la configuración elige tu plan.`
          }
          action={
            <Button size="small" style={{ background: '#1faec2', borderColor: '#1faec2', color: '#fff' }}
              onClick={() => navigate('/configuracion/suscripcion')}>
              Ver planes
            </Button>
          }
        />
      )}

      {/* Sección: Configuración base */}
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9aa1ab', textTransform: 'uppercase' }}>
          Configuración base
        </Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {steps.slice(0, 6).map(step => renderCard(step, nextPending, goTo, actions))}
      </div>

      {/* Sección: Conoce Lucía — tours por módulo (no cuentan para el progreso; se repiten cuando se quiera) */}
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9aa1ab', textTransform: 'uppercase' }}>
          Conoce Lucía — recorridos de menos de un minuto
        </Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {MODULE_TOURS.map(t => {
          const visto = isTourSeen(userId, t.key)
          return (
            <div key={t.key} style={{ padding: '16px 20px', borderRadius: 10, border: `2px solid ${visto ? '#bbf7d0' : 'rgba(10,10,10,0.08)'}`, background: visto ? '#f0fdf4' : '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: visto ? '#2ea172' : '#1faec2' }}>
                <PlayCircleOutlined style={{ fontSize: 20 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0a0a0a' }}>Tour de {t.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>{t.steps.length} paradas · ~{t.seconds} s</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{t.summary}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {visto && <Tag style={{ background: '#dcfce7', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 600, fontSize: 11 }}>Visto</Tag>}
                <Button type={visto ? 'link' : 'primary'} size="small" onClick={() => abrirTour(t.key)}
                  style={visto ? { color: '#2ea172', padding: '0 2px', fontSize: 12 } : { background: '#1faec2', borderColor: '#1faec2', fontWeight: 600 }}>
                  {visto ? 'Repetir tour' : 'Iniciar tour →'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sección: Datos maestros */}
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9aa1ab', textTransform: 'uppercase' }}>
          Datos maestros
        </Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
        {steps.slice(6).map(step => renderCard(step, nextPending, goTo, actions))}
      </div>

      {/* Footer */}
      <div style={{
        paddingTop: 20,
        borderTop: '1px solid rgba(10,10,10,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Button type="link" style={{ color: '#9aa1ab', padding: 0 }} onClick={() => navigate('/dashboard')}>
          {/* Si la configuración base (1-6) ya está completa, lo único pendiente son datos maestros */}
          {steps.slice(0, 6).every(s => s.done) ? 'Continuar sin crear datos maestros' : 'Continuar sin configurar'}
        </Button>
        {completedCount === steps.length && (
          onTrial ? (
            <Button
              type="primary"
              icon={<CrownOutlined />}
              style={{ background: '#1faec2', borderColor: '#1faec2' }}
              onClick={() => navigate('/configuracion/suscripcion')}
            >
              ¡Configuración lista! Elegir mi plan →
            </Button>
          ) : (
            <Button
              type="primary"
              style={{ background: '#2ea172', borderColor: '#2ea172' }}
              onClick={() => navigate('/dashboard')}
            >
              ¡Lista para operar! → Ir al Dashboard
            </Button>
          )
        )}
      </div>
    </div>
  )
}

type CardActions = { confirm: (s: SetupStep) => Promise<void>; skip: (s: SetupStep) => Promise<void> }

function renderCard(
  step: SetupStep,
  nextPending: typeof step | undefined,
  goTo: (s: typeof step) => void,
  actions: CardActions,
) {
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
      {/* Badge top-right */}
      {step.done ? (
        <CheckCircleFilled style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 18, color: '#2ea172',
        }} />
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

      {/* Ícono */}
      <div style={{ color: step.done ? '#2ea172' : isCurrent ? '#1faec2' : '#9aa1ab' }}>
        {STEP_ICONS[step.id]}
      </div>

      {/* Título + desc */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0a0a0a', marginBottom: 4 }}>
          {step.label}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: '1.5' }}>
          {step.desc}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        {step.done && !step.skipped && (
          <Tag style={{
            background: '#dcfce7', borderColor: '#bbf7d0',
            color: '#15803d', fontWeight: 600, fontSize: 11,
          }}>
            Completado
          </Tag>
        )}
        {step.done && step.skipped && (
          <Tag style={{ background: '#f3f4f6', borderColor: '#e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 11 }}>
            Omitido por ahora
          </Tag>
        )}
        {!step.done && step.hint && (
          <Tag style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 600, fontSize: 11 }}>
            {step.hint}
          </Tag>
        )}
        {step.route && (
          <Button
            type={isCurrent ? 'primary' : 'link'}
            size="small"
            icon={!isCurrent ? <ArrowRightOutlined style={{ fontSize: 11 }} /> : undefined}
            style={isCurrent
              ? { background: '#1faec2', borderColor: '#1faec2', fontWeight: 600 }
              : { color: step.done ? '#2ea172' : '#9aa1ab', padding: '0 2px', fontSize: 12 }
            }
            onClick={() => goTo(step)}
          >
            {isCurrent ? 'Revisar y completar →' : step.done ? (step.skipped ? 'Agregar ahora' : 'Revisar') : step.num <= 6 ? 'Revisar y completar' : 'Ir al módulo'}
          </Button>
        )}
        {!step.done && step.confirmable && (
          <Button size="small" type="link" style={{ color: '#2ea172', padding: '0 2px', fontSize: 12, fontWeight: 600 }} onClick={() => actions.confirm(step)}>
            Confirmar ✓
          </Button>
        )}
        {!step.done && step.skippable && (
          <Button size="small" type="text" style={{ color: '#9aa1ab', padding: '0 4px', fontSize: 12, marginLeft: 'auto' }} onClick={() => actions.skip(step)}>
            Omitir por ahora
          </Button>
        )}
      </div>
    </div>
  )
}
