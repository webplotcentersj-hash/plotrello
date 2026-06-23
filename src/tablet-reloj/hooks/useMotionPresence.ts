import { useEffect, useRef, useState, type RefObject } from 'react'

const MOTION_THRESHOLD = 0.08
const MOTION_CHECKS = 2
const CHECK_INTERVAL_MS = 800

/** Detección de presencia por cambio de píxeles en cámara (mismo criterio que el tótem). */
export function useMotionPresence(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  onDetected: () => void
) {
  const [activo, setActivo] = useState(false)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!enabled) {
      setActivo(false)
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 64
    const h = 48
    canvas.width = w
    canvas.height = h

    let lastFrame: number[] | null = null
    let sameCount = 0
    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    const check = () => {
      if (cancelled) return
      if (video.readyState < 2) {
        timeoutId = setTimeout(check, CHECK_INTERVAL_MS)
        return
      }
      ctx.drawImage(video, 0, 0, w, h)
      const img = ctx.getImageData(0, 0, w, h)
      const gray: number[] = []
      for (let i = 0; i < img.data.length; i += 4) {
        gray.push((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3)
      }
      if (lastFrame && lastFrame.length === gray.length) {
        let diff = 0
        for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - lastFrame[i])
        const change = diff / (gray.length * 255)
        setActivo(change > MOTION_THRESHOLD * 0.5)
        if (change > MOTION_THRESHOLD) {
          sameCount++
          if (sameCount >= MOTION_CHECKS) {
            sameCount = 0
            onDetectedRef.current()
            return
          }
        } else {
          sameCount = 0
        }
      }
      lastFrame = gray
      timeoutId = setTimeout(check, CHECK_INTERVAL_MS)
    }

    timeoutId = setTimeout(check, 1200)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      setActivo(false)
    }
  }, [enabled, videoRef, canvasRef])

  return { sensorActivo: activo }
}
