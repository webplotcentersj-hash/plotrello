import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ResumenAdminHoy } from '../cajaDashboardData'
import { downloadEgresoDiaPdf, downloadIngresoDiaPdf } from '../exportMovimientoCajaPdf'
import { fmtArs, fmtDateAr } from '../format'
import {
  lineasEgresoDia,
  lineasIngresoDia,
  subtituloIngresoDia,
  tituloIngresoDia
} from '../movimientoDetalle'
import type {
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaRegistro,
  PlanillaCajaGuardada
} from '../types'
import CajaMovimientoDetalleModal from './CajaMovimientoDetalleModal'

type Props = {
  tipo: 'ingreso' | 'egreso'
  fecha: string
  esHoy: boolean
  resumen: ResumenAdminHoy
  planillas: PlanillaCajaGuardada[]
  egresos: CajaEgresoSolicitud[]
  movimientos: CajaMovimiento[]
  cajas: CajaRegistro[]
  onClose: () => void
}

export default function CajaDiaResumenDetalleModal({
  tipo,
  fecha,
  esHoy,
  resumen,
  planillas,
  egresos,
  movimientos,
  cajas,
  onClose
}: Props) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const [movimientoSel, setMovimientoSel] = useState<CajaMovimiento | null>(null)

  const lineas = useMemo(() => {
    if (tipo === 'ingreso') return lineasIngresoDia(fecha, resumen, planillas, movimientos)
    return lineasEgresoDia(fecha, egresos, planillas)
  }, [tipo, fecha, resumen, planillas, movimientos, egresos])

  const total = tipo === 'ingreso' ? resumen.ingresoHoy : resumen.egresosHoy
  const titulo = tipo === 'ingreso' ? tituloIngresoDia(resumen, esHoy) : esHoy ? 'Egresos hoy' : 'Egresos del día'
  const subtitulo =
    tipo === 'ingreso'
      ? subtituloIngresoDia(resumen)
      : resumen.egresosPendientes > 0
        ? `${resumen.egresosPendientes} egreso(s) pendiente(s) de aprobar`
        : 'Egresos aprobados del día (todas las cajas)'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handlePdf = () => {
    setPdfBusy(true)
    try {
      if (tipo === 'ingreso') downloadIngresoDiaPdf(resumen, lineas, esHoy)
      else downloadEgresoDiaPdf(fecha, total, lineas, esHoy)
    } finally {
      setPdfBusy(false)
    }
  }

  const modal = (
    <div
      className="caja-cc-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="caja-cc-modal caja-cc-modal-wide" role="dialog" aria-labelledby="caja-dia-modal-title">
        <header className="caja-cc-modal-header">
          <div>
            <h2 id="caja-dia-modal-title">{titulo}</h2>
            <p className="caja-cc-sub">
              {fmtDateAr(fecha)} · {subtitulo}
            </p>
          </div>
          <button type="button" className="caja-cc-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="caja-cc-modal-body">
          <div className="caja-cc-arqueo-meta-grid">
            <div>
              <span className="caja-cc-meta-label">Total</span>
              <strong className="caja-cc-meta-total">$ {fmtArs(total)}</strong>
            </div>
            <div>
              <span className="caja-cc-meta-label">Líneas</span>
              <strong>{lineas.length}</strong>
            </div>
          </div>

          <h3>Detalle</h3>
          {lineas.length === 0 ? (
            <p className="caja-cc-empty">Sin movimientos para este día.</p>
          ) : (
            <div className="caja-cc-table-scroll">
              <table className="caja-cc-table caja-cc-table-clickable">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Detalle</th>
                    <th className="num">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea) => (
                    <tr
                      key={linea.id}
                      className={linea.movimiento ? 'caja-cc-row-clickable' : undefined}
                      onClick={
                        linea.movimiento
                          ? () => setMovimientoSel(linea.movimiento!)
                          : undefined
                      }
                      title={linea.movimiento ? 'Ver detalle del movimiento' : undefined}
                    >
                      <td>{linea.titulo}</td>
                      <td className="caja-cc-meta">{linea.detalle || '—'}</td>
                      <td className="num">$ {fmtArs(linea.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      <strong>Total</strong>
                    </td>
                    <td className="num">
                      <strong>$ {fmtArs(total)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {tipo === 'ingreso' && resumen.ingresoFuente === 'plotlab' && lineas.some((l) => l.movimiento) && (
            <p className="caja-cc-help">Tocá una fila para ver el detalle completo de la venta PlotLab.</p>
          )}
        </div>

        <footer className="caja-cc-modal-footer">
          <button type="button" className="btn-primary" disabled={pdfBusy} onClick={handlePdf}>
            {pdfBusy ? 'Generando…' : 'Exportar PDF'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modal, document.body)}
      {movimientoSel && (
        <CajaMovimientoDetalleModal
          movimiento={movimientoSel}
          cajas={cajas}
          onClose={() => setMovimientoSel(null)}
        />
      )}
    </>
  )
}
