import type { EmbedPresupuestoPayload } from './embedChatShared'
import { formatArgentinaDate } from './dateUtils'
import {
  buildPresupuestoPlanillaPdf,
  downloadPresupuestoPlanillaPdf,
  type PresupuestoPlanillaPayload
} from './presupuestoPlanillaPdf'

function toPlanillaPayload(presupuesto: EmbedPresupuestoPayload): PresupuestoPlanillaPayload {
  const fechaYaLegible = (v: string) => /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v.trim())
  return {
    numero: presupuesto.numero,
    fecha: fechaYaLegible(presupuesto.fecha)
      ? presupuesto.fecha
      : formatArgentinaDate(presupuesto.fecha),
    validez_hasta: presupuesto.validez_hasta
      ? fechaYaLegible(presupuesto.validez_hasta)
        ? presupuesto.validez_hasta
        : formatArgentinaDate(presupuesto.validez_hasta)
      : null,
    cliente_nombre: presupuesto.cliente_nombre,
    cliente_telefono: presupuesto.cliente_telefono,
    lista_label: presupuesto.lista_label,
    items: presupuesto.items.map((item) => ({
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal
    })),
    total: presupuesto.total,
    notas: presupuesto.notas
  }
}

/** PDF sobre la planilla oficial /PRESUPUESTO.pdf (misma que ventas y /presupuesto). */
export async function buildEmbedPresupuestoPdf(presupuesto: EmbedPresupuestoPayload) {
  return buildPresupuestoPlanillaPdf(toPlanillaPayload(presupuesto))
}

export async function downloadEmbedPresupuestoPdf(presupuesto: EmbedPresupuestoPayload): Promise<void> {
  await downloadPresupuestoPlanillaPdf(
    toPlanillaPayload(presupuesto),
    `presupuesto-${presupuesto.numero}.pdf`
  )
}
