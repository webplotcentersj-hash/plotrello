import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import apiService from '../../services/api'
import type { ArticuloEmpresaRecord } from '../../types/api'
import type { ArticuloStock } from '../../types/pedidos'
import {
  guardarComposicionProducto,
  listarComposicionProductos,
  movimientosDeStock,
  type ComponenteProducto,
  type MovimientoTrazado
} from '../../services/productoComposicionService'
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
import {
  UNIDADES_PRECIO,
  etiquetaUnidadCorta,
  normalizarUnidadPrecio
} from '../../utils/unidadPrecio'
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
  const [editUnidad, setEditUnidad] = useState('m2')
  const [editStockId, setEditStockId] = useState('')
  const [editStockBusqueda, setEditStockBusqueda] = useState('')
  const [editPortal, setEditPortal] = useState(false)
  const [editTotem, setEditTotem] = useState(false)
  const [stockItems, setStockItems] = useState<ArticuloStock[]>([])
  const [composicion, setComposicion] = useState<Record<number, ComponenteProducto[]>>({})
  const [editComponentes, setEditComponentes] = useState<ComponenteProducto[]>([])
  const [vinculando, setVinculando] = useState(false)
  const [trazadoId, setTrazadoId] = useState<number | null>(null)
  const [trazadoMovs, setTrazadoMovs] = useState<MovimientoTrazado[]>([])
  const [trazadoCargando, setTrazadoCargando] = useState(false)
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, stockRes] = await Promise.all([
        apiService.getArticulosEmpresa(undefined, false),
        apiService.getArticulosStock()
      ])
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo cargar el catálogo')
      setArticulos(res.data.filter((a) => a.activo && !a.codigo?.startsWith('ART-')))
      setStockItems(stockRes.success && stockRes.data ? stockRes.data : [])
      const compRes = await listarComposicionProductos()
      const porArticulo: Record<number, ComponenteProducto[]> = {}
      for (const linea of compRes.data) {
        const lista = porArticulo[linea.id_articulo] || []
        lista.push(linea)
        porArticulo[linea.id_articulo] = lista
      }
      setComposicion(porArticulo)
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
          precio_total: precio,
          unidad_medida: normalizarUnidadPrecio(articulo.unidad_medida)
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
    setEditUnidad(normalizarUnidadPrecio(articulo.unidad_medida))
    setEditStockId('')
    setEditStockBusqueda('')
    const propias = composicion[articulo.id] || []
    if (propias.length) {
      setEditComponentes(propias)
    } else if (articulo.id_articulo_stock) {
      const stock = stockItems.find((s) => s.id === articulo.id_articulo_stock)
      setEditComponentes([
        {
          id_articulo: articulo.id,
          id_articulo_stock: articulo.id_articulo_stock,
          cantidad: Number(articulo.unidades_por_venta) > 0 ? Number(articulo.unidades_por_venta) : 1,
          codigo_stock: stock?.codigo,
          descripcion_stock: stock?.descripcion
        }
      ])
    } else {
      setEditComponentes([])
    }
    setEditPortal(Boolean(articulo.visible_portal ?? articulo.visible_clientes))
    setEditTotem(Boolean(articulo.visible_totem))
  }

  const componentesDe = (a: ArticuloEmpresaRecord): ComponenteProducto[] => {
    const propias = composicion[a.id]
    if (propias?.length) return propias
    if (!a.id_articulo_stock) return []
    const stock = stockItems.find((s) => s.id === a.id_articulo_stock)
    return [
      {
        id_articulo: a.id,
        id_articulo_stock: a.id_articulo_stock,
        cantidad: Number(a.unidades_por_venta) > 0 ? Number(a.unidades_por_venta) : 1,
        codigo_stock: stock?.codigo,
        descripcion_stock: stock?.descripcion
      }
    ]
  }

  const agregarInsumo = () => {
    const id = Number(editStockId)
    if (!id) return
    if (editComponentes.some((c) => c.id_articulo_stock === id)) return
    const stock = stockItems.find((s) => s.id === id)
    setEditComponentes((prev) => [
      ...prev,
      {
        id_articulo: editandoId || 0,
        id_articulo_stock: id,
        cantidad: 1,
        codigo_stock: stock?.codigo,
        descripcion_stock: stock?.descripcion
      }
    ])
    setEditStockId('')
  }

  const opcionesStock = useMemo(() => {
    const q = editStockBusqueda.trim().toLowerCase()
    const base = q
      ? stockItems.filter((s) => `${s.codigo || ''} ${s.descripcion}`.toLowerCase().includes(q))
      : stockItems
    const elegido = editStockId ? stockItems.find((s) => String(s.id) === editStockId) : undefined
    const lista = base.slice(0, 40)
    if (elegido && !lista.some((s) => s.id === elegido.id)) lista.unshift(elegido)
    return lista
  }, [editStockBusqueda, editStockId, stockItems])

  const abrirTrazado = async (a: ArticuloEmpresaRecord) => {
    if (trazadoId === a.id) {
      setTrazadoId(null)
      setTrazadoMovs([])
      return
    }
    setTrazadoId(a.id)
    setTrazadoMovs([])
    const ids = componentesDe(a).map((c) => c.id_articulo_stock)
    if (!ids.length) return
    setTrazadoCargando(true)
    const movs = await movimientosDeStock(ids)
    setTrazadoMovs(movs)
    setTrazadoCargando(false)
  }

  const vincularPorCodigo = async () => {
    const pares = articulos
      .filter((a) => !componentesDe(a).length && a.codigo?.trim())
      .flatMap((a) => {
        const codigo = a.codigo.trim().toLowerCase()
        const stock = stockItems.find((s) => (s.codigo || '').trim().toLowerCase() === codigo)
        return stock ? [{ articulo: a, stock }] : []
      })
    if (!pares.length) {
      alert('No hay productos sin insumos cuyo código coincida con un artículo de stock.')
      return
    }
    if (!window.confirm(`Armar ${pares.length} producto(s) con el artículo de stock del mismo código?`)) return
    setVinculando(true)
    let ok = 0
    for (const { articulo, stock } of pares) {
      const portal = Boolean(articulo.visible_portal ?? articulo.visible_clientes)
      const comp = await guardarComposicionProducto(articulo.id, [
        {
          id_articulo_stock: stock.id,
          cantidad: 1,
          codigo_stock: stock.codigo,
          descripcion_stock: stock.descripcion
        }
      ])
      const res = await apiService.actualizarCamposComercioArticuloEmpresa(articulo.id, {
        id_articulo_stock: stock.id,
        controla_stock: true,
        visible_portal: portal,
        visible_clientes: portal,
        visible_totem: Boolean(articulo.visible_totem)
      })
      if (comp.success && res.success && res.data) {
        ok += 1
        setComposicion((prev) => ({ ...prev, [articulo.id]: comp.data }))
        setArticulos((prev) =>
          prev.map((row) =>
            row.id === articulo.id ? { ...row, ...res.data, stock_disponible: stock.stock } : row
          )
        )
      }
    }
    setVinculando(false)
    alert(`Vinculados ${ok} de ${pares.length}.`)
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
        unidad_medida: normalizarUnidadPrecio(editUnidad)
      })
      if (!res.success || !res.data) throw new Error(res.error || 'No se guardó')
      const lineas = editComponentes
        .filter((c) => c.id_articulo_stock > 0 && Number(c.cantidad) > 0)
        .map((c) => ({
          id_articulo_stock: c.id_articulo_stock,
          cantidad: Number(c.cantidad),
          codigo_stock: c.codigo_stock,
          descripcion_stock: c.descripcion_stock
        }))
      const compRes = await guardarComposicionProducto(id, lineas)
      if (!compRes.success) throw new Error(compRes.error || 'No se guardó la composición del producto')
      const primero = lineas[0]
      const comercio = await apiService.actualizarCamposComercioArticuloEmpresa(id, {
        id_articulo_stock: primero ? primero.id_articulo_stock : null,
        controla_stock: lineas.length > 0,
        unidades_por_venta: primero ? primero.cantidad : 1,
        visible_portal: editPortal,
        visible_clientes: editPortal,
        visible_totem: editTotem
      })
      if (!comercio.success) throw new Error(comercio.error || 'El precio se guardó, pero no la publicación del producto')
      const stock = primero ? stockItems.find((s) => s.id === primero.id_articulo_stock) : undefined
      setComposicion((prev) => ({ ...prev, [id]: compRes.data }))
      setArticulos((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                ...res.data,
                ...comercio.data,
                stock_disponible: stock ? stock.stock : null
              }
            : a
        )
      )
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
              La lista de precios, el stock y los productos son cosas distintas y están conectados. Cada línea
              pone precio a un producto. Ese producto es lo que se vende en el portal y en el tótem, y está
              hecho con artículos de stock. La lista 1 se copia a <strong>precio_base</strong>. Los valores en
              tabla incluyen <strong>{labelAjustesPreciosActivos(ajustes)}</strong>.
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
            <button
              type="button"
              className="vlp-btn vlp-btn--outline"
              disabled={vinculando || stockItems.length === 0}
              onClick={() => void vincularPorCodigo()}
            >
              {vinculando ? 'Armando…' : 'Armar con stock del mismo código'}
            </button>
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
                    <th title="Precio final de la lista activa, por unidad">Usar</th>
                    <th title="Artículos de stock con los que está hecho el producto">Hecho con</th>
                    <th title="El producto se publica en el portal de clientes">Portal</th>
                    <th title="El producto se publica en el tótem">Tótem</th>
                    <th>Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {articulosFiltrados.map((a) => {
                    const pActivo = resolvePrecioLista(a, listaActiva, ajustes)
                    const editando = editandoId === a.id
                    const insumos = componentesDe(a)
                    const enPortal = Boolean(a.visible_portal ?? a.visible_clientes)
                    const enTotem = Boolean(a.visible_totem)
                    const precioCanal = a.precio_lista_1 ?? a.precio_base
                    const precioDesfasado =
                      a.precio_base != null &&
                      precioCanal != null &&
                      Number(a.precio_base) !== Number(precioCanal)
                    const editCells = (
                      <>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio1} onChange={(e) => setEditPrecio1(e.target.value)} />
                        </td>
                        <td>
                          <input className="vlp-input vlp-input--sm" value={editPrecio2} onChange={(e) => setEditPrecio2(e.target.value)} />
                        </td>
                      </>
                    )
                    return (
                      <Fragment key={a.id}>
                      <tr className={editando ? 'vlp-row--editing' : undefined}>
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
                          </>
                        )}
                        <td className="vlp-precio-activo">
                          {editando ? (
                            <select
                              className="vlp-select vlp-select--unidad"
                              value={editUnidad}
                              onChange={(e) => setEditUnidad(e.target.value)}
                              aria-label="Unidad de medida"
                            >
                              {UNIDADES_PRECIO.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.cantidad}
                                </option>
                              ))}
                            </select>
                          ) : pActivo != null ? (
                            <>
                              ${formatArs(pActivo)}
                              <span className="vlp-unidad"> / {etiquetaUnidadCorta(a.unidad_medida)}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="vlp-stock">
                          {editando ? (
                            <div className="vlp-stock-edit">
                              {editComponentes.map((c) => (
                                <div key={c.id_articulo_stock} className="vlp-comp-line">
                                  <span>{c.codigo_stock || `#${c.id_articulo_stock}`}</span>
                                  <input
                                    className="vlp-input vlp-input--sm"
                                    value={String(c.cantidad)}
                                    onChange={(e) =>
                                      setEditComponentes((prev) =>
                                        prev.map((row) =>
                                          row.id_articulo_stock === c.id_articulo_stock
                                            ? { ...row, cantidad: Number(e.target.value.replace(',', '.')) || 0 }
                                            : row
                                        )
                                      )
                                    }
                                    aria-label="Cantidad de insumo"
                                  />
                                  <button
                                    type="button"
                                    className="vlp-btn vlp-btn--ghost vlp-btn--xs"
                                    onClick={() =>
                                      setEditComponentes((prev) =>
                                        prev.filter((row) => row.id_articulo_stock !== c.id_articulo_stock)
                                      )
                                    }
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <input
                                className="vlp-input vlp-input--sm"
                                value={editStockBusqueda}
                                onChange={(e) => setEditStockBusqueda(e.target.value)}
                                placeholder="Buscar insumo"
                                aria-label="Buscar artículo de stock"
                              />
                              <select
                                className="vlp-select vlp-select--unidad"
                                value={editStockId}
                                onChange={(e) => setEditStockId(e.target.value)}
                                aria-label="Artículo de stock"
                              >
                                <option value="">Elegir insumo</option>
                                {opcionesStock.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {(s.codigo || `#${s.id}`) + ' · ' + s.descripcion} ({s.stock ?? 0})
                                  </option>
                                ))}
                              </select>
                              <button type="button" className="vlp-btn vlp-btn--ghost vlp-btn--xs" onClick={agregarInsumo}>
                                + Insumo
                              </button>
                            </div>
                          ) : insumos.length ? (
                            <ul className="vlp-comp-read">
                              {insumos.slice(0, 3).map((c) => (
                                <li key={c.id_articulo_stock}>
                                  {c.codigo_stock || c.descripcion_stock || `#${c.id_articulo_stock}`} × {c.cantidad}
                                </li>
                              ))}
                              {insumos.length > 3 ? <li>+{insumos.length - 3}</li> : null}
                            </ul>
                          ) : (
                            <span className="vlp-chip vlp-chip--off">Sin insumos</span>
                          )}
                        </td>
                        <td>
                          {editando ? (
                            <label className="vlp-check">
                              <input
                                type="checkbox"
                                checked={editPortal}
                                onChange={(e) => setEditPortal(e.target.checked)}
                              />
                              Portal
                            </label>
                          ) : (
                            <span className={`vlp-chip${enPortal ? ' vlp-chip--on' : ' vlp-chip--off'}`}>
                              {enPortal ? 'Sí' : 'No'}
                            </span>
                          )}
                        </td>
                        <td>
                          {editando ? (
                            <label className="vlp-check">
                              <input
                                type="checkbox"
                                checked={editTotem}
                                onChange={(e) => setEditTotem(e.target.checked)}
                              />
                              Tótem
                            </label>
                          ) : (
                            <span className={`vlp-chip${enTotem ? ' vlp-chip--on' : ' vlp-chip--off'}`}>
                              {enTotem ? 'Sí' : 'No'}
                            </span>
                          )}
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
                                title="Editar precio del producto, insumos y publicación"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="vlp-btn vlp-btn--ghost vlp-btn--xs"
                                onClick={() => void abrirTrazado(a)}
                              >
                                {trazadoId === a.id ? 'Ocultar' : 'Trazado'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                      {trazadoId === a.id ? (
                        <tr className="vlp-trace-row">
                          <td colSpan={10}>
                            <div className="vlp-trace">
                              <p>
                                Línea de lista <strong>{a.codigo}</strong> → producto <strong>#{a.id}</strong>{' '}
                                {a.nombre}. Precio de portal y tótem{' '}
                                <strong>${formatArs(Number(a.precio_base) || 0)}</strong>
                                {precioDesfasado ? ' · la lista 1 no coincide con el precio del producto: guardá de nuevo' : ''}
                              </p>
                              <p>
                                {enPortal ? 'Publicado en portal' : 'Oculto en portal'}
                                {' · '}
                                {enTotem ? 'publicado en tótem' : 'oculto en tótem'}
                              </p>
                              {insumos.length ? (
                                <ul>
                                  {insumos.map((c) => {
                                    const art = stockItems.find((s) => s.id === c.id_articulo_stock)
                                    return (
                                      <li key={c.id_articulo_stock}>
                                        <strong>
                                          {c.codigo_stock || art?.codigo || `#${c.id_articulo_stock}`} × {c.cantidad}
                                        </strong>
                                        <span>{c.descripcion_stock || art?.descripcion}</span>
                                        <span>existencia {art?.stock ?? '—'}</span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              ) : (
                                <p className="vlp-muted">Este producto todavía no está hecho con insumos de stock.</p>
                              )}
                              {trazadoCargando ? (
                                <p className="vlp-muted">Cargando movimientos…</p>
                              ) : trazadoMovs.length === 0 ? (
                                <p className="vlp-muted">Sin movimientos de stock para este producto.</p>
                              ) : (
                                <ul>
                                  {trazadoMovs.map((m) => (
                                    <li key={m.id}>
                                      <span>{new Date(m.created_at).toLocaleString('es-AR')}</span>
                                      <strong>
                                        {m.tipo_movimiento} {m.cantidad}
                                      </strong>
                                      <span>{m.motivo || m.descripcion}</span>
                                      {m.id_pedido_cliente ? <span>pedido #{m.id_pedido_cliente}</span> : null}
                                      {m.id_venta ? <span>venta #{m.id_venta}</span> : null}
                                      {m.id_orden_trabajo ? <span>OP #{m.id_orden_trabajo}</span> : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
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
                      {line.cantidad} {etiquetaUnidadCorta(line.unidad_medida)} × ${formatArs(line.precio_unitario)}
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
