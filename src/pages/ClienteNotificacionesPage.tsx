import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
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
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<NotifRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadNotifs()
  }, [cliente, authLoading, navigate])

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

  if (authLoading || loading) {
    return (
      <div className="cliente-notifs-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-notifs-page">
      <header className="cliente-notifs-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img src="https://trello.plotcenter.com.ar/Group%20187.png" alt="Plot Center" />
            <h1>Notificaciones</h1>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/cliente/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <main className="cliente-notifs-main">
        {notifs.length === 0 ? (
          <div className="empty-state">
            <p>No tenés notificaciones.</p>
          </div>
        ) : (
          <div className="notifs-list">
            {notifs.map((n) => (
              <div key={n.id} className={`notif-card ${n.leida ? '' : 'unread'}`}>
                <div className="notif-header">
                  <span className="notif-tipo">{n.tipo}</span>
                  <span className="notif-fecha">{formatFecha(n.created_at)}</span>
                </div>
                {n.titulo && <h4 className="notif-titulo">{n.titulo}</h4>}
                <p className="notif-mensaje">{n.mensaje}</p>
                {n.id_pedido && (
                  <button
                    className="btn-link"
                    onClick={() => navigate(`/cliente/pedido/${n.id_pedido}`)}
                  >
                    Ver pedido
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
