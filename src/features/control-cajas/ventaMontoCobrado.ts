import { supabase } from '../../services/supabaseClient'
import type { VentaCajaSyncRecord } from './plotlabVentaCajaSync'

/** Monto que impacta caja: total si Pagado; parcial real si Parcial. */
export async function montoCobradoVenta(venta: VentaCajaSyncRecord): Promise<number> {
  const total = Number(venta.valor_total) || 0
  if (total <= 0) return 0
  if (venta.estado_pago === 'Pagado') return total

  if (venta.estado_pago === 'Parcial') {
    const directo = Number(venta.monto_pagado)
    if (Number.isFinite(directo) && directo > 0) return Math.min(directo, total)

    if (supabase) {
      const { data: factura } = await supabase
        .from('facturas_venta')
        .select('id')
        .eq('id_venta', venta.id)
        .maybeSingle()

      if (factura?.id) {
        const { data: cxc } = await supabase
          .from('cuentas_por_cobrar')
          .select('monto_pagado')
          .eq('id_factura', factura.id)
          .maybeSingle()
        const pagado = Number(cxc?.monto_pagado) || 0
        if (pagado > 0) return Math.min(pagado, total)
      }
    }
    return 0
  }

  return total
}
