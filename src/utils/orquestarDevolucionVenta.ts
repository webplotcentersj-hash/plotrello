import apiService from '../services/api'
import { syncDevolucionVentaPlotLabACaja } from '../features/control-cajas/plotlabVentaCajaSync'
import { getArgentinaDateString } from './dateUtils'
import { anularFacturaAfip } from './anularFacturaAfip'
import {
  clampMontoDevolucion,
  esDevolucionTotalDinero,
  estadoPagoTrasDevolucion,
  montoCobradoVentaLocal
} from './devolucionVentaLogica'
import type { FacturaItemRecord, FacturaVentaRecord, Venta } from '../types/api'

export type DevolucionVentaInput = {
  venta: Venta
  emitirNc: boolean
  devolverDinero: boolean
  cancelarVenta: boolean
  montoDevolver: number
  motivo: string
  actorId: number
  actorNombre: string
  esAdmin?: boolean
}

export type DevolucionVentaResult = {
  ok: boolean
  mensaje: string
  notaId?: number
}

export async function orquestarDevolucionVenta(
  input: DevolucionVentaInput
): Promise<DevolucionVentaResult> {
  const motivo = input.motivo.trim()
  if (!motivo) return { ok: false, mensaje: 'Escribí el motivo de la devolución.' }
  if (!input.emitirNc && !input.devolverDinero) {
    return { ok: false, mensaje: 'Elegí nota de crédito, devolución de dinero, o ambas.' }
  }

  const cobrado = montoCobradoVentaLocal(input.venta)
  const monto = input.devolverDinero ? clampMontoDevolucion(input.montoDevolver, cobrado) : 0
  if (input.devolverDinero && monto <= 0) {
    return { ok: false, mensaje: 'No hay cobro para devolver, o el monto no es válido.' }
  }

  const partes: string[] = []
  let notaId: number | undefined

  if (input.emitirNc) {
    const fac = await apiService.getFacturaAutorizadaPorVenta(input.venta.id)
    if (!fac.success || !fac.data) {
      return { ok: false, mensaje: fac.error || 'Esta venta no tiene una factura AFIP autorizada para acreditar.' }
    }
    const nc = await anularFacturaAfip(fac.data as FacturaVentaRecord & { items?: FacturaItemRecord[] })
    if (!nc.ok) return { ok: false, mensaje: nc.mensaje, notaId: nc.notaId }
    notaId = nc.notaId
    partes.push(nc.mensaje)
  }

  if (input.devolverDinero) {
    const caja = await syncDevolucionVentaPlotLabACaja({
      ventaId: input.venta.id,
      numeroVenta: input.venta.numero_venta,
      clienteNombre: input.venta.cliente_nombre,
      monto,
      metodoPago: input.venta.metodo_pago || 'Otro',
      fecha: getArgentinaDateString(),
      usuarioId: input.venta.id_vendedor || input.actorId,
      usuarioNombre: input.actorNombre,
      cajaSlug: input.venta.caja_slug_cobro || undefined,
      motivo,
      mpPaymentId: input.venta.mp_payment_id || input.venta.detalle_pago?.mp_payment_id || null
    })
    if (!caja.ok) return { ok: false, mensaje: caja.error, notaId }
    partes.push(
      caja.yaExistia
        ? `Devolución de $ ${monto.toLocaleString('es-AR')} ya estaba en caja.`
        : `Devolución de $ ${monto.toLocaleString('es-AR')} registrada en caja.`
    )
    if (/mercado\s*pago/i.test(String(input.venta.metodo_pago)) || input.venta.mp_payment_id) {
      partes.push('El reintegro en Mercado Pago hay que hacerlo en el panel de MP.')
    }
  }

  const fullCash = input.devolverDinero && esDevolucionTotalDinero(monto, cobrado)
  const cancelar = input.cancelarVenta || fullCash

  if (cancelar) {
    const stock = await apiService.devolverStockVentaCompleta(input.venta.id)
    if (stock.success === false) {
      partes.push(stock.error || 'No se pudo devolver el stock.')
    } else if (stock.data && stock.data > 0) {
      partes.push(`Stock devuelto (${stock.data} ítem/s).`)
    }
    const anular = await apiService.anularVentaConMotivo(input.venta.id, `Devolución: ${motivo}`, {
      sincronizarCaja: input.devolverDinero
    })
    if (!anular.success) {
      return { ok: false, mensaje: anular.error || 'No se pudo cancelar la venta.', notaId }
    }
    partes.push('Venta cancelada.')
  } else if (input.devolverDinero) {
    const estado = estadoPagoTrasDevolucion({
      cobradoAntes: cobrado,
      montoDevuelto: monto,
      cancelarVenta: false
    })
    const queda = Math.max(0, Math.round((cobrado - monto) * 100) / 100)
    const upd = await apiService.actualizarVenta(input.venta.id, {
      estado_pago: estado,
      monto_pagado: queda > 0 ? queda : 0,
      observaciones: [input.venta.observaciones, `Devolución ${getArgentinaDateString()}: ${motivo}`]
        .filter(Boolean)
        .join('\n')
    })
    if (!upd.success) return { ok: false, mensaje: upd.error || 'No se pudo actualizar la venta.', notaId }
    partes.push(
      estado === 'Pendiente'
        ? 'Quedó sin cobro pendiente de rearmar.'
        : `Queda cobrado $ ${queda.toLocaleString('es-AR')}.`
    )
  }

  return { ok: true, mensaje: partes.join(' '), notaId }
}
