import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import {
  articuloPermiteCompra,
  articuloPermiteCotizacion
} from '../services/commerceCatalogService'
import type { CarritoClientePayload } from '../services/commerceCartService'
import type { TipoIntencionPedido } from '../types/api'
import './ClienteCheckoutPage.css'

export default function ClienteCheckoutPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [carrito, setCarrito] = useState<CarritoClientePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tipoIntencion, setTipoIntencion] = useState<TipoIntencionPedido>('compra')
  const [fechaLimite, setFechaLimite] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [esUrgente, setEsUrgente] = useState(false)
  const [requiereDelivery, setRequiereDelivery] = useState(false)
  const [direccionDelivery, setDireccionDelivery] = useState('')

  const load = useCallback(async () => {
    if (!cliente) return
    setLoading(true)
    const r = await apiService.getCarritoCliente(cliente.id)
    if (r.success && r.data) {
      setCarrito(r.data)
      if (r.data.items.length === 0) {
        navigate('/cliente/carrito', { replace: true })
      }
    } else {
      setError(r.error || 'Error al cargar carrito')
    }
    setLoading(false)
  }, [cliente, navigate])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    void load()
  }, [cliente, authLoading, navigate, load])

  const validarIntencion = (): string | null => {
    const items = carrito?.items ?? []
    if (tipoIntencion === 'compra') {
      const bloqueados = items.filter((it) => !articuloPermiteCompra(it.articulo))
      if (bloqueados.length) {
        return `Estos productos solo admiten cotización: ${bloqueados.map((b) => b.articulo.nombre).join(', ')}`
      }
    } else {
      const bloqueados = items.filter((it) => !articuloPermiteCotizacion(it.articulo))
      if (bloqueados.length) {
        return `Estos productos solo admiten compra directa: ${bloqueados.map((b) => b.articulo.nombre).join(', ')}`
      }
    }
    if (requiereDelivery && !direccionDelivery.trim()) {
      return 'Indicá la dirección de delivery'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return
    const v = validarIntencion()
    if (v) {
      setError(v)
      return
    }

    setSaving(true)
    setError('')
    const resp = await apiService.crearPedidoDesdeCarritoCliente({
      id_cliente: cliente.id,
      tipo_intencion: tipoIntencion,
      fecha_limite_deseada: fechaLimite || undefined,
      observaciones_cliente: observaciones.trim() || undefined,
      es_urgente: esUrgente,
      requiere_delivery: requiereDelivery,
      direccion_delivery: direccionDelivery.trim() || undefined
    })

    setSaving(false)
    if (resp.success && resp.data) {
      navigate(`/cliente/pedido/${resp.data.id}`)
      return
    }
    setError(resp.error || 'No se pudo confirmar el pedido')
  }

  if (authLoading || loading) {
    return (
      <div className="cliente-checkout-page">
        <div className="cliente-checkout-loading">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-checkout-page">
      <header className="cliente-checkout-header">
        <div className="cliente-checkout-header__inner">
          <button type="button" className="btn-secondary" onClick={() => navigate('/cliente/carrito')}>
            ← Carrito
          </button>
          <h1>Checkout</h1>
        </div>
      </header>

      <main className="cliente-checkout-main">
        {error && <div className="cliente-checkout-error">{error}</div>}

        <section className="cliente-checkout-resumen">
          <h2>Resumen ({carrito?.cantidad_items ?? 0} u.)</h2>
          <ul>
            {(carrito?.items ?? []).map((it) => (
              <li key={it.id}>
                <span>
                  {it.articulo.nombre} × {it.cantidad}
                </span>
                <span>${it.precio_total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="cliente-checkout-total">Total: ${(carrito?.total ?? 0).toFixed(2)}</p>
        </section>

        <form className="cliente-checkout-form" onSubmit={handleSubmit}>
          <fieldset className="cliente-checkout-intent">
            <legend>¿Qué querés hacer?</legend>
            <label className={`intent-card ${tipoIntencion === 'compra' ? 'active' : ''}`}>
              <input
                type="radio"
                name="intencion"
                value="compra"
                checked={tipoIntencion === 'compra'}
                onChange={() => setTipoIntencion('compra')}
              />
              <div>
                <strong>Comprar ahora</strong>
                <p>Pedido con precios del catálogo. Se reserva stock si aplica.</p>
              </div>
            </label>
            <label className={`intent-card ${tipoIntencion === 'cotizacion' ? 'active' : ''}`}>
              <input
                type="radio"
                name="intencion"
                value="cotizacion"
                checked={tipoIntencion === 'cotizacion'}
                onChange={() => setTipoIntencion('cotizacion')}
              />
              <div>
                <strong>Solicitar cotización</strong>
                <p>Mostrador te contactará con precio final. No se descuenta stock.</p>
              </div>
            </label>
          </fieldset>

          <div className="form-group">
            <label>Fecha límite deseada (opcional)</label>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Observaciones</label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles del pedido…"
            />
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={esUrgente} onChange={(e) => setEsUrgente(e.target.checked)} />
            <span>Pedido urgente</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={requiereDelivery}
              onChange={(e) => setRequiereDelivery(e.target.checked)}
            />
            <span>Requiere delivery</span>
          </label>

          {requiereDelivery && (
            <div className="form-group">
              <label>Dirección de delivery</label>
              <input
                type="text"
                value={direccionDelivery}
                onChange={(e) => setDireccionDelivery(e.target.value)}
                required
              />
            </div>
          )}

          <p className="cliente-checkout-note">
            ¿Proyecto con diseño a medida?{' '}
            <button type="button" className="link-btn" onClick={() => navigate('/cliente/nuevo-pedido')}>
              Pedido avanzado con brief
            </button>
          </p>

          <button type="submit" className="btn-primary btn-submit" disabled={saving}>
            {saving
              ? 'Enviando…'
              : tipoIntencion === 'compra'
                ? 'Confirmar compra'
                : 'Enviar solicitud de cotización'}
          </button>
        </form>
      </main>
    </div>
  )
}
