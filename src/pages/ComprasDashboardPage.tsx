import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './ComprasDashboardPage.css'

const CARGAR_MAS = 15

const ESTADOS = [
  'todos',
  'Pendiente',
  'En Revisión',
  'Aprobado',
  'En Compra',
  'En Viaje',
  'Completado',
  'Rechazado'
] as const

const PRIORIDADES = ['todos', 'Baja', 'Normal', 'Alta', 'Urgente'] as const

function getEstadoColor(estado: string): string {
  const colores: Record<string, string> = {
    Pendiente: '#f59e0b',
    'En Revisión': '#3b82f6',
    Aprobado: '#10b981',
    Rechazado: '#ef4444',
    'En Compra': '#8b5cf6',
    'En Viaje': '#22c55e',
    Completado: '#059669',
    Cancelado: '#6b7280'
  }
  return colores[estado] || '#6b7280'
}

function getPrioridadColor(prioridad: string): string {
  const colores: Record<string, string> = {
    Baja: '#6b7280',
    Normal: '#3b82f6',
    Alta: '#f59e0b',
    Urgente: '#ef4444'
  }
  return colores[prioridad] || '#6b7280'
}

export default function ComprasDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>(() =>
    location.pathname === '/compras/pedidos' ? 'Pendiente' : 'todos'
  )
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todos')
  const [buscar, setBuscar] = useState('')
  const [antiguosVisibles, setAntiguosVisibles] = useState(0)

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
      return
    }
    void loadPedidos()
  }, [canManageCompras, navigate, authLoading])

  useEffect(() => {
    setAntiguosVisibles(0)
  }, [filtroEstado, filtroPrioridad, buscar])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getPedidosCompra({})
      if (response.success && response.data) {
        setPedidos(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cutoff7d = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const pedidosFiltrados = useMemo(() => {
    let list = [...pedidos]
    if (filtroEstado !== 'todos') {
      list = list.filter((p) => p.estado === filtroEstado)
    }
    if (filtroPrioridad !== 'todos') {
      list = list.filter((p) => p.prioridad === filtroPrioridad)
    }
    const q = buscar.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.numero_pedido.toLowerCase().includes(q) ||
          p.nombre_solicitante.toLowerCase().includes(q) ||
          (p.motivo || '').toLowerCase().includes(q) ||
          (p.sector_solicitante || '').toLowerCase().includes(q)
      )
    }
    return list.sort(
      (a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime()
    )
  }, [pedidos, filtroEstado, filtroPrioridad, buscar])

  const { recientes, antiguos } = useMemo(() => {
    const r: PedidoCompra[] = []
    const a: PedidoCompra[] = []
    for (const p of pedidosFiltrados) {
      const f = new Date(p.fecha_solicitud)
      f.setHours(0, 0, 0, 0)
      if (f >= cutoff7d) r.push(p)
      else a.push(p)
    }
    return { recientes: r, antiguos: a }
  }, [pedidosFiltrados, cutoff7d])

  const pedidosVisibles = useMemo(
    () => [...recientes, ...antiguos.slice(0, antiguosVisibles)],
    [recientes, antiguos, antiguosVisibles]
  )

  const hayMasAntiguos = antiguosVisibles < antiguos.length
  const restantes = antiguos.length - antiguosVisibles

  const miniStats = useMemo(
    () => ({
      pendientes: pedidos.filter((p) => p.estado === 'Pendiente').length,
      ultimos7: pedidos.filter((p) => {
        const f = new Date(p.fecha_solicitud)
        f.setHours(0, 0, 0, 0)
        return f >= cutoff7d
      }).length
    }),
    [pedidos, cutoff7d]
  )

  if (authLoading || loading) {
    return (
      <div className="compras-dashboard-page">
        <div className="compras-dash-loading">
          <div className="compras-dash-spinner" />
          <span>Cargando pedidos…</span>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="compras-dashboard-page">
        <div className="compras-dash-error">
          <p>No tenés permiso para acceder a esta página.</p>
          <button type="button" className="cp-btn cp-btn--primary" onClick={() => navigate('/')}>
            Volver al tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="compras-dashboard-page">
      <header className="compras-dash-header">
        <div className="compras-dash-header__brand">
          <div className="compras-dash-header__icon" aria-hidden>
            🛒
          </div>
          <div>
            <p className="compras-dash-header__eyebrow">Plot Center · Compras</p>
            <h1>Pedidos de compra</h1>
            <p className="compras-dash-header__sub">
              {miniStats.ultimos7} pedidos en los últimos 7 días · {miniStats.pendientes} pendientes
            </p>
          </div>
        </div>
        <div className="compras-dash-header__actions">
          <button type="button" className="cp-btn cp-btn--primary" onClick={() => navigate('/compras/crear-pedido')}>
            + Nuevo pedido
          </button>
          <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/')}>
            ← Tablero
          </button>
        </div>
      </header>

      <nav className="compras-dash-nav" aria-label="Accesos compras">
        <div className="compras-dash-nav__group">
          <span className="compras-dash-nav__label">Operación</span>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/gestion-stock')}>
            📦 Stock
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/proveedores')}>
            🏢 Proveedores
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/deudas-proveedores')}>
            💳 Deudas proveedores
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/pagos-proveedores')}>
            💸 Pagos proveedores
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/movimientos-proveedores')}>
            📒 Movimientos proveedores
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/deuda-cc-proveedores')}>
            📑 Deuda CC proveedores
          </button>
        </div>
        <div className="compras-dash-nav__group">
          <span className="compras-dash-nav__label">Análisis</span>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/estadisticas')}>
            📊 Estadísticas
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/reportes')}>
            📋 Reportes
          </button>
        </div>
      </nav>

      <section className="pedidos-section">
        <div className="pedidos-section__head">
          <div>
            <h2>
              {filtroEstado === 'Pendiente' ? 'Pedidos pendientes' : 'Pedidos recientes'}
              <span className="pedidos-section-count">
                {' '}
                ({pedidosVisibles.length}
                {antiguos.length > 0 && antiguosVisibles < antiguos.length ? ` de ${pedidosFiltrados.length}` : ''})
              </span>
            </h2>
            <p className="pedidos-section__hint">
              Por defecto se muestran los últimos 7 días. Los anteriores se cargan bajo demanda.
            </p>
          </div>
          <button type="button" className="cp-btn cp-btn--secondary cp-btn--sm" onClick={() => void loadPedidos()}>
            Actualizar
          </button>
        </div>

        <div className="pedidos-toolbar">
          <label className="pedidos-search">
            <span className="pedidos-search__icon" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              placeholder="Buscar N° pedido, solicitante, motivo, sector…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              autoComplete="off"
            />
            {buscar && (
              <button type="button" className="pedidos-search__clear" onClick={() => setBuscar('')} aria-label="Limpiar">
                ✕
              </button>
            )}
          </label>

          <div className="pedidos-filters">
            <label className="pedidos-filter-field">
              <span>Estado</span>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e === 'todos' ? 'Todos' : e}
                  </option>
                ))}
              </select>
            </label>
            <label className="pedidos-filter-field">
              <span>Prioridad</span>
              <select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p === 'todos' ? 'Todas' : p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pedidos-chips">
            {ESTADOS.filter((e) => e !== 'todos').map((estado) => {
              const count = pedidos.filter((p) => p.estado === estado).length
              if (count === 0) return null
              return (
                <button
                  key={estado}
                  type="button"
                  className={`pedidos-chip ${filtroEstado === estado ? 'pedidos-chip--active' : ''}`}
                  onClick={() => setFiltroEstado(filtroEstado === estado ? 'todos' : estado)}
                >
                  {estado} <em>{count}</em>
                </button>
              )
            })}
          </div>
        </div>

        {pedidosVisibles.length === 0 ? (
          <div className="empty-state">
            <p>No hay pedidos para mostrar con estos filtros.</p>
            {(buscar || filtroEstado !== 'todos' || filtroPrioridad !== 'todos') && (
              <button
                type="button"
                className="cp-btn cp-btn--ghost"
                onClick={() => {
                  setBuscar('')
                  setFiltroEstado('todos')
                  setFiltroPrioridad('todos')
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="pedidos-list">
              {recientes.length > 0 && antiguosVisibles > 0 && (
                <p className="pedidos-list__divider-label">Últimos 7 días</p>
              )}
              {pedidosVisibles.map((pedido, idx) => {
                const showDivider =
                  antiguosVisibles > 0 &&
                  idx === recientes.length &&
                  recientes.length > 0 &&
                  antiguos.length > 0
                return (
                  <div key={pedido.id}>
                    {showDivider && <p className="pedidos-list__divider-label">Pedidos anteriores</p>}
                    <article
                      className="pedido-card"
                      onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/compras/pedidos/${pedido.id}`)
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="pedido-header">
                        <div className="pedido-numero">
                          <strong>{pedido.numero_pedido}</strong>
                          {pedido.sector_solicitante && (
                            <span className="pedido-sector">{pedido.sector_solicitante}</span>
                          )}
                        </div>
                        <div className="pedido-header__badges">
                          <span
                            className="pedido-prioridad"
                            style={{ color: getPrioridadColor(pedido.prioridad) }}
                          >
                            {pedido.prioridad}
                          </span>
                          <span
                            className="pedido-estado"
                            style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                          >
                            {pedido.estado}
                          </span>
                        </div>
                      </div>
                      <div className="pedido-info">
                        <div className="info-row">
                          <span className="label">Solicitante</span>
                          <span>{pedido.nombre_solicitante}</span>
                        </div>
                        <div className="info-row">
                          <span className="label">Items</span>
                          <span>{pedido.items?.length || 0} productos</span>
                        </div>
                        <div className="info-row">
                          <span className="label">Fecha</span>
                          <span>{new Date(pedido.fecha_solicitud).toLocaleDateString('es-AR')}</span>
                        </div>
                      </div>
                      {pedido.motivo && (
                        <div className="pedido-motivo">
                          <strong>Motivo:</strong> {pedido.motivo}
                        </div>
                      )}
                    </article>
                  </div>
                )
              })}
            </div>

            {antiguos.length > 0 && hayMasAntiguos && (
              <div className="pedidos-load-more">
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() => setAntiguosVisibles((v) => v + CARGAR_MAS)}
                >
                  Cargar más pedidos anteriores ({Math.min(CARGAR_MAS, restantes)} de {restantes})
                </button>
              </div>
            )}

            {antiguos.length > 0 && antiguosVisibles === 0 && recientes.length > 0 && (
              <div className="pedidos-load-more">
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() => setAntiguosVisibles(CARGAR_MAS)}
                >
                  Ver pedidos anteriores a 7 días ({antiguos.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
