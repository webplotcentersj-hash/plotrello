import { useState, useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import { useClienteNotificacionesBadge } from '../hooks/useClienteNotificacionesBadge'
import apiService from '../services/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import { metaNotificacionCliente } from '../utils/clienteNotificacionUi'
import './ClienteNotificacionesPage.css'

type NotifRecord = {
  id: number
  tipo: string
  titulo: string | null
  mensaje: string
  id_pedido: number | null
  id_reclamo: number | null
  leida: boolean
  created_at: string
}

export default function ClienteNotificacionesPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const { refresh: refreshBadge } = useClienteNotificacionesBadge()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<NotifRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    void loadNotifs()
  }, [cliente, authLoading, navigate])

  useEffect(() => {
    if (!cliente?.id) return
    return () => {
      void apiService.marcarNotificacionesClienteLeidas(cliente.id).then(() => refreshBadge())
    }
  }, [cliente?.id, refreshBadge])

  const loadNotifs = async () => {
    if (!cliente) return
    setLoading(true)
    try {
      const res = await apiService.listarNotificacionesCliente(cliente.id)
      if (res.success && res.data) {
        setNotifs(res.data)
      }
    } catch (err) {
      console.error('Error cargando notificaciones:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatFecha = (s: string) => {
    try {
      const d = new Date(s)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      const min = Math.floor(diff / 60000)
      const h = Math.floor(min / 60)
      const dias = Math.floor(h / 24)
      if (min < 1) return 'Ahora'
      if (min < 60) return `Hace ${min} min`
      if (h < 24) return `Hace ${h} h`
      if (dias < 7) return `Hace ${dias} días`
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return s
    }
  }

  const noLeidasVisuales = notifs.filter((n) => !n.leida).length

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-notifs-page">
      <ClientePageHeader
        eyebrow="Avisos"
        title="Notificaciones"
        subtitle="Novedades sobre tus pedidos y reclamos"
        actions={
          noLeidasVisuales > 0 ? (
            <span className="cliente-notifs-header-badge" aria-live="polite">
              {noLeidasVisuales} nueva{noLeidasVisuales === 1 ? '' : 's'}
            </span>
          ) : notifs.length > 0 ? (
            <span className="cliente-notifs-header-badge cliente-notifs-header-badge--muted">
              Al día
            </span>
          ) : null
        }
      />

      {notifs.length === 0 ? (
        <div className="cliente-page-empty">
          <p>No tenés notificaciones.</p>
        </div>
      ) : (
        <div className="notifs-list">
          {notifs.map((n) => {
            const meta = metaNotificacionCliente(n.tipo)
            const unread = !n.leida
            return (
              <div
                key={n.id}
                className={`cliente-page-card notif-card ${unread ? 'notif-card--unread' : 'notif-card--read'}`}
                style={
                  {
                    '--notif-accent': meta.accent,
                    '--notif-bg': meta.bg,
                    '--notif-border': meta.border
                  } as CSSProperties
                }
              >
                {unread && <span className="notif-card__dot" aria-hidden />}
                <div className="notif-header">
                  <span className="notif-tipo">{meta.label}</span>
                  <span className="notif-fecha">{formatFecha(n.created_at)}</span>
                </div>
                {n.titulo && <h4 className="notif-titulo">{n.titulo}</h4>}
                <p className="notif-mensaje">{n.mensaje}</p>
                {n.id_pedido && (
                  <button
                    type="button"
                    className="notif-card__cta"
                    onClick={() => navigate(`/cliente/pedido/${n.id_pedido}`)}
                  >
                    Ver pedido
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ClientePageLayout>
  )
}
