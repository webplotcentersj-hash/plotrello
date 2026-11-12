import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord, ClienteRecord, ProveedorConFinanzas } from '../types/api'
import type { ArticuloStock, Proveedor, ProveedorProducto } from '../types/pedidos'
import ProveedorFinanzasHub from '../components/compras/ProveedorFinanzasHub'
import {
  estadoCuentaProveedor,
  moneyProveedor,
  saldoCuentaProveedor
} from '../utils/proveedorCuenta'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import {
  CONDICIONES_IVA_CLIENTE,
  inferirCondicionIva,
  normalizarCondicionIvaCliente
} from '../utils/afipFacturaUi'
import { getArgentinaDateString } from '../utils/dateUtils'
import './ProveedoresPage.css'

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
] as const

function etiquetaMesActualAR(): { clave: string; label: string } {
  const hoy = getArgentinaDateString()
  const [y, m] = hoy.split('-')
  const mi = Math.max(0, Math.min(11, Number(m) - 1))
  return { clave: `${y}-${m}`, label: `${MESES_ES[mi]} ${y}` }
}

type CatalogoProductoHit = {
  key: string
  origen: 'lista' | 'stock'
  codigo: string
  nombre: string
  unidad: string
  precio: number | null
  stock: number | null
  idRef: number
}

function displayNombre(p: ProveedorConFinanzas): string {
  return p.razon_social || p.nombre
}

function displayTelefono(p: ProveedorConFinanzas): string | null {
  const t = p.telefono?.trim()
  if (!t || t === '-') return null
  return t
}

function mapUnidadProveedor(raw: string | null | undefined): string {
  const u = String(raw || '')
    .trim()
    .toLowerCase()
  if (!u) return 'unidad'
  if (u === 'kg' || u.includes('kilo')) return 'kg'
  if (u === 'm2' || u.includes('m²') || u.includes('cuadrad')) return 'm2'
  if (u === 'm3' || u.includes('cúbic') || u.includes('cubic')) return 'm3'
  if (u === 'm' || u === 'mt' || u === 'metro') return 'm'
  if (u === 'l' || u === 'lt' || u.includes('litro')) return 'l'
  if (u.includes('caja')) return 'caja'
  if (u.includes('pack') || u.includes('paquete')) return 'pack'
  if (u.includes('unid') || u === 'u' || u === 'un') return 'unidad'
  return 'unidad'
}

function hitDesdeEmpresa(a: ArticuloEmpresaRecord): CatalogoProductoHit {
  return {
    key: `lista-${a.id}`,
    origen: 'lista',
    codigo: (a.codigo || '').trim(),
    nombre: (a.nombre || a.descripcion || a.codigo || `Artículo #${a.id}`).trim(),
    unidad: mapUnidadProveedor(a.unidad_medida),
    precio: a.precio_base != null ? Number(a.precio_base) : a.precio_lista_1 != null ? Number(a.precio_lista_1) : null,
    stock: a.stock_disponible != null ? Number(a.stock_disponible) : null,
    idRef: a.id
  }
}

function hitDesdeStock(a: ArticuloStock): CatalogoProductoHit {
  return {
    key: `stock-${a.id}`,
    origen: 'stock',
    codigo: (a.codigo || '').trim(),
    nombre: (a.descripcion || a.codigo || `Stock #${a.id}`).trim(),
    unidad: mapUnidadProveedor(a.unidad),
    precio: a.precio != null ? Number(a.precio) : null,
    stock: a.stock != null ? Number(a.stock) : null,
    idRef: a.id
  }
}

const ProveedoresPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [proveedores, setProveedores] = useState<ProveedorConFinanzas[]>([])
  const [proveedorTrazado, setProveedorTrazado] = useState<ProveedorConFinanzas | null>(null)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null)
  const [productosProveedor, setProductosProveedor] = useState<ProveedorProducto[]>([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [mostrarModalProductos, setMostrarModalProductos] = useState(false)
  const [mostrarModalNuevoProducto, setMostrarModalNuevoProducto] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [formDataProducto, setFormDataProducto] = useState({
    codigo_producto: '',
    descripcion: '',
    unidad: 'unidad',
    precio_unitario: '',
    moneda: 'ARS',
    stock_disponible: '',
    tiempo_entrega_dias: '',
    observaciones: ''
  })
  const [formData, setFormData] = useState({
    nombre: '',
    razon_social: '',
    cuit: '',
    condicion_iva: '',
    contacto_nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    provincia: '',
    codigo_postal: '',
    sitio_web: '',
    notas: ''
  })
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'deuda' | 'aldia' | 'favor'>('todos')
  const [pagina, setPagina] = useState(1)
  const PAGE_SIZE = 10
  const [mesMovs, setMesMovs] = useState({
    debe: 0,
    haber: 0,
    facturas: 0,
    pagos: 0
  })
  const [clientesSugeridos, setClientesSugeridos] = useState<ClienteRecord[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [clienteVinculado, setClienteVinculado] = useState<ClienteRecord | null>(null)
  const [clienteCcOk, setClienteCcOk] = useState<boolean | null>(null)
  const [catalogoEmpresa, setCatalogoEmpresa] = useState<ArticuloEmpresaRecord[]>([])
  const [productosCatalogoHits, setProductosCatalogoHits] = useState<CatalogoProductoHit[]>([])
  const [buscandoProductoCatalogo, setBuscandoProductoCatalogo] = useState(false)
  const [productoCatalogoElegido, setProductoCatalogoElegido] = useState<CatalogoProductoHit | null>(null)
  const [busquedaProductoCatalogo, setBusquedaProductoCatalogo] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/compras/dashboard')
      return
    }
    loadProveedores()
  }, [canManageCompras, navigate, authLoading])

  const loadProveedores = async () => {
    setLoading(true)
    try {
      const { clave: mesClave } = etiquetaMesActualAR()
      const [response, movsRes] = await Promise.all([
        apiService.getProveedoresConFinanzas(),
        apiService.getMovimientosProveedores()
      ])
      if (response.success && response.data) {
        setProveedores(response.data)
      }
      if (movsRes.success && movsRes.data) {
        let debe = 0
        let haber = 0
        let facturas = 0
        let pagos = 0
        for (const m of movsRes.data) {
          if (m.es_saldo_inicial) continue
          const fecha = String(m.fecha_comprobante || m.fecha_hora || '').slice(0, 7)
          if (fecha !== mesClave) continue
          const d = Number(m.debe) || 0
          const h = Number(m.haber) || 0
          debe += d
          haber += h
          if (h > 0.009 || /pago/i.test(m.tipo_movimiento || '')) pagos += 1
          else if (d > 0.009) facturas += 1
        }
        setMesMovs({ debe, haber, facturas, pagos })
      } else {
        setMesMovs({ debe: 0, haber: 0, facturas: 0, pagos: 0 })
      }
    } catch (error) {
      console.error('Error cargando proveedores:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProductosProveedor = async (idProveedor: number) => {
    try {
      const response = await apiService.getProductosProveedor(idProveedor)
      if (response.success && response.data) {
        setProductosProveedor(response.data)
      }
    } catch (error) {
      console.error('Error cargando productos:', error)
    }
  }

  const resetClienteVinculo = () => {
    setClientesSugeridos([])
    setClienteVinculado(null)
    setClienteCcOk(null)
    setBuscandoClientes(false)
  }

  const aplicarClienteComoProveedor = async (cliente: ClienteRecord) => {
    const nombre = nombreCompletoCliente(cliente)
    const razon = (cliente.empresa || nombre).trim()
    const cuit = (cliente.dni_cuit || '').trim()
    const iva =
      normalizarCondicionIvaCliente(cliente.condicion_iva) ||
      (cuit ? inferirCondicionIva(cuit) : '')
    setFormData((prev) => ({
      ...prev,
      nombre: nombre !== '—' ? nombre : prev.nombre,
      razon_social: razon || prev.razon_social,
      cuit: cuit || prev.cuit,
      condicion_iva: iva || prev.condicion_iva,
      telefono: (cliente.telefono || prev.telefono || '').trim(),
      email: (cliente.email || prev.email || '').trim(),
      direccion: (cliente.direccion || prev.direccion || '').trim()
    }))
    setClienteVinculado(cliente)
    setClientesSugeridos([])
    setClienteCcOk(null)
    try {
      const hab = await apiService.clienteHabilitadoCuentaCorriente(cliente.id)
      setClienteCcOk(hab.success ? Boolean(hab.data) : false)
    } catch {
      setClienteCcOk(false)
    }
  }

  useEffect(() => {
    if (!mostrarModal) return
    const q = formData.nombre.trim()
    if (q.length < 2 || clienteVinculado) {
      setClientesSugeridos([])
      setBuscandoClientes(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setBuscandoClientes(true)
      void apiService.buscarClientes(q).then((res) => {
        if (cancelled) return
        setClientesSugeridos(res.success && res.data ? res.data.slice(0, 8) : [])
        setBuscandoClientes(false)
      })
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [formData.nombre, mostrarModal, clienteVinculado])

  const handleAbrirModal = (proveedor?: Proveedor | ProveedorConFinanzas) => {
    resetClienteVinculo()
    if (proveedor) {
      setModoEdicion(true)
      setProveedorSeleccionado(proveedor.id > 0 ? (proveedor as Proveedor) : null)
      setFormData({
        nombre: proveedor.nombre,
        razon_social: proveedor.razon_social || '',
        cuit: proveedor.cuit || '',
        condicion_iva: normalizarCondicionIvaCliente(proveedor.condicion_iva) || proveedor.condicion_iva || '',
        contacto_nombre: proveedor.contacto_nombre || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        direccion: proveedor.direccion || '',
        ciudad: proveedor.ciudad || '',
        provincia: proveedor.provincia || '',
        codigo_postal: proveedor.codigo_postal || '',
        sitio_web: proveedor.sitio_web || '',
        notas: proveedor.notas || ''
      })
    } else {
      setModoEdicion(false)
      setProveedorSeleccionado(null)
      setFormData({
        nombre: '',
        razon_social: '',
        cuit: '',
        condicion_iva: '',
        contacto_nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        provincia: '',
        codigo_postal: '',
        sitio_web: '',
        notas: ''
      })
    }
    setMostrarModal(true)
  }

  const handleAltaDesdeListado = (p: ProveedorConFinanzas) => {
    setProveedorTrazado(null)
    resetClienteVinculo()
    setModoEdicion(false)
    setProveedorSeleccionado(null)
    setFormData({
      nombre: p.razon_social?.split(',')[0]?.trim() || p.nombre,
      razon_social: p.razon_social || p.nombre,
      cuit: p.cuit || '',
      condicion_iva: normalizarCondicionIvaCliente(p.condicion_iva) || p.condicion_iva || '',
      contacto_nombre: '',
      telefono: p.telefono || '',
      email: '',
      direccion: '',
      ciudad: '',
      provincia: '',
      codigo_postal: '',
      sitio_web: '',
      notas: p.finanzas.codigo_deuda ? `Código ERP: ${p.finanzas.codigo_deuda}` : ''
    })
    setMostrarModal(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    try {
      if (modoEdicion && proveedorSeleccionado) {
        const response = await apiService.actualizarProveedor(proveedorSeleccionado.id, formData)
        if (response.success) {
          alert('Proveedor actualizado exitosamente')
          setMostrarModal(false)
          loadProveedores()
        } else {
          alert(`Error: ${response.error}`)
        }
      } else {
        const response = await apiService.crearProveedor(formData)
        if (response.success) {
          alert('Proveedor creado exitosamente')
          setMostrarModal(false)
          loadProveedores()
        } else {
          alert(`Error: ${response.error}`)
        }
      }
    } catch (error) {
      console.error('Error guardando proveedor:', error)
      alert('Error al guardar el proveedor')
    }
  }

  const handleVerProductos = async (proveedor: Proveedor) => {
    setProveedorSeleccionado(proveedor)
    await loadProductosProveedor(proveedor.id)
    setMostrarModalProductos(true)
  }

  const handleAbrirModalNuevoProducto = () => {
    if (!proveedorSeleccionado) return
    setFormDataProducto({
      codigo_producto: '',
      descripcion: '',
      unidad: 'unidad',
      precio_unitario: '',
      moneda: 'ARS',
      stock_disponible: '',
      tiempo_entrega_dias: '',
      observaciones: ''
    })
    setProductoCatalogoElegido(null)
    setProductosCatalogoHits([])
    setBusquedaProductoCatalogo('')
    setMostrarModalNuevoProducto(true)
    if (catalogoEmpresa.length === 0) {
      void apiService.getArticulosEmpresa(undefined, false).then((res) => {
        if (res.success && res.data) setCatalogoEmpresa(res.data)
      })
    }
  }

  const aplicarProductoCatalogo = (hit: CatalogoProductoHit) => {
    const origenLabel = hit.origen === 'lista' ? 'lista de precios' : 'stock'
    setProductoCatalogoElegido(hit)
    setProductosCatalogoHits([])
    setBusquedaProductoCatalogo(hit.codigo || hit.nombre)
    setFormDataProducto((prev) => ({
      ...prev,
      codigo_producto: hit.codigo || prev.codigo_producto,
      descripcion: hit.nombre || prev.descripcion,
      unidad: hit.unidad || prev.unidad,
      precio_unitario:
        hit.precio != null && Number.isFinite(hit.precio) ? String(hit.precio) : prev.precio_unitario,
      stock_disponible:
        hit.stock != null && Number.isFinite(hit.stock) ? String(hit.stock) : prev.stock_disponible,
      observaciones: [
        prev.observaciones.trim(),
        `Desde ${origenLabel} #${hit.idRef}${hit.codigo ? ` (${hit.codigo})` : ''}`
      ]
        .filter(Boolean)
        .join('\n')
    }))
  }

  useEffect(() => {
    if (!mostrarModalNuevoProducto) return
    const q = busquedaProductoCatalogo.trim()
    if (q.length < 2 || productoCatalogoElegido) {
      setProductosCatalogoHits([])
      setBuscandoProductoCatalogo(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setBuscandoProductoCatalogo(true)
      void (async () => {
        const qLower = q.toLowerCase()
        const fromLista = catalogoEmpresa
          .filter((a) => {
            const blob = `${a.codigo || ''} ${a.nombre || ''} ${a.descripcion || ''}`.toLowerCase()
            return blob.includes(qLower)
          })
          .slice(0, 8)
          .map(hitDesdeEmpresa)

        const stockRes = await apiService.getArticulosStock(q)
        if (cancelled) return
        const fromStock = (stockRes.success && stockRes.data ? stockRes.data : [])
          .slice(0, 8)
          .map(hitDesdeStock)

        const seen = new Set<string>()
        const merged: CatalogoProductoHit[] = []
        for (const hit of [...fromLista, ...fromStock]) {
          const dedupe = `${hit.codigo}|${hit.nombre}`.toLowerCase()
          if (seen.has(dedupe)) continue
          seen.add(dedupe)
          merged.push(hit)
          if (merged.length >= 10) break
        }
        setProductosCatalogoHits(merged)
        setBuscandoProductoCatalogo(false)
      })()
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    busquedaProductoCatalogo,
    mostrarModalNuevoProducto,
    productoCatalogoElegido,
    catalogoEmpresa
  ])

  const handleGuardarProducto = async () => {
    if (!proveedorSeleccionado || !formDataProducto.descripcion.trim()) {
      alert('La descripción es requerida')
      return
    }

    try {
      const response = await apiService.crearProductoProveedor({
        id_proveedor: proveedorSeleccionado.id,
        codigo_producto: formDataProducto.codigo_producto || undefined,
        descripcion: formDataProducto.descripcion,
        unidad: formDataProducto.unidad,
        precio_unitario: formDataProducto.precio_unitario ? parseFloat(formDataProducto.precio_unitario) : undefined,
        moneda: formDataProducto.moneda,
        stock_disponible: formDataProducto.stock_disponible ? parseFloat(formDataProducto.stock_disponible) : undefined,
        tiempo_entrega_dias: formDataProducto.tiempo_entrega_dias ? parseInt(formDataProducto.tiempo_entrega_dias) : undefined,
        observaciones: formDataProducto.observaciones || undefined
      })

      if (response.success) {
        alert('Producto agregado exitosamente')
        setMostrarModalNuevoProducto(false)
        await loadProductosProveedor(proveedorSeleccionado.id)
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error guardando producto:', error)
      alert('Error al guardar el producto')
    }
  }

  const proveedoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return proveedores.filter((p) => {
      const saldo = saldoCuentaProveedor(p.finanzas)
      const estado = estadoCuentaProveedor(saldo).cls
      if (filtroEstado === 'deuda' && estado !== 'deuda') return false
      if (filtroEstado === 'aldia' && estado !== 'ok') return false
      if (filtroEstado === 'favor' && estado !== 'favor') return false
      if (!q) return true
      const blob = [
        p.nombre,
        p.razon_social,
        p.cuit,
        p.email,
        p.telefono,
        p.finanzas.codigo_deuda,
        p.finanzas.busqueda_texto
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [proveedores, busqueda, filtroEstado])

  const listaOrdenada = useMemo(() => {
    return [...proveedoresFiltrados].sort((a, b) => {
      const sa = saldoCuentaProveedor(a.finanzas)
      const sb = saldoCuentaProveedor(b.finanzas)
      if (sb !== sa) return sb - sa
      return displayNombre(a).localeCompare(displayNombre(b), 'es')
    })
  }, [proveedoresFiltrados])

  useEffect(() => {
    setPagina(1)
  }, [busqueda, filtroEstado])

  const totalPaginas = Math.max(1, Math.ceil(listaOrdenada.length / PAGE_SIZE))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const listaPagina = useMemo(() => {
    const from = (pagina - 1) * PAGE_SIZE
    return listaOrdenada.slice(from, from + PAGE_SIZE)
  }, [listaOrdenada, pagina])

  const totalSaldoDeuda = useMemo(
    () =>
      proveedoresFiltrados.reduce((s, p) => {
        const saldo = saldoCuentaProveedor(p.finanzas)
        return s + (saldo > 0 ? saldo : 0)
      }, 0),
    [proveedoresFiltrados]
  )

  const cuentaGeneral = useMemo(() => {
    let deuda = 0
    let favor = 0
    let nDeuda = 0
    let nOk = 0
    let nFavor = 0
    for (const p of proveedores) {
      const saldo = saldoCuentaProveedor(p.finanzas)
      const cls = estadoCuentaProveedor(saldo).cls
      if (cls === 'deuda') {
        deuda += saldo
        nDeuda += 1
      } else if (cls === 'favor') {
        favor += Math.abs(saldo)
        nFavor += 1
      } else {
        nOk += 1
      }
    }
    const neto = deuda - favor
    const balance =
      Math.abs(neto) < 0.01
        ? ({ cls: 'ok' as const, label: 'Balanceado', frase: 'Cuentas al día en el conjunto' })
        : neto > 0
          ? ({
              cls: 'deuda' as const,
              label: 'Le debemos',
              frase: `Deuda neta ${moneyProveedor(neto)}`
            })
          : ({
              cls: 'favor' as const,
              label: 'A favor',
              frase: `Saldo a favor neto ${moneyProveedor(Math.abs(neto))}`
            })

    const mesNeto = mesMovs.debe - mesMovs.haber
    const mesEstado =
      Math.abs(mesNeto) < 0.01 && mesMovs.facturas + mesMovs.pagos === 0
        ? ({
            cls: 'ok' as const,
            label: 'Sin movimientos',
            frase: 'Todavía no hay facturas ni pagos este mes'
          })
        : Math.abs(mesNeto) < 0.01
          ? ({
              cls: 'ok' as const,
              label: 'Mes equilibrado',
              frase: 'Facturado y pagado quedaron parejos'
            })
          : mesNeto > 0
            ? ({
                cls: 'deuda' as const,
                label: 'Subió la deuda',
                frase: `Este mes la deuda creció ${moneyProveedor(mesNeto)}`
              })
            : ({
                cls: 'favor' as const,
                label: 'Bajamos deuda',
                frase: `Este mes bajamos ${moneyProveedor(Math.abs(mesNeto))}`
              })

    return {
      deuda,
      favor,
      neto,
      nDeuda,
      nOk,
      nFavor,
      total: proveedores.length,
      balance,
      mes: {
        ...etiquetaMesActualAR(),
        ...mesMovs,
        neto: mesNeto,
        estado: mesEstado
      }
    }
  }, [proveedores, mesMovs])

  if (authLoading || loading) {
    return (
      <div className="proveedores-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="proveedores-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="proveedores-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Proveedores</h1>
            <p className="subtitle">
              Ficha, facturas, deudas y pagos en un solo lugar. Buscá por nombre, CUIT o n° de
              factura.
            </p>
            <p className="prov-dir-kicker">
              {proveedores.length} {proveedores.length === 1 ? 'proveedor' : 'proveedores'}
              {totalSaldoDeuda > 0.009
                ? ` · le debemos ${moneyProveedor(totalSaldoDeuda)}`
                : ' · sin deudas abiertas'}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Pedidos
            </button>
            <button className="btn-primary" onClick={() => handleAbrirModal()}>
              + Nuevo proveedor
            </button>
          </div>
        </div>
      </header>

      <section className="prov-cuenta-general" aria-label="Cuenta general de proveedores">
        <div className="prov-cuenta-general__head">
          <div>
            <p className="prov-cuenta-general__eyebrow">Cuenta general</p>
            <h2>Balance de proveedores</h2>
            <p className="prov-cuenta-general__frase">{cuentaGeneral.balance.frase}</p>
          </div>
          <span className={`prov-estado-badge prov-estado-badge--${cuentaGeneral.balance.cls}`}>
            {cuentaGeneral.balance.label}
          </span>
        </div>

        <div className="prov-cuenta-general__kpis">
          <article className="prov-cuenta-general__kpi prov-cuenta-general__kpi--deuda">
            <em>Le debemos</em>
            <b>{moneyProveedor(cuentaGeneral.deuda)}</b>
            <small>
              {cuentaGeneral.nDeuda} proveedor{cuentaGeneral.nDeuda === 1 ? '' : 'es'}
            </small>
          </article>
          <article className="prov-cuenta-general__kpi prov-cuenta-general__kpi--favor">
            <em>A favor nuestro</em>
            <b>{moneyProveedor(cuentaGeneral.favor)}</b>
            <small>
              {cuentaGeneral.nFavor} proveedor{cuentaGeneral.nFavor === 1 ? '' : 'es'}
            </small>
          </article>
          <article className="prov-cuenta-general__kpi prov-cuenta-general__kpi--neto">
            <em>Balance neto</em>
            <b>{moneyProveedor(Math.abs(cuentaGeneral.neto))}</b>
            <small>
              {Math.abs(cuentaGeneral.neto) < 0.01
                ? 'en cero'
                : cuentaGeneral.neto > 0
                  ? 'deuda neta'
                  : 'a favor neto'}
              {' · '}
              {cuentaGeneral.nOk} al día
            </small>
          </article>
          <article
            className={`prov-cuenta-general__kpi prov-cuenta-general__kpi--mes prov-cuenta-general__kpi--mes-${cuentaGeneral.mes.estado.cls}`}
          >
            <em>Estado del mes · {cuentaGeneral.mes.label}</em>
            <b>{cuentaGeneral.mes.estado.label}</b>
            <small>{cuentaGeneral.mes.estado.frase}</small>
          </article>
        </div>

        <div className="prov-cuenta-general__mes">
          <div>
            <span>Facturado del mes</span>
            <strong>{moneyProveedor(cuentaGeneral.mes.debe)}</strong>
            <em>
              {cuentaGeneral.mes.facturas} factura{cuentaGeneral.mes.facturas === 1 ? '' : 's'}
            </em>
          </div>
          <div>
            <span>Pagado del mes</span>
            <strong>{moneyProveedor(cuentaGeneral.mes.haber)}</strong>
            <em>
              {cuentaGeneral.mes.pagos} pago{cuentaGeneral.mes.pagos === 1 ? '' : 's'}
            </em>
          </div>
          <div>
            <span>Resultado del mes</span>
            <strong>
              {cuentaGeneral.mes.neto > 0.009 ? '+' : cuentaGeneral.mes.neto < -0.009 ? '−' : ''}
              {moneyProveedor(Math.abs(cuentaGeneral.mes.neto))}
            </strong>
            <em>
              {cuentaGeneral.total} proveedor{cuentaGeneral.total === 1 ? '' : 'es'} en cartera
            </em>
          </div>
        </div>
      </section>

      <section className="search-section prov-dir-search">
        <input
          type="search"
          placeholder="Buscar proveedor, CUIT, teléfono o n° de factura…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="search-input"
        />
        <div className="prov-dir-chips">
          {(
            [
              ['todos', `Todos (${cuentaGeneral.total})`],
              ['deuda', `Le debemos (${cuentaGeneral.nDeuda})`],
              ['aldia', `Al día (${cuentaGeneral.nOk})`],
              ['favor', `A favor (${cuentaGeneral.nFavor})`]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filtroEstado === key ? 'is-on' : ''}
              onClick={() => setFiltroEstado(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="proveedores-section">
        <div className="prov-table-head">
          <h2>Proveedores ({listaOrdenada.length})</h2>
          {listaOrdenada.length > 0 ? (
            <p className="prov-table-head__meta">
              Página {pagina} de {totalPaginas} · {PAGE_SIZE} por hoja
            </p>
          ) : null}
        </div>

        {listaOrdenada.length === 0 ? (
          <div className="empty-state">
            <p>No hay proveedores para mostrar</p>
            <button className="btn-primary" onClick={() => handleAbrirModal()}>
              Crear Primer Proveedor
            </button>
          </div>
        ) : (
          <>
            <div className="prov-table-wrap">
              <table className="prov-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Proveedor</th>
                    <th>CUIT</th>
                    <th>Teléfono</th>
                    <th className="num">Movimientos</th>
                    <th className="num">Saldo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPagina.map((proveedor) => {
                    const nombre = displayNombre(proveedor)
                    const tel = displayTelefono(proveedor)
                    const saldo = saldoCuentaProveedor(proveedor.finanzas)
                    const estado = estadoCuentaProveedor(saldo)
                    const codigo =
                      proveedor.finanzas.codigo_deuda ||
                      (proveedor.id > 0 ? `P${proveedor.id}` : '—')
                    return (
                      <tr key={`${proveedor.id}-${codigo}`}>
                        <td className="prov-table__codigo">{codigo}</td>
                        <td>
                          <button
                            type="button"
                            className="prov-table__nombre"
                            onClick={() => setProveedorTrazado(proveedor)}
                          >
                            {nombre}
                          </button>
                          {proveedor.es_solo_listado ? (
                            <small className="prov-table__hint">Sin ficha completa</small>
                          ) : proveedor.nombre !== nombre ? (
                            <small className="prov-table__hint">{proveedor.nombre}</small>
                          ) : null}
                        </td>
                        <td>{proveedor.cuit || '—'}</td>
                        <td>{tel || '—'}</td>
                        <td className="num">{proveedor.finanzas.movimientos_count}</td>
                        <td className="num">{moneyProveedor(saldo)}</td>
                        <td>
                          <span className={`prov-estado-badge prov-estado-badge--${estado.cls}`}>
                            {estado.label}
                          </span>
                        </td>
                        <td>
                          <div className="prov-table__acciones">
                            <button
                              type="button"
                              className="btn-edit"
                              onClick={() => setProveedorTrazado(proveedor)}
                            >
                              Ver cuenta
                            </button>
                            <button
                              type="button"
                              className="btn-edit"
                              onClick={() =>
                                proveedor.es_solo_listado
                                  ? handleAltaDesdeListado(proveedor)
                                  : handleAbrirModal(proveedor)
                              }
                            >
                              {proveedor.es_solo_listado ? 'Completar' : 'Editar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <nav className="prov-pager" aria-label="Paginación de proveedores">
              <button
                type="button"
                className="prov-pager__arrow"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                ←
              </button>
              <span className="prov-pager__info">
                {pagina} / {totalPaginas}
              </span>
              <button
                type="button"
                className="prov-pager__arrow"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                aria-label="Página siguiente"
              >
                →
              </button>
            </nav>
          </>
        )}
      </section>

      {proveedorTrazado && (
        <div className="prov-trazado-overlay">
          <ProveedorFinanzasHub
            mode="embedded"
            idProveedor={proveedorTrazado.id > 0 ? proveedorTrazado.id : undefined}
            proveedorNombre={displayNombre(proveedorTrazado)}
            saldoListado={saldoCuentaProveedor(proveedorTrazado.finanzas)}
            onChanged={() => {
              void loadProveedores().then(() => {
                /* listado se refresca; el panel ya tiene el movimiento */
              })
            }}
            onClose={() => setProveedorTrazado(null)}
            onEditar={() => {
              if (proveedorTrazado.es_solo_listado) {
                handleAltaDesdeListado(proveedorTrazado)
              } else {
                handleAbrirModal(proveedorTrazado)
              }
            }}
            onProductos={
              proveedorTrazado.id > 0 && !proveedorTrazado.es_solo_listado
                ? () => {
                    void handleVerProductos(proveedorTrazado)
                    setProveedorTrazado(null)
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Modal de Crear/Editar Proveedor */}
      {mostrarModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMostrarModal(false)
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setMostrarModal(false)
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modoEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button className="btn-close" onClick={() => setMostrarModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group prov-cliente-lookup">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => {
                    setClienteVinculado(null)
                    setClienteCcOk(null)
                    setFormData({ ...formData, nombre: e.target.value })
                  }}
                  placeholder="Escribí para buscar en clientes…"
                  autoComplete="off"
                />
                <p className="prov-cliente-lookup__hint">
                  Buscá del listado de clientes: se completa CUIT y datos. Si tiene cuenta corriente,
                  después se puede compensar / descontar desde CC.
                </p>
                {buscandoClientes ? (
                  <p className="prov-cliente-lookup__status">Buscando clientes…</p>
                ) : null}
                {clientesSugeridos.length > 0 ? (
                  <ul className="prov-cliente-lookup__list" role="listbox">
                    {clientesSugeridos.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => void aplicarClienteComoProveedor(c)}
                        >
                          <strong>{nombreCompletoCliente(c)}</strong>
                          <span>
                            {[c.empresa, c.dni_cuit ? `CUIT ${c.dni_cuit}` : null, c.telefono]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {clienteVinculado ? (
                  <div
                    className={`prov-cliente-lookup__badge${clienteCcOk ? ' is-cc' : ''}`}
                  >
                    {clienteCcOk
                      ? `Vinculado a cliente #${clienteVinculado.id} con cuenta corriente — se podrá compensar por CUIT.`
                      : `Datos tomados del cliente #${clienteVinculado.id}${
                          clienteCcOk === false
                            ? ' (sin CC habilitada; igual sirve el CUIT si la dan de alta después).'
                            : ''
                        }`}
                    <button
                      type="button"
                      className="prov-cliente-lookup__clear"
                      onClick={() => resetClienteVinculo()}
                    >
                      Quitar vínculo
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Razón Social</label>
                  <input
                    type="text"
                    value={formData.razon_social}
                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                    placeholder="Razón social"
                  />
                </div>
                <div className="form-group">
                  <label>CUIT</label>
                  <input
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => {
                      const cuit = e.target.value
                      const ivaAuto =
                        formData.condicion_iva ||
                        (cuit.replace(/\D/g, '').length >= 11 ? inferirCondicionIva(cuit) : '')
                      setFormData({
                        ...formData,
                        cuit,
                        condicion_iva: formData.condicion_iva || ivaAuto
                      })
                    }}
                    placeholder="20-12345678-9"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Condición de IVA</label>
                <select
                  value={formData.condicion_iva}
                  onChange={(e) => setFormData({ ...formData, condicion_iva: e.target.value })}
                >
                  <option value="">Seleccionar…</option>
                  {CONDICIONES_IVA_CLIENTE.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Contacto</label>
                  <input
                    type="text"
                    value={formData.contacto_nombre}
                    onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                    placeholder="Nombre del contacto"
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="proveedor@ejemplo.com"
                />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Calle y número"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Ciudad</label>
                  <input
                    type="text"
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    placeholder="Ciudad"
                  />
                </div>
                <div className="form-group">
                  <label>Provincia</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    placeholder="Provincia"
                  />
                </div>
                <div className="form-group">
                  <label>Código Postal</label>
                  <input
                    type="text"
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                    placeholder="CP"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Sitio Web</label>
                <input
                  type="url"
                  value={formData.sitio_web}
                  onChange={(e) => setFormData({ ...formData, sitio_web: e.target.value })}
                  placeholder="https://www.ejemplo.com"
                />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Notas adicionales sobre el proveedor"
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardar}>
                {modoEdicion ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Productos del Proveedor */}
      {mostrarModalProductos && proveedorSeleccionado && (
        <div className="modal-overlay" onClick={() => { setMostrarModalProductos(false); setProveedorSeleccionado(null) }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Productos de {proveedorSeleccionado.nombre}</h2>
              <div className="modal-header-actions">
                <button className="btn-action" onClick={handleAbrirModalNuevoProducto}>
                  + Agregar Producto
                </button>
                <button className="btn-close" onClick={() => { setMostrarModalProductos(false); setProveedorSeleccionado(null) }}>×</button>
              </div>
            </div>
            <div className="modal-body">
              {productosProveedor.length === 0 ? (
                <div className="empty-state">
                  <p>No hay productos registrados para este proveedor</p>
                  <button className="btn-primary" onClick={handleAbrirModalNuevoProducto}>
                    Agregar Primer Producto
                  </button>
                </div>
              ) : (
                <div className="productos-list">
                  {productosProveedor.map((producto) => (
                    <div key={producto.id} className="producto-item">
                      <div className="producto-info">
                        <strong>{producto.descripcion}</strong>
                        {producto.codigo_producto && <span className="codigo">Código: {producto.codigo_producto}</span>}
                        <div className="producto-details">
                          <span>Precio: ${producto.precio_unitario?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || 'N/A'}</span>
                          <span>Unidad: {producto.unidad}</span>
                          {producto.stock_disponible !== null && <span>Stock: {producto.stock_disponible}</span>}
                          {producto.tiempo_entrega_dias && <span>Tiempo entrega: {producto.tiempo_entrega_dias} días</span>}
                        </div>
                        {producto.observaciones && (
                          <div className="producto-observaciones">
                            <em>{producto.observaciones}</em>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nuevo Producto */}
      {mostrarModalNuevoProducto && proveedorSeleccionado && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMostrarModalNuevoProducto(false)
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setMostrarModalNuevoProducto(false)
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Agregar Producto a {proveedorSeleccionado.nombre}</h2>
              <button className="btn-close" onClick={() => setMostrarModalNuevoProducto(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group prov-prod-lookup">
                <label>Buscar en nuestros productos</label>
                <input
                  type="search"
                  value={busquedaProductoCatalogo}
                  onChange={(e) => {
                    setProductoCatalogoElegido(null)
                    setBusquedaProductoCatalogo(e.target.value)
                    setFormDataProducto((prev) => ({
                      ...prev,
                      codigo_producto: e.target.value
                    }))
                  }}
                  placeholder="Código o nombre de lista de precios / stock…"
                  autoComplete="off"
                />
                <p className="prov-prod-lookup__hint">
                  Elegí un artículo existente o seguí escribiendo y completá abajo para agregar uno
                  nuevo al proveedor.
                </p>
                {buscandoProductoCatalogo ? (
                  <p className="prov-prod-lookup__status">Buscando en catálogo…</p>
                ) : null}
                {productosCatalogoHits.length > 0 ? (
                  <ul className="prov-prod-lookup__list" role="listbox">
                    {productosCatalogoHits.map((hit) => (
                      <li key={hit.key}>
                        <button type="button" onClick={() => aplicarProductoCatalogo(hit)}>
                          <strong>
                            {hit.codigo ? `${hit.codigo} · ` : ''}
                            {hit.nombre}
                          </strong>
                          <span>
                            {hit.origen === 'lista' ? 'Lista de precios' : 'Stock'}
                            {hit.precio != null ? ` · ${moneyProveedor(hit.precio)}` : ''}
                            {hit.stock != null ? ` · stock ${hit.stock}` : ''}
                            {` · ${hit.unidad}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {productoCatalogoElegido ? (
                  <div className="prov-prod-lookup__badge">
                    Tomado de {productoCatalogoElegido.origen === 'lista' ? 'lista de precios' : 'stock'} #
                    {productoCatalogoElegido.idRef}
                    <button
                      type="button"
                      className="prov-prod-lookup__clear"
                      onClick={() => {
                        setProductoCatalogoElegido(null)
                        setBusquedaProductoCatalogo('')
                      }}
                    >
                      Seguir como nuevo
                    </button>
                  </div>
                ) : busquedaProductoCatalogo.trim().length >= 2 &&
                  !buscandoProductoCatalogo &&
                  productosCatalogoHits.length === 0 ? (
                  <p className="prov-prod-lookup__status">
                    Sin coincidencias en catálogo — se agregará como producto nuevo del proveedor.
                  </p>
                ) : null}
              </div>
              <div className="form-group">
                <label>Código del Producto</label>
                <input
                  type="text"
                  value={formDataProducto.codigo_producto}
                  onChange={(e) => {
                    setProductoCatalogoElegido(null)
                    setFormDataProducto({ ...formDataProducto, codigo_producto: e.target.value })
                    setBusquedaProductoCatalogo(e.target.value)
                  }}
                  placeholder="Código interno del producto"
                />
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <input
                  type="text"
                  value={formDataProducto.descripcion}
                  onChange={(e) => setFormDataProducto({ ...formDataProducto, descripcion: e.target.value })}
                  placeholder="Descripción del producto"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Unidad</label>
                  <select
                    value={formDataProducto.unidad}
                    onChange={(e) => setFormDataProducto({ ...formDataProducto, unidad: e.target.value })}
                  >
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kilogramo</option>
                    <option value="m">Metro</option>
                    <option value="m2">Metro cuadrado</option>
                    <option value="m3">Metro cúbico</option>
                    <option value="l">Litro</option>
                    <option value="caja">Caja</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Precio Unitario</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataProducto.precio_unitario}
                    onChange={(e) => setFormDataProducto({ ...formDataProducto, precio_unitario: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select
                    value={formDataProducto.moneda}
                    onChange={(e) => setFormDataProducto({ ...formDataProducto, moneda: e.target.value })}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Stock Disponible</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formDataProducto.stock_disponible}
                    onChange={(e) => setFormDataProducto({ ...formDataProducto, stock_disponible: e.target.value })}
                    placeholder="Cantidad disponible"
                  />
                </div>
                <div className="form-group">
                  <label>Tiempo de Entrega (días)</label>
                  <input
                    type="number"
                    value={formDataProducto.tiempo_entrega_dias}
                    onChange={(e) => setFormDataProducto({ ...formDataProducto, tiempo_entrega_dias: e.target.value })}
                    placeholder="Días"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formDataProducto.observaciones}
                  onChange={(e) => setFormDataProducto({ ...formDataProducto, observaciones: e.target.value })}
                  placeholder="Notas adicionales sobre el producto"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalNuevoProducto(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardarProducto}>
                Guardar Producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProveedoresPage

