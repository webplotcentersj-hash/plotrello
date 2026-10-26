import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  MOMENTOS,
  comisionDeVenta,
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
const variacion = (actual: number, anterior: number) => {
  if (!anterior) return 'Sin mes anterior con ventas'
  const delta = ((actual - anterior) / anterior) * 100
  const abs = Math.abs(delta).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  return delta >= 0 ? `${abs}% más que el mes anterior` : `${abs}% menos que el mes anterior`
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
  const [simulador, setSimulador] = useState({ monto: 100000, porcentaje: 3 })
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

  const totales = useMemo(() => {
    const filas = mesActualDatos?.vendedores || []
    return filas.reduce(
      (acc, r) => ({
        devengado: acc.devengado + (Number(r.devengado) || 0),
        pendiente: acc.pendiente + (Number(r.pendiente) || 0),
        base: acc.base + (Number(r.base_monto) || 0)
      }),
      { devengado: 0, pendiente: 0, base: 0 }
    )
  }, [mesActualDatos])

  const mesPrevio = useMemo(() => {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 2, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }, [mes])
  const mesPrevioDatos = useMemo(() => porMes.find((p) => p.mes === mesPrevio) || null, [porMes, mesPrevio])

  const ventasDelMes = useMemo(
    () => ventas.filter((v) => String(v.fecha_venta || '').slice(0, 7) === mes),
    [ventas, mes]
  )

  const cobroDelMes = useMemo(() => {
    const grupos = new Map<string, { cantidad: number; monto: number }>()
    for (const v of ventasDelMes) {
      const estado = v.estado_pago || 'Sin estado'
      const actual = grupos.get(estado) || { cantidad: 0, monto: 0 }
      actual.cantidad += 1
      actual.monto += Number(v.monto_pagado) || 0
      grupos.set(estado, actual)
    }
    return [...grupos.entries()].sort((a, b) => b[1].monto - a[1].monto)
  }, [ventasDelMes])

  const cobradoMes = useMemo(
    () => ventasDelMes.reduce((suma, v) => suma + (Number(v.monto_pagado) || 0), 0),
    [ventasDelMes]
  )
  const cobradoPorVendedor = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of ventasDelMes) {
      const clave = String(v.id_vendedor ?? '')
      map.set(clave, (map.get(clave) || 0) + (Number(v.monto_pagado) || 0))
    }
    return map
  }, [ventasDelMes])

  const ranking = useMemo(() => {
    const filas = [...(mesActualDatos?.vendedores || [])].sort((a, b) => Number(b.base_monto) - Number(a.base_monto))
    const max = Math.max(...filas.map((f) => Number(f.base_monto) || 0), 1)
    return { filas, max, total: Number(mesActualDatos?.base_monto) || 0 }
  }, [mesActualDatos])

  const mesesCronologicos = useMemo(() => [...porMes].sort((a, b) => a.mes.localeCompare(b.mes)), [porMes])
  const maxMes = useMemo(() => Math.max(...mesesCronologicos.map((p) => Number(p.base_monto) || 0), 1), [mesesCronologicos])

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

  const simulacion = useMemo(() => {
    if (!config) return null
    return comisionDeVenta(
      { valor_total: simulador.monto, estado_pago: 'Pagado', facturada: true },
        {
        base: 'total',
        momento: config.momento,
        alicuotaIva: 0,
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
            <div className="erp-stat-card__label">Precio de venta del mes</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">🧾</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{Number(mesActualDatos?.ventas) || 0}</div>
            <div className="erp-stat-card__label">Ventas del mes</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--cyan">
          <div className="erp-stat-card__icon">🏷️</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              {pesos((Number(mesActualDatos?.ventas) || 0) > 0 ? (Number(mesActualDatos?.base_monto) || 0) / Number(mesActualDatos?.ventas) : 0)}
            </div>
            <div className="erp-stat-card__label">Ticket promedio</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">✅</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{pesos(cobradoMes)}</div>
            <div className="erp-stat-card__label">
              Cobrado
              {(Number(mesActualDatos?.base_monto) || 0) > 0
                ? ` · ${((cobradoMes / Number(mesActualDatos?.base_monto)) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
                : ''}
            </div>
          </div>
        </article>
      </div>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <h2>Estadísticas de {etiquetaMes(mes)}</h2>
          <span className="erp-panel__hint">
            {variacion(Number(mesActualDatos?.base_monto) || 0, Number(mesPrevioDatos?.base_monto) || 0)} en precio de venta
            {' · '}
            {variacion(Number(mesActualDatos?.ventas) || 0, Number(mesPrevioDatos?.ventas) || 0)} en cantidad
          </span>
        </div>
        {config && Number(config.porcentaje_default) === 0 && totales.devengado === 0 && (
          <p className="erp-muted comisiones-ayuda">
            El porcentaje general está en 0, por eso la comisión del mes figura en $0. El precio y lo cobrado sí corresponden a las ventas.
          </p>
        )}
        <div className="comisiones-estadisticas">
          <div>
            <h3 className="comisiones-subtitulo">Participación por vendedor</h3>
            {ranking.filas.length === 0 ? (
              <p className="erp-muted">Sin ventas en {etiquetaMes(mes)}.</p>
            ) : (
              <ul className="comisiones-ranking">
                {ranking.filas.map((r) => {
                  const parte = ranking.total > 0 ? (Number(r.base_monto) / ranking.total) * 100 : 0
                  return (
                    <li key={`${r.id_vendedor}-${r.nombre_vendedor}`}>
                      <div className="comisiones-ranking__top">
                        <strong>{r.nombre_vendedor}</strong>
                        <span>
                          {r.ventas} ventas · {pesos(r.base_monto)} · {parte.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
                        </span>
                      </div>
                      <div className="comisiones-barra" aria-hidden>
                        <span style={{ width: `${(Number(r.base_monto) / ranking.max) * 100}%` }} />
                      </div>
                      <span className="erp-muted">
                        Cobrado {pesos(cobradoPorVendedor.get(String(r.id_vendedor ?? '')) || 0)} · comisión {pesos(r.devengado)} · pendiente {pesos(r.pendiente)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div>
            <h3 className="comisiones-subtitulo">Precio de venta por mes</h3>
            <ul className="comisiones-ranking">
              {mesesCronologicos.map((p) => (
                <li key={p.mes}>
                  <div className="comisiones-ranking__top">
                    <strong>{etiquetaMes(p.mes)}</strong>
                    <span>
                      {p.ventas} ventas · {pesos(p.base_monto)}
                    </span>
                  </div>
                  <div className="comisiones-barra" aria-hidden>
                    <span
                      className={p.mes === mes ? 'comisiones-barra__activa' : undefined}
                      style={{ width: `${(Number(p.base_monto) / maxMes) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="comisiones-subtitulo">Estado de cobro</h3>
            {cobroDelMes.length === 0 ? (
              <p className="erp-muted">Sin ventas en {etiquetaMes(mes)}.</p>
            ) : (
              <ul className="comisiones-cobro">
                {cobroDelMes.map(([estado, info]) => (
                  <li key={estado}>
                    <span>{estado}</span>
                    <strong>
                      {info.cantidad} · {pesos(info.monto)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {config && (
        <section className="erp-panel">
          <div className="erp-panel__head">
            <h2>Regla de cálculo</h2>
            <span className="erp-panel__hint">Al cambiarla hay que recalcular el período</span>
          </div>
          <div className="comisiones-config">
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
          </div>
          <p className="erp-muted comisiones-ayuda">
            La comisión es un porcentaje del precio de venta. {MOMENTOS.find((m) => m.value === config.momento)?.ayuda}.
          </p>

          <div className="comisiones-simulador">
            <strong>Simulador:</strong>
            <label className="erp-field erp-field--inline">
              <span className="erp-field__label">Precio de venta</span>
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
                Sobre {pesos(simulacion.base_monto)} → comisión <strong>{pesos(simulacion.comision)}</strong>
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
