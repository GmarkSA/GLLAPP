import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Input, Button, Typography, Space, Empty, Spin } from 'antd'
import { SendOutlined, RobotOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useOnboardingStore } from '../../store/onboardingStore'

const { Text } = Typography

export default function OnboardingChatDrawer() {
  const navigate = useNavigate()
  const { chatOpen, setChatOpen, messages, isSending, sendMessage } = useOnboardingStore()
  const [input, setInput] = useState('')

  const submit = () => {
    const text = input.trim()
    if (!text || isSending) return
    setInput('')
    sendMessage(text)
  }

  return (
    <Drawer
      open={chatOpen}
      onClose={() => setChatOpen(false)}
      title={<Space><RobotOutlined style={{ color: '#1B3A6B' }} /> Asistente de configuración</Space>}
      width={380}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
          {messages.length === 0 && (
            <Empty
              description="Pregúntame qué te falta configurar para empezar a operar."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 40 }}
            />
          )}
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  marginLeft: m.role === 'user' ? 'auto' : 0,
                  background: m.role === 'user' ? '#1B3A6B' : '#f0f2f7',
                  color: m.role === 'user' ? '#fff' : '#1a1a2e',
                  borderRadius: 10,
                  padding: '8px 12px',
                }}
              >
                <Text style={{ color: 'inherit', fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</Text>
                {m.suggestedAction && (
                  <Button
                    type="link"
                    size="small"
                    icon={<ArrowRightOutlined />}
                    style={{ padding: '4px 0', height: 'auto', color: '#1B3A6B' }}
                    onClick={() => { navigate(m.suggestedAction!.route); setChatOpen(false) }}
                  >
                    {m.suggestedAction.label}
                  </Button>
                )}
              </div>
            ))}
            {isSending && <Spin size="small" />}
          </Space>
        </div>

        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Escribe tu pregunta..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onPressEnter={submit}
            disabled={isSending}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={submit} loading={isSending} style={{ background: '#1B3A6B' }} />
        </Space.Compact>
      </div>
    </Drawer>
  )
}
