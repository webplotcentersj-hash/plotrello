import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import './OrdenesListasPage.css'

function estadoCorto(estado: string): string {
  if (estado === 'Almacén de Entrega') return 'En almacén'
  if (estado === 'Finalizado en Taller') return 'Finalizado'
  return estado
}

function OrdenFicha({
  orden,
  expanded,
  onToggle
}: {
  orden: OrdenTrabajo
  expanded: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const esAlmacen = orden.estado === 'Almacén de Entrega'
  const fechaEntrega = orden.fecha_entrega
    ? new Date(orden.fecha_entrega).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : null

  return (
    <article
      className={`ol-ficha ol-ficha--${esAlmacen ? 'almacen' : 'finalizado'}${expanded ? ' ol-ficha--open' : ''}`}
    >
      <button
        type="button"
        className="ol-ficha__summary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="ol-ficha__chevron" aria-hidden />
        <span className="ol-ficha__op">OP {orden.numero_op}</span>
        <span className="ol-ficha__cliente">{orden.cliente}</span>
        <span className={`ol-ficha__badge ol-ficha__badge--${esAlmacen ? 'almacen' : 'finalizado'}`}>
          {estadoCorto(orden.estado)}
        </span>
        {fechaEntrega && (
          <span className="ol-ficha__fecha" title="Entrega estimada">
            {fechaEntrega}
          </span>
        )}
      </button>

      {expanded && (
        <div className="ol-ficha__detail">
          <dl className="ol-ficha__grid">
            {orden.dni_cuit && (
              <div>
                <dt>DNI / CUIT</dt>
                <dd>{orden.dni_cuit}</dd>
              </div>
            )}
            {orden.fecha_creacion && (
              <div>
                <dt>Creada</dt>
                <dd>{new Date(orden.fecha_creacion).toLocaleDateString('es-AR')}</dd>
              </div>
            )}
            {orden.fecha_entrega && (
              <div>
                <dt>Entrega estimada</dt>
                <dd>{new Date(orden.fecha_entrega).toLocaleDateString('es-AR')}</dd>
              </div>
            )}
            {orden.sector && (
              <div>
                <dt>Sector</dt>
                <dd>{orden.sector}</dd>
              </div>
            )}
            {orden.operario_asignado && (
              <div>
                <dt>Operario</dt>
                <dd>{orden.operario_asignado}</dd>
              </div>
            )}
            {orden.prioridad && (
              <div>
                <dt>Prioridad</dt>
                <dd>{orden.prioridad}</dd>
              </div>
            )}
          </dl>

          {orden.descripcion && (
            <p className="ol-ficha__desc">
              <span className="ol-ficha__desc-label">Descripción</span>
              {orden.descripcion}
            </p>
          )}

          <div className="ol-ficha__actions">
            <button
              type="button"
              className="ol-btn ol-btn--primary"
              onClick={() => navigate(`/mostrador/entrega/${orden.id}`)}
            >
              Procesar entrega
            </button>
            <button
              type="button"
              className="ol-btn ol-btn--ghost"
              onClick={() => navigate(`/op/${orden.numero_op}`)}
            >
              Ver OP
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

const OrdenesListasPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [ordenesListas, setOrdenesListas] = useState<OrdenTrabajo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState<'todos' | 'finalizado' | 'almacen'>('todos')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    void loadOrdenesListas()
  }, [location.key])

  const loadOrdenesListas = async () => {
    setLoading(true)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        const listas = response.data.filter(
          (orden) =>
            !orden.entregado &&
            orden.estado !== 'Entregado o Instalado' &&
            (orden.estado === 'Finalizado en Taller' || orden.estado === 'Almacén de Entrega')
        )
        setOrdenesListas(listas)
      }
    } catch (error) {
      console.error('Error cargando órdenes listas:', error)
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(
    () => ({
      todos: ordenesListas.length,
      finalizado: ordenesListas.filter((o) => o.estado === 'Finalizado en Taller').length,
      almacen: ordenesListas.filter((o) => o.estado === 'Almacén de Entrega').length
    }),
    [ordenesListas]
  )

  const ordenesFiltradas = ordenesListas.filter((orden) => {
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      const numeroOpStr = orden.numero_op?.toString().toLowerCase() || ''
      const clienteStr = orden.cliente?.toLowerCase() || ''
      const dniCuitStr = orden.dni_cuit?.toLowerCase() || ''

      const matchesSearch =
        numeroOpStr.includes(searchLower) ||
        clienteStr.includes(searchLower) ||
        dniCuitStr.includes(searchLower)

      if (!matchesSearch) return false
    }

    return (
      filterEstado === 'todos' ||
      (filterEstado === 'finalizado' && orden.estado === 'Finalizado en Taller') ||
      (filterEstado === 'almacen' && orden.estado === 'Almacén de Entrega')
    )
  })

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="ordenes-listas-page">
        <div className="ol-loading">
          <div className="ol-spinner" />
          <p>Cargando órdenes listas…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ordenes-listas-page">
      <header className="ol-header">
        <div className="ol-header__top">
          <div className="ol-header__title-block">
            <span className="ol-header__icon" aria-hidden>
              OP
            </span>
            <div>
              <h1>Órdenes listas para retirar</h1>
              <p className="ol-header__subtitle">
                {counts.todos} {counts.todos === 1 ? 'orden pendiente de entrega' : 'órdenes pendientes de entrega'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ol-btn ol-btn--ghost ol-header__back"
            onClick={() => navigate('/mostrador/dashboard')}
          >
            Volver al panel
          </button>
        </div>
      </header>

      <section className="ol-search-hero" aria-label="Buscar órdenes">
        <label className="ol-search-wrap">
          <span className="ol-search-label">Buscar</span>
          <input
            type="search"
            placeholder="Número de OP, cliente o DNI / CUIT…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ol-search-input"
            autoComplete="off"
          />
        </label>
        <div className="ol-filters" role="tablist" aria-label="Filtrar por estado">
          {(
            [
              ['todos', 'Todas', counts.todos],
              ['finalizado', 'Finalizado en taller', counts.finalizado],
              ['almacen', 'En almacén', counts.almacen]
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filterEstado === key}
              className={`ol-filter-pill${filterEstado === key ? ' ol-filter-pill--active' : ''}`}
              onClick={() => setFilterEstado(key)}
            >
              {label}
              <span className="ol-filter-pill__count">{count}</span>
            </button>
          ))}
        </div>
        {searchTerm.trim() && (
          <p className="ol-search-hint">
            {ordenesFiltradas.length} resultado{ordenesFiltradas.length === 1 ? '' : 's'}
          </p>
        )}
      </section>

      <main className="ol-main">
        {ordenesFiltradas.length === 0 ? (
          <div className="ol-empty">
            <p className="ol-empty__title">No hay órdenes para mostrar</p>
            <p className="ol-empty__text">
              {searchTerm || filterEstado !== 'todos'
                ? 'Probá otro término de búsqueda o cambiá el filtro de estado.'
                : 'Cuando una OP quede finalizada o en almacén, aparecerá acá.'}
            </p>
          </div>
        ) : (
          <ul className="ol-list">
            {ordenesFiltradas.map((orden) => (
              <li key={orden.id}>
                <OrdenFicha
                  orden={orden}
                  expanded={expandedId === orden.id}
                  onToggle={() => orden.id != null && toggleExpand(orden.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

export default OrdenesListasPage
