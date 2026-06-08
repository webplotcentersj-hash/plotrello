import { useState } from 'react'
import apiService from '../services/api'
import type { RrhhBajaAdjunto, UsuarioRecord } from '../types/api'
import {
  TIPOS_DESVINCULACION_RRHH,
  type TipoDesvinculacionRrhh
} from '../utils/rrhhBajaCatalog'
import './DarDeBajaEmpleadoModal.css'

type DarDeBajaEmpleadoModalProps = {
  usuario: UsuarioRecord
  isOpen: boolean
  registradoPorId: number
  onClose: () => void
  onSuccess: () => void
}

const todayKey = () => new Date().toISOString().slice(0, 10)

const DarDeBajaEmpleadoModal = ({
  usuario,
  isOpen,
  registradoPorId,
  onClose,
  onSuccess
}: DarDeBajaEmpleadoModalProps) => {
  const [fechaDesvinculacion, setFechaDesvinculacion] = useState(todayKey)
  const [motivo, setMotivo] = useState('')
  const [tipoDesvinculacion, setTipoDesvinculacion] = useState<TipoDesvinculacionRrhh>('renuncia_voluntaria')
  const [observaciones, setObservaciones] = useState('')
  const [adjuntos, setAdjuntos] = useState<RrhhBajaAdjunto[]>([])
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)

  if (!isOpen) return null

  const subirArchivo = async (file: File) => {
    setUploading(true)
    try {
      const r = await apiService.rrhhBajaSubirAdjunto(file, usuario.id)
      if (r.success && r.data) {
        setAdjuntos((prev) => [...prev, r.data!])
      } else {
        alert(r.error || 'No se pudo subir el archivo')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    const m = motivo.trim()
    if (m.length < 5) {
      alert('El motivo de baja es obligatorio (mínimo 5 caracteres).')
      return
    }
    if (!fechaDesvinculacion) {
      alert('La fecha de desvinculación es obligatoria.')
      return
    }

    setProcessing(true)
    try {
      const response = await apiService.darDeBajaUsuario({
        id: usuario.id,
        fechaDesvinculacion,
        motivo: m,
        tipoDesvinculacion,
        observacionesFinales: observaciones.trim() || null,
        adjuntos,
        registradoPor: registradoPorId
      })
      if (response.success) {
        onSuccess()
        onClose()
        alert(`${usuario.nombre} fue dado de baja. El legajo e historial se conservan en Personal de baja.`)
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error en baja formal:', error)
      alert('Error al procesar la baja')
    } finally {
      setProcessing(false)
    }
  }

  const busy = processing || uploading

  return (
    <div
      className="dar-baja-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="dar-baja-modal" onClick={(e) => e.stopPropagation()}>
        <header className="dar-baja-header">
          <div>
            <h3>Dar de baja colaborador</h3>
            <p className="dar-baja-subtitle">
              {usuario.nombre} · Legajo #{usuario.id}
            </p>
          </div>
          <button
            type="button"
            className="dar-baja-close"
            onClick={() => !busy && onClose()}
            disabled={busy}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="dar-baja-body">
          <p className="dar-baja-intro">
            El colaborador pasará a <strong>Personal de baja</strong>. Se conserva el legajo completo,
            novedades, movimientos y demás historial. No podrá iniciar sesión.
          </p>

          <div className="dar-baja-grid">
            <label className="dar-baja-field">
              <span>Fecha de desvinculación *</span>
              <input
                type="date"
                value={fechaDesvinculacion}
                onChange={(e) => setFechaDesvinculacion(e.target.value)}
                disabled={busy}
              />
            </label>

            <label className="dar-baja-field">
              <span>Tipo de desvinculación *</span>
              <select
                value={tipoDesvinculacion}
                onChange={(e) => setTipoDesvinculacion(e.target.value as TipoDesvinculacionRrhh)}
                disabled={busy}
              >
                {TIPOS_DESVINCULACION_RRHH.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="dar-baja-field dar-baja-field--full">
            <span>Motivo de baja *</span>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describa el motivo de la desvinculación (mín. 5 caracteres)"
              disabled={busy}
            />
          </label>

          <label className="dar-baja-field dar-baja-field--full">
            <span>Observaciones finales</span>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales, acuerdos, entrega de elementos, etc."
              disabled={busy}
            />
          </label>

          <div className="dar-baja-upload">
            <p className="dar-baja-upload-title">Documentación relacionada</p>
            <p className="dar-baja-upload-hint">
              Carta de renuncia, telegrama, finiquito, certificados u otros (PDF, imagen o Word, máx. 12 MB).
            </p>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf,.doc,.docx"
              multiple
              disabled={busy}
              onChange={(e) => {
                const files = e.target.files
                if (!files?.length) return
                void Promise.all(Array.from(files).map((f) => subirArchivo(f)))
                e.target.value = ''
              }}
            />
            {adjuntos.length > 0 ? (
              <ul className="dar-baja-adj-list">
                {adjuntos.map((a, i) => (
                  <li key={a.url + i}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.nombre}
                    </a>{' '}
                    <button
                      type="button"
                      className="dar-baja-adj-remove"
                      disabled={busy}
                      onClick={() => setAdjuntos((x) => x.filter((_, j) => j !== i))}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {uploading ? <p className="dar-baja-upload-status">Subiendo archivo…</p> : null}
          </div>
        </div>

        <footer className="dar-baja-footer">
          <button type="button" className="dar-baja-btn dar-baja-btn--secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="dar-baja-btn dar-baja-btn--danger"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {processing ? 'Procesando baja…' : 'Confirmar baja'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default DarDeBajaEmpleadoModal
