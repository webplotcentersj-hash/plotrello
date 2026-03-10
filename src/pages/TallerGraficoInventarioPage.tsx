import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import './TallerGraficoInventarioPage.css'

type InventarioItem = {
  id: number
  sector: string | null
  categoria: string | null
  marca: string | null
  descripcion: string | null
  ancho: number | null
  largo: number | null
  cantidad_unidades: number | null
}

export default function TallerGraficoInventarioPage() {
  const { isAdmin, isTallerGrafico } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newItem, setNewItem] = useState<{
    sector: string
    categoria: string
    marca: string
    descripcion: string
    ancho: string
    largo: string
    cantidad_unidades: string
  }>({
    sector: 'Taller Grafico',
    categoria: '',
    marca: '',
    descripcion: '',
    ancho: '',
    largo: '',
    cantidad_unidades: ''
  })

  const tintaItems = items.filter((item) => {
    const sector = (item.sector || '').toLowerCase()
    const categoria = (item.categoria || '').toLowerCase()
    const desc = (item.descripcion || '').toLowerCase()
    const esTallerGrafico = sector.includes('taller') && sector.includes('graf')
    const esTinta = categoria.includes('tinta') || desc.includes('tinta')
    return esTallerGrafico && esTinta
  })

  const maxCantidadTinta = tintaItems.reduce(
    (max, item) => Math.max(max, item.cantidad_unidades ?? 0),
    0
  ) || 1

  const getTintaColor = (item: InventarioItem) => {
    const desc = (item.descripcion || '').toLowerCase()
    if (desc.includes('magenta')) return '#ec4899'
    if (desc.includes('cyan')) return '#38bdf8'
    if (desc.includes('yellow')) return '#facc15'
    if (desc.includes('black') || desc.includes('negra')) return '#111827'
    return '#6366f1'
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin && !isTallerGrafico) {
        setLoading(false)
        return
      }
      if (!supabase) {
        setError('Supabase no está configurado')
        setLoading(false)
        return
      }
      try {
        const { data, error: err } = await supabase
          .from('inventario_taller_grafico')
          .select('*')
          .order('sector', { ascending: true })
          .order('categoria', { ascending: true })
          .order('descripcion', { ascending: true })

        if (err) {
          setError(err.message)
        } else {
          setItems((data as InventarioItem[]) || [])
        }
      } catch (e) {
        setError('Error al cargar inventario')
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [isAdmin, isTallerGrafico])

  if (!isAdmin && !isTallerGrafico) {
    return (
      <div className="tg-inventario-page tg-inventario-page--denied">
        <div className="tg-card tg-card--denied">
          <h1>Sin acceso</h1>
          <p>Solo Administración y Taller Gráfico pueden ver el inventario de este sector.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tg-inventario-page">
        <div className="tg-loading">
          <div className="tg-spinner" />
          <p>Cargando inventario de Taller Gráfico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tg-inventario-page">
      <header className="tg-header">
        <div className="tg-header-left">
          <h1>Inventario Taller Gráfico</h1>
          <p>Listado de insumos y materiales específicos del sector.</p>
        </div>
        <button
          type="button"
          className="tg-back-button"
          onClick={() => navigate('/')}
        >
          ← Volver al tablero
        </button>
      </header>

      <main className="tg-main">
        <section className="tg-nuevo-item">
          <h2>Agregar insumo</h2>
          <div className="tg-nuevo-grid">
            <div className="tg-nuevo-field">
              <label>SECTOR</label>
              <input
                className="tg-input"
                value={newItem.sector}
                onChange={(e) => setNewItem((prev) => ({ ...prev, sector: e.target.value }))}
              />
            </div>
            <div className="tg-nuevo-field">
              <label>categoria</label>
              <input
                className="tg-input"
                value={newItem.categoria}
                onChange={(e) => setNewItem((prev) => ({ ...prev, categoria: e.target.value }))}
              />
            </div>
            <div className="tg-nuevo-field">
              <label>marca</label>
              <input
                className="tg-input"
                value={newItem.marca}
                onChange={(e) => setNewItem((prev) => ({ ...prev, marca: e.target.value }))}
              />
            </div>
            <div className="tg-nuevo-field tg-nuevo-field-wide">
              <label>Descripcion</label>
              <input
                className="tg-input"
                value={newItem.descripcion}
                onChange={(e) => setNewItem((prev) => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>
            <div className="tg-nuevo-field">
              <label>ANCHO</label>
              <input
                type="number"
                step="0.01"
                className="tg-input tg-input-number"
                value={newItem.ancho}
                onChange={(e) => setNewItem((prev) => ({ ...prev, ancho: e.target.value }))}
              />
            </div>
            <div className="tg-nuevo-field">
              <label>LARGO</label>
              <input
                type="number"
                step="0.01"
                className="tg-input tg-input-number"
                value={newItem.largo}
                onChange={(e) => setNewItem((prev) => ({ ...prev, largo: e.target.value }))}
              />
            </div>
            <div className="tg-nuevo-field">
              <label>CANTIDAD DE UNIDADES</label>
              <input
                type="number"
                className="tg-input tg-input-number"
                value={newItem.cantidad_unidades}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, cantidad_unidades: e.target.value }))
                }
              />
            </div>
            <div className="tg-nuevo-actions">
              <button
                type="button"
                className="tg-save-button"
                disabled={creating}
                onClick={async () => {
                  if (!supabase) return
                  if (!newItem.descripcion.trim()) {
                    setError('La descripción es obligatoria para crear un insumo.')
                    return
                  }
                  setCreating(true)
                  setError(null)
                  try {
                    const payload = {
                      sector: newItem.sector || null,
                      categoria: newItem.categoria || null,
                      marca: newItem.marca || null,
                      descripcion: newItem.descripcion || null,
                      ancho: newItem.ancho ? Number(newItem.ancho) : null,
                      largo: newItem.largo ? Number(newItem.largo) : null,
                      cantidad_unidades: newItem.cantidad_unidades
                        ? Number(newItem.cantidad_unidades)
                        : null
                    }
                    const { data, error: err } = await supabase
                      .from('inventario_taller_grafico')
                      .insert(payload)
                      .select()
                      .single()
                    if (err) {
                      setError(err.message)
                    } else if (data) {
                      setItems((prev) => [...prev, data as InventarioItem])
                      setNewItem({
                        sector: 'Taller Grafico',
                        categoria: '',
                        marca: '',
                        descripcion: '',
                        ancho: '',
                        largo: '',
                        cantidad_unidades: ''
                      })
                    }
                  } catch (e) {
                    setError('Error al crear insumo')
                  } finally {
                    setCreating(false)
                  }
                }}
              >
                {creating ? 'Creando…' : 'Agregar insumo'}
              </button>
            </div>
          </div>
        </section>

        {tintaItems.length > 0 && (
          <section className="tg-tintas-section">
            <h2>Niveles de Tintas</h2>
            <p className="tg-tintas-sub">
              Visualización rápida de los rollos / bidones de tinta por color. El largo de la barra
              representa la cantidad relativa.
            </p>
            <div className="tg-tintas-grid">
              {tintaItems.map((item) => {
                const cantidad = item.cantidad_unidades ?? 0
                const widthPct = Math.max(8, (cantidad / maxCantidadTinta) * 100)
                const color = getTintaColor(item)
                return (
                  <div key={item.id} className="tg-tinta-card">
                    <div className="tg-tinta-header">
                      <span
                        className="tg-tinta-dot"
                        style={{ backgroundColor: color }}
                      />
                      <div className="tg-tinta-text">
                        <span className="tg-tinta-desc">{item.descripcion}</span>
                        <span className="tg-tinta-marca">{item.marca}</span>
                      </div>
                    </div>
                    <div className="tg-tinta-bar-track">
                      <div
                        className="tg-tinta-bar-fill"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="tg-tinta-meta">
                      <span>{cantidad ?? 0} unidades</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {error && (
          <div className="tg-empty">
            <p>Ocurrió un error al cargar el inventario.</p>
            <p className="tg-empty-sub">{error}</p>
          </div>
        )}
        {!error && items.length === 0 ? (
          <div className="tg-empty">
            <p>No hay insumos cargados todavía.</p>
            <p className="tg-empty-sub">
              El inventario se llena a partir de la tabla `inventario_taller_grafico` en Supabase.
            </p>
          </div>
        ) : !error && (
          <div className="tg-table-wrapper">
            <table className="tg-table">
              <thead>
                <tr>
                  <th>SECTOR</th>
                  <th>categoria</th>
                  <th>marca</th>
                  <th>Descripcion</th>
                  <th>ANCHO</th>
                  <th>LARGO</th>
                  <th>CANTIDAD DE UNIDADES</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sector || '-'}</td>
                    <td>{item.categoria || '-'}</td>
                    <td>
                      <input
                        className="tg-input"
                        value={item.marca || ''}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === item.id ? { ...it, marca: e.target.value } : it
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="tg-input"
                        value={item.descripcion || ''}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === item.id ? { ...it, descripcion: e.target.value } : it
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="tg-input tg-input-number"
                        value={item.ancho ?? ''}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === item.id
                                ? { ...it, ancho: e.target.value === '' ? null : Number(e.target.value) }
                                : it
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="tg-input tg-input-number"
                        value={item.largo ?? ''}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === item.id
                                ? { ...it, largo: e.target.value === '' ? null : Number(e.target.value) }
                                : it
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="tg-cantidad-cell">
                        <input
                          type="number"
                          className="tg-input tg-input-number"
                          value={item.cantidad_unidades ?? ''}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? {
                                      ...it,
                                      cantidad_unidades:
                                        e.target.value === '' ? null : Number(e.target.value)
                                    }
                                  : it
                              )
                            )
                          }
                        />
                        <button
                          type="button"
                          className="tg-save-button"
                          disabled={savingId === item.id}
                          onClick={async () => {
                            if (!supabase) return
                            setSavingId(item.id)
                            setError(null)
                            try {
                              const { error: err } = await supabase
                                .from('inventario_taller_grafico')
                                .update({
                                  marca: item.marca,
                                  descripcion: item.descripcion,
                                  ancho: item.ancho,
                                  largo: item.largo,
                                  cantidad_unidades: item.cantidad_unidades
                                })
                                .eq('id', item.id)
                              if (err) setError(err.message)
                            } catch (e) {
                              setError('Error al guardar cambios')
                            } finally {
                              setSavingId(null)
                            }
                          }}
                        >
                          {savingId === item.id ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

