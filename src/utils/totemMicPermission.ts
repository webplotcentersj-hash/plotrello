/** Pide micrófono en el gesto del usuario (tap) — requerido para Gemini Live en kiosko. */
export async function ensureTotemMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no soporta micrófono. Usá Chrome o Edge en el tótem.')
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
    const err = e as DOMException
    const name = err?.name || ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new Error(
        'Permiso de micrófono denegado. Tocá el candado en la barra del navegador y elegí Permitir micrófono, luego volvé a tocar la pantalla.'
      )
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new Error('No encontramos un micrófono en este equipo. Conectá uno y probá de nuevo.')
    }
    if (name === 'NotReadableError') {
      throw new Error('El micrófono está en uso por otra aplicación. Cerrala y probá de nuevo.')
    }
    throw new Error(err?.message || 'No se pudo activar el micrófono.')
  }
}

export function mapTotemLiveErrorMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('permission denied') || m.includes('notallowed') || m.includes('not allowed')) {
    return 'Permiso de micrófono denegado. Permití el micrófono en el navegador y tocá de nuevo.'
  }
  if (m.includes('gemini') && m.includes('api')) {
    return 'PlotAI no pudo conectar con el servidor de voz. Revisá GEMINI_API_KEY en Vercel.'
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Sin conexión con el servidor. Verificá internet en el tótem.'
  }
  return raw
}
