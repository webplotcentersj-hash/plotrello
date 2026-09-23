import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  BASES,
  MOMENTOS,
  comisionDeVenta,
  type BaseComision,
  type MomentoComision
} from '../features/comisiones/calculoComisiones'
import {
  cambiarEstadoLiquidacion,
  generarLiquidacion,
  getConfigComisiones,
  guardarConfigComisiones,
  guardarVendedorComision,
  listarComisiones,
  listarLiquidaciones,
  recalcularComisiones,
  type ComisionConfig,
  type ComisionLiquidacion,
  type ComisionResumenVendedor,
  type ComisionVendedor,
  type ComisionVenta
} from '../services/comisionesApi'
import './ErpSectionPage.css'
import './ErpComisionesPage.css'

const pesos = (n: unknown) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const mesActual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const rangoDelMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  const desde = `${mes}-01`
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { desde, hasta }
}
const fechaAr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

const ESTADO_PILL: Record<string, string> = {
  pendiente: '',
  parcial: 'warn',
  liquidada: 'ok',
  anulada: 'danger',
  borrador: '',
  aprobada: 'warn',
  pagada: 'ok'
}

export default function ErpComisionesPage() {
  const navigate = useNavigate()
  const { isAdmin, loading: authLoading } = useAuth()

  const [mes, setMes] = useState(mesActual)
  const [config, setConfig] = useState<ComisionConfig | null>(null)
  const [vendedores, setVendedores] = useState<ComisionVendedor[]>([])
  const [resumen, setResumen] = useState<ComisionResumenVendedor[]>([])
  const [ventas, setVentas] = useState<ComisionVenta[]>([])
  const [pendienteTotal, setPendienteTotal] = useState(0)
  const [liquidaciones, setLiquidaciones] = useState<ComisionLiquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [simulador, setSimulador] = useState({ monto: 100000, porcentaje: 3 })

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/')
  }, [authLoading, isAdmin, navigate])

  const { desde, hasta } = useMemo(() => rangoDelMes(mes), [mes])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const [cfg, lista, liqs] = await Promise.all([
      getConfigComisiones(),
      listarComisiones(desde, hasta),
      listarLiquidaciones()
    ])
    if (cfg.success && cfg.data) {
      setConfig(cfg.data.config)
      setVendedores(cfg.data.vendedores || [])
    } else setError(cfg.error || 'No se pudo cargar la configuración')
    if (lista.success && lista.data) {
      setResumen(lista.data.por_vendedor || [])
      setVentas(lista.data.ventas || [])
      setPendienteTotal(Number(lista.data.pendiente_total) || 0)
    }
    if (liqs.success && liqs.data) setLiquidaciones(liqs.data)
    setCargando(false)
  }, [desde, hasta])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const totales = useMemo(
    () =>
      resumen.reduce(
        (acc, r) => ({
          devengado: acc.devengado + (Number(r.devengado) || 0),
          pendiente: acc.pendiente + (Number(r.pendiente) || 0),
          base: acc.base + (Number(r.base_monto) || 0)
        }),
        { devengado: 0, pendiente: 0, base: 0 }
      ),
    [resumen]
  )

  const simulacion = useMemo(() => {
    if (!config) return null
    return comisionDeVenta(
      { valor_total: simulador.monto, estado_pago: 'Pagado', facturada: true },
      {
        base: config.base,
        momento: config.momento,
        alicuotaIva: Number(config.alicuota_iva),
        porcentaje: simulador.porcentaje
      }
    )
  }, [config, simulador])

  const conAccion = async (
    accion: () => Promise<{ success: boolean; error?: string; mensaje?: string }>,
    ok: string
  ) => {
    setTrabajando(true)
    setMensaje(null)
    setError(null)
    const r = await accion()
    if (r.success) setMensaje(r.mensaje || ok)
    else setError(r.error || 'Error')
    setTrabajando(false)
    await cargar()
  }

  const handleGuardarConfig = (cambios: Partial<ComisionConfig>) =>
    conAccion(() => guardarConfigComisiones(cambios), 'Configuración guardada. Recalculá el período para aplicarla.')

  const handleRecalcular = () =>
    conAccion(async () => {
      const r = await recalcularComisiones(desde, hasta)
      const mensaje = r.data ? `Recalculadas ${r.data.procesadas} ventas · ${pesos(r.data.devengado)} devengados.` : undefined
      return { ...r, mensaje }
    }, 'Recalculado.')

  const handleGenerarLiquidacion = () =>
    conAccion(async () => {
      const r = await generarLiquidacion(`${mes}-01`)
      const mensaje = r.data
        ? r.data.liquidaciones > 0
          ? `${r.data.liquidaciones} liquidación(es) en borrador para ${mes}.`
          : 'No hay comisiones pendientes para liquidar.'
        : undefined
      return { ...r, mensaje }
    }, 'Liquidación generada.')

  if (authLoading || !isAdmin) return null

  return (
    <div className="erp-section">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            🤝
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Contable</p>
            <h1>Comisiones por ventas</h1>
            <p className="erp-section-sub">
              {config
                ? `${BASES.find((b) => b.value === config.base)?.label} · ${MOMENTOS.find((m) => m.value === config.momento)?.label}`
                : 'Cargando configuración…'}
            </p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <label className="erp-field erp-field--inline">
            <span className="erp-field__label">Mes</span>
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value || mesActual())} />
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRecalcular}
            disabled={trabajando}
            title="Recalcula el mes elegido y, además, las ventas de los 12 meses anteriores que todavía no están liquidadas (por ejemplo, una venta vieja que recién se cobró)"
          >
            Recalcular período
          </button>
          <button type="button" className="btn-primary" onClick={handleGenerarLiquidacion} disabled={trabajando}>
            Generar liquidación
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}
      {mensaje && (
        <div className="erp-panel">
          <span className="erp-pill ok">OK</span> <span className="erp-muted">{mensaje}</span>
        </div>
      )}

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">💵</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{pesos(totales.devengado)}</div>
            <div className="erp-stat-card__label">Devengado del mes</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">⏳</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{pesos(pendienteTotal)}</div>
            <div className="erp-stat-card__label">Pendiente de pago (total)</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--sky">
          <div className="erp-stat-card__icon">📊</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{pesos(totales.base)}</div>
            <div className="erp-stat-card__label">Base comisionable del mes</div>
          </div>
        </article>
      </div>

      {config && (
        <section className="erp-panel">
          <div className="erp-panel__head">
            <h2>Regla de cálculo</h2>
            <span className="erp-panel__hint">Al cambiarla hay que recalcular el período</span>
          </div>
          <div className="comisiones-config">
            <label className="erp-field">
              <span className="erp-field__label">Base</span>
              <select
                value={config.base}
                disabled={trabajando}
                onChange={(e) => handleGuardarConfig({ base: e.target.value as BaseComision })}
              >
                {BASES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Se gana</span>
              <select
                value={config.momento}
                disabled={trabajando}
                onChange={(e) => handleGuardarConfig({ momento: e.target.value as MomentoComision })}
              >
                {MOMENTOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">% general</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={config.porcentaje_default}
                disabled={trabajando}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v !== Number(config.porcentaje_default)) handleGuardarConfig({ porcentaje_default: v })
                }}
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">IVA % (para el neto)</span>
              <input
                type="number"
                min="0"
                max="99"
                step="0.5"
                defaultValue={config.alicuota_iva}
                disabled={trabajando}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v !== Number(config.alicuota_iva)) handleGuardarConfig({ alicuota_iva: v })
                }}
              />
            </label>
          </div>
          <p className="erp-muted comisiones-ayuda">{MOMENTOS.find((m) => m.value === config.momento)?.ayuda}.</p>

          <div className="comisiones-simulador">
            <strong>Simulador:</strong>
            <label className="erp-field erp-field--inline">
              <span className="erp-field__label">Venta cobrada</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={simulador.monto}
                onChange={(e) => setSimulador((s) => ({ ...s, monto: Number(e.target.value) || 0 }))}
              />
            </label>
            <label className="erp-field erp-field--inline">
              <span className="erp-field__label">%</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={simulador.porcentaje}
                onChange={(e) => setSimulador((s) => ({ ...s, porcentaje: Number(e.target.value) || 0 }))}
              />
            </label>
            {simulacion && (
              <span className="erp-muted">
                Base {pesos(simulacion.base_monto)} → comisión <strong>{pesos(simulacion.comision)}</strong>
              </span>
            )}
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Porcentaje por vendedor</h2>
          <span className="erp-panel__hint">Sin porcentaje propio se usa el general ({config?.porcentaje_default ?? 0}%)</span>
        </div>
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Rol</th>
                <th>Ventas</th>
                <th>%</th>
                <th>Comisiona</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="erp-muted">
                    {cargando ? 'Cargando…' : 'No hay usuarios con ventas registradas.'}
                  </td>
                </tr>
              ) : (
                vendedores.map((v) => (
                  <tr key={v.id_usuario}>
                    <td>{v.nombre}</td>
                    <td className="erp-muted">{v.rol}</td>
                    <td>{v.ventas}</td>
                    <td>
                      <input
                        type="number"
                        className="comisiones-input-pct"
                        min="0"
                        max="100"
                        step="0.1"
                        defaultValue={v.porcentaje}
                        disabled={trabajando}
                        onBlur={(e) => {
                          const pct = Number(e.target.value)
                          if (Number.isFinite(pct) && pct !== Number(v.porcentaje)) {
                            void conAccion(() => guardarVendedorComision(v.id_usuario, pct, v.activo), `Actualizado ${v.nombre}.`)
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={v.activo}
                        disabled={trabajando}
                        onChange={(e) =>
                          void conAccion(
                            () => guardarVendedorComision(v.id_usuario, v.porcentaje, e.target.checked),
                            `Actualizado ${v.nombre}.`
                          )
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Comisiones de {mes}</h2>
          <span className="erp-panel__hint">Por vendedor, según la fecha de la venta</span>
        </div>
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Ventas</th>
                <th>Base</th>
                <th>Devengado</th>
                <th>Liquidado</th>
                <th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {resumen.length === 0 ? (
                <tr>
                  <td colSpan={6} className="erp-muted">
                    {cargando ? 'Cargando…' : 'Sin comisiones calculadas en el mes. Probá "Recalcular período".'}
                  </td>
                </tr>
              ) : (
                resumen.map((r) => (
                  <tr key={`${r.id_vendedor}-${r.nombre_vendedor}`}>
                    <td>{r.nombre_vendedor}</td>
                    <td>{r.ventas}</td>
                    <td className="erp-td-monto">{pesos(r.base_monto)}</td>
                    <td className="erp-td-monto">{pesos(r.devengado)}</td>
                    <td className="erp-td-monto erp-muted">{pesos(r.liquidado)}</td>
                    <td className="erp-td-monto">{pesos(r.pendiente)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Detalle por venta</h2>
          <span className="erp-panel__hint">Últimas 500 del período</span>
        </div>
        <div className="erp-table-wrap comisiones-detalle">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Venta</th>
                <th>Vendedor</th>
                <th>Total</th>
                <th>Cobrado</th>
                <th>Base</th>
                <th>%</th>
                <th>Comisión</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="erp-muted">
                    {cargando ? 'Cargando…' : 'Sin datos.'}
                  </td>
                </tr>
              ) : (
                ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{fechaAr(v.fecha_venta)}</td>
                    <td>{v.numero_venta || v.id_venta}</td>
                    <td>{v.nombre_vendedor || '—'}</td>
                    <td className="erp-td-monto">{pesos(v.monto_venta)}</td>
                    <td className="erp-td-monto">{pesos(v.monto_cobrado)}</td>
                    <td className="erp-td-monto">{pesos(v.base_monto)}</td>
                    <td>{Number(v.porcentaje)}%</td>
                    <td className="erp-td-monto">{pesos(v.monto_devengado)}</td>
                    <td>
                      <span className={`erp-pill ${ESTADO_PILL[v.estado] || ''}`}>{v.estado}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Liquidaciones</h2>
          <span className="erp-panel__hint">Se paga lo cobrado: puede incluir ventas de meses anteriores</span>
        </div>
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Vendedor</th>
                <th>Ventas</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="erp-muted">
                    {cargando ? 'Cargando…' : 'Todavía no hay liquidaciones.'}
                  </td>
                </tr>
              ) : (
                liquidaciones.map((l) => (
                  <tr key={l.id}>
                    <td>{String(l.periodo).slice(0, 7)}</td>
                    <td>{l.nombre_vendedor || l.id_vendedor}</td>
                    <td>{l.items?.length ?? 0}</td>
                    <td className="erp-td-monto">{pesos(l.total)}</td>
                    <td>
                      <span className={`erp-pill ${ESTADO_PILL[l.estado] || ''}`}>{l.estado}</span>
                    </td>
                    <td className="erp-muted">{fechaAr(l.fecha_pago)}</td>
                    <td className="comisiones-acciones">
                      {l.estado === 'borrador' && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={trabajando}
                          onClick={() =>
                            void conAccion(() => cambiarEstadoLiquidacion(l.id, 'aprobada'), 'Liquidación aprobada.')
                          }
                        >
                          Aprobar
                        </button>
                      )}
                      {l.estado === 'aprobada' && (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={trabajando}
                          onClick={() => {
                            if (!confirm(`¿Marcar como pagada la liquidación de ${l.nombre_vendedor} por ${pesos(l.total)}?`)) return
                            void conAccion(
                              () => cambiarEstadoLiquidacion(l.id, 'pagada', { fechaPago: new Date().toISOString().slice(0, 10) }),
                              'Liquidación pagada.'
                            )
                          }}
                        >
                          Marcar pagada
                        </button>
                      )}
                      {l.estado !== 'pagada' && l.estado !== 'anulada' && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={trabajando}
                          onClick={() => {
                            if (!confirm('¿Anular esta liquidación?')) return
                            void conAccion(() => cambiarEstadoLiquidacion(l.id, 'anulada'), 'Liquidación anulada.')
                          }}
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
