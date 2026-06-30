export type EmbedChatMessage = {
  role: 'user' | 'model'
  parts: { text: string }[]
  imagePreviewUrl?: string
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo leer la imagen'))
      el.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function canvasDataUrlFromImage(
  img: HTMLImageElement,
  maxSide: number,
  quality: number,
  mimeType = 'image/jpeg'
): Promise<string> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear canvas')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(mimeType, quality)
}

export async function fileToChatImagePayload(file: File): Promise<{
  mimeType: string
  data: string
  previewUrl: string
  staffPreviewUrl: string
}> {
  const img = await loadImageFromFile(file)
  const previewUrl =
    file.size > 900_000
      ? await canvasDataUrlFromImage(img, 1280, 0.82)
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
          reader.readAsDataURL(file)
        })
  const staffPreviewUrl = await canvasDataUrlFromImage(img, 640, 0.72)
  const [meta, b64] = previewUrl.split(',')
  const mimeType = meta?.match(/data:([^;]+);base64/i)?.[1] || 'image/jpeg'
  if (!b64) throw new Error('Imagen inválida')
  return { mimeType, data: b64, previewUrl, staffPreviewUrl }
}

export function collectUserTexts(messages: EmbedChatMessage[]): string[] {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.parts?.[0]?.text || '')
    .filter(Boolean)
}

export const EMBED_CHAT_CONVERSATION_KEY = 'embed_chat_conversation_id'
