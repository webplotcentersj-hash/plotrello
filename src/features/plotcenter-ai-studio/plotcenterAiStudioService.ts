import { plotLabFetch } from '../../utils/plotLabApiOrigin'
import type { ChatMessage, GroundingChunk } from './types'

type DesignStudioResponse = {
  success?: boolean
  text?: string
  dataUrl?: string
  audioBase64?: string
  chunks?: GroundingChunk[]
  error?: string
}

async function callDesignStudio(payload: Record<string, unknown>): Promise<DesignStudioResponse> {
  const resp = await plotLabFetch('/api/plotai/design-studio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const json = (await resp.json().catch(() => ({}))) as DesignStudioResponse
  if (!resp.ok) {
    throw new Error(json.error || `Error Plot AI Studio (${resp.status})`)
  }
  return json
}

export async function studioChat(history: ChatMessage[], message: string): Promise<string> {
  const json = await callDesignStudio({
    action: 'chat',
    message,
    history: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
  })
  return json.text || ''
}

export async function studioThinking(prompt: string): Promise<string> {
  const json = await callDesignStudio({ action: 'thinking', prompt })
  return json.text || ''
}

export async function studioSearch(prompt: string): Promise<{ text: string; chunks: GroundingChunk[] }> {
  const json = await callDesignStudio({ action: 'search', prompt })
  return { text: json.text || '', chunks: json.chunks || [] }
}

export async function studioEditImage(
  prompt: string,
  imageBase64: string,
  imageMimeType: string
): Promise<string> {
  const json = await callDesignStudio({
    action: 'image-edit',
    prompt,
    imageBase64,
    imageMimeType
  })
  if (!json.dataUrl) throw new Error('Sin imagen en la respuesta')
  return json.dataUrl
}

export async function studioTts(text: string, voice: string): Promise<string> {
  const json = await callDesignStudio({ action: 'tts', text, voice })
  if (!json.audioBase64) throw new Error('Sin audio en la respuesta')
  return json.audioBase64
}

export async function studioGenerateImage(
  prompt: string,
  aspectRatio: string
): Promise<string> {
  const resp = await plotLabFetch('/api/plotai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, style: 'product' })
  })
  const json = (await resp.json().catch(() => ({}))) as { dataUrl?: string; error?: string }
  if (!resp.ok) throw new Error(json.error || `Error generando imagen (${resp.status})`)
  if (!json.dataUrl) throw new Error('Gemini no devolvió imagen')
  return json.dataUrl
}

export async function studioGenerateVideo(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1'
): Promise<string> {
  const resp = await plotLabFetch('/api/plotai/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, duration: 8 })
  })
  const json = (await resp.json().catch(() => ({}))) as {
    url?: string
    dataUrl?: string
    error?: string
    hint?: string
  }
  if (!resp.ok) {
    throw new Error(json.error || json.hint || `Error generando video (${resp.status})`)
  }
  const url = json.url || json.dataUrl
  if (!url) throw new Error('No se recibió URL de video')
  return url
}

export async function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
  return { mimeType: file.type || 'image/jpeg', data }
}
