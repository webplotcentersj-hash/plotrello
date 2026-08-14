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

const AUTO_SCAN_MS = 2200
const COOLDOWN_OK_S = 8
/** Tras fallo duro: pausa corta (antes 5s forzaba “salir y volver”). */
const COOLDOWN_FAIL_S = 2
/** Si getUserMedia no responde, cortar (en tablets a veces queda colgado). */
const GUM_TIMEOUT_MS = 10_000

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms))
}

function mediaErrorName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) return String((err as { name: string }).name)
  return ''
}

/**
 * getUserMedia con timeout. Solo corta tracks “huérfanos” si ganó el timeout
 * (no en NotFound/NotAllowed: ahí el GUM ya falló y no hay stream).
 */
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

async function buildCameraAttempts(): Promise<MediaStreamConstraints[]> {
  const attempts: MediaStreamConstraints[] = []
  try {
    // En Android/Chrome a veces hace falta enumerateDevices (previo o post permiso) para ver deviceId.
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
    for (const cam of cams.slice(0, 4)) {
      attempts.push({
        video: {
          deviceId: { exact: cam.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })
      attempts.push({ video: { deviceId: { ideal: cam.deviceId } }, audio: false })
    }
  } catch {
    /* ignore enumerate errors */
  }
  attempts.push(
    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { ideal: 'user' } }, audio: false },
    { video: true, audio: false },
    { video: { facingMode: 'environment' }, audio: false }
  )
  return attempts
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
  const streamRef = useRef<MediaStream | null>(null)
  const capturingRef = useRef(false)
  const cancelledRef = useRef(false)
  const camGenRef = useRef(0)
  const startCameraRef = useRef<() => Promise<void>>(async () => {})
  const autoRetryRef = useRef(0)

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
    const gen = ++camGenRef.current
    cancelledRef.current = false
    const isStale = () => cancelledRef.current || gen !== camGenRef.current

    setCameraError('')
    setCameraOpening(true)
    setCamaraLista(false)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          !window.isSecureContext
            ? 'La cámara requiere HTTPS (o localhost).'
            : 'Este navegador no soporta cámara.'
        )
      }

      // Liberar stream previo y dar tiempo a Android/WebView a soltar el device.
      releaseStream()
      await sleep(400)
      if (isStale()) return

      // Esperar a que el <video> esté montado (siempre en el DOM).
      let video = videoRef.current
      for (let i = 0; i < 30 && !video; i++) {
        await sleep(50)
        video = videoRef.current
      }
      if (isStale()) return
      if (!video) throw new Error('No se encontró el elemento de video.')

      // Warm-up: un GUM mínimo desbloquea labels/deviceId en varios Android.
      try {
        const warm = await getUserMediaSafe({ video: true, audio: false }, isStale, 5_000)
        warm.getTracks().forEach((t) => t.stop())
        await sleep(280)
      } catch {
        /* sigue con los intentos normales */
      }
      if (isStale()) return

      const attempts = await buildCameraAttempts()
      let stream: MediaStream | null = null
      let lastErr: unknown = null
      for (let i = 0; i < attempts.length; i++) {
        if (isStale()) return
        try {
          stream = await getUserMediaSafe(attempts[i], isStale, i < 2 ? GUM_TIMEOUT_MS : 6_000)
          break
        } catch (e) {
          lastErr = e
          const name = mediaErrorName(e)
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'AbortError') {
            throw e
          }
          // NotFound/NotReadable en tablets suele ser carrera: soltá y reintentá.
          if (
            name === 'NotFoundError' ||
            name === 'DevicesNotFoundError' ||
            name === 'NotReadableError' ||
            name === 'TrackStartError'
          ) {
            await sleep(550 + i * 120)
          }
        }
      }

      if (!stream) {
        releaseStream()
        await sleep(700)
        if (isStale()) return
        try {
          stream = await getUserMediaSafe({ video: true, audio: false }, isStale, 8_000)
        } catch (e) {
          throw lastErr || e
        }
      }

      if (isStale()) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      video = videoRef.current
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
          if (video!.readyState >= 1 || video!.videoWidth > 0) {
            resolve()
            return
          }
          const done = () => {
            video!.removeEventListener('loadedmetadata', done)
            video!.removeEventListener('loadeddata', done)
            resolve()
          }
          video!.addEventListener('loadedmetadata', done)
          video!.addEventListener('loadeddata', done)
        }),
        sleep(2500)
      ])

      if (isStale()) return

      try {
        await video.play()
      } catch {
        /* WebView puede pedir gesto — el botón Activar cámara lo cubre */
      }

      if (isStale()) return

      // Sin frames reales = stream “fantasma” (común en WebView).
      if (video.videoWidth < 2) {
        await sleep(600)
        if (isStale()) return
        if (video.videoWidth < 2) {
          throw Object.assign(new Error('La cámara abrió pero no hay imagen.'), {
            name: 'NotReadableError'
          })
        }
      }

      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = () => {
          if (cancelledRef.current || gen !== camGenRef.current) return
          setCamaraLista(false)
          setCameraError('La cámara se desconectó. Tocá Activar cámara.')
        }
      }

      autoRetryRef.current = 0
      setCamaraLista(true)
      setCameraError('')
      setStatusMessage(null)
    } catch (e) {
      if (isStale()) return
      releaseStream()
      setCamaraLista(false)
      const name = mediaErrorName(e)
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. Activá la cámara en el candado del navegador.')
      } else if (name === 'TimeoutError') {
        setCameraError('La cámara tardó demasiado. Tocá Activar cámara otra vez.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('La cámara está ocupada o sin imagen. Cerrá otras apps y reintentá.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError(
          'No se detectó cámara (a veces es un fallo temporal). Tocá Activar cámara o revisá permisos.'
        )
      } else if (name === 'AbortError') {
        /* cancelación interna */
      } else {
        setCameraError(e instanceof Error ? e.message : 'No se pudo abrir la cámara')
      }

      // Un auto-reintento suave tras NotFound/NotReadable (tablets flaky).
      if (
        (name === 'NotFoundError' ||
          name === 'DevicesNotFoundError' ||
          name === 'NotReadableError' ||
          name === 'TimeoutError') &&
        autoRetryRef.current < 2
      ) {
        autoRetryRef.current += 1
        window.setTimeout(() => {
          if (cancelledRef.current || gen !== camGenRef.current) return
          void startCameraRef.current()
        }, 1200 * autoRetryRef.current)
      }
    } finally {
      if (gen === camGenRef.current && !cancelledRef.current) setCameraOpening(false)
    }
  }, [releaseStream])

  startCameraRef.current = startCamera

  // 1) Cámara primero (sin face-api). 2) Después modelos + índice.
  useEffect(() => {
    cancelledRef.current = false
    autoRetryRef.current = 0
    void startCamera()

    return () => {
      cancelledRef.current = true
      camGenRef.current += 1
      cancelMarcacionSpeech()
      releaseStream()
      setCamaraLista(false)
      setCameraOpening(false)
    }
  }, [startCamera, releaseStream])

  // Si la pestaña vuelve a primer plano y la cámara murió, reabrir.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (cancelledRef.current) return
      const live = streamRef.current?.getVideoTracks().some((t) => t.readyState === 'live')
      if (live && camaraLista) return
      void startCameraRef.current()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [camaraLista])

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

  const handleRecognize = useCallback(async () => {
    if (capturingRef.current || cooldown > 0) return
    if (!camaraLista || !galleryReady) return

    capturingRef.current = true
    setIsCapturing(true)
    setResult(null)
    setStatusMessage('Buscando rostro…')

    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        throw new Error('La cámara todavía no está lista. Esperá un segundo.')
      }

      const face = await import('../services/faceLocalMatch')
      const { hit, motivo } = await face.matchFromVideoFrames(video, {
        attempts: 4,
        gapMs: 260,
        onAttempt: (n, total) => {
          setStatusMessage(n === 1 ? 'Comparando rostros…' : `Reintentando (${n}/${total})…`)
        }
      })
      if (!hit) {
        setResult({ recognized: false, message: motivo || 'No se reconoció el rostro.' })
        if (soundEnabled) playMarcacionSound('error')
        setCooldown(COOLDOWN_FAIL_S)
        return
      }

      const emp = empleados.find((e) => e.id_usuario === hit.id_usuario) ?? null
      setStatusMessage(`Hola ${hit.nombre}…`)
      const data = await marcarRelojTablet({
        idUsuario: hit.id_usuario,
        confianza: hit.confianza,
        detalle: `Facial local face-api · dist ${hit.distancia.toFixed(3)} · ${hit.confianza}%`,
        omitirFoto: true
      })
      const foto = (emp ? fotoEmpleadoUrl(emp) : null) || hit.foto_url || null
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
  }, [camaraLista, cooldown, empleados, galleryReady, onMarked, soundEnabled])

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

  const marcarLabel = (() => {
    if (cameraError || (!camaraLista && !cameraOpening)) return 'Sin cámara'
    if (cameraOpening && !camaraLista) return 'Abriendo cámara…'
    if (cooldown > 0) return `Esperá ${cooldown}s`
    if (!galleryReady) return 'Preparando…'
    if (isCapturing) return 'Marcando…'
    return 'Marcar ahora'
  })()

  return (
    <div className="facial-clock">
      <div className="facial-clock-top">
        <div className="facial-clock-top__row">
          <button
            type="button"
            className={`facial-clock-btn facial-clock-btn--cam${camaraLista && !cameraError ? ' facial-clock-btn--cam-ok' : ''}`}
            disabled={cameraOpening}
            onClick={() => {
              autoRetryRef.current = 0
              void startCamera()
            }}
          >
            {cameraOpening ? (
              <Loader2 size={16} className="facial-clock-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {cameraOpening ? 'Abriendo…' : camaraLista && !cameraError ? 'Reintentar cámara' : 'Activar cámara'}
          </button>
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

        <button
          type="button"
          className="facial-clock-btn facial-clock-btn--marcar"
          disabled={!canScan || !!cameraError}
          onClick={() => void handleRecognize()}
        >
          <Camera size={20} />
          {marcarLabel}
        </button>

        {cameraError ? (
          <p className="facial-clock-top__err" role="alert">
            {cameraError}
          </p>
        ) : null}
      </div>

      <div className="facial-clock-stage">
        <div
          className={`facial-clock-viewport${camaraLista && !cameraError ? ' facial-clock-viewport--live' : ''}${cameraError ? ' facial-clock-viewport--err' : ''}`}
        >
          <video ref={videoRef} autoPlay playsInline muted className="facial-clock-video" />
          <div className="facial-clock-frame" aria-hidden>
            <div className="facial-clock-oval" />
            <span className="facial-clock-guide">
              {cameraError
                ? 'Cámara no disponible'
                : statusMessage
                  ? statusMessage
                  : cameraOpening && !camaraLista
                    ? 'Abriendo cámara…'
                    : !galleryReady
                      ? 'Cámara lista · cargando reconocimiento…'
                      : cooldown > 0
                        ? `Listo en ${cooldown}s`
                        : 'Alineá tu rostro'}
            </span>
          </div>
          <div className="facial-clock-badges">
            {camaraLista && !galleryReady && !cameraError ? (
              <span className="facial-clock-badge facial-clock-badge--scan">{engineStatus}</span>
            ) : null}
            {engineError && camaraLista && !cameraError ? (
              <span className="facial-clock-badge facial-clock-badge--pause">{engineError}</span>
            ) : null}
            {galleryReady && cooldown > 0 && !cameraError ? (
              <span className="facial-clock-badge facial-clock-badge--pause">Pausa {cooldown}s</span>
            ) : null}
          </div>
          {!camaraLista && cameraOpening && !cameraError ? (
            <div className="facial-clock-busy">
              <Loader2 size={40} className="facial-clock-spin" />
              <p>Abriendo cámara…</p>
            </div>
          ) : null}
          {cameraError ? (
            <div className="facial-clock-empty facial-clock-empty--err facial-clock-empty--overlay">
              <AlertCircle size={32} />
              <h3>Cámara no disponible</h3>
              <p>Usá el botón de arriba para reintentar.</p>
            </div>
          ) : null}
        </div>
      </div>

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
