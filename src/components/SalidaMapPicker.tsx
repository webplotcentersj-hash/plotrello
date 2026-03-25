import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { FLOTA_MAP_CENTER, FLOTA_MAP_ZOOM_CIUDAD, FLOTA_MAP_ZOOM_CERCA } from '../utils/flotaMapSanJuan'

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

export default function SalidaMapPicker({ lat, lng, onChange, height = 260 }: SalidaMapPickerProps) {
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const center = useMemo<L.LatLngExpression>(() => {
    if (lat != null && lng != null) return [lat, lng]
    return SAN_JUAN
  }, [lat, lng])

  const runSearch = useCallback(async () => {
    const q = search.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    try {
      const [sjLat, sjLon] = FLOTA_MAP_CENTER
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=es&lat=${sjLat}&lon=${sjLon}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error en búsqueda')
      const data = (await res.json()) as {
        features?: Array<{ geometry: { coordinates: [number, number] } }>
      }
      const f = data.features?.[0]
      if (!f?.geometry?.coordinates) {
        setSearchError('No se encontró el lugar. Probá otra dirección.')
        return
      }
      const [lon, la] = f.geometry.coordinates
      onChange(la, lon)
    } catch {
      setSearchError('No se pudo buscar. Intentá de nuevo.')
    } finally {
      setSearching(false)
    }
  }, [onChange, search])

  const hasPin = lat != null && lng != null

  return (
    <div className="salida-map-picker">
      <div className="salida-map-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en San Juan y zona (dirección, barrio, localidad…)"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void runSearch())}
        />
        <button type="button" className="btn-map-search" onClick={() => void runSearch()} disabled={searching}>
          {searching ? '…' : 'Buscar'}
        </button>
      </div>
      {searchError && <p className="salida-map-search-error">{searchError}</p>}
      <p className="salida-map-hint">Tocá el mapa o arrastrá el marcador para ajustar el punto de salida.</p>
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
