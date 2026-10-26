import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import apiService from '../services/api'
import {
  eliminarAsientoModelo,
  guardarAsientoModelo,
  guardarIndicesInflacion,
  listAsientosModelo,
  listIndicesInflacion,
  movimientosMensualesPorCuenta,
  type AsientoModelo,
  type AsientoModeloLinea
} from '../services/erpContableApi'
import type { PlanCuentaRecord } from '../types/api'
import { armarAsientoAjuste, calcularAjusteCuenta, type AjusteCuenta } from '../utils/ajusteInflacion'
import { lineasDesdeModelo } from '../utils/asientoModelo'
import { descargarTexto, fmtMoney, hoyIso, parsearCsv, parsearNumero } from '../utils/erpUi'
import { esPeriodoValido, rangoPeriodo } from '../utils/liquidacionIva'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

type Tab = 'modelos' | 'importar' | 'inflacion'
type Msg = { tipo: 'ok' | 'error' | 'warn'; texto: string } | null

const PLANTILLA_CSV =
  'referencia;fecha;cuenta;debe;haber;concepto\nA1;2026-10-01;1.1.1.01;1000;0;Cobro en efectivo\nA1;2026-10-01;4.1.1.01;0;1000;Venta\n'

const ES_NO_MONETARIA = /bienes? de uso|rodado|mueble|inmueble|maquinari|equipo|instalaci|mercader|stock|capital|reserva|resultados? no asignados|amortizaci/i

