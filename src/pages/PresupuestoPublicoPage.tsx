import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiService } from '../services/api'
import type { ArticuloEmpresaRecord, OrdenTrabajo } from '../types/api'
import {
  DEFAULT_AJUSTES_PRECIOS_VENTAS,
  LISTAS_PRECIO_VENTAS,
  resolvePrecioLista,
  type ConfigAjustesPreciosVentas
} from '../constants/ventasListasPrecio'
import { buildEmbedPresupuestoPdf } from '../utils/embedPresupuestoPdf'
import {
  buildEmbedChatApiPayload,
  EMBED_CHAT_OPENING_GREETING,
  type EmbedChatMessage,
  type EmbedPresupuestoPayload
} from '../utils/embedChatShared'
import { EmbedPresupuestoBanner } from '../components/embed/EmbedPresupuestoBanner'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import './PresupuestoPublicoPage.css'

/** Días de validez del presupuesto estimado. */
const DIAS_VALIDEZ = 15

/**
 * Mínimo de artículos publicados (`visible_web_publica`) para mostrar el catálogo.
 * Con pocos ítems sueltos la página parece rota: ahí entra el armado manual / AI.
 */
const MIN_CATALOGO_PUBLICO = 6

const SECTOR_ENTRADA = 'Asesor Técnico'
const AI_CONV_KEY = 'plotlab_presupuesto_publico_conv'

type ModoPresu = 'elegir' | 'manual' | 'ai'

type ItemElegido = {
  articulo: ArticuloEmpresaRecord
  cantidad: number
  precioUnitario: number
}

type DatosContacto = {
  nombre: string
  telefono: string
  email: string
  mensaje: string
}

const DATOS_VACIOS: DatosContacto = { nombre: '', telefono: '', email: '', mensaje: '' }

/** Rubros gráficos para el armado manual (sin depender del catálogo publicado). */
const RUBROS_MANUAL: { id: string; label: string; icono: string; hint: string }[] = [
  { id: 'flyer', label: 'Flyer / Folleto', icono: '📄', hint: 'Promos para repartir' },
  { id: 'banner', label: 'Banner', icono: '🏁', hint: 'Eventos y fachadas' },
  { id: 'tarjetas', label: 'Tarjetas', icono: '💳', hint: 'Presentación' },
  { id: 'carteleria', label: 'Cartelería', icono: '🪧', hint: 'Local o vía pública' },
  { id: 'vehicular', label: 'Ploteo auto', icono: '🚗', hint: 'Flota o particular' },
  { id: 'vidrieras', label: 'Vidrieras', icono: '🏪', hint: 'Locales y comercios' },
  { id: 'stickers', label: 'Stickers', icono: '✨', hint: 'Calcos y etiquetas' },
  { id: 'logo', label: 'Logo / Marca', icono: '🎨', hint: 'Diseño o rediseño' },
  { id: 'senaletica', label: 'Señalética', icono: '➡️', hint: 'Orientación' },
  { id: 'otro', label: 'Otro', icono: '💬', hint: 'Te asesoramos' }
]

