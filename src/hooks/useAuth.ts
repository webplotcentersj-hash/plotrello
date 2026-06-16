import { useState, useEffect } from 'react'
import { operarioExternoHomeRoute } from '../features/work-pool/workPoolOperarioExterno'

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

function readStoredUsuario(): Usuario | null {
  if (typeof window === 'undefined') return null
  try {
    const usuarioStr = localStorage.getItem('usuario')
    if (!usuarioStr) return null
    return JSON.parse(usuarioStr) as Usuario
  } catch {
    return null
  }
}

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(readStoredUsuario)
  /** Con usuario en localStorage, mostrar la UI al instante y validar sesión en segundo plano. */
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    return readStoredUsuario() == null
  })

  useEffect(() => {
    const load = async () => {
      const usuarioStr = localStorage.getItem('usuario')
      const hasToken = Boolean(localStorage.getItem('auth_token'))

      if (usuarioStr && hasToken) {
        try {
          const { verifyStaffSession, clearStaffSession } = await import('../services/staffSession')
          const v = await verifyStaffSession()
          if (v.ok && v.usuario) {
            setUsuario(v.usuario as Usuario)
          } else if (!v.ok) {
            clearStaffSession()
          } else {
            setUsuario(JSON.parse(usuarioStr) as Usuario)
          }
        } catch (error) {
          console.error('Error al validar sesión staff:', error)
          localStorage.removeItem('usuario')
          localStorage.removeItem('auth_token')
        }
      } else if (usuarioStr) {
        try {
          const { isStaffJwtEnabledOnServer, clearStaffSession } = await import('../services/staffSession')
          const jwtOn = await isStaffJwtEnabledOnServer()
          if (jwtOn) {
            // Sesión vieja sin auth_token: forzar re-login cuando JWT está activo
            clearStaffSession()
          } else {
            setUsuario(JSON.parse(usuarioStr) as Usuario)
          }
        } catch (error) {
          console.error('Error al parsear usuario:', error)
          localStorage.removeItem('usuario')
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
  /** Mostrador (dashboard, /mostrador/*, CRM ventas): mismo acceso operativo para rol caja. */
  const canAccessMostradorViews =
    !!usuario && (isMostrador || isCaja || isPresupuestos || isAdmin)
  // Puede administrar impresoras: taller-grafico o administracion
  const canManageImpresoras = !!usuario && (usuario.rol === 'taller-grafico' || usuario.rol === 'administracion')
  // Puede gestionar compras: compras o administracion
  const canManageCompras = !!usuario && (usuario.rol === 'compras' || usuario.rol === 'administracion')
  /** Ver detalle de pedido de compra y recepción a stock (p. ej. desde ERP); gerencia incluida, sin dar acceso al dashboard clásico de compras. */
  const canViewPedidoCompraDetalle =
    !!usuario && (usuario.rol === 'compras' || usuario.rol === 'administracion' || isGerencia)
  // Puede gestionar caja: caja, administracion o gerencia (vista admin del módulo)
  const canManageCaja = !!usuario && (usuario.rol === 'caja' || isAdmin)
  // Puede gestionar instalaciones: instalaciones o administracion
  const canManageInstalaciones = !!usuario && (usuario.rol === 'instalaciones' || usuario.rol === 'administracion')
  // Puede gestionar taller de imprenta: imprenta o administracion
  const canManageTallerImprenta = !!usuario && (usuario.rol === 'imprenta' || usuario.rol === 'administracion')
  // Puede gestionar metalúrgica: metalurgica o administracion
  const canManageMetalurgica = !!usuario && (usuario.rol === 'metalurgica' || usuario.rol === 'administracion')
  // Puede gestionar recursos humanos: RRHH, administración o gerencia (admin ve todo RRHH)
  const canManageRecursosHumanos =
    !!usuario &&
    (usuario.rol === 'recursos-humanos' ||
      usuario.rol === 'administracion' ||
      usuario.rol === 'gerencia')
  // Puede gestionar asesor técnico: asesor-tecnico o administracion
  const canManageAsesorTecnico = !!usuario && (usuario.rol === 'asesor-tecnico' || usuario.rol === 'administracion')
  // Puede gestionar presupuestos: presupuestos o administracion (también asesor-tecnico por vinculación)
  const canManagePresupuestos = !!usuario && (usuario.rol === 'presupuestos' || usuario.rol === 'asesor-tecnico' || usuario.rol === 'administracion')
  // Atención al público: todos los sectores (cualquier usuario logueado)
  const canAccessAtencionPublico = !!usuario
  /** Cola / panel de solicitudes de impresión del tótem (listar + marcar impreso). Incluye admin (gerencia/administración) y taller gráfico. */
  const canAccessTotemImpresionPanel =
    !!usuario &&
    (isAdmin ||
      usuario.rol === 'imprenta' ||
      usuario.rol === 'mostrador' ||
      usuario.rol === 'caja' ||
      usuario.rol === 'taller-grafico')
  /** Marcar pago en caja (RPC acotada a caja / administración / gerencia). */
  const canMarcarPagoTotemImpresion = !!usuario && (usuario.rol === 'caja' || isAdmin)
  /** PlotBolsa modo admin: publicar, aprobar, dashboard y cuenta Plot (solo administración y presupuestos). */
  const canManageWorkPool =
    !!usuario && (usuario.rol === 'administracion' || usuario.rol === 'presupuestos')
  /** PlotBolsa modo operario: tomar trabajos y ver cuenta propia. */
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
    operarioExternoHome,
    loading,
    setUsuario
  }
}

