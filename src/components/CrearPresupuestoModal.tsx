import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { ClienteRecord, PresupuestoVentaRecord, OportunidadVenta } from '../types/api'
import type { ArticuloStock } from '../types/pedidos'
import { labelListaPrecio, type TipoListaPrecioVentas } from '../constants/ventasListasPrecio'
import {
  leerVentasPresupuestoDraft,
  limpiarVentasPresupuestoDraft
} from '../utils/ventasPresupuestoDraft'
import './VentaRapidaModal.css'

interface CrearPresupuestoModalProps {
  onClose: () => void
  onSuccess: () => void
  usuarioId: number
  usuarioNombre: string
  /** Pre-llenar datos de cliente y notas desde una oportunidad del CRM */
  prefillDesdeOportunidad?: OportunidadVenta | null
}

interface ItemPresupuesto {
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
  const [articulosEncontrados, setArticulosEncontrados] = useState<ArticuloStock[]>([])
  const [buscandoArticulos, setBuscandoArticulos] = useState(false)
  const [itemsPresupuesto, setItemsPresupuesto] = useState<ItemPresupuesto[]>([])
  const [tipoListaPrecio, setTipoListaPrecio] = useState<TipoListaPrecioVentas | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [presupuestoCreado, setPresupuestoCreado] = useState<PresupuestoVentaRecord | null>(null)

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
    const int = [o.descripcion, o.observaciones && `Obs. CRM: ${o.observaciones}`].filter(Boolean).join('\n\n')
    setObservacionesInternas(`Oportunidad CRM ${o.numero_oportunidad}${int ? `\n\n${int}` : ''}`.trim())
    if (o.descripcion?.trim()) {
      setObservacionesCliente(`Alcance / referencia: ${o.descripcion.slice(0, 800)}${o.descripcion.length > 800 ? '…' : ''}`)
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

  // Buscar clientes (desde 1 letra)
  useEffect(() => {
    if (busquedaCliente.trim().length < 1) {
      setClientesEncontrados([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true)
      try {
        const response = await apiService.buscarClientes(busquedaCliente.trim())
        if (response.success && response.data) {
          setClientesEncontrados(response.data)
        } else {
          setClientesEncontrados([])
        }
      } catch (error) {
        console.error('Error buscando clientes:', error)
        setClientesEncontrados([])
      } finally {
        setBuscandoClientes(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [busquedaCliente])

  // Buscar artículos (desde 1 letra)
  useEffect(() => {
    if (busquedaArticulo.trim().length < 1) {
      setArticulosEncontrados([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoArticulos(true)
      try {
        const response = await apiService.getArticulosStock(busquedaArticulo.trim(), false)
        if (response.success && response.data) {
          setArticulosEncontrados(response.data)
        } else {
          setArticulosEncontrados([])
        }
      } catch (error) {
        console.error('Error buscando artículos:', error)
        setArticulosEncontrados([])
      } finally {
        setBuscandoArticulos(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [busquedaArticulo])

  const seleccionarCliente = (cliente: ClienteRecord) => {
    setClienteSeleccionado(cliente)
    setBusquedaCliente(cliente.nombre)
    setClientesEncontrados([])
    setCrearNuevoCliente(false)
    // Pre-llenar datos del cliente
    setNuevoCliente({
      nombre: cliente.nombre,
      dni_cuit: cliente.dni_cuit || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      empresa: cliente.empresa || '',
      direccion: cliente.direccion || ''
    })
  }

  const agregarArticulo = (articulo: ArticuloStock) => {
    if (itemsPresupuesto.some(item => item.id_articulo_stock === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    const precioUnitario = articulo.precio || 0
    const cantidad = 1
    const descuento = 0
    const precioTotal = precioUnitario * cantidad - descuento

    const nuevoItem: ItemPresupuesto = {
      id_articulo_stock: articulo.id,
      codigo_articulo: articulo.codigo || undefined,
      descripcion: articulo.descripcion,
      cantidad,
      precio_unitario: precioUnitario,
      descuento,
      precio_total: precioTotal,
      observaciones: articulo.stock !== null && articulo.stock <= 0 ? 'Stock agotado' : undefined
    }

    setItemsPresupuesto([...itemsPresupuesto, nuevoItem])
    setBusquedaArticulo('')
    setArticulosEncontrados([])
  }

  const eliminarItem = (index: number) => {
    setItemsPresupuesto(itemsPresupuesto.filter((_, i) => i !== index))
  }

  const actualizarItem = (index: number, campo: keyof ItemPresupuesto, valor: any) => {
    const nuevosItems = [...itemsPresupuesto]
    const item = nuevosItems[index]
    
    if (campo === 'cantidad' || campo === 'precio_unitario' || campo === 'descuento') {
      const cantidad = campo === 'cantidad' ? valor : item.cantidad
      const precioUnitario = campo === 'precio_unitario' ? valor : item.precio_unitario
      const descuento = campo === 'descuento' ? valor : item.descuento
      const precioTotal = precioUnitario * cantidad - descuento
      
      nuevosItems[index] = {
        ...item,
        [campo]: valor,
        precio_total: precioTotal
      }
    } else {
      nuevosItems[index] = { ...item, [campo]: valor }
    }
    
    setItemsPresupuesto(nuevosItems)
  }

  const calcularTotal = () => {
    return itemsPresupuesto.reduce((sum, item) => sum + item.precio_total, 0)
  }

  const handleGuardarPresupuesto = async () => {
    if (!clienteSeleccionado && !crearNuevoCliente) {
      alert('Debes seleccionar o crear un cliente')
      return
    }

    if (crearNuevoCliente && !nuevoCliente.nombre.trim()) {
      alert('El nombre del cliente es obligatorio')
      return
    }

    if (itemsPresupuesto.length === 0) {
      alert('Debes agregar al menos un artículo')
      return
    }

    setGuardando(true)

    try {
      let clienteFinal: ClienteRecord | null = clienteSeleccionado

      // Crear cliente si es nuevo
      if (crearNuevoCliente) {
        const clienteResponse = await apiService.buscarOCrearCliente({
          nombre: nuevoCliente.nombre,
          dni_cuit: nuevoCliente.dni_cuit || undefined,
          telefono: nuevoCliente.telefono || undefined,
          email: nuevoCliente.email || undefined,
          direccion: nuevoCliente.direccion || undefined
        })

        if (!clienteResponse.success || !clienteResponse.data) {
          throw new Error(clienteResponse.error || 'Error al crear cliente')
        }

        clienteFinal = clienteResponse.data
      }

      // Preparar items para la API
      const itemsParaAPI = itemsPresupuesto.map(item => ({
        id_articulo_stock: item.id_articulo_stock,
        codigo_articulo: item.codigo_articulo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento || 0,
        precio_total: item.precio_total,
        observaciones: item.observaciones
      }))

      // Crear presupuesto
      const presupuestoResponse = await apiService.crearPresupuestoVenta({
        id_cliente: clienteFinal?.id || null,
        cliente_nombre: clienteFinal?.nombre || nuevoCliente.nombre,
        cliente_telefono: clienteFinal?.telefono || nuevoCliente.telefono,
        cliente_email: clienteFinal?.email || nuevoCliente.email,
        cliente_dni_cuit: clienteFinal?.dni_cuit || nuevoCliente.dni_cuit,
        cliente_empresa: clienteFinal?.empresa || nuevoCliente.empresa,
        cliente_direccion: clienteFinal?.direccion || nuevoCliente.direccion,
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

      limpiarVentasPresupuestoDraft()
      setPresupuestoCreado(presupuestoResponse.data)
      onSuccess()
    } catch (error: any) {
      console.error('Error creando presupuesto:', error)
      alert(`Error al crear presupuesto: ${error.message || 'Error desconocido'}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (presupuestoCreado) return
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (presupuestoCreado) return
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-content venta-rapida-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📄 Crear Presupuesto de Venta</h2>
          {tipoListaPrecio ? (
            <p className="venta-rapida-lista-badge">{labelListaPrecio(tipoListaPrecio)}</p>
          ) : null}
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {presupuestoCreado ? (
          <div className="modal-body">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
              <h3 style={{ color: '#10b981', marginBottom: '10px' }}>
                Presupuesto creado exitosamente
              </h3>
              <p style={{ fontSize: '1.1rem', marginBottom: '20px', color: 'var(--text-primary)' }}>
                Número: <strong>{presupuestoCreado.numero_presupuesto}</strong>
              </p>
              <p style={{ fontSize: '1rem', marginBottom: '30px', color: 'var(--text-secondary)' }}>
                Estado: <strong>{presupuestoCreado.estado}</strong>
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={onClose}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            {/* Cliente */}
            <div className="form-section">
              <h3>👤 Cliente</h3>
              <div className="form-group">
                <label>Buscar Cliente</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    placeholder="Buscar por nombre, DNI, teléfono..."
                    disabled={crearNuevoCliente}
                  />
                  {buscandoClientes && (
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      🔍
                    </span>
                  )}
                </div>
                {clientesEncontrados.length > 0 && !crearNuevoCliente && (
                  <div className="dropdown-results">
                    {clientesEncontrados.map((cliente) => (
                      <div
                        key={cliente.id}
                        className="dropdown-item"
                        onClick={() => seleccionarCliente(cliente)}
                      >
                        <strong>{cliente.nombre}</strong>
                        {cliente.dni_cuit && <div className="dropdown-subtext">DNI/CUIT: {cliente.dni_cuit}</div>}
                        {cliente.telefono && <div className="dropdown-subtext">Tel: {cliente.telefono}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!clienteSeleccionado && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={crearNuevoCliente}
                      onChange={(e) => setCrearNuevoCliente(e.target.checked)}
                    />
                    {' '}Crear nuevo cliente
                  </label>
                </div>
              )}

              {crearNuevoCliente && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      type="text"
                      value={nuevoCliente.nombre}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="form-group">
                    <label>DNI/CUIT</label>
                    <input
                      type="text"
                      value={nuevoCliente.dni_cuit}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, dni_cuit: e.target.value })}
                      placeholder="DNI/CUIT"
                    />
                  </div>
                </div>
              )}

              {clienteSeleccionado && (
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginTop: '8px' }}>
                  ✓ Cliente seleccionado: <strong>{clienteSeleccionado.nombre}</strong>
                  {clienteSeleccionado.telefono && <div>Tel: {clienteSeleccionado.telefono}</div>}
                  {clienteSeleccionado.email && <div>Email: {clienteSeleccionado.email}</div>}
                </div>
              )}
            </div>

            {/* Artículos */}
            <div className="form-section">
              <h3>📦 Artículos</h3>
              <div className="form-group">
                <label>Buscar Artículo</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={busquedaArticulo}
                    onChange={(e) => setBusquedaArticulo(e.target.value)}
                    placeholder="Buscar por código o descripción..."
                  />
                  {buscandoArticulos && (
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      🔍
                    </span>
                  )}
                </div>
                {articulosEncontrados.length > 0 && (
                  <div className="dropdown-results">
                    {articulosEncontrados.map((articulo) => (
                      <div
                        key={articulo.id}
                        className="dropdown-item"
                        onClick={() => agregarArticulo(articulo)}
                      >
                        <strong>{articulo.descripcion}</strong>
                        {articulo.codigo && <div className="dropdown-subtext">Código: {articulo.codigo}</div>}
                        <div className="dropdown-subtext">
                          Precio: ${articulo.precio?.toLocaleString() || '0'} | 
                          Stock: {articulo.stock !== null ? articulo.stock : 'N/A'} {articulo.unidad || 'unidades'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {itemsPresupuesto.length > 0 && (
                <div className="items-list">
                  {itemsPresupuesto.map((item, index) => (
                    <div key={index} className="item-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{item.descripcion}</strong>
                          {item.codigo_articulo && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              Código: {item.codigo_articulo}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn-icon"
                          onClick={() => eliminarItem(index)}
                          style={{ marginLeft: '12px' }}
                        >
                          🗑️
                        </button>
                      </div>
                      <div className="form-row" style={{ gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cantidad</label>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.cantidad}
                            onChange={(e) => actualizarItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precio Unit.</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(e) => actualizarItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Descuento</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.descuento}
                            onChange={(e) => actualizarItem(index, 'descuento', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        Subtotal: ${item.precio_total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                  Total: ${calcularTotal().toFixed(2)}
                </strong>
              </div>
            </div>

            {/* Información adicional */}
            <div className="form-section">
              <h3>📋 Información Adicional</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as 'borrador' | 'enviado')}
                  >
                    <option value="borrador">Borrador</option>
                    <option value="enviado">Enviado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones Cliente</label>
                <textarea
                  value={observacionesCliente}
                  onChange={(e) => setObservacionesCliente(e.target.value)}
                  placeholder="Observaciones visibles para el cliente..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Observaciones Internas</label>
                <textarea
                  value={observacionesInternas}
                  onChange={(e) => setObservacionesInternas(e.target.value)}
                  placeholder="Observaciones solo para uso interno..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {!presupuestoCreado && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleGuardarPresupuesto}
              disabled={guardando || itemsPresupuesto.length === 0}
            >
              {guardando ? 'Guardando...' : 'Crear Presupuesto'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CrearPresupuestoModal

