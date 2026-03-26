import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './MisPruebasPage.css'

type MisPruebaRow = {
  id_asignacion: string
  id_prueba: string
  titulo: string
  descripcion?: string | null
  tiempo_total_segundos?: number | null
  porcentaje_aprobacion?: number | null
  estado: string
  iniciado_at?: string | null
  finalizado_at?: string | null
  tiempo_limite_fin?: string | null
  puntaje_obtenido?: number | null
  puntaje_maximo?: number | null
  aprobado?: boolean | null
  calificacion_pendiente?: boolean
}

type PreguntaPantalla = {
  id: string
  orden: number
  texto: string
  tipo: string
  tiempo_segundos?: number | null
  puntos?: number | null
  opciones?: string[] | null
}

type PantallaExamen = {
  id_asignacion: string
  estado: string
  tiempo_limite_fin?: string | null
  iniciado_at?: string | null
  finalizado_at?: string | null
  puntaje_obtenido?: number | null
  puntaje_maximo?: number | null
  aprobado?: boolean | null
  calificacion_pendiente?: boolean
  prueba: {
    id: string
    titulo: string
    descripcion?: string | null
    tiempo_total_segundos?: number | null
    porcentaje_aprobacion?: number | null
  }
  preguntas: PreguntaPantalla[]
  mis_respuestas?: {
    id_pregunta: string
    respuesta_texto?: string | null
    opcion_elegida?: number | null
    puntos_obtenidos?: number | null
  }[]
}

