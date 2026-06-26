import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './RegistrarAtencionModal.css'

type TipoAtencion = 'virtual' | 'consulta' | 'venta'

type RegistrarAtencionModalProps = {
  onClose: () => void
  onSuccess?: () => void
  clienteNombre?: string
  ordenId?: number
}

const RegistrarAtencionModal = ({
  onClose,
  onSuccess,
  clienteNombre: clienteNombreProp,
  ordenId: ordenIdProp
}: RegistrarAtencionModalProps) => {
  const { usuario, nombreVisible } = useAuth()
  const [tipoAtencion, setTipoAtencion] = useState<TipoAtencion>('consulta')
  const [clienteNombre, setClienteNombre] = useState(clienteNombreProp || '')
  const [ordenId, setOrdenId] = useState(ordenIdProp?.toString() || '')
  const [notas, setNotas] = useState('')
  const [buscandoOrden, setBuscandoOrden] = useState(false)
  const [ordenEncontrada, setOrdenEncontrada] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const buscarOrden = async () => {
    if (!ordenId.trim()) {
      setOrdenEncontrada(null)
      return
    }

    setBuscandoOrden(true)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        const orden = response.data.find(
          (o) => o.numero_op?.toString() === ordenId.trim()
        )
        setOrdenEncontrada(orden || null)
        if (orden) {
          setClienteNombre(orden.cliente || '')
        }
      }
    } catch (error) {
      console.error('Error buscando orden:', error)
    } finally {
      setBuscandoOrden(false)
    }
  }

  const handleSubmit = async () => {
    if (!clienteNombre.trim()) {
      alert('Por favor ingresa el nombre del cliente')
      return
    }

    if (!usuario) {
      alert('Error: No hay usuario autenticado')
      return
    }

    setSaving(true)
    try {
      // Guardar en la base de datos
      const response = await apiService.crearAtencionMostrador({
        cliente_nombre: clienteNombre.trim(),
        tipo: tipoAtencion,
        usuario_id: usuario.id,
        usuario_nombre: nombreVisible,
        orden_id: ordenId ? parseInt(ordenId) : undefined,
        notas: notas.trim() || undefined
      })

      if (!response.success) {
        throw new Error(response.error || 'Error al registrar la atención')
      }

      // Migrar datos antiguos de localStorage a la base de datos (solo una vez)
      try {
        const atencionesGuardadas = localStorage.getItem('atenciones_mostrador')
        if (atencionesGuardadas) {
          const todasAtenciones = JSON.parse(atencionesGuardadas)
          if (Array.isArray(todasAtenciones) && todasAtenciones.length > 0) {
            // Migrar datos antiguos
            for (const atencion of todasAtenciones) {
              if (atencion.usuario_id && atencion.usuario_nombre) {
                await apiService.crearAtencionMostrador({
                  cliente_nombre: atencion.cliente_nombre,
                  tipo: atencion.tipo,
                  usuario_id: atencion.usuario_id,
                  usuario_nombre: atencion.usuario_nombre,
                  orden_id: atencion.orden_id,
                  notas: atencion.notas
                })
              }
            }
            // Marcar como migrado
            localStorage.setItem('atenciones_mostrador_migrado', 'true')
          }
        }
      } catch (migrateError) {
        console.warn('Error migrando datos antiguos:', migrateError)
        // No fallar si la migración falla
      }

      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error registrando atención:', error)
      alert('Error al registrar la atención. Por favor intenta nuevamente.')
    } finally {
      setSaving(false)
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
      <div className="modal-content registrar-atencion-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>📝 Registrar Atención</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <div className="form-group">
            <label>Tipo de Atención *</label>
            <div className="tipo-buttons">
              <button
                type="button"
                className={`tipo-btn ${tipoAtencion === 'virtual' ? 'active' : ''}`}
                onClick={() => setTipoAtencion('virtual')}
              >
                💻 Virtual
              </button>
              <button
                type="button"
                className={`tipo-btn ${tipoAtencion === 'consulta' ? 'active' : ''}`}
                onClick={() => setTipoAtencion('consulta')}
              >
                ❓ Solo Consulta
              </button>
              <button
                type="button"
                className={`tipo-btn ${tipoAtencion === 'venta' ? 'active' : ''}`}
                onClick={() => setTipoAtencion('venta')}
              >
                💰 Venta Concretada
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>N° OP (opcional)</label>
            <div className="search-orden">
              <input
                type="text"
                value={ordenId}
                onChange={(e) => setOrdenId(e.target.value)}
                onBlur={buscarOrden}
                placeholder="Ingresa el número de OP"
                disabled={buscandoOrden}
              />
              {buscandoOrden && <span className="loading">Buscando...</span>}
              {ordenEncontrada && (
                <div className="orden-info">
                  ✓ OP #{ordenEncontrada.numero_op} - {ordenEncontrada.cliente}
                </div>
              )}
              {ordenId && !buscandoOrden && !ordenEncontrada && (
                <div className="orden-error">
                  ✗ Orden no encontrada
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Nombre del Cliente *</label>
            <input
              type="text"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Nombre completo del cliente"
              disabled={!!ordenEncontrada}
            />
          </div>

          <div className="form-group">
            <label>Notas (opcional)</label>
            <textarea
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Información adicional sobre la atención..."
            />
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving || !clienteNombre.trim()}
          >
            {saving ? 'Guardando...' : 'Registrar Atención'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default RegistrarAtencionModal
