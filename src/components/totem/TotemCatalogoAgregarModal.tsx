import { useEffect, useMemo, useState } from 'react'
import type { ArticuloEmpresaRecord } from '../../types/api'
import {
  emptyClienteBriefForm,
  inferTiposProductoBrief,
  type ClienteBriefFormData
} from '../../constants/clienteBriefForm'
import type { CarritoBriefProducto, CarritoItemExtra } from '../../services/clienteCarritoExtras'
import ClienteCatalogoBriefForm from '../cliente/ClienteCatalogoBriefForm'
import TotemCatalogoArchivoUpload from './TotemCatalogoArchivoUpload'
import './TotemCatalogoAgregarModal.css'

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
    () => `totem-cat-modal${esPasoBrief ? ' totem-cat-modal--brief' : ''}`,
    [esPasoBrief]
  )

  const elegirDiseno = (valor: boolean) => {
    setTieneDiseno(valor)
    setError('')
    setPaso(valor ? 'archivos' : 'brief')
  }

  const validarBrief = (data: ClienteBriefFormData): string | null => {
    if (data.tipo_producto_servicio.length === 0 && !data.necesita_asesoramiento) {
      return 'Seleccioná al menos un tipo de producto o marcá que necesitás asesoramiento'
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
    <div className="totem-cat-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="totem-cat-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="totem-cat-modal__close"
          onClick={onClose}
          disabled={guardando}
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 id="totem-cat-modal-title">Agregar: {articulo.nombre}</h2>
        {!esPasoBrief && (
          <p className="totem-cat-modal__sub">
            Igual que en el portal: subí tu diseño o completá el brief para que lo hagamos nosotros.
          </p>
        )}

        {error && <div className="totem-cat-modal__error">{error}</div>}

        {paso === 'diseno' && (
          <div className="totem-cat-modal__paso">
            <p className="totem-cat-modal__pregunta">¿Tenés el diseño listo para este producto?</p>
            <div className="totem-cat-modal__opciones">
              <button type="button" className="totem-cat-modal__opcion" onClick={() => elegirDiseno(true)}>
                <strong>Sí, tengo diseño</strong>
                <span>Subilo por pendrive o con QR desde el celular</span>
              </button>
              <button type="button" className="totem-cat-modal__opcion" onClick={() => elegirDiseno(false)}>
                <strong>No, necesito diseño</strong>
                <span>Completás el brief en pantalla</span>
              </button>
            </div>
          </div>
        )}

        {paso === 'archivos' && tieneDiseno && (
          <div className="totem-cat-modal__paso">
            <button type="button" className="totem-cat-modal__back" onClick={() => setPaso('diseno')}>
              ← Volver
            </button>
            <p className="totem-cat-modal__pregunta">Subí tu diseño</p>
            <TotemCatalogoArchivoUpload archivos={archivos} onChange={setArchivos} disabled={guardando} />
            <button
              type="button"
              className="totem-cat-modal__primary"
              onClick={confirmar}
              disabled={guardando || archivos.length === 0}
            >
              Agregar al carrito
            </button>
          </div>
        )}

        {paso === 'brief' && tieneDiseno === false && (
          <div className="totem-cat-modal__paso totem-cat-modal__paso--brief">
            <button type="button" className="totem-cat-modal__back" onClick={() => setPaso('diseno')}>
              ← Volver
            </button>
            <ClienteCatalogoBriefForm
              value={brief}
              onChange={setBrief}
              productoNombre={articulo.nombre}
            />
            <button type="button" className="totem-cat-modal__primary" onClick={confirmar} disabled={guardando}>
              Agregar al carrito
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
