import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { historialPorOrdenId, historialUnificadoMismoNumeroOp } from '../utils/consultaOpHistorial'
import { TOTEM_FINALIZADO_TALLER_PATH } from '../constants/totemFinalizadoTaller'
import { listenAsesorEnCamino, solicitarAsesorTotem } from '../utils/totemSolicitarAsesor'
import { listenDisenadorEnCamino, solicitarDisenadorTotem } from '../utils/totemSolicitarDisenador'
import {
  isOpEnAlmacenEntrega,
  isOpFinalizadoEnTaller
} from '../utils/totemConsultaOpEstado'
import { TotemAutogestionPlotAiChat } from '@/components/ui/TotemAutogestionPlotAiChat'
import { TotemKioskIcon, type TotemKioskIconName } from '../components/totem/TotemKioskIcons'
import { requestTotemKioskFullscreen, useTotemKioskFullscreen } from '../hooks/useTotemKioskMode'
import './ClienteConsultaPage.css'
import './TotemConsultaClientePage.css'
import './TotemConsultaV2.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const INACTIVITY_MS = 90000 // Sin tocar → pantalla en espera (modo kiosk)

type SectorDirection = 'planta-baja' | 'adelante' | 'primer-piso'

const TIPS: Array<{ icon: TotemKioskIconName; text: string }> = [
  { icon: 'search', text: 'Consultá cómo va tu pedido con tu número de OP' },
  { icon: 'print', text: 'Imprimí tus archivos: subilos desde tu celular' },
  { icon: 'catalog', text: 'Elegí y comprá productos del catálogo' },
  { icon: 'presupuestos', text: 'Pedí un presupuesto y asesoramiento' }
]

const ETAPAS = ['Diseño', 'Producción', 'Terminado', 'Listo para retirar']

const MENSAJE_ETAPA = [
  'Estamos trabajando en el diseño de tu pedido.',
  'Tu pedido está en producción.',
  'Tu pedido terminó de producirse.',
  '¡Tu pedido está listo para retirar!'
]

const OP_MAX_DIGITOS = 10

const DIRECCION_TEXTO: Record<SectorDirection, string> = {
  'planta-baja': 'Seguí las flechas del piso hacia abajo',
  adelante: 'Seguí hacia adelante',
  'primer-piso': 'Subí por las escaleras'
}

/** Paleta CMYK de proceso (impresión) para la señalética del tótem. */
const CMYK = {
  C: { bg: '#00AEEF', text: '#0f172a' },
  M: { bg: '#EC008C', text: '#ffffff' },
  Y: { bg: '#FFF200', text: '#0f172a' },
  K: { bg: '#231F20', text: '#ffffff' }
} as const

// Señalética: franjas horizontales; Diseño + Marketing → 1° piso (flecha arriba)
const TOTEM_SECTORS_QUEHACER: Array<{
  id: string
  label: string
  icon: TotemKioskIconName
  sectorDestino: string
  bg: string
  textColor: string
  direction: SectorDirection
}> = [
  {
    id: 'presupuestos',
    label: 'PRESUPUESTOS Y ASESORAMIENTO',
    icon: 'presupuestos',
    sectorDestino: 'Presupuestos y asesoramiento',
    bg: CMYK.C.bg,
    textColor: CMYK.C.text,
    direction: 'planta-baja'
  },
  {
    id: 'recepcion',
    label: 'RECEPCIÓN DE PEDIDOS',
    icon: 'recepcion',
    sectorDestino: 'Recepción de pedidos',
    bg: CMYK.Y.bg,
    textColor: CMYK.Y.text,
    direction: 'planta-baja'
  },
  {
    id: 'diseno',
    label: 'DISEÑO GRÁFICO Y MARKETING',
    icon: 'diseno',
    sectorDestino: 'Diseño gráfico y marketing',
    bg: CMYK.M.bg,
    textColor: CMYK.M.text,
    direction: 'primer-piso'
  },
  {
    id: 'caja',
    label: 'ENTREGAS TALLER GRÁFICO',
    icon: 'caja',
    sectorDestino: 'Entregas Taller Gráfico',
    bg: CMYK.K.bg,
    textColor: CMYK.K.text,
    direction: 'adelante'
  },
  {
    id: 'base_operaciones',
    label: 'ENTREGAS TALLER DE IMPRENTA',
    icon: 'base_operaciones',
    sectorDestino: 'Entregas taller de imprenta',
    bg: '#F472B6',
    textColor: '#0f172a',
    direction: 'adelante'
  }
]

function SectorDirectionArrows({ direction }: { direction: SectorDirection }) {
  if (direction === 'primer-piso') {
    return (
      <span className="totem-strip-direction totem-strip-direction--up" aria-label="Subir al primer piso">
        <span className="totem-strip-floor-badge">1° piso</span>
        <span className="totem-strip-arrows-up" aria-hidden>
          ↑ ↑ ↑
        </span>
      </span>
    )
  }
  if (direction === 'adelante') {
    return (
      <span className="totem-strip-direction totem-strip-direction--ahead" aria-label="Seguí adelante">
        <span className="totem-strip-arrows" aria-hidden>
          &gt;&gt;&gt;
        </span>
      </span>
    )
  }
  return (
    <span className="totem-strip-direction totem-strip-direction--down" aria-label="Bajar / planta baja">
      <span className="totem-strip-arrows-down" aria-hidden>
        ↓ ↓ ↓
      </span>
    </span>
  )
}

