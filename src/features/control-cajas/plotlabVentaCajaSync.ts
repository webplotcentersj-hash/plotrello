import { getArgentinaDateString } from '../../utils/dateUtils'
import { notifyCajaSync } from './cajaSyncNotify'
import { obtenerCajaOperativa } from './cajaOperativa'
import { cajaSlugForUsuario } from './cajaPorUsuario'
import {
  type ResumenPlotlabVentasCaja
} from './plotlabVentasCajaData'
import {
  listMovimientos,
  saveMovimiento
} from './cajaRepository'
import { mediosToPlanillaLinea, movimientoDesdeMedios, type MediosPagoInput } from './movimientoCaja'
import type { CajaMovimiento } from './types'
import { montoCobradoVenta } from './ventaMontoCobrado'

export type MetodoPagoPlotLab =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta'
  | 'Cheque'
  | 'Depósito'
  | 'Cuenta Corriente'
  | 'Otro'
  | string

export type PlotLabVentaCajaSyncInput = {
  tipo: 'venta' | 'cobro'
  ventaId?: number
  cobroId?: number
  numeroVenta?: string | null
  numeroComprobante?: string | null
  clienteNombre: string
  monto: number
  metodoPago: MetodoPagoPlotLab
  estadoPago?: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado'
  fecha: string
  usuarioId?: number
  usuarioNombre?: string
  cajaSlug?: string
  esAdmin?: boolean
}

export type PlotLabVentaCajaSyncResult =
  | { ok: true; movimiento: CajaMovimiento; cajaSlug: string; yaExistia: false }
  | { ok: true; yaExistia: true; cajaSlug: string }
  | { ok: false; error: string; omitido?: boolean }

export type VentaCajaSyncRecord = {
  id: number
  numero_venta?: string | null
  cliente_nombre: string
  valor_total: number
  metodo_pago?: string | null
  estado_pago?: string | null
  fecha_venta?: string | null
  id_vendedor?: number | null
  nombre_vendedor?: string | null
  id_pedido_cliente?: number | null
  monto_pagado?: number | null
  caja_slug_cobro?: string | null
}

/** Ventas portal/tótem quedan Pendiente hasta cobro en mostrador; CC pendiente sí impacta caja. */
const RESUMEN_PLOTLAB_VACIO: ResumenPlotlabVentasCaja = {
  count: 0,
  efectivo: 0,
  tarjetas: 0,
  transferencia: 0,
  ctaCte: 0,
  otros: 0,
  total: 0
}

export function ventaPerteneceCaja(
  venta: VentaCajaSyncRecord,
  cajaSlug: string,
  usuarioId?: number
): boolean {
  // Caja = usuario: priorizar vendedor titular
  if (usuarioId != null && venta.id_vendedor === usuarioId) return true
  const slug = venta.caja_slug_cobro?.trim()
  if (slug) return slug === cajaSlug
  return false
}

function montoVentaParaResumen(venta: VentaCajaSyncRecord): number {
  const pagado = Number(venta.monto_pagado) || 0
  if (pagado > 0) return pagado
  return Number(venta.valor_total) || 0
}

export function resumenDesdeVentasPlotLab(
  ventas: VentaCajaSyncRecord[],
  fecha: string,
  cajaSlug: string,
  usuarioId?: number
): ResumenPlotlabVentasCaja {
  const out: ResumenPlotlabVentasCaja = { ...RESUMEN_PLOTLAB_VACIO }

  for (const venta of ventas) {
    const record: VentaCajaSyncRecord = {
      ...venta,
      fecha_venta: (venta.fecha_venta || fecha).slice(0, 10)
    }
    if (record.fecha_venta !== fecha) continue
    if (!ventaDebeSincronizarCaja(record)) continue
    if (!ventaPerteneceCaja(record, cajaSlug, usuarioId)) continue

    const monto = montoVentaParaResumen(record)
    const medios = metodoPagoPlotLabAMedios(
      normalizarMetodoPago(record.metodo_pago),
      monto,
      (record.estado_pago as PlotLabVentaCajaSyncInput['estadoPago']) || 'Pagado'
    )
    if (!medios) continue

    out.count++
    out.efectivo += medios.efectivo || 0
    out.tarjetas += medios.tarjeta || 0
    out.transferencia += medios.transferencia_bancaria || 0
    out.ctaCte += medios.cuenta_corriente || 0
    out.otros += medios.otros || 0
    out.total += medios.total || monto
  }

  return out
}

export function combinarResumenPlotlab(
  primario: ResumenPlotlabVentasCaja,
  secundario: ResumenPlotlabVentasCaja
): ResumenPlotlabVentasCaja {
  return primario.total >= secundario.total ? primario : secundario
}

/** Ventas cobradas hoy en Plot Lab (sin depender de movimientos ya importados). */
export async function resumenPlotlabVentasDesdeApi(
  fecha: string,
  cajaSlug: string,
  usuarioId?: number
): Promise<ResumenPlotlabVentasCaja> {
  const { default: apiService } = await import('../../services/api')
  const res = await apiService.obtenerVentas(usuarioId, fecha, fecha)
  if (!res.success || !res.data?.length) return { ...RESUMEN_PLOTLAB_VACIO }

  return resumenDesdeVentasPlotLab(
    res.data.map((v) => ({
      id: v.id,
      numero_venta: v.numero_venta,
      cliente_nombre: v.cliente_nombre,
      valor_total: v.valor_total,
      metodo_pago: v.metodo_pago,
      estado_pago: v.estado_pago,
      fecha_venta: v.fecha_venta,
      id_vendedor: v.id_vendedor,
      nombre_vendedor: v.nombre_vendedor,
      id_pedido_cliente: v.id_pedido_cliente,
      monto_pagado: v.monto_pagado,
      caja_slug_cobro: v.caja_slug_cobro
    })),
    fecha,
    cajaSlug,
    usuarioId
  )
}

export function ventaDebeSincronizarCaja(venta: VentaCajaSyncRecord): boolean {
  const estado = venta.estado_pago || 'Pendiente'
  const metodo = (venta.metodo_pago || '').trim()
  if (estado === 'Cancelado') return false
  if ((Number(venta.valor_total) || 0) <= 0) return false
  if (estado === 'Pendiente' && metodo !== 'Cuenta Corriente') return false
  return true
}

function normalizarMetodoPago(metodo?: string | null): MetodoPagoPlotLab {
  const m = (metodo || 'Otro').trim()
  if (/mercado\s*pago/i.test(m) || m.toLowerCase() === 'mp') return 'Mercado Pago'
  return m as MetodoPagoPlotLab
}

function refPlotLab(input: PlotLabVentaCajaSyncInput): string {
  if (input.tipo === 'cobro' && input.cobroId != null) return `PL-COBRO-${input.cobroId}`
  if (input.ventaId != null) return `PL-VENTA-${input.ventaId}`
  const n = (input.numeroVenta || input.numeroComprobante || '').trim()
  return n ? `PL-${n}` : `PL-${Date.now()}`
}

function nroComprobanteMov(input: PlotLabVentaCajaSyncInput): string {
  const ext = (input.numeroComprobante || input.numeroVenta || '').trim()
  if (ext) return ext
  return refPlotLab(input)
}

export function metodoPagoPlotLabAMedios(
  metodo: MetodoPagoPlotLab,
  monto: number,
  estadoPago?: PlotLabVentaCajaSyncInput['estadoPago']
): MediosPagoInput | null {
  if (estadoPago === 'Cancelado' || monto <= 0) return null

  const m = (metodo || 'Otro').trim()
  const base: MediosPagoInput = {
    total: monto,
    efectivo: 0,
    tarjeta: 0,
    transferencia_bancaria: 0,
    cheque_tercero: 0,
    cuenta_corriente: 0,
    otros: 0
  }

  if (m === 'Cuenta Corriente') {
    return { ...base, cuenta_corriente: monto }
  }
  if (m === 'Efectivo') return { ...base, efectivo: monto }
  if (m === 'Mercado Pago' || /mercado\s*pago/i.test(m) || m.toLowerCase() === 'mp') {
    return { ...base, tarjeta: monto }
  }
  if (m === 'Tarjeta') {
    return { ...base, tarjeta: monto }
  }
  if (m === 'Transferencia' || m === 'Depósito') {
    return { ...base, transferencia_bancaria: monto }
  }
  if (m === 'Cheque') return { ...base, cheque_tercero: monto }
  return { ...base, otros: monto }
}

/**
 * Caja = usuario. Destino siempre `u-{id}` del titular.
 * Ignora overrides (evita cobros de Federico en caja de Barros).
 */
async function resolverCajaSlugVenta(
  usuarioNombre: string,
  usuarioId?: number,
  _override?: string,
  _esAdmin?: boolean
): Promise<string | null> {
  if (usuarioId == null || !(usuarioId > 0)) return null
  const esperado = cajaSlugForUsuario(usuarioId)
  try {
    const op = await obtenerCajaOperativa(usuarioId, usuarioNombre)
    return op.slug || esperado
  } catch (e) {
    console.warn('No se pudo asegurar caja operativa; uso slug determinístico', e)
    return esperado
  }
}

function refVentaPlotLab(ventaId: number): string {
  return `PL-VENTA-${ventaId}`
}

