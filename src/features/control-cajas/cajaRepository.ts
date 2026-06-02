import { supabase } from '../../services/supabaseClient'
import { DEFAULT_CAJAS, DEFAULT_PARAMS, LS_KEY } from './constants'
import { getPlotlabLoginKeys, getStoredCajaSlug } from './cajaUsuarioDisplay'
import { cierreFromCalculado } from './cierreCalculations'
import { fondoFijoEfectivo } from './fondoCaja'
import { newId } from './format'
import {
  calcularTotalesCaja,
  cierreCerrado,
  enrichCierreFromTotales,
  movimientosEnPeriodoCaja,
  snapshotTotalesCierre
} from './movimientoCaja'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import { datosJsonToPlanilla, planillaToDatosJson } from './planillaMovimientos'
import type {
  CajaArqueo,
  CajaCajera,
  CajaCierre,
  CajaConcilBanco,
  CajaConcilMP,
  CajaDiferencia,
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaParams,
  CajaRegistro,
  CajaTransferenciaLote,
  CajaTraspaso,
  CajaTraspasoEstado,
  PlanillaCajaGuardada
} from './types'

type LocalStore = {
  cajas: CajaRegistro[]
  arqueos: CajaArqueo[]
  traspasos: CajaTraspaso[]
  movimientos: CajaMovimiento[]
  planillas: PlanillaCajaGuardada[]
  cierres: CajaCierre[]
  concil_mp: CajaConcilMP[]
  concil_banco: CajaConcilBanco[]
  diferencias: CajaDiferencia[]
  transferencia_lotes: CajaTransferenciaLote[]
  egreso_solicitudes: CajaEgresoSolicitud[]
  params: CajaParams
}

let remoteOk: boolean | null = null

async function checkRemote(): Promise<boolean> {
  if (remoteOk !== null) return remoteOk
  if (!supabase) {
    remoteOk = false
    return false
  }
  const { error } = await supabase.from('control_caja_cajas').select('slug').limit(1)
  remoteOk = !error
  return remoteOk
}

function readLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStore
      return {
        cajas: parsed.cajas?.length ? parsed.cajas : [...DEFAULT_CAJAS],
        arqueos: parsed.arqueos ?? [],
        traspasos: parsed.traspasos ?? [],
        movimientos: parsed.movimientos ?? [],
        planillas: parsed.planillas ?? [],
        cierres: parsed.cierres ?? [],
        concil_mp: parsed.concil_mp ?? [],
        concil_banco: parsed.concil_banco ?? [],
        diferencias: parsed.diferencias ?? [],
        transferencia_lotes: parsed.transferencia_lotes ?? [],
        egreso_solicitudes: parsed.egreso_solicitudes ?? [],
        params: parsed.params ?? { ...DEFAULT_PARAMS }
      }
    }
  } catch {
    /* noop */
  }
  return {
    cajas: [...DEFAULT_CAJAS],
    arqueos: [],
    traspasos: [],
    movimientos: [],
    planillas: [],
    cierres: [],
    concil_mp: [],
    concil_banco: [],
    diferencias: [],
    transferencia_lotes: [],
    egreso_solicitudes: [],
    params: { ...DEFAULT_PARAMS, cajeras: [...DEFAULT_PARAMS.cajeras] }
  }
}

function writeLocal(data: LocalStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

function mapCajaRegistro(r: {
  slug: string
  nombre: string
  fondo_fijo: unknown
  activa: boolean
}): CajaRegistro {
  const row: CajaRegistro = {
    slug: r.slug,
    nombre: r.nombre,
    fondo_fijo: Number(r.fondo_fijo) || 0,
    activa: !!r.activa
  }
  return { ...row, fondo_fijo: fondoFijoEfectivo(row) }
}

export async function listCajas(): Promise<CajaRegistro[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_cajas')
      .select('slug, nombre, fondo_fijo, activa')
      .order('nombre')
    if (!error && data?.length) {
      return data.map((r) => mapCajaRegistro(r))
    }
  }
  return readLocal()
    .cajas.filter((c) => c.activa)
    .map((c) => mapCajaRegistro(c))
}

export async function listArqueos(opts?: {
  usuario?: string
  usuarioId?: number
}): Promise<CajaArqueo[]> {
  if (await checkRemote()) {
    let q = supabase!.from('control_caja_arqueos').select('*').order('fecha', { ascending: false })
    if (opts?.usuarioId != null) q = q.eq('id_usuario', opts.usuarioId)
    else if (opts?.usuario) q = q.eq('usuario_nombre', opts.usuario)
    const { data, error } = await q
    if (!error && data) {
      return data.map(mapArqueoRow)
    }
  }
  let list = readLocal().arqueos
  if (opts?.usuarioId != null) list = list.filter((a) => a.id_usuario === opts.usuarioId)
  else if (opts?.usuario) list = list.filter((a) => a.usuario_nombre === opts.usuario)
  return [...list].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Último arqueo de una caja (misma fecha primero, luego el más reciente). */
export async function getUltimoArqueoCaja(
  cajaSlug: string,
  fecha?: string
): Promise<CajaArqueo | null> {
  const arqueos = await listArqueos()
  const delSlug = arqueos.filter((a) => a.caja_slug === cajaSlug)
  if (!delSlug.length) return null
  if (fecha) {
    const mismoDia = delSlug.find((a) => a.fecha === fecha)
    if (mismoDia) return mismoDia
  }
  return delSlug[0]
}

function mapArqueoRow(r: Record<string, unknown>): CajaArqueo {
  const est = r.estado_arqueo
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    caja_slug: String(r.caja_slug),
    turno: String(r.turno ?? 'Único'),
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nombre: r.usuario_nombre != null ? String(r.usuario_nombre) : null,
    billetes: (r.billetes as Record<string, number>) ?? {},
    total: Number(r.total) || 0,
    teorico_fisico: numOrNull(r.teorico_fisico) ?? numOrNull((r.saldos as Record<string, unknown>)?.teorico_fisico),
    diferencia: numOrNull(r.diferencia),
    estado_arqueo:
      est === 'correcto' || est === 'sobrante' || est === 'faltante' ? est : null,
    saldos:
      r.saldos != null && typeof r.saldos === 'object'
        ? (r.saldos as Record<string, unknown>)
        : null,
    firma_data_url: r.firma_data_url != null ? String(r.firma_data_url) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined
  }
}

