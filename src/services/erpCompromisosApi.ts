/**
 * Compromisos financieros: cheques, pagarés, préstamos, planes de pago, etc. con sus vencimientos.
 * Además junta los cheques activos de Tesorería (erp_cheques) para verlos en la misma agenda.
 *
 * Requiere supabase/patches/2026-11-27_erp_compromisos_financieros.sql.
 */
import { supabase } from './supabaseClient'
import type { ErpResp } from './erpContableApi'

export type SentidoCompromiso = 'cobrar' | 'pagar'
export type TipoCompromiso = 'Cheque' | 'E-cheq' | 'Pagaré' | 'Préstamo' | 'Plan de pagos' | 'Tarjeta' | 'Otro'
export type ContraparteTipo = 'cliente' | 'proveedor' | 'otro'
export type EstadoVencimiento = 'Pendiente' | 'Cumplido' | 'Anulado'

export const TIPOS_COMPROMISO: TipoCompromiso[] = ['Cheque', 'E-cheq', 'Pagaré', 'Préstamo', 'Plan de pagos', 'Tarjeta', 'Otro']

export type Compromiso = {
  id: number
  sentido: SentidoCompromiso
  tipo: TipoCompromiso
  descripcion: string | null
  numero: string | null
  banco: string | null
  contraparte_tipo: ContraparteTipo
  id_cliente: number | null
  id_proveedor: number | null
  contraparte_nombre: string | null
  dias_aviso: number
  observaciones: string | null
  created_at: string
}

export type VencimientoCompromiso = {
  id: number
  id_compromiso: number
  nro_cuota: number
  fecha: string
  importe: number
  numero_cheque: string | null
  estado: EstadoVencimiento
  fecha_cumplido: string | null
  observaciones: string | null
}

export type CompromisoConVencimientos = Compromiso & { vencimientos: VencimientoCompromiso[] }

export type NuevoCompromiso = Omit<Compromiso, 'id' | 'created_at'>
/** id presente = vencimiento existente (se actualiza); sin id = nuevo. */
export type VencimientoEditable = {
  id?: number
  fecha: string
  importe: number
  numero_cheque: string | null
}

const PAGINA = 1000

function cliente() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

function mensajeError(e: unknown): string {
  const raw =
    e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/schema cache|does not exist|PGRST205|42P01/i.test(raw) && /erp_compromisos/i.test(raw)) {
    return 'Falta ejecutar supabase/patches/2026-11-27_erp_compromisos_financieros.sql en Supabase.'
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

export function listCompromisos() {
  return envolver(async () => {
    const [comps, vencs] = await Promise.all([
      traerTodo<Compromiso>((a, b) => cliente().from('erp_compromisos').select('*').order('id', { ascending: true }).range(a, b)),
      traerTodo<VencimientoCompromiso>((a, b) =>
        cliente()
          .from('erp_compromisos_vencimientos')
          .select('*')
          .order('fecha', { ascending: true })
          .order('nro_cuota', { ascending: true })
          .range(a, b)
      )
    ])
    const porCompromiso = new Map<number, VencimientoCompromiso[]>()
    for (const v of vencs) {
      const lista = porCompromiso.get(v.id_compromiso) ?? []
      lista.push({ ...v, importe: Number(v.importe) })
      porCompromiso.set(v.id_compromiso, lista)
    }
    return comps.map<CompromisoConVencimientos>((c) => ({ ...c, vencimientos: porCompromiso.get(c.id) ?? [] }))
  })
}

function validar(c: NuevoCompromiso, vencs: VencimientoEditable[]) {
  if (vencs.length === 0) throw new Error('Cargá al menos un vencimiento.')
  for (const v of vencs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)) throw new Error('Hay un vencimiento sin fecha.')
    if (!(v.importe > 0)) throw new Error('Cada vencimiento debe tener un importe mayor a cero.')
  }
  if (c.contraparte_tipo === 'cliente' && !c.id_cliente) throw new Error('Elegí el cliente.')
  if (c.contraparte_tipo === 'proveedor' && !c.id_proveedor) throw new Error('Elegí el proveedor.')
  if (c.contraparte_tipo === 'otro' && !c.contraparte_nombre?.trim()) throw new Error('Indicá con quién es el compromiso.')
}

function limpiar(c: NuevoCompromiso): NuevoCompromiso {
  const t = (s: string | null) => (s?.trim() ? s.trim() : null)
  return {
    ...c,
    descripcion: t(c.descripcion),
    numero: t(c.numero),
    banco: t(c.banco),
    contraparte_nombre: t(c.contraparte_nombre),
    observaciones: t(c.observaciones),
    id_cliente: c.contraparte_tipo === 'cliente' ? c.id_cliente : null,
    id_proveedor: c.contraparte_tipo === 'proveedor' ? c.id_proveedor : null
  }
}

