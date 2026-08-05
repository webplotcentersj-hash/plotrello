import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './ComprasDashboardPage.css'

const CARGAR_MAS = 15
const INICIAL_TODOS = 30

const PERIODOS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último año' },
  { value: 'todos', label: 'Todo el historial' }
] as const

type PeriodoFiltro = (typeof PERIODOS)[number]['value']

function getCutoffPeriodo(periodo: PeriodoFiltro): Date | null {
  if (periodo === 'todos') return null
  const d = new Date()
  d.setDate(d.getDate() - Number(periodo))
  d.setHours(0, 0, 0, 0)
  return d
}

function getPeriodoLabel(periodo: PeriodoFiltro): string {
  return PERIODOS.find((p) => p.value === periodo)?.label ?? 'Últimos 7 días'
}

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

const SECTORES_META: Record<string, { icono: string; color: string }> = {
  'Taller Gráfico': { icono: '🧰', color: '#f97316' },
  'Taller de Imprenta': { icono: '🖨️', color: '#8b5cf6' },
  Metalúrgica: { icono: '⚙️', color: '#eab308' },
  Instalaciones: { icono: '🪜', color: '#06b6d4' },
  Administración: { icono: '📊', color: '#3b82f6' },
  'Diseño Gráfico': { icono: '🎨', color: '#ec4899' },
  Mostrador: { icono: '🏪', color: '#10b981' },
  Caja: { icono: '💵', color: '#22c55e' },
  Compras: { icono: '🛒', color: '#f59e0b' },
  Gerencia: { icono: '🧭', color: '#6366f1' },
  'Sin área': { icono: '📁', color: '#64748b' }
}

function sectorDe(pedido: PedidoCompra): string {
  return pedido.sector_solicitante?.trim() || 'Sin área'
}

function metaSector(sector: string) {
  return SECTORES_META[sector] ?? { icono: '📁', color: '#64748b' }
}

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

