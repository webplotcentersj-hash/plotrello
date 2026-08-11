import { TOTEM_SOLICITUD_ASESOR_MARKER } from '../constants/totemSolicitudAsesor'
import { TOTEM_SOLICITUD_DISENADOR_MARKER } from '../constants/totemSolicitudDisenador'
import type { Notification, UserRole } from '../types/api'

const TOTEM_ATENCION_TITLE = 'Cliente en tótem esperando atención'
const TOTEM_ASESOR_TITLE = 'Cliente en tótem pide asesor'

/** Títulos insertados por crear/marcar pago de impresión tótem (SQL). */
const TOTEM_IMPRESION_TITLES = new Set([
  'Tótem: nueva solicitud de impresión',
  'Tótem: pago confirmado — impresión',
  'Tótem: impresión pagada (Mercado Pago)',
  'Tótem: pago Mercado Pago confirmado — impresión'
])

export function notificationIsTotemSolicitudAsesor(
  n: Pick<Notification, 'title' | 'description'>
): boolean {
  const title = (n.title ?? '').trim()
  if (title === TOTEM_ASESOR_TITLE) return true
  return (n.description ?? '').includes(TOTEM_SOLICITUD_ASESOR_MARKER)
}

export function notificationIsTotemAtencionMostrador(
  n: Pick<Notification, 'title' | 'description'>
): boolean {
  return (n.title ?? '').trim() === TOTEM_ATENCION_TITLE
}

export function notificationIsTotemImpresionPedido(
  n: Pick<Notification, 'title' | 'description'>
): boolean {
  const title = (n.title ?? '').trim()
  if (TOTEM_IMPRESION_TITLES.has(title)) return true
  const t = title.toLowerCase()
  if (!t.includes('tótem') && !t.includes('totem')) return false
  return t.includes('impresión') || t.includes('impresion')
}

export function notificationIsTotemSolicitudDisenador(
  n: Pick<Notification, 'title' | 'description'>
): boolean {
  return (n.description ?? '').includes(TOTEM_SOLICITUD_DISENADOR_MARKER)
}

export function notificationIsTotemRelated(
  n: Pick<Notification, 'title' | 'description'>
): boolean {
  return (
    notificationIsTotemSolicitudAsesor(n) ||
    notificationIsTotemAtencionMostrador(n) ||
    notificationIsTotemSolicitudDisenador(n) ||
    notificationIsTotemImpresionPedido(n)
  )
}

export function mapRolToChatCanal(rol: UserRole | string | undefined): string {
  switch (rol) {
    case 'diseno':
      return 'diseno'
    case 'recursos-humanos':
      return 'recursos-humanos'
    case 'metalurgica':
      return 'metalurgica'
    case 'taller-grafico':
    case 'imprenta':
      return 'taller-grafico'
    case 'mostrador':
    case 'caja':
    case 'presupuestos':
    case 'instalaciones':
    case 'compras':
    case 'asesor-tecnico':
    case 'administracion':
    case 'gerencia':
      return 'mostrador'
    default:
      return 'mostrador'
  }
}

export function getTotemNotificationNavigatePath(
  n: Pick<Notification, 'title' | 'description' | 'chat_canal' | 'orden_id'>,
  usuarioRol?: UserRole | string
): string {
  if (notificationIsTotemImpresionPedido(n)) return '/impresoras/totem'
  if (notificationIsTotemSolicitudAsesor(n)) return '/asesor'
  if (notificationIsTotemSolicitudDisenador(n)) return '/disenador'
  if (notificationIsTotemAtencionMostrador(n)) {
    const canalRaw = n.chat_canal?.trim()
    const canalValido =
      canalRaw &&
      ['general', 'diseno', 'recursos-humanos', 'metalurgica', 'mostrador', 'taller-grafico', 'random'].includes(
        canalRaw
      )
        ? canalRaw
        : mapRolToChatCanal(usuarioRol)
    return `/chat?canal=${encodeURIComponent(canalValido)}`
  }
  return '/chat'
}

