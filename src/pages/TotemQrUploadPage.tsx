import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import './TotemQrUploadPage.css'

const MAX_BYTES = 15 * 1024 * 1024
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp'

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

function validarArchivo(file: File): string | null {
  if (file.size > MAX_BYTES) return 'El archivo supera el máximo permitido (15 MB).'
  const mime = file.type || ''
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const okMime =
    mime === 'application/pdf' || mime.startsWith('image/png') || mime.startsWith('image/jpeg') || mime === 'image/webp'
  const okExt = ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)
  if (!okMime && !okExt) return 'Solo se admiten PDF o imágenes (JPG, PNG, WEBP).'
  return null
}

const TotemQrUploadPage = () => {
  const [searchParams] = useSearchParams()
  const sesion = searchParams.get('sesion')?.trim() ?? ''
  const sesionOk = useMemo(() => isUuid(sesion), [sesion])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState(false)

  const enviar = async () => {
    setError(null)
    if (!sesionOk) {
      setError('Enlace inválido.')
      return
    }
    if (!file) {
      setError('Elegí un archivo.')
      return
    }
    const v = validarArchivo(file)
    if (v) {
      setError(v)
      return
    }
    setEnviando(true)
    try {
      const url = await uploadAttachmentAndGetUrl(file, `totem_qr/${sesion}`)
      const reg = await apiService.registrarArchivoSesionQrTotem({
        sessionId: sesion,
        archivo_url: url,
        archivo_nombre: file.name,
        archivo_bytes: file.size
      })
      if (!reg.success) {
        setError(reg.error || 'No se pudo confirmar en el tótem. Pedí un código nuevo.')
        return
      }
      setOk(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir.')
    } finally {
      setEnviando(false)
    }
  }

  if (!sesionOk) {
    return (
      <div className="totem-qr-upload-page">
        <div className="totem-qr-upload-card">
          <h1 className="totem-qr-upload-title">Enlace inválido</h1>
          <p className="totem-qr-upload-text">Escaneá de nuevo el código QR en el tótem.</p>
        </div>
      </div>
    )
  }

  if (ok) {
    return (
      <div className="totem-qr-upload-page">
        <div className="totem-qr-upload-card totem-qr-upload-card--success">
          <h1 className="totem-qr-upload-title">Listo</h1>
          <p className="totem-qr-upload-text">El archivo ya está en el tótem. Podés cerrar esta pantalla y confirmar el pedido ahí.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="totem-qr-upload-page">
      <div className="totem-qr-upload-card">
        <h1 className="totem-qr-upload-title">Enviar archivo al tótem</h1>
        <p className="totem-qr-upload-text">Elegí el PDF o la imagen desde tu celular. Máximo 15 MB.</p>
        <label className="totem-qr-upload-label">
          <span className="totem-qr-upload-label-text">Archivo</span>
          <input
            type="file"
            accept={ACCEPT}
            className="totem-qr-upload-input"
            disabled={enviando}
            onChange={(e) => {
              setError(null)
              setFile(e.target.files?.[0] ?? null)
            }}
          />
        </label>
        {file ? <p className="totem-qr-upload-file-name">{file.name}</p> : null}
        {error ? <div className="totem-qr-upload-error">{error}</div> : null}
        <button type="button" className="totem-qr-upload-submit" disabled={enviando || !file} onClick={() => void enviar()}>
          {enviando ? 'Enviando…' : 'Enviar al tótem'}
        </button>
      </div>
    </div>
  )
}

export default TotemQrUploadPage
