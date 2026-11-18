import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  FRECUENCIAS,
  FRECUENCIA_LABEL,
  aplicaEnPeriodo,
  anularPagoGastoFijo,
  eliminarGastoFijo,
  equivalenteMensual,
  guardarGastoFijo,
  labelPeriodo,
  listCategoriasGastos,
  listGastosFijos,
  listPagosGastosFijos,
  registrarPagoGastoFijo,
  sumarMeses,
  vencimientoEnPeriodo,
  type Frecuencia,
  type GastoFijo,
  type GastoFijoInput,
  type PagoGastoFijo
} from '../services/erpGastosFijosApi'
import { fmtFecha, fmtMoney, hoyIso, periodoActual } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Débito automático', 'Tarjeta', 'Cheque', 'Mercado Pago', 'Otro'] as const

type Form = Omit<GastoFijoInput, 'monto' | 'dia_vencimiento'> & { monto: string; dia_vencimiento: string }

type PagoForm = { id_gasto_fijo: number; fecha: string; total: string; metodo_pago: string; observaciones: string }

type Estado = 'pagado' | 'vencido' | 'por_vencer' | 'pendiente'

const vacio = (): Form => ({
  concepto: '',
  categoria: null,
  proveedor: null,
  proveedor_cuit: null,
  numero_suministro: null,
  monto: '',
  moneda: 'ARS',
  frecuencia: 'mensual',
  mes_inicio: periodoActual(),
  mes_fin: null,
  dia_vencimiento: '10',
  metodo_pago: 'Transferencia',
  centro_costo: null,
  activo: true,
  observaciones: null
})

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function aForm(g: GastoFijo): Form {
  return { ...g, monto: String(g.monto), dia_vencimiento: String(g.dia_vencimiento) }
}

function numero(v: string): number | null {
  const s = String(v).trim().replace(/\s|\$/g, '')
  if (!s) return null
  // "1.234,56" (formato AR) o "1234.56"
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : null
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00`) - Date.parse(`${desde}T00:00:00`)) / 86400000)
}

export default function ErpGastosFijosPage() {
  const navigate = useNavigate()
  const [gastos, setGastos] = useState<GastoFijo[]>([])
  const [pagos, setPagos] = useState<PagoGastoFijo[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [periodo, setPeriodo] = useState(periodoActual())
  const [form, setForm] = useState<Form | null>(null)
  const [pagoForm, setPagoForm] = useState<PagoForm | null>(null)
  const [verInactivos, setVerInactivos] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingPagos, setLoadingPagos] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  /** Evita que una respuesta vieja pise el mes que el usuario ya eligió. */
  const pagosReqId = useRef(0)

  const hoy = hoyIso()

  const cargarGastos = async () => {
    const r = await listGastosFijos()
    if (r.success) setGastos(r.data)
    else setMsg({ tipo: 'error', texto: r.error })
  }

  const cargarPagos = async (p: string) => {
    const req = ++pagosReqId.current
    setLoadingPagos(true)
    const r = await listPagosGastosFijos(p, p)
    if (req !== pagosReqId.current) return
    if (r.success) setPagos(r.data)
    else setMsg({ tipo: 'error', texto: r.error })
    setLoadingPagos(false)
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await cargarGastos()
      setLoading(false)
    })()
    void listCategoriasGastos().then((r) => r.success && setCategorias(r.data))
  }, [])

  useEffect(() => {
    setPagoForm(null)
    // Limpia al instante para que no queden estados/pagos del mes anterior.
    setPagos([])
    void cargarPagos(periodo)
  }, [periodo])

  const filasMes = useMemo(() => {
    return gastos
      .filter((g) => g.activo && aplicaEnPeriodo(g, periodo))
      .map((g) => {
        const vence = vencimientoEnPeriodo(g.dia_vencimiento, periodo)
        const pago =
          pagos.find(
            (p) => Number(p.id_gasto_fijo) === Number(g.id) && String(p.periodo_fijo) === periodo
          ) ?? null
        let estado: Estado = 'pendiente'
        if (pago) estado = 'pagado'
        else if (vence < hoy) estado = 'vencido'
        else if (diasEntre(hoy, vence) <= 5) estado = 'por_vencer'
        return { g, vence, pago, estado }
      })
      // Primero lo que falta pagar (el vencimiento más próximo arriba); los pagados al final.
      .sort(
        (a, b) =>
          Number(!!a.pago) - Number(!!b.pago) ||
          a.vence.localeCompare(b.vence) ||
          a.g.concepto.localeCompare(b.g.concepto)
      )
  }, [gastos, pagos, periodo, hoy])

  const kpis = useMemo(() => {
    const previsto = filasMes.reduce((s, f) => s + f.g.monto, 0)
    const pagado = filasMes.reduce((s, f) => s + (f.pago?.total ?? 0), 0)
    const pendiente = filasMes.filter((f) => !f.pago).reduce((s, f) => s + f.g.monto, 0)
    const vencidos = filasMes.filter((f) => f.estado === 'vencido').length
    const mensualEq = gastos.filter((g) => g.activo).reduce((s, g) => s + equivalenteMensual(g), 0)
    return { previsto, pagado, pendiente, vencidos, mensualEq }
  }, [filasMes, gastos])

  /** Vencimiento del mes elegido en la barra (cambia con las flechas; no “salta” al próximo impago). */
  const vencDelMes = useMemo(() => {
    const m = new Map<number, { fecha: string | null; pagado: boolean; aplica: boolean }>()
    for (const g of gastos) {
      const aplica = aplicaEnPeriodo(g, periodo)
      const fecha = aplica ? vencimientoEnPeriodo(g.dia_vencimiento, periodo) : null
      const pagado =
        !!fecha &&
        pagos.some((x) => Number(x.id_gasto_fijo) === Number(g.id) && String(x.periodo_fijo) === periodo)
      m.set(g.id, { fecha, pagado, aplica })
    }
    return m
  }, [gastos, pagos, periodo])

  const catalogo = useMemo(
    () =>
      gastos
        .filter((g) => verInactivos || g.activo)
        .sort((a, b) => {
          if (a.activo !== b.activo) return a.activo ? -1 : 1
          const va = vencDelMes.get(a.id)
          const vb = vencDelMes.get(b.id)
          // Primero los que vencen este mes; pagados al final del grupo.
          const rank = (v?: { fecha: string | null; pagado: boolean; aplica: boolean }) => {
            if (!v?.aplica || !v.fecha) return '3'
            if (v.pagado) return `2-${v.fecha}`
            return `1-${v.fecha}`
          }
          return rank(va).localeCompare(rank(vb)) || a.concepto.localeCompare(b.concepto)
        }),
    [gastos, verInactivos, vencDelMes]
  )

  const guardar = async () => {
    if (!form) return
    const monto = numero(form.monto)
    const dia = Number(form.dia_vencimiento)
    if (!form.concepto.trim()) return setMsg({ tipo: 'error', texto: 'El concepto es obligatorio.' })
    if (monto == null || monto < 0) return setMsg({ tipo: 'error', texto: 'Ingresá un monto válido.' })
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return setMsg({ tipo: 'error', texto: 'El día de vencimiento va de 1 a 31.' })
    if (!/^\d{4}-\d{2}$/.test(form.mes_inicio)) return setMsg({ tipo: 'error', texto: 'Indicá desde qué mes rige.' })
    if (form.mes_fin && form.mes_fin < form.mes_inicio)
      return setMsg({ tipo: 'error', texto: 'El mes de fin no puede ser anterior al de inicio.' })
    const limpio = (s: string | null) => (s && s.trim() ? s.trim() : null)
    setBusy(true)
    const r = await guardarGastoFijo({
      ...form,
      concepto: form.concepto.trim(),
      categoria: limpio(form.categoria),
      proveedor: limpio(form.proveedor),
      proveedor_cuit: limpio(form.proveedor_cuit),
      numero_suministro: limpio(form.numero_suministro),
      centro_costo: limpio(form.centro_costo),
      observaciones: limpio(form.observaciones),
      mes_fin: form.mes_fin || null,
      monto,
      dia_vencimiento: dia
    })
    setBusy(false)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `Gasto fijo "${r.data.concepto}" guardado.` })
    setForm(null)
    void cargarGastos()
  }

  const eliminar = async (g: { id: number; concepto: string }) => {
    if (!window.confirm(`¿Eliminar el gasto fijo "${g.concepto}"? Los pagos ya registrados quedan en Gastos como gastos comunes.`)) return
    const r = await eliminarGastoFijo(g.id)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `"${g.concepto}" eliminado.` })
    setForm(null)
    void cargarGastos()
  }

  const alternarActivo = async (g: GastoFijo) => {
    const { id, ...resto } = g
    const r = await guardarGastoFijo({ id, ...resto, activo: !g.activo })
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    void cargarGastos()
  }

  const pagoDelPeriodo = (idGasto: number) =>
    pagos.find((p) => Number(p.id_gasto_fijo) === Number(idGasto) && String(p.periodo_fijo) === periodo) ??
    null

  const abrirPago = (g: GastoFijo) => {
    if (pagoDelPeriodo(g.id)) {
      setMsg({ tipo: 'error', texto: `Ya hay un pago de "${g.concepto}" en ${labelPeriodo(periodo)}. Anulalo si necesitás corregirlo.` })
      return
    }
    setPagoForm({
      id_gasto_fijo: g.id,
      fecha: hoy,
      total: String(g.monto),
      metodo_pago: g.metodo_pago || 'Transferencia',
      observaciones: ''
    })
  }

  const confirmarPago = async () => {
    if (!pagoForm) return
    const g = gastos.find((x) => x.id === pagoForm.id_gasto_fijo)
    const total = numero(pagoForm.total)
    if (!g) return
    if (pagoDelPeriodo(g.id)) {
      setMsg({ tipo: 'error', texto: `Ese período ya tiene un pago registrado para "${g.concepto}".` })
      setPagoForm(null)
      return
    }
    if (total == null || total <= 0) return setMsg({ tipo: 'error', texto: 'Ingresá el monto pagado.' })
    if (!pagoForm.fecha) return setMsg({ tipo: 'error', texto: 'Indicá la fecha de pago.' })
    setBusy(true)
    const r = await registrarPagoGastoFijo(g, periodo, {
      fecha: pagoForm.fecha,
      total,
      metodo_pago: pagoForm.metodo_pago || null,
      observaciones: pagoForm.observaciones.trim() || null
    })
    setBusy(false)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `Pago de "${g.concepto}" registrado en Gastos (${labelPeriodo(periodo)}).` })
    setPagoForm(null)
    // Actualización optimista: el botón pasa a «Anular» sin esperar el refetch.
    setPagos((prev) => {
      const row: PagoGastoFijo = {
        id: Number(r.data.id),
        id_gasto_fijo: Number(r.data.id_gasto_fijo ?? g.id),
        periodo_fijo: String(r.data.periodo_fijo || periodo),
        fecha_gasto: String(r.data.fecha_gasto || pagoForm.fecha),
        total: Number(r.data.total) || total,
        metodo_pago: r.data.metodo_pago ?? pagoForm.metodo_pago
      }
      const sinDup = prev.filter(
        (p) => !(Number(p.id_gasto_fijo) === row.id_gasto_fijo && String(p.periodo_fijo) === row.periodo_fijo)
      )
      return [...sinDup, row]
    })
    void cargarPagos(periodo)
  }

  const anularPago = async (g: GastoFijo, pago: PagoGastoFijo) => {
    if (!window.confirm(`¿Anular el pago de "${g.concepto}" de ${labelPeriodo(periodo)}? Se borra el gasto de ${fmtMoney(pago.total)}.`)) return
    setBusy(true)
    const r = await anularPagoGastoFijo(pago.id)
    setBusy(false)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `Pago de "${g.concepto}" anulado.` })
    setPagos((prev) => prev.filter((p) => Number(p.id) !== Number(pago.id)))
    setPagoForm((pf) => (pf?.id_gasto_fijo === g.id ? null : pf))
    void cargarPagos(periodo)
  }

  const estadoPill = (estado: Estado, pago: PagoGastoFijo | null) => {
    if (estado === 'pagado' && pago) return <span className="erp-pill ok">Pagado {fmtFecha(pago.fecha_gasto)}</span>
    if (estado === 'vencido') return <span className="erp-pill danger">Vencido</span>
    if (estado === 'por_vencer') return <span className="erp-pill warn">Por vencer</span>
    return <span className="erp-pill">Pendiente</span>
  }

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="📌"
        titulo="Gastos fijos"
        subtitulo="Alquiler, servicios, sueldos, seguros y abonos: vencimientos del mes y registro de pagos."
        volverA="/erp"
        volverTexto="ERP"
      >
        <button type="button" className="btn-secondary" onClick={() => navigate('/erp/gastos')}>
          Ver Gastos
        </button>
        <button type="button" className="btn-primary" onClick={() => setForm(vacio())}>
          + Nuevo gasto fijo
        </button>
      </ErpPageHeader>

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      {form && (
        <div className="erp-panel">
          <h2>{form.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Concepto *</span>
              <input
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Alquiler local, Luz, Internet…"
                autoFocus
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Categoría</span>
              <input
                list="gf-categorias"
                value={form.categoria ?? ''}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
              <datalist id="gf-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Proveedor</span>
              <input value={form.proveedor ?? ''} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">CUIT proveedor</span>
              <input value={form.proveedor_cuit ?? ''} onChange={(e) => setForm({ ...form, proveedor_cuit: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Nº de suministro</span>
              <input
                value={form.numero_suministro ?? ''}
                onChange={(e) => setForm({ ...form, numero_suministro: e.target.value })}
                placeholder="Cliente / medidor / NIS…"
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Monto estimado *</span>
              <input inputMode="decimal" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0,00" />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Frecuencia</span>
              <select value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value as Frecuencia })}>
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {FRECUENCIA_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Día de vencimiento</span>
              <input
                type="number"
                min="1"
                max="31"
                value={form.dia_vencimiento}
                onChange={(e) => setForm({ ...form, dia_vencimiento: e.target.value })}
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Rige desde (primer vencimiento)</span>
              <input type="month" value={form.mes_inicio} onChange={(e) => setForm({ ...form, mes_inicio: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Hasta (opcional)</span>
              <input type="month" value={form.mes_fin ?? ''} onChange={(e) => setForm({ ...form, mes_fin: e.target.value || null })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Medio de pago habitual</span>
              <select value={form.metodo_pago ?? ''} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value || null })}>
                <option value="">—</option>
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Centro de costo</span>
              <input value={form.centro_costo ?? ''} onChange={(e) => setForm({ ...form, centro_costo: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Estado</span>
              <select value={form.activo ? 'si' : 'no'} onChange={(e) => setForm({ ...form, activo: e.target.value === 'si' })}>
                <option value="si">Activo</option>
                <option value="no">Inactivo</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Observaciones</span>
              <input value={form.observaciones ?? ''} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </label>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void guardar()}>
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setForm(null)}>
              Cancelar
            </button>
            {form.id ? (
              <button type="button" className="btn-secondary" onClick={() => void eliminar({ id: form.id!, concepto: form.concepto })}>
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="erp-panel">
        <h2>
          Vencimientos de {labelPeriodo(periodo)}
          {loadingPagos ? <span className="erp-muted"> · actualizando…</span> : null}
        </h2>
        <div className="erp-toolbar">
          <button type="button" className="btn-secondary" onClick={() => setPeriodo((p) => sumarMeses(p, -1))}>
            ← Mes anterior
          </button>
          <label className="erp-field">
            <span className="erp-field__label">Mes</span>
            <input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={() => setPeriodo((p) => sumarMeses(p, 1))}>
            Mes siguiente →
          </button>
          {periodo !== periodoActual() && (
            <button type="button" className="btn-secondary" onClick={() => setPeriodo(periodoActual())}>
              Hoy
            </button>
          )}
        </div>

        <div className="erp-kpi">
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{fmtMoney(kpis.previsto)}</div>
            <div className="erp-kpi-label">Previsto del mes ({filasMes.length})</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{fmtMoney(kpis.pagado)}</div>
            <div className="erp-kpi-label">Pagado</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{fmtMoney(kpis.pendiente)}</div>
            <div className="erp-kpi-label">Pendiente{kpis.vencidos ? ` · ${kpis.vencidos} vencido(s)` : ''}</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{fmtMoney(kpis.mensualEq)}</div>
            <div className="erp-kpi-label">Costo fijo mensual equivalente</div>
          </div>
        </div>

        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : filasMes.length === 0 ? (
          <p className="erp-muted">
            {gastos.length === 0 ? 'Todavía no cargaste gastos fijos.' : 'No hay gastos fijos que venzan este mes.'}
          </p>
        ) : (
          <div className="erp-table-wrap" style={{ marginTop: 12 }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Vence</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th className="erpx-right">Previsto</th>
                  <th className="erpx-right">Pagado</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filasMes.map(({ g, vence, pago, estado }) => (
                  <tr key={g.id}>
                    <td>{fmtFecha(vence)}</td>
                    <td>
                      {g.concepto}
                      {g.proveedor ? <span className="erp-muted"> · {g.proveedor}</span> : null}
                    </td>
                    <td>
                      <CategoriaSuministro
                        categoria={g.categoria}
                        numero={g.numero_suministro}
                        onCopiado={(ok) =>
                          setMsg({
                            tipo: ok ? 'ok' : 'error',
                            texto: ok ? 'Nº de suministro copiado.' : 'No se pudo copiar.'
                          })
                        }
                      />
                    </td>
                    <td className="erpx-right">{fmtMoney(g.monto)}</td>
                    <td className="erpx-right">{pago ? fmtMoney(pago.total) : '—'}</td>
                    <td>{estadoPill(estado, pago)}</td>
                    <td>
                      <div className="erp-section-actions">
                        {pago ? (
                          <button type="button" className="erpx-btn-sm" onClick={() => void anularPago(g, pago)}>
                            Anular pago
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="erpx-btn-sm"
                            disabled={busy}
                            onClick={() => abrirPago(g)}
                          >
                            Registrar pago
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagoForm && (
          <div className="erp-panel" style={{ marginTop: 12 }}>
            <h2>
              Pago de {gastos.find((x) => x.id === pagoForm.id_gasto_fijo)?.concepto} · {labelPeriodo(periodo)}
            </h2>
            <div className="erpx-form">
              <label className="erp-field">
                <span className="erp-field__label">Fecha de pago</span>
                <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} />
              </label>
              <label className="erp-field">
                <span className="erp-field__label">Monto pagado</span>
                <input inputMode="decimal" value={pagoForm.total} onChange={(e) => setPagoForm({ ...pagoForm, total: e.target.value })} />
              </label>
              <label className="erp-field">
                <span className="erp-field__label">Medio de pago</span>
                <select value={pagoForm.metodo_pago} onChange={(e) => setPagoForm({ ...pagoForm, metodo_pago: e.target.value })}>
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="erp-field">
                <span className="erp-field__label">Observaciones</span>
                <input value={pagoForm.observaciones} onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })} />
              </label>
            </div>
            <p className="erp-muted">Se registra como un gasto en la sección Gastos, vinculado a este gasto fijo y período.</p>
            <div className="erpx-actions">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void confirmarPago()}>
                Registrar pago
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPagoForm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="erp-panel" key={`catalogo-${periodo}`}>
        <h2>
          Gastos fijos cargados <small className="erp-muted">· {labelPeriodo(periodo)}</small>
        </h2>
        <div className="erp-toolbar">
          <label className="erpx-checks" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            <span>Mostrar inactivos</span>
          </label>
        </div>
        {catalogo.length === 0 ? (
          <p className="erp-muted">{loading ? 'Cargando…' : 'Sin gastos fijos. Usá "+ Nuevo gasto fijo" para cargar el primero.'}</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Venc. del mes</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Frecuencia</th>
                  <th>Día</th>
                  <th className="erpx-right">Monto</th>
                  <th className="erpx-right">Equiv. mensual</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {catalogo.map((g) => {
                  const v = vencDelMes.get(g.id)
                  return (
                  <tr key={`${g.id}-${periodo}-${v?.fecha ?? 'na'}-${v?.pagado ? 'p' : 'x'}`}>
                    <td>
                      {!g.activo || !v?.aplica || !v.fecha ? (
                        <span className="erp-muted">No vence</span>
                      ) : (
                        <span
                          className={
                            v.pagado ? 'erp-pill ok' : v.fecha < hoy ? 'erp-pill danger' : undefined
                          }
                        >
                          {fmtFecha(v.fecha)}
                          {v.pagado ? ' · pagado' : ''}
                        </span>
                      )}
                    </td>
                    <td>
                      {g.concepto}
                      {g.proveedor ? <span className="erp-muted"> · {g.proveedor}</span> : null}
                    </td>
                    <td>
                      <CategoriaSuministro
                        categoria={g.categoria}
                        numero={g.numero_suministro}
                        onCopiado={(ok) =>
                          setMsg({
                            tipo: ok ? 'ok' : 'error',
                            texto: ok ? 'Nº de suministro copiado.' : 'No se pudo copiar.'
                          })
                        }
                      />
                    </td>
                    <td>{FRECUENCIA_LABEL[g.frecuencia]}</td>
                    <td>Día {g.dia_vencimiento}</td>
                    <td className="erpx-right">{fmtMoney(g.monto)}</td>
                    <td className="erpx-right">{fmtMoney(equivalenteMensual(g))}</td>
                    <td>
                      {labelPeriodo(g.mes_inicio)}
                      {g.mes_fin ? ` → ${labelPeriodo(g.mes_fin)}` : ' → sin fin'}
                    </td>
                    <td>
                      <span className={`erp-pill ${g.activo ? 'ok' : 'warn'}`}>{g.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td>
                      <div className="erp-section-actions">
                        <button type="button" className="erpx-btn-sm" onClick={() => setForm(aForm(g))}>
                          Editar
                        </button>
                        <button type="button" className="erpx-btn-sm" onClick={() => void alternarActivo(g)}>
                          {g.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CategoriaSuministro({
  categoria,
  numero,
  onCopiado
}: {
  categoria: string | null
  numero: string | null
  onCopiado: (ok: boolean) => void
}) {
  const nro = (numero || '').trim()
  return (
    <div className="gf-cat-suministro">
      <span>{categoria || '—'}</span>
      {nro ? (
        <span className="gf-suministro">
          <span className="erp-muted">Nº {nro}</span>
          <button
            type="button"
            className="erpx-btn-sm gf-suministro__copy"
            title="Copiar nº de suministro"
            onClick={() => void copiarTexto(nro).then(onCopiado)}
          >
            Copiar
          </button>
        </span>
      ) : null}
    </div>
  )
}
