import { useEffect, useState } from 'react'
import { subscribeSyncQueue, syncQueuePendingOrdenIds } from '../utils/syncQueue'

/** Set de ordenId con movimiento en cola (badges en fichas). */
export function usePendingTableroSync(): Set<number> {
  const [ids, setIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void syncQueuePendingOrdenIds()
        .then((list) => {
          if (alive) setIds(new Set(list))
        })
        .catch(() => {
          if (alive) setIds(new Set())
        })
    }
    refresh()
    const unsub = subscribeSyncQueue(refresh)
    return () => {
      alive = false
      unsub()
    }
  }, [])

  return ids
}
