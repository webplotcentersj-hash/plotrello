import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PruebaPreguntaInput, PruebaPreguntaTipo, UsuarioRecord } from '../types/api'
import './RecursosHumanosPruebasPage.css'

type PruebaRow = {
  id: string
  titulo: string
  descripcion?: string | null
  tiempo_total_segundos?: number | null
  porcentaje_aprobacion?: number | null
  created_at?: string
  preguntas_count?: number
  asignados?: number
  finalizados?: number
  promedio_puntaje?: number | null
  tasa_aprobacion_pct?: number | null
}

type ResultadoRespuesta = {
  id_pregunta: string
  pregunta_texto?: string
  tipo?: string
  puntos_pregunta?: number | null
  puntos_obtenidos?: number | null
  respuesta_texto?: string | null
  opcion_elegida?: number | null
  opciones?: unknown
  indice_correcto?: number | null
  es_correcta_mc?: boolean | null
  requiere_calificacion?: boolean
}

type ResultadoAsignacion = {
  id_asignacion: string
  id_usuario?: number
  nombre_usuario?: string
  estado?: string
  iniciado_at?: string | null
  finalizado_at?: string | null
  tiempo_limite_fin?: string | null
  puntaje_obtenido?: number | null
  puntaje_maximo?: number | null
  aprobado?: boolean | null
  calificacion_pendiente?: boolean
  respuestas_count?: number
  respuestas?: ResultadoRespuesta[]
}

type ResultadoPayload = {
  prueba: {
    id?: string
    titulo?: string
    descripcion?: string | null
    tiempo_total_segundos?: number | null
    porcentaje_aprobacion?: number
    preguntas?: unknown[]
  }
  asignaciones: ResultadoAsignacion[]
}

function emptyPregunta(orden: number): PruebaPreguntaInput & { opcionesStr: string } {
  return {
    orden,
    texto: '',
    tipo: 'desarrollo',
    tiempo_segundos: null,
    puntos: 1,
    opciones: [],
    indice_correcto: null,
    opcionesStr: ''
  }
}

