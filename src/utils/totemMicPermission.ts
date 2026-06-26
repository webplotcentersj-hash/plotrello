export type TotemMicPermissionState = 'unknown' | 'granted' | 'prompt' | 'denied' | 'unsupported'

export function isTotemSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true
}

export async function queryTotemMicPermission(): Promise<TotemMicPermissionState> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
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
  'En el tótem abrí el menú de Chrome (⋮) → Configuración → Privacidad → Configuración de sitios → Micrófono → agregá esta página como Permitida. Reiniciá el navegador y tocá de nuevo.'

function mapDomExceptionToMicError(err: DOMException | null): Error {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return new Error(
      `Permiso de micrófono denegado. Tocá "Activar micrófono" y elegí Permitir en el cartel del navegador. ${KIOSK_MIC_HINT}`
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

/**
 * Dispara getUserMedia en el mismo tick del tap — sin awaits previos.
 * Usar solo desde onClick / onPointerDown del usuario.
 */
export function beginTotemMicrophoneOnGesture(): Promise<MediaStream> {
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

  return navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    .catch((err: DOMException) => {
      if (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError') {
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      }
      throw err
    })
    .catch((err: DOMException) => {
      throw mapDomExceptionToMicError(err)
    })
}

/** Reintento o flujos sin gesto reciente — consulta permiso antes de pedir el stream. */
export async function ensureTotemMicrophone(): Promise<MediaStream> {
  const perm = await queryTotemMicPermission()
  if (perm === 'denied') {
    throw new Error(`El micrófono está bloqueado para este sitio. ${KIOSK_MIC_HINT}`)
  }
  return beginTotemMicrophoneOnGesture()
}

export function mapTotemLiveErrorMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('permission denied') || m.includes('notallowed') || m.includes('not allowed')) {
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
