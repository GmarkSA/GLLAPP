import { useEffect, useState, useCallback } from 'react'
import { Button, Input, Space, Typography, Empty, Tag, Spin, message as antdMessage } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import {
  misTickets, crearTicket, verTicket, agregarMensaje, codigoTicket, subirAdjunto,
  type SupportTicket, type TicketConversation, type SupportTicketStatus, type AdjuntoRef,
} from '../../api/support'
import { MessageAttachments, AdjuntarButton, PendingStrip, DropPasteZone } from './attachments'

const { Text } = Typography
const TEAL = '#1faec2'

const STATUS_TAG: Record<SupportTicketStatus, { color: string; label: string }> = {
  open:     { color: 'processing', label: 'Abierto' },
  answered: { color: 'success',    label: 'En proceso' },
  closed:   { color: 'default',    label: 'Cerrado' },
}

const fmt = (iso: string) => new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SupportView({ prefill }: { prefill?: string }) {
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'ticket'>('lista')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [conv, setConv] = useState<TicketConversation | null>(null)

  // Formulario nuevo ticket
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [nuevoAdj, setNuevoAdj] = useState<AdjuntoRef[]>([])

  // Responder en un ticket abierto
  const [respuesta, setRespuesta] = useState('')
  const [respAdj, setRespAdj] = useState<AdjuntoRef[]>([])

  const cargarLista = useCallback(async () => {
    setLoading(true)
    try { setTickets(await misTickets()) }
    catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (vista === 'lista') void cargarLista() }, [vista, cargarLista])

  // Polling de la conversación abierta (cada 15s) para ver respuestas del soporte
  const convId = conv?.ticket.id
  useEffect(() => {
    if (vista !== 'ticket' || !convId) return
    const t = setInterval(async () => {
      try { setConv(await verTicket(convId)) } catch { /* ignore */ }
    }, 15000)
    return () => clearInterval(t)
  }, [vista, convId])

  const abrirTicket = async (id: string) => {
    setLoading(true)
    try {
      setConv(await verTicket(id))
      setVista('ticket')
    } catch { antdMessage.error('No se pudo abrir el ticket') }
    finally { setLoading(false) }
  }

  const irNuevo = () => {
    setAsunto(prefill ? prefill.slice(0, 80) : '')
    setMensaje('')
    setNuevoAdj([])
    setVista('nuevo')
  }

  const enviarNuevo = async () => {
    if (!mensaje.trim() && !nuevoAdj.length) { antdMessage.warning('Escribí tu consulta o adjuntá un archivo'); return }
    setEnviando(true)
    try {
      const t = await crearTicket(asunto.trim() || 'Consulta', mensaje.trim(), nuevoAdj)
      antdMessage.success('Ticket enviado a soporte')
      setNuevoAdj([])
      await abrirTicket(t.id)
    } catch { antdMessage.error('No se pudo crear el ticket') }
    finally { setEnviando(false) }
  }

  const enviarRespuesta = async () => {
    if ((!respuesta.trim() && !respAdj.length) || !conv) return
    const body = respuesta.trim()
    const adj = respAdj
    setRespuesta('')
    setRespAdj([])
    try {
      await agregarMensaje(conv.ticket.id, body, adj)
      setConv(await verTicket(conv.ticket.id))
    } catch { antdMessage.error('No se pudo enviar el mensaje') }
  }

  // ── Vista: conversación de un ticket ──
  if (vista === 'ticket' && conv) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => setVista('lista')} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>{codigoTicket(conv.ticket.numero)}</Text>
            <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>{conv.ticket.asunto}</Text>
          </div>
          <Tag color={STATUS_TAG[conv.ticket.status].color}>{STATUS_TAG[conv.ticket.status].label}</Tag>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10 }}>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {conv.messages.map(m => (
              <div key={m.id} style={{
                alignSelf: m.sender === 'client' ? 'flex-end' : 'flex-start',
                maxWidth: '88%', marginLeft: m.sender === 'client' ? 'auto' : 0,
                background: m.sender === 'client' ? TEAL : '#f0f2f7',
                color: m.sender === 'client' ? '#fff' : '#1a1a2e',
                borderRadius: 10, padding: '8px 12px',
              }}>
                <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>
                  {m.sender === 'admin' ? (m.authorName || 'Soporte') : 'Vos'} · {fmt(m.createdAt)}
                </div>
                {m.body && <Text style={{ color: 'inherit', fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.body}</Text>}
                <MessageAttachments attachments={m.attachments} />
              </div>
            ))}
          </Space>
        </div>
        {conv.ticket.status !== 'closed' && (
          <DropPasteZone uploader={subirAdjunto} onUploaded={ref => setRespAdj(prev => [...prev, ref])}>
            <PendingStrip pendientes={respAdj} onQuitar={i => setRespAdj(prev => prev.filter((_, j) => j !== i))} />
            <Space.Compact style={{ width: '100%' }}>
              <AdjuntarButton uploader={subirAdjunto} onUploaded={ref => setRespAdj(prev => [...prev, ref])} />
              <Input
                placeholder="Escribí un mensaje..."
                value={respuesta}
                onChange={e => setRespuesta(e.target.value)}
                onPressEnter={enviarRespuesta}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={enviarRespuesta} style={{ background: TEAL }} />
            </Space.Compact>
          </DropPasteZone>
        )}
      </div>
    )
  }

  // ── Vista: nuevo ticket ──
  if (vista === 'nuevo') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => setVista('lista')} />
          <Text strong style={{ fontSize: 13 }}>Nueva consulta a soporte</Text>
        </div>
        <DropPasteZone uploader={subirAdjunto} onUploaded={ref => setNuevoAdj(prev => [...prev, ref])}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Input placeholder="Asunto" value={asunto} onChange={e => setAsunto(e.target.value)} maxLength={120} />
          <Input.TextArea
            placeholder="Contanos tu consulta o problema..."
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            autoSize={{ minRows: 5, maxRows: 10 }}
          />
          <PendingStrip pendientes={nuevoAdj} onQuitar={i => setNuevoAdj(prev => prev.filter((_, j) => j !== i))} />
          <Space>
            <AdjuntarButton uploader={subirAdjunto} onUploaded={ref => setNuevoAdj(prev => [...prev, ref])} />
            <Text type="secondary" style={{ fontSize: 12 }}>Adjuntá imágenes, documentos o audio (máx. 10 MB) — también podés arrastrarlos aquí o pegar una captura con Ctrl+V</Text>
          </Space>
          <Button type="primary" block loading={enviando} onClick={enviarNuevo} style={{ background: TEAL }}>
            Enviar a soporte
          </Button>
        </Space>
        </DropPasteZone>
      </div>
    )
  }

  // ── Vista: lista de mis tickets ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={irNuevo} style={{ background: TEAL, marginBottom: 12 }} block>
        Nueva consulta
      </Button>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && tickets.length === 0 && <Spin style={{ display: 'block', margin: '32px auto' }} />}
        {!loading && tickets.length === 0 && (
          <Empty description="No tenés consultas de soporte" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 32 }} />
        )}
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => abrirTicket(t.id)}
              style={{
                cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
                background: t.unreadForClient ? '#e9f8fb' : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ fontSize: 13, flex: 1 }} ellipsis>{t.asunto}</Text>
                <Tag color={STATUS_TAG[t.status].color} style={{ margin: 0 }}>{STATUS_TAG[t.status].label}</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                <span style={{ fontFamily: 'monospace' }}>{codigoTicket(t.numero)}</span> · {fmt(t.lastMessageAt)}
              </Text>
              {t.unreadForClient && <Tag color={TEAL} style={{ marginLeft: 6 }}>Nueva respuesta</Tag>}
            </div>
          ))}
        </Space>
      </div>
    </div>
  )
}
