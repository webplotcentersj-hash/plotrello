import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './ErpSectionPage.css'

type CxpRow = {
  id: number
  id_pedido_compra?: number | null
  proveedor_nombre: string
  concepto?: string | null
  fecha_vencimiento?: string | null
  monto_total: number
  monto_pagado: number
  monto_pendiente: number
  estado: string
}

type PagoRow = {
  id: number
  tipo: string
  fecha_pago: string
  monto: number
}

function defaultProveedorNombre(p: PedidoCompra): string {
  const items = p.items || []
  for (const it of items) {
    const n = String(it.proveedor || '').trim()
    if (n) return n
  }
  const prov = (p as { proveedor?: { razon_social?: string; nombre_fantasia?: string } | null }).proveedor
  if (prov?.razon_social) return prov.razon_social
  if (prov?.nombre_fantasia) return prov.nombre_fantasia
  return ''
}

function estimateMontoPedido(p: PedidoCompra): number {
  const items = p.items || []
  let s = 0
  for (const it of items) {
    const pt = it.precio_total != null ? Number(it.precio_total) : NaN
    if (Number.isFinite(pt) && pt > 0) {
      s += pt
      continue
    }
    const pu = it.precio_unitario != null ? Number(it.precio_unitario) : NaN
    const qty = Number(it.cantidad_comprada ?? it.cantidad_aprobada ?? it.cantidad_solicitada) || 0
    if (Number.isFinite(pu) && pu > 0 && qty > 0) s += pu * qty
  }
  return Math.round(s * 100) / 100
}

function circuitoEtapa(p: PedidoCompra, cxpLinked: CxpRow[]): string {
  const estado = p.estado
  if (estado === 'Rechazado' || estado === 'Cancelado') return estado
  if (estado === 'Pendiente' || estado === 'En Revisión') return 'Solicitud'
  if (estado === 'Aprobado') return 'Aprobado (pendiente OC)'
  if (estado === 'En Compra' || estado === 'En Viaje') {
    const ent = p.estado_entrega
    if (ent && ent !== 'Pendiente') return `Compra · ${ent}`
    return 'OC / en compra'
  }
  if (estado === 'Completado') {
    if (cxpLinked.length === 0) return 'Cerrado · sin CxP'
    const pend = cxpLinked.reduce((a, c) => a + (Number(c.monto_pendiente) || 0), 0)
    if (pend <= 0.0001) return 'CxP saldada'
    return 'CxP pendiente'
  }
  return estado
}

