import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ProveedorConFinanzas } from '../types/api'
import type { Proveedor, ProveedorProducto } from '../types/pedidos'
import ProveedorFinanzasHub from '../components/compras/ProveedorFinanzasHub'
import './ProveedoresPage.css'

type PipelineKey = 'maestro' | 'deuda' | 'favor' | 'listado'

const PIPELINE_COLS: Array<{ key: PipelineKey; label: string; color: string }> = [
  { key: 'maestro', label: 'En maestro', color: '#64748b' },
  { key: 'deuda', label: 'Con deuda', color: '#f59e0b' },
  { key: 'favor', label: 'Saldo a favor', color: '#22c55e' },
  { key: 'listado', label: 'Solo listado ERP', color: '#a78bfa' }
]

function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function displayNombre(p: ProveedorConFinanzas): string {
  return p.razon_social || p.nombre
}

function displayTelefono(p: ProveedorConFinanzas): string | null {
  const t = p.telefono?.trim()
  if (!t || t === '-') return null
  return t
}

function pipelineKey(p: ProveedorConFinanzas): PipelineKey {
  if (p.es_solo_listado) return 'listado'
  const saldo = p.finanzas.saldo_listado
  if (saldo == null || saldo === 0) return 'maestro'
  if (saldo > 0) return 'deuda'
  return 'favor'
}

