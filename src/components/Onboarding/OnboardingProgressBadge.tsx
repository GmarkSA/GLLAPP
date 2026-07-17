import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover, Progress, Typography, Space, Button, List } from 'antd'
import { CheckCircleFilled, ClockCircleOutlined, MessageOutlined } from '@ant-design/icons'
import { useOnboardingStore } from '../../store/onboardingStore'

const { Text } = Typography

export default function OnboardingProgressBadge() {
  const navigate = useNavigate()
  const { steps, completionPercent, refresh, setChatOpen } = useOnboardingStore()

  useEffect(() => { refresh() }, [])

  if (steps.length === 0 || completionPercent >= 100) return null

  const content = (
    <div style={{ width: 280 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Completa estos pasos para dejar tu empresa lista para operar:
      </Text>
      <List
        size="small"
        dataSource={steps}
        style={{ margin: '8px 0' }}
        renderItem={step => (
          <List.Item
            style={{ padding: '6px 0', cursor: 'pointer' }}
            onClick={() => navigate(step.route)}
          >
            <Space>
              {step.done
                ? <CheckCircleFilled style={{ color: '#2ea172' }} />
                : <ClockCircleOutlined style={{ color: '#ff7f00' }} />}
              <Text delete={step.done} type={step.done ? 'secondary' : undefined} style={{ fontSize: 13 }}>
                {step.label}
              </Text>
            </Space>
          </List.Item>
        )}
      />
      <Button
        type="primary"
        size="small"
        icon={<MessageOutlined />}
        block
        style={{ background: '#1faec2' }}
        onClick={() => setChatOpen(true)}
      >
        Preguntar al asistente
      </Button>
    </div>
  )

  return (
    <Popover content={content} title="Progreso de configuración" trigger="click" placement="bottomLeft">
      <Button type="text" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress
          type="circle"
          percent={completionPercent}
          size={22}
          strokeColor="#24cae2"
          format={() => ''}
        />
        <Text style={{ fontSize: 12, color: '#6b7280' }}>Configuración {completionPercent}%</Text>
      </Button>
    </Popover>
  )
}
