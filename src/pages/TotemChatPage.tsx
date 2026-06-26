import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react'
import './TotemChatPage.css'
import { consumeTotemSeedMessage } from '../utils/totemSeedMessage'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
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
const ROBOT_SKETCHFAB_SRC =
  'https://sketchfab.com/models/59fc99d8dcb146f3a6c16dbbcc4680da/embed?autostart=1&autospin=0.14&camera=0&preload=1&ui_theme=dark&ui_animations=0&ui_infos=0&ui_hint=0&ui_stop=0&ui_inspector=0&ui_watermark=0&ui_watermark_link=0&ui_ar=0&ui_help=0&ui_settings=0&ui_vr=0&ui_fullscreen=0&transparent=1'

type TotemState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking'

export default function TotemChatPage() {
  const [state, setState] = useState<TotemState>('idle')
  const [lastText, setLastText] = useState('')
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraWarning, setCameraWarning] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [robot3dReady, setRobot3dReady] = useState(false)
  const [liveActive, setLiveActive] = useState(false)
  const [contextHint, setContextHint] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const liveRef = useRef<TotemPlotAILive | null>(null)
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
    setLiveActive(false)
  }, [clearIdleReset])

  const resetToIdle = useCallback(() => {
    if (contextRefreshTimerRef.current != null) {
      clearTimeout(contextRefreshTimerRef.current)
      contextRefreshTimerRef.current = null
    }
    userTextsRef.current = []
    lastContextFpRef.current = ''
    setContextHint(null)
    stopLiveSession()
    setLastText('')
    setGeneratedImageUrl(null)
    setState('idle')
  }, [stopLiveSession])

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

  const scheduleContextRefresh = useCallback(() => {
    if (contextRefreshTimerRef.current != null) {
      clearTimeout(contextRefreshTimerRef.current)
    }
    contextRefreshTimerRef.current = setTimeout(() => {
      contextRefreshTimerRef.current = null
      void refreshLiveContext()
    }, 900)
  }, [refreshLiveContext])

  const startLiveSession = useCallback(async () => {
    if (liveStartingRef.current || liveRef.current) return
    liveStartingRef.current = true
    setState('greeting')
    setError(null)

    try {
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
        callbacks: {
        onOpen: () => {
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
          setLastText(t)
          scheduleContextRefresh()
          if (IMAGE_TRIGGER.test(t)) {
            void handleImageRequest(t)
          } else if (!imageBusyRef.current) {
            setState('thinking')
          }
        },
        onModelTranscript: (text) => {
          setLastText(text)
        },
        onSpeakingChange: (speaking) => {
          if (imageBusyRef.current) return
          setState(speaking ? 'speaking' : 'listening')
        },
        onError: (err) => {
          console.error('[Totem Gemini Live]', err)
          setError(err.message || 'Error en Gemini Live')
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
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar Gemini Live'
      setError(msg)
      stopLiveSession()
      setState('idle')
    } finally {
      liveStartingRef.current = false
    }
  }, [armIdleReset, clearIdleReset, handleImageRequest, refreshLiveContext, resetToIdle, scheduleContextRefresh, stopLiveSession])

  useEffect(() => {
    return () => {
      stopLiveSession()
    }
  }, [stopLiveSession])

  useEffect(() => {
    let cancelled = false
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          await videoRef.current.play()
        }
        setCameraReady(true)
      } catch {
        setCameraReady(false)
        setCameraWarning('Cámara no disponible — tocá la pantalla para hablar con PlotAI.')
      }
    }
    void startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

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
      void startLiveSession()
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
  }, [state, cameraReady, startLiveSession])

  const handleTapStart = () => {
    if (state !== 'idle') return
    void startLiveSession()
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
    <div className="totem-page" data-state={state} data-live={liveActive ? 'on' : 'off'} onClick={state === 'idle' ? handleTapStart : undefined}>
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
          <div className={`totem-hero-stage${robot3dReady ? ' totem-hero-stage--ready' : ''}`}>
            <iframe
              title="PlotAI — Robot Playground"
              className="totem-robot-3d"
              src={ROBOT_SKETCHFAB_SRC}
              frameBorder={0}
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
              onLoad={() => setRobot3dReady(true)}
            />
            {!robot3dReady && <div className="totem-hero-loader" aria-hidden />}
          </div>
          <p className="totem-hero-brand">PlotAI</p>
          {liveActive && <span className="totem-live-badge">Gemini Live</span>}
        </div>

        <div className="totem-panel">
          <div className="totem-conversation-box">
            <p className="totem-state totem-state--label">
              {state === 'idle' && 'ACERCATE O TOCÁ PARA HABLAR'}
              {state === 'greeting' && 'CONECTANDO CON GEMINI LIVE...'}
              {state === 'listening' && 'CONVERSANDO — HABLÁ LIBREMENTE'}
              {state === 'thinking' && 'PENSANDO...'}
              {state === 'speaking' && 'PLOTAI RESPONDE...'}
            </p>
            {state === 'idle' && (
              <button type="button" className="totem-tap-cta" onClick={handleTapStartButton}>
                Tocá para empezar
              </button>
            )}
            {state !== 'idle' && (
              <button type="button" className="totem-end-cta" onClick={handleEndSession}>
                Finalizar conversación
              </button>
            )}
            {state === 'idle' && cameraReady && (
              <p className="totem-idle-camera-hint">Cámara activa: te detectamos al acercarte.</p>
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
            {lastText && <p className="totem-subtitle">{lastText}</p>}
          </div>

          {generatedImageUrl && (
            <div className="totem-generated-image-wrap">
              <img src={generatedImageUrl} alt="Imagen generada" className="totem-generated-image" />
            </div>
          )}
          {error && <p className="totem-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
