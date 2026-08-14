import type { EmpleadoRelojTablet } from './relojTabletApi'

const MODEL_URI = '/models/face-api'
/**
 * Distancia euclidiana máxima para aceptar match (estricto, 1 frame).
 * face-api típico ~0.6. Bajamos de 0.55 → 0.48: con umbral flojo se confundían
 * empleados parecidos (ej. Ivero vs Lolmos).
 */
export const MATCH_MAX_DISTANCE = 0.48
/**
 * Solo si el MISMO empleado gana en ≥2 frames, aceptamos hasta este tope.
 * Evita aflojar el umbral con un solo frame dudoso.
 */
export const MATCH_CONSENSUS_MAX_DISTANCE = 0.52
/**
 * Separación mínima entre el 1.º y el 2.º más cercano.
 * Sin esto, el “más cercano” gana aunque el 2.º esté a 0.01 (falso positivo).
 */
export const MATCH_MIN_TOP2_MARGIN = 0.08

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
    return `${rendered}${sep}width=448&height=448&resize=contain&quality=85`
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

type GalleryRank = {
  entry: GalleryEntry
  dist: number
  second: GalleryEntry | null
  secondDist: number
  margin: number
}

function topTwoGalleryMatch(api: FaceApiModule, query: Float32Array): GalleryRank | null {
  // Mejor distancia por empleado (varias fotos → min), después top-1 / top-2 entre personas.
  const bestByUser = new Map<number, { entry: GalleryEntry; dist: number }>()
  for (const entry of gallery) {
    const dist = api.euclideanDistance(query, entry.descriptor)
    const prev = bestByUser.get(entry.id_usuario)
    if (!prev || dist < prev.dist) bestByUser.set(entry.id_usuario, { entry, dist })
  }

  let best: { entry: GalleryEntry; dist: number } | null = null
  let second: { entry: GalleryEntry; dist: number } | null = null
  for (const row of bestByUser.values()) {
    if (!best || row.dist < best.dist) {
      second = best
      best = row
    } else if (!second || row.dist < second.dist) {
      second = row
    }
  }
  if (!best) return null
  const margin = second ? second.dist - best.dist : Number.POSITIVE_INFINITY
  return {
    entry: best.entry,
    dist: best.dist,
    second: second?.entry ?? null,
    secondDist: second?.dist ?? Number.POSITIVE_INFINITY,
    margin
  }
}

/** Acepta solo si está cerca Y claramente más cerca que el 2.º. */
function isConfidentMatch(
  rank: GalleryRank,
  maxDistance: number,
  minMargin = MATCH_MIN_TOP2_MARGIN
): boolean {
  if (rank.dist > maxDistance) return false
  if (!rank.second) return true
  return rank.margin >= minMargin
}

function ambiguousMotivo(rank: GalleryRank): string {
  if (rank.second && rank.margin < MATCH_MIN_TOP2_MARGIN) {
    return `Rostro ambiguo entre ${rank.entry.nombre} y ${rank.second.nombre} (margen ${rank.margin.toFixed(2)}). Mejorá luz o usá QR.`
  }
  return `Rostro no coincide lo suficiente (${rank.entry.nombre}, dist ${rank.dist.toFixed(2)}). Mejorá luz o usá QR.`
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

export function employeeFotoUrls(emp: {
  foto_url?: string | null
  fotos_extra?: string[] | null
}): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const push = (raw?: string | null) => {
    const u = String(raw || '').trim()
    if (!u) return
    const key = fotoKeyFromUrl(u)
    if (seen.has(key)) return
    seen.add(key)
    urls.push(u)
  }
  push(emp.foto_url)
  for (const extra of emp.fotos_extra || []) push(extra)
  return urls
}

