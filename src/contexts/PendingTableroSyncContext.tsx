import { createContext, useContext, type ReactNode } from 'react'
import { usePendingTableroSync } from '../hooks/usePendingTableroSync'

const PendingTableroSyncContext = createContext<Set<number>>(new Set())

export function PendingTableroSyncProvider({ children }: { children: ReactNode }) {
  const ids = usePendingTableroSync()
  return (
    <PendingTableroSyncContext.Provider value={ids}>{children}</PendingTableroSyncContext.Provider>
  )
}

export function useIsOrdenPendingSync(ordenId: number | null | undefined): boolean {
  const ids = useContext(PendingTableroSyncContext)
  if (!ordenId || !Number.isFinite(ordenId)) return false
  return ids.has(ordenId)
}
