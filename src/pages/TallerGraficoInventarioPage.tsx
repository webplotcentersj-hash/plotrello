import { useEffect, useState } from 'react'
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
  const [items, setItems] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tintaItems = items.filter(
    (item) =>
      (item.sector && item.sector.toLowerCase().includes('taller grafico')) &&
      (item.categoria && item.categoria.toLowerCase() === 'tintas')
  )

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
      </header>

      <main className="tg-main">
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
                  <th>Sector</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Descripción</th>
                  <th>Ancho</th>
                  <th>Largo</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sector || '-'}</td>
                    <td>{item.categoria || '-'}</td>
                    <td>{item.marca || '-'}</td>
                    <td>{item.descripcion || '-'}</td>
                    <td>{item.ancho ?? '-'}</td>
                    <td>{item.largo ?? '-'}</td>
                    <td>{item.cantidad_unidades ?? '-'}</td>
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

