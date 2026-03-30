import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  FLOTA_MAP_CENTER,
  FLOTA_MAP_ZOOM_CIUDAD,
  FLOTA_MAP_ZOOM_CERCA,
  flotaDistanciaKm
} from '../utils/flotaMapSanJuan'

// Vite + Leaflet: iconos por defecto
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

const SAN_JUAN: L.LatLngExpression = FLOTA_MAP_CENTER
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

type SalidaMapSearchHit = {
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
  const isAR = cc === 'ar' || country.includes('argentina')
  const isSanJuanProv = state.includes('san juan') || state.includes('s.juan')
  const dist = flotaDistanciaKm(REF_LAT, REF_LON, lat, lon)
  return (isAR ? 5000 : 0) + (isSanJuanProv ? 2500 : 0) - Math.min(dist, 8000)
}

async function fetchPhoton(q: string): Promise<PhotonFeature[]> {
  const [sjLat, sjLon] = FLOTA_MAP_CENTER
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lang=es&lat=${sjLat}&lon=${sjLon}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error en búsqueda')
  const data = (await res.json()) as PhotonResponse
  return data.features ?? []
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
  return withScore.map((x) => x.hit).slice(0, 10)
}

type SalidaMapPickerProps = {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
  height?: number
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

function Recenter({ center }: { center: L.LatLngExpression }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 14))
  }, [center, map])
  return null
}

export default function SalidaMapPicker({ lat, lng, onChange, height = 260 }: SalidaMapPickerProps) {
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<SalidaMapSearchHit[]>([])

  const center = useMemo<L.LatLngExpression>(() => {
    if (lat != null && lng != null) return [lat, lng]
    return SAN_JUAN
  }, [lat, lng])

  const runSearch = useCallback(async () => {
    const q = search.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    try {
      let features = await fetchPhoton(q)
      if (features.length === 0 && !/\b(argentina|san juan)\b/i.test(q)) {
        features = await fetchPhoton(`${q}, San Juan, Argentina`)
      }
      const hits = hitsFromFeatures(features)
      if (hits.length === 0) {
        setSearchError('No se encontró el lugar. Probá con calle y ciudad o otra redacción.')
        return
      }
      setResults(hits)
      const [first] = hits
      onChange(first.lat, first.lon)
    } catch {
      setSearchError('No se pudo buscar. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setSearching(false)
    }
  }, [onChange, search])

  const pickHit = useCallback(
    (h: SalidaMapSearchHit) => {
      onChange(h.lat, h.lon)
    },
    [onChange]
  )

  const hasPin = lat != null && lng != null

  return (
    <div className="salida-map-picker">
      <div className="salida-map-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en San Juan y zona (calle, barrio, localidad…)"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void runSearch())}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={results.length > 0 ? 'salida-map-search-results' : undefined}
        />
        <button type="button" className="btn-map-search" onClick={() => void runSearch()} disabled={searching}>
          {searching ? '…' : 'Buscar'}
        </button>
      </div>
      {searchError && <p className="salida-map-search-error">{searchError}</p>}
      {results.length > 0 && (
        <ul className="salida-map-results" id="salida-map-search-results" role="listbox" aria-label="Resultados">
          {results.map((h) => (
            <li key={h.id} role="option">
              <button type="button" className="salida-map-result-btn" onClick={() => pickHit(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="salida-map-hint">
        Elegí un resultado si hay varios. Tocá el mapa o arrastrá el marcador para afinar el punto.
      </p>
      <div className="salida-map-wrap" style={{ height }}>
        <MapContainer
          center={center}
          zoom={hasPin ? FLOTA_MAP_ZOOM_CERCA : FLOTA_MAP_ZOOM_CIUDAD}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onPick={onChange} />
          {hasPin && (
            <>
              <Recenter center={[lat!, lng!]} />
              <Marker
                position={[lat!, lng!]}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng()
                    onChange(m.lat, m.lng)
                  }
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