const TotemConsultaClientePage = () => {
  const navigate = useNavigate()
  const [searchOp, setSearchOp] = useState('')
  const [loading, setLoading] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<Record<number, HistorialMovimiento[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [sectorDestino, setSectorDestino] = useState<string>('Mostrador')
  const [step, setStep] = useState<'idle' | 'welcome' | 'search'>('idle')
  const [selectedQueHacer, setSelectedQueHacer] = useState<string | null>(null)
  const [avisoVoyNombre, setAvisoVoyNombre] = useState('')
  const [avisoVoyMotivo, setAvisoVoyMotivo] = useState('')
  const [enviandoAvisoVoy, setEnviandoAvisoVoy] = useState(false)
  const [lastInteraction, setLastInteraction] = useState<number>(() => Date.now())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tipIdx, setTipIdx] = useState(0)
  const [historialAbierto, setHistorialAbierto] = useState<Record<number, boolean>>({})
  const { toggle: toggleKioskFullscreen } = useTotemKioskFullscreen()
  const pageRef = useRef<HTMLDivElement>(null)
  const unsubAsesorEnCaminoRef = useRef<(() => void) | null>(null)
  const unsubDisenadorEnCaminoRef = useRef<(() => void) | null>(null)

  const registrarInteraccion = () => setLastInteraction(Date.now())

  const registrarInteraccionKiosk = () => {
    registrarInteraccion()
    if (!document.fullscreenElement && pageRef.current) {
      void requestTotemKioskFullscreen(pageRef.current)
    }
  }

  const clearLlamadoListeners = () => {
    unsubAsesorEnCaminoRef.current?.()
    unsubAsesorEnCaminoRef.current = null
    unsubDisenadorEnCaminoRef.current?.()
    unsubDisenadorEnCaminoRef.current = null
  }

  const volverAWelcome = () => {
    registrarInteraccion()
    clearLlamadoListeners()
    setSearchOp('')
    setOrdenes([])
    setHistorial({})
    setError(null)
    setMensaje(null)
    setLoading(false)
    setStep('welcome')
  }

  const toggleFullscreen = async () => {
    registrarInteraccion()
    const el = pageRef.current
    if (!el) return
    await toggleKioskFullscreen(el)
  }

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    return () => {
      clearLlamadoListeners()
    }
  }, [])

  useEffect(() => {
    if (step !== 'idle') return
    const id = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 4500)
    return () => clearInterval(id)
  }, [step])

  // si el tótem tiene teclado físico, también sirve
  useEffect(() => {
    if (step !== 'search' || ordenes.length > 0) return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) teclaOp(e.key)
      else if (e.key === 'Backspace') borrarUltimoOp()
      else if (e.key === 'Enter' && !loading) void handleSearchOp()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ordenes.length, searchOp, loading])

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (step === 'idle') return
      if (elapsed > INACTIVITY_MS) {
        clearLlamadoListeners()
        setSearchOp('')
        setOrdenes([])
        setHistorial({})
        setError(null)
        setMensaje(null)
        setSelectedQueHacer(null)
        setAvisoVoyNombre('')
        setAvisoVoyMotivo('')
        setStep('idle')
      }
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteraction, step])

  // solo desarrollo: window.__consultaDemo() muestra resultados de ejemplo sin consultar la base
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __consultaDemo?: (etapa?: number) => void }
    w.__consultaDemo = (etapa = 1) => {
      const estados = ['Diseño Gráfico', 'Imprenta (Área de Impresión)', 'Finalizado en Taller', 'Almacén de Entrega']
      const base = { id: 9001, numero_op: '000123', cliente: 'Cliente de ejemplo', dni_cuit: '20304050607', sector: 'Imprenta' }
      setOrdenes([{ ...base, estado: estados[etapa] ?? 'imprenta' } as unknown as OrdenTrabajo])
      setHistorial({
        9001: [
          { id: 1, id_orden: 9001, estado_nuevo: 'Diseño Gráfico', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
          { id: 2, id_orden: 9001, estado_nuevo: estados[etapa] ?? 'imprenta', timestamp: new Date().toISOString() }
        ] as unknown as HistorialMovimiento[]
      })
      setStep('search')
    }
    return () => {
      delete w.__consultaDemo
    }
  }, [])

  const buscarOrdenes = async (
    filtro: (orden: OrdenTrabajo) => boolean,
    mensajeError: string,
    opBuscada?: string
  ) => {
    registrarInteraccion()
    setStep('search')
    setLoading(true)
    setError(null)
    setMensaje(null)
    setOrdenes([])
    setHistorial({})

    try {
      const term = (opBuscada ?? searchOp).trim()
      const searchDigits = digitsOnly(term)
      const response =
        searchDigits.length > 0
          ? await apiService.searchOrdenesBiblioteca(searchDigits, { limit: 40 })
          : await apiService.getOrdenes()

      if (response.success && response.data) {
        const ordenesFiltradas = response.data.filter(filtro)

        if (ordenesFiltradas.length === 0) {
          setError(mensajeError)
          setLoading(false)
          return
        }

        setOrdenes(ordenesFiltradas)

        const ids = ordenesFiltradas
          .map((o) => o.id)
          .filter((id): id is number => typeof id === 'number' && id > 0)

        let histMap: Record<number, HistorialMovimiento[]> = {}
        if (ids.length === 0) {
          setHistorial({})
        } else {
          const histResponse = await apiService.getHistorialMovimientos({
            ordenIds: ids,
            limit: 800
          })
          const movimientos =
            histResponse.success && histResponse.data ? histResponse.data : []
          histMap = historialPorOrdenId(movimientos, ids)
          setHistorial(histMap)
        }

        const tieneEntradaTaller = ordenesFiltradas.some((o) => isOpFinalizadoEnTaller(o.estado))
        if (tieneEntradaTaller) {
          const op =
            opBuscada?.trim() ||
            String(ordenesFiltradas[0]?.numero_op ?? '').trim()
          navigate(`${TOTEM_FINALIZADO_TALLER_PATH}?op=${encodeURIComponent(op)}`)
          return
        }
      } else {
        setError('Error al buscar pedidos. Por favor intenta nuevamente.')
      }
    } catch (err) {
      console.error('Error buscando pedidos:', err)
      setError('Error al buscar pedidos. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const teclaOp = (d: string) => {
    registrarInteraccion()
    setError(null)
    setSearchOp((prev) => digitsOnly(prev + d).slice(0, OP_MAX_DIGITOS))
  }

  const borrarUltimoOp = () => {
    registrarInteraccion()
    setError(null)
    setSearchOp((prev) => prev.slice(0, -1))
  }

  const borrarTodoOp = () => {
    registrarInteraccion()
    setError(null)
    setSearchOp('')
  }

  const nuevaBusqueda = () => {
    registrarInteraccion()
    clearLlamadoListeners()
    setSearchOp('')
    setOrdenes([])
    setHistorial({})
    setHistorialAbierto({})
    setError(null)
    setMensaje(null)
  }

  const handleSearchOp = async () => {
    const term = searchOp.trim()
    if (!term) {
      setError('Tocá los números para escribir tu OP.')
      return
    }
    const searchDigits = digitsOnly(term)
    if (!searchDigits) {
      setError('El número de OP debe contener dígitos.')
      return
    }

    await buscarOrdenes(
      (orden) => digitsOnly(orden.numero_op ?? '') === searchDigits,
      'No encontramos un trabajo con ese número. Revisá que sea el que figura en tu comprobante.',
      term
    )
  }

  const getEstadoLabel = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    const column = BOARD_COLUMNS.find((col) => col.id === status)
    return column?.label || estado
  }

  const getEstadoColor = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    const column = BOARD_COLUMNS.find((col) => col.id === status)
    return column?.accent || '#6b7280'
  }

  const etapaDe = (estado: string): number => {
    const st = mapEstadoToStatus(estado)
    if (st === 'almacen-entrega') return 3
    if (st === 'finalizado-taller') return 2
    if (st === 'diseno-grafico' || st === 'diseno-proceso' || st === 'en-espera') return 0
    return 1
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const primerOrden = ordenes[0]

  const handleYaLlegue = async () => {
    registrarInteraccion()
    if (!primerOrden) {
      setError('Primero buscá tu trabajo para avisar que llegaste.')
      return
    }
    try {
      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: primerOrden.cliente || 'Cliente tótem',
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        orden_id: primerOrden.id,
        notas: `Cliente se registró desde tótem. Sector sugerido: ${sectorDestino}.`,
        sector_destino: sectorDestino,
        orden_numero_op: primerOrden.numero_op ?? undefined
      })
      if (!res.success) {
        setError(res.error || 'No se pudo registrar tu llegada. Avisá en mostrador.')
      } else {
        setMensaje('✅ Avisamos a mostrador que estás esperando por tu trabajo.')
      }
    } catch (err) {
      console.error('Error registrando llegada desde tótem:', err)
      setError('No se pudo registrar tu llegada. Avisá en mostrador.')
    }
  }

  const handleLlamarAsesor = async () => {
    registrarInteraccion()
    try {
      const nombre = primerOrden?.cliente || 'Cliente tótem'
      const r = await solicitarAsesorTotem({
        clienteNombre: nombre,
        numeroOp: primerOrden?.numero_op ? String(primerOrden.numero_op) : undefined,
        ordenId: primerOrden?.id,
        sectorDestino,
        contexto: `Consulta OP desde tótem. Sector sugerido: ${sectorDestino}.`
      })
      if (!r.ok) {
        setError(r.mensaje || 'No se pudo avisar a un asesor. Avisá en mostrador.')
        return
      }

      setMensaje(r.mensaje)
      clearLlamadoListeners()
      unsubAsesorEnCaminoRef.current = listenAsesorEnCamino(
        { atencionId: r.atencionId, requestNonce: r.requestNonce },
        (payload) => {
          setMensaje(`✅ ${payload.mensaje}`)
          clearLlamadoListeners()
        }
      )
    } catch (err) {
      console.error('Error llamando asesor desde tótem:', err)
      setError('No se pudo avisar a un asesor. Avisá en mostrador.')
    }
  }

  const handleAvisarQueVoy = async () => {
    registrarInteraccion()
    const sector = selectedQueHacer ? TOTEM_SECTORS_QUEHACER.find((s) => s.id === selectedQueHacer) : null
    if (!sector) return

    const nombre = avisoVoyNombre.trim()
    const motivo = avisoVoyMotivo.trim()
    if (!nombre) {
      setError('Ingresá tu nombre.')
      setMensaje(null)
      return
    }
    if (!motivo) {
      setError('Contanos el motivo de tu visita.')
      setMensaje(null)
      return
    }

    const contexto = `Cliente se dirige a ${sector.label} (desde tótem). Motivo: ${motivo}`

    try {
      setError(null)
      setMensaje(null)
      setEnviandoAvisoVoy(true)

      // Presupuestos → llamado a asesor/presupuestos; Recepción → mostrador; Diseño → diseñador.
      if (sector.id === 'presupuestos') {
        const r = await solicitarAsesorTotem({
          clienteNombre: nombre,
          sectorDestino: sector.sectorDestino,
          contexto,
          comoLlamadoPresupuesto: true
        })
        if (!r.ok) {
          setError(r.mensaje || 'No se pudo avisar a presupuestos.')
          return
        }
        setMensaje(r.mensaje)
        clearLlamadoListeners()
        unsubAsesorEnCaminoRef.current = listenAsesorEnCamino(
          { atencionId: r.atencionId, requestNonce: r.requestNonce },
          (payload) => {
            setMensaje(`✅ ${payload.mensaje}`)
            clearLlamadoListeners()
          }
        )
        return
      }

      if (sector.id === 'diseno') {
        const r = await solicitarDisenadorTotem({
          clienteNombre: nombre,
          contexto
        })
        if (!r.ok) {
          setError(r.mensaje || 'No se pudo avisar a Diseño.')
          return
        }
        setMensaje(r.mensaje)
        clearLlamadoListeners()
        unsubDisenadorEnCaminoRef.current = listenDisenadorEnCamino(
          { atencionId: r.atencionId, requestNonce: r.requestNonce },
          (payload) => {
            setMensaje(`✅ ${payload.mensaje}`)
            clearLlamadoListeners()
          }
        )
        return
      }

      const sectorDestinoAviso =
        sector.id === 'recepcion' ? 'Mostrador' : sector.sectorDestino

      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: nombre,
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        notas: contexto,
        sector_destino: sectorDestinoAviso
      })
      if (!res.success) {
        setError(res.error || 'No se pudo enviar el aviso.')
      } else {
        const destinoLabel =
          sector.id === 'recepcion' ? 'mostrador' : sector.label
        setMensaje(`✅ Avisamos a ${destinoLabel} que te dirigís hacia ahí.`)
      }
    } catch (err) {
      console.error('Error avisando desde tótem:', err)
      setError('No se pudo enviar el aviso.')
    } finally {
      setEnviandoAvisoVoy(false)
    }
  }

  const ordenesActivas = useMemo(
    () =>
      ordenes.filter(
        (o) => !isOpEnAlmacenEntrega(o.estado) && !isOpFinalizadoEnTaller(o.estado)
      ),
    [ordenes]
  )

  const ordenesListas = useMemo(
    () => ordenes.filter((o) => isOpEnAlmacenEntrega(o.estado)),
    [ordenes]
  )

  const historialUnificadoLista = useMemo(() => {
    if (ordenes.length < 2) return null
    const all: HistorialMovimiento[] = []
    for (const o of ordenes) {
      if (o.id) all.push(...(historial[o.id] ?? []))
    }
    return historialUnificadoMismoNumeroOp(all, ordenes)
  }, [ordenes, historial])

  const etiquetaSectorFicha = (idOrden: number) =>
    ordenes.find((o) => o.id === idOrden)?.sector?.trim() || `Ficha #${idOrden}`

  const mostrarTimelineUnificado =
    historialUnificadoLista !== null && historialUnificadoLista.length > 0

  const renderTimeline = (items: HistorialMovimiento[], conSector = false) => {
    if (items.length === 0) return null
    return (
      <ol className="tc2-timeline">
        {items.map((m, index) => {
          const color = getEstadoColor(m.estado_nuevo || '')
          const ultimo = index === items.length - 1
          return (
            <li key={m.id} className={`tc2-timeline__item${ultimo ? ' is-last' : ''}`} style={{ ['--c' as string]: color }}>
              <span className="tc2-timeline__dot" aria-hidden />
              <div>
                <strong>{getEstadoLabel(m.estado_nuevo || '')}</strong>
                <span>{formatDate(m.timestamp)}</span>
                {conSector && <em>{etiquetaSectorFicha(m.id_orden)}</em>}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  const renderOrden = (orden: OrdenTrabajo) => {
    const etapa = etapaDe(orden.estado)
    const lista = etapa === 3
    const abierto = Boolean(historialAbierto[orden.id])
    const ordenado = [...(historial[orden.id] || [])].sort(
      (x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime()
    )
    const dniCuit = orden.dni_cuit ? digitsOnly(orden.dni_cuit) : null
    return (
      <article key={orden.id} className={`tc2-order${lista ? ' tc2-order--ready' : ''}`}>
        {lista && (
          <div className="tc2-confetti" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} style={{ ['--i' as string]: i }} />
            ))}
          </div>
        )}
        <header className="tc2-order__head">
          <div>
            <span className="tc2-eyebrow">Orden de producción</span>
            <h3 className="tc2-op">#{orden.numero_op}</h3>
            <p className="tc2-client">
              {orden.cliente}
              {dniCuit ? <span> · DNI/CUIT {dniCuit}</span> : null}
            </p>
          </div>
          <span className="tc2-badge" style={{ ['--c' as string]: getEstadoColor(orden.estado) }}>
            {getEstadoLabel(orden.estado)}
          </span>
        </header>
        <p className="tc2-order__msg">{MENSAJE_ETAPA[etapa]}</p>
        {lista && <p className="tc2-order__sub">Acercate a mostrador con tu número de OP.</p>}
        <ol className="tc2-steps" aria-label="Avance de tu pedido">
          {ETAPAS.map((label, i) => (
            <li key={label} className={i < etapa ? 'is-done' : i === etapa ? 'is-current' : ''}>
              <span className="tc2-steps__dot">{i < etapa ? '✓' : i + 1}</span>
              <span className="tc2-steps__label">{label}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="tc2-link"
          onClick={() => {
            registrarInteraccion()
            setHistorialAbierto((p) => ({ ...p, [orden.id]: !p[orden.id] }))
          }}
        >
          {abierto ? 'Ocultar historial' : 'Ver historial del trabajo'}
        </button>
        {abierto &&
          (mostrarTimelineUnificado ? (
            <p className="tc2-note">
              Parte del pedido en <strong>{orden.sector?.trim() || 'este sector'}</strong>. El recorrido completo está abajo.
            </p>
          ) : (
            renderTimeline(ordenado)
          ))}
      </article>
    )
  }

  return (
    <div
      ref={pageRef}
      className={`cliente-consulta-page totem-consulta-page${isFullscreen ? ' totem-consulta-page--fs' : ''}`}
      onClick={() => {
        if (step === 'idle') {
          setStep('welcome')
        }
        registrarInteraccionKiosk()
      }}
      onKeyDown={registrarInteraccion}
    >
      <div className={`tc2-shell tc2-step-${step}`}>
        {step === 'idle' && (
          <div className="tc2-screen tc2-idle">
            <div className="tc2-idle__rings" aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <div className="tc2-idle__logo">
              <img src="/plot-lab-logo.png" alt="Plot Center" />
            </div>
            <p className="tc2-eyebrow">Plot Center · Autogestión</p>
            <h1 className="tc2-idle__title">Bienvenido</h1>
            <p className="tc2-idle__sub">Impresión · Diseño · Comunicación visual</p>

            <div className="tc2-tips" aria-live="polite">
              {TIPS.map((tip, i) => (
                <div key={tip.text} className={`tc2-tip${i === tipIdx ? ' is-on' : ''}`} aria-hidden={i !== tipIdx}>
                  <span className="tc2-tip__ico">
                    <TotemKioskIcon name={tip.icon} size="tile" />
                  </span>
                  <span className="tc2-tip__text">{tip.text}</span>
                </div>
              ))}
              <div className="tc2-tips__dots" aria-hidden>
                {TIPS.map((tip, i) => (
                  <i key={tip.text} className={i === tipIdx ? 'is-on' : ''} />
                ))}
              </div>
            </div>

            <div className="tc2-touch">
              <span className="tc2-touch__pulse" aria-hidden />
              <span>Tocá la pantalla para comenzar</span>
            </div>

            <div className="tc2-hours">
              <span className="tc2-hours__title">Horarios de atención</span>
              <span>
                <b>Lun – Vie</b> 6:00 – 22:00 hs
              </span>
              <span>
                <b>Sábado</b> 9:00 – 18:00 hs
              </span>
            </div>
          </div>
        )}

        {step === 'welcome' && (
          <div
            className="tc2-screen tc2-welcome totem-welcome-screen"
            onPointerDownCapture={registrarInteraccion}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="tc2-topbar">
              <div className="tc2-brand">
                <div className="tc2-logo">
                  <img src="/plot-lab-logo.png" alt="Plot Center" />
                </div>
                <div>
                  <p className="tc2-eyebrow">Plot Center · Autogestión</p>
                  <h1 className="tc2-h1">¿Qué necesitás hoy?</h1>
                </div>
              </div>
              <button
                type="button"
                className="tc2-ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleFullscreen()
                }}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? 'Salir de pantalla grande' : 'Pantalla grande'}
              </button>
            </header>

            <div className="tc2-welcome__grid totem-welcome-grid">
              <div className="tc2-welcome__main totem-welcome-main">
                <div className="tc2-actions">
                  <button
                    className="tc2-action tc2-action--orange"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      registrarInteraccionKiosk()
                      setStep('search')
                    }}
                  >
                    <span className="tc2-action__ico" aria-hidden>
                      <TotemKioskIcon name="search" size="tile" />
                    </span>
                    <span className="tc2-action__title">Buscar mi trabajo</span>
                    <span className="tc2-action__desc">Mirá en qué estado está tu pedido</span>
                    <span className="tc2-action__go" aria-hidden>Tocá acá →</span>
                  </button>
                  <button
                    className="tc2-action tc2-action--blue"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      registrarInteraccionKiosk()
                      navigate('/totem/autogestion/imprimir')
                    }}
                  >
                    <span className="tc2-action__ico" aria-hidden>
                      <TotemKioskIcon name="print" size="tile" />
                    </span>
                    <span className="tc2-action__title">Imprimir</span>
                    <span className="tc2-action__desc">Fotos, documentos y más</span>
                    <span className="tc2-action__go" aria-hidden>Tocá acá →</span>
                  </button>
                  <button
                    className="tc2-action tc2-action--green"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      registrarInteraccionKiosk()
                      navigate('/totem/autogestion/catalogo', {
                        state: { returnTo: '/totem/consulta-cliente' }
                      })
                    }}
                  >
                    <span className="tc2-action__ico" aria-hidden>
                      <TotemKioskIcon name="catalog" size="tile" />
                    </span>
                    <span className="tc2-action__title">Comprar</span>
                    <span className="tc2-action__desc">Elegí productos del catálogo</span>
                    <span className="tc2-action__go" aria-hidden>Tocá acá →</span>
                  </button>
                </div>

                <section className="tc2-where">
                  <header className="tc2-where__head">
                    <h2 className="tc2-where__title">¿Hacia dónde te dirigís?</h2>
                    <p className="tc2-where__sub">Tocá tu destino y te mostramos cómo llegar</p>
                  </header>
                  <div className="tc2-where__list">
                    {TOTEM_SECTORS_QUEHACER.map((sector) => (
                      <button
                        key={sector.id}
                        type="button"
                        className={`tc2-sign tc2-sign--${sector.direction}`}
                        style={{ ['--bg' as string]: sector.bg, ['--fg' as string]: sector.textColor }}
                        onClick={() => {
                          registrarInteraccion()
                          setSelectedQueHacer(sector.id)
                          setError(null)
                          setMensaje(null)
                          setAvisoVoyNombre('')
                          setAvisoVoyMotivo('')
                        }}
                      >
                        <span className="tc2-sign__ico" aria-hidden>
                          <TotemKioskIcon name={sector.icon} size="strip" />
                        </span>
                        <span className="tc2-sign__text">
                          <strong>{sector.label}</strong>
                          <small>{DIRECCION_TEXTO[sector.direction]}</small>
                        </span>
                        {sector.direction === 'primer-piso' && <span className="tc2-sign__floor">1° piso</span>}
                        <span className="tc2-sign__arrow" aria-hidden>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
                          </svg>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="totem-welcome-aside">
                <div className="totem-consulta-chat-block totem-consulta-chat-block--compact totem-kiosk-panel totem-consulta-chat-block--hero">
                  <div className="totem-chat-hero-head">
                    <span className="totem-chat-hero-badge" aria-hidden>
                      AI
                    </span>
                    <div className="totem-chat-hero-copy">
                      <h2 className="totem-senaletica-title totem-chat-hero-title">¿Qué servicios ofrecemos?</h2>
                      <p className="totem-chat-hero-sub">Preguntale a PlotAI · tocá y escribí</p>
                    </div>
                  </div>
                  <TotemAutogestionPlotAiChat
                    className="totem-consulta-plotai"
                    compact
                    modo="totem_consulta_cliente"
                    conversationStorageKey="plotrello_totem_consulta_cliente_plotai_conv"
                    emptyHint="Ej: ¿Hacen vinilos? ¿Horarios?"
                  />
                </div>
              </aside>
            </div>

              {selectedQueHacer && (() => {
                const sector = TOTEM_SECTORS_QUEHACER.find((s) => s.id === selectedQueHacer)
                if (!sector) return null
                return (
                  <div
                    className="totem-direccion-modal-overlay totem-modal-overlay-enter"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        registrarInteraccion()
                        setSelectedQueHacer(null)
                        setMensaje(null)
                        setError(null)
                        setAvisoVoyNombre('')
                        setAvisoVoyMotivo('')
                      }
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="totem-modal-title"
                  >
                    <div className="totem-direccion-modal totem-modal-enter" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="totem-direccion-modal-close"
                        onClick={() => {
                          registrarInteraccion()
                          setSelectedQueHacer(null)
                          setMensaje(null)
                          setError(null)
                          setAvisoVoyNombre('')
                          setAvisoVoyMotivo('')
                        }}
                        aria-label="Cerrar"
                      >
                        ×
                      </button>
                      <div className="totem-direccion-modal-content">
                        <p className="totem-direccion-modal-leyenda" id="totem-modal-title">
                          Dirigite por la franja
                        </p>
                        <div
                          className={`totem-direccion-strip-grande totem-modal-strip${sector.direction === 'primer-piso' ? ' totem-modal-strip--upstairs' : ''}`}
                          style={{ backgroundColor: sector.bg, color: sector.textColor }}
                        >
                          <span className="totem-direccion-strip-text">{sector.label}</span>
                          <SectorDirectionArrows direction={sector.direction} />
                        </div>
                        <p className="totem-direccion-modal-seguir">
                          {sector.direction === 'primer-piso'
                            ? 'Subí al 1° piso por las escaleras y seguí las flechas en el piso hasta llegar a tu destino.'
                            : sector.direction === 'adelante'
                              ? 'Seguí las flechas hacia adelante hasta llegar a tu destino.'
                              : 'Seguí las flechas hacia abajo hasta llegar a tu destino.'}
                        </p>
                        {sector.id === 'diseno' && (
                          <div className="totem-direccion-diseno-cta">
                            <button
                              type="button"
                              className="totem-cta-button"
                              onClick={() => {
                                registrarInteraccion()
                                navigate('/totem/diseno')
                              }}
                            >
                              ✨ Ir al tótem de Diseño · armar brief
                            </button>
                            <p className="totem-direccion-diseno-cta-hint">
                              En el 1° piso también podés completar el brief, ver mockup e imagen con IA.
                            </p>
                          </div>
                        )}
                        <div className="totem-direccion-aviso-form">
                          <div className="totem-direccion-field">
                            <label htmlFor="totem-aviso-nombre">Tu nombre</label>
                            <input
                              id="totem-aviso-nombre"
                              type="text"
                              className="dni-input totem-input totem-direccion-input"
                              value={avisoVoyNombre}
                              onChange={(e) => {
                                registrarInteraccion()
                                setAvisoVoyNombre(e.target.value)
                              }}
                              placeholder="Nombre y apellido"
                              autoComplete="name"
                              disabled={enviandoAvisoVoy}
                            />
                          </div>
                          <div className="totem-direccion-field">
                            <label htmlFor="totem-aviso-motivo">Motivo de la visita</label>
                            <textarea
                              id="totem-aviso-motivo"
                              className="dni-input totem-input totem-direccion-textarea"
                              value={avisoVoyMotivo}
                              onChange={(e) => {
                                registrarInteraccion()
                                setAvisoVoyMotivo(e.target.value)
                              }}
                              placeholder="Ej: retirar un pedido, consultar un presupuesto…"
                              rows={3}
                              disabled={enviandoAvisoVoy}
                            />
                          </div>
                        </div>
                        <div className="totem-direccion-actions">
                          <button
                            type="button"
                            className="totem-cta-button totem-cta-small secondary"
                            onClick={() => {
                              registrarInteraccion()
                              setSelectedQueHacer(null)
                              setMensaje(null)
                              setError(null)
                              setAvisoVoyNombre('')
                              setAvisoVoyMotivo('')
                            }}
                          >
                            ← Volver
                          </button>
                          <button
                            type="button"
                            className="totem-cta-button totem-cta-small"
                            onClick={handleAvisarQueVoy}
                            disabled={enviandoAvisoVoy}
                          >
                            {enviandoAvisoVoy ? 'Enviando…' : 'Avisar que voy'}
                          </button>
                        </div>
                        {mensaje && (
                          <div className="totem-message totem-direccion-message">{mensaje}</div>
                        )}
                        {error && (
                          <div className="totem-error totem-direccion-error">{error}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
          </div>
        )}

        {step === 'search' && (
          <div
            className="tc2-screen tc2-search"
            onPointerDownCapture={registrarInteraccion}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="tc2-topbar">
              <button
                type="button"
                className="tc2-back"
                onClick={ordenes.length > 0 ? nuevaBusqueda : volverAWelcome}
              >
                {ordenes.length > 0 ? '← Buscar otro trabajo' : '← Volver al inicio'}
              </button>
              <div className="tc2-topbar__title">
                <h1 className="tc2-h1">
                  {ordenes.length === 0
                    ? 'Buscá tu trabajo'
                    : ordenes.length === 1
                      ? 'Tu trabajo'
                      : `Tus trabajos (${ordenes.length})`}
                </h1>
                {ordenes.length === 0 && <p>Escribí tu número de OP y te mostramos cómo va.</p>}
              </div>
              <div className="tc2-logo">
                <img src="/plot-lab-logo.png" alt="Plot Center" />
              </div>
            </header>

            {ordenes.length === 0 ? (
              <div className="tc2-search__grid">
                <section className="tc2-card tc2-keypad-card">
                  <span className="tc2-eyebrow">Tu número de OP</span>
                  <div
                    className={`tc2-display${error ? ' tc2-display--error' : ''}`}
                    role="status"
                    aria-live="polite"
                  >
                    {searchOp ? (
                      <span className="tc2-display__value">{searchOp}</span>
                    ) : (
                      <span className="tc2-display__ph">Ej: 000123</span>
                    )}
                    <i className="tc2-caret" aria-hidden />
                  </div>
                  {error ? (
                    <p className="tc2-alert" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p className="tc2-hint">Tocá los números para escribirlo</p>
                  )}
                  <div className="tc2-keypad" role="group" aria-label="Teclado numérico">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                      <button key={k} type="button" className="tc2-key" onClick={() => teclaOp(k)} disabled={loading}>
                        {k}
                      </button>
                    ))}
                    <button type="button" className="tc2-key tc2-key--soft" onClick={borrarTodoOp} disabled={loading}>
                      Borrar todo
                    </button>
                    <button type="button" className="tc2-key" onClick={() => teclaOp('0')} disabled={loading}>
                      0
                    </button>
                    <button
                      type="button"
                      className="tc2-key tc2-key--soft"
                      onClick={borrarUltimoOp}
                      disabled={loading}
                      aria-label="Borrar el último número"
                    >
                      ⌫
                    </button>
                  </div>
                  <button
                    type="button"
                    className="tc2-cta"
                    onClick={handleSearchOp}
                    disabled={loading || !searchOp.trim()}
                  >
                    {loading ? 'Buscando tu trabajo…' : 'Buscar mi trabajo'}
                  </button>
                </section>

                <aside className="tc2-card tc2-help">
                  <h2 className="tc2-help__title">¿Dónde está mi número de OP?</h2>
                  <div className="tc2-ticket" aria-hidden>
                    <div className="tc2-ticket__brand">PLOT CENTER</div>
                    <div className="tc2-ticket__line" />
                    <div className="tc2-ticket__line tc2-ticket__line--short" />
                    <div className="tc2-ticket__op">
                      <span>OP</span>
                      <b>N° 000123</b>
                    </div>
                    <div className="tc2-ticket__qr">
                      {Array.from({ length: 49 }).map((_, i) => (
                        <i key={i} className={(i * 7 + (i % 5)) % 3 === 0 ? 'on' : ''} />
                      ))}
                    </div>
                  </div>
                  <p className="tc2-help__text">
                    Es el número que figura en tu <strong>comprobante</strong>. Si no lo encontrás,
                    acercate a <strong>mostrador</strong>.
                  </p>
                </aside>
              </div>
            ) : (
              <div className="tc2-results">
                {ordenesListas.length > 0 && (
                  <section className="tc2-group">
                    <h2 className="tc2-group__title">Listos para retirar</h2>
                    {ordenesListas.map(renderOrden)}
                  </section>
                )}
                {ordenesActivas.length > 0 && (
                  <section className="tc2-group">
                    <h2 className="tc2-group__title">En proceso</h2>
                    {ordenesActivas.map(renderOrden)}
                  </section>
                )}

                {mostrarTimelineUnificado && historialUnificadoLista && (
                  <section className="tc2-card">
                    <h2 className="tc2-group__title">Recorrido completo de la orden</h2>
                    <p className="tc2-note">
                      Hay {ordenes.length} fichas con el mismo número de OP. Estos son todos los pasos en orden de
                      fecha y el sector de cada uno.
                    </p>
                    {renderTimeline(historialUnificadoLista, true)}
                  </section>
                )}

                <section className="tc2-card tc2-arrived">
                  <h2 className="tc2-group__title">¿Ya estás acá?</h2>
                  <div className="tc2-chips" role="group" aria-label="¿Para qué sector venís?">
                    <span className="tc2-chips__label">¿Para qué sector venís?</span>
                    {['Mostrador', 'Diseño', 'Instalaciones', 'Caja'].map((sector) => (
                      <button
                        key={sector}
                        type="button"
                        className={`tc2-chip${sectorDestino === sector ? ' is-on' : ''}`}
                        onClick={() => {
                          registrarInteraccion()
                          setSectorDestino(sector)
                        }}
                      >
                        {sector}
                      </button>
                    ))}
                  </div>
                  <div className="tc2-cta-row">
                    <button type="button" className="tc2-cta" onClick={handleYaLlegue}>
                      Ya llegué, estoy esperando
                    </button>
                    <button type="button" className="tc2-cta tc2-cta--secondary" onClick={handleLlamarAsesor}>
                      Llamar a un asesor
                    </button>
                  </div>
                  {mensaje && (
                    <p className="tc2-success" role="status">
                      {mensaje}
                    </p>
                  )}
                  {error && (
                    <p className="tc2-alert" role="alert">
                      {error}
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        )}

        {step !== 'idle' && (
          <footer className="tc2-footer">
            <span className="tc2-footer__dot" aria-hidden />
            <span>
              Si tenés dudas, acercate a <strong>mostrador</strong> con tu número de <strong>OP</strong>.
            </span>
          </footer>
        )}
      </div>
    </div>
  )
}

export default TotemConsultaClientePage
