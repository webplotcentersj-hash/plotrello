import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type {
  Asistencia,
  MenuDescuentoBeneficioComida,
  RrhhLiquidacionLinea,
  RrhhLiquidacionPeriodo,
  RrhhNovedad
} from '../types/api'
import {
  diasEntre,
  formatArs,
  LS_VALOR_HORA_EXTRA,
  type HorarioFijoAsistencia
} from '../utils/asistenciaStats'
import {
  avisosCategoriaCierre,
  armarLineasLiquidacion,
  conceptosMiLiquidacionDigital,
  conteosNovedadCierre,
  etiquetaNovedadCierre,
  etiquetaPeriodoEs,
  fechaCortaEs,
  numDetalleLinea,
  periodoRango,
  rangoNovedadCorto,
  totalesConceptosDigital,
  totalesLineas
} from '../utils/rrhhLiquidacion'
import { exportarLiquidacionXlsx } from '../utils/exportLiquidacionXlsx'
import { novedadEmpleadoIncorrecto } from '../utils/rrhhNovedadEmpleadoObs'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import './RecursosHumanosLiquidacionPage.css'

function mesActualYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const RecursosHumanosLiquidacionPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, isAdmin, loading: authLoading } = useAuth()
  const canAccess =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const canReabrir = !!usuario && (isAdmin || usuario.rol === 'gerencia')

  const [periodo, setPeriodo] = useState(mesActualYm)
  const [valorHora, setValorHora] = useState(() => {
    try {
      const v = localStorage.getItem(LS_VALOR_HORA_EXTRA)
      return v ? Number(v) || 0 : 0
    } catch {
      return 0
    }
  })
  const [notas, setNotas] = useState('')
  const [periodoDb, setPeriodoDb] = useState<RrhhLiquidacionPeriodo | null>(null)
  const [lineas, setLineas] = useState<RrhhLiquidacionLinea[]>([])
  const [novedades, setNovedades] = useState<RrhhNovedad[]>([])
  const [nombres, setNombres] = useState<Map<number, string>>(new Map())
  const [legajos, setLegajos] = useState<
    Map<number, { sector: string; fecha_ingreso: string | null; dni: string | null }>
  >(new Map())
  const [seccion, setSeccion] = useState<'liquidacion' | 'incluye' | 'envio'>('liquidacion')
  const [empleadoSel, setEmpleadoSel] = useState<number | null>(null)
  const [avisosSolape, setAvisosSolape] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const cerrado = periodoDb?.estado === 'cerrado'

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh/dashboard')
    }
  }, [authLoading, canAccess, navigate])

  const generarBorrador = useCallback(
    async (opts?: { valorHora?: number; notas?: string }) => {
      const vh = opts?.valorHora ?? valorHora
      const nt = opts?.notas ?? notas
      setBusy(true)
      setError(null)
      setMsg(null)
      try {
        const { desde, hasta } = periodoRango(periodo)
        const [asistRes, novRes, descRes, legRes, horRes, upsRes] = await Promise.all([
          apiService.obtenerAsistencia(null, desde, hasta),
          apiService.rrhhNovedadesListar({ fechaDesde: desde, fechaHasta: hasta }),
          apiService.menuDescuentosBeneficioListar({ fechaDesde: desde, fechaHasta: hasta }),
          apiService.obtenerLegajosBasico(),
          apiService.obtenerHorariosFijos(periodo),
          apiService.rrhhLiquidacionPeriodoUpsert({
            periodo,
            valor_hora_default: vh,
            notas: nt || null,
            estado: 'borrador'
          })
        ])

        if (!asistRes.success) throw new Error(asistRes.error || 'Error asistencia')
        if (!novRes.success) throw new Error(novRes.error || 'Error novedades')
        if (upsRes.success && upsRes.data) setPeriodoDb(upsRes.data)

        const mapNombres = new Map<number, string>()
        const mapLegajos = new Map<number, { sector: string; fecha_ingreso: string | null; dni: string | null }>()
        if (legRes.success && legRes.data) {
          for (const [id, row] of Object.entries(legRes.data)) {
            const n = `${row.nombre || ''} ${row.apellido || ''}`.trim()
            mapNombres.set(Number(id), nombreSinDominioCorreo(n) || n || `Usuario ${id}`)
            mapLegajos.set(Number(id), {
              sector: row.sector || '',
              fecha_ingreso: row.fecha_ingreso ?? null,
              dni: row.dni ?? null
            })
          }
        }
        setNombres(mapNombres)
        setLegajos(mapLegajos)

        const activos = new Set(mapNombres.keys())
        const asistencia = ((asistRes.data || []) as Asistencia[]).filter((a) =>
          activos.has(a.id_usuario)
        )
        const novs = (novRes.data || []).filter((n) => activos.has(n.id_usuario))
        setNovedades(novs)
        const descuentos = ((descRes.success ? descRes.data : []) as MenuDescuentoBeneficioComida[]).filter(
          (d) => activos.has(d.id_usuario)
        )

        const horariosPorMes: Record<string, Record<number, HorarioFijoAsistencia>> = {}
        if (horRes.success && horRes.data) {
          const mapa: Record<number, HorarioFijoAsistencia> = {}
          for (const [id, h] of Object.entries(horRes.data)) {
            mapa[Number(id)] = {
              entrada: h.entrada,
              salida: h.salida,
              horas: h.horas,
              trabajaSabado: h.trabajaSabado
            }
          }
          horariosPorMes[periodo] = mapa
        }

        const { lineas: L, avisosSolapeHe } = armarLineasLiquidacion({
          periodo,
          asistencia,
          novedades: novs,
          nombres: mapNombres,
          horariosPorMes,
          valorHora: vh,
          descuentosComida: descuentos
        })
        setLineas(L)
        setAvisosSolape(avisosSolapeHe)
        setMsg(`Borrador generado: ${L.length} empleados`)
        try {
          localStorage.setItem(LS_VALOR_HORA_EXTRA, String(vh))
        } catch {
          /* ignore */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al generar borrador')
      } finally {
        setBusy(false)
        setLoading(false)
      }
    },
    [periodo, valorHora, notas]
  )

  useEffect(() => {
    if (!canAccess || authLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setMsg(null)
      const res = await apiService.rrhhLiquidacionPeriodoObtener(periodo)
      if (cancelled) return
      let vh = valorHora
      let nt = notas
      if (res.success && res.data) {
        setPeriodoDb(res.data)
        vh = Number(res.data.valor_hora_default) || 0
        nt = res.data.notas || ''
        setValorHora(vh)
        setNotas(nt)
        if (res.data.estado === 'cerrado') {
          const { desde, hasta } = periodoRango(periodo)
          const [lin, legRes, novRes] = await Promise.all([
            apiService.rrhhLiquidacionLineasListar(res.data.id),
            apiService.obtenerLegajosBasico(),
            apiService.rrhhNovedadesListar({ fechaDesde: desde, fechaHasta: hasta })
          ])
          if (cancelled) return
          if (legRes.success && legRes.data) {
            const mapNombres = new Map<number, string>()
            const mapLegajos = new Map<number, { sector: string; fecha_ingreso: string | null; dni: string | null }>()
            for (const [id, row] of Object.entries(legRes.data)) {
              const n = `${row.nombre || ''} ${row.apellido || ''}`.trim()
              mapNombres.set(Number(id), nombreSinDominioCorreo(n) || n || `Usuario ${id}`)
              mapLegajos.set(Number(id), {
                sector: row.sector || '',
                fecha_ingreso: row.fecha_ingreso ?? null,
                dni: row.dni ?? null
              })
            }
            setNombres(mapNombres)
            setLegajos(mapLegajos)
          }
          if (novRes.success && novRes.data) setNovedades(novRes.data)
          if (lin.success && lin.data) {
            setLineas(lin.data)
            setAvisosSolape([])
            setLoading(false)
            return
          }
        }
      } else {
        setPeriodoDb(null)
      }
      if (!cancelled) await generarBorrador({ valorHora: vh, notas: nt })
    })()
    return () => {
      cancelled = true
    }
    // Solo al cambiar período / acceso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, canAccess, authLoading])

  const { desde: periodoDesde, hasta: periodoHasta } = useMemo(() => periodoRango(periodo), [periodo])
  const diasMes = useMemo(() => diasEntre(periodoDesde, periodoHasta), [periodoDesde, periodoHasta])
  const totBase = useMemo(() => totalesLineas(lineas), [lineas])
  const totNov = useMemo(
    () => conteosNovedadCierre(novedades, diasMes, undefined, nombres),
    [novedades, diasMes, nombres]
  )
  const tot = useMemo(() => {
    if (novedades.length === 0) return totBase
    return {
      ...totBase,
      vacaciones: totNov.vacaciones,
      licencias: totNov.licencias,
      faltas_justificadas: totNov.faltas_justificadas,
      faltas_injustificadas: totNov.faltas_injustificadas
    }
  }, [totBase, totNov, novedades.length])
  const avisosCategoria = useMemo(
    () => avisosCategoriaCierre(novedades, nombres, periodo),
    [novedades, nombres, periodo]
  )
  const lineaSel = useMemo(
    () => (empleadoSel != null ? lineas.find((l) => l.id_usuario === empleadoSel) ?? null : lineas[0] ?? null),
    [empleadoSel, lineas]
  )
  const novedadesSel = useMemo(
    () =>
      lineaSel
        ? novedades
            .filter((n) => n.id_usuario === lineaSel.id_usuario)
            .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde))
        : [],
    [lineaSel, novedades]
  )
  const novedadesSelOk = useMemo(
    () => novedadesSel.filter((n) => novedadEmpleadoIncorrecto(n, nombres).length === 0),
    [novedadesSel, nombres]
  )
  const novedadesSelCruzadas = useMemo(
    () =>
      novedadesSel
        .map((n) => ({ n, cruzados: novedadEmpleadoIncorrecto(n, nombres) }))
        .filter((x) => x.cruzados.length > 0),
    [novedadesSel, nombres]
  )
  const conceptosSel = useMemo(
    () =>
      lineaSel
        ? conceptosMiLiquidacionDigital(lineaSel, valorHora, novedadesSelOk, periodo, nombres)
        : [],
    [lineaSel, valorHora, novedadesSelOk, periodo, nombres]
  )
  const totConceptosSel = useMemo(() => totalesConceptosDigital(conceptosSel), [conceptosSel])
  const conteosPorEmpleado = useMemo(() => {
    const map = new Map<number, ReturnType<typeof conteosNovedadCierre>>()
    for (const l of lineas) {
      const novs = novedades.filter((n) => n.id_usuario === l.id_usuario)
      map.set(l.id_usuario, conteosNovedadCierre(novs, diasMes, l.nombre, nombres))
    }
    return map
  }, [lineas, novedades, diasMes, nombres])

  const handleCerrar = async () => {
    if (!usuario?.id) return
    if (lineas.length === 0) {
      setError('Generá el borrador antes de cerrar')
      return
    }
    if (!confirm(`¿Cerrar liquidación de ${periodo}? Se congelará el snapshot para el estudio.`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoCerrar({
        periodo,
        valor_hora_default: valorHora,
        notas: notas || null,
        cerrado_por: usuario.id,
        lineas
      })
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo cerrar')
      setPeriodoDb(res.data)
      setMsg('Período cerrado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar')
    } finally {
      setBusy(false)
    }
  }

  const handleReabrir = async () => {
    if (!canReabrir) {
      setError('Solo gerencia/admin puede reabrir un período cerrado')
      return
    }
    if (!confirm(`¿Reabrir liquidación ${periodo}? Podrás regenerar el borrador.`)) return
    setBusy(true)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoReabrir(periodo)
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo reabrir')
      setPeriodoDb(res.data)
      await generarBorrador()
      setMsg('Período reabierto')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reabrir')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    if (lineas.length === 0) {
      setError('No hay líneas para exportar')
      return
    }
    exportarLiquidacionXlsx({
      periodo,
      lineas,
      novedades,
      nombres,
      valorHora,
      estado: cerrado ? 'cerrado' : 'borrador'
    })
  }

  const handleGuardarValor = async () => {
    setBusy(true)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoUpsert({
        periodo,
        valor_hora_default: valorHora,
        notas: notas || null
      })
      if (res.success && res.data) setPeriodoDb(res.data)
      try {
        localStorage.setItem(LS_VALOR_HORA_EXTRA, String(valorHora))
      } catch {
        /* ignore */
      }
      setMsg('Valor hora / notas guardados')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || (!canAccess && !loading)) {
    return (
      <div className="rrhh-liq-loading">
        <div className="spinner" />
        <p>Cargando…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-liq-page">
      <nav className="rrhh-liq-breadcrumb" aria-label="Ubicación">
        <button type="button" onClick={() => navigate('/rrhh')}>
          Inicio
        </button>
        <span aria-hidden>›</span>
        <span>RRHH</span>
        <span aria-hidden>›</span>
        <strong>
          {seccion === 'incluye' ? 'Qué incluye' : seccion === 'envio' ? 'Envío al estudio' : 'Liquidación'}
        </strong>
      </nav>

      <header className="rrhh-liq-header">
        <div>
          <p className="rrhh-liq-kicker">Plot Lab · RRHH</p>
          <h1>Liquidación mensual</h1>
          <p className="rrhh-liq-subtitle">
            Cierre interno del mes para el estudio: días trabajados, vacaciones, licencias, faltas, horas extra,
            anticipos y descuento comida. No es el recibo de sueldo ni F.931.
          </p>
        </div>
        <div className="rrhh-liq-header-actions">
          <button type="button" className="rrhh-liq-btn ghost" onClick={() => navigate('/rrhh')}>
            Volver
          </button>
        </div>
      </header>

      <div className="rrhh-liq-layout">
        <aside className="rrhh-liq-nav" aria-label="Secciones">
          <p className="rrhh-liq-nav-title">Cierre del mes</p>
          <button
            type="button"
            className={seccion === 'liquidacion' ? 'is-active' : undefined}
            onClick={() => setSeccion('liquidacion')}
          >
            Liquidación
          </button>
          <button
            type="button"
            className={seccion === 'incluye' ? 'is-active' : undefined}
            onClick={() => setSeccion('incluye')}
          >
            Qué incluye
          </button>
          <button
            type="button"
            className={seccion === 'envio' ? 'is-active' : undefined}
            onClick={() => setSeccion('envio')}
          >
            Envío al estudio
          </button>
        </aside>

        <div className="rrhh-liq-main">
          {seccion === 'incluye' ? (
            <article className="rrhh-liq-doc">
              <h2>Qué incluye este cierre</h2>
              <p>
                Plot Lab arma el borrador con lo cargado en RRHH del período. El estudio liquida el sueldo; acá
                no se calcula básico, SAC ni aportes.
              </p>
              <ul>
                <li>Días trabajados y tardanzas (asistencia)</li>
                <li>Vacaciones y licencias (días informativos para el estudio)</li>
                <li>Faltas justificadas e injustificadas</li>
                <li>Horas extra 50% y 100% del reloj + HE declaradas aprobadas (crédito)</li>
                <li>Anticipaciones de sueldo y descuento beneficio comida (débito)</li>
              </ul>
              <p className="rrhh-liq-doc-note">
                Si una novedad está mal categorizada (p. ej. vacaciones cargadas como injustificada), el cierre
                avisa y toma el texto. Conviene corregirla en Novedades y regenerar.
              </p>
            </article>
          ) : seccion === 'envio' ? (
            <article className="rrhh-liq-doc">
              <h2>Envío al estudio</h2>
              <p>Para mandar el mes:</p>
              <ul>
                <li>Revisá valor hora HE, notas y avisos de categoría (vacaciones mal cargadas, etc.)</li>
                <li>Regenerá el borrador y controlá solape marca / novedad de HE</li>
                <li>Cerrá el período (queda bloqueado hasta que gerencia o admin lo reabra)</li>
                <li>Exportá el Excel (Liquidación, HE y Novedades del mes)</li>
              </ul>
              <p className="rrhh-liq-doc-note">
                {etiquetaPeriodoEs(periodo)} · {fechaCortaEs(periodoDesde)} – {fechaCortaEs(periodoHasta)} ·{' '}
                {cerrado ? 'cerrado' : 'borrador'} · {lineas.length} trabajadores.
              </p>
            </article>
          ) : (
            <>
              <div className="rrhh-liq-toolbar">
                <label>
                  Período
                  <input
                    type="month"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Valor hora (HE)
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={valorHora || ''}
                    onChange={(e) => setValorHora(Number(e.target.value) || 0)}
                    disabled={cerrado || busy}
                  />
                </label>
                <span className={`rrhh-liq-badge ${cerrado ? 'cerrado' : 'borrador'}`}>
                  {cerrado ? 'Cerrado' : 'Borrador'}
                </span>
                {!cerrado ? (
                  <>
                    <button type="button" className="rrhh-liq-btn" disabled={busy} onClick={() => void generarBorrador()}>
                      Regenerar borrador
                    </button>
                    <button type="button" className="rrhh-liq-btn ghost" disabled={busy} onClick={() => void handleGuardarValor()}>
                      Guardar valor/notas
                    </button>
                    <button type="button" className="rrhh-liq-btn primary" disabled={busy} onClick={() => void handleCerrar()}>
                      Cerrar período
                    </button>
                  </>
                ) : (
                  <button type="button" className="rrhh-liq-btn warn" disabled={busy || !canReabrir} onClick={() => void handleReabrir()}>
                    Reabrir
                  </button>
                )}
                <button type="button" className="rrhh-liq-btn" disabled={busy || lineas.length === 0} onClick={handleExport}>
                  Exportar Excel
                </button>
              </div>

              <label className="rrhh-liq-notas">
                Notas
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  disabled={cerrado || busy}
                  placeholder="Observaciones para el estudio…"
                />
              </label>

              {error ? <p className="rrhh-liq-error">{error}</p> : null}
              {msg ? <p className="rrhh-liq-msg">{msg}</p> : null}
              {avisosCategoria.length > 0 ? (
                <div className="rrhh-liq-avisos rrhh-liq-avisos-cat">
                  <strong>Revisar categoría de novedades</strong>
                  <ul>
                    {avisosCategoria.slice(0, 12).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                    {avisosCategoria.length > 12 ? <li>… y {avisosCategoria.length - 12} más</li> : null}
                  </ul>
                </div>
              ) : null}
              {avisosSolape.length > 0 ? (
                <div className="rrhh-liq-avisos">
                  <strong>Aviso: posible solape marca / novedad HE</strong>
                  <ul>
                    {avisosSolape.slice(0, 12).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                    {avisosSolape.length > 12 ? <li>… y {avisosSolape.length - 12} más</li> : null}
                  </ul>
                </div>
              ) : null}

              {loading ? (
                <p className="rrhh-liq-inline-loading">Calculando…</p>
              ) : (
                <>
                  <section className="rrhh-liq-envio" aria-label="Cierre del período">
                    <h2>Cierre del período</h2>
                    <dl>
                      <div>
                        <dt>Período</dt>
                        <dd>{etiquetaPeriodoEs(periodo)}</dd>
                      </div>
                      <div>
                        <dt>Desde / hasta</dt>
                        <dd>
                          {fechaCortaEs(periodoDesde)} – {fechaCortaEs(periodoHasta)}
                        </dd>
                      </div>
                      <div>
                        <dt>Valor hora HE</dt>
                        <dd>{valorHora > 0 ? formatArs(valorHora) : 'Sin cargar'}</dd>
                      </div>
                      <div>
                        <dt>Estado</dt>
                        <dd>{cerrado ? 'Cerrado' : 'Borrador'}</dd>
                      </div>
                      <div>
                        <dt>Trabajadores</dt>
                        <dd>{lineas.length}</dd>
                      </div>
                      <div>
                        <dt>Destino</dt>
                        <dd>Estudio contable</dd>
                      </div>
                    </dl>
                  </section>

                  <div className="rrhh-liq-totales">
                    <div>
                      <span>HE 50% (crédito)</span>
                      <strong>{tot.he50.toFixed(2)} hs</strong>
                    </div>
                    <div>
                      <span>HE 100% (crédito)</span>
                      <strong>{tot.he100.toFixed(2)} hs</strong>
                    </div>
                    <div>
                      <span>Costo HE</span>
                      <strong>{valorHora > 0 ? formatArs(tot.costo_he) : '—'}</strong>
                    </div>
                    <div>
                      <span>Vacaciones</span>
                      <strong>{tot.vacaciones} d</strong>
                    </div>
                    <div>
                      <span>Faltas injust.</span>
                      <strong>{tot.faltas_injustificadas}</strong>
                    </div>
                    <div>
                      <span>Anticipaciones (débito)</span>
                      <strong>{formatArs(tot.anticipacion_sueldo)}</strong>
                    </div>
                    <div>
                      <span>Desc. comida (débito)</span>
                      <strong>{formatArs(tot.descuento_comida)}</strong>
                    </div>
                  </div>

                  <div className="rrhh-liq-split">
                    <div className="rrhh-liq-table-wrap">
                      <table className="rrhh-liq-table">
                        <thead>
                          <tr>
                            <th>Trabajador</th>
                            <th>Sector</th>
                            <th>Días</th>
                            <th>Vac.</th>
                            <th>FI</th>
                            <th>HE 50</th>
                            <th>HE 100</th>
                            <th>Débitos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map((l) => {
                            const debitos = l.anticipacion_sueldo + l.descuento_comida
                            const sel = (lineaSel?.id_usuario ?? null) === l.id_usuario
                            const cEmp = conteosPorEmpleado.get(l.id_usuario)
                            const tieneNov = novedades.some((n) => n.id_usuario === l.id_usuario)
                            const vac = tieneNov ? cEmp?.vacaciones ?? 0 : numDetalleLinea(l, 'dias_vacaciones')
                            const fi = tieneNov ? cEmp?.faltas_injustificadas ?? 0 : l.faltas_injustificadas
                            return (
                              <tr
                                key={l.id_usuario}
                                className={sel ? 'is-selected' : undefined}
                                onClick={() => setEmpleadoSel(l.id_usuario)}
                              >
                                <td>{l.nombre}</td>
                                <td>{legajos.get(l.id_usuario)?.sector || '—'}</td>
                                <td>{l.dias_trabajados}</td>
                                <td>{vac || '—'}</td>
                                <td>{fi || '—'}</td>
                                <td>{l.he50.toFixed(2)}</td>
                                <td>{l.he100.toFixed(2)}</td>
                                <td>{debitos ? formatArs(debitos) : '—'}</td>
                              </tr>
                            )
                          })}
                          {lineas.length === 0 ? (
                            <tr>
                              <td colSpan={8}>Sin datos para este período</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {lineaSel ? (
                      <article className="rrhh-liq-recibo" aria-label="Detalle de liquidación del trabajador">
                        <header>
                          <p>Detalle para el estudio</p>
                          <h3>{lineaSel.nombre}</h3>
                          <dl>
                            <div>
                              <dt>DNI</dt>
                              <dd>{legajos.get(lineaSel.id_usuario)?.dni || '—'}</dd>
                            </div>
                            <div>
                              <dt>Sector</dt>
                              <dd>{legajos.get(lineaSel.id_usuario)?.sector || '—'}</dd>
                            </div>
                            <div>
                              <dt>Período</dt>
                              <dd>{etiquetaPeriodoEs(periodo)}</dd>
                            </div>
                          </dl>
                        </header>
                        <table>
                          <thead>
                            <tr>
                              <th>Cód.</th>
                              <th>Concepto</th>
                              <th>Cant.</th>
                              <th>Unidad</th>
                              <th>Importe</th>
                              <th>D/C</th>
                            </tr>
                          </thead>
                          <tbody>
                            {conceptosSel.map((c) => (
                              <tr key={c.codigo}>
                                <td>{c.codigo}</td>
                                <td>{c.concepto}</td>
                                <td>{c.cantidad}</td>
                                <td>{c.unidad}</td>
                                <td>{c.importe != null ? formatArs(c.importe) : '—'}</td>
                                <td>{c.debCred}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={4}>Total crédito</td>
                              <td colSpan={2}>{formatArs(totConceptosSel.credito)}</td>
                            </tr>
                            <tr>
                              <td colSpan={4}>Total débito</td>
                              <td colSpan={2}>{formatArs(totConceptosSel.debito)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {novedadesSelCruzadas.length > 0 ? (
                          <div className="rrhh-liq-recibo-nov rrhh-liq-recibo-nov-cruzada">
                            <h4>No corresponden a este trabajador</h4>
                            <ul>
                              {novedadesSelCruzadas.map(({ n, cruzados }) => (
                                <li key={n.id} className="is-aviso">
                                  <strong>
                                    {rangoNovedadCorto(n)} · el texto habla de {cruzados[0]?.nombre}
                                  </strong>
                                  <em className="rrhh-liq-nov-aviso">
                                    Datos cruzados: corregí el empleado en Novedades. No entra en este cierre.
                                  </em>
                                  {n.observaciones ? <span> — {n.observaciones}</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {novedadesSelOk.length > 0 ? (
                          <div className="rrhh-liq-recibo-nov">
                            <h4>Novedades del período</h4>
                            <ul>
                              {novedadesSelOk.map((n) => {
                                const et = etiquetaNovedadCierre(n)
                                return (
                                  <li key={n.id} className={et.recategorizada ? 'is-aviso' : undefined}>
                                    <strong>
                                      {rangoNovedadCorto(n)} · {et.grupo} · {et.etiqueta}
                                    </strong>
                                    {n.horas_extra_cantidad != null ? ` · ${n.horas_extra_cantidad} hs` : ''}
                                    {n.duracion_minutos != null && n.grupo === 'tardanza_retiro'
                                      ? ` · ${n.duracion_minutos} min`
                                      : ''}
                                    {et.recategorizada ? (
                                      <em className="rrhh-liq-nov-aviso">
                                        {' '}
                                        Cargada como {et.codigoOriginal}; el texto indica vacaciones.
                                      </em>
                                    ) : null}
                                    {n.observaciones ? <span> — {n.observaciones}</span> : null}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ) : null}
                        <p className="rrhh-liq-recibo-foot">
                          C = haber (HE) · D = descuento (anticipo / comida) · — = informativo (días, vacaciones,
                          faltas). El sueldo básico lo liquida el estudio.
                        </p>
                      </article>
                    ) : null}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosLiquidacionPage
