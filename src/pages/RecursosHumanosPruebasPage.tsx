import { useEffect, useState } from 'react'
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
  created_at?: string
  preguntas_count?: number
  asignados?: number
  finalizados?: number
}

function emptyPregunta(orden: number): PruebaPreguntaInput & { opcionesStr: string } {
  return {
    orden,
    texto: '',
    tipo: 'desarrollo',
    tiempo_segundos: null,
    opciones: [],
    indice_correcto: null,
    opcionesStr: ''
  }
}

const RecursosHumanosPruebasPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const puedeGestionar =
    !!usuario &&
    (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lista, setLista] = useState<PruebaRow[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tiempoTotalMin, setTiempoTotalMin] = useState<string>('')
  const [preguntas, setPreguntas] = useState<(PruebaPreguntaInput & { opcionesStr: string })[]>([
    emptyPregunta(1)
  ])

  const [pruebaAsignarId, setPruebaAsignarId] = useState<string>('')
  const [seleccionUsuarios, setSeleccionUsuarios] = useState<Record<number, boolean>>({})

  const [resultadosJson, setResultadosJson] = useState<string | null>(null)
  const [resultadosTitulo, setResultadosTitulo] = useState('')

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
    const validas = preguntas.filter((p) => p.texto.trim())
    if (validas.length === 0) {
      setError('Agregá al menos una pregunta con texto.')
      return
    }
    const preparadas: PruebaPreguntaInput[] = []
    for (const p of validas) {
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
              : null
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
    setResultadosTitulo(pr.titulo)
    setResultadosJson(JSON.stringify(r.data, null, 2))
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
            Creá evaluaciones con preguntas tipo desarrollo o multiple choice, tiempo de prueba y por
            pregunta; asigná a usuarios y revisá respuestas.
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
        </div>
        <label className="rrhh-pruebas-block">
          Descripción
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
        </label>

        <h3>Preguntas</h3>
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
            <div className="rrhh-pruebas-grid">
              <label>
                Tipo
                <select
                  value={p.tipo}
                  onChange={(e) => {
                    const t = e.target.value as PruebaPreguntaTipo
                    setPreguntas((prev) => {
                      const n = [...prev]
                      n[idx] = { ...n[idx], tipo: t, opcionesStr: t === 'multiple_choice' ? n[idx].opcionesStr : '' }
                      return n
                    })
                  }}
                >
                  <option value="desarrollo">Desarrollo (texto libre)</option>
                  <option value="multiple_choice">Multiple choice</option>
                </select>
              </label>
              <label>
                Tiempo para esta pregunta (seg., opcional)
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
                  Opciones (una por línea)
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
            <select value={pruebaAsignarId} onChange={(e) => setPruebaAsignarId(e.target.value)}>
              <option value="">— Elegí —</option>
              {lista.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.titulo}
                </option>
              ))}
            </select>
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
        <h2>Pruebas y resultados</h2>
        <div className="rrhh-pruebas-table-wrap">
          <table className="rrhh-pruebas-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Preguntas</th>
                <th>Asignados</th>
                <th>Finalizados</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((pr) => (
                <tr key={pr.id}>
                  <td>{pr.titulo}</td>
                  <td>{pr.preguntas_count ?? '—'}</td>
                  <td>{pr.asignados ?? '—'}</td>
                  <td>{pr.finalizados ?? '—'}</td>
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

      {resultadosJson && (
        <div
          className="rrhh-pruebas-modal-overlay"
          role="dialog"
          aria-modal
          onMouseDown={(e) => e.target === e.currentTarget && setResultadosJson(null)}
        >
          <div className="rrhh-pruebas-modal">
            <div className="rrhh-pruebas-modal-head">
              <h3>Resultados: {resultadosTitulo}</h3>
              <button type="button" onClick={() => setResultadosJson(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <pre className="rrhh-pruebas-pre">{resultadosJson}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosPruebasPage
