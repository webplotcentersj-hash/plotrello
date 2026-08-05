import type { EmpleadoRelojTablet } from './relojTabletApi'

const MODEL_URI = '/models/face-api'
/**
 * Distancia euclidiana máxima para aceptar match (estricto, 1 frame).
 * face-api típico ~0.6; mantenemos 0.55 para no marcar a la persona equivocada.
 */
export const MATCH_MAX_DISTANCE = 0.55
/**
 * Solo si el MISMO empleado gana en ≥2 frames, aceptamos hasta este tope.
 * Evita aflojar el umbral con un solo frame dudoso.
 */
export const MATCH_CONSENSUS_MAX_DISTANCE = 0.58

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

export type FaceDescriptorRecord = {
  id_usuario: number
  nombre: string
  foto_url: string
  foto_key: string
  descriptor: number[]
}

type GalleryEntry = {
  id_usuario: number
  nombre: string
  foto_url: string
  foto_key: string
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

/** Confianza 0–100 a partir de distancia (mejor = más bajo). Escala al umbral actual. */
export function distanciaAConfianza(distancia: number): number {
  const span = MATCH_MAX_DISTANCE
  // En el umbral ~45%; match perfecto ~100%
  return Math.round(clamp(((span - distancia) / span) * 55 + 45, 0, 100))
}

export function fotoKeyFromUrl(fotoUrl: string): string {
  return String(fotoUrl || '')
    .trim()
    .replace(/([?&])v=\d+/g, '')
    .replace(/\?$/, '')
}

export function legajoImageUrlForFace(url: string): string {
  let u = String(url || '').trim()
  if (!u) return u
  try {
    const parsed = new URL(u)
    parsed.searchParams.delete('v')
    u = parsed.toString()
  } catch {
    u = fotoKeyFromUrl(u)
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

function detectorOptions(api: FaceApiModule, inputSize: 320 | 416 | 512 = 416) {
  return new api.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 })
}

async function descriptorFromImageSource(
  api: FaceApiModule,
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  inputSize: 320 | 416 | 512 = 416
): Promise<Float32Array | null> {
  const det = await api
    .detectSingleFace(source, detectorOptions(api, inputSize))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return det?.descriptor ?? null
}

function bestGalleryMatch(
  api: FaceApiModule,
  query: Float32Array
): { entry: GalleryEntry; dist: number } | null {
  let best: GalleryEntry | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const entry of gallery) {
    const dist = api.euclideanDistance(query, entry.descriptor)
    if (dist < bestDist) {
      bestDist = dist
      best = entry
    }
  }
  if (!best) return null
  return { entry: best, dist: bestDist }
}

function hitFromEntry(entry: GalleryEntry, dist: number): FaceMatchHit {
  return {
    id_usuario: entry.id_usuario,
    nombre: entry.nombre,
    distancia: dist,
    confianza: distanciaAConfianza(dist),
    foto_url: entry.foto_url
  }
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const api = await loadFaceApi()
  return api.fetchImage(url)
}

