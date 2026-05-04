import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import apiService from '../services/api'
import type {
  Capacitacion,
  Evaluacion,
  HistorialMovimiento,
  LegajoEmpleado,
  RrhhNovedad,
  SolicitudPermiso,
  UsuarioRecord
} from '../types/api'
import RrhhNovedadDetailModal from './RrhhNovedadDetailModal'
import {
  RRHH_NOVEDAD_GRUPOS,
  etiquetaCodigoRrhhNovedad
} from '../utils/rrhhNovedadCatalog'
import type { PedidoCompra } from '../types/pedidos'
import { isoToArgentinaDateKey } from '../utils/dateUtils'
import { jsPDF } from 'jspdf'
import './VerLegajoModal.css'

type VerLegajoModalProps = {
  usuario: UsuarioRecord
  isOpen: boolean
  onClose: () => void
}

type LegajoTabId =
  | 'legajo'
  | 'movimientos'
  | 'capacitaciones'
  | 'pruebas'
  | 'pedidos'
  | 'permisos'
  | 'evaluaciones'
  | 'novedades'

type PruebaRow = {
  id: string
  titulo: string
  descripcion?: string | null
  porcentaje_aprobacion?: number | null
  created_at?: string
}

type ResultadoAsignacion = {
  id_asignacion: string
  id_usuario?: number
  nombre_usuario?: string
  estado?: string
  iniciado_at?: string | null
  finalizado_at?: string | null
  puntaje_obtenido?: number | null
  puntaje_maximo?: number | null
  aprobado?: boolean | null
  calificacion_pendiente?: boolean
}

type ResultadoPayload = {
  prueba: {
    id?: string
    titulo?: string
    descripcion?: string | null
    porcentaje_aprobacion?: number
  }
  asignaciones: ResultadoAsignacion[]
}

