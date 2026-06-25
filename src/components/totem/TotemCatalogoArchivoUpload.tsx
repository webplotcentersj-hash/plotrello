import { useCallback, useEffect, useRef, useState } from 'react'
import apiService from '../../services/api'
import type { CarritoArchivoRef } from '../../services/clienteCarritoExtras'
import {
  parseTotemArchivoManifest,
  summarizeTotemArchivoNombres,
  type TotemArchivoItem
} from '../../utils/totemArchivoManifest'
import './TotemCatalogoArchivoUpload.css'

const MAX_ARCHIVOS = 8
const MAX_MB = 50

type Origen = 'Pendrive' | 'CelularQR'

type Props = {
  archivos: CarritoArchivoRef[]
  onChange: (archivos: CarritoArchivoRef[]) => void
  disabled?: boolean
}

function toCarritoRef(item: TotemArchivoItem): CarritoArchivoRef {
  return {
    nombre: item.nombre,
    url: item.url,
    tipo: 'application/octet-stream',
    tamano: item.bytes ?? 0
  }
}

export default function TotemCatalogoArchivoUpload({ archivos, onChange, disabled }: Props) {
  const [origen, setOrigen] = useState<Origen>('CelularQR')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [qrUploadPageUrl, setQrUploadPageUrl] = useState<string | null>(null)
  const [qrLinkSrc, setQrLinkSrc] = useState<string | null>(null)
  const [qrSesionError, setQrSesionError] = useState<string | null>(null)
  const [qrListo, setQrListo] = useState(false)

  const pendriveInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)

  const applyQrArchivos = useCallback(
    (rawUrl: string, rawNombre?: string | null) => {
      const manifest = parseTotemArchivoManifest(rawUrl)
      if (manifest.files.length === 0) return
      const refs = manifest.files.slice(0, MAX_ARCHIVOS).map(toCarritoRef)
      onChange(refs)
      if (rawNombre?.trim()) {
        void rawNombre
      } else {
        void summarizeTotemArchivoNombres(manifest.files)
      }
      setQrListo(true)
    },
    [onChange]
  )

  useEffect(() => {
    if (origen !== 'CelularQR') {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      setQrUploadPageUrl(null)
      setQrLinkSrc(null)
      setQrSesionError(null)
      setQrListo(false)
      return
    }

    let cancelled = false
    setQrSesionError(null)
    setQrUploadPageUrl(null)
    setQrLinkSrc(null)
    setQrListo(false)

    void (async () => {
      const r = await apiService.crearSesionQrUploadTotem()
      if (cancelled) return
      if (!r.success || !r.data?.session_id) {
        setQrSesionError(r.error || 'No se pudo crear la sesión QR')
        return
      }
      const id = r.data.session_id
      const url = `${window.location.origin}/totem/subir-archivo/${id}`
      setQrUploadPageUrl(url)

      pollRef.current = window.setInterval(() => {
        void (async () => {
          const s = await apiService.obtenerSesionQrUploadTotem(id)
          if (!s.success || !s.data || s.data.ok === false) return
          const d = s.data
          if (d.archivos && d.archivos.length > 0 && d.archivo_url) {
            applyQrArchivos(String(d.archivo_url), d.archivo_nombre)
          } else if (d.archivo_url) {
            applyQrArchivos(String(d.archivo_url), d.archivo_nombre)
          }
          if (d.estado === 'completada' && d.archivo_url) {
            if (pollRef.current != null) {
              window.clearInterval(pollRef.current)
              pollRef.current = null
            }
          }
        })()
      }, 2200)
    })()

    return () => {
      cancelled = true
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [origen, applyQrArchivos])

  useEffect(() => {
    if (!qrUploadPageUrl) {
      setQrLinkSrc(null)
      return
    }
    let cancelled = false
    void import('qrcode').then((QR) => {
      QR.default
        .toDataURL(qrUploadPageUrl, {
          margin: 1,
          width: 220,
          color: { dark: '#0c1222', light: '#ffffff' }
        })
        .then((src) => {
          if (!cancelled) setQrLinkSrc(src)
        })
        .catch(() => {
          if (!cancelled) setQrLinkSrc(null)
        })
    })
    return () => {
      cancelled = true
    }
  }, [qrUploadPageUrl])

  const handlePendrive = (list: FileList | null) => {
    setError('')
    if (!list?.length) {
      onChange([])
      return
    }
    const files = Array.from(list).slice(0, MAX_ARCHIVOS)
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024)
    if (tooBig) {
      setError(`"${tooBig.name}" supera ${MAX_MB} MB`)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      return
    }

    setSubiendo(true)
    void (async () => {
      const uploaded: CarritoArchivoRef[] = []
      for (const file of files) {
        const r = await apiService.subirArchivoTotemCatalogo(file)
        if (!r.success || !r.data) {
          setError(r.error || `No se pudo subir "${file.name}"`)
          onChange(uploaded)
          setSubiendo(false)
          return
        }
        uploaded.push(r.data)
      }
      onChange(uploaded)
      setSubiendo(false)
    })()
  }

  return (
    <div className="totem-cat-upload">
      <div className="totem-cat-upload__origen" role="tablist" aria-label="Origen del archivo">
        <button
          type="button"
          role="tab"
          aria-selected={origen === 'CelularQR'}
          className={`totem-cat-upload__tab ${origen === 'CelularQR' ? 'active' : ''}`}
          onClick={() => setOrigen('CelularQR')}
          disabled={disabled || subiendo}
        >
          📱 Celular (QR)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={origen === 'Pendrive'}
          className={`totem-cat-upload__tab ${origen === 'Pendrive' ? 'active' : ''}`}
          onClick={() => setOrigen('Pendrive')}
          disabled={disabled || subiendo}
        >
          💾 Pendrive / PC
        </button>
      </div>

      {error && <p className="totem-cat-upload__error">{error}</p>}

      {origen === 'CelularQR' && (
        <div className="totem-cat-upload__qr">
          {qrSesionError ? (
            <p className="totem-cat-upload__error">{qrSesionError}</p>
          ) : qrLinkSrc ? (
            <>
              <img className="totem-cat-upload__qr-img" src={qrLinkSrc} alt="QR para subir archivos" />
              <p className="totem-cat-upload__hint">
                Escaneá con el celular, subí tu diseño y volvé acá. Máx. {MAX_ARCHIVOS} archivos de {MAX_MB} MB.
              </p>
              {qrListo && archivos.length > 0 ? (
                <p className="totem-cat-upload__ok">✓ {archivos.length} archivo(s) recibido(s)</p>
              ) : (
                <p className="totem-cat-upload__hint totem-cat-upload__hint--wait">Esperando archivos…</p>
              )}
            </>
          ) : (
            <p className="totem-cat-upload__hint">Generando código QR…</p>
          )}
        </div>
      )}

      {origen === 'Pendrive' && (
        <div className="totem-cat-upload__pendrive">
          <label className="totem-cat-upload__zone">
            <input
              ref={pendriveInputRef}
              type="file"
              multiple
              disabled={disabled || subiendo || archivos.length >= MAX_ARCHIVOS}
              onChange={(e) => handlePendrive(e.target.files)}
            />
            {subiendo ? 'Subiendo…' : '📎 Elegir archivos desde esta PC'}
          </label>
          <p className="totem-cat-upload__hint">
            PDF, AI, PSD, JPG, PNG y otros. Hasta {MAX_ARCHIVOS} archivos de {MAX_MB} MB c/u.
          </p>
        </div>
      )}

      {archivos.length > 0 && (
        <ul className="totem-cat-upload__list">
          {archivos.map((a, i) => (
            <li key={`${a.url}-${i}`}>
              <span>{a.nombre}</span>
              <button
                type="button"
                className="totem-cat-upload__remove"
                onClick={() => onChange(archivos.filter((_, j) => j !== i))}
                disabled={disabled || subiendo}
                aria-label={`Quitar ${a.nombre}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
