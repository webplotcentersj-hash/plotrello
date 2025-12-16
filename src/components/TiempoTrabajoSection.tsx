import { useState, useEffect } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { RegistroTiempo } from '../types/api'
import './TiempoTrabajoSection.css'

type TiempoTrabajoSectionProps = {
  ordenId: number
  onTiempoActualizado?: () => void
}

const TiempoTrabajoSection = ({ ordenId, onTiempoActualizado }: TiempoTrabajoSectionProps) => {
  const { usuario } = useAuth()
  const [registros, setRegistros] = useState<RegistroTiempo[]>([])
  const [registroActivo, setRegistroActivo] = useState<RegistroTiempo | null>(null)
  const [loading, setLoading] = useState(false)
  const [mostrarFormularioManual, setMostrarFormularioManual] = useState(false)
  const [formularioManual, setFormularioManual] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: '',
    hora_fin: '',
    tiempo_minutos: '',
    descripcion: '',
    tipo_trabajo: 'diseno' as 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  })

  useEffect(() => {
    loadRegistros()
  }, [ordenId])

  const loadRegistros = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerTiempoTrabajoOrden(ordenId)
      if (response.success && response.data) {
        setRegistros(response.data)
        // Buscar registro activo (sin hora_fin)
        const activo = response.data.find(r => !r.hora_fin)
        setRegistroActivo(activo || null)
      }
    } catch (error) {
      console.error('Error cargando registros:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIniciar = async () => {
    if (!usuario) return

    setLoading(true)
    try {
      const response = await apiService.iniciarTiempoTrabajo({
        id_orden: ordenId,
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre
      })

      if (response.success) {
        await loadRegistros()
        onTiempoActualizado?.()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error iniciando tiempo:', error)
      alert('Error al iniciar registro de tiempo')
    } finally {
      setLoading(false)
    }
  }

  const handleFinalizar = async () => {
    if (!registroActivo) return

    setLoading(true)
    try {
      const response = await apiService.finalizarTiempoTrabajo(registroActivo.id)

      if (response.success) {
        await loadRegistros()
        onTiempoActualizado?.()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error finalizando tiempo:', error)
      alert('Error al finalizar registro de tiempo')
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarManual = async () => {
    if (!usuario || !formularioManual.hora_inicio || !formularioManual.hora_fin) {
      alert('Completa todos los campos requeridos')
      return
    }

    setLoading(true)
    try {
      const response = await apiService.registrarTiempoManual({
        id_orden: ordenId,
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        fecha: formularioManual.fecha,
        hora_inicio: formularioManual.hora_inicio,
        hora_fin: formularioManual.hora_fin,
        tiempo_minutos: formularioManual.tiempo_minutos ? parseInt(formularioManual.tiempo_minutos) : undefined,
        descripcion: formularioManual.descripcion || undefined,
        tipo_trabajo: formularioManual.tipo_trabajo
      })

      if (response.success) {
        setMostrarFormularioManual(false)
        setFormularioManual({
          fecha: new Date().toISOString().split('T')[0],
          hora_inicio: '',
          hora_fin: '',
          tiempo_minutos: '',
          descripcion: '',
          tipo_trabajo: 'diseno'
        })
        await loadRegistros()
        onTiempoActualizado?.()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error registrando tiempo manual:', error)
      alert('Error al registrar tiempo')
    } finally {
      setLoading(false)
    }
  }

  const calcularTiempoTotal = () => {
    return registros
      .filter(r => r.tiempo_minutos !== null)
      .reduce((total, r) => total + (r.tiempo_minutos || 0), 0)
  }

  const formatearTiempo = (minutos: number) => {
    const horas = Math.floor(minutos / 60)
    const mins = minutos % 60
    if (horas > 0) {
      return `${horas}h ${mins}m`
    }
    return `${mins}m`
  }

  const tiempoTotal = calcularTiempoTotal()

  return (
    <div className="tiempo-trabajo-section">
      <div className="tiempo-header">
        <h3>⏱️ Registro de Tiempo de Trabajo</h3>
        <div className="tiempo-total">
          <strong>Total:</strong> {formatearTiempo(tiempoTotal)}
        </div>
      </div>

      {/* Controles */}
      <div className="tiempo-controles">
        {!registroActivo ? (
          <button
            className="btn-iniciar"
            onClick={handleIniciar}
            disabled={loading || !usuario}
          >
            ▶️ Iniciar Tiempo
          </button>
        ) : (
          <div className="registro-activo">
            <div className="activo-info">
              <span className="activo-indicator">●</span>
              <span>Registro activo desde {registroActivo.hora_inicio}</span>
            </div>
            <button
              className="btn-finalizar"
              onClick={handleFinalizar}
              disabled={loading}
            >
              ⏹️ Finalizar
            </button>
          </div>
        )}
        <button
          className="btn-manual"
          onClick={() => setMostrarFormularioManual(!mostrarFormularioManual)}
        >
          {mostrarFormularioManual ? '✖️ Cancelar' : '➕ Registrar Manualmente'}
        </button>
      </div>

      {/* Formulario manual */}
      {mostrarFormularioManual && (
        <div className="formulario-manual">
          <h4>Registrar Tiempo Manualmente</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha</label>
              <input
                type="date"
                value={formularioManual.fecha}
                onChange={(e) => setFormularioManual({ ...formularioManual, fecha: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Hora Inicio</label>
              <input
                type="time"
                value={formularioManual.hora_inicio}
                onChange={(e) => setFormularioManual({ ...formularioManual, hora_inicio: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Hora Fin</label>
              <input
                type="time"
                value={formularioManual.hora_fin}
                onChange={(e) => setFormularioManual({ ...formularioManual, hora_fin: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Tiempo (minutos) - Opcional</label>
              <input
                type="number"
                value={formularioManual.tiempo_minutos}
                onChange={(e) => setFormularioManual({ ...formularioManual, tiempo_minutos: e.target.value })}
                placeholder="Se calcula automáticamente"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Trabajo</label>
              <select
                value={formularioManual.tipo_trabajo}
                onChange={(e) => setFormularioManual({ ...formularioManual, tipo_trabajo: e.target.value as any })}
              >
                <option value="diseno">Diseño</option>
                <option value="revision">Revisión</option>
                <option value="correccion">Corrección</option>
                <option value="consulta">Consulta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label>Descripción</label>
              <textarea
                rows={2}
                value={formularioManual.descripcion}
                onChange={(e) => setFormularioManual({ ...formularioManual, descripcion: e.target.value })}
                placeholder="Descripción del trabajo realizado..."
              />
            </div>
          </div>
          <button
            className="btn-guardar"
            onClick={handleRegistrarManual}
            disabled={loading || !formularioManual.hora_inicio || !formularioManual.hora_fin}
          >
            Guardar Registro
          </button>
        </div>
      )}

      {/* Lista de registros */}
      {registros.length > 0 && (
        <div className="registros-lista">
          <h4>Historial de Registros</h4>
          <div className="registros-table">
            <div className="registro-header">
              <span>Fecha</span>
              <span>Usuario</span>
              <span>Hora Inicio</span>
              <span>Hora Fin</span>
              <span>Tiempo</span>
              <span>Tipo</span>
            </div>
            {registros.map((registro) => (
              <div key={registro.id} className={`registro-item ${!registro.hora_fin ? 'activo' : ''}`}>
                <span>{new Date(registro.fecha).toLocaleDateString('es-AR')}</span>
                <span>{registro.usuario_nombre}</span>
                <span>{registro.hora_inicio}</span>
                <span>{registro.hora_fin || 'En curso...'}</span>
                <span>
                  {registro.tiempo_minutos !== null
                    ? formatearTiempo(registro.tiempo_minutos)
                    : 'Calculando...'}
                </span>
                <span className="tipo-badge">{registro.tipo_trabajo}</span>
                {registro.descripcion && (
                  <div className="registro-descripcion">{registro.descripcion}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {registros.length === 0 && !loading && (
        <div className="sin-registros">
          <p>No hay registros de tiempo aún.</p>
        </div>
      )}
    </div>
  )
}

export default TiempoTrabajoSection