const VerLegajoModal = ({ usuario, isOpen, onClose }: VerLegajoModalProps) => {
  const [loading, setLoading] = useState(false)
  const [legajo, setLegajo] = useState<LegajoEmpleado | null>(null)
  const [tab, setTab] = useState<LegajoTabId>('legajo')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const [movLoading, setMovLoading] = useState(false)
  const [movError, setMovError] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<HistorialMovimiento[]>([])

  const [capLoading, setCapLoading] = useState(false)
  const [capError, setCapError] = useState<string | null>(null)
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([])

  const [permLoading, setPermLoading] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)
  const [permisos, setPermisos] = useState<SolicitudPermiso[]>([])

  const [evalLoading, setEvalLoading] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])

  const [pedLoading, setPedLoading] = useState(false)
  const [pedError, setPedError] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])

  const [prueLoading, setPrueLoading] = useState(false)
  const [prueError, setPrueError] = useState<string | null>(null)
  const [pruebas, setPruebas] = useState<PruebaRow[]>([])
  const [pruebaResultadoLoadingById, setPruebaResultadoLoadingById] = useState<Record<string, boolean>>({})
  const [pruebaResultadoById, setPruebaResultadoById] = useState<Record<string, ResultadoPayload | null>>({})

  const [novLoading, setNovLoading] = useState(false)
  const [novError, setNovError] = useState<string | null>(null)
  const [novedadesRRHH, setNovedadesRRHH] = useState<RrhhNovedad[]>([])
  const [novedadDetail, setNovedadDetail] = useState<RrhhNovedad | null>(null)

  useEffect(() => {
    if (isOpen && usuario.id) {
      setTab('legajo')
      setNovedadesRRHH([])
      setNovedadDetail(null)
      setNovError(null)
      loadLegajo()
    }
  }, [isOpen, usuario.id])

  const loadLegajo = async () => {
    setLoading(true)
    try {
      const response = await apiService.getLegajoEmpleado(usuario.id)
      if (response.success && response.data) {
        const d = response.data
        setLegajo({
          ...d,
          fecha_ingreso: d.fecha_ingreso
            ? isoToArgentinaDateKey(String(d.fecha_ingreso)) || d.fecha_ingreso
            : d.fecha_ingreso,
          fecha_nacimiento: d.fecha_nacimiento
            ? isoToArgentinaDateKey(String(d.fecha_nacimiento)) || d.fecha_nacimiento
            : d.fecha_nacimiento
        })
      } else {
        setLegajo(null)
      }
    } catch (error) {
      console.error('Error cargando legajo:', error)
      setLegajo(null)
    } finally {
      setLoading(false)
    }
  }

  const loadMovimientos = async () => {
    setMovLoading(true)
    setMovError(null)
    try {
      const r = await apiService.getHistorialMovimientos({ usuarioId: usuario.id, limit: 200 })
      if (r.success && r.data) setMovimientos(r.data)
      else setMovError(r.error || 'No se pudieron cargar los movimientos')
    } catch (e) {
      setMovError(e instanceof Error ? e.message : 'Error al cargar movimientos')
    } finally {
      setMovLoading(false)
    }
  }

  const loadCapacitaciones = async () => {
    setCapLoading(true)
    setCapError(null)
    try {
      const r = await apiService.obtenerCapacitacionesUsuario(usuario.id, null)
      if (r.success && r.data) setCapacitaciones(r.data)
      else setCapError(r.error || 'No se pudieron cargar las capacitaciones')
    } catch (e) {
      setCapError(e instanceof Error ? e.message : 'Error al cargar capacitaciones')
    } finally {
      setCapLoading(false)
    }
  }

  const loadPermisos = async () => {
    setPermLoading(true)
    setPermError(null)
    try {
      const r = await apiService.obtenerSolicitudesPermisos(usuario.id, null, null, null, null)
      if (r.success && r.data) setPermisos(r.data)
      else setPermError(r.error || 'No se pudieron cargar los permisos')
    } catch (e) {
      setPermError(e instanceof Error ? e.message : 'Error al cargar permisos')
    } finally {
      setPermLoading(false)
    }
  }

  const loadEvaluaciones = async () => {
    setEvalLoading(true)
    setEvalError(null)
    try {
      const r = await apiService.obtenerEvaluaciones(usuario.id, null, null, null, null, null)
      if (r.success && r.data) setEvaluaciones(r.data)
      else setEvalError(r.error || 'No se pudieron cargar las evaluaciones')
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Error al cargar evaluaciones')
    } finally {
      setEvalLoading(false)
    }
  }

  const loadPedidos = async () => {
    setPedLoading(true)
    setPedError(null)
    try {
      const r = await apiService.getPedidosCompra({ id_solicitante: usuario.id })
      if (r.success && r.data) setPedidos(r.data)
      else setPedError(r.error || 'No se pudieron cargar los pedidos')
    } catch (e) {
      setPedError(e instanceof Error ? e.message : 'Error al cargar pedidos')
    } finally {
      setPedLoading(false)
    }
  }

  const loadNovedadesRRHH = async () => {
    setNovLoading(true)
    setNovError(null)
    try {
      const r = await apiService.rrhhNovedadesListar({ idUsuario: usuario.id })
      if (r.success && r.data) setNovedadesRRHH(r.data)
      else setNovError(r.error || 'No se pudieron cargar las novedades laborales')
    } catch (e) {
      setNovError(e instanceof Error ? e.message : 'Error al cargar novedades')
    } finally {
      setNovLoading(false)
    }
  }

  const loadPruebas = async () => {
    setPrueLoading(true)
    setPrueError(null)
    try {
      const r = await apiService.rrhhPruebasListar()
      if (!r.success) {
        setPrueError(r.error || 'No se pudieron cargar las pruebas')
        return
      }
      const list = Array.isArray(r.data) ? (r.data as PruebaRow[]) : []
      setPruebas(list)
    } catch (e) {
      setPrueError(e instanceof Error ? e.message : 'Error al cargar pruebas')
    } finally {
      setPrueLoading(false)
    }
  }

  const loadResultadoPrueba = async (idPrueba: string) => {
    setPruebaResultadoLoadingById((prev) => ({ ...prev, [idPrueba]: true }))
    try {
      const r = await apiService.rrhhPruebaResultados(idPrueba)
      if (!r.success) {
        setPruebaResultadoById((prev) => ({ ...prev, [idPrueba]: null }))
        return
      }
      const data = (r.data ?? null) as ResultadoPayload | null
      setPruebaResultadoById((prev) => ({ ...prev, [idPrueba]: data }))
    } finally {
      setPruebaResultadoLoadingById((prev) => ({ ...prev, [idPrueba]: false }))
    }
  }

  const generarPdfLegajo = async () => {
    if (!legajo) return
    setPdfGenerating(true)
    setPdfError(null)
    try {
      const [movR, capR, pedR, permR, evalR, pruebasR, novR] = await Promise.all([
        apiService.getHistorialMovimientos({ usuarioId: usuario.id, limit: 200 }),
        apiService.obtenerCapacitacionesUsuario(usuario.id, null),
        apiService.getPedidosCompra({ id_solicitante: usuario.id }),
        apiService.obtenerSolicitudesPermisos(usuario.id, null, null, null, null),
        apiService.obtenerEvaluaciones(usuario.id, null, null, null, null, null),
        apiService.rrhhPruebasListar(),
        apiService.rrhhNovedadesListar({ idUsuario: usuario.id })
      ])

      const pruebasList = Array.isArray(pruebasR.data) ? (pruebasR.data as PruebaRow[]) : []

      // Para contar pruebas del usuario sin mil requests: traemos resultados solo de las primeras N pruebas
      // (sirve como resumen rápido). Si querés 100% completo, lo hacemos después con un RPC dedicado.
      const N = 8
      const subset = pruebasList.slice(0, N)
      let pruebasConAsignacion = 0
      let pruebasAprobadas = 0
      let pruebasNoAprobadas = 0
      let pruebasPendientes = 0
      for (const p of subset) {
        const rr = await apiService.rrhhPruebaResultados(p.id)
        const payload = rr.success ? ((rr.data ?? null) as ResultadoPayload | null) : null
        const asig = payload?.asignaciones?.find((a) => a.id_usuario === usuario.id) ?? null
        if (!asig) continue
        pruebasConAsignacion++
        if (asig.aprobado === true) pruebasAprobadas++
        else if (asig.aprobado === false) pruebasNoAprobadas++
        else pruebasPendientes++
      }

      const movimientosCount = movR.success && movR.data ? movR.data.length : null
      const capacitacionesCount = capR.success && capR.data ? capR.data.length : null
      const pedidosCount = pedR.success && pedR.data ? pedR.data.length : null
      const permisosCount = permR.success && permR.data ? permR.data.length : null
      const evaluacionesCount = evalR.success && evalR.data ? evalR.data.length : null
      const novedadesPdfCount = novR.success && novR.data ? novR.data.length : null

      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 48
      let y = 54

      const title = `Legajo · ${usuario.nombre} (ID ${usuario.id})`
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text(title, margin, y)
      y += 18

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, margin, y)
      y += 18

      const section = (label: string) => {
        y += 10
        doc.setDrawColor(180)
        doc.setLineWidth(0.5)
        doc.line(margin, y, pageW - margin, y)
        y += 16
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(label, margin, y)
        y += 14
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }

      const kv = (k: string, v: string) => {
        const line = `${k}: ${v}`
        const lines = doc.splitTextToSize(line, pageW - margin * 2)
        doc.text(lines, margin, y)
        y += lines.length * 12
      }

      section('Datos personales')
      kv('Nombre', legajo.nombre || usuario.nombre || '—')
      kv('Apellido', legajo.apellido || '—')
      kv('DNI', legajo.dni || '—')
      kv('Teléfono', legajo.telefono || '—')
      kv('Email', legajo.email || '—')
      kv('Dirección', legajo.direccion || '—')
      kv('Estado civil', legajo.estado_civil || '—')
      kv('Fecha de nacimiento', legajo.fecha_nacimiento ? String(legajo.fecha_nacimiento) : '—')

      section('Datos laborales')
      kv('Sector', legajo.sector || '—')
      kv('Fecha de ingreso', legajo.fecha_ingreso ? String(legajo.fecha_ingreso) : '—')
      kv('Funciones', legajo.funciones || '—')

      section('Resumen de actividad')
      kv('Movimientos (últimos 200)', movimientosCount == null ? 'No disponible' : String(movimientosCount))
      kv('Capacitaciones (asociadas)', capacitacionesCount == null ? 'No disponible' : String(capacitacionesCount))
      kv('Pedidos (Compras)', pedidosCount == null ? 'No disponible' : String(pedidosCount))
      kv('Permisos solicitados', permisosCount == null ? 'No disponible' : String(permisosCount))
      kv('Evaluaciones RRHH', evaluacionesCount == null ? 'No disponible' : String(evaluacionesCount))
      kv(
        'Novedades laborales (RRHH)',
        novedadesPdfCount == null ? 'No disponible' : String(novedadesPdfCount)
      )
      kv(
        `Pruebas (muestra parcial ${subset.length}/${pruebasList.length})`,
        pruebasList.length === 0
          ? 'No disponible'
          : `Con asignación: ${pruebasConAsignacion} · Aprobadas: ${pruebasAprobadas} · No aprobadas: ${pruebasNoAprobadas} · Pendientes: ${pruebasPendientes}`
      )

      if (legajo.observaciones) {
        section('Observaciones')
        kv('Notas', legajo.observaciones)
      }

      const safeName = (usuario.nombre || 'usuario').replace(/[^\p{L}\p{N}_-]+/gu, '_')
      doc.save(`legajo_${usuario.id}_${safeName}.pdf`)
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    } finally {
      setPdfGenerating(false)
    }
  }

  if (!isOpen) return null

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'No especificada'
    const key = isoToArgentinaDateKey(String(dateString))
    if (key.length === 10) {
      const [y, m, d] = key.split('-')
      return `${d}/${m}/${y}`
    }
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
      })
    } catch {
      return dateString
    }
  }

  const movimientoStats = useMemo(() => {
    const byTipo = new Map<string, number>()
    for (const m of movimientos) {
      const k = (m.accion_tipo || 'sin_tipo').trim() || 'sin_tipo'
      byTipo.set(k, (byTipo.get(k) || 0) + 1)
    }
    return Array.from(byTipo.entries()).sort((a, b) => b[1] - a[1])
  }, [movimientos])

  const tabs: Array<{ id: LegajoTabId; label: string }> = [
    { id: 'legajo', label: '📋 Legajo' },
    { id: 'movimientos', label: '📈 Movimientos' },
    { id: 'capacitaciones', label: '🎓 Capacitaciones' },
    { id: 'pruebas', label: '📝 Pruebas' },
    { id: 'pedidos', label: '🧾 Pedidos' },
    { id: 'permisos', label: '🗓️ Permisos' },
    { id: 'evaluaciones', label: '⭐ Evaluaciones' },
    { id: 'novedades', label: '📌 Novedades' }
  ]

  return (
    <div
      className="ver-legajo-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ver-legajo-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ver-legajo-modal-header">
          <h2>📋 Legajo de Empleado</h2>
          <button className="ver-legajo-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="ver-legajo-loading">
            <div className="spinner"></div>
            <p>Cargando legajo...</p>
          </div>
        ) : !legajo ? (
          <div className="ver-legajo-empty">
            <p>⚠️ No se encontró información del legajo para este empleado.</p>
            <p className="ver-legajo-empty-hint">
              El legajo aún no ha sido creado. Contacta a Recursos Humanos para completar la información.
            </p>
          </div>
        ) : (
          <div className="ver-legajo-body">
            {pdfError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {pdfError}</div>}
            <div className="ver-legajo-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ver-legajo-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setTab(t.id)
                    if (t.id === 'movimientos' && movimientos.length === 0 && !movLoading) void loadMovimientos()
                    if (t.id === 'capacitaciones' && capacitaciones.length === 0 && !capLoading) void loadCapacitaciones()
                    if (t.id === 'permisos' && permisos.length === 0 && !permLoading) void loadPermisos()
                    if (t.id === 'evaluaciones' && evaluaciones.length === 0 && !evalLoading) void loadEvaluaciones()
                    if (t.id === 'pedidos' && pedidos.length === 0 && !pedLoading) void loadPedidos()
                    if (t.id === 'pruebas' && pruebas.length === 0 && !prueLoading) void loadPruebas()
                    if (t.id === 'novedades' && novedadesRRHH.length === 0 && !novLoading) void loadNovedadesRRHH()
                  }}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                className="ver-legajo-tab ver-legajo-tab--download"
                onClick={() => void generarPdfLegajo()}
                disabled={pdfGenerating}
                title="Descargar PDF (datos personales + resumen)"
              >
                {pdfGenerating ? 'Generando…' : '⬇️ PDF'}
              </button>
            </div>

            {tab !== 'legajo' && (
              <div className="ver-legajo-section ver-legajo-section--compact">
                <div className="ver-legajo-mini">
                  <div>
                    <span className="ver-legajo-label">Usuario</span>
                    <div className="ver-legajo-value">{usuario.nombre}</div>
                  </div>
                  <div>
                    <span className="ver-legajo-label">ID</span>
                    <div className="ver-legajo-value">{usuario.id}</div>
                  </div>
                  <div>
                    <span className="ver-legajo-label">Rol</span>
                    <div className="ver-legajo-value">{usuario.rol}</div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'movimientos' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📈 Movimientos en la app</h3>
                {movError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {movError}</div>}
                {movLoading ? (
                  <div className="ver-legajo-subloading">Cargando movimientos…</div>
                ) : (
                  <>
                    <div className="ver-legajo-stats-row">
                      <div className="ver-legajo-stat">
                        <div className="ver-legajo-stat-value">{movimientos.length}</div>
                        <div className="ver-legajo-stat-label">Eventos (últimos 200)</div>
                      </div>
                      <div className="ver-legajo-stat">
                        <div className="ver-legajo-stat-value">{movimientoStats.length}</div>
                        <div className="ver-legajo-stat-label">Tipos distintos</div>
                      </div>
                    </div>
                    {movimientoStats.length > 0 && (
                      <div className="ver-legajo-badges">
                        {movimientoStats.slice(0, 10).map(([k, v]) => (
                          <span key={k} className="ver-legajo-badge">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="ver-legajo-table-wrap">
                      <table className="ver-legajo-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Comentario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientos.map((m) => (
                            <tr key={m.id}>
                              <td>{formatDate(m.timestamp)}</td>
                              <td>{m.accion_tipo || '—'}</td>
                              <td>{m.comentario || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'capacitaciones' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">🎓 Capacitaciones</h3>
                {capError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {capError}</div>}
                {capLoading ? (
                  <div className="ver-legajo-subloading">Cargando capacitaciones…</div>
                ) : capacitaciones.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay capacitaciones asociadas.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Estado</th>
                          <th>Inscripción</th>
                          <th>Asistió</th>
                          <th>Calificación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacitaciones.map((c) => (
                          <tr key={c.id}>
                            <td>{c.titulo}</td>
                            <td>{c.estado}</td>
                            <td>{c.estado_inscripcion ?? '—'}</td>
                            <td>{c.asistio === true ? 'Sí' : c.asistio === false ? 'No' : '—'}</td>
                            <td>{c.calificacion != null ? String(c.calificacion) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'pruebas' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📝 Pruebas de conocimiento</h3>
                <p className="ver-legajo-hint">Seleccioná una prueba para ver el resultado del usuario.</p>
                {prueError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {prueError}</div>}
                {prueLoading ? (
                  <div className="ver-legajo-subloading">Cargando pruebas…</div>
                ) : pruebas.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay pruebas disponibles.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Prueba</th>
                          <th>% aprobación</th>
                          <th>Acción</th>
                          <th>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pruebas.map((p) => {
                          const isLoading = Boolean(pruebaResultadoLoadingById[p.id])
                          const payload = pruebaResultadoById[p.id]
                          const asig = payload?.asignaciones?.find((a) => a.id_usuario === usuario.id) ?? null
                          return (
                            <tr key={p.id}>
                              <td>{p.titulo}</td>
                              <td>{p.porcentaje_aprobacion != null ? `${p.porcentaje_aprobacion}%` : '—'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="ver-legajo-btn-inline"
                                  onClick={() => void loadResultadoPrueba(p.id)}
                                  disabled={isLoading}
                                >
                                  {isLoading ? 'Cargando…' : 'Ver resultado'}
                                </button>
                              </td>
                              <td>
                                {!payload ? (
                                  <span className="ver-legajo-muted">—</span>
                                ) : !asig ? (
                                  <span className="ver-legajo-muted">Sin asignación</span>
                                ) : (
                                  <div className="ver-legajo-inline-result">
                                    <span className="ver-legajo-badge">{asig.estado ?? '—'}</span>
                                    <span className="ver-legajo-muted">
                                      Puntaje: {asig.puntaje_obtenido ?? '—'} / {asig.puntaje_maximo ?? '—'}
                                    </span>
                                    {asig.aprobado === true ? (
                                      <span className="ver-legajo-badge ver-legajo-badge--ok">Aprobado</span>
                                    ) : asig.aprobado === false ? (
                                      <span className="ver-legajo-badge ver-legajo-badge--no">No aprobado</span>
                                    ) : (
                                      <span className="ver-legajo-muted">Pendiente</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'pedidos' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">🧾 Pedidos (Compras)</h3>
                {pedError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {pedError}</div>}
                {pedLoading ? (
                  <div className="ver-legajo-subloading">Cargando pedidos…</div>
                ) : pedidos.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay pedidos realizados por este usuario.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Número</th>
                          <th>Estado</th>
                          <th>Prioridad</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidos.map((p) => (
                          <tr key={p.id}>
                            <td>{p.numero_pedido ?? `#${p.id}`}</td>
                            <td>{p.estado}</td>
                            <td>{p.prioridad ?? '—'}</td>
                            <td>{p.fecha_solicitud ? formatDate(p.fecha_solicitud) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'permisos' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">🗓️ Permisos solicitados</h3>
                {permError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {permError}</div>}
                {permLoading ? (
                  <div className="ver-legajo-subloading">Cargando permisos…</div>
                ) : permisos.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay permisos/solicitudes del usuario.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Título</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permisos.map((s) => (
                          <tr key={s.id}>
                            <td>{formatDate(s.fecha_solicitud)}</td>
                            <td>{s.tipo_solicitud}</td>
                            <td>{s.titulo}</td>
                            <td>{s.estado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'evaluaciones' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">⭐ Evaluaciones RRHH</h3>
                {evalError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {evalError}</div>}
                {evalLoading ? (
                  <div className="ver-legajo-subloading">Cargando evaluaciones…</div>
                ) : evaluaciones.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay evaluaciones registradas.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Período</th>
                          <th>Estado</th>
                          <th>Calificación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluaciones.map((e) => (
                          <tr key={e.id}>
                            <td>{formatDate(e.fecha_evaluacion)}</td>
                            <td>{e.tipo_evaluacion}</td>
                            <td>{e.periodo_evaluacion}</td>
                            <td>{e.estado}</td>
                            <td>{e.calificacion_general != null ? String(e.calificacion_general) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'novedades' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📌 Novedades laborales</h3>
                <p className="ver-legajo-hint">
                  Faltas, licencias, tardanzas y horas extra registradas en Plotrello.{' '}
                  <Link to="/rrhh/novedades" className="ver-legajo-link" onClick={onClose}>
                    Abrir módulo completo
                  </Link>
                </p>
                {novError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {novError}</div>}
                {novLoading ? (
                  <div className="ver-legajo-subloading">Cargando novedades…</div>
                ) : novedadesRRHH.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay novedades registradas para este empleado.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table ver-legajo-table--clickable">
                      <thead>
                        <tr>
                          <th>Fechas</th>
                          <th>Grupo</th>
                          <th>Categoría</th>
                          <th>Detalle</th>
                          <th>Adj.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {novedadesRRHH.map((n) => (
                          <tr key={n.id} onClick={() => setNovedadDetail(n)}>
                            <td>
                              {n.fecha_desde}
                              {n.fecha_hasta !== n.fecha_desde ? ` → ${n.fecha_hasta}` : ''}
                            </td>
                            <td>{RRHH_NOVEDAD_GRUPOS.find((g) => g.value === n.grupo)?.label ?? n.grupo}</td>
                            <td>{etiquetaCodigoRrhhNovedad(n.codigo)}</td>
                            <td className="ver-legajo-cell-ellipsis">
                              {n.grupo === 'tardanza_retiro' && n.duracion_minutos != null
                                ? `${n.duracion_minutos} min · `
                                : ''}
                              {n.grupo === 'horas_extra' && n.horas_extra_cantidad != null
                                ? `${n.horas_extra_cantidad} h · `
                                : ''}
                              {n.observaciones ?? '—'}
                            </td>
                            <td>{(n.adjuntos?.length ?? 0) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'legajo' && (
              <>
            {/* Foto del empleado */}
            {legajo.foto_url && (
              <div className="ver-legajo-photo-section">
                <img 
                  src={legajo.foto_url} 
                  alt={`Foto de ${legajo.nombre || usuario.nombre}`}
                  className="ver-legajo-photo"
                />
              </div>
            )}

            {/* Información Personal */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">👤 Información Personal</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Nombre:</span>
                  <span className="ver-legajo-value">
                    {legajo.nombre || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Apellido:</span>
                  <span className="ver-legajo-value">
                    {legajo.apellido || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">DNI:</span>
                  <span className="ver-legajo-value">
                    {legajo.dni || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Fecha de Nacimiento:</span>
                  <span className="ver-legajo-value">
                    {formatDate(legajo.fecha_nacimiento)}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Estado Civil:</span>
                  <span className="ver-legajo-value">
                    {legajo.estado_civil || 'No especificado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">📞 Información de Contacto</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Teléfono:</span>
                  <span className="ver-legajo-value">
                    {legajo.telefono || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Email:</span>
                  <span className="ver-legajo-value">
                    {legajo.email || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Dirección:</span>
                  <span className="ver-legajo-value">
                    {legajo.direccion || 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Ubicación:</span>
                  <span className="ver-legajo-value">
                    {legajo.ubicacion || 'No especificada'}
                  </span>
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">💼 Información Laboral</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Sector:</span>
                  <span className="ver-legajo-value">
                    {legajo.sector || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Fecha de Ingreso:</span>
                  <span className="ver-legajo-value">
                    {formatDate(legajo.fecha_ingreso)}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Funciones:</span>
                  <span className="ver-legajo-value">
                    {legajo.funciones || 'No especificadas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contacto de Emergencia */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">🚨 Contacto de Emergencia</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Nombre:</span>
                  <span className="ver-legajo-value">
                    {legajo.contacto_emergencia_nombre || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Teléfono:</span>
                  <span className="ver-legajo-value">
                    {legajo.contacto_emergencia_telefono || 'No especificado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            {legajo.observaciones && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📝 Observaciones</h3>
                <div className="ver-legajo-observaciones">
                  <p>{legajo.observaciones}</p>
                </div>
              </div>
            )}

            {/* Información del Sistema */}
            <div className="ver-legajo-section ver-legajo-system-info">
              <h3 className="ver-legajo-section-title">ℹ️ Información del Sistema</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">ID de Usuario:</span>
                  <span className="ver-legajo-value">{usuario.id}</span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Usuario:</span>
                  <span className="ver-legajo-value">{usuario.nombre}</span>
                </div>
                {legajo.created_at && (
                  <div className="ver-legajo-info-item">
                    <span className="ver-legajo-label">Creado:</span>
                    <span className="ver-legajo-value">
                      {formatDate(legajo.created_at)}
                    </span>
                  </div>
                )}
                {legajo.updated_at && (
                  <div className="ver-legajo-info-item">
                    <span className="ver-legajo-label">Última Actualización:</span>
                    <span className="ver-legajo-value">
                      {formatDate(legajo.updated_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
              </>
            )}

            {/* Botón de cerrar */}
            <div className="ver-legajo-modal-actions">
              <button className="ver-legajo-btn ver-legajo-btn-primary" onClick={onClose}>
                Cerrar
              </button>
            </div>

            {novedadDetail ? (
              <RrhhNovedadDetailModal
                novedad={novedadDetail}
                empleadoNombre={usuario.nombre}
                onClose={() => setNovedadDetail(null)}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default VerLegajoModal

