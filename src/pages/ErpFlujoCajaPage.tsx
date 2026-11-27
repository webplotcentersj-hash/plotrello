import { Fragment, useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import { K_SALDO_INICIAL, ORIGEN_LABEL, cargarMovimientosFlujo, parseMonto, semanasFlujo, type MovFlujo, type OrigenFlujo, type SemanaFlujo } from '../features/gestion/flujoCaja'
import { getArgentinaDateString } from '../utils/dateUtils'
import { descargarCsv, fmtCorto, fmtFecha, fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

const K_SALDO = K_SALDO_INICIAL
const ORIGENES: OrigenFlujo[] = ['compromiso', 'factura', 'proveedor', 'gasto_fijo']
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export default function ErpFlujoCajaPage() {
  const hoy = getArgentinaDateString()
  const [semanas, setSemanas] = useState(13)
  const [movs, setMovs] = useState<MovFlujo[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [saldoTexto, setSaldoTexto] = useState(() => localStorage.getItem(K_SALDO) ?? '')
  const [activos, setActivos] = useState<Record<OrigenFlujo, boolean>>({ compromiso: true, factura: true, proveedor: true, gasto_fijo: true })
  const [abierta, setAbierta] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    void cargarMovimientosFlujo(hoy, semanas * 7 + 7).then((r) => {
      if (!vivo) return
      setMovs(r.movs)
      setErrores(r.errores)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [hoy, semanas])

  const saldoInicial = parseMonto(saldoTexto)
  const filtrados = useMemo(() => movs.filter((m) => activos[m.origen]), [movs, activos])
  const sem = useMemo(() => semanasFlujo(filtrados, hoy, semanas, saldoInicial), [filtrados, hoy, semanas, saldoInicial])

  const totales = useMemo(() => {
    const entra = sem.reduce((s, x) => s + x.entra, 0)
    const sale = sem.reduce((s, x) => s + x.sale, 0)
    const minimo = sem.reduce<SemanaFlujo | null>((m, x) => (!m || x.saldoFinal < m.saldoFinal ? x : m), null)
    const primeraNegativa = sem.find((x) => x.saldoFinal < 0) ?? null
    return { entra, sale, final: sem.length ? sem[sem.length - 1].saldoFinal : saldoInicial, minimo, primeraNegativa }
  }, [sem, saldoInicial])

  const porOrigen = useMemo(
    () =>
      ORIGENES.map((o) => {
        const de = movs.filter((m) => m.origen === o)
        return {
          o,
          entra: de.filter((m) => m.sentido === 'entra').reduce((s, m) => s + m.importe, 0),
          sale: de.filter((m) => m.sentido === 'sale').reduce((s, m) => s + m.importe, 0),
          n: de.length
        }
      }),
    [movs]
  )

  // ------------------------------------------------------------------ gráfico
  const W = 920
  const H = 300
  const pad = { l: 64, r: 16, t: 16, b: 30 }
  const anchoSemana = (W - pad.l - pad.r) / Math.max(1, sem.length)
  const maxY = Math.max(1, saldoInicial, ...sem.flatMap((s) => [s.entra, s.saldoFinal]))
  const minY = Math.min(0, ...sem.flatMap((s) => [-s.sale, s.saldoFinal]))
  const y = (v: number) => pad.t + ((maxY - v) / (maxY - minY)) * (H - pad.t - pad.b)
  const ticks = useMemo(() => {
    const rango = maxY - minY
    const paso = Math.pow(10, Math.floor(Math.log10(rango / 4)))
    const mult = [1, 2, 5, 10].find((m) => rango / (paso * m) <= 5) ?? 10
    const p = paso * mult
    const out: number[] = []
    for (let v = Math.ceil(minY / p) * p; v <= maxY; v += p) out.push(v)
    return out
  }, [maxY, minY])
  const barW = Math.min(18, anchoSemana * 0.32)
  const cx = (i: number) => pad.l + anchoSemana * i + anchoSemana / 2
  const linea = sem.map((s, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${y(s.saldoFinal).toFixed(1)}`).join(' ')

  const exportar = () =>
    descargarCsv(
      `flujo_caja_${hoy}.csv`,
      ['Semana desde', 'Fecha', 'Origen', 'Entra/Sale', 'Concepto', 'Contraparte', 'Importe', 'Nota'],
      sem.flatMap((s) =>
        s.movs.map((m) => [fmtFecha(s.desde), fmtFecha(m.fecha), ORIGEN_LABEL[m.origen], m.sentido === 'entra' ? 'Entra' : 'Sale', m.concepto, m.contraparte, m.importe, m.nota])
      )
    )

  const hayDatos = movs.length > 0

  return (
    <div className="erp-section gx">
      <ErpPageHeader
        icon="🌊"
        titulo="Flujo de caja proyectado"
        subtitulo="Cuánta plata vas a tener cada semana: cheques, compromisos, facturas a cobrar, proveedores y gastos fijos."
        volverA="/erp"
        volverTexto="ERP"
      >
        <button type="button" className="btn-secondary" onClick={exportar} disabled={!hayDatos}>
          Exportar CSV
        </button>
      </ErpPageHeader>

      {errores.length > 0 && (
        <div className="gx-banner gx-banner--warn">
          <span className="gx-banner__icono">⚠️</span>
          <div>
            <strong>Algunas fuentes no se pudieron leer</strong>
            <div className="gx-mini">{errores.join(' · ')}</div>
          </div>
        </div>
      )}

      <div className="gx-controles">
        <label className="erp-field">
          <span className="erp-field__label">Plata disponible hoy (bancos + caja)</span>
          <input
            className="gx-input-num"
            style={{ width: 180 }}
            inputMode="decimal"
            value={saldoTexto}
            placeholder="0"
            onChange={(e) => {
              setSaldoTexto(e.target.value)
              localStorage.setItem(K_SALDO, e.target.value)
            }}
          />
        </label>
        <label className="erp-field">
          <span className="erp-field__label">Horizonte</span>
          <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
            <option value={8}>8 semanas</option>
            <option value={13}>13 semanas (3 meses)</option>
            <option value={26}>26 semanas (6 meses)</option>
          </select>
        </label>
        <div className="gx-chips" role="group" aria-label="Qué incluir">
          {porOrigen.map(({ o, n }) => (
            <button key={o} type="button" className={`gx-chip ${activos[o] ? 'is-on' : ''}`} onClick={() => setActivos((a) => ({ ...a, [o]: !a[o] }))} aria-pressed={activos[o]}>
              {activos[o] ? '✓ ' : ''}
              {ORIGEN_LABEL[o]} <span className="gx-mini">({n})</span>
            </button>
          ))}
        </div>
      </div>

      {!cargando && hayDatos && (
        <>
          {totales.primeraNegativa ? (
            <div className="gx-banner gx-banner--danger">
              <span className="gx-banner__icono">🚨</span>
              <div>
                <strong>
                  La semana del {ddmm(totales.primeraNegativa.desde)} quedás en rojo: {fmtMoney(totales.primeraNegativa.saldoFinal)}
                </strong>
                <div>
                  Esa semana entran {fmtMoney(totales.primeraNegativa.entra)} y salen {fmtMoney(totales.primeraNegativa.sale)}. Opciones: adelantar cobros, pedir
                  plazo a proveedores o descontar cheques.
                  {!saldoTexto && ' (Cargá la plata disponible hoy para que la proyección sea real.)'}
                </div>
              </div>
            </div>
          ) : (
            <div className="gx-banner gx-banner--ok">
              <span className="gx-banner__icono">✅</span>
              <div>
                <strong>Te alcanza en las próximas {semanas} semanas</strong>
                <div>
                  El punto más bajo es {totales.minimo ? `${fmtMoney(totales.minimo.saldoFinal)} la semana del ${ddmm(totales.minimo.desde)}` : '—'}.
                  {!saldoTexto && ' Cargá la plata disponible hoy para afinar el cálculo.'}
                </div>
              </div>
            </div>
          )}

          <div className="gx-tiles">
            <div className="gx-tile gx-tile--info">
              <span className="gx-tile__label">Hoy</span>
              <span className="gx-tile__valor">{fmtMoney(saldoInicial)}</span>
              <span className="gx-tile__sub">plata disponible</span>
            </div>
            <div className="gx-tile gx-tile--ok">
              <span className="gx-tile__label">Entra</span>
              <span className="gx-tile__valor">{fmtMoney(totales.entra)}</span>
              <span className="gx-tile__sub">en {semanas} semanas</span>
            </div>
            <div className="gx-tile gx-tile--danger">
              <span className="gx-tile__label">Sale</span>
              <span className="gx-tile__valor">{fmtMoney(totales.sale)}</span>
              <span className="gx-tile__sub">en {semanas} semanas</span>
            </div>
            <div className={`gx-tile ${totales.minimo && totales.minimo.saldoFinal < 0 ? 'gx-tile--danger' : 'gx-tile--warn'}`}>
              <span className="gx-tile__label">Punto más bajo</span>
              <span className={`gx-tile__valor ${totales.minimo && totales.minimo.saldoFinal < 0 ? 'gx-neg' : ''}`}>{fmtMoney(totales.minimo?.saldoFinal ?? 0)}</span>
              <span className="gx-tile__sub">{totales.minimo ? `semana del ${ddmm(totales.minimo.desde)}` : ''}</span>
            </div>
            <div className="gx-tile">
              <span className="gx-tile__label">Al final</span>
              <span className={`gx-tile__valor ${totales.final < 0 ? 'gx-neg' : ''}`}>{fmtMoney(totales.final)}</span>
              <span className="gx-tile__sub">saldo proyectado</span>
            </div>
          </div>

          <section className="erp-panel">
            <div className="gx-cab">
              <h2>Semana a semana</h2>
              <div className="gx-leyenda">
                <span>
                  <i className="gx-sw gx-sw--entra" />
                  Entra
                </span>
                <span>
                  <i className="gx-sw gx-sw--sale" />
                  Sale
                </span>
                <span>
                  <i className="gx-sw gx-sw--saldo" />
                  Saldo al cierre de la semana
                </span>
              </div>
            </div>
            <div className="gx-chart" onMouseLeave={() => setHover(null)}>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flujo semanal: entradas, salidas y saldo proyectado">
                {minY < 0 && <rect className="gx-zona-neg" x={pad.l} y={y(0)} width={W - pad.l - pad.r} height={y(minY) - y(0)} />}
                {ticks.map((t) => (
                  <g key={t}>
                    <line className={t === 0 ? 'gx-cero' : 'gx-grilla'} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
                    <text className="gx-eje" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
                      {fmtCorto(t)}
                    </text>
                  </g>
                ))}
                {sem.map((s, i) => (
                  <g key={s.desde}>
                    {s.entra > 0 && (
                      <path
                        d={barra(cx(i) - barW - 1, y(s.entra), barW, y(0) - y(s.entra), 'arriba')}
                        fill="var(--gx-entra)"
                        opacity={hover === null || hover === i ? 1 : 0.45}
                      />
                    )}
                    {s.sale > 0 && (
                      <path d={barra(cx(i) + 1, y(0), barW, y(-s.sale) - y(0), 'abajo')} fill="var(--gx-sale)" opacity={hover === null || hover === i ? 1 : 0.45} />
                    )}
                    {(i % Math.ceil(sem.length / 13) === 0 || i === sem.length - 1) && (
                      <text className="gx-eje" x={cx(i)} y={H - 8} textAnchor="middle">
                        {i === 0 ? 'Esta sem.' : ddmm(s.desde)}
                      </text>
                    )}
                  </g>
                ))}
                <path d={linea} fill="none" stroke="var(--gx-azul)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {sem.map((s, i) => (
                  <circle
                    key={s.desde}
                    cx={cx(i)}
                    cy={y(s.saldoFinal)}
                    r={hover === i ? 6 : 4}
                    fill={s.saldoFinal < 0 ? 'var(--gx-sale)' : 'var(--gx-azul)'}
                    stroke="#0b1120"
                    strokeWidth={2}
                  />
                ))}
                {sem.map((s, i) => (
                  <rect
                    key={`h${s.desde}`}
                    x={pad.l + anchoSemana * i}
                    y={pad.t}
                    width={anchoSemana}
                    height={H - pad.t - pad.b}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setAbierta(abierta === s.desde ? null : s.desde)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </svg>
              {hover !== null && sem[hover] && (
                <div className="gx-tip" style={{ left: `${(cx(hover) / W) * 100}%`, top: `${(Math.min(y(sem[hover].saldoFinal), y(sem[hover].entra)) / H) * 100 - 2}%` }}>
                  <strong>
                    Semana {ddmm(sem[hover].desde)} – {ddmm(sem[hover].hasta)}
                  </strong>
                  <span className="gx-tip__fila">
                    <span>
                      <i className="gx-sw gx-sw--entra" />
                      Entra
                    </span>
                    <b>{fmtMoney(sem[hover].entra)}</b>
                  </span>
                  <span className="gx-tip__fila">
                    <span>
                      <i className="gx-sw gx-sw--sale" />
                      Sale
                    </span>
                    <b>{fmtMoney(sem[hover].sale)}</b>
                  </span>
                  <span className="gx-tip__fila">
                    <span>
                      <i className="gx-sw gx-sw--saldo" />
                      Saldo
                    </span>
                    <b className={sem[hover].saldoFinal < 0 ? 'gx-neg' : ''}>{fmtMoney(sem[hover].saldoFinal)}</b>
                  </span>
                  <span className="gx-mini">Tocá para ver el detalle</span>
                </div>
              )}
            </div>
          </section>

          <section className="erp-panel">
            <div className="gx-cab">
              <h2>Detalle</h2>
              <span className="gx-mini">Las facturas a cobrar se ubican en la fecha en que cada cliente suele pagar, no en la ideal.</span>
            </div>
            <div className="gx-tabla-wrap">
              <table className="gx-tabla">
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th className="num">Entra</th>
                    <th className="num">Sale</th>
                    <th className="num">Neto</th>
                    <th className="num">Saldo al cierre</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sem.map((s, i) => {
                    const neto = s.entra - s.sale
                    const abiertaEsta = abierta === s.desde
                    return (
                      <Fragment key={s.desde}>
                        <tr className="is-click" onClick={() => setAbierta(abiertaEsta ? null : s.desde)}>
                          <td>
                            <strong>{i === 0 ? 'Esta semana' : `${ddmm(s.desde)} – ${ddmm(s.hasta)}`}</strong>
                            {i === 0 && <div className="gx-mini">incluye lo vencido</div>}
                          </td>
                          <td className="num">{s.entra ? fmtMoney(s.entra) : '—'}</td>
                          <td className="num">{s.sale ? fmtMoney(s.sale) : '—'}</td>
                          <td className={`num ${neto < 0 ? 'gx-neg' : neto > 0 ? 'gx-pos' : ''}`}>{neto ? `${neto > 0 ? '+' : ''}${fmtMoney(neto)}` : '—'}</td>
                          <td className="num">
                            <strong className={s.saldoFinal < 0 ? 'gx-neg' : ''}>{fmtMoney(s.saldoFinal)}</strong>
                          </td>
                          <td className="gx-mini">{s.movs.length ? `${s.movs.length} mov. ${abiertaEsta ? '▴' : '▾'}` : ''}</td>
                        </tr>
                        {abiertaEsta &&
                          s.movs.map((m) => (
                            <tr key={m.key} className="gx-detalle">
                              <td>
                                {fmtFecha(m.fecha)}
                                {m.nota && <div className="gx-mini">{m.nota}</div>}
                              </td>
                              <td colSpan={2}>
                                <strong>{m.contraparte}</strong>
                                <div className="gx-mini">
                                  {ORIGEN_LABEL[m.origen]} · {m.concepto}
                                </div>
                              </td>
                              <td className={`num ${m.sentido === 'entra' ? 'gx-pos' : 'gx-neg'}`}>
                                {m.sentido === 'entra' ? '+' : '−'}
                                {fmtMoney(m.importe)}
                              </td>
                              <td colSpan={2} />
                            </tr>
                          ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {cargando && (
        <div className="erp-panel">
          <p className="erp-muted">Calculando el flujo…</p>
        </div>
      )}
      {!cargando && !hayDatos && (
        <div className="erp-panel">
          <p className="erp-muted">No hay cobros ni pagos pendientes con fecha para proyectar.</p>
        </div>
      )}
    </div>
  )
}

/** Barra con esquinas redondeadas sólo en el extremo de datos (4px). */
function barra(x: number, y: number, w: number, h: number, hacia: 'arriba' | 'abajo'): string {
  const r = Math.min(4, w / 2, Math.abs(h))
  if (h <= 0) return ''
  if (hacia === 'arriba') {
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
  }
  return `M${x},${y} L${x + w},${y} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} Z`
}
