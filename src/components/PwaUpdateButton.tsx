import clsx from 'clsx'
import { usePwaUpdateOptional } from '../contexts/PwaUpdateContext'
import './PwaUpdate.css'

type PwaUpdateButtonProps = {
  className?: string
}

export default function PwaUpdateButton({ className }: PwaUpdateButtonProps) {
  const pwa = usePwaUpdateOptional()

  if (!pwa) {
    return (
      <button type="button" className={className} disabled title="Actualizaciones no disponibles">
        ⟳ Versión
      </button>
    )
  }

  const { needRefresh, checking, checkForUpdate, applyUpdate } = pwa

  const label = needRefresh
    ? 'Actualizar'
    : checking
      ? 'Comprobando…'
      : 'App al día'

  const title = needRefresh
    ? 'Hay una nueva versión lista. Tocá para actualizar.'
    : checking
      ? 'Buscando actualizaciones en el servidor…'
      : 'Tu app está actualizada. Clic para buscar de nuevo.'

  return (
    <button
      type="button"
      className={clsx(
        className,
        needRefresh && 'header-util-btn--pwa-update-available',
        checking && 'header-util-btn--pwa-checking',
        !needRefresh && !checking && 'header-util-btn--pwa-idle'
      )}
      onClick={() => {
        if (needRefresh) void applyUpdate()
        else void checkForUpdate()
      }}
      disabled={checking}
      title={title}
      aria-label={title}
    >
      <span
        className={clsx('pwa-update-btn-icon', checking && 'pwa-update-btn-icon--spin')}
        aria-hidden
      >
        ⟳
      </span>{' '}
      {label}
      {needRefresh && (
        <span className="pwa-update-btn-badge" aria-hidden>
          <span className="pwa-update-btn-badge__dot" />
          <span className="pwa-update-btn-badge__label">NEW</span>
        </span>
      )}
    </button>
  )
}
