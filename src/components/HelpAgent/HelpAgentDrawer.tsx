import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Input, Button, Typography, Space, FloatButton, Tag, Segmented, Spin } from 'antd'
import {
  SendOutlined, RobotOutlined, ArrowRightOutlined, QuestionCircleOutlined, CustomerServiceOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import {
  buscarAyuda, respuestaDe, rutaLabelDe, articuloPorId, candidatosParaAgente, type HelpArticle,
} from './helpArticles'
import { preguntarAgente } from '../../api/support'
import SupportView from './SupportView'
import LinkAiAccountModal from './LinkAiAccountModal'

const { Text } = Typography
const TEAL = '#1faec2'

interface ChatMsg {
  role: 'user' | 'agent'
  content: string
  article?: HelpArticle   // si el agente encontró una respuesta, se adjunta para pasos + deep-link
  noMatch?: boolean
}

// Preguntas sugeridas iniciales (frases naturales que resuelven bien contra la base)
const SUGERENCIAS = [
  '¿Cómo importo facturas de proveedores?',
  '¿Cómo creo una factura de venta?',
  '¿Cómo registro un pago recibido?',
  '¿Dónde configuro la facturación electrónica (FEL)?',
]

export default function HelpAgentDrawer() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'ayuda' | 'soporte'>('ayuda')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [ultimaPregunta, setUltimaPregunta] = useState('')
  const [pensando, setPensando] = useState(false)
  const [aiModal, setAiModal] = useState(false)

  // Fallback determinista (motor local) — se usa si la IA no está disponible o falla.
  const responderLocal = (text: string): ChatMsg => {
    const matches = buscarAyuda(text)
    return matches.length > 0
      ? { role: 'agent', content: respuestaDe(matches[0].article), article: matches[0].article }
      : {
          role: 'agent',
          noMatch: true,
          content: 'No encontré una respuesta exacta a eso. Probá reformular tu pregunta (por ejemplo: "cómo importo facturas" o "registrar un pago").',
        }
  }

  const responder = async (pregunta: string) => {
    const text = pregunta.trim()
    if (!text) return
    setUltimaPregunta(text)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setPensando(true)
    try {
      const r = await preguntarAgente(text, candidatosParaAgente())
      let agente: ChatMsg
      if (r.fuente === 'ia' && r.respuesta) {
        const article = r.articuloId ? articuloPorId(r.articuloId) : undefined
        agente = { role: 'agent', content: r.respuesta, article, noMatch: !article }
      } else {
        // sin-config / error → motor local
        agente = responderLocal(text)
      }
      setMessages(prev => [...prev, agente])
    } catch {
      setMessages(prev => [...prev, responderLocal(text)])
    } finally {
      setPensando(false)
    }
  }

  const submit = () => {
    const text = input.trim()
    if (!text || pensando) return
    setInput('')
    void responder(text)
  }

  return (
    <>
      <FloatButton
        icon={<QuestionCircleOutlined />}
        type="primary"
        tooltip="Ayuda"
        style={{ insetInlineEnd: 24, insetBlockEnd: 24 }}
        onClick={() => setOpen(true)}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={<Space><RobotOutlined style={{ color: TEAL }} /> Asistente de ayuda</Space>}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Segmented
            block
            options={[{ label: 'Ayuda', value: 'ayuda' }, { label: 'Soporte', value: 'soporte' }]}
            value={tab}
            onChange={v => setTab(v as 'ayuda' | 'soporte')}
            style={{ marginBottom: 12 }}
          />

          {tab === 'soporte' ? (
            <SupportView prefill={ultimaPregunta} />
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
            {messages.length === 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Hola 👋 Preguntame cómo hacer algo en el sistema y te llevo al módulo correcto.
                </Text>
                <div style={{ marginTop: 16, marginBottom: 4, fontSize: 12, color: '#8493a8' }}>Preguntas frecuentes:</div>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {SUGERENCIAS.map((s, i) => (
                    <Tag
                      key={i}
                      onClick={() => void responder(s)}
                      style={{
                        cursor: 'pointer', whiteSpace: 'normal', padding: '6px 10px',
                        borderColor: TEAL, color: TEAL, background: '#e9f8fb', width: '100%',
                      }}
                    >
                      {s}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                    marginLeft: m.role === 'user' ? 'auto' : 0,
                    background: m.role === 'user' ? TEAL : '#f0f2f7',
                    color: m.role === 'user' ? '#fff' : '#1a1a2e',
                    borderRadius: 10,
                    padding: '9px 12px',
                  }}
                >
                  <Text style={{ color: 'inherit', fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</Text>

                  {m.article?.pasos && m.article.pasos.length > 0 && (
                    <ol style={{ margin: '8px 0 4px', paddingInlineStart: 18, fontSize: 12.5, color: '#3a4a5e' }}>
                      {m.article.pasos.map((p, j) => (
                        <li key={j} style={{ marginBottom: 3 }}>{p}</li>
                      ))}
                    </ol>
                  )}

                  {m.article?.ruta && (
                    <Button
                      type="link"
                      size="small"
                      icon={<ArrowRightOutlined />}
                      style={{ padding: '4px 0', height: 'auto', color: TEAL }}
                      onClick={() => { navigate(m.article!.ruta); setOpen(false) }}
                    >
                      {rutaLabelDe(m.article)}
                    </Button>
                  )}
                </div>
              ))}

              {pensando && (
                <div style={{ alignSelf: 'flex-start', background: '#f0f2f7', borderRadius: 10, padding: '9px 12px' }}>
                  <Space size={8}><Spin size="small" /><Text type="secondary" style={{ fontSize: 12 }}>Pensando…</Text></Space>
                </div>
              )}
            </Space>
          </div>

          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="Escribí tu pregunta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={submit}
              disabled={pensando}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={submit} loading={pensando} style={{ background: TEAL }} />
          </Space.Compact>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Button
              type="text"
              size="small"
              icon={<CustomerServiceOutlined />}
              onClick={() => setTab('soporte')}
              style={{ color: '#8493a8', fontSize: 12, paddingLeft: 0 }}
            >
              Hablar con soporte
            </Button>
            <Button
              type="text"
              size="small"
              icon={<ApiOutlined />}
              onClick={() => setAiModal(true)}
              style={{ color: TEAL, fontSize: 12 }}
            >
              Enlazar mi cuenta IA
            </Button>
          </div>
          </div>
          )}
        </div>
      </Drawer>

      <LinkAiAccountModal open={aiModal} onClose={() => setAiModal(false)} />
    </>
  )
}
