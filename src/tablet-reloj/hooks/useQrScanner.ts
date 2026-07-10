import { useEffect, useRef, type RefObject } from 'react'
import jsQR from 'jsqr'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

const SCAN_INTERVAL_MS = 280

async function detectQrFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  if (canvas.width < 64 || canvas.height < 64) return null

  if (typeof window !== 'undefined' && window.BarcodeDetector) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const codes = await detector.detect(canvas)
      const value = codes[0]?.rawValue?.trim()
      if (value) return value
    } catch {
      /* fallback jsQR */
    }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth'
  })
  return code?.data?.trim() || null
}

/** Lee códigos QR desde el stream de video (cámara trasera o frontal). */
export function useQrScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onDetect: (payload: string) => void
): void {
  const onDetectRef = useRef(onDetect)
  const lastPayloadRef = useRef('')
  const lastAtRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  onDetectRef.current = onDetect

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const canvas = document.createElement('canvas')
    canvasRef.current = canvas

    const tick = async () => {
      if (cancelled) return
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.videoWidth < 64) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      try {
        const payload = await detectQrFromCanvas(canvas)
        if (!payload || cancelled) return
        const now = Date.now()
        if (payload === lastPayloadRef.current && now - lastAtRef.current < 4000) return
        lastPayloadRef.current = payload
        lastAtRef.current = now
        onDetectRef.current(payload)
      } catch {
        /* ignore frame errors */
      }
    }

    const timer = window.setInterval(() => void tick(), SCAN_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      canvasRef.current = null
    }
  }, [enabled, videoRef])
}
