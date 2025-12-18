import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord } from '../types/api'
import './ArticulosEmpresaPage.css'

const ArticulosEmpresaPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isMostrador, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingArticulo, setEditingArticulo] = useState<ArticuloEmpresaRecord | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria: '',
    precio_base: '',
    imagen_url: '',
    tiempo_estimado_dias: '',
    requiere_archivos: false,
    visible_clientes: true,
    activo: true
  })
  const [imagenFile, setImagenFile] = useState<File | null>(null)
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadArticulos()
  }, [navigate, isAdmin, isMostrador, authLoading])

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getArticulosEmpresa(undefined, true) // Incluir inactivos
      if (response.success && response.data) {
        setArticulos(response.data)
      } else {
        setError(response.error || 'Error al cargar artículos')
      }
    } catch (err) {
      setError('Error de conexión al cargar artículos')
    } finally {
      setLoading(false)
    }
  }

  const categorias = Array.from(new Set(articulos.map(a => a.categoria).filter(Boolean))) as string[]

  const articulosFiltrados = articulos.filter(articulo => {
    const matchBusqueda = !searchQuery || 
      articulo.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      articulo.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      articulo.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategoria = !categoriaFiltro || articulo.categoria === categoriaFiltro
    return matchBusqueda && matchCategoria
  })

  const abrirModalNuevo = () => {
    setEditingArticulo(null)
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      categoria: '',
      precio_base: '',
      imagen_url: '',
      tiempo_estimado_dias: '',
      requiere_archivos: false,
      visible_clientes: true,
      activo: true
    })
    setImagenFile(null)
    setImagenPreview(null)
    setError('')
    setShowCreateModal(true)
  }

  const abrirModalEditar = (articulo: ArticuloEmpresaRecord) => {
    setEditingArticulo(articulo)
    setFormData({
      codigo: articulo.codigo,
      nombre: articulo.nombre,
      descripcion: articulo.descripcion || '',
      categoria: articulo.categoria || '',
      precio_base: articulo.precio_base?.toString() || '',
      imagen_url: articulo.imagen_url || '',
      tiempo_estimado_dias: articulo.tiempo_estimado_dias?.toString() || '',
      requiere_archivos: articulo.requiere_archivos,
      visible_clientes: articulo.visible_clientes,
      activo: articulo.activo
    })
    setImagenFile(null)
    setImagenPreview(articulo.imagen_url || null)
    setError('')
    setShowCreateModal(true)
  }

  const cerrarModal = () => {
    setShowCreateModal(false)
    setEditingArticulo(null)
    setImagenFile(null)
    setImagenPreview(null)
    setError('')
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona un archivo de imagen')
        return
      }

      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe superar los 5MB')
        return
      }

      setImagenFile(file)
      setError('')

      // Crear preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagenPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubirImagen = async () => {
    if (!imagenFile) return

    setUploadingImage(true)
    setError('')

    try {
      const response = await apiService.uploadImagenArticuloEmpresa(
        imagenFile,
        editingArticulo?.id
      )

      if (response.success && response.data) {
        setFormData({ ...formData, imagen_url: response.data })
        setImagenFile(null)
        setError('')
      } else {
        setError(response.error || 'Error al subir la imagen')
      }
    } catch (err) {
      setError('Error al subir la imagen')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleGuardar = async () => {
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      setError('Código y nombre son obligatorios')
      return
    }

    // Si hay una imagen nueva sin subir, subirla primero
    let imagenUrlFinal = formData.imagen_url
    if (imagenFile && !formData.imagen_url) {
      setUploadingImage(true)
      try {
        const uploadResponse = await apiService.uploadImagenArticuloEmpresa(
          imagenFile,
          editingArticulo?.id
        )
        if (uploadResponse.success && uploadResponse.data) {
          imagenUrlFinal = uploadResponse.data
        } else {
          setError(uploadResponse.error || 'Error al subir la imagen')
          setUploadingImage(false)
          return
        }
      } catch (err) {
        setError('Error al subir la imagen')
        setUploadingImage(false)
        return
      } finally {
        setUploadingImage(false)
      }
    }

    setSaving(true)
    setError('')

    try {
      let response
      if (editingArticulo) {
        // Actualizar
        response = await apiService.actualizarArticuloEmpresa(editingArticulo.id, {
          codigo: formData.codigo.trim(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || undefined,
          categoria: formData.categoria.trim() || undefined,
          precio_base: formData.precio_base ? parseFloat(formData.precio_base) : undefined,
          imagen_url: imagenUrlFinal.trim() || undefined,
          tiempo_estimado_dias: formData.tiempo_estimado_dias ? parseInt(formData.tiempo_estimado_dias) : undefined,
          requiere_archivos: formData.requiere_archivos,
          visible_clientes: formData.visible_clientes,
          activo: formData.activo
        })
      } else {
        // Crear
        response = await apiService.crearArticuloEmpresa({
          codigo: formData.codigo.trim(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || undefined,
          categoria: formData.categoria.trim() || undefined,
          precio_base: formData.precio_base ? parseFloat(formData.precio_base) : undefined,
          imagen_url: imagenUrlFinal.trim() || undefined,
          tiempo_estimado_dias: formData.tiempo_estimado_dias ? parseInt(formData.tiempo_estimado_dias) : undefined,
          requiere_archivos: formData.requiere_archivos,
          visible_clientes: formData.visible_clientes
        })
      }

      if (response.success) {
        cerrarModal()
        loadArticulos()
      } else {
        setError(response.error || 'Error al guardar artículo')
      }
    } catch (err) {
      setError('Error al guardar artículo')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este artículo?')) return

    try {
      const response = await apiService.eliminarArticuloEmpresa(id)
      if (response.success) {
        loadArticulos()
      } else {
        alert(response.error || 'Error al eliminar artículo')
      }
    } catch (err) {
      alert('Error al eliminar artículo')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="articulos-empresa-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="articulos-empresa-page">
      <header className="articulos-empresa-header">
        <div className="header-content">
          <div>
            <h1>Gestión de Artículos de Empresa</h1>
            <p>Administra el catálogo de productos disponibles para clientes</p>
          </div>
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate('/clientes-web/dashboard')}
            >
              ← Volver
            </button>
            <button 
              className="btn-primary"
              onClick={abrirModalNuevo}
            >
              + Nuevo Artículo
            </button>
          </div>
        </div>
      </header>

      <main className="articulos-empresa-main">
        {error && !showCreateModal && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Filtros */}
        <div className="filtros-section">
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Buscar por código, nombre o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {categorias.length > 0 && (
            <div className="categorias-filtros">
              <button
                className={`categoria-btn ${!categoriaFiltro ? 'active' : ''}`}
                onClick={() => setCategoriaFiltro('')}
              >
                Todas
              </button>
              {categorias.map((categoria) => (
                <button
                  key={categoria}
                  className={`categoria-btn ${categoriaFiltro === categoria ? 'active' : ''}`}
                  onClick={() => setCategoriaFiltro(categoria)}
                >
                  {categoria}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista de Artículos */}
        <div className="articulos-grid">
          {articulosFiltrados.map((articulo) => (
            <div key={articulo.id} className={`articulo-card ${!articulo.activo ? 'inactivo' : ''}`}>
              {articulo.imagen_url && (
                <div className="articulo-imagen">
                  <img src={articulo.imagen_url} alt={articulo.nombre} />
                </div>
              )}
              <div className="articulo-content">
                <div className="articulo-header">
                  <div>
                    <h3>{articulo.nombre}</h3>
                    <p className="articulo-codigo">Código: {articulo.codigo}</p>
                  </div>
                  <div className="articulo-badges">
                    {!articulo.activo && <span className="badge badge-inactivo">Inactivo</span>}
                    {articulo.visible_clientes && <span className="badge badge-visible">Visible</span>}
                    {articulo.requiere_archivos && <span className="badge badge-archivos">Requiere Archivos</span>}
                  </div>
                </div>
                {articulo.descripcion && (
                  <p className="articulo-descripcion">{articulo.descripcion}</p>
                )}
                {articulo.categoria && (
                  <p className="articulo-categoria">Categoría: {articulo.categoria}</p>
                )}
                <div className="articulo-info">
                  {articulo.precio_base && (
                    <div className="info-item">
                      <span className="info-label">Precio:</span>
                      <span className="info-value">${articulo.precio_base.toFixed(2)}</span>
                    </div>
                  )}
                  {articulo.tiempo_estimado_dias && (
                    <div className="info-item">
                      <span className="info-label">Tiempo:</span>
                      <span className="info-value">{articulo.tiempo_estimado_dias} días</span>
                    </div>
                  )}
                </div>
                <div className="articulo-actions">
                  <button
                    className="btn-edit"
                    onClick={() => abrirModalEditar(articulo)}
                  >
                    ✏️ Editar
                  </button>
                  {articulo.activo && (
                    <button
                      className="btn-delete"
                      onClick={() => handleEliminar(articulo.id)}
                    >
                      🗑️ Desactivar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {articulosFiltrados.length === 0 && (
          <div className="empty-state">
            <p>No se encontraron artículos</p>
            <button className="btn-primary" onClick={abrirModalNuevo}>
              Crear Primer Artículo
            </button>
          </div>
        )}
      </main>

      {/* Modal de Crear/Editar */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingArticulo ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
              <button className="btn-close" onClick={cerrarModal}>✕</button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Código *</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Código único del artículo"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre del artículo"
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción detallada del artículo"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Ej: Diseño, Impresión, etc."
                  />
                </div>

                <div className="form-group">
                  <label>Precio Base</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_base}
                    onChange={(e) => setFormData({ ...formData, precio_base: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Imagen del Artículo</label>
                  
                  {/* Preview de imagen */}
                  {(imagenPreview || formData.imagen_url) && (
                    <div className="imagen-preview-container">
                      <img 
                        src={imagenPreview || formData.imagen_url} 
                        alt="Preview" 
                        className="imagen-preview"
                      />
                      {imagenFile && (
                        <button
                          type="button"
                          className="btn-remove-image"
                          onClick={() => {
                            setImagenFile(null)
                            setImagenPreview(formData.imagen_url || null)
                          }}
                        >
                          ✕ Remover imagen nueva
                        </button>
                      )}
                    </div>
                  )}

                  {/* Input para subir archivo */}
                  <div className="file-upload-section">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="file-input"
                      id="imagen-articulo"
                    />
                    <label htmlFor="imagen-articulo" className="file-input-label">
                      📷 {imagenFile ? imagenFile.name : 'Seleccionar imagen'}
                    </label>
                    {imagenFile && !formData.imagen_url && (
                      <button
                        type="button"
                        className="btn-upload-image"
                        onClick={handleSubirImagen}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? 'Subiendo...' : '⬆️ Subir Imagen'}
                      </button>
                    )}
                  </div>

                  {/* O usar URL */}
                  <div className="url-alternative">
                    <p className="url-label">O ingresa una URL:</p>
                    <input
                      type="url"
                      value={formData.imagen_url}
                      onChange={(e) => {
                        setFormData({ ...formData, imagen_url: e.target.value })
                        if (!imagenFile) {
                          setImagenPreview(e.target.value || null)
                        }
                      }}
                      placeholder="https://..."
                      disabled={!!imagenFile}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tiempo Estimado (días)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.tiempo_estimado_dias}
                    onChange={(e) => setFormData({ ...formData, tiempo_estimado_dias: e.target.value })}
                    placeholder="Ej: 5"
                  />
                </div>

                <div className="form-group full-width">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requiere_archivos}
                      onChange={(e) => setFormData({ ...formData, requiere_archivos: e.target.checked })}
                    />
                    <span>Requiere archivos adjuntos</span>
                  </label>
                </div>

                <div className="form-group full-width">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.visible_clientes}
                      onChange={(e) => setFormData({ ...formData, visible_clientes: e.target.checked })}
                    />
                    <span>Visible para clientes en el catálogo</span>
                  </label>
                </div>

                {editingArticulo && (
                  <div className="form-group full-width">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      />
                      <span>Activo</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={cerrarModal}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArticulosEmpresaPage

