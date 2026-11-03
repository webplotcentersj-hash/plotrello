import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RemitoNuevoModal, { type VentaParaRemito } from '../components/remitos/RemitoNuevoModal'
import {
  esRemitoParcial,
  numeroDeEntrega,
  numeroRemito,
  resumenRemitos,
  type Remito
} from '../features/remitos/remitosLogica'
import {
  anularRemito,
  buscarVentasParaRemito,
  listarRemitos,
  type VentaBuscada
} from '../services/remitosApi'
import { descargarRemitoPdf } from '../utils/documentos/remitoPdf'
import './ErpSectionPage.css'
import './RemitosPage.css'

const fechaAr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const cantidad = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

const mismoOrigen = (a: Remito, b: Remito) =>
  (a.id_venta && a.id_venta === b.id_venta) || (!a.id_venta && a.id_op && a.id_op === b.id_op)

export default function RemitosPage() {
  const navigate = useNavigate()
  const [remitos, setRemitos] = useState<Remito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [estado, setEstado] = useState<'' | 'Emitido' | 'Anulado'>('')
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const [eligiendoVenta, setEligiendoVenta] = useState(false)
  const [ventaElegida, setVentaElegida] = useState<VentaParaRemito | null>(null)
  const [remitoACopiar, setRemitoACopiar] = useState<Remito | null>(null)
  const [anulando, setAnulando] = useState<Remito | null>(null)
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await listarRemitos({ desde: desde || undefined, hasta: hasta || undefined })
    if (r.success) {
      setRemitos(r.data ?? [])
      setError(null)
    } else {
      setError(r.error ?? 'No se pudieron leer los remitos')
    }
    setCargando(false)
  }, [desde, hasta])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return remitos.filter((r) => {
      if (estado && r.estado !== estado) return false
      if (!q) return true
      return [numeroRemito(r), r.cliente_nombre, r.numero_venta, r.numero_op, r.entregado_a, ...r.items.map((i) => i.descripcion)]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q))
    })
  }, [remitos, estado, busqueda])

  const resumen = useMemo(() => resumenRemitos(visibles), [visibles])

  const descargar = async (r: Remito) => {
    setError(null)
    try {
      const mismos = remitos.filter((x) => mismoOrigen(x, r))
      await descargarRemitoPdf(r, null, { numeroEntrega: mismos.length ? numeroDeEntrega(r, mismos) : undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    }
  }

  const confirmarAnulacion = async () => {
    if (!anulando) return
    if (!motivo.trim()) {
      setError('Indicá el motivo de la anulación')
      return
    }
    setTrabajando(true)
    const r = await anularRemito(anulando.id, motivo.trim())
    setTrabajando(false)
    if (!r.success) {
      setError(r.error ?? 'No se pudo anular el remito')
      return
    }
    setMensaje(`Remito ${numeroRemito(anulando)} anulado: lo que remitía vuelve a figurar como pendiente.`)
    setAnulando(null)
    setMotivo('')
    setError(null)
    void cargar()
  }

  return (
    <div className="erp-section">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            📦
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Ventas</p>
            <h1>Remitos</h1>
            <p className="erp-section-sub">Remito X interno, con entregas parciales y control de lo pendiente</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/ventas')}>
            ← Ventas
          </button>
          <button type="button" className="btn-primary" onClick={() => setEligiendoVenta(true)}>
            + Nuevo remito
          </button>
        </div>
      </header>

      {error ? (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      ) : null}
      {mensaje ? (
        <div className="erp-panel">
          <span className="erp-pill ok">OK</span> <span className="erp-muted">{mensaje}</span>
        </div>
      ) : null}

      <div className="erp-panel">
        <div className="erp-toolbar remitos-toolbar">
          <label className="erp-field">
            <span className="erp-field__label">Buscar</span>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Número, cliente, venta, OP…" />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Estado</span>
            <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
              <option value="">Todos</option>
              <option value="Emitido">Emitidos</option>
              <option value="Anulado">Anulados</option>
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <span className="erp-muted remitos-resumen">
            {resumen.emitidos} emitidos{resumen.anulados ? ` · ${resumen.anulados} anulados` : ''}
          </span>
        </div>

        {cargando ? (
          <p className="erp-muted">Cargando remitos…</p>
        ) : visibles.length === 0 ? (
          <div className="erp-empty">
            <div className="erp-empty__icon">📦</div>
            <p>No hay remitos con esos filtros.</p>
          </div>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Remito</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Venta / OP</th>
                  <th>Detalle</th>
                  <th>Entrega</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const parcial = r.estado === 'Emitido' && esRemitoParcial(r)
                  return (
                    <tr key={r.id} className={r.estado === 'Anulado' ? 'remitos-anulado' : undefined}>
                      <td>
                        <strong>{numeroRemito(r)}</strong>
                      </td>
                      <td>{fechaAr(r.fecha_emision)}</td>
                      <td>{r.cliente_nombre}</td>
                      <td>
                        {r.numero_venta ?? '—'}
                        {r.numero_op ? <span className="erp-muted"> · {r.numero_op}</span> : null}
                      </td>
                      <td className="remitos-detalle">
                        {r.items.slice(0, 2).map((i) => `${cantidad(i.cantidad)}${i.unidad ? ` ${i.unidad}` : ''} ${i.descripcion}`).join(' · ')}
                        {r.items.length > 2 ? <span className="erp-muted"> +{r.items.length - 2} más</span> : null}
                      </td>
                      <td>
                        {r.estado === 'Anulado' ? (
                          '—'
                        ) : (
                          <span className={`erp-pill ${parcial ? 'warn' : 'ok'}`}>{parcial ? 'Parcial' : 'Completa'}</span>
                        )}
                      </td>
                      <td>
                        <span className={`erp-pill ${r.estado === 'Anulado' ? 'danger' : 'ok'}`} title={r.anulado_motivo ?? undefined}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="remitos-acciones">
                        <button type="button" className="btn-secondary" onClick={() => void descargar(r)}>
                          PDF
                        </button>
                        {r.id_venta ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            title="Remito nuevo con las mismas cantidades y datos de entrega (sin número ni fechas)"
                            onClick={() => {
                              setRemitoACopiar(r)
                              setVentaElegida({
                                id: r.id_venta as number,
                                numero_venta: r.numero_venta ?? '',
                                cliente_nombre: r.cliente_nombre,
                                cliente_dni_cuit: r.cliente_documento,
                                cliente_direccion: r.cliente_domicilio,
                                cliente_telefono: r.cliente_telefono,
                                id_op: r.id_op,
                                numero_op: r.numero_op
                              })
                            }}
                          >
                            Copiar
                          </button>
                        ) : null}
                        {r.estado === 'Emitido' ? (
                          <button type="button" className="btn-secondary" onClick={() => { setAnulando(r); setMotivo(''); setError(null) }}>
                            Anular
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {eligiendoVenta ? (
        <ElegirVentaModal
          onClose={() => setEligiendoVenta(false)}
          onElegir={(v) => {
            setEligiendoVenta(false)
            setVentaElegida(v)
          }}
        />
      ) : null}

      {ventaElegida ? (
        <RemitoNuevoModal
          venta={ventaElegida}
          copiarDe={remitoACopiar}
          onClose={() => {
            setVentaElegida(null)
            setRemitoACopiar(null)
          }}
          onCreado={() => {
            setMensaje(null)
            void cargar()
          }}
        />
      ) : null}

      {anulando ? (
        <div className="remito-modal-overlay" role="dialog" aria-modal="true" aria-label="Anular remito" onClick={() => !trabajando && setAnulando(null)}>
          <div className="remito-modal remitos-anular" onClick={(e) => e.stopPropagation()}>
            <header className="remito-modal__head">
              <div>
                <p className="remito-modal__eyebrow">Anular remito</p>
                <h2>{numeroRemito(anulando)}</h2>
                <p className="remito-modal__sub">{anulando.cliente_nombre}</p>
              </div>
            </header>
            <div className="remito-modal__body">
              <p className="remito-muted">
                El remito queda en el historial como anulado y las cantidades vuelven a figurar como pendientes. El número no se reutiliza.
              </p>
              <label className="remitos-anular__campo">
                <span>Motivo</span>
                <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Cargado por error" autoFocus />
              </label>
              {error ? <div className="remito-aviso remito-aviso--error">{error}</div> : null}
              <div className="remito-modal__foot">
                <button type="button" className="remito-btn" onClick={() => setAnulando(null)} disabled={trabajando}>
                  Cancelar
                </button>
                <button type="button" className="remito-btn remito-btn--primario" onClick={() => void confirmarAnulacion()} disabled={trabajando}>
                  {trabajando ? 'Anulando…' : 'Anular remito'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ElegirVentaModal({ onClose, onElegir }: { onClose: () => void; onElegir: (venta: VentaParaRemito) => void }) {
  const [texto, setTexto] = useState('')
  const [ventas, setVentas] = useState<VentaBuscada[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const t = setTimeout(async () => {
      setBuscando(true)
      const r = await buscarVentasParaRemito(texto)
      if (!vigente) return
      setBuscando(false)
      if (r.success) {
        setVentas(r.data ?? [])
        setError(null)
      } else {
        setError(r.error ?? 'No se pudo buscar')
      }
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [texto])

  return (
    <div className="remito-modal-overlay" role="dialog" aria-modal="true" aria-label="Elegir venta" onClick={onClose}>
      <div className="remito-modal remitos-anular" onClick={(e) => e.stopPropagation()}>
        <header className="remito-modal__head">
          <div>
            <p className="remito-modal__eyebrow">Nuevo remito</p>
            <h2>¿De qué venta?</h2>
            <p className="remito-modal__sub">Buscá por número de venta, cliente u OP</p>
          </div>
          <button type="button" className="remito-modal__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="remito-modal__body">
          <label className="remitos-anular__campo">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. V-2026-0005, Rodríguez, OP-1042" autoFocus />
          </label>
          {error ? <div className="remito-aviso remito-aviso--error">{error}</div> : null}
          {buscando && ventas.length === 0 ? <p className="remito-muted">Buscando…</p> : null}
          <ul className="remitos-ventas">
            {ventas.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() =>
                    onElegir({
                      id: v.id,
                      numero_venta: v.numero_venta,
                      cliente_nombre: v.cliente_nombre,
                      cliente_dni_cuit: v.cliente_dni_cuit,
                      cliente_direccion: v.cliente_direccion,
                      cliente_telefono: v.cliente_telefono,
                      id_op: v.id_op,
                      numero_op: v.numero_op
                    })
                  }
                >
                  <strong>{v.numero_venta}</strong>
                  <span>{v.cliente_nombre}</span>
                  <small>
                    {fechaAr(v.fecha_venta)}
                    {v.numero_op ? ` · ${v.numero_op}` : ''} · {v.estado_pago}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {!buscando && ventas.length === 0 && !error ? <p className="remito-muted">No hay ventas que coincidan.</p> : null}
        </div>
      </div>
    </div>
  )
}
