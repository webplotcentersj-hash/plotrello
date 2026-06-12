import type { CajaMovimiento } from './types'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'

/** Normaliza «FA 0001-00001234» / «IN 0000-00000912» para cruce entre planillas. */
export function normalizarComprobante(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const one = raw.trim().replace(/\s+/g, ' ')
  const m = one.match(/^([A-Z]{2,4})\s*[-]?\s*(\S+)$/i)
  if (!m) return one.toUpperCase()
  const pref = m[1].toUpperCase() === 'IN' ? 'IV' : m[1].toUpperCase()
  const num = m[2].replace(/\s/g, '')
  return `${pref} ${num}`
}

export function esPaseDeCajaTexto(concepto: string, comprobante?: string | null): boolean {
  const blob = `${concepto ?? ''} ${comprobante ?? ''}`.toUpperCase()
  return /PASE\s*(DE\s*)?CAJA/.test(blob)
}

export type TipoPlanillaDetectado =
  | 'cierre'
  | 'pase'
  | 'operacion'
  | 'mixto'
  | 'traspaso'
  | 'egresos'

export function clasificarPlanillaPorContenido(planilla: PlanillaCajaParsed): TipoPlanillaDetectado {
  const lineas = [
    ...planilla.ingresos_varios,
    ...planilla.ventas,
    ...planilla.egresos,
    ...planilla.egresos_compras,
    ...planilla.egresos_pagos_proveedores
  ]
  const tienePase = lineas.some((l) => esPaseDeCajaTexto(l.concepto, l.comprobante))
  const tieneVentas = planilla.ventas.length > 0
  const tieneEgresos =
    planilla.egresos.length + planilla.egresos_compras.length + planilla.egresos_pagos_proveedores.length > 0
  const tieneMec = planilla.movimientos_mec.length > 0
  const soloIngresosVarios =
    planilla.ingresos_varios.length > 0 && !tieneVentas && !tieneEgresos && !tieneMec
  const soloMec = tieneMec && !tieneVentas && !tieneEgresos && planilla.ingresos_varios.length === 0
  const soloEgresos =
    tieneEgresos && !tieneVentas && !tieneMec && planilla.ingresos_varios.length === 0

  if (soloMec) return 'traspaso'
  if (soloEgresos) return 'egresos'
  if (tienePase && soloIngresosVarios) return 'pase'
  if (tienePase && (tieneVentas || tieneEgresos)) return 'mixto'
  if (planilla.totales && (tieneVentas || tieneEgresos)) return 'cierre'
  if (tieneVentas || tieneEgresos) return 'operacion'
  if (tienePase) return 'pase'
  if (tieneMec) return 'traspaso'
  return 'operacion'
}

export const TIPO_PLANILLA_LABEL: Record<TipoPlanillaDetectado, string> = {
  cierre: 'Cierre de caja',
  pase: 'Pase de caja',
  operacion: 'Movimientos del turno',
  mixto: 'Cierre + pase / varios',
  traspaso: 'Traspaso entre cajas (MEC)',
  egresos: 'Egresos del día'
}

export function movimientoClaveDedup(
  m: Pick<
    CajaMovimiento,
    | 'nro_comprobante'
    | 'fecha'
    | 'tipo_movimiento'
    | 'origen_slug'
    | 'destino_slug'
    | 'concepto'
    | 'monto_total'
    | 'efectivo'
    | 'otros'
    | 'subtipo_pase'
  >
): string {
  const nro = normalizarComprobante(m.nro_comprobante)
  if (nro) return `${m.fecha}|${nro}|${m.tipo_movimiento ?? 'mov'}`

  const monto = Math.round((m.monto_total ?? m.efectivo + m.otros) * 100)
  if (m.subtipo_pase || esPaseDeCajaTexto(m.concepto, m.nro_comprobante)) {
    return `${m.fecha}|pase|${m.subtipo_pase ?? 'libre'}|${m.origen_slug}|${m.destino_slug}|${monto}`
  }
  return `${m.fecha}|${m.concepto}|${m.tipo_movimiento}|${m.origen_slug}|${m.destino_slug}|${monto}`
}

export type MovimientoDuplicadoOmitido = {
  mov: Omit<CajaMovimiento, 'id' | 'created_at'>
  motivo: string
}

export type FiltrarDuplicadosResult = {
  nuevos: Omit<CajaMovimiento, 'id' | 'created_at'>[]
  omitidos: MovimientoDuplicadoOmitido[]
}

function movimientoAfectaCaja(
  m: Pick<CajaMovimiento, 'origen_slug' | 'destino_slug' | 'fecha' | 'anulado'>,
  cajaSlug: string,
  fecha: string
): boolean {
  if (m.anulado) return false
  if (m.fecha !== fecha) return false
  return m.destino_slug === cajaSlug || m.origen_slug === cajaSlug
}

/** Evita volver a importar comprobantes ya registrados (varias planillas el mismo día). */
export function filtrarMovimientosDuplicados(
  candidatos: Omit<CajaMovimiento, 'id' | 'created_at'>[],
  existentes: CajaMovimiento[],
  opts?: { cajaSlug?: string; fecha?: string }
): FiltrarDuplicadosResult {
  const claves = new Set<string>()
  const pasesRegistrados = new Set<string>()

  for (const e of existentes) {
    if (e.anulado) continue
    claves.add(movimientoClaveDedup(e))
    if (e.subtipo_pase || esPaseDeCajaTexto(e.concepto, e.nro_comprobante)) {
      const nro = normalizarComprobante(e.nro_comprobante)
      if (nro) pasesRegistrados.add(`${e.fecha}|${nro}`)
      const monto = Math.round((e.monto_total ?? e.efectivo + e.otros) * 100)
      pasesRegistrados.add(`${e.fecha}|${e.origen_slug}|${e.destino_slug}|${monto}`)
    }
  }

  const nuevos: Omit<CajaMovimiento, 'id' | 'created_at'>[] = []
  const omitidos: MovimientoDuplicadoOmitido[] = []

  for (const c of candidatos) {
    const nro = normalizarComprobante(c.nro_comprobante)
    const esPase = esPaseDeCajaTexto(c.concepto, c.nro_comprobante)

    if (esPase && nro && pasesRegistrados.has(`${c.fecha}|${nro}`)) {
      omitidos.push({
        mov: c,
        motivo: `Pase de caja ya registrado (${c.nro_comprobante})`
      })
      continue
    }

    const clave = movimientoClaveDedup(c)
    if (claves.has(clave)) {
      omitidos.push({
        mov: c,
        motivo: nro
          ? `Comprobante ya importado: ${c.nro_comprobante}`
          : `Movimiento duplicado: ${c.concepto}`
      })
      continue
    }

    if (
      opts?.cajaSlug &&
      opts.fecha &&
      esPase &&
      existentes.some(
        (e) =>
          !e.anulado &&
          e.fecha === opts.fecha &&
          (e.subtipo_pase === 'fondo' || e.subtipo_pase === 'resto_admin') &&
          movimientoAfectaCaja(e, opts.cajaSlug!, opts.fecha!)
      ) &&
      nro &&
      /PASE/i.test(c.concepto)
    ) {
      omitidos.push({
        mov: c,
        motivo: 'Pase reflejado en cierre de turno — no se duplica'
      })
      continue
    }

    claves.add(clave)
    if (esPase && nro) pasesRegistrados.add(`${c.fecha}|${nro}`)
    nuevos.push(c)
  }

  return { nuevos, omitidos }
}

export function deduplicarMovimientos(movs: CajaMovimiento[]): CajaMovimiento[] {
  const map = new Map<string, CajaMovimiento>()
  for (const m of movs) {
    if (m.anulado) continue
    const k = movimientoClaveDedup(m)
    const prev = map.get(k)
    if (!prev || (m.created_at ?? '') > (prev.created_at ?? '')) map.set(k, m)
  }
  return [...map.values()]
}

export type TotalesCajaDia = {
  ingresos: number
  egresos: number
  traspasos: number
  neto: number
  comprobantes_unicos: number
  planillas_del_dia: number
}

export function calcularTotalesCoherentesDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  cajaSlug: string
): TotalesCajaDia {
  const delDia = movimientos.filter((m) => movimientoAfectaCaja(m, cajaSlug, fecha))
  const unicos = deduplicarMovimientos(delDia)

  let ingresos = 0
  let egresos = 0
  let traspasos = 0

  for (const m of unicos) {
    const monto = m.monto_total ?? m.efectivo + m.otros
    if (m.tipo_movimiento === 'traspaso') {
      traspasos += 1
      continue
    }
    if (m.tipo_movimiento === 'ingreso' && m.destino_slug === cajaSlug) ingresos += monto
    else if (m.tipo_movimiento === 'egreso' && m.origen_slug === cajaSlug) egresos += monto
  }

  return {
    ingresos,
    egresos,
    traspasos,
    neto: ingresos - egresos,
    comprobantes_unicos: unicos.filter((m) => m.nro_comprobante).length,
    planillas_del_dia: 0
  }
}

export function contarPlanillasDelDia(
  planillas: Array<{ fecha_desde?: string; fecha_hasta?: string; caja_slug?: string | null; id_usuario?: number | null }>,
  fecha: string,
  cajaSlug: string | null,
  usuarioId?: number
): number {
  return planillas.filter((p) => {
    const desde = (p.fecha_desde ?? '').slice(0, 10)
    const hasta = (p.fecha_hasta ?? '').slice(0, 10)
    const enFecha = desde <= fecha && fecha <= hasta
    if (!enFecha) return false
    if (cajaSlug && p.caja_slug && p.caja_slug !== cajaSlug) return false
    if (usuarioId != null && p.id_usuario != null && p.id_usuario !== usuarioId) return false
    return true
  }).length
}
