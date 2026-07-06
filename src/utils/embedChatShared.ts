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

export const EMBED_WIDGET_CLOSED_SIZE = 88

/** Tamaño del iframe en la página padre (WordPress). En iframe cerrado innerWidth ≈ 88px — usar screen. */
export function getEmbedWidgetOpenSize(): { width: number; height: number; fullscreen: boolean } {
  if (typeof window === 'undefined') {
    return { width: 380, height: 540, fullscreen: false }
  }

  const framed = window.self !== window.top
  const screenW = framed
    ? window.screen?.availWidth || window.screen?.width || 400
    : window.innerWidth
  const screenH = framed
    ? window.screen?.availHeight || window.screen?.height || 700
    : window.innerHeight
  const mobile = screenW <= 520

  return {
    width: mobile ? Math.min(screenW - 20, 360) : Math.min(380, Math.max(screenW - 16, 320)),
    height: mobile ? Math.min(Math.round(screenH * 0.68), 480) : Math.min(540, Math.max(screenH - 24, 400)),
    fullscreen: false
  }
}

export function postEmbedWidgetResize(open: boolean): void {
  if (typeof window === 'undefined' || window.parent === window) return
  try {
    const size = getEmbedWidgetOpenSize()
    const w = open ? size.width : EMBED_WIDGET_CLOSED_SIZE
    const h = open ? size.height : EMBED_WIDGET_CLOSED_SIZE
    window.parent.postMessage(
      { type: 'plotai-widget-resize', open, width: w, height: h, fullscreen: false },
      '*'
    )
  } catch {
    /* ignore */
  }
}

/** Pide al sitio padre (WordPress) expandir el iframe a pantalla completa — mismo chat, micrófono sin cambiar de pestaña. */
export function postEmbedWidgetFullscreen(open = true): void {
  if (typeof window === 'undefined' || window.parent === window) return
  try {
    window.parent.postMessage({ type: 'plotai-widget-resize', open: true, fullscreen: open }, '*')
  } catch {
    /* ignore */
  }
}

export const EMBED_CHAT_SESSION_KEY = 'plotai_embed_chat_session'

export type EmbedChatSessionSnapshot = {
  messages: EmbedChatMessage[]
  nombre: string
  telefono: string
  dni: string
  cuit: string
  op: string
  presupuesto: EmbedPresupuestoPayload | null
  conversationId: number | null
}

export function saveEmbedChatSession(snapshot: EmbedChatSessionSnapshot): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(EMBED_CHAT_SESSION_KEY, JSON.stringify(snapshot))
  } catch {
    /* ignore */
  }
}

export function loadEmbedChatSession(): EmbedChatSessionSnapshot | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem(EMBED_CHAT_SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as EmbedChatSessionSnapshot
    if (!data || !Array.isArray(data.messages)) return null
    return data
  } catch {
    return null
  }
}

export function clearEmbedChatSession(): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.removeItem(EMBED_CHAT_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function openEmbedStandaloneChat(snapshot: EmbedChatSessionSnapshot): void {
  saveEmbedChatSession(snapshot)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin.replace(/\/$/, '')}/embed/chat?resume=1`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export type EmbedPresupuestoItem = {
  codigo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type EmbedPresupuestoPayload = {
  numero: string
  fecha: string
  validez_hasta: string
  cliente_nombre: string
  cliente_telefono?: string | null
  lista_label: string
  items: EmbedPresupuestoItem[]
  total: number
  notas: string
}

export const EMBED_CHAT_WELCOME_TITLE = 'Hola, soy PlotAI'

export const EMBED_CHAT_WELCOME_SUB =
  'Cotizaciones con Lista 1, consultas de OP y pedidos nuevos. Para cotizar necesito tu nombre y WhatsApp.'

/** Saludo inicial visible (misma lógica que chat-public: precios + contacto + OP). */
export const EMBED_CHAT_OPENING_GREETING =
  '¡Hola! Soy PlotAI de Plot Center. Puedo cotizar con Lista 1 (efectivo, débito o transferencia), consultar el estado de tu OP o ayudarte con un pedido nuevo.\n\n' +
  'Para cotizar o encargar un trabajo necesito tu nombre y tu WhatsApp en un solo mensaje, por ejemplo: Juan 2644123456.\n' +
  'Si ya tenés una OP en curso, decime el número o tu nombre/DNI.\n' +
  'Cuando te pase precios, vas a poder descargar el presupuesto en PDF desde el botón del chat.\n\n' +
  '¿En qué te ayudo?'

export type EmbedChatIdentificacion = {
  nombre?: string
  telefono?: string
  dni?: string
  cuit?: string
  op?: string
  empresa?: string
  clienteEmail?: string
}

export function buildEmbedChatApiPayload(params: {
  message: string
  modo?: string
  history: Array<{ role: string; parts: { text: string }[] }>
  conversationId?: number | null
  clienteId?: number | null
  identificacion?: EmbedChatIdentificacion
  image?: { mimeType: string; data: string; staffPreviewUrl: string } | null
}): Record<string, unknown> {
  const id = params.identificacion ?? {}
  const normalize = (value: string | undefined, digitsOnly = false) => {
    const t = (value || '').trim()
    if (!t) return undefined
    if (digitsOnly) {
      const num = t.replace(/\D/g, '')
      return num.length >= 2 ? num : t
    }
    return t
  }

  return {
    message: params.message,
    modo: params.modo || 'web_publico',
    ...(params.clienteId ? { cliente_id: params.clienteId } : {}),
    ...(params.image
      ? {
          images: [{ mimeType: params.image.mimeType, data: params.image.data }],
          staff_image_preview: params.image.staffPreviewUrl
        }
      : {}),
    nombre: normalize(id.nombre),
    empresa: id.empresa || undefined,
    cliente_email: id.clienteEmail || undefined,
    telefono: normalize(id.telefono, true),
    whatsapp: normalize(id.telefono, true),
    dni: normalize(id.dni, true),
    cuit: normalize(id.cuit, true),
    op: normalize(id.op, true),
    conversation_id: params.conversationId ?? undefined,
    history: params.history
  }
}
