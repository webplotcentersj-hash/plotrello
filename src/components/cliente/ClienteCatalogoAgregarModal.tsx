import { useEffect, useState } from 'react'
import type { ArticuloEmpresaRecord } from '../../types/api'
import apiService from '../../services/api'
import {
  type CarritoArchivoRef,
  type CarritoBriefProducto,
  type CarritoItemExtra,
  setCarritoItemExtra
} from '../../services/clienteCarritoExtras'
import './ClienteCatalogoAgregarModal.css'

const MAX_ARCHIVOS = 8
const MAX_MB = 50

type Props = {
  articulo: ArticuloEmpresaRecord
  clienteId: number
  onClose: () => void
  onConfirmado: () => void
}

const BRIEF_VACIO: CarritoBriefProducto = {
  objetivo: '',
  estilo: '',
  cantidades: '',
  referencias: '',
  notas: ''
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
  const [brief, setBrief] = useState<CarritoBriefProducto>({ ...BRIEF_VACIO })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !subiendo && !guardando) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, subiendo, guardando])

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
      if (!brief.objetivo.trim()) {
        setError('Completá el objetivo del diseño')
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
      onConfirmado()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="cca-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="cca-modal"
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
        <p className="cca-modal__sub">
          Indicá si aportás diseño o si necesitás que lo hagamos nosotros.
        </p>

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
                <span>Completás un brief y lo adjuntamos al pedido</span>
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

        {paso === 'brief' && tieneDiseno === false && (
          <div className="cca-paso">
            <button type="button" className="cca-back" onClick={() => setPaso('diseno')}>
              ← Volver
            </button>
            <p className="cca-paso__pregunta">Brief de diseño — {articulo.nombre}</p>

            <label className="cca-field">
              <span>Objetivo del pie *</span>
              <textarea
                rows={2}
                value={brief.objetivo}
                onChange={(e) => setBrief({ ...brief, objetivo: e.target.value })}
                placeholder="¿Para qué lo vas a usar? ¿Qué mensaje debe comunicar?"
              />
            </label>

            <label className="cca-field">
              <span>Estilo / colores</span>
              <input
                type="text"
                value={brief.estilo}
                onChange={(e) => setBrief({ ...brief, estilo: e.target.value })}
                placeholder="Moderno, corporativo, colores de marca…"
              />
            </label>

            <label className="cca-field">
              <span>Cantidades y medidas</span>
              <input
                type="text"
                value={brief.cantidades}
                onChange={(e) => setBrief({ ...brief, cantidades: e.target.value })}
                placeholder="Ej: 100 unidades, 3x2 m, A4…"
              />
            </label>

            <label className="cca-field">
              <span>Referencias (links o descripción)</span>
              <textarea
                rows={2}
                value={brief.referencias}
                onChange={(e) => setBrief({ ...brief, referencias: e.target.value })}
                placeholder="Enlaces, marcas de referencia, ejemplos que te gusten…"
              />
            </label>

            <label className="cca-field">
              <span>Notas adicionales</span>
              <textarea
                rows={2}
                value={brief.notas}
                onChange={(e) => setBrief({ ...brief, notas: e.target.value })}
                placeholder="Cualquier detalle extra para el equipo de diseño"
              />
            </label>

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
              disabled={guardando || subiendo || !brief.objetivo.trim()}
              onClick={() => void validarYGuardar()}
            >
              {guardando ? 'Agregando…' : 'Agregar al carrito con brief'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
