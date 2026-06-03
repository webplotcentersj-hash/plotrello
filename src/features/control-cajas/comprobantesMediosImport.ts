import { getArgentinaDateString } from '../../utils/dateUtils'
import type { ComprobanteLoteParsed, ComprobanteMedioParsed } from './comprobanteMediosTypes'
import type { CajaMovimiento, CajaRegistro } from './types'

function fechaValida(f?: string): string {
  const raw = (f ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getArgentinaDateString()
}

function conceptoDesdeComprobante(c: ComprobanteMedioParsed): string {
  const partes: string[] = []
  if (c.medio === 'mercado_pago') partes.push('Mercado Pago')
  else if (c.medio === 'posnet') partes.push('POSnet')
  else partes.push('Tarjeta')
  if (c.metodo_pago) partes.push(c.metodo_pago)
  if (c.marca_tarjeta) partes.push(c.marca_tarjeta.toUpperCase())
  if (c.ultimos_digitos) partes.push(`*${c.ultimos_digitos}`)
  if (c.comercio) partes.push(`— ${c.comercio}`)
  return partes.join(' ')
}

function movIngresoTarjeta(opts: {
  fecha: string
  hora: string | null
  cajaSlug: string
  monto: number
  concepto: string
  nro: string | null
  observacion: string
  usuarioNombre: string
  usuarioId?: number
  archivo: string
}): Omit<CajaMovimiento, 'id' | 'created_at'> {
  return {
    fecha: opts.fecha,
    hora: opts.hora,
    concepto: opts.concepto,
    tipo_movimiento: 'ingreso',
    categoria: 'venta_tarjeta',
    tercero_nombre: null,
    origen_slug: 'admin',
    destino_slug: opts.cajaSlug,
    efectivo: 0,
    otros: 0,
    monto_total: opts.monto,
    tarjeta: opts.monto,
    cuenta_corriente: 0,
    cheque_propio: 0,
    cheque_tercero: 0,
    documento: 0,
    cuenta_contable: 0,
    transferencia_bancaria: 0,
    nro_comprobante: opts.nro,
    observacion: opts.observacion,
    id_usuario: opts.usuarioId ?? null,
    usuario_nombre: opts.usuarioNombre,
    origen_importacion: 'manual',
    traspaso_id: null,
    cierre_id: null,
    anulado: false,
    medios: { tarjetas: opts.monto, total: opts.monto }
  }
}

function movEgreso(opts: {
  fecha: string
  cajaSlug: string
  monto: number
  concepto: string
  nro: string | null
  observacion: string
  usuarioNombre: string
  usuarioId?: number
}): Omit<CajaMovimiento, 'id' | 'created_at'> {
  return {
    fecha: opts.fecha,
    hora: null,
    concepto: opts.concepto,
    tipo_movimiento: 'egreso',
    categoria: 'gasto_vario',
    tercero_nombre: null,
    origen_slug: opts.cajaSlug,
    destino_slug: 'admin',
    efectivo: opts.monto,
    otros: 0,
    monto_total: opts.monto,
    tarjeta: 0,
    nro_comprobante: opts.nro,
    observacion: opts.observacion,
    id_usuario: opts.usuarioId ?? null,
    usuario_nombre: opts.usuarioNombre,
    origen_importacion: 'manual',
    traspaso_id: null,
    cierre_id: null,
    anulado: false
  }
}

/** Convierte comprobantes leídos en movimientos de caja (ingresos por tarjeta / egresos). */
export function comprobantesToMovimientos(
  lote: ComprobanteLoteParsed,
  cajaSlug: string,
  usuarioNombre: string,
  usuarioId?: number,
  cajas?: CajaRegistro[]
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const adminSlug = cajas?.find((c) => c.slug === 'admin')?.slug ?? 'admin'
  const out: Omit<CajaMovimiento, 'id' | 'created_at'>[] = []
  const seenOps = new Set<string>()

  for (const c of lote.comprobantes) {
    const fecha = fechaValida(c.fecha)
    const obsBase = `Importado desde comprobante (${c.archivo_nombre}) · PlotAI`

    if (c.es_resumen && c.lineas_resumen.length) {
      for (const linea of c.lineas_resumen) {
        if (linea.monto <= 0) continue
        const concepto = linea.concepto || conceptoDesdeComprobante(c)
        out.push(
          movIngresoTarjeta({
            fecha,
            hora: c.hora ?? null,
            cajaSlug,
            monto: linea.monto,
            concepto: `Resumen MP — ${concepto}`,
            nro: null,
            observacion: `${obsBase} · línea resumen`,
            usuarioNombre,
            usuarioId,
            archivo: c.archivo_nombre
          })
        )
      }
      continue
    }

    if (c.tipo === 'egreso' && c.monto > 0) {
      out.push(
        movEgreso({
          fecha,
          cajaSlug,
          monto: c.monto,
          concepto: conceptoDesdeComprobante(c),
          nro: c.operacion_numero ?? null,
          observacion: obsBase,
          usuarioNombre,
          usuarioId
        })
      )
      continue
    }

    if (c.monto <= 0) continue

    const opKey = c.operacion_numero?.trim()
    if (opKey) {
      if (seenOps.has(opKey)) continue
      seenOps.add(opKey)
    }

    out.push(
      movIngresoTarjeta({
        fecha,
        hora: c.hora ?? null,
        cajaSlug,
        monto: c.monto,
        concepto: conceptoDesdeComprobante(c),
        nro: c.operacion_numero ?? null,
        observacion: obsBase,
        usuarioNombre,
        usuarioId,
        archivo: c.archivo_nombre
      })
    )
  }

  void adminSlug
  return out
}

export type ResumenImportComprobantes = {
  tickets: number
  resumenes: number
  egresos: number
  total: number
}

export function resumenImportComprobantes(
  movimientos: Omit<CajaMovimiento, 'id' | 'created_at'>[]
): ResumenImportComprobantes {
  let tickets = 0
  let resumenes = 0
  let egresos = 0
  for (const m of movimientos) {
    if (m.tipo_movimiento === 'egreso') egresos++
    else if ((m.observacion ?? '').includes('resumen')) resumenes++
    else tickets++
  }
  return { tickets, resumenes, egresos, total: movimientos.length }
}
