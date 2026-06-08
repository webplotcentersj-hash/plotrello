import { supabase } from '../../services/supabaseClient'
import { apiService } from '../../services/api'

/** Notifica a administración y gerencia (caja). */
export async function notifyAdminsCaja(opts: {
  titulo: string
  descripcion: string
  tipo?: 'info' | 'success' | 'warning'
  excluirUsuarioId?: number
}): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase.rpc('usuarios_ids_por_roles', {
    p_roles: ['administracion', 'gerencia']
  })

  if (error || !data?.length) return

  const ids = (data as { id: number }[])
    .map((u) => u.id)
    .filter((id) => id !== opts.excluirUsuarioId)

  await Promise.all(
    ids.map((user_id: number) =>
      apiService.createNotification({
        user_id,
        title: opts.titulo,
        description: opts.descripcion,
        type: opts.tipo ?? 'info'
      })
    )
  )
}
