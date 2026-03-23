import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { ActivityEvent, Task, TaskStatus, TeamMember } from '../types/board'
import { movementByMember, statusDistribution, throughputSeries, workloadByMember } from '../utils/stats'
import './StatsPanel.css'

type StatsPanelProps = {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
}

const StatsPanel = ({ tasks, activity, teamMembers }: StatsPanelProps) => {
  const distribution = statusDistribution(tasks)
  const throughput = throughputSeries(activity, 7)
  const workload = workloadByMember(tasks, teamMembers)
  const movementLeaders = movementByMember(activity, teamMembers)

  const COMPLETED_STATUS: TaskStatus = 'almacen-entrega'
  const EXECUTION_STATUSES: TaskStatus[] = [
    'diseno-proceso',
    'imprenta',
    'taller-imprenta',
    'taller-grafico',
    'instalaciones',
    'metalurgica'
  ]

  const completedCount = distribution[COMPLETED_STATUS] ?? 0
  const executionCount = EXECUTION_STATUSES.reduce(
    (total, status) => total + (distribution[status] ?? 0),
    0
  )

  const completionRate = (completedCount / Math.max(tasks.length, 1)) * 100
  const focusIndicator = (executionCount / Math.max(tasks.length, 1)) * 100

  return (
    <section className="stats-panel">
      <header className="stats-panel__header">
        <div>
          <p className="panel-title">Estadísticas Trello Plot</p>
          <h3>Rendimiento del squad</h3>
        </div>
        <span className="pulse">viva · realtime</span>
      </header>

      <div className="stats-panel__body">
      <div className="metric-cards">
        <article>
          <span>Entrega confirmada</span>
          <strong>{completionRate.toFixed(0)}%</strong>
          <small>{completedCount} tarjetas entregadas</small>
        </article>
        <article>
          <span>Foco en producción</span>
          <strong>{focusIndicator.toFixed(0)}%</strong>
          <small>{executionCount} tarjetas en curso</small>
        </article>
      </div>

      <div className="chart-block">
        <div className="chart-head">
          <h4>Movimientos a done · últimos 7 días</h4>
          <span>{throughput.reduce((acc, item) => acc + item.total, 0)} entregas</span>
        </div>
        <ResponsiveContainer width="100%" height={96}>
          <AreaChart data={throughput} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eb671b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#eb671b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis stroke="var(--text-muted)" allowDecimals={false} width={22} tick={{ fontSize: 9 }} />
            <Tooltip
              contentStyle={{
                background: '#0f111c',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            />
            <Area type="monotone" dataKey="total" stroke="#eb671b" fill="url(#brandGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-block">
        <div className="chart-head">
          <h4>Carga por persona</h4>
          <span>Historias actuales</span>
        </div>
        <ResponsiveContainer width="100%" height={112}>
          <BarChart data={workload} margin={{ top: 2, right: 2, left: -16, bottom: 22 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="name"
              stroke="var(--text-muted)"
              tick={{ fontSize: 8 }}
              interval={0}
              angle={-22}
              textAnchor="end"
              height={32}
            />
            <YAxis stroke="var(--text-muted)" allowDecimals={false} width={22} tick={{ fontSize: 9 }} />
            <Tooltip
              contentStyle={{
                background: '#0f111c',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            />
            <Bar dataKey="total" fill="#ff914d" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="leaders">
        <h4>Movimientos destacados</h4>
        <ul>
          {movementLeaders.slice(0, 3).map((entry) => (
            <li key={entry.member.id}>
              <div className="leader-avatar">{entry.member.avatar}</div>
              <div>
                <strong>{entry.member.name}</strong>
                <small>{entry.member.role}</small>
              </div>
              <span>{entry.moves} cambios</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </section>
  )
}

export default StatsPanel

