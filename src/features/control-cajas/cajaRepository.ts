import { supabase } from '../../services/supabaseClient'
import { DEFAULT_CAJAS, DEFAULT_PARAMS, LS_KEY } from './constants'
import { getPlotlabLoginKeys, getStoredCajaSlug } from './cajaUsuarioDisplay'
import { newId } from './format'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import type {
  CajaArqueo,
  CajaCajera,
  CajaCierre,
  CajaConcilBanco,
  CajaConcilMP,
  CajaDiferencia,
  CajaMovimiento,
  CajaParams,
  CajaRegistro,
  PlanillaCajaGuardada
} from './types'

type LocalStore = {
  cajas: CajaRegistro[]
  arqueos: CajaArqueo[]
  movimientos: CajaMovimiento[]
  planillas: PlanillaCajaGuardada[]
  cierres: CajaCierre[]
  concil_mp: CajaConcilMP[]
  concil_banco: CajaConcilBanco[]
  diferencias: CajaDiferencia[]
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
        movimientos: parsed.movimientos ?? [],
        planillas: parsed.planillas ?? [],
        cierres: parsed.cierres ?? [],
        concil_mp: parsed.concil_mp ?? [],
        concil_banco: parsed.concil_banco ?? [],
        diferencias: parsed.diferencias ?? [],
        params: parsed.params ?? { ...DEFAULT_PARAMS }
      }
    }
  } catch {
    /* noop */
  }
  return {
    cajas: [...DEFAULT_CAJAS],
    arqueos: [],
    movimientos: [],
    planillas: [],
    cierres: [],
    concil_mp: [],
    concil_banco: [],
    diferencias: [],
    params: { ...DEFAULT_PARAMS, cajeras: [...DEFAULT_PARAMS.cajeras] }
  }
}

function writeLocal(data: LocalStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export async function listCajas(): Promise<CajaRegistro[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_cajas')
      .select('slug, nombre, fondo_fijo, activa')
      .order('nombre')
    if (!error && data?.length) {
      return data.map((r) => ({
        slug: r.slug,
        nombre: r.nombre,
        fondo_fijo: Number(r.fondo_fijo) || 0,
        activa: !!r.activa
      }))
    }
  }
  return readLocal().cajas.filter((c) => c.activa)
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

function mapArqueoRow(r: Record<string, unknown>): CajaArqueo {
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    caja_slug: String(r.caja_slug),
    turno: String(r.turno ?? 'Único'),
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nombre: r.usuario_nombre != null ? String(r.usuario_nombre) : null,
    billetes: (r.billetes as Record<string, number>) ?? {},
    total: Number(r.total) || 0,
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

function mapMovRow(r: Record<string, unknown>): CajaMovimiento {
  return {
    id: String(r.id),
    fecha: String(r.fecha).slice(0, 10),
    hora: r.hora != null ? String(r.hora).slice(0, 5) : null,
    concepto: String(r.concepto),
    origen_slug: String(r.origen_slug),
    destino_slug: String(r.destino_slug),
    efectivo: Number(r.efectivo) || 0,
    otros: Number(r.otros) || 0,
    nro_comprobante: r.nro_comprobante != null ? String(r.nro_comprobante) : null,
    observacion: r.observacion != null ? String(r.observacion) : null,
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nombre: r.usuario_nombre != null ? String(r.usuario_nombre) : null,
    origen_importacion: r.origen_importacion === 'excel' ? 'excel' : 'manual',
    created_at: r.created_at != null ? String(r.created_at) : undefined
  }
}

export async function saveMovimiento(
  mov: Omit<CajaMovimiento, 'id' | 'created_at'> & { id?: string }
): Promise<CajaMovimiento> {
  const id = mov.id ?? newId()
  const record: CajaMovimiento = { ...mov, id, origen_importacion: mov.origen_importacion ?? 'manual' }

  if (await checkRemote()) {
    const row = {
      id,
      fecha: mov.fecha,
      hora: mov.hora || null,
      concepto: mov.concepto,
      origen_slug: mov.origen_slug,
      destino_slug: mov.destino_slug,
      efectivo: mov.efectivo,
      otros: mov.otros,
      nro_comprobante: mov.nro_comprobante ?? null,
      observacion: mov.observacion ?? null,
      id_usuario: mov.id_usuario ?? null,
      usuario_nombre: mov.usuario_nombre ?? null,
      origen_importacion: record.origen_importacion
    }
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
        origen_importacion: 'excel'
      })
    )
  }
  return saved
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
      datos: {
        ventas_count: planilla.ventas.length,
        egresos_count: planilla.egresos.length,
        mec: planilla.movimientos_mec
      },
      id_usuario: usuarioId ?? null,
      usuario_nombre: usuarioNombre
    }
    const { error } = await supabase!.from('control_caja_planillas').insert(row)
    if (!error) return record
  }

  const store = readLocal()
  store.planillas.unshift(record)
  writeLocal(store)
  return record
}

export async function listPlanillas(limit = 10): Promise<PlanillaCajaGuardada[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!
      .from('control_caja_planillas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error && data) {
      return data.map((r) => ({
        id: String(r.id),
        archivo_nombre: String(r.archivo_nombre),
        fecha_desde: r.fecha_desde ? String(r.fecha_desde).slice(0, 10) : '',
        fecha_hasta: r.fecha_hasta ? String(r.fecha_hasta).slice(0, 10) : '',
        caja_nombre: String(r.caja_nombre),
        caja_slug: r.caja_slug != null ? String(r.caja_slug) : null,
        totales: (r.totales as Record<string, number>) ?? null,
        resumen: {
          cantidad_ventas: Number((r.datos as { ventas_count?: number })?.ventas_count) || 0,
          cantidad_egresos: Number((r.datos as { egresos_count?: number })?.egresos_count) || 0,
          cantidad_mec: Array.isArray((r.datos as { mec?: unknown })?.mec)
            ? (r.datos as { mec: unknown[] }).mec.length
            : 0
        },
        id_usuario: r.id_usuario,
        usuario_nombre: r.usuario_nombre,
        created_at: r.created_at
      }))
    }
  }
  return readLocal().planillas.slice(0, limit)
}

// —— Cajas (maestros) ——

export async function listCajasAll(): Promise<CajaRegistro[]> {
  if (await checkRemote()) {
    const { data, error } = await supabase!.from('control_caja_cajas').select('*').order('nombre')
    if (!error && data?.length) {
      return data.map((r) => ({
        slug: r.slug,
        nombre: r.nombre,
        fondo_fijo: Number(r.fondo_fijo) || 0,
        activa: !!r.activa
      }))
    }
  }
  return [...readLocal().cajas]
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
    observacion: r.observacion != null ? String(r.observacion) : null,
    id_planilla: r.id_planilla != null ? String(r.id_planilla) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined
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
      observacion: cierre.observacion,
      id_planilla: cierre.id_planilla
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

export async function deleteCierre(id: string): Promise<void> {
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
