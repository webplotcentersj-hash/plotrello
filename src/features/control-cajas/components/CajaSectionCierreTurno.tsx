import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCajaOperativa } from '../../../hooks/useCajaOperativa'
import {
  getCierreFechaCaja,
  getParams,
  getUltimoArqueoCaja,
  listCajas,
  listCierres,
  listMovimientos,
  getPlanillaById,
  listPlanillas,
  listTransferenciaLotes,
  resolveCajaSlug,
  saveMovimiento,
  saveMovimientosBulk,
  savePlanillaImport,
  saveTransferenciaLote,
  updateCajaFondoFijo
} from '../cajaRepository'
import { buscarPlanillaCaja, montosCajaDesdeFuentes } from '../paseCajaMontos'
import CajaAvisoPdfUnico from './CajaAvisoPdfUnico'
import CajaImportComprobantesMedios from './CajaImportComprobantesMedios'
import CajaPlanillaResumenActiva from './CajaPlanillaResumenActiva'
import CajaCierreTurnoDetalleModal from './CajaCierreTurnoDetalleModal'
import { notifyAdminsCaja } from '../cajaNotificaciones'
import { comprobantesToMovimientos } from '../comprobantesMediosImport'
import type { ComprobanteLoteParsed } from '../comprobanteMediosTypes'
import { fmtArs, parseNum } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import {
  buildMovimientosCierreTurno,
  calcularCierreTurnoMontos,
  cajaFondoDestinoPorDefecto,
  conciliarCierreTurno,
  egresosDelDiaParaCierreTurno,
  fondoMontoParaCaja,
  hayEgresosPendientes,
  type EgresosDelDiaResumen
} from '../cierreTurno'
import { filtrarMovimientosDuplicados } from '../cajaCoherencia'
import { fechaPlanillaImport, planillaAllToMovimientos } from '../planillaMovimientos'
import { newId } from '../format'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaRegistro, CajaTransferenciaLote } from '../types'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  onIrSubirPdf?: () => void
}

