import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { generateContent } from '../services/plotAIService'
import { BOARD_COLUMNS } from '../data/mockData'
import type { HistorialMovimiento, OrdenTrabajo } from '../types/api'
import {
  buildIncidenciasDesdeHistorial,
  estadoToBoardAccent,
  type IncidenciaReclamoRow
} from '../utils/incidenciasReclamos'
import './RecursosHumanosIncidenciasPage.css'

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a3e635']

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function ordenToContextBlob(o: OrdenTrabajo): string {
  const sectores =
    Array.isArray(o.sectores) && o.sectores.length > 0 ? o.sectores.join(', ') : (o.sector ?? '—')
  const lines: string[] = [
    `- ID orden: ${o.id}`,
    `- OP: ${o.numero_op}`,
    `- Cliente: ${o.cliente}`,
    `- Estado kanban / producción: ${o.estado}`,
    `- Sector(es): ${sectores}`,
    `- Prioridad: ${o.prioridad}`,
    `- Fecha creación: ${fmtDt(o.fecha_creacion)}`,
    `- Fecha entrega pactada: ${fmtDt(o.fecha_entrega)}`,
    `- Operario asignado: ${o.operario_asignado ?? '—'}`,
    `- Quien trabaja la ficha (nombre): ${o.usuario_trabajando_nombre ?? '—'}`,
    `- Creador registro: ${o.nombre_creador ?? '—'}`,
    `- Teléfono cliente: ${o.telefono_cliente ?? '—'}`,
    `- Email cliente: ${o.email_cliente ?? '—'}`,
    `- Dirección cliente: ${o.direccion_cliente ?? '—'}`,
    `- Descripción / trabajo: ${(o.descripcion ?? '').trim() || '—'}`,
    `- Motivo reclamo (campo reclamo_motivo): ${(o.reclamo_motivo ?? '').trim() || '—'}`,
    `- Brief público (extracto): ${(o.brief_publico ?? '').trim().slice(0, 1200) || '—'}`,
    `- Etapa taller gráfico: ${o.etapa_taller_grafico ?? '—'}`,
    `- Etapa instalaciones: ${o.etapa_instalaciones ?? '—'}`,
    `- Etapa taller imprenta: ${o.etapa_taller_imprenta ?? '—'}`,
    `- Etapa metalúrgica: ${o.etapa_metalurgica ?? '—'}`,
    `- Etapa impresión digital: ${o.etapa_impresion_digital ?? '—'}`,
    `- Ubicación final (si aplica): ${o.ubicacion_final ?? '—'}`,
    `- OP bloqueada: ${o.op_bloqueada === true ? 'sí' : 'no'}`
  ]
  return lines.join('\n')
}

function incidenciaToFallbackBlob(row: IncidenciaReclamoRow): string {
  return [
    `- ID orden: ${row.ordenId}`,
    row.orden?.numero_op ? `- OP: ${row.orden.numero_op}` : '',
    `- Motivo (derivado): ${row.motivoDisplay || '—'}`,
    `- Etapa al marcar (auditoría): ${row.estadoAlMarcar ?? '—'}`,
    `- Sector: ${row.sectorLabel}`,
    `- Usuario que marcó (última apertura): ${row.usuarioMarca ?? '—'}`,
    `- Primera apertura: ${fmtDt(row.tsPrimeraApertura)}`,
    `- Última apertura: ${fmtDt(row.tsUltimaApertura)}`,
    `- Último cierre: ${fmtDt(row.tsUltimoCierre)}`,
    `- Ciclos reclamo: ${row.ciclosReclamo}`
  ]
    .filter(Boolean)
    .join('\n')
}

function comentariosToBlob(rows: Array<{ comentario?: string; usuario_nombre?: string; timestamp?: string }>): string {
  if (!rows.length) return '(Sin comentarios en la ficha)'
  return rows
    .map((r) => {
      const c = (r.comentario ?? '').trim()
      const u = r.usuario_nombre ?? '—'
      const t = fmtDt(r.timestamp ?? null)
      return `[${t}] ${u}: ${c || '(vacío)'}`
    })
    .join('\n')
}

const RRHH_PREFIX = '[RRHH Incidencias]'

type ListaFiltro = 'activos' | 'historicos' | 'todos'
type MainTab = 'lista' | 'metricas'

const RecursosHumanosIncidenciasPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess =
    !!usuario &&
    (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allOrdenes, setAllOrdenes] = useState<OrdenTrabajo[]>([])
  const [historialEventos, setHistorialEventos] = useState<HistorialMovimiento[]>([])
  const [mainTab, setMainTab] = useState<MainTab>('lista')
  const [listaFiltro, setListaFiltro] = useState<ListaFiltro>('activos')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [comentarios, setComentarios] = useState<
    Array<{ id?: number; comentario?: string; usuario_nombre?: string; timestamp?: string }>
  >([])
  const [loadingComentarios, setLoadingComentarios] = useState(false)
  const [notaRrhh, setNotaRrhh] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [plotAnalysis, setPlotAnalysis] = useState('')
  const [plotLoading, setPlotLoading] = useState(false)
  const [plotError, setPlotError] = useState<string | null>(null)
  const [plotExtraFocus, setPlotExtraFocus] = useState('')

  const { rows: incidenciasRows, stats } = useMemo(
    () => buildIncidenciasDesdeHistorial(allOrdenes, historialEventos, BOARD_COLUMNS),
    [allOrdenes, historialEventos]
  )

  const filteredIncidencias = useMemo(() => {
    let list = incidenciasRows
    if (listaFiltro === 'activos') list = list.filter((r) => r.activo)
    else if (listaFiltro === 'historicos') list = list.filter((r) => !r.activo)

    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      const hay = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q)
      return (
        hay(r.motivoDisplay) ||
        hay(r.sectorLabel) ||
        hay(r.estadoAlMarcar) ||
        hay(r.usuarioMarca) ||
        hay(r.orden?.numero_op) ||
        hay(r.orden?.cliente) ||
        hay(r.orden?.descripcion) ||
        hay(r.orden?.estado) ||
        String(r.ordenId).includes(q)
      )
    })
  }, [incidenciasRows, listaFiltro, query])

  const selected = useMemo(
    () => (selectedId != null ? filteredIncidencias.find((r) => r.ordenId === selectedId) ?? null : null),
    [filteredIncidencias, selectedId]
  )

  useEffect(() => {
    if (selectedId == null) return
    if (!filteredIncidencias.some((r) => r.ordenId === selectedId)) {
      setSelectedId(filteredIncidencias[0]?.ordenId ?? null)
    }
  }, [filteredIncidencias, selectedId])

  const selectedOrden = selected?.orden

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordRes, histRes] = await Promise.all([
        apiService.getOrdenes(),
        apiService.getHistorialReclamosIncidencias(8000)
      ])

      const errs: string[] = []
      if (!ordRes.success || !ordRes.data) {
        errs.push(ordRes.error || 'No se pudieron cargar las órdenes.')
        setAllOrdenes([])
      } else {
        setAllOrdenes(ordRes.data)
      }

      if (!histRes.success || !histRes.data) {
        setHistorialEventos([])
        if (histRes.error) errs.push(histRes.error)
      } else {
        setHistorialEventos(histRes.data)
      }

      setError(errs.length ? errs.join(' · ') : null)

      setSelectedId((prev) => {
        const rows = buildIncidenciasDesdeHistorial(
          ordRes.success && ordRes.data ? ordRes.data : [],
          histRes.success && histRes.data ? histRes.data : [],
          BOARD_COLUMNS
        ).rows
        if (prev != null && rows.some((r) => r.ordenId === prev)) return prev
        return rows[0]?.ordenId ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos.')
      setAllOrdenes([])
      setHistorialEventos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/')
      return
    }
    void loadAll()
  }, [authLoading, canAccess, navigate, loadAll])

  useEffect(() => {
    const sid = selected?.ordenId
    if (!sid) {
      setComentarios([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingComentarios(true)
      try {
        const res = await apiService.getComentariosOrden(sid)
        if (!cancelled && res.success && res.data) setComentarios(res.data)
        else if (!cancelled) setComentarios([])
      } finally {
        if (!cancelled) setLoadingComentarios(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected?.ordenId])

  const handleRegistrarNota = async () => {
    if (!selected || !usuario) return
    const text = notaRrhh.trim()
    if (!text) {
      window.alert('Escribí una nota antes de registrar.')
      return
    }
    setGuardandoNota(true)
    try {
      const payload = `${RRHH_PREFIX} ${text}`
      const res = await apiService.addComentarioOrden(selected.ordenId, payload, usuario.nombre || 'RRHH')
      if (!res.success) {
        window.alert(res.error || 'No se pudo guardar la nota.')
        return
      }
      setNotaRrhh('')
      const cRes = await apiService.getComentariosOrden(selected.ordenId)
      if (cRes.success && cRes.data) setComentarios(cRes.data)
    } finally {
      setGuardandoNota(false)
    }
  }

  const handlePlotAnalisis = async () => {
    if (!selected) return
    setPlotError(null)
    setPlotLoading(true)
    setPlotAnalysis('')
    try {
      const blobOrden = selectedOrden ? ordenToContextBlob(selectedOrden) : incidenciaToFallbackBlob(selected)
      const blobCom = comentariosToBlob(comentarios)
      const extra = plotExtraFocus.trim()
      const prefix = [
        'CONTEXTO INTERNO — INCIDENCIA / RECLAMO DE PRODUCCIÓN (Plotlab).',
        'Usá SOLO los datos del bloque siguiente; no inventes OPs, clientes ni montos.',
        '',
        '--- DATOS DE LA ORDEN ---',
        blobOrden,
        '',
        '--- COMENTARIOS Y SEGUIMIENTO EN LA OP ---',
        blobCom,
        extra ? `\n--- FOCO ADICIONAL SOLICITADO POR RRHH ---\n${extra}` : ''
      ].join('\n')

      const instructions = [
        'Actuá como analista senior de RRHH y calidad operativa en una empresa gráfica.',
        'Realizá un análisis RIGUROSO y estructurado en español, con secciones claras:',
        '1) Resumen ejecutivo (hechos según datos, sin especulación infundada).',
        '2) Cadena de impacto: cliente → producción → plazos / costo reputacional (inferencias explícitas como hipótesis).',
        '3) Factores humanos y de proceso que podrían haber contribuido (solo como hipótesis verificables).',
        '4) Riesgos (calidad, seguridad, reputación, repetición) y severidad estimada (baja/media/alta) con justificación.',
        '5) Plan de seguimiento sugerido para RRHH: pasos concretos, responsables sugeridos (rol, no nombre inventado), plazos.',
        '6) Preguntas abiertas para entrevistar o auditar.',
        '7) Si faltan datos críticos, indicá explícitamente qué falta pedir.',
        'No inventes números de OP ni datos de cliente que no estén en el contexto.'
      ].join('\n')

      const text = await generateContent({
        contents: instructions,
        extraContextPrefix: prefix,
        useCompleteContext: false,
        useMemory: false,
        learnFromResponse: false,
        includeAppManual: false,
        userName: usuario?.nombre
      })
      setPlotAnalysis(text.trim())
    } catch (e) {
      setPlotError(e instanceof Error ? e.message : 'Error en PlotAI.')
    } finally {
      setPlotLoading(false)
    }
  }

  const pieEstadoData = useMemo(
    () => stats.porEstadoKanban.map((x) => ({ name: x.estado.length > 28 ? `${x.estado.slice(0, 26)}…` : x.estado, value: x.count })),
    [stats.porEstadoKanban]
  )

  const mapaTableroRows = useMemo(() => {
    const max = Math.max(1, ...stats.porEstadoKanban.map((x) => x.count))
    return BOARD_COLUMNS.map((col) => {
      const hit = stats.porEstadoKanban.find((x) => x.estado.trim().toLowerCase() === col.label.trim().toLowerCase())
      const count = hit?.count ?? 0
      return {
        id: col.id,
        label: col.label,
        count,
        pctWidth: Math.round((count / max) * 100),
        accent: col.accent
      }
    })
  }, [stats.porEstadoKanban])

  if (authLoading || loading) {
    return (
      <div className="rrhh-inc-loading">
        <div className="spinner" />
        <p>Cargando incidencias e historial…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-inc-page">
      <header className="rrhh-inc-header">
        <div className="rrhh-inc-header-row">
          <div>
            <h1>⚠️ Incidencias (reclamos de OP)</h1>
            <p className="rrhh-inc-sub">
              Listado desde órdenes en reclamo y <strong>auditoría histórica</strong> (marcas / desmarcas). Incluye casos cerrados,
              estadísticas por etapa del tablero, sector y usuarios.
            </p>
          </div>
          <button type="button" className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← RRHH
          </button>
        </div>
      </header>

      {error && <div className="rrhh-inc-banner rrhh-inc-banner--error">{error}</div>}

      <div className="rrhh-inc-tabs">
        <button type="button" className={mainTab === 'lista' ? 'is-active' : ''} onClick={() => setMainTab('lista')}>
          Lista y detalle
        </button>
        <button type="button" className={mainTab === 'metricas' ? 'is-active' : ''} onClick={() => setMainTab('metricas')}>
          Estadísticas y mapa
        </button>
      </div>

      {mainTab === 'lista' && (
        <div className="rrhh-inc-layout">
          <aside className="rrhh-inc-sidebar">
            <div className="rrhh-inc-filter-row">
              <span>Vista</span>
              <select value={listaFiltro} onChange={(e) => setListaFiltro(e.target.value as ListaFiltro)}>
                <option value="activos">Solo activos</option>
                <option value="historicos">Histórico (cerrados)</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            <label className="rrhh-inc-search">
              <span>Buscar</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="OP, cliente, motivo, usuario…"
              />
            </label>
            <button type="button" className="rrhh-inc-refresh" onClick={() => void loadAll()}>
              Actualizar datos
            </button>
            <div className="rrhh-inc-count">{filteredIncidencias.length} caso{filteredIncidencias.length === 1 ? '' : 's'}</div>
            <ul className="rrhh-inc-list">
              {filteredIncidencias.map((r) => (
                <li key={r.ordenId}>
                  <button
                    type="button"
                    className={`rrhh-inc-list-item ${selectedId === r.ordenId ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(r.ordenId)}
                  >
                    <span className="rrhh-inc-op">
                      #{r.orden?.numero_op ?? r.ordenId}
                      <span className={`rrhh-inc-mini-badge ${r.activo ? 'is-open' : 'is-done'}`}>
                        {r.activo ? 'activo' : 'cerrado'}
                      </span>
                    </span>
                    <span className="rrhh-inc-client">{r.orden?.cliente ?? '— sin ficha —'}</span>
                    <span className="rrhh-inc-snippet">
                      {(() => {
                        const snip = (r.motivoDisplay || r.orden?.descripcion || '').trim()
                        return (
                          <>
                            {snip.slice(0, 72)}
                            {snip.length > 72 ? '…' : ''}
                          </>
                        )
                      })()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {filteredIncidencias.length === 0 && (
              <p className="rrhh-inc-empty">No hay casos con este filtro.</p>
            )}
          </aside>

          <main className="rrhh-inc-detail">
            {!selected ? (
              <p className="rrhh-inc-placeholder">Seleccioná un caso de la lista.</p>
            ) : (
              <>
                <section className="rrhh-inc-card">
                  <div className="rrhh-inc-card-head">
                    <h2>
                      OP #{selectedOrden?.numero_op ?? selected.ordenId}{' '}
                      <span className={`rrhh-inc-badge ${selected.activo ? '' : 'rrhh-inc-badge--muted'}`}>
                        {selected.activo ? 'En reclamo' : 'Cerrado'}
                      </span>
                    </h2>
                    <div className="rrhh-inc-actions">
                      {selectedOrden && (
                        <button
                          type="button"
                          className="rrhh-inc-btn-secondary"
                          onClick={() => navigate(`/op/${selectedOrden.numero_op}`)}
                        >
                          Abrir ficha OP
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rrhh-inc-problem-map-inline">
                    <span className="rrhh-inc-muted">Problema detectado en etapa del tablero (al marcar):</span>
                    <span
                      className="rrhh-inc-stage-pill"
                      style={{
                        borderColor: estadoToBoardAccent(selected.estadoAlMarcar, BOARD_COLUMNS),
                        color: estadoToBoardAccent(selected.estadoAlMarcar, BOARD_COLUMNS)
                      }}
                    >
                      {selected.estadoAlMarcar ?? '— sin dato en auditoría —'}
                    </span>
                  </div>

                  <dl className="rrhh-inc-dl">
                    <div>
                      <dt>Cliente</dt>
                      <dd>{selectedOrden?.cliente ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Estado actual OP</dt>
                      <dd>{selectedOrden?.estado ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Sector negocio</dt>
                      <dd>{selected.sectorLabel}</dd>
                    </div>
                    <div>
                      <dt>Ciclos reclamo</dt>
                      <dd>{selected.ciclosReclamo}</dd>
                    </div>
                    <div>
                      <dt>Última marca</dt>
                      <dd>{selected.usuarioMarca ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Primera apertura</dt>
                      <dd>{fmtDt(selected.tsPrimeraApertura)}</dd>
                    </div>
                    <div>
                      <dt>Último cierre</dt>
                      <dd>{fmtDt(selected.tsUltimoCierre)}</dd>
                    </div>
                  </dl>

                  <div className="rrhh-inc-motivo">
                    <h3>Motivo del reclamo</h3>
                    <p>{selected.motivoDisplay.trim() || '—'}</p>
                  </div>
                  <div className="rrhh-inc-desc">
                    <h3>Descripción del trabajo</h3>
                    <p>{(selectedOrden?.descripcion ?? '').trim() || '—'}</p>
                  </div>
                </section>

                <section className="rrhh-inc-card">
                  <h3>Auditoría de reclamo (historial)</h3>
                  {selected.eventosRelacionados.length === 0 ? (
                    <p className="rrhh-inc-muted">
                      Sin eventos tipados en historial (posible alta legacy). Datos tomados de la OP activa.
                    </p>
                  ) : (
                    <ul className="rrhh-inc-audit-list">
                      {selected.eventosRelacionados.map((ev, idx) => (
                        <li key={ev.id != null ? ev.id : `${ev.id_orden}-${ev.timestamp}-${idx}`}>
                          <div className="rrhh-inc-audit-meta">
                            <span className="rrhh-inc-audit-type">{ev.accion_tipo ?? '—'}</span>
                            <span>{fmtDt(ev.timestamp)}</span>
                            <span>{ev.nombre_usuario ?? '—'}</span>
                          </div>
                          {(ev.comentario ?? '').trim() && (
                            <p className="rrhh-inc-audit-comment">{(ev.comentario ?? '').trim()}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rrhh-inc-card">
                  <h3>Comentarios en la orden</h3>
                  {loadingComentarios ? (
                    <p>Cargando…</p>
                  ) : comentarios.length === 0 ? (
                    <p className="rrhh-inc-muted">Sin comentarios.</p>
                  ) : (
                    <ul className="rrhh-inc-comments">
                      {comentarios.map((c, idx) => (
                        <li key={c.id ?? idx}>
                          <div className="rrhh-inc-comment-meta">
                            <strong>{c.usuario_nombre ?? '—'}</strong>
                            <span>{fmtDt(c.timestamp ?? null)}</span>
                          </div>
                          <p>{(c.comentario ?? '').trim()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="rrhh-inc-note-box">
                    <label>
                      Registrar seguimiento RRHH (queda en historial de la OP)
                      <textarea
                        rows={4}
                        value={notaRrhh}
                        onChange={(e) => setNotaRrhh(e.target.value)}
                        placeholder="Acuerdos, entrevistas, medidas, derivaciones…"
                      />
                    </label>
                    <button
                      type="button"
                      className="rrhh-inc-btn-primary"
                      disabled={guardandoNota}
                      onClick={() => void handleRegistrarNota()}
                    >
                      {guardandoNota ? 'Guardando…' : 'Guardar nota'}
                    </button>
                  </div>
                </section>

                <section className="rrhh-inc-card rrhh-inc-card--plot">
                  <h3>PlotAI — análisis riguroso</h3>
                  <p className="rrhh-inc-muted">
                    Usa los datos de esta OP y los comentarios cargados. Podés acotar el foco.
                  </p>
                  <label className="rrhh-inc-focus">
                    Foco adicional (opcional)
                    <textarea
                      rows={2}
                      value={plotExtraFocus}
                      onChange={(e) => setPlotExtraFocus(e.target.value)}
                      placeholder="Ej.: evaluar riesgo de repetición y qué preguntar al encargado de sector."
                    />
                  </label>
                  <button
                    type="button"
                    className="rrhh-inc-btn-primary"
                    disabled={plotLoading}
                    onClick={() => void handlePlotAnalisis()}
                  >
                    {plotLoading ? 'Analizando…' : 'Generar análisis con PlotAI'}
                  </button>
                  {plotError && <p className="rrhh-inc-plot-error">{plotError}</p>}
                  {plotAnalysis && <pre className="rrhh-inc-plot-out">{plotAnalysis}</pre>}
                </section>
              </>
            )}
          </main>
        </div>
      )}

      {mainTab === 'metricas' && (
        <div className="rrhh-inc-metrics">
          <section className="rrhh-inc-card rrhh-inc-kpis">
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">OP con reclamo (únicas)</span>
              <strong>{stats.ordenesUnicasConReclamo}</strong>
            </div>
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">Activos</span>
              <strong>{stats.casosActivos}</strong>
            </div>
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">Cerrados</span>
              <strong>{stats.casosCerrados}</strong>
            </div>
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">Aperturas totales (hist.)</span>
              <strong>{stats.totalAperturasHistoricas}</strong>
            </div>
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">OP con &gt;1 ciclo</span>
              <strong>{stats.opsConReclamoMultiple}</strong>
            </div>
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">Días media resolución*</span>
              <strong>
                {stats.tiempoResolucion.mediaDias != null ? stats.tiempoResolucion.mediaDias.toFixed(1) : '—'}
              </strong>
            </div>
            <div className="rrhh-inc-kpi">
              <span className="rrhh-inc-kpi-label">Días mediana</span>
              <strong>
                {stats.tiempoResolucion.medianaDias != null ? stats.tiempoResolucion.medianaDias.toFixed(1) : '—'}
              </strong>
            </div>
            <div className="rrhh-inc-kpi rrhh-inc-kpi--note">
              <span className="rrhh-inc-kpi-label">Pares apertura→cierre</span>
              <strong>{stats.tiempoResolucion.muestras}</strong>
            </div>
          </section>
          <p className="rrhh-inc-footnote">
            * Tiempo entre última apertura y cierre registrados en auditoría por ciclo (muestras: {stats.tiempoResolucion.muestras}).
          </p>

          <section className="rrhh-inc-card">
            <h3>Mapa del problema — etapa del tablero al marcar reclamo</h3>
            <p className="rrhh-inc-muted">
              Barras proporcionales: dónde estaba la OP en el flujo cuando se registró el reclamo (según historial).
            </p>
            <div className="rrhh-inc-board-map">
              {mapaTableroRows.map((row) => (
                <div key={row.id} className="rrhh-inc-board-row">
                  <div className="rrhh-inc-board-label" style={{ color: row.accent }}>
                    {row.label}
                  </div>
                  <div className="rrhh-inc-board-track">
                    <div
                      className="rrhh-inc-board-fill"
                      style={{
                        width: `${row.pctWidth}%`,
                        background: row.count > 0 ? row.accent : 'transparent'
                      }}
                      title={`${row.count} reclamo(s) en esta etapa`}
                    />
                  </div>
                  <span className="rrhh-inc-board-count">{row.count}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="rrhh-inc-chart-grid">
            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Distribución por etapa (aperturas)</h4>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stats.porEstadoKanban} margin={{ top: 8, right: 8, left: 8, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="estado" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Aperturas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Activos vs cerrados</h4>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Activos', value: stats.casosActivos },
                      { name: 'Cerrados', value: stats.casosCerrados }
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    <Cell fill="#ef4444" />
                    <Cell fill="#22c55e" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </section>

            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Top usuarios que marcaron reclamo</h4>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  layout="vertical"
                  data={stats.porUsuarioMarca.slice(0, 12)}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="usuario" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Marcas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Sector de la OP (último estado conocido)</h4>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={stats.porSector.slice(0, 14)} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="sector" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="OP" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Aperturas por mes</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.porMesApertura}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="Aperturas" stroke="#f97316" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Ciclos de reclamo por OP</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.distribucionCiclos}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="ciclos" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="ops" name="Cantidad OP" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="rrhh-inc-card rrhh-inc-chart-card">
              <h4>Etapa (pie — mismos datos que el mapa)</h4>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieEstadoData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={(props: { name?: string; percent?: number }) =>
                      `${props.name ?? ''}: ${((props.percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieEstadoData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosIncidenciasPage
