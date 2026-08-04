import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import { isOpEnAlmacenEntrega, isOpFinalizadoEnTaller } from '../utils/totemConsultaOpEstado'
import './OrdenesListasPage.css'

function esOpEnAlmacen(orden: OrdenTrabajo): boolean {
  return isOpEnAlmacenEntrega(orden.estado || '')
}

/** OP en entregas imprenta (ex Finalizado en Taller) pero aún no pasada a taller gráfico. */
function esOpEntradaTaller(orden: OrdenTrabajo): boolean {
  return isOpFinalizadoEnTaller(orden.estado || '')
}

function ordenElegibleLista(orden: OrdenTrabajo): boolean {
  return (
    !orden.entregado &&
    orden.estado !== 'Entregado o Instalado' &&
    (esOpEnAlmacen(orden) || esOpEntradaTaller(orden))
  )
}

function matchesOrdenSearch(orden: OrdenTrabajo, term: string): boolean {
  const q = term.toLowerCase().trim()
  if (!q) return true
  const numeroOpStr = orden.numero_op?.toString().toLowerCase() || ''
  const clienteStr = orden.cliente?.toLowerCase() || ''
  const dniCuitStr = orden.dni_cuit?.toLowerCase() || ''
  return numeroOpStr.includes(q) || clienteStr.includes(q) || dniCuitStr.includes(q)
}

function estadoCorto(estado: string): string {
  if (isOpEnAlmacenEntrega(estado)) return 'Taller gráfico'
  if (isOpFinalizadoEnTaller(estado)) return 'Imprenta'
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
  const esAlmacen = esOpEnAlmacen(orden)
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
  const [filterEstado, setFilterEstado] = useState<'almacen' | 'finalizado' | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    void loadOrdenesListas()
  }, [location.key])

  const loadOrdenesListas = async () => {
    setLoading(true)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        setOrdenesListas(response.data.filter(ordenElegibleLista))
      }
    } catch (error) {
      console.error('Error cargando órdenes listas:', error)
    } finally {
      setLoading(false)
    }
  }

  const buscando = searchTerm.trim().length > 0
  const mostrarLista = buscando || filterEstado !== null

  const counts = useMemo(
    () => ({
      almacen: ordenesListas.filter(esOpEnAlmacen).length,
      entradaTaller: ordenesListas.filter(esOpEntradaTaller).length
    }),
    [ordenesListas]
  )

  const ordenesFiltradas = useMemo(() => {
    if (!mostrarLista) return []

    return ordenesListas.filter((orden) => {
      if (filterEstado === 'finalizado') {
        if (!esOpEntradaTaller(orden)) return false
      } else if (filterEstado === 'almacen') {
        if (esOpEntradaTaller(orden) && !buscando) return false
        if (!esOpEnAlmacen(orden) && !(buscando && esOpEntradaTaller(orden))) return false
      }

      if (buscando && !matchesOrdenSearch(orden, searchTerm)) return false
      return true
    })
  }, [ordenesListas, buscando, searchTerm, filterEstado, mostrarLista])

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
                {mostrarLista
                  ? `${ordenesFiltradas.length} ${ordenesFiltradas.length === 1 ? 'orden' : 'órdenes'} en pantalla`
                  : 'Elegí un filtro o buscá para ver el listado'}
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
        {!mostrarLista && (
          <p className="ol-search-note">
            Tocá <strong>En almacén</strong> o <strong>En taller</strong> para ver todas las OP de ese
            estado, o usá el buscador.
          </p>
        )}
        <div className="ol-filters" role="tablist" aria-label="Filtrar por estado">
          {(
            [
              ['almacen', 'En almacén', counts.almacen],
              ['finalizado', 'En taller', counts.entradaTaller]
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
        {buscando && (
          <p className="ol-search-hint">
            {ordenesFiltradas.length} resultado{ordenesFiltradas.length === 1 ? '' : 's'}
            {ordenesFiltradas.some(esOpEntradaTaller) && ' (incluye OP en taller)'}
          </p>
        )}
      </section>

      <main className="ol-main">
        {!mostrarLista ? (
          <div className="ol-landing">
            <p className="ol-landing__title">Mostrador</p>
            <p className="ol-landing__text">
              El listado de OP no se muestra hasta que elijas un filtro o busques por número, cliente o
              DNI.
            </p>
            <div className="ol-landing__stats">
              <button
                type="button"
                className="ol-landing__stat"
                onClick={() => setFilterEstado('almacen')}
              >
                <span className="ol-landing__stat-num">{counts.almacen}</span>
                <span className="ol-landing__stat-label">En almacén</span>
              </button>
              <button
                type="button"
                className="ol-landing__stat"
                onClick={() => setFilterEstado('finalizado')}
              >
                <span className="ol-landing__stat-num">{counts.entradaTaller}</span>
                <span className="ol-landing__stat-label">En taller</span>
              </button>
            </div>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="ol-empty">
            <p className="ol-empty__title">No hay órdenes para mostrar</p>
            <p className="ol-empty__text">
              {buscando
                ? 'Probá otro término de búsqueda o cambiá el filtro de estado.'
                : filterEstado === 'finalizado'
                  ? 'No hay OP finalizadas en taller pendientes de pasar a almacén.'
                  : 'No hay OP en almacén de entrega en este momento.'}
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
