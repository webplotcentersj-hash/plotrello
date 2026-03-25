import { useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type { RegistroSalidaVehiculo } from '../types/api'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

const BA: L.LatLngExpression = [-34.6037, -58.3816]

type FlotaMapaProps = {
  registros: RegistroSalidaVehiculo[]
  height?: number
}

export default function FlotaMapa({ registros, height = 360 }: FlotaMapaProps) {
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
    if (puntos.length === 0) return BA
    const la = puntos.reduce((s, r) => s + Number(r.latitud), 0) / puntos.length
    const lo = puntos.reduce((s, r) => s + Number(r.longitud), 0) / puntos.length
    return [la, lo] as L.LatLngExpression
  }, [puntos])

  return (
    <div className="flota-mapa-leaflet" style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={puntos.length ? 11 : 12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {puntos.map((r) => (
          <Marker key={r.id} position={[Number(r.latitud), Number(r.longitud)]}>
            <Popup>
              <strong>{r.vehiculo?.nombre ?? 'Vehículo'}</strong>
              <br />
              {r.nombre_usuario} · {r.sector}
              <br />
              {r.numero_op && <>OP {r.numero_op}<br /></>}
              {r.hora_estimada_llegada && (
                <>
                  Llegada est.:{' '}
                  {new Date(r.hora_estimada_llegada).toLocaleString('es-AR')}
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
