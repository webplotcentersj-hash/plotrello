import { useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  deudaPorProveedor,
  desrelacionarCliente,
  listClientesBasicos,
  listClientesRelacionados,
  listProveedoresBasicos,
  movimientosCcPorFecha,
  nombreCliente,
  relacionarClientes,
  saldosCcPorCliente,
  type ClienteBasico,
  type ClienteRelacionado,
  type DeudaProveedor,
  type MovimientoCc
} from '../services/erpContableApi'
import { descargarCsv, fmtFecha, fmtMoney, hoyIso } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

type Tab = 'consolidada' | 'cruce' | 'movimientos' | 'relaciones'
type Saldo = { debe: number; haber: number }

const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')

export default function ErpCuentasConsolidadasPage() {
  const [tab, setTab] = useState<Tab>('consolidada')
  const [clientes, setClientes] = useState<ClienteBasico[]>([])
  const [relaciones, setRelaciones] = useState<ClienteRelacionado[]>([])
  const [saldos, setSaldos] = useState<Map<number, Saldo>>(new Map())
  const [deudas, setDeudas] = useState<DeudaProveedor[]>([])
  const [proveedores, setProveedores] = useState<Array<{ id: number; nombre: string | null; razon_social: string | null; cuit: string | null }>>([])
  const [rango, setRango] = useState({ desde: `${hoyIso().slice(0, 7)}-01`, hasta: hoyIso() })
  const [movs, setMovs] = useState<MovimientoCc[]>([])
  const [nuevo, setNuevo] = useState({ principal: '', relacionado: '', observaciones: '' })
  const [soloConSaldo, setSoloConSaldo] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const [c, r, s, d, p] = await Promise.all([
      listClientesBasicos(),
      listClientesRelacionados(),
      saldosCcPorCliente(),
      deudaPorProveedor(),
      listProveedoresBasicos()
    ])
    if (c.success) setClientes(c.data)
    if (r.success) setRelaciones(r.data)
    if (s.success) setSaldos(s.data)
    if (d.success) setDeudas(d.data)
    if (p.success) setProveedores(p.data)
    const fallo = [c, r, s].find((x) => !x.success)
    if (fallo && !fallo.success) setMsg({ tipo: 'error', texto: fallo.error })
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
  }, [])

  const nombre = (id: number) => nombreCliente(clientes.find((c) => c.id === id), id)
  const saldoDe = (id: number) => {
    const s = saldos.get(id)
    return s ? s.debe - s.haber : 0
  }

  const grupos = useMemo(() => {
    const relacionados = new Set(relaciones.map((r) => r.id_cliente_relacionado))
    const porPrincipal = new Map<number, number[]>()
    for (const r of relaciones) porPrincipal.set(r.id_cliente_principal, [...(porPrincipal.get(r.id_cliente_principal) ?? []), r.id_cliente_relacionado])
    const ids = [...new Set([...saldos.keys(), ...porPrincipal.keys()])].filter((id) => !relacionados.has(id))
    return ids
      .map((id) => {
        const hijos = porPrincipal.get(id) ?? []
        const propio = saldoDe(id)
        const detalle = hijos.map((h) => ({ id: h, saldo: saldoDe(h) }))
        return { id, propio, hijos: detalle, total: propio + detalle.reduce((s, x) => s + x.saldo, 0) }
      })
      .filter((g) => !soloConSaldo || Math.abs(g.total) > 0.005)
      .sort((a, b) => b.total - a.total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relaciones, saldos, soloConSaldo])

  // Mismo CUIT como cliente y proveedor: se compensan.
  const cruces = useMemo(() => {
    const filas: Array<{ cuit: string; cliente: string; proveedor: string; porCobrar: number; porPagar: number }> = []
    for (const p of proveedores) {
      const cuit = soloDigitos(p.cuit)
      if (cuit.length !== 11) continue
      const cli = clientes.find((c) => soloDigitos(c.dni_cuit) === cuit)
      if (!cli) continue
      const grupo = grupos.find((g) => g.id === cli.id || g.hijos.some((h) => h.id === cli.id))
      const porCobrar = grupo ? grupo.total : saldoDe(cli.id)
      const porPagar = deudas.filter((d) => d.id_proveedor === p.id).reduce((s, d) => s + d.pendiente, 0)
      if (Math.abs(porCobrar) < 0.005 && Math.abs(porPagar) < 0.005) continue
      filas.push({ cuit, cliente: nombreCliente(cli, cli.id), proveedor: p.razon_social || p.nombre || `Proveedor #${p.id}`, porCobrar, porPagar })
    }
    return filas.sort((a, b) => Math.abs(b.porCobrar - b.porPagar) - Math.abs(a.porCobrar - a.porPagar))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedores, clientes, deudas, grupos])

  const verMovimientos = async () => {
    const r = await movimientosCcPorFecha(rango.desde, rango.hasta)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMovs(r.data)
  }

  const relacionar = async () => {
    setMsg(null)
    const r = await relacionarClientes(Number(nuevo.principal), Number(nuevo.relacionado), nuevo.observaciones)
    if (!r.success) {
      const dup = /duplicate|unique/i.test(r.error)
      return setMsg({ tipo: 'error', texto: dup ? 'Ese cliente ya está relacionado a otro principal.' : r.error })
    }
    setNuevo({ principal: '', relacionado: '', observaciones: '' })
    setMsg({ tipo: 'ok', texto: 'Clientes relacionados.' })
    void cargar()
  }

  const totalMov = movs.reduce((t, m) => ({ debe: t.debe + m.debe, haber: t.haber + m.haber }), { debe: 0, haber: 0 })

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🧮"
        titulo="Cuentas corrientes consolidadas"
        subtitulo="Saldos por grupo de clientes relacionados, cruce con proveedores y movimientos por fecha."
        volverA="/erp/tesoreria"
        volverTexto="Tesorería"
      />

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      <div className="erpx-tabs">
        {(
          [
            ['consolidada', 'Consolidada'],
            ['cruce', 'Clientes y proveedores'],
            ['movimientos', 'Movimientos por fecha'],
            ['relaciones', 'Clientes relacionados']
          ] as Array<[Tab, string]>
        ).map(([k, t]) => (
          <button key={k} type="button" className={`erpx-tab ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'consolidada' && (
        <div className="erp-panel">
          <div className="erp-toolbar">
            <label className="erp-field">
              <span className="erp-field__label">Mostrar</span>
              <select value={soloConSaldo ? 'saldo' : 'todos'} onChange={(e) => setSoloConSaldo(e.target.value === 'saldo')}>
                <option value="saldo">Solo con saldo</option>
                <option value="todos">Todos</option>
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary"
              disabled={grupos.length === 0}
              onClick={() =>
                descargarCsv(
                  'cuentas_corrientes_consolidadas.csv',
                  ['cliente', 'saldo_propio', 'relacionados', 'saldo_consolidado'],
                  grupos.map((g) => [nombre(g.id), g.propio, g.hijos.map((h) => nombre(h.id)).join(' | '), g.total])
                )
              }
            >
              Exportar CSV
            </button>
          </div>
          {cargando ? (
            <p className="erp-muted">Cargando…</p>
          ) : grupos.length === 0 ? (
            <p className="erp-muted">No hay cuentas corrientes con saldo.</p>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="erpx-right">Saldo propio</th>
                    <th>Relacionados</th>
                    <th className="erpx-right">Consolidado</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.id}>
                      <td>{nombre(g.id)}</td>
                      <td className="erpx-right">{fmtMoney(g.propio)}</td>
                      <td>
                        {g.hijos.length === 0
                          ? '—'
                          : g.hijos.map((h) => (
                              <div key={h.id} className="erp-muted">
                                {nombre(h.id)}: {fmtMoney(h.saldo)}
                              </div>
                            ))}
                      </td>
                      <td className="erpx-right">{fmtMoney(g.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="erp-muted" style={{ marginTop: 10 }}>
            Saldo positivo: el cliente nos debe. Se calcula con los movimientos de la cuenta corriente de clientes.
          </p>
        </div>
      )}

      {tab === 'cruce' && (
        <div className="erp-panel">
          <h2>Terceros que son cliente y proveedor (mismo CUIT)</h2>
          {cruces.length === 0 ? (
            <p className="erp-muted">No hay terceros con saldos cruzados.</p>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>CUIT</th>
                    <th>Cliente</th>
                    <th>Proveedor</th>
                    <th className="erpx-right">Nos deben</th>
                    <th className="erpx-right">Les debemos</th>
                    <th className="erpx-right">Posición neta</th>
                  </tr>
                </thead>
                <tbody>
                  {cruces.map((c) => (
                    <tr key={c.cuit}>
                      <td>{c.cuit}</td>
                      <td>{c.cliente}</td>
                      <td>{c.proveedor}</td>
                      <td className="erpx-right">{fmtMoney(c.porCobrar)}</td>
                      <td className="erpx-right">{fmtMoney(c.porPagar)}</td>
                      <td className="erpx-right">{fmtMoney(c.porCobrar - c.porPagar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="erp-panel">
          <div className="erp-toolbar">
            <label className="erp-field">
              <span className="erp-field__label">Desde</span>
              <input type="date" value={rango.desde} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Hasta</span>
              <input type="date" value={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} />
            </label>
            <button type="button" className="btn-primary" onClick={() => void verMovimientos()}>
              Ver movimientos
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={movs.length === 0}
              onClick={() =>
                descargarCsv(
                  `movimientos_cc_${rango.desde}_${rango.hasta}.csv`,
                  ['fecha', 'cliente', 'tipo', 'concepto', 'debe', 'haber'],
                  movs.map((m) => [m.fecha.slice(0, 10), nombre(m.id_cliente), m.tipo, m.concepto, m.debe, m.haber])
                )
              }
            >
              Exportar CSV
            </button>
          </div>
          {movs.length > 0 && (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th className="erpx-right">Debe</th>
                    <th className="erpx-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map((m) => (
                    <tr key={m.id}>
                      <td>{fmtFecha(m.fecha)}</td>
                      <td>{nombre(m.id_cliente)}</td>
                      <td>{m.tipo}</td>
                      <td>{m.concepto || '—'}</td>
                      <td className="erpx-right">{m.debe ? fmtMoney(m.debe) : ''}</td>
                      <td className="erpx-right">{m.haber ? fmtMoney(m.haber) : ''}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4}>
                      <strong>Totales ({movs.length})</strong>
                    </td>
                    <td className="erpx-right">
                      <strong>{fmtMoney(totalMov.debe)}</strong>
                    </td>
                    <td className="erpx-right">
                      <strong>{fmtMoney(totalMov.haber)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'relaciones' && (
        <>
          <div className="erp-panel">
            <h2>Relacionar clientes</h2>
            <p className="erp-muted">Un cliente relacionado suma su saldo al del principal en la vista consolidada (sucursales, razones sociales del mismo grupo).</p>
            <div className="erpx-form">
              <label className="erp-field">
                <span className="erp-field__label">Cliente principal</span>
                <select value={nuevo.principal} onChange={(e) => setNuevo({ ...nuevo, principal: e.target.value })}>
                  <option value="">— elegir —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nombreCliente(c, c.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="erp-field">
                <span className="erp-field__label">Cliente relacionado</span>
                <select value={nuevo.relacionado} onChange={(e) => setNuevo({ ...nuevo, relacionado: e.target.value })}>
                  <option value="">— elegir —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nombreCliente(c, c.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="erp-field">
                <span className="erp-field__label">Observaciones</span>
                <input value={nuevo.observaciones} onChange={(e) => setNuevo({ ...nuevo, observaciones: e.target.value })} />
              </label>
            </div>
            <div className="erpx-actions">
              <button type="button" className="btn-primary" disabled={!nuevo.principal || !nuevo.relacionado} onClick={() => void relacionar()}>
                Relacionar
              </button>
            </div>
          </div>
          <div className="erp-panel">
            <h2>Relaciones cargadas</h2>
            {relaciones.length === 0 ? (
              <p className="erp-muted">No hay clientes relacionados.</p>
            ) : (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Principal</th>
                      <th>Relacionado</th>
                      <th>Observaciones</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {relaciones.map((r) => (
                      <tr key={r.id}>
                        <td>{nombre(r.id_cliente_principal)}</td>
                        <td>{nombre(r.id_cliente_relacionado)}</td>
                        <td>{r.observaciones || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="erpx-btn-sm is-danger"
                            onClick={async () => {
                              if (!window.confirm('¿Quitar esta relación?')) return
                              const res = await desrelacionarCliente(r.id)
                              if (!res.success) return setMsg({ tipo: 'error', texto: res.error })
                              void cargar()
                            }}
                          >
                            Quitar
                          </button>
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
    </div>
  )
}
