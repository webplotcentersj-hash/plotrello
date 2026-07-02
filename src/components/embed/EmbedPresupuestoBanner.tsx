import { useState } from 'react'
import type { EmbedPresupuestoPayload } from '../../utils/embedChatShared'
import { downloadEmbedPresupuestoPdf } from '../../utils/embedPresupuestoPdf'

function formatArs(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export function EmbedPresupuestoBanner({ presupuesto }: { presupuesto: EmbedPresupuestoPayload }) {
  const [downloading, setDownloading] = useState(false)

  const onDownload = async () => {
    setDownloading(true)
    try {
      await downloadEmbedPresupuestoPdf(presupuesto)
    } catch {
      window.alert('No se pudo generar el PDF. Intentá de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="embed-brief-banner embed-presupuesto-banner">
      <div className="embed-brief-text">
        <strong>Presupuesto {presupuesto.numero}</strong>
        {presupuesto.items.map((item, idx) => (
          <span key={`${item.codigo || item.descripcion}-${idx}`}>
            {item.cantidad} x {item.descripcion}: {formatArs(item.subtotal)}
          </span>
        ))}
        <span className="embed-presupuesto-total">Total referencial: {formatArs(presupuesto.total)}</span>
      </div>
      <button
        type="button"
        className="embed-brief-button"
        onClick={() => void onDownload()}
        disabled={downloading}
      >
        {downloading ? 'Generando…' : 'Descargar PDF'}
      </button>
    </div>
  )
}
