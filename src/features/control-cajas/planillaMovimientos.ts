import { newId } from './format'
import type { PlanillaCajaParsed, PlanillaLineaConMontos } from './parsePlanillaCajaPdf'
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

function otrosNoEfectivo(m: Record<string, number>): number {
  return m.cta_cte + m.ch_prop + m.ch_terc + m.tarjetas + m.docum + m.c_contab + m.trans_b + m.otros
}

/** MEC → par egreso (origen) + ingreso (destino) con mismo traspaso_id. */
export function planillaMecToTraspasoMovimientos(
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const cajaSlug =
    resolveCajaSlug(planilla.caja_nombre, cajas) ??
    cajas.find((c) => c.slug !== 'admin')?.slug ??
    'noelia'
  const fecha = planilla.fecha_hasta || planilla.fecha_desde
  const adminSlug = resolveCajaSlug('admin', cajas) ?? 'admin'

  const hintToSlug = (hint: string): string | null => {
    const h = hint.trim().toLowerCase()
    if (!h) return null
    if (h.includes('central') || h.includes('admin')) return adminSlug
    return resolveCajaSlug(hint, cajas)
  }

  const out: Omit<CajaMovimiento, 'id' | 'created_at'>[] = []

  for (const mec of planilla.movimientos_mec) {
    const origen = hintToSlug(mec.origen_hint) ?? cajaSlug
    const destino = hintToSlug(mec.destino_hint) ?? adminSlug
    if (origen === destino) continue

    const traspaso_id = newId()
    const medios = mediosDesdeLinea(mec)
    const base = {
      fecha,
      hora: null,
      nro_comprobante: mec.comprobante,
      observacion: mec.concepto,
      id_usuario: usuarioId ?? null,
      usuario_nombre: usuarioNombre,
      origen_importacion: 'planilla_pdf' as const,
      traspaso_id,
      medios
    }

    out.push({
      ...base,
      concepto: 'Pase de caja',
      subtipo_pase: 'libre',
      origen_slug: origen,
      destino_slug: destino,
      efectivo: medios.efectivo || mec.total,
      otros: otrosNoEfectivo(medios)
    })
  }

  return out
}

export function planillaEgresosLineasToMovimientos(
  lineas: PlanillaLineaConMontos[],
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  cajaSlug: string | null,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const slug =
    cajaSlug ??
    resolveCajaSlug(planilla.caja_nombre, cajas) ??
    cajas.find((c) => c.slug !== 'admin')?.slug ??
    'noelia'
  const fecha = planilla.fecha_hasta || planilla.fecha_desde
  const destino = resolveCajaSlug('admin', cajas) ?? 'admin'

  return lineas.map((eg) => {
    const medios = mediosDesdeLinea(eg)
    return {
      fecha,
      hora: null,
      concepto: eg.concepto || 'Egreso',
      origen_slug: slug,
      destino_slug: destino,
      efectivo: medios.efectivo || eg.total,
      otros: otrosNoEfectivo(medios),
      nro_comprobante: eg.comprobante,
      observacion: `Planilla ${eg.bloque} — ${eg.concepto}`,
      id_usuario: usuarioId ?? null,
      usuario_nombre: usuarioNombre,
      origen_importacion: 'planilla_pdf',
      medios
    }
  })
}

export function planillaAllToMovimientos(
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  cajaSlug: string | null,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const egresos = [
    ...planilla.egresos,
    ...planilla.egresos_compras,
    ...planilla.egresos_pagos_proveedores
  ]
  return [
    ...planillaMecToTraspasoMovimientos(planilla, cajas, usuarioNombre, usuarioId),
    ...planillaEgresosLineasToMovimientos(egresos, planilla, cajas, cajaSlug, usuarioNombre, usuarioId)
  ]
}
