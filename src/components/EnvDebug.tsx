/**
 * Componente de depuración para verificar variables de entorno
 * Solo se muestra en desarrollo
 */
const EnvDebug = () => {
  if (!import.meta.env.DEV) {
    return null
  }

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'NO CONFIGURADA'
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY ? '✅ Configurada' : '❌ NO CONFIGURADA'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        maxWidth: '300px',
        border: '1px solid #333'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🔍 Debug - Variables de Entorno</div>
      <div style={{ marginBottom: '4px' }}>
        <strong>API URL:</strong> {apiUrl}
      </div>
      <div>
        <strong>Gemini Key:</strong> {geminiKey}
      </div>
      <div style={{ marginTop: '8px', fontSize: '10px', color: '#aaa' }}>
        Solo visible en desarrollo
      </div>
    </div>
  )
}

export default EnvDebug