export async function saveArqueo(
  arqueo: Omit<CajaArqueo, 'id' | 'created_at'> & { id?: string }
): Promise<CajaArqueo> {
  const id = arqueo.id ?? newId()
  const record: CajaArqueo = { ...arqueo, id }

  if (await checkRemote()) {
    const row = {
      id,
      fecha: arqueo.fecha,
      caja_slug: arqueo.caja_slug,
      turno: arqueo.turno,
      id_usuario: arqueo.id_usuario ?? null,
      usuario_nombre: arqueo.usuario_nombre ?? null,
      billetes: arqueo.billetes,
      total: arqueo.total,
      diferencia: arqueo.diferencia ?? null,
      estado_arqueo: arqueo.estado_arqueo ?? null,
      saldos: arqueo.saldos ?? null,
      firma_data_url: arqueo.firma_data_url ?? null
    }
    const { error } = await supabase!.from('control_caja_arqueos').upsert(row)
    if (!error) return record
  }

  const store = readLocal()
  const idx = store.arqueos.findIndex((a) => a.id === id)
  if (idx >= 0) store.arqueos[idx] = record
  else store.arqueos.push(record)
  writeLocal(store)
  return record
}

// —— Traspasos entre cajas ——

function mapTraspasoRow(r: Record<string, unknown>): CajaTraspaso {
  const est = r.estado
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    caja_origen_slug: String(r.caja_origen_slug),
    caja_destino_slug: String(r.caja_destino_slug),
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nombre: r.usuario_nombre != null ? String(r.usuario_nombre) : null,
    comprobante: r.comprobante != null ? String(r.comprobante) : null,
    monto_total: Number(r.monto_total) || 0,
    efectivo: Number(r.efectivo) || 0,
    tarjeta: Number(r.tarjeta) || 0,
    transferencia_bancaria: Number(r.transferencia_bancaria) || 0,
    cheque: Number(r.cheque) || 0,
    documento: Number(r.documento) || 0,
    otros: Number(r.otros) || 0,
    estado:
      est === 'confirmado' || est === 'anulado' ? est : 'pendiente',
    observacion: r.observacion != null ? String(r.observacion) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined
  }
}

export async function listTraspasos(opts?: {
  estado?: CajaTraspasoEstado
  cajaSlug?: string
}): Promise<CajaTraspaso[]> {
  if (await checkRemote()) {
    let q = supabase!.from('control_caja_traspasos').select('*').order('fecha', { ascending: false })
    if (opts?.estado) q = q.eq('estado', opts.estado)
    const { data, error } = await q
    if (!error && data) {
      let list = data.map(mapTraspasoRow)
      if (opts?.cajaSlug) {
        list = list.filter(
          (t) => t.caja_origen_slug === opts.cajaSlug || t.caja_destino_slug === opts.cajaSlug
        )
      }
      return list
    }
  }
  let list = readLocal().traspasos
  if (opts?.estado) list = list.filter((t) => t.estado === opts.estado)
  if (opts?.cajaSlug) {
    list = list.filter(
      (t) => t.caja_origen_slug === opts.cajaSlug || t.caja_destino_slug === opts.cajaSlug
    )
  }
  return [...list].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function saveTraspaso(
  traspaso: Omit<CajaTraspaso, 'created_at' | 'updated_at'> & { id?: string }
): Promise<CajaTraspaso> {
  const id = traspaso.id ?? newId()
  const record: CajaTraspaso = {
    ...traspaso,
    id,
    updated_at: new Date().toISOString()
  }

  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_traspasos').upsert({
      id,
      fecha: traspaso.fecha,
      caja_origen_slug: traspaso.caja_origen_slug,
      caja_destino_slug: traspaso.caja_destino_slug,
      id_usuario: traspaso.id_usuario ?? null,
      usuario_nombre: traspaso.usuario_nombre ?? null,
      comprobante: traspaso.comprobante ?? null,
      monto_total: traspaso.monto_total,
      efectivo: traspaso.efectivo,
      tarjeta: traspaso.tarjeta,
      transferencia_bancaria: traspaso.transferencia_bancaria,
      cheque: traspaso.cheque,
      documento: traspaso.documento,
      otros: traspaso.otros,
      estado: traspaso.estado,
      observacion: traspaso.observacion ?? null,
      updated_at: record.updated_at
    })
    if (!error) return record
  }

  const store = readLocal()
  const idx = store.traspasos.findIndex((t) => t.id === id)
  if (idx >= 0) store.traspasos[idx] = record
  else store.traspasos.unshift(record)
  writeLocal(store)
  return record
}

export async function setTraspasoEstado(
  id: string,
  estado: CajaTraspasoEstado
): Promise<CajaTraspaso> {
  const list = await listTraspasos()
  const t = list.find((x) => x.id === id)
  if (!t) throw new Error('Traspaso no encontrado')

  const updated = await saveTraspaso({ ...t, estado })

  const movs = await listMovimientos()
  const linked = movs.filter((m) => m.traspaso_id === id)
  for (const m of linked) {
    await saveMovimiento({ ...m, anulado: estado === 'anulado' })
  }

  return updated
}

export async function deleteArqueo(id: string): Promise<void> {
  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_arqueos').delete().eq('id', id)
    if (!error) return
  }
  const store = readLocal()
  store.arqueos = store.arqueos.filter((a) => a.id !== id)
  writeLocal(store)
}

