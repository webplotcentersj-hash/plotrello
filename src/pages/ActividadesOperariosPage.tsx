import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ChevronDown, ClipboardList, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import ActividadOperarioDetalleModal from '../features/work-pool/ActividadOperarioDetalleModal'
import ActividadesOperariosCalendario from '../features/work-pool/ActividadesOperariosCalendario'
import {
  attachActividadesToOps,
  buildActividadesPorOpDelDia,
  buildOpsDelDia,
  buildOpsDelDiaFromHistorialTablero,
  buildOpsDelDiaPorOperarioFromHistorialTablero,
  canVerActividadesOperarios,
  cargarOpsTableroSupervisionDia,
  formatHorarioNota,
  formatMinutos,
  listarNotasSupervisionOperarios,
  mergeOpsDelDiaList,
  obtenerEstadisticasOperarioNotas,
  type HistorialTableroMovimiento,
  type OpDelDia,
  type OpDelDiaActividad,
  type OrdenResumenParaOps,
  type WorkPoolNotaSupervision
} from '../features/work-pool/workPoolOperarioNotas'
import VerLegajoModal from '../components/VerLegajoModal'
import type { WorkPoolOperarioNotasEstadisticas } from '../types/workPool'
import type { UsuarioRecord, UserRole } from '../types/api'
import { getArgentinaDateString, isoToArgentinaDateKey } from '../utils/dateUtils'
import './ActividadesOperariosPage.css'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function formatDiaLabel(yyyyMmDd: string) {
  try {
    return new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return yyyyMmDd
  }
}

function formatDia(fecha: string) {
  try {
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    })
  } catch {
    return fecha
  }
}

const TIPO_LABEL: Record<string, string> = {
  bitacora: 'Bitácora',
  checklist: 'Checklist',
  anotador: 'Anotador'
}

const FUENTE_LABEL: Record<OpDelDiaActividad['fuente'], string> = {
  tablero: 'Tablero',
  bitacora: 'Bitácora',
  checklist: 'Checklist',
  anotador: 'Anotador'
}

