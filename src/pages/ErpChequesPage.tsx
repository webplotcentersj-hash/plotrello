import { Fragment, useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  TRANSICIONES_CHEQUE,
  cambiarEstadoCheque,
  crearCheque,
  listChequesConHistorial,
  listClientesBasicos,
  listCuentasBancarias,
  listProveedoresBasicos,
  nombreCliente,
  type Cheque,
  type ClienteBasico,
  type CuentaBancariaBasica,
  type EstadoCheque,
  type HistorialCheque,
  type NuevoCheque
} from '../services/erpContableApi'
import { fmtFecha, fmtMoney, hoyIso } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

type Proveedor = { id: number; nombre: string | null; razon_social: string | null; cuit: string | null }

const vacio = (tipo: Cheque['tipo']): NuevoCheque => ({
  tipo,
  es_echeq: false,
  numero: '',
  banco: null,
  sucursal: null,
  librador_nombre: null,
  librador_cuit: null,
  importe: 0,
  fecha_emision: hoyIso(),
  fecha_pago: hoyIso(),
  id_cliente: null,
  id_proveedor: null,
  tercero_nombre: null,
  id_cuenta_bancaria: null,
  observaciones: null
})

const PILL: Partial<Record<EstadoCheque, string>> = {
  'En cartera': 'warn',
  Emitido: 'warn',
  Depositado: 'warn',
  Entregado: 'warn',
  Cobrado: 'ok',
  Debitado: 'ok',
  Endosado: 'ok',
  Rechazado: 'danger',
  Anulado: 'danger'
}

type Accion = { cheque: Cheque; nuevo: EstadoCheque }

export default function ErpChequesPage() {
  const [tipo, setTipo] = useState<Cheque['tipo']>('Tercero')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | EstadoCheque>('')
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [historiales, setHistoriales] = useState<Record<number, HistorialCheque[]>>({})
  const [verHistorial, setVerHistorial] = useState<number | null>(null)
  const [form, setForm] = useState<NuevoCheque>(() => vacio('Tercero'))
  const [mostrarForm, setMostrarForm] = useState(false)
  const [clientes, setClientes] = useState<ClienteBasico[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancariaBasica[]>([])
  const [accion, setAccion] = useState<Accion | null>(null)
  const [datosAccion, setDatosAccion] = useState({ fecha: hoyIso(), id_cuenta_bancaria: '', id_proveedor: '', tercero_nombre: '', motivo: '', detalle: '' })
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const r = await listChequesConHistorial()
    if (r.success) {
      setCheques(r.data.cheques)
      setHistoriales(r.data.historiales)
    } else setMsg({ tipo: 'error', texto: r.error })
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
    void Promise.all([listClientesBasicos(), listProveedoresBasicos(), listCuentasBancarias()]).then(([c, p, b]) => {
      if (c.success) setClientes(c.data)
      if (p.success) setProveedores(p.data)
      if (b.success) setCuentas(b.data.filter((x) => x.activa))
    })
  }, [])

  const visibles = useMemo(
    () => cheques.filter((c) => c.tipo === tipo && (!estadoFiltro || c.estado === estadoFiltro)),
    [cheques, tipo, estadoFiltro]
  )

  const kpis = useMemo(() => {
    const hoy = hoyIso()
    const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const activos = cheques.filter((c) => c.tipo === tipo && (tipo === 'Tercero' ? c.estado === 'En cartera' : ['Emitido', 'Entregado'].includes(c.estado)))
    return {
      activos: activos.length,
      monto: activos.reduce((s, c) => s + c.importe, 0),
      proximos: activos.filter((c) => c.fecha_pago >= hoy && c.fecha_pago <= en7).length,
      vencidos: activos.filter((c) => c.fecha_pago < hoy).length,
      rechazados: cheques.filter((c) => c.tipo === tipo && c.estado === 'Rechazado').length
    }
  }, [cheques, tipo])

  const set = <K extends keyof NuevoCheque>(k: K, v: NuevoCheque[K]) => setForm((f) => ({ ...f, [k]: v }))

  const guardar = async () => {
    setMsg(null)
    if (!form.numero.trim()) return setMsg({ tipo: 'error', texto: 'Ingresá el número del cheque.' })
    if (!(form.importe > 0)) return setMsg({ tipo: 'error', texto: 'El importe debe ser mayor a cero.' })
    if (form.fecha_pago < form.fecha_emision) return setMsg({ tipo: 'error', texto: 'La fecha de pago no puede ser anterior a la emisión.' })
    const r = await crearCheque({ ...form, numero: form.numero.trim() })
    if (!r.success) {
      const dup = /duplicate|unique|erp_cheques_tipo_banco_numero/i.test(r.error)
      return setMsg({ tipo: 'error', texto: dup ? 'Ya existe un cheque con ese número y banco.' : r.error })
    }
    setMsg({ tipo: 'ok', texto: 'Cheque registrado.' })
    setForm(vacio(tipo))
    setMostrarForm(false)
    void cargar()
  }

  const abrirAccion = (cheque: Cheque, nuevo: EstadoCheque) => {
    setAccion({ cheque, nuevo })
    setDatosAccion({ fecha: hoyIso(), id_cuenta_bancaria: String(cheque.id_cuenta_bancaria ?? ''), id_proveedor: '', tercero_nombre: '', motivo: '', detalle: '' })
  }

  const confirmarAccion = async () => {
    if (!accion) return
    const prov = proveedores.find((p) => String(p.id) === datosAccion.id_proveedor)
    const r = await cambiarEstadoCheque(accion.cheque, accion.nuevo, {
      fecha: datosAccion.fecha,
      detalle: datosAccion.detalle,
      id_cuenta_bancaria: datosAccion.id_cuenta_bancaria ? Number(datosAccion.id_cuenta_bancaria) : null,
      id_proveedor: prov?.id ?? null,
      tercero_nombre: datosAccion.tercero_nombre || (prov ? prov.razon_social || prov.nombre : null),
      motivo_rechazo: datosAccion.motivo
    })
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `Cheque ${accion.cheque.numero}: ${accion.nuevo.toLowerCase()}.` })
    setAccion(null)
    void cargar()
  }

  const nombreTercero = (c: Cheque) => {
    if (c.tercero_nombre) return c.tercero_nombre
    const cli = clientes.find((x) => x.id === c.id_cliente)
    return cli ? nombreCliente(cli, cli.id) : '—'
  }

  const siguientes = (c: Cheque): EstadoCheque[] => TRANSICIONES_CHEQUE[c.tipo][c.estado] ?? []

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🏦"
        titulo="Cheques"
        subtitulo="Cartera de terceros y cheques propios: depósito, endoso, cobro, rechazo, con historial."
        volverA="/erp/tesoreria"
        volverTexto="Tesorería"
      >
        <button type="button" className="btn-primary" onClick={() => { setForm(vacio(tipo)); setMostrarForm((v) => !v) }}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo cheque'}
        </button>
      </ErpPageHeader>

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      <div className="erpx-tabs">
        {(['Tercero', 'Propio'] as const).map((t) => (
          <button key={t} type="button" className={`erpx-tab ${tipo === t ? 'is-active' : ''}`} onClick={() => { setTipo(t); setEstadoFiltro('') }}>
            {t === 'Tercero' ? 'Cartera (de terceros)' : 'Propios'}
          </button>
        ))}
      </div>

      <div className="erp-panel">
        <div className="erp-kpi">
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{kpis.activos}</div>
            <div className="erp-kpi-label">{tipo === 'Tercero' ? 'En cartera' : 'Emitidos / entregados'}</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{fmtMoney(kpis.monto)}</div>
            <div className="erp-kpi-label">Monto</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{kpis.proximos}</div>
            <div className="erp-kpi-label">Vencen en 7 días</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{kpis.vencidos}</div>
            <div className="erp-kpi-label">Con fecha de pago vencida</div>
          </div>
          <div className="erp-kpi-item">
            <div className="erp-kpi-value">{kpis.rechazados}</div>
            <div className="erp-kpi-label">Rechazados</div>
          </div>
        </div>
      </div>

      {mostrarForm && (
        <div className="erp-panel">
          <h2>Nuevo cheque {tipo === 'Tercero' ? 'recibido' : 'propio'}</h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Tipo</span>
              <select value={form.tipo} onChange={(e) => { const t = e.target.value as Cheque['tipo']; setTipo(t); setForm(vacio(t)) }}>
                <option value="Tercero">De terceros</option>
                <option value="Propio">Propio</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Modalidad</span>
              <select value={form.es_echeq ? 'echeq' : 'papel'} onChange={(e) => set('es_echeq', e.target.value === 'echeq')}>
                <option value="papel">Cheque en papel</option>
                <option value="echeq">E-cheq</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Número</span>
              <input value={form.numero} onChange={(e) => set('numero', e.target.value)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Banco</span>
              <input value={form.banco ?? ''} onChange={(e) => set('banco', e.target.value)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Importe</span>
              <input type="number" min="0" step="0.01" value={form.importe || ''} onChange={(e) => set('importe', Number(e.target.value) || 0)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Fecha de emisión</span>
              <input type="date" value={form.fecha_emision} onChange={(e) => set('fecha_emision', e.target.value)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Fecha de pago</span>
              <input type="date" value={form.fecha_pago} onChange={(e) => set('fecha_pago', e.target.value)} />
            </label>
            {form.tipo === 'Tercero' ? (
              <>
                <label className="erp-field">
                  <span className="erp-field__label">Recibido de (cliente)</span>
                  <select value={String(form.id_cliente ?? '')} onChange={(e) => set('id_cliente', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— sin vincular —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nombreCliente(c, c.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="erp-field">
                  <span className="erp-field__label">Librador</span>
                  <input value={form.librador_nombre ?? ''} onChange={(e) => set('librador_nombre', e.target.value)} />
                </label>
                <label className="erp-field">
                  <span className="erp-field__label">CUIT librador</span>
                  <input value={form.librador_cuit ?? ''} onChange={(e) => set('librador_cuit', e.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label className="erp-field">
                  <span className="erp-field__label">Cuenta bancaria</span>
                  <select value={String(form.id_cuenta_bancaria ?? '')} onChange={(e) => set('id_cuenta_bancaria', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— elegir —</option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                        {c.banco ? ` · ${c.banco}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="erp-field">
                  <span className="erp-field__label">Beneficiario</span>
                  <input value={form.tercero_nombre ?? ''} onChange={(e) => set('tercero_nombre', e.target.value)} />
                </label>
              </>
            )}
            <label className="erp-field erp-field--wide">
              <span className="erp-field__label">Observaciones</span>
              <input value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} />
            </label>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" onClick={() => void guardar()}>
              Guardar cheque
            </button>
          </div>
        </div>
      )}

      {accion && (
        <div className="erp-panel">
          <h2>
            Cheque {accion.cheque.numero} → {accion.nuevo}
          </h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Fecha</span>
              <input type="date" value={datosAccion.fecha} onChange={(e) => setDatosAccion((d) => ({ ...d, fecha: e.target.value }))} />
            </label>
            {accion.nuevo === 'Depositado' && (
              <label className="erp-field">
                <span className="erp-field__label">Cuenta de depósito</span>
                <select value={datosAccion.id_cuenta_bancaria} onChange={(e) => setDatosAccion((d) => ({ ...d, id_cuenta_bancaria: e.target.value }))}>
                  <option value="">— elegir —</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(accion.nuevo === 'Endosado' || accion.nuevo === 'Entregado') && (
              <>
                <label className="erp-field">
                  <span className="erp-field__label">Proveedor</span>
                  <select value={datosAccion.id_proveedor} onChange={(e) => setDatosAccion((d) => ({ ...d, id_proveedor: e.target.value }))}>
                    <option value="">— otro —</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.razon_social || p.nombre || `Proveedor #${p.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="erp-field">
                  <span className="erp-field__label">O nombre libre</span>
                  <input value={datosAccion.tercero_nombre} onChange={(e) => setDatosAccion((d) => ({ ...d, tercero_nombre: e.target.value }))} />
                </label>
              </>
            )}
            {accion.nuevo === 'Rechazado' && (
              <label className="erp-field">
                <span className="erp-field__label">Motivo del rechazo</span>
                <input value={datosAccion.motivo} onChange={(e) => setDatosAccion((d) => ({ ...d, motivo: e.target.value }))} placeholder="Sin fondos, defecto formal…" />
              </label>
            )}
            <label className="erp-field erp-field--wide">
              <span className="erp-field__label">Detalle</span>
              <input value={datosAccion.detalle} onChange={(e) => setDatosAccion((d) => ({ ...d, detalle: e.target.value }))} />
            </label>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" onClick={() => void confirmarAccion()}>
              Confirmar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setAccion(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="erp-toolbar">
        <label className="erp-field">
          <span className="erp-field__label">Estado</span>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as '' | EstadoCheque)}>
            <option value="">Todos</option>
            {(tipo === 'Tercero'
              ? ['En cartera', 'Depositado', 'Endosado', 'Cobrado', 'Rechazado', 'Anulado']
              : ['Emitido', 'Entregado', 'Debitado', 'Rechazado', 'Anulado']
            ).map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="erp-panel">
        {cargando ? (
          <p className="erp-muted">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="erp-muted">No hay cheques para mostrar.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Banco</th>
                  <th>{tipo === 'Tercero' ? 'Recibido de' : 'Beneficiario'}</th>
                  <th>Emisión</th>
                  <th>Pago</th>
                  <th className="erpx-right">Importe</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <Fragment key={c.id}>
                    <tr>
                      <td>
                        {c.numero}
                        {c.es_echeq ? <div className="erp-muted">E-cheq</div> : null}
                      </td>
                      <td>{c.banco || '—'}</td>
                      <td>
                        {nombreTercero(c)}
                        {c.motivo_rechazo ? <div className="erp-muted">Rechazo: {c.motivo_rechazo}</div> : null}
                      </td>
                      <td>{fmtFecha(c.fecha_emision)}</td>
                      <td>{fmtFecha(c.fecha_pago)}</td>
                      <td className="erpx-right">{fmtMoney(c.importe)}</td>
                      <td>
                        <span className={`erp-pill ${PILL[c.estado] ?? ''}`}>{c.estado}</span>
                      </td>
                      <td>
                        <div className="erp-section-actions">
                          {siguientes(c).map((n) => (
                            <button key={n} type="button" className="erpx-btn-sm" onClick={() => abrirAccion(c, n)}>
                              {n}
                            </button>
                          ))}
                          <button type="button" className="erpx-btn-sm" onClick={() => setVerHistorial(verHistorial === c.id ? null : c.id)}>
                            Historial
                          </button>
                        </div>
                      </td>
                    </tr>
                    {verHistorial === c.id && (
                      <tr>
                        <td colSpan={8}>
                          <ul className="erpx-list">
                            {(historiales[c.id] ?? []).map((h) => (
                              <li key={h.id}>
                                {fmtFecha(h.fecha)} · {h.estado_anterior ? `${h.estado_anterior} → ` : ''}
                                {h.estado_nuevo}
                                {h.detalle ? ` · ${h.detalle}` : ''}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
