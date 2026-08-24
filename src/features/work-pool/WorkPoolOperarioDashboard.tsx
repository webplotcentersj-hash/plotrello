import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Inbox, LogOut, MessageCircle, Wallet, Briefcase } from 'lucide-react'
import type { Notification } from '../../types/api'
import type { WorkPoolJob, WorkPoolProduct, WorkPoolSaldoOperario } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS } from '../../types/workPool'
import apiService from '../../services/api'
import { nombreVisibleDesdeRecord } from '../../utils/usuarioDisplayName'
import { PHI_PUBLIC_URL } from '../../utils/phiPublicUrl'
import { WORK_POOL_PRODUCT_CONFIG } from './workPoolConfig'
import { filtrarNotificacionesOperarioExterno } from './operarioExternoNotificaciones'
import { jobPedidoLabel, maskJobForOperarioExterno } from './workPoolOperarioExterno'
import WorkPoolOperarioMensajes from './WorkPoolOperarioMensajes'
import '../phi/phi-landing.css'
import './WorkPoolOperarioDashboard.css'

const ONEST_FONT =
  'https://fonts.googleapis.com/css2?family=Onest:wght@500;700;800&display=swap'

const PLOT_LOGO = '/plot-lab-logo.png'

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
  onTomar: (jobId: number) => void
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
  { title: string; icon: ReactNode; description: (d: Date) => string }
> = {
  mis: {
    title: 'Entrantes',
    icon: <Inbox size={20} strokeWidth={2.25} aria-hidden />,
    description: (d) => `Bolsa y tus trabajos · ${formatTime(d)}`
  },
  mensajes: {
    title: 'Mensajes',
    icon: <MessageCircle size={20} strokeWidth={2.25} aria-hidden />,
    description: (d) => `Pedidos portal · ${formatTime(d)}`
  },
  cuenta: {
    title: 'Mi cuenta',
    icon: <Wallet size={20} strokeWidth={2.25} aria-hidden />,
    description: (d) => `Saldo Plot · ${formatTime(d)}`
  }
}

