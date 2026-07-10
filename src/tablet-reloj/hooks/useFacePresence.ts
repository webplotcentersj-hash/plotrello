import { useEffect, useRef, useState, type RefObject } from 'react'

const MOTION_THRESHOLD = 0.055
const MOTION_CHECKS = 2
const FACE_CHECKS = 2
const MIN_FRAME_MS = 100
const DETECT_COOLDOWN_MS = 1200
const MIN_FACE_AREA_RATIO = 0.03

type FaceDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>
}

function getFaceDetector(): FaceDetectorLike | null {
  const w = window as Window & { FaceDetector?: new (opts?: { maxDetectedFaces?: number }) => FaceDetectorLike }
  if (!w.FaceDetector) return null
  try {
    return new w.FaceDetector({ maxDetectedFaces: 2 })
  } catch {
    return null
  }
}

function rostroValidoEnVideo(
  video: HTMLVideoElement,
  faces: Array<{ boundingBox: DOMRectReadOnly }>
): boolean {
  if (faces.length !== 1) return false
  const box = faces[0].boundingBox
  const vw = video.videoWidth || 1
  const vh = video.videoHeight || 1
  const area = box.width * box.height
  const ratio = area / (vw * vh)
  if (ratio < MIN_FACE_AREA_RATIO) return false
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  return cx > vw * 0.15 && cx < vw * 0.85 && cy > vh * 0.12 && cy < vh * 0.88
}

/**
 * Dispara solo si hay un rostro claro en cámara (FaceDetector) o, si no hay API,
 * movimiento fuerte sostenido como fallback conservador.
 */
export function useFacePresence(
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

    const faceDetector = getFaceDetector()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx && !faceDetector) return

    const w = 48
    const h = 36
    canvas.width = w
    canvas.height = h

    let lastFrame: number[] | null = null
    let hitCount = 0
    let rafId = 0
    let cancelled = false
    let lastTick = 0
    let checkingFace = false

    const check = async (now: number) => {
      if (cancelled) return
      if (now - lastTick < MIN_FRAME_MS) {
        rafId = requestAnimationFrame(check)
        return
      }
      lastTick = now

      if (video.readyState < 2 || video.videoWidth < 64) {
        rafId = requestAnimationFrame(check)
        return
      }

      let present = false

      if (faceDetector && !checkingFace) {
        checkingFace = true
        try {
          const faces = await faceDetector.detect(video)
          present = rostroValidoEnVideo(video, faces)
          setActivo(present)
        } catch {
          present = false
        } finally {
          checkingFace = false
        }
      } else if (ctx) {
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
          present = change > MOTION_THRESHOLD
          setActivo(present)
        }
        lastFrame = gray
      }

      const needed = faceDetector ? FACE_CHECKS : MOTION_CHECKS
      if (present) {
        hitCount++
        if (hitCount >= needed) {
          hitCount = 0
          const t = Date.now()
          if (t - lastDetectRef.current >= DETECT_COOLDOWN_MS) {
            lastDetectRef.current = t
            onDetectedRef.current()
          }
        }
      } else {
        hitCount = 0
      }

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
