import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fondoParaOtraCajaDesdeArqueo } from '../cierreTurno'
import { BILLETE_DENOMINACIONES } from '../constants'
import { downloadArqueoPdf } from '../exportArqueoPdf'
import { fmtArs, fmtArs0, fmtDateAr } from '../format'
import type { CajaArqueo } from '../types'

type Props = {
  arqueo: CajaArqueo
  cajaNombre: string
  cajeraNombre?: string
  onClose: () => void
  onDelete?: () => void
}

export default function CajaArqueoDetalleModal({
  arqueo,
  cajaNombre,
  cajeraNombre,
  onClose,
  onDelete
}: Props) {
  const cajera = cajeraNombre ?? arqueo.usuario_nombre ?? '—'
  const [pdfBusy, setPdfBusy] = useState(false)
  const fondo = fondoParaOtraCajaDesdeArqueo(arqueo)
  const fondoEtiqueta =
    typeof arqueo.saldos?.fondo_etiqueta === 'string' ? arqueo.saldos.fondo_etiqueta : null
  const fondoDestinoNombre =
    typeof arqueo.saldos?.fondo_destino_nombre === 'string'
      ? arqueo.saldos.fondo_destino_nombre
      : fondo?.destinoSlug || null

  const handlePdf = () => {
    setPdfBusy(true)
    try {
      downloadArqueoPdf(arqueo, cajaNombre, cajera)
    } finally {
      setPdfBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lineasBilletes = BILLETE_DENOMINACIONES.map((d) => {
    const q = arqueo.billetes[`b${d}`] ?? 0
    return { d, q, sub: q * d }
  }).filter((r) => r.q > 0)

  const modal = (
    <div
      className="caja-cc-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="caja-cc-modal" role="dialog" aria-labelledby="caja-arqueo-modal-title">
        <header className="caja-cc-modal-header">
          <div>
            <h2 id="caja-arqueo-modal-title">Detalle del arqueo</h2>
            <p className="caja-cc-sub">
              {fmtDateAr(arqueo.fecha)} · {cajaNombre} · {arqueo.turno}
            </p>
          </div>
          <button type="button" className="caja-cc-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="caja-cc-modal-body">
          <div className="caja-cc-arqueo-meta-grid">
            <div>
              <span className="caja-cc-meta-label">Cajera</span>
              <strong>{cajera}</strong>
            </div>
            <div>
              <span className="caja-cc-meta-label">Total contado</span>
              <strong className="caja-cc-meta-total">$ {fmtArs(arqueo.total)}</strong>
            </div>
            {arqueo.created_at && (
              <div>
                <span className="caja-cc-meta-label">Registrado</span>
                <span>{new Date(arqueo.created_at).toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>

          {fondo ? (
            <div className="caja-cc-fondo-otra-caja-badge" role="status">
              <span className="caja-cc-fondo-otra-caja-tag">Fondo dejado</span>
              <strong className="caja-cc-fondo-otra-caja-monto">$ {fmtArs(fondo.monto)}</strong>
              <span className="caja-cc-fondo-otra-caja-dest">→ {fondoDestinoNombre || 'otra caja'}</span>
              <span className="caja-cc-fondo-otra-caja-hint">
                {fondoEtiqueta ||
                  'Monto distinto del contado: efectivo que queda en la otra caja operativa.'}
              </span>
            </div>
          ) : null}

          <h3>Conteo de billetes</h3>
          {lineasBilletes.length === 0 ? (
            <p className="caja-cc-empty">Sin detalle de billetes (solo total).</p>
          ) : (
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Denominación</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineasBilletes.map((r) => (
                  <tr key={r.d}>
                    <td>$ {fmtArs0(r.d)}</td>
                    <td className="num">{r.q}</td>
                    <td className="num">$ {fmtArs(r.sub)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong>$ {fmtArs(arqueo.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {arqueo.firma_data_url && (
            <div className="caja-cc-arqueo-firma-block">
              <h3>Firma</h3>
              <img src={arqueo.firma_data_url} alt="Firma de la cajera" className="caja-cc-arqueo-firma-img" />
            </div>
          )}
        </div>

        <footer className="caja-cc-modal-footer">
          <button type="button" className="btn-primary" disabled={pdfBusy} onClick={handlePdf}>
            {pdfBusy ? 'Generando…' : 'Descargar PDF'}
          </button>
          {onDelete && (
            <button
              type="button"
              className="btn-small danger"
              onClick={() => {
                if (confirm('¿Eliminar este arqueo?')) onDelete()
              }}
            >
              Eliminar
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
