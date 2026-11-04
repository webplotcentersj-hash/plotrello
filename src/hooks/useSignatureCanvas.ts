import { useCallback, useEffect, useRef, useState } from 'react'

type Options = {
  enabled?: boolean
  width?: number
  height?: number
}

/**
 * Canvas de firma táctil/mouse.
 * Importante: pasar `enabled: true` recién cuando el <canvas> esté montado
 * (si el panel se renderiza condicionalmente).
 */
export function useSignatureCanvas({
  enabled = true,
  width = 560,
  height = 160
}: Options = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logicalSizeRef = useRef({ w: width, h: height })
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [hasStroke, setHasStroke] = useState(false)

  const setupSurface = useCallback(
    (clearStrokes: boolean) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const parentW = canvas.parentElement?.clientWidth || width
      const displayWidth = Math.max(220, Math.min(width, parentW))
      const displayHeight = height
      const dpr = window.devicePixelRatio || 1

      logicalSizeRef.current = { w: displayWidth, h: displayHeight }
      canvas.width = Math.max(1, Math.floor(displayWidth * dpr))
      canvas.height = Math.max(1, Math.floor(displayHeight * dpr))
      canvas.style.width = '100%'
      canvas.style.height = `${displayHeight}px`

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, displayWidth, displayHeight)
      ctx.strokeStyle = '#111827'
      ctx.fillStyle = '#111827'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (clearStrokes) {
        setFirmaDataUrl(null)
        setHasStroke(false)
      }
    },
    [width, height]
  )

  const limpiarFirma = useCallback(() => {
    setupSurface(true)
  }, [setupSurface])

  useEffect(() => {
    if (!enabled) return

    // Esperar un frame para que el canvas ya esté en el DOM y con ancho real.
    let raf = 0
    let disposed = false
    let isDrawing = false
    let lastX = 0
    let lastY = 0

    const bind = () => {
      const canvas = canvasRef.current
      if (!canvas || disposed) return
      const ctx = canvas.getContext('2d', { willReadFrequently: false })
      if (!ctx) return

      setupSurface(true)

      const getCoordinates = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect()
        const { w, h } = logicalSizeRef.current
        const touch = 'touches' in e ? e.touches[0] || e.changedTouches?.[0] : null
        const clientX = touch ? touch.clientX : (e as MouseEvent).clientX
        const clientY = touch ? touch.clientY : (e as MouseEvent).clientY
        const rw = rect.width || 1
        const rh = rect.height || 1
        return {
          x: ((clientX - rect.left) / rw) * w,
          y: ((clientY - rect.top) / rh) * h
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
        setHasStroke(true)
        setFirmaDataUrl(canvas.toDataURL('image/png', 1))
      }

      canvas.addEventListener('mousedown', startDrawing)
      canvas.addEventListener('mousemove', draw)
      canvas.addEventListener('mouseup', stopDrawing)
      canvas.addEventListener('mouseleave', stopDrawing)
      canvas.addEventListener('touchstart', startDrawing, { passive: false })
      canvas.addEventListener('touchmove', draw, { passive: false })
      canvas.addEventListener('touchend', stopDrawing)
      canvas.addEventListener('touchcancel', stopDrawing)

      return () => {
        canvas.removeEventListener('mousedown', startDrawing)
        canvas.removeEventListener('mousemove', draw)
        canvas.removeEventListener('mouseup', stopDrawing)
        canvas.removeEventListener('mouseleave', stopDrawing)
        canvas.removeEventListener('touchstart', startDrawing)
        canvas.removeEventListener('touchmove', draw)
        canvas.removeEventListener('touchend', stopDrawing)
        canvas.removeEventListener('touchcancel', stopDrawing)
      }
    }

    let unbind: (() => void) | undefined
    raf = window.requestAnimationFrame(() => {
      unbind = bind()
    })

    return () => {
      disposed = true
      window.cancelAnimationFrame(raf)
      unbind?.()
    }
  }, [enabled, setupSurface])

  return { canvasRef, firmaDataUrl, setFirmaDataUrl, limpiarFirma, hasStroke }
}