export default function MisPruebasPage() {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<MisPruebaRow[]>([])
  const [examen, setExamen] = useState<PantallaExamen | null>(null)
  const [respuestasLocales, setRespuestasLocales] = useState<Record<string, { texto: string; opcion: number | null }>>(
    {}
  )
  const [nowTick, setNowTick] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await apiService.usuarioMisPruebas()
    setLoading(false)
    if (!r.success) {
      setError(r.error || 'Error')
      return
    }
    const arr = Array.isArray(r.data) ? r.data : []
    setItems(arr as MisPruebaRow[])
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/login')
      return
    }
    void load()
  }, [authLoading, usuario, navigate, load])

  useEffect(() => {
    if (!examen || examen.estado !== 'en_progreso') return
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [examen])

  const tiempoRestanteGlobal = useMemo(() => {
    if (!examen?.tiempo_limite_fin) return null
    const fin = new Date(examen.tiempo_limite_fin).getTime()
    return Math.max(0, Math.floor((fin - nowTick) / 1000))
  }, [examen, nowTick])

  const abrirExamen = async (row: MisPruebaRow, iniciar: boolean) => {
    setError(null)
    if (iniciar) {
      setLoading(true)
      const ir = await apiService.usuarioPruebaIniciar(row.id_prueba)
      setLoading(false)
      if (!ir.success) {
        setError(ir.error || 'No se pudo iniciar')
        return
      }
    }
    setLoading(true)
    const pan = await apiService.usuarioPruebaPantalla(row.id_asignacion)
    setLoading(false)
    if (!pan.success || !pan.data) {
      setError(pan.error || 'No se pudo cargar la prueba')
      return
    }
    const data = pan.data as PantallaExamen
    setExamen(data)
    const map: Record<string, { texto: string; opcion: number | null }> = {}
    ;(data.mis_respuestas || []).forEach((r) => {
      map[r.id_pregunta] = {
        texto: r.respuesta_texto || '',
        opcion: r.opcion_elegida ?? null
      }
    })
    setRespuestasLocales(map)
  }

  const guardarRespuesta = async (idPregunta: string, texto: string, opcion: number | null) => {
    if (!examen) return
    await apiService.usuarioPruebaResponder(examen.id_asignacion, idPregunta, texto || null, opcion)
  }

  const finalizar = async () => {
    if (!examen) return
    setLoading(true)
    const r = await apiService.usuarioPruebaFinalizar(examen.id_asignacion)
    setLoading(false)
    if (!r.success) {
      setError(r.error || 'No se pudo enviar')
      return
    }
    setExamen(null)
    await load()
  }

  if (authLoading || (loading && items.length === 0 && !error)) {
    return (
      <div className="mis-pruebas-loading">
        <div className="mis-pruebas-spinner" />
        <p>Cargando…</p>
      </div>
    )
  }

  if (examen) {
    const soloLectura = examen.estado === 'finalizada'
    return (
      <div className="mis-pruebas-page mis-pruebas-page--examen">
        <header className="mis-pruebas-examen-head">
          <div>
            <h1>{examen.prueba.titulo}</h1>
            {examen.prueba.descripcion && <p className="mis-pruebas-desc">{examen.prueba.descripcion}</p>}
            {examen.estado === 'finalizada' && (
              <p className="mis-pruebas-resultado-resumen">
                {examen.calificacion_pendiente ? (
                  <>
                    Puntaje parcial: {examen.puntaje_obtenido ?? '—'} / {examen.puntaje_maximo ?? '—'} · Pendiente de
                    calificación (desarrollo)
                  </>
                ) : (
                  <>
                    Puntaje: {examen.puntaje_obtenido ?? '—'} / {examen.puntaje_maximo ?? '—'}
                    {examen.aprobado === true && ' · Aprobado'}
                    {examen.aprobado === false && ' · No aprobado'}
                    {examen.aprobado == null && !examen.calificacion_pendiente && ''}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="mis-pruebas-examen-meta">
            {tiempoRestanteGlobal != null && (
              <span className={tiempoRestanteGlobal === 0 ? 'mis-pruebas-time mis-pruebas-time--warn' : 'mis-pruebas-time'}>
                Tiempo: {Math.floor(tiempoRestanteGlobal / 60)}:
                {(tiempoRestanteGlobal % 60).toString().padStart(2, '0')}
              </span>
            )}
            <button type="button" className="mis-pruebas-btn ghost" onClick={() => setExamen(null)}>
              Volver al listado
            </button>
            {!soloLectura && (
              <button type="button" className="mis-pruebas-btn primary" onClick={() => void finalizar()}>
                Finalizar y enviar
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="mis-pruebas-alert" role="alert">
            {error}
          </div>
        )}
        <ol className="mis-pruebas-preguntas">
          {examen.preguntas.map((pq, idx) => {
            const local = respuestasLocales[pq.id] || { texto: '', opcion: null }
            return (
              <li key={pq.id} className="mis-pruebas-pregunta">
                <div className="mis-pruebas-pregunta-top">
                  <span className="mis-pruebas-n">{idx + 1}.</span>
                  <p>
                    {pq.texto}
                    {pq.puntos != null && (
                      <span className="mis-pruebas-puntos-badge"> ({pq.puntos} pts)</span>
                    )}
                  </p>
                </div>
                {pq.tiempo_segundos != null && (
                  <p className="mis-pruebas-hint">Sugerencia: {pq.tiempo_segundos}s para esta pregunta</p>
                )}
                {pq.tipo === 'multiple_choice' && pq.opciones && (
                  <div className="mis-pruebas-mc">
                    {pq.opciones.map((op, i) => (
                      <label key={i} className="mis-pruebas-radio">
                        <input
                          type="radio"
                          name={pq.id}
                          checked={local.opcion === i}
                          disabled={soloLectura}
                          onChange={() => {
                            setRespuestasLocales((prev) => ({
                              ...prev,
                              [pq.id]: { ...local, opcion: i }
                            }))
                            void guardarRespuesta(pq.id, '', i)
                          }}
                        />
                        {op}
                      </label>
                    ))}
                  </div>
                )}
                {pq.tipo === 'desarrollo' && (
                  <textarea
                    className="mis-pruebas-ta"
                    rows={5}
                    disabled={soloLectura}
                    value={local.texto}
                    onChange={(e) => {
                      const v = e.target.value
                      setRespuestasLocales((prev) => ({
                        ...prev,
                        [pq.id]: { ...local, texto: v }
                      }))
                    }}
                    onBlur={(e) => {
                      if (!soloLectura) void guardarRespuesta(pq.id, e.target.value, null)
                    }}
                    placeholder="Escribí tu respuesta…"
                  />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className="mis-pruebas-page">
      <header className="mis-pruebas-header">
        <div>
          <h1>📋 Mis evaluaciones</h1>
          <p className="mis-pruebas-lead">Pruebas asignadas por Recursos Humanos. Iniciá, respondé y enviá.</p>
        </div>
        <button type="button" className="mis-pruebas-btn ghost" onClick={() => navigate('/')}>
          ← Tablero
        </button>
      </header>
      {error && (
        <div className="mis-pruebas-alert" role="alert">
          {error}
        </div>
      )}
      <div className="mis-pruebas-list">
        {items.length === 0 && !loading && <p className="mis-pruebas-empty">No tenés pruebas asignadas.</p>}
        {items.map((row) => (
          <article key={row.id_asignacion} className="mis-pruebas-card">
            <div>
              <h2>{row.titulo}</h2>
              {row.descripcion && <p className="mis-pruebas-desc">{row.descripcion}</p>}
              <p className="mis-pruebas-estado">
                Estado: <strong>{row.estado}</strong>
                {row.tiempo_total_segundos != null && (
                  <> · Tiempo total: {Math.round(row.tiempo_total_segundos / 60)} min</>
                )}
                {row.estado === 'finalizada' && row.puntaje_maximo != null && (
                  <>
                    {' '}
                    · Puntaje: {row.puntaje_obtenido ?? '—'} / {row.puntaje_maximo}
                    {row.calificacion_pendiente && ' (pendiente calif.)'}
                    {!row.calificacion_pendiente && row.aprobado === true && ' · Aprobado'}
                    {!row.calificacion_pendiente && row.aprobado === false && ' · No aprobado'}
                  </>
                )}
              </p>
            </div>
            <div className="mis-pruebas-card-actions">
              {row.estado === 'pendiente' && (
                <button type="button" className="mis-pruebas-btn primary" onClick={() => void abrirExamen(row, true)}>
                  Iniciar prueba
                </button>
              )}
              {row.estado === 'en_progreso' && (
                <button type="button" className="mis-pruebas-btn primary" onClick={() => void abrirExamen(row, false)}>
                  Continuar
                </button>
              )}
              {row.estado === 'finalizada' && (
                <button type="button" className="mis-pruebas-btn secondary" onClick={() => void abrirExamen(row, false)}>
                  Ver resultado
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
