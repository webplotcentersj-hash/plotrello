import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Volume2,
  VolumeX
} from 'lucide-react'
import {
  fotoEmpleadoUrl,
  fetchFacialIndiceRelojTablet,
  marcarRelojTablet,
  type EmpleadoRelojTablet,
  type MarcacionTabletResult
} from '../services/relojTabletApi'
import { horaMarcacionTabletDisplay } from '../../utils/dateUtils'
import { playMarcacionSound, speakMarcacionExito, cancelMarcacionSpeech } from '../utils/tabletRelojKiosk'
import './FacialClockTerminal.css'

const SELFIE_MAX_W = 640
const SELFIE_JPEG_Q = 0.85
const AUTO_SCAN_MS = 2800
const COOLDOWN_OK_S = 8
const COOLDOWN_FAIL_S = 5
/** Si getUserMedia no responde, cortar (en tablets a veces queda colgado). */
const GUM_TIMEOUT_MS = 8_000

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms))
}

function mediaErrorName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) return String((err as { name: string }).name)
  return ''
}

/**
 * getUserMedia con timeout. Si se cancela o vence el tiempo, corta tracks
 * para no dejar la cámara “tomada” (causa clásica de esperas de minutos).
 */
async function getUserMediaSafe(
  constraints: MediaStreamConstraints,
  isCancelled: () => boolean,
  timeoutMs = GUM_TIMEOUT_MS
): Promise<MediaStream> {
  let timer = 0
  const gum = navigator.mediaDevices.getUserMedia(constraints)
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(Object.assign(new Error('TIMEOUT_CAMERA'), { name: 'TimeoutError' })), timeoutMs)
  })
  try {
    const stream = await Promise.race([gum, timeout])
    if (isCancelled()) {
      stream.getTracks().forEach((t) => t.stop())
      throw Object.assign(new Error('CANCELLED'), { name: 'AbortError' })
    }
    return stream
  } catch (e) {
    // Si el timeout ganó, el GUM real puede resolverse después: soltar tracks.
    void gum
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch(() => {})
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

type FacialResult = {
  recognized: boolean
  message: string
  confianza?: number
  empleado?: EmpleadoRelojTablet | null
  data?: MarcacionTabletResult
  foto?: string | null
}

type FacialClockTerminalProps = {
  empleados: EmpleadoRelojTablet[]
  onMarked?: () => void
}

export default function FacialClockTerminal({ empleados, onMarked }: FacialClockTerminalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const capturingRef = useRef(false)
  const cancelledRef = useRef(false)
  const startingCamRef = useRef(false)

  const [camaraLista, setCamaraLista] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraOpening, setCameraOpening] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [result, setResult] = useState<FacialResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [cooldown, setCooldown] = useState(0)
  const [clock, setClock] = useState(() => new Date())
  const [engineStatus, setEngineStatus] = useState('Esperando cámara…')
  const [galleryReady, setGalleryReady] = useState(false)
  const [engineError, setEngineError] = useState('')
  const [galleryCount, setGalleryCount] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop()
      } catch {
        /* ignore */
      }
    })
    streamRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
  }, [])

  const startCamera = useCallback(async () => {
    if (startingCamRef.current) return
    startingCamRef.current = true
    cancelledRef.current = false
    setCameraError('')
    setCameraOpening(true)
    setCamaraLista(false)

    const isCancelled = () => cancelledRef.current

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          !window.isSecureContext
            ? 'La cámara requiere HTTPS (o localhost).'
            : 'Este navegador no soporta cámara.'
        )
      }

      // Esperar 1 frame para que el <video> esté en el DOM.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      if (isCancelled()) return

      releaseStream()

      let stream: MediaStream
      try {
        stream = await getUserMediaSafe({ video: true, audio: false }, isCancelled)
      } catch (first) {
        if (isCancelled()) return
        // Un solo fallback rápido (sin enumerateDevices: en tablets suele colgarse).
        try {
          stream = await getUserMediaSafe({ video: { facingMode: 'user' }, audio: false }, isCancelled, 6_000)
        } catch {
          throw first
        }
      }

      if (isCancelled()) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        throw new Error('No se encontró el elemento de video.')
      }

      video.setAttribute('playsinline', 'true')
      video.setAttribute('webkit-playsinline', 'true')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream

      await Promise.race([
        new Promise<void>((resolve) => {
          if (video.readyState >= 1 || video.videoWidth > 0) {
            resolve()
            return
          }
          const done = () => {
            video.removeEventListener('loadedmetadata', done)
            video.removeEventListener('loadeddata', done)
            resolve()
          }
          video.addEventListener('loadedmetadata', done)
          video.addEventListener('loadeddata', done)
        }),
        sleep(1500)
      ])

      if (isCancelled()) return

      try {
        await video.play()
      } catch {
        /* WebView puede pedir gesto */
      }

      if (isCancelled()) return

      // Si aún no hay frame, igual marcar lista: el preview suele llegar un instante después.
      setCamaraLista(true)
      setCameraError('')
      setStatusMessage(null)
    } catch (e) {
      if (isCancelled()) return
      releaseStream()
      setCamaraLista(false)
      const name = mediaErrorName(e)
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. Activá la cámara en el candado del navegador.')
      } else if (name === 'TimeoutError') {
        setCameraError('La cámara tardó demasiado en responder. Tocá Activar cámara.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('La cámara está ocupada. Cerrá otras apps y tocá Activar cámara.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No se encontró ninguna cámara en este dispositivo.')
      } else {
        setCameraError(e instanceof Error ? e.message : 'No se pudo abrir la cámara')
      }
    } finally {
      startingCamRef.current = false
      if (!cancelledRef.current) setCameraOpening(false)
    }
  }, [releaseStream])

  // 1) Cámara primero (sin face-api). 2) Después modelos + índice.
  useEffect(() => {
    cancelledRef.current = false
    void startCamera()

    return () => {
      cancelledRef.current = true
      cancelMarcacionSpeech()
      releaseStream()
      setCamaraLista(false)
      setCameraOpening(false)
    }
  }, [startCamera, releaseStream])

  // Recién cuando la cámara está viva cargamos face-api (si va junto, en tablets se traba minutos).
  useEffect(() => {
    if (!camaraLista) return
    let cancelled = false
    setEngineError('')
    setEngineStatus('Cargando reconocimiento…')

    void (async () => {
      try {
        const face = await import('../services/faceLocalMatch')
        if (cancelled) return
        const [, indice] = await Promise.all([
          face.ensureFaceModels(),
          fetchFacialIndiceRelojTablet()
        ])
        if (cancelled) return
        const stats = face.hydrateFaceGalleryFromRecords(indice.descriptores)
        if (stats.indexed === 0) {
          setGalleryReady(false)
          setGalleryCount(0)
          setEngineError(
            'Índice facial vacío. En Recursos humanos → Reloj facial tocá “Indexar rostros”.'
          )
          setEngineStatus('Sin índice facial')
          return
        }
        setGalleryCount(stats.indexed)
        setGalleryReady(true)
        const when = indice.meta?.built_at
          ? new Date(indice.meta.built_at).toLocaleString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : null
        setEngineStatus(
          when ? `Listo · ${stats.indexed} rostros (${when})` : `Listo · ${stats.indexed} rostros`
        )
      } catch (e) {
        if (cancelled) return
        setGalleryReady(false)
        setGalleryCount(0)
        setEngineError(e instanceof Error ? e.message : 'No se pudo cargar el reconocimiento')
        setEngineStatus('Error de reconocimiento')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [camaraLista])

  const captureSelfie = useCallback((): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    const srcW = video.videoWidth
    const srcH = video.videoHeight
    if (srcW < 32 || srcH < 32) return null
    const scale = Math.min(1, SELFIE_MAX_W / srcW)
    canvas.width = Math.round(srcW * scale)
    canvas.height = Math.round(srcH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', SELFIE_JPEG_Q)
  }, [])

  const handleRecognize = useCallback(async () => {
    if (capturingRef.current || cooldown > 0) return
    if (!camaraLista || !galleryReady) return

    capturingRef.current = true
    setIsCapturing(true)
    setResult(null)
    setStatusMessage('Capturando…')

    try {
      const selfie = captureSelfie()
      if (!selfie) {
        throw new Error('No se pudo capturar la imagen. Acercate de frente a la cámara.')
      }

      setStatusMessage('Comparando rostros…')
      const face = await import('../services/faceLocalMatch')
      const { hit, motivo } = await face.matchSelfieDataUrl(selfie)
      if (!hit) {
        setResult({ recognized: false, message: motivo || 'No se reconoció el rostro.' })
        if (soundEnabled) playMarcacionSound('error')
        setCooldown(COOLDOWN_FAIL_S)
        return
      }

      const emp = empleados.find((e) => e.id_usuario === hit.id_usuario) ?? null
      setStatusMessage(`Hola ${hit.nombre}…`)
      const data = await marcarRelojTablet({
        id_usuario: hit.id_usuario,
        verificacion_confianza: hit.confianza,
        detalle: `Facial local face-api · dist ${hit.distancia.toFixed(3)} · ${hit.confianza}%`
      })
      const foto = fotoEmpleadoUrl(emp) || hit.foto_url || null
      setResult({
        recognized: true,
        message: data.mensaje || '',
        confianza: hit.confianza,
        empleado: emp,
        data,
        foto
      })
      if (soundEnabled) {
        playMarcacionSound('ok')
        speakMarcacionExito(data.nombre || hit.nombre, data.tipo)
      }
      setCooldown(COOLDOWN_OK_S)
      onMarked?.()
    } catch (e) {
      setResult({
        recognized: false,
        message: e instanceof Error ? e.message : 'Error al marcar'
      })
      if (soundEnabled) playMarcacionSound('error')
      setCooldown(COOLDOWN_FAIL_S)
    } finally {
      setStatusMessage(null)
      setIsCapturing(false)
      capturingRef.current = false
    }
  }, [camaraLista, captureSelfie, cooldown, empleados, galleryReady, onMarked, soundEnabled])

  useEffect(() => {
    if (isCapturing || cooldown > 0 || !camaraLista || !galleryReady || galleryCount === 0) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const video = videoRef.current
        if (!video || cancelled) return
        try {
          const face = await import('../services/faceLocalMatch')
          const has = await face.hasFaceInVideo(video)
          if (cancelled || !has) return
          void handleRecognize()
        } catch {
          /* ignore auto-scan errors */
        }
      })()
    }, AUTO_SCAN_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isCapturing, cooldown, camaraLista, galleryReady, galleryCount, handleRecognize])

  const horaStr = clock.toLocaleTimeString('es-AR', {
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  })

  const canScan = camaraLista && galleryReady && !isCapturing && cooldown === 0 && galleryCount > 0

  return (
    <div className="facial-clock">
      <div className="facial-clock-chrome" aria-hidden={false}>
        <div className="facial-clock-time">
          <Clock size={12} />
          <span>{horaStr}</span>
        </div>
        <button
          type="button"
          className="facial-clock-icon-btn"
          onClick={() => setSoundEnabled((v) => !v)}
          title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      <div className="facial-clock-stage">
        <canvas ref={canvasRef} className="facial-clock-canvas" aria-hidden />

        {cameraError ? (
          <div className="facial-clock-empty facial-clock-empty--err">
            <AlertCircle size={36} />
            <p>{cameraError}</p>
            <button
              type="button"
              className="facial-clock-btn"
              onClick={() => {
                cancelledRef.current = false
                void startCamera()
              }}
            >
              <RefreshCw size={14} /> Activar cámara
            </button>
          </div>
        ) : (
          <div className={`facial-clock-viewport${camaraLista ? ' facial-clock-viewport--live' : ''}`}>
            <video ref={videoRef} autoPlay playsInline muted className="facial-clock-video" />
            <div className="facial-clock-frame" aria-hidden>
              <div className="facial-clock-oval" />
              <span className="facial-clock-guide">
                {cameraOpening && !camaraLista
                  ? 'Abriendo cámara…'
                  : !galleryReady
                    ? 'Cámara lista · cargando reconocimiento…'
                    : cooldown > 0
                      ? `Listo en ${cooldown}s`
                      : 'Alineá tu rostro'}
              </span>
            </div>
            <div className="facial-clock-badges">
              {camaraLista && !galleryReady ? (
                <span className="facial-clock-badge facial-clock-badge--scan">{engineStatus}</span>
              ) : null}
              {engineError && camaraLista ? (
                <span className="facial-clock-badge facial-clock-badge--pause">{engineError}</span>
              ) : null}
              {galleryReady && cooldown > 0 ? (
                <span className="facial-clock-badge facial-clock-badge--pause">Pausa {cooldown}s</span>
              ) : null}
            </div>
            {!camaraLista && cameraOpening ? (
              <div className="facial-clock-busy">
                <Loader2 size={40} className="facial-clock-spin" />
                <p>Abriendo cámara…</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!cameraError ? (
        <div className="facial-clock-footer">
          <button
            type="button"
            className="facial-clock-btn facial-clock-btn--marcar"
            disabled={!canScan}
            onClick={() => void handleRecognize()}
          >
            <Camera size={20} />
            {cooldown > 0
              ? `Esperá ${cooldown}s`
              : !galleryReady
                ? 'Preparando…'
                : 'Marcar ahora'}
          </button>
        </div>
      ) : null}

      {result ? (
        <div
          className={`facial-clock-result${result.recognized ? ' facial-clock-result--ok' : ' facial-clock-result--err'}`}
        >
          {result.recognized && result.data ? (
            <>
              <div className="facial-clock-result-photo">
                {result.foto ? (
                  <img src={result.foto} alt="" />
                ) : (
                  <div className="facial-clock-result-fallback">✓</div>
                )}
                <span className="facial-clock-result-check">
                  <ShieldCheck size={12} />
                </span>
              </div>
              <div className="facial-clock-result-text">
                <span className="facial-clock-pill">
                  {result.data.tipo === 'entrada' ? 'Entrada OK' : 'Salida OK'}
                  {result.confianza != null ? ` · ${Math.round(result.confianza)}%` : ''}
                </span>
                <h3>{result.data.nombre || result.empleado?.nombre_completo}</h3>
                <p>{horaMarcacionTabletDisplay(result.data)} · Argentina</p>
                {result.data.tipo === 'entrada' && result.data.tarde ? (
                  <p className="facial-clock-late">Tardanza: {result.data.minutos_tarde} min</p>
                ) : null}
                {result.message ? <p className="facial-clock-msg">{result.message}</p> : null}
              </div>
            </>
          ) : (
            <>
              <div className="facial-clock-result-icon">
                <AlertCircle size={22} />
              </div>
              <div className="facial-clock-result-text">
                <span className="facial-clock-pill facial-clock-pill--err">No reconocido</span>
                <h3>Acceso no registrado</h3>
                <p className="facial-clock-msg">{result.message}</p>
              </div>
            </>
          )}
        </div>
      ) : null}

    </div>
  )
}
