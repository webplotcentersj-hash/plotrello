import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import { armarFilas, cargarAgenda } from '../features/compromisos/agenda'
import { cargarMovimientosFlujo, leerSaldoInicial, semanasFlujo } from '../features/gestion/flujoCaja'
import { gastosDelPeriodo, ventasDelPeriodo } from '../services/balanceEconomicoApi'
import { cargarFacturasConProblema, cargarVentasPorFacturar } from '../services/facturacionResumen'
import { cxcPendientes, cxpPendientes, deudasCuentaCorriente, diasEntre, mesMas, rangoMes, stockCritico, sumarDias } from '../services/erpGestionApi'
import type { VentaEco } from '../features/reportes/balanceEconomico'
import { getArgentinaDateString } from '../utils/dateUtils'
import { fmtCorto, fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

type Atencion = { tono: 'danger' | 'warn' | 'info'; icono: string; texto: string; ir: string }

type Datos = {
  ventas6m: VentaEco[]
  gastosMes: number
  gastosMesAnt: number
  compVencidos: number
  compVencidosMonto: number
  compSemana: number
  compSemanaMonto: number
  cobrarTotal: number
  cobrarVencido: number
  pagarTotal: number
  pagarVencido: number
  arca: number
  porFacturar: number
  porFacturarMonto: number
  stockCritico: { nombre: string; stock: number; stock_minimo: number }[]
  saldo4: number | null
  semanaRoja: string | null
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function ErpTableroDuenoPage() {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const mes = hoy.slice(0, 7)
  const [d, setD] = useState<Datos | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    void (async () => {
      const desde6 = `${mesMas(mes, -5)}-01`
      const ant = rangoMes(mesMas(mes, -1))
      const [ventas, gMes, gAnt, agenda, cxc, cc, cxp, arca, porFact, stock, flujo] = await Promise.all([
        ventasDelPeriodo(desde6, hoy),
        gastosDelPeriodo(`${mes}-01`, hoy),
        gastosDelPeriodo(ant.desde, ant.hasta),
        cargarAgenda(),
        cxcPendientes(),
        deudasCuentaCorriente(),
        cxpPendientes(),
        cargarFacturasConProblema(),
        cargarVentasPorFacturar(),
        stockCritico(),
        cargarMovimientosFlujo(hoy, 35)
      ])
      const filas = agenda.ok ? armarFilas(agenda.data.compromisos, agenda.data.cheques, agenda.data.nombres, hoy).filter((f) => f.pendiente) : []
      const venc = filas.filter((f) => f.dias < 0)
      const sem = filas.filter((f) => f.dias >= 0 && f.dias <= 7)
      const suma = (l: { importe: number }[]) => l.reduce((s, x) => s + x.importe, 0)
      const cobrarFact = cxc.success ? cxc.data : []
      const vencFact = cobrarFact.filter((c) => (c.fecha_vencimiento ?? sumarDias(c.fecha_emision, 30)) < hoy)
      const ccTotal = cc.success ? cc.data.reduce((s, c) => s + c.saldo, 0) : 0
      const ccVenc = cc.success ? cc.data.reduce((s, c) => s + c.tramos.filter((t) => diasEntre(t.fecha, hoy) > 30).reduce((x, t) => x + t.monto, 0), 0) : 0
      const pagar = cxp.success ? cxp.data : []
      const saldoIni = leerSaldoInicial()
      const sem5 = semanasFlujo(flujo.movs, hoy, 5, saldoIni ?? 0)
      setD({
        ventas6m: ventas.success ? ventas.data : [],
        gastosMes: gMes.success ? gMes.data.reduce((s, g) => s + g.total, 0) : 0,
        gastosMesAnt: gAnt.success ? gAnt.data.filter((g) => g.fecha <= sumarDias(ant.desde, Number(hoy.slice(8, 10)) - 1)).reduce((s, g) => s + g.total, 0) : 0,
        compVencidos: venc.length,
        compVencidosMonto: suma(venc),
        compSemana: sem.length,
        compSemanaMonto: suma(sem),
        cobrarTotal: cobrarFact.reduce((s, c) => s + c.monto_pendiente, 0) + ccTotal,
        cobrarVencido: vencFact.reduce((s, c) => s + c.monto_pendiente, 0) + ccVenc,
        pagarTotal: pagar.reduce((s, p) => s + p.monto_pendiente, 0),
        pagarVencido: pagar.filter((p) => p.fecha_vencimiento && p.fecha_vencimiento < hoy).reduce((s, p) => s + p.monto_pendiente, 0),
        arca: arca.ok ? arca.facturas.length : 0,
        porFacturar: porFact.ok ? porFact.ventas.length : 0,
        porFacturarMonto: porFact.ok ? porFact.ventas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0) : 0,
        stockCritico: stock.success ? stock.data : [],
        saldo4: saldoIni === null ? null : sem5[sem5.length - 1]?.saldoFinal ?? null,
        semanaRoja: saldoIni === null ? null : sem5.find((s) => s.saldoFinal < 0)?.desde ?? null
      })
    })()
  }, [hoy, mes])

  const ventasMes = useMemo(() => {
    if (!d) return null
    const dia = Number(hoy.slice(8, 10))
    const ant = mesMas(mes, -1)
    const limiteAnt = `${ant}-${String(dia).padStart(2, '0')}`
    const actual = d.ventas6m.filter((v) => v.fecha.slice(0, 7) === mes).reduce((s, v) => s + v.valor_total, 0)
    const anterior = d.ventas6m.filter((v) => v.fecha.slice(0, 7) === ant && v.fecha <= limiteAnt).reduce((s, v) => s + v.valor_total, 0)
    const meses = Array.from({ length: 6 }, (_, i) => {
      const m = mesMas(mes, i - 5)
      return { m, total: d.ventas6m.filter((v) => v.fecha.slice(0, 7) === m).reduce((s, v) => s + v.valor_total, 0) }
    })
    const [y, mm] = mes.split('-').map(Number)
    const diasMes = new Date(y, mm, 0).getDate()
    return { actual, anterior, meses, proyeccion: dia > 0 ? (actual / dia) * diasMes : actual }
  }, [d, hoy, mes])

  const atencion = useMemo<Atencion[]>(() => {
    if (!d) return []
    const a: Atencion[] = []
    if (d.semanaRoja) a.push({ tono: 'danger', icono: '🚨', texto: `La caja queda en rojo la semana del ${d.semanaRoja.slice(8, 10)}/${d.semanaRoja.slice(5, 7)}`, ir: '/erp/flujo-caja' })
    if (d.compVencidos) a.push({ tono: 'danger', icono: '📅', texto: `${d.compVencidos} compromisos vencidos por ${fmtMoney(d.compVencidosMonto)}`, ir: '/erp/compromisos' })
    if (d.arca) a.push({ tono: 'danger', icono: '🧾', texto: `${d.arca} factura${d.arca > 1 ? 's' : ''} con problema en ARCA`, ir: '/erp/facturas' })
    if (d.cobrarVencido > 0) a.push({ tono: 'warn', icono: '📞', texto: `${fmtMoney(d.cobrarVencido)} vencido de clientes para cobrar`, ir: '/erp/cobranza' })
    if (d.pagarVencido > 0) a.push({ tono: 'warn', icono: '⏰', texto: `${fmtMoney(d.pagarVencido)} vencido con proveedores`, ir: '/erp/cuentas-por-pagar' })
    if (d.porFacturar) a.push({ tono: 'info', icono: '🧮', texto: `${d.porFacturar} ventas por facturar (${fmtMoney(d.porFacturarMonto)})`, ir: '/erp/facturas' })
    if (d.stockCritico.length) a.push({ tono: 'info', icono: '📦', texto: `${d.stockCritico.length} artículos debajo del stock mínimo`, ir: '/erp/stock' })
    if (d.compSemana) a.push({ tono: 'info', icono: '🗓️', texto: `${d.compSemana} vencimientos en los próximos 7 días (${fmtMoney(d.compSemanaMonto)})`, ir: '/erp/compromisos' })
    return a
  }, [d])

  const delta = (actual: number, anterior: number) => (anterior > 0 ? ((actual - anterior) / anterior) * 100 : null)
  const dv = ventasMes ? delta(ventasMes.actual, ventasMes.anterior) : null
  const dg = d ? delta(d.gastosMes, d.gastosMesAnt) : null
  const maxMes = ventasMes ? Math.max(1, ...ventasMes.meses.map((m) => m.total)) : 1

  return (
    <div className="erp-section gx">
      <ErpPageHeader icon="🧭" titulo="Tablero del dueño" subtitulo="Lo importante del negocio en una pantalla." volverA="/erp" volverTexto="ERP" />

      {!d || !ventasMes ? (
        <div className="erp-panel">
          <p className="erp-muted">Juntando los números…</p>
        </div>
      ) : (
        <>
          <section className="erp-panel">
            <div className="gx-cab">
              <h2>Requiere tu atención</h2>
              <span className="gx-mini">{atencion.length ? `${atencion.length} temas` : ''}</span>
            </div>
            {atencion.length === 0 ? (
              <div className="gx-banner gx-banner--ok" style={{ marginBottom: 0 }}>
                <span className="gx-banner__icono">✅</span>
                <div>
                  <strong>Todo en orden.</strong> No hay vencimientos, problemas en ARCA ni deudas vencidas.
                </div>
              </div>
            ) : (
              atencion.map((x, i) => (
                <button key={i} type="button" className={`gx-banner gx-banner--${x.tono}`} style={{ width: '100%', cursor: 'pointer', font: 'inherit', textAlign: 'left', marginBottom: 6 }} onClick={() => navigate(x.ir)}>
                  <span className="gx-banner__icono">{x.icono}</span>
                  <div style={{ flex: 1 }}>
                    <strong>{x.texto}</strong>
                  </div>
                  <span className="gx-mini">Ver →</span>
                </button>
              ))
            )}
          </section>

          <div className="gx-tiles">
            <button type="button" className="gx-tile gx-tile--ok" onClick={() => navigate('/erp/balance-economico')}>
              <span className="gx-tile__label">Ventas del mes</span>
              <span className="gx-tile__valor">{fmtMoney(ventasMes.actual)}</span>
              <span className="gx-tile__sub">
                {dv === null ? 'sin mes anterior para comparar' : <span className={`gx-delta ${dv >= 0 ? 'is-up' : 'is-down'}`}>{dv >= 0 ? '▲' : '▼'} {Math.abs(dv).toFixed(0)}%</span>}
                {dv !== null && ' vs. mismo día del mes pasado'}
              </span>
            </button>
            <div className="gx-tile gx-tile--info">
              <span className="gx-tile__label">Proyección a fin de mes</span>
              <span className="gx-tile__valor">{fmtMoney(ventasMes.proyeccion)}</span>
              <span className="gx-tile__sub">al ritmo actual</span>
            </div>
            <button type="button" className="gx-tile gx-tile--warn" onClick={() => navigate('/erp/gastos')}>
              <span className="gx-tile__label">Gastos del mes</span>
              <span className="gx-tile__valor">{fmtMoney(d.gastosMes)}</span>
              <span className="gx-tile__sub">
                {dg === null ? '—' : <span className={`gx-delta ${dg <= 0 ? 'is-up' : 'is-down'}`}>{dg >= 0 ? '▲' : '▼'} {Math.abs(dg).toFixed(0)}%</span>}
                {dg !== null && ' vs. mes pasado'}
              </span>
            </button>
            <div className={`gx-tile ${ventasMes.actual - d.gastosMes < 0 ? 'gx-tile--danger' : 'gx-tile--ok'}`}>
              <span className="gx-tile__label">Ventas − gastos</span>
              <span className={`gx-tile__valor ${ventasMes.actual - d.gastosMes < 0 ? 'gx-neg' : ''}`}>{fmtMoney(ventasMes.actual - d.gastosMes)}</span>
              <span className="gx-tile__sub">resultado aproximado del mes</span>
            </div>
            <button type="button" className="gx-tile gx-tile--info" onClick={() => navigate('/erp/cobranza')}>
              <span className="gx-tile__label">Te deben</span>
              <span className="gx-tile__valor">{fmtMoney(d.cobrarTotal)}</span>
              <span className="gx-tile__sub">{d.cobrarVencido ? <span className="gx-neg">{fmtMoney(d.cobrarVencido)} vencido</span> : 'nada vencido'}</span>
            </button>
            <button type="button" className="gx-tile gx-tile--warn" onClick={() => navigate('/erp/cuentas-por-pagar')}>
              <span className="gx-tile__label">Debés a proveedores</span>
              <span className="gx-tile__valor">{fmtMoney(d.pagarTotal)}</span>
              <span className="gx-tile__sub">{d.pagarVencido ? <span className="gx-neg">{fmtMoney(d.pagarVencido)} vencido</span> : 'nada vencido'}</span>
            </button>
            <button type="button" className={`gx-tile ${d.semanaRoja ? 'gx-tile--danger' : 'gx-tile--ok'}`} onClick={() => navigate('/erp/flujo-caja')}>
              <span className="gx-tile__label">Caja en 5 semanas</span>
              <span className={`gx-tile__valor ${d.saldo4 !== null && d.saldo4 < 0 ? 'gx-neg' : ''}`}>{d.saldo4 === null ? 'Cargá el saldo' : fmtMoney(d.saldo4)}</span>
              <span className="gx-tile__sub">{d.saldo4 === null ? 'en Flujo de caja' : 'saldo proyectado'}</span>
            </button>
          </div>

          <section className="erp-panel">
            <div className="gx-cab">
              <h2>Ventas de los últimos 6 meses</h2>
              <span className="gx-mini">El mes actual va hasta hoy</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, alignItems: 'end', height: 180, position: 'relative' }} onMouseLeave={() => setHover(null)}>
              {ventasMes.meses.map((m, i) => (
                <div key={m.m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }} onMouseEnter={() => setHover(i)}>
                  <span className="gx-mini" style={{ color: '#e2e8f0', fontWeight: 700 }}>
                    {hover === i ? fmtMoney(m.total) : fmtCorto(m.total)}
                  </span>
                  <div
                    style={{
                      width: '60%',
                      maxWidth: 44,
                      height: `${Math.max(2, (m.total / maxMes) * 120)}px`,
                      borderRadius: '4px 4px 0 0',
                      background: m.m === mes ? 'repeating-linear-gradient(45deg, #34d399, #34d399 6px, #10b98199 6px, #10b98199 10px)' : '#34d399',
                      opacity: hover === null || hover === i ? 1 : 0.55
                    }}
                    title={`${MESES[Number(m.m.slice(5, 7)) - 1]} ${m.m.slice(0, 4)}: ${fmtMoney(m.total)}`}
                  />
                  <span className="gx-mini">
                    {MESES[Number(m.m.slice(5, 7)) - 1]}
                    {m.m === mes ? ' (en curso)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {d.stockCritico.length > 0 && (
            <section className="erp-panel">
              <div className="gx-cab">
                <h2>Stock crítico</h2>
                <button type="button" className="erpx-btn-sm" onClick={() => navigate('/erp/stock')}>
                  Ir a stock
                </button>
              </div>
              <table className="gx-tabla">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th className="num">Stock</th>
                    <th className="num">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.stockCritico.slice(0, 8).map((a) => (
                    <tr key={a.nombre}>
                      <td>{a.nombre}</td>
                      <td className={`num ${a.stock <= 0 ? 'gx-neg' : ''}`}>
                        <strong>{a.stock}</strong>
                      </td>
                      <td className="num">{a.stock_minimo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  )
}
