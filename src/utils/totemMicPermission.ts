export type TotemMicPermissionState = 'unknown' | 'granted' | 'prompt' | 'denied' | 'unsupported'

export type TotemMediaStreams = {
  micStream: MediaStream
  videoStream: MediaStream | null
}

export function isTotemSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true
}

/** El header Permissions-Policy del servidor puede bloquear mic/cámara sin mostrar cartel. */
export function isTotemFeatureAllowedByPolicy(feature: 'microphone' | 'camera'): boolean {
  try {
    const policy = (document as Document & { permissionsPolicy?: { allowsFeature: (f: string, url: string) => boolean } })
      .permissionsPolicy
    if (policy?.allowsFeature) {
      return policy.allowsFeature(feature, document.location.href)
    }
  } catch {
    /* ignore */
  }
  return true
}

export async function queryTotemMicPermission(): Promise<TotemMicPermissionState> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  if (!isTotemFeatureAllowedByPolicy('microphone')) return 'denied'
  try {
    const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    if (perm.state === 'granted') return 'granted'
    if (perm.state === 'denied') return 'denied'
    if (perm.state === 'prompt') return 'prompt'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

const KIOSK_MIC_HINT =
  'En Chrome del tótem: menú ⋮ → Configuración → Privacidad → Configuración de sitios → Micrófono → Permitir este sitio. Reiniciá Chrome y tocá de nuevo.'

const POLICY_BLOCK_HINT =
  'El servidor tenía bloqueado el micrófono en /totem. Si ves este mensaje después de un deploy, recargá con Ctrl+Shift+R.'

function mapDomExceptionToMicError(err: DOMException | null): Error {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    if (!isTotemFeatureAllowedByPolicy('microphone')) {
      return new Error(`Micrófono bloqueado por política del servidor en /totem. ${POLICY_BLOCK_HINT}`)
    }
    return new Error(
      `Permiso de micrófono denegado. Tocá "Activar micrófono" y elegí Permitir en el cartel. ${KIOSK_MIC_HINT}`
    )
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new Error('No encontramos un micrófono. Conectá uno al tótem y probá de nuevo.')
  }
  if (name === 'NotReadableError') {
    return new Error('El micrófono está en uso por otra app. Cerrala y probá de nuevo.')
  }
  return new Error(err?.message || 'No se pudo activar el micrófono.')
}

function requestTotemUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(constraints).catch((err: DOMException) => {
    if (err?.name === 'OverconstrainedError') {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: constraints.video ? true : false })
    }
    throw err
  })
}

/**
 * Micrófono + cámara en el mismo gesto del usuario (un solo cartel de permiso).
 * Usar solo desde onClick / onPointerDown.
 */
export function beginTotemMediaOnGesture(): Promise<TotemMediaStreams> {
  if (!isTotemSecureContext()) {
    return Promise.reject(
      new Error(
        'El micrófono solo funciona con HTTPS. Abrí el tótem con https:// (no http://) en la barra del navegador.'
      )
    )
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('Este navegador no soporta micrófono. Usá Chrome o Edge en el tótem.'))
  }
  if (!isTotemFeatureAllowedByPolicy('microphone')) {
    return Promise.reject(new Error(`Micrófono bloqueado por política del servidor en /totem. ${POLICY_BLOCK_HINT}`))
  }

  return requestTotemUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: isTotemFeatureAllowedByPolicy('camera') ? { facingMode: 'user' } : false
  })
    .then((stream) => {
      const audioTracks = stream.getAudioTracks()
      const videoTracks = stream.getVideoTracks()
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop())
        throw new Error('No se pudo acceder al micrófono.')
      }
      return {
        micStream: new MediaStream(audioTracks),
        videoStream: videoTracks.length > 0 ? new MediaStream(videoTracks) : null
      }
    })
    .catch((err: DOMException) => {
      throw mapDomExceptionToMicError(err)
    })
}

/** Solo audio — compatibilidad con llamadas que piden solo micrófono. */
export function beginTotemMicrophoneOnGesture(): Promise<MediaStream> {
  return beginTotemMediaOnGesture().then(({ micStream }) => micStream)
}

export function mapTotemLiveErrorMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('permissions-policy') || m.includes('política del servidor')) {
    return raw
  }
  if (m.includes('permission denied') || m.includes('notallowed') || m.includes('not allowed')) {
    if (!isTotemFeatureAllowedByPolicy('microphone')) {
      return `Micrófono bloqueado por política del servidor en /totem. ${POLICY_BLOCK_HINT}`
    }
    return `Permiso de micrófono denegado. Tocá "Activar micrófono" y elegí Permitir. ${KIOSK_MIC_HINT}`
  }
  if (m.includes('gemini') && m.includes('api')) {
    return 'PlotAI no pudo conectar con el servidor de voz. Revisá GEMINI_API_KEY en Vercel.'
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Sin conexión con el servidor. Verificá internet en el tótem.'
  }
  return raw
}
