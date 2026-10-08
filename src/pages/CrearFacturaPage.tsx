import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord, ClienteRecord, ConfiguracionAFIPRecord, OrdenTrabajo, Venta } from '../types/api'
import {
  LISTAS_PRECIO_VENTAS,
  labelAjustesPreciosActivos,
  labelListaPrecio,
  resolvePrecioLista,
  type TipoListaPrecioVentas
} from '../constants/ventasListasPrecio'
import { useConfigAjustesPreciosVentas } from '../hooks/useConfigAjustesPreciosVentas'
import { etiquetaUnidadCorta, precioUnitarioTrasDescuentoPesos } from '../utils/unidadPrecio'
import {
  CONCEPTOS_AFIP,
  calcularLineaItem,
  calcularTotalesFactura,
  codigoComprobanteAfip,
  formatFechaAr,
  formatPvNumero,
  hoyISO,
  inferirCondicionIva,
  inferirTipoFactura,
  letraComprobante,
  tiposFacturaPermitidos,
  validarReceptorComprobante,
  type ConceptoAfip,
  type CondicionIvaCliente,
  type TipoFactura
} from '../utils/afipFacturaUi'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import { numeroALetras } from '../utils/crmExportUtils'
import './CrearFacturaPage.css'

const CONDICIONES_IVA: CondicionIvaCliente[] = [
  'Consumidor Final',
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'No Responsable'
]

function condicionIvaDeSistema(value: string | null | undefined): CondicionIvaCliente | '' {
  const raw = String(value || '').trim()
  return (CONDICIONES_IVA.find((c) => c.toLowerCase() === raw.toLowerCase()) || '') as CondicionIvaCliente | ''
}

/** Teléfono del encabezado de las facturas del sistema anterior. */
const TELEFONO_FACTURA = '0264-4278026'

type ItemRow = {
  codigo?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  iva_porcentaje: number
  unidad_medida?: string
  id_articulo_empresa?: number
}