function fmtFecha(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function DarkSelect<T extends string>({
  value,
  onChange,
  options,
  className
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const label = options.find((o) => o.value === value)?.label ?? value

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className={`rrhh-pruebas-darkselect ${className ?? ''}`} ref={wrapRef}>
      <button
        type="button"
        className="rrhh-pruebas-darkselect-btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="rrhh-pruebas-darkselect-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul className="rrhh-pruebas-darkselect-list" role="listbox">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                className={
                  o.value === value ? 'rrhh-pruebas-darkselect-opt is-active' : 'rrhh-pruebas-darkselect-opt'
                }
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TIPO_OPTS: { value: PruebaPreguntaTipo; label: string }[] = [
  { value: 'desarrollo', label: 'Desarrollo (texto libre)' },
  { value: 'multiple_choice', label: 'Multiple choice' }
]

const RecursosHumanosPruebasPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const puedeGestionar =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lista, setLista] = useState<PruebaRow[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tiempoTotalMin, setTiempoTotalMin] = useState<string>('')
  const [porcentajeAprobacion, setPorcentajeAprobacion] = useState<string>('60')
  const [preguntas, setPreguntas] = useState<(PruebaPreguntaInput & { opcionesStr: string })[]>([
    emptyPregunta(1)
  ])

  const [pruebaAsignarId, setPruebaAsignarId] = useState<string>('')
  const [seleccionUsuarios, setSeleccionUsuarios] = useState<Record<number, boolean>>({})

  const [resultadoData, setResultadoData] = useState<ResultadoPayload | null>(null)
  const [resultadoPruebaId, setResultadoPruebaId] = useState<string | null>(null)
  const [resultadosTitulo, setResultadosTitulo] = useState('')
  const [calificarDraft, setCalificarDraft] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [u, l] = await Promise.all([apiService.getUsuarios(), apiService.rrhhPruebasListar()])
      if (u.success && u.data) setUsuarios(u.data)
      if (l.success && Array.isArray(l.data)) setLista(l.data as PruebaRow[])
      else if (!l.success) setError(l.error || 'Error al listar pruebas')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!puedeGestionar) {
      navigate('/rrhh/dashboard')
      return
    }
    void load()
  }, [authLoading, puedeGestionar, navigate])

  const guardarPrueba = async () => {
    if (!titulo.trim()) {
      setError('Completá el título.')
      return
    }
    const pct = parseInt(porcentajeAprobacion.trim(), 10)
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      setError('Porcentaje para aprobar: número entre 1 y 100.')
      return
    }
    const validas = preguntas.filter((p) => p.texto.trim())
    if (validas.length === 0) {
      setError('Agregá al menos una pregunta con texto.')
      return
    }
    const preparadas: PruebaPreguntaInput[] = []
    for (const p of validas) {
      const pts =
        typeof p.puntos === 'number' && !Number.isNaN(p.puntos) && p.puntos > 0 ? p.puntos : 1
      if (p.tipo === 'multiple_choice') {
        const opts = p.opcionesStr
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (opts.length < 2) {
          setError('Multiple choice: al menos 2 opciones (una por línea).')
          return
        }
        const idx = p.indice_correcto ?? 0
        if (idx < 0 || idx >= opts.length) {
          setError('Indicá el índice de la opción correcta (0 = primera línea).')
          return
        }
        preparadas.push({
          orden: preparadas.length + 1,
          texto: p.texto.trim(),
          tipo: 'multiple_choice',
          tiempo_segundos:
            typeof p.tiempo_segundos === 'number' && !Number.isNaN(p.tiempo_segundos)
              ? p.tiempo_segundos
              : null,
          puntos: pts,
          opciones: opts,
          indice_correcto: idx
        })
      } else {
        preparadas.push({
          orden: preparadas.length + 1,
          texto: p.texto.trim(),
          tipo: 'desarrollo',
          tiempo_segundos:
            typeof p.tiempo_segundos === 'number' && !Number.isNaN(p.tiempo_segundos)
              ? p.tiempo_segundos
              : null,
          puntos: pts
        })
      }
    }

    let tiempoSeg: number | null = null
    if (tiempoTotalMin.trim() !== '') {
      const min = parseInt(tiempoTotalMin.trim(), 10)
      if (!Number.isFinite(min) || min < 1) {
        setError('Tiempo total de la prueba: indicá minutos válidos (número ≥ 1) o dejá vacío.')
        return
      }
      tiempoSeg = min * 60
    }

    setError(null)
    setLoading(true)
    const payload = preparadas.map((p, i) => ({ ...p, orden: i + 1 }))

    const resp = await apiService.rrhhPruebaGuardar({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      tiempoTotalSegundos: tiempoSeg,
      porcentajeAprobacion: pct,
      preguntas: payload
    })
    setLoading(false)
    if (!resp.success) {
      setError(resp.error || 'No se pudo guardar')
      return
    }
    setTitulo('')
    setDescripcion('')
    setTiempoTotalMin('')
    setPorcentajeAprobacion('60')
    setPreguntas([emptyPregunta(1)])
    await load()
  }

  const asignar = async () => {
    if (!pruebaAsignarId) {
      setError('Seleccioná una prueba.')
      return
    }
    const ids = Object.entries(seleccionUsuarios)
      .filter(([, v]) => v)
      .map(([k]) => parseInt(k, 10))
    if (ids.length === 0) {
      setError('Seleccioná al menos un usuario.')
      return
    }
    setLoading(true)
    setError(null)
    const r = await apiService.rrhhPruebaAsignar(pruebaAsignarId, ids)
    setLoading(false)
    if (!r.success) {
      setError(r.error || 'Error al asignar')
      return
    }
    setSeleccionUsuarios({})
    await load()
  }

  const verResultados = async (pr: PruebaRow) => {
    setLoading(true)
    setError(null)
    const r = await apiService.rrhhPruebaResultados(pr.id)
    setLoading(false)
    if (!r.success) {
      setError(r.error || 'Error')
      return
    }
    const raw = r.data as ResultadoPayload | null
    if (!raw || !raw.prueba) {
      setError('Sin datos de resultados')
      return
    }
    setResultadosTitulo(pr.titulo)
    setResultadoPruebaId(pr.id)
    setResultadoData(raw)
    setCalificarDraft({})
  }

  const aplicarCalificacionDesarrollo = async (
    idAsignacion: string,
    idPregunta: string,
    maxPts: number
  ) => {
    const key = `${idAsignacion}:${idPregunta}`
    const rawDraft = calificarDraft[key]?.trim() ?? ''
    const n = parseFloat(rawDraft.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > maxPts) {
      setError(`Puntos entre 0 y ${maxPts}`)
      return
    }
    setError(null)
    setLoading(true)
    const r = await apiService.rrhhPruebaCalificarDesarrollo(idAsignacion, idPregunta, n)
    setLoading(false)
    if (!r.success) {
      setError(r.error || 'No se pudo guardar la calificación')
      return
    }
    const pr = resultadoPruebaId ? lista.find((p) => p.id === resultadoPruebaId) : null
    if (pr) await verResultados(pr)
  }

  if (authLoading || loading) {
    return (
      <div className="rrhh-pruebas-loading">
        <div className="rrhh-pruebas-spinner" />
        <p>Cargando…</p>
      </div>
    )
  }

  if (!puedeGestionar) return null

  return (
    <div className="rrhh-pruebas-page">
      <header className="rrhh-pruebas-header">
        <div>
          <h1>📝 Pruebas de conocimiento</h1>
          <p className="rrhh-pruebas-lead">
            Varias preguntas por prueba, puntos por ítem, nota de aprobación y corrección automática en
            multiple choice. Las de desarrollo las calificás vos. Asigná usuarios y revisá resultados con
            estadísticas.
          </p>
        </div>
        <button type="button" className="rrhh-pruebas-back" onClick={() => navigate('/rrhh/dashboard')}>
          ← Dashboard RRHH
        </button>
      </header>

      {error && (
        <div className="rrhh-pruebas-alert" role="alert">
          {error}
        </div>
      )}

      <section className="rrhh-pruebas-card">
        <h2>Nueva prueba</h2>
        <div className="rrhh-pruebas-grid">
          <label>
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Seguridad e higiene" />
          </label>
          <label>
            Tiempo total (minutos, opcional)
            <input
              type="number"
              min={1}
              value={tiempoTotalMin}
              onChange={(e) => setTiempoTotalMin(e.target.value)}
              placeholder="Vacío = sin límite global"
            />
          </label>
          <label>
            % mínimo para aprobar (sobre el total de puntos)
            <input
              type="number"
              min={1}
              max={100}
              value={porcentajeAprobacion}
              onChange={(e) => setPorcentajeAprobacion(e.target.value)}
            />
          </label>
        </div>
        <label className="rrhh-pruebas-block">
          Descripción
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
        </label>

        <h3>Preguntas (podés agregar todas las que necesites)</h3>
        {preguntas.map((p, idx) => (
          <div key={idx} className="rrhh-pruebas-pregunta">
            <div className="rrhh-pruebas-pregunta-head">
              <span>Pregunta {idx + 1}</span>
              {preguntas.length > 1 && (
                <button
                  type="button"
                  className="rrhh-pruebas-linkbtn"
                  onClick={() => setPreguntas((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Quitar
                </button>
              )}
            </div>
            <textarea
              value={p.texto}
              onChange={(e) => {
                const v = e.target.value
                setPreguntas((prev) => {
                  const n = [...prev]
                  n[idx] = { ...n[idx], texto: v }
                  return n
                })
              }}
              placeholder="Enunciado"
              rows={2}
            />
            <div className="rrhh-pruebas-grid rrhh-pruebas-grid--3">
              <label>
                Tipo
                <DarkSelect
                  value={p.tipo}
                  onChange={(t) =>
                    setPreguntas((prev) => {
                      const n = [...prev]
                      n[idx] = { ...n[idx], tipo: t, opcionesStr: t === 'multiple_choice' ? n[idx].opcionesStr : '' }
                      return n
                    })
                  }
                  options={TIPO_OPTS}
                />
              </label>
              <label>
                Puntos de esta pregunta
                <input
                  type="number"
                  min={0.01}
                  step={0.5}
                  value={p.puntos ?? 1}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setPreguntas((prev) => {
                      const n = [...prev]
                      n[idx] = { ...n[idx], puntos: Number.isFinite(v) && v > 0 ? v : 1 }
                      return n
                    })
                  }}
                />
              </label>
              <label>
                Tiempo pregunta (seg., opcional)
                <input
                  type="number"
                  min={1}
                  value={p.tiempo_segundos ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setPreguntas((prev) => {
                      const n = [...prev]
                      n[idx] = {
                        ...n[idx],
                        tiempo_segundos: v === '' ? null : parseInt(v, 10)
                      }
                      return n
                    })
                  }}
                />
              </label>
            </div>
            {p.tipo === 'multiple_choice' && (
              <>
                <label className="rrhh-pruebas-block">
                  Opciones (una por línea) — se corrige automático según índice correcto
                  <textarea
                    value={p.opcionesStr}
                    onChange={(e) =>
                      setPreguntas((prev) => {
                        const n = [...prev]
                        n[idx] = { ...n[idx], opcionesStr: e.target.value }
                        return n
                      })
                    }
                    rows={4}
                    placeholder={'Opción A\nOpción B\nOpción C'}
                  />
                </label>
                <label>
                  Índice opción correcta (0 = primera línea)
                  <input
                    type="number"
                    min={0}
                    value={p.indice_correcto ?? 0}
                    onChange={(e) =>
                      setPreguntas((prev) => {
                        const n = [...prev]
                        n[idx] = { ...n[idx], indice_correcto: parseInt(e.target.value, 10) || 0 }
                        return n
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          className="rrhh-pruebas-secondary"
          onClick={() => setPreguntas((prev) => [...prev, emptyPregunta(prev.length + 1)])}
        >
          + Agregar pregunta
        </button>
        <button type="button" className="rrhh-pruebas-primary" onClick={() => void guardarPrueba()}>
          Guardar prueba
        </button>
      </section>

      <section className="rrhh-pruebas-card">
        <h2>Asignar a usuarios</h2>
        <div className="rrhh-pruebas-grid">
          <label>
            Prueba
            <DarkSelect<string>
              value={pruebaAsignarId}
              onChange={setPruebaAsignarId}
              options={[
                { value: '', label: '— Elegí —' },
                ...lista.map((pr) => ({ value: pr.id, label: pr.titulo }))
              ]}
            />
          </label>
        </div>
        <div className="rrhh-pruebas-usuarios">
          {usuarios.map((u) => (
            <label key={u.id} className="rrhh-pruebas-check">
              <input
                type="checkbox"
                checked={!!seleccionUsuarios[u.id]}
                onChange={(e) =>
                  setSeleccionUsuarios((prev) => ({ ...prev, [u.id]: e.target.checked }))
                }
              />
              <span>
                {u.nombre} <small>({u.rol})</small>
              </span>
            </label>
          ))}
        </div>
        <button type="button" className="rrhh-pruebas-primary" onClick={() => void asignar()}>
          Asignar
        </button>
      </section>

      <section className="rrhh-pruebas-card">
        <h2>Pruebas y estadísticas</h2>
        <div className="rrhh-pruebas-table-wrap">
          <table className="rrhh-pruebas-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Preg.</th>
                <th>Asign.</th>
                <th>Fin.</th>
                <th>Prom. pts</th>
                <th>% aprueba</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((pr) => (
                <tr key={pr.id}>
                  <td>{pr.titulo}</td>
                  <td>{pr.preguntas_count ?? '—'}</td>
                  <td>{pr.asignados ?? '—'}</td>
                  <td>{pr.finalizados ?? '—'}</td>
                  <td>{pr.promedio_puntaje != null ? String(pr.promedio_puntaje) : '—'}</td>
                  <td>
                    {pr.tasa_aprobacion_pct != null ? `${pr.tasa_aprobacion_pct}%` : '—'}
                  </td>
                  <td>
                    <button type="button" className="rrhh-pruebas-linkbtn" onClick={() => void verResultados(pr)}>
                      Ver respuestas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {resultadoData && (
        <div
          className="rrhh-pruebas-modal-overlay"
          role="dialog"
          aria-modal
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setResultadoData(null)
              setResultadoPruebaId(null)
            }
          }}
        >
          <div className="rrhh-pruebas-modal rrhh-pruebas-modal--wide">
            <div className="rrhh-pruebas-modal-head">
              <div>
                <h3>Resultados: {resultadosTitulo}</h3>
                <p className="rrhh-pruebas-modal-sub">
                  Aprobación: ≥ {resultadoData.prueba.porcentaje_aprobacion ?? '—'}% del total de puntos · Multiple
                  choice corregido automático
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResultadoData(null)
                  setResultadoPruebaId(null)
                }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="rrhh-pruebas-modal-body">
              {(resultadoData.asignaciones || []).map((asig) => (
                <article key={asig.id_asignacion} className="rrhh-pruebas-result-block">
                  <header className="rrhh-pruebas-result-user">
                    <div>
                      <strong>{asig.nombre_usuario ?? 'Usuario'}</strong>
                      <span className="rrhh-pruebas-result-meta">
                        Inicio: {fmtFecha(asig.iniciado_at)} · Fin: {fmtFecha(asig.finalizado_at)} · Respuestas
                        guardadas: {asig.respuestas_count ?? (asig.respuestas?.length ?? 0)}
                      </span>
                    </div>
                    <div className="rrhh-pruebas-result-scores">
                      <span>
                        Puntaje: {asig.puntaje_obtenido != null ? asig.puntaje_obtenido : '—'} /{' '}
                        {asig.puntaje_maximo != null ? asig.puntaje_maximo : '—'}
                      </span>
                      {asig.calificacion_pendiente ? (
                        <span className="rrhh-pruebas-badge rrhh-pruebas-badge--warn">Pendiente calificar desarrollo</span>
                      ) : asig.aprobado === null ? (
                        <span className="rrhh-pruebas-badge">—</span>
                      ) : asig.aprobado ? (
                        <span className="rrhh-pruebas-badge rrhh-pruebas-badge--ok">Aprobado</span>
                      ) : (
                        <span className="rrhh-pruebas-badge rrhh-pruebas-badge--no">No aprobado</span>
                      )}
                    </div>
                  </header>
                  <table className="rrhh-pruebas-result-table">
                    <thead>
                      <tr>
                        <th>Pregunta</th>
                        <th>Tipo</th>
                        <th>Pts</th>
                        <th>Obtenidos</th>
                        <th>Respuesta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(asig.respuestas || []).map((r) => {
                        const key = `${asig.id_asignacion}:${r.id_pregunta}`
                        const maxP = Number(r.puntos_pregunta ?? 0)
                        const esDev = r.requiere_calificacion || r.tipo === 'desarrollo'
                        return (
                          <tr key={r.id_pregunta}>
                            <td>{r.pregunta_texto ?? '—'}</td>
                            <td>{r.tipo === 'multiple_choice' ? 'MC' : 'Desarrollo'}</td>
                            <td>{r.puntos_pregunta ?? '—'}</td>
                            <td>
                              {esDev ? (
                                <div className="rrhh-pruebas-calif-row">
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxP}
                                    step={0.25}
                                    className="rrhh-pruebas-calif-input"
                                    placeholder={String(r.puntos_obtenidos ?? '')}
                                    value={calificarDraft[key] ?? ''}
                                    onChange={(e) =>
                                      setCalificarDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                  />
                                  <span className="rrhh-pruebas-calif-max">/ {maxP}</span>
                                  <button
                                    type="button"
                                    className="rrhh-pruebas-linkbtn"
                                    onClick={() =>
                                      void aplicarCalificacionDesarrollo(asig.id_asignacion, r.id_pregunta, maxP)
                                    }
                                  >
                                    Guardar
                                  </button>
                                </div>
                              ) : (
                                <span>
                                  {r.puntos_obtenidos ?? '—'}
                                  {r.es_correcta_mc === true && ' ✓'}
                                  {r.es_correcta_mc === false && ' ✗'}
                                </span>
                              )}
                            </td>
                            <td className="rrhh-pruebas-result-answer">
                              {r.tipo === 'multiple_choice' && Array.isArray(r.opciones) ? (
                                <span>
                                  Elegida:{' '}
                                  {r.opcion_elegida != null
                                    ? String((r.opciones as string[])[r.opcion_elegida] ?? r.opcion_elegida)
                                    : '—'}
                                </span>
                              ) : (
                                <span>{r.respuesta_texto || '—'}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosPruebasPage
