/**
 * ERP contable avanzado: retenciones/percepciones, liquidación de IVA, cierre de períodos,
 * cheques, cobradores, asientos modelo, índices de inflación y cuentas corrientes consolidadas.
 *
 * Requiere ejecutar supabase/patches/2026-10-26_erp_contable_avanzado.sql.
 */
import { supabase } from './supabaseClient'
import { rangoPeriodo } from '../utils/liquidacionIva'

export type ErpResp<T> = { success: true; data: T } | { success: false; error: string }

const PAGINA = 1000

function cliente() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

function mensajeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/schema cache|does not exist|PGRST205|42P01/i.test(raw) && /erp_|facturas_compra|percepcion|no_gravado/i.test(raw)) {
    return 'Falta ejecutar supabase/patches/2026-10-26_erp_contable_avanzado.sql en Supabase.'
  }
  return raw
}

async function envolver<T>(fn: () => Promise<T>): Promise<ErpResp<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    return { success: false, error: mensajeError(e) }
  }
}

function lanzar(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function usuarioId(): number | null {
  const n = Number(localStorage.getItem('usuario_id'))
  return Number.isFinite(n) && n > 0 ? n : null
}

async function traerTodo<T>(
  construir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const todo: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await construir(desde, desde + PAGINA - 1)
    lanzar(error)
    const lote = data ?? []
    todo.push(...lote)
    if (lote.length < PAGINA) break
  }
  return todo
}

/** Razón social y CUIT de la empresa (configuración AFIP), para certificados. */
export function getEmpresaFiscal() {
  return envolver(async () => {
    const { data, error } = await cliente().from('configuracion_afip').select('cuit,razon_social').limit(1).maybeSingle()
    lanzar(error)
    return (data ?? { cuit: '', razon_social: '' }) as { cuit: string; razon_social: string }
  })
}

// =============================================================================
// Retenciones y percepciones
// =============================================================================
export type ImpuestoRetencion = 'Ganancias' | 'IVA' | 'IIBB' | 'SUSS' | 'SIRCREB' | 'SIRTAC' | 'Municipal' | 'Otro'

export type Retencion = {
  id: number
  naturaleza: 'Retención' | 'Percepción'
  sentido: 'Efectuada' | 'Sufrida'
  impuesto: ImpuestoRetencion
  regimen: string | null
  jurisdiccion: string | null
  fecha: string
  tercero_tipo: 'Proveedor' | 'Cliente' | 'Otro'
  id_proveedor: number | null
  id_cliente: number | null
  tercero_nombre: string
  tercero_cuit: string | null
  base_imponible: number
  alicuota: number
  importe: number
  numero_certificado: string | null
  id_factura_compra: number | null
  id_factura_venta: number | null
  id_asiento_contable: number | null
  estado: 'Vigente' | 'Anulada'
  observaciones: string | null
  created_at: string
}

export type NuevaRetencion = Omit<Retencion, 'id' | 'estado' | 'created_at'>

export function listRetenciones(f: {
  desde?: string
  hasta?: string
  sentido?: 'Efectuada' | 'Sufrida'
  impuesto?: ImpuestoRetencion
  incluirAnuladas?: boolean
}) {
  return envolver(async () => {
    const filas = await traerTodo<Retencion>((a, b) => {
      let q = cliente().from('erp_retenciones').select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
      if (f.desde) q = q.gte('fecha', f.desde)
      if (f.hasta) q = q.lte('fecha', f.hasta)
      if (f.sentido) q = q.eq('sentido', f.sentido)
      if (f.impuesto) q = q.eq('impuesto', f.impuesto)
      if (!f.incluirAnuladas) q = q.eq('estado', 'Vigente')
      return q.range(a, b)
    })
    return filas.map((r) => ({ ...r, base_imponible: Number(r.base_imponible), alicuota: Number(r.alicuota), importe: Number(r.importe) }))
  })
}

export function crearRetencion(r: NuevaRetencion) {
  return envolver(async () => {
    const { data, error } = await cliente()
      .from('erp_retenciones')
      .insert({ ...r, id_usuario: usuarioId() })
      .select('*')
      .single()
    lanzar(error)
    return data as Retencion
  })
}

export function anularRetencion(id: number) {
  return envolver(async () => {
    const { error } = await cliente().from('erp_retenciones').update({ estado: 'Anulada' }).eq('id', id)
    lanzar(error)
    return true
  })
}

// =============================================================================
// Liquidación de IVA
// =============================================================================
export type EstadoLiquidacion = 'Abierta' | 'Cerrada' | 'Presentada'

export type LiquidacionIvaRow = {
  id: number
  periodo: string
  estado: EstadoLiquidacion
  debito_fiscal: number
  credito_fiscal: number
  saldo_tecnico_anterior: number
  saldo_libre_disp_anterior: number
  retenciones_sufridas: number
  percepciones_sufridas: number
  saldo_tecnico_resultante: number
  saldo_libre_disp_resultante: number
  saldo_a_pagar: number
  observaciones: string | null
  fecha_cierre: string | null
  fecha_presentacion: string | null
}

function numerizarLiquidacion(r: Record<string, unknown>): LiquidacionIvaRow {
  const n = (k: string) => Number(r[k]) || 0
  return {
    ...(r as unknown as LiquidacionIvaRow),
    debito_fiscal: n('debito_fiscal'),
    credito_fiscal: n('credito_fiscal'),
    saldo_tecnico_anterior: n('saldo_tecnico_anterior'),
    saldo_libre_disp_anterior: n('saldo_libre_disp_anterior'),
    retenciones_sufridas: n('retenciones_sufridas'),
    percepciones_sufridas: n('percepciones_sufridas'),
    saldo_tecnico_resultante: n('saldo_tecnico_resultante'),
    saldo_libre_disp_resultante: n('saldo_libre_disp_resultante'),
    saldo_a_pagar: n('saldo_a_pagar')
  }
}

export function listLiquidacionesIva() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_liquidaciones_iva').select('*').order('periodo', { ascending: false })
    lanzar(error)
    return ((data ?? []) as Record<string, unknown>[]).map(numerizarLiquidacion)
  })
}

export type ComprobantesPeriodo = {
  ventas: any[]
  compras: any[]
  retencionesIvaSufridas: number
  percepcionesIvaSufridas: number
}

/** Facturas emitidas, facturas de compra y retenciones/percepciones de IVA sufridas del mes. */
export function cargarComprobantesPeriodo(periodo: string) {
  return envolver<ComprobantesPeriodo>(async () => {
    const { desde, hasta } = rangoPeriodo(periodo)
    const [ventas, compras, ret] = await Promise.all([
      traerTodo<any>((a, b) =>
        cliente()
          .from('facturas_venta')
          .select('*, items:facturas_items(*)')
          .eq('estado', 'Emitida')
          .gte('fecha_emision', desde)
          .lte('fecha_emision', hasta)
          .order('fecha_emision', { ascending: true })
          .order('id', { ascending: true })
          .range(a, b)
      ),
      traerTodo<any>((a, b) =>
        cliente()
          .from('facturas_compra')
          .select('*, items:facturas_compra_items(*)')
          .gte('fecha_emision', desde)
          .lte('fecha_emision', hasta)
          .order('fecha_emision', { ascending: true })
          .order('id', { ascending: true })
          .range(a, b)
      ),
      traerTodo<Retencion>((a, b) =>
        cliente()
          .from('erp_retenciones')
          .select('*')
          .eq('impuesto', 'IVA')
          .eq('sentido', 'Sufrida')
          .eq('estado', 'Vigente')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .range(a, b)
      ).catch(() => [] as Retencion[]) // sin el patch igual se puede calcular la liquidación
    ])
    const suma = (naturaleza: Retencion['naturaleza']) =>
      ret.filter((r) => r.naturaleza === naturaleza).reduce((s, r) => s + (Number(r.importe) || 0), 0)
    return {
      ventas,
      compras,
      retencionesIvaSufridas: Math.round(suma('Retención') * 100) / 100,
      percepcionesIvaSufridas: Math.round(suma('Percepción') * 100) / 100
    }
  })
}

