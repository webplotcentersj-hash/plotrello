import { useCallback, useEffect, useMemo, useState, memo, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhPostulacionActualizarEstado,
  rrhhPostulacionObtener,
  rrhhPostulacionesListar
} from '../services/rrhhPostulacionesService'
import type { RrhhPostulacion, RrhhPostulacionEstado } from '../types/api'
import { PUESTOS_POSTULACION } from '../data/puestosPostulacion'
import { buildWhatsappLink } from '../utils/whatsappLink'
import {
  FORMULARIO_FIELD_LABELS,
  formatFormularioField,
  formularioSlug,
  getFormularioRespuestas,
  isFormularioExterno
} from '../utils/rrhhFormularioExternoDisplay'
import './RecursosHumanosPostulacionesPage.css'

const ESTADOS: { value: RrhhPostulacionEstado | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'descartado', label: 'Descartado' }
]

const ESTADO_LABEL: Record<RrhhPostulacionEstado, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  entrevista: 'Entrevista',
  aprobado: 'Aprobado',
  descartado: 'Descartado'
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function isPdf(cv: RrhhPostulacion): boolean {
  if (!cv.cv_url) return false
  const mime = cv.cv_mime || ''
  const name = cv.cv_nombre || cv.cv_url
  return mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-AR')
}

const LIST_PAGE_SIZE = 16

async function getPlotAiApi() {
  const m = await import('../services/api')
  return m.default
}

const RecursosHumanosPostulacionesPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [rows, setRows] = useState<RrhhPostulacion[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<RrhhPostulacionEstado | ''>('nuevo')
  const [puestoFilter, setPuestoFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'' | 'formulario' | 'cv'>('')
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiScores, setAiScores] = useState<Record<number, { score: number; motivo: string }>>({})
  const [selected, setSelected] = useState<RrhhPostulacion | null>(null)
  const [detailNotas, setDetailNotas] = useState('')
  const [detailEstado, setDetailEstado] = useState<RrhhPostulacionEstado>('nuevo')
  const [saving, setSaving] = useState(false)
  const [reanalizando, setReanalizando] = useState(false)
  const [analizandoFormulario, setAnalizandoFormulario] = useState(false)
  const [resultCount, setResultCount] = useState<number | null>(null)
  const [visibleLimit, setVisibleLimit] = useState(LIST_PAGE_SIZE)

  const listFilters = useCallback(
    () => ({
      usuarioId: usuario!.id,
      busqueda: busqueda.trim() || undefined,
      estado: estadoFilter || undefined,
      puesto: puestoFilter || undefined
    }),
    [usuario?.id, busqueda, estadoFilter, puestoFilter]
  )

  const load = useCallback(async (): Promise<RrhhPostulacion[]> => {
    if (!usuario?.id) return []
    setLoading(true)
    const filters = listFilters()
    const res = await rrhhPostulacionesListar(filters)
    const data = res.success && res.data ? res.data : []
    if (res.success) {
      setRows(data)
      setHasSearched(true)
      setAiScores({})
      setVisibleLimit(LIST_PAGE_SIZE)
      setResultCount(data.length)
    } else if (res.error) {
      alert(res.error)
    }
    setLoading(false)
    return data
  }, [usuario?.id, listFilters])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) navigate('/')
  }, [authLoading, canAccess, navigate])

  useEffect(() => {
    if (authLoading || !canAccess || !usuario?.id) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      startTransition(() => {
        if (!cancelled) void load()
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [authLoading, canAccess, usuario?.id, load])

  const puestosFlat = useMemo(
    () => PUESTOS_POSTULACION.flatMap((g) => g.puestos),
    []
  )

  const sortedRows = useMemo(() => {
    let list = rows
    if (tipoFilter === 'formulario') {
      list = list.filter((r) => isFormularioExterno(r))
    } else if (tipoFilter === 'cv') {
      list = list.filter((r) => !isFormularioExterno(r))
    }
    if (Object.keys(aiScores).length > 0) {
      list = list.filter((r) => aiScores[r.id] != null)
    }
    if (!Object.keys(aiScores).length) return list
    return [...list].sort((a, b) => {
      const sa = aiScores[a.id]?.score ?? -1
      const sb = aiScores[b.id]?.score ?? -1
      return sb - sa
    })
  }, [rows, aiScores, tipoFilter])

  const buildCandidatosParaIA = (list: RrhhPostulacion[]) =>
    list.map((r) => {
      const meta = (r.metadata_ia || {}) as Record<string, unknown>
      return {
        id: r.id,
        nombre: r.nombre,
        puesto: r.puesto,
        resumen: typeof meta.resumen === 'string' ? meta.resumen : null,
        habilidades: Array.isArray(meta.habilidades) ? (meta.habilidades as string[]) : [],
        score_plot: r.score_ia ?? (typeof meta.score_plot === 'number' ? meta.score_plot : null)
      }
    })

  const runAiFilter = async () => {
    const q = aiQuery.trim()
    if (!q) {
      alert('Escribí qué perfil buscás (ej: diseñador con Illustrator).')
      return
    }

    setAiLoading(true)
    try {
      let candidatos = rows
      if (!hasSearched || candidatos.length === 0) {
        if (!busqueda.trim() && !estadoFilter && !puestoFilter) {
          alert('Primero pulsá Buscar con un criterio (nombre, estado o puesto) para acotar candidatos.')
          setAiLoading(false)
          return
        }
        candidatos = await load()
      }

      if (!candidatos.length) {
        alert('No hay postulaciones con esos filtros.')
        setAiLoading(false)
        return
      }

      const api = await getPlotAiApi()
      const res = await api.rrhhPostulacionesFiltrarPlotAI(q, buildCandidatosParaIA(candidatos))
      if (res.success && res.data?.resultados) {
        const map: Record<number, { score: number; motivo: string }> = {}
        res.data.resultados.forEach((r) => {
          map[r.id] = { score: r.match_score, motivo: r.motivo }
        })
        setAiScores(map)
        if (!Object.keys(map).length) {
          alert('PlotAI no encontró candidatos que encajen con esa búsqueda.')
        }
      } else {
        alert(res.error || 'No se pudo aplicar el filtro PlotAI')
      }
    } finally {
      setAiLoading(false)
    }
  }

  const clearAiFilter = () => {
    setAiQuery('')
    setAiScores({})
  }

  const openDetail = (row: RrhhPostulacion) => {
    startTransition(() => {
      setSelected(row)
      setDetailEstado(row.estado)
      setDetailNotas(row.notas_rrhh || '')
    })
    void rrhhPostulacionObtener(row.id).then((res) => {
      if (res.success && res.data) {
        startTransition(() => {
          setSelected(res.data!)
          setDetailEstado(res.data!.estado)
          setDetailNotas(res.data!.notas_rrhh || '')
        })
      }
    })
  }

  const saveDetail = async () => {
    if (!selected || !usuario?.id) return
    setSaving(true)
    const res = await rrhhPostulacionActualizarEstado(usuario.id, selected.id, detailEstado, detailNotas)
    if (res.success && res.data) {
      setRows((prev) => prev.map((r) => (r.id === res.data!.id ? res.data! : r)))
      setSelected(res.data)
    } else {
      alert(res.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const reanalizar = async () => {
    if (!selected || !usuario?.id || !selected.cv_url) return
    setReanalizando(true)
    const api = await getPlotAiApi()
    const res = await api.rrhhPostulacionReanalizarCv(selected.id, selected.cv_url, selected.puesto)
    if (res.success) {
      const full = await rrhhPostulacionObtener(selected.id)
      if (full.success && full.data) {
        setSelected(full.data)
        setRows((prev) => prev.map((r) => (r.id === full.data!.id ? full.data! : r)))
      }
    } else {
      alert(res.error || 'Error al analizar')
    }
    setReanalizando(false)
  }

  const analizarFormulario = async () => {
    if (!selected || !usuario?.id) return
    setAnalizandoFormulario(true)
    const api = await getPlotAiApi()
    const res = await api.rrhhPostulacionAnalizarFormulario(selected.id, selected)
    if (res.success) {
      const full = await rrhhPostulacionObtener(selected.id)
      if (full.success && full.data) {
        setSelected(full.data)
        setRows((prev) => prev.map((r) => (r.id === full.data!.id ? full.data! : r)))
      }
    } else {
      alert(res.error || 'Error al analizar formulario')
    }
    setAnalizandoFormulario(false)
  }

  const copyPublicLink = (path: string, label: string) => {
    const url = `${window.location.origin}${path}`
    void navigator.clipboard.writeText(url)
    alert(`Link copiado (${label}): ${url}`)
  }

  const meta = (selected?.metadata_ia || {}) as Record<string, unknown>
  const selectedEsFormulario = selected ? isFormularioExterno(selected) : false
  const formRespuestas = selected ? getFormularioRespuestas(selected) : {}
  const formSlug = selected ? formularioSlug(selected) : 'community-manager'

  const renderPlotAiMeta = () => (
    <>
      {typeof meta.resumen === 'string' && meta.resumen && <p>{meta.resumen}</p>}
      {Array.isArray(meta.habilidades) && meta.habilidades.length > 0 && (
        <div className="rrhh-post-tags">
          {(meta.habilidades as string[]).map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      )}
      {Array.isArray(meta.fortalezas_plot) && (meta.fortalezas_plot as string[]).length > 0 && (
        <p>
          <strong>Fortalezas Plot:</strong> {(meta.fortalezas_plot as string[]).join(', ')}
        </p>
      )}
      {Array.isArray(meta.gaps_plot) && (meta.gaps_plot as string[]).length > 0 && (
        <p>
          <strong>A mejorar:</strong> {(meta.gaps_plot as string[]).join(', ')}
        </p>
      )}
      {meta.score_plot != null && (
        <p>
          <strong>Score Plot:</strong> {String(meta.score_plot)}
        </p>
      )}
    </>
  )

  const aiMatchCount = Object.keys(aiScores).length
  const visibleCount = sortedRows.length
  const displayedRows = useMemo(
    () => sortedRows.slice(0, visibleLimit),
    [sortedRows, visibleLimit]
  )
  const hasMoreRows = sortedRows.length > visibleLimit
  const listLimitNote =
    hasSearched && resultCount != null && resultCount > rows.length
      ? ` (mostrando ${fmtCount(rows.length)} de ${fmtCount(resultCount)})`
      : ''

  return (
    <div className="rrhh-post-page">
      <header className="rrhh-post-header">
        <div>
          <div className="rrhh-post-title-row">
            <h1>📄 Postulaciones y CVs</h1>
            {hasSearched && resultCount != null && (
              <span className="rrhh-post-count-badge rrhh-post-count-badge--results" title="Resultados de la búsqueda">
                {fmtCount(resultCount)} resultado{resultCount === 1 ? '' : 's'}
              </span>
            )}
            {aiMatchCount > 0 && (
              <span className="rrhh-post-count-badge rrhh-post-count-badge--ai" title="Coincidencias PlotAI">
                {fmtCount(visibleCount)} con PlotAI
              </span>
            )}
          </div>
          <p>Bandeja PlotLab · candidatos y formularios de convocatoria · PlotAI</p>
        </div>
        <div className="rrhh-post-header-actions">
          <button
            type="button"
            className="rrhh-post-btn-outline"
            onClick={() => copyPublicLink('/trabaja-con-nosotros', 'CV')}
          >
            🔗 Link CV
          </button>
          <button
            type="button"
            className="rrhh-post-btn-outline"
            onClick={() => copyPublicLink('/convocatoria/community-manager', 'Formulario CM')}
          >
            📋 Link formulario CM
          </button>
          <button type="button" className="rrhh-post-btn-outline" onClick={() => navigate('/rrhh')}>
            ← RRHH
          </button>
        </div>
      </header>

      <div className="rrhh-post-filters">
        <div className="rrhh-post-search-row">
          <input
            type="search"
            placeholder="Buscar por nombre, email, puesto, skills…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as RrhhPostulacionEstado | '')}>
            {ESTADOS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={puestoFilter} onChange={(e) => setPuestoFilter(e.target.value)}>
            <option value="">Todos los puestos</option>
            {puestosFlat.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value as '' | 'formulario' | 'cv')}>
            <option value="">Todos los tipos</option>
            <option value="formulario">📋 Solo formularios</option>
            <option value="cv">📎 Solo con CV</option>
          </select>
          <button type="button" className="rrhh-post-btn-primary" onClick={() => void load()}>
            Buscar
          </button>
        </div>

        <div className="rrhh-post-ai-row">
          <span className="rrhh-post-ai-badge">✨ PlotAI</span>
          <input
            type="text"
            placeholder='Ej: "diseñador con Illustrator y buena actitud en equipo"'
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runAiFilter()}
          />
          <button type="button" className="rrhh-post-btn-ai" onClick={() => void runAiFilter()} disabled={aiLoading}>
            {aiLoading ? 'Filtrando…' : 'Filtrar con IA'}
          </button>
          {Object.keys(aiScores).length > 0 && (
            <button type="button" className="rrhh-post-btn-outline" onClick={clearAiFilter}>
              Limpiar IA
            </button>
          )}
        </div>
      </div>

      {hasSearched && resultCount != null && !loading && (
        <p className="rrhh-post-results-bar">
          {aiMatchCount > 0 ? (
            <>
              Mostrando <strong>{fmtCount(visibleCount)}</strong> candidatos con PlotAI
              {resultCount > visibleCount ? ` (de ${fmtCount(resultCount)} en la búsqueda)` : ''}
            </>
          ) : (
            <>
              <strong>{fmtCount(resultCount)}</strong> postulación{resultCount === 1 ? '' : 'es'} encontrada
              {resultCount === 1 ? '' : 's'}
              {listLimitNote}
            </>
          )}
        </p>
      )}

      {loading ? (
        <div className="rrhh-post-loading">Buscando postulaciones…</div>
      ) : !hasSearched ? (
        <div className="rrhh-post-empty">
          <p>Cargando candidatos…</p>
          <p className="rrhh-post-empty-hint">
            Por defecto se buscan postulaciones en estado <strong>Nuevo</strong>. Cambiá el filtro de estado para ver
            el historial completo.
          </p>
          <button
            type="button"
            className="rrhh-post-btn-primary"
            onClick={() => copyPublicLink('/trabaja-con-nosotros', 'CV')}
          >
            Copiar link del formulario CV
          </button>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="rrhh-post-empty">
          <p>No hay postulaciones con esos criterios.</p>
          {Object.keys(aiScores).length > 0 && (
            <button type="button" className="rrhh-post-btn-outline" onClick={clearAiFilter}>
              Limpiar filtro PlotAI
            </button>
          )}
        </div>
      ) : (
        <div className="rrhh-post-grid">
          {displayedRows.map((row) => {
            const ia = row.metadata_ia as Record<string, unknown>
            const esFormulario = isFormularioExterno(row)
            const formResp = esFormulario ? getFormularioRespuestas(row) : {}
            const scorePlot = row.score_ia ?? (ia.score_plot as number | undefined)
            const aiMatch = aiScores[row.id]
            const wa = buildWhatsappLink(
              row.telefono,
              `Hola ${row.nombre}, te escribimos desde Recursos Humanos de Plot Center respecto a tu postulación como ${row.puesto}.`
            )
            return (
              <article
                key={row.id}
                className={`rrhh-post-card estado-${row.estado}${aiMatch ? ' ai-highlight' : ''}`}
                onClick={() => openDetail(row)}
              >
                <div className="rrhh-post-card-top">
                  <h3>{row.nombre}</h3>
                  {scorePlot != null && Number.isFinite(scorePlot) && (
                    <span className="rrhh-post-score" title="Score Plot">
                      {Math.round(scorePlot)}%
                    </span>
                  )}
                  {aiMatch && (
                    <span className="rrhh-post-ai-match" title={aiMatch.motivo}>
                      IA {aiMatch.score}%
                    </span>
                  )}
                </div>
                <p className="rrhh-post-puesto">{row.puesto}</p>
                <p className="rrhh-post-email">{row.email}</p>
                <div className="rrhh-post-card-meta">
                  <span className={`rrhh-post-estado ${row.estado}`}>{ESTADO_LABEL[row.estado]}</span>
                  {esFormulario && <span className="rrhh-post-form-badge">📋 Formulario</span>}
                  {row.legacy_id != null && <span className="rrhh-post-legacy">Histórico</span>}
                  <span className="rrhh-post-fecha">{fmtFecha(row.created_at)}</span>
                </div>
                {typeof ia.resumen === 'string' && ia.resumen && (
                  <p className="rrhh-post-resumen">{(ia.resumen as string).slice(0, 120)}…</p>
                )}
                {esFormulario && formResp.motivacion_plot && (
                  <p className="rrhh-post-resumen">{formResp.motivacion_plot.slice(0, 120)}…</p>
                )}
                <div className="rrhh-post-card-actions" onClick={(e) => e.stopPropagation()}>
                  {row.cv_url && (
                    <a href={row.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-mini">
                      📎 CV
                    </a>
                  )}
                  {esFormulario && !row.cv_url && (
                    <span className="rrhh-post-btn-mini rrhh-post-btn-mini--muted">📋 Sin CV</span>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-wa">
                      WhatsApp
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {hasSearched && hasMoreRows && !loading && (
        <div className="rrhh-post-load-more">
          <button
            type="button"
            className="rrhh-post-btn-outline"
            onClick={() => setVisibleLimit((n) => n + LIST_PAGE_SIZE)}
          >
            Cargar más ({fmtCount(sortedRows.length - visibleLimit)} restantes)
          </button>
        </div>
      )}

      {selected && (
        <div className="rrhh-post-modal-overlay" onClick={() => setSelected(null)}>
          <div className="rrhh-post-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{selected.nombre}</h2>
              <button type="button" className="rrhh-post-modal-close" onClick={() => setSelected(null)}>
                ×
              </button>
            </header>
            <div className="rrhh-post-modal-body">
              <div className="rrhh-post-modal-col">
                <p>
                  <strong>Email:</strong> {selected.email}
                </p>
                <p>
                  <strong>Teléfono:</strong> {selected.telefono || '—'}
                </p>
                <p>
                  <strong>Puesto:</strong> {selected.puesto}
                </p>
                {selected.mensaje && (
                  <p>
                    <strong>Resumen:</strong> {selected.mensaje}
                  </p>
                )}
                {selectedEsFormulario && (
                  <div className="rrhh-post-form-detail">
                    <h3>📋 Respuestas del formulario</h3>
                    {Object.entries(FORMULARIO_FIELD_LABELS).map(([key, label]) => {
                      const val = formRespuestas[key]
                      if (!val?.trim()) return null
                      return (
                        <div key={key} className="rrhh-post-form-field">
                          <strong>{label}</strong>
                          <p>{formatFormularioField(key, val, formSlug)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
                <label>
                  Estado
                  <select value={detailEstado} onChange={(e) => setDetailEstado(e.target.value as RrhhPostulacionEstado)}>
                    {ESTADOS.filter((e) => e.value).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notas RRHH
                  <textarea value={detailNotas} onChange={(e) => setDetailNotas(e.target.value)} rows={3} />
                </label>
                <div className="rrhh-post-modal-actions">
                  <button type="button" className="rrhh-post-btn-primary" onClick={() => void saveDetail()} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  {selectedEsFormulario && (
                    <button
                      type="button"
                      className="rrhh-post-btn-ai"
                      onClick={() => void analizarFormulario()}
                      disabled={analizandoFormulario}
                    >
                      {analizandoFormulario ? 'Analizando…' : '✨ Analizar con PlotAI'}
                    </button>
                  )}
                  {selectedEsFormulario && (
                    <button
                      type="button"
                      className="rrhh-post-btn-outline"
                      onClick={() => {
                        void import('../utils/rrhhPostulacionFormularioPdf').then((m) =>
                          m.downloadPostulacionFormularioPdf(selected)
                        )
                      }}
                    >
                      Descargar PDF
                    </button>
                  )}
                  {selected.cv_url && (
                    <button type="button" className="rrhh-post-btn-ai" onClick={() => void reanalizar()} disabled={reanalizando}>
                      {reanalizando ? 'Analizando…' : '✨ Re-analizar CV'}
                    </button>
                  )}
                  {buildWhatsappLink(selected.telefono) && (
                    <a
                      href={buildWhatsappLink(
                        selected.telefono,
                        `Hola ${selected.nombre}, te contactamos desde RRHH de Plot Center.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rrhh-post-btn-wa"
                    >
                      WhatsApp
                    </a>
                  )}
                  {selected.cv_url && (
                    <a href={selected.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-outline">
                      Descargar CV
                    </a>
                  )}
                </div>
              </div>
              <div className="rrhh-post-modal-col rrhh-post-modal-ia">
                <h3>✨ Análisis PlotAI</h3>
                {selectedEsFormulario && !meta.resumen && (
                  <p className="rrhh-post-form-modal-note">
                    Postulación por formulario de convocatoria. Usá «Analizar con PlotAI» para evaluar al candidato.
                  </p>
                )}
                {renderPlotAiMeta()}
                {!selectedEsFormulario && selected.cv_url && isPdf(selected) && (
                  <a href={selected.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-outline">
                    Abrir CV en nueva pestaña
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(RecursosHumanosPostulacionesPage)
