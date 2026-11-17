import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../../services/api'
import {
  DIAS_VENTA_ATRASADA,
  cargarFacturasConProblema,
  cargarTotalesMes,
  cargarVentasPorFacturar,
  diasDesde,
  mesAnterior,
  resumirPorFacturar,
  type FacturaConProblema,
  type TotalesPeriodo
} from '../../services/facturacionResumen'
import type { Venta } from '../../types/api'
import { formatFechaAr } from '../../utils/afipFacturaUi'
import { getArgentinaDateString } from '../../utils/dateUtils'
import './FacturacionResumenPanel.css'

const VENTAS_VISIBLES = 6
const PROBLEMAS_VISIBLES = 8

function pesos(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function nombreMes(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
}

type Props = {
  /** Se llama cuando un reintento cambió alguna factura, para recargar el listado. */
  onFacturasCambiaron?: () => void
}

export default function FacturacionResumenPanel({ onFacturasCambiaron }: Props) {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const mes = hoy.slice(0, 7)

  const [totales, setTotales] = useState<{ actual: TotalesPeriodo; anterior: TotalesPeriodo } | null>(null)
  const [ventas, setVentas] = useState<Venta[] | null>(null)
  const [problemas, setProblemas] = useState<FacturaConProblema[] | null>(null)
  const [errores, setErrores] = useState<string[]>([])
  const [reintentandoId, setReintentandoId] = useState<number | null>(null)
  const [verTodasVentas, setVerTodasVentas] = useState(false)
  const [verTodosProblemas, setVerTodosProblemas] = useState(false)

  const cargarProblemas = useCallback(async () => {
    const r = await cargarFacturasConProblema()
    if (r.ok) setProblemas(r.facturas)
    else setErrores((e) => [...e, `Problemas ARCA: ${r.error}`])
  }, [])

  const cargarTotales = useCallback(async () => {
    const r = await cargarTotalesMes(mes)
    if (r.ok) setTotales({ actual: r.actual, anterior: r.anterior })
    else setErrores((e) => [...e, `Totales: ${r.error}`])
  }, [mes])

  useEffect(() => {
    void cargarTotales()
    void cargarProblemas()
    void cargarVentasPorFacturar().then((r) => {
      if (r.ok) setVentas(r.ventas)
      else setErrores((e) => [...e, `Ventas por facturar: ${r.error}`])
    })
  }, [cargarTotales, cargarProblemas])

  const resumenVentas = useMemo(() => (ventas ? resumirPorFacturar(ventas, hoy) : null), [ventas, hoy])

  const variacion = useMemo(() => {
    if (!totales || totales.anterior.total === 0) return null
    return ((totales.actual.total - totales.anterior.total) / Math.abs(totales.anterior.total)) * 100
  }, [totales])

  const reintentar = async (f: FacturaConProblema) => {
    if (reintentandoId != null) return
    const aviso =
      f.problema.tipo === 'efectos'
        ? `¿Generar la cuenta por cobrar y el asiento de ${f.tipo_comprobante} ${f.numero_factura}?`
        : `¿Enviar ${f.tipo_comprobante} ${f.numero_factura} (${f.cliente_nombre}, ${pesos(f.total)}) a ARCA?\n\nSi ARCA la autoriza queda emitida con CAE y no se puede deshacer (solo con nota de crédito).`
    if (!window.confirm(aviso)) return
    setReintentandoId(f.id)
    try {
      const r = await apiService.emitirFactura(f.id)
      if (!r.success) alert('ARCA no la autorizó:\n\n' + (r.error || 'error desconocido'))
      else if (r.warning) alert(`Autorizada, con un pendiente:\n\n${r.warning}`)
    } finally {
      setReintentandoId(null)
      await Promise.all([cargarProblemas(), cargarTotales()])
      onFacturasCambiaron?.()
    }
  }

  const ventasMostradas = ventas ? (verTodasVentas ? ventas : ventas.slice(0, VENTAS_VISIBLES)) : []
  const problemasMostrados = problemas
    ? verTodosProblemas
      ? problemas
      : problemas.slice(0, PROBLEMAS_VISIBLES)
    : []

  return (
    <div className="fact-resumen">
      {/* Totales del mes */}
      <section className="fact-resumen__kpis" aria-label={`Facturación de ${nombreMes(mes)}`}>
        <div className="fact-kpi fact-kpi--main">
          <span className="fact-kpi__label">Facturado en {nombreMes(mes)}</span>
          <span className="fact-kpi__value">{totales ? pesos(totales.actual.total) : '…'}</span>
          <span className="fact-kpi__hint">
            {totales ? `${totales.actual.cantidad} facturas` : ''}
            {variacion != null ? (
              <span className={variacion >= 0 ? 'is-up' : 'is-down'}>
                {' '}
                · {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toLocaleString('es-AR', { maximumFractionDigits: 0 })}% vs{' '}
                {nombreMes(mesAnterior(mes))}
              </span>
            ) : null}
          </span>
        </div>
        <div className="fact-kpi">
          <span className="fact-kpi__label">Neto</span>
          <span className="fact-kpi__value">{totales ? pesos(totales.actual.neto) : '…'}</span>
        </div>
        <div className="fact-kpi">
          <span className="fact-kpi__label">IVA débito fiscal</span>
          <span className="fact-kpi__value">{totales ? pesos(totales.actual.iva) : '…'}</span>
        </div>
        <div className="fact-kpi">
          <span className="fact-kpi__label">Por tipo</span>
          {totales ? (
            <span className="fact-kpi__letras">
              {(['A', 'B', 'C'] as const)
                .filter((l) => totales.actual.porLetra[l].cantidad > 0 || totales.actual.porLetra[l].total !== 0)
                .map((l) => (
                  <span key={l}>
                    <b>{l}</b> {pesos(totales.actual.porLetra[l].total)}
                    <small> · IVA {pesos(totales.actual.porLetra[l].iva)}</small>
                  </span>
                ))}
              {totales.actual.cantidad === 0 ? <span>Sin facturas este mes</span> : null}
            </span>
          ) : (
            <span className="fact-kpi__value">…</span>
          )}
        </div>
      </section>
      <p className="fact-resumen__nota">Solo comprobantes autorizados. Las notas de crédito restan.</p>

      {/* Facturas con problema en ARCA */}
      {problemas && problemas.length > 0 ? (
        <section className="fact-panel fact-panel--danger">
          <header className="fact-panel__head">
            <h2>
              Problemas en ARCA <span className="fact-count">{problemas.length}</span>
            </h2>
            <p>Comprobantes que no quedaron autorizados o a los que les falta la cuenta por cobrar.</p>
          </header>
          <ul className="fact-list">
            {problemasMostrados.map((f) => (
              <li key={f.id} className="fact-list__row">
                <span className={`fact-tag fact-tag--${f.problema.nivel}`}>{f.problema.label}</span>
                <span className="fact-list__main">
                  <strong>
                    {f.tipo_comprobante} {f.numero_factura}
                  </strong>
                  <span>
                    {f.cliente_nombre} · {formatFechaAr(f.fecha_emision)}
                  </span>
                  {f.resultado_afip && f.problema.nivel === 'danger' ? (
                    <small className="fact-list__detalle" title={f.resultado_afip}>
                      {f.resultado_afip}
                    </small>
                  ) : null}
                </span>
                <span className="fact-list__monto">{pesos(f.total)}</span>
                <span className="fact-list__acciones">
                  <button type="button" className="fact-btn" onClick={() => navigate(`/erp/facturas/${f.id}`)}>
                    Ver
                  </button>
                  <button
                    type="button"
                    className="fact-btn fact-btn--primary"
                    disabled={reintentandoId != null}
                    onClick={() => void reintentar(f)}
                  >
                    {reintentandoId === f.id ? 'Enviando…' : f.problema.accion}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {problemas.length > PROBLEMAS_VISIBLES ? (
            <button type="button" className="fact-link" onClick={() => setVerTodosProblemas((v) => !v)}>
              {verTodosProblemas ? 'Ver menos' : `Ver las ${problemas.length}`}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Ventas sin comprobante */}
      {ventas && resumenVentas ? (
        resumenVentas.cantidad === 0 ? (
          <section className="fact-panel fact-panel--ok">
            <header className="fact-panel__head">
              <h2>Ventas por facturar</h2>
              <p>Todas las ventas tienen su comprobante.</p>
            </header>
          </section>
        ) : (
          <section className={`fact-panel${resumenVentas.atrasadas > 0 ? ' fact-panel--warn' : ''}`}>
            <header className="fact-panel__head">
              <h2>
                Ventas por facturar <span className="fact-count">{resumenVentas.cantidad}</span>
              </h2>
              <p>
                {pesos(resumenVentas.monto)} sin comprobante
                {resumenVentas.atrasadas > 0 ? (
                  <>
                    {' · '}
                    <b>
                      {resumenVentas.atrasadas} con más de {DIAS_VENTA_ATRASADA} días
                    </b>
                  </>
                ) : null}
                . Las más viejas primero.
              </p>
              <button type="button" className="fact-btn" onClick={() => navigate('/ventas?tab=por-facturar')}>
                Abrir «Por facturar» en Ventas
              </button>
            </header>
            <ul className="fact-list">
              {ventasMostradas.map((v) => {
                const dias = diasDesde(v.fecha_venta, hoy)
                const atrasada = dias > DIAS_VENTA_ATRASADA
                return (
                  <li key={v.id} className="fact-list__row">
                    <span className={`fact-tag ${atrasada ? 'fact-tag--warn' : 'fact-tag--neutral'}`}>
                      {dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`}
                    </span>
                    <span className="fact-list__main">
                      <strong>
                        {v.numero_venta ? `Venta ${v.numero_venta}` : `Venta #${v.id}`}
                        {v.numero_op ? ` · OP ${v.numero_op}` : ''}
                      </strong>
                      <span>
                        {v.cliente_nombre || 'Consumidor final'} · {formatFechaAr(v.fecha_venta)}
                        {v.metodo_pago ? ` · ${v.metodo_pago}` : ''}
                      </span>
                    </span>
                    <span className="fact-list__monto">{pesos(Number(v.valor_total) || 0)}</span>
                    <span className="fact-list__acciones">
                      <button type="button" className="fact-btn" onClick={() => navigate(`/ventas?ventaId=${v.id}`)}>
                        Ver venta
                      </button>
                      <button
                        type="button"
                        className="fact-btn fact-btn--primary"
                        onClick={() => navigate(`/erp/facturas/nueva?id_venta=${v.id}`)}
                      >
                        Facturar
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
            {ventas.length > VENTAS_VISIBLES ? (
              <button type="button" className="fact-link" onClick={() => setVerTodasVentas((v) => !v)}>
                {verTodasVentas ? 'Ver menos' : `Ver las ${ventas.length}`}
              </button>
            ) : null}
          </section>
        )
      ) : null}

      {errores.length > 0 ? (
        <p className="fact-resumen__error" role="status">
          No se pudo cargar parte del resumen: {errores.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
