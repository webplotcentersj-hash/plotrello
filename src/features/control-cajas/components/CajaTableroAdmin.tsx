import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { buildCalendarioCajasIndex, yearMonthFromDate } from '../calendarioCajasData'
import { movimientosDelDia, mediosIngresosDia } from '../conciliacionDiaCaja'
import { downloadInformeDiaCajaPdf } from '../exportInformeDiaCajaPdf'
import { resumenAdminHoy } from '../cajaDashboardData'
import { sincronizarVentasPlotLabRango } from '../plotlabVentaCajaSync'
import { alertaDobleFuenteCaja } from '../plotlabVentasCajaData'
import { fmtArs, fmtDateAr } from '../format'
import {
  listArqueos,
  listCajas,
  listConcilBanco,
  listConcilMP,
  listEgresoSolicitudes,
  listMovimientos,
  listPlanillas,
  listTransferenciaLotes
} from '../cajaRepository'
import type { CajaMovimiento, CajaRegistro, CajaTransferenciaLote } from '../types'
import { resumenPorCajeroAdminDia } from '../cajaMenuOperativaData'
import CajaAdminCajerosResumen from './CajaAdminCajerosResumen'
import CajaCalendarioAdmin from './CajaCalendarioAdmin'
import CajaCierreTurnoDetalleModal from './CajaCierreTurnoDetalleModal'
import CajaDiaConciliacionPanel from './CajaDiaConciliacionPanel'
import CajaDiaResumenDetalleModal from './CajaDiaResumenDetalleModal'
import CajaMovimientoDetalleModal from './CajaMovimientoDetalleModal'
import CajaMovimientosList from './CajaMovimientosList'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Props = {
  onCierreTurno: () => void
  onEgresos: () => void
  refreshKey?: number
}

export default function CajaTableroAdmin({ onCierreTurno, onEgresos, refreshKey = 0 }: Props) {
  const hoy = getArgentinaDateString()
  const [selectedFecha, setSelectedFecha] = useState(hoy)
  const [yearMonth, setYearMonth] = useState(() => yearMonthFromDate(hoy))
  const [search, setSearch] = useState('')
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [lotes, setLotes] = useState<CajaTransferenciaLote[]>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [arqueos, setArqueos] = useState<Awaited<ReturnType<typeof listArqueos>>>([])
  const [egresos, setEgresos] = useState<Awaited<ReturnType<typeof listEgresoSolicitudes>>>([])
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [concilMp, setConcilMp] = useState<Awaited<ReturnType<typeof listConcilMP>>>([])
  const [concilBanco, setConcilBanco] = useState<Awaited<ReturnType<typeof listConcilBanco>>>([])
  const [loading, setLoading] = useState(true)
  const [detalleLote, setDetalleLote] = useState<CajaTransferenciaLote | null>(null)
  const [diaResumenTipo, setDiaResumenTipo] = useState<'ingreso' | 'egreso' | null>(null)
  const [detalleMovimiento, setDetalleMovimiento] = useState<CajaMovimiento | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    void Promise.all([
      listTransferenciaLotes(400),
      listPlanillas(300),
      listEgresoSolicitudes(),
      listArqueos(),
      listCajas(),
      listMovimientos(),
      listConcilMP(),
      listConcilBanco()
    ]).then(([l, p, e, a, c, m, mp, banco]) => {
      setLotes(l)
      setPlanillas(p)
      setEgresos(e)
      setArqueos(a)
      setCajas(c)
      setMovimientos(m)
      setConcilMp(mp)
      setConcilBanco(banco)
      setLoading(false)
    })
  }, [refreshKey])

  useEffect(() => {
    const onRefresh = () => {
      void listMovimientos().then(setMovimientos)
    }
    window.addEventListener('caja-datos-actualizados', onRefresh)
    return () => window.removeEventListener('caja-datos-actualizados', onRefresh)
  }, [])

  useEffect(() => {
    let cancelled = false
    void sincronizarVentasPlotLabRango(selectedFecha, selectedFecha).then((r) => {
      if (cancelled || (r.sincronizadas === 0 && r.errores === 0)) return
      void listMovimientos().then((m) => {
        if (!cancelled) setMovimientos(m)
      })
      if (r.sincronizadas > 0) {
        setSyncMsg(`${r.sincronizadas} venta(s) PlotLab sincronizada(s) al día.`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedFecha, refreshKey])

  const calendarioIndex = useMemo(
    () => buildCalendarioCajasIndex(lotes, planillas, arqueos, egresos, cajas, movimientos),
    [lotes, planillas, arqueos, egresos, cajas, movimientos]
  )

  const mediosDia = useMemo(
    () => mediosIngresosDia(movimientos, selectedFecha),
    [movimientos, selectedFecha]
  )

  const movsDia = useMemo(
    () => movimientosDelDia(movimientos, selectedFecha),
    [movimientos, selectedFecha]
  )

  const concilMpDia = useMemo(
    () => concilMp.find((c) => c.fecha === selectedFecha) ?? null,
    [concilMp, selectedFecha]
  )

  const concilBancoDia = useMemo(
    () => concilBanco.find((c) => c.fecha === selectedFecha) ?? null,
    [concilBanco, selectedFecha]
  )

  const resumenCajeros = useMemo(
    () => resumenPorCajeroAdminDia(selectedFecha, cajas, movimientos, arqueos, lotes),
    [selectedFecha, cajas, movimientos, arqueos, lotes]
  )

  const resumen = useMemo(
    () => resumenAdminHoy(selectedFecha, lotes, planillas, egresos, cajas, movimientos),
    [selectedFecha, lotes, planillas, egresos, cajas, movimientos]
  )

  const alertasDobleFuente = useMemo(() => {
    return cajas
      .filter((c) => c.activa && c.slug !== 'admin' && c.slug !== 'vuelto')
      .map((c) => alertaDobleFuenteCaja(selectedFecha, c.slug, planillas, movimientos))
      .filter((a) => a.activa)
  }, [selectedFecha, cajas, planillas, movimientos])

  const cajaNombre = (slug: string) => cajas.find((x) => x.slug === slug)?.nombre ?? slug

  const fondosTxt =
    resumen.fondosOperativas.length > 0
      ? resumen.fondosOperativas.map((f) => `${f.nombre} $ ${fmtArs(f.monto)}`).join(' · ')
      : `recomendado $ ${fmtArs(resumen.fondoRecomendado)}`

  const ingresoLabel =
    resumen.ingresoFuente === 'cierre_turno'
      ? 'Resto enviado a administración (cierres de turno)'
      : resumen.ingresoFuente === 'planilla'
        ? 'Ingresos en planillas PDF (aún sin cierre de turno)'
        : resumen.ingresoFuente === 'plotlab'
          ? 'Ingresos desde ventas PlotLab (mostrador / CRM)'
          : 'Sin cierres de turno ni planillas este día'

  const esHoy = selectedFecha === hoy
  const tituloDia = esHoy ? `Hoy — ${fmtDateAr(selectedFecha)}` : fmtDateAr(selectedFecha)

  const handlePdfDia = () => {
    setPdfBusy(true)
    try {
      downloadInformeDiaCajaPdf({
        fecha: selectedFecha,
        resumen,
        movimientos,
        cajas,
        planillas,
        egresos,
        lotes,
        arqueos,
        concilMp: concilMpDia,
        concilBanco: concilBancoDia
      })
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <>
      <CajaCalendarioAdmin
        yearMonth={yearMonth}
        onYearMonthChange={setYearMonth}
        selectedFecha={selectedFecha}
        onSelectFecha={setSelectedFecha}
        index={calendarioIndex}
        cajas={cajas}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="caja-cc-page-head">
        <div>
          <h2>{tituloDia}</h2>
          <p className="caja-cc-sub">
            Fondo en cajas de mostrador ({fondosTxt}, editable en cierre de turno): cada operador deja el fondo en su caja o lo traspasa a otra operativa;
            el resto ingresa a administración.
          </p>
        </div>
        <div className="caja-cc-page-head-actions">
          <button type="button" className="btn-primary btn-small" disabled={pdfBusy} onClick={handlePdfDia}>
            {pdfBusy ? 'Generando PDF…' : 'PDF del día'}
          </button>
          <CajaVolverPlotLab small />
        </div>
      </div>

      {alertasDobleFuente.length > 0 && (
        <div className="caja-cc-alerta-doble-fuente" role="alert">
          {alertasDobleFuente.map((a, i) => (
            <p key={i}>{a.mensaje}</p>
          ))}
        </div>
      )}

      {syncMsg && <p className="caja-cc-ok">{syncMsg}</p>}

      <CajaAdminCajerosResumen filas={resumenCajeros} fechaLabel={tituloDia} />

      {loading ? (
        <p className="caja-cc-muted">Cargando movimientos del calendario…</p>
      ) : (
        <>
          <div className="caja-cc-hoy-hero">
            <div
              className="caja-cc-hoy-hero-card ingreso caja-cc-hoy-hero-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => setDiaResumenTipo('ingreso')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setDiaResumenTipo('ingreso')
                }
              }}
              title="Ver detalle del ingreso del día"
            >
              <span className="caja-cc-hoy-hero-label">{esHoy ? 'Ingreso hoy' : 'Ingreso del día'}</span>
              <span className="caja-cc-hoy-hero-value">
                $ {fmtArs(mediosDia.totalCobrado > 0 ? mediosDia.totalCobrado : resumen.ingresoHoy)}
              </span>
              {mediosDia.cuenta_corriente > 0 && (
                <span className="caja-cc-hoy-hero-cc">
                  CC $ {fmtArs(mediosDia.cuenta_corriente)}
                </span>
              )}
              <span className="caja-cc-hoy-hero-hint">{ingresoLabel}</span>
            </div>
            <div
              className="caja-cc-hoy-hero-card egreso caja-cc-hoy-hero-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => setDiaResumenTipo('egreso')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setDiaResumenTipo('egreso')
                }
              }}
              title="Ver detalle de egresos del día"
            >
              <span className="caja-cc-hoy-hero-label">{esHoy ? 'Egresos hoy' : 'Egresos del día'}</span>
              <span className="caja-cc-hoy-hero-value">$ {fmtArs(resumen.egresosHoy)}</span>
              <span className="caja-cc-hoy-hero-hint">
                {resumen.egresosPendientes > 0
                  ? `${resumen.egresosPendientes} egreso(s) pendiente(s) de aprobar`
                  : 'Egresos aprobados del día (todas las cajas)'}
              </span>
              {resumen.egresosPendientes > 0 && (
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEgresos()
                  }}
                >
                  Ver egresos
                </button>
              )}
            </div>
          </div>

          <CajaDiaConciliacionPanel
            fecha={selectedFecha}
            movimientos={movimientos}
            planillas={planillas}
            concilMp={concilMpDia}
            concilBanco={concilBancoDia}
          />

          {movsDia.length > 0 && (
            <div className="caja-cc-card caja-cc-card-collapsible is-open">
              <div className="caja-cc-card-collapsible-head caja-cc-movs-dia-head">
                <h3>Movimientos del día — {fmtDateAr(selectedFecha)}</h3>
                <span className="caja-cc-card-collapsible-badge">{movsDia.length}</span>
                <button
                  type="button"
                  className="btn-primary btn-small caja-cc-movs-dia-pdf"
                  disabled={pdfBusy}
                  onClick={handlePdfDia}
                >
                  {pdfBusy ? 'Generando…' : 'Descargar PDF del día'}
                </button>
              </div>
              <div className="caja-cc-card-collapsible-body caja-cc-card-body-scroll">
                <p className="caja-cc-help">
                  Ventas PlotLab, cierres de turno, arqueos y conciliación incluidos en el PDF. Tocá un
                  movimiento para el detalle individual.
                </p>
                <CajaMovimientosList
                  movimientos={movsDia}
                  cajas={cajas}
                  showUsuario
                  onSelect={setDetalleMovimiento}
                />
              </div>
            </div>
          )}

          {esHoy && (
            <div className="caja-cc-card caja-cc-fondo-regla">
              <h3>Regla del cierre de turno</h3>
              <ol className="caja-cc-steps-simple">
                <li>
                  <strong>Fondo</strong> (recomendado $ {fmtArs(resumen.fondoRecomendado)}, editable en cierre de turno) —
                  se traspasa a otra caja operativa si corresponde.
                </li>
                <li>
                  <strong>Resto del arqueo</strong> (menos egresos del día) — va a <strong>Caja Administración</strong>.
                </li>
                <li>
                  En el cierre se sube el <strong>PDF planilla</strong> y los <strong>comprobantes</strong> MP / tarjetas.
                </li>
              </ol>
              <button type="button" className="btn-primary" onClick={onCierreTurno}>
                Ir a cierre de turno
              </button>
            </div>
          )}

          {resumen.cierresTurnoHoy.length > 0 && (
            <div className="caja-cc-card">
              <h3>Cierres de turno — {fmtDateAr(selectedFecha)}</h3>
              <p className="caja-cc-help">Tocá una fila para ver planilla, comprobantes, hora y quién cerró.</p>
              <table className="caja-cc-table caja-cc-table-clickable">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Caja origen</th>
                    <th>Fondo →</th>
                    <th className="num">A administración</th>
                    <th>Cajera</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.cierresTurnoHoy.map((l) => (
                    <tr
                      key={l.id}
                      className="caja-cc-row-clickable"
                      onClick={() => setDetalleLote(l)}
                      title="Ver detalle del cierre"
                    >
                      <td>{l.hora ?? '—'}</td>
                      <td>{cajaNombre(l.origen_slug)}</td>
                      <td>{cajaNombre(l.caja_fondo_destino_slug)}</td>
                      <td className="num">$ {fmtArs((l.resto_efectivo || 0) + (l.resto_otros || 0))}</td>
                      <td>{l.usuario_nombre ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resumen.cierresTurnoHoy.length === 0 &&
            resumen.ingresoHoy <= 0 &&
            resumen.egresosHoy <= 0 &&
            movsDia.length === 0 && (
              <p className="caja-cc-muted caja-cc-empty-day">
                Sin cierres de turno ni movimientos registrados para este día.
              </p>
            )}
        </>
      )}

      {detalleLote && (
        <CajaCierreTurnoDetalleModal lote={detalleLote} cajas={cajas} onClose={() => setDetalleLote(null)} />
      )}

      {diaResumenTipo && (
        <CajaDiaResumenDetalleModal
          tipo={diaResumenTipo}
          fecha={selectedFecha}
          esHoy={esHoy}
          resumen={resumen}
          planillas={planillas}
          egresos={egresos}
          movimientos={movimientos}
          cajas={cajas}
          onClose={() => setDiaResumenTipo(null)}
        />
      )}

      {detalleMovimiento && (
        <CajaMovimientoDetalleModal
          movimiento={detalleMovimiento}
          cajas={cajas}
          onClose={() => setDetalleMovimiento(null)}
        />
      )}
    </>
  )
}
