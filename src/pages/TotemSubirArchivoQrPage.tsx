import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '@/services/api'
import './TotemSubirArchivoQrPage.css'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type View = 'loading' | 'invalid' | 'error' | 'abierta' | 'completada' | 'expirada' | 'ok'

export default function TotemSubirArchivoQrPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const [view, setView] = useState<View>('loading')
  const [msg, setMsg] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!UUID_RE.test(sessionId)) {
      setView('invalid')
      setMsg('Enlace inválido.')
      return
    }
    setView('loading')
    setMsg(null)
    const r = await apiService.obtenerSesionQrUploadTotem(sessionId)
    if (!r.success || !r.data) {
      setView('error')
      setMsg(r.error || 'No se pudo cargar la sesión.')
      return
    }
    const d = r.data
    if (d.ok === false) {
      const err = d.error || 'Sesión no disponible'
      setView(err.includes('vencida') ? 'expirada' : 'error')
      setMsg(err)
      return
    }
    if (d.estado === 'completada' && d.archivo_url) {
      setView('completada')
      setMsg(null)
      return
    }
    if (d.estado === 'expirada') {
      setView('expirada')
      setMsg('Esta sesión venció. Volvé al tótem y generá un código nuevo.')
      return
    }
    setView('abierta')
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !UUID_RE.test(sessionId)) return
    setSubmitting(true)
    setMsg(null)
    const r = await apiService.subirArchivoSesionTotemQr(file, sessionId)
    setSubmitting(false)
    if (!r.success) {
      setMsg(r.error || 'No se pudo subir.')
      return
    }
    setView('ok')
  }

  return (
    <div className="totem-qr-upload-page">
      <main className="totem-qr-upload-card">
        <h1 className="totem-qr-upload-title">Plot Center — subir archivo</h1>
        {view === 'loading' && <p className="totem-qr-upload-muted">Cargando…</p>}
        {view === 'invalid' && <p className="totem-qr-upload-error">{msg}</p>}
        {view === 'error' && <p className="totem-qr-upload-error">{msg}</p>}
        {view === 'expirada' && <p className="totem-qr-upload-error">{msg}</p>}
        {view === 'completada' && (
          <p className="totem-qr-upload-success">Ya recibimos el archivo. Podés cerrar esta página.</p>
        )}
        {view === 'ok' && (
          <p className="totem-qr-upload-success">Listo. El tótem ya puede continuar con la solicitud.</p>
        )}
        {view === 'abierta' && (
          <form className="totem-qr-upload-form" onSubmit={(e) => void handleSubmit(e)}>
            <p className="totem-qr-upload-lead">Elegí el PDF o la imagen que querés imprimir.</p>
            <input
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"
              className="totem-qr-upload-file"
              onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
            />
            {msg && <p className="totem-qr-upload-error">{msg}</p>}
            <button type="submit" className="totem-qr-upload-btn" disabled={!file || submitting}>
              {submitting ? 'Subiendo…' : 'Enviar archivo'}
            </button>
          </form>
        )}
        {submitting && <p className="totem-qr-upload-muted">Subiendo, esperá un momento…</p>}
      </main>
    </div>
  )
}
