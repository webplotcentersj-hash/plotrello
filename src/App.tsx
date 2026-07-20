import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import GlobalAlertScreen from './components/GlobalAlertScreen'
import PwaUpdateToast from './components/PwaUpdateToast'
import CajaSyncToastHost from './features/control-cajas/components/CajaSyncToastHost'
import Login from './components/Login'
import EnvDebug from './components/EnvDebug'
import { PwaUpdateProvider } from './contexts/PwaUpdateContext'
import { useAuth, type Usuario } from './hooks/useAuth'
import { adminStaffHomeRoute } from './utils/adminStaffHome'
import {
  isOperarioExternoSession,
  isStaffSession,
  readOperarioExternoUsuario,
  readStaffUsuario
} from './utils/plotlabSession'
import { operarioExternoHomeRoute } from './features/work-pool/workPoolOperarioExterno'
import './app.css'
import './plotlab-mobile.css'

const EmbedChatPage = lazy(() => import('./pages/EmbedChatPage'))
const EmbedChatWidgetPage = lazy(() => import('./pages/EmbedChatWidgetPage'))
const TotemChatPage = lazy(() => import('./pages/TotemChatPage'))
const TotemAutogestionHomePage = lazy(() => import('./pages/TotemAutogestionHomePage'))
const TotemKioskLayout = lazy(() => import('./pages/TotemKioskLayout'))
const TotemAutogestionCatalogoPage = lazy(() => import('./pages/TotemAutogestionCatalogoPage'))
const TotemAutogestionCheckoutPage = lazy(() => import('./pages/TotemAutogestionCheckoutPage'))
const TotemAutogestionImprimirPage = lazy(() => import('./pages/TotemAutogestionImprimirPage'))
const TotemSubirArchivoQrPage = lazy(() => import('./pages/TotemSubirArchivoQrPage'))
const TotemConsultaClientePage = lazy(() => import('./pages/TotemConsultaClientePage'))
const TotemFinalizadoTallerPage = lazy(() => import('./pages/TotemFinalizadoTallerPage'))
const TotemDisenoHomePage = lazy(() => import('./pages/TotemDisenoHomePage'))
const TotemDisenoBriefPage = lazy(() => import('./pages/TotemDisenoBriefPage'))
const TotemAsesorTabletPage = lazy(() => import('./pages/TotemAsesorTabletPage'))
const TotemDisenadorTabletPage = lazy(() => import('./pages/TotemDisenadorTabletPage'))
const TotemPantallaPage = lazy(() => import('./pages/TotemPantallaPage'))
const ClienteConsultaPage = lazy(() => import('./pages/ClienteConsultaPage'))
const DashboardPantallasPage = lazy(() => import('./pages/DashboardPantallasPage'))
const OpPublicPage = lazy(() => import('./pages/OpPublicPage'))
const FirmaClientePage = lazy(() => import('./pages/FirmaClientePage'))
const BriefPublicoPage = lazy(() => import('./pages/BriefPublicoPage'))
const ReclamosPublicoPage = lazy(() => import('./pages/ReclamosPublicoPage'))
const CvPublicoPage = lazy(() => import('./pages/CvPublicoPage'))
const PostulacionExternaPage = lazy(() => import('./pages/PostulacionExternaPage'))
const EncuestaClimaPage = lazy(() => import('./pages/EncuestaClimaPage'))
const SatisfaccionClientePublicPage = lazy(() => import('./pages/SatisfaccionClientePublicPage'))
const OpEliminadasPage = lazy(() => import('./pages/OpEliminadasPage'))
const ClienteLoginPage = lazy(() => import('./pages/ClienteLoginPage'))
const ClientePortalRoutes = lazy(() => import('./routes/ClientePortalRoutes'))
const StaffAppHost = lazy(() => import('./routes/StaffAppHost'))
const OperarioBolsaSolicitudPage = lazy(() => import('./pages/OperarioBolsaSolicitudPage'))
const OperarioExternoHomePage = lazy(() => import('./pages/OperarioExternoHomePage'))
const OperarioExternoLoginPage = lazy(() => import('./pages/OperarioExternoLoginPage'))
const OperarioExternoDashboardPage = lazy(
  () => import('./features/work-pool/OperarioExternoDashboardPage')
)
const OperarioExternoStaffShell = lazy(
  () => import('./features/work-pool/OperarioExternoStaffShell')
)
const PhiPublicRedirect = lazy(() => import('./pages/PhiPublicRedirect'))

const operarioExternoFallback = (
  <div
    style={{
      padding: '32px',
      textAlign: 'center',
      color: '#0b0b0b',
      background: '#fff',
      minHeight: '100vh',
      fontFamily: "'Onest', system-ui, sans-serif",
      fontWeight: 600
    }}
  >
    Cargando panel…
  </div>
)

/** App campo: sin panel de debug fijo (debe vivir dentro de BrowserRouter). */
function EnvDebugGate() {
  const { pathname } = useLocation()
  if (pathname === '/app-campo' || pathname === '/phi' || pathname.startsWith('/phi/')) return null
  if (pathname === '/postulacion-operarios' || pathname === '/operario-bolsa/solicitud') return null
  if (pathname.startsWith('/operario-externo')) return null
  return <EnvDebug />
}

function isEmbedPublicRoute(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/embed/')
}

function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
        color: '#fff'
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255,255,255,0.1)',
          borderTopColor: '#eb671b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}
      />
      <p>Cargando...</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    /* keep raw */
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null
  if (decoded.startsWith('/login')) return null
  return decoded
}

/** Si ya hay sesión y entraron a /login?next=…, ir al destino pedido. */
function StaffLoginRedirect() {
  const { search } = useLocation()
  const next = safeNextPath(new URLSearchParams(search).get('next'))
  const rol = readStaffUsuario()?.rol
  return <Navigate to={next ?? adminStaffHomeRoute(rol) ?? '/'} replace />
}

function App() {
  return (
    <PwaUpdateProvider>
      <GlobalAlertScreen />
      <PwaUpdateToast />
      <CajaSyncToastHost />
      <AppInner />
    </PwaUpdateProvider>
  )
}

function AppInner() {
  const { loading, setUsuario } = useAuth()
  const isStaffAuthenticated = isStaffSession()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.log('🔍 Variables de Entorno:')
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Configurada' : '❌ NO CONFIGURADA')
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ NO CONFIGURADA')
    console.log('VITE_SUPABASE_SCHEMA:', import.meta.env.VITE_SUPABASE_SCHEMA || 'NO CONFIGURADA')
    console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || 'NO CONFIGURADA')
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase no está configurado. La app usará datos mock o fallback.')
    }
  }, [])

  const handleLogin = (usuarioData: Usuario) => {
    setUsuario(usuarioData)
  }

  return (
    <>
      {loading && !isEmbedPublicRoute() ? (
        <LoadingScreen />
      ) : (
      <BrowserRouter>
        <EnvDebugGate />
        <Routes>
          <Route
            path="/embed/chat"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando chat...</div>}>
                <EmbedChatPage />
              </Suspense>
            }
          />
          <Route
            path="/embed/chat-widget"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <EmbedChatWidgetPage />
              </Suspense>
            }
          />
          <Route
            path="/totem"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <TotemChatPage />
              </Suspense>
            }
          />
          <Route
            element={
              <Suspense
                fallback={
                  <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando tótem…</div>
                }
              >
                <TotemKioskLayout />
              </Suspense>
            }
          >
            <Route
              path="/totem/autogestion"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
                  }
                >
                  <TotemAutogestionHomePage />
                </Suspense>
              }
            />
            <Route path="/totem/autogestion/op" element={<Navigate to="/totem/consulta-cliente" replace />} />
            <Route
              path="/totem/autogestion/catalogo"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
                  }
                >
                  <TotemAutogestionCatalogoPage />
                </Suspense>
              }
            />
            <Route
              path="/totem/autogestion/checkout"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
                  }
                >
                  <TotemAutogestionCheckoutPage />
                </Suspense>
              }
            />
            <Route
              path="/totem/autogestion/imprimir"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
                  }
                >
                  <TotemAutogestionImprimirPage />
                </Suspense>
              }
            />
            <Route
              path="/totem/subir-archivo/:sessionId"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando…</div>
                  }
                >
                  <TotemSubirArchivoQrPage />
                </Suspense>
              }
            />
            <Route
              path="/totem/consulta-cliente"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
                  }
                >
                  <TotemConsultaClientePage />
                </Suspense>
              }
            />
            <Route
              path="/totem/finalizado-taller"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
                  }
                >
                  <TotemFinalizadoTallerPage />
                </Suspense>
              }
            />
            <Route
              path="/totem/diseno"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando Diseño…</div>
                  }
                >
                  <TotemDisenoHomePage />
                </Suspense>
              }
            />
            <Route
              path="/totem/diseno/brief"
              element={
                <Suspense
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando brief…</div>
                  }
                >
                  <TotemDisenoBriefPage />
                </Suspense>
              }
            />
            <Route
              path="/totem/consulta-cliente/entrada-taller"
              element={<Navigate to="/totem/finalizado-taller" replace />}
            />
          </Route>
          <Route
            path="/asesor"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando panel asesor…</div>}>
                <TotemAsesorTabletPage />
              </Suspense>
            }
          />
          <Route
            path="/disenador"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando panel diseñador…</div>}>
                <TotemDisenadorTabletPage />
              </Suspense>
            }
          />
          <Route
            path="/totem/pantalla"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando pantalla...</div>}>
                <TotemPantallaPage />
              </Suspense>
            }
          />
          <Route
            path="/consulta-cliente"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <ClienteConsultaPage />
              </Suspense>
            }
          />
          <Route
            path="/dashboard-pantallas"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <DashboardPantallasPage />
              </Suspense>
            }
          />
          <Route
            path="/op-public/:opNumber"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <OpPublicPage />
              </Suspense>
            }
          />
          <Route
            path="/firma-cliente/:opNumber"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <FirmaClientePage />
              </Suspense>
            }
          />
          <Route
            path="/brief/:token"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <BriefPublicoPage />
              </Suspense>
            }
          />
          <Route
            path="/reclamos"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <ReclamosPublicoPage />
              </Suspense>
            }
          />
          <Route
            path="/trabaja-con-nosotros"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <CvPublicoPage />
              </Suspense>
            }
          />
          <Route
            path="/convocatoria/:slug"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <PostulacionExternaPage />
              </Suspense>
            }
          />
          <Route
            path="/encuesta-clima/:id"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                <EncuestaClimaPage />
              </Suspense>
            }
          />
          <Route
            path="/phi"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando phi…</div>}>
                <PhiPublicRedirect />
              </Suspense>
            }
          />
          <Route
            path="/satisfaccion-cliente"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <SatisfaccionClientePublicPage />
              </Suspense>
            }
          />
          <Route
            path="/op-eliminadas"
            element={
              isStaffAuthenticated ? (
                <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                  <OpEliminadasPage />
                </Suspense>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/operario-bolsa/solicitud"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando…</div>}>
                <OperarioBolsaSolicitudPage />
              </Suspense>
            }
          />
          <Route
            path="/postulacion-operarios"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando…</div>}>
                <OperarioBolsaSolicitudPage />
              </Suspense>
            }
          />
          <Route
            path="/operario-externo/login"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#0b0b0b',
                      background: '#fff',
                      minHeight: '100vh',
                      fontFamily: "'Onest', system-ui, sans-serif"
                    }}
                  >
                    Cargando…
                  </div>
                }
              >
                <OperarioExternoLoginPage onLogin={handleLogin} />
              </Suspense>
            }
          />
          <Route
            path="/operario-externo"
            element={
              <Suspense fallback={operarioExternoFallback}>
                <OperarioExternoHomePage />
              </Suspense>
            }
          />
          <Route
            path="/operario-externo/diseno"
            element={
              <Suspense fallback={operarioExternoFallback}>
                <OperarioExternoDashboardPage product="plot-design" />
              </Suspense>
            }
          />
          <Route
            path="/operario-externo/bolsa"
            element={
              <Suspense fallback={operarioExternoFallback}>
                <OperarioExternoDashboardPage product="bolsa-plot" />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={
              isOperarioExternoSession() ? (
                <Navigate
                  to={operarioExternoHomeRoute(readOperarioExternoUsuario()!.rol)!}
                  replace
                />
              ) : isStaffAuthenticated ? (
                <StaffLoginRedirect />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/cliente/login"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <ClienteLoginPage />
              </Suspense>
            }
          />
          <Route
            path="/cliente/*"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando portal...</div>}>
                <ClientePortalRoutes />
              </Suspense>
            }
          />
          <Route
            path="/*"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <OperarioExternoStaffShell
                  isAuthenticated={isStaffAuthenticated}
                  login={<Login onLogin={handleLogin} />}
                  staff={<StaffAppHost />}
                />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
      )}
    </>
  )
}

export default App
