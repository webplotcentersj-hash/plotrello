import { useState, useEffect } from 'react'

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
}

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar usuario desde localStorage
    const usuarioStr = localStorage.getItem('usuario')
    if (usuarioStr) {
      try {
        const usuarioData = JSON.parse(usuarioStr)
        setUsuario(usuarioData)
      } catch (error) {
        console.error('Error al parsear usuario:', error)
        localStorage.removeItem('usuario')
        localStorage.removeItem('auth_token')
      }
    } else if (import.meta.env.DEV) {
      // Modo desarrollo: crear un usuario mock si no hay usuario
      // Para pruebas, puedes cambiar el rol aquí
      const mockUsuario: Usuario = {
        id: 1,
        nombre: 'Usuario Dev',
        rol: 'administracion' // Cambia esto para probar diferentes roles
      }
      setUsuario(mockUsuario)
      console.log('⚠️ Modo desarrollo: Usando usuario mock', mockUsuario)
    }
    setLoading(false)
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
  // Puede administrar impresoras: taller-grafico o administracion
  const canManageImpresoras = !!usuario && (usuario.rol === 'taller-grafico' || usuario.rol === 'administracion')
  // Puede gestionar compras: compras o administracion
  const canManageCompras = !!usuario && (usuario.rol === 'compras' || usuario.rol === 'administracion')
  /** Ver detalle de pedido de compra y recepción a stock (p. ej. desde ERP); gerencia incluida, sin dar acceso al dashboard clásico de compras. */
  const canViewPedidoCompraDetalle =
    !!usuario && (usuario.rol === 'compras' || usuario.rol === 'administracion' || isGerencia)
  // Puede gestionar caja: caja o administracion
  const canManageCaja = !!usuario && (usuario.rol === 'caja' || usuario.rol === 'administracion')
  // Puede gestionar instalaciones: instalaciones o administracion
  const canManageInstalaciones = !!usuario && (usuario.rol === 'instalaciones' || usuario.rol === 'administracion')
  // Puede gestionar taller de imprenta: imprenta o administracion
  const canManageTallerImprenta = !!usuario && (usuario.rol === 'imprenta' || usuario.rol === 'administracion')
  // Puede gestionar metalúrgica: metalurgica o administracion
  const canManageMetalurgica = !!usuario && (usuario.rol === 'metalurgica' || usuario.rol === 'administracion')
  // Puede gestionar recursos humanos: recursos-humanos o administracion
  const canManageRecursosHumanos = !!usuario && (usuario.rol === 'recursos-humanos' || usuario.rol === 'administracion')
  // Puede gestionar asesor técnico: asesor-tecnico o administracion
  const canManageAsesorTecnico = !!usuario && (usuario.rol === 'asesor-tecnico' || usuario.rol === 'administracion')
  // Puede gestionar presupuestos: presupuestos o administracion (también asesor-tecnico por vinculación)
  const canManagePresupuestos = !!usuario && (usuario.rol === 'presupuestos' || usuario.rol === 'asesor-tecnico' || usuario.rol === 'administracion')
  // Atención al público: todos los sectores (cualquier usuario logueado)
  const canAccessAtencionPublico = !!usuario

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
    loading,
    setUsuario
  }
}

