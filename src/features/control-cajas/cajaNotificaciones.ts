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

  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .in('rol', ['administracion', 'gerencia'])

  if (error || !data?.length) return

  const ids = data
    .map((u: { id: number }) => u.id)
    .filter((id: number) => id !== opts.excluirUsuarioId)

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
