import { decodificarRgba } from './decodificador'

export class ErrorCamara extends Error {}

export type Escaner = {
  motor: 'nativo' | 'zxing'
  linternaDisponible: boolean
  pausar(): void
  reanudar(): void
  alternarLinterna(): Promise<boolean>
  detener(): void
}

type DetectorNativo = { detect(fuente: CanvasImageSource): Promise<Array<{ rawValue: string }>> }
type ConstructorDetector = {
  new (opciones: { formats: string[] }): DetectorNativo
  getSupportedFormats(): Promise<string[]>
}

const ANCHO_MAX_VIDEO = 1280
const PAUSA_ENTRE_LECTURAS_MS = 140

const esperar = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

// Chrome en Android trae un detector nativo (mucho más rápido con códigos chicos); iOS Safari no.
async function crearDetectorNativo(): Promise<DetectorNativo | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector
  if (!Ctor) return null
  try {
    const formatos = await Ctor.getSupportedFormats()
    return formatos.includes('itf') ? new Ctor({ formats: ['itf'] }) : null
  } catch {
    return null
  }
}

function mensajeError(e: unknown): string {
  const nombre = e instanceof DOMException ? e.name : ''
  if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError') {
    return 'Permiso de cámara denegado. Habilitalo en los ajustes del navegador para este sitio y tocá "Activar cámara".'
  }
  if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError') {
    return 'Este dispositivo no tiene una cámara disponible.'
  }
  if (nombre === 'NotReadableError') return 'Otra app está usando la cámara. Cerrala y tocá "Activar cámara".'
  return 'No se pudo iniciar la cámara.'
}

async function abrirCamara(): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new ErrorCamara('La cámara solo funciona con HTTPS. Abrí la app desde su dirección segura (https://…).')
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'OverconstrainedError') {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
      } catch (e2) {
        throw new ErrorCamara(mensajeError(e2))
      }
    }
    throw new ErrorCamara(mensajeError(e))
  }
}

/** Abre la cámara trasera en `video` y llama a `alLeer` con el texto de cada código ITF que detecta. */
export async function iniciarEscaner(video: HTMLVideoElement, alLeer: (texto: string) => void): Promise<Escaner> {
  const stream = await abrirCamara()
  video.srcObject = stream
  try {
    await video.play()
  } catch {
    stream.getTracks().forEach((t) => t.stop())
    throw new ErrorCamara('No se pudo mostrar la imagen de la cámara.')
  }

  const pista = stream.getVideoTracks()[0]
  try {
    await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)
  } catch {
    // sin enfoque continuo: se sigue con el automático del dispositivo
  }
  const capacidades = (pista.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
  let linterna = false

  let nativo = await crearDetectorNativo()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  async function leerCuadro(): Promise<string | null> {
    if (nativo) {
      try {
        const r = await nativo.detect(video)
        return r[0]?.rawValue ?? null
      } catch {
        nativo = null // el detector nativo falló: se sigue con ZXing
      }
    }
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh || !ctx) return null
    const k = Math.min(1, ANCHO_MAX_VIDEO / vw)
    canvas.width = Math.round(vw * k)
    canvas.height = Math.round(vh * k)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return decodificarRgba(data, canvas.width, canvas.height)
  }

  let activo = true
  let pausado = false
  void (async () => {
    while (activo) {
      if (!pausado && video.readyState >= 2) {
        try {
          const texto = await leerCuadro()
          if (texto && activo && !pausado) alLeer(texto)
        } catch {
          // un cuadro ilegible no corta el escaneo
        }
      }
      await esperar(PAUSA_ENTRE_LECTURAS_MS)
    }
  })()

  return {
    get motor() {
      return nativo ? 'nativo' : 'zxing'
    },
    linternaDisponible: Boolean(capacidades.torch),
    pausar() {
      pausado = true
    },
    reanudar() {
      pausado = false
    },
    async alternarLinterna() {
      linterna = !linterna
      await pista.applyConstraints({ advanced: [{ torch: linterna }] } as unknown as MediaTrackConstraints)
      return linterna
    },
    detener() {
      activo = false
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
  }
}

/** Busca el código en una foto (por ejemplo, de la factura impresa). Prueba varios tamaños. */
export async function leerImagen(archivo: File): Promise<string | null> {
  const bmp = await createImageBitmap(archivo)
  try {
    const detector = await crearDetectorNativo()
    if (detector) {
      try {
        const r = await detector.detect(bmp)
        if (r[0]) return r[0].rawValue
      } catch {
        // se sigue con ZXing
      }
    }
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    // De menor a mayor: una foto nítida se resuelve rápido y solo se paga la resolución alta si hace falta.
    const anchos = [...new Set([1280, 2000, 3200].map((a) => Math.min(a, bmp.width)))]
    for (const ancho of anchos) {
      await esperar(0) // deja repintar el mensaje de "Analizando…" entre intentos pesados
      const k = ancho / bmp.width
      canvas.width = ancho
      canvas.height = Math.round(bmp.height * k)
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const texto = decodificarRgba(data, canvas.width, canvas.height)
      if (texto) return texto
    }
    return null
  } finally {
    bmp.close()
  }
}
