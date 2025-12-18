import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord, ArticuloEmpresaImagenRecord } from '../types/api'
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
    subcategoria: '',
    precio_base: '',
    imagen_url: '',
    tiempo_estimado_dias: '',
    requiere_archivos: false,
    visible_clientes: true,
    activo: true
  })
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([])
  const [subcategoriasDisponibles, setSubcategoriasDisponibles] = useState<string[]>([])
  const [categoriaInputValue, setCategoriaInputValue] = useState('')
  const [subcategoriaInputValue, setSubcategoriaInputValue] = useState('')
  const [imagenFile, setImagenFile] = useState<File | null>(null)
  const [imagenFiles, setImagenFiles] = useState<File[]>([])
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [imagenPreviews, setImagenPreviews] = useState<string[]>([])
  const [imagenesArticulo, setImagenesArticulo] = useState<ArticuloEmpresaImagenRecord[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadArticulos()
    loadCategorias()
  }, [navigate, isAdmin, isMostrador, authLoading])

  useEffect(() => {
    if (formData.categoria) {
      loadSubcategorias(formData.categoria)
    } else {
      setSubcategoriasDisponibles([])
    }
  }, [formData.categoria])

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getArticulosEmpresa(undefined, true) // Incluir inactivos
      if (response.success && response.data) {
        // Cargar imágenes de galería para cada artículo
        const articulosConImagenes = await Promise.all(
          response.data.map(async (articulo) => {
            const imagenesResponse = await apiService.obtenerImagenesArticuloEmpresa(articulo.id)
            return {
              ...articulo,
              imagenesGaleria: imagenesResponse.success && imagenesResponse.data 
                ? imagenesResponse.data 
                : []
            }
          })
        )
        setArticulos(articulosConImagenes)
      } else {
        setError(response.error || 'Error al cargar artículos')
      }
    } catch (err) {
      setError('Error de conexión al cargar artículos')
    } finally {
      setLoading(false)
    }
  }

  const loadCategorias = async () => {
    try {
      const response = await apiService.obtenerCategoriasArticulos()
      if (response.success && response.data) {
        setCategoriasDisponibles(response.data)
      }
    } catch (err) {
      console.error('Error cargando categorías:', err)
    }
  }

  const loadSubcategorias = async (categoria: string) => {
    try {
      const response = await apiService.obtenerSubcategoriasArticulos(categoria)
      if (response.success && response.data) {
        setSubcategoriasDisponibles(response.data)
      }
    } catch (err) {
      console.error('Error cargando subcategorías:', err)
    }
  }

  const categorias = Array.from(new Set(articulos.map(a => a.categoria).filter(Boolean))) as string[]
  
  // Actualizar categorías disponibles cuando cambian los artículos
  useEffect(() => {
    const categoriasArticulos = Array.from(new Set(articulos.map(a => a.categoria).filter(Boolean))) as string[]
    setCategoriasDisponibles(prev => {
      const todas = [...new Set([...prev, ...categoriasArticulos])]
      return todas.sort()
    })
  }, [articulos])

  const articulosFiltrados = articulos.filter(articulo => {
    const matchBusqueda = !searchQuery || 
      articulo.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      articulo.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      articulo.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategoria = !categoriaFiltro || articulo.categoria === categoriaFiltro
    return matchBusqueda && matchCategoria
  })

  const abrirModalNuevo = async () => {
    setEditingArticulo(null)
    
    // Generar código automático
    const codigoResponse = await apiService.generarCodigoArticulo()
    const codigoGenerado = codigoResponse.success ? codigoResponse.data! : ''
    
    setFormData({
      codigo: codigoGenerado,
      nombre: '',
      descripcion: '',
      categoria: '',
      subcategoria: '',
      precio_base: '',
      imagen_url: '',
      tiempo_estimado_dias: '',
      requiere_archivos: false,
      visible_clientes: true,
      activo: true
    })
    setCategoriaInputValue('')
    setSubcategoriaInputValue('')
    setImagenFile(null)
    setImagenPreview(null)
    setError('')
    setShowCreateModal(true)
  }

  const abrirModalEditar = async (articulo: ArticuloEmpresaRecord) => {
    setEditingArticulo(articulo)
    setFormData({
      codigo: articulo.codigo,
      nombre: articulo.nombre,
      descripcion: articulo.descripcion || '',
      categoria: articulo.categoria || '',
      subcategoria: articulo.subcategoria || '',
      precio_base: articulo.precio_base?.toString() || '',
      imagen_url: articulo.imagen_url || '',
      tiempo_estimado_dias: articulo.tiempo_estimado_dias?.toString() || '',
      requiere_archivos: articulo.requiere_archivos,
      visible_clientes: articulo.visible_clientes,
      activo: articulo.activo
    })
    setCategoriaInputValue(articulo.categoria || '')
    setSubcategoriaInputValue(articulo.subcategoria || '')
    setImagenFile(null)
    setImagenFiles([])
    setImagenPreview(articulo.imagen_url || null)
    setImagenPreviews([])
    setError('')
    setShowCreateModal(true)
    
    // Cargar imágenes del artículo
    const imagenesResponse = await apiService.obtenerImagenesArticuloEmpresa(articulo.id)
    if (imagenesResponse.success && imagenesResponse.data) {
      setImagenesArticulo(imagenesResponse.data)
      setImagenPreviews(imagenesResponse.data.map(img => img.imagen_url))
    } else {
      setImagenesArticulo([])
      setImagenPreviews([])
    }
  }

  const cerrarModal = () => {
    setShowCreateModal(false)
    setEditingArticulo(null)
    setCategoriaInputValue('')
    setSubcategoriaInputValue('')
    setImagenFile(null)
    setImagenFiles([])
    setImagenPreview(null)
    setImagenPreviews([])
    setImagenesArticulo([])
    setError('')
  }

  const handleCategoriaChange = async (value: string) => {
    setCategoriaInputValue(value)
    setFormData({ ...formData, categoria: value, subcategoria: '' }) // Limpiar subcategoría al cambiar categoría
    setSubcategoriaInputValue('')
    
    // Guardar categoría automáticamente si no está en la lista
    if (value && !categoriasDisponibles.includes(value)) {
      await apiService.guardarCategoriaArticulo(value)
      loadCategorias() // Recargar lista
    }
    
    // Cargar subcategorías si hay categoría seleccionada
    if (value) {
      loadSubcategorias(value)
    }
  }

  const handleSubcategoriaChange = async (value: string) => {
    setSubcategoriaInputValue(value)
    setFormData({ ...formData, subcategoria: value })
    
    // Guardar subcategoría automáticamente si no está en la lista
    if (value && formData.categoria && !subcategoriasDisponibles.includes(value)) {
      await apiService.guardarSubcategoriaArticulo(formData.categoria, value)
      loadSubcategorias(formData.categoria) // Recargar lista
    }
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

  const handleMultipleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      const validFiles: File[] = []
      let errorFound = false

      // Primero validar todos los archivos
      files.forEach((file) => {
        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
          setError(`El archivo ${file.name} no es una imagen válida`)
          errorFound = true
          return
        }

        // Validar tamaño (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError(`La imagen ${file.name} no debe superar los 5MB`)
          errorFound = true
          return
        }

        validFiles.push(file)
      })

      if (errorFound) {
        return
      }

      // Si todos los archivos son válidos, crear previews
      const previewPromises = validFiles.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            resolve(reader.result as string)
          }
          reader.readAsDataURL(file)
        })
      })

      Promise.all(previewPromises).then((previews) => {
        setImagenPreviews((prev) => [...prev, ...previews])
        setImagenFiles((prev) => [...prev, ...validFiles])
        setError('')
      })

      // Limpiar el input para permitir seleccionar los mismos archivos de nuevo si es necesario
      e.target.value = ''
    }
  }

  const handleEliminarImagenPreview = (index: number) => {
    const nuevasPreviews = [...imagenPreviews]
    const nuevosFiles = [...imagenFiles]
    nuevasPreviews.splice(index, 1)
    nuevosFiles.splice(index, 1)
    setImagenPreviews(nuevasPreviews)
    setImagenFiles(nuevosFiles)
  }

  const handleEliminarImagenArticulo = async (idImagen: number, index: number) => {
    const response = await apiService.eliminarImagenArticuloEmpresa(idImagen)
    if (response.success) {
      const nuevasImagenes = [...imagenesArticulo]
      nuevasImagenes.splice(index, 1)
      setImagenesArticulo(nuevasImagenes)
      
      const nuevasPreviews = [...imagenPreviews]
      if (nuevasPreviews.length > index) {
        nuevasPreviews.splice(index, 1)
        setImagenPreviews(nuevasPreviews)
      }
    } else {
      setError(response.error || 'Error al eliminar la imagen')
    }
  }

  const handleSubirGaleriaImagenes = async () => {
    if (imagenFiles.length === 0 || !editingArticulo) return

    setUploadingImages(true)
    setError('')

    try {
      for (let i = 0; i < imagenFiles.length; i++) {
        const file = imagenFiles[i]
        const uploadResponse = await apiService.uploadImagenArticuloEmpresa(
          file,
          editingArticulo.id
        )

        if (uploadResponse.success && uploadResponse.data) {
          const agregarResponse = await apiService.agregarImagenArticuloEmpresa(
            editingArticulo.id,
            uploadResponse.data,
            imagenesArticulo.length + i
          )

          if (agregarResponse.success && agregarResponse.data) {
            setImagenesArticulo([...imagenesArticulo, agregarResponse.data])
          }
        } else {
          setError(uploadResponse.error || 'Error al subir imagen')
          setUploadingImages(false)
          return
        }
      }

      setImagenFiles([])
      setImagenPreviews([])
      setError('')
    } catch (err) {
      setError('Error al subir las imágenes')
    } finally {
      setUploadingImages(false)
    }
  }

  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    
    // Asegurar que el código esté generado si no existe
    if (!formData.codigo.trim() && !editingArticulo) {
      const codigoResponse = await apiService.generarCodigoArticulo()
      if (codigoResponse.success && codigoResponse.data) {
        setFormData({ ...formData, codigo: codigoResponse.data })
      } else {
        setError('Error al generar código automático')
        return
      }
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
          subcategoria: formData.subcategoria.trim() || undefined,
          precio_base: formData.precio_base ? parseFloat(formData.precio_base) : undefined,
          imagen_url: imagenUrlFinal.trim() || undefined,
          tiempo_estimado_dias: formData.tiempo_estimado_dias ? parseInt(formData.tiempo_estimado_dias) : undefined,
          requiere_archivos: formData.requiere_archivos,
          visible_clientes: formData.visible_clientes,
          activo: formData.activo
        })
      } else {
        // Crear (código se genera automáticamente si no se proporciona)
        response = await apiService.crearArticuloEmpresa({
          codigo: formData.codigo.trim() || undefined, // Si está vacío, se genera automático
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || undefined,
          categoria: formData.categoria.trim() || undefined,
          subcategoria: formData.subcategoria.trim() || undefined,
          precio_base: formData.precio_base ? parseFloat(formData.precio_base) : undefined,
          imagen_url: imagenUrlFinal.trim() || undefined,
          tiempo_estimado_dias: formData.tiempo_estimado_dias ? parseInt(formData.tiempo_estimado_dias) : undefined,
          requiere_archivos: formData.requiere_archivos,
          visible_clientes: formData.visible_clientes
        })

        // Si se creó exitosamente y hay imágenes para subir, subirlas a la galería
        if (response.success && response.data && imagenFiles.length > 0) {
          const nuevoArticuloId = response.data.id
          for (let i = 0; i < imagenFiles.length; i++) {
            const file = imagenFiles[i]
            const uploadResponse = await apiService.uploadImagenArticuloEmpresa(
              file,
              nuevoArticuloId
            )

            if (uploadResponse.success && uploadResponse.data) {
              await apiService.agregarImagenArticuloEmpresa(
                nuevoArticuloId,
                uploadResponse.data,
                i
              )
            }
          }
        }
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
              className="btn-secondary"
              onClick={() => navigate('/clientes-web/categorias')}
            >
              📁 Categorías
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
              <div className="articulo-imagen">
                {((articulo as any).imagenesGaleria && (articulo as any).imagenesGaleria.length > 0) ? (
                  <>
                    <img 
                      src={(articulo as any).imagenesGaleria[0].imagen_url} 
                      alt={articulo.nombre}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        // Si falla la primera imagen de galería, intentar con imagen_url
                        if (articulo.imagen_url && target.src !== articulo.imagen_url) {
                          target.src = articulo.imagen_url
                        } else {
                          // Si también falla imagen_url, ocultar
                          target.style.display = 'none'
                        }
                      }}
                    />
                    {(articulo as any).imagenesGaleria.length > 1 && (
                      <div className="imagen-count-badge">
                        +{(articulo as any).imagenesGaleria.length - 1}
                      </div>
                    )}
                  </>
                ) : articulo.imagen_url ? (
                  <img 
                    src={articulo.imagen_url} 
                    alt={articulo.nombre}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="no-imagen-placeholder">
                    <span>📷</span>
                    <span>Sin imagen</span>
                  </div>
                )}
              </div>
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
                {(articulo.categoria || articulo.subcategoria) && (
                  <p className="articulo-categoria">
                    {articulo.categoria}
                    {articulo.subcategoria && ` → ${articulo.subcategoria}`}
                  </p>
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
                    placeholder="Se genera automáticamente"
                    readOnly={!editingArticulo}
                    className={!editingArticulo ? 'readonly-input' : ''}
                    required
                  />
                  {!editingArticulo && (
                    <small className="input-hint">El código se genera automáticamente</small>
                  )}
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
                    list="categorias-list"
                    value={categoriaInputValue}
                    onChange={(e) => handleCategoriaChange(e.target.value)}
                    onBlur={(e) => {
                      // Guardar automáticamente al perder foco si hay valor
                      if (e.target.value.trim()) {
                        handleCategoriaChange(e.target.value.trim())
                      }
                    }}
                    placeholder="Escribe o selecciona una categoría"
                    className="autocomplete-input"
                  />
                  <datalist id="categorias-list">
                    {categoriasDisponibles.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                  <small className="input-hint">Se guarda automáticamente al escribir</small>
                </div>

                {formData.categoria && (
                  <div className="form-group">
                    <label>Subcategoría</label>
                    <input
                      type="text"
                      list="subcategorias-list"
                      value={subcategoriaInputValue}
                      onChange={(e) => handleSubcategoriaChange(e.target.value)}
                      onBlur={(e) => {
                        // Guardar automáticamente al perder foco si hay valor
                        if (e.target.value.trim() && formData.categoria) {
                          handleSubcategoriaChange(e.target.value.trim())
                        }
                      }}
                      placeholder="Escribe o selecciona una subcategoría"
                      className="autocomplete-input"
                    />
                    <datalist id="subcategorias-list">
                      {subcategoriasDisponibles.map((subcat) => (
                        <option key={subcat} value={subcat} />
                      ))}
                    </datalist>
                    <small className="input-hint">Se guarda automáticamente al escribir</small>
                  </div>
                )}

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
                  <label>Galería de Imágenes del Artículo</label>
                  
                  {/* Galería de imágenes existentes */}
                  {editingArticulo && imagenesArticulo.length > 0 && (
                    <div className="galeria-imagenes-container">
                      <h4 className="galeria-title">Imágenes actuales:</h4>
                      <div className="galeria-grid">
                        {imagenesArticulo.map((imagen, index) => (
                          <div key={imagen.id} className="galeria-item">
                            <img 
                              src={imagen.imagen_url} 
                              alt={`Imagen ${index + 1}`} 
                              className="galeria-imagen"
                            />
                            <button
                              type="button"
                              className="btn-remove-galeria-image"
                              onClick={() => handleEliminarImagenArticulo(imagen.id, index)}
                              title="Eliminar imagen"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview de nuevas imágenes */}
                  {imagenPreviews.length > 0 && (
                    <div className="galeria-imagenes-container">
                      <h4 className="galeria-title">Nuevas imágenes a subir:</h4>
                      <div className="galeria-grid">
                        {imagenPreviews.map((preview, index) => (
                          <div key={index} className="galeria-item">
                            <img 
                              src={preview} 
                              alt={`Preview ${index + 1}`} 
                              className="galeria-imagen"
                            />
                            <button
                              type="button"
                              className="btn-remove-galeria-image"
                              onClick={() => handleEliminarImagenPreview(index)}
                              title="Remover de la lista"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview de imagen única (solo si no hay galería) */}
                  {(imagenPreview || formData.imagen_url) && imagenPreviews.length === 0 && (
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

                  {/* Input para subir múltiples archivos (siempre disponible) */}
                  <div className="file-upload-section">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleImagesChange}
                      className="file-input"
                      id="galeria-articulo"
                    />
                    <label htmlFor="galeria-articulo" className="file-input-label">
                      📷 {imagenFiles.length > 0 ? `${imagenFiles.length} imagen(es) seleccionada(s)` : 'Seleccionar múltiples imágenes'}
                    </label>
                    {editingArticulo && imagenFiles.length > 0 && (
                      <button
                        type="button"
                        className="btn-upload-image"
                        onClick={handleSubirGaleriaImagenes}
                        disabled={uploadingImages}
                      >
                        {uploadingImages ? 'Subiendo...' : `⬆️ Subir ${imagenFiles.length} Imagen(es)`}
                      </button>
                    )}
                  </div>

                  {/* Input para subir archivo único (alternativa) */}
                  {!editingArticulo && (
                    <div className="file-upload-section" style={{ marginTop: '12px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="file-input"
                        id="imagen-articulo"
                      />
                      <label htmlFor="imagen-articulo" className="file-input-label">
                        📷 {imagenFile ? imagenFile.name : 'O seleccionar una sola imagen'}
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
                  )}

                  {/* O usar URL */}
                  {!editingArticulo && (
                    <div className="url-alternative">
                      <p className="url-label">O ingresa una URL:</p>
                      <input
                        type="url"
                        value={formData.imagen_url}
                        onChange={(e) => {
                          setFormData({ ...formData, imagen_url: e.target.value })
                          if (!imagenFile && imagenPreviews.length === 0) {
                            setImagenPreview(e.target.value || null)
                          }
                        }}
                        placeholder="https://..."
                        disabled={!!imagenFile || imagenPreviews.length > 0}
                      />
                    </div>
                  )}
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