export type GuardarLiquidacion = {
  periodo: string
  debito_fiscal: number
  credito_fiscal: number
  saldo_tecnico_anterior: number
  saldo_libre_disp_anterior: number
  retenciones_sufridas: number
  percepciones_sufridas: number
  saldo_tecnico_resultante: number
  saldo_libre_disp_resultante: number
  saldo_a_pagar: number
  observaciones?: string | null
  detalle?: unknown
}

export function guardarLiquidacionIva(l: GuardarLiquidacion) {
  return envolver(async () => {
    const { data: existente, error: e1 } = await cliente()
      .from('erp_liquidaciones_iva')
      .select('estado')
      .eq('periodo', l.periodo)
      .maybeSingle()
    lanzar(e1)
    if (existente && existente.estado !== 'Abierta') {
      throw new Error(`La liquidación ${l.periodo} está ${String(existente.estado).toLowerCase()}: reabrila para recalcular.`)
    }
    const { data, error } = await cliente()
      .from('erp_liquidaciones_iva')
      .upsert({ ...l, estado: 'Abierta' }, { onConflict: 'periodo' })
      .select('*')
      .single()
    lanzar(error)
    return numerizarLiquidacion(data as Record<string, unknown>)
  })
}

export function cambiarEstadoLiquidacionIva(periodo: string, estado: EstadoLiquidacion, fechaPresentacion?: string) {
  return envolver(async () => {
    const cambios: Record<string, unknown> = { estado }
    if (estado === 'Abierta') {
      cambios.fecha_cierre = null
      cambios.fecha_presentacion = null
      cambios.id_usuario_cierre = null
    } else {
      cambios.fecha_cierre = new Date().toISOString()
      cambios.id_usuario_cierre = usuarioId()
      if (estado === 'Presentada') cambios.fecha_presentacion = fechaPresentacion || new Date().toISOString().slice(0, 10)
    }
    const { error } = await cliente().from('erp_liquidaciones_iva').update(cambios).eq('periodo', periodo)
    lanzar(error)
    return true
  })
}

// =============================================================================
// Períodos contables
// =============================================================================
export type PeriodoContable = {
  periodo: string
  estado: 'Abierto' | 'Cerrado'
  fecha_cierre: string | null
  observaciones: string | null
}

export function listPeriodosContables() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_periodos_contables').select('*').order('periodo', { ascending: false })
    lanzar(error)
    return (data ?? []) as PeriodoContable[]
  })
}

export type ResumenPeriodo = { asientos: number; borradores: number; debe: number; haber: number }

export function resumenAsientosPeriodo(periodo: string) {
  return envolver<ResumenPeriodo>(async () => {
    const { desde, hasta } = rangoPeriodo(periodo)
    const filas = await traerTodo<{ estado: string; total_debe: number; total_haber: number }>((a, b) =>
      cliente()
        .from('asientos_contables')
        .select('estado,total_debe,total_haber')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .neq('estado', 'Anulado')
        .range(a, b)
    )
    return {
      asientos: filas.length,
      borradores: filas.filter((f) => f.estado === 'Borrador').length,
      debe: filas.reduce((s, f) => s + (Number(f.total_debe) || 0), 0),
      haber: filas.reduce((s, f) => s + (Number(f.total_haber) || 0), 0)
    }
  })
}

export function cerrarPeriodoContable(periodo: string, observaciones?: string) {
  return envolver(async () => {
    const resumen = await resumenAsientosPeriodo(periodo)
    if (!resumen.success) throw new Error(resumen.error)
    if (resumen.data.borradores > 0) {
      throw new Error(`Hay ${resumen.data.borradores} asiento(s) en borrador en ${periodo}: contabilizalos o anulalos antes de cerrar.`)
    }
    if (Math.abs(resumen.data.debe - resumen.data.haber) > 0.01) {
      throw new Error(`El período ${periodo} no balancea (debe ${resumen.data.debe.toFixed(2)} / haber ${resumen.data.haber.toFixed(2)}).`)
    }
    const { error } = await cliente()
      .from('erp_periodos_contables')
      .upsert(
        {
          periodo,
          estado: 'Cerrado',
          fecha_cierre: new Date().toISOString(),
          id_usuario: usuarioId(),
          observaciones: observaciones?.trim() || null
        },
        { onConflict: 'periodo' }
      )
    lanzar(error)
    return true
  })
}

export function reabrirPeriodoContable(periodo: string, observaciones?: string) {
  return envolver(async () => {
    const { error } = await cliente()
      .from('erp_periodos_contables')
      .upsert(
        { periodo, estado: 'Abierto', fecha_cierre: null, id_usuario: usuarioId(), observaciones: observaciones?.trim() || null },
        { onConflict: 'periodo' }
      )
    lanzar(error)
    return true
  })
}

export type CuentaBancariaBasica = { id: number; nombre: string; banco: string | null; activa: boolean }

export function listCuentasBancarias() {
  return envolver(async () => {
    const { data, error } = await cliente().from('cuentas_bancarias').select('id,nombre,banco,activa').order('nombre')
    lanzar(error)
    return (data ?? []) as CuentaBancariaBasica[]
  })
}

// =============================================================================
// Cheques
// =============================================================================
export type EstadoCheque =
  | 'En cartera'
  | 'Depositado'
  | 'Endosado'
  | 'Cobrado'
  | 'Rechazado'
  | 'Emitido'
  | 'Entregado'
  | 'Debitado'
  | 'Anulado'

export type Cheque = {
  id: number
  tipo: 'Tercero' | 'Propio'
  es_echeq: boolean
  numero: string
  banco: string | null
  sucursal: string | null
  librador_nombre: string | null
  librador_cuit: string | null
  importe: number
  fecha_emision: string
  fecha_pago: string
  estado: EstadoCheque
  id_cliente: number | null
  id_proveedor: number | null
  tercero_nombre: string | null
  id_cuenta_bancaria: number | null
  motivo_rechazo: string | null
  fecha_estado: string | null
  observaciones: string | null
  created_at: string
}

export type NuevoCheque = Pick<
  Cheque,
  'tipo' | 'es_echeq' | 'numero' | 'banco' | 'sucursal' | 'librador_nombre' | 'librador_cuit' | 'importe' | 'fecha_emision' | 'fecha_pago' | 'id_cliente' | 'id_proveedor' | 'tercero_nombre' | 'id_cuenta_bancaria' | 'observaciones'
>

/** Transiciones permitidas por estado actual. */
export const TRANSICIONES_CHEQUE: Record<Cheque['tipo'], Partial<Record<EstadoCheque, EstadoCheque[]>>> = {
  Tercero: {
    'En cartera': ['Depositado', 'Endosado', 'Anulado'],
    Depositado: ['Cobrado', 'Rechazado'],
    Endosado: ['Rechazado'],
    Rechazado: ['En cartera', 'Anulado']
  },
  Propio: {
    Emitido: ['Entregado', 'Anulado'],
    Entregado: ['Debitado', 'Rechazado', 'Anulado'],
    Rechazado: ['Entregado', 'Anulado']
  }
}

export function listCheques(f: { tipo?: Cheque['tipo']; estado?: EstadoCheque } = {}) {
  return envolver(async () => {
    const filas = await traerTodo<Cheque>((a, b) => {
      let q = cliente().from('erp_cheques').select('*').order('fecha_pago', { ascending: true }).order('id', { ascending: true })
      if (f.tipo) q = q.eq('tipo', f.tipo)
      if (f.estado) q = q.eq('estado', f.estado)
      return q.range(a, b)
    })
    return filas.map((c) => ({ ...c, importe: Number(c.importe) }))
  })
}

export function crearCheque(c: NuevoCheque) {
  return envolver(async () => {
    const estado: EstadoCheque = c.tipo === 'Tercero' ? 'En cartera' : 'Emitido'
    const { data, error } = await cliente()
      .from('erp_cheques')
      .insert({ ...c, estado, fecha_estado: new Date().toISOString().slice(0, 10), id_usuario: usuarioId() })
      .select('*')
      .single()
    lanzar(error)
    const cheque = data as Cheque
    await cliente().from('erp_cheques_historial').insert({
      id_cheque: cheque.id,
      estado_anterior: null,
      estado_nuevo: estado,
      detalle: c.tipo === 'Tercero' ? 'Ingreso a cartera' : 'Cheque propio emitido',
      id_usuario: usuarioId()
    })
    return cheque
  })
}

export type CambioEstadoCheque = {
  fecha: string
  detalle?: string
  id_cuenta_bancaria?: number | null
  id_proveedor?: number | null
  tercero_nombre?: string | null
  motivo_rechazo?: string | null
}

export function cambiarEstadoCheque(cheque: Cheque, nuevo: EstadoCheque, c: CambioEstadoCheque) {
  return envolver(async () => {
    const permitidos = TRANSICIONES_CHEQUE[cheque.tipo][cheque.estado] ?? []
    if (!permitidos.includes(nuevo)) {
      throw new Error(`Un cheque ${cheque.estado.toLowerCase()} no puede pasar a ${nuevo.toLowerCase()}.`)
    }
    if (nuevo === 'Depositado' && !c.id_cuenta_bancaria) throw new Error('Elegí la cuenta donde se deposita.')
    if (nuevo === 'Endosado' && !c.tercero_nombre?.trim() && !c.id_proveedor) throw new Error('Indicá a quién se endosa.')
    if (nuevo === 'Rechazado' && !c.motivo_rechazo?.trim()) throw new Error('Indicá el motivo del rechazo.')

    const cambios: Record<string, unknown> = { estado: nuevo, fecha_estado: c.fecha }
    if (c.id_cuenta_bancaria) cambios.id_cuenta_bancaria = c.id_cuenta_bancaria
    if (c.id_proveedor) cambios.id_proveedor = c.id_proveedor
    if (c.tercero_nombre?.trim()) cambios.tercero_nombre = c.tercero_nombre.trim()
    if (nuevo === 'Rechazado') cambios.motivo_rechazo = c.motivo_rechazo?.trim()
    if (nuevo === 'En cartera') cambios.motivo_rechazo = null

    const { error } = await cliente().from('erp_cheques').update(cambios).eq('id', cheque.id).eq('estado', cheque.estado)
    lanzar(error)
    const { error: eh } = await cliente().from('erp_cheques_historial').insert({
      id_cheque: cheque.id,
      estado_anterior: cheque.estado,
      estado_nuevo: nuevo,
      fecha: c.fecha,
      detalle: c.detalle?.trim() || c.motivo_rechazo?.trim() || null,
      id_usuario: usuarioId()
    })
    lanzar(eh)
    return true
  })
}

export type HistorialCheque = {
  id: number
  estado_anterior: string | null
  estado_nuevo: string
  fecha: string
  detalle: string | null
}

/** Todos los cheques con su historial agrupado por cheque. */
export function listChequesConHistorial() {
  return envolver(async () => {
    const cheques = await traerTodo<Cheque>((a, b) =>
      cliente().from('erp_cheques').select('*').order('fecha_pago', { ascending: true }).order('id', { ascending: true }).range(a, b)
    )
    const hist = await traerTodo<HistorialCheque & { id_cheque: number }>((a, b) =>
      cliente()
        .from('erp_cheques_historial')
        .select('id,id_cheque,estado_anterior,estado_nuevo,fecha,detalle')
        .order('id', { ascending: true })
        .range(a, b)
    )
    const historiales: Record<number, HistorialCheque[]> = {}
    for (const h of hist) (historiales[h.id_cheque] ??= []).push(h)
    return { cheques: cheques.map((c) => ({ ...c, importe: Number(c.importe) })), historiales }
  })
}

// =============================================================================
// Cobradores
// =============================================================================
export type Cobrador = {
  id: number
  nombre: string
  documento: string | null
  telefono: string | null
  email: string | null
  comision_pct: number
  activo: boolean
  observaciones: string | null
}

export function listCobradores() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_cobradores').select('*').order('nombre')
    lanzar(error)
    return ((data ?? []) as Cobrador[]).map((c) => ({ ...c, comision_pct: Number(c.comision_pct) || 0 }))
  })
}

export function guardarCobrador(c: Omit<Cobrador, 'id'> & { id?: number }) {
  return envolver(async () => {
    const { id, ...resto } = c
    const q = id
      ? cliente().from('erp_cobradores').update(resto).eq('id', id)
      : cliente().from('erp_cobradores').insert(resto)
    const { data, error } = await q.select('*').single()
    lanzar(error)
    return data as Cobrador
  })
}

export type AsignacionCobrador = { id: number; id_cobrador: number; id_cliente: number }

export function listAsignacionesCobrador() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_cobrador_clientes').select('id,id_cobrador,id_cliente')
    lanzar(error)
    return (data ?? []) as AsignacionCobrador[]
  })
}

/** Reemplaza los clientes asignados al cobrador (un cliente solo puede tener un cobrador). */
export function asignarClientesCobrador(idCobrador: number, idsClientes: number[]) {
  return envolver(async () => {
    const { error: e1 } = await cliente().from('erp_cobrador_clientes').delete().eq('id_cobrador', idCobrador)
    lanzar(e1)
    if (idsClientes.length === 0) return true
    // Si un cliente estaba en otro cobrador, se reasigna.
    const { error: e2 } = await cliente().from('erp_cobrador_clientes').delete().in('id_cliente', idsClientes)
    lanzar(e2)
    const { error: e3 } = await cliente()
      .from('erp_cobrador_clientes')
      .insert(idsClientes.map((id_cliente) => ({ id_cobrador: idCobrador, id_cliente })))
    lanzar(e3)
    return true
  })
}

export type MovimientoCc = {
  id: number
  id_cliente: number
  id_venta: number | null
  tipo: string
  debe: number
  haber: number
  fecha: string
  concepto: string | null
}

function movimientosCc(desde?: string, hasta?: string) {
  return traerTodo<MovimientoCc>((a, b) => {
    let q = cliente()
      .from('cc_cuenta_movimientos')
      .select('id,id_cliente,id_venta,tipo,debe,haber,fecha,concepto')
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
    if (desde) q = q.gte('fecha', desde)
    if (hasta) q = q.lte('fecha', hasta)
    return q.range(a, b)
  }).then((filas) => filas.map((m) => ({ ...m, debe: Number(m.debe) || 0, haber: Number(m.haber) || 0 })))
}

export type ClienteBasico = { id: number; nombre: string; apellido: string | null; empresa: string | null; dni_cuit: string | null }

export function nombreCliente(c: Pick<ClienteBasico, 'nombre' | 'apellido' | 'empresa'> | undefined, id?: number): string {
  if (!c) return id != null ? `Cliente #${id}` : '—'
  const persona = [c.nombre, c.apellido].filter(Boolean).join(' ').trim()
  return c.empresa?.trim() || persona || (id != null ? `Cliente #${id}` : '—')
}

export function listClientesBasicos() {
  return envolver(async () => {
    return traerTodo<ClienteBasico>((a, b) =>
      cliente().from('clientes').select('id,nombre,apellido,empresa,dni_cuit').order('id', { ascending: true }).range(a, b)
    )
  })
}

export type ReporteCobrador = {
  cobrado: number
  comision: number
  pendiente: number
  clientes: Array<{ id_cliente: number; cobrado: number; saldo: number }>
}

export function reporteCobrador(cobrador: Cobrador, idsClientes: number[], desde: string, hasta: string) {
  return envolver<ReporteCobrador>(async () => {
    if (idsClientes.length === 0) return { cobrado: 0, comision: 0, pendiente: 0, clientes: [] }
    const movs = (await movimientosCc()).filter((m) => idsClientes.includes(m.id_cliente))
    const porCliente = new Map<number, { cobrado: number; saldo: number }>()
    for (const id of idsClientes) porCliente.set(id, { cobrado: 0, saldo: 0 })
    for (const m of movs) {
      const fila = porCliente.get(m.id_cliente)
      if (!fila) continue
      fila.saldo += m.debe - m.haber
      if (m.tipo === 'pago' && m.fecha >= desde && m.fecha.slice(0, 10) <= hasta) fila.cobrado += m.haber
    }
    const clientes = [...porCliente.entries()].map(([id_cliente, v]) => ({
      id_cliente,
      cobrado: Math.round(v.cobrado * 100) / 100,
      saldo: Math.round(v.saldo * 100) / 100
    }))
    const cobrado = clientes.reduce((s, c) => s + c.cobrado, 0)
    return {
      cobrado: Math.round(cobrado * 100) / 100,
      comision: Math.round(cobrado * cobrador.comision_pct) / 100,
      pendiente: Math.round(clientes.reduce((s, c) => s + Math.max(0, c.saldo), 0) * 100) / 100,
      clientes
    }
  })
}

