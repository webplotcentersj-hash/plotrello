import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuSeleccion } from '../types/api'
import './MenuDiarioPage.css'

const MenuDiarioPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuDiario | null>(null)
  const [miSeleccion, setMiSeleccion] = useState<MenuSeleccion | null>(null)
  const [seleccionando, setSeleccionando] = useState(false)
  const [horaActual, setHoraActual] = useState(new Date())
  const [puedeSeleccionar, setPuedeSeleccionar] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/')
      return
    }
    loadMenu()
    // Actualizar hora cada minuto
    const interval = setInterval(() => {
      setHoraActual(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [authLoading, usuario, navigate])

  useEffect(() => {
    // Verificar si puede seleccionar (hasta las 9:30 AM)
    const hora = horaActual.getHours()
    const minutos = horaActual.getMinutes()
    const puede = hora < 9 || (hora === 9 && minutos <= 30)
    setPuedeSeleccionar(puede)
  }, [horaActual])

  const loadMenu = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerMenuDiaActual()
      if (response.success && response.data) {
        setMenu(response.data)
        if (usuario?.id) {
          await loadMiSeleccion(response.data.id, usuario.id)
        }
      } else {
        setMenu(null)
      }
    } catch (error) {
      console.error('Error cargando menú:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMiSeleccion = async (idMenu: number, idUsuario: number) => {
    const response = await apiService.obtenerSeleccionUsuarioMenu(idMenu, idUsuario)
    if (response.success && response.data) {
      setMiSeleccion(response.data)
    } else {
      setMiSeleccion(null)
    }
  }

  const handleSeleccionar = async (seleccion: 'principal' | 'secundario' | 'vegetariano') => {
    if (!usuario?.id || !menu) return
    if (!puedeSeleccionar) {
      alert('El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM')
      return
    }

    setSeleccionando(true)
    try {
      const response = await apiService.seleccionarPlatoMenu(menu.id, usuario.id, seleccion)
      if (response.success && response.data) {
        setMiSeleccion(response.data)
        alert('Selección registrada correctamente')
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error: any) {
      alert('Error: ' + (error.message || 'Error al seleccionar plato'))
    } finally {
      setSeleccionando(false)
    }
  }

  const handleCancelarSeleccion = async () => {
    if (!usuario?.id || !menu || !miSeleccion) return
    if (!puedeSeleccionar) {
      alert('El plazo para cancelar la selección ha expirado. Debes hacerlo antes de las 9:30 AM')
      return
    }

    if (!confirm('¿Estás seguro de cancelar tu selección?')) return

    const response = await apiService.cancelarSeleccionMenu(menu.id, usuario.id)
    if (response.success) {
      setMiSeleccion(null)
      alert('Selección cancelada correctamente')
    } else {
      alert('Error: ' + response.error)
    }
  }

  if (loading) {
    return (
      <div className="menu-diario-page">
        <div className="menu-diario-header">
          <h1>🍽️ Menú Diario</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
      </div>
    )
  }

  const horaFormateada = horaActual.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="menu-diario-page">
      <div className="menu-diario-header">
        <h1>🍽️ Menú Diario</h1>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Volver al Tablero
        </button>
      </div>

      <div className="menu-diario-content">
        {/* Información de horario */}
        <div className="menu-horario-info">
          <div className={`horario-badge ${puedeSeleccionar ? 'horario-activo' : 'horario-expirado'}`}>
            {puedeSeleccionar ? (
              <>
                ⏰ Hora actual: {horaFormateada} - Puedes seleccionar hasta las 9:30 AM
              </>
            ) : (
              <>
                ⏰ Hora actual: {horaFormateada} - El plazo para seleccionar ha expirado
              </>
            )}
          </div>
        </div>

        {!menu ? (
          <div className="menu-empty-state">
            <p>No hay menú disponible para hoy</p>
            <p className="menu-empty-subtitle">El menú será publicado por Recursos Humanos</p>
          </div>
        ) : (
          <>
            {/* Menú del día */}
            <div className="menu-card">
              <div className="menu-card-header">
                <h2>Menú del Día</h2>
                <span className="menu-fecha">
                  {new Date(menu.fecha).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="menu-card-body">
                <div className="menu-item">
                  <span className="menu-item-label">🍽️ Plato Principal:</span>
                  <span className="menu-item-value">{menu.plato_principal}</span>
                </div>
                {menu.plato_secundario && (
                  <div className="menu-item">
                    <span className="menu-item-label">🍽️ Plato Secundario:</span>
                    <span className="menu-item-value">{menu.plato_secundario}</span>
                  </div>
                )}
                {menu.guarnicion && (
                  <div className="menu-item">
                    <span className="menu-item-label">🥔 Guarnición:</span>
                    <span className="menu-item-value">{menu.guarnicion}</span>
                  </div>
                )}
                {menu.ensalada && (
                  <div className="menu-item">
                    <span className="menu-item-label">🥗 Ensalada:</span>
                    <span className="menu-item-value">{menu.ensalada}</span>
                  </div>
                )}
                {menu.postre && (
                  <div className="menu-item">
                    <span className="menu-item-label">🍰 Postre:</span>
                    <span className="menu-item-value">{menu.postre}</span>
                  </div>
                )}
                {menu.bebida && (
                  <div className="menu-item">
                    <span className="menu-item-label">🥤 Bebida:</span>
                    <span className="menu-item-value">{menu.bebida}</span>
                  </div>
                )}
                {menu.opcion_vegetariana && (
                  <div className="menu-item menu-item-vegetariano">
                    <span className="menu-item-label">🌱 Opción Vegetariana:</span>
                    <span className="menu-item-value">{menu.opcion_vegetariana}</span>
                  </div>
                )}
                {menu.observaciones && (
                  <div className="menu-observaciones">
                    <strong>Observaciones:</strong> {menu.observaciones}
                  </div>
                )}
              </div>
            </div>

            {/* Selección */}
            {miSeleccion ? (
              <div className="menu-seleccion-card">
                <h3>✅ Tu Selección</h3>
                <div className="seleccion-info">
                  <p>
                    <strong>Plato seleccionado:</strong>{' '}
                    {miSeleccion.seleccion === 'principal' ? 'Plato Principal' :
                     miSeleccion.seleccion === 'secundario' ? 'Plato Secundario' : 'Opción Vegetariana'}
                  </p>
                  {miSeleccion.observaciones && (
                    <p>
                      <strong>Observaciones:</strong> {miSeleccion.observaciones}
                    </p>
                  )}
                  <p>
                    <strong>Hora de selección:</strong>{' '}
                    {new Date(miSeleccion.fecha_seleccion).toLocaleTimeString('es-AR')}
                  </p>
                </div>
                {puedeSeleccionar && (
                  <button
                    className="btn-secondary"
                    onClick={handleCancelarSeleccion}
                    disabled={seleccionando}
                  >
                    Cambiar Selección
                  </button>
                )}
              </div>
            ) : puedeSeleccionar ? (
              <div className="menu-seleccion-card">
                <h3>Selecciona tu plato</h3>
                <p className="seleccion-subtitle">
                  Tienes tiempo hasta las 9:30 AM para seleccionar tu plato
                </p>
                <div className="seleccion-buttons">
                  <button
                    className="btn-seleccion btn-seleccion-principal"
                    onClick={() => handleSeleccionar('principal')}
                    disabled={seleccionando}
                  >
                    🍽️ Plato Principal
                  </button>
                  {menu.plato_secundario && (
                    <button
                      className="btn-seleccion btn-seleccion-secundario"
                      onClick={() => handleSeleccionar('secundario')}
                      disabled={seleccionando}
                    >
                      🍽️ Plato Secundario
                    </button>
                  )}
                  {menu.opcion_vegetariana && (
                    <button
                      className="btn-seleccion btn-seleccion-vegetariano"
                      onClick={() => handleSeleccionar('vegetariano')}
                      disabled={seleccionando}
                    >
                      🌱 Opción Vegetariana
                    </button>
                  )}
                </div>
                {seleccionando && <p className="seleccion-loading">Procesando...</p>}
              </div>
            ) : (
              <div className="menu-seleccion-card menu-seleccion-expirada">
                <h3>⏰ Plazo Expirado</h3>
                <p>El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MenuDiarioPage

