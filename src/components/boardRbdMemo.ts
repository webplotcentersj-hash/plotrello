import type { CSSProperties } from 'react'
import type { ActivityEvent } from '../types/board'

/** Estilos inline que suele inyectar hello-pangea/dnd; comparar sin JSON.stringify (más barato con muchas fichas). */
const RBD_DRAG_STYLE_KEYS: (keyof CSSProperties)[] = [
  'transform',
  'transition',
  'opacity',
  'pointerEvents',
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'position',
  'zIndex',
  'userSelect',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft'
]

export function draggableInlineStylesEqual(
  a: CSSProperties | null | undefined,
  b: CSSProperties | null | undefined
): boolean {
  if (a === b) return true
  if (!a && !b) return true
  if (!a || !b) return false
  for (const k of RBD_DRAG_STYLE_KEYS) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/** Evita re-render masivo cuando la columna reconstruye arrays de actividad con el mismo contenido. */
export function activityEventsEqual(
  a: ActivityEvent[] | undefined,
  b: ActivityEvent[] | undefined
): boolean {
  if (a === b) return true
  const aa = a ?? []
  const bb = b ?? []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (aa[i].id !== bb[i].id || aa[i].timestamp !== bb[i].timestamp) return false
  }
  return true
}
