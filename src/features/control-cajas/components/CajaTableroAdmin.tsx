import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import apiService from '../../../services/api'
import type { Venta } from '../../../types/api'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { buildCalendarioCajasIndex, yearMonthFromDate } from '../calendarioCajasData'
import { movimientosDelDia, mediosIngresosDia, ventasMpPagadasIds } from '../conciliacionDiaCaja'
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
import { ingresosAcumuladosHasta } from '../ingresosAcumulados'
import {
  montoIngresoHeroDia,
  subtituloIngresoDia,
  tituloIngresoDia
} from '../movimientoDetalle'
import CajaAdminCajerosResumen from './CajaAdminCajerosResumen'
import CajaCalendarioAdmin from './CajaCalendarioAdmin'
import CajaCierreTurnoDetalleModal from './CajaCierreTurnoDetalleModal'
import CajaDiaConciliacionPanel from './CajaDiaConciliacionPanel'
import CajaDiaResumenDetalleModal from './CajaDiaResumenDetalleModal'
import CajaMovimientoDetalleModal from './CajaMovimientoDetalleModal'
import CajaMovimientosList from './CajaMovimientosList'

type Props = {
  onCierreTurno: () => void
  onEgresos: () => void
  onInformes?: (modo: 'semana' | 'mes') => void
  refreshKey?: number
}

