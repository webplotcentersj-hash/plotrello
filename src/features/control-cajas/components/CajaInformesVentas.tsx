import { useEffect, useMemo, useState } from 'react'
import apiService from '../../../services/api'
import type { Venta } from '../../../types/api'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { downloadInformeVentasPeriodoPdf } from '../exportInformeVentasPeriodoPdf'
import { fmtArs, fmtDateAr } from '../format'
import {
  construirInformeVentasPeriodo,
  INFORME_TOP_CLIENTES,
  INFORME_TOP_VENDEDORES,
  INFORME_TOP_VENTAS,
  rangoInformeVentas,
  type InformeFilaNombre,
  type InformePeriodoModo,
  type InformeVentaLinea,
  type InformeVentasPeriodo
} from '../informeVentasPeriodo'
import { yearMonthFromDate } from '../calendarioCajasData'

function money(n: number) {
  return `$ ${fmtArs(n)}`
}

function pctLabel(pct: number | null): string {
  if (pct == null) return 'Sin base previa'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function medal(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}º`
}

function TablaNombre({
  titulo,
  filas,
  empty,
  showTicket
}: {
  titulo: string
  filas: InformeFilaNombre[]
  empty?: string
  showTicket?: boolean
}) {
  return (
    <div className="caja-cc-card caja-cc-informe-block">
      <h3>{titulo}</h3>
      {filas.length === 0 ? (
        <p className="caja-cc-muted">{empty || 'Sin datos en el periodo.'}</p>
      ) : (
        <div className="caja-cc-table-wrap">
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Nombre</th>
                <th className="num">Monto</th>
                <th className="num">Cant.</th>
                {showTicket ? <th className="num">Ticket</th> : null}
                <th className="num">%</th>
                <th aria-hidden className="caja-cc-informe-bar-col" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.nombre} className={i < 3 ? 'caja-cc-informe-top-row' : undefined}>
                  <td className="num caja-cc-informe-rank">{medal(i + 1)}</td>
                  <td>{f.nombre}</td>
                  <td className="num">{money(f.monto)}</td>
                  <td className="num">{f.cantidad}</td>
                  {showTicket ? <td className="num">{money(f.ticketPromedio)}</td> : null}
                  <td className="num">{f.pct.toFixed(1)}%</td>
                  <td className="caja-cc-informe-bar-col">
                    <span
                      className="caja-cc-informe-bar"
                      style={{ width: `${Math.min(100, Math.max(2, f.pct))}%` }}
                      title={`${f.pct}%`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PodioTops({
  ventas,
  clientes,
  vendedores
}: {
  ventas: InformeVentaLinea[]
  clientes: InformeFilaNombre[]
  vendedores: InformeFilaNombre[]
}) {
  const topV = ventas.slice(0, 3)
  const topC = clientes.slice(0, 3)
  const topS = vendedores.slice(0, 3)

  return (
    <section className="caja-cc-informe-tops" aria-label="Rankings del periodo">
      <div className="caja-cc-informe-tops-head">
        <h3>Tops del periodo</h3>
        <p className="caja-cc-help">
          Ranking por cobrado · Top {INFORME_TOP_VENTAS} ventas · {INFORME_TOP_CLIENTES} clientes ·{' '}
          {INFORME_TOP_VENDEDORES} vendedores
        </p>
      </div>
      <div className="caja-cc-informe-tops-grid">
        <article className="caja-cc-card caja-cc-informe-podio">
          <header>
            <h4>Top ventas</h4>
            <span>Mayores tickets cobrados</span>
          </header>
          {topV.length === 0 ? (
            <p className="caja-cc-muted">Sin ventas cobradas.</p>
          ) : (
            <ol className="caja-cc-informe-podio-list">
              {topV.map((v, i) => (
                <li key={v.id}>
                  <span className="caja-cc-informe-podio-medal" aria-hidden>
                    {medal(i + 1)}
                  </span>
                  <div className="caja-cc-informe-podio-body">
                    <strong>{v.numero}</strong>
                    <span>
                      {v.cliente} · {fmtDateAr(v.fecha)}
                    </span>
                    <span className="caja-cc-informe-podio-meta">
                      {v.vendedor} · {v.metodo}
                    </span>
                  </div>
                  <strong className="caja-cc-informe-podio-monto">{money(v.cobrado)}</strong>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="caja-cc-card caja-cc-informe-podio">
          <header>
            <h4>Top clientes</h4>
            <span>Mayor facturación cobrada</span>
          </header>
          {topC.length === 0 ? (
            <p className="caja-cc-muted">Sin clientes en el periodo.</p>
          ) : (
            <ol className="caja-cc-informe-podio-list">
              {topC.map((c, i) => (
                <li key={c.nombre}>
                  <span className="caja-cc-informe-podio-medal" aria-hidden>
                    {medal(i + 1)}
                  </span>
                  <div className="caja-cc-informe-podio-body">
                    <strong>{c.nombre}</strong>
                    <span>
                      {c.cantidad} venta(s) · ticket {money(c.ticketPromedio)}
                    </span>
                    <span className="caja-cc-informe-podio-meta">{c.pct.toFixed(1)}% del cobrado</span>
                  </div>
                  <strong className="caja-cc-informe-podio-monto">{money(c.monto)}</strong>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="caja-cc-card caja-cc-informe-podio">
          <header>
            <h4>Top vendedores</h4>
            <span>Mayor cobrado del equipo</span>
          </header>
          {topS.length === 0 ? (
            <p className="caja-cc-muted">Sin vendedores en el periodo.</p>
          ) : (
            <ol className="caja-cc-informe-podio-list">
              {topS.map((s, i) => (
                <li key={s.nombre}>
                  <span className="caja-cc-informe-podio-medal" aria-hidden>
                    {medal(i + 1)}
                  </span>
                  <div className="caja-cc-informe-podio-body">
                    <strong>{s.nombre}</strong>
                    <span>
                      {s.cantidad} venta(s) · ticket {money(s.ticketPromedio)}
                    </span>
                    <span className="caja-cc-informe-podio-meta">{s.pct.toFixed(1)}% del cobrado</span>
                  </div>
                  <strong className="caja-cc-informe-podio-monto">{money(s.monto)}</strong>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  )
}

type Props = {
  /** Fecha ancla inicial (p. ej. día seleccionado del calendario). */
  anclaInicial?: string
  modoInicial?: InformePeriodoModo
}

export default function CajaInformesVentas({ anclaInicial, modoInicial = 'semana' }: Props) {
  const hoy = getArgentinaDateString()
  const [modo, setModo] = useState<InformePeriodoModo>(modoInicial)
  const [ancla, setAncla] = useState(() => anclaInicial || hoy)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [pdfBusy, setPdfBusy] = useState(false)

  const rango = useMemo(() => rangoInformeVentas(modo, ancla, hoy), [modo, ancla, hoy])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .obtenerVentas(undefined, rango.prevDesde, rango.hasta, 'todos')
      .then((res) => {
        if (cancelled) return
        if (!res.success) {
          setError(res.error || 'No se pudieron cargar las ventas.')
          setVentas([])
          setLoading(false)
          return
        }
        setVentas(res.data || [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rango.prevDesde, rango.hasta])

  const informe: InformeVentasPeriodo | null = useMemo(() => {
    if (loading) return null
    return construirInformeVentasPeriodo(ventas, {
      modo,
      desde: rango.desde,
      hasta: rango.hasta,
      labelPeriodo: rango.labelPeriodo,
      prevDesde: rango.prevDesde,
      prevHasta: rango.prevHasta,
      labelPrev: rango.labelPrev
    })
  }, [ventas, loading, modo, rango])

  const maxDia = useMemo(() => {
    if (!informe) return 1
    return Math.max(1, ...informe.porDia.map((d) => d.cobrado))
  }, [informe])

  const handlePdf = () => {
    if (!informe) return
    setPdfBusy(true)
    try {
      downloadInformeVentasPeriodoPdf(informe)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="caja-cc-informes">
      <div className="caja-cc-page-head">
        <div>
          <h2>Informes de ventas</h2>
          <p className="caja-cc-sub">
            Semanales y mensuales con tops de ventas, clientes y vendedores, más desglose por día, medio, caja y
            productos.
          </p>
        </div>
        <div className="caja-cc-page-head-actions">
          <button
            type="button"
            className="btn-primary btn-small"
            disabled={!informe || pdfBusy || loading}
            onClick={handlePdf}
          >
            {pdfBusy ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      <div className="caja-cc-card caja-cc-informe-filters">
        <div className="caja-cc-informe-modo" role="tablist" aria-label="Tipo de informe">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'semana'}
            className={`caja-cc-informe-modo-btn${modo === 'semana' ? ' is-active' : ''}`}
            onClick={() => setModo('semana')}
          >
            Semanal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'mes'}
            className={`caja-cc-informe-modo-btn${modo === 'mes' ? ' is-active' : ''}`}
            onClick={() => setModo('mes')}
          >
            Mensual
          </button>
        </div>

        {modo === 'semana' ? (
          <label className="caja-cc-informe-field">
            <span>Semana de</span>
            <input
              type="date"
              value={ancla}
              max={hoy}
              onChange={(e) => setAncla(e.target.value || hoy)}
            />
          </label>
        ) : (
          <label className="caja-cc-informe-field">
            <span>Mes</span>
            <input
              type="month"
              value={yearMonthFromDate(ancla)}
              max={yearMonthFromDate(hoy)}
              onChange={(e) => {
                const ym = e.target.value
                setAncla(ym ? `${ym}-01` : hoy)
              }}
            />
          </label>
        )}

        <p className="caja-cc-help caja-cc-informe-rango">
          {rango.labelPeriodo} · {fmtDateAr(rango.desde)} → {fmtDateAr(rango.hasta)}
          {rango.hasta === hoy ? ' (hasta hoy)' : ''}
        </p>
      </div>

      {loading && <p className="caja-cc-muted">Cargando ventas del periodo…</p>}
      {error && <p className="caja-cc-error">{error}</p>}

      {informe && !loading && (
        <>
          <div className="caja-cc-informe-kpis">
            <div className="caja-cc-hoy-hero-card ingreso">
              <span className="caja-cc-hoy-hero-label">Cobrado</span>
              <span className="caja-cc-hoy-hero-value">{money(informe.kpis.cobrado)}</span>
              <span
                className={`caja-cc-informe-delta${
                  (informe.kpis.pctVsPrev ?? 0) >= 0 ? ' is-up' : ' is-down'
                }`}
              >
                {pctLabel(informe.kpis.pctVsPrev)} vs {informe.labelPrev}
              </span>
            </div>
            <div className="caja-cc-hoy-hero-card ingreso">
              <span className="caja-cc-hoy-hero-label">Ticket promedio</span>
              <span className="caja-cc-hoy-acum-value">{money(informe.kpis.ticketPromedio)}</span>
              <span className="caja-cc-hoy-hero-hint">
                {informe.kpis.ventasCobradas} venta(s) cobrada(s) de {informe.kpis.ventasTotales}
              </span>
            </div>
            <div className="caja-cc-hoy-hero-card">
              <span className="caja-cc-hoy-hero-label">Estados</span>
              <span className="caja-cc-informe-estados">
                <span>Parciales {informe.kpis.parciales}</span>
                <span>Pendientes {informe.kpis.pendientes}</span>
                <span>Canceladas {informe.kpis.canceladas}</span>
              </span>
              <span className="caja-cc-hoy-hero-hint">Valor facturado {money(informe.kpis.valorTotal)}</span>
            </div>
          </div>

          <PodioTops
            ventas={informe.topVentas}
            clientes={informe.topClientes}
            vendedores={informe.topVendedores}
          />

          {(informe.mejorDia || informe.peorDia) && (
            <p className="caja-cc-help caja-cc-informe-extrema">
              {informe.mejorDia && (
                <>
                  Mejor día: <strong>{fmtDateAr(informe.mejorDia.fecha)}</strong> (
                  {money(informe.mejorDia.cobrado)})
                </>
              )}
              {informe.mejorDia &&
                informe.peorDia &&
                informe.peorDia.fecha !== informe.mejorDia.fecha &&
                ' · '}
              {informe.peorDia && informe.peorDia.fecha !== informe.mejorDia?.fecha && (
                <>
                  Menor cobro: <strong>{fmtDateAr(informe.peorDia.fecha)}</strong> (
                  {money(informe.peorDia.cobrado)})
                </>
              )}
            </p>
          )}

          <div className="caja-cc-informe-grid">
            <TablaNombre
              titulo={`Top vendedores (${informe.topVendedores.length})`}
              filas={informe.topVendedores}
              showTicket
            />
            <TablaNombre
              titulo={`Top clientes (${informe.topClientes.length})`}
              filas={informe.topClientes}
              showTicket
            />
          </div>

          <div className="caja-cc-card">
            <h3>Top ventas del periodo ({informe.topVentas.length})</h3>
            {informe.topVentas.length === 0 ? (
              <p className="caja-cc-muted">No hay ventas cobradas en este rango.</p>
            ) : (
              <div className="caja-cc-table-wrap">
                <table className="caja-cc-table">
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>N°</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Medio</th>
                      <th>Caja</th>
                      <th className="num">Cobrado</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.topVentas.map((v, i) => (
                      <tr key={v.id} className={i < 3 ? 'caja-cc-informe-top-row' : undefined}>
                        <td className="num caja-cc-informe-rank">{medal(i + 1)}</td>
                        <td>{v.numero}</td>
                        <td>{fmtDateAr(v.fecha)}</td>
                        <td>{v.cliente}</td>
                        <td>{v.vendedor}</td>
                        <td>{v.metodo}</td>
                        <td>{v.caja}</td>
                        <td className="num">{money(v.cobrado)}</td>
                        <td>{v.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="caja-cc-card">
            <h3>Cobrado por día</h3>
            <div className="caja-cc-informe-spark" role="img" aria-label="Barras de cobro diario">
              {informe.porDia.map((d) => (
                <div key={d.fecha} className="caja-cc-informe-spark-col" title={`${fmtDateAr(d.fecha)}: ${money(d.cobrado)}`}>
                  <span
                    className="caja-cc-informe-spark-bar"
                    style={{ height: `${Math.max(4, (d.cobrado / maxDia) * 100)}%` }}
                  />
                  <span className="caja-cc-informe-spark-label">{d.fecha.slice(8)}</span>
                </div>
              ))}
            </div>
            <div className="caja-cc-table-wrap">
              <table className="caja-cc-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Cobrado</th>
                    <th className="num">Ventas</th>
                    <th className="num">Pagadas</th>
                    <th className="num">Parcial</th>
                    <th className="num">Pend.</th>
                    <th className="num">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {informe.porDia.map((d) => (
                    <tr key={d.fecha} className={d.cobrado <= 0 && d.ventas <= 0 ? 'is-muted-row' : undefined}>
                      <td>{fmtDateAr(d.fecha)}</td>
                      <td className="num">{money(d.cobrado)}</td>
                      <td className="num">{d.ventas}</td>
                      <td className="num">{d.pagadas}</td>
                      <td className="num">{d.parciales}</td>
                      <td className="num">{d.pendientes}</td>
                      <td className="num">{money(d.ticketPromedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="caja-cc-informe-grid">
            <TablaNombre titulo="Por medio de pago" filas={informe.porMetodo} />
            <TablaNombre titulo="Por caja de cobro" filas={informe.porCaja} />
            <TablaNombre titulo="Por estado" filas={informe.porEstado} />
            <TablaNombre
              titulo="Top productos"
              filas={informe.topProductos}
              empty="Sin ítems en las ventas del periodo."
            />
          </div>
        </>
      )}
    </div>
  )
}