// =============================================================================
// Cuentas corrientes consolidadas
// =============================================================================
export type ClienteRelacionado = { id: number; id_cliente_principal: number; id_cliente_relacionado: number; observaciones: string | null }

export function listClientesRelacionados() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_clientes_relacionados').select('*').order('id_cliente_principal')
    lanzar(error)
    return (data ?? []) as ClienteRelacionado[]
  })
}

export function relacionarClientes(principal: number, relacionado: number, observaciones?: string) {
  return envolver(async () => {
    if (principal === relacionado) throw new Error('Elegí dos clientes distintos.')
    const { error } = await cliente()
      .from('erp_clientes_relacionados')
      .insert({ id_cliente_principal: principal, id_cliente_relacionado: relacionado, observaciones: observaciones?.trim() || null })
    lanzar(error)
    return true
  })
}

export function desrelacionarCliente(id: number) {
  return envolver(async () => {
    const { error } = await cliente().from('erp_clientes_relacionados').delete().eq('id', id)
    lanzar(error)
    return true
  })
}

export function saldosCcPorCliente(hasta?: string) {
  return envolver(async () => {
    const movs = await movimientosCc(undefined, hasta)
    const saldos = new Map<number, { debe: number; haber: number }>()
    for (const m of movs) {
      const s = saldos.get(m.id_cliente) ?? { debe: 0, haber: 0 }
      s.debe += m.debe
      s.haber += m.haber
      saldos.set(m.id_cliente, s)
    }
    return saldos
  })
}

export function movimientosCcPorFecha(desde: string, hasta: string) {
  return envolver(() => movimientosCc(desde, hasta))
}

export type DeudaProveedor = { id_proveedor: number | null; proveedor_nombre: string; pendiente: number }

export function deudaPorProveedor() {
  return envolver(async () => {
    const filas = await traerTodo<{ id_proveedor: number | null; proveedor_nombre: string; monto_pendiente: number; estado: string }>((a, b) =>
      cliente()
        .from('cuentas_por_pagar')
        .select('id_proveedor,proveedor_nombre,monto_pendiente,estado')
        .neq('estado', 'Pagado')
        .neq('estado', 'Cancelado')
        .range(a, b)
    )
    const mapa = new Map<string, DeudaProveedor>()
    for (const f of filas) {
      const clave = f.id_proveedor != null ? `id:${f.id_proveedor}` : `n:${f.proveedor_nombre}`
      const prev = mapa.get(clave) ?? { id_proveedor: f.id_proveedor, proveedor_nombre: f.proveedor_nombre, pendiente: 0 }
      prev.pendiente += Number(f.monto_pendiente) || 0
      mapa.set(clave, prev)
    }
    return [...mapa.values()]
  })
}

export function listProveedoresBasicos() {
  return envolver(async () => {
    return traerTodo<{ id: number; nombre: string | null; razon_social: string | null; cuit: string | null }>((a, b) =>
      cliente().from('proveedores').select('id,nombre,razon_social,cuit').order('id', { ascending: true }).range(a, b)
    )
  })
}

// =============================================================================
// Asientos modelo e índices de inflación
// =============================================================================
export type AsientoModeloLinea = {
  id?: number
  id_cuenta: number
  lado: 'Debe' | 'Haber'
  porcentaje: number
  concepto?: string | null
  orden?: number
}

export type AsientoModelo = {
  id: number
  nombre: string
  concepto: string
  tipo_asiento: 'Manual' | 'Automático' | 'Facturación' | 'Compra' | 'Pago' | 'Cobro' | 'Ajuste'
  activo: boolean
  detalles: AsientoModeloLinea[]
}

