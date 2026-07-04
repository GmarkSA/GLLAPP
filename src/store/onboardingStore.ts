import { create } from 'zustand'
import { getOnboardingStatus, postOnboardingChat } from '../api/onboarding'
import type { OnboardingStep, ChatMessage } from '../api/onboarding'

export interface ChatUIMessage extends ChatMessage {
  suggestedAction?: { label: string; route: string }
}

interface OnboardingStore {
  steps:             OnboardingStep[]
  completionPercent: number
  isLoading:         boolean
  lastLoaded:        number | null

  chatOpen:  boolean
  messages:  ChatUIMessage[]
  isSending: boolean

  refresh:      () => Promise<void>
  setChatOpen:  (open: boolean) => void
  sendMessage:  (text: string) => Promise<void>
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  steps:             [],
  completionPercent: 100,
  isLoading:         false,
  lastLoaded:        null,

  chatOpen:  false,
  messages:  [],
  isSending: false,

  refresh: async () => {
    // Evitar recargas en menos de 15 segundos
    const now = Date.now()
    if (get().lastLoaded && now - get().lastLoaded! < 15_000) return

    set({ isLoading: true })
    try {
      const status = await getOnboardingStatus()
      set({ steps: status.steps, completionPercent: status.completionPercent, lastLoaded: now })
    } catch {
      // silent — no interrumpir la UI
    } finally {
      set({ isLoading: false })
    }
  },

  setChatOpen: (open) => set({ chatOpen: open }),

  sendMessage: async (text) => {
    const userMessage: ChatUIMessage = { role: 'user', content: text }
    const history = [...get().messages, userMessage]
    set({ messages: history, isSending: true })

    try {
      const reply = await postOnboardingChat(history.map(({ role, content }) => ({ role, content })))
      set({
        messages: [...get().messages, { role: 'assistant', content: reply.reply, suggestedAction: reply.suggestedAction }],
      })
    } catch {
      set({
        messages: [...get().messages, { role: 'assistant', content: 'Ocurrió un error consultando al asistente. Intenta de nuevo.' }],
      })
    } finally {
      set({ isSending: false })
    }
  },
}))
