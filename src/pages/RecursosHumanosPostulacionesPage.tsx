import { useCallback, useEffect, useMemo, useState, memo, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  RRHH_POSTULACIONES_PAGE_SIZE,
  rrhhPostulacionActualizarEstado,
  rrhhPostulacionIngresar,
  rrhhPostulacionObtener,
  rrhhPostulacionesContar,
  rrhhPostulacionesFunnel,
  rrhhPostulacionesListar,
  sugerirNombreUsuarioLogin
} from '../services/rrhhPostulacionesService'
import type { RrhhPostulacion, RrhhPostulacionEstado, RrhhPostulacionesFunnel, UserRole } from '../types/api'
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
  { value: 'oferta', label: 'Oferta' },
  { value: 'ingresado', label: 'Ingresado' },
  { value: 'descartado', label: 'Descartado' }
]

const ESTADO_LABEL: Record<RrhhPostulacionEstado, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  entrevista: 'Entrevista',
  oferta: 'Oferta',
  ingresado: 'Ingresado',
  descartado: 'Descartado'
}

const FUNNEL_STEPS: { key: keyof RrhhPostulacionesFunnel; label: string; estado: RrhhPostulacionEstado | '' }[] = [
  { key: 'postulan', label: 'Postulan', estado: '' },
  { key: 'entrevista', label: 'Entrevista', estado: 'entrevista' },
  { key: 'oferta', label: 'Oferta', estado: 'oferta' },
  { key: 'ingresado', label: 'Ingresaron', estado: 'ingresado' }
]

