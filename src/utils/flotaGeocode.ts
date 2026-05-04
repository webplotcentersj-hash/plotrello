/**
 * Geocodificación para Flota (Photon + Nominatim), priorizando San Juan, AR.
 * Extraído para reutilizar en el mapa de salida y en "Ubicación desde OP".
 */
import {
  FLOTA_MAP_CENTER,
  FLOTA_SEARCH_BBOX,
  flotaDistanciaKm
} from './flotaMapSanJuan'

const [REF_LAT, REF_LON] = FLOTA_MAP_CENTER

type PhotonGeometry = {
  type: string
  coordinates?: unknown
}

type PhotonProperties = {
  name?: string
  street?: string
  housenumber?: string
  city?: string
  district?: string
  locality?: string
  state?: string
  county?: string
  country?: string
  countrycode?: string
}

type PhotonFeature = {
  geometry?: PhotonGeometry
  properties?: PhotonProperties
}

type PhotonResponse = {
  features?: PhotonFeature[]
}

export type SalidaMapSearchHit = {
  id: string
  label: string
  lat: number
  lon: number
}

function coordsFromFeature(f: PhotonFeature): [number, number] | null {
  const g = f.geometry
  if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null
  const c = g.coordinates as [number, number]
  if (c.length < 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number') return null
  const [lon, lat] = c
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return [lat, lon]
}

function formatPhotonLabel(p: PhotonProperties | undefined): string {
  if (!p) return 'Ubicación'
  const name = (p.name ?? '').trim()
  const street = (p.street ?? '').trim()
  const hn = (p.housenumber ?? '').trim()
  const city = (p.city ?? p.district ?? p.locality ?? '').trim()
  const state = (p.state ?? p.county ?? '').trim()
  const country = (p.country ?? '').trim()
  const line1 =
    street && hn ? `${street} ${hn}`.trim() : street ? street : name ? name : ''
  const parts = [line1, city, state, country].filter((x) => x.length > 0)
  return parts.join(', ') || 'Ubicación'
}

function scoreHit(lat: number, lon: number, p: PhotonProperties | undefined): number {
  const cc = (p?.countrycode ?? '').toLowerCase()
  const country = (p?.country ?? '').toLowerCase()
  const state = `${p?.state ?? ''} ${p?.county ?? ''}`.toLowerCase()
  const cityBlob = `${p?.city ?? ''} ${p?.district ?? ''} ${p?.locality ?? ''} ${p?.name ?? ''}`.toLowerCase()
  const isAR = cc === 'ar' || country.includes('argentina')
  const isSanJuanProv =
    state.includes('san juan') ||
    state.includes('s.juan') ||
    cityBlob.includes('san juan') ||
    cityBlob.includes('rawson') ||
    cityBlob.includes('rivadavia') ||
    cityBlob.includes('pocito') ||
    cityBlob.includes('chimbas') ||
    cityBlob.includes('santa lucía')
  const dist = flotaDistanciaKm(REF_LAT, REF_LON, lat, lon)
  return (isAR ? 8000 : 0) + (isSanJuanProv ? 5000 : 0) - Math.min(dist, 12000)
}

function mergePhotonFeatures(a: PhotonFeature[], b: PhotonFeature[]): PhotonFeature[] {
  const seen = new Set<string>()
  const out: PhotonFeature[] = []
  for (const list of [a, b]) {
    for (const f of list) {
      const pair = coordsFromFeature(f)
      if (!pair) continue
      const key = `${pair[0].toFixed(4)}_${pair[1].toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(f)
    }
  }
  return out
}

async function fetchPhoton(q: string, opts: { bbox: boolean }): Promise<PhotonFeature[]> {
  const [sjLat, sjLon] = FLOTA_MAP_CENTER
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=18&lang=es&lat=${sjLat}&lon=${sjLon}`
  if (opts.bbox) {
    url += `&bbox=${encodeURIComponent(FLOTA_SEARCH_BBOX)}`
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error en búsqueda')
  const data = (await res.json()) as PhotonResponse
  return data.features ?? []
}

type NominatimHit = { lat: string; lon: string; display_name: string }

function nominatimViewbox(): string {
  const p = FLOTA_SEARCH_BBOX.split(',').map((x) => x.trim())
  if (p.length !== 4) return FLOTA_SEARCH_BBOX
  const [minLon, minLat, maxLon, maxLat] = p
  return `${minLon},${maxLat},${maxLon},${minLat}`
}

async function fetchNominatimSanJuan(q: string): Promise<SalidaMapSearchHit[]> {
  const query = /\b(argentina|san juan)\b/i.test(q) ? q.trim() : `${q.trim()}, San Juan, Argentina`

  const request = async (bounded: boolean): Promise<SalidaMapSearchHit[]> => {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '12',
      countrycodes: 'ar',
      'accept-language': 'es'
    })
    if (bounded) {
      params.set('viewbox', nominatimViewbox())
      params.set('bounded', '1')
    }
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PlotrelloFlota/1.0 (https://plotrello.vercel.app; flota ubicación)'
      }
    })
    if (!res.ok) return []
    const data = (await res.json()) as NominatimHit[]
    if (!Array.isArray(data)) return []
    return data
      .map((item, i) => {
        const lat = parseFloat(item.lat)
        const lon = parseFloat(item.lon)
        return {
          id: `n-${i}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
          label: item.display_name || 'Ubicación',
          lat,
          lon
        }
      })
      .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon))
  }

  let hits = await request(true)
  if (hits.length === 0) {
    hits = await request(false)
  }
  return sortHitsByDistance(hits)
}

function sortHitsByDistance(hits: SalidaMapSearchHit[]): SalidaMapSearchHit[] {
  return [...hits].sort((a, b) => {
    const da = flotaDistanciaKm(REF_LAT, REF_LON, a.lat, a.lon)
    const db = flotaDistanciaKm(REF_LAT, REF_LON, b.lat, b.lon)
    return da - db
  })
}

function hitsFromFeatures(features: PhotonFeature[]): SalidaMapSearchHit[] {
  const withScore: Array<{ hit: SalidaMapSearchHit; sc: number }> = []
  let n = 0
  for (const f of features) {
    const pair = coordsFromFeature(f)
    if (!pair) continue
    const [lat, lon] = pair
    const hit: SalidaMapSearchHit = {
      id: `p-${n++}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      label: formatPhotonLabel(f.properties),
      lat,
      lon
    }
    withScore.push({ hit, sc: scoreHit(lat, lon, f.properties) })
  }
  withScore.sort((a, b) => b.sc - a.sc)
  return withScore.map((x) => x.hit).slice(0, 12)
}

function dedupeHits(hits: SalidaMapSearchHit[]): SalidaMapSearchHit[] {
  const seen = new Set<string>()
  const out: SalidaMapSearchHit[] = []
  for (const h of hits) {
    const k = `${h.lat.toFixed(4)}_${h.lon.toFixed(4)}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(h)
  }
  return out
}

export type RunCombinedSalidaSearchOpts = {
  /** Si true, siempre consulta Nominatim además de Photon (útil para direcciones de OP / geocodificar texto). */
  alwaysMergeNominatim?: boolean
}

/**
 * Búsqueda combinada (Photon en paralelo + Nominatim), ordenada por cercanía a San Juan capital.
 */
export async function runCombinedSalidaSearch(
  qRaw: string,
  opts?: RunCombinedSalidaSearchOpts
): Promise<{
  hits: SalidaMapSearchHit[]
  error: string | null
}> {
  const q = qRaw.trim()
  if (!q) return { hits: [], error: null }

  try {
    const [bbox, wide] = await Promise.all([fetchPhoton(q, { bbox: true }), fetchPhoton(q, { bbox: false })])
    let features = mergePhotonFeatures(bbox, wide)

    if (features.length < 6 && !/\b(argentina|san juan)\b/i.test(q)) {
      const q2 = `${q}, San Juan, Argentina`
      const [b2, w2] = await Promise.all([fetchPhoton(q2, { bbox: true }), fetchPhoton(q2, { bbox: false })])
      features = mergePhotonFeatures(features, mergePhotonFeatures(b2, w2))
    }

    let photonHits = hitsFromFeatures(features)
    let nominatimHits: SalidaMapSearchHit[] = []
    const needNominatim = opts?.alwaysMergeNominatim === true || photonHits.length < 8
    if (needNominatim) {
      try {
        nominatimHits = await fetchNominatimSanJuan(q)
      } catch {
        /* Nominatim opcional si falla red / CORS en algún entorno */
      }
    }

    const merged = dedupeHits([...photonHits, ...nominatimHits])
    const hits = sortHitsByDistance(merged).slice(0, 15)

    if (hits.length === 0) {
      return {
        hits: [],
        error:
          'No se encontró el lugar. Probá con calle y número, barrio o localidad (ej. Rawson, Pocito, Rivadavia).'
      }
    }
    return { hits, error: null }
  } catch {
    return { hits: [], error: 'No se pudo buscar. Revisá tu conexión e intentá de nuevo.' }
  }
}

/** Primer resultado para rellenar el mapa desde una dirección de OP (sin UI). */
export async function geocodeFirstHitSanJuan(direccion: string): Promise<{ lat: number; lon: number } | null> {
  const d = direccion.trim()
  if (!d) return null
  const { hits } = await runCombinedSalidaSearch(d, { alwaysMergeNominatim: true })
  if (hits.length === 0) return null
  return { lat: hits[0].lat, lon: hits[0].lon }
}
