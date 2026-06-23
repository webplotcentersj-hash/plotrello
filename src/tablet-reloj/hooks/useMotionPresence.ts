import { useEffect, useRef, useState, type RefObject } from 'react'

const MOTION_THRESHOLD = 0.08
const MOTION_CHECKS = 2
const CHECK_INTERVAL_MS = 600
const DETECT_COOLDOWN_MS = 2500

/** Detección de presencia por cambio de píxeles (canvas interno, no comparte con la captura). */
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
        setActivo(change > MOTION_THRESHOLD * 0.45)
        if (change > MOTION_THRESHOLD) {
          sameCount++
          if (sameCount >= MOTION_CHECKS) {
            sameCount = 0
            const now = Date.now()
            if (now - lastDetectRef.current >= DETECT_COOLDOWN_MS) {
              lastDetectRef.current = now
              onDetectedRef.current()
            }
            timeoutId = setTimeout(check, CHECK_INTERVAL_MS)
            return
          }
        } else {
          sameCount = 0
        }
      }
      lastFrame = gray
      timeoutId = setTimeout(check, CHECK_INTERVAL_MS)
    }

    timeoutId = setTimeout(check, 1000)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      setActivo(false)
    }
  }, [enabled, videoRef])

  return { sensorActivo: activo }
}
