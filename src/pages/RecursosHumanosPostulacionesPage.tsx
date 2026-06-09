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

const RecursosHumanosPostulacionesPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [rows, setRows] = useState<RrhhPostulacion[]>([])
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    if (!usuario?.id) return
    setLoading(true)
    const res = await apiService.rrhhPostulacionesListar({
      usuarioId: usuario.id,
      busqueda: busqueda.trim() || undefined,
      estado: estadoFilter || undefined,
      puesto: puestoFilter || undefined
    })
    if (res.success && res.data) setRows(res.data)
    setLoading(false)
  }, [usuario?.id, busqueda, estadoFilter, puestoFilter])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, canAccess, navigate, load])

  const puestosFlat = useMemo(
    () => PUESTOS_POSTULACION.flatMap((g) => g.puestos),
    []
  )

  const sortedRows = useMemo(() => {
    if (!Object.keys(aiScores).length) return rows
    return [...rows].sort((a, b) => {
      const sa = aiScores[a.id]?.score ?? -1
      const sb = aiScores[b.id]?.score ?? -1
      return sb - sa
    })
  }, [rows, aiScores])

  const runAiFilter = async () => {
    const q = aiQuery.trim()
    if (!q) return
    setAiLoading(true)
    const res = await apiService.rrhhPostulacionesFiltrarPlotAI(q)
    if (res.success && res.data?.resultados) {
      const map: Record<number, { score: number; motivo: string }> = {}
      res.data.resultados.forEach((r) => {
        map[r.id] = { score: r.match_score, motivo: r.motivo }
      })
      setAiScores(map)
    } else {
      alert(res.error || 'No se pudo aplicar el filtro PlotAI')
    }
    setAiLoading(false)
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
      const listRes = await apiService.rrhhPostulacionesListar({ usuarioId: usuario.id })
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

  return (
    <div className="rrhh-post-page">
      <header className="rrhh-post-header">
        <div>
          <h1>📄 Postulaciones y CVs</h1>
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

      {loading ? (
        <div className="rrhh-post-loading">Cargando postulaciones…</div>
      ) : sortedRows.length === 0 ? (
        <div className="rrhh-post-empty">
          <p>No hay postulaciones todavía.</p>
          <button type="button" className="rrhh-post-btn-primary" onClick={copyPublicLink}>
            Copiar link del formulario público
          </button>
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
