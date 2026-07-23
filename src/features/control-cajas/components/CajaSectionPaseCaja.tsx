import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCajaOperativa } from '../../../hooks/useCajaOperativa'
import { getUltimoArqueoCaja, listCajas, listMovimientos, listPlanillas, saveMovimiento } from '../cajaRepository'
import {
  buscarPlanillaCaja,
  montosCajaDesdeFuentes,
  sugerirMontoPase
} from '../paseCajaMontos'
import { fmtArs, parseNum } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { calcularPaseTrazabilidad, validarPaseCaja } from '../paseCaja'
import CajaMovimientosList from './CajaMovimientosList'
import CajaMovimientoDetalleModal from './CajaMovimientoDetalleModal'
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
  const { slug: cajaSlugOp, loading: cajaOperativaLoading } = useCajaOperativa({
    enabled: soloMisPases
  })
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [pases, setPases] = useState<CajaMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [detalleMovimiento, setDetalleMovimiento] = useState<CajaMovimiento | null>(null)

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
    if (!soloMisPases || !cajaSlugOp) return
    setOrigen(cajaSlugOp)
    const admin = cajas.find((x) => x.slug === 'admin')?.slug
    setDestino((prev) => {
      if (prev && prev !== cajaSlugOp) return prev
      if (admin) return admin
      const operativas = cajas.filter((x) => x.slug !== 'vuelto' && x.slug !== 'admin')
      return operativas.find((c) => c.slug !== cajaSlugOp)?.slug ?? ''
    })
  }, [soloMisPases, cajaSlugOp, cajas])

  const cajaResolviendo = soloMisPases && cajaOperativaLoading
  const cajaAutoAsignada = soloMisPases && Boolean(cajaSlugOp)
  const camposAutomaticos = soloMisPases

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
          // Pase de caja: solo efectivo
          origenOt = 0
          setOrigenEfAntes(String(m.efectivo))
          setOrigenOtAntes('0')
          setHintOrigen(m.hintEfectivo)
          setHintOrigenOt(null)
        } else {
          setHintOrigen(null)
          setHintOrigenOt(null)
        }

        if (destino) {
          const m = montosCajaDesdeFuentes(cajaDestino, arqDestino, planDestino, fecha)
          setDestinoEfAntes(String(m.efectivo))
          setDestinoOtAntes('0')
          setHintDestino(m.hintEfectivo)
          setHintDestinoOt(null)
        } else {
          setHintDestino(null)
          setHintDestinoOt(null)
        }

        if (origen && destino) {
          const sug = sugerirMontoPase({
            origen: cajaOrigen,
            destino: cajaDestino,
            origenEf,
            origenOt: 0
          })
          setPaseEf(sug.efectivo > 0 ? String(sug.efectivo) : '')
          setPaseOt('0')
          setHintPase(sug.hint || null)
        } else {
          setPaseEf('')
          setPaseOt('0')
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
      await saveMovimiento(
        {
          fecha,
          hora,
          concepto: 'Pase de caja',
          origen_slug: origen,
          destino_slug: destino,
          efectivo: calc.pase_efectivo,
          otros: 0,
          nro_comprobante: nro || null,
          observacion: observacion || null,
          id_usuario: usuarioId ?? null,
          usuario_nombre: usuarioNombre,
          origen_importacion: 'manual',
          origen_efectivo_antes: calc.origen_efectivo_antes,
          origen_otros_antes: 0,
          destino_efectivo_antes: calc.destino_efectivo_antes,
          destino_otros_antes: 0,
          origen_efectivo_despues: calc.origen_efectivo_despues,
          origen_otros_despues: 0,
          destino_efectivo_despues: calc.destino_efectivo_despues,
          destino_otros_despues: 0
        },
        usuarioId != null
          ? { actor: { id: usuarioId, esAdmin: !soloMisPases }, cajas }
          : undefined
      )
      setPaseEf('')
      setPaseOt('0')
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
  }

  return (
    <div className="caja-cc-pase-section">
      <p className="caja-cc-intro caja-cc-sub">
        {camposAutomaticos
          ? 'Pase en efectivo automático desde el arqueo de tu caja hacia el destino.'
          : 'Los montos de efectivo se completan desde el arqueo. El pase es solo en efectivo.'}
      </p>

      <form className="caja-cc-card caja-cc-pase-form" onSubmit={(e) => void handleSubmit(e)}>
        <h3>Nuevo pase</h3>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Fecha
            {camposAutomaticos ? (
              <>
                <input type="date" value={fecha} readOnly disabled />
                <span className="caja-cc-field-hint">Automática del sistema.</span>
              </>
            ) : (
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            )}
          </label>
          <label className="caja-cc-field">
            Hora
            {camposAutomaticos ? (
              <>
                <input type="time" value={hora} readOnly disabled />
                <span className="caja-cc-field-hint">Automática del sistema.</span>
              </>
            ) : (
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            )}
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
            ) : cajaAutoAsignada || camposAutomaticos ? (
              <>
                <input type="text" readOnly value={cajaNombre(origen) || '—'} />
                <span className="caja-cc-field-hint">Automática por sistema según tu usuario.</span>
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
            {camposAutomaticos ? (
              <>
                <input type="text" readOnly value={cajaNombre(destino) || '—'} />
                <span className="caja-cc-field-hint">Automática del sistema.</span>
              </>
            ) : (
              <select value={destino} onChange={(e) => setDestino(e.target.value)} required disabled={!origen}>
                {cajas
                  .filter((c) => c.slug !== origen)
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nombre}
                    </option>
                  ))}
              </select>
            )}
            {arqueoCargando && destino ? (
              <span className="caja-cc-field-hint">Cargando montos del arqueo…</span>
            ) : (
              hintDestino && !camposAutomaticos && <span className="caja-cc-field-hint">{hintDestino}</span>
            )}
          </label>
        </div>

        {origen && (
          <div className="caja-cc-pase-block">
            <h4>En {cajaNombre(origen)} — antes del pase</h4>
            <label className="caja-cc-field">
              Efectivo en caja
              <input
                type="number"
                step="0.01"
                required
                value={origenEfAntes}
                onChange={camposAutomaticos ? undefined : (e) => setOrigenEfAntes(e.target.value)}
                readOnly={camposAutomaticos}
                disabled={camposAutomaticos}
                placeholder="Monto real contado"
              />
              {camposAutomaticos ? (
                <span className="caja-cc-field-hint">Automático desde el último arqueo.</span>
              ) : null}
            </label>
          </div>
        )}

        {!camposAutomaticos && destino ? (
          <div className="caja-cc-pase-block">
            <h4>En {cajaNombre(destino)} — antes del pase</h4>
            <label className="caja-cc-field">
              Efectivo en caja
              <input
                type="number"
                step="0.01"
                value={destinoEfAntes}
                onChange={(e) => setDestinoEfAntes(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {!camposAutomaticos ? (
          <div className="caja-cc-pase-block highlight">
            <h4>Monto del pase (efectivo)</h4>
            {arqueoCargando ? (
              <p className="caja-cc-field-hint">Calculando monto sugerido…</p>
            ) : (
              hintPase && <p className="caja-cc-field-hint">{hintPase}</p>
            )}
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
              Nº comprobante
              <input value={nro} onChange={(e) => setNro(e.target.value)} placeholder="MEC-0000…" />
            </label>
          </div>
        ) : origen && destino ? (
          <p className="caja-cc-help">
            {arqueoCargando
              ? 'Calculando pase automático…'
              : hintPase ||
                (parseNum(paseEf) > 0
                  ? `Pase automático en efectivo: $ ${fmtArs(parseNum(paseEf))} → ${cajaNombre(destino)}.`
                  : 'Sin excedente de efectivo para pasar (revisá el arqueo o el fondo).')}
          </p>
        ) : null}

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
                <td className="num">$ {fmtArs(calc.origen_efectivo_antes)}</td>
                <td className="num">− $ {fmtArs(calc.pase_efectivo)}</td>
                <td className="num">$ {fmtArs(calc.origen_efectivo_despues)}</td>
              </tr>
              <tr>
                <td>{cajaNombre(destino) || destino} (destino)</td>
                <td className="num">$ {fmtArs(calc.destino_efectivo_antes)}</td>
                <td className="num">+ $ {fmtArs(calc.pase_efectivo)}</td>
                <td className="num">$ {fmtArs(calc.destino_efectivo_despues)}</td>
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
                onSelect={setDetalleMovimiento}
              />
            )}
          </div>
        )}
      </div>

      {detalleMovimiento && (
        <CajaMovimientoDetalleModal
          movimiento={detalleMovimiento}
          cajas={cajas}
          onClose={() => setDetalleMovimiento(null)}
        />
      )}
    </div>
  )
}
