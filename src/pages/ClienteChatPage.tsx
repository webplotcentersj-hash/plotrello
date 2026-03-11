import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import { useEffect, useMemo } from 'react'
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
    return (
      <div className="cliente-chat-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (!cliente) return null

  return (
    <div className="cliente-chat-page">
      <header className="cliente-chat-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img src="https://trello.plotcenter.com.ar/Group%20187.png" alt="Plot Center" />
            <div>
              <h1>Chat con PlotAI</h1>
              <p className="cliente-chat-subtitle">
                Preguntá por el estado de tus pedidos y OP usando su número.
              </p>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/cliente/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>
      <main className="cliente-chat-main">
        <section className="cliente-chat-card">
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
      </main>
    </div>
  )
}
