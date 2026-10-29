import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { DEFAULT_CAJAS } from '../constants'
import { listCajas } from '../cajaRepository'
import { fmtArs } from '../format'
import type { CajaRegistro } from '../types'
import type { VentaCajaSyncRecord } from '../plotlabVentaCajaSync'

type Props = {
  venta: VentaCajaSyncRecord
  estadoDestino: 'Pagado' | 'Parcial'
  onClose: () => void
  onConfirm: (data: {
    cajaSlug: string
    /** Monto de ESTE cobro (no el acumulado). */
    montoPagado?: number
    fechaPago?: string
    observaciones?: string
  }) => Promise<void>
  /** Caja del usuario logueado. Si no es admin, el cobro va siempre acá. */
  cajaPropia?: { slug: string; nombre: string } | null
  isAdmin?: boolean
}

export default function CajaCobroVentaModal({
  venta,
  estadoDestino,
  onClose,
  onConfirm,
  cajaPropia = null,
  isAdmin = false
}: Props) {
  const total = Number(venta.valor_total) || 0
  const yaCobrado = Math.max(0, Number(venta.monto_pagado) || 0)
  const saldo = Math.max(0, Math.round((total - yaCobrado) * 100) / 100)

  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [cajaSlug, setCajaSlug] = useState(cajaPropia?.slug || venta.caja_slug_cobro || '')
  const [monto, setMonto] = useState(() =>
    estadoDestino === 'Parcial'
      ? yaCobrado > 0 && saldo > 0
        ? String(saldo)
        : yaCobrado > 0
          ? ''
          : String(total || '')
      : String(saldo > 0 ? saldo : total || '')
  )
  const [fechaPago, setFechaPago] = useState(getArgentinaDateString())
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fijarPropia = !isAdmin

  useEffect(() => {
    if (fijarPropia) {
      if (cajaPropia?.slug) setCajaSlug(cajaPropia.slug)
      return
    }
    void listCajas().then((list) => {
      const op = list.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto' && c.activa)
      const usable = op.length ? op : DEFAULT_CAJAS.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
      setCajas(usable)
      setCajaSlug((prev) => prev || cajaPropia?.slug || venta.caja_slug_cobro || usable[0]?.slug || '')
    })
  }, [venta.id, venta.caja_slug_cobro, fijarPropia, cajaPropia])

  const montoNum = useMemo(() => Number(String(monto).replace(',', '.')), [monto])
  const nuevoAcumulado = useMemo(() => {
    if (estadoDestino === 'Pagado') return total
    if (!Number.isFinite(montoNum) || montoNum <= 0) return yaCobrado
    return Math.round((yaCobrado + montoNum) * 100) / 100
  }, [estadoDestino, montoNum, total, yaCobrado])
  const nuevoSaldo = Math.max(0, Math.round((total - nuevoAcumulado) * 100) / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const slugFinal = fijarPropia ? cajaPropia?.slug || cajaSlug : cajaSlug
    if (!slugFinal) {
      setErr(
        fijarPropia
          ? 'No se pudo determinar tu caja. Recargá o contactá a administración.'
          : 'Elegí la caja donde se cobró.'
      )
      return
    }

    let cobroAhora = montoNum
    if (estadoDestino === 'Pagado') {
      cobroAhora = saldo > 0 ? saldo : total
    }
    if (!Number.isFinite(cobroAhora) || cobroAhora <= 0) {
      setErr('Indicá el monto cobrado en este pago.')
      return
    }
    if (estadoDestino === 'Parcial' && cobroAhora > saldo + 0.009 && saldo > 0) {
      setErr(`El cobro no puede superar el saldo ($${fmtArs(saldo)}).`)
      return
    }

    setSaving(true)
    setErr(null)
    try {
      await onConfirm({
        cajaSlug: slugFinal,
        montoPagado: cobroAhora,
        fechaPago: fechaPago || getArgentinaDateString(),
        observaciones: observaciones.trim() || undefined
      })
      onClose()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'No se pudo registrar el cobro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="caja-cc-modal-backdrop" onClick={onClose}>
      <form className="caja-cc-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void handleSubmit(e)}>
        <h3>{estadoDestino === 'Parcial' ? 'Cobro parcial en caja' : 'Cobro total en caja'}</h3>
        <p className="caja-cc-sub">
          {venta.cliente_nombre} · {venta.numero_venta} · Total $ {fmtArs(total)}
          {venta.id_pedido_cliente ? ' · Portal/Tótem' : ''}
        </p>

        <div className="caja-cc-parcial-resumen" aria-live="polite">
          <div>
            <span>Ya cobrado</span>
            <strong>$ {fmtArs(yaCobrado)}</strong>
          </div>
          <div>
            <span>Saldo</span>
            <strong className={saldo > 0 ? 'caja-cc-saldo' : undefined}>$ {fmtArs(saldo)}</strong>
          </div>
          {estadoDestino === 'Parcial' ? (
            <div>
              <span>Tras este cobro</span>
              <strong>
                $ {fmtArs(nuevoAcumulado)} · falta $ {fmtArs(nuevoSaldo)}
              </strong>
            </div>
          ) : null}
        </div>

        {fijarPropia ? (
          <label className="caja-cc-field">
            Caja (la tuya)
            <input type="text" value={cajaPropia?.nombre || cajaPropia?.slug || '—'} readOnly disabled />
            <span className="caja-cc-field-hint">El cobro queda en tu caja; no se puede elegir la de otro.</span>
          </label>
        ) : (
          <label className="caja-cc-field">
            Caja donde se cobró
            <select value={cajaSlug} onChange={(e) => setCajaSlug(e.target.value)} required>
              <option value="">Elegir…</option>
              {cajas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="caja-cc-field">
          Fecha del cobro
          <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
        </label>

        {estadoDestino === 'Parcial' ? (
          <label className="caja-cc-field">
            Monto de este cobro
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
            <span className="caja-cc-field-hint">Se suma al historial y deja saldo trazable.</span>
          </label>
        ) : (
          <p className="caja-cc-field-hint">
            Se registra el saldo restante ($ {fmtArs(saldo > 0 ? saldo : total)}) y la venta queda Pagado.
          </p>
        )}

        <label className="caja-cc-field">
          Nota / referencia (editable después)
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. transferencia parcial Banco Nación"
            maxLength={200}
          />
        </label>

        {err && <p className="caja-cc-err">{err}</p>}

        <div className="caja-cc-modal-actions">
          <button type="button" className="caja-cc-btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="caja-cc-btn-primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Confirmar, PDF y caja'}
          </button>
        </div>
      </form>
    </div>
  )
}
