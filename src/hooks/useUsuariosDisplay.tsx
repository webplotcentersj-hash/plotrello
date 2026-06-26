import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  loadLegajoDisplayRegistry,
  resolveDisplayNombre,
  resolveOperarioAsignadoLabel
} from '../utils/legajoDisplayRegistry'

type Ctx = {
  ready: boolean
  displayNombre: (raw?: string | null, id?: number | null) => string
  displayOperario: (
    value?: string | null,
    teamMembers?: Array<{ id: string; name: string }>
  ) => string
}

const UsuariosDisplayContext = createContext<Ctx | null>(null)

export function UsuariosDisplayProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadLegajoDisplayRegistry().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    (): Ctx => ({
      ready,
      displayNombre: resolveDisplayNombre,
      displayOperario: resolveOperarioAsignadoLabel
    }),
    [ready]
  )

  return (
    <UsuariosDisplayContext.Provider value={value}>{children}</UsuariosDisplayContext.Provider>
  )
}

export function useUsuariosDisplay(): Ctx {
  const ctx = useContext(UsuariosDisplayContext)
  if (!ctx) {
    return {
      ready: false,
      displayNombre: resolveDisplayNombre,
      displayOperario: resolveOperarioAsignadoLabel
    }
  }
  return ctx
}

/** Suscripción al registro: re-renderiza la app cuando cargan los legajos. */
export function useUsuariosDisplayBootstrap(): void {
  useUsuariosDisplay()
}