function saldoClass(saldo: number | null | undefined): string {
  if (saldo == null || saldo === 0) return 'prov-pipeline-card__saldo--cero'
  return saldo > 0 ? 'prov-pipeline-card__saldo--deuda' : 'prov-pipeline-card__saldo--favor'
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
      const response = await apiService.getProveedoresConFinanzas()
      if (response.success && response.data) {
        setProveedores(response.data)
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

  const handleAbrirModal = (proveedor?: Proveedor | ProveedorConFinanzas) => {
    if (proveedor) {
      setModoEdicion(true)
      setProveedorSeleccionado(proveedor.id > 0 ? (proveedor as Proveedor) : null)
      setFormData({
        nombre: proveedor.nombre,
        razon_social: proveedor.razon_social || '',
        cuit: proveedor.cuit || '',
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
    setModoEdicion(false)
    setProveedorSeleccionado(null)
    setFormData({
      nombre: p.razon_social?.split(',')[0]?.trim() || p.nombre,
      razon_social: p.razon_social || p.nombre,
      cuit: '',
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
    setMostrarModalNuevoProducto(true)
  }

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
    if (!q) return proveedores
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.razon_social && p.razon_social.toLowerCase().includes(q)) ||
        (p.cuit && p.cuit.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q)) ||
        (p.finanzas.codigo_deuda && p.finanzas.codigo_deuda.includes(q))
    )
  }, [proveedores, busqueda])

  const pipeline = useMemo(() => {
    const cols: Record<PipelineKey, ProveedorConFinanzas[]> = {
      maestro: [],
      deuda: [],
      favor: [],
      listado: []
    }
    for (const p of proveedoresFiltrados) {
      cols[pipelineKey(p)].push(p)
    }
    const bySaldoDesc = (a: ProveedorConFinanzas, b: ProveedorConFinanzas) =>
      Math.abs(b.finanzas.saldo_listado ?? 0) - Math.abs(a.finanzas.saldo_listado ?? 0)
    cols.deuda.sort(bySaldoDesc)
    cols.favor.sort(bySaldoDesc)
    return cols
  }, [proveedoresFiltrados])

  const totalSaldoDeuda = useMemo(
    () =>
      proveedoresFiltrados.reduce(
        (s, p) => s + (p.finanzas.saldo_listado && p.finanzas.saldo_listado > 0 ? p.finanzas.saldo_listado : 0),
        0
      ),
    [proveedoresFiltrados]
  )

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
            <h1>🏢 Gestión de Proveedores</h1>
            <p className="subtitle">
              {proveedores.length} proveedores · deuda activa {money(totalSaldoDeuda)}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/compras/deudas-proveedores')}>
              💳 Deudas
            </button>
            <button className="btn-secondary" onClick={() => navigate('/compras/deuda-cc-proveedores')}>
            📑 Deuda CC
          </button>
          <button className="btn-secondary" onClick={() => navigate('/compras/movimientos-proveedores')}>
              📒 Movimientos
            </button>
            <button className="btn-secondary" onClick={() => navigate('/compras/pagos-proveedores')}>
              💸 Pagos
            </button>
            <button className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Volver
            </button>
            <button className="btn-primary" onClick={() => handleAbrirModal()}>
              + Nuevo Proveedor
            </button>
          </div>
        </div>
      </header>

      <section className="search-section">
        <input
          type="text"
          placeholder="Buscar razón social, nombre, CUIT, teléfono o código ERP…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="search-input"
        />
      </section>

      <section className="proveedores-section">
        {proveedoresFiltrados.length === 0 ? (
          <div className="empty-state">
            <p>No hay proveedores para mostrar</p>
            <button className="btn-primary" onClick={() => handleAbrirModal()}>
              Crear Primer Proveedor
            </button>
          </div>
        ) : (
          <div className="prov-pipeline">
            {PIPELINE_COLS.map((col) => {
              const items = pipeline[col.key]
              const colTotal = items.reduce((s, p) => s + (p.finanzas.saldo_listado ?? 0), 0)
              return (
                <section key={col.key} className="prov-pipeline__col">
                  <header className="prov-pipeline__col-head">
                    <span className="prov-pipeline__dot" style={{ background: col.color }} />
                    <h3>{col.label}</h3>
                    <span className="prov-pipeline__count">{items.length}</span>
                    {col.key === 'deuda' || col.key === 'favor' ? (
                      <span className="prov-pipeline__total">{money(colTotal)}</span>
                    ) : (
                      <span className="prov-pipeline__total prov-pipeline__total--muted">—</span>
                    )}
                  </header>
                  <div className="prov-pipeline__cards">
                    {items.length === 0 ? (
                      <p className="prov-pipeline__empty">Sin proveedores</p>
                    ) : (
                      items.map((proveedor) => {
                        const nombre = displayNombre(proveedor)
                        const tel = displayTelefono(proveedor)
                        const saldo = proveedor.finanzas.saldo_listado
                        return (
                          <article key={proveedor.id} className="prov-pipeline-card">
                            <button
                              type="button"
                              className="prov-pipeline-card__name"
                              onClick={() => setProveedorTrazado(proveedor)}
                            >
                              {nombre}
                            </button>
                            {proveedor.finanzas.codigo_deuda && (
                              <span className="prov-pipeline-card__codigo">
                                #{proveedor.finanzas.codigo_deuda}
                              </span>
                            )}
                            {saldo != null && (
                              <div className={`prov-pipeline-card__saldo ${saldoClass(saldo)}`}>
                                {money(saldo)}
                              </div>
                            )}
                            {tel && <div className="prov-pipeline-card__tel">📞 {tel}</div>}
                            {!proveedor.es_solo_listado && proveedor.nombre !== nombre && (
                              <div className="prov-pipeline-card__alias">{proveedor.nombre}</div>
                            )}
                            {proveedor.es_solo_listado && (
                              <span className="prov-pipeline-card__badge">Migrado desde deudas</span>
                            )}
                          </article>
                        )
                      })
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </section>

      {proveedorTrazado && (
        <div className="prov-trazado-overlay">
          <ProveedorFinanzasHub
            mode="embedded"
            idProveedor={proveedorTrazado.id > 0 ? proveedorTrazado.id : undefined}
            proveedorNombre={displayNombre(proveedorTrazado)}
            saldoListado={proveedorTrazado.finanzas.saldo_listado}
            codigoDeuda={proveedorTrazado.finanzas.codigo_deuda}
            movimientosCount={proveedorTrazado.finanzas.movimientos_count}
            pagosCount={proveedorTrazado.finanzas.pagos_count}
            deudaCcCount={proveedorTrazado.finanzas.deuda_cc_count}
            onClose={() => setProveedorTrazado(null)}
            onEditar={() => {
              if (proveedorTrazado.es_solo_listado) {
                handleAltaDesdeListado(proveedorTrazado)
              } else {
                handleAbrirModal(proveedorTrazado)
              }
            }}
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
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
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
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    placeholder="20-12345678-9"
                  />
                </div>
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
              <div className="form-group">
                <label>Código del Producto</label>
                <input
                  type="text"
                  value={formDataProducto.codigo_producto}
                  onChange={(e) => setFormDataProducto({ ...formDataProducto, codigo_producto: e.target.value })}
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

