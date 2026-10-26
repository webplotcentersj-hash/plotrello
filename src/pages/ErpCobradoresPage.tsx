import { useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  asignarClientesCobrador,
  guardarCobrador,
  listAsignacionesCobrador,
  listClientesBasicos,
  listCobradores,
  nombreCliente,
  reporteCobrador,
  type AsignacionCobrador,
  type ClienteBasico,
  type Cobrador,
  type ReporteCobrador
} from '../services/erpContableApi'
import { fmtMoney, hoyIso } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

type Form = Omit<Cobrador, 'id'> & { id?: number }

const vacio = (): Form => ({ nombre: '', documento: null, telefono: null, email: null, comision_pct: 0, activo: true, observaciones: null })

export default function ErpCobradoresPage() {
  const [cobradores, setCobradores] = useState<Cobrador[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionCobrador[]>([])
  const [clientes, setClientes] = useState<ClienteBasico[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [elegido, setElegido] = useState<Cobrador | null>(null)
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [rango, setRango] = useState({ desde: `${hoyIso().slice(0, 7)}-01`, hasta: hoyIso() })
  const [reporte, setReporte] = useState<ReporteCobrador | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = async () => {
    const [c, a] = await Promise.all([listCobradores(), listAsignacionesCobrador()])
    if (c.success) setCobradores(c.data)
    else setMsg({ tipo: 'error', texto: c.error })
    if (a.success) setAsignaciones(a.data)
  }

  useEffect(() => {
    void cargar()
    void listClientesBasicos().then((r) => r.success && setClientes(r.data))
  }, [])

  const clientesDe = (id: number) => asignaciones.filter((a) => a.id_cobrador === id).map((a) => a.id_cliente)

  const abrir = (c: Cobrador) => {
    setElegido(c)
    setSeleccion(new Set(clientesDe(c.id)))
    setReporte(null)
  }

  const guardar = async () => {
    if (!form) return
    if (!form.nombre.trim()) return setMsg({ tipo: 'error', texto: 'El nombre es obligatorio.' })
    const r = await guardarCobrador({ ...form, nombre: form.nombre.trim() })
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: 'Cobrador guardado.' })
    setForm(null)
    void cargar()
  }

  const guardarAsignacion = async () => {
    if (!elegido) return
    const r = await asignarClientesCobrador(elegido.id, [...seleccion])
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `Clientes de ${elegido.nombre} actualizados.` })
    void cargar()
  }

  const verReporte = async () => {
    if (!elegido) return
    const r = await reporteCobrador(elegido, clientesDe(elegido.id), rango.desde, rango.hasta)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setReporte(r.data)
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return clientes.filter((c) => !q || nombreCliente(c, c.id).toLowerCase().includes(q) || (c.dni_cuit ?? '').includes(q))
  }, [clientes, busqueda])

  const duenioDe = (idCliente: number) => {
    const a = asignaciones.find((x) => x.id_cliente === idCliente)
    return a && a.id_cobrador !== elegido?.id ? cobradores.find((c) => c.id === a.id_cobrador)?.nombre : undefined
  }

  const nombreDe = (id: number) => nombreCliente(clientes.find((c) => c.id === id), id)

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🧑‍💼"
        titulo="Cobradores"
        subtitulo="Asigná clientes a cada cobrador y seguí lo cobrado, la comisión y el saldo pendiente."
        volverA="/erp/tesoreria"
        volverTexto="Tesorería"
      >
        <button type="button" className="btn-primary" onClick={() => setForm(vacio())}>
          + Nuevo cobrador
        </button>
      </ErpPageHeader>

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      {form && (
        <div className="erp-panel">
          <h2>{form.id ? 'Editar cobrador' : 'Nuevo cobrador'}</h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Nombre</span>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Documento</span>
              <input value={form.documento ?? ''} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Teléfono</span>
              <input value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Email</span>
              <input value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Comisión %</span>
              <input type="number" min="0" max="100" step="0.01" value={form.comision_pct} onChange={(e) => setForm({ ...form, comision_pct: Number(e.target.value) || 0 })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Estado</span>
              <select value={form.activo ? 'si' : 'no'} onChange={(e) => setForm({ ...form, activo: e.target.value === 'si' })}>
                <option value="si">Activo</option>
                <option value="no">Inactivo</option>
              </select>
            </label>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" onClick={() => void guardar()}>
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="erp-panel">
        <h2>Cobradores</h2>
        {cobradores.length === 0 ? (
          <p className="erp-muted">Todavía no cargaste cobradores.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th className="erpx-right">Comisión</th>
                  <th className="erpx-right">Clientes</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cobradores.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{[c.telefono, c.email].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="erpx-right">{c.comision_pct}%</td>
                    <td className="erpx-right">{clientesDe(c.id).length}</td>
                    <td>
                      <span className={`erp-pill ${c.activo ? 'ok' : 'warn'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td>
                      <div className="erp-section-actions">
                        <button type="button" className="erpx-btn-sm" onClick={() => abrir(c)}>
                          Clientes y reporte
                        </button>
                        <button type="button" className="erpx-btn-sm" onClick={() => setForm({ ...c })}>
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {elegido && (
        <>
          <div className="erp-panel">
            <h2>Clientes de {elegido.nombre}</h2>
            <div className="erp-toolbar">
              <label className="erp-field">
                <span className="erp-field__label">Buscar</span>
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o CUIT" />
              </label>
              <span className="erp-muted">{seleccion.size} seleccionado(s)</span>
            </div>
            <div className="erpx-checks">
              {filtrados.slice(0, 300).map((c) => {
                const otro = duenioDe(c.id)
                return (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={seleccion.has(c.id)}
                      onChange={(e) =>
                        setSeleccion((prev) => {
                          const n = new Set(prev)
                          if (e.target.checked) n.add(c.id)
                          else n.delete(c.id)
                          return n
                        })
                      }
                    />
                    <span>
                      {nombreCliente(c, c.id)}
                      {otro ? <span className="erp-muted"> (hoy con {otro})</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
            {filtrados.length > 300 && <p className="erp-muted">Mostrando 300 de {filtrados.length}: afiná la búsqueda.</p>}
            <div className="erpx-actions">
              <button type="button" className="btn-primary" onClick={() => void guardarAsignacion()}>
                Guardar asignación
              </button>
            </div>
          </div>

          <div className="erp-panel">
            <h2>Cobranzas y comisión</h2>
            <div className="erp-toolbar">
              <label className="erp-field">
                <span className="erp-field__label">Desde</span>
                <input type="date" value={rango.desde} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} />
              </label>
              <label className="erp-field">
                <span className="erp-field__label">Hasta</span>
                <input type="date" value={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} />
              </label>
              <button type="button" className="btn-secondary" onClick={() => void verReporte()}>
                Ver reporte
              </button>
            </div>
            {reporte && (
              <>
                <div className="erp-kpi">
                  <div className="erp-kpi-item">
                    <div className="erp-kpi-value">{fmtMoney(reporte.cobrado)}</div>
                    <div className="erp-kpi-label">Cobrado en el período</div>
                  </div>
                  <div className="erp-kpi-item">
                    <div className="erp-kpi-value">{fmtMoney(reporte.comision)}</div>
                    <div className="erp-kpi-label">Comisión ({elegido.comision_pct}%)</div>
                  </div>
                  <div className="erp-kpi-item">
                    <div className="erp-kpi-value">{fmtMoney(reporte.pendiente)}</div>
                    <div className="erp-kpi-label">Saldo pendiente de sus clientes</div>
                  </div>
                </div>
                <div className="erp-table-wrap" style={{ marginTop: 12 }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th className="erpx-right">Cobrado</th>
                        <th className="erpx-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.clientes
                        .filter((c) => c.cobrado !== 0 || c.saldo !== 0)
                        .sort((a, b) => b.saldo - a.saldo)
                        .map((c) => (
                          <tr key={c.id_cliente}>
                            <td>{nombreDe(c.id_cliente)}</td>
                            <td className="erpx-right">{fmtMoney(c.cobrado)}</td>
                            <td className="erpx-right">{fmtMoney(c.saldo)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
