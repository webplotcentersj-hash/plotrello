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
import { formatArs, LS_VALOR_HORA_EXTRA, type HorarioFijoAsistencia } from '../utils/asistenciaStats'
import {
  armarLineasLiquidacion,
  conceptosMiLiquidacionDigital,
  periodoRango,
  totalesConceptosDigital,
  totalesLineas
} from '../utils/rrhhLiquidacion'
import { exportarLiquidacionXlsx } from '../utils/exportLiquidacionXlsx'
import { etiquetaCodigoRrhhNovedad } from '../utils/rrhhNovedadCatalog'
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

  const tot = useMemo(() => totalesLineas(lineas), [lineas])
  const lineaSel = useMemo(
    () => (empleadoSel != null ? lineas.find((l) => l.id_usuario === empleadoSel) ?? null : lineas[0] ?? null),
    [empleadoSel, lineas]
  )
  const conceptosSel = useMemo(
    () => (lineaSel ? conceptosMiLiquidacionDigital(lineaSel, valorHora) : []),
    [lineaSel, valorHora]
  )
  const totConceptosSel = useMemo(() => totalesConceptosDigital(conceptosSel), [conceptosSel])
  const novedadesSel = useMemo(
    () =>
      lineaSel
        ? novedades
            .filter((n) => n.id_usuario === lineaSel.id_usuario)
            .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde))
        : [],
    [lineaSel, novedades]
  )

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
            Cierre interno del mes para el estudio contable: novedades, horas extra, faltas, anticipos y
            descuento comida. Conceptos con cantidad, importe y débito/crédito.
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
                Plot Lab arma el borrador con lo que ya está cargado en RRHH del período. El estudio usa el
                Excel para liquidar el sueldo; acá no se calcula el básico ni los aportes.
              </p>
              <ul>
                <li>Asistencia: días trabajados, tardanzas, ausencias y faltas injustificadas</li>
                <li>Novedades de horas extra 50% y 100% (con valor hora configurable)</li>
                <li>Anticipaciones de sueldo (débito)</li>
                <li>Descuento por beneficio comida (débito)</li>
              </ul>
              <p className="rrhh-liq-doc-note">
                Si falta un dato, cargalo en Novedades, Asistencia o Menú diario y regenerá el borrador.
              </p>
            </article>
          ) : seccion === 'envio' ? (
            <article className="rrhh-liq-doc">
              <h2>Envío al estudio</h2>
              <p>Para mandar el mes:</p>
              <ul>
                <li>Revisá el valor hora de HE y las notas</li>
                <li>Regenerá el borrador y controlá avisos de solape marca / HE</li>
                <li>Cerrá el período (queda bloqueado hasta que gerencia o admin lo reabra)</li>
                <li>Exportá el Excel (hojas Liquidación, HE y Novedades del mes)</li>
              </ul>
              <p className="rrhh-liq-doc-note">
                Estado actual: {cerrado ? 'cerrado' : 'borrador'} · {lineas.length} trabajadores · período{' '}
                {periodo}.
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
                  <section className="rrhh-liq-envio" aria-label="Datos del período">
                    <h2>Datos del período</h2>
                    <dl>
                      <div>
                        <dt>Empresa</dt>
                        <dd>Plot Center</dd>
                      </div>
                      <div>
                        <dt>Sistema</dt>
                        <dd>Plot Lab</dd>
                      </div>
                      <div>
                        <dt>Período</dt>
                        <dd>{periodo}</dd>
                      </div>
                      <div>
                        <dt>Tipo</dt>
                        <dd>Mensual</dd>
                      </div>
                      <div>
                        <dt>Estado</dt>
                        <dd>{cerrado ? 'Cerrado' : 'Borrador'}</dd>
                      </div>
                      <div>
                        <dt>Trabajadores</dt>
                        <dd>{lineas.length}</dd>
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
                      <span>Anticipaciones (débito)</span>
                      <strong>{formatArs(tot.anticipacion_sueldo)}</strong>
                    </div>
                    <div>
                      <span>Desc. comida (débito)</span>
                      <strong>{formatArs(tot.descuento_comida)}</strong>
                    </div>
                    <div>
                      <span>Faltas injust.</span>
                      <strong>{tot.faltas_injustificadas}</strong>
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
                            <th>HE 50</th>
                            <th>HE 100</th>
                            <th>Débitos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map((l) => {
                            const debitos = l.anticipacion_sueldo + l.descuento_comida
                            const sel = (lineaSel?.id_usuario ?? null) === l.id_usuario
                            return (
                              <tr
                                key={l.id_usuario}
                                className={sel ? 'is-selected' : undefined}
                                onClick={() => setEmpleadoSel(l.id_usuario)}
                              >
                                <td>{l.nombre}</td>
                                <td>{legajos.get(l.id_usuario)?.sector || '—'}</td>
                                <td>{l.dias_trabajados}</td>
                                <td>{l.he50.toFixed(2)}</td>
                                <td>{l.he100.toFixed(2)}</td>
                                <td>{debitos ? formatArs(debitos) : '—'}</td>
                              </tr>
                            )
                          })}
                          {lineas.length === 0 ? (
                            <tr>
                              <td colSpan={6}>Sin datos para este período</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {lineaSel ? (
                      <article className="rrhh-liq-recibo" aria-label="Detalle de liquidación del trabajador">
                        <header>
                          <p>Conceptos del período</p>
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
                              <dd>{periodo}</dd>
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
                        {novedadesSel.length > 0 ? (
                          <div className="rrhh-liq-recibo-nov">
                            <h4>Novedades del mes</h4>
                            <ul>
                              {novedadesSel.map((n) => (
                                <li key={n.id}>
                                  {n.fecha_desde.slice(0, 10)} · {etiquetaCodigoRrhhNovedad(n.codigo)}
                                  {n.horas_extra_cantidad != null ? ` · ${n.horas_extra_cantidad} hs` : ''}
                                  {n.observaciones ? ` · ${n.observaciones}` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <p className="rrhh-liq-recibo-foot">
                          C = haber (HE) · D = descuento (anticipo / comida). El sueldo básico lo liquida el
                          estudio.
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
