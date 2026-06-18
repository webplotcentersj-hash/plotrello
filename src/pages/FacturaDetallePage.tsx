import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import apiService from '../services/api'
import { autorizarFacturaAFIP } from '../services/afipApi'
import { syncVentaPlotLabACaja } from '../features/control-cajas/plotlabVentaCajaSync'
import type { CuentaPorCobrarRecord, FacturaVentaRecord, FacturaItemRecord } from '../types/api'
import './FacturaDetallePage.css'

export default function FacturaDetallePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [factura, setFactura] = useState<(FacturaVentaRecord & { items?: FacturaItemRecord[] }) | null>(null)
  const [cxc, setCxc] = useState<CuentaPorCobrarRecord | null>(null)
  const [loadingCobro, setLoadingCobro] = useState(false)
  const [loadingAfip, setLoadingAfip] = useState(false)
  const [showCobro, setShowCobro] = useState(false)
  const [cuentas, setCuentas] = useState<any[]>([])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Depósito' | 'Otro'
  const [cobroForm, setCobroForm] = useState({
    monto: '',
    fecha_pago: todayStr,
    metodo_pago: 'Transferencia' as MetodoPago,
    numero_comprobante: '',
    id_cuenta_bancaria: '',
    observaciones: ''
  })

  useEffect(() => {
    if (id) {
      loadFactura(parseInt(id))
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    void apiService.getCuentasBancarias({ activa: true }).then((r) => {
      if (cancelled) return
      if (r.success && r.data) setCuentas(Array.isArray(r.data) ? r.data : [])
      else setCuentas([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loadCxc = async (facturaId: number) => {
    try {
      const r = await apiService.getCuentaPorCobrarByFacturaId(facturaId)
      if (r.success) setCxc(r.data ?? null)
    } catch {
      // noop
    }
  }

  const loadFactura = async (facturaId: number) => {
    setLoading(true)
    try {
      const response = await apiService.getFactura(facturaId)
      if (response.success && response.data) {
        setFactura(response.data)
        const tipo = String((response.data as any)?.tipo_comprobante || '')
        const esNotaCredito = tipo.startsWith('Nota de Crédito')
        const total = Number((response.data as any)?.total || 0)
        const esCobrable = (response.data as any)?.estado === 'Emitida' && !esNotaCredito && total > 0
        if (esCobrable) {
          await loadCxc(facturaId)
        } else {
          setCxc(null)
        }
      } else {
        alert('Error al cargar factura: ' + response.error)
        navigate('/erp/facturas')
      }
    } catch (error) {
      console.error('Error cargando factura:', error)
      alert('Error al cargar factura')
      navigate('/erp/facturas')
    } finally {
      setLoading(false)
    }
  }

  const handleAutorizarAfip = async () => {
    if (!factura) return
    if (
      !confirm(
        '¿Autorizar este comprobante en AFIP (homologación)?\n\nRequiere AFIP_ACCESS_TOKEN en el servidor y usa wsfev1 para pruebas.'
      )
    ) {
      return
    }

    setLoadingAfip(true)
    try {
      const response = await autorizarFacturaAFIP(factura.id)
      if (response.success) {
        alert(`Factura autorizada. CAE: ${response.data?.cae || '—'}`)
        if (id) await loadFactura(parseInt(id))
      } else {
        alert('Error AFIP: ' + (response.error || 'desconocido'))
        if (id) await loadFactura(parseInt(id))
      }
    } catch (error) {
      console.error('Error autorizando AFIP:', error)
      alert('Error al autorizar en AFIP')
    } finally {
      setLoadingAfip(false)
    }
  }

  const handleEmitir = async () => {
    if (!factura || !confirm('¿Estás seguro de emitir esta factura? Se creará la cuenta por cobrar y el asiento contable.')) {
      return
    }

    try {
      const response = await apiService.emitirFactura(factura.id)
      if (response.success) {
        alert('Factura emitida correctamente')
        if (id) await loadFactura(parseInt(id))
      } else {
        alert('Error al emitir factura: ' + response.error)
      }
    } catch (error) {
      console.error('Error emitiendo factura:', error)
      alert('Error al emitir factura')
    }
  }

  const handleRegistrarCobro = async () => {
    if (!factura || factura.estado !== 'Emitida') return
    if (!cxc) {
      alert('No se encontró la cuenta por cobrar asociada a esta factura.')
      return
    }

    const monto = Number(String(cobroForm.monto || '').replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      alert('Ingresá un monto válido.')
      return
    }
    if (!cobroForm.fecha_pago) {
      alert('Seleccioná la fecha de cobro.')
      return
    }
    if (monto > Number(cxc.monto_pendiente || 0) + 0.00001) {
      alert('El monto no puede superar el pendiente.')
      return
    }

    setLoadingCobro(true)
    try {
      const r = await apiService.registrarCobro({
        id_cuenta_por_cobrar: cxc.id,
        monto,
        fecha_pago: cobroForm.fecha_pago,
        metodo_pago: cobroForm.metodo_pago,
        numero_comprobante: cobroForm.numero_comprobante?.trim() || null,
        id_cuenta_bancaria: cobroForm.id_cuenta_bancaria ? Number(cobroForm.id_cuenta_bancaria) : null,
        observaciones: cobroForm.observaciones?.trim() || null
      })
      if (!r.success) {
        alert('Error registrando cobro: ' + (r.error || 'desconocido'))
        return
      }

      const usuarioRaw = localStorage.getItem('usuario')
      const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null
      void syncVentaPlotLabACaja({
        tipo: 'cobro',
        cobroId: r.data?.id,
        numeroComprobante: cobroForm.numero_comprobante?.trim() || factura.numero_factura || null,
        clienteNombre: factura.cliente_nombre || 'Cliente',
        monto,
        metodoPago: cobroForm.metodo_pago,
        estadoPago: 'Pagado',
        fecha: cobroForm.fecha_pago,
        usuarioId: usuario?.id,
        usuarioNombre: usuario?.nombre || usuario?.usuario || 'Tesorería'
      }).catch((err) => console.warn('Sync cobro → caja:', err))

      alert('Cobro registrado.')
      await loadCxc(factura.id)
      setShowCobro(false)
      setCobroForm((p) => ({ ...p, monto: '', numero_comprobante: '', observaciones: '' }))
    } catch (e) {
      alert('Error registrando cobro.')
      console.error(e)
    } finally {
      setLoadingCobro(false)
    }
  }

  if (loading) {
    return (
      <div className="factura-detalle-page">
        <div className="loading">Cargando factura...</div>
      </div>
    )
  }

  if (!factura) {
    return (
      <div className="factura-detalle-page">
        <div className="error">Factura no encontrada</div>
      </div>
    )
  }

  const tipo = String(factura.tipo_comprobante || '')
  const esNotaCredito = tipo.startsWith('Nota de Crédito')
  const puedeCrearNotas = factura.estado === 'Emitida' && tipo.startsWith('Factura')
  const esCobrable = factura.estado === 'Emitida' && !esNotaCredito && Number(factura.total || 0) > 0
  const puedeAutorizarAfip =
    factura.estado === 'Emitida' &&
    factura.estado_afip !== 'Autorizada' &&
    factura.estado_afip !== 'Enviando'

  return (
    <div className="factura-detalle-page">
      <div className="factura-header">
        <div>
          <h1>{factura.tipo_comprobante} {factura.numero_factura}</h1>
          <div className="factura-meta">
            <span className={`estado-badge estado-${factura.estado.toLowerCase()}`}>
              {factura.estado}
            </span>
            {factura.estado_afip && (
              <>
                <span className="separator">•</span>
                <span className={`afip-badge afip-${factura.estado_afip.toLowerCase()}`}>
                  AFIP: {factura.estado_afip}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
            ← Volver
          </button>
          {factura.estado === 'Borrador' && (
            <button className="btn-primary" onClick={handleEmitir}>
              Emitir Factura
            </button>
          )}
          {puedeAutorizarAfip && (
            <button className="btn-primary" onClick={handleAutorizarAfip} disabled={loadingAfip}>
              {loadingAfip ? 'Autorizando AFIP…' : 'Autorizar AFIP'}
            </button>
          )}
          {puedeCrearNotas && (
            <>
              <button className="btn-secondary" onClick={() => navigate(`/erp/facturas/${factura.id}/nota?tipo=credito`)}>
                Nota crédito
              </button>
              <button className="btn-secondary" onClick={() => navigate(`/erp/facturas/${factura.id}/nota?tipo=debito`)}>
                Nota débito
              </button>
            </>
          )}
        </div>
      </div>

      <div className="factura-content">
        <div className="factura-section">
          <h2>Datos del Comprobante</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Tipo de Comprobante</label>
              <div>{factura.tipo_comprobante}</div>
            </div>
            {(factura as any).id_factura_referencia && (
              <div className="info-item">
                <label>Referencia</label>
                <div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => navigate(`/erp/facturas/${(factura as any).id_factura_referencia}`)}
                  >
                    Ver comprobante origen
                  </button>
                </div>
              </div>
            )}
            <div className="info-item">
              <label>Punto de Venta</label>
              <div>{factura.punto_venta}</div>
            </div>
            <div className="info-item">
              <label>Número de Comprobante</label>
              <div>{factura.numero_comprobante}</div>
            </div>
            <div className="info-item">
              <label>Fecha de Emisión</label>
              <div>{new Date(factura.fecha_emision).toLocaleDateString('es-AR')}</div>
            </div>
            {factura.fecha_vencimiento && (
              <div className="info-item">
                <label>Fecha de Vencimiento</label>
                <div>{new Date(factura.fecha_vencimiento).toLocaleDateString('es-AR')}</div>
              </div>
            )}
            {factura.cae && (
              <div className="info-item">
                <label>CAE</label>
                <div>{factura.cae}</div>
              </div>
            )}
            {factura.numero_cae && (
              <div className="info-item">
                <label>Número CAE</label>
                <div>{factura.numero_cae}</div>
              </div>
            )}
            {factura.fecha_vencimiento_cae && (
              <div className="info-item">
                <label>Vencimiento CAE</label>
                <div>{new Date(factura.fecha_vencimiento_cae).toLocaleDateString('es-AR')}</div>
              </div>
            )}
          </div>
        </div>

        {esCobrable && (
          <div className="factura-section">
            <h2>Cobranza</h2>
            {!cxc ? (
              <p className="erp-muted">No hay cuenta por cobrar asociada (o no se pudo cargar).</p>
            ) : (
              <>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Estado CxC</label>
                    <div>{cxc.estado}</div>
                  </div>
                  <div className="info-item">
                    <label>Monto total</label>
                    <div>${Number(cxc.monto_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="info-item">
                    <label>Pagado</label>
                    <div>${Number(cxc.monto_pagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="info-item">
                    <label>Pendiente</label>
                    <div>${Number(cxc.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  {cxc.fecha_vencimiento && (
                    <div className="info-item">
                      <label>Vencimiento</label>
                      <div>{new Date(cxc.fecha_vencimiento).toLocaleDateString('es-AR')}</div>
                    </div>
                  )}
                </div>

                {cxc.monto_pendiente > 0 ? (
                  <div className="cobranza-actions">
                    <button className="btn-primary" onClick={() => setShowCobro((s) => !s)} disabled={loadingCobro}>
                      {showCobro ? 'Cancelar' : 'Registrar cobro'}
                    </button>
                  </div>
                ) : (
                  <p className="erp-muted" style={{ marginTop: 12 }}>
                    Esta factura está totalmente cobrada.
                  </p>
                )}

                {showCobro && (
                  <div className="cobranza-form">
                    <div className="cobranza-grid">
                      <div className="cobranza-field">
                        <label>Monto *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cobroForm.monto}
                          onChange={(e) => setCobroForm((p) => ({ ...p, monto: e.target.value }))}
                        />
                      </div>
                      <div className="cobranza-field">
                        <label>Fecha *</label>
                        <input
                          type="date"
                          value={cobroForm.fecha_pago}
                          onChange={(e) => setCobroForm((p) => ({ ...p, fecha_pago: e.target.value }))}
                        />
                      </div>
                      <div className="cobranza-field">
                        <label>Método *</label>
                        <select
                          value={cobroForm.metodo_pago}
                          onChange={(e) => setCobroForm((p) => ({ ...p, metodo_pago: e.target.value as any }))}
                        >
                          <option value="Transferencia">Transferencia</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Tarjeta">Tarjeta</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Depósito">Depósito</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div className="cobranza-field">
                        <label>Comprobante</label>
                        <input
                          type="text"
                          value={cobroForm.numero_comprobante}
                          onChange={(e) => setCobroForm((p) => ({ ...p, numero_comprobante: e.target.value }))}
                          placeholder="N° / referencia"
                        />
                      </div>
                      <div className="cobranza-field">
                        <label>Cuenta bancaria</label>
                        <select
                          value={cobroForm.id_cuenta_bancaria}
                          onChange={(e) => setCobroForm((p) => ({ ...p, id_cuenta_bancaria: e.target.value }))}
                        >
                          <option value="">(sin asignar)</option>
                          {cuentas.map((c: any) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="cobranza-field cobranza-field--full">
                        <label>Observaciones</label>
                        <textarea
                          rows={3}
                          value={cobroForm.observaciones}
                          onChange={(e) => setCobroForm((p) => ({ ...p, observaciones: e.target.value }))}
                          placeholder="Detalle del cobro…"
                        />
                      </div>
                    </div>

                    <div className="cobranza-actions">
                      <button className="btn-secondary" onClick={() => setShowCobro(false)} disabled={loadingCobro}>
                        Cancelar
                      </button>
                      <button className="btn-primary" onClick={handleRegistrarCobro} disabled={loadingCobro}>
                        {loadingCobro ? 'Registrando…' : 'Confirmar cobro'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="factura-section">
          <h2>Datos del Cliente</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Cliente</label>
              <div>{factura.cliente_nombre}</div>
            </div>
            {factura.cliente_dni_cuit && (
              <div className="info-item">
                <label>DNI/CUIT</label>
                <div>{factura.cliente_dni_cuit}</div>
              </div>
            )}
            {factura.cliente_condicion_iva && (
              <div className="info-item">
                <label>Condición IVA</label>
                <div>{factura.cliente_condicion_iva}</div>
              </div>
            )}
            {factura.cliente_direccion && (
              <div className="info-item full-width">
                <label>Dirección</label>
                <div>{factura.cliente_direccion}</div>
              </div>
            )}
          </div>
        </div>

        {factura.numero_op && (
          <div className="factura-section">
            <h2>Orden de Trabajo Asociada</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Número OP</label>
                <div>
                  <button
                    className="link-button"
                    onClick={() => navigate(`/op/${factura.id_op}`)}
                  >
                    {factura.numero_op}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="factura-section">
          <h2>Items de la Factura</h2>
          <div className="items-table-container">
            <table className="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Descripción</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">P. Unitario</th>
                  <th className="text-right">Descuento</th>
                  <th className="text-right">IVA %</th>
                  <th className="text-right">IVA Monto</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {factura.items && factura.items.length > 0 ? (
                  factura.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item_numero}</td>
                      <td>{item.descripcion}</td>
                      <td className="text-right">{item.cantidad}</td>
                      <td className="text-right">${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right">
                        {item.descuento > 0 ? `$${item.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="text-right">{item.iva_porcentaje}%</td>
                      <td className="text-right">${item.iva_monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right">${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty-state">No hay items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="factura-section">
          <h2>Totales</h2>
          <div className="totales-container">
            <div className="total-row">
              <span className="total-label">Subtotal:</span>
              <span className="total-value">${factura.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            {factura.descuento > 0 && (
              <div className="total-row">
                <span className="total-label">Descuento:</span>
                <span className="total-value">-${factura.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="total-row">
              <span className="total-label">IVA:</span>
              <span className="total-value">${factura.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="total-row total-final">
              <span className="total-label">Total:</span>
              <span className="total-value">${factura.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {factura.observaciones && (
          <div className="factura-section">
            <h2>Observaciones</h2>
            <div className="observaciones">{factura.observaciones}</div>
          </div>
        )}
      </div>
    </div>
  )
}

