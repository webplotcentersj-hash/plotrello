import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  contactosClientes,
  cxcPendientes,
  deudasCuentaCorriente,
  diasEntre,
  habitosDePago,
  nombreContacto,
  sumarDias,
  type ClienteContacto,
  type HabitoPago
} from '../services/erpGestionApi'
import { getArgentinaDateString } from '../utils/dateUtils'
import { descargarCsv, fmtFecha, fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

type Tramo = 'aldia' | 't30' | 't60' | 't90' | 'tmas'
const TRAMOS: { id: Tramo; label: string; color: string }[] = [
  { id: 'aldia', label: 'A vencer', color: '#64748b' },
  { id: 't30', label: '1–30 días', color: '#facc15' },
  { id: 't60', label: '31–60 días', color: '#fb923c' },
  { id: 't90', label: '61–90 días', color: '#f87171' },
  { id: 'tmas', label: 'Más de 90', color: '#be123c' }
]

const tramoDe = (diasVencido: number): Tramo =>
  diasVencido <= 0 ? 'aldia' : diasVencido <= 30 ? 't30' : diasVencido <= 60 ? 't60' : diasVencido <= 90 ? 't90' : 'tmas'

type Deuda = { origen: 'factura' | 'cc'; detalle: string; fecha: string; vence: string; diasVencido: number; monto: number }

type FilaCliente = {
  clave: string
  id_cliente: number | null
  nombre: string
  contacto?: ClienteContacto
  deudas: Deuda[]
  total: number
  vencido: number
  maxDias: number
  porTramo: Record<Tramo, number>
  habito?: HabitoPago
  prioridad: number
}

const K_RECORDATORIOS = 'erp_cobranza_recordatorios'
const DIAS_CC = 30 // las ventas fiadas se consideran vencidas a los 30 días

function calificacion(h?: HabitoPago): { texto: string; tono: 'ok' | 'warn' | 'orange' | 'danger' | 'info' } {
  if (!h || h.facturas === 0) return { texto: 'Sin historial', tono: 'info' }
  if (h.atrasoPromedio <= 3) return { texto: 'Paga a término', tono: 'ok' }
  if (h.atrasoPromedio <= 15) return { texto: `Se atrasa ~${h.atrasoPromedio} días`, tono: 'warn' }
  if (h.atrasoPromedio <= 45) return { texto: `Se atrasa ~${h.atrasoPromedio} días`, tono: 'orange' }
  return { texto: `Muy moroso (~${h.atrasoPromedio} días)`, tono: 'danger' }
}

/** Normaliza a formato internacional argentino para wa.me (549 + área + número). */
function telefonoWhatsapp(tel: string | null | undefined): string | null {
  let d = String(tel || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9')) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  // "15" del celular sólo si sobra (área + 15 + número = 12 dígitos).
  if (d.length === 12) d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
  return d.length >= 10 ? `549${d}` : null
}

export default function ErpCobranzaPage() {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const [filas, setFilas] = useState<FilaCliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [errores, setErrores] = useState<string[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [soloVencidos, setSoloVencidos] = useState(true)
  const [tramoFiltro, setTramoFiltro] = useState<Tramo | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [recordatorios, setRecordatorios] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(K_RECORDATORIOS) || '{}')
    } catch {
      return {}
    }
  })
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setCargando(true)
      const errs: string[] = []
      const [cxc, cc, hab] = await Promise.all([cxcPendientes(), deudasCuentaCorriente(), habitosDePago()])
      if (!cxc.success) errs.push(`Facturas: ${cxc.error}`)
      if (!cc.success) errs.push(`Cuenta corriente: ${cc.error}`)
      const ids = [
        ...(cxc.success ? cxc.data.map((c) => c.id_cliente) : []),
        ...(cc.success ? cc.data.map((c) => c.id_cliente) : [])
      ].filter((x): x is number => x != null)
      const contactos = await contactosClientes(ids)
      const mapa = new Map<string, FilaCliente>()
      const fila = (id: number | null, nombre: string): FilaCliente => {
        const clave = id != null ? `c${id}` : `n${nombre.toLowerCase()}`
        let f = mapa.get(clave)
        if (!f) {
          const contacto = id != null && contactos.success ? contactos.data.get(id) : undefined
          f = {
            clave,
            id_cliente: id,
            nombre: nombreContacto(contacto, nombre),
            contacto,
            deudas: [],
            total: 0,
            vencido: 0,
            maxDias: 0,
            porTramo: { aldia: 0, t30: 0, t60: 0, t90: 0, tmas: 0 },
            habito: id != null && hab.success ? hab.data.get(id) : undefined,
            prioridad: 0
          }
          mapa.set(clave, f)
        }
        return f
      }
      const agregar = (f: FilaCliente, d: Deuda) => {
        f.deudas.push(d)
        f.total += d.monto
        if (d.diasVencido > 0) f.vencido += d.monto
        f.maxDias = Math.max(f.maxDias, d.diasVencido)
        f.porTramo[tramoDe(d.diasVencido)] += d.monto
      }
      if (cxc.success)
        for (const c of cxc.data) {
          const vence = c.fecha_vencimiento ?? sumarDias(c.fecha_emision, 30)
          agregar(fila(c.id_cliente, c.cliente_nombre), {
            origen: 'factura',
            detalle: `Factura ${c.numero_factura ?? `#${c.id_factura}`}`,
            fecha: c.fecha_emision,
            vence,
            diasVencido: diasEntre(vence, hoy),
            monto: c.monto_pendiente
          })
        }
      if (cc.success)
        for (const c of cc.data)
          for (const t of c.tramos) {
            const vence = sumarDias(t.fecha, DIAS_CC)
            agregar(fila(c.id_cliente, `Cliente #${c.id_cliente}`), {
              origen: 'cc',
              detalle: 'Cuenta corriente (venta fiada)',
              fecha: t.fecha,
              vence,
              diasVencido: diasEntre(vence, hoy),
              monto: t.monto
            })
          }
      const lista = [...mapa.values()].map((f) => {
        f.deudas.sort((a, b) => b.diasVencido - a.diasVencido)
        // Prioridad: monto vencido pesado por antigüedad y por mal hábito de pago.
        const pesoHabito = f.habito ? 1 + Math.min(1, f.habito.atrasoPromedio / 60) : 1
        f.prioridad = f.vencido * (1 + f.maxDias / 30) * pesoHabito
        return f
      })
      lista.sort((a, b) => b.prioridad - a.prioridad || b.total - a.total)
      setFilas(lista)
      setErrores(errs)
      setCargando(false)
    })()
  }, [hoy])

  const totales = useMemo(() => {
    const porTramo: Record<Tramo, number> = { aldia: 0, t30: 0, t60: 0, t90: 0, tmas: 0 }
    for (const f of filas) for (const t of TRAMOS) porTramo[t.id] += f.porTramo[t.id]
    const total = filas.reduce((s, f) => s + f.total, 0)
    const vencido = filas.reduce((s, f) => s + f.vencido, 0)
    return { porTramo, total, vencido, clientesVencidos: filas.filter((f) => f.vencido > 0).length, mas60: porTramo.t90 + porTramo.tmas }
  }, [filas])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter(
      (f) => (!soloVencidos || f.vencido > 0) && (!tramoFiltro || f.porTramo[tramoFiltro] > 0) && (!q || f.nombre.toLowerCase().includes(q))
    )
  }, [filas, soloVencidos, tramoFiltro, busqueda])

  const mensaje = (f: FilaCliente) => {
    const vencidas = f.deudas.filter((d) => d.diasVencido > 0)
    const lineas = (vencidas.length ? vencidas : f.deudas)
      .slice(0, 8)
      .map((d) => `• ${d.detalle} del ${fmtFecha(d.fecha)}: ${fmtMoney(d.monto)}${d.diasVencido > 0 ? ` (vencida hace ${d.diasVencido} días)` : ''}`)
    const saludo = f.contacto?.nombre ? `Hola ${f.contacto.nombre}` : 'Hola'
    return `${saludo}, ¿cómo estás? Te escribimos de Plot Center para recordarte el saldo pendiente:\n\n${lineas.join('\n')}\n\nTotal ${vencidas.length ? 'vencido' : 'pendiente'}: ${fmtMoney(vencidas.length ? f.vencido : f.total)}.\n¿Nos confirmás cuándo podés regularizarlo? ¡Gracias!`
  }

  const registrarRecordatorio = (f: FilaCliente) => {
    const r = { ...recordatorios, [f.clave]: hoy }
    setRecordatorios(r)
    localStorage.setItem(K_RECORDATORIOS, JSON.stringify(r))
  }

  const copiar = async (f: FilaCliente) => {
    try {
      await navigator.clipboard.writeText(mensaje(f))
      setCopiado(f.clave)
      registrarRecordatorio(f)
      window.setTimeout(() => setCopiado(null), 2000)
    } catch {
      /* sin portapapeles */
    }
  }

  const exportar = () =>
    descargarCsv(
      `cobranza_${hoy}.csv`,
      ['Cliente', 'Teléfono', 'Total', 'Vencido', 'A vencer', '1-30', '31-60', '61-90', '+90', 'Días máx.', 'Calificación'],
      visibles.map((f) => [
        f.nombre,
        f.contacto?.telefono ?? '',
        f.total,
        f.vencido,
        f.porTramo.aldia,
        f.porTramo.t30,
        f.porTramo.t60,
        f.porTramo.t90,
        f.porTramo.tmas,
        f.maxDias,
        calificacion(f.habito).texto
      ])
    )

  const maxTotal = Math.max(1, ...visibles.map((f) => f.total))

  return (
    <div className="erp-section gx">
      <ErpPageHeader
        icon="📞"
        titulo="Cobranza"
        subtitulo="A quién cobrarle primero: deuda por antigüedad, cómo paga cada cliente y recordatorio por WhatsApp o mail."
        volverA="/erp"
        volverTexto="ERP"
      >
        <button type="button" className="btn-secondary" onClick={exportar} disabled={!visibles.length}>
          Exportar CSV
        </button>
      </ErpPageHeader>

      {errores.length > 0 && (
        <div className="gx-banner gx-banner--warn">
          <span className="gx-banner__icono">⚠️</span>
          <div>{errores.join(' · ')}</div>
        </div>
      )}

      <div className="gx-tiles">
        <div className="gx-tile gx-tile--info">
          <span className="gx-tile__label">Total a cobrar</span>
          <span className="gx-tile__valor">{fmtMoney(totales.total)}</span>
          <span className="gx-tile__sub">{filas.length} clientes</span>
        </div>
        <div className="gx-tile gx-tile--danger">
          <span className="gx-tile__label">Vencido</span>
          <span className="gx-tile__valor">{fmtMoney(totales.vencido)}</span>
          <span className="gx-tile__sub">
            {totales.total ? Math.round((totales.vencido / totales.total) * 100) : 0}% del total · {totales.clientesVencidos} clientes
          </span>
        </div>
        <div className="gx-tile gx-tile--warn">
          <span className="gx-tile__label">Más de 60 días</span>
          <span className="gx-tile__valor">{fmtMoney(totales.mas60)}</span>
          <span className="gx-tile__sub">difícil de cobrar si sigue creciendo</span>
        </div>
      </div>

      {!cargando && totales.total > 0 && (
        <section className="erp-panel">
          <div className="gx-cab">
            <h2>Antigüedad de la deuda</h2>
            <span className="gx-mini">Tocá un tramo para filtrar</span>
          </div>
          <div className="gx-stack" style={{ height: 18 }} role="img" aria-label="Deuda por antigüedad">
            {TRAMOS.filter((t) => totales.porTramo[t.id] > 0).map((t) => (
              <span
                key={t.id}
                title={`${t.label}: ${fmtMoney(totales.porTramo[t.id])}`}
                style={{ width: `${(totales.porTramo[t.id] / totales.total) * 100}%`, background: t.color, cursor: 'pointer' }}
                onClick={() => {
                  setTramoFiltro(tramoFiltro === t.id ? '' : t.id)
                  setSoloVencidos(t.id !== 'aldia')
                }}
              />
            ))}
          </div>
          <div className="gx-leyenda" style={{ marginTop: 10 }}>
            {TRAMOS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`gx-chip ${tramoFiltro === t.id ? 'is-on' : ''}`}
                onClick={() => {
                  setTramoFiltro(tramoFiltro === t.id ? '' : t.id)
                  setSoloVencidos(t.id !== 'aldia')
                }}
              >
                <i className="gx-sw" style={{ background: t.color }} />
                {t.label} · <strong>{fmtMoney(totales.porTramo[t.id])}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="gx-controles">
        <label className="erp-field">
          <span className="erp-field__label">Buscar cliente</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o empresa" />
        </label>
        <label className="cmp-check" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}>
          <input type="checkbox" checked={soloVencidos} onChange={(e) => setSoloVencidos(e.target.checked)} />
          Sólo con deuda vencida
        </label>
      </div>

      <section className="erp-panel">
        <div className="gx-cab">
          <h2>Por quién empezar</h2>
          <span className="gx-mini">Ordenado por prioridad: monto vencido × antigüedad × cómo suele pagar.</span>
        </div>
        {cargando ? (
          <p className="erp-muted">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="erp-muted">{filas.length ? 'Nadie con esos filtros. 🎉' : 'No hay deudas de clientes.'}</p>
        ) : (
          <div className="gx-tabla-wrap">
            <table className="gx-tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Antigüedad</th>
                  <th className="num">Vencido</th>
                  <th className="num">Total</th>
                  <th>Cómo paga</th>
                  <th>Recordatorio</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f, i) => {
                  const cal = calificacion(f.habito)
                  const wa = telefonoWhatsapp(f.contacto?.telefono)
                  const ultimo = recordatorios[f.clave]
                  const hace = ultimo ? diasEntre(ultimo, hoy) : null
                  return (
                    <Fragment key={f.clave}>
                      <tr className="is-click" onClick={() => setAbierta(abierta === f.clave ? null : f.clave)}>
                        <td className="gx-mini">{i + 1}</td>
                        <td>
                          <strong>{f.nombre}</strong>
                          <div className="gx-mini">
                            {f.deudas.length} comprobante{f.deudas.length === 1 ? '' : 's'}
                            {f.maxDias > 0 ? ` · el más viejo vencido hace ${f.maxDias} días` : ''}
                          </div>
                        </td>
                        <td>
                          <div className="gx-stack" style={{ width: `${Math.max(8, (f.total / maxTotal) * 100)}%` }}>
                            {TRAMOS.filter((t) => f.porTramo[t.id] > 0).map((t) => (
                              <span key={t.id} title={`${t.label}: ${fmtMoney(f.porTramo[t.id])}`} style={{ width: `${(f.porTramo[t.id] / f.total) * 100}%`, background: t.color }} />
                            ))}
                          </div>
                        </td>
                        <td className="num">
                          <strong className={f.vencido > 0 ? 'gx-neg' : ''}>{f.vencido ? fmtMoney(f.vencido) : '—'}</strong>
                        </td>
                        <td className="num">{fmtMoney(f.total)}</td>
                        <td>
                          <span className={`gx-pill gx-pill--${cal.tono}`}>{cal.texto}</span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="erp-section-actions" style={{ flexWrap: 'wrap' }}>
                            {wa ? (
                              <a
                                className="erpx-btn-sm"
                                href={`https://wa.me/${wa}?text=${encodeURIComponent(mensaje(f))}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => registrarRecordatorio(f)}
                              >
                                WhatsApp
                              </a>
                            ) : null}
                            {f.contacto?.email ? (
                              <a
                                className="erpx-btn-sm"
                                href={`mailto:${f.contacto.email}?subject=${encodeURIComponent('Saldo pendiente - Plot Center')}&body=${encodeURIComponent(mensaje(f))}`}
                                onClick={() => registrarRecordatorio(f)}
                              >
                                Mail
                              </a>
                            ) : null}
                            <button type="button" className="erpx-btn-sm" onClick={() => void copiar(f)}>
                              {copiado === f.clave ? '¡Copiado!' : 'Copiar mensaje'}
                            </button>
                          </div>
                          {hace !== null && (
                            <div className={`gx-mini ${hace >= 7 && f.vencido > 0 ? 'gx-neg' : ''}`}>
                              Recordado {hace === 0 ? 'hoy' : `hace ${hace} día${hace === 1 ? '' : 's'}`}
                              {hace >= 7 && f.vencido > 0 ? ' · volver a insistir' : ''}
                            </div>
                          )}
                          {!wa && !f.contacto?.email && <div className="gx-mini">Sin teléfono ni mail cargado</div>}
                        </td>
                      </tr>
                      {abierta === f.clave &&
                        f.deudas.map((d, j) => (
                          <tr key={j} className="gx-detalle">
                            <td />
                            <td>
                              {d.detalle}
                              <div className="gx-mini">emitida {fmtFecha(d.fecha)}</div>
                            </td>
                            <td>
                              <span className="gx-pill" style={{ ['--p-c' as string]: TRAMOS.find((t) => t.id === tramoDe(d.diasVencido))?.color }}>
                                {d.diasVencido > 0 ? `vencida hace ${d.diasVencido} días` : `vence ${fmtFecha(d.vence)}`}
                              </span>
                            </td>
                            <td className="num">{d.diasVencido > 0 ? fmtMoney(d.monto) : '—'}</td>
                            <td className="num">{fmtMoney(d.monto)}</td>
                            <td colSpan={2}>
                              {d.origen === 'cc' && f.id_cliente != null && (
                                <button type="button" className="erpx-btn-sm" onClick={() => navigate(`/clientes/cuenta-corriente/cliente/${f.id_cliente}`)}>
                                  Ver cuenta corriente
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="gx-mini">
        La calificación sale de las facturas ya cobradas: días entre el vencimiento y el último cobro. Las ventas fiadas en cuenta corriente se consideran
        vencidas a los {DIAS_CC} días.
      </p>
    </div>
  )
}