export async function listMovimientos(opts?: {
  usuario?: string
  usuarioId?: number
}): Promise<CajaMovimiento[]> {
  if (await checkRemote()) {
    let q = supabase!.from('control_caja_movimientos').select('*').order('fecha', { ascending: false })
    if (opts?.usuarioId != null) q = q.eq('id_usuario', opts.usuarioId)
    else if (opts?.usuario) q = q.eq('usuario_nombre', opts.usuario)
    const { data, error } = await q
    if (!error && data) {
      return data.map(mapMovRow)
    }
  }
  let list = readLocal().movimientos
  if (opts?.usuarioId != null) list = list.filter((m) => m.id_usuario === opts.usuarioId)
  else if (opts?.usuario) list = list.filter((m) => m.usuario_nombre === opts.usuario)
  return [...list].sort((a, b) => {
    const ka = `${b.fecha}${b.hora ?? ''}`
    const kb = `${a.fecha}${a.hora ?? ''}`
    return ka.localeCompare(kb)
  })
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function movRowFromRecord(mov: CajaMovimiento, id: string) {
  return {
    id,
    fecha: mov.fecha,
    hora: mov.hora || null,
    concepto: mov.concepto,
    tipo_movimiento: mov.tipo_movimiento ?? null,
    categoria: mov.categoria ?? null,
    tercero_nombre: mov.tercero_nombre ?? null,
    monto_total: mov.monto_total ?? mov.efectivo + mov.otros,
    cuenta_corriente: mov.cuenta_corriente ?? 0,
    cheque_propio: mov.cheque_propio ?? 0,
    cheque_tercero: mov.cheque_tercero ?? 0,
    tarjeta: mov.tarjeta ?? 0,
    documento: mov.documento ?? 0,
    cuenta_contable: mov.cuenta_contable ?? 0,
    transferencia_bancaria: mov.transferencia_bancaria ?? 0,
    origen_slug: mov.origen_slug,
    destino_slug: mov.destino_slug,
    efectivo: mov.efectivo,
    otros: mov.otros,
    nro_comprobante: mov.nro_comprobante ?? null,
    observacion: mov.observacion ?? null,
    id_usuario: mov.id_usuario ?? null,
    usuario_nombre: mov.usuario_nombre ?? null,
    origen_importacion: mov.origen_importacion ?? 'manual',
    id_lote: mov.id_lote ?? null,
    traspaso_id: mov.traspaso_id ?? null,
    cierre_id: mov.cierre_id ?? null,
    anulado: mov.anulado ?? false,
    medios: mov.medios ?? null,
    subtipo_pase: mov.subtipo_pase ?? null,
    origen_efectivo_antes: mov.origen_efectivo_antes ?? null,
    origen_otros_antes: mov.origen_otros_antes ?? null,
    destino_efectivo_antes: mov.destino_efectivo_antes ?? null,
    destino_otros_antes: mov.destino_otros_antes ?? null,
    origen_efectivo_despues: mov.origen_efectivo_despues ?? null,
    origen_otros_despues: mov.origen_otros_despues ?? null,
    destino_efectivo_despues: mov.destino_efectivo_despues ?? null,
    destino_otros_despues: mov.destino_otros_despues ?? null,
    updated_at: new Date().toISOString()
  }
}

function mapMovRow(r: Record<string, unknown>): CajaMovimiento {
  const imp = r.origen_importacion
  const origen_importacion =
    imp === 'excel' ? 'excel' : imp === 'planilla_pdf' ? 'planilla_pdf' : 'manual'
  const tipo = r.tipo_movimiento
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    hora: r.hora != null ? String(r.hora).slice(0, 5) : null,
    concepto: String(r.concepto),
    tipo_movimiento:
      tipo === 'ingreso' || tipo === 'egreso' || tipo === 'traspaso' || tipo === 'ajuste'
        ? tipo
        : null,
    categoria: r.categoria != null ? String(r.categoria) : null,
    tercero_nombre: r.tercero_nombre != null ? String(r.tercero_nombre) : null,
    monto_total: numOrNull(r.monto_total),
    cuenta_corriente: numOrNull(r.cuenta_corriente),
    cheque_propio: numOrNull(r.cheque_propio),
    cheque_tercero: numOrNull(r.cheque_tercero),
    tarjeta: numOrNull(r.tarjeta),
    documento: numOrNull(r.documento),
    cuenta_contable: numOrNull(r.cuenta_contable),
    transferencia_bancaria: numOrNull(r.transferencia_bancaria),
    origen_slug: String(r.origen_slug),
    destino_slug: String(r.destino_slug),
    efectivo: Number(r.efectivo) || 0,
    otros: Number(r.otros) || 0,
    nro_comprobante: r.nro_comprobante != null ? String(r.nro_comprobante) : null,
    observacion: r.observacion != null ? String(r.observacion) : null,
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nombre: r.usuario_nombre != null ? String(r.usuario_nombre) : null,
    origen_importacion,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    id_lote: r.id_lote != null ? String(r.id_lote) : null,
    traspaso_id: r.traspaso_id != null ? String(r.traspaso_id) : null,
    medios:
      r.medios != null && typeof r.medios === 'object' ? (r.medios as Record<string, number>) : null,
    subtipo_pase:
      r.subtipo_pase === 'fondo' || r.subtipo_pase === 'resto_admin' || r.subtipo_pase === 'libre'
        ? r.subtipo_pase
        : null,
    origen_efectivo_antes: numOrNull(r.origen_efectivo_antes),
    origen_otros_antes: numOrNull(r.origen_otros_antes),
    destino_efectivo_antes: numOrNull(r.destino_efectivo_antes),
    destino_otros_antes: numOrNull(r.destino_otros_antes),
    origen_efectivo_despues: numOrNull(r.origen_efectivo_despues),
    origen_otros_despues: numOrNull(r.origen_otros_despues),
    destino_efectivo_despues: numOrNull(r.destino_efectivo_despues),
    destino_otros_despues: numOrNull(r.destino_otros_despues),
    cierre_id: r.cierre_id != null ? String(r.cierre_id) : null,
    anulado: !!r.anulado
  }
}

export async function assertMovimientoEditable(cierreId?: string | null): Promise<void> {
  if (!cierreId) return
  const c = await getCierre(cierreId)
  if (c && (c.estado_cierre === 'cerrado' || c.estado_cierre === 'observado')) {
    throw new Error('No se puede modificar: el movimiento pertenece a un cierre ya cerrado.')
  }
}

export async function saveMovimiento(
  mov: Omit<CajaMovimiento, 'id' | 'created_at'> & { id?: string }
): Promise<CajaMovimiento> {
  await assertMovimientoEditable(mov.cierre_id)
  const id = mov.id ?? newId()
  const record: CajaMovimiento = { ...mov, id, origen_importacion: mov.origen_importacion ?? 'manual' }

  if (await checkRemote()) {
    const row = movRowFromRecord(record, id)
    const { error } = await supabase!.from('control_caja_movimientos').upsert(row)
    if (!error) return record
  }

  const store = readLocal()
  const idx = store.movimientos.findIndex((m) => m.id === id)
  if (idx >= 0) store.movimientos[idx] = record
  else store.movimientos.push(record)
  writeLocal(store)
  return record
}

export async function saveMovimientosBulk(
  rows: Omit<CajaMovimiento, 'id' | 'created_at'>[]
): Promise<CajaMovimiento[]> {
  const saved: CajaMovimiento[] = []
  for (const row of rows) {
    saved.push(
      await saveMovimiento({
        ...row,
        origen_importacion: row.origen_importacion ?? 'manual'
      })
    )
  }
  return saved
}

export function getCierreFechaCaja(
  cierres: CajaCierre[],
  fecha: string,
  cajaSlug: string
): CajaCierre | null {
  return cierres.find((c) => c.fecha === fecha && c.caja_slug === cajaSlug) ?? null
}

// —— Egresos (aprobación administración) ——

function mapEgresoRow(r: Record<string, unknown>): CajaEgresoSolicitud {
  const estado = r.estado === 'aprobado' || r.estado === 'rechazado' ? r.estado : 'pendiente'
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    caja_slug: String(r.caja_slug),
    concepto: String(r.concepto),
    monto_efectivo: Number(r.monto_efectivo) || 0,
    monto_otros: Number(r.monto_otros) || 0,
    estado,
    solicitante_id: r.solicitante_id != null ? Number(r.solicitante_id) : null,
    solicitante_nombre: r.solicitante_nombre != null ? String(r.solicitante_nombre) : null,
    aprobador_id: r.aprobador_id != null ? Number(r.aprobador_id) : null,
    aprobador_nombre: r.aprobador_nombre != null ? String(r.aprobador_nombre) : null,
    observacion: r.observacion != null ? String(r.observacion) : null,
    motivo_rechazo: r.motivo_rechazo != null ? String(r.motivo_rechazo) : null,
    id_movimiento: r.id_movimiento != null ? String(r.id_movimiento) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined
  }
}

export async function listEgresoSolicitudes(opts?: {
  fecha?: string
  cajaSlug?: string
  soloPendientes?: boolean
}): Promise<CajaEgresoSolicitud[]> {
  if (await checkRemote()) {
    let q = supabase!
      .from('control_caja_egreso_solicitudes')
      .select('*')
      .order('created_at', { ascending: false })
    if (opts?.fecha) q = q.eq('fecha', opts.fecha)
    if (opts?.cajaSlug) q = q.eq('caja_slug', opts.cajaSlug)
    if (opts?.soloPendientes) q = q.eq('estado', 'pendiente')
    const { data, error } = await q
    if (!error && data) return data.map((r) => mapEgresoRow(r))
  }
  let list = readLocal().egreso_solicitudes
  if (opts?.fecha) list = list.filter((s) => s.fecha === opts.fecha)
  if (opts?.cajaSlug) list = list.filter((s) => s.caja_slug === opts.cajaSlug)
  if (opts?.soloPendientes) list = list.filter((s) => s.estado === 'pendiente')
  return [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

export async function createEgresoSolicitud(
  input: Omit<CajaEgresoSolicitud, 'id' | 'estado' | 'created_at' | 'updated_at' | 'aprobador_id' | 'aprobador_nombre' | 'motivo_rechazo' | 'id_movimiento'>
): Promise<CajaEgresoSolicitud> {
  const id = newId()
  const now = new Date().toISOString()
  const record: CajaEgresoSolicitud = {
    ...input,
    id,
    estado: 'pendiente',
    aprobador_id: null,
    aprobador_nombre: null,
    motivo_rechazo: null,
    id_movimiento: null,
    created_at: now,
    updated_at: now
  }

  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_egreso_solicitudes').insert({
      id,
      fecha: input.fecha,
      caja_slug: input.caja_slug,
      concepto: input.concepto,
      monto_efectivo: input.monto_efectivo,
      monto_otros: input.monto_otros,
      estado: 'pendiente',
      solicitante_id: input.solicitante_id ?? null,
      solicitante_nombre: input.solicitante_nombre ?? null,
      observacion: input.observacion ?? null
    })
    if (!error) return record
  }

  const store = readLocal()
  store.egreso_solicitudes.unshift(record)
  writeLocal(store)
  return record
}

export async function resolverEgresoSolicitud(
  id: string,
  accion: 'aprobado' | 'rechazado',
  aprobador: { id: number; nombre: string },
  opts?: { motivo_rechazo?: string; adminSlug?: string }
): Promise<CajaEgresoSolicitud | null> {
  const list = await listEgresoSolicitudes()
  const sol = list.find((s) => s.id === id)
  if (!sol || sol.estado !== 'pendiente') return null

  const now = new Date().toISOString()
  let id_movimiento: string | null = null

  if (accion === 'aprobado') {
    const adminSlug =
      opts?.adminSlug ??
      (await listCajas()).find((c) => c.slug === 'admin')?.slug ??
      'admin'
    const mov = await saveMovimiento({
      fecha: sol.fecha,
      hora: new Date().toTimeString().slice(0, 5),
      concepto: sol.concepto || 'Egreso',
      subtipo_pase: null,
      origen_slug: sol.caja_slug,
      destino_slug: adminSlug,
      efectivo: sol.monto_efectivo,
      otros: sol.monto_otros,
      observacion: `Egreso aprobado por ${aprobador.nombre}. ${sol.observacion ?? ''}`.trim(),
      id_usuario: sol.solicitante_id ?? null,
      usuario_nombre: sol.solicitante_nombre ?? null,
      origen_importacion: 'manual'
    })
    id_movimiento = mov.id
  }

  const updated: CajaEgresoSolicitud = {
    ...sol,
    estado: accion,
    aprobador_id: aprobador.id,
    aprobador_nombre: aprobador.nombre,
    motivo_rechazo: accion === 'rechazado' ? opts?.motivo_rechazo ?? null : null,
    id_movimiento,
    updated_at: now
  }

  if (await checkRemote()) {
    const { error } = await supabase!
      .from('control_caja_egreso_solicitudes')
      .update({
        estado: accion,
        aprobador_id: aprobador.id,
        aprobador_nombre: aprobador.nombre,
        motivo_rechazo: updated.motivo_rechazo,
        id_movimiento,
        updated_at: now
      })
      .eq('id', id)
    if (!error) return updated
  }

  const store = readLocal()
  const idx = store.egreso_solicitudes.findIndex((s) => s.id === id)
  if (idx >= 0) store.egreso_solicitudes[idx] = updated
  writeLocal(store)
  return updated
}

// —— Cierre de turno (lote) ——

function mapLoteRow(r: Record<string, unknown>): CajaTransferenciaLote {
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    hora: r.hora != null ? String(r.hora).slice(0, 5) : null,
    origen_slug: String(r.origen_slug),
    caja_fondo_destino_slug: String(r.caja_fondo_destino_slug),
    arqueo_efectivo: Number(r.arqueo_efectivo) || 0,
    arqueo_otros: Number(r.arqueo_otros) || 0,
    fondo_monto: Number(r.fondo_monto) || 0,
    resto_efectivo: Number(r.resto_efectivo) || 0,
    resto_otros: Number(r.resto_otros) || 0,
    egresos_aprobados_ef: Number(r.egresos_aprobados_ef) || 0,
    id_planilla: r.id_planilla != null ? String(r.id_planilla) : null,
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nombre: r.usuario_nombre != null ? String(r.usuario_nombre) : null,
    observacion: r.observacion != null ? String(r.observacion) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined
  }
}

export async function listTransferenciaLotes(limit = 30): Promise<CajaTransferenciaLote[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_transferencia_lotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error && data) return data.map((r) => mapLoteRow(r))
  }
  return readLocal()
    .transferencia_lotes.slice(0, limit)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

export async function saveTransferenciaLote(
  lote: Omit<CajaTransferenciaLote, 'created_at'> & { id?: string }
): Promise<CajaTransferenciaLote> {
  const id = lote.id ?? newId()
  const record: CajaTransferenciaLote = { ...lote, id }

  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_transferencia_lotes').upsert({
      id,
      fecha: lote.fecha,
      hora: lote.hora || null,
      origen_slug: lote.origen_slug,
      caja_fondo_destino_slug: lote.caja_fondo_destino_slug,
      arqueo_efectivo: lote.arqueo_efectivo,
      arqueo_otros: lote.arqueo_otros,
      fondo_monto: lote.fondo_monto,
      resto_efectivo: lote.resto_efectivo,
      resto_otros: lote.resto_otros,
      egresos_aprobados_ef: lote.egresos_aprobados_ef,
      id_planilla: lote.id_planilla ?? null,
      id_usuario: lote.id_usuario ?? null,
      usuario_nombre: lote.usuario_nombre ?? null,
      observacion: lote.observacion ?? null
    })
    if (!error) return record
  }

  const store = readLocal()
  const idx = store.transferencia_lotes.findIndex((l) => l.id === id)
  if (idx >= 0) store.transferencia_lotes[idx] = record
  else store.transferencia_lotes.unshift(record)
  writeLocal(store)
  return record
}

export async function deleteMovimiento(id: string): Promise<void> {
  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_movimientos').delete().eq('id', id)
    if (!error) return
  }
  const store = readLocal()
  store.movimientos = store.movimientos.filter((m) => m.id !== id)
  writeLocal(store)
}

export function resolveCajaSlug(nombre: string, cajas: CajaRegistro[]): string | null {
  const n = nombre.trim().toLowerCase()
  if (!n) return null
  const exact = cajas.find((c) => c.slug === n || c.nombre.toLowerCase() === n)
  if (exact) return exact.slug
  const partial = cajas.find(
    (c) => c.nombre.toLowerCase().includes(n) || n.includes(c.nombre.toLowerCase())
  )
  return partial?.slug ?? null
}

function slugFromCajeraNombre(cajeraNombre: string, cajas: CajaRegistro[]): string | null {
  const first = cajeraNombre.trim().split(/\s+/)[0]?.toLowerCase()
  if (!first) return null
  const bySlug = cajas.find((c) => c.slug === first)
  if (bySlug) return bySlug.slug
  return (
    cajas.find(
      (c) =>
        c.slug !== 'admin' &&
        c.slug !== 'vuelto' &&
        c.nombre.toLowerCase().replace(/^caja\s+/, '').startsWith(first)
    )?.slug ?? null
  )
}

/** Asocia el usuario logueado a su caja (maestros, login, preferencia guardada). */
export function resolveCajaSlugForUsuario(
  usuarioNombre: string,
  cajas: CajaRegistro[],
  cajeras: CajaCajera[] = [],
  opts?: { usuarioId?: number }
): string | null {
  const norm = usuarioNombre.trim().toLowerCase()
  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
  if (!operativas.length) return null

  if (opts?.usuarioId) {
    const stored = getStoredCajaSlug(opts.usuarioId)
    if (stored && operativas.some((c) => c.slug === stored)) return stored
  }

  const loginKeys = getPlotlabLoginKeys(usuarioNombre)

  for (const cajera of cajeras) {
    const cn = cajera.nombre.trim().toLowerCase()
    const cu = cajera.usuario.trim().toLowerCase()
    if (loginKeys.some((k) => k === cu) || norm === cn || norm === cu) {
      const slug = slugFromCajeraNombre(cajera.nombre, cajas)
      if (slug) return slug
    }
    const first = cn.split(/\s+/)[0]
    if (first && first.length >= 3 && (norm.includes(first) || loginKeys.some((k) => k.includes(first)))) {
      const slug = slugFromCajeraNombre(cajera.nombre, cajas)
      if (slug) return slug
    }
  }

  for (const key of loginKeys) {
    const bySlug = operativas.find((c) => c.slug === key)
    if (bySlug) return bySlug.slug
  }

  const fromNombre = resolveCajaSlug(usuarioNombre, operativas)
  if (fromNombre) return fromNombre

  const first = norm.split(/\s+/)[0]
  if (first.length >= 2) {
    return operativas.find((c) => c.slug === first)?.slug ?? null
  }
  return null
}

