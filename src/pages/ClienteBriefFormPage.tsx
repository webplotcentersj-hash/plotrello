import { lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'

const BriefPublicoPage = lazy(() => import('./BriefPublicoPage'))
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClienteBriefFormPage.css'

export default function ClienteBriefFormPage() {
  const { token } = useParams<{ token: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()

  if (authLoading) {
    return <ClientePageLoading />
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
    <ClientePageLayout className="cliente-brief-form-page">
      <ClientePageHeader
        eyebrow="Diseño"
        title="Brief de diseño"
        subtitle="Completá los datos de tu pedido gráfico"
        actions={
          <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/disenos')}>
            ← Mis diseños
          </button>
        }
      />

      <div className="cliente-brief-form-main">
        <Suspense fallback={<ClientePageLoading />}>
          <BriefPublicoPage
            token={token}
            clientePrefill={cliente}
            idCliente={cliente.id}
            onSuccess={() => navigate('/cliente/disenos')}
            variant="cliente"
          />
        </Suspense>
      </div>
    </ClientePageLayout>
  )
}
