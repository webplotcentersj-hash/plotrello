import { flushSync } from 'react-dom'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { staffLogin } from '../services/staffAuthApi'
import { useAuth, type Usuario } from '../hooks/useAuth'
import { PHI_PUBLIC_URL } from '../utils/phiPublicUrl'
import {
  isOperarioExternoRol,
  operarioExternoHomeRoute,
  OPERARIO_EXTERNO_LOGIN
} from '../features/work-pool/workPoolOperarioExterno'
import {
  persistOperarioExternoSession,
  readOperarioExternoUsuario
} from '../utils/plotlabSession'
import '../features/phi/phi-landing.css'
import './OperarioExternoLoginPage.css'

const LOGO_URL = 'https://trello.plotcenter.com.ar/Group%20187.png'
const ONEST_FONT =
  'https://fonts.googleapis.com/css2?family=Onest:wght@500;700;800&display=swap'

type Props = {
  onLogin: (usuario: Usuario) => void
}

export default function OperarioExternoLoginPage({ onLogin }: Props) {
  const navigate = useNavigate()
  const { usuario, setUsuario } = useAuth()
  const sessionUser = usuario ?? readOperarioExternoUsuario()

  const [loginUser, setLoginUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'Ingreso operario externo · phi (φ)'

    let link = document.querySelector<HTMLLinkElement>('link[data-phi-font]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ONEST_FONT
      link.setAttribute('data-phi-font', 'true')
      document.head.appendChild(link)
    }
  }, [])

  const externoHome = operarioExternoHomeRoute(sessionUser?.rol)
  if (externoHome) {
    return <Navigate to={externoHome} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await staffLogin(loginUser, password)

      if (!response.success || !response.data) {
        setError(response.error || 'Usuario o contraseña incorrectos')
        return
      }

      const usuarioData = response.data.usuario

      if (!isOperarioExternoRol(usuarioData.rol)) {
        setError('Usuario o contraseña incorrectos')
        return
      }

      persistOperarioExternoSession(usuarioData, {
        token: response.data.token,
        loginName: response.data.loginName ?? loginUser.trim()
      })
      flushSync(() => {
        onLogin(usuarioData)
        setUsuario(usuarioData)
      })

      const home = operarioExternoHomeRoute(usuarioData.rol)
      navigate(home ?? OPERARIO_EXTERNO_LOGIN, { replace: true })
    } catch {
      setError('Error de conexión. Intentá de nuevo en unos minutos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="phi-root operario-externo-login-page">
      <div className="phi-nav-wrap">
        <nav className="phi-nav" aria-label="phi operario login">
          <a href={PHI_PUBLIC_URL} className="phi-nav-logo" aria-label="Volver a phi">
            <span className="phi-nav-logo-symbol">φ</span>
          </a>
          <div className="phi-nav-links">
            <a href={PHI_PUBLIC_URL} className="phi-nav-link">
              Volver a phi
            </a>
          </div>
        </nav>
      </div>

      <div className="operario-externo-login-shell">
        <aside className="operario-externo-login-aside" aria-label="Información">
          <div className="operario-externo-login-brand">
            <img src={LOGO_URL} alt="Plot Center" className="operario-externo-login-logo" />
            <div>
              <p className="operario-externo-login-eyebrow">phi (φ) · Plot Design</p>
              <h1>
                Panel de{' '}
                <span className="phi-highlight phi-highlight--pink">operario externo</span>
              </h1>
            </div>
          </div>
          <p className="operario-externo-login-lead">
            Ingresá con el usuario y contraseña que te enviemos cuando tu postulación sea aprobada.
          </p>
          <div className="operario-externo-login-notice" role="note">
            <strong>¿Todavía no tenés acceso?</strong>
            <p>
              Si enviaste tu postulación y está en revisión, te vamos a <strong>notificar por email</strong>{' '}
              cuando RRHH apruebe tu cuenta. Hasta entonces no vas a poder ingresar.
            </p>
          </div>
          <Link to="/postulacion-operarios" className="phi-btn phi-btn--outline operario-externo-login-postular">
            <UserPlus size={18} aria-hidden />
            Postularme como operario
          </Link>
        </aside>

        <div className="operario-externo-login-card">
          <h2>Ingresar al panel</h2>
          <p className="operario-externo-login-card-hint">
            Diseño, instalaciones o metalúrgica · bolsa externa Plot Center
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="operario-externo-login-form">
            <label>
              Usuario
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                autoComplete="username"
                placeholder="Usuario que te enviamos"
                required
                disabled={loading}
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
                disabled={loading}
              />
            </label>

            {error && (
              <p className="operario-externo-login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="phi-btn phi-btn--dark phi-btn--block" disabled={loading}>
              <LogIn size={18} aria-hidden />
              {loading ? 'Ingresando…' : 'Ingresar al panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