export default function CajaSectionCierreTurno({ usuarioNombre, usuarioId, onIrSubirPdf }: Props) {
  const { slug: cajaSlugOp, loading: cajaOperativaLoading } = useCajaOperativa()
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [lotes, setLotes] = useState<CajaTransferenciaLote[]>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [detalleLote, setDetalleLote] = useState<CajaTransferenciaLote | null>(null)

  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [hora, setHora] = useState(() => new Date().toTimeString().slice(0, 5))
  const [origen, setOrigen] = useState('')
  const [cajaFondoDestino, setCajaFondoDestino] = useState('')
  const [arqueoEf, setArqueoEf] = useState('')
  const [arqueoOt, setArqueoOt] = useState('')
  const [egresosResumen, setEgresosResumen] = useState<EgresosDelDiaResumen | null>(null)
  const [egresosLoading, setEgresosLoading] = useState(false)
  const [planillaPreview, setPlanillaPreview] = useState<PlanillaCajaParsed | null>(null)
  const [planillaId, setPlanillaId] = useState<string | null>(null)
  const [comprobantesPreview, setComprobantesPreview] = useState<ComprobanteLoteParsed | null>(null)
  const [fondoMontoInput, setFondoMontoInput] = useState('')

  const reload = useCallback(async () => {
    const [c, lot, p] = await Promise.all([listCajas(), listTransferenciaLotes(20), getParams()])
    const operativas = c.filter((x) => x.slug !== 'vuelto')
    setCajas(operativas)
    setLotes(lot)
    setTolerancia(p.tolerancia)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!cajaSlugOp) return
    const operativas = cajas.filter((x) => x.slug !== 'vuelto' && x.slug !== 'admin')
    setOrigen(cajaSlugOp)
    setCajaFondoDestino((prev) => {
      if (prev && prev !== cajaSlugOp) return prev
      return cajaFondoDestinoPorDefecto(cajaSlugOp, operativas)
    })
  }, [cajaSlugOp, cajas])

  const cajaResolviendo = cajaOperativaLoading
  const cajaAutoAsignada = Boolean(cajaSlugOp)

  useEffect(() => {
    if (origen && cajaFondoDestino === origen) {
      const op = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto' && c.slug !== origen)
      setCajaFondoDestino(op[0]?.slug ?? '')
    }
  }, [origen, cajaFondoDestino, cajas])

  useEffect(() => {
    if (!origen || !fecha) {
      setEgresosResumen(null)
      return
    }
    setEgresosLoading(true)
    void egresosDelDiaParaCierreTurno(fecha, origen)
      .then(setEgresosResumen)
      .finally(() => setEgresosLoading(false))
  }, [origen, fecha])

  useEffect(() => {
    if (!origen || !fecha) return
    let cancelled = false
    void (async () => {
      const [arq, planillas] = await Promise.all([
        getUltimoArqueoCaja(origen, fecha),
        listPlanillas(120)
      ])
      if (cancelled) return
      const caja = cajas.find((c) => c.slug === origen)
      const plan = buscarPlanillaCaja(planillas, origen, fecha, caja?.nombre)
      const m = montosCajaDesdeFuentes(caja, arq, plan, fecha)
      setArqueoEf(String(m.efectivo))
      setArqueoOt(String(m.otros))
    })()
    return () => {
      cancelled = true
    }
  }, [origen, fecha, cajas])

  useEffect(() => {
    if (!origen || !fecha) {
      setPlanillaPreview(null)
      setPlanillaId(null)
      return
    }
    let cancelled = false
    void (async () => {
      const planillas = await listPlanillas(120)
      if (cancelled) return
      const caja = cajas.find((c) => c.slug === origen)
      const match = buscarPlanillaCaja(planillas, origen, fecha, caja?.nombre)
      if (!match) {
        setPlanillaPreview(null)
        setPlanillaId(null)
        return
      }
      const full = await getPlanillaById(match.id)
      if (cancelled) return
      if (full) {
        setPlanillaPreview(full)
        setPlanillaId(match.id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [origen, fecha, cajas])

  const cajaOrigen = cajas.find((c) => c.slug === origen)

  useEffect(() => {
    if (!cajaOrigen) return
    setFondoMontoInput(String(fondoMontoParaCaja(cajaOrigen)))
  }, [origen, cajaOrigen?.slug, cajaOrigen?.fondo_fijo])

  const fondoMonto = fondoMontoInput.trim() ? parseNum(fondoMontoInput) : cajaOrigen ? fondoMontoParaCaja(cajaOrigen) : 0
  const egresosLista = egresosResumen?.solicitudes ?? []
  const egresosTot = egresosResumen?.totales ?? { efectivo: 0, otros: 0 }

  const calc = useMemo(
    () =>
      calcularCierreTurnoMontos({
        arqueo_efectivo: parseNum(arqueoEf),
        arqueo_otros: parseNum(arqueoOt),
        fondo_monto: fondoMonto,
        egresos_aprobados_ef: egresosTot.efectivo,
        egresos_aprobados_ot: egresosTot.otros
      }),
    [arqueoEf, arqueoOt, fondoMonto, egresosTot.efectivo, egresosTot.otros]
  )

  const concil = useMemo(() => {
    return listCierres().then((all) => {
      const cierre = getCierreFechaCaja(all, fecha, origen)
      const arqueoTotal = parseNum(arqueoEf) + parseNum(arqueoOt)
      return conciliarCierreTurno({ calc, cierre, arqueoTotal, tolerancia })
    })
  }, [calc, fecha, origen, arqueoEf, arqueoOt, tolerancia])

  const [concilOpen, setConcilOpen] = useState(false)
  const [concilState, setConcilState] = useState<{ ok: boolean; alertas: string[]; avisos: string[] }>({
    ok: true,
    alertas: [],
    avisos: []
  })

  useEffect(() => {
    void concil.then(setConcilState)
  }, [concil])

  const adminSlug = cajas.find((c) => c.slug === 'admin')?.slug ?? 'admin'
  const cajaNombre = (s: string) => cajas.find((c) => c.slug === s)?.nombre ?? s
  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')

  const onOrigenManual = (slug: string) => {
    setOrigen(slug)
    if (slug === cajaFondoDestino) {
      setCajaFondoDestino(cajaFondoDestinoPorDefecto(slug, operativas))
    }
  }

  const fuenteEgresosLabel = (fuente: EgresosDelDiaResumen['fuente']): string => {
    if (fuente === 'solicitudes') return 'solicitudes aprobadas'
    if (fuente === 'movimientos') return 'movimientos de egreso del día'
    if (fuente === 'cierre') return 'cierre de caja del día'
    return 'sin registros'
  }

  const ejecutar = async () => {
    setMsg(null)
    if (!origen) {
      setMsg('No se pudo identificar tu caja. Volvé a iniciar sesión o contactá a administración.')
      return
    }
    if (origen === cajaFondoDestino) {
      setMsg('La caja que recibe el fondo debe ser distinta a la de origen.')
      return
    }
    if (hayEgresosPendientes(egresosLista)) {
      setMsg('Hay egresos pendientes de aprobación. Resolvelos en la sección Egresos antes del cierre de turno.')
      return
    }
    if (fondoMonto <= 0) {
      setMsg('Indicá el fondo de caja que queda en la otra caja operativa (recomendado $100.000).')
      return
    }
    if (!planillaPreview) {
      setMsg('Adjuntá el PDF de la planilla con el detalle de transacciones para el pase a administración.')
      return
    }
    if (calc.resto_efectivo + calc.resto_otros <= 0 && calc.fondo_monto <= 0) {
      setMsg('No hay montos para transferir.')
      return
    }

    setSaving(true)
    try {
      if (cajaOrigen) {
        await updateCajaFondoFijo(cajaOrigen.slug, fondoMonto)
      }
      const loteId = newId()
      let idPlanilla = planillaId
      if (!idPlanilla) {
        const slugOrigen = resolveCajaSlug(planillaPreview.caja_nombre, cajas) ?? origen
        const guardada = await savePlanillaImport(planillaPreview, slugOrigen, usuarioNombre, usuarioId)
        idPlanilla = guardada.id
        setPlanillaId(guardada.id)
        const todosMovs = planillaAllToMovimientos(
          planillaPreview,
          cajas,
          slugOrigen,
          usuarioNombre,
          usuarioId
        )
        const fechaImp = fechaPlanillaImport(planillaPreview)
        const existentes = await listMovimientos()
        const delDia = existentes.filter(
          (m) =>
            m.fecha === fechaImp &&
            (m.destino_slug === slugOrigen || m.origen_slug === slugOrigen)
        )
        const { nuevos: movs } = filtrarMovimientosDuplicados(todosMovs, delDia, {
          cajaSlug: slugOrigen,
          fecha: fechaImp
        })
        if (movs.length) await saveMovimientosBulk(movs)
      }

      const arqFondo = await getUltimoArqueoCaja(cajaFondoDestino, fecha)
      const arqAdmin = await getUltimoArqueoCaja(adminSlug, fecha)

      const montosAntes = {
        origen_efectivo: calc.arqueo_efectivo,
        origen_otros: calc.arqueo_otros,
        fondo_dest_efectivo: arqFondo?.total ?? 0,
        fondo_dest_otros: 0,
        admin_dest_efectivo: arqAdmin?.total ?? 0,
        admin_dest_otros: 0
      }

      const detalleInicial = {
        comprobantes: comprobantesPreview?.comprobantes ?? [],
        planilla_resumen: {
          archivo_nombre: planillaPreview.archivo_nombre,
          cantidad_ventas: planillaPreview.ventas.length,
          ingresos_total: planillaPreview.totales?.ingresos_total ?? 0,
          egresos_total: planillaPreview.totales?.egresos_total ?? 0
        },
        movimientos_ids: [] as string[]
      }

      const lote: Omit<CajaTransferenciaLote, 'created_at'> = {
        id: loteId,
        fecha,
        hora,
        origen_slug: origen,
        caja_fondo_destino_slug: cajaFondoDestino,
        arqueo_efectivo: calc.arqueo_efectivo,
        arqueo_otros: calc.arqueo_otros,
        fondo_monto: calc.fondo_monto,
        resto_efectivo: calc.resto_efectivo,
        resto_otros: calc.resto_otros,
        egresos_aprobados_ef: egresosTot.efectivo,
        id_planilla: idPlanilla,
        id_usuario: usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        observacion: `Cierre de turno ${cajaNombre(origen)} → fondo ${cajaNombre(cajaFondoDestino)} + admin`,
        detalle: detalleInicial
      }

      await saveTransferenciaLote(lote)

      const movIds: string[] = []

      if (comprobantesPreview?.comprobantes.length) {
        const compMovs = comprobantesToMovimientos(
          comprobantesPreview,
          origen,
          usuarioNombre,
          usuarioId,
          cajas,
          loteId
        )
        if (compMovs.length) {
          const bulk = await saveMovimientosBulk(compMovs, { cajas })
          movIds.push(...bulk.records.map((r) => r.id))
        }
      }

      const movs = buildMovimientosCierreTurno({
        lote: { ...lote, id: loteId },
        calc,
        montosAntes,
        adminSlug,
        planillaNombre: planillaPreview.archivo_nombre,
        usuarioNombre,
        usuarioId
      })

      for (const m of movs) {
        const saved = await saveMovimiento(m)
        movIds.push(saved.id)
      }

      if (movIds.length) {
        await saveTransferenciaLote({
          ...lote,
          detalle: { ...detalleInicial, movimientos_ids: movIds }
        })
      }

      const compCount = comprobantesPreview?.comprobantes.length ?? 0
      void notifyAdminsCaja({
        titulo: 'Cierre de turno registrado',
        descripcion:
          `${usuarioNombre} cerró turno en ${cajaNombre(origen)}: fondo $ ${fmtArs(calc.fondo_monto)}, ` +
          `admin $ ${fmtArs(calc.resto_efectivo + calc.resto_otros)}. ` +
          `Planilla: ${planillaPreview.archivo_nombre}` +
          (compCount ? ` · ${compCount} comprobante(s).` : '.'),
        tipo: 'info',
        excluirUsuarioId: usuarioId
      })

      setMsg(
        `Cierre de turno registrado: fondo $ ${fmtArs(calc.fondo_monto)} a ${cajaNombre(cajaFondoDestino)}, resto $ ${fmtArs(calc.resto_efectivo + calc.resto_otros)} a administración (planilla adjunta).`
      )
      setPlanillaPreview(null)
      setPlanillaId(null)
      setComprobantesPreview(null)
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al registrar cierre de turno')
    } finally {
      setSaving(false)
    }
  }

  const restoAdmin = calc.resto_efectivo + calc.resto_otros

  return (
    <div className="caja-cc-cierre-turno">
      <div className="caja-cc-hoy-hero caja-cc-cierre-hero">
        <div className="caja-cc-hoy-hero-card">
          <span className="caja-cc-hoy-hero-label">Fondo → otra caja</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(calc.fondo_monto)}</span>
          <span className="caja-cc-hoy-hero-hint">
            A {cajaNombre(cajaFondoDestino) || '…'} (fondo configurable; sin monto automático)
          </span>
        </div>
        <div className="caja-cc-hoy-hero-card ingreso">
          <span className="caja-cc-hoy-hero-label">Resto → administración</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(restoAdmin)}</span>
          <span className="caja-cc-hoy-hero-hint">Ingreso del día para administración</span>
        </div>
        <div className="caja-cc-hoy-hero-card egreso">
          <span className="caja-cc-hoy-hero-label">Egresos hoy</span>
          <span className="caja-cc-hoy-hero-value">
            $ {fmtArs(egresosTot.efectivo + egresosTot.otros)}
          </span>
          <span className="caja-cc-hoy-hero-hint">Descontados del arqueo antes del pase</span>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Cajas y arqueo</h3>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="caja-cc-field">
            Hora
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Caja que cierra (origen)
            {cajaResolviendo ? (
              <input type="text" readOnly value="Identificando tu caja…" />
            ) : cajaAutoAsignada ? (
              <>
                <input type="text" readOnly value={cajaNombre(origen)} />
                <span className="caja-cc-field-hint">Asignada a tu usuario ({usuarioNombre}).</span>
              </>
            ) : (
              <>
                <select value={origen} onChange={(e) => onOrigenManual(e.target.value)} required>
                  <option value="">Elegir caja…</option>
                  {operativas.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <span className="caja-cc-field-hint">
                  Tu caja se asigna automáticamente según tu usuario de mostrador.
                </span>
              </>
            )}
          </label>
          <label className="caja-cc-field">
            Recibe el fondo
            <select
              value={cajaFondoDestino}
              onChange={(e) => setCajaFondoDestino(e.target.value)}
              disabled={!origen}
            >
              {operativas.filter((c) => c.slug !== origen).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Fondo que queda en la otra caja
            <input
              type="number"
              step="0.01"
              min="0"
              value={fondoMontoInput}
              onChange={(e) => setFondoMontoInput(e.target.value)}
              required
            />
            <span className="caja-cc-field-hint">
              Opcional. Se guarda para tu caja al confirmar el cierre; no se asigna solo.
            </span>
          </label>
          <label className="caja-cc-field">
            Arqueo efectivo (contado)
            <input type="number" step="0.01" value={arqueoEf} onChange={(e) => setArqueoEf(e.target.value)} required />
          </label>
        </div>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Arqueo tarjetas/otros
            <input type="number" step="0.01" value={arqueoOt} onChange={(e) => setArqueoOt(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Egresos del día</h3>
        {egresosLoading ? (
          <p className="caja-cc-help">Cargando egresos…</p>
        ) : hayEgresosPendientes(egresosLista) ? (
          <p className="caja-cc-error">
            Hay egresos <strong>pendientes</strong> de aprobación por administración. No podés cerrar el turno hasta
            resolverlos (sección Egresos).
          </p>
        ) : (
          <>
            <p className="caja-cc-ok">
              Egresos aprobados en efectivo: <strong>$ {fmtArs(egresosTot.efectivo)}</strong> · otros:{' '}
              <strong>$ {fmtArs(egresosTot.otros)}</strong>
            </p>
            {egresosResumen && (
              <p className="caja-cc-help">
                Fuente: {fuenteEgresosLabel(egresosResumen.fuente)}
                {egresosResumen.fuente === 'solicitudes' &&
                  ` (${egresosLista.filter((s) => s.estado === 'aprobado').length} solicitud/es)`}
                {egresosResumen.fuente === 'movimientos' &&
                  ` (${egresosResumen.movimientosEgreso.length} movimiento/s)`}
                {egresosResumen.fuente === 'ninguno' &&
                  ' — registrá egresos en la sección Egresos o cargá el cierre del día.'}
              </p>
            )}
            {egresosLista.filter((s) => s.estado === 'aprobado').length > 0 && (
              <ul className="caja-cc-egresos-mini-list">
                {egresosLista
                  .filter((s) => s.estado === 'aprobado')
                  .slice(0, 6)
                  .map((s) => (
                    <li key={s.id}>
                      {s.concepto} — $ {fmtArs(s.monto_efectivo + s.monto_otros)}
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="caja-cc-card">
        <h3>Planilla del día y comprobantes</h3>
        {planillaPreview ? (
          <CajaPlanillaResumenActiva planilla={planillaPreview} />
        ) : onIrSubirPdf ? (
          <CajaAvisoPdfUnico onIr={onIrSubirPdf} />
        ) : (
          <p className="caja-cc-help">Subí el PDF del día desde el Menú antes de cerrar el turno.</p>
        )}
        <h4 className="caja-cc-comprobantes-embed-title">Comprobantes MP · POS · tarjetas</h4>
        <CajaImportComprobantesMedios
          usuarioNombre={usuarioNombre}
          usuarioId={usuarioId}
          embedEnCierre
          onPreviewChange={setComprobantesPreview}
          onImported={() => setMsg(null)}
        />
      </div>

      <div className="caja-cc-card caja-cc-card-collapsible">
        <button
          type="button"
          className="caja-cc-card-collapsible-head"
          onClick={() => setConcilOpen((v) => !v)}
        >
          <span aria-hidden>{concilOpen ? '▼' : '▶'}</span>
          <h3>Revisión opcional (arqueo vs cierre)</h3>
        </button>
        {concilOpen && (
          <div
            className={`caja-cc-card-collapsible-body caja-cc-result ${
              concilState.alertas.length ? 'bad' : concilState.avisos.length ? 'neutral' : 'ok'
            }`}
          >
            {concilState.alertas.length === 0 && concilState.avisos.length === 0 ? (
              <p>Cuadre correcto: arqueo, fondo, egresos y resto a administración coinciden.</p>
            ) : (
              <>
                {concilState.alertas.length > 0 && (
                  <ul className="caja-cc-concil-list">
                    {concilState.alertas.map((a, i) => (
                      <li key={`a-${i}`}>{a}</li>
                    ))}
                  </ul>
                )}
                {concilState.avisos.length > 0 && (
                  <ul className="caja-cc-concil-list caja-cc-concil-avisos">
                    {concilState.avisos.map((a, i) => (
                      <li key={`v-${i}`}>{a}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {msg &&
        (msg.includes('registrado') ? (
          <CajaMensajeOkPlotLab>
            <p className="caja-cc-ok">{msg}</p>
          </CajaMensajeOkPlotLab>
        ) : (
          <p className="caja-cc-error">{msg}</p>
        ))}

      <div className="caja-cc-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={saving || hayEgresosPendientes(egresosLista) || !planillaPreview || !origen}
          onClick={() => void ejecutar()}
        >
          {saving ? 'Registrando…' : 'Registrar cierre de turno'}
        </button>
      </div>

      {lotes.length > 0 && (
        <div className={`caja-cc-card caja-cc-card-collapsible${historialOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="caja-cc-card-collapsible-head"
            onClick={() => setHistorialOpen((v) => !v)}
            aria-expanded={historialOpen}
          >
            <span className="caja-cc-card-collapsible-chevron" aria-hidden>
              {historialOpen ? '▼' : '▶'}
            </span>
            <h3>Historial cierres de turno</h3>
            <span className="caja-cc-card-collapsible-badge">{lotes.length}</span>
          </button>
          {historialOpen && (
            <div className="caja-cc-card-collapsible-body">
              <div className="caja-cc-table-scroll">
                <table className="caja-cc-table caja-cc-table-clickable">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Origen</th>
                      <th>Fondo →</th>
                      <th className="num">Resto admin</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((l) => (
                      <tr
                        key={l.id}
                        className="caja-cc-row-clickable"
                        onClick={() => setDetalleLote(l)}
                        title="Ver detalle del cierre"
                      >
                        <td>
                          {l.fecha}
                          {l.hora ? ` ${l.hora}` : ''}
                        </td>
                        <td>{cajaNombre(l.origen_slug)}</td>
                        <td>{cajaNombre(l.caja_fondo_destino_slug)}</td>
                        <td className="num">$ {fmtArs(l.resto_efectivo + l.resto_otros)}</td>
                        <td>{l.usuario_nombre ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {detalleLote && (
        <CajaCierreTurnoDetalleModal lote={detalleLote} cajas={cajas} onClose={() => setDetalleLote(null)} />
      )}
    </div>
  )
}
