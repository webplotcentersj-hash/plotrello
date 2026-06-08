import { useCallback, useEffect, useRef, useState } from 'react'

type Options = {
  enabled?: boolean
  width?: number
  height?: number
}

export function useSignatureCanvas({
  enabled = true,
  width = 400,
  height = 140
}: Options = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)

  const limpiarFirma = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    setFirmaDataUrl(null)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.min(width, window.innerWidth - 80)
    const displayHeight = height

    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
    ctx.scale(dpr, dpr)

    ctx.strokeStyle = '#111827'
    ctx.fillStyle = '#111827'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    let lastX = 0
    let lastY = 0
    let isDrawing = false

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
      setFirmaDataUrl(canvas.toDataURL('image/png', 1))
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
  }, [enabled, width, height])

  return { canvasRef, firmaDataUrl, setFirmaDataUrl, limpiarFirma }
}
