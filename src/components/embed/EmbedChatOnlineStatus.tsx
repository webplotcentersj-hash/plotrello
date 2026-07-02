import { useEmbedAvailability, type EmbedAvailabilityStatus } from '../../hooks/useEmbedAvailability'
import { isPlotCenterBusinessHours } from '../../utils/plotCenterBusinessHours'
import './EmbedChatOnlineStatus.css'

function resolveStatus(
  availability: ReturnType<typeof useEmbedAvailability>['availability']
): EmbedAvailabilityStatus {
  if (availability?.status) return availability.status
  return isPlotCenterBusinessHours() ? 'hours' : 'away'
}

function resolveLabel(
  availability: ReturnType<typeof useEmbedAvailability>['availability'],
  status: EmbedAvailabilityStatus
): string {
  if (availability?.label) return availability.label
  if (status === 'hours') return 'Horario de atención'
  return 'Fuera de horario'
}

type EmbedChatOnlineStatusProps = {
  /** Solo punto (botón flotante del widget). */
  dotOnly?: boolean
  className?: string
}

export function EmbedChatOnlineStatus({ dotOnly, className }: EmbedChatOnlineStatusProps) {
  const { availability } = useEmbedAvailability()
  const status = resolveStatus(availability)
  const label = resolveLabel(availability, status)
  const hint = availability?.hint ?? ''

  if (dotOnly) {
    if (status !== 'staff') return null
    return (
      <span
        className={`embed-online-dot embed-online-dot--staff${className ? ` ${className}` : ''}`}
        title={hint || 'Equipo en línea'}
        aria-label="Equipo en línea"
      />
    )
  }

  return (
    <span
      className={`embed-online-status embed-online-status--${status}${className ? ` ${className}` : ''}`}
      title={hint}
    >
      <span className="embed-online-status-dot" aria-hidden />
      <span className="embed-online-status-label">{label}</span>
    </span>
  )
}
