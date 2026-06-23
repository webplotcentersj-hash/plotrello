import { BOARD_COLUMNS } from '../data/mockData'
import {
  getArgentinaDateString,
  formatArgentinaDateOnly,
  instanteArgentinaDentroFranjaHorariaReserva,
  legajoCalendarDateKey,
  normalizeTimeHHMMSS,
  timeStringToSecondsSinceMidnight
} from '../utils/dateUtils'
import { puedeFinalizarViajeFlota } from '../utils/flotaPermisos'
import { matchesOperarioAsignado } from '../utils/operarioAsignadoUtils'
import { stripPayloadForEspejoGrupo } from '../utils/opEspejoSectores'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import { applyOrdenRestartLocally } from '../utils/ordenLocalSync'
import {
  agingDesdeItems,
  enriquecerVentasCcResumenes,
  resumenPorCliente,
  resumenPorVendedor,
  ventasCcAbiertasDesdeVentas
} from '../utils/cuentaCorrienteCobranzas'
import type {
  AltaCuentaCorrientePayload,
  CcCobranzasPanelData,
  CcCuentaMovimiento,
  CcInteresesDevengados,
  CcPerfilCliente,
  CcPerfilResumen,
  CcVentaResumen,
  ClienteCuentaCorrienteRecord,
  ClienteRecord,
  FichaHistorialItem,
  HistorialMovimiento,
  HistorialEtapaTallerGrafico,
  HistorialEtapaInstalaciones,
  HistorialEtapaTallerImprenta,
  HistorialEtapaMetalurgica,
  MaterialRecord,
  Notification,
  OrdenTrabajo,
  OrdenSeguimientoPublico,
  OrdenLineaM2,
  ImpresoraUsoReportFila,
  OrdenRelevamientoRecord,
  RelevamientoSubitemRecord,
  SectorRecord,
  TareaSubitem,
  TareaRecord,
  UsuarioRecord,
  UsuarioBajaLog,
  RrhhBajaAdjunto,
  RrhhEventoLaboral,
  RrhhEventoLaboralTipo,
  UserRole,
  LegajoEmpleado,
  FechaPlotHoyItem,
  ClienteWebRecord,
  ArticuloEmpresaRecord,
  ArticuloEmpresaImagenRecord,
  CamposComercioArticuloEmpresa,
  CanalComercialCatalogo,
  PedidoClienteRecord,
  PedidoClienteDetalle,
  MensajePedidoClienteRecord,
  PresupuestoClienteRecord,
  PresupuestoClienteItemRecord,
  PresupuestoVentaRecord,
  PresupuestoVentaItemRecord,
  ActaSectorRecord,
  TipoNovedad,
  HorarioEmpleado,
  Turno,
  Ausencia,
  Asistencia,
  RrhhRelojReporteSemanal,
  SolicitudPermiso,
  RrhhNovedad,
  RrhhNovedadAdjunto,
  RrhhNovedadGrupo,
  RrhhPostulacion,
  RrhhPostulacionEstado,
  Evaluacion,
  CriterioEvaluacion,
  Capacitacion,
  InscripcionCapacitacion,
  MenuDiario,
  MenuSeleccion,
  MenuDescuentoBeneficioComida,
  MenuDescuentoBeneficioResumen,
  MenuIntercambioTurno,
  Vehiculo,
  VehiculoEstadoParque,
  RegistroSalidaVehiculo,
  ReservaVehiculoFlota,
  CitaAsesorTecnico,
  ProtocoloBaseRecord,
  PruebaPreguntaInput,
  PruebaAsignacionColaborador
  // Types used in function signatures and return types
  // OportunidadVenta,
  // Venta,
  // SeguimientoVenta
} from '../types/api'
import type {
  PedidoCompra,
  PedidoCompraComentario,
  StockMovimiento,
  ArticuloStock,
  EstadoPedido,
  PrioridadPedido,
  Proveedor,
  ProveedorProducto,
  Presupuesto,
  PrecioHistorial,
  ComparacionPresupuestos,
  EstadoPresupuesto,
  Pago,
  MovimientoBancario,
  ConciliacionBancaria,
  ConciliacionPlotAIReporte,
  EstadoPago
} from '../types/pedidos'
import type { ConciliacionMpAiRun, ConciliacionMpSession } from '../types/conciliacionMp'
import { supabase, stockSupabase } from './supabaseClient'
import {
  aplicarStockDesdePedidoCliente,
  COLUMNA_VISIBILIDAD_POR_CANAL,
  descontarStockComercial,
  obtenerStockArticulo,
  type CanalComercial
} from './commerceStockService'
import { validarCantidadVentaComercial } from './commerceCatalogService'
import {
  obtenerCarritoCliente,
  setCarritoItemCliente,
  vaciarCarritoCliente,
  type CarritoClientePayload
} from './commerceCartService'
import {
  TALLER_GRAFICO_PEDIDO_ENTREGA_CHANNEL,
  TALLER_GRAFICO_PEDIDO_ENTREGA_EVENT,
  type TallerGraficoPedidoEntregaInput
} from '../constants/tallerGraficoPedidoEntrega'

import { formatSupabaseStatementTimeoutError } from '../utils/supabaseErrors'

export { formatSupabaseStatementTimeoutError }

/** Columnas para listado del tablero (sin `*` ni JSON pesado). */
const ORDENES_TABLERO_SELECT =
  'id,numero_op,cliente,descripcion,estado,sector,sector_inicial,sectores,prioridad,complejidad,operario_asignado,nombre_creador,usuario_trabajando_nombre,etiquetas,materiales,fecha_creacion,fecha_entrega,fecha_ingreso,entregado,eliminada,visible_en_tablero,motivo_eliminacion,fecha_eliminacion,es_duplicado,id_orden_original,foto_url,telefono_cliente,email_cliente,direccion_cliente,whatsapp_link,ubicacion_link,drive_link,op_bloqueada,espejo_sectores_op,dni_cuit,metros_cuadrados,tipo_impresion,es_ficha_no_op,en_reclamo,ubicacion_final,numero_ficha_original,planilla_preliminar,ficha_tecnica_pdf_url,ficha_tecnica_cargada,ficha_tecnica_incompleta,presupuesto_enviado_cliente,presupuesto_armado,presupuesto_en_espera'

const ORDENES_TABLERO_LIMIT = 800
/** Páginas para biblioteca (catálogo completo bajo demanda; no usa orden_lineas_m2). */
const ORDENES_BIBLIOTECA_PAGE_SIZE = 400
const ORDENES_BIBLIOTECA_SEARCH_LIMIT = 50
const ORDENES_FETCH_TIMEOUT_MS = 25_000

function normalizeOrdenListRow(orden: Record<string, unknown>): OrdenTrabajo {
  return {
    ...(orden as unknown as OrdenTrabajo),
    foto_url: (orden.foto_url as string | null) || null,
    telefono_cliente: (orden.telefono_cliente as string | null) || null,
    email_cliente: (orden.email_cliente as string | null) || null,
    direccion_cliente: (orden.direccion_cliente as string | null) || null,
    whatsapp_link: (orden.whatsapp_link as string | null) || null,
    ubicacion_link: (orden.ubicacion_link as string | null) || null,
    drive_link: (orden.drive_link as string | null) || null
  }
}

function withQueryTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label}: tardó más de ${ORDENES_FETCH_TIMEOUT_MS / 1000}s`))
    }, ORDENES_FETCH_TIMEOUT_MS)
    Promise.resolve(promise)
      .then((v) => {
        window.clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        window.clearTimeout(timer)
        reject(e)
      })
  })
}

/** Anexa `orden_lineas_m2` a cada orden (si la tabla existe en Supabase). Consultas en paralelo por chunks. */
async function attachLineasM2ToOrdenes(ordenes: any[]): Promise<void> {
  if (!supabase || ordenes.length === 0) return
  const sb = supabase
  const ids = ordenes.map((o) => o.id).filter((id: unknown) => typeof id === 'number')
  if (ids.length === 0) return
  const CHUNK = 180
  const PARALLEL = 4
  const slices: number[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    slices.push(ids.slice(i, i + CHUNK))
  }
  try {
    const map = new Map<number, OrdenLineaM2[]>()
    for (let i = 0; i < slices.length; i += PARALLEL) {
      const group = slices.slice(i, i + PARALLEL)
      const results = await Promise.all(
        group.map((slice) =>
          sb
            .from('orden_lineas_m2')
            .select('id, id_orden, tipo, metros_cuadrados, sort_order, created_at')
            .in('id_orden', slice)
            .order('sort_order', { ascending: true })
        )
      )
      for (const { data: allLineas, error } of results) {
        if (error) {
          console.warn('[attachLineasM2ToOrdenes]', error.message)
          continue
        }
        if (!allLineas) continue
        for (const row of allLineas as OrdenLineaM2[]) {
          const list = map.get(row.id_orden) ?? []
          list.push(row)
          map.set(row.id_orden, list)
        }
      }
    }
    for (const o of ordenes) {
      o.orden_lineas_m2 = map.get(o.id) ?? []
    }
  } catch (e) {
    console.warn('[attachLineasM2ToOrdenes]', e)
  }
}

/**
 * PostgREST cuando `ordenes_trabajo.eliminada` no existe (patch no aplicado en Supabase).
 * Ejecutar: supabase/patches/2026-04-27_ordenes_soft_delete_eliminada.sql
 */
function isMissingElEliminadaColumnError(msg: string | null | undefined): boolean {
  if (!msg) return false
  const m = msg.toLowerCase()
  return (
    m.includes('eliminada') &&
    (m.includes('schema cache') || m.includes('could not find') || m.includes('does not exist'))
  )
}

const LEGACY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const hasLegacyBackend = Boolean(LEGACY_API_BASE_URL)

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

type ReaccionesMap = Record<string, number[]>

type ChatMessageUI = {
  id: number
  canal: string
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  tipo: 'message' | 'alert' | 'buzz'
  timestamp: string
  archivos_urls?: string[]
  reply_to_id?: number | null
  reacciones?: ReaccionesMap
  estado_entrega?: 'sent' | 'read'
}

const fallbackOrdenes: OrdenTrabajo[] = []

const fallbackHistorial: HistorialMovimiento[] = []

const fallbackUsuarios: UsuarioRecord[] = []

const fallbackSectores: SectorRecord[] = BOARD_COLUMNS.map((col, index) => ({
  id: index + 1,
  nombre: col.label,
  color: col.accent
}))

const fallbackMateriales: MaterialRecord[] = []

const fallbackMensajes: ChatMessageUI[] = []

// Mapeo de canales a room_id - cada canal tiene su propio room
const chatChannelToRoom: Record<string, number> = {
  'general': 1,
  'diseno': 2,
  'recursos-humanos': 3,
  'metalurgica': 4,
  'mostrador': 5,
  'taller-grafico': 6,
  'random': 7
}

// Mapeo inverso: room_id -> canal
const roomToChatChannel: Record<number, string> = {
  1: 'general',
  2: 'diseno',
  3: 'recursos-humanos',
  4: 'metalurgica',
  5: 'mostrador',
  6: 'taller-grafico',
  7: 'random'
}

/** `dm:<id>` = sala 1:1 en `chat_rooms` (id numérico). Canales sin prefijo = chat grupal. */
function roomIdFromCanal(canal: string): number {
  const dm = /^dm:(\d+)$/.exec(String(canal).trim())
  if (dm) {
    const id = Number(dm[1])
    if (Number.isFinite(id)) return id
  }
  return chatChannelToRoom[canal] ?? 1
}

/** Iguala URLs de adjuntos aunque difieran en ?query (público vs firmado) o espacios. */
function normalizeAdjuntoUrlForMatch(url: string): string {
  const s = String(url ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    u.search = ''
    return u.toString()
  } catch {
    const q = s.indexOf('?')
    return q === -1 ? s : s.slice(0, q)
  }
}

/** Rango inclusive para `hora_salida` (timestamptz) desde inputs `type="date"` (día local). */
function flotaFechaDesdeInclusiveIso(fechaDesde: string): string {
  const [y, m, d] = fechaDesde.split('-').map(Number)
  if (!y || !m || !d) return `${fechaDesde}T00:00:00.000Z`
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

function flotaFechaHastaInclusiveIso(fechaHasta: string): string {
  const [y, m, d] = fechaHasta.split('-').map(Number)
  if (!y || !m || !d) return `${fechaHasta}T23:59:59.999Z`
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}

function supabaseErrorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  if (e instanceof Error) return e.message
  return fallback
}

class ApiService {
  /** Evita disparar varias lecturas completas del tablero a la vez (timeout en Supabase). */
  private getOrdenesInFlight: Promise<ApiResponse<OrdenTrabajo[]>> | null = null
  private getOrdenesBibliotecaInFlight: Promise<ApiResponse<OrdenTrabajo[]>> | null = null

  // Helper para obtener usuario actual desde localStorage
  private getCurrentUser(): { id: number; nombre: string } {
    const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
    let nombreUsuario = 'Usuario'
    try {
      const raw = localStorage.getItem('usuario')
      if (raw) {
        const p = JSON.parse(raw) as { nombre?: unknown }
        if (typeof p?.nombre === 'string' && p.nombre.trim()) {
          nombreUsuario = p.nombre.trim()
        }
      }
    } catch {
      /* JSON corrupto o storage raro: no romper crear/mover ficha ni historial */
    }
    // Nunca devolver 0 para evitar FK en historial_movimientos
    return { id: usuarioId || 1, nombre: nombreUsuario }
  }

  private getCurrentUserWithRol(): { id: number; nombre: string; rol: string | null } {
    const base = this.getCurrentUser()
    let rol: string | null = null
    try {
      const raw = localStorage.getItem('usuario')
      if (raw) rol = JSON.parse(raw).rol ?? null
    } catch {
      /* ignore */
    }
    return { ...base, rol }
  }

  private isAdminOrGerenciaRole(): boolean {
    const r = this.getCurrentUserWithRol().rol
    return r === 'administracion' || r === 'gerencia'
  }

  /**
   * OP trabada: no se edita ni mueve salvo admin/gerencia o destaque (solo `op_bloqueada: false`) por el operario asignado.
   */
  private evaluateOrdenOpLock(
    ordenRow: { op_bloqueada?: boolean | null; operario_asignado?: string | null } | null | undefined,
    ordenPatch: Partial<OrdenTrabajo>
  ): { ok: true } | { ok: false; error: string } {
    const locked = !!ordenRow?.op_bloqueada
    const u = this.getCurrentUserWithRol()
    const assignee = matchesOperarioAsignado(u, ordenRow?.operario_asignado ?? null)
    const admin = this.isAdminOrGerenciaRole()

    const definedKeys = Object.keys(ordenPatch).filter(
      (k) => ordenPatch[k as keyof OrdenTrabajo] !== undefined
    )

    if (!locked) {
      const onlyLockOn =
        definedKeys.length === 1 &&
        definedKeys[0] === 'op_bloqueada' &&
        ordenPatch.op_bloqueada === true
      if (onlyLockOn && !assignee && !admin) {
        return {
          ok: false,
          error: 'Solo el operario asignado o administración/gerencia puede trabar esta OP.'
        }
      }
      return { ok: true }
    }

    if (admin) return { ok: true }

    const onlyFotoUrl =
      definedKeys.length === 1 &&
      definedKeys[0] === 'foto_url'
    if (onlyFotoUrl && assignee) return { ok: true }

    const onlyUnlock =
      definedKeys.length === 1 &&
      definedKeys[0] === 'op_bloqueada' &&
      ordenPatch.op_bloqueada === false
    if (onlyUnlock && assignee) return { ok: true }
    if (onlyUnlock && !assignee) {
      return {
        ok: false,
        error:
          'Solo el operario asignado puede destabar esta OP (administración/gerencia también puede editarla).'
      }
    }

    return {
      ok: false,
      error:
        'Esta OP está trabada: no se puede editar ni mover hasta que el operario asignado la destabe (administración/gerencia puede hacerlo).'
    }
  }

  private async assertOpNotLockedForMutation(ordenId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!supabase) return { ok: true }
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('op_bloqueada, operario_asignado')
      .eq('id', ordenId)
      .maybeSingle()

    if (error) {
      if (/op_bloqueada|column/i.test(String(error.message))) return { ok: true }
      return { ok: false, error: error.message }
    }
    const row = data as { op_bloqueada?: boolean | null; operario_asignado?: string | null } | null
    if (!row?.op_bloqueada) return { ok: true }
    if (this.isAdminOrGerenciaRole()) return { ok: true }
    return {
      ok: false,
      error:
        'Esta OP está trabada: no se puede modificar hasta que el operario asignado la destabe (administración/gerencia puede hacerlo).'
    }
  }

  // Helper para registrar cambios en historial_movimientos (AUDITORÍA PROFESIONAL)
  /** Objeto seguro para jsonb (evita fallos RPC por referencias circulares). */
  private sanitizeHistorialDetalles(
    cambiosDetallados?: Record<string, any>
  ): Record<string, unknown> {
    if (!cambiosDetallados || typeof cambiosDetallados !== 'object') return {}
    try {
      return JSON.parse(JSON.stringify(cambiosDetallados)) as Record<string, unknown>
    } catch {
      return { _note: 'cambios_detallados no serializables' }
    }
  }

  private async registrarCambioHistorial(
    idOrden: number,
    estadoAnterior: string | null,
    estadoNuevo: string | null,
    comentario?: string,
    accionTipo: string = 'actualizacion',
    cambiosDetallados?: Record<string, any>
  ): Promise<void> {
    if (!supabase) return

    const { id: usuarioId, nombre: nombreUsuario } = this.getCurrentUser()
    const detalles = this.sanitizeHistorialDetalles(cambiosDetallados)

    // Intentar usar la función SQL que es más robusta
    try {
      const { error } = await supabase.rpc('registrar_cambio_manual_v2', {
        p_id_orden: idOrden,
        p_id_usuario: usuarioId || 0,
        p_nombre_usuario: nombreUsuario,
        p_estado_anterior: estadoAnterior,
        p_estado_nuevo: estadoNuevo,
        p_comentario: comentario || null,
        p_accion_tipo: accionTipo,
        p_cambios_detallados: detalles as any,
        p_ip_address: null, // Se puede obtener desde el cliente si es necesario
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      })

      if (error) {
        // Si falla la función RPC, intentar insert directo como fallback
        console.warn('Error en registrar_cambio_manual, usando fallback:', error)
        const { error: insErr } = await supabase.from('historial_movimientos').insert({
          id_orden: idOrden,
          estado_anterior: estadoAnterior,
          estado_nuevo: estadoNuevo,
          id_usuario: usuarioId || 0,
          nombre_usuario: nombreUsuario,
          timestamp: new Date().toISOString(),
          comentario: comentario || null,
          accion_tipo: accionTipo,
          cambios_detallados: detalles as any,
          metadata: {
            registrado_manual: true,
            timestamp_preciso: Date.now() / 1000,
            version_sistema: '2.0'
          }
        })
        if (insErr) {
          console.warn('historial_movimientos insert fallback:', insErr.message)
        }
      }
    } catch (error) {
      // Fallback final: insert directo
      console.error('Error crítico registrando cambio en historial:', error)
      try {
        const { error: insErr2 } = await supabase.from('historial_movimientos').insert({
          id_orden: idOrden,
          estado_anterior: estadoAnterior,
          estado_nuevo: estadoNuevo,
          id_usuario: usuarioId || 0,
          nombre_usuario: nombreUsuario,
          timestamp: new Date().toISOString(),
          comentario: comentario || null,
          accion_tipo: accionTipo
        })
        if (insErr2) {
          console.warn('historial_movimientos insert mínimo:', insErr2.message)
        }
      } catch (fallbackError) {
        console.error('Error crítico en fallback de historial:', fallbackError)
        // En este punto, el trigger SQL debería capturar el cambio automáticamente
      }
    }
  }

  private legacyRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    if (!LEGACY_API_BASE_URL) {
      return Promise.resolve({ success: false, error: 'Backend legacy no configurado' })
    }

    const token = localStorage.getItem('auth_token')

    return fetch(`${LEGACY_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(
            errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`
          )
        }
        return response.json()
      })
      .catch((error) => ({
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión'
      }))
  }

  private handleFallback<T>(data: T): ApiResponse<T> {
    return { success: true, data }
  }

  // ========== ORDENES DE TRABAJO ==========

  /**
   * Seguimiento público cliente (QR / op-public). Solo campos seguros vía RPC.
   * Fallback a getOrdenByOpNumber si la RPC aún no está desplegada.
   */
  async getOrdenSeguimientoPublico(ref: string): Promise<ApiResponse<OrdenSeguimientoPublico>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    let raw: string
    try {
      raw = typeof ref === 'string' ? decodeURIComponent(ref).trim() : String(ref).trim()
    } catch {
      raw = String(ref).trim()
    }
    if (!raw) return { success: false, error: 'Referencia no válida' }

    const { data, error } = await supabase.rpc('get_orden_seguimiento_publico', { p_ref: raw })
    if (error) {
      console.warn('get_orden_seguimiento_publico:', error.message)
      return { success: false, error: 'No se pudo consultar el estado de la orden' }
    }
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Orden no encontrada' }
    }
    const j = data as Record<string, unknown>
    return {
      success: true,
      data: {
        id: Number(j.id) || 0,
        numero_op: String(j.numero_op ?? ''),
        seguimiento_token: j.seguimiento_token != null ? String(j.seguimiento_token) : null,
        cliente: String(j.cliente ?? ''),
        estado: String(j.estado ?? ''),
        descripcion: j.descripcion != null ? String(j.descripcion) : null,
        fecha_entrega: j.fecha_entrega != null ? String(j.fecha_entrega) : null
      }
    }
  }

  async getOrdenByOpNumber(opNumber: string): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      // Normalizar: decode URI, quitar espacios, y opcionalmente quitar prefijo "OP-" (la BD suele tener "1", "2")
      let raw: string
      try {
        raw = typeof opNumber === 'string'
          ? decodeURIComponent(opNumber).trim()
          : String(opNumber).trim()
      } catch {
        raw = String(opNumber).trim()
      }
      if (!raw) {
        return { success: false, error: 'Número de OP no válido' }
      }
      // Sin prefijo para coincidir con BD (ej: "OP-1" -> "1")
      const opNormalized = raw.replace(/^OP-?/i, '').trim() || raw
      const fichaStripped = raw.replace(/^FICHA[\s-_#:]*/i, '').trim()

      const candidates: string[] = []
      const addCand = (s: string) => {
        const t = (s || '').trim()
        if (t && !candidates.includes(t)) candidates.push(t)
      }
      addCand(raw)
      addCand(opNormalized)
      addCand(fichaStripped)
      if (fichaStripped && fichaStripped !== raw) {
        addCand(fichaStripped.replace(/^OP-?/i, '').trim())
      }

      const pickBestPublicOrdenRow = (rows: OrdenTrabajo[]): OrdenTrabajo | null => {
        if (!rows?.length) return null
        // Preferir filas que siguen visibles en tablero (fusión sin DELETE)
        const visible = rows.filter((r) => r.visible_en_tablero !== false && (r as any).eliminada !== true)
        const pool = visible.length > 0 ? visible : rows
        const sorted = [...pool].sort((a, b) => {
          const dupA = a.es_duplicado ? 1 : 0
          const dupB = b.es_duplicado ? 1 : 0
          if (dupA !== dupB) return dupA - dupB
          const ra = a as OrdenTrabajo & { updated_at?: string }
          const rb = b as OrdenTrabajo & { updated_at?: string }
          const ta = new Date(ra.updated_at || ra.fecha_ingreso || 0).getTime() || 0
          const tb = new Date(rb.updated_at || rb.fecha_ingreso || 0).getTime() || 0
          return tb - ta
        })
        return sorted[0] ?? null
      }

      // Crear cliente sin autenticación para acceso público (página QR cliente / tablet firma)
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        return { success: false, error: 'Configuración de Supabase no encontrada' }
      }

      const publicClient = createClient(supabaseUrl, supabaseAnonKey)

      let data: OrdenTrabajo | null = null
      let error: { message: string } | null = null

      for (const num of candidates) {
        const { data: rows, error: err } = await publicClient
          .from('ordenes_trabajo')
          .select('*')
          .eq('numero_op', num)
          .limit(25)
        error = err
        if (err) {
          console.error('Error fetching orden by OP number:', err)
          break
        }
        if (Array.isArray(rows) && rows.length > 0) {
          const best = pickBestPublicOrdenRow(rows as OrdenTrabajo[])
          if (best) {
            data = best
            break
          }
        }
      }

      if (error) {
        return { success: false, error: error.message }
      }
      if (!data) {
        return { success: false, error: 'Orden no encontrada' }
      }

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /** Guarda la firma del cliente desde la tablet (anon). Uso real: tablet y PC distintos. */
  async saveFirmaCliente(
    numeroOp: string,
    datos: { firmaDataUrl: string; entregadoA: string; dniRetira?: string }
  ): Promise<ApiResponse<void>> {
    const client = supabase
    if (!client) return { success: false, error: 'Supabase no configurado' }
    const opNormalized = typeof numeroOp === 'string' ? numeroOp.trim() : String(numeroOp).trim()
    if (!opNormalized) return { success: false, error: 'Número de OP no válido' }
    try {
      const { error } = await client
        .from('firmas_entrega_cliente')
        .upsert(
          {
            numero_op: opNormalized,
            firma_data_url: datos.firmaDataUrl,
            entregado_a: datos.entregadoA,
            dni_retira: datos.dniRetira || null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'numero_op' }
        )
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al guardar la firma' }
    }
  }

  /** Obtiene la firma del cliente guardada desde la tablet (usuario logueado en PC). */
  async getFirmaCliente(
    numeroOp: string
  ): Promise<
    ApiResponse<{ firmaDataUrl: string; entregadoA: string; dniRetira?: string } | null>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado', data: null }
    const opNormalized = typeof numeroOp === 'string' ? numeroOp.trim() : String(numeroOp).trim()
    if (!opNormalized) return { success: true, data: null }
    try {
      const { data, error } = await supabase
        .from('firmas_entrega_cliente')
        .select('firma_data_url, entregado_a, dni_retira')
        .eq('numero_op', opNormalized)
        .maybeSingle()
      if (error) return { success: false, error: error.message, data: null }
      if (!data) return { success: true, data: null }
      return {
        success: true,
        data: {
          firmaDataUrl: data.firma_data_url,
          entregadoA: data.entregado_a,
          dniRetira: data.dni_retira ?? undefined
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al obtener la firma', data: null }
    }
  }

  async getOrdenes(options?: {
    skipInFlightDedupe?: boolean
    /** false en listado masivo del tablero (evita N consultas a orden_lineas_m2). */
    attachLineasM2?: boolean
    /** Refresco silencioso: solo OP activas (menos filas y menos trabajo en cliente). */
    soloActivasEnTablero?: boolean
  }): Promise<ApiResponse<OrdenTrabajo[]>> {
    const skip = options?.skipInFlightDedupe === true
    if (!skip && this.getOrdenesInFlight) return this.getOrdenesInFlight
    const run = this.fetchOrdenesOnce(options)
    if (!skip) {
      this.getOrdenesInFlight = run.finally(() => {
        if (this.getOrdenesInFlight === run) this.getOrdenesInFlight = null
      })
      return this.getOrdenesInFlight
    }
    return run
  }

  private async fetchOrdenesOnce(options?: {
    attachLineasM2?: boolean
    soloActivasEnTablero?: boolean
  }): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (supabase) {
      try {
        const sb = supabase
        const runQuery = (select: string) => {
          let q = sb
            .from('ordenes_trabajo')
            .select(select)
            .order('id', { ascending: false })
            .limit(ORDENES_TABLERO_LIMIT)
          if (options?.soloActivasEnTablero) {
            q = q.or('entregado.is.null,entregado.eq.false')
          }
          return withQueryTimeout(Promise.resolve(q), 'getOrdenes')
        }

        let { data, error } = await runQuery(ORDENES_TABLERO_SELECT)
        if (
          error &&
          (error.message?.includes('motivo_eliminacion') ||
            error.message?.includes('fecha_eliminacion'))
        ) {
          const fallbackSelect = ORDENES_TABLERO_SELECT.replace(
            ',motivo_eliminacion,fecha_eliminacion',
            ''
          )
          ;({ data, error } = await runQuery(fallbackSelect))
        }

        if (error) {
          console.error('Supabase getOrdenes error:', error)
          return { success: false, error: formatSupabaseStatementTimeoutError(error.message) }
        }

        let normalizedData = (data || []).map((orden: any) => ({
          ...orden,
          foto_url: orden.foto_url || null,
          telefono_cliente: orden.telefono_cliente || null,
          email_cliente: orden.email_cliente || null,
          direccion_cliente: orden.direccion_cliente || null,
          whatsapp_link: orden.whatsapp_link || null,
          ubicacion_link: orden.ubicacion_link || null,
          drive_link: orden.drive_link || null
        }))

        const { isOrdenVisibleOnTablero } = await import('../utils/dataMappers')
        normalizedData = normalizedData.filter((orden) => isOrdenVisibleOnTablero(orden))

        if (options?.attachLineasM2 === true) {
          await attachLineasM2ToOrdenes(normalizedData)
        }

        return { success: true, data: normalizedData as OrdenTrabajo[] }
      } catch (err: any) {
        // Capturar errores de red (Failed to fetch, CORS, etc.)
        console.error('Error de conexión en getOrdenes:', err)
        const errorMessage = err?.message || 'Error de conexión con la base de datos'

        // Verificar si es un error de red
        if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
          return {
            success: false,
            error:
              'No se pudo conectar con Supabase. Verifica tu conexión a internet y la configuración de VITE_SUPABASE_URL.'
          }
        }

        return { success: false, error: errorMessage }
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/ordenes.php')
    }

    return this.handleFallback(fallbackOrdenes)
  }

  /** Total de filas en ordenes_trabajo (solo conteo; liviano para biblioteca). */
  async getOrdenesBibliotecaCount(): Promise<ApiResponse<number>> {
    if (!supabase) {
      if (hasLegacyBackend) {
        const r = await this.legacyRequest<OrdenTrabajo[]>('/ordenes.php')
        return r.success && r.data ? { success: true, data: r.data.length } : { success: false, error: r.error }
      }
      return { success: true, data: fallbackOrdenes.length }
    }
    try {
      const { count, error } = await withQueryTimeout(
        Promise.resolve(
          supabase.from('ordenes_trabajo').select('id', { count: 'exact', head: true })
        ),
        'getOrdenesBibliotecaCount'
      )
      if (error) {
        return { success: false, error: formatSupabaseStatementTimeoutError(error.message) }
      }
      return { success: true, data: count ?? 0 }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión con la base de datos'
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Búsqueda liviana en toda la base (biblioteca). No carga el catálogo completo.
   */
  async searchOrdenesBiblioteca(
    query: string,
    options?: { limit?: number; idBd?: number }
  ): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (!supabase) {
      if (hasLegacyBackend) return this.legacyRequest('/ordenes.php')
      return this.handleFallback(fallbackOrdenes)
    }
    const sb = supabase
    const limit = Math.min(Math.max(options?.limit ?? ORDENES_BIBLIOTECA_SEARCH_LIMIT, 1), 80)
    const idFromOpt = options?.idBd != null ? Math.floor(Number(options.idBd)) : NaN

    try {
      const fetchById = async (id: number) => {
        const { data, error } = await withQueryTimeout(
          Promise.resolve(
            sb.from('ordenes_trabajo').select(ORDENES_TABLERO_SELECT).eq('id', id).maybeSingle()
          ),
          `searchOrdenesBiblioteca(id=${id})`
        )
        if (error) {
          return { success: false as const, error: formatSupabaseStatementTimeoutError(error.message) }
        }
        if (!data) return { success: true as const, data: [] as OrdenTrabajo[] }
        return {
          success: true as const,
          data: [normalizeOrdenListRow(data as Record<string, unknown>)]
        }
      }

      if (Number.isFinite(idFromOpt) && idFromOpt > 0) {
        return fetchById(idFromOpt)
      }

      const q = query.trim()
      const hashMatch = q.match(/^#?(\d+)$/)
      if (hashMatch) {
        const id = Number(hashMatch[1])
        if (Number.isFinite(id) && id > 0) return fetchById(id)
      }

      if (q.length < 2) {
        return { success: true, data: [] }
      }

      const escapeIlike = (s: string) => s.replace(/[%_\\]/g, '\\$&')
      const normalized = escapeIlike(q.replace(/^OP-?/i, '').trim() || q)
      const pattern = `%${normalized}%`
      const clientePattern = `%${escapeIlike(q)}%`

      const { data, error } = await withQueryTimeout(
        Promise.resolve(
          sb
            .from('ordenes_trabajo')
            .select(ORDENES_TABLERO_SELECT)
            .or(
              `numero_op.ilike.${pattern},cliente.ilike.${clientePattern},descripcion.ilike.${clientePattern},dni_cuit.ilike.${clientePattern},numero_ficha_original.ilike.${clientePattern},telefono_cliente.ilike.${clientePattern},email_cliente.ilike.${clientePattern}`
            )
            .order('fecha_creacion', { ascending: false })
            .limit(limit)
        ),
        'searchOrdenesBiblioteca'
      )

      if (error) {
        return { success: false, error: formatSupabaseStatementTimeoutError(error.message) }
      }

      return {
        success: true,
        data: (data ?? []).map((row) => normalizeOrdenListRow(row as Record<string, unknown>))
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión con la base de datos'
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Catálogo completo para biblioteca: columnas livianas, páginas secuenciales (sin m2).
   * Solo debe llamarse por acción explícita del usuario (no en carga del tablero).
   */
  async getOrdenesBibliotecaCatalogo(options?: {
    onProgress?: (loaded: number, total: number | null) => void
  }): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (this.getOrdenesBibliotecaInFlight) return this.getOrdenesBibliotecaInFlight
    const run = this.fetchOrdenesBibliotecaCatalogoOnce(options)
    this.getOrdenesBibliotecaInFlight = run.finally(() => {
      if (this.getOrdenesBibliotecaInFlight === run) this.getOrdenesBibliotecaInFlight = null
    })
    return this.getOrdenesBibliotecaInFlight
  }

  private async fetchOrdenesBibliotecaCatalogoOnce(options?: {
    onProgress?: (loaded: number, total: number | null) => void
  }): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (!supabase) {
      if (hasLegacyBackend) return this.legacyRequest('/ordenes.php')
      return this.handleFallback(fallbackOrdenes)
    }
    try {
      const countResp = await this.getOrdenesBibliotecaCount()
      const total = countResp.success ? countResp.data ?? null : null
      options?.onProgress?.(0, total)

      const all: OrdenTrabajo[] = []
      let offset = 0
      for (;;) {
        const from = offset
        const to = offset + ORDENES_BIBLIOTECA_PAGE_SIZE - 1
        const query = supabase
          .from('ordenes_trabajo')
          .select(ORDENES_TABLERO_SELECT)
          .order('id', { ascending: false })
          .range(from, to)

        const { data, error } = await withQueryTimeout(
          Promise.resolve(query),
          `getOrdenesBiblioteca(${from}-${to})`
        )

        if (error) {
          console.error('Supabase getOrdenesBibliotecaCatalogo error:', error)
          if (all.length > 0) {
            return { success: true, data: all }
          }
          return { success: false, error: formatSupabaseStatementTimeoutError(error.message) }
        }

        const page = (data ?? []) as OrdenTrabajo[]
        if (page.length === 0) break

        for (const orden of page) {
          all.push(normalizeOrdenListRow(orden as unknown as Record<string, unknown>))
        }

        options?.onProgress?.(all.length, total)
        offset += page.length
        if (page.length < ORDENES_BIBLIOTECA_PAGE_SIZE) break
      }

      return { success: true, data: all }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión con la base de datos'
      console.error('Error en getOrdenesBibliotecaCatalogo:', err)
      return { success: false, error: errorMessage }
    }
  }

  async getOrden(id: number): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      if (!data) return { success: false, error: 'Orden no encontrada' }
      const row = data as any
      await attachLineasM2ToOrdenes([row])
      return { success: true, data: row as OrdenTrabajo }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`)
    }

    const orden = fallbackOrdenes.find((o) => o.id === id)
    return orden
      ? { success: true, data: orden }
      : { success: false, error: 'Orden no encontrada en fallback' }
  }

  async createOrden(orden: Partial<OrdenTrabajo>): Promise<ApiResponse<OrdenTrabajo>> {
    const createdNotifyBoard = (row: OrdenTrabajo): ApiResponse<OrdenTrabajo> => {
      // Otras pestañas / ventanas: Supabase Realtime a veces no entrega el INSERT a tiempo; mismo patrón que deleteOrden.
      // El refetch silencioso usa getOrdenes({ skipInFlightDedupe: true }) y no compite con promesas viejas deduplicadas.
      void import('../utils/ordenesBroadcast')
        .then((m) => m.broadcastOrdenesChanged())
        .catch(() => {})
      return { success: true, data: row }
    }
    if (supabase) {
      // Capturar supabase en variable local para TypeScript
      const supabaseClient = supabase

      const hasContactFields = Boolean(
        orden.telefono_cliente ||
          orden.direccion_cliente ||
          orden.drive_link ||
          orden.ubicacion_link ||
          orden.email_cliente ||
          orden.whatsapp_link
      )
      const hasMultipleSectors = Boolean(orden.sectores && orden.sectores.length > 0)
      const usesCreateOrdenRpc = hasContactFields || hasMultipleSectors
      const { ordenUsaCorrelativoFichaNoOP } = await import('../utils/dataMappers')
      const usaCorrelativoFichaNoOP = ordenUsaCorrelativoFichaNoOP(orden.numero_op, orden.es_ficha_no_op)
      if (usaCorrelativoFichaNoOP) {
        orden.es_ficha_no_op = true
      }

      // Ficha No OP: correlativo en cliente solo si NO va por create_orden_with_contact (ahí lo asigna la BD).
      if (usaCorrelativoFichaNoOP && !usesCreateOrdenRpc) {
        const raw = (orden.numero_op || '').trim()
        const tieneCorrelativoExplicito = /^FICHA-[0-9]+$/i.test(raw)
        if (!tieneCorrelativoExplicito) {
          const { data: nextOp, error: nextErr } = await supabaseClient.rpc('next_numero_ficha_no_op')
          if (!nextErr && nextOp != null && String(nextOp).trim() !== '') {
            orden.numero_op = String(nextOp).trim()
          } else if (nextErr) {
            console.warn(
              'next_numero_ficha_no_op: correlativo no asignado (¿falta el parche SQL?).',
              nextErr.message
            )
          }
        }
      }

      if (usesCreateOrdenRpc) {
        try {
          console.log('🔄 Usando función SQL para crear orden (evita schema cache)')
          console.log('📋 Datos a enviar:', {
            p_sectores: orden.sectores,
            p_sector_inicial: orden.sector_inicial,
            p_sector: orden.sector_inicial || orden.sector,
            hasMultipleSectors,
            hasContactFields
          })
          // Normalizar etiquetas: asegurar que sea un array válido o null
          const etiquetasNormalizadas = orden.etiquetas && Array.isArray(orden.etiquetas) && orden.etiquetas.length > 0 
            ? orden.etiquetas.filter(e => e && e.trim().length > 0) // Filtrar etiquetas vacías
            : null
          
          console.log('🏷️ Etiquetas recibidas:', orden.etiquetas)
          console.log('🏷️ Etiquetas normalizadas:', etiquetasNormalizadas)
          
          const rpcParams = {
            // Ficha + RPC: vacío; create_orden_with_contact asigna next_numero_ficha_no_op (parche 2026-04-05).
            p_numero_op: usaCorrelativoFichaNoOP && usesCreateOrdenRpc ? '' : orden.numero_op || '',
            p_cliente: orden.cliente || '',
            p_descripcion: orden.descripcion || null,
            p_estado: orden.estado || 'Pendiente',
            p_prioridad: orden.prioridad || 'Normal',
            // Usar fecha de Argentina para evitar corrimientos por UTC
            p_fecha_entrega: orden.fecha_entrega || getArgentinaDateString(),
            p_operario_asignado: orden.operario_asignado || null,
            p_complejidad: orden.complejidad || 'Media',
            p_sector: orden.sectores && orden.sectores.length > 0 ? orden.sectores[0] : (orden.sector || 'Diseño Gráfico'), // Primer sector
            p_sectores: orden.sectores && orden.sectores.length > 0 ? orden.sectores : null,
            p_sector_inicial: orden.sectores && orden.sectores.length > 0 ? orden.sectores[0] : (orden.sector || null), // Para compatibilidad
            p_materiales: orden.materiales || null,
            p_nombre_creador: orden.nombre_creador || null,
            p_telefono_cliente: orden.telefono_cliente || null,
            p_email_cliente: orden.email_cliente || null,
            p_direccion_cliente: orden.direccion_cliente || null,
            p_whatsapp_link: orden.whatsapp_link || null,
            p_ubicacion_link: orden.ubicacion_link || null,
            p_drive_link: orden.drive_link || null,
            p_foto_url: orden.foto_url || null,
            p_dni_cuit: orden.dni_cuit || null,
            p_es_ficha_no_op: usaCorrelativoFichaNoOP,
            p_planilla_preliminar: orden.planilla_preliminar || false,
            p_ficha_tecnica_pdf_url: orden.ficha_tecnica_pdf_url || null,
            p_etiquetas: etiquetasNormalizadas,
            p_brief_publico: orden.brief_publico || null,
            p_objetivo_proyecto: orden.objetivo_proyecto || null,
            p_publico_objetivo: orden.publico_objetivo || null,
            p_estilo_diseno: orden.estilo_diseno || null,
            p_referencias: orden.referencias || null,
            p_deadline_brief: orden.deadline_brief || null
          }
          
          const maxRpcAttempts = usaCorrelativoFichaNoOP ? 6 : 1
          let data: unknown = null
          let error: { message?: string; hint?: string; details?: string; code?: string; name?: string } | null =
            null

          for (let attempt = 0; attempt < maxRpcAttempts; attempt++) {
            if (usaCorrelativoFichaNoOP && usesCreateOrdenRpc) {
              rpcParams.p_numero_op = ''
            }

            console.log('🔍 Llamando función SQL con parámetros:', JSON.stringify(rpcParams, null, 2))
            console.log('🔍 Tipos de parámetros:', Object.entries(rpcParams).map(([k, v]) => `${k}: ${typeof v}${Array.isArray(v) ? ' (array)' : ''}`).join(', '))
            console.log('🏷️ p_etiquetas específicamente:', rpcParams.p_etiquetas, 'tipo:', typeof rpcParams.p_etiquetas, 'es array:', Array.isArray(rpcParams.p_etiquetas))

            const res = await supabaseClient.rpc('create_orden_with_contact', rpcParams)
            data = res.data
            error = res.error

            if (!error) break

            const msg = (error.message || '').toLowerCase()
            const dup = msg.includes('duplicate key') || msg.includes('ux_ordenes_op_sector')
            if (usaCorrelativoFichaNoOP && dup && attempt < maxRpcAttempts - 1) {
              console.warn(
                `create_orden_with_contact: duplicado ux_ordenes_op_sector (intento ${attempt + 1}/${maxRpcAttempts}), nuevo correlativo…`
              )
              continue
            }
            break
          }

          if (error) {
            console.error('❌ Error en RPC create_orden_with_contact:', error)
            console.error('❌ Parámetros enviados:', JSON.stringify(rpcParams, null, 2))
            console.error('❌ Etiquetas específicamente:', rpcParams.p_etiquetas)
          }

          console.log('📊 Respuesta RPC:', {
            hasData: data !== null && data !== undefined,
            dataType: typeof data,
            isArray: Array.isArray(data),
            dataValue: data,
            hasError: error !== null,
            errorType: error ? typeof error : null
          })

          if (error) {
            console.error('❌ Error en función SQL:', error)
            console.error('❌ Detalles completos del error:', JSON.stringify(error, null, 2))
            console.error('❌ Propiedades del error:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              name: error.name
            })
            
            // Log adicional para debugging
            console.error('❌ Parámetros enviados:', JSON.stringify(rpcParams, null, 2))
            
            // Retornar el error en lugar de continuar silenciosamente
            const errorMsg = error.message || 'Error desconocido'
            const errorHint = error.hint ? ` (${error.hint})` : ''
            const errorDetails = error.details ? ` - ${error.details}` : ''
            
            return { 
              success: false, 
              error: `Error al crear orden: ${errorMsg}${errorHint}${errorDetails}` 
            }
          }
          
          console.log('📥 Respuesta de función SQL (raw):', { data, type: typeof data, isArray: Array.isArray(data) })
          
          if (data !== null && data !== undefined) {
            // La función ahora retorna solo el ID (integer)
            const ordenId = typeof data === 'number' ? data : (Array.isArray(data) && data.length > 0 ? data[0] : null)
            
            if (ordenId && typeof ordenId === 'number') {
              console.log('✅ Orden creada usando función SQL, ID:', ordenId)
              // Obtener la orden completa después de la creación
              const { data: fullOrden, error: fetchError } = await supabaseClient
                .from('ordenes_trabajo')
                .select('*')
                .eq('id', ordenId)
                .single()
              
              if (fetchError) {
                console.error('❌ Error obteniendo orden completa:', fetchError)
                return { success: false, error: `Error al obtener orden creada: ${fetchError.message}` }
              }
              
              if (fullOrden) {
                // Descontar stock si hay materiales asociados
                await this.descontarStockDeOrden(fullOrden.id, fullOrden.numero_op || '')
                console.log('✅ Orden completa obtenida:', fullOrden)
                return createdNotifyBoard(fullOrden as OrdenTrabajo)
              }
              
              return { success: false, error: 'No se pudo obtener la orden creada' }
            } else {
              console.error('❌ La función retornó un ID inválido:', { data, ordenId, type: typeof ordenId })
              return { 
                success: false, 
                error: `La función SQL retornó un ID inválido: ${JSON.stringify(data)}` 
              }
            }
          } else {
            console.error('❌ La función SQL retornó null o undefined')
            return { 
              success: false, 
              error: 'La función SQL no retornó ningún ID. Verifica que la función se ejecutó correctamente.' 
            }
          }
        } catch (err) {
          console.error('❌ Excepción al usar función SQL:', err)
          const errorMessage = err instanceof Error ? err.message : String(err)
          return { 
            success: false, 
            error: `Error inesperado al crear orden: ${errorMessage}` 
          }
        }
      }
      
      // Preparar el objeto para insertar
      const ordenToInsert = { ...orden }
      
      // Asegurar que sectores sea un array válido
      if (ordenToInsert.sectores && ordenToInsert.sectores.length > 0) {
        ordenToInsert.sectores = ordenToInsert.sectores
      } else if (ordenToInsert.sector) {
        // Si no hay sectores múltiples, usar el sector único como array
        ordenToInsert.sectores = [ordenToInsert.sector]
      } else {
        ordenToInsert.sectores = null
      }
      
      // Asegurar que sector_inicial esté definido
      if (!ordenToInsert.sector_inicial && ordenToInsert.sector) {
        ordenToInsert.sector_inicial = ordenToInsert.sector
      }
      
      // Solo eliminar foto_url si está vacío, null o undefined (pero NUNCA eliminarlo si tiene valor)
      if (ordenToInsert.foto_url && ordenToInsert.foto_url.trim() !== '') {
        // Mantener foto_url - es importante
        console.log('📸 Foto URL presente:', ordenToInsert.foto_url)
      } else {
        // Solo eliminar si realmente está vacío
        delete ordenToInsert.foto_url
      }
      
      // Asegurar que dni_cuit se envíe correctamente (incluso si es null o string vacío)
      if (ordenToInsert.dni_cuit === undefined) {
        ordenToInsert.dni_cuit = null
      } else if (ordenToInsert.dni_cuit === '') {
        ordenToInsert.dni_cuit = null
      }
      
      console.log('📤 Creando orden. Payload completo:', JSON.stringify(ordenToInsert, null, 2))
      console.log('📞 Datos de contacto en payload:', {
        telefono: ordenToInsert.telefono_cliente || 'null',
        ubicacion: ordenToInsert.ubicacion_link || 'null',
        direccion: ordenToInsert.direccion_cliente || 'null',
        email: ordenToInsert.email_cliente || 'null',
        whatsapp: ordenToInsert.whatsapp_link || 'null',
        drive: ordenToInsert.drive_link || 'null',
        foto: ordenToInsert.foto_url ? 'presente' : 'null'
      })
      
      const performInsert = async (payload: Partial<OrdenTrabajo>) => {
        return supabaseClient.from('ordenes_trabajo').insert(payload).select().single()
      }

      // Intentar insertar primero con todos los datos
      let { data, error } = await performInsert(ordenToInsert)

      if (error) {
        console.error('❌ Error al crear orden:', error.message, error)
        const errorLower = error.message.toLowerCase()
        const isColumnError = errorLower.includes('column') || 
                              errorLower.includes('does not exist') || 
                              errorLower.includes('not found') ||
                              errorLower.includes('schema cache') ||
                              errorLower.includes('could not find')
        
        if (isColumnError) {
          // Separar foto_url de las otras columnas opcionales - foto_url es más importante
          const contactColumns = [
            'telefono_cliente',
            'email_cliente',
            'direccion_cliente',
            'whatsapp_link',
            'ubicacion_link',
            'drive_link'
          ]
          const allOptionalColumns = [
            'foto_url',
            'reclamo_motivo',
            'reclamo_costo_monto',
            'reclamo_etiquetas',
            ...contactColumns
          ]

          // Detectar SOLO las columnas que específicamente están mencionadas en el error
          const missingColumns: string[] = []
          allOptionalColumns.forEach((col) => {
            // Buscar el nombre exacto de la columna en el error (con guiones bajos y espacios)
            const colPattern = col.toLowerCase().replace(/_/g, '[ _]')
            const regex = new RegExp(colPattern, 'i')
            if (regex.test(errorLower)) {
              missingColumns.push(col)
            }
          })
          
          if (missingColumns.length > 0) {
            console.warn(`⚠️ Columnas faltantes detectadas en el error: ${missingColumns.join(', ')}`)
            // Eliminar SOLO las columnas que específicamente faltan
            const sanitizedPayload: Partial<OrdenTrabajo> = { ...ordenToInsert }
            missingColumns.forEach((col) => {
              // @ts-expect-error index access
              delete sanitizedPayload[col]
            })

            console.log(`⚠️ Eliminando columnas faltantes: ${missingColumns.join(', ')}. Reintentando...`)
            console.log('📤 Payload sanitizado:', JSON.stringify(sanitizedPayload, null, 2))
            const fallback = await performInsert(sanitizedPayload)
            
            if (fallback.error) {
              console.error('❌ Error persistente después de eliminar columnas:', fallback.error.message)
              // Si aún falla, puede ser otra columna. Intentar sin SOLO las columnas de contacto (mantener foto_url si existe)
              const minimalPayload: Partial<OrdenTrabajo> = { ...sanitizedPayload }
              // Solo eliminar columnas de contacto, NO foto_url
              contactColumns.forEach((col) => {
                // @ts-expect-error index access
                delete minimalPayload[col]
              })
              
              // Si foto_url estaba en el error, también eliminarlo
              if (missingColumns.includes('foto_url')) {
                delete minimalPayload.foto_url
              }
              
              console.log('⚠️ Reintentando sin columnas de contacto...')
              const finalAttempt = await performInsert(minimalPayload)
              if (finalAttempt.error) {
                console.error('❌ Error final:', finalAttempt.error.message)
                return { success: false, error: finalAttempt.error.message }
              }
              console.log('✅ Orden creada sin algunas columnas opcionales')
              return createdNotifyBoard(finalAttempt.data as OrdenTrabajo)
            }

            // Éxito después de eliminar columnas faltantes
            console.log(`✅ Orden creada. Columnas eliminadas: ${missingColumns.join(', ')}`)
            return createdNotifyBoard(fallback.data as OrdenTrabajo)
          } else {
            // El error menciona "column" pero no menciona ninguna columna específica de contacto
            // Esto podría ser un error de otra columna. Intentar de todas formas.
            console.warn('⚠️ Error de columna detectado pero no se identificaron columnas de contacto específicas. Reintentando sin columnas de contacto...')
            const minimalPayload: Partial<OrdenTrabajo> = { ...ordenToInsert }
            contactColumns.forEach((col) => {
              // @ts-expect-error index access
              delete minimalPayload[col]
            })
            const finalAttempt = await performInsert(minimalPayload)
            if (finalAttempt.error) {
              console.error('❌ Error final:', finalAttempt.error.message)
              return { success: false, error: finalAttempt.error.message }
            }
            console.log('✅ Orden creada sin columnas de contacto (fallback)')
            return createdNotifyBoard(finalAttempt.data as OrdenTrabajo)
          }
        }

        // Si el error NO es por columnas faltantes, retornar el error
        console.error('❌ Error no relacionado con columnas:', error.message)
        return { success: false, error: error.message }
      }
      
      // Log de éxito con datos guardados
      if (ordenToInsert.telefono_cliente || ordenToInsert.email_cliente || ordenToInsert.direccion_cliente) {
        console.log('✅ Orden creada con datos de contacto:', {
          telefono: ordenToInsert.telefono_cliente || 'no',
          email: ordenToInsert.email_cliente || 'no',
          direccion: ordenToInsert.direccion_cliente || 'no',
          whatsapp: ordenToInsert.whatsapp_link || 'no',
          ubicacion: ordenToInsert.ubicacion_link || 'no',
          drive: ordenToInsert.drive_link || 'no'
        })
      }

      return createdNotifyBoard(data as OrdenTrabajo)
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/ordenes.php', { method: 'POST', body: JSON.stringify(orden) })
    }

    const nuevo = { ...orden, id: fallbackOrdenes.length + 1 } as OrdenTrabajo
    fallbackOrdenes.push(nuevo)
    return createdNotifyBoard(nuevo)
  }

  /** Dispara en segundo plano el envío de email al cliente cuando la orden pasa a Almacén de Entrega. */
  private triggerEmailOrdenLista(ordenId: number, estadoAnterior: string | null, ordenActualizada: OrdenTrabajo) {
    if (typeof window === 'undefined') return
    if (ordenActualizada.estado !== 'Almacén de Entrega' || estadoAnterior === 'Almacén de Entrega') return
    if (!ordenActualizada.email_cliente?.trim()) return
    fetch(plotLabApiUrl('/api/notify-orden-lista'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordenId })
    }).catch(() => {})
  }

  async updateOrden(id: number, orden: Partial<OrdenTrabajo>): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      // Capturar supabase en variable local para TypeScript
      const supabaseClient = supabase
      
      // Obtener estado anterior antes de actualizar (sin `eliminada` si la BD aún no tiene esa columna)
      const colsOrdenUpdateBase =
        'estado, operario_asignado, sector, sectores, prioridad, descripcion, planilla_preliminar, ficha_tecnica_cargada, presupuesto_enviado_cliente, presupuesto_armado, presupuesto_en_espera, op_bloqueada, foto_url'
      let ordenAnterior: OrdenTrabajo | null = null
      const rAnt = await supabaseClient
        .from('ordenes_trabajo')
        .select(`${colsOrdenUpdateBase}, eliminada`)
        .eq('id', id)
        .maybeSingle()
      if (rAnt.error && isMissingElEliminadaColumnError(rAnt.error.message)) {
        const r2 = await supabaseClient
          .from('ordenes_trabajo')
          .select(colsOrdenUpdateBase)
          .eq('id', id)
          .maybeSingle()
        if (r2.error) {
          return { success: false, error: r2.error.message }
        }
        ordenAnterior = (r2.data as OrdenTrabajo) ?? null
      } else if (rAnt.error) {
        return { success: false, error: rAnt.error.message }
      } else {
        ordenAnterior = (rAnt.data as OrdenTrabajo) ?? null
        if (ordenAnterior?.eliminada === true) {
          return { success: false, error: 'Esta OP fue eliminada y no se puede editar.' }
        }
      }

      const lockEval = this.evaluateOrdenOpLock(
        ordenAnterior as {
          op_bloqueada?: boolean | null
          operario_asignado?: string | null
        },
        orden
      )
      if (!lockEval.ok) {
        return { success: false, error: lockEval.error }
      }
      
      const estadoAnterior = ordenAnterior?.estado || null
      const operarioAnterior = ordenAnterior?.operario_asignado || null
      const sectorAnterior = ordenAnterior?.sector || null
      const prioridadAnterior = ordenAnterior?.prioridad || null
      const descripcionAnterior = (ordenAnterior as any)?.descripcion ?? null
      const planillaAnterior = (ordenAnterior as any)?.planilla_preliminar ?? null
      const fichaCargadaAnterior = (ordenAnterior as any)?.ficha_tecnica_cargada ?? null
      const presupuestoEnviadoAnterior = (ordenAnterior as any)?.presupuesto_enviado_cliente ?? null
      const presupuestoArmadoAnterior = (ordenAnterior as any)?.presupuesto_armado ?? null
      const presupuestoEnEsperaAnterior = (ordenAnterior as any)?.presupuesto_en_espera ?? null
      const fotoUrlAnterior = (ordenAnterior as any)?.foto_url ?? null

      const normFotoUrl = (u: unknown): string =>
        typeof u === 'string' ? u.trim() : u != null && String(u).trim() !== '' ? String(u).trim() : ''

      // SOLUCIÓN DIRECTA: Si hay campos de contacto, usar función SQL que evita schema cache
      if (orden.telefono_cliente || orden.direccion_cliente || orden.drive_link || 
          orden.ubicacion_link || orden.email_cliente || orden.whatsapp_link) {
        try {
          console.log('🔄 Usando función SQL para actualizar (evita schema cache)')
          const { data, error } = await supabaseClient.rpc('update_orden_with_contact', {
            p_id: id,
            p_telefono_cliente: orden.telefono_cliente || null,
            p_email_cliente: orden.email_cliente || null,
            p_direccion_cliente: orden.direccion_cliente || null,
            p_whatsapp_link: orden.whatsapp_link || null,
            p_ubicacion_link: orden.ubicacion_link || null,
            p_drive_link: orden.drive_link || null,
            p_foto_url: orden.foto_url || null
          })
          
          if (error) {
            console.error('❌ Error en función SQL:', error)
            // Si falla la función, continuar con el método normal
          } else if (data && data.length > 0) {
            console.log('✅ Orden actualizada usando función SQL')
            // Obtener la orden completa después de la actualización
            const { data: fullOrden, error: fetchError } = await supabaseClient
              .from('ordenes_trabajo')
              .select('*')
              .eq('id', id)
              .single()
            
            if (fetchError) {
              return { success: false, error: fetchError.message }
            }
            
            if (fullOrden) {
              // `update_orden_with_contact` hace foto_url = COALESCE(p_foto_url, foto_url): un NULL en p_foto_url
              // no borra la portada. Si el valor pedido no coincide con la fila, corregimos con UPDATE directo.
              let ordenDatos = fullOrden as OrdenTrabajo
              if ('foto_url' in orden) {
                const desiredF = normFotoUrl(orden.foto_url)
                const actualF = normFotoUrl((ordenDatos as any)?.foto_url)
                if (desiredF !== actualF) {
                  const fotoForDb = desiredF ? String(orden.foto_url).trim() : null
                  const { data: patchedFoto, error: errFoto } = await supabaseClient
                    .from('ordenes_trabajo')
                    .update({ foto_url: fotoForDb })
                    .eq('id', id)
                    .select('*')
                    .single()
                  if (!errFoto && patchedFoto) ordenDatos = patchedFoto as OrdenTrabajo
                  else if (errFoto) console.warn('Corrección foto_url después de RPC:', errFoto.message)
                }
              }

              // Registrar cambios en historial si hay cambios relevantes (incluso si se usó función SQL)
              const estadoNuevo = ordenDatos.estado || null
              const operarioNuevo = ordenDatos.operario_asignado || null
              const sectorNuevo = ordenDatos.sector || null
              const prioridadNueva = ordenDatos.prioridad || null
              const descripcionNueva = (ordenDatos as any)?.descripcion ?? null
              const planillaNueva = (ordenDatos as any)?.planilla_preliminar ?? null
              const fichaCargadaNueva = (ordenDatos as any)?.ficha_tecnica_cargada ?? null
              const presupuestoEnviadoNuevo = (ordenDatos as any)?.presupuesto_enviado_cliente ?? null
              const presupuestoArmadoNuevo = (ordenDatos as any)?.presupuesto_armado ?? null
              const presupuestoEnEsperaNuevo = (ordenDatos as any)?.presupuesto_en_espera ?? null
              
              const cambios: string[] = []
              let checklistChanged = false
              let motivosChanged = false
              
              if (estadoAnterior !== estadoNuevo && estadoNuevo !== null) {
                cambios.push(`Estado: ${estadoAnterior || 'N/A'} → ${estadoNuevo}`)
              }
              
              const trim = (str: string | null | undefined): string => (str || '').trim()
              
              if (trim(operarioAnterior) !== trim(operarioNuevo)) {
                if (!operarioNuevo || trim(operarioNuevo) === '') {
                  cambios.push('Operario desasignado')
                } else if (!operarioAnterior || trim(operarioAnterior) === '') {
                  cambios.push(`Operario asignado: ${operarioNuevo}`)
                } else {
                  cambios.push(`Operario: ${operarioAnterior} → ${operarioNuevo}`)
                }
              }
              
              if (sectorAnterior !== sectorNuevo && sectorNuevo !== null) {
                cambios.push(`Sector: ${sectorAnterior || 'N/A'} → ${sectorNuevo}`)
              }
              
              if (prioridadAnterior !== prioridadNueva && prioridadNueva !== null) {
                cambios.push(`Prioridad: ${prioridadAnterior || 'N/A'} → ${prioridadNueva}`)
              }

              const extractMotivos = (raw: string | null | undefined): string => {
                const s = (raw || '').trim()
                if (!s) return ''
                const marker = '\n\nMotivos:\n'
                const idx = s.indexOf(marker)
                if (idx < 0) return ''
                return s.slice(idx + marker.length).trim()
              }
              const motivosPrev = extractMotivos(descripcionAnterior)
              const motivosNext = extractMotivos(descripcionNueva)
              if (motivosPrev !== motivosNext) {
                motivosChanged = true
                const display = (v: string) => (v.trim() ? v.trim() : '—')
                cambios.push(`Motivos: ${display(motivosPrev)} → ${display(motivosNext)}`)
              }

              const pushBool = (
                label: string,
                prev: boolean | null | undefined,
                next: boolean | null | undefined
              ) => {
                if (prev === next) return
                checklistChanged = true
                const prevTxt = prev === true ? 'Sí' : 'No'
                const nextTxt = next === true ? 'Sí' : 'No'
                cambios.push(`${label}: ${prevTxt} → ${nextTxt}`)
              }

              // Checklist / DT (registrar también destildados)
              pushBool('Planilla preliminar', planillaAnterior, planillaNueva)
              pushBool('Ficha técnica cargada', fichaCargadaAnterior, fichaCargadaNueva)
              pushBool(
                'Presupuesto enviado',
                presupuestoEnviadoAnterior,
                presupuestoEnviadoNuevo
              )
              pushBool('Presupuesto armado', presupuestoArmadoAnterior, presupuestoArmadoNuevo)
              pushBool(
                'Presupuesto en espera',
                presupuestoEnEsperaAnterior,
                presupuestoEnEsperaNuevo
              )
              
              // Si hay cambios en el payload original, también registrarlos
              if (orden.estado && orden.estado !== estadoAnterior) {
                cambios.push(`Estado: ${estadoAnterior || 'N/A'} → ${orden.estado}`)
              }
              if (orden.operario_asignado && trim(orden.operario_asignado) !== trim(operarioAnterior)) {
                cambios.push(`Operario: ${operarioAnterior || 'N/A'} → ${orden.operario_asignado}`)
              }
              if (orden.sector && orden.sector !== sectorAnterior) {
                cambios.push(`Sector: ${sectorAnterior || 'N/A'} → ${orden.sector}`)
              }
              if (orden.prioridad && orden.prioridad !== prioridadAnterior) {
                cambios.push(`Prioridad: ${prioridadAnterior || 'N/A'} → ${orden.prioridad}`)
              }

              const fotoNuevaRpc = (ordenDatos as any)?.foto_url ?? null
              const fotoChangedRpc = normFotoUrl(fotoUrlAnterior) !== normFotoUrl(fotoNuevaRpc)
              if (fotoChangedRpc) {
                cambios.push(normFotoUrl(fotoNuevaRpc) ? 'Portada actualizada' : 'Portada eliminada')
              }
              
              // Registrar SIEMPRE si hay cambios relevantes (AUDITORÍA PROFESIONAL)
              if (cambios.length > 0) {
                const comentario = cambios.join(' | ')
                const cambiosDetallados: Record<string, any> = {}
                
                if (estadoAnterior !== estadoNuevo && estadoNuevo !== null) {
                  cambiosDetallados.estado = { anterior: estadoAnterior, nuevo: estadoNuevo }
                }
                if (trim(operarioAnterior) !== trim(operarioNuevo)) {
                  cambiosDetallados.operario = { anterior: operarioAnterior, nuevo: operarioNuevo }
                }
                if (sectorAnterior !== sectorNuevo && sectorNuevo !== null) {
                  cambiosDetallados.sector = { anterior: sectorAnterior, nuevo: sectorNuevo }
                }
                if (prioridadAnterior !== prioridadNueva && prioridadNueva !== null) {
                  cambiosDetallados.prioridad = { anterior: prioridadAnterior, nuevo: prioridadNueva }
                }
                if (motivosChanged) {
                  cambiosDetallados.motivos = {
                    anterior: extractMotivos(descripcionAnterior),
                    nuevo: extractMotivos(descripcionNueva)
                  }
                }

                // Checklist / DT
                if (planillaAnterior !== planillaNueva) {
                  cambiosDetallados.planilla_preliminar = { anterior: planillaAnterior, nuevo: planillaNueva }
                }
                if (fichaCargadaAnterior !== fichaCargadaNueva) {
                  cambiosDetallados.ficha_tecnica_cargada = { anterior: fichaCargadaAnterior, nuevo: fichaCargadaNueva }
                }
                if (presupuestoEnviadoAnterior !== presupuestoEnviadoNuevo) {
                  cambiosDetallados.presupuesto_enviado_cliente = {
                    anterior: presupuestoEnviadoAnterior,
                    nuevo: presupuestoEnviadoNuevo
                  }
                }
                if (presupuestoArmadoAnterior !== presupuestoArmadoNuevo) {
                  cambiosDetallados.presupuesto_armado = { anterior: presupuestoArmadoAnterior, nuevo: presupuestoArmadoNuevo }
                }
                if (presupuestoEnEsperaAnterior !== presupuestoEnEsperaNuevo) {
                  cambiosDetallados.presupuesto_en_espera = {
                    anterior: presupuestoEnEsperaAnterior,
                    nuevo: presupuestoEnEsperaNuevo
                  }
                }
                if (fotoChangedRpc) {
                  cambiosDetallados.foto_url = { anterior: fotoUrlAnterior, nuevo: fotoNuevaRpc }
                }
                
                // Determinar tipo de acción
                let accionTipo = 'actualizacion'
                if (estadoAnterior !== estadoNuevo) accionTipo = 'cambio_estado'
                else if (trim(operarioAnterior) !== trim(operarioNuevo)) accionTipo = 'cambio_operario'
                else if (sectorAnterior !== sectorNuevo) accionTipo = 'cambio_sector'
                else if (checklistChanged) accionTipo = 'checklist'
                else if (motivosChanged) accionTipo = 'motivos'
                else if (fotoChangedRpc) accionTipo = 'portada'
                
                await this.registrarCambioHistorial(id, estadoAnterior, estadoNuevo || orden.estado || null, comentario, accionTipo, cambiosDetallados)
              }
              
              // Descontar stock si hay materiales asociados (solo si se actualizaron materiales)
              // Nota: En actualización no descontamos automáticamente, solo al crear
              this.triggerEmailOrdenLista(id, estadoAnterior, ordenDatos as OrdenTrabajo)
              return { success: true, data: ordenDatos as OrdenTrabajo }
            }
            
            return { success: false, error: 'No se pudo obtener la orden actualizada' }
          }
        } catch (err) {
          console.warn('⚠️ Error al usar función SQL, continuando con método normal:', err)
          // Continuar con el método normal si la función no existe o falla
        }
      }
      
      // Preparar el objeto para actualizar
      const ordenToUpdate = { ...orden }

      if ('foto_url' in ordenToUpdate) {
        const rawF = ordenToUpdate.foto_url
        const t = typeof rawF === 'string' ? rawF.trim() : rawF != null ? String(rawF).trim() : ''
        if (t) {
          ordenToUpdate.foto_url = t
          console.log('📸 Foto URL presente en actualización:', ordenToUpdate.foto_url)
        } else {
          ;(ordenToUpdate as any).foto_url = null
        }
      } else {
        delete ordenToUpdate.foto_url
      }
      
      // Asegurar que dni_cuit se envíe correctamente (incluso si es null o string vacío)
      if (ordenToUpdate.dni_cuit === undefined) {
        // Si no viene en el update, no lo modificamos (mantener valor existente)
        delete ordenToUpdate.dni_cuit
      } else if (ordenToUpdate.dni_cuit === '') {
        ordenToUpdate.dni_cuit = null
      }
      
      console.log('📤 Actualizando orden. Payload completo:', JSON.stringify(ordenToUpdate, null, 2))
      console.log('📞 Datos de contacto en actualización:', {
        telefono: ordenToUpdate.telefono_cliente || 'null',
        ubicacion: ordenToUpdate.ubicacion_link || 'null',
        direccion: ordenToUpdate.direccion_cliente || 'null',
        email: ordenToUpdate.email_cliente || 'null',
        whatsapp: ordenToUpdate.whatsapp_link || 'null',
        drive: ordenToUpdate.drive_link || 'null',
        foto: ordenToUpdate.foto_url ? 'presente' : 'null'
      })

      const performUpdate = async (payload: Partial<OrdenTrabajo>) => {
        return supabaseClient
          .from('ordenes_trabajo')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
      }

      // Intentar actualizar primero con todos los datos
      let { data, error } = await performUpdate(ordenToUpdate)

      if (error) {
        console.error('❌ Error al actualizar orden:', error.message, error)
        const errorLower = error.message.toLowerCase()
        const isColumnError = errorLower.includes('column') || 
                              errorLower.includes('does not exist') || 
                              errorLower.includes('not found') ||
                              errorLower.includes('schema cache') ||
                              errorLower.includes('could not find')
        
        if (isColumnError) {
          // Separar foto_url de las otras columnas opcionales - foto_url es más importante
          const contactColumns = [
            'telefono_cliente',
            'email_cliente',
            'direccion_cliente',
            'whatsapp_link',
            'ubicacion_link',
            'drive_link'
          ]
          const allOptionalColumns = [
            'foto_url',
            'reclamo_motivo',
            'reclamo_costo_monto',
            'reclamo_etiquetas',
            ...contactColumns
          ]

          // Detectar SOLO las columnas que específicamente están mencionadas en el error
          const missingColumns: string[] = []
          allOptionalColumns.forEach((col) => {
            // Buscar el nombre exacto de la columna en el error (con guiones bajos y espacios)
            const colPattern = col.toLowerCase().replace(/_/g, '[ _]')
            const regex = new RegExp(colPattern, 'i')
            if (regex.test(errorLower)) {
              missingColumns.push(col)
            }
          })
          
          if (missingColumns.length > 0) {
            console.warn(`⚠️ Columnas faltantes detectadas en el error: ${missingColumns.join(', ')}`)
            // Eliminar SOLO las columnas que específicamente faltan
            const sanitizedPayload: Partial<OrdenTrabajo> = { ...ordenToUpdate }
            missingColumns.forEach((col) => {
              // @ts-expect-error index access
              delete sanitizedPayload[col]
            })

            console.log(`⚠️ Eliminando columnas faltantes: ${missingColumns.join(', ')}. Reintentando...`)
            console.log('📤 Payload sanitizado:', JSON.stringify(sanitizedPayload, null, 2))
            const fallback = await performUpdate(sanitizedPayload)
            
            if (fallback.error) {
              console.error('❌ Error persistente después de eliminar columnas:', fallback.error.message)
              // Si aún falla, puede ser otra columna. Intentar sin SOLO las columnas de contacto (mantener foto_url si existe)
              const minimalPayload: Partial<OrdenTrabajo> = { ...sanitizedPayload }
              // Solo eliminar columnas de contacto, NO foto_url
              contactColumns.forEach((col) => {
                // @ts-expect-error index access
                delete minimalPayload[col]
              })
              
              // Si foto_url estaba en el error, también eliminarlo
              if (missingColumns.includes('foto_url')) {
                delete minimalPayload.foto_url
              }
              
              console.log('⚠️ Reintentando sin columnas de contacto...')
              const finalAttempt = await performUpdate(minimalPayload)
              if (finalAttempt.error) {
                console.error('❌ Error final:', finalAttempt.error.message)
                return { success: false, error: finalAttempt.error.message }
              }
              console.log('✅ Orden actualizada sin algunas columnas opcionales')
              this.triggerEmailOrdenLista(id, estadoAnterior, finalAttempt.data as OrdenTrabajo)
              return { success: true, data: finalAttempt.data as OrdenTrabajo }
            }

            // Éxito después de eliminar columnas faltantes
            console.log(`✅ Orden actualizada. Columnas eliminadas: ${missingColumns.join(', ')}`)
            this.triggerEmailOrdenLista(id, estadoAnterior, fallback.data as OrdenTrabajo)
            return { success: true, data: fallback.data as OrdenTrabajo }
          } else {
            // El error menciona "column" pero no menciona ninguna columna específica de contacto
            // Esto podría ser un error de otra columna. Intentar de todas formas.
            console.warn('⚠️ Error de columna detectado pero no se identificaron columnas de contacto específicas. Reintentando sin columnas de contacto...')
            const minimalPayload: Partial<OrdenTrabajo> = { ...ordenToUpdate }
            contactColumns.forEach((col) => {
              // @ts-expect-error index access
              delete minimalPayload[col]
            })
            const finalAttempt = await performUpdate(minimalPayload)
            if (finalAttempt.error) {
              console.error('❌ Error final:', finalAttempt.error.message)
              return { success: false, error: finalAttempt.error.message }
            }
            console.log('✅ Orden actualizada sin columnas de contacto (fallback)')
            this.triggerEmailOrdenLista(id, estadoAnterior, finalAttempt.data as OrdenTrabajo)
            return { success: true, data: finalAttempt.data as OrdenTrabajo }
          }
        }

        // Si el error NO es por columnas faltantes, retornar el error
        console.error('❌ Error no relacionado con columnas:', error.message)
        return { success: false, error: error.message }
      }
      
      // Éxito - verificar que los datos se guardaron
      if (ordenToUpdate.telefono_cliente || ordenToUpdate.ubicacion_link || ordenToUpdate.direccion_cliente) {
        console.log('✅ Orden actualizada con datos de contacto:', {
          telefono: ordenToUpdate.telefono_cliente || 'no',
          ubicacion: ordenToUpdate.ubicacion_link || 'no',
          direccion: ordenToUpdate.direccion_cliente || 'no'
        })
      }
      
      // Log de éxito con datos guardados
      if (ordenToUpdate.telefono_cliente || ordenToUpdate.email_cliente || ordenToUpdate.direccion_cliente) {
        console.log('✅ Orden actualizada con datos de contacto:', {
          telefono: ordenToUpdate.telefono_cliente || 'no',
          email: ordenToUpdate.email_cliente || 'no',
          direccion: ordenToUpdate.direccion_cliente || 'no',
          whatsapp: ordenToUpdate.whatsapp_link || 'no',
          ubicacion: ordenToUpdate.ubicacion_link || 'no',
          drive: ordenToUpdate.drive_link || 'no'
        })
      }

      // Registrar cambios en historial si hay cambios relevantes
      const estadoNuevo = ordenToUpdate.estado || data?.estado || null
      const operarioNuevo = ordenToUpdate.operario_asignado || data?.operario_asignado || null
      const sectorNuevo = ordenToUpdate.sector || data?.sector || null
      const prioridadNueva = ordenToUpdate.prioridad || data?.prioridad || null
      const descripcionNueva = (ordenToUpdate as any)?.descripcion ?? (data as any)?.descripcion ?? null
      const planillaNueva = (ordenToUpdate as any)?.planilla_preliminar ?? (data as any)?.planilla_preliminar ?? null
      const fichaCargadaNueva = (ordenToUpdate as any)?.ficha_tecnica_cargada ?? (data as any)?.ficha_tecnica_cargada ?? null
      const presupuestoEnviadoNuevo =
        (ordenToUpdate as any)?.presupuesto_enviado_cliente ?? (data as any)?.presupuesto_enviado_cliente ?? null
      const presupuestoArmadoNuevo = (ordenToUpdate as any)?.presupuesto_armado ?? (data as any)?.presupuesto_armado ?? null
      const presupuestoEnEsperaNuevo =
        (ordenToUpdate as any)?.presupuesto_en_espera ?? (data as any)?.presupuesto_en_espera ?? null
      
      // Construir comentario descriptivo
      const cambios: string[] = []
      let checklistChanged = false
      let motivosChanged = false
      
      if (estadoAnterior !== estadoNuevo && estadoNuevo !== null) {
        cambios.push(`Estado: ${estadoAnterior || 'N/A'} → ${estadoNuevo}`)
      }
      
      const trim = (str: string | null | undefined): string => (str || '').trim()
      
      if (trim(operarioAnterior) !== trim(operarioNuevo)) {
        if (!operarioNuevo || trim(operarioNuevo) === '') {
          cambios.push('Operario desasignado')
        } else if (!operarioAnterior || trim(operarioAnterior) === '') {
          cambios.push(`Operario asignado: ${operarioNuevo}`)
        } else {
          cambios.push(`Operario: ${operarioAnterior} → ${operarioNuevo}`)
        }
      }
      
      if (sectorAnterior !== sectorNuevo && sectorNuevo !== null) {
        cambios.push(`Sector: ${sectorAnterior || 'N/A'} → ${sectorNuevo}`)
      }
      
      if (prioridadAnterior !== prioridadNueva && prioridadNueva !== null) {
        cambios.push(`Prioridad: ${prioridadAnterior || 'N/A'} → ${prioridadNueva}`)
      }

      const extractMotivos = (raw: string | null | undefined): string => {
        const s = (raw || '').trim()
        if (!s) return ''
        const marker = '\n\nMotivos:\n'
        const idx = s.indexOf(marker)
        if (idx < 0) return ''
        return s.slice(idx + marker.length).trim()
      }
      const motivosPrev = extractMotivos(descripcionAnterior)
      const motivosNext = extractMotivos(descripcionNueva)
      if (motivosPrev !== motivosNext) {
        motivosChanged = true
        const display = (v: string) => (v.trim() ? v.trim() : '—')
        cambios.push(`Motivos: ${display(motivosPrev)} → ${display(motivosNext)}`)
      }

      const pushBool = (label: string, prev: boolean | null | undefined, next: boolean | null | undefined) => {
        if (prev === next) return
        checklistChanged = true
        const prevTxt = prev === true ? 'Sí' : 'No'
        const nextTxt = next === true ? 'Sí' : 'No'
        cambios.push(`${label}: ${prevTxt} → ${nextTxt}`)
      }

      // Checklist / DT (registrar también destildados)
      pushBool('Planilla preliminar', planillaAnterior, planillaNueva)
      pushBool('Ficha técnica cargada', fichaCargadaAnterior, fichaCargadaNueva)
      pushBool('Presupuesto enviado', presupuestoEnviadoAnterior, presupuestoEnviadoNuevo)
      pushBool('Presupuesto armado', presupuestoArmadoAnterior, presupuestoArmadoNuevo)
      pushBool('Presupuesto en espera', presupuestoEnEsperaAnterior, presupuestoEnEsperaNuevo)

      const fotoNuevaData = (data as any)?.foto_url ?? null
      const fotoChangedData = normFotoUrl(fotoUrlAnterior) !== normFotoUrl(fotoNuevaData)
      if (fotoChangedData) {
        cambios.push(normFotoUrl(fotoNuevaData) ? 'Portada actualizada' : 'Portada eliminada')
      }
      
      // Registrar SIEMPRE si hay cambios relevantes (AUDITORÍA PROFESIONAL)
      if (cambios.length > 0) {
        const comentario = cambios.join(' | ')
        const cambiosDetallados: Record<string, any> = {}
        
        if (estadoAnterior !== estadoNuevo && estadoNuevo !== null) {
          cambiosDetallados.estado = { anterior: estadoAnterior, nuevo: estadoNuevo }
        }
        if (trim(operarioAnterior) !== trim(operarioNuevo)) {
          cambiosDetallados.operario = { anterior: operarioAnterior, nuevo: operarioNuevo }
        }
        if (sectorAnterior !== sectorNuevo && sectorNuevo !== null) {
          cambiosDetallados.sector = { anterior: sectorAnterior, nuevo: sectorNuevo }
        }
        if (prioridadAnterior !== prioridadNueva && prioridadNueva !== null) {
          cambiosDetallados.prioridad = { anterior: prioridadAnterior, nuevo: prioridadNueva }
        }
        if (motivosChanged) {
          cambiosDetallados.motivos = { anterior: motivosPrev, nuevo: motivosNext }
        }

        // Checklist / DT
        if (planillaAnterior !== planillaNueva) {
          cambiosDetallados.planilla_preliminar = { anterior: planillaAnterior, nuevo: planillaNueva }
        }
        if (fichaCargadaAnterior !== fichaCargadaNueva) {
          cambiosDetallados.ficha_tecnica_cargada = { anterior: fichaCargadaAnterior, nuevo: fichaCargadaNueva }
        }
        if (presupuestoEnviadoAnterior !== presupuestoEnviadoNuevo) {
          cambiosDetallados.presupuesto_enviado_cliente = {
            anterior: presupuestoEnviadoAnterior,
            nuevo: presupuestoEnviadoNuevo
          }
        }
        if (presupuestoArmadoAnterior !== presupuestoArmadoNuevo) {
          cambiosDetallados.presupuesto_armado = { anterior: presupuestoArmadoAnterior, nuevo: presupuestoArmadoNuevo }
        }
        if (presupuestoEnEsperaAnterior !== presupuestoEnEsperaNuevo) {
          cambiosDetallados.presupuesto_en_espera = {
            anterior: presupuestoEnEsperaAnterior,
            nuevo: presupuestoEnEsperaNuevo
          }
        }
        if (fotoChangedData) {
          cambiosDetallados.foto_url = { anterior: fotoUrlAnterior, nuevo: fotoNuevaData }
        }
        
        // Determinar tipo de acción
        let accionTipo = 'actualizacion'
        if (estadoAnterior !== estadoNuevo) accionTipo = 'cambio_estado'
        else if (trim(operarioAnterior) !== trim(operarioNuevo)) accionTipo = 'cambio_operario'
        else if (sectorAnterior !== sectorNuevo) accionTipo = 'cambio_sector'
        else if (checklistChanged) accionTipo = 'checklist'
        else if (motivosChanged) accionTipo = 'motivos'
        else if (fotoChangedData) accionTipo = 'portada'
        
        await this.registrarCambioHistorial(id, estadoAnterior, estadoNuevo, comentario, accionTipo, cambiosDetallados)
      }

      this.triggerEmailOrdenLista(id, estadoAnterior, data as OrdenTrabajo)
      return { success: true, data: data as OrdenTrabajo }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(orden)
      })
    }

    const index = fallbackOrdenes.findIndex((o) => o.id === id)
    if (index === -1) return { success: false, error: 'Orden no encontrada' }
    fallbackOrdenes[index] = { ...fallbackOrdenes[index], ...orden }
    return { success: true, data: fallbackOrdenes[index] }
  }

  /**
   * Biblioteca / administración: vuelve a mostrar la OP en el tablero general.
   * - Si estaba oculta (visible_en_tablero=false): la vuelve visible.
   * - Si estaba eliminada lógicamente: la desmarca y limpia motivo/fecha (sin pasar por updateOrden, que bloquea edits sobre eliminada=true).
   * - Si estaba entregada/archivada: desmarca entregado y limpia fecha_entrega_efectiva para que vuelva al tablero.
   * Registra auditoría en historial_movimientos (quién hizo restart).
   */
  private async registrarRestartTableroHistorial(
    orden: OrdenTrabajo,
    ctx: {
      estadoAnterior: string | null
      eraOculta: boolean
      eraEliminada: boolean
      eraEntregada: boolean
      sectorAnterior: string | null
      numeroOp: string | null
      cliente: string | null
      motivoEliminacion: string | null
    }
  ): Promise<void> {
    const partes: string[] = []
    if (ctx.eraEliminada) partes.push('eliminada')
    if (ctx.eraOculta) partes.push('oculta del tablero')
    if (ctx.eraEntregada) partes.push('entregada/archivada')
    const detalleEstado = partes.length ? partes.join(', ') : 'restauración manual'
    const { nombre } = this.getCurrentUser()
    const comentario = `${nombre} restauró la OP al tablero desde biblioteca (${detalleEstado}).`

    await this.registrarCambioHistorial(
      orden.id!,
      ctx.estadoAnterior,
      orden.estado ?? orden.sector ?? 'visible_en_tablero',
      comentario,
      'restart_tablero',
      {
        origen: 'restartOrdenParaTablero',
        numero_op: orden.numero_op ?? ctx.numeroOp,
        cliente: orden.cliente ?? ctx.cliente,
        visible_en_tablero_antes: !ctx.eraOculta,
        eliminada_antes: ctx.eraEliminada,
        entregado_antes: ctx.eraEntregada,
        sector_anterior: ctx.sectorAnterior,
        sector_restaurado: orden.sector ?? null,
        motivo_eliminacion_antes: ctx.motivoEliminacion
      }
    )
  }

  private async finalizarRestartOrden(
    orden: OrdenTrabajo,
    ctx: {
      estadoAnterior: string | null
      eraOculta: boolean
      eraEliminada: boolean
      eraEntregada: boolean
      sectorAnterior: string | null
      numeroOp: string | null
      cliente: string | null
      motivoEliminacion: string | null
    }
  ): Promise<OrdenTrabajo> {
    await this.registrarRestartTableroHistorial(orden, ctx)
    applyOrdenRestartLocally(orden)
    return orden
  }

  async restartOrdenParaTablero(id: number): Promise<ApiResponse<OrdenTrabajo>> {
    if (!supabase) {
      const index = fallbackOrdenes.findIndex((o) => o.id === id)
      if (index === -1) return { success: false, error: 'Orden no encontrada' }
      const antes = fallbackOrdenes[index]
      const auditCtx = {
        estadoAnterior: antes.estado ?? null,
        eraOculta: antes.visible_en_tablero === false,
        eraEliminada: antes.eliminada === true,
        eraEntregada: antes.entregado === true,
        sectorAnterior: antes.sector ?? null,
        numeroOp: antes.numero_op ?? null,
        cliente: antes.cliente ?? null,
        motivoEliminacion: antes.motivo_eliminacion ?? null
      }
      fallbackOrdenes[index] = {
        ...antes,
        visible_en_tablero: true,
        eliminada: false,
        motivo_eliminacion: null,
        fecha_eliminacion: null,
        entregado: false,
        fecha_entrega_efectiva: null
      }
      const ordenFb = fallbackOrdenes[index]
      await this.registrarRestartTableroHistorial(ordenFb, auditCtx)
      applyOrdenRestartLocally(ordenFb)
      return { success: true, data: ordenFb }
    }

    try {
      const r0 = await supabase
        .from('ordenes_trabajo')
        .select(
          'id, eliminada, entregado, sector, sector_inicial, estado, visible_en_tablero, numero_op, cliente, motivo_eliminacion'
        )
        .eq('id', id)
        .maybeSingle()
      if (r0.error) return { success: false, error: r0.error.message }
      if (!r0.data || !(r0.data as { id?: number }).id) {
        return { success: false, error: 'Orden no encontrada.' }
      }

      const row = r0.data as {
        eliminada?: boolean | null
        entregado?: boolean | null
        sector?: string | null
        sector_inicial?: string | null
        estado?: string | null
        visible_en_tablero?: boolean | null
        numero_op?: string | null
        cliente?: string | null
        motivo_eliminacion?: string | null
      }

      const auditCtx = {
        estadoAnterior: row.estado?.trim() || row.sector?.trim() || null,
        eraOculta: row.visible_en_tablero === false,
        eraEliminada: row.eliminada === true,
        eraEntregada: row.entregado === true,
        sectorAnterior: row.sector?.trim() || null,
        numeroOp: row.numero_op?.trim() || null,
        cliente: row.cliente?.trim() || null,
        motivoEliminacion: row.motivo_eliminacion?.trim() || null
      }

      const patch: Record<string, unknown> = { visible_en_tablero: true }
      const eliminada = row.eliminada === true
      if (eliminada) {
        patch.eliminada = false
        patch.motivo_eliminacion = null
        patch.fecha_eliminacion = null
      }
      if (row.entregado === true) {
        patch.entregado = false
        patch.fecha_entrega_efectiva = null
      }
      const sectorRestaurar =
        (row.sector && String(row.sector).trim()) ||
        (row.sector_inicial && String(row.sector_inicial).trim()) ||
        (row.estado && String(row.estado).trim()) ||
        null
      if (!row.sector?.trim() && sectorRestaurar) {
        patch.sector = sectorRestaurar
        if (!row.estado?.trim()) patch.estado = sectorRestaurar
      }

      const { data, error } = await supabase.from('ordenes_trabajo').update(patch).eq('id', id).select('*').maybeSingle()

      if (error) {
        const msg = error.message || ''
        if (eliminada && msg.includes('fecha_eliminacion')) {
          const { data: data2, error: err2 } = await supabase
            .from('ordenes_trabajo')
            .update({
              visible_en_tablero: true,
              eliminada: false,
              motivo_eliminacion: null,
              ...(sectorRestaurar ? { sector: sectorRestaurar, estado: sectorRestaurar } : {}),
              ...(row.entregado === true
                ? { entregado: false, fecha_entrega_efectiva: null }
                : {})
            })
            .eq('id', id)
            .select('*')
            .maybeSingle()
          if (err2) return { success: false, error: err2.message }
          const orden2 = await this.finalizarRestartOrden(data2 as OrdenTrabajo, auditCtx)
          return { success: true, data: orden2 }
        }
        if (row.entregado === true && msg.includes('fecha_entrega_efectiva')) {
          const { data: data3, error: err3 } = await supabase
            .from('ordenes_trabajo')
            .update({
              visible_en_tablero: true,
              entregado: false,
              ...(sectorRestaurar ? { sector: sectorRestaurar, estado: sectorRestaurar } : {}),
              ...(eliminada
                ? { eliminada: false, motivo_eliminacion: null, fecha_eliminacion: null }
                : {})
            })
            .eq('id', id)
            .select('*')
            .maybeSingle()
          if (err3) return { success: false, error: err3.message }
          const orden3 = await this.finalizarRestartOrden(data3 as OrdenTrabajo, auditCtx)
          return { success: true, data: orden3 }
        }
        return { success: false, error: msg || 'No se pudo restaurar la OP.' }
      }
      if (!data) return { success: false, error: 'No se devolvió la orden actualizada.' }
      const orden = await this.finalizarRestartOrden(data as OrdenTrabajo, auditCtx)
      return { success: true, data: orden }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al restaurar la OP.'
      return { success: false, error: msg }
    }
  }

  /**
   * Tras guardar el modal de edición con cambios en sectores[]: propaga el array a todo el grupo de la OP
   * y crea fichas duplicadas faltantes (misma idea que el trigger en INSERT). Requiere el RPC en Supabase.
   */
  async syncOpGrupoSectoresYFichas(ordenId: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: true }
    try {
      const { error } = await supabase.rpc('sync_op_grupo_sectores_y_fichas', { p_orden_id: ordenId })
      if (error) {
        console.warn('sync_op_grupo_sectores_y_fichas:', error.message)
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar sectores del grupo OP'
      return { success: false, error: msg }
    }
  }

  /**
   * Todas las filas `ordenes_trabajo` con el mismo `numero_op` quedan con el mismo flag (persistido en BD).
   */
  async setEspejoSectoresOpGrupo(
    numeroOp: string,
    enabled: boolean
  ): Promise<ApiResponse<{ updated: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const op = String(numeroOp ?? '').trim()
    if (!op) return { success: false, error: 'Número de OP vacío' }
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .update({ espejo_sectores_op: enabled })
        .eq('numero_op', op)
        .select('id')
      if (error) return { success: false, error: error.message }
      const rows = (data as Array<{ id: number }> | null) ?? []
      return { success: true, data: { updated: rows.length } }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar modo espejo'
      return { success: false, error: msg }
    }
  }

  /**
   * Modo espejo (multi-sector): aplica el mismo payload de datos comunes de la OP al resto de filas
   * con el mismo `numero_op` (excluye la fila origen). No toca estado Kanban ni etapas por sector.
   */
  async propagateEspejoGrupoOrden(
    sourceOrdenId: number,
    numeroOp: string,
    payloadAfterSave: Partial<OrdenTrabajo>
  ): Promise<{ success: boolean; error?: string; propagatedIds: number[] }> {
    if (!supabase) return { success: true, propagatedIds: [] }
    const op = String(numeroOp ?? '').trim()
    if (!op) return { success: true, propagatedIds: [] }

    const mirror = stripPayloadForEspejoGrupo(payloadAfterSave)
    const keys = Object.keys(mirror).filter((k) => (mirror as Record<string, unknown>)[k] !== undefined)
    if (keys.length === 0) return { success: true, propagatedIds: [] }

    const minimalMirror: Partial<OrdenTrabajo> = {}
    for (const k of keys) {
      ;(minimalMirror as Record<string, unknown>)[k] = (mirror as Record<string, unknown>)[k]
    }

    let q = supabase.from('ordenes_trabajo').select('id, eliminada, visible_en_tablero').eq('numero_op', op).neq('id', sourceOrdenId)

    const { data: rows, error } = await q
    if (error) {
      return { success: false, error: error.message, propagatedIds: [] }
    }

    const list = (rows as Array<{ id: number; eliminada?: boolean | null; visible_en_tablero?: boolean | null }>) ?? []
    const targets = list.filter(
      (r) => r?.id && r.eliminada !== true && r.visible_en_tablero !== false
    )
    if (targets.length === 0) return { success: true, propagatedIds: [] }

    const propagatedIds: number[] = []
    const errors: string[] = []
    for (const t of targets) {
      const r = await this.updateOrden(t.id, minimalMirror)
      if (r.success) {
        propagatedIds.push(t.id)
      } else if (r.error) {
        errors.push(`#${t.id}: ${r.error}`)
      }
    }

    if (errors.length > 0 && propagatedIds.length === 0) {
      return { success: false, error: errors.join(' · '), propagatedIds: [] }
    }
    if (errors.length > 0) {
      console.warn('[propagateEspejoGrupoOrden] parcial:', errors.join(' · '))
    }
    return { success: true, propagatedIds }
  }

  async deleteOrden(
    id: number,
    options?: {
      motivo?: string
      usuarioId?: number | null
      usuarioNombre?: string | null
      estadoAnterior?: string | null
    }
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const delGuard = await this.assertOpNotLockedForMutation(id)
        if (!delGuard.ok) return { success: false, error: delGuard.error }

        let rowEstado: { id?: number; eliminada?: boolean | null } | null = null
        const rExist = await supabase.from('ordenes_trabajo').select('id, eliminada').eq('id', id).maybeSingle()
        if (rExist.error && isMissingElEliminadaColumnError(rExist.error.message)) {
          const rId = await supabase.from('ordenes_trabajo').select('id').eq('id', id).maybeSingle()
          if (rId.error) return { success: false, error: rId.error.message }
          rowEstado = (rId.data as { id?: number }) ?? null
        } else if (rExist.error) {
          return { success: false, error: rExist.error.message }
        } else {
          rowEstado = rExist.data as { id?: number; eliminada?: boolean | null }
          if (rowEstado?.eliminada === true) {
            return { success: false, error: 'Esta OP ya está marcada como eliminada.' }
          }
        }
        if (!rowEstado?.id) {
          return { success: false, error: 'Orden no encontrada.' }
        }

        // Registrar SIEMPRE la eliminación y si falla, NO marcar borrado (para no perder auditoría)
        const { id: currentUserId, nombre: currentUserName } = this.getCurrentUser()
        const changes: Record<string, any> = { origen: 'deleteOrden_frontend' }
        if (options?.motivo) changes.motivo = options.motivo
        if (options?.estadoAnterior) changes.estado_anterior = options.estadoAnterior

        // Capturar datos clave para auditoría (borrado lógico: la fila sigue en ordenes_trabajo)
        try {
          const { data: ordenInfo } = await supabase
            .from('ordenes_trabajo')
            .select('numero_op, cliente')
            .eq('id', id)
            .maybeSingle()
          if (ordenInfo) {
            ;(changes as any).numero_op = (ordenInfo as any).numero_op ?? null
            ;(changes as any).cliente = (ordenInfo as any).cliente ?? null
          }
        } catch {
          // ignore: no bloquear auditoría por este lookup
        }

        const { error: auditError } = await supabase.rpc('registrar_cambio_manual_v2', {
          p_id_orden: id,
          p_id_usuario: currentUserId,
          p_nombre_usuario: currentUserName,
          p_estado_anterior: options?.estadoAnterior ?? null,
          p_estado_nuevo: 'ELIMINADA',
          p_comentario: options?.motivo || 'Eliminación de OP desde la app principal.',
          p_accion_tipo: 'eliminacion',
          p_cambios_detallados: changes as any,
          p_ip_address: null,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
        })

        if (auditError) {
          return {
            success: false,
            error:
              auditError.message ||
              'No se pudo registrar la auditoría de eliminación. No se marcó la OP como eliminada.'
          }
        }

        const motivoFinal = (options?.motivo || '').trim() || 'Eliminación de OP desde la app principal.'
        const { error } = await supabase
          .from('ordenes_trabajo')
          .update({
            eliminada: true,
            motivo_eliminacion: motivoFinal,
            fecha_eliminacion: new Date().toISOString(),
            visible_en_tablero: false
          })
          .eq('id', id)
        if (error && isMissingElEliminadaColumnError(error.message)) {
          const { error: e2 } = await supabase
            .from('ordenes_trabajo')
            .update({ visible_en_tablero: false })
            .eq('id', id)
          if (e2) return { success: false, error: e2.message }
          console.warn(
            '[deleteOrden] La BD no tiene columna ordenes_trabajo.eliminada; se ocultó del tablero. Aplicá supabase/patches/2026-04-27_ordenes_soft_delete_eliminada.sql para borrado lógico completo.'
          )
          void import('../utils/ordenesBroadcast')
            .then((m) => m.broadcastOrdenesChanged())
            .catch(() => {})
          return { success: true }
        }
        if (error) return { success: false, error: error.message }
        void import('../utils/ordenesBroadcast')
          .then((m) => m.broadcastOrdenesChanged())
          .catch(() => {})
        return { success: true }
      } catch (e: any) {
        console.error('Error eliminando orden con auditoría:', e)
        return {
          success: false,
          error: e?.message || 'Error al eliminar la orden'
        }
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`, { method: 'DELETE' })
    }

    const index = fallbackOrdenes.findIndex((o) => o.id === id)
    if (index >= 0) fallbackOrdenes.splice(index, 1)
    return { success: true }
  }

  /**
   * Política: deleteOrden hace borrado lógico (eliminada=true, motivo, visible_en_tablero=false).
   * La “fusión” por movimiento solo oculta la ficha duplicada (visible_en_tablero = false), sin borrarla.
   * Antes de ocultar, unifica en la fila visible los flags que pintan la tarjeta (planilla, FT incompleta, checklists, PDF).
   */
  private async fusionarOrdenesDuplicadas(keepId: number, removeId: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const sb = supabase

    try {
      const mergeVisualFlags = async () => {
        const fullSelect =
          'id, planilla_preliminar, ficha_tecnica_incompleta, ficha_tecnica_cargada, presupuesto_enviado_cliente, ficha_tecnica_pdf_url'
        let pair: Array<Record<string, unknown>> | null = null
        const r1 = await sb.from('ordenes_trabajo').select(fullSelect).in('id', [keepId, removeId])
        if (r1.error && /ficha_tecnica_incompleta|column/i.test(String(r1.error.message))) {
          const r2 = await sb
            .from('ordenes_trabajo')
            .select(
              'id, planilla_preliminar, ficha_tecnica_cargada, presupuesto_enviado_cliente, ficha_tecnica_pdf_url'
            )
            .in('id', [keepId, removeId])
          if (!r2.error) pair = r2.data as Array<Record<string, unknown>>
        } else if (!r1.error) {
          pair = r1.data as Array<Record<string, unknown>>
        }

        if (!pair || pair.length < 2) return

        const a = pair.find((row) => Number(row.id) === keepId)
        const b = pair.find((row) => Number(row.id) === removeId)
        if (!a || !b) return

        const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
        const pdfA = str(a.ficha_tecnica_pdf_url)
        const pdfB = str(b.ficha_tecnica_pdf_url)
        const merged: Record<string, unknown> = {
          planilla_preliminar: Boolean(a.planilla_preliminar) || Boolean(b.planilla_preliminar),
          ficha_tecnica_cargada: Boolean(a.ficha_tecnica_cargada) || Boolean(b.ficha_tecnica_cargada),
          presupuesto_enviado_cliente: Boolean(a.presupuesto_enviado_cliente) || Boolean(b.presupuesto_enviado_cliente),
          ficha_tecnica_pdf_url: pdfA || pdfB || null
        }
        if ('ficha_tecnica_incompleta' in a || 'ficha_tecnica_incompleta' in b) {
          merged.ficha_tecnica_incompleta =
            Boolean(a.ficha_tecnica_incompleta) || Boolean(b.ficha_tecnica_incompleta)
        }

        const { error: mergeErr } = await sb.from('ordenes_trabajo').update(merged).eq('id', keepId)
        if (mergeErr) {
          console.warn('fusionarOrdenesDuplicadas: no se pudieron unificar colores/flags en fila', keepId, mergeErr)
        }
      }

      await mergeVisualFlags()

      await sb.from('enlaces_adjuntos').update({ id_orden: keepId }).eq('id_orden', removeId)
      await sb.from('comentarios_orden').update({ id_orden: keepId }).eq('id_orden', removeId)
      await sb.from('tarea_subitems').update({ id_orden: keepId }).eq('id_orden', removeId)
      await sb.from('historial_movimientos').update({ id_orden: keepId }).eq('id_orden', removeId)

      // sector NULL excluye la fila de ux_ordenes_op_sector (índice parcial WHERE sector IS NOT NULL).
      // Requiere que `sector` no tenga NOT NULL en la tabla (parche 2026-04-02_ordenes_trabajo_sector_nullable_fusion.sql).
      const { error: hideError } = await sb
        .from('ordenes_trabajo')
        .update({ visible_en_tablero: false, sector: null })
        .eq('id', removeId)

      if (hideError) {
        const code = (hideError as { code?: string }).code
        const hint23502 =
          code === '23502' ||
          (String(hideError.message || '').includes('sector') &&
            String(hideError.message || '').toLowerCase().includes('not-null'))
            ? ' Ejecutá en Supabase: supabase/patches/2026-04-02_ordenes_trabajo_sector_nullable_fusion.sql'
            : ''
        console.error(
          'fusionarOrdenesDuplicadas: no se pudo ocultar ficha (¿falta visible_en_tablero o sector NOT NULL?):',
          hideError,
          hint23502 || undefined
        )
        return {
          success: false,
          error: hideError.message ? `${hideError.message}${hint23502}` : hideError.message
        }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || 'No se pudo fusionar órdenes duplicadas' }
    }
  }

  /** Mensaje legible si el CHECK de sector en BD no incluye el flujo Asesor (falta migración SQL). */
  private explainOrdenSectorCheckError(message: string): string {
    const m = String(message || '')
    if (/ordenes_trabajo_sector_check|check constraint.*sector/i.test(m)) {
      return (
        'La base de datos no tiene actualizado el listado de sectores del flujo Asesor/Presupuestos ' +
        '(Armados/Enviados, No Aprobados, etc.). En Supabase → SQL Editor ejecutá el archivo del repo: ' +
        'supabase/patches/2026-04-01_fix_asesor_kanban_sector_check.sql'
      )
    }
    return message
  }

  async moveOrden(id: number, nuevoEstado: string, usuarioId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data: current, error: fetchError } = await supabase
        .from('ordenes_trabajo')
        .select('id, numero_op, estado, sector, es_duplicado, id_orden_original, op_bloqueada, operario_asignado')
        .eq('id', id)
        .maybeSingle()

      if (fetchError || !current) {
        return { success: false, error: fetchError?.message || 'Orden no encontrada' }
      }
      const currentData = current as {
        id: number
        numero_op: string
        estado: string
        sector: string
        es_duplicado?: boolean | null
        id_orden_original?: number | null
        op_bloqueada?: boolean | null
        operario_asignado?: string | null
      }
      if (currentData.op_bloqueada && !this.isAdminOrGerenciaRole()) {
        return {
          success: false,
          error:
            'Esta OP está trabada: no se puede mover hasta que el operario asignado la destabe (administración/gerencia puede hacerlo).'
        }
      }
      const currentEstado = currentData.estado
      
      // Mapear el nuevo estado al sector correspondiente
      const estadoToSector: Record<string, string> = {
        'Diseño Gráfico': 'Diseño Gráfico',
        'Diseño en Proceso': 'Diseño en Proceso',
        'En Espera': 'En Espera',
        'Imprenta (Área de Impresión)': 'Imprenta (Área de Impresión)',
        'Taller de Imprenta': 'Taller de Imprenta',
        'Taller Gráfico': 'Taller Gráfico',
        Instalaciones: 'Instalaciones',
        Metalúrgica: 'Metalúrgica',
        'Finalizado en Taller': 'Finalizado en Taller',
        'Almacén de Entrega': 'Almacén de Entrega',
        'Asesor Técnico': 'Asesor Técnico',
        Presupuestos: 'Presupuestos',
        'Armados/Enviados': 'Armados/Enviados',
        'No Aprobados': 'No Aprobados',
        Finalizado: 'Finalizado'
      }

      const nuevoSector = estadoToSector[nuevoEstado] || nuevoEstado

      // Fusión por llegada (cadena de duplicadas/triplicadas):
      // 1) Primero buscar hermana por grupo (id_orden_original / raiz del grupo) en sector destino.
      // 2) Si no existe, fallback por OP+sector para cubrir registros legacy sin cadena completa.
      const groupRootId = currentData.es_duplicado ? (currentData.id_orden_original ?? currentData.id) : currentData.id
      let destinationId: number | undefined

      const { data: siblingRows, error: siblingError } = await supabase
        .from('ordenes_trabajo')
        .select('id, visible_en_tablero')
        .eq('sector', nuevoSector)
        .neq('id', id)
        .or(`id.eq.${groupRootId},id_orden_original.eq.${groupRootId}`)
        .limit(25)

      if (siblingError) {
        return { success: false, error: siblingError.message }
      }

      const rowsSib = siblingRows as Array<{ id: number; visible_en_tablero?: boolean | null }> | null
      // Solo fusionar con una ficha visible en tablero; nunca elegir una ya oculta (rompe UPDATE / UX rebote).
      const sib = rowsSib?.find((r) => r.visible_en_tablero !== false)
      destinationId = sib?.id

      if (!destinationId) {
        const { data: destinationRows, error: destinationError } = await supabase
          .from('ordenes_trabajo')
          .select('id, visible_en_tablero')
          .eq('numero_op', currentData.numero_op)
          .eq('sector', nuevoSector)
          .neq('id', id)
          .limit(25)

        if (destinationError) {
          return { success: false, error: destinationError.message }
        }
        const rowsDest = destinationRows as Array<{ id: number; visible_en_tablero?: boolean | null }> | null
        const dest = rowsDest?.find((r) => r.visible_en_tablero !== false)
        destinationId = dest?.id
      }

      if (destinationId) {
        const fusionRes = await this.fusionarOrdenesDuplicadas(id, destinationId)
        if (!fusionRes.success) return fusionRes

        const { error: alignAfterFusionError } = await supabase
          .from('ordenes_trabajo')
          .update({
            estado: nuevoEstado,
            sector: nuevoSector
          })
          .eq('id', id)

        if (alignAfterFusionError) {
          return { success: false, error: this.explainOrdenSectorCheckError(alignAfterFusionError.message || '') }
        }

        await this.registrarCambioHistorial(
          id,
          currentEstado,
          nuevoEstado,
          `Fusión por llegada al sector "${nuevoSector}" (ficha ${destinationId} oculta del tablero, sin borrar fila)`,
          'edicion_ficha',
          {
            fusion_oculta_tablero: {
              id_conservada: id,
              id_oculta: destinationId,
              sector: nuevoSector,
              motivo: 'fusion_por_llegada'
            }
          }
        )

        return {
          success: true,
          data: { id, estado: nuevoEstado, fusionada: true, fusionadaId: destinationId }
        }
      }

      // ⚠️ IMPORTANTE: Actualizar tanto estado como sector
      const { error: updateError } = await supabase
        .from('ordenes_trabajo')
        .update({ 
          estado: nuevoEstado,
          sector: nuevoSector  // Actualizar el sector también
        })
        .eq('id', id)

      if (updateError) {
        const updateErrorMessage = updateError.message || ''
        // Fallback robusto: si choca contra unicidad (numero_op+sector), fusionar en caliente.
        if (updateErrorMessage.includes('ux_ordenes_op_sector') || updateErrorMessage.includes('duplicate key value')) {
          const { data: conflictingRows, error: conflictingError } = await supabase
            .from('ordenes_trabajo')
            .select('id, visible_en_tablero')
            .eq('numero_op', currentData.numero_op)
            .eq('sector', nuevoSector)
            .neq('id', id)
            .limit(25)

          if (conflictingError) {
            return { success: false, error: conflictingError.message }
          }

          const rowsConf = conflictingRows as Array<{ id: number; visible_en_tablero?: boolean | null }> | null
          const conflictingId = rowsConf?.find((r) => r.visible_en_tablero !== false)?.id
          if (conflictingId) {
            const fusionRes = await this.fusionarOrdenesDuplicadas(id, conflictingId)
            if (!fusionRes.success) return fusionRes

            const { error: alignAfterCollisionFusionError } = await supabase
              .from('ordenes_trabajo')
              .update({
                estado: nuevoEstado,
                sector: nuevoSector
              })
              .eq('id', id)

            if (alignAfterCollisionFusionError) {
              return {
                success: false,
                error: this.explainOrdenSectorCheckError(alignAfterCollisionFusionError.message || '')
              }
            }

            await this.registrarCambioHistorial(
              id,
              currentEstado,
              nuevoEstado,
              `Fusión por colisión OP+sector "${currentData.numero_op}" en "${nuevoSector}" (ficha ${conflictingId} oculta del tablero)`,
              'edicion_ficha',
              {
                fusion_oculta_tablero: {
                  id_conservada: id,
                  id_oculta: conflictingId,
                  sector: nuevoSector,
                  motivo: 'colision_unica_numero_op_sector'
                }
              }
            )

            return {
              success: true,
              data: { id, estado: nuevoEstado, fusionada: true, fusionadaId: conflictingId }
            }
          }
        }

        return { success: false, error: this.explainOrdenSectorCheckError(updateErrorMessage) }
      }

      // Registrar movimiento con auditoría profesional
      await this.registrarCambioHistorial(
        id,
        currentEstado,
        nuevoEstado,
        `Ficha movida de "${currentEstado}" a "${nuevoEstado}"`,
        'cambio_estado',
        {
          estado: { anterior: currentEstado, nuevo: nuevoEstado },
          sector: { anterior: current?.sector || null, nuevo: nuevoSector }
        }
      )

      // Si la orden llega a un estado final, finalizar el uso de impresora si está asignada
      // El trigger en la BD también lo hará automáticamente, pero esto asegura que se haga inmediatamente
      if (nuevoEstado === 'Finalizado en Taller' || nuevoEstado === 'Almacén de Entrega' || nuevoEstado === 'Entregado o Instalado') {
        try {
          const usoActivoResponse = await this.getUsoActivoPorOrden(id)
          if (usoActivoResponse.success && usoActivoResponse.data) {
            const usoActivo = usoActivoResponse.data as { id: number; id_impresora: number }
            const finalizarResponse = await this.finalizarUsoImpresora(usoActivo.id, usoActivo.id_impresora)
            if (!finalizarResponse.success) {
              console.error('Error al finalizar uso de impresora:', finalizarResponse.error)
            }
          }
        } catch (error) {
          console.error('Error al procesar finalización de impresora:', error)
        }
      }

      return { success: true, data: { id, estado: nuevoEstado } }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/ordenes/mover.php', {
        method: 'POST',
        body: JSON.stringify({ id_orden: id, estado_nuevo: nuevoEstado, id_usuario: usuarioId })
      })
    }

    return this.updateOrden(id, { estado: nuevoEstado })
  }

  async setOrdenWorkingUser(id: number, workingUser: string | null): Promise<ApiResponse<void>> {
    if (supabase) {
      const guard = await this.assertOpNotLockedForMutation(id)
      if (!guard.ok) return { success: false, error: guard.error }

      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ usuario_trabajando_nombre: workingUser })
        .eq('id', id)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ usuario_trabajando_nombre: workingUser })
      })
    }

    const index = fallbackOrdenes.findIndex((orden) => orden.id === id)
    if (index >= 0) {
      fallbackOrdenes[index].usuario_trabajando_nombre = workingUser ?? null
      return { success: true }
    }

    return { success: false, error: 'Orden no encontrada' }
  }

  async marcarEntregado(id: number, entregado: boolean): Promise<ApiResponse<void>> {
    if (supabase) {
      const lockGuard = await this.assertOpNotLockedForMutation(id)
      if (!lockGuard.ok) return { success: false, error: lockGuard.error }

      // Obtener el estado y sector actual antes de actualizar
      const { data: current, error: fetchError } = await supabase
        .from('ordenes_trabajo')
        .select('estado, sector')
        .eq('id', id)
        .maybeSingle()

      if (fetchError || !current) {
        return { success: false, error: fetchError?.message || 'Orden no encontrada' }
      }

      const estadoAnterior = (current as { estado: string; sector: string }).estado
      const sectorActual = (current as { estado: string; sector: string }).sector

      // Si se marca como entregado, cambiar estado a "Entregado o Instalado"
      // Si se desmarca, restaurar a "Almacén de Entrega"
      // ⚠️ IMPORTANTE: NO cambiar el sector, mantener el sector actual (debe ser válido según el check constraint)
      const nuevoEstado = entregado ? 'Entregado o Instalado' : 'Almacén de Entrega'
      // El sector debe mantenerse como "Almacén de Entrega" (o el que tenía antes) porque
      // "Entregado o Instalado" NO es un valor válido según el check constraint ordenes_trabajo_sector_check
      const sectorFinal = entregado 
        ? (sectorActual === 'Almacén de Entrega' ? 'Almacén de Entrega' : sectorActual)
        : 'Almacén de Entrega'

      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ 
          entregado,
          estado: nuevoEstado,
          sector: sectorFinal // Mantener sector válido según el check constraint
        })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      // Registrar en historial (AUDITORÍA PROFESIONAL)
      if (entregado) {
        await this.registrarCambioHistorial(
          id,
          estadoAnterior,
          nuevoEstado,
          'Ficha marcada como entregada y archivada',
          'cambio_estado',
          {
            estado: { anterior: estadoAnterior, nuevo: nuevoEstado },
            sector: { anterior: sectorActual, nuevo: sectorFinal },
            accion: 'marcar_entregado'
          }
        )
      } else {
        // Si se desmarca, también registrar el cambio
        await this.registrarCambioHistorial(
          id,
          estadoAnterior,
          nuevoEstado,
          'Ficha desarchivada y restaurada a Almacén de Entrega',
          'cambio_estado',
          {
            estado: { anterior: estadoAnterior, nuevo: nuevoEstado },
            sector: { anterior: sectorActual, nuevo: sectorFinal },
            accion: 'desmarcar_entregado'
          }
        )
      }

      return { success: true }
    }

    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async procesarEntrega(
    id: number,
    datosEntrega: {
      firmaDataUrl: string
      entregadoA: string
      dniRetira?: string
      observaciones?: string
      usuarioId: number
      usuarioNombre: string
    }
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      // Actualizar la orden con los datos de entrega
      const { error: updateError } = await supabase
        .from('ordenes_trabajo')
        .update({
          entregado: true,
          estado: 'Entregado o Instalado',
          firma_data_url: datosEntrega.firmaDataUrl,
          entregado_a: datosEntrega.entregadoA,
          dni_retira: datosEntrega.dniRetira || null,
          observaciones_entrega: datosEntrega.observaciones || null,
          fecha_entrega_efectiva: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) return { success: false, error: updateError.message }

      // Registrar en historial (AUDITORÍA PROFESIONAL)
      await this.registrarCambioHistorial(
        id,
        'Almacén de Entrega',
        'Entregado o Instalado',
        `Orden entregada a ${datosEntrega.entregadoA}${datosEntrega.dniRetira ? ` (DNI: ${datosEntrega.dniRetira})` : ''}`,
        'procesar_entrega',
        {
          estado: { anterior: 'Almacén de Entrega', nuevo: 'Entregado o Instalado' },
          entrega: {
            entregado_a: datosEntrega.entregadoA,
            dni_retira: datosEntrega.dniRetira || null,
            observaciones: datosEntrega.observaciones || null
          }
        }
      )

      return { success: true }
    }

    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Aviso inmediato a Taller Gráfico (Supabase Realtime Broadcast).
   * Desde la pantalla de entrega: operarios con rol taller-grafico suscritos al canal muestran modal y alerta sonora.
   */
  async broadcastPedidoTallerGraficoDesdeEntrega(
    input: TallerGraficoPedidoEntregaInput
  ): Promise<ApiResponse<void>> {
    const sb = supabase
    if (!sb) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    const payload = {
      ...input,
      sentAt: new Date().toISOString(),
      nonce:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
    }

    return await new Promise((resolve) => {
      let settled = false
      const ch = sb.channel(TALLER_GRAFICO_PEDIDO_ENTREGA_CHANNEL, {
        config: { broadcast: { ack: false } }
      })

      const done = async (out: ApiResponse<void>) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        try {
          await sb.removeChannel(ch)
        } catch {
          /* ignore */
        }
        resolve(out)
      }

      const timeoutId = window.setTimeout(() => {
        void done({ success: false, error: 'Tiempo de espera al enviar el aviso a Taller Gráfico. Reintentá.' })
      }, 12000)

      ch.subscribe((status) => {
        if (settled) return
        if (status === 'SUBSCRIBED') {
          void ch
            .send({
              type: 'broadcast',
              event: TALLER_GRAFICO_PEDIDO_ENTREGA_EVENT,
              payload
            })
            .then((sendResult) => {
              if (sendResult === 'ok') void done({ success: true })
              else void done({ success: false, error: `Realtime: ${String(sendResult)}` })
            })
            .catch((e: unknown) => {
              void done({
                success: false,
                error: e instanceof Error ? e.message : 'No se pudo enviar el aviso'
              })
            })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void done({ success: false, error: `Canal Realtime: ${status}` })
        }
      })
    })
  }

  // ===== SUBTAREAS / CHECKLIST =====
  async getSubitems(idOrden: number): Promise<ApiResponse<TareaSubitem[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('tarea_subitems')
        .select('*')
        .eq('id_orden', idOrden)
        // Ordenar por id para evitar depender de columnas no presentes en esquemas antiguos
        .order('id', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as TareaSubitem[]) ?? [] }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async createSubitem(payload: {
    idOrden: number
    titulo: string
    duracionEstimadaMin?: number | null
  }): Promise<ApiResponse<TareaSubitem>> {
    if (supabase) {
      const duracion =
        typeof payload.duracionEstimadaMin === 'number' && Number.isFinite(payload.duracionEstimadaMin)
          ? Math.max(0, Math.round(payload.duracionEstimadaMin))
          : 15
      const { data, error } = await supabase
        .from('tarea_subitems')
        .insert({
          id_orden: payload.idOrden,
          titulo: payload.titulo,
          duracion_estimada_min: duracion
        })
        .select()
        .single()
      if (error || !data) return { success: false, error: error?.message || 'No se pudo crear la subtarea' }
      return { success: true, data: data as TareaSubitem }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async toggleSubitemDone(id: number, done: boolean, startedAt?: string | null): Promise<ApiResponse<void>> {
    if (supabase) {
      // si se marca como done y hay un timer en curso, sumarlo
      let extraSeconds = 0
      if (done && startedAt) {
        const started = new Date(startedAt).getTime()
        extraSeconds = Math.max(0, Math.round((Date.now() - started) / 1000))
      }

      const { error } = await supabase.rpc('tarea_subitems_toggle_done', {
        p_id: id,
        p_done: done,
        p_extra_seconds: extraSeconds
      }).select()

      // si la RPC no existe, hacer fallback con update
      if (error) {
        const updateData: Partial<TareaSubitem> & { tiempo_invertido_seg?: number } = {
          done,
          completado_en: done ? new Date().toISOString() : null,
          iniciado_en: null
        }
        if (extraSeconds > 0) {
          updateData.tiempo_invertido_seg = (await this.getSubitemTime(id)) + extraSeconds
        }
        const { error: upError } = await supabase.from('tarea_subitems').update(updateData).eq('id', id)
        if (upError) return { success: false, error: upError.message }
      }
      return { success: true }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  private async getSubitemTime(id: number): Promise<number> {
    if (!supabase) return 0
    const { data } = await supabase.from('tarea_subitems').select('tiempo_invertido_seg').eq('id', id).maybeSingle()
    return (data as { tiempo_invertido_seg?: number } | null)?.tiempo_invertido_seg ?? 0
  }

  async startSubitemTimer(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('tarea_subitems')
        .update({ iniciado_en: nowIso })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async stopSubitemTimer(id: number, startedAt?: string | null): Promise<ApiResponse<{ timeAdded: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    if (!startedAt) {
      // solo limpiar iniciado_en
      const { error } = await supabase.from('tarea_subitems').update({ iniciado_en: null }).eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true, data: { timeAdded: 0 } }
    }
    const started = new Date(startedAt).getTime()
    const extraSeconds = Math.max(0, Math.round((Date.now() - started) / 1000))
    const currentTime = await this.getSubitemTime(id)
    const { error } = await supabase
      .from('tarea_subitems')
      .update({
        iniciado_en: null,
        tiempo_invertido_seg: currentTime + extraSeconds
      })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: { timeAdded: extraSeconds } }
  }

  async renameSubitem(id: number, titulo: string): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const { error } = await supabase.from('tarea_subitems').update({ titulo }).eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async deleteSubitem(id: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const { error } = await supabase.from('tarea_subitems').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // ========== HISTORIAL DE MOVIMIENTOS ==========
  async getHistorialMovimientos(filters?: {
    ordenId?: number
    /** Varias fichas (mismo u otros números OP): una sola query; repartir por id_orden en el cliente. */
    ordenIds?: number[]
    usuarioId?: number
    limit?: number
  }): Promise<ApiResponse<HistorialMovimiento[]>> {
    if (supabase) {
      let query = supabase.from('historial_movimientos').select('*').order('timestamp', {
        ascending: false
      })

      const ids = filters?.ordenIds?.filter((n) => Number.isInteger(n) && n > 0) ?? []
      if (ids.length > 0) {
        query = query.in('id_orden', ids)
      } else if (filters?.ordenId) {
        query = query.eq('id_orden', filters.ordenId)
      }
      if (filters?.usuarioId) query = query.eq('id_usuario', filters.usuarioId)
      if (filters?.limit) query = query.limit(filters.limit)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as HistorialMovimiento[]) ?? [] }
    }

    if (hasLegacyBackend) {
      const ids = filters?.ordenIds?.filter((n) => Number.isInteger(n) && n > 0) ?? []
      if (ids.length > 0) {
        const limitPer = filters?.limit
          ? Math.max(1, Math.ceil(filters.limit / ids.length))
          : undefined
        const results = await Promise.all(
          ids.map((ordenId) => {
            const params = new URLSearchParams()
            params.append('orden_id', ordenId.toString())
            if (filters?.usuarioId) params.append('usuario_id', filters.usuarioId.toString())
            if (limitPer) params.append('limit', limitPer.toString())
            return this.legacyRequest(`/historial.php?${params.toString()}`)
          })
        )
        const merged: HistorialMovimiento[] = []
        for (const r of results) {
          if (r.success && Array.isArray(r.data)) {
            merged.push(...(r.data as HistorialMovimiento[]))
          }
        }
        merged.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        if (filters?.limit && merged.length > filters.limit) {
          return { success: true, data: merged.slice(0, filters.limit) }
        }
        return { success: true, data: merged }
      }
      const params = new URLSearchParams()
      if (filters?.ordenId) params.append('orden_id', filters.ordenId.toString())
      if (filters?.usuarioId) params.append('usuario_id', filters.usuarioId.toString())
      if (filters?.limit) params.append('limit', filters.limit.toString())
      return this.legacyRequest(`/historial.php?${params.toString()}`)
    }

    return this.handleFallback(fallbackHistorial)
  }

  // ========== AUDITORÍA: OP ELIMINADAS ==========
  async getOpEliminadas(filters?: {
    desde?: string
    hasta?: string
  }): Promise<
    ApiResponse<
      Array<{
        id: number
        id_orden: number | null
        numero_op: string | null
        cliente: string | null
        id_usuario: number | null
        nombre_usuario: string | null
        rol_usuario: string | null
        estado_anterior: string | null
        estado_nuevo: string | null
        comentario: string | null
        accion_tipo: string | null
        cambios_detallados?: any
        timestamp: string
        motivo_eliminacion?: string | null
      }>
    >
  > {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    const selectVista =
      'id,id_orden,numero_op,cliente,id_usuario,nombre_usuario,rol_usuario,estado_anterior,estado_nuevo,comentario,accion_tipo,cambios_detallados,timestamp,motivo_eliminacion'
    const selectHistorial =
      'id,id_orden,id_usuario,nombre_usuario,estado_anterior,estado_nuevo,comentario,accion_tipo,cambios_detallados,timestamp'

    const mapHistorialEliminacion = (
      rows: Array<Record<string, unknown>>
    ): Array<{
      id: number
      id_orden: number | null
      numero_op: string | null
      cliente: string | null
      id_usuario: number | null
      nombre_usuario: string | null
      rol_usuario: string | null
      estado_anterior: string | null
      estado_nuevo: string | null
      comentario: string | null
      accion_tipo: string | null
      cambios_detallados?: any
      timestamp: string
      motivo_eliminacion?: string | null
    }> =>
      rows.map((r) => {
        const cd = (r.cambios_detallados && typeof r.cambios_detallados === 'object'
          ? (r.cambios_detallados as Record<string, unknown>)
          : {}) as Record<string, unknown>
        const pickStr = (k: string) => {
          const v = cd[k]
          return v != null && v !== '' ? String(v) : null
        }
        return {
          id: Number(r.id),
          id_orden: r.id_orden != null ? Number(r.id_orden) : null,
          numero_op: pickStr('numero_op'),
          cliente: pickStr('cliente'),
          id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
          nombre_usuario: r.nombre_usuario != null ? String(r.nombre_usuario) : null,
          rol_usuario: null,
          estado_anterior: r.estado_anterior != null ? String(r.estado_anterior) : null,
          estado_nuevo: r.estado_nuevo != null ? String(r.estado_nuevo) : null,
          comentario: r.comentario != null ? String(r.comentario) : null,
          accion_tipo: r.accion_tipo != null ? String(r.accion_tipo) : null,
          cambios_detallados: r.cambios_detallados,
          timestamp: String(r.timestamp ?? ''),
          motivo_eliminacion: null
        }
      })

    const applyFecha = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
      query: T
    ): T => {
      let q = query
      if (filters?.desde) q = q.gte('timestamp', filters.desde)
      if (filters?.hasta) q = q.lte('timestamp', filters.hasta)
      return q
    }

    const isNetworkLike = (msg: string) =>
      /failed to fetch|networkerror|load failed|fetch/i.test(msg)

    /** OPs con borrado lógico sin fila en historial/vista (p. ej. auditoría falló en su momento). */
    const appendOrdenesEliminadasSinAuditoria = async (auditRows: any[]): Promise<any[]> => {
      const sb = supabase
      if (!sb) return auditRows
      try {
        const { data: ordRaw, error: ordErr } = await sb
          .from('ordenes_trabajo')
          .select('id,numero_op,cliente,motivo_eliminacion,fecha_eliminacion,updated_at,estado')
          .eq('eliminada', true)
          .limit(2000)
        if (ordErr) {
          if (isMissingElEliminadaColumnError(ordErr.message)) return auditRows
          return auditRows
        }
        if (!ordRaw?.length) return auditRows
        const withAudit = new Set<number>()
        for (const r of auditRows) {
          const oid = r?.id_orden
          if (oid != null && Number.isFinite(Number(oid))) withAudit.add(Number(oid))
        }
        const synth: any[] = []
        for (const o of ordRaw as Record<string, unknown>[]) {
          const id = Number(o.id)
          if (!Number.isFinite(id) || id <= 0) continue
          if (withAudit.has(id)) continue
          const ts =
            (o.fecha_eliminacion != null && String(o.fecha_eliminacion)) ||
            (o.updated_at != null && String(o.updated_at)) ||
            new Date().toISOString()
          synth.push({
            id: -id,
            id_orden: id,
            numero_op: o.numero_op,
            cliente: o.cliente,
            id_usuario: null,
            nombre_usuario: null,
            rol_usuario: null,
            estado_anterior: o.estado != null ? String(o.estado) : null,
            estado_nuevo: null,
            comentario:
              'Sin registro de auditoría de eliminación; la orden figura como eliminada en la base.',
            accion_tipo: 'eliminacion',
            cambios_detallados: null,
            timestamp: ts,
            motivo_eliminacion: o.motivo_eliminacion != null ? String(o.motivo_eliminacion) : null
          })
        }
        if (synth.length === 0) return auditRows
        return [...auditRows, ...synth].sort(
          (a, b) =>
            new Date(String(b.timestamp ?? '')).getTime() -
            new Date(String(a.timestamp ?? '')).getTime()
        )
      } catch (e) {
        console.warn('getOpEliminadas: appendOrdenesEliminadasSinAuditoria', e)
        return auditRows
      }
    }

    try {
      let query = supabase
        .from('vista_auditoria_completa')
        .select(selectVista)
        .eq('accion_tipo', 'eliminacion')
        .order('timestamp', { ascending: false })
        .limit(2000)
      query = applyFecha(query)

      const { data, error } = await query
      if (!error) {
        const base = (data as any[]) ?? []
        const merged = await appendOrdenesEliminadasSinAuditoria(base)
        return { success: true, data: merged }
      }

      const errMsg = error.message || String(error)
      console.warn('getOpEliminadas: vista_auditoria_completa', errMsg)

      if (!isNetworkLike(errMsg)) {
        // Error de RLS / SQL / vista: intentar tabla base (misma acción guardada en app)
        let q2 = supabase
          .from('historial_movimientos')
          .select(selectHistorial)
          .eq('accion_tipo', 'eliminacion')
          .order('timestamp', { ascending: false })
          .limit(2000)
        q2 = applyFecha(q2)
        const { data: d2, error: e2 } = await q2
        if (!e2 && d2) {
          const mapped = mapHistorialEliminacion(d2 as Record<string, unknown>[])
          const merged = await appendOrdenesEliminadasSinAuditoria(mapped as any[])
          return { success: true, data: merged }
        }
        if (e2) {
          console.warn('getOpEliminadas: historial_movimientos fallback', e2.message)
        }
      }

      return {
        success: false,
        error: isNetworkLike(errMsg)
          ? 'Sin conexión a Supabase (red, proyecto pausado o URL incorrecta). Revisá internet y VITE_SUPABASE_URL.'
          : errMsg
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      console.error('getOpEliminadas:', e)
      return {
        success: false,
        error: isNetworkLike(msg)
          ? 'Sin conexión a Supabase (red, proyecto pausado o URL incorrecta). Revisá internet y VITE_SUPABASE_URL.'
          : msg
      }
    }
  }

  /** Órdenes marcadas eliminadas (borrado lógico) para vista previa en biblioteca — no filtra tablero. */
  async getOrdenesEliminadasDetalle(): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .eq('eliminada', true)
        .order('fecha_eliminacion', { ascending: false, nullsFirst: false })
        .limit(1500)

      if (error) {
        if (isMissingElEliminadaColumnError(error.message)) {
          return { success: true, data: [] }
        }
        return { success: false, error: error.message }
      }
      const rows = (data ?? []) as any[]
      await attachLineasM2ToOrdenes(rows)
      return { success: true, data: rows as OrdenTrabajo[] }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      console.error('getOrdenesEliminadasDetalle:', e)
      return { success: false, error: msg }
    }
  }

  // ========== USUARIOS ==========
  async getLegajoEmpleado(idUsuario: number): Promise<ApiResponse<LegajoEmpleado | null>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }

    const uid = Math.floor(Number(idUsuario))
    if (!Number.isFinite(uid) || uid <= 0) {
      return { success: false, error: 'ID de usuario inválido' }
    }

    const normalizeLegajoRow = (row: Record<string, unknown>): LegajoEmpleado => {
      const fi = row.fecha_ingreso ?? row.fechaIngreso
      const fn = row.fecha_nacimiento ?? row.fechaNacimiento
      const toDateStr = (v: unknown): string | null => {
        if (v == null || v === '') return null
        if (typeof v === 'string') return v
        if (typeof v === 'number' && Number.isFinite(v)) {
          const d = new Date(v)
          return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
        }
        if (v instanceof Date) return v.toISOString().slice(0, 10)
        return String(v)
      }
      return {
        ...(row as unknown as LegajoEmpleado),
        fecha_ingreso: toDateStr(fi),
        fecha_nacimiento: toDateStr(fn)
      }
    }

    const { data, error } = await supabase.rpc('obtener_legajo_empleado', {
      p_id_usuario: uid
    })

    let raw: Record<string, unknown> | null = null
    if (!error && data != null) {
      if (Array.isArray(data) && data.length > 0) {
        raw = data[0] as Record<string, unknown>
      } else if (!Array.isArray(data) && typeof data === 'object') {
        raw = data as Record<string, unknown>
      }
    }

    if (!raw) {
      const { data: direct, error: selErr } = await supabase
        .from('legajos_empleados')
        .select('*')
        .eq('id_usuario', uid)
        .maybeSingle()
      if (!selErr && direct) {
        raw = direct as Record<string, unknown>
      } else if (error) {
        return { success: false, error: error.message }
      }
    }

    if (raw) {
      return { success: true, data: normalizeLegajoRow(raw) }
    }

    return { success: true, data: null }
  }

  /** Cumples y aniversarios de alta HOY (Argentina) para todos los usuarios en home */
  async listarFechasPlotHoy(): Promise<ApiResponse<FechaPlotHoyItem[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }
    const { data, error } = await supabase.rpc('listar_fechas_plot_hoy')
    if (error) {
      return { success: false, error: error.message }
    }
    const rows = Array.isArray(data) ? data : []
    return { success: true, data: rows as FechaPlotHoyItem[] }
  }

  async crearActualizarLegajo(
    idUsuario: number,
    legajo: Partial<LegajoEmpleado>
  ): Promise<ApiResponse<LegajoEmpleado>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('crear_actualizar_legajo', {
        p_id_usuario: idUsuario,
        p_nombre: legajo.nombre || null,
        p_apellido: legajo.apellido || null,
        p_telefono: legajo.telefono || null,
        p_ubicacion: legajo.ubicacion || null,
        p_foto_url: legajo.foto_url || null,
        p_sector: legajo.sector || null,
        p_funciones: legajo.funciones || null,
        p_fecha_ingreso: legajo.fecha_ingreso || null,
        p_fecha_nacimiento: legajo.fecha_nacimiento || null,
        p_dni: legajo.dni || null,
        p_direccion: legajo.direccion || null,
        p_email: legajo.email || null,
        p_estado_civil: legajo.estado_civil || null,
        p_contacto_emergencia_nombre: legajo.contacto_emergencia_nombre || null,
        p_contacto_emergencia_telefono: legajo.contacto_emergencia_telefono || null,
        p_observaciones: legajo.observaciones || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as LegajoEmpleado }
      }

      return { success: false, error: 'No se recibieron datos del servidor' }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async uploadFotoEmpleado(file: File, idUsuario: number): Promise<ApiResponse<string>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      // Verificar que hay un usuario en localStorage (nuestro sistema de auth personalizado)
      const usuarioStr = localStorage.getItem('usuario')
      if (!usuarioStr) {
        return { success: false, error: 'Usuario no autenticado. Por favor, inicia sesión nuevamente.' }
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      // Usar un nombre único basado en el ID del usuario para permitir reemplazo
      const fileName = `empleados/${idUsuario}.${fileExt}`
      
      console.log('📤 Subiendo foto:', fileName, 'Usuario ID:', idUsuario)
      
      // Subir la nueva foto con upsert habilitado (reemplaza si existe)
      // Las políticas ahora permiten subida pública en la carpeta empleados/
      let uploadData = null
      let uploadError = null
      
      const uploadResult = await supabase.storage
        .from('legajos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Reemplazar si existe
        })
      
      uploadData = uploadResult.data
      uploadError = uploadResult.error

      if (uploadError) {
        console.error('❌ Error de upload:', uploadError)
        
        // Mensajes de error más descriptivos
        if (uploadError.message.includes('new row violates row-level security policy') || 
            uploadError.message.includes('row-level security') ||
            uploadError.message.includes('RLS')) {
          return { 
            success: false, 
            error: 'Error de permisos. Las políticas de Storage están bloqueando la subida. Contacta al administrador.' 
          }
        }
        
        if (uploadError.message.includes('JWT') || uploadError.message.includes('token') || uploadError.message.includes('Unauthorized')) {
          return { 
            success: false, 
            error: 'Error de autenticación. Por favor, recarga la página e intenta nuevamente.' 
          }
        }
        
        if (uploadError.message.includes('duplicate') || uploadError.message.includes('already exists')) {
          // Si ya existe, intentar eliminar y volver a subir
          console.log('⚠️ Archivo ya existe, intentando eliminar y volver a subir...')
          await supabase.storage.from('legajos').remove([fileName])
          
          // Reintentar subida
          const retryResult = await supabase.storage
            .from('legajos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            })
          
          if (retryResult.error) {
            return { success: false, error: retryResult.error.message }
          }
          
          uploadData = retryResult.data
        } else {
          return { success: false, error: uploadError.message }
        }
      }

      if (!uploadData) {
        return { success: false, error: 'No se recibieron datos del servidor después de subir la foto' }
      }

      console.log('✅ Foto subida exitosamente:', uploadData.path)

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('legajos')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        console.log('✅ URL pública obtenida:', urlData.publicUrl)
        return { success: true, data: urlData.publicUrl }
      }

      return { success: false, error: 'No se pudo obtener la URL de la imagen' }
    } catch (error: any) {
      console.error('❌ Error en uploadFotoEmpleado:', error)
      return { success: false, error: error.message || 'Error al subir la foto' }
    }
  }

  async getEstadisticasUsuario(
    idUsuario: number,
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_estadisticas_usuario', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      const rpcRow = data && Array.isArray(data) && data.length > 0 ? (data[0] as any) : null

      // FIX: `operario_asignado` hoy puede guardarse como ID (string) o como nombre.
      // La RPC histórica cuenta por nombre; si devolvió 0, revalidamos con query directa
      // para no mostrar la tabla en ceros.
      try {
        const idStr = String(idUsuario)
        const from = (fechaDesde || '').trim()
        const to = (fechaHasta || '').trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          return { success: true, data: rpcRow }
        }

        const { data: uRow } = await supabase
          .from('usuarios_publico')
          .select('nombre')
          .eq('id', idUsuario)
          .maybeSingle()
        const nombre = (uRow as any)?.nombre ? String((uRow as any).nombre).trim() : ''

        // Órdenes por rango (fecha_creacion), con match por ID o por nombre (compatibilidad)
        let q = supabase
          .from('ordenes_trabajo')
          .select('estado, fecha_creacion, fecha_entrega, sector, operario_asignado, usuario_trabajando_nombre, nombre_creador')
          // date-only en BD → rango inclusivo simple
          .gte('fecha_creacion', `${from}T00:00:00-03:00`)
          .lte('fecha_creacion', `${to}T23:59:59-03:00`)

        // PostgREST `or` (si nombre está vacío, igual matchea por idStr)
        const orParts = [
          `operario_asignado.eq.${idStr}`,
          nombre ? `operario_asignado.eq.${nombre}` : null,
          nombre ? `usuario_trabajando_nombre.eq.${nombre}` : null,
          nombre ? `nombre_creador.eq.${nombre}` : null
        ].filter(Boolean)
        if (orParts.length > 0) q = q.or(orParts.join(','))

        const { data: ordenes, error: errOrd } = await q
        if (!errOrd && Array.isArray(ordenes)) {
          const total = ordenes.length
          const completadas = ordenes.filter(
            (o: any) => o?.estado === 'Finalizado en Taller' || o?.estado === 'Almacén de Entrega'
          ).length
          const enProceso = ordenes.filter(
            (o: any) =>
              o?.estado != null &&
              o?.estado !== 'Diseño Gráfico' &&
              o?.estado !== 'Finalizado en Taller' &&
              o?.estado !== 'Almacén de Entrega'
          ).length
          const pendientes = ordenes.filter((o: any) => o?.estado === 'Diseño Gráfico').length

          const avgDias =
            completadas > 0
              ? (() => {
                  const days: number[] = []
                  for (const o of ordenes) {
                    if (!(o?.estado === 'Finalizado en Taller' || o?.estado === 'Almacén de Entrega')) continue
                    if (!o?.fecha_entrega || !o?.fecha_creacion) continue
                    const a = new Date(o.fecha_creacion).getTime()
                    const b = new Date(o.fecha_entrega).getTime()
                    if (Number.isNaN(a) || Number.isNaN(b) || b < a) continue
                    days.push((b - a) / 86400000)
                  }
                  if (days.length === 0) return null
                  return days.reduce((acc, v) => acc + v, 0) / days.length
                })()
              : null

          // Movimientos (por timestamp)
          const { data: movs, error: errMov } = await supabase
            .from('historial_movimientos')
            .select('id')
            .eq('id_usuario', idUsuario)
            .gte('timestamp', `${from}T00:00:00-03:00`)
            .lte('timestamp', `${to}T23:59:59-03:00`)
          const movimientos = !errMov && Array.isArray(movs) ? movs.length : rpcRow?.movimientos_realizados ?? 0

          // Órdenes/día (rango inclusivo)
          const daysRange = Math.max(
            1,
            Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
          )

          const merged = {
            id_usuario: idUsuario,
            nombre_usuario: nombre || rpcRow?.nombre_usuario || '',
            total_ordenes: total,
            ordenes_completadas: completadas,
            ordenes_en_proceso: enProceso,
            ordenes_pendientes: pendientes,
            movimientos_realizados: movimientos,
            movimientos_totales: movimientos,
            ordenes_por_dia: total / daysRange,
            promedio_dias_completar: avgDias,
            sector_principal: rpcRow?.sector_principal ?? null,
            ultima_actividad: rpcRow?.ultima_actividad ?? null
          }

          // Si la RPC ya devolvía datos reales, no los pisamos salvo que esté todo en 0 y acá haya contenido.
          const rpcTotal = Number(rpcRow?.total_ordenes || 0)
          if (rpcTotal === 0 && total > 0) return { success: true, data: merged }
        }
      } catch {
        // Si falla el fallback, usar lo que vino de la RPC.
      }

      return { success: true, data: rpcRow }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getEstadisticasSector(
    sector: string,
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_estadisticas_sector', {
        p_sector: sector,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] }
      }

      return { success: true, data: null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getEstadisticasPeriodo(
    fechaDesde: string,
    fechaHasta: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_estadisticas_periodo', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] }
      }

      return { success: true, data: null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getUsuarios(): Promise<ApiResponse<UsuarioRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('listar_usuarios')

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as UsuarioRecord[]) ?? [] }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/usuarios.php')
    }

    return this.handleFallback(fallbackUsuarios)
  }

  /** Incluye usuarios inactivos (baja) para vincular planillas históricas del reloj. */
  async getUsuariosParaRelojMatch(): Promise<ApiResponse<UsuarioRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('listar_usuarios_reloj')
      if (!error && Array.isArray(data)) {
        return { success: true, data: data as UsuarioRecord[] }
      }

      const { data: rows, error: selErr } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .order('nombre')
      if (!selErr && Array.isArray(rows) && rows.length > 0) {
        return { success: true, data: rows as UsuarioRecord[] }
      }

      console.warn('listar_usuarios_reloj no disponible, usando solo activos:', error?.message)
      return this.getUsuarios()
    }
    return this.getUsuarios()
  }

  /** Solo los IDs pedidos. Usa RPC (SECURITY DEFINER); el SELECT directo suele fallar por RLS. */
  async getUsuariosPorIds(ids: number[]): Promise<ApiResponse<UsuarioRecord[]>> {
    const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))]
    if (unique.length === 0) return { success: true, data: [] }
    if (supabase) {
      const wanted = new Set(unique)
      const byId = new Map<number, UsuarioRecord>()

      const { data: listed, error: listErr } = await supabase.rpc('listar_usuarios')
      if (!listErr && Array.isArray(listed)) {
        for (const u of listed as UsuarioRecord[]) {
          if (wanted.has(u.id)) byId.set(u.id, u)
        }
      }

      if (byId.size < unique.length) {
        const { data: extra, error: extraErr } = await supabase.rpc('obtener_usuarios_por_ids', {
          p_ids: unique
        })
        if (!extraErr && Array.isArray(extra)) {
          for (const u of extra as UsuarioRecord[]) {
            if (wanted.has(u.id)) byId.set(u.id, u)
          }
        }
      }

      if (byId.size === 0 && listErr) {
        return { success: false, error: listErr.message }
      }

      return { success: true, data: [...byId.values()] }
    }
    const all = await this.getUsuarios()
    if (!all.success || !all.data) return all
    const wanted = new Set(unique)
    return { success: true, data: all.data.filter((u) => wanted.has(u.id)) }
  }

  async getUsuariosBajasLog(): Promise<ApiResponse<UsuarioBajaLog[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }
    try {
      const { data, error } = await supabase
        .from('usuarios_bajas_log')
        .select(
          'id, id_usuario, nombre_snapshot, motivo, registrado_por, created_at, fecha_desvinculacion, tipo_desvinculacion, observaciones_finales, adjuntos, rol_snapshot'
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as Record<string, unknown>[]
      return {
        success: true,
        data: rows.map((r) => {
          let adjuntos: RrhhBajaAdjunto[] = []
          const rawAdj = r.adjuntos
          if (Array.isArray(rawAdj)) {
            adjuntos = rawAdj
              .filter((a) => a && typeof a === 'object')
              .map((a) => {
                const o = a as Record<string, unknown>
                return {
                  url: String(o.url ?? ''),
                  nombre: String(o.nombre ?? 'archivo'),
                  mime: String(o.mime ?? 'application/octet-stream')
                }
              })
              .filter((a) => a.url.length > 0)
          }
          return {
            id: Number(r.id),
            id_usuario: Number(r.id_usuario),
            nombre_snapshot: String(r.nombre_snapshot),
            motivo: String(r.motivo),
            registrado_por: r.registrado_por == null ? null : Number(r.registrado_por),
            created_at: String(r.created_at),
            fecha_desvinculacion:
              r.fecha_desvinculacion == null ? null : String(r.fecha_desvinculacion),
            tipo_desvinculacion:
              r.tipo_desvinculacion == null ? null : String(r.tipo_desvinculacion),
            observaciones_finales:
              r.observaciones_finales == null ? null : String(r.observaciones_finales),
            adjuntos,
            rol_snapshot: r.rol_snapshot == null ? null : String(r.rol_snapshot)
          }
        })
      }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al listar bajas de personal')
      }
    }
  }

  /** Baja formal: conserva legajo e historial, marca usuario como inactivo. */
  async darDeBajaUsuario(params: {
    id: number
    fechaDesvinculacion: string
    motivo: string
    tipoDesvinculacion: string
    observacionesFinales?: string | null
    adjuntos?: RrhhBajaAdjunto[]
    registradoPor: number
  }): Promise<ApiResponse<{ logId: number }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }
    try {
      const { data, error } = await supabase.rpc('dar_de_baja_usuario', {
        p_id: params.id,
        p_fecha_desvinculacion: params.fechaDesvinculacion,
        p_motivo: params.motivo.trim(),
        p_tipo_desvinculacion: params.tipoDesvinculacion,
        p_observaciones_finales: params.observacionesFinales?.trim() || null,
        p_adjuntos: params.adjuntos ?? [],
        p_registrado_por: params.registradoPor
      })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data: { logId: Number(data) } }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al dar de baja al colaborador'
      }
    }
  }

  /** Sube documentación de baja al bucket `archivos` bajo `rrhh-bajas/`. */
  async rrhhBajaSubirAdjunto(
    file: File,
    idUsuarioEmpleado: number
  ): Promise<ApiResponse<RrhhBajaAdjunto>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      return { success: false, error: 'El archivo supera 12 MB' }
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const allowedExt = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'doc', 'docx'])
    if (!allowedExt.has(ext)) {
      return { success: false, error: 'Formato no permitido (PDF, imagen o documento Word).' }
    }
    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80)
    const path = `rrhh-bajas/${idUsuarioEmpleado}/${Date.now()}_${safeBase}.${ext}`
    try {
      const { error: uploadError } = await supabase.storage.from('archivos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `application/${ext === 'pdf' ? 'pdf' : 'octet-stream'}`
      })
      if (uploadError) {
        return { success: false, error: uploadError.message }
      }
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) {
        return { success: false, error: 'No se pudo obtener la URL del archivo' }
      }
      return {
        success: true,
        data: {
          url: publicUrl,
          nombre: file.name,
          mime: file.type || 'application/octet-stream'
        }
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error al subir archivo'
      }
    }
  }

  async rrhhEventosLaboralesListar(idUsuario: number): Promise<ApiResponse<RrhhEventoLaboral[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }
    try {
      const { data, error } = await supabase
        .from('rrhh_eventos_laborales')
        .select(
          'id, id_usuario, tipo, fecha, titulo, descripcion, sector_anterior, sector_nuevo, registrado_por, created_at'
        )
        .eq('id_usuario', idUsuario)
        .order('fecha', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Record<string, unknown>[]
      return {
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          id_usuario: Number(r.id_usuario),
          tipo: String(r.tipo) as RrhhEventoLaboralTipo,
          fecha: String(r.fecha).slice(0, 10),
          titulo: String(r.titulo),
          descripcion: r.descripcion == null ? null : String(r.descripcion),
          sector_anterior: r.sector_anterior == null ? null : String(r.sector_anterior),
          sector_nuevo: r.sector_nuevo == null ? null : String(r.sector_nuevo),
          registrado_por: r.registrado_por == null ? null : Number(r.registrado_por),
          created_at: String(r.created_at)
        }))
      }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al listar eventos de hoja de vida')
      }
    }
  }

  async rrhhEventoLaboralCrear(input: {
    id_usuario: number
    tipo: RrhhEventoLaboralTipo
    fecha: string
    titulo: string
    descripcion?: string | null
    sector_anterior?: string | null
    sector_nuevo?: string | null
    registrado_por: number
  }): Promise<ApiResponse<RrhhEventoLaboral>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }
    try {
      const { data, error } = await supabase
        .from('rrhh_eventos_laborales')
        .insert({
          id_usuario: input.id_usuario,
          tipo: input.tipo,
          fecha: input.fecha,
          titulo: input.titulo.trim(),
          descripcion: input.descripcion?.trim() || null,
          sector_anterior: input.sector_anterior?.trim() || null,
          sector_nuevo: input.sector_nuevo?.trim() || null,
          registrado_por: input.registrado_por
        })
        .select(
          'id, id_usuario, tipo, fecha, titulo, descripcion, sector_anterior, sector_nuevo, registrado_por, created_at'
        )
        .single()
      if (error) throw error
      const r = data as Record<string, unknown>
      return {
        success: true,
        data: {
          id: Number(r.id),
          id_usuario: Number(r.id_usuario),
          tipo: String(r.tipo) as RrhhEventoLaboralTipo,
          fecha: String(r.fecha).slice(0, 10),
          titulo: String(r.titulo),
          descripcion: r.descripcion == null ? null : String(r.descripcion),
          sector_anterior: r.sector_anterior == null ? null : String(r.sector_anterior),
          sector_nuevo: r.sector_nuevo == null ? null : String(r.sector_nuevo),
          registrado_por: r.registrado_por == null ? null : Number(r.registrado_por),
          created_at: String(r.created_at)
        }
      }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al registrar evento de hoja de vida')
      }
    }
  }

  async getSectores(): Promise<ApiResponse<SectorRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('sectores')
        .select('id, nombre, color, activo, orden_visualizacion')
        .order('orden_visualizacion', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as SectorRecord[]) ?? [] }
    }

    return this.handleFallback(fallbackSectores)
  }

  /** Sectores de campo (Instalaciones / Metalúrgica) asignados al usuario vía usuario_sectores. */
  async getUsuarioCampoSectores(
    usuarioId: number
  ): Promise<ApiResponse<{ instalaciones: boolean; metalurgica: boolean }>> {
    const empty = { instalaciones: false, metalurgica: false }
    if (!supabase) {
      return { success: true, data: empty }
    }
    try {
      const { data, error } = await supabase
        .from('usuario_sectores')
        .select('sector_id, sectores(nombre)')
        .eq('usuario_id', usuarioId)

      if (error) {
        console.warn('getUsuarioCampoSectores:', error.message)
        return { success: true, data: empty }
      }

      const nombres = new Set<string>()
      for (const row of data ?? []) {
        const nombre = (row as { sectores?: { nombre?: string } | null }).sectores?.nombre
        if (nombre) nombres.add(nombre)
      }

      return {
        success: true,
        data: {
          instalaciones: nombres.has('Instalaciones'),
          metalurgica: nombres.has('Metalúrgica')
        }
      }
    } catch (e) {
      console.warn('getUsuarioCampoSectores:', e)
      return { success: true, data: empty }
    }
  }

  /**
   * Libro de Actas por Sector
   */
  async crearActaSector(params: {
    id_sector: number
    usuario_id: number
    usuario_nombre: string
    titulo: string
    contenido: string
    tipo_novedad?: TipoNovedad
    fecha?: string
  }): Promise<ApiResponse<{ id: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_acta_sector', {
          p_id_sector: params.id_sector,
          p_usuario_id: params.usuario_id,
          p_usuario_nombre: params.usuario_nombre,
          p_titulo: params.titulo,
          p_contenido: params.contenido,
          p_tipo_novedad: params.tipo_novedad || 'general',
          p_fecha: params.fecha || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear la acta' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async listarActasSector(params?: {
    id_sector?: number
    sector_nombre?: string
    fecha_desde?: string
    fecha_hasta?: string
    tipo_novedad?: TipoNovedad
    limit?: number
    offset?: number
  }): Promise<ApiResponse<ActaSectorRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_actas_sector', {
          p_id_sector: params?.id_sector || null,
          p_sector_nombre: params?.sector_nombre || null,
          p_fecha_desde: params?.fecha_desde || null,
          p_fecha_hasta: params?.fecha_hasta || null,
          p_tipo_novedad: params?.tipo_novedad || null,
          p_limit: params?.limit || 100,
          p_offset: params?.offset || 0
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as ActaSectorRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerActaSector(idActa: number): Promise<ApiResponse<ActaSectorRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_acta_sector', {
          p_id_acta: idActa
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Acta no encontrada' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarActaSector(params: {
    id_acta: number
    titulo?: string
    contenido?: string
    tipo_novedad?: TipoNovedad
    fecha?: string
  }): Promise<ApiResponse<{ id: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_acta_sector', {
          p_id_acta: params.id_acta,
          p_titulo: params.titulo || null,
          p_contenido: params.contenido || null,
          p_tipo_novedad: params.tipo_novedad || null,
          p_fecha: params.fecha || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar la acta' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async eliminarActaSector(idActa: number): Promise<ApiResponse<{ id: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('eliminar_acta_sector', {
          p_id_acta: idActa
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo eliminar la acta' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getSubTareas(ordenId?: number): Promise<ApiResponse<TareaRecord[]>> {
    if (supabase) {
      let query = supabase
        .from('tareas')
        .select('*')
        .eq('es_sub_tarea', true)
        .neq('estado_kanban', 'Finalizado') // Ocultar sub-tareas completadas
        .order('id', { ascending: true })

      if (ordenId) {
        query = query.eq('id_orden', ordenId)
      }

      const { data, error } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as TareaRecord[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getMateriales(search?: string): Promise<ApiResponse<MaterialRecord[]>> {
    // Intentar usar la base de datos de stock primero
    if (stockSupabase) {
      try {
        // Usar la tabla 'articulos' que tiene el stock
        let query = stockSupabase
          .from('articulos')
          .select('id, codigo, descripcion, stock')
          .order('descripcion', {
            ascending: true
          })

        if (search && search.trim().length >= 2) {
          // Buscar por descripción o código
          query = query.or(`descripcion.ilike.%${search.trim()}%,codigo.ilike.%${search.trim()}%`)
        }

        const { data, error } = await query
        if (!error && data) {
          // Mapear articulos a MaterialRecord incluyendo el stock
          const materiales = data.map((articulo: any) => ({
            id: articulo.id,
            codigo: articulo.codigo || null,
            descripcion: articulo.descripcion,
            stock: articulo.stock ?? null
          }))
          return { success: true, data: materiales as MaterialRecord[] }
        }
        // Si hay error, continuar con fallback a base principal
        console.warn('⚠️ Error obteniendo materiales de stock, usando base principal:', error?.message)
      } catch (err) {
        console.warn('⚠️ Error conectando a base de stock, usando base principal:', err)
      }
    }

    // Fallback: usar la base de datos principal
    if (supabase) {
      let query = supabase.from('materiales').select('id, codigo, descripcion').order('descripcion', {
        ascending: true
      })

      if (search && search.trim().length >= 2) {
        query = query.ilike('descripcion', `%${search.trim()}%`)
      }

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as MaterialRecord[]) ?? [] }
    }

    // Fallback final: datos mock
    if (search && search.trim()) {
      const filtered = fallbackMateriales.filter((material) =>
        material.descripcion.toLowerCase().includes(search.trim().toLowerCase())
      )
      return { success: true, data: filtered }
    }

    return this.handleFallback(fallbackMateriales)
  }


  async getUsuario(id: number): Promise<ApiResponse<UsuarioRecord>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('usuarios_publico')
        .select('id, nombre, rol')
        .eq('id', id)
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      if (!data) return { success: false, error: 'Usuario no encontrado' }
      return { success: true, data: data as UsuarioRecord }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/usuarios.php?id=${id}`)
    }

    const usuario = fallbackUsuarios.find((u) => u.id === id)
    return usuario
      ? { success: true, data: usuario }
      : { success: false, error: 'Usuario no encontrado' }
  }

  async updateUsuario(
    id: number,
    updates: {
      nombre?: string
      rol?: UserRole
      password?: string
    }
  ): Promise<ApiResponse<UsuarioRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_usuario', {
          p_id: id,
          p_nombre: updates.nombre || null,
          p_rol: updates.rol || null,
          p_password: updates.password || null
        })

        if (error) {
          return { success: false, error: error.message }
        }

        if (data && Array.isArray(data) && data.length > 0) {
          return { success: true, data: data[0] as UsuarioRecord }
        }

        return { success: false, error: 'No se recibieron datos del servidor' }
      } catch (error: any) {
        return { success: false, error: error.message || 'Error al actualizar usuario' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async deleteUsuario(
    id: number,
    motivoBaja: string,
    registradoPor: number
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_usuario', {
          p_id: id,
          p_motivo: motivoBaja.trim(),
          p_registrado_por: registradoPor
        })

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message || 'Error al eliminar usuario' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async createUsuario(usuario: {
    nombre: string
    password: string
    rol: UserRole
  }): Promise<ApiResponse<UsuarioRecord>> {
    let lastError: string | null = null

    if (supabase) {
      // Usar función RPC para crear usuario con hash de contraseña
      console.log('🔍 [createUsuario] Intentando crear usuario:', {
        nombre: usuario.nombre.trim(),
        rol: usuario.rol,
        rolType: typeof usuario.rol,
        rolLength: usuario.rol?.length,
        rolCharCodes: usuario.rol?.split('').map(c => c.charCodeAt(0))
      })
      
      const { data, error } = await supabase.rpc('crear_usuario', {
        p_nombre: usuario.nombre.trim(),
        p_password: usuario.password,
        p_rol: usuario.rol
      })

      console.log('🔍 [createUsuario] Respuesta RPC:', { data, error })

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as UsuarioRecord }
      }

      // Si hay error específico de la RPC, retornar inmediatamente sin intentar fallbacks
      if (error) {
        const errorMsg = error.message || 'Error al crear usuario'
        console.error('❌ [createUsuario] Error de RPC:', {
          message: errorMsg,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        // Si es un error de validación (rol inválido, usuario duplicado, etc), no intentar fallbacks
        if (errorMsg.includes('Rol inválido') || errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
          return { success: false, error: errorMsg }
        }
        lastError = errorMsg
        console.warn('⚠️ Supabase RPC crear_usuario falló:', errorMsg)
      } else {
        lastError = 'La función RPC no retornó datos'
      }

    }

    // Solo intentar backend legacy si Supabase no está disponible
    if (!supabase && hasLegacyBackend) {
      const legacyResponse = await this.legacyRequest<UsuarioRecord>('/usuarios.php', {
        method: 'POST',
        body: JSON.stringify(usuario)
      })

      if (legacyResponse.success) {
        return legacyResponse
      }

      lastError = legacyResponse.error || lastError
    } else if (!supabase) {
      // Fallback solo en entornos sin Supabase ni backend legacy (desarrollo)
      const nuevoUsuario: UsuarioRecord = {
        id: fallbackUsuarios.length + 1,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
      fallbackUsuarios.push(nuevoUsuario)
      return { success: true, data: nuevoUsuario }
    }

    return { success: false, error: lastError || 'No se pudo crear el usuario.' }
  }

  // ========== CLIENTES ==========
  private escapeIlikeCliente(s: string): string {
    return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  }

  private async buscarClientesPorToken(token: string, limit = 60): Promise<ClienteRecord[]> {
    if (!supabase) return []
    const patron = `*${this.escapeIlikeCliente(token)}*`
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(
        `nombre.ilike.${patron},apellido.ilike.${patron},dni_cuit.ilike.${patron},telefono.ilike.${patron},email.ilike.${patron},empresa.ilike.${patron}`
      )
      .limit(limit)
      .order('nombre', { ascending: true })
    if (error) {
      console.error('Error buscando clientes por token:', error)
      return []
    }
    return (data as ClienteRecord[]) ?? []
  }

  /** Totales reales en BD (sin límite de 1000 filas de PostgREST). */
  async contarClientesResumen(): Promise<
    ApiResponse<{ total: number; conPortal: number; sinPortal: number }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const [totalRes, portalRes] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('es_cliente_web', true)
      ])
      if (totalRes.error) return { success: false, error: totalRes.error.message }
      if (portalRes.error) return { success: false, error: portalRes.error.message }
      const total = totalRes.count ?? 0
      const conPortal = portalRes.count ?? 0
      return {
        success: true,
        data: { total, conPortal, sinPortal: Math.max(0, total - conPortal) }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al contar clientes' }
    }
  }

  async buscarClientes(
    query: string,
    options?: { limit?: number }
  ): Promise<ApiResponse<ClienteRecord[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    const maxResultados = Math.min(Math.max(options?.limit ?? 50, 1), 150)

    try {
      const { tokenizarBusquedaCliente, clienteCoincideBusqueda } = await import(
        '../utils/clienteDuplicados'
      )
      const queryTrimmed = query.trim()
      if (!queryTrimmed) {
        return { success: true, data: [] }
      }

      const tokens = tokenizarBusquedaCliente(queryTrimmed)
      const limiteToken = Math.min(maxResultados + 40, 150)
      let candidatos: ClienteRecord[]

      if (tokens.length <= 1) {
        candidatos = await this.buscarClientesPorToken(queryTrimmed, limiteToken)
      } else {
        let map: Map<number, ClienteRecord> | null = null
        for (const token of tokens) {
          const list = await this.buscarClientesPorToken(token, limiteToken)
          const tokenMap = new Map(list.map((c) => [c.id, c]))
          if (map === null) {
            map = tokenMap
          } else {
            const next = new Map<number, ClienteRecord>()
            for (const [id, c] of map) {
              if (tokenMap.has(id)) next.set(id, c)
            }
            map = next
          }
        }
        candidatos = Array.from(map?.values() ?? [])
        if (candidatos.length === 0) {
          candidatos = await this.buscarClientesPorToken(queryTrimmed, limiteToken)
        }
      }

      const filtrados = candidatos
        .filter((c) => clienteCoincideBusqueda(c, queryTrimmed))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))

      return { success: true, data: filtrados.slice(0, maxResultados) }
    } catch (error: any) {
      console.error('Error en buscarClientes:', error)
      return { success: false, error: error.message || 'Error al buscar clientes' }
    }
  }

  /** Posibles duplicados del cliente (mismo DNI, teléfono, email o nombre muy similar). */
  async buscarDuplicadosCliente(idCliente: number): Promise<ApiResponse<ClienteRecord[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }

    const { analizarParDuplicado } = await import('../utils/clienteDuplicados')
    const { normalizarDniCuit, normalizarTelefono, normalizarTexto, nombreCompletoCliente } =
      await import('../utils/buscarClienteMatch')

    try {
      const { data: base, error } = await supabase.from('clientes').select('*').eq('id', idCliente).maybeSingle()
      if (error || !base) return { success: false, error: error?.message || 'Cliente no encontrado' }

      const cliente = base as ClienteRecord
      const seen = new Set<number>([cliente.id])
      const out: ClienteRecord[] = []

      const addMatches = (list: ClienteRecord[] | null | undefined) => {
        for (const c of list ?? []) {
          if (seen.has(c.id)) continue
          const { duplicado } = analizarParDuplicado(cliente, c)
          if (!duplicado) continue
          seen.add(c.id)
          out.push(c)
        }
      }

      const dni = normalizarDniCuit(cliente.dni_cuit)
      if (dni.length >= 6) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .ilike('dni_cuit', `%${this.escapeIlikeCliente(dni)}%`)
          .neq('id', idCliente)
          .limit(20)
        addMatches(data as ClienteRecord[])
      }

      const tel = normalizarTelefono(cliente.telefono)
      if (tel.length >= 8) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .ilike('telefono', `%${tel.slice(-8)}%`)
          .neq('id', idCliente)
          .limit(20)
        addMatches(data as ClienteRecord[])
      }

      const mail = normalizarTexto(cliente.email)
      if (mail.length >= 5) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .ilike('email', mail)
          .neq('id', idCliente)
          .limit(20)
        addMatches(data as ClienteRecord[])
      }

      const nombre = nombreCompletoCliente(cliente)
      if (nombre.length >= 3) {
        const apellido = cliente.apellido?.trim()
        const patron = apellido && apellido.length >= 2 ? apellido : nombre.split(' ')[0]
        if (patron && patron.length >= 2) {
          const { data } = await supabase
            .from('clientes')
            .select('*')
            .or(`apellido.ilike.%${this.escapeIlikeCliente(patron)}%,nombre.ilike.%${this.escapeIlikeCliente(patron)}%`)
            .neq('id', idCliente)
            .limit(30)
          addMatches(data as ClienteRecord[])
        }
      }

      return { success: true, data: out }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al buscar duplicados' }
    }
  }

  /**
   * Unifica dos fichas de cliente: reasigna pedidos/ventas/CC y desactiva la secundaria.
   */
  async fusionarClientes(
    idPrincipal: number,
    idSecundario: number
  ): Promise<ApiResponse<ClienteRecord>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    if (idPrincipal === idSecundario) {
      return { success: false, error: 'Elegí dos clientes distintos' }
    }

    try {
      const [{ data: principal }, { data: secundario }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', idPrincipal).maybeSingle(),
        supabase.from('clientes').select('*').eq('id', idSecundario).maybeSingle()
      ])

      if (!principal || !secundario) {
        return { success: false, error: 'No se encontraron ambos clientes' }
      }

      const p = principal as ClienteRecord
      const s = secundario as ClienteRecord

      const [{ data: ccP }, { data: ccS }] = await Promise.all([
        supabase.from('clientes_cuenta_corriente').select('id').eq('id_cliente', idPrincipal).maybeSingle(),
        supabase.from('clientes_cuenta_corriente').select('id').eq('id_cliente', idSecundario).maybeSingle()
      ])

      if (ccP && ccS) {
        return {
          success: false,
          error:
            'Ambos clientes tienen cuenta corriente. Unificá manualmente con administración antes de fusionar.'
        }
      }

      const tablasIdCliente = [
        'pedidos_clientes',
        'presupuestos_clientes',
        'ventas',
        'agenda_asesor_tecnico'
      ] as const

      for (const tabla of tablasIdCliente) {
        const { error: upErr } = await supabase
          .from(tabla)
          .update({ id_cliente: idPrincipal })
          .eq('id_cliente', idSecundario)
        if (upErr && !/does not exist|relation/i.test(upErr.message)) {
          console.warn(`fusionarClientes: ${tabla}`, upErr.message)
        }
      }

      if (!ccP && ccS) {
        const { error: ccMoveErr } = await supabase
          .from('clientes_cuenta_corriente')
          .update({ id_cliente: idPrincipal })
          .eq('id_cliente', idSecundario)
        if (ccMoveErr) {
          return { success: false, error: ccMoveErr.message }
        }
      }

      const mergePayload: Record<string, string> = {}
      if (!p.apellido?.trim() && s.apellido?.trim()) mergePayload.apellido = s.apellido.trim()
      if (!p.empresa?.trim() && s.empresa?.trim()) mergePayload.empresa = s.empresa.trim()
      if (!p.telefono?.trim() && s.telefono?.trim()) mergePayload.telefono = s.telefono.trim()
      if (!p.email?.trim() && s.email?.trim()) mergePayload.email = s.email.trim()
      if (!p.dni_cuit?.trim() && s.dni_cuit?.trim()) mergePayload.dni_cuit = s.dni_cuit.trim()
      if (!p.direccion?.trim() && s.direccion?.trim()) mergePayload.direccion = s.direccion.trim()

      if (Object.keys(mergePayload).length > 0) {
        await supabase.from('clientes').update(mergePayload).eq('id', idPrincipal)
      }

      const { error: offErr } = await supabase
        .from('clientes')
        .update({ activo: false })
        .eq('id', idSecundario)
      if (offErr) return { success: false, error: offErr.message }

      const { data: actualizado, error: fetchErr } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', idPrincipal)
        .single()
      if (fetchErr) return { success: false, error: fetchErr.message }

      return { success: true, data: actualizado as ClienteRecord }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al fusionar clientes' }
    }
  }

  /** Órdenes vinculadas a un cliente (DNI, nombre, empresa, contacto). */
  async getOrdenesPorCliente(cliente: ClienteRecord): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }

    const { filtrarOrdenesDeCliente, normalizarDniCuit, nombreCompletoCliente } = await import(
      '../utils/buscarClienteMatch'
    )

    try {
      const orParts: string[] = []
      const escapeIlike = (s: string) =>
        String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

      const dni = normalizarDniCuit(cliente.dni_cuit)
      if (dni.length >= 4) {
        orParts.push(`dni_cuit.ilike.*${escapeIlike(dni)}*`)
      }

      const nombre = nombreCompletoCliente(cliente)
      if (nombre.length >= 2) {
        orParts.push(`cliente.ilike.*${escapeIlike(nombre)}*`)
        if (cliente.apellido?.trim()) {
          orParts.push(`cliente.ilike.*${escapeIlike(cliente.apellido.trim())}*`)
        }
      }

      if (cliente.empresa?.trim()) {
        orParts.push(`cliente.ilike.*${escapeIlike(cliente.empresa.trim())}*`)
      }

      let candidatas: OrdenTrabajo[] = []

      if (orParts.length > 0) {
        const { data, error } = await supabase
          .from('ordenes_trabajo')
          .select(ORDENES_TABLERO_SELECT)
          .or(orParts.join(','))
          .eq('eliminada', false)
          .order('fecha_creacion', { ascending: false })
          .limit(300)

        if (!error && data) candidatas = data as OrdenTrabajo[]
      }

      if (candidatas.length === 0) {
        const todas = await this.getOrdenes()
        if (todas.success && todas.data) candidatas = todas.data
      }

      return { success: true, data: filtrarOrdenesDeCliente(candidatas, cliente) }
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al cargar órdenes del cliente' }
    }
  }

  async buscarOCrearCliente(cliente: {
    nombre: string
    dni_cuit?: string
    telefono?: string
    email?: string
    direccion?: string
    ubicacion_link?: string
    drive_link?: string
  }): Promise<ApiResponse<ClienteRecord>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('buscar_o_crear_cliente', {
        p_nombre: cliente.nombre.trim(),
        p_dni_cuit: cliente.dni_cuit?.trim() || null,
        p_telefono: cliente.telefono?.trim() || null,
        p_email: cliente.email?.trim() || null,
        p_direccion: cliente.direccion?.trim() || null,
        p_ubicacion_link: cliente.ubicacion_link?.trim() || null,
        p_drive_link: cliente.drive_link?.trim() || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as ClienteRecord }
      }

      return { success: false, error: 'No se retornó el cliente creado' }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ========== CUENTA CORRIENTE (MOSTRADOR) ==========
  private mapClienteCuentaCorrienteRow(
    row: Record<string, unknown>
  ): ClienteCuentaCorrienteRecord & { cliente?: ClienteRecord } {
    const { cliente, ...cc } = row
    const base = cc as unknown as ClienteCuentaCorrienteRecord
    const estadoRaw = cc.estado as ClienteCuentaCorrienteRecord['estado'] | null | undefined
    const altaCompleta = Boolean(cc.alta_completa)
    const estado: ClienteCuentaCorrienteRecord['estado'] =
      estadoRaw === 'aprobada' || estadoRaw === 'pendiente' || estadoRaw === 'rechazada'
        ? estadoRaw
        : altaCompleta
          ? 'aprobada'
          : 'pendiente'
    return {
      ...base,
      estado,
      alta_completa: altaCompleta,
      saldo_actual: cc.saldo_actual != null ? Number(cc.saldo_actual) : base.saldo_actual,
      total_cargos: cc.total_cargos != null ? Number(cc.total_cargos) : base.total_cargos,
      total_pagos: cc.total_pagos != null ? Number(cc.total_pagos) : base.total_pagos,
      cliente: cliente as ClienteRecord | undefined
    }
  }

  async listClientesCuentaCorriente(): Promise<
    ApiResponse<Array<ClienteCuentaCorrienteRecord & { cliente?: ClienteRecord }>>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const sb = supabase
    const ccSelect =
      '*, cliente:clientes!clientes_cuenta_corriente_id_cliente_fkey(id, nombre, telefono, email, dni_cuit, empresa, activo)'
    try {
      let data: Record<string, unknown>[] | null = null
      let error: { message: string } | null = null

      const res = await sb
        .from('clientes_cuenta_corriente')
        .select(ccSelect)
        .order('created_at', { ascending: false })
      data = res.data as Record<string, unknown>[] | null
      error = res.error

      if (error) {
        const fallback = await sb
          .from('clientes_cuenta_corriente')
          .select('*')
          .order('created_at', { ascending: false })
        data = fallback.data as Record<string, unknown>[] | null
        error = fallback.error
      }

      if (error) return { success: false, error: error.message }
      const rows = (data || []).map((row) => this.mapClienteCuentaCorrienteRow(row))
      return { success: true, data: rows }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar clientes con cuenta corriente' }
    }
  }

  async getCuentaCorrientePorCliente(
    idCliente: number
  ): Promise<ApiResponse<(ClienteCuentaCorrienteRecord & { cliente?: ClienteRecord }) | null>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const sb = supabase
    try {
      const res = await sb
        .from('clientes_cuenta_corriente')
        .select(
          '*, cliente:clientes!clientes_cuenta_corriente_id_cliente_fkey(id, nombre, telefono, email, dni_cuit, empresa, activo)'
        )
        .eq('id_cliente', idCliente)
        .maybeSingle()
      if (res.error) {
        const fb = await sb.from('clientes_cuenta_corriente').select('*').eq('id_cliente', idCliente).maybeSingle()
        if (fb.error) return { success: false, error: fb.error.message }
        if (!fb.data) return { success: true, data: null }
        return { success: true, data: this.mapClienteCuentaCorrienteRow(fb.data as Record<string, unknown>) }
      }
      if (!res.data) return { success: true, data: null }
      return {
        success: true,
        data: this.mapClienteCuentaCorrienteRow(res.data as Record<string, unknown>)
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al obtener cuenta corriente' }
    }
  }

  /** Cliente + OPs + datos sugeridos para alta en cuenta corriente. */
  async getClienteEnriquecidoParaCc(
    idCliente: number
  ): Promise<ApiResponse<import('../types/api').ClienteCcEnriquecido | null>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }

    try {
      const clienteRes = await this.getClientePorId(idCliente)
      if (!clienteRes.success) return { success: false, error: clienteRes.error }
      if (!clienteRes.data) return { success: true, data: null }

      const cliente = clienteRes.data
      const [ordRes, ccRes] = await Promise.all([
        this.getOrdenesPorCliente(cliente),
        this.getCuentaCorrientePorCliente(idCliente)
      ])

      const ordenes = ordRes.success && ordRes.data ? ordRes.data : []
      const cuenta_corriente = ccRes.success ? ccRes.data ?? null : null

      const { inferirDatosCcDesdeCliente } = await import('../utils/cuentaCorrienteClienteData')
      const datos_sugeridos = inferirDatosCcDesdeCliente(cliente, ordenes, cuenta_corriente)
      const ordenes_activas = ordenes.filter(
        (o) => o.estado !== 'Entregado o Instalado' && !o.entregado
      ).length

      return {
        success: true,
        data: {
          cliente,
          ordenes,
          ordenes_activas,
          cuenta_corriente,
          datos_sugeridos
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al enriquecer cliente' }
    }
  }

  async clienteHabilitadoCuentaCorriente(idCliente: number): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('cliente_habilitado_cuenta_corriente', {
        p_id_cliente: idCliente
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: !!data }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al verificar cuenta corriente' }
    }
  }

  async registrarAltaCuentaCorriente(
    payload: AltaCuentaCorrientePayload
  ): Promise<
    ApiResponse<{
      id_cliente: number
      razon_social: string
      alta_completa: boolean
      estado: 'pendiente' | 'aprobada' | 'rechazada'
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('registrar_alta_cuenta_corriente', {
        p_cuit: payload.cuit,
        p_razon_social: payload.razon_social,
        p_condicion_iva: payload.condicion_iva,
        p_email: payload.email,
        p_whatsapp: payload.whatsapp,
        p_persona_contacto: payload.persona_contacto,
        p_domicilio: payload.domicilio,
        p_localidad: payload.localidad,
        p_provincia: payload.provincia,
        p_codigo_postal: payload.codigo_postal,
        p_url_constancia_afip: payload.url_constancia_afip,
        p_url_estatuto: payload.url_estatuto ?? '',
        p_url_comprobante_domicilio: payload.url_comprobante_domicilio,
        p_id_cliente: payload.id_cliente ?? null,
        p_id_usuario_solicita: payload.id_usuario_solicita,
        p_tipo_cliente: payload.tipo_cliente ?? 'empresa',
        p_nombre: payload.nombre ?? null,
        p_apellido: payload.apellido ?? null,
        p_url_documento_dni: payload.url_documento_dni ?? null,
        p_url_pagare: payload.url_pagare ?? null
      })
      if (error) {
        const raw = error.message || ''
        const friendly = /could not choose|function.*not unique/i.test(raw)
          ? 'No se pudo registrar la cuenta corriente (conflicto en el servidor). Recargá la página e intentá de nuevo.'
          : raw
        return { success: false, error: friendly }
      }
      const parsed = data as {
        id_cliente: number
        razon_social: string
        alta_completa: boolean
        estado: 'pendiente' | 'aprobada' | 'rechazada'
      }
      if (!parsed?.id_cliente) {
        return { success: false, error: 'El servidor no devolvió el cliente registrado' }
      }
      return { success: true, data: parsed }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al registrar alta de cuenta corriente' }
    }
  }

  async resolverSolicitudCuentaCorriente(
    idCliente: number,
    accion: 'aprobar' | 'rechazar',
    idUsuarioRevisor: number,
    motivoRechazo?: string
  ): Promise<
    ApiResponse<{ id_cliente: number; estado: 'aprobada' | 'rechazada'; razon_social: string }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('resolver_solicitud_cuenta_corriente', {
        p_id_cliente: idCliente,
        p_accion: accion,
        p_id_usuario_revisor: idUsuarioRevisor,
        p_motivo_rechazo: motivoRechazo ?? null
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as { id_cliente: number; estado: 'aprobada' | 'rechazada'; razon_social: string } }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al resolver solicitud' }
    }
  }

  async getScoringResumenCuentaCorriente(idCliente: number): Promise<
    ApiResponse<{
      score: number | null
      score_nivel: string | null
      limite_credito: number | null
      limite_credito_sugerido: number | null
    } | null>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('clientes_cuenta_corriente')
        .select('score, score_nivel, limite_credito, limite_credito_sugerido')
        .eq('id_cliente', idCliente)
        .maybeSingle()
      if (error) return { success: false, error: error.message }
      if (!data) return { success: true, data: null }
      return {
        success: true,
        data: {
          score: data.score as number | null,
          score_nivel: data.score_nivel as string | null,
          limite_credito: data.limite_credito != null ? Number(data.limite_credito) : null,
          limite_credito_sugerido:
            data.limite_credito_sugerido != null ? Number(data.limite_credito_sugerido) : null
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al obtener scoring' }
    }
  }

  async calcularScoringCuentaCorriente(
    idCliente: number,
    idUsuario?: number | null
  ): Promise<
    ApiResponse<{
      id_cliente: number
      score: number
      score_nivel: string
      score_detalle: Record<string, unknown>
      limite_credito_sugerido: number
      limite_credito?: number | null
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('calcular_scoring_cuenta_corriente', {
        p_id_cliente: idCliente,
        p_id_usuario: idUsuario ?? null,
        p_origen: 'automatico'
      })
      if (error) return { success: false, error: error.message }
      const row = data as Record<string, unknown>
      return {
        success: true,
        data: {
          id_cliente: row.id_cliente as number,
          score: row.score as number,
          score_nivel: row.score_nivel as string,
          score_detalle: (row.score_detalle as Record<string, unknown>) ?? {},
          limite_credito_sugerido: Number(row.limite_credito_sugerido),
          limite_credito: row.limite_credito != null ? Number(row.limite_credito) : null
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al calcular scoring' }
    }
  }

  async actualizarScoringCuentaCorriente(payload: {
    id_cliente: number
    id_usuario: number
    ajuste_manual?: number
    limite_credito?: number | null
    notas?: string | null
  }): Promise<
    ApiResponse<{
      id_cliente: number
      score: number
      score_nivel: string
      score_detalle: Record<string, unknown>
      limite_credito_sugerido: number
      limite_credito?: number | null
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('actualizar_scoring_cc', {
        p_id_cliente: payload.id_cliente,
        p_id_usuario: payload.id_usuario,
        p_ajuste_manual: payload.ajuste_manual ?? null,
        p_limite_credito: payload.limite_credito ?? null,
        p_notas: payload.notas ?? null,
        p_recalcular: true
      })
      if (error) return { success: false, error: error.message }
      const row = data as Record<string, unknown>
      return {
        success: true,
        data: {
          id_cliente: row.id_cliente as number,
          score: row.score as number,
          score_nivel: row.score_nivel as string,
          score_detalle: (row.score_detalle as Record<string, unknown>) ?? {},
          limite_credito_sugerido: Number(row.limite_credito_sugerido),
          limite_credito: row.limite_credito != null ? Number(row.limite_credito) : null
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al actualizar scoring' }
    }
  }

  async sincronizarVentasCuentaCorriente(
    idCliente: number
  ): Promise<ApiResponse<{ sincronizadas: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('cc_sincronizar_ventas_cliente', {
        p_id_cliente: idCliente
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: { sincronizadas: Number(data) || 0 } }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al sincronizar ventas' }
    }
  }

  async getPerfilCuentaCorriente(idCliente: number): Promise<ApiResponse<CcPerfilCliente | null>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('cc_obtener_perfil_cliente', {
        p_id_cliente: idCliente
      })
      if (error) return { success: false, error: error.message }
      if (!data) return { success: true, data: null }
      const raw = data as Record<string, unknown>
      const movs = (Array.isArray(raw.movimientos) ? raw.movimientos : []) as CcCuentaMovimiento[]
      const ventas = (Array.isArray(raw.ventas_cc) ? raw.ventas_cc : []) as CcVentaResumen[]
      const resumen = raw.resumen as CcPerfilResumen & { intereses_devengados?: CcInteresesDevengados }
      const ficha = raw.ficha as ClienteCuentaCorrienteRecord
      const interesesRaw = resumen.intereses_devengados
      const intereses: CcInteresesDevengados | null = interesesRaw
        ? {
            tasa_mora_mensual: Number(interesesRaw.tasa_mora_mensual) || 0,
            dias_gracia: Number(interesesRaw.dias_gracia) || 0,
            periodo: String(interesesRaw.periodo ?? ''),
            total_devengado: Number(interesesRaw.total_devengado) || 0,
            items: Array.isArray(interesesRaw.items)
              ? (interesesRaw.items as CcInteresesDevengados['items']).map((it) => ({
                  ...it,
                  interes_calculado: Number(it.interes_calculado) || 0,
                  debe: it.debe != null ? Number(it.debe) : undefined,
                  dias_mora: it.dias_mora != null ? Number(it.dias_mora) : undefined,
                  tasa_mensual: it.tasa_mensual != null ? Number(it.tasa_mensual) : undefined
                }))
              : []
          }
        : null
      return {
        success: true,
        data: {
          ficha: {
            ...ficha,
            porcentaje_interes_mensual:
              ficha.porcentaje_interes_mensual != null
                ? Number(ficha.porcentaje_interes_mensual)
                : null,
            porcentaje_interes_mora_mensual:
              ficha.porcentaje_interes_mora_mensual != null
                ? Number(ficha.porcentaje_interes_mora_mensual)
                : null,
            dias_gracia: ficha.dias_gracia != null ? Number(ficha.dias_gracia) : 0
          },
          resumen: {
            ...resumen,
            saldo_actual: Number(resumen.saldo_actual) || 0,
            total_cargos: Number(resumen.total_cargos) || 0,
            total_pagos: Number(resumen.total_pagos) || 0,
            monto_pendiente_ventas: Number(resumen.monto_pendiente_ventas) || 0,
            porcentaje_interes_mensual:
              resumen.porcentaje_interes_mensual != null
                ? Number(resumen.porcentaje_interes_mensual)
                : null,
            porcentaje_interes_mora_mensual:
              resumen.porcentaje_interes_mora_mensual != null
                ? Number(resumen.porcentaje_interes_mora_mensual)
                : null,
            dias_gracia: resumen.dias_gracia != null ? Number(resumen.dias_gracia) : 0,
            tasa_mora_vigente:
              resumen.tasa_mora_vigente != null ? Number(resumen.tasa_mora_vigente) : null,
            intereses_devengados: intereses
          },
          movimientos: movs.map((m) => ({
            ...m,
            debe: Number(m.debe) || 0,
            haber: Number(m.haber) || 0,
            saldo_acumulado: m.saldo_acumulado != null ? Number(m.saldo_acumulado) : undefined
          })),
          ventas_cc: await this.enriquecerVentasCcPerfil(ventas.map((v) => ({ ...v, valor_total: Number(v.valor_total) || 0 })))
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar perfil' }
    }
  }

  private async enriquecerVentasCcPerfil(ventas: CcVentaResumen[]): Promise<CcVentaResumen[]> {
    if (!supabase || ventas.length === 0) return ventas
    const ids = ventas.map((v) => v.id).filter((id) => Number.isFinite(id))
    if (!ids.length) return ventas
    const { data: detalles, error } = await supabase
      .from('ventas')
      .select('id, id_vendedor, nombre_vendedor, monto_pagado, estado_pago, fecha_venta, valor_total')
      .in('id', ids)
    if (error) {
      console.warn('enriquecerVentasCcPerfil:', error.message)
      return ventas
    }
    return enriquecerVentasCcResumenes(ventas, detalles ?? [])
  }

  async actualizarCondicionesCreditoCc(payload: {
    id_cliente: number
    id_usuario: number
    porcentaje_interes_mensual?: number | null
    porcentaje_interes_mora_mensual?: number | null
    dias_gracia?: number | null
    limite_credito?: number | null
    ajuste_manual?: number
    notas?: string | null
  }): Promise<
    ApiResponse<{
      id_cliente: number
      score: number
      score_nivel: string
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('actualizar_condiciones_credito_cc', {
        p_id_cliente: payload.id_cliente,
        p_id_usuario: payload.id_usuario,
        p_porcentaje_interes_mensual: payload.porcentaje_interes_mensual ?? null,
        p_porcentaje_interes_mora_mensual: payload.porcentaje_interes_mora_mensual ?? null,
        p_dias_gracia: payload.dias_gracia ?? null,
        p_limite_credito: payload.limite_credito ?? null,
        p_ajuste_manual: payload.ajuste_manual ?? null,
        p_notas: payload.notas ?? null
      })
      if (error) return { success: false, error: error.message }
      const row = data as Record<string, unknown>
      return {
        success: true,
        data: {
          id_cliente: row.id_cliente as number,
          score: row.score as number,
          score_nivel: row.score_nivel as string
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al guardar condiciones' }
    }
  }

  async registrarInteresesDevengadosCc(
    idCliente: number,
    idUsuario: number
  ): Promise<ApiResponse<{ registrados: number; monto_total: number; periodo: string }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('cc_registrar_intereses_devengados', {
        p_id_cliente: idCliente,
        p_id_usuario: idUsuario
      })
      if (error) return { success: false, error: error.message }
      const row = data as { registrados?: number; monto_total?: number; periodo?: string }
      return {
        success: true,
        data: {
          registrados: row.registrados ?? 0,
          monto_total: Number(row.monto_total) || 0,
          periodo: row.periodo ?? ''
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al registrar intereses' }
    }
  }

  async registrarPagoCuentaCorriente(payload: {
    id_cliente: number
    monto: number
    fecha_pago: string
    metodo_pago?: string
    url_comprobante: string
    id_usuario: number
    referencia?: string
    notas?: string
    id_venta?: number | null
  }): Promise<ApiResponse<{ id_movimiento: number; id_cliente: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('cc_registrar_pago', {
        p_id_cliente: payload.id_cliente,
        p_monto: payload.monto,
        p_fecha_pago: payload.fecha_pago,
        p_metodo_pago: payload.metodo_pago ?? null,
        p_url_comprobante: payload.url_comprobante,
        p_id_usuario: payload.id_usuario,
        p_referencia: payload.referencia ?? null,
        p_notas: payload.notas ?? null,
        p_id_venta: payload.id_venta ?? null
      })
      if (error) return { success: false, error: error.message }
      const row = data as { id_movimiento: number; id_cliente: number }
      return { success: true, data: row }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al registrar pago' }
    }
  }

  async recalcularScoringCuentaCorrienteTodos(
    idUsuario: number
  ): Promise<ApiResponse<{ recalculados: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('recalcular_scoring_cc_todos', {
        p_id_usuario: idUsuario
      })
      if (error) return { success: false, error: error.message }
      const row = data as { recalculados?: number }
      return { success: true, data: { recalculados: row.recalculados ?? 0 } }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al recalcular scoring' }
    }
  }

  /** @deprecated Usar registrarAltaCuentaCorriente con requisitos completos */
  async agregarClienteCuentaCorriente(idCliente: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { error } = await supabase.rpc('agregar_cliente_cuenta_corriente', {
        p_id_cliente: idCliente
      })
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al agregar cliente' }
    }
  }

  async quitarClienteCuentaCorriente(idCliente: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { error } = await supabase.rpc('quitar_cliente_cuenta_corriente', {
        p_id_cliente: idCliente
      })
      if (!error) return { success: true }

      const msg = error.message || ''
      const rpcMissing =
        msg.includes('quitar_cliente_cuenta_corriente') ||
        msg.includes('Could not find the function') ||
        error.code === '42883'

      if (!rpcMissing) return { success: false, error: msg }

      await supabase.from('cc_cuenta_movimientos').delete().eq('id_cliente', idCliente)
      const { error: delErr, count } = await supabase
        .from('clientes_cuenta_corriente')
        .delete({ count: 'exact' })
        .eq('id_cliente', idCliente)

      if (delErr) return { success: false, error: delErr.message }
      if (!count) return { success: false, error: 'El cliente no está en cuenta corriente' }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al quitar cliente' }
    }
  }

  /** Panel cobranzas CC: ventas fiadas abiertas, vendedor, aging. */
  async listCobranzasCcPanel(diasHistorial = 120): Promise<ApiResponse<CcCobranzasPanelData>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const desde = new Date()
      desde.setDate(desde.getDate() - diasHistorial)
      const fechaDesde = desde.toISOString().slice(0, 10)

      const ventasRes = await this.obtenerVentas(undefined, fechaDesde, undefined, 'todos')
      if (!ventasRes.success) {
        return { success: false, error: ventasRes.error || 'Error al cargar ventas CC' }
      }

      const ventas_abiertas = ventasCcAbiertasDesdeVentas(ventasRes.data ?? [])
      const por_vendedor = resumenPorVendedor(ventas_abiertas)
      const top_clientes = resumenPorCliente(ventas_abiertas)
      const aging = agingDesdeItems(ventas_abiertas)
      const total_por_cobrar = ventas_abiertas.reduce((s, v) => s + v.monto_pendiente, 0)
      const total_vencido = ventas_abiertas
        .filter((v) => v.dias_vencido > 0)
        .reduce((s, v) => s + v.monto_pendiente, 0)
      const clientes_con_deuda = top_clientes.length

      const mesInicio = new Date()
      mesInicio.setDate(1)
      const mesKey = mesInicio.toISOString().slice(0, 7)

      const { data: pagosRaw, error: pagosErr } = await supabase
        .from('cc_cuenta_movimientos')
        .select('id, id_cliente, haber, fecha, tipo, concepto, url_comprobante')
        .eq('tipo', 'pago')
        .gte('fecha', `${mesKey}-01`)
        .order('fecha', { ascending: false })
        .limit(50)

      if (pagosErr) {
        console.warn('listCobranzasCcPanel pagos:', pagosErr.message)
      }

      let cobrado_mes = 0
      let pagos_mes_count = 0
      for (const p of pagosRaw ?? []) {
        if (p.tipo !== 'pago') continue
        cobrado_mes += Number(p.haber) || 0
        pagos_mes_count += 1
      }

      const denominador = cobrado_mes + total_por_cobrar
      const tasa_cobranza_mes = denominador > 0 ? Math.round((cobrado_mes / denominador) * 100) : 0

      const clienteNombre = new Map<number, string>()
      for (const c of top_clientes) clienteNombre.set(c.id_cliente, c.cliente_nombre)

      const pagosClienteIds = [
        ...new Set((pagosRaw ?? []).map((p) => p.id_cliente).filter((id) => Number.isFinite(id)))
      ]
      const faltanIds = pagosClienteIds.filter((id) => !clienteNombre.has(id))
      if (faltanIds.length) {
        const { data: fichas } = await supabase
          .from('clientes_cuenta_corriente')
          .select('id_cliente, razon_social, nombre')
          .in('id_cliente', faltanIds)
        for (const f of fichas ?? []) {
          clienteNombre.set(
            f.id_cliente,
            f.razon_social || f.nombre || `Cliente #${f.id_cliente}`
          )
        }
      }

      const pagos_recientes = (pagosRaw ?? [])
        .filter((p) => p.tipo === 'pago')
        .slice(0, 15)
        .map((p) => ({
          id_movimiento: p.id,
          fecha: String(p.fecha).slice(0, 10),
          monto: Number(p.haber) || 0,
          id_cliente: p.id_cliente,
          cliente_nombre: clienteNombre.get(p.id_cliente) || `Cliente #${p.id_cliente}`,
          concepto: p.concepto,
          url_comprobante: p.url_comprobante
        }))

      return {
        success: true,
        data: {
          ventas_abiertas,
          por_vendedor,
          top_clientes,
          aging,
          cobrado_mes,
          pagos_mes_count,
          total_por_cobrar,
          total_vencido,
          clientes_con_deuda,
          tasa_cobranza_mes,
          pagos_recientes
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar cobranzas CC' }
    }
  }

  // ========== ATENCIÓN AL PÚBLICO ==========
  async listConversacionesAtencion(): Promise<ApiResponse<Array<{
    id: number
    cliente_nombre: string | null
    cliente_email: string | null
    canal: string
    ultimo_mensaje_preview: string | null
    estado: string
    usuario_asignado_id: number | null
    visto_por_staff_at: string | null
    historial_mensajes?: Array<{ role: string; text: string }>
    respuestas_staff?: Array<{ autor: string; texto: string; created_at?: string }>
    created_at: string
    updated_at: string
  }>>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('atencion_conversaciones')
        .select('id, cliente_nombre, cliente_email, cliente_telefono, cliente_whatsapp_link, canal, ultimo_mensaje_preview, estado, usuario_asignado_id, visto_por_staff_at, historial_mensajes, respuestas_staff, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as any }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar conversaciones' }
    }
  }

  async getConversacionAtencion(id: number): Promise<ApiResponse<{
    id: number
    cliente_nombre: string | null
    cliente_email: string | null
    canal: string
    ultimo_mensaje_preview: string | null
    estado: string
    historial_mensajes: Array<{ role: string; text: string }>
    respuestas_staff: Array<{ autor: string; texto: string; created_at?: string }>
    visto_por_staff_at: string | null
    created_at: string
    updated_at: string
  }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('atencion_conversaciones')
        .select('id, cliente_nombre, cliente_email, cliente_telefono, cliente_whatsapp_link, canal, ultimo_mensaje_preview, estado, historial_mensajes, respuestas_staff, visto_por_staff_at, created_at, updated_at')
        .eq('id', id)
        .single()
      if (error) return { success: false, error: error.message }
      const row = data as any
      // Marcar como visto/abierto por staff si aún no lo está
      if (!row?.visto_por_staff_at) {
        await supabase
          .from('atencion_conversaciones')
          .update({ visto_por_staff_at: new Date().toISOString() })
          .eq('id', id)
      }
      return {
        success: true,
        data: {
          ...row,
          respuestas_staff: Array.isArray(row?.respuestas_staff) ? row.respuestas_staff : [],
          visto_por_staff_at: row?.visto_por_staff_at || new Date().toISOString()
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar conversación' }
    }
  }

  async addRespuestaConversacionAtencion(
    id: number,
    params: { autor: string; texto: string }
  ): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data: row } = await supabase
        .from('atencion_conversaciones')
        .select('respuestas_staff')
        .eq('id', id)
        .single()
      const current = (Array.isArray((row as any)?.respuestas_staff) ? (row as any).respuestas_staff : []) as Array<{ autor: string; texto: string; created_at?: string }>
      const nueva = [...current, { ...params, created_at: new Date().toISOString() }]
      const { error } = await supabase
        .from('atencion_conversaciones')
        .update({ respuestas_staff: nueva, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al enviar respuesta' }
    }
  }

  /** Conteo liviano para badge del header (conversaciones/reclamos/solicitudes sin ver). */
  async getAtencionPublicoPendientesCount(): Promise<
    ApiResponse<{ total: number; conversaciones: number; solicitudes: number; reclamos: number }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const [convRes, solRes, recRes] = await Promise.all([
        supabase
          .from('atencion_conversaciones')
          .select('id', { count: 'exact', head: true })
          .is('visto_por_staff_at', null),
        supabase
          .from('solicitudes_atencion_chat')
          .select('id', { count: 'exact', head: true })
          .is('visto_por_staff_at', null),
        supabase
          .from('atencion_reclamos')
          .select('id', { count: 'exact', head: true })
          .in('estado', ['abierto', 'en_revision'])
      ])

      const conversaciones = convRes.error ? 0 : convRes.count ?? 0
      const solicitudes = solRes.error ? 0 : solRes.count ?? 0
      const reclamos = recRes.error ? 0 : recRes.count ?? 0

      return {
        success: true,
        data: {
          conversaciones,
          solicitudes,
          reclamos,
          total: conversaciones + solicitudes + reclamos
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al contar pendientes de atención' }
    }
  }

  async listReclamosAtencion(): Promise<ApiResponse<Array<{
    id: number
    cliente_nombre: string | null
    cliente_email: string | null
    cliente_telefono: string | null
    descripcion: string
    estado: string
    prioridad: string
    notas_internas: string | null
    usuario_asignado_id: number | null
    sector_id: number | null
    numero_op: string | null
    foto_producto_url: string | null
    created_at: string
    updated_at: string
  }>>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('atencion_reclamos')
        .select('id, cliente_nombre, cliente_email, cliente_telefono, descripcion, estado, prioridad, notas_internas, usuario_asignado_id, sector_id, numero_op, foto_producto_url, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as any }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar reclamos' }
    }
  }

  async updateReclamoAtencion(
    id: number,
    updates: { estado?: string; prioridad?: string; usuario_asignado_id?: number | null; sector_id?: number | null; notas_internas?: string | null }
  ): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.estado != null) payload.estado = updates.estado
      if (updates.prioridad != null) payload.prioridad = updates.prioridad
      if (updates.usuario_asignado_id !== undefined) payload.usuario_asignado_id = updates.usuario_asignado_id
      if (updates.sector_id !== undefined) payload.sector_id = updates.sector_id
      if (updates.notas_internas !== undefined) payload.notas_internas = updates.notas_internas
      const { error } = await supabase.from('atencion_reclamos').update(payload).eq('id', id)
      if (error) return { success: false, error: error.message }
      if (updates.sector_id !== undefined && updates.sector_id != null) {
        const { data: r } = await supabase.from('atencion_reclamos').select('cliente_nombre, cliente_email, descripcion').eq('id', id).single()
        const row = r as any
        const cliente = row?.cliente_nombre || row?.cliente_email || 'Cliente'
        await supabase.rpc('notificar_reclamo_sector', {
          p_reclamo_id: id,
          p_sector_id: updates.sector_id,
          p_cliente_label: cliente,
          p_descripcion: row?.descripcion || ''
        })
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al actualizar reclamo' }
    }
  }

  async crearReclamoAtencion(reclamo: {
    cliente_nombre?: string | null
    cliente_email?: string | null
    cliente_telefono?: string | null
    descripcion: string
    prioridad?: string
    estado?: string
    sector_id?: number | null
    numero_op?: string | null
    foto_producto_url?: string | null
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('crear_reclamo_atencion', {
        p_cliente_nombre: reclamo.cliente_nombre || null,
        p_cliente_email: reclamo.cliente_email || null,
        p_descripcion: reclamo.descripcion,
        p_prioridad: reclamo.prioridad || 'media',
        p_estado: reclamo.estado || 'nuevo',
        p_sector_id: reclamo.sector_id ?? null,
        p_cliente_telefono: reclamo.cliente_telefono || null,
        p_numero_op: reclamo.numero_op || null,
        p_foto_producto_url: reclamo.foto_producto_url || null
      })
      if (error) return { success: false, error: error.message }
      const reclamoId = (data as any)?.id
      if (!reclamoId) return { success: false, error: 'No se obtuvo el ID del reclamo' }
      return { success: true, data: { id: reclamoId } }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al crear reclamo' }
    }
  }

  async registrarEncuestaSatisfaccionPublic(payload: {
    rating: number
    departamento: string
    distrito: string
    edad: number
    sexo: 'f' | 'm' | 'x' | 'prefiero_no_decir'
    lat: number
    lng: number
    comentario?: string | null
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('registrar_encuesta_satisfaccion_public', {
        p_rating: payload.rating,
        p_departamento: payload.departamento,
        p_distrito: payload.distrito,
        p_edad: payload.edad,
        p_sexo: payload.sexo,
        p_lat: payload.lat,
        p_lng: payload.lng,
        p_comentario: payload.comentario ?? null
      })
      if (error) return { success: false, error: error.message }
      const raw = data as { id?: number } | string | null
      const parsed =
        typeof raw === 'string'
          ? (() => {
              try {
                return JSON.parse(raw) as { id?: number }
              } catch {
                return null
              }
            })()
          : raw
      const id = parsed?.id
      if (!id || !Number.isFinite(Number(id))) return { success: false, error: 'No se obtuvo el ID de la encuesta' }
      return { success: true, data: { id: Number(id) } }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al registrar encuesta' }
    }
  }

  async registrarSatisfaccionEntregaPublic(payload: {
    numeroOp: string
    rating: number
    comentario?: string | null
    clienteNombre?: string | null
    ordenId?: number | null
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('registrar_satisfaccion_entrega_public', {
        p_numero_op: payload.numeroOp.trim(),
        p_rating: payload.rating,
        p_comentario: payload.comentario ?? null,
        p_cliente_nombre: payload.clienteNombre ?? null,
        p_orden_id: payload.ordenId ?? null
      })
      if (error) return { success: false, error: error.message }
      const raw = data as { id?: number } | string | null
      const parsed =
        typeof raw === 'string'
          ? (() => {
              try {
                return JSON.parse(raw) as { id?: number }
              } catch {
                return null
              }
            })()
          : raw
      const id = parsed?.id
      if (!id || !Number.isFinite(Number(id))) return { success: false, error: 'No se obtuvo el ID de la encuesta' }
      return { success: true, data: { id: Number(id) } }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al registrar encuesta de entrega' }
    }
  }

  async getSatisfaccionEntregaContextStats(): Promise<
    ApiResponse<{
      firmas7d: number
      firmas30d: number
      entregas7d: number
      entregas30d: number
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const since7 = new Date()
    since7.setDate(since7.getDate() - 7)
    const since30 = new Date()
    since30.setDate(since30.getDate() - 30)
    const iso7 = since7.toISOString()
    const iso30 = since30.toISOString()

    try {
      const [firmas7, firmas30, entregas7, entregas30] = await Promise.all([
        supabase
          .from('firmas_entrega_cliente')
          .select('id', { count: 'exact', head: true })
          .gte('updated_at', iso7),
        supabase
          .from('firmas_entrega_cliente')
          .select('id', { count: 'exact', head: true })
          .gte('updated_at', iso30),
        supabase
          .from('ordenes_trabajo')
          .select('id', { count: 'exact', head: true })
          .eq('entregado', true)
          .gte('fecha_entrega_efectiva', iso7),
        supabase
          .from('ordenes_trabajo')
          .select('id', { count: 'exact', head: true })
          .eq('entregado', true)
          .gte('fecha_entrega_efectiva', iso30)
      ])

      if (firmas7.error) return { success: false, error: firmas7.error.message }
      if (firmas30.error) return { success: false, error: firmas30.error.message }
      if (entregas7.error) return { success: false, error: entregas7.error.message }
      if (entregas30.error) return { success: false, error: entregas30.error.message }

      return {
        success: true,
        data: {
          firmas7d: firmas7.count ?? 0,
          firmas30d: firmas30.count ?? 0,
          entregas7d: entregas7.count ?? 0,
          entregas30d: entregas30.count ?? 0
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar estadísticas de entrega' }
    }
  }

  /** Notas de encuesta post-entrega ya cargadas (por numero_op). */
  async getSatisfaccionEntregaPorOps(
    numeroOps: string[]
  ): Promise<ApiResponse<Record<string, { rating: number; comentario: string | null }>>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const ops = [...new Set(numeroOps.map((o) => String(o).trim()).filter(Boolean))].slice(0, 50)
    if (ops.length === 0) return { success: true, data: {} }
    try {
      const { data, error } = await supabase
        .from('atencion_satisfaccion_entrega')
        .select('numero_op, rating, comentario')
        .in('numero_op', ops)
      if (error) return { success: false, error: error.message }
      const map: Record<string, { rating: number; comentario: string | null }> = {}
      for (const row of data || []) {
        const op = String((row as { numero_op: string }).numero_op).trim()
        if (op) {
          map[op] = {
            rating: Number((row as { rating: number }).rating),
            comentario: (row as { comentario: string | null }).comentario
          }
        }
      }
      return { success: true, data: map }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al consultar encuestas' }
    }
  }

  async getOrdenesContextoSatisfaccion(numeroOps: string[]): Promise<
    ApiResponse<
      Array<{
        id: number
        numero_op: string
        cliente: string | null
        sector: string | null
        estado: string | null
        descripcion: string | null
        fecha_entrega_efectiva: string | null
        entregado_a: string | null
        observaciones_entrega: string | null
        en_reclamo: boolean | null
        operario_asignado: string | null
        sectores: string[] | null
        prioridad: string | null
        complejidad: string | null
      }>
    >
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const ops = [...new Set(numeroOps.map((o) => String(o).trim()).filter(Boolean))].slice(0, 50)
    if (ops.length === 0) return { success: true, data: [] }
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select(
          'id, numero_op, cliente, sector, estado, descripcion, fecha_entrega_efectiva, entregado_a, observaciones_entrega, en_reclamo, operario_asignado, sectores, prioridad, complejidad'
        )
        .in('numero_op', ops)
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as any }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar contexto de OPs' }
    }
  }

  async listSatisfaccionEntregaAtencion(limit = 500): Promise<
    ApiResponse<
      Array<{
        id: number
        numero_op: string
        orden_id: number | null
        cliente_nombre: string | null
        rating: number
        comentario: string | null
        created_at: string
        updated_at: string
      }>
    >
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('atencion_satisfaccion_entrega')
        .select('id, numero_op, orden_id, cliente_nombre, rating, comentario, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 2000))
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as any }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar encuestas de entrega' }
    }
  }

  async listEncuestasSatisfaccionAtencion(limit = 500): Promise<
    ApiResponse<
      Array<{
        id: number
        rating: number
        departamento: string
        distrito: string
        edad: number
        sexo: string
        lat: number
        lng: number
        comentario: string | null
        created_at: string
      }>
    >
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('atencion_satisfaccion_encuestas')
        .select('id, rating, departamento, distrito, edad, sexo, lat, lng, comentario, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 2000))
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as any }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar encuestas' }
    }
  }

  async buscarReclamosPublico(email: string, telefono: string): Promise<ApiResponse<Array<{
    id: number
    descripcion: string
    estado: string
    numero_op: string | null
    foto_producto_url: string | null
    created_at: string
  }>>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('buscar_reclamos_publico', {
        p_email: email?.trim() || null,
        p_telefono: telefono?.trim() || null
      })
      if (error) return { success: false, error: error.message }
      const rows = (data || []) as Array<{ id: number; descripcion: string; estado: string; numero_op: string | null; foto_producto_url: string | null; created_at: string }>
      return { success: true, data: rows }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al buscar reclamos' }
    }
  }

  async getSolicitudAtencionChat(id: number): Promise<ApiResponse<{
    id: number
    cliente_nombre: string | null
    sector_solicitado: string
    rol_solicitado: string | null
    mensaje_cliente: string | null
    estado: string
    historial_mensajes: Array<{ role: string; text: string }>
    respuestas_staff: Array<{ autor: string; texto: string; created_at?: string }>
    visto_por_staff_at: string | null
    created_at: string
  }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('solicitudes_atencion_chat')
        .select('id, cliente_nombre, sector_solicitado, rol_solicitado, mensaje_cliente, estado, historial_mensajes, respuestas_staff, visto_por_staff_at, created_at')
        .eq('id', id)
        .single()
      if (error) return { success: false, error: error.message }
      const row = data as any
      // Marcar como visto/abierto por staff si aún no lo está
      if (!row?.visto_por_staff_at) {
        await supabase
          .from('solicitudes_atencion_chat')
          .update({ visto_por_staff_at: new Date().toISOString() })
          .eq('id', id)
      }
      return {
        success: true,
        data: {
          ...row,
          visto_por_staff_at: row?.visto_por_staff_at || new Date().toISOString()
        }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar solicitud' }
    }
  }

  async addRespuestaSolicitudChat(
    id: number,
    params: { autor: string; texto: string }
  ): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data: row } = await supabase
        .from('solicitudes_atencion_chat')
        .select('respuestas_staff, atencion_conversacion_id')
        .eq('id', id)
        .single()
      const current = (Array.isArray((row as any)?.respuestas_staff) ? (row as any).respuestas_staff : []) as Array<{ autor: string; texto: string; created_at?: string }>
      const nuevaRespuesta = { ...params, created_at: new Date().toISOString() }
      const nueva = [...current, nuevaRespuesta]
      const { error } = await supabase
        .from('solicitudes_atencion_chat')
        .update({ respuestas_staff: nueva })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      const convId = (row as any)?.atencion_conversacion_id
      if (convId != null && Number.isInteger(Number(convId))) {
        const { data: convRow } = await supabase
          .from('atencion_conversaciones')
          .select('respuestas_staff')
          .eq('id', convId)
          .single()
        const currentConv = (Array.isArray((convRow as any)?.respuestas_staff) ? (convRow as any).respuestas_staff : []) as Array<{ autor: string; texto: string; created_at?: string }>
        await supabase
          .from('atencion_conversaciones')
          .update({ respuestas_staff: [...currentConv, nuevaRespuesta], updated_at: new Date().toISOString() })
          .eq('id', convId)
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al enviar respuesta' }
    }
  }

  // ========== CHAT ==========
  async getMensajesChat(canal: string, limit: number = 50): Promise<ApiResponse<ChatMessageUI[]>> {
    if (supabase) {
      const roomId = roomIdFromCanal(canal)

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, id_usuario, nombre_usuario, mensaje, timestamp, archivos_urls, reply_to_id, reacciones, estado_entrega')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }

      const mensajes =
        data?.map((msg: any) => {
          // Parsear archivos_urls si existe
          let archivosUrls: string[] | undefined = undefined
          if (msg.archivos_urls) {
            try {
              if (typeof msg.archivos_urls === 'string') {
                archivosUrls = JSON.parse(msg.archivos_urls)
              } else if (Array.isArray(msg.archivos_urls)) {
                archivosUrls = msg.archivos_urls
              }
            } catch (e) {
              console.error('Error parseando archivos_urls:', e)
            }
          }
          
          let reacciones: ReaccionesMap | undefined = undefined
          const rawReacciones = msg.reacciones
          if (rawReacciones) {
            try {
              if (typeof rawReacciones === 'string') {
                reacciones = JSON.parse(rawReacciones)
              } else {
                reacciones = rawReacciones as ReaccionesMap
              }
            } catch (e) {
              console.error('Error parseando reacciones:', e)
            }
          }

          return {
            id: msg.id,
            canal: roomToChatChannel[msg.room_id] ?? canal,
            usuario_id: msg.id_usuario,
            nombre_usuario: msg.nombre_usuario,
            contenido: msg.mensaje,
            tipo: inferChatType(msg.mensaje),
            timestamp: msg.timestamp,
            archivos_urls: archivosUrls,
            reply_to_id: msg.reply_to_id,
            reacciones,
            estado_entrega: (msg.estado_entrega as ChatMessageUI['estado_entrega']) ?? 'sent'
          }
        }) ?? []

      return { success: true, data: (mensajes.reverse() as ChatMessageUI[]) }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/chat/mensajes.php?canal=${canal}&limit=${limit}`)
    }

    return this.handleFallback(fallbackMensajes)
  }

  /**
   * Lista salas de mensajería (DM) donde participa el usuario.
   * Las DMs son `chat_rooms.tipo = 'privado'` y nombre `dm:<a>:<b>`.
   */
  async listarRoomsDmParaUsuario(
    usuarioId: number,
    limit = 200
  ): Promise<ApiResponse<Array<{ id: number; nombre: string; created_at?: string }>>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const likeA = `dm:${usuarioId}:%`
      const likeB = `dm:%:${usuarioId}`
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('id, nombre, created_at')
        .eq('tipo', 'privado')
        .or(`nombre.like.${likeA},nombre.like.${likeB}`)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error listando salas DM' }
    }
  }

  /** No leídos por room_id (batch). Requiere RPC `chat_contar_no_leidos_por_rooms`. */
  async contarNoLeidosPorRooms(
    usuarioId: number,
    roomIds: number[]
  ): Promise<ApiResponse<Record<number, number>>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const ids = roomIds.filter((n) => Number.isFinite(n))
    if (ids.length === 0) return { success: true, data: {} }
    try {
      const { data, error } = await supabase.rpc('chat_contar_no_leidos_por_rooms', {
        p_user_id: usuarioId,
        p_room_ids: ids
      })
      if (error) return { success: false, error: error.message }
      const rows = (Array.isArray(data) ? data : []) as Array<{ room_id: number; unread_count: number }>
      const out: Record<number, number> = {}
      for (const r of rows) out[Number(r.room_id)] = Number(r.unread_count) || 0
      return { success: true, data: out }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error contando no leídos' }
    }
  }

  /** Total de mensajes DM sin leer (mensajería interna), sumando todas las salas del usuario. */
  async getTotalDmMensajeriaUnread(usuarioId: number): Promise<ApiResponse<number>> {
    const roomsRes = await this.listarRoomsDmParaUsuario(usuarioId, 250)
    if (!roomsRes.success) return { success: false, error: roomsRes.error || 'Error listando salas' }
    const rooms = roomsRes.data ?? []
    if (rooms.length === 0) return { success: true, data: 0 }
    const unreadRes = await this.contarNoLeidosPorRooms(
      usuarioId,
      rooms.map((r) => r.id)
    )
    if (!unreadRes.success || unreadRes.data == null) {
      return { success: false, error: unreadRes.error || 'Error contando no leídos' }
    }
    const total = Object.values(unreadRes.data).reduce((a, b) => a + (Number(b) || 0), 0)
    return { success: true, data: total }
  }

  /**
   * Clave estable del room 1:1 entre dos usuarios.
   * Uso principal: mensajería RRHH (dashboard), distinta del chat por canales (#general, etc.).
   * Misma tabla `chat_messages` pero rooms `nombre` tipo `dm:a:b`, no `chatChannelToRoom`.
   */
  private dmRoomNombreKey(usuarioIdA: number, usuarioIdB: number): string {
    const a = Math.min(usuarioIdA, usuarioIdB)
    const b = Math.max(usuarioIdA, usuarioIdB)
    return `dm:${a}:${b}`
  }

  /**
   * Fallback si la RPC `obtener_o_crear_room_dm` no está desplegada en Supabase.
   * Ver: supabase/patches/2026-03-28_obtener_o_crear_room_dm.sql
   */
  private async obtenerOCrearRoomDmLegacy(
    usuarioIdA: number,
    usuarioIdB: number
  ): Promise<ApiResponse<{ roomId: number }>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }
    const nombre = this.dmRoomNombreKey(usuarioIdA, usuarioIdB)
    try {
      const { data: existing, error: selErr } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('nombre', nombre)
        .maybeSingle()

      if (selErr && selErr.code !== 'PGRST116') {
        return { success: false, error: selErr.message }
      }
      const ex = existing as { id: number } | null
      if (ex?.id != null) {
        return { success: true, data: { roomId: ex.id } }
      }

      const { data: inserted, error: insErr } = await supabase
        .from('chat_rooms')
        .insert({ nombre, tipo: 'privado' })
        .select('id')
        .single()

      if (insErr) {
        const msg = String(insErr.message || '')
        if (insErr.code === '23505' || msg.toLowerCase().includes('duplicate')) {
          const { data: again } = await supabase
            .from('chat_rooms')
            .select('id')
            .eq('nombre', nombre)
            .maybeSingle()
          const id = (again as { id: number } | null)?.id
          if (id != null) return { success: true, data: { roomId: id } }
        }
        if (msg.includes('chat_rooms_pkey')) {
          return {
            success: false,
            error:
              'Error al crear la sala (secuencia de IDs desincronizada). Ejecutá en Supabase el SQL: supabase/patches/2026-03-28_obtener_o_crear_room_dm.sql'
          }
        }
        return { success: false, error: insErr.message }
      }

      const row = inserted as { id: number }
      return { success: true, data: { roomId: row.id } }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al crear sala DM' }
    }
  }

  /**
   * Obtiene o crea un `chat_rooms` privado para conversación entre dos usuarios.
   * Preferís RPC en BD (sincroniza secuencia y evita duplicate key `chat_rooms_pkey`).
   */
  async obtenerOCrearRoomDm(
    usuarioIdA: number,
    usuarioIdB: number
  ): Promise<ApiResponse<{ roomId: number }>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }
    if (usuarioIdA === usuarioIdB) {
      return { success: false, error: 'No podés chatear contigo mismo' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_o_crear_room_dm', {
        p_usuario_a: usuarioIdA,
        p_usuario_b: usuarioIdB
      })

      if (!error && data != null && Number.isFinite(Number(data))) {
        return { success: true, data: { roomId: Number(data) } }
      }

      const errMsg = String(error?.message || '')
      if (errMsg.includes('mismos_usuarios')) {
        return { success: false, error: 'No podés chatear contigo mismo' }
      }

      const missingRpc =
        error?.code === '42883' ||
        errMsg.includes('Could not find the function') ||
        errMsg.includes('does not exist') ||
        errMsg.includes('obtener_o_crear_room_dm')

      if (missingRpc) {
        return this.obtenerOCrearRoomDmLegacy(usuarioIdA, usuarioIdB)
      }

      return { success: false, error: errMsg || 'No se pudo abrir la sala de mensajería' }
    } catch {
      return this.obtenerOCrearRoomDmLegacy(usuarioIdA, usuarioIdB)
    }
  }

  private mapChatMessageRow(msg: any, roomId: number): ChatMessageUI {
    let archivosUrls: string[] | undefined = undefined
    if (msg.archivos_urls) {
      try {
        if (typeof msg.archivos_urls === 'string') {
          archivosUrls = JSON.parse(msg.archivos_urls)
        } else if (Array.isArray(msg.archivos_urls)) {
          archivosUrls = msg.archivos_urls
        }
      } catch (e) {
        console.error('Error parseando archivos_urls:', e)
      }
    }

    let reacciones: ReaccionesMap | undefined = undefined
    const rawReacciones = msg.reacciones
    if (rawReacciones) {
      try {
        if (typeof rawReacciones === 'string') {
          reacciones = JSON.parse(rawReacciones)
        } else {
          reacciones = rawReacciones as ReaccionesMap
        }
      } catch (e) {
        console.error('Error parseando reacciones:', e)
      }
    }

    return {
      id: msg.id,
      canal: `dm:${roomId}`,
      usuario_id: msg.id_usuario,
      nombre_usuario: msg.nombre_usuario,
      contenido: msg.mensaje,
      tipo: inferChatType(msg.mensaje),
      timestamp: msg.timestamp,
      archivos_urls: archivosUrls,
      reply_to_id: msg.reply_to_id,
      reacciones,
      estado_entrega: (msg.estado_entrega as ChatMessageUI['estado_entrega']) ?? 'sent'
    }
  }

  /** Mensajes de un room por id (DM u otro canal no mapeado en chatChannelToRoom). */
  async getMensajesPorRoomId(roomId: number, limit: number = 80): Promise<ApiResponse<ChatMessageUI[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, id_usuario, nombre_usuario, mensaje, timestamp, archivos_urls, reply_to_id, reacciones, estado_entrega')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }

      const mensajes = data?.map((msg: any) => this.mapChatMessageRow(msg, roomId)) ?? []
      return { success: true, data: mensajes.reverse() as ChatMessageUI[] }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /** Página de mensajes (más recientes primero al pedir; devuelve orden cronológico). */
  async getMensajesPorRoomIdPaginated(
    roomId: number,
    limit: number,
    opts?: { beforeId?: number }
  ): Promise<ApiResponse<{ messages: ChatMessageUI[]; hasMore: boolean }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    let query = supabase
      .from('chat_messages')
      .select('id, room_id, id_usuario, nombre_usuario, mensaje, timestamp, archivos_urls, reply_to_id, reacciones, estado_entrega')
      .eq('room_id', roomId)
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (opts?.beforeId != null) {
      query = query.lt('id', opts.beforeId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    const rows = data ?? []
    const hasMore = rows.length > limit
    const page = (hasMore ? rows.slice(0, limit) : rows).map((msg: any) => this.mapChatMessageRow(msg, roomId))
    return { success: true, data: { messages: page.reverse(), hasMore } }
  }

  /** Mensajes nuevos posteriores a un id (para polling sin recargar todo el hilo). */
  async getMensajesNuevosPorRoomId(roomId: number, afterId: number): Promise<ApiResponse<ChatMessageUI[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, room_id, id_usuario, nombre_usuario, mensaje, timestamp, archivos_urls, reply_to_id, reacciones, estado_entrega')
      .eq('room_id', roomId)
      .gt('id', afterId)
      .order('id', { ascending: true })

    if (error) return { success: false, error: error.message }
    const mensajes = data?.map((msg: any) => this.mapChatMessageRow(msg, roomId)) ?? []
    return { success: true, data: mensajes as ChatMessageUI[] }
  }

  async enviarMensajeDm(params: {
    roomId: number
    contenido: string
    usuarioId: number
    archivosUrls?: string[]
  }): Promise<ApiResponse<ChatMessageUI>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }
    const nombreUsuario =
      localStorage.getItem('usuario') != null
        ? JSON.parse(localStorage.getItem('usuario') || '{}').nombre || 'Usuario'
        : 'Usuario'

    const payload: Record<string, unknown> = {
      room_id: params.roomId,
      id_usuario: params.usuarioId,
      nombre_usuario: nombreUsuario,
      mensaje: params.contenido,
      reply_to_id: null,
      estado_entrega: 'sent'
    }
    if (params.archivosUrls && params.archivosUrls.length > 0) {
      payload.archivos_urls = params.archivosUrls
    }

    const { data, error } = await supabase.from('chat_messages').insert(payload).select().single()

    if (error) return { success: false, error: error.message }

    const row = data as any
    let archivosUrls: string[] | undefined
    if (row.archivos_urls) {
      try {
        archivosUrls = Array.isArray(row.archivos_urls)
          ? row.archivos_urls
          : JSON.parse(String(row.archivos_urls))
      } catch {
        archivosUrls = params.archivosUrls
      }
    }
    return {
      success: true,
      data: {
        id: row.id,
        canal: `dm:${params.roomId}`,
        usuario_id: params.usuarioId,
        nombre_usuario: nombreUsuario,
        contenido: params.contenido,
        tipo: 'message',
        timestamp: row.timestamp,
        archivos_urls: archivosUrls,
        reply_to_id: null,
        reacciones: {},
        estado_entrega: 'sent'
      } as ChatMessageUI
    }
  }

  async generarPruebaMensajeDm(
    messageId: number,
    usuarioId: number
  ): Promise<
    ApiResponse<{
      proof_token: string
      message_id: number
      room_id: number
      id_usuario: number
      nombre_usuario: string
      mensaje: string
      msg_timestamp: string
      archivos_urls: string[]
      token_created_at: string
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('generar_prueba_mensaje_dm', {
        p_message_id: messageId,
        p_user_id: usuarioId
      })
      if (error) return { success: false, error: error.message }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return { success: false, error: 'No se pudo generar la prueba' }
      let archivos: string[] = []
      if (row.archivos_urls) {
        try {
          archivos = Array.isArray(row.archivos_urls)
            ? row.archivos_urls
            : JSON.parse(String(row.archivos_urls))
        } catch {
          archivos = []
        }
      }
      return {
        success: true,
        data: {
          proof_token: String(row.proof_token),
          message_id: Number(row.message_id),
          room_id: Number(row.room_id),
          id_usuario: Number(row.id_usuario),
          nombre_usuario: String(row.nombre_usuario ?? ''),
          mensaje: String(row.mensaje ?? ''),
          msg_timestamp: String(row.msg_timestamp ?? row.timestamp ?? ''),
          archivos_urls: archivos,
          token_created_at: String(row.token_created_at ?? '')
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al generar prueba' }
    }
  }

  async obtenerPruebaMensajePorToken(token: string): Promise<
    ApiResponse<{
      proof_token: string
      message_id: number
      room_id: number
      id_usuario: number
      nombre_usuario: string
      mensaje: string
      msg_timestamp: string
      archivos_urls: string[]
      token_created_at: string
      generated_by: number
      download_count: number
      room_nombre: string
      es_dm: boolean
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('obtener_prueba_mensaje_por_token', {
        p_token: token
      })
      if (error) return { success: false, error: error.message }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return { success: false, error: 'Token no válido o expirado' }
      let archivos: string[] = []
      if (row.archivos_urls) {
        try {
          archivos = Array.isArray(row.archivos_urls)
            ? row.archivos_urls
            : JSON.parse(String(row.archivos_urls))
        } catch {
          archivos = []
        }
      }
      return {
        success: true,
        data: {
          proof_token: String(row.proof_token),
          message_id: Number(row.message_id),
          room_id: Number(row.room_id),
          id_usuario: Number(row.id_usuario),
          nombre_usuario: String(row.nombre_usuario ?? ''),
          mensaje: String(row.mensaje ?? ''),
          msg_timestamp: String(row.msg_timestamp ?? ''),
          archivos_urls: archivos,
          token_created_at: String(row.token_created_at ?? ''),
          generated_by: Number(row.generated_by ?? 0),
          download_count: Number(row.download_count ?? 0),
          room_nombre: String(row.room_nombre ?? ''),
          es_dm: Boolean(row.es_dm)
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al verificar token' }
    }
  }

  async marcarChatLeido(canal: string, usuarioId: number): Promise<void> {
    if (!supabase) return
    const roomId = roomIdFromCanal(canal)
    try {
      await supabase.rpc('chat_marcar_leido', { p_user_id: usuarioId, p_room_id: roomId })
    } catch (e) {
      console.error('Error marcando chat como leído', e)
    }
  }

  async obtenerLastSeenOtros(canal: string, usuarioId: number): Promise<ApiResponse<string | null>> {
    if (!supabase) return { success: true, data: null }
    const roomId = chatChannelToRoom[canal] ?? 1
    try {
      const { data, error } = await supabase.rpc('chat_last_seen_otros', { p_room_id: roomId, p_user_id: usuarioId })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data: data as string | null }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al obtener last_seen' }
    }
  }

  async toggleReaccionChat(params: { canal: string; messageId: number; usuarioId: number; emoji: string }): Promise<ApiResponse<ReaccionesMap>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const roomId = chatChannelToRoom[params.canal] ?? 1
    try {
      const { data, error } = await supabase.rpc('chat_toggle_reaccion', {
        p_room_id: roomId,
        p_message_id: params.messageId,
        p_user_id: params.usuarioId,
        p_emoji: params.emoji
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ReaccionesMap }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al reaccionar' }
    }
  }

  async enviarMensajeChat(mensaje: {
    canal: string
    contenido: string
    usuario_id: number
    tipo?: string
    archivosUrls?: string[]
    replyToId?: number | null
  }): Promise<ApiResponse<ChatMessageUI>> {
    if (supabase) {
      const roomId = chatChannelToRoom[mensaje.canal] ?? 1

      // Asegurar que el room existe antes de insertar
      await this.ensureChatRoomExists(roomId, mensaje.canal)

      const payload: any = {
        room_id: roomId,
        id_usuario: mensaje.usuario_id,
        nombre_usuario: localStorage.getItem('usuario')
          ? JSON.parse(localStorage.getItem('usuario') || '{}').nombre
          : 'Usuario',
        mensaje:
          mensaje.tipo === 'buzz'
            ? 'Te ha enviado un zumbido!'
            : mensaje.tipo === 'alert'
              ? '¡Atención! Revisar esto de inmediato.'
              : mensaje.contenido,
        reply_to_id: mensaje.replyToId ?? null,
        estado_entrega: 'sent'
      }

      // Agregar URLs de archivos si existen
      if (mensaje.archivosUrls && mensaje.archivosUrls.length > 0) {
        payload.archivos_urls = mensaje.archivosUrls
      }

      const { data, error } = await supabase.from('chat_messages').insert(payload).select().single()

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        data: {
          id: data.id,
          canal: mensaje.canal,
          usuario_id: mensaje.usuario_id,
          nombre_usuario: payload.nombre_usuario,
          contenido: payload.mensaje,
          tipo: mensaje.tipo === 'alert' ? 'alert' : mensaje.tipo === 'buzz' ? 'buzz' : 'message',
          timestamp: data.timestamp,
          archivos_urls: mensaje.archivosUrls,
          reply_to_id: mensaje.replyToId ?? null,
          reacciones: {},
          estado_entrega: 'sent'
        } as ChatMessageUI
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/chat/mensajes.php', {
        method: 'POST',
        body: JSON.stringify(mensaje)
      })
    }

    const nuevoMensaje: ChatMessageUI = {
      id: fallbackMensajes.length + 1,
      canal: mensaje.canal,
      usuario_id: mensaje.usuario_id,
      contenido: mensaje.contenido,
      tipo: (mensaje.tipo as ChatMessageUI['tipo']) || 'message',
      timestamp: new Date().toISOString()
    }

    fallbackMensajes.push(nuevoMensaje)
    return { success: true, data: nuevoMensaje }
  }

  async enviarZumbido(
    _usuarioDestinoId: number,
    usuarioOrigenId: number,
    canal: string
  ): Promise<ApiResponse<ChatMessageUI>> {
    return this.enviarMensajeChat({
      canal,
      contenido: 'Te ha enviado un zumbido!',
      usuario_id: usuarioOrigenId,
      tipo: 'buzz'
    })
  }

  async enviarAlerta(
    _usuarioDestinoId: number,
    usuarioOrigenId: number,
    canal: string
  ): Promise<ApiResponse<ChatMessageUI>> {
    return this.enviarMensajeChat({
      canal,
      contenido: '¡Atención! Revisar esto de inmediato.',
      usuario_id: usuarioOrigenId,
      tipo: 'alert'
    })
  }

  // ========== AUTENTICACIÓN ==========
  async login(usuario: string, password: string): Promise<ApiResponse<{ usuario: UsuarioRecord }>> {
    const { staffLogin } = await import('./staffAuthApi')
    return staffLogin(usuario, password)
  }

  async logout() {
    const { staffLogout } = await import('./staffAuthApi')
    return staffLogout()
  }

  async verificarToken() {
    if (supabase) {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const { verifyStaffSession } = await import('./staffSession')
        const v = await verifyStaffSession()
        if (!v.ok) return { success: false }
        if (v.usuario) return { success: true, data: v.usuario }
      }
      const usuario = localStorage.getItem('usuario')
      return usuario ? { success: true, data: JSON.parse(usuario) } : { success: false }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/auth/verificar.php')
    }

    return { success: true }
  }

  // ========== ARCHIVOS ==========
  async subirArchivo(ordenId: number, archivo: File) {
    if (supabase) {
      const { data, error } = await supabase.storage
        .from('archivos')
        .upload(`ordenes/${ordenId}/${archivo.name}`, archivo, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    if (hasLegacyBackend) {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('orden_id', ordenId.toString())

      try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${LEGACY_API_BASE_URL}/archivos/subir.php`, {
          method: 'POST',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: formData
        })

        if (!response.ok) throw new Error('Error al subir archivo')
        return await response.json()
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }

    return { success: false, error: 'Storage no disponible en modo mock' }
  }

  async getArchivosOrden(ordenId: number) {
    if (supabase) {
      // Biblioteca / duplicadas: traer adjuntos del grupo completo (original + duplicadas).
      // Esto garantiza que "se vean tal cual" en todos los sectores, incluso en datos legacy.
      try {
        // Preferir RPC (SECURITY DEFINER) para evitar bloqueos por RLS en ordenes_trabajo.
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('get_enlaces_adjuntos_grupo', {
            p_orden_id: ordenId
          })
          if (!rpcErr) {
            return { success: true, data: (rpcData as any[]) ?? [] }
          }
        } catch {
          // ignore: fallback a método sin RPC
        }

        const { data: oRow, error: oErr } = await supabase
          .from('ordenes_trabajo')
          .select('id, numero_op, es_duplicado, id_orden_original')
          .eq('id', ordenId)
          .maybeSingle()
        if (oErr) return { success: false, error: oErr.message }
        if (!oRow) return { success: true, data: [] }

        const numeroOp = (oRow as any).numero_op as string | null
        const esDuplicado = (oRow as any).es_duplicado === true
        const idOrdenOriginal = (oRow as any).id_orden_original as number | null
        const rootId = esDuplicado && idOrdenOriginal ? idOrdenOriginal : (oRow as any).id

        // IDs del grupo (root + duplicadas por id_orden_original)
        const { data: chainRows, error: chainErr } = await supabase
          .from('ordenes_trabajo')
          .select('id')
          .or(`id.eq.${rootId},id_orden_original.eq.${rootId}`)
          .limit(200)
        if (chainErr) return { success: false, error: chainErr.message }

        const idsSet = new Set<number>(
          (((chainRows as any[]) ?? []).map((r) => Number((r as any).id)) ?? []).filter((n) =>
            Number.isFinite(n)
          )
        )

        // Fallback legacy: fichas del mismo numero_op con id_orden_original NULL
        if (numeroOp && String(numeroOp).trim() !== '') {
          const { data: legacyRows, error: legacyErr } = await supabase
            .from('ordenes_trabajo')
            .select('id')
            .is('id_orden_original', null)
            .eq('numero_op', numeroOp)
            .limit(200)
          if (legacyErr) return { success: false, error: legacyErr.message }
          for (const r of (legacyRows as any[]) ?? []) {
            const n = Number((r as any).id)
            if (Number.isFinite(n)) idsSet.add(n)
          }
        }

        const ids = [...idsSet]
        if (ids.length === 0) return { success: true, data: [] }

        const { data, error } = await supabase
          .from('enlaces_adjuntos')
          .select('*')
          .in('id_orden', ids)
          .order('creado_en', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar adjuntos del grupo.'
        return { success: false, error: msg }
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/archivos.php?orden_id=${ordenId}`)
    }

    return { success: true, data: [] }
  }

  async guardarArchivoOrden(
    ordenId: number,
    nombreArchivo: string,
    urlArchivo: string,
    options?: { esEvidenciaCampo?: boolean; origenRelevamiento?: boolean }
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const row: Record<string, unknown> = {
        id_orden: ordenId,
        titulo: nombreArchivo,
        url: urlArchivo
      }
      if (options?.esEvidenciaCampo === true) {
        row.es_evidencia_campo = true
      }
      if (options?.origenRelevamiento === true) {
        row.origen_relevamiento = true
      }
      const { data, error } = await supabase.from('enlaces_adjuntos').insert(row).select().single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Elimina un adjunto de enlaces_adjuntos.
   * Nota: la UI de adjuntos del grupo puede mostrar filas repetidas (mismo url en distintas fichas);
   * para borrado "real" y consistente, preferir deleteArchivosGrupoByUrl que borra en todo el grupo OP.
   */
  async deleteArchivoOrden(enlaceId: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { error } = await supabase.from('enlaces_adjuntos').delete().eq('id', enlaceId)
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar el adjunto.'
      return { success: false, error: msg }
    }
  }

  /** Borra un adjunto (por url) en todas las fichas del grupo OP (root+duplicadas+legacy). */
  async deleteArchivosGrupoByUrl(ordenId: number, url: string): Promise<ApiResponse<{ eliminadas: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const cleanUrl = String(url ?? '').trim()
    if (!cleanUrl) return { success: false, error: 'URL inválida.' }
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_enlaces_adjuntos_grupo', {
        p_orden_id: ordenId,
        p_url: cleanUrl
      })
      if (!rpcErr && rpcData != null) {
        const n = typeof rpcData === 'number' ? rpcData : Number(rpcData)
        return { success: true, data: { eliminadas: Number.isFinite(n) ? n : 0 } }
      }
      if (rpcErr) {
        console.warn('[deleteArchivosGrupoByUrl] RPC delete_enlaces_adjuntos_grupo:', rpcErr.message)
      }

      // Root/group ids (mismo criterio que getArchivosOrden)
      const { data: oRow, error: oErr } = await supabase
        .from('ordenes_trabajo')
        .select('id, numero_op, es_duplicado, id_orden_original')
        .eq('id', ordenId)
        .maybeSingle()
      if (oErr) return { success: false, error: oErr.message }
      if (!oRow) return { success: false, error: 'Orden no encontrada.' }

      const numeroOp = (oRow as any).numero_op as string | null
      const esDuplicado = (oRow as any).es_duplicado === true
      const idOrdenOriginal = (oRow as any).id_orden_original as number | null
      const rootId = esDuplicado && idOrdenOriginal ? idOrdenOriginal : (oRow as any).id

      const { data: chainRows, error: chainErr } = await supabase
        .from('ordenes_trabajo')
        .select('id')
        .or(`id.eq.${rootId},id_orden_original.eq.${rootId}`)
        .limit(200)
      if (chainErr) return { success: false, error: chainErr.message }

      const idsSet = new Set<number>(
        (((chainRows as any[]) ?? []).map((r) => Number((r as any).id)) ?? []).filter((n) =>
          Number.isFinite(n)
        )
      )

      if (numeroOp && String(numeroOp).trim() !== '') {
        const { data: legacyRows, error: legacyErr } = await supabase
          .from('ordenes_trabajo')
          .select('id')
          .is('id_orden_original', null)
          .eq('numero_op', numeroOp)
          .limit(200)
        if (legacyErr) return { success: false, error: legacyErr.message }
        for (const r of (legacyRows as any[]) ?? []) {
          const n = Number((r as any).id)
          if (Number.isFinite(n)) idsSet.add(n)
        }
      }

      const ids = [...idsSet]
      if (ids.length === 0) return { success: true, data: { eliminadas: 0 } }

      const { data: linkRows, error: listErr } = await supabase
        .from('enlaces_adjuntos')
        .select('id,url')
        .in('id_orden', ids)
      if (listErr) {
        console.warn('[deleteArchivosGrupoByUrl]', { ordenId, rpcErr: rpcErr?.message, listErr: listErr.message })
        const rpcMsg = rpcErr?.message ?? ''
        const looksLikeMissingPatch =
          /permission denied|42501|no existe la función|does not exist|function .* does not exist/i.test(rpcMsg) ||
          /permission denied|42501/i.test(listErr.message ?? '')
        if (looksLikeMissingPatch) {
          return {
            success: false,
            error:
              'No se pudo borrar el adjunto. Quien administra Plot debe aplicar en Supabase los parches de adjuntos del grupo OP (2026-04-23 y 2026-04-28 en supabase/patches/).'
          }
        }
        return { success: false, error: [rpcErr?.message, listErr.message].filter(Boolean).join(' · ') }
      }

      const targetNorm = normalizeAdjuntoUrlForMatch(cleanUrl)
      const matchingIds = ((linkRows as any[]) ?? [])
        .filter((r) => normalizeAdjuntoUrlForMatch(String(r?.url ?? '')) === targetNorm)
        .map((r) => Number(r.id))
        .filter((id) => Number.isFinite(id))

      if (matchingIds.length === 0) {
        return { success: true, data: { eliminadas: 0 } }
      }

      const { error: delErr, count } = await supabase
        .from('enlaces_adjuntos')
        .delete({ count: 'exact' })
        .in('id', matchingIds)
      if (delErr) {
        console.warn('[deleteArchivosGrupoByUrl]', { ordenId, rpcErr: rpcErr?.message, delErr: delErr.message })
        const rpcMsg = rpcErr?.message ?? ''
        const delMsg = delErr.message ?? ''
        const looksLikeMissingPatch =
          /permission denied|42501|no existe la función|does not exist|function .* does not exist/i.test(rpcMsg) ||
          /permission denied|42501/i.test(delMsg)
        if (looksLikeMissingPatch) {
          return {
            success: false,
            error:
              'No se pudo borrar el adjunto. Quien administra Plot debe aplicar en Supabase los parches de adjuntos del grupo OP (2026-04-23 y 2026-04-28 en supabase/patches/).'
          }
        }
        return {
          success: false,
          error: [rpcErr?.message, delErr.message].filter(Boolean).join(' · ')
        }
      }
      return { success: true, data: { eliminadas: count ?? matchingIds.length } }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar el adjunto del grupo.'
      return { success: false, error: msg }
    }
  }

  /**
   * Borra adjuntos del grupo OP usando el id de fila en enlaces_adjuntos (canónico en BD).
   * Preferido cuando la URL mostrada puede no coincidir byte-a-byte con la guardada.
   */
  async deleteAdjuntosGrupoPorEnlaceId(
    ordenId: number,
    enlaceId: number
  ): Promise<ApiResponse<{ eliminadas: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    if (!Number.isFinite(enlaceId) || enlaceId <= 0) {
      return { success: false, error: 'Adjunto inválido.' }
    }
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_enlaces_adjuntos_grupo_por_enlace_id', {
        p_orden_id: ordenId,
        p_enlace_id: enlaceId
      })
      if (!rpcErr && rpcData != null) {
        const n = typeof rpcData === 'number' ? rpcData : Number(rpcData)
        return { success: true, data: { eliminadas: Number.isFinite(n) ? n : 0 } }
      }
      if (rpcErr) {
        console.warn('[deleteAdjuntosGrupoPorEnlaceId] RPC:', rpcErr.message)
      }

      const { data: row, error: selErr } = await supabase
        .from('enlaces_adjuntos')
        .select('url')
        .eq('id', enlaceId)
        .maybeSingle()
      if (selErr || !(row as { url?: string })?.url) {
        return {
          success: false,
          error: selErr?.message || rpcErr?.message || 'No se encontró el adjunto.'
        }
      }
      return this.deleteArchivosGrupoByUrl(ordenId, String((row as { url: string }).url))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar el adjunto.'
      return { success: false, error: msg }
    }
  }

  async getOrdenRelevamiento(ordenId: number): Promise<ApiResponse<OrdenRelevamientoRecord>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('orden_relevamiento')
        .select('*')
        .eq('id_orden', ordenId)
        .maybeSingle()
      if (error) return { success: false, error: error.message }
      if (!data) {
        return {
          success: true,
          data: { id_orden: ordenId, notas: '', actualizado_por: null }
        }
      }
      return { success: true, data: data as OrdenRelevamientoRecord }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async upsertOrdenRelevamiento(
    ordenId: number,
    notas: string,
    actualizadoPor: string
  ): Promise<ApiResponse<OrdenRelevamientoRecord>> {
    if (supabase) {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('orden_relevamiento')
        .upsert(
          {
            id_orden: ordenId,
            notas,
            actualizado_en: now,
            actualizado_por: actualizadoPor
          },
          { onConflict: 'id_orden' }
        )
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as OrdenRelevamientoRecord }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getRelevamientoSubitems(ordenId: number): Promise<ApiResponse<RelevamientoSubitemRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('relevamiento_subitems')
        .select('*')
        .eq('id_orden', ordenId)
        .order('id', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as RelevamientoSubitemRecord[]) ?? [] }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async createRelevamientoSubitem(
    ordenId: number,
    titulo: string
  ): Promise<ApiResponse<RelevamientoSubitemRecord>> {
    if (supabase) {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('relevamiento_subitems')
        .insert({
          id_orden: ordenId,
          titulo: titulo.trim(),
          done: false,
          creado_en: now,
          actualizado_en: now
        })
        .select()
        .single()
      if (error || !data) return { success: false, error: error?.message || 'No se pudo crear el ítem' }
      return { success: true, data: data as RelevamientoSubitemRecord }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async setRelevamientoSubitemDone(id: number, done: boolean): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('relevamiento_subitems')
        .update({ done, actualizado_en: new Date().toISOString() })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  /** Órdenes con al menos un adjunto marcado como evidencia de la app campo (kanban Instalaciones / Metalúrgica). */
  async getOrdenIdsConEvidenciaCampo(): Promise<ApiResponse<number[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('enlaces_adjuntos')
        .select('id_orden')
        .eq('es_evidencia_campo', true)

      if (error) return { success: false, error: error.message }
      const ids = new Set<number>()
      for (const r of data ?? []) {
        const id = (r as { id_orden?: number }).id_orden
        if (typeof id === 'number' && id > 0) ids.add(id)
      }
      return { success: true, data: [...ids] }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async eliminarArchivoOrden(archivoId: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('enlaces_adjuntos')
        .delete()
        .eq('id', archivoId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== COMENTARIOS ==========
  async getComentariosOrden(ordenId: number): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('comentarios_orden')
        .select('*')
        .eq('id_orden', ordenId)
        .order('timestamp', { ascending: false })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: true, data: [] }
  }

  async addComentarioOrden(ordenId: number, comentario: string, usuarioNombre: string): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('comentarios_orden')
        .insert({
          id_orden: ordenId,
          comentario,
          usuario_nombre: usuarioNombre,
          timestamp: new Date().toISOString()
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Marca la ficha en reclamo (trabajo a rehacer): comentario, historial y `en_reclamo` en BD.
   */
  async marcarReclamoOrden(
    ordenId: number,
    detalleOpcional: string | undefined,
    usuarioNombre: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    const { data: row, error: fetchErr } = await supabase
      .from('ordenes_trabajo')
      .select('id, estado, en_reclamo')
      .eq('id', ordenId)
      .maybeSingle()

    if (fetchErr) {
      if (/en_reclamo|column|schema/i.test(String(fetchErr.message))) {
        return {
          success: false,
          error:
            'Falta la columna en_reclamo en la base. Ejecutá el parche SQL 2026-04-07_ordenes_en_reclamo.sql en Supabase.'
        }
      }
      return { success: false, error: fetchErr.message }
    }
    if (!row) return { success: false, error: 'Orden no encontrada' }

    const ya = (row as { en_reclamo?: boolean | null }).en_reclamo === true
    if (ya) return { success: false, error: 'Esta ficha ya está marcada con reclamo.' }

    const estado = (row as { estado?: string | null }).estado ?? null
    const detalle = (detalleOpcional ?? '').trim()
    const textoComentario = `[RECLAMO] El trabajo debe rehacerse.${detalle ? ` Motivo: ${detalle}` : ''}`

    const motivoDb = detalle || null
    let { error: upErr } = await supabase
      .from('ordenes_trabajo')
      .update({ en_reclamo: true, reclamo_motivo: motivoDb })
      .eq('id', ordenId)

    if (upErr && /reclamo_motivo/i.test(String(upErr.message))) {
      const r2 = await supabase.from('ordenes_trabajo').update({ en_reclamo: true }).eq('id', ordenId)
      upErr = r2.error
    }

    if (upErr) {
      if (/en_reclamo|column|schema/i.test(String(upErr.message))) {
        return {
          success: false,
          error:
            'Falta la columna en_reclamo en la base. Ejecutá el parche SQL 2026-04-07_ordenes_en_reclamo.sql en Supabase.'
        }
      }
      return { success: false, error: upErr.message }
    }

    const com = await this.addComentarioOrden(ordenId, textoComentario, usuarioNombre)
    if (!com.success) {
      console.warn('Reclamo: no se pudo guardar comentario:', com.error)
    }

    await this.registrarCambioHistorial(
      ordenId,
      estado,
      estado,
      textoComentario,
      'reclamo',
      { en_reclamo: { anterior: false, nuevo: true } }
    )

    const { data: full, error: fullErr } = await supabase
      .from('ordenes_trabajo')
      .select('*')
      .eq('id', ordenId)
      .single()

    if (fullErr || !full) {
      return {
        success: true,
        data: {
          ...(row as OrdenTrabajo),
          en_reclamo: true,
          reclamo_motivo: motivoDb
        } as OrdenTrabajo
      }
    }
    return { success: true, data: full as OrdenTrabajo }
  }

  /** Quita la marca de reclamo (p. ej. admin luego de rehacer). */
  async desmarcarReclamoOrden(
    ordenId: number,
    usuarioNombre: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    const { data: row, error: fetchErr } = await supabase
      .from('ordenes_trabajo')
      .select('id, estado, en_reclamo')
      .eq('id', ordenId)
      .maybeSingle()

    if (fetchErr) return { success: false, error: fetchErr.message }
    if (!row) return { success: false, error: 'Orden no encontrada' }

    if ((row as { en_reclamo?: boolean | null }).en_reclamo !== true) {
      return { success: false, error: 'La ficha no tiene reclamo activo.' }
    }

    const estado = (row as { estado?: string | null }).estado ?? null
    const textoComentario = `[RECLAMO] Marca de reclamo quitada por ${usuarioNombre}.`

    const { error: upErr } = await supabase
      .from('ordenes_trabajo')
      .update({ en_reclamo: false, reclamo_motivo: null })
      .eq('id', ordenId)

    if (upErr && /reclamo_motivo/i.test(String(upErr.message))) {
      const { error: up2 } = await supabase
        .from('ordenes_trabajo')
        .update({ en_reclamo: false })
        .eq('id', ordenId)
      if (up2) return { success: false, error: up2.message }
    } else if (upErr) {
      return { success: false, error: upErr.message }
    }

    await this.addComentarioOrden(ordenId, textoComentario, usuarioNombre)
    await this.registrarCambioHistorial(
      ordenId,
      estado,
      estado,
      textoComentario,
      'reclamo_resuelto',
      { en_reclamo: { anterior: true, nuevo: false } }
    )

    const { data: full, error: fullErr } = await supabase
      .from('ordenes_trabajo')
      .select('*')
      .eq('id', ordenId)
      .single()

    if (fullErr || !full) {
      return { success: true, data: { ...(row as OrdenTrabajo), en_reclamo: false } as OrdenTrabajo }
    }
    return { success: true, data: full as OrdenTrabajo }
  }

  /**
   * Auditoría de reclamos: marcas y desmarcas en historial_movimientos.
   * Útil para incidencias RRHH (incluye histórico aunque la OP ya no esté en reclamo).
   */
  async getHistorialReclamosIncidencias(limit = 8000): Promise<ApiResponse<HistorialMovimiento[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      let primary: HistorialMovimiento[] = []
      const q1 = await supabase
        .from('historial_movimientos')
        .select('*')
        .in('accion_tipo', ['reclamo', 'reclamo_resuelto'])
        .order('timestamp', { ascending: true })
        .limit(limit)

      if (!q1.error && q1.data) {
        primary = q1.data as HistorialMovimiento[]
      }

      let legacy: HistorialMovimiento[] = []
      const q2 = await supabase
        .from('historial_movimientos')
        .select('*')
        .ilike('comentario', '%[RECLAMO]%')
        .order('timestamp', { ascending: true })
        .limit(Math.min(limit, 6000))

      if (!q2.error && q2.data) legacy = q2.data as HistorialMovimiento[]

      if (primary.length === 0 && legacy.length === 0) {
        const msg = q1.error?.message || q2.error?.message || 'Sin datos de historial'
        return { success: false, error: msg }
      }

      const seen = new Set<string>()
      const merged: HistorialMovimiento[] = []
      for (const row of [...primary, ...legacy]) {
        const id = (row as { id?: number }).id
        const key =
          typeof id === 'number' && Number.isFinite(id)
            ? `id:${id}`
            : `f:${(row as HistorialMovimiento).id_orden}-${(row as HistorialMovimiento).timestamp}`
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(row as HistorialMovimiento)
      }
      merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      return { success: true, data: merged }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error historial reclamos' }
    }
  }

  // ========== IMPRESORAS ==========
  async getImpresoras(includeInactivas: boolean = false): Promise<ApiResponse<any[]>> {
    if (supabase) {
      let query = supabase
        .from('impresoras')
        .select('*')
      
      if (!includeInactivas) {
        query = query.eq('activa', true)
      }
      
      const { data, error } = await query.order('nombre', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getImpresorasOcupacion(): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('v_impresoras_ocupacion')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getUsoImpresora(impresoraId: number, limit: number = 50): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .select(`
          *,
          ordenes_trabajo:id_orden(numero_op, cliente, descripcion)
        `)
        .eq('id_impresora', impresoraId)
        .order('fecha_inicio', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async iniciarUsoImpresora(impresoraId: number, ordenId: number, operario?: string): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .insert({
          id_impresora: impresoraId,
          id_orden: ordenId,
          estado: 'En Proceso',
          operario: operario || null
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      
      // Actualizar estado de la impresora a "En Uso"
      await supabase
        .from('impresoras')
        .update({ estado: 'En Uso' })
        .eq('id', impresoraId)

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getUsoActivoPorOrden(ordenId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      // Si hubo más de un "En Proceso" por la misma OP (dato inconsistente), tomar el más reciente
      const { data, error } = await supabase
        .from('impresora_uso')
        .select('id, id_impresora')
        .eq('id_orden', ordenId)
        .eq('estado', 'En Proceso')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data || null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async finalizarUsoImpresora(usoId: number, impresoraId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      // Finalizar el uso actual
      const { data, error } = await supabase
        .from('impresora_uso')
        .update({
          fecha_fin: new Date().toISOString(),
          estado: 'Completado'
        })
        .eq('id', usoId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      
      // Verificar si hay otros usos activos para esta impresora (trabajos en cola)
      const { data: otrosUsos, error: otrosUsosError } = await supabase
        .from('impresora_uso')
        .select('id')
        .eq('id_impresora', impresoraId)
        .eq('estado', 'En Proceso')
        .order('fecha_inicio', { ascending: true })
        .limit(1)

      if (otrosUsosError) {
        console.error('Error al verificar otros usos:', otrosUsosError)
      }

      const { data: impRow } = await supabase.from('impresoras').select('estado').eq('id', impresoraId).maybeSingle()
      const estadoActual = (impRow as { estado?: string } | null)?.estado

      // No pisar estados operativos puestos a mano (mantenimiento / fuera de servicio)
      if (estadoActual === 'Mantenimiento' || estadoActual === 'Fuera de Servicio') {
        return { success: true, data }
      }

      // Si hay otros trabajos en cola, mantener "En Uso"; si no, volver a Disponible
      if (otrosUsos && otrosUsos.length > 0) {
        await supabase.from('impresoras').update({ estado: 'En Uso' }).eq('id', impresoraId)
      } else {
        await supabase.from('impresoras').update({ estado: 'Disponible' }).eq('id', impresoraId)
      }

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Alinea `impresoras.estado` con usos reales en cola (misma regla que `v_impresora_trabajos_activos`).
   * Cierra usos huérfanos: `En Proceso` pero la OP ya está en estado final (desincronización histórica).
   */
  async reconciliarEstadoImpresoraDesdeCola(impresoraId: number): Promise<ApiResponse<{ corregido: boolean }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    const estadosFinalesOrden = new Set([
      'Finalizado en Taller',
      'Almacén de Entrega',
      'Entregado o Instalado'
    ])

    const { data: usos, error: usosErr } = await supabase
      .from('impresora_uso')
      .select('id, ordenes_trabajo:id_orden(estado)')
      .eq('id_impresora', impresoraId)
      .eq('estado', 'En Proceso')

    if (usosErr) return { success: false, error: usosErr.message }

    const rows = (usos || []) as Array<{
      id: number
      ordenes_trabajo: { estado: string } | { estado: string }[] | null
    }>

    for (const row of rows) {
      const ot = row.ordenes_trabajo
      const estadoOrden =
        ot == null ? null : Array.isArray(ot) ? (ot[0] as { estado?: string } | undefined)?.estado : (ot as { estado?: string }).estado

      const huérfano =
        estadoOrden == null || estadosFinalesOrden.has(estadoOrden)

      if (huérfano) {
        const { error: upErr } = await supabase
          .from('impresora_uso')
          .update({
            fecha_fin: new Date().toISOString(),
            estado: 'Completado'
          })
          .eq('id', row.id)
        if (upErr) return { success: false, error: upErr.message }
      }
    }

    const { count: activos, error: cntErr } = await supabase
      .from('impresora_uso')
      .select('*', { count: 'exact', head: true })
      .eq('id_impresora', impresoraId)
      .eq('estado', 'En Proceso')

    if (cntErr) return { success: false, error: cntErr.message }

    const { data: impRow, error: impErr } = await supabase
      .from('impresoras')
      .select('estado')
      .eq('id', impresoraId)
      .maybeSingle()

    if (impErr) return { success: false, error: impErr.message }
    const estadoActual = (impRow as { estado?: string } | null)?.estado
    if (estadoActual === 'Mantenimiento' || estadoActual === 'Fuera de Servicio') {
      return { success: true, data: { corregido: false } }
    }

    const deseado = (activos ?? 0) > 0 ? 'En Uso' : 'Disponible'
    if (estadoActual === deseado) {
      return { success: true, data: { corregido: false } }
    }

    const { error: updImpErr } = await supabase.from('impresoras').update({ estado: deseado }).eq('id', impresoraId)
    if (updImpErr) return { success: false, error: updImpErr.message }
    return { success: true, data: { corregido: true } }
  }

  async cambiarEstadoImpresora(
    impresoraId: number,
    nuevoEstado: 'Disponible' | 'En Uso' | 'Mantenimiento' | 'Fuera de Servicio',
    motivo?: string,
    usuarioId?: number,
    usuarioNombre?: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      // Obtener estado actual
      const { data: impresoraActual } = await supabase
        .from('impresoras')
        .select('estado')
        .eq('id', impresoraId)
        .single()

      if (!impresoraActual) {
        return { success: false, error: 'Impresora no encontrada' }
      }

      // Actualizar estado
      const { data, error } = await supabase
        .from('impresoras')
        .update({ estado: nuevoEstado })
        .eq('id', impresoraId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }

      // Registrar en historial
      if (motivo || usuarioId || usuarioNombre) {
        await supabase
          .from('impresora_historial_estado')
          .insert({
            id_impresora: impresoraId,
            estado_anterior: impresoraActual.estado,
            estado_nuevo: nuevoEstado,
            motivo: motivo || null,
            usuario_id: usuarioId || null,
            usuario_nombre: usuarioNombre || null
          })
      }

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getHistorialImpresora(impresoraId: number, limit: number = 50): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_historial_estado')
        .select('*')
        .eq('id_impresora', impresoraId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getTrabajosActivosImpresora(impresoraId: number): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('v_impresora_trabajos_activos')
        .select('*')
        .eq('id_impresora', impresoraId)
        .order('fecha_inicio', { ascending: true }) // Ordenar por fecha ascendente (el primero es el que está imprimiendo)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async asignarOrdenAImpresora(
    impresoraId: number,
    ordenId: number,
    operario?: string,
    metrosCuadrados?: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      // Verificar que la impresora esté disponible o en uso
      const { data: impresora } = await supabase
        .from('impresoras')
        .select('estado')
        .eq('id', impresoraId)
        .single()

      if (!impresora) {
        return { success: false, error: 'Impresora no encontrada' }
      }

      if (impresora.estado === 'Mantenimiento' || impresora.estado === 'Fuera de Servicio') {
        return { success: false, error: 'La impresora no está disponible para asignar trabajos' }
      }

      // Crear registro de uso
      const { data, error } = await supabase
        .from('impresora_uso')
        .insert({
          id_impresora: impresoraId,
          id_orden: ordenId,
          estado: 'En Proceso',
          operario: operario || null,
          metros_cuadrados: metrosCuadrados || null
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }

      // Actualizar estado de la impresora a "En Uso" automáticamente
      await supabase
        .from('impresoras')
        .update({ estado: 'En Uso' })
        .eq('id', impresoraId)

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarMetrosOrden(
    ordenId: number,
    metrosCuadrados: number,
    options?: { motivo?: string }
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { data: current, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('metros_cuadrados, estado')
          .eq('id', ordenId)
          .maybeSingle()

        if (fetchError) return { success: false, error: fetchError.message }

        const metrosAnterior =
          current && (current as any).metros_cuadrados !== undefined
            ? (current as any).metros_cuadrados
            : null

        const { error } = await supabase
          .from('ordenes_trabajo')
          .update({ metros_cuadrados: metrosCuadrados })
          .eq('id', ordenId)
        if (error) return { success: false, error: error.message }

        // Registrar auditoría del cambio de metros (Taller Gráfico o carga inicial)
        await this.registrarCambioHistorial(
          ordenId,
          (current as any)?.estado ?? null,
          (current as any)?.estado ?? null,
          options?.motivo || 'Actualización de metros cuadrados (m²).',
          'cambio_metros',
          {
            metros_cuadrados: {
              anterior: metrosAnterior,
              nuevo: metrosCuadrados
            }
          }
        )

        return { success: true }
      } catch (e: any) {
        console.error('Error actualizando metros de la orden:', e)
        return { success: false, error: e?.message || 'Error actualizando metros de la orden' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarMetrosImpresora(
    usoId: number,
    metrosCuadrados: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .update({ metros_cuadrados: metrosCuadrados })
        .eq('id', usoId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Reemplaza todas las líneas m² de una OP. Debe llamarse tras guardar la orden (payload principal).
   */
  async replaceOrdenLineasM2(
    ordenId: number,
    lineas: Array<{ tipo: string; metrosCuadrados: number }>
  ): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { error: delErr } = await supabase.from('orden_lineas_m2').delete().eq('id_orden', ordenId)
      if (delErr) return { success: false, error: delErr.message }
      const clean = lineas
        .map((row, i) => ({
          id_orden: ordenId,
          tipo: (row.tipo || '').trim().slice(0, 200),
          metros_cuadrados: Math.max(0, Number(row.metrosCuadrados) || 0),
          sort_order: i
        }))
        .filter((r) => r.metros_cuadrados > 0)
      if (clean.length > 0) {
        const { error: insErr } = await supabase.from('orden_lineas_m2').insert(clean)
        if (insErr) return { success: false, error: insErr.message }
      }
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error guardando líneas m²'
      return { success: false, error: msg }
    }
  }

  /**
   * Sugerencias de "Tipo / pieza" para líneas m², buscadas en BD.
   * Se usa para autocompletar cuando el usuario escribe (>= 3 letras).
   */
  async buscarTiposLineaM2(query: string, limit = 12): Promise<ApiResponse<string[]>> {
    const q = (query || '').trim()
    if (q.length < 3) return { success: true, data: [] }
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase
        .from('orden_lineas_m2')
        .select('tipo')
        .ilike('tipo', `%${q}%`)
        .limit(200)

      if (error) return { success: false, error: error.message }

      const seen = new Set<string>()
      const out: string[] = []
      for (const row of (data || []) as Array<{ tipo: string | null }>) {
        const t = (row.tipo || '').trim()
        if (!t) continue
        const key = t.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(t)
        if (out.length >= limit) break
      }
      return { success: true, data: out }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error buscando tipos de línea m²' }
    }
  }

  /**
   * Registros de `impresora_uso` cuyo inicio cae en [desdeISO, hastaISO) — para reportes diarios/mensuales.
   */
  async getImpresoraUsoEnRango(
    desdeISO: string,
    hastaISO: string,
    impresoraId?: number | null
  ): Promise<ApiResponse<ImpresoraUsoReportFila[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      let query = supabase
        .from('impresora_uso')
        .select(
          `
          id,
          id_impresora,
          id_orden,
          fecha_inicio,
          fecha_fin,
          horas_usadas,
          metros_cuadrados,
          estado,
          operario,
          impresoras ( nombre ),
          ordenes_trabajo ( numero_op, cliente, descripcion, tipo_impresion )
        `
        )
        .gte('fecha_inicio', desdeISO)
        .lt('fecha_inicio', hastaISO)
        .order('fecha_inicio', { ascending: true })

      if (impresoraId != null && Number.isFinite(impresoraId)) {
        query = query.eq('id_impresora', impresoraId)
      }

      const { data, error } = await query
      if (error) return { success: false, error: error.message }

      const pickNombre = (imp: unknown): string | null => {
        if (imp && typeof imp === 'object' && 'nombre' in imp) {
          const n = (imp as { nombre?: string }).nombre
          return typeof n === 'string' ? n : null
        }
        return null
      }

      const pickOrden = (ot: unknown): { numero_op?: string; cliente?: string; descripcion?: string; tipo_impresion?: string | null } | null => {
        if (ot && typeof ot === 'object') return ot as any
        return null
      }

      const filas: ImpresoraUsoReportFila[] = (data || []).map((row: any) => {
        const ot = pickOrden(row.ordenes_trabajo)
        return {
          id: row.id,
          id_impresora: row.id_impresora,
          nombre_impresora:
            pickNombre(row.impresoras) ?? `Impresora #${row.id_impresora}`,
          id_orden: row.id_orden,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin ?? null,
          horas_usadas: row.horas_usadas != null ? Number(row.horas_usadas) : null,
          metros_cuadrados: row.metros_cuadrados != null ? Number(row.metros_cuadrados) : null,
          estado: row.estado,
          operario: row.operario ?? null,
          numero_op: ot?.numero_op ?? null,
          cliente: ot?.cliente ?? null,
          descripcion: ot?.descripcion ?? null,
          tipo_impresion_orden: ot?.tipo_impresion ?? null
        }
      })

      return { success: true, data: filas }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar uso de impresoras'
      return { success: false, error: msg }
    }
  }

  async crearImpresora(
    nombre: string,
    modelo?: string,
    capacidadMaximaHoras?: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresoras')
        .insert({
          nombre,
          modelo: modelo || null,
          estado: 'Disponible',
          capacidad_maxima_horas_dia: capacidadMaximaHoras || 24.0,
          activa: true
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarImpresora(
    impresoraId: number,
    updates: {
      nombre?: string
      modelo?: string
      capacidad_maxima_horas_dia?: number
      activa?: boolean
    }
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresoras')
        .update(updates)
        .eq('id', impresoraId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async eliminarImpresora(impresoraId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      // Verificar que no tenga trabajos activos
      const { data: trabajosActivos } = await supabase
        .from('impresora_uso')
        .select('id')
        .eq('id_impresora', impresoraId)
        .eq('estado', 'En Proceso')
        .limit(1)

      if (trabajosActivos && trabajosActivos.length > 0) {
        return { success: false, error: 'No se puede eliminar una impresora con trabajos activos' }
      }

      // Marcar como inactiva en lugar de eliminar (soft delete)
      const { data, error } = await supabase
        .from('impresoras')
        .update({ activa: false })
        .eq('id', impresoraId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // ============================================
  // NOTIFICACIONES
  // ============================================

  async getUserNotifications(userId: number, limit: number = 50): Promise<ApiResponse<Notification[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as Notification[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Solo comunicados del notificador masivo RRHH (/rrhh/notificaciones).
   * Requiere columna user_notifications.origen y función enviar_notificacion_masiva actualizadas (patch 2026-03-25).
   */
  async getUserNotificationsRrhhMasivos(
    userId: number,
    limit: number = 50
  ): Promise<ApiResponse<Notification[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('origen', 'rrhh_masivo')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as Notification[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async createNotification(notification: {
    user_id: number
    title: string
    description?: string
    type?: 'info' | 'success' | 'warning' | 'error' | 'mention'
    /** rrhh_masivo: mismo criterio que enviar_notificacion_masiva (columna origen) */
    origen?: 'sistema' | 'rrhh_masivo'
    orden_id?: number
    pedido_id?: number
    solicitud_id?: number
    capacitacion_id?: number
    oportunidad_id?: number
    venta_id?: number
    solicitud_chat_id?: number
    reclamo_id?: number
  }): Promise<ApiResponse<Notification>> {
    if (supabase) {
      const origen = notification.origen ?? 'sistema'
      const { data, error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: notification.user_id,
          title: notification.title,
          description: notification.description || null,
          type: notification.type || 'info',
          origen,
          orden_id: notification.orden_id || null,
          pedido_id: notification.pedido_id || null,
          solicitud_id: notification.solicitud_id || null,
          capacitacion_id: notification.capacitacion_id || null,
          oportunidad_id: notification.oportunidad_id || null,
          venta_id: notification.venta_id || null,
          solicitud_chat_id: notification.solicitud_chat_id || null,
          reclamo_id: notification.reclamo_id || null,
          is_read: false
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as Notification }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Enviar notificación masiva a usuarios
   */
  async enviarNotificacionMasiva(params: {
    titulo: string
    descripcion: string
    tipo?: 'info' | 'success' | 'warning' | 'error' | 'mention'
    rol_filtro?: string
    sector_filtro?: string
    enviar_a_todos?: boolean
    id_usuario_emisor?: number
  }): Promise<ApiResponse<{ notificaciones_creadas: number; usuarios_notificados: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('enviar_notificacion_masiva', {
          p_titulo: params.titulo,
          p_descripcion: params.descripcion,
          p_tipo: params.tipo || 'info',
          p_rol_filtro: params.rol_filtro || null,
          p_sector_filtro: params.sector_filtro || null,
          p_enviar_a_todos: params.enviar_a_todos || false,
          p_id_usuario_emisor: params.id_usuario_emisor || null
        })

        if (error) {
          console.error('Error enviando notificación masiva:', error)
          return { success: false, error: error.message }
        }

        if (data && typeof data === 'object' && 'success' in data) {
          const result = data as any
          if (result.success) {
            return {
              success: true,
              data: {
                notificaciones_creadas: result.notificaciones_creadas || 0,
                usuarios_notificados: result.usuarios_notificados || 0,
                mensaje: result.mensaje || 'Notificaciones enviadas'
              }
            }
          } else {
            return { success: false, error: result.error || 'Error desconocido' }
          }
        }

        return { success: false, error: 'Respuesta inválida del servidor' }
      } catch (error: any) {
        console.error('Error en enviarNotificacionMasiva:', error)
        return { success: false, error: error.message || 'Error al enviar notificaciones' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async obtenerEstadisticasNotificaciones(): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_estadisticas_notificaciones')

        if (error) {
          console.error('Error obteniendo estadísticas:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data || {} }
      } catch (error: any) {
        console.error('Error en obtenerEstadisticasNotificaciones:', error)
        return { success: false, error: error.message || 'Error al obtener estadísticas' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // Helper para obtener usuarios de compras y administración
  private async getUsuariosComprasAdmin(): Promise<number[]> {
    if (!supabase) {
      console.warn('⚠️ Supabase no configurado en getUsuariosComprasAdmin')
      return []
    }
    
    try {
      console.log('🔍 Buscando usuarios con rol compras o administracion...')
      
      // Primero intentar con compras y administracion
      const { data, error } = await supabase.rpc('usuarios_ids_por_roles', {
        p_roles: ['compras', 'administracion']
      })
      
      if (error) {
        console.error('❌ Error obteniendo usuarios de compras/admin:', error)
        // Si hay error, intentar obtener todos los usuarios como fallback
        return await this.getAllUsuariosIds()
      }
      
      if (data && data.length > 0) {
        console.log(`✅ Encontrados ${data.length} usuarios de compras/admin`)
        return (data as { id: number }[]).map((u) => u.id)
      }
      
      // Si no hay usuarios de compras/admin, intentar con gerencia
      console.warn('⚠️ No se encontraron usuarios con rol compras o administracion, buscando gerencia...')
      const { data: dataGerencia, error: errorGerencia } = await supabase.rpc('usuarios_ids_por_roles', {
        p_roles: ['gerencia']
      })
      
      if (!errorGerencia && dataGerencia && dataGerencia.length > 0) {
        console.log(`✅ Encontrados ${dataGerencia.length} usuarios de gerencia`)
        return (dataGerencia as { id: number }[]).map((u) => u.id)
      }
      
      // Si tampoco hay gerencia, obtener TODOS los usuarios como último recurso
      console.warn('⚠️ No se encontraron usuarios específicos, notificando a todos los usuarios...')
      return await this.getAllUsuariosIds()
    } catch (error) {
      console.error('❌ Excepción obteniendo usuarios de compras/admin:', error)
      // En caso de error, intentar obtener todos los usuarios
      return await this.getAllUsuariosIds()
    }
  }

  // Helper para obtener todos los IDs de usuarios (fallback)
  private async getAllUsuariosIds(): Promise<number[]> {
    if (!supabase) return []
    
    try {
      const { data, error } = await supabase.from('usuarios_publico').select('id')
      
      if (error || !data || data.length === 0) {
        console.warn('⚠️ No se encontraron usuarios en la base de datos')
        return []
      }
      
      console.log(`✅ Encontrados ${data.length} usuarios totales para notificar`)
      return data.map((u) => u.id)
    } catch (error) {
      console.error('❌ Error obteniendo todos los usuarios:', error)
      return []
    }
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /** Comunicados agrupados del notificador masivo (solo RRHH/admin vía RPC). Requiere patch listar_comunicados_rrhh_masivos. */
  async listarComunicadosRrhhMasivos(
    usuarioId: number
  ): Promise<
    ApiResponse<
      Array<{ titulo: string; descripcion: string; tipo: string; ultima: string; copias: number }>
    >
  > {
    if (supabase) {
      const { data, error } = await supabase.rpc('listar_comunicados_rrhh_masivos', {
        p_usuario_id: usuarioId
      })
      if (error) return { success: false, error: error.message }
      const rows = (data || []) as Array<{
        titulo: string
        descripcion: string
        tipo: string
        ultima: string
        copias: number
      }>
      return { success: true, data: rows }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  /** Quita todas las copias de un comunicado masivo (mismo título y descripción). */
  async eliminarComunicadoRrhhMasivo(
    usuarioId: number,
    titulo: string,
    descripcion: string
  ): Promise<ApiResponse<{ eliminadas: number }>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('eliminar_comunicado_rrhh_masivo', {
        p_usuario_id: usuarioId,
        p_titulo: titulo,
        p_descripcion: descripcion
      })
      if (error) return { success: false, error: error.message }
      const j = data as { eliminadas?: number } | null
      return { success: true, data: { eliminadas: j?.eliminadas ?? 0 } }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async markAllNotificationsAsRead(userId: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // Método privado para asegurar que un chat_room existe
  // ===== PEDIDOS DE COMPRA =====
  async crearPedidoCompra(pedido: {
    id_solicitante: number
    nombre_solicitante: string
    sector_solicitante?: string
    id_proveedor?: number // ID del proveedor externo
    prioridad?: PrioridadPedido
    motivo?: string
    observaciones?: string
    fecha_entrega_estimada?: string
    items: Array<{
      id_articulo_stock?: number
      codigo_articulo?: string
      descripcion: string
      cantidad_solicitada: number
      unidad?: string
      observaciones?: string
    }>
  }): Promise<ApiResponse<PedidoCompra>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      console.log('📦 Creando pedido de compra:', {
        solicitante: pedido.nombre_solicitante,
        items: pedido.items.length
      })

      // Verificar si el usuario existe en la BD antes de crear el pedido
      let idSolicitanteFinal: number | null = null
      if (pedido.id_solicitante && pedido.id_solicitante > 0) {
        const { data: usuarioExiste, error: errorUsuario } = await supabase
          .from('usuarios_publico')
          .select('id')
          .eq('id', pedido.id_solicitante)
          .single()
        
        if (usuarioExiste && !errorUsuario) {
          idSolicitanteFinal = pedido.id_solicitante
          console.log(`✅ Usuario ${pedido.id_solicitante} encontrado en BD`)
        } else {
          console.warn(`⚠️ Usuario con ID ${pedido.id_solicitante} no existe en BD, creando pedido sin ID. Error: ${errorUsuario?.message || 'No encontrado'}`)
          idSolicitanteFinal = null
        }
      } else {
        console.log('ℹ️ No se proporcionó ID de solicitante válido, creando pedido sin ID')
      }

      // Crear el pedido
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos_compras')
        .insert({
          id_solicitante: idSolicitanteFinal,
          nombre_solicitante: pedido.nombre_solicitante,
          sector_solicitante: pedido.sector_solicitante || null,
          id_proveedor: pedido.id_proveedor || null,
          prioridad: pedido.prioridad || 'Normal',
          motivo: pedido.motivo || null,
          observaciones: pedido.observaciones || null,
          fecha_entrega_estimada: pedido.fecha_entrega_estimada || null,
          estado: 'Pendiente'
        })
        .select()
        .single()

      if (pedidoError) {
        console.error('❌ Error creando pedido:', pedidoError)
        return { 
          success: false, 
          error: `Error al crear pedido: ${pedidoError.message}. Código: ${pedidoError.code || 'N/A'}. Detalles: ${pedidoError.details || 'N/A'}` 
        }
      }

      if (!pedidoData || !pedidoData.id) {
        return { success: false, error: 'El pedido se creó pero no se retornó el ID' }
      }

      // Crear los items del pedido
      if (pedido.items && pedido.items.length > 0) {
        const itemsData = pedido.items.map(item => ({
          id_pedido: pedidoData.id,
          id_articulo_stock: item.id_articulo_stock || null,
          codigo_articulo: item.codigo_articulo || null,
          descripcion: item.descripcion,
          cantidad_solicitada: item.cantidad_solicitada,
          unidad: item.unidad || 'unidad',
          observaciones: item.observaciones || null
        }))

        console.log('📦 Insertando items del pedido:', itemsData.length)

        const { error: itemsError } = await supabase
          .from('pedidos_compras_items')
          .insert(itemsData)

        if (itemsError) {
          console.error('❌ Error insertando items:', itemsError)
          // Si falla la inserción de items, eliminar el pedido
          await supabase.from('pedidos_compras').delete().eq('id', pedidoData.id)
          return { 
            success: false, 
            error: `Error al crear items del pedido: ${itemsError.message}. Código: ${itemsError.code || 'N/A'}. Detalles: ${itemsError.details || 'N/A'}` 
          }
        }

        console.log('✅ Items del pedido creados exitosamente')
      }

      // Notificar a usuarios de compras y administración
      // Intentar obtener usuarios de la BD primero
      let usuariosComprasAdmin = await this.getUsuariosComprasAdmin()
      const numeroPedido = pedidoData.numero_pedido || `#${pedidoData.id}`
      
      console.log('🔔 Usuarios de compras/admin encontrados en BD:', usuariosComprasAdmin.length, usuariosComprasAdmin)
      
      // Si no hay usuarios en BD pero hay id_solicitante, intentar notificar al solicitante
      // (esto es un fallback para cuando los usuarios están en otra parte)
      if (usuariosComprasAdmin.length === 0 && idSolicitanteFinal) {
        console.log('⚠️ No hay usuarios en BD, pero hay id_solicitante. Intentando notificar al solicitante como fallback.')
        // No notificamos al solicitante cuando crea su propio pedido, eso no tiene sentido
        // En su lugar, simplemente logueamos que no hay usuarios para notificar
        console.warn('⚠️ No se encontraron usuarios de compras/admin para notificar. Las notificaciones se crearán cuando haya usuarios en la tabla usuarios.')
      }
      
      // Crear notificaciones solo si hay usuarios
      for (const userId of usuariosComprasAdmin) {
        try {
          const notificationResult = await this.createNotification({
            user_id: userId,
            title: '📦 Nuevo pedido de compra',
            description: `${pedido.nombre_solicitante} solicitó productos${pedido.sector_solicitante ? ` (${pedido.sector_solicitante})` : ''}. Pedido ${numeroPedido}`,
            type: 'info',
            pedido_id: pedidoData.id
          })
          
          if (notificationResult.success) {
            console.log(`✅ Notificación creada para usuario ${userId}`)
          } else {
            console.error(`❌ Error creando notificación para usuario ${userId}:`, notificationResult.error)
          }
        } catch (error) {
          console.error(`❌ Excepción al crear notificación para usuario ${userId}:`, error)
        }
      }

      // Obtener el pedido completo con items
      const pedidoCompleto = await this.getPedidoCompra(pedidoData.id)
      if (pedidoCompleto.success) {
        console.log('✅ Pedido de compra creado exitosamente:', pedidoData.id)
      }
      return pedidoCompleto
    } catch (error) {
      console.error('❌ Excepción al crear pedido:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al crear pedido' 
      }
    }
  }

  async getPedidosCompra(filters?: {
    estado?: EstadoPedido
    id_solicitante?: number
    id_aprobador?: number
    prioridad?: PrioridadPedido
  }): Promise<ApiResponse<PedidoCompra[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('pedidos_compras')
          .select(`
            *,
            items:pedidos_compras_items(*),
            comentarios:pedidos_compras_comentarios(*)
          `)
          .order('fecha_solicitud', { ascending: false })

        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.id_solicitante) {
          query = query.eq('id_solicitante', filters.id_solicitante)
        }
        if (filters?.id_aprobador) {
          query = query.eq('id_aprobador', filters.id_aprobador)
        }
        if (filters?.prioridad) {
          query = query.eq('prioridad', filters.prioridad)
        }

        // PostgREST/Supabase suele devolver como máximo 1000 filas por defecto; pedidos de compra deben listarse completos.
        query = query.limit(10000)

        const { data, error } = await query

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true, data: (data as PedidoCompra[]) || [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPedidoCompra(id: number): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos_compras')
          .select(`
            *,
            items:pedidos_compras_items(*),
            comentarios:pedidos_compras_comentarios(*),
            proveedor:proveedores(*)
          `)
          .eq('id', id)
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true, data: data as PedidoCompra }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async aprobarPedidoCompra(
    id: number,
    aprobador: { id: number; nombre: string },
    itemsAprobados?: Array<{ id: number; cantidad_aprobada: number }>
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        // Actualizar el pedido
        const { error: updateError } = await supabase
          .from('pedidos_compras')
          .update({
            estado: 'Aprobado',
            fecha_aprobacion: new Date().toISOString(),
            id_aprobador: aprobador.id,
            nombre_aprobador: aprobador.nombre
          })
          .eq('id', id)

        if (updateError) {
          return { success: false, error: updateError.message }
        }

        // Actualizar cantidades aprobadas en items si se proporcionan
        if (itemsAprobados && itemsAprobados.length > 0) {
          for (const item of itemsAprobados) {
            await supabase
              .from('pedidos_compras_items')
              .update({ cantidad_aprobada: item.cantidad_aprobada })
              .eq('id', item.id)
          }
        }

        // Obtener el pedido para notificar al solicitante
        const pedido = await this.getPedidoCompra(id)
        if (pedido.success && pedido.data && pedido.data.id_solicitante) {
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: '✅ Pedido aprobado',
            description: `Tu pedido ${pedido.data.numero_pedido} fue aprobado por ${aprobador.nombre}`,
            type: 'success',
            pedido_id: id
          })
        }

        return pedido
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async rechazarPedidoCompra(
    id: number,
    aprobador: { id: number; nombre: string },
    motivo_rechazo: string
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('pedidos_compras')
          .update({
            estado: 'Rechazado',
            fecha_rechazo: new Date().toISOString(),
            id_aprobador: aprobador.id,
            nombre_aprobador: aprobador.nombre,
            motivo_rechazo
          })
          .eq('id', id)

        if (error) {
          return { success: false, error: error.message }
        }

        // Obtener el pedido para notificar al solicitante
        const pedido = await this.getPedidoCompra(id)
        if (pedido.success && pedido.data && pedido.data.id_solicitante) {
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: '❌ Pedido rechazado',
            description: `Tu pedido ${pedido.data.numero_pedido} fue rechazado por ${aprobador.nombre}. Motivo: ${motivo_rechazo}`,
            type: 'error',
            pedido_id: id
          })
        }

        return pedido
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async agregarComentarioPedido(
    id_pedido: number,
    comentario: {
      id_usuario: number
      nombre_usuario: string
      comentario: string
      es_interno?: boolean
    }
  ): Promise<ApiResponse<PedidoCompraComentario>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos_compras_comentarios')
          .insert({
            id_pedido,
            id_usuario: comentario.id_usuario,
            nombre_usuario: comentario.nombre_usuario,
            comentario: comentario.comentario,
            es_interno: comentario.es_interno || false
          })
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Notificar al solicitante si el comentario no es interno
        if (!comentario.es_interno) {
          const { data: pedidoData } = await supabase
            .from('pedidos_compras')
            .select('id_solicitante, numero_pedido')
            .eq('id', id_pedido)
            .single()
          
          if (pedidoData && pedidoData.id_solicitante && pedidoData.id_solicitante !== comentario.id_usuario) {
            await this.createNotification({
              user_id: pedidoData.id_solicitante,
              title: '💬 Nuevo comentario en tu pedido',
              description: `${comentario.nombre_usuario} comentó en el pedido ${pedidoData.numero_pedido}`,
              type: 'info',
              pedido_id: id_pedido
            })
          }
        }

        return { success: true, data: data as PedidoCompraComentario }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarPedidoCompra(
    id: number,
    updates: Partial<PedidoCompra>
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('pedidos_compras')
          .update(updates)
          .eq('id', id)

        if (error) {
          return { success: false, error: error.message }
        }

        return await this.getPedidoCompra(id)
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar pedido de compra + reemplazar items (uso: "Mis pedidos", antes de que Compras lo procese).
   * Estrategia: actualizar cabecera, borrar items, insertar nuevos; si falla inserción, reintenta restaurar items anteriores.
   */
  async actualizarPedidoCompraConItems(
    id: number,
    updates: Partial<PedidoCompra>,
    items: Array<{
      id_articulo_stock?: number | null
      codigo_articulo?: string | null
      descripcion: string
      cantidad_solicitada: number
      unidad: string
      observaciones?: string | null
    }>
  ): Promise<ApiResponse<PedidoCompra>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      // snapshot items actuales para poder restaurar si algo falla
      const { data: prevItems, error: prevErr } = await supabase
        .from('pedidos_compras_items')
        .select('*')
        .eq('id_pedido', id)

      if (prevErr) return { success: false, error: prevErr.message }

      const updateRes = await this.actualizarPedidoCompra(id, updates)
      if (!updateRes.success) return updateRes

      const { error: delErr } = await supabase
        .from('pedidos_compras_items')
        .delete()
        .eq('id_pedido', id)
      if (delErr) return { success: false, error: delErr.message }

      const nextItems = (items || [])
        .filter((it) => String(it.descripcion || '').trim() !== '')
        .map((it) => ({
          id_pedido: id,
          id_articulo_stock: it.id_articulo_stock ?? null,
          codigo_articulo: it.codigo_articulo ?? null,
          descripcion: it.descripcion,
          cantidad_solicitada: it.cantidad_solicitada,
          unidad: it.unidad || 'unidad',
          observaciones: it.observaciones ?? null
        }))

      if (nextItems.length > 0) {
        const { error: insErr } = await supabase.from('pedidos_compras_items').insert(nextItems)
        if (insErr) {
          // best-effort: restaurar items previos
          try {
            if (Array.isArray(prevItems) && prevItems.length > 0) {
              await supabase.from('pedidos_compras_items').insert(
                prevItems.map((r: any) => ({
                  id_pedido: id,
                  id_articulo_stock: r.id_articulo_stock ?? null,
                  codigo_articulo: r.codigo_articulo ?? null,
                  descripcion: r.descripcion,
                  cantidad_solicitada: r.cantidad_solicitada,
                  unidad: r.unidad || 'unidad',
                  observaciones: r.observaciones ?? null
                }))
              )
            }
          } catch {
            // ignore restore failures
          }
          return { success: false, error: insErr.message }
        }
      }

      return await this.getPedidoCompra(id)
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async actualizarEstadoPedido(
    id: number,
    estado: EstadoPedido
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        // Obtener el pedido antes de actualizar para saber el estado anterior
        const pedidoAnterior = await this.getPedidoCompra(id)
        const estadoAnterior = pedidoAnterior.success && pedidoAnterior.data ? pedidoAnterior.data.estado : 'Desconocido'
        
        const updateData: any = { estado }
        
        if (estado === 'Completado') {
          updateData.fecha_completado = new Date().toISOString()
        }

        const { error } = await supabase
          .from('pedidos_compras')
          .update(updateData)
          .eq('id', id)

        if (error) {
          return { success: false, error: error.message }
        }

        // Obtener el pedido actualizado para notificar al solicitante
        const pedido = await this.getPedidoCompra(id)
        if (pedido.success && pedido.data && pedido.data.id_solicitante && estadoAnterior !== estado) {
          let notificationTitle = '🔄 Estado del pedido actualizado'
          let notificationType: 'info' | 'success' = 'info'
          
          if (estado === 'En Compra') {
            notificationTitle = '🛒 Pedido en compra'
            notificationType = 'info'
          } else if (estado === 'Completado') {
            notificationTitle = '🎉 Pedido completado'
            notificationType = 'success'
          }
          
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: notificationTitle,
            description: `El estado de tu pedido ${pedido.data.numero_pedido} cambió de "${estadoAnterior}" a "${estado}"`,
            type: notificationType,
            pedido_id: id
          })
        }

        return pedido
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== STOCK =====
  // Función privada para descontar stock al crear una orden
  private async descontarStockDeOrden(ordenId: number, numeroOp: string): Promise<void> {
    if (!supabase || !stockSupabase) return

    try {
      // Obtener materiales asociados a la orden desde orden_materiales
      const { data: ordenMateriales, error: materialesError } = await supabase
        .from('orden_materiales')
        .select('id_material, cantidad, materiales(id, codigo, descripcion)')
        .eq('id_orden', ordenId)

      if (materialesError || !ordenMateriales || ordenMateriales.length === 0) {
        // No hay materiales asociados, no hacer nada
        return
      }

      const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
      let nombreUsuario = 'Sistema'
      try {
        const usuarioData = localStorage.getItem('usuario')
        if (usuarioData) {
          const p = JSON.parse(usuarioData) as { nombre?: unknown }
          if (typeof p?.nombre === 'string' && p.nombre.trim()) nombreUsuario = p.nombre.trim()
        }
      } catch {
        /* ignore */
      }

      // Para cada material, buscar en stock y descontar
      for (const ordenMaterial of ordenMateriales) {
        const material = ordenMaterial.materiales as any
        if (!material) continue

        // Buscar artículo en stock por código o descripción
        let articuloStock: ArticuloStock | null = null

        if (material.codigo) {
          const { data: articulosPorCodigo } = await stockSupabase
            .from('articulos')
            .select('*')
            .eq('codigo', material.codigo)
            .maybeSingle()

          if (articulosPorCodigo) {
            articuloStock = articulosPorCodigo as ArticuloStock
          }
        }

        // Si no se encontró por código, buscar por descripción
        if (!articuloStock && material.descripcion) {
          const { data: articulosPorDesc } = await stockSupabase
            .from('articulos')
            .select('*')
            .ilike('descripcion', `%${material.descripcion}%`)
            .limit(1)
            .maybeSingle()

          if (articulosPorDesc) {
            articuloStock = articulosPorDesc as ArticuloStock
          }
        }

        if (articuloStock && articuloStock.stock !== null && articuloStock.stock > 0) {
          const cantidadAnterior = articuloStock.stock
          const cantidadADescontar = Number(ordenMaterial.cantidad) || 1
          const cantidadNueva = Math.max(0, cantidadAnterior - cantidadADescontar)

          // Actualizar stock en la base de stock
          await stockSupabase
            .from('articulos')
            .update({ stock: cantidadNueva })
            .eq('id', articuloStock.id)

          // Registrar movimiento de stock
          await supabase.from('stock_movimientos').insert({
            id_articulo_stock: articuloStock.id,
            codigo_articulo: articuloStock.codigo || null,
            descripcion: articuloStock.descripcion,
            tipo_movimiento: 'Salida',
            cantidad: cantidadADescontar,
            cantidad_anterior: cantidadAnterior,
            cantidad_nueva: cantidadNueva,
            motivo: `Orden de trabajo ${numeroOp}`,
            id_orden_trabajo: ordenId,
            id_usuario: usuarioId,
            nombre_usuario: nombreUsuario
          })

          // Verificar si el stock quedó bajo y crear alerta si es necesario
          if (cantidadNueva <= 10 && cantidadNueva > 0) {
            await this.crearAlertaStockBajo(articuloStock, cantidadNueva)
          } else if (cantidadNueva === 0) {
            await this.crearAlertaStockAgotado(articuloStock)
          }
        }
      }
    } catch (error) {
      console.error('Error descontando stock de orden:', error)
      // No lanzar error para no interrumpir la creación de la orden
    }
  }

  // Función privada para crear alerta de stock bajo
  private async crearAlertaStockBajo(articulo: ArticuloStock, stockActual: number): Promise<void> {
    if (!supabase) return

    try {
      // Verificar si ya existe una notificación reciente para este artículo
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: notificacionesExistentes } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('type', 'stock_bajo')
        .eq('related_id', articulo.id.toString())
        .gte('timestamp', hace24Horas)
        .limit(1)

      // Si ya hay una notificación reciente, no crear otra
      if (notificacionesExistentes && notificacionesExistentes.length > 0) {
        return
      }

      // Crear notificación para usuarios de compras y admin
      const { data: usuariosCompras } = await supabase.rpc('usuarios_ids_por_roles', {
        p_roles: ['compras', 'administracion', 'gerencia']
      })

      if (usuariosCompras) {
        for (const usuario of usuariosCompras) {
          await supabase.from('user_notifications').insert({
            user_id: usuario.id,
            type: 'stock_bajo',
            title: `Stock Bajo: ${articulo.descripcion}`,
            description: `El artículo "${articulo.descripcion}" tiene stock bajo (${stockActual} unidades).`,
            related_id: articulo.id.toString(),
            is_read: false
          })
        }
      }
    } catch (error) {
      console.error('Error creando alerta de stock bajo:', error)
    }
  }

  // Función privada para crear alerta de stock agotado
  private async crearAlertaStockAgotado(articulo: ArticuloStock): Promise<void> {
    if (!supabase) return

    try {
      // Verificar si ya existe una notificación reciente
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: notificacionesExistentes } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('type', 'stock_agotado')
        .eq('related_id', articulo.id.toString())
        .gte('timestamp', hace24Horas)
        .limit(1)

      if (notificacionesExistentes && notificacionesExistentes.length > 0) {
        return
      }

      // Crear notificación para usuarios de compras y admin
      const { data: usuariosCompras } = await supabase.rpc('usuarios_ids_por_roles', {
        p_roles: ['compras', 'administracion', 'gerencia']
      })

      if (usuariosCompras) {
        for (const usuario of usuariosCompras) {
          await supabase.from('user_notifications').insert({
            user_id: usuario.id,
            type: 'stock_agotado',
            title: `⚠️ Stock Agotado: ${articulo.descripcion}`,
            description: `El artículo "${articulo.descripcion}" se ha agotado. Se requiere reposición urgente.`,
            related_id: articulo.id.toString(),
            is_read: false
          })
        }
      }
    } catch (error) {
      console.error('Error creando alerta de stock agotado:', error)
    }
  }

  async crearArticuloStock(articulo: {
    codigo?: string
    descripcion: string
    stock?: number
    stock_minimo?: number
    unidad?: string
    precio?: number
    categoria?: string
    proveedor?: string
    sector?: string
  }): Promise<ApiResponse<ArticuloStock>> {
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de datos de stock. Verifica VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY' }
    }

    try {
      console.log('📦 Creando artículo en stock:', articulo.descripcion)

      const { data, error } = await stockSupabase
        .from('articulos')
        .insert({
          codigo: articulo.codigo || null,
          descripcion: articulo.descripcion,
          stock: articulo.stock !== null && articulo.stock !== undefined ? Number(articulo.stock) : 0,
          stock_minimo: articulo.stock_minimo !== null && articulo.stock_minimo !== undefined ? Number(articulo.stock_minimo) : 0,
          unidad: articulo.unidad || 'unidad',
          precio: articulo.precio !== null && articulo.precio !== undefined ? Number(articulo.precio) : null,
          categoria: articulo.categoria || null,
          proveedor: articulo.proveedor || null,
          sector: articulo.sector || 'Gral'
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error creando artículo:', error)
        return { 
          success: false, 
          error: `Error al crear artículo: ${error.message}. Código: ${error.code || 'N/A'}. Detalles: ${error.details || 'N/A'}. Hint: ${error.hint || 'N/A'}` 
        }
      }

      if (!data) {
        return { success: false, error: 'El artículo se creó pero no se retornó' }
      }

      console.log('✅ Artículo creado exitosamente:', data.id)
      return { success: true, data: data as ArticuloStock }
    } catch (error) {
      console.error('❌ Excepción al crear artículo:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al crear artículo' 
      }
    }
  }

  async actualizarArticuloStock(
    id: number,
    articulo: {
      codigo?: string
      descripcion?: string
      stock?: number
      stock_minimo?: number
      unidad?: string
      precio?: number
      categoria?: string
      proveedor?: string
      sector?: string
    }
  ): Promise<ApiResponse<ArticuloStock>> {
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de datos de stock. Verifica VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY' }
    }

    try {
      console.log('📦 Actualizando artículo en stock:', id)

      const updateData: any = {}
      if (articulo.codigo !== undefined) updateData.codigo = articulo.codigo || null
      if (articulo.descripcion !== undefined) updateData.descripcion = articulo.descripcion
      if (articulo.stock !== undefined) {
        // Asegurar que stock sea un número válido
        updateData.stock = articulo.stock !== null && articulo.stock !== undefined 
          ? Number(articulo.stock) 
          : null
      }
      if (articulo.stock_minimo !== undefined) {
        // Asegurar que stock_minimo sea un número válido
        updateData.stock_minimo = articulo.stock_minimo !== null && articulo.stock_minimo !== undefined 
          ? Number(articulo.stock_minimo) 
          : null
      }
      if (articulo.unidad !== undefined) updateData.unidad = articulo.unidad
      if (articulo.precio !== undefined) updateData.precio = articulo.precio !== null && articulo.precio !== undefined ? Number(articulo.precio) : null
      if (articulo.categoria !== undefined) updateData.categoria = articulo.categoria || null
      if (articulo.proveedor !== undefined) updateData.proveedor = articulo.proveedor || null
      if (articulo.sector !== undefined) updateData.sector = articulo.sector || 'Gral'

      const { data, error } = await stockSupabase
        .from('articulos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error actualizando artículo:', error)
        return { 
          success: false, 
          error: `Error al actualizar artículo: ${error.message}. Código: ${error.code || 'N/A'}. Detalles: ${error.details || 'N/A'}` 
        }
      }

      if (!data) {
        return { success: false, error: 'El artículo se actualizó pero no se retornó' }
      }

      console.log('✅ Artículo actualizado exitosamente:', id)
      return { success: true, data: data as ArticuloStock }
    } catch (error) {
      console.error('❌ Excepción al actualizar artículo:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al actualizar artículo' 
      }
    }
  }

  async getArticulosStock(search?: string, stockBajo?: boolean, sector?: string): Promise<ApiResponse<ArticuloStock[]>> {
    if (!stockSupabase) {
      console.warn('⚠️ No hay conexión a la base de datos de stock. Verifica VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY')
      return { success: false, error: 'No hay conexión a la base de datos de stock. Verifica las variables de entorno VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY' }
    }

    try {
      console.log('📦 Obteniendo artículos de stock:', { search, stockBajo, sector })

      let query = stockSupabase
        .from('articulos')
        .select('id, codigo, descripcion, stock, stock_minimo, unidad, precio, categoria, proveedor, activo, sector')
        .order('descripcion', { ascending: true })

      // Filtrar por sector
      if (sector && sector !== 'Todos') {
        if (sector === 'Gral') {
          query = query.or('sector.is.null,sector.eq.Gral')
        } else {
          query = query.eq('sector', sector)
        }
      }

      // Búsqueda mejorada - busca en descripción y código
      if (search && search.trim().length >= 2) {
        const searchTerm = search.trim()
        query = query.or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
      }

      if (stockBajo) {
        // Filtrar artículos con stock bajo (<= stock_minimo) o agotado (<= 0 o null)
        query = query.or('stock.is.null,stock.lte.0')
        // También filtrar por stock <= stock_minimo cuando ambos existen
        // Esto requiere una consulta más compleja, pero por ahora usamos el filtro básico
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error obteniendo artículos de stock:', error)
        return { 
          success: false, 
          error: `Error al obtener artículos: ${error.message}. Código: ${error.code || 'N/A'}. Detalles: ${error.details || 'N/A'}` 
        }
      }

      // Filtrar por stock bajo si es necesario (filtro adicional en memoria para casos complejos)
      let articulosFiltrados = data || []
      if (stockBajo) {
        articulosFiltrados = articulosFiltrados.filter((art: any) => {
          const stock = art.stock !== null && art.stock !== undefined ? Number(art.stock) : 0
          const stockMinimo = art.stock_minimo !== null && art.stock_minimo !== undefined ? Number(art.stock_minimo) : 10
          return stock === 0 || stock <= stockMinimo
        })
      }

      // Normalizar los datos para asegurar tipos correctos
      const articulosNormalizados = articulosFiltrados.map((art: any) => ({
        id: art.id,
        codigo: art.codigo || null,
        descripcion: art.descripcion,
        stock: art.stock !== null && art.stock !== undefined ? Number(art.stock) : null,
        stock_minimo: art.stock_minimo !== null && art.stock_minimo !== undefined ? Number(art.stock_minimo) : null,
        unidad: art.unidad || 'unidad',
        precio: art.precio !== null && art.precio !== undefined ? Number(art.precio) : null,
        categoria: art.categoria || null,
        proveedor: art.proveedor || null,
        activo: art.activo !== null && art.activo !== undefined ? Boolean(art.activo) : true,
        sector: art.sector || 'Gral'
      }))

      console.log(`✅ Artículos obtenidos: ${articulosNormalizados.length}`)
      return { success: true, data: articulosNormalizados as ArticuloStock[] }
    } catch (error) {
      console.error('❌ Excepción al obtener artículos:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al obtener artículos' 
      }
    }
  }

  async registrarMovimientoStock(movimiento: {
    id_articulo_stock: number
    codigo_articulo?: string
    descripcion: string
    tipo_movimiento: 'Entrada' | 'Salida' | 'Ajuste' | 'Pedido' | 'Venta' | 'Devolución'
    cantidad: number
    cantidad_anterior?: number
    cantidad_nueva?: number
    motivo?: string
    id_orden_trabajo?: number
    id_pedido_compra?: number
    id_usuario?: number
    nombre_usuario?: string
  }): Promise<ApiResponse<StockMovimiento>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('stock_movimientos')
          .insert(movimiento)
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Actualizar stock en la base de stock si es necesario
        if (stockSupabase && movimiento.cantidad_nueva !== undefined) {
          await stockSupabase
            .from('articulos')
            .update({ stock: movimiento.cantidad_nueva })
            .eq('id', movimiento.id_articulo_stock)
        }

        return { success: true, data: data as StockMovimiento }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getMovimientosStock(filters?: {
    id_articulo_stock?: number
    tipo_movimiento?: string
    id_orden_trabajo?: number
    id_pedido_compra?: number
    fecha_desde?: string
    fecha_hasta?: string
    limit?: number
  }): Promise<ApiResponse<StockMovimiento[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('stock_movimientos')
          .select('*')
          .order('created_at', { ascending: false })

        if (filters?.id_articulo_stock) {
          query = query.eq('id_articulo_stock', filters.id_articulo_stock)
        }
        if (filters?.tipo_movimiento) {
          query = query.eq('tipo_movimiento', filters.tipo_movimiento)
        }
        if (filters?.id_orden_trabajo) {
          query = query.eq('id_orden_trabajo', filters.id_orden_trabajo)
        }
        if (filters?.id_pedido_compra) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }
        if (filters?.fecha_desde) {
          query = query.gte('created_at', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('created_at', filters.fecha_hasta)
        }

        const lim = filters?.limit != null && filters.limit > 0 ? Math.min(filters.limit, 5000) : 200
        query = query.limit(lim)

        const { data, error } = await query

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true, data: (data as StockMovimiento[]) || [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Entrada/Salida: `cantidad` es delta (unidades a sumar o restar).
   * Ajuste: `cantidad` es la existencia nueva absoluta.
   * Actualiza `articulos.stock` en la base de stock y registra `stock_movimientos` en la principal.
   */
  async aplicarMovimientoStockManual(input: {
    id_articulo_stock: number
    tipo_movimiento: 'Entrada' | 'Salida' | 'Ajuste'
    cantidad: number
    motivo?: string | null
    id_pedido_compra?: number | null
  }): Promise<ApiResponse<StockMovimiento>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de stock (VITE_STOCK_SUPABASE_*)' }
    }
    const tipo = input.tipo_movimiento
    const raw = Number(input.cantidad)
    if (!Number.isFinite(raw) || raw < 0) {
      return { success: false, error: 'La cantidad no es válida.' }
    }
    if (tipo !== 'Ajuste' && raw <= 0) {
      return { success: false, error: 'Para entrada o salida indicá una cantidad mayor a cero.' }
    }

    let usuarioId: number | null = null
    let nombreUsuario = 'ERP'
    try {
      const usuarioData = localStorage.getItem('usuario')
      if (usuarioData) {
        const p = JSON.parse(usuarioData) as { id?: number; nombre?: string }
        if (typeof p?.id === 'number') usuarioId = p.id
        if (typeof p?.nombre === 'string' && p.nombre.trim()) nombreUsuario = p.nombre.trim()
      }
    } catch {
      /* ignore */
    }

    try {
      const { data: art, error: errArt } = await stockSupabase
        .from('articulos')
        .select('id, codigo, descripcion, stock')
        .eq('id', input.id_articulo_stock)
        .single()

      if (errArt || !art) {
        return { success: false, error: errArt?.message || 'Artículo no encontrado en stock.' }
      }

      const cantidadAnterior = Number((art as { stock?: unknown }).stock) || 0
      let cantidadNueva = cantidadAnterior
      let cantidadMov = 0

      if (tipo === 'Entrada') {
        cantidadNueva = cantidadAnterior + raw
        cantidadMov = raw
      } else if (tipo === 'Salida') {
        if (cantidadAnterior < raw) {
          return { success: false, error: 'Stock insuficiente para esta salida.' }
        }
        cantidadNueva = cantidadAnterior - raw
        cantidadMov = raw
      } else {
        cantidadNueva = raw
        cantidadMov = Math.abs(cantidadNueva - cantidadAnterior)
      }

      const { error: errUpd } = await stockSupabase
        .from('articulos')
        .update({ stock: cantidadNueva })
        .eq('id', input.id_articulo_stock)

      if (errUpd) return { success: false, error: errUpd.message }

      const motivo =
        (input.motivo && String(input.motivo).trim()) ||
        (tipo === 'Ajuste' ? 'Ajuste manual ERP' : `Movimiento manual ERP (${tipo})`)

      const { data: mov, error: errMov } = await supabase
        .from('stock_movimientos')
        .insert({
          id_articulo_stock: input.id_articulo_stock,
          codigo_articulo: (art as { codigo?: string | null }).codigo || null,
          descripcion: String((art as { descripcion?: string }).descripcion || ''),
          tipo_movimiento: tipo,
          cantidad: cantidadMov,
          cantidad_anterior: cantidadAnterior,
          cantidad_nueva: cantidadNueva,
          motivo,
          id_pedido_compra: input.id_pedido_compra ?? null,
          id_usuario: usuarioId,
          nombre_usuario: nombreUsuario
        })
        .select()
        .single()

      if (errMov) return { success: false, error: errMov.message }
      return { success: true, data: mov as StockMovimiento }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Por cada ítem del pedido con `id_articulo_stock` y cantidad a recibir (>0),
   * registra una **Entrada** en stock y el movimiento en `stock_movimientos` vinculado al pedido.
   * Ítems sin artículo de stock o con cantidad 0 se omiten (no son error).
   */
  async aplicarEntradasStockDesdePedidoCompra(idPedido: number): Promise<
    ApiResponse<{
      aplicados: number
      omitidos: number
      detalles: string[]
    }>
  > {
    const pedidoRes = await this.getPedidoCompra(idPedido)
    if (!pedidoRes.success || !pedidoRes.data) {
      return { success: false, error: pedidoRes.error || 'No se pudo cargar el pedido.' }
    }
    const p = pedidoRes.data
    const numero = p.numero_pedido || String(idPedido)
    let aplicados = 0
    let omitidos = 0
    const detalles: string[] = []

    for (const it of p.items || []) {
      const idArt = it.id_articulo_stock
      if (idArt == null || Number(idArt) <= 0) {
        omitidos++
        continue
      }
      const idArtNum = Number(idArt)
      if (supabase) {
        const { data: yaEntrada, error: errYa } = await supabase
          .from('stock_movimientos')
          .select('id')
          .eq('id_pedido_compra', idPedido)
          .eq('id_articulo_stock', idArtNum)
          .eq('tipo_movimiento', 'Entrada')
          .limit(1)
        if (errYa) {
          detalles.push(`Error (${it.descripcion || 'ítem'}): ${errYa.message}`)
          continue
        }
        if (yaEntrada && yaEntrada.length > 0) {
          omitidos++
          detalles.push(
            `Omitido (${it.descripcion || 'ítem'}): ya hay una entrada de stock registrada para este pedido y artículo.`
          )
          continue
        }
      }
      const qty =
        Number(it.cantidad_comprada ?? it.cantidad_aprobada ?? it.cantidad_solicitada) || 0
      if (qty <= 0) {
        omitidos++
        detalles.push(`Omitido (${it.descripcion || 'ítem'}): cantidad a recibir en cero.`)
        continue
      }
      const mov = await this.aplicarMovimientoStockManual({
        id_articulo_stock: idArtNum,
        tipo_movimiento: 'Entrada',
        cantidad: qty,
        motivo: `Recepción pedido compra ${numero}`,
        id_pedido_compra: idPedido
      })
      if (!mov.success) {
        detalles.push(`Error (${it.descripcion || 'ítem'}): ${mov.error || 'desconocido'}`)
        continue
      }
      aplicados++
      detalles.push(`Entrada: ${it.descripcion || 'ítem'} +${qty}`)
    }

    return {
      success: true,
      data: { aplicados, omitidos, detalles }
    }
  }

  // ========== STOCK: DEPÓSITOS Y SALDOS (BD principal) ==========

  async getStockDepositos(): Promise<ApiResponse<import('../types/api').StockDepositoRecord[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase
        .from('stock_depositos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as import('../types/api').StockDepositoRecord[]) ?? [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async createStockDeposito(input: {
    nombre: string
    codigo?: string | null
  }): Promise<ApiResponse<import('../types/api').StockDepositoRecord>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const nombre = String(input.nombre || '').trim()
    if (!nombre) return { success: false, error: 'El nombre del depósito es obligatorio.' }
    try {
      const { data, error } = await supabase
        .from('stock_depositos')
        .insert({
          nombre,
          codigo: input.codigo?.trim() || null,
          activo: true
        })
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as import('../types/api').StockDepositoRecord }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getStockSaldosPorArticulo(
    idArticuloStock: number
  ): Promise<ApiResponse<import('../types/api').StockSaldoDepositoRow[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase
        .from('stock_saldo_deposito')
        .select(
          `
          cantidad,
          deposito:stock_depositos(id, nombre, codigo)
        `
        )
        .eq('id_articulo_stock', idArticuloStock)

      if (error) return { success: false, error: error.message }
      const rows = (data as any[] | null) || []
      const mapped: import('../types/api').StockSaldoDepositoRow[] = rows.map((r) => {
        const d = r.deposito as { id?: number; nombre?: string; codigo?: string | null } | null
        return {
          id_deposito: Number(d?.id) || 0,
          deposito_nombre: String(d?.nombre || '—'),
          deposito_codigo: d?.codigo ?? null,
          cantidad: Number(r.cantidad) || 0
        }
      })
      return { success: true, data: mapped }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Copia la existencia actual del artículo (base de stock) al depósito Principal en `stock_saldo_deposito`.
   * Útil para alinear multi-depósito con el stock global antes de transferir.
   */
  async replicarStockArticuloADepositoPrincipal(idArticuloStock: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de stock (VITE_STOCK_SUPABASE_*).' }
    }
    try {
      const { data: dep, error: eDep } = await supabase
        .from('stock_depositos')
        .select('id')
        .eq('codigo', 'PRINCIPAL')
        .maybeSingle()
      if (eDep || !dep) {
        return {
          success: false,
          error:
            eDep?.message ||
            'No existe el depósito Principal (aplicá el patch 2026-04-18_stock_depositos_saldos_transferencia.sql).'
        }
      }
      const idDep = Number((dep as { id?: number }).id)
      const { data: art, error: eArt } = await stockSupabase
        .from('articulos')
        .select('stock')
        .eq('id', idArticuloStock)
        .single()
      if (eArt) return { success: false, error: eArt.message }
      const cant = Number((art as { stock?: unknown })?.stock) || 0
      const { error: eUp } = await supabase.from('stock_saldo_deposito').upsert(
        {
          id_articulo_stock: idArticuloStock,
          id_deposito: idDep,
          cantidad: cant,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id_articulo_stock,id_deposito' }
      )
      if (eUp) return { success: false, error: eUp.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async transferirStockEntreDepositos(input: {
    id_articulo_stock: number
    id_deposito_origen: number
    id_deposito_destino: number
    cantidad: number
    codigo_articulo?: string | null
    descripcion_articulo: string
  }): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const sb = supabase
    const qty = Number(input.cantidad)
    if (!Number.isFinite(qty) || qty <= 0) return { success: false, error: 'Cantidad inválida.' }
    if (input.id_deposito_origen === input.id_deposito_destino) {
      return { success: false, error: 'El depósito de origen y destino deben ser distintos.' }
    }

    let usuarioId: number | null = null
    let nombreUsuario = 'ERP'
    try {
      const usuarioData = localStorage.getItem('usuario')
      if (usuarioData) {
        const p = JSON.parse(usuarioData) as { id?: number; nombre?: string }
        if (typeof p?.id === 'number') usuarioId = p.id
        if (typeof p?.nombre === 'string' && p.nombre.trim()) nombreUsuario = p.nombre.trim()
      }
    } catch {
      /* ignore */
    }

    const codigo = input.codigo_articulo ?? null
    const desc = String(input.descripcion_articulo || '').trim() || 'Artículo'
    const motivoBase = `Transferencia entre depósitos`

    try {
      const { data: rowO, error: errO } = await sb
        .from('stock_saldo_deposito')
        .select('id, cantidad')
        .eq('id_articulo_stock', input.id_articulo_stock)
        .eq('id_deposito', input.id_deposito_origen)
        .maybeSingle()

      if (errO) return { success: false, error: errO.message }
      if (!rowO) {
        return {
          success: false,
          error:
            'No hay saldo registrado en el depósito de origen. Usá “Sincronizar Principal” o replicá existencias antes de transferir.'
        }
      }
      const prevO = Number((rowO as { cantidad?: unknown }).cantidad) || 0
      if (prevO < qty) {
        return { success: false, error: 'Cantidad insuficiente en el depósito de origen.' }
      }

      const { data: rowD, error: errD } = await sb
        .from('stock_saldo_deposito')
        .select('id, cantidad')
        .eq('id_articulo_stock', input.id_articulo_stock)
        .eq('id_deposito', input.id_deposito_destino)
        .maybeSingle()

      if (errD) return { success: false, error: errD.message }
      const prevD = Number((rowD as { cantidad?: unknown } | null)?.cantidad) || 0
      const destRowExisted = !!(rowD as { id?: number } | null)?.id

      const newO = prevO - qty
      const { error: eUpO } = await sb
        .from('stock_saldo_deposito')
        .update({ cantidad: newO, updated_at: new Date().toISOString() })
        .eq('id_articulo_stock', input.id_articulo_stock)
        .eq('id_deposito', input.id_deposito_origen)

      if (eUpO) return { success: false, error: eUpO.message }

      if (destRowExisted) {
        const { error: eUpD } = await sb
          .from('stock_saldo_deposito')
          .update({ cantidad: prevD + qty, updated_at: new Date().toISOString() })
          .eq('id_articulo_stock', input.id_articulo_stock)
          .eq('id_deposito', input.id_deposito_destino)
        if (eUpD) {
          await sb
            .from('stock_saldo_deposito')
            .update({ cantidad: prevO, updated_at: new Date().toISOString() })
            .eq('id_articulo_stock', input.id_articulo_stock)
            .eq('id_deposito', input.id_deposito_origen)
          return { success: false, error: eUpD.message }
        }
      } else {
        const { error: eIns } = await sb.from('stock_saldo_deposito').insert({
          id_articulo_stock: input.id_articulo_stock,
          id_deposito: input.id_deposito_destino,
          cantidad: qty,
          updated_at: new Date().toISOString()
        })
        if (eIns) {
          await sb
            .from('stock_saldo_deposito')
            .update({ cantidad: prevO, updated_at: new Date().toISOString() })
            .eq('id_articulo_stock', input.id_articulo_stock)
            .eq('id_deposito', input.id_deposito_origen)
          return { success: false, error: eIns.message }
        }
      }

      const rollbackSaldos = async () => {
        await sb
          .from('stock_saldo_deposito')
          .update({ cantidad: prevO, updated_at: new Date().toISOString() })
          .eq('id_articulo_stock', input.id_articulo_stock)
          .eq('id_deposito', input.id_deposito_origen)
        if (destRowExisted) {
          await sb
            .from('stock_saldo_deposito')
            .update({ cantidad: prevD, updated_at: new Date().toISOString() })
            .eq('id_articulo_stock', input.id_articulo_stock)
            .eq('id_deposito', input.id_deposito_destino)
        } else {
          await sb
            .from('stock_saldo_deposito')
            .delete()
            .eq('id_articulo_stock', input.id_articulo_stock)
            .eq('id_deposito', input.id_deposito_destino)
        }
      }

      const { data: mov1, error: er1 } = await sb
        .from('stock_movimientos')
        .insert({
          id_articulo_stock: input.id_articulo_stock,
          codigo_articulo: codigo,
          descripcion: desc,
          tipo_movimiento: 'Salida',
          cantidad: qty,
          cantidad_anterior: prevO,
          cantidad_nueva: newO,
          motivo: motivoBase,
          id_deposito_origen: input.id_deposito_origen,
          id_deposito_destino: null,
          id_usuario: usuarioId,
          nombre_usuario: nombreUsuario
        })
        .select('id')
        .single()

      if (er1) {
        await rollbackSaldos()
        return { success: false, error: er1.message }
      }

      const newD = prevD + qty
      const { error: er2 } = await sb
        .from('stock_movimientos')
        .insert({
          id_articulo_stock: input.id_articulo_stock,
          codigo_articulo: codigo,
          descripcion: desc,
          tipo_movimiento: 'Entrada',
          cantidad: qty,
          cantidad_anterior: prevD,
          cantidad_nueva: newD,
          motivo: motivoBase,
          id_deposito_origen: null,
          id_deposito_destino: input.id_deposito_destino,
          id_usuario: usuarioId,
          nombre_usuario: nombreUsuario
        })
        .select('id')
        .single()

      if (er2) {
        const idM1 = (mov1 as { id?: number } | null)?.id
        if (idM1) await sb.from('stock_movimientos').delete().eq('id', idM1)
        await rollbackSaldos()
        return { success: false, error: er2.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Pone `articulos.stock` igual a la suma de `stock_saldo_deposito` para ese artículo (base principal + stock).
   * No crea filas en `stock_movimientos`; sirve para alinear el total global con multi-depósito.
   */
  async sincronizarStockGlobalDesdeSumaDepositos(
    idArticuloStock: number
  ): Promise<ApiResponse<{ nuevo_stock: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de stock (VITE_STOCK_SUPABASE_*).' }
    }
    try {
      const { data: rows, error } = await supabase
        .from('stock_saldo_deposito')
        .select('cantidad')
        .eq('id_articulo_stock', idArticuloStock)
      if (error) return { success: false, error: error.message }
      const list = (rows as { cantidad?: unknown }[] | null | undefined) ?? []
      if (list.length === 0) {
        return {
          success: false,
          error:
            'Este artículo no tiene saldos por depósito. Primero cargá saldos (p. ej. “Sincronizar Principal”) o no uses esta acción en modo solo stock global.'
        }
      }
      const sum = list.reduce((acc, r) => acc + (Number(r?.cantidad) || 0), 0)
      const { error: e2 } = await stockSupabase.from('articulos').update({ stock: sum }).eq('id', idArticuloStock)
      if (e2) return { success: false, error: e2.message }
      return { success: true, data: { nuevo_stock: sum } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ==================== ATENCIONES MOSTRADOR ====================
  
  async crearAtencionMostrador(data: {
    cliente_nombre: string
    tipo: 'virtual' | 'consulta' | 'venta'
    usuario_id: number
    usuario_nombre: string
    orden_id?: number
    cliente_id?: number
    notas?: string
    sector_destino?: string
    orden_numero_op?: string
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('crear_atencion_mostrador', {
          p_cliente_nombre: data.cliente_nombre,
          p_tipo: data.tipo,
          p_usuario_id: data.usuario_id,
          p_usuario_nombre: data.usuario_nombre,
          p_orden_id: data.orden_id ?? null,
          p_cliente_id: data.cliente_id ?? null,
          p_notas: data.notas ?? null,
          p_sector_destino: data.sector_destino ?? null,
          p_orden_numero_op: data.orden_numero_op ?? null
        })

        if (error) {
          console.error('Error creando atención:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error creando atención:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async listarSolicitudesImpresionTotem(
    usuarioId: number,
    limite = 80
  ): Promise<
    ApiResponse<
      Array<{
        id: number
        cliente_nombre: string
        cliente_dni: string
        cliente_telefono: string
        cantidad_hojas: number
        tipo_impresion: string
        origen_archivo: string
        archivo_url: string
        archivo_nombre: string
        numero_op: string | null
        estado_pago: string
        created_at: string
        pagado_at: string | null
        id_venta?: number | null
        numero_venta_crm?: string | null
        valor_venta?: number | null
        estado_pago_venta?: string | null
        impreso_at?: string | null
        impreso_por_usuario_id?: number | null
      }>
    >
  > {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_solicitudes_impresion_totem', {
          p_usuario_id: usuarioId,
          p_limite: limite
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as any[] }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async marcarImpresoSolicitudImpresionTotem(
    solicitudId: number,
    usuarioId: number
  ): Promise<ApiResponse<boolean>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('marcar_impreso_solicitud_impresion_totem', {
          p_solicitud_id: solicitudId,
          p_usuario_id: usuarioId
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: true }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearSolicitudImpresionTotem(data: {
    cliente_nombre: string
    cliente_dni: string
    cliente_telefono: string
    cantidad_hojas: number
    tipo_impresion: string
    origen_archivo: string
    archivo_url: string
    archivo_nombre: string
    orden_id?: number | null
    numero_op?: string | null
    valor_total?: number | null
    id_vendedor?: number
    nombre_vendedor?: string
  }): Promise<ApiResponse<{ id: number; id_venta?: number | null; numero_venta?: string | null }>> {
    if (supabase) {
      try {
        const { data: out, error } = await supabase.rpc('crear_solicitud_impresion_totem', {
          p_cliente_nombre: data.cliente_nombre,
          p_cliente_dni: data.cliente_dni,
          p_cliente_telefono: data.cliente_telefono,
          p_cantidad_hojas: data.cantidad_hojas,
          p_tipo_impresion: data.tipo_impresion,
          p_origen_archivo: data.origen_archivo,
          p_archivo_url: data.archivo_url,
          p_archivo_nombre: data.archivo_nombre,
          p_orden_id: data.orden_id ?? null,
          p_numero_op: data.numero_op ?? null,
          p_valor_total: data.valor_total ?? null,
          p_id_vendedor: data.id_vendedor ?? 1,
          p_nombre_vendedor: data.nombre_vendedor ?? 'Totem autoservicio'
        })
        if (error) return { success: false, error: error.message }
        // La función retorna json; intentamos normalizar campos principales.
        const result = (out ?? null) as any
        const id = typeof result?.id === 'number' ? (result.id as number) : typeof result?.solicitud_id === 'number' ? (result.solicitud_id as number) : NaN
        if (!Number.isFinite(id)) {
          return { success: false, error: 'Respuesta inesperada al crear solicitud de impresión.' }
        }
        return {
          success: true,
          data: {
            id,
            id_venta: typeof result?.id_venta === 'number' ? result.id_venta : null,
            numero_venta: typeof result?.numero_venta === 'string' ? result.numero_venta : null
          }
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /** Sesión temporal para subir archivo al tótem desde el celular (QR). Requiere RPC en BD (ver patch totem_qr_upload_sessions). */
  async crearSesionQrUploadTotem(): Promise<ApiResponse<{ session_id: string; expires_at: string }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('crear_sesion_qr_upload_totem')
      if (error) return { success: false, error: error.message }
      const row = (data ?? null) as { session_id?: string; expires_at?: string } | null
      if (!row?.session_id) return { success: false, error: 'No se pudo crear la sesión (¿migración aplicada?)' }
      return {
        success: true,
        data: { session_id: String(row.session_id), expires_at: String(row.expires_at ?? '') }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al crear sesión QR' }
    }
  }

  async obtenerSesionQrUploadTotem(sessionId: string): Promise<
    ApiResponse<{
      ok: boolean
      error?: string
      session_id?: string
      expires_at?: string
      archivo_url?: string | null
      archivo_nombre?: string | null
      archivo_bytes?: number | null
      estado?: string
    }>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('obtener_sesion_qr_upload_totem', { p_session_id: sessionId })
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data ?? { ok: false }) as any }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al leer sesión' }
    }
  }

  /** Sube archivo al bucket `archivos` y registra la URL en la sesión QR (una sola vez por sesión). */
  async subirArchivoSesionTotemQr(file: File, sessionId: string): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      return { success: false, error: `El archivo supera ${maxBytes / (1024 * 1024)} MB` }
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const allowedExt = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'])
    if (!allowedExt.has(ext)) {
      return { success: false, error: 'Formato no permitido (PDF o imagen).' }
    }
    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80)
    const path = `totem-qr-uploads/${sessionId}/${Date.now()}_${safeBase}.${ext}`
    try {
      const { error: uploadError } = await supabase.storage.from('archivos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `application/${ext === 'pdf' ? 'pdf' : 'octet-stream'}`
      })
      if (uploadError) return { success: false, error: uploadError.message }
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) return { success: false, error: 'No se pudo obtener la URL pública del archivo' }

      const { data: reg, error: regErr } = await supabase.rpc('registrar_archivo_sesion_qr_totem', {
        p_session_id: sessionId,
        p_archivo_url: publicUrl,
        p_archivo_nombre: file.name.slice(0, 500),
        p_archivo_bytes: file.size
      })
      if (regErr) return { success: false, error: regErr.message }
      const out = (reg ?? null) as { ok?: boolean; error?: string } | null
      if (out && out.ok === false) {
        return { success: false, error: out.error || 'No se pudo registrar en la sesión' }
      }
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al subir archivo' }
    }
  }

  async marcarPagoSolicitudImpresionTotem(
    solicitudId: number,
    usuarioId: number
  ): Promise<ApiResponse<boolean>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('marcar_pago_solicitud_impresion_totem', {
          p_solicitud_id: solicitudId,
          p_usuario_id: usuarioId
        })
        if (error) return { success: false, error: error.message }

        if (data) {
          const { data: sol } = await supabase
            .from('totem_impresion_solicitudes')
            .select('id_venta')
            .eq('id', solicitudId)
            .maybeSingle()
          if (sol?.id_venta) {
            const ventaRes = await this.getVenta(Number(sol.id_venta))
            if (ventaRes.success && ventaRes.data) {
              void syncCajaDesdeVentaApi(ventaRes.data)
            }
          }
        }

        return { success: true, data: Boolean(data) }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async listarPantallaTotemPublica(
    horas = 48,
    limiteVisitas = 30,
    limiteImpresiones = 30
  ): Promise<
    ApiResponse<{
      visitas: Array<{
        id: number
        cliente_nombre: string
        notas: string | null
        fecha_atencion: string
        tipo: string
      }>
      impresiones: Array<{
        id: number
        cliente_nombre: string
        cantidad_hojas: number
        tipo_impresion: string
        estado_pago: string
        numero_op: string | null
        created_at: string
        impreso_at: string | null
      }>
      generado_en?: string
    }>
  > {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_pantalla_totem_publica', {
          p_horas: horas,
          p_limite_visitas: limiteVisitas,
          p_limite_impresiones: limiteImpresiones
        })
        if (error) return { success: false, error: error.message }
        const raw = (data ?? {}) as {
          visitas?: unknown[]
          impresiones?: unknown[]
          generado_en?: string
        }
        return {
          success: true,
          data: {
            visitas: (raw.visitas ?? []) as Array<{
              id: number
              cliente_nombre: string
              notas: string | null
              fecha_atencion: string
              tipo: string
            }>,
            impresiones: (raw.impresiones ?? []) as Array<{
              id: number
              cliente_nombre: string
              cantidad_hojas: number
              tipo_impresion: string
              estado_pago: string
              numero_op: string | null
              created_at: string
              impreso_at: string | null
            }>,
            generado_en: raw.generado_en
          }
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerAtencionesMostrador(fechaInicio?: string, fechaFin?: string): Promise<ApiResponse<Array<{
    id: number
    cliente_id: number | null
    cliente_nombre: string
    tipo: 'virtual' | 'consulta' | 'venta'
    orden_id: number | null
    usuario_id: number
    usuario_nombre: string
    fecha_atencion: string
    notas: string | null
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_atenciones_mostrador', {
          p_fecha_inicio: fechaInicio || null,
          p_fecha_fin: fechaFin || null
        })

        if (error) {
          console.error('Error obteniendo atenciones:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<{
          id: number
          cliente_id: number | null
          cliente_nombre: string
          tipo: 'virtual' | 'consulta' | 'venta'
          orden_id: number | null
          usuario_id: number
          usuario_nombre: string
          fecha_atencion: string
          notas: string | null
        }> }
      } catch (error) {
        console.error('Error obteniendo atenciones:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  private async ensureChatRoomExists(roomId: number, canalNombre: string): Promise<void> {
    if (!supabase) return

    try {
      // Verificar si el room existe
      const { data: existingRoom, error: checkError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('id', roomId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Error verificando chat_room:', checkError)
      }

      // Si no existe, crearlo
      if (!existingRoom) {
        const roomNames: Record<number, string> = {
          1: 'General',
          2: 'Producción',
          3: 'Diseño',
          4: 'Imprenta',
          5: 'Instalaciones',
          6: 'Random',
          7: 'Taller Gráfico',
          8: 'Mostrador'
        }

        const { error: insertError } = await supabase
          .from('chat_rooms')
          .insert({
            id: roomId,
            nombre: roomNames[roomId] || canalNombre,
            tipo: 'publico'
          })

        if (insertError) {
          console.warn('Error creando chat_room:', insertError)
          // Si falla por IDENTITY, intentar sin especificar ID
          if (insertError.code === '23505' || insertError.message.includes('identity')) {
            const { error: retryError } = await supabase
              .from('chat_rooms')
              .insert({
                nombre: roomNames[roomId] || canalNombre,
                tipo: 'publico'
              })
            if (retryError) {
              console.error('Error creando chat_room sin ID:', retryError)
            }
          }
        } else {
          console.log(`✅ Chat room ${roomId} creado exitosamente`)
        }
      }
    } catch (error) {
      console.warn('Error en ensureChatRoomExists:', error)
    }
  }

  // ===== ETIQUETAS DISPONIBLES =====
  async getEtiquetasDisponibles(): Promise<ApiResponse<Array<{ nombre: string; veces_usada: number; color: string }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_etiquetas_disponibles')
        
        if (error) {
          console.error('Error obteniendo etiquetas disponibles:', error)
          return { success: false, error: error.message }
        }
        
        return { success: true, data: data || [] }
      } catch (error) {
        console.error('Excepción obteniendo etiquetas disponibles:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener el color de una etiqueta específica
   */
  async obtenerColorEtiqueta(nombre: string): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_color_etiqueta', {
          p_nombre: nombre.trim()
        })
        
        if (error) {
          console.error('Error obteniendo color de etiqueta:', error)
          return { success: false, error: error.message }
        }
        
        return { success: true, data: data || '#6B7280' }
      } catch (error) {
        console.error('Excepción obteniendo color de etiqueta:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async guardarEtiquetaDisponible(nombre: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('agregar_etiqueta_disponible', {
          p_nombre: nombre.trim()
        })
        
        if (error) {
          console.error('Error guardando etiqueta disponible:', error)
          return { success: false, error: error.message }
        }
        
        return { success: true }
      } catch (error) {
        console.error('Excepción guardando etiqueta disponible:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== REVISIONES Y APROBACIONES ====================
  
  async solicitarRevisionOrden(data: {
    id_orden: number
    usuario_revisor_id: number
    usuario_revisor_nombre: string
    comentarios?: string
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('solicitar_revision_orden', {
          p_id_orden: data.id_orden,
          p_usuario_revisor_id: data.usuario_revisor_id,
          p_usuario_revisor_nombre: data.usuario_revisor_nombre,
          p_comentarios: data.comentarios || null
        })

        if (error) {
          console.error('Error solicitando revisión:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error solicitando revisión:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async aprobarRevisionOrden(idRevision: number, comentarios?: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('aprobar_revision_orden', {
          p_id_revision: idRevision,
          p_comentarios: comentarios || null
        })

        if (error) {
          console.error('Error aprobando revisión:', error)
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error aprobando revisión:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async rechazarRevisionOrden(idRevision: number, comentarios: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('rechazar_revision_orden', {
          p_id_revision: idRevision,
          p_comentarios: comentarios
        })

        if (error) {
          console.error('Error rechazando revisión:', error)
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error rechazando revisión:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerRevisionesOrden(idOrden: number): Promise<ApiResponse<Array<import('../types/api').RevisionOrden>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_revisiones_orden', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error obteniendo revisiones:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').RevisionOrden> }
      } catch (error) {
        console.error('Error obteniendo revisiones:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== GALERÍA DE TRABAJOS ====================
  
  async agregarTrabajoGaleria(data: {
    id_orden: number
    numero_op: string
    cliente: string
    titulo?: string
    descripcion?: string
    imagen_url: string
    categoria?: string
    tags?: string[]
    fecha_completado?: string
    usuario_subio_id?: number
    usuario_subio_nombre?: string
    visible_publico?: boolean
    destacado?: boolean
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('agregar_trabajo_galeria', {
          p_id_orden: data.id_orden,
          p_numero_op: data.numero_op,
          p_cliente: data.cliente,
          p_titulo: data.titulo || null,
          p_descripcion: data.descripcion || null,
          p_imagen_url: data.imagen_url,
          p_categoria: data.categoria || null,
          p_tags: data.tags || null,
          p_fecha_completado: data.fecha_completado || new Date().toISOString().split('T')[0],
          p_usuario_subio_id: data.usuario_subio_id || null,
          p_usuario_subio_nombre: data.usuario_subio_nombre || null,
          p_visible_publico: data.visible_publico !== undefined ? data.visible_publico : true,
          p_destacado: data.destacado !== undefined ? data.destacado : false
        })

        if (error) {
          console.error('Error agregando trabajo a galería:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error agregando trabajo a galería:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerTrabajosGaleria(filtros?: {
    categoria?: string
    limit?: number
    offset?: number
    solo_destacados?: boolean
    solo_publicos?: boolean
  }): Promise<ApiResponse<Array<import('../types/api').TrabajoGaleria>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_trabajos_galeria', {
          p_categoria: filtros?.categoria || null,
          p_limit: filtros?.limit || 50,
          p_offset: filtros?.offset || 0,
          p_solo_destacados: filtros?.solo_destacados || false,
          p_solo_publicos: filtros?.solo_publicos !== undefined ? filtros.solo_publicos : true
        })

        if (error) {
          console.error('Error obteniendo trabajos de galería:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').TrabajoGaleria> }
      } catch (error) {
        console.error('Error obteniendo trabajos de galería:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerCategoriasGaleria(): Promise<ApiResponse<Array<import('../types/api').CategoriaGaleria>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_categorias_galeria')

        if (error) {
          console.error('Error obteniendo categorías:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').CategoriaGaleria> }
      } catch (error) {
        console.error('Error obteniendo categorías:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== REGISTRO DE TIEMPO DE TRABAJO ====================
  
  async iniciarTiempoTrabajo(data: {
    id_orden: number
    usuario_id: number
    usuario_nombre: string
    hora_inicio?: string
    descripcion?: string
    tipo_trabajo?: 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        // Construir parámetros dinámicamente - no pasar p_hora_inicio si no está definido
        // para que use el valor por defecto (CURRENT_TIME) en la función SQL
        const rpcParams: any = {
          p_id_orden: data.id_orden,
          p_usuario_id: data.usuario_id,
          p_usuario_nombre: data.usuario_nombre,
          p_tipo_trabajo: data.tipo_trabajo || 'diseno'
        }
        
        // Solo agregar p_hora_inicio si está definido
        if (data.hora_inicio) {
          rpcParams.p_hora_inicio = data.hora_inicio
        }
        
        // Solo agregar p_descripcion si está definido
        if (data.descripcion) {
          rpcParams.p_descripcion = data.descripcion
        }
        
        const { data: result, error } = await supabase.rpc('iniciar_tiempo_trabajo', rpcParams)

        if (error) {
          console.error('Error iniciando tiempo de trabajo:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error iniciando tiempo de trabajo:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async finalizarTiempoTrabajo(idRegistro: number, horaFin?: string, descripcion?: string): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        // Construir parámetros dinámicamente - no pasar p_hora_fin si no está definido
        // para que use el valor por defecto (CURRENT_TIME) en la función SQL
        const rpcParams: any = {
          p_id_registro: idRegistro
        }
        
        // Solo agregar p_hora_fin si está definido
        if (horaFin) {
          rpcParams.p_hora_fin = horaFin
        }
        
        // Solo agregar p_descripcion si está definido
        if (descripcion) {
          rpcParams.p_descripcion = descripcion
        }
        
        const { data: result, error } = await supabase.rpc('finalizar_tiempo_trabajo', rpcParams)

        if (error) {
          console.error('Error finalizando tiempo de trabajo:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error finalizando tiempo de trabajo:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async registrarTiempoManual(data: {
    id_orden: number
    usuario_id: number
    usuario_nombre: string
    fecha?: string
    hora_inicio: string
    hora_fin: string
    tiempo_minutos?: number
    descripcion?: string
    tipo_trabajo?: 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('registrar_tiempo_manual', {
          p_id_orden: data.id_orden,
          p_usuario_id: data.usuario_id,
          p_usuario_nombre: data.usuario_nombre,
          p_fecha: data.fecha || null,
          p_hora_inicio: data.hora_inicio,
          p_hora_fin: data.hora_fin,
          p_tiempo_minutos: data.tiempo_minutos || null,
          p_descripcion: data.descripcion || null,
          p_tipo_trabajo: data.tipo_trabajo || 'diseno'
        })

        if (error) {
          console.error('Error registrando tiempo manual:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error registrando tiempo manual:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerTiempoTrabajoOrden(idOrden: number): Promise<ApiResponse<Array<import('../types/api').RegistroTiempo>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_tiempo_trabajo_orden', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error obteniendo tiempo de trabajo:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').RegistroTiempo> }
      } catch (error) {
        console.error('Error obteniendo tiempo de trabajo:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerTiempoUsuario(usuarioId: number, fechaDesde?: string, fechaHasta?: string): Promise<ApiResponse<Array<import('../types/api').TiempoUsuario>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_tiempo_usuario', {
          p_usuario_id: usuarioId,
          p_fecha_desde: fechaDesde || null,
          p_fecha_hasta: fechaHasta || null
        })

        if (error) {
          console.error('Error obteniendo tiempo de usuario:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').TiempoUsuario> }
      } catch (error) {
        console.error('Error obteniendo tiempo de usuario:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== BRIEF PÚBLICO - FORMULARIO CLIENTE ====================
  
  // Crear un nuevo brief público (sin necesidad de OP)
  async crearBriefPublico(usuarioId?: number, idCliente?: number): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_brief_publico', {
          p_creado_por: usuarioId || null,
          p_id_cliente: idCliente || null
        })

        if (error) {
          console.error('Error creando brief público:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as string }
      } catch (error) {
        console.error('Error creando brief público:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Generar token para una OP existente (compatibilidad hacia atrás)
  async generarBriefToken(idOrden: number): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('generar_brief_token', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error generando token de brief:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as string }
      } catch (error) {
        console.error('Error generando token de brief:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Obtener brief por token (nueva estructura)
  async obtenerBriefPorToken(token: string): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_brief_por_token', {
          p_token: token
        })

        if (error) {
          console.error('Error obteniendo brief por token:', error)
          return { success: false, error: error.message }
        }

        if (!data || data.length === 0) {
          return { success: false, error: 'Token no válido' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        console.error('Error obteniendo brief por token:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Obtener orden por token de brief (compatibilidad hacia atrás)
  async obtenerOrdenPorBriefToken(token: string): Promise<ApiResponse<Partial<OrdenTrabajo>>> {
    // Primero intentar obtener desde la nueva tabla de briefs
    const briefResponse = await this.obtenerBriefPorToken(token)
    if (briefResponse.success && briefResponse.data) {
      // Si tiene orden asociada, obtenerla
      if (briefResponse.data.id_orden_asociada) {
        const ordenResponse = await this.getOrden(briefResponse.data.id_orden_asociada)
        if (ordenResponse.success) {
          return ordenResponse
        }
      }
        // Si no tiene orden, devolver los datos del brief como si fuera una orden
        const briefData = briefResponse.data
        return { 
          success: true, 
          data: {
            numero_op: briefData.numero_op || 'Pendiente',
            cliente: briefData.cliente || briefData.cliente_nombre_completo || 'Cliente',
            cliente_nombre_completo: briefData.cliente_nombre_completo || null,
            cliente_empresa: briefData.cliente_empresa || null,
            telefono_cliente: briefData.telefono_cliente || null,
            email_cliente: briefData.email_cliente || null,
            tipo_producto_servicio: Array.isArray(briefData.tipo_producto_servicio) ? briefData.tipo_producto_servicio : null,
            tipo_producto_otro: briefData.tipo_producto_otro || null,
            necesita_asesoramiento: briefData.necesita_asesoramiento || false,
            donde_colocados: briefData.donde_colocados || null,
            digital_o_impresion: briefData.digital_o_impresion || null,
            cantidades: briefData.cantidades || null,
            objetivo_proyecto: briefData.objetivo_proyecto || null,
            material_logo: briefData.material_logo || null,
            material_textos: briefData.material_textos || null,
            material_imagenes: briefData.material_imagenes || null,
            tiene_referencias: briefData.tiene_referencias || false,
            referencias_links: briefData.referencias_links || null,
            brief_publico: briefData.brief_publico || null,
            estilo_diseno: briefData.estilo_diseno || null,
            referencias: briefData.referencias || null,
            fecha_limite_brief: briefData.fecha_limite_brief || null,
            es_urgencia: briefData.es_urgencia || false
          } as Partial<OrdenTrabajo>
        }
    }
    
    // Fallback: intentar con la función antigua (compatibilidad)
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_orden_por_brief_token', {
          p_token: token
        })

        if (error) {
          console.error('Error obteniendo orden por token:', error)
          return { success: false, error: error.message }
        }

        if (!data || data.length === 0) {
          return { success: false, error: 'Token no válido' }
        }

        return { success: true, data: data[0] as Partial<OrdenTrabajo> }
      } catch (error) {
        console.error('Error obteniendo orden por token:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Listar briefs de un cliente web (por id_cliente o email)
  async listarBriefsPorCliente(idCliente: number): Promise<ApiResponse<any[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_briefs_por_cliente', {
          p_id_cliente: idCliente
        })

        if (error) {
          console.error('Error listando briefs del cliente:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as any[] }
      } catch (error) {
        console.error('Error listando briefs del cliente:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Listar briefs pendientes (sin OP asociada)
  async listarBriefsPendientes(): Promise<ApiResponse<any[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_briefs_pendientes')

        if (error) {
          console.error('Error listando briefs pendientes:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as any[] }
      } catch (error) {
        console.error('Error listando briefs pendientes:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Asociar un brief a una orden
  async uploadArchivoBriefPublico(
    file: File,
    idBrief: number,
    options?: { tipoEtiqueta?: string; nombreArchivo?: string }
  ): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const nombreDb = options?.nombreArchivo || file.name
        const tipoDb = options?.tipoEtiqueta || file.type
        const fileExt = file.name.split('.').pop() || 'png'
        const fileName = `${idBrief}_${Date.now()}.${fileExt}`
        const filePath = `${idBrief}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('briefs-publicos')
          .upload(filePath, file, { upsert: true })

        if (uploadError) return { success: false, error: uploadError.message }

        const { data: urlData } = supabase.storage.from('briefs-publicos').getPublicUrl(filePath)

        const { error: dbError } = await supabase.from('briefs_publicos_archivos').insert({
          id_brief: idBrief,
          url: urlData.publicUrl,
          nombre_archivo: nombreDb,
          tipo: tipoDb,
          tamaño: file.size
        })

        if (dbError) return { success: false, error: dbError.message }

        return { success: true, data: urlData.publicUrl }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async asociarBriefAOrden(tokenBrief: string, idOrden: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('asociar_brief_a_orden', {
          p_token_brief: tokenBrief,
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error asociando brief a orden:', error)
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error asociando brief a orden:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarBriefPublico(data: {
    token: string
    id_cliente?: number
    cliente_nombre_completo?: string
    cliente_empresa?: string
    telefono_cliente?: string
    email_cliente?: string
    tipo_producto_servicio?: string[]
    tipo_producto_otro?: string
    necesita_asesoramiento?: boolean
    donde_colocados?: string
    digital_o_impresion?: string
    cantidades?: string
    objetivo_proyecto?: string
    material_logo?: string
    material_textos?: string
    material_imagenes?: string
    tiene_referencias?: boolean
    referencias_links?: string
    brief_publico?: string
    estilo_diseno?: string
    referencias?: string
    fecha_limite_brief?: string
    es_urgencia?: boolean
  }): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        // Intentar con la nueva función primero
        let updateError = null
        try {
          const result = await supabase.rpc('actualizar_brief_publico_completo', {
            p_token: data.token,
            p_cliente_nombre_completo: data.cliente_nombre_completo || null,
            p_cliente_empresa: data.cliente_empresa || null,
            p_telefono_cliente: data.telefono_cliente || null,
            p_email_cliente: data.email_cliente || null,
            p_tipo_producto_servicio: data.tipo_producto_servicio || null,
            p_tipo_producto_otro: data.tipo_producto_otro || null,
            p_necesita_asesoramiento: data.necesita_asesoramiento || false,
            p_donde_colocados: data.donde_colocados || null,
            p_digital_o_impresion: data.digital_o_impresion || null,
            p_cantidades: data.cantidades || null,
            p_objetivo_proyecto: data.objetivo_proyecto || null,
            p_material_logo: data.material_logo || null,
            p_material_textos: data.material_textos || null,
            p_material_imagenes: data.material_imagenes || null,
            p_tiene_referencias: data.tiene_referencias || false,
            p_referencias_links: data.referencias_links || null,
            p_brief_publico: data.brief_publico || null,
            p_estilo_diseno: data.estilo_diseno || null,
            p_referencias: data.referencias || null,
            p_fecha_limite_brief: data.fecha_limite_brief || null,
            p_es_urgencia: data.es_urgencia || false,
            p_id_cliente: data.id_cliente ?? null
          })
          updateError = result.error
        } catch (e) {
          // Si falla, intentar con la función antigua (compatibilidad)
          const result = await supabase.rpc('actualizar_brief_publico', {
            p_token: data.token,
            p_cliente_nombre_completo: data.cliente_nombre_completo || null,
            p_cliente_empresa: data.cliente_empresa || null,
            p_telefono_cliente: data.telefono_cliente || null,
            p_email_cliente: data.email_cliente || null,
            p_tipo_producto_servicio: data.tipo_producto_servicio || null,
            p_tipo_producto_otro: data.tipo_producto_otro || null,
            p_necesita_asesoramiento: data.necesita_asesoramiento || false,
            p_donde_colocados: data.donde_colocados || null,
            p_digital_o_impresion: data.digital_o_impresion || null,
            p_cantidades: data.cantidades || null,
            p_objetivo_proyecto: data.objetivo_proyecto || null,
            p_material_logo: data.material_logo || null,
            p_material_textos: data.material_textos || null,
            p_material_imagenes: data.material_imagenes || null,
            p_tiene_referencias: data.tiene_referencias || false,
            p_referencias_links: data.referencias_links || null,
            p_brief_publico: data.brief_publico || null,
            p_estilo_diseno: data.estilo_diseno || null,
            p_referencias: data.referencias || null,
            p_fecha_limite_brief: data.fecha_limite_brief || null,
            p_es_urgencia: data.es_urgencia || false
          })
          updateError = result.error
        }

        if (updateError) {
          console.error('Error actualizando brief público:', updateError)
          return { success: false, error: updateError.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error actualizando brief público:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ========== PROVEEDORES ==========
  
  async getProveedores(activos?: boolean): Promise<ApiResponse<Proveedor[]>> {
    if (supabase) {
      try {
        let query = supabase.from('proveedores').select('*').order('nombre', { ascending: true })
        if (activos !== undefined) {
          query = query.eq('activo', activos)
        }
        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as Proveedor[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  private matchProveedorNombre(
    p: Proveedor,
    nombre: string
  ): boolean {
    const n = nombre.trim().toUpperCase()
    if (!n) return false
    const rs = (p.razon_social || '').trim().toUpperCase()
    const nm = p.nombre.trim().toUpperCase()
    return rs === n || nm === n || n.includes(nm) || Boolean(rs && n.includes(rs.split(' ')[0]))
  }

  async getProveedoresConFinanzas(): Promise<
    ApiResponse<Array<Proveedor & { finanzas: import('../types/api').ProveedorFinanzasResumen }>>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      await Promise.all([
        this.vincularDeudasProveedores(),
        this.vincularPagosProveedores(),
        this.vincularMovimientosProveedores()
      ])

      const [provRes, deudasRes, movsRes, pagosRes, deudaCcRows] = await Promise.all([
        this.getProveedores(true),
        supabase.from('deudas_proveedores').select('*'),
        supabase.from('movimientos_proveedores').select('*').order('fecha_hora', { ascending: true }),
        supabase.from('pagos_proveedores').select('*'),
        this.loadDeudaCcRows()
      ])

      if (!provRes.success || !provRes.data) {
        return { success: false, error: provRes.error || 'No se pudieron cargar proveedores' }
      }

      const deudas = (deudasRes.data ?? []) as import('../types/api').DeudaProveedorRecord[]
      const movs = (movsRes.data ?? []) as import('../types/api').MovimientoProveedorRecord[]
      const pagos = (pagosRes.data ?? []) as import('../types/api').PagoProveedorRecord[]

      const deudaByProv = new Map<number, import('../types/api').DeudaProveedorRecord>()
      for (const d of deudas) {
        if (d.id_proveedor) deudaByProv.set(d.id_proveedor, d)
      }

      const matchedDeudaIds = new Set<number>()

      const enriched: import('../types/api').ProveedorConFinanzas[] = provRes.data.map((p) => {
        let deuda = deudaByProv.get(p.id) ?? null
        if (!deuda) {
          deuda =
            deudas.find(
              (d) =>
                !d.id_proveedor &&
                this.matchProveedorNombre(p, d.razon_social)
            ) ?? null
        }
        if (deuda) matchedDeudaIds.add(deuda.id)

        const movsProv = movs.filter(
          (m) =>
            m.id_proveedor === p.id ||
            this.matchProveedorNombre(p, m.proveedor_nombre)
        )
        const pagosProv = pagos.filter(
          (pg) =>
            pg.id_proveedor === p.id ||
            this.matchProveedorNombre(p, pg.proveedor_nombre)
        )
        const ccProv = deudaCcRows.filter(
          (cc) =>
            cc.id_proveedor === p.id ||
            this.matchProveedorNombre(p, cc.proveedor_nombre)
        )

        const lastMov = movsProv[movsProv.length - 1]
        const pagosTotal = pagosProv.reduce((s, pg) => s + (Number(pg.monto) || 0), 0)

        const telefono =
          p.telefono ||
          (deuda?.telefono && deuda.telefono !== '-' ? deuda.telefono : null) ||
          null
        const razon_social = p.razon_social || deuda?.razon_social || null

        const finanzas: import('../types/api').ProveedorFinanzasResumen = {
          codigo_deuda: deuda?.codigo ?? null,
          saldo_listado: deuda ? Number(deuda.saldo) || 0 : null,
          saldo_movimientos: lastMov ? Number(lastMov.saldo) || 0 : null,
          pagos_total: pagosTotal,
          movimientos_count: movsProv.length,
          pagos_count: pagosProv.length,
          deuda_cc_count: ccProv.length,
          tiene_cuenta_corriente:
            movsProv.length > 0 || pagosProv.length > 0 || ccProv.length > 0 || !!deuda
        }

        return {
          ...p,
          telefono,
          razon_social,
          finanzas,
          es_solo_listado: false
        }
      })

      for (const d of deudas) {
        if (matchedDeudaIds.has(d.id) || d.id_proveedor) continue
        const ccSolo = deudaCcRows.filter((cc) =>
          this.matchProveedorNombre(
            { id: 0, nombre: d.razon_social, razon_social: d.razon_social } as Proveedor,
            cc.proveedor_nombre
          )
        )
        enriched.push({
          id: -d.id,
          nombre: d.razon_social,
          razon_social: d.razon_social,
          cuit: null,
          contacto_nombre: null,
          telefono: d.telefono && d.telefono !== '-' ? d.telefono : null,
          email: null,
          direccion: null,
          ciudad: null,
          provincia: null,
          codigo_postal: null,
          sitio_web: null,
          notas: null,
          activo: true,
          calificacion: 0,
          total_compras: 0,
          monto_total_compras: 0,
          created_at: d.created_at || '',
          updated_at: d.updated_at || '',
          finanzas: {
            codigo_deuda: d.codigo,
            saldo_listado: Number(d.saldo) || 0,
            saldo_movimientos: null,
            pagos_total: 0,
            movimientos_count: 0,
            pagos_count: 0,
            deuda_cc_count: ccSolo.length,
            tiene_cuenta_corriente: true
          },
          es_solo_listado: true,
          id_deuda: d.id
        })
      }

      enriched.sort((a, b) => {
        const na = (a.razon_social || a.nombre).toUpperCase()
        const nb = (b.razon_social || b.nombre).toUpperCase()
        return na.localeCompare(nb, 'es')
      })

      return { success: true, data: enriched }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getProveedor(id: number): Promise<ApiResponse<Proveedor>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .select('*')
          .eq('id', id)
          .single()
        if (error) return { success: false, error: error.message }
        if (!data) return { success: false, error: 'Proveedor no encontrado' }
        return { success: true, data: data as Proveedor }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearProveedor(proveedor: {
    nombre: string
    razon_social?: string
    cuit?: string
    contacto_nombre?: string
    telefono?: string
    email?: string
    direccion?: string
    ciudad?: string
    provincia?: string
    codigo_postal?: string
    sitio_web?: string
    notas?: string
  }): Promise<ApiResponse<Proveedor>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .insert(proveedor)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Proveedor }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarProveedor(id: number, proveedor: Partial<Proveedor>): Promise<ApiResponse<Proveedor>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .update(proveedor)
          .eq('id', id)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Proveedor }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async eliminarProveedor(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('proveedores')
          .update({ activo: false })
          .eq('id', id)
        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getProductosProveedor(idProveedor: number): Promise<ApiResponse<ProveedorProducto[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores_productos')
          .select('*')
          .eq('id_proveedor', idProveedor)
          .eq('activo', true)
          .order('descripcion', { ascending: true })
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as ProveedorProducto[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearProductoProveedor(producto: {
    id_proveedor: number
    codigo_producto?: string
    descripcion: string
    unidad?: string
    precio_unitario?: number
    moneda?: string
    stock_disponible?: number
    tiempo_entrega_dias?: number
    observaciones?: string
  }): Promise<ApiResponse<ProveedorProducto>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores_productos')
          .insert({
            ...producto,
            moneda: producto.moneda || 'ARS',
            unidad: producto.unidad || 'unidad'
          })
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ProveedorProducto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarProductoProveedor(id: number, producto: Partial<ProveedorProducto>): Promise<ApiResponse<ProveedorProducto>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores_productos')
          .update(producto)
          .eq('id', id)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ProveedorProducto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getHistorialPrecios(idProveedor?: number, codigoProducto?: string): Promise<ApiResponse<PrecioHistorial[]>> {
    if (supabase) {
      try {
        let query = supabase.from('precios_historial').select('*').order('fecha_cambio', { ascending: false })
        if (idProveedor) {
          query = query.eq('id_proveedor', idProveedor)
        }
        if (codigoProducto) {
          query = query.eq('codigo_producto', codigoProducto)
        }
        const { data, error } = await query.limit(100)
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as PrecioHistorial[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ========== PRESUPUESTOS ==========

  async crearPresupuesto(presupuesto: {
    id_pedido_compra?: number
    id_proveedor: number
    fecha_vencimiento?: string
    condiciones_pago?: string
    tiempo_entrega_dias?: number
    observaciones?: string
    items: Array<{
      id_item_pedido?: number
      codigo_producto?: string
      descripcion: string
      cantidad: number
      unidad?: string
      precio_unitario: number
      observaciones?: string
    }>
  }): Promise<ApiResponse<Presupuesto>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        // Calcular monto total
        const montoTotal = presupuesto.items.reduce((sum, item) => {
          return sum + (item.precio_unitario * item.cantidad)
        }, 0)

        // Generar número de presupuesto
        const numeroPresupuesto = `PRES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

        // Crear presupuesto
        const { data: presupuestoData, error: presupuestoError } = await supabase
          .from('presupuestos')
          .insert({
            numero_presupuesto: numeroPresupuesto,
            id_pedido_compra: presupuesto.id_pedido_compra || null,
            id_proveedor: presupuesto.id_proveedor,
            fecha_vencimiento: presupuesto.fecha_vencimiento || null,
            condiciones_pago: presupuesto.condiciones_pago || null,
            tiempo_entrega_dias: presupuesto.tiempo_entrega_dias || null,
            observaciones: presupuesto.observaciones || null,
            monto_total: montoTotal,
            id_usuario_solicitante: usuario?.id || null,
            nombre_usuario_solicitante: usuario?.nombre || null
          })
          .select()
          .single()

        if (presupuestoError) return { success: false, error: presupuestoError.message }

        // Crear items del presupuesto
        const items = presupuesto.items.map(item => ({
          id_presupuesto: presupuestoData.id,
          id_item_pedido: item.id_item_pedido || null,
          codigo_producto: item.codigo_producto || null,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad || 'unidad',
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_unitario * item.cantidad,
          observaciones: item.observaciones || null
        }))

        const { error: itemsError } = await supabase
          .from('presupuestos_items')
          .insert(items)

        if (itemsError) {
          // Si falla la inserción de items, eliminar el presupuesto creado
          await supabase.from('presupuestos').delete().eq('id', presupuestoData.id)
          return { success: false, error: itemsError.message }
        }

        // Obtener el presupuesto completo con items
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos')
          .select(`
            *,
            items:presupuestos_items(*),
            proveedor:proveedores(*)
          `)
          .eq('id', presupuestoData.id)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }

        return { success: true, data: presupuestoCompleto as Presupuesto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPresupuestos(filters?: {
    id_pedido_compra?: number
    id_proveedor?: number
    estado?: EstadoPresupuesto
  }): Promise<ApiResponse<Presupuesto[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('presupuestos')
          .select(`
            *,
            items:presupuestos_items(*),
            proveedor:proveedores(*)
          `)
          .order('fecha_solicitud', { ascending: false })

        if (filters?.id_pedido_compra) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }
        if (filters?.id_proveedor) {
          query = query.eq('id_proveedor', filters.id_proveedor)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as Presupuesto[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarPresupuesto(id: number, updates: {
    estado?: EstadoPresupuesto
    fecha_recepcion?: string
    fecha_aceptacion?: string
    archivo_adjunto_url?: string
    observaciones?: string
  }): Promise<ApiResponse<Presupuesto>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('presupuestos')
          .update(updates)
          .eq('id', id)
          .select(`
            *,
            items:presupuestos_items(*),
            proveedor:proveedores(*)
          `)
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Presupuesto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async compararPresupuestos(idPedidoCompra: number, comparacion: {
    id_presupuesto_seleccionado: number
    notas_comparacion?: string
    criterio_seleccion?: string
  }): Promise<ApiResponse<ComparacionPresupuestos>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        const { data, error } = await supabase
          .from('comparacion_presupuestos')
          .insert({
            id_pedido_compra: idPedidoCompra,
            id_presupuesto_seleccionado: comparacion.id_presupuesto_seleccionado,
            notas_comparacion: comparacion.notas_comparacion || null,
            criterio_seleccion: comparacion.criterio_seleccion || null,
            id_usuario_comparador: usuario?.id || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }

        // Actualizar el presupuesto seleccionado a "Aceptado"
        await supabase
          .from('presupuestos')
          .update({ estado: 'Aceptado', fecha_aceptacion: new Date().toISOString() })
          .eq('id', comparacion.id_presupuesto_seleccionado)

        return { success: true, data: data as ComparacionPresupuestos }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== CONCILIACIÓN BANCARIA =====
  async crearPago(pago: {
    id_pedido_compra?: number
    id_proveedor?: number
    monto_total: number
    moneda: string
    fecha_vencimiento?: string
    metodo_pago?: string
    banco?: string
    cuenta_bancaria?: string
    observaciones?: string
  }): Promise<ApiResponse<Pago>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        // Generar número de pago
        const { data: ultimoPago } = await supabase
          .from('pagos')
          .select('numero_pago')
          .order('id', { ascending: false })
          .limit(1)
          .single()

        let numeroPago = 'PAG-0001'
        if (ultimoPago?.numero_pago) {
          const ultimoNumero = parseInt(ultimoPago.numero_pago.split('-')[1])
          numeroPago = `PAG-${String(ultimoNumero + 1).padStart(4, '0')}`
        }

        const { data, error } = await supabase
          .from('pagos')
          .insert({
            numero_pago: numeroPago,
            id_pedido_compra: pago.id_pedido_compra || null,
            id_proveedor: pago.id_proveedor || null,
            monto_total: pago.monto_total,
            monto_pagado: 0,
            moneda: pago.moneda,
            fecha_vencimiento: pago.fecha_vencimiento || null,
            metodo_pago: pago.metodo_pago || null,
            banco: pago.banco || null,
            cuenta_bancaria: pago.cuenta_bancaria || null,
            estado: 'Pendiente',
            observaciones: pago.observaciones || null,
            id_usuario_registro: usuario?.id || null,
            nombre_usuario_registro: usuario?.nombre || null
          })
          .select(`
            *,
            pedido:pedidos_compras(*),
            proveedor:proveedores(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Pago }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPagos(filters?: {
    id_pedido_compra?: number
    id_proveedor?: number
    estado?: EstadoPago
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<Pago[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('pagos')
          .select(`
            *,
            pedido:pedidos_compras(*),
            proveedor:proveedores(*)
          `)
          .order('created_at', { ascending: false })

        if (filters?.id_pedido_compra) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }
        if (filters?.id_proveedor) {
          query = query.eq('id_proveedor', filters.id_proveedor)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.fecha_desde) {
          query = query.gte('created_at', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('created_at', filters.fecha_hasta)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Pago[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarPago(id: number, updates: {
    monto_pagado?: number
    fecha_pago?: string
    numero_comprobante?: string
    estado?: EstadoPago
    fecha_conciliacion?: string
    observaciones?: string
  }): Promise<ApiResponse<Pago>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        const updateData: any = { ...updates }
        if (updates.fecha_conciliacion && usuario) {
          updateData.id_usuario_conciliacion = usuario.id
        }

        const { data, error } = await supabase
          .from('pagos')
          .update(updateData)
          .eq('id', id)
          .select(`
            *,
            pedido:pedidos_compras(*),
            proveedor:proveedores(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Pago }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearMovimientoBancario(movimiento: {
    fecha_movimiento: string
    fecha_valor?: string
    tipo: 'Ingreso' | 'Egreso'
    concepto: string
    monto: number
    moneda: string
    banco: string
    cuenta_bancaria: string
    numero_comprobante?: string
    referencia?: string
    id_pago_asociado?: number
    observaciones?: string
  }): Promise<ApiResponse<MovimientoBancario>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('movimientos_bancarios')
          .insert({
            ...movimiento,
            conciliado: false
          })
          .select(`
            *,
            pago:pagos(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as MovimientoBancario }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getMovimientosBancarios(filters?: {
    banco?: string
    cuenta_bancaria?: string
    conciliado?: boolean
    fecha_desde?: string
    fecha_hasta?: string
    tipo?: 'Ingreso' | 'Egreso'
  }): Promise<ApiResponse<MovimientoBancario[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('movimientos_bancarios')
          .select(`
            *,
            pago:pagos(*)
          `)
          .order('fecha_movimiento', { ascending: false })

        if (filters?.banco) {
          query = query.eq('banco', filters.banco)
        }
        if (filters?.cuenta_bancaria) {
          query = query.eq('cuenta_bancaria', filters.cuenta_bancaria)
        }
        if (filters?.conciliado !== undefined) {
          query = query.eq('conciliado', filters.conciliado)
        }
        if (filters?.fecha_desde) {
          query = query.gte('fecha_movimiento', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('fecha_movimiento', filters.fecha_hasta)
        }
        if (filters?.tipo) {
          query = query.eq('tipo', filters.tipo)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as MovimientoBancario[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async conciliarMovimiento(idMovimiento: number, idPago: number): Promise<ApiResponse<MovimientoBancario>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        const { data, error } = await supabase
          .from('movimientos_bancarios')
          .update({
            id_pago_asociado: idPago,
            conciliado: true,
            fecha_conciliacion: new Date().toISOString(),
            id_usuario_conciliacion: usuario?.id || null
          })
          .eq('id', idMovimiento)
          .select(`
            *,
            pago:pagos(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }

        // Actualizar el estado del pago si corresponde
        const { data: pagoData } = await supabase
          .from('pagos')
          .select('monto_total, monto_pagado')
          .eq('id', idPago)
          .single()

        if (pagoData && data) {
          const nuevoMontoPagado = (pagoData.monto_pagado || 0) + data.monto
          const nuevoEstado: EstadoPago = nuevoMontoPagado >= pagoData.monto_total ? 'Completado' : nuevoMontoPagado > 0 ? 'Parcial' : 'Pendiente'

          await supabase
            .from('pagos')
            .update({
              monto_pagado: nuevoMontoPagado,
              estado: nuevoEstado,
              fecha_pago: nuevoEstado === 'Completado' ? new Date().toISOString() : null,
              fecha_conciliacion: new Date().toISOString(),
              id_usuario_conciliacion: usuario?.id || null
            })
            .eq('id', idPago)
        }

        return { success: true, data: data as MovimientoBancario }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearConciliacion(conciliacion: {
    fecha_desde: string
    fecha_hasta: string
    banco: string
    cuenta_bancaria: string
    saldo_inicial: number
    observaciones?: string
  }): Promise<ApiResponse<ConciliacionBancaria>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        // Obtener movimientos del período
        const { data: movimientos } = await supabase
          .from('movimientos_bancarios')
          .select('*')
          .eq('banco', conciliacion.banco)
          .eq('cuenta_bancaria', conciliacion.cuenta_bancaria)
          .gte('fecha_movimiento', conciliacion.fecha_desde)
          .lte('fecha_movimiento', conciliacion.fecha_hasta)

        const totalIngresos = movimientos?.filter(m => m.tipo === 'Ingreso').reduce((sum, m) => sum + m.monto, 0) || 0
        const totalEgresos = movimientos?.filter(m => m.tipo === 'Egreso').reduce((sum, m) => sum + m.monto, 0) || 0
        const saldoFinal = conciliacion.saldo_inicial + totalIngresos - totalEgresos
        const movimientosConciliados = movimientos?.filter(m => m.conciliado).length || 0
        const movimientosPendientes = movimientos?.filter(m => !m.conciliado).length || 0

        const { data, error } = await supabase
          .from('conciliaciones_bancarias')
          .insert({
            fecha_conciliacion: new Date().toISOString(),
            fecha_desde: conciliacion.fecha_desde,
            fecha_hasta: conciliacion.fecha_hasta,
            banco: conciliacion.banco,
            cuenta_bancaria: conciliacion.cuenta_bancaria,
            saldo_inicial: conciliacion.saldo_inicial,
            saldo_final: saldoFinal,
            total_ingresos: totalIngresos,
            total_egresos: totalEgresos,
            movimientos_conciliados: movimientosConciliados,
            movimientos_pendientes: movimientosPendientes,
            id_usuario: usuario?.id || null,
            nombre_usuario: usuario?.nombre || null,
            observaciones: conciliacion.observaciones || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ConciliacionBancaria }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getConciliaciones(filters?: {
    banco?: string
    cuenta_bancaria?: string
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<ConciliacionBancaria[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('conciliaciones_bancarias')
          .select('*')
          .order('fecha_conciliacion', { ascending: false })

        if (filters?.banco) {
          query = query.eq('banco', filters.banco)
        }
        if (filters?.cuenta_bancaria) {
          query = query.eq('cuenta_bancaria', filters.cuenta_bancaria)
        }
        if (filters?.fecha_desde) {
          query = query.gte('fecha_conciliacion', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('fecha_conciliacion', filters.fecha_hasta)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ConciliacionBancaria[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== CONCILIACIÓN PLOTAI REPORTES (extracto vs pagos) =====
  async crearConciliacionPlotAIReporte(input: {
    fecha_desde: string
    fecha_hasta: string
    banco?: string
    cuenta_bancaria?: string
    estado: 'saldado' | 'incongruencias'
    resumen: any
    incongruencias: string[]
    recomendaciones_md?: string
  }): Promise<ApiResponse<ConciliacionPlotAIReporte>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const usuarioStr = localStorage.getItem('usuario')
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null
      const { data, error } = await supabase
        .from('conciliacion_plotai_reportes')
        .insert({
          created_by_user_id: usuario?.id || null,
          created_by_user_name: usuario?.nombre || null,
          fecha_desde: input.fecha_desde,
          fecha_hasta: input.fecha_hasta,
          banco: input.banco || null,
          cuenta_bancaria: input.cuenta_bancaria || null,
          estado: input.estado,
          resumen: input.resumen ?? {},
          incongruencias: input.incongruencias ?? [],
          recomendaciones_md: input.recomendaciones_md || null
        })
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ConciliacionPlotAIReporte }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error guardando reporte PlotAI' }
    }
  }

  async getConciliacionPlotAIReportes(filters?: {
    fecha_desde?: string
    fecha_hasta?: string
    banco?: string
    cuenta_bancaria?: string
    limit?: number
  }): Promise<ApiResponse<ConciliacionPlotAIReporte[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      let query = supabase
        .from('conciliacion_plotai_reportes')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.fecha_desde) query = query.gte('fecha_desde', filters.fecha_desde)
      if (filters?.fecha_hasta) query = query.lte('fecha_hasta', filters.fecha_hasta)
      if (filters?.banco) query = query.eq('banco', filters.banco)
      if (filters?.cuenta_bancaria) query = query.eq('cuenta_bancaria', filters.cuenta_bancaria)
      query = query.limit(filters?.limit ?? 50)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as ConciliacionPlotAIReporte[] }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error listando reportes PlotAI' }
    }
  }

  // ===== CONCILIACIÓN MERCADO PAGO (sesiones + IA Gemini) =====
  async crearConciliacionMpSession(input: {
    bank_file_name: string
    mp_file_name: string
    bank_sheet_name?: string | null
    mp_sheet_name?: string | null
    rules_snapshot: Record<string, unknown>
    bank_movements: unknown[]
    mp_movements: unknown[]
    heuristic_matches: unknown[]
    metrics: Record<string, unknown>
    status?: 'draft' | 'ready' | 'error'
  }): Promise<ApiResponse<ConciliacionMpSession>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const usuarioStr = localStorage.getItem('usuario')
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null
      const { data, error } = await supabase
        .from('conciliacion_mp_sessions')
        .insert({
          created_by_user_id: usuario?.id || null,
          created_by_user_name: usuario?.nombre || null,
          bank_file_name: input.bank_file_name,
          mp_file_name: input.mp_file_name,
          bank_sheet_name: input.bank_sheet_name ?? null,
          mp_sheet_name: input.mp_sheet_name ?? null,
          rules_snapshot: input.rules_snapshot,
          bank_movements: input.bank_movements,
          mp_movements: input.mp_movements,
          heuristic_matches: input.heuristic_matches,
          metrics: input.metrics,
          status: input.status ?? 'ready'
        })
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ConciliacionMpSession }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error guardando sesión MP' }
    }
  }

  async getConciliacionMpSessions(limit = 30): Promise<ApiResponse<ConciliacionMpSession[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase
        .from('conciliacion_mp_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data || []) as ConciliacionMpSession[] }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error listando sesiones MP' }
    }
  }

  async registrarConciliacionMpAiRun(input: {
    session_id: string
    scope?: string
    input_payload: Record<string, unknown>
    output_payload: Record<string, unknown>
  }): Promise<ApiResponse<ConciliacionMpAiRun>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const usuarioStr = localStorage.getItem('usuario')
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null
      const { data, error } = await supabase
        .from('conciliacion_mp_ai_runs')
        .insert({
          session_id: input.session_id,
          created_by_user_id: usuario?.id || null,
          scope: input.scope ?? 'unmatched',
          input_payload: input.input_payload,
          output_payload: input.output_payload,
          provider: 'gemini'
        })
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ConciliacionMpAiRun }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error guardando análisis IA' }
    }
  }

  // ===== HISTORIAL ETAPAS TALLER GRÁFICO =====
  async obtenerHistorialEtapasInstalaciones(idOrden: number): Promise<ApiResponse<HistorialEtapaInstalaciones[]>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_historial_etapas_instalaciones', {
        p_id_orden: idOrden
      })

      if (error) {
        console.error('Error obteniendo historial de etapas de instalaciones:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as HistorialEtapaInstalaciones[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async obtenerHistorialEtapasTallerGrafico(idOrden: number): Promise<ApiResponse<HistorialEtapaTallerGrafico[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_historial_etapas_taller_grafico', {
          p_id_orden: idOrden
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as HistorialEtapaTallerGrafico[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerHistorialEtapasTallerImprenta(idOrden: number): Promise<ApiResponse<HistorialEtapaTallerImprenta[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_historial_etapas_taller_imprenta', {
          p_id_orden: idOrden
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as HistorialEtapaTallerImprenta[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerHistorialEtapasMetalurgica(idOrden: number): Promise<ApiResponse<HistorialEtapaMetalurgica[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_historial_etapas_metalurgica', {
          p_id_orden: idOrden
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as HistorialEtapaMetalurgica[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaTallerGrafico(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const etapaGuard = await this.assertOpNotLockedForMutation(ordenId)
        if (!etapaGuard.ok) return { success: false, error: etapaGuard.error }

        // Obtener etapa anterior
        const { data: ordenAnterior } = await supabase
          .from('ordenes_trabajo')
          .select('etapa_taller_grafico, estado')
          .eq('id', ordenId)
          .maybeSingle()
        
        const etapaAnterior = ordenAnterior?.etapa_taller_grafico || null
        const estadoActual = ordenAnterior?.estado || null
        
        const { error } = await supabase.rpc('actualizar_etapa_taller_grafico', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }

        // Si se marca como finalizado TG, también pasar a "Finalizado en Taller" (tablero general)
        if (nuevaEtapa === 'FINALIZADO TG') {
          const { error: updateEstadoError } = await supabase
            .from('ordenes_trabajo')
            .update({ estado: 'Finalizado en Taller' })
            .eq('id', ordenId)

          if (updateEstadoError) return { success: false, error: updateEstadoError.message }

          await this.registrarCambioHistorial(
            ordenId,
            estadoActual,
            'Finalizado en Taller',
            'Taller Gráfico finalizado (FINALIZADO TG)'
          )
        }
        
        // Registrar cambio de etapa en historial_movimientos
        await this.registrarCambioHistorial(
          ordenId,
          estadoActual,
          estadoActual, // El estado no cambia, solo la etapa
          `Etapa Taller Gráfico: ${etapaAnterior || 'N/A'} → ${nuevaEtapa}`
        )
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaInstalaciones(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const etapaGuard = await this.assertOpNotLockedForMutation(ordenId)
        if (!etapaGuard.ok) return { success: false, error: etapaGuard.error }

        // Obtener etapa anterior
        const { data: ordenAnterior } = await supabase
          .from('ordenes_trabajo')
          .select('etapa_instalaciones, estado')
          .eq('id', ordenId)
          .maybeSingle()
        
        const etapaAnterior = ordenAnterior?.etapa_instalaciones || null
        const estadoActual = ordenAnterior?.estado || null
        
        const { error } = await supabase.rpc('actualizar_etapa_instalaciones', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Registrar cambio de etapa en historial_movimientos (AUDITORÍA PROFESIONAL)
        await this.registrarCambioHistorial(
          ordenId,
          estadoActual,
          estadoActual, // El estado no cambia, solo la etapa
          `Etapa Instalaciones: ${etapaAnterior || 'N/A'} → ${nuevaEtapa}`,
          'cambio_etapa',
          {
            etapa_instalaciones: {
              anterior: etapaAnterior,
              nuevo: nuevaEtapa
            },
            sector: 'Instalaciones'
          }
        )
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaTallerImprenta(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const etapaGuard = await this.assertOpNotLockedForMutation(ordenId)
        if (!etapaGuard.ok) return { success: false, error: etapaGuard.error }

        // Obtener etapa anterior
        const { data: ordenAnterior } = await supabase
          .from('ordenes_trabajo')
          .select('etapa_taller_imprenta, estado')
          .eq('id', ordenId)
          .maybeSingle()
        
        const etapaAnterior = ordenAnterior?.etapa_taller_imprenta || null
        const estadoActual = ordenAnterior?.estado || null
        
        const { error } = await supabase.rpc('actualizar_etapa_taller_imprenta', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Registrar cambio de etapa en historial_movimientos (AUDITORÍA PROFESIONAL)
        await this.registrarCambioHistorial(
          ordenId,
          estadoActual,
          estadoActual, // El estado no cambia, solo la etapa
          `Etapa Taller Imprenta: ${etapaAnterior || 'N/A'} → ${nuevaEtapa}`,
          'cambio_etapa',
          {
            etapa_taller_imprenta: {
              anterior: etapaAnterior,
              nuevo: nuevaEtapa
            },
            sector: 'Taller de Imprenta'
          }
        )
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaImpresionDigital(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<{ etapa_impresion_digital: string | null; etapa_impresion_digital_fecha_inicio: string | null }>> {
    if (supabase) {
      try {
        const etapaGuard = await this.assertOpNotLockedForMutation(ordenId)
        if (!etapaGuard.ok) return { success: false, error: etapaGuard.error }

        const { data, error } = await supabase.rpc('actualizar_etapa_impresion_digital', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })
        if (error) return { success: false, error: error.message }
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null
        return {
          success: true,
          data: row
            ? {
                etapa_impresion_digital: row.etapa_impresion_digital ?? null,
                etapa_impresion_digital_fecha_inicio: row.etapa_impresion_digital_fecha_inicio ?? null
              }
            : { etapa_impresion_digital: null, etapa_impresion_digital_fecha_inicio: null }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaMetalurgica(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const etapaGuard = await this.assertOpNotLockedForMutation(ordenId)
        if (!etapaGuard.ok) return { success: false, error: etapaGuard.error }

        // Obtener etapa anterior
        const { data: ordenAnterior } = await supabase
          .from('ordenes_trabajo')
          .select('etapa_metalurgica, estado')
          .eq('id', ordenId)
          .maybeSingle()
        
        const etapaAnterior = ordenAnterior?.etapa_metalurgica || null
        const estadoActual = ordenAnterior?.estado || null
        
        const { error } = await supabase.rpc('actualizar_etapa_metalurgica', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Registrar cambio de etapa en historial_movimientos (AUDITORÍA PROFESIONAL)
        await this.registrarCambioHistorial(
          ordenId,
          estadoActual,
          estadoActual, // El estado no cambia, solo la etapa
          `Etapa Metalúrgica: ${etapaAnterior || 'N/A'} → ${nuevaEtapa}`,
          'cambio_etapa',
          {
            etapa_metalurgica: {
              anterior: etapaAnterior,
              nuevo: nuevaEtapa
            },
            sector: 'Metalúrgica'
          }
        )
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ============================================
  // SISTEMA DE PEDIDOS WEB
  // ============================================

  /**
   * Autenticar cliente web
   */
  async autenticarClienteWeb(usuario: string, password: string): Promise<ApiResponse<ClienteWebRecord>> {
    if (supabase) {
      try {
        console.log('Intentando autenticar cliente:', usuario)
        const { data, error } = await supabase.rpc('autenticar_cliente', {
          p_usuario: usuario,
          p_password: password
        })

        console.log('Respuesta RPC:', { data, error })

        if (error) {
          console.error('Error en RPC:', error)
          return { success: false, error: error.message || 'Error al autenticar' }
        }
        
        if (!data || data.length === 0) {
          return { success: false, error: 'Usuario o contraseña incorrectos' }
        }

        // La función SQL retorna campos limitados, necesitamos obtener el registro completo
        const clienteData = data[0]
        console.log('Datos recibidos de autenticar_cliente:', clienteData)
        
        // Obtener el registro completo con todos los campos incluyendo 'activo'
        if (supabase && clienteData.id) {
        const { data: clienteCompleto, error: errorCompleto } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', clienteData.id)
          .eq('es_cliente_web', true)
          .single()
          
          if (errorCompleto) {
            console.error('Error obteniendo cliente completo:', errorCompleto)
            // Si falla, usar los datos básicos y asumir activo=true
            return { 
              success: true, 
              data: { ...clienteData, activo: true } as ClienteWebRecord 
            }
          }
          
          if (clienteCompleto) {
            return { success: true, data: clienteCompleto as ClienteWebRecord }
          }
        }

        // Fallback: usar datos básicos con activo=true
        return { 
          success: true, 
          data: { ...clienteData, activo: true } as ClienteWebRecord 
        }
      } catch (error) {
        console.error('Excepción en autenticarClienteWeb:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear cliente web (solo trabajadores)
   */
  async crearClienteWeb(cliente: {
    usuario: string
    password: string
    nombre: string
    apellido?: string
    empresa?: string
    telefono?: string
    email?: string
    dni_cuit?: string
    direccion?: string
  }): Promise<ApiResponse<ClienteWebRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_cliente', {
          p_usuario: cliente.usuario,
          p_password: cliente.password,
          p_nombre: cliente.nombre,
          p_apellido: cliente.apellido || null,
          p_empresa: cliente.empresa || null,
          p_telefono: cliente.telefono || null,
          p_email: cliente.email || null,
          p_dni_cuit: cliente.dni_cuit || null,
          p_direccion: cliente.direccion || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el cliente' }
        }

        return { success: true, data: data[0] as ClienteWebRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar cliente web (solo trabajadores)
   */
  async actualizarClienteWeb(
    id: number,
    cliente: {
      password?: string
      nombre?: string
      apellido?: string
      empresa?: string
      telefono?: string
      email?: string
      dni_cuit?: string
      direccion?: string
      activo?: boolean
    }
  ): Promise<ApiResponse<ClienteWebRecord>> {
    if (supabase) {
      try {
        // Construir objeto de parámetros solo con los campos que se proporcionaron
        const params: Record<string, any> = {
          p_id: id
        }
        
        if (cliente.password !== undefined) params.p_password = cliente.password || null
        if (cliente.nombre !== undefined) params.p_nombre = cliente.nombre || null
        if (cliente.apellido !== undefined) params.p_apellido = cliente.apellido || null
        if (cliente.empresa !== undefined) params.p_empresa = cliente.empresa || null
        if (cliente.telefono !== undefined) params.p_telefono = cliente.telefono || null
        if (cliente.email !== undefined) params.p_email = cliente.email || null
        if (cliente.dni_cuit !== undefined) params.p_dni_cuit = cliente.dni_cuit || null
        if (cliente.direccion !== undefined) params.p_direccion = cliente.direccion || null
        if (cliente.activo !== undefined) params.p_activo = cliente.activo

        console.log('Llamando a actualizar_cliente con params:', params)
        const { data, error } = await supabase.rpc('actualizar_cliente', params)

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el cliente' }
        }

        return { success: true, data: data[0] as ClienteWebRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener todos los clientes web (solo trabajadores)
   * Ahora usa la tabla unificada clientes con es_cliente_web = true
   */
  async getClientesWeb(): Promise<ApiResponse<ClienteWebRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('es_cliente_web', true)
          .order('created_at', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ClienteWebRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Ficha de cliente por id (catálogo unificado).
   */
  async getClientePorId(id: number): Promise<ApiResponse<ClienteRecord | null>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    if (!Number.isFinite(id) || id <= 0) return { success: false, error: 'ID inválido' }
    try {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle()
      if (error) return { success: false, error: error.message }
      if (!data) return { success: true, data: null }
      return { success: true, data: data as ClienteRecord }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al cargar cliente' }
    }
  }

  /**
   * Obtener todos los clientes (con y sin acceso web)
   */
  async getClientes(
    todos?: boolean,
    options?: { limit?: number }
  ): Promise<ApiResponse<ClienteRecord[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const limite = Math.min(Math.max(options?.limit ?? 2500, 1), 5000)
      let query = supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true })
        .limit(limite)
      if (!todos) {
        query = query.eq('es_cliente_web', true)
      }
      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as ClienteRecord[]) ?? [] }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar clientes' }
    }
  }

  /** Clientes sin acceso al portal (solo ficha). */
  async getClientesSinPortal(options?: { limit?: number }): Promise<ApiResponse<ClienteRecord[]>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const limite = Math.min(Math.max(options?.limit ?? 2500, 1), 5000)
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('es_cliente_web', false)
        .order('nombre', { ascending: true })
        .limit(limite)
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as ClienteRecord[]) ?? [] }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al listar clientes sin portal' }
    }
  }

  /**
   * Crear cliente sin acceso web (solo datos)
   */
  async crearClienteSinAcceso(cliente: {
    nombre: string
    apellido?: string
    empresa?: string
    telefono?: string
    email?: string
    dni_cuit?: string
    direccion?: string
  }): Promise<ApiResponse<ClienteRecord>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('crear_cliente_sin_acceso', {
        p_nombre: cliente.nombre,
        p_apellido: cliente.apellido || null,
        p_empresa: cliente.empresa || null,
        p_telefono: cliente.telefono || null,
        p_email: cliente.email || null,
        p_dni_cuit: cliente.dni_cuit || null,
        p_direccion: cliente.direccion || null
      })
      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) return { success: false, error: 'No se pudo crear el cliente' }
      const created = data[0] as { id: number }
      const { data: full } = await supabase.from('clientes').select('*').eq('id', created.id).single()
      return { success: true, data: full as ClienteRecord }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al crear cliente' }
    }
  }

  /**
   * Habilitar acceso web a un cliente existente (dar usuario y contraseña)
   */
  async habilitarAccesoCliente(id: number, usuario: string, password: string): Promise<ApiResponse<ClienteRecord>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('habilitar_acceso_cliente', {
        p_id: id,
        p_usuario: usuario.trim(),
        p_password: password
      })
      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) return { success: false, error: 'No se pudo habilitar acceso' }
      const { data: full } = await supabase.from('clientes').select('*').eq('id', id).single()
      return { success: true, data: full as ClienteRecord }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al habilitar acceso' }
    }
  }

  /**
   * Quitar acceso web a un cliente (sin borrarlo)
   */
  async quitarAccesoCliente(id: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { error } = await supabase.rpc('quitar_acceso_cliente', { p_id: id })
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al quitar acceso' }
    }
  }

  /**
   * Actualizar datos de un cliente (cualquiera, con o sin acceso web)
   */
  async actualizarClienteDatos(
    id: number,
    datos: { nombre?: string; apellido?: string; empresa?: string; telefono?: string; email?: string; dni_cuit?: string; direccion?: string }
  ): Promise<ApiResponse<ClienteRecord>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (datos.nombre !== undefined) payload.nombre = datos.nombre
      if (datos.apellido !== undefined) payload.apellido = datos.apellido
      if (datos.empresa !== undefined) payload.empresa = datos.empresa
      if (datos.telefono !== undefined) payload.telefono = datos.telefono
      if (datos.email !== undefined) payload.email = datos.email
      if (datos.dni_cuit !== undefined) payload.dni_cuit = datos.dni_cuit
      if (datos.direccion !== undefined) payload.direccion = datos.direccion
      const { error } = await supabase.from('clientes').update(payload).eq('id', id)
      if (error) return { success: false, error: error.message }
      const { data } = await supabase.from('clientes').select('*').eq('id', id).single()
      return { success: true, data: data as ClienteRecord }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al actualizar cliente' }
    }
  }

  /**
   * Obtener artículos de empresa (catálogo)
   */
  async getArticulosEmpresa(
    visibleClientes?: boolean,
    incluirInactivos?: boolean,
    canal?: CanalComercialCatalogo
  ): Promise<ApiResponse<ArticuloEmpresaRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('articulos_empresa')
          .select('*')
          .order('nombre', { ascending: true })

        if (!incluirInactivos) {
          query = query.eq('activo', true)
        }

        if (canal && COLUMNA_VISIBILIDAD_POR_CANAL[canal]) {
          query = query.eq(COLUMNA_VISIBILIDAD_POR_CANAL[canal], true)
        } else if (visibleClientes !== undefined) {
          query = query.eq('visible_clientes', visibleClientes)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }

        const rows = (data || []) as ArticuloEmpresaRecord[]
        if (stockSupabase && rows.some((r) => r.id_articulo_stock)) {
          const enriched = await Promise.all(
            rows.map(async (row) => {
              if (!row.id_articulo_stock) return row
              const st = await obtenerStockArticulo(row.id_articulo_stock)
              return {
                ...row,
                stock_disponible: st.success && st.data ? st.data.stock : null
              }
            })
          )
          return { success: true, data: enriched }
        }

        return { success: true, data: rows }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Catálogo comercial por canal con stock disponible y búsqueda opcional.
   */
  async getCatalogoComercial(params: {
    canal: CanalComercialCatalogo
    busqueda?: string
    pagina?: number
    limite?: number
    categoria?: string
  }): Promise<ApiResponse<{ items: ArticuloEmpresaRecord[]; total: number }>> {
    const { canal, busqueda, categoria } = params
    const pagina = Math.max(1, params.pagina ?? 1)
    const limite = Math.min(500, Math.max(1, params.limite ?? 200))

    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }

    try {
      const colCanal = COLUMNA_VISIBILIDAD_POR_CANAL[canal]
      let query = supabase
        .from('articulos_empresa')
        .select('*', { count: 'exact' })
        .eq('activo', true)
        .eq(colCanal, true)
        .order('nombre', { ascending: true })

      const q = busqueda?.trim()
      if (q) {
        const term = this.escapeIlikeCliente(q)
        query = query.or(
          `nombre.ilike.%${term}%,descripcion.ilike.%${term}%,codigo.ilike.%${term}%`
        )
      }
      if (categoria?.trim()) {
        query = query.eq('categoria', categoria.trim())
      }

      const from = (pagina - 1) * limite
      const to = from + limite - 1
      const { data, error, count } = await query.range(from, to)

      if (error) return { success: false, error: error.message }

      const rows = (data || []) as ArticuloEmpresaRecord[]
      let items = rows

      if (stockSupabase && rows.some((r) => r.id_articulo_stock)) {
        items = await Promise.all(
          rows.map(async (row) => {
            if (!row.id_articulo_stock) return row
            const st = await obtenerStockArticulo(row.id_articulo_stock)
            return {
              ...row,
              stock_disponible: st.success && st.data ? st.data.stock : null
            }
          })
        )
      }

      return { success: true, data: { items, total: count ?? items.length } }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error al cargar catálogo comercial'
      }
    }
  }

  /** Valida cantidad contra stock del catálogo (usa helpers de commerceCatalogService). */
  validarStockCatalogoComercial(articulo: ArticuloEmpresaRecord, cantidad: number) {
    return validarCantidadVentaComercial(articulo, cantidad)
  }

  async getCarritoCliente(idCliente: number): Promise<ApiResponse<CarritoClientePayload>> {
    const r = await obtenerCarritoCliente(idCliente)
    return r.success && r.data
      ? { success: true, data: r.data }
      : { success: false, error: r.error || 'Error al cargar carrito' }
  }

  async setCarritoItemCliente(
    idCliente: number,
    idArticulo: number,
    cantidad: number
  ): Promise<ApiResponse<CarritoClientePayload>> {
    const r = await setCarritoItemCliente(idCliente, idArticulo, cantidad)
    return r.success && r.data
      ? { success: true, data: r.data }
      : { success: false, error: r.error || 'Error al actualizar carrito' }
  }

  async vaciarCarritoCliente(idCliente: number): Promise<ApiResponse<void>> {
    const r = await vaciarCarritoCliente(idCliente)
    return r.success ? { success: true } : { success: false, error: r.error }
  }

  /**
   * Campos comercio omnicanal (stock, canales, modo venta).
   * Requiere migración 2026-05-26_comercio_omnicanal_fase0_articulos_empresa.sql
   */
  async actualizarCamposComercioArticuloEmpresa(
    id: number,
    campos: CamposComercioArticuloEmpresa
  ): Promise<ApiResponse<ArticuloEmpresaRecord>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const payload: Record<string, unknown> = { ...campos }
      if (campos.visible_portal !== undefined) {
        payload.visible_clientes = campos.visible_clientes ?? campos.visible_portal
      }
      const { data, error } = await supabase
        .from('articulos_empresa')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ArticuloEmpresaRecord }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error al actualizar comercio'
      }
    }
  }

  /** Descuenta stock de todos los ítems de un pedido que apliquen (compra + controla_stock). */
  async aplicarStockPedidoCliente(
    idPedido: number,
    canal: CanalComercial = 'sistema',
    options?: { permitirStockNegativo?: boolean; enConversionOp?: boolean }
  ): Promise<ApiResponse<{ descontados: number; errores: string[] }>> {
    const r = await aplicarStockDesdePedidoCliente(idPedido, canal, options)
    return {
      success: r.success,
      data: { descontados: r.descontados, errores: r.errores },
      error: r.errores.length ? r.errores.join('; ') : undefined
    }
  }

  async descontarStockComercialArticulo(
    input: Parameters<typeof descontarStockComercial>[0]
  ) {
    return descontarStockComercial(input)
  }

  /**
   * Obtener categorías de artículos
   */
  async obtenerCategoriasArticulos(): Promise<ApiResponse<string[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_categorias_articulos')

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []).map((item: any) => item.categoria) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener subcategorías de una categoría
   */
  async obtenerSubcategoriasArticulos(categoria: string): Promise<ApiResponse<string[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_subcategorias_articulos', {
          p_categoria: categoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []).map((item: any) => item.subcategoria) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Guardar categoría automáticamente
   */
  async guardarCategoriaArticulo(categoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('guardar_categoria_articulo', {
          p_categoria: categoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Guardar subcategoría automáticamente
   */
  async guardarSubcategoriaArticulo(categoria: string, subcategoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('guardar_subcategoria_articulo', {
          p_categoria: categoria,
          p_subcategoria: subcategoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar categoría
   */
  async eliminarCategoriaArticulo(categoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_categoria_articulo', {
          p_categoria: categoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar nombre de categoría
   */
  async actualizarCategoriaArticulo(categoriaAntigua: string, categoriaNueva: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_categoria_articulo', {
          p_categoria_antigua: categoriaAntigua,
          p_categoria_nueva: categoriaNueva
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar subcategoría
   */
  async eliminarSubcategoriaArticulo(categoria: string, subcategoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_subcategoria_articulo', {
          p_categoria: categoria,
          p_subcategoria: subcategoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar nombre de subcategoría
   */
  async actualizarSubcategoriaArticulo(
    categoria: string,
    subcategoriaAntigua: string,
    subcategoriaNueva: string
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_subcategoria_articulo', {
          p_categoria: categoria,
          p_subcategoria_antigua: subcategoriaAntigua,
          p_subcategoria_nueva: subcategoriaNueva
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Generar código automático para artículo
   */
  async generarCodigoArticulo(): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('generar_codigo_articulo_empresa')

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as string }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear artículo de empresa
   */
  async crearArticuloEmpresa(articulo: {
    codigo?: string
    nombre: string
    descripcion?: string
    categoria?: string
    subcategoria?: string
    precio_base?: number
    imagen_url?: string
    tiempo_estimado_dias?: number
    requiere_archivos?: boolean
    visible_clientes?: boolean
  }): Promise<ApiResponse<ArticuloEmpresaRecord>> {
    if (supabase) {
      try {
        // Generar código automático si no se proporciona
        let codigoFinal = articulo.codigo
        if (!codigoFinal) {
          const codigoResponse = await this.generarCodigoArticulo()
          if (!codigoResponse.success) {
            return { success: false, error: codigoResponse.error || 'Error al generar código' }
          }
          codigoFinal = codigoResponse.data!
        }

        // Guardar categoría automáticamente si se proporciona
        if (articulo.categoria) {
          await this.guardarCategoriaArticulo(articulo.categoria)
        }

        // Guardar subcategoría automáticamente si se proporciona
        if (articulo.categoria && articulo.subcategoria) {
          await this.guardarSubcategoriaArticulo(articulo.categoria, articulo.subcategoria)
        }

        const { data, error } = await supabase.rpc('crear_articulo_empresa', {
          p_codigo: codigoFinal,
          p_nombre: articulo.nombre,
          p_descripcion: articulo.descripcion || null,
          p_categoria: articulo.categoria || null,
          p_precio_base: articulo.precio_base || null,
          p_imagen_url: articulo.imagen_url || null,
          p_tiempo_estimado_dias: articulo.tiempo_estimado_dias || null,
          p_requiere_archivos: articulo.requiere_archivos || false,
          p_visible_clientes: articulo.visible_clientes !== undefined ? articulo.visible_clientes : true
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el artículo' }
        }

        // Obtener el artículo completo
        const { data: articuloCompleto, error: errorCompleto } = await supabase
          .from('articulos_empresa')
          .select('*')
          .eq('id', data[0].id)
          .single()

        if (errorCompleto) return { success: false, error: errorCompleto.message }
        return { success: true, data: articuloCompleto as ArticuloEmpresaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar artículo de empresa
   */
  async actualizarArticuloEmpresa(
    id: number,
    articulo: {
      codigo?: string
      nombre?: string
      descripcion?: string
      categoria?: string
      subcategoria?: string
      precio_base?: number
      imagen_url?: string
      tiempo_estimado_dias?: number
      requiere_archivos?: boolean
      visible_clientes?: boolean
      activo?: boolean
    }
  ): Promise<ApiResponse<ArticuloEmpresaRecord>> {
    if (supabase) {
      try {
        // Guardar categoría automáticamente si se proporciona
        if (articulo.categoria) {
          await this.guardarCategoriaArticulo(articulo.categoria)
        }

        // Guardar subcategoría automáticamente si se proporciona
        if (articulo.categoria && articulo.subcategoria) {
          await this.guardarSubcategoriaArticulo(articulo.categoria, articulo.subcategoria)
        }

        const { data, error } = await supabase.rpc('actualizar_articulo_empresa', {
          p_id: id,
          p_codigo: articulo.codigo || null,
          p_nombre: articulo.nombre || null,
          p_descripcion: articulo.descripcion || null,
          p_categoria: articulo.categoria || null,
          p_subcategoria: articulo.subcategoria || null,
          p_precio_base: articulo.precio_base || null,
          p_imagen_url: articulo.imagen_url || null,
          p_tiempo_estimado_dias: articulo.tiempo_estimado_dias || null,
          p_requiere_archivos: articulo.requiere_archivos !== undefined ? articulo.requiere_archivos : null,
          p_visible_clientes: articulo.visible_clientes !== undefined ? articulo.visible_clientes : null,
          p_activo: articulo.activo !== undefined ? articulo.activo : null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el artículo' }
        }

        // Obtener el artículo completo
        const { data: articuloCompleto, error: errorCompleto } = await supabase
          .from('articulos_empresa')
          .select('*')
          .eq('id', id)
          .single()

        if (errorCompleto) return { success: false, error: errorCompleto.message }
        return { success: true, data: articuloCompleto as ArticuloEmpresaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar precios de lista 1 (efectivo/débito) y lista 2 (cuenta corriente).
   */
  async actualizarPreciosListaArticulo(
    id: number,
    datos: {
      nombre?: string | null
      categoria?: string | null
      precio_lista_1?: number | null
      precio_lista_2?: number | null
      precio_lista_3?: number | null
      precio_lista_4?: number | null
      precio_lista_5?: number | null
    }
  ): Promise<ApiResponse<ArticuloEmpresaRecord>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const payload: Record<string, string | number | null> = {}
      if (datos.nombre !== undefined) payload.nombre = datos.nombre?.trim() || null
      if (datos.categoria !== undefined) payload.categoria = datos.categoria?.trim() || null
      for (const key of [
        'precio_lista_1',
        'precio_lista_2',
        'precio_lista_3',
        'precio_lista_4',
        'precio_lista_5'
      ] as const) {
        if (datos[key] !== undefined) payload[key] = datos[key]
      }
      if (datos.precio_lista_1 !== undefined) {
        payload.precio_base = datos.precio_lista_1
      }
      payload.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('articulos_empresa')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ArticuloEmpresaRecord }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getConfiguracionPreciosVentas(): Promise<
    ApiResponse<import('../constants/ventasListasPrecio').ConfigAjustesPreciosVentas>
  > {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { data, error } = await supabase.rpc('get_configuracion_precios_ventas')
      if (error) return { success: false, error: error.message }
      if (!data || typeof data !== 'object') {
        const { DEFAULT_AJUSTES_PRECIOS_VENTAS } = await import('../constants/ventasListasPrecio')
        return { success: true, data: DEFAULT_AJUSTES_PRECIOS_VENTAS }
      }
      const { normalizarConfigAjustesPrecios } = await import('../constants/ventasListasPrecio')
      return {
        success: true,
        data: normalizarConfigAjustesPrecios(data as import('../constants/ventasListasPrecio').ConfigAjustesPreciosVentas)
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async guardarConfiguracionPreciosVentas(
    config: import('../constants/ventasListasPrecio').ConfigAjustesPreciosVentas
  ): Promise<ApiResponse<import('../constants/ventasListasPrecio').ConfigAjustesPreciosVentas>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    try {
      const { normalizarConfigAjustesPrecios } = await import('../constants/ventasListasPrecio')
      const payload = normalizarConfigAjustesPrecios(config)
      const { data, error } = await supabase.rpc('guardar_configuracion_precios_ventas', {
        p_payload: payload
      })
      if (error) return { success: false, error: error.message }
      if (!data) return { success: false, error: 'No se recibió configuración guardada' }
      return { success: true, data: normalizarConfigAjustesPrecios(data as typeof config) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Eliminar artículo de empresa (marcar como inactivo)
   */
  async eliminarArticuloEmpresa(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_articulo_empresa', {
          p_id: id
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener imágenes de un artículo
   */
  async obtenerImagenesArticuloEmpresa(idArticulo: number): Promise<ApiResponse<ArticuloEmpresaImagenRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_imagenes_articulo_empresa', {
          p_id_articulo: idArticulo
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data || [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Agregar imagen a un artículo
   */
  async agregarImagenArticuloEmpresa(
    idArticulo: number,
    imagenUrl: string,
    orden?: number
  ): Promise<ApiResponse<ArticuloEmpresaImagenRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('agregar_imagen_articulo_empresa', {
          p_id_articulo: idArticulo,
          p_imagen_url: imagenUrl,
          p_orden: orden || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo agregar la imagen' }
        }
        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar imagen de un artículo
   */
  async eliminarImagenArticuloEmpresa(idImagen: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_imagen_articulo_empresa', {
          p_id_imagen: idImagen
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Subir imagen de artículo de empresa
   */
  async uploadImagenArticuloEmpresa(file: File, articuloId?: number): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = articuloId 
          ? `articulos-empresa/${articuloId}_${Date.now()}.${fileExt}`
          : `articulos-empresa/temp_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('archivos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || 'image/jpeg'
          })

        if (uploadError) {
          return { success: false, error: uploadError.message }
        }

        const { data: urlData } = supabase.storage
          .from('archivos')
          .getPublicUrl(fileName)

        if (!urlData?.publicUrl) {
          return { success: false, error: 'No se pudo obtener la URL pública' }
        }

        return { success: true, data: urlData.publicUrl }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear pedido de cliente
   */
  async crearPedidoCliente(pedido: {
    id_cliente: number
    fecha_limite_deseada?: string
    observaciones_cliente?: string
    items: Array<{
      id_articulo: number
      cantidad: number
      precio_unitario: number
      precio_total: number
      descripcion_personalizada?: string
    }>
    es_urgente?: boolean
    requiere_delivery?: boolean
    direccion_delivery?: string
    tipo_producto_servicio?: string[]
    tipo_producto_otro?: string
    necesita_asesoramiento?: boolean
    donde_colocados?: string
    digital_o_impresion?: string
    cantidades?: string
    objetivo_proyecto?: string
    material_logo?: string
    material_textos?: string
    material_imagenes?: string
    tiene_referencias?: boolean
    referencias_links?: string
    brief_publico?: string
    estilo_diseno?: string
    referencias?: string
    tipo_intencion?: 'compra' | 'cotizacion'
  }): Promise<ApiResponse<PedidoClienteRecord>> {
    if (supabase) {
      try {
        const itemsJsonb = pedido.items.map(item => ({
          id_articulo: item.id_articulo,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_total,
          descripcion_personalizada: item.descripcion_personalizada || null
        }))

        const { data, error } = await supabase.rpc('crear_pedido_cliente', {
          p_id_cliente: pedido.id_cliente,
          p_fecha_limite_deseada: pedido.fecha_limite_deseada || null,
          p_observaciones_cliente: pedido.observaciones_cliente || null,
          p_items: itemsJsonb,
          p_es_urgente: pedido.es_urgente || false,
          p_requiere_delivery: pedido.requiere_delivery || false,
          p_direccion_delivery: pedido.direccion_delivery || null,
          p_tipo_producto_servicio: pedido.tipo_producto_servicio || null,
          p_tipo_producto_otro: pedido.tipo_producto_otro || null,
          p_necesita_asesoramiento: pedido.necesita_asesoramiento || false,
          p_donde_colocados: pedido.donde_colocados || null,
          p_digital_o_impresion: pedido.digital_o_impresion || null,
          p_cantidades: pedido.cantidades || null,
          p_objetivo_proyecto: pedido.objetivo_proyecto || null,
          p_material_logo: pedido.material_logo || null,
          p_material_textos: pedido.material_textos || null,
          p_material_imagenes: pedido.material_imagenes || null,
          p_tiene_referencias: pedido.tiene_referencias || false,
          p_referencias_links: pedido.referencias_links || null,
          p_brief_publico: pedido.brief_publico || null,
          p_estilo_diseno: pedido.estilo_diseno || null,
          p_referencias: pedido.referencias || null,
          p_tipo_intencion: pedido.tipo_intencion || 'compra'
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el pedido' }
        }

        return { success: true, data: data[0] as PedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Registra venta CRM con ítems desde un pedido web tipo compra.
   */
  async crearVentaDesdePedidoCliente(
    idPedido: number
  ): Promise<ApiResponse<{ id: number; numero_venta: string; ya_existia?: boolean }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_venta_desde_pedido_cliente', {
          p_id_pedido: idPedido
        })
        if (error) return { success: false, error: error.message }
        if (data && typeof data === 'object' && 'success' in data) {
          const result = data as {
            success: boolean
            error?: string
            data?: { id: number; numero_venta: string; ya_existia?: boolean }
          }
          if (result.success && result.data) {
            return { success: true, data: result.data }
          }
          return { success: false, error: result.error || 'No se pudo registrar la venta' }
        }
        return { success: false, error: 'Respuesta inválida al registrar venta' }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear pedido desde carrito del portal (checkout Fase 2).
   */
  async crearPedidoDesdeCarritoCliente(input: {
    id_cliente: number
    tipo_intencion: 'compra' | 'cotizacion'
    fecha_limite_deseada?: string
    observaciones_cliente?: string
    es_urgente?: boolean
    requiere_delivery?: boolean
    direccion_delivery?: string
  }): Promise<ApiResponse<PedidoClienteRecord>> {
    const carrito = await this.getCarritoCliente(input.id_cliente)
    if (!carrito.success || !carrito.data) {
      return { success: false, error: carrito.error || 'Carrito vacío' }
    }
    if (carrito.data.items.length === 0) {
      return { success: false, error: 'El carrito está vacío' }
    }

    const items = carrito.data.items.map((it) => ({
      id_articulo: it.id_articulo,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      precio_total: it.precio_total
    }))

    const resp = await this.crearPedidoCliente({
      id_cliente: input.id_cliente,
      items,
      tipo_intencion: input.tipo_intencion,
      fecha_limite_deseada: input.fecha_limite_deseada,
      observaciones_cliente: input.observaciones_cliente,
      es_urgente: input.es_urgente,
      requiere_delivery: input.requiere_delivery,
      direccion_delivery: input.direccion_delivery
    })

    if (resp.success && resp.data?.id && input.tipo_intencion === 'compra') {
      await this.aplicarStockPedidoCliente(resp.data.id, 'portal')
      const ventaRes = await this.crearVentaDesdePedidoCliente(resp.data.id)
      if (!ventaRes.success) {
        return {
          success: false,
          error:
            ventaRes.error ||
            'El pedido se creó pero no se registró en ventas. Contactá a mostrador.'
        }
      }
    }

    if (resp.success) {
      await this.vaciarCarritoCliente(input.id_cliente)
    }

    return resp
  }

  /**
   * Obtener pedidos de un cliente
   */
  async getPedidosCliente(idCliente: number): Promise<ApiResponse<PedidoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_pedidos_cliente', {
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as PedidoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener detalle completo de un pedido
   */
  async getDetallePedidoCliente(idPedido: number): Promise<ApiResponse<PedidoClienteDetalle>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_detalle_pedido_cliente', {
          p_id_pedido: idPedido
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Pedido no encontrado' }
        }

        const result = data[0]
        return {
          success: true,
          data: {
            pedido: result.pedido as PedidoClienteDetalle['pedido'],
            items: result.items as PedidoClienteDetalle['items'],
            archivos: result.archivos as PedidoClienteDetalle['archivos']
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar pedido cliente (solo campos editables)
   */
  async actualizarPedidoCliente(
    idPedido: number,
    idCliente: number,
    datos: {
      fecha_limite_deseada?: string
      observaciones_cliente?: string
      es_urgente?: boolean
      requiere_delivery?: boolean
      direccion_delivery?: string
      brief_publico?: string
      objetivo_proyecto?: string
      estilo_diseno?: string
      referencias?: string
      referencias_links?: string
    }
  ): Promise<ApiResponse<PedidoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_pedido_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente,
          p_fecha_limite_deseada: datos.fecha_limite_deseada || null,
          p_observaciones_cliente: datos.observaciones_cliente || null,
          p_es_urgente: datos.es_urgente !== undefined ? datos.es_urgente : null,
          p_requiere_delivery: datos.requiere_delivery !== undefined ? datos.requiere_delivery : null,
          p_direccion_delivery: datos.direccion_delivery || null,
          p_brief_publico: datos.brief_publico || null,
          p_objetivo_proyecto: datos.objetivo_proyecto || null,
          p_estilo_diseno: datos.estilo_diseno || null,
          p_referencias: datos.referencias || null,
          p_referencias_links: datos.referencias_links || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el pedido' }
        }

        // Obtener el pedido completo actualizado
        const detalleResponse = await this.getDetallePedidoCliente(idPedido)
        if (detalleResponse.success && detalleResponse.data) {
          return { success: true, data: detalleResponse.data.pedido as PedidoClienteRecord }
        }

        return { success: true, data: data[0] as PedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Cancelar pedido cliente
   */
  async cancelarPedidoCliente(
    idPedido: number,
    idCliente: number
  ): Promise<ApiResponse<PedidoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('cancelar_pedido_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo cancelar el pedido' }
        }

        // Obtener el pedido completo actualizado
        const detalleResponse = await this.getDetallePedidoCliente(idPedido)
        if (detalleResponse.success && detalleResponse.data) {
          return { success: true, data: detalleResponse.data.pedido as PedidoClienteRecord }
        }

        return { success: true, data: data[0] as PedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Convertir pedido a OP
   */
  async convertirPedidoAOp(params: {
    id_pedido: number
    id_usuario_convertidor: number
    nombre_usuario_convertidor: string
    sector_inicial?: string
    observaciones?: string
  }): Promise<
    ApiResponse<{
      id_op: number
      numero_op: string
      mensaje: string
      id_venta?: number
      numero_venta?: string
      stock_descontados?: number
      stock_errores?: string[]
    }>
  > {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('convertir_pedido_a_op', {
          p_id_pedido: params.id_pedido,
          p_id_usuario_convertidor: params.id_usuario_convertidor,
          p_nombre_usuario_convertidor: params.nombre_usuario_convertidor,
          p_sector_inicial: params.sector_inicial || 'Diseño Gráfico',
          p_observaciones: params.observaciones || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo convertir el pedido' }
        }

        const row = data[0] as {
          id_op: number
          numero_op: string
          mensaje: string
          id_venta?: number
          numero_venta?: string
        }

        const stockRes = await this.aplicarStockPedidoCliente(params.id_pedido, 'portal', {
          enConversionOp: true
        })

        return {
          success: true,
          data: {
            ...row,
            stock_descontados: stockRes.data?.descontados,
            stock_errores: stockRes.data?.errores
          },
          error:
            stockRes.data?.errores?.length && !stockRes.success
              ? `OP creada; stock: ${stockRes.data.errores.join('; ')}`
              : undefined
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Subir archivo de pedido cliente
   */
  async uploadArchivoPedidoCliente(
    file: File,
    idPedido: number,
    idItem?: number,
    options?: { tipoEtiqueta?: string; nombreArchivo?: string }
  ): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const nombreDb = options?.nombreArchivo || file.name
        const tipoDb = options?.tipoEtiqueta || file.type
        const fileExt = file.name.split('.').pop() || 'png'
        const fileName = `${idPedido}_${Date.now()}.${fileExt}`
        const filePath = idItem ? `${idPedido}/${idItem}/${fileName}` : `${idPedido}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('pedidos-clientes')
          .upload(filePath, file)

        if (uploadError) return { success: false, error: uploadError.message }

        const { data: urlData } = supabase.storage
          .from('pedidos-clientes')
          .getPublicUrl(filePath)

        // Guardar referencia en la base de datos
        const { error: dbError } = await supabase.from('pedidos_clientes_archivos').insert({
          id_pedido: idPedido,
          id_item: idItem || null,
          url: urlData.publicUrl,
          nombre_archivo: nombreDb,
          tipo: tipoDb,
          tamaño: file.size
        })

        if (dbError) return { success: false, error: dbError.message }

        return { success: true, data: urlData.publicUrl }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener todos los pedidos pendientes (para trabajadores)
   */
  // ==================== PRESUPUESTOS DE CLIENTES ====================

  /**
   * Crear presupuesto de cliente
   */
  async crearPresupuestoCliente(params: {
    id_cliente: number
    items: Array<{
      id_articulo: number
      cantidad: number
      precio_unitario: number
      precio_total: number
      descripcion_personalizada?: string
    }>
    fecha_vencimiento?: string
    observaciones_cliente?: string
    estado?: 'borrador' | 'enviado'
  }): Promise<ApiResponse<PresupuestoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_presupuesto_cliente', {
          p_id_cliente: params.id_cliente,
          p_items: params.items,
          p_fecha_vencimiento: params.fecha_vencimiento || null,
          p_observaciones_cliente: params.observaciones_cliente || null,
          p_estado: params.estado || 'borrador'
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_clientes')
          .select('*')
          .eq('id', data[0].id)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar presupuesto de cliente
   */
  async actualizarPresupuestoCliente(
    idPresupuesto: number,
    params: {
      items?: Array<{
        id_articulo: number
        cantidad: number
        precio_unitario: number
        precio_total: number
        descripcion_personalizada?: string
      }>
      fecha_vencimiento?: string
      observaciones_cliente?: string
      estado?: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado'
    }
  ): Promise<ApiResponse<PresupuestoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_presupuesto_cliente', {
          p_id_presupuesto: idPresupuesto,
          p_items: params.items || null,
          p_fecha_vencimiento: params.fecha_vencimiento || null,
          p_observaciones_cliente: params.observaciones_cliente || null,
          p_estado: params.estado || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_clientes')
          .select('*')
          .eq('id', idPresupuesto)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Enviar presupuesto (cambiar de borrador a enviado)
   */
  async enviarPresupuestoCliente(idPresupuesto: number): Promise<ApiResponse<PresupuestoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('enviar_presupuesto_cliente', {
          p_id_presupuesto: idPresupuesto
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo enviar el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_clientes')
          .select('*')
          .eq('id', idPresupuesto)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener presupuestos de un cliente
   */
  async getPresupuestosCliente(idCliente: number): Promise<ApiResponse<PresupuestoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_presupuestos_cliente', {
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as PresupuestoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener detalle de presupuesto
   */
  async getDetallePresupuestoCliente(idPresupuesto: number): Promise<ApiResponse<{
    presupuesto: PresupuestoClienteRecord & { cliente?: any }
    items: PresupuestoClienteItemRecord[]
  }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_detalle_presupuesto_cliente', {
          p_id_presupuesto: idPresupuesto
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Presupuesto no encontrado' }
        }

        return {
          success: true,
          data: {
            presupuesto: data[0].presupuesto as PresupuestoClienteRecord & { cliente?: any },
            items: (data[0].items || []) as PresupuestoClienteItemRecord[]
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Listar presupuestos (administración)
   */
  async getPresupuestosClientesAdmin(filters?: {
    estado?: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado' | 'convertido'
    id_cliente?: number
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<Array<PresupuestoClienteRecord & {
    cliente_nombre?: string
    cliente_empresa?: string
    cliente_email?: string
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_presupuestos_clientes_admin', {
          p_estado: filters?.estado || null,
          p_id_cliente: filters?.id_cliente || null,
          p_fecha_desde: filters?.fecha_desde || null,
          p_fecha_hasta: filters?.fecha_hasta || null
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Convertir presupuesto a pedido
   */
  async convertirPresupuestoAPedido(
    idPresupuesto: number,
    observacionesInternas?: string
  ): Promise<ApiResponse<{ id_pedido: number; numero_pedido: string; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('convertir_presupuesto_a_pedido_cliente', {
          p_id_presupuesto: idPresupuesto,
          p_observaciones_internas: observacionesInternas || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo convertir el presupuesto' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPedidosPendientes(): Promise<ApiResponse<PedidoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos_clientes')
          .select(`
            *,
            cliente:clientes!pedidos_clientes_id_cliente_fkey(*)
          `)
          .in('estado', ['pendiente', 'en_revision', 'aprobado'])
          .order('fecha_pedido', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as PedidoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== PRESUPUESTOS DE VENTAS PRESENCIALES ====================

  /**
   * Crear presupuesto de venta presencial (desde CRM/Mostrador)
   */
  async crearPresupuestoVenta(params: {
    id_cliente?: number | null
    cliente_nombre?: string
    cliente_telefono?: string
    cliente_email?: string
    cliente_dni_cuit?: string
    cliente_empresa?: string
    cliente_direccion?: string
    id_vendedor?: number
    nombre_vendedor?: string
    items: Array<{
      id_articulo_stock?: number
      codigo_articulo?: string
      descripcion: string
      cantidad: number
      precio_unitario: number
      descuento?: number
      precio_total: number
      observaciones?: string
    }>
    fecha_vencimiento?: string
    observaciones_cliente?: string
    observaciones_internas?: string
    estado?: 'borrador' | 'enviado'
    tipo_lista_precio?: 'lista_1' | 'lista_2' | null
  }): Promise<ApiResponse<PresupuestoVentaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_presupuesto_venta', {
          p_id_cliente: params.id_cliente || null,
          p_cliente_nombre: params.cliente_nombre || null,
          p_cliente_telefono: params.cliente_telefono || null,
          p_cliente_email: params.cliente_email || null,
          p_cliente_dni_cuit: params.cliente_dni_cuit || null,
          p_cliente_empresa: params.cliente_empresa || null,
          p_cliente_direccion: params.cliente_direccion || null,
          p_id_vendedor: params.id_vendedor || null,
          p_nombre_vendedor: params.nombre_vendedor || null,
          p_items: params.items,
          p_fecha_vencimiento: params.fecha_vencimiento || null,
          p_observaciones_cliente: params.observaciones_cliente || null,
          p_observaciones_internas: params.observaciones_internas || null,
          p_estado: params.estado || 'borrador',
          p_tipo_lista_precio: params.tipo_lista_precio || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_ventas')
          .select('*')
          .eq('id', data[0].id)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoVentaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener presupuestos de ventas presenciales (admin)
   */
  async getPresupuestosVentasAdmin(filters?: {
    estado?: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado' | 'convertido'
    id_cliente?: number
    id_vendedor?: number
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<PresupuestoVentaRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_presupuestos_ventas_admin', {
          p_estado: filters?.estado || null,
          p_id_cliente: filters?.id_cliente || null,
          p_id_vendedor: filters?.id_vendedor || null,
          p_fecha_desde: filters?.fecha_desde || null,
          p_fecha_hasta: filters?.fecha_hasta || null
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as PresupuestoVentaRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar estado de presupuesto de venta
   */
  async actualizarEstadoPresupuestoVenta(
    idPresupuesto: number,
    estado: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado' | 'convertido',
    observacionesInternas?: string
  ): Promise<ApiResponse<PresupuestoVentaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_estado_presupuesto_venta', {
          p_id_presupuesto: idPresupuesto,
          p_estado: estado,
          p_observaciones_internas: observacionesInternas || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_ventas')
          .select('*')
          .eq('id', idPresupuesto)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoVentaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener detalle completo de presupuesto de venta
   */
  async obtenerDetallePresupuestoVenta(idPresupuesto: number): Promise<ApiResponse<{
    presupuesto: PresupuestoVentaRecord
    items: PresupuestoVentaItemRecord[]
  }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_detalle_presupuesto_venta', {
          p_id_presupuesto: idPresupuesto
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Presupuesto no encontrado' }
        }

        return {
          success: true,
          data: {
            presupuesto: data[0].presupuesto as PresupuestoVentaRecord,
            items: (data[0].items || []) as PresupuestoVentaItemRecord[]
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener OP por número (para clientes)
   */
  async obtenerOpPorNumeroCliente(
    numeroOp: string,
    idCliente: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_op_por_numero_cliente', {
          p_numero_op: numeroOp,
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'OP no encontrada' }
        }
        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener OP por ID de orden (para clientes, cuando viene de pedido)
   */
  async obtenerOpPorIdCliente(
    idOrden: number,
    idCliente: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_op_por_id_cliente', {
          p_id_orden: idOrden,
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'OP no encontrada' }
        }
        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Listar notificaciones del cliente
   */
  async listarNotificacionesCliente(idCliente: number): Promise<ApiResponse<Array<{
    id: number
    tipo: string
    titulo: string | null
    mensaje: string
    id_pedido: number | null
    id_reclamo: number | null
    leida: boolean
    created_at: string
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_notificaciones_cliente', {
          p_id_cliente: idCliente
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as any[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async contarNotificacionesClienteNoLeidas(idCliente: number): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('contar_notificaciones_cliente_no_leidas', {
          p_id_cliente: idCliente
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: Number(data ?? 0) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async marcarNotificacionesClienteLeidas(idCliente: number): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('marcar_notificaciones_cliente_leidas', {
          p_id_cliente: idCliente
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: Number(data ?? 0) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async contarMensajesClienteNoLeidos(idCliente: number): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('contar_mensajes_cliente_no_leidos', {
          p_id_cliente: idCliente
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: Number(data ?? 0) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async listarMensajesPedidoNoLeidosCliente(
    idCliente: number
  ): Promise<ApiResponse<Array<{ id_pedido: number; cantidad: number }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_mensajes_pedido_no_leidos_cliente', {
          p_id_cliente: idCliente
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as Array<{ id_pedido: number; cantidad: number }> }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async marcarMensajesPedidoLeidosCliente(
    idPedido: number,
    idCliente: number
  ): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('marcar_mensajes_pedido_leidos_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente
        })
        if (error) return { success: false, error: error.message }
        return { success: true, data: Number(data ?? 0) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener mensajes de un pedido
   */
  async obtenerMensajesPedido(
    idPedido: number,
    idCliente: number
  ): Promise<ApiResponse<MensajePedidoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_mensajes_pedido', {
          p_id_pedido_cliente: idPedido,
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as MensajePedidoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear mensaje en un pedido
   */
  async crearMensajePedido(
    idPedido: number,
    idCliente: number,
    mensaje: string,
    esDelCliente: boolean = true
  ): Promise<ApiResponse<MensajePedidoClienteRecord>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null
        
        const { data, error } = await supabase.rpc('crear_mensaje_pedido_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente,
          p_mensaje: mensaje,
          p_es_del_cliente: esDelCliente,
          p_id_usuario: esDelCliente ? null : (usuario?.id || null)
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Error al crear mensaje' }
        }
        return { success: true, data: data[0] as MensajePedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar estado de pedido cliente
   */
  async actualizarEstadoPedidoCliente(
    idPedido: number,
    nuevoEstado: PedidoClienteRecord['estado'],
    observacionesInternas?: string
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const updateData: any = { estado: nuevoEstado }
        if (observacionesInternas) {
          updateData.observaciones_internas = observacionesInternas
        }

        const { error } = await supabase
          .from('pedidos_clientes')
          .update(updateData)
          .eq('id', idPedido)

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Notificar cambios en checklists de fichas No OP
  async notificarChecklistFichaNoOP(
    idOrden: number,
    tipoChecklist:
      | 'ficha_tecnica_cargada'
      | 'presupuesto_enviado'
      | 'presupuesto_armado'
      | 'presupuesto_en_espera',
    numeroOP: string
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('notificar_checklist_ficha_no_op', {
          p_id_orden: idOrden,
          p_tipo_checklist: tipoChecklist,
          p_numero_op: numeroOP
        })

        if (error) {
          // No bloquear guardado de ficha: la RPC es best-effort (p. ej. columnas notifications en BD)
          console.warn('Checklist: notificación no enviada (revisá RPC notificar_checklist_ficha_no_op):', error.message)
          return { success: true }
        }
        return { success: true }
      } catch (error) {
        console.warn('Checklist: notificación no enviada:', error)
        return { success: true }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Transformar ficha No OP en OP real cuando se finaliza
  async transformarFichaNoOPAOP(idOrden: number): Promise<ApiResponse<{ nuevo_numero_op: string }>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('transformar_ficha_no_op_a_op', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error transformando ficha No OP a OP:', error)
          return { success: false, error: error.message }
        }

        // Obtener el nuevo número de OP
        const { data: ordenData, error: ordenError } = await supabase
          .from('ordenes_trabajo')
          .select('numero_op')
          .eq('id', idOrden)
          .single()

        if (ordenError || !ordenData) {
          return { success: false, error: 'No se pudo obtener el nuevo número de OP' }
        }

        return { success: true, data: { nuevo_numero_op: ordenData.numero_op } }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Fichas No OP activas + órdenes que fueron ficha y ya tienen OP (requiere columna numero_ficha_original en BD).
   */
  async getHistorialFichasAsesor(limit = 400): Promise<ApiResponse<FichaHistorialItem[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    const mapRow = (r: Record<string, unknown>): FichaHistorialItem => {
      const leg = r.numero_ficha_original
      const legStr =
        leg != null && String(leg).trim() !== '' ? String(leg).trim() : null
      return {
        id: r.id as number,
        numero_op: String(r.numero_op ?? ''),
        cliente: (r.cliente as string) ?? null,
        estado: (r.estado as string) ?? null,
        sector: (r.sector as string) ?? null,
        fecha_creacion: (r.fecha_creacion as string) ?? null,
        nombre_creador: (r.nombre_creador as string) ?? null,
        es_ficha_no_op: (r.es_ficha_no_op as boolean | null) ?? null,
        numero_ficha_original: legStr,
        descripcion: (r.descripcion as string) ?? null
      }
    }

    const baseCols =
      'id, numero_op, cliente, estado, sector, fecha_creacion, nombre_creador, es_ficha_no_op, descripcion, visible_en_tablero'
    const fullCols = `${baseCols}, numero_ficha_original`

    const sortByFechaDesc = (a: Record<string, unknown>, b: Record<string, unknown>) => {
      const ta = new Date(String(a.fecha_creacion || 0)).getTime()
      const tb = new Date(String(b.fecha_creacion || 0)).getTime()
      return tb - ta
    }

    const mergeById = (chunks: Record<string, unknown>[][]): Record<string, unknown>[] => {
      const byId = new Map<number, Record<string, unknown>>()
      for (const chunk of chunks) {
        for (const r of chunk) {
          const id = r.id as number
          if (Number.isFinite(id) && !byId.has(id)) {
            byId.set(id, r)
          }
        }
      }
      return [...byId.values()].sort(sortByFechaDesc)
    }

    const filterHistorialRows = (raw: Record<string, unknown>[]) =>
      raw.filter((r) => {
        const hasLegacy =
          r.numero_ficha_original != null && String(r.numero_ficha_original).trim() !== ''
        if (hasLegacy) return true
        if (r.es_ficha_no_op === true) return r.visible_en_tablero !== false
        return false
      })

    // Dos consultas: el .or() en PostgREST con boolean + null falla en varios despliegues
    const { data: dFichas, error: eFichas } = await supabase
      .from('ordenes_trabajo')
      .select(fullCols)
      .eq('es_ficha_no_op', true)
      .order('fecha_creacion', { ascending: false })
      .limit(limit)

    const missingCol =
      !!eFichas &&
      (eFichas.message?.includes('numero_ficha_original') ||
        eFichas.code === '42703' ||
        /column.*numero_ficha_original/i.test(eFichas.message || ''))

    if (missingCol) {
      const fb = await supabase
        .from('ordenes_trabajo')
        .select(baseCols)
        .eq('es_ficha_no_op', true)
        .order('fecha_creacion', { ascending: false })
        .limit(limit)
      if (fb.error) {
        return { success: false, error: fb.error.message }
      }
      const rows = ((fb.data || []) as Record<string, unknown>[])
        .filter((r) => r.visible_en_tablero !== false)
        .map((r) => mapRow({ ...r, numero_ficha_original: null }))
      return { success: true, data: rows }
    }

    if (eFichas) {
      console.error('getHistorialFichasAsesor (fichas activas):', eFichas)
      return { success: false, error: eFichas.message }
    }

    const { data: dExFicha, error: eEx } = await supabase
      .from('ordenes_trabajo')
      .select(fullCols)
      .not('numero_ficha_original', 'is', null)
      .order('fecha_creacion', { ascending: false })
      .limit(limit)

    if (eEx) {
      console.error('getHistorialFichasAsesor (ex-fichas):', eEx)
      return { success: false, error: eEx.message }
    }

    const merged = mergeById([
      (dFichas || []) as Record<string, unknown>[],
      (dExFicha || []) as Record<string, unknown>[]
    ])
    const rows = filterHistorialRows(merged).map(mapRow)
    return { success: true, data: rows }
  }

  /**
   * Obtener preferencias de un cliente por DNI/CUIT
   */
  async obtenerPreferenciasCliente(dniCuit: string): Promise<ApiResponse<{
    id: number
    dni_cuit: string
    preferencias: string | null
    notas_internas: string | null
    es_vip: boolean
    created_at: string
    updated_at: string
  } | null>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_preferencias_cliente', {
        p_dni_cuit: dniCuit
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data || data.length === 0) {
        return { success: true, data: null }
      }

      return { success: true, data: data[0] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Guardar/actualizar preferencias de un cliente
   */
  async guardarPreferenciasCliente(
    dniCuit: string,
    preferencias?: string | null,
    notasInternas?: string | null,
    esVIP?: boolean
  ): Promise<ApiResponse<{
    id: number
    dni_cuit: string
    preferencias: string | null
    notas_internas: string | null
    es_vip: boolean
  }>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('guardar_preferencias_cliente', {
        p_dni_cuit: dniCuit,
        p_preferencias: preferencias || null,
        p_notas_internas: notasInternas || null,
        p_es_vip: esVIP || false
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data || data.length === 0) {
        return { success: false, error: 'No se pudo guardar las preferencias' }
      }

      return { success: true, data: data[0] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Obtener todas las preferencias de clientes
   */
  async obtenerTodasPreferenciasClientes(): Promise<ApiResponse<Array<{
    dni_cuit: string
    preferencias: string | null
    notas_internas: string | null
    es_vip: boolean
  }>>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_todas_preferencias_clientes')

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ============================================
  // HORARIOS Y TURNOS
  // ============================================

  async crearHorario(
    idUsuario: number,
    tipoHorario: 'fijo' | 'flexible' | 'turnos',
    diaSemana: number | null = null,
    horaEntrada: string | null = null,
    horaSalida: string | null = null,
    horasSemanales: number | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    observaciones: string | null = null,
    activo: boolean = true
  ): Promise<ApiResponse<HorarioEmpleado>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_actualizar_horario', {
        p_id_usuario: idUsuario,
        p_tipo_horario: tipoHorario,
        p_dia_semana: diaSemana,
        p_hora_entrada: horaEntrada,
        p_hora_salida: horaSalida,
        p_horas_semanales: horasSemanales,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_observaciones: observaciones,
        p_activo: activo
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as HorarioEmpleado }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerHorariosUsuario(idUsuario: number): Promise<ApiResponse<HorarioEmpleado[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_horarios_usuario', {
        p_id_usuario: idUsuario
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as HorarioEmpleado[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async eliminarHorario(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_horario', {
        p_id: id
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async crearTurno(
    idUsuario: number,
    fecha: string,
    horaEntrada: string,
    horaSalida: string,
    tipoTurno: 'normal' | 'extra' | 'nocturno' = 'normal',
    observaciones: string | null = null
  ): Promise<ApiResponse<Turno>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_actualizar_turno', {
        p_id_usuario: idUsuario,
        p_fecha: fecha,
        p_hora_entrada: horaEntrada,
        p_hora_salida: horaSalida,
        p_tipo_turno: tipoTurno,
        p_observaciones: observaciones
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Turno }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerTurnos(
    idUsuario: number | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<Turno[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_turnos', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as Turno[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async eliminarTurno(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_turno', {
        p_id: id
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async crearAusencia(
    idUsuario: number,
    tipoAusencia: 'vacaciones' | 'licencia' | 'inasistencia' | 'permiso' | 'enfermedad',
    fechaInicio: string,
    fechaFin: string,
    motivo: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<Ausencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_ausencia', {
        p_id_usuario: idUsuario,
        p_tipo_ausencia: tipoAusencia,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_motivo: motivo,
        p_observaciones: observaciones
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Ausencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerAusencias(
    idUsuario: number | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null,
    estado: string | null = null
  ): Promise<ApiResponse<Ausencia[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_ausencias', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
        p_estado: estado
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as Ausencia[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async aprobarRechazarAusencia(
    id: number,
    estado: 'aprobado' | 'rechazado',
    idAprobador: number,
    observaciones: string | null = null
  ): Promise<ApiResponse<Ausencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('aprobar_rechazar_ausencia', {
        p_id: id,
        p_estado: estado,
        p_id_aprobador: idAprobador,
        p_observaciones: observaciones
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Ausencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async eliminarAusencia(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_ausencia', {
        p_id: id
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async registrarEntrada(
    idUsuario: number,
    fecha: string | null = null,
    horaEntrada: string | null = null
  ): Promise<ApiResponse<Asistencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_entrada', {
        p_id_usuario: idUsuario,
        p_fecha: fecha,
        p_hora_entrada: horaEntrada
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Asistencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async registrarSalida(
    idUsuario: number,
    fecha: string | null = null,
    horaSalida: string | null = null
  ): Promise<ApiResponse<Asistencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_salida', {
        p_id_usuario: idUsuario,
        p_fecha: fecha,
        p_hora_salida: horaSalida
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Asistencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerAsistencia(
    idUsuario: number | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<Asistencia[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_asistencia', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as Asistencia[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async registrarAsistenciaReloj(
    registros: Array<{
      id_usuario: number
      fecha: string
      hora_entrada: string | null
      hora_salida: string | null
      horas_trabajadas: number | null
      tipo_registro: string
      observaciones: string | null
    }>
  ): Promise<ApiResponse<{ insertados: number; actualizados: number; total: number }>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_asistencia_reloj', {
        p_registros: registros
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as { insertados: number; actualizados: number; total: number } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async listarRelojReportesSemanales(fechaDesde?: string, fechaHasta?: string): Promise<
    ApiResponse<RrhhRelojReporteSemanal[]>
  > {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }
    try {
      let q = supabase
        .from('rrhh_reloj_reportes_semanales')
        .select('*')
        .order('periodo_desde', { ascending: false })
      if (fechaDesde) q = q.gte('periodo_hasta', fechaDesde)
      if (fechaHasta) q = q.lte('periodo_desde', fechaHasta)
      const { data, error } = await q
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data ?? []) as RrhhRelojReporteSemanal[] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async guardarRelojReporteSemanal(params: {
    periodoDesde: string
    periodoHasta: string
    archivoNombre?: string | null
    payload: Record<string, unknown>
    registradoPor: number
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }
    try {
      const { data, error } = await supabase.rpc('guardar_reloj_reporte_semanal', {
        p_periodo_desde: params.periodoDesde,
        p_periodo_hasta: params.periodoHasta,
        p_archivo_nombre: params.archivoNombre ?? null,
        p_payload: params.payload,
        p_registrado_por: params.registradoPor
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: { id: Number(data) } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Crea o actualiza el horario fijo estándar de un empleado para un mes
   * (clave: id_usuario + primer día del mes). Se usa como entrada esperada /
   * jornada esperada. `mes` en formato 'YYYY-MM' o 'YYYY-MM-DD' (null = mes actual).
   */
  async upsertHorarioFijo(
    idUsuario: number,
    horaEntrada: string,
    horaSalida: string,
    horasSemanales: number | null = null,
    mes: string | null = null,
    trabajaSabado: boolean = true,
    observaciones: string | null = null
  ): Promise<ApiResponse<HorarioEmpleado>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('upsert_horario_fijo', {
        p_id_usuario: idUsuario,
        p_hora_entrada: horaEntrada,
        p_hora_salida: horaSalida,
        p_horas_semanales: horasSemanales,
        p_observaciones: observaciones,
        p_mes: mes ? (mes.length === 7 ? `${mes}-01` : mes) : null,
        p_trabaja_sabado: trabajaSabado
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as HorarioEmpleado }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /** Elimina el horario fijo de un empleado para un mes ('YYYY-MM' o 'YYYY-MM-DD'). */
  async eliminarHorarioFijo(idUsuario: number, mes: string | null = null): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_horario_fijo', {
        p_id_usuario: idUsuario,
        p_mes: mes ? (mes.length === 7 ? `${mes}-01` : mes) : null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /** Elimina un registro de asistencia por id. */
  async eliminarAsistencia(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { error } = await supabase.from('asistencia').delete().eq('id', id)
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Devuelve los horarios fijos estándar de todos los empleados
   * (tipo_horario='fijo', dia_semana null) como mapa idUsuario → { entrada, salida, horas }.
   */
  async obtenerHorariosFijos(mes: string | null = null): Promise<
    ApiResponse<Record<number, { entrada: string; salida: string; horas: number | null; trabajaSabado: boolean }>>
  > {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      let query = supabase
        .from('horarios_empleados')
        .select('id_usuario, hora_entrada, hora_salida, horas_semanales, activo, fecha_inicio, trabaja_sabado')
        .eq('tipo_horario', 'fijo')
        .is('dia_semana', null)

      if (mes) {
        query = query.eq('fecha_inicio', mes.length === 7 ? `${mes}-01` : mes)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      const mapa: Record<number, { entrada: string; salida: string; horas: number | null; trabajaSabado: boolean }> = {}
      for (const row of (data as Array<{ id_usuario: number; hora_entrada: string | null; hora_salida: string | null; horas_semanales: number | null; activo: boolean | null; trabaja_sabado: boolean | null }>) || []) {
        if (row.activo === false) continue
        const entrada = (row.hora_entrada || '').slice(0, 5)
        const salida = (row.hora_salida || '').slice(0, 5)
        if (entrada) {
          mapa[row.id_usuario] = {
            entrada,
            salida,
            horas: row.horas_semanales != null ? Number(row.horas_semanales) : null,
            trabajaSabado: row.trabaja_sabado !== false
          }
        }
      }

      return { success: true, data: mapa }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Lista básica de legajos (nombre, apellido, sector) por id de usuario,
   * para mostrar nombre completo y área en planillas.
   */
  async obtenerLegajosBasico(): Promise<
    ApiResponse<
      Record<
        number,
        { nombre: string; apellido: string; sector: string; fecha_ingreso: string | null; email: string | null }
      >
    >
  > {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase
        .from('legajos_empleados')
        .select('id_usuario, nombre, apellido, sector, fecha_ingreso, email')

      if (error) {
        return { success: false, error: error.message }
      }

      const mapa: Record<
        number,
        { nombre: string; apellido: string; sector: string; fecha_ingreso: string | null; email: string | null }
      > = {}
      for (const row of (data as Array<{
        id_usuario: number
        nombre: string | null
        apellido: string | null
        sector: string | null
        fecha_ingreso: string | null
        email: string | null
      }>) || []) {
        mapa[row.id_usuario] = {
          nombre: row.nombre || '',
          apellido: row.apellido || '',
          sector: row.sector || '',
          fecha_ingreso: row.fecha_ingreso ?? null,
          email: row.email ?? null
        }
      }

      return { success: true, data: mapa }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ============================================
  // SOLICITUDES Y PERMISOS
  // ============================================

  async crearSolicitudPermiso(
    idUsuario: number,
    tipoSolicitud: 'turno' | 'ausencia' | 'vacaciones' | 'ropa' | 'permiso' | 'otro',
    titulo: string,
    descripcion: string | null = null,
    fechaSolicitud: string | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    diasSolicitados: number | null = null,
    observaciones: string | null = null,
    archivoAdjuntoUrl: string | null = null
  ): Promise<ApiResponse<SolicitudPermiso>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_solicitud_permiso', {
        p_id_usuario: idUsuario,
        p_tipo_solicitud: tipoSolicitud,
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_fecha_solicitud: fechaSolicitud,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_dias_solicitados: diasSolicitados,
        p_observaciones: observaciones,
        p_archivo_adjunto_url: archivoAdjuntoUrl
      })

      if (error) throw error

      const solicitud = data as SolicitudPermiso

      // Obtener nombre del usuario que creó la solicitud
      const usuariosResponse = await this.getUsuarios()
      const usuarioSolicitante = usuariosResponse.data?.find(u => u.id === idUsuario)
      const nombreUsuario = usuarioSolicitante?.nombre || 'Usuario'

      // Notificar a usuarios de RRHH y Admin
      if (usuariosResponse.success && usuariosResponse.data) {
        const usuariosRRHH = usuariosResponse.data.filter(
          u => u.rol === 'recursos-humanos' || u.rol === 'administracion'
        )

        for (const usuarioRRHH of usuariosRRHH) {
          const tipoIcon = {
            turno: '🕐',
            ausencia: '❌',
            vacaciones: '🏖️',
            ropa: '👕',
            permiso: '✅',
            otro: '📝'
          }[tipoSolicitud] || '📋'

          await this.createNotification({
            user_id: usuarioRRHH.id,
            title: `${tipoIcon} Nueva Solicitud de ${tipoSolicitud}`,
            description: `${nombreUsuario} ha creado una solicitud: "${titulo}"${descripcion ? ` - ${descripcion}` : ''}`,
            type: 'info',
            solicitud_id: solicitud.id
          })
        }
      }

      return {
        success: true,
        data: solicitud
      }
    } catch (error: any) {
      console.error('Error al crear solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al crear solicitud'
      }
    }
  }

  async obtenerSolicitudesPermisos(
    idUsuario: number | null = null,
    estado: string | null = null,
    tipoSolicitud: string | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<SolicitudPermiso[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_solicitudes_permisos', {
        p_id_usuario: idUsuario,
        p_estado: estado,
        p_tipo_solicitud: tipoSolicitud,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as SolicitudPermiso[]
      }
    } catch (error: any) {
      console.error('Error al obtener solicitudes:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener solicitudes'
      }
    }
  }

  async aprobarRechazarSolicitud(
    id: number,
    estado: 'aprobado' | 'rechazado',
    idAprobador: number,
    motivoRechazo: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<SolicitudPermiso>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Primero obtener la solicitud para notificar al usuario
      const solicitudResponse = await this.obtenerSolicitudesPermisos(null, null, null, null, null)
      const solicitud = solicitudResponse.data?.find(s => s.id === id)

      const { data, error } = await supabase.rpc('aprobar_rechazar_solicitud', {
        p_id: id,
        p_estado: estado,
        p_id_aprobador: idAprobador,
        p_motivo_rechazo: motivoRechazo,
        p_observaciones: observaciones
      })

      if (error) throw error

      const solicitudActualizada = data as SolicitudPermiso

      // Notificar al usuario que creó la solicitud
      if (solicitud && solicitud.id_usuario) {
        const usuariosResponse = await this.getUsuarios()
        const usuarioAprobador = usuariosResponse.data?.find(u => u.id === idAprobador)
        const nombreAprobador = usuarioAprobador?.nombre || 'RRHH'

        if (estado === 'aprobado') {
          await this.createNotification({
            user_id: solicitud.id_usuario,
            title: `✅ Solicitud Aprobada`,
            description: `Tu solicitud "${solicitud.titulo}" ha sido aprobada por ${nombreAprobador}.${observaciones ? ` Observaciones: ${observaciones}` : ''}`,
            type: 'success',
            solicitud_id: solicitud.id
          })
        } else {
          await this.createNotification({
            user_id: solicitud.id_usuario,
            title: `❌ Solicitud Rechazada`,
            description: `Tu solicitud "${solicitud.titulo}" ha sido rechazada por ${nombreAprobador}.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''}`,
            type: 'error',
            solicitud_id: solicitud.id
          })
        }
      }

      return {
        success: true,
        data: solicitudActualizada
      }
    } catch (error: any) {
      console.error('Error al aprobar/rechazar solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al procesar solicitud'
      }
    }
  }

  async cancelarSolicitud(
    id: number,
    idUsuario: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('cancelar_solicitud', {
        p_id: id,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al cancelar solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al cancelar solicitud'
      }
    }
  }

  async eliminarSolicitud(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_solicitud', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar solicitud'
      }
    }
  }

  // ============================================
  // RRHH — NOVEDADES (faltas, tardanzas, licencias, horas extra)
  // ============================================

  private mapRrhhNovedadRow(row: Record<string, unknown>): RrhhNovedad {
    const adj = row.adjuntos
    return {
      id: Number(row.id),
      id_usuario: Number(row.id_usuario),
      id_solicitud_permiso:
        row.id_solicitud_permiso == null ? null : Number(row.id_solicitud_permiso),
      grupo: row.grupo as RrhhNovedad['grupo'],
      codigo: String(row.codigo),
      fecha_desde: String(row.fecha_desde).slice(0, 10),
      fecha_hasta: String(row.fecha_hasta).slice(0, 10),
      duracion_minutos: row.duracion_minutos == null ? null : Number(row.duracion_minutos),
      horas_extra_cantidad:
        row.horas_extra_cantidad == null ? null : Number(row.horas_extra_cantidad),
      observaciones: row.observaciones == null ? null : String(row.observaciones),
      adjuntos: Array.isArray(adj) ? (adj as RrhhNovedadAdjunto[]) : [],
      registrado_por: row.registrado_por == null ? null : Number(row.registrado_por),
      firma_data_url: row.firma_data_url == null ? null : String(row.firma_data_url),
      firmado_at: row.firmado_at == null ? null : String(row.firmado_at),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    }
  }

  async rrhhNovedadesListar(filters?: {
    idUsuario?: number
    grupo?: RrhhNovedadGrupo
    codigo?: string
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<ApiResponse<RrhhNovedad[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      let q = supabase.from('rrhh_novedades').select('*').order('fecha_desde', { ascending: false })
      if (filters?.idUsuario) q = q.eq('id_usuario', filters.idUsuario)
      if (filters?.grupo) q = q.eq('grupo', filters.grupo)
      if (filters?.codigo) q = q.eq('codigo', filters.codigo)
      if (filters?.fechaDesde) {
        q = q.gte('fecha_hasta', filters.fechaDesde)
      }
      if (filters?.fechaHasta) {
        q = q.lte('fecha_desde', filters.fechaHasta)
      }
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as Record<string, unknown>[]
      return { success: true, data: rows.map((r) => this.mapRrhhNovedadRow(r)) }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al listar novedades')
      }
    }
  }

  async rrhhNovedadCrear(input: {
    id_usuario: number
    id_solicitud_permiso?: number | null
    grupo: RrhhNovedadGrupo
    codigo: string
    fecha_desde: string
    fecha_hasta: string
    duracion_minutos?: number | null
    horas_extra_cantidad?: number | null
    observaciones?: string | null
    adjuntos?: RrhhNovedadAdjunto[]
    registrado_por: number
  }): Promise<ApiResponse<RrhhNovedad>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const { data, error } = await supabase
        .from('rrhh_novedades')
        .insert({
          id_usuario: input.id_usuario,
          id_solicitud_permiso: input.id_solicitud_permiso ?? null,
          grupo: input.grupo,
          codigo: input.codigo,
          fecha_desde: input.fecha_desde,
          fecha_hasta: input.fecha_hasta,
          duracion_minutos: input.duracion_minutos ?? null,
          horas_extra_cantidad: input.horas_extra_cantidad ?? null,
          observaciones: input.observaciones ?? null,
          adjuntos: input.adjuntos ?? [],
          registrado_por: input.registrado_por,
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single()
      if (error) throw error
      return { success: true, data: this.mapRrhhNovedadRow(data as Record<string, unknown>) }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al crear novedad')
      }
    }
  }

  async rrhhNovedadActualizar(
    id: number,
    input: Partial<{
      id_usuario: number
      id_solicitud_permiso: number | null
      grupo: RrhhNovedadGrupo
      codigo: string
      fecha_desde: string
      fecha_hasta: string
      duracion_minutos: number | null
      horas_extra_cantidad: number | null
      observaciones: string | null
      adjuntos: RrhhNovedadAdjunto[]
      firma_data_url: string | null
      firmado_at: string | null
    }>
  ): Promise<ApiResponse<RrhhNovedad>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const payload: Record<string, unknown> = {
        ...input,
        updated_at: new Date().toISOString()
      }
      const { data, error } = await supabase
        .from('rrhh_novedades')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return { success: true, data: this.mapRrhhNovedadRow(data as Record<string, unknown>) }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al actualizar novedad')
      }
    }
  }

  async rrhhNovedadGuardarFirma(
    id: number,
    firmaDataUrl: string
  ): Promise<ApiResponse<RrhhNovedad>> {
    return this.rrhhNovedadActualizar(id, {
      firma_data_url: firmaDataUrl,
      firmado_at: new Date().toISOString()
    })
  }

  async rrhhNovedadEliminar(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const { error } = await supabase.from('rrhh_novedades').delete().eq('id', id)
      if (error) throw error
      return { success: true, data: true }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'Error al eliminar novedad')
      }
    }
  }

  /** Sube archivo al bucket `archivos` bajo `rrhh-novedades/`. */
  async rrhhNovedadSubirAdjunto(
    file: File,
    idUsuarioEmpleado: number
  ): Promise<ApiResponse<RrhhNovedadAdjunto>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      return { success: false, error: 'El archivo supera 12 MB' }
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const allowedExt = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'])
    if (!allowedExt.has(ext)) {
      return { success: false, error: 'Formato no permitido (PDF o imagen).' }
    }
    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80)
    const path = `rrhh-novedades/${idUsuarioEmpleado}/${Date.now()}_${safeBase}.${ext}`
    try {
      const { error: uploadError } = await supabase.storage.from('archivos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `application/${ext === 'pdf' ? 'pdf' : 'octet-stream'}`
      })
      if (uploadError) {
        return { success: false, error: uploadError.message }
      }
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) {
        return { success: false, error: 'No se pudo obtener la URL del archivo' }
      }
      return {
        success: true,
        data: {
          url: publicUrl,
          nombre: file.name,
          mime: file.type || 'application/octet-stream'
        }
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error al subir archivo'
      }
    }
  }

  // ============================================
  // EVALUACIONES DE DESEMPEÑO
  // ============================================

  async crearEvaluacion(
    idUsuarioEvaluado: number,
    idUsuarioEvaluador: number,
    tipoEvaluacion: 'anual' | 'semestral' | 'trimestral' | 'mensual' | 'periodo_prueba' | 'especial',
    periodoEvaluacion: string,
    fechaEvaluacion: string | null = null,
    fechaInicioPeriodo: string | null = null,
    fechaFinPeriodo: string | null = null,
    comentariosEvaluador: string | null = null,
    objetivosCumplidos: string | null = null,
    areasMejora: string | null = null,
    recomendaciones: string | null = null
  ): Promise<ApiResponse<Evaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_evaluacion', {
        p_id_usuario_evaluado: idUsuarioEvaluado,
        p_id_usuario_evaluador: idUsuarioEvaluador,
        p_tipo_evaluacion: tipoEvaluacion,
        p_periodo_evaluacion: periodoEvaluacion,
        p_fecha_evaluacion: fechaEvaluacion,
        p_fecha_inicio_periodo: fechaInicioPeriodo,
        p_fecha_fin_periodo: fechaFinPeriodo,
        p_comentarios_evaluador: comentariosEvaluador,
        p_objetivos_cumplidos: objetivosCumplidos,
        p_areas_mejora: areasMejora,
        p_recomendaciones: recomendaciones
      })

      if (error) throw error

      return {
        success: true,
        data: data as Evaluacion
      }
    } catch (error: any) {
      console.error('Error al crear evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al crear evaluación'
      }
    }
  }

  async obtenerEvaluaciones(
    idUsuarioEvaluado: number | null = null,
    idUsuarioEvaluador: number | null = null,
    estado: string | null = null,
    tipoEvaluacion: string | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<Evaluacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_evaluaciones', {
        p_id_usuario_evaluado: idUsuarioEvaluado,
        p_id_usuario_evaluador: idUsuarioEvaluador,
        p_estado: estado,
        p_tipo_evaluacion: tipoEvaluacion,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Evaluacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener evaluaciones:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener evaluaciones'
      }
    }
  }

  async obtenerCriteriosEvaluacion(idEvaluacion: number): Promise<ApiResponse<CriterioEvaluacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_criterios_evaluacion', {
        p_id_evaluacion: idEvaluacion
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as CriterioEvaluacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener criterios:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener criterios'
      }
    }
  }

  async agregarCriterioEvaluacion(
    idEvaluacion: number,
    criterio: string,
    calificacion: number,
    descripcion: string | null = null,
    peso: number = 1.0,
    comentarios: string | null = null
  ): Promise<ApiResponse<CriterioEvaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('agregar_criterio_evaluacion', {
        p_id_evaluacion: idEvaluacion,
        p_criterio: criterio,
        p_calificacion: calificacion,
        p_descripcion: descripcion,
        p_peso: peso,
        p_comentarios: comentarios
      })

      if (error) throw error

      return {
        success: true,
        data: data as CriterioEvaluacion
      }
    } catch (error: any) {
      console.error('Error al agregar criterio:', error)
      return {
        success: false,
        error: error.message || 'Error al agregar criterio'
      }
    }
  }

  async actualizarCriterioEvaluacion(
    id: number,
    criterio: string | null = null,
    descripcion: string | null = null,
    calificacion: number | null = null,
    peso: number | null = null,
    comentarios: string | null = null
  ): Promise<ApiResponse<CriterioEvaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('actualizar_criterio_evaluacion', {
        p_id: id,
        p_criterio: criterio,
        p_descripcion: descripcion,
        p_calificacion: calificacion,
        p_peso: peso,
        p_comentarios: comentarios
      })

      if (error) throw error

      return {
        success: true,
        data: data as CriterioEvaluacion
      }
    } catch (error: any) {
      console.error('Error al actualizar criterio:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar criterio'
      }
    }
  }

  async actualizarEvaluacion(
    id: number,
    tipoEvaluacion: string | null = null,
    periodoEvaluacion: string | null = null,
    fechaEvaluacion: string | null = null,
    fechaInicioPeriodo: string | null = null,
    fechaFinPeriodo: string | null = null,
    estado: string | null = null,
    comentariosEvaluador: string | null = null,
    comentariosEvaluado: string | null = null,
    objetivosCumplidos: string | null = null,
    areasMejora: string | null = null,
    recomendaciones: string | null = null
  ): Promise<ApiResponse<Evaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('actualizar_evaluacion', {
        p_id: id,
        p_tipo_evaluacion: tipoEvaluacion,
        p_periodo_evaluacion: periodoEvaluacion,
        p_fecha_evaluacion: fechaEvaluacion,
        p_fecha_inicio_periodo: fechaInicioPeriodo,
        p_fecha_fin_periodo: fechaFinPeriodo,
        p_estado: estado,
        p_comentarios_evaluador: comentariosEvaluador,
        p_comentarios_evaluado: comentariosEvaluado,
        p_objetivos_cumplidos: objetivosCumplidos,
        p_areas_mejora: areasMejora,
        p_recomendaciones: recomendaciones
      })

      if (error) throw error

      return {
        success: true,
        data: data as Evaluacion
      }
    } catch (error: any) {
      console.error('Error al actualizar evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar evaluación'
      }
    }
  }

  async aprobarEvaluacion(
    id: number,
    idAprobador: number
  ): Promise<ApiResponse<Evaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('aprobar_evaluacion', {
        p_id: id,
        p_id_aprobador: idAprobador
      })

      if (error) throw error

      return {
        success: true,
        data: data as Evaluacion
      }
    } catch (error: any) {
      console.error('Error al aprobar evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al aprobar evaluación'
      }
    }
  }

  async eliminarCriterioEvaluacion(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_criterio_evaluacion', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar criterio:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar criterio'
      }
    }
  }

  async eliminarEvaluacion(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_evaluacion', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar evaluación'
      }
    }
  }

  // ============================================
  // CAPACITACIONES
  // ============================================

  async crearCapacitacion(
    titulo: string,
    descripcion: string | null = null,
    creadoPor: number,
    tipoCapacitacion: 'presencial' | 'virtual' | 'mixta' | 'online' = 'presencial',
    categoria: string | null = null,
    duracionHoras: number | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    fechaLimiteInscripcion: string | null = null,
    cupoMaximo: number | null = null,
    lugar: string | null = null,
    linkVirtual: string | null = null,
    instructor: string | null = null,
    esObligatoria: boolean = false,
    requiereAprobacion: boolean = true,
    materialAdjuntoUrl: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<Capacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_capacitacion', {
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_creado_por: creadoPor,
        p_tipo_capacitacion: tipoCapacitacion,
        p_categoria: categoria,
        p_duracion_horas: duracionHoras,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_fecha_limite_inscripcion: fechaLimiteInscripcion,
        p_cupo_maximo: cupoMaximo,
        p_lugar: lugar,
        p_link_virtual: linkVirtual,
        p_instructor: instructor,
        p_es_obligatoria: esObligatoria,
        p_requiere_aprobacion: requiereAprobacion,
        p_material_adjunto_url: materialAdjuntoUrl,
        p_observaciones: observaciones
      })

      if (error) throw error

      const capacitacionCreada = data as Capacitacion

      // Notificar a todos los usuarios sobre la nueva capacitación
      if (capacitacionCreada.estado === 'abierta') {
        await this.enviarNotificacionMasiva({
          titulo: `📚 Nueva Capacitación: ${titulo}`,
          descripcion: descripcion || `Se ha creado una nueva capacitación. ${esObligatoria ? '⚠️ Esta capacitación es obligatoria.' : ''}`,
          tipo: esObligatoria ? 'warning' : 'info',
          enviar_a_todos: true,
          id_usuario_emisor: creadoPor
        })
      }

      return {
        success: true,
        data: capacitacionCreada
      }
    } catch (error: any) {
      console.error('Error al crear capacitación:', error)
      return {
        success: false,
        error: error.message || 'Error al crear capacitación'
      }
    }
  }

  async obtenerCapacitaciones(
    estado: string | null = null,
    tipoCapacitacion: string | null = null,
    categoria: string | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null,
    idUsuario: number | null = null
  ): Promise<ApiResponse<Capacitacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_capacitaciones', {
        p_estado: estado,
        p_tipo_capacitacion: tipoCapacitacion,
        p_categoria: categoria,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Capacitacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener capacitaciones:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener capacitaciones'
      }
    }
  }

  async inscribirseCapacitacion(
    idCapacitacion: number,
    idUsuario: number
  ): Promise<ApiResponse<InscripcionCapacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('inscribirse_capacitacion', {
        p_id_capacitacion: idCapacitacion,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      const inscripcion = data as InscripcionCapacitacion

      // Obtener información de la capacitación para la notificación
      const capacitacionRes = await this.obtenerCapacitaciones(null, null, null, null, null, idUsuario)
      const capacitacion = capacitacionRes.data?.find(c => c.id === idCapacitacion)

      // Notificar al usuario sobre su inscripción
      if (inscripcion.estado === 'pendiente') {
        await this.createNotification({
          user_id: idUsuario,
          title: '📚 Inscripción Pendiente de Aprobación',
          description: `Tu inscripción a "${capacitacion?.titulo || 'la capacitación'}" está pendiente de aprobación por Recursos Humanos.`,
          type: 'info',
          capacitacion_id: idCapacitacion
        })
      } else {
        await this.createNotification({
          user_id: idUsuario,
          title: '✅ Inscripción Confirmada',
          description: `Te has inscrito exitosamente a "${capacitacion?.titulo || 'la capacitación'}".`,
          type: 'success',
          capacitacion_id: idCapacitacion
        })
      }

      return {
        success: true,
        data: inscripcion
      }
    } catch (error: any) {
      console.error('Error al inscribirse:', error)
      return {
        success: false,
        error: error.message || 'Error al inscribirse a la capacitación'
      }
    }
  }

  async aprobarRechazarInscripcion(
    id: number,
    estado: 'aprobado' | 'rechazado',
    idAprobador: number,
    motivoRechazo: string | null = null
  ): Promise<ApiResponse<InscripcionCapacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('aprobar_rechazar_inscripcion', {
        p_id: id,
        p_estado: estado,
        p_id_aprobador: idAprobador,
        p_motivo_rechazo: motivoRechazo || ''
      })

      if (error) throw error

      const inscripcionActualizada = data as InscripcionCapacitacion

      // Obtener información de la capacitación
      const capacitacionRes = await this.obtenerCapacitaciones(null, null, null, null, null, inscripcionActualizada.id_usuario)
      const capacitacion = capacitacionRes.data?.find(c => c.id === inscripcionActualizada.id_capacitacion)

      // Notificar al usuario sobre la aprobación/rechazo
      if (estado === 'aprobado') {
        await this.createNotification({
          user_id: inscripcionActualizada.id_usuario,
          title: '✅ Inscripción Aprobada',
          description: `Tu inscripción a "${capacitacion?.titulo || 'la capacitación'}" ha sido aprobada.`,
          type: 'success',
          capacitacion_id: inscripcionActualizada.id_capacitacion
        })
      } else if (estado === 'rechazado') {
        await this.createNotification({
          user_id: inscripcionActualizada.id_usuario,
          title: '❌ Inscripción Rechazada',
          description: `Tu inscripción a "${capacitacion?.titulo || 'la capacitación'}" ha sido rechazada.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''}`,
          type: 'error',
          capacitacion_id: inscripcionActualizada.id_capacitacion
        })
      }

      return {
        success: true,
        data: inscripcionActualizada
      }
    } catch (error: any) {
      console.error('Error al aprobar/rechazar inscripción:', error)
      return {
        success: false,
        error: error.message || 'Error al procesar la inscripción'
      }
    }
  }

  async obtenerInscripcionesCapacitacion(
    idCapacitacion: number,
    estado: string | null = null
  ): Promise<ApiResponse<InscripcionCapacitacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_inscripciones_capacitacion', {
        p_id_capacitacion: idCapacitacion,
        p_estado: estado
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as InscripcionCapacitacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener inscripciones:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener inscripciones'
      }
    }
  }

  async obtenerCapacitacionesUsuario(
    idUsuario: number,
    estadoInscripcion: string | null = null
  ): Promise<ApiResponse<Capacitacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_capacitaciones_usuario', {
        p_id_usuario: idUsuario,
        p_estado_inscripcion: estadoInscripcion
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Capacitacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener capacitaciones del usuario:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener capacitaciones'
      }
    }
  }

  async actualizarCapacitacion(
    id: number,
    titulo: string | null = null,
    descripcion: string | null = null,
    tipoCapacitacion: string | null = null,
    categoria: string | null = null,
    duracionHoras: number | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    fechaLimiteInscripcion: string | null = null,
    cupoMaximo: number | null = null,
    lugar: string | null = null,
    linkVirtual: string | null = null,
    instructor: string | null = null,
    estado: string | null = null,
    esObligatoria: boolean | null = null,
    requiereAprobacion: boolean | null = null,
    materialAdjuntoUrl: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<Capacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Obtener capacitación actual para comparar estado
      const capacitacionActualRes = await this.obtenerCapacitaciones(null, null, null, null, null, null)
      const capacitacionActual = capacitacionActualRes.data?.find(c => c.id === id)

      const { data, error } = await supabase.rpc('actualizar_capacitacion', {
        p_id: id,
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_tipo_capacitacion: tipoCapacitacion,
        p_categoria: categoria,
        p_duracion_horas: duracionHoras,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_fecha_limite_inscripcion: fechaLimiteInscripcion,
        p_cupo_maximo: cupoMaximo,
        p_lugar: lugar,
        p_link_virtual: linkVirtual,
        p_instructor: instructor,
        p_estado: estado,
        p_es_obligatoria: esObligatoria,
        p_requiere_aprobacion: requiereAprobacion,
        p_material_adjunto_url: materialAdjuntoUrl,
        p_observaciones: observaciones
      })

      if (error) throw error

      const capacitacionActualizada = data as Capacitacion

      // Si el estado cambió a "abierta" y antes no lo era, notificar a todos
      if (estado === 'abierta' && capacitacionActual?.estado !== 'abierta') {
        await this.enviarNotificacionMasiva({
          titulo: `📚 Nueva Capacitación Disponible: ${capacitacionActualizada.titulo}`,
          descripcion: capacitacionActualizada.descripcion || `Se ha abierto una nueva capacitación. ${capacitacionActualizada.es_obligatoria ? '⚠️ Esta capacitación es obligatoria.' : ''}`,
          tipo: capacitacionActualizada.es_obligatoria ? 'warning' : 'info',
          enviar_a_todos: true
        })
      }

      // Si se canceló, notificar a los inscritos
      if (estado === 'cancelada' && capacitacionActual?.estado !== 'cancelada') {
        const inscripcionesRes = await this.obtenerInscripcionesCapacitacion(id, null)
        if (inscripcionesRes.success && inscripcionesRes.data) {
          for (const inscripcion of inscripcionesRes.data) {
            if (inscripcion.estado !== 'cancelado' && inscripcion.estado !== 'completado') {
              await this.createNotification({
                user_id: inscripcion.id_usuario,
                title: '⚠️ Capacitación Cancelada',
                description: `La capacitación "${capacitacionActualizada.titulo}" ha sido cancelada.`,
                type: 'warning',
                capacitacion_id: id
              })
            }
          }
        }
      }

      return {
        success: true,
        data: capacitacionActualizada
      }
    } catch (error: any) {
      console.error('Error al actualizar capacitación:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar capacitación'
      }
    }
  }

  async registrarAsistenciaCapacitacion(
    idInscripcion: number,
    asistio: boolean,
    calificacion: number | null = null,
    comentarios: string | null = null
  ): Promise<ApiResponse<InscripcionCapacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_asistencia_capacitacion', {
        p_id_inscripcion: idInscripcion,
        p_asistio: asistio,
        p_calificacion: calificacion,
        p_comentarios: comentarios
      })

      if (error) throw error

      const inscripcionActualizada = data as InscripcionCapacitacion

      // Obtener información de la capacitación
      const inscripcionRes = await this.obtenerInscripcionesCapacitacion(inscripcionActualizada.id_capacitacion, null)
      const inscripcionCompleta = inscripcionRes.data?.find(i => i.id === idInscripcion)
      
      if (inscripcionCompleta) {
        const capacitacionRes = await this.obtenerCapacitaciones(null, null, null, null, null, inscripcionCompleta.id_usuario)
        const capacitacion = capacitacionRes.data?.find(c => c.id === inscripcionActualizada.id_capacitacion)

        // Notificar al usuario sobre su asistencia y calificación
        if (asistio && calificacion !== null) {
          await this.createNotification({
            user_id: inscripcionCompleta.id_usuario,
            title: '📊 Calificación Registrada',
            description: `Tu asistencia y calificación (${calificacion}/10) han sido registradas para "${capacitacion?.titulo || 'la capacitación'}".`,
            type: 'success',
            capacitacion_id: inscripcionActualizada.id_capacitacion
          })
        } else if (asistio) {
          await this.createNotification({
            user_id: inscripcionCompleta.id_usuario,
            title: '✅ Asistencia Registrada',
            description: `Tu asistencia ha sido registrada para "${capacitacion?.titulo || 'la capacitación'}".`,
            type: 'success',
            capacitacion_id: inscripcionActualizada.id_capacitacion
          })
        } else {
          await this.createNotification({
            user_id: inscripcionCompleta.id_usuario,
            title: '⚠️ Ausencia Registrada',
            description: `Se ha registrado tu ausencia para "${capacitacion?.titulo || 'la capacitación'}".`,
            type: 'warning',
            capacitacion_id: inscripcionActualizada.id_capacitacion
          })
        }
      }

      return {
        success: true,
        data: inscripcionActualizada
      }
    } catch (error: any) {
      console.error('Error al registrar asistencia:', error)
      return {
        success: false,
        error: error.message || 'Error al registrar asistencia'
      }
    }
  }

  async cancelarInscripcion(
    idInscripcion: number,
    idUsuario: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('cancelar_inscripcion', {
        p_id_inscripcion: idInscripcion,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al cancelar inscripción:', error)
      return {
        success: false,
        error: error.message || 'Error al cancelar inscripción'
      }
    }
  }

  async eliminarCapacitacion(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_capacitacion', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar capacitación:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar capacitación'
      }
    }
  }

  // ========== MENÚ DIARIO ==========
  
  async crearActualizarMenuDiario(
    platos: string[],
    creadoPor: number,
    fecha: string | null = null
  ): Promise<ApiResponse<MenuDiario>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Si no se especifica fecha, no pasamos el parámetro para que use el DEFAULT CURRENT_DATE
      const params: any = {
        p_creado_por: creadoPor,
        p_platos: platos.filter(p => p && p.trim() !== '')
      }
      
      // Solo agregar p_fecha si se especifica explícitamente
      if (fecha) {
        params.p_fecha = fecha
      }
      
      const { data, error } = await supabase.rpc('crear_actualizar_menu_diario', params)

      if (error) throw error

      return {
        success: true,
        data: data as MenuDiario
      }
    } catch (error: any) {
      console.error('Error al crear/actualizar menú diario:', error)
      return {
        success: false,
        error: error.message || 'Error al crear/actualizar menú diario'
      }
    }
  }

  async obtenerMenusDiarios(
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<MenuDiario[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_menus_diarios', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as MenuDiario[]
      }
    } catch (error: any) {
      console.error('Error al obtener menús diarios:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener menús diarios'
      }
    }
  }

  async obtenerMenuDiaActual(): Promise<ApiResponse<MenuDiario | null>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Calendario "hoy" = mismo criterio que el plazo 10:15 menú (Intl AR), no el reloj del servidor Postgres.
      const hoyYmd = getArgentinaDateString()
      const { data, error } = await supabase.rpc('obtener_menus_diarios', {
        p_fecha_desde: hoyYmd,
        p_fecha_hasta: hoyYmd
      })

      if (error) throw error

      let rows: unknown[] = Array.isArray(data) ? data : []
      if (!Array.isArray(data) && data && typeof data === 'object') {
        const o = data as Record<string, unknown>
        const keys = Object.keys(o)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b))
        rows = keys.map((k) => o[k])
      }

      const raw = rows.length > 0 ? (rows[0] as MenuDiario) : null
      if (!raw) {
        return { success: true, data: null }
      }
      const fechaYmd = legajoCalendarDateKey(String(raw.fecha ?? ''))
      return {
        success: true,
        data: {
          ...raw,
          fecha: fechaYmd.length >= 10 ? fechaYmd : String(raw.fecha ?? '')
        } as MenuDiario
      }
    } catch (error: any) {
      console.error('Error al obtener menú del día actual:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener menú del día actual'
      }
    }
  }

  async seleccionarPlatoMenu(
    idMenu: number,
    idUsuario: number,
    idPlato: number,
    turnoAlmuerzo: 1 | 2 | 3,
    emojiEstado: string
  ): Promise<ApiResponse<MenuSeleccion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('seleccionar_plato_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario,
        p_id_plato: idPlato,
        p_turno_almuerzo: turnoAlmuerzo,
        p_emoji_estado: emojiEstado
      })

      if (error) throw error

      return {
        success: true,
        data: data as MenuSeleccion
      }
    } catch (error: any) {
      console.error('Error al seleccionar plato:', error)
      return {
        success: false,
        error: error.message || 'Error al seleccionar plato'
      }
    }
  }

  async actualizarSoloTurnoMenu(
    idMenu: number,
    idUsuario: number,
    turnoAlmuerzo: 1 | 2 | 3
  ): Promise<ApiResponse<MenuSeleccion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('actualizar_solo_turno_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario,
        p_turno_almuerzo: turnoAlmuerzo
      })

      if (error) throw error

      return {
        success: true,
        data: data as MenuSeleccion
      }
    } catch (error: any) {
      console.error('Error al actualizar turno de menú:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar turno de almuerzo'
      }
    }
  }

  async obtenerSeleccionesMenu(idMenu: number): Promise<ApiResponse<MenuSeleccion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_selecciones_menu', {
        p_id_menu: idMenu
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as MenuSeleccion[]
      }
    } catch (error: any) {
      console.error('Error al obtener selecciones del menú:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener selecciones del menú'
      }
    }
  }

  async obtenerSeleccionUsuarioMenu(
    idMenu: number,
    idUsuario: number
  ): Promise<ApiResponse<MenuSeleccion | null>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_seleccion_usuario_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: (data && data.length > 0) ? data[0] as MenuSeleccion : null
      }
    } catch (error: any) {
      console.error('Error al obtener selección del usuario:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener selección del usuario'
      }
    }
  }

  async eliminarMenuDiario(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_menu_diario', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar menú diario:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar menú diario'
      }
    }
  }

  async cancelarSeleccionMenu(
    idMenu: number,
    idUsuario: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('cancelar_seleccion_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al cancelar selección:', error)
      return {
        success: false,
        error: error.message || 'Error al cancelar selección'
      }
    }
  }

  private mapMenuDescuentoBeneficioRow(row: Record<string, unknown>): MenuDescuentoBeneficioComida {
    const u = row.usuarios as { nombre?: string } | { nombre?: string }[] | null | undefined
    const nombre =
      Array.isArray(u) ? u[0]?.nombre : u && typeof u === 'object' ? u.nombre : undefined
    return {
      id: Number(row.id),
      id_usuario: Number(row.id_usuario),
      nombre_usuario: nombre ?? undefined,
      id_menu: Number(row.id_menu),
      id_seleccion: row.id_seleccion != null ? Number(row.id_seleccion) : null,
      id_novedad: row.id_novedad != null ? Number(row.id_novedad) : null,
      fecha: String(row.fecha ?? '').slice(0, 10),
      monto: Number(row.monto) || 7000,
      nombre_plato: row.nombre_plato != null ? String(row.nombre_plato) : null,
      created_at: String(row.created_at ?? '')
    }
  }

  async menuDescuentoBeneficioRegistrar(input: {
    id_usuario: number
    id_menu: number
    id_seleccion: number
    id_novedad: number | null
    fecha: string
    nombre_plato?: string | null
    monto?: number
  }): Promise<ApiResponse<MenuDescuentoBeneficioComida>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const row = {
        id_usuario: input.id_usuario,
        id_menu: input.id_menu,
        id_seleccion: input.id_seleccion,
        id_novedad: input.id_novedad,
        fecha: input.fecha,
        monto: input.monto ?? 7000,
        nombre_plato: input.nombre_plato ?? null
      }
      await supabase.from('menu_descuentos_beneficio_comida').delete().eq('id_seleccion', input.id_seleccion)
      const { data, error } = await supabase
        .from('menu_descuentos_beneficio_comida')
        .insert(row)
        .select('*')
        .single()
      if (error) throw error
      return {
        success: true,
        data: this.mapMenuDescuentoBeneficioRow(data as Record<string, unknown>)
      }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'No se pudo registrar el descuento de comida')
      }
    }
  }

  async menuDescuentosBeneficioListar(filters?: {
    idUsuario?: number
    idNovedad?: number
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<ApiResponse<MenuDescuentoBeneficioComida[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      // Sin join a usuarios: el SELECT directo falla por RLS (permission denied).
      let q = supabase
        .from('menu_descuentos_beneficio_comida')
        .select('*')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
      if (filters?.idUsuario) q = q.eq('id_usuario', filters.idUsuario)
      if (filters?.idNovedad) q = q.eq('id_novedad', filters.idNovedad)
      if (filters?.fechaDesde) q = q.gte('fecha', filters.fechaDesde)
      if (filters?.fechaHasta) q = q.lte('fecha', filters.fechaHasta)
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as Record<string, unknown>[]
      const ids = [
        ...new Set(
          rows
            .map((r) => Number(r.id_usuario))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      ]
      const nameById = new Map<number, string>()
      if (ids.length > 0) {
        const { data: usuariosRows, error: usuariosErr } = await supabase.rpc(
          'obtener_usuarios_por_ids',
          { p_ids: ids }
        )
        if (!usuariosErr && Array.isArray(usuariosRows)) {
          for (const u of usuariosRows as UsuarioRecord[]) {
            if (u?.id) nameById.set(u.id, u.nombre)
          }
        }
      }
      return {
        success: true,
        data: rows.map((r) => {
          const idUsuario = Number(r.id_usuario)
          const nombre = nameById.get(idUsuario)
          return this.mapMenuDescuentoBeneficioRow({
            ...r,
            usuarios: nombre ? { nombre } : null
          })
        })
      }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'No se pudieron listar descuentos de comida')
      }
    }
  }

  async menuDescuentosBeneficioAcumulado(filters: {
    idUsuario: number
    idNovedad?: number
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<ApiResponse<{ cantidad: number; total: number }>> {
    const res = await this.menuDescuentosBeneficioListar(filters)
    if (!res.success || !res.data) {
      return { success: false, error: res.error ?? 'Error al calcular acumulado' }
    }
    const cantidad = res.data.length
    const total = res.data.reduce((s, r) => s + (r.monto || 0), 0)
    return { success: true, data: { cantidad, total } }
  }

  async menuDescuentoBeneficioEliminarPorSeleccion(
    idSeleccion: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const { error } = await supabase
        .from('menu_descuentos_beneficio_comida')
        .delete()
        .eq('id_seleccion', idSeleccion)
      if (error) throw error
      return { success: true, data: true }
    } catch (e) {
      return {
        success: false,
        error: supabaseErrorMessage(e, 'No se pudo anular el descuento')
      }
    }
  }

  menuDescuentosBeneficioResumenPorEmpleado(
    rows: MenuDescuentoBeneficioComida[]
  ): MenuDescuentoBeneficioResumen[] {
    const map = new Map<number, MenuDescuentoBeneficioResumen>()
    for (const r of rows) {
      const prev = map.get(r.id_usuario)
      if (prev) {
        prev.cantidad_pedidos += 1
        prev.total_monto += r.monto
      } else {
        map.set(r.id_usuario, {
          id_usuario: r.id_usuario,
          nombre_usuario: r.nombre_usuario || `Usuario ${r.id_usuario}`,
          cantidad_pedidos: 1,
          total_monto: r.monto,
          fecha_desde_novedad: null,
          fecha_hasta_novedad: null
        })
      }
    }
    return [...map.values()].sort((a, b) => b.total_monto - a.total_monto)
  }

  async solicitarIntercambioTurnoMenu(
    idMenu: number,
    idSolicita: number,
    idDestino: number
  ): Promise<ApiResponse<MenuIntercambioTurno>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const { data, error } = await supabase.rpc('solicitar_intercambio_turno_menu', {
        p_id_menu: idMenu,
        p_id_solicita: idSolicita,
        p_id_destino: idDestino
      })
      if (error) throw error
      return { success: true, data: data as MenuIntercambioTurno }
    } catch (error: any) {
      console.error('Error al solicitar intercambio de turno:', error)
      return { success: false, error: error.message || 'No se pudo enviar la solicitud' }
    }
  }

  async obtenerIntercambiosTurnoMenu(
    idUsuario: number,
    idMenu?: number
  ): Promise<ApiResponse<MenuIntercambioTurno[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const { data, error } = await supabase.rpc('obtener_intercambios_turno_menu', {
        p_id_usuario: idUsuario,
        p_id_menu: idMenu ?? null
      })
      if (error) throw error
      let raw: unknown = data
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw)
        } catch {
          raw = []
        }
      }
      const list = Array.isArray(raw) ? raw : []
      return { success: true, data: list as MenuIntercambioTurno[] }
    } catch (error: any) {
      console.error('Error al listar intercambios de turno:', error)
      return { success: false, error: error.message || 'Error al cargar solicitudes' }
    }
  }

  async responderIntercambioTurnoMenu(
    idIntercambio: number,
    idUsuario: number,
    accion: 'aceptar' | 'rechazar' | 'cancelar'
  ): Promise<ApiResponse<MenuIntercambioTurno>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }
    try {
      const { data, error } = await supabase.rpc('responder_intercambio_turno_menu', {
        p_id_intercambio: idIntercambio,
        p_id_usuario: idUsuario,
        p_accion: accion
      })
      if (error) throw error
      return { success: true, data: data as MenuIntercambioTurno }
    } catch (error: any) {
      console.error('Error al responder intercambio de turno:', error)
      return { success: false, error: error.message || 'No se pudo procesar la solicitud' }
    }
  }

  // ========== CRM DE VENTAS ==========

  async crearOportunidadVenta(oportunidad: {
    cliente_nombre: string
    cliente_telefono?: string
    cliente_email?: string
    cliente_dni_cuit?: string
    cliente_empresa?: string
    cliente_direccion?: string
    descripcion?: string
    valor_estimado?: number
    probabilidad_cierre?: number
    etapa?: 'Prospecto' | 'Calificación' | 'Propuesta' | 'Negociación' | 'Cerrado' | 'Perdido'
    fecha_cierre_estimada?: string
    id_vendedor: number
    nombre_vendedor: string
    observaciones?: string
    id_cliente?: number
  }): Promise<ApiResponse<{ id: number; numero_oportunidad: string }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_oportunidad_venta', {
        p_cliente_nombre: oportunidad.cliente_nombre,
        p_id_vendedor: oportunidad.id_vendedor,
        p_nombre_vendedor: oportunidad.nombre_vendedor,
        p_cliente_telefono: oportunidad.cliente_telefono || null,
        p_cliente_email: oportunidad.cliente_email || null,
        p_cliente_dni_cuit: oportunidad.cliente_dni_cuit || null,
        p_cliente_empresa: oportunidad.cliente_empresa || null,
        p_cliente_direccion: oportunidad.cliente_direccion || null,
        p_descripcion: oportunidad.descripcion || null,
        p_valor_estimado: oportunidad.valor_estimado || null,
        p_probabilidad_cierre: oportunidad.probabilidad_cierre || 50,
        p_etapa: oportunidad.etapa || 'Prospecto',
        p_fecha_cierre_estimada: oportunidad.fecha_cierre_estimada || null,
        p_observaciones: oportunidad.observaciones || null,
        p_id_cliente: (oportunidad as any).id_cliente || null
      })

      if (error) throw error

      return {
        success: true,
        data: data.data as { id: number; numero_oportunidad: string }
      }
    } catch (error: any) {
      console.error('Error al crear oportunidad de venta:', error)
      return {
        success: false,
        error: error.message || 'Error al crear oportunidad de venta'
      }
    }
  }

  async actualizarOportunidadVenta(
    id: number,
    datos: {
      cliente_nombre?: string
      cliente_telefono?: string
      cliente_email?: string
      cliente_dni_cuit?: string
      cliente_empresa?: string
      cliente_direccion?: string
      descripcion?: string
      valor_estimado?: number
      probabilidad_cierre?: number
      etapa?: 'Prospecto' | 'Calificación' | 'Propuesta' | 'Negociación' | 'Cerrado' | 'Perdido'
      fecha_cierre_estimada?: string
      id_op?: number
      numero_op?: string
      observaciones?: string
      activo?: boolean
    }
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { error } = await supabase.rpc('actualizar_oportunidad_venta', {
        p_id: id,
        p_cliente_nombre: datos.cliente_nombre || null,
        p_cliente_telefono: datos.cliente_telefono || null,
        p_cliente_email: datos.cliente_email || null,
        p_cliente_dni_cuit: datos.cliente_dni_cuit || null,
        p_cliente_empresa: datos.cliente_empresa || null,
        p_cliente_direccion: datos.cliente_direccion || null,
        p_descripcion: datos.descripcion || null,
        p_valor_estimado: datos.valor_estimado || null,
        p_probabilidad_cierre: datos.probabilidad_cierre || null,
        p_etapa: datos.etapa || null,
        p_fecha_cierre_estimada: datos.fecha_cierre_estimada || null,
        p_id_op: datos.id_op || null,
        p_numero_op: datos.numero_op || null,
        p_observaciones: datos.observaciones || null,
        p_activo: datos.activo !== undefined ? datos.activo : null
      })

      if (error) throw error

      return {
        success: true,
        data: true
      }
    } catch (error: any) {
      console.error('Error al actualizar oportunidad de venta:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar oportunidad de venta'
      }
    }
  }

  async obtenerOportunidadesVenta(
    idVendedor?: number,
    etapa?: 'Prospecto' | 'Calificación' | 'Propuesta' | 'Negociación' | 'Cerrado' | 'Perdido',
    activo?: boolean
  ): Promise<ApiResponse<Array<import('../types/api').OportunidadVenta>>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_oportunidades_venta', {
        p_id_vendedor: idVendedor || null,
        p_etapa: etapa || null,
        p_activo: activo !== undefined ? activo : true
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Array<import('../types/api').OportunidadVenta>
      }
    } catch (error: any) {
      console.error('Error al obtener oportunidades de venta:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener oportunidades de venta'
      }
    }
  }

  async crearSeguimientoVenta(seguimiento: {
    id_oportunidad: number
    tipo_seguimiento: 'Llamada' | 'Email' | 'Reunión' | 'WhatsApp' | 'Visita' | 'Propuesta' | 'Otro'
    descripcion: string
    proxima_accion?: string
    fecha_proxima_accion?: string
    id_usuario: number
    nombre_usuario: string
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_seguimiento_venta', {
        p_id_oportunidad: seguimiento.id_oportunidad,
        p_tipo_seguimiento: seguimiento.tipo_seguimiento,
        p_descripcion: seguimiento.descripcion,
        p_proxima_accion: seguimiento.proxima_accion || null,
        p_fecha_proxima_accion: seguimiento.fecha_proxima_accion || null,
        p_id_usuario: seguimiento.id_usuario,
        p_nombre_usuario: seguimiento.nombre_usuario
      })

      if (error) throw error

      return {
        success: true,
        data: data.data as { id: number }
      }
    } catch (error: any) {
      console.error('Error al crear seguimiento de venta:', error)
      return {
        success: false,
        error: error.message || 'Error al crear seguimiento de venta'
      }
    }
  }

  async crearVentaDirecta(venta: {
    cliente_nombre: string
    cliente_telefono?: string
    cliente_email?: string
    cliente_dni_cuit?: string
    cliente_empresa?: string
    cliente_direccion?: string
    valor_total: number
    metodo_pago?: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'
    estado_pago?: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado'
    fecha_venta?: string
    id_vendedor: number
    nombre_vendedor: string
    id_cliente?: number
    observaciones?: string
  }): Promise<ApiResponse<{ id: number; numero_venta: string }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_venta_directa', {
        p_cliente_nombre: venta.cliente_nombre,
        p_valor_total: venta.valor_total,
        p_id_vendedor: venta.id_vendedor,
        p_nombre_vendedor: venta.nombre_vendedor,
        p_cliente_telefono: venta.cliente_telefono || null,
        p_cliente_email: venta.cliente_email || null,
        p_cliente_dni_cuit: venta.cliente_dni_cuit || null,
        p_cliente_empresa: venta.cliente_empresa || null,
        p_cliente_direccion: venta.cliente_direccion || null,
        p_metodo_pago: venta.metodo_pago || null,
        p_estado_pago: venta.estado_pago || 'Pendiente',
        p_fecha_venta: venta.fecha_venta || null,
        p_observaciones: venta.observaciones || null,
        p_id_cliente: venta.id_cliente || null
      })

      if (error) throw error

      // La función RPC devuelve un JSON con {success: true, data: {...}}
      let ventaCreada: { id: number; numero_venta: string } | null = null

      if (data && typeof data === 'object' && 'success' in data) {
        const result = data as any
        if (result.success && result.data) {
          ventaCreada = result.data as { id: number; numero_venta: string }
        }
      } else if (data && typeof data === 'object' && 'id' in data) {
        ventaCreada = data as { id: number; numero_venta: string }
      }

      if (!ventaCreada) throw new Error('Formato de respuesta inesperado')

      void syncCajaDesdeVentaApi({
        id: ventaCreada.id,
        numero_venta: ventaCreada.numero_venta,
        cliente_nombre: venta.cliente_nombre,
        valor_total: venta.valor_total,
        metodo_pago: venta.metodo_pago ?? null,
        estado_pago: venta.estado_pago ?? null,
        fecha_venta: venta.fecha_venta ?? null,
        id_vendedor: venta.id_vendedor,
        nombre_vendedor: venta.nombre_vendedor
      })

      return { success: true, data: ventaCreada }
    } catch (error: any) {
      console.error('Error al crear venta directa:', error)
      return {
        success: false,
        error: error.message || 'Error al crear venta directa'
      }
    }
  }

  /**
   * Sube comprobante de pago (imagen o PDF) al bucket archivos y guarda la URL en la venta.
   */
  async subirComprobantePagoVenta(
    idVenta: number,
    file: File
  ): Promise<ApiResponse<{ url: string }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    const maxBytes = 8 * 1024 * 1024
    if (file.size > maxBytes) {
      return { success: false, error: 'El archivo supera 8 MB' }
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const allowedExt = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'])
    if (!allowedExt.has(ext)) {
      return { success: false, error: 'Formato no permitido. Use PDF, JPG, PNG, WEBP o GIF.' }
    }

    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80)
    const path = `ventas-comprobantes/${idVenta}/${Date.now()}_${safeBase}.${ext}`

    try {
      const { error: uploadError } = await supabase.storage.from('archivos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `application/${ext === 'pdf' ? 'pdf' : 'octet-stream'}`
      })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) {
        return { success: false, error: 'No se pudo obtener la URL pública del archivo' }
      }

      const { error: dbError } = await supabase
        .from('ventas')
        .update({
          comprobante_pago_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', idVenta)

      if (dbError) {
        return { success: false, error: dbError.message }
      }

      return { success: true, data: { url: publicUrl } }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al subir comprobante'
      }
    }
  }

  async crearVentaDesdeOportunidad(venta: {
    id_oportunidad: number
    id_op: number
    numero_op: string
    valor_total: number
    metodo_pago?: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'
    estado_pago?: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado'
    fecha_venta?: string
    id_vendedor: number
    nombre_vendedor: string
    observaciones?: string
  }): Promise<ApiResponse<{ id: number; numero_venta: string }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_venta_desde_oportunidad', {
        p_id_oportunidad: venta.id_oportunidad,
        p_id_op: venta.id_op,
        p_numero_op: venta.numero_op,
        p_valor_total: venta.valor_total,
        p_metodo_pago: venta.metodo_pago || null,
        p_estado_pago: venta.estado_pago || 'Pendiente',
        p_fecha_venta: venta.fecha_venta || null,
        p_id_vendedor: venta.id_vendedor,
        p_nombre_vendedor: venta.nombre_vendedor,
        p_observaciones: venta.observaciones || null
      })

      if (error) throw error

      let payload: unknown = data
      if (typeof data === 'string') {
        try {
          payload = JSON.parse(data)
        } catch {
          throw new Error('Respuesta inválida al crear venta desde oportunidad')
        }
      }

      let ventaCreada: { id: number; numero_venta: string } | null = null

      if (payload && typeof payload === 'object' && 'success' in (payload as object)) {
        const result = payload as { success?: boolean; data?: { id: number; numero_venta: string }; error?: string }
        if (result.success && result.data) ventaCreada = result.data
        else throw new Error(result.error || 'No se pudo crear la venta desde la oportunidad')
      } else if (payload && typeof payload === 'object' && 'id' in (payload as object)) {
        ventaCreada = payload as { id: number; numero_venta: string }
      }

      if (!ventaCreada) throw new Error('Formato de respuesta inesperado al crear venta desde oportunidad')

      const ventaRes = await this.getVenta(ventaCreada.id)
      if (ventaRes.success && ventaRes.data) {
        void syncCajaDesdeVentaApi(ventaRes.data)
      }

      return { success: true, data: ventaCreada }
    } catch (error: any) {
      console.error('Error al crear venta desde oportunidad:', error)
      return {
        success: false,
        error: error.message || 'Error al crear venta desde oportunidad'
      }
    }
  }

  async obtenerVentasPorCliente(idCliente: number): Promise<ApiResponse<Array<import('../types/api').Venta>>> {
    if (!supabase) return { success: false, error: 'Supabase no inicializado' }
    if (!Number.isFinite(idCliente) || idCliente <= 0) {
      return { success: false, error: 'Cliente inválido' }
    }
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('id_cliente', idCliente)
        .order('fecha_venta', { ascending: false })
        .limit(120)
      if (error) throw error
      return { success: true, data: (data ?? []) as Array<import('../types/api').Venta> }
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al obtener ventas del cliente' }
    }
  }

  /** Ventas del CRM/mostrador que aún no tienen factura ERP asociada. */
  async listVentasPendientesFacturacion(limit = 100): Promise<ApiResponse<Array<import('../types/api').Venta>>> {
    if (!supabase) return { success: false, error: 'Supabase no inicializado' }
    try {
      const ventasRes = await this.obtenerVentas(undefined, undefined, undefined, 'todos')
      if (!ventasRes.success || !ventasRes.data) {
        return { success: false, error: ventasRes.error || 'No se pudieron cargar ventas' }
      }
      const { data: facturadas, error } = await supabase
        .from('facturas_venta')
        .select('id_venta')
        .not('id_venta', 'is', null)
        .neq('estado', 'Anulada')
      if (error) return { success: false, error: error.message }
      const idsFacturadas = new Set(
        (facturadas || []).map((f: { id_venta?: number | null }) => f.id_venta).filter((id): id is number => id != null)
      )
      const pendientes = ventasRes.data.filter((v) => !idsFacturadas.has(v.id) && v.estado_pago !== 'Cancelado')
      return { success: true, data: pendientes.slice(0, limit) }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Error al listar ventas pendientes' }
    }
  }

  async obtenerVentas(
    idVendedor?: number,
    fechaDesde?: string,
    fechaHasta?: string,
    estadoPago?: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado' | 'todos'
  ): Promise<ApiResponse<Array<import('../types/api').Venta>>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_ventas', {
        p_id_vendedor: idVendedor || null,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || null,
        p_estado_pago: estadoPago === 'todos' ? null : (estadoPago || null)
      })

      if (error) {
        console.error('Error RPC obtener_ventas:', error)
        throw error
      }

      // La función RPC devuelve JSON directamente
      // Supabase puede devolverlo como string JSON o como objeto ya parseado
      let ventasData: any[] = []

      if (data === null || data === undefined) {
        console.warn('Data es null o undefined, retornando array vacío')
        ventasData = []
      } else if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data)
          // Si el string JSON contiene un array, usarlo directamente
          // Si contiene un objeto con un array dentro, extraerlo
          if (Array.isArray(parsed)) {
            ventasData = parsed
          } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
            ventasData = parsed.data
          } else if (parsed && typeof parsed === 'object') {
            // Si es un objeto único, convertirlo a array
            ventasData = [parsed]
          }
        } catch (e) {
          console.error('Error parseando JSON de ventas:', e, 'String recibido:', data)
          ventasData = []
        }
      } else if (Array.isArray(data)) {
        ventasData = data
      } else if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>
        const keys = Object.keys(d)
        if (
          keys.length > 0 &&
          keys.every((k) => /^\d+$/.test(k)) &&
          keys.some((k) => d[k] && typeof d[k] === 'object')
        ) {
          ventasData = keys
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => d[k] as object)
        } else if ('data' in data && Array.isArray((data as any).data)) {
          ventasData = (data as any).data
        } else {
          ventasData = [data]
        }
      }

      return {
        success: true,
        data: ventasData as Array<import('../types/api').Venta>
      }
    } catch (error: any) {
      console.error('Error al obtener ventas:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener ventas'
      }
    }
  }

  async agregarItemVenta(item: {
    id_venta: number
    id_articulo_stock?: number
    codigo_articulo?: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento?: number
    observaciones?: string
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('agregar_item_venta', {
        p_id_venta: item.id_venta,
        p_descripcion: item.descripcion,
        p_precio_unitario: item.precio_unitario,
        p_cantidad: item.cantidad,
        p_id_articulo_stock: item.id_articulo_stock || null,
        p_codigo_articulo: item.codigo_articulo || null,
        p_descuento: item.descuento || 0,
        p_observaciones: item.observaciones || null
      })

      if (error) throw error

      // Descontar stock si el item tiene id_articulo_stock
      if (item.id_articulo_stock && item.cantidad > 0) {
        await this.descontarStockDeVenta(item.id_venta, item.id_articulo_stock, item.cantidad)
      }

      return {
        success: true,
        data: data.data as { id: number }
      }
    } catch (error: any) {
      console.error('Error al agregar item a venta:', error)
      return {
        success: false,
        error: error.message || 'Error al agregar item a venta'
      }
    }
  }

  // Función privada para descontar stock de una venta
  private async descontarStockDeVenta(
    idVenta: number,
    idArticuloStock: number,
    cantidad: number
  ): Promise<void> {
    if (!supabase || !stockSupabase) return

    try {
      // Obtener información de la venta
      const { data: venta } = await supabase
        .from('ventas')
        .select('numero_venta, numero_op')
        .eq('id', idVenta)
        .single()

      if (!venta) return

      // Obtener artículo de stock
      const { data: articuloStock } = await stockSupabase
        .from('articulos')
        .select('*')
        .eq('id', idArticuloStock)
        .single()

      if (!articuloStock || articuloStock.stock === null || articuloStock.stock <= 0) {
        console.warn(`⚠️ No se puede descontar stock: artículo ${idArticuloStock} no tiene stock disponible`)
        return
      }

      const cantidadAnterior = articuloStock.stock
      const cantidadADescontar = cantidad
      const cantidadNueva = Math.max(0, cantidadAnterior - cantidadADescontar)

      // Actualizar stock en la base de stock
      await stockSupabase
        .from('articulos')
        .update({ stock: cantidadNueva })
        .eq('id', idArticuloStock)

      // Obtener información del usuario
      const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
      let nombreUsuario = 'Sistema'
      try {
        const usuarioData = localStorage.getItem('usuario')
        if (usuarioData) {
          const p = JSON.parse(usuarioData) as { nombre?: unknown }
          if (typeof p?.nombre === 'string' && p.nombre.trim()) nombreUsuario = p.nombre.trim()
        }
      } catch {
        /* ignore */
      }

      // Registrar movimiento de stock
      await supabase.from('stock_movimientos').insert({
        id_articulo_stock: idArticuloStock,
        codigo_articulo: articuloStock.codigo || null,
        descripcion: articuloStock.descripcion,
        tipo_movimiento: 'Venta',
        cantidad: cantidadADescontar,
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        motivo: `Venta ${venta.numero_venta}${venta.numero_op ? ` - OP ${venta.numero_op}` : ''}`,
        id_venta: idVenta,
        id_usuario: usuarioId,
        nombre_usuario: nombreUsuario
      })

      // Verificar si el stock quedó bajo y crear alerta si es necesario
      if (cantidadNueva <= 10 && cantidadNueva > 0) {
        await this.crearAlertaStockBajo(articuloStock as ArticuloStock, cantidadNueva)
      } else if (cantidadNueva === 0) {
        await this.crearAlertaStockAgotado(articuloStock as ArticuloStock)
      }
    } catch (error) {
      console.error('Error descontando stock de venta:', error)
      // No lanzar error para no interrumpir la creación del item
    }
  }

  async actualizarVenta(
    id: number,
    venta: Partial<{
      id_op: number | null
      numero_op: string | null
      valor_total: number
      metodo_pago: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'
      estado_pago: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado'
      monto_pagado: number | null
      caja_slug_cobro: string | null
      fecha_venta: string
      observaciones: string
      comprobante_pago_url: string | null
    }>
  ): Promise<ApiResponse<{ success: boolean }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const updateData: any = {}
      if (venta.id_op !== undefined) updateData.id_op = venta.id_op
      if (venta.numero_op !== undefined) updateData.numero_op = venta.numero_op
      if (venta.valor_total !== undefined) updateData.valor_total = venta.valor_total
      if (venta.metodo_pago !== undefined) updateData.metodo_pago = venta.metodo_pago
      if (venta.estado_pago !== undefined) updateData.estado_pago = venta.estado_pago
      if (venta.monto_pagado !== undefined) updateData.monto_pagado = venta.monto_pagado
      if (venta.caja_slug_cobro !== undefined) updateData.caja_slug_cobro = venta.caja_slug_cobro
      if (venta.fecha_venta !== undefined) updateData.fecha_venta = venta.fecha_venta
      if (venta.observaciones !== undefined) updateData.observaciones = venta.observaciones
      if (venta.comprobante_pago_url !== undefined) {
        updateData.comprobante_pago_url = venta.comprobante_pago_url
      }
      updateData.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('ventas')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      const ventaRes = await this.getVenta(id)
      if (ventaRes.success && ventaRes.data) {
        void syncCajaDesdeVentaApi(ventaRes.data, { silencioso: true })
      }

      return { success: true, data: { success: true } }
    } catch (error: any) {
      console.error('Error al actualizar venta:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar venta'
      }
    }
  }

  async eliminarItemVenta(idItem: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { error } = await supabase.rpc('eliminar_item_venta', {
        p_id_item: idItem
      })

      if (error) throw error

      return {
        success: true,
        data: true
      }
    } catch (error: any) {
      console.error('Error al eliminar item de venta:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar item de venta'
      }
    }
  }

  // ============================================
  // GESTIÓN DE FLOTA
  // ============================================

  async getVehiculos(): Promise<ApiResponse<Vehiculo[]>> {
    if (supabase) {
      const { data, error } = await supabase.from('vehiculos').select('*').order('nombre', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as Vehiculo[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /** Admin / Caja: cambiar estado operativo del vehículo en el parque. */
  async actualizarVehiculoEstadoParque(
    idVehiculo: number,
    estado_parque: VehiculoEstadoParque,
    estado_parque_detalle?: string | null
  ): Promise<ApiResponse<Vehiculo>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const detalle =
      estado_parque === 'otro' ? (estado_parque_detalle?.trim() || null) : null
    const { data, error } = await supabase
      .from('vehiculos')
      .update({
        estado_parque,
        estado_parque_detalle: detalle
      })
      .eq('id', idVehiculo)
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Vehiculo }
  }

  /**
   * Admin / Caja: elimina el vehículo y, por CASCADE en BD, todos sus registros de salida.
   * No permite si hay salida pendiente, en uso o retrasada.
   */
  async eliminarVehiculo(idVehiculo: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const { data: activos, error: errQ } = await supabase
      .from('registros_salidas_vehiculos')
      .select('id')
      .eq('id_vehiculo', idVehiculo)
      .in('estado', ['pendiente_autorizacion', 'en_uso', 'retrasado'])
      .limit(1)

    if (errQ) return { success: false, error: errQ.message }
    if (activos && activos.length > 0) {
      return {
        success: false,
        error:
          'No se puede eliminar: el vehículo tiene una solicitud pendiente o una salida en curso. Cerrá el viaje o resolvé la solicitud primero.'
      }
    }

    const { error } = await supabase.from('vehiculos').delete().eq('id', idVehiculo)

    if (error) return { success: false, error: error.message }
    return { success: true, data: undefined }
  }

  async getReservasVehiculosFlota(params: {
    fechaDesde: string
    fechaHasta: string
    estado?: ReservaVehiculoFlota['estado']
  }): Promise<ApiResponse<ReservaVehiculoFlota[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    let query = supabase
      .from('reservas_vehiculos_flota')
      .select('*, vehiculo:vehiculos(*)')
      .gte('fecha', params.fechaDesde)
      .lte('fecha', params.fechaHasta)
    if (params.estado) {
      query = query.eq('estado', params.estado)
    }
    const { data, error } = await query
      .order('fecha', { ascending: true })
      .order('id_vehiculo', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data as ReservaVehiculoFlota[]) ?? [] }
  }

  async crearReservaVehiculoFlota(input: {
    id_vehiculo: number
    id_usuario: number | null
    nombre_usuario: string
    fecha: string
    /** HH:MM o HH:MM:SS (horario Argentina, mismo día que fecha) */
    hora_desde: string
    hora_hasta: string
    motivo?: string | null
  }): Promise<ApiResponse<ReservaVehiculoFlota>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const hoy = getArgentinaDateString()
    const f = (input.fecha || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return { success: false, error: 'Fecha inválida' }
    }
    if (f < hoy) {
      return { success: false, error: 'No se puede reservar un día pasado.' }
    }

    const hd = normalizeTimeHHMMSS((input.hora_desde || '').trim())
    const hh = normalizeTimeHHMMSS((input.hora_hasta || '').trim())
    if (!hd || !hh) {
      return { success: false, error: 'Indicá horario desde y hasta (formato HH:MM).' }
    }
    const sd = timeStringToSecondsSinceMidnight(hd)
    const sh = timeStringToSecondsSinceMidnight(hh)
    if (sd == null || sh == null || sd > sh) {
      return { success: false, error: 'El horario "desde" debe ser anterior o igual al "hasta".' }
    }

    const { data, error } = await supabase
      .from('reservas_vehiculos_flota')
      .insert({
        id_vehiculo: input.id_vehiculo,
        id_usuario: input.id_usuario,
        nombre_usuario: input.nombre_usuario.trim(),
        fecha: f,
        hora_desde: hd,
        hora_hasta: hh,
        estado: 'pendiente_aprobacion',
        motivo: input.motivo?.trim() || null
      })
      .select('*, vehiculo:vehiculos(*)')
      .single()

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return {
          success: false,
          error:
            'Ya hay una reserva o solicitud pendiente para ese vehículo en esa fecha. Elegí otro día o vehículo.'
        }
      }
      return { success: false, error: error.message }
    }
    return { success: true, data: data as ReservaVehiculoFlota }
  }

  async aprobarReservaVehiculoFlota(
    idReserva: number,
    idRevisor: number,
    nombreRevisor: string
  ): Promise<ApiResponse<ReservaVehiculoFlota>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const ahora = new Date().toISOString()
    const { data, error } = await supabase
      .from('reservas_vehiculos_flota')
      .update({
        estado: 'aprobada',
        id_usuario_reviso: idRevisor,
        nombre_revisor: nombreRevisor.trim(),
        revisado_at: ahora
      })
      .eq('id', idReserva)
      .eq('estado', 'pendiente_aprobacion')
      .select('*, vehiculo:vehiculos(*)')
      .single()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'Reserva no encontrada o ya no está pendiente' }
    return { success: true, data: data as ReservaVehiculoFlota }
  }

  async rechazarReservaVehiculoFlota(
    idReserva: number,
    idRevisor: number,
    nombreRevisor: string
  ): Promise<ApiResponse<ReservaVehiculoFlota>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const ahora = new Date().toISOString()
    const { data, error } = await supabase
      .from('reservas_vehiculos_flota')
      .update({
        estado: 'rechazada',
        id_usuario_reviso: idRevisor,
        nombre_revisor: nombreRevisor.trim(),
        revisado_at: ahora
      })
      .eq('id', idReserva)
      .eq('estado', 'pendiente_aprobacion')
      .select('*, vehiculo:vehiculos(*)')
      .single()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'Reserva no encontrada o ya no está pendiente' }
    return { success: true, data: data as ReservaVehiculoFlota }
  }

  async cancelarReservaVehiculoFlotaPropia(
    idReserva: number,
    idUsuario: number
  ): Promise<ApiResponse<ReservaVehiculoFlota>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const { data, error } = await supabase
      .from('reservas_vehiculos_flota')
      .update({ estado: 'cancelada' })
      .eq('id', idReserva)
      .eq('id_usuario', idUsuario)
      .eq('estado', 'pendiente_aprobacion')
      .select('*, vehiculo:vehiculos(*)')
      .single()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'No se pudo cancelar (solo tus reservas pendientes)' }
    return { success: true, data: data as ReservaVehiculoFlota }
  }

  /**
   * Si hoy (AR) hay reserva aprobada para el vehículo en este momento y no sos vos, no podés solicitar salida.
   * Fuera de la franja horaria de la reserva, otro usuario puede pedir salida el mismo día.
   */
  async verificarReservaFlotaSalida(
    idVehiculo: number,
    idUsuario: number | null
  ): Promise<ApiResponse<{ permitido: boolean; mensaje?: string }>> {
    if (!supabase) return { success: true, data: { permitido: true } }
    const fechaAr = getArgentinaDateString()
    const { data: apr, error } = await supabase
      .from('reservas_vehiculos_flota')
      .select('id_usuario, nombre_usuario, hora_desde, hora_hasta')
      .eq('id_vehiculo', idVehiculo)
      .eq('fecha', fechaAr)
      .eq('estado', 'aprobada')
      .maybeSingle()

    if (error) return { success: true, data: { permitido: true } }
    const row = apr as {
      id_usuario: number | null
      nombre_usuario: string
      hora_desde?: string | null
      hora_hasta?: string | null
    } | null
    if (!row || row.id_usuario == null) return { success: true, data: { permitido: true } }
    if (idUsuario != null && row.id_usuario === idUsuario) return { success: true, data: { permitido: true } }
    if (!instanteArgentinaDentroFranjaHorariaReserva(new Date(), row.hora_desde, row.hora_hasta)) {
      return { success: true, data: { permitido: true } }
    }
    const desde = (row.hora_desde ?? '').slice(0, 5)
    const hasta = (row.hora_hasta ?? '').slice(0, 5)
    return {
      success: true,
      data: {
        permitido: false,
        mensaje: `Este vehículo tiene reserva aprobada hoy (${fechaAr}) entre ${desde} y ${hasta} a nombre de ${row.nombre_usuario}. Solo esa persona puede solicitar la salida en ese horario.`
      }
    }
  }

  async getRegistrosSalidasVehiculos(filtros?: {
    estado?: RegistroSalidaVehiculo['estado']
    estados?: RegistroSalidaVehiculo['estado'][]
    id_vehiculo?: number
    fecha_desde?: string
    fecha_hasta?: string
    /** Máx. filas (p. ej. historial) */
    limit?: number
  }): Promise<ApiResponse<RegistroSalidaVehiculo[]>> {
    if (supabase) {
      let query = supabase
        .from('registros_salidas_vehiculos')
        .select(`
          *,
          vehiculo:vehiculos(*)
        `)
        .order('hora_salida', { ascending: false })

      if (filtros?.estados && filtros.estados.length > 0) {
        query = query.in('estado', filtros.estados)
      } else if (filtros?.estado) {
        query = query.eq('estado', filtros.estado)
      }

      if (filtros?.id_vehiculo) {
        query = query.eq('id_vehiculo', filtros.id_vehiculo)
      }

      if (filtros?.fecha_desde) {
        query = query.gte('hora_salida', filtros.fecha_desde)
      }

      if (filtros?.fecha_hasta) {
        query = query.lte('hora_salida', filtros.fecha_hasta)
      }

      if (filtros?.limit != null && filtros.limit > 0) {
        query = query.limit(filtros.limit)
      }

      const { data, error } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as RegistroSalidaVehiculo[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /** Datos de OP para ubicación en mapa de salida (sin auth pública). */
  async getOrdenUbicacionPorNumeroOp(numeroOp: string): Promise<
    ApiResponse<{
      id: number
      numero_op: string
      ubicacion_link: string | null
      direccion_cliente: string | null
      cliente: string | null
      telefono_cliente: string | null
    } | null>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const raw = (numeroOp || '').trim()
    if (!raw) return { success: true, data: null }
    const normalized = raw.replace(/^OP-?/i, '').trim() || raw
    const selectOp =
      'id, numero_op, ubicacion_link, direccion_cliente, cliente, telefono_cliente'
    const candidates = normalized === raw ? [raw] : [raw, normalized]
    for (const num of candidates) {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select(selectOp)
        .eq('numero_op', num)
        .limit(1)
        .maybeSingle()
      if (error) return { success: false, error: error.message }
      if (data) return { success: true, data: data as any }
    }
    if (/^\d+$/.test(normalized)) {
      const id = parseInt(normalized, 10)
      if (id > 0) {
        const { data, error } = await supabase
          .from('ordenes_trabajo')
          .select(selectOp)
          .eq('id', id)
          .limit(1)
          .maybeSingle()
        if (error) return { success: false, error: error.message }
        if (data) return { success: true, data: data as any }
      }
    }
    if (normalized.length >= 3) {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select(selectOp)
        .ilike('numero_op', `%${normalized}%`)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) return { success: false, error: error.message }
      if (data) return { success: true, data: data as any }
    }
    return { success: true, data: null }
  }

  async crearRegistroSalidaVehiculo(
    registro: Omit<RegistroSalidaVehiculo, 'id' | 'created_at' | 'updated_at' | 'vehiculo'>
  ): Promise<ApiResponse<RegistroSalidaVehiculo>> {
    if (supabase) {
      const { data: filaVehiculo, error: errV } = await supabase
        .from('vehiculos')
        .select('id, activo, estado_parque, estado_parque_detalle, nombre')
        .eq('id', registro.id_vehiculo)
        .maybeSingle()

      if (errV) return { success: false, error: errV.message }
      if (!filaVehiculo) {
        return { success: false, error: 'Vehículo no encontrado' }
      }
      const ep = (filaVehiculo as { estado_parque?: string | null }).estado_parque ?? 'disponible'
      if (filaVehiculo.activo === false || ep !== 'disponible') {
        return {
          success: false,
          error:
            ep === 'fuera_servicio'
              ? 'Este vehículo está fuera de servicio. No se puede solicitar salida.'
              : ep === 'en_taller'
                ? 'Este vehículo está en taller o mantenimiento. No se puede solicitar salida.'
                : ep === 'otro'
                  ? 'Este vehículo no está disponible para salidas. Consultá con Caja o Administración.'
                  : 'Este vehículo no está disponible para solicitar salida.'
        }
      }

      // Vehículo ocupado: salida autorizada, retrasada o solicitud pendiente
      const { data: registrosActivos } = await supabase
        .from('registros_salidas_vehiculos')
        .select('id')
        .eq('id_vehiculo', registro.id_vehiculo)
        .in('estado', ['en_uso', 'retrasado', 'pendiente_autorizacion'])
        .limit(1)

      if (registrosActivos && registrosActivos.length > 0) {
        return {
          success: false,
          error:
            'Este vehículo ya tiene una salida activa o una solicitud pendiente de autorización'
        }
      }

      const fechaSalidaAr = formatArgentinaDateOnly(new Date(registro.hora_salida))
      const { data: reservaBloqueo } = await supabase
        .from('reservas_vehiculos_flota')
        .select('id_usuario, nombre_usuario, hora_desde, hora_hasta')
        .eq('id_vehiculo', registro.id_vehiculo)
        .eq('fecha', fechaSalidaAr)
        .eq('estado', 'aprobada')
        .maybeSingle()

      const rb = reservaBloqueo as {
        id_usuario?: number | null
        nombre_usuario?: string
        hora_desde?: string | null
        hora_hasta?: string | null
      } | null

      if (
        rb &&
        rb.id_usuario != null &&
        registro.id_usuario != null &&
        rb.id_usuario !== registro.id_usuario &&
        instanteArgentinaDentroFranjaHorariaReserva(
          new Date(registro.hora_salida),
          rb.hora_desde,
          rb.hora_hasta
        )
      ) {
        const d = (rb.hora_desde ?? '').slice(0, 5)
        const h = (rb.hora_hasta ?? '').slice(0, 5)
        return {
          success: false,
          error: `Reserva aprobada: el vehículo está asignado el ${fechaSalidaAr} entre ${d} y ${h} a ${rb.nombre_usuario ?? 'otro usuario'}. Solo esa persona puede solicitar salida en ese horario.`
        }
      }

      const { data, error } = await supabase
        .from('registros_salidas_vehiculos')
        .insert(registro)
        .select(`
          *,
          vehiculo:vehiculos(*)
        `)
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as RegistroSalidaVehiculo }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /** Caja / Admin: autoriza solicitud → vehículo pasa a en_uso (no disponible para otros). */
  async autorizarRegistroSalidaVehiculo(
    idRegistro: number,
    idUsuarioCaja: number,
    nombreUsuarioCaja: string
  ): Promise<ApiResponse<RegistroSalidaVehiculo>> {
    if (supabase) {
      const { data: reg, error: fetchErr } = await supabase
        .from('registros_salidas_vehiculos')
        .select('id, id_vehiculo, estado')
        .eq('id', idRegistro)
        .maybeSingle()
      if (fetchErr) return { success: false, error: fetchErr.message }
      if (!reg) return { success: false, error: 'Registro no encontrado' }
      if (reg.estado !== 'pendiente_autorizacion') {
        return { success: false, error: 'Solo se pueden autorizar solicitudes pendientes' }
      }

      const { data: bloqueo } = await supabase
        .from('registros_salidas_vehiculos')
        .select('id')
        .eq('id_vehiculo', reg.id_vehiculo)
        .in('estado', ['en_uso', 'retrasado'])
        .neq('id', idRegistro)
        .limit(1)
      if (bloqueo && bloqueo.length > 0) {
        return { success: false, error: 'El vehículo ya está en uso por otra salida' }
      }

      const ahora = new Date().toISOString()
      const { data, error } = await supabase
        .from('registros_salidas_vehiculos')
        .update({
          estado: 'en_uso',
          llave_entregada: true,
          hora_salida: ahora,
          id_usuario_caja_entrego_llave: idUsuarioCaja,
          nombre_usuario_caja_entrego_llave: nombreUsuarioCaja,
          updated_at: ahora
        })
        .eq('id', idRegistro)
        .select(`*, vehiculo:vehiculos(*)`)
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as RegistroSalidaVehiculo }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  /** Conductor: marca hora real de llegada, combustible restante, objetivo y observaciones (sigue en uso hasta finalizar). */
  async marcarLlegadaRegistroSalidaVehiculo(
    idRegistro: number,
    params: {
      combustibleRestanteLitros: number
      objetivoCumplido: boolean
      observacionesLlegada?: string | null
    }
  ): Promise<ApiResponse<RegistroSalidaVehiculo>> {
    if (supabase) {
      const litros = params.combustibleRestanteLitros
      if (!Number.isFinite(litros) || litros < 0) {
        return { success: false, error: 'Indicá el combustible que queda (litros, número ≥ 0)' }
      }
      const obs = (params.observacionesLlegada ?? '').trim() || null
      const ahora = new Date().toISOString()
      const { data, error } = await supabase
        .from('registros_salidas_vehiculos')
        .update({
          hora_llegada_real: ahora,
          litros_combustible_llegada: litros,
          objetivo_cumplido: params.objetivoCumplido,
          observaciones_llegada: obs,
          updated_at: ahora
        })
        .eq('id', idRegistro)
        .in('estado', ['en_uso', 'retrasado'])
        .is('hora_llegada_real', null)
        .select(`*, vehiculo:vehiculos(*)`)
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      if (!data) {
        return { success: false, error: 'No se pudo registrar: ya marcaste llegada o el viaje no está activo' }
      }
      return { success: true, data: data as RegistroSalidaVehiculo }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async finalizarRegistroSalidaVehiculo(
    idRegistro: number,
    horaLlegada?: string,
    observaciones?: string
  ): Promise<ApiResponse<RegistroSalidaVehiculo>> {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('usuario')
        const u = raw ? (JSON.parse(raw) as { rol?: string }) : null
        if (!puedeFinalizarViajeFlota(u?.rol)) {
          return {
            success: false,
            error: 'Solo Caja o Administración puede cerrar el viaje.'
          }
        }
      } catch {
        return {
          success: false,
          error: 'No se pudo verificar el permiso para cerrar el viaje.'
        }
      }
    }
    if (supabase) {
      const updatedAt = new Date().toISOString()
      const { data: cur, error: fetchErr } = await supabase
        .from('registros_salidas_vehiculos')
        .select('hora_llegada_real')
        .eq('id', idRegistro)
        .maybeSingle()
      if (fetchErr) return { success: false, error: fetchErr.message }

      const patch: Record<string, unknown> = {
        estado: 'finalizado',
        observaciones: observaciones ?? null,
        updated_at: updatedAt
      }
      if (horaLlegada) {
        patch.hora_llegada_real = horaLlegada
      } else if (!cur?.hora_llegada_real) {
        patch.hora_llegada_real = updatedAt
      }

      const { data, error } = await supabase
        .from('registros_salidas_vehiculos')
        .update(patch)
        .eq('id', idRegistro)
        .select(`
          *,
          vehiculo:vehiculos(*)
        `)
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as RegistroSalidaVehiculo }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async entregarLlaveVehiculo(
    idRegistro: number,
    idUsuarioCaja: number,
    nombreUsuarioCaja: string
  ): Promise<ApiResponse<RegistroSalidaVehiculo>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('registros_salidas_vehiculos')
        .update({
          llave_entregada: true,
          id_usuario_caja_entrego_llave: idUsuarioCaja,
          nombre_usuario_caja_entrego_llave: nombreUsuarioCaja,
          updated_at: new Date().toISOString()
        })
        .eq('id', idRegistro)
        .select(`
          *,
          vehiculo:vehiculos(*)
        `)
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as RegistroSalidaVehiculo }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getEstadisticasFlota(fechaDesde?: string, fechaHasta?: string): Promise<ApiResponse<{
    total_salidas: number
    vehiculos_en_uso: number
    vehiculos_retrasados: number
    distancia_total_km: number
    tiempo_promedio_horas: number
    registros_retrasados: RegistroSalidaVehiculo[]
  }>> {
    if (supabase) {
      let query = supabase
        .from('registros_salidas_vehiculos')
        .select('*')

      // Antes: lte(hora_salida, 'YYYY-MM-DD') ≈ solo hasta 00:00 de ese día → se perdía casi todo el último día.
      if (fechaDesde) {
        query = query.gte('hora_salida', flotaFechaDesdeInclusiveIso(fechaDesde))
      }

      if (fechaHasta) {
        query = query.lte('hora_salida', flotaFechaHastaInclusiveIso(fechaHasta))
      }

      const { data, error } = await query

      if (error) return { success: false, error: error.message }

      const registros = (data as RegistroSalidaVehiculo[]) ?? []

      // Estado actual de la flota (sin depender del rango de fechas).
      const { data: activosData, error: errActivos } = await supabase
        .from('registros_salidas_vehiculos')
        .select('*')
        .in('estado', ['en_uso', 'retrasado'])

      if (errActivos) return { success: false, error: errActivos.message }

      const activos = (activosData as RegistroSalidaVehiculo[]) ?? []
      const ahora = new Date()
      const retrasadosActuales = activos.filter(
        (r) =>
          r.estado === 'retrasado' ||
          (r.estado === 'en_uso' &&
            r.hora_estimada_llegada &&
            new Date(r.hora_estimada_llegada) < ahora)
      )

      const vehiculos_en_uso = activos.filter((r) => r.estado === 'en_uso').length
      const vehiculos_retrasados = retrasadosActuales.length

      // Total salidas del período = registros con salida efectiva (excluye solicitudes sin salir).
      const salidasPeriodo = registros.filter((r) => r.estado !== 'pendiente_autorizacion')

      const finalizadosPeriodo = registros.filter((r) => r.estado === 'finalizado')
      const distanciaTotal = finalizadosPeriodo.reduce(
        (sum, r) => sum + (Number(r.km_aproximado) || 0),
        0
      )

      const tiempos = finalizadosPeriodo
        .filter((r) => r.hora_llegada_real && r.hora_salida)
        .map((r) => {
          const salida = new Date(r.hora_salida).getTime()
          const llegada = new Date(r.hora_llegada_real!).getTime()
          return (llegada - salida) / (1000 * 60 * 60)
        })

      const tiempoPromedio =
        tiempos.length > 0 ? tiempos.reduce((sum, t) => sum + t, 0) / tiempos.length : 0

      return {
        success: true,
        data: {
          total_salidas: salidasPeriodo.length,
          vehiculos_en_uso,
          vehiculos_retrasados,
          distancia_total_km: distanciaTotal,
          tiempo_promedio_horas: tiempoPromedio,
          registros_retrasados: retrasadosActuales
        }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarEstadosRetrasados(): Promise<ApiResponse<boolean>> {
    if (supabase) {
      const { error } = await supabase.rpc('actualizar_estado_vehiculos_retrasados')
      
      if (error) return { success: false, error: error.message }
      return { success: true, data: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // ============================================
  // SISTEMA ERP
  // ============================================

  // ========== PLAN DE CUENTAS ==========
  async getPlanCuentas(activas?: boolean): Promise<ApiResponse<import('../types/api').PlanCuentaRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('plan_cuentas')
          .select('*')
          .order('codigo', { ascending: true })

        if (activas !== undefined) {
          query = query.eq('activa', activas)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as import('../types/api').PlanCuentaRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async crearCuenta(cuenta: {
    codigo: string
    nombre: string
    tipo: 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingreso' | 'Costo' | 'Gasto' | 'Cuenta de Orden'
    nivel: number
    cuenta_padre_id?: number | null
    naturaleza: 'Deudora' | 'Acreedora'
    activa?: boolean
  }): Promise<ApiResponse<import('../types/api').PlanCuentaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('plan_cuentas')
          .insert({
            ...cuenta,
            activa: cuenta.activa !== undefined ? cuenta.activa : true
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').PlanCuentaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarCuenta(
    id: number,
    updates: Partial<import('../types/api').PlanCuentaRecord>
  ): Promise<ApiResponse<import('../types/api').PlanCuentaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('plan_cuentas')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').PlanCuentaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== ASIENTOS CONTABLES ==========
  async getAsientosContables(filters?: {
    fechaDesde?: string
    fechaHasta?: string
    estado?: 'Borrador' | 'Contabilizado' | 'Anulado'
    tipo_asiento?: string
  }): Promise<ApiResponse<import('../types/api').AsientoContableRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('asientos_contables')
          .select(`
            *,
            detalles:asientos_detalle(
              *,
              cuenta:plan_cuentas(*)
            )
          `)
          .order('fecha', { ascending: false })
          .order('numero_asiento', { ascending: false })

        if (filters?.fechaDesde) {
          query = query.gte('fecha', filters.fechaDesde)
        }
        if (filters?.fechaHasta) {
          query = query.lte('fecha', filters.fechaHasta)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.tipo_asiento) {
          query = query.eq('tipo_asiento', filters.tipo_asiento)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getErpPendientesAsientosSync(): Promise<
    ApiResponse<{
      facturas: Array<{
        id: number
        numero_factura: string
        cliente_nombre: string
        total: number
        fecha_emision: string
        id_venta?: number | null
      }>
      cobrosPagos: Array<{
        id: number
        tipo: string
        monto: number
        fecha_pago: string
        metodo_pago?: string | null
      }>
    }>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const [{ data: facturas, error: errF }, { data: pagosCobros, error: errPc }, { data: asientosOrigen, error: errA }] =
        await Promise.all([
          supabase
            .from('facturas_venta')
            .select('id, numero_factura, cliente_nombre, total, fecha_emision, id_venta')
            .eq('estado', 'Emitida')
            .is('id_asiento_contable', null)
            .order('fecha_emision', { ascending: false })
            .limit(150),
          supabase
            .from('pagos_cobros')
            .select('id, tipo, monto, fecha_pago, metodo_pago')
            .order('fecha_pago', { ascending: false })
            .limit(250),
          supabase.from('asientos_contables').select('id_origen, tipo_origen').in('tipo_origen', ['pago_cobro', 'factura'])
        ])

      if (errF) return { success: false, error: errF.message }
      if (errPc) return { success: false, error: errPc.message }
      if (errA) return { success: false, error: errA.message }

      const pcConAsiento = new Set(
        (asientosOrigen || [])
          .filter((a: { tipo_origen?: string | null; id_origen?: number | null }) => a.tipo_origen === 'pago_cobro' && a.id_origen != null)
          .map((a: { id_origen: number }) => a.id_origen)
      )

      const cobrosPagos = (pagosCobros || []).filter((pc: { id: number }) => !pcConAsiento.has(pc.id))

      return {
        success: true,
        data: {
          facturas: (facturas || []) as Array<{
            id: number
            numero_factura: string
            cliente_nombre: string
            total: number
            fecha_emision: string
            id_venta?: number | null
          }>,
          cobrosPagos: cobrosPagos as Array<{
            id: number
            tipo: string
            monto: number
            fecha_pago: string
            metodo_pago?: string | null
          }>
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error al consultar pendientes' }
    }
  }

  async erpSyncAsientosDesdeFacturacion(): Promise<
    ApiResponse<{
      facturas_generadas: number
      cobros_generados: number
      errores: string[]
    }>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const pend = await this.getErpPendientesAsientosSync()
      if (!pend.success || !pend.data) {
        return { success: false, error: pend.error || 'No se pudieron leer pendientes' }
      }

      let facturas_generadas = 0
      let cobros_generados = 0
      const errores: string[] = []

      for (const f of pend.data.facturas) {
        const { error } = await supabase.rpc('crear_asiento_desde_factura', { p_id_factura: f.id })
        if (error) errores.push(`Factura ${f.numero_factura}: ${error.message}`)
        else facturas_generadas += 1
      }

      for (const pc of pend.data.cobrosPagos) {
        const { error } = await supabase.rpc('crear_asiento_desde_pago_cobro', { p_id_pago_cobro: pc.id })
        if (error) errores.push(`${pc.tipo} #${pc.id}: ${error.message}`)
        else cobros_generados += 1
      }

      return { success: true, data: { facturas_generadas, cobros_generados, errores } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error al sincronizar asientos' }
    }
  }

  async crearAsientoContable(asiento: {
    fecha: string
    concepto: string
    tipo_asiento?: 'Manual' | 'Automático' | 'Facturación' | 'Compra' | 'Pago' | 'Cobro' | 'Ajuste'
    id_origen?: number | null
    tipo_origen?: string | null
    detalles: Array<{
      id_cuenta: number
      debe: number
      haber: number
      concepto?: string | null
    }>
    observaciones?: string | null
  }): Promise<ApiResponse<import('../types/api').AsientoContableRecord>> {
    if (supabase) {
      try {
        // Calcular totales
        const totalDebe = asiento.detalles.reduce((sum, d) => sum + (d.debe || 0), 0)
        const totalHaber = asiento.detalles.reduce((sum, d) => sum + (d.haber || 0), 0)

        // Validar partida doble
        if (Math.abs(totalDebe - totalHaber) > 0.01) {
          return { success: false, error: 'Los totales de debe y haber deben ser iguales (partida doble)' }
        }

        // Generar número de asiento
        const { data: numeroAsiento, error: errorNumero } = await supabase.rpc('generar_numero_asiento')
        if (errorNumero) return { success: false, error: errorNumero.message }

        // Crear asiento
        const { data: asientoData, error: errorAsiento } = await supabase
          .from('asientos_contables')
          .insert({
            numero_asiento: numeroAsiento,
            fecha: asiento.fecha,
            concepto: asiento.concepto,
            tipo_asiento: asiento.tipo_asiento || 'Manual',
            id_origen: asiento.id_origen || null,
            tipo_origen: asiento.tipo_origen || null,
            total_debe: totalDebe,
            total_haber: totalHaber,
            estado: 'Borrador',
            observaciones: asiento.observaciones || null
          })
          .select()
          .single()

        if (errorAsiento) return { success: false, error: errorAsiento.message }

        // Crear detalles
        const detallesData = asiento.detalles.map(d => ({
          id_asiento: asientoData.id,
          id_cuenta: d.id_cuenta,
          debe: d.debe,
          haber: d.haber,
          concepto: d.concepto || null
        }))

        const { error: errorDetalles } = await supabase
          .from('asientos_detalle')
          .insert(detallesData)

        if (errorDetalles) {
          // Si falla, eliminar el asiento creado
          await supabase.from('asientos_contables').delete().eq('id', asientoData.id)
          return { success: false, error: errorDetalles.message }
        }

        // Obtener asiento completo
        const { data: asientoCompleto, error: errorCompleto } = await supabase
          .from('asientos_contables')
          .select(`
            *,
            detalles:asientos_detalle(
              *,
              cuenta:plan_cuentas(*)
            )
          `)
          .eq('id', asientoData.id)
          .single()

        if (errorCompleto) return { success: false, error: errorCompleto.message }
        return { success: true, data: asientoCompleto as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async contabilizarAsiento(id: number): Promise<ApiResponse<import('../types/api').AsientoContableRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('asientos_contables')
          .update({ estado: 'Contabilizado', updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').AsientoContableRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== VENTAS ==========
  async getVenta(id: number): Promise<ApiResponse<import('../types/api').Venta>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ventas')
          .select('*')
          .eq('id', id)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').Venta }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getItemsVenta(id_venta: number): Promise<ApiResponse<import('../types/api').VentaItem[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ventas_items')
          .select('*')
          .eq('id_venta', id_venta)
          .order('id', { ascending: true })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as import('../types/api').VentaItem[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== FACTURAS ==========
  async getFacturas(filters?: {
    fechaDesde?: string
    fechaHasta?: string
    estado?: 'Borrador' | 'Emitida' | 'Anulada' | 'Cancelada'
    tipo_comprobante?: string
    id_cliente?: number
    id_op?: number
  }): Promise<ApiResponse<import('../types/api').FacturaVentaRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('facturas_venta')
          .select(`
            *,
            items:facturas_items(*),
            cliente:clientes(*)
          `)
          .order('fecha_emision', { ascending: false })
          .order('numero_comprobante', { ascending: false })

        if (filters?.fechaDesde) {
          query = query.gte('fecha_emision', filters.fechaDesde)
        }
        if (filters?.fechaHasta) {
          query = query.lte('fecha_emision', filters.fechaHasta)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.tipo_comprobante) {
          query = query.eq('tipo_comprobante', filters.tipo_comprobante)
        }
        if (filters?.id_cliente) {
          query = query.eq('id_cliente', filters.id_cliente)
        }
        if (filters?.id_op) {
          query = query.eq('id_op', filters.id_op)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== FACTURAS DE COMPRA (IVA COMPRAS) ==========
  async getFacturasCompra(filters?: {
    fechaDesde?: string
    fechaHasta?: string
    id_proveedor?: number
    id_pedido_compra?: number
    id_cuenta_por_pagar?: number
  }): Promise<ApiResponse<Array<import('../types/api').FacturaCompraRecord & { items?: import('../types/api').FacturaCompraItemRecord[] }>>> {
    if (supabase) {
      try {
        let query = supabase
          .from('facturas_compra')
          .select(`
            *,
            items:facturas_compra_items(*)
          `)
          .order('fecha_emision', { ascending: false })
          .order('numero_comprobante', { ascending: false })

        if (filters?.fechaDesde) query = query.gte('fecha_emision', filters.fechaDesde)
        if (filters?.fechaHasta) query = query.lte('fecha_emision', filters.fechaHasta)
        if (filters?.id_proveedor) query = query.eq('id_proveedor', filters.id_proveedor)
        if (filters?.id_pedido_compra != null) query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        if (filters?.id_cuenta_por_pagar != null) query = query.eq('id_cuenta_por_pagar', filters.id_cuenta_por_pagar)

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async createFacturaCompra(input: {
    tipo_comprobante: 'Factura' | 'Nota de Crédito' | 'Nota de Débito'
    letra: 'A' | 'B' | 'C'
    punto_venta: number
    numero_comprobante: number
    fecha_emision: string
    id_proveedor?: number | null
    proveedor_nombre: string
    proveedor_cuit?: string | null
    items: Array<{
      descripcion: string
      cantidad: number
      precio_unitario: number
      descuento?: number
      iva_porcentaje?: number
    }>
    observaciones?: string | null
    id_pedido_compra?: number | null
    id_cuenta_por_pagar?: number | null
  }): Promise<ApiResponse<import('../types/api').FacturaCompraRecord>> {
    if (supabase) {
      try {
        const usuarioData = localStorage.getItem('usuario')
        const usuario = usuarioData ? JSON.parse(usuarioData) : null

        const isNotaCredito = input.tipo_comprobante === 'Nota de Crédito'
        const sign = isNotaCredito ? -1 : 1

        let subtotal = 0
        let ivaTotal = 0

        const itemsCalculados = input.items.map((it, idx) => {
          const cantidad = Number(it.cantidad || 0) || 1
          const precioUnitario = Number(it.precio_unitario || 0) || 0
          const descuento = Number(it.descuento || 0) || 0
          const ivaPorcentaje = Number(it.iva_porcentaje ?? 21) || 0
          const sub = cantidad * precioUnitario - descuento
          const iva = sub * (ivaPorcentaje / 100)
          const tot = sub + iva
          subtotal += sub * sign
          ivaTotal += iva * sign
          return {
            item_numero: idx + 1,
            descripcion: it.descripcion,
            cantidad,
            precio_unitario: precioUnitario,
            descuento: descuento * sign,
            iva_porcentaje: ivaPorcentaje,
            iva_monto: iva * sign,
            subtotal: sub * sign,
            total: tot * sign
          }
        })

        const total = subtotal + ivaTotal
        const numeroFactura = `${String(input.punto_venta).padStart(4, '0')}-${String(input.numero_comprobante).padStart(8, '0')}`

        const { data: factura, error } = await supabase
          .from('facturas_compra')
          .insert({
            tipo_comprobante: input.tipo_comprobante,
            letra: input.letra,
            punto_venta: input.punto_venta,
            numero_comprobante: input.numero_comprobante,
            numero_factura: numeroFactura,
            fecha_emision: input.fecha_emision,
            id_proveedor: input.id_proveedor ?? null,
            proveedor_nombre: input.proveedor_nombre,
            proveedor_cuit: input.proveedor_cuit ?? null,
            subtotal,
            iva: ivaTotal,
            total,
            observaciones: input.observaciones ?? null,
            id_pedido_compra: input.id_pedido_compra ?? null,
            id_cuenta_por_pagar: input.id_cuenta_por_pagar ?? null,
            id_usuario: usuario?.id ?? null
          })
          .select('*')
          .single()

        if (error) return { success: false, error: error.message }

        const itemsData = itemsCalculados.map((x) => ({ id_factura: (factura as any).id, ...x }))
        const { error: errItems } = await supabase.from('facturas_compra_items').insert(itemsData)
        if (errItems) {
          await supabase.from('facturas_compra').delete().eq('id', (factura as any).id)
          return { success: false, error: errItems.message }
        }

        return { success: true, data: factura as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async crearFactura(factura: {
    tipo_comprobante: 'Factura A' | 'Factura B' | 'Factura C' | 'Nota de Crédito A' | 'Nota de Crédito B' | 'Nota de Crédito C' | 'Nota de Débito A' | 'Nota de Débito B' | 'Nota de Débito C'
    fecha_emision: string
    fecha_vencimiento?: string | null
    id_cliente?: number | null
    cliente_nombre: string
    cliente_dni_cuit?: string | null
    cliente_direccion?: string | null
    cliente_condicion_iva?: 'Responsable Inscripto' | 'Monotributista' | 'Exento' | 'Consumidor Final' | 'No Responsable' | null
    id_op?: number | null
    numero_op?: string | null
    id_venta?: number | null
    id_factura_referencia?: number | null
    items: Array<{
      descripcion: string
      cantidad: number
      unidad_medida?: string
      precio_unitario: number
      descuento?: number
      iva_porcentaje?: number
    }>
    observaciones?: string | null
  }): Promise<ApiResponse<import('../types/api').FacturaVentaRecord>> {
    if (supabase) {
      try {
        // Obtener configuración AFIP
        const { data: configAFIP, error: errAfip } = await supabase.rpc(
          'get_configuracion_afip_facturacion'
        )

        if (errAfip) {
          return { success: false, error: errAfip.message }
        }
        if (!configAFIP || typeof configAFIP !== 'object') {
          return { success: false, error: 'No hay configuración AFIP activa' }
        }

        // Generar número de comprobante
        const { data: numeroComprobante, error: errorNumero } = await supabase.rpc('generar_numero_factura', {
          p_tipo_comprobante: factura.tipo_comprobante,
          p_punto_venta: configAFIP.punto_venta
        })

        if (errorNumero) return { success: false, error: errorNumero.message }

        // Calcular totales
        let subtotal = 0
        let descuentoTotal = 0
        let ivaTotal = 0

        const isNotaCredito = String(factura.tipo_comprobante || '').startsWith('Nota de Crédito')
        const sign = isNotaCredito ? -1 : 1

        const itemsCalculados = factura.items.map((item, index) => {
          const cantidad = item.cantidad || 1
          const precioUnitario = item.precio_unitario || 0
          const descuento = item.descuento || 0
          const ivaPorcentaje = item.iva_porcentaje || 21
          
          const subtotalItem = cantidad * precioUnitario - descuento
          const ivaMonto = subtotalItem * (ivaPorcentaje / 100)
          const totalItem = subtotalItem + ivaMonto

          subtotal += subtotalItem * sign
          descuentoTotal += descuento * sign
          ivaTotal += ivaMonto * sign

          return {
            item_numero: index + 1,
            descripcion: item.descripcion,
            cantidad,
            unidad_medida: item.unidad_medida || 'UN',
            precio_unitario: precioUnitario,
            descuento: descuento * sign,
            iva_porcentaje: ivaPorcentaje,
            iva_monto: ivaMonto * sign,
            subtotal: subtotalItem * sign,
            total: totalItem * sign
          }
        })

        const total = subtotal + ivaTotal

        // Crear factura
        const numeroFactura = `${configAFIP.punto_venta.toString().padStart(4, '0')}-${numeroComprobante.toString().padStart(8, '0')}`

        const insertPayload: any = {
          numero_factura: numeroFactura,
          punto_venta: configAFIP.punto_venta,
          numero_comprobante: numeroComprobante,
          tipo_comprobante: factura.tipo_comprobante,
          fecha_emision: factura.fecha_emision,
          fecha_vencimiento: factura.fecha_vencimiento || null,
          id_cliente: factura.id_cliente || null,
          cliente_nombre: factura.cliente_nombre,
          cliente_dni_cuit: factura.cliente_dni_cuit || null,
          cliente_direccion: factura.cliente_direccion || null,
          cliente_condicion_iva: factura.cliente_condicion_iva || null,
          id_op: factura.id_op || null,
          numero_op: factura.numero_op || null,
          id_venta: factura.id_venta || null,
          id_factura_referencia: factura.id_factura_referencia || null,
          subtotal,
          descuento: descuentoTotal,
          iva: ivaTotal,
          total,
          estado: 'Borrador',
          estado_afip: 'Pendiente',
          observaciones: factura.observaciones || null
        }

        const { data: facturaData, error: errorFactura } = await supabase
          .from('facturas_venta')
          .insert(insertPayload)
          .select()
          .single()

        if (errorFactura) return { success: false, error: errorFactura.message }

        // Crear items
        const itemsData = itemsCalculados.map(item => ({
          id_factura: facturaData.id,
          ...item
        }))

        const { error: errorItems } = await supabase
          .from('facturas_items')
          .insert(itemsData)

        if (errorItems) {
          await supabase.from('facturas_venta').delete().eq('id', facturaData.id)
          return { success: false, error: errorItems.message }
        }

        // Obtener factura completa
        const { data: facturaCompleta, error: errorCompleto } = await supabase
          .from('facturas_venta')
          .select(`
            *,
            items:facturas_items(*)
          `)
          .eq('id', facturaData.id)
          .single()

        if (errorCompleto) return { success: false, error: errorCompleto.message }
        return { success: true, data: facturaCompleta as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== COSTOS OP ==========
  async getCostosOP(id_op: number): Promise<ApiResponse<import('../types/api').CostoOPRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('costos_op')
          .select('*')
          .eq('id_op', id_op)
          .order('fecha_costo', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as import('../types/api').CostoOPRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async crearCostoOP(costo: {
    id_op: number
    numero_op: string
    tipo_costo: 'Materiales' | 'Mano de Obra' | 'Gastos Generales' | 'Subcontratación' | 'Otros'
    concepto: string
    cantidad: number
    costo_unitario: number
    id_material?: number | null
    fecha_costo?: string
    observaciones?: string | null
  }): Promise<ApiResponse<import('../types/api').CostoOPRecord>> {
    if (supabase) {
      try {
        const costoTotal = costo.cantidad * costo.costo_unitario

        const { data, error } = await supabase
          .from('costos_op')
          .insert({
            id_op: costo.id_op,
            numero_op: costo.numero_op,
            tipo_costo: costo.tipo_costo,
            concepto: costo.concepto,
            cantidad: costo.cantidad,
            costo_unitario: costo.costo_unitario,
            costo_total: costoTotal,
            id_material: costo.id_material || null,
            fecha_costo: costo.fecha_costo || new Date().toISOString().split('T')[0],
            observaciones: costo.observaciones || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').CostoOPRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async calcularCostosOP(id_op: number): Promise<ApiResponse<{
    costo_materiales: number
    costo_mano_obra: number
    costo_gastos_generales: number
    costo_total: number
  }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('calcular_costos_op', {
          p_id_op: id_op
        })

        if (error) return { success: false, error: error.message }
        const row = Array.isArray(data) ? data[0] : data
        return { success: true, data: row as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getResumenCostosOPDashboard(options?: {
    buscar?: string
    limite?: number
  }): Promise<ApiResponse<import('../types/api').CostoOPResumen[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      const limite = options?.limite ?? 80
      const buscar = (options?.buscar || '').trim()

      const { data: costosRows, error: costosErr } = await supabase
        .from('costos_op')
        .select('*')
        .order('fecha_costo', { ascending: false })
        .limit(4000)

      if (costosErr) return { success: false, error: costosErr.message }

      const costos = (costosRows as import('../types/api').CostoOPRecord[]) ?? []
      const byOp = new Map<number, import('../types/api').CostoOPRecord[]>()

      for (const c of costos) {
        const list = byOp.get(c.id_op) ?? []
        list.push(c)
        byOp.set(c.id_op, list)
      }

      const opIdsFromSearch = new Set<number>()
      if (buscar) {
        const safe = buscar.replace(/[%_]/g, '')
        const { data: opsSearch } = await supabase
          .from('ordenes_trabajo')
          .select('id, numero_op, cliente, sector, entregado, reclamo_costo_monto')
          .or(`numero_op.ilike.%${safe}%,cliente.ilike.%${safe}%`)
          .limit(40)

        for (const o of opsSearch ?? []) {
          opIdsFromSearch.add(o.id)
          if (!byOp.has(o.id)) byOp.set(o.id, [])
        }
      }

      let opIds = [...byOp.keys()]
      if (buscar) {
        opIds = opIds.filter((id) => opIdsFromSearch.has(id))
      }

      opIds.sort((a, b) => {
        const fa = byOp.get(a)?.[0]?.fecha_costo ?? ''
        const fb = byOp.get(b)?.[0]?.fecha_costo ?? ''
        return fb.localeCompare(fa)
      })
      opIds = opIds.slice(0, limite)

      if (opIds.length === 0) {
        return { success: true, data: [] }
      }

      const { data: opsData, error: opsErr } = await supabase
        .from('ordenes_trabajo')
        .select('id, numero_op, cliente, sector, entregado, reclamo_costo_monto')
        .in('id', opIds)

      if (opsErr) return { success: false, error: opsErr.message }

      const opMap = new Map((opsData ?? []).map((o) => [o.id, o]))

      const ingresoPorOp = new Map<number, number>()

      const { data: ventas } = await supabase
        .from('ventas')
        .select('id_op, valor_total')
        .in('id_op', opIds)

      for (const v of ventas ?? []) {
        if (!v.id_op) continue
        const monto = Number(v.valor_total) || 0
        ingresoPorOp.set(v.id_op, (ingresoPorOp.get(v.id_op) ?? 0) + monto)
      }

      const sinIngresoVentas = opIds.filter((id) => !ingresoPorOp.has(id))
      if (sinIngresoVentas.length > 0) {
        const { data: facturas } = await supabase
          .from('facturas_venta')
          .select('id_op, total')
          .eq('estado', 'Emitida')
          .in('id_op', sinIngresoVentas)

        for (const f of facturas ?? []) {
          if (!f.id_op) continue
          const monto = Number(f.total) || 0
          ingresoPorOp.set(f.id_op, (ingresoPorOp.get(f.id_op) ?? 0) + monto)
        }
      }

      const sumTipo = (
        rows: import('../types/api').CostoOPRecord[],
        tipos: import('../types/api').CostoOPRecord['tipo_costo'][]
      ) => rows.filter((r) => tipos.includes(r.tipo_costo)).reduce((s, r) => s + (Number(r.costo_total) || 0), 0)

      const resumenes: import('../types/api').CostoOPResumen[] = []

      for (const id_op of opIds) {
        const rows = byOp.get(id_op) ?? []
        const op = opMap.get(id_op)
        const costo_materiales = sumTipo(rows, ['Materiales'])
        const costo_mano_obra = sumTipo(rows, ['Mano de Obra'])
        const costo_gastos_generales = sumTipo(rows, ['Gastos Generales'])
        const costo_logistica = sumTipo(rows, ['Subcontratación', 'Otros'])
        const costo_total = rows.reduce((s, r) => s + (Number(r.costo_total) || 0), 0)
        const ingreso = ingresoPorOp.get(id_op) ?? 0
        const margen_abs = ingreso - costo_total
        const margen_pct = ingreso > 0 ? (margen_abs / ingreso) * 100 : null

        let alerta: import('../types/api').CostoOPAlerta = 'ok'
        if (ingreso <= 0 && costo_total > 0) alerta = 'sin_ingreso'
        else if (ingreso > 0 && costo_total > ingreso) alerta = 'costo_supera_ingreso'
        else if (ingreso > 0 && margen_pct != null && margen_pct < 15) alerta = 'margen_bajo'

        resumenes.push({
          id_op,
          numero_op: op?.numero_op ?? rows[0]?.numero_op ?? String(id_op),
          cliente: op?.cliente ?? '—',
          sector: op?.sector ?? null,
          entregado: op?.entregado ?? null,
          reclamo_costo_monto: op?.reclamo_costo_monto ?? null,
          costo_materiales,
          costo_mano_obra,
          costo_gastos_generales,
          costo_logistica,
          costo_total,
          ingreso,
          margen_abs,
          margen_pct,
          alerta,
          cantidad_lineas: rows.length,
          ultima_fecha_costo: rows[0]?.fecha_costo ?? null
        })
      }

      return { success: true, data: resumenes }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async importarCostosMaterialesDesdeStock(
    id_op: number,
    numero_op: string
  ): Promise<ApiResponse<{ importados: number; omitidos: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      const movRes = await this.getMovimientosStock({
        id_orden_trabajo: id_op,
        tipo_movimiento: 'Salida',
        limit: 300
      })
      if (!movRes.success || !movRes.data) {
        return { success: false, error: movRes.error || 'No se pudieron leer movimientos de stock' }
      }

      const costosRes = await this.getCostosOP(id_op)
      const existentes = costosRes.data ?? []
      const yaImportados = new Set<number>()
      for (const c of existentes) {
        const m = c.observaciones?.match(/stock-mov-(\d+)/)
        if (m) yaImportados.add(Number(m[1]))
      }

      let importados = 0
      let omitidos = 0

      for (const mov of movRes.data) {
        if (yaImportados.has(mov.id)) {
          omitidos++
          continue
        }

        let costoUnit = 0
        if (stockSupabase && mov.id_articulo_stock) {
          const { data: art } = await stockSupabase
            .from('articulos')
            .select('precio')
            .eq('id', mov.id_articulo_stock)
            .maybeSingle()
          costoUnit = Number(art?.precio) || 0
        }

        const cantidad = Math.abs(Number(mov.cantidad) || 0) || 1
        const crear = await this.crearCostoOP({
          id_op,
          numero_op,
          tipo_costo: 'Materiales',
          concepto: mov.descripcion || mov.codigo_articulo || 'Material stock',
          cantidad,
          costo_unitario: costoUnit,
          id_material: mov.id_articulo_stock ?? null,
          fecha_costo: mov.created_at?.split('T')[0],
          observaciones: `Importado stock-mov-${mov.id}${costoUnit <= 0 ? ' · revisar costo unitario' : ''}`
        })

        if (crear.success) importados++
        else omitidos++
      }

      return { success: true, data: { importados, omitidos } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ========== CUENTAS POR COBRAR ==========
  async getCuentasPorCobrar(filters?: {
    estado?: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido' | 'Cancelado'
    fechaDesde?: string
    fechaHasta?: string
    id_cliente?: number
  }): Promise<ApiResponse<import('../types/api').CuentaPorCobrarRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('cuentas_por_cobrar')
          .select(`
            *,
            factura:facturas_venta!cuentas_por_cobrar_id_factura_fkey(*)
          `)
          .order('fecha_emision', { ascending: false })

        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.fechaDesde) {
          query = query.gte('fecha_emision', filters.fechaDesde)
        }
        if (filters?.fechaHasta) {
          query = query.lte('fecha_emision', filters.fechaHasta)
        }
        if (filters?.id_cliente) {
          query = query.eq('id_cliente', filters.id_cliente)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getCuentaPorCobrarByFacturaId(
    id_factura: number
  ): Promise<ApiResponse<(import('../types/api').CuentaPorCobrarRecord & { factura?: import('../types/api').FacturaVentaRecord | null }) | null>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cuentas_por_cobrar')
          .select(
            `
            *,
            factura:facturas_venta!cuentas_por_cobrar_id_factura_fkey(*)
          `
          )
          .eq('id_factura', id_factura)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any) ?? null }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== CUENTAS POR PAGAR ==========
  async getCuentasPorPagar(filters?: {
    id?: number
    estado?: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido' | 'Cancelado'
    fechaDesde?: string
    fechaHasta?: string
    id_proveedor?: number
    id_pedido_compra?: number
  }): Promise<ApiResponse<import('../types/api').CuentaPorPagarRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('cuentas_por_pagar')
          .select('*')
          .order('fecha_emision', { ascending: false })

        if (filters?.id != null) {
          query = query.eq('id', filters.id)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.fechaDesde) {
          query = query.gte('fecha_emision', filters.fechaDesde)
        }
        if (filters?.fechaHasta) {
          query = query.lte('fecha_emision', filters.fechaHasta)
        }
        if (filters?.id_proveedor) {
          query = query.eq('id_proveedor', filters.id_proveedor)
        }
        if (filters?.id_pedido_compra != null) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as import('../types/api').CuentaPorPagarRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  /** Sincroniza facturas de compra sin CxP → cuentas_por_pagar. */
  async erpSyncCxpDesdeFacturasCompra(): Promise<ApiResponse<{ insertadas: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('erp_sync_cxp_desde_facturas_compra')
      if (error) return { success: false, error: error.message }
      return { success: true, data: { insertadas: Number(data) || 0 } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /** Recalcula alertas admin de CxP (próximas a vencer / vencidas). */
  async erpRefreshAlertasCxp(diasAviso = 7): Promise<
    ApiResponse<{ proximo: number; vencido: number; total: number }>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('erp_refresh_alertas_cxp', { p_dias_aviso: diasAviso })
      if (error) return { success: false, error: error.message }
      const raw = (data || {}) as Record<string, unknown>
      return {
        success: true,
        data: {
          proximo: Number(raw.proximo) || 0,
          vencido: Number(raw.vencido) || 0,
          total: Number(raw.total) || Number(raw.proximo) + Number(raw.vencido) || 0
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getErpAlertasCxp(opts?: { soloNoLeidas?: boolean }): Promise<
    ApiResponse<
      Array<{
        id: number
        id_cuenta_por_pagar: number
        nivel: 'proximo' | 'vencido'
        dias_restantes: number | null
        mensaje: string | null
        leida: boolean
        proveedor_nombre?: string
        monto_pendiente?: number
        fecha_vencimiento?: string
      }>
    >
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      let q = supabase
        .from('erp_alertas_cxp')
        .select(
          `
          id,
          id_cuenta_por_pagar,
          nivel,
          dias_restantes,
          mensaje,
          leida,
          cuenta:cuentas_por_pagar(proveedor_nombre, monto_pendiente, fecha_vencimiento)
        `
        )
        .order('leida', { ascending: true })
        .order('dias_restantes', { ascending: true })

      if (opts?.soloNoLeidas) q = q.eq('leida', false)

      const { data, error } = await q
      if (error) return { success: false, error: error.message }

      const rows = (data || []).map((row: any) => ({
        id: row.id,
        id_cuenta_por_pagar: row.id_cuenta_por_pagar,
        nivel: row.nivel,
        dias_restantes: row.dias_restantes,
        mensaje: row.mensaje,
        leida: row.leida,
        proveedor_nombre: row.cuenta?.proveedor_nombre,
        monto_pendiente: row.cuenta?.monto_pendiente,
        fecha_vencimiento: row.cuenta?.fecha_vencimiento
      }))

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async marcarErpAlertaCxpLeida(id: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { error } = await supabase.from('erp_alertas_cxp').update({ leida: true, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async createCuentaPorPagar(input: {
    proveedor_nombre: string
    monto_total: number
    fecha_emision: string
    fecha_vencimiento?: string | null
    numero_documento?: string | null
    observaciones?: string | null
    id_pedido_compra?: number | null
    id_proveedor?: number | null
  }): Promise<ApiResponse<import('../types/api').CuentaPorPagarRecord>> {
    if (supabase) {
      try {
        const monto = Number(input.monto_total)
        if (!Number.isFinite(monto) || monto <= 0) {
          return { success: false, error: 'El monto total debe ser mayor a cero.' }
        }
        const nombre = String(input.proveedor_nombre || '').trim()
        if (!nombre) {
          return { success: false, error: 'Indicá el nombre del proveedor.' }
        }
        const { data, error } = await supabase
          .from('cuentas_por_pagar')
          .insert({
            proveedor_nombre: nombre,
            monto_total: monto,
            monto_pagado: 0,
            monto_pendiente: monto,
            fecha_emision: input.fecha_emision,
            fecha_vencimiento: input.fecha_vencimiento || null,
            numero_documento: input.numero_documento?.trim() || null,
            observaciones: input.observaciones?.trim() || null,
            id_pedido_compra: input.id_pedido_compra ?? null,
            id_proveedor: input.id_proveedor ?? null,
            estado: 'Pendiente'
          })
          .select('*')
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').CuentaPorPagarRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== DEUDAS PROVEEDORES ==========
  async importarDeudasProveedoresSeed(): Promise<ApiResponse<{ importados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const seed = (await import('../data/deudas-proveedores-seed.json')).default as {
        fecha_corte: string
        rows: Array<{ codigo: string; razon_social: string; telefono: string; saldo: number }>
      }
      const payload = seed.rows.map((r) => ({
        codigo: r.codigo,
        razon_social: r.razon_social,
        telefono: r.telefono || '-',
        saldo: r.saldo,
        fecha_corte: seed.fecha_corte
      }))
      const { error } = await supabase.from('deudas_proveedores').upsert(payload, { onConflict: 'codigo' })
      if (error) return { success: false, error: error.message }
      await supabase.rpc('vincular_deudas_proveedores')
      return { success: true, data: { importados: payload.length } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async vincularDeudasProveedores(): Promise<ApiResponse<{ vinculados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('vincular_deudas_proveedores')
      if (error) return { success: false, error: error.message }
      return { success: true, data: { vinculados: Number(data) || 0 } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getDeudasProveedores(options?: {
    buscar?: string
    soloConSaldo?: boolean
    idProveedor?: number
    proveedor?: string
  }): Promise<ApiResponse<import('../types/api').DeudaProveedorEnriquecida[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      let query = supabase.from('deudas_proveedores').select('*').order('codigo', { ascending: true })
      const { data, error } = await query

      if (error) {
        if (error.message.includes('deudas_proveedores') || error.code === '42P01') {
          const imp = await this.importarDeudasProveedoresSeed()
          if (!imp.success) return { success: false, error: imp.error }
          const retry = await supabase.from('deudas_proveedores').select('*').order('codigo', { ascending: true })
          if (retry.error) return { success: false, error: retry.error.message }
          return this.getDeudasProveedores(options)
        }
        return { success: false, error: error.message }
      }

      let rows = (data as import('../types/api').DeudaProveedorRecord[]) ?? []
      if (rows.length === 0) {
        const imp = await this.importarDeudasProveedoresSeed()
        if (imp.success) {
          const retry = await supabase.from('deudas_proveedores').select('*').order('codigo', { ascending: true })
          rows = (retry.data as import('../types/api').DeudaProveedorRecord[]) ?? []
        }
      }

      const [cxpRes, provRes] = await Promise.all([
        this.getCuentasPorPagar(),
        this.getProveedores(true)
      ])

      const cxp = cxpRes.data ?? []
      const proveedores = provRes.data ?? []

      const cxpByProveedor = new Map<number, { saldo: number; count: number }>()
      const cxpByNombre = new Map<string, { saldo: number; count: number }>()

      for (const c of cxp) {
        if (c.estado === 'Pagado' || c.estado === 'Cancelado') continue
        const monto = Number(c.monto_pendiente) || 0
        if (c.id_proveedor) {
          const prev = cxpByProveedor.get(c.id_proveedor) ?? { saldo: 0, count: 0 }
          cxpByProveedor.set(c.id_proveedor, { saldo: prev.saldo + monto, count: prev.count + 1 })
        }
        const key = (c.proveedor_nombre || '').trim().toUpperCase()
        if (key) {
          const prev = cxpByNombre.get(key) ?? { saldo: 0, count: 0 }
          cxpByNombre.set(key, { saldo: prev.saldo + monto, count: prev.count + 1 })
        }
      }

      const provMap = new Map(proveedores.map((p) => [p.id, p]))

      let enriched: import('../types/api').DeudaProveedorEnriquecida[] = rows.map((d) => {
        let saldo_cxp = 0
        let cxp_pendientes = 0
        let proveedor_nombre: string | null = null

        if (d.id_proveedor) {
          const agg = cxpByProveedor.get(d.id_proveedor)
          saldo_cxp = agg?.saldo ?? 0
          cxp_pendientes = agg?.count ?? 0
          proveedor_nombre = provMap.get(d.id_proveedor)?.nombre ?? null
        } else {
          const key = d.razon_social.trim().toUpperCase()
          const agg = cxpByNombre.get(key)
          saldo_cxp = agg?.saldo ?? 0
          cxp_pendientes = agg?.count ?? 0
        }

        return {
          ...d,
          saldo: Number(d.saldo) || 0,
          saldo_cxp,
          cxp_pendientes,
          proveedor_nombre
        }
      })

      const q = (options?.buscar || '').trim().toLowerCase()
      if (q) {
        enriched = enriched.filter(
          (d) =>
            d.codigo.toLowerCase().includes(q) ||
            d.razon_social.toLowerCase().includes(q) ||
            (d.telefono || '').toLowerCase().includes(q)
        )
      }

      if (options?.soloConSaldo) {
        enriched = enriched.filter((d) => Math.abs(d.saldo) > 0.01)
      }

      if (options?.idProveedor) {
        const provRes = await this.getProveedor(options.idProveedor)
        const prov = provRes.data
        enriched = enriched.filter(
          (d) =>
            d.id_proveedor === options.idProveedor ||
            (prov ? this.matchProveedorNombre(prov, d.razon_social) : false)
        )
      }

      if (options?.proveedor) {
        const p = options.proveedor.trim().toLowerCase()
        enriched = enriched.filter((d) => d.razon_social.toLowerCase().includes(p))
      }

      return { success: true, data: enriched }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ========== PAGOS PROVEEDORES (legacy planilla) ==========
  async importarPagosProveedoresSeed(): Promise<ApiResponse<{ importados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const seed = (await import('../data/pagos-proveedores-seed.json')).default as {
        fecha_desde: string
        fecha_hasta: string
        rows: Array<{
          fecha: string
          numero_pago: string
          numero_recibo: string
          proveedor_nombre: string
          usuario: string
          monto: number
        }>
      }
      const payload = seed.rows.map((r) => ({
        fecha: r.fecha,
        numero_pago: r.numero_pago,
        numero_recibo: r.numero_recibo || '',
        proveedor_nombre: r.proveedor_nombre,
        usuario: r.usuario || null,
        monto: r.monto,
        fecha_desde: seed.fecha_desde,
        fecha_hasta: seed.fecha_hasta
      }))
      const { error } = await supabase.from('pagos_proveedores').upsert(payload, {
        onConflict: 'numero_pago,numero_recibo'
      })
      if (error) return { success: false, error: error.message }
      await supabase.rpc('vincular_pagos_proveedores')
      return { success: true, data: { importados: payload.length } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async vincularPagosProveedores(): Promise<ApiResponse<{ vinculados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('vincular_pagos_proveedores')
      if (error) return { success: false, error: error.message }
      return { success: true, data: { vinculados: Number(data) || 0 } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getPagosProveedores(options?: {
    buscar?: string
    proveedor?: string
    idProveedor?: number
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<ApiResponse<import('../types/api').PagoProveedorEnriquecido[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      const { data, error } = await supabase
        .from('pagos_proveedores')
        .select('*')
        .order('fecha', { ascending: false })

      if (error) {
        if (error.message.includes('pagos_proveedores') || error.code === '42P01') {
          const imp = await this.importarPagosProveedoresSeed()
          if (!imp.success) return { success: false, error: imp.error }
          return this.getPagosProveedores(options)
        }
        return { success: false, error: error.message }
      }

      let rows = (data as import('../types/api').PagoProveedorRecord[]) ?? []
      if (rows.length === 0) {
        const imp = await this.importarPagosProveedoresSeed()
        if (imp.success) {
          const retry = await supabase.from('pagos_proveedores').select('*').order('fecha', { ascending: false })
          rows = (retry.data as import('../types/api').PagoProveedorRecord[]) ?? []
        }
      }

      const pagosSistema = await this.getPagosCobros({ tipo: 'Pago', limit: 500 })
      const sistemaPagos = pagosSistema.data ?? []

      const matchSistema = (p: import('../types/api').PagoProveedorRecord) => {
        if (p.id_pago_cobro) return p.id_pago_cobro
        const fecha = p.fecha?.split('T')[0]
        const monto = Number(p.monto) || 0
        const hit = sistemaPagos.find((s) => {
          const f = s.fecha_pago?.split('T')[0]
          return f === fecha && Math.abs(Number(s.monto) - monto) < 0.02
        })
        return hit?.id ?? null
      }

      let enriched: import('../types/api').PagoProveedorEnriquecido[] = rows.map((p) => {
        const idMatch = matchSistema(p)
        return {
          ...p,
          monto: Number(p.monto) || 0,
          vinculado_sistema: Boolean(p.id_pago_cobro || idMatch),
          id_pago_cobro_match: p.id_pago_cobro ?? idMatch
        }
      })

      const q = (options?.buscar || '').trim().toLowerCase()
      if (q) {
        enriched = enriched.filter(
          (p) =>
            p.numero_pago.toLowerCase().includes(q) ||
            p.numero_recibo.toLowerCase().includes(q) ||
            p.proveedor_nombre.toLowerCase().includes(q) ||
            (p.usuario || '').toLowerCase().includes(q)
        )
      }

      if (options?.proveedor) {
        const prov = options.proveedor.trim().toLowerCase()
        enriched = enriched.filter((p) => p.proveedor_nombre.toLowerCase().includes(prov))
      }

      if (options?.idProveedor) {
        const provRes = await this.getProveedor(options.idProveedor)
        const prov = provRes.data
        enriched = enriched.filter(
          (p) =>
            p.id_proveedor === options.idProveedor ||
            (prov ? this.matchProveedorNombre(prov, p.proveedor_nombre) : false)
        )
      }

      if (options?.fechaDesde) {
        enriched = enriched.filter((p) => p.fecha >= options.fechaDesde!)
      }
      if (options?.fechaHasta) {
        enriched = enriched.filter((p) => p.fecha <= options.fechaHasta!)
      }

      return { success: true, data: enriched }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ========== MOVIMIENTOS PROVEEDORES (legacy cuenta corriente) ==========
  async importarMovimientosProveedoresSeed(): Promise<ApiResponse<{ importados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const seed = (await import('../data/movimientos-proveedores-seed.json')).default as {
        rows: Array<{
          proveedor_nombre: string
          moneda: string
          fecha_desde: string
          fecha_hasta: string
          fecha_hora: string
          fecha_comprobante: string
          tipo_movimiento: string
          comprobante: string
          debe: number
          haber: number
          saldo: number
          es_saldo_inicial: boolean
        }>
      }
      const payload = seed.rows.map((r) => ({ ...r }))
      const { error } = await supabase.from('movimientos_proveedores').upsert(payload, {
        onConflict: 'proveedor_nombre,fecha_hora,comprobante,tipo_movimiento'
      })
      if (error) return { success: false, error: error.message }
      await supabase.rpc('vincular_movimientos_proveedores')
      return { success: true, data: { importados: payload.length } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async vincularMovimientosProveedores(): Promise<ApiResponse<{ vinculados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('vincular_movimientos_proveedores')
      if (error) return { success: false, error: error.message }
      return { success: true, data: { vinculados: Number(data) || 0 } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getMovimientosProveedores(options?: {
    buscar?: string
    proveedor?: string
    idProveedor?: number
    tipo?: string
  }): Promise<ApiResponse<import('../types/api').MovimientoProveedorEnriquecido[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      const { data, error } = await supabase
        .from('movimientos_proveedores')
        .select('*')
        .order('fecha_hora', { ascending: true })

      if (error) {
        if (error.message.includes('movimientos_proveedores') || error.code === '42P01') {
          const imp = await this.importarMovimientosProveedoresSeed()
          if (!imp.success) return { success: false, error: imp.error }
          return this.getMovimientosProveedores(options)
        }
        return { success: false, error: error.message }
      }

      let rows = (data as import('../types/api').MovimientoProveedorRecord[]) ?? []
      if (rows.length === 0) {
        const imp = await this.importarMovimientosProveedoresSeed()
        if (imp.success) {
          const retry = await supabase
            .from('movimientos_proveedores')
            .select('*')
            .order('fecha_hora', { ascending: true })
          rows = (retry.data as import('../types/api').MovimientoProveedorRecord[]) ?? []
        }
      }

      const pagosRes = await supabase.from('pagos_proveedores').select('id, numero_pago')
      const pagosMap = new Map<string, number>()
      for (const p of pagosRes.data ?? []) {
        const key = String((p as { numero_pago: string }).numero_pago || '').replace(/\s/g, '')
        if (key) pagosMap.set(key, (p as { id: number }).id)
      }

      const normPagoKey = (comprobante: string) => {
        const m = comprobante.match(/PA\s+(\d{5}-\d+)/i)
        return m ? m[1].replace(/\s/g, '') : ''
      }

      let enriched: import('../types/api').MovimientoProveedorEnriquecido[] = rows.map((m) => {
        const tipo = m.tipo_movimiento.toUpperCase()
        let enlace_tipo: 'pago' | 'factura' | 'nota' | null = null
        let id_pago_proveedor: number | null = null

        if (tipo.includes('PAGO')) {
          enlace_tipo = 'pago'
          const key = normPagoKey(m.comprobante)
          id_pago_proveedor = pagosMap.get(key) ?? null
        } else if (tipo.includes('FACTURA')) {
          enlace_tipo = 'factura'
        } else if (tipo.includes('NOTA')) {
          enlace_tipo = 'nota'
        }

        return {
          ...m,
          debe: Number(m.debe) || 0,
          haber: Number(m.haber) || 0,
          saldo: Number(m.saldo) || 0,
          enlace_tipo,
          id_pago_proveedor
        }
      })

      const q = (options?.buscar || '').trim().toLowerCase()
      if (q) {
        enriched = enriched.filter(
          (m) =>
            m.comprobante.toLowerCase().includes(q) ||
            m.tipo_movimiento.toLowerCase().includes(q) ||
            m.proveedor_nombre.toLowerCase().includes(q)
        )
      }
      if (options?.proveedor) {
        const p = options.proveedor.trim().toLowerCase()
        enriched = enriched.filter((m) => m.proveedor_nombre.toLowerCase().includes(p))
      }
      if (options?.tipo) {
        const t = options.tipo.trim().toLowerCase()
        enriched = enriched.filter((m) => m.tipo_movimiento.toLowerCase().includes(t))
      }

      if (options?.idProveedor) {
        const provRes = await this.getProveedor(options.idProveedor)
        const prov = provRes.data
        enriched = enriched.filter(
          (m) =>
            m.id_proveedor === options.idProveedor ||
            (prov ? this.matchProveedorNombre(prov, m.proveedor_nombre) : false)
        )
      }

      return { success: true, data: enriched }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ========== DEUDA CC PROVEEDORES (cuenta corriente detalle) ==========
  private async loadDeudaCcRows(): Promise<import('../types/api').DeudaCcProveedorRecord[]> {
    if (!supabase) return []

    type CcRow = import('../types/api').DeudaCcProveedorRecord
    type SeedFile = {
      rows: Array<Omit<CcRow, 'id' | 'id_proveedor'>>
    }

    const seedFromFile = async (): Promise<CcRow[]> => {
      const seed = (await import('../data/deuda-cc-proveedores-seed.json')).default as SeedFile
      return seed.rows.map((r, i) => ({
        id: -(i + 1),
        ...r,
        id_proveedor: null
      }))
    }

    try {
      const { data, error } = await supabase
        .from('deuda_cc_proveedores')
        .select('*')
        .order('fecha_vencimiento', { ascending: true })

      if (error) {
        if (error.message.includes('deuda_cc_proveedores') || error.code === '42P01') {
          const imp = await this.importarDeudaCcProveedoresSeed()
          if (imp.success) return this.loadDeudaCcRows()
        }
        return seedFromFile()
      }

      let rows = (data as CcRow[]) ?? []
      if (rows.length === 0) {
        const imp = await this.importarDeudaCcProveedoresSeed()
        if (imp.success) {
          const retry = await supabase
            .from('deuda_cc_proveedores')
            .select('*')
            .order('fecha_vencimiento', { ascending: true })
          rows = (retry.data as CcRow[]) ?? []
        }
      }

      if (rows.length === 0) return seedFromFile()
      return rows
    } catch {
      return seedFromFile()
    }
  }

  async importarDeudaCcProveedoresSeed(): Promise<ApiResponse<{ importados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const seed = (await import('../data/deuda-cc-proveedores-seed.json')).default as {
        rows: Array<Record<string, unknown>>
      }
      const payload = seed.rows.map((r) => ({ ...r }))
      const { error } = await supabase.from('deuda_cc_proveedores').upsert(payload, {
        onConflict: 'proveedor_nombre,tipo_comprobante,numero_comprobante,fecha_comprobante'
      })
      if (error) return { success: false, error: error.message }
      await supabase.rpc('vincular_deuda_cc_proveedores')
      return { success: true, data: { importados: payload.length } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async vincularDeudaCcProveedores(): Promise<ApiResponse<{ vinculados: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('vincular_deuda_cc_proveedores')
      if (error) return { success: false, error: error.message }
      return { success: true, data: { vinculados: Number(data) || 0 } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async getDeudaCcProveedores(options?: {
    buscar?: string
    idProveedor?: number
    soloConDeuda?: boolean
    proveedor?: string
    codigoProveedor?: string
  }): Promise<
    ApiResponse<{
      rows: import('../types/api').DeudaCcProveedorEnriquecido[]
      resumen: import('../types/api').DeudaCcProveedorResumen
      meta: { proveedor_nombre: string; proveedor_codigo: string; fecha_corte: string }
    }>
  > {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      const seed = (await import('../data/deuda-cc-proveedores-seed.json')).default as {
        proveedor_codigo: string
        proveedor_nombre: string
        fecha_corte: string
        resumen: import('../types/api').DeudaCcProveedorResumen
      }

      const rows = await this.loadDeudaCcRows()

      const movRes = await supabase.from('movimientos_proveedores').select('comprobante')
      const comprobantesMov = new Set(
        (movRes.data ?? []).map((m) => String((m as { comprobante: string }).comprobante || '').toUpperCase())
      )

      let enriched: import('../types/api').DeudaCcProveedorEnriquecido[] = rows.map((r) => {
        const enlace_movimiento = [...comprobantesMov].some((c) =>
          c.includes(r.numero_comprobante.toUpperCase())
        )
        return {
          ...r,
          total: Number(r.total) || 0,
          pagado: Number(r.pagado) || 0,
          deuda: Number(r.deuda) || 0,
          total_actualizado: Number(r.total_actualizado) || 0,
          enlace_movimiento,
          enlace_cxp: r.tipo_comprobante.toUpperCase().startsWith('F')
        }
      })

      const q = (options?.buscar || '').trim().toLowerCase()
      if (q) {
        enriched = enriched.filter(
          (r) =>
            r.numero_comprobante.toLowerCase().includes(q) ||
            r.tipo_comprobante.toLowerCase().includes(q) ||
            r.proveedor_nombre.toLowerCase().includes(q)
        )
      }

      if (options?.soloConDeuda) {
        enriched = enriched.filter((r) => Math.abs(r.deuda) > 0.01)
      }

      if (options?.idProveedor) {
        const provRes = await this.getProveedor(options.idProveedor)
        const prov = provRes.data
        enriched = enriched.filter(
          (r) =>
            r.id_proveedor === options.idProveedor ||
            (prov ? this.matchProveedorNombre(prov, r.proveedor_nombre) : false)
        )
      }

      if (options?.proveedor) {
        const p = options.proveedor.trim().toLowerCase()
        enriched = enriched.filter((r) => r.proveedor_nombre.toLowerCase().includes(p))
      }

      if (options?.codigoProveedor) {
        const c = options.codigoProveedor.trim()
        enriched = enriched.filter((r) => r.proveedor_codigo === c)
      }

      const useSeedResumen =
        enriched.length > 0 &&
        enriched.every(
          (r) =>
            r.proveedor_nombre === seed.proveedor_nombre ||
            r.proveedor_codigo === seed.proveedor_codigo
        )

      const resumenCalc: import('../types/api').DeudaCcProveedorResumen = {
        total_comprobantes: enriched.reduce((s, r) => s + r.deuda, 0),
        total_cheques: useSeedResumen ? (seed.resumen?.total_cheques ?? 0) : 0,
        total_cta_cte: useSeedResumen
          ? (seed.resumen?.total_cta_cte ?? enriched.reduce((s, r) => s + r.deuda, 0))
          : enriched.reduce((s, r) => s + r.deuda, 0)
      }

      const metaRow = enriched[0] ?? rows[0]
      const meta = {
        proveedor_nombre: metaRow?.proveedor_nombre ?? seed.proveedor_nombre,
        proveedor_codigo: metaRow?.proveedor_codigo ?? seed.proveedor_codigo,
        fecha_corte: metaRow?.fecha_corte ?? seed.fecha_corte
      }

      return { success: true, data: { rows: enriched, resumen: resumenCalc, meta } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ========== PAGOS Y COBROS ==========
  async getPagosCobros(filters?: {
    tipo?: 'Pago' | 'Cobro'
    fechaDesde?: string
    fechaHasta?: string
    id_cuenta_bancaria?: number
    limit?: number
  }): Promise<ApiResponse<import('../types/api').PagoCobroRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('pagos_cobros')
          .select('*')
          .order('fecha_pago', { ascending: false })
          .order('id', { ascending: false })

        if (filters?.tipo) query = query.eq('tipo', filters.tipo)
        if (filters?.fechaDesde) query = query.gte('fecha_pago', filters.fechaDesde)
        if (filters?.fechaHasta) query = query.lte('fecha_pago', filters.fechaHasta)
        if (filters?.id_cuenta_bancaria) query = query.eq('id_cuenta_bancaria', filters.id_cuenta_bancaria)
        if (filters?.limit) query = query.limit(filters.limit)

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as import('../types/api').PagoCobroRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getCuentasBancarias(filters?: { activa?: boolean }): Promise<ApiResponse<import('../types/api').CuentaBancariaRecord[]>> {
    if (supabase) {
      try {
        let query = supabase.from('cuentas_bancarias').select('*').order('nombre', { ascending: true })
        if (filters?.activa !== undefined) query = query.eq('activa', filters.activa)
        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as import('../types/api').CuentaBancariaRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async createCuentaBancaria(input: {
    nombre: string
    banco?: string | null
    tipo?: string | null
    moneda?: string
    activa?: boolean
    saldo_inicial?: number
  }): Promise<ApiResponse<import('../types/api').CuentaBancariaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cuentas_bancarias')
          .insert({
            nombre: input.nombre,
            banco: input.banco ?? null,
            tipo: input.tipo ?? null,
            moneda: (input.moneda ?? 'ARS') as any,
            activa: input.activa ?? true,
            saldo_inicial: input.saldo_inicial ?? 0
          })
          .select('*')
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').CuentaBancariaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async updateCuentaBancaria(
    id: number,
    updates: Partial<import('../types/api').CuentaBancariaRecord>
  ): Promise<ApiResponse<import('../types/api').CuentaBancariaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cuentas_bancarias')
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq('id', id)
          .select('*')
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as import('../types/api').CuentaBancariaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async registrarCobro(cobro: {
    id_cuenta_por_cobrar: number
    monto: number
    fecha_pago: string
    metodo_pago: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Depósito' | 'Otro'
    numero_comprobante?: string | null
    id_cuenta_bancaria?: number | null
    observaciones?: string | null
  }): Promise<ApiResponse<import('../types/api').PagoCobroRecord>> {
    if (supabase) {
      try {
        const usuarioData = localStorage.getItem('usuario')
        const usuario = usuarioData ? JSON.parse(usuarioData) : null

        const { data, error } = await supabase
          .from('pagos_cobros')
          .insert({
            tipo: 'Cobro',
            id_cuenta_por_cobrar: cobro.id_cuenta_por_cobrar,
            monto: cobro.monto,
            fecha_pago: cobro.fecha_pago,
            metodo_pago: cobro.metodo_pago,
            numero_comprobante: cobro.numero_comprobante || null,
            id_cuenta_bancaria: cobro.id_cuenta_bancaria || null,
            observaciones: cobro.observaciones || null,
            id_usuario: usuario?.id || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }

        // Asiento contable automático (si existe RPC)
        try {
          await supabase.rpc('crear_asiento_desde_pago_cobro', { p_id_pago_cobro: (data as any).id })
        } catch (e) {
          console.warn('No se pudo crear asiento desde cobro:', e)
        }

        // Mantener CxC consistente: recalcular montos y estado
        try {
          const { data: cuenta, error: errCuenta } = await supabase
            .from('cuentas_por_cobrar')
            .select('*')
            .eq('id', cobro.id_cuenta_por_cobrar)
            .single()

          if (!errCuenta && cuenta) {
            const montoTotal = Number((cuenta as any).monto_total) || 0
            const pagadoPrev = Number((cuenta as any).monto_pagado) || 0
            const pagadoNuevo = pagadoPrev + (Number(cobro.monto) || 0)
            const pendienteNuevo = Math.max(0, montoTotal - pagadoNuevo)

            const fv = (cuenta as any).fecha_vencimiento ? new Date((cuenta as any).fecha_vencimiento).getTime() : null
            const now = Date.now()

            let estadoNuevo: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido' | 'Cancelado' = 'Pendiente'
            if (pendienteNuevo <= 0) estadoNuevo = 'Pagado'
            else if (pagadoNuevo > 0) estadoNuevo = 'Parcial'
            if (estadoNuevo !== 'Pagado' && fv && fv < now) estadoNuevo = 'Vencido'

            await supabase
              .from('cuentas_por_cobrar')
              .update({
                monto_pagado: pagadoNuevo,
                monto_pendiente: pendienteNuevo,
                estado: estadoNuevo,
                updated_at: new Date().toISOString()
              })
              .eq('id', cobro.id_cuenta_por_cobrar)
          }
        } catch (e) {
          console.warn('No se pudo actualizar CxC luego del cobro:', e)
        }

        return { success: true, data: data as import('../types/api').PagoCobroRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async registrarPago(pago: {
    id_cuenta_por_pagar: number
    monto: number
    fecha_pago: string
    metodo_pago: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Depósito' | 'Otro'
    numero_comprobante?: string | null
    id_cuenta_bancaria?: number | null
    observaciones?: string | null
  }): Promise<ApiResponse<import('../types/api').PagoCobroRecord>> {
    if (supabase) {
      try {
        const usuarioData = localStorage.getItem('usuario')
        const usuario = usuarioData ? JSON.parse(usuarioData) : null

        const { data, error } = await supabase
          .from('pagos_cobros')
          .insert({
            tipo: 'Pago',
            id_cuenta_por_pagar: pago.id_cuenta_por_pagar,
            monto: pago.monto,
            fecha_pago: pago.fecha_pago,
            metodo_pago: pago.metodo_pago,
            numero_comprobante: pago.numero_comprobante || null,
            id_cuenta_bancaria: pago.id_cuenta_bancaria || null,
            observaciones: pago.observaciones || null,
            id_usuario: usuario?.id || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }

        // Asiento contable automático (si existe RPC)
        try {
          await supabase.rpc('crear_asiento_desde_pago_cobro', { p_id_pago_cobro: (data as any).id })
        } catch (e) {
          console.warn('No se pudo crear asiento desde pago:', e)
        }

        // Mantener CxP consistente (si no hay trigger en BD)
        try {
          const { data: cuenta, error: errCuenta } = await supabase
            .from('cuentas_por_pagar')
            .select('*')
            .eq('id', pago.id_cuenta_por_pagar)
            .single()

          if (!errCuenta && cuenta) {
            const montoTotal = Number((cuenta as any).monto_total) || 0
            const pagadoPrev = Number((cuenta as any).monto_pagado) || 0
            const pagadoNuevo = pagadoPrev + (Number(pago.monto) || 0)
            const pendienteNuevo = Math.max(0, montoTotal - pagadoNuevo)

            const fv = (cuenta as any).fecha_vencimiento ? new Date((cuenta as any).fecha_vencimiento).getTime() : null
            const now = Date.now()

            let estadoNuevo: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido' | 'Cancelado' = 'Pendiente'
            if (pendienteNuevo <= 0) estadoNuevo = 'Pagado'
            else if (pagadoNuevo > 0) estadoNuevo = 'Parcial'
            if (estadoNuevo !== 'Pagado' && fv && fv < now) estadoNuevo = 'Vencido'

            await supabase
              .from('cuentas_por_pagar')
              .update({
                monto_pagado: pagadoNuevo,
                monto_pendiente: pendienteNuevo,
                estado: estadoNuevo,
                updated_at: new Date().toISOString()
              })
              .eq('id', pago.id_cuenta_por_pagar)
          }
        } catch (e) {
          console.warn('No se pudo actualizar CxP luego del pago:', e)
        }

        const pagoRecord = data as import('../types/api').PagoCobroRecord
        void (async () => {
          try {
            const { syncEgresoDesdePagoPlotLab } = await import('../features/control-cajas/plotlabEgresosSync')
            const { getParams, listCajas, resolveCajaSlugForUsuario } = await import(
              '../features/control-cajas/cajaRepository'
            )
            const usuarioData = localStorage.getItem('usuario')
            const usuario = usuarioData ? JSON.parse(usuarioData) : null
            const [cajas, params] = await Promise.all([listCajas(), getParams()])
            const cajaSlug =
              resolveCajaSlugForUsuario(
                usuario?.nombre || 'Tesorería',
                cajas,
                params.cajeras,
                { usuarioId: usuario?.id }
              ) || cajas.find((c) => c.slug !== 'admin' && c.slug !== 'vuelto')?.slug
            if (!cajaSlug) return
            let concepto = `Pago proveedor #${pago.id_cuenta_por_pagar}`
            if (supabase) {
              const { data: cxp } = await supabase
                .from('cuentas_por_pagar')
                .select('proveedor_nombre, concepto')
                .eq('id', pago.id_cuenta_por_pagar)
                .maybeSingle()
              if (cxp) {
                concepto =
                  (cxp as { proveedor_nombre?: string; concepto?: string }).proveedor_nombre ||
                  (cxp as { concepto?: string }).concepto ||
                  concepto
              }
            }
            await syncEgresoDesdePagoPlotLab({
              pagoId: pagoRecord.id,
              monto: Number(pago.monto) || 0,
              metodoPago: pago.metodo_pago,
              fecha: pago.fecha_pago,
              concepto,
              cajaSlug,
              usuarioId: usuario?.id,
              usuarioNombre: usuario?.nombre || 'Tesorería',
              numeroComprobante: pago.numero_comprobante
            })
          } catch (e) {
            console.warn('Sync egreso pago → caja:', e)
          }
        })()

        return { success: true, data: pagoRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== ACTUALIZACIÓN DE FACTURAS ==========
  async actualizarFactura(
    id: number,
    updates: Partial<import('../types/api').FacturaVentaRecord>
  ): Promise<ApiResponse<import('../types/api').FacturaVentaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('facturas_venta')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select(`
            *,
            items:facturas_items(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async emitirFactura(id: number): Promise<ApiResponse<import('../types/api').FacturaVentaRecord>> {
    if (supabase) {
      try {
        // Obtener factura
        const { data: factura, error: errorFactura } = await supabase
          .from('facturas_venta')
          .select('*')
          .eq('id', id)
          .single()

        if (errorFactura) return { success: false, error: errorFactura.message }
        if (!factura) return { success: false, error: 'Factura no encontrada' }

        if (factura.estado !== 'Borrador') {
          return { success: false, error: 'Solo se pueden emitir facturas en estado Borrador' }
        }

        // Actualizar estado
        const { data, error } = await supabase
          .from('facturas_venta')
          .update({
            estado: 'Emitida',
            estado_afip: 'Pendiente',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select(`
            *,
            items:facturas_items(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }

        const tipo = String(factura.tipo_comprobante || '')
        const esNotaCredito = tipo.startsWith('Nota de Crédito')

        // Crear cuenta por cobrar automáticamente (solo facturas y notas débito; las notas crédito ajustan deuda y no generan CxC)
        if (!esNotaCredito) {
          await supabase
            .from('cuentas_por_cobrar')
            .insert({
              id_factura: id,
              id_cliente: factura.id_cliente || null,
              cliente_nombre: factura.cliente_nombre,
              monto_total: factura.total,
              monto_pagado: 0,
              monto_pendiente: factura.total,
              fecha_emision: factura.fecha_emision,
              fecha_vencimiento: factura.fecha_vencimiento || null,
              estado: 'Pendiente'
            })
        }

        // Crear asiento contable automático si está configurado
        const { error: errorAsiento } = await supabase.rpc('crear_asiento_desde_factura', {
          p_id_factura: id
        })
        if (errorAsiento) {
          console.warn('No se pudo crear asiento contable automático:', errorAsiento.message)
        }

        return { success: true, data: data as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getFactura(id: number): Promise<ApiResponse<import('../types/api').FacturaVentaRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('facturas_venta')
          .select(`
            *,
            items:facturas_items(*),
            cliente:clientes(*),
            asiento:asientos_contables(*)
          `)
          .eq('id', id)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== CREAR FACTURA DESDE OP ==========
  async crearFacturaDesdeOP(id_op: number, datosAdicionales?: {
    tipo_comprobante?: 'Factura A' | 'Factura B' | 'Factura C'
    fecha_emision?: string
    fecha_vencimiento?: string
    observaciones?: string
  }): Promise<ApiResponse<import('../types/api').FacturaVentaRecord>> {
    if (supabase) {
      try {
        // Obtener OP
        const { data: op, error: errorOP } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', id_op)
          .single()

        if (errorOP) return { success: false, error: errorOP.message }
        if (!op) return { success: false, error: 'Orden de trabajo no encontrada' }

        // Obtener venta asociada si existe
        const { data: venta } = await supabase
          .from('ventas')
          .select('*')
          .eq('id_op', id_op)
          .maybeSingle()

        // Determinar tipo de comprobante según cliente
        let tipoComprobante: 'Factura A' | 'Factura B' | 'Factura C' = 'Factura B'
        if (op.dni_cuit && op.dni_cuit.length === 11) {
          // Si tiene CUIT, probablemente es Factura A
          tipoComprobante = datosAdicionales?.tipo_comprobante || 'Factura A'
        } else {
          tipoComprobante = datosAdicionales?.tipo_comprobante || 'Factura B'
        }

        // Crear items de la factura desde la venta o desde la OP
        let items: Array<{
          descripcion: string
          cantidad: number
          precio_unitario: number
          iva_porcentaje: number
        }> = []

        if (venta) {
          // Si hay venta, usar items de la venta
          const { data: ventaItems } = await supabase
            .from('ventas_items')
            .select('*')
            .eq('id_venta', venta.id)

          if (ventaItems) {
            items = ventaItems.map(item => ({
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              iva_porcentaje: 21 // Por defecto 21%
            }))
          }
        } else {
          // Si no hay venta, crear un item genérico desde la OP
          items = [{
            descripcion: op.descripcion || `Trabajo ${op.numero_op}`,
            cantidad: 1,
            precio_unitario: 0, // Se debe completar manualmente
            iva_porcentaje: 21
          }]
        }

        // Crear factura
        const facturaResponse = await this.crearFactura({
          tipo_comprobante: tipoComprobante,
          fecha_emision: datosAdicionales?.fecha_emision || new Date().toISOString().split('T')[0],
          fecha_vencimiento: datosAdicionales?.fecha_vencimiento || null,
          id_cliente: null, // Se puede asociar después
          cliente_nombre: op.cliente,
          cliente_dni_cuit: op.dni_cuit || null,
          cliente_direccion: op.direccion_cliente || null,
          cliente_condicion_iva: null, // Se debe completar
          id_op: id_op,
          numero_op: op.numero_op,
          id_venta: venta?.id || null,
          items: items,
          observaciones: datosAdicionales?.observaciones || null
        })

        return facturaResponse
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== REPORTES FINANCIEROS ==========
  async getEstadoResultados(fechaDesde: string, fechaHasta: string): Promise<ApiResponse<{
    ingresos: number
    costos: number
    gastos: number
    utilidad_bruta: number
    utilidad_neta: number
    detalle_ingresos: Array<{ cuenta: string; monto: number }>
    detalle_costos: Array<{ cuenta: string; monto: number }>
    detalle_gastos: Array<{ cuenta: string; monto: number }>
  }>> {
    if (supabase) {
      try {
        // Primero obtener IDs de cuentas por tipo
        const { data: cuentasIngreso } = await supabase
          .from('plan_cuentas')
          .select('id')
          .eq('tipo', 'Ingreso')
          .eq('activa', true)

        const { data: cuentasCosto } = await supabase
          .from('plan_cuentas')
          .select('id')
          .eq('tipo', 'Costo')
          .eq('activa', true)

        const { data: cuentasGasto } = await supabase
          .from('plan_cuentas')
          .select('id')
          .eq('tipo', 'Gasto')
          .eq('activa', true)

        const idsIngreso = cuentasIngreso?.map(c => c.id) || []
        const idsCosto = cuentasCosto?.map(c => c.id) || []
        const idsGasto = cuentasGasto?.map(c => c.id) || []

        // Obtener asientos en el rango de fechas
        const { data: asientos } = await supabase
          .from('asientos_contables')
          .select('id, fecha')
          .gte('fecha', fechaDesde)
          .lte('fecha', fechaHasta)
          .eq('estado', 'Contabilizado')

        const idsAsientos = asientos?.map(a => a.id) || []

        if (idsAsientos.length === 0) {
          return {
            success: true,
            data: {
              ingresos: 0,
              costos: 0,
              gastos: 0,
              utilidad_bruta: 0,
              utilidad_neta: 0,
              detalle_ingresos: [],
              detalle_costos: [],
              detalle_gastos: []
            }
          }
        }

        // Obtener detalles de asientos con cuentas
        const { data: detallesData } = await supabase
          .from('asientos_detalle')
          .select(`
            debe,
            haber,
            cuenta:plan_cuentas(id, codigo, nombre, tipo)
          `)
          .in('id_asiento', idsAsientos)

        if (!detallesData) {
          return {
            success: true,
            data: {
              ingresos: 0,
              costos: 0,
              gastos: 0,
              utilidad_bruta: 0,
              utilidad_neta: 0,
              detalle_ingresos: [],
              detalle_costos: [],
              detalle_gastos: []
            }
          }
        }

        // Filtrar y calcular
        const ingresosData = detallesData.filter((d: any) => 
          d.cuenta && idsIngreso.includes(d.cuenta.id) && d.haber > 0
        )
        const costosData = detallesData.filter((d: any) => 
          d.cuenta && idsCosto.includes(d.cuenta.id) && d.debe > 0
        )
        const gastosData = detallesData.filter((d: any) => 
          d.cuenta && idsGasto.includes(d.cuenta.id) && d.debe > 0
        )

        // Calcular totales
        const ingresos = ingresosData.reduce((sum: number, item: any) => sum + (item.haber || 0), 0)
        const costos = costosData.reduce((sum: number, item: any) => sum + (item.debe || 0), 0)
        const gastos = gastosData.reduce((sum: number, item: any) => sum + (item.debe || 0), 0)
        const utilidadBruta = ingresos - costos
        const utilidadNeta = utilidadBruta - gastos

        // Agrupar por cuenta
        const detalleIngresos = ingresosData.reduce((acc: any, item: any) => {
          const cuentaNombre = item.cuenta?.nombre || 'Sin cuenta'
          acc[cuentaNombre] = (acc[cuentaNombre] || 0) + (item.haber || 0)
          return acc
        }, {})

        const detalleCostos = costosData.reduce((acc: any, item: any) => {
          const cuentaNombre = item.cuenta?.nombre || 'Sin cuenta'
          acc[cuentaNombre] = (acc[cuentaNombre] || 0) + (item.debe || 0)
          return acc
        }, {})

        const detalleGastos = gastosData.reduce((acc: any, item: any) => {
          const cuentaNombre = item.cuenta?.nombre || 'Sin cuenta'
          acc[cuentaNombre] = (acc[cuentaNombre] || 0) + (item.debe || 0)
          return acc
        }, {})

        return {
          success: true,
          data: {
            ingresos,
            costos,
            gastos,
            utilidad_bruta: utilidadBruta,
            utilidad_neta: utilidadNeta,
            detalle_ingresos: Object.entries(detalleIngresos).map(([cuenta, monto]) => ({
              cuenta,
              monto: monto as number
            })),
            detalle_costos: Object.entries(detalleCostos).map(([cuenta, monto]) => ({
              cuenta,
              monto: monto as number
            })),
            detalle_gastos: Object.entries(detalleGastos).map(([cuenta, monto]) => ({
              cuenta,
              monto: monto as number
            }))
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== REPORTES FINANCIEROS ADICIONALES ==========
  async getBalanceGeneral(fechaCorte?: string): Promise<ApiResponse<Array<{
    tipo_cuenta: string
    codigo_cuenta: string
    nombre_cuenta: string
    saldo_deudor: number
    saldo_acreedor: number
    saldo_final: number
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_balance_general', {
          p_fecha_corte: fechaCorte || new Date().toISOString().split('T')[0]
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getFlujoCaja(fechaDesde: string, fechaHasta: string): Promise<ApiResponse<Array<{
    fecha: string
    concepto: string
    tipo: string
    ingreso: number
    egreso: number
    saldo_acumulado: number
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_flujo_caja', {
          p_fecha_desde: fechaDesde,
          p_fecha_hasta: fechaHasta
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async getResumenCuentas(fechaCorte?: string): Promise<ApiResponse<Array<{
    tipo_cuenta: string
    total_deudor: number
    total_acreedor: number
    saldo_final: number
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_resumen_cuentas', {
          p_fecha_corte: fechaCorte || new Date().toISOString().split('T')[0]
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as any[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== CONFIGURACIÓN AFIP ==========
  async getConfiguracionAFIP(): Promise<ApiResponse<import('../types/api').ConfiguracionAFIPRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('get_configuracion_afip_resumen')

        if (error) {
          return { success: false, error: error.message }
        }
        if (!data || typeof data !== 'object') {
          return { success: true, data: undefined }
        }
        return {
          success: true,
          data: data as import('../types/api').ConfiguracionAFIPRecord
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarConfiguracionAFIP(
    updates: Partial<import('../types/api').ConfiguracionAFIPRecord>
  ): Promise<ApiResponse<import('../types/api').ConfiguracionAFIPRecord>> {
    if (supabase) {
      try {
        const { certificado_afip: _c, clave_certificado: _k, token_afip: _t, sign_afip: _s, ...safe } =
          updates as Record<string, unknown>
        void _c
        void _k
        void _t
        void _s

        const { data, error } = await supabase.rpc('guardar_configuracion_afip', {
          p_payload: safe
        })

        if (error) return { success: false, error: error.message }
        if (!data) return { success: false, error: 'No se recibió configuración guardada' }
        return {
          success: true,
          data: data as import('../types/api').ConfiguracionAFIPRecord
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ============================================
  // PROTOCOLOS Y BASES (RRHH / ADMIN)
  // ============================================

  async getProtocolosBases(): Promise<ApiResponse<ProtocoloBaseRecord[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase
        .from('protocolos_bases')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as ProtocoloBaseRecord[]) ?? [] }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async createProtocoloBase(input: {
    titulo: string
    categoria: string | null
    tipo: 'protocolo' | 'base' | 'otro'
    tags: string[]
    archivoUrl: string | null
    archivoNombre: string | null
    fileMime: string | null
    contenidoTexto: string | null
  }): Promise<ApiResponse<ProtocoloBaseRecord>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    try {
      const usuarioId = this.getUsuarioIdFromStorage()
      if (usuarioId == null) {
        return { success: false, error: 'Sesión no disponible. Volvé a iniciar sesión.' }
      }

      // Login por RPC (sin JWT de Supabase Auth): la tabla usa RLS; el alta va por RPC SECURITY DEFINER.
      const { data, error } = await supabase.rpc('crear_protocolo_base', {
        p_usuario_id: usuarioId,
        p_titulo: input.titulo,
        p_categoria: input.categoria,
        p_tipo: input.tipo,
        p_tags: input.tags,
        p_archivo_url: input.archivoUrl,
        p_archivo_nombre: input.archivoNombre,
        p_file_mime: input.fileMime,
        p_contenido_texto: input.contenidoTexto
      })

      if (error) return { success: false, error: error.message }
      const row = data as ProtocoloBaseRecord | null
      if (!row) return { success: false, error: 'No se pudo crear el registro' }
      return { success: true, data: row }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async deleteProtocoloBase(id: string): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const usuarioId = this.getUsuarioIdFromStorage()
      if (usuarioId == null) {
        return { success: false, error: 'Sesión no disponible. Volvé a iniciar sesión.' }
      }

      const { data, error } = await supabase.rpc('eliminar_protocolo_base', {
        p_id: id,
        p_usuario_id: usuarioId
      })

      if (error) return { success: false, error: error.message }
      return { success: true, data: Boolean(data) }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  /** ID de public.usuarios guardado en login (login_usuario); no confundir con Supabase Auth UUID */
  private getUsuarioIdFromStorage(): number | null {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem('usuario_id')
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  }

  // ============================================
  // PRUEBAS DE CONOCIMIENTO (RRHH)
  // ============================================

  async rrhhPruebaGuardar(input: {
    idPrueba?: string | null
    titulo: string
    descripcion: string | null
    tiempoTotalSegundos: number | null
    /** Porcentaje mínimo sobre el total de puntos para aprobar (1–100) */
    porcentajeAprobacion: number
    preguntas: PruebaPreguntaInput[]
  }): Promise<ApiResponse<string>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const p_preguntas = input.preguntas.map((p, idx) => ({
        orden: p.orden ?? idx + 1,
        texto: p.texto,
        tipo: p.tipo,
        tiempo_segundos: p.tiempo_segundos ?? null,
        puntos: p.puntos != null && p.puntos > 0 ? p.puntos : 1,
        opciones:
          p.tipo === 'multiple_choice' || p.tipo === 'verdadero_falso' ? p.opciones ?? [] : [],
        indice_correcto:
          (p.tipo === 'multiple_choice' || p.tipo === 'verdadero_falso') && p.indice_correcto != null
            ? p.indice_correcto
            : null
      }))
      const { data, error } = await supabase.rpc('rrhh_prueba_guardar', {
        p_usuario_id: usuarioId,
        p_id_prueba: input.idPrueba ?? null,
        p_titulo: input.titulo,
        p_descripcion: input.descripcion,
        p_tiempo_total_segundos: input.tiempoTotalSegundos,
        p_porcentaje_aprobacion: input.porcentajeAprobacion,
        p_preguntas: p_preguntas
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as string }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async rrhhPruebaAsignar(idPrueba: string, idsUsuarios: number[]): Promise<ApiResponse<number>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('rrhh_prueba_asignar', {
        p_usuario_id: usuarioId,
        p_id_prueba: idPrueba,
        p_ids_usuarios: idsUsuarios
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as number }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async rrhhPruebaObtener(idPrueba: string): Promise<ApiResponse<unknown>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('rrhh_prueba_obtener', {
        p_usuario_id: usuarioId,
        p_id_prueba: idPrueba
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async rrhhPruebaEliminar(idPrueba: string): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('rrhh_prueba_eliminar', {
        p_usuario_id: usuarioId,
        p_id_prueba: idPrueba
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: Boolean(data) }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async rrhhPruebasListar(): Promise<ApiResponse<unknown>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('rrhh_pruebas_listar', {
        p_usuario_id: usuarioId
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async rrhhPruebaResultados(idPrueba: string): Promise<ApiResponse<unknown>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('rrhh_prueba_resultados', {
        p_usuario_id: usuarioId,
        p_id_prueba: idPrueba
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  /** Calificar pregunta de desarrollo (0 al máximo de la pregunta). Requiere patch SQL 2026-03-27. */
  async rrhhPruebaCalificarDesarrollo(
    idAsignacion: string,
    idPregunta: string,
    puntos: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('rrhh_prueba_calificar_desarrollo', {
        p_usuario_id: usuarioId,
        p_id_asignacion: idAsignacion,
        p_id_pregunta: idPregunta,
        p_puntos: puntos
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: Boolean(data) }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async usuarioMisPruebas(): Promise<ApiResponse<unknown>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    return this.obtenerPruebasColaborador(usuarioId)
  }

  /** Pruebas asignadas a un colaborador (legajo RRHH, mis pruebas). */
  async obtenerPruebasColaborador(
    idColaborador: number
  ): Promise<ApiResponse<PruebaAsignacionColaborador[]>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    try {
      const { data, error } = await supabase.rpc('usuario_mis_pruebas', {
        p_usuario_id: idColaborador
      })
      if (error) return { success: false, error: error.message }
      const rows = Array.isArray(data) ? data : []
      return {
        success: true,
        data: rows as PruebaAsignacionColaborador[]
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error al obtener pruebas del colaborador'
      }
    }
  }

  async usuarioPruebaIniciar(idPrueba: string): Promise<ApiResponse<string>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('usuario_prueba_iniciar', {
        p_usuario_id: usuarioId,
        p_id_prueba: idPrueba
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as string }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async usuarioPruebaPantalla(idAsignacion: string): Promise<ApiResponse<unknown>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('usuario_prueba_pantalla', {
        p_usuario_id: usuarioId,
        p_id_asignacion: idAsignacion
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async usuarioPruebaResponder(
    idAsignacion: string,
    idPregunta: string,
    respuestaTexto: string | null,
    opcionElegida: number | null
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('usuario_prueba_responder', {
        p_usuario_id: usuarioId,
        p_id_asignacion: idAsignacion,
        p_id_pregunta: idPregunta,
        p_respuesta_texto: respuestaTexto,
        p_opcion_elegida: opcionElegida
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: Boolean(data) }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async usuarioPruebaFinalizar(idAsignacion: string): Promise<ApiResponse<boolean>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }
    const usuarioId = this.getUsuarioIdFromStorage()
    if (usuarioId == null) return { success: false, error: 'Sesión no disponible' }
    try {
      const { data, error } = await supabase.rpc('usuario_prueba_finalizar', {
        p_usuario_id: usuarioId,
        p_id_asignacion: idAsignacion
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: Boolean(data) }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  // ============================================
  // AGENDA DEL ASESOR TÉCNICO
  // ============================================

  async getCitasAsesor(
    idAsesor: number,
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<ApiResponse<CitaAsesorTecnico[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_citas_asesor', {
          p_id_asesor: idAsesor,
          p_fecha_desde: fechaDesde || null,
          p_fecha_hasta: fechaHasta || null
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as CitaAsesorTecnico[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async crearCitaAsesor(
    idAsesor: number,
    titulo: string,
    fechaCita: string,
    idCliente?: number,
    idFichaNoOP?: number,
    descripcion?: string,
    duracionMinutos?: number,
    direccion?: string,
    ubicacionLink?: string,
    estado?: string,
    notas?: string,
    telefonoContacto?: string | null
  ): Promise<ApiResponse<CitaAsesorTecnico>> {
    if (supabase) {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData.user?.id
        const createdBy =
          uid && /^\d+$/.test(uid) ? parseInt(uid, 10) : null

        const { data, error } = await supabase.rpc('crear_cita_asesor', {
          p_id_asesor: idAsesor,
          p_titulo: titulo,
          p_fecha_cita: fechaCita,
          p_id_cliente: idCliente || null,
          p_id_ficha_no_op: idFichaNoOP || null,
          p_descripcion: descripcion || null,
          p_duracion_minutos: duracionMinutos || 60,
          p_direccion: direccion || null,
          p_ubicacion_link: ubicacionLink || null,
          p_estado: estado || 'programada',
          p_notas: notas || null,
          p_telefono_contacto: telefonoContacto != null ? telefonoContacto : null,
          p_created_by: createdBy
        })

        if (error) return { success: false, error: error.message }

        const raw = data as unknown
        const createdRow = Array.isArray(raw) ? raw[0] : raw
        const newId =
          createdRow &&
          typeof createdRow === 'object' &&
          createdRow !== null &&
          'id' in createdRow
            ? Number((createdRow as { id: unknown }).id)
            : NaN

        const citaResponse = await this.getCitasAsesor(idAsesor)
        if (citaResponse.success && citaResponse.data && Number.isFinite(newId)) {
          const nuevaCita = citaResponse.data.find(
            (c) => Number(c.id) === newId
          )
          if (nuevaCita) {
            return { success: true, data: nuevaCita }
          }
        }

        return { success: false, error: 'Error al obtener la cita creada' }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarCitaAsesor(
    id: number,
    titulo?: string,
    descripcion?: string,
    fechaCita?: string,
    duracionMinutos?: number,
    direccion?: string,
    ubicacionLink?: string,
    estado?: string,
    notas?: string,
    telefonoContacto?: string | null
  ): Promise<ApiResponse<boolean>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_cita_asesor', {
          p_id: id,
          p_titulo: titulo || null,
          p_descripcion: descripcion || null,
          p_fecha_cita: fechaCita || null,
          p_duracion_minutos: duracionMinutos || null,
          p_direccion: direccion || null,
          p_ubicacion_link: ubicacionLink || null,
          p_estado: estado || null,
          p_notas: notas || null,
          p_telefono_contacto:
            telefonoContacto === undefined ? null : telefonoContacto
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as boolean }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  async eliminarCitaAsesor(id: number): Promise<ApiResponse<boolean>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('eliminar_cita_asesor', {
          p_id: id
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as boolean }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== RRHH POSTULACIONES / CVs ==========

  async submitPostulacionPublica(payload: {
    nombre: string
    email: string
    telefono?: string
    puesto: string
    categoria_puesto?: string
    mensaje?: string
    cv_url: string
    cv_nombre: string
    cv_mime?: string
    website?: string
  }): Promise<ApiResponse<{ id: number }>> {
    if (!supabase) return { success: false, error: 'Supabase no configurado' }

    const cvUrl = (payload.cv_url || '').trim()
    if (!cvUrl.includes('/archivos/cv-postulaciones')) {
      return { success: false, error: 'URL de CV no válida' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_postulacion_cv_public', {
        p_nombre: payload.nombre,
        p_email: payload.email,
        p_telefono: payload.telefono || null,
        p_puesto: payload.puesto,
        p_categoria_puesto: payload.categoria_puesto || null,
        p_mensaje: payload.mensaje || null,
        p_cv_url: cvUrl,
        p_cv_nombre: payload.cv_nombre || null,
        p_cv_mime: payload.cv_mime || null,
        p_honeypot: payload.website || null
      })
      if (error) throw error

      const postulacionId = Number(data) || 0
      if (postulacionId > 0) {
        void (async () => {
          try {
            const cvResp = await fetch(cvUrl)
            if (!cvResp.ok) return
            const blob = await cvResp.blob()
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onerror = () => reject(new Error('read'))
              reader.onload = () => resolve(String(reader.result))
              reader.readAsDataURL(blob)
            })
            const { extractCvMetadataPlotAI } = await import('./rrhhPostulacionesPlotAI')
            const meta = await extractCvMetadataPlotAI(dataUrl, payload.puesto)
            await supabase.rpc('rrhh_postulacion_set_metadata_ia', {
              p_id: postulacionId,
              p_metadata: meta,
              p_score: meta.score_plot == null ? null : Number(meta.score_plot)
            })
          } catch {
            /* IA opcional */
          }
        })()
      }

      return { success: true, data: { id: postulacionId } }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar la postulación'
      return { success: false, error: msg }
    }
  }

  async rrhhPostulacionesContar(filters: {
    usuarioId: number
    busqueda?: string
    estado?: string
    puesto?: string
  }): Promise<ApiResponse<number>> {
    if (!supabase) return { success: false, error: 'Supabase no inicializado' }
    try {
      const { data, error } = await supabase.rpc('rrhh_postulaciones_contar', {
        p_usuario_id: filters.usuarioId,
        p_busqueda: filters.busqueda || null,
        p_estado: filters.estado || null,
        p_puesto: filters.puesto || null
      })
      if (error) throw error
      return { success: true, data: Number(data) || 0 }
    } catch (e) {
      return { success: false, error: supabaseErrorMessage(e, 'Error al contar postulaciones') }
    }
  }

  async rrhhPostulacionesListar(filters: {
    usuarioId: number
    busqueda?: string
    estado?: string
    puesto?: string
  }): Promise<ApiResponse<RrhhPostulacion[]>> {
    if (!supabase) return { success: false, error: 'Supabase no inicializado' }
    try {
      const { data, error } = await supabase.rpc('rrhh_postulaciones_listar', {
        p_usuario_id: filters.usuarioId,
        p_busqueda: filters.busqueda || null,
        p_estado: filters.estado || null,
        p_puesto: filters.puesto || null,
        p_limite: 300
      })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      return {
        success: true,
        data: rows.map((r) => this.mapRrhhPostulacionRow(r as Record<string, unknown>))
      }
    } catch (e) {
      return { success: false, error: supabaseErrorMessage(e, 'Error al listar postulaciones') }
    }
  }

  mapRrhhPostulacionRow(row: Record<string, unknown>): RrhhPostulacion {
    return {
      id: Number(row.id),
      legacy_id: row.legacy_id == null ? null : Number(row.legacy_id),
      nombre: String(row.nombre || ''),
      email: String(row.email || ''),
      telefono: row.telefono == null ? null : String(row.telefono),
      puesto: String(row.puesto || ''),
      categoria_puesto: row.categoria_puesto == null ? null : String(row.categoria_puesto),
      mensaje: row.mensaje == null ? null : String(row.mensaje),
      cv_url: String(row.cv_url || ''),
      cv_nombre: row.cv_nombre == null ? null : String(row.cv_nombre),
      cv_mime: row.cv_mime == null ? null : String(row.cv_mime),
      estado: String(row.estado || 'nuevo') as RrhhPostulacionEstado,
      metadata_ia: (row.metadata_ia as Record<string, unknown>) || {},
      score_ia: row.score_ia == null ? null : Number(row.score_ia),
      notas_rrhh: row.notas_rrhh == null ? null : String(row.notas_rrhh),
      created_at: String(row.created_at || ''),
      updated_at: String(row.updated_at || ''),
      revisado_por: row.revisado_por == null ? null : Number(row.revisado_por),
      revisado_at: row.revisado_at == null ? null : String(row.revisado_at)
    }
  }

  async rrhhPostulacionActualizarEstado(
    usuarioId: number,
    id: number,
    estado: RrhhPostulacionEstado,
    notas?: string
  ): Promise<ApiResponse<RrhhPostulacion>> {
    if (!supabase) return { success: false, error: 'Supabase no inicializado' }
    try {
      const { data, error } = await supabase.rpc('rrhh_postulacion_actualizar_estado', {
        p_usuario_id: usuarioId,
        p_id: id,
        p_estado: estado,
        p_notas_rrhh: notas || null
      })
      if (error) throw error
      return {
        success: true,
        data: this.mapRrhhPostulacionRow((data || {}) as Record<string, unknown>)
      }
    } catch (e) {
      return { success: false, error: supabaseErrorMessage(e, 'Error al actualizar estado') }
    }
  }

  async rrhhPostulacionesFiltrarPlotAI(
    query: string,
    candidatos?: Array<{
      id: number
      nombre: string
      puesto: string
      resumen?: string | null
      habilidades?: string[]
      score_plot?: number | null
    }>
  ): Promise<
    ApiResponse<{ resultados: Array<{ id: number; match_score: number; motivo: string }> }>
  > {
    if (!candidatos?.length) {
      return { success: false, error: 'No hay candidatos para filtrar. Buscá primero.' }
    }
    try {
      const { filterPostulacionesPlotAI } = await import('./rrhhPostulacionesPlotAI')
      const resultados = await filterPostulacionesPlotAI(query, candidatos)
      return { success: true, data: { resultados } }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error en filtro PlotAI'
      }
    }
  }

  async rrhhPostulacionReanalizarCv(
    postulacionId: number,
    cvUrl: string,
    puesto: string
  ): Promise<ApiResponse<Record<string, unknown>>> {
    if (!supabase) return { success: false, error: 'Supabase no inicializado' }

    try {
      const cvResp = await fetch(cvUrl)
      if (!cvResp.ok) throw new Error('No se pudo descargar el CV')
      const blob = await cvResp.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(blob)
      })

      const { extractCvMetadataPlotAI } = await import('./rrhhPostulacionesPlotAI')
      const data = await extractCvMetadataPlotAI(dataUrl, puesto)
      const score = data.score_plot
      const { error } = await supabase.rpc('rrhh_postulacion_set_metadata_ia', {
        p_id: postulacionId,
        p_metadata: data,
        p_score: score == null ? null : Number(score)
      })
      if (error) throw error

      return { success: true, data: data as Record<string, unknown> }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Error al analizar CV'
      }
    }
  }
}

function inferChatType(message: string): ChatMessageUI['tipo'] {
  if (!message) return 'message'
  if (message.toLowerCase().includes('zumbido')) return 'buzz'
  if (message.toLowerCase().includes('alerta') || message.includes('¡Atención!')) return 'alert'
  return 'message'
}

type VentaCajaSyncPayload = import('../features/control-cajas/plotlabVentaCajaSync').VentaCajaSyncRecord

async function syncCajaDesdeVentaApi(
  venta: VentaCajaSyncPayload,
  opts?: { silencioso?: boolean }
): Promise<void> {
  try {
    const { syncDesdeVentaRecord } = await import('../features/control-cajas/plotlabVentaCajaSync')
    await syncDesdeVentaRecord(venta, { silencioso: opts?.silencioso ?? false })
  } catch (e) {
    console.warn('Sync venta → caja:', e)
  }
}

export const apiService = new ApiService()
export default apiService

