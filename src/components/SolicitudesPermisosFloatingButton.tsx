import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import SolicitudPermisoModal from './SolicitudPermisoModal'
import './SolicitudesPermisosFloatingButton.css'

const SolicitudesPermisosFloatingButton = () => {
  const { usuario } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [pendientesCount, setPendientesCount] = useState(0)

  useEffect(() => {
    if (usuario?.id) {
      loadPendientesCount()
    }
  }, [usuario?.id])

  const loadPendientesCount = async () => {
    if (!usuario?.id) return

    try {
      const response = await apiService.obtenerSolicitudesPermisos(
        usuario.id,
        'pendiente',
        null,
        null,
        null
      )

      if (response.success && response.data) {
        setPendientesCount(response.data.length)
      }
    } catch (error) {
      console.error('Error al cargar solicitudes pendientes:', error)
    }
  }

  // Mostrar el botón siempre que haya un usuario autenticado
  if (!usuario) {
    return null
  }

  return (
    <>
      <button
        className="solicitudes-floating-button"
        onClick={() => setShowModal(true)}
        title="Solicitar Permisos / Turnos / Vacaciones / Ropa"
      >
        <span className="solicitudes-icon">📋</span>
        {pendientesCount > 0 && (
          <span className="solicitudes-badge">{pendientesCount}</span>
        )}
      </button>

      {showModal && (
        <SolicitudPermisoModal
          onClose={() => {
            setShowModal(false)
            loadPendientesCount()
          }}
          onSolicitudCreada={loadPendientesCount}
        />
      )}
    </>
  )
}

export default SolicitudesPermisosFloatingButton

