import { useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  cambiarEstadoLiquidacionIva,
  cargarComprobantesPeriodo,
  guardarLiquidacionIva,
  listLiquidacionesIva,
  type ComprobantesPeriodo,
  type LiquidacionIvaRow
} from '../services/erpContableApi'
import { descargarTexto, fmtFecha, fmtMoney, periodoActual } from '../utils/erpUi'
import { generarLibroIvaDigital, NOMBRES_LIBRO_IVA_DIGITAL } from '../utils/libroIvaDigital'
import { calcularLiquidacionIva, esPeriodoValido, periodoAnterior, totalesIvaPeriodo } from '../utils/liquidacionIva'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

type Entrada = {
  saldoTecnicoAnterior: number
  saldoLibreDispAnterior: number
  retencionesSufridas: number
  percepcionesSufridas: number
}

const PILL: Record<LiquidacionIvaRow['estado'], string> = { Abierta: 'warn', Cerrada: 'ok', Presentada: 'ok' }

export default function ErpLiquidacionIvaPage() {
  const [periodo, setPeriodo] = useState(periodoAnterior(periodoActual()))
  const [historial, setHistorial] = useState<LiquidacionIvaRow[]>([])
  const [datos, setDatos] = useState<ComprobantesPeriodo | null>(null)
  const [entrada, setEntrada] = useState<Entrada>({ saldoTecnicoAnterior: 0, saldoLibreDispAnterior: 0, retencionesSufridas: 0, percepcionesSufridas: 0 })
  const [observaciones, setObservaciones] = useState('')
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error' | 'warn'; texto: string } | null>(null)

  const guardada = useMemo(() => historial.find((h) => h.periodo === periodo) ?? null, [historial, periodo])
  const bloqueada = guardada != null && guardada.estado !== 'Abierta'

  const cargarHistorial = async () => {
    const r = await listLiquidacionesIva()
    if (r.success) setHistorial(r.data)
    else setMsg({ tipo: 'error', texto: r.error })
    return r.success ? r.data : []
  }

  useEffect(() => {
    void cargarHistorial()
  }, [])

  const totales = useMemo(() => (datos ? totalesIvaPeriodo(datos.ventas, datos.compras) : null), [datos])

  const resultado = useMemo(() => {
    if (!totales) return null
    if (bloqueada && guardada) {
      return {
        debitoFiscal: guardada.debito_fiscal,
        creditoFiscal: guardada.credito_fiscal,
        saldoTecnicoAnterior: guardada.saldo_tecnico_anterior,
        saldoLibreDispAnterior: guardada.saldo_libre_disp_anterior,
        retencionesSufridas: guardada.retenciones_sufridas,
        percepcionesSufridas: guardada.percepciones_sufridas,
        saldoPeriodo: guardada.debito_fiscal - guardada.credito_fiscal - guardada.saldo_tecnico_anterior,
        saldoTecnicoResultante: guardada.saldo_tecnico_resultante,
        saldoLibreDispResultante: guardada.saldo_libre_disp_resultante,
        saldoAPagar: guardada.saldo_a_pagar
      }
    }
    return calcularLiquidacionIva({ debitoFiscal: totales.debitoFiscal, creditoFiscal: totales.creditoFiscal, ...entrada })
  }, [totales, entrada, bloqueada, guardada])

  const libro = useMemo(() => (datos ? generarLibroIvaDigital(datos.ventas, datos.compras) : null), [datos])

  const calcular = async () => {
    setMsg(null)
    if (!esPeriodoValido(periodo)) return setMsg({ tipo: 'error', texto: 'Elegí un período válido.' })
    setCargando(true)
    const hist = await cargarHistorial()
    const r = await cargarComprobantesPeriodo(periodo)
    setCargando(false)
    if (!r.success) {
      setDatos(null)
      return setMsg({ tipo: 'error', texto: r.error })
    }
    const previa = hist.find((h) => h.periodo === periodoAnterior(periodo))
    const t = totalesIvaPeriodo(r.data.ventas, r.data.compras)
    setDatos(r.data)
    setEntrada({
      saldoTecnicoAnterior: previa?.saldo_tecnico_resultante ?? 0,
      saldoLibreDispAnterior: previa?.saldo_libre_disp_resultante ?? 0,
      retencionesSufridas: r.data.retencionesIvaSufridas,
      percepcionesSufridas: Math.round((r.data.percepcionesIvaSufridas + t.percepcionesEnCompras) * 100) / 100
    })
    setObservaciones(hist.find((h) => h.periodo === periodo)?.observaciones ?? '')
    if (!previa) {
      setMsg({ tipo: 'warn', texto: `No hay liquidación de ${periodoAnterior(periodo)}: los saldos anteriores arrancan en cero. Ajustalos si corresponde.` })
    }
  }

  const guardar = async () => {
    if (!totales || !resultado) return
    const r = await guardarLiquidacionIva({
      periodo,
      debito_fiscal: totales.debitoFiscal,
      credito_fiscal: totales.creditoFiscal,
      saldo_tecnico_anterior: entrada.saldoTecnicoAnterior,
      saldo_libre_disp_anterior: entrada.saldoLibreDispAnterior,
      retenciones_sufridas: entrada.retencionesSufridas,
      percepciones_sufridas: entrada.percepcionesSufridas,
      saldo_tecnico_resultante: resultado.saldoTecnicoResultante,
      saldo_libre_disp_resultante: resultado.saldoLibreDispResultante,
      saldo_a_pagar: resultado.saldoAPagar,
      observaciones: observaciones.trim() || null,
      detalle: { comprobantesVentas: totales.comprobantesVentas, comprobantesCompras: totales.comprobantesCompras }
    })
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: 'Liquidación guardada como abierta.' })
    void cargarHistorial()
  }

  const cambiarEstado = async (estado: LiquidacionIvaRow['estado']) => {
    const texto =
      estado === 'Abierta'
        ? `¿Reabrir la liquidación de ${periodo}? Se podrá recalcular.`
        : estado === 'Cerrada'
          ? `¿Cerrar la liquidación de ${periodo}? Sus saldos pasan al período siguiente.`
          : `¿Marcar ${periodo} como presentada ante ARCA?`
    if (!window.confirm(texto)) return
    const r = await cambiarEstadoLiquidacionIva(periodo, estado)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: `Liquidación ${estado.toLowerCase()}.` })
    void cargarHistorial()
  }

  const setNum = (k: keyof Entrada, v: string) => setEntrada((e) => ({ ...e, [k]: Number(v) || 0 }))

  const descargar = (clave: keyof typeof NOMBRES_LIBRO_IVA_DIGITAL) => {
    if (!libro) return
    const contenido = libro[clave]
    if (!contenido) return setMsg({ tipo: 'warn', texto: `${NOMBRES_LIBRO_IVA_DIGITAL[clave]} no tiene registros en ${periodo}.` })
    descargarTexto(`${periodo.replace('-', '')}_${NOMBRES_LIBRO_IVA_DIGITAL[clave]}`, contenido)
  }

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🏛️"
        titulo="Liquidación de IVA y Libro IVA Digital"
        subtitulo="Débito y crédito fiscal del mes, saldos, estados de la liquidación y archivos TXT para ARCA."
        volverA="/erp/impuestos"
        volverTexto="Impuestos"
      />

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      <div className="erp-toolbar">
        <label className="erp-field">
          <span className="erp-field__label">Período</span>
          <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={cargando} onClick={() => void calcular()}>
          {cargando ? 'Calculando…' : 'Calcular'}
        </button>
        {guardada && <span className={`erp-pill ${PILL[guardada.estado]}`}>{guardada.estado}</span>}
      </div>

      {datos && totales && resultado && (
        <>
          <div className="erp-panel">
            <h2>Liquidación {periodo}</h2>
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(totales.debitoFiscal)}</div>
                <div className="erp-kpi-label">Débito fiscal ({totales.comprobantesVentas} comp. de venta)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(totales.creditoFiscal)}</div>
                <div className="erp-kpi-label">Crédito fiscal ({totales.comprobantesCompras} comp. de compra)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(resultado.saldoAPagar)}</div>
                <div className="erp-kpi-label">Saldo a pagar</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(resultado.saldoTecnicoResultante)}</div>
                <div className="erp-kpi-label">Saldo técnico a favor</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{fmtMoney(resultado.saldoLibreDispResultante)}</div>
                <div className="erp-kpi-label">Saldo de libre disponibilidad</div>
              </div>
            </div>

            <div className="erpx-form" style={{ marginTop: 16 }}>
              {(
                [
                  ['saldoTecnicoAnterior', 'Saldo técnico a favor anterior'],
                  ['saldoLibreDispAnterior', 'Saldo libre disp. anterior'],
                  ['retencionesSufridas', 'Retenciones sufridas'],
                  ['percepcionesSufridas', 'Percepciones sufridas']
                ] as Array<[keyof Entrada, string]>
              ).map(([k, etiqueta]) => (
                <label key={k} className="erp-field">
                  <span className="erp-field__label">{etiqueta}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={bloqueada}
                    value={bloqueada ? resultado[k] : entrada[k]}
                    onChange={(e) => setNum(k, e.target.value)}
                  />
                </label>
              ))}
              <label className="erp-field erp-field--wide">
                <span className="erp-field__label">Observaciones</span>
                <input value={observaciones} disabled={bloqueada} onChange={(e) => setObservaciones(e.target.value)} />
              </label>
            </div>
            <p className="erp-muted" style={{ marginTop: 8 }}>
              Solo las facturas A de compra dan crédito fiscal. Las notas de crédito restan. Las percepciones de IVA cargadas en facturas de compra se suman automáticamente.
            </p>

            <div className="erpx-actions">
              {!bloqueada && (
                <button type="button" className="btn-primary" onClick={() => void guardar()}>
                  Guardar liquidación
                </button>
              )}
              {guardada?.estado === 'Abierta' && (
                <button type="button" className="btn-secondary" onClick={() => void cambiarEstado('Cerrada')}>
                  Cerrar
                </button>
              )}
              {guardada?.estado === 'Cerrada' && (
                <button type="button" className="btn-secondary" onClick={() => void cambiarEstado('Presentada')}>
                  Marcar presentada
                </button>
              )}
              {bloqueada && (
                <button type="button" className="btn-secondary" onClick={() => void cambiarEstado('Abierta')}>
                  Reabrir
                </button>
              )}
            </div>
          </div>

          {libro && (
            <div className="erp-panel">
              <h2>Libro IVA Digital — archivos TXT</h2>
              <p className="erp-muted">
                Ventas: {libro.resumen.ventas.comprobantes} comprobantes · neto {fmtMoney(libro.resumen.ventas.neto)} · IVA {fmtMoney(libro.resumen.ventas.iva)}. Compras:{' '}
                {libro.resumen.compras.comprobantes} comprobantes · neto {fmtMoney(libro.resumen.compras.neto)} · IVA {fmtMoney(libro.resumen.compras.iva)}.
              </p>
              <div className="erpx-actions">
                {(Object.keys(NOMBRES_LIBRO_IVA_DIGITAL) as Array<keyof typeof NOMBRES_LIBRO_IVA_DIGITAL>).map((k) => (
                  <button key={k} type="button" className="btn-secondary" onClick={() => descargar(k)}>
                    {NOMBRES_LIBRO_IVA_DIGITAL[k].replace('LIBRO_IVA_DIGITAL_', '').replace('.txt', '')}
                  </button>
                ))}
              </div>
              {libro.warnings.length > 0 && (
                <div className="erpx-msg erpx-msg--warn" style={{ marginTop: 14 }}>
                  {libro.warnings.length} aviso(s) para revisar antes de presentar:
                  <ul className="erpx-list">
                    {libro.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="erp-muted" style={{ marginTop: 10 }}>
                Validá los archivos con el importador de ARCA antes de presentar: el diseño es de ancho fijo y cualquier dato incompleto (CUIT, tipo de comprobante) hace que se rechace.
              </p>
            </div>
          )}
        </>
      )}

      <div className="erp-panel">
        <h2>Historial de liquidaciones</h2>
        {historial.length === 0 ? (
          <p className="erp-muted">Todavía no hay liquidaciones guardadas.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Estado</th>
                  <th className="erpx-right">Débito</th>
                  <th className="erpx-right">Crédito</th>
                  <th className="erpx-right">A pagar</th>
                  <th className="erpx-right">Saldo a favor</th>
                  <th>Cierre</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>{h.periodo}</td>
                    <td>
                      <span className={`erp-pill ${PILL[h.estado]}`}>{h.estado}</span>
                    </td>
                    <td className="erpx-right">{fmtMoney(h.debito_fiscal)}</td>
                    <td className="erpx-right">{fmtMoney(h.credito_fiscal)}</td>
                    <td className="erpx-right">{fmtMoney(h.saldo_a_pagar)}</td>
                    <td className="erpx-right">{fmtMoney(h.saldo_tecnico_resultante + h.saldo_libre_disp_resultante)}</td>
                    <td>{fmtFecha(h.fecha_presentacion || h.fecha_cierre)}</td>
                    <td>
                      <button
                        type="button"
                        className="erpx-btn-sm"
                        onClick={() => {
                          setPeriodo(h.periodo)
                          setDatos(null)
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
