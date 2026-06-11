export type CajaSyncToastDetail = {
  ok: boolean
  message: string
}

export function notifyCajaSync(detail: CajaSyncToastDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('caja-sync-toast', { detail }))
}
