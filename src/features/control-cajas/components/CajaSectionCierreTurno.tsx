import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getCierreFechaCaja,
  getParams,
  getUltimoArqueoCaja,
  listCajas,
  listCierres,
  listTransferenciaLotes,
  resolveCajaSlug,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveMovimiento,
  saveMovimientosBulk,
  savePlanillaImport,
  saveTransferenciaLote
} from '../cajaRepository'
import { setStoredCajaSlug } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS } from '../constants'
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
import { parsePlanillaCajaPdf } from '../parsePlanillaCajaPdf'
import { planillaAllToMovimientos } from '../planillaMovimientos'
import { newId } from '../format'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaRegistro, CajaTransferenciaLote } from '../types'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

type Props = {
  usuarioNombre: string
  usuarioId?: number
}

export default function CajaSectionCierreTurno({ usuarioNombre, usuarioId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [lotes, setLotes] = useState<CajaTransferenciaLote[]>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cajaResolviendo, setCajaResolviendo] = useState(true)
  const [cajaAutoAsignada, setCajaAutoAsignada] = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)

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
    let cancelled = false
    setCajaResolviendo(true)

    void Promise.all([listCajas(), getParams()]).then(async ([list, params]) => {
      const operativas = list.filter((x) => x.slug !== 'vuelto' && x.slug !== 'admin')
      if (cancelled) return
      setCajas(list.filter((x) => x.slug !== 'vuelto'))

      const cajeras = params.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS
      let slug =
        resolveCajaSlugForUsuario(usuarioNombre, operativas, cajeras, { usuarioId }) ?? ''

      if (!slug && usuarioId) {
        slug = (await resolveCajaSlugFromHistorial(usuarioId, operativas)) ?? ''
      }

      if (cancelled) return
      if (slug) {
        setOrigen(slug)
        setCajaAutoAsignada(true)
        if (usuarioId) setStoredCajaSlug(usuarioId, slug)
        setCajaFondoDestino((prev) => {
          if (prev && prev !== slug) return prev
          return cajaFondoDestinoPorDefecto(slug, operativas)
        })
      } else {
        setCajaAutoAsignada(false)
        if (!origen && operativas.length) {
          const first = operativas[0].slug
          setOrigen(first)
          setCajaFondoDestino(cajaFondoDestinoPorDefecto(first, operativas))
        }
      }
      setCajaResolviendo(false)
    })

    return () => {
      cancelled = true
    }
  }, [usuarioNombre, usuarioId])

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
    if (!origen) return
    void getUltimoArqueoCaja(origen, fecha).then((arq) => {
      if (arq) setArqueoEf(String(arq.total))
    })
  }, [origen, fecha])

  const cajaOrigen = cajas.find((c) => c.slug === origen)
  const fondoMonto = cajaOrigen ? fondoMontoParaCaja(cajaOrigen) : 100_000
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

  const [concilState, setConcilState] = useState<{ ok: boolean; alertas: string[] }>({
    ok: false,
    alertas: []
  })

  useEffect(() => {
    void concil.then(setConcilState)
  }, [concil])

  const adminSlug = cajas.find((c) => c.slug === 'admin')?.slug ?? 'admin'
  const cajaNombre = (s: string) => cajas.find((c) => c.slug === s)?.nombre ?? s
  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')

  const onOrigenManual = (slug: string) => {
    setOrigen(slug)
    if (usuarioId && slug) setStoredCajaSlug(usuarioId, slug)
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

  const handlePdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setMsg('Subí el PDF del listado de transacciones (planilla de caja).')
      return
    }
    try {
      const buf = (await file.arrayBuffer()).slice(0)
      const parsed = await parsePlanillaCajaPdf(buf, file.name)
      setPlanillaPreview(parsed)
      setPlanillaId(null)
      setMsg(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo leer el PDF')
    }
  }

  const ejecutar = async () => {
    setMsg(null)
    if (!origen) {
      setMsg('No se pudo identificar tu caja. Pedí a administración que te agreguen en Maestros → Cajeras.')
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
      const loteId = newId()
      let idPlanilla = planillaId
      if (!idPlanilla) {
        const slugOrigen = resolveCajaSlug(planillaPreview.caja_nombre, cajas) ?? origen
        const guardada = await savePlanillaImport(planillaPreview, slugOrigen, usuarioNombre, usuarioId)
        idPlanilla = guardada.id
        setPlanillaId(guardada.id)
        const movs = planillaAllToMovimientos(
          planillaPreview,
          cajas,
          slugOrigen,
          usuarioNombre,
          usuarioId
        )
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
        observacion: `Cierre de turno ${cajaNombre(origen)} → fondo ${cajaNombre(cajaFondoDestino)} + admin`
      }

      await saveTransferenciaLote(lote)

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
        await saveMovimiento(m)
      }

      setMsg(
        `Cierre de turno registrado: fondo $ ${fmtArs(calc.fondo_monto)} a ${cajaNombre(cajaFondoDestino)}, resto $ ${fmtArs(calc.resto_efectivo + calc.resto_otros)} a administración (planilla adjunta).`
      )
      setPlanillaPreview(null)
      setPlanillaId(null)
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al registrar cierre de turno')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="caja-cc-cierre-turno">
      <p className="caja-cc-intro caja-cc-sub">
        Al cerrar el turno, el <strong>fondo</strong> pasa a la otra caja operativa y el <strong>resto</strong> va a
        administración con el PDF de transacciones. Debe cuadrar con arqueo, egresos y cierre del día.
      </p>

      <div className="caja-cc-card">
        <h3>1 · Arqueo y cajas</h3>
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
                  Tu usuario no está en Maestros; elegí la caja una vez y quedará guardada.
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
            Arqueo efectivo (contado)
            <input type="number" step="0.01" value={arqueoEf} onChange={(e) => setArqueoEf(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Arqueo tarjetas/otros
            <input type="number" step="0.01" value={arqueoOt} onChange={(e) => setArqueoOt(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>2 · Egresos del día</h3>
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

      <div className="caja-cc-card caja-cc-pase-block highlight">
        <h3>3 · Transferencias calculadas</h3>
        <table className="caja-cc-table">
          <tbody>
            <tr>
              <td>Fondo permanente → {cajaNombre(cajaFondoDestino)}</td>
              <td className="num">$ {fmtArs(calc.fondo_monto)}</td>
            </tr>
            <tr>
              <td>Resto → Administración</td>
              <td className="num">
                $ {fmtArs(calc.resto_efectivo)} + $ {fmtArs(calc.resto_otros)} otros
              </td>
            </tr>
          </tbody>
        </table>
        <p className="caja-cc-sub">
          Fórmula efectivo: arqueo − egresos aprobados − fondo = resto a administración ($ {fmtArs(calc.resto_efectivo)})
        </p>
      </div>

      <div className="caja-cc-card">
        <h3>4 · PDF planilla (obligatorio para administración)</h3>
        <p className="caja-cc-sub">Detalle de todas las transacciones del turno, como envían por email a administración.</p>
        <button type="button" className="btn-secondary btn-small" onClick={() => fileRef.current?.click()}>
          Adjuntar PDF planilla
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handlePdf(f)
            e.target.value = ''
          }}
        />
        {planillaPreview && (
          <p className="caja-cc-ok">
            ✓ {planillaPreview.archivo_nombre} — {planillaPreview.cantidad_ventas} ventas,{' '}
            {planillaPreview.egresos.length} egresos en planilla
          </p>
        )}
      </div>

      <div className={`caja-cc-card ${concilState.ok ? 'caja-cc-result ok' : 'caja-cc-result bad'}`}>
        <h3>5 · Concordancia arqueo / cierre</h3>
        {concilState.alertas.length === 0 ? (
          <p>Cuadre coherente con cierre y arqueo.</p>
        ) : (
          <ul className="caja-cc-concil-list">
            {concilState.alertas.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
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
                <table className="caja-cc-table">
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
                      <tr key={l.id}>
                        <td>{l.fecha}</td>
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
    </div>
  )
}
