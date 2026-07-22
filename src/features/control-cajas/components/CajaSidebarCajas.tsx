import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { clientesPerfil } from '../../../utils/clientesRoutes'
import { ventasConVentaId } from '../../../utils/ventasRoutes'
import type { Venta } from '../../../types/api'
import { conteosPorCajaOperativa, type ConteoCajaResumen } from '../cajaMenuOperativaData'
import { listCajasOperativasUsuarios } from '../cajaOperativa'
import {
  listArqueos,
  listCierres,
  listEgresoSolicitudes,
  listMovimientos,
  listTransferenciaLotes
} from '../cajaRepository'
import { fmtArs, fmtDateAr } from '../format'
import { LIST_PAGE_SIZE, matchSearchQuery } from '../listFilters'
import type { CajaRegistro, CajaSectionId } from '../types'
import CajaCollapsibleCard, { CajaListSearch } from './CajaCollapsibleCard'

type Props = {
  selectedSlug: string | null
  onSelect: (slug: string) => void
  refreshKey?: number
  onNavigateSection?: (section: CajaSectionId) => void
}

export default function CajaSidebarCajas({
  selectedSlug,
  onSelect,
  refreshKey = 0
}: Props) {
  const [conteosHoy, setConteosHoy] = useState<ConteoCajaResumen[]>([])
  const [loading, setLoading] = useState(true)
  const hoy = getArgentinaDateString()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [cajas, movimientos, arqueos, egresos, lotes, cierres] = await Promise.all([
          listCajasOperativasUsuarios(),
          listMovimientos(),
          listArqueos(),
          listEgresoSolicitudes({ soloPendientes: false }),
          listTransferenciaLotes(200),
          listCierres()
        ])
        if (cancelled) return
        setConteosHoy(
          conteosPorCajaOperativa({
            cajas,
            movimientos,
            arqueos,
            egresos,
            lotes,
            cierres,
            fecha: hoy
          })
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hoy, refreshKey])

  const filas = useMemo(() => conteosHoy, [conteosHoy])

  return (
    <div className="caja-cc-sidebar-cajas">
      <div className="caja-cc-nav-section">Cajas</div>
      {loading ? (
        <p className="caja-cc-sidebar-cajas-muted">Cargando cajas…</p>
      ) : filas.length === 0 ? (
        <p className="caja-cc-sidebar-cajas-muted">Sin cajas operativas</p>
      ) : (
        filas.map((c) => {
          const active = selectedSlug === c.slug
          const cierres = c.cierresTurnoCount + c.cierresFormalesCount
          return (
            <button
              key={c.slug}
              type="button"
              className={`caja-cc-nav-item caja-cc-nav-caja${active ? ' active' : ''}`}
              onClick={() => onSelect(c.slug)}
              title={`${c.nombre} — hoy: ${c.ventasCount} ventas, ${c.egresosCount} egresos, ${c.arqueosCount} arqueos, ${cierres} cierres`}
            >
              <span className="caja-cc-nav-icon" aria-hidden>
                💵
              </span>
              <span className="caja-cc-nav-caja-body">
                <span className="caja-cc-nav-caja-nombre">{c.nombre}</span>
                <span className="caja-cc-nav-caja-counts">
                  V {c.ventasCount} · E {c.egresosCount} · A {c.arqueosCount} · C {cierres}
                </span>
              </span>
            </button>
          )
        })
      )}
      <p className="caja-cc-sidebar-cajas-hint">Conteos de hoy · clic para detalle</p>
    </div>
  )
}

/**
 * Caja = usuario: solo ventas del titular (`id_vendedor`).
 * No mezclar por `caja_slug_cobro` ajeno (evita ver a Facundo en caja de Alejandro).
 */
function ventaPerteneceACaja(v: Venta, caja: CajaRegistro): boolean {
  if (caja.id_usuario == null) return false
  return v.id_vendedor === caja.id_usuario
}

