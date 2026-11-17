import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import {
  anularBorrador,
  contabilizar,
  crearContraasiento,
  indiceEjercicio,
  listarAsientos
} from '../services/asientosApi'
import { listPeriodosContables, type PeriodoContable } from '../services/erpContableApi'
import {
  buscarEnAsiento,
  comprobanteRespaldatorio,
  contraasiento,
  controlesAsiento,
  lineasFormaDiario,
  nombreCuenta,
  numerosDeOrden,
  ordenCronologico,
  puedeContabilizar,
  resumenLibro,
  type AsientoLD
} from '../features/asientos/libroDiario'
import { descargarLibroDiarioPdf, libroDiarioCsv } from '../utils/documentos/libroDiarioPdf'
import { descargarCsv } from '../utils/erpUi'
import './ErpSectionPage.css'
import './AsientosContablesPage.css'

type Pendientes = { facturas: Array<{ id: number }>; cobrosPagos: Array<{ id: number }> }
type FiltroEstado = '' | 'Contabilizado' | 'Borrador' | 'Anulado' | 'conProblemas'

const POR_PAGINA = 40
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const hoyAr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const fechaAr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const pesos = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const mesLabel = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const ultimoDia = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}
const sumarMes = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AsientosContablesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hoy = hoyAr()

  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [ejercicioCompleto, setEjercicioCompleto] = useState(false)
  const [asientos, setAsientos] = useState<AsientoLD[]>([])
  const [indice, setIndice] = useState<AsientoLD[]>([])
  const [periodos, setPeriodos] = useState<PeriodoContable[]>([])
  const [pendientes, setPendientes] = useState<Pendientes>({ facturas: [], cobrosPagos: [] })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>((searchParams.get('estado') as FiltroEstado) || '')
  const [origen, setOrigen] = useState(searchParams.get('tipo') || '')
  const [pagina, setPagina] = useState(0)
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())
  const [reversion, setReversion] = useState<{ asiento: AsientoLD; fecha: string; motivo: string } | null>(null)

  const anio = mes.slice(0, 4)
  const desde = ejercicioCompleto ? `${anio}-01-01` : `${mes}-01`
  const hasta = ejercicioCompleto ? `${anio}-12-31` : ultimoDia(mes)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [lista, idx, pers, pend] = await Promise.all([
      listarAsientos(desde, hasta),
      indiceEjercicio(`${anio}-01-01`, `${anio}-12-31`),
      listPeriodosContables(),
      apiService.getErpPendientesAsientosSync()
    ])
    if (lista.success) setAsientos(lista.data)
    else setAviso({ tipo: 'error', texto: lista.error })
    if (idx.success) setIndice(idx.data)
    if (pers.success) setPeriodos(pers.data)
    setPendientes(pend.success && pend.data ? pend.data : { facturas: [], cobrosPagos: [] })
    setLoading(false)
  }, [desde, hasta, anio])

  const sincronizar = useCallback(
    async (silencioso: boolean) => {
      setSyncing(true)
      try {
        const r = await apiService.erpSyncAsientosDesdeFacturacion()
        if (r.success && r.data) {
          const { facturas_generadas: f, cobros_generados: c, errores } = r.data
          if (f + c > 0 || !silencioso) setAviso({ tipo: 'ok', texto: `Asientos generados: ${f} de facturas y ${c} de cobros/pagos.` })
          if (errores.length) setAviso({ tipo: 'error', texto: errores.slice(0, 2).join(' · ') + (errores.length > 2 ? ` (+${errores.length - 2})` : '') })
        } else if (!r.success && !silencioso) setAviso({ tipo: 'error', texto: r.error || 'No se pudo sincronizar' })
      } finally {
        setSyncing(false)
      }
    },
    []
  )

  // Al entrar: genera los asientos automáticos que falten y después carga.
  useEffect(() => {
    void sincronizar(true).then(() => cargar())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [])

  useEffect(() => {
    if (!syncing) void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga al cambiar el período
  }, [desde, hasta])

  useEffect(() => setPagina(0), [busqueda, estado, origen, desde, hasta])

  const orden = useMemo(() => numerosDeOrden(indice.length ? indice : asientos), [indice, asientos])
  const resumen = useMemo(() => resumenLibro(asientos, hoy), [asientos, hoy])
  const periodoCerrado = !ejercicioCompleto && periodos.some((p) => p.periodo === mes && p.estado === 'Cerrado')

  const visibles = useMemo(() => {
    const filtrados = asientos.filter((a) => {
      if (estado === 'conProblemas') {
        if (a.estado === 'Anulado' || !controlesAsiento(a).some((c) => c.nivel === 'error')) return false
      } else if (estado && a.estado !== estado) return false
      if (origen && a.tipo_asiento !== origen) return false
      return buscarEnAsiento(a, busqueda.trim())
    })
    return ordenCronologico(filtrados)
  }, [asientos, estado, origen, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const pag = Math.min(pagina, totalPaginas - 1)
  const pagina_ = visibles.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)
  const borradoresValidos = asientos.filter((a) => puedeContabilizar(a))
  const pendientesTotal = pendientes.facturas.length + pendientes.cobrosPagos.length
  const origenes = useMemo(() => [...new Set(asientos.map((a) => a.tipo_asiento))].sort(), [asientos])

  const alternar = (id: number) =>
    setAbiertos((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const accion = async (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setTrabajando(true)
    setAviso(null)
    const r = await fn()
    setTrabajando(false)
    setAviso(r.success ? { tipo: 'ok', texto: ok } : { tipo: 'error', texto: r.error || 'Error' })
    await cargar()
  }

  const contabilizarUno = (a: AsientoLD) => {
    if (!confirm(`¿Contabilizar ${a.numero_asiento}? Pasa al Libro Diario y después no se puede modificar (solo con contraasiento).`)) return
    void accion(() => contabilizar(a.id), `${a.numero_asiento} contabilizado.`)
  }

  const contabilizarTodos = async () => {
    if (!borradoresValidos.length) return
    if (!confirm(`¿Contabilizar ${borradoresValidos.length} borrador(es) sin errores? Pasan al Libro Diario y quedan inalterables.`)) return
    setTrabajando(true)
    let hechos = 0
    const fallas: string[] = []
    for (const a of ordenCronologico(borradoresValidos)) {
      const r = await contabilizar(a.id)
      if (r.success) hechos++
      else fallas.push(`${a.numero_asiento}: ${r.error}`)
    }
    setTrabajando(false)
    setAviso(
      fallas.length
        ? { tipo: 'error', texto: `Contabilizados ${hechos}. No se pudo: ${fallas.slice(0, 2).join(' · ')}` }
        : { tipo: 'ok', texto: `Contabilizados ${hechos} asiento(s).` }
    )
    await cargar()
  }

  const anular = (a: AsientoLD) => {
    const motivo = prompt(`Motivo para anular el borrador ${a.numero_asiento}:`)
    if (!motivo?.trim()) return
    void accion(() => anularBorrador(a.id, motivo), `${a.numero_asiento} anulado (el número queda registrado).`)
  }

  const confirmarReversion = async () => {
    if (!reversion || !reversion.motivo.trim()) return
    const r = await crearContraasiento(reversion.asiento, reversion.fecha, reversion.motivo)
    if (!r.success) {
      setAviso({ tipo: 'error', texto: r.error })
      return
    }
    setReversion(null)
    setAviso({ tipo: 'ok', texto: `Contraasiento de ${reversion.asiento.numero_asiento} creado en borrador: revisalo y contabilizalo.` })
    setEstado('')
    await cargar()
  }

  const exportarPdf = async () => {
    try {
      await descargarLibroDiarioPdf(asientos, { desde, hasta, asientosEjercicio: indice.length ? indice.map((i) => ({ ...i })) : undefined })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo generar el PDF' })
    }
  }

  const exportarCsv = () =>
    descargarCsv(
      `Libro_Diario_${desde}_a_${hasta}.csv`,
      ['Fecha', 'N° orden', 'Asiento', 'Código', 'Cuenta', 'Debe', 'Haber', 'Leyenda', 'Comprobante'],
      libroDiarioCsv(asientos, desde, hasta, indice.length ? indice : undefined)
    )

  return (
    <div className="erp-section asientos-page">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            📒
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Contable · Libro Diario</p>
            <h1>Asientos contables</h1>
            <p className="erp-section-sub">Partida doble, orden cronológico y asientos inalterables (CCyC arts. 320 a 331)</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/asientos/herramientas')}>
            Modelos e importación
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/contabilidad/periodos')}>
            Cierre de períodos
          </button>
          <button type="button" className="btn-primary" onClick={() => void sincronizar(false).then(() => cargar())} disabled={syncing}>
            {syncing ? 'Sincronizando…' : '↻ Generar automáticos'}
          </button>
        </div>
      </header>

      {/* Período */}
      <div className="as-periodo">
        <div className="as-periodo__nav">
          <button type="button" className="as-icono" onClick={() => setMes((m) => sumarMes(m, ejercicioCompleto ? -12 : -1))} aria-label="Anterior">
            ‹
          </button>
          <strong className="as-periodo__titulo">{ejercicioCompleto ? `Ejercicio ${anio}` : mesLabel(mes)}</strong>
          <button type="button" className="as-icono" onClick={() => setMes((m) => sumarMes(m, ejercicioCompleto ? 12 : 1))} aria-label="Siguiente">
            ›
          </button>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />
          <label className="as-check">
            <input type="checkbox" checked={ejercicioCompleto} onChange={(e) => setEjercicioCompleto(e.target.checked)} />
            Ejercicio completo
          </label>
          {!ejercicioCompleto ? (
            <span className={`as-chip ${periodoCerrado ? 'as-chip--cerrado' : 'as-chip--abierto'}`}>
              {periodoCerrado ? '🔒 Período cerrado' : 'Período abierto'}
            </span>
          ) : null}
        </div>
        <div className="as-periodo__export">
          <button type="button" className="btn-secondary" onClick={() => void exportarPdf()} disabled={loading}>
            Libro Diario PDF
          </button>
          <button type="button" className="btn-secondary" onClick={exportarCsv} disabled={loading}>
            CSV
          </button>
        </div>
      </div>

      {aviso ? (
        <div className={`as-aviso as-aviso--${aviso.tipo}`} role="status">
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}

      {/* Resumen */}
      <div className="as-kpis">
        <div className="as-kpi">
          <span>En el Libro Diario</span>
          <strong>{loading ? '…' : resumen.contabilizados}</strong>
          <small>asientos contabilizados</small>
        </div>
        <div className={`as-kpi ${resumen.balancea ? 'as-kpi--ok' : 'as-kpi--error'}`}>
          <span>Debe = Haber</span>
          <strong>$ {pesos(resumen.debe)}</strong>
          <small>{resumen.balancea ? '✓ el período balancea' : `✗ diferencia $ ${pesos(Math.abs(resumen.debe - resumen.haber))}`}</small>
        </div>
        <div className={`as-kpi ${resumen.borradores ? 'as-kpi--warn' : ''}`}>
          <span>Borradores</span>
          <strong>{resumen.borradores}</strong>
          {borradoresValidos.length ? (
            <button type="button" className="as-link" onClick={() => void contabilizarTodos()} disabled={trabajando || periodoCerrado}>
              Contabilizar {borradoresValidos.length} sin errores
            </button>
          ) : (
            <small>{resumen.borradores ? 'con errores para corregir' : 'nada pendiente'}</small>
          )}
        </div>
        <div className={`as-kpi ${pendientesTotal ? 'as-kpi--warn' : ''}`}>
          <span>Sin asiento</span>
          <strong>{pendientesTotal}</strong>
          {pendientesTotal ? (
            <button type="button" className="as-link" onClick={() => void sincronizar(false).then(() => cargar())} disabled={syncing}>
              Generar ({pendientes.facturas.length} facturas, {pendientes.cobrosPagos.length} cobros)
            </button>
          ) : (
            <small>facturas y cobros al día</small>
          )}
        </div>
      </div>

      {/* Controles normativos */}
      {!loading && (resumen.conErrores || resumen.borradoresViejos || resumen.sinComprobante || resumen.fueraDeOrden || !resumen.balancea) ? (
        <section className="as-controles">
          <h2>Controles del Libro Diario</h2>
          <ul>
            {!resumen.balancea ? (
              <li className="is-error">
                <b>El período no balancea.</b> La suma del debe tiene que ser igual a la del haber (partida doble).
              </li>
            ) : null}
            {resumen.conErrores ? (
              <li className="is-error">
                <b>{resumen.conErrores} asiento(s) con errores</b> que impiden contabilizarlos.{' '}
                <button type="button" className="as-link" onClick={() => setEstado('conProblemas')}>
                  Ver
                </button>
              </li>
            ) : null}
            {resumen.borradoresViejos ? (
              <li className="is-warn">
                <b>{resumen.borradoresViejos} borrador(es) de meses anteriores.</b> Contabilizalos o anulalos antes de cerrar el período.
              </li>
            ) : null}
            {resumen.sinComprobante ? (
              <li className="is-warn">
                <b>{resumen.sinComprobante} asiento(s) sin comprobante respaldatorio.</b> Cada registro debe indicar la documentación que lo
                respalda (art. 330 CCyC).
              </li>
            ) : null}
            {resumen.fueraDeOrden ? (
              <li className="is-info">
                <b>{resumen.fueraDeOrden} asiento(s) cargados después con fecha anterior.</b> No es un error: el Libro Diario los ordena por
                fecha y les asigna el N° de orden correlativo.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {/* Filtros */}
      <div className="as-filtros">
        <input
          type="search"
          className="as-buscar"
          placeholder="Buscar por N°, leyenda, cuenta o comprobante…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="as-tabs" role="tablist" aria-label="Estado">
          {(
            [
              ['', 'Todos'],
              ['Contabilizado', 'Contabilizados'],
              ['Borrador', 'Borradores'],
              ['Anulado', 'Anulados'],
              ['conProblemas', 'Con errores']
            ] as Array<[FiltroEstado, string]>
          ).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={estado === v} className={estado === v ? 'is-on' : undefined} onClick={() => setEstado(v)}>
              {l}
            </button>
          ))}
        </div>
        <select value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Origen">
          <option value="">Todo origen</option>
          {origenes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {/* Libro */}
      <section className="as-libro">
        {loading ? (
          <p className="as-vacio">Cargando asientos…</p>
        ) : visibles.length === 0 ? (
          <p className="as-vacio">No hay asientos con esos filtros en {ejercicioCompleto ? `el ejercicio ${anio}` : mesLabel(mes)}.</p>
        ) : (
          <table className="as-tabla">
            <thead>
              <tr>
                <th className="as-col-orden" title="N° de orden en el Libro Diario (correlativo por fecha)">N°</th>
                <th>Fecha</th>
                <th>Leyenda</th>
                <th className="num">Debe</th>
                <th className="num">Haber</th>
                <th>Estado</th>
                <th aria-label="Detalle" />
              </tr>
            </thead>
            <tbody>
              {pagina_.map((a) => {
                const abierto = abiertos.has(a.id)
                const controles = a.estado === 'Anulado' ? [] : controlesAsiento(a)
                const errores = controles.filter((c) => c.nivel === 'error')
                const comprobante = comprobanteRespaldatorio(a)
                return (
                  <Fragment key={a.id}>
                    <tr className={`as-fila as-fila--${a.estado.toLowerCase()}${abierto ? ' is-open' : ''}`} onClick={() => alternar(a.id)}>
                      <td className="as-col-orden">{orden.get(a.id) ?? '—'}</td>
                      <td className="as-fecha">{fechaAr(a.fecha)}</td>
                      <td className="as-leyenda">
                        <strong>{a.concepto}</strong>
                        <span>
                          {a.numero_asiento} · {a.tipo_asiento}
                          {comprobante ? ` · ${comprobante}` : ''}
                          {errores.length ? <em className="as-badge-error"> {errores.length} error(es)</em> : null}
                        </span>
                      </td>
                      <td className="num">{pesos(a.total_debe)}</td>
                      <td className="num">{pesos(a.total_haber)}</td>
                      <td>
                        <span className={`as-estado as-estado--${a.estado.toLowerCase()}`}>{a.estado}</span>
                      </td>
                      <td className="as-chevron" aria-hidden>
                        {abierto ? '▾' : '▸'}
                      </td>
                    </tr>
                    {abierto ? (
                      <tr className="as-detalle">
                        <td colSpan={7}>
                          <div className="as-detalle__cuerpo">
                            <table className="as-diario">
                              <tbody>
                                {lineasFormaDiario(a.detalles ?? []).map((l, i) => {
                                  const haber = Number(l.haber) > 0
                                  return (
                                    <tr key={l.id ?? i}>
                                      <td className={haber ? 'as-diario__haber' : undefined}>
                                        {haber ? <span className="as-diario__a">a</span> : null}
                                        {nombreCuenta(l)}
                                        {l.concepto ? <small> — {l.concepto}</small> : null}
                                      </td>
                                      <td className="num">{Number(l.debe) > 0 ? pesos(Number(l.debe)) : ''}</td>
                                      <td className="num">{haber ? pesos(Number(l.haber)) : ''}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                            {a.observaciones ? <p className="as-obs">{a.observaciones}</p> : null}
                            {controles.length ? (
                              <ul className="as-controles-asiento">
                                {controles.map((c) => (
                                  <li key={c.codigo} className={`is-${c.nivel}`}>
                                    {c.texto}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <div className="as-acciones">
                              {a.estado === 'Borrador' ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    disabled={trabajando || errores.length > 0 || periodoCerrado}
                                    title={errores.length ? 'Corregí los errores antes de contabilizar' : undefined}
                                    onClick={() => contabilizarUno(a)}
                                  >
                                    Contabilizar
                                  </button>
                                  <button type="button" className="btn-secondary btn-sm" disabled={trabajando || periodoCerrado} onClick={() => anular(a)}>
                                    Anular borrador
                                  </button>
                                </>
                              ) : null}
                              {a.estado === 'Contabilizado' ? (
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  disabled={trabajando}
                                  onClick={() => setReversion({ asiento: a, fecha: hoy, motivo: '' })}
                                  title="Un asiento contabilizado no se modifica: se corrige con un contraasiento"
                                >
                                  Revertir con contraasiento
                                </button>
                              ) : null}
                              {a.tipo_origen === 'factura' && a.id_origen ? (
                                <button type="button" className="btn-secondary btn-sm" onClick={() => navigate(`/erp/facturas/${a.id_origen}`)}>
                                  Ver factura
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
            {pag === totalPaginas - 1 ? (
              <tfoot>
                <tr>
                  <td colSpan={3}>Totales ({visibles.length} asientos{estado || origen || busqueda ? ', filtrados' : ''})</td>
                  <td className="num">{pesos(visibles.filter((a) => a.estado !== 'Anulado').reduce((s, a) => s + a.total_debe, 0))}</td>
                  <td className="num">{pesos(visibles.filter((a) => a.estado !== 'Anulado').reduce((s, a) => s + a.total_haber, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        )}
        {totalPaginas > 1 ? (
          <div className="as-paginas">
            <button type="button" className="as-icono" disabled={pag === 0} onClick={() => setPagina(pag - 1)} aria-label="Página anterior">
              ‹
            </button>
            <span>
              {pag * POR_PAGINA + 1}–{Math.min((pag + 1) * POR_PAGINA, visibles.length)} de {visibles.length}
            </span>
            <button
              type="button"
              className="as-icono"
              disabled={pag >= totalPaginas - 1}
              onClick={() => setPagina(pag + 1)}
              aria-label="Página siguiente"
            >
              ›
            </button>
          </div>
        ) : null}
      </section>

      {reversion ? (
        <div className="as-modal-fondo" role="dialog" aria-modal="true" aria-label="Contraasiento" onClick={() => setReversion(null)}>
          <div className="as-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Revertir {reversion.asiento.numero_asiento}</h2>
            <p className="as-modal__sub">
              Un asiento contabilizado no se modifica ni se borra (art. 329 CCyC). Se crea un <b>contraasiento</b> con las mismas cuentas y
              el debe y el haber invertidos, en borrador para que lo revises y lo contabilices. Después cargá el asiento correcto.
            </p>
            <table className="as-diario">
              <tbody>
                {lineasFormaDiario(
                  contraasiento(reversion.asiento, reversion.fecha, reversion.motivo || '…').detalles.map((d) => ({
                    ...d,
                    cuenta: reversion.asiento.detalles?.find((x) => x.id_cuenta === d.id_cuenta)?.cuenta
                  }))
                ).map((l, i) => (
                  <tr key={i}>
                    <td className={l.haber > 0 ? 'as-diario__haber' : undefined}>
                      {l.haber > 0 ? <span className="as-diario__a">a</span> : null}
                      {nombreCuenta(l)}
                    </td>
                    <td className="num">{l.debe > 0 ? pesos(l.debe) : ''}</td>
                    <td className="num">{l.haber > 0 ? pesos(l.haber) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="as-modal__campos">
              <label>
                <span>Fecha del contraasiento</span>
                <input type="date" value={reversion.fecha} onChange={(e) => setReversion({ ...reversion, fecha: e.target.value })} />
              </label>
              <label>
                <span>Motivo *</span>
                <input
                  type="text"
                  value={reversion.motivo}
                  onChange={(e) => setReversion({ ...reversion, motivo: e.target.value })}
                  placeholder="Ej. cuenta mal imputada"
                  autoFocus
                />
              </label>
            </div>
            <div className="as-modal__acciones">
              <button type="button" className="btn-secondary" onClick={() => setReversion(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={!reversion.motivo.trim() || trabajando} onClick={() => void confirmarReversion()}>
                Crear contraasiento
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
