import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getParams,
  getUltimoArqueoCaja,
  listCajas,
  listMovimientos,
  listPlanillas,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveMovimiento
} from '../cajaRepository'
import {
  buscarPlanillaCaja,
  montosCajaDesdeFuentes,
  sugerirMontoPase
} from '../paseCajaMontos'
import { setStoredCajaSlug } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS } from '../constants'
import { fmtArs, parseNum } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { calcularPaseTrazabilidad, validarPaseCaja } from '../paseCaja'
import CajaMovimientosList from './CajaMovimientosList'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'
import type { CajaMovimiento, CajaRegistro } from '../types'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloMisPases?: boolean
}

export default function CajaSectionPaseCaja({
  usuarioNombre,
  usuarioId,
  soloMisPases = false
}: Props) {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [pases, setPases] = useState<CajaMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cajaResolviendo, setCajaResolviendo] = useState(soloMisPases)
  const [cajaAutoAsignada, setCajaAutoAsignada] = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)

  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [hora, setHora] = useState(() => new Date().toTimeString().slice(0, 5))
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [origenEfAntes, setOrigenEfAntes] = useState('')
  const [origenOtAntes, setOrigenOtAntes] = useState('')
  const [destinoEfAntes, setDestinoEfAntes] = useState('')
  const [destinoOtAntes, setDestinoOtAntes] = useState('')
  const [paseEf, setPaseEf] = useState('')
  const [paseOt, setPaseOt] = useState('')
  const [nro, setNro] = useState('')
  const [observacion, setObservacion] = useState('')
  const [hintOrigen, setHintOrigen] = useState<string | null>(null)
  const [hintDestino, setHintDestino] = useState<string | null>(null)
  const [hintOrigenOt, setHintOrigenOt] = useState<string | null>(null)
  const [hintDestinoOt, setHintDestinoOt] = useState<string | null>(null)
  const [hintPase, setHintPase] = useState<string | null>(null)
  const [arqueoCargando, setArqueoCargando] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const [c, m] = await Promise.all([
      listCajas(),
      listMovimientos(
        soloMisPases ? { usuario: usuarioNombre, usuarioId: usuarioId ?? undefined } : undefined
      )
    ])
    setCajas(c.filter((x) => x.slug !== 'vuelto'))
    setPases(m.filter((x) => x.concepto === 'Pase de caja'))
    setLoading(false)
  }, [soloMisPases, usuarioNombre, usuarioId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!soloMisPases) {
      setCajaResolviendo(false)
      return
    }
    let cancelled = false
    setCajaResolviendo(true)

    void Promise.all([listCajas(), getParams()]).then(async ([list, params]) => {
      const operativas = list.filter((x) => x.slug !== 'vuelto' && x.slug !== 'admin')
      if (cancelled) return

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
        setDestino((prev) => {
          if (prev && prev !== slug) return prev
          const admin = list.find((x) => x.slug === 'admin')?.slug
          if (admin) return admin
          return operativas.find((c) => c.slug !== slug)?.slug ?? ''
        })
      } else {
        setCajaAutoAsignada(false)
        if (operativas.length) {
          const first = operativas[0].slug
          setOrigen((prev) => prev || first)
          setDestino((prev) => prev || (list.find((x) => x.slug === 'admin')?.slug ?? operativas[1]?.slug ?? ''))
        }
      }
      setCajaResolviendo(false)
    })

    return () => {
      cancelled = true
    }
  }, [soloMisPases, usuarioNombre, usuarioId])

  useEffect(() => {
    if (soloMisPases) return
    if (cajas.length && !origen) {
      setOrigen(cajas.find((x) => x.slug !== 'admin')?.slug ?? cajas[0].slug)
    }
    if (cajas.length && !destino) {
      setDestino(cajas.find((x) => x.slug === 'admin')?.slug ?? cajas[1]?.slug ?? cajas[0].slug)
    }
  }, [soloMisPases, cajas, origen, destino])

  useEffect(() => {
    if (!origen && !destino) {
      setHintOrigen(null)
      setHintDestino(null)
      setHintOrigenOt(null)
      setHintDestinoOt(null)
      setHintPase(null)
      return
    }

    let cancelled = false
    setArqueoCargando(true)

    void (async () => {
      try {
        const planillas = await listPlanillas(120)
        if (cancelled) return

        const [arqOrigen, arqDestino] = await Promise.all([
          origen ? getUltimoArqueoCaja(origen, fecha) : Promise.resolve(null),
          destino ? getUltimoArqueoCaja(destino, fecha) : Promise.resolve(null)
        ])
        if (cancelled) return

        const cajaOrigen = cajas.find((c) => c.slug === origen)
        const cajaDestino = cajas.find((c) => c.slug === destino)
        const planOrigen = origen
          ? buscarPlanillaCaja(planillas, origen, fecha, cajaOrigen?.nombre)
          : null
        const planDestino = destino
          ? buscarPlanillaCaja(planillas, destino, fecha, cajaDestino?.nombre)
          : null

        let origenEf = 0
        let origenOt = 0

        if (origen) {
          const m = montosCajaDesdeFuentes(cajaOrigen, arqOrigen, planOrigen, fecha)
          origenEf = m.efectivo
          origenOt = m.otros
          setOrigenEfAntes(String(m.efectivo))
          setOrigenOtAntes(String(m.otros))
          setHintOrigen(m.hintEfectivo)
          setHintOrigenOt(m.hintOtros)
        } else {
          setHintOrigen(null)
          setHintOrigenOt(null)
        }

        if (destino) {
          const m = montosCajaDesdeFuentes(cajaDestino, arqDestino, planDestino, fecha)
          setDestinoEfAntes(String(m.efectivo))
          setDestinoOtAntes(String(m.otros))
          setHintDestino(m.hintEfectivo)
          setHintDestinoOt(m.hintOtros)
        } else {
          setHintDestino(null)
          setHintDestinoOt(null)
        }

        if (origen && destino) {
          const sug = sugerirMontoPase({
            origen: cajaOrigen,
            destino: cajaDestino,
            origenEf,
            origenOt
          })
          setPaseEf(sug.efectivo > 0 ? String(sug.efectivo) : '')
          setPaseOt(sug.otros > 0 ? String(sug.otros) : '')
          setHintPase(sug.hint || null)
        } else {
          setPaseEf('')
          setPaseOt('')
          setHintPase(null)
        }
      } finally {
        if (!cancelled) setArqueoCargando(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [origen, destino, fecha, cajas])

  useEffect(() => {
    if (origen && destino === origen) {
      const otro =
        cajas.find((c) => c.slug === 'admin')?.slug ??
        cajas.find((c) => c.slug !== origen && c.slug !== 'vuelto')?.slug ??
        ''
      if (otro) setDestino(otro)
    }
  }, [origen, destino, cajas])

  const calc = useMemo(
    () =>
      calcularPaseTrazabilidad({
        origen_efectivo_antes: parseNum(origenEfAntes),
        origen_otros_antes: parseNum(origenOtAntes),
        destino_efectivo_antes: parseNum(destinoEfAntes),
        destino_otros_antes: parseNum(destinoOtAntes),
        pase_efectivo: parseNum(paseEf),
        pase_otros: parseNum(paseOt)
      }),
    [origenEfAntes, origenOtAntes, destinoEfAntes, destinoOtAntes, paseEf, paseOt]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!origen) {
      setMsg('Elegí la caja de origen.')
      return
    }
    if (origen === destino) {
      setMsg('Elegí cajas de origen y destino distintas.')
      return
    }
    const err = validarPaseCaja(calc)
    if (err) {
      setMsg(err)
      return
    }
    setSaving(true)
    try {
      await saveMovimiento({
        fecha,
        hora,
        concepto: 'Pase de caja',
        origen_slug: origen,
        destino_slug: destino,
        efectivo: calc.pase_efectivo,
        otros: calc.pase_otros,
        nro_comprobante: nro || null,
        observacion: observacion || null,
        id_usuario: usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        origen_importacion: 'manual',
        origen_efectivo_antes: calc.origen_efectivo_antes,
        origen_otros_antes: calc.origen_otros_antes,
        destino_efectivo_antes: calc.destino_efectivo_antes,
        destino_otros_antes: calc.destino_otros_antes,
        origen_efectivo_despues: calc.origen_efectivo_despues,
        origen_otros_despues: calc.origen_otros_despues,
        destino_efectivo_despues: calc.destino_efectivo_despues,
        destino_otros_despues: calc.destino_otros_despues
      })
      setPaseEf('')
      setPaseOt('')
      setNro('')
      setObservacion('')
      setMsg('Pase registrado con trazabilidad completa.')
      await reload()
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : 'No se pudo guardar el pase.')
    } finally {
      setSaving(false)
    }
  }

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  const onOrigenManual = (slug: string) => {
    setOrigen(slug)
    if (usuarioId && slug) setStoredCajaSlug(usuarioId, slug)
  }

  return (
    <div className="caja-cc-pase-section">
      <p className="caja-cc-intro caja-cc-sub">
        Los montos se completan desde el <strong>arqueo</strong> y la <strong>planilla</strong> de cada caja. El monto
        del pase se sugiere según el fondo y el destino (administración u otra caja). Podés ajustar antes de guardar.
      </p>

      <form className="caja-cc-card caja-cc-pase-form" onSubmit={(e) => void handleSubmit(e)}>
        <h3>Nuevo pase</h3>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Hora
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
        <p className="caja-cc-help">
          Registrado por <strong>{usuarioNombre}</strong>
        </p>

        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Caja origen (sale el dinero)
            {cajaResolviendo ? (
              <input type="text" readOnly value="Identificando tu caja…" />
            ) : cajaAutoAsignada ? (
              <>
                <input type="text" readOnly value={cajaNombre(origen)} />
                <span className="caja-cc-field-hint">Asignada a tu usuario.</span>
              </>
            ) : (
              <select value={origen} onChange={(e) => onOrigenManual(e.target.value)} required>
                <option value="">Elegir…</option>
                {cajas.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
            {arqueoCargando && origen ? (
              <span className="caja-cc-field-hint">Cargando montos del arqueo…</span>
            ) : (
              hintOrigen && <span className="caja-cc-field-hint">{hintOrigen}</span>
            )}
          </label>
          <label className="caja-cc-field">
            Caja destino (recibe el dinero)
            <select value={destino} onChange={(e) => setDestino(e.target.value)} required disabled={!origen}>
              {cajas.filter((c) => c.slug !== origen).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {arqueoCargando && destino ? (
              <span className="caja-cc-field-hint">Cargando montos del arqueo…</span>
            ) : (
              hintDestino && <span className="caja-cc-field-hint">{hintDestino}</span>
            )}
          </label>
        </div>

        {origen && (
          <div className="caja-cc-pase-block">
            <h4>En {cajaNombre(origen)} — antes del pase</h4>
            <div className="caja-cc-grid-2">
              <label className="caja-cc-field">
                Efectivo en caja
                <input
                  type="number"
                  step="0.01"
                  required
                  value={origenEfAntes}
                  onChange={(e) => setOrigenEfAntes(e.target.value)}
                  placeholder="Monto real contado"
                />
              </label>
              <label className="caja-cc-field">
                Tarjetas / otros
                <input
                  type="number"
                  step="0.01"
                  value={origenOtAntes}
                  onChange={(e) => setOrigenOtAntes(e.target.value)}
                />
                {hintOrigenOt && <span className="caja-cc-field-hint">{hintOrigenOt}</span>}
              </label>
            </div>
          </div>
        )}

        {destino && (
          <div className="caja-cc-pase-block">
            <h4>En {cajaNombre(destino)} — antes del pase</h4>
            <div className="caja-cc-grid-2">
              <label className="caja-cc-field">
                Efectivo en caja
                <input
                  type="number"
                  step="0.01"
                  value={destinoEfAntes}
                  onChange={(e) => setDestinoEfAntes(e.target.value)}
                />
              </label>
              <label className="caja-cc-field">
                Tarjetas / otros
                <input
                  type="number"
                  step="0.01"
                  value={destinoOtAntes}
                  onChange={(e) => setDestinoOtAntes(e.target.value)}
                />
                {hintDestinoOt && <span className="caja-cc-field-hint">{hintDestinoOt}</span>}
              </label>
            </div>
          </div>
        )}

        <div className="caja-cc-pase-block highlight">
          <h4>Monto del pase</h4>
          {arqueoCargando ? (
            <p className="caja-cc-field-hint">Calculando monto sugerido…</p>
          ) : (
            hintPase && <p className="caja-cc-field-hint">{hintPase}</p>
          )}
          <div className="caja-cc-grid-2">
            <label className="caja-cc-field">
              Efectivo que pasa
              <input
                type="number"
                step="0.01"
                required
                value={paseEf}
                onChange={(e) => setPaseEf(e.target.value)}
              />
            </label>
            <label className="caja-cc-field">
              Tarjetas / otros que pasan
              <input type="number" step="0.01" value={paseOt} onChange={(e) => setPaseOt(e.target.value)} />
            </label>
          </div>
          <label className="caja-cc-field">
            Nº comprobante
            <input value={nro} onChange={(e) => setNro(e.target.value)} placeholder="MEC-0000…" />
          </label>
        </div>

        {origen && destino ? (
        <div className="caja-cc-pase-preview">
          <h4>Resultado (trazabilidad)</h4>
          <table className="caja-cc-table caja-cc-pase-table">
            <thead>
              <tr>
                <th>Caja</th>
                <th className="num">Antes</th>
                <th className="num">Pase</th>
                <th className="num">Después</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{cajaNombre(origen) || origen} (origen)</td>
                <td className="num">$ {fmtArs(calc.origen_efectivo_antes + calc.origen_otros_antes)}</td>
                <td className="num">− $ {fmtArs(calc.pase_efectivo + calc.pase_otros)}</td>
                <td className="num">$ {fmtArs(calc.origen_efectivo_despues + calc.origen_otros_despues)}</td>
              </tr>
              <tr>
                <td>{cajaNombre(destino) || destino} (destino)</td>
                <td className="num">$ {fmtArs(calc.destino_efectivo_antes + calc.destino_otros_antes)}</td>
                <td className="num">+ $ {fmtArs(calc.pase_efectivo + calc.pase_otros)}</td>
                <td className="num">$ {fmtArs(calc.destino_efectivo_despues + calc.destino_otros_despues)}</td>
              </tr>
            </tbody>
          </table>
          <p className="caja-cc-sub">
            Efectivo origen: $ {fmtArs(calc.origen_efectivo_antes)} → $ {fmtArs(calc.origen_efectivo_despues)} · Destino:{' '}
            $ {fmtArs(calc.destino_efectivo_antes)} → $ {fmtArs(calc.destino_efectivo_despues)}
          </p>
        </div>
        ) : null}

        <label className="caja-cc-field">
          Observación
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
        </label>

        {msg &&
          (msg.includes('registrado') ? (
            <CajaMensajeOkPlotLab>
              <p className="caja-cc-ok">{msg}</p>
            </CajaMensajeOkPlotLab>
          ) : (
            <p className="caja-cc-error">{msg}</p>
          ))}

        <div className="caja-cc-actions">
          <button type="submit" className="btn-primary" disabled={saving || !origen || !destino}>
            {saving ? 'Guardando…' : 'Registrar pase con trazabilidad'}
          </button>
        </div>
      </form>

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
          <h3>Historial de pases</h3>
          <span className="caja-cc-card-collapsible-badge">
            {loading ? '…' : pases.length}
          </span>
        </button>
        {historialOpen && (
          <div className="caja-cc-card-collapsible-body">
            {loading ? (
              <p className="caja-cc-empty">Cargando…</p>
            ) : (
              <CajaMovimientosList
                movimientos={pases}
                cajas={cajas}
                showUsuario={!soloMisPases}
                showPaseTrazabilidad
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
