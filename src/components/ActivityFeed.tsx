import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ActivityEvent, TeamMember } from '../types/board'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import { useUsuariosDisplay } from '../hooks/useUsuariosDisplay'
import './ActivityFeed.css'

type ActivityFeedProps = {
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
}

const ActivityFeed = ({ activity, teamMembers }: ActivityFeedProps) => {
  useUsuariosDisplay()
  const getMember = (id: string) => teamMembers.find((member) => member.id === id)

  return (
    <section className="activity-feed">
      <header>
        <div>
          <p className="panel-title">Movimiento reciente</p>
          <h3>Bitácora de trabajadores</h3>
        </div>
        <span>{activity.length} eventos</span>
      </header>

      <ul>
        {activity.slice(0, 6).map((event) => {
          const member = getMember(event.actorId)
          const actorIdNum = Number(event.actorId)
          const displayName =
            member?.name?.trim() ||
            (event.actorName ? etiquetaUsuarioNombre(event.actorName, Number.isFinite(actorIdNum) ? actorIdNum : null) : null) ||
            (event.actorId && event.actorId !== '0' ? `Usuario #${event.actorId}` : null) ||
            'Equipo'
          const avatar =
            member?.avatar ??
            (displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : 'TP')
          return (
            <li key={event.id}>
              <div className="feed-avatar">{avatar}</div>
              <div className="feed-body">
                <strong>{displayName}</strong>
                <p>
                  movió <span>{event.taskId}</span> de {event.from} a {event.to}
                </p>
                <small>{event.note}</small>
              </div>
              <time>
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                  locale: es
                })}
              </time>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ActivityFeed


