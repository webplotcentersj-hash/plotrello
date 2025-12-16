import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './BriefLinkSection.css'

type BriefLinkSectionProps = {
  ordenId?: number // Opcional: si no se proporciona, crea un brief independiente
}

const BriefLinkSection = ({ ordenId }: BriefLinkSectionProps) => {
  const { usuario, isAdmin, isDiseno } = useAuth()
  const [briefToken, setBriefToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Restringir acceso solo para diseño gráfico y admin
  // IMPORTANTE: Esta validación debe ir DESPUÉS de todos los hooks
  if (!isAdmin && !isDiseno) {
    return null
  }

  console.log('🔍 BriefLinkSection renderizado con ordenId:', ordenId, 'tipo:', typeof ordenId)

  useEffect(() => {
    console.log('🔍 BriefLinkSection useEffect ejecutado - ordenId:', ordenId)
    if (ordenId) {
      loadBriefToken()
    } else {
      console.error('❌ BriefLinkSection: ordenId es inválido:', ordenId)
    }
  }, [ordenId])

  const loadBriefToken = async () => {
    if (!ordenId || typeof ordenId !== 'number') return
    
    console.log('🔍 loadBriefToken llamado con ordenId:', ordenId)
    try {
      const ordenResponse = await apiService.getOrden(ordenId)
      console.log('🔍 Respuesta de getOrden:', ordenResponse)
      if (ordenResponse.success && ordenResponse.data?.brief_token) {
        console.log('✅ Token encontrado:', ordenResponse.data.brief_token)
        setBriefToken(ordenResponse.data.brief_token)
      } else {
        console.log('ℹ️ No hay token aún, el usuario puede generar uno')
      }
    } catch (error) {
      console.error('❌ Error cargando token de brief:', error)
    }
  }

  const handleGenerarLink = async () => {
    console.log('🔍 handleGenerarLink llamado con ordenId:', ordenId)
    setLoading(true)
    try {
      let response
      if (ordenId) {
        // Si hay ordenId, usar el método antiguo (compatibilidad)
        response = await apiService.generarBriefToken(ordenId)
      } else {
        // Si no hay ordenId, crear un brief independiente (nuevo flujo)
        const usuarioId = usuario?.id ? parseInt(usuario.id.toString()) : undefined
        response = await apiService.crearBriefPublico(usuarioId)
      }
      
      console.log('🔍 Respuesta:', response)
      if (response.success && response.data) {
        console.log('✅ Token generado exitosamente:', response.data)
        setBriefToken(response.data)
      } else {
        console.error('❌ Error generando token:', response.error)
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('❌ Error generando token:', error)
      alert('Error al generar el link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopiarLink = () => {
    if (!briefToken) return
    
    const url = `${window.location.origin}/brief/${briefToken}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      alert('Error al copiar el link')
    })
  }

  const handleEnviarWhatsApp = () => {
    if (!briefToken) return
    
    const url = `${window.location.origin}/brief/${briefToken}`
    const mensaje = `Hola! Te envío el formulario de brief para completar tu proyecto:\n\n${url}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleEnviarEmail = () => {
    if (!briefToken) return
    
    const url = `${window.location.origin}/brief/${briefToken}`
    const asunto = 'Formulario de Brief - Completa tu proyecto'
    const cuerpo = `Hola,\n\nTe envío el formulario de brief para completar tu proyecto:\n\n${url}\n\nPor favor completa todos los campos requeridos.\n\nSaludos!`
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
    window.location.href = mailtoUrl
  }

  const briefUrl = briefToken ? `${window.location.origin}/brief/${briefToken}` : null

  console.log('🔍 BriefLinkSection render final - briefToken:', briefToken, 'briefUrl:', briefUrl, 'loading:', loading)

  return (
    <div 
      className="brief-link-section" 
      style={{ 
        display: 'block', 
        visibility: 'visible', 
        opacity: 1,
        minHeight: '120px',
        border: '2px solid #667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.15)'
      }}
    >
      {briefToken ? (
        <div className="brief-link-container">
          <div className="brief-link-header">
            <span className="link-icon">🔗</span>
            <strong>Link del Formulario Generado</strong>
          </div>
          <div className="brief-link-url">
            <input
              type="text"
              value={briefUrl || ''}
              readOnly
              className="link-input"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              className="btn-copy"
              onClick={handleCopiarLink}
              title="Copiar link"
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>
          <div className="brief-link-actions">
            <button
              className="btn-share whatsapp"
              onClick={handleEnviarWhatsApp}
            >
              📱 Enviar por WhatsApp
            </button>
            <button
              className="btn-share email"
              onClick={handleEnviarEmail}
            >
              ✉️ Enviar por Email
            </button>
          </div>
          <p className="brief-link-help">
            Comparte este link con el cliente para que complete el formulario de brief.
          </p>
        </div>
      ) : (
        <div className="brief-link-empty">
          <p>No hay link generado aún. Genera un link para enviar el formulario al cliente.</p>
          <button
            className="btn-generar-link"
            onClick={handleGenerarLink}
            disabled={loading}
          >
            {loading ? 'Generando...' : '🔗 Generar Link del Formulario'}
          </button>
        </div>
      )}
    </div>
  )
}

export default BriefLinkSection