const ROLES_ALTA: { value: UserRole; label: string }[] = [
  { value: 'mostrador', label: 'Mostrador' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'imprenta', label: 'Imprenta' },
  { value: 'taller-grafico', label: 'Taller gráfico' },
  { value: 'instalaciones', label: 'Instalaciones' },
  { value: 'metalurgica', label: 'Metalúrgica' },
  { value: 'caja', label: 'Caja' },
  { value: 'compras', label: 'Compras' },
  { value: 'asesor-tecnico', label: 'Asesor técnico' },
  { value: 'presupuestos', label: 'Presupuestos' },
  { value: 'administracion', label: 'Administración' },
  { value: 'recursos-humanos', label: 'Recursos humanos' }
]

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromDatetimeLocalValue(local: string): string | null {
  if (!local.trim()) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<RrhhPostulacionEstado | ''>('nuevo')
  const [puestoFilter, setPuestoFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'' | 'formulario' | 'cv'>('cv')
  const [selected, setSelected] = useState<RrhhPostulacion | null>(null)
  const [detailNotas, setDetailNotas] = useState('')
  const [detailEstado, setDetailEstado] = useState<RrhhPostulacionEstado>('nuevo')
  const [detailEntrevistaLocal, setDetailEntrevistaLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [reanalizando, setReanalizando] = useState(false)
  const [analizandoFormulario, setAnalizandoFormulario] = useState(false)
  const [resultCount, setResultCount] = useState<number | null>(null)
  const [funnel, setFunnel] = useState<RrhhPostulacionesFunnel | null>(null)
  const [showIngresarModal, setShowIngresarModal] = useState(false)
  const [ingresarLogin, setIngresarLogin] = useState('')
  const [ingresarPassword, setIngresarPassword] = useState('')
  const [ingresarRol, setIngresarRol] = useState<UserRole>('mostrador')
  const [ingresando, setIngresando] = useState(false)

  const listFilters = useCallback(
    () => ({
      usuarioId: usuario!.id,
      busqueda: busqueda.trim() || undefined,
      estado: estadoFilter || undefined,
      puesto: puestoFilter || undefined,
      tipo: tipoFilter || undefined
    }),
    [usuario?.id, busqueda, estadoFilter, puestoFilter, tipoFilter]
  )

  const loadFunnel = useCallback(async () => {
    if (!usuario?.id) return
    const res = await rrhhPostulacionesFunnel({
      usuarioId: usuario.id,
      tipo: tipoFilter || undefined
    })
    if (res.success && res.data) setFunnel(res.data)
  }, [usuario?.id, tipoFilter])

  const load = useCallback(async (): Promise<RrhhPostulacion[]> => {
    if (!usuario?.id) return []
    setLoading(true)
    const filters = listFilters()
    const [res, countRes] = await Promise.all([
      rrhhPostulacionesListar({
        ...filters,
        limite: RRHH_POSTULACIONES_PAGE_SIZE,
        offset: 0
      }),
      rrhhPostulacionesContar(filters),
      loadFunnel()
    ])
    const data = res.success && res.data ? res.data : []
    if (res.success) {
      setRows(data)
      setHasSearched(true)
      setResultCount(countRes.success && countRes.data != null ? countRes.data : data.length)
    } else if (res.error) {
      alert(res.error)
    }
    setLoading(false)
    return data
  }, [usuario?.id, listFilters, loadFunnel])

  const loadMore = useCallback(async () => {
    if (!usuario?.id || loading || loadingMore) return
    const total = resultCount ?? 0
    if (rows.length >= total) return
    setLoadingMore(true)
    const filters = listFilters()
    const res = await rrhhPostulacionesListar({
      ...filters,
      limite: RRHH_POSTULACIONES_PAGE_SIZE,
      offset: rows.length
    })
    if (res.success && res.data) {
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        const next = res.data!.filter((r) => !seen.has(r.id))
        return next.length ? [...prev, ...next] : prev
      })
    } else if (res.error) {
      alert(res.error)
    }
    setLoadingMore(false)
  }, [usuario?.id, loading, loadingMore, resultCount, rows.length, listFilters])

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

  const openDetail = (row: RrhhPostulacion) => {
    startTransition(() => {
      setSelected(row)
      setDetailEstado(row.estado)
      setDetailNotas(row.notas_rrhh || '')
      setDetailEntrevistaLocal(toDatetimeLocalValue(row.entrevista_at))
      setShowIngresarModal(false)
    })
    void rrhhPostulacionObtener(row.id).then((res) => {
      if (res.success && res.data) {
        startTransition(() => {
          setSelected(res.data!)
          setDetailEstado(res.data!.estado)
          setDetailNotas(res.data!.notas_rrhh || '')
          setDetailEntrevistaLocal(toDatetimeLocalValue(res.data!.entrevista_at))
        })
      }
    })
  }

  const saveDetail = async () => {
    if (!selected || !usuario?.id) return
    if (detailEstado === 'ingresado' && !selected.id_usuario) {
      setIngresarLogin(sugerirNombreUsuarioLogin(selected))
      setIngresarPassword('')
      setIngresarRol('mostrador')
      setShowIngresarModal(true)
      return
    }
    if (detailEstado === 'entrevista') {
      const iso = fromDatetimeLocalValue(detailEntrevistaLocal)
      if (!iso && !selected.entrevista_at) {
        alert('Indicá fecha y hora de la entrevista')
        return
      }
    }
    setSaving(true)
    const res = await rrhhPostulacionActualizarEstado(usuario.id, selected.id, detailEstado, detailNotas, {
      entrevistaAt: fromDatetimeLocalValue(detailEntrevistaLocal),
      idUsuario: selected.id_usuario ?? null
    })
    if (res.success && res.data) {
      setRows((prev) => prev.map((r) => (r.id === res.data!.id ? res.data! : r)))
      setSelected(res.data)
      setDetailEntrevistaLocal(toDatetimeLocalValue(res.data.entrevista_at))
      void loadFunnel()
    } else {
      alert(res.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const confirmarIngreso = async () => {
    if (!selected || !usuario?.id) return
    if (!ingresarLogin.trim() || ingresarPassword.length < 4) {
      alert('Completá usuario (login) y una contraseña de al menos 4 caracteres')
      return
    }
    setIngresando(true)
    const res = await rrhhPostulacionIngresar({
      gestorId: usuario.id,
      postulacion: selected,
      loginNombre: ingresarLogin.trim(),
      password: ingresarPassword,
      rol: ingresarRol,
      notas: detailNotas
    })
    if (res.success && res.data) {
      setRows((prev) => prev.map((r) => (r.id === res.data!.id ? res.data! : r)))
      setSelected(res.data)
      setDetailEstado('ingresado')
      setShowIngresarModal(false)
      void loadFunnel()
      if (res.error) alert(res.error)
      else alert(`Ingreso OK. Usuario #${res.data.id_usuario} y legajo creados.`)
    } else {
      alert(res.error || 'No se pudo completar el ingreso')
    }
    setIngresando(false)
  }

  const applyFunnelFilter = (estado: RrhhPostulacionEstado | '') => {
    setEstadoFilter(estado)
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

  const hasMoreRows = resultCount != null && rows.length < resultCount
  const remainingRows = hasMoreRows ? Math.max(0, (resultCount ?? 0) - rows.length) : 0
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
          </div>
          <p>Bandeja PlotLab · pipeline de selección y conversión</p>
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

      {funnel && (
        <div className="rrhh-post-funnel" role="navigation" aria-label="Funnel de conversión">
          {FUNNEL_STEPS.map((step) => (
            <button
              key={step.key}
              type="button"
              className={`rrhh-post-funnel-step${estadoFilter === step.estado ? ' active' : ''}`}
              onClick={() => applyFunnelFilter(step.estado)}
              title={
                step.estado
                  ? `Filtrar por ${step.label}`
                  : 'Ver todas las postulaciones (sin filtro de estado)'
              }
            >
              <strong>{fmtCount(funnel[step.key])}</strong>
              <span>{step.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rrhh-post-filters">
        <div className="rrhh-post-search-hero">
          <input
            type="search"
            className="rrhh-post-search-input"
            placeholder="Buscar por nombre, email, puesto, skills…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            aria-label="Buscar postulaciones"
          />
          <button type="button" className="rrhh-post-btn-primary rrhh-post-btn-search" onClick={() => void load()}>
            Buscar
          </button>
        </div>
        <div className="rrhh-post-filter-row">
          <span className="rrhh-post-filter-label">Filtros</span>
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
            <option value="cv">📎 Solo con CV</option>
            <option value="formulario">📋 Solo formularios</option>
          </select>
        </div>
      </div>

      {hasSearched && resultCount != null && !loading && (
        <p className="rrhh-post-results-bar">
          <strong>{fmtCount(resultCount)}</strong> postulación{resultCount === 1 ? '' : 'es'} encontrada
          {resultCount === 1 ? '' : 's'}
          {listLimitNote}
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
      ) : rows.length === 0 ? (
        <div className="rrhh-post-empty">
          <p>No hay postulaciones con esos criterios.</p>
        </div>
      ) : (
        <div className="rrhh-post-grid">
          {rows.map((row) => {
            const ia = row.metadata_ia as Record<string, unknown>
            const esFormulario = isFormularioExterno(row)
            const formResp = esFormulario ? getFormularioRespuestas(row) : {}
            const scorePlot = row.score_ia ?? (ia.score_plot as number | undefined)
            const wa = buildWhatsappLink(
              row.telefono,
              `Hola ${row.nombre}, te escribimos desde Recursos Humanos de Plot Center respecto a tu postulación como ${row.puesto}.`
            )
            return (
              <article
                key={row.id}
                className={`rrhh-post-card estado-${row.estado}`}
                onClick={() => openDetail(row)}
              >
                <div className="rrhh-post-card-top">
                  <h3>{row.nombre}</h3>
                  {scorePlot != null && Number.isFinite(scorePlot) && (
                    <span className="rrhh-post-score" title="Score Plot">
                      {Math.round(scorePlot)}%
                    </span>
                  )}
                </div>
                <p className="rrhh-post-puesto">{row.puesto}</p>
                <p className="rrhh-post-email">{row.email}</p>
                <div className="rrhh-post-card-meta">
                  <span className={`rrhh-post-estado ${row.estado}`}>{ESTADO_LABEL[row.estado] || row.estado}</span>
                  {esFormulario && <span className="rrhh-post-form-badge">📋 Formulario</span>}
                  {row.id_usuario != null && <span className="rrhh-post-form-badge">Usuario #{row.id_usuario}</span>}
                  {row.entrevista_at && (
                    <span className="rrhh-post-fecha" title="Entrevista">
                      Entrevista {fmtFecha(row.entrevista_at)}
                    </span>
                  )}
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
                  {row.cv_url ? (
                    <a href={row.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-mini">
                      📎 CV
                    </a>
                  ) : (
                    <span className="rrhh-post-btn-mini rrhh-post-btn-mini--muted">Sin CV</span>
                  )}
                  {esFormulario && <span className="rrhh-post-btn-mini rrhh-post-btn-mini--muted">📋 Form</span>}
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
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore
              ? 'Cargando…'
              : `Cargar más (${fmtCount(Math.min(RRHH_POSTULACIONES_PAGE_SIZE, remainingRows))} de ${fmtCount(remainingRows)} restantes)`}
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
                <p className="rrhh-post-pipeline-hint">
                  Pipeline: Nuevo → En revisión → Entrevista → Oferta → Ingresado
                </p>
                {(detailEstado === 'entrevista' || selected.entrevista_at) && (
                  <label>
                    Fecha y hora de entrevista
                    <input
                      type="datetime-local"
                      value={detailEntrevistaLocal}
                      onChange={(e) => setDetailEntrevistaLocal(e.target.value)}
                    />
                  </label>
                )}
                {selected.id_usuario != null && (
                  <p>
                    <strong>Usuario vinculado:</strong> #{selected.id_usuario}{' '}
                    <button
                      type="button"
                      className="rrhh-post-btn-outline"
                      onClick={() =>
                        navigate('/rrhh/usuarios', { state: { openEditUserId: selected.id_usuario } })
                      }
                    >
                      Ir a legajo / usuario
                    </button>
                  </p>
                )}
                {selected.oferta_at && (
                  <p className="rrhh-post-pipeline-hint">Oferta: {fmtFecha(selected.oferta_at)}</p>
                )}
                {selected.ingresado_at && (
                  <p className="rrhh-post-pipeline-hint">Ingresado: {fmtFecha(selected.ingresado_at)}</p>
                )}
                <label>
                  Notas RRHH
                  <textarea value={detailNotas} onChange={(e) => setDetailNotas(e.target.value)} rows={3} />
                </label>
                <div className="rrhh-post-modal-actions">
                  <button type="button" className="rrhh-post-btn-primary" onClick={() => void saveDetail()} disabled={saving}>
                    {saving
                      ? 'Guardando…'
                      : detailEstado === 'ingresado' && !selected.id_usuario
                        ? 'Continuar alta…'
                        : 'Guardar'}
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
                {selected.cv_url && isPdf(selected) ? (
                  <div className="rrhh-post-cv-viewer">
                    <div className="rrhh-post-cv-viewer-head">
                      <strong>Vista previa del CV</strong>
                      <a href={selected.cv_url} target="_blank" rel="noopener noreferrer">
                        Abrir en pestaña
                      </a>
                    </div>
                    <iframe
                      title={`CV ${selected.nombre}`}
                      src={`${selected.cv_url}#toolbar=1&navpanes=0`}
                      className="rrhh-post-modal-pdf"
                    />
                  </div>
                ) : selected.cv_url ? (
                  <a href={selected.cv_url} target="_blank" rel="noopener noreferrer" className="rrhh-post-btn-outline">
                    Abrir CV ({selected.cv_nombre || 'archivo'})
                  </a>
                ) : (
                  <p className="rrhh-post-form-modal-note">Esta postulación no tiene archivo de CV adjunto.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showIngresarModal && selected && (
        <div
          className="rrhh-post-modal-overlay rrhh-post-ingresar-overlay"
          onClick={() => !ingresando && setShowIngresarModal(false)}
        >
          <div className="rrhh-post-ingresar-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Alta automática</h3>
            <p>
              Se creará usuario + legajo para <strong>{selected.nombre}</strong> ({selected.email}) y la
              postulación pasará a Ingresado.
            </p>
            <label>
              Usuario (login)
              <input
                type="text"
                value={ingresarLogin}
                onChange={(e) => setIngresarLogin(e.target.value)}
                disabled={ingresando}
                autoComplete="off"
              />
            </label>
            <label>
              Contraseña temporal
              <input
                type="text"
                value={ingresarPassword}
                onChange={(e) => setIngresarPassword(e.target.value)}
                disabled={ingresando}
                autoComplete="new-password"
              />
            </label>
            <label>
              Rol
              <select
                value={ingresarRol}
                onChange={(e) => setIngresarRol(e.target.value as UserRole)}
                disabled={ingresando}
              >
                {ROLES_ALTA.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rrhh-post-ingresar-actions">
              <button
                type="button"
                className="rrhh-post-btn-outline"
                disabled={ingresando}
                onClick={() => setShowIngresarModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rrhh-post-btn-primary"
                disabled={ingresando}
                onClick={() => void confirmarIngreso()}
              >
                {ingresando ? 'Creando…' : 'Crear usuario e ingresar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(RecursosHumanosPostulacionesPage)
