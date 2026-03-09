import { useState } from 'react'
import apiService from '../services/api'
import './ReclamosPublicoPage.css'

const SECTORES = [
  { id: null as number | null, nombre: 'No especificado' },
  { id: 1, nombre: 'Diseño Gráfico' },
  { id: 2, nombre: 'Taller de Imprenta' },
  { id: 3, nombre: 'Taller Gráfico' },
  { id: 4, nombre: 'Instalaciones' },
  { id: 5, nombre: 'Metalúrgica' },
  { id: 6, nombre: 'Mostrador' },
  { id: 7, nombre: 'Caja' }
]

const ReclamosPublicoPage = () => {
  const [form, setForm] = useState({
    cliente_nombre: '',
    cliente_email: '',
    descripcion: '',
    prioridad: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    sector_id: null as number | null
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const desc = form.descripcion.trim()
    if (!desc) {
      setError('La descripción del reclamo es obligatoria.')
      return
    }

    if (!form.cliente_nombre.trim() && !form.cliente_email.trim()) {
      setError('Ingresá tu nombre o email para que podamos contactarte.')
      return
    }

    setSending(true)
    try {
      const res = await apiService.crearReclamoAtencion({
        cliente_nombre: form.cliente_nombre.trim() || null,
        cliente_email: form.cliente_email.trim() || null,
        descripcion: desc,
        prioridad: form.prioridad,
        sector_id: form.sector_id,
        estado: 'nuevo'
      })

      if (res.success) {
        setSuccess(true)
        setForm({ cliente_nombre: '', cliente_email: '', descripcion: '', prioridad: 'media', sector_id: null })
      } else {
        setError(res.error || 'No se pudo enviar el reclamo. Intentá nuevamente.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar. Intentá nuevamente.'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="reclamos-publico-page">
        <div className="reclamos-publico-container">
          <div className="reclamos-publico-success">
            <span className="reclamos-publico-success-icon">✓</span>
            <h1>Reclamo enviado</h1>
            <p>
              Tu reclamo fue recibido correctamente. Nos pondremos en contacto a la brevedad.
            </p>
            <button
              type="button"
              className="reclamos-publico-btn reclamos-publico-btn-secondary"
              onClick={() => setSuccess(false)}
            >
              Enviar otro reclamo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="reclamos-publico-page">
      <div className="reclamos-publico-container">
        <header className="reclamos-publico-header">
          <h1>Formulario de reclamos</h1>
          <p>Completá el formulario y te responderemos lo antes posible.</p>
        </header>

        <form className="reclamos-publico-form" onSubmit={handleSubmit}>
          {error && (
            <div className="reclamos-publico-error" role="alert">
              {error}
            </div>
          )}

          <div className="reclamos-publico-field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              type="text"
              value={form.cliente_nombre}
              onChange={(e) => setForm((f) => ({ ...f, cliente_nombre: e.target.value }))}
              placeholder="Tu nombre o empresa"
              autoComplete="name"
            />
          </div>

          <div className="reclamos-publico-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.cliente_email}
              onChange={(e) => setForm((f) => ({ ...f, cliente_email: e.target.value }))}
              placeholder="email@ejemplo.com"
              autoComplete="email"
            />
          </div>

          <div className="reclamos-publico-field">
            <label htmlFor="descripcion">Descripción del reclamo *</label>
            <textarea
              id="descripcion"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              rows={5}
              placeholder="Describí tu reclamo con el mayor detalle posible..."
              required
            />
          </div>

          <div className="reclamos-publico-row">
            <div className="reclamos-publico-field">
              <label htmlFor="prioridad">Prioridad</label>
              <select
                id="prioridad"
                value={form.prioridad}
                onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value as typeof form.prioridad }))}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div className="reclamos-publico-field">
              <label htmlFor="sector">Área relacionada</label>
              <select
                id="sector"
                value={form.sector_id ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, sector_id: e.target.value ? Number(e.target.value) : null }))}
              >
                {SECTORES.map((s) => (
                  <option key={s.id ?? 'none'} value={s.id ?? ''}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="reclamos-publico-btn reclamos-publico-btn-primary"
            disabled={sending}
          >
            {sending ? 'Enviando...' : 'Enviar reclamo'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ReclamosPublicoPage
