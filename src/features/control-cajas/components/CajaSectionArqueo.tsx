import { useEffect, useMemo, useState } from 'react'
import SignaturePad from '../../../components/SignaturePad'
import { BILLETE_DENOMINACIONES, TURNOS_CAJA } from '../constants'
import {
  getParams,
  listCajas,
  listMovimientos,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveArqueo
} from '../cajaRepository'
import { calcularTeoricoFisicoCaja } from '../arqueoCalculations'
import { estadoArqueo } from '../movimientoCaja'
import { DEFAULT_CAJERAS } from '../constants'
import { setStoredCajaSlug } from '../cajaUsuarioDisplay'
import { fmtArs, fmtArs0, parseNum } from '../format'
import { fondoFijoEfectivo, fondoMinimoCaja, requiereFondoMinimo, validarEfectivoFisicoVsFondo } from '../fondoCaja'
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
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [cajaAutoAsignada, setCajaAutoAsignada] = useState(false)
  const [cajaResolviendo, setCajaResolviendo] = useState(fijarCajaUsuario)
  const [turno, setTurno] = useState<string>('Único')
  const [billetes, setBilletes] = useState<Record<string, number>>({})
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [firmaPadKey, setFirmaPadKey] = useState(0)
  const [firmaError, setFirmaError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])

  useEffect(() => {
    if (!cajaSlug || !fecha) return
    void listMovimientos().then(setMovimientos)
  }, [cajaSlug, fecha, movimientosRefreshKey])

  useEffect(() => {
    if (!planillaActiva) return
    const f = planillaActiva.fecha_hasta || planillaActiva.fecha_desde
    if (f) setFecha(f)
  }, [planillaActiva?.archivo_nombre, planillaActiva?.fecha_desde, planillaActiva?.fecha_hasta])

  useEffect(() => {
    let cancelled = false
    setCajaResolviendo(fijarCajaUsuario)

    void Promise.all([listCajas(), fijarCajaUsuario ? getParams() : Promise.resolve(null)]).then(
      async ([list, params]) => {
        const filtered = soloCajasOperativas
          ? list.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
          : list
        if (cancelled) return
        setCajas(filtered)

        if (!fijarCajaUsuario) {
          if (filtered.length) setCajaSlug((prev) => prev || filtered[0].slug)
          setCajaAutoAsignada(false)
          setCajaResolviendo(false)
          return
        }

        const cajeras = params?.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS
        let slug =
          resolveCajaSlugForUsuario(usuarioNombre, filtered, cajeras, { usuarioId }) ?? ''

        if (!slug && usuarioId) {
          slug = (await resolveCajaSlugFromHistorial(usuarioId, filtered)) ?? ''
        }

        if (cancelled) return
        setCajaSlug(slug)
        setCajaAutoAsignada(!!slug)
        setCajaResolviendo(false)
      }
    )

    return () => {
      cancelled = true
    }
  }, [soloCajasOperativas, fijarCajaUsuario, usuarioNombre, usuarioId])

  const onCajaManual = (slug: string) => {
    setCajaSlug(slug)
    if (usuarioId && slug) setStoredCajaSlug(usuarioId, slug)
  }

  const total = useMemo(() => {
    return BILLETE_DENOMINACIONES.reduce((sum, d) => {
      const q = billetes[`b${d}`] ?? 0
      return sum + q * d
    }, 0)
  }, [billetes])

  const cajaActiva = cajas.find((c) => c.slug === cajaSlug)
  const fondoMin = cajaActiva ? fondoMinimoCaja(cajaActiva) : 0

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

  const setCantidad = (denom: number, raw: string) => {
    const q = Math.max(0, Math.floor(parseNum(raw)))
    setBilletes((prev) => ({ ...prev, [`b${denom}`]: q }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) {
      setMsg(
        fijarCajaUsuario
          ? 'Elegí tu caja en el listado. Si no aparece, pedí a administración que te agregue en Maestros → Cajeras.'
          : 'Elegí una caja.'
      )
      return
    }
    if (!firmaDataUrl) {
      setFirmaError('Tenés que firmar en el recuadro antes de guardar.')
      return
    }
    const caja = cajas.find((c) => c.slug === cajaSlug)
    if (caja) {
      const v = validarEfectivoFisicoVsFondo(total, caja)
      if (!v.ok) {
        setMsg(v.mensaje)
        return
      }
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
      if (usuarioId) setStoredCajaSlug(usuarioId, cajaSlug)
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

  const bajoFondo = fondoMin > 0 && total > 0 && total < fondoMin

  const cajaAsignadaNombre = cajaActiva?.nombre ?? ''
  const mostrarSelectorCaja =
    fijarCajaUsuario && !cajaResolviendo && (!cajaAutoAsignada || !cajaSlug)

  return (
    <form className="caja-cc-form" onSubmit={(e) => void handleSubmit(e)}>
      {efectivoQuedaPlanilla != null && (
        <div className="caja-cc-planilla-arqueo-hint">
          <strong>Según planilla PDF — efectivo que queda en caja:</strong>{' '}
          <strong>$ {fmtArs(efectivoQuedaPlanilla)}</strong>. Contá billetes hasta llegar a ese monto; tarjetas, MP y
          transferencias no van en el arqueo.
        </div>
      )}

      <div className="caja-cc-help">
        Subí arriba el PDF del día: ahí está el efectivo que queda. Contá solo billetes y monedas; no incluyas
        tarjetas, transferencias ni cuenta corriente (eso se concilia aparte).
        {cajaActiva && requiereFondoMinimo(cajaActiva.slug) && (
          <>
            {' '}
            El <strong>fondo de caja</strong> es el dinero que debe permanecer siempre en la caja; el configurado es{' '}
            <strong>$ {fmtArs(fondoMin)}</strong> (no puede haber menos en el arqueo).
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
                  Tu usuario no está en Maestros; elegí la caja una vez y quedará guardada.
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
          <span>Efectivo teórico (fondo + mov. del día)</span>
          <strong>$ {fmtArs(teorico.teorico)}</strong>
        </div>
      )}
      <div
        className={`caja-cc-result ${
          bajoFondo
            ? 'bad'
            : diferenciaPlanilla != null && Math.abs(diferenciaPlanilla) > 0.02
              ? 'bad'
              : diferenciaFisica != null && Math.abs(diferenciaFisica) > 0.02
                ? 'bad'
                : total > 0
                  ? 'ok'
                  : 'neutral'
        }`}
      >
        <span>
          Total contado (solo billetes)
          {fondoMin > 0 && ` · fondo configurado $ ${fmtArs(fondoMin)}`}
        </span>
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
      {bajoFondo && cajaActiva && (
        <p className="caja-cc-error">
          El conteo está por debajo del fondo de caja. Revisá billetes o informá a administración antes de
          guardar.
        </p>
      )}
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
