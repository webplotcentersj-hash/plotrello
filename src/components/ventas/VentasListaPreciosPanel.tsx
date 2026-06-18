import { useCallback, useEffect, useMemo, useState } from 'react'
import apiService from '../../services/api'
import type { ArticuloEmpresaRecord } from '../../types/api'
import {
  LISTAS_PRECIO_VENTAS,
  labelAjustesPreciosActivos,
  resolvePrecioLista,
  resolvePrecioListaBruto,
  type NumeroListaPrecio,
  type TipoListaPrecioVentas
} from '../../constants/ventasListasPrecio'
import { useConfigAjustesPreciosVentas } from '../../hooks/useConfigAjustesPreciosVentas'
import VentasAjustesPreciosCard from './VentasAjustesPreciosCard'
import {
  guardarVentasPresupuestoDraft,
  type VentasPresupuestoDraftItem
} from '../../utils/ventasPresupuestoDraft'
import './VentasListaPreciosPanel.css'

type CarritoLinea = VentasPresupuestoDraftItem & {
  key: string
}

function formatArs(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPrecioCelda(
  articulo: ArticuloEmpresaRecord,
  lista: NumeroListaPrecio,
  ajustes: import('../../constants/ventasListasPrecio').ConfigAjustesPreciosVentas
): string {
  const final = resolvePrecioLista(articulo, lista, ajustes)
  if (final == null || final === 0) return '—'
  const bruto = resolvePrecioListaBruto(articulo, lista)
  if (bruto != null && bruto !== final) {
    return `$${formatArs(final)}`
  }
  return `$${formatArs(final)}`
}

function valorPrecioInput(v: number | null | undefined): string {
  if (v == null || Number(v) === 0) return ''
  return String(v)
}

type Props = {
  onIrAPresupuesto: () => void
}

export default function VentasListaPreciosPanel({ onIrAPresupuesto }: Props) {
  const { ajustes, guardar, loading: loadingAjustes, saving: savingAjustes } = useConfigAjustesPreciosVentas()
  const [listaActiva, setListaActiva] = useState<TipoListaPrecioVentas>('lista_1')
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [carrito, setCarrito] = useState<CarritoLinea[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCategoria, setEditCategoria] = useState('')
  const [editPrecio1, setEditPrecio1] = useState('')
  const [editPrecio2, setEditPrecio2] = useState('')
  const [editPrecio3, setEditPrecio3] = useState('')
  const [editPrecio4, setEditPrecio4] = useState('')
  const [editPrecio5, setEditPrecio5] = useState('')
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.getArticulosEmpresa(undefined, false)
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo cargar el catálogo')
      setArticulos(res.data.filter((a) => a.activo && !a.codigo?.startsWith('ART-')))
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error al cargar artículos')
      setArticulos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const a of articulos) {
      if (a.categoria?.trim()) set.add(a.categoria.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [articulos])

  const articulosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return articulos.filter((a) => {
      if (categoria !== 'todas' && (a.categoria || '') !== categoria) return false
      if (!q) return true
      return (
        a.nombre.toLowerCase().includes(q) ||
        (a.codigo || '').toLowerCase().includes(q) ||
        (a.descripcion || '').toLowerCase().includes(q)
      )
    })
  }, [articulos, busqueda, categoria])

  const totalCarrito = useMemo(
    () => carrito.reduce((sum, l) => sum + l.precio_total, 0),
    [carrito]
  )

  const agregarAlCarrito = (articulo: ArticuloEmpresaRecord) => {
    const precio = resolvePrecioLista(articulo, listaActiva, ajustes)
    if (precio == null) {
      alert('Este artículo no tiene precio en la lista seleccionada.')
      return
    }
    const key = `${articulo.id}-${listaActiva}`
    setCarrito((prev) => {
      const idx = prev.findIndex((l) => l.key === key)
      if (idx >= 0) {
        const next = [...prev]
        const line = next[idx]
        const cantidad = line.cantidad + 1
        next[idx] = {
          ...line,
          cantidad,
          precio_total: cantidad * line.precio_unitario - line.descuento
        }
        return next
      }
      return [
        ...prev,
        {
          key,
          id_articulo_empresa: articulo.id,
          id_articulo_stock: articulo.id_articulo_stock ?? undefined,
          codigo_articulo: articulo.codigo,
          descripcion: articulo.nombre,
          cantidad: 1,
          precio_unitario: precio,
          descuento: 0,
          precio_total: precio
        }
      ]
    })
  }

  const quitarLinea = (key: string) => {
    setCarrito((prev) => prev.filter((l) => l.key !== key))
  }

  const iniciarEdicionPrecios = (articulo: ArticuloEmpresaRecord) => {
    setEditandoId(articulo.id)
    setEditNombre(articulo.nombre)
    setEditCategoria(articulo.categoria || '')
    setEditPrecio1(valorPrecioInput(articulo.precio_lista_1 ?? articulo.precio_base))
    setEditPrecio2(valorPrecioInput(articulo.precio_lista_2))
    setEditPrecio3(valorPrecioInput(articulo.precio_lista_3))
    setEditPrecio4(valorPrecioInput(articulo.precio_lista_4))
    setEditPrecio5(valorPrecioInput(articulo.precio_lista_5))
  }

  const guardarPrecios = async (id: number) => {
    const nombre = editNombre.trim()
    if (!nombre) {
      alert('La descripción no puede quedar vacía.')
      return
    }
    setGuardandoPrecio(true)
    try {
      const parse = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null)
      const l1 = parse(editPrecio1)
      const res = await apiService.actualizarPreciosListaArticulo(id, {
        nombre,
        categoria: editCategoria.trim() || null,
        precio_lista_1: l1,
        precio_lista_2: parse(editPrecio2),
        precio_lista_3: parse(editPrecio3),
        precio_lista_4: parse(editPrecio4),
        precio_lista_5: parse(editPrecio5)
      })
      if (!res.success) throw new Error(res.error || 'No se guardó')
      setArticulos((prev) => prev.map((a) => (a.id === id ? { ...a, ...res.data } : a)))
      setEditandoId(null)
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'Error al guardar precios')
    } finally {
      setGuardandoPrecio(false)
    }
  }

  const enviarAPresupuesto = () => {
    if (carrito.length === 0) {
      alert('Agregá al menos un artículo al presupuesto.')
      return
    }
    guardarVentasPresupuestoDraft({
      tipoLista: listaActiva,
      items: carrito.map(({ key: _k, ...item }) => item)
    })
    onIrAPresupuesto()
  }

  useEffect(() => {
    if (carrito.length === 0) return
    setCarrito((prev) =>
      prev.map((line) => {
        const art = articulos.find((a) => a.id === line.id_articulo_empresa)
        if (!art) return line
        const precio = resolvePrecioLista(art, listaActiva, ajustes)
        if (precio == null) return line
        return {
          ...line,
          precio_unitario: precio,
          precio_total: line.cantidad * precio - line.descuento
        }
      })
    )
  }, [ajustes, listaActiva, articulos])

  const metaLista = LISTAS_PRECIO_VENTAS[listaActiva]

  return (
    <div className="vlp-panel">
      <header className="vlp-head">
        <div>
          <h2>Lista de precios</h2>
            <p>
              Misma estructura que Flexxus: código, descripción, rubro y listas 1 a 5. Los valores en tabla
              incluyen <strong>{labelAjustesPreciosActivos(ajustes)}</strong>. Al editar, los campos son neto
              Flexxus (sin IVA).
            </p>
        </div>
        <VentasAjustesPreciosCard
          ajustes={ajustes}
          loading={loadingAjustes}
          saving={savingAjustes}
          onGuardar={guardar}
        />
        <div className="vlp-lista-switch" role="tablist" aria-label="Tipo de lista">
          {(Object.keys(LISTAS_PRECIO_VENTAS) as TipoListaPrecioVentas[]).map((id) => {
            const meta = LISTAS_PRECIO_VENTAS[id]
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={listaActiva === id}
                className={`vlp-lista-btn${listaActiva === id ? ' vlp-lista-btn--active' : ''}`}
                style={{ '--lista-accent': meta.accent } as React.CSSProperties}
                onClick={() => setListaActiva(id)}
              >
                <strong>{meta.label}</strong>
                <span>{meta.subtitle}</span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="vlp-layout">
        <section className="vlp-catalogo">
          <div className="vlp-filtros">
            <input
              type="search"
              className="vlp-input"
              placeholder="Buscar código, nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <select
              className="vlp-select"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="todas">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" className="vlp-btn vlp-btn--ghost" onClick={() => void cargar()}>
              ↻
            </button>
          </div>

          {loading ? (
            <p className="vlp-muted">Cargando catálogo…</p>
          ) : error ? (
            <p className="vlp-error">{error}</p>
          ) : (
            <div className="vlp-table-wrap">
              <table className="vlp-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Rubro</th>
                    <th title="Lista 1 con IVA y recargos">L1</th>
                    <th title="Lista 2 con IVA y recargos">L2</th>
                    <th>L3</th>
                    <th>L4</th>
                    <th>L5</th>
                    <th title="Precio final lista activa">Usar</th>
                    <th>Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {articulosFiltrados.map((a) => {
                    const pActivo = resolvePrecioLista(a, listaActiva, ajustes)
                    const editando = editandoId === a.id
                    const editCells = (
                      <>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio1} onChange={(e) => setEditPrecio1(e.target.value)} />
                        </td>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio2} onChange={(e) => setEditPrecio2(e.target.value)} />
                        </td>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio3} onChange={(e) => setEditPrecio3(e.target.value)} />
                        </td>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio4} onChange={(e) => setEditPrecio4(e.target.value)} />
                        </td>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio5} onChange={(e) => setEditPrecio5(e.target.value)} />
                        </td>
                      </>
                    )
                    return (
                      <tr key={a.id} className={editando ? 'vlp-row--editing' : undefined}>
                        <td className="vlp-mono">{a.codigo}</td>
                        <td>
                          {editando ? (
                            <input
                              className="vlp-input vlp-input--desc"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              aria-label="Descripción"
                            />
                          ) : (
                            <strong>{a.nombre}</strong>
                          )}
                        </td>
                        <td className="vlp-rubro">
                          {editando ? (
                            <input
                              className="vlp-input vlp-input--sm"
                              value={editCategoria}
                              onChange={(e) => setEditCategoria(e.target.value)}
                              placeholder="Rubro"
                              aria-label="Rubro"
                            />
                          ) : (
                            a.categoria || '—'
                          )}
                        </td>
                        {editando ? (
                          editCells
                        ) : (
                          <>
                            <td>{formatPrecioCelda(a, 1, ajustes)}</td>
                            <td>{formatPrecioCelda(a, 2, ajustes)}</td>
                            <td>{formatPrecioCelda(a, 3, ajustes)}</td>
                            <td>{formatPrecioCelda(a, 4, ajustes)}</td>
                            <td>{formatPrecioCelda(a, 5, ajustes)}</td>
                          </>
                        )}
                        <td className="vlp-precio-activo">
                          {pActivo != null ? `$${formatArs(pActivo)}` : '—'}
                        </td>
                        <td className="vlp-actions">
                          {editando ? (
                            <>
                              <button
                                type="button"
                                className="vlp-btn vlp-btn--xs"
                                disabled={guardandoPrecio}
                                onClick={() => void guardarPrecios(a.id)}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="vlp-btn vlp-btn--ghost vlp-btn--xs"
                                onClick={() => setEditandoId(null)}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="vlp-btn vlp-btn--xs"
                                disabled={pActivo == null}
                                onClick={() => agregarAlCarrito(a)}
                              >
                                + Presup.
                              </button>
                              <button
                                type="button"
                                className="vlp-btn vlp-btn--outline vlp-btn--xs"
                                onClick={() => iniciarEdicionPrecios(a)}
                                title="Editar descripción, rubro y listas 1 a 5"
                              >
                                Editar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {articulosFiltrados.length === 0 ? (
                <p className="vlp-muted vlp-empty">Sin artículos con ese criterio.</p>
              ) : null}
            </div>
          )}
        </section>

        <aside className="vlp-carrito">
          <h3>Presupuesto en armado</h3>
          <p className="vlp-carrito-lista">
            Usando <strong>{metaLista.label}</strong> — {metaLista.subtitle}
          </p>
          {carrito.length === 0 ? (
            <p className="vlp-muted">Tocá «+ Presup.» en un artículo para sumarlo acá.</p>
          ) : (
            <ul className="vlp-carrito-list">
              {carrito.map((line) => (
                <li key={line.key}>
                  <div>
                    <strong>{line.descripcion}</strong>
                    <span>
                      {line.cantidad} × ${formatArs(line.precio_unitario)}
                    </span>
                  </div>
                  <div className="vlp-carrito-line-actions">
                    <span>${formatArs(line.precio_total)}</span>
                    <button
                      type="button"
                      className="vlp-btn vlp-btn--ghost vlp-btn--xs"
                      onClick={() => quitarLinea(line.key)}
                      aria-label="Quitar"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="vlp-carrito-total">
            <span>Total</span>
            <strong>${formatArs(totalCarrito)}</strong>
          </div>
          <button
            type="button"
            className="vlp-btn vlp-btn--primary vlp-btn--block"
            disabled={carrito.length === 0}
            onClick={enviarAPresupuesto}
          >
            Ir a Presupuestos →
          </button>
          {carrito.length > 0 ? (
            <button
              type="button"
              className="vlp-btn vlp-btn--ghost vlp-btn--block"
              onClick={() => setCarrito([])}
            >
              Vaciar
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
