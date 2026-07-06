import {
  isTotemFeatureAllowedByPolicy,
  isTotemSecureContext,
  queryTotemMicPermission
} from './totemMicPermission'
import { getPlotLabEmbedOrigin } from '../constants/embedChatSnippet'

const MOBILE_HINT = 'Tocá Reintentar → Permitir. Si sigue fallando, tocá Pantalla completa para agrandar el chat.'

const IFRAME_HINT = 'Si estás en plotcenter.com.ar, el iframe debe tener allow="microphone".'

export function isEmbedFramed(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top
}

export function isMicAvailableInEmbed(): boolean {
  if (!isTotemSecureContext()) return false
  if (!navigator.mediaDevices?.getUserMedia) return false
  return isTotemFeatureAllowedByPolicy('microphone')
}

export function getEmbedStandaloneChatUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : getPlotLabEmbedOrigin()
  return `${origin.replace(/\/$/, '')}/embed/chat`
}

export async function requestEmbedMicrophoneStream(): Promise<MediaStream> {
  const framed = isEmbedFramed()

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
  } catch (firstErr) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (secondErr) {
      const err =
        secondErr instanceof DOMException
          ? secondErr
          : firstErr instanceof DOMException
            ? firstErr
            : secondErr
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error(
            framed
              ? `Permiso de micrófono denegado. ${MOBILE_HINT} ${IFRAME_HINT}`
              : `Permiso de micrófono denegado. ${MOBILE_HINT}`
          )
        }
        if (err.name === 'NotFoundError') {
          throw new Error('No encontramos micrófono en este dispositivo.')
        }
        if (err.name === 'NotReadableError') {
          throw new Error('El micrófono está en uso por otra aplicación.')
        }
      }
      throw err instanceof Error ? err : new Error('No se pudo activar el micrófono.')
    }
  }
}
