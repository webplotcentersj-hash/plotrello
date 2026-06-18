import { useState, useEffect, useMemo } from 'react'
import apiService from '../services/api'
import type {
  ArticuloEmpresaRecord,
  ClienteRecord,
  PresupuestoVentaItemRecord,
  PresupuestoVentaRecord,
  OportunidadVenta
} from '../types/api'
import {
  labelAjustesPreciosActivos,
  labelListaPrecio,
  LISTAS_PRECIO_VENTAS,
  resolvePrecioLista,
  type TipoListaPrecioVentas
} from '../constants/ventasListasPrecio'
import { useConfigAjustesPreciosVentas } from '../hooks/useConfigAjustesPreciosVentas'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import {
  leerVentasPresupuestoDraft,
  limpiarVentasPresupuestoDraft
} from '../utils/ventasPresupuestoDraft'
import {
  descargarPresupuestoVentaPDF,
  enviarPresupuestoPorEmail,
  enviarPresupuestoPorWhatsapp
} from '../utils/presupuestoVentaPdf'
import './CrearPresupuestoModal.css'

interface CrearPresupuestoModalProps {
  onClose: () => void
  onSuccess: () => void
  usuarioId: number
  usuarioNombre: string
  prefillDesdeOportunidad?: OportunidadVenta | null
}

interface ItemPresupuesto {
  id_articulo_empresa?: number
  id_articulo_stock?: number
  codigo_articulo?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  precio_total: number
  observaciones?: string
}

