import { useEffect, useState } from 'react'
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
    montoPagado?: number
  }) => Promise<void>
}

export default function CajaCobroVentaModal({ venta, estadoDestino, onClose, onConfirm }: Props) {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [cajaSlug, setCajaSlug] = useState(venta.caja_slug_cobro || '')
  const [monto, setMonto] = useState(String(venta.monto_pagado || venta.valor_total || ''))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void listCajas().then((list) => {
      const op = list.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto' && c.activa)
      const usable = op.length ? op : DEFAULT_CAJAS.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
      setCajas(usable)
      setCajaSlug((prev) => prev || venta.caja_slug_cobro || usable[0]?.slug || '')
    })
  }, [venta.id, venta.caja_slug_cobro])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) {
      setErr('Elegí la caja donde se cobró.')
      return
    }
    const montoNum = Number(String(monto).replace(',', '.'))
    if (estadoDestino === 'Parcial' && (!Number.isFinite(montoNum) || montoNum <= 0)) {
      setErr('Indicá el monto cobrado.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await onConfirm({
        cajaSlug,
        montoPagado: estadoDestino === 'Parcial' ? montoNum : undefined
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
        <h3>Cobro en caja</h3>
        <p className="caja-cc-sub">
          {venta.cliente_nombre} · {venta.numero_venta} · Total $ {fmtArs(venta.valor_total)}
          {venta.id_pedido_cliente ? ' · Portal/Tótem' : ''}
        </p>

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

        {estadoDestino === 'Parcial' && (
          <label className="caja-cc-field">
            Monto cobrado ahora
            <input
              type="number"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </label>
        )}

        {err && <p className="caja-cc-err">{err}</p>}

        <div className="caja-cc-modal-actions">
          <button type="button" className="caja-cc-btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="caja-cc-btn-primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Confirmar y registrar en caja'}
          </button>
        </div>
      </form>
    </div>
  )
}