/** Última caja usada por el usuario en arqueos previos. */
export async function resolveCajaSlugFromHistorial(
  usuarioId: number,
  cajas: CajaRegistro[]
): Promise<string | null> {
  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
  const arqueos = await listArqueos({ usuarioId })
  const slug = arqueos.find((a) => operativas.some((c) => c.slug === a.caja_slug))?.caja_slug
  return slug ?? null
}

export async function usesRemoteStorage(): Promise<boolean> {
  return checkRemote()
}

export async function savePlanillaImport(
  planilla: PlanillaCajaParsed,
  cajaSlug: string | null,
  usuarioNombre: string,
  usuarioId?: number
): Promise<PlanillaCajaGuardada> {
  const id = newId()
  const record: PlanillaCajaGuardada = {
    id,
    archivo_nombre: planilla.archivo_nombre,
    fecha_desde: planilla.fecha_desde,
    fecha_hasta: planilla.fecha_hasta,
    caja_nombre: planilla.caja_nombre,
    caja_slug: cajaSlug,
    totales: planilla.totales
      ? {
          ingresos_total: planilla.totales.ingresos_total,
          egresos_total: planilla.totales.egresos_total,
          neto: planilla.totales.neto,
          ingresos_efectivo: planilla.totales.ingresos_efectivo,
          ingresos_tarjetas: planilla.totales.ingresos_tarjetas,
          ingresos_cta_cte: planilla.totales.ingresos_cta_cte,
          ingresos_trans_b: planilla.totales.ingresos_trans_b
        }
      : null,
    resumen: {
      cantidad_ventas: planilla.cantidad_ventas,
      cantidad_egresos: planilla.egresos.length,
      cantidad_mec: planilla.movimientos_mec.length
    },
    id_usuario: usuarioId ?? null,
    usuario_nombre: usuarioNombre
  }

  if (await checkRemote()) {
    const row = {
      id,
      archivo_nombre: planilla.archivo_nombre,
      fecha_desde: planilla.fecha_desde || null,
      fecha_hasta: planilla.fecha_hasta || null,
      caja_nombre: planilla.caja_nombre,
      caja_slug: cajaSlug,
      totales: planilla.totales,
      datos: planillaToDatosJson(planilla),
      id_usuario: usuarioId ?? null,
      usuario_nombre: usuarioNombre
    }
    const { error } = await supabase!.from('control_caja_planillas').insert(row)
    if (!error) return record
  }

  const store = readLocal()
  const localRecord = {
    ...record,
    datos: planillaToDatosJson(planilla)
  }
  store.planillas.unshift(localRecord as PlanillaCajaGuardada & { datos?: Record<string, unknown> })
  writeLocal(store)
  return record
}

export async function getPlanillaById(id: string): Promise<PlanillaCajaParsed | null> {
  if (await checkRemote()) {
    const { data, error } = await supabase!.from('control_caja_planillas').select('*').eq('id', id).maybeSingle()
    if (!error && data?.datos) {
      const parsed = datosJsonToPlanilla(data.datos as Record<string, unknown>, {
        archivo_nombre: String(data.archivo_nombre),
        caja_nombre: String(data.caja_nombre),
        fecha_desde: data.fecha_desde ? String(data.fecha_desde).slice(0, 10) : '',
        fecha_hasta: data.fecha_hasta ? String(data.fecha_hasta).slice(0, 10) : '',
        totales: (data.totales as PlanillaCajaParsed['totales']) ?? null
      })
      if (parsed) return parsed
    }
  }
  const local = readLocal().planillas.find((p) => p.id === id) as
    | (PlanillaCajaGuardada & { datos?: Record<string, unknown> })
    | undefined
  if (local?.datos) {
    return datosJsonToPlanilla(local.datos, {
      archivo_nombre: local.archivo_nombre,
      caja_nombre: local.caja_nombre,
      fecha_desde: local.fecha_desde,
      fecha_hasta: local.fecha_hasta,
      totales: local.totales as PlanillaCajaParsed['totales'] | null
    })
  }
  return null
}

export async function listPlanillas(limit = 10): Promise<PlanillaCajaGuardada[]> {
  const mapRow = (r: Record<string, unknown>): PlanillaCajaGuardada => {
    const datos = (r.datos as Record<string, unknown> | null) ?? null
    const ventas = Array.isArray(datos?.ventas)
      ? datos!.ventas.length
      : Number(datos?.cantidad_ventas) || 0
    const egresos =
      (Array.isArray(datos?.egresos) ? datos!.egresos.length : 0) +
      (Array.isArray(datos?.egresos_compras) ? datos!.egresos_compras.length : 0) +
      (Array.isArray(datos?.egresos_pagos_proveedores) ? datos!.egresos_pagos_proveedores.length : 0)
    const mec = Array.isArray(datos?.movimientos_mec) ? datos!.movimientos_mec.length : 0
    return {
      id: String(r.id),
      archivo_nombre: String(r.archivo_nombre),
      fecha_desde: r.fecha_desde ? String(r.fecha_desde).slice(0, 10) : '',
      fecha_hasta: r.fecha_hasta ? String(r.fecha_hasta).slice(0, 10) : '',
      caja_nombre: String(r.caja_nombre),
      caja_slug: r.caja_slug != null ? String(r.caja_slug) : null,
      totales: (r.totales as Record<string, number>) ?? null,
      resumen: {
        cantidad_ventas: ventas,
        cantidad_egresos: egresos,
        cantidad_mec: mec
      },
      id_usuario: r.id_usuario as number | null | undefined,
      usuario_nombre: r.usuario_nombre as string | null | undefined,
      created_at: r.created_at as string | undefined,
      datos
    }
  }

  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_planillas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error && data) {
      return data.map((r) => mapRow(r as Record<string, unknown>))
    }
  }
  return readLocal()
    .planillas.slice(0, limit)
    .map((p) => {
      const ext = p as PlanillaCajaGuardada & { datos?: Record<string, unknown> }
      return mapRow({
        ...ext,
        id: ext.id,
        datos: ext.datos ?? null
      } as Record<string, unknown>)
    })
}

// —— Cajas (maestros) ——

export async function listCajasAll(): Promise<CajaRegistro[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!.from('control_caja_cajas').select('*').order('nombre')
    if (!error && data?.length) {
      return data.map((r) => mapCajaRegistro(r))
    }
  }
  return readLocal().cajas.map((c) => mapCajaRegistro(c))
}

