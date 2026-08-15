import { useEffect, useState } from 'react'
import { Modal, Select, Input, Button, Typography, Space, Tag, Alert, message as antdMessage } from 'antd'
import { ApiOutlined, CheckCircleOutlined, DisconnectOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  aiConfigEstado, aiConfigGuardar, aiConfigDesvincular, aiConfigProbar,
  type AiProvider, type AiConfigEstado,
} from '../../api/support'

const { Text } = Typography
const TEAL = '#1faec2'

const PROVIDERS: { value: AiProvider; label: string; modelo: string; ayuda: string }[] = [
  { value: 'claude',   label: 'Claude (Anthropic)', modelo: 'claude-haiku-4-5', ayuda: 'console.anthropic.com' },
  { value: 'openai',   label: 'OpenAI (ChatGPT)',   modelo: 'gpt-4o-mini',      ayuda: 'platform.openai.com' },
  { value: 'gemini',   label: 'Google Gemini',      modelo: 'gemini-2.0-flash', ayuda: 'aistudio.google.com' },
  { value: 'deepseek', label: 'DeepSeek',           modelo: 'deepseek-chat',    ayuda: 'platform.deepseek.com' },
]

export default function LinkAiAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [estado, setEstado] = useState<AiConfigEstado | null>(null)
  const [provider, setProvider] = useState<AiProvider>('claude')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [probando, setProbando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [probado, setProbado] = useState<null | boolean>(null)

  const modeloDefault = PROVIDERS.find(p => p.value === provider)?.modelo ?? ''
  const ayudaProveedor = PROVIDERS.find(p => p.value === provider)?.ayuda ?? ''

  useEffect(() => {
    if (!open) return
    setApiKey(''); setModel(''); setProbado(null)
    aiConfigEstado()
      .then(e => { setEstado(e); if (e.provider) setProvider(e.provider) })
      .catch(() => setEstado(null))
  }, [open])

  const probar = async () => {
    if (!apiKey.trim()) { antdMessage.warning('Pegá tu llave (API key)'); return }
    setProbando(true); setProbado(null)
    try {
      const r = await aiConfigProbar(provider, apiKey.trim(), model.trim() || undefined)
      setProbado(r.ok)
      if (r.ok) antdMessage.success('Conexión correcta')
      else antdMessage.error(`No se pudo conectar: ${r.error ?? 'llave inválida'}`)
    } catch { antdMessage.error('No se pudo probar la llave'); setProbado(false) }
    finally { setProbando(false) }
  }

  const guardar = async () => {
    if (!apiKey.trim()) { antdMessage.warning('Pegá tu llave (API key)'); return }
    setGuardando(true)
    try {
      const e = await aiConfigGuardar(provider, apiKey.trim(), model.trim() || undefined)
      setEstado(e); setApiKey(''); setProbado(null)
      antdMessage.success('Cuenta IA enlazada')
    } catch { antdMessage.error('No se pudo guardar la cuenta IA') }
    finally { setGuardando(false) }
  }

  const desvincular = async () => {
    try {
      const e = await aiConfigDesvincular()
      setEstado(e); setApiKey(''); setProbado(null)
      antdMessage.success('Cuenta IA desvinculada — se usa la IA de la plataforma')
    } catch { antdMessage.error('No se pudo desvincular') }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={440}
      title={<Space><ApiOutlined style={{ color: TEAL }} /> Enlazar mi cuenta de IA</Space>}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {estado?.vinculado ? (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={<Text style={{ fontSize: 13 }}>Usando tu cuenta: <b>{estado.providerLabel}</b> {estado.apiKeyMask && <Tag style={{ marginLeft: 4 }}>{estado.apiKeyMask}</Tag>}</Text>}
            description={<Text type="secondary" style={{ fontSize: 12 }}>Modelo: {estado.model}</Text>}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message={<Text style={{ fontSize: 13 }}>Estás usando la IA de la plataforma</Text>}
            description={<Text type="secondary" style={{ fontSize: 12 }}>Podés enlazar tu propia cuenta para usar tu proveedor. La llave se guarda cifrada y nunca se comparte.</Text>}
          />
        )}

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Proveedor</Text>
          <Select
            value={provider}
            onChange={v => { setProvider(v); setProbado(null) }}
            options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Llave (API key)</Text>
          <Input.Password
            placeholder="Pegá tu API key"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setProbado(null) }}
            style={{ marginTop: 4 }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>Obtené tu llave en {ayudaProveedor}</Text>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Modelo (opcional)</Text>
          <Input
            placeholder={modeloDefault}
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </div>

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button icon={<ThunderboltOutlined />} loading={probando} onClick={probar}>
            Probar
          </Button>
          <Space>
            {estado?.vinculado && (
              <Button danger type="text" icon={<DisconnectOutlined />} onClick={desvincular}>
                Desvincular
              </Button>
            )}
            <Button
              type="primary"
              loading={guardando}
              onClick={guardar}
              style={{ background: TEAL }}
              disabled={probado === false}
            >
              Guardar
            </Button>
          </Space>
        </Space>
      </Space>
    </Modal>
  )
}
