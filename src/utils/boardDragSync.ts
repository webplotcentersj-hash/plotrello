/** Un solo listener global para fin de drag (evita N listeners en cada TaskCard). */
let boardDragEndedAt = 0
let subscribed = false

function ensureSubscribed() {
  if (subscribed || typeof window === 'undefined') return
  subscribed = true
  window.addEventListener('board-dragging-changed', (e) => {
    const dragging = Boolean((e as CustomEvent<{ dragging?: boolean }>).detail?.dragging)
    if (!dragging) boardDragEndedAt = Date.now()
  })
}

export function getBoardDragEndedAt(): number {
  ensureSubscribed()
  return boardDragEndedAt
}
