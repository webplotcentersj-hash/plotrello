import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ArticuloEmpresaRecord } from '../../types/api'
import apiService from '../../services/api'
import {
  emptyClienteBriefForm,
  inferTiposProductoBrief,
  type ClienteBriefFormData
} from '../../constants/clienteBriefForm'
import { useClienteModalLock } from '../../hooks/useClienteModalLock'
import { notifyClienteCarritoUpdated } from '../../hooks/useClienteCarritoBadge'
import {
  type CarritoArchivoRef,
  type CarritoBriefProducto,
  type CarritoItemExtra,
  setCarritoItemExtra
} from '../../services/clienteCarritoExtras'
import ClienteCatalogoBriefForm from './ClienteCatalogoBriefForm'
import './ClienteCatalogoAgregarModal.css'

const MAX_ARCHIVOS = 8
const MAX_MB = 50

type Props = {
  articulo: ArticuloEmpresaRecord
  clienteId: number
  onClose: () => void
  onConfirmado: () => void
}

function briefInicial(articulo: ArticuloEmpresaRecord): CarritoBriefProducto {
  const base = emptyClienteBriefForm()
  const tipos = inferTiposProductoBrief(articulo)
  return { ...base, tipo_producto_servicio: tipos }
}

export default function ClienteCatalogoAgregarModal({
  articulo,
  clienteId,
  onClose,
  onConfirmado
}: Props) {
  const [paso, setPaso] = useState<'diseno' | 'archivos' | 'brief'>('diseno')
  const [tieneDiseno, setTieneDiseno] = useState<boolean | null>(null)
  const [archivos, setArchivos] = useState<CarritoArchivoRef[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [brief, setBrief] = useState<CarritoBriefProducto>(() => briefInicial(articulo))

  useClienteModalLock(true)

  useEffect(() => {
    setBrief(briefInicial(articulo))
    setPaso('diseno')
    setTieneDiseno(null)
    setArchivos([])
    setError('')
  }, [articulo.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !subiendo && !guardando) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, subiendo, guardando])

  const esPasoBrief = paso === 'brief' && tieneDiseno === false
  const modalClass = useMemo(
    () => `cca-modal${esPasoBrief ? ' cca-modal--brief' : ''}`,
    [esPasoBrief]
  )

  const elegirDiseno = (valor: boolean) => {
    setTieneDiseno(valor)
    setError('')
    setPaso(valor ? 'archivos' : 'brief')
  }

  const subirArchivos = async (files: FileList | null) => {
    if (!files?.length) return
    if (archivos.length >= MAX_ARCHIVOS) {
      setError(`Máximo ${MAX_ARCHIVOS} archivos`)
      return
    }

    setSubiendo(true)
    setError('')

    try {
      const nuevos = [...archivos]
      for (const file of Array.from(files)) {
        if (nuevos.length >= MAX_ARCHIVOS) break
        if (file.size > MAX_MB * 1024 * 1024) {
          setError(`"${file.name}" supera ${MAX_MB} MB`)
          continue
        }
        const r = await apiService.uploadArchivoCarritoPendienteCliente(
          file,
          clienteId,
          articulo.id
        )
        if (r.success && r.data) {
          nuevos.push(r.data)
        } else {
          setError(r.error || `No se pudo subir ${file.name}`)
        }
      }
      setArchivos(nuevos)
    } finally {
      setSubiendo(false)
    }
  }

  const quitarArchivo = (idx: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== idx))
  }

  const validarBrief = (data: ClienteBriefFormData): string | null => {
    if (data.tipo_producto_servicio.length === 0 && !data.necesita_asesoramiento) {
      return 'Seleccioná al menos un tipo de producto o marcá que necesitás asesoramiento'
    }
    return null
  }

  const validarYGuardar = async () => {
    setError('')

    if (tieneDiseno === null) {
      setError('Indicá si tenés diseño listo')
      return
    }

    if (tieneDiseno) {
      if (archivos.length === 0) {
        setError('Subí al menos un archivo de diseño')
        return
      }
    } else {
      const briefError = validarBrief(brief)
      if (briefError) {
        setError(briefError)
        return
      }
    }

    setGuardando(true)
    try {
      const carrito = await apiService.getCarritoCliente(clienteId)
      const enCarrito = carrito.data?.items.find((i) => i.id_articulo === articulo.id)
      const nuevaCantidad = (enCarrito?.cantidad || 0) + 1

      const r = await apiService.setCarritoItemCliente(clienteId, articulo.id, nuevaCantidad)
      if (!r.success) {
        setError(r.error || 'No se pudo agregar al carrito')
        return
      }

      const extra: CarritoItemExtra = {
        tieneDiseno,
        archivos,
        brief: tieneDiseno ? undefined : { ...brief }
      }
      setCarritoItemExtra(clienteId, articulo.id, extra)
      notifyClienteCarritoUpdated()
      onConfirmado()
    } finally {
      setGuardando(false)
    }
  }

  const modal = (
    <div className="cca-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cca-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="cca-modal__close"
          onClick={onClose}
          disabled={subiendo || guardando}
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 id="cca-modal-title">Agregar: {articulo.nombre}</h2>
        {!esPasoBrief && (
          <p className="cca-modal__sub">
            Indicá si aportás diseño o si necesitás que lo hagamos nosotros.
          </p>
        )}

        {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

        {paso === 'diseno' && (
          <div className="cca-paso">
            <p className="cca-paso__pregunta">¿Tenés el diseño listo para este producto?</p>
            <div className="cca-opciones">
              <button type="button" className="cca-opcion" onClick={() => elegirDiseno(true)}>
                <strong>Sí, tengo diseño</strong>
                <span>Subo mis archivos (hasta {MAX_MB} MB c/u)</span>
              </button>
              <button type="button" className="cca-opcion" onClick={() => elegirDiseno(false)}>
                <strong>No, necesito diseño</strong>
                <span>Completás el brief como en el resto del sistema</span>
              </button>
            </div>
          </div>
        )}

        {paso === 'archivos' && tieneDiseno && (
          <div className="cca-paso">
            <button type="button" className="cca-back" onClick={() => setPaso('diseno')}>
              ← Volver
            </button>
            <p className="cca-paso__pregunta">Subí tu diseño</p>
            <p className="cca-hint">
              PDF, AI, PSD, JPG, PNG u otros. Hasta {MAX_ARCHIVOS} archivos de {MAX_MB} MB cada uno.
            </p>

            <label className="cca-upload-zone">
              <input
                type="file"
                multiple
                disabled={subiendo || archivos.length >= MAX_ARCHIVOS}
                onChange={(e) => void subirArchivos(e.target.files)}
              />
              {subiendo ? 'Subiendo…' : '📎 Seleccionar archivos'}
            </label>

            {archivos.length > 0 && (
              <ul className="cca-archivos-list">
                {archivos.map((a, idx) => (
                  <li key={`${a.url}-${idx}`}>
                    <span>{a.nombre}</span>
                    <button type="button" onClick={() => quitarArchivo(idx)} aria-label="Quitar">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="cliente-btn-primary"
              disabled={guardando || subiendo || archivos.length === 0}
              onClick={() => void validarYGuardar()}
            >
              {guardando ? 'Agregando…' : 'Agregar al carrito'}
            </button>
          </div>
        )}

        {esPasoBrief && (
          <div className="cca-paso cca-paso--brief">
            <button type="button" className="cca-back" onClick={() => setPaso('diseno')}>
              ← Volver
            </button>

            <div className="cca-brief-scroll">
              <ClienteCatalogoBriefForm
                value={brief}
                onChange={setBrief}
                productoNombre={articulo.nombre}
              />
            </div>

            <label className="cca-upload-zone cca-upload-zone--secondary">
              <input
                type="file"
                multiple
                disabled={subiendo || archivos.length >= MAX_ARCHIVOS}
                onChange={(e) => void subirArchivos(e.target.files)}
              />
              {subiendo ? 'Subiendo…' : '📎 Adjuntar referencias (opcional)'}
            </label>

            {archivos.length > 0 && (
              <ul className="cca-archivos-list">
                {archivos.map((a, idx) => (
                  <li key={`${a.url}-${idx}`}>
                    <span>{a.nombre}</span>
                    <button type="button" onClick={() => quitarArchivo(idx)} aria-label="Quitar">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="cliente-btn-primary"
              disabled={guardando || subiendo}
              onClick={() => void validarYGuardar()}
            >
              {guardando ? 'Agregando…' : 'Agregar al carrito con brief'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
