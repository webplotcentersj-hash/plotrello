import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import { useEffect, useMemo } from 'react'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClienteChatPage.css'

export default function ClienteChatPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
    }
  }, [cliente, authLoading, navigate])

  const embedUrl = useMemo(() => {
    if (typeof window === 'undefined' || !cliente) return ''
    const apiBase = window.location.origin
    const params = new URLSearchParams({
      hideForm: '1',
      modo: 'cliente_portal',
      clienteId: String(cliente.id),
      clienteNombre: cliente.nombre || '',
      clienteEmpresa: cliente.empresa || '',
      clienteEmail: cliente.email || ''
    })
    return `${apiBase}/embed/chat?${params.toString()}`
  }, [cliente])

  if (authLoading) {
    return <ClientePageLoading />
  }

  if (!cliente) return null

  return (
    <ClientePageLayout className="cliente-chat-page">
      <ClientePageHeader
        eyebrow="Asistente"
        title="PlotAI"
        subtitle={`Hola, ${cliente.nombre}. Consultá el estado de tus pedidos y OP.`}
      />
        <section className="cliente-page-card cliente-chat-card">
          <div className="cliente-chat-info">
            <h2>👋 Hola, {cliente.nombre}</h2>
          </div>
          {embedUrl && (
            <iframe
              src={embedUrl}
              title="Chat PlotAI"
              className="chat-iframe"
            />
          )}
        </section>
    </ClientePageLayout>
  )
}