function PedidoCard({
  pedido,
  onOpen
}: {
  pedido: PedidoCompra
  onOpen: () => void
}) {
  const esNuevo = !pedido.visto_por_compras_at
  const sector = sectorDe(pedido)
  const meta = metaSector(sector)

  return (
    <article
      className={`pedido-card${esNuevo ? ' pedido-card--nuevo' : ''}`}
      style={{ '--pedido-sector-color': meta.color } as CSSProperties}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
    >
      {esNuevo && <span className="pedido-nuevo-badge">● Nuevo</span>}
      <div className="pedido-header">
        <div className="pedido-numero">
          <strong>{pedido.numero_pedido}</strong>
          <span className="pedido-sector">
            {meta.icono} {sector}
          </span>
        </div>
        <div className="pedido-header__badges">
          <span className="pedido-prioridad" style={{ color: getPrioridadColor(pedido.prioridad) }}>
            {pedido.prioridad}
          </span>
          <span className="pedido-estado" style={{ backgroundColor: getEstadoColor(pedido.estado) }}>
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
      <span className="pedido-card__abrir">Abrir pedido →</span>
    </article>
  )
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
  const [filtroSector, setFiltroSector] = useState<string>('todos')
  const [soloNuevos, setSoloNuevos] = useState(false)
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoFiltro>('7')
  const [buscar, setBuscar] = useState('')
  const [extraVisibles, setExtraVisibles] = useState(0)

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
      return
    }
    void loadPedidos()
  }, [canManageCompras, navigate, authLoading])

  useEffect(() => {
    setExtraVisibles(0)
  }, [filtroEstado, filtroPrioridad, filtroSector, soloNuevos, filtroPeriodo, buscar])

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

  const cutoffPeriodo = useMemo(() => getCutoffPeriodo(filtroPeriodo), [filtroPeriodo])

  const sectoresDisponibles = useMemo(
    () =>
      [...new Set(pedidos.map(sectorDe))].sort((a, b) => {
        const countA = pedidos.filter((p) => sectorDe(p) === a).length
        const countB = pedidos.filter((p) => sectorDe(p) === b).length
        return countB - countA || a.localeCompare(b)
      }),
    [pedidos]
  )

  const pedidosFiltrados = useMemo(() => {
    let list = [...pedidos]
    if (filtroEstado !== 'todos') {
      list = list.filter((p) => p.estado === filtroEstado)
    }
    if (filtroPrioridad !== 'todos') {
      list = list.filter((p) => p.prioridad === filtroPrioridad)
    }
    if (filtroSector !== 'todos') {
      list = list.filter((p) => sectorDe(p) === filtroSector)
    }
    if (soloNuevos) {
      list = list.filter((p) => !p.visto_por_compras_at)
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
    return list.sort((a, b) => {
      const nuevoA = a.visto_por_compras_at ? 0 : 1
      const nuevoB = b.visto_por_compras_at ? 0 : 1
      return (
        nuevoB - nuevoA ||
        new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime()
      )
    })
  }, [pedidos, filtroEstado, filtroPrioridad, filtroSector, soloNuevos, buscar])

  const { enPeriodo, anterioresAlPeriodo } = useMemo(() => {
    if (filtroPeriodo === 'todos') {
      return { enPeriodo: pedidosFiltrados, anterioresAlPeriodo: [] as PedidoCompra[] }
    }
    const en: PedidoCompra[] = []
    const ant: PedidoCompra[] = []
    for (const p of pedidosFiltrados) {
      const f = new Date(p.fecha_solicitud)
      f.setHours(0, 0, 0, 0)
      if (cutoffPeriodo && f >= cutoffPeriodo) en.push(p)
      else ant.push(p)
    }
    return { enPeriodo: en, anterioresAlPeriodo: ant }
  }, [pedidosFiltrados, filtroPeriodo, cutoffPeriodo])

  const pedidosVisibles = useMemo(() => {
    if (filtroPeriodo === 'todos') {
      return pedidosFiltrados.slice(0, INICIAL_TODOS + extraVisibles)
    }
    return [...enPeriodo, ...anterioresAlPeriodo.slice(0, extraVisibles)]
  }, [filtroPeriodo, pedidosFiltrados, enPeriodo, anterioresAlPeriodo, extraVisibles])

  const pedidosPorSector = useMemo(() => {
    const grupos = new Map<string, PedidoCompra[]>()
    for (const pedido of pedidosVisibles) {
      const sector = sectorDe(pedido)
      const grupo = grupos.get(sector) ?? []
      grupo.push(pedido)
      grupos.set(sector, grupo)
    }
    return [...grupos.entries()].sort(([, a], [, b]) => {
      const nuevosA = a.filter((p) => !p.visto_por_compras_at).length
      const nuevosB = b.filter((p) => !p.visto_por_compras_at).length
      return nuevosB - nuevosA || b.length - a.length
    })
  }, [pedidosVisibles])

  const hayMasPorCargar =
    filtroPeriodo === 'todos'
      ? pedidosVisibles.length < pedidosFiltrados.length
      : extraVisibles < anterioresAlPeriodo.length

  const restantes =
    filtroPeriodo === 'todos'
      ? pedidosFiltrados.length - pedidosVisibles.length
      : anterioresAlPeriodo.length - extraVisibles

  const miniStats = useMemo(() => {
    const cutoff7d = getCutoffPeriodo('7')!
    return {
      pendientes: pedidos.filter((p) => p.estado === 'Pendiente').length,
      nuevos: pedidos.filter((p) => !p.visto_por_compras_at).length,
      ultimos7: pedidos.filter((p) => {
        const f = new Date(p.fecha_solicitud)
        f.setHours(0, 0, 0, 0)
        return f >= cutoff7d
      }).length
    }
  }, [pedidos])

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
              {miniStats.ultimos7} en los últimos 7 días · {miniStats.pendientes} pendientes
            </p>
          </div>
        </div>
        <div className="compras-dash-header__stats" aria-label="Resumen de pedidos">
          <button
            type="button"
            className={`compras-dash-stat${soloNuevos ? ' is-active' : ''}`}
            onClick={() => setSoloNuevos((v) => !v)}
          >
            <strong>{miniStats.nuevos}</strong>
            <span>nuevos sin leer</span>
          </button>
          <div className="compras-dash-stat">
            <strong>{sectoresDisponibles.length}</strong>
            <span>áreas activas</span>
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
                {pedidosVisibles.length < pedidosFiltrados.length ? ` de ${pedidosFiltrados.length}` : ''})
              </span>
            </h2>
            <p className="pedidos-section__hint">
              {filtroPeriodo === 'todos'
                ? 'Mostrando el historial completo por lotes. Usá el filtro de período para acotar fechas.'
                : `Período: ${getPeriodoLabel(filtroPeriodo).toLowerCase()}. Los anteriores se cargan bajo demanda.`}
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
            <label className="pedidos-filter-field">
              <span>Área</span>
              <select value={filtroSector} onChange={(e) => setFiltroSector(e.target.value)}>
                <option value="todos">Todas las áreas</option>
                {sectoresDisponibles.map((sector) => (
                  <option key={sector} value={sector}>
                    {metaSector(sector).icono} {sector}
                  </option>
                ))}
              </select>
            </label>
            <label className="pedidos-filter-field">
              <span>Período</span>
              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value as PeriodoFiltro)}
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pedidos-chips">
            {miniStats.nuevos > 0 && (
              <button
                type="button"
                className={`pedidos-chip pedidos-chip--nuevo${soloNuevos ? ' pedidos-chip--active' : ''}`}
                onClick={() => setSoloNuevos((v) => !v)}
              >
                ● Nuevos <em>{miniStats.nuevos}</em>
              </button>
            )}
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
            <p>
              {anterioresAlPeriodo.length > 0 && enPeriodo.length === 0
                ? `No hay pedidos en ${getPeriodoLabel(filtroPeriodo).toLowerCase()}.`
                : 'No hay pedidos para mostrar con estos filtros.'}
            </p>
            {anterioresAlPeriodo.length > 0 && enPeriodo.length === 0 ? (
              <button
                type="button"
                className="cp-btn cp-btn--secondary"
                onClick={() => setExtraVisibles(CARGAR_MAS)}
              >
                Ver pedidos anteriores ({anterioresAlPeriodo.length})
              </button>
            ) : (
              (buscar ||
                filtroEstado !== 'todos' ||
                filtroPrioridad !== 'todos' ||
                filtroSector !== 'todos' ||
                soloNuevos ||
                filtroPeriodo !== '7') && (
                <button
                  type="button"
                  className="cp-btn cp-btn--ghost"
                  onClick={() => {
                    setBuscar('')
                    setFiltroEstado('todos')
                    setFiltroPrioridad('todos')
                    setFiltroSector('todos')
                    setSoloNuevos(false)
                    setFiltroPeriodo('7')
                  }}
                >
                  Limpiar filtros
                </button>
              )
            )}
          </div>
        ) : (
          <>
            <div className="pedidos-sectores">
              {pedidosPorSector.map(([sector, pedidosSector]) => {
                const meta = metaSector(sector)
                const nuevos = pedidosSector.filter((p) => !p.visto_por_compras_at).length
                return (
                  <section
                    key={sector}
                    className="pedidos-sector-group"
                    style={{ '--sector-color': meta.color } as CSSProperties}
                  >
                    <header className="pedidos-sector-group__header">
                      <span className="pedidos-sector-group__icon" aria-hidden>
                        {meta.icono}
                      </span>
                      <div>
                        <h3>{sector}</h3>
                        <p>
                          {pedidosSector.length} {pedidosSector.length === 1 ? 'pedido' : 'pedidos'}
                        </p>
                      </div>
                      {nuevos > 0 && (
                        <span className="pedidos-sector-group__nuevos">
                          {nuevos} {nuevos === 1 ? 'nuevo' : 'nuevos'}
                        </span>
                      )}
                    </header>
                    <div className="pedidos-list">
                      {pedidosSector.map((pedido) => (
                        <PedidoCard
                          key={pedido.id}
                          pedido={pedido}
                          onOpen={() => navigate(`/compras/pedidos/${pedido.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>

            {hayMasPorCargar && (
              <div className="pedidos-load-more">
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() =>
                    setExtraVisibles((v) =>
                      filtroPeriodo === 'todos'
                        ? v + CARGAR_MAS
                        : v === 0
                          ? CARGAR_MAS
                          : v + CARGAR_MAS
                    )
                  }
                >
                  {filtroPeriodo === 'todos'
                    ? `Cargar más pedidos (${Math.min(CARGAR_MAS, restantes)} de ${restantes})`
                    : extraVisibles === 0
                      ? `Ver pedidos anteriores a ${getPeriodoLabel(filtroPeriodo).toLowerCase()} (${anterioresAlPeriodo.length})`
                      : `Cargar más pedidos anteriores (${Math.min(CARGAR_MAS, restantes)} de ${restantes})`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
