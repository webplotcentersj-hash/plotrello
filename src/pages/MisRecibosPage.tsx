import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSignatureCanvas } from '../hooks/useSignatureCanvas'
import { rrhhDocItemFirmar, rrhhDocItemsListar } from '../services/rrhhExtendidoService'
import type { RrhhDocItem } from '../types/api'
import './rrhhExtendido.css'

const MisRecibosPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [items, setItems] = useState<RrhhDocItem[]>([])
  const [selected, setSelected] = useState<RrhhDocItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { canvasRef, firmaDataUrl, limpiarFirma } = useSignatureCanvas({ width: 480, height: 140 })

  const load = useCallback(async () => {
    if (!usuario?.id) return
    const res = await rrhhDocItemsListar(undefined, usuario.id)
    if (res.success && res.data) setItems(res.data)
    else setError(res.error || 'Error')
  }, [usuario?.id])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, usuario, navigate, load])

  const firmar = async () => {
    if (!selected || !firmaDataUrl) {
      setError('Firmá en el recuadro')
      return
    }
    const res = await rrhhDocItemFirmar(selected.id, firmaDataUrl)
    if (!res.success) setError(res.error || 'Error')
    else {
      setSelected(null)
      limpiarFirma()
      await load()
    }
  }

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Mis recibos</h1>
          <p>Documentación pendiente de firma.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/')}>
          Volver
        </button>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}

      <div className="rrhh-ext-card">
        <table className="rrhh-ext-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <a href={i.archivo_url} target="_blank" rel="noreferrer">
                    {i.archivo_nombre || `Documento #${i.id}`}
                  </a>
                </td>
                <td>
                  <span className={`rrhh-ext-badge ${i.estado === 'firmado' ? 'ok' : 'warn'}`}>
                    {i.estado}
                  </span>
                </td>
                <td>
                  {i.estado === 'pendiente' ? (
                    <button
                      type="button"
                      className="rrhh-ext-btn primary"
                      onClick={() => {
                        setSelected(i)
                        limpiarFirma()
                      }}
                    >
                      Firmar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={3}>No tenés documentos</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="rrhh-ext-card" style={{ marginTop: 16 }}>
          <h3>Firmar: {selected.archivo_nombre}</h3>
          <canvas ref={canvasRef} className="rrhh-ext-firma-canvas" width={480} height={140} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="rrhh-ext-btn ghost" onClick={() => limpiarFirma()}>
              Limpiar
            </button>
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void firmar()}>
              Confirmar firma
            </button>
            <button type="button" className="rrhh-ext-btn" onClick={() => setSelected(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MisRecibosPage
