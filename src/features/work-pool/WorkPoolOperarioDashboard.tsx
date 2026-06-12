import { useEffect, useMemo, useState } from 'react'
import type { Notification } from '../../types/api'
import type { WorkPoolJob, WorkPoolProduct, WorkPoolSaldoOperario } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS } from '../../types/workPool'
import apiService from '../../services/api'
import { WORK_POOL_PRODUCT_CONFIG } from './workPoolConfig'
import { jobPedidoLabel, maskJobForOperarioExterno } from './workPoolOperarioExterno'
import WorkPoolOperarioMensajes from './WorkPoolOperarioMensajes'
import './WorkPoolOperarioDashboard.css'

const PLOT_LOGO = 'https://trello.plotcenter.com.ar/Group%20187.png'

export type OperarioDashView = 'mis' | 'mensajes' | 'cuenta'

type Props = {
  product: WorkPoolProduct
  usuario: { id: number; nombre: string; rol: string }
  view: OperarioDashView
  onChangeView: (view: OperarioDashView) => void
  onLogout: () => void
  jobs: WorkPoolJob[]
  loading: boolean
  error: string
  saldo: WorkPoolSaldoOperario
  mensajesNoLeidos: number
  onEntregar: (jobId: number) => void
  pedidoMensajesInicial: number | null
  onUnreadChange: (count: number) => void
  lastUpdated: Date
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(n)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateParts(date: Date) {
  return {
    weekday: date.toLocaleDateString('es-AR', { weekday: 'long' }),
    rest: date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
}

const VIEW_META: Record<
  OperarioDashView,
  { title: string; icon: string; description: (d: Date) => string }
> = {
  mis: {
    title: 'Entrantes',
    icon: '📥',
    description: (d) => `Actualizado ${formatTime(d)}`
  },
  mensajes: {
    title: 'Mensajes',
    icon: '💬',
    description: (d) => `Pedidos portal · ${formatTime(d)}`
  },
  cuenta: {
    title: 'Mi cuenta',
    icon: '💰',
    description: (d) => `Saldo Plot · ${formatTime(d)}`
  }
}

const NAV: Array<{ id: OperarioDashView; label: string; icon: string }> = [
  { id: 'mis', label: 'Entrantes', icon: '📥' },
  { id: 'mensajes', label: 'Mensajes', icon: '💬' },
  { id: 'cuenta', label: 'Mi cuenta', icon: '💰' }
]

export default function WorkPoolOperarioDashboard({
  product,
  usuario,
  view,
  onChangeView,
  onLogout,
  jobs,
  loading,
  error,
  saldo,
  mensajesNoLeidos,
  onEntregar,
  pedidoMensajesInicial,
  onUnreadChange,
  lastUpdated
}: Props) {
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]
  const [now, setNow] = useState(() => new Date())
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    void apiService.getUserNotifications(usuario.id, 8).then((res) => {
      if (res.success && res.data) setNotifications(res.data)
    })
  }, [usuario.id, view, lastUpdated])

  const maskedJobs = useMemo(() => jobs.map((j) => maskJobForOperarioExterno(j)), [jobs])

  const activos = maskedJobs.filter((j) =>
    ['asignado', 'en_curso', 'cambios'].includes(j.estado)
  ).length
  const entregados = maskedJobs.filter((j) =>
    ['entregado', 'en_revision', 'aprobado'].includes(j.estado)
  ).length

  const meta = VIEW_META[view]
  const dateInfo = formatDateParts(now)
  const productLabel = product === 'plot-design' ? 'Plot Design' : 'Bolsa Plot'
  const unreadNotifs = notifications.filter((n) => !n.is_read).length

  const renderJobs = () => {
    if (loading) {
      return <p className="wp-operario-dash__empty">Cargando trabajos…</p>
    }
    if (maskedJobs.length === 0) {
      return (
        <div className="wp-operario-dash__empty">
          <p>Todavía no tenés trabajos asignados.</p>
          <p style={{ marginTop: 8, fontSize: '0.78rem' }}>
            El equipo de {productLabel} te enviará pedidos desde el panel de publicación.
          </p>
        </div>
      )
    }

    return (
      <div className="wp-operario-dash__jobs">
        {maskedJobs.map((job) => {
          const pedidoLabel = jobPedidoLabel(job)
          return (
            <article key={job.id} className="wp-operario-dash__job">
              <header className="wp-operario-dash__job-head">
                <h3 className="wp-operario-dash__job-title">
                  <span className="wp-operario-dash__bullet" aria-hidden />
                  {job.titulo}
                </h3>
                <span className={`wp-operario-dash__job-badge wp-operario-dash__job-badge--${job.estado}`}>
                  {WORK_POOL_ESTADO_LABELS[job.estado]}
                </span>
              </header>
              <div className="wp-operario-dash__job-body">
                {job.descripcion && <p className="wp-operario-dash__job-desc">{job.descripcion}</p>}
                <div className="wp-operario-dash__job-meta">
                  {pedidoLabel && <span>Pedido {pedidoLabel}</span>}
                  <span>{formatArs(job.monto_presupuestado)}</span>
                  {job.plazo && <span>Plazo {job.plazo}</span>}
                </div>
                {['en_curso', 'asignado', 'cambios'].includes(job.estado) && (
                  <div className="wp-operario-dash__job-actions">
                    <button
                      type="button"
                      className="wp-operario-dash__btn wp-operario-dash__btn--success"
                      onClick={() => onEntregar(job.id)}
                    >
                      Marcar entregado
                    </button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  const renderMain = () => {
    if (view === 'mensajes') {
      return (
        <WorkPoolOperarioMensajes
          idUsuario={usuario.id}
          product={product}
          pedidoInicial={pedidoMensajesInicial}
          onUnreadChange={onUnreadChange}
        />
      )
    }

    if (view === 'cuenta') {
      return (
        <div className="wp-operario-dash__cuenta-grid">
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Acreditado
              </span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value wp-operario-dash__stat-value--positive">
                {formatArs(saldo.acreditado)}
              </div>
              <p className="wp-operario-dash__stat-desc">Trabajos aprobados</p>
            </div>
          </div>
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Pagado
              </span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value">{formatArs(saldo.pagado)}</div>
              <p className="wp-operario-dash__stat-desc">Transferido a tu cuenta</p>
            </div>
          </div>
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Saldo pendiente
              </span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value wp-operario-dash__stat-value--accent">
                {formatArs(saldo.saldo_pendiente)}
              </div>
              <p className="wp-operario-dash__stat-desc">A cobrar por Plot Center</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="wp-operario-dash__stats">
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Activos
              </span>
              <span>{cfg.icon}</span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value wp-operario-dash__stat-value--accent">
                {activos}
              </div>
              <p className="wp-operario-dash__stat-desc">En curso o asignados</p>
            </div>
          </div>
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Saldo pendiente
              </span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value">{formatArs(saldo.saldo_pendiente)}</div>
              <p className="wp-operario-dash__stat-desc">Cuenta corriente Plot</p>
            </div>
          </div>
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Entregados
              </span>
              {entregados > 0 && <span className="wp-operario-dash__stat-tag">{entregados}</span>}
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value wp-operario-dash__stat-value--positive">
                {entregados}
              </div>
              <p className="wp-operario-dash__stat-desc">En revisión o aprobados</p>
            </div>
          </div>
        </div>
        {renderJobs()}
      </>
    )
  }

  return (
    <div className={`wp-operario-dash wp-operario-dash--${product === 'plot-design' ? 'plot-design' : 'bolsa-plot'}`}>
      <nav className="wp-operario-dash__mobile-nav" aria-label="Secciones">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'is-active' : ''}
            onClick={() => onChangeView(item.id)}
          >
            {item.label}
            {item.id === 'mensajes' && mensajesNoLeidos > 0 && ` (${mensajesNoLeidos})`}
          </button>
        ))}
      </nav>

      <div className="wp-operario-dash__grid">
        <aside className="wp-operario-dash__sidebar">
          <div className="wp-operario-dash__brand">
            <img src={PLOT_LOGO} alt="Plot Center" className="wp-operario-dash__brand-logo" />
            <div>
              <p className="wp-operario-dash__brand-title">{cfg.label}</p>
              <p className="wp-operario-dash__brand-sub">Panel operario externo</p>
            </div>
          </div>

          <div className="wp-operario-dash__nav-group">
            <div className="wp-operario-dash__nav-label">
              <span className="wp-operario-dash__bullet" />
              Menú
            </div>
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`wp-operario-dash__nav-btn${view === item.id ? ' is-active' : ''}`}
                onClick={() => onChangeView(item.id)}
              >
                <span className="wp-operario-dash__nav-icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
                {item.id === 'mensajes' && mensajesNoLeidos > 0 && (
                  <span className="wp-operario-dash__nav-badge">
                    {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="wp-operario-dash__user">
            <div className="wp-operario-dash__user-name">{usuario.nombre}</div>
            <div className="wp-operario-dash__user-rol">{productLabel} · externo</div>
            <button type="button" className="wp-operario-dash__logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="wp-operario-dash__main">
          <header className="wp-operario-dash__page-head">
            <div className="wp-operario-dash__page-icon" aria-hidden>
              {meta.icon}
            </div>
            <h1 className="wp-operario-dash__page-title">{meta.title}</h1>
            <span className="wp-operario-dash__page-meta">{meta.description(lastUpdated)}</span>
          </header>

          <div className="wp-operario-dash__content">
            {view === 'mis' && (
              <div className="wp-operario-dash__alert wp-operario-dash__alert--info">
                Los trabajos te los asigna Plot Center. No ves teléfono, dirección ni OP; solo el pedido
                portal cuando corresponde.
              </div>
            )}
            {error && <div className="wp-operario-dash__alert wp-operario-dash__alert--error">{error}</div>}
            {renderMain()}
          </div>
        </main>

        <aside className="wp-operario-dash__rail">
          <div className="wp-operario-dash__widget">
            <div className="wp-operario-dash__widget-bg" aria-hidden />
            <div className="wp-operario-dash__widget-inner">
              <div className="wp-operario-dash__widget-row">
                <span style={{ opacity: 0.6 }}>{dateInfo.weekday}</span>
                <span>{dateInfo.rest}</span>
              </div>
              <div className="wp-operario-dash__widget-time">{formatTime(now)}</div>
              <div className="wp-operario-dash__widget-row">
                <span style={{ opacity: 0.6 }}>San Juan, AR</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.08)'
                  }}
                >
                  {productLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="wp-operario-dash__panel">
            <div className="wp-operario-dash__panel-head">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadNotifs > 0 ? (
                  <span className="wp-operario-dash__nav-badge">{unreadNotifs}</span>
                ) : (
                  <span className="wp-operario-dash__bullet" />
                )}
                Notificaciones
              </span>
            </div>
            <div className="wp-operario-dash__panel-body">
              {notifications.length === 0 ? (
                <p className="wp-operario-dash__empty" style={{ padding: '1.5rem 0.5rem' }}>
                  Sin notificaciones
                </p>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className={`wp-operario-dash__notif${n.is_read ? '' : ' is-unread'}`}
                  >
                    <div className="wp-operario-dash__notif-title">{n.title}</div>
                    {n.description && (
                      <div className="wp-operario-dash__notif-desc">{n.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="wp-operario-dash__panel">
            <div className="wp-operario-dash__panel-head">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="wp-operario-dash__bullet" />
                Info
              </span>
            </div>
            <div className="wp-operario-dash__hint-card">
              <strong>Plot Center · {cfg.label}</strong>
              {cfg.tagline}
              <br />
              <br />
              Mensajes con clientes: sin compartir teléfono, email ni datos de contacto.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
