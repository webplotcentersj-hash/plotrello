import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'

export type VoiceCallPhase =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'in-call'
  | 'ended'

type RingPayload = {
  type: 'ring'
  callId: string
  roomId: number
  fromUserId: number
  fromName: string
}

type AcceptPayload = {
  type: 'accept'
  callId: string
  roomId: number
  fromUserId: number
}

type RejectPayload = {
  type: 'reject'
  callId: string
  roomId: number
  fromUserId: number
}

type HangupPayload = {
  type: 'hangup'
  callId: string
  roomId: number
  fromUserId: number
}

type SdpPayload = {
  type: 'offer' | 'answer'
  callId: string
  roomId: number
  fromUserId: number
  sdp: RTCSessionDescriptionInit
}

type IcePayload = {
  type: 'ice'
  callId: string
  roomId: number
  fromUserId: number
  candidate: RTCIceCandidateInit
}

export type VoiceSignal =
  | RingPayload
  | AcceptPayload
  | RejectPayload
  | HangupPayload
  | SdpPayload
  | IcePayload

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]

const userChannelName = (userId: number) => `mensajeria-voice:u:${userId}`
const roomChannelName = (roomId: number) => `mensajeria-voice:r:${roomId}`

function unwrapBroadcast(msg: unknown): VoiceSignal | null {
  const raw =
    msg && typeof msg === 'object' && 'payload' in msg
      ? (msg as { payload: unknown }).payload
      : msg
  if (!raw || typeof raw !== 'object') return null
  const t = (raw as { type?: unknown }).type
  if (
    t !== 'ring' &&
    t !== 'accept' &&
    t !== 'reject' &&
    t !== 'hangup' &&
    t !== 'offer' &&
    t !== 'answer' &&
    t !== 'ice'
  ) {
    return null
  }
  return raw as VoiceSignal
}

function newCallId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export type VoiceCallUiState = {
  phase: VoiceCallPhase
  callId: string | null
  roomId: number | null
  peerUserId: number | null
  peerName: string
  muted: boolean
  error: string | null
}

export type VoiceCallController = {
  getState: () => VoiceCallUiState
  attachInbox: (userId: number) => void
  startCall: (args: {
    roomId: number
    peerUserId: number
    peerName: string
    myUserId: number
    myName: string
  }) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => Promise<void>
  hangup: () => Promise<void>
  toggleMute: () => void
  dispose: () => void
}

type Listeners = {
  onState: (state: VoiceCallUiState) => void
}

/**
 * Llamada de voz 1:1 en mensajería interna.
 * Señalización: Supabase Realtime broadcast (canal por usuario + canal por room).
 * Media: WebRTC (STUN público; sin TURN aún).
 */
