import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { CitaAsesorTecnico, ClienteRecord, OrdenTrabajo } from '../types/api'
import { formatArgentinaDateOnly, formatArgentinaTimeOnly } from '../utils/dateUtils'
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
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaCita, setFechaCita] = useState('')
  const [horaCita, setHoraCita] = useState('09:00')
  const [duracionMinutos, setDuracionMinutos] = useState(60)
  const [idCliente, setIdCliente] = useState<number | undefined>(undefined)
  const [idFichaNoOP, setIdFichaNoOP] = useState<number | undefined>(undefined)
  const [direccion, setDireccion] = useState('')
  const [ubicacionLink, setUbicacionLink] = useState('')
  const [estado, setEstado] = useState<'programada' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada'>('programada')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fichasNoOP, setFichasNoOP] = useState<OrdenTrabajo[]>([])

  useEffect(() => {
    if (cita) {
      setTitulo(cita.titulo)
      setDescripcion(cita.descripcion || '')
      const fecha = new Date(cita.fecha_cita)
      setFechaCita(formatArgentinaDateOnly(fecha))
      setHoraCita(formatArgentinaTimeOnly(fecha))
      setDuracionMinutos(cita.duracion_minutos)
      setIdCliente(cita.id_cliente || undefined)
      setIdFichaNoOP(cita.id_ficha_no_op || undefined)
      setDireccion(cita.direccion || '')
      setUbicacionLink(cita.ubicacion_link || '')
      setEstado(cita.estado)
      setNotas(cita.notas || '')
    } else if (fechaSeleccionada) {
      setFechaCita(formatArgentinaDateOnly(fechaSeleccionada))
    }
    loadFichasNoOP()
  }, [cita, fechaSeleccionada])

  const loadFichasNoOP = async () => {
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        // Filtrar solo fichas No OP (que tienen sector Asesor Técnico o Presupuestos)
        const fichas = response.data.filter(orden => 
          orden.sector === 'Asesor Técnico' || 
          orden.sector === 'Presupuestos' ||
          orden.sectores?.includes('Asesor Técnico') ||
          orden.sectores?.includes('Presupuestos')
        )
        setFichasNoOP(fichas)
      }
    } catch (err) {
      console.error('Error al cargar fichas No OP:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Guardar SIEMPRE en horario Argentina para que no se corra al editar/mostrar
      const fechaHoraCompleta = `${fechaCita}T${horaCita}:00-03:00`
      
      if (cita) {
        // Actualizar cita existente
        const response = await apiService.actualizarCitaAsesor(
          cita.id,
          titulo,
          descripcion || undefined,
          fechaHoraCompleta,
          duracionMinutos,
          direccion || undefined,
          ubicacionLink || undefined,
          estado,
          notas || undefined
        )

        if (!response.success) {
          setError(response.error || 'Error al actualizar la cita')
          return
        }
      } else {
        // Crear nueva cita
        const response = await apiService.crearCitaAsesor(
          idAsesor,
          titulo,
          fechaHoraCompleta,
          idCliente,
          idFichaNoOP,
          descripcion || undefined,
          duracionMinutos,
          direccion || undefined,
          ubicacionLink || undefined,
          estado,
          notas || undefined
        )

        if (!response.success) {
          setError(response.error || 'Error al crear la cita')
          return
        }
      }

      onSave()
    } catch (err) {
      setError('Error al guardar la cita')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!cita || !confirm('¿Estás seguro de eliminar esta cita?')) return

    setLoading(true)
    setError(null)

    try {
      const response = await apiService.eliminarCitaAsesor(cita.id)
      if (!response.success) {
        setError(response.error || 'Error al eliminar la cita')
        return
      }
      onDelete()
    } catch (err) {
      setError('Error al eliminar la cita')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cita-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{cita ? 'Editar Cita' : 'Nueva Cita'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="cita-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              placeholder="Ej: Medición en cliente X"
            />
          </div>

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
            <label>Cliente</label>
            <select
              value={idCliente || ''}
              onChange={(e) => setIdCliente(e.target.value ? parseInt(e.target.value) : undefined)}
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
            <label>Ficha No OP</label>
            <select
              value={idFichaNoOP || ''}
              onChange={(e) => setIdFichaNoOP(e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Seleccionar ficha...</option>
              {fichasNoOP.map(ficha => (
                <option key={ficha.id} value={ficha.id}>
                  {ficha.numero_op} - {ficha.cliente}
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

