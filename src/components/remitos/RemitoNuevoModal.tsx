import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CLASE_LABEL,
  estadoEntrega,
  etiquetaRemito,
  lineasDesdePendientes,
  maximoLinea,
  numeroDeEntrega,
  numeroRemito,
  puntosVentaRemitoR,
  seleccionTotal,
  validarSeleccion,
  type CaiRemito,
  type ClaseRemito,
  type LineaPendiente,
  type Remito,
  type TipoRemito
} from '../../features/remitos/remitosLogica'
import {
  crearRemito,
  entregaRegistradaOp,
  listarCaiRemitos,
  pendientesDeEntrega,
  proximoNumeroRemitoR,
  remitosDeOrigen,
  type EntregaOp
} from '../../services/remitosApi'
import { plantillaRemito, seleccionDesdeCopia } from '../../features/copiar/plantillasCopia'
import { cargarEmisor } from '../../utils/facturaAfipPdf'
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
  /** Venta de la que sale la entrega o vuelve la devolución. Sin venta = traslado entre depósitos. */
  venta?: VentaParaRemito | null
  onClose: () => void
  onCreado?: (remito: Remito) => void
  /** "Copiar": mismas cantidades y datos de entrega que otro remito (sin número ni fechas). */
  copiarDe?: Remito | null
  /** Con venta: Entrega (default) o Devolucion. Sin venta siempre es Traslado. */
  claseInicial?: ClaseRemito
  tipoInicial?: TipoRemito
}

type LineaLibre = { uid: number; descripcion: string; cantidad: string; unidad: string }

type Destinatario = {
  nombre: string
  documento: string
  domicilio: string
  telefono: string
  condicionIva: string
}

const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final', 'No Responsable'] as const

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const fechaAr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-')
const cantidad = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

/** CUIT de 11 dígitos → Responsable Inscripto es lo más probable; DNI → Consumidor Final. */
function condicionSugerida(documento: string | null | undefined): string {
  const d = String(documento || '').replace(/\D/g, '')
  return d.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final'
}

