import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isStaffSession } from '../utils/plotlabSession'
import {
  createMensajeriaVoiceCall,
  type VoiceCallController,
  type VoiceCallUiState
} from '../utils/mensajeriaVoiceCall'
import './MensajeriaVoiceCallContext.css'

const INITIAL_STATE: VoiceCallUiState = {
  phase: 'idle',
  callId: null,
  roomId: null,
  peerUserId: null,
  peerName: '',
  muted: false,
  error: null
}

type StartCallArgs = {
  roomId: number
  peerUserId: number
  peerName: string
}

type VoiceCallContextValue = {
  voice: VoiceCallUiState
  startCall: (args: StartCallArgs) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => Promise<void>
  hangup: () => Promise<void>
  toggleMute: () => void
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null)

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

export function MensajeriaVoiceCallProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { usuario, nombreVisible } = useAuth()
  const [voice, setVoice] = useState<VoiceCallUiState>(INITIAL_STATE)
  const controllerRef = useRef<VoiceCallController | null>(null)

  useEffect(() => {
    controllerRef.current?.dispose()
    controllerRef.current = null
    setVoice(INITIAL_STATE)

    if (!usuario || !isStaffSession()) return

    const controller = createMensajeriaVoiceCall({ onState: setVoice })
    controllerRef.current = controller
    controller.attachInbox(usuario.id)

    return () => {
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [usuario?.id])

  const startCall = useCallback(
    async ({ roomId, peerUserId, peerName }: StartCallArgs) => {
      if (!usuario || !controllerRef.current) {
        throw new Error('La llamada no está disponible en esta sesión.')
      }
      await controllerRef.current.startCall({
        roomId,
        peerUserId,
        peerName,
        myUserId: usuario.id,
        myName: nombreVisible || usuario.nombre || 'Usuario'
      })
    },
    [nombreVisible, usuario]
  )

  const value = useMemo<VoiceCallContextValue>(
    () => ({
      voice,
      startCall,
      acceptCall: async () => controllerRef.current?.acceptCall(),
      rejectCall: async () => controllerRef.current?.rejectCall(),
      hangup: async () => controllerRef.current?.hangup(),
      toggleMute: () => controllerRef.current?.toggleMute()
    }),
    [startCall, voice]
  )

  const showOverlay =
    voice.phase === 'calling' ||
    voice.phase === 'ringing' ||
    voice.phase === 'connecting' ||
    voice.phase === 'in-call' ||
    (voice.phase === 'ended' && Boolean(voice.error))

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      {showOverlay && (
        <div className="global-voice-call-overlay" role="dialog" aria-modal="true" aria-label="Llamada de voz">
          <div className="global-voice-call-card">
            <div className="global-voice-call-avatar" aria-hidden>
              {initials(voice.peerName || 'Usuario')}
            </div>
            <strong className="global-voice-call-name">{voice.peerName || 'Compañero'}</strong>
            <p className="global-voice-call-status">
              {voice.phase === 'calling' && 'Llamando…'}
              {voice.phase === 'ringing' && 'Llamada entrante'}
              {voice.phase === 'connecting' && 'Conectando…'}
              {voice.phase === 'in-call' && (voice.muted ? 'En llamada · micrófono silenciado' : 'En llamada')}
              {voice.phase === 'ended' && (voice.error || 'Llamada finalizada')}
            </p>

            <div className="global-voice-call-actions">
              {voice.phase === 'ringing' && (
                <>
                  <button type="button" className="global-voice-call-btn is-accept" onClick={() => void value.acceptCall()}>
                    ✓ Contestar
                  </button>
                  <button type="button" className="global-voice-call-btn is-hangup" onClick={() => void value.rejectCall()}>
                    ✕ Rechazar
                  </button>
                </>
              )}

              {(voice.phase === 'calling' || voice.phase === 'connecting' || voice.phase === 'in-call') && (
                <>
                  {voice.phase === 'in-call' && (
                    <button type="button" className="global-voice-call-btn is-muted" onClick={value.toggleMute}>
                      {voice.muted ? '🔊 Activar mic' : '🔇 Silenciar'}
                    </button>
                  )}
                  <button type="button" className="global-voice-call-btn is-hangup" onClick={() => void value.hangup()}>
                    Cortar
                  </button>
                </>
              )}
            </div>

            {voice.roomId != null && (
              <button
                type="button"
                className="global-voice-call-open-chat"
                onClick={() => navigate(`/mensajeria?room=${voice.roomId}`)}
              >
                Abrir conversación
              </button>
            )}
            <p className="global-voice-call-hint">Llamada interna de Plot Lab</p>
          </div>
        </div>
      )}
    </VoiceCallContext.Provider>
  )
}

export function useMensajeriaVoiceCall(): VoiceCallContextValue {
  const value = useContext(VoiceCallContext)
  if (!value) throw new Error('useMensajeriaVoiceCall debe usarse dentro de MensajeriaVoiceCallProvider')
  return value
}
