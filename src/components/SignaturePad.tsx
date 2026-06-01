import { useEffect, useRef, useCallback } from 'react'
import './SignaturePad.css'

type Props = {
  label?: string
  hint?: string
  signerHint?: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  error?: string
  width?: number
  height?: number
}

export default function SignaturePad({
  label = 'Firma',
  hint = 'Firmá en el recuadro con el mouse o el dedo',
  signerHint,
  value,
  onChange,
  error,
  width = 600,
  height = 200
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.min(width, canvas.parentElement?.clientWidth ?? width)
    const displayHeight = height

    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    let lastX = 0
    let lastY = 0
    let isDrawing = false

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
      isDrawing = true
      const coords = getCoordinates(e)
      lastX = coords.x
      lastY = coords.y
      ctx.beginPath()
      ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return
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
      if (!isDrawing) return
      isDrawing = false
      onChangeRef.current(canvas.toDataURL('image/png', 1.0))
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
  }, [height, width])

  const limpiar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChangeRef.current(null)
  }, [])

  return (
    <div className="signature-pad">
      <div className="signature-pad-header">
        <span className="signature-pad-label">{label}</span>
        {signerHint ? <span className="signature-pad-signer">{signerHint}</span> : null}
      </div>
      {error ? <p className="signature-pad-error">{error}</p> : null}
      <div className={`signature-pad-container${error ? ' signature-pad-container--error' : ''}`}>
        <canvas ref={canvasRef} className="signature-pad-canvas" />
        <div className="signature-pad-actions">
          <button type="button" className="btn-secondary btn-small" onClick={limpiar}>
            Limpiar firma
          </button>
          {value ? <span className="signature-pad-ok">Firma registrada</span> : null}
        </div>
      </div>
      <p className="signature-pad-hint">
        {value ? 'Podés limpiar y volver a firmar si hace falta.' : hint}
      </p>
    </div>
  )
}
