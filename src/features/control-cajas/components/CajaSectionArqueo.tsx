import { useEffect, useMemo, useState } from 'react'
import SignaturePad from '../../../components/SignaturePad'
import { useCajaOperativa } from '../../../hooks/useCajaOperativa'
import { BILLETE_DENOMINACIONES, TURNOS_CAJA } from '../constants'
import { listCajas, listMovimientos, listPlanillas, saveArqueo } from '../cajaRepository'
import { alertaDobleFuenteCaja, resumenPlotlabVentasCaja } from '../plotlabVentasCajaData'
import CajaPlotlabVentasPanel from './CajaPlotlabVentasPanel'
import { calcularTeoricoFisicoCaja } from '../arqueoCalculations'
import { estadoArqueo } from '../movimientoCaja'
import { fmtArs, fmtArs0, parseNum } from '../format'
import { FONDO_CAJA_RECOMENDADO, fondoFijoEfectivo } from '../fondoCaja'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { efectivoQuedaEnCajaDesdePlanilla } from '../cajaTotales'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaRegistro } from '../types'
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

  useEffect(() => {
    if (!cajaSlug || !fecha) return
    void Promise.all([listMovimientos(), listPlanillas(120)]).then(([m, p]) => {
      setMovimientos(m)
      setPlanillas(p)
    })
  }, [cajaSlug, fecha, movimientosRefreshKey])

  useEffect(() => {
    const onRefresh = () => {
      void listMovimientos().then(setMovimientos)
    }
    window.addEventListener('caja-datos-actualizados', onRefresh)
    return () => window.removeEventListener('caja-datos-actualizados', onRefresh)
  }, [])

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

  const resumenPlotlab = useMemo(
    () => (cajaSlug && fecha ? resumenPlotlabVentasCaja(movimientos, fecha, cajaSlug) : null),
    [movimientos, fecha, cajaSlug]
  )
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
    setFirmaError(undefined)
    setSaving(true)
    setMsg(null)
    try {
      const dif = teorico != null ? total - teorico.teorico : null
      await saveArqueo({
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
      })
      setMsg(`Arqueo guardado — total $ ${fmtArs(total)}`)
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

      {cajaOperativaError && fijarCajaUsuario && (
        <p className="caja-cc-error" role="alert">
          {cajaOperativaError}
        </p>
      )}

      <div className="caja-cc-help">
        Subí arriba el PDF del día: ahí está el <strong>efectivo que queda</strong> en caja. Contá solo billetes y
        monedas hasta ese monto; no incluyas tarjetas, transferencias ni cuenta corriente (eso se concilia aparte).
        {cajaActiva && otraCajaOperativa && (
          <>
            {' '}
            El <strong>fondo de caja</strong> no es un monto fijo del arqueo: es lo que, al{' '}
            <strong>cierre de turno</strong>, se traspasa de {cajaActiva.nombre} a {otraCajaOperativa.nombre} (o
            viceversa). Recomendado $ {fmtArs(FONDO_CAJA_RECOMENDADO)}
            {fondoTraspaso > 0 && fondoTraspaso !== FONDO_CAJA_RECOMENDADO
              ? ` · configurado $ ${fmtArs(fondoTraspaso)}`
              : ''}
            , editable en el cierre de turno.
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
      {teorico != null && efectivoQuedaPlanilla == null && (
        <div className="caja-cc-result neutral">
          <span>Efectivo teórico según movimientos del día</span>
          <strong>$ {fmtArs(teorico.teorico)}</strong>
        </div>
      )}
      <div
        className={`caja-cc-result ${
          diferenciaPlanilla != null && Math.abs(diferenciaPlanilla) > 0.02
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
        {diferenciaPlanilla == null && diferenciaFisica != null && total > 0 && (
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
