import type { MensajePedidoClienteRecord } from '../types/api'

export type MensajeThreadItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: MensajePedidoClienteRecord }

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function formatDaySeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const today = startOfDay(new Date())
  const day = startOfDay(date)
  const diffDays = Math.round((today - day) / 86_400_000)

  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  })
}

export function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  if (hours < 24) return `Hace ${hours} h`
  if (days < 7) return `Hace ${days} d`
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function buildMensajesThread(mensajes: MensajePedidoClienteRecord[]): MensajeThreadItem[] {
  const items: MensajeThreadItem[] = []
  let lastDayKey = ''

  for (const message of mensajes) {
    const dayKey = new Date(message.fecha_creacion).toDateString()
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey
      items.push({
        type: 'day',
        key: `day-${dayKey}`,
        label: formatDaySeparator(message.fecha_creacion)
      })
    }
    items.push({ type: 'message', key: `msg-${message.id}`, message })
  }

  return items
}

export const PEDIDO_ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  convertido_completo: 'En producción',
  convertido_parcial: 'Parcial',
  cancelado: 'Cancelado'
}
