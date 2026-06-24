import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '@/services/api'
import { TOTEM_PRINT_MAX_FILE_BYTES, TOTEM_PRINT_MAX_FILE_MB, TOTEM_PRINT_MAX_FILES } from '@/constants/totemPrint'
import './TotemSubirArchivoQrPage.css'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type View = 'loading' | 'invalid' | 'error' | 'abierta' | 'completada' | 'expirada' | 'ok'

export default function TotemSubirArchivoQrPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const [view, setView] = useState<View>('loading')
  const [msg, setMsg] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
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

  const handleFileChange = (list: FileList | null) => {
    setMsg(null)
    if (!list?.length) {
      setFiles([])
      return
    }
    const picked = Array.from(list)
    if (picked.length > TOTEM_PRINT_MAX_FILES) {
      setMsg(`Máximo ${TOTEM_PRINT_MAX_FILES} archivos por envío.`)
      setFiles(picked.slice(0, TOTEM_PRINT_MAX_FILES))
      return
    }
    const tooBig = picked.find((f) => f.size > TOTEM_PRINT_MAX_FILE_BYTES)
    if (tooBig) {
      setMsg(`"${tooBig.name}" supera ${TOTEM_PRINT_MAX_FILE_MB} MB.`)
      setFiles([])
      return
    }
    setFiles(picked)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files.length || !UUID_RE.test(sessionId)) return
    setSubmitting(true)
    setMsg(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isLast = i === files.length - 1
      const r = await apiService.subirArchivoSesionTotemQr(file, sessionId, { finalizar: false })
      if (!r.success) {
        setSubmitting(false)
        setMsg(r.error || `No se pudo subir "${file.name}".`)
        return
      }
      if (isLast) {
        const fin = await apiService.finalizarSesionQrUploadTotem(sessionId)
        if (!fin.success) {
          setSubmitting(false)
          setMsg(fin.error || 'Archivos subidos pero no se pudo cerrar la sesión.')
          return
        }
      }
    }

    setSubmitting(false)
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
          <p className="totem-qr-upload-success">
            Listo{files.length > 1 ? ` (${files.length} archivos)` : ''}. El tótem ya puede continuar con la solicitud.
          </p>
        )}
        {view === 'abierta' && (
          <form className="totem-qr-upload-form" onSubmit={(e) => void handleSubmit(e)}>
            <p className="totem-qr-upload-lead">
              Elegí uno o más PDF o imágenes (hasta {TOTEM_PRINT_MAX_FILES}, máx. {TOTEM_PRINT_MAX_FILE_MB} MB c/u).
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"
              className="totem-qr-upload-file"
              onChange={(ev) => handleFileChange(ev.target.files)}
            />
            {files.length > 0 && (
              <ul className="totem-qr-upload-fileList">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    {f.name} ({(f.size / (1024 * 1024)).toFixed(1)} MB)
                  </li>
                ))}
              </ul>
            )}
            {msg && <p className="totem-qr-upload-error">{msg}</p>}
            <button type="submit" className="totem-qr-upload-btn" disabled={!files.length || submitting}>
              {submitting ? 'Subiendo…' : files.length > 1 ? `Enviar ${files.length} archivos` : 'Enviar archivo'}
            </button>
          </form>
        )}
        {submitting && <p className="totem-qr-upload-muted">Subiendo, esperá un momento…</p>}
      </main>
    </div>
  )
}
