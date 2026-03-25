import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { Vehiculo, RegistroSalidaVehiculo } from '../types/api'
import { sectorDesdeRolUsuario } from '../utils/flotaSector'
import { parseLatLngFromMapsUrl } from '../utils/mapsUrlParse'
import SalidaMapPicker from './SalidaMapPicker'
import './RegistroSalidaModal.css'

type RegistroSalidaModalProps = {
  vehiculo: Vehiculo
  onClose: () => void
  onSuccess: () => void
}

const SECTORES_EXTRA = [
  'Diseño Gráfico',
  'Taller de Imprenta',
  'Taller Gráfico',
  'Instalaciones',
  'Metalúrgica',
  'Mostrador',
  'Caja',
  'Administración',
  'Gerencia',
  'Compras',
  'Asesor Técnico',
  'Presupuestos',
  'Recursos Humanos'
]

const RegistroSalidaModal = ({ vehiculo, onClose, onSuccess }: RegistroSalidaModalProps) => {
  const { usuario } = useAuth()
  const [sector, setSector] = useState('')
  const [kmSalida, setKmSalida] = useState<string>('')
  const [numeroOp, setNumeroOp] = useState('')
  const [motivoSalida, setMotivoSalida] = useState('')
  const [horaEstimadaLlegada, setHoraEstimadaLlegada] = useState('')
  const [ubicacionDestino, setUbicacionDestino] = useState('')
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargandoOp, setCargandoOp] = useState(false)

  useEffect(() => {
    const s = sectorDesdeRolUsuario(usuario?.rol ?? null)
    if (s) setSector(s)
  }, [usuario?.rol])

  const aplicarCoords = useCallback((lat: number, lng: number) => {
    setLatitud(lat)
    setLongitud(lng)
  }, [])

  const buscarUbicacionOp = useCallback(async () => {
    const op = numeroOp.trim()
    if (!op) {
      setError('Ingresá un número de OP para buscar ubicación')
      return
    }
    setCargandoOp(true)
    setError(null)
    try {
      const res = await apiService.getOrdenUbicacionPorNumeroOp(op)
      if (!res.success || !res.data) {
        setError(res.error || 'No se encontró la OP')
        return
      }
      const link = res.data.ubicacion_link
      if (link) {
        const parsed = parseLatLngFromMapsUrl(link)
        if (parsed) {
          aplicarCoords(parsed.lat, parsed.lng)
          if (!ubicacionDestino.trim() && res.data.direccion_cliente) {
            setUbicacionDestino(res.data.direccion_cliente)
          }
          return
        }
      }
      if (res.data.direccion_cliente) {
        setUbicacionDestino(res.data.direccion_cliente)
        setError(
          'La OP tiene dirección pero no coordenadas en el enlace. Buscá la dirección en el mapa de abajo.'
        )
      } else {
        setError('La OP no tiene ubicación guardada. Marcá el punto en el mapa.')
      }
    } finally {
      setCargandoOp(false)
    }
  }, [numeroOp, aplicarCoords, ubicacionDestino])

  const geolocalizarAqui = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización')
      return
    }
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => aplicarCoords(pos.coords.latitude, pos.coords.longitude),
      () => setError('No se pudo obtener tu ubicación. Revisá permisos del navegador.')
    )
  }

  const handleGuardar = async () => {
    if (!sector) {
      setError('Sector requerido')
      return
    }
    if (!motivoSalida.trim()) {
      setError('Motivo de la salida requerido')
      return
    }
    if (!usuario) {
      setError('Debés estar autenticado')
      return
    }

    setGuardando(true)
    setError(null)

    try {
      const registro: Omit<RegistroSalidaVehiculo, 'id' | 'created_at' | 'updated_at' | 'vehiculo'> = {
        id_vehiculo: vehiculo.id,
        id_usuario: usuario.id || null,
        nombre_usuario: usuario.nombre || 'Usuario',
        sector,
        km_aproximado: kmSalida ? parseInt(kmSalida, 10) : null,
        numero_op: numeroOp.trim() || null,
        motivo_salida: motivoSalida.trim(),
        hora_salida: new Date().toISOString(),
        hora_estimada_llegada: horaEstimadaLlegada ? new Date(horaEstimadaLlegada).toISOString() : null,
        hora_llegada_real: null,
        ubicacion_destino: ubicacionDestino.trim() || null,
        latitud,
        longitud,
        estado: 'pendiente_autorizacion',
        llave_entregada: false,
        id_usuario_caja_entrego_llave: null,
        nombre_usuario_caja_entrego_llave: null,
        observaciones: null
      }

      const response = await apiService.crearRegistroSalidaVehiculo(registro)

      if (response.success) {
        alert(
          '✓ Solicitud guardada. Caja o Administración debe autorizar la salida antes de retirar el vehículo.'
        )
        onSuccess()
      } else {
        setError(response.error || 'Error al guardar')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const modal = (
    <div
      className="registro-salida-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="registro-salida-modal registro-salida-modal-inner"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="modal-header">
          <h2>Solicitud de salida — {vehiculo.nombre}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {error && <div className="flota-form-error">{error}</div>}

          <p className="flota-form-info">
            Completá el formulario. <strong>Caja o Administración</strong> autorizará la salida; hasta entonces el
            vehículo no puede usarse en otro trámite.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>Sector *</label>
              <select value={sector} onChange={(e) => setSector(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {[...new Set([sectorDesdeRolUsuario(usuario?.rol ?? null), ...SECTORES_EXTRA].filter(Boolean))].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="form-group">
              <label>Km de salida (odómetro)</label>
              <input
                type="number"
                value={kmSalida}
                onChange={(e) => setKmSalida(e.target.value)}
                placeholder="Ej: 45200"
                min={0}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-grow">
              <label>Nº OP del trabajo</label>
              <div className="inline-actions">
                <input
                  type="text"
                  value={numeroOp}
                  onChange={(e) => setNumeroOp(e.target.value)}
                  placeholder="Ej: 1234 o VENT-…"
                />
                <button type="button" className="btn-secondary btn-sm" onClick={() => void buscarUbicacionOp()} disabled={cargandoOp}>
                  {cargandoOp ? '…' : 'Ubicación desde OP'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Hora estimada de llegada</label>
              <input
                type="datetime-local"
                value={horaEstimadaLlegada}
                onChange={(e) => setHoraEstimadaLlegada(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Motivo de la salida *</label>
            <textarea
              value={motivoSalida}
              onChange={(e) => setMotivoSalida(e.target.value)}
              placeholder="Motivo del viaje…"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label>Destino (texto)</label>
            <input
              type="text"
              value={ubicacionDestino}
              onChange={(e) => setUbicacionDestino(e.target.value)}
              placeholder="Dirección o referencia"
            />
          </div>

          <div className="form-group">
            <label>Punto de salida en mapa (San Juan, Argentina)</label>
            <div className="map-toolbar">
              <button type="button" className="btn-secondary btn-sm" onClick={geolocalizarAqui}>
                📍 Mi ubicación
              </button>
              {latitud != null && longitud != null && (
                <span className="coord-chip">
                  {latitud.toFixed(5)}, {longitud.toFixed(5)}
                </span>
              )}
            </div>
            <SalidaMapPicker lat={latitud} lng={longitud} onChange={aplicarCoords} height={280} />
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleGuardar()} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Enviar solicitud'}
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default RegistroSalidaModal
