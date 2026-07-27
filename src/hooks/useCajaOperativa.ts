import { useCallback, useEffect, useState } from 'react'
import {
  obtenerCajaOperativa,
  resolveCajaOperativaSlug,
  type CajaOperativa
} from '../features/control-cajas/cajaOperativa'
import { useAuth } from './useAuth'

type State = {
  loading: boolean
  caja: CajaOperativa | null
  error: string | null
}

/**
 * Caja del usuario mostrador/caja. Una sola fuente para arqueo, cierre, ventas, etc.
 * Si `enabled: true` (p. ej. arqueo con caja fijada), resuelve por id aunque el rol
 * principal sea administración (cajeros con rol admin + caja propia).
 */
export function useCajaOperativa(opts?: { enabled?: boolean }) {
  const { usuario, nombreVisible, isCajaOperativa, loading: authLoading } = useAuth()
  const enabledExplicit = opts?.enabled === true
  const enabled =
    usuario?.id != null &&
    (enabledExplicit || (opts?.enabled !== false && isCajaOperativa))

  const [state, setState] = useState<State>({
    loading: enabled,
    caja: null,
    error: null
  })

  const refresh = useCallback(async () => {
    if (!enabled || !usuario?.id) {
      setState({ loading: false, caja: null, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const caja = await obtenerCajaOperativa(usuario.id, nombreVisible || usuario.nombre)
      setState({ loading: false, caja, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar tu caja'
      setState({
        loading: false,
        caja: {
          slug: resolveCajaOperativaSlug(usuario.id),
          nombre: `Caja ${nombreVisible || usuario.nombre}`,
          registro: {
            slug: resolveCajaOperativaSlug(usuario.id),
            nombre: `Caja ${nombreVisible || usuario.nombre}`,
            fondo_fijo: 0,
            activa: true,
            id_usuario: usuario.id
          }
        },
        error: msg
      })
    }
  }, [enabled, usuario?.id, usuario?.nombre, nombreVisible])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  return {
    loading: authLoading || state.loading,
    slug: state.caja?.slug ?? null,
    nombre: state.caja?.nombre ?? null,
    registro: state.caja?.registro ?? null,
    caja: state.caja,
    error: state.error,
    refresh,
    enabled
  }
}