const CrearPresupuestoModal = ({
  onClose,
  onSuccess,
  usuarioId,
  usuarioNombre,
  prefillDesdeOportunidad
}: CrearPresupuestoModalProps) => {
  const { ajustes: ajustesPrecios } = useConfigAjustesPreciosVentas()

  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteRecord | null>(null)
  const [crearNuevoCliente, setCrearNuevoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    dni_cuit: '',
    telefono: '',
    email: '',
    empresa: '',
    direccion: ''
  })

  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [observacionesCliente, setObservacionesCliente] = useState('')
  const [observacionesInternas, setObservacionesInternas] = useState('')
  const [estado, setEstado] = useState<'borrador' | 'enviado'>('borrador')

  const [busquedaArticulo, setBusquedaArticulo] = useState('')
  const [categoriaArticulo, setCategoriaArticulo] = useState('todas')
  const [catalogoArticulos, setCatalogoArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(false)
  const [itemsPresupuesto, setItemsPresupuesto] = useState<ItemPresupuesto[]>([])
  const [tipoListaPrecio, setTipoListaPrecio] = useState<TipoListaPrecioVentas>('lista_1')

  const [guardando, setGuardando] = useState(false)
  const [presupuestoCreado, setPresupuestoCreado] = useState<PresupuestoVentaRecord | null>(null)
  const [itemsCreados, setItemsCreados] = useState<PresupuestoVentaItemRecord[]>([])
  const [enviandoPdf, setEnviandoPdf] = useState(false)

  useEffect(() => {
    if (!prefillDesdeOportunidad) return
    const o = prefillDesdeOportunidad
    setBusquedaCliente(o.cliente_nombre)
    setCrearNuevoCliente(true)
    setClienteSeleccionado(null)
    setNuevoCliente({
      nombre: o.cliente_nombre,
      dni_cuit: o.cliente_dni_cuit || '',
      telefono: o.cliente_telefono || '',
      email: o.cliente_email || '',
      empresa: o.cliente_empresa || '',
      direccion: o.cliente_direccion || ''
    })
    const int = [o.descripcion, o.observaciones && `Obs. CRM: ${o.observaciones}`]
      .filter(Boolean)
      .join('\n\n')
    setObservacionesInternas(
      `Oportunidad CRM ${o.numero_oportunidad}${int ? `\n\n${int}` : ''}`.trim()
    )
    if (o.descripcion?.trim()) {
      setObservacionesCliente(
        `Alcance / referencia: ${o.descripcion.slice(0, 800)}${o.descripcion.length > 800 ? '…' : ''}`
      )
    }
  }, [prefillDesdeOportunidad])

  useEffect(() => {
    const draft = leerVentasPresupuestoDraft()
    if (!draft) return
    setTipoListaPrecio(draft.tipoLista)
    setItemsPresupuesto(
      draft.items.map((item) => ({
        id_articulo_stock: item.id_articulo_stock,
        codigo_articulo: item.codigo_articulo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento,
        precio_total: item.precio_total
      }))
    )
    setObservacionesInternas((prev) => {
      const nota = `Lista: ${labelListaPrecio(draft.tipoLista)}`
      return prev?.includes(nota) ? prev : prev ? `${prev}\n${nota}` : nota
    })
  }, [])

  useEffect(() => {
    if (busquedaCliente.trim().length < 1 || crearNuevoCliente || clienteSeleccionado) {
      setClientesEncontrados([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true)
      try {
        const response = await apiService.buscarClientes(busquedaCliente.trim())
        setClientesEncontrados(response.success && response.data ? response.data : [])
      } catch (error) {
        console.error('Error buscando clientes:', error)
        setClientesEncontrados([])
      } finally {
        setBuscandoClientes(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [busquedaCliente, crearNuevoCliente, clienteSeleccionado])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingCatalogo(true)
      try {
        const response = await apiService.getArticulosEmpresa(undefined, false)
        if (!cancelled && response.success && response.data) {
          setCatalogoArticulos(
            response.data.filter((a) => a.activo && !a.codigo?.startsWith('ART-'))
          )
        }
      } catch (error) {
        console.error('Error cargando lista de precios:', error)
      } finally {
        if (!cancelled) setLoadingCatalogo(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const categoriasArticulos = useMemo(() => {
    const set = new Set<string>()
    for (const a of catalogoArticulos) {
      if (a.categoria?.trim()) set.add(a.categoria.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [catalogoArticulos])

  const articulosFiltrados = useMemo(() => {
    const q = busquedaArticulo.trim().toLowerCase()
    return catalogoArticulos.filter((a) => {
      if (categoriaArticulo !== 'todas' && (a.categoria || '') !== categoriaArticulo) return false
      if (!q) return false
      const tokens = q.split(/\s+/).filter(Boolean)
      const haystack = [a.nombre, a.codigo, a.descripcion, a.categoria]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return tokens.every((t) => haystack.includes(t))
    })
  }, [catalogoArticulos, busquedaArticulo, categoriaArticulo])

  useEffect(() => {
    if (itemsPresupuesto.length === 0 || catalogoArticulos.length === 0) return
    setItemsPresupuesto((prev) =>
      prev.map((item) => {
        if (!item.id_articulo_empresa) return item
        const art = catalogoArticulos.find((a) => a.id === item.id_articulo_empresa)
        if (!art) return item
        const precio = resolvePrecioLista(art, tipoListaPrecio, ajustesPrecios)
        if (precio == null) return item
        const precioTotal = precio * item.cantidad - (item.descuento || 0)
        return { ...item, precio_unitario: precio, precio_total: precioTotal }
      })
    )
  }, [tipoListaPrecio, catalogoArticulos, ajustesPrecios])

  const seleccionarCliente = (cliente: ClienteRecord) => {
    setClienteSeleccionado(cliente)
    setBusquedaCliente(nombreCompletoCliente(cliente))
    setClientesEncontrados([])
    setCrearNuevoCliente(false)
    setNuevoCliente({
      nombre: nombreCompletoCliente(cliente),
      dni_cuit: cliente.dni_cuit || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      empresa: cliente.empresa || '',
      direccion: cliente.direccion || ''
    })
  }

  const agregarArticulo = (articulo: ArticuloEmpresaRecord) => {
    if (itemsPresupuesto.some((item) => item.id_articulo_empresa === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    const precio = resolvePrecioLista(articulo, tipoListaPrecio, ajustesPrecios)
    if (precio == null) {
      alert(`Este artículo no tiene precio en ${labelListaPrecio(tipoListaPrecio)}.`)
      return
    }

    const stock = articulo.stock_disponible
    const nuevoItem: ItemPresupuesto = {
      id_articulo_empresa: articulo.id,
      id_articulo_stock: articulo.id_articulo_stock ?? undefined,
      codigo_articulo: articulo.codigo || undefined,
      descripcion: articulo.nombre,
      cantidad: 1,
      precio_unitario: precio,
      descuento: 0,
      precio_total: precio,
      observaciones:
        stock != null && stock <= 0 && articulo.controla_stock !== false
          ? 'Stock agotado'
          : undefined
    }

    setItemsPresupuesto([...itemsPresupuesto, nuevoItem])
    setBusquedaArticulo('')
  }

  const eliminarItem = (index: number) => {
    setItemsPresupuesto(itemsPresupuesto.filter((_, i) => i !== index))
  }

  const actualizarItem = (index: number, campo: keyof ItemPresupuesto, valor: number) => {
    const nuevosItems = [...itemsPresupuesto]
    const item = nuevosItems[index]
    const cantidad = campo === 'cantidad' ? valor : item.cantidad
    const precioUnitario = campo === 'precio_unitario' ? valor : item.precio_unitario
    const descuento = campo === 'descuento' ? valor : item.descuento
    nuevosItems[index] = {
      ...item,
      [campo]: valor,
      precio_total: precioUnitario * cantidad - descuento
    }
    setItemsPresupuesto(nuevosItems)
  }

  const calcularTotal = () => itemsPresupuesto.reduce((sum, item) => sum + item.precio_total, 0)

  const resolverCliente = async (): Promise<{
    id: number | null
    nombre: string
    telefono: string
    email: string
    dni_cuit: string
    empresa: string
    direccion: string
  }> => {
    if (clienteSeleccionado) {
      return {
        id: clienteSeleccionado.id,
        nombre: nombreCompletoCliente(clienteSeleccionado),
        telefono: clienteSeleccionado.telefono || nuevoCliente.telefono,
        email: clienteSeleccionado.email || nuevoCliente.email,
        dni_cuit: clienteSeleccionado.dni_cuit || nuevoCliente.dni_cuit,
        empresa: clienteSeleccionado.empresa || nuevoCliente.empresa,
        direccion: clienteSeleccionado.direccion || nuevoCliente.direccion
      }
    }

    if (crearNuevoCliente) {
      const nombre = nuevoCliente.nombre.trim()
      if (!nombre) throw new Error('El nombre del cliente es obligatorio')

      const clienteResponse = await apiService.buscarOCrearCliente({
        nombre,
        dni_cuit: nuevoCliente.dni_cuit || undefined,
        telefono: nuevoCliente.telefono || undefined,
        email: nuevoCliente.email || undefined,
        direccion: nuevoCliente.direccion || undefined
      })

      if (!clienteResponse.success || !clienteResponse.data) {
        throw new Error(clienteResponse.error || 'Error al crear cliente')
      }

      return {
        id: clienteResponse.data.id,
        nombre,
        telefono: nuevoCliente.telefono,
        email: nuevoCliente.email,
        dni_cuit: nuevoCliente.dni_cuit,
        empresa: nuevoCliente.empresa,
        direccion: nuevoCliente.direccion
      }
    }

    if (busquedaCliente.trim().length >= 2) {
      if (clientesEncontrados.length === 1) {
        const c = clientesEncontrados[0]
        return {
          id: c.id,
          nombre: nombreCompletoCliente(c),
          telefono: c.telefono || '',
          email: c.email || '',
          dni_cuit: c.dni_cuit || '',
          empresa: c.empresa || '',
          direccion: c.direccion || ''
        }
      }
      throw new Error('Seleccioná un cliente de la lista o usá "Crear nuevo"')
    }

    throw new Error('Indicá el cliente del presupuesto')
  }

  const handleGuardarPresupuesto = async () => {
    if (itemsPresupuesto.length === 0) {
      alert('Agregá al menos un artículo')
      return
    }

    setGuardando(true)

    try {
      const cliente = await resolverCliente()

      const itemsParaAPI = itemsPresupuesto.map((item) => ({
        id_articulo_stock: item.id_articulo_stock,
        codigo_articulo: item.codigo_articulo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento || 0,
        precio_total: item.precio_total,
        observaciones: item.observaciones
      }))

      const presupuestoResponse = await apiService.crearPresupuestoVenta({
        id_cliente: cliente.id,
        cliente_nombre: cliente.nombre,
        cliente_telefono: cliente.telefono || undefined,
        cliente_email: cliente.email || undefined,
        cliente_dni_cuit: cliente.dni_cuit || undefined,
        cliente_empresa: cliente.empresa || undefined,
        cliente_direccion: cliente.direccion || undefined,
        id_vendedor: usuarioId,
        nombre_vendedor: usuarioNombre,
        items: itemsParaAPI,
        fecha_vencimiento: fechaVencimiento || undefined,
        observaciones_cliente: observacionesCliente || undefined,
        observaciones_internas: observacionesInternas || undefined,
        estado,
        tipo_lista_precio: tipoListaPrecio
      })

      if (!presupuestoResponse.success || !presupuestoResponse.data) {
        throw new Error(presupuestoResponse.error || 'Error al crear presupuesto')
      }

      const detalle = await apiService.obtenerDetallePresupuestoVenta(presupuestoResponse.data.id)
      const itemsGuardados = detalle.success && detalle.data ? detalle.data.items : []

      limpiarVentasPresupuestoDraft()
      setPresupuestoCreado(presupuestoResponse.data)
      setItemsCreados(itemsGuardados)
    } catch (error: unknown) {
      console.error('Error creando presupuesto:', error)
      const msg = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al crear presupuesto: ${msg}`)
    } finally {
      setGuardando(false)
    }
  }

  const cerrarConExito = () => {
    onSuccess()
    onClose()
  }

  const conPdf = async (fn: () => Promise<void>) => {
    if (!presupuestoCreado) return
    setEnviandoPdf(true)
    try {
      await fn()
      if (presupuestoCreado.estado === 'borrador') {
        await apiService.actualizarEstadoPresupuestoVenta(presupuestoCreado.id, 'enviado')
        setPresupuestoCreado({ ...presupuestoCreado, estado: 'enviado' })
      }
    } catch (e) {
      console.error(e)
      alert('No se pudo generar el PDF')
    } finally {
      setEnviandoPdf(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (presupuestoCreado) return
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-content presupuesto-venta-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📄 Crear Presupuesto de Venta</h2>
          <p className="venta-rapida-lista-badge">{labelListaPrecio(tipoListaPrecio)}</p>
          <button type="button" className="modal-close" onClick={presupuestoCreado ? cerrarConExito : onClose}>
            ×
          </button>
        </div>

        {presupuestoCreado ? (
          <div className="modal-body">
            <div className="presupuesto-exito">
              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>✅</div>
              <h3>Presupuesto creado</h3>
              <p className="presupuesto-exito__numero">
                Número trazable: <strong>{presupuestoCreado.numero_presupuesto}</strong>
              </p>
              <p style={{ color: '#94a3b8' }}>
                Total: ${(presupuestoCreado.precio_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <div className="presupuesto-exito__acciones">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enviandoPdf}
                  onClick={() =>
                    void conPdf(() => descargarPresupuestoVentaPDF(presupuestoCreado, itemsCreados))
                  }
                >
                  📥 Descargar PDF
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={enviandoPdf}
                  onClick={() =>
                    void conPdf(() =>
                      enviarPresupuestoPorWhatsapp(presupuestoCreado, itemsCreados)
                    )
                  }
                >
                  💬 WhatsApp
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={enviandoPdf}
                  onClick={() =>
                    void conPdf(() => enviarPresupuestoPorEmail(presupuestoCreado, itemsCreados))
                  }
                >
                  ✉️ Email
                </button>
                <button type="button" className="btn-secondary" onClick={cerrarConExito}>
                  Cerrar
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '16px' }}>
                El PDF incluye logo de la empresa y el número {presupuestoCreado.numero_presupuesto}.
                Para WhatsApp/Email se descarga el PDF y se abre la app correspondiente.
              </p>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <div className="form-section">
              <h3>👤 Cliente</h3>
              <div className="cliente-toolbar">
                <label>Buscar cliente</label>
                {!crearNuevoCliente && !clienteSeleccionado && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setCrearNuevoCliente(true)
                      setClienteSeleccionado(null)
                      setNuevoCliente((prev) => ({
                        ...prev,
                        nombre: busquedaCliente.trim() || prev.nombre
                      }))
                    }}
                  >
                    ➕ Crear nuevo
                  </button>
                )}
              </div>

              {!crearNuevoCliente && (
                <div
                  className={`cliente-search-container${clienteSeleccionado ? ' cliente-search-container--selected' : ''}`}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nombre, apellido, DNI, teléfono o empresa…"
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value)
                      setClienteSeleccionado(null)
                    }}
                    readOnly={!!clienteSeleccionado}
                    autoComplete="off"
                  />
                  {buscandoClientes && !clienteSeleccionado && (
                    <span style={{ position: 'absolute', right: 12, top: 12 }}>⏳</span>
                  )}
                  {clientesEncontrados.length > 0 && !clienteSeleccionado && (
                    <div className="dropdown-results">
                      {clientesEncontrados.map((cliente) => (
                        <div
                          key={cliente.id}
                          className="dropdown-item"
                          onClick={() => seleccionarCliente(cliente)}
                        >
                          <strong>{nombreCompletoCliente(cliente)}</strong>
                          {cliente.empresa && (
                            <span className="dropdown-subtext">🏢 {cliente.empresa}</span>
                          )}
                          {cliente.dni_cuit && (
                            <span className="dropdown-subtext">🪪 {cliente.dni_cuit}</span>
                          )}
                          {cliente.telefono && (
                            <span className="dropdown-subtext">📞 {cliente.telefono}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {crearNuevoCliente && (
                <div className="nuevo-cliente-form">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nombre completo *"
                    value={nuevoCliente.nombre}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="DNI/CUIT"
                    value={nuevoCliente.dni_cuit}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, dni_cuit: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Teléfono"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                  />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Email"
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Empresa"
                    value={nuevoCliente.empresa}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, empresa: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Dirección"
                    value={nuevoCliente.direccion}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setCrearNuevoCliente(false)
                      setNuevoCliente({
                        nombre: '',
                        dni_cuit: '',
                        telefono: '',
                        email: '',
                        empresa: '',
                        direccion: ''
                      })
                    }}
                  >
                    Cancelar nuevo cliente
                  </button>
                </div>
              )}

              {clienteSeleccionado && (
                <div className="cliente-seleccionado">
                  <div>
                    <strong>✓ {nombreCompletoCliente(clienteSeleccionado)}</strong>
                    {clienteSeleccionado.dni_cuit && (
                      <span className="cliente-seleccionado__meta">{clienteSeleccionado.dni_cuit}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setClienteSeleccionado(null)
                      setBusquedaCliente('')
                      setClientesEncontrados([])
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>📦 Artículos — Lista Flexxus</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 12px' }}>
                Precios con <strong>{labelAjustesPreciosActivos(ajustesPrecios)}</strong>
              </p>

              <div className="lista-selector-row">
                {(Object.keys(LISTAS_PRECIO_VENTAS) as TipoListaPrecioVentas[]).map((lista) => (
                  <button
                    key={lista}
                    type="button"
                    className={`lista-chip${tipoListaPrecio === lista ? ' lista-chip--active' : ''}`}
                    onClick={() => setTipoListaPrecio(lista)}
                  >
                    {labelListaPrecio(lista)}
                  </button>
                ))}
              </div>

              <div className="lista-precios-filtros">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por código, nombre o rubro…"
                  value={busquedaArticulo}
                  onChange={(e) => setBusquedaArticulo(e.target.value)}
                  autoComplete="off"
                />
                {categoriasArticulos.length > 0 && (
                  <select
                    className="form-select"
                    value={categoriaArticulo}
                    onChange={(e) => setCategoriaArticulo(e.target.value)}
                    style={{ width: 'auto', minWidth: '140px' }}
                  >
                    <option value="todas">Todos los rubros</option>
                    {categoriasArticulos.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {loadingCatalogo ? (
                <p className="lista-precios-empty">Cargando catálogo…</p>
              ) : busquedaArticulo.trim() ? (
                <div className="lista-precios-panel">
                  {articulosFiltrados.length === 0 ? (
                    <p className="lista-precios-empty">Sin resultados para «{busquedaArticulo}»</p>
                  ) : (
                    articulosFiltrados.slice(0, 40).map((articulo) => {
                      const precio = resolvePrecioLista(articulo, tipoListaPrecio, ajustesPrecios)
                      return (
                        <div
                          key={articulo.id}
                          className="lista-precios-row"
                          onClick={() => agregarArticulo(articulo)}
                        >
                          <div>
                            <div className="lista-precios-row__nombre">{articulo.nombre}</div>
                            <div className="lista-precios-row__meta">
                              {articulo.codigo && `Cód. ${articulo.codigo}`}
                              {articulo.categoria && ` · ${articulo.categoria}`}
                            </div>
                          </div>
                          <span className="lista-precios-row__precio">
                            {precio != null
                              ? `$${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              ) : (
                <p className="lista-precios-empty">Escribí para buscar en la lista de precios</p>
              )}

              {itemsPresupuesto.length > 0 && (
                <div className="items-list" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {itemsPresupuesto.map((item, index) => (
                    <div key={index} className="item-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <strong>{item.descripcion}</strong>
                          {item.codigo_articulo && (
                            <div className="item-codigo">Código: {item.codigo_articulo}</div>
                          )}
                        </div>
                        <button type="button" className="btn-icon" onClick={() => eliminarItem(index)}>
                          🗑️
                        </button>
                      </div>
                      <div className="item-controls">
                        <div className="item-control">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            className="form-input-small"
                            min="0.001"
                            step="0.001"
                            value={item.cantidad}
                            onChange={(e) =>
                              actualizarItem(index, 'cantidad', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="item-control">
                          <label>Precio unit.</label>
                          <input
                            type="number"
                            className="form-input-small"
                            min="0"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(e) =>
                              actualizarItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="item-control">
                          <label>Descuento</label>
                          <input
                            type="number"
                            className="form-input-small"
                            min="0"
                            step="0.01"
                            value={item.descuento}
                            onChange={(e) =>
                              actualizarItem(index, 'descuento', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>
                      <div className="item-subtotal">
                        Subtotal: ${item.precio_total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {itemsPresupuesto.length > 0 && (
                <div className="presupuesto-total-box">
                  <strong>Total: ${calcularTotal().toFixed(2)}</strong>
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>📋 Información adicional</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Estado inicial</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value as 'borrador' | 'enviado')}>
                    <option value="borrador">Borrador</option>
                    <option value="enviado">Enviado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones para el cliente</label>
                <textarea
                  className="form-textarea"
                  value={observacionesCliente}
                  onChange={(e) => setObservacionesCliente(e.target.value)}
                  placeholder="Visible en el PDF…"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Observaciones internas</label>
                <textarea
                  className="form-textarea"
                  value={observacionesInternas}
                  onChange={(e) => setObservacionesInternas(e.target.value)}
                  placeholder="Solo uso interno…"
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {!presupuestoCreado && (
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleGuardarPresupuesto()}
              disabled={guardando || itemsPresupuesto.length === 0}
            >
              {guardando ? 'Guardando…' : 'Crear Presupuesto'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CrearPresupuestoModal
