import { useState, useRef, useEffect, useCallback } from 'react'
import './TotemChatPage.css'

const GREETING_SPEECH = 'Hola, ¿cómo estás? ¿En qué te puedo ayudar?'
const CHAT_API = '/api/plotai/chat-public'
const MOTION_THRESHOLD = 0.08
const MOTION_CHECKS = 2
const CHECK_INTERVAL_MS = 800

type TotemState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking'

export default function TotemChatPage() {
  const [state, setState] = useState<TotemState>('idle')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [history, setHistory] = useState<Array<{ role: 'user' | 'model'; parts: { text: string }[] }>>([])
  const [lastText, setLastText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<{ start?: () => void } | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const isListeningRef = useRef(false)

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve()
        return
      }
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'es-AR'
      u.rate = 0.95
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.speak(u)
      synthRef.current = window.speechSynthesis
    })
  }, [])

  const sendToChat = useCallback(async (userText: string): Promise<string | null> => {
    const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(`${apiBase}${CHAT_API}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        conversation_id: conversationId ?? undefined,
        history: history.map((m) => ({ role: m.role, parts: m.parts }))
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return null
    if (data.conversation_id != null) setConversationId(data.conversation_id)
    setHistory((prev) => [
      ...prev,
      { role: 'user', parts: [{ text: userText }] },
      ...(data.reply ? [{ role: 'model' as const, parts: [{ text: data.reply }] }] : [])
    ])
    return data.reply && String(data.reply).trim() ? data.reply : null
  }, [conversationId, history])

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setError('Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.')
      return
    }
    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'es-AR'
    rec.onresult = async (e: { results?: { [i: number]: { [j: number]: { transcript?: string } } } }) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim()
      if (!t) {
        isListeningRef.current = true
        setState('listening')
        return
      }
      isListeningRef.current = false
      setLastText(t)
      setState('thinking')
      const reply = await sendToChat(t)
      setState('speaking')
      if (reply) {
        await speak(reply)
        setLastText(reply)
      }
      isListeningRef.current = true
      setState('listening')
      // Reiniciar reconocimiento para la siguiente frase (onend ya se disparó con isListeningRef en false)
      setTimeout(() => recognitionRef.current?.start?.(), 100)
    }
    rec.onerror = () => {
      isListeningRef.current = true
      setState('listening')
    }
    rec.onend = () => {
      if (isListeningRef.current && recognitionRef.current) (recognitionRef.current as any).start?.()
    }
    recognitionRef.current = rec
    isListeningRef.current = true
    rec.start()
  }, [sendToChat, speak])

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
        setError('No se pudo acceder a la cámara.')
      }
    }
    startCamera()
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

    function onPersonDetected() {
      setState('greeting')
      setError(null)
      speak(GREETING_SPEECH).then(() => {
        setState('listening')
        startListening()
      })
    }

    const check = () => {
      if (state !== 'idle') return
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
  }, [state, cameraReady, speak, startListening])

  const handleTapStart = () => {
    if (state !== 'idle') return
    setState('greeting')
    setError(null)
    speak(GREETING_SPEECH).then(() => {
      setState('listening')
      startListening()
    })
  }

  return (
    <div className="totem-page" data-state={state} onClick={state === 'idle' ? handleTapStart : undefined}>
      <div className="totem-video-wrap">
        <video ref={videoRef} className="totem-video" muted playsInline />
        <canvas ref={canvasRef} className="totem-canvas" aria-hidden />
      </div>
      <div className="totem-scanline" aria-hidden />
      <div className="totem-ui">
        <div className="totem-robot-face" role="img" aria-label={`Estado: ${state}`}>
          <div className="totem-robot-eyes">
            <div className="totem-robot-eye totem-robot-eye--l" />
            <div className="totem-robot-eye totem-robot-eye--r" />
          </div>
          <div className="totem-robot-mouth">
            {(state === 'listening' || state === 'speaking') && (
              <>
                <span className="totem-robot-bar" />
                <span className="totem-robot-bar" />
                <span className="totem-robot-bar" />
                <span className="totem-robot-bar" />
                <span className="totem-robot-bar" />
                <span className="totem-robot-bar" />
                <span className="totem-robot-bar" />
              </>
            )}
          </div>
          {state === 'thinking' && (
            <div className="totem-robot-thinking">
              <span className="totem-robot-dot" />
              <span className="totem-robot-dot" />
              <span className="totem-robot-dot" />
            </div>
          )}
        </div>
        <p className="totem-state totem-state--label">
          {state === 'idle' && 'ACERCATE O TOCÁ PARA HABLAR'}
          {state === 'greeting' && 'INICIANDO...'}
          {state === 'listening' && 'ESCUCHANDO...'}
          {state === 'thinking' && 'PROCESANDO...'}
          {state === 'speaking' && 'HABLANDO...'}
        </p>
        {lastText && <p className="totem-subtitle">{lastText}</p>}
        {error && <p className="totem-error">{error}</p>}
        <div className="totem-brand">Plot Center · Asistente por voz</div>
      </div>
    </div>
  )
}
