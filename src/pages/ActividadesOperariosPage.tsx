import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ActividadOperarioDetalleModal from '../features/work-pool/ActividadOperarioDetalleModal'
import ActividadesOperariosCalendario from '../features/work-pool/ActividadesOperariosCalendario'
import {
  buildOpsDelDia,
  canVerActividadesOperarios,
  formatHorarioNota,
  formatMinutos,
  listarNotasSupervisionOperarios,
  obtenerEstadisticasOperarioNotas,
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

  const operarios = useMemo(() => {
    const map = new Map<number, string>()
    for (const n of [...items, ...monthItems]) {
      if (!map.has(n.id_usuario)) {
        map.set(n.id_usuario, n.usuario_nombre || `Usuario #${n.id_usuario}`)
      }
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [items, monthItems])

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
        nombre: notas[0]?.usuario_nombre || `Usuario #${id}`,
        idLegajo: notas[0]?.id_legajo ?? null,
        notas
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [filtered])

  const delDiaStats = useMemo(() => {
    const bitacora = filtered.filter((n) => n.tipo === 'bitacora').length
    const checklist = filtered.filter((n) => n.tipo === 'checklist').length
    const anotador = filtered.filter((n) => n.tipo === 'anotador').length
    return { total: filtered.length, bitacora, checklist, anotador }
  }, [filtered])

  const opsDelDia = useMemo(() => buildOpsDelDia(filtered), [filtered])

  const opsPorOperario = useMemo(() => {
    const map = new Map<number, ReturnType<typeof buildOpsDelDia>>()
    for (const g of grouped) {
      map.set(g.id, buildOpsDelDia(g.notas))
    }
    return map
  }, [grouped])

  const checklistPct = useMemo(() => {
    if (!stats?.totales.checklist) return 0
    return Math.round((stats.totales.checklist_hechos / stats.totales.checklist) * 100)
  }, [stats])

  const maxDia = useMemo(() => {
    if (!stats?.por_dia.length) return 1
    return Math.max(...stats.por_dia.map((d) => d.total), 1)
  }, [stats])

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
              <div>
                <h2>{formatDiaLabel(selectedDate)}</h2>
                <p>{delDiaStats.total} actividades del día</p>
              </div>
              <div className="act-op-dia__chips">
                <span>{delDiaStats.bitacora} bitácora</span>
                <span>{delDiaStats.checklist} checklist</span>
                <span>{delDiaStats.anotador} anotador</span>
                <span>{opsDelDia.length} OPs</span>
              </div>
            </header>
            {opsDelDia.length > 0 ? (
              <div className="act-op-ops">
                <p className="act-op-ops__title">OPs trabajadas este día</p>
                <ul className="act-op-ops__list">
                  {opsDelDia.map((op) => (
                    <li key={op.key} className="act-op-ops__item">
                      <div className="act-op-ops__main">
                        <strong>{op.label}</strong>
                        <div className="act-op-ops__meta">
                          <span>
                            {op.entradas} {op.entradas === 1 ? 'entrada' : 'entradas'}
                          </span>
                          {op.horario ? <span>{op.horario}</span> : null}
                          {op.operarios && op.operarios.length > 0 ? (
                            <span>
                              {op.operarios.map((o) => o.nombre).join(', ')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
          {!loading && !error && grouped.length === 0 ? (
            <p className="act-op-page--muted">No hay actividades registradas para este día.</p>
          ) : null}

          <div className="act-op-page__groups">
            {grouped.map((g) => (
              <section key={g.id} className="act-op-card">
                <header className="act-op-card__head">
                  <div>
                    <h2>{g.nombre}</h2>
                    {g.idLegajo ? <small className="act-op-card__legajo">Legajo #{g.idLegajo}</small> : null}
                  </div>
                  <div className="act-op-card__head-actions">
                    <span>{g.notas.length} del día</span>
                    <button
                      type="button"
                      className="act-op-card__legajo-btn"
                      onClick={() => abrirLegajo(g.notas[0]!)}
                    >
                      Ver legajo
                    </button>
                  </div>
                </header>
                {(opsPorOperario.get(g.id) ?? []).length > 0 ? (
                  <ul className="act-op-card__ops">
                    {(opsPorOperario.get(g.id) ?? []).map((op) => (
                      <li key={op.key}>
                        <span className="act-op-card__op-chip">{op.label}</span>
                        {op.horario ? <span className="act-op-card__op-hora">{op.horario}</span> : null}
                        <span className="act-op-card__op-count">
                          {op.entradas} {op.entradas === 1 ? 'entrada' : 'entradas'}
                        </span>
                      </li>
                    ))}
                  </ul>
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
              </section>
            ))}
          </div>
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

