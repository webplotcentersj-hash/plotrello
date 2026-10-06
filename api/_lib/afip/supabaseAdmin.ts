import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key)
}

export async function loadAfipConfigResumen(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_configuracion_afip_resumen')
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') {
    throw new Error('No hay configuración AFIP activa en la base de datos')
  }
  return data as Record<string, unknown>
}
