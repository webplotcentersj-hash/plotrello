export type CajaSyncToastDetail = {
  ok: boolean
  message: string
}

export function notifyCajaSync(detail: CajaSyncToastDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('caja-sync-toast', { detail }))
}

export function notifyArqueoCompletado(cajaNombre: string, total: number): void {
  notifyCajaSync({
    ok: true,
    message: `Arqueo guardado en ${cajaNombre} — $ ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Listo para cierre de turno.`
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caja-datos-actualizados'))
  }
}
