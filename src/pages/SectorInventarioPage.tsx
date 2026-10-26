import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import './TallerGraficoInventarioPage.css'

export type InventarioSectorId = 'Taller de Imprenta' | 'Mostrador'

type InventarioItem = {
  id: number
  sector: string
  categoria: string | null
  marca: string | null
  descripcion: string | null
  ancho: number | null
  largo: number | null
  cantidad_unidades: number | null
}

type Props = {
  sector: InventarioSectorId
}

const emptyItem = () => ({
  categoria: '',
  marca: '',
  descripcion: '',
  ancho: '',
  largo: '',
  cantidad_unidades: ''
})

export default function SectorInventarioPage({ sector }: Props) {
  const navigate = useNavigate()
  const { usuario, nombreVisible, isAdmin, isTallerImprenta, isMostrador, canManageCompras, canAccessMostradorViews } = useAuth()
  const [items, setItems] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(emptyItem())

  const puedeVer =
    isAdmin ||
    canManageCompras ||
    (sector === 'Taller de Imprenta' && isTallerImprenta) ||
    (sector === 'Mostrador' && (isMostrador || canAccessMostradorViews))

  const filtrados = items.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (item.categoria || '').toLowerCase().includes(q) ||
      (item.marca || '').toLowerCase().includes(q) ||
      (item.descripcion || '').toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    if (!puedeVer) {
      setLoading(false)
      return
    }
    if (!supabase) {
      setError('Supabase no está configurado')
      setLoading(false)
      return
    }
    let cancelled = false
    void supabase
      .from('inventario_sector')
      .select('*')
      .eq('sector', sector)
      .order('categoria', { ascending: true })
      .order('descripcion', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setItems((data as InventarioItem[]) || [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [puedeVer, sector])

  const crear = async () => {
    if (!supabase) return
    if (!nuevo.descripcion.trim()) {
      setError('La descripción es obligatoria.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('inventario_sector')
        .insert({
          sector,
          categoria: nuevo.categoria || null,
          marca: nuevo.marca || null,
          descripcion: nuevo.descripcion.trim(),
          ancho: nuevo.ancho ? Number(nuevo.ancho) : null,
          largo: nuevo.largo ? Number(nuevo.largo) : null,
          cantidad_unidades: nuevo.cantidad_unidades ? Number(nuevo.cantidad_unidades) : null
        })
        .select()
        .single()
      if (err) setError(err.message)
      else if (data) {
        setItems((prev) => [...prev, data as InventarioItem])
        setNuevo(emptyItem())
        setMensaje('Insumo agregado.')
      }
    } finally {
      setCreating(false)
    }
  }

  const guardar = async (item: InventarioItem) => {
    if (!supabase) return
    setSavingId(item.id)
    setError(null)
    setMensaje(null)
    try {
      const { error: err } = await supabase
        .from('inventario_sector')
        .update({
          categoria: item.categoria,
          marca: item.marca,
          descripcion: item.descripcion,
          ancho: item.ancho,
          largo: item.largo,
          cantidad_unidades: item.cantidad_unidades
        })
        .eq('id', item.id)
      if (err) setError(err.message)
      else setMensaje('Cambios guardados.')
    } finally {
      setSavingId(null)
    }
  }

  const pedirCompra = async (item: InventarioItem) => {
    const cantidad = item.cantidad_unidades && item.cantidad_unidades > 0 ? item.cantidad_unidades : 1
    const solicitanteId = Number(localStorage.getItem('usuario_id')) || usuario?.id || 0
    const nombreSolicitante = nombreVisible || usuario?.nombre || 'Usuario'
    setError(null)
    setMensaje(null)
    const detalle = `${item.marca || ''} ${item.descripcion || ''}`.trim()
    const response = await apiService.crearPedidoCompra({
      id_solicitante: solicitanteId,
      nombre_solicitante: nombreSolicitante,
      sector_solicitante: sector,
      prioridad: 'Alta',
      motivo: `Reposición de insumos ${sector}`,
      observaciones: detalle,
      items: [
        {
          descripcion: item.descripcion || `Insumo ${sector}`,
          cantidad_solicitada: cantidad,
          unidad: 'unidad',
          observaciones: detalle
        }
      ]
    })
    if (response.success && response.data) {
      setMensaje(`Pedido enviado a Compras (#${response.data.numero_pedido}).`)
    } else {
      setError(response.error || 'No se pudo crear el pedido.')
    }
  }

  if (!puedeVer) {
    return (
      <div className="tg-inventario-page tg-inventario-page--denied">
        <div className="tg-card tg-card--denied">
          <h1>Sin acceso</h1>
          <p>No podés ver el inventario de {sector}.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tg-inventario-page">
        <div className="tg-loading">
          <div className="tg-spinner" />
          <p>Cargando inventario de {sector}...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tg-inventario-page">
      <header className="tg-header">
        <div className="tg-header-left">
          <h1>Inventario {sector}</h1>
          <p>Insumos y materiales de este sector. Podés cargar stock y pedir reposición a Compras.</p>
        </div>
        <button type="button" className="tg-back-button" onClick={() => navigate('/compras/gestion-stock')}>
          ← Volver a stock
        </button>
      </header>

      <main className="tg-main">
        <div className="tg-search-row">
          <input
            className="tg-input tg-search-input"
            placeholder="Buscar por categoría, marca o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {mensaje && <div className="tg-pedido-message">{mensaje}</div>}
        {error && (
          <div className="tg-empty">
            <p>{error}</p>
          </div>
        )}

        <section className="tg-nuevo-item">
          <h2>Agregar insumo</h2>
          <div className="tg-nuevo-grid">
            <div className="tg-nuevo-field">
              <label>Categoría</label>
              <input className="tg-input" value={nuevo.categoria} onChange={(e) => setNuevo((p) => ({ ...p, categoria: e.target.value }))} />
            </div>
            <div className="tg-nuevo-field">
              <label>Marca</label>
              <input className="tg-input" value={nuevo.marca} onChange={(e) => setNuevo((p) => ({ ...p, marca: e.target.value }))} />
            </div>
            <div className="tg-nuevo-field tg-nuevo-field-wide">
              <label>Descripción</label>
              <input className="tg-input" value={nuevo.descripcion} onChange={(e) => setNuevo((p) => ({ ...p, descripcion: e.target.value }))} />
            </div>
            <div className="tg-nuevo-field">
              <label>Ancho</label>
              <input type="number" step="0.01" className="tg-input tg-input-number" value={nuevo.ancho} onChange={(e) => setNuevo((p) => ({ ...p, ancho: e.target.value }))} />
            </div>
            <div className="tg-nuevo-field">
              <label>Largo</label>
              <input type="number" step="0.01" className="tg-input tg-input-number" value={nuevo.largo} onChange={(e) => setNuevo((p) => ({ ...p, largo: e.target.value }))} />
            </div>
            <div className="tg-nuevo-field">
              <label>Cantidad</label>
              <input type="number" className="tg-input tg-input-number" value={nuevo.cantidad_unidades} onChange={(e) => setNuevo((p) => ({ ...p, cantidad_unidades: e.target.value }))} />
            </div>
            <div className="tg-nuevo-actions">
              <button type="button" className="tg-save-button" disabled={creating} onClick={() => void crear()}>
                {creating ? 'Creando…' : 'Agregar insumo'}
              </button>
            </div>
          </div>
        </section>

        {filtrados.length === 0 ? (
          <div className="tg-empty">
            <p>Todavía no hay insumos en el inventario de {sector}.</p>
            <p className="tg-empty-sub">Cargá el primero con el formulario de arriba.</p>
          </div>
        ) : (
          <div className="tg-table-wrapper">
            <table className="tg-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Descripción</th>
                  <th>Ancho</th>
                  <th>Largo</th>
                  <th>Cantidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        className="tg-input"
                        value={item.categoria || ''}
                        onChange={(e) =>
                          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, categoria: e.target.value } : it)))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="tg-input"
                        value={item.marca || ''}
                        onChange={(e) =>
                          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, marca: e.target.value } : it)))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="tg-input"
                        value={item.descripcion || ''}
                        onChange={(e) =>
                          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, descripcion: e.target.value } : it)))
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
                              it.id === item.id ? { ...it, ancho: e.target.value === '' ? null : Number(e.target.value) } : it
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
                              it.id === item.id ? { ...it, largo: e.target.value === '' ? null : Number(e.target.value) } : it
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="tg-input tg-input-number"
                        value={item.cantidad_unidades ?? ''}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === item.id
                                ? { ...it, cantidad_unidades: e.target.value === '' ? null : Number(e.target.value) }
                                : it
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="tg-cantidad-cell">
                        <button type="button" className="tg-save-button" disabled={savingId === item.id} onClick={() => void guardar(item)}>
                          {savingId === item.id ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" className="tg-pedido-button" onClick={() => void pedirCompra(item)}>
                          Pedir
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
