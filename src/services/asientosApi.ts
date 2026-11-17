/**
 * Asientos del Libro Diario: lectura paginada (sin el tope de 1000 filas de PostgREST),
 * anulación de borradores y contraasientos. Las reglas las valida la base
 * (supabase/patches/2026-11-17_asientos_inalterables.sql).
 */
import apiService from './api'
import { supabase } from './supabaseClient'
import { contraasiento, type AsientoLD } from '../features/asientos/libroDiario'

export type Resp<T> = { success: true; data: T } | { success: false; error: string }

const PAGINA = 1000

function cliente() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

async function envolver<T>(fn: () => Promise<T>): Promise<Resp<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
    return { success: false, error: msg }
  }
}

function normalizar(a: AsientoLD): AsientoLD {
  return {
    ...a,
    total_debe: Number(a.total_debe) || 0,
    total_haber: Number(a.total_haber) || 0,
    detalles: (a.detalles ?? []).map((d) => ({ ...d, debe: Number(d.debe) || 0, haber: Number(d.haber) || 0 }))
  }
}

/** Asientos de un rango de fechas con sus líneas y cuentas. */
export function listarAsientos(desde: string, hasta: string) {
  return envolver(async () => {
    const out: AsientoLD[] = []
    for (let from = 0; from < 50000; from += PAGINA) {
      const { data, error } = await cliente()
        .from('asientos_contables')
        .select('*, detalles:asientos_detalle(id, id_cuenta, debe, haber, concepto, cuenta:plan_cuentas(id, codigo, nombre, activa))')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGINA - 1)
      if (error) throw error
      const lote = (data ?? []) as AsientoLD[]
      out.push(...lote.map(normalizar))
      if (lote.length < PAGINA) break
    }
    return out
  })
}

/** Índice liviano del ejercicio (sin líneas) para numerar el Libro Diario de forma correlativa. */
export function indiceEjercicio(desde: string, hasta: string) {
  return envolver(async () => {
    const out: AsientoLD[] = []
    for (let from = 0; from < 200000; from += PAGINA) {
      const { data, error } = await cliente()
        .from('asientos_contables')
        .select('id, numero_asiento, fecha, estado, concepto, tipo_asiento, total_debe, total_haber')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .eq('estado', 'Contabilizado')
        .order('id', { ascending: true })
        .range(from, from + PAGINA - 1)
      if (error) throw error
      const lote = (data ?? []) as AsientoLD[]
      out.push(...lote)
      if (lote.length < PAGINA) break
    }
    return out
  })
}

/** Un borrador nunca entró al Libro Diario: se anula (queda el número, no se borra). */
export function anularBorrador(id: number, motivo: string) {
  return envolver(async () => {
    const { data, error } = await cliente()
      .from('asientos_contables')
      .update({ estado: 'Anulado', observaciones: `Anulado: ${motivo.trim()}`, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('estado', 'Borrador')
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Solo se pueden anular asientos en borrador.')
    return true
  })
}

export async function contabilizar(id: number): Promise<Resp<true>> {
  const r = await apiService.contabilizarAsiento(id)
  return r.success ? { success: true, data: true } : { success: false, error: r.error || 'No se pudo contabilizar' }
}

/** Crea el contraasiento en borrador (después se revisa y se contabiliza). */
export async function crearContraasiento(original: AsientoLD, fecha: string, motivo: string): Promise<Resp<number>> {
  const payload = contraasiento(original, fecha, motivo)
  const r = await apiService.crearAsientoContable(payload)
  return r.success && r.data ? { success: true, data: r.data.id } : { success: false, error: r.error || 'No se pudo crear el contraasiento' }
}
