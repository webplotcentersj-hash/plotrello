import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenSeguimientoPublico } from '../types/api'
import { SATISFACCION_RATINGS } from '../data/satisfaccionRatings'
import './FirmaClientePage.css'

const STORAGE_KEY_PREFIX = 'firma_cliente_'

export default function FirmaClientePage() {
  const { opNumber } = useParams<{ opNumber: string }>()
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<OrdenSeguimientoPublico | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [entregadoA, setEntregadoA] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [comentarioTrabajo, setComentarioTrabajo] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (opNumber) loadOrden()
  }, [opNumber])

  const loadOrden = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getOrdenSeguimientoPublico(opNumber!)
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

    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.min(window.innerWidth - 48, 900)
    const displayHeight = 320

    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'
    ctx.scale(dpr, dpr)

    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    let lastX = 0
    let lastY = 0
    let isDrawingLocal = false

    const getCoordinates = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
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
      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(coords.x, coords.y)
      ctx.stroke()
      lastX = coords.x
      lastY = coords.y
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

  const handleConfirmarFirma = async () => {
    if (!orden || !firmaDataUrl || !entregadoA.trim()) return
    if (rating == null) {
      setError('Elegí cómo calificarías el trabajo (tocá un emoji).')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      firmaDataUrl,
      entregadoA: entregadoA.trim(),
      dniRetira: dniRetira.trim() || undefined
    }
    try {
      const res = await apiService.saveFirmaCliente(orden.numero_op, payload)
      if (!res.success) {
        setError(res.error || 'No se pudo guardar la firma')
        setSaving(false)
        return
      }

      const satRes = await apiService.registrarSatisfaccionEntregaPublic({
        numeroOp: orden.numero_op,
        rating,
        comentario: comentarioTrabajo.trim() || null,
        clienteNombre: orden.cliente || null,
        ordenId: orden.id ?? null
      })
      if (!satRes.success) {
        setError(satRes.error || 'La firma se guardó pero no se pudo registrar la encuesta.')
        setSaving(false)
        return
      }

      sessionStorage.setItem(STORAGE_KEY_PREFIX + orden.numero_op, JSON.stringify(payload))
      setSuccess(true)
    } catch (e) {
      setError('No se pudo guardar la firma. Revisá la conexión.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="firma-cliente-page">
        <div className="firma-cliente-loading">
          <div className="firma-cliente-spinner" />
          <p>Cargando orden...</p>
        </div>
      </div>
    )
  }

  if (!orden) {
    return (
      <div className="firma-cliente-page">
        <div className="firma-cliente-error">
          <h2>⚠️ No se encontró la orden</h2>
          <p>{error || 'Verificá el enlace.'}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="firma-cliente-page">
        <div className="firma-cliente-success">
          <div className="firma-cliente-success-icon">✅</div>
          <h2>¡Gracias!</h2>
          <p>Firma y encuesta registradas. Entregá el dispositivo al personal para completar la entrega.</p>
          <p className="firma-cliente-success-op">OP {orden.numero_op} · {orden.cliente}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="firma-cliente-page">
      <header className="firma-cliente-header">
        <img
          src="https://www.plotcenterlab.com.ar/Group%20187.png"
          alt="Logo"
          className="firma-cliente-logo"
        />
        <div>
          <h1>Firma de entrega</h1>
          <p className="firma-cliente-op">OP {orden.numero_op}</p>
          <p className="firma-cliente-cliente">{orden.cliente}</p>
        </div>
      </header>

      <div className="firma-cliente-content">
        <p className="firma-cliente-instruction">
          Por favor, completá los datos y firmá abajo para registrar la entrega.
        </p>

        <div className="firma-cliente-field">
          <label>Nombre de quien retira *</label>
          <input
            type="text"
            value={entregadoA}
            onChange={(e) => setEntregadoA(e.target.value)}
            placeholder="Nombre completo"
            disabled={saving}
            autoComplete="name"
          />
        </div>

        <div className="firma-cliente-field">
          <label>DNI (opcional)</label>
          <input
            type="text"
            value={dniRetira}
            onChange={(e) => setDniRetira(e.target.value)}
            placeholder="DNI"
            inputMode="numeric"
            disabled={saving}
          />
        </div>

        <div className="firma-cliente-firma-block">
          <label>Firma *</label>
          <div className="firma-cliente-canvas-wrap">
            <canvas ref={canvasRef} className="firma-cliente-canvas" />
          </div>
          {firmaDataUrl && (
            <div className="firma-cliente-firma-actions">
              <span className="firma-cliente-firma-ok">✅ Firma lista</span>
              <button type="button" className="firma-cliente-btn-clear" onClick={limpiarFirma} disabled={saving}>
                Limpiar
              </button>
            </div>
          )}
        </div>

        <section className="firma-cliente-satisfaccion" aria-labelledby="firma-sat-title">
          <h2 id="firma-sat-title" className="firma-cliente-satisfaccion-title">
            ¿Cómo estuvo el trabajo?
          </h2>
          <p className="firma-cliente-satisfaccion-sub">Tocá el emoji que mejor refleje tu experiencia con este pedido</p>
          <div className="firma-cliente-emojis" role="group" aria-label="Calificación del trabajo">
            {SATISFACCION_RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`firma-cliente-emoji-btn ${rating === r.value ? 'selected' : ''}`}
                onClick={() => {
                  setRating(r.value)
                  setError(null)
                }}
                disabled={saving}
                aria-pressed={rating === r.value}
                aria-label={`${r.label}, ${r.value} de 5`}
              >
                <span className="firma-cliente-emoji-face">{r.emoji}</span>
                <span className="firma-cliente-emoji-label">{r.label}</span>
              </button>
            ))}
          </div>
          <div className="firma-cliente-field">
            <label>Comentario (opcional)</label>
            <textarea
              value={comentarioTrabajo}
              onChange={(e) => setComentarioTrabajo(e.target.value)}
              placeholder="¿Algo que quieras contarnos sobre el trabajo?"
              maxLength={500}
              rows={3}
              disabled={saving}
            />
          </div>
        </section>

        {error && (
          <div className="firma-cliente-msg error">{error}</div>
        )}

        <button
          type="button"
          className="firma-cliente-btn-confirm"
          onClick={handleConfirmarFirma}
          disabled={saving || !firmaDataUrl || !entregadoA.trim() || rating == null}
        >
          {saving ? 'Guardando...' : 'Confirmar firma y encuesta'}
        </button>
      </div>
    </div>
  )
}
