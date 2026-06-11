import { useEffect, useState } from 'react'
import type { CajaSyncToastDetail } from '../cajaSyncNotify'

export default function CajaSyncToastHost() {
  const [toast, setToast] = useState<CajaSyncToastDetail | null>(null)

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<CajaSyncToastDetail>).detail
      if (!detail?.message) return
      setToast(detail)
    }
    window.addEventListener('caja-sync-toast', onToast as EventListener)
    return () => window.removeEventListener('caja-sync-toast', onToast as EventListener)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.ok ? 4500 : 7000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  return (
    <div
      className={`caja-cc-sync-toast${toast.ok ? ' caja-cc-sync-toast--ok' : ' caja-cc-sync-toast--err'}`}
      role={toast.ok ? 'status' : 'alert'}
    >
      {toast.message}
    </div>
  )
}
