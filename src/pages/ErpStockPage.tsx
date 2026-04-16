import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { ArticuloStock, StockMovimiento } from '../types/pedidos'
import type { StockDepositoRecord, StockSaldoDepositoRow } from '../types/api'
import './ErpSectionPage.css'

export default function ErpStockPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [articulos, setArticulos] = useState<ArticuloStock[]>([])
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([])
  const [depositos, setDepositos] = useState<StockDepositoRecord[]>([])
  const [depNombre, setDepNombre] = useState('')
  const [depCodigo, setDepCodigo] = useState('')
  const [savingDeposito, setSavingDeposito] = useState(false)
  const [syncPrincipalLoading, setSyncPrincipalLoading] = useState(false)
  const [syncGlobalDesdeDepositosLoading, setSyncGlobalDesdeDepositosLoading] = useState(false)
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferArtId, setTransferArtId] = useState('')
  const [transferOrigen, setTransferOrigen] = useState('')
  const [transferDestino, setTransferDestino] = useState('')
  const [transferCantidad, setTransferCantidad] = useState('')
  const [saldosTransfer, setSaldosTransfer] = useState<StockSaldoDepositoRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [savingMov, setSavingMov] = useState(false)
  const [movForm, setMovForm] = useState({
    id_articulo_stock: '' as string | number,
    tipo_movimiento: 'Entrada' as 'Entrada' | 'Salida' | 'Ajuste',
    cantidad: '',
    motivo: ''
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const search = busqueda.trim().length >= 2 ? busqueda.trim() : undefined
    const [rArt, rMov, rDep] = await Promise.all([
      apiService.getArticulosStock(search, soloBajoMinimo, undefined),
      apiService.getMovimientosStock({ limit: 80 }),
      apiService.getStockDepositos()
    ])
    if (rArt.success && rArt.data) setArticulos(Array.isArray(rArt.data) ? rArt.data : [])
    else {
      setArticulos([])
      if (!rArt.success) setError(rArt.error || 'No se pudieron cargar artículos.')
    }
    if (rMov.success && rMov.data) setMovimientos(Array.isArray(rMov.data) ? rMov.data : [])
    else setMovimientos([])
    if (rDep.success && rDep.data) setDepositos(Array.isArray(rDep.data) ? rDep.data : [])
    else setDepositos([])
    setLoading(false)
  }, [busqueda, soloBajoMinimo])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadAll()
    }, busqueda.trim().length >= 2 ? 400 : 0)
    return () => window.clearTimeout(t)
  }, [loadAll, busqueda, soloBajoMinimo])

  useEffect(() => {
    const id = Number(transferArtId)
    if (!Number.isFinite(id) || id <= 0) {
      setSaldosTransfer([])
      return
    }
    let cancelled = false
    void apiService.getStockSaldosPorArticulo(id).then((r) => {
      if (cancelled) return
      if (r.success && r.data) setSaldosTransfer(r.data)
      else setSaldosTransfer([])
    })
    return () => {
      cancelled = true
    }
  }, [transferArtId])

  const kpis = useMemo(() => {
    const activos = articulos.filter((a) => a.activo !== false)
    const bajo = activos.filter((a) => {
      const s = Number(a.stock) || 0
      const m = Number(a.stock_minimo) || 0
      return s <= m
    })
    const valorizado = activos.reduce((sum, a) => {
      const s = Number(a.stock) || 0
      const p = Number(a.precio) || 0
      return sum + s * p
    }, 0)
    return {
      total: activos.length,
      bajo: bajo.length,
      valorizado
    }
  }, [articulos])

  const openModal = (art?: ArticuloStock) => {
    setMovForm({
      id_articulo_stock: art ? art.id : '',
      tipo_movimiento: 'Entrada',
      cantidad: '',
      motivo: ''
    })
    setModalOpen(true)
  }

  const handleAplicarMovimiento = async () => {
    const id = Number(movForm.id_articulo_stock)
    if (!Number.isFinite(id) || id <= 0) {
      alert('Seleccioná un artículo.')
      return
    }
    const cantidad = Number(String(movForm.cantidad || '').replace(',', '.'))
    if (!Number.isFinite(cantidad)) {
      alert('Ingresá una cantidad válida.')
      return
    }
    setSavingMov(true)
    try {
      const r = await apiService.aplicarMovimientoStockManual({
        id_articulo_stock: id,
        tipo_movimiento: movForm.tipo_movimiento,
        cantidad,
        motivo: movForm.motivo.trim() || null
      })
      if (!r.success) {
        alert(r.error || 'No se pudo registrar el movimiento.')
        return
      }
      setModalOpen(false)
      await loadAll()
    } finally {
      setSavingMov(false)
    }
  }

  const handleCrearDeposito = async () => {
    const n = depNombre.trim()
    if (!n) {
      alert('Ingresá el nombre del depósito.')
      return
    }
    setSavingDeposito(true)
    try {
      const r = await apiService.createStockDeposito({
        nombre: n,
        codigo: depCodigo.trim() || null
      })
      if (!r.success) {
        alert(r.error || 'No se pudo crear el depósito.')
        return
      }
      setDepNombre('')
      setDepCodigo('')
      await loadAll()
    } finally {
      setSavingDeposito(false)
    }
  }

  const handleSincronizarPrincipal = async () => {
    if (
      !window.confirm(
        'Se copiará la existencia actual de cada artículo en esta lista al depósito Principal (tabla stock_saldo_deposito). ¿Continuar?'
      )
    ) {
      return
    }
    setSyncPrincipalLoading(true)
    try {
      let ok = 0
      let fail = 0
      for (const a of articulos.slice(0, 200)) {
        const r = await apiService.replicarStockArticuloADepositoPrincipal(a.id)
        if (r.success) ok++
        else fail++
      }
      alert(`Sincronizados: ${ok}. Con error: ${fail}.`)
      await loadAll()
    } finally {
      setSyncPrincipalLoading(false)
    }
  }

  const handleSincronizarStockGlobalDesdeDepositos = async () => {
    if (
      !window.confirm(
        'Se actualizará articulos.stock en la base de stock con la suma de saldos por depósito (stock_saldo_deposito) para cada artículo de esta lista. No se registran movimientos. ¿Continuar?'
      )
    ) {
      return
    }
    setSyncGlobalDesdeDepositosLoading(true)
    try {
      let ok = 0
      let fail = 0
      for (const a of articulos.slice(0, 200)) {
        const r = await apiService.sincronizarStockGlobalDesdeSumaDepositos(a.id)
        if (r.success) ok++
        else fail++
      }
      alert(`Stock global alineado: ${ok}. Con error: ${fail}.`)
      await loadAll()
    } finally {
      setSyncGlobalDesdeDepositosLoading(false)
    }
  }

  const handleTransferir = async () => {
    const idArt = Number(transferArtId)
    const idO = Number(transferOrigen)
    const idD = Number(transferDestino)
    const qty = Number(String(transferCantidad || '').replace(',', '.'))
    if (!Number.isFinite(idArt) || idArt <= 0) {
      alert('Seleccioná un artículo.')
      return
    }
    if (!Number.isFinite(idO) || !Number.isFinite(idD)) {
      alert('Seleccioná depósito de origen y destino.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Ingresá una cantidad válida.')
      return
    }
    const art = articulos.find((x) => x.id === idArt)
    setTransferSaving(true)
    try {
      const r = await apiService.transferirStockEntreDepositos({
        id_articulo_stock: idArt,
        id_deposito_origen: idO,
        id_deposito_destino: idD,
        cantidad: qty,
        codigo_articulo: art?.codigo ?? null,
        descripcion_articulo: art?.descripcion || `Artículo #${idArt}`
      })
      if (!r.success) {
        alert(r.error || 'No se pudo transferir.')
        return
      }
      setTransferCantidad('')
      await loadAll()
      const rs = await apiService.getStockSaldosPorArticulo(idArt)
      if (rs.success && rs.data) setSaldosTransfer(rs.data)
    } finally {
      setTransferSaving(false)
    }
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>📦 Stock / Inventario</h1>
          <p className="erp-section-sub">
            Existencias en la base de stock, movimientos, depósitos en la app y transferencias entre ubicaciones
          </p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => openModal()}>
            Movimiento manual
          </button>
        </div>
      </div>

      {error && (
        <div className="erp-panel" style={{ marginBottom: 16 }}>
          <span className="erp-pill danger">Stock</span> <span className="erp-muted">{error}</span>
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
                <div className="erp-kpi-value">{kpis.total}</div>
                <div className="erp-kpi-label">Artículos activos (vista)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.bajo}</div>
                <div className="erp-kpi-label">En o bajo mínimo</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpis.valorizado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </div>
                <div className="erp-kpi-label">Valorización simple (Σ stock×precio)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{depositos.length}</div>
                <div className="erp-kpi-label">Depósitos activos</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Accesos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/compras/gestion-stock')}>
              Gestión de stock (ABM)
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/compras/reportes')}>
              Reportes stock/compras
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/compras')}>
              Compras / CxP
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Depósitos y saldos viven en la base principal (patch 2026-04-18). Sincronizá el Principal antes de transferir si
            aún no cargaste saldos por depósito. “Stock global = Σ depósitos” reescribe el total en la base de stock según esos
            saldos (sin movimientos).
          </p>
        </div>
      </div>

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>Depósitos</h2>
          {depositos.length === 0 ? (
            <p className="erp-muted">
              Sin depósitos o la tabla aún no existe. Aplicá el patch SQL en Supabase y recargá.
            </p>
          ) : (
            <ul style={{ margin: '0 0 12px 0', paddingLeft: 18, color: '#4a5568' }}>
              {depositos.map((d) => (
                <li key={d.id}>
                  <strong>{d.nombre}</strong>
                  {d.codigo ? <span className="erp-muted"> ({d.codigo})</span> : null} — #{d.id}
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
            <input
              type="text"
              placeholder="Nombre nuevo depósito"
              value={depNombre}
              onChange={(e) => setDepNombre(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <input
              type="text"
              placeholder="Código (opcional, único)"
              value={depCodigo}
              onChange={(e) => setDepCodigo(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <button type="button" className="btn-primary" disabled={savingDeposito} onClick={() => void handleCrearDeposito()}>
              {savingDeposito ? 'Guardando…' : 'Crear depósito'}
            </button>
          </div>
        </div>

        <div className="erp-panel">
          <h2>Transferencia entre depósitos</h2>
          <p className="erp-muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
            Requiere saldo en origen. Si no ves saldos, primero sincronizá el Principal con la existencia global del artículo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
            <label className="erp-muted" style={{ fontSize: '0.88rem' }}>
              Artículo
              <select
                value={transferArtId}
                onChange={(e) => setTransferArtId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                <option value="">Seleccionar…</option>
                {articulos.slice(0, 300).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    #{a.id} — {a.descripcion}
                  </option>
                ))}
              </select>
            </label>
            {saldosTransfer.length > 0 && (
              <div className="erp-muted" style={{ fontSize: '0.85rem' }}>
                Saldos por depósito:{' '}
                {saldosTransfer.map((s) => (
                  <span key={s.id_deposito} style={{ marginRight: 10 }}>
                    {s.deposito_nombre}: {s.cantidad}
                  </span>
                ))}
              </div>
            )}
            <label className="erp-muted" style={{ fontSize: '0.88rem' }}>
              Origen
              <select
                value={transferOrigen}
                onChange={(e) => setTransferOrigen(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                <option value="">—</option>
                {depositos.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-muted" style={{ fontSize: '0.88rem' }}>
              Destino
              <select
                value={transferDestino}
                onChange={(e) => setTransferDestino(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                <option value="">—</option>
                {depositos.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-muted" style={{ fontSize: '0.88rem' }}>
              Cantidad
              <input
                type="text"
                inputMode="decimal"
                value={transferCantidad}
                onChange={(e) => setTransferCantidad(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={transferSaving}
              onClick={() => void handleTransferir()}
            >
              {transferSaving ? 'Transfiriendo…' : 'Transferir'}
            </button>
          </div>
        </div>
      </div>

      <div className="erp-panel" style={{ marginBottom: 20 }}>
        <h2>Artículos</h2>
        <div className="erp-section-actions" style={{ marginBottom: 12 }}>
          <input
            type="search"
            placeholder="Buscar (mín. 2 caracteres)…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <label className="erp-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
            <input type="checkbox" checked={soloBajoMinimo} onChange={(e) => setSoloBajoMinimo(e.target.checked)} />
            Solo bajo mínimo
          </label>
          <button type="button" className="btn-secondary" onClick={() => void loadAll()} disabled={loading}>
            Actualizar
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={syncPrincipalLoading || articulos.length === 0}
            onClick={() => void handleSincronizarPrincipal()}
          >
            {syncPrincipalLoading ? 'Sincronizando…' : 'Sincronizar Principal (lista)'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={syncGlobalDesdeDepositosLoading || articulos.length === 0}
            onClick={() => void handleSincronizarStockGlobalDesdeDepositos()}
          >
            {syncGlobalDesdeDepositosLoading
              ? 'Alineando stock…'
              : 'Stock global = Σ depósitos (lista)'}
          </button>
        </div>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : articulos.length === 0 ? (
          <p className="erp-muted">Sin resultados. Probá otra búsqueda o revisá la conexión a la base de stock.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Sector</th>
                  <th>Stock</th>
                  <th>Mín.</th>
                  <th>Unidad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {articulos.slice(0, 200).map((a) => {
                  const s = Number(a.stock) || 0
                  const m = Number(a.stock_minimo) || 0
                  const alerta = s <= m
                  return (
                    <tr key={a.id}>
                      <td>{a.codigo || '—'}</td>
                      <td>{a.descripcion}</td>
                      <td>{a.sector || '—'}</td>
                      <td>
                        {s}
                        {alerta && <span className="erp-pill" style={{ marginLeft: 8 }}>Bajo mín.</span>}
                      </td>
                      <td>{m}</td>
                      <td>{a.unidad || '—'}</td>
                      <td>
                        <button type="button" className="btn-primary" onClick={() => openModal(a)}>
                          Movimiento
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {articulos.length > 200 && (
              <p className="erp-muted" style={{ marginTop: 8 }}>
                Mostrando 200 de {articulos.length}. Afiná la búsqueda en Gestión de stock.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="erp-panel">
        <h2>Movimientos recientes</h2>
        {movimientos.length === 0 ? (
          <p className="erp-muted">No hay movimientos registrados o aún no cargaron.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Artículo</th>
                  <th>Cant.</th>
                  <th>Anterior → Nuevo</th>
                  <th>Depósitos</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mv) => (
                  <tr key={mv.id}>
                    <td>{mv.created_at ? new Date(mv.created_at).toLocaleString('es-AR') : '—'}</td>
                    <td>{mv.tipo_movimiento}</td>
                    <td>{mv.descripcion || mv.codigo_articulo || `#${mv.id_articulo_stock}`}</td>
                    <td>{mv.cantidad}</td>
                    <td>
                      {mv.cantidad_anterior ?? '—'} → {mv.cantidad_nueva ?? '—'}
                    </td>
                    <td className="erp-muted" style={{ fontSize: '0.82rem' }}>
                      {mv.id_deposito_origen != null && <>O:{mv.id_deposito_origen} </>}
                      {mv.id_deposito_destino != null && <>D:{mv.id_deposito_destino}</>}
                      {mv.id_deposito_origen == null && mv.id_deposito_destino == null ? '—' : ''}
                    </td>
                    <td className="erp-muted" style={{ maxWidth: 220 }}>
                      {mv.motivo || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
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
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="erp-panel" style={{ maxWidth: 440, width: '100%' }} role="dialog" aria-modal="true">
            <h2 style={{ marginTop: 0 }}>Movimiento manual</h2>
            <p className="erp-muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
              <strong>Entrada / Salida:</strong> la cantidad es lo que se suma o resta del stock actual.
              <br />
              <strong>Ajuste:</strong> la cantidad es la existencia nueva (absoluta).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Artículo (id)
                <select
                  value={movForm.id_articulo_stock === '' ? '' : String(movForm.id_articulo_stock)}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, id_articulo_stock: e.target.value ? Number(e.target.value) : '' }))
                  }
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="">Seleccionar…</option>
                  {articulos.slice(0, 400).map((a) => (
                    <option key={a.id} value={a.id}>
                      #{a.id} — {a.descripcion}
                    </option>
                  ))}
                </select>
              </label>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Tipo
                <select
                  value={movForm.tipo_movimiento}
                  onChange={(e) =>
                    setMovForm((f) => ({
                      ...f,
                      tipo_movimiento: e.target.value as 'Entrada' | 'Salida' | 'Ajuste'
                    }))
                  }
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="Entrada">Entrada (+)</option>
                  <option value="Salida">Salida (−)</option>
                  <option value="Ajuste">Ajuste (existencia nueva)</option>
                </select>
              </label>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Cantidad
                <input
                  type="text"
                  inputMode="decimal"
                  value={movForm.cantidad}
                  onChange={(e) => setMovForm((f) => ({ ...f, cantidad: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
              <label className="erp-muted" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem' }}>
                Motivo (opcional)
                <input
                  type="text"
                  value={movForm.motivo}
                  onChange={(e) => setMovForm((f) => ({ ...f, motivo: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
            </div>
            <div className="erp-section-actions" style={{ marginTop: 18 }}>
              <button type="button" className="btn-secondary" disabled={savingMov} onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={savingMov} onClick={() => void handleAplicarMovimiento()}>
                {savingMov ? 'Guardando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
