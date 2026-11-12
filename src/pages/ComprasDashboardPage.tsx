import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './ComprasDashboardPage.css'

const CARGAR_MAS = 15
const INICIAL_TODOS = 30
const PAGE_SIZE = 10

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

function nombreProveedorPedido(pedido: PedidoCompra): string {
  const fromJoin =
    pedido.proveedor?.razon_social?.trim() ||
    pedido.proveedor?.nombre?.trim() ||
    ''
  if (fromJoin) return fromJoin
  const fromItem = pedido.items?.find((i) => (i.proveedor || '').trim())?.proveedor?.trim()
  if (fromItem) return fromItem
  return 'Sin proveedor'
}

function claveProveedorPedido(pedido: PedidoCompra): string {
  if (pedido.id_proveedor && pedido.id_proveedor > 0) return `id:${pedido.id_proveedor}`
  const nombre = nombreProveedorPedido(pedido)
  return nombre === 'Sin proveedor' ? 'sin' : `nom:${nombre.toLowerCase()}`
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

function fmtFechaPedido(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const [filtroProveedor, setFiltroProveedor] = useState<string>('todos')
  const [soloNuevos, setSoloNuevos] = useState(false)
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoFiltro>('7')
  const [buscar, setBuscar] = useState('')
  const [extraVisibles, setExtraVisibles] = useState(0)
  const [pagina, setPagina] = useState(1)

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
    setPagina(1)
  }, [filtroEstado, filtroPrioridad, filtroProveedor, soloNuevos, filtroPeriodo, buscar])

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

  const proveedoresDisponibles = useMemo(() => {
    const map = new Map<string, { clave: string; nombre: string; count: number }>()
    for (const p of pedidos) {
      const clave = claveProveedorPedido(p)
      const nombre = nombreProveedorPedido(p)
      const cur = map.get(clave)
      if (cur) cur.count += 1
      else map.set(clave, { clave, nombre, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, 'es'))
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    let list = [...pedidos]
    if (filtroEstado !== 'todos') {
      list = list.filter((p) => p.estado === filtroEstado)
    }
    if (filtroPrioridad !== 'todos') {
      list = list.filter((p) => p.prioridad === filtroPrioridad)
    }
    if (filtroProveedor !== 'todos') {
      list = list.filter((p) => claveProveedorPedido(p) === filtroProveedor)
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
          nombreProveedorPedido(p).toLowerCase().includes(q) ||
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
  }, [pedidos, filtroEstado, filtroPrioridad, filtroProveedor, soloNuevos, buscar])

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

  const totalPaginas = Math.max(1, Math.ceil(pedidosVisibles.length / PAGE_SIZE))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const listaPagina = useMemo(() => {
    const from = (pagina - 1) * PAGE_SIZE
    return pedidosVisibles.slice(from, from + PAGE_SIZE)
  }, [pedidosVisibles, pagina])

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
            <strong>{proveedoresDisponibles.length}</strong>
            <span>proveedores</span>
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
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/gestion-stock')}>
            📦 Stock
          </button>
          <button type="button" className="compras-dash-nav__btn" onClick={() => navigate('/compras/proveedores')}>
            🏢 Proveedores
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
              {filtroEstado === 'Pendiente' ? 'Pedidos pendientes a proveedores' : 'Pedidos a proveedores'}
              <span className="pedidos-section-count">
                {' '}
                ({pedidosVisibles.length}
                {pedidosVisibles.length < pedidosFiltrados.length ? ` de ${pedidosFiltrados.length}` : ''})
              </span>
            </h2>
            <p className="pedidos-section__hint">
              {filtroPeriodo === 'todos'
                ? 'Historial de pedidos enviados a proveedores. Usá el filtro de período para acotar fechas.'
                : `Período: ${getPeriodoLabel(filtroPeriodo).toLowerCase()}. Pedidos de compra a proveedores externos.`}
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
              placeholder="Buscar N° pedido, proveedor, solicitante, motivo…"
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
              <span>Proveedor</span>
              <select value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)}>
                <option value="todos">Todos los proveedores</option>
                {proveedoresDisponibles.map((prov) => (
                  <option key={prov.clave} value={prov.clave}>
                    {prov.nombre} ({prov.count})
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
                onClick={() => {
                  setExtraVisibles(CARGAR_MAS)
                  setPagina(1)
                }}
              >
                Ver pedidos anteriores ({anterioresAlPeriodo.length})
              </button>
            ) : (
              (buscar ||
                filtroEstado !== 'todos' ||
                filtroPrioridad !== 'todos' ||
                filtroProveedor !== 'todos' ||
                soloNuevos ||
                filtroPeriodo !== '7') && (
                <button
                  type="button"
                  className="cp-btn cp-btn--ghost"
                  onClick={() => {
                    setBuscar('')
                    setFiltroEstado('todos')
                    setFiltroPrioridad('todos')
                    setFiltroProveedor('todos')
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
            <div className="pedidos-table-meta">
              <p>
                Página {pagina} de {totalPaginas} · {PAGE_SIZE} por hoja
              </p>
            </div>
            <div className="pedidos-table-wrap">
              <table className="pedidos-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>N°</th>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Solicitante</th>
                    <th className="num">Items</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Motivo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPagina.map((pedido) => {
                    const esNuevo = !pedido.visto_por_compras_at
                    const proveedorNombre = nombreProveedorPedido(pedido)
                    return (
                      <tr
                        key={pedido.id}
                        className={esNuevo ? 'pedidos-table__row--nuevo' : undefined}
                        onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                      >
                        <td>
                          {esNuevo ? <span className="pedidos-table__dot" title="Nuevo">●</span> : null}
                        </td>
                        <td className="pedidos-table__num">
                          <strong>{pedido.numero_pedido}</strong>
                        </td>
                        <td>{fmtFechaPedido(pedido.fecha_solicitud)}</td>
                        <td>
                          <span className="pedidos-table__prov" title={proveedorNombre}>
                            {proveedorNombre}
                          </span>
                          {pedido.sector_solicitante ? (
                            <small className="pedidos-table__hint">
                              pide {pedido.sector_solicitante}
                            </small>
                          ) : null}
                        </td>
                        <td>{pedido.nombre_solicitante}</td>
                        <td className="num">{pedido.items?.length || 0}</td>
                        <td>
                          <span
                            className="pedidos-table__prio"
                            style={{ color: getPrioridadColor(pedido.prioridad) }}
                          >
                            {pedido.prioridad}
                          </span>
                        </td>
                        <td>
                          <span
                            className="pedidos-table__estado"
                            style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                          >
                            {pedido.estado}
                          </span>
                        </td>
                        <td className="pedidos-table__motivo" title={pedido.motivo || ''}>
                          {pedido.motivo
                            ? pedido.motivo.length > 48
                              ? `${pedido.motivo.slice(0, 46)}…`
                              : pedido.motivo
                            : '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="pedidos-table__btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/compras/pedidos/${pedido.id}`)
                            }}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <nav className="pedidos-pager" aria-label="Paginación de pedidos">
              <button
                type="button"
                className="pedidos-pager__arrow"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                ←
              </button>
              <span className="pedidos-pager__info">
                {pagina} / {totalPaginas}
              </span>
              <button
                type="button"
                className="pedidos-pager__arrow"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                aria-label="Página siguiente"
              >
                →
              </button>
            </nav>

            {hayMasPorCargar && (
              <div className="pedidos-load-more">
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() => {
                    setExtraVisibles((v) =>
                      filtroPeriodo === 'todos'
                        ? v + CARGAR_MAS
                        : v === 0
                          ? CARGAR_MAS
                          : v + CARGAR_MAS
                    )
                    setPagina(1)
                  }}
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
