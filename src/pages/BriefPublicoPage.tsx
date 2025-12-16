import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import './BriefPublicoPage.css'

const BriefPublicoPage = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orden, setOrden] = useState<Partial<OrdenTrabajo> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [formData, setFormData] = useState({
    brief_publico: '',
    objetivo_proyecto: '',
    publico_objetivo: '',
    estilo_diseno: '',
    referencias: ''
  })

  useEffect(() => {
    if (token) {
      loadOrden()
    } else {
      setError('Token no válido')
      setLoading(false)
    }
  }, [token])

  const loadOrden = async () => {
    if (!token) return
    
    setLoading(true)
    try {
      const response = await apiService.obtenerOrdenPorBriefToken(token)
      if (response.success && response.data) {
        setOrden(response.data)
        setFormData({
          brief_publico: response.data.brief_publico || '',
          objetivo_proyecto: response.data.objetivo_proyecto || '',
          publico_objetivo: response.data.publico_objetivo || '',
          estilo_diseno: response.data.estilo_diseno || '',
          referencias: response.data.referencias || ''
        })
      } else {
        setError(response.error || 'No se pudo cargar la información de la orden')
      }
    } catch (error) {
      console.error('Error cargando orden:', error)
      setError('Error al cargar la información')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setSaving(true)
    setError(null)
    
    try {
      const response = await apiService.actualizarBriefPublico({
        token,
        brief_publico: formData.brief_publico.trim(),
        objetivo_proyecto: formData.objetivo_proyecto.trim() || undefined,
        publico_objetivo: formData.publico_objetivo.trim() || undefined,
        estilo_diseno: formData.estilo_diseno.trim() || undefined,
        referencias: formData.referencias.trim() || undefined
      })

      if (response.success) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
        }, 5000)
      } else {
        setError(response.error || 'Error al guardar el brief')
      }
    } catch (error) {
      console.error('Error guardando brief:', error)
      setError('Error al guardar el brief. Por favor intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="brief-publico-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando formulario...</p>
        </div>
      </div>
    )
  }

  if (error && !orden) {
    return (
      <div className="brief-publico-page">
        <div className="error-container">
          <h1>❌ Error</h1>
          <p>{error}</p>
          <p className="error-help">El enlace puede haber expirado o ser inválido. Por favor contacta con nosotros.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="brief-publico-page">
      <div className="brief-container">
        <header className="brief-header">
          <h1>📋 Formulario de Brief</h1>
          {orden && (
            <div className="orden-info">
              <p><strong>Orden:</strong> OP #{orden.numero_op}</p>
              <p><strong>Cliente:</strong> {orden.cliente}</p>
            </div>
          )}
        </header>

        {success && (
          <div className="success-message">
            ✅ ¡Brief guardado exitosamente! Gracias por completar el formulario.
          </div>
        )}

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="brief-form">
          <div className="form-section">
            <h2>Información del Proyecto</h2>
            <p className="section-description">
              Por favor completa este formulario con la información necesaria para tu proyecto.
              Todos los campos marcados con * son obligatorios.
            </p>

            <div className="form-group">
              <label htmlFor="brief_publico">
                Brief del Proyecto *
              </label>
              <textarea
                id="brief_publico"
                rows={8}
                value={formData.brief_publico}
                onChange={(e) => setFormData({ ...formData, brief_publico: e.target.value })}
                placeholder="Describe tu proyecto, objetivos, contexto y cualquier información relevante..."
                required
              />
              <small>Describe detalladamente qué necesitas, el propósito del proyecto y cualquier información relevante.</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="objetivo_proyecto">
                  Objetivo del Proyecto
                </label>
                <input
                  id="objetivo_proyecto"
                  type="text"
                  value={formData.objetivo_proyecto}
                  onChange={(e) => setFormData({ ...formData, objetivo_proyecto: e.target.value })}
                  placeholder="Ej: Incrementar ventas, Branding, etc."
                />
              </div>

              <div className="form-group">
                <label htmlFor="publico_objetivo">
                  Público Objetivo
                </label>
                <input
                  id="publico_objetivo"
                  type="text"
                  value={formData.publico_objetivo}
                  onChange={(e) => setFormData({ ...formData, publico_objetivo: e.target.value })}
                  placeholder="Ej: Jóvenes 18-25 años, Empresas B2B, etc."
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="estilo_diseno">
                Estilo de Diseño Deseado
              </label>
              <input
                id="estilo_diseno"
                type="text"
                value={formData.estilo_diseno}
                onChange={(e) => setFormData({ ...formData, estilo_diseno: e.target.value })}
                placeholder="Ej: Minimalista, Corporativo, Moderno, Colorido, etc."
              />
            </div>

            <div className="form-group">
              <label htmlFor="referencias">
                Referencias Visuales
              </label>
              <textarea
                id="referencias"
                rows={4}
                value={formData.referencias}
                onChange={(e) => setFormData({ ...formData, referencias: e.target.value })}
                placeholder="Enlaces a referencias visuales, Pinterest, Behance, o descripción de estilos deseados..."
              />
              <small>Puedes incluir enlaces a imágenes, Pinterest, Behance, o cualquier referencia visual que te guste.</small>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={saving || !formData.brief_publico.trim()}>
              {saving ? 'Guardando...' : 'Guardar Brief'}
            </button>
          </div>
        </form>

        <footer className="brief-footer">
          <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        </footer>
      </div>
    </div>
  )
}

export default BriefPublicoPage

