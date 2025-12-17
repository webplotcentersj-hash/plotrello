import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import './ClienteLoginPage.css'

export default function ClienteLoginPage() {
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
        setError(response.error || 'Error al iniciar sesión')
      }
    } catch (err) {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cliente-login-page">
      <div className="cliente-login-container">
        <div className="cliente-login-header">
          <h1>Plot Center</h1>
          <p>Portal de Clientes</p>
        </div>
        
        <form onSubmit={handleSubmit} className="cliente-login-form">
          {error && <div className="cliente-login-error">{error}</div>}
          
          <div className="cliente-login-field">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
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
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Ingresa tu contraseña"
            />
          </div>

          <button 
            type="submit" 
            className="cliente-login-button"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

