import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { CuentaBancariaRecord } from '../types/api'
import {
  DEFAULT_CONFIG_CONDICIONES_VENTA,
  normalizarConfigCondicionesVenta,
  type ConfigCondicionesVenta,
  type MedioPagoCodigo,
  type TipoChequeConfig
} from '../constants/ventasCondicionesPago'
import { useConfigCondicionesVenta } from '../hooks/useConfigCondicionesVenta'
import './ErpSectionPage.css'
import './ErpConfigCondicionesVentaPage.css'

function newChequeTipoId(): string {
  return `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function listaComoTexto(items: string[]): string {
  return items.join('\n')
}

function textoComoLista(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ErpConfigCondicionesVentaPage() {
  const navigate = useNavigate()
  const { config, loading, saving, guardar } = useConfigCondicionesVenta()
  const [draft, setDraft] = useState<ConfigCondicionesVenta>(DEFAULT_CONFIG_CONDICIONES_VENTA)
  const [cuentas, setCuentas] = useState<CuentaBancariaRecord[]>([])
  const [plazosTexto, setPlazosTexto] = useState('')
  const [bancosTexto, setBancosTexto] = useState('')
  const [guardandoCuenta, setGuardandoCuenta] = useState<number | null>(null)

  useEffect(() => {
    setDraft(config)
    setPlazosTexto(listaComoTexto(config.plazos_cheque))
    setBancosTexto(listaComoTexto(config.bancos_cheque))
  }, [config])

  const cargarCuentas = useCallback(async () => {
    const res = await apiService.getCuentasBancarias()
    if (res.success && res.data) setCuentas(res.data)
  }, [])

  useEffect(() => {
    void cargarCuentas()
  }, [cargarCuentas])

  const toggleMedio = (codigo: MedioPagoCodigo, activo: boolean) => {
    setDraft((prev) => ({
      ...prev,
      medios: prev.medios.map((m) => (m.codigo === codigo ? { ...m, activo } : m))
    }))
  }

  const toggleCuentaTransferencia = (id: number) => {
    setDraft((prev) => {
      const ids = new Set(prev.cuentas_transferencia_ids)
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      return { ...prev, cuentas_transferencia_ids: [...ids] }
    })
  }

  const actualizarCuenta = async (cuenta: CuentaBancariaRecord, patch: Partial<CuentaBancariaRecord>) => {
    setGuardandoCuenta(cuenta.id)
    const res = await apiService.updateCuentaBancaria(cuenta.id, patch)
    setGuardandoCuenta(null)
    if (!res.success) {
      alert(res.error || 'No se pudo actualizar la cuenta')
      return
    }
    await cargarCuentas()
  }

  const actualizarTipoCheque = (id: string, patch: Partial<TipoChequeConfig>) => {
    setDraft((prev) => ({
      ...prev,
      tipos_cheque: prev.tipos_cheque.map((t) => (t.id === id ? { ...t, ...patch } : t))
    }))
  }

  const agregarTipoCheque = () => {
    setDraft((prev) => ({
      ...prev,
      tipos_cheque: [...prev.tipos_cheque, { id: newChequeTipoId(), label: 'Nuevo tipo', activo: true }]
    }))
  }

  const quitarTipoCheque = (id: string) => {
    setDraft((prev) => ({ ...prev, tipos_cheque: prev.tipos_cheque.filter((t) => t.id !== id) }))
  }

  const handleGuardar = async () => {
    const next: ConfigCondicionesVenta = {
      ...draft,
      plazos_cheque: textoComoLista(plazosTexto),
      bancos_cheque: textoComoLista(bancosTexto)
    }
    const ok = await guardar(normalizarConfigCondicionesVenta(next))
    if (!ok) alert('No se pudo guardar la configuración.')
  }

  return (
    <div className="erp-section ecv-page">
      <div className="erp-section-header">
        <div>
          <h1>💳 Condiciones de venta</h1>
          <p className="erp-section-sub">
            Medios de pago, cuentas para transferencia, tipos de cheque y Mercado Pago en venta rápida
          </p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/admin')}>
            ← Volver
          </button>
          <button type="button" className="btn-primary" disabled={loading || saving} onClick={() => void handleGuardar()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="erp-section-grid ecv-grid">
        <section className="erp-panel">
          <h2>Medios de pago activos</h2>
          <p className="erp-muted ecv-hint">
            Los medios habilitados aparecen en venta rápida y CRM. Mercado Pago genera QR al cobrar.
          </p>
          <div className="ecv-medios-list">
            {draft.medios.map((m) => (
              <label key={m.codigo} className="ecv-medio-row">
                <input
                  type="checkbox"
                  checked={m.activo}
                  onChange={(e) => toggleMedio(m.codigo, e.target.checked)}
                />
                <span className="ecv-medio-row__label">{m.label}</span>
                <span className="ecv-medio-row__meta">
                  Lista {m.lista_precio === 'lista_2' ? '2' : '1'}
                  {m.genera_qr_mp ? ' · QR MP' : ''}
                  {m.requiere_comprobante ? ' · Comprobante' : ''}
                </span>
              </label>
            ))}
          </div>
          <label className="ecv-check-row">
            <input
              type="checkbox"
              checked={draft.transferencia_requiere_comprobante}
              onChange={(e) =>
                setDraft((p) => ({ ...p, transferencia_requiere_comprobante: e.target.checked }))
              }
            />
            <span>Transferencia: exigir comprobante adjunto en venta rápida</span>
          </label>
        </section>

        <section className="erp-panel">
          <h2>Cuentas para transferencia</h2>
          <p className="erp-muted ecv-hint">
            Marcá las cuentas visibles en venta rápida. Si ninguna está seleccionada abajo, se usan las marcadas
            como &quot;Visible en venta rápida&quot;.
          </p>
          {cuentas.length === 0 ? (
            <p className="erp-muted">
              No hay cuentas bancarias.{' '}
              <button type="button" className="btn-link" onClick={() => navigate('/erp/tesoreria/cuentas')}>
                Crear en Tesorería
              </button>
            </p>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table ecv-cuentas-table">
                <thead>
                  <tr>
                    <th>Ofrecer</th>
                    <th>Cuenta</th>
                    <th>CBU/CVU</th>
                    <th>Alias</th>
                    <th>Titular</th>
                    <th>Visible VR</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={draft.cuentas_transferencia_ids.includes(c.id)}
                          onChange={() => toggleCuentaTransferencia(c.id)}
                        />
                      </td>
                      <td>
                        <strong>{c.nombre}</strong>
                        {c.banco ? <div className="ecv-cuenta-banco">{c.banco}</div> : null}
                      </td>
                      <td>
                        <input
                          className="ecv-input"
                          defaultValue={c.cbu ?? ''}
                          placeholder="CBU/CVU"
                          onBlur={(e) => {
                            if (e.target.value !== (c.cbu ?? '')) {
                              void actualizarCuenta(c, { cbu: e.target.value || null })
                            }
                          }}
                          disabled={guardandoCuenta === c.id}
                        />
                      </td>
                      <td>
                        <input
                          className="ecv-input"
                          defaultValue={c.alias_cvu ?? ''}
                          placeholder="alias.mp"
                          onBlur={(e) => {
                            if (e.target.value !== (c.alias_cvu ?? '')) {
                              void actualizarCuenta(c, { alias_cvu: e.target.value || null })
                            }
                          }}
                          disabled={guardandoCuenta === c.id}
                        />
                      </td>
                      <td>
                        <input
                          className="ecv-input"
                          defaultValue={c.titular ?? ''}
                          placeholder="Titular"
                          onBlur={(e) => {
                            if (e.target.value !== (c.titular ?? '')) {
                              void actualizarCuenta(c, { titular: e.target.value || null })
                            }
                          }}
                          disabled={guardandoCuenta === c.id}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(c.visible_venta_rapida)}
                          onChange={(e) => void actualizarCuenta(c, { visible_venta_rapida: e.target.checked })}
                          disabled={guardandoCuenta === c.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="erp-panel">
          <h2>Tipos de cheque</h2>
          <p className="erp-muted ecv-hint">Incluí físico, eCheq, CPD y otros que acepten.</p>
          <div className="ecv-cheque-list">
            {draft.tipos_cheque.map((t) => (
              <div key={t.id} className="ecv-cheque-row">
                <input
                  type="checkbox"
                  checked={t.activo}
                  onChange={(e) => actualizarTipoCheque(t.id, { activo: e.target.checked })}
                />
                <input
                  className="ecv-input ecv-input--grow"
                  value={t.label}
                  onChange={(e) => actualizarTipoCheque(t.id, { label: e.target.value })}
                />
                <button type="button" className="btn-link ecv-remove" onClick={() => quitarTipoCheque(t.id)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary ecv-add-btn" onClick={agregarTipoCheque}>
            + Agregar tipo
          </button>
        </section>

        <section className="erp-panel">
          <h2>Plazos y bancos (cheque)</h2>
          <div className="ecv-textareas">
            <label>
              Plazos (uno por línea)
              <textarea
                className="ecv-textarea"
                rows={5}
                value={plazosTexto}
                onChange={(e) => setPlazosTexto(e.target.value)}
              />
            </label>
            <label>
              Bancos emisores (uno por línea)
              <textarea
                className="ecv-textarea"
                rows={6}
                value={bancosTexto}
                onChange={(e) => setBancosTexto(e.target.value)}
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}
