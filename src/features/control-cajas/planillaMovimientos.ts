import { getArgentinaDateString } from '../../utils/dateUtils'
import { newId } from './format'

export function fechaPlanillaImport(planilla: PlanillaCajaParsed): string {
  const raw = (planilla.fecha_hasta || planilla.fecha_desde || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getArgentinaDateString()
}
import { crearTraspasoCaja, mediosToPlanillaLinea, type MediosPagoInput } from './movimientoCaja'
import type { PlanillaCajaParsed, PlanillaLineaConMontos, PlanillaLineaMec } from './parsePlanillaCajaPdf'
import { resolveCajaSlug } from './cajaRepository'
import type { CajaMovimiento, CajaRegistro } from './types'

export function mediosDesdeLinea(linea: PlanillaLineaConMontos): Record<string, number> {
  return {
    total: linea.total,
    cta_cte: linea.cta_cte,
    efectivo: linea.efectivo,
    ch_prop: linea.ch_prop,
    ch_terc: linea.ch_terc,
    tarjetas: linea.tarjetas,
    docum: linea.docum,
    c_contab: linea.c_contab,
    trans_b: linea.trans_b,
    otros: linea.otros
  }
}

export function mediosInputDesdeLinea(linea: PlanillaLineaConMontos): MediosPagoInput {
  return {
    total: linea.total,
    cuenta_corriente: linea.cta_cte,
    efectivo: linea.efectivo,
    cheque_propio: linea.ch_prop,
    cheque_tercero: linea.ch_terc,
    tarjeta: linea.tarjetas,
    documento: linea.docum,
    cuenta_contable: linea.c_contab,
    transferencia_bancaria: linea.trans_b,
    otros: linea.otros
  }
}

function otrosNoEfectivo(linea: PlanillaLineaConMontos): number {
  const m = mediosDesdeLinea(linea)
  return (
    m.cta_cte + m.ch_prop + m.ch_terc + m.tarjetas + m.docum + m.c_contab + m.trans_b + m.otros
  )
}

function lineaTieneMonto(linea: PlanillaLineaConMontos): boolean {
  if (linea.total > 0) return true
  return (
    linea.efectivo > 0 ||
    linea.cta_cte > 0 ||
    linea.tarjetas > 0 ||
    linea.trans_b > 0 ||
    otrosNoEfectivo(linea) > 0
  )
}

/** Convierte una línea de planilla en movimiento con desglose completo (sin exigir cuadre estricto). */
export function movimientoDesdePlanillaLinea(
  linea: PlanillaLineaConMontos,
  opts: {
    fecha: string
    origen_slug: string
    destino_slug: string
    tipo_movimiento: 'ingreso' | 'egreso' | 'traspaso'
    id_usuario?: number | null
    usuario_nombre?: string | null
    traspaso_id?: string | null
  }
): Omit<CajaMovimiento, 'id' | 'created_at'> {
  const medios = mediosInputDesdeLinea(linea)
  const montos = mediosToPlanillaLinea(medios)
  const otros = otrosNoEfectivo(linea)

  return {
    fecha: opts.fecha,
    hora: null,
    concepto: linea.concepto || linea.comprobante,
    tipo_movimiento: opts.tipo_movimiento,
    categoria: linea.categoria,
    tercero_nombre: null,
    origen_slug: opts.origen_slug,
    destino_slug: opts.destino_slug,
    efectivo: montos.efectivo,
    otros,
    monto_total: montos.total || linea.total,
    cuenta_corriente: montos.cta_cte,
    cheque_propio: montos.ch_prop,
    cheque_tercero: montos.ch_terc,
    tarjeta: montos.tarjetas,
    documento: montos.docum,
    cuenta_contable: montos.c_contab,
    transferencia_bancaria: montos.trans_b,
    nro_comprobante: linea.comprobante,
    observacion: `Importado desde planilla PDF (${linea.bloque})`,
    id_usuario: opts.id_usuario ?? null,
    usuario_nombre: opts.usuario_nombre ?? null,
    origen_importacion: 'planilla_pdf',
    traspaso_id: opts.traspaso_id ?? null,
    cierre_id: null,
    anulado: false,
    medios: mediosDesdeLinea(linea)
  }
}

function ingresosDesdeLineas(
  lineas: PlanillaLineaConMontos[],
  cajaSlug: string,
  fecha: string,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const externo = 'admin'
  return lineas.filter(lineaTieneMonto).map((linea) =>
    movimientoDesdePlanillaLinea(linea, {
      fecha,
      origen_slug: externo,
      destino_slug: cajaSlug,
      tipo_movimiento: 'ingreso',
      id_usuario: usuarioId,
      usuario_nombre: usuarioNombre
    })
  )
}

function egresosDesdeLineas(
  lineas: PlanillaLineaConMontos[],
  cajaSlug: string,
  fecha: string,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const destino = 'admin'
  return lineas.filter(lineaTieneMonto).map((linea) =>
    movimientoDesdePlanillaLinea(linea, {
      fecha,
      origen_slug: cajaSlug,
      destino_slug: destino,
      tipo_movimiento: 'egreso',
      id_usuario: usuarioId,
      usuario_nombre: usuarioNombre
    })
  )
}

function mecToMovimientos(
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  cajaSlug: string,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const fecha = fechaPlanillaImport(planilla)
  const adminSlug = resolveCajaSlug('admin', cajas) ?? 'admin'

  const hintToSlug = (hint: string): string | null => {
    const h = hint.trim().toLowerCase()
    if (!h) return null
    if (h.includes('central') || h.includes('admin')) return adminSlug
    return resolveCajaSlug(hint, cajas)
  }

  const out: Omit<CajaMovimiento, 'id' | 'created_at'>[] = []

  for (const mec of planilla.movimientos_mec) {
    if (!lineaTieneMonto(mec)) continue
    const origen = hintToSlug(mec.origen_hint) ?? cajaSlug
    const destino = hintToSlug(mec.destino_hint) ?? adminSlug
    if (origen === destino) continue

    try {
      const { movimientos } = crearTraspasoCaja({
        fecha,
        caja_origen_slug: origen,
        caja_destino_slug: destino,
        comprobante: mec.comprobante,
        medios: mediosInputDesdeLinea(mec),
        observacion: mec.concepto || 'Traspaso planilla',
        id_usuario: usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        confirmar: true
      })
      for (const m of movimientos) {
        out.push({
          ...m,
          origen_importacion: 'planilla_pdf',
          observacion: mec.concepto || m.observacion
        })
      }
    } catch {
      const traspaso_id = newId()
      out.push(
        movimientoDesdePlanillaLinea(mec, {
          fecha,
          origen_slug: origen,
          destino_slug: destino,
          tipo_movimiento: 'traspaso',
          id_usuario: usuarioId,
          usuario_nombre: usuarioNombre,
          traspaso_id
        })
      )
    }
  }

  return out
}

export type PlanillaImportResumen = {
  ingresos: number
  egresos: number
  traspasos: number
  ventas: number
  total: number
}

/** Importa TODAS las líneas del PDF como movimientos en el sistema. */
export function planillaAllToMovimientos(
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  cajaSlug: string | null,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const slug =
    cajaSlug ??
    resolveCajaSlug(planilla.caja_nombre, cajas) ??
    cajas.find((c) => c.slug !== 'admin' && c.slug !== 'vuelto')?.slug ??
    'noelia'

  const fecha = fechaPlanillaImport(planilla)

  const ingresos = [
    ...ingresosDesdeLineas(planilla.ventas, slug, fecha, usuarioNombre, usuarioId),
    ...ingresosDesdeLineas(planilla.ingresos_varios, slug, fecha, usuarioNombre, usuarioId),
    ...ingresosDesdeLineas(planilla.ingresos_pagos_clientes, slug, fecha, usuarioNombre, usuarioId)
  ]

  const egresosLineas = [
    ...planilla.egresos,
    ...planilla.egresos_compras,
    ...planilla.egresos_pagos_proveedores
  ]
  const egresos = egresosDesdeLineas(egresosLineas, slug, fecha, usuarioNombre, usuarioId)
  const traspasos = mecToMovimientos(planilla, cajas, slug, usuarioNombre, usuarioId)

  return [...ingresos, ...egresos, ...traspasos]
}

export function resumenImportacion(movimientos: Omit<CajaMovimiento, 'id' | 'created_at'>[]): PlanillaImportResumen {
  let ingresos = 0
  let egresos = 0
  let traspasos = 0
  let ventas = 0
  for (const m of movimientos) {
    if (m.tipo_movimiento === 'ingreso') {
      ingresos++
      if (m.categoria === 'venta') ventas++
    } else if (m.tipo_movimiento === 'egreso') egresos++
    else if (m.tipo_movimiento === 'traspaso') traspasos++
  }
  return { ingresos, egresos, traspasos, ventas, total: movimientos.length }
}

/** Serializa la planilla completa para guardar en JSON (datos). */
export function planillaToDatosJson(planilla: PlanillaCajaParsed): Record<string, unknown> {
  return {
    archivo_nombre: planilla.archivo_nombre,
    empresa: planilla.empresa,
    fecha_desde: planilla.fecha_desde,
    fecha_hasta: planilla.fecha_hasta,
    caja_nombre: planilla.caja_nombre,
    cantidad_ventas: planilla.cantidad_ventas,
    lineas_cuadre_invalido: planilla.lineas_cuadre_invalido,
    warnings: planilla.warnings,
    totales: planilla.totales,
    ingresos_varios: planilla.ingresos_varios,
    ventas: planilla.ventas,
    ingresos_pagos_clientes: planilla.ingresos_pagos_clientes,
    egresos: planilla.egresos,
    egresos_compras: planilla.egresos_compras,
    egresos_pagos_proveedores: planilla.egresos_pagos_proveedores,
    movimientos_mec: planilla.movimientos_mec
  }
}

export function datosJsonToPlanilla(
  datos: Record<string, unknown>,
  fallback: Partial<PlanillaCajaParsed>
): PlanillaCajaParsed | null {
  if (!datos || typeof datos !== 'object') return null
  if (!Array.isArray(datos.ventas) && !Array.isArray(datos.egresos)) return null
  return {
    archivo_nombre: String(datos.archivo_nombre ?? fallback.archivo_nombre ?? ''),
    empresa: String(datos.empresa ?? fallback.empresa ?? 'PLOT CENTER'),
    fecha_desde: String(datos.fecha_desde ?? fallback.fecha_desde ?? ''),
    fecha_hasta: String(datos.fecha_hasta ?? fallback.fecha_hasta ?? ''),
    caja_nombre: String(datos.caja_nombre ?? fallback.caja_nombre ?? ''),
    cantidad_ventas: Number(datos.cantidad_ventas) || 0,
    totales: (datos.totales as PlanillaCajaParsed['totales']) ?? fallback.totales ?? null,
    ingresos_varios: (datos.ingresos_varios as PlanillaLineaConMontos[]) ?? [],
    ventas: (datos.ventas as PlanillaLineaConMontos[]) ?? [],
    ingresos_pagos_clientes: (datos.ingresos_pagos_clientes as PlanillaLineaConMontos[]) ?? [],
    egresos: (datos.egresos as PlanillaLineaConMontos[]) ?? [],
    egresos_compras: (datos.egresos_compras as PlanillaLineaConMontos[]) ?? [],
    egresos_pagos_proveedores: (datos.egresos_pagos_proveedores as PlanillaLineaConMontos[]) ?? [],
    movimientos_mec: (datos.movimientos_mec as PlanillaLineaMec[]) ?? [],
    lineas_cuadre_invalido: Number(datos.lineas_cuadre_invalido) || 0,
    warnings: Array.isArray(datos.warnings) ? (datos.warnings as string[]) : []
  }
}
