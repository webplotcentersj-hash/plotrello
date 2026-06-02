import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { validarMediosPago, type MediosPagoInput } from '../movimientoCaja'

const CAMPOS_MEDIOS: { key: keyof MediosPagoInput; label: string }[] = [
  { key: 'cuenta_corriente', label: 'Cta. Cte.' },
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'cheque_propio', label: 'Ch. Prop.' },
  { key: 'cheque_tercero', label: 'Ch. Terc.' },
  { key: 'tarjeta', label: 'Tarjetas' },
  { key: 'documento', label: 'Docum.' },
  { key: 'cuenta_contable', label: 'C. Contab.' },
  { key: 'transferencia_bancaria', label: 'Trans. B.' },
  { key: 'otros', label: 'Otros' }
]
import { fmtArs, parseNum } from '../format'
import type { CajaRegistro } from '../types'

type Props = {
  cajas: CajaRegistro[]
  fecha: string
  setFecha: (v: string) => void
  origen: string
  setOrigen: (v: string) => void
  destino: string
  setDestino: (v: string) => void
  tipoMov: 'ingreso' | 'egreso' | 'traspaso'
  setTipoMov: (v: 'ingreso' | 'egreso' | 'traspaso') => void
  comprobante: string
  setComprobante: (v: string) => void
  concepto: string
  setConcepto: (v: string) => void
  medios: MediosPagoInput
  setMedios: Dispatch<SetStateAction<MediosPagoInput>>
  onSubmit: () => void
  saving: boolean
}

export default function CajaFormMovimientoMedios({
  cajas,
  fecha,
  setFecha,
  origen,
  setOrigen,
  destino,
  setDestino,
  tipoMov,
  setTipoMov,
  comprobante,
  setComprobante,
  concepto,
  setConcepto,
  medios,
  setMedios,
  onSubmit,
  saving
}: Props) {
  const [err, setErr] = useState<string | null>(null)

  const validacion = useMemo(() => validarMediosPago(medios), [medios])

  const setCampo = (key: keyof MediosPagoInput, raw: string) => {
    const n = raw === '' ? 0 : parseNum(raw)
    setMedios((prev) => ({ ...prev, [key]: Number.isNaN(n) ? 0 : n }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = validarMediosPago(medios)
    if (!v.valido) {
      setErr(`Total ($${fmtArs(medios.total)}) ≠ medios ($${fmtArs(v.suma_medios)}). Δ $${fmtArs(v.diferencia)}`)
      return
    }
    setErr(null)
    onSubmit()
  }

  return (
    <form className="caja-cc-card caja-cc-mov-medios" onSubmit={handleSubmit}>
      <h3>Movimiento con medios de pago (planilla)</h3>
      <p className="caja-cc-sub">
        Misma estructura que el PDF Plot Center: el total debe coincidir con la suma de columnas.
      </p>
      <div className="caja-cc-grid-3">
        <label className="caja-cc-field">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label className="caja-cc-field">
          Tipo
          <select value={tipoMov} onChange={(e) => setTipoMov(e.target.value as typeof tipoMov)}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
            <option value="traspaso">Traspaso</option>
          </select>
        </label>
        <label className="caja-cc-field">
          Comprobante
          <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="FA / EG / MEC…" />
        </label>
      </div>
      <div className="caja-cc-grid-2">
        <label className="caja-cc-field">
          {tipoMov === 'ingreso' ? 'Caja destino' : 'Caja origen'}
          <select
            value={tipoMov === 'ingreso' ? destino : origen}
            onChange={(e) => (tipoMov === 'ingreso' ? setDestino : setOrigen)(e.target.value)}
          >
            {cajas.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        {tipoMov === 'traspaso' && (
          <label className="caja-cc-field">
            Caja destino
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {cajas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="caja-cc-field">
        Concepto
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
      </label>

      <div className="caja-cc-grid-3 caja-cc-medios-grid">
        <label className="caja-cc-field">
          <strong>Total</strong>
          <input
            type="number"
            step="0.01"
            value={medios.total || ''}
            onChange={(e) => setCampo('total', e.target.value)}
            required
          />
        </label>
        {CAMPOS_MEDIOS.map((col) => (
          <label key={col.key} className="caja-cc-field">
            {col.label}
            <input
              type="number"
              step="0.01"
              value={medios[col.key] || ''}
              onChange={(e) => setCampo(col.key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className={`caja-cc-result ${validacion.valido ? 'ok' : 'bad'}`}>
        <span>Suma medios</span>
        <strong>$ {fmtArs(validacion.suma_medios)}</strong>
        {!validacion.valido && (
          <span className="caja-cc-field-hint">Δ $ {fmtArs(validacion.diferencia)}</span>
        )}
      </div>

      {err && <p className="caja-cc-error">{err}</p>}

      <button type="submit" className="btn-primary" disabled={saving || !validacion.valido}>
        {saving ? 'Guardando…' : 'Guardar movimiento'}
      </button>
    </form>
  )
}
