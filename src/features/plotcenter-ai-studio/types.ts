export const StudioView = {
  DASHBOARD: 'DASHBOARD',
  CHATBOT: 'CHATBOT',
  IMAGE_GEN: 'IMAGE_GEN',
  IMAGE_EDIT: 'IMAGE_EDIT',
  VIDEO_GEN: 'VIDEO_GEN',
  COMPLEX_TASK: 'COMPLEX_TASK',
  SEARCH: 'SEARCH',
  TTS: 'TTS'
} as const

export type StudioView = (typeof StudioView)[keyof typeof StudioView]

export type ApiState = 'idle' | 'loading' | 'success' | 'error'

export type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

export type GroundingChunk = {
  web?: { uri: string; title: string }
  maps?: { uri: string; title: string }
}

export type StudioNavItem = {
  id: StudioView
  label: string
  icon: string
  description: string
}
