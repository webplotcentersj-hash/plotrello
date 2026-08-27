import type { Notification } from '../../types/api'
import type { WorkPoolProduct } from '../../types/workPool'

type NotifPick = Pick<
  Notification,
  | 'type'
  | 'title'
  | 'description'
  | 'chat_canal'
  | 'origen'
  | 'pedido_id'
  | 'orden_id'
  | 'brief_id'
  | 'capacitacion_id'
>

/** Notificaciones del chat interno Plot Lab que no deben verse en el panel externo. */
export function isNotificacionChatInterno(
  n: Pick<Notification, 'type' | 'title' | 'description' | 'chat_canal' | 'origen'>
): boolean {
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

/** Menú diario, RRHH y avisos internos ajenos a la bolsa. */
export function isNotificacionFueraDeWorkPool(n: NotifPick): boolean {
  if (isNotificacionChatInterno(n)) return true

  const title = (n.title || '').toLowerCase()
  const desc = (n.description || '').toLowerCase()
  const blob = `${title} ${desc}`
  const origen = (n.origen || '').toLowerCase()

  if (origen === 'rrhh_masivo' || origen === 'sistema' || origen === 'cc_vencimiento') return true
  if (title.includes('menú diario') || title.includes('menu diario')) return true
  if (desc.includes('/menu-diario') || blob.includes('menú diario') || blob.includes('menu diario')) {
    return true
  }
  if (blob.includes('elegí tu plato') || blob.includes('elegir tu plato')) return true
  if (blob.includes('intercambio de turno')) return true
  if (blob.includes('capacitación') || blob.includes('capacitacion')) return true
  if (blob.includes('horas extra') || blob.includes('permiso rrhh')) return true
  if (n.capacitacion_id != null) return true

  return false
}

function prefijoProducto(product?: WorkPoolProduct): '[Plot Design]' | '[Bolsa Plot]' | null {
  if (product === 'plot-design') return '[Plot Design]'
  if (product === 'bolsa-plot') return '[Bolsa Plot]'
  return null
}

/** Avisos de la bolsa / Plot Design o Bolsa Plot (títulos con prefijo del RPC). */
export function isNotificacionWorkPool(n: NotifPick, product?: WorkPoolProduct): boolean {
  if (isNotificacionFueraDeWorkPool(n)) return false

  const title = (n.title || '').trim()
  const origen = (n.origen || '').toLowerCase()
  const prefijo = prefijoProducto(product)

  if (origen === 'work_pool' || origen === 'work_pool_postulacion') {
    if (!prefijo) return true
    return title.startsWith(prefijo) || title.toLowerCase().includes(prefijo.toLowerCase())
  }

  if (prefijo) {
    if (title.startsWith(prefijo)) return true
  } else if (title.startsWith('[Plot Design]') || title.startsWith('[Bolsa Plot]')) {
    return true
  }

  // Mensajes / pedidos del portal ligados a trabajo de bolsa
  const desc = (n.description || '').toLowerCase()
  const blob = `${title.toLowerCase()} ${desc}`
  if (n.pedido_id != null && (blob.includes('cliente') || blob.includes('pedido') || blob.includes('mensaje'))) {
    if (!prefijo) return true
    return title.startsWith(prefijo)
  }

  return false
}

/**
 * Solo avisos de Plot Design / Bolsa Plot (trabajos, mensajes, saldo).
 * Excluye menú diario, chat interno, RRHH, etc.
 */
export function filtrarNotificacionesOperarioExterno(
  list: Notification[],
  product?: WorkPoolProduct
): Notification[] {
  return list.filter((n) => isNotificacionWorkPool(n, product))
}
