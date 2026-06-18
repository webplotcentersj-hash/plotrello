import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord, ClienteRecord, Venta } from '../types/api'
import { generarFacturaRemitoPDF, generarPagarePDF } from '../utils/crmExportUtils'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import { CLIENTES_CUENTA_CORRIENTE, clientesCcPerfil } from '../utils/clientesRoutes'
import { getArgentinaDateString } from '../utils/dateUtils'
import {
  labelListaPrecio,
  labelAjustesPreciosActivos,
  resolvePrecioLista,
  type TipoListaPrecioVentas
} from '../constants/ventasListasPrecio'
import { useConfigAjustesPreciosVentas } from '../hooks/useConfigAjustesPreciosVentas'
import CuentaCorrienteScoreBadge from './CuentaCorrienteScoreBadge'
import {
  formatLimiteCredito,
  requiereAlertaScoring,
  type CcScoreNivel
} from '../constants/cuentaCorrienteScoring'
import './VentaRapidaModal.css'

interface VentaRapidaModalProps {
  onClose: () => void
  onSuccess: () => void
  usuarioId: number
  usuarioNombre: string
  /** Tema de formularios (p. ej. desplegables claros en dashboard mostrador) */
  uiVariant?: 'default' | 'mostrador'
}

interface ItemVenta {
  id_articulo_empresa?: number
  id_articulo_stock?: number
  codigo_articulo?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  precio_lista?: TipoListaPrecioVentas
  observaciones?: string
}

function listaFromCondicion(
  condicion: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'
): TipoListaPrecioVentas {
  return condicion === 'Cuenta Corriente' ? 'lista_2' : 'lista_1'
}

function formatArs(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const VentaRapidaModal = ({
  onClose,
  onSuccess,
  usuarioId,
  usuarioNombre,
  uiVariant = 'default'
}: VentaRapidaModalProps) => {
  const navigate = useNavigate()
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
    direccion: ''
  })

  const [condicionVenta, setCondicionVenta] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'>('Efectivo')
  const [esCuentaCorriente, setEsCuentaCorriente] = useState(false)
  const [clienteCcHabilitado, setClienteCcHabilitado] = useState<boolean | null>(null)
  const [validandoCc, setValidandoCc] = useState(false)
  const [clienteCcScoring, setClienteCcScoring] = useState<{
    score: number | null
    score_nivel: string | null
    limite_credito: number | null
    limite_credito_sugerido: number | null
  } | null>(null)
  const [fechaVenta, setFechaVenta] = useState(() => getArgentinaDateString())
  const [prioridad, setPrioridad] = useState<'Baja' | 'Normal' | 'Alta' | 'Urgente'>('Normal')
  const [observaciones, setObservaciones] = useState('')

  const [busquedaArticulo, setBusquedaArticulo] = useState('')
  const [categoriaArticulo, setCategoriaArticulo] = useState('todas')
  const [catalogoArticulos, setCatalogoArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(false)
  const [itemsVenta, setItemsVenta] = useState<ItemVenta[]>([])

  const tipoListaPrecio = useMemo(() => listaFromCondicion(condicionVenta), [condicionVenta])

  const [guardando, setGuardando] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<Venta | null>(null)
  const [showCartelVentaRealizada, setShowCartelVentaRealizada] = useState(false)
  const [cartelAceptarEnabled, setCartelAceptarEnabled] = useState(false)
  const [comprobanteArchivo, setComprobanteArchivo] = useState<File | null>(null)
  const comprobanteInputRef = useRef<HTMLInputElement>(null)
  const convertirRef = useRef<HTMLDivElement>(null)

  // Habilitar "Aceptar" del cartel después de 2.5 s para que se lea "Venta realizada"
  useEffect(() => {
    if (!showCartelVentaRealizada) {
      setCartelAceptarEnabled(false)
      return
    }
    const t = setTimeout(() => setCartelAceptarEnabled(true), 2500)
    return () => clearTimeout(t)
  }, [showCartelVentaRealizada])

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
      if (!q) return true
      const tokens = q.split(/\s+/).filter(Boolean)
      const haystack = [a.nombre, a.codigo, a.descripcion, a.categoria]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return tokens.every((t) => haystack.includes(t))
    })
  }, [catalogoArticulos, busquedaArticulo, categoriaArticulo])

  useEffect(() => {
    if (itemsVenta.length === 0 || catalogoArticulos.length === 0) return
    const lista = tipoListaPrecio
    setItemsVenta((prev) =>
      prev.map((item) => {
        if (!item.id_articulo_empresa) return item
        const art = catalogoArticulos.find((a) => a.id === item.id_articulo_empresa)
        if (!art) return item
        const precio = resolvePrecioLista(art, lista, ajustesPrecios)
        if (precio == null) return item
        return { ...item, precio_unitario: precio, precio_lista: lista }
      })
    )
  }, [tipoListaPrecio, catalogoArticulos, ajustesPrecios])

  const seleccionarCliente = (cliente: ClienteRecord) => {
    setClienteSeleccionado(cliente)
    setBusquedaCliente(nombreCompletoCliente(cliente))
    setClientesEncontrados([])
    setCrearNuevoCliente(false)
    setClienteCcHabilitado(null)
    setClienteCcScoring(null)
  }

  useEffect(() => {
    if (!esCuentaCorriente || !clienteSeleccionado?.id) {
      setClienteCcHabilitado(null)
      setClienteCcScoring(null)
      return
    }
    let cancelled = false
    const run = async () => {
      setValidandoCc(true)
      const [habRes, scoreRes] = await Promise.all([
        apiService.clienteHabilitadoCuentaCorriente(clienteSeleccionado.id),
        apiService.getScoringResumenCuentaCorriente(clienteSeleccionado.id)
      ])
      if (!cancelled) {
        setClienteCcHabilitado(habRes.success ? !!habRes.data : false)
        setClienteCcScoring(scoreRes.success ? scoreRes.data ?? null : null)
        setValidandoCc(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [esCuentaCorriente, clienteSeleccionado?.id])

  const agregarArticulo = (articulo: ArticuloEmpresaRecord) => {
    if (itemsVenta.some((item) => item.id_articulo_empresa === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    const precio = resolvePrecioLista(articulo, tipoListaPrecio, ajustesPrecios)
    if (precio == null) {
      alert(`Este artículo no tiene precio en ${labelListaPrecio(tipoListaPrecio)}.`)
      return
    }

    const stock = articulo.stock_disponible
    const nuevoItem: ItemVenta = {
      id_articulo_empresa: articulo.id,
      id_articulo_stock: articulo.id_articulo_stock ?? undefined,
      codigo_articulo: articulo.codigo || undefined,
      descripcion: articulo.nombre,
      cantidad: 1,
      precio_unitario: precio,
      precio_lista: tipoListaPrecio,
      descuento: 0,
      observaciones:
        stock != null && stock <= 0 && articulo.controla_stock !== false
          ? 'Stock agotado'
          : undefined
    }

    setItemsVenta([...itemsVenta, nuevoItem])
    setBusquedaArticulo('')
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

      if (esCuentaCorriente) {
        const ccRes = await apiService.clienteHabilitadoCuentaCorriente(clienteFinal.id)
        if (!ccRes.success || !ccRes.data) {
          alert(
            'Este cliente no está habilitado para cuenta corriente. Completá el alta con CUIT, razón social, condición IVA, contacto, domicilio y documentación en Mostrador → Cuenta corriente.'
          )
          setGuardando(false)
          return
        }
      }

      // Calcular total
      const valorTotal = calcularSubtotal()

      // Crear venta directamente (sin oportunidad ni OP)
      // Usar id_cliente si el cliente existe en la base de datos
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
        id_cliente: clienteFinal.id || undefined, // Asociar con cliente de la tabla clientes
        observaciones: observaciones ? `Prioridad: ${prioridad}. ${observaciones}` : `Prioridad: ${prioridad}`
      })

      if (!ventaResponse.success || !ventaResponse.data) {
        throw new Error(ventaResponse.error || 'Error al crear venta')
      }

      if (esCuentaCorriente && clienteFinal.id) {
        void apiService.calcularScoringCuentaCorriente(clienteFinal.id, usuarioId)
      }

      const ventaData = ventaResponse.data

      // Mostrar de inmediato "Venta realizada" y el cartel (no depender de obtenerVentas)
      const ahora = new Date().toISOString()
      const ventaMinima: Venta = {
        id: ventaData.id,
        numero_venta: ventaData.numero_venta,
        id_op: 0,
        numero_op: '',
        cliente_nombre: clienteFinal.nombre,
        valor_total: calcularSubtotal(),
        fecha_venta: fechaVenta,
        estado_pago: esCuentaCorriente ? 'Pendiente' : 'Pagado',
        metodo_pago: condicionVenta,
        id_vendedor: usuarioId,
        nombre_vendedor: usuarioNombre,
        created_at: ahora,
        updated_at: ahora,
        items: itemsVenta.map(item => ({
          id: 0,
          id_venta: ventaData.id,
          id_articulo_stock: item.id_articulo_stock ?? undefined,
          codigo_articulo: item.codigo_articulo ?? undefined,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          precio_total: item.cantidad * item.precio_unitario - (item.descuento || 0),
          descuento: item.descuento ?? undefined,
          observaciones: item.observaciones ?? undefined,
          created_at: ahora
        }))
      }
      setVentaCreada(ventaMinima)
      setShowCartelVentaRealizada(true)
      setCartelAceptarEnabled(false)

      // Agregar items a la venta (el stock se descuenta automáticamente en agregarItemVenta)
      for (const item of itemsVenta) {
        try {
          const itemResponse = await apiService.agregarItemVenta({
            id_venta: ventaData.id,
            id_articulo_stock: item.id_articulo_stock,
            codigo_articulo: item.codigo_articulo,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento: item.descuento,
            observaciones: item.observaciones
          })

          if (!itemResponse.success) {
            console.error('Error agregando item:', itemResponse.error)
            throw new Error(`Error agregando item: ${itemResponse.error}`)
          }
        } catch (itemError) {
          console.error('Error procesando item:', itemError)
          throw itemError // Re-lanzar para que se muestre el error al usuario
        }
      }

      if (comprobanteArchivo) {
        const compResp = await apiService.subirComprobantePagoVenta(ventaData.id, comprobanteArchivo)
        if (!compResp.success) {
          alert(
            `La venta se guardó, pero no se pudo adjuntar el comprobante: ${compResp.error || 'Error desconocido'}`
          )
        } else if (compResp.data?.url) {
          setVentaCreada((prev) =>
            prev ? { ...prev, comprobante_pago_url: compResp.data!.url } : prev
          )
        }
        setComprobanteArchivo(null)
        if (comprobanteInputRef.current) comprobanteInputRef.current.value = ''
      }

      // Opcional: actualizar con la venta completa desde el servidor (no bloquea la UI)
      try {
        const ventasResponse = await apiService.obtenerVentas()
        if (ventasResponse.success && ventasResponse.data) {
          const ventaCompleta = ventasResponse.data.find(v => v.id === ventaData.id)
          if (ventaCompleta) setVentaCreada(ventaCompleta)
        }
      } catch (e) {
        console.error('Error obteniendo venta completa:', e)
      }

      // Disparar evento personalizado para que el CRM se actualice si está abierto
      window.dispatchEvent(new CustomEvent('venta-creada', { 
        detail: { 
          ventaId: ventaData.id, 
          numeroVenta: ventaData.numero_venta 
        }
      }))
      
      try {
        if (onSuccess) onSuccess()
      } catch (e) {
        console.error('Error en onSuccess:', e)
      }
      
      // NO cerrar el modal - permitir convertir a OP desde aquí
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

    setGuardando(true)
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

      // Crear la OP usando el número de venta como número de OP
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
        direccion_cliente: clienteFinal.direccion || undefined,
        numero_op: ventaCreada.numero_venta // Usar el número de venta como número de OP
      })

      if (!ordenResponse.success || !ordenResponse.data) {
        throw new Error(ordenResponse.error || 'Error al crear OP')
      }

      // Actualizar la venta con el ID de la OP
      await apiService.actualizarVenta(ventaCreada.id, {
        id_op: ordenResponse.data.id,
        numero_op: ordenResponse.data.numero_op
      })

      // Actualizar la venta creada con la información de la OP
      const ventasResponse = await apiService.obtenerVentas()
      if (ventasResponse.success && ventasResponse.data) {
        const ventaActualizada = ventasResponse.data.find(v => v.id === ventaCreada.id)
        if (ventaActualizada) {
          setVentaCreada(ventaActualizada)
        }
      }

      alert(`Venta convertida a OP exitosamente: ${ordenResponse.data.numero_op}`)
      
      // Llamar a onSuccess para recargar datos
      if (onSuccess) {
        onSuccess()
      }
      
      // NO cerrar el modal - permitir al usuario ver el resultado
    } catch (error: any) {
      console.error('Error convirtiendo a OP:', error)
      alert('Error al convertir a OP: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="venta-rapida-modal-overlay"
      onMouseDown={(e) => {
        if (ventaCreada) return
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (ventaCreada) return
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`venta-rapida-modal${uiVariant === 'mostrador' ? ' venta-rapida-modal--mostrador' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cartel VENTA REALIZADA al generar la venta */}
        {showCartelVentaRealizada && (
          <div className="venta-realizada-cartel">
            <div className="venta-realizada-cartel-box">
              <p className="venta-realizada-cartel-texto">VENTA REALIZADA</p>
              {!cartelAceptarEnabled && (
                <p className="venta-realizada-cartel-hint">Podés cerrar en unos segundos...</p>
              )}
              <button
                type="button"
                className="btn-primary venta-realizada-cartel-btn"
                onClick={() => {
                  setShowCartelVentaRealizada(false)
                  setTimeout(() => {
                    convertirRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 100)
                }}
                disabled={!cartelAceptarEnabled}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
        <div className="venta-rapida-modal-header">
          <h2>{ventaCreada ? '✅ Venta realizada' : '💰 Venta Rápida'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {ventaCreada && (
          <div className="venta-realizada-banner">
            Venta realizada — Nº {ventaCreada.numero_venta}
            {ventaCreada.numero_op && ` • OP: ${ventaCreada.numero_op}`}
          </div>
        )}

        {/* En el mismo modal: opción de convertir a OP (visible sin scroll) */}
        {ventaCreada && (
          <div className="venta-realizada-convertir" ref={convertirRef}>
            {ventaCreada.numero_op ? (
              <p className="venta-realizada-convertir-ok">✓ Convertida a OP: <strong>{ventaCreada.numero_op}</strong></p>
            ) : (
              <button
                type="button"
                className="btn-primary btn-convertir-op-modal"
                onClick={handleConvertirAOP}
                disabled={guardando}
              >
                {guardando ? 'Convirtiendo...' : '📋 Convertirla a OP'}
              </button>
            )}
          </div>
        )}

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
          <div className="form-group form-group--cliente">
            <div className="form-group-label-row">
              <label>Cliente *</label>
              {!clienteSeleccionado && !crearNuevoCliente && (
                <button
                  type="button"
                  className="btn-link btn-link-inline"
                  onClick={() => {
                    setCrearNuevoCliente(true)
                    setClientesEncontrados([])
                    setBusquedaCliente('')
                  }}
                >
                  ➕ Crear nuevo
                </button>
              )}
            </div>
            {!crearNuevoCliente && (
              <div className={`cliente-search-container${clienteSeleccionado ? ' cliente-search-container--selected' : ''}`}>
                <input
                  type="text"
                  className="form-input form-input--search"
                  placeholder="Nombre, apellido, DNI, teléfono o empresa…"
                  value={busquedaCliente}
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value)
                    setClienteSeleccionado(null)
                  }}
                  readOnly={!!clienteSeleccionado}
                  autoComplete="off"
                  spellCheck={false}
                />
                {buscandoClientes && !clienteSeleccionado && (
                  <span className="loading-spinner" aria-hidden>⏳</span>
                )}

                {clientesEncontrados.length > 0 && !clienteSeleccionado && (
                  <div className="dropdown-results dropdown-results--cliente">
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
                <div className="cliente-seleccionado__texto">
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
                  } else {
                    setClienteCcHabilitado(null)
                  }
                }}
              />
              <span>Es Cuenta Corriente</span>
            </label>
            {esCuentaCorriente && clienteSeleccionado && (
              <div
                className={`venta-cc-hint${clienteCcHabilitado === false ? ' venta-cc-hint--error' : ''}${clienteCcHabilitado === true ? ' venta-cc-hint--ok' : ''}`}
              >
                {validandoCc ? (
                  <span>Verificando habilitación en cuenta corriente…</span>
                ) : clienteCcHabilitado === true ? (
                  <div className="venta-cc-scoring">
                    <span>✓ Cliente habilitado para cuenta corriente</span>
                    {clienteCcScoring?.score != null && (
                      <div className="venta-cc-scoring__row">
                        <CuentaCorrienteScoreBadge
                          score={clienteCcScoring.score}
                          nivel={clienteCcScoring.score_nivel as CcScoreNivel | undefined}
                          compact
                        />
                        <span className="venta-cc-scoring__limite">
                          Límite:{' '}
                          {formatLimiteCredito(
                            clienteCcScoring.limite_credito ??
                              clienteCcScoring.limite_credito_sugerido
                          )}
                        </span>
                        <button
                          type="button"
                          className="btn-link venta-cc-hint__link"
                          onClick={() => {
                            onClose()
                            navigate(clientesCcPerfil(clienteSeleccionado!.id))
                          }}
                        >
                          Ver perfil y cuenta
                        </button>
                      </div>
                    )}
                    {requiereAlertaScoring(clienteCcScoring?.score_nivel as CcScoreNivel) && (
                      <p className="venta-cc-scoring__alert" role="alert">
                        Scoring bajo ({clienteCcScoring?.score ?? '—'}). Revisá con administración antes
                        de ampliar deuda.
                      </p>
                    )}
                  </div>
                ) : clienteCcHabilitado === false ? (
                  <>
                    <span>
                      El cliente no está habilitado: falta el alta completo o la solicitud sigue pendiente /
                      fue rechazada por administración.
                    </span>
                    <button
                      type="button"
                      className="btn-link venta-cc-hint__link"
                      onClick={() => {
                        onClose()
                        navigate(CLIENTES_CUENTA_CORRIENTE)
                      }}
                    >
                      Ir a Cuenta corriente
                    </button>
                  </>
                ) : null}
              </div>
            )}
            {esCuentaCorriente && !clienteSeleccionado && !crearNuevoCliente && (
              <p className="form-hint-comprobante">Seleccioná un cliente para validar cuenta corriente.</p>
            )}
          </div>

          {/* Lista de precios / artículos */}
          <div className="form-group form-group--lista-precios">
            <div className="form-group-label-row">
              <label>Lista de precios</label>
              <span className="venta-rapida-lista-badge venta-rapida-lista-badge--inline">
                {labelListaPrecio(tipoListaPrecio)}
              </span>
            </div>
            <p className="form-hint-comprobante venta-lista-hint">
              {tipoListaPrecio === 'lista_1'
                ? 'Efectivo, transferencia, tarjeta y otros medios usan Lista 1.'
                : 'Cuenta corriente usa Lista 2.'}{' '}
              Precios con <strong>{labelAjustesPreciosActivos(ajustesPrecios)}</strong>.
            </p>
            <div className="lista-precios-filtros">
              <input
                type="text"
                className="form-input form-input--search"
                placeholder="Buscar por código, nombre o rubro…"
                value={busquedaArticulo}
                onChange={(e) => setBusquedaArticulo(e.target.value)}
                autoComplete="off"
              />
              {categoriasArticulos.length > 0 && (
                <select
                  className="form-select lista-precios-categoria"
                  value={categoriaArticulo}
                  onChange={(e) => setCategoriaArticulo(e.target.value)}
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

            <div className="lista-precios-panel">
              {loadingCatalogo ? (
                <p className="lista-precios-empty">Cargando catálogo…</p>
              ) : articulosFiltrados.length === 0 ? (
                <p className="lista-precios-empty">
                  {busquedaArticulo.trim() || categoriaArticulo !== 'todas'
                    ? 'Sin resultados. Probá con otras palabras o rubro.'
                    : 'No hay artículos en la lista de precios.'}
                </p>
              ) : (
                <div className="lista-precios-scroll">
                  {articulosFiltrados.slice(0, 80).map((articulo) => {
                    const precio = resolvePrecioLista(articulo, tipoListaPrecio, ajustesPrecios)
                    const yaAgregado = itemsVenta.some((i) => i.id_articulo_empresa === articulo.id)
                    return (
                      <button
                        key={articulo.id}
                        type="button"
                        className={`lista-precios-row${yaAgregado ? ' lista-precios-row--added' : ''}`}
                        disabled={precio == null || yaAgregado}
                        onClick={() => agregarArticulo(articulo)}
                      >
                        <span className="lista-precios-row__codigo">{articulo.codigo}</span>
                        <span className="lista-precios-row__nombre">{articulo.nombre}</span>
                        <span className="lista-precios-row__precio">
                          {precio != null ? `$${formatArs(precio)}` : '—'}
                        </span>
                      </button>
                    )
                  })}
                  {articulosFiltrados.length > 80 && (
                    <p className="lista-precios-more">
                      Mostrando 80 de {articulosFiltrados.length}. Acotá la búsqueda para ver más.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Comprobante de pago (opcional)</label>
            <p className="form-hint-comprobante">
              PDF o imagen (transferencia, QR, etc.). Máximo 8 MB.
            </p>
            <input
              ref={comprobanteInputRef}
              type="file"
              className="form-input-file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setComprobanteArchivo(f)
              }}
            />
            {comprobanteArchivo && (
              <div className="comprobante-seleccionado">
                <span className="comprobante-nombre">{comprobanteArchivo.name}</span>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setComprobanteArchivo(null)
                    if (comprobanteInputRef.current) comprobanteInputRef.current.value = ''
                  }}
                >
                  Quitar archivo
                </button>
              </div>
            )}
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

          {/* Items de venta (se muestran al agregar desde la lista) */}
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
                      <div className="item-control item-control--precio">
                        <label>
                          Precio unit.{' '}
                          {item.precio_lista && (
                            <span className="item-precio-lista-tag">
                              {item.precio_lista === 'lista_1' ? 'L1' : 'L2'}
                            </span>
                          )}
                        </label>
                        <div className="item-precio-readonly" title="Según lista de precios activa">
                          ${formatArs(item.precio_unitario)}
                        </div>
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
                        <strong>Subtotal: ${formatArs(item.precio_unitario * item.cantidad - item.descuento)}</strong>
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
                <span>${formatArs(calcularSubtotal())}</span>
              </div>
              <div className="total-line total-line--lista">
                <span>Lista aplicada:</span>
                <span>{labelListaPrecio(tipoListaPrecio)}</span>
              </div>
              <div className="total-line total-final">
                <span><strong>Total:</strong></span>
                <span><strong>${formatArs(calcularSubtotal())}</strong></span>
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
                <strong>Venta realizada</strong> — Nº {ventaCreada.numero_venta}
                {ventaCreada.numero_op && (
                  <div style={{ marginTop: '8px', fontSize: '0.95rem' }}>
                    ✓ Convertida a OP: <strong>{ventaCreada.numero_op}</strong>
                  </div>
                )}
                {ventaCreada.comprobante_pago_url && (
                  <div style={{ marginTop: '10px', fontSize: '0.95rem' }}>
                    <a
                      href={ventaCreada.comprobante_pago_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="comprobante-pago-link"
                    >
                      Ver comprobante de pago
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="venta-rapida-modal-footer">
          <div className="venta-rapida-footer-buttons">
          <button className="btn-secondary" onClick={onClose}>
            {ventaCreada ? 'Cerrar' : 'Cancelar'}
          </button>
          {!ventaCreada ? (
            <button
              className="btn-primary"
              onClick={handleGuardarVenta}
              disabled={guardando || itemsVenta.length === 0}
            >
              {guardando ? 'Guardando...' : '💾 Guardar Venta'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {!ventaCreada.numero_op && (
                <button
                  className="btn-primary"
                  onClick={handleConvertirAOP}
                  disabled={guardando}
                  style={{ minWidth: '160px', padding: '12px 20px' }}
                >
                  {guardando ? 'Convirtiendo...' : '📋 Convertirla a OP'}
                </button>
              )}
              {ventaCreada.numero_op && (
                <button
                  className="btn-secondary"
                  disabled
                  style={{ minWidth: '160px', padding: '12px 20px', opacity: 0.7 }}
                >
                  ✓ OP: {ventaCreada.numero_op}
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => generarPagarePDF(ventaCreada)}
                style={{ 
                  minWidth: '160px', 
                  padding: '12px 20px',
                  background: 'rgba(59, 130, 246, 0.15)', 
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📄 Generar Pagaré
              </button>
              <button
                className="btn-secondary"
                onClick={() => generarFacturaRemitoPDF(ventaCreada, 'remito')}
                style={{ 
                  minWidth: '160px', 
                  padding: '12px 20px',
                  background: 'rgba(16, 185, 129, 0.15)', 
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📋 Generar Remito
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VentaRapidaModal

