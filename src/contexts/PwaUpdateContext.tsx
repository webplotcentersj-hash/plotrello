import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type ToastType = 'info' | 'success' | 'error'

export type PwaToast = {
  id: number
  message: string
  type: ToastType
} | null

type PwaUpdateContextValue = {
  needRefresh: boolean
  checking: boolean
  bannerDismissed: boolean
  toast: PwaToast
  checkForUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  dismissBanner: () => void
  dismissToast: () => void
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null)

const CHECK_INTERVAL_MS = 30 * 60 * 1000

function notifyUpdateAvailable() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification('Nueva versión de PLOT', {
      body: 'Hay una actualización lista. Tocá «Actualizar» en la barra superior.',
      icon: '/vite.svg',
      tag: 'pwa-update'
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* ignore */
  }
}

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const swRegistrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const needRefreshRef = useRef(false)
  const [checking, setChecking] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [toast, setToast] = useState<PwaToast>(null)
  const toastIdRef = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdRef.current
    setToast({ id, message, type })
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current))
    }, 4500)
  }, [])

  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: false,
    onRegistered(registration) {
      swRegistrationRef.current = registration
      window.setTimeout(() => {
        registration?.update().catch(() => {})
      }, 8000)
    },
    onNeedRefresh() {
      setBannerDismissed(false)
      notifyUpdateAvailable()
    }
  })

  useEffect(() => {
    needRefreshRef.current = needRefresh
    if (needRefresh) setChecking(false)
  }, [needRefresh])

  useEffect(() => {
    const interval = window.setInterval(() => {
      swRegistrationRef.current?.update().catch(() => {})
    }, CHECK_INTERVAL_MS)

    let focusDebounce: number | undefined
    const onFocus = () => {
      if (focusDebounce !== undefined) window.clearTimeout(focusDebounce)
      focusDebounce = window.setTimeout(() => {
        swRegistrationRef.current?.update().catch(() => {})
      }, 2000)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(interval)
      if (focusDebounce) window.clearTimeout(focusDebounce)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const applyUpdate = useCallback(async () => {
    try {
      await updateServiceWorker(true)
    } finally {
      window.location.reload()
    }
  }, [updateServiceWorker])

  const checkForUpdate = useCallback(async () => {
    if (needRefreshRef.current) {
      await applyUpdate()
      return
    }

    setChecking(true)
    try {
      await updateServiceWorker(false)
      await swRegistrationRef.current?.update()
      await new Promise((resolve) => window.setTimeout(resolve, 1200))

      if (needRefreshRef.current) {
        showToast('Nueva versión detectada. Tocá «Actualizar ahora».', 'info')
      } else {
        showToast('Ya tenés la última versión instalada.', 'success')
      }
    } catch {
      showToast('No se pudo buscar actualizaciones. Intentá de nuevo.', 'error')
    } finally {
      setChecking(false)
    }
  }, [applyUpdate, showToast, updateServiceWorker])

  const dismissBanner = useCallback(() => setBannerDismissed(true), [])
  const dismissToast = useCallback(() => setToast(null), [])

  return (
    <PwaUpdateContext.Provider
      value={{
        needRefresh,
        checking,
        bannerDismissed,
        toast,
        checkForUpdate,
        applyUpdate,
        dismissBanner,
        dismissToast
      }}
    >
      {children}
    </PwaUpdateContext.Provider>
  )
}

export function usePwaUpdate() {
  const ctx = useContext(PwaUpdateContext)
  if (!ctx) {
    throw new Error('usePwaUpdate debe usarse dentro de PwaUpdateProvider')
  }
  return ctx
}

export function usePwaUpdateOptional() {
  return useContext(PwaUpdateContext)
}
