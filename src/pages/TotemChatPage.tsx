import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react'
import './TotemChatPage.css'
import { consumeTotemSeedMessage } from '../utils/totemSeedMessage'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import TotemPlotAIRobot from '../components/totem/TotemPlotAIRobot'
import {
  beginTotemMediaOnGesture,
  isTotemFeatureAllowedByPolicy,
  isTotemSecureContext,
  mapTotemLiveErrorMessage,
  queryTotemMicPermission
} from '../utils/totemMicPermission'
import {
  TotemPlotAILive,
  fetchTotemGeminiApiKey,
  fetchTotemLiveContext
} from '../services/totemPlotAILiveService'

const IMAGE_API_PATH = '/api/plotai/generate-image'
const MOTION_THRESHOLD = 0.08
const IMAGE_TRIGGER = /\b(dibuja|dibujame|genera\s+(?:una\s+)?(?:imagen|foto)|(?:una\s+)?foto\s+de|imagina|imagina(?:me)?|mu[eé]strame\s+(?:una\s+)?(?:imagen|foto)|quiero\s+ver\s+(?:una\s+)?(?:imagen|foto)|crea\s+(?:una\s+)?(?:imagen|ilustraci[oó]n))/i
const MOTION_CHECKS = 2
const CHECK_INTERVAL_MS = 800
const IDLE_RESET_MS = 90_000

type TotemState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking'

export default function TotemChatPage() {
  const [state, setState] = useState<TotemState>('idle')
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraWarning, setCameraWarning] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [liveActive, setLiveActive] = useState(false)
  const [contextHint, setContextHint] = useState<string | null>(null)
  const [proximityHint, setProximityHint] = useState(false)
  const [micBlocked, setMicBlocked] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const liveRef = useRef<TotemPlotAILive | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const liveStartingRef = useRef(false)
  const stateRef = useRef<TotemState>('idle')
  const idleResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSeedRef = useRef<string | null>(null)
  const imageBusyRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const userTextsRef = useRef<string[]>([])
  const lastContextFpRef = useRef('')
  const contextRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  stateRef.current = state

  useEffect(() => {
    const msg = consumeTotemSeedMessage()
    if (msg) pendingSeedRef.current = msg
    if (!isTotemSecureContext()) {
      setError('El tótem debe abrirse con HTTPS para usar el micrófono.')
    } else if (!isTotemFeatureAllowedByPolicy('microphone')) {
      setError(
        'Micrófono bloqueado por configuración del servidor en /totem. Esperá el deploy o recargá con Ctrl+Shift+R.'
      )
      setMicBlocked(true)
    } else {
      void queryTotemMicPermission().then((p) => {
        if (p === 'denied') setMicBlocked(true)
      })
    }
  }, [])

  const clearIdleReset = useCallback(() => {
    if (idleResetTimerRef.current != null) {
      clearTimeout(idleResetTimerRef.current)
      idleResetTimerRef.current = null
    }
  }, [])

  const stopLiveSession = useCallback(() => {
    clearIdleReset()
    intentionalStopRef.current = true
    liveRef.current?.stop()
    liveRef.current = null
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    setLiveActive(false)
  }, [clearIdleReset])

  const stopTotemVideo = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const resetToIdle = useCallback(() => {
    if (contextRefreshTimerRef.current != null) {
      clearTimeout(contextRefreshTimerRef.current)
      contextRefreshTimerRef.current = null
    }
    userTextsRef.current = []
    lastContextFpRef.current = ''
    setContextHint(null)
    setProximityHint(false)
    stopLiveSession()
    stopTotemVideo()
    setGeneratedImageUrl(null)
    setState('idle')
  }, [stopLiveSession, stopTotemVideo])

  const armIdleReset = useCallback(() => {
    clearIdleReset()
    idleResetTimerRef.current = setTimeout(() => {
      idleResetTimerRef.current = null
      resetToIdle()
    }, IDLE_RESET_MS)
  }, [clearIdleReset, resetToIdle])

  const handleImageRequest = useCallback(async (prompt: string) => {
    if (imageBusyRef.current) return
    imageBusyRef.current = true
    setState('thinking')
    setGeneratedImageUrl(null)
    try {
      const imgRes = await fetch(plotLabApiUrl(IMAGE_API_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: '1:1', style: 'totem_creative' })
      })
      const imgData = await imgRes.json().catch(() => ({}))
      if (imgData?.dataUrl) {
        setGeneratedImageUrl(imgData.dataUrl)
        liveRef.current?.sendTextTurn(
          '[Sistema: ya generaste y mostraste la imagen en pantalla. Confirmale al cliente en una frase breve que ya puede verla.]'
        )
      } else {
        liveRef.current?.sendTextTurn(
          '[Sistema: no se pudo generar la imagen. Pedile disculpas breves y sugerí reformular el pedido.]'
        )
      }
    } catch {
      liveRef.current?.sendTextTurn(
        '[Sistema: hubo un error al generar la imagen. Pedile disculpas y sugerí intentar de nuevo.]'
      )
    } finally {
      imageBusyRef.current = false
      if (stateRef.current === 'thinking') setState('listening')
    }
  }, [])

  const refreshLiveContext = useCallback(async () => {
    const texts = userTextsRef.current
    if (texts.length === 0) return
    try {
      const ctx = await fetchTotemLiveContext(texts)
      if (ctx.fingerprint === lastContextFpRef.current) return
      lastContextFpRef.current = ctx.fingerprint
      liveRef.current?.injectContextUpdate(ctx.contextBlock)
      if (ctx.numeroOp) {
        setContextHint(`OP ${ctx.numeroOp} encontrada en el sistema`)
      } else if (texts.some((t) => /\b(op|orden|dni|cuit|llamo|nombre)\b/i.test(t))) {
        setContextHint('Datos del cliente actualizados')
      }
    } catch (e) {
      console.warn('[Totem] refreshLiveContext:', e)
    }
  }, [])

  const attachTotemVideoStream = useCallback(async (videoStream: MediaStream | null) => {
    if (!videoStream) {
      setCameraReady(false)
      setCameraWarning('Cámara no disponible — igual podés hablar con PlotAI.')
      return
    }
    streamRef.current = videoStream
    if (videoRef.current) {
      videoRef.current.srcObject = videoStream
      try {
        await videoRef.current.play()
        setCameraReady(true)
        setCameraWarning(null)
      } catch {
        setCameraReady(false)
        setCameraWarning('Cámara no disponible — igual podés hablar con PlotAI.')
      }
    }
  }, [])

  const scheduleContextRefresh = useCallback(() => {
    if (contextRefreshTimerRef.current != null) {
      clearTimeout(contextRefreshTimerRef.current)
    }
    contextRefreshTimerRef.current = setTimeout(() => {
      contextRefreshTimerRef.current = null
      void refreshLiveContext()
    }, 900)
  }, [refreshLiveContext])

  const startLiveSession = useCallback(async (micGesture: Promise<MediaStream>) => {
    if (liveStartingRef.current || liveRef.current) return
    liveStartingRef.current = true
    setState('greeting')
    setError(null)
    setProximityHint(false)

    try {
      const micStream = await micGesture
      micStreamRef.current = micStream
      setMicBlocked(false)

      const [apiKey, initialContext] = await Promise.all([
        fetchTotemGeminiApiKey(),
        fetchTotemLiveContext(userTextsRef.current).catch(() => ({
          contextBlock:
            'CLIENTE CON QUIEN ESTÁS HABLANDO: el visitante aún no dio nombre DNI CUIT ni OP. Pedilos solo si pregunta por su trabajo.',
          fingerprint: 'empty',
          plotCenterKnowledge: undefined,
          numeroOp: null
        }))
      ])
      lastContextFpRef.current = initialContext.fingerprint

      const live = new TotemPlotAILive(apiKey)
      liveRef.current = live
      setLiveActive(true)

      await live.start({
        initialContext,
        micStream,
        callbacks: {
        onOpen: () => {
          setError(null)
          setState('listening')
          live.sendGreetingNudge()
          armIdleReset()

          const seed = pendingSeedRef.current
          if (seed) {
            pendingSeedRef.current = null
            userTextsRef.current = [seed]
            window.setTimeout(() => {
              live.sendTextTurn(seed)
              void refreshLiveContext()
            }, 1200)
          }
        },
        onUserTranscript: (text) => {
          clearIdleReset()
          armIdleReset()
          const t = text.trim()
          if (!t) return
          if (!userTextsRef.current.includes(t)) {
            userTextsRef.current = [...userTextsRef.current, t].slice(-24)
          }
          scheduleContextRefresh()
          if (IMAGE_TRIGGER.test(t)) {
            void handleImageRequest(t)
          } else if (!imageBusyRef.current) {
            setState('thinking')
          }
        },
        onModelTranscript: () => {
          /* solo animación del robot; sin subtítulos en pantalla */
        },
        onSpeakingChange: (speaking) => {
          if (imageBusyRef.current) return
          setState(speaking ? 'speaking' : 'listening')
        },
        onError: (err) => {
          console.error('[Totem Gemini Live]', err)
          if (stateRef.current === 'idle' || stateRef.current === 'greeting') {
            setError(mapTotemLiveErrorMessage(err.message || 'Error en PlotAI'))
          }
        },
        onClose: () => {
          if (intentionalStopRef.current) {
            intentionalStopRef.current = false
            return
          }
          if (stateRef.current !== 'idle') {
            resetToIdle()
          }
        }
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? mapTotemLiveErrorMessage(e.message) : 'No se pudo iniciar PlotAI'
      setError(msg)
      if (msg.toLowerCase().includes('bloqueado') || msg.toLowerCase().includes('denegado')) {
        setMicBlocked(true)
      }
      stopLiveSession()
      setState('idle')
    } finally {
      liveStartingRef.current = false
    }
  }, [armIdleReset, clearIdleReset, handleImageRequest, refreshLiveContext, resetToIdle, scheduleContextRefresh, stopLiveSession])

  useEffect(() => {
    return () => {
      stopLiveSession()
      stopTotemVideo()
    }
  }, [stopLiveSession, stopTotemVideo])

  useEffect(() => {
    if (state !== 'idle' || !cameraReady || !videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 64
    const h = 48
    canvas.width = w
    canvas.height = h

    let lastFrame: number[] | null = null
    let sameCount = 0
    let timeoutId: ReturnType<typeof setTimeout>

    const onPersonDetected = () => {
      if (stateRef.current !== 'idle' || liveStartingRef.current || liveRef.current) return
      setProximityHint(true)
    }

    const check = () => {
      if (stateRef.current !== 'idle') return
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
        if (change > MOTION_THRESHOLD) {
          sameCount++
          if (sameCount >= MOTION_CHECKS) {
            sameCount = 0
            onPersonDetected()
            return
          }
        } else sameCount = 0
      }
      lastFrame = gray
      timeoutId = setTimeout(check, CHECK_INTERVAL_MS)
    }

    timeoutId = setTimeout(check, 1500)
    return () => clearTimeout(timeoutId)
  }, [state, cameraReady])

  const handleTapStart = () => {
    if (state !== 'idle' || liveStartingRef.current || liveRef.current) return
    if (!isTotemSecureContext()) {
      setError('El tótem debe abrirse con HTTPS para usar el micrófono.')
      return
    }
    setError(null)
    const micPromise = beginTotemMediaOnGesture().then(async ({ micStream, videoStream }) => {
      await attachTotemVideoStream(videoStream)
      return micStream
    })
    void startLiveSession(micPromise)
  }

  const handleTapStartButton = (e: MouseEvent) => {
    e.stopPropagation()
    handleTapStart()
  }

  const handleEndSession = (e: MouseEvent) => {
    e.stopPropagation()
    resetToIdle()
  }

  return (
    <div className="totem-page" data-state={state} data-live={liveActive ? 'on' : 'off'} data-proximity={proximityHint ? 'near' : 'far'}>
      <div className="totem-bg" aria-hidden>
        <div className="totem-bg-aurora totem-bg-aurora--a" />
        <div className="totem-bg-aurora totem-bg-aurora--b" />
        <div className="totem-bg-aurora totem-bg-aurora--c" />
        <div className="totem-bg-orbs">
          <span className="totem-bg-orb totem-bg-orb--1" />
          <span className="totem-bg-orb totem-bg-orb--2" />
          <span className="totem-bg-orb totem-bg-orb--3" />
          <span className="totem-bg-orb totem-bg-orb--4" />
        </div>
        <div className="totem-bg-grid" />
        <div className="totem-bg-noise" />
      </div>

      <div className="totem-video-wrap">
        <video ref={videoRef} className="totem-video" muted playsInline />
        <canvas ref={canvasRef} className="totem-canvas" aria-hidden />
      </div>

      <div className="totem-bg-glow" aria-hidden />
      <div className="totem-scanline" aria-hidden />

      <div className="totem-ui">
        <div className="totem-hero">
          <div className="totem-hero-ring totem-hero-ring--outer" aria-hidden />
          <div className="totem-hero-ring totem-hero-ring--inner" aria-hidden />
          <div className="totem-hero-stage totem-hero-stage--ready">
            <TotemPlotAIRobot state={state} />
          </div>
        </div>

        <div className="totem-panel">
          <div className="totem-conversation-box">
            <p className="totem-state totem-state--label">
              {state === 'idle' && (proximityHint ? 'TE DETECTAMOS — ACTIVÁ EL MICRÓFONO' : 'TOCÁ ACTIVAR MICRÓFONO PARA HABLAR')}
              {state === 'greeting' && 'CONECTANDO...'}
              {state === 'listening' && 'TE ESCUCHO'}
              {state === 'thinking' && 'UN MOMENTO...'}
              {state === 'speaking' && 'HABLANDO CON VOS'}
            </p>
            {state === 'idle' && (
              <button
                type="button"
                className={`totem-tap-cta${proximityHint ? ' totem-tap-cta--proximity' : ''}${micBlocked ? ' totem-tap-cta--blocked' : ''}`}
                onClick={handleTapStartButton}
              >
                {micBlocked ? 'Reintentar micrófono' : 'Activar micrófono'}
              </button>
            )}
            {state !== 'idle' && (
              <button type="button" className="totem-end-cta" onClick={handleEndSession}>
                Finalizar conversación
              </button>
            )}
            {state === 'idle' && !cameraWarning && (
              <p className="totem-idle-camera-hint">
                {cameraReady
                  ? proximityHint
                    ? 'Estás cerca del tótem. Tocá el botón para hablar con PlotAI.'
                    : 'Cámara activa: te avisamos cuando te acerques.'
                  : 'Tocá «Activar micrófono» — Chrome pedirá permiso de micrófono y cámara.'}
              </p>
            )}
            {state === 'idle' && cameraWarning && (
              <p className="totem-camera-warn">{cameraWarning}</p>
            )}
            {state === 'speaking' && (
              <p className="totem-barge-hint">Podés interrumpir hablando cuando quieras.</p>
            )}
            {contextHint && state !== 'idle' && (
              <p className="totem-context-hint">{contextHint}</p>
            )}
          </div>

          {generatedImageUrl && (
            <div className="totem-generated-image-wrap">
              <img src={generatedImageUrl} alt="Imagen generada" className="totem-generated-image" />
            </div>
          )}
          {error && (
            <div className="totem-error-wrap">
              <p className="totem-error">{error}</p>
              {state === 'idle' && (
                <button type="button" className="totem-mic-retry" onClick={handleTapStartButton}>
                  Activar micrófono
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
