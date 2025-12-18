import { Navigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'

interface ClienteProtectedRouteProps {
  children: React.ReactNode
}

export default function ClienteProtectedRoute({ children }: ClienteProtectedRouteProps) {
  const { isAuthenticated, loading, cliente } = useClienteAuth()

  console.log('ClienteProtectedRoute - loading:', loading, 'isAuthenticated:', isAuthenticated, 'cliente:', cliente)

  if (loading) {
    console.log('ClienteProtectedRoute - Mostrando loading...')
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('ClienteProtectedRoute - No autenticado, redirigiendo a login')
    return <Navigate to="/cliente/login" replace />
  }

  console.log('ClienteProtectedRoute - Acceso permitido, renderizando children')
  return <>{children}</>
}

