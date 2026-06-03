import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getParams,
  getUltimoArqueoCaja,
  listCajas,
  listMovimientos,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveMovimiento
} from '../cajaRepository'
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

  const sugerirDesdeArqueo = useCallback(
    async (slug: string, side: 'origen' | 'destino') => {
      if (!slug) return
      const arq = await getUltimoArqueoCaja(slug, fecha)
      if (!arq) {
        if (side === 'origen') setHintOrigen('Sin arqueo previo para esta caja/fecha.')
        else setHintDestino('Sin arqueo previo para esta caja/fecha.')
        return
      }
      const texto = `Último arqueo ${arq.fecha}: $ ${fmtArs(arq.total)}`
      if (side === 'origen') {
        setOrigenEfAntes(String(arq.total))
        setHintOrigen(texto)
      } else {
        setDestinoEfAntes(String(arq.total))
        setHintDestino(texto)
      }
    },
    [fecha]
  )

  useEffect(() => {
    if (origen) void sugerirDesdeArqueo(origen, 'origen')
  }, [origen, fecha, sugerirDesdeArqueo])

  useEffect(() => {
    if (destino) void sugerirDesdeArqueo(destino, 'destino')
  }, [destino, fecha, sugerirDesdeArqueo])

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
        Registrá los montos que había en cada caja <strong>antes</strong> del pase, el monto transferido y el saldo
        resultante. Queda historial con usuario, fecha y hora.
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
            {hintOrigen && <span className="caja-cc-field-hint">{hintOrigen}</span>}
            <button
              type="button"
              className="btn-link caja-cc-pase-suggest"
              onClick={() => void sugerirDesdeArqueo(origen, 'origen')}
              disabled={!origen}
            >
              Usar último arqueo →
            </button>
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
            {hintDestino && <span className="caja-cc-field-hint">{hintDestino}</span>}
            <button
              type="button"
              className="btn-link caja-cc-pase-suggest"
              onClick={() => void sugerirDesdeArqueo(destino, 'destino')}
              disabled={!destino}
            >
              Usar último arqueo →
            </button>
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
              </label>
            </div>
          </div>
        )}

        <div className="caja-cc-pase-block highlight">
          <h4>Monto del pase</h4>
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
                <td>{cajaNombre(origen)} (origen)</td>
                <td className="num">$ {fmtArs(calc.origen_efectivo_antes + calc.origen_otros_antes)}</td>
                <td className="num">− $ {fmtArs(calc.pase_efectivo + calc.pase_otros)}</td>
                <td className="num">$ {fmtArs(calc.origen_efectivo_despues + calc.origen_otros_despues)}</td>
              </tr>
              <tr>
                <td>{cajaNombre(destino)} (destino)</td>
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
