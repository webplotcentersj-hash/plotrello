import { useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { Vehiculo, RegistroSalidaVehiculo } from '../types/api'
import './RegistroSalidaModal.css'

type RegistroSalidaModalProps = {
  vehiculo: Vehiculo
  onClose: () => void
  onSuccess: () => void
}

const SECTORES = [
  'Diseño Gráfico',
  'Taller de Imprenta',
  'Taller Gráfico',
  'Instalaciones',
  'Metalúrgica',
  'Mostrador',
  'Caja'
]

const RegistroSalidaModal = ({ vehiculo, onClose, onSuccess }: RegistroSalidaModalProps) => {
  const { usuario } = useAuth()
  const [sector, setSector] = useState('')
  const [kmAproximado, setKmAproximado] = useState<string>('')
  const [numeroOp, setNumeroOp] = useState('')
  const [motivoSalida, setMotivoSalida] = useState('')
  const [horaEstimadaLlegada, setHoraEstimadaLlegada] = useState('')
  const [ubicacionDestino, setUbicacionDestino] = useState('')
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)
  const [solicitandoLlave, setSolicitandoLlave] = useState(false)
  const [llaveEntregada, setLlaveEntregada] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Obtener ubicación actual al hacer click en el mapa
  const handleObtenerUbicacion = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      return
    }

    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitud(position.coords.latitude)
        setLongitud(position.coords.longitude)
        // Opcional: obtener dirección desde coordenadas usando un servicio de geocodificación inversa
        // Por ahora solo guardamos las coordenadas
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error)
        setError('No se pudo obtener la ubicación. Asegúrate de permitir el acceso a la ubicación.')
      }
    )
  }

  // Solicitar llave a caja
  const handleSolicitarLlave = async () => {
    if (!usuario) {
      alert('Debes estar autenticado para solicitar la llave')
      return
    }

    setSolicitandoLlave(true)
    setError(null)
    
    try {
      // Obtener usuarios de caja y notificarles
      const usuariosResp = await apiService.getUsuarios()
      if (usuariosResp.success && usuariosResp.data) {
        const usuariosCaja = usuariosResp.data.filter(u => u.rol === 'caja' || u.rol === 'administracion')
        
        // Notificar a todos los usuarios de caja
        for (const usuarioCaja of usuariosCaja) {
          await apiService.createNotification({
            user_id: usuarioCaja.id,
            title: '🔑 Solicitud de Llave de Vehículo',
            description: `${usuario.nombre} solicita la llave del vehículo ${vehiculo.nombre}`,
            type: 'info'
          })
        }
      }
      
      // Por ahora, marcamos como entregada automáticamente
      // En el futuro, esto podría esperar confirmación de caja
      setLlaveEntregada(true)
      alert('✓ Solicitud de llave enviada a caja. La llave ha sido marcada como entregada.')
    } catch (error) {
      setError('Error al solicitar la llave')
      console.error('Error solicitando llave:', error)
    } finally {
      setSolicitandoLlave(false)
    }
  }

  const handleGuardar = async () => {
    if (!sector) {
      setError('Debes seleccionar un sector')
      return
    }

    if (!motivoSalida.trim()) {
      setError('Debes ingresar el motivo de la salida')
      return
    }

    if (!llaveEntregada) {
      setError('Debes solicitar y recibir la llave de caja antes de registrar la salida')
      return
    }

    if (!usuario) {
      setError('Debes estar autenticado')
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
        km_aproximado: kmAproximado ? parseInt(kmAproximado) : null,
        numero_op: numeroOp.trim() || null,
        motivo_salida: motivoSalida.trim(),
        hora_salida: new Date().toISOString(),
        hora_estimada_llegada: horaEstimadaLlegada ? new Date(horaEstimadaLlegada).toISOString() : null,
        hora_llegada_real: null,
        ubicacion_destino: ubicacionDestino.trim() || null,
        latitud: latitud,
        longitud: longitud,
        estado: 'en_uso',
        llave_entregada: true,
        id_usuario_caja_entrego_llave: usuario.id || null,
        nombre_usuario_caja_entrego_llave: usuario.nombre || null,
        observaciones: null
      }

      const response = await apiService.crearRegistroSalidaVehiculo(registro)
      
      if (response.success) {
        onSuccess()
      } else {
        setError(response.error || 'Error al registrar la salida')
      }
    } catch (error: any) {
      setError(error.message || 'Error al registrar la salida')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content registro-salida-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Registrar Salida - {vehiculo.nombre}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {error && (
            <div className="error-message" style={{ 
              padding: '12px', 
              background: '#fee2e2', 
              color: '#991b1b', 
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          {/* Solicitar Llave */}
          <div className="form-section">
            <h3>🔑 Solicitar Llave a Caja</h3>
            {!llaveEntregada ? (
              <button
                type="button"
                className="btn-solicitar-llave"
                onClick={handleSolicitarLlave}
                disabled={solicitandoLlave}
              >
                {solicitandoLlave ? 'Solicitando...' : 'Solicitar Llave a Caja'}
              </button>
            ) : (
              <div className="llave-entregada">
                ✓ Llave entregada por caja
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Sector *</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                required
              >
                <option value="">Seleccionar sector</option>
                {SECTORES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Km Aproximado</label>
              <input
                type="number"
                value={kmAproximado}
                onChange={(e) => setKmAproximado(e.target.value)}
                placeholder="Ej: 15000"
                min="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Número de OP</label>
              <input
                type="text"
                value={numeroOp}
                onChange={(e) => setNumeroOp(e.target.value)}
                placeholder="Ej: VENT-20260114-0018"
              />
            </div>

            <div className="form-group">
              <label>Hora Estimada de Llegada</label>
              <input
                type="datetime-local"
                value={horaEstimadaLlegada}
                onChange={(e) => setHoraEstimadaLlegada(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Motivo de la Salida *</label>
            <textarea
              value={motivoSalida}
              onChange={(e) => setMotivoSalida(e.target.value)}
              placeholder="Describir el motivo de la salida..."
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label>Ubicación Destino</label>
            <input
              type="text"
              value={ubicacionDestino}
              onChange={(e) => setUbicacionDestino(e.target.value)}
              placeholder="Dirección o descripción del destino"
            />
          </div>

          <div className="form-group">
            <label>Ubicación en Mapa</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-ubicacion"
                onClick={handleObtenerUbicacion}
              >
                📍 Obtener Mi Ubicación
              </button>
              {latitud && longitud && (
                <span className="coordenadas">
                  {latitud.toFixed(6)}, {longitud.toFixed(6)}
                </span>
              )}
            </div>
            {latitud && longitud && (
              <a
                href={`https://www.google.com/maps?q=${latitud},${longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-link"
              >
                Ver en Google Maps
              </a>
            )}
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleGuardar}
            disabled={guardando || !llaveEntregada}
          >
            {guardando ? 'Guardando...' : 'Registrar Salida'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default RegistroSalidaModal