async function buscarMovimientoPlotLabPorRef(ref: string): Promise<CajaMovimiento | null> {
  const movs = await listMovimientos()
  return (
    movs.find(
      (m) =>
        !m.anulado &&
        m.origen_importacion === 'plotlab_venta' &&
        (m.observacion?.includes(ref) || m.nro_comprobante === ref)
    ) ?? null
  )
}

function notificarCajaActualizada(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caja-datos-actualizados'))
  }
}

function mensajeSyncOk(cajaSlug: string, monto: number, metodo: string): string {
  return `Registrado en caja ${cajaSlug} · ${metodo} $ ${monto.toLocaleString('es-AR')}`
}

export async function syncDesdeVentaRecord(
  venta: VentaCajaSyncRecord,
  opts?: {
    cajaSlug?: string
    silencioso?: boolean
    /** Quién cobró / opera la caja (logueado). Si no hay, se usa el vendedor. */
    actorId?: number
    actorNombre?: string
    esAdmin?: boolean
  }
): Promise<PlotLabVentaCajaSyncResult> {
  const ref = refVentaPlotLab(venta.id)
  const existente = await buscarMovimientoPlotLabPorRef(ref)
  // Titular de la venta = dueño de la caja (no el admin que marca el pago).
  const titularId = venta.id_vendedor ?? opts?.actorId ?? undefined
  const actorNombre =
    opts?.actorNombre ||
    venta.nombre_vendedor ||
    (venta.id_pedido_cliente ? 'Portal/Tótem' : 'PlotLab')

  if (!ventaDebeSincronizarCaja(venta)) {
    if (existente) {
      try {
        const anulado = await saveMovimiento({ ...existente, anulado: true })
        notificarCajaActualizada()
        return {
          ok: true,
          movimiento: anulado,
          cajaSlug: existente.destino_slug,
          yaExistia: false
        }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'No se pudo anular movimiento de caja'
        }
      }
    }
    return { ok: false, error: 'Venta pendiente de cobro o sin monto', omitido: true }
  }

  const monto = await montoCobradoVenta(venta)
  if (venta.estado_pago === 'Parcial' && monto <= 0) {
    return {
      ok: false,
      error: 'Indicá el monto cobrado para ventas parciales',
      omitido: true
    }
  }

  const metodo = normalizarMetodoPago(venta.metodo_pago)
  const r = await syncVentaPlotLabACaja({
    tipo: 'venta',
    ventaId: venta.id,
    numeroVenta: venta.numero_venta,
    clienteNombre: venta.cliente_nombre,
    monto: monto > 0 ? monto : venta.valor_total,
    metodoPago: metodo,
    estadoPago: (venta.estado_pago as PlotLabVentaCajaSyncInput['estadoPago']) || 'Pagado',
    fecha: (venta.fecha_venta || getArgentinaDateString()).slice(0, 10),
    usuarioId: titularId,
    usuarioNombre: venta.nombre_vendedor || actorNombre
  })

  if (!opts?.silencioso) {
    if (r.ok) {
      const m = monto > 0 ? monto : venta.valor_total
      notifyCajaSync({
        ok: true,
        message: mensajeSyncOk(r.cajaSlug, m, String(metodo))
      })
    } else if (!r.omitido) {
      notifyCajaSync({ ok: false, message: r.error })
    }
  }

  return r
}

export function dispararSyncCajaVenta(
  venta: VentaCajaSyncRecord,
  opts?: {
    cajaSlug?: string
    silencioso?: boolean
    actorId?: number
    actorNombre?: string
    esAdmin?: boolean
  }
): void {
  void syncDesdeVentaRecord(venta, { silencioso: true, ...opts }).then((r) => {
    if (!r.ok && !r.omitido) console.warn('PlotLab → caja:', r.error)
  })
}

/** Fuerza re-sincronización (admin / corrección manual). */
export async function forceResyncVenta(
  venta: VentaCajaSyncRecord,
  opts?: { cajaSlug?: string; actorId?: number; actorNombre?: string; esAdmin?: boolean }
): Promise<PlotLabVentaCajaSyncResult> {
  return syncDesdeVentaRecord(venta, { ...opts, silencioso: false })
}

/** Registra ingreso de caja desde venta o cobro PlotLab (misma lógica que línea FA de planilla PDF). */
export async function syncVentaPlotLabACaja(
  input: PlotLabVentaCajaSyncInput
): Promise<PlotLabVentaCajaSyncResult> {
  try {
    const monto = Number(input.monto) || 0
    if (monto <= 0) return { ok: false, error: 'Monto inválido' }

    const medios = metodoPagoPlotLabAMedios(input.metodoPago, monto, input.estadoPago)
    if (!medios) return { ok: false, error: 'Venta cancelada o sin medios de pago' }

    const ref = refPlotLab(input)
    const existente = await buscarMovimientoPlotLabPorRef(ref)

    const usuarioNombre = input.usuarioNombre?.trim() || 'PlotLab'
    // Destino = titular. Nunca reutilizar destino viejo ni override ajeno.
    let cajaSlug = await resolverCajaSlugVenta(usuarioNombre, input.usuarioId)
    if (input.usuarioId != null && input.usuarioId > 0) {
      cajaSlug = cajaSlugForUsuario(input.usuarioId)
    }
    if (!cajaSlug) {
      return {
        ok: false,
        error: 'No se pudo determinar la caja del usuario (falta id de vendedor/cobrador).'
      }
    }

    const fecha = (input.fecha || getArgentinaDateString()).slice(0, 10)
    const linea = mediosToPlanillaLinea(medios)
    const concepto =
      input.tipo === 'cobro'
        ? `Cobro ${input.clienteNombre}`.slice(0, 120)
        : `Venta ${input.clienteNombre}`.slice(0, 120)

    const movBase = movimientoDesdeMedios(
      {
        fecha: existente?.fecha || fecha,
        hora: existente?.hora || new Date().toTimeString().slice(0, 5),
        caja_slug: cajaSlug,
        tipo_movimiento: 'ingreso',
        categoria: input.tipo === 'cobro' ? 'Cobro' : 'Venta',
        comprobante: nroComprobanteMov(input),
        concepto,
        tercero_nombre: input.clienteNombre,
        medios,
        observacion: `PlotLab ${input.tipo} (${ref}) — ${input.metodoPago}`,
        id_usuario: input.usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        origen_importacion: 'plotlab_venta'
      },
      { origen_slug: 'admin', destino_slug: cajaSlug }
    )

    const esMp =
      /mercado\s*pago/i.test(String(input.metodoPago)) ||
      String(input.metodoPago).trim().toLowerCase() === 'mp'
    const mediosGuardar = esMp
      ? { ...(linea as unknown as Record<string, number>), mercado_pago: monto }
      : (linea as unknown as Record<string, number>)

    const mov = await saveMovimiento({
      ...movBase,
      id: existente?.id,
      medios: mediosGuardar,
      cierre_id: existente?.cierre_id ?? null
    })

    notificarCajaActualizada()

    return { ok: true, movimiento: mov, cajaSlug, yaExistia: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al sincronizar venta con caja'
    notifyCajaSync({ ok: false, message: msg })
    return { ok: false, error: msg }
  }
}

export function initPlotlabVentaCajaBridge(): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { __plotlab_caja_bridge__?: boolean }
  if (w.__plotlab_caja_bridge__) return
  w.__plotlab_caja_bridge__ = true

  window.addEventListener('plotlab-sync-caja', (ev) => {
    const detail = (ev as CustomEvent<PlotLabVentaCajaSyncInput>).detail
    if (!detail?.monto) return
    void syncVentaPlotLabACaja(detail).catch((err) => {
      console.warn('PlotLab → caja sync:', err)
    })
  })
}

export type SyncVentasPlotLabResumen = {
  sincronizadas: number
  omitidas: number
  errores: number
}

/** Trae ventas del CRM y las vuelca como movimientos de caja (idempotente). */
export async function sincronizarVentasPlotLabRango(
  fechaDesde: string,
  fechaHasta: string
): Promise<SyncVentasPlotLabResumen> {
  const { default: apiService } = await import('../../services/api')
  const res = await apiService.obtenerVentas(undefined, fechaDesde, fechaHasta)
  const out: SyncVentasPlotLabResumen = { sincronizadas: 0, omitidas: 0, errores: 0 }
  if (!res.success || !res.data?.length) return out

  for (const v of res.data) {
    const r = await syncDesdeVentaRecord(
      {
        id: v.id,
        numero_venta: v.numero_venta,
        cliente_nombre: v.cliente_nombre,
        valor_total: v.valor_total,
        metodo_pago: v.metodo_pago,
        estado_pago: v.estado_pago,
        fecha_venta: v.fecha_venta,
        id_vendedor: v.id_vendedor,
        nombre_vendedor: v.nombre_vendedor,
        id_pedido_cliente: v.id_pedido_cliente,
        monto_pagado: v.monto_pagado,
        caja_slug_cobro: v.caja_slug_cobro
      },
      { silencioso: true }
    )
    if (r.ok) out.sincronizadas++
    else if (r.omitido) out.omitidas++
    else out.errores++
  }

  if (out.sincronizadas > 0) notificarCajaActualizada()
  return out
}
