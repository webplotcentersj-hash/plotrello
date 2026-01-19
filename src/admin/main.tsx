import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from '../components/ErrorBoundary'
import '../style.css'

// Manejo global de errores no capturados
window.addEventListener('error', (event) => {
  console.error('Error global (Admin):', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rechazada (Admin):', event.reason)
  event.preventDefault()
})

const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('No se encontró el elemento #app en el DOM')
}

// Remover el fallback de carga si existe
const loadingFallback = document.getElementById('loading-fallback')
if (loadingFallback) {
  loadingFallback.remove()
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
} catch (error) {
  console.error('Error al montar React (Admin):', error)
  rootElement.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%);
      color: #fff;
      padding: 20px;
      text-align: center;
    ">
      <h1 style="color: #ff6b6b; margin-bottom: 16px;">⚠️ Error al cargar Panel Admin</h1>
      <p style="margin-bottom: 24px; color: #b7bed3;">${error instanceof Error ? error.message : 'Error desconocido'}</p>
      <p style="color: #7c84a0; font-size: 14px;">Revisa la consola del navegador (F12) para más detalles.</p>
      <button
        onclick="window.location.reload()"
        style="
          margin-top: 24px;
          padding: 12px 24px;
          background: #eb671b;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        "
      >
        Recargar página
      </button>
    </div>
  `
}

