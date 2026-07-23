import { useEffect, useMemo, useState } from 'react'
import SignaturePad from '../../../components/SignaturePad'
import { useCajaOperativa } from '../../../hooks/useCajaOperativa'
import { BILLETE_DENOMINACIONES, TURNOS_CAJA } from '../constants'
import {
  arqueoBloqueadoHastaCierre,
  listCajas,
  listEgresoSolicitudes,
  listMovimientos,
  listPlanillas,
  saveArqueo
} from '../cajaRepository'
import { alertaDobleFuenteCaja, resumenPlotlabVentasCaja } from '../plotlabVentasCajaData'
import {
  combinarResumenPlotlab,
  resumenPlotlabVentasDesdeApi
} from '../plotlabVentaCajaSync'
import { efectivoObjetivoArqueoPlotLab } from '../cajaMenuOperativaData'
import type { ResumenPlotlabVentasCaja } from '../plotlabVentasCajaData'
import CajaPlotlabVentasPanel from './CajaPlotlabVentasPanel'
import { calcularTeoricoFisicoCaja } from '../arqueoCalculations'
import { estadoArqueo } from '../movimientoCaja'
import { fmtArs, fmtArs0, fmtDateAr, parseNum } from '../format'
import { fondoFijoEfectivo } from '../fondoCaja'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { efectivoQuedaEnCajaDesdePlanilla } from '../cajaTotales'
import { uploadAttachmentAndGetUrl } from '../../../utils/storage'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaArqueo, CajaEgresoSolicitud, CajaRegistro } from '../types'
import { notifyArqueoCompletado } from '../cajaSyncNotify'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloCajasOperativas?: boolean
  /** Vista cajera: caja asociada al usuario; selector solo si no se puede resolver. */
  fijarCajaUsuario?: boolean
  onSaved?: () => void
  onIrCierreTurno?: () => void
  onIrEgresos?: () => void
  /** Planilla PDF leída arriba — referencia para arqueo físico. */
  planillaActiva?: PlanillaCajaParsed | null
  /** Incrementar tras importar planilla para refrescar movimientos sin remontar la vista. */
  movimientosRefreshKey?: number
}

