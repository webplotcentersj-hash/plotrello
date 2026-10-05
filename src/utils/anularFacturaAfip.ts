import apiService from '../services/api'
import type { FacturaItemRecord, FacturaVentaRecord } from '../types/api'
import { getArgentinaDateString } from './dateUtils'

type FacturaConItems = FacturaVentaRecord & { items?: FacturaItemRecord[] }

function tipoNotaCredito(tipo: string): FacturaVentaRecord['tipo_comprobante'] {
  if (tipo.includes('Factura A')) return 'Nota de Crédito A'
  if (tipo.includes('Factura C')) return 'Nota de Crédito C'
  return 'Nota de Crédito B'
}

/**
 * Un comprobante con CAE no se borra: se anula con una nota de crédito por el total.
 * Un borrador sin CAE se descarta y no se informa a ARCA.
 */
export async function anularFacturaAfip(factura: FacturaConItems): Promise<{ ok: boolean; mensaje: string; notaId?: number }> {
  const autorizada = factura.estado_afip === 'Autorizada'
  const enviando = factura.estado_afip === 'Enviando'

  if (!autorizada) {
    if (factura.estado !== 'Borrador' || enviando || factura.afip_numero_intento) {
      return {
        ok: false,
        mensaje: 'Este comprobante ya salió hacia ARCA. Si tiene CAE, anulado se hace con nota de crédito. Si quedó a medias, reintentá Emitir.'
      }
    }
    const descartada = await apiService.actualizarFactura(factura.id, { estado: 'Anulada' })
    if (!descartada.success) return { ok: false, mensaje: descartada.error || 'No se pudo descartar el borrador.' }
    return { ok: true, mensaje: 'Borrador descartado. ARCA no lo tenía, así que no hace falta nota de crédito.' }
  }

  if (!String(factura.tipo_comprobante).startsWith('Factura')) {
    return { ok: false, mensaje: 'Este comprobante no es una factura. La nota de crédito se emite sobre la factura original.' }
  }

  const origen = factura.items?.length
    ? factura
    : ((await apiService.getFactura(factura.id)).data as FacturaConItems | undefined)
  const lineas = origen?.items || []
  if (!lineas.length) return { ok: false, mensaje: 'La factura no tiene ítems para acreditar.' }

  const items = lineas.map((it) => {
    const cantidad = Number(it.cantidad || 0) || 1
    const totalLinea = Math.abs(Number(it.total || 0))
    const unitario = Math.round((totalLinea / cantidad) * 100) / 100
    const divisible = Math.abs(unitario * cantidad - totalLinea) < 0.005
    return {
      descripcion: divisible || cantidad === 1 ? it.descripcion : `${it.descripcion} (x${cantidad})`,
      cantidad: divisible ? cantidad : 1,
      precio_unitario: divisible ? unitario : totalLinea,
      descuento: 0,
      iva_porcentaje: Number(it.iva_porcentaje ?? 21)
    }
  })

  const creada = await apiService.crearFactura({
    tipo_comprobante: tipoNotaCredito(factura.tipo_comprobante),
    fecha_emision: getArgentinaDateString(),
    id_cliente: factura.id_cliente ?? null,
    cliente_nombre: factura.cliente_nombre,
    cliente_dni_cuit: factura.cliente_dni_cuit || null,
    cliente_direccion: factura.cliente_direccion || null,
    cliente_condicion_iva: factura.cliente_condicion_iva || null,
    id_op: factura.id_op ?? null,
    numero_op: factura.numero_op ?? null,
    id_venta: factura.id_venta ?? null,
    id_factura_referencia: factura.id,
    items,
    precios_con_iva: !String(factura.tipo_comprobante).endsWith(' C'),
    concepto: factura.concepto || 1,
    fecha_servicio_desde: factura.fecha_servicio_desde || null,
    fecha_servicio_hasta: factura.fecha_servicio_hasta || null,
    observaciones: `Anulación de ${factura.tipo_comprobante} ${factura.numero_factura}`
  })
  if (!creada.success || !creada.data) {
    return { ok: false, mensaje: creada.error || 'No se pudo crear la nota de crédito.' }
  }

  const emit = await apiService.emitirFactura(creada.data.id)
  if (!emit.success) {
    return {
      ok: false,
      notaId: creada.data.id,
      mensaje: `La nota quedó en borrador y ARCA no la autorizó. ${emit.error || ''}`.trim()
    }
  }
  const numero = emit.data?.numero_factura || ''
  const cae = emit.data?.cae || emit.data?.numero_cae || ''
  return {
    ok: true,
    notaId: creada.data.id,
    mensaje: `Nota de crédito ${numero} autorizada.${cae ? ` CAE ${cae}.` : ''} La factura original queda anulada en su efecto.`
  }
}