export async function saveCajasMaestro(cajas: CajaRegistro[]): Promise<void> {
  if (await checkRemote()) {
    for (const c of cajas) {
      await supabase!.from('control_caja_cajas').upsert({
        slug: c.slug,
        nombre: c.nombre,
        fondo_fijo: c.fondo_fijo,
        activa: c.activa,
        updated_at: new Date().toISOString()
      })
    }
    return
  }
  const store = readLocal()
  store.cajas = cajas
  writeLocal(store)
}

export async function getParams(): Promise<CajaParams> {
  return readLocal().params
}

export async function saveParams(params: CajaParams): Promise<void> {
  const store = readLocal()
  store.params = params
  writeLocal(store)
}

// —— Cierres ——

function mapCierreRow(r: Record<string, unknown>): CajaCierre {
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    caja_slug: String(r.caja_slug),
    turno: String(r.turno ?? 'Único'),
    cajera: r.cajera != null ? String(r.cajera) : null,
    email_ok: r.email_ok === 'Sí' || r.email_ok === 'No' ? r.email_ok : null,
    fondo_fijo: Number(r.fondo_fijo) || 0,
    ing_ef: Number(r.ing_ef) || 0,
    egr_ef: Number(r.egr_ef) || 0,
    ef_teorico: Number(r.ef_teorico) || 0,
    ef_contado: Number(r.ef_contado) || 0,
    dif_ef: Number(r.dif_ef) || 0,
    tarj_sist: Number(r.tarj_sist) || 0,
    tarj_fis: Number(r.tarj_fis) || 0,
    dif_tarj: Number(r.dif_tarj) || 0,
    mp_qr: Number(r.mp_qr) || 0,
    trans: Number(r.trans) || 0,
    cta_cte: Number(r.cta_cte) || 0,
    total_ventas: Number(r.total_ventas) || 0,
    dif_total: Number(r.dif_total) || 0,
    estado: r.estado === 'OK' ? 'OK' : 'REVISAR',
    estado_cierre:
      r.estado_cierre === 'cerrado' ||
      r.estado_cierre === 'observado' ||
      r.estado_cierre === 'anulado'
        ? r.estado_cierre
        : 'abierto',
    fecha_hasta: r.fecha_hasta != null ? String(r.fecha_hasta).slice(0, 10) : null,
    snapshot_totales:
      r.snapshot_totales != null && typeof r.snapshot_totales === 'object'
        ? (r.snapshot_totales as Record<string, unknown>)
        : null,
    observacion: r.observacion != null ? String(r.observacion) : null,
    id_planilla: r.id_planilla != null ? String(r.id_planilla) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined
  }
}

export async function listCierres(): Promise<CajaCierre[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_cierres')
      .select('*')
      .order('fecha', { ascending: false })
    if (!error && data) return data.map(mapCierreRow)
  }
  return [...readLocal().cierres].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function getCierre(id: string): Promise<CajaCierre | null> {
  const list = await listCierres()
  return list.find((c) => c.id === id) ?? null
}

export function cierresEnFecha(cierres: CajaCierre[], fecha: string): CajaCierre[] {
  return cierres.filter((c) => c.fecha === fecha)
}

export async function saveCierre(
  cierre: Omit<CajaCierre, 'id' | 'created_at'> & { id?: string }
): Promise<CajaCierre> {
  const id = cierre.id ?? newId()
  const record: CajaCierre = { ...cierre, id }

  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_cierres').upsert({
      id,
      fecha: cierre.fecha,
      caja_slug: cierre.caja_slug,
      turno: cierre.turno,
      cajera: cierre.cajera,
      email_ok: cierre.email_ok,
      fondo_fijo: cierre.fondo_fijo,
      ing_ef: cierre.ing_ef,
      egr_ef: cierre.egr_ef,
      ef_teorico: cierre.ef_teorico,
      ef_contado: cierre.ef_contado,
      dif_ef: cierre.dif_ef,
      tarj_sist: cierre.tarj_sist,
      tarj_fis: cierre.tarj_fis,
      dif_tarj: cierre.dif_tarj,
      mp_qr: cierre.mp_qr,
      trans: cierre.trans,
      cta_cte: cierre.cta_cte,
      total_ventas: cierre.total_ventas,
      dif_total: cierre.dif_total,
      estado: cierre.estado,
      estado_cierre: cierre.estado_cierre ?? 'abierto',
      fecha_hasta: cierre.fecha_hasta ?? cierre.fecha,
      snapshot_totales: cierre.snapshot_totales ?? null,
      observacion: cierre.observacion,
      id_planilla: cierre.id_planilla,
      updated_at: new Date().toISOString()
    })
    if (!error) return record
  }

  const store = readLocal()
  const idx = store.cierres.findIndex((c) => c.id === id)
  if (idx >= 0) store.cierres[idx] = record
  else store.cierres.push(record)
  writeLocal(store)
  return record
}

export async function vincularMovimientosAlCierre(
  cierreId: string,
  cajaSlug: string,
  fechaDesde: string,
  fechaHasta: string,
  movimientos: CajaMovimiento[]
): Promise<number> {
  const delPeriodo = movimientosEnPeriodoCaja(movimientos, cajaSlug, fechaDesde, fechaHasta)
  let vinculados = 0
  for (const m of delPeriodo) {
    if (m.cierre_id === cierreId) continue
    if (m.cierre_id) {
      const otro = await getCierre(m.cierre_id)
      if (otro && cierreCerrado(otro)) {
        throw new Error(
          `El movimiento ${m.nro_comprobante ?? m.id.slice(0, 8)} ya pertenece a otro cierre cerrado.`
        )
      }
    }
    await saveMovimiento({ ...m, cierre_id: cierreId })
    vinculados++
  }
  return vinculados
}

export async function desvincularMovimientosCierre(cierreId: string): Promise<void> {
  const movs = await listMovimientos()
  for (const m of movs.filter((x) => x.cierre_id === cierreId)) {
    await saveMovimiento({ ...m, cierre_id: null })
  }
}

export async function listMovimientosPorCierre(cierreId: string): Promise<CajaMovimiento[]> {
  const movs = await listMovimientos()
  return movs.filter((m) => m.cierre_id === cierreId)
}

