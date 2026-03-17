import { useRegisterSW } from 'virtual:pwa-register/react'

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

  if (!needRefresh) return null

  return (
    <button
      type="button"
      className={className}
      onClick={() => updateServiceWorker(true)}
      title="Hay una nueva versión disponible. Actualizar."
    >
      ⟳ Actualizar app
    </button>
  )
}

