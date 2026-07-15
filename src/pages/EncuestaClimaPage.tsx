import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  rrhhClimaListar,
  rrhhClimaPreguntas,
  rrhhClimaResponder
} from '../services/rrhhExtendidoService'
import type { RrhhClimaEncuesta, RrhhClimaPregunta } from '../types/api'
import './rrhhExtendido.css'

function tokenFor(encuestaId: string): string {
  const key = `rrhh-clima-token-${encuestaId}`
  let t = localStorage.getItem(key)
  if (!t) {
    t = `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`
    localStorage.setItem(key, t)
  }
  return t
}

const EncuestaClimaPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const encuestaId = Number(id)
  const [encuesta, setEncuesta] = useState<RrhhClimaEncuesta | null>(null)
  const [preguntas, setPreguntas] = useState<RrhhClimaPregunta[]>([])
  const [valores, setValores] = useState<Record<number, { num?: number; texto?: string }>>({})
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useMemo(() => (id ? tokenFor(id) : ''), [id])

  useEffect(() => {
    if (!encuestaId) return
    void (async () => {
      const list = await rrhhClimaListar()
      const found = list.data?.find((e) => e.id === encuestaId) || null
      setEncuesta(found)
      if (!found || found.estado !== 'activa') {
        setError('La encuesta no está activa')
        return
      }
      const already = localStorage.getItem(`rrhh-clima-done-${encuestaId}`)
      if (already) {
        setDone(true)
        return
      }
      const preg = await rrhhClimaPreguntas(encuestaId)
      if (preg.success && preg.data) setPreguntas(preg.data)
    })()
  }, [encuestaId])

  const enviar = async () => {
    if (!encuesta) return
    const respuestas = preguntas.map((p) => ({
      id_pregunta: p.id,
      valor_num: valores[p.id]?.num ?? null,
      valor_texto: valores[p.id]?.texto ?? null
    }))
    const res = await rrhhClimaResponder({
      idEncuesta: encuesta.id,
      tokenAnon: token,
      respuestas
    })
    if (!res.success) setError(res.error || 'Error')
    else {
      localStorage.setItem(`rrhh-clima-done-${encuesta.id}`, '1')
      setDone(true)
    }
  }

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>{encuesta?.titulo || 'Encuesta de clima'}</h1>
          <p>Respuesta anónima. No se guarda tu usuario.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/')}>
          Salir
        </button>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}
      {done ? (
        <div className="rrhh-ext-card">
          <p>¡Gracias! Tu respuesta fue registrada.</p>
        </div>
      ) : (
        <div className="rrhh-ext-card">
          <div className="rrhh-ext-form">
            {preguntas.map((p) => (
              <label key={p.id}>
                {p.texto}
                {p.tipo === 'texto' ? (
                  <textarea
                    rows={3}
                    value={valores[p.id]?.texto || ''}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [p.id]: { ...v[p.id], texto: e.target.value } }))
                    }
                  />
                ) : (
                  <select
                    value={valores[p.id]?.num ?? ''}
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        [p.id]: { ...v[p.id], num: Number(e.target.value) }
                      }))
                    }
                  >
                    <option value="">—</option>
                    {p.tipo === 'enps'
                      ? Array.from({ length: 11 }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))
                      : [1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                  </select>
                )}
              </label>
            ))}
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void enviar()}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EncuestaClimaPage
