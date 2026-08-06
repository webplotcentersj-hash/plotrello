import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiService } from '../services/api'
import type { ArticuloEmpresaRecord } from '../types/api'
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
  fileToChatImagePayload,
  type EmbedChatMessage,
  type EmbedPresupuestoPayload
} from '../utils/embedChatShared'
import { EmbedPresupuestoBanner } from '../components/embed/EmbedPresupuestoBanner'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import { generarMockupImagenIa } from '../services/clientePedidoAiService'
import {
  anexarImagenPropuestaPresupuesto,
  crearPresupuestoWebPublico,
  dataUrlToUploadedUrl,
  whatsappHrefDesdeTelefono
} from '../utils/presupuestoWebPublico'
import './PresupuestoPublicoPage.css'

/** Días de validez del presupuesto estimado. */
const DIAS_VALIDEZ = 15

/**
 * Mínimo de artículos publicados (`visible_web_publica`) para mostrar el catálogo.
 * Con pocos ítems sueltos la página parece rota: ahí entra el armado manual / AI.
 */
const MIN_CATALOGO_PUBLICO = 6

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
  const aiPersistidoRef = useRef(false)
  const [aiGuardadoNumero, setAiGuardadoNumero] = useState<string | null>(null)

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
  const [aiPendingImage, setAiPendingImage] = useState<{
    mimeType: string
    data: string
    previewUrl: string
    staffPreviewUrl: string
  } | null>(null)
  const [aiFotoUrls, setAiFotoUrls] = useState<string[]>([])
  const [aiDescripcionFotos, setAiDescripcionFotos] = useState('')
  const [aiImagenPropuesta, setAiImagenPropuesta] = useState<string | null>(null)
  const [aiImagenLoading, setAiImagenLoading] = useState(false)
  const [aiPresupuestoId, setAiPresupuestoId] = useState<number | null>(null)
  const aiEndRef = useRef<HTMLDivElement>(null)
  const aiFileRef = useRef<HTMLInputElement>(null)

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
  }, [aiMessages, aiLoading, aiPresupuesto, aiImagenPropuesta, aiPendingImage])

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

    const itemsVenta =
      items.length > 0
        ? items.map((it) => ({
            id_articulo_stock: it.articulo.id_articulo_stock ?? undefined,
            codigo_articulo: it.articulo.codigo || null,
            descripcion: it.articulo.nombre,
            cantidad: it.cantidad,
            precio_unitario: it.precioUnitario,
            precio_total: it.precioUnitario * it.cantidad
          }))
        : [
            {
              descripcion: (datos.mensaje.trim() || 'Consulta de presupuesto web').slice(0, 240),
              cantidad: 1,
              precio_unitario: 0,
              precio_total: 0,
              observaciones: datos.mensaje.trim() || undefined
            }
          ]

    try {
      const res = await crearPresupuestoWebPublico({
        origen: 'manual',
        cliente_nombre: datos.nombre,
        cliente_telefono: datos.telefono,
        cliente_email: datos.email,
        items: itemsVenta,
        observaciones_cliente: detalleTexto || datos.mensaje.trim(),
        diasValidez: DIAS_VALIDEZ
      })
      if (!res.success) {
        setErrorEnvio(res.error || 'No pudimos registrar tu presupuesto. Probá de nuevo.')
        return
      }
      setEnviado({ numero: res.data.numero_presupuesto })
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No pudimos registrar tu presupuesto.')
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
    setAiGuardadoNumero(null)
    setAiPendingImage(null)
    setAiFotoUrls([])
    setAiDescripcionFotos('')
    setAiImagenPropuesta(null)
    setAiImagenLoading(false)
    setAiPresupuestoId(null)
    aiPersistidoRef.current = false
    try {
      localStorage.removeItem(AI_CONV_KEY)
    } catch {
      /* noop */
    }
  }, [])

  const pickAiImage = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAiError('Solo se permiten imágenes.')
      return
    }
    setAiError(null)
    try {
      const payload = await fileToChatImagePayload(file)
      setAiPendingImage(payload)
    } catch {
      setAiError('No pude procesar la imagen. Probá con otra.')
    } finally {
      if (aiFileRef.current) aiFileRef.current.value = ''
    }
  }

  const generarImagenFinal = async (presupuesto: EmbedPresupuestoPayload, presupuestoId?: number | null) => {
    setAiImagenLoading(true)
    try {
      const detalle = presupuesto.items
        .map((it) => `${it.cantidad} x ${it.descripcion}`)
        .join(', ')
      const prompt =
        `Presupuesto Plot Center para ${presupuesto.cliente_nombre}: ${detalle}. ` +
        `Total estimado ${presupuesto.total}. Producto gráfico / impresión profesional, vista atractiva de referencia.`
      const dataUrl = await generarMockupImagenIa(prompt)
      setAiImagenPropuesta(dataUrl)
      const uploaded = await dataUrlToUploadedUrl(dataUrl, 'presupuesto-web/propuestas')
      if (uploaded && presupuestoId) {
        await anexarImagenPropuestaPresupuesto(
          presupuestoId,
          uploaded,
          presupuesto.cliente_telefono
        )
      }
    } catch (e) {
      console.warn('No se pudo generar imagen propuesta:', e)
      setAiError(e instanceof Error ? e.message : 'No se pudo generar la imagen de referencia.')
    } finally {
      setAiImagenLoading(false)
    }
  }

  const persistirPresupuestoAi = async (
    presupuesto: EmbedPresupuestoPayload,
    extras?: { fotosUrls?: string[]; descripcionFotos?: string }
  ) => {
    if (aiPersistidoRef.current) {
      setAiPresupuesto(presupuesto)
      return
    }
    const fotos = extras?.fotosUrls ?? aiFotoUrls
    const desc = extras?.descripcionFotos ?? aiDescripcionFotos
    const res = await crearPresupuestoWebPublico({
      origen: 'ai',
      cliente_nombre: presupuesto.cliente_nombre,
      cliente_telefono: presupuesto.cliente_telefono || '',
      items: presupuesto.items.map((it) => ({
        codigo_articulo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        precio_total: it.subtotal
      })),
      observaciones_cliente: presupuesto.notas,
      fotosUrls: fotos,
      descripcionFotos: desc || null,
      diasValidez: DIAS_VALIDEZ
    })
    if (!res.success) {
      setAiPresupuesto(presupuesto)
      setAiError(res.error || 'Cotización lista, pero no se pudo guardar en Ventas.')
      return
    }
    aiPersistidoRef.current = true
    setAiGuardadoNumero(res.data.numero_presupuesto)
    setAiPresupuestoId(res.data.id)
    const conNumero: EmbedPresupuestoPayload = {
      ...presupuesto,
      numero: res.data.numero_presupuesto,
      lista_label:
        presupuesto.lista_label ||
        `${LISTAS_PRECIO_VENTAS.lista_1.label} · ${LISTAS_PRECIO_VENTAS.lista_1.subtitle}`
    }
    setAiPresupuesto(conNumero)
    void generarImagenFinal(conNumero, res.data.id)
  }

  const enviarAi = async (textoRaw?: string) => {
    const text = (textoRaw ?? aiInput).trim()
    if ((!text && !aiPendingImage) || aiLoading) return
    setAiError(null)
    setAiInput('')
    const imageSnapshot = aiPendingImage
    setAiPendingImage(null)
    const historyForApi = aiMessages.map((m) => ({ role: m.role, parts: m.parts }))
    const userText = text || (imageSnapshot ? '📷 Imagen enviada' : '')
    setAiMessages((prev) => [
      ...prev,
      {
        role: 'user',
        parts: [{ text: userText }],
        ...(imageSnapshot ? { imagePreviewUrl: imageSnapshot.previewUrl } : {})
      }
    ])
    setAiLoading(true)

    // Subir foto al storage para que llegue al panel de Ventas.
    let fotosParaPanel = [...aiFotoUrls]
    if (imageSnapshot) {
      const url = await dataUrlToUploadedUrl(imageSnapshot.previewUrl, 'presupuesto-web/refs')
      if (url) {
        fotosParaPanel = fotosParaPanel.includes(url) ? fotosParaPanel : [...fotosParaPanel, url]
        setAiFotoUrls(fotosParaPanel)
      }
    }

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
            conversationId: aiConversationId,
            image: imageSnapshot
              ? {
                  mimeType: imageSnapshot.mimeType,
                  data: imageSnapshot.data,
                  staffPreviewUrl: imageSnapshot.staffPreviewUrl
                }
              : null
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
      let descFotos = aiDescripcionFotos
      if (imageSnapshot && reply) {
        descFotos = (descFotos ? `${descFotos}\n\n${reply}` : reply).slice(0, 4000)
        setAiDescripcionFotos(descFotos)
      }
      if (data.conversation_id != null) setAiConversationId(Number(data.conversation_id))
      if (data.presupuesto) {
        await persistirPresupuestoAi(data.presupuesto, {
          fotosUrls: fotosParaPanel,
          descripcionFotos: descFotos
        })
      }
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
              Recibimos tu presupuesto <strong>{enviado.numero}</strong> en Ventas. Un asesor te
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
                Marcá qué necesitás, dejá tus datos y el pedido llega a Ventas → Presupuestos.
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
                Cotizá conversando con precios de Lista 1 y PDF. Queda cargado en Ventas →
                Presupuestos.
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
                      {aiPresupuesto.cliente_telefono ? (
                        <p className="presu-pub__ai-wa">
                          WhatsApp:{' '}
                          <a
                            href={
                              whatsappHrefDesdeTelefono(aiPresupuesto.cliente_telefono) || '#'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {aiPresupuesto.cliente_telefono}
                          </a>
                        </p>
                      ) : null}
                      {(aiImagenPropuesta || aiImagenLoading) && (
                        <div className="presu-pub__ai-propuesta">
                          <p className="presu-pub__ai-propuesta-label">Propuesta visual</p>
                          {aiImagenLoading && !aiImagenPropuesta ? (
                            <p className="presu-pub__ai-propuesta-wait">Generando imagen…</p>
                          ) : null}
                          {aiImagenPropuesta ? (
                            <>
                              <img src={aiImagenPropuesta} alt="Propuesta generada por PlotAI" />
                              <a
                                className="presu-pub__btn presu-pub__btn--fantasma"
                                href={aiImagenPropuesta}
                                download={`propuesta-${aiGuardadoNumero || aiPresupuestoId || 'plot'}.png`}
                              >
                                Descargar imagen
                              </a>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="presu-pub__ai-messages" role="log" aria-live="polite">
                    {aiMessages.map((m, i) => (
                      <div
                        key={`${m.role}-${i}`}
                        className={`presu-pub__ai-burbuja presu-pub__ai-burbuja--${m.role === 'user' ? 'user' : 'bot'}`}
                      >
                        {m.imagePreviewUrl ? (
                          <img
                            className="presu-pub__ai-msg-img"
                            src={m.imagePreviewUrl}
                            alt="Foto adjunta"
                          />
                        ) : null}
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

                  {aiPendingImage && (
                    <div className="presu-pub__ai-attach-preview">
                      <img src={aiPendingImage.previewUrl} alt="Vista previa" />
                      <button
                        type="button"
                        onClick={() => setAiPendingImage(null)}
                        aria-label="Quitar foto"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <form
                    className="presu-pub__ai-composer"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void enviarAi()
                    }}
                  >
                    <input
                      ref={aiFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="presu-pub__ai-file"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.target.value = ''
                        void pickAiImage(f)
                      }}
                    />
                    <button
                      type="button"
                      className="presu-pub__ai-attach"
                      disabled={aiLoading}
                      title="Adjuntar foto"
                      aria-label="Adjuntar foto"
                      onClick={() => aiFileRef.current?.click()}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M21 15V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M17 3v6M14 6h6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <circle cx="9" cy="14" r="2" stroke="currentColor" strokeWidth="1.8" />
                        <path
                          d="M21 15l-4.5-4.5L7 20"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder={
                        aiPendingImage
                          ? 'Describí la foto o pedí cotización…'
                          : 'Escribí tu consulta…'
                      }
                      disabled={aiLoading}
                      aria-label="Mensaje para PlotAI"
                    />
                    <button
                      type="submit"
                      className="presu-pub__btn"
                      disabled={aiLoading || (!aiInput.trim() && !aiPendingImage)}
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
                    <li>
                      Podés <strong>subir una foto</strong>: PlotAI la describe y cotiza con Lista
                      1.
                    </li>
                    <li>
                      Al cerrar, descargá el <strong>PDF</strong> y la imagen de propuesta. En
                      Ventas queda el link de WhatsApp.
                    </li>
                  </ol>
                  {aiGuardadoNumero && (
                    <p className="presu-pub__tips-ok">
                      Guardado en Ventas como <strong>{aiGuardadoNumero}</strong>
                      {aiPresupuesto?.cliente_telefono &&
                      whatsappHrefDesdeTelefono(aiPresupuesto.cliente_telefono) ? (
                        <>
                          {' '}
                          ·{' '}
                          <a
                            href={whatsappHrefDesdeTelefono(aiPresupuesto.cliente_telefono)!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Abrir WhatsApp
                          </a>
                        </>
                      ) : null}
                      .
                    </p>
                  )}
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
