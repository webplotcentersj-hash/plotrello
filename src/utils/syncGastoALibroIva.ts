import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import {
  gastoPuedeIrALibroIva,
  inferirAlicuotaIva,
  letraDesdeAlicuota,
  netoEIvaDesdeTotal,
  parseComprobanteAfip
} from './gastoIvaLibro'

export async function syncGastoALibroIva(input: {
  gastoId: number
  fecha: string
  proveedor: string | null
  cuit?: string | null
  descripcion: string | null
  total: number
  iva: number | null
  neto: number | null
  numero_comprobante?: string | null
  punto_venta?: number | null
  letra?: string | null
  iva_porcentaje?: number | null
  tipo_comprobante?: string | null
}): Promise<{ ok: boolean; omitido?: boolean; id_factura_compra?: number; error?: string }> {
  if (!gastoPuedeIrALibroIva(input.iva)) {
    return { ok: true, omitido: true }
  }
  const { neto, iva } = netoEIvaDesdeTotal(input.total, input.iva, input.neto)
  if (iva <= 0.009) return { ok: true, omitido: true }

  const alic =
    input.iva_porcentaje != null && Number(input.iva_porcentaje) > 0
      ? Number(input.iva_porcentaje)
      : inferirAlicuotaIva(neto, iva)
  const parsed = parseComprobanteAfip(input.numero_comprobante)
  const puntoVenta = input.punto_venta && input.punto_venta > 0 ? input.punto_venta : parsed?.punto_venta || 1
  const numero = parsed?.numero && parsed.numero > 0 ? parsed.numero : 800000000 + input.gastoId
  const letraRaw = String(input.letra || letraDesdeAlicuota(alic)).toUpperCase()
  const letra = letraRaw === 'B' || letraRaw === 'C' ? letraRaw : 'A'

  let idProveedor: number | null = null
  const nombre = (input.proveedor || '').trim() || 'Proveedor'
  const cuit = (input.cuit || '').replace(/\D/g, '') || null
  const provs = await apiService.getProveedores(true)
  if (provs.success && Array.isArray(provs.data) && nombre) {
    const n = nombre.toLowerCase()
    const hit = provs.data.find((p) => {
      const rs = String(p.razon_social || p.nombre || '').trim().toLowerCase()
      const cu = String(p.cuit || '').replace(/\D/g, '')
      return rs === n || (cuit && cu === cuit)
    })
    if (hit?.id) idProveedor = Number(hit.id)
  }

  const tipoRaw = String(input.tipo_comprobante || 'Factura').toLowerCase()
  const tipo_comprobante: 'Factura' | 'Nota de Crédito' | 'Nota de Débito' =
    tipoRaw.includes('crédito') || tipoRaw.includes('credito')
      ? 'Nota de Crédito'
      : tipoRaw.includes('débito') || tipoRaw.includes('debito')
        ? 'Nota de Débito'
        : 'Factura'

  const created = await apiService.createFacturaCompra({
    tipo_comprobante,
    letra,
    punto_venta: puntoVenta,
    numero_comprobante: numero,
    fecha_emision: input.fecha.slice(0, 10),
    id_proveedor: idProveedor,
    proveedor_nombre: nombre,
    proveedor_cuit: cuit,
    observaciones: `erp_gasto:${input.gastoId}`,
    items: [
      {
        descripcion: (input.descripcion || nombre).slice(0, 200),
        cantidad: 1,
        precio_unitario: neto,
        descuento: 0,
        iva_porcentaje: alic
      }
    ]
  })
  if (!created.success || !created.data) {
    return { ok: false, error: created.error || 'No se pudo cargar el IVA al libro de compras' }
  }

  if (supabase) {
    await supabase
      .from('erp_gastos')
      .update({
        id_factura_compra: created.data.id,
        proveedor_cuit: cuit,
        numero_comprobante: input.numero_comprobante || `${puntoVenta}-${numero}`,
        punto_venta: puntoVenta,
        letra
      })
      .eq('id', input.gastoId)
  }

  return { ok: true, id_factura_compra: created.data.id }
}
