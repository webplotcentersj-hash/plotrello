import { useEffect, useMemo, useState } from 'react'
import apiService from '../../../services/api'
import type { Venta } from '../../../types/api'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { downloadInformeVentasPeriodoPdf } from '../exportInformeVentasPeriodoPdf'
import { fmtArs, fmtDateAr } from '../format'
import {
  construirInformeVentasPeriodo,
  rangoInformeVentas,
  type InformeFilaNombre,
  type InformePeriodoModo,
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

function TablaNombre({
  titulo,
  filas,
  empty
}: {
  titulo: string
  filas: InformeFilaNombre[]
  empty?: string
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
                <th>Nombre</th>
                <th className="num">Monto</th>
                <th className="num">Cant.</th>
                <th className="num">%</th>
                <th aria-hidden className="caja-cc-informe-bar-col" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre}>
                  <td>{f.nombre}</td>
                  <td className="num">{money(f.monto)}</td>
                  <td className="num">{f.cantidad}</td>
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
            Semanales y mensuales con desglose por día, medio, vendedor, caja, productos y clientes.
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
            <TablaNombre titulo="Por vendedor" filas={informe.porVendedor} />
            <TablaNombre titulo="Por caja de cobro" filas={informe.porCaja} />
            <TablaNombre titulo="Por estado" filas={informe.porEstado} />
          </div>

          <div className="caja-cc-informe-grid">
            <TablaNombre titulo="Top productos" filas={informe.topProductos} empty="Sin ítems en las ventas del periodo." />
            <TablaNombre titulo="Top clientes" filas={informe.topClientes} />
          </div>

          <div className="caja-cc-card">
            <h3>Mayores ventas del periodo</h3>
            {informe.topVentas.length === 0 ? (
              <p className="caja-cc-muted">No hay ventas cobradas en este rango.</p>
            ) : (
              <div className="caja-cc-table-wrap">
                <table className="caja-cc-table">
                  <thead>
                    <tr>
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
                    {informe.topVentas.map((v) => (
                      <tr key={v.id}>
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
        </>
      )}
    </div>
  )
}
