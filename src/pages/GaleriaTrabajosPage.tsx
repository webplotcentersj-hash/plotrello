import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { TrabajoGaleria, CategoriaGaleria } from '../types/api'
import './GaleriaTrabajosPage.css'

const GaleriaTrabajosPage = () => {
  const navigate = useNavigate()
  const { usuario, isDiseno, isAdmin } = useAuth()
  const [trabajos, setTrabajos] = useState<TrabajoGaleria[]>([])
  const [categorias, setCategorias] = useState<CategoriaGaleria[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  const [soloDestacados, setSoloDestacados] = useState(false)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState<TrabajoGaleria | null>(null)

  useEffect(() => {
    loadCategorias()
    loadTrabajos()
  }, [categoriaFiltro, soloDestacados])

  const loadTrabajos = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerTrabajosGaleria({
        categoria: categoriaFiltro || undefined,
        solo_destacados: soloDestacados,
        solo_publicos: !isAdmin && !isDiseno, // Solo admin y diseño ven trabajos no públicos
        limit: 100
      })
      if (response.success && response.data) {
        setTrabajos(response.data)
      }
    } catch (error) {
      console.error('Error cargando trabajos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategorias = async () => {
    try {
      const response = await apiService.obtenerCategoriasGaleria()
      if (response.success && response.data) {
        setCategorias(response.data)
      }
    } catch (error) {
      console.error('Error cargando categorías:', error)
    }
  }

  const handleTrabajoClick = (trabajo: TrabajoGaleria) => {
    setTrabajoSeleccionado(trabajo)
    setMostrarModal(true)
  }

  const handleCerrarModal = () => {
    setMostrarModal(false)
    setTrabajoSeleccionado(null)
  }

  if (loading) {
    return (
      <div className="galeria-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando galería...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="galeria-page">
      <header className="galeria-header">
        <div className="header-content">
          <h1>🎨 Galería de Trabajos Completados</h1>
          <button 
            className="btn-back"
            onClick={() => navigate('/')}
          >
            ← Volver al Tablero
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="filtros-section">
        <div className="filtros-container">
          <div className="filtro-group">
            <label>Categoría</label>
            <select
              value={categoriaFiltro || ''}
              onChange={(e) => setCategoriaFiltro(e.target.value || null)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((cat) => (
                <option key={cat.categoria} value={cat.categoria}>
                  {cat.categoria} ({cat.cantidad})
                </option>
              ))}
            </select>
          </div>
          <div className="filtro-group">
            <label>
              <input
                type="checkbox"
                checked={soloDestacados}
                onChange={(e) => setSoloDestacados(e.target.checked)}
              />
              Solo destacados
            </label>
          </div>
        </div>
      </div>

      {/* Grid de trabajos */}
      {trabajos.length === 0 ? (
        <div className="empty-state">
          <p>No hay trabajos en la galería aún.</p>
        </div>
      ) : (
        <div className="galeria-grid">
          {trabajos.map((trabajo) => (
            <div
              key={trabajo.id}
              className={`trabajo-card ${trabajo.destacado ? 'destacado' : ''}`}
              onClick={() => handleTrabajoClick(trabajo)}
            >
              {trabajo.destacado && (
                <div className="badge-destacado">⭐ Destacado</div>
              )}
              <div className="trabajo-imagen-container">
                <img src={trabajo.imagen_url} alt={trabajo.titulo || trabajo.cliente} />
              </div>
              <div className="trabajo-info">
                <h3>{trabajo.titulo || `OP ${trabajo.numero_op}`}</h3>
                <p className="trabajo-cliente">{trabajo.cliente}</p>
                {trabajo.categoria && (
                  <span className="trabajo-categoria">{trabajo.categoria}</span>
                )}
                {trabajo.tags && trabajo.tags.length > 0 && (
                  <div className="trabajo-tags">
                    {trabajo.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="trabajo-fecha">
                  {new Date(trabajo.fecha_completado).toLocaleDateString('es-AR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle */}
      {mostrarModal && trabajoSeleccionado && (
        <div className="modal-overlay" onClick={handleCerrarModal}>
          <div className="modal-content-galeria" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCerrarModal}>×</button>
            <div className="modal-imagen">
              <img src={trabajoSeleccionado.imagen_url} alt={trabajoSeleccionado.titulo || trabajoSeleccionado.cliente} />
            </div>
            <div className="modal-info">
              <h2>{trabajoSeleccionado.titulo || `OP ${trabajoSeleccionado.numero_op}`}</h2>
              <p className="modal-cliente">{trabajoSeleccionado.cliente}</p>
              {trabajoSeleccionado.descripcion && (
                <p className="modal-descripcion">{trabajoSeleccionado.descripcion}</p>
              )}
              <div className="modal-meta">
                {trabajoSeleccionado.categoria && (
                  <div className="meta-item">
                    <strong>Categoría:</strong> {trabajoSeleccionado.categoria}
                  </div>
                )}
                <div className="meta-item">
                  <strong>Fecha:</strong> {new Date(trabajoSeleccionado.fecha_completado).toLocaleDateString('es-AR')}
                </div>
                {trabajoSeleccionado.usuario_subio_nombre && (
                  <div className="meta-item">
                    <strong>Subido por:</strong> {trabajoSeleccionado.usuario_subio_nombre}
                  </div>
                )}
                {trabajoSeleccionado.tags && trabajoSeleccionado.tags.length > 0 && (
                  <div className="meta-item">
                    <strong>Tags:</strong>
                    <div className="tags-container">
                      {trabajoSeleccionado.tags.map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GaleriaTrabajosPage

