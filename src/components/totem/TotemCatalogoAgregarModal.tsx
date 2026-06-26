import { useEffect, useMemo, useState } from 'react'
import type { ArticuloEmpresaRecord } from '../../types/api'
import {
  emptyClienteBriefForm,
  inferTiposProductoBrief,
  type ClienteBriefFormData
} from '../../constants/clienteBriefForm'
import type { CarritoBriefProducto, CarritoItemExtra } from '../../services/clienteCarritoExtras'
import TotemCatalogoBriefForm from './TotemCatalogoBriefForm'
import TotemCatalogoArchivoUpload from './TotemCatalogoArchivoUpload'
import './TotemCatalogoAgregarModal.css'
import './TotemCatalogoBriefForm.css'

type Props = {
  articulo: ArticuloEmpresaRecord
  onClose: () => void
  onConfirmado: (extra: CarritoItemExtra) => void
}

function briefInicial(articulo: ArticuloEmpresaRecord): CarritoBriefProducto {
  const base = emptyClienteBriefForm()
  const tipos = inferTiposProductoBrief(articulo)
  return { ...base, tipo_producto_servicio: tipos }
}

const PASO_LABEL: Record<'diseno' | 'archivos' | 'brief', string> = {
  diseno: 'Paso 1 de 2',
  archivos: 'Paso 2 de 2',
  brief: 'Paso 2 de 2'
}

export default function TotemCatalogoAgregarModal({ articulo, onClose, onConfirmado }: Props) {
  const [paso, setPaso] = useState<'diseno' | 'archivos' | 'brief'>('diseno')
  const [tieneDiseno, setTieneDiseno] = useState<boolean | null>(null)
  const [archivos, setArchivos] = useState<CarritoItemExtra['archivos']>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [brief, setBrief] = useState<CarritoBriefProducto>(() => briefInicial(articulo))

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    setBrief(briefInicial(articulo))
    setPaso('diseno')
    setTieneDiseno(null)
    setArchivos([])
    setError('')
  }, [articulo.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, guardando])

  const esPasoBrief = paso === 'brief' && tieneDiseno === false
  const modalClass = useMemo(
    () =>
      `totem-cat-add-modal${esPasoBrief ? ' totem-cat-add-modal--brief' : ''}${paso === 'archivos' ? ' totem-cat-add-modal--upload' : ''}`,
    [esPasoBrief, paso]
  )

  const elegirDiseno = (valor: boolean) => {
    setTieneDiseno(valor)
    setError('')
    setPaso(valor ? 'archivos' : 'brief')
  }

  const validarBrief = (data: ClienteBriefFormData): string | null => {
    if (data.necesita_asesoramiento) return null
    if (data.tipo_producto_servicio.length === 0) {
      return 'Elegí al menos un tipo de producto o pedí asesoramiento'
    }
    return null
  }

  const confirmar = () => {
    setError('')
    if (tieneDiseno === null) {
      setError('Indicá si tenés diseño listo')
      return
    }
    if (tieneDiseno && archivos.length === 0) {
      setError('Subí al menos un archivo de diseño')
      return
    }
    if (!tieneDiseno) {
      const briefError = validarBrief(brief)
      if (briefError) {
        setError(briefError)
        return
      }
    }

    setGuardando(true)
    try {
      const extra: CarritoItemExtra = {
        tieneDiseno,
        archivos,
        brief: tieneDiseno ? undefined : { ...brief }
      }
      onConfirmado(extra)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="totem-cat-add-overlay" role="presentation" onClick={onClose}>
      <div
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="totem-cat-add-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="totem-cat-add-modal__close"
          onClick={onClose}
          disabled={guardando}
          aria-label="Cerrar"
        >
          ×
        </button>

        <div className="totem-cat-add-modal__head">
          <span className="totem-cat-add-modal__step">{PASO_LABEL[paso]}</span>
          <h2 id="totem-cat-add-modal-title">{articulo.nombre}</h2>
          {paso === 'diseno' && (
            <p className="totem-cat-add-modal__sub">
              Subí tu diseño o contanos qué necesitás — te guiamos paso a paso.
            </p>
          )}
        </div>

        {error && <div className="totem-cat-add-modal__error">{error}</div>}

        <div className="totem-cat-add-modal__body">
          {paso === 'diseno' && (
            <div className="totem-cat-add-modal__paso totem-cat-add-modal__paso--center">
              <p className="totem-cat-add-modal__pregunta">¿Tenés el diseño listo?</p>
              <div className="totem-cat-add-modal__opciones">
                <button
                  type="button"
                  className="totem-cat-add-modal__opcion totem-cat-add-modal__opcion--yes"
                  onClick={() => elegirDiseno(true)}
                >
                  <span className="totem-cat-add-modal__opcion-icon" aria-hidden>
                    📤
                  </span>
                  <strong>Sí, tengo diseño</strong>
                  <span>Subilo por QR del celular o desde esta PC</span>
                </button>
                <button
                  type="button"
                  className="totem-cat-add-modal__opcion totem-cat-add-modal__opcion--no"
                  onClick={() => elegirDiseno(false)}
                >
                  <span className="totem-cat-add-modal__opcion-icon" aria-hidden>
                    ✏️
                  </span>
                  <strong>No, necesito diseño</strong>
                  <span>Completás un brief rápido con botones</span>
                </button>
              </div>
            </div>
          )}

          {paso === 'archivos' && tieneDiseno && (
            <div className="totem-cat-add-modal__paso totem-cat-add-modal__paso--center totem-cat-add-modal__paso--upload">
              <button
                type="button"
                className="totem-cat-add-modal__back"
                onClick={() => setPaso('diseno')}
              >
                ← Volver
              </button>
              <p className="totem-cat-add-modal__pregunta">Subí tu diseño</p>
              <TotemCatalogoArchivoUpload archivos={archivos} onChange={setArchivos} disabled={guardando} />
              <button
                type="button"
                className="totem-cat-add-modal__primary"
                onClick={confirmar}
                disabled={guardando || archivos.length === 0}
              >
                Agregar al carrito
              </button>
            </div>
          )}

          {paso === 'brief' && tieneDiseno === false && (
            <div className="totem-cat-add-modal__paso totem-cat-add-modal__paso--brief">
              <button
                type="button"
                className="totem-cat-add-modal__back"
                onClick={() => setPaso('diseno')}
              >
                ← Volver
              </button>
              <TotemCatalogoBriefForm
                value={brief}
                onChange={setBrief}
                productoNombre={articulo.nombre}
              />
              <button
                type="button"
                className="totem-cat-add-modal__primary"
                onClick={confirmar}
                disabled={guardando}
              >
                Agregar al carrito
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
