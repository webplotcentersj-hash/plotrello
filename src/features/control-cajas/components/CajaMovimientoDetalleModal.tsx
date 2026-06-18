import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../../../services/api'
import { downloadMovimientoCajaPdf } from '../exportMovimientoCajaPdf'
import { fmtArs, fmtDateAr, montoCobradoCaja, montoCuentaCorriente, montoVisibleMovimiento } from '../format'
import {
  cajaNombreFromSlug,
  labelOrigenImportacion,
  mediosPagoMovimiento,
  parseRefPlotLab,
  parseVentaIdFromRef,
  trazabilidadFilas
} from '../movimientoDetalle'
import type { CajaMovimiento, CajaRegistro } from '../types'
import CajaMontoMovimiento from './CajaMontoMovimiento'

type Props = {
  movimiento: CajaMovimiento
  cajas: CajaRegistro[]
  onClose: () => void
  onDelete?: (id: string) => void
}

type VentaDetalle = {
  numero?: string | null
  cliente?: string | null
  total?: number | null
  metodo?: string | null
  estado?: string | null
  vendedor?: string | null
}

export default function CajaMovimientoDetalleModal({ movimiento: m, cajas, onClose, onDelete }: Props) {
  const [venta, setVenta] = useState<VentaDetalle | null>(null)
  const [ventaLoading, setVentaLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  const total = montoVisibleMovimiento(m)
  const refPlotLab = parseRefPlotLab(m)
  const medios = mediosPagoMovimiento(m)
  const trace = trazabilidadFilas(m)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const ventaId = parseVentaIdFromRef(refPlotLab)
    if (!ventaId) {
      setVenta(null)
      return
    }
    let cancelled = false
    setVentaLoading(true)
    void apiService
      .getVenta(ventaId)
      .then((res) => {
        if (cancelled || !res.success || !res.data) return
        const v = res.data
        setVenta({
          numero: v.numero_venta ?? refPlotLab,
          cliente: v.cliente_nombre ?? m.tercero_nombre ?? null,
          total: v.valor_total ?? null,
          metodo: v.metodo_pago ?? null,
          estado: v.estado_pago ?? null,
          vendedor: v.nombre_vendedor ?? null
        })
      })
      .catch(() => {
        if (!cancelled) setVenta(null)
      })
      .finally(() => {
        if (!cancelled) setVentaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [m.id, refPlotLab, m.tercero_nombre])

  const handlePdf = () => {
    setPdfBusy(true)
    try {
      downloadMovimientoCajaPdf(m, cajas)
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
      <div className="caja-cc-modal caja-cc-modal-wide" role="dialog" aria-labelledby="caja-mov-modal-title">
        <header className="caja-cc-modal-header">
          <div>
            <h2 id="caja-mov-modal-title">{m.concepto}</h2>
            <p className="caja-cc-sub">
              {fmtDateAr(m.fecha)}
              {m.hora ? ` · ${m.hora}` : ''} · {cajaNombreFromSlug(m.origen_slug, cajas)} →{' '}
              {cajaNombreFromSlug(m.destino_slug, cajas)}
            </p>
          </div>
          <button type="button" className="caja-cc-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="caja-cc-modal-body">
          <div className="caja-cc-arqueo-meta-grid">
            <div>
              <span className="caja-cc-meta-label">Cobrado en caja</span>
              <strong className="caja-cc-meta-total">$ {fmtArs(montoCobradoCaja(m))}</strong>
            </div>
            {montoCuentaCorriente(m) > 0 && (
              <div>
                <span className="caja-cc-meta-label">Cuenta corriente</span>
                <strong className="caja-cc-amount-cc-inline">$ {fmtArs(montoCuentaCorriente(m))}</strong>
              </div>
            )}
            <div>
              <span className="caja-cc-meta-label">Total venta</span>
              <CajaMontoMovimiento movimiento={m} />
            </div>
            <div>
              <span className="caja-cc-meta-label">Tipo</span>
              <strong>{m.tipo_movimiento ?? '—'}</strong>
            </div>
            {m.categoria && (
              <div>
                <span className="caja-cc-meta-label">Categoría</span>
                <strong>{m.categoria}</strong>
              </div>
            )}
            {m.tercero_nombre && (
              <div>
                <span className="caja-cc-meta-label">Cliente / tercero</span>
                <strong>{m.tercero_nombre}</strong>
              </div>
            )}
            {m.usuario_nombre && (
              <div>
                <span className="caja-cc-meta-label">Usuario</span>
                <strong>{m.usuario_nombre}</strong>
              </div>
            )}
            <div>
              <span className="caja-cc-meta-label">Fuente</span>
              <strong>{labelOrigenImportacion(m.origen_importacion)}</strong>
            </div>
            {m.nro_comprobante && (
              <div>
                <span className="caja-cc-meta-label">Comprobante</span>
                <strong>{m.nro_comprobante}</strong>
              </div>
            )}
            {refPlotLab && (
              <div>
                <span className="caja-cc-meta-label">Referencia PlotLab</span>
                <strong>{refPlotLab}</strong>
              </div>
            )}
            {m.subtipo_pase && (
              <div>
                <span className="caja-cc-meta-label">Subtipo pase</span>
                <strong>{m.subtipo_pase}</strong>
              </div>
            )}
            {m.anulado && (
              <div>
                <span className="caja-cc-meta-label">Estado</span>
                <strong className="caja-cc-bad">Anulado</strong>
              </div>
            )}
            {m.cierre_id && (
              <div>
                <span className="caja-cc-meta-label">Cierre</span>
                <span>Vinculado a cierre cerrado</span>
              </div>
            )}
            {m.created_at && (
              <div>
                <span className="caja-cc-meta-label">Registrado</span>
                <span>{new Date(m.created_at).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div>
              <span className="caja-cc-meta-label">ID movimiento</span>
              <span className="caja-cc-pase-id">{m.id}</span>
            </div>
          </div>

          <h3>Medios de pago</h3>
          {medios.length === 0 ? (
            <p className="caja-cc-empty">Sin desglose por medio registrado.</p>
          ) : (
            <div className="caja-cc-table-scroll">
              <table className="caja-cc-table">
                <thead>
                  <tr>
                    <th>Medio</th>
                    <th className="num">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {medios.map((line) => (
                    <tr key={line.label}>
                      <td>{line.label}</td>
                      <td className="num">$ {fmtArs(line.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>
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

          {refPlotLab && (
            <>
              <h3>Venta PlotLab vinculada</h3>
              {ventaLoading ? (
                <p className="caja-cc-help">Cargando venta…</p>
              ) : venta ? (
                <div className="caja-cc-arqueo-meta-grid">
                  <div>
                    <span className="caja-cc-meta-label">Número</span>
                    <strong>{venta.numero ?? refPlotLab}</strong>
                  </div>
                  <div>
                    <span className="caja-cc-meta-label">Cliente</span>
                    <strong>{venta.cliente ?? '—'}</strong>
                  </div>
                  <div>
                    <span className="caja-cc-meta-label">Total venta</span>
                    <strong>$ {fmtArs(venta.total ?? 0)}</strong>
                  </div>
                  <div>
                    <span className="caja-cc-meta-label">Método / estado</span>
                    <span>
                      {venta.metodo ?? '—'} · {venta.estado ?? '—'}
                    </span>
                  </div>
                  {venta.vendedor && (
                    <div>
                      <span className="caja-cc-meta-label">Vendedor</span>
                      <span>{venta.vendedor}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="caja-cc-help">Referencia {refPlotLab} (sin detalle adicional en CRM).</p>
              )}
            </>
          )}

          {trace.length > 0 && (
            <>
              <h3>Trazabilidad del pase</h3>
              <div className="caja-cc-table-scroll">
                <table className="caja-cc-table">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th className="num">Antes</th>
                      <th className="num">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="num">{row.antes}</td>
                        <td className="num">{row.despues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {m.observacion && (
            <>
              <h3>Observación</h3>
              <p>{m.observacion}</p>
            </>
          )}
        </div>

        <footer className="caja-cc-modal-footer">
          <button type="button" className="btn-primary" disabled={pdfBusy} onClick={handlePdf}>
            {pdfBusy ? 'Generando…' : 'Exportar PDF'}
          </button>
          {onDelete && !m.cierre_id && !m.anulado && (
            <button
              type="button"
              className="btn-secondary danger"
              onClick={() => {
                onDelete(m.id)
                onClose()
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
