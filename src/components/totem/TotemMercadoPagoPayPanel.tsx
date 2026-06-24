import { useEffect, useRef, useState } from 'react'
import {
  consultarEstadoCheckoutMpTotem,
  crearCheckoutMpTotemImpresion,
  type TotemImpresionCheckoutDraft
} from '../../services/totemMpApi'
import './TotemMercadoPagoPayPanel.css'

type Props = {
  draft: TotemImpresionCheckoutDraft
  onPaid: (data: { solicitudId: number; mpPaymentId: string | null; mpPreferenceId: string | null }) => void
}

export default function TotemMercadoPagoPayPanel({ draft, onPaid }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [amount, setAmount] = useState<number | null>(draft.valor_total ?? null)
  const [preferenceId, setPreferenceId] = useState<string | null>(null)
  const [initPoint, setInitPoint] = useState<string | null>(null)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid

  const draftKey = JSON.stringify(draft)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      const pref = await crearCheckoutMpTotemImpresion(draft)
      if (cancelled) return
      if (!pref.ok || !pref.checkout_id) {
        setError(pref.error || 'No se pudo iniciar el pago con Mercado Pago.')
        setLoading(false)
        return
      }
      setCheckoutId(pref.checkout_id)
      setAmount(pref.amount ?? draft.valor_total ?? null)
      setPreferenceId(pref.preference_id ?? null)
      setInitPoint(pref.init_point || null)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [draftKey, draft])

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
        const st = await consultarEstadoCheckoutMpTotem(checkoutId)
        setChecking(false)
        if (st.ok && st.listo && st.solicitud_id) {
          onPaidRef.current({
            solicitudId: st.solicitud_id,
            mpPaymentId: st.mp_payment_id ?? null,
            mpPreferenceId: st.mp_preference_id ?? preferenceId
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
    <section className="totem-mp-pay">
      <h2 className="totem-mp-pay-title">Pagar con Mercado Pago</h2>
      <p className="totem-mp-pay-lead">
        {amountLabel ? (
          <>
            Total: <strong>{amountLabel}</strong>
          </>
        ) : null}
      </p>
      <p className="totem-mp-pay-note">
        Primero pagá. Cuando Mercado Pago confirme el cobro, el archivo se envía solo a la cola de impresión.
      </p>

      {loading ? <p className="totem-mp-pay-muted">Preparando pago…</p> : null}
      {error ? <p className="totem-mp-pay-error">{error}</p> : null}

      {!loading && !error && initPoint ? (
        <div className="totem-mp-pay-grid">
          {qrSrc ? (
            <img className="totem-mp-pay-qr" src={qrSrc} alt="Código QR Mercado Pago" width={260} height={260} />
          ) : (
            <div className="totem-mp-pay-qrFallback">Generando QR…</div>
          )}
          <div className="totem-mp-pay-aside">
            <p className="totem-mp-pay-step">1. Escaneá el QR con la app de Mercado Pago</p>
            <p className="totem-mp-pay-step">2. Confirmá el pago en el celular</p>
            <p className="totem-mp-pay-step">3. Al aprobarse, enviamos el trabajo a imprimir</p>
            <a className="totem-mp-pay-link" href={initPoint} target="_blank" rel="noopener noreferrer">
              Abrir pago en el navegador
            </a>
            {checking ? <p className="totem-mp-pay-muted">Verificando pago…</p> : null}
          </div>
        </div>
      ) : null}

      {preferenceId ? (
        <p className="totem-mp-pay-ref">
          Checkout MP: <strong>{preferenceId}</strong>
        </p>
      ) : null}
    </section>
  )
}