export default function RemitoNuevoModal({
  venta = null,
  onClose,
  onCreado,
  copiarDe = null,
  claseInicial,
  tipoInicial
}: Props) {
  const esTraslado = !venta
  const [clase, setClase] = useState<ClaseRemito>(esTraslado ? 'Traslado' : claseInicial === 'Devolucion' ? 'Devolucion' : 'Entrega')
  const [tipo, setTipo] = useState<TipoRemito>(tipoInicial ?? copiarDe?.tipo ?? 'X')

  const [cargando, setCargando] = useState(!esTraslado)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [lineas, setLineas] = useState<LineaPendiente[]>([])
  const [previos, setPrevios] = useState<Remito[]>([])
  const [entregaOp, setEntregaOp] = useState<EntregaOp | null>(null)
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [libres, setLibres] = useState<LineaLibre[]>(
    esTraslado ? [{ uid: 1, descripcion: '', cantidad: '', unidad: '' }] : []
  )

  const [destinatario, setDestinatario] = useState<Destinatario>({
    nombre: venta?.cliente_nombre ?? '',
    documento: venta?.cliente_dni_cuit ?? '',
    domicilio: venta?.cliente_direccion ?? '',
    telefono: venta?.cliente_telefono ?? '',
    condicionIva: copiarDe?.cliente_condicion_iva || condicionSugerida(venta?.cliente_dni_cuit)
  })
  const [fechaEntrega, setFechaEntrega] = useState(hoy())
  const [entregadoA, setEntregadoA] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [transportista, setTransportista] = useState('')
  const [transportistaCuit, setTransportistaCuit] = useState('')
  const [domicilioEntrega, setDomicilioEntrega] = useState('')
  const [depositoOrigen, setDepositoOrigen] = useState('')
  const [depositoDestino, setDepositoDestino] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [cais, setCais] = useState<CaiRemito[] | null>(null)
  const [puntoVentaR, setPuntoVentaR] = useState<number | null>(null)
  const [proximoR, setProximoR] = useState<number | null>(null)

  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<{ remito: Remito; entrega: number } | null>(null)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  const [omitidasCopia, setOmitidasCopia] = useState<string[]>([])

  const cargar = useCallback(async () => {
    if (!venta) return
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
        setLibres(r.libres.map((l, i) => ({ uid: Date.now() + i, unidad: '', ...l })))
        setOmitidasCopia(r.omitidas)
        setEntregadoA(p.entregado_a)
        setDniRetira(p.dni_retira)
        setTransportista(p.transportista)
        setObservaciones(p.observaciones)
        setTransportistaCuit(copiarDe.transportista_cuit ?? '')
        setDomicilioEntrega(copiarDe.domicilio_entrega ?? '')
      }
    }
    setPrevios(rem.data ?? [])
    setEntregaOp(op.data ?? null)
    setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la copia se aplica al abrir
  }, [venta?.id, venta?.id_op, copiarDe?.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Traslado: el destinatario es la propia empresa.
  useEffect(() => {
    if (!esTraslado) return
    let vigente = true
    void cargarEmisor().then((e) => {
      if (!vigente) return
      setDestinatario((d) => ({
        nombre: d.nombre || e.razon_social || '',
        documento: d.documento || e.cuit || '',
        domicilio: d.domicilio || e.domicilio_comercial || '',
        telefono: d.telefono,
        condicionIva: e.condicion_iva || d.condicionIva
      }))
    })
    return () => {
      vigente = false
    }
  }, [esTraslado])

  // CAI disponibles (solo hace falta para el Remito R).
  useEffect(() => {
    if (tipo !== 'R' || cais !== null) return
    void listarCaiRemitos().then((r) => {
      const lista = r.success ? r.data ?? [] : []
      setCais(lista)
      if (!r.success) setErrores([r.error ?? 'No se pudieron leer los CAI'])
      const pvs = puntosVentaRemitoR(lista, hoy())
      setPuntoVentaR((pv) => pv ?? pvs[0] ?? null)
    })
  }, [tipo, cais])

  useEffect(() => {
    if (tipo !== 'R' || !puntoVentaR || !cais) {
      setProximoR(null)
      return
    }
    void proximoNumeroRemitoR(puntoVentaR, cais).then((r) => setProximoR(r.success ? r.data ?? null : null))
  }, [tipo, puntoVentaR, cais])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onClose()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [enviando, onClose])

  // Cambiar entre entrega y devolución cambia qué se puede cargar: se limpia lo cargado.
  const cambiarClase = (c: ClaseRemito) => {
    if (c === clase) return
    setClase(c)
    setSeleccion({})
    setLibres([])
    setErrores([])
  }

  const estado = useMemo(() => estadoEntrega(lineas), [lineas])
  const hayPendiente = lineas.some((l) => l.pendiente > 0)
  const hayEntregado = lineas.some((l) => l.entregada > 0)
  const vigentes = previos.filter((r) => r.estado === 'Emitido')
  const pvsR = useMemo(() => (cais ? puntosVentaRemitoR(cais, hoy()) : []), [cais])
  const caiElegido = useMemo(
    () =>
      cais && puntoVentaR
        ? cais
            .filter((c) => c.activo && c.punto_venta === puntoVentaR && c.fecha_vencimiento >= hoy())
            .find((c) => proximoR === null || (proximoR >= c.numero_desde && proximoR <= c.numero_hasta)) ?? null
        : null,
    [cais, puntoVentaR, proximoR]
  )
  const permiteLibres = clase !== 'Devolucion'

  const cambiarCantidad = (clave: string, valor: string) => setSeleccion((s) => ({ ...s, [clave]: valor }))

  const entregaCompleta = () => {
    const todo = seleccionTotal(lineas)
    setSeleccion(Object.fromEntries(Object.entries(todo).map(([k, v]) => [k, String(v)])))
    setErrores([])
  }

  const emitir = async () => {
    const errs: string[] = []
    const { items, errores: errsSeleccion } = esTraslado
      ? { items: [], errores: [] as string[] }
      : validarSeleccion(lineas, seleccion, clase)
    errs.push(...errsSeleccion)

    const itemsLibres: typeof items = []
    for (const l of libres.filter((x) => x.descripcion.trim() || x.cantidad.trim())) {
      const n = Number(l.cantidad.replace(',', '.'))
      if (!l.descripcion.trim() || !Number.isFinite(n) || n <= 0) {
        errs.push('Las líneas libres necesitan descripción y una cantidad mayor a cero')
        break
      }
      itemsLibres.push({ descripcion: l.descripcion.trim(), cantidad: n, unidad: l.unidad.trim() || null })
    }
    // "Cargá al menos una línea" solo vale si tampoco hay líneas libres
    const sinAviso = itemsLibres.length > 0 ? errs.filter((e) => !e.startsWith('Cargá la cantidad')) : errs
    if (items.length + itemsLibres.length === 0 && sinAviso.length === 0) sinAviso.push('Cargá la cantidad de al menos una línea')

    if (!destinatario.nombre.trim()) sinAviso.push('Falta el nombre del destinatario')
    if (esTraslado && (!depositoOrigen.trim() || !depositoDestino.trim())) {
      sinAviso.push('Indicá el depósito de origen y el de destino')
    }
    if (tipo === 'R') {
      if (!puntoVentaR) sinAviso.push('No hay un CAI vigente para emitir Remito R: cargalo en "CAI Remito R"')
      if (!destinatario.documento.trim()) sinAviso.push('El Remito R necesita el CUIT / DNI del destinatario')
      if (!destinatario.domicilio.trim()) sinAviso.push('El Remito R necesita el domicilio del destinatario')
    }
    if (sinAviso.length > 0) {
      setErrores([...new Set(sinAviso)])
      return
    }

    if (tipo === 'R') {
      const ok = window.confirm(
        `¿Emitir Remito R ${String(puntoVentaR).padStart(4, '0')}-${proximoR ? String(proximoR).padStart(8, '0') : '(próximo)'}?\n\n` +
          'Es un comprobante fiscal con CAI: el número se consume y no se reutiliza (si hay un error, se anula).'
      )
      if (!ok) return
    }

    setErrores([])
    setEnviando(true)
    const r = await crearRemito({
      tipo,
      clase,
      punto_venta: tipo === 'R' ? puntoVentaR ?? undefined : undefined,
      id_venta: venta?.id ?? null,
      id_op: venta?.id_op ?? null,
      cliente_nombre: destinatario.nombre.trim(),
      cliente_documento: destinatario.documento.trim() || null,
      cliente_domicilio: destinatario.domicilio.trim() || null,
      cliente_telefono: destinatario.telefono.trim() || null,
      cliente_condicion_iva: destinatario.condicionIva || null,
      fecha_entrega: fechaEntrega || null,
      entregado_a: entregadoA || null,
      dni_retira: dniRetira || null,
      transportista: transportista || null,
      transportista_cuit: transportistaCuit || null,
      domicilio_entrega: domicilioEntrega || null,
      deposito_origen: esTraslado ? depositoOrigen.trim() : null,
      deposito_destino: esTraslado ? depositoDestino.trim() : null,
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
      await descargarRemitoPdf(remito, null, { numeroEntrega: clase === 'Entrega' && venta ? entrega : undefined })
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    }
  }

  const descargarOtraVez = async () => {
    if (!creado) return
    setErrorPdf(null)
    try {
      await descargarRemitoPdf(creado.remito, null, {
        numeroEntrega: clase === 'Entrega' && venta ? creado.entrega : undefined
      })
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    }
  }

  const titulo = creado
    ? `${etiquetaRemito(creado.remito)} emitido`
    : clase === 'Traslado'
      ? 'Remito de traslado'
      : clase === 'Devolucion'
        ? 'Remito de devolución'
        : 'Nuevo remito'

  return (
    <div className="remito-modal-overlay" role="dialog" aria-modal="true" aria-label={titulo} onClick={() => !enviando && onClose()}>
      <div className="remito-modal" onClick={(e) => e.stopPropagation()}>
        <header className="remito-modal__head">
          <div>
            <p className="remito-modal__eyebrow">
              Remito {tipo} · {tipo === 'R' ? 'fiscal, cód. 91 (CAI)' : 'interno, no fiscal'} · {CLASE_LABEL[clase]}
            </p>
            <h2>{titulo}</h2>
            <p className="remito-modal__sub">
              {venta ? (
                <>
                  Venta {venta.numero_venta}
                  {venta.numero_op ? ` · OP ${venta.numero_op}` : ''} · {venta.cliente_nombre}
                </>
              ) : (
                'Movimiento de mercadería entre locales o depósitos propios'
              )}
            </p>
          </div>
          <button type="button" className="remito-modal__close" onClick={onClose} disabled={enviando} aria-label="Cerrar">
            ×
          </button>
        </header>

        {creado ? (
          <div className="remito-modal__body">
            <div className="remito-aviso remito-aviso--ok">
              <strong>
                {clase === 'Entrega'
                  ? `${creado.entrega > 1 ? `Entrega N° ${creado.entrega}` : 'Primera entrega'} registrada.`
                  : clase === 'Devolucion'
                    ? 'Devolución registrada: lo devuelto vuelve a figurar como pendiente.'
                    : 'Traslado registrado.'}
              </strong>
              <span>
                Se descargó el PDF{creado.remito.tipo === 'R' ? ' con CAI y código de barras' : ''}.
                {clase === 'Entrega' ? ' Si el remito no queda completo, lo que falta sigue figurando como pendiente para el próximo.' : ''}
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

            <section className="remito-seccion">
              <div className="remito-opciones">
                <div className="remito-toggle" role="radiogroup" aria-label="Tipo de remito">
                  {(['X', 'R'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={tipo === t}
                      className={tipo === t ? 'is-on' : undefined}
                      onClick={() => {
                        setTipo(t)
                        setErrores([])
                      }}
                    >
                      <strong>Remito {t}</strong>
                      <small>{t === 'X' ? 'Interno, no fiscal' : 'Fiscal con CAI'}</small>
                    </button>
                  ))}
                </div>
                {!esTraslado ? (
                  <div className="remito-toggle" role="radiogroup" aria-label="Qué registra">
                    {(['Entrega', 'Devolucion'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={clase === c}
                        className={clase === c ? 'is-on' : undefined}
                        onClick={() => cambiarClase(c)}
                        disabled={c === 'Devolucion' && !hayEntregado}
                        title={c === 'Devolucion' && !hayEntregado ? 'Todavía no se entregó nada de esta venta' : undefined}
                      >
                        <strong>{CLASE_LABEL[c]}</strong>
                        <small>{c === 'Entrega' ? 'Sale mercadería al cliente' : 'El cliente devuelve'}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {tipo === 'R' ? (
                cais === null ? (
                  <p className="remito-muted">Leyendo CAI…</p>
                ) : pvsR.length === 0 ? (
                  <div className="remito-aviso remito-aviso--error">
                    <strong>No hay un CAI vigente para Remito R.</strong>
                    <span>Cargá el CAI que te dio ARCA en la página de Remitos → "CAI Remito R".</span>
                  </div>
                ) : (
                  <div className="remito-cai">
                    <label>
                      <span>Punto de venta</span>
                      <select value={puntoVentaR ?? ''} onChange={(e) => setPuntoVentaR(Number(e.target.value) || null)}>
                        {pvsR.map((pv) => (
                          <option key={pv} value={pv}>
                            {String(pv).padStart(4, '0')}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span>
                      Próximo: <strong>{proximoR ? `${String(puntoVentaR).padStart(4, '0')}-${String(proximoR).padStart(8, '0')}` : '—'}</strong>
                    </span>
                    {caiElegido ? (
                      <span>
                        CAI {caiElegido.cai} · vence {fechaAr(caiElegido.fecha_vencimiento)} · quedan{' '}
                        {proximoR ? caiElegido.numero_hasta - proximoR + 1 : '—'} números
                      </span>
                    ) : proximoR === null ? (
                      <span className="remito-cai__alerta">El CAI de este punto de venta se agotó: cargá el nuevo.</span>
                    ) : null}
                  </div>
                )
              ) : null}
            </section>

            {copiarDe ? (
              <div className="remito-aviso remito-aviso--info">
                <strong>Copia del remito {numeroRemito(copiarDe)}</strong>
                <span>
                  Se propusieron las mismas cantidades y datos de entrega, limitados a lo que todavía queda por remitir.
                  {omitidasCopia.length > 0 ? ` Sin saldo, no se incluyeron: ${omitidasCopia.join(', ')}.` : ''}
                </span>
              </div>
            ) : null}

            {entregaOp?.entregado && clase === 'Entrega' ? (
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
                <h3>{clase === 'Devolucion' ? 'Qué devuelve' : clase === 'Traslado' ? 'Qué se traslada' : 'Qué se entrega'}</h3>
                {!esTraslado ? (
                  <span
                    className={`remito-estado remito-estado--${estado === 'Entregado completo' ? 'ok' : estado === 'Entrega parcial' ? 'warn' : 'neutro'}`}
                  >
                    {estado}
                  </span>
                ) : null}
              </div>

              {esTraslado ? null : lineas.length === 0 && !errorCarga ? (
                <p className="remito-muted">
                  {clase === 'Devolucion'
                    ? 'La venta no tiene líneas cargadas: no hay nada que devolver.'
                    : 'La venta no tiene líneas cargadas: agregá las que vas a entregar como líneas libres.'}
                </p>
              ) : (
                <div className="remito-tabla-wrap">
                  <table className="remito-tabla">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th className="num">Pedido</th>
                        <th className="num">Ya entregado</th>
                        <th className="num">Pendiente</th>
                        <th className="num">{clase === 'Devolucion' ? 'Devuelve' : 'Este remito'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l) => {
                        const max = maximoLinea(l, clase)
                        return (
                          <tr key={l.clave} className={max === 0 ? 'remito-fila--completa' : undefined}>
                            <td>
                              {l.descripcion}
                              {l.id_op_linea ? <span className="remito-tag">OP · m²</span> : null}
                            </td>
                            <td className="num">{cantidad(l.pedida)}</td>
                            <td className="num">{cantidad(l.entregada)}</td>
                            <td className="num">{cantidad(l.pendiente)}</td>
                            <td className="num">
                              {max === 0 ? (
                                <span className="remito-muted">{clase === 'Devolucion' ? 'nada entregado' : 'completo'}</span>
                              ) : (
                                <span className="remito-input-fila">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={seleccion[l.clave] ?? ''}
                                    placeholder={`máx. ${cantidad(max)}`}
                                    onChange={(e) => cambiarCantidad(l.clave, e.target.value)}
                                    aria-label={`Cantidad de ${l.descripcion}`}
                                  />
                                  <button
                                    type="button"
                                    className="remito-mini"
                                    onClick={() => cambiarCantidad(l.clave, String(max))}
                                    title={clase === 'Devolucion' ? 'Devuelve todo lo entregado' : 'Entregar todo lo pendiente'}
                                  >
                                    todo
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="remito-acciones-linea">
                {clase === 'Entrega' && hayPendiente ? (
                  <button type="button" className="remito-btn" onClick={entregaCompleta}>
                    Entrega completa
                  </button>
                ) : null}
                {Object.keys(seleccion).length > 0 ? (
                  <button type="button" className="remito-btn" onClick={() => setSeleccion({})}>
                    Limpiar
                  </button>
                ) : null}
                {permiteLibres ? (
                  <button
                    type="button"
                    className="remito-btn"
                    onClick={() => setLibres((p) => [...p, { uid: Date.now() + p.length, descripcion: '', cantidad: '', unidad: '' }])}
                  >
                    + {esTraslado ? 'Línea' : 'Línea libre'}
                  </button>
                ) : null}
              </div>

              {permiteLibres
                ? libres.map((l) => (
                    <div key={l.uid} className="remito-libre remito-libre--con-unidad">
                      <input
                        type="text"
                        value={l.descripcion}
                        placeholder={esTraslado ? 'Descripción (ej. Rollo vinilo blanco 1,52 m)' : 'Descripción (ej. muestra, flete)'}
                        onChange={(e) => setLibres((p) => p.map((x) => (x.uid === l.uid ? { ...x, descripcion: e.target.value } : x)))}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.cantidad}
                        placeholder="Cantidad"
                        onChange={(e) => setLibres((p) => p.map((x) => (x.uid === l.uid ? { ...x, cantidad: e.target.value } : x)))}
                      />
                      <input
                        type="text"
                        value={l.unidad}
                        placeholder="Unidad"
                        onChange={(e) => setLibres((p) => p.map((x) => (x.uid === l.uid ? { ...x, unidad: e.target.value } : x)))}
                      />
                      <button type="button" className="remito-mini" onClick={() => setLibres((p) => p.filter((x) => x.uid !== l.uid))}>
                        quitar
                      </button>
                    </div>
                  ))
                : null}
            </section>

            {esTraslado ? (
              <section className="remito-seccion">
                <h3>Origen y destino</h3>
                <div className="remito-form">
                  <label>
                    <span>Depósito / local de origen *</span>
                    <input type="text" value={depositoOrigen} onChange={(e) => setDepositoOrigen(e.target.value)} placeholder="Ej. Local central" />
                  </label>
                  <label>
                    <span>Depósito / local de destino *</span>
                    <input type="text" value={depositoDestino} onChange={(e) => setDepositoDestino(e.target.value)} placeholder="Ej. Depósito Rawson" />
                  </label>
                  <label className="remito-form__ancho">
                    <span>Domicilio de destino</span>
                    <input type="text" value={domicilioEntrega} onChange={(e) => setDomicilioEntrega(e.target.value)} />
                  </label>
                </div>
              </section>
            ) : (
              <section className="remito-seccion">
                <h3>{clase === 'Devolucion' ? 'Cliente que devuelve' : 'Destinatario'}</h3>
                <div className="remito-form">
                  <label>
                    <span>Nombre / razón social *</span>
                    <input type="text" value={destinatario.nombre} onChange={(e) => setDestinatario({ ...destinatario, nombre: e.target.value })} />
                  </label>
                  <label>
                    <span>CUIT / DNI{tipo === 'R' ? ' *' : ''}</span>
                    <input
                      type="text"
                      value={destinatario.documento}
                      onChange={(e) => setDestinatario({ ...destinatario, documento: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Domicilio{tipo === 'R' ? ' *' : ''}</span>
                    <input
                      type="text"
                      value={destinatario.domicilio}
                      onChange={(e) => setDestinatario({ ...destinatario, domicilio: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Condición IVA</span>
                    <select
                      value={destinatario.condicionIva}
                      onChange={(e) => setDestinatario({ ...destinatario, condicionIva: e.target.value })}
                    >
                      {CONDICIONES_IVA.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input
                      type="text"
                      value={destinatario.telefono}
                      onChange={(e) => setDestinatario({ ...destinatario, telefono: e.target.value })}
                    />
                  </label>
                  {clase === 'Entrega' ? (
                    <label>
                      <span>Lugar de entrega (si no es el domicilio)</span>
                      <input type="text" value={domicilioEntrega} onChange={(e) => setDomicilioEntrega(e.target.value)} />
                    </label>
                  ) : null}
                </div>
              </section>
            )}

            <section className="remito-seccion">
              <h3>{clase === 'Devolucion' ? 'Recepción' : 'Entrega y transporte'}</h3>
              <div className="remito-form">
                <label>
                  <span>{clase === 'Devolucion' ? 'Fecha de recepción' : 'Fecha de entrega'}</span>
                  <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
                </label>
                <label>
                  <span>{clase === 'Devolucion' ? 'Quién la trae' : clase === 'Traslado' ? 'Recibe en destino' : 'Retira / recibe'}</span>
                  <input type="text" value={entregadoA} onChange={(e) => setEntregadoA(e.target.value)} placeholder="Nombre y apellido" />
                </label>
                <label>
                  <span>DNI</span>
                  <input type="text" inputMode="numeric" value={dniRetira} onChange={(e) => setDniRetira(e.target.value)} />
                </label>
                <label>
                  <span>Transporte</span>
                  <input
                    type="text"
                    value={transportista}
                    onChange={(e) => setTransportista(e.target.value)}
                    placeholder={clase === 'Entrega' ? 'Retira en local' : 'Nombre del transporte'}
                  />
                </label>
                <label>
                  <span>CUIT del transporte</span>
                  <input type="text" value={transportistaCuit} onChange={(e) => setTransportistaCuit(e.target.value)} />
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
                      <strong>{etiquetaRemito(r)}</strong>
                      {r.clase && r.clase !== 'Entrega' ? ` · ${CLASE_LABEL[r.clase]}` : ''} · {fechaAr(r.fecha_emision)} ·{' '}
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
                disabled={
                  enviando ||
                  (clase === 'Entrega' && !hayPendiente && libres.length === 0) ||
                  (clase === 'Devolucion' && !hayEntregado) ||
                  (tipo === 'R' && (cais === null || pvsR.length === 0))
                }
              >
                {enviando ? 'Emitiendo…' : `Emitir Remito ${tipo} y descargar PDF`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
