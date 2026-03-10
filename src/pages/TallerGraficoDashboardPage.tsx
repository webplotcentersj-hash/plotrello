import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import './TallerGraficoDashboardPage.css'

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

export default function TallerGraficoDashboardPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin) {
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

        if (err) setError(err.message)
        else setItems((data as InventarioItem[]) || [])
      } catch (e) {
        setError('Error al cargar inventario')
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [isAdmin])

  const itemsTallerGrafico = useMemo(
    () =>
      items.filter((it) => (it.sector || '').toLowerCase().includes('taller grafico')), 
    [items]
  )

  const totalesPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const it of itemsTallerGrafico) {
      const cat = (it.categoria || 'Sin categoría').toLowerCase()
      const key = cat.charAt(0).toUpperCase() + cat.slice(1)
      const cantidad = Number(it.cantidad_unidades || 0)
      mapa.set(key, (mapa.get(key) || 0) + cantidad)
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])
  }, [itemsTallerGrafico])

  const vinilosPorMarca = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const it of itemsTallerGrafico) {
      const cat = (it.categoria || '').toLowerCase()
      if (!cat.includes('vinilo')) continue
      const marca = it.marca || 'Sin marca'
      const cantidad = Number(it.cantidad_unidades || 0) || 1
      mapa.set(marca, (mapa.get(marca) || 0) + cantidad)
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])
  }, [itemsTallerGrafico])

  const tintasPorMarca = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const it of itemsTallerGrafico) {
      const categoria = (it.categoria || '').toLowerCase()
      const desc = (it.descripcion || '').toLowerCase()
      const esTinta =
        categoria.includes('tinta') ||
        categoria.includes('toner') ||
        desc.includes('tinta') ||
        desc.includes('toner')
      if (!esTinta) continue
      const marca = it.marca || 'Sin marca'
      const cantidad = Number(it.cantidad_unidades || 0) || 1
      mapa.set(marca, (mapa.get(marca) || 0) + cantidad)
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])
  }, [itemsTallerGrafico])

  const maxCat = Math.max(...totalesPorCategoria.map(([, v]) => v), 1)
  const maxVinilos = Math.max(...vinilosPorMarca.map(([, v]) => v), 1)
  const maxTintas = Math.max(...tintasPorMarca.map(([, v]) => v), 1)

  if (!isAdmin) {
    return (
      <div className="tg-dashboard-page tg-dashboard-denied">
        <div className="tg-dashboard-card">
          <h1>Solo administración</h1>
          <p>Este panel de niveles de Taller Gráfico es solo para administradores.</p>
          <button type="button" onClick={() => navigate('/')}>← Volver al tablero</button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tg-dashboard-page">
        <div className="tg-dashboard-loading">
          <div className="tg-dashboard-spinner" />
          <p>Cargando panel de niveles de Taller Gráfico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tg-dashboard-page">
      <header className="tg-dashboard-header">
        <div>
          <h1>Panel de Niveles · Taller Gráfico</h1>
          <p>Resumen visual de tintas, vinilos y categorías del sector.</p>
        </div>
        <button type="button" className="tg-back-button" onClick={() => navigate('/')}>← Volver al tablero</button>
      </header>

      <main className="tg-dashboard-main">
        {error && (
          <div className="tg-dashboard-error">{error}</div>
        )}

        <section className="tg-dashboard-section">
          <h2>Stock por categoría</h2>
          <div className="tg-dashboard-bars">
            {totalesPorCategoria.map(([cat, val]) => {
              const width = `${(val / maxCat) * 100 || 0}%`
              return (
                <div key={cat} className="tg-bar-row">
                  <span className="tg-bar-label">{cat}</span>
                  <div className="tg-bar-track">
                    <div className="tg-bar-fill cat" style={{ width }} />
                  </div>
                  <span className="tg-bar-value">{val}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="tg-dashboard-section">
          <h2>Vinilos por marca</h2>
          <div className="tg-dashboard-bars">
            {vinilosPorMarca.map(([marca, val]) => {
              const width = `${(val / maxVinilos) * 100 || 0}%`
              return (
                <div key={marca} className="tg-bar-row">
                  <span className="tg-bar-label">{marca}</span>
                  <div className="tg-bar-track">
                    <div className="tg-bar-fill vinilo" style={{ width }} />
                  </div>
                  <span className="tg-bar-value">{val}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="tg-dashboard-section">
          <h2>Tintas / Toners por marca</h2>
          <div className="tg-dashboard-bars">
            {tintasPorMarca.map(([marca, val]) => {
              const width = `${(val / maxTintas) * 100 || 0}%`
              return (
                <div key={marca} className="tg-bar-row">
                  <span className="tg-bar-label">{marca}</span>
                  <div className="tg-bar-track">
                    <div className="tg-bar-fill tinta" style={{ width }} />
                  </div>
                  <span className="tg-bar-value">{val}</span>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