function inicialesOperario(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function parseOpLabel(label: string): { numero: string | null; titulo: string | null } {
  const m = label.match(/^OP\s+(\d+)\s*[·•-]?\s*(.*)$/i)
  if (!m) return { numero: null, titulo: label }
  const titulo = m[2]?.trim() || null
  return { numero: m[1], titulo }
}

function avatarHue(id: number): number {
  return (id * 47) % 360
}

function esNombreOperarioValido(raw: string | null | undefined): boolean {
  const v = raw?.trim()
  if (!v) return false
  if (/^\d+$/.test(v)) return false
  if (/^(usuario|operario)\s*#?\s*\d+$/i.test(v)) return false
  return true
}

function resolveNombreOperario(
  id: number,
  nombresById: Map<number, string>,
  fallback?: string | null
): string {
  const fromLegajo = nombresById.get(id)
  if (fromLegajo) return fromLegajo
  if (esNombreOperarioValido(fallback)) return fallback!.trim()
  return `Operario #${id}`
}

function OpActividadesList({
  actividades,
  compact = false
}: {
  actividades: OpDelDiaActividad[]
  compact?: boolean
}) {
  if (actividades.length === 0) return null
  return (
    <ul className={`act-op-actividades${compact ? ' act-op-actividades--compact' : ''}`}>
      {actividades.map((a, i) => (
        <li key={`${a.timestamp}-${i}`} className={`act-op-actividades__item act-op-actividades__item--${a.fuente}`}>
          <span className="act-op-actividades__dot" aria-hidden />
          <div className="act-op-actividades__body">
            <div className="act-op-actividades__head">
              <span className={`act-op-actividades__fuente act-op-actividades__fuente--${a.fuente}`}>
                {FUENTE_LABEL[a.fuente]}
              </span>
              <span className="act-op-actividades__hora">{formatWhen(a.timestamp)}</span>
            </div>
            <p>{a.texto}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function OpDelDiaRow({
  op,
  expanded,
  onToggle
}: {
  op: OpDelDia
  expanded: boolean
  onToggle: () => void
}) {
  const tieneDetalle = (op.actividades?.length ?? 0) > 0
  const parsed = parseOpLabel(op.label)
  const operarios = (op.operarios ?? []).filter((o) => esNombreOperarioValido(o.nombre))
  return (
    <li className={`act-op-ops__item${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="act-op-ops__item-toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={!tieneDetalle}
      >
        <span className="act-op-ops__chevron-wrap" aria-hidden>
          <ChevronDown size={18} className={`act-op-chevron${expanded ? ' is-open' : ''}`} />
        </span>
        <div className="act-op-ops__main">
          <div className="act-op-ops__title-row">
            {parsed.numero ? <span className="act-op-ops__op-num">OP {parsed.numero}</span> : null}
            {parsed.titulo ? <strong>{parsed.titulo}</strong> : null}
          </div>
          <div className="act-op-ops__meta">
            <span className="act-op-pill act-op-pill--entries">
              {op.entradas} {op.entradas === 1 ? 'entrada' : 'entradas'}
            </span>
            {op.estado ? (
              <span className="act-op-pill act-op-pill--estado">{op.estado.replace(/_/g, ' ')}</span>
            ) : null}
            {op.horario ? <span className="act-op-pill act-op-pill--hora">{op.horario}</span> : null}
          </div>
          {operarios.length > 0 ? (
            <div className="act-op-ops__people">
              {operarios.map((o) => (
                <span key={o.id} className="act-op-ops__person">
                  {o.nombre}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
      {expanded && tieneDetalle ? <OpActividadesList actividades={op.actividades!} /> : null}
    </li>
  )
}

function toUsuarioRecord(nota: WorkPoolNotaSupervision): UsuarioRecord {
  return {
    id: nota.id_usuario,
    nombre: nota.usuario_nombre || `Usuario #${nota.id_usuario}`,
    rol: (nota.usuario_rol as UserRole) || 'operario-diseno'
  }
}

export default function ActividadesOperariosPage() {
  const { usuario, loading: authLoading } = useAuth()
  const allowed = canVerActividadesOperarios(usuario)
  const hoy = getArgentinaDateString()
  const [selectedDate, setSelectedDate] = useState(hoy)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [y, m] = hoy.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [items, setItems] = useState<WorkPoolNotaSupervision[]>([])
  const [monthItems, setMonthItems] = useState<WorkPoolNotaSupervision[]>([])
  const [stats, setStats] = useState<WorkPoolOperarioNotasEstadisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroOp, setFiltroOp] = useState<number | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'bitacora' | 'checklist' | 'anotador'>('todos')
  const [q, setQ] = useState('')
  const [periodoDias, setPeriodoDias] = useState(30)
  const [detalle, setDetalle] = useState<WorkPoolNotaSupervision | null>(null)
  const [legajoUsuario, setLegajoUsuario] = useState<UsuarioRecord | null>(null)
  const [historialTablero, setHistorialTablero] = useState<HistorialTableroMovimiento[]>([])
  const [ordenTableroById, setOrdenTableroById] = useState<Map<number, OrdenResumenParaOps>>(new Map())
  const [nombresById, setNombresById] = useState<Map<number, string>>(new Map())
  const [loadingTableroOps, setLoadingTableroOps] = useState(false)
  const [opsDiaExpanded, setOpsDiaExpanded] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!usuario?.id || !allowed) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      listarNotasSupervisionOperarios({
        id_actor: usuario.id,
        id_operario: filtroOp === 'todos' ? null : filtroOp,
        fecha: selectedDate,
        limit: 200
      }),
      obtenerEstadisticasOperarioNotas({ id_actor: usuario.id, dias: periodoDias })
    ]).then(([resList, resStats]) => {
      if (cancelled) return
      setLoading(false)
      if (!resList.success) {
        setError(resList.error || 'No se pudo cargar')
        setItems([])
      } else {
        setError('')
        setItems(resList.data ?? [])
      }
      if (resStats.success) setStats(resStats.data ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [usuario?.id, allowed, selectedDate, filtroOp, periodoDias])

  useEffect(() => {
    if (!usuario?.id || !allowed) return
    let cancelled = false
    void listarNotasSupervisionOperarios({ id_actor: usuario.id, limit: 400 }).then((res) => {
      if (cancelled || !res.success) return
      setMonthItems(res.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [usuario?.id, allowed, calendarMonth])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    setLoadingTableroOps(true)
    void cargarOpsTableroSupervisionDia(selectedDate).then((res) => {
      if (cancelled) return
      setLoadingTableroOps(false)
      if (!res.success) {
        setHistorialTablero([])
        setOrdenTableroById(new Map())
        setNombresById(new Map())
        return
      }
      setHistorialTablero(res.movimientos ?? [])
      setOrdenTableroById(res.ordenById ?? new Map())
      setNombresById(res.nombresById ?? new Map())
    })
    return () => {
      cancelled = true
    }
  }, [allowed, selectedDate])

  const nombresCompletos = useMemo(() => {
    const map = new Map(nombresById)
    for (const n of [...items, ...monthItems]) {
      if (esNombreOperarioValido(n.usuario_nombre)) {
        map.set(n.id_usuario, n.usuario_nombre!.trim())
      }
    }
    for (const h of historialTablero) {
      if (esNombreOperarioValido(h.nombre_usuario)) {
        map.set(h.id_usuario, h.nombre_usuario!.trim())
      }
    }
    return map
  }, [nombresById, items, monthItems, historialTablero])

  const operarios = useMemo(() => {
    const map = new Map<number, string>()
    for (const n of [...items, ...monthItems]) {
      if (!map.has(n.id_usuario)) {
        map.set(
          n.id_usuario,
          resolveNombreOperario(n.id_usuario, nombresCompletos, n.usuario_nombre)
        )
      }
    }
    for (const h of historialTablero) {
      if (!map.has(h.id_usuario)) {
        map.set(
          h.id_usuario,
          resolveNombreOperario(h.id_usuario, nombresCompletos, h.nombre_usuario)
        )
      }
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [items, monthItems, historialTablero, nombresCompletos])

  const countsByDay = useMemo(() => {
    const map: Record<string, number> = {}
    const y = calendarMonth.getFullYear()
    const m = calendarMonth.getMonth()
    for (const n of monthItems) {
      const key = isoToArgentinaDateKey(n.created_at)
      const [yy, mm] = key.split('-').map(Number)
      if (yy === y && mm - 1 === m) {
        map[key] = (map[key] ?? 0) + 1
      }
    }
    for (const d of stats?.por_dia ?? []) {
      const [yy, mm] = d.fecha.split('-').map(Number)
      if (yy === y && mm - 1 === m && map[d.fecha] == null) {
        map[d.fecha] = d.total
      }
    }
    return map
  }, [monthItems, stats, calendarMonth])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return items.filter((n) => {
      if (filtroTipo !== 'todos' && n.tipo !== filtroTipo) return false
      if (!qq) return true
      const blob = [
        n.usuario_nombre,
        n.titulo,
        n.detalle,
        n.numero_op,
        n.numero_venta,
        n.numero_oportunidad,
        n.job_titulo
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(qq)
    })
  }, [items, filtroTipo, q])

  const grouped = useMemo(() => {
    const by = new Map<number, WorkPoolNotaSupervision[]>()
    for (const n of filtered) {
      const list = by.get(n.id_usuario) ?? []
      list.push(n)
      by.set(n.id_usuario, list)
    }
    return [...by.entries()]
      .map(([id, notas]) => ({
        id,
        nombre: resolveNombreOperario(id, nombresCompletos, notas[0]?.usuario_nombre),
        idLegajo: notas[0]?.id_legajo ?? null,
        notas
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [filtered, nombresCompletos])

  const delDiaStats = useMemo(() => {
    const bitacora = filtered.filter((n) => n.tipo === 'bitacora').length
    const checklist = filtered.filter((n) => n.tipo === 'checklist').length
    const anotador = filtered.filter((n) => n.tipo === 'anotador').length
    return { total: filtered.length, bitacora, checklist, anotador }
  }, [filtered])

  const actividadesGlobal = useMemo(
    () =>
      buildActividadesPorOpDelDia(selectedDate, historialTablero, ordenTableroById, filtered, {
        idUsuario: filtroOp === 'todos' ? null : filtroOp
      }),
    [selectedDate, historialTablero, ordenTableroById, filtered, filtroOp]
  )

  const opsDelDia = useMemo(() => {
    const fromNotas = buildOpsDelDia(filtered, { fechaKey: selectedDate })
    const fromTablero = buildOpsDelDiaFromHistorialTablero(
      historialTablero,
      ordenTableroById,
      selectedDate,
      filtroOp === 'todos' ? undefined : { idUsuario: filtroOp }
    )
    return attachActividadesToOps(mergeOpsDelDiaList(fromNotas, fromTablero), actividadesGlobal)
  }, [filtered, selectedDate, historialTablero, ordenTableroById, filtroOp, actividadesGlobal])

  const opsPorOperarioHistorial = useMemo(
    () => buildOpsDelDiaPorOperarioFromHistorialTablero(historialTablero, ordenTableroById, selectedDate),
    [historialTablero, ordenTableroById, selectedDate]
  )

  const opsPorOperario = useMemo(() => {
    const map = new Map<number, OpDelDia[]>()
    for (const g of grouped) {
      const acts = buildActividadesPorOpDelDia(
        selectedDate,
        historialTablero,
        ordenTableroById,
        g.notas,
        { idUsuario: g.id }
      )
      const ops = attachActividadesToOps(
        buildOpsDelDia(g.notas, { fechaKey: selectedDate }),
        acts
      )
      map.set(g.id, ops)
    }
    for (const [userId, ops] of opsPorOperarioHistorial) {
      const acts = buildActividadesPorOpDelDia(
        selectedDate,
        historialTablero,
        ordenTableroById,
        filtered,
        { idUsuario: userId }
      )
      const fromNotas = map.get(userId) ?? []
      map.set(userId, attachActividadesToOps(mergeOpsDelDiaList(fromNotas, ops), acts))
    }
    return map
  }, [grouped, opsPorOperarioHistorial, selectedDate, historialTablero, ordenTableroById, filtered])

  const groupedConTablero = useMemo(() => {
    const byId = new Map(grouped.map((g) => [g.id, g]))
    for (const userId of opsPorOperarioHistorial.keys()) {
      if (byId.has(userId)) continue
      const nombre = resolveNombreOperario(
        userId,
        nombresCompletos,
        historialTablero.find((h) => h.id_usuario === userId)?.nombre_usuario
      )
      byId.set(userId, { id: userId, nombre, idLegajo: null, notas: [] })
    }
    return [...byId.values()]
      .filter((g) => (filtroOp === 'todos' ? true : g.id === filtroOp))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [grouped, opsPorOperarioHistorial, historialTablero, filtroOp, nombresCompletos])

  const checklistPct = useMemo(() => {
    if (!stats?.totales.checklist) return 0
    return Math.round((stats.totales.checklist_hechos / stats.totales.checklist) * 100)
  }, [stats])

  const maxDia = useMemo(() => {
    if (!stats?.por_dia.length) return 1
    return Math.max(...stats.por_dia.map((d) => d.total), 1)
  }, [stats])

  const toggleCard = (id: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleOp = (scopeKey: string) => {
    setExpandedOps((prev) => {
      const next = new Set(prev)
      if (next.has(scopeKey)) next.delete(scopeKey)
      else next.add(scopeKey)
      return next
    })
  }

  const abrirLegajo = (nota: WorkPoolNotaSupervision) => {
    setDetalle(null)
    setLegajoUsuario(toUsuarioRecord(nota))
  }

  if (authLoading) {
    return <div className="act-op-page act-op-page--muted">Cargando…</div>
  }
  if (!usuario) return <Navigate to="/login" replace />
  if (!allowed) return <Navigate to="/" replace />

  return (
    <div className="act-op-page">
      <header className="act-op-page__head">
        <div>
          <p className="act-op-page__eyebrow">Supervisión Plot Lab</p>
          <h1>Actividades de operarios</h1>
          <p className="act-op-page__lead">
            Bitácora, checklist, anotador y OPs del día · calendario y legajo RRHH.
          </p>
        </div>
        <div className="act-op-page__nav">
          <Link to="/" className="act-op-page__back">
            ← Tablero
          </Link>
          <Link to="/plot-design" className="act-op-page__back">
            Plot Design admin
          </Link>
        </div>
      </header>

      <div className="act-op-page__layout">
        <aside className="act-op-page__aside">
          <ActividadesOperariosCalendario
            month={calendarMonth}
            selectedDate={selectedDate}
            countsByDay={countsByDay}
            onSelectDate={(d) => {
              setSelectedDate(d)
              const [y, m] = d.split('-').map(Number)
              setCalendarMonth(new Date(y, m - 1, 1))
            }}
            onChangeMonth={setCalendarMonth}
          />
          <button
            type="button"
            className="act-op-page__today"
            onClick={() => {
              const t = getArgentinaDateString()
              setSelectedDate(t)
              const [y, m] = t.split('-').map(Number)
              setCalendarMonth(new Date(y, m - 1, 1))
            }}
          >
            Ir a hoy
          </button>
        </aside>

        <div className="act-op-page__main">
          <section className="act-op-dia">
            <header className="act-op-dia__head">
              <div className="act-op-dia__intro">
                <span className="act-op-dia__badge">Resumen del día</span>
                <h2>{formatDiaLabel(selectedDate)}</h2>
                <p>{delDiaStats.total} actividades registradas</p>
              </div>
              <div className="act-op-dia__chips">
                <span className="act-op-dia__chip act-op-dia__chip--bitacora">{delDiaStats.bitacora} bitácora</span>
                <span className="act-op-dia__chip act-op-dia__chip--checklist">{delDiaStats.checklist} checklist</span>
                <span className="act-op-dia__chip act-op-dia__chip--anotador">{delDiaStats.anotador} anotador</span>
                <span className="act-op-dia__chip act-op-dia__chip--ops">{opsDelDia.length} OPs</span>
              </div>
            </header>
            {opsDelDia.length > 0 ? (
              <div className={`act-op-ops${opsDiaExpanded ? ' is-expanded' : ''}`}>
                <button
                  type="button"
                  className="act-op-ops__toggle"
                  onClick={() => setOpsDiaExpanded((v) => !v)}
                  aria-expanded={opsDiaExpanded}
                >
                  <span className="act-op-ops__icon" aria-hidden>
                    <ClipboardList size={20} strokeWidth={2.2} />
                  </span>
                  <div className="act-op-ops__toggle-text">
                    <p className="act-op-ops__title">OPs trabajadas este día</p>
                    <p className="act-op-ops__hint">
                      {opsDelDia.length} OP{opsDelDia.length === 1 ? '' : 's'} · tablero y bitácora
                    </p>
                  </div>
                  <span className="act-op-ops__count">{opsDelDia.length}</span>
                  <ChevronDown
                    size={18}
                    className={`act-op-chevron act-op-chevron--end${opsDiaExpanded ? ' is-open' : ''}`}
                    aria-hidden
                  />
                </button>
                {opsDiaExpanded ? (
                  <ul className="act-op-ops__list">
                    {opsDelDia.map((op) => (
                      <OpDelDiaRow
                        key={op.key}
                        op={op}
                        expanded={expandedOps.has(`global:${op.key}`)}
                        onToggle={() => toggleOp(`global:${op.key}`)}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : loadingTableroOps ? (
              <p className="act-op-page--muted">Cargando OPs del tablero…</p>
            ) : (
              <p className="act-op-page--muted act-op-ops__empty">
                Sin OPs registradas: aparecen al mover fichas en el tablero o cargar bitácora hoy.
              </p>
            )}
          </section>

          {stats ? (
            <section className="act-op-stats act-op-stats--compact">
              <div className="act-op-stats__head">
                <h2>Estadísticas</h2>
                <label>
                  Período
                  <select value={periodoDias} onChange={(e) => setPeriodoDias(Number(e.target.value))}>
                    <option value={7}>7 días</option>
                    <option value={30}>30 días</option>
                    <option value={90}>90 días</option>
                  </select>
                </label>
              </div>
              <div className="act-op-stats__kpis act-op-stats__kpis--compact">
                <article>
                  <span>Total</span>
                  <strong>{stats.totales.total}</strong>
                </article>
                <article>
                  <span>Checklist</span>
                  <strong>
                    {stats.totales.checklist_hechos}/{stats.totales.checklist}
                  </strong>
                  <small>{checklistPct}%</small>
                </article>
                <article>
                  <span>Tiempo</span>
                  <strong>{formatMinutos(stats.totales.minutos_registrados)}</strong>
                </article>
              </div>
              {stats.por_dia.length > 0 ? (
                <div className="act-op-stats__chart act-op-stats__chart--compact">
                  <ul>
                    {stats.por_dia.slice(-7).map((d) => (
                      <li key={d.fecha}>
                        <button
                          type="button"
                          className={`act-op-stats__day-btn${selectedDate === d.fecha ? ' is-active' : ''}`}
                          onClick={() => {
                            setSelectedDate(d.fecha)
                            const [y, m] = d.fecha.split('-').map(Number)
                            setCalendarMonth(new Date(y, m - 1, 1))
                          }}
                        >
                          <span>{formatDia(d.fecha)}</span>
                          <div className="act-op-stats__bar-wrap">
                            <div
                              className="act-op-stats__bar"
                              style={{ width: `${Math.max(8, (d.total / maxDia) * 100)}%` }}
                            />
                          </div>
                          <span className="act-op-stats__chart-val">{d.total}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="act-op-page__filters">
            <label>
              Operario
              <select
                value={filtroOp === 'todos' ? 'todos' : String(filtroOp)}
                onChange={(e) =>
                  setFiltroOp(e.target.value === 'todos' ? 'todos' : Number(e.target.value))
                }
              >
                <option value="todos">Todos</option>
                {operarios.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
              >
                <option value="todos">Todos</option>
                <option value="bitacora">Bitácora</option>
                <option value="checklist">Checklist</option>
                <option value="anotador">Anotador</option>
              </select>
            </label>
            <label className="act-op-page__search">
              Buscar
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="OP, venta, texto…"
                autoComplete="off"
              />
            </label>
          </div>

          {loading ? <p className="act-op-page--muted">Cargando actividades…</p> : null}
          {error ? <p className="act-op-page__error">{error}</p> : null}
          {!loading && !error && groupedConTablero.length === 0 ? (
            <p className="act-op-page--muted">No hay actividades registradas para este día.</p>
          ) : null}

          {groupedConTablero.length > 0 ? (
          <div className="act-op-page__groups">
            <header className="act-op-page__groups-head">
              <Users size={18} strokeWidth={2.2} aria-hidden />
              <div>
                <h2>Operarios del día</h2>
                <p>{groupedConTablero.length} operario{groupedConTablero.length === 1 ? '' : 's'} con actividad</p>
              </div>
            </header>
            {groupedConTablero.map((g) => {
              const ops = opsPorOperario.get(g.id) ?? []
              const cardOpen = expandedCards.has(g.id)
              const opsOpen = expandedOps.has(`card-ops:${g.id}`)
              const countLabel =
                g.notas.length > 0 ? `${g.notas.length} del día` : `${ops.length} OPs tablero`
              return (
              <section
                key={g.id}
                className={`act-op-card${cardOpen ? ' is-expanded' : ''}`}
                style={{ '--act-op-accent': avatarHue(g.id) } as CSSProperties}
              >
                <header className="act-op-card__head">
                  <button
                    type="button"
                    className="act-op-card__head-toggle"
                    onClick={() => toggleCard(g.id)}
                    aria-expanded={cardOpen}
                  >
                    <span className="act-op-card__avatar" aria-hidden>
                      {inicialesOperario(g.nombre)}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`act-op-chevron${cardOpen ? ' is-open' : ''}`}
                      aria-hidden
                    />
                    <div className="act-op-card__identity">
                      <h2>{g.nombre}</h2>
                      {g.idLegajo ? (
                        <small className="act-op-card__legajo">Legajo #{g.idLegajo}</small>
                      ) : null}
                    </div>
                  </button>
                  <div className="act-op-card__head-actions">
                    <span className="act-op-card__count-badge">{countLabel}</span>
                    <button
                      type="button"
                      className="act-op-card__legajo-btn"
                      onClick={() =>
                        abrirLegajo(
                          g.notas[0] ?? {
                            id: 0,
                            id_usuario: g.id,
                            tipo: 'bitacora',
                            titulo: null,
                            detalle: '',
                            hecho: false,
                            id_job: null,
                            numero_op: null,
                            id_orden: null,
                            id_venta: null,
                            numero_venta: null,
                            id_oportunidad: null,
                            numero_oportunidad: null,
                            adjuntos: [],
                            hora_inicio: null,
                            hora_fin: null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            usuario_nombre: g.nombre
                          }
                        )
                      }
                    >
                      Ver legajo
                    </button>
                  </div>
                </header>
                {cardOpen ? (
                  <>
                {ops.length > 0 ? (
                  <div className={`act-op-card__ops-wrap${opsOpen ? ' is-expanded' : ''}`}>
                    <button
                      type="button"
                      className="act-op-card__ops-toggle"
                      onClick={() => toggleOp(`card-ops:${g.id}`)}
                      aria-expanded={opsOpen}
                    >
                      <ChevronDown
                        size={16}
                        className={`act-op-chevron${opsOpen ? ' is-open' : ''}`}
                        aria-hidden
                      />
                      <span>
                        {ops.length} OP{ops.length === 1 ? '' : 's'} del día
                      </span>
                    </button>
                    {opsOpen ? (
                      <ul className="act-op-card__ops">
                        {ops.map((op) => {
                          const opKey = `card:${g.id}:${op.key}`
                          const opDetailOpen = expandedOps.has(opKey)
                          const tieneDetalle = (op.actividades?.length ?? 0) > 0
                          const parsed = parseOpLabel(op.label)
                          return (
                            <li
                              key={op.key}
                              className={`act-op-card__op-item${opDetailOpen ? ' is-expanded' : ''}`}
                            >
                              <button
                                type="button"
                                className="act-op-card__op-toggle"
                                onClick={() => toggleOp(opKey)}
                                aria-expanded={opDetailOpen}
                                disabled={!tieneDetalle}
                              >
                                <ChevronDown
                                  size={14}
                                  className={`act-op-chevron${opDetailOpen ? ' is-open' : ''}`}
                                  aria-hidden
                                />
                                {parsed.numero ? (
                                  <span className="act-op-card__op-num">OP {parsed.numero}</span>
                                ) : null}
                                {parsed.titulo ? (
                                  <span className="act-op-card__op-chip">{parsed.titulo}</span>
                                ) : null}
                                {op.horario ? (
                                  <span className="act-op-card__op-hora">{op.horario}</span>
                                ) : null}
                                <span className="act-op-card__op-count">
                                  {op.entradas} {op.entradas === 1 ? 'entrada' : 'entradas'}
                                </span>
                              </button>
                              {opDetailOpen && tieneDetalle ? (
                                <OpActividadesList actividades={op.actividades!} compact />
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <ul className="act-op-card__list">
                  {g.notas.map((n) => (
                    <li key={n.id}>
                      <button type="button" className="act-op-card__item-btn" onClick={() => setDetalle(n)}>
                        <div className="act-op-card__meta">
                          <span className={`act-op-card__tipo act-op-card__tipo--${n.tipo}`}>
                            {TIPO_LABEL[n.tipo] || n.tipo}
                          </span>
                          <span>{formatWhen(n.created_at)}</span>
                          {formatHorarioNota(n.hora_inicio, n.hora_fin) ? (
                            <span>{formatHorarioNota(n.hora_inicio, n.hora_fin)}</span>
                          ) : null}
                          {n.hecho ? <span className="act-op-card__hecho">Hecho</span> : null}
                        </div>
                        <p>{n.titulo || n.detalle}</p>
                        {n.numero_op ? <span className="act-op-card__op">OP {n.numero_op}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
                  </>
                ) : null}
              </section>
            )})}
          </div>
          ) : null}
        </div>
      </div>

      <ActividadOperarioDetalleModal
        nota={detalle}
        onClose={() => setDetalle(null)}
        onVerLegajo={abrirLegajo}
      />

      {legajoUsuario ? (
        <VerLegajoModal
          usuario={legajoUsuario}
          isOpen
          onClose={() => setLegajoUsuario(null)}
          initialTab="actividades_plot"
        />
      ) : null}
    </div>
  )
}

