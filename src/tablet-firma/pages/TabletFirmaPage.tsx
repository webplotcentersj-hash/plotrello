import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiService from '../../services/api'
import type { OrdenTrabajo } from '../../types/api'
import './TabletFirmaPage.css'

export default function TabletFirmaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [entregadoA, setEntregadoA] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (id) {
      loadOrden()
    }
  }, [id])

  const loadOrden = async () => {
    const ordenId = id ? Number(id) : NaN
    if (!id || Number.isNaN(ordenId)) {
      setError('Identificador de orden no válido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getOrden(ordenId)
      if (response.success && response.data) {
        setOrden(response.data)
        setEntregadoA(response.data.cliente || '')
      } else {
        setError(response.error || 'Orden no encontrada')
      }
    } catch (err) {
      console.error('Error cargando orden:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && orden) {
      const cleanup = initCanvas()
      return cleanup
    }
  }, [loading, orden])

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    // Canvas grande optimizado para tablet
    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.min(window.innerWidth - 80, 1200)
    const displayHeight = 400 // Área grande para firma
    
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'
    
    ctx.scale(dpr, dpr)
    
    // Configuración optimizada para tablet/stylus
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineWidth = 4 // Línea más gruesa para tablet
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    let lastX = 0
    let lastY = 0
    let isDrawingLocal = false

    const getCoordinates = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      return {
        x: ((clientX - rect.left) / rect.width) * displayWidth,
        y: ((clientY - rect.top) / rect.height) * displayHeight
      }
    }

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      isDrawingLocal = true
      const coords = getCoordinates(e)
      lastX = coords.x
      lastY = coords.y
      
      ctx.beginPath()
      ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingLocal) return
      e.preventDefault()
      const coords = getCoordinates(e)
      const x = coords.x
      const y = coords.y

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(x, y)
      ctx.stroke()

      lastX = x
      lastY = y
    }

    const stopDrawing = () => {
      if (isDrawingLocal) {
        isDrawingLocal = false
        setFirmaDataUrl(canvas.toDataURL('image/png', 1.0))
      }
    }

    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseout', stopDrawing)
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDrawing)

    return () => {
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDrawing)
      canvas.removeEventListener('mouseout', stopDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDrawing)
    }
  }

  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFirmaDataUrl(null)
  }

  const handleProcesarEntrega = async () => {
    if (!orden) return

    if (!firmaDataUrl) {
      setError('Por favor, firma el comprobante')
      return
    }

    if (!entregadoA.trim()) {
      setError('Por favor, ingresa el nombre de quien retira')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const numeroOp = orden.numero_op?.trim()
      if (!numeroOp) {
        setError('Orden sin número de OP')
        setSaving(false)
        return
      }

      // 1) Guardar firma en firmas_entrega_cliente para que se vea en vivo en mostrador (Realtime)
      const saveFirmaRes = await apiService.saveFirmaCliente(numeroOp, {
        firmaDataUrl,
        entregadoA: entregadoA.trim(),
        dniRetira: dniRetira.trim() || undefined
      })
      if (!saveFirmaRes.success) {
        setError(saveFirmaRes.error || 'Error al guardar la firma')
        setSaving(false)
        return
      }

      // 2) Marcar orden como entregada (ordenes_trabajo)
      const usuarioId = parseInt(localStorage.getItem('usuario_id') || '1', 10)
      const usuarioData = localStorage.getItem('usuario')
      const usuarioNombre = usuarioData ? (JSON.parse(usuarioData) as { nombre?: string }).nombre : 'Tablet Firma'

      const response = await apiService.procesarEntrega(orden.id!, {
        firmaDataUrl,
        entregadoA: entregadoA.trim(),
        dniRetira: dniRetira.trim() || undefined,
        observaciones: undefined,
        usuarioId,
        usuarioNombre: usuarioNombre || 'Tablet Firma'
      })

      if (!response.success) {
        setError(response.error || 'Error al procesar la entrega')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err) {
      console.error('Error procesando entrega:', err)
      setError('Error inesperado al procesar la entrega')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tablet-firma-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando orden...</p>
        </div>
      </div>
    )
  }

  if (error && !orden) {
    return (
      <div className="tablet-firma-page">
        <div className="error-container">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Volver
          </button>
        </div>
      </div>
    )
  }

  if (!orden) {
    return null
  }

  return (
    <div className="tablet-firma-page">
      {/* Header simplificado */}
      <header className="firma-header">
        <div className="firma-header-content">
          <div>
            <h1>OP #{orden.numero_op}</h1>
            <p className="firma-cliente">{orden.cliente}</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/')}
            disabled={saving}
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="firma-content">
        {/* Información rápida */}
        <div className="info-badge">
          <span>📋 {orden.numero_op}</span>
          {orden.dni_cuit && <span>🆔 {orden.dni_cuit}</span>}
        </div>

        {/* Campo nombre */}
        <div className="input-group">
          <label>Nombre de quien retira: *</label>
          <input
            type="text"
            value={entregadoA}
            onChange={(e) => setEntregadoA(e.target.value)}
            placeholder="Nombre completo"
            className="input-large"
            autoComplete="name"
            disabled={saving || success}
          />
        </div>

        {/* Campo DNI opcional */}
        <div className="input-group">
          <label>DNI (opcional):</label>
          <input
            type="text"
            value={dniRetira}
            onChange={(e) => setDniRetira(e.target.value)}
            placeholder="DNI"
            className="input-large"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={saving || success}
          />
        </div>

        {/* Área de firma - GRANDE para tablet */}
        <div className="firma-area-container">
          <label className="firma-label">Firma del Cliente: *</label>
          <div className={`firma-area ${!firmaDataUrl && error ? 'firma-area-error' : ''}`}>
            <canvas
              ref={canvasRef}
              className="firma-canvas-large"
            />
            {firmaDataUrl && (
              <div className="firma-status">
                <span>✅ Firma completada</span>
                <button
                  className="btn-clear"
                  onClick={limpiarFirma}
                  disabled={saving || success}
                >
                  🗑️ Limpiar
                </button>
              </div>
            )}
          </div>
          <p className="firma-hint">
            {firmaDataUrl 
              ? '✅ Firma registrada. Podés limpiarla si necesitás corregirla.' 
              : '👆 Firma en el área de arriba'}
          </p>
        </div>

        {/* Mensajes de error/éxito */}
        {error && (
          <div className="message-banner error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {success && (
          <div className="message-banner success">
            <span>✅ Orden procesada exitosamente. Redirigiendo...</span>
          </div>
        )}

        {/* Botón principal */}
        <button
          className="btn-firma-large"
          onClick={handleProcesarEntrega}
          disabled={saving || success || !firmaDataUrl || !entregadoA.trim()}
        >
          {saving ? '⏳ Procesando...' : success ? '✅ Completado' : '✅ Confirmar Entrega'}
        </button>
      </div>
    </div>
  )
}

