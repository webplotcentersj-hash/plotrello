import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import GlobalAlertScreen from './components/GlobalAlertScreen'
import Login from './components/Login'
import EnvDebug from './components/EnvDebug'
import { useAuth } from './hooks/useAuth'
import type { Usuario } from './hooks/useAuth'
import './app.css'
import './plotlab-mobile.css'

const EmbedChatPage = lazy(() => import('./pages/EmbedChatPage'))
const EmbedChatWidgetPage = lazy(() => import('./pages/EmbedChatWidgetPage'))
const TotemChatPage = lazy(() => import('./pages/TotemChatPage'))
const TotemAutogestionHomePage = lazy(() => import('./pages/TotemAutogestionHomePage'))
const TotemAutogestionCatalogoPage = lazy(() => import('./pages/TotemAutogestionCatalogoPage'))
const TotemAutogestionCheckoutPage = lazy(() => import('./pages/TotemAutogestionCheckoutPage'))
const TotemAutogestionImprimirPage = lazy(() => import('./pages/TotemAutogestionImprimirPage'))
const TotemSubirArchivoQrPage = lazy(() => import('./pages/TotemSubirArchivoQrPage'))
const TotemConsultaClientePage = lazy(() => import('./pages/TotemConsultaClientePage'))
const TotemPantallaPage = lazy(() => import('./pages/TotemPantallaPage'))
const ClienteConsultaPage = lazy(() => import('./pages/ClienteConsultaPage'))
const DashboardPantallasPage = lazy(() => import('./pages/DashboardPantallasPage'))
const OpPublicPage = lazy(() => import('./pages/OpPublicPage'))
const FirmaClientePage = lazy(() => import('./pages/FirmaClientePage'))
const BriefPublicoPage = lazy(() => import('./pages/BriefPublicoPage'))
const ReclamosPublicoPage = lazy(() => import('./pages/ReclamosPublicoPage'))
const CvPublicoPage = lazy(() => import('./pages/CvPublicoPage'))
const SatisfaccionClientePublicPage = lazy(() => import('./pages/SatisfaccionClientePublicPage'))
const OpEliminadasPage = lazy(() => import('./pages/OpEliminadasPage'))
const ClienteLoginPage = lazy(() => import('./pages/ClienteLoginPage'))
const ClientePortalRoutes = lazy(() => import('./routes/ClientePortalRoutes'))
const StaffAppHost = lazy(() => import('./routes/StaffAppHost'))

/** App campo: sin panel de debug fijo (debe vivir dentro de BrowserRouter). */
function EnvDebugGate() {
  const { pathname } = useLocation()
  if (pathname === '/app-campo') return null
  return <EnvDebug />
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

function App() {
  const { usuario, loading, setUsuario } = useAuth()
  const isAuthenticated = !!usuario

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

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <>
      <GlobalAlertScreen />
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
            path="/totem/autogestion"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <TotemAutogestionHomePage />
              </Suspense>
            }
          />
          <Route path="/totem/autogestion/op" element={<Navigate to="/totem/consulta-cliente" replace />} />
          <Route
            path="/totem/autogestion/catalogo"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <TotemAutogestionCatalogoPage />
              </Suspense>
            }
          />
          <Route
            path="/totem/autogestion/checkout"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <TotemAutogestionCheckoutPage />
              </Suspense>
            }
          />
          <Route
            path="/totem/autogestion/imprimir"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <TotemAutogestionImprimirPage />
              </Suspense>
            }
          />
          <Route
            path="/totem/subir-archivo/:sessionId"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando…</div>}>
                <TotemSubirArchivoQrPage />
              </Suspense>
            }
          />
          <Route
            path="/totem/consulta-cliente"
            element={
              <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>}>
                <TotemConsultaClientePage />
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
              isAuthenticated ? (
                <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
                  <OpEliminadasPage />
                </Suspense>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
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
              isAuthenticated ? (
                <Suspense fallback={<LoadingScreen />}>
                  <StaffAppHost />
                </Suspense>
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
