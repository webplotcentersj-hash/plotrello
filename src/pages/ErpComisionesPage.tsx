import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ComisionesTablero from '../components/comisiones/ComisionesTablero'
import ComisionesConfiguracion from '../components/comisiones/ComisionesConfiguracion'
import { MOMENTOS } from '../features/comisiones/calculoComisiones'
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
  type ComisionMes,
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
const fechaAr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const etiquetaMes = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-')
  const nombre = MESES[Number(m) - 1] || yyyyMm
  return `${nombre} ${y}`
}
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
  const [porMes, setPorMes] = useState<ComisionMes[]>([])
  const [ventas, setVentas] = useState<ComisionVenta[]>([])
  const [pendienteTotal, setPendienteTotal] = useState(0)
  const [liquidaciones, setLiquidaciones] = useState<ComisionLiquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('todos')

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/')
  }, [authLoading, isAdmin, navigate])

  const anio = mes.slice(0, 4)
  const desdeAnio = `${anio}-01-01`
  const hastaAnio = `${anio}-12-31`

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const calc = await recalcularComisiones(desdeAnio, hastaAnio)
    const [cfg, lista, liqs] = await Promise.all([
      getConfigComisiones(),
      listarComisiones(desdeAnio, hastaAnio),
      listarLiquidaciones()
    ])
    if (!calc.success) setError(calc.error || 'No se pudieron calcular las comisiones')
    if (cfg.success && cfg.data) {
      setConfig(cfg.data.config)
      setVendedores(cfg.data.vendedores || [])
    } else setError(cfg.error || 'No se pudo cargar la configuración')
    if (lista.success && lista.data) {
      setPorMes(lista.data.por_mes || [])
      setVentas(lista.data.ventas || [])
      setPendienteTotal(Number(lista.data.pendiente_total) || 0)
    }
    if (liqs.success && liqs.data) setLiquidaciones(liqs.data)
    setCargando(false)
  }, [desdeAnio, hastaAnio])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const mesActualDatos = useMemo(() => porMes.find((p) => p.mes === mes) || null, [porMes, mes])

  const ventasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ventas.filter((v) => {
      if (vendedorFiltro !== 'todos' && String(v.id_vendedor ?? '') !== vendedorFiltro) return false
      if (!q) return true
      return [v.numero_venta, v.nombre_vendedor, v.nombre_cliente, v.estado_pago, v.metodo_pago]
        .some((campo) => String(campo || '').toLowerCase().includes(q))
    })
  }, [ventas, busqueda, vendedorFiltro])

  const ventasPorMes = useMemo(() => {
    const grupos = new Map<string, ComisionVenta[]>()
    for (const v of ventasVisibles) {
      const clave = String(v.fecha_venta || '').slice(0, 7)
      const lista = grupos.get(clave) || []
      lista.push(v)
      grupos.set(clave, lista)
    }
    return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [ventasVisibles])

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
    conAccion(() => guardarConfigComisiones(cambios), 'Configuración guardada. Las comisiones del año se recalcularon.')

  const handleRecalcular = () =>
    conAccion(async () => {
      const r = await recalcularComisiones(desdeAnio, hastaAnio)
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
                ? `Precio de venta · ${MOMENTOS.find((m) => m.value === config.momento)?.label}`
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

      {config ? (
        <ComisionesTablero
          mes={mes}
          onElegirMes={setMes}
          momento={config.momento}
          porcentajeGeneral={Number(config.porcentaje_default) || 0}
          porMes={porMes}
          ventas={ventas}
          vendedores={vendedores}
          pendienteTotal={pendienteTotal}
          liquidaciones={liquidaciones}
        />
      ) : cargando ? (
        <div className="erp-panel">
          <span className="erp-muted">Calculando comisiones…</span>
        </div>
      ) : null}

      {config ? (
        <ComisionesConfiguracion
          config={config}
          vendedores={vendedores}
          mes={mes}
          porMes={porMes}
          ventas={ventas}
          trabajando={trabajando}
          onGuardarConfig={handleGuardarConfig}
          onGuardarVendedor={(id, pct, activo, nombre) =>
            conAccion(() => guardarVendedorComision(id, pct, activo), `Actualizado ${nombre}. Las comisiones se recalcularon.`)
          }
        />
      ) : null}

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Comisiones de {anio}</h2>
          <span className="erp-panel__hint">Separadas por mes, según la fecha de la venta</span>
        </div>
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Ventas</th>
                <th>Precio de venta</th>
                <th>Devengado</th>
                <th>Liquidado</th>
                <th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {porMes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="erp-muted">
                    {cargando ? 'Calculando ventas…' : 'No hay ventas en el año.'}
                  </td>
                </tr>
              ) : (
                porMes.map((bloque) => (
                  <Fragment key={bloque.mes}>
                    <tr className={bloque.mes === mes ? 'comisiones-mes comisiones-mes--activo' : 'comisiones-mes'}>
                      <td colSpan={6}>
                        {etiquetaMes(bloque.mes)}
                        <span className="erp-muted">
                          {' '}
                          · {bloque.ventas} ventas · {pesos(bloque.base_monto)}
                        </span>
                      </td>
                    </tr>
                    {(bloque.vendedores || []).map((r) => (
                      <tr key={`${bloque.mes}-${r.id_vendedor}-${r.nombre_vendedor}`}>
                        <td>{r.nombre_vendedor}</td>
                        <td>{r.ventas}</td>
                        <td className="erp-td-monto">{pesos(r.base_monto)}</td>
                        <td className="erp-td-monto">{pesos(r.devengado)}</td>
                        <td className="erp-td-monto erp-muted">{pesos(r.liquidado)}</td>
                        <td className="erp-td-monto">{pesos(r.pendiente)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Detalle por venta</h2>
          <span className="erp-panel__hint">{ventasVisibles.length} ventas · agrupadas por mes</span>
        </div>
        <div className="comisiones-filtros">
          <label className="erp-field erp-field--inline">
            <span className="erp-field__label">Buscar</span>
            <input
              type="search"
              placeholder="Venta, cliente o vendedor"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <label className="erp-field erp-field--inline">
            <span className="erp-field__label">Vendedor</span>
            <select value={vendedorFiltro} onChange={(e) => setVendedorFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              {(mesActualDatos?.vendedores || []).map((r) => (
                <option key={`${r.id_vendedor}-${r.nombre_vendedor}`} value={String(r.id_vendedor ?? '')}>
                  {r.nombre_vendedor}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="erp-table-wrap comisiones-detalle">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Venta</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Precio</th>
                <th>Cobrado</th>
                <th>Cobro</th>
                <th>Medio</th>
                <th>%</th>
                <th>Comisión</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventasPorMes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="erp-muted">
                    {cargando ? 'Calculando ventas…' : 'Sin datos.'}
                  </td>
                </tr>
              ) : (
                ventasPorMes.map(([clave, filas]) => (
                  <Fragment key={clave}>
                    <tr className={clave === mes ? 'comisiones-mes comisiones-mes--activo' : 'comisiones-mes'}>
                      <td colSpan={11}>
                        {etiquetaMes(clave)}
                        <span className="erp-muted"> · {filas.length} ventas</span>
                      </td>
                    </tr>
                    {filas.map((v) => (
                      <tr key={v.id}>
                        <td>{fechaAr(v.fecha_venta)}</td>
                        <td>{v.numero_venta || v.id_venta}</td>
                        <td>{v.nombre_cliente || '—'}</td>
                        <td>{v.nombre_vendedor || '—'}</td>
                        <td className="erp-td-monto">{pesos(v.base_monto)}</td>
                        <td className="erp-td-monto">{pesos(v.monto_pagado)}</td>
                        <td>{v.estado_pago || '—'}</td>
                        <td>{v.metodo_pago || '—'}</td>
                        <td>{Number(v.porcentaje)}%</td>
                        <td className="erp-td-monto">{pesos(v.monto_devengado)}</td>
                        <td>
                          <span className={`erp-pill ${ESTADO_PILL[v.estado] || ''}`}>{v.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
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
