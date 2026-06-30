import { useState, useRef } from 'react'
import apiService from '../services/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
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

const ESTADO_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  abierto: 'Abierto',
  en_curso: 'En curso',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado'
}

const ReclamosPublicoPage = () => {
  const [form, setForm] = useState({
    cliente_nombre: '',
    cliente_email: '',
    cliente_telefono: '',
    numero_op: '',
    descripcion: '',
    prioridad: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    sector_id: null as number | null
  })
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [reclamoId, setReclamoId] = useState<number | null>(null)

  // Buscador
  const [searchEmail, setSearchEmail] = useState('')
  const [searchTelefono, setSearchTelefono] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [reclamosEncontrados, setReclamosEncontrados] = useState<Array<{ id: number; descripcion: string; estado: string; numero_op: string | null; foto_producto_url: string | null; created_at: string }>>([])
  const [activeTab, setActiveTab] = useState<'form' | 'buscar'>('form')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const desc = form.descripcion.trim()
    if (!desc) {
      setError('La descripción del reclamo es obligatoria.')
      return
    }

    const email = form.cliente_email.trim()
    const telefono = form.cliente_telefono.trim().replace(/\D/g, '')
    if (!email) {
      setError('El email es obligatorio.')
      return
    }
    if (!telefono || telefono.length < 8) {
      setError('El teléfono es obligatorio (mínimo 8 dígitos).')
      return
    }

    setSending(true)
    try {
      let fotoUrl: string | null = null
      if (fotoFile) {
        setUploadingFoto(true)
        try {
          fotoUrl = await uploadAttachmentAndGetUrl(fotoFile, 'reclamos')
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : 'Error al subir la foto')
          setSending(false)
          setUploadingFoto(false)
          return
        }
        setUploadingFoto(false)
      }

      const res = await apiService.crearReclamoAtencion({
        cliente_nombre: form.cliente_nombre.trim() || null,
        cliente_email: email,
        cliente_telefono: form.cliente_telefono.trim() || null,
        numero_op: form.numero_op.trim() || null,
        foto_producto_url: fotoUrl,
        descripcion: desc,
        prioridad: form.prioridad,
        sector_id: form.sector_id,
        estado: 'nuevo'
      })

      if (res.success && res.data) {
        setSuccess(true)
        setReclamoId(res.data.id)
        setForm({ cliente_nombre: '', cliente_email: '', cliente_telefono: '', numero_op: '', descripcion: '', prioridad: 'media', sector_id: null })
        setFotoFile(null)
        setFotoPreview(null)
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

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError(null)
    setReclamosEncontrados([])

    const email = searchEmail.trim()
    const telefono = searchTelefono.trim().replace(/\D/g, '')
    if (!email && (!telefono || telefono.length < 8)) {
      setSearchError('Ingresá tu email o teléfono (mínimo 8 dígitos) para buscar.')
      return
    }

    setSearching(true)
    try {
      const res = await apiService.buscarReclamosPublico(email || '', telefono || '')
      if (res.success && res.data) {
        setReclamosEncontrados(res.data)
        if (res.data.length === 0) {
          setSearchError('No se encontraron reclamos con ese email o teléfono.')
        }
      } else {
        setSearchError(res.error || 'Error al buscar.')
      }
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Error al buscar.')
    } finally {
      setSearching(false)
    }
  }

  const formatFecha = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return s
    }
  }

  if (success && reclamoId != null) {
    return (
      <div className="reclamos-publico-page">
        <div className="reclamos-publico-container">
          <div className="reclamos-publico-success">
            <img src="https://www.plotcenterlab.com.ar/Group%20187.png" alt="Plot Center" className="reclamos-publico-logo" />
            <span className="reclamos-publico-success-icon">✓</span>
            <h1>Reclamo enviado</h1>
            <p className="reclamos-publico-success-id">
              Tu número de reclamo es: <strong>#{reclamoId}</strong>
            </p>
            <p>
              Guardá este número para consultar el estado. Nos pondremos en contacto a la brevedad.
            </p>
            <button
              type="button"
              className="reclamos-publico-btn reclamos-publico-btn-secondary"
              onClick={() => { setSuccess(false); setReclamoId(null) }}
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
          <div className="reclamos-publico-header-content">
            <img src="https://www.plotcenterlab.com.ar/Group%20187.png" alt="Plot Center" className="reclamos-publico-logo" />
            <div className="reclamos-publico-header-text">
              <h1>Formulario de reclamos</h1>
              <p>Completá el formulario y te responderemos lo antes posible. Podés consultar el estado con tu email o teléfono.</p>
            </div>
          </div>
        </header>

        <div className="reclamos-publico-tabs">
          <button
            type="button"
            className={`reclamos-publico-tab ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            Nuevo reclamo
          </button>
          <button
            type="button"
            className={`reclamos-publico-tab ${activeTab === 'buscar' ? 'active' : ''}`}
            onClick={() => setActiveTab('buscar')}
          >
            Consultar estado
          </button>
        </div>

        {activeTab === 'form' && (
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
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                value={form.cliente_email}
                onChange={(e) => setForm((f) => ({ ...f, cliente_email: e.target.value }))}
                placeholder="email@ejemplo.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="reclamos-publico-field">
              <label htmlFor="telefono">Teléfono *</label>
              <input
                id="telefono"
                type="tel"
                value={form.cliente_telefono}
                onChange={(e) => setForm((f) => ({ ...f, cliente_telefono: e.target.value }))}
                placeholder="11 1234-5678"
                autoComplete="tel"
                required
              />
            </div>

            <div className="reclamos-publico-field">
              <label htmlFor="numero_op">Número de OP</label>
              <input
                id="numero_op"
                type="text"
                value={form.numero_op}
                onChange={(e) => setForm((f) => ({ ...f, numero_op: e.target.value }))}
                placeholder="Ej: 12345"
                autoComplete="off"
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

            <div className="reclamos-publico-field">
              <label>Foto del producto</label>
              <div className="reclamos-publico-foto-upload">
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="reclamos-publico-foto-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFotoFile(file)
                      const reader = new FileReader()
                      reader.onload = () => setFotoPreview(reader.result as string)
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                {fotoPreview ? (
                  <div className="reclamos-publico-foto-preview">
                    <img src={fotoPreview} alt="Vista previa" />
                    <button
                      type="button"
                      className="reclamos-publico-foto-remove"
                      onClick={() => { setFotoFile(null); setFotoPreview(null); if (fotoInputRef.current) fotoInputRef.current.value = '' }}
                    >
                      ✕ Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="reclamos-publico-foto-btn"
                    onClick={() => fotoInputRef.current?.click()}
                  >
                    📷 Agregar foto del producto
                  </button>
                )}
              </div>
              {uploadingFoto && <p className="reclamos-publico-foto-uploading">Subiendo imagen...</p>}
            </div>

            <button
              type="submit"
              className="reclamos-publico-btn reclamos-publico-btn-primary"
              disabled={sending || uploadingFoto}
            >
              {sending ? 'Enviando...' : 'Enviar reclamo'}
            </button>
          </form>
        )}

        {activeTab === 'buscar' && (
          <div className="reclamos-publico-buscar">
            <form onSubmit={handleBuscar} className="reclamos-publico-form">
              {searchError && (
                <div className="reclamos-publico-error" role="alert">
                  {searchError}
                </div>
              )}
              <div className="reclamos-publico-field">
                <label htmlFor="search-email">Email</label>
                <input
                  id="search-email"
                  type="email"
                  value={searchEmail}
                  onChange={(e) => { setSearchEmail(e.target.value); setSearchError(null) }}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div className="reclamos-publico-field">
                <label htmlFor="search-telefono">Teléfono</label>
                <input
                  id="search-telefono"
                  type="tel"
                  value={searchTelefono}
                  onChange={(e) => { setSearchTelefono(e.target.value); setSearchError(null) }}
                  placeholder="11 1234-5678"
                />
              </div>
              <button
                type="submit"
                className="reclamos-publico-btn reclamos-publico-btn-primary"
                disabled={searching}
              >
                {searching ? 'Buscando...' : 'Buscar mis reclamos'}
              </button>
            </form>

            {reclamosEncontrados.length > 0 && (
              <div className="reclamos-publico-resultados">
                <h3>Reclamos encontrados</h3>
                {reclamosEncontrados.map((r) => (
                  <div key={r.id} className="reclamos-publico-reclamo-card">
                    <div className="reclamos-publico-reclamo-header">
                      <span className="reclamos-publico-reclamo-id">#{r.id}</span>
                      {r.numero_op && <span className="reclamos-publico-reclamo-op">OP #{r.numero_op}</span>}
                      <span className={`reclamos-publico-reclamo-estado estado-${r.estado}`}>
                        {ESTADO_LABELS[r.estado] || r.estado}
                      </span>
                    </div>
                    {r.foto_producto_url && (
                      <a href={r.foto_producto_url} target="_blank" rel="noopener noreferrer" className="reclamos-publico-reclamo-foto-link">
                        <img src={r.foto_producto_url} alt="Foto del producto" className="reclamos-publico-reclamo-foto" />
                      </a>
                    )}
                    <p className="reclamos-publico-reclamo-desc">{r.descripcion}</p>
                    <p className="reclamos-publico-reclamo-fecha">{formatFecha(r.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReclamosPublicoPage
