import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import apiService from '../services/api'
import { formatMessageTime } from '../utils/mensajeriaHelpers'
import './MensajeriaPage.css'

export default function MensajeriaProofVerifyPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proof, setProof] = useState<Awaited<
    ReturnType<typeof apiService.obtenerPruebaMensajePorToken>
  >['data']>(undefined)

  useEffect(() => {
    if (!token) {
      setError('Falta el token de verificación.')
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      const res = await apiService.obtenerPruebaMensajePorToken(token)
      if (res.success && res.data) {
        setProof(res.data)
        setError(null)
      } else {
        setProof(undefined)
        setError(res.error || 'Token no válido')
      }
      setLoading(false)
    })()
  }, [token])

  return (
    <div className="mensajeria-page mensajeria-proof-page">
      <div className="mensajeria-wrap mensajeria-proof-wrap">
        <header className="mensajeria-head">
          <div>
            <h1>Verificación de mensaje</h1>
            <p>Consulta pública de un token de prueba emitido por la mensajería interna de PLOT.</p>
          </div>
          <Link to="/mensajeria" className="mensajeria-btn mensajeria-btn-ghost">
            ← Mensajería
          </Link>
        </header>

        {loading && <p className="mensajeria-muted">Verificando token…</p>}
        {error && (
          <div className="mensajeria-error" role="alert">
            {error}
          </div>
        )}
        {proof && (
          <article className="mensajeria-proof-card">
            <div className="mensajeria-proof-badge">✓ Token válido</div>
            <dl className="mensajeria-proof-dl">
              <div>
                <dt>Token</dt>
                <dd className="mensajeria-proof-token">{proof.proof_token}</dd>
              </div>
              <div>
                <dt>Mensaje #</dt>
                <dd>{proof.message_id}</dd>
              </div>
              <div>
                <dt>Autor</dt>
                <dd>
                  {proof.nombre_usuario} (ID {proof.id_usuario})
                </dd>
              </div>
              <div>
                <dt>Fecha del mensaje</dt>
                <dd>{formatMessageTime(proof.msg_timestamp)} — {new Date(proof.msg_timestamp).toLocaleDateString('es-AR')}</dd>
              </div>
              <div>
                <dt>Token emitido</dt>
                <dd>{new Date(proof.token_created_at).toLocaleString('es-AR')}</dd>
              </div>
              <div>
                <dt>Consultas al token</dt>
                <dd>{proof.download_count}</dd>
              </div>
            </dl>
            <div className="mensajeria-proof-message">
              <strong>Contenido registrado</strong>
              <p>{proof.mensaje || '—'}</p>
              {proof.archivos_urls.length > 0 && (
                <p className="mensajeria-muted">
                  {proof.archivos_urls.length} archivo(s) adjunto(s) en el mensaje original.
                </p>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}
