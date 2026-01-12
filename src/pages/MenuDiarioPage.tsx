import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuSeleccion } from '../types/api'
import { getArgentinaDate, formatArgentinaTime, formatArgentinaDate, isBeforeArgentinaTime } from '../utils/dateUtils'
import './MenuDiarioPage.css'

const MenuDiarioPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuDiario | null>(null)
  const [miSeleccion, setMiSeleccion] = useState<MenuSeleccion | null>(null)
  const [seleccionando, setSeleccionando] = useState(false)
  const [horaActual, setHoraActual] = useState(getArgentinaDate())
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
      setHoraActual(getArgentinaDate())
    }, 60000)
    return () => clearInterval(interval)
  }, [authLoading, usuario, navigate])

  useEffect(() => {
    // Verificar si puede seleccionar (hasta las 9:30 AM en Argentina)
    const puede = isBeforeArgentinaTime(9, 30)
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

  const handleSeleccionar = async (idPlato: number) => {
    if (!usuario?.id || !menu) return
    if (!puedeSeleccionar) {
      alert('El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina)')
      return
    }

    setSeleccionando(true)
    try {
      const response = await apiService.seleccionarPlatoMenu(menu.id, usuario.id, idPlato)
      if (response.success && response.data) {
        setMiSeleccion(response.data)
        alert('Selección registrada correctamente')
        loadMenu()
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
      alert('El plazo para cancelar la selección ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina)')
      return
    }

    if (!confirm('¿Estás seguro de cancelar tu selección?')) return

    const response = await apiService.cancelarSeleccionMenu(menu.id, usuario.id)
    if (response.success) {
      setMiSeleccion(null)
      alert('Selección cancelada correctamente')
      loadMenu()
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

  const horaFormateada = formatArgentinaTime(horaActual)

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
                ⏰ Hora actual (Argentina): {horaFormateada} - Puedes seleccionar hasta las 9:30 AM
              </>
            ) : (
              <>
                ⏰ Hora actual (Argentina): {horaFormateada} - El plazo para seleccionar ha expirado
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
                  {formatArgentinaDate(menu.fecha)}
                </span>
              </div>
              <div className="menu-card-body">
                <div className="menu-platos-grid">
                  {menu.platos && menu.platos.length > 0 ? (
                    menu.platos.map((plato) => (
                      <div key={plato.id} className="menu-plato-card">
                        <div className="plato-number">{menu.platos.indexOf(plato) + 1}</div>
                        <div className="plato-name">{plato.nombre_plato}</div>
                      </div>
                    ))
                  ) : (
                    <p>No hay platos disponibles</p>
                  )}
                </div>
              </div>
            </div>

            {/* Selección */}
            {miSeleccion ? (
              <div className="menu-seleccion-card">
                <h3>✅ Tu Selección</h3>
                <div className="seleccion-info">
                  <p>
                    <strong>Plato seleccionado:</strong> {miSeleccion.nombre_plato || 'Plato seleccionado'}
                  </p>
                  <p>
                    <strong>Hora de selección:</strong>{' '}
                    {formatArgentinaTime(miSeleccion.fecha_seleccion)}
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
                  Tienes tiempo hasta las 9:30 AM (hora Argentina) para seleccionar tu plato
                </p>
                <div className="seleccion-buttons">
                  {menu.platos && menu.platos.length > 0 ? (
                    menu.platos.map((plato) => (
                      <button
                        key={plato.id}
                        className="btn-seleccion"
                        onClick={() => handleSeleccionar(plato.id)}
                        disabled={seleccionando}
                      >
                        🍽️ {plato.nombre_plato}
                      </button>
                    ))
                  ) : (
                    <p>No hay platos disponibles para seleccionar</p>
                  )}
                </div>
                {seleccionando && <p className="seleccion-loading">Procesando...</p>}
              </div>
            ) : (
              <div className="menu-seleccion-card menu-seleccion-expirada">
                <h3>⏰ Plazo Expirado</h3>
                <p>El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina).</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MenuDiarioPage
