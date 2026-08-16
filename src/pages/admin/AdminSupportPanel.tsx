import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Table, Tag, Segmented, Button, Modal, Input, Space, Typography, message as antdMessage, Badge, Statistic, Card,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SendOutlined, ReloadOutlined, CheckOutlined, ClockCircleOutlined, InboxOutlined } from '@ant-design/icons'
import {
  adminTickets, adminVerTicket, adminResponder, adminCambiarStatus, codigoTicket, adminSubirAdjunto,
  type SupportTicket, type TicketConversation, type SupportTicketStatus, type AdjuntoRef,
} from '../../api/support'
import { MessageAttachments, AdjuntarButton, PendingStrip } from '../../components/HelpAgent/attachments'

const { Text } = Typography
const NAVY = '#1B3A6B'

const STATUS: Record<SupportTicketStatus, { color: string; label: string }> = {
  open:     { color: 'processing', label: 'Abierto' },
  answered: { color: 'success',    label: 'Respondido' },
  closed:   { color: 'default',    label: 'Cerrado' },
}
const fmt = (iso: string) => new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// Tiempo transcurrido desde createdAt (para monitorear cuánto lleva abierto un ticket).
const antiguedad = (iso: string): { texto: string; horas: number } => {
  const ms = Date.now() - new Date(iso).getTime()
  const horas = ms / 3_600_000
  const dias = Math.floor(horas / 24)
  if (dias >= 1) return { texto: `${dias} d`, horas }
  const h = Math.floor(horas)
  if (h >= 1) return { texto: `${h} h`, horas }
  return { texto: `${Math.max(1, Math.floor(ms / 60_000))} min`, horas }
}
// Color de alerta por tiempo abierto: >48h rojo, >24h naranja, si no gris.
const colorAntiguedad = (horas: number): string => (horas >= 48 ? '#cf1322' : horas >= 24 ? '#d46b08' : '#8493a8')

