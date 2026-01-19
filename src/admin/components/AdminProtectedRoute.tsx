import { useAuth } from '../../hooks/useAuth'

interface AdminProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Guard de ruta que verifica que el usuario esté autenticado y tenga rol de admin
 */
export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { usuario, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
        color: '#f9fbff'
      }}>
        <div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#eb671b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!usuario) {
    // Redirigir al login de la app operativa (usar ruta absoluta para evitar problemas de routing)
    window.location.href = '/login'
    return null
  }

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
        color: '#f9fbff',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#ff6b6b', marginBottom: '16px' }}>⚠️ Acceso Denegado</h1>
        <p style={{ marginBottom: '24px', color: '#b7bed3' }}>
          No tenés permisos para acceder al Panel Admin.
        </p>
        <p style={{ color: '#7c84a0', fontSize: '14px', marginBottom: '24px' }}>
          Tu rol actual: <strong>{usuario.rol}</strong>
        </p>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '12px 24px',
            background: '#eb671b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Volver a la App Principal
        </button>
      </div>
    )
  }

  return <>{children}</>
}

