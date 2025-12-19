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
  const isMostrador = usuario?.rol === 'mostrador'
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

  return {
    usuario,
    isAdmin,
    isMostrador,
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
    canManageInstalaciones,
    canManageTallerImprenta,
    canManageMetalurgica,
    canManageRecursosHumanos,
    canManageAsesorTecnico,
    canManagePresupuestos,
    loading,
    setUsuario
  }
}

