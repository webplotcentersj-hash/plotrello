import { Navigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'

interface ClienteProtectedRouteProps {
  children: React.ReactNode
}

export default function ClienteProtectedRoute({ children }: ClienteProtectedRouteProps) {
  const { isAuthenticated, loading } = useClienteAuth()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/cliente/login" replace />
  }

  return <>{children}</>
}

