import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ProveedorConFinanzas } from '../types/api'
import type { Proveedor, ProveedorProducto } from '../types/pedidos'
import ProveedorFinanzasHub from '../components/compras/ProveedorFinanzasHub'
import {
  estadoCuentaProveedor,
  inicialesProveedor,
  moneyProveedor,
  saldoCuentaProveedor
} from '../utils/proveedorCuenta'
import './ProveedoresPage.css'

function displayNombre(p: ProveedorConFinanzas): string {
  return p.razon_social || p.nombre
}

function displayTelefono(p: ProveedorConFinanzas): string | null {
  const t = p.telefono?.trim()
  if (!t || t === '-') return null
  return t
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
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'deuda' | 'aldia' | 'favor'>('todos')

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

  const totalSaldoDeuda = useMemo(
    () =>
      proveedoresFiltrados.reduce((s, p) => {
        const saldo = saldoCuentaProveedor(p.finanzas)
        return s + (saldo > 0 ? saldo : 0)
      }, 0),
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
              ['todos', 'Todos'],
              ['deuda', 'Le debemos'],
              ['aldia', 'Al día'],
              ['favor', 'A favor']
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
        {proveedoresFiltrados.length === 0 ? (
          <div className="empty-state">
            <p>No hay proveedores para mostrar</p>
            <button className="btn-primary" onClick={() => handleAbrirModal()}>
              Crear Primer Proveedor
            </button>
          </div>
        ) : (
          <ul className="prov-dir">
            {listaOrdenada.map((proveedor) => {
              const nombre = displayNombre(proveedor)
              const tel = displayTelefono(proveedor)
              const estado = estadoCuentaProveedor(saldoCuentaProveedor(proveedor.finanzas))
              return (
                <li key={proveedor.id}>
                  <article className="prov-dir-card">
                    <button
                      type="button"
                      className="prov-dir-card__main"
                      onClick={() => setProveedorTrazado(proveedor)}
                    >
                      <span className="prov-dir-card__avatar" aria-hidden>
                        {inicialesProveedor(nombre)}
                      </span>
                      <span className="prov-dir-card__copy">
                      <strong>{nombre}</strong>
                      {proveedor.es_solo_listado ? (
                        <span className="prov-dir-card__meta">Todavía no tiene ficha completa</span>
                      ) : proveedor.nombre !== nombre ? (
                        <span className="prov-dir-card__meta">{proveedor.nombre}</span>
                      ) : proveedor.cuit ? (
                        <span className="prov-dir-card__meta">CUIT {proveedor.cuit}</span>
                      ) : tel ? (
                        <span className="prov-dir-card__meta">{tel}</span>
                      ) : (
                        <span className="prov-dir-card__meta">
                          {proveedor.finanzas.movimientos_count} movimiento
                          {proveedor.finanzas.movimientos_count === 1 ? '' : 's'}
                        </span>
                      )}
                      </span>
                    </button>
                    <div className={`prov-dir-card__estado prov-dir-card__estado--${estado.cls}`}>
                      <span>{estado.label}</span>
                      <strong>{estado.detalle}</strong>
                    </div>
                    <div className="prov-dir-card__acciones">
                      <button type="button" className="btn-secondary" onClick={() => setProveedorTrazado(proveedor)}>
                        Ver cuenta
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          proveedor.es_solo_listado
                            ? handleAltaDesdeListado(proveedor)
                            : handleAbrirModal(proveedor)
                        }
                      >
                        {proveedor.es_solo_listado ? 'Completar ficha' : 'Editar'}
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
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