export default function ErpAsientosHerramientasPage() {
  const [tab, setTab] = useState<Tab>('modelos')
  const [cuentas, setCuentas] = useState<PlanCuentaRecord[]>([])
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    void apiService.getPlanCuentas(true).then((r) => {
      if (r.success && r.data) setCuentas(r.data)
      else setMsg({ tipo: 'error', texto: r.error || 'No se pudo cargar el plan de cuentas.' })
    })
  }, [])

  const etiquetaCuenta = (id: number) => {
    const c = cuentas.find((x) => x.id === id)
    return c ? `${c.codigo} · ${c.nombre}` : `Cuenta #${id}`
  }

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🧰"
        titulo="Herramientas de asientos"
        subtitulo="Asientos modelo, importación masiva desde CSV y ajuste por inflación."
        volverA="/erp/asientos"
        volverTexto="Asientos"
      />
      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}
      <div className="erpx-tabs">
        {(
          [
            ['modelos', 'Asientos modelo'],
            ['importar', 'Importar CSV'],
            ['inflacion', 'Ajuste por inflación']
          ] as Array<[Tab, string]>
        ).map(([k, t]) => (
          <button key={k} type="button" className={`erpx-tab ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'modelos' && <Modelos cuentas={cuentas} etiqueta={etiquetaCuenta} avisar={setMsg} />}
      {tab === 'importar' && <Importar cuentas={cuentas} avisar={setMsg} />}
      {tab === 'inflacion' && <Inflacion cuentas={cuentas} avisar={setMsg} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
function Modelos({ cuentas, etiqueta, avisar }: { cuentas: PlanCuentaRecord[]; etiqueta: (id: number) => string; avisar: (m: Msg) => void }) {
  const [modelos, setModelos] = useState<AsientoModelo[]>([])
  const [edicion, setEdicion] = useState<{ id?: number; nombre: string; concepto: string; tipo_asiento: AsientoModelo['tipo_asiento']; lineas: AsientoModeloLinea[] } | null>(null)
  const [uso, setUso] = useState<{ modelo: AsientoModelo; importe: string; fecha: string; contabilizar: boolean } | null>(null)

  const cargar = async () => {
    const r = await listAsientosModelo()
    if (r.success) setModelos(r.data)
    else avisar({ tipo: 'error', texto: r.error })
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nuevaLinea = (lado: 'Debe' | 'Haber'): AsientoModeloLinea => ({ id_cuenta: 0, lado, porcentaje: 100, concepto: null })

  const guardar = async () => {
    if (!edicion) return
    if (!edicion.nombre.trim() || !edicion.concepto.trim()) return avisar({ tipo: 'error', texto: 'Completá nombre y concepto.' })
    if (edicion.lineas.some((l) => !l.id_cuenta)) return avisar({ tipo: 'error', texto: 'Todas las líneas necesitan una cuenta.' })
    const r = await guardarAsientoModelo(
      { id: edicion.id, nombre: edicion.nombre.trim(), concepto: edicion.concepto.trim(), tipo_asiento: edicion.tipo_asiento },
      edicion.lineas
    )
    if (!r.success) return avisar({ tipo: 'error', texto: r.error })
    avisar({ tipo: 'ok', texto: 'Modelo guardado.' })
    setEdicion(null)
    void cargar()
  }

  const usar = async () => {
    if (!uso) return
    const importe = parsearNumero(uso.importe)
    if (!(importe > 0)) return avisar({ tipo: 'error', texto: 'Ingresá un importe mayor a cero.' })
    const r = await apiService.crearAsientoContable({
      fecha: uso.fecha,
      concepto: uso.modelo.concepto,
      tipo_asiento: uso.modelo.tipo_asiento,
      detalles: lineasDesdeModelo(uso.modelo.detalles, importe)
    })
    if (!r.success || !r.data) return avisar({ tipo: 'error', texto: r.error || 'No se pudo crear el asiento.' })
    if (uso.contabilizar) {
      const c = await apiService.contabilizarAsiento(r.data.id)
      if (!c.success) return avisar({ tipo: 'warn', texto: `Asiento ${r.data.numero_asiento} creado en borrador, pero no se pudo contabilizar: ${c.error}` })
    }
    avisar({ tipo: 'ok', texto: `Asiento ${r.data.numero_asiento} creado${uso.contabilizar ? ' y contabilizado' : ' en borrador'}.` })
    setUso(null)
  }

  const cambiarLinea = (i: number, cambios: Partial<AsientoModeloLinea>) =>
    setEdicion((e) => (e ? { ...e, lineas: e.lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l)) } : e))

  return (
    <>
      <div className="erp-panel">
        <div className="erp-toolbar">
          <button type="button" className="btn-primary" onClick={() => setEdicion({ nombre: '', concepto: '', tipo_asiento: 'Manual', lineas: [nuevaLinea('Debe'), nuevaLinea('Haber')] })}>
            + Nuevo modelo
          </button>
        </div>
        {modelos.length === 0 ? (
          <p className="erp-muted">No hay modelos. Creá uno para los asientos que repetís (alquiler, sueldos, amortizaciones…).</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Concepto</th>
                  <th>Líneas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nombre}</td>
                    <td>{m.concepto}</td>
                    <td>
                      {m.detalles.map((d, i) => (
                        <div key={i} className="erp-muted">
                          {d.lado}: {etiqueta(d.id_cuenta)} ({d.porcentaje}%)
                        </div>
                      ))}
                    </td>
                    <td>
                      <div className="erp-section-actions">
                        <button type="button" className="erpx-btn-sm" onClick={() => setUso({ modelo: m, importe: '', fecha: hoyIso(), contabilizar: false })}>
                          Usar
                        </button>
                        <button type="button" className="erpx-btn-sm" onClick={() => setEdicion({ id: m.id, nombre: m.nombre, concepto: m.concepto, tipo_asiento: m.tipo_asiento, lineas: m.detalles })}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="erpx-btn-sm is-danger"
                          onClick={async () => {
                            if (!window.confirm(`¿Eliminar el modelo "${m.nombre}"?`)) return
                            const r = await eliminarAsientoModelo(m.id)
                            if (!r.success) return avisar({ tipo: 'error', texto: r.error })
                            void cargar()
                          }}
                        >
                          Eliminar
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

      {uso && (
        <div className="erp-panel">
          <h2>Usar "{uso.modelo.nombre}"</h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Importe</span>
              <input value={uso.importe} onChange={(e) => setUso({ ...uso, importe: e.target.value })} placeholder="0,00" />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Fecha</span>
              <input type="date" value={uso.fecha} onChange={(e) => setUso({ ...uso, fecha: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Contabilizar</span>
              <select value={uso.contabilizar ? 'si' : 'no'} onChange={(e) => setUso({ ...uso, contabilizar: e.target.value === 'si' })}>
                <option value="no">Dejar en borrador</option>
                <option value="si">Contabilizar al crear</option>
              </select>
            </label>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" onClick={() => void usar()}>
              Generar asiento
            </button>
            <button type="button" className="btn-secondary" onClick={() => setUso(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {edicion && (
        <div className="erp-panel">
          <h2>{edicion.id ? 'Editar modelo' : 'Nuevo modelo'}</h2>
          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Nombre</span>
              <input value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Concepto del asiento</span>
              <input value={edicion.concepto} onChange={(e) => setEdicion({ ...edicion, concepto: e.target.value })} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Tipo</span>
              <select value={edicion.tipo_asiento} onChange={(e) => setEdicion({ ...edicion, tipo_asiento: e.target.value as AsientoModelo['tipo_asiento'] })}>
                {['Manual', 'Automático', 'Facturación', 'Compra', 'Pago', 'Cobro', 'Ajuste'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="erp-table-wrap" style={{ marginTop: 14 }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Lado</th>
                  <th>Cuenta</th>
                  <th>% del importe</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {edicion.lineas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <select value={l.lado} onChange={(e) => cambiarLinea(i, { lado: e.target.value as 'Debe' | 'Haber' })}>
                        <option>Debe</option>
                        <option>Haber</option>
                      </select>
                    </td>
                    <td>
                      <select value={l.id_cuenta || ''} onChange={(e) => cambiarLinea(i, { id_cuenta: Number(e.target.value) })}>
                        <option value="">— elegir —</option>
                        {cuentas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.codigo} · {c.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0.001" step="0.001" value={l.porcentaje} onChange={(e) => cambiarLinea(i, { porcentaje: Number(e.target.value) || 0 })} style={{ width: 90 }} />
                    </td>
                    <td>
                      {edicion.lineas.length > 2 && (
                        <button type="button" className="erpx-btn-sm is-danger" onClick={() => setEdicion({ ...edicion, lineas: edicion.lineas.filter((_, j) => j !== i) })}>
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-secondary" onClick={() => setEdicion({ ...edicion, lineas: [...edicion.lineas, nuevaLinea('Debe')] })}>
              + Línea
            </button>
            <button type="button" className="btn-primary" onClick={() => void guardar()}>
              Guardar modelo
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </button>
          </div>
          <p className="erp-muted" style={{ marginTop: 8 }}>
            Los porcentajes del Debe deben sumar lo mismo que los del Haber.
          </p>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
type AsientoImport = { referencia: string; fecha: string; filas: Array<{ id_cuenta: number; debe: number; haber: number; concepto: string }>; errores: string[] }

function Importar({ cuentas, avisar }: { cuentas: PlanCuentaRecord[]; avisar: (m: Msg) => void }) {
  const [asientos, setAsientos] = useState<AsientoImport[]>([])
  const [archivo, setArchivo] = useState('')
  const [importando, setImportando] = useState(false)

  const leer = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setArchivo(file.name)
    const filas = parsearCsv(await file.text())
    if (filas.length < 2) return avisar({ tipo: 'error', texto: 'El archivo no tiene datos.' })
    const cab = filas[0].map((h) => h.trim().toLowerCase())
    const col = (n: string) => cab.indexOf(n)
    const faltan = ['referencia', 'fecha', 'cuenta', 'debe', 'haber'].filter((n) => col(n) < 0)
    if (faltan.length) return avisar({ tipo: 'error', texto: `Faltan columnas: ${faltan.join(', ')}.` })

    const grupos = new Map<string, AsientoImport>()
    filas.slice(1).forEach((f, idx) => {
      const ref = (f[col('referencia')] ?? '').trim()
      const clave = ref || `fila-${idx + 2}`
      const g = grupos.get(clave) ?? { referencia: clave, fecha: (f[col('fecha')] ?? '').trim(), filas: [], errores: [] }
      const codigo = (f[col('cuenta')] ?? '').trim()
      const cuenta = cuentas.find((c) => c.codigo === codigo)
      const debe = parsearNumero(f[col('debe')] ?? '')
      const haber = parsearNumero(f[col('haber')] ?? '')
      if (!cuenta) g.errores.push(`Fila ${idx + 2}: cuenta "${codigo}" no existe o está inactiva.`)
      else if ((debe > 0) === (haber > 0)) g.errores.push(`Fila ${idx + 2}: cargá debe o haber (uno solo).`)
      else g.filas.push({ id_cuenta: cuenta.id, debe, haber, concepto: (f[col('concepto')] ?? '').trim() })
      if ((f[col('fecha')] ?? '').trim() && (f[col('fecha')] ?? '').trim() !== g.fecha) g.errores.push(`Fila ${idx + 2}: la fecha difiere dentro del mismo asiento.`)
      grupos.set(clave, g)
    })
    const lista = [...grupos.values()]
    for (const g of lista) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(g.fecha)) g.errores.push('Fecha inválida (usar AAAA-MM-DD).')
      const d = g.filas.reduce((s, x) => s + x.debe, 0)
      const h = g.filas.reduce((s, x) => s + x.haber, 0)
      if (Math.abs(d - h) > 0.01) g.errores.push(`No balancea: debe ${d.toFixed(2)} / haber ${h.toFixed(2)}.`)
      if (g.filas.length < 2) g.errores.push('Necesita al menos dos líneas.')
    }
    setAsientos(lista)
  }

  const validos = asientos.filter((a) => a.errores.length === 0)

  const importar = async () => {
    setImportando(true)
    let creados = 0
    const fallos: string[] = []
    for (const a of validos) {
      const r = await apiService.crearAsientoContable({
        fecha: a.fecha,
        concepto: a.filas[0]?.concepto || `Importado ${a.referencia}`,
        tipo_asiento: 'Manual',
        detalles: a.filas,
        observaciones: `Importación CSV (${archivo}) · ref ${a.referencia}`
      })
      if (r.success) creados += 1
      else fallos.push(`${a.referencia}: ${r.error}`)
    }
    setImportando(false)
    avisar({
      tipo: fallos.length ? 'warn' : 'ok',
      texto: `${creados} asiento(s) creados en borrador.${fallos.length ? ` No se pudieron crear: ${fallos.join(' · ')}` : ''}`
    })
    if (!fallos.length) setAsientos([])
  }

  return (
    <div className="erp-panel">
      <h2>Importar asientos desde CSV</h2>
      <p className="erp-muted">
        Columnas: <span className="erpx-mono">referencia; fecha; cuenta; debe; haber; concepto</span>. Las filas con la misma referencia forman un asiento. La cuenta es el código del plan de cuentas.
      </p>
      <div className="erpx-actions">
        <label className="btn-primary" style={{ cursor: 'pointer' }}>
          Elegir archivo
          <input type="file" accept=".csv,text/csv" onChange={(e) => void leer(e)} style={{ display: 'none' }} />
        </label>
        <button type="button" className="btn-secondary" onClick={() => descargarTexto('plantilla_asientos.csv', PLANTILLA_CSV, 'text/csv;charset=utf-8')}>
          Descargar plantilla
        </button>
      </div>

      {asientos.length > 0 && (
        <>
          <p style={{ marginTop: 14 }}>
            {validos.length} válido(s) de {asientos.length}.
          </p>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Fecha</th>
                  <th className="erpx-right">Líneas</th>
                  <th className="erpx-right">Debe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {asientos.map((a) => (
                  <tr key={a.referencia}>
                    <td>{a.referencia}</td>
                    <td>{a.fecha}</td>
                    <td className="erpx-right">{a.filas.length}</td>
                    <td className="erpx-right">{fmtMoney(a.filas.reduce((s, x) => s + x.debe, 0))}</td>
                    <td>
                      {a.errores.length === 0 ? (
                        <span className="erp-pill ok">OK</span>
                      ) : (
                        <>
                          <span className="erp-pill danger">Con errores</span>
                          <ul className="erpx-list">
                            {a.errores.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" disabled={importando || validos.length === 0} onClick={() => void importar()}>
              {importando ? 'Importando…' : `Importar ${validos.length} asiento(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
type FilaAjuste = { id: number; nombre: string; resultado: AjusteCuenta }

function Inflacion({ cuentas, avisar }: { cuentas: PlanCuentaRecord[]; avisar: (m: Msg) => void }) {
  const anio = new Date().getFullYear()
  const [inicio, setInicio] = useState(`${anio}-01`)
  const [cierre, setCierre] = useState(`${anio}-12`)
  const [indices, setIndices] = useState<Record<string, number>>({})
  const [pegado, setPegado] = useState('')
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [recpam, setRecpam] = useState('')
  const [filas, setFilas] = useState<FilaAjuste[]>([])
  const [calculando, setCalculando] = useState(false)

  const cargarIndices = async () => {
    const r = await listIndicesInflacion()
    if (r.success) setIndices(Object.fromEntries(r.data.map((x) => [x.periodo, x.indice])))
    else avisar({ tipo: 'error', texto: r.error })
  }

  useEffect(() => {
    void cargarIndices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cuentas.length && seleccion.size === 0) {
      setSeleccion(new Set(cuentas.filter((c) => ES_NO_MONETARIA.test(c.nombre)).map((c) => c.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentas])

  const guardarPegado = async () => {
    const filasIdx = pegado
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d{4}-\d{2})\s*[;\t,\s]\s*(.+)$/)
        return { periodo: m?.[1] ?? '', indice: parsearNumero(m?.[2] ?? ''), fuente: 'Carga manual' }
      })
    const invalidas = filasIdx.filter((f) => !esPeriodoValido(f.periodo) || !(f.indice > 0))
    if (filasIdx.length === 0 || invalidas.length) {
      return avisar({ tipo: 'error', texto: 'Usá una línea por mes: AAAA-MM;índice (por ejemplo 2026-03;1234,56).' })
    }
    const r = await guardarIndicesInflacion(filasIdx)
    if (!r.success) return avisar({ tipo: 'error', texto: r.error })
    avisar({ tipo: 'ok', texto: `${r.data} índice(s) guardados.` })
    setPegado('')
    void cargarIndices()
  }

  const calcular = async () => {
    if (!esPeriodoValido(inicio) || !esPeriodoValido(cierre) || inicio > cierre) return avisar({ tipo: 'error', texto: 'Revisá los períodos de inicio y cierre.' })
    if (seleccion.size === 0) return avisar({ tipo: 'error', texto: 'Elegí al menos una cuenta.' })
    setCalculando(true)
    const r = await movimientosMensualesPorCuenta(rangoPeriodo(cierre).hasta)
    setCalculando(false)
    if (!r.success) return avisar({ tipo: 'error', texto: r.error })
    const lista: FilaAjuste[] = [...seleccion].map((id) => {
      const porMes = r.data.get(id) ?? new Map<string, number>()
      const movs = [...porMes.entries()].map(([periodo, neto]) => ({ periodo, neto }))
      return { id, nombre: cuentas.find((c) => c.id === id)?.nombre ?? `#${id}`, resultado: calcularAjusteCuenta(movs, indices, inicio, cierre) }
    })
    setFilas(lista.filter((f) => f.resultado.saldoHistorico !== 0 || f.resultado.ajuste !== 0))
  }

  const faltantes = useMemo(() => [...new Set(filas.flatMap((f) => f.resultado.periodosSinIndice))].sort(), [filas])
  const asiento = useMemo(
    () => (recpam ? armarAsientoAjuste(filas.map((f) => ({ id_cuenta: f.id, nombre: f.nombre, ajuste: f.resultado.ajuste })), Number(recpam)) : null),
    [filas, recpam]
  )

  const generar = async () => {
    if (!asiento || asiento.detalles.length < 2) return avisar({ tipo: 'error', texto: 'No hay ajustes para registrar.' })
    if (faltantes.length && !window.confirm(`Faltan índices de: ${faltantes.join(', ')}. Esos movimientos no se ajustaron. ¿Generar igual?`)) return
    const r = await apiService.crearAsientoContable({
      fecha: rangoPeriodo(cierre).hasta,
      concepto: `Ajuste por inflación ${inicio} a ${cierre}`,
      tipo_asiento: 'Ajuste',
      detalles: asiento.detalles,
      observaciones: 'Generado con ajuste por inflación simplificado (RT 6). Revisar antes de contabilizar.'
    })
    if (!r.success || !r.data) return avisar({ tipo: 'error', texto: r.error || 'No se pudo crear el asiento.' })
    avisar({ tipo: 'ok', texto: `Asiento ${r.data.numero_asiento} creado en borrador.` })
  }

  const indicesOrdenados = Object.entries(indices).sort(([a], [b]) => (a < b ? 1 : -1))

  return (
    <>
      <div className="erp-panel">
        <h2>Índices (IPC / FACPCE)</h2>
        <div className="erpx-form">
          <label className="erp-field erp-field--wide">
            <span className="erp-field__label">Pegar índices (una línea por mes: AAAA-MM;índice)</span>
            <textarea className="erpx-textarea" value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder={'2026-01;6120,45\n2026-02;6221,10'} />
          </label>
        </div>
        <div className="erpx-actions">
          <button type="button" className="btn-secondary" onClick={() => void guardarPegado()}>
            Guardar índices
          </button>
        </div>
        {indicesOrdenados.length > 0 && (
          <p className="erp-muted" style={{ marginTop: 10 }}>
            Cargados: {indicesOrdenados.slice(0, 12).map(([p, v]) => `${p} = ${v}`).join(' · ')}
            {indicesOrdenados.length > 12 ? ` · … (${indicesOrdenados.length} en total)` : ''}
          </p>
        )}
      </div>

      <div className="erp-panel">
        <h2>Ajuste del ejercicio</h2>
        <div className="erpx-form">
          <label className="erp-field">
            <span className="erp-field__label">Inicio del ejercicio</span>
            <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Cierre</span>
            <input type="month" value={cierre} onChange={(e) => setCierre(e.target.value)} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Cuenta RECPAM (resultado)</span>
            <select value={recpam} onChange={(e) => setRecpam(e.target.value)}>
              <option value="">— elegir —</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h2 style={{ marginTop: 16 }}>Cuentas no monetarias a ajustar</h2>
        <div className="erpx-checks">
          {cuentas.map((c) => (
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
                {c.codigo} · {c.nombre}
              </span>
            </label>
          ))}
        </div>
        <div className="erpx-actions">
          <button type="button" className="btn-primary" disabled={calculando} onClick={() => void calcular()}>
            {calculando ? 'Calculando…' : 'Calcular ajuste'}
          </button>
        </div>
      </div>

      {filas.length > 0 && (
        <div className="erp-panel">
          <h2>Resultado</h2>
          {faltantes.length > 0 && <p className="erpx-msg erpx-msg--warn">Faltan índices de {faltantes.join(', ')}: esos movimientos quedan sin ajustar.</p>}
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th className="erpx-right">Saldo histórico</th>
                  <th className="erpx-right">Saldo ajustado</th>
                  <th className="erpx-right">Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nombre}</td>
                    <td className="erpx-right">{fmtMoney(f.resultado.saldoHistorico)}</td>
                    <td className="erpx-right">{fmtMoney(f.resultado.saldoAjustado)}</td>
                    <td className="erpx-right">{fmtMoney(f.resultado.ajuste)}</td>
                  </tr>
                ))}
                {asiento && (
                  <tr>
                    <td colSpan={3}>
                      <strong>RECPAM (contrapartida)</strong>
                    </td>
                    <td className="erpx-right">
                      <strong>
                        {fmtMoney(
                          (asiento.detalles.find((d) => d.id_cuenta === Number(recpam) && d.concepto === 'RECPAM')?.debe ?? 0) -
                            (asiento.detalles.find((d) => d.id_cuenta === Number(recpam) && d.concepto === 'RECPAM')?.haber ?? 0)
                        )}
                      </strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="erpx-actions">
            <button type="button" className="btn-primary" disabled={!asiento} onClick={() => void generar()}>
              Generar asiento de ajuste (borrador)
            </button>
          </div>
          <p className="erp-muted" style={{ marginTop: 8 }}>
            Cálculo simplificado: cada movimiento se reexpresa al índice de cierre y el saldo previo al ejercicio se toma ya ajustado al mes de inicio. Revisalo con el contador antes de contabilizar.
          </p>
        </div>
      )}
    </>
  )
}
