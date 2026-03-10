import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import { useEffect } from 'react'
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

  const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
  const embedUrl = `${apiBase}/embed/chat?hideForm=1`

  return (
    <div className="cliente-chat-page">
      <header className="cliente-chat-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img src="https://trello.plotcenter.com.ar/Group%20187.png" alt="Plot Center" />
            <h1>Chat con PlotAI</h1>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/cliente/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>
      <main className="cliente-chat-main">
        <iframe
          src={embedUrl}
          title="Chat PlotAI"
          className="chat-iframe"
        />
      </main>
    </div>
  )
}
