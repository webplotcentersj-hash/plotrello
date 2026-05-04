import { createPortal } from 'react-dom'
import './OpFichaGuiaModal.css'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Recomendaciones estáticas para llenar la ficha de OP; énfasis en descripción del trabajo.
 */
export default function OpFichaGuiaModal({ open, onClose }: Props) {
  if (!open) return null

  const el = (
    <div
      className="op-ficha-guia-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="op-ficha-guia-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="op-ficha-guia-modal" onClick={(e) => e.stopPropagation()}>
        <header className="op-ficha-guia-header">
          <h2 id="op-ficha-guia-title">Cómo llenar la ficha de la OP</h2>
          <button type="button" className="op-ficha-guia-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="op-ficha-guia-body">
          <div className="op-ficha-guia-destacado" role="note">
            <strong>Descripción del trabajo (obligatoria)</strong>
            <p>
              Es el corazón de la ficha: acá explicás <em>qué hay que hacer</em> con precisión. Sin una buena
              descripción, taller, imprenta e instalaciones pierden tiempo y pueden errar el alcance. Completala siempre
              antes de guardar o crear la OP.
            </p>
            <p>Debería incluir, según corresponda:</p>
            <ul>
              <li>Qué producto o servicio se pide (carteles, ploteo, folletos, estructura, etc.).</li>
              <li>Cantidades, medidas aproximadas, m², formatos, colores, material (vinilo, lona, papel, chapa…).</li>
              <li>Plazos o fecha límite acordada con el cliente.</li>
              <li>Instalación o solo entrega en depósito; si hay visita a domicilio, qué se asume (acceso, altura, fijación).</li>
              <li>Detalles del pedido que no entren en el brief (excepciones, “igual al muestra”, “rechazar si…”).</li>
            </ul>
          </div>

          <h3>Resto de la ficha</h3>
          <ul className="op-ficha-guia-lista">
            <li>
              <strong>Cliente y contacto</strong> — Nombre, teléfono, mail y dirección/ubicación actualizados evitan
              demoras y reclamos.
            </li>
            <li>
              <strong>Sectores requeridos</strong> — Marcá todos los que participan (Diseño, Taller, Instalaciones…); eso
              genera el recorrido en el tablero.
            </li>
            <li>
              <strong>Brief público</strong> (si aplica) — Complementa la descripción con lo que el cliente aportó; no
              reemplaza la descripción operativa del trabajo.
            </li>
            <li>
              <strong>Adjuntos</strong> — Logos, marcas, archivos de corte, fotos del lugar (obligatorias en Instalaciones/
              Metalúrgica según reglas del sistema).
            </li>
            <li>
              <strong>PlotAI “Mejorar descripción”</strong> — Te ayuda a redactar o ordenar texto; revisá siempre el
              resultado y ajustá datos técnicos.
            </li>
          </ul>

          <p className="op-ficha-guia-pie">
            Ante dudas con el cliente, anotá la respuesta en la descripción o en observaciones para que el equipo no
            tenga que adivinar.
          </p>
        </div>
        <footer className="op-ficha-guia-footer">
          <button type="button" className="op-ficha-guia-btn-primary" onClick={onClose}>
            Entendido
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(el, document.body)
}
