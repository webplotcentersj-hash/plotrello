import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import {
  DEPARTAMENTOS_SAN_JUAN,
  coordsDistritoEnDepartamento,
  departamentoPorId
} from '../data/sanJuanSatisfaccionCatalog'
import './SatisfaccionClientePublicPage.css'

const RATINGS = [
  { value: 1 as const, emoji: '😠', label: 'Muy malo' },
  { value: 2 as const, emoji: '😕', label: 'Malo' },
  { value: 3 as const, emoji: '😐', label: 'Regular' },
  { value: 4 as const, emoji: '🙂', label: 'Bueno' },
  { value: 5 as const, emoji: '😀', label: 'Excelente' }
]

type Sexo = 'f' | 'm' | 'x' | 'prefiero_no_decir'

/** Resuelve id interno del departamento: `depto` (slug) o `departamento` (nombre visible). */
function departamentoIdDesdeParams(params: URLSearchParams): string | null {
  const slug = (params.get('depto') || '').trim().toLowerCase()
  if (slug && departamentoPorId(slug)) return slug
  const nom = (params.get('departamento') || '').trim()
  if (!nom) return null
  const dep = DEPARTAMENTOS_SAN_JUAN.find((d) => d.nombre.toLowerCase() === nom.toLowerCase())
  return dep?.id ?? null
}

function distritoValidoEnDepartamento(depId: string, raw: string): string {
  const dep = departamentoPorId(depId)
  if (!dep || !raw.trim()) return ''
  const t = raw.trim()
  if (dep.distritos.includes(t)) return t
  const found = dep.distritos.find((x) => x.toLowerCase() === t.toLowerCase())
  return found ?? ''
}