function ordenarVentas(ventas: Venta[]): Venta[] {
  return [...ventas].sort(
    (a, b) => (b.fecha_venta || '').localeCompare(a.fecha_venta || '') || b.id - a.id
  )
}

function VentasTablaBody({ ventas, emptyLabel }: { ventas: Venta[]; emptyLabel: string }) {
  if (ventas.length === 0) return <p className="caja-cc-empty">{emptyLabel}</p>
  return (
    <div className="caja-cc-table-wrap">
      <table className="caja-cc-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Nº venta</th>
            <th>Cliente</th>
            <th>OP</th>
            <th>Pago</th>
            <th>Estado</th>
            <th className="num">Monto</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id}>
              <td>{fmtDateAr(v.fecha_venta)}</td>
              <td>
                <Link className="caja-cc-link" to={ventasConVentaId(v.id)}>
                  {v.numero_venta}
                </Link>
              </td>
              <td>
                {v.id_cliente ? (
                  <Link className="caja-cc-link" to={clientesPerfil(v.id_cliente)}>
                    {v.cliente_nombre || '—'}
                  </Link>
                ) : (
                  v.cliente_nombre || '—'
                )}
              </td>
              <td>
                {v.numero_op || v.id_op ? (
                  <Link
                    className="caja-cc-link"
                    to={`/op/${encodeURIComponent(String(v.numero_op || v.id_op))}`}
                  >
                    {v.numero_op || `OP-${v.id_op}`}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td>{v.metodo_pago || '—'}</td>
              <td>{v.estado_pago || '—'}</td>
              <td className="num">$ {fmtArs(v.valor_total || 0)}</td>
              <td>
                <Link className="btn-small" to={ventasConVentaId(v.id)}>
                  Detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VentasCajaTabla({
  titulo,
  ventas,
  emptyLabel
}: {
  titulo: string
  ventas: Venta[]
  emptyLabel: string
}) {
  const total = ventas.length
  const monto = ventas.reduce((s, v) => s + (v.valor_total || 0), 0)
  return (
    <section className="caja-cc-card caja-cc-detalle-caja-ventas">
      <h3>
        {titulo}{' '}
        <span className="caja-cc-detalle-caja-ventas-count">
          ({total} · $ {fmtArs(monto)})
        </span>
      </h3>
      <VentasTablaBody ventas={ventas} emptyLabel={emptyLabel} />
    </section>
  )
}

const ESTADOS_PAGO = ['Pagado', 'Parcial', 'Pendiente', 'Cancelado'] as const

function VentasHistoricoFiltrado({ ventas }: { ventas: Venta[] }) {
  const [search, setSearch] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [metodo, setMetodo] = useState('')
  const [limit, setLimit] = useState(LIST_PAGE_SIZE)

  const metodosDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const v of ventas) {
      const m = (v.metodo_pago || '').trim()
      if (m) set.add(m)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [ventas])

  const filtradas = useMemo(() => {
    return ventas.filter((v) => {
      const fecha = (v.fecha_venta || '').slice(0, 10)
      if (desde && fecha < desde) return false
      if (hasta && fecha > hasta) return false
      if (estado && (v.estado_pago || '') !== estado) return false
      if (metodo && (v.metodo_pago || '') !== metodo) return false
      return matchSearchQuery(search, [
        v.numero_venta,
        v.cliente_nombre,
        v.numero_op,
        v.metodo_pago,
        v.estado_pago,
        fecha,
        fmtArs(v.valor_total || 0)
      ])
    })
  }, [ventas, search, desde, hasta, estado, metodo])

  const visibles = filtradas.slice(0, limit)
  const montoFiltrado = filtradas.reduce((s, v) => s + (v.valor_total || 0), 0)
  const hayFiltros = Boolean(search || desde || hasta || estado || metodo)

  const toolbar = (
    <div className="caja-cc-card-toolbar caja-cc-card-toolbar--stack">
      <CajaListSearch
        value={search}
        onChange={(v) => {
          setSearch(v)
          setLimit(LIST_PAGE_SIZE)
        }}
        placeholder="Buscar nº venta, cliente, OP, monto…"
      />
      <div className="caja-cc-filters-row">
        <label className="caja-cc-filter-chip">
          <span>Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value)
              setLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        <label className="caja-cc-filter-chip">
          <span>Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value)
              setLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        <label className="caja-cc-filter-chip">
          <span>Estado</span>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value)
              setLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todos</option>
            {ESTADOS_PAGO.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="caja-cc-filter-chip">
          <span>Pago</span>
          <select
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value)
              setLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todos</option>
            {metodosDisponibles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {hayFiltros && (
          <button
            type="button"
            className="btn-tiny"
            onClick={() => {
              setSearch('')
              setDesde('')
              setHasta('')
              setEstado('')
              setMetodo('')
              setLimit(LIST_PAGE_SIZE)
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
      {hayFiltros && (
        <p className="caja-cc-help" style={{ margin: '4px 0 0' }}>
          {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'} · $ {fmtArs(montoFiltrado)}
        </p>
      )}
    </div>
  )

  return (
    <CajaCollapsibleCard
      title={`Histórico de ventas (${filtradas.length} · $ ${fmtArs(montoFiltrado)})`}
      count={filtradas.length}
      defaultOpen={false}
      className="caja-cc-detalle-caja-ventas"
      toolbar={toolbar}
    >
      <VentasTablaBody
        ventas={visibles}
        emptyLabel={
          hayFiltros ? 'Sin coincidencias con los filtros.' : 'Sin ventas del titular en esta caja.'
        }
      />
      {filtradas.length > visibles.length && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => setLimit((n) => n + LIST_PAGE_SIZE)}
        >
          Ver más ({visibles.length} de {filtradas.length})
        </button>
      )}
    </CajaCollapsibleCard>
  )
}

export function CajaDetallePorCaja({
  slug,
  refreshKey = 0,
  onNavigate
}: {
  slug: string
  refreshKey?: number
  onNavigate: (section: CajaSectionId) => void
}) {
  const [hoy, setHoy] = useState<ConteoCajaResumen | null>(null)
  const [todo, setTodo] = useState<ConteoCajaResumen | null>(null)
  const [caja, setCaja] = useState<CajaRegistro | null>(null)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [errVentas, setErrVentas] = useState<string | null>(null)
  const fechaHoy = getArgentinaDateString()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrVentas(null)
    void (async () => {
      try {
        const [cajas, movimientos, arqueos, egresos, lotes, cierres] = await Promise.all([
          listCajasOperativasUsuarios(),
          listMovimientos(),
          listArqueos(),
          listEgresoSolicitudes({ soloPendientes: false }),
          listTransferenciaLotes(500),
          listCierres()
        ])
        if (cancelled) return
        const cajaHit = cajas.find((c) => c.slug === slug) ?? null
        setCaja(cajaHit)
        const base = { cajas, movimientos, arqueos, egresos, lotes, cierres }
        setHoy(conteosPorCajaOperativa({ ...base, fecha: fechaHoy }).find((x) => x.slug === slug) ?? null)
        setTodo(conteosPorCajaOperativa({ ...base, fecha: null }).find((x) => x.slug === slug) ?? null)

        const { default: apiService } = await import('../../../services/api')
        const res = await apiService.obtenerVentas()
        if (cancelled) return
        if (!res.success) {
          setErrVentas(res.error || 'No se pudieron cargar las ventas')
          setVentas([])
          return
        }
        const cajaRef = cajaHit ?? { slug, nombre: slug, fondo_fijo: 0, activa: true }
        setVentas((res.data || []).filter((v) => ventaPerteneceACaja(v, cajaRef)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, fechaHoy, refreshKey])

  const ventasHoy = useMemo(
    () => ordenarVentas(ventas.filter((v) => (v.fecha_venta || '').slice(0, 10) === fechaHoy)),
    [ventas, fechaHoy]
  )
  const ventasHist = useMemo(() => ordenarVentas(ventas), [ventas])
  const ventasHoyTotal = useMemo(
    () => ventasHoy.reduce((s, v) => s + (v.valor_total || 0), 0),
    [ventasHoy]
  )
  const ventasTodoTotal = useMemo(
    () => ventasHist.reduce((s, v) => s + (v.valor_total || 0), 0),
    [ventasHist]
  )

  if (loading) return <p className="caja-cc-help">Cargando detalle de caja…</p>
  if (!hoy && !todo && !caja) return <p className="caja-cc-empty">No se encontró la caja.</p>

  const nombre = hoy?.nombre || todo?.nombre || caja?.nombre || slug

  return (
    <div className="caja-cc-detalle-caja">
      <div className="caja-cc-page-head">
        <div>
          <h2>{nombre}</h2>
          <p>Caja personal del titular: ventas, egresos, arqueos y cierres.</p>
        </div>
      </div>

      <div className="caja-cc-detalle-caja-grid">
        <section className="caja-cc-card">
          <h3>Hoy ({fechaHoy})</h3>
          <ul className="caja-cc-detalle-caja-stats">
            <li>
              <strong>Ventas</strong>
              <span>
                {ventasHoy.length} · $ {fmtArs(ventasHoyTotal)}
              </span>
            </li>
            <li>
              <strong>Egresos</strong>
              <span>
                {hoy?.egresosCount ?? 0} · $ {fmtArs(hoy?.egresosTotal ?? 0)}
              </span>
            </li>
            <li>
              <strong>Arqueos</strong>
              <span>{hoy?.arqueosCount ?? 0}</span>
            </li>
            <li>
              <strong>Cierres de turno</strong>
              <span>{hoy?.cierresTurnoCount ?? 0}</span>
            </li>
            <li>
              <strong>Cierres formales</strong>
              <span>{hoy?.cierresFormalesCount ?? 0}</span>
            </li>
          </ul>
        </section>

        <section className="caja-cc-card">
          <h3>Histórico (todo)</h3>
          <ul className="caja-cc-detalle-caja-stats">
            <li>
              <strong>Ventas</strong>
              <span>
                {ventasHist.length} · $ {fmtArs(ventasTodoTotal)}
              </span>
            </li>
            <li>
              <strong>Egresos</strong>
              <span>
                {todo?.egresosCount ?? 0} · $ {fmtArs(todo?.egresosTotal ?? 0)}
              </span>
            </li>
            <li>
              <strong>Arqueos</strong>
              <span>{todo?.arqueosCount ?? 0}</span>
            </li>
            <li>
              <strong>Cierres de turno</strong>
              <span>{todo?.cierresTurnoCount ?? 0}</span>
            </li>
            <li>
              <strong>Cierres formales</strong>
              <span>{todo?.cierresFormalesCount ?? 0}</span>
            </li>
          </ul>
        </section>
      </div>

      {errVentas ? <p className="caja-cc-help">{errVentas}</p> : null}

      <VentasCajaTabla
        titulo="Ventas de hoy"
        ventas={ventasHoy}
        emptyLabel="Sin ventas del titular hoy."
      />

      <VentasHistoricoFiltrado ventas={ventasHist} />

      <div className="caja-cc-detalle-caja-actions">
        <button type="button" className="btn-secondary" onClick={() => onNavigate('arqueos_admin')}>
          Ver arqueos
        </button>
        <button type="button" className="btn-secondary" onClick={() => onNavigate('egresos')}>
          Ver egresos
        </button>
        <button type="button" className="btn-secondary" onClick={() => onNavigate('cierres')}>
          Ver cierres
        </button>
        <button type="button" className="btn-secondary" onClick={() => onNavigate('movimientos_admin')}>
          Ver movimientos
        </button>
        <button type="button" className="btn-primary" onClick={() => onNavigate('tablero_admin')}>
          Calendario
        </button>
      </div>
    </div>
  )
}
