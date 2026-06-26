import { useEffect, useMemo, useRef, useState } from 'react'
import { TURNOS_CAJA } from '../constants'
import { calcularCierre, cierreFromCalculado, type CierreFormInput } from '../cierreCalculations'
import { fmtArs } from '../format'
import {
  cerrarCierreDefinitivo,
  getCierre,
  getParams,
  listCajas,
  listEgresoSolicitudes,
  listMovimientos,
  listMovimientosPorCierre,
  getPlanillaById,
  listPlanillas,
  saveCierre
} from '../cajaRepository'
import { buscarPlanillaCaja } from '../paseCajaMontos'
import { totalEgresosAprobados } from '../cierreTurno'
import { cierrePrecargaDesdePlanilla } from '../cajaTotales'
import { calcularTotalesCaja, enrichCierreFromTotales } from '../movimientoCaja'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { sincronizarVentasPlotLabRango } from '../plotlabVentaCajaSync'
import type { CajaCierreEstadoCierre, CajaMovimiento } from '../types'
import CajaBadge from './CajaBadge'
import CajaCierreSnapshotPanel from './CajaCierreSnapshotPanel'
import CajaCollapsibleCard from './CajaCollapsibleCard'
import CajaAvisoPdfUnico from './CajaAvisoPdfUnico'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import {
  FONDO_CAJA_RECOMENDADO,
  fondoFijoEfectivo,
  requiereFondoMinimo,
  validarEfectivoFisicoVsFondo
} from '../fondoCaja'

