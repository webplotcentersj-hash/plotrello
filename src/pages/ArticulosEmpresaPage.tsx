import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type {
  ArticuloEmpresaRecord,
  ArticuloEmpresaImagenRecord,
  ModoVentaArticulo
} from '../types/api'
import type { ArticuloStock } from '../types/pedidos'
import './ArticulosEmpresaPage.css'

type FiltroCatalogo = 'todos' | 'activos' | 'inactivos' | 'visibles' | 'ocultos'

function articuloCoincideBusqueda(articulo: ArticuloEmpresaRecord, term: string): boolean {
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const haystack = [
    articulo.codigo,
    articulo.nombre,
    articulo.descripcion,
    articulo.categoria,
    articulo.subcategoria
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return tokens.every((t) => haystack.includes(t))
}

const ArticulosEmpresaPage = () => {
  const navigate = useNavigate()
  const { canAccessMostradorViews, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [filtroCatalogo, setFiltroCatalogo] = useState<FiltroCatalogo>('activos')
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
    activo: true,
    id_articulo_stock: '' as string | number,
    modo_venta: 'ambos' as ModoVentaArticulo,
    controla_stock: false,
    unidades_por_venta: '1',
    visible_portal: true,
    visible_web_publica: false,
    visible_totem: false,
    visible_stickers: false
  })
  const [stockArticulos, setStockArticulos] = useState<ArticuloStock[]>([])
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([])
  const [subcategoriasDisponibles, setSubcategoriasDisponibles] = useState<string[]>([])
  const [categoriaInputValue, setCategoriaInputValue] = useState('')
  const [subcategoriaInputValue, setSubcategoriaInputValue] = useState('')
  const [sortField, setSortField] = useState<keyof ArticuloEmpresaRecord | ''>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [imagenFile, setImagenFile] = useState<File | null>(null)
  const [imagenFiles, setImagenFiles] = useState<File[]>([])
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [imagenPreviews, setImagenPreviews] = useState<string[]>([])
  const [imagenesArticulo, setImagenesArticulo] = useState<ArticuloEmpresaImagenRecord[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadArticulos = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiService.getArticulosEmpresa(undefined, true)
      if (response.success && response.data) {
        setArticulos(response.data)
        setError('')
      } else {
        setError(response.error || 'Error al cargar artículos')
      }
    } catch {
      setError('Error de conexión al cargar artículos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccessMostradorViews) {
      navigate('/')
      return
    }
    void loadArticulos()
    void loadCategorias()
  }, [navigate, canAccessMostradorViews, authLoading, loadArticulos])

  useEffect(() => {
    if (!showCreateModal) return
    void (async () => {
      const r = await apiService.getArticulosStock()
      if (r.success && r.data) setStockArticulos(r.data)
    })()
  }, [showCreateModal])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchQuery.trim()), 220)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (formData.categoria) {
      loadSubcategorias(formData.categoria)
    } else {
      setSubcategoriasDisponibles([])
    }
  }, [formData.categoria])

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

  const stats = useMemo(
    () => ({
      total: articulos.length,
      activos: articulos.filter((a) => a.activo).length,
      inactivos: articulos.filter((a) => !a.activo).length,
      visibles: articulos.filter((a) => a.visible_clientes && a.activo).length
    }),
    [articulos]
  )

  const categorias = useMemo(() => {
    const deArticulos = articulos.map((a) => a.categoria).filter(Boolean) as string[]
    return [...new Set([...categoriasDisponibles, ...deArticulos])].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    )
  }, [articulos, categoriasDisponibles])

  // Actualizar categorías disponibles cuando cambian los artículos
  useEffect(() => {
    const categoriasArticulos = Array.from(new Set(articulos.map(a => a.categoria).filter(Boolean))) as string[]
    setCategoriasDisponibles(prev => {
      const todas = [...new Set([...prev, ...categoriasArticulos])]
      return todas.sort()
    })
  }, [articulos])

  const handleSort = (field: keyof ArticuloEmpresaRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const articulosFiltradosYOrdenados = useMemo(() => {
    return articulos
      .filter((articulo) => {
        if (!articuloCoincideBusqueda(articulo, debouncedTerm)) return false
        if (categoriaFiltro && articulo.categoria !== categoriaFiltro) return false
        if (filtroCatalogo === 'activos' && !articulo.activo) return false
        if (filtroCatalogo === 'inactivos' && articulo.activo) return false
        if (filtroCatalogo === 'visibles' && (!articulo.visible_clientes || !articulo.activo)) return false
        if (filtroCatalogo === 'ocultos' && (articulo.visible_clientes || !articulo.activo)) return false
        return true
      })
      .sort((a, b) => {
        if (!sortField) return 0
        const aValue = a[sortField]
        const bValue = b[sortField]
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return sortDirection === 'asc' ? 1 : -1
        if (bValue == null) return sortDirection === 'asc' ? -1 : 1
        let comparison = 0
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue, 'es', { sensitivity: 'base' })
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue
        } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          comparison = aValue === bValue ? 0 : aValue ? 1 : -1
        } else {
          comparison = String(aValue).localeCompare(String(bValue), 'es', { sensitivity: 'base' })
        }
        return sortDirection === 'asc' ? comparison : -comparison
      })
  }, [articulos, debouncedTerm, categoriaFiltro, filtroCatalogo, sortField, sortDirection])

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
      activo: true,
      id_articulo_stock: '',
      modo_venta: 'ambos',
      controla_stock: false,
      unidades_por_venta: '1',
      visible_portal: true,
      visible_web_publica: false,
      visible_totem: false,
      visible_stickers: false
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
    const visiblePortal = articulo.visible_portal ?? articulo.visible_clientes
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
      visible_clientes: visiblePortal,
      activo: articulo.activo,
      id_articulo_stock: articulo.id_articulo_stock ?? '',
      modo_venta: articulo.modo_venta ?? 'ambos',
      controla_stock: articulo.controla_stock ?? false,
      unidades_por_venta: String(articulo.unidades_por_venta ?? 1),
      visible_portal: visiblePortal,
      visible_web_publica: articulo.visible_web_publica ?? false,
      visible_totem: articulo.visible_totem ?? false,
      visible_stickers: articulo.visible_stickers ?? false
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
        const articuloId = editingArticulo?.id ?? response.data?.id
        if (articuloId) {
          const stockId =
            formData.id_articulo_stock === '' || formData.id_articulo_stock == null
              ? null
              : Number(formData.id_articulo_stock)
          const comResp = await apiService.actualizarCamposComercioArticuloEmpresa(articuloId, {
            id_articulo_stock: stockId,
            modo_venta: formData.modo_venta,
            controla_stock: formData.controla_stock,
            unidades_por_venta: parseFloat(formData.unidades_por_venta) || 1,
            visible_portal: formData.visible_portal,
            visible_web_publica: formData.visible_web_publica,
            visible_totem: formData.visible_totem,
            visible_stickers: formData.visible_stickers,
            visible_clientes: formData.visible_portal
          })
          if (!comResp.success) {
            setError(
              comResp.error ||
                'Artículo guardado; aplicá la migración SQL de comercio omnicanal para stock y canales.'
            )
            loadArticulos()
            return
          }
        }
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
      <div className="cae-page cae-loading">
        <div className="cae-spinner" />
        <p>Cargando catálogo…</p>
      </div>
    )
  }

  return (
    <div className="cae-page">
      <div className="cae-shell">
        <header className="cae-header">
          <div className="cae-header__title">
            <span className="cae-header__icon" aria-hidden>
              CAT
            </span>
            <div>
              <h1>Artículos de empresa</h1>
              <p className="cae-header__sub">
                {stats.total} en catálogo · {stats.activos} activos · {stats.visibles} visibles en portal
                {stats.inactivos > 0 ? ` · ${stats.inactivos} inactivos` : ''}
              </p>
            </div>
          </div>
          <div className="cae-header__actions">
            <button type="button" className="cae-btn cae-btn--ghost cae-btn--xs" onClick={() => navigate('/clientes-web/dashboard')}>
              Volver
            </button>
            <button type="button" className="cae-btn cae-btn--ghost cae-btn--xs" onClick={() => navigate('/clientes-web/categorias')}>
              Categorías
            </button>
            <button type="button" className="cae-btn cae-btn--primary cae-btn--xs" onClick={abrirModalNuevo}>
              + Artículo
            </button>
          </div>
        </header>

        {error && !showCreateModal && <div className="cae-alert">{error}</div>}

        <section className="cae-search-hero" aria-label="Buscar artículos">
          <label className="cae-search-hero__wrap">
            <span className="cae-search-hero__label">Buscar en el catálogo</span>
            <input
              type="search"
              className="cae-search-hero__input"
              placeholder="Código, nombre, descripción, categoría… (varias palabras con espacio)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="cae-search-hero__hint">
            Filtrá entre los {stats.total} artículos cargados. Las imágenes de galería se ven al editar.
          </p>
        </section>

        <div className="cae-toolbar">
          <div className="cae-filters">
            <span className="cae-filters__label">Estado</span>
            {(
              [
                ['activos', `Activos (${stats.activos})`],
                ['visibles', `En portal (${stats.visibles})`],
                ['ocultos', 'Ocultos'],
                ['inactivos', `Inactivos (${stats.inactivos})`],
                ['todos', 'Todos']
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`cae-pill${filtroCatalogo === key ? ' cae-pill--active' : ''}`}
                onClick={() => setFiltroCatalogo(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cae-toolbar__right">
            <label className="cae-sort">
              <span className="cae-sort__label">Orden</span>
              <select
                value={sortField}
                onChange={(e) => {
                  const field = e.target.value as keyof ArticuloEmpresaRecord | ''
                  if (field) handleSort(field)
                  else setSortField('')
                }}
                className="cae-sort__select"
              >
                <option value="">Por defecto</option>
                <option value="codigo">Código</option>
                <option value="nombre">Nombre</option>
                <option value="categoria">Categoría</option>
                <option value="precio_base">Precio</option>
              </select>
              {sortField && (
                <button
                  type="button"
                  className="cae-btn cae-btn--ghost cae-btn--xs"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
              )}
            </label>
            <span className="cae-meta">{articulosFiltradosYOrdenados.length} en pantalla</span>
          </div>
        </div>

        {categorias.length > 0 && (
          <div className="cae-cats">
            <span className="cae-cats__label">Categoría</span>
            <button
              type="button"
              className={`cae-pill cae-pill--sm${!categoriaFiltro ? ' cae-pill--active' : ''}`}
              onClick={() => setCategoriaFiltro('')}
            >
              Todas
            </button>
            {categorias.map((categoria) => (
              <button
                key={categoria}
                type="button"
                className={`cae-pill cae-pill--sm${categoriaFiltro === categoria ? ' cae-pill--active' : ''}`}
                onClick={() => setCategoriaFiltro(categoria)}
              >
                {categoria}
              </button>
            ))}
          </div>
        )}

        {articulosFiltradosYOrdenados.length === 0 ? (
          <div className="cae-empty">
            <p>No hay artículos con estos filtros.</p>
            <button type="button" className="cae-btn cae-btn--primary cae-btn--xs" onClick={abrirModalNuevo}>
              + Crear artículo
            </button>
          </div>
        ) : (
          <div className="cae-grid">
            {articulosFiltradosYOrdenados.map((articulo) => (
              <article key={articulo.id} className={`cae-card${!articulo.activo ? ' cae-card--inactive' : ''}`}>
                <div className="cae-card__media">
                  {articulo.imagen_url ? (
                    <img
                      src={articulo.imagen_url}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="cae-card__placeholder" aria-hidden>
                      Sin foto
                    </div>
                  )}
                </div>
                <div className="cae-card__body">
                  <div className="cae-card__head">
                    <div className="cae-card__titles">
                      <h3 className="cae-card__name">{articulo.nombre}</h3>
                      <p className="cae-card__code">{articulo.codigo}</p>
                    </div>
                    <div className="cae-card__badges">
                      {!articulo.activo && <span className="cae-badge cae-badge--muted">Inactivo</span>}
                      {articulo.visible_clientes && articulo.activo && (
                        <span className="cae-badge cae-badge--ok">Portal</span>
                      )}
                      {articulo.requiere_archivos && <span className="cae-badge">Archivos</span>}
                    </div>
                  </div>
                  {articulo.descripcion && <p className="cae-card__desc">{articulo.descripcion}</p>}
                  {(articulo.categoria || articulo.subcategoria) && (
                    <p className="cae-card__cat">
                      {articulo.categoria}
                      {articulo.subcategoria ? ` · ${articulo.subcategoria}` : ''}
                    </p>
                  )}
                  <div className="cae-card__meta">
                    {articulo.precio_base != null && (
                      <span className="cae-card__price">${articulo.precio_base.toFixed(2)}</span>
                    )}
                    {articulo.tiempo_estimado_dias != null && (
                      <span className="cae-card__days">{articulo.tiempo_estimado_dias} d</span>
                    )}
                  </div>
                  <div className="cae-card__actions">
                    <button type="button" className="cae-btn cae-btn--ghost cae-btn--xs" onClick={() => abrirModalEditar(articulo)}>
                      Editar
                    </button>
                    {articulo.activo && (
                      <button type="button" className="cae-btn cae-btn--danger cae-btn--xs" onClick={() => handleEliminar(articulo.id)}>
                        Desactivar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Crear/Editar */}
      {showCreateModal && (
        <div
          className="cae-modal-overlay modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarModal()
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) cerrarModal()
          }}
        >
          <div className="cae-modal modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cae-modal__header modal-header">
              <h2>{editingArticulo ? 'Editar artículo' : 'Nuevo artículo'}</h2>
              <button type="button" className="cae-modal__close btn-close" onClick={cerrarModal} aria-label="Cerrar">
                ✕
              </button>
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

                <div className="cae-form__commerce form-group full-width">
                  <h3 className="cae-form__commerce-title">Comercio omnicanal</h3>
                  <div className="cae-form__commerce-grid">
                    <div className="form-group">
                      <label>Vínculo stock (insumo)</label>
                      <select
                        value={formData.id_articulo_stock === '' ? '' : String(formData.id_articulo_stock)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            id_articulo_stock: e.target.value === '' ? '' : Number(e.target.value)
                          })
                        }
                      >
                        <option value="">Sin vínculo</option>
                        {stockArticulos.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.codigo ? `${s.codigo} · ` : ''}
                            {s.descripcion || `ID ${s.id}`}
                            {s.stock != null ? ` (stock: ${s.stock})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Modo de venta</label>
                      <select
                        value={formData.modo_venta}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            modo_venta: e.target.value as ModoVentaArticulo
                          })
                        }
                      >
                        <option value="compra">Solo compra</option>
                        <option value="cotizacion">Solo cotización</option>
                        <option value="ambos">Compra y cotización</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Unidades por venta</label>
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={formData.unidades_por_venta}
                        onChange={(e) =>
                          setFormData({ ...formData, unidades_por_venta: e.target.value })
                        }
                        title="Cuántas unidades de stock se descuentan por cada unidad vendida"
                      />
                    </div>
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.controla_stock}
                      onChange={(e) =>
                        setFormData({ ...formData, controla_stock: e.target.checked })
                      }
                      disabled={!formData.id_articulo_stock}
                    />
                    <span>Descontar stock al confirmar venta (requiere vínculo)</span>
                  </label>
                  <p className="cae-form__commerce-hint">Canales de publicación</p>
                  <div className="cae-form__commerce-channels">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.visible_portal}
                        onChange={(e) => {
                          const v = e.target.checked
                          setFormData({
                            ...formData,
                            visible_portal: v,
                            visible_clientes: v
                          })
                        }}
                      />
                      <span>Portal cliente</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.visible_totem}
                        onChange={(e) =>
                          setFormData({ ...formData, visible_totem: e.target.checked })
                        }
                      />
                      <span>Tótem</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.visible_web_publica}
                        onChange={(e) =>
                          setFormData({ ...formData, visible_web_publica: e.target.checked })
                        }
                      />
                      <span>Web pública</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.visible_stickers}
                        onChange={(e) =>
                          setFormData({ ...formData, visible_stickers: e.target.checked })
                        }
                      />
                      <span>Stickers</span>
                    </label>
                  </div>
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

            <div className="cae-modal__footer modal-footer">
              <button type="button" className="cae-btn cae-btn--ghost cae-btn--xs" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="button" className="cae-btn cae-btn--primary cae-btn--xs" onClick={handleGuardar} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArticulosEmpresaPage

