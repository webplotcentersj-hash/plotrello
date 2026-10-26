import { useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  anularRetencion,
  crearRetencion,
  getEmpresaFiscal,
  listClientesBasicos,
  listProveedoresBasicos,
  listRetenciones,
  nombreCliente,
  type ClienteBasico,
  type ImpuestoRetencion,
  type NuevaRetencion,
  type Retencion
} from '../services/erpContableApi'
import { descargarCsv, fmtFecha, fmtMoney, hoyIso } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

const IMPUESTOS: ImpuestoRetencion[] = ['Ganancias', 'IVA', 'IIBB', 'SIRCREB', 'SIRTAC', 'SUSS', 'Municipal', 'Otro']
const CON_JURISDICCION: ImpuestoRetencion[] = ['IIBB', 'SIRCREB', 'SIRTAC', 'Municipal']

type Proveedor = { id: number; nombre: string | null; razon_social: string | null; cuit: string | null }

const vacio = (): NuevaRetencion => ({
  naturaleza: 'Retención',
  sentido: 'Sufrida',
  impuesto: 'IIBB',
  regimen: null,
  jurisdiccion: null,
  fecha: hoyIso(),
  tercero_tipo: 'Cliente',
  id_proveedor: null,
  id_cliente: null,
  tercero_nombre: '',
  tercero_cuit: null,
  base_imponible: 0,
  alicuota: 0,
  importe: 0,
  numero_certificado: null,
  id_factura_compra: null,
  id_factura_venta: null,
  id_asiento_contable: null,
  observaciones: null
} as NuevaRetencion)

export default function ErpRetencionesPage() {
  const mes = hoyIso().slice(0, 7)
  const [tab, setTab] = useState<'registro' | 'listado'>('registro')
  const [filtros, setFiltros] = useState({
    desde: `${mes}-01`,
    hasta: hoyIso(),
    sentido: '' as '' | 'Efectuada' | 'Sufrida',
    impuesto: '' as '' | ImpuestoRetencion
  })
  const [filas, setFilas] = useState<Retencion[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [form, setForm] = useState<NuevaRetencion>(vacio)
  const [importeManual, setImporteManual] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [clientes, setClientes] = useState<ClienteBasico[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [empresa, setEmpresa] = useState<{ cuit: string; razon_social: string }>({ cuit: '', razon_social: '' })
  const [certificado, setCertificado] = useState<Retencion | null>(null)

  const cargar = async () => {
    setCargando(true)
    const r = await listRetenciones({
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
      sentido: filtros.sentido || undefined,
      impuesto: filtros.impuesto || undefined
    })
    if (r.success) setFilas(r.data)
    else {
      setFilas([])
      setMsg({ tipo: 'error', texto: r.error })
    }
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.desde, filtros.hasta, filtros.sentido, filtros.impuesto])

  useEffect(() => {
    void Promise.all([listClientesBasicos(), listProveedoresBasicos(), getEmpresaFiscal()]).then(([c, p, e]) => {
      if (c.success) setClientes(c.data)
      if (p.success) setProveedores(p.data)
      if (e.success) setEmpresa(e.data)
    })
  }, [])

  const set = <K extends keyof NuevaRetencion>(k: K, v: NuevaRetencion[K]) => setForm((f) => ({ ...f, [k]: v }))

  const setCalculo = (campo: 'base_imponible' | 'alicuota', valor: number) => {
    setForm((f) => {
      const n = { ...f, [campo]: valor }
      if (!importeManual) n.importe = Math.round(n.base_imponible * n.alicuota) / 100
      return n
    })
  }

  const elegirTercero = (id: string) => {
    if (form.tercero_tipo === 'Cliente') {
      const c = clientes.find((x) => String(x.id) === id)
      setForm((f) => ({
        ...f,
        id_cliente: c?.id ?? null,
        id_proveedor: null,
        tercero_nombre: c ? nombreCliente(c, c.id) : f.tercero_nombre,
        tercero_cuit: c?.dni_cuit ?? f.tercero_cuit
      }))
    } else if (form.tercero_tipo === 'Proveedor') {
      const p = proveedores.find((x) => String(x.id) === id)
      setForm((f) => ({
        ...f,
        id_proveedor: p?.id ?? null,
        id_cliente: null,
        tercero_nombre: p ? p.razon_social || p.nombre || `Proveedor #${p.id}` : f.tercero_nombre,
        tercero_cuit: p?.cuit ?? f.tercero_cuit
      }))
    }
  }

  const guardar = async () => {
    setMsg(null)
    if (!form.tercero_nombre.trim()) return setMsg({ tipo: 'error', texto: 'Indicá el nombre del cliente o proveedor.' })
    if (!(form.importe > 0)) return setMsg({ tipo: 'error', texto: 'El importe debe ser mayor a cero.' })
    setGuardando(true)
    const r = await crearRetencion({
      ...form,
      regimen: form.regimen?.trim() || null,
      jurisdiccion: CON_JURISDICCION.includes(form.impuesto) ? form.jurisdiccion?.trim() || null : null,
      numero_certificado: form.numero_certificado?.trim() || null,
      observaciones: form.observaciones?.trim() || null,
      tercero_nombre: form.tercero_nombre.trim()
    })
    setGuardando(false)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: 'Registrada.' })
    setForm((f) => ({ ...vacio(), sentido: f.sentido, naturaleza: f.naturaleza, impuesto: f.impuesto, tercero_tipo: f.tercero_tipo }))
    setImporteManual(false)
    void cargar()
  }

  const anular = async (r: Retencion) => {
    if (!window.confirm(`¿Anular la ${r.naturaleza.toLowerCase()} de ${fmtMoney(r.importe)} a ${r.tercero_nombre}?`)) return
    const res = await anularRetencion(r.id)
    if (!res.success) return setMsg({ tipo: 'error', texto: res.error })
    void cargar()
  }

  const resumen = useMemo(() => {
    const mapa = new Map<string, { impuesto: string; efectuadas: number; sufridas: number }>()
    for (const r of filas) {
      const fila = mapa.get(r.impuesto) ?? { impuesto: r.impuesto, efectuadas: 0, sufridas: 0 }
      if (r.sentido === 'Efectuada') fila.efectuadas += r.importe
      else fila.sufridas += r.importe
      mapa.set(r.impuesto, fila)
    }
    const lista = [...mapa.values()]
    return {
      lista,
      efectuadas: lista.reduce((s, x) => s + x.efectuadas, 0),
      sufridas: lista.reduce((s, x) => s + x.sufridas, 0)
    }
  }, [filas])

  const exportar = () => {
    descargarCsv(
      `retenciones_percepciones_${filtros.desde}_${filtros.hasta}.csv`,
      ['fecha', 'naturaleza', 'sentido', 'impuesto', 'regimen', 'jurisdiccion', 'tercero', 'cuit', 'base_imponible', 'alicuota', 'importe', 'certificado'],
      filas.map((r) => [r.fecha, r.naturaleza, r.sentido, r.impuesto, r.regimen, r.jurisdiccion, r.tercero_nombre, r.tercero_cuit, r.base_imponible, r.alicuota, r.importe, r.numero_certificado])
    )
  }

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🧾"
        titulo="Retenciones y percepciones"
        subtitulo="Registro de las que aplicás (efectuadas) y las que te aplican (sufridas), con reportes y certificados."
        volverA="/erp/impuestos"
        volverTexto="Impuestos"
      />

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo} erpx-noprint`}>{msg.texto}</p>}

      <div className="erpx-tabs erpx-noprint">
        <button type="button" className={`erpx-tab ${tab === 'registro' ? 'is-active' : ''}`} onClick={() => setTab('registro')}>
          Registrar
        </button>
        <button type="button" className={`erpx-tab ${tab === 'listado' ? 'is-active' : ''}`} onClick={() => setTab('listado')}>
          Listado y reportes
        </button>
      </div>

      {tab === 'registro' && (
        <div className="erp-panel erpx-noprint">
          <h2>Nueva retención / percepción</h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Naturaleza</span>
              <select value={form.naturaleza} onChange={(e) => set('naturaleza', e.target.value as NuevaRetencion['naturaleza'])}>
                <option>Retención</option>
                <option>Percepción</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Sentido</span>
              <select
                value={form.sentido}
                onChange={(e) => {
                  const sentido = e.target.value as NuevaRetencion['sentido']
                  setForm((f) => ({ ...f, sentido, tercero_tipo: sentido === 'Sufrida' ? 'Cliente' : 'Proveedor', id_cliente: null, id_proveedor: null }))
                }}
              >
                <option value="Sufrida">Sufrida (nos la aplicaron)</option>
                <option value="Efectuada">Efectuada (la aplicamos)</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Impuesto</span>
              <select value={form.impuesto} onChange={(e) => set('impuesto', e.target.value as ImpuestoRetencion)}>
                {IMPUESTOS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Régimen / concepto</span>
              <input value={form.regimen ?? ''} onChange={(e) => set('regimen', e.target.value)} placeholder="Ej: Locaciones de servicios" />
            </label>
            {CON_JURISDICCION.includes(form.impuesto) && (
              <label className="erp-field">
                <span className="erp-field__label">Jurisdicción</span>
                <input value={form.jurisdiccion ?? ''} onChange={(e) => set('jurisdiccion', e.target.value)} placeholder="Ej: San Juan" />
              </label>
            )}
            <label className="erp-field">
              <span className="erp-field__label">Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Tercero</span>
              <select value={form.tercero_tipo} onChange={(e) => setForm((f) => ({ ...f, tercero_tipo: e.target.value as NuevaRetencion['tercero_tipo'], id_cliente: null, id_proveedor: null }))}>
                <option>Cliente</option>
                <option>Proveedor</option>
                <option>Otro</option>
              </select>
            </label>
            {form.tercero_tipo !== 'Otro' && (
              <label className="erp-field">
                <span className="erp-field__label">Buscar {form.tercero_tipo.toLowerCase()}</span>
                <select value={String((form.tercero_tipo === 'Cliente' ? form.id_cliente : form.id_proveedor) ?? '')} onChange={(e) => elegirTercero(e.target.value)}>
                  <option value="">— elegir —</option>
                  {form.tercero_tipo === 'Cliente'
                    ? clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {nombreCliente(c, c.id)}
                        </option>
                      ))
                    : proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.razon_social || p.nombre || `Proveedor #${p.id}`}
                        </option>
                      ))}
                </select>
              </label>
            )}
            <label className="erp-field">
              <span className="erp-field__label">Nombre</span>
              <input value={form.tercero_nombre} onChange={(e) => set('tercero_nombre', e.target.value)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">CUIT</span>
              <input value={form.tercero_cuit ?? ''} onChange={(e) => set('tercero_cuit', e.target.value)} placeholder="30-12345678-9" />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Base imponible</span>
              <input type="number" min="0" step="0.01" value={form.base_imponible || ''} onChange={(e) => setCalculo('base_imponible', Number(e.target.value) || 0)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Alícuota %</span>
              <input type="number" min="0" step="0.01" value={form.alicuota || ''} onChange={(e) => setCalculo('alicuota', Number(e.target.value) || 0)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Importe</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.importe || ''}
                onChange={(e) => {
                  setImporteManual(true)
                  set('importe', Number(e.target.value) || 0)
                }}
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">N° de certificado</span>
              <input value={form.numero_certificado ?? ''} onChange={(e) => set('numero_certificado', e.target.value)} />
            </label>
            <label className="erp-field erp-field--wide">
              <span className="erp-field__label">Observaciones</span>
              <input value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} />
            </label>
          </div>
          {form.impuesto === 'IVA' && form.sentido === 'Sufrida' && (
            <p className="erpx-msg erpx-msg--warn" style={{ marginTop: 12 }}>
              Las retenciones y percepciones de IVA sufridas se descuentan en la liquidación mensual. Si la percepción ya viene cargada en una factura de compra, no la registres acá de nuevo.
            </p>
          )}
          <div className="erpx-actions">
            <button type="button" className="btn-primary" disabled={guardando} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      {tab === 'listado' && (
        <>
          <div className="erp-toolbar erpx-noprint">
            <label className="erp-field">
              <span className="erp-field__label">Desde</span>
              <input type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Hasta</span>
              <input type="date" value={filtros.hasta} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Sentido</span>
              <select value={filtros.sentido} onChange={(e) => setFiltros((f) => ({ ...f, sentido: e.target.value as typeof f.sentido }))}>
                <option value="">Todos</option>
                <option value="Efectuada">Efectuadas</option>
                <option value="Sufrida">Sufridas</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Impuesto</span>
              <select value={filtros.impuesto} onChange={(e) => setFiltros((f) => ({ ...f, impuesto: e.target.value as typeof f.impuesto }))}>
                <option value="">Todos</option>
                {IMPUESTOS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secondary" disabled={filas.length === 0} onClick={exportar}>
              Exportar CSV
            </button>
          </div>

          <div className="erp-panel erpx-noprint">
            <h2>Resumen por impuesto</h2>
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(resumen.efectuadas)}</div>
                <div className="erp-kpi-label">Efectuadas (a depositar)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(resumen.sufridas)}</div>
                <div className="erp-kpi-label">Sufridas (a favor)</div>
              </div>
            </div>
            {resumen.lista.length > 0 && (
              <div className="erp-table-wrap" style={{ marginTop: 12 }}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Impuesto</th>
                      <th className="erpx-right">Efectuadas</th>
                      <th className="erpx-right">Sufridas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.lista.map((x) => (
                      <tr key={x.impuesto}>
                        <td>{x.impuesto}</td>
                        <td className="erpx-right">{fmtMoney(x.efectuadas)}</td>
                        <td className="erpx-right">{fmtMoney(x.sufridas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="erp-panel erpx-noprint">
            <h2>Detalle</h2>
            {cargando ? (
              <p className="erp-muted">Cargando…</p>
            ) : filas.length === 0 ? (
              <p className="erp-muted">No hay registros en el período.</p>
            ) : (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Impuesto</th>
                      <th>Tercero</th>
                      <th className="erpx-right">Base</th>
                      <th className="erpx-right">%</th>
                      <th className="erpx-right">Importe</th>
                      <th>Cert.</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((r) => (
                      <tr key={r.id}>
                        <td>{fmtFecha(r.fecha)}</td>
                        <td>
                          {r.naturaleza} <span className={`erp-pill ${r.sentido === 'Sufrida' ? 'ok' : 'warn'}`}>{r.sentido}</span>
                        </td>
                        <td>
                          {r.impuesto}
                          {r.jurisdiccion ? ` · ${r.jurisdiccion}` : ''}
                          {r.regimen ? <div className="erp-muted">{r.regimen}</div> : null}
                        </td>
                        <td>
                          {r.tercero_nombre}
                          {r.tercero_cuit ? <div className="erp-muted">{r.tercero_cuit}</div> : null}
                        </td>
                        <td className="erpx-right">{fmtMoney(r.base_imponible)}</td>
                        <td className="erpx-right">{r.alicuota}</td>
                        <td className="erpx-right">{fmtMoney(r.importe)}</td>
                        <td>{r.numero_certificado || '—'}</td>
                        <td>
                          <div className="erp-section-actions">
                            {r.sentido === 'Efectuada' && (
                              <button type="button" className="erpx-btn-sm" onClick={() => setCertificado(r)}>
                                Certificado
                              </button>
                            )}
                            <button type="button" className="erpx-btn-sm is-danger" onClick={() => void anular(r)}>
                              Anular
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
        </>
      )}

      {certificado && (
        <div className="erp-panel erpx-certificado">
          <h2>Certificado de {certificado.naturaleza.toLowerCase()} — {certificado.impuesto}</h2>
          <p>
            <strong>Agente de {certificado.naturaleza === 'Retención' ? 'retención' : 'percepción'}:</strong> {empresa.razon_social || '—'} · CUIT {empresa.cuit || '—'}
          </p>
          <p>
            <strong>Sujeto {certificado.naturaleza === 'Retención' ? 'retenido' : 'percibido'}:</strong> {certificado.tercero_nombre} · CUIT {certificado.tercero_cuit || '—'}
          </p>
          <p>
            <strong>Fecha:</strong> {fmtFecha(certificado.fecha)} · <strong>Certificado N°:</strong> {certificado.numero_certificado || `S/N (#${certificado.id})`}
          </p>
          <p>
            <strong>Régimen:</strong> {certificado.regimen || '—'}
            {certificado.jurisdiccion ? ` · Jurisdicción ${certificado.jurisdiccion}` : ''}
          </p>
          <p>
            <strong>Base imponible:</strong> {fmtMoney(certificado.base_imponible)} · <strong>Alícuota:</strong> {certificado.alicuota}% ·{' '}
            <strong>Importe:</strong> {fmtMoney(certificado.importe)}
          </p>
          <div className="erpx-actions erpx-noprint">
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              Imprimir
            </button>
            <button type="button" className="btn-secondary" onClick={() => setCertificado(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