export function createMensajeriaVoiceCall(listeners: Listeners): VoiceCallController {
  let state: VoiceCallUiState = {
    phase: 'idle',
    callId: null,
    roomId: null,
    peerUserId: null,
    peerName: '',
    muted: false,
    error: null
  }

  let pc: RTCPeerConnection | null = null
  let localStream: MediaStream | null = null
  let remoteAudioEl: HTMLAudioElement | null = null
  let personalChannel: RealtimeChannel | null = null
  let roomChannel: RealtimeChannel | null = null
  let myUserId: number | null = null
  let pendingRemoteIce: RTCIceCandidateInit[] = []
  let isCaller = false
  let disposed = false

  const setState = (patch: Partial<VoiceCallUiState>) => {
    state = { ...state, ...patch }
    listeners.onState(state)
  }

  const ensureRemoteAudio = () => {
    if (remoteAudioEl) return remoteAudioEl
    const el = document.createElement('audio')
    el.autoplay = true
    el.setAttribute('playsinline', 'true')
    el.style.display = 'none'
    document.body.appendChild(el)
    remoteAudioEl = el
    return el
  }

  const stopLocalMedia = () => {
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
  }

  const closePc = () => {
    try {
      pc?.close()
    } catch {
      /* ignore */
    }
    pc = null
    pendingRemoteIce = []
  }

  const leaveRoomChannel = async () => {
    if (roomChannel && supabase) {
      const ch = roomChannel
      roomChannel = null
      await supabase.removeChannel(ch)
    }
  }

  const resetToIdle = async (error?: string | null) => {
    stopLocalMedia()
    closePc()
    await leaveRoomChannel()
    if (remoteAudioEl) {
      remoteAudioEl.srcObject = null
    }
    setState({
      phase: error ? 'ended' : 'idle',
      callId: null,
      roomId: null,
      peerUserId: null,
      peerName: '',
      muted: false,
      error: error ?? null
    })
    if (error) {
      window.setTimeout(() => {
        if (state.phase === 'ended') setState({ phase: 'idle', error: null })
      }, 2500)
    }
  }

  const send = async (channel: RealtimeChannel | null, payload: VoiceSignal) => {
    if (!channel) return
    await channel.send({ type: 'broadcast', event: 'signal', payload })
  }

  const subscribeRoom = async (roomId: number) => {
    if (!supabase) throw new Error('Supabase no disponible')
    await leaveRoomChannel()
    const ch = supabase.channel(roomChannelName(roomId), {
      config: { broadcast: { ack: false, self: false } }
    })
    ch.on('broadcast', { event: 'signal' }, (msg) => {
      void handleSignal(unwrapBroadcast(msg))
    })
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('Timeout uniendo canal de llamada')), 8000)
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(t)
          resolve()
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(t)
          reject(new Error('No se pudo unir al canal de llamada'))
        }
      })
    })
    roomChannel = ch
  }

  const getMic = async () => {
    if (localStream) return localStream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    localStream = stream
    return stream
  }

  const createPc = async () => {
    closePc()
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc = connection

    const stream = localStream || (await getMic())
    for (const track of stream.getAudioTracks()) {
      connection.addTrack(track, stream)
    }

    connection.onicecandidate = (ev) => {
      if (!ev.candidate || !state.callId || !state.roomId || myUserId == null) return
      void send(roomChannel, {
        type: 'ice',
        callId: state.callId,
        roomId: state.roomId,
        fromUserId: myUserId,
        candidate: ev.candidate.toJSON()
      })
    }

    connection.ontrack = (ev) => {
      const audio = ensureRemoteAudio()
      const [streamRemote] = ev.streams
      if (streamRemote) {
        audio.srcObject = streamRemote
        void audio.play().catch(() => undefined)
      }
    }

    connection.onconnectionstatechange = () => {
      const s = connection.connectionState
      if (s === 'connected') setState({ phase: 'in-call', error: null })
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        if (state.phase === 'in-call' || state.phase === 'connecting') {
          void resetToIdle(s === 'failed' ? 'Se cortó la llamada' : null)
        }
      }
    }

    return connection
  }

  const flushIce = async () => {
    if (!pc || !pc.remoteDescription) return
    const queued = pendingRemoteIce
    pendingRemoteIce = []
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c)
      } catch {
        /* ignore stale */
      }
    }
  }

  const handleSignal = async (signal: VoiceSignal | null) => {
    if (!signal || disposed || myUserId == null) return
    if (signal.fromUserId === myUserId) return

    if (signal.type === 'ring') {
      if (state.phase !== 'idle') {
        // Ocupado: rechazar
        const currentUserId = myUserId
        const peerCh = supabase?.channel(userChannelName(signal.fromUserId), {
          config: { broadcast: { ack: false, self: false } }
        })
        if (peerCh) {
          peerCh.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void peerCh.send({
                type: 'broadcast',
                event: 'signal',
                payload: {
                  type: 'reject',
                  callId: signal.callId,
                  roomId: signal.roomId,
                  fromUserId: currentUserId
                } satisfies RejectPayload
              }).finally(() => {
                void supabase?.removeChannel(peerCh)
              })
            }
          })
        }
        return
      }
      isCaller = false
      setState({
        phase: 'ringing',
        callId: signal.callId,
        roomId: signal.roomId,
        peerUserId: signal.fromUserId,
        peerName: signal.fromName,
        error: null
      })
      return
    }

    if (signal.type === 'reject') {
      if (state.callId && signal.callId === state.callId) {
        await resetToIdle('Llamada rechazada')
      }
      return
    }

    if (signal.type === 'hangup') {
      if (state.callId && signal.callId === state.callId) {
        await resetToIdle(null)
      }
      return
    }

    if (signal.type === 'accept') {
      if (!isCaller || !state.callId || signal.callId !== state.callId) return
      setState({ phase: 'connecting' })
      try {
        await subscribeRoom(signal.roomId)
        const connection = await createPc()
        const offer = await connection.createOffer({ offerToReceiveAudio: true })
        await connection.setLocalDescription(offer)
        await send(roomChannel, {
          type: 'offer',
          callId: state.callId,
          roomId: signal.roomId,
          fromUserId: myUserId,
          sdp: offer
        })
      } catch (e) {
        await resetToIdle(e instanceof Error ? e.message : 'No se pudo conectar')
      }
      return
    }

    if (signal.type === 'offer') {
      if (isCaller || !state.callId || signal.callId !== state.callId) return
      try {
        setState({ phase: 'connecting' })
        if (!roomChannel) await subscribeRoom(signal.roomId)
        const connection = await createPc()
        await connection.setRemoteDescription(signal.sdp)
        await flushIce()
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        await send(roomChannel, {
          type: 'answer',
          callId: state.callId,
          roomId: signal.roomId,
          fromUserId: myUserId,
          sdp: answer
        })
      } catch (e) {
        await resetToIdle(e instanceof Error ? e.message : 'Error al aceptar audio')
      }
      return
    }

    if (signal.type === 'answer') {
      if (!isCaller || !pc || !state.callId || signal.callId !== state.callId) return
      try {
        await pc.setRemoteDescription(signal.sdp)
        await flushIce()
      } catch (e) {
        await resetToIdle(e instanceof Error ? e.message : 'Error en answer')
      }
      return
    }

    if (signal.type === 'ice') {
      if (!state.callId || signal.callId !== state.callId) return
      if (!pc || !pc.remoteDescription) {
        pendingRemoteIce.push(signal.candidate)
        return
      }
      try {
        await pc.addIceCandidate(signal.candidate)
      } catch {
        /* ignore */
      }
    }
  }

  const attachPersonalListener = (userId: number) => {
    if (!supabase || personalChannel) return
    myUserId = userId
    const ch = supabase.channel(userChannelName(userId), {
      config: { broadcast: { ack: false, self: false } }
    })
    ch.on('broadcast', { event: 'signal' }, (msg) => {
      void handleSignal(unwrapBroadcast(msg))
    })
    ch.subscribe()
    personalChannel = ch
  }

  return {
    getState: () => state,

    startCall: async ({ roomId, peerUserId, peerName, myUserId: uid, myName }) => {
      if (!supabase) throw new Error('Supabase no disponible')
      if (state.phase !== 'idle' && state.phase !== 'ended') return
      attachPersonalListener(uid)
      myUserId = uid
      isCaller = true
      const callId = newCallId()
      setState({
        phase: 'calling',
        callId,
        roomId,
        peerUserId,
        peerName,
        error: null
      })
      try {
        await getMic()
        const peerCh = supabase.channel(userChannelName(peerUserId), {
          config: { broadcast: { ack: false, self: false } }
        })
        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error('Timeout avisando al compañero')), 8000)
          peerCh.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              window.clearTimeout(t)
              resolve()
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              window.clearTimeout(t)
              reject(new Error('No se pudo avisar al compañero'))
            }
          })
        })
        await peerCh.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ring',
            callId,
            roomId,
            fromUserId: uid,
            fromName: myName
          } satisfies RingPayload
        })
        void supabase.removeChannel(peerCh)
      } catch (e) {
        await resetToIdle(e instanceof Error ? e.message : 'No se pudo iniciar la llamada')
      }
    },

    acceptCall: async () => {
      if (state.phase !== 'ringing' || !state.callId || !state.roomId || myUserId == null || !state.peerUserId) {
        return
      }
      try {
        await getMic()
        await subscribeRoom(state.roomId)
        setState({ phase: 'connecting' })
        const peerCh = supabase!.channel(userChannelName(state.peerUserId), {
          config: { broadcast: { ack: false, self: false } }
        })
        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error('Timeout al aceptar')), 8000)
          peerCh.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              window.clearTimeout(t)
              resolve()
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              window.clearTimeout(t)
              reject(new Error('No se pudo avisar aceptación'))
            }
          })
        })
        await peerCh.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'accept',
            callId: state.callId,
            roomId: state.roomId,
            fromUserId: myUserId
          } satisfies AcceptPayload
        })
        void supabase!.removeChannel(peerCh)
      } catch (e) {
        await resetToIdle(e instanceof Error ? e.message : 'No se pudo aceptar')
      }
    },

    rejectCall: async () => {
      if (!state.callId || !state.roomId || myUserId == null || !state.peerUserId) {
        await resetToIdle(null)
        return
      }
      try {
        const peerCh = supabase?.channel(userChannelName(state.peerUserId), {
          config: { broadcast: { ack: false, self: false } }
        })
        if (peerCh) {
          await new Promise<void>((resolve) => {
            const t = window.setTimeout(() => resolve(), 3000)
            peerCh.subscribe((status) => {
              if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                window.clearTimeout(t)
                resolve()
              }
            })
          })
          await peerCh.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              type: 'reject',
              callId: state.callId,
              roomId: state.roomId,
              fromUserId: myUserId
            } satisfies RejectPayload
          })
          void supabase?.removeChannel(peerCh)
        }
      } finally {
        await resetToIdle(null)
      }
    },

    hangup: async () => {
      if (state.callId && state.roomId && myUserId != null) {
        const payload: HangupPayload = {
          type: 'hangup',
          callId: state.callId,
          roomId: state.roomId,
          fromUserId: myUserId
        }
        await send(roomChannel, payload)
        if (state.peerUserId && supabase) {
          const sb = supabase
          const peerCh = sb.channel(userChannelName(state.peerUserId), {
            config: { broadcast: { ack: false, self: false } }
          })
          peerCh.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void peerCh.send({ type: 'broadcast', event: 'signal', payload }).finally(() => {
                void sb.removeChannel(peerCh)
              })
            }
          })
        }
      }
      await resetToIdle(null)
    },

    toggleMute: () => {
      if (!localStream) return
      const next = !state.muted
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !next
      })
      setState({ muted: next })
    },

    attachInbox: (userId: number) => {
      attachPersonalListener(userId)
    },

    dispose: () => {
      disposed = true
      stopLocalMedia()
      closePc()
      if (remoteAudioEl) {
        remoteAudioEl.remove()
        remoteAudioEl = null
      }
      if (personalChannel && supabase) {
        void supabase.removeChannel(personalChannel)
        personalChannel = null
      }
      if (roomChannel && supabase) {
        void supabase.removeChannel(roomChannel)
        roomChannel = null
      }
    }
  }
}
