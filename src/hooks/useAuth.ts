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
  // Puede administrar impresoras: taller-grafico o administracion
  const canManageImpresoras = !!usuario && (usuario.rol === 'taller-grafico' || usuario.rol === 'administracion')

  return {
    usuario,
    isAdmin,
    isMostrador,
    isTallerGrafico,
    canManageImpresoras,
    loading,
    setUsuario
  }
}

