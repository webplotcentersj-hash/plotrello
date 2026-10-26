import { useEffect, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import {
  cerrarPeriodoContable,
  listPeriodosContables,
  reabrirPeriodoContable,
  resumenAsientosPeriodo,
  type PeriodoContable,
  type ResumenPeriodo
} from '../services/erpContableApi'
import { fmtFecha, fmtMoney, periodoActual } from '../utils/erpUi'
import { esPeriodoValido, periodoAnterior } from '../utils/liquidacionIva'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'

export default function ErpPeriodosContablesPage() {
  const [periodo, setPeriodo] = useState(periodoAnterior(periodoActual()))
  const [observaciones, setObservaciones] = useState('')
  const [periodos, setPeriodos] = useState<PeriodoContable[]>([])
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const estado = periodos.find((p) => p.periodo === periodo)?.estado ?? 'Abierto'

  const cargar = async () => {
    const r = await listPeriodosContables()
    if (r.success) setPeriodos(r.data)
    else setMsg({ tipo: 'error', texto: r.error })
  }

  useEffect(() => {
    void cargar()
  }, [])

  useEffect(() => {
    setResumen(null)
    if (!esPeriodoValido(periodo)) return
    let cancelado = false
    void resumenAsientosPeriodo(periodo).then((r) => {
      if (!cancelado && r.success) setResumen(r.data)
    })
    return () => {
      cancelado = true
    }
  }, [periodo])

  const ejecutar = async (accion: 'cerrar' | 'reabrir') => {
    setMsg(null)
    if (!esPeriodoValido(periodo)) return setMsg({ tipo: 'error', texto: 'Elegí un período válido.' })
    const texto =
      accion === 'cerrar'
        ? `¿Cerrar ${periodo}? No se podrán crear ni modificar asientos con fecha en ese mes.`
        : `¿Reabrir ${periodo}? Volverá a permitir cambios en sus asientos.`
    if (!window.confirm(texto)) return
    setOcupado(true)
    const r = accion === 'cerrar' ? await cerrarPeriodoContable(periodo, observaciones) : await reabrirPeriodoContable(periodo, observaciones)
    setOcupado(false)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: accion === 'cerrar' ? `Período ${periodo} cerrado.` : `Período ${periodo} reabierto.` })
    setObservaciones('')
    void cargar()
  }

  return (
    <div className="erp-section">
      <ErpPageHeader
        icon="🔒"
        titulo="Períodos contables"
        subtitulo="Cerrá cada mes para impedir cambios en sus asientos. Los períodos se pueden reabrir."
        volverA="/erp/contabilidad"
        volverTexto="Contabilidad"
      />

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      <div className="erp-panel">
        <h2>Cerrar o reabrir un período</h2>
        <div className="erpx-form">
          <label className="erp-field">
            <span className="erp-field__label">Período</span>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Estado actual</span>
            <span className={`erp-pill ${estado === 'Cerrado' ? 'ok' : 'warn'}`} style={{ alignSelf: 'flex-start' }}>
              {estado}
            </span>
          </label>
          <label className="erp-field erp-field--wide">
            <span className="erp-field__label">Observaciones</span>
            <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional: quién revisó, motivo de reapertura…" />
          </label>
        </div>

        {resumen && (
          <div className="erp-kpi" style={{ marginTop: 14 }}>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{resumen.asientos}</div>
              <div className="erp-kpi-label">Asientos del mes</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{resumen.borradores}</div>
              <div className="erp-kpi-label">En borrador</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{fmtMoney(resumen.debe)}</div>
              <div className="erp-kpi-label">Total debe</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{fmtMoney(resumen.haber)}</div>
              <div className="erp-kpi-label">Total haber</div>
            </div>
          </div>
        )}
        {resumen && resumen.borradores > 0 && (
          <p className="erpx-msg erpx-msg--warn" style={{ marginTop: 12 }}>
            Hay asientos en borrador: contabilizalos o anulalos para poder cerrar.
          </p>
        )}

        <div className="erpx-actions">
          {estado === 'Abierto' ? (
            <button type="button" className="btn-primary" disabled={ocupado} onClick={() => void ejecutar('cerrar')}>
              Cerrar período
            </button>
          ) : (
            <button type="button" className="btn-secondary" disabled={ocupado} onClick={() => void ejecutar('reabrir')}>
              Reabrir período
            </button>
          )}
        </div>
      </div>

      <div className="erp-panel">
        <h2>Historial</h2>
        {periodos.length === 0 ? (
          <p className="erp-muted">Todavía no cerraste ningún período.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Observaciones</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p.periodo}>
                    <td>{p.periodo}</td>
                    <td>
                      <span className={`erp-pill ${p.estado === 'Cerrado' ? 'ok' : 'warn'}`}>{p.estado}</span>
                    </td>
                    <td>{fmtFecha(p.fecha_cierre)}</td>
                    <td>{p.observaciones || '—'}</td>
                    <td>
                      <button type="button" className="erpx-btn-sm" onClick={() => setPeriodo(p.periodo)}>
                        Elegir
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