export default function CajaSectionArqueo({
  usuarioNombre,
  usuarioId,
  soloCajasOperativas = true,
  fijarCajaUsuario = false,
  onSaved,
  onIrCierreTurno,
  onIrEgresos,
  planillaActiva = null,
  movimientosRefreshKey = 0
}: Props) {
  const {
    slug: cajaSlugOperativa,
    loading: cajaOperativaLoading,
    error: cajaOperativaError
  } = useCajaOperativa({ enabled: fijarCajaUsuario })

  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [turno, setTurno] = useState<string>('Único')
  const [billetes, setBilletes] = useState<Record<string, number>>({})
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [firmaPadKey, setFirmaPadKey] = useState(0)
  const [firmaError, setFirmaError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgOk, setMsgOk] = useState(false)
  const [egresosDia, setEgresosDia] = useState<CajaEgresoSolicitud[]>([])
  const [egresosVinculadosIds, setEgresosVinculadosIds] = useState<string[]>([])
  const [ticketJustifUrl, setTicketJustifUrl] = useState('')
  const [ticketJustifNombre, setTicketJustifNombre] = useState('')
  const [subiendoTicket, setSubiendoTicket] = useState(false)
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [resumenPlotlabApi, setResumenPlotlabApi] = useState<ResumenPlotlabVentasCaja | null>(null)
  const [arqueoBloqueado, setArqueoBloqueado] = useState(false)
  const [ultimoArqueoBloqueo, setUltimoArqueoBloqueo] = useState<CajaArqueo | null>(null)

  useEffect(() => {
    if (!cajaSlug || !fecha) return
    void Promise.all([listMovimientos(), listPlanillas(120), listEgresoSolicitudes({ fecha, cajaSlug })]).then(
      ([m, p, e]) => {
        setMovimientos(m)
        setPlanillas(p)
        setEgresosDia(e)
      }
    )
  }, [cajaSlug, fecha, movimientosRefreshKey])

  useEffect(() => {
    if (!cajaSlug || !fecha) {
      setArqueoBloqueado(false)
      setUltimoArqueoBloqueo(null)
      return
    }
    let cancelled = false
    void arqueoBloqueadoHastaCierre(cajaSlug, fecha).then((lock) => {
      if (cancelled) return
      setArqueoBloqueado(lock.bloqueado)
      setUltimoArqueoBloqueo(lock.ultimoArqueo)
    })
    return () => {
      cancelled = true
    }
  }, [cajaSlug, fecha, movimientosRefreshKey, msgOk])

  useEffect(() => {
    if (!cajaSlug || !fecha) return
    void resumenPlotlabVentasDesdeApi(fecha, cajaSlug, usuarioId).then(setResumenPlotlabApi)
  }, [cajaSlug, fecha, usuarioId, movimientosRefreshKey])

  useEffect(() => {
    const onRefresh = () => {
      void listMovimientos().then(setMovimientos)
      if (cajaSlug && fecha) {
        void resumenPlotlabVentasDesdeApi(fecha, cajaSlug, usuarioId).then(setResumenPlotlabApi)
      }
    }
    window.addEventListener('caja-datos-actualizados', onRefresh)
    window.addEventListener('plotlab-sync-caja', onRefresh as EventListener)
    return () => {
      window.removeEventListener('caja-datos-actualizados', onRefresh)
      window.removeEventListener('plotlab-sync-caja', onRefresh as EventListener)
    }
  }, [cajaSlug, fecha, usuarioId])

  useEffect(() => {
    if (!planillaActiva) return
    const f = planillaActiva.fecha_hasta || planillaActiva.fecha_desde
    if (f) setFecha(f)
  }, [planillaActiva?.archivo_nombre, planillaActiva?.fecha_desde, planillaActiva?.fecha_hasta])

  useEffect(() => {
    void listCajas().then((list) => {
      const filtered = soloCajasOperativas
        ? list.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
        : list
      setCajas(filtered)
      if (!fijarCajaUsuario && filtered.length) {
        setCajaSlug((prev) => prev || filtered[0].slug)
      }
    })
  }, [soloCajasOperativas, fijarCajaUsuario])

  useEffect(() => {
    if (fijarCajaUsuario && cajaSlugOperativa) setCajaSlug(cajaSlugOperativa)
  }, [fijarCajaUsuario, cajaSlugOperativa])

  const onCajaManual = (slug: string) => {
    setCajaSlug(slug)
  }

  const total = useMemo(() => {
    return BILLETE_DENOMINACIONES.reduce((sum, d) => {
      const q = billetes[`b${d}`] ?? 0
      return sum + q * d
    }, 0)
  }, [billetes])

  const cajaActiva = cajas.find((c) => c.slug === cajaSlug)
  const fondoTraspaso = cajaActiva ? fondoFijoEfectivo(cajaActiva) : 0
  const otraCajaOperativa = cajas.find((c) => c.slug !== cajaSlug && c.slug !== 'admin' && c.slug !== 'vuelto')

  const teorico = useMemo(() => {
    if (!cajaSlug || !cajaActiva) return null
    return calcularTeoricoFisicoCaja(
      movimientos,
      cajaSlug,
      fecha,
      fecha,
      fondoFijoEfectivo(cajaActiva)
    )
  }, [movimientos, cajaSlug, fecha, cajaActiva])

  const diferenciaFisica = teorico != null && total > 0 ? total - teorico.teorico : null

  const efectivoQuedaPlanilla = planillaActiva ? efectivoQuedaEnCajaDesdePlanilla(planillaActiva) : null

  const resumenPlotlab = useMemo(() => {
    if (!cajaSlug || !fecha) return null
    const desdeMovs = resumenPlotlabVentasCaja(
      movimientos,
      fecha,
      cajaSlug,
      cajaActiva?.id_usuario ?? usuarioId
    )
    if (!resumenPlotlabApi) return desdeMovs
    return combinarResumenPlotlab(resumenPlotlabApi, desdeMovs)
  }, [movimientos, fecha, cajaSlug, resumenPlotlabApi, cajaActiva?.id_usuario, usuarioId])

  const efectivoObjetivoPlotlab =
    cajaActiva && resumenPlotlab
      ? efectivoObjetivoArqueoPlotLab(movimientos, fecha, cajaActiva, resumenPlotlab)
      : null

  const alertaDoble = useMemo(
    () =>
      cajaSlug && fecha
        ? alertaDobleFuenteCaja(fecha, cajaSlug, planillas, movimientos)
        : { activa: false, plotlabIngresos: 0, planillaIngresos: 0, mensaje: '' },
    [fecha, cajaSlug, planillas, movimientos]
  )

  const objetivoEfectivo =
    efectivoQuedaPlanilla != null
      ? efectivoQuedaPlanilla
      : efectivoObjetivoPlotlab != null
        ? efectivoObjetivoPlotlab
        : null
  const fuenteObjetivo =
    efectivoQuedaPlanilla != null ? 'planilla' : efectivoObjetivoPlotlab != null ? 'plotlab' : null
  const deltaVsObjetivo =
    objetivoEfectivo != null && total > 0 ? total - objetivoEfectivo : null
  const esFaltante =
    deltaVsObjetivo != null && deltaVsObjetivo < -0.02
  const esSobrante =
    deltaVsObjetivo != null && deltaVsObjetivo > 0.02
  const montoFaltante = esFaltante && deltaVsObjetivo != null ? Math.abs(deltaVsObjetivo) : 0
  const montoSobrante = esSobrante && deltaVsObjetivo != null ? deltaVsObjetivo : 0
  const requiereJustificacion = esFaltante || esSobrante

  /** Egresos ejecutados del día (aprobados + ticket) para vincular al faltante. */
  const egresosDisponibles = useMemo(() => {
    if (!esFaltante || montoFaltante <= 0) return [] as CajaEgresoSolicitud[]
    return egresosDia.filter(
      (e) =>
        e.estado === 'aprobado' &&
        !!e.url_ticket &&
        (e.monto_efectivo || 0) > 0 &&
        e.caja_slug === cajaSlug &&
        e.fecha === fecha
    )
  }, [egresosDia, esFaltante, montoFaltante, cajaSlug, fecha])

  const egresosVinculados = useMemo(
    () => egresosDisponibles.filter((e) => egresosVinculadosIds.includes(e.id)),
    [egresosDisponibles, egresosVinculadosIds]
  )

  const sumaEgresosVinculados = useMemo(
    () => egresosVinculados.reduce((s, e) => s + (e.monto_efectivo || 0), 0),
    [egresosVinculados]
  )
  const egresosCubrenFaltante =
    esFaltante &&
    egresosVinculados.length > 0 &&
    Math.abs(sumaEgresosVinculados - montoFaltante) <= 1.5
  const diferenciaJustificada = esFaltante
    ? egresosCubrenFaltante
    : esSobrante
      ? !!ticketJustifUrl
      : true

  useEffect(() => {
    setEgresosVinculadosIds([])
  }, [cajaSlug, fecha])

  const toggleEgresoVinculado = (id: string) => {
    setEgresosVinculadosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const setCantidad = (denom: number, raw: string) => {
    const q = Math.max(0, Math.floor(parseNum(raw)))
    setBilletes((prev) => ({ ...prev, [`b${denom}`]: q }))
  }

  const handleTicketJustificacion = async (file: File | undefined) => {
    if (!file || !cajaSlug) return
    if (file.size > 8 * 1024 * 1024) {
      setMsgOk(false)
      setMsg('El comprobante no puede superar 8 MB.')
      return
    }
    setSubiendoTicket(true)
    setMsg(null)
    try {
      const url = await uploadAttachmentAndGetUrl(file, `caja/arqueos/${cajaSlug}/justificacion`)
      setTicketJustifUrl(url)
      setTicketJustifNombre(file.name)
    } catch (ex) {
      setMsgOk(false)
      setMsg(ex instanceof Error ? ex.message : 'No se pudo subir el comprobante.')
      setTicketJustifUrl('')
      setTicketJustifNombre('')
    } finally {
      setSubiendoTicket(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (arqueoBloqueado) {
      setMsgOk(false)
      setMsg('Ya hay un arqueo de este turno. Completá el cierre de turno antes de hacer otro.')
      return
    }
    if (!cajaSlug) {
      setMsgOk(false)
      setMsg(
        fijarCajaUsuario
          ? 'No se pudo identificar tu caja. Volvé a iniciar sesión o contactá a administración.'
          : 'Elegí una caja.'
      )
      return
    }
    if (!firmaDataUrl) {
      setFirmaError('Tenés que firmar en el recuadro antes de guardar.')
      return
    }
    if (requiereJustificacion && !diferenciaJustificada) {
      setMsgOk(false)
      setMsg(
        esFaltante
          ? egresosDisponibles.length === 0
            ? `Faltan $ ${fmtArs(montoFaltante)}. Registrá y ejecutá el egreso (con ticket) en Egresos, y volvé a vincularlo acá.`
            : `Faltan $ ${fmtArs(montoFaltante)}. Seleccioná egreso(s) cuya suma coincida con el faltante (ahora $ ${fmtArs(sumaEgresosVinculados)}).`
          : `Sobran $ ${fmtArs(montoSobrante)} vs lo esperado. Adjuntá un comprobante o nota que justifique el sobrante.`
      )
      return
    }
    setFirmaError(undefined)
    setSaving(true)
    setMsg(null)
    setMsgOk(false)
    try {
      const dif = teorico != null ? total - teorico.teorico : deltaVsObjetivo
      const urlJustif = esFaltante
        ? egresosVinculados[0]?.url_ticket ?? null
        : ticketJustifUrl || null
      await saveArqueo(
        {
          fecha,
          caja_slug: cajaSlug,
          turno,
          id_usuario: usuarioId ?? null,
          usuario_nombre: usuarioNombre,
          billetes,
          total,
          teorico_fisico: teorico?.teorico ?? objetivoEfectivo ?? null,
          diferencia: dif,
          estado_arqueo:
            dif != null
              ? estadoArqueo(dif)
              : esFaltante
                ? 'faltante'
                : esSobrante
                  ? 'sobrante'
                  : total > 0
                    ? 'correcto'
                    : null,
          saldos: {
            ...(teorico
              ? {
                  teorico_fisico: teorico.teorico,
                  contado: total,
                  fondo_fijo: teorico.fondo_fijo,
                  ingresos_fisicos: teorico.ingresos_fisicos,
                  egresos_fisicos: teorico.egresos_fisicos,
                  neto_fisico: teorico.neto_fisico
                }
              : { contado: total }),
            ...(objetivoEfectivo != null
              ? {
                  objetivo_efectivo: objetivoEfectivo,
                  fuente_objetivo: fuenteObjetivo,
                  faltante: esFaltante ? montoFaltante : 0,
                  sobrante: esSobrante ? montoSobrante : 0
                }
              : {}),
            ...(esFaltante && egresosCubrenFaltante
              ? {
                  justificacion_url: urlJustif,
                  justificacion_tipo: 'faltante' as const,
                  justificacion_egreso_ids: egresosVinculados.map((x) => x.id)
                }
              : esSobrante && urlJustif
                ? {
                    justificacion_url: urlJustif,
                    justificacion_tipo: 'sobrante' as const
                  }
                : {})
          },
          firma_data_url: firmaDataUrl
        },
        usuarioId != null ? { actor: { id: usuarioId, esAdmin: !fijarCajaUsuario } } : undefined
      )
      setMsgOk(true)
      setMsg(
        esFaltante
          ? `Arqueo guardado con faltante vinculado a egreso — total $ ${fmtArs(total)}`
          : esSobrante
            ? `Arqueo guardado con sobrante justificado — total $ ${fmtArs(total)}`
            : `Arqueo guardado — total $ ${fmtArs(total)}`
      )
      notifyArqueoCompletado(cajaAsignadaNombre || cajaActiva?.nombre || 'caja', total)
      setBilletes({})
      setFirmaDataUrl(null)
      setFirmaPadKey((k) => k + 1)
      setTicketJustifUrl('')
      setTicketJustifNombre('')
      setEgresosVinculadosIds([])
      onSaved?.()
    } catch (err) {
      setMsgOk(false)
      setMsg(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const cajaAsignadaNombre = cajaActiva?.nombre ?? ''
  const cajaResolviendo = fijarCajaUsuario && cajaOperativaLoading
  const mostrarSelectorCaja = !fijarCajaUsuario

  return (
    <form className="caja-cc-form" onSubmit={(e) => void handleSubmit(e)}>
      {arqueoBloqueado && ultimoArqueoBloqueo ? (
        <div className="caja-cc-card caja-cc-arqueo-bloqueado" role="status">
          <h3>Arqueo ya registrado</h3>
          <p className="caja-cc-help">
            El {fmtDateAr(ultimoArqueoBloqueo.fecha)} se guardó un arqueo de{' '}
            <strong>$ {fmtArs(ultimoArqueoBloqueo.total)}</strong>
            {ultimoArqueoBloqueo.turno ? ` (${ultimoArqueoBloqueo.turno})` : ''}. No se puede hacer otro hasta
            completar el <strong>cierre de turno</strong>.
          </p>
          {onIrCierreTurno ? (
            <button type="button" className="btn-primary" onClick={onIrCierreTurno}>
              Ir a cierre de turno →
            </button>
          ) : (
            <p className="caja-cc-field-hint">Andá al menú → Cierre de turno.</p>
          )}
        </div>
      ) : null}

      {resumenPlotlab && cajaActiva && !arqueoBloqueado && (
        <CajaPlotlabVentasPanel resumen={resumenPlotlab} cajaNombre={cajaActiva.nombre} />
      )}

      {arqueoBloqueado ? null : (
        <>
      {alertaDoble.activa && (
        <div className="caja-cc-alerta-doble-fuente" role="alert">
          {alertaDoble.mensaje}
        </div>
      )}

      {efectivoQuedaPlanilla != null && (
        <div className="caja-cc-planilla-arqueo-hint">
          <strong>Según planilla PDF — efectivo neto (fila Neto, columna Efectivo):</strong>{' '}
          <strong>$ {fmtArs(efectivoQuedaPlanilla)}</strong>. Contá billetes hasta ese monto; tarjetas, MP, cta. cte. y
          transferencias no van en el arqueo.
        </div>
      )}

      {efectivoQuedaPlanilla == null && efectivoObjetivoPlotlab != null && (
        <div className="caja-cc-planilla-arqueo-hint caja-cc-planilla-arqueo-hint--plotlab">
          <strong>Según ventas Plot Lab en efectivo (fondo + cobros del día):</strong>{' '}
          <strong>$ {fmtArs(efectivoObjetivoPlotlab)}</strong>. Contá billetes hasta ese monto; tarjetas, transferencias
          y cuenta corriente no van en el arqueo.
        </div>
      )}

      {cajaOperativaError && fijarCajaUsuario && (
        <p className="caja-cc-error" role="alert">
          {cajaOperativaError}
        </p>
      )}

      <div className="caja-cc-help">
        Contá solo billetes y monedas según las ventas en efectivo de Plot Lab del día (más el fondo de caja). No
        incluyas tarjetas, transferencias ni cuenta corriente.
        {cajaActiva && otraCajaOperativa && (
          <>
            {' '}
            El <strong>fondo de caja</strong> no es un monto fijo del arqueo: es lo que, al{' '}
            <strong>cierre de turno</strong>, se traspasa de {cajaActiva.nombre} a {otraCajaOperativa.nombre} (o
            viceversa)
            {fondoTraspaso > 0 ? ` · configurado $ ${fmtArs(fondoTraspaso)}` : ''}
            . Se carga a mano; no hay monto automático.
          </>
        )}
      </div>
      <div className="caja-cc-card">
        <h3>Identificación</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Caja
            {cajaResolviendo ? (
              <input type="text" readOnly value="Identificando…" />
            ) : mostrarSelectorCaja ? (
              <>
                <select
                  value={cajaSlug}
                  onChange={(e) => onCajaManual(e.target.value)}
                  required
                >
                  <option value="">Elegir tu caja…</option>
                  {cajas.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <span className="caja-cc-field-hint">
                  Tu caja se asigna automáticamente según tu usuario de mostrador.
                </span>
              </>
            ) : (
              <input type="text" readOnly value={cajaAsignadaNombre || '—'} />
            )}
          </label>
          <label className="caja-cc-field">
            Turno
            <select value={turno} onChange={(e) => setTurno(e.target.value)}>
              {TURNOS_CAJA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="caja-cc-card">
        <h3>Conteo de billetes</h3>
        {BILLETE_DENOMINACIONES.map((d) => {
          const q = billetes[`b${d}`] ?? 0
          const sub = q * d
          return (
            <div key={d} className="caja-cc-bill-row">
              <span className="caja-cc-bill-label">$ {fmtArs0(d)}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={billetes[`b${d}`] ?? ''}
                onChange={(e) => setCantidad(d, e.target.value)}
                placeholder="0"
              />
              <span className={`caja-cc-bill-sub ${q ? 'has' : ''}`}>
                {q ? `$ ${fmtArs(sub)}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      {efectivoQuedaPlanilla != null && (
        <div className="caja-cc-result neutral">
          <span>Efectivo que queda (planilla PDF)</span>
          <strong>$ {fmtArs(efectivoQuedaPlanilla)}</strong>
        </div>
      )}
      {teorico != null && efectivoQuedaPlanilla == null && efectivoObjetivoPlotlab == null && (
        <div className="caja-cc-result neutral">
          <span>Efectivo teórico según movimientos del día</span>
          <strong>$ {fmtArs(teorico.teorico)}</strong>
        </div>
      )}
      {efectivoObjetivoPlotlab != null && efectivoQuedaPlanilla == null && (
        <div className="caja-cc-result neutral">
          <span>Objetivo según Plot Lab (fondo + efectivo cobrado)</span>
          <strong>$ {fmtArs(efectivoObjetivoPlotlab)}</strong>
        </div>
      )}
      <div
        className={`caja-cc-result ${
          requiereJustificacion
            ? diferenciaJustificada
              ? 'ok'
              : 'bad'
            : diferenciaFisica != null && Math.abs(diferenciaFisica) > 0.02
              ? 'bad'
              : total > 0
                ? 'ok'
                : 'neutral'
        }`}
      >
        <span>Total contado (solo billetes)</span>
        <strong>$ {fmtArs(total)}</strong>
        {deltaVsObjetivo != null && total > 0 && (
          <span className="caja-cc-field-hint">
            {Math.abs(deltaVsObjetivo) <= 0.02
              ? fuenteObjetivo === 'planilla'
                ? 'Cuadra con planilla PDF'
                : 'Cuadra con Plot Lab'
              : esFaltante
                ? `Faltante $ ${fmtArs(montoFaltante)} — vinculá a egreso`
                : `Sobrante $ ${fmtArs(montoSobrante)} — justificá con comprobante`}
          </span>
        )}
        {deltaVsObjetivo == null && diferenciaFisica != null && total > 0 && (
          <span className="caja-cc-field-hint">
            {diferenciaFisica === 0
              ? 'Cuadra con teórico'
              : `Δ teórico $ ${fmtArs(diferenciaFisica)}`}
          </span>
        )}
      </div>

      {requiereJustificacion ? (
        <div
          className={`caja-cc-card caja-cc-arqueo-justif-faltante${esSobrante ? ' caja-cc-arqueo-justif-sobrante' : ''}`}
        >
          <h3>{esFaltante ? 'Justificar faltante' : 'Justificar sobrante'}</h3>
          <p className="caja-cc-help">
            Contaste $ {fmtArs(total)} y el esperado es $ {fmtArs(objetivoEfectivo ?? 0)}.{' '}
            {esFaltante ? (
              <>
                Faltan <strong>$ {fmtArs(montoFaltante)}</strong>. Vinculá el/los egreso(s) del día que lo
                explican (la suma debe coincidir con el faltante).
              </>
            ) : (
              <>
                Sobran <strong>$ {fmtArs(montoSobrante)}</strong>. Adjuntá un comprobante o nota que justifique el
                sobrante para poder guardar.
              </>
            )}
          </p>
          {esFaltante ? (
            egresosDisponibles.length === 0 ? (
              <div className="caja-cc-arqueo-egresos-vincular">
                <p className="caja-cc-help">
                  No hay egresos con ticket en esta caja hoy. Pedí/ejecutá el egreso en Egresos y volvé.
                </p>
                {onIrEgresos ? (
                  <button type="button" className="btn-secondary" onClick={onIrEgresos}>
                    Ir a Egresos
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="caja-cc-arqueo-egresos-vincular">
                {egresosDisponibles.map((e) => (
                  <label key={e.id} className="caja-cc-egreso-vincular-row">
                    <input
                      type="checkbox"
                      checked={egresosVinculadosIds.includes(e.id)}
                      disabled={saving}
                      onChange={() => toggleEgresoVinculado(e.id)}
                    />
                    <span>
                      <strong>$ {fmtArs(e.monto_efectivo || 0)}</strong>
                      {' — '}
                      {e.concepto || 'Egreso'}
                      {e.url_ticket ? (
                        <>
                          {' · '}
                          <a href={e.url_ticket} target="_blank" rel="noopener noreferrer">
                            Ver ticket
                          </a>
                        </>
                      ) : null}
                    </span>
                  </label>
                ))}
                <p className={egresosCubrenFaltante ? 'caja-cc-ok' : 'caja-cc-help'}>
                  {egresosCubrenFaltante
                    ? `✓ Egresos vinculados cubren el faltante ($ ${fmtArs(sumaEgresosVinculados)})`
                    : `Seleccionados: $ ${fmtArs(sumaEgresosVinculados)} · faltante $ ${fmtArs(montoFaltante)}`}
                </p>
              </div>
            )
          ) : (
            <label className="caja-cc-field">
              Comprobante / justificación *
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                disabled={subiendoTicket || saving}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  void handleTicketJustificacion(f)
                  e.target.value = ''
                }}
              />
              <span className="caja-cc-field-hint">PDF o imagen. Máximo 8 MB.</span>
              {subiendoTicket && <span className="caja-cc-field-hint">Subiendo…</span>}
              {ticketJustifUrl ? (
                <span className="caja-cc-field-hint">
                  ✓ {ticketJustifNombre || 'Archivo cargado'}{' '}
                  <a href={ticketJustifUrl} target="_blank" rel="noopener noreferrer">
                    Ver
                  </a>
                  {' · '}
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setTicketJustifUrl('')
                      setTicketJustifNombre('')
                    }}
                  >
                    Quitar
                  </button>
                </span>
              ) : null}
            </label>
          )}
        </div>
      ) : null}

      <div className="caja-cc-card caja-cc-signature-block">
        <SignaturePad
          key={firmaPadKey}
          label={`Firma — ${usuarioNombre}`}
          value={firmaDataUrl}
          onChange={(url) => {
            setFirmaDataUrl(url)
            if (url) setFirmaError(undefined)
          }}
          error={firmaError}
        />
      </div>
      {msg &&
        (msgOk ? (
          <CajaMensajeOkPlotLab>
            <p className="caja-cc-ok">{msg}</p>
          </CajaMensajeOkPlotLab>
        ) : (
          <p className="caja-cc-error">{msg}</p>
        ))}
      <div className="caja-cc-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={
            saving ||
            cajaResolviendo ||
            subiendoTicket ||
            arqueoBloqueado ||
            (requiereJustificacion && !diferenciaJustificada)
          }
        >
          {saving ? 'Guardando…' : 'Guardar y firmar'}
        </button>
      </div>
        </>
      )}
    </form>
  )
}
