import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type SupportSender = 'client' | 'admin'
export type SupportTicketStatus = 'open' | 'answered' | 'closed'

/** Adjunto tal como lo devuelve el servidor al leer la conversación (URL firmada temporal). */
export interface SupportAttachment {
  url: string
  name: string
  type: string
  size: number
}

/** Referencia de un adjunto ya subido (lo que se envía al crear el mensaje). */
export interface AdjuntoRef {
  key: string
  name: string
  type: string
  size: number
}

export interface SupportMessage {
  id: string
  ticketId: string
  sender: SupportSender
  authorName?: string
  body: string
  attachments?: SupportAttachment[]
  createdAt: string
}

export interface SupportTicket {
  id: string
  numero?: number
  tenantId: string
  companyId?: string
  userId?: string
  userName?: string
  tenantName?: string
  asunto: string
  status: SupportTicketStatus
  unreadForAdmin: boolean
  unreadForClient: boolean
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface TicketConversation {
  ticket: SupportTicket
  messages: SupportMessage[]
}

/** Correlativo visible del ticket: TCK-#### (o '—' si aún no tiene número). */
export const codigoTicket = (numero?: number): string =>
  numero ? `TCK-${String(numero).padStart(4, '0')}` : '—'

// ── Adjuntos ─────────────────────────────────────────────────────────────────

export const subirAdjunto = (file: File): Promise<AdjuntoRef> => {
  const fd = new FormData(); fd.append('file', file)
  return api.post('/support/attachments', fd).then(unwrap)
}

export const adminSubirAdjunto = (file: File): Promise<AdjuntoRef> => {
  const fd = new FormData(); fd.append('file', file)
  return api.post('/support/admin/attachments', fd).then(unwrap)
}

// ── Cliente ────────────────────────────────────────────────────────────────

export const crearTicket = (asunto: string, mensaje: string, attachments?: AdjuntoRef[]): Promise<SupportTicket> =>
  api.post('/support/tickets', { asunto, mensaje, attachments }).then(unwrap)

export const misTickets = (): Promise<SupportTicket[]> =>
  api.get('/support/tickets').then(unwrap)

export const verTicket = (id: string): Promise<TicketConversation> =>
  api.get(`/support/tickets/${id}`).then(unwrap)

export const agregarMensaje = (id: string, mensaje: string, attachments?: AdjuntoRef[]): Promise<SupportMessage> =>
  api.post(`/support/tickets/${id}/messages`, { mensaje, attachments }).then(unwrap)

// ── Admin (SuperAdmin) ───────────────────────────────────────────────────────

export const adminTickets = (status?: string): Promise<SupportTicket[]> =>
  api.get('/support/admin/tickets', { params: status ? { status } : {} }).then(unwrap)

export const adminUnreadCount = (): Promise<{ count: number }> =>
  api.get('/support/admin/tickets/unread-count').then(unwrap)

export const adminVerTicket = (id: string): Promise<TicketConversation> =>
  api.get(`/support/admin/tickets/${id}`).then(unwrap)

export const adminResponder = (id: string, mensaje: string, attachments?: AdjuntoRef[]): Promise<SupportMessage> =>
  api.post(`/support/admin/tickets/${id}/reply`, { mensaje, attachments }).then(unwrap)

export const adminCambiarStatus = (id: string, status: SupportTicketStatus): Promise<{ id: string; status: SupportTicketStatus }> =>
  api.patch(`/support/admin/tickets/${id}/status`, { status }).then(unwrap)

// ── Agente de ayuda IA ────────────────────────────────────────────────────────

export type AiProvider = 'claude' | 'openai' | 'gemini' | 'deepseek'

export interface AgenteCandidatoDTO {
  id: string
  modulo: string
  submodulo: string
  keywords?: string
}

export interface AgenteRespuesta {
  fuente: 'ia' | 'sin-config' | 'error'
  proveedor?: AiProvider
  respuesta?: string
  articuloId?: string | null
  error?: string
}

export const preguntarAgente = (pregunta: string, candidatos: AgenteCandidatoDTO[]): Promise<AgenteRespuesta> =>
  api.post('/support/agent', { pregunta, candidatos }).then(unwrap)

// ── Enlace "trae tu propia cuenta IA" ─────────────────────────────────────────

export interface AiConfigEstado {
  vinculado: boolean
  provider?: AiProvider
  providerLabel?: string
  model?: string | null
  apiKeyMask?: string
  updatedAt?: string
}

export const aiConfigEstado = (): Promise<AiConfigEstado> =>
  api.get('/support/ai-config').then(unwrap)

export const aiConfigGuardar = (provider: AiProvider, apiKey: string, model?: string): Promise<AiConfigEstado> =>
  api.put('/support/ai-config', { provider, apiKey, model }).then(unwrap)

export const aiConfigDesvincular = (): Promise<AiConfigEstado> =>
  api.delete('/support/ai-config').then(unwrap)

export const aiConfigProbar = (provider: AiProvider, apiKey: string, model?: string): Promise<{ ok: boolean; error?: string }> =>
  api.post('/support/ai-config/test', { provider, apiKey, model }).then(unwrap)
