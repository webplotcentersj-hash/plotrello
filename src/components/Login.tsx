import { flushSync } from 'react-dom'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { staffLogin } from '../services/staffAuthApi'
import { operarioExternoHomeRoute } from '../features/work-pool/workPoolOperarioExterno'
import './Login.css'

type LoginProps = {
  onLogin: (usuario: any) => void
}

const Login = ({ onLogin }: LoginProps) => {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await staffLogin(usuario, password)
      
      if (response.success && response.data) {
        const usuarioData = response.data.usuario
        localStorage.setItem('usuario', JSON.stringify(usuarioData))
        localStorage.setItem('usuario_id', usuarioData.id.toString())
        localStorage.setItem('plotlab_login_usuario', usuario.trim())
        flushSync(() => onLogin(usuarioData))
        const externoHome = operarioExternoHomeRoute(usuarioData.rol)
        navigate(externoHome ?? '/', { replace: true })
      } else {
        setError(response.error || 'Error al iniciar sesión')
      }
    } catch (err) {
      setError('Error de conexión. Verifica que el backend esté funcionando.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="https://trello.plotcenter.com.ar/Group%20187.png"
            alt="Plot Center Logo"
            className="login-logo"
          />
          <h1>Plot Lab</h1>
          <p>Inicia sesión para continuar</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              type="text"
              placeholder="Ingresa tu usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login

