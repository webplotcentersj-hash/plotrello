import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode
} from 'react'
import {
  loadLegajoDisplayRegistry,
  resolveDisplayNombre,
  resolveOperarioAsignadoLabel
} from '../utils/legajoDisplayRegistry'

type Ctx = {
  displayNombre: (raw?: string | null, id?: number | null) => string
  displayOperario: (
    value?: string | null,
    teamMembers?: Array<{ id: string; name: string }>
  ) => string
}

const UsuariosDisplayContext = createContext<Ctx | null>(null)

export function UsuariosDisplayProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      void loadLegajoDisplayRegistry()
    }
    const ric =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(run, { timeout: 12_000 })
        : null
    const tid = ric == null ? window.setTimeout(run, 3000) : null
    return () => {
      cancelled = true
      if (ric != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(ric as number)
      if (tid != null) window.clearTimeout(tid)
    }
  }, [])

  const value = useMemo(
    (): Ctx => ({
      displayNombre: resolveDisplayNombre,
      displayOperario: resolveOperarioAsignadoLabel
    }),
    []
  )

  return (
    <UsuariosDisplayContext.Provider value={value}>{children}</UsuariosDisplayContext.Provider>
  )
}

export function useUsuariosDisplay(): Ctx {
  const ctx = useContext(UsuariosDisplayContext)
  if (!ctx) {
    return {
      displayNombre: resolveDisplayNombre,
      displayOperario: resolveOperarioAsignadoLabel
    }
  }
  return ctx
}

/** @deprecated Ya no fuerza re-render global; el registro se carga en idle. */
export function useUsuariosDisplayBootstrap(): void {
  useUsuariosDisplay()
}
