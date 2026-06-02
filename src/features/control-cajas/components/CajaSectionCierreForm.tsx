import { useEffect, useMemo, useState } from 'react'
import { TURNOS_CAJA } from '../constants'
import { calcularCierre, cierreFromCalculado, type CierreFormInput } from '../cierreCalculations'
import { fmtArs } from '../format'
import {
  getCierre,
  getParams,
  listCajas,
  listPlanillas,
  resolveCajaSlug,
  saveCierre
} from '../cajaRepository'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import CajaBadge from './CajaBadge'
import {
  FONDO_CAJA_BASE_MIN,
  fondoFijoEfectivo,
  requiereFondoMinimo,
  validarEfectivoFisicoVsFondo
} from '../fondoCaja'

type Props = {
  editId?: string | null
  onSaved: () => void
  onCancel: () => void
}

const emptyForm = (): CierreFormInput => ({
  fondo_fijo: 0,
  ing_ef: 0,
  egr_ef: 0,
  ef_contado: 0,
  tarj_sist: 0,
  tarj_fis: 0,
  mp_qr: 0,
  trans: 0,
  cta_cte: 0
})

export default function CajaSectionCierreForm({ editId, onSaved, onCancel }: Props) {
  const [cajas, setCajas] = useState<Awaited<ReturnType<typeof listCajas>>>([])
  const [cajeras, setCajeras] = useState<string[]>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [turno, setTurno] = useState('Único')
  const [cajera, setCajera] = useState('')
  const [emailOk, setEmailOk] = useState<'Sí' | 'No'>('Sí')
  const [form, setForm] = useState<CierreFormInput>(emptyForm)
  const [observacion, setObservacion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([listCajas(), getParams()]).then(([c, p]) => {
      setCajas(c)
      setCajeras(p.cajeras.map((x) => x.nombre))
      setTolerancia(p.tolerancia)
      if (c.length && !cajaSlug) setCajaSlug(c[0].slug)
    })
  }, [cajaSlug])

  useEffect(() => {
    if (!editId) return
    void getCierre(editId).then((c) => {
      if (!c) return
      setFecha(c.fecha)
      setCajaSlug(c.caja_slug)
      setTurno(c.turno)
      setCajera(c.cajera ?? '')
      setEmailOk(c.email_ok === 'No' ? 'No' : 'Sí')
      setObservacion(c.observacion ?? '')
      const caja = cajas.find((x) => x.slug === c.caja_slug)
      setForm({
        fondo_fijo: caja ? fondoFijoEfectivo(caja) : c.fondo_fijo,
        ing_ef: c.ing_ef,
        egr_ef: c.egr_ef,
        ef_contado: c.ef_contado,
        tarj_sist: c.tarj_sist,
        tarj_fis: c.tarj_fis,
        mp_qr: c.mp_qr,
        trans: c.trans,
        cta_cte: c.cta_cte
      })
    })
  }, [editId, cajas])

  const calc = useMemo(() => calcularCierre(form, tolerancia), [form, tolerancia])

  const setNum = (key: keyof CierreFormInput, v: string) => {
    const n = v === '' ? 0 : parseFloat(v)
    setForm((prev) => ({ ...prev, [key]: Number.isNaN(n) ? 0 : n }))
  }

  const onCajaChange = (slug: string) => {
    setCajaSlug(slug)
    const c = cajas.find((x) => x.slug === slug)
    if (c) setForm((prev) => ({ ...prev, fondo_fijo: fondoFijoEfectivo(c) }))
  }

  const cajaActiva = cajas.find((c) => c.slug === cajaSlug)
  const fondoMin = cajaActiva ? fondoFijoEfectivo(cajaActiva) : 0

  const cargarDesdePlanilla = async () => {
    const planillas = await listPlanillas(20)
    const match = planillas.find(
      (p) =>
        p.fecha_hasta === fecha ||
        p.fecha_desde === fecha ||
        resolveCajaSlug(p.caja_nombre, cajas) === cajaSlug
    )
    if (!match?.totales) {
      setMsg('No hay planilla PDF guardada para esta fecha/caja. Subila en Movimientos primero.')
      return
    }
    const t = match.totales
    setForm((prev) => ({
      ...prev,
      ing_ef: t.ingresos_efectivo ?? prev.ing_ef,
      tarj_sist: t.ingresos_tarjetas ?? prev.tarj_sist,
      mp_qr: 0,
      trans: t.ingresos_trans_b ?? prev.trans,
      cta_cte: t.ingresos_cta_cte ?? prev.cta_cte,
      egr_ef: t.egresos_efectivo ?? prev.egr_ef
    }))
    setMsg(`Datos precargados desde planilla: ${match.archivo_nombre}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) return
    const caja = cajas.find((c) => c.slug === cajaSlug)
    if (caja) {
      const fondoOk = fondoFijoEfectivo(caja)
      if (requiereFondoMinimo(caja.slug) && (form.fondo_fijo || 0) < fondoOk) {
        setMsg(
          `El fondo de caja debe ser al menos $ ${fmtArs(fondoOk)} (efectivo real permanente en la caja).`
        )
        return
      }
      if (form.ef_contado > 0) {
        const v = validarEfectivoFisicoVsFondo(form.ef_contado, caja)
        if (!v.ok) {
          setMsg(v.mensaje)
          return
        }
      }
    }
    setSaving(true)
    try {
      const payload = cierreFromCalculado(
        {
          fecha,
          caja_slug: cajaSlug,
          turno,
          cajera: cajera || null,
          email_ok: emailOk,
          observacion: observacion || null,
          id_planilla: null
        },
        calc
      )
      await saveCierre({ ...payload, id: editId ?? undefined })
      onSaved()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const resultClass =
    calc.estado === 'OK' ? (calc.dif_total === 0 ? 'neutral' : 'ok') : 'bad'

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="caja-cc-help">
        <b>Antes de cargar:</b> la cajera debe enviar el Listado de Planilla de Caja (PDF) y entregar
        hoja de conteo firmada, cupones POSNET y egresos firmados.
        <button type="button" className="btn-secondary caja-cc-inline-btn" onClick={() => void cargarDesdePlanilla()}>
          Precargar desde planilla PDF
        </button>
      </div>
      {msg && <p className="caja-cc-help">{msg}</p>}

      <div className="caja-cc-card">
        <h3>Identificación</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Caja
            <select value={cajaSlug} onChange={(e) => onCajaChange(e.target.value)} required>
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
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Cajera
            <select value={cajera} onChange={(e) => setCajera(e.target.value)}>
              <option value="">—</option>
              {cajeras.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="caja-cc-field">
            Email del listado recibido
            <select value={emailOk} onChange={(e) => setEmailOk(e.target.value as 'Sí' | 'No')}>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </label>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Efectivo</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fondo de caja <span className="caja-cc-tag cfg">real · base</span>
            <input
              type="number"
              step="0.01"
              readOnly={!!cajaActiva && requiereFondoMinimo(cajaActiva.slug)}
              value={form.fondo_fijo || ''}
              onChange={(e) => setNum('fondo_fijo', e.target.value)}
            />
            {cajaActiva && requiereFondoMinimo(cajaActiva.slug) && (
              <span className="caja-cc-field-hint">
                Efectivo permanente en caja. Base mínima $ {fmtArs(FONDO_CAJA_BASE_MIN)}.
              </span>
            )}
          </label>
          <label className="caja-cc-field">
            Ingresos efectivo <span className="caja-cc-tag input">listado</span>
            <input type="number" step="0.01" value={form.ing_ef || ''} onChange={(e) => setNum('ing_ef', e.target.value)} />
          </label>
          <label className="caja-cc-field">
            Egresos efectivo <span className="caja-cc-tag input">listado</span>
            <input type="number" step="0.01" value={form.egr_ef || ''} onChange={(e) => setNum('egr_ef', e.target.value)} />
          </label>
        </div>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Efectivo teórico <span className="caja-cc-tag calc">calc</span>
            <input readOnly value={`$ ${fmtArs(calc.ef_teorico)}`} />
          </label>
          <label className="caja-cc-field">
            Efectivo contado <span className="caja-cc-tag input">hoja firmada</span>
            <input type="number" step="0.01" value={form.ef_contado || ''} onChange={(e) => setNum('ef_contado', e.target.value)} />
            {fondoMin > 0 && (
              <span className="caja-cc-field-hint">No puede ser menor al fondo ($ {fmtArs(fondoMin)}).</span>
            )}
          </label>
          <label className="caja-cc-field">
            Diferencia efectivo <span className="caja-cc-tag calc">calc</span>
            <input readOnly value={`$ ${fmtArs(calc.dif_ef)}`} />
          </label>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Tarjetas y POSNET</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Tarjetas s/sistema <span className="caja-cc-tag input">listado</span>
            <input type="number" step="0.01" value={form.tarj_sist || ''} onChange={(e) => setNum('tarj_sist', e.target.value)} />
          </label>
          <label className="caja-cc-field">
            Cupones físicos <span className="caja-cc-tag input">papel</span>
            <input type="number" step="0.01" value={form.tarj_fis || ''} onChange={(e) => setNum('tarj_fis', e.target.value)} />
          </label>
          <label className="caja-cc-field">
            Diferencia tarjetas <span className="caja-cc-tag calc">calc</span>
            <input readOnly value={`$ ${fmtArs(calc.dif_tarj)}`} />
          </label>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Otros canales del día</h3>
        <p className="caja-cc-sub">Informativo · se concilian aparte (MP y banco)</p>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            QR Mercado Pago
            <input type="number" step="0.01" value={form.mp_qr || ''} onChange={(e) => setNum('mp_qr', e.target.value)} />
          </label>
          <label className="caja-cc-field">
            Transferencias
            <input type="number" step="0.01" value={form.trans || ''} onChange={(e) => setNum('trans', e.target.value)} />
          </label>
          <label className="caja-cc-field">
            Cta. cte.
            <input type="number" step="0.01" value={form.cta_cte || ''} onChange={(e) => setNum('cta_cte', e.target.value)} />
          </label>
        </div>
      </div>

      <div className={`caja-cc-result ${resultClass}`}>
        <span>Total ventas del día</span>
        <strong>$ {fmtArs(calc.total_ventas)}</strong>
      </div>
      <div className={`caja-cc-result ${resultClass}`}>
        <span>
          Diferencia cierre físico · <CajaBadge estado={calc.estado} />
        </span>
        <strong>$ {fmtArs(calc.dif_total)}</strong>
      </div>

      <div className="caja-cc-card">
        <label className="caja-cc-field">
          Observación
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={3} />
        </label>
      </div>

      <div className="caja-cc-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cierre'}
        </button>
      </div>
    </form>
  )
}