const NAV: Array<{ id: OperarioDashView; label: string; icon: ReactNode }> = [
  { id: 'mis', label: 'Entrantes', icon: <Inbox size={18} strokeWidth={2} aria-hidden /> },
  { id: 'mensajes', label: 'Mensajes', icon: <MessageCircle size={18} strokeWidth={2} aria-hidden /> },
  { id: 'cuenta', label: 'Mi cuenta', icon: <Wallet size={18} strokeWidth={2} aria-hidden /> }
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
  onTomar,
  pedidoMensajesInicial,
  onUnreadChange,
  lastUpdated
}: Props) {
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]
  const [now, setNow] = useState(() => new Date())
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    document.title = `Panel operario · phi (φ) ${cfg.label}`

    let link = document.querySelector<HTMLLinkElement>('link[data-phi-font]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ONEST_FONT
      link.setAttribute('data-phi-font', 'true')
      document.head.appendChild(link)
    }
  }, [cfg.label])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    void apiService.getUserNotifications(usuario.id, 20).then((res) => {
      if (res.success && res.data) {
        setNotifications(filtrarNotificacionesOperarioExterno(res.data).slice(0, 8))
      }
    })
  }, [usuario.id, view, lastUpdated])

  const maskedJobs = useMemo(() => jobs.map((j) => maskJobForOperarioExterno(j)), [jobs])

  const bolsaJobs = useMemo(
    () => maskedJobs.filter((j) => j.estado === 'disponible'),
    [maskedJobs]
  )
  const misJobs = useMemo(
    () => maskedJobs.filter((j) => j.estado !== 'disponible'),
    [maskedJobs]
  )

  const activos = misJobs.filter((j) =>
    ['asignado', 'en_curso', 'cambios'].includes(j.estado)
  ).length
  const entregados = misJobs.filter((j) =>
    ['entregado', 'en_revision', 'aprobado'].includes(j.estado)
  ).length

  const meta = VIEW_META[view]
  const dateInfo = formatDateParts(now)
  const productLabel = product === 'plot-design' ? 'Plot Design' : 'Bolsa Plot'
  const unreadNotifs = notifications.filter((n) => !n.is_read).length

  const renderJobCard = (job: WorkPoolJob, opts: { canTomar?: boolean; canEntregar?: boolean }) => {
    const pedidoLabel = jobPedidoLabel(job)
    const isEntrante = Boolean(opts.canTomar)
    return (
      <article
        key={job.id}
        className={`wp-operario-dash__job${isEntrante ? ' wp-operario-dash__job--entrante' : ''}`}
      >
        <header className="wp-operario-dash__job-head">
          <h3 className="wp-operario-dash__job-title">
            <span className="wp-operario-dash__bullet" aria-hidden />
            {job.titulo}
          </h3>
          <div className="wp-operario-dash__job-head-tags">
            {isEntrante ? (
              <span className="wp-operario-dash__job-pill-nuevo">Nuevo</span>
            ) : null}
            <span className={`wp-operario-dash__job-badge wp-operario-dash__job-badge--${job.estado}`}>
              {WORK_POOL_ESTADO_LABELS[job.estado]}
            </span>
          </div>
        </header>
        <div className="wp-operario-dash__job-body">
          {job.descripcion && <p className="wp-operario-dash__job-desc">{job.descripcion}</p>}
          <div className="wp-operario-dash__job-meta">
            {pedidoLabel && <span>Pedido {pedidoLabel}</span>}
            <span className={isEntrante ? 'wp-operario-dash__job-monto' : undefined}>
              {formatArs(job.monto_presupuestado)}
            </span>
            {job.plazo && <span>Plazo {job.plazo}</span>}
          </div>
          {(opts.canTomar || opts.canEntregar) && (
            <div className="wp-operario-dash__job-actions">
              {opts.canTomar ? (
                <button
                  type="button"
                  className="phi-btn phi-btn--dark wp-operario-dash__btn wp-operario-dash__btn--tomar"
                  onClick={() => onTomar(job.id)}
                >
                  Tomar ahora
                </button>
              ) : null}
              {opts.canEntregar ? (
                <button
                  type="button"
                  className="phi-btn phi-btn--dark wp-operario-dash__btn"
                  onClick={() => onEntregar(job.id)}
                >
                  Marcar entregado
                </button>
              ) : null}
            </div>
          )}
        </div>
      </article>
    )
  }

  const renderJobs = () => {
    if (loading) {
      return <p className="wp-operario-dash__empty">Cargando trabajos…</p>
    }
    if (bolsaJobs.length === 0 && misJobs.length === 0) {
      return (
        <div className="wp-operario-dash__empty">
          <p>No hay trabajos en bolsa ni asignados todavía.</p>
          <p style={{ marginTop: 8, fontSize: '0.78rem' }}>
            Cuando Plot publique en bolsa, van a aparecer acá para que los tomes.
          </p>
        </div>
      )
    }

    return (
      <div className="wp-operario-dash__jobs">
        {bolsaJobs.length > 0 ? (
          <section className="wp-operario-dash__jobs-section wp-operario-dash__jobs-section--hot">
            <div className="wp-operario-dash__jobs-section-banner">
              <h2 className="wp-operario-dash__jobs-section-title">
                <Briefcase size={18} aria-hidden />
                Trabajos entrantes
                <span className="wp-operario-dash__jobs-section-count is-pulse">
                  {bolsaJobs.length}
                </span>
              </h2>
              <p className="wp-operario-dash__jobs-section-hint">
                Publicados en bolsa · tomalos antes que otro operario
              </p>
            </div>
            {bolsaJobs.map((job) => renderJobCard(job, { canTomar: true }))}
          </section>
        ) : (
          <section className="wp-operario-dash__jobs-section">
            <h2 className="wp-operario-dash__jobs-section-title">
              <Briefcase size={16} aria-hidden />
              Trabajos entrantes
            </h2>
            <p className="wp-operario-dash__empty" style={{ padding: '0.75rem 0' }}>
              No hay trabajos libres ahora.
            </p>
          </section>
        )}

        <section className="wp-operario-dash__jobs-section">
          <h2 className="wp-operario-dash__jobs-section-title">
            <Inbox size={16} aria-hidden />
            Tus trabajos
            {misJobs.length > 0 ? (
              <span className="wp-operario-dash__jobs-section-count">{misJobs.length}</span>
            ) : null}
          </h2>
          {misJobs.length === 0 ? (
            <p className="wp-operario-dash__empty" style={{ padding: '0.75rem 0' }}>
              Todavía no tomaste ni te asignaron trabajos.
            </p>
          ) : (
            misJobs.map((job) =>
              renderJobCard(job, {
                canEntregar: ['en_curso', 'asignado', 'cambios'].includes(job.estado)
              })
            )
          )}
        </section>
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
          <div
            className={`wp-operario-dash__stat${
              bolsaJobs.length > 0 ? ' wp-operario-dash__stat--hot' : ''
            }`}
          >
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                En bolsa
              </span>
              <span>{cfg.icon}</span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value wp-operario-dash__stat-value--positive">
                {bolsaJobs.length}
              </div>
              <p className="wp-operario-dash__stat-desc">
                {bolsaJobs.length > 0 ? '¡Nuevos para tomar!' : 'Disponibles para tomar'}
              </p>
            </div>
          </div>
          <div className="wp-operario-dash__stat">
            <div className="wp-operario-dash__stat-head">
              <span>
                <span className="wp-operario-dash__bullet" />
                Activos
              </span>
            </div>
            <div className="wp-operario-dash__stat-body">
              <div className="wp-operario-dash__stat-value">{activos}</div>
              <p className="wp-operario-dash__stat-desc">En curso o asignados</p>
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
    <div
      className={`phi-root wp-operario-dash wp-operario-dash--${
        product === 'plot-design' ? 'plot-design' : 'bolsa-plot'
      }`}
    >
      <div className="phi-nav-wrap wp-operario-dash__top-nav">
        <nav className="phi-nav" aria-label="phi operario">
          <a href={PHI_PUBLIC_URL} className="phi-nav-logo" aria-label="Volver a phi">
            <span className="phi-nav-logo-symbol">φ</span>
          </a>
          <div className="phi-nav-links">
            <span className="wp-operario-dash__nav-pill">{productLabel}</span>
          </div>
          <button
            type="button"
            className="phi-btn phi-btn--dark phi-btn--icon wp-operario-dash__nav-logout"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <LogOut size={20} strokeWidth={2.25} aria-hidden />
            <span className="phi-sr-only">Cerrar sesión</span>
          </button>
        </nav>
      </div>

      <nav className="wp-operario-dash__mobile-nav" aria-label="Secciones">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'is-active' : ''}
            onClick={() => onChangeView(item.id)}
          >
            {item.label}
            {item.id === 'mis' && bolsaJobs.length > 0 && ` (${bolsaJobs.length})`}
            {item.id === 'mensajes' && mensajesNoLeidos > 0 && ` (${mensajesNoLeidos})`}
          </button>
        ))}
      </nav>

      <div className="wp-operario-dash__grid">
        <aside className="wp-operario-dash__sidebar">
          <div className="wp-operario-dash__brand">
            <img src={PLOT_LOGO} alt="Plot Center" className="wp-operario-dash__brand-logo" />
            <div>
              <p className="wp-operario-dash__brand-eyebrow">phi (φ) · {cfg.label}</p>
              <p className="wp-operario-dash__brand-title">Panel externo</p>
              <p className="wp-operario-dash__brand-sub">{nombreVisibleDesdeRecord(usuario)}</p>
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
                <span className="wp-operario-dash__nav-icon">{item.icon}</span>
                {item.label}
                {item.id === 'mis' && bolsaJobs.length > 0 && (
                  <span className="wp-operario-dash__nav-badge wp-operario-dash__nav-badge--hot">
                    {bolsaJobs.length > 9 ? '9+' : bolsaJobs.length}
                  </span>
                )}
                {item.id === 'mensajes' && mensajesNoLeidos > 0 && (
                  <span className="wp-operario-dash__nav-badge">
                    {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="wp-operario-dash__user">
            <div className="wp-operario-dash__user-rol">{productLabel} · operario externo</div>
            <button type="button" className="phi-btn phi-btn--outline phi-btn--block wp-operario-dash__logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="wp-operario-dash__main">
          <header className="wp-operario-dash__page-head">
            <div className="wp-operario-dash__page-icon">{meta.icon}</div>
            <h1 className="wp-operario-dash__page-title">
              {meta.title}
            </h1>
            <span className="wp-operario-dash__page-meta">{meta.description(lastUpdated)}</span>
          </header>

          <div className="wp-operario-dash__content">
            {view === 'mis' && bolsaJobs.length > 0 && (
              <div className="wp-operario-dash__alert wp-operario-dash__alert--hot" role="status">
                <strong>
                  {bolsaJobs.length === 1
                    ? 'Hay 1 trabajo nuevo en bolsa'
                    : `Hay ${bolsaJobs.length} trabajos nuevos en bolsa`}
                </strong>
                <span> · revisá abajo y tomá el que puedas hacer</span>
              </div>
            )}
            {view === 'mis' && bolsaJobs.length === 0 && (
              <div className="wp-operario-dash__alert wp-operario-dash__alert--info">
                En bolsa ves los trabajos publicados por Plot. Podés tomarlos o esperar una asignación
                directa. No se muestran teléfono, dirección ni OP; solo el pedido portal cuando corresponde.
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
                <span className="wp-operario-dash__widget-muted">{dateInfo.weekday}</span>
                <span>{dateInfo.rest}</span>
              </div>
              <div className="wp-operario-dash__widget-time">{formatTime(now)}</div>
              <div className="wp-operario-dash__widget-row">
                <span className="wp-operario-dash__widget-muted">San Juan, AR</span>
                <span className="wp-operario-dash__widget-tag">{productLabel}</span>
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
