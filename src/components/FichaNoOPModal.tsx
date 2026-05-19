import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import apiService from '../services/api'
import { broadcastOrdenesChanged } from '../utils/ordenesBroadcast'
import type { ClienteRecord } from '../types/api'
import type { Task } from '../types/board'
import { parseTaskIdToOrdenId, taskToOrdenPayload } from '../utils/dataMappers'
import QRPrintView from './QRPrintView'
import './FichaNoOPModal.css'

type AdjuntoItem = {
  id: string
  name: string
  remoteUrl?: string
  uploading: boolean
  type?: string
  error?: string
  file?: File
  /** Si viene de enlaces_adjuntos (edición) */
  dbId?: number
}

type FichaNoOPModalProps = {
  onClose: () => void
  onSuccess: () => void
  /** Si se pasa, el modal edita esa ficha (misma UI que al crear). */
  editTask?: Task | null
}

const FichaNoOPModal = ({ onClose, onSuccess, editTask = null }: FichaNoOPModalProps) => {
  const { usuario } = useAuth()
  const [nombreCliente, setNombreCliente] = useState('')
  const [datosContacto, setDatosContacto] = useState('')
  const [ubicacionTexto, setUbicacionTexto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [motivos, setMotivos] = useState('')
  const [driveLink, setDriveLink] = useState('')
  const [ubicacionLink, setUbicacionLink] = useState('')
  const [prioridad, setPrioridad] = useState('Normal')
  const [planillaPreliminar, setPlanillaPreliminar] = useState(false)
  const [presupuestoArmado, setPresupuestoArmado] = useState(false)
  const [presupuestoEnviado, setPresupuestoEnviado] = useState(false)
  const [presupuestoEnEspera, setPresupuestoEnEspera] = useState(false)
  const [adjuntos, setAdjuntos] = useState<AdjuntoItem[]>([])
  const adjuntosRef = useRef(adjuntos)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false)
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [qrPrintData, setQrPrintData] = useState<{ opNumber: string; cliente: string } | null>(null)
  /** URL de ficha técnica hidratada al abrir (getOrden) si el listado liviano no la trajo. */
  const [hydratedFichaPdfUrl, setHydratedFichaPdfUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clienteInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    adjuntosRef.current = adjuntos
  }, [adjuntos])

  const isEditMode = editTask != null
  const isPresupuestosStage =
    Boolean(editTask) &&
    (editTask?.status === 'presupuestos' ||
      editTask?.status === 'armados-enviados-asesor-presupuestos' ||
      editTask?.status === 'no-aprobados-asesor-presupuestos' ||
      editTask?.assignedSector === 'Presupuestos' ||
      editTask?.assignedSector === 'Armados/Enviados' ||
      editTask?.assignedSector === 'No Aprobados')
  const canShowMotivos = isEditMode && isPresupuestosStage

  const parseDescripcionYMotivos = (raw: string): { descripcion: string; motivos: string } => {
    const s = (raw || '').trim()
    if (!s) return { descripcion: '', motivos: '' }
    const marker = '\n\nMotivos:\n'
    const idx = s.indexOf(marker)
    if (idx < 0) return { descripcion: s, motivos: '' }
    return {
      descripcion: s.slice(0, idx).trim(),
      motivos: s.slice(idx + marker.length).trim()
    }
  }

  const buildDescripcionConMotivos = (descripcion: string, motivosText: string) => {
    const d = (descripcion || '').trim()
    const m = (motivosText || '').trim()
    if (!d && !m) return ''
    if (d && !m) return d
    if (!d && m) return `Motivos:\n${m}`
    return `${d}\n\nMotivos:\n${m}`
  }

  // Cargar datos al editar o limpiar al crear
  useEffect(() => {
    if (editTask) {
      setNombreCliente(editTask.title ?? '')
      setDatosContacto(editTask.clientPhone ?? '')
      setUbicacionTexto(editTask.clientAddress ?? '')
      const raw = editTask.summary && editTask.summary !== 'Sin descripción' ? editTask.summary : ''
      if (canShowMotivos) {
        const parsed = parseDescripcionYMotivos(raw)
        setObservaciones(parsed.descripcion)
        setMotivos(parsed.motivos)
      } else {
        setObservaciones(raw)
        setMotivos('')
      }
      setDriveLink(editTask.driveUrl ?? '')
      setUbicacionLink(editTask.locationUrl ?? '')
      setPrioridad(editTask.priority === 'alta' ? 'Alta' : 'Normal')
      setPlanillaPreliminar(editTask.planillaPreliminar ?? false)
      setPresupuestoArmado(editTask.presupuestoArmado ?? false)
      setPresupuestoEnviado(editTask.presupuestoEnviadoCliente ?? false)
      setPresupuestoEnEspera(editTask.presupuestoEnEspera ?? false)
      setHydratedFichaPdfUrl(editTask.fichaTecnicaPdfUrl?.trim() || null)
      setAdjuntos([])
      const ordenId = parseTaskIdToOrdenId(editTask.id)
      if (ordenId) {
        void (async () => {
          const needsOrden = !editTask.fichaTecnicaPdfUrl?.trim()
          const [archRes, ordenRes] = await Promise.all([
            apiService.getArchivosOrden(ordenId),
            needsOrden ? apiService.getOrden(ordenId) : Promise.resolve(null)
          ])
          const archivos = archRes.success && Array.isArray(archRes.data) ? archRes.data : []
          if (archivos.length > 0) {
            setAdjuntos(
              archivos.map((row: { id?: number; titulo?: string; url?: string }) => ({
                id: `db-${row.id}`,
                name: String(row.titulo || 'Archivo'),
                remoteUrl: String(row.url || ''),
                uploading: false,
                type: String(row.titulo || '').toLowerCase().endsWith('.pdf')
                  ? 'application/pdf'
                  : undefined,
                dbId: typeof row.id === 'number' ? row.id : undefined
              }))
            )
          }
          if (ordenRes?.success && ordenRes.data) {
            const o = ordenRes.data
            const pdf = o.ficha_tecnica_pdf_url?.trim()
            if (pdf) setHydratedFichaPdfUrl(pdf)
            if (o.planilla_preliminar != null) setPlanillaPreliminar(Boolean(o.planilla_preliminar))
            if (o.presupuesto_armado != null) setPresupuestoArmado(Boolean(o.presupuesto_armado))
            if (o.presupuesto_enviado_cliente != null) {
              setPresupuestoEnviado(Boolean(o.presupuesto_enviado_cliente))
            }
            if (o.presupuesto_en_espera != null) {
              setPresupuestoEnEspera(Boolean(o.presupuesto_en_espera))
            }
          }
        })()
      }
    } else {
      setNombreCliente('')
      setDatosContacto('')
      setUbicacionTexto('')
      setObservaciones('')
      setMotivos('')
      setDriveLink('')
      setUbicacionLink('')
      setPrioridad('Normal')
      setPlanillaPreliminar(false)
      setPresupuestoArmado(false)
      setPresupuestoEnviado(false)
      setPresupuestoEnEspera(false)
      setAdjuntos([])
      setHydratedFichaPdfUrl(null)
    }
  }, [editTask, canShowMotivos])

  const pdfPreviewUrl = useMemo(() => {
    if (!isEditMode) return null
    const fromHydrated = hydratedFichaPdfUrl?.trim()
    if (fromHydrated) return fromHydrated
    const fromTask = editTask?.fichaTecnicaPdfUrl?.trim()
    if (fromTask) return fromTask
    const pdfAdj = adjuntos.find(
      (a) =>
        a.remoteUrl &&
        ((a.type || '').toLowerCase().includes('pdf') ||
          a.name.toLowerCase().endsWith('.pdf'))
    )
    return pdfAdj?.remoteUrl?.trim() || null
  }, [isEditMode, hydratedFichaPdfUrl, editTask?.fichaTecnicaPdfUrl, adjuntos])

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
    setUbicacionTexto(clienteSeleccionado.direccion || '')
    setDriveLink(clienteSeleccionado.drive_link || '')
    setUbicacionLink(clienteSeleccionado.ubicacion_link || '')
    setClientesEncontrados([])
    setIsClienteDropdownOpen(false)
  }

  const uploadAdjunto = async (id: string, file: File) => {
    // Marcar subiendo
    setAdjuntos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, uploading: true, error: undefined } : a))
    )
    try {
      const url = await uploadAttachmentAndGetUrl(file, 'fichas-tecnicas')
      setAdjuntos((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, remoteUrl: url, uploading: false } : a))
        adjuntosRef.current = next
        return next
      })
    } catch (error) {
      console.error('Error subiendo adjunto:', error)
      setAdjuntos((prev) => {
        const next = prev.map((a) =>
          a.id === id ? { ...a, uploading: false, error: 'Error al subir. Reintentar.' } : a
        )
        adjuntosRef.current = next
        return next
      })
    }
  }

  const uploadAdjuntoById = async (id: string) => {
    const current = adjuntosRef.current.find((a) => a.id === id)
    if (!current?.file) return
    if (current.remoteUrl) return
    if (current.uploading) return
    await uploadAdjunto(id, current.file)
  }

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0) return

    const nuevos = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      uploading: false,
      type: file.type,
      file
    }))
    // IMPORTANTE: actualizar ref en el mismo tick antes de arrancar uploads
    setAdjuntos((prev) => {
      const next = [...prev, ...nuevos]
      adjuntosRef.current = next
      return next
    })
    e.target.value = ''

    // Subir automáticamente (sin esperar a "Crear")
    for (const n of nuevos) {
      // Usar el File directo para evitar carreras de estado
      void uploadAdjunto(n.id, n.file!)
    }
  }

  const handleRemoveAdjunto = async (id: string) => {
    const row = adjuntosRef.current.find((a) => a.id === id)
    if (row?.dbId) {
      const res = await apiService.eliminarArchivoOrden(row.dbId)
      if (!res.success) {
        alert(res.error || 'No se pudo eliminar el archivo')
        return
      }
    }
    setAdjuntos((prev) => prev.filter((a) => a.id !== id))
  }

  const uploadAdjuntosPendientes = async (): Promise<
    Array<{ id: string; name: string; remoteUrl: string; type?: string }>
  > => {
    const pendientes = adjuntosRef.current.filter((a) => a.file && !a.remoteUrl && !a.uploading)
    for (const item of pendientes) {
      await uploadAdjuntoById(item.id)
    }

    const finalAdjuntos = adjuntosRef.current
      .filter((a) => a.remoteUrl)
      .map((a) => ({ id: a.id, name: a.name, remoteUrl: a.remoteUrl!, type: a.type }))

    return finalAdjuntos
  }

  const handleCreate = async () => {
    if (!nombreCliente.trim()) {
      alert('El nombre del cliente es requerido')
      return
    }

    // Subir adjuntos antes de crear (para no perder archivos)
    let adjuntosSubidos: Array<{ id: string; name: string; remoteUrl: string; type?: string }> = []
    try {
      adjuntosSubidos = await uploadAdjuntosPendientes()
    } catch (error) {
      console.error('Error subiendo adjuntos:', error)
      alert('Error al subir los archivos. Intenta nuevamente.')
      return
    }

    // Buscar o crear el cliente si no existe
    let clienteFinal: ClienteRecord | null = null
    
    // Primero buscar si el cliente existe
    const buscarResponse = await apiService.buscarClientes(nombreCliente.trim())
    if (buscarResponse.success && buscarResponse.data && buscarResponse.data.length > 0) {
      // Buscar coincidencia exacta por nombre
      clienteFinal = buscarResponse.data.find(c => 
        c.nombre.toLowerCase().trim() === nombreCliente.toLowerCase().trim()
      ) || buscarResponse.data[0]
    }

    // Si no existe, crearlo
    if (!clienteFinal) {
      const crearResponse = await apiService.buscarOCrearCliente({
        nombre: nombreCliente.trim(),
        telefono: datosContacto.trim() || undefined,
        direccion: ubicacionTexto.trim() || undefined,
        drive_link: driveLink.trim() || undefined,
        ubicacion_link: ubicacionLink.trim() || undefined
      })

      if (!crearResponse.success || !crearResponse.data) {
        alert(crearResponse.error || 'Error al crear el cliente')
        return
      }

      clienteFinal = crearResponse.data
    }

    const creatorName = usuario?.nombre?.split('@')[0] || usuario?.nombre || 'Usuario'
    
    // El número de ficha se generará automáticamente en la base de datos
    // Solo enviamos 'FICHA-' como prefijo para que la función lo detecte
    const descripcionFinal = buildDescripcionConMotivos(observaciones, '')
    const payload = {
      numero_op: 'FICHA-', // La base de datos generará el número completo automáticamente
      cliente: clienteFinal.nombre,
      descripcion: descripcionFinal || null,
      estado: 'Asesor Técnico',
      prioridad: prioridad,
      sector: 'Asesor Técnico',
      sectores: ['Asesor Técnico'],
      sector_inicial: 'Asesor Técnico',
      nombre_creador: creatorName,
      telefono_cliente: clienteFinal.telefono || datosContacto.trim() || null,
      direccion_cliente: clienteFinal.direccion || ubicacionTexto.trim() || null,
      drive_link: clienteFinal.drive_link || driveLink.trim() || null,
      ubicacion_link: clienteFinal.ubicacion_link || ubicacionLink.trim() || null,
      es_ficha_no_op: true,
      planilla_preliminar: planillaPreliminar,
      // Mantener compatibilidad: si hay PDFs adjuntos, guardar el primero como ficha técnica principal
      ficha_tecnica_pdf_url:
        adjuntosSubidos.find((a) => (a.type || '').toLowerCase() === 'application/pdf')?.remoteUrl ||
        null
    }

    try {
      const response = await apiService.createOrden(payload as any)
      if (!response.success) {
        const err = response.error || 'Error al crear la ficha'
        if (err.includes('ux_ordenes_op_sector') || err.includes('duplicate key')) {
          alert(
            'No se pudo crear la ficha: ya existe en la base el mismo número y sector (p. ej. Asesor Técnico).\n\n' +
              'Buscá la ficha en Historial / finalizadas para editarla, o avisá a sistemas si el problema sigue tras reintentar.'
          )
        } else {
          alert(err)
        }
        return
      }

      broadcastOrdenesChanged()

      const created = response.data
      const ordenId = created?.id
      if (ordenId && adjuntosSubidos.length > 0) {
        // Guardar adjuntos en la ficha (enlaces_adjuntos)
        await Promise.all(
          adjuntosSubidos.map((a) => apiService.guardarArchivoOrden(ordenId, a.name, a.remoteUrl))
        )
      }
      if (created?.numero_op && created?.cliente) {
        setQrPrintData({ opNumber: created.numero_op, cliente: created.cliente })
      } else {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Error creando ficha:', error)
      alert('Error al crear la ficha')
    }
  }

  const handleUpdate = async () => {
    if (!editTask) return
    if (!nombreCliente.trim()) {
      alert('El nombre del cliente es requerido')
      return
    }
    const ordenId = parseTaskIdToOrdenId(editTask.id)
    if (!ordenId) {
      alert('No se pudo identificar la orden')
      return
    }

    try {
      await uploadAdjuntosPendientes()
    } catch (error) {
      console.error('Error subiendo adjuntos:', error)
      alert('Error al subir los archivos. Intenta nuevamente.')
      return
    }

    const adjSubidos = adjuntosRef.current.filter((a) => a.remoteUrl)
    const firstPdf = adjSubidos.find((a) => (a.type || '').toLowerCase() === 'application/pdf')

    const descripcionFinal = buildDescripcionConMotivos(observaciones, canShowMotivos ? motivos : '')
    const merged: Task = {
      ...editTask,
      title: nombreCliente.trim(),
      summary: descripcionFinal || 'Sin descripción',
      clientPhone: datosContacto.trim() || undefined,
      clientAddress: ubicacionTexto.trim() || undefined,
      driveUrl: driveLink.trim() || undefined,
      locationUrl: ubicacionLink.trim() || undefined,
      priority: prioridad === 'Alta' ? 'alta' : 'media',
      planillaPreliminar,
      fichaTecnicaPdfUrl: firstPdf?.remoteUrl ?? editTask.fichaTecnicaPdfUrl ?? undefined,
      presupuestoArmado,
      presupuestoEnviadoCliente: presupuestoEnviado,
      presupuestoEnEspera
    }

    const payload = taskToOrdenPayload(merged)
    const response = await apiService.updateOrden(ordenId, payload)
    if (!response.success) {
      alert(response.error || 'Error al guardar la ficha')
      return
    }

    for (const a of adjuntosRef.current) {
      if (a.file && a.remoteUrl && !a.dbId) {
        await apiService.guardarArchivoOrden(ordenId, a.name, a.remoteUrl)
      }
    }

    broadcastOrdenesChanged()
    onSuccess()
    onClose()
  }

  const handlePrimaryAction = () => {
    if (isEditMode) {
      void handleUpdate()
    } else {
      void handleCreate()
    }
  }

  const handleCloseQR = () => {
    setQrPrintData(null)
    onSuccess()
    onClose()
  }

  return (
    <>
      {!qrPrintData && (
      <div
        className="ficha-no-op-modal-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        onTouchStart={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="ficha-no-op-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ficha-no-op-modal-header">
          <h2>
            {isEditMode
              ? `Editar ficha${editTask?.opNumber ? ` · ${editTask.opNumber}` : ''}`
              : 'Crear Nueva Ficha'}
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="ficha-no-op-modal-body">
          {isEditMode && pdfPreviewUrl && (
            <div className="form-group">
              <label>Ficha técnica (PDF)</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.open(pdfPreviewUrl, '_blank', 'noopener,noreferrer')}
                >
                  Ver
                </button>
                <a
                  className="btn-secondary"
                  href={pdfPreviewUrl}
                  download={`Ficha-Tecnica-${editTask?.opNumber || 'sin-op'}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar
                </a>
              </div>
              <iframe
                src={pdfPreviewUrl}
                title={`Ficha técnica ${editTask?.opNumber || ''}`}
                style={{
                  width: '100%',
                  height: 420,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 10,
                  background: '#fff'
                }}
              />
            </div>
          )}

          {isEditMode && (
            <div className="form-group">
              <label>Checklist (Presupuestos)</label>
              <div className="checklist-section">
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={presupuestoArmado}
                    onChange={async (e) => {
                      if (!editTask) return
                      const ordenId = parseTaskIdToOrdenId(editTask.id)
                      if (!ordenId) return
                      const nuevo = e.target.checked
                      setPresupuestoArmado(nuevo)
                      await apiService.updateOrden(ordenId, { presupuesto_armado: nuevo })
                      if (nuevo) {
                        await apiService.notificarChecklistFichaNoOP(
                          ordenId,
                          'presupuesto_armado',
                          editTask.opNumber || 'Sin ficha'
                        )
                      }
                    }}
                  />
                  <span>ARMADO</span>
                </label>

                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={presupuestoEnviado}
                    onChange={async (e) => {
                      if (!editTask) return
                      const ordenId = parseTaskIdToOrdenId(editTask.id)
                      if (!ordenId) return
                      const nuevo = e.target.checked
                      setPresupuestoEnviado(nuevo)
                      await apiService.updateOrden(ordenId, { presupuesto_enviado_cliente: nuevo })
                      if (nuevo) {
                        await apiService.notificarChecklistFichaNoOP(
                          ordenId,
                          'presupuesto_enviado',
                          editTask.opNumber || 'Sin ficha'
                        )
                      }
                    }}
                  />
                  <span>ENVIADO</span>
                </label>

                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={presupuestoEnEspera}
                    onChange={async (e) => {
                      if (!editTask) return
                      const ordenId = parseTaskIdToOrdenId(editTask.id)
                      if (!ordenId) return
                      const nuevo = e.target.checked
                      setPresupuestoEnEspera(nuevo)
                      await apiService.updateOrden(ordenId, { presupuesto_en_espera: nuevo })
                      if (nuevo) {
                        await apiService.notificarChecklistFichaNoOP(
                          ordenId,
                          'presupuesto_en_espera',
                          editTask.opNumber || 'Sin ficha'
                        )
                      }
                    }}
                  />
                  <span>EN ESPERA</span>
                </label>
              </div>
            </div>
          )}

          {canShowMotivos && (
            <div className="form-group">
              <label className="motivos-label">Motivos</label>
              <textarea
                placeholder="Motivos (por qué no aprueba / por qué queda en espera / etc.)"
                value={motivos}
                onChange={(e) => setMotivos(e.target.value)}
                rows={4}
              />
            </div>
          )}

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
              {nombreCliente.trim().length >= 2 && 
               !buscandoClientes && 
               clientesEncontrados.length === 0 && 
               isClienteDropdownOpen && (
                <div className="cliente-dropdown">
                  <div className="dropdown-item crear-nuevo">
                    <div className="cliente-nombre">➕ Crear nuevo cliente: "{nombreCliente}"</div>
                    <div className="cliente-info">Se creará automáticamente al guardar la ficha</div>
                  </div>
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
          <label>Ubicación del Cliente (Dirección)</label>
          <input
            type="text"
            placeholder="Dirección (calle, nro, localidad, etc.)"
            value={ubicacionTexto}
            onChange={(e) => setUbicacionTexto(e.target.value)}
          />
        </div>

          <div className="form-group">
            <label>Ubicación del Cliente (Opcional)</label>
            <input
              type="text"
              placeholder="Link de ubicación (Google Maps)"
              value={ubicacionLink}
              onChange={(e) => setUbicacionLink(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Observaciones</label>
            <textarea
              placeholder="Observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group ficha-relevos-link">
            <a
              href="https://drive.google.com/drive/folders/1oKUBRK--_CHznUs4OZUkdIxlEwzpiuZp"
              target="_blank"
              rel="noopener noreferrer"
              className="link-relevos"
            >
              📷 Ver fotos de relevos
            </a>
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
            <label>Prioridad</label>
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
            </select>
          </div>

          <div className="form-group">
          <label>Archivos (se pueden subir varios)</label>
            <div className="file-upload-section">
              <input
                ref={fileInputRef}
                type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={handleFilesSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="select-file-button"
                onClick={() => fileInputRef.current?.click()}
              >
              Seleccionar archivos
              </button>

            {adjuntos.length === 0 ? (
              <span className="file-name">Ningún archivo seleccionado</span>
            ) : (
              <div className="ficha-adjunto-list">
                {adjuntos.map((a) => (
                  <div key={a.id} className="ficha-adjunto-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="ficha-adjunto-name">{a.name}</div>
                      <div className="ficha-adjunto-status">
                        {a.uploading
                          ? 'Subiendo…'
                          : a.remoteUrl
                            ? 'Listo'
                            : a.error
                              ? a.error
                              : 'Pendiente'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ficha-adjunto-eliminar"
                      onClick={() => void handleRemoveAdjunto(a.id)}
                      disabled={a.uploading}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          <div className="form-group checkbox-group checkbox-relevos">
            <label className={`checkbox-label checkbox-relevos-label ${planillaPreliminar ? 'checkbox-relevos-checked' : ''}`}>
              <input
                type="checkbox"
                checked={planillaPreliminar}
                onChange={(e) => setPlanillaPreliminar(e.target.checked)}
                className="checkbox-relevos-input"
              />
              <div className="checkbox-relevos-content">
                <span className="checkbox-relevos-text">
                  {planillaPreliminar && <span className="checkbox-check-icon">✓ </span>}
                  Relevos / Planilla Preliminar
                </span>
                <span className="checkbox-relevos-hint">Indica que la ficha está lista para que el otro sector avance</span>
              </div>
            </label>
          </div>
        </div>

        <div className="ficha-no-op-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="create-button" onClick={handlePrimaryAction}>
            {isEditMode ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
        </div>
      </div>
      )}
      {qrPrintData && (
        <QRPrintView
          opNumber={qrPrintData.opNumber}
          cliente={qrPrintData.cliente}
          onClose={handleCloseQR}
        />
      )}
    </>
  )
}

export default FichaNoOPModal

