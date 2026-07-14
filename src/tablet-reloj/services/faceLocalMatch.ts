import type { EmpleadoRelojTablet } from './relojTabletApi'

const MODEL_URI = '/models/face-api'
/** Distancia euclidiana máxima para aceptar match (face-api típico ~0.6). */
export const MATCH_MAX_DISTANCE = 0.55

export type FaceGalleryStats = {
  indexed: number
  failed: number
  total: number
}

export type FaceMatchHit = {
  id_usuario: number
  nombre: string
  distancia: number
  confianza: number
  foto_url: string
}

type GalleryEntry = {
  id_usuario: number
  nombre: string
  foto_url: string
  descriptor: Float32Array
}

type FaceApiModule = typeof import('@vladmandic/face-api')

let faceapi: FaceApiModule | null = null
let modelsReady = false
let modelsPromise: Promise<void> | null = null

const descriptorCache = new Map<string, Float32Array>()
let gallery: GalleryEntry[] = []
let gallerySignature = ''

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Confianza 0–100 a partir de distancia (mejor = más bajo). */
export function distanciaAConfianza(distancia: number): number {
  return Math.round(clamp(((0.6 - distancia) / 0.6) * 100, 0, 100))
}

export function legajoImageUrlForFace(url: string): string {
  let u = String(url || '').trim()
  if (!u) return u
  try {
    const parsed = new URL(u)
    parsed.searchParams.delete('v')
    u = parsed.toString()
  } catch {
    u = u.replace(/([?&])v=\d+/g, '').replace(/\?$/, '')
  }
  if (u.includes('/storage/v1/object/public/')) {
    const rendered = u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = rendered.includes('?') ? '&' : '?'
    return `${rendered}${sep}width=320&height=320&resize=contain&quality=75`
  }
  return u
}

async function loadFaceApi(): Promise<FaceApiModule> {
  if (faceapi) return faceapi
  faceapi = await import('@vladmandic/face-api')
  return faceapi
}

export async function ensureFaceModels(): Promise<void> {
  if (modelsReady) return
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const api = await loadFaceApi()
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        api.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
      ])
      modelsReady = true
    })().catch((e) => {
      modelsPromise = null
      modelsReady = false
      throw e
    })
  }
  await modelsPromise
}

function detectorOptions(api: FaceApiModule) {
  return new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
}

async function descriptorFromImageSource(
  api: FaceApiModule,
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<Float32Array | null> {
  const det = await api
    .detectSingleFace(source, detectorOptions(api))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return det?.descriptor ?? null
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const api = await loadFaceApi()
  return api.fetchImage(url)
}

async function descriptorFromFotoUrl(fotoUrl: string): Promise<Float32Array | null> {
  const key = fotoUrl.replace(/([?&])v=\d+/g, '').replace(/\?$/, '')
  const cached = descriptorCache.get(key)
  if (cached) return cached

  const candidates = [legajoImageUrlForFace(fotoUrl), key].filter(
    (u, i, arr) => u && arr.indexOf(u) === i
  )

  const api = await loadFaceApi()
  for (const u of candidates) {
    try {
      const img = await loadImageElement(u)
      const desc = await descriptorFromImageSource(api, img)
      if (desc) {
        descriptorCache.set(key, desc)
        return desc
      }
    } catch {
      /* try next url */
    }
  }
  return null
}

function employeeNombre(emp: EmpleadoRelojTablet): string {
  return (
    emp.nombre_completo?.trim() ||
    [emp.apellido, emp.nombre].filter(Boolean).join(', ') ||
    emp.login ||
    `Empleado ${emp.id_usuario}`
  )
}

function gallerySig(empleados: EmpleadoRelojTablet[]): string {
  return empleados
    .map((e) => `${e.id_usuario}:${(e.foto_url || '').trim()}`)
    .sort()
    .join('|')
}

export async function buildFaceGallery(
  empleados: EmpleadoRelojTablet[],
  onProgress?: (done: number, total: number) => void
): Promise<FaceGalleryStats> {
  await ensureFaceModels()

  const conFoto = empleados.filter((e) => Boolean(e.foto_url?.trim()))
  const sig = gallerySig(conFoto)
  if (sig === gallerySignature && gallery.length > 0) {
    return { indexed: gallery.length, failed: 0, total: conFoto.length }
  }

  const next: GalleryEntry[] = []
  let failed = 0
  let done = 0
  const total = conFoto.length

  for (const emp of conFoto) {
    const foto_url = String(emp.foto_url).trim()
    const descriptor = await descriptorFromFotoUrl(foto_url)
    done += 1
    onProgress?.(done, total)
    if (!descriptor) {
      failed += 1
      continue
    }
    next.push({
      id_usuario: emp.id_usuario,
      nombre: employeeNombre(emp),
      foto_url,
      descriptor
    })
  }

  gallery = next
  gallerySignature = sig
  return { indexed: gallery.length, failed, total }
}

export function getFaceGalleryCount(): number {
  return gallery.length
}

export async function matchSelfieDataUrl(
  dataUrl: string,
  maxDistance = MATCH_MAX_DISTANCE
): Promise<{ hit: FaceMatchHit | null; motivo?: string }> {
  await ensureFaceModels()
  if (!gallery.length) {
    return { hit: null, motivo: 'No hay rostros indexados. Revisá fotos de legajo.' }
  }

  const api = await loadFaceApi()
  let img: HTMLImageElement
  try {
    img = await api.fetchImage(dataUrl)
  } catch {
    return { hit: null, motivo: 'No se pudo leer la selfie capturada.' }
  }

  const query = await descriptorFromImageSource(api, img)
  if (!query) {
    return { hit: null, motivo: 'No se detectó un rostro. Mirá de frente a la cámara.' }
  }

  let best: GalleryEntry | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const entry of gallery) {
    const dist = api.euclideanDistance(query, entry.descriptor)
    if (dist < bestDist) {
      bestDist = dist
      best = entry
    }
  }

  if (!best || bestDist > maxDistance) {
    return {
      hit: null,
      motivo: best
        ? `Rostro no coincide lo suficiente (${best.nombre}, dist ${bestDist.toFixed(2)}). Mejorá luz o usá QR.`
        : 'No se reconoció a ningún empleado.'
    }
  }

  return {
    hit: {
      id_usuario: best.id_usuario,
      nombre: best.nombre,
      distancia: bestDist,
      confianza: distanciaAConfianza(bestDist),
      foto_url: best.foto_url
    }
  }
}

/** Detecta si hay un rostro en el video (para auto-scan). */
export async function hasFaceInVideo(video: HTMLVideoElement): Promise<boolean> {
  if (!modelsReady || video.readyState < 2 || video.videoWidth < 32) return false
  try {
    const api = await loadFaceApi()
    const det = await api.detectSingleFace(video, detectorOptions(api))
    return Boolean(det)
  } catch {
    return false
  }
}
