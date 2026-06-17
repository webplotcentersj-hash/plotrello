import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const isAuthContextError = this.state.error?.message?.includes('useAuth debe usarse dentro de AuthProvider')
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
          color: '#fff',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️ Error en la aplicación</h1>
          <p style={{ marginBottom: '24px', color: '#b7bed3', maxWidth: '480px' }}>
            {isAuthContextError
              ? 'La app quedó con una versión mezclada tras una actualización. Recargá la página para continuar.'
              : this.state.error?.message || 'Ocurrió un error inesperado'}
          </p>
          <button
            onClick={() => {
              window.location.reload()
            }}
            style={{
              padding: '12px 24px',
              background: '#eb671b',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Recargar página
          </button>
          <details style={{ marginTop: '24px', textAlign: 'left', maxWidth: '600px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Detalles técnicos</summary>
            <pre style={{
              background: '#1f2233',
              padding: '16px',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '12px',
              color: '#ff6b6b'
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

