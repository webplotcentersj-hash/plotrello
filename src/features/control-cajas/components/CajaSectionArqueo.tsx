import { useEffect, useMemo, useState } from 'react'
import SignaturePad from '../../../components/SignaturePad'
import { useCajaOperativa } from '../../../hooks/useCajaOperativa'
import { BILLETE_DENOMINACIONES, TURNOS_CAJA } from '../constants'
import { listCajas, listMovimientos, listPlanillas, saveArqueo } from '../cajaRepository'
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
import { fmtArs, fmtArs0, parseNum } from '../format'
import { fondoFijoEfectivo } from '../fondoCaja'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { efectivoQuedaEnCajaDesdePlanilla } from '../cajaTotales'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaRegistro } from '../types'
import { notifyArqueoCompletado } from '../cajaSyncNotify'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloCajasOperativas?: boolean
  /** Vista cajera: caja asociada al usuario; selector solo si no se puede resolver. */
  fijarCajaUsuario?: boolean
  onSaved?: () => void
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
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [resumenPlotlabApi, setResumenPlotlabApi] = useState<ResumenPlotlabVentasCaja | null>(null)

  useEffect(() => {
    if (!cajaSlug || !fecha) return
    void Promise.all([listMovimientos(), listPlanillas(120)]).then(([m, p]) => {
      setMovimientos(m)
      setPlanillas(p)
    })
  }, [cajaSlug, fecha, movimientosRefreshKey])

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
  const diferenciaPlanilla =
    efectivoQuedaPlanilla != null && total > 0 ? total - efectivoQuedaPlanilla : null

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

  const diferenciaPlotlab =
    efectivoObjetivoPlotlab != null && total > 0 ? total - efectivoObjetivoPlotlab : null
  const alertaDoble = useMemo(
    () =>
      cajaSlug && fecha
        ? alertaDobleFuenteCaja(fecha, cajaSlug, planillas, movimientos)
        : { activa: false, plotlabIngresos: 0, planillaIngresos: 0, mensaje: '' },
    [fecha, cajaSlug, planillas, movimientos]
  )

  const setCantidad = (denom: number, raw: string) => {
    const q = Math.max(0, Math.floor(parseNum(raw)))
    setBilletes((prev) => ({ ...prev, [`b${denom}`]: q }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) {
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
    if (efectivoQuedaPlanilla != null && total > 0 && Math.abs(total - efectivoQuedaPlanilla) > 0.02) {
      setMsg(
        `El conteo ($ ${fmtArs(total)}) no coincide con el efectivo de la planilla ($ ${fmtArs(efectivoQuedaPlanilla)}). Revisá billetes.`
      )
      return
    }
    if (
      efectivoQuedaPlanilla == null &&
      efectivoObjetivoPlotlab != null &&
      total > 0 &&
      Math.abs(total - efectivoObjetivoPlotlab) > 0.02
    ) {
      setMsg(
        `El conteo ($ ${fmtArs(total)}) no coincide con el efectivo vendido en Plot Lab ($ ${fmtArs(efectivoObjetivoPlotlab)}). Revisá billetes.`
      )
      return
    }
    setFirmaError(undefined)
    setSaving(true)
    setMsg(null)
    try {
      const dif = teorico != null ? total - teorico.teorico : null
      await saveArqueo(
        {
          fecha,
          caja_slug: cajaSlug,
          turno,
          id_usuario: usuarioId ?? null,
          usuario_nombre: usuarioNombre,
          billetes,
          total,
          teorico_fisico: teorico?.teorico ?? null,
          diferencia: dif,
          estado_arqueo: dif != null ? estadoArqueo(dif) : null,
          saldos: teorico
            ? {
                teorico_fisico: teorico.teorico,
                contado: total,
                fondo_fijo: teorico.fondo_fijo,
                ingresos_fisicos: teorico.ingresos_fisicos,
                egresos_fisicos: teorico.egresos_fisicos,
                neto_fisico: teorico.neto_fisico
              }
            : null,
          firma_data_url: firmaDataUrl
        },
        usuarioId != null ? { actor: { id: usuarioId, esAdmin: !fijarCajaUsuario } } : undefined
      )
      setMsg(`Arqueo guardado — total $ ${fmtArs(total)}`)
      notifyArqueoCompletado(cajaAsignadaNombre || cajaActiva?.nombre || 'caja', total)
      setBilletes({})
      setFirmaDataUrl(null)
      setFirmaPadKey((k) => k + 1)
      onSaved?.()
    } catch (err) {
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
      {resumenPlotlab && cajaActiva && (
        <CajaPlotlabVentasPanel resumen={resumenPlotlab} cajaNombre={cajaActiva.nombre} />
      )}

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
          diferenciaPlanilla != null && Math.abs(diferenciaPlanilla) > 0.02
            ? 'bad'
            : diferenciaPlotlab != null && Math.abs(diferenciaPlotlab) > 0.02
              ? 'bad'
              : diferenciaFisica != null && Math.abs(diferenciaFisica) > 0.02
                ? 'bad'
                : total > 0
                  ? 'ok'
                  : 'neutral'
        }`}
      >
        <span>Total contado (solo billetes)</span>
        <strong>$ {fmtArs(total)}</strong>
        {diferenciaPlanilla != null && total > 0 && (
          <span className="caja-cc-field-hint">
            {Math.abs(diferenciaPlanilla) <= 0.02
              ? 'Cuadra con planilla PDF'
              : `Δ vs planilla $ ${fmtArs(diferenciaPlanilla)}`}
          </span>
        )}
        {diferenciaPlanilla == null && diferenciaPlotlab != null && total > 0 && (
          <span className="caja-cc-field-hint">
            {Math.abs(diferenciaPlotlab) <= 0.02
              ? 'Cuadra con Plot Lab'
              : `Δ vs Plot Lab $ ${fmtArs(diferenciaPlotlab)}`}
          </span>
        )}
        {diferenciaPlanilla == null && diferenciaPlotlab == null && diferenciaFisica != null && total > 0 && (
          <span className="caja-cc-field-hint">
            {diferenciaFisica === 0
              ? 'Cuadra con teórico'
              : `Δ teórico $ ${fmtArs(diferenciaFisica)}`}
          </span>
        )}
      </div>
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
        (msg.startsWith('Arqueo') ? (
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
          disabled={saving || cajaResolviendo}
        >
          {saving ? 'Guardando…' : 'Guardar y firmar'}
        </button>
      </div>
    </form>
  )
}
