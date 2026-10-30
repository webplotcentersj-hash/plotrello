import { useEffect, useState } from 'react'
import type { CajaSyncToastDetail } from '../cajaSyncNotify'

function fmtArsToast(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CajaSyncToastHost() {
  const [toast, setToast] = useState<CajaSyncToastDetail | null>(null)

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<CajaSyncToastDetail>).detail
      if (!detail?.message && !detail?.title) return
      setToast(detail)
    }
    window.addEventListener('caja-sync-toast', onToast as EventListener)
    return () => window.removeEventListener('caja-sync-toast', onToast as EventListener)
  }, [])

  useEffect(() => {
    if (!toast) return
    const ms = toast.ok ? (toast.notorio ? 7000 : 4500) : 7000
    const t = setTimeout(() => setToast(null), ms)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  const notorio = Boolean(toast.notorio && toast.ok)
  const falta = Number(toast.saldoFalta) || 0
  const tieneFalta = falta > 0.009

  return (
    <div
      className={[
        'caja-cc-sync-toast',
        toast.ok ? 'caja-cc-sync-toast--ok' : 'caja-cc-sync-toast--err',
        notorio ? 'caja-cc-sync-toast--notorio' : '',
        tieneFalta ? 'caja-cc-sync-toast--parcial' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role={toast.ok ? 'status' : 'alert'}
    >
      {toast.title ? <strong className="caja-cc-sync-toast__title">{toast.title}</strong> : null}
      {toast.message ? <span className="caja-cc-sync-toast__msg">{toast.message}</span> : null}
      {tieneFalta ? (
        <span className="caja-cc-sync-toast__falta">Falta $ {fmtArsToast(falta)}</span>
      ) : null}
    </div>
  )
}