export default function ErpComprasPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cxp, setCxp] = useState<CxpRow[]>([])
  const [pagosMes, setPagosMes] = useState<PagoRow[]>([])
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [cxpModalPedido, setCxpModalPedido] = useState<PedidoCompra | null>(null)
  const [cxpSaving, setCxpSaving] = useState(false)
  const [estadoSavingId, setEstadoSavingId] = useState<number | null>(null)
  const [recepcionStockPedidoId, setRecepcionStockPedidoId] = useState<number | null>(null)
  const [cxpForm, setCxpForm] = useState({
    proveedor_nombre: '',
    monto_total: '',
    numero_documento: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    observaciones: ''
  })

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const firstDayMonth = useMemo(() => {
    const d = new Date()
    const f = new Date(d.getFullYear(), d.getMonth(), 1)
    return f.toISOString().split('T')[0]
  }, [])

  const loadAll = useCallback(() => {
    setLoading(true)
    setError(null)
    return Promise.all([
      apiService.getCuentasPorPagar(),
      apiService.getPagosCobros({ tipo: 'Pago', fechaDesde: firstDayMonth, fechaHasta: todayStr }),
      apiService.getPedidosCompra()
    ])
      .then(([rCxp, rPagos, rPedidos]) => {
        if (rCxp.success && rCxp.data) setCxp(Array.isArray(rCxp.data) ? (rCxp.data as CxpRow[]) : [])
        else setCxp([])
        if (rPagos.success && rPagos.data) setPagosMes(Array.isArray(rPagos.data) ? (rPagos.data as PagoRow[]) : [])
        else setPagosMes([])
        if (rPedidos.success && rPedidos.data) setPedidos(Array.isArray(rPedidos.data) ? rPedidos.data : [])
        else setPedidos([])
        if (!rCxp.success || !rPagos.success || !rPedidos.success) {
          setError(rCxp.error || rPagos.error || rPedidos.error || 'No se pudieron cargar datos de compras.')
        }
      })
      .finally(() => setLoading(false))
  }, [firstDayMonth, todayStr])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const cxpByPedido = useMemo(() => {
    const m = new Map<number, CxpRow[]>()
    for (const c of cxp) {
      const pid = c.id_pedido_compra
      if (pid == null) continue
      const arr = m.get(pid) || []
      arr.push(c)
      m.set(pid, arr)
    }
    return m
  }, [cxp])

  const pedidosRecientes = useMemo(() => {
    return pedidos.slice().sort((a, b) => {
      const ta = new Date(a.fecha_solicitud).getTime()
      const tb = new Date(b.fecha_solicitud).getTime()
      return tb - ta
    })
  }, [pedidos])

  const kpis = useMemo(() => {
    const pendientes = cxp.filter((x) => x.estado === 'Pendiente' || x.estado === 'Parcial')
    const montoPendiente = pendientes.reduce((s, x) => s + (Number(x.monto_pendiente) || 0), 0)
    const vencen7 = pendientes.filter((x) => {
      if (!x.fecha_vencimiento) return false
      const fv = new Date(x.fecha_vencimiento)
      const hoy = new Date()
      const diffDays = (fv.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 7.0001
    })
    const pagosTotalMes = pagosMes.reduce((s, p) => s + (Number(p.monto) || 0), 0)
    const ocActivos = pedidos.filter((p) => p.estado === 'En Compra' || p.estado === 'En Viaje').length
    return { pendientes: pendientes.length, montoPendiente, vencen7: vencen7.length, pagosTotalMes, ocActivos }
  }, [cxp, pagosMes, pedidos])

  const proximos = useMemo(() => {
    const pendientes = cxp.filter((x) => x.estado === 'Pendiente' || x.estado === 'Parcial')
    return pendientes
      .slice()
      .sort((a, b) => {
        const da = a.fecha_vencimiento ? new Date(a.fecha_vencimiento).getTime() : Number.MAX_SAFE_INTEGER
        const db = b.fecha_vencimiento ? new Date(b.fecha_vencimiento).getTime() : Number.MAX_SAFE_INTEGER
        return da - db
      })
      .slice(0, 20)
  }, [cxp])

  const openCxpModal = (p: PedidoCompra) => {
    setCxpModalPedido(p)
    const est = estimateMontoPedido(p)
    setCxpForm({
      proveedor_nombre: defaultProveedorNombre(p) || p.nombre_solicitante || '',
      monto_total: est > 0 ? String(est) : '',
      numero_documento: '',
      fecha_emision: todayStr,
      fecha_vencimiento: '',
      observaciones: `Pedido ${p.numero_pedido}`
    })
  }

  const handleCrearCxp = async () => {
    if (!cxpModalPedido) return
    const monto = Number(String(cxpForm.monto_total || '').replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      alert('Ingresá un monto total válido.')
      return
    }
    setCxpSaving(true)
    try {
      const r = await apiService.createCuentaPorPagar({
        proveedor_nombre: cxpForm.proveedor_nombre.trim(),
        monto_total: monto,
        fecha_emision: cxpForm.fecha_emision,
        fecha_vencimiento: cxpForm.fecha_vencimiento.trim() || null,
        numero_documento: cxpForm.numero_documento.trim() || null,
        observaciones: cxpForm.observaciones.trim() || null,
        id_pedido_compra: cxpModalPedido.id,
        id_proveedor: (cxpModalPedido as { id_proveedor?: number | null }).id_proveedor ?? null
      })
      if (!r.success) {
        alert(r.error || 'No se pudo crear la cuenta por pagar.')
        return
      }
      setCxpModalPedido(null)
      await loadAll()
    } finally {
      setCxpSaving(false)
    }
  }

  const handleRecepcionStock = async (p: PedidoCompra) => {
    if (
      !window.confirm(
        `Se sumará stock por los ítems del pedido ${p.numero_pedido} que tengan artículo de stock y cantidad a recibir. Los que ya tengan entrada para este pedido se omiten. ¿Continuar?`
      )
    ) {
      return
    }
    setRecepcionStockPedidoId(p.id)
    try {
      const r = await apiService.aplicarEntradasStockDesdePedidoCompra(p.id)
      if (!r.success || !r.data) {
        alert(r.error || 'No se pudieron aplicar las entradas.')
        return
      }
      const { aplicados, omitidos, detalles } = r.data
      alert(
        `Aplicados: ${aplicados}. Omitidos: ${omitidos}.${detalles.length ? '\n' + detalles.join('\n') : ''}`
      )
    } finally {
      setRecepcionStockPedidoId(null)
    }
  }

  const handleMarcarEnCompra = async (p: PedidoCompra) => {
    if (p.estado !== 'Aprobado') return
    if (!window.confirm(`¿Marcar el pedido ${p.numero_pedido} como "En compra" (orden enviada al proveedor)?`)) return
    setEstadoSavingId(p.id)
    try {
      const r = await apiService.actualizarEstadoPedido(p.id, 'En Compra')
      if (!r.success) {
        alert(r.error || 'No se pudo actualizar el estado.')
        return
      }
      await loadAll()
    } finally {
      setEstadoSavingId(null)
    }
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🧾 Compras / Proveedores</h1>
          <p className="erp-section-sub">Circuito pedido → OC → recepción → CxP → pago, con enlaces al módulo clásico de compras</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-pagar')}>
            Cuentas por pagar
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/impuestos')}>
            IVA Compras
          </button>
        </div>
      </div>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.pendientes}</div>
                <div className="erp-kpi-label">CxP pendientes</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${kpis.montoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Monto pendiente</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.vencen7}</div>
                <div className="erp-kpi-label">Vencen en 7 días</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${kpis.pagosTotalMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Pagos del mes</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.ocActivos}</div>
                <div className="erp-kpi-label">Pedidos en compra / viaje</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Accesos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/compras')}>
              Dashboard compras
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/compras/crear-pedido')}>
              Nueva solicitud
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/compras/pedidos')}>
              Cola de pedidos
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/compras/proveedores')}>
              Proveedores
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/compras/reportes')}>
              Reportes compras
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            La recepción y el tracking se cargan en el detalle del pedido. Acá podés pasar a OC, generar CxP vinculada al pedido y ver el estado global.
          </p>
        </div>
      </div>

      <div className="erp-panel" style={{ marginBottom: 24 }}>
        <h2>Circuito — pedidos recientes</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : pedidosRecientes.length === 0 ? (
          <p className="erp-muted">No hay pedidos de compra. Creá uno desde “Nueva solicitud”.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Solicitante</th>
                  <th>Estado</th>
                  <th>Etapa</th>
                  <th>Monto est.</th>
                  <th>CxP vinculadas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidosRecientes.slice(0, 50).map((p) => {
                  const linked = cxpByPedido.get(p.id) || []
                  const pendCxp = linked.reduce((s, c) => s + (Number(c.monto_pendiente) || 0), 0)
                  const est = estimateMontoPedido(p)
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.numero_pedido}</strong>
                        <div className="erp-muted" style={{ fontSize: '0.82rem' }}>
                          {p.fecha_solicitud ? new Date(p.fecha_solicitud).toLocaleDateString('es-AR') : '—'}
                        </div>
                      </td>
                      <td>{p.nombre_solicitante || '—'}</td>
                      <td>{p.estado}</td>
                      <td>{circuitoEtapa(p, linked)}</td>
                      <td>{est > 0 ? `$${est.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td>
                        {linked.length === 0 ? (
                          <span className="erp-muted">—</span>
                        ) : (
                          <>
                            <span className="erp-pill">{linked.length} cuenta(s)</span>
                            <div className="erp-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                              Pendiente: ${pendCxp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        <div className="erp-section-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                          <button type="button" className="btn-secondary" onClick={() => navigate(`/compras/pedidos/${p.id}?from=erp`)}>
                            Detalle / recepción
                          </button>
                          {p.estado === 'Aprobado' && (
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={estadoSavingId === p.id}
                              onClick={() => void handleMarcarEnCompra(p)}
                            >
                              {estadoSavingId === p.id ? 'Guardando…' : 'Marcar en compra (OC)'}
                            </button>
                          )}
                          {p.estado !== 'Rechazado' && p.estado !== 'Cancelado' && (
                            <button type="button" className="btn-primary" onClick={() => openCxpModal(p)}>
                              Registrar CxP
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(`/erp/impuestos?tab=compras&pedido=${p.id}`)}
                          >
                            IVA / factura compra
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={recepcionStockPedidoId === p.id}
                            onClick={() => void handleRecepcionStock(p)}
                          >
                            {recepcionStockPedidoId === p.id ? 'Stock…' : 'Entradas stock'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {pedidosRecientes.length > 50 && (
              <p className="erp-muted" style={{ marginTop: 10 }}>
                Mostrando 50 de {pedidosRecientes.length}. Ver el listado completo en Cola de pedidos.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="erp-panel">
        <h2>Próximos vencimientos (CxP)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : proximos.length === 0 ? (
          <p className="erp-muted">No hay vencimientos pendientes.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Concepto</th>
                  <th>Vencimiento</th>
                  <th>Pendiente</th>
                  <th>Estado</th>
                  <th>IVA compras</th>
                </tr>
              </thead>
              <tbody>
                {proximos.map((x) => (
                  <tr key={x.id}>
                    <td>{x.proveedor_nombre || '—'}</td>
                    <td>{x.concepto || '—'}</td>
                    <td>{x.fecha_vencimiento ? new Date(x.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}</td>
                    <td>${Number(x.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{x.estado}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          navigate(
                            `/erp/impuestos?tab=compras&cxp=${x.id}${
                              x.id_pedido_compra != null ? `&pedido=${x.id_pedido_compra}` : ''
                            }`
                          )
                        }
                      >
                        Precargar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cxpModalPedido && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCxpModalPedido(null)
          }}
        >
          <div
            className="erp-panel"
            style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cxp-modal-title"
          >
            <h2 id="cxp-modal-title">Nueva cuenta por pagar</h2>
            <p className="erp-muted" style={{ marginTop: 0 }}>
              Vinculada a {cxpModalPedido.numero_pedido}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Proveedor
                <input
                  type="text"
                  value={cxpForm.proveedor_nombre}
                  onChange={(e) => setCxpForm((f) => ({ ...f, proveedor_nombre: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Monto total
                <input
                  type="text"
                  inputMode="decimal"
                  value={cxpForm.monto_total}
                  onChange={(e) => setCxpForm((f) => ({ ...f, monto_total: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Nº comprobante (opcional)
                <input
                  type="text"
                  value={cxpForm.numero_documento}
                  onChange={(e) => setCxpForm((f) => ({ ...f, numero_documento: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                  Emisión
                  <input
                    type="date"
                    value={cxpForm.fecha_emision}
                    onChange={(e) => setCxpForm((f) => ({ ...f, fecha_emision: e.target.value }))}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </label>
                <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                  Vencimiento (opcional)
                  <input
                    type="date"
                    value={cxpForm.fecha_vencimiento}
                    onChange={(e) => setCxpForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </label>
              </div>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Observaciones
                <textarea
                  value={cxpForm.observaciones}
                  onChange={(e) => setCxpForm((f) => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }}
                />
              </label>
            </div>
            <div className="erp-section-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn-secondary" disabled={cxpSaving} onClick={() => setCxpModalPedido(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={cxpSaving} onClick={() => void handleCrearCxp()}>
                {cxpSaving ? 'Guardando…' : 'Crear CxP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