export async function cerrarCierreDefinitivo(
  cierreId: string,
  movimientos: CajaMovimiento[],
  opts?: { observado?: boolean; tolerancia?: number }
): Promise<CajaCierre> {
  const c = await getCierre(cierreId)
  if (!c) throw new Error('Cierre no encontrado')
  if (cierreCerrado(c)) throw new Error('Este cierre ya está cerrado y no se puede modificar.')

  const hasta = c.fecha_hasta ?? c.fecha
  const totales = calcularTotalesCaja(movimientos, c.caja_slug, c.fecha, hasta)
  const calc = enrichCierreFromTotales(
    {
      fondo_fijo: c.fondo_fijo,
      ing_ef: c.ing_ef,
      egr_ef: c.egr_ef,
      ef_contado: c.ef_contado,
      tarj_sist: c.tarj_sist,
      tarj_fis: c.tarj_fis,
      mp_qr: c.mp_qr,
      trans: c.trans,
      cta_cte: c.cta_cte
    },
    totales,
    opts?.tolerancia ?? 0
  )

  const vinculados = await vincularMovimientosAlCierre(cierreId, c.caja_slug, c.fecha, hasta, movimientos)

  const payload = cierreFromCalculado(
    {
      fecha: c.fecha,
      caja_slug: c.caja_slug,
      turno: c.turno,
      cajera: c.cajera,
      email_ok: c.email_ok,
      observacion: c.observacion,
      id_planilla: c.id_planilla
    },
    calc
  )

  return saveCierre({
    ...payload,
    id: cierreId,
    fecha_hasta: hasta,
    estado_cierre: opts?.observado ? 'observado' : 'cerrado',
    snapshot_totales: snapshotTotalesCierre(c.caja_slug, c.fecha, hasta, movimientos, {
      movimientos_vinculados: vinculados
    })
  })
}

export async function deleteCierre(id: string): Promise<void> {
  await desvincularMovimientosCierre(id)
  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_cierres').delete().eq('id', id)
    if (!error) return
  }
  const store = readLocal()
  store.cierres = store.cierres.filter((c) => c.id !== id)
  writeLocal(store)
}

// —— Conciliaciones ——

export async function listConcilMP(): Promise<CajaConcilMP[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_concil_mp')
      .select('*')
      .order('fecha', { ascending: false })
    if (!error && data) {
      return data.map((r) => ({
        id: String(r.id),
        fecha: String(r.fecha).slice(0, 10),
        sistema: Number(r.sistema) || 0,
        dashboard: Number(r.dashboard) || 0,
        diferencia: Number(r.diferencia) || 0,
        estado: r.estado === 'OK' ? 'OK' : 'REVISAR',
        observacion: r.observacion,
        created_at: r.created_at
      }))
    }
  }
  return [...readLocal().concil_mp].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function saveConcilMP(
  row: Omit<CajaConcilMP, 'id' | 'created_at'> & { id?: string }
): Promise<CajaConcilMP> {
  const id = row.id ?? newId()
  const record: CajaConcilMP = { ...row, id }
  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_concil_mp').upsert(record)
    if (!error) return record
  }
  const store = readLocal()
  const idx = store.concil_mp.findIndex((c) => c.id === id)
  if (idx >= 0) store.concil_mp[idx] = record
  else store.concil_mp.push(record)
  writeLocal(store)
  return record
}

export async function listConcilBanco(): Promise<CajaConcilBanco[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_concil_banco')
      .select('*')
      .order('fecha', { ascending: false })
    if (!error && data) {
      return data.map((r) => ({
        id: String(r.id),
        fecha: String(r.fecha).slice(0, 10),
        sistema: Number(r.sistema) || 0,
        extracto: Number(r.extracto) || 0,
        diferencia: Number(r.diferencia) || 0,
        estado: r.estado === 'OK' ? 'OK' : 'REVISAR',
        observacion: r.observacion,
        created_at: r.created_at
      }))
    }
  }
  return [...readLocal().concil_banco].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function saveConcilBanco(
  row: Omit<CajaConcilBanco, 'id' | 'created_at'> & { id?: string }
): Promise<CajaConcilBanco> {
  const id = row.id ?? newId()
  const record: CajaConcilBanco = { ...row, id }
  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_concil_banco').upsert(record)
    if (!error) return record
  }
  const store = readLocal()
  const idx = store.concil_banco.findIndex((c) => c.id === id)
  if (idx >= 0) store.concil_banco[idx] = record
  else store.concil_banco.push(record)
  writeLocal(store)
  return record
}

// —— Diferencias ——

export async function listDiferencias(): Promise<CajaDiferencia[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_diferencias')
      .select('*')
      .order('fecha', { ascending: false })
    if (!error && data) {
      return data.map((r) => ({
        id: String(r.id),
        fecha: String(r.fecha).slice(0, 10),
        caja_slug: r.caja_slug,
        tipo: r.tipo === 'Sobrante' ? 'Sobrante' : 'Faltante',
        monto: Number(r.monto) || 0,
        motivo: r.motivo,
        responsable: r.responsable,
        estado: r.estado === 'Resuelto' ? 'Resuelto' : 'Pendiente',
        id_cierre: r.id_cierre
      }))
    }
  }
  return [...readLocal().diferencias].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function saveDiferencia(
  row: Omit<CajaDiferencia, 'created_at' | 'auto_desde_cierre'> & { id?: string }
): Promise<CajaDiferencia> {
  const id = row.id ?? newId()
  const record: CajaDiferencia = { ...row, id }
  if (await checkRemote()) {
    const { error } = await supabase!.from('control_caja_diferencias').upsert({
      id: record.id,
      fecha: record.fecha,
      caja_slug: record.caja_slug,
      tipo: record.tipo,
      monto: record.monto,
      motivo: record.motivo,
      responsable: record.responsable,
      estado: record.estado,
      id_cierre: record.id_cierre
    })
    if (!error) return record
  }
  const store = readLocal()
  const idx = store.diferencias.findIndex((d) => d.id === id)
  if (idx >= 0) store.diferencias[idx] = record
  else store.diferencias.push(record)
  writeLocal(store)
  return record
}
