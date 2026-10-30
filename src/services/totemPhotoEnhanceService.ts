import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { dataUrlToCanvas, downscaleCanvas } from '../utils/totemPhotoEdit'

/**
 * Mejora de fotos con PlotAI para el tótem.
 * Reutiliza el endpoint existente `/api/plotai/design-studio` (acción `image-edit`, Gemini en el servidor),
 * el mismo que usa Plot AI Studio; no hay claves en el cliente.
 */

export type EnhanceErrorCode =
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'quota'
  | 'unavailable'
  | 'too_large'
  | 'no_image'
  | 'bad_response'

export class PlotAiEnhanceError extends Error {
  code: EnhanceErrorCode
  constructor(code: EnhanceErrorCode, message: string) {
    super(message)
    this.name = 'PlotAiEnhanceError'
    this.code = code
  }
}

/** Tiempo máximo de espera (el endpoint de Vercel corta a los 120 s). */
export const PLOTAI_ENHANCE_TIMEOUT_MS = 90_000
const SEND_MAX_SIDE = 1536
/** Vercel rechaza cuerpos > 4,5 MB; el base64 de la foto tiene que quedar bien por debajo. */
const MAX_BASE64_CHARS = 3_200_000

export const PLOTAI_ENHANCE_PROMPT =
  'Mejorá esta fotografía para imprimirla en papel: corregí la exposición y el balance de blancos, ' +
  'realzá los colores y el contraste de forma natural, reducí el ruido y aumentá la nitidez. ' +
  'Conservá exactamente la misma composición, encuadre, proporciones, objetos, personas, rostros y textos: ' +
  'no agregues, quites ni modifiques elementos. No agregues marcos, marcas de agua ni texto. Devolvé solo la imagen.'

function encodeForUpload(canvas: HTMLCanvasElement): string {
  let side = SEND_MAX_SIDE
  let quality = 0.9
  for (let attempt = 0; attempt < 4; attempt++) {
    const dataUrl = downscaleCanvas(canvas, side).toDataURL('image/jpeg', quality)
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    if (base64.length <= MAX_BASE64_CHARS) return base64
    quality -= 0.1
    side = Math.round(side * 0.85)
  }
  throw new PlotAiEnhanceError('too_large', 'La imagen es demasiado pesada para mejorarla. Probá recortarla primero.')
}

function mapHttpError(status: number, serverMessage: string): PlotAiEnhanceError {
  const msg = serverMessage.toLowerCase()
  if (status === 429 || /quota|resource_exhausted|límite|limite/.test(msg)) {
    return new PlotAiEnhanceError('quota', 'PlotAI tiene mucha demanda ahora. Esperá un momento y probá de nuevo.')
  }
  if (status === 413) {
    return new PlotAiEnhanceError('too_large', 'La imagen es demasiado pesada para mejorarla. Probá recortarla primero.')
  }
  if (status === 404 || status === 405 || /api_key|api key|no configurada/.test(msg)) {
    return new PlotAiEnhanceError('unavailable', 'PlotAI no está disponible en este momento. Podés seguir con tu imagen.')
  }
  if (status === 502 || status === 504) {
    return new PlotAiEnhanceError('no_image', 'PlotAI no pudo mejorar esta imagen. Probá de nuevo o seguí con la tuya.')
  }
  return new PlotAiEnhanceError('bad_response', 'PlotAI tuvo un problema al mejorar la imagen. Probá de nuevo.')
}

/**
 * Envía la imagen ya editada a PlotAI y devuelve el resultado como canvas.
 * Lanza `PlotAiEnhanceError` con un mensaje listo para mostrar en pantalla.
 */
export async function mejorarFotoConPlotAI(
  source: HTMLCanvasElement,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<HTMLCanvasElement> {
  const imageBase64 = encodeForUpload(source)
  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, opts.timeoutMs ?? PLOTAI_ENHANCE_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const resp = await plotLabFetch('/api/plotai/design-studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'image-edit',
        prompt: PLOTAI_ENHANCE_PROMPT,
        imageBase64,
        imageMimeType: 'image/jpeg'
      }),
      signal: controller.signal
    })
    const raw = await resp.text()
    let json: { dataUrl?: string; error?: string } = {}
    try {
      json = raw ? (JSON.parse(raw) as typeof json) : {}
    } catch {
      /* respuesta no JSON (p. ej. HTML de un 504 del proxy) */
    }
    if (!resp.ok) throw mapHttpError(resp.status, json.error || raw.slice(0, 160))
    if (!json.dataUrl) {
      throw new PlotAiEnhanceError('no_image', 'PlotAI no devolvió una imagen. Probá de nuevo o seguí con la tuya.')
    }
    const result = await dataUrlToCanvas(json.dataUrl)

    // Gemini a veces cambia un poco las proporciones: si es poco, se recentra; si es mucho, se descarta.
    const want = source.width / source.height
    const got = result.width / result.height
    const diff = Math.abs(got - want) / want
    if (diff > 0.08) {
      throw new PlotAiEnhanceError(
        'no_image',
        'PlotAI devolvió la imagen con otras proporciones. Probá de nuevo o seguí con la tuya.'
      )
    }
    if (diff > 0.01) {
      const out = document.createElement('canvas')
      if (got > want) {
        out.height = result.height
        out.width = Math.round(result.height * want)
      } else {
        out.width = result.width
        out.height = Math.round(result.width / want)
      }
      const ctx = out.getContext('2d')
      if (ctx) {
        ctx.drawImage(
          result,
          (result.width - out.width) / 2,
          (result.height - out.height) / 2,
          out.width,
          out.height,
          0,
          0,
          out.width,
          out.height
        )
        return out
      }
    }
    return result
  } catch (e) {
    if (e instanceof PlotAiEnhanceError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (timedOut) {
        throw new PlotAiEnhanceError(
          'timeout',
          'PlotAI está tardando más de lo normal. Probá de nuevo o seguí con tu imagen.'
        )
      }
      throw new PlotAiEnhanceError('cancelled', 'Mejora cancelada.')
    }
    if (e instanceof TypeError) {
      throw new PlotAiEnhanceError('network', 'No hay conexión con PlotAI. Revisá internet y probá de nuevo.')
    }
    throw new PlotAiEnhanceError(
      'bad_response',
      e instanceof Error && e.message ? e.message : 'PlotAI tuvo un problema al mejorar la imagen.'
    )
  } finally {
    window.clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onExternalAbort)
  }
}
