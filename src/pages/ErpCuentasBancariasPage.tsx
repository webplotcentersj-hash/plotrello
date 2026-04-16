import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { CuentaBancariaRecord } from '../types/api'
import './ErpSectionPage.css'

export default function ErpCuentasBancariasPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CuentaBancariaRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre: '',
    banco: '',
    tipo: 'Banco',
    moneda: 'ARS',
    saldo_inicial: '0',
    activa: true
  })

  const resetForm = () =>
    setForm({
      nombre: '',
      banco: '',
      tipo: 'Banco',
      moneda: 'ARS',
      saldo_inicial: '0',
      activa: true
    })

  const load = async () => {
    setLoading(true)
    setError(null)
    const r = await apiService.getCuentasBancarias()
    if (r.success && r.data) setRows(r.data)
    else {
      setRows([])
      setError(r.error || 'No se pudieron cargar las cuentas.')
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const kpis = useMemo(() => {
    const activas = rows.filter((r) => r.activa).length
    return { total: rows.length, activas }
  }, [rows])

  const handleCreate = async () => {
    if (!form.nombre.trim()) {
      alert('El nombre es obligatorio.')
      return
    }
    const saldo = Number(String(form.saldo_inicial || '').replace(',', '.'))
    if (!Number.isFinite(saldo)) {
      alert('Saldo inicial inválido.')
      return
    }
    const r = await apiService.createCuentaBancaria({
      nombre: form.nombre.trim(),
      banco: form.banco.trim() || null,
      tipo: form.tipo.trim() || null,
      moneda: (form.moneda || 'ARS').trim(),
      saldo_inicial: saldo,
      activa: Boolean(form.activa)
    })
    if (!r.success) {
      alert('Error creando cuenta: ' + (r.error || 'desconocido'))
      return
    }
    resetForm()
    await load()
  }

  const toggleActiva = async (row: CuentaBancariaRecord) => {
    const r = await apiService.updateCuentaBancaria(row.id, { activa: !row.activa })
    if (!r.success) alert('Error actualizando: ' + (r.error || 'desconocido'))
    await load()
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🏦 Cuentas bancarias / cajas</h1>
          <p className="erp-section-sub">Catálogo para tesorería, pagos y cobros</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria')}>
            ← Volver a Tesorería
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
          <div className="erp-kpi">
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.total}</div>
              <div className="erp-kpi-label">Cuentas</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.activas}</div>
              <div className="erp-kpi-label">Activas</div>
            </div>
          </div>
        </div>

        <div className="erp-panel">
          <h2>Nueva cuenta</h2>
          <div className="erp-section-actions" style={{ marginBottom: 10 }}>
            <label className="erp-muted" style={{ flex: 1 }}>
              Nombre *
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                style={{ marginLeft: 8, width: 280, maxWidth: '100%' }}
              />
            </label>
            <label className="erp-muted" style={{ flex: 1 }}>
              Banco
              <input
                type="text"
                value={form.banco}
                onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))}
                style={{ marginLeft: 8, width: 220, maxWidth: '100%' }}
              />
            </label>
          </div>
          <div className="erp-section-actions" style={{ marginBottom: 10 }}>
            <label className="erp-muted">
              Tipo
              <input
                type="text"
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                style={{ marginLeft: 8, width: 160 }}
              />
            </label>
            <label className="erp-muted">
              Moneda
              <input
                type="text"
                value={form.moneda}
                onChange={(e) => setForm((p) => ({ ...p, moneda: e.target.value }))}
                style={{ marginLeft: 8, width: 90 }}
              />
            </label>
            <label className="erp-muted">
              Saldo inicial
              <input
                type="number"
                step="0.01"
                value={form.saldo_inicial}
                onChange={(e) => setForm((p) => ({ ...p, saldo_inicial: e.target.value }))}
                style={{ marginLeft: 8, width: 140 }}
              />
            </label>
            <label className="erp-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.activa}
                onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
              />
              Activa
            </label>
          </div>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={handleCreate}>
              Crear
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Listado</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="erp-muted">Sin cuentas.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Banco</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th>Saldo inicial</th>
                  <th>Activa</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td>{r.banco || '—'}</td>
                    <td>{r.tipo || '—'}</td>
                    <td>{r.moneda}</td>
                    <td>${Number(r.saldo_inicial || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{r.activa ? 'Sí' : 'No'}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => toggleActiva(r)}>
                        {r.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