export function listAsientosModelo() {
  return envolver(async () => {
    const { data, error } = await cliente()
      .from('erp_asientos_modelo')
      .select('*, detalles:erp_asientos_modelo_detalle(*)')
      .order('nombre')
    lanzar(error)
    return ((data ?? []) as AsientoModelo[]).map((m) => ({
      ...m,
      detalles: [...(m.detalles ?? [])]
        .map((d) => ({ ...d, porcentaje: Number(d.porcentaje) || 0 }))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    }))
  })
}

export function guardarAsientoModelo(
  m: { id?: number; nombre: string; concepto: string; tipo_asiento: AsientoModelo['tipo_asiento'] },
  lineas: AsientoModeloLinea[]
) {
  return envolver(async () => {
    if (lineas.length < 2) throw new Error('El modelo necesita al menos dos líneas.')
    const debe = lineas.filter((l) => l.lado === 'Debe').reduce((s, l) => s + l.porcentaje, 0)
    const haber = lineas.filter((l) => l.lado === 'Haber').reduce((s, l) => s + l.porcentaje, 0)
    if (Math.abs(debe - haber) > 0.001) throw new Error(`Los porcentajes no balancean (Debe ${debe} / Haber ${haber}).`)

    let id = m.id
    if (id) {
      const { error } = await cliente()
        .from('erp_asientos_modelo')
        .update({ nombre: m.nombre, concepto: m.concepto, tipo_asiento: m.tipo_asiento })
        .eq('id', id)
      lanzar(error)
      const { error: ed } = await cliente().from('erp_asientos_modelo_detalle').delete().eq('id_modelo', id)
      lanzar(ed)
    } else {
      const { data, error } = await cliente()
        .from('erp_asientos_modelo')
        .insert({ nombre: m.nombre, concepto: m.concepto, tipo_asiento: m.tipo_asiento })
        .select('id')
        .single()
      lanzar(error)
      id = (data as { id: number }).id
    }
    const { error: ei } = await cliente()
      .from('erp_asientos_modelo_detalle')
      .insert(
        lineas.map((l, i) => ({
          id_modelo: id,
          id_cuenta: l.id_cuenta,
          lado: l.lado,
          porcentaje: l.porcentaje,
          concepto: l.concepto?.trim() || null,
          orden: i
        }))
      )
    lanzar(ei)
    return id as number
  })
}

export function eliminarAsientoModelo(id: number) {
  return envolver(async () => {
    const { error } = await cliente().from('erp_asientos_modelo').delete().eq('id', id)
    lanzar(error)
    return true
  })
}

export function listIndicesInflacion() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_indices_inflacion').select('periodo,indice,fuente').order('periodo')
    lanzar(error)
    return ((data ?? []) as Array<{ periodo: string; indice: number; fuente: string | null }>).map((r) => ({ ...r, indice: Number(r.indice) }))
  })
}

export function guardarIndicesInflacion(filas: Array<{ periodo: string; indice: number; fuente?: string | null }>) {
  return envolver(async () => {
    if (filas.length === 0) return 0
    const { error } = await cliente().from('erp_indices_inflacion').upsert(filas, { onConflict: 'periodo' })
    lanzar(error)
    return filas.length
  })
}

/** Debe − haber por cuenta y mes, solo asientos contabilizados hasta la fecha de cierre. */
export function movimientosMensualesPorCuenta(hasta: string) {
  return envolver(async () => {
    const filas = await traerTodo<{ id_cuenta: number; debe: number; haber: number; asiento: { fecha: string; estado: string } }>((a, b) =>
      cliente()
        .from('asientos_detalle')
        .select('id_cuenta,debe,haber,asiento:asientos_contables!inner(fecha,estado)')
        .eq('asiento.estado', 'Contabilizado')
        .lte('asiento.fecha', hasta)
        .order('id', { ascending: true })
        .range(a, b) as unknown as PromiseLike<{ data: any[] | null; error: { message: string } | null }>
    )
    const mapa = new Map<number, Map<string, number>>()
    for (const f of filas) {
      const periodo = String(f.asiento.fecha).slice(0, 7)
      const porMes = mapa.get(f.id_cuenta) ?? new Map<string, number>()
      porMes.set(periodo, (porMes.get(periodo) ?? 0) + (Number(f.debe) || 0) - (Number(f.haber) || 0))
      mapa.set(f.id_cuenta, porMes)
    }
    return mapa
  })
}
