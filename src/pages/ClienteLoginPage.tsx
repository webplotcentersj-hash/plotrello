import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useClienteAuth } from '../hooks/useClienteAuth'
import { ClienteThemeContext, useClienteThemeProviderValue } from '../hooks/useClienteTheme'
import ClienteThemeToggle from '../components/cliente/ClienteThemeToggle'
import apiService from '../services/api'
import '../styles/clientePortalTheme.css'
import './ClienteLoginPage.css'

function ClienteLoginForm() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useClienteAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiService.autenticarClienteWeb(usuario, password)

      if (response.success && response.data) {
        login(response.data)
        navigate('/cliente/dashboard')
      } else {
        setError(response.error || 'Usuario o contraseña incorrectos')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cliente-login-page" data-cliente-theme-scope>
      <div className="cliente-login-theme">
        <ClienteThemeToggle />
      </div>
      <div className="cliente-login-container cliente-card">
        <div className="cliente-login-header">
          <div className="cliente-login-logo-wrap">
            <div className="cliente-login-logo-inner">
              <img
                src="https://trello.plotcenter.com.ar/Group%20187.png"
                alt="Plot Center Logo"
                className="cliente-login-logo"
              />
            </div>
          </div>
          <h1>Plot Center</h1>
          <p>Portal de Clientes</p>
        </div>

        <form onSubmit={handleSubmit} className="cliente-login-form">
          {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

          <div className="cliente-login-field">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              className="cliente-input"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              disabled={loading}
              placeholder="Ingresa tu usuario"
            />
          </div>

          <div className="cliente-login-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="cliente-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Ingresa tu contraseña"
            />
          </div>

          <button type="submit" className="cliente-btn-primary cliente-login-button" disabled={loading}>
            <LogIn size={18} strokeWidth={2.25} aria-hidden />
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ClienteLoginPage() {
  const themeValue = useClienteThemeProviderValue()

  return (
    <ClienteThemeContext.Provider value={themeValue}>
      <div data-cliente-theme={themeValue.theme}>
        <ClienteLoginForm />
      </div>
    </ClienteThemeContext.Provider>
  )
}