function formatoCuit(value?: string | null) {
  const d = String(value || '').replace(/\D/g, '')
  if (d.length !== 11) return value?.trim() || '—'
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

function pesos(n: number) {
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sonPesos(n: number) {
  const texto = numeroALetras(n).replace(/ pesos con /, ' con ').replace(/ pesos$/, '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function CrearFacturaPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const idOP = searchParams.get('id_op')
  const idVentaParam = searchParams.get('id_venta')

  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [afipConfig, setAfipConfig] = useState<ConfiguracionAFIPRecord | null>(null)
  const [ventasDisponibles, setVentasDisponibles] = useState<Venta[]>([])
  const [ventaSeleccionadaId, setVentaSeleccionadaId] = useState<string>('')
  const [op, setOP] = useState<OrdenTrabajo | null>(null)
  const [venta, setVenta] = useState<Venta | null>(null)
  const [emitirAlGuardar, setEmitirAlGuardar] = useState(true)
  const [errorConfig, setErrorConfig] = useState<string | null>(null)
  /** Los precios de ventas / mostrador ya incluyen IVA; los ítems manuales se cargan netos por defecto. */
  const [preciosConIva, setPreciosConIva] = useState(false)

  const [formData, setFormData] = useState({
    tipo_comprobante: 'Factura B' as TipoFactura,
    concepto: 1 as ConceptoAfip,
    fecha_emision: hoyISO(),
    fecha_vencimiento: '',
    fecha_servicio_desde: '',
    fecha_servicio_hasta: '',
    observaciones: ''
  })
  const esServicio = formData.concepto !== 1

  const condicionEmisor = afipConfig?.condicion_iva

  const [cliente, setCliente] = useState({
    nombre: '',
    dni_cuit: '',
    direccion: '',
    condicion_iva: '' as '' | CondicionIvaCliente,
    id_cliente: null as number | null
  })

  const [items, setItems] = useState<ItemRow[]>([])
  const { ajustes: ajustesPrecios } = useConfigAjustesPreciosVentas()
  const [catalogoArticulos, setCatalogoArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(false)
  const [tipoListaPrecio, setTipoListaPrecio] = useState<TipoListaPrecioVentas>('lista_1')
  const [busquedaArticulo, setBusquedaArticulo] = useState('')
  const [categoriaArticulo, setCategoriaArticulo] = useState('todas')
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [clienteActivo, setClienteActivo] = useState(0)
  const clienteItemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const aplicarCliente = useCallback(
    (data: {
      nombre: string
      dni_cuit?: string | null
      direccion?: string | null
      condicion_iva?: CondicionIvaCliente | '' | null
      id_cliente?: number | null
    }) => {
      const cuit = data.dni_cuit || ''
      const cond = (data.condicion_iva || inferirCondicionIva(cuit)) as CondicionIvaCliente
      setCliente({
        nombre: data.nombre || 'Cliente',
        dni_cuit: cuit,
        direccion: data.direccion || '',
        condicion_iva: cond,
        id_cliente: data.id_cliente ?? null
      })
      setFormData((prev) => ({
        ...prev,
        tipo_comprobante: inferirTipoFactura(cuit, cond, condicionEmisor)
      }))
    },
    [condicionEmisor]
  )

  useEffect(() => {
    if (cliente.id_cliente || cliente.nombre.trim().length < 1) {
      setClientesEncontrados([])
      setBuscandoClientes(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setBuscandoClientes(true)
      try {
        const response = await apiService.buscarClientes(cliente.nombre.trim())
        setClientesEncontrados(response.success && response.data ? response.data : [])
      } catch (error) {
        console.error('Error buscando clientes:', error)
        setClientesEncontrados([])
      } finally {
        setBuscandoClientes(false)
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [cliente.nombre, cliente.id_cliente])

  useEffect(() => {
    setClienteActivo(0)
  }, [clientesEncontrados])

  useEffect(() => {
    clienteItemRefs.current[clienteActivo]?.scrollIntoView({ block: 'nearest' })
  }, [clienteActivo, clientesEncontrados])

  const seleccionarClienteSistema = (c: ClienteRecord) => {
    const nombre = (c.empresa || '').trim() || nombreCompletoCliente(c)
    aplicarCliente({
      nombre,
      dni_cuit: c.dni_cuit,
      direccion: c.direccion,
      id_cliente: c.id
    })
    setClientesEncontrados([])
    void apiService.getCuentaCorrientePorCliente(c.id).then((r) => {
      if (!r.success || !r.data) return
      const cc = r.data
      const domicilio = [cc.domicilio, cc.localidad, cc.provincia].filter(Boolean).join(', ')
      aplicarCliente({
        nombre: (cc.razon_social || nombre).trim(),
        dni_cuit: cc.cuit || c.dni_cuit,
        direccion: domicilio || c.direccion,
        condicion_iva: condicionIvaDeSistema(cc.condicion_iva) || undefined,
        id_cliente: c.id
      })
    })
  }

  const moverClienteTeclado = (e: KeyboardEvent<HTMLInputElement>) => {
    if (cliente.id_cliente || clientesEncontrados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setClienteActivo((i) => Math.min(clientesEncontrados.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setClienteActivo((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const elegido = clientesEncontrados[clienteActivo] ?? clientesEncontrados[0]
      if (elegido) seleccionarClienteSistema(elegido)
    } else if (e.key === 'Escape') {
      setClientesEncontrados([])
    }
  }

  const aplicarVenta = useCallback(
    async (ventaId: number) => {
      const response = await apiService.getVenta(ventaId)
      if (!response.success || !response.data) return
      const v = response.data
      setVenta(v)
      setVentaSeleccionadaId(String(v.id))
      aplicarCliente({
        nombre: v.cliente_nombre,
        dni_cuit: v.cliente_dni_cuit,
        direccion: v.cliente_direccion,
        id_cliente: v.id_cliente ?? null
      })
      // No se copia la fecha de la venta: AFIP rechaza comprobantes con más de 5 días de diferencia.
      // Los precios de la venta son finales (lo que pagó el cliente): IVA incluido.
      setPreciosConIva(true)
      const itemsResponse = await apiService.getItemsVenta(ventaId)
      if (itemsResponse.success && itemsResponse.data?.length) {
        setItems(
          itemsResponse.data.map((item) => ({
            codigo: item.codigo_articulo || '',
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: precioUnitarioTrasDescuentoPesos(
              Number(item.precio_unitario),
              Number(item.cantidad),
              Number(item.descuento) || 0
            ),
            descuento: 0,
            iva_porcentaje: 21
          }))
        )
      } else if (v.valor_total > 0) {
        setItems([
          {
            descripcion: `Venta ${v.numero_venta}${v.numero_op ? ` · OP ${v.numero_op}` : ''}`,
            cantidad: 1,
            precio_unitario: Number(v.valor_total),
            descuento: 0,
            iva_porcentaje: 21
          }
        ])
      }
      if (v.id_op) {
        const opRes = await apiService.getOrden(v.id_op)
        if (opRes.success && opRes.data) setOP(opRes.data)
      }
    },
    [aplicarCliente]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBootLoading(true)
      setErrorConfig(null)
      try {
        const [cfgRes, ventasRes] = await Promise.all([
          apiService.getConfiguracionAFIP(),
          apiService.listVentasPendientesFacturacion()
        ])
        if (cancelled) return
        if (cfgRes.success && cfgRes.data) setAfipConfig(cfgRes.data)
        else setErrorConfig(cfgRes.error || 'Configurá AFIP antes de facturar (Contable → Configuración AFIP).')
        if (ventasRes.success && ventasRes.data) setVentasDisponibles(ventasRes.data)
      } finally {
        if (!cancelled) setBootLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (bootLoading) return
    if (idVentaParam) {
      void aplicarVenta(parseInt(idVentaParam, 10))
      return
    }
    if (idOP) void loadOP(parseInt(idOP, 10))
  }, [bootLoading, idOP, idVentaParam, aplicarVenta])

  const loadOP = async (opId: number) => {
    try {
      const response = await apiService.getOrden(opId)
      if (response.success && response.data) {
        setOP(response.data)
        aplicarCliente({
          nombre: response.data.cliente,
          dni_cuit: response.data.dni_cuit,
          direccion: response.data.direccion_cliente,
          id_cliente: null
        })
        const ventasRes = await apiService.obtenerVentas(undefined, undefined, undefined, 'todos')
        const ventaVinculada = ventasRes.success ? ventasRes.data?.find((v) => v.id_op === opId) : undefined
        if (ventaVinculada) {
          await aplicarVenta(ventaVinculada.id)
          return
        }
        setItems([
          {
            descripcion: response.data.descripcion || `Trabajo ${response.data.numero_op}`,
            cantidad: 1,
            precio_unitario: 0,
            descuento: 0,
            iva_porcentaje: 21
          }
        ])
      }
    } catch (error) {
      console.error('Error cargando OP:', error)
    }
  }

  const handleSelectVenta = async (ventaId: string) => {
    setVentaSeleccionadaId(ventaId)
    if (!ventaId) {
      setVenta(null)
      return
    }
    const vid = parseInt(ventaId, 10)
    if (!Number.isFinite(vid)) return
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('id_venta', String(vid))
        p.delete('id_op')
        return p
      },
      { replace: true }
    )
    await aplicarVenta(vid)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingCatalogo(true)
      try {
        const response = await apiService.getArticulosEmpresa(undefined, false)
        if (!cancelled && response.success && response.data) {
          setCatalogoArticulos(response.data.filter((a) => a.activo && !a.codigo?.startsWith('ART-')))
        }
      } catch (error) {
        console.error('Error cargando lista de precios:', error)
      } finally {
        if (!cancelled) setLoadingCatalogo(false)
      }
    })()
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
      const haystack = [a.nombre, a.codigo, a.descripcion, a.categoria].filter(Boolean).join(' ').toLowerCase()
      return tokens.every((t) => haystack.includes(t))
    })
  }, [catalogoArticulos, busquedaArticulo, categoriaArticulo])

  useEffect(() => {
    if (items.length === 0 || catalogoArticulos.length === 0) return
    setItems((prev) =>
      prev.map((item) => {
        if (!item.id_articulo_empresa) return item
        const art = catalogoArticulos.find((a) => a.id === item.id_articulo_empresa)
        if (!art) return item
        const precio = resolvePrecioLista(art, tipoListaPrecio, ajustesPrecios)
        if (precio == null) return item
        return { ...item, precio_unitario: precio }
      })
    )
  }, [tipoListaPrecio, catalogoArticulos, ajustesPrecios])

  const handleAddItem = () => {
    setItems((prev) => [...prev, { descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 21 }])
  }

  const handleAddArticulo = (articulo: ArticuloEmpresaRecord) => {
    const precio = resolvePrecioLista(articulo, tipoListaPrecio, ajustesPrecios)
    if (precio == null) {
      alert(`Este artículo no tiene precio en ${labelListaPrecio(tipoListaPrecio)}.`)
      return
    }
    const facturaC = formData.tipo_comprobante === 'Factura C'
    const iva = facturaC ? 0 : ajustesPrecios.iva_activo ? ajustesPrecios.iva_porcentaje : 21
    setItems((prev) => {
      const ya = prev.findIndex((item) => item.id_articulo_empresa === articulo.id)
      if (ya >= 0) {
        const next = [...prev]
        next[ya] = { ...next[ya], cantidad: Number(next[ya].cantidad || 0) + 1, precio_unitario: precio }
        return next
      }
      return [
        ...prev,
        {
          codigo: articulo.codigo || '',
          descripcion: articulo.nombre,
          cantidad: 1,
          precio_unitario: precio,
          descuento: 0,
          iva_porcentaje: iva,
          unidad_medida: articulo.unidad_medida || undefined,
          id_articulo_empresa: articulo.id
        }
      ]
    })
    if (!facturaC) setPreciosConIva(true)
  }

  const handleUpdateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const tiposPermitidos = useMemo(() => tiposFacturaPermitidos(condicionEmisor), [condicionEmisor])
  const esFacturaC = formData.tipo_comprobante === 'Factura C'
  const opcionesCalculo = useMemo(
    () => ({ preciosConIva: preciosConIva && !esFacturaC, sinIva: esFacturaC }),
    [preciosConIva, esFacturaC]
  )
  const totales = useMemo(() => calcularTotalesFactura(items, opcionesCalculo), [items, opcionesCalculo])

  // Si la configuración del emisor no admite la letra elegida, pasar a la que corresponde
  useEffect(() => {
    if (!afipConfig || tiposPermitidos.includes(formData.tipo_comprobante)) return
    setFormData((p) => ({ ...p, tipo_comprobante: inferirTipoFactura(cliente.dni_cuit, cliente.condicion_iva, condicionEmisor) }))
  }, [afipConfig, tiposPermitidos, formData.tipo_comprobante, cliente.dni_cuit, cliente.condicion_iva, condicionEmisor])

  const proximoNumero = useMemo(() => {
    if (!afipConfig) return 1
    const t = formData.tipo_comprobante
    if (t.includes(' A')) return (afipConfig.ultimo_numero_factura_a || 0) + 1
    if (t.includes(' C')) return (afipConfig.ultimo_numero_factura_c || 0) + 1
    return (afipConfig.ultimo_numero_factura_b || 0) + 1
  }, [afipConfig, formData.tipo_comprobante])

  const numeroPreview = useMemo(
    () => formatPvNumero(afipConfig?.punto_venta || 1, proximoNumero),
    [afipConfig?.punto_venta, proximoNumero]
  )

  const letra = letraComprobante(formData.tipo_comprobante)
  const codigoAfip = codigoComprobanteAfip(formData.tipo_comprobante)

  const handleGuardar = async () => {
    if (!afipConfig) {
      alert(errorConfig || 'Falta configuración AFIP activa.')
      return
    }
    if (!cliente.nombre.trim()) {
      alert('Ingresá el nombre del cliente.')
      return
    }
    if (items.length === 0) {
      alert('Agregá al menos un ítem.')
      return
    }
    if (items.some((item) => !item.descripcion.trim() || item.precio_unitario <= 0 || item.cantidad <= 0)) {
      alert('Todos los ítems deben tener descripción, cantidad y precio válidos.')
      return
    }
    if (!tiposPermitidos.includes(formData.tipo_comprobante)) {
      alert(`Con condición de emisor "${condicionEmisor}" solo podés emitir: ${tiposPermitidos.join(', ')}.`)
      return
    }
    const errorReceptor = validarReceptorComprobante(formData.tipo_comprobante, cliente.condicion_iva, cliente.dni_cuit)
    if (errorReceptor) {
      alert(errorReceptor)
      return
    }
    if (totales.total <= 0) {
      alert('El total de la factura debe ser mayor a cero.')
      return
    }
    // Servicios: sin período cargado se toma la fecha de emisión (lo mismo hace el servidor)
    const servicioDesde = esServicio ? formData.fecha_servicio_desde || formData.fecha_emision : null
    const servicioHasta = esServicio ? formData.fecha_servicio_hasta || servicioDesde : null
    if (servicioDesde && servicioHasta && servicioDesde > servicioHasta) {
      alert('El período del servicio es inválido: "desde" es posterior a "hasta".')
      return
    }
    if (esServicio && formData.fecha_vencimiento && formData.fecha_vencimiento < formData.fecha_emision) {
      alert('El vencimiento del pago no puede ser anterior a la fecha de emisión.')
      return
    }

    setLoading(true)
    try {
      const response = await apiService.crearFactura({
        tipo_comprobante: formData.tipo_comprobante,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        id_cliente: cliente.id_cliente,
        cliente_nombre: cliente.nombre.trim(),
        cliente_dni_cuit: cliente.dni_cuit?.trim() || null,
        cliente_direccion: cliente.direccion?.trim() || null,
        cliente_condicion_iva: cliente.condicion_iva || null,
        id_op: op?.id || venta?.id_op || null,
        numero_op: op?.numero_op || venta?.numero_op || null,
        id_venta: venta?.id || null,
        items,
        precios_con_iva: opcionesCalculo.preciosConIva,
        concepto: formData.concepto,
        fecha_servicio_desde: servicioDesde,
        fecha_servicio_hasta: servicioHasta,
        observaciones: formData.observaciones?.trim() || null
      })

      if (!response.success || !response.data) {
        alert('Error al crear factura: ' + (response.error || 'desconocido'))
        return
      }

      const facturaId = response.data.id
      if (emitirAlGuardar) {
        const emit = await apiService.emitirFactura(facturaId)
        if (!emit.success) {
          alert('La factura quedó en borrador: AFIP no la autorizó.\n\n' + (emit.error || 'desconocido'))
          navigate(`/erp/facturas/${facturaId}`)
          return
        }
        if (emit.warning) alert(`Factura autorizada en AFIP, con un pendiente:\n\n${emit.warning}`)
      }

      alert(emitirAlGuardar ? 'Factura autorizada en AFIP y emitida.' : 'Factura creada en borrador.')
      navigate(`/erp/facturas/${facturaId}`)
    } catch (error) {
      console.error('Error creando factura:', error)
      alert('Error al crear factura')
    } finally {
      setLoading(false)
    }
  }

  if (bootLoading) {
    return (
      <div className="crear-factura-page">
        <div className="crear-factura-loading">Cargando datos de facturación…</div>
      </div>
    )
  }

  return (
    <div className="crear-factura-page">
      <header className="crear-factura-header">
        <div className="crear-factura-header__brand">
          <div className="crear-factura-header__icon" aria-hidden>
            🧾
          </div>
          <div>
            <p className="crear-factura-header__eyebrow">Contable · AFIP</p>
            <h1>Nueva factura de venta</h1>
            <p className="crear-factura-header__sub">
              Comprobante fiscal con datos de ventas del CRM · {afipConfig?.ambiente || 'Sin ambiente'}
            </p>
          </div>
        </div>
        <div className="crear-factura-header__actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
            ← Facturas
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/configuracion-afip')}>
            Config AFIP
          </button>
        </div>
      </header>

      {errorConfig && (
        <div className="crear-factura-alert crear-factura-alert--warn">
          {errorConfig}
        </div>
      )}

      <div className="crear-factura-layout">
        <aside className="crear-factura-sidebar">
          <section className="crear-factura-panel">
            <h2>Origen · Ventas</h2>
            <label className="crear-factura-field">
              <span>Venta del CRM / mostrador</span>
              <select value={ventaSeleccionadaId} onChange={(e) => void handleSelectVenta(e.target.value)}>
                <option value="">(manual / sin venta)</option>
                {ventasDisponibles.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.numero_venta} · {v.cliente_nombre} · ${Number(v.valor_total).toLocaleString('es-AR')}
                    {v.numero_op ? ` · OP ${v.numero_op}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {venta && (
              <div className="crear-factura-origen-meta">
                <span className="crear-factura-pill">Venta {venta.numero_venta}</span>
                {venta.numero_op && <span className="crear-factura-pill">OP {venta.numero_op}</span>}
                <span className="crear-factura-pill">{venta.estado_pago}</span>
              </div>
            )}
          </section>

          <section className="crear-factura-panel">
            <h2>Comprobante</h2>
            <label className="crear-factura-field">
              <span>Tipo</span>
              <select
                value={formData.tipo_comprobante}
                onChange={(e) => setFormData((p) => ({ ...p, tipo_comprobante: e.target.value as TipoFactura }))}
              >
                {tiposPermitidos.includes('Factura A') && (
                  <option value="Factura A">Factura A (a Resp. Inscripto / Monotributista)</option>
                )}
                {tiposPermitidos.includes('Factura B') && (
                  <option value="Factura B">Factura B (a Consumidor Final / Exento)</option>
                )}
                {tiposPermitidos.includes('Factura C') && (
                  <option value="Factura C">Factura C (emisor Monotributista / Exento)</option>
                )}
              </select>
            </label>
            <label className="crear-factura-field">
              <span>Concepto</span>
              <select
                value={formData.concepto}
                onChange={(e) => setFormData((p) => ({ ...p, concepto: Number(e.target.value) as ConceptoAfip }))}
              >
                {CONCEPTOS_AFIP.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="crear-factura-field">
              <span>Fecha emisión</span>
              <input
                type="date"
                value={formData.fecha_emision}
                onChange={(e) => setFormData((p) => ({ ...p, fecha_emision: e.target.value }))}
              />
            </label>
            {esServicio && (
              <>
                <label className="crear-factura-field">
                  <span>Servicio desde</span>
                  <input
                    type="date"
                    value={formData.fecha_servicio_desde || formData.fecha_emision}
                    onChange={(e) => setFormData((p) => ({ ...p, fecha_servicio_desde: e.target.value }))}
                  />
                </label>
                <label className="crear-factura-field">
                  <span>Servicio hasta</span>
                  <input
                    type="date"
                    value={formData.fecha_servicio_hasta || formData.fecha_servicio_desde || formData.fecha_emision}
                    onChange={(e) => setFormData((p) => ({ ...p, fecha_servicio_hasta: e.target.value }))}
                  />
                </label>
              </>
            )}
            <label className="crear-factura-field">
              <span>{esServicio ? 'Vencimiento del pago (vacío = fecha de emisión)' : 'Fecha vencimiento'}</span>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                min={esServicio ? formData.fecha_emision : undefined}
                onChange={(e) => setFormData((p) => ({ ...p, fecha_vencimiento: e.target.value }))}
              />
            </label>
            <label className="crear-factura-check">
              <input type="checkbox" checked={emitirAlGuardar} onChange={(e) => setEmitirAlGuardar(e.target.checked)} />
              Autorizar en AFIP al guardar (con CAE genera CxC y asiento)
            </label>
            <label className="crear-factura-check">
              <input
                type="checkbox"
                checked={preciosConIva && !esFacturaC}
                disabled={esFacturaC}
                onChange={(e) => setPreciosConIva(e.target.checked)}
              />
              Precios con IVA incluido
            </label>
          </section>

          <section className="crear-factura-panel">
            <h2>Cliente receptor</h2>
            <div className="crear-factura-field">
              <span>Razón social / Nombre</span>
              <div className={`crear-factura-cliente-search${cliente.id_cliente ? ' is-selected' : ''}`}>
                <input
                  type="text"
                  placeholder="Nombre, apellido, DNI, teléfono o empresa…"
                  value={cliente.nombre}
                  onChange={(e) => {
                    setCliente((p) => ({ ...p, nombre: e.target.value, id_cliente: null }))
                    setClienteActivo(0)
                  }}
                  onKeyDown={moverClienteTeclado}
                  autoComplete="off"
                  spellCheck={false}
                />
                {buscandoClientes && !cliente.id_cliente && (
                  <span className="crear-factura-cliente-search__spin" aria-hidden>
                    …
                  </span>
                )}
                {clientesEncontrados.length > 0 && !cliente.id_cliente && (
                  <div className="crear-factura-cliente-list" role="listbox">
                    {clientesEncontrados.map((c, index) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={index === clienteActivo}
                        className={`crear-factura-cliente-item${index === clienteActivo ? ' is-active' : ''}`}
                        ref={(node) => {
                          clienteItemRefs.current[index] = node
                        }}
                        onMouseEnter={() => setClienteActivo(index)}
                        onClick={() => seleccionarClienteSistema(c)}
                      >
                        <strong>{nombreCompletoCliente(c)}</strong>
                        {c.empresa ? <small>{c.empresa}</small> : null}
                        {c.dni_cuit ? <small>CUIT/DNI {c.dni_cuit}</small> : null}
                        {c.telefono ? <small>{c.telefono}</small> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {cliente.id_cliente ? (
                <small className="crear-factura-cliente-ok">
                  Cliente #{cliente.id_cliente} del sistema
                  <button
                    type="button"
                    className="crear-factura-cliente-cambiar"
                    onClick={() => {
                      setCliente((p) => ({ ...p, id_cliente: null }))
                      setClientesEncontrados([])
                    }}
                  >
                    Cambiar
                  </button>
                </small>
              ) : (
                <small className="crear-factura-muted">Escribí para buscar en clientes. Si no está, cargalo a mano.</small>
              )}
            </div>
            <label className="crear-factura-field">
              <span>CUIT / DNI</span>
              <input
                type="text"
                value={cliente.dni_cuit}
                onChange={(e) => {
                  const cuit = e.target.value
                  const cond = cliente.condicion_iva || inferirCondicionIva(cuit)
                  setCliente((p) => ({ ...p, dni_cuit: cuit, condicion_iva: cond }))
                  setFormData((p) => ({ ...p, tipo_comprobante: inferirTipoFactura(cuit, cond, condicionEmisor) }))
                }}
              />
            </label>
            <label className="crear-factura-field">
              <span>Condición IVA</span>
              <select
                value={cliente.condicion_iva}
                onChange={(e) => {
                  const cond = e.target.value as CondicionIvaCliente
                  setCliente((p) => ({ ...p, condicion_iva: cond }))
                  setFormData((p) => ({ ...p, tipo_comprobante: inferirTipoFactura(cliente.dni_cuit, cond, condicionEmisor) }))
                }}
              >
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Exento">Exento</option>
                <option value="No Responsable">No Responsable</option>
              </select>
            </label>
            <label className="crear-factura-field">
              <span>Domicilio</span>
              <input
                type="text"
                value={cliente.direccion}
                onChange={(e) => setCliente((p) => ({ ...p, direccion: e.target.value }))}
              />
            </label>
          </section>

          <section className="crear-factura-panel">
            <div className="crear-factura-panel__head">
              <h2>Ítems</h2>
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddItem}>
                + Ítem
              </button>
            </div>

            <p className="crear-factura-catalogo__hint">
              Lista Flexxus · precios con <strong>{labelAjustesPreciosActivos(ajustesPrecios)}</strong>
            </p>
            <div className="crear-factura-lista-chips">
              {(Object.keys(LISTAS_PRECIO_VENTAS) as TipoListaPrecioVentas[]).map((lista) => (
                <button
                  key={lista}
                  type="button"
                  className={`crear-factura-lista-chip${tipoListaPrecio === lista ? ' is-active' : ''}`}
                  onClick={() => setTipoListaPrecio(lista)}
                >
                  {LISTAS_PRECIO_VENTAS[lista].label}
                  <small>{LISTAS_PRECIO_VENTAS[lista].subtitle}</small>
                </button>
              ))}
            </div>
            <div className="crear-factura-catalogo-filtros">
              <input
                type="search"
                placeholder="Buscar código, nombre o rubro…"
                value={busquedaArticulo}
                onChange={(e) => setBusquedaArticulo(e.target.value)}
                autoComplete="off"
              />
              {categoriasArticulos.length > 0 && (
                <select value={categoriaArticulo} onChange={(e) => setCategoriaArticulo(e.target.value)}>
                  <option value="todas">Todos los rubros</option>
                  {categoriasArticulos.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="crear-factura-catalogo">
              {loadingCatalogo ? (
                <p className="crear-factura-muted">Cargando lista de precios…</p>
              ) : articulosFiltrados.length === 0 ? (
                <p className="crear-factura-muted">
                  {busquedaArticulo.trim() || categoriaArticulo !== 'todas'
                    ? 'Sin resultados. Probá con otras palabras o rubro.'
                    : 'No hay artículos en la lista de precios.'}
                </p>
              ) : (
                <>
                  {articulosFiltrados.slice(0, 60).map((articulo) => {
                    const precio = resolvePrecioLista(articulo, tipoListaPrecio, ajustesPrecios)
                    const qty = items.find((item) => item.id_articulo_empresa === articulo.id)?.cantidad
                    return (
                      <button
                        key={articulo.id}
                        type="button"
                        className={`crear-factura-catalogo-row${qty ? ' is-added' : ''}`}
                        disabled={precio == null}
                        onClick={() => handleAddArticulo(articulo)}
                      >
                        <span className="crear-factura-catalogo-row__nombre">
                          <strong>{articulo.nombre}</strong>
                          <small>
                            {articulo.codigo || '—'}
                            {articulo.categoria ? ` · ${articulo.categoria}` : ''}
                          </small>
                        </span>
                        <span className="crear-factura-catalogo-row__precio">
                          {precio != null
                            ? `$${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })} / ${etiquetaUnidadCorta(articulo.unidad_medida)}`
                            : 'Sin precio'}
                          {qty ? <em>+{qty}</em> : null}
                        </span>
                      </button>
                    )
                  })}
                  {articulosFiltrados.length > 60 && (
                    <p className="crear-factura-muted crear-factura-catalogo__more">
                      Mostrando 60 de {articulosFiltrados.length}. Acotá la búsqueda.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="crear-factura-items-editor">
              {items.length === 0 ? (
                <p className="crear-factura-muted">
                  Sin ítems. Elegí un artículo de la lista, una venta o agregá uno manual.
                </p>
              ) : (
                items.map((item, index) => (
                  <div key={item.id_articulo_empresa ? `art-${item.id_articulo_empresa}` : `row-${index}`} className="crear-factura-item-edit">
                    {item.id_articulo_empresa ? (
                      <span className="crear-factura-item-edit__lista">{labelListaPrecio(tipoListaPrecio)}</span>
                    ) : null}
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={item.descripcion}
                      onChange={(e) => handleUpdateItem(index, 'descripcion', e.target.value)}
                    />
                    <div className="crear-factura-item-edit__nums">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        title={item.unidad_medida ? `Cantidad (${etiquetaUnidadCorta(item.unidad_medida)})` : 'Cantidad'}
                        value={item.cantidad}
                        onChange={(e) => handleUpdateItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        title="Precio unitario"
                        value={item.precio_unitario}
                        onChange={(e) => handleUpdateItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      />
                      <select
                        value={esFacturaC ? 0 : item.iva_porcentaje}
                        disabled={esFacturaC}
                        title={esFacturaC ? 'La Factura C no discrimina IVA' : 'Alícuota IVA'}
                        onChange={(e) => handleUpdateItem(index, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                      >
                        {esFacturaC ? (
                          <option value={0}>Sin IVA</option>
                        ) : (
                          <>
                            <option value={21}>IVA 21%</option>
                            <option value={10.5}>IVA 10,5%</option>
                            <option value={27}>IVA 27%</option>
                            <option value={0}>IVA 0%</option>
                          </>
                        )}
                      </select>
                      <button type="button" className="btn-remove-item" onClick={() => handleRemoveItem(index)} aria-label="Quitar">
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <label className="crear-factura-field">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={formData.observaciones}
              onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))}
              placeholder="Texto adicional en la factura…"
            />
          </label>

          <div className="crear-factura-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleGuardar} disabled={loading || !afipConfig}>
              {loading ? 'Guardando…' : emitirAlGuardar ? 'Crear y emitir' : 'Guardar borrador'}
            </button>
          </div>
        </aside>

        <div className="afip-comprobante-wrap">
          <div className="afip-comprobante" aria-label="Vista previa comprobante AFIP">
            <div className="afip-comprobante__header">
              <div className="afip-comprobante__emisor">
                <img className="afip-comprobante__logo" src="/factura/plot-center-pc.png" alt="Plot Center" />
                <strong className="afip-comprobante__razon">{(afipConfig?.razon_social || 'PLOT CENTER SRL').toUpperCase()}</strong>
                {(() => {
                  const domicilio = (afipConfig?.domicilio_comercial || 'Avenida Libertador Este 580, San Juan').trim()
                  const [calle, ...resto] = domicilio.split(',')
                  const localidad = resto.join(',').trim()
                  return (
                    <>
                      <div className="afip-comprobante__emisor-linea">{calle.trim()}</div>
                      {localidad ? <div className="afip-comprobante__emisor-linea">{localidad}</div> : null}
                    </>
                  )
                })()}
                <div>Teléfono: {TELEFONO_FACTURA}</div>
                <div className="afip-comprobante__cond">{afipConfig?.condicion_iva || 'Responsable Inscripto'}</div>
              </div>

              <div className="afip-comprobante__tipo-box">
                <div className="afip-comprobante__letra">{letra}</div>
                <div className="afip-comprobante__cod">COD. Nº {Number(codigoAfip) || codigoAfip}</div>
              </div>

              <div className="afip-comprobante__ident">
                <div className="afip-comprobante__titulo">FACTURA {letra}</div>
                <div>
                  <strong>Nº</strong> {numeroPreview}
                </div>
                <div>
                  <strong>Fecha de emisión:</strong> {formatFechaAr(formData.fecha_emision)}
                </div>
                <div>
                  <strong>CUIT:</strong> {formatoCuit(afipConfig?.cuit || '30715518801')}
                </div>
                <div>
                  <strong>Ing. Brutos:</strong> {afipConfig?.ingresos_brutos || '30-71551880-1'}
                </div>
                <div>
                  <strong>Inic. Activ.:</strong>{' '}
                  {formatFechaAr(afipConfig?.fecha_inicio_actividades || '2017-01-27')}
                </div>
              </div>
            </div>

            <div className="afip-comprobante__receptor">
              <div>
                <strong>Señor(es):</strong> {(cliente.nombre || '—').toUpperCase()}
              </div>
              <div>
                <strong>CUIT:</strong> {formatoCuit(cliente.dni_cuit)}
              </div>
              <div>
                <strong>Domicilio:</strong> {(cliente.direccion || '—').toUpperCase()}
              </div>
              <div>
                <strong>Ing. Brutos:</strong> —
              </div>
              <div>
                <strong>Cond. de IVA:</strong> {(cliente.condicion_iva || '—').toUpperCase()}
              </div>
              <div>
                <strong>Cond. Vta.:</strong> {(venta?.metodo_pago || 'Contado').toUpperCase()}
              </div>
              {esServicio && (
                <div>
                  <strong>Período desde:</strong> {formatFechaAr(formData.fecha_servicio_desde || formData.fecha_emision)}{' '}
                  <strong>hasta:</strong>{' '}
                  {formatFechaAr(formData.fecha_servicio_hasta || formData.fecha_servicio_desde || formData.fecha_emision)}
                </div>
              )}
            </div>

            <div className="afip-comprobante__items-area">
            <table className="afip-comprobante__items">
              <thead>
                <tr>
                  <th>Código Art.</th>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Imp. Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="afip-comprobante__empty">
                      Sin ítems cargados
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const linea = calcularLineaItem(item, opcionesCalculo)
                    const importeLinea = letra === 'A' ? linea.neto : linea.total
                    const factorIva = 1 + linea.alicuota / 100
                    const precioMostrado =
                      letra === 'A'
                        ? opcionesCalculo.preciosConIva
                          ? item.precio_unitario / factorIva
                          : item.precio_unitario
                        : opcionesCalculo.preciosConIva || esFacturaC
                          ? item.precio_unitario
                          : item.precio_unitario * factorIva
                    return (
                      <tr key={idx}>
                        <td>{item.codigo || ''}</td>
                        <td>{(item.descripcion || '—').toUpperCase()}</td>
                        <td>{item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{pesos(precioMostrado)}</td>
                        <td>{pesos(importeLinea)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            </div>

            <div className="afip-comprobante__pie">
              <div className="afip-comprobante__obs">
                <strong>Observaciones:</strong>
                <div>{formData.observaciones || ''}</div>
              </div>
              <div className="afip-comprobante__totales">
                <div>
                  <span>Neto gravado:</span>
                  <span>{pesos(totales.subtotal)}</span>
                </div>
                <div>
                  <span>
                    Descuento:{' '}
                    {(totales.subtotal + totales.descuento > 0
                      ? (totales.descuento / (totales.subtotal + totales.descuento)) * 100
                      : 0
                    ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    %
                  </span>
                  <span />
                </div>
                <div>
                  <span>Subtotal:</span>
                  <span>{pesos(totales.subtotal)}</span>
                </div>
                <div>
                  <span>I.V.A. 21%:</span>
                  <span>{pesos(totales.porAlicuota['21']?.iva || 0)}</span>
                </div>
                <div>
                  <span>I.V.A. 10,5%:</span>
                  <span>{pesos(totales.porAlicuota['10.5']?.iva || 0)}</span>
                </div>
                <div>
                  <span>Total:</span>
                  <span>{pesos(totales.total)}</span>
                </div>
              </div>
            </div>

            <div className="afip-comprobante__son">Son PESOS: {sonPesos(totales.total)}</div>

            <div className="afip-comprobante__cae">
              <div className="afip-comprobante__qr" aria-hidden />
              <div>
                <div className="afip-comprobante__cae-titulo">Factura Electrónica</div>
                <div>
                  <strong>CAE:</strong> —
                </div>
                <div>
                  <strong>Fecha Vencimiento CAE:</strong> —
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
