import { useEffect, useState, type FormEvent } from 'react'
import type { Venta } from '../../types/api'
import {
  clampMontoDevolucion,
  montoCobradoVentaLocal,
  ventaPuedeDevolverDinero
} from '../../utils/devolucionVentaLogica'
import { orquestarDevolucionVenta } from '../../utils/orquestarDevolucionVenta'
import apiService from '../../services/api'

type Props = {
  venta: Venta
  actorId: number
  actorNombre: string
  esAdmin?: boolean
  onClose: () => void
  onDone: (mensaje: string) => void
}

export default function VentaDevolucionModal({
  venta,
  actorId,
  actorNombre,
  esAdmin,
  onClose,
  onDone
}: Props) {
  const cobrado = montoCobradoVentaLocal(venta)
  const puedeDinero = ventaPuedeDevolverDinero(venta)
  const [puedeNc, setPuedeNc] = useState(false)
  const [yaNc, setYaNc] = useState(false)
  const [loadingFac, setLoadingFac] = useState(true)
  const [emitirNc, setEmitirNc] = useState(false)
  const [devolverDinero, setDevolverDinero] = useState(puedeDinero)
  const [cancelarVenta, setCancelarVenta] = useState(puedeDinero)
  const [monto, setMonto] = useState(String(cobrado || ''))
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingFac(true)
    void Promise.all([
      apiService.getFacturaAutorizadaPorVenta(venta.id),
      apiService.ventaTieneNotaCreditoAutorizada(venta.id)
    ]).then(([fac, nc]) => {
      if (cancelled) return
      const okFac = Boolean(fac.success && fac.data)
      setPuedeNc(okFac && !nc)
      setYaNc(nc)
      setEmitirNc(okFac && !nc)
      setLoadingFac(false)
    })
    return () => {
      cancelled = true
    }
  }, [venta.id])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const montoNum = clampMontoDevolucion(Number(String(monto).replace(',', '.')), cobrado)
    setBusy(true)
    setErr(null)
    try {
      const r = await orquestarDevolucionVenta({
        venta,
        emitirNc: emitirNc && puedeNc,
        devolverDinero: devolverDinero && puedeDinero,
        cancelarVenta,
        montoDevolver: montoNum,
        motivo,
        actorId,
        actorNombre,
        esAdmin
      })
      if (!r.ok) {
        setErr(r.mensaje)
        return
      }
      onDone(r.mensaje)
      onClose()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'No se pudo completar la devolución')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="caja-cc-modal-backdrop venta-devolucion-modal-backdrop" onClick={onClose}>
      <form
        className="caja-cc-modal venta-devolucion-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <h3>Nota de crédito / devolución</h3>
        <p className="caja-cc-sub">
          {venta.cliente_nombre} · {venta.numero_venta} · Total ${' '}
          {(Number(venta.valor_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </p>

        {loadingFac ? <p className="caja-cc-sub">Revisando factura AFIP…</p> : null}

        <label className="caja-cc-check">
          <input
            type="checkbox"
            checked={emitirNc}
            disabled={!puedeNc || busy}
            onChange={(e) => setEmitirNc(e.target.checked)}
          />
          Nota de crédito AFIP
          {yaNc ? ' (ya hay una NC autorizada)' : !puedeNc ? ' (hace falta factura autorizada)' : ''}
        </label>

        <label className="caja-cc-check">
          <input
            type="checkbox"
            checked={devolverDinero}
            disabled={!puedeDinero || busy}
            onChange={(e) => setDevolverDinero(e.target.checked)}
          />
          Devolver dinero en caja
          {!puedeDinero ? ' (no hay cobro registrado)' : ` · cobrado $ ${cobrado.toLocaleString('es-AR')}`}
        </label>

        {devolverDinero && puedeDinero ? (
          <label className="caja-cc-field">
            Monto a devolver
            <input
              type="number"
              min={0}
              max={cobrado}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </label>
        ) : null}

        <label className="caja-cc-check">
          <input
            type="checkbox"
            checked={cancelarVenta}
            disabled={busy}
            onChange={(e) => setCancelarVenta(e.target.checked)}
          />
          Cancelar la venta y devolver stock
        </label>

        <label className="caja-cc-field">
          Motivo
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Queda en la venta, la NC y el movimiento de caja"
            required
          />
        </label>

        {/mercado\s*pago/i.test(String(venta.metodo_pago)) || venta.mp_payment_id ? (
          <p className="caja-cc-field-hint">
            Mercado Pago: acá se registra la salida en caja. El reintegro en MP hay que hacerlo en el panel de MP.
          </p>
        ) : null}

        {err ? <p className="caja-cc-err">{err}</p> : null}

        <div className="caja-cc-modal-actions">
          <button type="button" className="btn-action" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
          <button type="submit" className="btn-action btn-primary" disabled={busy || loadingFac}>
            {busy ? 'Procesando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  )
}
