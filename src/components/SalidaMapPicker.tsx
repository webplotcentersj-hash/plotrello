import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  FLOTA_MAP_CENTER,
  FLOTA_MAP_ZOOM_CIUDAD,
  FLOTA_MAP_ZOOM_CERCA
} from '../utils/flotaMapSanJuan'
import { runCombinedSalidaSearch, type SalidaMapSearchHit } from '../utils/flotaGeocode'

// Vite + Leaflet: iconos por defecto
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

const SAN_JUAN: L.LatLngExpression = FLOTA_MAP_CENTER

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

const SEARCH_DEBOUNCE_MS = 480
const MIN_CHARS_AUTOBUSCAR = 3

export default function SalidaMapPicker({ lat, lng, onChange, height = 260 }: SalidaMapPickerProps) {
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<SalidaMapSearchHit[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const center = useMemo<L.LatLngExpression>(() => {
    if (lat != null && lng != null) return [lat, lng]
    return SAN_JUAN
  }, [lat, lng])

  const runSearch = useCallback(async () => {
    const q = search.trim()
    if (q.length < 2) {
      setSearchError('Escribí al menos 2 caracteres para buscar.')
      return
    }
    setSearching(true)
    setSearchError(null)
    setResults([])
    try {
      const { hits, error } = await runCombinedSalidaSearch(q)
      if (error) {
        setSearchError(error)
        return
      }
      setResults(hits)
      if (hits.length === 1) {
        onChange(hits[0].lat, hits[0].lon)
      }
    } finally {
      setSearching(false)
    }
  }, [onChange, search])

  const runSearchRef = useRef(runSearch)
  runSearchRef.current = runSearch

  useEffect(() => {
    const q = search.trim()
    if (q.length < MIN_CHARS_AUTOBUSCAR) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void runSearchRef.current()
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

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
          placeholder="Calle, barrio o localidad (San Juan) — se busca al escribir o con Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                debounceRef.current = null
              }
              void runSearch()
            }
          }}
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
        Se combinan varias fuentes y se ordenan por cercanía a San Juan. Si hay un solo resultado, el marcador se
        coloca solo; si hay varios, elegí uno. También podés tocar el mapa o arrastrar el pin.
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
