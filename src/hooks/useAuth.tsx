import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { isOperarioExternoRol, operarioExternoHomeRoute } from '../features/work-pool/workPoolOperarioExterno'
import {
  getSessionKind,
  PLOTLAB_SESSION_KIND_KEY,
  readOperarioExternoUsuario,
  readStaffUsuario,
  readStoredUsuario as readStoredUsuarioRaw,
  type PlotlabSessionKind
} from '../utils/plotlabSession'

export type Usuario = {
  id: number
  nombre: string
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
  setUsuario: (usuario: Usuario | null) => void
  loading: boolean
  isAdmin: boolean
  isMostrador: boolean
  isCaja: boolean
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(resolveUsuarioForContext)
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    return resolveUsuarioForContext() == null
  })

  useEffect(() => {
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

  const value = useMemo((): AuthContextValue => {
    const adminRoles: Usuario['rol'][] = ['administracion', 'gerencia']
    const isAdmin = !!usuario && adminRoles.includes(usuario.rol)
    const isGerencia = usuario?.rol === 'gerencia'
    const isMostrador = usuario?.rol === 'mostrador'
    const isCaja = usuario?.rol === 'caja'
    const isTallerGrafico = usuario?.rol === 'taller-grafico'
    const isInstalaciones = usuario?.rol === 'instalaciones'
    const isCompras = usuario?.rol === 'compras'
    const isDiseno = usuario?.rol === 'diseno'
    const isTallerImprenta = usuario?.rol === 'imprenta'
    const isMetalurgica = usuario?.rol === 'metalurgica'
    const isRecursosHumanos = usuario?.rol === 'recursos-humanos'
    const isAsesorTecnico = usuario?.rol === 'asesor-tecnico'
    const isPresupuestos = usuario?.rol === 'presupuestos'
    const canAccessMostradorViews =
      !!usuario && (isMostrador || isCaja || isPresupuestos || isAdmin)
    const canManageImpresoras =
      !!usuario && (usuario.rol === 'taller-grafico' || usuario.rol === 'administracion')
    const canManageCompras =
      !!usuario && (usuario.rol === 'compras' || usuario.rol === 'administracion')
    const canViewPedidoCompraDetalle =
      !!usuario && (usuario.rol === 'compras' || usuario.rol === 'administracion' || isGerencia)
    const canManageCaja = !!usuario && (usuario.rol === 'caja' || isAdmin)
    const canManageInstalaciones =
      !!usuario && (usuario.rol === 'instalaciones' || usuario.rol === 'administracion')
    const canManageTallerImprenta =
      !!usuario && (usuario.rol === 'imprenta' || usuario.rol === 'administracion')
    const canManageMetalurgica =
      !!usuario && (usuario.rol === 'metalurgica' || usuario.rol === 'administracion')
    const canManageRecursosHumanos =
      !!usuario &&
      (usuario.rol === 'recursos-humanos' ||
        usuario.rol === 'administracion' ||
        usuario.rol === 'gerencia')
    const canManageAsesorTecnico =
      !!usuario && (usuario.rol === 'asesor-tecnico' || usuario.rol === 'administracion')
    const canManagePresupuestos =
      !!usuario &&
      (usuario.rol === 'presupuestos' ||
        usuario.rol === 'asesor-tecnico' ||
        usuario.rol === 'administracion')
    const canAccessAtencionPublico = !!usuario
    const canAccessTotemImpresionPanel =
      !!usuario &&
      (isAdmin ||
        usuario.rol === 'imprenta' ||
        usuario.rol === 'mostrador' ||
        usuario.rol === 'caja' ||
        usuario.rol === 'taller-grafico')
    const canMarcarPagoTotemImpresion = !!usuario && (usuario.rol === 'caja' || isAdmin)
    const canManageWorkPool =
      !!usuario && (usuario.rol === 'administracion' || usuario.rol === 'presupuestos')
    const isOperarioExternoDiseno = usuario?.rol === 'operario-diseno'
    const isOperarioExternoBolsa = usuario?.rol === 'operario-bolsa'
    const isOperarioExterno = isOperarioExternoDiseno || isOperarioExternoBolsa
    const isWorkPoolOperario =
      !!usuario &&
      (usuario.rol === 'diseno' ||
        usuario.rol === 'instalaciones' ||
        usuario.rol === 'metalurgica' ||
        isOperarioExterno)
    const canAccessPlotDesign =
      canManageWorkPool || usuario?.rol === 'diseno' || isOperarioExternoDiseno
    const canAccessBolsaPlot =
      canManageWorkPool ||
      usuario?.rol === 'instalaciones' ||
      usuario?.rol === 'metalurgica' ||
      isOperarioExternoBolsa
    const operarioExternoHome = operarioExternoHomeRoute(usuario?.rol)

    return {
      usuario,
      setUsuario,
      loading,
      isAdmin,
      isMostrador,
      isCaja,
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