export function gallerySigFromEmpleados(
  empleados: Array<{ id_usuario: number; foto_url?: string | null; fotos_extra?: string[] | null }>
): string {
  return empleados
    .map((e) => {
      const keys = employeeFotoUrls(e).map(fotoKeyFromUrl).sort().join(',')
      return keys ? `${e.id_usuario}:${keys}` : ''
    })
    .filter(Boolean)
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
 * Indexa fotos de legajo (+ extras) en este navegador (panel RRHH).
 * Puede generar varias entradas por empleado. No lo llama el kiosco en cada refresh.
 */
export async function buildFaceGallery(
  empleados: Array<EmpleadoRelojTablet & { fotos_extra?: string[] | null }>,
  onProgress?: (done: number, total: number) => void,
  options?: { onlyChangedKeys?: Set<string> }
): Promise<FaceGalleryStats & { records: FaceDescriptorRecord[] }> {
  await ensureFaceModels()

  const conFoto = empleados.filter((e) => employeeFotoUrls(e).length > 0)
  const onlyKeys = options?.onlyChangedKeys

  type Job = { emp: (typeof conFoto)[number]; foto_url: string; foto_key: string }
  const jobs: Job[] = []
  for (const emp of conFoto) {
    for (const foto_url of employeeFotoUrls(emp)) {
      const foto_key = fotoKeyFromUrl(foto_url)
      if (onlyKeys?.size && !onlyKeys.has(foto_key)) continue
      jobs.push({ emp, foto_url, foto_key })
    }
  }

  const keep: GalleryEntry[] = []
  if (onlyKeys?.size) {
    const currentKeys = new Set(conFoto.flatMap((e) => employeeFotoUrls(e).map(fotoKeyFromUrl)))
    for (const entry of gallery) {
      if (!currentKeys.has(entry.foto_key)) continue
      if (onlyKeys.has(entry.foto_key)) continue
      keep.push(entry)
    }
  }

  const nextByKey = new Map<string, GalleryEntry>()
  for (const entry of keep) nextByKey.set(entry.foto_key, entry)

  let failed = 0
  let done = 0
  const total = jobs.length || 1

  for (const job of jobs) {
    const descriptor = await descriptorFromFotoUrl(job.foto_url)
    done += 1
    onProgress?.(done, total)
    if (!descriptor) {
      failed += 1
      nextByKey.delete(job.foto_key)
      continue
    }
    nextByKey.set(job.foto_key, {
      id_usuario: job.emp.id_usuario,
      nombre: employeeNombre(job.emp),
      foto_url: job.foto_url,
      foto_key: job.foto_key,
      descriptor
    })
  }

  if (!onlyKeys?.size) {
    const keepKeys = new Set(conFoto.flatMap((e) => employeeFotoUrls(e).map(fotoKeyFromUrl)))
    for (const key of [...nextByKey.keys()]) {
      if (!keepKeys.has(key)) nextByKey.delete(key)
    }
  }

  gallery = [...nextByKey.values()]
  gallerySignature = gallerySigFromEmpleados(conFoto)

  const records: FaceDescriptorRecord[] = gallery.map((e) => ({
    id_usuario: e.id_usuario,
    nombre: e.nombre,
    foto_url: e.foto_url,
    foto_key: e.foto_key,
    descriptor: Array.from(e.descriptor)
  }))

  const personas = new Set(gallery.map((e) => e.id_usuario)).size
  return {
    indexed: personas,
    failed,
    total: conFoto.length,
    records
  }
}

/** Compara fotos actuales (legajo + extras) vs índice: cuántas faltan o cambiaron. */
export function countPendingFacialIndex(
  empleados: Array<{ id_usuario: number; foto_url?: string | null; fotos_extra?: string[] | null }>,
  indexed: Array<{ id_usuario: number; foto_key: string }>
): number {
  const indexedKeys = new Set(indexed.map((r) => r.foto_key))
  let pending = 0
  for (const e of empleados) {
    for (const url of employeeFotoUrls(e)) {
      if (!indexedKeys.has(fotoKeyFromUrl(url))) pending += 1
    }
  }
  // Fotos indexadas que ya no existen en el legajo/extras también cuentan como desfasadas
  const currentKeys = new Set(
    empleados.flatMap((e) => employeeFotoUrls(e).map(fotoKeyFromUrl))
  )
  for (const row of indexed) {
    if (!currentKeys.has(row.foto_key)) pending += 1
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

  const best = topTwoGalleryMatch(api, query)
  if (!best) {
    return { hit: null, motivo: 'No se reconoció a ningún empleado.' }
  }
  if (!isConfidentMatch(best, maxDistance)) {
    return { hit: null, motivo: ambiguousMotivo(best) }
  }

  return { hit: hitFromEntry(best.entry, best.dist) }
}

/**
 * Varios frames del video en vivo (sin JPEG).
 * - Acepta ya si un frame entra en umbral estricto (0.48) Y hay margen vs el 2.º.
 * - Zona gris (≤0.52): solo si el mismo id gana en ≥2 frames, también con margen.
 * Así no marcamos al “más cercano” cuando hay dos parecidos (Ivero/Lolmos).
 */
export async function matchFromVideoFrames(
  video: HTMLVideoElement,
  opts?: {
    maxDistance?: number
    consensusMaxDistance?: number
    minTop2Margin?: number
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
  const minMargin = opts?.minTop2Margin ?? MATCH_MIN_TOP2_MARGIN
  const attempts = Math.max(1, opts?.attempts ?? 4)
  const gapMs = opts?.gapMs ?? 280
  const api = await loadFaceApi()

  const votes = new Map<number, { entry: GalleryEntry; bestDist: number; count: number }>()
  let bestOverall: GalleryRank | null = null
  let sawFace = false
  let lastAmbiguous: GalleryRank | null = null
  let attemptsUsed = 0

  for (let i = 0; i < attempts; i++) {
    attemptsUsed = i + 1
    opts?.onAttempt?.(attemptsUsed, attempts)
    if (i > 0) await sleep(gapMs)

    const inputSize: 320 | 416 | 512 = i === 0 ? 416 : i === 1 ? 512 : 320
    const query = await descriptorFromImageSource(api, video, inputSize)
    if (!query) continue
    sawFace = true

    const best = topTwoGalleryMatch(api, query)
    if (!best) continue
    if (!bestOverall || best.dist < bestOverall.dist) bestOverall = best

    // Cerca del 2.º → no votar ni aceptar (evita swap entre parecidos)
    if (best.second && best.margin < minMargin) {
      lastAmbiguous = best
      continue
    }

    // Umbral estricto: un solo frame bueno + margen alcanza
    if (isConfidentMatch(best, maxDistance, minMargin)) {
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

  if (lastAmbiguous) {
    return { hit: null, motivo: ambiguousMotivo(lastAmbiguous), attemptsUsed }
  }

  if (!bestOverall) {
    return { hit: null, motivo: 'No se reconoció a ningún empleado.', attemptsUsed }
  }

  return {
    hit: null,
    motivo: ambiguousMotivo(bestOverall),
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
