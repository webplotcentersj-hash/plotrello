import { useEffect, useRef, useState } from 'react'
import { consultarEstadoMpCheckout, crearMpCheckout, type MpCheckoutTipo } from '../../services/mpCheckoutApi'
import './MercadoPagoCheckoutPanel.css'

type Props = {
  tipo: MpCheckoutTipo
  payload: Record<string, unknown>
  amountHint?: number | null
  title?: string
  note?: string
  onPaid: (data: {
    checkoutId: string
    mpPaymentId: string | null
    mpPreferenceId: string | null
    ventaId?: number | null
    pedidoId?: number | null
    numeroVenta?: string | null
  }) => void
}

export default function MercadoPagoCheckoutPanel({
  tipo,
  payload,
  amountHint,
  title = 'Pagar con Mercado Pago',
  note = 'Escaneá el QR o abrí el link y confirmá el pago en la app de Mercado Pago.',
  onPaid
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [amount, setAmount] = useState<number | null>(amountHint ?? null)
  const [preferenceId, setPreferenceId] = useState<string | null>(null)
  const [initPoint, setInitPoint] = useState<string | null>(null)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid

  const payloadKey = JSON.stringify({ tipo, payload })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      const pref = await crearMpCheckout(tipo, payload)
      if (cancelled) return
      if (!pref.ok || !pref.checkout_id) {
        setError(pref.error || 'No se pudo iniciar el pago con Mercado Pago.')
        setLoading(false)
        return
      }
      setCheckoutId(pref.checkout_id)
      setAmount(pref.amount ?? amountHint ?? null)
      setPreferenceId(pref.preference_id ?? null)
      setInitPoint(pref.init_point || null)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [payloadKey, tipo, payload, amountHint])

  useEffect(() => {
    if (!initPoint) {
      setQrSrc(null)
      return
    }
    let cancelled = false
    void import('qrcode').then((QR) => {
      QR.default
        .toDataURL(initPoint, {
          margin: 1,
          width: 260,
          color: { dark: '#0c1222', light: '#ffffff' }
        })
        .then((src) => {
          if (!cancelled) setQrSrc(src)
        })
        .catch(() => {
          if (!cancelled) setQrSrc(null)
        })
    })
    return () => {
      cancelled = true
    }
  }, [initPoint])

  useEffect(() => {
    if (!checkoutId) return
    const tick = window.setInterval(() => {
      void (async () => {
        setChecking(true)
        const st = await consultarEstadoMpCheckout(checkoutId)
        setChecking(false)
        if (st.ok && st.listo) {
          onPaidRef.current({
            checkoutId,
            mpPaymentId: st.mp_payment_id ?? null,
            mpPreferenceId: st.mp_preference_id ?? preferenceId,
            ventaId: st.venta_id ?? null,
            pedidoId: st.pedido_id ?? null,
            numeroVenta: st.numero_venta ?? null
          })
        }
      })()
    }, 3500)
    return () => window.clearInterval(tick)
  }, [checkoutId, preferenceId])

  const amountLabel =
    amount != null
      ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
      : null

  return (
    <section className="mp-checkout-pay">
      <h2 className="mp-checkout-pay-title">{title}</h2>
      {amountLabel ? (
        <p className="mp-checkout-pay-lead">
          Total: <strong>{amountLabel}</strong>
        </p>
      ) : null}
      <p className="mp-checkout-pay-note">{note}</p>

      {loading ? <p className="mp-checkout-pay-muted">Preparando pago…</p> : null}
      {error ? <p className="mp-checkout-pay-error">{error}</p> : null}

      {!loading && !error && initPoint ? (
        <div className="mp-checkout-pay-grid">
          {qrSrc ? (
            <img className="mp-checkout-pay-qr" src={qrSrc} alt="Código QR Mercado Pago" width={260} height={260} />
          ) : (
            <div className="mp-checkout-pay-qrFallback">Generando QR…</div>
          )}
          <div className="mp-checkout-pay-aside">
            <p className="mp-checkout-pay-step">1. Escaneá el QR con Mercado Pago</p>
            <p className="mp-checkout-pay-step">2. Confirmá el pago en el celular</p>
            <p className="mp-checkout-pay-step">3. Esta pantalla se actualiza sola</p>
            <a className="mp-checkout-pay-link" href={initPoint} target="_blank" rel="noopener noreferrer">
              Abrir pago en el navegador
            </a>
            {checking ? <p className="mp-checkout-pay-muted">Verificando pago…</p> : null}
          </div>
        </div>
      ) : null}

      {preferenceId ? (
        <p className="mp-checkout-pay-ref">
          Checkout MP: <strong>{preferenceId}</strong>
        </p>
      ) : null}
    </section>
  )
}