async function descriptorFromFotoUrl(fotoUrl: string): Promise<Float32Array | null> {
  const key = fotoKeyFromUrl(fotoUrl)
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

export function gallerySigFromEmpleados(empleados: EmpleadoRelojTablet[]): string {
  return empleados
    .filter((e) => Boolean(e.foto_url?.trim()))
    .map((e) => `${e.id_usuario}:${fotoKeyFromUrl(String(e.foto_url))}`)
    .sort()
    .join('|')
}

/** Carga índice guardado en servidor (kiosco). No procesa fotos. */
export function hydrateFaceGalleryFromRecords(records: FaceDescriptorRecord[]): FaceGalleryStats {
  const next: GalleryEntry[] = []
  for (const row of records) {
    if (!Array.isArray(row.descriptor) || row.descriptor.length < 64) continue
    const floats = Float32Array.from(row.descriptor.map(Number))
    if (floats.some((n) => !Number.isFinite(n))) continue
    const foto_url = String(row.foto_url || '').trim()
    const foto_key = String(row.foto_key || fotoKeyFromUrl(foto_url)).trim()
    next.push({
      id_usuario: Number(row.id_usuario),
      nombre: String(row.nombre || `Empleado ${row.id_usuario}`),
      foto_url,
      foto_key,
      descriptor: floats
    })
    if (foto_key) descriptorCache.set(foto_key, floats)
  }
  gallery = next
  gallerySignature = next
    .map((e) => `${e.id_usuario}:${e.foto_key}`)
    .sort()
    .join('|')
  return { indexed: gallery.length, failed: 0, total: gallery.length }
}

export function getFaceGalleryCount(): number {
  return gallery.length
}

export function getFaceGallerySignature(): string {
  return gallerySignature
}

/**
 * Indexa fotos de legajo en este navegador (panel RRHH).
 * No lo llama el kiosco en cada refresh.
 */
export async function buildFaceGallery(
  empleados: EmpleadoRelojTablet[],
  onProgress?: (done: number, total: number) => void,
  options?: { onlyChangedKeys?: Set<string> }
): Promise<FaceGalleryStats & { records: FaceDescriptorRecord[] }> {
  await ensureFaceModels()

  const conFoto = empleados.filter((e) => Boolean(e.foto_url?.trim()))
  const onlyKeys = options?.onlyChangedKeys
  const toProcess = onlyKeys?.size
    ? conFoto.filter((e) => onlyKeys.has(fotoKeyFromUrl(String(e.foto_url))))
    : conFoto

  const keepById = new Map<number, GalleryEntry>()
  if (onlyKeys?.size) {
    for (const entry of gallery) {
      const emp = conFoto.find((e) => e.id_usuario === entry.id_usuario)
      if (!emp) continue
      const key = fotoKeyFromUrl(String(emp.foto_url))
      if (entry.foto_key === key && !onlyKeys.has(key)) {
        keepById.set(entry.id_usuario, entry)
      }
    }
  }

  const next = new Map<number, GalleryEntry>(keepById)
  let failed = 0
  let done = 0
  const total = toProcess.length

  for (const emp of toProcess) {
    const foto_url = String(emp.foto_url).trim()
    const foto_key = fotoKeyFromUrl(foto_url)
    const descriptor = await descriptorFromFotoUrl(foto_url)
    done += 1
    onProgress?.(done, total)
    if (!descriptor) {
      failed += 1
      next.delete(emp.id_usuario)
      continue
    }
    next.set(emp.id_usuario, {
      id_usuario: emp.id_usuario,
      nombre: employeeNombre(emp),
      foto_url,
      foto_key,
      descriptor
    })
  }

  // Full rebuild: drop anyone not in current conFoto
  if (!onlyKeys?.size) {
    for (const id of [...next.keys()]) {
      if (!conFoto.some((e) => e.id_usuario === id)) next.delete(id)
    }
  } else {
    for (const emp of conFoto) {
      if (!next.has(emp.id_usuario) && !onlyKeys.has(fotoKeyFromUrl(String(emp.foto_url)))) {
        /* keep unchanged already in next via keepById */
      }
    }
  }

  gallery = [...next.values()]
  gallerySignature = gallerySigFromEmpleados(conFoto)

  const records: FaceDescriptorRecord[] = gallery.map((e) => ({
    id_usuario: e.id_usuario,
    nombre: e.nombre,
    foto_url: e.foto_url,
    foto_key: e.foto_key,
    descriptor: Array.from(e.descriptor)
  }))

  return {
    indexed: gallery.length,
    failed,
    total: conFoto.length,
    records
  }
}

/** Compara fotos actuales vs índice guardado: cuántas faltan o cambiaron. */
export function countPendingFacialIndex(
  empleados: Array<{ id_usuario: number; foto_url?: string | null }>,
  indexed: Array<{ id_usuario: number; foto_key: string }>
): number {
  const byId = new Map(indexed.map((r) => [r.id_usuario, r.foto_key]))
  let pending = 0
  for (const e of empleados) {
    const url = e.foto_url?.trim()
    if (!url) continue
    const key = fotoKeyFromUrl(url)
    if (byId.get(e.id_usuario) !== key) pending += 1
  }
  return pending
}

export async function matchSelfieDataUrl(
  dataUrl: string,
  maxDistance = MATCH_MAX_DISTANCE
): Promise<{ hit: FaceMatchHit | null; motivo?: string }> {
  await ensureFaceModels()
  if (!gallery.length) {
    return {
      hit: null,
      motivo: 'No hay índice facial. En RRHH → Reloj facial usá “Indexar rostros”.'
    }
  }

  const api = await loadFaceApi()
  let img: HTMLImageElement
  try {
    img = await api.fetchImage(dataUrl)
  } catch {
    return { hit: null, motivo: 'No se pudo leer la selfie capturada.' }
  }

  const query = await descriptorFromImageSource(api, img, 416)
  if (!query) {
    return { hit: null, motivo: 'No se detectó un rostro. Mirá de frente a la cámara.' }
  }

  const best = bestGalleryMatch(api, query)
  if (!best || best.dist > maxDistance) {
    return {
      hit: null,
      motivo: best
        ? `Rostro no coincide lo suficiente (${best.entry.nombre}, dist ${best.dist.toFixed(2)}). Mejorá luz o usá QR.`
        : 'No se reconoció a ningún empleado.'
    }
  }

  return { hit: hitFromEntry(best.entry, best.dist) }
}

/**
 * Varios frames del video en vivo (sin JPEG).
 * - Acepta ya si un frame entra en umbral estricto (0.55).
 * - Si queda en zona gris (≤0.58), solo acepta si el mismo id gana en ≥2 frames.
 * Así no aflojamos el umbral con un único frame dudoso.
 */
export async function matchFromVideoFrames(
  video: HTMLVideoElement,
  opts?: {
    maxDistance?: number
    consensusMaxDistance?: number
    attempts?: number
    gapMs?: number
    onAttempt?: (n: number, total: number) => void
  }
): Promise<{ hit: FaceMatchHit | null; motivo?: string; attemptsUsed: number }> {
  await ensureFaceModels()
  if (!gallery.length) {
    return {
      hit: null,
      motivo: 'No hay índice facial. En RRHH → Reloj facial usá “Indexar rostros”.',
      attemptsUsed: 0
    }
  }
  if (video.readyState < 2 || video.videoWidth < 32) {
    return {
      hit: null,
      motivo: 'La cámara todavía no está lista. Esperá un segundo.',
      attemptsUsed: 0
    }
  }

  const maxDistance = opts?.maxDistance ?? MATCH_MAX_DISTANCE
  const consensusMax = opts?.consensusMaxDistance ?? MATCH_CONSENSUS_MAX_DISTANCE
  const attempts = Math.max(1, opts?.attempts ?? 3)
  const gapMs = opts?.gapMs ?? 280
  const api = await loadFaceApi()

  const votes = new Map<number, { entry: GalleryEntry; bestDist: number; count: number }>()
  let bestOverall: { entry: GalleryEntry; dist: number } | null = null
  let sawFace = false
  let attemptsUsed = 0

  for (let i = 0; i < attempts; i++) {
    attemptsUsed = i + 1
    opts?.onAttempt?.(attemptsUsed, attempts)
    if (i > 0) await sleep(gapMs)

    const inputSize: 320 | 416 | 512 = i === 0 ? 416 : i === 1 ? 512 : 320
    const query = await descriptorFromImageSource(api, video, inputSize)
    if (!query) continue
    sawFace = true

    const best = bestGalleryMatch(api, query)
    if (!best) continue
    if (!bestOverall || best.dist < bestOverall.dist) bestOverall = best

    // Umbral estricto: un solo frame bueno alcanza
    if (best.dist <= maxDistance) {
      return { hit: hitFromEntry(best.entry, best.dist), attemptsUsed }
    }

    if (best.dist <= consensusMax) {
      const prev = votes.get(best.entry.id_usuario)
      if (prev) {
        prev.count += 1
        if (best.dist < prev.bestDist) prev.bestDist = best.dist
      } else {
        votes.set(best.entry.id_usuario, {
          entry: best.entry,
          bestDist: best.dist,
          count: 1
        })
      }
      const voted = votes.get(best.entry.id_usuario)!
      if (voted.count >= 2) {
        return { hit: hitFromEntry(voted.entry, voted.bestDist), attemptsUsed }
      }
    }
  }

  if (!sawFace) {
    return {
      hit: null,
      motivo: 'No se detectó un rostro. Mirá de frente a la cámara.',
      attemptsUsed
    }
  }

  if (!bestOverall) {
    return { hit: null, motivo: 'No se reconoció a ningún empleado.', attemptsUsed }
  }

  return {
    hit: null,
    motivo: `Rostro no coincide lo suficiente (${bestOverall.entry.nombre}, dist ${bestOverall.dist.toFixed(2)}). Mejorá luz o usá QR.`,
    attemptsUsed
  }
}

/** Detecta si hay un rostro en el video (para auto-scan). */
export async function hasFaceInVideo(video: HTMLVideoElement): Promise<boolean> {
  if (!modelsReady || video.readyState < 2 || video.videoWidth < 32) return false
  try {
    const api = await loadFaceApi()
    const det = await api.detectSingleFace(video, detectorOptions(api, 320))
    return Boolean(det)
  } catch {
    return false
  }
}
