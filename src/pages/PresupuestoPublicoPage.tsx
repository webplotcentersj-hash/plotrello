import { useEffect, useMemo, useState } from 'react'
import { apiService } from '../services/api'
import type { ArticuloEmpresaRecord, OrdenTrabajo } from '../types/api'
import {
  DEFAULT_AJUSTES_PRECIOS_VENTAS,
  LISTAS_PRECIO_VENTAS,
  resolvePrecioLista,
  type ConfigAjustesPreciosVentas
} from '../constants/ventasListasPrecio'
import { buildEmbedPresupuestoPdf } from '../utils/embedPresupuestoPdf'
import './PresupuestoPublicoPage.css'

/** Días de validez del presupuesto estimado. */
const DIAS_VALIDEZ = 15

/**
 * Mínimo de artículos publicados (`visible_web_publica`) para mostrar el catálogo.
 * Con dos o tres ítems sueltos la página parece rota: en ese caso se ofrece
 * el formulario libre hasta que Productos publique un surtido real.
 */
const MIN_CATALOGO_PUBLICO = 6

const SECTOR_ENTRADA = 'Asesor Técnico'

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

function formatARS(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

function fechaLegible(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Categorías del Excel importado: hay nombres cortados, así que se muestran prolijas. */
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

  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [items, setItems] = useState<ItemElegido[]>([])

  const [datos, setDatos] = useState<DatosContacto>(DATOS_VACIOS)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<{ numero: string } | null>(null)

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

  const precioDe = (articulo: ArticuloEmpresaRecord): number | null =>
    resolvePrecioLista(articulo, 'lista_1', ajustes)

  const conPrecio = useMemo(
    () => catalogo.filter((a) => (precioDe(a) ?? 0) > 0),
    [catalogo, ajustes]
  )

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
      lineas.push('', `Comentario del cliente: ${datos.mensaje.trim()}`)
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
        ? 'Presupuesto solicitado desde la web pública:'
        : 'Consulta de presupuesto desde la web pública:'

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

  const hayCatalogo = conPrecio.length >= MIN_CATALOGO_PUBLICO

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
            {hayCatalogo
              ? 'Elegí lo que necesitás, mirá el precio estimado al instante y dejanos tus datos. Un asesor te confirma el valor final y los plazos.'
              : 'Contanos qué trabajo necesitás y te preparamos un presupuesto a medida. Un asesor te responde con precios y plazos.'}
          </p>
        </header>

        <div className="presu-pub__grid">
          <main className="presu-pub__catalogo">
            {cargando ? (
              <p className="presu-pub__estado">Cargando productos…</p>
            ) : errorCarga ? (
              <p className="presu-pub__estado presu-pub__estado--error">{errorCarga}</p>
            ) : !hayCatalogo ? (
              <section className="presu-pub__sin-catalogo">
                <h2>Contanos qué necesitás</h2>
                <p>
                  Todavía no publicamos precios en línea. Dejanos el detalle de tu trabajo en el
                  formulario y te preparamos un presupuesto a medida.
                </p>
              </section>
            ) : (
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
            )}
          </main>

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
                  Precios de Lista 1 (efectivo, débito o transferencia), con IVA incluido. Son
                  estimados: el valor final lo confirma el asesor según medidas, materiales y
                  cantidad.
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
              <label>
                {items.length > 0 ? 'Detalles del trabajo' : 'Contanos qué necesitás *'}
                <textarea
                  value={datos.mensaje}
                  onChange={(e) => setDatos((d) => ({ ...d, mensaje: e.target.value }))}
                  rows={4}
                  placeholder="Medidas, materiales, fecha en que lo necesitás…"
                />
              </label>

              {errorEnvio && <p className="presu-pub__error">{errorEnvio}</p>}

              <button type="submit" className="presu-pub__btn presu-pub__btn--enviar" disabled={!puedeEnviar}>
                {enviando ? 'Enviando…' : 'Pedir presupuesto'}
              </button>
              <p className="presu-pub__legal">
                Usamos tus datos solo para contactarte por este presupuesto.
              </p>
            </form>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default PresupuestoPublicoPage
