import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { UsuarioRecord, Vehiculo, RegistroSalidaVehiculo } from '../types/api'
import { sectorDesdeRolUsuario } from '../utils/flotaSector'
import { geocodeFirstHitSanJuan } from '../utils/flotaGeocode'
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
  const [horaSalidaDeseada, setHoraSalidaDeseada] = useState<string>('')
  const [horaEstimadaLlegada, setHoraEstimadaLlegada] = useState('')
  const [ubicacionDestino, setUbicacionDestino] = useState('')
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargandoOp, setCargandoOp] = useState(false)
  const [usuariosLista, setUsuariosLista] = useState<UsuarioRecord[]>([])
  const [acompanantesSel, setAcompanantesSel] = useState<Array<{ id_usuario: number; nombre: string }>>([])
  const [opClienteInfo, setOpClienteInfo] = useState<{ nombre: string; telefono: string | null } | null>(null)
  const ubicacionDestinoRef = useRef('')

  useEffect(() => {
    const s = sectorDesdeRolUsuario(usuario?.rol ?? null)
    if (s) setSector(s)
  }, [usuario?.rol])

  useEffect(() => {
    // Default: ahora redondeado a minutos (para datetime-local)
    const d = new Date()
    d.setSeconds(0, 0)
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setHoraSalidaDeseada(isoLocal)
  }, [])

  useEffect(() => {
    ubicacionDestinoRef.current = ubicacionDestino
  }, [ubicacionDestino])

  useEffect(() => {
    void apiService.getUsuarios().then((r) => {
      if (r.success && r.data?.length) {
        setUsuariosLista([...r.data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
      }
    })
  }, [])

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
    setOpClienteInfo(null)
    try {
      const res = await apiService.getOrdenUbicacionPorNumeroOp(op)
      if (!res.success || !res.data) {
        setError(res.error || 'No se encontró la OP')
        return
      }
      const row = res.data
      if (row.numero_op) setNumeroOp(row.numero_op)
      const nom = (row.cliente ?? '').trim()
      const tel = (row.telefono_cliente ?? '').trim()
      if (nom || tel) {
        setOpClienteInfo({ nombre: nom || '—', telefono: tel || null })
      }

      const link = row.ubicacion_link
      if (link) {
        const parsed = parseLatLngFromMapsUrl(link)
        if (parsed) {
          aplicarCoords(parsed.lat, parsed.lng)
          if (!ubicacionDestinoRef.current.trim() && row.direccion_cliente) {
            setUbicacionDestino(row.direccion_cliente.trim())
          }
          setError(null)
          return
        }
      }

      const dir = (row.direccion_cliente ?? '').trim()
      if (dir) {
        const geo = await geocodeFirstHitSanJuan(dir)
        if (geo) {
          aplicarCoords(geo.lat, geo.lon)
          if (!ubicacionDestinoRef.current.trim()) setUbicacionDestino(dir)
          setError(null)
          return
        }
        setUbicacionDestino(dir)
        setError(
          'La OP tiene dirección en la ficha pero no se pudo ubicar en el mapa automáticamente. Buscá la calle en el cuadro de abajo o tocá el mapa.'
        )
        return
      }

      setError('La OP no tiene ubicación ni dirección cargada. Marcá el destino en el mapa.')
    } finally {
      setCargandoOp(false)
    }
  }, [numeroOp, aplicarCoords])

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
      const horaSalidaIso = (() => {
        const raw = horaSalidaDeseada?.trim()
        if (!raw) return new Date().toISOString()
        const d = new Date(raw)
        return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
      })()

      const registro: Omit<RegistroSalidaVehiculo, 'id' | 'created_at' | 'updated_at' | 'vehiculo'> = {
        id_vehiculo: vehiculo.id,
        id_usuario: usuario.id || null,
        nombre_usuario: usuario.nombre || 'Usuario',
        sector,
        km_aproximado: kmSalida ? parseInt(kmSalida, 10) : null,
        numero_op: numeroOp.trim() || null,
        motivo_salida: motivoSalida.trim(),
        hora_salida: horaSalidaIso,
        hora_estimada_llegada: horaEstimadaLlegada ? new Date(horaEstimadaLlegada).toISOString() : null,
        hora_llegada_real: null,
        ubicacion_destino: ubicacionDestino.trim() || null,
        latitud,
        longitud,
        estado: 'pendiente_autorizacion',
        llave_entregada: false,
        id_usuario_caja_entrego_llave: null,
        nombre_usuario_caja_entrego_llave: null,
        observaciones: null,
        acompanantes: acompanantesSel.length > 0 ? acompanantesSel : null
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
            <div className="form-group">
              <label>Hora de salida (deseada) *</label>
              <input
                type="datetime-local"
                value={horaSalidaDeseada}
                onChange={(e) => setHoraSalidaDeseada(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Hora estimada de llegada</label>
              <input
                type="datetime-local"
                value={horaEstimadaLlegada}
                onChange={(e) => setHoraEstimadaLlegada(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="form-row form-row--single">
            <div className="form-group flex-grow">
              <label>Nº OP del trabajo</label>
              <div className="inline-actions">
                <input
                  type="text"
                  value={numeroOp}
                  onChange={(e) => setNumeroOp(e.target.value)}
                  placeholder="Ej: 1234, ID de ficha o parte del número"
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void buscarUbicacionOp()}
                  disabled={cargandoOp}
                >
                  {cargandoOp ? '…' : 'Ubicación desde OP'}
                </button>
              </div>
              {opClienteInfo && (
                <div className="flota-op-cliente-card" role="status">
                  <span className="flota-op-cliente-nombre">{opClienteInfo.nombre}</span>
                  {opClienteInfo.telefono ? (
                    <a className="flota-op-cliente-tel" href={`tel:${opClienteInfo.telefono.replace(/\s/g, '')}`}>
                      {opClienteInfo.telefono}
                    </a>
                  ) : (
                    <span className="flota-op-cliente-sin-tel">Sin teléfono en la OP</span>
                  )}
                </div>
              )}
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
            <label>Acompañantes (opcional)</label>
            <p className="flota-form-hint-sm">Personas que van en el vehículo además del conductor.</p>
            <select
              className="flota-acompanantes-select"
              value=""
              aria-label="Agregar acompañante"
              onChange={(e) => {
                const id = parseInt(e.target.value, 10)
                e.target.value = ''
                if (!id) return
                const u = usuariosLista.find((x) => x.id === id)
                if (!u || u.id === usuario?.id) return
                if (acompanantesSel.some((a) => a.id_usuario === id)) return
                setAcompanantesSel((prev) => [...prev, { id_usuario: u.id, nombre: u.nombre }])
              }}
            >
              <option value="">Agregar desde usuarios…</option>
              {usuariosLista
                .filter(
                  (u) => u.id !== usuario?.id && !acompanantesSel.some((a) => a.id_usuario === u.id)
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
            </select>
            {acompanantesSel.length > 0 && (
              <ul className="flota-acompanantes-chips">
                {acompanantesSel.map((a) => (
                  <li key={a.id_usuario}>
                    <span>{a.nombre}</span>
                    <button
                      type="button"
                      className="flota-acompanantes-remove"
                      aria-label={`Quitar ${a.nombre}`}
                      onClick={() =>
                        setAcompanantesSel((prev) => prev.filter((x) => x.id_usuario !== a.id_usuario))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
