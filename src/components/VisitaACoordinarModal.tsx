import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { notifyOrdenChangedLocally } from '../utils/ordenLocalSync'
import { parseTaskIdToOrdenId, taskToOrdenPayload } from '../utils/dataMappers'
import type { Task } from '../types/board'
import './FichaNoOPModal.css'

export const SECTOR_VISITAS_A_COORDINAR = 'Visitas a coordinar'

type VisitaACoordinarModalProps = {
  onClose: () => void
  onSuccess: () => void
  editTask?: Task | null
}

/**
 * Alta / edición liviana para la columna «Visitas a coordinar».
 * Luego se puede arrastrar a Asesor Técnico o Presupuestos y completar con FichaNoOPModal.
 */
const VisitaACoordinarModal = ({
  onClose,
  onSuccess,
  editTask = null
}: VisitaACoordinarModalProps) => {
  const { usuario } = useAuth()
  const isEdit = editTask != null

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editTask) {
      setNombre('')
      setTelefono('')
      setUbicacion('')
      setDescripcion('')
      return
    }
    setNombre(editTask.title || '')
    setTelefono(editTask.clientPhone || '')
    setUbicacion(editTask.clientAddress || '')
    setDescripcion(
      editTask.summary && editTask.summary !== 'Sin descripción' ? editTask.summary : ''
    )
  }, [editTask])

  const handleSave = async () => {
    const nombreTrim = nombre.trim()
    if (nombreTrim.length < 2) {
      alert('El nombre es obligatorio.')
      return
    }
    if (telefono.trim().length < 6) {
      alert('El teléfono es obligatorio.')
      return
    }
    if (ubicacion.trim().length < 3) {
      alert('La ubicación es obligatoria.')
      return
    }
    if (descripcion.trim().length < 3) {
      alert('La descripción es obligatoria.')
      return
    }

    setSaving(true)
    try {
      if (isEdit && editTask) {
        const ordenId = parseTaskIdToOrdenId(editTask.id)
        if (!ordenId) {
          alert('No se pudo identificar la ficha.')
          return
        }
        const merged: Task = {
          ...editTask,
          title: nombreTrim,
          summary: descripcion.trim(),
          clientPhone: telefono.trim(),
          clientAddress: ubicacion.trim()
        }
        const payload = taskToOrdenPayload(merged)
        const response = await apiService.updateOrden(ordenId, payload)
        if (!response.success) {
          alert(response.error || 'No se pudo guardar la visita.')
          return
        }
        if (response.data) notifyOrdenChangedLocally(response.data)
        onSuccess()
        onClose()
        return
      }

      const clienteRes = await apiService.buscarOCrearCliente({
        nombre: nombreTrim,
        telefono: telefono.trim(),
        direccion: ubicacion.trim()
      })
      if (!clienteRes.success || !clienteRes.data) {
        alert(clienteRes.error || 'No se pudo crear el cliente.')
        return
      }

      const creatorName = usuario?.nombre?.split('@')[0] || usuario?.nombre || 'Usuario'
      const response = await apiService.createOrden({
        numero_op: 'FICHA-',
        cliente: clienteRes.data.nombre,
        descripcion: descripcion.trim(),
        estado: SECTOR_VISITAS_A_COORDINAR,
        prioridad: 'Normal',
        sector: SECTOR_VISITAS_A_COORDINAR,
        sectores: [SECTOR_VISITAS_A_COORDINAR],
        sector_inicial: SECTOR_VISITAS_A_COORDINAR,
        nombre_creador: creatorName,
        telefono_cliente: telefono.trim() || clienteRes.data.telefono || null,
        direccion_cliente: ubicacion.trim() || clienteRes.data.direccion || null,
        es_ficha_no_op: true
      } as any)

      if (!response.success) {
        alert(response.error || 'No se pudo crear la visita.')
        return
      }
      if (response.data) notifyOrdenChangedLocally(response.data)
      onSuccess()
      onClose()
    } catch (e) {
      console.error(e)
      alert('Error al guardar la visita.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="ficha-no-op-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ficha-no-op-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ficha-no-op-modal-header">
          <h2>
            {isEdit
              ? `Visita a coordinar${editTask?.opNumber ? ` · ${editTask.opNumber}` : ''}`
              : 'Nueva visita a coordinar'}
          </h2>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="ficha-no-op-modal-body">
          <p style={{ margin: '0 0 14px', color: '#334155', fontSize: '0.9rem', lineHeight: 1.45 }}>
            Datos mínimos para agendar. Después podés pasar la tarjeta a{' '}
            <strong>Asesor Técnico</strong> o <strong>Presupuestos</strong> y completar la ficha.
          </p>

          <div className="form-group">
            <label htmlFor="visita-nombre">Nombre *</label>
            <input
              id="visita-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del cliente o contacto"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="visita-tel">Teléfono *</label>
            <input
              id="visita-tel"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="WhatsApp o teléfono"
            />
          </div>

          <div className="form-group">
            <label htmlFor="visita-ubicacion">Ubicación *</label>
            <input
              id="visita-ubicacion"
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Dirección o punto de visita"
            />
          </div>

          <div className="form-group">
            <label htmlFor="visita-desc">Descripción *</label>
            <textarea
              id="visita-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder="Qué hay que medir / coordinar / cotizar…"
            />
          </div>
        </div>

        <div className="ficha-no-op-modal-footer">
          <div className="ficha-no-op-modal-footer__right">
            <button type="button" className="cancel-button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="button"
              className="create-button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear visita'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VisitaACoordinarModal
