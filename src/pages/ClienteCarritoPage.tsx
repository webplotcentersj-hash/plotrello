import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import { cantidadMaximaVendible } from '../services/commerceCatalogService'
import type { CarritoClientePayload } from '../services/commerceCartService'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClienteCarritoPage.css'

export default function ClienteCarritoPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [carrito, setCarrito] = useState<CarritoClientePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!cliente) return
    setLoading(true)
    setError('')
    const r = await apiService.getCarritoCliente(cliente.id)
    if (r.success && r.data) {
      setCarrito(r.data)
    } else {
      setError(r.error || 'No se pudo cargar el carrito')
    }
    setLoading(false)
  }, [cliente])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    void load()
  }, [cliente, authLoading, navigate, load])

  const setCantidad = async (idArticulo: number, cantidad: number) => {
    if (!cliente) return
    setBusyId(idArticulo)
    setError('')
    const r = await apiService.setCarritoItemCliente(cliente.id, idArticulo, cantidad)
    if (r.success && r.data) {
      setCarrito(r.data)
    } else {
      setError(r.error || 'No se pudo actualizar')
    }
    setBusyId(null)
  }

  const vaciar = async () => {
    if (!cliente || !confirm('¿Vaciar el carrito?')) return
    const r = await apiService.vaciarCarritoCliente(cliente.id)
    if (r.success) await load()
    else setError(r.error || 'Error al vaciar')
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  const items = carrito?.items ?? []

  return (
    <ClientePageLayout className="cliente-carrito-page">
      <ClientePageHeader
        eyebrow="Compra"
        title="Mi carrito"
        subtitle={`${carrito?.cantidad_items ?? 0} artículo${(carrito?.cantidad_items ?? 0) !== 1 ? 's' : ''}`}
        actions={
          <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/catalogo')}>
            Seguir comprando
          </button>
        }
      />

        {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

        {items.length === 0 ? (
          <div className="cliente-page-empty">
            <p>Tu carrito está vacío.</p>
            <button type="button" className="cliente-btn-primary" onClick={() => navigate('/cliente/catalogo')}>
              Ver catálogo
            </button>
          </div>
        ) : (
          <>
            <ul className="cliente-carrito-list">
              {items.map((it) => {
                const max = cantidadMaximaVendible(it.articulo)
                return (
                  <li key={it.id} className="cliente-page-card cliente-carrito-row">
                    <div className="cliente-carrito-row__info">
                      <strong>{it.articulo.nombre}</strong>
                      <span>${it.precio_unitario.toFixed(2)} c/u</span>
                      {max != null && (
                        <span className="cliente-carrito-row__stock">
                          {max === 0 ? 'Sin stock' : `Máx. ${max} u.`}
                        </span>
                      )}
                    </div>
                    <div className="cliente-carrito-row__actions">
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={busyId === it.id_articulo || it.cantidad <= 1}
                        onClick={() => void setCantidad(it.id_articulo, it.cantidad - 1)}
                      >
                        −
                      </button>
                      <span>{it.cantidad}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={busyId === it.id_articulo || (max != null && it.cantidad >= max)}
                        onClick={() => void setCantidad(it.id_articulo, it.cantidad + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="qty-btn qty-btn--remove"
                        disabled={busyId === it.id_articulo}
                        onClick={() => void setCantidad(it.id_articulo, 0)}
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                    <div className="cliente-carrito-row__total">${it.precio_total.toFixed(2)}</div>
                  </li>
                )
              })}
            </ul>

            <footer className="cliente-carrito-foot">
              <div>
                <span>{carrito?.cantidad_items ?? 0} unidades</span>
                <strong>Total: ${(carrito?.total ?? 0).toFixed(2)}</strong>
              </div>
              <div className="cliente-carrito-foot__actions">
                <button type="button" className="cliente-btn-outline" onClick={() => void vaciar()}>
                  Vaciar
                </button>
                <button
                  type="button"
                  className="cliente-btn-primary"
                  onClick={() => navigate('/cliente/checkout')}
                >
                  Continuar al checkout
                </button>
              </div>
            </footer>
          </>
        )}
    </ClientePageLayout>
  )
}