export default function AdminSupportPanel() {
  const [filtro, setFiltro] = useState<'' | SupportTicketStatus>('')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [conv, setConv] = useState<TicketConversation | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [respAdj, setRespAdj] = useState<AdjuntoRef[]>([])
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setTickets(await adminTickets(filtro || undefined)) }
    catch { antdMessage.error('No se pudieron cargar los tickets') }
    finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { void cargar() }, [cargar])

  // Polling de la conversación abierta (para ver nuevos mensajes del cliente)
  const convId = conv?.ticket.id
  useEffect(() => {
    if (!convId) return
    const t = setInterval(async () => {
      try { setConv(await adminVerTicket(convId)) } catch { /* ignore */ }
    }, 15000)
    return () => clearInterval(t)
  }, [convId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conv?.messages.length])

  const abrir = async (id: string) => {
    try { setConv(await adminVerTicket(id)); setRespuesta('') }
    catch { antdMessage.error('No se pudo abrir el ticket') }
  }

  const responder = async () => {
    if ((!respuesta.trim() && !respAdj.length) || !conv) return
    setEnviando(true)
    try {
      await adminResponder(conv.ticket.id, respuesta.trim(), respAdj)
      setRespuesta('')
      setRespAdj([])
      setConv(await adminVerTicket(conv.ticket.id))
      void cargar()
    } catch { antdMessage.error('No se pudo enviar la respuesta') }
    finally { setEnviando(false) }
  }

  const cambiarStatus = async (status: SupportTicketStatus) => {
    if (!conv) return
    try {
      await adminCambiarStatus(conv.ticket.id, status)
      setConv({ ...conv, ticket: { ...conv.ticket, status } })
      void cargar()
    } catch { antdMessage.error('No se pudo cambiar el estado') }
  }

  const cols: ColumnsType<SupportTicket> = [
    {
      title: 'Ticket', width: 96,
      render: (_, r) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{codigoTicket(r.numero)}</Text>
      ),
    },
    {
      title: 'Tenant / Usuario',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.tenantName ?? '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.userName ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Asunto',
      dataIndex: 'asunto',
      render: (v, r) => (
        <Space>
          {r.unreadForAdmin && <Badge color={NAVY} />}
          <Text style={{ fontSize: 13 }}>{v}</Text>
        </Space>
      ),
    },
    { title: 'Estado', dataIndex: 'status', width: 120,
      render: (v: SupportTicketStatus) => <Tag color={STATUS[v].color}>{STATUS[v].label}</Tag> },
    { title: 'Abierto hace', width: 110,
      render: (_, r) => {
        if (r.status === 'closed') return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        const a = antiguedad(r.createdAt)
        return <Text strong style={{ fontSize: 12, color: colorAntiguedad(a.horas) }}>{a.texto}</Text>
      } },
    { title: 'Último mensaje', dataIndex: 'lastMessageAt', width: 150,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text> },
    { title: '', width: 90, render: (_, r) => <Button size="small" onClick={() => abrir(r.id)}>Abrir</Button> },
  ]

  // Monitoreo de tiempo abierto: pendientes (no cerrados) y el más antiguo.
  const noCerrados = tickets.filter(t => t.status !== 'closed')
  const masViejo = noCerrados.length
    ? noCerrados.reduce((a, b) => (new Date(a.createdAt) <= new Date(b.createdAt) ? a : b))
    : null
  const edadViejo = masViejo ? antiguedad(masViejo.createdAt) : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Card size="small" styles={{ body: { padding: '10px 16px' } }} style={{ minWidth: 160 }}>
          <Statistic
            title={<Space size={4}><InboxOutlined /> Pendientes</Space>}
            value={noCerrados.length}
            valueStyle={{ fontSize: 22, color: NAVY }}
          />
        </Card>
        <Card size="small" styles={{ body: { padding: '10px 16px' } }} style={{ minWidth: 200 }}>
          <Statistic
            title={<Space size={4}><ClockCircleOutlined /> Más antiguo abierto</Space>}
            value={edadViejo ? edadViejo.texto : '—'}
            valueStyle={{ fontSize: 22, color: edadViejo ? colorAntiguedad(edadViejo.horas) : '#8493a8' }}
            suffix={masViejo ? <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{codigoTicket(masViejo.numero)}</Text> : undefined}
          />
        </Card>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Segmented
          value={filtro}
          onChange={v => setFiltro(v as any)}
          options={[
            { label: 'Todos', value: '' },
            { label: 'Abiertos', value: 'open' },
            { label: 'Respondidos', value: 'answered' },
            { label: 'Cerrados', value: 'closed' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void cargar()}>Actualizar</Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={tickets}
        columns={cols}
        size="small"
        pagination={{ pageSize: 10, size: 'small' }}
        rowClassName={r => (r.unreadForAdmin ? 'ant-table-row-selected' : '')}
      />

      <Modal
        open={!!conv}
        onCancel={() => setConv(null)}
        footer={null}
        width={560}
        title={conv ? (
          <Space>
            <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: NAVY }}>{codigoTicket(conv.ticket.numero)}</Text>
            <Text strong>{conv.ticket.asunto}</Text>
            <Tag color={STATUS[conv.ticket.status].color}>{STATUS[conv.ticket.status].label}</Tag>
          </Space>
        ) : ''}
      >
        {conv && (
          <>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {conv.ticket.tenantName} · {conv.ticket.userName}
            </Text>
            <div style={{ maxHeight: 360, overflowY: 'auto', margin: '12px 0', padding: '4px 2px' }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {conv.messages.map(m => (
                  <div key={m.id} style={{
                    alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%', marginLeft: m.sender === 'admin' ? 'auto' : 0,
                    background: m.sender === 'admin' ? NAVY : '#f0f2f7',
                    color: m.sender === 'admin' ? '#fff' : '#1a1a2e',
                    borderRadius: 10, padding: '8px 12px',
                  }}>
                    <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>
                      {m.sender === 'admin' ? (m.authorName || 'Soporte') : (m.authorName || 'Cliente')} · {fmt(m.createdAt)}
                    </div>
                    {m.body && <Text style={{ color: 'inherit', fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.body}</Text>}
                    <MessageAttachments attachments={m.attachments} />
                  </div>
                ))}
                <div ref={bottomRef} />
              </Space>
            </div>

            {conv.ticket.status !== 'closed' ? (
              <>
                <PendingStrip pendientes={respAdj} onQuitar={i => setRespAdj(prev => prev.filter((_, j) => j !== i))} />
                <Space.Compact style={{ width: '100%' }}>
                  <AdjuntarButton uploader={adminSubirAdjunto} onUploaded={ref => setRespAdj(prev => [...prev, ref])} color={NAVY} />
                  <Input.TextArea
                    placeholder="Escribí tu respuesta..."
                    value={respuesta}
                    onChange={e => setRespuesta(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                  />
                  <Button type="primary" icon={<SendOutlined />} loading={enviando} onClick={responder}
                    style={{ background: NAVY, height: 'auto' }} />
                </Space.Compact>
                <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => cambiarStatus('closed')}
                  style={{ marginTop: 8, color: '#8493a8' }}>
                  Cerrar ticket
                </Button>
              </>
            ) : (
              <Button size="small" onClick={() => cambiarStatus('open')}>Reabrir ticket</Button>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
