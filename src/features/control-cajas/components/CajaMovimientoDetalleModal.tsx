import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../../../services/api'
import type { Venta, VentaItem } from '../../../types/api'
import { downloadMovimientoCajaPdf } from '../exportMovimientoCajaPdf'
import { fmtArs, fmtDateAr, montoCobradoCaja, montoCuentaCorriente, montoVisibleMovimiento } from '../format'
import {
  etiquetaRutaCajasMovimiento,
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
  venta: Venta
  items: VentaItem[]
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
    void Promise.all([apiService.getVenta(ventaId), apiService.getItemsVenta(ventaId)])
      .then(([res, itemsRes]) => {
        if (cancelled || !res.success || !res.data) return
        setVenta({
          venta: res.data,
          items: itemsRes.success && itemsRes.data ? itemsRes.data : []
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
              {m.hora ? ` · ${m.hora}` : ''} · {etiquetaRutaCajasMovimiento(m, cajas)}
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
                <>
                  <div className="caja-cc-arqueo-meta-grid">
                    <div>
                      <span className="caja-cc-meta-label">Número</span>
                      <strong>{venta.venta.numero_venta || refPlotLab}</strong>
                    </div>
                    <div>
                      <span className="caja-cc-meta-label">Cliente</span>
                      <strong>{venta.venta.cliente_nombre || '—'}</strong>
                    </div>
                    {venta.venta.cliente_dni_cuit && (
                      <div>
                        <span className="caja-cc-meta-label">DNI / CUIT</span>
                        <span>{venta.venta.cliente_dni_cuit}</span>
                      </div>
                    )}
                    {venta.venta.cliente_telefono && (
                      <div>
                        <span className="caja-cc-meta-label">Teléfono</span>
                        <span>{venta.venta.cliente_telefono}</span>
                      </div>
                    )}
                    {venta.venta.cliente_email && (
                      <div>
                        <span className="caja-cc-meta-label">Email</span>
                        <span>{venta.venta.cliente_email}</span>
                      </div>
                    )}
                    {venta.venta.cliente_empresa && (
                      <div>
                        <span className="caja-cc-meta-label">Empresa</span>
                        <span>{venta.venta.cliente_empresa}</span>
                      </div>
                    )}
                    {venta.venta.cliente_direccion && (
                      <div>
                        <span className="caja-cc-meta-label">Dirección</span>
                        <span>{venta.venta.cliente_direccion}</span>
                      </div>
                    )}
                    <div>
                      <span className="caja-cc-meta-label">Total venta</span>
                      <strong>$ {fmtArs(venta.venta.valor_total ?? 0)}</strong>
                    </div>
                    {venta.venta.monto_pagado != null && venta.venta.monto_pagado > 0 && (
                      <div>
                        <span className="caja-cc-meta-label">Cobrado</span>
                        <strong>$ {fmtArs(venta.venta.monto_pagado)}</strong>
                      </div>
                    )}
                    <div>
                      <span className="caja-cc-meta-label">Método / estado</span>
                      <span>
                        {venta.venta.metodo_pago ?? '—'} · {venta.venta.estado_pago ?? '—'}
                      </span>
                    </div>
                    {venta.venta.nombre_vendedor && (
                      <div>
                        <span className="caja-cc-meta-label">Vendedor</span>
                        <span>{venta.venta.nombre_vendedor}</span>
                      </div>
                    )}
                    {(() => {
                      const pago = String(
                        venta.venta.mp_payment_id || venta.venta.detalle_pago?.mp_payment_id || ''
                      ).trim()
                      const esMp = /mercado\s*pago/i.test(String(venta.venta.metodo_pago || ''))
                      if (!esMp && !pago) return null
                      return (
                        <div>
                          <span className="caja-cc-meta-label">Mercado Pago</span>
                          <span>{pago ? `Pago confirmado ${pago}` : 'Sin confirmación de pago'}</span>
                        </div>
                      )
                    })()}
                    {venta.venta.observaciones?.trim() && (
                      <div>
                        <span className="caja-cc-meta-label">Observaciones</span>
                        <span>{venta.venta.observaciones}</span>
                      </div>
                    )}
                  </div>
                  <h4>Ítems</h4>
                  {venta.items.length === 0 ? (
                    <p className="caja-cc-help">Sin ítems cargados.</p>
                  ) : (
                    <div className="caja-cc-table-scroll">
                      <table className="caja-cc-table">
                        <thead>
                          <tr>
                            <th>Descripción</th>
                            <th className="num">Cant.</th>
                            <th className="num">P. unit.</th>
                            <th className="num">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {venta.items.map((it) => (
                            <tr key={it.id}>
                              <td>
                                {it.descripcion}
                                {it.codigo_articulo ? ` (${it.codigo_articulo})` : ''}
                              </td>
                              <td className="num">{it.cantidad}</td>
                              <td className="num">$ {fmtArs(it.precio_unitario)}</td>
                              <td className="num">$ {fmtArs(it.precio_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
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
