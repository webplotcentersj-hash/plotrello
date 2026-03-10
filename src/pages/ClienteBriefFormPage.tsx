import { useParams, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import BriefPublicoPage from './BriefPublicoPage'
import './ClienteBriefFormPage.css'

export default function ClienteBriefFormPage() {
  const { token } = useParams<{ token: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()

  if (authLoading) {
    return (
      <div className="cliente-brief-form-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (!cliente) {
    navigate('/cliente/login')
    return null
  }

  if (!token) {
    navigate('/cliente/disenos')
    return null
  }

  return (
    <div className="cliente-brief-form-page">
      <BriefPublicoPage
        token={token}
        clientePrefill={cliente}
        idCliente={cliente.id}
        onSuccess={() => navigate('/cliente/disenos')}
        variant="cliente"
      />
    </div>
  )
}
