import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from '../components/ErrorBoundary'
import '../style.css'

const rootElement = document.getElementById('app')
if (!rootElement) throw new Error('No se encontró #app')

const loadingFallback = document.getElementById('loading-fallback')
if (loadingFallback) loadingFallback.remove()

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
