import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { conteosPorCajaOperativa, type ConteoCajaResumen } from '../cajaMenuOperativaData'
import { listCajasOperativasUsuarios } from '../cajaOperativa'
import {
  listArqueos,
  listCierres,
  listEgresoSolicitudes,
  listMovimientos,
  listTransferenciaLotes
} from '../cajaRepository'
import { fmtArs } from '../format'
import type { CajaSectionId } from '../types'

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
  const [loading, setLoading] = useState(true)
  const fechaHoy = getArgentinaDateString()

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
          listTransferenciaLotes(500),
          listCierres()
        ])
        if (cancelled) return
        const base = { cajas, movimientos, arqueos, egresos, lotes, cierres }
        const h = conteosPorCajaOperativa({ ...base, fecha: fechaHoy }).find((x) => x.slug === slug)
        const t = conteosPorCajaOperativa({ ...base, fecha: null }).find((x) => x.slug === slug)
        setHoy(h ?? null)
        setTodo(t ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, fechaHoy, refreshKey])

  if (loading) return <p className="caja-cc-help">Cargando detalle de caja…</p>
  if (!hoy && !todo) return <p className="caja-cc-empty">No se encontró la caja.</p>

  const nombre = hoy?.nombre || todo?.nombre || slug

  return (
    <div className="caja-cc-detalle-caja">
      <div className="caja-cc-page-head">
        <div>
          <h2>{nombre}</h2>
          <p>Conteo de ventas, egresos, arqueos y cierres de esta caja.</p>
        </div>
      </div>

      <div className="caja-cc-detalle-caja-grid">
        <section className="caja-cc-card">
          <h3>Hoy ({fechaHoy})</h3>
          <ul className="caja-cc-detalle-caja-stats">
            <li>
              <strong>Ventas</strong>
              <span>
                {hoy?.ventasCount ?? 0} · $ {fmtArs(hoy?.ventasTotal ?? 0)}
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
                {todo?.ventasCount ?? 0} · $ {fmtArs(todo?.ventasTotal ?? 0)}
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