function formatARS(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

function fechaLegible(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function tituloCategoria(raw: string | null | undefined): string {
  const txt = (raw || 'Otros').trim()
  if (!txt) return 'Otros'
  return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
}

const PresupuestoPublicoPage = () => {
  const [catalogo, setCatalogo] = useState<ArticuloEmpresaRecord[]>([])
  const [ajustes, setAjustes] = useState<ConfigAjustesPreciosVentas>(DEFAULT_AJUSTES_PRECIOS_VENTAS)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [modo, setModo] = useState<ModoPresu>('elegir')
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [items, setItems] = useState<ItemElegido[]>([])
  const [rubrosElegidos, setRubrosElegidos] = useState<string[]>([])
  const [detalleManual, setDetalleManual] = useState('')

  const [datos, setDatos] = useState<DatosContacto>(DATOS_VACIOS)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<{ numero: string } | null>(null)

  // PlotAI
  const [aiMessages, setAiMessages] = useState<EmbedChatMessage[]>([
    { role: 'model', parts: [{ text: EMBED_CHAT_OPENING_GREETING }] }
  ])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPresupuesto, setAiPresupuesto] = useState<EmbedPresupuestoPayload | null>(null)
  const [aiConversationId, setAiConversationId] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem(AI_CONV_KEY)
      const n = s ? parseInt(s, 10) : NaN
      return Number.isInteger(n) ? n : null
    } catch {
      return null
    }
  })
  const aiEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      setCargando(true)
      const [resArticulos, resAjustes] = await Promise.all([
        apiService.getArticulosEmpresa(undefined, false, 'web_publica'),
        apiService.getConfiguracionPreciosVentas()
      ])
      if (!vivo) return
      if (resAjustes.success && resAjustes.data) setAjustes(resAjustes.data)
      if (resArticulos.success && resArticulos.data) {
        setCatalogo(resArticulos.data)
        setErrorCarga(null)
      } else {
        setErrorCarga(resArticulos.error || 'No pudimos cargar el catálogo.')
      }
      setCargando(false)
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (aiConversationId != null) {
      try {
        localStorage.setItem(AI_CONV_KEY, String(aiConversationId))
      } catch {
        /* noop */
      }
    }
  }, [aiConversationId])

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading, aiPresupuesto])

  // Sincroniza el mensaje del formulario con el armado manual (rubros + detalle).
  useEffect(() => {
    if (modo !== 'manual') return
    const labels = RUBROS_MANUAL.filter((r) => rubrosElegidos.includes(r.id)).map((r) => r.label)
    const partes: string[] = []
    if (labels.length) partes.push(`Necesito: ${labels.join(', ')}.`)
    if (detalleManual.trim()) partes.push(detalleManual.trim())
    const texto = partes.join('\n')
    setDatos((d) => (d.mensaje === texto ? d : { ...d, mensaje: texto }))
  }, [modo, rubrosElegidos, detalleManual])

  const precioDe = (articulo: ArticuloEmpresaRecord): number | null =>
    resolvePrecioLista(articulo, 'lista_1', ajustes)

  const conPrecio = useMemo(
    () =>
      catalogo.filter((a) => {
        const precio = resolvePrecioLista(a, 'lista_1', ajustes)
        return (precio ?? 0) > 0
      }),
    [catalogo, ajustes]
  )

  const hayCatalogo = conPrecio.length >= MIN_CATALOGO_PUBLICO

  const categorias = useMemo(() => {
    const set = new Map<string, number>()
    for (const a of conPrecio) {
      const key = a.categoria?.trim() || 'Otros'
      set.set(key, (set.get(key) ?? 0) + 1)
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [conPrecio])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return conPrecio.filter((a) => {
      const cat = a.categoria?.trim() || 'Otros'
      if (categoriaActiva && cat !== categoriaActiva) return false
      if (!q) return true
      return (
        a.nombre.toLowerCase().includes(q) ||
        (a.descripcion || '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      )
    })
  }, [conPrecio, categoriaActiva, busqueda])

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0),
    [items]
  )

  const agregar = (articulo: ArticuloEmpresaRecord) => {
    const precio = precioDe(articulo)
    if (precio == null || precio <= 0) return
    setItems((prev) => {
      const existente = prev.find((it) => it.articulo.id === articulo.id)
      if (existente) {
        return prev.map((it) =>
          it.articulo.id === articulo.id ? { ...it, cantidad: it.cantidad + 1 } : it
        )
      }
      return [...prev, { articulo, cantidad: 1, precioUnitario: precio }]
    })
  }

  const cambiarCantidad = (id: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) =>
          it.articulo.id === id ? { ...it, cantidad: Math.max(0, it.cantidad + delta) } : it
        )
        .filter((it) => it.cantidad > 0)
    )
  }

  const quitar = (id: number) => setItems((prev) => prev.filter((it) => it.articulo.id !== id))

  const toggleRubro = (id: string) => {
    setRubrosElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const detalleTexto = useMemo(() => {
    const lineas = items.map(
      (it) =>
        `• ${it.cantidad} x ${it.articulo.nombre} — ${formatARS(it.precioUnitario)} c/u = ${formatARS(
          it.precioUnitario * it.cantidad
        )}`
    )
    if (items.length > 0) {
      lineas.push(`Total estimado: ${formatARS(total)} (Lista 1, precios sujetos a confirmación)`)
    }
    if (datos.mensaje.trim()) {
      lineas.push('', `Detalle del cliente: ${datos.mensaje.trim()}`)
    }
    return lineas.join('\n')
  }, [items, total, datos.mensaje])

  const puedeEnviar =
    datos.nombre.trim().length >= 3 &&
    datos.telefono.trim().length >= 6 &&
    (items.length > 0 || datos.mensaje.trim().length >= 5) &&
    !enviando

  const enviar = async () => {
    if (!puedeEnviar) return
    setEnviando(true)
    setErrorEnvio(null)

    const encabezado =
      items.length > 0
        ? 'Presupuesto solicitado desde la web pública (modo manual):'
        : 'Consulta de presupuesto desde la web pública (modo manual):'

    const payload: Partial<OrdenTrabajo> = {
      numero_op: 'FICHA-',
      cliente: datos.nombre.trim(),
      descripcion: `${encabezado}\n${detalleTexto}`,
      estado: SECTOR_ENTRADA,
      prioridad: 'Media',
      sector: SECTOR_ENTRADA,
      sectores: [SECTOR_ENTRADA],
      sector_inicial: SECTOR_ENTRADA,
      nombre_creador: 'Presupuesto web',
      telefono_cliente: datos.telefono.trim() || null,
      email_cliente: datos.email.trim() || null,
      es_ficha_no_op: true
    }

    try {
      const res = await apiService.createOrden(payload)
      if (!res.success) {
        setErrorEnvio(res.error || 'No pudimos registrar tu pedido. Probá de nuevo en un momento.')
        return
      }
      setEnviado({ numero: res.data?.numero_op || 'tu solicitud' })
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No pudimos registrar tu pedido.')
    } finally {
      setEnviando(false)
    }
  }

  const descargarPdf = async () => {
    const hoy = new Date()
    const validez = new Date(hoy.getTime() + DIAS_VALIDEZ * 86_400_000)
    const doc = await buildEmbedPresupuestoPdf({
      numero: enviado?.numero || 'ESTIMADO',
      fecha: fechaLegible(hoy),
      validez_hasta: fechaLegible(validez),
      cliente_nombre: datos.nombre.trim() || 'Consumidor final',
      cliente_telefono: datos.telefono.trim() || null,
      lista_label: `${LISTAS_PRECIO_VENTAS.lista_1.label} · ${LISTAS_PRECIO_VENTAS.lista_1.subtitle}`,
      items: items.map((it) => ({
        codigo: it.articulo.codigo || null,
        descripcion: it.articulo.nombre,
        cantidad: it.cantidad,
        precio_unitario: it.precioUnitario,
        subtotal: it.precioUnitario * it.cantidad
      })),
      total,
      notas:
        'Presupuesto estimado generado desde la web. Los valores son de referencia y quedan sujetos a confirmación del asesor técnico.'
    })
    doc.save(`presupuesto-plot-lab-${enviado?.numero || 'estimado'}.pdf`)
  }

  const resetAi = useCallback(() => {
    setAiMessages([{ role: 'model', parts: [{ text: EMBED_CHAT_OPENING_GREETING }] }])
    setAiPresupuesto(null)
    setAiError(null)
    setAiInput('')
    setAiConversationId(null)
    try {
      localStorage.removeItem(AI_CONV_KEY)
    } catch {
      /* noop */
    }
  }, [])

  const enviarAi = async (textoRaw?: string) => {
    const text = (textoRaw ?? aiInput).trim()
    if (!text || aiLoading) return
    setAiError(null)
    setAiInput('')
    const historyForApi = aiMessages.map((m) => ({ role: m.role, parts: m.parts }))
    setAiMessages((prev) => [...prev, { role: 'user', parts: [{ text }] }])
    setAiLoading(true)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 28_000)

    try {
      const res = await fetch(plotLabApiUrl('/api/plotai/chat-public'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(
          buildEmbedChatApiPayload({
            message: text,
            modo: 'web_publico',
            history: historyForApi,
            conversationId: aiConversationId
          })
        )
      })
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        error?: string
        conversation_id?: number
        presupuesto?: EmbedPresupuestoPayload
      }
      if (!res.ok) {
        setAiError(data.error || 'No se pudo enviar el mensaje.')
        setAiMessages((prev) => prev.slice(0, -1))
        return
      }
      const reply = (data.reply && String(data.reply).trim()) || 'No pude generar una respuesta.'
      setAiMessages((prev) => [...prev, { role: 'model', parts: [{ text: reply }] }])
      if (data.conversation_id != null) setAiConversationId(Number(data.conversation_id))
      if (data.presupuesto) setAiPresupuesto(data.presupuesto)
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setAiError(aborted ? 'La respuesta tardó demasiado. Intentá de nuevo.' : 'Error de conexión.')
      setAiMessages((prev) => prev.slice(0, -1))
    } finally {
      window.clearTimeout(timeoutId)
      setAiLoading(false)
    }
  }

  if (enviado) {
    return (
      <div className="presu-pub">
        <div className="presu-pub__inner presu-pub__inner--centrado">
          <section className="presu-pub__exito">
            <span className="presu-pub__exito-icono" aria-hidden>
              ✅
            </span>
            <h1>¡Listo, {datos.nombre.trim().split(' ')[0]}!</h1>
            <p>
              Recibimos tu pedido de presupuesto <strong>{enviado.numero}</strong>. Un asesor te
              contacta al <strong>{datos.telefono.trim()}</strong> para confirmarte precios y plazos.
            </p>
            {items.length > 0 && (
              <p className="presu-pub__exito-total">
                Total estimado: <strong>{formatARS(total)}</strong>
              </p>
            )}
            <div className="presu-pub__exito-acciones">
              {items.length > 0 && (
                <button type="button" className="presu-pub__btn" onClick={() => void descargarPdf()}>
                  Descargar PDF
                </button>
              )}
              <a className="presu-pub__btn presu-pub__btn--fantasma" href="/presupuesto">
                Hacer otro presupuesto
              </a>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="presu-pub">
      <div className="presu-pub__inner">
        <header className="presu-pub__hero">
          <img src="/plot-lab-lockup.png" alt="Plot Lab" className="presu-pub__logo" />
          <span className="presu-pub__badge">Sin registrarte · respuesta el mismo día</span>
          <h1>Armá tu presupuesto</h1>
          <p>
            Elegí cómo cotizar: a mano, paso a paso, o conversando con PlotAI. En ambos casos un
            asesor confirma el valor final.
          </p>
        </header>

        {modo !== 'elegir' && (
          <div className="presu-pub__modo-bar" role="tablist" aria-label="Modo de presupuesto">
            <button
              type="button"
              className="presu-pub__modo-back"
              onClick={() => setModo('elegir')}
            >
              ← Cambiar modo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'manual'}
              className={`presu-pub__modo-tab${modo === 'manual' ? ' is-activo' : ''}`}
              onClick={() => setModo('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'ai'}
              className={`presu-pub__modo-tab${modo === 'ai' ? ' is-activo' : ''}`}
              onClick={() => setModo('ai')}
            >
              Con PlotAI
            </button>
          </div>
        )}

        {modo === 'elegir' ? (
          <section className="presu-pub__elegir" aria-label="Elegí cómo presupuestar">
            <button
              type="button"
              className="presu-pub__modo-card presu-pub__modo-card--manual"
              onClick={() => setModo('manual')}
            >
              <span className="presu-pub__modo-card__icono" aria-hidden>
                🧾
              </span>
              <span className="presu-pub__modo-card__eyebrow">Opción 1</span>
              <strong>Manual</strong>
              <p>
                Marcá qué necesitás, contanos medidas y cantidad, y dejá tus datos. Simple y
                visual.
              </p>
              <span className="presu-pub__modo-card__cta">Empezar →</span>
            </button>

            <button
              type="button"
              className="presu-pub__modo-card presu-pub__modo-card--ai"
              onClick={() => setModo('ai')}
            >
              <span className="presu-pub__modo-card__icono" aria-hidden>
                <img src="/plot-lab-logo.png" alt="" />
              </span>
              <span className="presu-pub__modo-card__eyebrow">Opción 2</span>
              <strong>Con PlotAI</strong>
              <p>
                Cotizá conversando: precios de Lista 1, PDF al instante y el mismo asistente del
                chat web.
              </p>
              <span className="presu-pub__modo-card__cta">Hablar con PlotAI →</span>
            </button>
          </section>
        ) : (
          <div className={`presu-pub__grid${modo === 'ai' ? ' presu-pub__grid--ai' : ''}`}>
            <main className="presu-pub__catalogo">
              {modo === 'manual' && (
                <>
                  {cargando ? (
                    <p className="presu-pub__estado">Cargando…</p>
                  ) : errorCarga && hayCatalogo ? (
                    <p className="presu-pub__estado presu-pub__estado--error">{errorCarga}</p>
                  ) : hayCatalogo ? (
                    <>
                      <div className="presu-pub__buscador">
                        <input
                          type="search"
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar: banner, tarjetas, cartel, ploteo…"
                          aria-label="Buscar producto"
                        />
                      </div>
                      <div className="presu-pub__rubros" role="group" aria-label="Rubros">
                        <button
                          type="button"
                          className={`presu-pub__rubro${categoriaActiva === null ? ' is-activo' : ''}`}
                          onClick={() => setCategoriaActiva(null)}
                        >
                          Todo
                        </button>
                        {categorias.map(([cat, cantidad]) => (
                          <button
                            key={cat}
                            type="button"
                            className={`presu-pub__rubro${categoriaActiva === cat ? ' is-activo' : ''}`}
                            onClick={() => setCategoriaActiva(cat)}
                          >
                            {tituloCategoria(cat)} <span>{cantidad}</span>
                          </button>
                        ))}
                      </div>
                      {visibles.length === 0 ? (
                        <p className="presu-pub__estado">No encontramos nada con esa búsqueda.</p>
                      ) : (
                        <ul className="presu-pub__productos">
                          {visibles.map((a) => {
                            const precio = precioDe(a) ?? 0
                            const enCarrito = items.find((it) => it.articulo.id === a.id)
                            return (
                              <li key={a.id} className="presu-pub__producto">
                                <div className="presu-pub__producto-info">
                                  <strong>{a.nombre}</strong>
                                  {a.descripcion && <span>{a.descripcion}</span>}
                                  <em>{tituloCategoria(a.categoria)}</em>
                                </div>
                                <div className="presu-pub__producto-precio">
                                  <b>{formatARS(precio)}</b>
                                  <button
                                    type="button"
                                    className="presu-pub__btn presu-pub__btn--chico"
                                    onClick={() => agregar(a)}
                                  >
                                    {enCarrito ? `Agregar (${enCarrito.cantidad})` : 'Agregar'}
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    <section className="presu-pub__manual-guiado">
                      <h2>¿Qué necesitás?</h2>
                      <p className="presu-pub__manual-guiado__hint">
                        Tocá una o más opciones. Después contanos medidas, cantidad y plazo.
                      </p>
                      <div className="presu-pub__tipo-grid" role="group" aria-label="Tipos de trabajo">
                        {RUBROS_MANUAL.map((r) => {
                          const on = rubrosElegidos.includes(r.id)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              className={`presu-pub__tipo-chip${on ? ' is-activo' : ''}`}
                              onClick={() => toggleRubro(r.id)}
                              aria-pressed={on}
                              title={r.hint}
                            >
                              <span aria-hidden>{r.icono}</span>
                              <strong>{r.label}</strong>
                              <em>{r.hint}</em>
                            </button>
                          )
                        })}
                      </div>
                      <label className="presu-pub__manual-detalle">
                        Detalle del trabajo
                        <textarea
                          value={detalleManual}
                          onChange={(e) => setDetalleManual(e.target.value)}
                          rows={5}
                          placeholder="Ej: 2 banners 2×1 m, entrega el viernes, textos los mando por WhatsApp…"
                        />
                      </label>
                    </section>
                  )}
                </>
              )}

              {modo === 'ai' && (
                <section className="presu-pub__ai embed-chat-scope" aria-label="Chat PlotAI">
                  <header className="presu-pub__ai-head">
                    <div>
                      <p className="presu-pub__ai-eyebrow">PlotAI</p>
                      <h2>Cotizá conversando</h2>
                      <p>Decime tu nombre y WhatsApp, y qué necesitás. Te paso precios de Lista 1.</p>
                    </div>
                    <button type="button" className="presu-pub__btn presu-pub__btn--fantasma" onClick={resetAi}>
                      Nuevo chat
                    </button>
                  </header>

                  {aiPresupuesto && (
                    <div className="presu-pub__ai-presupuesto">
                      <EmbedPresupuestoBanner presupuesto={aiPresupuesto} />
                    </div>
                  )}

                  <div className="presu-pub__ai-messages" role="log" aria-live="polite">
                    {aiMessages.map((m, i) => (
                      <div
                        key={`${m.role}-${i}`}
                        className={`presu-pub__ai-burbuja presu-pub__ai-burbuja--${m.role === 'user' ? 'user' : 'bot'}`}
                      >
                        {m.parts[0]?.text}
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="presu-pub__ai-burbuja presu-pub__ai-burbuja--bot is-typing">
                        PlotAI está escribiendo…
                      </div>
                    )}
                    <div ref={aiEndRef} />
                  </div>

                  {aiError && <p className="presu-pub__error">{aiError}</p>}

                  <div className="presu-pub__ai-sugerencias">
                    {['Juan 2645123456', 'Banner 2x1', 'Tarjetas personales x500'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="presu-pub__ai-chip"
                        disabled={aiLoading}
                        onClick={() => void enviarAi(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <form
                    className="presu-pub__ai-composer"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void enviarAi()
                    }}
                  >
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Escribí tu consulta…"
                      disabled={aiLoading}
                      aria-label="Mensaje para PlotAI"
                    />
                    <button
                      type="submit"
                      className="presu-pub__btn"
                      disabled={aiLoading || !aiInput.trim()}
                    >
                      Enviar
                    </button>
                  </form>
                </section>
              )}
            </main>

            {modo === 'manual' && (
              <aside className="presu-pub__panel">
                {items.length > 0 && (
                  <section className="presu-pub__resumen">
                    <h2>Tu presupuesto</h2>
                    <ul>
                      {items.map((it) => (
                        <li key={it.articulo.id}>
                          <div className="presu-pub__resumen-nombre">
                            <strong>{it.articulo.nombre}</strong>
                            <span>{formatARS(it.precioUnitario * it.cantidad)}</span>
                          </div>
                          <div className="presu-pub__cantidad">
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(it.articulo.id, -1)}
                              aria-label={`Quitar uno de ${it.articulo.nombre}`}
                            >
                              −
                            </button>
                            <b>{it.cantidad}</b>
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(it.articulo.id, 1)}
                              aria-label={`Agregar uno de ${it.articulo.nombre}`}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="presu-pub__quitar"
                              onClick={() => quitar(it.articulo.id)}
                            >
                              Quitar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="presu-pub__total">
                      <span>Total estimado</span>
                      <strong>{formatARS(total)}</strong>
                    </p>
                    <p className="presu-pub__aclaracion">
                      Precios de Lista 1 (efectivo, débito o transferencia). Estimados: el valor
                      final lo confirma el asesor.
                    </p>
                  </section>
                )}

                <form
                  className="presu-pub__form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void enviar()
                  }}
                >
                  <h2>Tus datos</h2>
                  <label>
                    Nombre y apellido *
                    <input
                      type="text"
                      value={datos.nombre}
                      onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))}
                      required
                      minLength={3}
                      placeholder="Ej: Ana Gómez"
                    />
                  </label>
                  <label>
                    WhatsApp o teléfono *
                    <input
                      type="tel"
                      value={datos.telefono}
                      onChange={(e) => setDatos((d) => ({ ...d, telefono: e.target.value }))}
                      required
                      placeholder="Ej: 264 512 3456"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={datos.email}
                      onChange={(e) => setDatos((d) => ({ ...d, email: e.target.value }))}
                      placeholder="opcional"
                    />
                  </label>
                  {hayCatalogo && (
                    <label>
                      Detalles del trabajo
                      <textarea
                        value={datos.mensaje}
                        onChange={(e) => setDatos((d) => ({ ...d, mensaje: e.target.value }))}
                        rows={4}
                        placeholder="Medidas, materiales, fecha en que lo necesitás…"
                      />
                    </label>
                  )}

                  {errorEnvio && <p className="presu-pub__error">{errorEnvio}</p>}

                  <button
                    type="submit"
                    className="presu-pub__btn presu-pub__btn--enviar"
                    disabled={!puedeEnviar}
                  >
                    {enviando ? 'Enviando…' : 'Pedir presupuesto'}
                  </button>
                  <p className="presu-pub__legal">
                    Usamos tus datos solo para contactarte por este presupuesto.
                  </p>
                </form>
              </aside>
            )}

            {modo === 'ai' && (
              <aside className="presu-pub__panel presu-pub__panel--tips">
                <section className="presu-pub__tips">
                  <h2>Cómo cotizar con AI</h2>
                  <ol>
                    <li>
                      Empezá con <strong>nombre + WhatsApp</strong> en un solo mensaje.
                    </li>
                    <li>Decí el producto, medidas y cantidad.</li>
                    <li>Cuando haya precio, descargá el <strong>PDF</strong> desde el banner.</li>
                  </ol>
                  <p>
                    Los valores son de Lista 1 (efectivo / débito / transferencia) y quedan sujetos
                    a confirmación.
                  </p>
                </section>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PresupuestoPublicoPage
