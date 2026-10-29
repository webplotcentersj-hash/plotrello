import { useCallback, useEffect, useMemo, useState } from 'react'
import apiService from '../../services/api'
import type { Venta, VentaCobro } from '../../types/api'
import { generarReciboCobrosVentaPDFCompleto } from '../../utils/crmExportUtils'
import { formatArgentinaDate } from '../../utils/dateUtils'
import './VentaCobrosPanel.css'

type Props = {
  venta: Venta
  disabled?: boolean
  onVentaActualizada?: (venta: Venta) => void
}

function fmtArs(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function VentaCobrosPanel({ venta, disabled, onVentaActualizada }: Props) {
  const [cobros, setCobros] = useState<VentaCobro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [editMonto, setEditMonto] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editObs, setEditObs] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.listarCobrosVenta(venta.id)
      if (!res.success) throw new Error(res.error || 'No se pudieron cargar los cobros')
      setCobros(res.data || [])
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error al cargar cobros')
      setCobros([])
    } finally {
      setLoading(false)
    }
  }, [venta.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const total = Number(venta.valor_total) || 0
  const pagado = useMemo(
    () => cobros.reduce((s, c) => s + (Number(c.monto) || 0), 0),
    [cobros]
  )
  const saldo = Math.max(0, Math.round((total - pagado) * 100) / 100)

  const iniciarEdit = (c: VentaCobro) => {
    setEditId(c.id)
    setEditMonto(String(c.monto))
    setEditFecha(String(c.fecha_pago || '').slice(0, 10))
    setEditObs(c.observaciones || '')
  }

  const guardarEdit = async () => {
    if (editId == null) return
    const monto = Number(String(editMonto).replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      alert('Monto inválido')
      return
    }
    setSaving(true)
    try {
      const res = await apiService.actualizarCobroVenta({
        id_cobro: editId,
        monto,
        fecha_pago: editFecha || null,
        observaciones: editObs
      })
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo guardar')
      setCobros(res.data.cobros || [])
      setEditId(null)
      onVentaActualizada?.(res.data.venta)
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'Error al guardar cobro')
    } finally {
      setSaving(false)
    }
  }

  const descargarPdf = () => {
    void generarReciboCobrosVentaPDFCompleto(venta, cobros)
  }

  if (venta.estado_pago !== 'Parcial' && venta.estado_pago !== 'Pagado' && cobros.length === 0) {
    return null
  }

  return (
    <section className={`venta-cobros-panel${venta.estado_pago === 'Parcial' ? ' venta-cobros-panel--parcial' : ''}`}>
      <header className="venta-cobros-panel__head">
        <div>
          <h3>Cobros {venta.estado_pago === 'Parcial' ? 'parciales' : 'registrados'}</h3>
          <p>
            Trazable y editable · Total $ {fmtArs(total)} · Cobrado $ {fmtArs(pagado)}
            {saldo > 0 ? (
              <>
                {' '}
                · <strong className="venta-cobros-panel__saldo">Saldo $ {fmtArs(saldo)}</strong>
              </>
            ) : (
              ' · Saldo $ 0'
            )}
          </p>
        </div>
        <button type="button" className="venta-cobros-panel__pdf" onClick={descargarPdf} disabled={loading}>
          PDF resumen
        </button>
      </header>

      {loading ? <p className="venta-cobros-panel__muted">Cargando cobros…</p> : null}
      {error ? <p className="venta-cobros-panel__err">{error}</p> : null}

      {!loading && cobros.length === 0 ? (
        <p className="venta-cobros-panel__muted">Todavía no hay cobros en el historial.</p>
      ) : (
        <ul className="venta-cobros-panel__list">
          {cobros.map((c) => {
            const editing = editId === c.id
            return (
              <li key={c.id} className="venta-cobros-panel__row">
                {editing ? (
                  <div className="venta-cobros-panel__edit">
                    <input
                      type="date"
                      value={editFecha}
                      onChange={(e) => setEditFecha(e.target.value)}
                      disabled={disabled || saving}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editMonto}
                      onChange={(e) => setEditMonto(e.target.value)}
                      disabled={disabled || saving}
                      aria-label="Monto"
                    />
                    <input
                      type="text"
                      value={editObs}
                      onChange={(e) => setEditObs(e.target.value)}
                      placeholder="Nota"
                      disabled={disabled || saving}
                    />
                    <button type="button" disabled={disabled || saving} onClick={() => void guardarEdit()}>
                      Guardar
                    </button>
                    <button type="button" disabled={saving} onClick={() => setEditId(null)}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="venta-cobros-panel__main">
                      <strong>$ {fmtArs(Number(c.monto) || 0)}</strong>
                      <span>{c.fecha_pago ? formatArgentinaDate(c.fecha_pago) : '—'}</span>
                      <span>{c.metodo_pago || '—'}</span>
                      {c.caja_slug ? <span className="venta-cobros-panel__caja">{c.caja_slug}</span> : null}
                    </div>
                    {(c.observaciones || c.usuario_nombre) && (
                      <p className="venta-cobros-panel__meta">
                        {[c.usuario_nombre, c.observaciones].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <button
                      type="button"
                      className="venta-cobros-panel__edit-btn"
                      disabled={disabled}
                      onClick={() => iniciarEdit(c)}
                    >
                      Editar
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
