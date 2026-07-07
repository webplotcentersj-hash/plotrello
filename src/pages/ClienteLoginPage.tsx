import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, CheckCircle2 } from 'lucide-react'
import { useClienteAuth } from '../hooks/useClienteAuth'
import { ClienteThemeContext, useClienteThemeProviderValue } from '../hooks/useClienteTheme'
import ClienteThemeToggle from '../components/cliente/ClienteThemeToggle'
import apiService from '../services/api'
import '../styles/clientePortalTheme.css'
import './ClienteLoginPage.css'

type Modo = 'login' | 'registro'

function ClienteLoginForm() {
  const [modo, setModo] = useState<Modo>('login')

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useClienteAuth()
  const navigate = useNavigate()

  // Estado del formulario de registro
  const [regNombre, setRegNombre] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regTelefono, setRegTelefono] = useState('')
  const [regEsCliente, setRegEsCliente] = useState(false)
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regEnviado, setRegEnviado] = useState(false)

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

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')

    if (!regNombre.trim() || !regEmail.trim() || !regTelefono.trim()) {
      setRegError('Completá nombre, email y teléfono.')
      return
    }

    setRegLoading(true)
    try {
      const response = await apiService.crearSolicitudRegistroCliente({
        nombre: regNombre,
        email: regEmail,
        telefono: regTelefono,
        esClienteExistente: regEsCliente
      })

      if (response.success) {
        setRegEnviado(true)
      } else {
        setRegError(response.error || 'No se pudo enviar la solicitud. Intentá nuevamente.')
      }
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Error de conexión. Intentá nuevamente.')
    } finally {
      setRegLoading(false)
    }
  }

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo)
    setError('')
    setRegError('')
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
                src="/plot-lab-logo.png"
                alt="Plot Center Logo"
                className="cliente-login-logo"
              />
            </div>
          </div>
          <h1>Plot Center</h1>
          <p>Portal de Clientes</p>
        </div>

        <div className="cliente-login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'login'}
            className={`cliente-login-tab${modo === 'login' ? ' is-active' : ''}`}
            onClick={() => cambiarModo('login')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'registro'}
            className={`cliente-login-tab${modo === 'registro' ? ' is-active' : ''}`}
            onClick={() => cambiarModo('registro')}
          >
            Registrarme
          </button>
        </div>

        {modo === 'login' && (
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
        )}

        {modo === 'registro' && (
          regEnviado ? (
            <div className="cliente-login-success" role="status">
              <CheckCircle2 size={40} strokeWidth={2} aria-hidden />
              <h2>¡Solicitud recibida!</h2>
              <p>Te enviaremos un mensaje con tu usuario y contraseña a la brevedad.</p>
              <button
                type="button"
                className="cliente-btn-outline cliente-login-button"
                onClick={() => cambiarModo('login')}
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegistro} className="cliente-login-form">
              {regError && <div className="cliente-page-alert cliente-page-alert--error">{regError}</div>}

              <div className="cliente-login-field">
                <label htmlFor="reg-nombre">Nombre y apellido</label>
                <input
                  id="reg-nombre"
                  className="cliente-input"
                  type="text"
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  required
                  disabled={regLoading}
                  placeholder="Tu nombre completo"
                />
              </div>

              <div className="cliente-login-field">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  className="cliente-input"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  disabled={regLoading}
                  placeholder="tu@email.com"
                />
              </div>

              <div className="cliente-login-field">
                <label htmlFor="reg-telefono">Teléfono</label>
                <input
                  id="reg-telefono"
                  className="cliente-input"
                  type="tel"
                  value={regTelefono}
                  onChange={(e) => setRegTelefono(e.target.value)}
                  required
                  disabled={regLoading}
                  placeholder="Ej: 11 2345 6789"
                />
              </div>

              <label className="cliente-login-check">
                <input
                  type="checkbox"
                  checked={regEsCliente}
                  onChange={(e) => setRegEsCliente(e.target.checked)}
                  disabled={regLoading}
                />
                <span>Ya soy cliente de Plot Center</span>
              </label>

              <button type="submit" className="cliente-btn-primary cliente-login-button" disabled={regLoading}>
                <UserPlus size={18} strokeWidth={2.25} aria-hidden />
                {regLoading ? 'Enviando…' : 'Enviar solicitud'}
              </button>

              <p className="cliente-login-note">
                Te enviaremos un mensaje con tu usuario y contraseña a la brevedad.
              </p>
            </form>
          )
        )}
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
