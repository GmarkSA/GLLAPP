import { useNavigate } from 'react-router-dom'
import { Button, Progress, Spin, Tag, Typography } from 'antd'
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
} from '@ant-design/icons'
import { useSetupSteps, type SetupStep } from '../../hooks/useSetupSteps'

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
  const { steps, loading, completedCount, completionPercent } = useSetupSteps()

  const nextPending = steps.find(s => !s.done)

  const goTo = (step: { id: string; route: string }) => {
    navigate(step.route)
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

      {/* Sección: Configuración base */}
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9aa1ab', textTransform: 'uppercase' }}>
          Configuración base
        </Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {steps.slice(0, 6).map(step => renderCard(step, nextPending, goTo))}
      </div>

      {/* Sección: Datos maestros */}
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9aa1ab', textTransform: 'uppercase' }}>
          Datos maestros
        </Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
        {steps.slice(6).map(step => renderCard(step, nextPending, goTo))}
      </div>

      {/* Footer */}
      <div style={{
        paddingTop: 20,
        borderTop: '1px solid rgba(10,10,10,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Button type="link" style={{ color: '#9aa1ab', padding: 0 }} onClick={() => navigate('/dashboard')}>
          Continuar sin configurar
        </Button>
        {completedCount === steps.length && (
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

function renderCard(
  step: SetupStep,
  nextPending: typeof step | undefined,
  goTo: (s: typeof step) => void,
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
        {step.done && (
          <Tag style={{
            background: '#dcfce7', borderColor: '#bbf7d0',
            color: '#15803d', fontWeight: 600, fontSize: 11,
          }}>
            Completado
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
            {isCurrent ? 'Revisar y completar →' : step.done ? 'Revisar' : step.num <= 6 ? 'Revisar y completar' : 'Ir al módulo'}
          </Button>
        )}
      </div>
    </div>
  )
}
