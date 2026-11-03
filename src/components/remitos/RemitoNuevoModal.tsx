import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  estadoEntrega,
  lineasDesdePendientes,
  numeroDeEntrega,
  numeroRemito,
  seleccionTotal,
  validarSeleccion,
  type LineaPendiente,
  type Remito
} from '../../features/remitos/remitosLogica'
import {
  crearRemito,
  entregaRegistradaOp,
  pendientesDeEntrega,
  remitosDeOrigen,
  type EntregaOp
} from '../../services/remitosApi'
import { plantillaRemito, seleccionDesdeCopia } from '../../features/copiar/plantillasCopia'
import { descargarRemitoPdf } from '../../utils/documentos/remitoPdf'
import './RemitoNuevoModal.css'

export type VentaParaRemito = {
  id: number
  numero_venta: string
  cliente_nombre: string
  cliente_dni_cuit?: string | null
  cliente_direccion?: string | null
  cliente_telefono?: string | null
  id_op?: number | null
  numero_op?: string | null
}

type Props = {
  venta: VentaParaRemito
  onClose: () => void
  onCreado?: (remito: Remito) => void
  /** "Copiar": mismas cantidades y datos de entrega que otro remito (sin número ni fechas). */
  copiarDe?: Remito | null
}

type LineaLibre = { uid: number; descripcion: string; cantidad: string }

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const fechaAr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-')
const cantidad = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

