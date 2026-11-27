import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import { armarFilas, cargarAgenda } from '../features/compromisos/agenda'
import { listPeriodosContables, resumenAsientosPeriodo } from '../services/erpContableApi'
import { aplicaEnPeriodo, listGastosFijos, listPagosGastosFijos, saldoPendienteGasto, totalPagadoPeriodo } from '../services/erpGastosFijosApi'
import { gastosEntre, mesMas, movimientosSinConciliar, rangoMes } from '../services/erpGestionApi'
import { cargarFacturasConProblema, cargarVentasPorFacturar } from '../services/facturacionResumen'
import { getArgentinaDateString } from '../utils/dateUtils'
import { fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

type EstadoPaso = 'ok' | 'pend' | 'mal' | 'manual'
type Paso = { id: string; titulo: string; detalle: string; estado: EstadoPaso; ir?: string; textoIr?: string; manual?: boolean }

const MANUALES: { id: string; titulo: string; detalle: string }[] = [
  { id: 'iva', titulo: 'Libro IVA revisado', detalle: 'Compras y ventas del mes cargadas y controladas contra ARCA (Mis Comprobantes).' },
  { id: 'retenciones', titulo: 'Retenciones y percepciones cargadas', detalle: 'Las sufridas y practicadas del mes, con sus certificados.' },
  { id: 'sueldos', titulo: 'Sueldos liquidados y pagados', detalle: 'Recibos firmados, F.931 presentado y cargas sociales pagadas.' },
  { id: 'contador', titulo: 'Información enviada al contador', detalle: 'Libro IVA, extractos bancarios y comprobantes del mes.' }
]

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const etiqueta = (p: string) => `${NOMBRES_MES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`
const kManual = (p: string) => `erp_cierre_manual_${p}`

export default function ErpCierreMensualPage() {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  // Hasta el día 15 se sugiere cerrar el mes anterior.
  const [periodo, setPeriodo] = useState(() => (Number(hoy.slice(8, 10)) <= 15 ? mesMas(hoy.slice(0, 7), -1) : hoy.slice(0, 7)))
  const [auto, setAuto] = useState<Paso[] | null>(null)
  const [cerrado, setCerrado] = useState(false)
  const [manual, setManual] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      setManual(JSON.parse(localStorage.getItem(kManual(periodo)) || '{}'))
    } catch {
      setManual({})
    }
  }, [periodo])

  useEffect(() => {
    let vivo = true
    setAuto(null)
    void (async () => {
      const { desde, hasta } = rangoMes(periodo)
      const [arca, porFact, asientos, banco, gastos, fijos, pagosFijos, agenda, periodos] = await Promise.all([
        cargarFacturasConProblema(),
        cargarVentasPorFacturar(),
        resumenAsientosPeriodo(periodo),
        movimientosSinConciliar(desde, hasta),
        gastosEntre(desde, hasta),
        listGastosFijos(),
        listPagosGastosFijos(periodo, periodo),
        cargarAgenda(),
        listPeriodosContables()
      ])
      const pasos: Paso[] = []

      const arcaMes = arca.ok ? arca.facturas.filter((f) => String(f.fecha_emision).slice(0, 7) === periodo) : []
      pasos.push({
        id: 'arca',
        titulo: 'Facturas autorizadas en ARCA',
        detalle: !arca.ok ? `No se pudo verificar: ${arca.error}` : arcaMes.length ? `${arcaMes.length} factura(s) del mes con problema (sin CAE o sin efectos aplicados).` : 'Todas las facturas del mes tienen CAE.',
        estado: !arca.ok ? 'pend' : arcaMes.length ? 'mal' : 'ok',
        ir: '/erp/facturas',
        textoIr: 'Ver facturas'
      })

      const sinFacturar = porFact.ok ? porFact.ventas.filter((v) => String(v.fecha_venta).slice(0, 7) === periodo) : []
      pasos.push({
        id: 'porfacturar',
        titulo: 'Ventas del mes facturadas',
        detalle: !porFact.ok
          ? `No se pudo verificar: ${porFact.error}`
          : sinFacturar.length
            ? `${sinFacturar.length} venta(s) sin factura por ${fmtMoney(sinFacturar.reduce((s, v) => s + (Number(v.valor_total) || 0), 0))}.`
            : 'No quedan ventas del mes sin facturar.',
        estado: !porFact.ok ? 'pend' : sinFacturar.length ? 'pend' : 'ok',
        ir: '/erp/facturas',
        textoIr: 'Facturar'
      })

      const fijosPend = fijos.success
        ? fijos.data.filter(
            (g) => g.activo && aplicaEnPeriodo(g, periodo) && saldoPendienteGasto(Number(g.monto), pagosFijos.success ? totalPagadoPeriodo(pagosFijos.data, g.id, periodo) : 0) > 0
          )
        : []
      pasos.push({
        id: 'fijos',
        titulo: 'Gastos fijos del mes pagados',
        detalle: !fijos.success ? `No se pudo verificar: ${fijos.error}` : fijosPend.length ? `Faltan: ${fijosPend.slice(0, 4).map((g) => g.concepto).join(', ')}${fijosPend.length > 4 ? '…' : ''}` : 'Todos pagados.',
        estado: !fijos.success ? 'pend' : fijosPend.length ? 'pend' : 'ok',
        ir: '/erp/gastos-fijos',
        textoIr: 'Gastos fijos'
      })

      const sinComp = gastos.success ? gastos.data.filter((g) => !g.ticket_url && !g.numero_comprobante) : []
      pasos.push({
        id: 'comprobantes',
        titulo: 'Gastos con comprobante',
        detalle: !gastos.success
          ? `No se pudo verificar: ${gastos.error}`
          : sinComp.length
            ? `${sinComp.length} gasto(s) sin foto ni número de comprobante por ${fmtMoney(sinComp.reduce((s, g) => s + g.total, 0))}.`
            : `Los ${gastos.data.length} gastos del mes tienen comprobante.`,
        estado: !gastos.success ? 'pend' : sinComp.length ? 'pend' : 'ok',
        ir: '/erp/gastos',
        textoIr: 'Ver gastos'
      })

      pasos.push({
        id: 'banco',
        titulo: 'Conciliación bancaria',
        detalle: !banco.success ? `No se pudo verificar: ${banco.error}` : banco.data ? `${banco.data} movimiento(s) bancario(s) del mes sin conciliar.` : 'Todos los movimientos del mes están conciliados.',
        estado: !banco.success ? 'pend' : banco.data ? 'pend' : 'ok',
        ir: '/compras/conciliacion-bancaria',
        textoIr: 'Conciliar'
      })

      const compVenc = agenda.ok
        ? armarFilas(agenda.data.compromisos, agenda.data.cheques, agenda.data.nombres, hoy).filter((f) => f.pendiente && f.fecha.slice(0, 7) === periodo && f.fecha < hoy)
        : []
      pasos.push({
        id: 'compromisos',
        titulo: 'Cheques y compromisos del mes resueltos',
        detalle: !agenda.ok ? `No se pudo verificar: ${agenda.error}` : compVenc.length ? `${compVenc.length} vencimiento(s) del mes siguen pendientes.` : 'Nada pendiente del mes.',
        estado: !agenda.ok ? 'pend' : compVenc.length ? 'pend' : 'ok',
        ir: '/erp/compromisos',
        textoIr: 'Ver compromisos'
      })

      if (asientos.success) {
        const cuadra = Math.abs(asientos.data.debe - asientos.data.haber) < 0.01
        pasos.push({
          id: 'asientos',
          titulo: 'Asientos contabilizados y cuadrados',
          detalle: asientos.data.borradores
            ? `${asientos.data.borradores} asiento(s) en borrador: contabilizalos o anulalos.`
            : !cuadra
              ? `El debe (${fmtMoney(asientos.data.debe)}) no coincide con el haber (${fmtMoney(asientos.data.haber)}).`
              : `${asientos.data.asientos} asientos, debe = haber.`,
          estado: asientos.data.borradores || !cuadra ? 'mal' : 'ok',
          ir: '/erp/asientos',
          textoIr: 'Ver asientos'
        })
      } else pasos.push({ id: 'asientos', titulo: 'Asientos contabilizados y cuadrados', detalle: `No se pudo verificar: ${asientos.error}`, estado: 'pend', ir: '/erp/asientos' })

      if (!vivo) return
      setCerrado(periodos.success ? periodos.data.some((p) => p.periodo === periodo && p.estado === 'Cerrado') : false)
      setAuto(pasos)
    })()
    return () => {
      vivo = false
    }
  }, [periodo, hoy])

  const pasos = useMemo<Paso[]>(() => {
    const m: Paso[] = MANUALES.map((x) => ({ ...x, manual: true, estado: manual[x.id] ? 'ok' : 'manual' }))
    return [...(auto ?? []), ...m]
  }, [auto, manual])

  const hechos = pasos.filter((p) => p.estado === 'ok').length
  const total = pasos.length
  const bloqueantes = (auto ?? []).filter((p) => p.estado === 'mal').length

  const marcar = (id: string) => {
    const n = { ...manual, [id]: !manual[id] }
    setManual(n)
    localStorage.setItem(kManual(periodo), JSON.stringify(n))
  }

  const opciones = Array.from({ length: 12 }, (_, i) => mesMas(hoy.slice(0, 7), -i))

  return (
    <div className="erp-section gx">
      <ErpPageHeader icon="✅" titulo="Cierre mensual" subtitulo="Lista de pasos para cerrar el mes. Los controles automáticos se marcan solos." volverA="/erp" volverTexto="ERP" />

      <div className="gx-controles">
        <label className="erp-field">
          <span className="erp-field__label">Mes a cerrar</span>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {opciones.map((p) => (
              <option key={p} value={p}>
                {etiqueta(p)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="erp-panel">
        <div className="gx-cab">
          <h2>
            {cerrado ? '🔒 ' : ''}
            {etiqueta(periodo).replace(/^./, (c) => c.toUpperCase())}
          </h2>
          <span className="gx-mini">
            {auto === null ? 'Verificando…' : `${hechos} de ${total} pasos listos`}
            {cerrado ? ' · período contable cerrado' : ''}
          </span>
        </div>
        <div className="gx-progreso">
          <span style={{ width: `${auto === null ? 0 : (hechos / total) * 100}%` }} />
        </div>
      </section>

      {auto !== null && hechos === total && !cerrado && (
        <div className="gx-banner gx-banner--ok">
          <span className="gx-banner__icono">🎉</span>
          <div style={{ flex: 1 }}>
            <strong>¡Todo listo!</strong> Ya podés cerrar el período contable para que nadie modifique asientos de {etiqueta(periodo)}.
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/contabilidad/periodos')}>
            Cerrar período
          </button>
        </div>
      )}
      {auto !== null && bloqueantes > 0 && (
        <div className="gx-banner gx-banner--danger">
          <span className="gx-banner__icono">⛔</span>
          <div>
            <strong>
              {bloqueantes} paso{bloqueantes > 1 ? 's' : ''} con errores
            </strong>{' '}
            que conviene resolver antes de cerrar.
          </div>
        </div>
      )}

      <section>
        {pasos.map((p) => (
          <div key={p.id} className={`gx-check gx-check--${p.estado}`}>
            {p.manual ? (
              <button
                type="button"
                className="gx-check__icono"
                onClick={() => marcar(p.id)}
                aria-pressed={p.estado === 'ok'}
                aria-label={`Marcar ${p.titulo}`}
                style={{ border: '1px dashed rgba(148,163,184,.5)', cursor: 'pointer', font: 'inherit' }}
              >
                {p.estado === 'ok' ? '✓' : ''}
              </button>
            ) : (
              <span className="gx-check__icono" aria-hidden>
                {auto === null ? '…' : p.estado === 'ok' ? '✓' : p.estado === 'mal' ? '!' : '•'}
              </span>
            )}
            <div>
              <div className="gx-check__titulo">
                {p.titulo} {p.manual && <span className="gx-mini">(manual)</span>}
              </div>
              <div className="gx-check__detalle">{p.detalle}</div>
            </div>
            {p.ir && p.estado !== 'ok' && (
              <button type="button" className="erpx-btn-sm" onClick={() => navigate(p.ir!)}>
                {p.textoIr ?? 'Ir'} →
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
