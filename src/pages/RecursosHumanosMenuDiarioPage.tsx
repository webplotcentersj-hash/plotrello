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
  const [menus, setMenus] = useState<MenuDiario[]>([])
  const [selecciones, setSelecciones] = useState<MenuSeleccion[]>([])
  const [showModal, setShowModal] = useState(false)
  const [menuSeleccionado, setMenuSeleccionado] = useState<MenuDiario | null>(null)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    plato_principal: '',
    plato_secundario: '',
    guarnicion: '',
    ensalada: '',
    postre: '',
    bebida: '',
    opcion_vegetariana: '',
    observaciones: '',
    activo: true
  })
  const [filtros, setFiltros] = useState<{
    fechaDesde: string
    fechaHasta: string
    soloActivos: boolean
  }>({
    fechaDesde: '',
    fechaHasta: '',
    soloActivos: true
  })

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadData()
  }, [canManageRecursosHumanos, navigate, authLoading, filtros.fechaDesde, filtros.fechaHasta, filtros.soloActivos])

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerMenusDiarios(
        filtros.fechaDesde ? filtros.fechaDesde : null,
        filtros.fechaHasta ? filtros.fechaHasta : null,
        filtros.soloActivos
      )
      if (response.success && response.data) {
        setMenus(response.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelecciones = async (idMenu: number) => {
    const response = await apiService.obtenerSeleccionesMenu(idMenu)
    if (response.success && response.data) {
      setSelecciones(response.data)
    }
  }

  const handleNuevoMenu = () => {
    setMenuSeleccionado(null)
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      plato_principal: '',
      plato_secundario: '',
      guarnicion: '',
      ensalada: '',
      postre: '',
      bebida: '',
      opcion_vegetariana: '',
      observaciones: '',
      activo: true
    })
    setShowModal(true)
  }

  const handleEditarMenu = (menu: MenuDiario) => {
    setMenuSeleccionado(menu)
    setFormData({
      fecha: menu.fecha,
      plato_principal: menu.plato_principal,
      plato_secundario: menu.plato_secundario || '',
      guarnicion: menu.guarnicion || '',
      ensalada: menu.ensalada || '',
      postre: menu.postre || '',
      bebida: menu.bebida || '',
      opcion_vegetariana: menu.opcion_vegetariana || '',
      observaciones: menu.observaciones || '',
      activo: menu.activo
    })
    setShowModal(true)
  }

  const handleGuardarMenu = async () => {
    if (!usuario?.id) return
    if (!formData.plato_principal.trim()) {
      alert('El plato principal es obligatorio')
      return
    }

    const response = await apiService.crearActualizarMenuDiario(
      formData.fecha,
      formData.plato_principal,
      usuario.id,
      formData.plato_secundario || null,
      formData.guarnicion || null,
      formData.ensalada || null,
      formData.postre || null,
      formData.bebida || null,
      formData.opcion_vegetariana || null,
      formData.observaciones || null,
      formData.activo
    )

    if (response.success) {
      alert('Menú guardado correctamente')
      setShowModal(false)
      loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleEliminarMenu = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este menú?')) return

    const response = await apiService.eliminarMenuDiario(id)
    if (response.success) {
      alert('Menú eliminado correctamente')
      loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleVerSelecciones = async (menu: MenuDiario) => {
    await loadSelecciones(menu.id)
    setMenuSeleccionado(menu)
  }

  const handleDescargarPDF = async (menu: MenuDiario) => {
    await loadSelecciones(menu.id)
    
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
    const fechaFormateada = new Date(menu.fecha).toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    doc.text(`Fecha: ${fechaFormateada}`, margin, yPos)
    yPos += 10

    // Menú
    doc.setFontSize(14)
    doc.text('Menú del Día:', margin, yPos)
    yPos += 8
    doc.setFontSize(11)
    
    doc.text(`• Plato Principal: ${menu.plato_principal}`, margin + 5, yPos)
    yPos += 6
    if (menu.plato_secundario) {
      doc.text(`• Plato Secundario: ${menu.plato_secundario}`, margin + 5, yPos)
      yPos += 6
    }
    if (menu.guarnicion) {
      doc.text(`• Guarnición: ${menu.guarnicion}`, margin + 5, yPos)
      yPos += 6
    }
    if (menu.ensalada) {
      doc.text(`• Ensalada: ${menu.ensalada}`, margin + 5, yPos)
      yPos += 6
    }
    if (menu.postre) {
      doc.text(`• Postre: ${menu.postre}`, margin + 5, yPos)
      yPos += 6
    }
    if (menu.bebida) {
      doc.text(`• Bebida: ${menu.bebida}`, margin + 5, yPos)
      yPos += 6
    }
    if (menu.opcion_vegetariana) {
      doc.text(`• Opción Vegetariana: ${menu.opcion_vegetariana}`, margin + 5, yPos)
      yPos += 6
    }

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
      doc.text('Selección', margin + 80, yPos)
      doc.text('Observaciones', margin + 120, yPos)
      yPos += 6
      doc.setFont('helvetica', 'normal')
      
      selecciones.forEach((sel) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = margin
        }
        
        const seleccionTexto = sel.seleccion === 'principal' ? 'Principal' :
                               sel.seleccion === 'secundario' ? 'Secundario' : 'Vegetariano'
        
        doc.text(sel.nombre_usuario || `Usuario ${sel.id_usuario}`, margin, yPos)
        doc.text(seleccionTexto, margin + 80, yPos)
        doc.text(sel.observaciones || '-', margin + 120, yPos)
        yPos += 6
      })
    }

    // Guardar PDF
    doc.save(`menu-diario-${menu.fecha}.pdf`)
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
        {/* Filtros */}
        <div className="rrhh-menu-filters">
          <div className="filter-group">
            <label>Fecha Desde:</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>Fecha Hasta:</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={filtros.soloActivos}
                onChange={(e) => setFiltros({ ...filtros, soloActivos: e.target.checked })}
              />
              Solo Activos
            </label>
          </div>
          <button className="btn-primary" onClick={handleNuevoMenu}>
            ➕ Nuevo Menú
          </button>
        </div>

        {/* Lista de menús */}
        <div className="rrhh-menu-list">
          {menus.length === 0 ? (
            <div className="rrhh-empty-state">
              <p>No hay menús registrados</p>
            </div>
          ) : (
            menus.map((menu) => (
              <div key={menu.id} className="rrhh-menu-card">
                <div className="rrhh-menu-card-header">
                  <h3>{new Date(menu.fecha).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</h3>
                  {menu.activo && <span className="badge-active">Activo</span>}
                  {!menu.activo && <span className="badge-inactive">Inactivo</span>}
                </div>
                <div className="rrhh-menu-card-body">
                  <div className="menu-item">
                    <strong>Plato Principal:</strong> {menu.plato_principal}
                  </div>
                  {menu.plato_secundario && (
                    <div className="menu-item">
                      <strong>Plato Secundario:</strong> {menu.plato_secundario}
                    </div>
                  )}
                  {menu.guarnicion && (
                    <div className="menu-item">
                      <strong>Guarnición:</strong> {menu.guarnicion}
                    </div>
                  )}
                  {menu.ensalada && (
                    <div className="menu-item">
                      <strong>Ensalada:</strong> {menu.ensalada}
                    </div>
                  )}
                  {menu.postre && (
                    <div className="menu-item">
                      <strong>Postre:</strong> {menu.postre}
                    </div>
                  )}
                  {menu.bebida && (
                    <div className="menu-item">
                      <strong>Bebida:</strong> {menu.bebida}
                    </div>
                  )}
                  {menu.opcion_vegetariana && (
                    <div className="menu-item">
                      <strong>Opción Vegetariana:</strong> {menu.opcion_vegetariana}
                    </div>
                  )}
                  {menu.observaciones && (
                    <div className="menu-item">
                      <strong>Observaciones:</strong> {menu.observaciones}
                    </div>
                  )}
                  <div className="menu-item">
                    <strong>Total Selecciones:</strong> {menu.total_selecciones || 0}
                  </div>
                </div>
                <div className="rrhh-menu-card-actions">
                  <button className="btn-secondary" onClick={() => handleEditarMenu(menu)}>
                    ✏️ Editar
                  </button>
                  <button className="btn-secondary" onClick={() => handleVerSelecciones(menu)}>
                    👥 Ver Selecciones ({menu.total_selecciones || 0})
                  </button>
                  <button className="btn-secondary" onClick={() => handleDescargarPDF(menu)}>
                    📄 Descargar PDF
                  </button>
                  <button className="btn-danger" onClick={() => handleEliminarMenu(menu.id)}>
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de selecciones */}
      {menuSeleccionado && selecciones.length > 0 && (
        <div className="rrhh-modal-overlay" onClick={() => setMenuSeleccionado(null)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Selecciones - {new Date(menuSeleccionado.fecha).toLocaleDateString('es-AR')}</h2>
              <button className="btn-close" onClick={() => setMenuSeleccionado(null)}>✕</button>
            </div>
            <div className="rrhh-modal-body">
              <table className="rrhh-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Selección</th>
                    <th>Observaciones</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {selecciones.map((sel) => (
                    <tr key={sel.id}>
                      <td>{sel.nombre_usuario || `Usuario ${sel.id_usuario}`}</td>
                      <td>
                        {sel.seleccion === 'principal' ? 'Principal' :
                         sel.seleccion === 'secundario' ? 'Secundario' : 'Vegetariano'}
                      </td>
                      <td>{sel.observaciones || '-'}</td>
                      <td>{new Date(sel.fecha_seleccion).toLocaleTimeString('es-AR')}</td>
                    </tr>
                  ))}
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
              <h2>{menuSeleccionado ? 'Editar Menú' : 'Nuevo Menú'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="rrhh-modal-body">
              <div className="form-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Plato Principal *</label>
                <input
                  type="text"
                  value={formData.plato_principal}
                  onChange={(e) => setFormData({ ...formData, plato_principal: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Plato Secundario</label>
                <input
                  type="text"
                  value={formData.plato_secundario}
                  onChange={(e) => setFormData({ ...formData, plato_secundario: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Guarnición</label>
                <input
                  type="text"
                  value={formData.guarnicion}
                  onChange={(e) => setFormData({ ...formData, guarnicion: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Ensalada</label>
                <input
                  type="text"
                  value={formData.ensalada}
                  onChange={(e) => setFormData({ ...formData, ensalada: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Postre</label>
                <input
                  type="text"
                  value={formData.postre}
                  onChange={(e) => setFormData({ ...formData, postre: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Bebida</label>
                <input
                  type="text"
                  value={formData.bebida}
                  onChange={(e) => setFormData({ ...formData, bebida: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Opción Vegetariana</label>
                <input
                  type="text"
                  value={formData.opcion_vegetariana}
                  onChange={(e) => setFormData({ ...formData, opcion_vegetariana: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  />
                  Activo
                </label>
              </div>
              <div className="rrhh-modal-actions">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleGuardarMenu}>
                  Guardar
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

