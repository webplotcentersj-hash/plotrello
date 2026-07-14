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
  marcarAutoRelojTablet,
  type EmpleadoRelojTablet,
  type MarcacionTabletResult
} from '../services/relojTabletApi'
import { horaMarcacionTabletDisplay } from '../../utils/dateUtils'
import { playMarcacionSound, speakMarcacionExito, cancelMarcacionSpeech } from '../utils/tabletRelojKiosk'
import './FacialClockTerminal.css'

const SELFIE_MAX_W = 480
const SELFIE_JPEG_Q = 0.62
const AUTO_SCAN_MS = 4000
const COOLDOWN_OK_S = 8
const COOLDOWN_FAIL_S = 6

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

  const [camaraLista, setCamaraLista] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [result, setResult] = useState<FacialResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isAutoMode, setIsAutoMode] = useState(true)
  const [cooldown, setCooldown] = useState(0)
  const [clock, setClock] = useState(() => new Date())

  const conFoto = empleados.filter((e) => e.tiene_foto_legajo || Boolean(e.foto_url?.trim()))
  const employeesCount = conFoto.length

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamaraLista(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          !window.isSecureContext
            ? 'La cámara requiere HTTPS (o localhost).'
            : 'Este navegador no soporta cámara.'
        )
        return
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        await new Promise((r) => window.setTimeout(r, 280))
      }

      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: true, audio: false },
        { video: { facingMode: 'environment' }, audio: false }
      ]

      let mediaStream: MediaStream | null = null
      let lastErr: unknown = null
      for (const constraints of attempts) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!mediaStream) {
        const name =
          lastErr && typeof lastErr === 'object' && 'name' in lastErr
            ? String((lastErr as { name: string }).name)
            : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error('Permiso de cámara denegado. Activá la cámara en el candado del navegador.')
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          throw new Error('No se encontró ninguna cámara en este dispositivo.')
        }
        if (name === 'NotReadableError' || name === 'TrackStartError') {
          throw new Error('La cámara está ocupada por otra app. Cerrala e intentá de nuevo.')
        }
        throw lastErr instanceof Error ? lastErr : new Error('No se pudo abrir la cámara')
      }

      streamRef.current = mediaStream
      const video = videoRef.current
      if (!video) {
        mediaStream.getTracks().forEach((t) => t.stop())
        throw new Error('No se encontró el elemento de video.')
      }

      video.setAttribute('playsinline', 'true')
      video.setAttribute('webkit-playsinline', 'true')
      video.muted = true
      video.srcObject = mediaStream

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve()
          return
        }
        const onReady = () => {
          video.removeEventListener('loadeddata', onReady)
          video.removeEventListener('loadedmetadata', onReady)
          resolve()
        }
        video.addEventListener('loadeddata', onReady)
        video.addEventListener('loadedmetadata', onReady)
        window.setTimeout(onReady, 2500)
      })

      try {
        await video.play()
      } catch {
        /* gesto del usuario cubierto por Reintentar */
      }

      if (video.videoWidth < 2) {
        mediaStream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        video.srcObject = null
        throw new Error('La cámara abrió pero no hay imagen. Tocá Reintentar.')
      }

      setCamaraLista(true)
    } catch (e) {
      setCamaraLista(false)
      setCameraError(e instanceof Error ? e.message : 'No se pudo abrir la cámara')
    }
  }, [])

  useEffect(() => {
    void startCamera()
    return () => {
      cancelMarcacionSpeech()
      stopCamera()
    }
  }, [startCamera, stopCamera])

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
    // Sin espejar: mismo pipeline que plotai identify
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', SELFIE_JPEG_Q)
  }, [])

  const handleRecognize = useCallback(async () => {
    if (capturingRef.current || cooldown > 0) return
    if (!camaraLista || employeesCount === 0) return

    capturingRef.current = true
    setIsCapturing(true)
    setResult(null)
    setStatusMessage('Capturando…')

    try {
      const selfie = captureSelfie()
      if (!selfie) {
        throw new Error('No se pudo capturar la imagen. Acercate de frente a la cámara.')
      }

      setStatusMessage('Reconociendo rostro…')
      const res = await marcarAutoRelojTablet(selfie)

      if (!res.match || !res.data) {
        const message = res.mensaje || 'No se reconoció el rostro. Probá de nuevo o usá QR.'
        setResult({ recognized: false, message, confianza: res.confianza })
        if (soundEnabled) playMarcacionSound('error')
        setCooldown(COOLDOWN_FAIL_S)
        return
      }

      const emp = empleados.find((e) => e.id_usuario === res.data!.id_usuario) || null
      const foto = (emp && fotoEmpleadoUrl(emp)) || emp?.foto_url || null
      setResult({
        recognized: true,
        message: res.data.mensaje || res.mensaje || 'Marcación registrada',
        confianza: res.confianza,
        empleado: emp,
        data: res.data,
        foto
      })
      if (soundEnabled) {
        playMarcacionSound('ok')
        speakMarcacionExito(res.data.nombre || emp?.nombre_completo || '', res.data.tipo)
      }
      setCooldown(COOLDOWN_OK_S)
      onMarked?.()
    } catch (e) {
      setResult({
        recognized: false,
        message: e instanceof Error ? e.message : 'Error al comunicar con el servidor'
      })
      if (soundEnabled) playMarcacionSound('error')
      setCooldown(COOLDOWN_FAIL_S)
    } finally {
      setStatusMessage(null)
      setIsCapturing(false)
      capturingRef.current = false
    }
  }, [
    camaraLista,
    captureSelfie,
    cooldown,
    empleados,
    employeesCount,
    onMarked,
    soundEnabled
  ])

  useEffect(() => {
    if (!isAutoMode || isCapturing || cooldown > 0 || employeesCount === 0 || !camaraLista) return
    const timer = window.setTimeout(() => {
      void handleRecognize()
    }, AUTO_SCAN_MS)
    return () => window.clearTimeout(timer)
  }, [isAutoMode, isCapturing, cooldown, employeesCount, camaraLista, handleRecognize])

  const horaStr = clock.toLocaleTimeString('es-AR', {
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  })

  return (
    <div className="facial-clock">
      <div className="facial-clock-header">
        <div className="facial-clock-brand">
          <span className="facial-clock-brand-icon" aria-hidden>
            <Camera size={16} />
          </span>
          <div>
            <h2>Terminal facial</h2>
            <p>Escaneo biométrico plotLAB</p>
          </div>
        </div>
        <div className="facial-clock-header-actions">
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
      </div>

      <div className="facial-clock-toolbar">
        <div className="facial-clock-auto-row">
          <div>
            <h4>Modo automático</h4>
            <p>Registra al detectar un rostro. Entrada/salida la decide RRHH.</p>
          </div>
          <button
            type="button"
            className={`facial-clock-switch${isAutoMode ? ' facial-clock-switch--on' : ''}`}
            onClick={() => setIsAutoMode((v) => !v)}
            aria-pressed={isAutoMode}
          >
            <span className="facial-clock-switch-knob" />
          </button>
        </div>
      </div>

      <div className="facial-clock-stage">
        <canvas ref={canvasRef} className="facial-clock-canvas" aria-hidden />

        {cameraError ? (
          <div className="facial-clock-empty facial-clock-empty--err">
            <AlertCircle size={36} />
            <p>{cameraError}</p>
            <button type="button" className="facial-clock-btn" onClick={() => void startCamera()}>
              <RefreshCw size={14} /> Activar cámara
            </button>
          </div>
        ) : employeesCount === 0 ? (
          <div className="facial-clock-empty facial-clock-empty--warn">
            <AlertCircle size={36} />
            <h3>Sin fotos de legajo</h3>
            <p>Cargá la foto facial en el legajo de cada colaborador en RRHH para habilitar el reconocimiento.</p>
          </div>
        ) : (
          <div className={`facial-clock-viewport${camaraLista ? ' facial-clock-viewport--live' : ''}`}>
            <video ref={videoRef} autoPlay playsInline muted className="facial-clock-video" />
            <div className="facial-clock-frame" aria-hidden>
              <div className="facial-clock-oval" />
              <span className="facial-clock-guide">
                {cooldown > 0 ? `Listo en ${cooldown}s` : 'Alineá tu rostro'}
              </span>
            </div>
            {isAutoMode ? (
              <div className="facial-clock-badges">
                <span className="facial-clock-badge facial-clock-badge--auto">Auto activo</span>
                {cooldown > 0 ? (
                  <span className="facial-clock-badge facial-clock-badge--pause">Pausa {cooldown}s</span>
                ) : (
                  <span className="facial-clock-badge facial-clock-badge--scan">Escaneando…</span>
                )}
              </div>
            ) : null}
            {statusMessage ? (
              <div className="facial-clock-busy">
                <Loader2 size={40} className="facial-clock-spin" />
                <p>{statusMessage}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!cameraError && employeesCount > 0 ? (
        <div className="facial-clock-footer">
          {isAutoMode ? (
            <>
              <p>Parate de frente a la cámara. La marcación es automática.</p>
              <button
                type="button"
                className="facial-clock-btn facial-clock-btn--ghost"
                disabled={isCapturing || cooldown > 0}
                onClick={() => void handleRecognize()}
              >
                {cooldown > 0 ? `Esperá ${cooldown}s` : 'Marcar ahora'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="facial-clock-btn facial-clock-btn--primary"
              disabled={isCapturing || cooldown > 0 || !camaraLista}
              onClick={() => void handleRecognize()}
            >
              <Camera size={16} /> Marcar ahora
            </button>
          )}
        </div>
      ) : null}

      {result ? (
        <div className={`facial-clock-result${result.recognized ? ' facial-clock-result--ok' : ' facial-clock-result--err'}`}>
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
                <p>
                  {horaMarcacionTabletDisplay(result.data)} · Argentina
                </p>
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
