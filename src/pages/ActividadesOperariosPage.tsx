import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  canVerActividadesOperarios,
  formatHorarioNota,
  formatMinutos,
  listarNotasSupervisionOperarios,
  obtenerEstadisticasOperarioNotas,
  type WorkPoolNotaSupervision
} from '../features/work-pool/workPoolOperarioNotas'
import type { WorkPoolOperarioNotasEstadisticas } from '../types/workPool'
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

export default function ActividadesOperariosPage() {
  const { usuario, loading: authLoading } = useAuth()
  const allowed = canVerActividadesOperarios(usuario)
  const [items, setItems] = useState<WorkPoolNotaSupervision[]>([])
  const [stats, setStats] = useState<WorkPoolOperarioNotasEstadisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroOp, setFiltroOp] = useState<number | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'bitacora' | 'checklist' | 'anotador'>('todos')
  const [q, setQ] = useState('')
  const [periodoDias, setPeriodoDias] = useState(30)

  useEffect(() => {
    if (!usuario?.id || !allowed) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      listarNotasSupervisionOperarios({ id_actor: usuario.id, limit: 150 }),
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
  }, [usuario?.id, allowed, periodoDias])

  const operarios = useMemo(() => {
    const map = new Map<number, string>()
    for (const n of items) {
      if (!map.has(n.id_usuario)) {
        map.set(n.id_usuario, n.usuario_nombre || `Usuario #${n.id_usuario}`)
      }
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [items])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return items.filter((n) => {
      if (filtroOp !== 'todos' && n.id_usuario !== filtroOp) return false
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
  }, [items, filtroOp, filtroTipo, q])

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
        notas
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [filtered])

  const checklistPct = useMemo(() => {
    if (!stats?.totales.checklist) return 0
    return Math.round((stats.totales.checklist_hechos / stats.totales.checklist) * 100)
  }, [stats])

  const maxDia = useMemo(() => {
    if (!stats?.por_dia.length) return 1
    return Math.max(...stats.por_dia.map((d) => d.total), 1)
  }, [stats])

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
            Bitácora, checklist y anotador · estadísticas y seguimiento por operario.
          </p>
        </div>
        <Link to="/" className="act-op-page__back">
          ← Tablero
        </Link>
      </header>

      {stats ? (
        <section className="act-op-stats">
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
          <div className="act-op-stats__kpis">
            <article>
              <span>Total entradas</span>
              <strong>{stats.totales.total}</strong>
            </article>
            <article>
              <span>Bitácora</span>
              <strong>{stats.totales.bitacora}</strong>
            </article>
            <article>
              <span>Checklist</span>
              <strong>
                {stats.totales.checklist_hechos}/{stats.totales.checklist}
              </strong>
              <small>{checklistPct}% completado</small>
            </article>
            <article>
              <span>Con adjuntos</span>
              <strong>{stats.totales.con_adjuntos}</strong>
            </article>
            <article>
              <span>Horas registradas</span>
              <strong>{formatMinutos(stats.totales.minutos_registrados)}</strong>
              <small>{stats.totales.con_horario} con horario</small>
            </article>
          </div>

          {stats.por_dia.length > 0 ? (
            <div className="act-op-stats__chart">
              <h3>Actividad por día</h3>
              <ul>
                {stats.por_dia.map((d) => (
                  <li key={d.fecha}>
                    <span className="act-op-stats__chart-label">{formatDia(d.fecha)}</span>
                    <div className="act-op-stats__bar-wrap">
                      <div
                        className="act-op-stats__bar"
                        style={{ width: `${Math.max(8, (d.total / maxDia) * 100)}%` }}
                        title={`${d.total} entradas`}
                      />
                    </div>
                    <span className="act-op-stats__chart-val">{d.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {stats.por_operario.length > 0 ? (
            <div className="act-op-stats__table-wrap">
              <h3>Por operario</h3>
              <table className="act-op-stats__table">
                <thead>
                  <tr>
                    <th>Operario</th>
                    <th>Total</th>
                    <th>Bitácora</th>
                    <th>Checklist</th>
                    <th>Hechos</th>
                    <th>Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.por_operario.map((o) => (
                    <tr key={o.id_usuario}>
                      <td>{o.nombre}</td>
                      <td>{o.total}</td>
                      <td>{o.bitacora}</td>
                      <td>{o.checklist}</td>
                      <td>{o.checklist_hechos}</td>
                      <td>{formatMinutos(o.minutos_registrados)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <p className="act-op-page--muted">Todavía no hay actividades registradas.</p>
      ) : null}

      <div className="act-op-page__groups">
        {grouped.map((g) => (
          <section key={g.id} className="act-op-card">
            <header className="act-op-card__head">
              <h2>{g.nombre}</h2>
              <span>{g.notas.length} entradas</span>
            </header>
            <ul className="act-op-card__list">
              {g.notas.map((n) => (
                <li key={n.id}>
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
                  {n.titulo && n.detalle && n.titulo !== n.detalle ? (
                    <small>{n.detalle}</small>
                  ) : null}
                  {n.adjuntos.length > 0 ? (
                    <ul className="act-op-card__adjuntos">
                      {n.adjuntos.map((a) => (
                        <li key={a.url}>
                          <a href={a.url} target="_blank" rel="noopener noreferrer">
                            {a.nombre}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="act-op-card__links">
                    {n.job_titulo ? <span>Job: {n.job_titulo}</span> : null}
                    {n.numero_op ? <span>OP {n.numero_op}</span> : null}
                    {n.numero_venta ? <span>Venta {n.numero_venta}</span> : null}
                    {n.numero_oportunidad ? <span>Opp {n.numero_oportunidad}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
