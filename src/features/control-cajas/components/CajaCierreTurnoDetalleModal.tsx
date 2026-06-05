import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPlanillaById, listMovimientosPorLote } from '../cajaRepository'
import {
  buildCierreTurnoDetallePack,
  downloadCierreTurnoJson,
  downloadCierreTurnoResumenTxt
} from '../exportCierreTurno'
import { fmtArs, fmtDateAr } from '../format'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaMovimiento, CajaRegistro, CajaTransferenciaLote } from '../types'
import PlanillaDetalleView from './PlanillaDetalleView'

type Props = {
  lote: CajaTransferenciaLote
  cajas: CajaRegistro[]
  onClose: () => void
}

export default function CajaCierreTurnoDetalleModal({ lote, cajas, onClose }: Props) {
  const [planilla, setPlanilla] = useState<PlanillaCajaParsed | null>(null)
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [verPlanilla, setVerPlanilla] = useState(false)

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug
  const comprobantes = lote.detalle?.comprobantes ?? []
  const planillaResumen = lote.detalle?.planilla_resumen

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([
      lote.id_planilla ? getPlanillaById(lote.id_planilla) : Promise.resolve(null),
      listMovimientosPorLote(lote.id)
    ]).then(([p, m]) => {
      if (cancelled) return
      setPlanilla(p)
      setMovimientos(m)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [lote])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleJson = () => {
    const pack = buildCierreTurnoDetallePack(lote, cajas, planilla, movimientos)
    downloadCierreTurnoJson(pack)
  }

  const handleTxt = () => {
    downloadCierreTurnoResumenTxt(lote, cajas, planilla)
  }

  const tipoComprobante = (t: string) => {
    if (t === 'resumen_mp') return 'Resumen MP'
    if (t === 'ticket_mp') return 'Ticket MP'
    if (t === 'ticket_posnet') return 'POSnet'
    if (t === 'egreso') return 'Egreso'
    return 'Comprobante'
  }

  const modal = (
    <div
      className="caja-cc-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="caja-cc-modal caja-cc-modal-wide" role="dialog" aria-labelledby="caja-cierre-turno-modal-title">
        <header className="caja-cc-modal-header">
          <div>
            <h2 id="caja-cierre-turno-modal-title">Cierre de turno</h2>
            <p className="caja-cc-sub">
              {fmtDateAr(lote.fecha)}
              {lote.hora ? ` · ${lote.hora}` : ''} · {cajaNombre(lote.origen_slug)}
            </p>
          </div>
          <button type="button" className="caja-cc-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="caja-cc-modal-body">
          {loading ? (
            <p className="caja-cc-help">Cargando detalle…</p>
          ) : (
            <>
              <div className="caja-cc-arqueo-meta-grid">
                <div>
                  <span className="caja-cc-meta-label">Cajera/o</span>
                  <strong>{lote.usuario_nombre ?? '—'}</strong>
                </div>
                <div>
                  <span className="caja-cc-meta-label">Fondo → {cajaNombre(lote.caja_fondo_destino_slug)}</span>
                  <strong>$ {fmtArs(lote.fondo_monto)}</strong>
                </div>
                <div>
                  <span className="caja-cc-meta-label">A administración</span>
                  <strong className="caja-cc-meta-total">
                    $ {fmtArs(lote.resto_efectivo + lote.resto_otros)}
                  </strong>
                </div>
                <div>
                  <span className="caja-cc-meta-label">Arqueo</span>
                  <span>
                    Ef. $ {fmtArs(lote.arqueo_efectivo)} · Otros $ {fmtArs(lote.arqueo_otros)}
                  </span>
                </div>
                {lote.created_at && (
                  <div>
                    <span className="caja-cc-meta-label">Registrado</span>
                    <span>{new Date(lote.created_at).toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>

              <h3>Planilla PDF</h3>
              {planilla ? (
                <>
                  <p className="caja-cc-ok">
                    {planilla.archivo_nombre} — {planilla.ventas.length} ventas · ingresos $ {fmtArs(planilla.totales?.ingresos_total ?? 0)}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => setVerPlanilla((v) => !v)}
                  >
                    {verPlanilla ? 'Ocultar líneas de planilla' : 'Ver planilla importada'}
                  </button>
                  {verPlanilla && <PlanillaDetalleView planilla={planilla} />}
                </>
              ) : planillaResumen ? (
                <p className="caja-cc-help">
                  {planillaResumen.archivo_nombre} — {planillaResumen.cantidad_ventas} ventas · ingresos $ {fmtArs(planillaResumen.ingresos_total)}
                </p>
              ) : lote.id_planilla ? (
                <p className="caja-cc-help">Planilla vinculada (sin datos locales).</p>
              ) : (
                <p className="caja-cc-empty">Sin planilla adjunta.</p>
              )}

              <h3>Comprobantes MP · POS · tarjetas</h3>
              {comprobantes.length === 0 ? (
                <p className="caja-cc-empty">Sin comprobantes en este cierre.</p>
              ) : (
                <ul className="caja-cc-comprobantes-list">
                  {comprobantes.map((c, i) => (
                    <li key={`${c.archivo_nombre}-${i}`} className="caja-cc-comprobantes-item">
                      <span className="caja-cc-comprobantes-tipo">{tipoComprobante(c.tipo)}</span>
                      <strong>
                        {c.es_resumen && c.lineas_resumen.length
                          ? `Resumen — ${c.lineas_resumen.length} línea(s)`
                          : `$ ${fmtArs(c.monto)}`}
                      </strong>
                      <span className="caja-cc-comprobantes-meta">
                        {fmtDateAr(c.fecha)}
                        {c.hora ? ` ${c.hora}` : ''}
                        {c.operacion_numero ? ` · Op. ${c.operacion_numero}` : ''}
                        {c.archivo_nombre ? ` · ${c.archivo_nombre}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {movimientos.length > 0 && (
                <>
                  <h3>Movimientos del cierre ({movimientos.length})</h3>
                  <div className="caja-cc-table-scroll">
                    <table className="caja-cc-table">
                      <thead>
                        <tr>
                          <th>Concepto</th>
                          <th>Tipo</th>
                          <th className="num">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((m) => (
                          <tr key={m.id}>
                            <td>{m.concepto}</td>
                            <td>{m.tipo_movimiento}</td>
                            <td className="num">$ {fmtArs(m.monto_total ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {lote.observacion && (
                <>
                  <h3>Observación</h3>
                  <p>{lote.observacion}</p>
                </>
              )}
            </>
          )}
        </div>

        <footer className="caja-cc-modal-footer">
          <button type="button" className="btn-primary" disabled={loading} onClick={handleJson}>
            Descargar JSON completo
          </button>
          <button type="button" className="btn-secondary" disabled={loading} onClick={handleTxt}>
            Descargar resumen TXT
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
