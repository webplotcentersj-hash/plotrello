import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { RrhhPostulacion, RrhhPostulacionEstado } from '../types/api'
import { PUESTOS_POSTULACION } from '../data/puestosPostulacion'
import { buildWhatsappLink } from '../utils/whatsappLink'
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
  const mime = cv.cv_mime || ''
  const name = cv.cv_nombre || cv.cv_url
  return mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-AR')
}

const RecursosHumanosPostulacionesPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [rows, setRows] = useState<RrhhPostulacion[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<RrhhPostulacionEstado | ''>('')
  const [puestoFilter, setPuestoFilter] = useState('')
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiScores, setAiScores] = useState<Record<number, { score: number; motivo: string }>>({})
  const [hovered, setHovered] = useState<RrhhPostulacion | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState<RrhhPostulacion | null>(null)
  const [detailNotas, setDetailNotas] = useState('')
  const [detailEstado, setDetailEstado] = useState<RrhhPostulacionEstado>('nuevo')
  const [saving, setSaving] = useState(false)
  const [reanalizando, setReanalizando] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [resultCount, setResultCount] = useState<number | null>(null)

  const refreshTotalCount = useCallback(async () => {
    if (!usuario?.id) return
    const res = await apiService.rrhhPostulacionesContar({ usuarioId: usuario.id })
    if (res.success && res.data != null) setTotalCount(res.data)
  }, [usuario?.id])

  const load = useCallback(async (): Promise<RrhhPostulacion[]> => {
    if (!usuario?.id) return []
    setLoading(true)
    const filters = {
      usuarioId: usuario.id,
      busqueda: busqueda.trim() || undefined,
      estado: estadoFilter || undefined,
      puesto: puestoFilter || undefined
    }
    const [res, countRes] = await Promise.all([
      apiService.rrhhPostulacionesListar(filters),
      apiService.rrhhPostulacionesContar(filters)
    ])
    const data = res.success && res.data ? res.data : []
    if (res.success) {
      setRows(data)
      setHasSearched(true)
      setAiScores({})
    } else if (res.error) {
      alert(res.error)
    }
    if (countRes.success && countRes.data != null) {
      setResultCount(countRes.data)
    } else {
      setResultCount(data.length)
    }
    setLoading(false)
    return data
  }, [usuario?.id, busqueda, estadoFilter, puestoFilter])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/')
      return
    }
    void refreshTotalCount()
  }, [authLoading, canAccess, navigate, refreshTotalCount])

  const puestosFlat = useMemo(
    () => PUESTOS_POSTULACION.flatMap((g) => g.puestos),
    []
  )

  const sortedRows = useMemo(() => {
    let list = rows
    if (Object.keys(aiScores).length > 0) {
      list = rows.filter((r) => aiScores[r.id] != null)
    }
    if (!Object.keys(aiScores).length) return list
    return [...list].sort((a, b) => {
      const sa = aiScores[a.id]?.score ?? -1
      const sb = aiScores[b.id]?.score ?? -1
      return sb - sa
    })
  }, [rows, aiScores])

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

      const res = await apiService.rrhhPostulacionesFiltrarPlotAI(q, buildCandidatosParaIA(candidatos))
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

  const onRowEnter = (row: RrhhPostulacion, e: React.MouseEvent) => {
    setHovered(row)
    setHoverPos({ x: e.clientX, y: e.clientY })
  }

  const onRowMove = (e: React.MouseEvent) => {
    setHoverPos({ x: e.clientX, y: e.clientY })
  }

  const openDetail = (row: RrhhPostulacion) => {
    setSelected(row)
    setDetailEstado(row.estado)
    setDetailNotas(row.notas_rrhh || '')
  }

  const saveDetail = async () => {
    if (!selected || !usuario?.id) return
    setSaving(true)
    const res = await apiService.rrhhPostulacionActualizarEstado(
      usuario.id,
      selected.id,
      detailEstado,
      detailNotas
    )
    if (res.success && res.data) {
      setRows((prev) => prev.map((r) => (r.id === res.data!.id ? res.data! : r)))
      setSelected(res.data)
    } else {
      alert(res.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const reanalizar = async () => {
    if (!selected || !usuario?.id) return
    setReanalizando(true)
    const res = await apiService.rrhhPostulacionReanalizarCv(
      selected.id,
      selected.cv_url,
      selected.puesto
    )
    if (res.success) {
      const listRes = await apiService.rrhhPostulacionesListar({
        usuarioId: usuario.id,
        busqueda: busqueda.trim() || undefined,
        estado: estadoFilter || undefined,
        puesto: puestoFilter || undefined
      })
      if (listRes.success && listRes.data) {
        setRows(listRes.data)
        const updated = listRes.data.find((r) => r.id === selected.id)
        if (updated) setSelected(updated)
      }
    } else {
      alert(res.error || 'Error al analizar')
    }
    setReanalizando(false)
  }

  const copyPublicLink = () => {
    const url = `${window.location.origin}/trabaja-con-nosotros`
    void navigator.clipboard.writeText(url)
    alert('Link copiado: ' + url)
  }

  const meta = (selected?.metadata_ia || {}) as Record<string, unknown>

  const aiMatchCount = Object.keys(aiScores).length
  const visibleCount = sortedRows.length
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
            {totalCount != null && (
              <span className="rrhh-post-count-badge" title="Total en la base">
                {fmtCount(totalCount)} en total
              </span>
            )}
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
          <p>Bandeja de candidatos · PlotAI · Vista previa al pasar el mouse</p>
        </div>
        <div className="rrhh-post-header-actions">
          <button type="button" className="rrhh-post-btn-outline" onClick={copyPublicLink}>
            🔗 Link público
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
          <p>Usá la barra de búsqueda o los filtros y pulsá <strong>Buscar</strong> para ver candidatos.</p>
          <p className="rrhh-post-empty-hint">Las postulaciones no se listan solas: acotá con búsqueda o filtros.</p>
          <button type="button" className="rrhh-post-btn-primary" onClick={copyPublicLink}>
            Copiar link del formulario público
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
          {sortedRows.map((row) => {
            const ia = row.metadata_ia as Record<string, unknown>
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
                onMouseEnter={(e) => onRowEnter(row, e)}
                onMouseMove={onRowMove}
                onMouseLeave={() => setHovered(null)}
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
                  {row.legacy_id != null && <span className="rrhh-post-legacy">Histórico</span>}
                  <span className="rrhh-post-fecha">{fmtFecha(row.created_at)}</span>
                </div>
                {typeof ia.resumen === 'string' && ia.resumen && (
                  <p className="rrhh-post-resumen">{(ia.resumen as string).slice(0, 120)}…</p>
                )}
                <div className="rrhh-post-card-actions" onClick={(e) => e.stopPropagation()}>
                  <a href={row.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-mini">
                    📎 CV
                  </a>
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

      {hovered && (
        <div
          className="rrhh-post-preview"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 340),
            top: Math.min(hoverPos.y + 16, window.innerHeight - 420)
          }}
        >
          <strong>{hovered.nombre}</strong>
          <span className="rrhh-post-preview-puesto">{hovered.puesto}</span>
          {isPdf(hovered) ? (
            <iframe title="Vista previa CV" src={`${hovered.cv_url}#toolbar=0`} className="rrhh-post-preview-frame" />
          ) : (
            <div className="rrhh-post-preview-fallback">
              <p>Vista previa no disponible para este formato.</p>
              <a href={hovered.cv_url} target="_blank" rel="noopener noreferrer">
                Abrir {hovered.cv_nombre || 'archivo'}
              </a>
            </div>
          )}
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
                    <strong>Mensaje:</strong> {selected.mensaje}
                  </p>
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
                  <button type="button" className="rrhh-post-btn-ai" onClick={() => void reanalizar()} disabled={reanalizando}>
                    {reanalizando ? 'Analizando…' : '✨ Re-analizar CV'}
                  </button>
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
                  <a href={selected.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-outline">
                    Descargar CV
                  </a>
                </div>
              </div>
              <div className="rrhh-post-modal-col rrhh-post-modal-ia">
                <h3>✨ Análisis PlotAI</h3>
                {typeof meta.resumen === 'string' && <p>{meta.resumen}</p>}
                {Array.isArray(meta.habilidades) && meta.habilidades.length > 0 && (
                  <div className="rrhh-post-tags">
                    {(meta.habilidades as string[]).map((h) => (
                      <span key={h}>{h}</span>
                    ))}
                  </div>
                )}
                {Array.isArray(meta.fortalezas_plot) && (
                  <p>
                    <strong>Fortalezas Plot:</strong> {(meta.fortalezas_plot as string[]).join(', ')}
                  </p>
                )}
                {Array.isArray(meta.gaps_plot) && (meta.gaps_plot as string[]).length > 0 && (
                  <p>
                    <strong>A mejorar:</strong> {(meta.gaps_plot as string[]).join(', ')}
                  </p>
                )}
                {isPdf(selected) && (
                  <iframe title="CV" src={`${selected.cv_url}#toolbar=0`} className="rrhh-post-modal-pdf" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosPostulacionesPage
