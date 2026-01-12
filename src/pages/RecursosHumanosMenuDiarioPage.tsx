import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuSeleccion } from '../types/api'
import jsPDF from 'jspdf'
import './RecursosHumanosMenuDiarioPage.css'

const RecursosHumanosMenuDiarioPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [menuHoy, setMenuHoy] = useState<MenuDiario | null>(null)
  const [selecciones, setSelecciones] = useState<MenuSeleccion[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showSelecciones, setShowSelecciones] = useState(false)
  const [platos, setPlatos] = useState<string[]>([''])

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadMenuHoy()
  }, [canManageRecursosHumanos, navigate, authLoading])

  const loadMenuHoy = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerMenuDiaActual()
      if (response.success && response.data) {
        setMenuHoy(response.data)
        if (response.data.platos && response.data.platos.length > 0) {
          setPlatos(response.data.platos.map(p => p.nombre_plato))
        } else {
          setPlatos([''])
        }
      } else {
        setMenuHoy(null)
        setPlatos([''])
      }
    } catch (error) {
      console.error('Error cargando menú:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelecciones = async () => {
    if (!menuHoy) return
    const response = await apiService.obtenerSeleccionesMenu(menuHoy.id)
    if (response.success && response.data) {
      setSelecciones(response.data)
    }
  }

  const handleNuevoMenu = () => {
    setPlatos([''])
    setShowModal(true)
  }

  const handleEditarMenu = () => {
    if (menuHoy && menuHoy.platos && menuHoy.platos.length > 0) {
      setPlatos(menuHoy.platos.map(p => p.nombre_plato))
    } else {
      setPlatos([''])
    }
    setShowModal(true)
  }

  const handleAgregarPlato = () => {
    setPlatos([...platos, ''])
  }

  const handleEliminarPlato = (index: number) => {
    if (platos.length > 1) {
      setPlatos(platos.filter((_, i) => i !== index))
    }
  }

  const handleCambiarPlato = (index: number, valor: string) => {
    const nuevosPlatos = [...platos]
    nuevosPlatos[index] = valor
    setPlatos(nuevosPlatos)
  }

  const handleGuardarMenu = async () => {
    if (!usuario?.id) return
    
    const platosFiltrados = platos.filter(p => p && p.trim() !== '')
    if (platosFiltrados.length === 0) {
      alert('Debes agregar al menos un plato')
      return
    }

    const response = await apiService.crearActualizarMenuDiario(
      platosFiltrados,
      usuario.id
    )

    if (response.success) {
      alert('Menú guardado correctamente')
      setShowModal(false)
      loadMenuHoy()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleVerSelecciones = async () => {
    await loadSelecciones()
    setShowSelecciones(true)
  }

  const handleDescargarPDF = async () => {
    if (!menuHoy) return
    
    await loadSelecciones()
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let yPos = margin

    // Título
    doc.setFontSize(18)
    doc.text('Menú Diario', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Fecha
    doc.setFontSize(12)
    const fechaFormateada = new Date(menuHoy.fecha).toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    doc.text(`Fecha: ${fechaFormateada}`, margin, yPos)
    yPos += 10

    // Menú
    doc.setFontSize(14)
    doc.text('Platos del Día:', margin, yPos)
    yPos += 8
    doc.setFontSize(11)
    
    menuHoy.platos.forEach((plato, index) => {
      doc.text(`${index + 1}. ${plato.nombre_plato}`, margin + 5, yPos)
      yPos += 6
    })

    yPos += 5

    // Selecciones
    doc.setFontSize(14)
    doc.text('Selecciones de Empleados:', margin, yPos)
    yPos += 8

    if (selecciones.length === 0) {
      doc.setFontSize(11)
      doc.text('No hay selecciones registradas', margin + 5, yPos)
    } else {
      doc.setFontSize(10)
      
      // Encabezados de tabla
      doc.setFont('helvetica', 'bold')
      doc.text('Empleado', margin, yPos)
      doc.text('Plato Seleccionado', margin + 80, yPos)
      doc.text('Hora', margin + 140, yPos)
      yPos += 6
      doc.setFont('helvetica', 'normal')
      
      selecciones.forEach((sel) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = margin
        }
        
        doc.text(sel.nombre_usuario || `Usuario ${sel.id_usuario}`, margin, yPos)
        doc.text(sel.nombre_plato || '-', margin + 80, yPos)
        doc.text(new Date(sel.fecha_seleccion).toLocaleTimeString('es-AR'), margin + 140, yPos)
        yPos += 6
      })
    }

    // Guardar PDF
    doc.save(`menu-diario-${menuHoy.fecha}.pdf`)
  }

  if (loading) {
    return (
      <div className="rrhh-menu-page">
        <div className="rrhh-menu-header">
          <h1>🍽️ Menú Diario</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="rrhh-menu-page">
      <div className="rrhh-menu-header">
        <h1>🍽️ Menú Diario</h1>
        <button className="btn-primary" onClick={() => navigate('/rrhh/dashboard')}>
          ← Volver al Dashboard
        </button>
      </div>

      <div className="rrhh-menu-content">
        {/* Menú del día */}
        {menuHoy ? (
          <div className="rrhh-menu-card">
            <div className="rrhh-menu-card-header">
              <h3>Menú del Día - {new Date(menuHoy.fecha).toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</h3>
              <span className="badge-active">Activo</span>
            </div>
            <div className="rrhh-menu-card-body">
              <div className="menu-platos-list">
                {menuHoy.platos && menuHoy.platos.length > 0 ? (
                  menuHoy.platos.map((plato, index) => (
                    <div key={plato.id} className="menu-plato-item">
                      <span className="plato-number">{index + 1}.</span>
                      <span className="plato-name">{plato.nombre_plato}</span>
                    </div>
                  ))
                ) : (
                  <p>No hay platos cargados</p>
                )}
              </div>
              <div className="menu-stats">
                <strong>Total Selecciones:</strong> {menuHoy.total_selecciones || 0}
              </div>
            </div>
            <div className="rrhh-menu-card-actions">
              <button className="btn-secondary" onClick={handleEditarMenu}>
                ✏️ Editar Menú
              </button>
              <button className="btn-secondary" onClick={handleVerSelecciones}>
                👥 Ver Selecciones ({menuHoy.total_selecciones || 0})
              </button>
              <button className="btn-secondary" onClick={handleDescargarPDF}>
                📄 Descargar PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="rrhh-empty-state">
            <p>No hay menú cargado para hoy</p>
            <button className="btn-primary" onClick={handleNuevoMenu}>
              ➕ Crear Menú del Día
            </button>
          </div>
        )}
      </div>

      {/* Modal de selecciones */}
      {showSelecciones && (
        <div className="rrhh-modal-overlay" onClick={() => setShowSelecciones(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Selecciones - {menuHoy && new Date(menuHoy.fecha).toLocaleDateString('es-AR')}</h2>
              <button className="btn-close" onClick={() => setShowSelecciones(false)}>✕</button>
            </div>
            <div className="rrhh-modal-body">
              <table className="rrhh-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Plato Seleccionado</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {selecciones.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center' }}>No hay selecciones registradas</td>
                    </tr>
                  ) : (
                    selecciones.map((sel) => (
                      <tr key={sel.id}>
                        <td>{sel.nombre_usuario || `Usuario ${sel.id_usuario}`}</td>
                        <td>{sel.nombre_plato || '-'}</td>
                        <td>{new Date(sel.fecha_seleccion).toLocaleTimeString('es-AR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de formulario */}
      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Gestionar Menú del Día</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="rrhh-modal-body">
              <div className="form-group">
                <label>Platos del Día *</label>
                <p className="form-help">Agrega los platos disponibles para hoy. Puedes agregar múltiples platos.</p>
                {platos.map((plato, index) => (
                  <div key={index} className="plato-input-group">
                    <input
                      type="text"
                      value={plato}
                      onChange={(e) => handleCambiarPlato(index, e.target.value)}
                      placeholder={`Plato ${index + 1}`}
                      className="plato-input"
                    />
                    {platos.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-plato"
                        onClick={() => handleEliminarPlato(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add-plato"
                  onClick={handleAgregarPlato}
                >
                  ➕ Agregar Otro Plato
                </button>
              </div>
              <div className="rrhh-modal-actions">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleGuardarMenu}>
                  Guardar Menú
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosMenuDiarioPage
