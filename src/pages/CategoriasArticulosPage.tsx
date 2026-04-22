import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './CategoriasArticulosPage.css'

interface CategoriaConSubcategorias {
  categoria: string
  subcategorias: string[]
}

const CategoriasArticulosPage = () => {
  const navigate = useNavigate()
  const { canAccessMostradorViews, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState<CategoriaConSubcategorias[]>([])
  const [editingCategoria, setEditingCategoria] = useState<string | null>(null)
  const [editingSubcategoria, setEditingSubcategoria] = useState<{ categoria: string; subcategoria: string } | null>(null)
  const [newCategoriaName, setNewCategoriaName] = useState('')
  const [newSubcategoriaName, setNewSubcategoriaName] = useState('')
  const [selectedCategoriaForSub, setSelectedCategoriaForSub] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!canAccessMostradorViews) {
      navigate('/')
      return
    }
    loadCategorias()
  }, [navigate, canAccessMostradorViews, authLoading])

  const loadCategorias = async () => {
    setLoading(true)
    try {
      const categoriasResponse = await apiService.obtenerCategoriasArticulos()
      if (categoriasResponse.success && categoriasResponse.data) {
        const categoriasConSubs: CategoriaConSubcategorias[] = []
        
        for (const categoria of categoriasResponse.data) {
          const subcategoriasResponse = await apiService.obtenerSubcategoriasArticulos(categoria)
          categoriasConSubs.push({
            categoria,
            subcategorias: subcategoriasResponse.success && subcategoriasResponse.data 
              ? subcategoriasResponse.data 
              : []
          })
        }
        
        setCategorias(categoriasConSubs)
      }
    } catch (err) {
      setError('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearCategoria = async () => {
    if (!newCategoriaName.trim()) {
      setError('El nombre de la categoría es obligatorio')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiService.guardarCategoriaArticulo(newCategoriaName.trim())
      if (response.success) {
        setNewCategoriaName('')
        loadCategorias()
      } else {
        setError(response.error || 'Error al crear categoría')
      }
    } catch (err) {
      setError('Error al crear categoría')
    } finally {
      setSaving(false)
    }
  }

  const handleActualizarCategoria = async (categoriaAntigua: string) => {
    if (!newCategoriaName.trim()) {
      setError('El nombre de la categoría es obligatorio')
      return
    }

    if (newCategoriaName.trim() === categoriaAntigua) {
      setEditingCategoria(null)
      setNewCategoriaName('')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiService.actualizarCategoriaArticulo(
        categoriaAntigua,
        newCategoriaName.trim()
      )
      if (response.success) {
        setEditingCategoria(null)
        setNewCategoriaName('')
        loadCategorias()
      } else {
        setError(response.error || 'Error al actualizar categoría')
      }
    } catch (err) {
      setError('Error al actualizar categoría')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminarCategoria = async (categoria: string) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${categoria}"? Esto también eliminará todas sus subcategorías.`)) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiService.eliminarCategoriaArticulo(categoria)
      if (response.success) {
        loadCategorias()
      } else {
        setError(response.error || 'Error al eliminar categoría')
      }
    } catch (err) {
      setError('Error al eliminar categoría')
    } finally {
      setSaving(false)
    }
  }

  const handleCrearSubcategoria = async () => {
    if (!selectedCategoriaForSub || !newSubcategoriaName.trim()) {
      setError('Debes seleccionar una categoría y escribir el nombre de la subcategoría')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiService.guardarSubcategoriaArticulo(
        selectedCategoriaForSub,
        newSubcategoriaName.trim()
      )
      if (response.success) {
        setNewSubcategoriaName('')
        setSelectedCategoriaForSub('')
        loadCategorias()
      } else {
        setError(response.error || 'Error al crear subcategoría')
      }
    } catch (err) {
      setError('Error al crear subcategoría')
    } finally {
      setSaving(false)
    }
  }

  const handleActualizarSubcategoria = async (categoria: string, subcategoriaAntigua: string) => {
    if (!newSubcategoriaName.trim()) {
      setError('El nombre de la subcategoría es obligatorio')
      return
    }

    if (newSubcategoriaName.trim() === subcategoriaAntigua) {
      setEditingSubcategoria(null)
      setNewSubcategoriaName('')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiService.actualizarSubcategoriaArticulo(
        categoria,
        subcategoriaAntigua,
        newSubcategoriaName.trim()
      )
      if (response.success) {
        setEditingSubcategoria(null)
        setNewSubcategoriaName('')
        loadCategorias()
      } else {
        setError(response.error || 'Error al actualizar subcategoría')
      }
    } catch (err) {
      setError('Error al actualizar subcategoría')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminarSubcategoria = async (categoria: string, subcategoria: string) => {
    if (!confirm(`¿Estás seguro de eliminar la subcategoría "${subcategoria}"?`)) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiService.eliminarSubcategoriaArticulo(categoria, subcategoria)
      if (response.success) {
        loadCategorias()
      } else {
        setError(response.error || 'Error al eliminar subcategoría')
      }
    } catch (err) {
      setError('Error al eliminar subcategoría')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="categorias-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="categorias-page">
      <header className="categorias-header">
        <div className="header-content">
          <div>
            <h1>Gestión de Categorías y Subcategorías</h1>
            <p>Administra las categorías y subcategorías de artículos</p>
          </div>
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate('/clientes-web/articulos')}
            >
              ← Volver a Artículos
            </button>
          </div>
        </div>
      </header>

      <main className="categorias-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Crear nueva categoría */}
        <section className="categoria-section">
          <h2>Nueva Categoría</h2>
          <div className="form-row">
            <input
              type="text"
              value={newCategoriaName}
              onChange={(e) => setNewCategoriaName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="input-field"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !editingCategoria) {
                  handleCrearCategoria()
                }
              }}
            />
            <button
              className="btn-primary"
              onClick={handleCrearCategoria}
              disabled={saving || !newCategoriaName.trim() || !!editingCategoria}
            >
              + Crear Categoría
            </button>
          </div>
        </section>

        {/* Crear nueva subcategoría */}
        <section className="categoria-section">
          <h2>Nueva Subcategoría</h2>
          <div className="form-row">
            <select
              value={selectedCategoriaForSub}
              onChange={(e) => setSelectedCategoriaForSub(e.target.value)}
              className="input-field"
              disabled={!!editingSubcategoria}
            >
              <option value="">Seleccionar categoría</option>
              {categorias.map((cat) => (
                <option key={cat.categoria} value={cat.categoria}>
                  {cat.categoria}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newSubcategoriaName}
              onChange={(e) => setNewSubcategoriaName(e.target.value)}
              placeholder="Nombre de la subcategoría"
              className="input-field"
              disabled={!!editingSubcategoria}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !editingSubcategoria && selectedCategoriaForSub) {
                  handleCrearSubcategoria()
                }
              }}
            />
            <button
              className="btn-primary"
              onClick={handleCrearSubcategoria}
              disabled={saving || !newSubcategoriaName.trim() || !selectedCategoriaForSub || !!editingSubcategoria}
            >
              + Crear Subcategoría
            </button>
          </div>
        </section>

        {/* Lista de categorías */}
        <section className="categorias-list-section">
          <h2>Categorías Existentes</h2>
          {categorias.length === 0 ? (
            <div className="empty-state">
              <p>No hay categorías creadas</p>
            </div>
          ) : (
            <div className="categorias-list">
              {categorias.map((cat) => (
                <div key={cat.categoria} className="categoria-card">
                  <div className="categoria-header">
                    {editingCategoria === cat.categoria ? (
                      <div className="edit-form">
                        <input
                          type="text"
                          value={newCategoriaName}
                          onChange={(e) => setNewCategoriaName(e.target.value)}
                          className="input-field"
                          autoFocus
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleActualizarCategoria(cat.categoria)
                            }
                            if (e.key === 'Escape') {
                              setEditingCategoria(null)
                              setNewCategoriaName('')
                            }
                          }}
                        />
                        <button
                          className="btn-save"
                          onClick={() => handleActualizarCategoria(cat.categoria)}
                          disabled={saving}
                        >
                          ✓
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={() => {
                            setEditingCategoria(null)
                            setNewCategoriaName('')
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3>{cat.categoria}</h3>
                        <div className="categoria-actions">
                          <button
                            className="btn-edit"
                            onClick={() => {
                              setEditingCategoria(cat.categoria)
                              setNewCategoriaName(cat.categoria)
                            }}
                            disabled={saving}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleEliminarCategoria(cat.categoria)}
                            disabled={saving}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Subcategorías */}
                  <div className="subcategorias-list">
                    {cat.subcategorias.length === 0 ? (
                      <p className="no-subcategorias">No hay subcategorías</p>
                    ) : (
                      cat.subcategorias.map((subcat) => (
                        <div key={subcat} className="subcategoria-item">
                          {editingSubcategoria?.categoria === cat.categoria && 
                           editingSubcategoria?.subcategoria === subcat ? (
                            <div className="edit-form">
                              <input
                                type="text"
                                value={newSubcategoriaName}
                                onChange={(e) => setNewSubcategoriaName(e.target.value)}
                                className="input-field"
                                autoFocus
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleActualizarSubcategoria(cat.categoria, subcat)
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingSubcategoria(null)
                                    setNewSubcategoriaName('')
                                  }
                                }}
                              />
                              <button
                                className="btn-save"
                                onClick={() => handleActualizarSubcategoria(cat.categoria, subcat)}
                                disabled={saving}
                              >
                                ✓
                              </button>
                              <button
                                className="btn-cancel"
                                onClick={() => {
                                  setEditingSubcategoria(null)
                                  setNewSubcategoriaName('')
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="subcategoria-name">{subcat}</span>
                              <div className="subcategoria-actions">
                                <button
                                  className="btn-edit-small"
                                  onClick={() => {
                                    setEditingSubcategoria({ categoria: cat.categoria, subcategoria: subcat })
                                    setNewSubcategoriaName(subcat)
                                  }}
                                  disabled={saving}
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn-delete-small"
                                  onClick={() => handleEliminarSubcategoria(cat.categoria, subcat)}
                                  disabled={saving}
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default CategoriasArticulosPage

