import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesCcPerfil, clientesPerfil } from '../utils/clientesRoutes'
import type {
  CcCobranzaVentaItem,
  ClienteCuentaCorrienteRecord,
  ClienteRecord
} from '../types/api'
import {
  normalizeEstadoCc,
  type EstadoCuentaCorriente
} from '../constants/cuentaCorriente'
import type { CcScoreNivel } from '../constants/cuentaCorrienteScoring'
import CuentaCorrienteScoreBadge from './CuentaCorrienteScoreBadge'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import { estadoCobroVenta } from '../utils/cuentaCorrienteCobranzas'
import './CuentaCorrienteRegistry.css'

export type CuentaCorrienteRegistryRow = ClienteCuentaCorrienteRecord & {
  cliente?: ClienteRecord
}

type CobroResumen = {
  ventas: CcCobranzaVentaItem[]
  monto_pendiente: number
  peor_dias_vencido: number
}

type PipelineColId = 'solicitud' | 'al_dia' | 'por_vencer' | 'vencido' | 'rechazada'

type Props = {
  registros: CuentaCorrienteRegistryRow[]
  registrosFiltrados: CuentaCorrienteRegistryRow[]
  filtroEstado: 'todos' | EstadoCuentaCorriente
  filtroLista: string
  pendientes: CuentaCorrienteRegistryRow[]
  aprobados: CuentaCorrienteRegistryRow[]
  totalRegistros: number
  ventasAbiertas?: CcCobranzaVentaItem[]
  isAdmin: boolean
  resolviendoId: number | null
  quitandoId: number | null
  onFiltroEstado: (est: 'todos' | EstadoCuentaCorriente) => void
  onFiltroLista: (q: string) => void
  onAprobar: (idCliente: number) => void
  onRechazar: (idCliente: number) => void
  onEditar: (row: CuentaCorrienteRegistryRow) => void
  onQuitar: (idCliente: number) => void
  onScoring: (row: CuentaCorrienteRegistryRow) => void
}

const COLS: Array<{
  id: PipelineColId
  label: string
  hint: string
  color: string
}> = [
  { id: 'solicitud', label: 'Solicitud', hint: 'Altas a revisar', color: '#fbbf24' },
  { id: 'al_dia', label: 'Al día', hint: 'Sin atraso', color: '#34d399' },
  { id: 'por_vencer', label: 'Por vencer', hint: 'Próximos 7 días', color: '#fb923c' },
  { id: 'vencido', label: 'Vencido', hint: 'Cobrar ya', color: '#f87171' },
  { id: 'rechazada', label: 'Rechazada', hint: 'Fuera de cartera', color: '#94a3b8' }
]

function pipelineCol(
  row: CuentaCorrienteRegistryRow,
  cobro: CobroResumen | undefined
): PipelineColId {
  const estado = normalizeEstadoCc(row)
  if (estado === 'pendiente') return 'solicitud'
  if (estado === 'rechazada') return 'rechazada'
  if (!cobro || cobro.ventas.length === 0) return 'al_dia'
  if (cobro.peor_dias_vencido > 0) return 'vencido'
  if (cobro.peor_dias_vencido >= -7) return 'por_vencer'
  return 'al_dia'
}

export default function CuentaCorrienteRegistry({
  registrosFiltrados,
  filtroLista,
  totalRegistros,
  ventasAbiertas = [],
  isAdmin,
  resolviendoId,
  quitandoId,
  onFiltroLista,
  onAprobar,
  onRechazar,
  onEditar,
  onQuitar,
  onScoring
}: Props) {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focusCol, setFocusCol] = useState<PipelineColId | null>(null)
  const colRefs = useRef<Partial<Record<PipelineColId, HTMLElement | null>>>({})

  const scrollToCol = (id: PipelineColId) => {
    setFocusCol(id)
    colRefs.current[id]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const cerrarDetalle = () => setSelectedId(null)

  useEffect(() => {
    if (selectedId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selectedId])

  const cobroPorCliente = useMemo(() => {
    const map = new Map<number, CobroResumen>()
    for (const v of ventasAbiertas) {
      const prev = map.get(v.id_cliente)
      if (!prev) {
        map.set(v.id_cliente, {
          ventas: [v],
          monto_pendiente: v.monto_pendiente,
          peor_dias_vencido: v.dias_vencido
        })
      } else {
        prev.ventas.push(v)
        prev.monto_pendiente += v.monto_pendiente
        prev.peor_dias_vencido = Math.max(prev.peor_dias_vencido, v.dias_vencido)
      }
    }
    return map
  }, [ventasAbiertas])

  const porColumna = useMemo(() => {
    const buckets: Record<PipelineColId, CuentaCorrienteRegistryRow[]> = {
      solicitud: [],
      al_dia: [],
      por_vencer: [],
      vencido: [],
      rechazada: []
    }
    for (const r of registrosFiltrados) {
      const col = pipelineCol(r, cobroPorCliente.get(r.id_cliente))
      buckets[col].push(r)
    }
    for (const id of Object.keys(buckets) as PipelineColId[]) {
      buckets[id].sort((a, b) => {
        const ca = cobroPorCliente.get(a.id_cliente)
        const cb = cobroPorCliente.get(b.id_cliente)
        const sa = ca?.monto_pendiente ?? (Number(a.saldo_actual) || 0)
        const sb = cb?.monto_pendiente ?? (Number(b.saldo_actual) || 0)
        return sb - sa
      })
    }
    return buckets
  }, [registrosFiltrados, cobroPorCliente])

  const selected = selectedId
    ? registrosFiltrados.find((r) => r.id === selectedId) || null
    : null
  const selectedCobro = selected ? cobroPorCliente.get(selected.id_cliente) : undefined

  return (
    <section className="cc-pipeline-wrap" aria-labelledby="cc-pipeline-title">
      <header className="cc-pipeline-wrap__head">
        <div>
          <h2 id="cc-pipeline-title">Pipeline de cuenta corriente</h2>
          <p>
            {totalRegistros} {totalRegistros === 1 ? 'cuenta' : 'cuentas'} · solicitudes, cobro y
            vencimientos en un solo flujo
          </p>
        </div>
        <input
          type="search"
          className="cc-pipeline-wrap__search cuenta-corriente-input"
          placeholder="Buscar nombre o CUIT…"
          value={filtroLista}
          onChange={(e) => onFiltroLista(e.target.value)}
        />
      </header>

      {registrosFiltrados.length === 0 ? (
        <div className="cc-registry__empty">
          <p>{filtroLista.trim() ? `Sin resultados para «${filtroLista}».` : 'No hay clientes en cuenta corriente.'}</p>
        </div>
      ) : (
        <>
        <nav className="cc-pipeline-nav" aria-label="Etapas del pipeline">
          {COLS.map((col, idx) => {
            const cards = porColumna[col.id]
            const total = cards.reduce((s, r) => {
              const cobro = cobroPorCliente.get(r.id_cliente)
              return s + (cobro?.monto_pendiente ?? Math.max(0, Number(r.saldo_actual) || 0))
            }, 0)
            const active = focusCol === col.id || (!focusCol && cards.length > 0 && idx === COLS.findIndex((c) => porColumna[c.id].length > 0))
            return (
              <button
                key={col.id}
                type="button"
                className={`cc-pipeline-nav__item cc-pipeline-nav__item--${col.id}${active ? ' is-active' : ''}${cards.length === 0 ? ' is-empty' : ''}`}
                style={{ ['--cc-stage' as string]: col.color }}
                onClick={() => scrollToCol(col.id)}
              >
                <span className="cc-pipeline-nav__step">{idx + 1}</span>
                <span className="cc-pipeline-nav__body">
                  <span className="cc-pipeline-nav__label">{col.label}</span>
                  <span className="cc-pipeline-nav__hint">{col.hint}</span>
                </span>
                <span className="cc-pipeline-nav__stats">
                  <strong>{cards.length}</strong>
                  <em className={total < 0.01 ? 'is-muted' : undefined}>{formatMontoArs(total)}</em>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="cc-pipeline">
          {COLS.map((col) => {
            const cards = porColumna[col.id]
            const total = cards.reduce((s, r) => {
              const cobro = cobroPorCliente.get(r.id_cliente)
              return s + (cobro?.monto_pendiente ?? Math.max(0, Number(r.saldo_actual) || 0))
            }, 0)
            return (
              <section
                key={col.id}
                ref={(el) => {
                  colRefs.current[col.id] = el
                }}
                className={`cc-pipeline__col cc-pipeline__col--${col.id}${focusCol === col.id ? ' is-focus' : ''}`}
                style={{ ['--cc-stage' as string]: col.color }}
              >
                <header className="cc-pipeline__col-head">
                  <span className="cc-pipeline__dot" aria-hidden />
                  <div className="cc-pipeline__titles">
                    <h3>{col.label}</h3>
                    <span className="cc-pipeline__hint">{col.hint}</span>
                  </div>
                  <span className="cc-pipeline__count">{cards.length}</span>
                  <span className={`cc-pipeline__total${total < 0.01 ? ' cc-pipeline__total--muted' : ''}`}>
                    {formatMontoArs(total)}
                  </span>
                </header>
                <div className="cc-pipeline__cards">
                  {cards.length === 0 ? (
                    <p className="cc-pipeline__empty">Sin clientes</p>
                  ) : (
                    cards.map((r) => {
                      const nombre = r.razon_social || r.cliente?.nombre || 'Sin nombre'
                      const cobro = cobroPorCliente.get(r.id_cliente)
                      const saldo = Number(r.saldo_actual) || 0
                      const monto = cobro?.monto_pendiente ?? saldo
                      const cobroSt = cobro ? estadoCobroVenta(cobro.peor_dias_vencido) : null
                      const estado = normalizeEstadoCc(r)
                      return (
                        <article
                          key={r.id}
                          className={`cc-pipeline-card${selectedId === r.id ? ' is-selected' : ''}${cobro && cobro.peor_dias_vencido > 0 ? ' is-late' : ''}`}
                        >
                          <button
                            type="button"
                            className="cc-pipeline-card__name"
                            onClick={() =>
                              estado === 'aprobada'
                                ? navigate(clientesCcPerfil(r.id_cliente))
                                : setSelectedId(r.id)
                            }
                          >
                            {nombre}
                          </button>
                          {r.cuit ? <span className="cc-pipeline-card__meta">CUIT {r.cuit}</span> : null}
                          <div
                            className={`cc-pipeline-card__saldo${
                              monto > 0.009
                                ? ' cc-pipeline-card__saldo--deuda'
                                : monto < -0.009
                                  ? ' cc-pipeline-card__saldo--favor'
                                  : ' cc-pipeline-card__saldo--cero'
                            }`}
                          >
                            {formatMontoArs(monto)}
                          </div>
                          {cobro && cobro.ventas.length > 0 ? (
                            <span className="cc-pipeline-card__meta">
                              {cobro.ventas.length} venta{cobro.ventas.length === 1 ? '' : 's'}
                              {cobroSt ? ` · ${cobroSt.label}` : ''}
                            </span>
                          ) : estado === 'aprobada' ? (
                            <span className="cc-pipeline-card__meta">Sin ventas abiertas</span>
                          ) : null}
                          {estado === 'aprobada' && (
                            <div className="cc-pipeline-card__score">
                              <CuentaCorrienteScoreBadge
                                score={r.score}
                                nivel={r.score_nivel as CcScoreNivel | undefined}
                                compact
                              />
                            </div>
                          )}
                          <div className="cc-pipeline-card__actions">
                            {isAdmin && estado === 'pendiente' && (
                              <>
                                <button
                                  type="button"
                                  className="cc-btn cc-btn--primary cc-btn--sm"
                                  disabled={resolviendoId === r.id_cliente}
                                  onClick={() => onAprobar(r.id_cliente)}
                                >
                                  {resolviendoId === r.id_cliente ? '…' : 'Aprobar'}
                                </button>
                                <button
                                  type="button"
                                  className="cc-btn cc-btn--danger cc-btn--sm"
                                  disabled={resolviendoId === r.id_cliente}
                                  onClick={() => onRechazar(r.id_cliente)}
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                            {estado === 'aprobada' && (
                              <button
                                type="button"
                                className="cc-btn cc-btn--primary cc-btn--sm"
                                onClick={() => navigate(clientesCcPerfil(r.id_cliente))}
                              >
                                Cobrar
                              </button>
                            )}
                            <button
                              type="button"
                              className="cc-btn cc-btn--secondary cc-btn--sm"
                              onClick={() => setSelectedId(r.id)}
                            >
                              Detalle
                            </button>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </section>
            )
          })}
        </div>
        </>
      )}

      {selected && (
        <div
          className="cc-pipeline-modal-overlay"
          role="presentation"
          onClick={cerrarDetalle}
        >
          <div
            className="cc-pipeline-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-pipeline-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="cc-pipeline-modal__head">
              <div>
                <h3 id="cc-pipeline-modal-title">
                  {selected.razon_social || selected.cliente?.nombre || 'Cliente'}
                </h3>
                <p>
                  {selected.cuit || 'Sin CUIT'} · {normalizeEstadoCc(selected)}
                  {selectedCobro && selectedCobro.ventas.length > 0
                    ? ` · ${selectedCobro.ventas.length} venta${selectedCobro.ventas.length === 1 ? '' : 's'} · ${formatMontoArs(selectedCobro.monto_pendiente)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className="cc-pipeline-modal__close"
                onClick={cerrarDetalle}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </header>

            <div className="cc-pipeline-modal__body">
              {selectedCobro && selectedCobro.ventas.length > 0 ? (
                <div className="cc-pipeline-detail__ventas">
                  <h4>Ventas abiertas</h4>
                  <div className="cc-pipeline-detail__table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Venta</th>
                          <th>Vendedor</th>
                          <th className="num">Pendiente</th>
                          <th>Vence</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCobro.ventas.map((v) => {
                          const st = estadoCobroVenta(v.dias_vencido)
                          return (
                            <tr key={v.id_venta}>
                              <td>#{v.numero_venta}</td>
                              <td>{v.nombre_vendedor}</td>
                              <td className="num">{formatMontoArs(v.monto_pendiente)}</td>
                              <td>{v.fecha_vencimiento}</td>
                              <td>
                                <span className={`cc-cob-badge ${st.cls}`}>{st.label}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="cc-pipeline-modal__empty">Sin ventas abiertas en cuenta corriente.</p>
              )}
            </div>

            <footer className="cc-pipeline-modal__footer">
              <button
                type="button"
                className="cc-btn cc-btn--secondary cc-btn--sm"
                onClick={() => navigate(clientesPerfil(selected.id_cliente))}
              >
                Ficha cliente
              </button>
              {normalizeEstadoCc(selected) === 'aprobada' && (
                <>
                  <button
                    type="button"
                    className="cc-btn cc-btn--primary cc-btn--sm"
                    onClick={() => navigate(clientesCcPerfil(selected.id_cliente))}
                  >
                    Ver cuenta
                  </button>
                  <button
                    type="button"
                    className="cc-btn cc-btn--secondary cc-btn--sm"
                    onClick={() => {
                      onScoring(selected)
                      cerrarDetalle()
                    }}
                  >
                    Scoring
                  </button>
                </>
              )}
              {(isAdmin || normalizeEstadoCc(selected) !== 'aprobada') && (
                <button
                  type="button"
                  className="cc-btn cc-btn--secondary cc-btn--sm"
                  onClick={() => {
                    onEditar(selected)
                    cerrarDetalle()
                  }}
                >
                  {normalizeEstadoCc(selected) === 'rechazada' ? 'Reenviar' : 'Editar ficha'}
                </button>
              )}
              {(isAdmin ||
                normalizeEstadoCc(selected) === 'rechazada' ||
                normalizeEstadoCc(selected) === 'pendiente') && (
                <button
                  type="button"
                  className="cc-btn cc-btn--danger cc-btn--sm"
                  disabled={quitandoId === selected.id_cliente}
                  onClick={() => onQuitar(selected.id_cliente)}
                >
                  {quitandoId === selected.id_cliente ? 'Quitando…' : 'Quitar'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