function cleanTotemDescription(raw: string): string {
  return raw
    .replaceAll(TOTEM_SOLICITUD_ASESOR_MARKER, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractOpFromTotemText(text: string): string | null {
  const m = text.match(/(?:OP|por la OP)\s*[#:]?\s*(\d[\d-]*)/i)
  return m?.[1] ?? null
}

function extractClienteFromTotemText(text: string): string | null {
  const m = text.match(/^(.+?)\s+se registró desde el tótem/i)
  return m?.[1]?.trim() || null
}

function extractClienteImpresionFromText(text: string): string | null {
  const m = text.match(/Cliente:\s*([^\n—|]+)/i)
  return m?.[1]?.trim() || null
}

function extractSolicitudImpresionId(text: string): string | null {
  const m = text.match(/Solicitud\s*#\s*(\d+)/i)
  return m?.[1] ?? null
}

export function formatTotemNotificationForDisplay(
  n: Pick<Notification, 'title' | 'description'>
): { title: string; description: string; icon: string; actionLabel: string } {
  const raw = n.description ?? ''
  const cleaned = cleanTotemDescription(raw)
  const op = extractOpFromTotemText(raw) || extractOpFromTotemText(cleaned)
  const cliente = extractClienteFromTotemText(raw) || extractClienteFromTotemText(cleaned)

  if (notificationIsTotemImpresionPedido(n)) {
    const clienteImp = extractClienteImpresionFromText(raw) || extractClienteImpresionFromText(cleaned)
    const solId = extractSolicitudImpresionId(raw) || extractSolicitudImpresionId(cleaned)
    const titleLower = (n.title ?? '').toLowerCase()
    const pagado =
      titleLower.includes('pago') || titleLower.includes('pagada') || titleLower.includes('mercado pago')
    return {
      title: pagado
        ? solId
          ? `Impresión pagada · #${solId}`
          : 'Impresión tótem pagada'
        : solId
          ? `Pedido impresión · #${solId}`
          : 'Nuevo pedido de impresión',
      description:
        [clienteImp, cleaned.includes('Podés imprimir') ? 'Listo para imprimir' : null]
          .filter(Boolean)
          .join(' · ') || cleaned.slice(0, 140) ||
        'Hay un pedido nuevo en la cola del tótem.',
      icon: '🖨️',
      actionLabel: 'Abrir pedidos tótem'
    }
  }

  if (notificationIsTotemSolicitudAsesor(n)) {
    const sectorMatch = cleaned.match(/Sector(?: sugerido)?:\s*([^.]+)/i)
    const sector = sectorMatch?.[1]?.trim()
    const esPresupuesto =
      (sector ?? '').toLowerCase().includes('presupuesto') ||
      cleaned.toLowerCase().includes('presupuestos y asesoramiento')
    return {
      title: op
        ? `${esPresupuesto ? 'Presupuestos' : 'Asesor'} · OP ${op}`
        : esPresupuesto
          ? 'Llamado a Presupuestos (tótem)'
          : 'Asesor solicitado en tótem',
      description: [cliente, sector ? `Sector: ${sector}` : null].filter(Boolean).join(' · ') ||
        (esPresupuesto
          ? 'El cliente tocó Presupuestos y asesoramiento.'
          : 'El cliente tocó «Llamar a un asesor».'),
      icon: '📞',
      actionLabel: 'Abrir panel asesor'
    }
  }

  if (notificationIsTotemSolicitudDisenador(n)) {
    return {
      title: 'Llamado a Diseño (tótem)',
      description: cliente || 'El cliente se dirige a Diseño gráfico y marketing.',
      icon: '🎨',
      actionLabel: 'Abrir panel diseñador'
    }
  }

  if (notificationIsTotemAtencionMostrador(n)) {
    return {
      title: op ? `Cliente esperando · OP ${op}` : 'Cliente esperando en tótem',
      description: cliente || 'Registró su llegada desde el tótem.',
      icon: '🖐️',
      actionLabel: 'Abrir chat del sector'
    }
  }

  return {
    title: n.title ?? 'Notificación',
    description: cleaned || raw,
    icon: '🔔',
    actionLabel: 'Ver'
  }
}

export function formatNotificationForDisplay(
  n: Pick<Notification, 'title' | 'description' | 'type'>
): { title: string; description: string; icon: string; actionLabel?: string } {
  if (notificationIsTotemRelated(n)) {
    return formatTotemNotificationForDisplay(n)
  }
  return {
    title: n.title ?? 'Notificación',
    description: n.description ?? '',
    icon: n.type === 'mention' ? '💬' : '🔔'
  }
}

export function isChatPanelNotification(n: Notification): boolean {
  // Pedidos de impresión van a /impresoras/totem (campana), no al panel de chat.
  if (notificationIsTotemImpresionPedido(n)) return false
  if (
    notificationIsTotemSolicitudAsesor(n) ||
    notificationIsTotemSolicitudDisenador(n) ||
    notificationIsTotemAtencionMostrador(n)
  )
    return true
  if (n.type === 'mention') return true
  const desc = (n.description ?? '').toLowerCase()
  return desc.includes('chat') || desc.includes('mencionó')
}
