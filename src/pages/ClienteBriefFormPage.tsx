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
      <header className="cliente-brief-form-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <h1>Brief de Diseño</h1>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/cliente/disenos')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="cliente-brief-form-main">
        <BriefPublicoPage
          token={token}
          clientePrefill={cliente}
          idCliente={cliente.id}
          onSuccess={() => navigate('/cliente/disenos')}
          variant="cliente"
        />
      </main>
    </div>
  )
}
