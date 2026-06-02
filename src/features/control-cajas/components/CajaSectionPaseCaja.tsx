import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getUltimoArqueoCaja,
  listCajas,
  listMovimientos,
  saveMovimiento
} from '../cajaRepository'
import { fmtArs, parseNum } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { calcularPaseTrazabilidad, validarPaseCaja } from '../paseCaja'
import CajaMovimientosList from './CajaMovimientosList'
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
    if (c.length && !origen) setOrigen(c.find((x) => x.slug !== 'admin')?.slug ?? c[0].slug)
    if (c.length && !destino) setDestino(c.find((x) => x.slug === 'admin')?.slug ?? c[1]?.slug ?? c[0].slug)
    setLoading(false)
  }, [soloMisPases, usuarioNombre, usuarioId, origen])

  useEffect(() => {
    void reload()
  }, [reload])

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

  return (
    <div>
      <div className="caja-cc-page-head">
        <div>
          <h2>Pase de caja</h2>
          <p>
            Registrá los montos que había en cada caja <strong>antes</strong> del pase, el monto transferido y el
            saldo resultante. Queda historial con usuario, fecha y hora.
          </p>
        </div>
      </div>

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
            <select value={origen} onChange={(e) => setOrigen(e.target.value)} required>
              {cajas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {hintOrigen && <span className="caja-cc-field-hint">{hintOrigen}</span>}
            <button
              type="button"
              className="btn-link caja-cc-pase-suggest"
              onClick={() => void sugerirDesdeArqueo(origen, 'origen')}
            >
              Usar último arqueo →
            </button>
          </label>
          <label className="caja-cc-field">
            Caja destino (recibe el dinero)
            <select value={destino} onChange={(e) => setDestino(e.target.value)} required>
              {cajas.map((c) => (
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
            >
              Usar último arqueo →
            </button>
          </label>
        </div>

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
                <td className="num">
                  − $ {fmtArs(calc.pase_efectivo + calc.pase_otros)}
                </td>
                <td className="num">
                  $ {fmtArs(calc.origen_efectivo_despues + calc.origen_otros_despues)}
                </td>
              </tr>
              <tr>
                <td>{cajaNombre(destino)} (destino)</td>
                <td className="num">$ {fmtArs(calc.destino_efectivo_antes + calc.destino_otros_antes)}</td>
                <td className="num">
                  + $ {fmtArs(calc.pase_efectivo + calc.pase_otros)}
                </td>
                <td className="num">
                  $ {fmtArs(calc.destino_efectivo_despues + calc.destino_otros_despues)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="caja-cc-sub">
            Efectivo origen: $ {fmtArs(calc.origen_efectivo_antes)} → $ {fmtArs(calc.origen_efectivo_despues)} ·
            Destino: $ {fmtArs(calc.destino_efectivo_antes)} → $ {fmtArs(calc.destino_efectivo_despues)}
          </p>
        </div>

        <label className="caja-cc-field">
          Observación
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
        </label>

        {msg && <p className={msg.includes('registrado') ? 'caja-cc-ok' : 'caja-cc-error'}>{msg}</p>}

        <div className="caja-cc-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Registrar pase con trazabilidad'}
          </button>
        </div>
      </form>

      <div className="caja-cc-card">
        <h3>Historial de pases</h3>
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
    </div>
  )
}
