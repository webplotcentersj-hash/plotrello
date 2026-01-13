import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { ClienteRecord, Venta } from '../types/api'
import type { ArticuloStock } from '../types/pedidos'
import './VentaRapidaModal.css'

interface VentaRapidaModalProps {
  onClose: () => void
  onSuccess: () => void
  usuarioId: number
  usuarioNombre: string
}

interface ItemVenta {
  id_articulo_stock?: number
  codigo_articulo?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  observaciones?: string
}

const VentaRapidaModal = ({ onClose, onSuccess, usuarioId, usuarioNombre }: VentaRapidaModalProps) => {
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
    direccion: ''
  })

  const [condicionVenta, setCondicionVenta] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'>('Efectivo')
  const [esCuentaCorriente, setEsCuentaCorriente] = useState(false)
  const [fechaVenta, setFechaVenta] = useState(new Date().toISOString().split('T')[0])
  const [prioridad, setPrioridad] = useState<'Baja' | 'Normal' | 'Alta' | 'Urgente'>('Normal')
  const [observaciones, setObservaciones] = useState('')

  const [busquedaArticulo, setBusquedaArticulo] = useState('')
  const [articulosEncontrados, setArticulosEncontrados] = useState<ArticuloStock[]>([])
  const [buscandoArticulos, setBuscandoArticulos] = useState(false)
  const [itemsVenta, setItemsVenta] = useState<ItemVenta[]>([])

  const [guardando, setGuardando] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<Venta | null>(null)

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
  }

  const agregarArticulo = (articulo: ArticuloStock) => {
    if (itemsVenta.some(item => item.id_articulo_stock === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    const nuevoItem: ItemVenta = {
      id_articulo_stock: articulo.id,
      codigo_articulo: articulo.codigo || undefined,
      descripcion: articulo.descripcion,
      cantidad: 1,
      precio_unitario: articulo.precio || 0,
      descuento: 0,
      observaciones: articulo.stock !== null && articulo.stock <= 0 ? 'Stock agotado' : undefined
    }

    setItemsVenta([...itemsVenta, nuevoItem])
    setBusquedaArticulo('')
    setArticulosEncontrados([])
  }

  const eliminarItem = (index: number) => {
    setItemsVenta(itemsVenta.filter((_, i) => i !== index))
  }

  const actualizarItem = (index: number, campo: keyof ItemVenta, valor: any) => {
    const nuevosItems = [...itemsVenta]
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor }
    setItemsVenta(nuevosItems)
  }

  const calcularSubtotal = () => {
    return itemsVenta.reduce((sum, item) => {
      return sum + (item.precio_unitario * item.cantidad - item.descuento)
    }, 0)
  }

  const handleGuardarVenta = async () => {
    if (!clienteSeleccionado && !crearNuevoCliente) {
      alert('Debes seleccionar o crear un cliente')
      return
    }

    if (crearNuevoCliente && !nuevoCliente.nombre.trim()) {
      alert('El nombre del cliente es obligatorio')
      return
    }

    if (itemsVenta.length === 0) {
      alert('Debes agregar al menos un artículo')
      return
    }

    if (esCuentaCorriente && condicionVenta !== 'Cuenta Corriente') {
      alert('Si marcas Cuenta Corriente, la condición de venta debe ser "Cuenta Corriente"')
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

      if (!clienteFinal) {
        throw new Error('No se pudo obtener el cliente')
      }

      // Calcular total
      const valorTotal = calcularSubtotal()

      // Crear venta directamente (sin oportunidad ni OP)
      const ventaResponse = await apiService.crearVentaDirecta({
        cliente_nombre: clienteFinal.nombre,
        cliente_telefono: clienteFinal.telefono || undefined,
        cliente_email: clienteFinal.email || undefined,
        cliente_dni_cuit: clienteFinal.dni_cuit || undefined,
        cliente_empresa: clienteFinal.empresa || undefined,
        cliente_direccion: clienteFinal.direccion || undefined,
        valor_total: valorTotal,
        metodo_pago: condicionVenta,
        estado_pago: esCuentaCorriente ? 'Pendiente' : 'Pagado',
        fecha_venta: fechaVenta,
        id_vendedor: usuarioId,
        nombre_vendedor: usuarioNombre,
        observaciones: observaciones ? `Prioridad: ${prioridad}. ${observaciones}` : `Prioridad: ${prioridad}`
      })

      if (!ventaResponse.success || !ventaResponse.data) {
        throw new Error(ventaResponse.error || 'Error al crear venta')
      }

      // Agregar items a la venta
      for (const item of itemsVenta) {
        await apiService.agregarItemVenta({
          id_venta: ventaResponse.data.id,
          id_articulo_stock: item.id_articulo_stock,
          codigo_articulo: item.codigo_articulo,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento,
          observaciones: item.observaciones
        })
      }

      // Obtener la venta completa
      if (ventaResponse.data) {
        const ventasResponse = await apiService.obtenerVentas()
        if (ventasResponse.success && ventasResponse.data) {
          const ventaCompleta = ventasResponse.data.find(v => v.id === ventaResponse.data!.id)
          if (ventaCompleta) {
            setVentaCreada(ventaCompleta)
          }
        }
      }

      alert(`Venta creada exitosamente: ${ventaResponse.data.numero_venta}`)
    } catch (error: any) {
      console.error('Error guardando venta:', error)
      alert('Error al guardar venta: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleConvertirAOP = async () => {
    if (!ventaCreada) {
      alert('No hay una venta creada para convertir')
      return
    }

    if (!clienteSeleccionado && !crearNuevoCliente) {
      alert('Debes tener un cliente seleccionado')
      return
    }

    let clienteFinal: ClienteRecord | null = clienteSeleccionado

    // Si se creó un nuevo cliente, buscarlo
    if (crearNuevoCliente && nuevoCliente.nombre) {
      const clienteResponse = await apiService.buscarOCrearCliente({
        nombre: nuevoCliente.nombre,
        dni_cuit: nuevoCliente.dni_cuit || undefined,
        telefono: nuevoCliente.telefono || undefined,
        email: nuevoCliente.email || undefined,
        direccion: nuevoCliente.direccion || undefined
      })

      if (clienteResponse.success && clienteResponse.data) {
        clienteFinal = clienteResponse.data
      }
    }

    if (!clienteFinal) {
      alert('Error: No se pudo obtener el cliente')
      return
    }

    try {
      // Construir descripción con items de la venta
      let descripcion = `Venta: ${ventaCreada.numero_venta}\n`
      descripcion += `Cliente: ${clienteFinal.nombre}\n`
      descripcion += `Condición: ${condicionVenta}\n`
      descripcion += `Prioridad: ${prioridad}\n\n`
      descripcion += 'Items:\n'
      
      if (ventaCreada.items) {
        ventaCreada.items.forEach((item, index) => {
          descripcion += `${index + 1}. ${item.descripcion} - Cantidad: ${item.cantidad} - Precio: $${item.precio_unitario}\n`
        })
      }

      if (observaciones) {
        descripcion += `\nObservaciones: ${observaciones}`
      }

      // Crear la OP
      const ordenResponse = await apiService.createOrden({
        cliente: clienteFinal.nombre,
        dni_cuit: clienteFinal.dni_cuit || undefined,
        descripcion: descripcion,
        estado: 'Diseño Gráfico',
        prioridad: prioridad,
        fecha_entrega: fechaVenta,
        sector: 'Diseño Gráfico',
        sector_inicial: 'Diseño Gráfico',
        nombre_creador: usuarioNombre,
        telefono_cliente: clienteFinal.telefono || undefined,
        email_cliente: clienteFinal.email || undefined,
        direccion_cliente: clienteFinal.direccion || undefined
      })

      if (!ordenResponse.success || !ordenResponse.data) {
        throw new Error(ordenResponse.error || 'Error al crear OP')
      }

      // Actualizar la venta con el ID de la OP
      await apiService.actualizarVenta(ventaCreada.id, {
        id_op: ordenResponse.data.id,
        numero_op: ordenResponse.data.numero_op
      })

      alert(`Venta convertida a OP exitosamente: ${ordenResponse.data.numero_op}`)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error convirtiendo a OP:', error)
      alert('Error al convertir a OP: ' + error.message)
    }
  }

  return (
    <div className="venta-rapida-modal-overlay" onClick={onClose}>
      <div className="venta-rapida-modal" onClick={(e) => e.stopPropagation()}>
        <div className="venta-rapida-modal-header">
          <h2>💰 Venta Rápida</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="venta-rapida-modal-content">
          {/* Información del vendedor */}
          <div className="form-group">
            <label>Vendedor</label>
            <input
              type="text"
              value={usuarioNombre}
              disabled
              className="form-input"
            />
          </div>

          {/* Buscador de Cliente */}
          <div className="form-group">
            <label>Cliente *</label>
            <div className="cliente-search-container">
              <input
                type="text"
                className="form-input"
                placeholder="Buscar cliente..."
                value={busquedaCliente}
                onChange={(e) => {
                  setBusquedaCliente(e.target.value)
                  setClienteSeleccionado(null)
                  setCrearNuevoCliente(false)
                }}
                disabled={crearNuevoCliente}
              />
              {buscandoClientes && <span className="loading-spinner">⏳</span>}
              
              {clientesEncontrados.length > 0 && !crearNuevoCliente && (
                <div className="dropdown-results">
                  {clientesEncontrados.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="dropdown-item"
                      onClick={() => seleccionarCliente(cliente)}
                    >
                      <strong>{cliente.nombre}</strong>
                      {cliente.telefono && <span className="dropdown-subtext">📞 {cliente.telefono}</span>}
                      {cliente.email && <span className="dropdown-subtext">✉️ {cliente.email}</span>}
                    </div>
                  ))}
                </div>
              )}

              {!clienteSeleccionado && !crearNuevoCliente && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCrearNuevoCliente(true)
                    setClientesEncontrados([])
                    setBusquedaCliente('')
                  }}
                  style={{ marginTop: '8px' }}
                >
                  ➕ Crear Nuevo Cliente
                </button>
              )}
            </div>

            {/* Formulario para nuevo cliente */}
            {crearNuevoCliente && (
              <div className="nuevo-cliente-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nombre *"
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
                  placeholder="Dirección"
                  value={nuevoCliente.direccion}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                />
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCrearNuevoCliente(false)
                    setNuevoCliente({ nombre: '', dni_cuit: '', telefono: '', email: '', direccion: '' })
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}

            {clienteSeleccionado && (
              <div className="cliente-seleccionado">
                <strong>✓ {clienteSeleccionado.nombre}</strong>
                <button
                  className="btn-link"
                  onClick={() => {
                    setClienteSeleccionado(null)
                    setBusquedaCliente('')
                  }}
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Condición de Venta */}
          <div className="form-group">
            <label>Condición de Venta *</label>
            <select
              className="form-select"
              value={condicionVenta}
              onChange={(e) => {
                const valor = e.target.value as typeof condicionVenta
                setCondicionVenta(valor)
                if (valor === 'Cuenta Corriente') {
                  setEsCuentaCorriente(true)
                }
              }}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Cheque">Cheque</option>
              <option value="Cuenta Corriente">Cuenta Corriente</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          {/* Checkbox Cuenta Corriente */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={esCuentaCorriente}
                onChange={(e) => {
                  setEsCuentaCorriente(e.target.checked)
                  if (e.target.checked) {
                    setCondicionVenta('Cuenta Corriente')
                  }
                }}
              />
              <span>Es Cuenta Corriente</span>
            </label>
          </div>

          {/* Fecha */}
          <div className="form-group">
            <label>Fecha *</label>
            <input
              type="date"
              className="form-input"
              value={fechaVenta}
              onChange={(e) => setFechaVenta(e.target.value)}
            />
          </div>

          {/* Prioridad */}
          <div className="form-group">
            <label>Prioridad *</label>
            <select
              className="form-select"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as typeof prioridad)}
            >
              <option value="Baja">Baja</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          {/* Búsqueda de Artículos */}
          <div className="form-group">
            <label>Buscar Artículo</label>
            <div className="articulo-search-container">
              <input
                type="text"
                className="form-input"
                placeholder="Buscar por código o descripción..."
                value={busquedaArticulo}
                onChange={(e) => setBusquedaArticulo(e.target.value)}
              />
              {buscandoArticulos && <span className="loading-spinner">⏳</span>}
              
              {articulosEncontrados.length > 0 && (
                <div className="dropdown-results">
                  {articulosEncontrados.map((articulo) => (
                    <div
                      key={articulo.id}
                      className="dropdown-item"
                      onClick={() => agregarArticulo(articulo)}
                    >
                      <strong>{articulo.descripcion}</strong>
                      {articulo.codigo && <span className="dropdown-subtext">Código: {articulo.codigo}</span>}
                      <span className="dropdown-subtext">Precio: ${articulo.precio || 0}</span>
                      {articulo.stock !== null && (
                        <span className={`dropdown-subtext ${articulo.stock <= 0 ? 'stock-agotado' : ''}`}>
                          Stock: {articulo.stock}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lista de Items */}
          {itemsVenta.length > 0 && (
            <div className="items-venta-section">
              <h3>Items de Venta</h3>
              <div className="items-list">
                {itemsVenta.map((item, index) => (
                  <div key={index} className="item-card">
                    <div className="item-header">
                      <strong>{item.descripcion}</strong>
                      <button
                        className="btn-remove"
                        onClick={() => eliminarItem(index)}
                      >
                        ✕
                      </button>
                    </div>
                    {item.codigo_articulo && (
                      <div className="item-info">Código: {item.codigo_articulo}</div>
                    )}
                    <div className="item-controls">
                      <div className="item-control">
                        <label>Cantidad</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          className="form-input-small"
                          value={item.cantidad}
                          onChange={(e) => actualizarItem(index, 'cantidad', parseFloat(e.target.value) || 1)}
                        />
                      </div>
                      <div className="item-control">
                        <label>Precio Unit.</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input-small"
                          value={item.precio_unitario}
                          onChange={(e) => actualizarItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="item-control">
                        <label>Descuento</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input-small"
                          value={item.descuento}
                          onChange={(e) => actualizarItem(index, 'descuento', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="item-subtotal">
                        <strong>Subtotal: ${((item.precio_unitario * item.cantidad) - item.descuento).toFixed(2)}</strong>
                      </div>
                    </div>
                    {item.observaciones && (
                      <div className="item-warning">⚠️ {item.observaciones}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales */}
          {itemsVenta.length > 0 && (
            <div className="totales-section">
              <div className="total-line">
                <span>Subtotal:</span>
                <span>${calcularSubtotal().toFixed(2)}</span>
              </div>
              <div className="total-line total-final">
                <span><strong>Total:</strong></span>
                <span><strong>${calcularSubtotal().toFixed(2)}</strong></span>
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div className="form-group">
            <label>Observaciones</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales..."
            />
          </div>

          {/* Número de Venta (si ya se creó) */}
          {ventaCreada && (
            <div className="venta-creada-info">
              <div className="success-message">
                ✓ Venta creada: <strong>{ventaCreada.numero_venta}</strong>
              </div>
              <button
                className="btn-primary"
                onClick={handleConvertirAOP}
              >
                📋 Convertir a OP
              </button>
            </div>
          )}
        </div>

        <div className="venta-rapida-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleGuardarVenta}
            disabled={guardando || itemsVenta.length === 0}
          >
            {guardando ? 'Guardando...' : '💾 Guardar Venta'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VentaRapidaModal

