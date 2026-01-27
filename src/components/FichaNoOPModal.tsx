import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import apiService from '../services/api'
import type { ClienteRecord } from '../types/api'
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
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false)
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clienteInputRef = useRef<HTMLInputElement>(null)

  // Buscar clientes cuando se escribe en el campo cliente
  useEffect(() => {
    const buscarClientes = async () => {
      if (nombreCliente.trim().length < 2) {
        setClientesEncontrados([])
        setIsClienteDropdownOpen(false)
        return
      }

      setBuscandoClientes(true)
      const response = await apiService.buscarClientes(nombreCliente.trim())
      if (response.success && response.data) {
        setClientesEncontrados(response.data)
        setIsClienteDropdownOpen(true)
      } else {
        setClientesEncontrados([])
      }
      setBuscandoClientes(false)
    }

    const timeoutId = setTimeout(() => {
      void buscarClientes()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [nombreCliente])

  const handleSelectCliente = (clienteSeleccionado: ClienteRecord) => {
    setNombreCliente(clienteSeleccionado.nombre)
    setDatosContacto(clienteSeleccionado.telefono || '')
    setDriveLink(clienteSeleccionado.drive_link || '')
    setUbicacionLink(clienteSeleccionado.ubicacion_link || '')
    setClientesEncontrados([])
    setIsClienteDropdownOpen(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setFichaTecnicaFile(file)
    } else {
      alert('Por favor selecciona un archivo PDF')
    }
  }

  const handleUploadFichaTecnica = async (): Promise<string | null> => {
    if (!fichaTecnicaFile) return null

    setUploading(true)
    try {
      const url = await uploadAttachmentAndGetUrl(fichaTecnicaFile, 'fichas-tecnicas')
      setFichaTecnicaUrl(url)
      setUploading(false)
      return url
    } catch (error) {
      console.error('Error subiendo ficha técnica:', error)
      setUploading(false)
      throw error // Re-lanzar el error para que handleCreate lo maneje
    }
  }

  const handleCreate = async () => {
    if (!nombreCliente.trim()) {
      alert('El nombre del cliente es requerido')
      return
    }

    // Si hay archivo seleccionado pero no se ha subido, subirlo primero
    let finalFichaTecnicaUrl = fichaTecnicaUrl
    if (fichaTecnicaFile && !fichaTecnicaUrl) {
      try {
        finalFichaTecnicaUrl = await handleUploadFichaTecnica()
        if (!finalFichaTecnicaUrl) {
          alert('Error al subir la ficha técnica. Intenta nuevamente.')
          return
        }
      } catch (error) {
        alert('Error al subir la ficha técnica. Intenta nuevamente.')
        return
      }
    }

    const creatorName = usuario?.nombre?.split('@')[0] || usuario?.nombre || 'Usuario'
    
    // El número de ficha se generará automáticamente en la base de datos
    // Solo enviamos 'FICHA-' como prefijo para que la función lo detecte
    const payload = {
      numero_op: 'FICHA-', // La base de datos generará el número completo automáticamente
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
      ficha_tecnica_pdf_url: finalFichaTecnicaUrl || null
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
            <div style={{ position: 'relative' }}>
              <input
                ref={clienteInputRef}
                type="text"
                placeholder="Nombre del Cliente"
                value={nombreCliente}
                onChange={(e) => setNombreCliente(e.target.value)}
                onFocus={() => {
                  if (clientesEncontrados.length > 0) {
                    setIsClienteDropdownOpen(true)
                  }
                }}
                onBlur={() => {
                  // Delay para permitir el click en el dropdown
                  setTimeout(() => setIsClienteDropdownOpen(false), 200)
                }}
              />
              {isClienteDropdownOpen && clientesEncontrados.length > 0 && (
                <div className="cliente-dropdown">
                  {buscandoClientes && (
                    <div className="dropdown-item">Buscando...</div>
                  )}
                  {clientesEncontrados.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="dropdown-item"
                      onClick={() => handleSelectCliente(cliente)}
                    >
                      <div className="cliente-nombre">{cliente.nombre}</div>
                      {cliente.telefono && (
                        <div className="cliente-info">📞 {cliente.telefono}</div>
                      )}
                      {cliente.email && (
                        <div className="cliente-info">✉️ {cliente.email}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

