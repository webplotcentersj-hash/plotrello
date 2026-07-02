import {
  isTotemFeatureAllowedByPolicy,
  isTotemSecureContext,
  queryTotemMicPermission
} from './totemMicPermission'

const MOBILE_HINT =
  'Tocá Reintentar y elegí Permitir. Si no aparece el cartel: candado en la barra → Micrófono → Permitir.'

const IFRAME_HINT =
  'En plotcenter.com.ar el iframe del chat debe tener allow="microphone" (código de embed actualizado).'

export async function requestEmbedMicrophoneStream(): Promise<MediaStream> {
  const framed = typeof window !== 'undefined' && window.self !== window.top

  if (!isTotemSecureContext()) {
    throw new Error('El micrófono solo funciona con HTTPS.')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no soporta micrófono. Probá con Chrome en el celular.')
  }
  if (!isTotemFeatureAllowedByPolicy('microphone')) {
    throw new Error(
      framed
        ? `Micrófono bloqueado en el iframe. ${IFRAME_HINT}`
        : 'El servidor bloqueó el micrófono en esta página. Recargá con Ctrl+Shift+R.'
    )
  }

  const perm = await queryTotemMicPermission()
  if (perm === 'denied') {
    throw new Error(`Permiso de micrófono denegado. ${MOBILE_HINT}`)
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    })
  } catch (e) {
    if (e instanceof DOMException) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        const framed = typeof window !== 'undefined' && window.self !== window.top
        throw new Error(
          framed
            ? `Permiso de micrófono denegado. ${MOBILE_HINT} ${IFRAME_HINT}`
            : `Permiso de micrófono denegado. ${MOBILE_HINT}`
        )
      }
      if (e.name === 'NotFoundError') {
        throw new Error('No encontramos micrófono en este dispositivo.')
      }
      if (e.name === 'NotReadableError') {
        throw new Error('El micrófono está en uso por otra aplicación.')
      }
    }
    throw e instanceof Error ? e : new Error('No se pudo activar el micrófono.')
  }
}
