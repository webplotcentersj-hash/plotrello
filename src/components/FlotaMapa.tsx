import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type { RegistroSalidaVehiculo } from '../types/api'
import { FLOTA_MAP_CENTER, FLOTA_MAP_ZOOM_CIUDAD } from '../utils/flotaMapSanJuan'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import './FlotaMapa.css'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

const SAN_JUAN: L.LatLngExpression = FLOTA_MAP_CENTER

/** Un DivIcon por instancia de mapa: compartir el mismo entre dos MapContainer rompe el DOM de Leaflet. */
function crearIconosLuz() {
  return {
    ok: L.divIcon({
      className: 'flota-marker-divicon',
      html: '<div class="flota-marker-luz flota-marker-luz--ok"><span class="flota-marker-luz-core"></span></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -16]
    }),
    warn: L.divIcon({
      className: 'flota-marker-divicon',
      html: '<div class="flota-marker-luz flota-marker-luz--warn"><span class="flota-marker-luz-core"></span></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -16]
    })
  }
}

function MapInvalidateSize() {
  const map = useMap()
  useEffect(() => {
    let alive = true
    const safeInvalidate = () => {
      if (!alive) return
      try {
        const el = map?.getContainer?.()
        if (!el?.isConnected) return
        map.invalidateSize({ animate: false })
      } catch {
        /* mapa ya desmontado */
      }
    }
    const t = window.setTimeout(safeInvalidate, 50)
    window.addEventListener('resize', safeInvalidate)
    return () => {
      alive = false
      window.clearTimeout(t)
      window.removeEventListener('resize', safeInvalidate)
    }
  }, [map])
  return null
}

type FlotaMapaProps = {
  registros: RegistroSalidaVehiculo[]
  /** Altura en px, o cadena CSS (ej. `100%`) si el contenedor padre tiene alto definido */
  height?: number | string
  /** Sin bordes redondeados (p. ej. pantalla completa) */
  square?: boolean
  /** Marcadores con brillo pulsante (p. ej. mapa grande / monitor) */
  marcadoresLuz?: boolean
  className?: string
}

export default function FlotaMapa({
  registros,
  height = 360,
  square = false,
  marcadoresLuz = false,
  className
}: FlotaMapaProps) {
  const puntos = useMemo(
    () =>
      registros.filter(
        (r) =>
          r.latitud != null &&
          r.longitud != null &&
          (r.estado === 'en_uso' || r.estado === 'retrasado')
      ),
    [registros]
  )

  const center = useMemo(() => {
    if (puntos.length === 0) return SAN_JUAN
    const la = puntos.reduce((s, r) => s + Number(r.latitud), 0) / puntos.length
    const lo = puntos.reduce((s, r) => s + Number(r.longitud), 0) / puntos.length
    return [la, lo] as L.LatLngExpression
  }, [puntos])

  const iconosLuz = useMemo(() => crearIconosLuz(), [])

  /** Evita montar Leaflet en el primer ciclo de React Strict Mode (deja el mapa sin contenedor válido). */
  const [mapaMontar, setMapaMontar] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMapaMontar(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const h = typeof height === 'number' ? `${height}px` : height
  const wrapClass = ['flota-mapa-leaflet', className, square ? 'flota-mapa-leaflet--square' : '']
    .filter(Boolean)
    .join(' ')

  if (!mapaMontar) {
    return (
      <div
        className={wrapClass}
        style={{ height: h, borderRadius: square ? 0 : 12, overflow: 'hidden' }}
        aria-hidden
      >
        <div className="flota-mapa-placeholder" />
      </div>
    )
  }

  return (
    <div
      className={wrapClass}
      style={{ height: h, borderRadius: square ? 0 : 12, overflow: 'hidden' }}
    >
      <MapContainer
        center={center}
        zoom={puntos.length ? 11 : FLOTA_MAP_ZOOM_CIUDAD}
        style={{ height: '100%', width: '100%' }}
      >
        <MapInvalidateSize />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {puntos.map((r) => (
          <Marker
            key={r.id}
            position={[Number(r.latitud), Number(r.longitud)]}
            icon={
              marcadoresLuz
                ? r.estado === 'retrasado'
                  ? iconosLuz.warn
                  : iconosLuz.ok
                : undefined
            }
          >
            <Popup className="flota-viaje-popup">
              <div className="flota-viaje-popup-inner">
                <strong>{r.vehiculo?.nombre ?? 'Vehículo'}</strong>
                <br />
                {etiquetaUsuarioNombre(r.nombre_usuario)} · {r.sector}
              <br />
              {r.numero_op && <>OP {r.numero_op}<br /></>}
              {r.hora_estimada_llegada && (
                <>
                  Llegada est.:{' '}
                  {new Date(r.hora_estimada_llegada).toLocaleString('es-AR')}
                </>
              )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
