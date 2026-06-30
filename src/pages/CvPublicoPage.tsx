import { useRef, useState } from 'react'
import apiService from '../services/api'
import { PUESTOS_POSTULACION, categoriaDePuesto } from '../data/puestosPostulacion'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { buildWhatsappLink } from '../utils/whatsappLink'
import './CvPublicoPage.css'

const MAX_CV_MB = 5
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const HR_WHATSAPP = '2646212163'
const LOGO_URL = 'https://www.plotcenterlab.com.ar/Group%20187.png'

const CvPublicoPage = () => {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [puesto, setPuesto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_CV_MB * 1024 * 1024) {
      setError(`El archivo supera ${MAX_CV_MB} MB.`)
      return
    }
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'doc', 'docx'].includes(ext)) {
      setError('Formato no permitido. Usá PDF, DOC o DOCX.')
      return
    }
    if (f.type && !ALLOWED_TYPES.includes(f.type) && ext === 'pdf' && f.type !== 'application/octet-stream') {
      // algunos navegadores reportan mime distinto
    }
    setCvFile(f)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim() || !email.trim() || !puesto) {
      setError('Completá nombre, email y puesto.')
      return
    }
    if (!cvFile) {
      setError('Adjuntá tu CV.')
      return
    }

    setLoading(true)
    try {
      const cvUrl = await uploadAttachmentAndGetUrl(cvFile, 'cv-postulaciones')
      const res = await apiService.submitPostulacionPublica({
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim() || undefined,
        puesto,
        categoria_puesto: categoriaDePuesto(puesto),
        mensaje: mensaje.trim() || undefined,
        cv_url: cvUrl,
        cv_nombre: cvFile.name,
        cv_mime: cvFile.type || undefined,
        website
      })

      if (res.success) {
        setSuccess(true)
        setNombre('')
        setEmail('')
        setTelefono('')
        setPuesto('')
        setMensaje('')
        setCvFile(null)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setError(res.error || 'No se pudo enviar. Intentá de nuevo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar.')
    } finally {
      setLoading(false)
    }
  }

  const waLink = buildWhatsappLink(
    HR_WHATSAPP,
    'Hola Plot Center, acabo de enviar mi CV por el formulario Trabajá con Nosotros.'
  )

  if (success) {
    return (
      <div className="cv-publico-page">
        <div className="cv-publico-card cv-publico-success">
          <img src={LOGO_URL} alt="Plot Center" className="cv-publico-logo" />
          <h1>¡Gracias por postularte!</h1>
          <p>Recibimos tu CV. El equipo de Recursos Humanos lo revisará y te contactará si tu perfil encaja.</p>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="cv-publico-wa-btn">
              <span>💬</span> Consultar por WhatsApp
            </a>
          )}
          <button type="button" className="cv-publico-secondary" onClick={() => setSuccess(false)}>
            Enviar otra postulación
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cv-publico-page">
      <div className="cv-publico-card">
        <header className="cv-publico-header">
          <img src={LOGO_URL} alt="Plot Center" className="cv-publico-logo" />
          <div>
            <h1>Trabajá con Nosotros</h1>
            <p>
              Si querés formar parte de nuestro equipo, completá el siguiente formulario y adjuntá tu CV.
            </p>
          </div>
        </header>

        <form className="cv-publico-form" onSubmit={handleSubmit}>
          <div className="cv-field">
            <label htmlFor="cv-nombre">Nombre Completo *</label>
            <input
              id="cv-nombre"
              type="text"
              placeholder="Ej: Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="cv-field">
            <label htmlFor="cv-email">Correo Electrónico *</label>
            <input
              id="cv-email"
              type="email"
              placeholder="Ej: juan.perez@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="cv-field">
            <label htmlFor="cv-tel">Teléfono</label>
            <input
              id="cv-tel"
              type="tel"
              placeholder="Ej: 264 123 4567"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="cv-field">
            <label htmlFor="cv-puesto">Puesto al que te postulás *</label>
            <select
              id="cv-puesto"
              value={puesto}
              onChange={(e) => setPuesto(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Seleccioná un puesto</option>
              {PUESTOS_POSTULACION.map((g) => (
                <optgroup key={g.categoria} label={g.categoria}>
                  {g.puestos.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="cv-field">
            <label htmlFor="cv-mensaje">Mensaje (Opcional)</label>
            <textarea
              id="cv-mensaje"
              rows={4}
              placeholder="Contanos un poco sobre vos..."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="cv-field">
            <label>Adjuntar CV *</label>
            <p className="cv-field-hint">Formatos aceptados: PDF, DOC, DOCX (Máx. {MAX_CV_MB}MB)</p>
            <div className="cv-file-row">
              <button
                type="button"
                className="cv-file-btn"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
              >
                📎 Seleccionar Archivo
              </button>
              <span className="cv-file-name">{cvFile ? cvFile.name : 'Ningún archivo seleccionado'}</span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={onFileChange}
                hidden
              />
            </div>
          </div>

          {/* Honeypot anti-spam */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="cv-honeypot"
            aria-hidden
          />

          {error && <div className="cv-error">{error}</div>}

          <button type="submit" className="cv-submit" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar Postulación'}
          </button>
        </form>

        {waLink && (
          <footer className="cv-publico-footer">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="cv-publico-wa-link">
              ¿Dudas? Escribinos por WhatsApp
            </a>
          </footer>
        )}
      </div>
    </div>
  )
}

export default CvPublicoPage
