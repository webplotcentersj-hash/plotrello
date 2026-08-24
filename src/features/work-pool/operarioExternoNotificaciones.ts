import type { Notification } from '../../types/api'

/** Notificaciones del chat interno Plot Lab que no deben verse en el panel externo. */
export function isNotificacionChatInterno(n: Pick<Notification, 'type' | 'title' | 'description' | 'chat_canal' | 'origen'>): boolean {
  if (n.chat_canal) return true
  if (n.type === 'mention') return true

  const title = (n.title || '').toLowerCase()
  const desc = (n.description || '').toLowerCase()
  const blob = `${title} ${desc}`

  if (title.includes('te mencionaron en #')) return true
  if (title.includes('sirena en chat') || blob.includes('sirena en chat')) return true
  if (title.startsWith('🚨') && blob.includes('chat')) return true
  if (/te mencionaron en #/.test(title)) return true

  return false
}

/** Solo avisos relevantes para operario externo (pedidos, trabajos, saldo, etc.). */
export function filtrarNotificacionesOperarioExterno(list: Notification[]): Notification[] {
  return list.filter((n) => !isNotificacionChatInterno(n))
}
