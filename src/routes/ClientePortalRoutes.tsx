import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ClienteProtectedRoute from '../components/ClienteProtectedRoute'
import ClientePortalShell from '../components/cliente/ClientePortalShell'

const ClienteDashboardPage = lazy(() => import('../pages/ClienteDashboardPage'))
const ClienteBuscarOpPage = lazy(() => import('../pages/ClienteBuscarOpPage'))
const ClienteMensajesPage = lazy(() => import('../pages/ClienteMensajesPage'))
const ClienteNuevoPedidoPage = lazy(() => import('../pages/ClienteNuevoPedidoPage'))
const ClientePedidoDetallePage = lazy(() => import('../pages/ClientePedidoDetallePage'))
const ClienteCatalogoPage = lazy(() => import('../pages/ClienteCatalogoPage'))
const ClienteCarritoPage = lazy(() => import('../pages/ClienteCarritoPage'))
const ClienteCheckoutPage = lazy(() => import('../pages/ClienteCheckoutPage'))
const ClientePresupuestosPage = lazy(() => import('../pages/ClientePresupuestosPage'))
const ClientePresupuestoFormPage = lazy(() => import('../pages/ClientePresupuestoFormPage'))
const ClientePresupuestoDetallePage = lazy(() => import('../pages/ClientePresupuestoDetallePage'))
const ClienteBriefsPage = lazy(() => import('../pages/ClienteBriefsPage'))
const ClienteBriefFormPage = lazy(() => import('../pages/ClienteBriefFormPage'))
const ClienteReclamosPage = lazy(() => import('../pages/ClienteReclamosPage'))
const ClienteChatPage = lazy(() => import('../pages/ClienteChatPage'))
const ClienteNotificacionesPage = lazy(() => import('../pages/ClienteNotificacionesPage'))
const ClienteAyudaPage = lazy(() => import('../pages/ClienteAyudaPage'))

export default function ClientePortalRoutes() {
  return (
    <ClienteProtectedRoute>
      <ClientePortalShell>
        <Suspense
          fallback={
            <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Cargando...</div>
          }
        >
          <Routes>
            <Route path="dashboard" element={<ClienteDashboardPage />} />
            <Route path="catalogo" element={<ClienteCatalogoPage />} />
            <Route path="carrito" element={<ClienteCarritoPage />} />
            <Route path="checkout" element={<ClienteCheckoutPage />} />
            <Route path="nuevo-pedido" element={<ClienteNuevoPedidoPage />} />
            <Route path="pedido/:id" element={<ClientePedidoDetallePage />} />
            <Route path="presupuestos" element={<ClientePresupuestosPage />} />
            <Route path="presupuesto/nuevo" element={<ClientePresupuestoFormPage />} />
            <Route path="presupuesto/:id" element={<ClientePresupuestoDetallePage />} />
            <Route path="presupuesto/:id/editar" element={<ClientePresupuestoFormPage />} />
            <Route path="buscar-op/:numeroOp?" element={<ClienteBuscarOpPage />} />
            <Route path="mensajes/:idPedido?" element={<ClienteMensajesPage />} />
            <Route path="disenos" element={<ClienteBriefsPage />} />
            <Route path="brief/:token" element={<ClienteBriefFormPage />} />
            <Route path="reclamos" element={<ClienteReclamosPage />} />
            <Route path="ayuda" element={<ClienteAyudaPage />} />
            <Route path="chat" element={<ClienteChatPage />} />
            <Route path="notificaciones" element={<ClienteNotificacionesPage />} />
            <Route path="*" element={<Navigate to="/cliente/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ClientePortalShell>
    </ClienteProtectedRoute>
  )
}
