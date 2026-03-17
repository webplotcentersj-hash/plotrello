import { useMemo, useState, useEffect } from 'react'
import apiService from '../services/api'
import type { CitaAsesorTecnico, ClienteRecord } from '../types/api'
import { formatArgentinaDateOnly, isoToArgentinaDateKey, isoToArgentinaTime } from '../utils/dateUtils'
import './CitaModal.css'

type CitaModalProps = {
  cita?: CitaAsesorTecnico | null
  fechaSeleccionada: Date | null
  idAsesor: number
  clientes: ClienteRecord[]
  onClose: () => void
  onSave: () => void
  onDelete: () => void
}

const CitaModal = ({
  cita,
  fechaSeleccionada,
  idAsesor,
  clientes,
  onClose,
  onSave,
  onDelete
}: CitaModalProps) => {
  const [descripcion, setDescripcion] = useState('')
  const [fechaCita, setFechaCita] = useState('')
  const [horaCita, setHoraCita] = useState('09:00')
  const [duracionMinutos, setDuracionMinutos] = useState(60)
  const [idCliente, setIdCliente] = useState<number | undefined>(undefined)
  const [direccion, setDireccion] = useState('')
  const [ubicacionLink, setUbicacionLink] = useState('')
  const [estado, setEstado] = useState<'programada' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada'>('programada')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clienteHeader = useMemo(() => {
    if (!idCliente) return ''
    const c = clientes.find((x) => x.id === idCliente)
    if (!c) return ''
    const empresa = (c.empresa || '').trim()
    const nombre = (c.nombre || '').trim()
    return empresa ? `${empresa} (${nombre})` : nombre
  }, [idCliente, clientes])

  useEffect(() => {
    if (cita) {
      setDescripcion(cita.descripcion || '')
      setFechaCita(isoToArgentinaDateKey(cita.fecha_cita))
      setHoraCita(isoToArgentinaTime(cita.fecha_cita))
      setDuracionMinutos(cita.duracion_minutos)
      setIdCliente(cita.id_cliente || undefined)
      setDireccion(cita.direccion || '')
      setUbicacionLink(cita.ubicacion_link || '')
      setEstado(cita.estado)
      setNotas(cita.notas || '')
    } else if (fechaSeleccionada) {
      setFechaCita(formatArgentinaDateOnly(fechaSeleccionada))
    }
  }, [cita, fechaSeleccionada])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const clienteSeleccionado = clientes.find((c) => c.id === idCliente)
      const tituloFinal = clienteSeleccionado?.nombre
        ? `Visita - ${clienteSeleccionado.nombre}`
        : 'Visita'

      // Guardar SIEMPRE en horario Argentina para que no se corra al editar/mostrar
      const fechaHoraCompleta = `${fechaCita}T${horaCita}:00-03:00`
      
      if (cita) {
        // Actualizar cita existente
        const response = await apiService.actualizarCitaAsesor(
          cita.id,
          tituloFinal,
          descripcion || undefined,
          fechaHoraCompleta,
          duracionMinutos,
          direccion || undefined,
          ubicacionLink || undefined,
          estado,
          notas || undefined
        )

        if (!response.success) {
          setError(response.error || 'Error al actualizar la visita')
          return
        }
      } else {
        // Crear nueva cita
        const response = await apiService.crearCitaAsesor(
          idAsesor,
          tituloFinal,
          fechaHoraCompleta,
          idCliente,
          undefined,
          descripcion || undefined,
          duracionMinutos,
          direccion || undefined,
          ubicacionLink || undefined,
          estado,
          notas || undefined
        )

        if (!response.success) {
          setError(response.error || 'Error al crear la visita')
          return
        }
      }

      onSave()
    } catch (err) {
      setError('Error al guardar la visita')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!cita || !confirm('¿Estás seguro de eliminar esta visita?')) return

    setLoading(true)
    setError(null)

    try {
      const response = await apiService.eliminarCitaAsesor(cita.id)
      if (!response.success) {
        setError(response.error || 'Error al eliminar la visita')
        return
      }
      onDelete()
    } catch (err) {
      setError('Error al eliminar la visita')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-content cita-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {cita ? 'Editar Visita' : 'Nueva Visita'}
            {!cita && clienteHeader ? ` — ${clienteHeader}` : ''}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="cita-form">
          <div className="form-row">
            <div className="form-group">
              <label>Fecha *</label>
              <input
                type="date"
                value={fechaCita}
                onChange={(e) => setFechaCita(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Hora *</label>
              <input
                type="time"
                value={horaCita}
                onChange={(e) => setHoraCita(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Duración (min)</label>
              <input
                type="number"
                value={duracionMinutos}
                onChange={(e) => setDuracionMinutos(parseInt(e.target.value) || 60)}
                min="15"
                step="15"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Cliente *</label>
            <select
              value={idCliente || ''}
              onChange={(e) => setIdCliente(e.target.value ? parseInt(e.target.value) : undefined)}
              required
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} {cliente.telefono ? `- ${cliente.telefono}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Detalles de la cita..."
            />
          </div>

          <div className="form-group">
            <label>Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección del cliente"
            />
          </div>

          <div className="form-group">
            <label>Enlace de Ubicación</label>
            <input
              type="url"
              value={ubicacionLink}
              onChange={(e) => setUbicacionLink(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as any)}
            >
              <option value="programada">Programada</option>
              <option value="confirmada">Confirmada</option>
              <option value="en_curso">En Curso</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="modal-actions">
            {cita && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                Eliminar
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Guardando...' : cita ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CitaModal

