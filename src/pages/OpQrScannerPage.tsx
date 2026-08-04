import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import jsQR from 'jsqr'
import apiService from '../services/api'
import type { OrdenSeguimientoPublico } from '../types/api'
import { parseOpRefFromQrPayload } from '../utils/parseOpFromQr'
import { BOARD_COLUMNS } from '../data/mockData'
import './OpQrScannerPage.css'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

/** Intervalo entre lecturas (evitar saturar CPU en móviles). */
const SCAN_MS = 450
const GUM_TIMEOUT_MS = 8_000
/** Ancho máx. del frame para detectar QR (baja carga). */
const SCAN_MAX_WIDTH = 480

const ESTADO_AMIGABLE: Record<string, string> = {
  Pendiente: 'Recibimos tu pedido',
  'Asesor Técnico': 'Revisando tu pedido',
  Presupuestos: 'Preparando tu presupuesto',
  'Finalizado Asesor Presupuestos': 'Tu presupuesto está listo',
  'Diseño Gráfico': 'Diseñando tu trabajo',
  'Diseño en Proceso': 'Diseñando tu trabajo',
  'En Espera': 'En cola de producción',
  'Imprenta (Área de Impresión)': 'Imprimiendo tu trabajo',
  'Taller de Imprenta': 'En taller de impresión',
  'Taller Gráfico': 'En taller gráfico',
  Instalaciones: 'Instalando tu trabajo',
  Metalúrgica: 'Fabricando estructuras',
  'Finalizado en Taller': 'Entregas taller de Imprenta',
  'Entregas taller de Imprenta': 'Entregas taller de Imprenta',
  'Almacén de Entrega': 'Entregas taller gráfico',
  'Entregas taller gráfico': 'Entregas taller gráfico',
  'Entregas taller grafico': 'Entregas taller gráfico',
  Mostrador: 'Mostrador',
  Caja: 'Caja',
  'Entregado o Instalado': 'Entregado'
}

const CAMERA_ATTEMPTS: MediaStreamConstraints[] = [
  { audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
  { audio: false, video: { facingMode: { ideal: 'user' } } },
  { audio: false, video: true }
]

async function getUserMediaSafe(
  constraints: MediaStreamConstraints,
  isCancelled: () => boolean,
  timeoutMs = GUM_TIMEOUT_MS
): Promise<MediaStream> {
  let timer = 0
  let timedOut = false
  const gum = navigator.mediaDevices.getUserMedia(constraints)
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      timedOut = true
      reject(Object.assign(new Error('TIMEOUT_CAMERA'), { name: 'TimeoutError' }))
    }, timeoutMs)
  })
  try {
    const stream = await Promise.race([gum, timeout])
    if (isCancelled()) {
      stream.getTracks().forEach((t) => t.stop())
      throw Object.assign(new Error('CANCELLED'), { name: 'AbortError' })
    }
    return stream
  } catch (e) {
    if (timedOut) {
      void gum
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => {})
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

async function detectQr(canvas: HTMLCanvasElement): Promise<string | null> {
  if (canvas.width < 64 || canvas.height < 64) return null
  if (typeof window !== 'undefined' && window.BarcodeDetector) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const codes = await detector.detect(canvas)
      const value = codes[0]?.rawValue?.trim()
      if (value) return value
    } catch {
      /* jsQR */
    }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert'
  })
  return code?.data?.trim() || null
}

function colorForEstado(estado: string): string {
  const col = BOARD_COLUMNS.find((c) => c.label.toLowerCase() === estado.trim().toLowerCase())
  if (col) return col.accent
  const fallback: Record<string, string> = {
    'Finalizado en Taller': '#F472B6',
    'Almacén de Entrega': '#231F20',
    Pendiente: '#64748b',
    Mostrador: '#10b981',
    Caja: '#eab308',
    'Entregado o Instalado': '#16a34a'
  }
  return fallback[estado] || '#e11d48'
}

export default function OpQrScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const scanBusyRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orden, setOrden] = useState<OrdenSeguimientoPublico | null>(null)
  const [manualOp, setManualOp] = useState('')
  const lastPayloadRef = useRef('')
  const lastAtRef = useRef(0)
  const lookupLockRef = useRef(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop()
      } catch {
        /* ignore */
      }
    })
    streamRef.current = null
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {
        /* ignore */
      }
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    if (!mountedRef.current) return
    setCameraError(null)
    stopCamera()
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este dispositivo no permite usar la cámara desde el navegador.')
      return
    }

    const isCancelled = () => !mountedRef.current
    let stream: MediaStream | null = null
    let lastErr: unknown = null

    for (let i = 0; i < CAMERA_ATTEMPTS.length; i++) {
      if (isCancelled()) return
      try {
        stream = await getUserMediaSafe(CAMERA_ATTEMPTS[i], isCancelled, i === 0 ? GUM_TIMEOUT_MS : 6_000)
        break
      } catch (err) {
        lastErr = err
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') break
      }
    }

    if (!stream) {
      console.error(lastErr)
      if (mountedRef.current) {
        setCameraError('No se pudo abrir la cámara frontal. Revisá los permisos del navegador.')
      }
      return
    }

    if (isCancelled()) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (video) {
      video.setAttribute('playsinline', 'true')
      video.muted = true
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        /* autoplay policies */
      }
    }
    if (mountedRef.current) {
      setCameraReady(true)
      setScanning(true)
    }
  }, [stopCamera])

  useEffect(() => {
    mountedRef.current = true
    void startCamera()
    return () => {
      mountedRef.current = false
      stopCamera()
    }
  }, [startCamera, stopCamera])

  const lookupOp = useCallback(async (ref: string) => {
    const cleaned = ref.trim()
    if (!cleaned || lookupLockRef.current) return
    lookupLockRef.current = true
    setLoading(true)
    setError(null)
    setScanning(false)
    try {
      if (navigator.vibrate) navigator.vibrate(40)
      const response = await apiService.getOrdenSeguimientoPublico(cleaned)
      if (!mountedRef.current) return
      if (response.success && response.data) {
        // Liberar cámara mientras se muestra el resultado (evita tilde en móvil)
        stopCamera()
        setOrden(response.data)
      } else {
        setOrden(null)
        setError(response.error || 'No se encontró esa OP')
        setScanning(true)
      }
    } catch (err) {
      console.error(err)
      if (mountedRef.current) {
        setOrden(null)
        setError('Error al consultar la orden')
        setScanning(true)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
      lookupLockRef.current = false
    }
  }, [stopCamera])

  useEffect(() => {
    if (!scanning || !cameraReady || orden) return

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    const canvas = canvasRef.current

    const timer = window.setInterval(() => {
      if (scanBusyRef.current || lookupLockRef.current) return
      scanBusyRef.current = true
      void (async () => {
        try {
          const video = videoRef.current
          if (!video || video.readyState < 2 || video.videoWidth < 64) return

          const vw = video.videoWidth
          const vh = video.videoHeight
          const scale = Math.min(1, SCAN_MAX_WIDTH / vw)
          const w = Math.max(64, Math.round(vw * scale))
          const h = Math.max(64, Math.round(vh * scale))
          if (canvas.width !== w) canvas.width = w
          if (canvas.height !== h) canvas.height = h

          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return
          ctx.drawImage(video, 0, 0, w, h)

          const payload = await detectQr(canvas)
          if (!payload || !mountedRef.current) return

          const now = Date.now()
          if (payload === lastPayloadRef.current && now - lastAtRef.current < 3500) return
          lastPayloadRef.current = payload
          lastAtRef.current = now

          const opRef = parseOpRefFromQrPayload(payload)
          if (!opRef) {
            setError('QR leído, pero no parece una OP de PlotLab')
            return
          }
          await lookupOp(opRef)
        } catch {
          /* frame */
        } finally {
          scanBusyRef.current = false
        }
      })()
    }, SCAN_MS)

    return () => {
      window.clearInterval(timer)
      scanBusyRef.current = false
    }
  }, [scanning, cameraReady, orden, lookupOp])

  const resetScan = () => {
    setOrden(null)
    setError(null)
    setManualOp('')
    lastPayloadRef.current = ''
    setScanning(true)
    void startCamera()
  }

  const handleManual = (e: FormEvent) => {
    e.preventDefault()
    const ref = parseOpRefFromQrPayload(manualOp) || manualOp.trim()
    if (!ref) {
      setError('Ingresá un número de OP')
      return
    }
    void lookupOp(ref)
  }

  const estadoColor = useMemo(() => (orden ? colorForEstado(orden.estado) : '#e11d48'), [orden])
  const estadoDonde = useMemo(() => {
    if (!orden) return ''
    return ESTADO_AMIGABLE[orden.estado] || orden.estado
  }, [orden])

  return (
    <div className="op-scan-page">
      <header className="op-scan-top">
        <p className="op-scan-brand">PlotLab</p>
        <h1>Escanear OP</h1>
        <p className="op-scan-lead">Usá la cámara delantera: mostrá el QR del ticket frente al celular.</p>
      </header>

      {!orden ? (
        <>
          <div className="op-scan-camera-wrap">
            <video ref={videoRef} className="op-scan-video op-scan-video--front" playsInline muted autoPlay />
            <div className="op-scan-frame" aria-hidden />
            {loading ? <div className="op-scan-overlay">Buscando OP…</div> : null}
            {cameraError ? <div className="op-scan-overlay op-scan-overlay--err">{cameraError}</div> : null}
            {!cameraReady && !cameraError ? <div className="op-scan-overlay">Abriendo cámara…</div> : null}
          </div>

          {error ? <p className="op-scan-error">{error}</p> : null}

          <div className="op-scan-actions">
            {cameraError ? (
              <button type="button" className="op-scan-btn" onClick={() => void startCamera()}>
                Reintentar cámara
              </button>
            ) : null}
          </div>

          <form className="op-scan-manual" onSubmit={handleManual}>
            <label htmlFor="op-manual">O escribí el número de OP</label>
            <div className="op-scan-manual-row">
              <input
                id="op-manual"
                value={manualOp}
                onChange={(e) => setManualOp(e.target.value)}
                placeholder="Ej. 104132"
                inputMode="numeric"
                autoComplete="off"
              />
              <button type="submit" className="op-scan-btn op-scan-btn--secondary" disabled={loading}>
                Buscar
              </button>
            </div>
          </form>
        </>
      ) : (
        <section className="op-scan-result" style={{ ['--estado-color' as string]: estadoColor }}>
          <p className="op-scan-result-kicker">Ubicación actual</p>
          <h2 className="op-scan-donde">{estadoDonde}</h2>
          <p className="op-scan-estado-raw">{orden.estado}</p>
          <div className="op-scan-meta">
            <div>
              <span>OP</span>
              <strong>{orden.numero_op}</strong>
            </div>
            <div>
              <span>Cliente</span>
              <strong>{orden.cliente}</strong>
            </div>
          </div>
          {orden.fecha_entrega ? (
            <p className="op-scan-fecha">
              Entrega:{' '}
              {new Date(orden.fecha_entrega).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </p>
          ) : null}
          <div className="op-scan-result-actions">
            <button type="button" className="op-scan-btn" onClick={resetScan}>
              Escanear otra
            </button>
            <Link className="op-scan-btn op-scan-btn--ghost" to={`/op-public/${encodeURIComponent(orden.numero_op)}`}>
              Ver detalle
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
