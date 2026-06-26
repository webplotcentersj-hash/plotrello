import { fetchNombreLegajoUsuario } from '../../utils/usuarioDisplayName'
import { supabase } from '../../services/supabaseClient'

export async function fetchNombreDisplayUsuario(usuarioId: number): Promise<string | null> {
  return fetchNombreLegajoUsuario(usuarioId)
}

export async function usuarioCajaActivo(usuarioId: number): Promise<boolean> {
  if (!supabase) return true
  try {
    const { data } = await supabase
      .from('usuarios')
      .select('activo')
      .eq('id', usuarioId)
      .maybeSingle()
    return data?.activo !== false
  } catch {
    return true
  }
}