const SatisfaccionClientePublicPage = () => {
  const [searchParams] = useSearchParams()
  const [departamentoId, setDepartamentoId] = useState<string>('')
  const [distrito, setDistrito] = useState('')
  const [edad, setEdad] = useState<string>('')
  const [sexo, setSexo] = useState<Sexo | ''>('')
  const [rating, setRating] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okId, setOkId] = useState<number | null>(null)

  const depSeleccionado = useMemo(
    () => DEPARTAMENTOS_SAN_JUAN.find((d) => d.id === departamentoId),
    [departamentoId]
  )

  const distritosOpciones = useMemo(() => depSeleccionado?.distritos ?? [], [depSeleccionado])

  const ubicacionPrecargada = useMemo(
    () =>
      Boolean(
        searchParams.get('depto')?.trim() ||
          searchParams.get('departamento')?.trim() ||
          searchParams.get('distrito')?.trim()
      ),
    [searchParams]
  )

  const aplicarUbicacionDesdeUrl = useCallback(() => {
    const depId = departamentoIdDesdeParams(searchParams)
    if (!depId) {
      return
    }
    const dep = departamentoPorId(depId)
    if (!dep) return
    setDepartamentoId(depId)
    const rawDist = (searchParams.get('distrito') || '').trim()
    if (rawDist) {
      const ok = distritoValidoEnDepartamento(depId, rawDist)
      setDistrito(ok)
    } else {
      setDistrito('')
    }
  }, [searchParams])

  useEffect(() => {
    aplicarUbicacionDesdeUrl()
  }, [aplicarUbicacionDesdeUrl])

  const onChangeDepartamento = (id: string) => {
    setDepartamentoId(id)
    setDistrito('')
    setError(null)
    setOkId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOkId(null)

    if (rating == null) {
      setError('Elegí cómo te sentís con la atención (tocá un emoji).')
      return
    }
    if (!depSeleccionado) {
      setError('Seleccioná el departamento.')
      return
    }
    if (!distrito) {
      setError('Seleccioná el distrito o localidad.')
      return
    }
    const ed = parseInt(edad, 10)
    if (!Number.isFinite(ed) || ed < 12 || ed > 110) {
      setError('Indicá una edad válida (entre 12 y 110 años).')
      return
    }
    if (!sexo) {
      setError('Seleccioná sexo o la opción que prefieras.')
      return
    }

    const { lat, lng } = coordsDistritoEnDepartamento(depSeleccionado.id, distrito)

    setSending(true)
    try {
      const res = await apiService.registrarEncuestaSatisfaccionPublic({
        rating,
        departamento: depSeleccionado.nombre,
        distrito,
        edad: ed,
        sexo,
        lat,
        lng,
        comentario: comentario.trim() || null
      })
      if (res.success && res.data) {
        setOkId(res.data.id)
        setRating(null)
        setComentario('')
        setEdad('')
        setSexo('')
        // Si el enlace trae depto/distrito (QR / tótem), se vuelven a precargar; si no, se limpian para el próximo cliente.
        if (departamentoIdDesdeParams(searchParams)) {
          aplicarUbicacionDesdeUrl()
        } else {
          setDepartamentoId('')
          setDistrito('')
        }
      } else {
        setError(res.error || 'No se pudo enviar. Intentá de nuevo más tarde.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="sat-cliente-page">
      <div className="sat-cliente-inner">
        <header className="sat-cliente-header">
          <h1>¿Cómo te fue con Plot Center?</h1>
          <p className="sat-cliente-lead">
            Tu opinión nos ayuda a mejorar. Es anónima y solo se usa de forma agregada en nuestro equipo de atención al público.
          </p>
        </header>

        <form className="sat-cliente-form" onSubmit={handleSubmit}>
          <section className="sat-cliente-block" aria-labelledby="sat-rating-title">
            <h2 id="sat-rating-title" className="sat-cliente-block-title">
              Calificación
            </h2>
            <div className="sat-cliente-emojis" role="group" aria-label="Calificación con emojis">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`sat-cliente-emoji-btn ${rating === r.value ? 'selected' : ''}`}
                  onClick={() => {
                    setRating(r.value)
                    setError(null)
                    setOkId(null)
                  }}
                  aria-pressed={rating === r.value}
                  aria-label={`${r.label}, ${r.value} de 5`}
                >
                  <span className="sat-cliente-emoji-face" aria-hidden>
                    {r.emoji}
                  </span>
                  <span className="sat-cliente-emoji-label">{r.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="sat-cliente-block" aria-labelledby="sat-ubic-title">
            <h2 id="sat-ubic-title" className="sat-cliente-block-title">
              Ubicación en San Juan
            </h2>
            {ubicacionPrecargada && (
              <p className="sat-cliente-precarga-hint">
                Zona precargada según el enlace. Si no corresponde a tu domicilio, podés cambiar departamento y
                distrito/localidad.
              </p>
            )}
            <div className="sat-cliente-row">
              <label className="sat-cliente-field">
                <span>Departamento</span>
                <select
                  value={departamentoId}
                  onChange={(e) => onChangeDepartamento(e.target.value)}
                  required
                >
                  <option value="">Elegí departamento…</option>
                  {DEPARTAMENTOS_SAN_JUAN.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sat-cliente-field">
                <span>Distrito / localidad</span>
                <select
                  value={distrito}
                  onChange={(e) => setDistrito(e.target.value)}
                  required
                  disabled={!depSeleccionado}
                >
                  <option value="">{depSeleccionado ? 'Elegí distrito…' : 'Primero el departamento'}</option>
                  {distritosOpciones.map((nom) => (
                    <option key={nom} value={nom}>
                      {nom}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="sat-cliente-block" aria-labelledby="sat-demo-title">
            <h2 id="sat-demo-title" className="sat-cliente-block-title">
              Sobre vos
            </h2>
            <div className="sat-cliente-row">
              <label className="sat-cliente-field">
                <span>Edad (años)</span>
                <input
                  type="number"
                  min={12}
                  max={110}
                  inputMode="numeric"
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  placeholder="Ej. 34"
                  required
                />
              </label>
              <fieldset className="sat-cliente-field sat-cliente-sexo">
                <legend>Sexo</legend>
                <div className="sat-cliente-sexo-options">
                  <label className="sat-cliente-radio">
                    <input type="radio" name="sexo" checked={sexo === 'f'} onChange={() => setSexo('f')} />
                    Mujer
                  </label>
                  <label className="sat-cliente-radio">
                    <input type="radio" name="sexo" checked={sexo === 'm'} onChange={() => setSexo('m')} />
                    Hombre
                  </label>
                  <label className="sat-cliente-radio">
                    <input type="radio" name="sexo" checked={sexo === 'x'} onChange={() => setSexo('x')} />
                    Otro
                  </label>
                  <label className="sat-cliente-radio">
                    <input
                      type="radio"
                      name="sexo"
                      checked={sexo === 'prefiero_no_decir'}
                      onChange={() => setSexo('prefiero_no_decir')}
                    />
                    Prefiero no decir
                  </label>
                </div>
              </fieldset>
            </div>
          </section>

          <section className="sat-cliente-block">
            <label className="sat-cliente-field sat-cliente-field-full">
              <span>Comentario (opcional)</span>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value.slice(0, 600))}
                rows={3}
                maxLength={600}
                placeholder="Contanos brevemente qué podríamos mejorar…"
              />
            </label>
          </section>

          {error && <div className="sat-cliente-alert sat-cliente-alert--error">{error}</div>}
          {okId != null && (
            <div className="sat-cliente-alert sat-cliente-alert--ok">
              ¡Gracias! Registramos tu respuesta (#{okId}).
            </div>
          )}

          <div className="sat-cliente-actions">
            <button type="submit" className="sat-cliente-submit" disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar encuesta'}
            </button>
          </div>
        </form>

        <footer className="sat-cliente-footer">
          <span>Plot Center · San Juan · Argentina</span>
        </footer>
      </div>
    </div>
  )
}

export default SatisfaccionClientePublicPage
