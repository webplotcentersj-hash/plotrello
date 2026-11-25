import { supabase } from '../services/supabaseClient'

export type AnularErpGastoResult = {
  ok: boolean
  id_gasto?: number
  id_factura_compra?: number | null
  libro_borrado?: boolean
  motivo?: string
  error?: string
}

function actorIdActual(): number | null {
  try {
    const raw = localStorage.getItem('usuario')
    if (!raw) return null
    const u = JSON.parse(raw) as { id?: number | string }
    const n = Number(u?.id)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Anula el gasto (soft), guarda motivo en movimientos y borra la factura del libro IVA si está trazada. */
export async function anularErpGasto(idGasto: number, motivo: string): Promise<AnularErpGastoResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' }
  const m = String(motivo || '').trim()
  if (!m) return { ok: false, error: 'Indicá el motivo de la anulación' }

  const { data, error } = await supabase.rpc('erp_gasto_anular', {
    p_actor_id: actorIdActual(),
    p_id_gasto: idGasto,
    p_motivo: m
  })

  if (error) {
    const msg = error.message || 'No se pudo anular el gasto'
    if (/schema cache|does not exist|PGRST20|42883/i.test(msg)) {
      return {
        ok: false,
        error: 'Falta ejecutar el patch 2026-11-25_erp_gastos_anular.sql en Supabase.'
      }
    }
    return { ok: false, error: msg }
  }

  const row = (data || {}) as AnularErpGastoResult
  return {
    ok: true,
    id_gasto: Number(row.id_gasto) || idGasto,
    id_factura_compra: row.id_factura_compra ?? null,
    libro_borrado: !!row.libro_borrado,
    motivo: row.motivo || m
  }
}
