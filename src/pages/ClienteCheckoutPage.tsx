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
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import MercadoPagoCheckoutPanel from '../components/payments/MercadoPagoCheckoutPanel'
import './ClienteCheckoutPage.css'

type Step = 'form' | 'pay' | 'done'

export default function ClienteCheckoutPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [carrito, setCarrito] = useState<CarritoClientePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pedidoId, setPedidoId] = useState<number | null>(null)
  const [mpPaymentId, setMpPaymentId] = useState<string | null>(null)

  const [tipoIntencion, setTipoIntencion] = useState<TipoIntencionPedido>('compra')
  const [fechaLimite, setFechaLimite] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [esUrgente, setEsUrgente] = useState(false)
  const [requiereDelivery, setRequiereDelivery] = useState(false)
  const [direccionDelivery, setDireccionDelivery] = useState('')

  const [checkoutPayload, setCheckoutPayload] = useState<Record<string, unknown> | null>(null)

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

  const buildPortalPayload = (): Record<string, unknown> | null => {
    if (!cliente || !carrito) return null
    return {
      id_cliente: cliente.id,
      tipo_intencion: tipoIntencion,
      amount: carrito.total,
      fecha_limite_deseada: fechaLimite || null,
      observaciones_cliente: observaciones.trim() || null,
      es_urgente: esUrgente,
      requiere_delivery: requiereDelivery,
      direccion_delivery: direccionDelivery.trim() || null,
      items: carrito.items.map((it) => ({
        id_articulo: it.id_articulo,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        precio_total: it.precio_total
      }))
    }
  }

  const handleSubmitCotizacion = async (e: React.FormEvent) => {
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
      tipo_intencion: 'cotizacion',
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

  const handleSubmitCompra = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return
    const v = validarIntencion()
    if (v) {
      setError(v)
      return
    }
    const payload = buildPortalPayload()
    if (!payload) {
      setError('No se pudo preparar el checkout.')
      return
    }
    if ((carrito?.total ?? 0) < 1) {
      setError('El total debe ser al menos $1 para pagar con Mercado Pago.')
      return
    }
    setCheckoutPayload(payload)
    setStep('pay')
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  if (step === 'pay' && checkoutPayload) {
    return (
      <ClientePageLayout className="cliente-checkout-page">
        <ClientePageHeader
          eyebrow="Compra"
          title="Pagar con Mercado Pago"
          subtitle="Confirmá el pago para registrar tu pedido"
          actions={
            <button type="button" className="cliente-btn-outline" onClick={() => setStep('form')}>
              ← Volver
            </button>
          }
        />
        <MercadoPagoCheckoutPanel
          tipo="pedido_portal"
          payload={checkoutPayload}
          amountHint={carrito?.total ?? null}
          title="Completar compra"
          note="Al aprobarse el pago creamos tu pedido y lo enviamos a mostrador. El carrito se vacía automáticamente."
          onPaid={({ pedidoId: pid, mpPaymentId: payId }) => {
            setPedidoId(pid ?? null)
            setMpPaymentId(payId)
            setStep('done')
          }}
        />
      </ClientePageLayout>
    )
  }

  if (step === 'done') {
    return (
      <ClientePageLayout className="cliente-checkout-page">
        <ClientePageHeader eyebrow="Compra" title="Pago confirmado" subtitle="Tu pedido fue registrado" />
        <section className="cliente-page-card">
          <p>¡Gracias! Tu compra quedó registrada.</p>
          {mpPaymentId ? <p className="cliente-checkout-mp-id">Mercado Pago — Pago: {mpPaymentId}</p> : null}
          {pedidoId ? (
            <button
              type="button"
              className="cliente-btn-primary"
              onClick={() => navigate(`/cliente/pedido/${pedidoId}`)}
            >
              Ver pedido #{pedidoId}
            </button>
          ) : (
            <button type="button" className="cliente-btn-primary" onClick={() => navigate('/cliente/pedidos')}>
              Ver mis pedidos
            </button>
          )}
        </section>
      </ClientePageLayout>
    )
  }

  return (
    <ClientePageLayout className="cliente-checkout-page">
      <ClientePageHeader
        eyebrow="Compra"
        title="Checkout"
        subtitle="Confirmá tu pedido"
        actions={
          <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/carrito')}>
            ← Carrito
          </button>
        }
      />

      {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

      <section className="cliente-page-card cliente-checkout-resumen">
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

      <form
        className="cliente-page-form-section cliente-checkout-form"
        onSubmit={tipoIntencion === 'compra' ? handleSubmitCompra : handleSubmitCotizacion}
      >
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
              <span className="intent-card-hint">Pago con Mercado Pago</span>
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
          ¿Proyecto de diseño independiente?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/cliente/disenos')}>
            Ver mis briefs de diseño
          </button>
        </p>

        <button type="submit" className="cliente-btn-primary btn-submit" disabled={saving}>
          {saving
            ? 'Enviando…'
            : tipoIntencion === 'compra'
              ? 'Pagar con Mercado Pago'
              : 'Enviar solicitud de cotización'}
        </button>
      </form>
    </ClientePageLayout>
  )
}
