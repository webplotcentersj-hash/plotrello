import { TOTEM_SOLICITUD_ASESOR_MARKER } from '../constants/totemSolicitudAsesor'
import type { Notification, UserRole } from '../types/api'

const TOTEM_ATENCION_TITLE = 'Cliente en tótem esperando atención'
const TOTEM_ASESOR_TITLE = 'Cliente en tótem pide asesor'

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

export function notificationIsTotemRelated(
  n: Pick<Notification, 'title' | 'description'>
): boolean {
  return notificationIsTotemSolicitudAsesor(n) || notificationIsTotemAtencionMostrador(n)
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
  if (notificationIsTotemSolicitudAsesor(n)) return '/asesor'
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

export function formatTotemNotificationForDisplay(
  n: Pick<Notification, 'title' | 'description'>
): { title: string; description: string; icon: string; actionLabel: string } {
  const raw = n.description ?? ''
  const cleaned = cleanTotemDescription(raw)
  const op = extractOpFromTotemText(raw) || extractOpFromTotemText(cleaned)
  const cliente = extractClienteFromTotemText(raw) || extractClienteFromTotemText(cleaned)

  if (notificationIsTotemSolicitudAsesor(n)) {
    const sectorMatch = cleaned.match(/Sector(?: sugerido)?:\s*([^.]+)/i)
    const sector = sectorMatch?.[1]?.trim()
    return {
      title: op ? `Asesor solicitado · OP ${op}` : 'Asesor solicitado en tótem',
      description: [cliente, sector ? `Sector: ${sector}` : null].filter(Boolean).join(' · ') ||
        'El cliente tocó «Llamar a un asesor».',
      icon: '📞',
      actionLabel: 'Abrir panel asesor'
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
  if (notificationIsTotemRelated(n)) return true
  if (n.type === 'mention') return true
  const desc = (n.description ?? '').toLowerCase()
  return desc.includes('chat') || desc.includes('mencionó')
}
