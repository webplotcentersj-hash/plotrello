import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'

type PwaUpdateButtonProps = {
  className?: string
}

export default function PwaUpdateButton({ className }: PwaUpdateButtonProps) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: false
  })

  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (needRefresh) setChecking(false)
  }, [needRefresh])

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (needRefresh) {
          try {
            await updateServiceWorker(true)
          } finally {
            // Forzar recarga total incluso si SW no activa de inmediato
            window.location.reload()
          }
          return
        }
        setChecking(true)
        try {
          // Intenta buscar una nueva versión sin recargar.
          await updateServiceWorker(false)
          setTimeout(() => {
            // Si no apareció el flag de actualización, avisar.
            if (!needRefresh) {
              // Fallback: pedir al navegador que actualice el SW si existe.
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {})
              }
              window.alert('No hay actualizaciones disponibles (o todavía no fueron detectadas).')
              setChecking(false)
            }
          }, 1200)
        } catch {
          window.alert('No se pudo buscar actualización. Intenta de nuevo.')
          setChecking(false)
        }
      }}
      title={
        needRefresh
          ? 'Hay una nueva versión disponible. Actualizar.'
          : 'Buscar si hay una nueva versión disponible.'
      }
    >
      {needRefresh ? '⟳ Actualizar app' : checking ? '⟳ Buscando…' : '⟳ Actualizar app'}
    </button>
  )
}

