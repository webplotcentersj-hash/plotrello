import { getArgentinaDateString } from '../../utils/dateUtils'
import { notifyCajaSync } from './cajaSyncNotify'
import { listMovimientos, saveMovimiento } from './cajaRepository'
import { mediosToPlanillaLinea, movimientoDesdeMedios, type MediosPagoInput } from './movimientoCaja'
import { metodoPagoPlotLabAMedios, type MetodoPagoPlotLab } from './plotlabVentaCajaSync'
import type { CajaMovimiento } from './types'

export type PagoCcDetalleMedio = { metodo: string; monto: number }

export type SyncPagoCcACajaAdminInput = {
  idMovimientoCc: number
  monto: number
  fecha: string
  metodoPago: string
  detalleMedios?: PagoCcDetalleMedio[] | null
  clienteNombre: string
  usuarioId?: number
  usuarioNombre?: string
  referencia?: string | null
  urlComprobante?: string | null
  idVenta?: number | null
}

export type SyncPagoCcACajaAdminResult =
  | { ok: true; movimiento: CajaMovimiento; yaExistia: false }
  | { ok: true; yaExistia: true }
  | { ok: false; error: string }

function refPagoCc(idMovimientoCc: number): string {
  return `PL-CC-PAGO-${idMovimientoCc}`
}

function notificarCajaActualizada(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caja-datos-actualizados'))
  }
}

export function mediosDesdePagoCc(
  metodoPago: string,
  monto: number,
  detalleMedios?: PagoCcDetalleMedio[] | null
): MediosPagoInput | null {
  if (monto <= 0) return null

  if (detalleMedios?.length) {
    const base: MediosPagoInput = {
      total: monto,
      efectivo: 0,
      tarjeta: 0,
      transferencia_bancaria: 0,
      cheque_tercero: 0,
      cheque_propio: 0,
      cuenta_corriente: 0,
      documento: 0,
      cuenta_contable: 0,
      otros: 0
    }
    let suma = 0
    for (const d of detalleMedios) {
      const m = Number(d.monto) || 0
      if (m <= 0) continue
      const part = metodoPagoPlotLabAMedios(d.metodo as MetodoPagoPlotLab, m, 'Pagado')
      if (!part) continue
      base.efectivo = (base.efectivo || 0) + (part.efectivo || 0)
      base.tarjeta = (base.tarjeta || 0) + (part.tarjeta || 0)
      base.transferencia_bancaria =
        (base.transferencia_bancaria || 0) + (part.transferencia_bancaria || 0)
      base.cheque_tercero = (base.cheque_tercero || 0) + (part.cheque_tercero || 0)
      base.cheque_propio = (base.cheque_propio || 0) + (part.cheque_propio || 0)
      base.cuenta_corriente = (base.cuenta_corriente || 0) + (part.cuenta_corriente || 0)
      base.documento = (base.documento || 0) + (part.documento || 0)
      base.cuenta_contable = (base.cuenta_contable || 0) + (part.cuenta_contable || 0)
      base.otros = (base.otros || 0) + (part.otros || 0)
      suma += m
    }
    if (suma <= 0) return null
    base.total = Math.round(suma * 100) / 100
    return base
  }

  const metodo =
    metodoPago === 'Pago múltiple' ? 'Otro' : (metodoPago as MetodoPagoPlotLab)
  return metodoPagoPlotLabAMedios(metodo, monto, 'Pagado')
}

async function buscarMovimientoPagoCc(ref: string): Promise<CajaMovimiento | null> {
  const movs = await listMovimientos()
  return (
    movs.find(
      (m) =>
        !m.anulado &&
        m.origen_importacion === 'plotlab_venta' &&
        (m.observacion?.includes(ref) || m.nro_comprobante === ref)
    ) ?? null
  )
}

/**
 * Cobro de cuenta corriente → ingreso en Caja Administración.
 * Idempotente por id de movimiento CC (`PL-CC-PAGO-{id}`).
 */
export async function syncPagoCuentaCorrienteACajaAdmin(
  input: SyncPagoCcACajaAdminInput
): Promise<SyncPagoCcACajaAdminResult> {
  try {
    const monto = Number(input.monto) || 0
    if (monto <= 0) return { ok: false, error: 'Monto inválido' }
    if (!input.idMovimientoCc) return { ok: false, error: 'Falta id de movimiento CC' }

    const ref = refPagoCc(input.idMovimientoCc)
    const existente = await buscarMovimientoPagoCc(ref)
    if (existente) return { ok: true, yaExistia: true }

    const medios = mediosDesdePagoCc(input.metodoPago, monto, input.detalleMedios)
    if (!medios) return { ok: false, error: 'No se pudieron mapear los medios de pago' }

    const fecha = (input.fecha || getArgentinaDateString()).slice(0, 10)
    const cliente = (input.clienteNombre || 'Cliente CC').trim()
    const usuarioNombre = input.usuarioNombre?.trim() || 'PlotLab'
    const linea = mediosToPlanillaLinea(medios)

    const obsParts = [
      `PlotLab pago CC (${ref})`,
      input.metodoPago,
      input.referencia?.trim() ? `Ref. ${input.referencia.trim()}` : null,
      input.idVenta != null ? `Venta #${input.idVenta}` : null,
      input.urlComprobante ? 'con comprobante' : null
    ].filter(Boolean)

    const movBase = movimientoDesdeMedios(
      {
        fecha,
        hora: new Date().toTimeString().slice(0, 5),
        caja_slug: 'admin',
        tipo_movimiento: 'ingreso',
        categoria: 'Pago cuenta corriente',
        comprobante: ref,
        concepto: `Pago CC ${cliente}`.slice(0, 120),
        tercero_nombre: cliente,
        medios,
        observacion: obsParts.join(' — ').slice(0, 240),
        id_usuario: input.usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        origen_importacion: 'plotlab_venta'
      },
      // Ingreso a administración (destino admin).
      { origen_slug: 'admin', destino_slug: 'admin' }
    )

    const esMp =
      /mercado\s*pago/i.test(input.metodoPago) ||
      (input.detalleMedios ?? []).some((d) => /mercado\s*pago/i.test(d.metodo))

    const mediosGuardar = esMp
      ? {
          ...(linea as unknown as Record<string, number>),
          mercado_pago:
            (input.detalleMedios ?? [])
              .filter((d) => /mercado\s*pago/i.test(d.metodo))
              .reduce((s, d) => s + (Number(d.monto) || 0), 0) || monto
        }
      : (linea as unknown as Record<string, number>)

    const mov = await saveMovimiento({
      ...movBase,
      medios: mediosGuardar
    })

    notificarCajaActualizada()
    notifyCajaSync({
      ok: true,
      message: `Pago CC acreditado en Caja Administración ($${monto.toLocaleString('es-AR')})`
    })

    return { ok: true, movimiento: mov, yaExistia: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al registrar pago CC en caja admin'
    console.warn('syncPagoCuentaCorrienteACajaAdmin:', msg)
    notifyCajaSync({ ok: false, message: msg })
    return { ok: false, error: msg }
  }
}
