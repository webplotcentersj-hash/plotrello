import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MercadoPagoCheckoutPanel from '../components/payments/MercadoPagoCheckoutPanel'
import apiService from '../services/api'
import { validarCantidadVentaComercial } from '../services/commerceCatalogService'
import {
  cartItemCount,
  cartTotal,
  clearTotemCart,
  descripcionPersonalizadaTotem,
  readTotemCart
} from './totemAutogestionCart'
import './TotemAutogestionCheckoutPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

type Step = 'review' | 'identify' | 'pay' | 'done'

export default function TotemAutogestionCheckoutPage() {
  const navigate = useNavigate()
  const [cart] = useState(() => readTotemCart())
  const [step, setStep] = useState<Step>('review')

  const itemsCount = cartItemCount(cart.items)
  const total = cartTotal(cart.items)

  const [dniCuit, setDniCuit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [needsDetails, setNeedsDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutPayload, setCheckoutPayload] = useState<Record<string, unknown> | null>(null)

  const [result, setResult] = useState<{
    pedidoId: number | null
    mpPaymentId: string | null
  } | null>(null)

  useEffect(() => {
    if (itemsCount === 0) {
      navigate('/totem/autogestion/catalogo', { replace: true })
    }
  }, [itemsCount, navigate])

  const dniDigits = useMemo(() => digitsOnly(dniCuit), [dniCuit])

  useEffect(() => {
    if (dniDigits.length < 7) {
      setClienteId(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        const search = await apiService.buscarClientes(dniDigits)
        if (cancelled) return
        if (search.success && search.data) {
          const match = search.data.find((c) => digitsOnly(c.dni_cuit ?? '') === dniDigits)
          if (match) {
            setClienteId(match.id)
            const nombreCompleto = [match.nombre, match.apellido].filter(Boolean).join(' ').trim()
            if (nombreCompleto) setNombre(nombreCompleto)
            if (match.telefono) setTelefono(match.telefono)
            setNeedsDetails(false)
            return
          }
        }
        setClienteId(null)
      })()
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [dniDigits])

  const validateIdentify = () => {
    if (!dniDigits) return 'Ingresá un DNI/CUIT.'
    if (dniDigits.length < 7) return 'DNI/CUIT inválido.'
    if (!clienteId && !needsDetails) return null
    if (!clienteId && needsDetails && !nombre.trim()) return 'Ingresá tu nombre.'
    return null
  }

  const resolverCliente = async (): Promise<number | null> => {
    if (clienteId) return clienteId

    if (!nombre.trim()) {
      setNeedsDetails(true)
      setError('Ingresá tu nombre para continuar.')
      return null
    }

    const r = await apiService.buscarOCrearCliente({
      nombre: nombre.trim(),
      dni_cuit: dniDigits,
      telefono: telefono.trim() || undefined
    })
    if (!r.success || !r.data) {
      setError(r.error || 'No se pudo registrar el cliente.')
      return null
    }
    return r.data.id
  }

  const validarCarrito = async (): Promise<string | null> => {
    const catalogo = await apiService.getCatalogoComercial({ canal: 'portal', limite: 500 })
    if (!catalogo.success || !catalogo.data) {
      return catalogo.error || 'No se pudo validar el catálogo.'
    }
    const porId = new Map(catalogo.data.items.map((a) => [a.id, a]))
    for (const it of cart.items) {
      const art = porId.get(it.id_articulo)
      if (!art) return 'Hay productos en el carrito que ya no están disponibles.'
      const v = validarCantidadVentaComercial(art, it.cantidad || 1)
      if (!v.ok) return v.error
    }
    return null
  }

  const handleContinuarPago = async () => {
    setError(null)
    const v = validateIdentify()
    if (v) {
      setError(v)
      return
    }

    const stockErr = await validarCarrito()
    if (stockErr) {
      setError(stockErr)
      return
    }

    const idCliente = await resolverCliente()
    if (!idCliente) return

    if (total < 1) {
      setError('El total debe ser al menos $1 para pagar con Mercado Pago.')
      return
    }

    const payload: Record<string, unknown> = {
      id_cliente: idCliente,
      tipo_intencion: 'compra',
      amount: total,
      observaciones_cliente: 'Origen: tótem catálogo (autogestión). Venta tótem.',
      items: cart.items.map((it) => ({
        id_articulo: it.id_articulo,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        precio_total: it.precio_total,
        descripcion_personalizada:
          it.descripcion_personalizada ||
          descripcionPersonalizadaTotem(it.id_articulo, it.nombre_articulo || '') ||
          null
      }))
    }

    setCheckoutPayload(payload)
    setStep('pay')
  }

  return (
    <div className="totem-checkout-page">
      <header className="totem-checkout-header">
        <button type="button" className="totem-checkout-back" onClick={() => navigate('/totem/autogestion/catalogo')}>
          ← Volver
        </button>
        <div>
          <h1>Confirmar compra</h1>
          <p>Identificate y pagá con Mercado Pago. El pedido entra a mostrador como venta tótem.</p>
        </div>
      </header>

      <main className="totem-checkout-main">
        {step === 'review' && (
          <section className="totem-checkout-card">
            <h2>Resumen</h2>
            <ul className="totem-checkout-items">
              {cart.items.map((it) => (
                <li key={it.id_articulo}>
                  <span>
                    {it.cantidad}× {it.nombre_articulo ?? `#${it.id_articulo}`}
                  </span>
                  <strong>${Number(it.precio_total || 0).toFixed(2)}</strong>
                </li>
              ))}
            </ul>
            <div className="totem-checkout-kv">
              <div>
                <span>Ítems</span>
                <strong>{itemsCount}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
            </div>
            <button type="button" className="totem-checkout-primary" onClick={() => setStep('identify')}>
              Continuar
            </button>
          </section>
        )}

        {step === 'identify' && (
          <section className="totem-checkout-card">
            <h2>Identificación</h2>
            <label className="totem-checkout-label">
              DNI/CUIT
              <input
                inputMode="numeric"
                className="totem-checkout-input"
                value={dniCuit}
                onChange={(e) => setDniCuit(e.target.value)}
                placeholder="Ingresá tu DNI/CUIT"
              />
            </label>

            {clienteId ? (
              <p className="totem-checkout-hint totem-checkout-hint--ok">
                Cliente encontrado{nombre ? `: ${nombre}` : ''}. Datos cargados automáticamente.
              </p>
            ) : (
              <div className="totem-checkout-hint">
                Si el DNI no está registrado, completá nombre y teléfono.
              </div>
            )}

            {(!clienteId || needsDetails) && (
              <div className="totem-checkout-details">
                <label className="totem-checkout-label">
                  Nombre
                  <input
                    className="totem-checkout-input"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                    autoComplete="off"
                  />
                </label>
                <label className="totem-checkout-label">
                  Teléfono (opcional)
                  <input
                    inputMode="tel"
                    className="totem-checkout-input"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: 264..."
                    autoComplete="off"
                  />
                </label>
              </div>
            )}

            {error && <div className="totem-checkout-error">{error}</div>}

            <div className="totem-checkout-actions">
              {!clienteId && (
                <button type="button" className="totem-checkout-secondary" onClick={() => setNeedsDetails((v) => !v)}>
                  {needsDetails ? 'Ocultar datos nuevos' : 'Soy cliente nuevo'}
                </button>
              )}
              <button type="button" className="totem-checkout-primary" onClick={() => void handleContinuarPago()}>
                Pagar con Mercado Pago
              </button>
            </div>
          </section>
        )}

        {step === 'pay' && checkoutPayload && (
          <section className="totem-checkout-card totem-checkout-card--pay">
            <MercadoPagoCheckoutPanel
              tipo="pedido_portal"
              payload={checkoutPayload}
              amountHint={total}
              title="Pagar compra del tótem"
              note="Escaneá el QR con Mercado Pago. Al confirmarse el pago registramos tu pedido y la venta en mostrador."
              onPaid={({ pedidoId, mpPaymentId }) => {
                clearTotemCart()
                setResult({ pedidoId: pedidoId ?? null, mpPaymentId: mpPaymentId ?? null })
                setStep('done')
              }}
            />
            <button type="button" className="totem-checkout-secondary" onClick={() => setStep('identify')}>
              ← Volver
            </button>
          </section>
        )}

        {step === 'done' && result && (
          <section className="totem-checkout-card totem-checkout-card--done">
            <h2>¡Pago confirmado!</h2>
            <p className="totem-checkout-success">
              Tu compra quedó registrada
              {result.pedidoId ? (
                <>
                  {' '}
                  — pedido <strong>#{result.pedidoId}</strong>
                </>
              ) : null}
            </p>
            {result.mpPaymentId ? (
              <p className="totem-checkout-hint">Mercado Pago — Pago: {result.mpPaymentId}</p>
            ) : null}
            <p className="totem-checkout-hint">
              El equipo de mostrador e imprenta verá la venta tótem en el sistema.
            </p>
            <div className="totem-checkout-actions">
              <button type="button" className="totem-checkout-primary" onClick={() => navigate('/totem/consulta-cliente')}>
                Volver al inicio
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