/** Ordena por fecha y numera las cuotas 1..n. */
function numerar(vencs: VencimientoEditable[]) {
  return [...vencs]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((v, i) => ({ ...v, nro_cuota: i + 1, numero_cheque: v.numero_cheque?.trim() || null }))
}

export function crearCompromiso(c: NuevoCompromiso, vencs: VencimientoEditable[]) {
  return envolver(async () => {
    validar(c, vencs)
    const { data, error } = await cliente()
      .from('erp_compromisos')
      .insert({ ...limpiar(c), id_usuario: usuarioId() })
      .select('id')
      .single()
    lanzar(error)
    const id = (data as { id: number }).id
    const filas = numerar(vencs).map(({ fecha, importe, numero_cheque, nro_cuota }) => ({
      id_compromiso: id,
      fecha,
      importe,
      numero_cheque,
      nro_cuota
    }))
    const { error: ev } = await cliente().from('erp_compromisos_vencimientos').insert(filas)
    if (ev) {
      await cliente().from('erp_compromisos').delete().eq('id', id)
      lanzar(ev)
    }
    return id
  })
}

/**
 * Actualiza el compromiso y sus vencimientos: los que siguen se actualizan (conservando si
 * ya estaban cumplidos), los nuevos se agregan y los quitados se borran.
 */
export function actualizarCompromiso(id: number, c: NuevoCompromiso, vencs: VencimientoEditable[]) {
  return envolver(async () => {
    validar(c, vencs)
    const { error } = await cliente().from('erp_compromisos').update(limpiar(c)).eq('id', id)
    lanzar(error)

    const { data: actuales, error: ea } = await cliente().from('erp_compromisos_vencimientos').select('id').eq('id_compromiso', id)
    lanzar(ea)
    const numerados = numerar(vencs)
    const quedan = new Set(numerados.filter((v) => v.id).map((v) => v.id))
    const borrar = (actuales ?? []).map((v: { id: number }) => v.id).filter((x) => !quedan.has(x))
    if (borrar.length) {
      const { error: eb } = await cliente().from('erp_compromisos_vencimientos').delete().in('id', borrar)
      lanzar(eb)
    }
    for (const v of numerados) {
      const fila = { fecha: v.fecha, importe: v.importe, numero_cheque: v.numero_cheque, nro_cuota: v.nro_cuota }
      const { error: eu } = v.id
        ? await cliente().from('erp_compromisos_vencimientos').update(fila).eq('id', v.id).eq('id_compromiso', id)
        : await cliente().from('erp_compromisos_vencimientos').insert({ ...fila, id_compromiso: id })
      lanzar(eu)
    }
    return true
  })
}

export function eliminarCompromiso(id: number) {
  return envolver(async () => {
    const { error } = await cliente().from('erp_compromisos').delete().eq('id', id)
    lanzar(error)
    return true
  })
}

export function cambiarEstadoVencimiento(id: number, estado: EstadoVencimiento, fecha: string | null) {
  return envolver(async () => {
    const { error } = await cliente()
      .from('erp_compromisos_vencimientos')
      .update({ estado, fecha_cumplido: estado === 'Cumplido' ? fecha : null })
      .eq('id', id)
    lanzar(error)
    return true
  })
}

/** Cheques de Tesorería que todavía no se cobraron / debitaron. */
export type ChequeAgenda = {
  id: number
  tipo: 'Tercero' | 'Propio'
  es_echeq: boolean
  numero: string
  banco: string | null
  importe: number
  fecha_pago: string
  estado: string
  id_cliente: number | null
  id_proveedor: number | null
  tercero_nombre: string | null
  librador_nombre: string | null
}

export const ESTADOS_CHEQUE_PENDIENTE = ['En cartera', 'Depositado', 'Emitido', 'Entregado']

export function listChequesPendientes() {
  return envolver(async () => {
    const filas = await traerTodo<ChequeAgenda>((a, b) =>
      cliente()
        .from('erp_cheques')
        .select('id,tipo,es_echeq,numero,banco,importe,fecha_pago,estado,id_cliente,id_proveedor,tercero_nombre,librador_nombre')
        .in('estado', ESTADOS_CHEQUE_PENDIENTE)
        .order('fecha_pago', { ascending: true })
        .range(a, b)
    )
    return filas.map((c) => ({ ...c, importe: Number(c.importe) }))
  })
}