export default function CajaTableroAdmin({
  onCierreTurno,
  onEgresos,
  onInformes,
  refreshKey = 0
}: Props) {
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
  const [ventasDia, setVentasDia] = useState<Venta[]>([])
  /** Día de los paneles pesados: el calendario pinta el click al toque; el detalle alcanza después. */
  const deferredFecha = useDeferredValue(selectedFecha)
  const diaBusy = deferredFecha !== selectedFecha

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

  // Sync PlotLab solo del día de hoy (al entrar / refrescar). Navegar el calendario no debe
  // re-sincronizar ventas día por día: eso hacía que cambiar de fecha se sienta trabado.
  useEffect(() => {
    let cancelled = false
    void sincronizarVentasPlotLabRango(hoy, hoy).then((r) => {
      if (cancelled || r.sincronizadas === 0) return
      void listMovimientos().then((m) => {
        if (!cancelled) setMovimientos(m)
      })
      setSyncMsg(`${r.sincronizadas} venta(s) PlotLab sincronizada(s) al día.`)
    })
    return () => {
      cancelled = true
    }
  }, [hoy, refreshKey])

  useEffect(() => {
    let cancelled = false
    void apiService.obtenerVentas(undefined, deferredFecha, deferredFecha).then((res) => {
      if (cancelled) return
      setVentasDia(res.success && res.data ? res.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [deferredFecha, refreshKey])

  const ventasMpPagadas = useMemo(() => ventasMpPagadasIds(ventasDia), [ventasDia])

  const calendarioIndex = useMemo(
    () => buildCalendarioCajasIndex(lotes, planillas, arqueos, egresos, cajas, movimientos),
    [lotes, planillas, arqueos, egresos, cajas, movimientos]
  )

  const mediosDia = useMemo(
    () => mediosIngresosDia(movimientos, deferredFecha, ventasMpPagadas),
    [movimientos, deferredFecha, ventasMpPagadas]
  )

  const movsDia = useMemo(
    () => movimientosDelDia(movimientos, deferredFecha),
    [movimientos, deferredFecha]
  )

  const concilMpDia = useMemo(
    () => concilMp.find((c) => c.fecha === deferredFecha) ?? null,
    [concilMp, deferredFecha]
  )

  const concilBancoDia = useMemo(
    () => concilBanco.find((c) => c.fecha === deferredFecha) ?? null,
    [concilBanco, deferredFecha]
  )

  const resumenCajeros = useMemo(
    () => resumenPorCajeroAdminDia(deferredFecha, cajas, movimientos, arqueos, lotes),
    [deferredFecha, cajas, movimientos, arqueos, lotes]
  )

  const resumen = useMemo(
    () => resumenAdminHoy(deferredFecha, lotes, planillas, egresos, cajas, movimientos),
    [deferredFecha, lotes, planillas, egresos, cajas, movimientos]
  )

  const ingresosAcum = useMemo(
    () => ingresosAcumuladosHasta(deferredFecha, planillas, movimientos),
    [deferredFecha, planillas, movimientos]
  )

  const labelMesAcum = useMemo(() => {
    const [y, m] = deferredFecha.split('-')
    if (!y || !m) return deferredFecha.slice(0, 7)
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1))
    const mes = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(d)
    const mesCap = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : mes
    return `${mesCap} ${y}`
  }, [deferredFecha])

  const alertasDobleFuente = useMemo(() => {
    return cajas
      .filter((c) => c.activa && c.slug !== 'admin' && c.slug !== 'vuelto')
      .map((c) => alertaDobleFuenteCaja(deferredFecha, c.slug, planillas, movimientos))
      .filter((a) => a.activa)
  }, [deferredFecha, cajas, planillas, movimientos])

  const cajaNombre = (slug: string) => cajas.find((x) => x.slug === slug)?.nombre ?? slug

  const fondosTxt =
    resumen.fondosOperativas.length > 0
      ? resumen.fondosOperativas.map((f) => `${f.nombre} $ ${fmtArs(f.monto)}`).join(' · ')
      : 'sin configurar'

  const esHoy = deferredFecha === hoy
  const tituloDia = esHoy ? `Hoy — ${fmtDateAr(deferredFecha)}` : fmtDateAr(deferredFecha)
  const ingresoHeroLabel = tituloIngresoDia(resumen, esHoy)
  const ingresoHeroHint = subtituloIngresoDia(resumen)
  const ingresoHeroMonto = montoIngresoHeroDia(resumen, mediosDia.total)

  const handlePdfDia = () => {
    setPdfBusy(true)
    try {
      downloadInformeDiaCajaPdf({
        fecha: deferredFecha,
        resumen,
        movimientos,
        cajas,
        planillas,
        egresos,
        lotes,
        arqueos,
        concilMp: concilMpDia,
        concilBanco: concilBancoDia,
        ventasMpPagadas
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

      <div className={`caja-cc-page-head${diaBusy ? ' is-day-pending' : ''}`}>
        <div>
          <h2>{tituloDia}</h2>
          <p className="caja-cc-sub">
            {resumen.fondosOperativas.length > 0
              ? `Fondo configurado en cajas (${fondosTxt}, editable en cierre de turno): cada operador deja el fondo en su caja o lo traspasa a otra operativa; el resto ingresa a administración.`
              : 'Sin fondo configurado en cajas de mostrador. El fondo lo define cada operador en el cierre de turno (no se asigna solo). El resto ingresa a administración.'}
          </p>
        </div>
        <div className="caja-cc-page-head-actions">
          {onInformes && (
            <>
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => onInformes('semana')}
              >
                Informe semanal
              </button>
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => onInformes('mes')}
              >
                Informe mensual
              </button>
            </>
          )}
          <button type="button" className="btn-primary btn-small" disabled={pdfBusy} onClick={handlePdfDia}>
            {pdfBusy ? 'Generando planilla…' : 'Planilla PDF del día'}
          </button>
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
        <div className={`caja-cc-day-body${diaBusy ? ' is-day-pending' : ''}`}>
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
              <span className="caja-cc-hoy-hero-label">{ingresoHeroLabel}</span>
              <span className="caja-cc-hoy-hero-value">
                $ {fmtArs(ingresoHeroMonto)}
              </span>
              {mediosDia.cuenta_corriente > 0 && resumen.ingresoFuente !== 'cierre_turno' && (
                <span className="caja-cc-hoy-hero-cc">
                  Cobrado $ {fmtArs(mediosDia.totalCobrado)} · CC $ {fmtArs(mediosDia.cuenta_corriente)}
                </span>
              )}
              <span className="caja-cc-hoy-hero-hint">{ingresoHeroHint}</span>
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

          <div className="caja-cc-hoy-acum" aria-label="Ingresos acumulados">
            <div className="caja-cc-hoy-hero-card ingreso caja-cc-hoy-acum-card">
              <span className="caja-cc-hoy-hero-label">Ingresos semana</span>
              <span className="caja-cc-hoy-acum-value">$ {fmtArs(ingresosAcum.semana)}</span>
              <span className="caja-cc-hoy-hero-hint">
                Lun {fmtDateAr(ingresosAcum.desdeSemana)} – {fmtDateAr(ingresosAcum.hasta)}
              </span>
            </div>
            <div className="caja-cc-hoy-hero-card ingreso caja-cc-hoy-acum-card">
              <span className="caja-cc-hoy-hero-label">Ingresos mes</span>
              <span className="caja-cc-hoy-acum-value">$ {fmtArs(ingresosAcum.mes)}</span>
              <span className="caja-cc-hoy-hero-hint">
                {labelMesAcum} (al {fmtDateAr(ingresosAcum.hasta)})
              </span>
            </div>
            <div className="caja-cc-hoy-hero-card ingreso caja-cc-hoy-acum-card">
              <span className="caja-cc-hoy-hero-label">Ingresos año</span>
              <span className="caja-cc-hoy-acum-value">$ {fmtArs(ingresosAcum.anio)}</span>
              <span className="caja-cc-hoy-hero-hint">
                {ingresosAcum.desdeAnio.slice(0, 4)} (al {fmtDateAr(ingresosAcum.hasta)})
              </span>
            </div>
          </div>

          <CajaDiaConciliacionPanel
            fecha={deferredFecha}
            movimientos={movimientos}
            planillas={planillas}
            arqueos={arqueos}
            cajas={cajas}
            concilMp={concilMpDia}
            concilBanco={concilBancoDia}
            ventasMpPagadas={ventasMpPagadas}
          />

          {movsDia.length > 0 && (
            <div className="caja-cc-card caja-cc-card-collapsible is-open">
              <div className="caja-cc-card-collapsible-head caja-cc-movs-dia-head">
                <h3>Movimientos del día — {fmtDateAr(deferredFecha)}</h3>
                <span className="caja-cc-card-collapsible-badge">{movsDia.length}</span>
                <button
                  type="button"
                  className="btn-primary btn-small caja-cc-movs-dia-pdf"
                  disabled={pdfBusy}
                  onClick={handlePdfDia}
                >
                  {pdfBusy ? 'Generando…' : 'Descargar planilla PDF'}
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
                  <strong>Fondo</strong> (lo define el operador en el cierre de turno; no se asigna solo) —
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
              <h3>Cierres de turno — {fmtDateAr(deferredFecha)}</h3>
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
        </div>
      )}

      {detalleLote && (
        <CajaCierreTurnoDetalleModal lote={detalleLote} cajas={cajas} onClose={() => setDetalleLote(null)} />
      )}

      {diaResumenTipo && (
        <CajaDiaResumenDetalleModal
          tipo={diaResumenTipo}
          fecha={deferredFecha}
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
