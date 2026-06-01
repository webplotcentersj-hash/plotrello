import { useEffect, useMemo, useState } from 'react'
import { BILLETE_DENOMINACIONES, TURNOS_CAJA } from '../constants'
import { listCajas, saveArqueo } from '../cajaRepository'
import { fmtArs, fmtArs0, parseNum } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import type { CajaRegistro } from '../types'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloCajasOperativas?: boolean
  onSaved?: () => void
}

export default function CajaSectionArqueo({
  usuarioNombre,
  usuarioId,
  soloCajasOperativas = true,
  onSaved
}: Props) {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [turno, setTurno] = useState<string>('Único')
  const [billetes, setBilletes] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void listCajas().then((list) => {
      const filtered = soloCajasOperativas ? list.filter((c) => c.slug !== 'admin') : list
      setCajas(filtered)
      if (filtered.length && !cajaSlug) setCajaSlug(filtered[0].slug)
    })
  }, [soloCajasOperativas, cajaSlug])

  const total = useMemo(() => {
    return BILLETE_DENOMINACIONES.reduce((sum, d) => {
      const q = billetes[`b${d}`] ?? 0
      return sum + q * d
    }, 0)
  }, [billetes])

  const setCantidad = (denom: number, raw: string) => {
    const q = Math.max(0, Math.floor(parseNum(raw)))
    setBilletes((prev) => ({ ...prev, [`b${denom}`]: q }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) {
      setMsg('Elegí una caja.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await saveArqueo({
        fecha,
        caja_slug: cajaSlug,
        turno,
        id_usuario: usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        billetes,
        total
      })
      setMsg(`Arqueo guardado — total $ ${fmtArs(total)}`)
      setBilletes({})
      onSaved?.()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="caja-cc-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="caja-cc-help">
        Contá los billetes de tu caja. El total se calcula solo y queda firmado a tu nombre.
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
            <select value={cajaSlug} onChange={(e) => setCajaSlug(e.target.value)} required>
              <option value="">Elegir…</option>
              {cajas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
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
      <div className="caja-cc-result neutral">
        <span>Total contado</span>
        <strong>$ {fmtArs(total)}</strong>
      </div>
      <div className="caja-cc-signature">
        <span>Firma cajera: {usuarioNombre}</span>
      </div>
      {msg && <p className={msg.startsWith('Arqueo') ? 'caja-cc-ok' : 'caja-cc-error'}>{msg}</p>}
      <div className="caja-cc-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar y firmar'}
        </button>
      </div>
    </form>
  )
}