type Props = {
  editId?: string | null
  usuarioNombre: string
  usuarioId?: number
  planillaActiva?: PlanillaCajaParsed | null
  onPlanillaParsed?: (planilla: PlanillaCajaParsed | null) => void
  onSaved: () => void
  onCancel: () => void
  onIrSubirPdf?: () => void
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

export default function CajaSectionCierreForm({
  editId,
  planillaActiva = null,
  onSaved,
  onCancel,
  onIrSubirPdf
}: Props) {
  const [cajas, setCajas] = useState<Awaited<ReturnType<typeof listCajas>>>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [turno, setTurno] = useState('Único')
  const [cajera, setCajera] = useState('')
  const [emailOk, setEmailOk] = useState<'Sí' | 'No'>('Sí')
  const [form, setForm] = useState<CierreFormInput>(emptyForm)
  const [observacion, setObservacion] = useState('')
  const [saving, setSaving] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [estadoCierre, setEstadoCierre] = useState<CajaCierreEstadoCierre>('abierto')
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null)
  const [movsVinculados, setMovsVinculados] = useState<CajaMovimiento[]>([])
  const [idPlanilla, setIdPlanilla] = useState<string | null>(null)
  const autoPrecargaRef = useRef(false)

  useEffect(() => {
    void Promise.all([listCajas(), getParams()]).then(([c, p]) => {
      setCajas(c)
      setTolerancia(p.tolerancia)
      if (c.length && !cajaSlug) setCajaSlug(c[0].slug)
    })
  }, [cajaSlug])

  useEffect(() => {
    void listMovimientos().then(setMovimientos)
  }, [])

  useEffect(() => {
    if (!editId) autoPrecargaRef.current = false
  }, [editId, fecha, cajaSlug])

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
      setEstadoCierre(c.estado_cierre ?? 'abierto')
      setSnapshot(c.snapshot_totales ?? null)
      setIdPlanilla(c.id_planilla ?? null)
      if (c.estado_cierre === 'cerrado' || c.estado_cierre === 'observado') {
        void listMovimientosPorCierre(c.id).then(setMovsVinculados)
      } else {
        setMovsVinculados([])
      }
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

  const bloqueado = estadoCierre === 'cerrado' || estadoCierre === 'observado'

  useEffect(() => {
    if (editId || bloqueado || !cajaSlug || !fecha || planillaActiva) return
    let cancelled = false
    void (async () => {
      await sincronizarVentasPlotLabRango(fecha, fecha)
      const movs = await listMovimientos()
      if (cancelled) return
      setMovimientos(movs)
      const plotlab = movs.some(
        (m) =>
          m.fecha === fecha &&
          m.destino_slug === cajaSlug &&
          !m.anulado &&
          m.origen_importacion === 'plotlab_venta'
      )
      if (!plotlab || autoPrecargaRef.current) return
      autoPrecargaRef.current = true
      const totales = calcularTotalesCaja(movs, cajaSlug, fecha, fecha)
      const solicitudes = await listEgresoSolicitudes({ fecha, cajaSlug })
      const egresosSol = totalEgresosAprobados(solicitudes)
      setForm((prev) => {
        const calcEnriched = enrichCierreFromTotales(prev, totales, tolerancia)
        return {
          ...prev,
          ing_ef: calcEnriched.ing_ef,
          egr_ef: egresosSol.efectivo > 0 ? egresosSol.efectivo : calcEnriched.egr_ef,
          tarj_sist: calcEnriched.tarj_sist,
          trans: calcEnriched.trans,
          cta_cte: calcEnriched.cta_cte
        }
      })
      setMsg(
        `Precargado desde ventas PlotLab (${totales.detalle.ingresos} ingreso(s)) y movimientos del día.`
      )
    })()
    return () => {
      cancelled = true
    }
  }, [fecha, cajaSlug, editId, bloqueado, planillaActiva, tolerancia])

  const cargarDesdePlotLab = async () => {
    if (!cajaSlug) return
    await sincronizarVentasPlotLabRango(fecha, fecha)
    const movs = await listMovimientos()
    setMovimientos(movs)
    const totales = calcularTotalesCaja(movs, cajaSlug, fecha, fecha)
    const calc = enrichCierreFromTotales(form, totales, tolerancia)
    const solicitudes = await listEgresoSolicitudes({ fecha, cajaSlug })
    const egresosSol = totalEgresosAprobados(solicitudes)
    setForm({
      fondo_fijo: form.fondo_fijo,
      ing_ef: calc.ing_ef,
      egr_ef: egresosSol.efectivo > 0 ? egresosSol.efectivo : calc.egr_ef,
      ef_contado: form.ef_contado,
      tarj_sist: calc.tarj_sist,
      tarj_fis: form.tarj_fis,
      mp_qr: form.mp_qr,
      trans: calc.trans,
      cta_cte: calc.cta_cte
    })
    setMsg(
      `Precargado desde ventas PlotLab: ${totales.detalle.ingresos} ingreso(s) del día.`
    )
  }

  const cargarDesdeMovimientos = async () => {
    if (!cajaSlug) return
    const totales = calcularTotalesCaja(movimientos, cajaSlug, fecha, fecha)
    const calc = enrichCierreFromTotales(form, totales, tolerancia)
    const solicitudes = await listEgresoSolicitudes({ fecha, cajaSlug })
    const egresosSol = totalEgresosAprobados(solicitudes)
    setForm({
      fondo_fijo: form.fondo_fijo,
      ing_ef: calc.ing_ef,
      egr_ef: egresosSol.efectivo > 0 ? egresosSol.efectivo : calc.egr_ef,
      ef_contado: form.ef_contado,
      tarj_sist: calc.tarj_sist,
      tarj_fis: form.tarj_fis,
      mp_qr: form.mp_qr,
      trans: calc.trans,
      cta_cte: calc.cta_cte
    })
    setMsg(
      `Precargado desde ${totales.detalle.ingresos} ingreso(s) y ${totales.detalle.egresos} egreso(s) del día` +
        (egresosSol.efectivo > 0 ? ` · egresos aprobados $ ${fmtArs(egresosSol.efectivo)}` : '') +
        '.'
    )
  }

  const aplicarPlanillaParsed = (full: PlanillaCajaParsed, archivoLabel: string) => {
    const precarga = cierrePrecargaDesdePlanilla(full)
    setForm((prev) => ({
      ...prev,
      ing_ef: precarga.ing_ef ?? prev.ing_ef,
      egr_ef: precarga.egr_ef ?? prev.egr_ef,
      tarj_sist: precarga.tarj_sist ?? prev.tarj_sist,
      trans: precarga.trans ?? prev.trans,
      cta_cte: precarga.cta_cte ?? prev.cta_cte,
      ef_contado: prev.ef_contado
    }))
    setMsg(`Montos del cierre tomados de: ${archivoLabel}`)
  }

  const cargarPlanillaActiva = () => {
    if (!planillaActiva) return
    aplicarPlanillaParsed(planillaActiva, planillaActiva.archivo_nombre)
  }

  const cargarDesdePlanilla = async () => {
    if (planillaActiva) {
      cargarPlanillaActiva()
      return
    }
    if (!cajaSlug) {
      setMsg('Elegí la caja antes de precargar desde planilla.')
      return
    }
    const caja = cajas.find((c) => c.slug === cajaSlug)
    const planillas = await listPlanillas(120)
    const match = buscarPlanillaCaja(planillas, cajaSlug, fecha, caja?.nombre)
    if (!match) {
      setMsg(
        'No hay planilla PDF para esta fecha/caja. Subila en la lista Cierres (arriba) y volvé a precargar.'
      )
      return
    }

    setIdPlanilla(match.id)
    const full = await getPlanillaById(match.id)
    if (full) {
      aplicarPlanillaParsed(
        full,
        `${match.archivo_nombre}${full.ventas.length ? ` (${full.ventas.length} ventas)` : ''}`
      )
      return
    }

    const t = match.totales
    if (!t) {
      setMsg('Planilla sin totales. Volvé a importar el PDF.')
      return
    }
    setForm((prev) => ({
      ...prev,
      ing_ef: t.ingresos_efectivo ?? prev.ing_ef,
      tarj_sist: t.ingresos_tarjetas ?? prev.tarj_sist,
      mp_qr: 0,
      trans: t.ingresos_trans_b ?? prev.trans,
      cta_cte: t.ingresos_cta_cte ?? prev.cta_cte,
      egr_ef: t.egresos_efectivo ?? prev.egr_ef
    }))
    setMsg(`Totales precargados desde planilla: ${match.archivo_nombre}`)
  }

  const cargarEgresosAprobados = async () => {
    if (!cajaSlug) return
    const solicitudes = await listEgresoSolicitudes({ fecha, cajaSlug })
    const tot = totalEgresosAprobados(solicitudes)
    if (!tot.efectivo && !tot.otros) {
      setMsg('No hay egresos aprobados para esta fecha/caja.')
      return
    }
    setForm((prev) => ({
      ...prev,
      egr_ef: tot.efectivo || prev.egr_ef
    }))
    setMsg(
      `Egresos aprobados: $ ${fmtArs(tot.efectivo)} efectivo` +
        (tot.otros ? ` · $ ${fmtArs(tot.otros)} otros` : '') +
        '.'
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) return
    const caja = cajas.find((c) => c.slug === cajaSlug)
    if (caja) {
      if (requiereFondoMinimo(caja.slug) && (form.fondo_fijo || 0) <= 0) {
        setMsg('Indicá el fondo de caja (efectivo que permanece en la caja).')
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
          id_planilla: idPlanilla
        },
        calc
      )
      await saveCierre({
        ...payload,
        id: editId ?? undefined,
        estado_cierre: (editId ? estadoCierre : 'abierto') as CajaCierreEstadoCierre,
        fecha_hasta: fecha
      })
      onSaved()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleCerrarDefinitivo = async () => {
    if (!editId) {
      setMsg('Guardá el cierre primero, luego cerralo definitivamente.')
      return
    }
    if (!confirm('¿Cerrar definitivamente? Se guardará un snapshot y no podrás editar movimientos vinculados.')) {
      return
    }
    setCerrando(true)
    setMsg(null)
    try {
      const observado = calc.estado === 'REVISAR'
      const cerrado = await cerrarCierreDefinitivo(editId, movimientos, { observado, tolerancia })
      setEstadoCierre(observado ? 'observado' : 'cerrado')
      setSnapshot(cerrado.snapshot_totales ?? null)
      void Promise.all([listMovimientos(), listMovimientosPorCierre(editId)]).then(([m, v]) => {
        setMovimientos(m)
        setMovsVinculados(v)
      })
      const snap = cerrado.snapshot_totales as { movimientos_vinculados?: number } | null
      setMsg(`Cierre cerrado. ${snap?.movimientos_vinculados ?? 0} movimiento(s) vinculados.`)
      onSaved()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al cerrar')
    } finally {
      setCerrando(false)
    }
  }

  const resultClass =
    calc.estado === 'OK' ? (calc.dif_total === 0 ? 'neutral' : 'ok') : 'bad'

  return (
    <form className="caja-cc-cierre-form" onSubmit={(e) => void handleSubmit(e)}>
      <header className="caja-cc-cierre-page-head">
        <div>
          <h2>{editId ? 'Editar cierre' : 'Nuevo cierre'}</h2>
          <p className="caja-cc-sub">
            Completá fecha y caja, precargá si tenés planilla o movimientos del día, y guardá el borrador.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-small" onClick={onCancel}>
          Volver a cierres
        </button>
      </header>

      {bloqueado && snapshot && <CajaCierreSnapshotPanel snapshot={snapshot} />}

      {msg && (
        <p className={msg.includes('Error') || msg.includes('debe') ? 'caja-cc-error' : 'caja-cc-ok'}>{msg}</p>
      )}

      <fieldset className="caja-cc-fieldset" disabled={bloqueado}>
        {!bloqueado && (
          <CajaCollapsibleCard title="Paso 1 — Precarga (opcional)" defaultOpen={!editId}>
            <p className="caja-cc-sub caja-cc-cierre-paso-lead">
              Podés traer montos desde movimientos del día o desde la planilla PDF. Después completás efectivo
              contado y cupones en los pasos siguientes.
            </p>
            <div className="caja-cc-cierre-precarga-btns">
              <button type="button" className="btn-primary btn-small" onClick={() => void cargarDesdePlotLab()}>
                Desde ventas PlotLab
              </button>
              <button type="button" className="btn-secondary btn-small" onClick={() => void cargarDesdeMovimientos()}>
                Desde movimientos del día
              </button>
              <button type="button" className="btn-secondary btn-small" onClick={() => void cargarDesdePlanilla()}>
                Desde planilla PDF
              </button>
              <button type="button" className="btn-secondary btn-small" onClick={() => void cargarEgresosAprobados()}>
                Egresos aprobados
              </button>
            </div>
            {onIrSubirPdf ? <CajaAvisoPdfUnico onIr={onIrSubirPdf} destinoLabel="Cierres" /> : null}
            {planillaActiva && (
              <p className="caja-cc-help">
                Planilla leída: <strong>{planillaActiva.archivo_nombre}</strong> —{' '}
                <button type="button" className="btn-link" onClick={cargarPlanillaActiva}>
                  usar en este cierre
                </button>
              </p>
            )}
          </CajaCollapsibleCard>
        )}

        <CajaCollapsibleCard title="Paso 2 — Identificación" defaultOpen>
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
            Operador
            <input
              type="text"
              value={cajera}
              onChange={(e) => setCajera(e.target.value)}
              placeholder="Nombre del operador de caja"
            />
          </label>
          <label className="caja-cc-field">
            Email del listado recibido
            <select value={emailOk} onChange={(e) => setEmailOk(e.target.value as 'Sí' | 'No')}>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </label>
        </div>
        </CajaCollapsibleCard>

        <CajaCollapsibleCard title="Paso 3 — Efectivo" defaultOpen>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fondo de caja <span className="caja-cc-tag cfg">real · editable</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.fondo_fijo || ''}
              onChange={(e) => setNum('fondo_fijo', e.target.value)}
            />
            {cajaActiva && requiereFondoMinimo(cajaActiva.slug) && (
              <span className="caja-cc-field-hint">
                Efectivo que permanece en caja. Recomendado $ {fmtArs(FONDO_CAJA_RECOMENDADO)}; podés cambiarlo según
                tu operación.
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
        </CajaCollapsibleCard>

        <CajaCollapsibleCard title="Paso 4 — Tarjetas y POSNET">
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
        </CajaCollapsibleCard>

        <CajaCollapsibleCard title="Paso 5 — Otros canales (informativo)">
          <p className="caja-cc-sub">MP y transferencias se concilian en sus secciones del menú.</p>
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
        </CajaCollapsibleCard>

        <CajaCollapsibleCard title="Resultado del cierre" defaultOpen>
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
          <label className="caja-cc-field">
            Observación
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
          </label>
        </CajaCollapsibleCard>
      </fieldset>

      {bloqueado && (
        <p className="caja-cc-help">
          Este cierre está <strong>{estadoCierre}</strong>.{' '}
          {movsVinculados.length > 0
            ? `${movsVinculados.length} movimiento(s) vinculados y bloqueados para edición.`
            : 'Los movimientos del período ya no se pueden modificar.'}
        </p>
      )}

      <div className="caja-cc-actions caja-cc-cierre-actions">
        <button type="submit" className="btn-primary" disabled={saving || bloqueado}>
          {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Guardar borrador'}
        </button>
        {editId && !bloqueado && (
          <button
            type="button"
            className="btn-primary"
            disabled={cerrando}
            onClick={() => void handleCerrarDefinitivo()}
          >
            {cerrando ? 'Cerrando…' : 'Cerrar definitivamente'}
          </button>
        )}
      </div>
    </form>
  )
}
