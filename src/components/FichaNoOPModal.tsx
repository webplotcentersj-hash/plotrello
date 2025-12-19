import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import apiService from '../services/api'
import './FichaNoOPModal.css'

type FichaNoOPModalProps = {
  onClose: () => void
  onSuccess: () => void
}

const FichaNoOPModal = ({ onClose, onSuccess }: FichaNoOPModalProps) => {
  const { usuario } = useAuth()
  const [nombreCliente, setNombreCliente] = useState('')
  const [datosContacto, setDatosContacto] = useState('')
  const [especificaciones, setEspecificaciones] = useState('')
  const [driveLink, setDriveLink] = useState('')
  const [ubicacionLink, setUbicacionLink] = useState('')
  const [prioridad, setPrioridad] = useState('Baja')
  const [planillaPreliminar, setPlanillaPreliminar] = useState(false)
  const [fichaTecnicaFile, setFichaTecnicaFile] = useState<File | null>(null)
  const [fichaTecnicaUrl, setFichaTecnicaUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setFichaTecnicaFile(file)
    } else {
      alert('Por favor selecciona un archivo PDF')
    }
  }

  const handleUploadFichaTecnica = async () => {
    if (!fichaTecnicaFile) return

    setUploading(true)
    try {
      const url = await uploadAttachmentAndGetUrl(fichaTecnicaFile, 'fichas-tecnicas')
      setFichaTecnicaUrl(url)
      setUploading(false)
    } catch (error) {
      console.error('Error subiendo ficha técnica:', error)
      alert('Error al subir el archivo PDF')
      setUploading(false)
    }
  }

  const handleCreate = async () => {
    if (!nombreCliente.trim()) {
      alert('El nombre del cliente es requerido')
      return
    }

    // Si hay archivo seleccionado pero no se ha subido, subirlo primero
    if (fichaTecnicaFile && !fichaTecnicaUrl) {
      await handleUploadFichaTecnica()
      if (!fichaTecnicaUrl) {
        alert('Error al subir la ficha técnica. Intenta nuevamente.')
        return
      }
    }

    const creatorName = usuario?.nombre?.split('@')[0] || usuario?.nombre || 'Usuario'
    
    // Generar un número único para la ficha (sin OP)
    const fichaNumber = `FICHA-${Date.now().toString().slice(-6)}`

    const payload = {
      numero_op: fichaNumber,
      cliente: nombreCliente.trim(),
      descripcion: especificaciones.trim() || null,
      estado: 'Asesor Técnico',
      prioridad: prioridad,
      sector: 'Asesor Técnico',
      sectores: ['Asesor Técnico'],
      sector_inicial: 'Asesor Técnico',
      nombre_creador: creatorName,
      telefono_cliente: datosContacto.trim() || null,
      drive_link: driveLink.trim() || null,
      ubicacion_link: ubicacionLink.trim() || null,
      es_ficha_no_op: true,
      planilla_preliminar: planillaPreliminar,
      ficha_tecnica_pdf_url: fichaTecnicaUrl || null
    }

    try {
      const response = await apiService.createOrden(payload as any)
      if (!response.success) {
        alert(response.error || 'Error al crear la ficha')
        return
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creando ficha:', error)
      alert('Error al crear la ficha')
    }
  }

  return (
    <div className="ficha-no-op-modal-overlay" onClick={onClose}>
      <div className="ficha-no-op-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ficha-no-op-modal-header">
          <h2>Crear Nueva Ficha</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="ficha-no-op-modal-body">
          <div className="form-group">
            <label>Nombre del Cliente</label>
            <input
              type="text"
              placeholder="Nombre del Cliente"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Datos de Contacto</label>
            <input
              type="text"
              placeholder="Datos de Contacto"
              value={datosContacto}
              onChange={(e) => setDatosContacto(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Especificaciones</label>
            <textarea
              placeholder="Especificaciones"
              value={especificaciones}
              onChange={(e) => setEspecificaciones(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Enlace a Google Drive (Opcional)</label>
            <input
              type="text"
              placeholder="Enlace a Google Drive (Opcional)"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Enlace a Ubicación (Opcional)</label>
            <input
              type="text"
              placeholder="Enlace a Ubicación (Opcional)"
              value={ubicacionLink}
              onChange={(e) => setUbicacionLink(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Prioridad</label>
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="Baja">Baja</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
            </select>
          </div>

          <div className="form-group">
            <label>FICHA TECNICA</label>
            <div className="file-upload-section">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="select-file-button"
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar archivo
              </button>
              <span className="file-name">
                {fichaTecnicaFile ? fichaTecnicaFile.name : 'Ningún archivo seleccionado'}
              </span>
              {fichaTecnicaFile && !fichaTecnicaUrl && (
                <button
                  type="button"
                  className="upload-button"
                  onClick={handleUploadFichaTecnica}
                  disabled={uploading}
                >
                  {uploading ? 'Subiendo...' : 'Subir PDF'}
                </button>
              )}
              {fichaTecnicaUrl && (
                <span className="upload-success">✓ Archivo subido</span>
              )}
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={planillaPreliminar}
                onChange={(e) => setPlanillaPreliminar(e.target.checked)}
              />
              <span>Marcar como Planilla Preliminar</span>
            </label>
          </div>
        </div>

        <div className="ficha-no-op-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="create-button" onClick={handleCreate}>
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}

export default FichaNoOPModal

