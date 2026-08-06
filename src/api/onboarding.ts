import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface OnboardingStep {
  key:   'empresa' | 'regimen_fiscal' | 'plan_cuentas' | 'impuestos' | 'series_documentos'
       | 'clientes' | 'proveedores' | 'bancos' | 'productos'
  label: string
  route: string
  done:  boolean
}

export interface OnboardingStatus {
  steps: OnboardingStep[]
  completionPercent: number
}

export interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

export interface OnboardingChatReply {
  reply: string
  suggestedAction?: { label: string; route: string }
}

export const getOnboardingStatus = (): Promise<OnboardingStatus> =>
  api.get('/onboarding/status').then(unwrap)

export const postOnboardingChat = (messages: ChatMessage[]): Promise<OnboardingChatReply> =>
  api.post('/onboarding/chat', { messages }).then(unwrap)