export default function RemitoNuevoModal({ venta, onClose, onCreado, copiarDe = null }: Props) {
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [lineas, setLineas] = useState<LineaPendiente[]>([])
  const [previos, setPrevios] = useState<Remito[]>([])
  const [entregaOp, setEntregaOp] = useState<EntregaOp | null>(null)
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [libres, setLibres] = useState<LineaLibre[]>([])
  const [fechaEntrega, setFechaEntrega] = useState(hoy())
  const [entregadoA, setEntregadoA] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [transportista, setTransportista] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<{ remito: Remito; entrega: number } | null>(null)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  const [omitidasCopia, setOmitidasCopia] = useState<string[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    const [pend, rem, op] = await Promise.all([
      pendientesDeEntrega(venta.id, venta.id_op ?? null),
      remitosDeOrigen(venta.id, venta.id_op ?? null),
      venta.id_op ? entregaRegistradaOp(venta.id_op) : Promise.resolve({ success: true, data: null })
    ])
    if (!pend.success) setErrorCarga(pend.error ?? 'No se pudieron leer las líneas de la venta')
    else {
      const nuevas = lineasDesdePendientes(pend.data)
      setLineas(nuevas)
      if (copiarDe) {
        // Mismas cantidades, pero nunca más de lo que queda por remitir
        const p = plantillaRemito(copiarDe)
        const r = seleccionDesdeCopia(nuevas, p)
        setSeleccion(r.seleccion)
        setLibres(r.libres.map((l, i) => ({ uid: Date.now() + i, ...l })))
        setOmitidasCopia(r.omitidas)
        setEntregadoA(p.entregado_a)
        setDniRetira(p.dni_retira)
        setTransportista(p.transportista)
        setObservaciones(p.observaciones)
      }
    }
    setPrevios(rem.data ?? [])
    setEntregaOp(op.data ?? null)
    setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la copia se aplica al abrir
  }, [venta.id, venta.id_op, copiarDe?.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onClose()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [enviando, onClose])

  const estado = useMemo(() => estadoEntrega(lineas), [lineas])
  const hayPendiente = lineas.some((l) => l.pendiente > 0)
  const vigentes = previos.filter((r) => r.estado === 'Emitido')

  const cambiarCantidad = (clave: string, valor: string) => setSeleccion((s) => ({ ...s, [clave]: valor }))

  const entregaCompleta = () => {
    const todo = seleccionTotal(lineas)
    setSeleccion(Object.fromEntries(Object.entries(todo).map(([k, v]) => [k, String(v)])))
    setErrores([])
  }

  const emitir = async () => {
    const { items, errores: errs } = validarSeleccion(lineas, seleccion)
    const libresValidas = libres.filter((l) => l.descripcion.trim() || l.cantidad.trim())
    const itemsLibres: typeof items = []
    for (const l of libresValidas) {
      const n = Number(l.cantidad.replace(',', '.'))
      if (!l.descripcion.trim() || !Number.isFinite(n) || n <= 0) {
        errs.push('Las líneas libres necesitan descripción y una cantidad mayor a cero')
        break
      }
      itemsLibres.push({ descripcion: l.descripcion.trim(), cantidad: n })
    }
    // "Cargá al menos una línea" solo vale si tampoco hay líneas libres
    const sinAviso = itemsLibres.length > 0 ? errs.filter((e) => !e.startsWith('Cargá la cantidad')) : errs
    if (sinAviso.length > 0 || items.length + itemsLibres.length === 0) {
      setErrores(sinAviso.length > 0 ? sinAviso : ['Cargá la cantidad de al menos una línea'])
      return
    }
    setErrores([])
    setEnviando(true)
    const r = await crearRemito({
      id_venta: venta.id,
      id_op: venta.id_op ?? null,
      cliente_nombre: venta.cliente_nombre,
      cliente_documento: venta.cliente_dni_cuit ?? null,
      cliente_domicilio: venta.cliente_direccion ?? null,
      cliente_telefono: venta.cliente_telefono ?? null,
      fecha_entrega: fechaEntrega || null,
      entregado_a: entregadoA || null,
      dni_retira: dniRetira || null,
      transportista: transportista || null,
      observaciones: observaciones || null,
      items: [...items, ...itemsLibres]
    })
    setEnviando(false)
    if (!r.success || !r.data) {
      setErrores([r.error ?? 'No se pudo emitir el remito'])
      return
    }
    const remito = r.data
    const entrega = numeroDeEntrega(remito, [...previos, remito])
    setCreado({ remito, entrega })
    onCreado?.(remito)
    try {
      await descargarRemitoPdf(remito, null, { numeroEntrega: entrega })
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    }
  }

  const descargarOtraVez = async () => {
    if (!creado) return
    setErrorPdf(null)
    try {
      await descargarRemitoPdf(creado.remito, null, { numeroEntrega: creado.entrega })
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    }
  }

  return (
    <div className="remito-modal-overlay" role="dialog" aria-modal="true" aria-label="Nuevo remito" onClick={() => !enviando && onClose()}>
      <div className="remito-modal" onClick={(e) => e.stopPropagation()}>
        <header className="remito-modal__head">
          <div>
            <p className="remito-modal__eyebrow">Remito X · no fiscal</p>
            <h2>{creado ? `Remito ${numeroRemito(creado.remito)} emitido` : 'Nuevo remito'}</h2>
            <p className="remito-modal__sub">
              Venta {venta.numero_venta}
              {venta.numero_op ? ` · OP ${venta.numero_op}` : ''} · {venta.cliente_nombre}
            </p>
          </div>
          <button type="button" className="remito-modal__close" onClick={onClose} disabled={enviando} aria-label="Cerrar">
            ×
          </button>
        </header>

        {creado ? (
          <div className="remito-modal__body">
            <div className="remito-aviso remito-aviso--ok">
              <strong>{creado.entrega > 1 ? `Entrega N° ${creado.entrega}` : 'Primera entrega'} registrada.</strong>
              <span>
                Se descargó el PDF. Si el remito no queda completo, lo que falta sigue figurando como pendiente para el próximo.
              </span>
            </div>
            {errorPdf ? <div className="remito-aviso remito-aviso--error">{errorPdf}</div> : null}
            <div className="remito-modal__foot">
              <button type="button" className="remito-btn" onClick={() => void descargarOtraVez()}>
                Descargar PDF otra vez
              </button>
              <button type="button" className="remito-btn remito-btn--primario" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : cargando ? (
          <div className="remito-modal__body">
            <p className="remito-muted">Leyendo lo pedido y lo ya entregado…</p>
          </div>
        ) : (
          <div className="remito-modal__body">
            {errorCarga ? <div className="remito-aviso remito-aviso--error">{errorCarga}</div> : null}

            {copiarDe ? (
              <div className="remito-aviso remito-aviso--info">
                <strong>Copia del remito {numeroRemito(copiarDe)}</strong>
                <span>
                  Se propusieron las mismas cantidades y datos de entrega, limitados a lo que todavía queda por remitir.
                  {omitidasCopia.length > 0 ? ` Sin saldo, no se incluyeron: ${omitidasCopia.join(', ')}.` : ''}
                </span>
              </div>
            ) : null}

            {entregaOp?.entregado ? (
              <div className="remito-aviso remito-aviso--info">
                <strong>La OP {entregaOp.numero_op} figura entregada</strong>
                <span>
                  {fechaAr(entregaOp.fecha_entrega_efectiva)}
                  {entregaOp.entregado_a ? ` · retiró ${entregaOp.entregado_a}` : ''}
                  {entregaOp.dni_retira ? ` (DNI ${entregaOp.dni_retira})` : ''}. Esa entrega con firma no descuenta
                  cantidades; los remitos sí.
                </span>
              </div>
            ) : null}

            <section className="remito-seccion">
              <div className="remito-seccion__head">
                <h3>Qué se entrega</h3>
                <span className={`remito-estado remito-estado--${estado === 'Entregado completo' ? 'ok' : estado === 'Entrega parcial' ? 'warn' : 'neutro'}`}>
                  {estado}
                </span>
              </div>

              {lineas.length === 0 && !errorCarga ? (
                <p className="remito-muted">La venta no tiene líneas cargadas: agregá las que vas a entregar como líneas libres.</p>
              ) : (
                <div className="remito-tabla-wrap">
                  <table className="remito-tabla">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th className="num">Pedido</th>
                        <th className="num">Ya entregado</th>
                        <th className="num">Pendiente</th>
                        <th className="num">Este remito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l) => (
                        <tr key={l.clave} className={l.pendiente === 0 ? 'remito-fila--completa' : undefined}>
                          <td>
                            {l.descripcion}
                            {l.id_op_linea ? <span className="remito-tag">OP · m²</span> : null}
                          </td>
                          <td className="num">{cantidad(l.pedida)}</td>
                          <td className="num">{cantidad(l.entregada)}</td>
                          <td className="num">{cantidad(l.pendiente)}</td>
                          <td className="num">
                            {l.pendiente === 0 ? (
                              <span className="remito-muted">completo</span>
                            ) : (
                              <span className="remito-input-fila">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={seleccion[l.clave] ?? ''}
                                  placeholder={`máx. ${cantidad(l.pendiente)}`}
                                  onChange={(e) => cambiarCantidad(l.clave, e.target.value)}
                                  aria-label={`Cantidad a entregar de ${l.descripcion}`}
                                />
                                <button type="button" className="remito-mini" onClick={() => cambiarCantidad(l.clave, String(l.pendiente))} title="Entregar todo lo pendiente">
                                  todo
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="remito-acciones-linea">
                {hayPendiente ? (
                  <button type="button" className="remito-btn" onClick={entregaCompleta}>
                    Entrega completa
                  </button>
                ) : null}
                {Object.keys(seleccion).length > 0 ? (
                  <button type="button" className="remito-btn" onClick={() => setSeleccion({})}>
                    Limpiar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="remito-btn"
                  onClick={() => setLibres((p) => [...p, { uid: Date.now() + p.length, descripcion: '', cantidad: '' }])}
                >
                  + Línea libre
                </button>
              </div>

              {libres.map((l) => (
                <div key={l.uid} className="remito-libre">
                  <input
                    type="text"
                    value={l.descripcion}
                    placeholder="Descripción (ej. muestra, flete)"
                    onChange={(e) => setLibres((p) => p.map((x) => (x.uid === l.uid ? { ...x, descripcion: e.target.value } : x)))}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={l.cantidad}
                    placeholder="Cantidad"
                    onChange={(e) => setLibres((p) => p.map((x) => (x.uid === l.uid ? { ...x, cantidad: e.target.value } : x)))}
                  />
                  <button type="button" className="remito-mini" onClick={() => setLibres((p) => p.filter((x) => x.uid !== l.uid))}>
                    quitar
                  </button>
                </div>
              ))}
            </section>

            <section className="remito-seccion">
              <h3>Datos de la entrega</h3>
              <div className="remito-form">
                <label>
                  <span>Fecha de entrega</span>
                  <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
                </label>
                <label>
                  <span>Retira / recibe</span>
                  <input type="text" value={entregadoA} onChange={(e) => setEntregadoA(e.target.value)} placeholder="Nombre y apellido" />
                </label>
                <label>
                  <span>DNI de quien retira</span>
                  <input type="text" inputMode="numeric" value={dniRetira} onChange={(e) => setDniRetira(e.target.value)} />
                </label>
                <label>
                  <span>Transporte</span>
                  <input type="text" value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Retira en local" />
                </label>
                <label className="remito-form__ancho">
                  <span>Observaciones</span>
                  <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                </label>
              </div>
            </section>

            {vigentes.length > 0 ? (
              <section className="remito-seccion">
                <h3>Remitos ya emitidos ({vigentes.length})</h3>
                <ul className="remito-historial">
                  {previos.map((r) => (
                    <li key={r.id} className={r.estado === 'Anulado' ? 'remito-historial--anulado' : undefined}>
                      <strong>{numeroRemito(r)}</strong> · {fechaAr(r.fecha_emision)} ·{' '}
                      {r.items.map((i) => `${cantidad(i.cantidad)}${i.unidad ? ` ${i.unidad}` : ''} ${i.descripcion}`).join(', ')}
                      {r.estado === 'Anulado' ? ' · ANULADO' : ''}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {errores.length > 0 ? (
              <div className="remito-aviso remito-aviso--error" role="alert">
                {errores.map((e) => (
                  <span key={e}>{e}</span>
                ))}
              </div>
            ) : null}

            <div className="remito-modal__foot">
              <button type="button" className="remito-btn" onClick={onClose} disabled={enviando}>
                Cancelar
              </button>
              <button
                type="button"
                className="remito-btn remito-btn--primario"
                onClick={() => void emitir()}
                disabled={enviando || (!hayPendiente && libres.length === 0)}
                title={!hayPendiente && libres.length === 0 ? 'Todo lo pedido ya fue remitido' : undefined}
              >
                {enviando ? 'Emitiendo…' : 'Emitir remito y descargar PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
