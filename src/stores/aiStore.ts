import { create } from 'zustand'

export type SummaryFormat = 'concise' | 'list' | 'table' | 'custom'

interface AIState {
  isStreaming: boolean
  streamingCardId: string | null
  streamingText: string
  error: string | null
  format: SummaryFormat
  customQuestion: string
  summaryCardId: string | null
  isComplete: boolean

  startStreaming: (cardId: string, format?: SummaryFormat) => void
  appendChunk: (chunk: string) => void
  completeStreaming: (summary: string) => void
  errorStreaming: (message: string) => void
  setFormat: (format: SummaryFormat) => void
  setCustomQuestion: (question: string) => void
  setSummaryCardId: (cardId: string) => void
  reset: () => void
}

export const useAIStore = create<AIState>()((set) => ({
  isStreaming: false,
  streamingCardId: null,
  streamingText: '',
  error: null,
  format: 'concise',
  customQuestion: '',
  summaryCardId: null,
  isComplete: false,

  startStreaming: (cardId: string, format?: SummaryFormat) => {
    set({
      isStreaming: true,
      streamingCardId: cardId,
      streamingText: '',
      error: null,
      isComplete: false,
      summaryCardId: null,
      ...(format ? { format } : {}),
    })
  },

  appendChunk: (chunk: string) => {
    set((state) => ({ streamingText: state.streamingText + chunk }))
  },

  completeStreaming: (summary: string) => {
    set({ isStreaming: false, streamingText: summary, isComplete: true })
  },

  errorStreaming: (message: string) => {
    set({ isStreaming: false, error: message })
  },

  setFormat: (format: SummaryFormat) => {
    set({ format })
  },

  setCustomQuestion: (question: string) => {
    set({ customQuestion: question })
  },

  setSummaryCardId: (cardId: string) => {
    set({ summaryCardId: cardId })
  },

  reset: () => {
    set({
      isStreaming: false,
      streamingCardId: null,
      streamingText: '',
      error: null,
      isComplete: false,
      summaryCardId: null,
    })
  },
}))

let listenersSetup = false

export function setupAIListeners() {
  if (listenersSetup) return
  listenersSetup = true

  const electronAPI = (window as any).electronAPI
  if (!electronAPI?.ai) return

  electronAPI.ai.onSummaryChunk((data: { chunk: string }) => {
    useAIStore.getState().appendChunk(data.chunk)
  })

  electronAPI.ai.onSummaryComplete((data: { summary: string }) => {
    useAIStore.getState().completeStreaming(data.summary)
  })

  electronAPI.ai.onSummaryError((data: { message: string }) => {
    useAIStore.getState().errorStreaming(data.message)
  })
}
