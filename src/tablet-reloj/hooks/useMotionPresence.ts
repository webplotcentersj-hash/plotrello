import { useEffect, useRef, useState, type RefObject } from 'react'

const MOTION_THRESHOLD = 0.045
const MOTION_CHECKS = 1
const MIN_FRAME_MS = 66
const DETECT_COOLDOWN_MS = 800

/** Detección de presencia por cambio de píxeles — loop con rAF para mínima latencia. */
export function useMotionPresence(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onDetected: () => void
) {
  const [activo, setActivo] = useState(false)
  const onDetectedRef = useRef(onDetected)
  const lastDetectRef = useRef(0)
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!enabled) {
      setActivo(false)
      return
    }

    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const w = 48
    const h = 36
    canvas.width = w
    canvas.height = h

    let lastFrame: number[] | null = null
    let sameCount = 0
    let rafId = 0
    let cancelled = false
    let lastTick = 0

    const check = (now: number) => {
      if (cancelled) return
      if (now - lastTick < MIN_FRAME_MS) {
        rafId = requestAnimationFrame(check)
        return
      }
      lastTick = now

      if (video.readyState < 2) {
        rafId = requestAnimationFrame(check)
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
        setActivo(change > MOTION_THRESHOLD * 0.4)
        if (change > MOTION_THRESHOLD) {
          sameCount++
          if (sameCount >= MOTION_CHECKS) {
            sameCount = 0
            const t = Date.now()
            if (t - lastDetectRef.current >= DETECT_COOLDOWN_MS) {
              lastDetectRef.current = t
              onDetectedRef.current()
            }
          }
        } else {
          sameCount = 0
        }
      }
      lastFrame = gray
      rafId = requestAnimationFrame(check)
    }

    rafId = requestAnimationFrame(check)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      setActivo(false)
    }
  }, [enabled, videoRef])

  return { sensorActivo: activo }
}
