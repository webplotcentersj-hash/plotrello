import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RemitoNuevoModal, { type VentaParaRemito } from '../components/remitos/RemitoNuevoModal'
import {
  CLASE_LABEL,
  claseDe,
  esRemitoParcial,
  estadoCai,
  etiquetaRemito,
  numeroDeEntrega,
  numeroRemito,
  resumenRemitos,
  type CaiRemito,
  type ClaseRemito,
  type Remito,
  type TipoRemito
} from '../features/remitos/remitosLogica'
import {
  anularRemito,
  buscarVentasParaRemito,
  guardarCaiRemito,
  listarCaiRemitos,
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
  const [claseNueva, setClaseNueva] = useState<ClaseRemito>('Entrega')
  const [trasladoAbierto, setTrasladoAbierto] = useState(false)
  const [caiAbierto, setCaiAbierto] = useState(false)
  const [cais, setCais] = useState<CaiRemito[]>([])
  const [tipoFiltro, setTipoFiltro] = useState<'' | TipoRemito>('')
  const [claseFiltro, setClaseFiltro] = useState<'' | ClaseRemito>('')
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

  const cargarCais = useCallback(async () => {
    const r = await listarCaiRemitos()
    if (r.success) setCais(r.data ?? [])
  }, [])

  useEffect(() => {
    void cargarCais()
  }, [cargarCais])

  /** Aviso arriba si el CAI activo está por vencer o vencido. */
  const avisoCai = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    const activos = cais.filter((c) => c.activo)
    if (activos.length === 0) return null
    const vigentes = activos.filter((c) => estadoCai(c, hoy) !== 'Vencido')
    if (vigentes.length === 0) {
      return { tono: 'danger', texto: 'El CAI de Remito R está vencido: no se pueden emitir remitos R hasta cargar el nuevo.' }
    }
    const porVencer = vigentes.filter((c) => estadoCai(c, hoy) === 'Por vencer')
    if (porVencer.length === vigentes.length) {
      const c = [...porVencer].sort((a, b) => b.fecha_vencimiento.localeCompare(a.fecha_vencimiento))[0]
      return {
        tono: 'warn',
        texto: `El CAI de Remito R (PV ${String(c.punto_venta).padStart(4, '0')}) vence el ${fechaAr(c.fecha_vencimiento)}: pedí el nuevo en ARCA.`
      }
    }
    return null
  }, [cais])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return remitos.filter((r) => {
      if (estado && r.estado !== estado) return false
      if (tipoFiltro && r.tipo !== tipoFiltro) return false
      if (claseFiltro && claseDe(r) !== claseFiltro) return false
      if (!q) return true
      return [numeroRemito(r), r.deposito_origen, r.deposito_destino, r.cliente_nombre, r.numero_venta, r.numero_op, r.entregado_a, ...r.items.map((i) => i.descripcion)]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q))
    })
  }, [remitos, estado, busqueda, tipoFiltro, claseFiltro])

  const resumen = useMemo(() => resumenRemitos(visibles), [visibles])

  const descargar = async (r: Remito) => {
    setError(null)
    try {
      const mismos = remitos.filter((x) => mismoOrigen(x, r))
      const conNumero = claseDe(r) === 'Entrega' && mismos.length > 0
      await descargarRemitoPdf(r, null, { numeroEntrega: conNumero ? numeroDeEntrega(r, mismos) : undefined })
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
    setMensaje(
      claseDe(anulando) === 'Devolucion'
        ? `${etiquetaRemito(anulando)} anulado: lo devuelto vuelve a contar como entregado.`
        : `${etiquetaRemito(anulando)} anulado: lo que remitía vuelve a figurar como pendiente.`
    )
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
            <p className="erp-section-sub">Remitos X (internos) y R (fiscales con CAI): entregas parciales, devoluciones y traslados</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/ventas')}>
            ← Ventas
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCaiAbierto(true)}>
            CAI Remito R
          </button>
          <button type="button" className="btn-secondary" onClick={() => setTrasladoAbierto(true)}>
            + Traslado
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setClaseNueva('Entrega')
              setRemitoACopiar(null)
              setEligiendoVenta(true)
            }}
          >
            + Nuevo remito
          </button>
        </div>
      </header>

      {avisoCai ? (
        <div className="erp-panel">
          <span className={`erp-pill ${avisoCai.tono}`}>CAI</span> <span className="erp-muted">{avisoCai.texto}</span>{' '}
          <button type="button" className="btn-secondary" onClick={() => setCaiAbierto(true)}>
            Cargar CAI
          </button>
        </div>
      ) : null}
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
            <span className="erp-field__label">Tipo</span>
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}>
              <option value="">X y R</option>
              <option value="X">Remito X</option>
              <option value="R">Remito R</option>
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Clase</span>
            <select value={claseFiltro} onChange={(e) => setClaseFiltro(e.target.value as typeof claseFiltro)}>
              <option value="">Todas</option>
              <option value="Entrega">Entregas</option>
              <option value="Devolucion">Devoluciones</option>
              <option value="Traslado">Traslados</option>
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
                  <th>Cliente / destino</th>
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
                  const clase = claseDe(r)
                  return (
                    <tr key={r.id} className={r.estado === 'Anulado' ? 'remitos-anulado' : undefined}>
                      <td>
                        <span className={`remitos-letra remitos-letra--${r.tipo === 'R' ? 'r' : 'x'}`}>{r.tipo === 'R' ? 'R' : 'X'}</span>
                        <strong>{numeroRemito(r)}</strong>
                        {r.tipo === 'R' && r.cai ? <div className="erp-muted remitos-cai-celda">CAI {r.cai}</div> : null}
                      </td>
                      <td>{fechaAr(r.fecha_emision)}</td>
                      <td>
                        {clase === 'Traslado' ? `${r.deposito_origen ?? '—'} → ${r.deposito_destino ?? '—'}` : r.cliente_nombre}
                      </td>
                      <td>
                        {r.numero_venta ?? '—'}
                        {r.numero_op ? <span className="erp-muted"> · {r.numero_op}</span> : null}
                      </td>
                      <td className="remitos-detalle">
                        {r.items.slice(0, 2).map((i) => `${cantidad(i.cantidad)}${i.unidad ? ` ${i.unidad}` : ''} ${i.descripcion}`).join(' · ')}
                        {r.items.length > 2 ? <span className="erp-muted"> +{r.items.length - 2} más</span> : null}
                      </td>
                      <td>
                        {clase !== 'Entrega' ? (
                          <span className="erp-pill">{CLASE_LABEL[clase]}</span>
                        ) : r.estado === 'Anulado' ? (
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
                        {r.id_venta && clase === 'Entrega' && r.estado === 'Emitido' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            title="Registrar que el cliente devuelve mercadería de esta venta"
                            onClick={() => {
                              setRemitoACopiar(null)
                              setClaseNueva('Devolucion')
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
                            Devolución
                          </button>
                        ) : null}
                        {r.id_venta && clase === 'Entrega' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            title="Remito nuevo con las mismas cantidades y datos de entrega (sin número ni fechas)"
                            onClick={() => {
                              setClaseNueva('Entrega')
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
          claseInicial={claseNueva}
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

      {trasladoAbierto ? (
        <RemitoNuevoModal
          venta={null}
          onClose={() => setTrasladoAbierto(false)}
          onCreado={() => {
            setMensaje(null)
            void cargar()
          }}
        />
      ) : null}

      {caiAbierto ? (
        <CaiRemitoModal
          cais={cais}
          onClose={() => setCaiAbierto(false)}
          onGuardado={(texto) => {
            setMensaje(texto)
            void cargarCais()
          }}
        />
      ) : null}

      {anulando ? (
        <div className="remito-modal-overlay" role="dialog" aria-modal="true" aria-label="Anular remito" onClick={() => !trabajando && setAnulando(null)}>
          <div className="remito-modal remitos-anular" onClick={(e) => e.stopPropagation()}>
            <header className="remito-modal__head">
              <div>
                <p className="remito-modal__eyebrow">Anular remito</p>
                <h2>{etiquetaRemito(anulando)}</h2>
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

type CaiForm = {
  id?: number
  punto_venta: string
  cai: string
  fecha_vencimiento: string
  numero_desde: string
  numero_hasta: string
  activo: boolean
  observaciones: string
}

const caiVacio = (): CaiForm => ({
  punto_venta: '',
  cai: '',
  fecha_vencimiento: '',
  numero_desde: '1',
  numero_hasta: '',
  activo: true,
  observaciones: ''
})

/** Alta y edición de los CAI de autoimpresor para Remito R (los da ARCA por punto de venta). */
function CaiRemitoModal({
  cais,
  onClose,
  onGuardado
}: {
  cais: CaiRemito[]
  onClose: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [form, setForm] = useState<CaiForm | null>(cais.length === 0 ? caiVacio() : null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

  const guardar = async () => {
    if (!form) return
    const pv = Number(form.punto_venta)
    const desde = Number(form.numero_desde)
    const hasta = Number(form.numero_hasta)
    const cai = form.cai.replace(/\s/g, '')
    if (!Number.isInteger(pv) || pv < 1 || pv > 9999) return setError('Punto de venta inválido (1 a 9999).')
    if (!/^\d{14}$/.test(cai)) return setError('El CAI tiene 14 dígitos.')
    if (!form.fecha_vencimiento) return setError('Indicá la fecha de vencimiento del CAI.')
    if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde) {
      return setError('Revisá el rango: "desde" y "hasta" son números enteros y "hasta" no puede ser menor.')
    }
    setGuardando(true)
    setError(null)
    const r = await guardarCaiRemito({
      id: form.id,
      punto_venta: pv,
      cai,
      fecha_vencimiento: form.fecha_vencimiento,
      numero_desde: desde,
      numero_hasta: hasta,
      activo: form.activo,
      observaciones: form.observaciones.trim() || null
    })
    setGuardando(false)
    if (!r.success) return setError(r.error ?? 'No se pudo guardar el CAI')
    onGuardado(`CAI ${cai} guardado para el punto de venta ${String(pv).padStart(4, '0')}.`)
    setForm(null)
  }

  return (
    <div className="remito-modal-overlay" role="dialog" aria-modal="true" aria-label="CAI de Remito R" onClick={() => !guardando && onClose()}>
      <div className="remito-modal" onClick={(e) => e.stopPropagation()}>
        <header className="remito-modal__head">
          <div>
            <p className="remito-modal__eyebrow">Remito R · autoimpresor</p>
            <h2>CAI de Remito R</h2>
            <p className="remito-modal__sub">
              El CAI lo otorga ARCA por punto de venta, con un rango de números y una fecha de vencimiento.
            </p>
          </div>
          <button type="button" className="remito-modal__close" onClick={onClose} disabled={guardando} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="remito-modal__body">
          {cais.length > 0 ? (
            <section className="remito-seccion">
              <div className="remito-tabla-wrap">
                <table className="remito-tabla">
                  <thead>
                    <tr>
                      <th>PV</th>
                      <th>CAI</th>
                      <th>Vence</th>
                      <th className="num">Rango</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {cais.map((c) => {
                      const est = estadoCai(c, hoy)
                      return (
                        <tr key={c.id}>
                          <td>{String(c.punto_venta).padStart(4, '0')}</td>
                          <td>{c.cai}</td>
                          <td>{fechaAr(c.fecha_vencimiento)}</td>
                          <td className="num">
                            {c.numero_desde} a {c.numero_hasta}
                          </td>
                          <td>
                            <span
                              className={`erp-pill ${est === 'Vigente' ? 'ok' : est === 'Por vencer' ? 'warn' : est === 'Vencido' ? 'danger' : ''}`}
                            >
                              {est}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="remito-mini"
                              onClick={() => {
                                setError(null)
                                setForm({
                                  id: c.id,
                                  punto_venta: String(c.punto_venta),
                                  cai: c.cai,
                                  fecha_vencimiento: c.fecha_vencimiento,
                                  numero_desde: String(c.numero_desde),
                                  numero_hasta: String(c.numero_hasta),
                                  activo: c.activo,
                                  observaciones: c.observaciones ?? ''
                                })
                              }}
                            >
                              editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!form ? (
                <div className="remito-acciones-linea">
                  <button type="button" className="remito-btn" onClick={() => setForm(caiVacio())}>
                    + Cargar CAI nuevo
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {form ? (
            <section className="remito-seccion">
              <h3>{form.id ? 'Editar CAI' : 'Nuevo CAI'}</h3>
              <div className="remito-form">
                <label>
                  <span>Punto de venta</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.punto_venta}
                    onChange={(e) => setForm({ ...form, punto_venta: e.target.value })}
                    placeholder="Ej. 2"
                  />
                </label>
                <label>
                  <span>CAI (14 dígitos)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.cai}
                    onChange={(e) => setForm({ ...form, cai: e.target.value })}
                    maxLength={16}
                  />
                </label>
                <label>
                  <span>Vencimiento del CAI</span>
                  <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} />
                </label>
                <label>
                  <span>Estado</span>
                  <select value={form.activo ? 'si' : 'no'} onChange={(e) => setForm({ ...form, activo: e.target.value === 'si' })}>
                    <option value="si">Activo</option>
                    <option value="no">Inactivo</option>
                  </select>
                </label>
                <label>
                  <span>Número desde</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.numero_desde}
                    onChange={(e) => setForm({ ...form, numero_desde: e.target.value })}
                  />
                </label>
                <label>
                  <span>Número hasta</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.numero_hasta}
                    onChange={(e) => setForm({ ...form, numero_hasta: e.target.value })}
                  />
                </label>
                <label className="remito-form__ancho">
                  <span>Observaciones</span>
                  <input
                    type="text"
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    placeholder="Ej. Solicitud ARCA N° …"
                  />
                </label>
              </div>
              <p className="remito-muted">
                El sistema numera solo, de forma correlativa dentro del rango, y no deja emitir con el CAI vencido ni fuera del
                rango. Un CAI con remitos emitidos no puede cambiar de punto de venta.
              </p>
            </section>
          ) : null}

          {error ? <div className="remito-aviso remito-aviso--error">{error}</div> : null}

          <div className="remito-modal__foot">
            <button type="button" className="remito-btn" onClick={form && cais.length > 0 ? () => setForm(null) : onClose} disabled={guardando}>
              {form && cais.length > 0 ? 'Cancelar' : 'Cerrar'}
            </button>
            {form ? (
              <button type="button" className="remito-btn remito-btn--primario" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar CAI'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
