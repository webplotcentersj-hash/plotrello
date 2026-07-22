import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { isOperarioExternoRol, operarioExternoHomeRoute } from '../features/work-pool/workPoolOperarioExterno'
import { esUsuarioCajaOperativa } from '../utils/ventasCajaScope'
import {
  enrichUsuarioConNombreLegajo,
  nombreVisibleUsuario,
  persistUsuarioNombreVisible
} from '../utils/usuarioDisplayName'
import { usuarioTieneAlgunRol, usuarioTieneRol } from '../utils/usuarioRolesExtra'
import {
  getSessionKind,
  PLOTLAB_SESSION_KIND_KEY,
  PLOTLAB_USUARIO_STORAGE_KEY,
  readOperarioExternoUsuario,
  readStaffUsuario,
  readStoredUsuario as readStoredUsuarioRaw,
  type PlotlabSessionKind
} from '../utils/plotlabSession'

export type Usuario = {
  id: number
  /** Login / identificador (suele ser email). No usar para mostrar en UI. */
  nombre: string
  /** Nombre y apellido del legajo para mostrar en toda la app. */
  nombreVisible?: string
  rol:
    | 'administracion'
    | 'gerencia'
    | 'recursos-humanos'
    | 'diseno'
    | 'imprenta'
    | 'taller-grafico'
    | 'instalaciones'
    | 'metalurgica'
    | 'caja'
    | 'mostrador'
    | 'compras'
    | 'asesor-tecnico'
    | 'presupuestos'
    | 'operario-diseno'
    | 'operario-bolsa'
}

export function readStoredUsuario(): Usuario | null {
  return readStoredUsuarioRaw()
}

function resolveUsuarioForContext(): Usuario | null {
  const kind = getSessionKind()
  if (kind === 'operario_externo') return readOperarioExternoUsuario()
  if (kind === 'staff') return readStaffUsuario()
  const raw = readStoredUsuarioRaw()
  if (!raw) return null
  const inferred: PlotlabSessionKind = isOperarioExternoRol(raw.rol)
    ? 'operario_externo'
    : 'staff'
  try {
    localStorage.setItem(PLOTLAB_SESSION_KIND_KEY, inferred)
  } catch {
    /* ignore */
  }
  return inferred === 'operario_externo' ? readOperarioExternoUsuario() : readStaffUsuario()
}

type AuthContextValue = {
  usuario: Usuario | null
  /** Nombre del legajo para UI (nunca el email de login). */
  nombreVisible: string
  setUsuario: (usuario: Usuario | null) => void
  loading: boolean
  isAdmin: boolean
  isMostrador: boolean
  isCaja: boolean
  /** Mostrador y caja comparten operación diaria (ventas, arqueos, cierres propios). */
  isCajaOperativa: boolean
  isTallerGrafico: boolean
  isInstalaciones: boolean
  isCompras: boolean
  isDiseno: boolean
  isTallerImprenta: boolean
  isMetalurgica: boolean
  isRecursosHumanos: boolean
  isAsesorTecnico: boolean
  isPresupuestos: boolean
  canManageImpresoras: boolean
  canManageCompras: boolean
  isGerencia: boolean
  canViewPedidoCompraDetalle: boolean
  canManageCaja: boolean
  canManageInstalaciones: boolean
  canManageTallerImprenta: boolean
  canManageMetalurgica: boolean
  canManageRecursosHumanos: boolean
  canManageAsesorTecnico: boolean
  canManagePresupuestos: boolean
  canAccessAtencionPublico: boolean
  canAccessTotemImpresionPanel: boolean
  canMarcarPagoTotemImpresion: boolean
  canAccessMostradorViews: boolean
  canManageWorkPool: boolean
  isWorkPoolOperario: boolean
  canAccessPlotDesign: boolean
  canAccessBolsaPlot: boolean
  isOperarioExterno: boolean
  isOperarioExternoDiseno: boolean
  isOperarioExternoBolsa: boolean
  operarioExternoHome: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isEmbedPublicRoute(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/embed/')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(resolveUsuarioForContext)
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    if (isEmbedPublicRoute()) return false
    return resolveUsuarioForContext() == null
  })

  useEffect(() => {
    if (isEmbedPublicRoute()) {
      setLoading(false)
      return
    }

    const load = async () => {
      const sessionUsuario = resolveUsuarioForContext()
      const usuarioStr = sessionUsuario ? JSON.stringify(sessionUsuario) : null
      const hasToken = Boolean(localStorage.getItem('auth_token'))

      if (usuarioStr && hasToken) {
        try {
          const { verifyStaffSession, clearStaffSession } = await import('../services/staffSession')
          const v = await verifyStaffSession()
          if (v.ok && v.usuario) {
            const refreshed = resolveUsuarioForContext() ?? (v.usuario as Usuario)
            setUsuario(refreshed)
          } else if (!v.ok) {
            clearStaffSession()
            setUsuario(null)
          } else {
            setUsuario(sessionUsuario)
          }
        } catch (error) {
          console.error('Error al validar sesión staff:', error)
          const { clearStaffSession } = await import('../services/staffSession')
          clearStaffSession()
          setUsuario(null)
        }
      } else if (usuarioStr) {
        try {
          const { isStaffJwtEnabledOnServer, clearStaffSession } = await import('../services/staffSession')
          const jwtOn = await isStaffJwtEnabledOnServer()
          if (jwtOn) {
            clearStaffSession()
            setUsuario(null)
          } else {
            setUsuario(sessionUsuario)
          }
        } catch (error) {
          console.error('Error al parsear usuario:', error)
          const { clearStaffSession } = await import('../services/staffSession')
          clearStaffSession()
          setUsuario(null)
        }
      } else if (import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_AUTH === '1') {
        const mockUsuario: Usuario = {
          id: 1,
          nombre: 'Usuario Dev',
          rol: 'administracion'
        }
        setUsuario(mockUsuario)
        console.warn('⚠️ VITE_DEV_MOCK_AUTH=1: usuario mock de administración')
      }
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    if (!usuario || loading) return
    void import('../features/control-cajas/cajaOperativa').then(({ prepararCajaOperativaEnLogin }) =>
      prepararCajaOperativaEnLogin(
        usuario.id,
        nombreVisibleUsuario(usuario),
        usuario.rol
      )
    )
  }, [usuario?.id, usuario?.nombre, usuario?.nombreVisible, usuario?.rol, loading])

  useEffect(() => {
    if (!usuario?.id || usuario.nombreVisible) return
    let cancelled = false
    void enrichUsuarioConNombreLegajo(usuario).then((enriched) => {
      if (cancelled || !enriched.nombreVisible) return
      setUsuario(enriched)
      persistUsuarioNombreVisible(enriched)
    })
    return () => {
      cancelled = true
    }
  }, [usuario?.id, usuario?.nombreVisible])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      if (
        event.key !== PLOTLAB_USUARIO_STORAGE_KEY &&
        event.key !== 'auth_token' &&
        event.key !== PLOTLAB_SESSION_KIND_KEY
      ) {
        return
      }
      setUsuario(resolveUsuarioForContext())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo((): AuthContextValue => {
    const adminRoles: Usuario['rol'][] = ['administracion', 'gerencia']
    const isAdmin = !!usuario && adminRoles.includes(usuario.rol)
    const isGerencia = usuarioTieneRol(usuario, 'gerencia')
    const isMostrador = usuarioTieneRol(usuario, 'mostrador')
    const isCaja = usuarioTieneRol(usuario, 'caja')
    const isCajaOperativa =
      !!usuario && (esUsuarioCajaOperativa(usuario.rol) || isMostrador || isCaja)
    const isTallerGrafico = usuarioTieneRol(usuario, 'taller-grafico')
    const isInstalaciones = usuarioTieneRol(usuario, 'instalaciones')
    const isCompras = usuarioTieneRol(usuario, 'compras')
    const isDiseno = usuarioTieneRol(usuario, 'diseno')
    const isTallerImprenta = usuarioTieneRol(usuario, 'imprenta')
    const isMetalurgica = usuarioTieneRol(usuario, 'metalurgica')
    const isRecursosHumanos = usuarioTieneRol(usuario, 'recursos-humanos')
    const isAsesorTecnico = usuarioTieneRol(usuario, 'asesor-tecnico')
    const isPresupuestos = usuarioTieneRol(usuario, 'presupuestos')
    const canAccessMostradorViews =
      !!usuario && (isCajaOperativa || isPresupuestos || isAdmin)
    const canManageImpresoras =
      !!usuario && (usuarioTieneRol(usuario, 'taller-grafico') || isAdmin)
    const canManageCompras =
      !!usuario && (usuarioTieneRol(usuario, 'compras') || isAdmin)
    const canViewPedidoCompraDetalle =
      !!usuario && (usuarioTieneRol(usuario, 'compras') || isAdmin || isGerencia)
    const canManageCaja = !!usuario && (isCajaOperativa || isAdmin)
    const canManageInstalaciones =
      !!usuario && (usuarioTieneRol(usuario, 'instalaciones') || isAdmin)
    const canManageTallerImprenta =
      !!usuario && (usuarioTieneRol(usuario, 'imprenta') || isAdmin)
    const canManageMetalurgica =
      !!usuario && (usuarioTieneRol(usuario, 'metalurgica') || isAdmin)
    const canManageRecursosHumanos =
      !!usuario &&
      (usuarioTieneRol(usuario, 'recursos-humanos') || isAdmin || isGerencia)
    const canManageAsesorTecnico =
      !!usuario && (usuarioTieneRol(usuario, 'asesor-tecnico') || isAdmin)
    const canManagePresupuestos =
      !!usuario &&
      (usuarioTieneRol(usuario, 'presupuestos') ||
        usuarioTieneRol(usuario, 'asesor-tecnico') ||
        isAdmin)
    const canAccessAtencionPublico = !!usuario
    const canAccessTotemImpresionPanel =
      !!usuario &&
      (isAdmin ||
        usuarioTieneAlgunRol(usuario, ['imprenta', 'mostrador', 'caja', 'taller-grafico']))
    const canMarcarPagoTotemImpresion = !!usuario && (isCajaOperativa || isAdmin)
    const canManageWorkPool =
      !!usuario && (isAdmin || usuarioTieneRol(usuario, 'presupuestos'))
    const isOperarioExternoDiseno = usuarioTieneRol(usuario, 'operario-diseno')
    const isOperarioExternoBolsa = usuarioTieneRol(usuario, 'operario-bolsa')
    const isOperarioExterno = isOperarioExternoDiseno || isOperarioExternoBolsa
    const isWorkPoolOperario =
      !!usuario &&
      (usuarioTieneAlgunRol(usuario, ['diseno', 'instalaciones', 'metalurgica']) ||
        isOperarioExterno)
    const canAccessPlotDesign =
      canManageWorkPool || usuarioTieneRol(usuario, 'diseno') || isOperarioExternoDiseno
    const canAccessBolsaPlot =
      canManageWorkPool ||
      usuarioTieneRol(usuario, 'instalaciones') ||
      usuarioTieneRol(usuario, 'metalurgica') ||
      isOperarioExternoBolsa
    const operarioExternoHome = operarioExternoHomeRoute(usuario?.rol)

    return {
      usuario,
      nombreVisible: nombreVisibleUsuario(usuario),
      setUsuario,
      loading,
      isAdmin,
      isMostrador,
      isCaja,
      isCajaOperativa,
      isTallerGrafico,
      isInstalaciones,
      isCompras,
      isDiseno,
      isTallerImprenta,
      isMetalurgica,
      isRecursosHumanos,
      isAsesorTecnico,
      isPresupuestos,
      canManageImpresoras,
      canManageCompras,
      isGerencia,
      canViewPedidoCompraDetalle,
      canManageCaja,
      canManageInstalaciones,
      canManageTallerImprenta,
      canManageMetalurgica,
      canManageRecursosHumanos,
      canManageAsesorTecnico,
      canManagePresupuestos,
      canAccessAtencionPublico,
      canAccessTotemImpresionPanel,
      canMarcarPagoTotemImpresion,
      canAccessMostradorViews,
      canManageWorkPool,
      isWorkPoolOperario,
      canAccessPlotDesign,
      canAccessBolsaPlot,
      isOperarioExterno,
      isOperarioExternoDiseno,
      isOperarioExternoBolsa,
      operarioExternoHome
    }
  }, [usuario, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
