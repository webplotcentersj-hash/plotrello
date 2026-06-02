import { calcularCierre } from './cierreCalculations'
import { newId } from './format'
import { validarCuadreMediosPago, type ValidacionMediosPago } from './planillaMediosPago'
import type { PlanillaMontosLinea } from './parsePlanillaCajaPdf'
import type { CajaCierre, CajaMovimiento, CajaRegistro } from './types'

export type MediosPagoInput = {
  total: number
  cuenta_corriente?: number
  efectivo?: number
  cheque_propio?: number
  cheque_tercero?: number
  tarjeta?: number
  documento?: number
  cuenta_contable?: number
  transferencia_bancaria?: number
  otros?: number
}

export type CrearMovimientoInput = {
  fecha: string
  hora?: string | null
  caja_slug: string
  tipo_movimiento: 'ingreso' | 'egreso' | 'traspaso' | 'ajuste'
  categoria: string
  comprobante?: string | null
  concepto: string
  tercero_nombre?: string | null
  medios: MediosPagoInput
  observacion?: string | null
  id_usuario?: number | null
  usuario_nombre?: string | null
  origen_importacion?: CajaMovimiento['origen_importacion']
  traspaso_id?: string | null
  cierre_id?: string | null
}

export function mediosToPlanillaLinea(m: MediosPagoInput): PlanillaMontosLinea {
  return {
    total: m.total || 0,
    cta_cte: m.cuenta_corriente || 0,
    efectivo: m.efectivo || 0,
    ch_prop: m.cheque_propio || 0,
    ch_terc: m.cheque_tercero || 0,
    tarjetas: m.tarjeta || 0,
    docum: m.documento || 0,
    c_contab: m.cuenta_contable || 0,
    trans_b: m.transferencia_bancaria || 0,
    otros: m.otros || 0
  }
}

export function validarMediosPago(m: MediosPagoInput): ValidacionMediosPago {
  return validarCuadreMediosPago(mediosToPlanillaLinea(m))
}

export function movimientoDesdeMedios(
  input: CrearMovimientoInput,
  opts: { origen_slug: string; destino_slug: string }
): Omit<CajaMovimiento, 'id' | 'created_at'> {
  const linea = mediosToPlanillaLinea(input.medios)
  const v = validarCuadreMediosPago(linea)
  if (!v.valido) {
    throw new Error(
      `Total ($${input.medios.total}) no coincide con medios de pago ($${v.suma_medios}). Diferencia: $${v.diferencia.toFixed(2)}`
    )
  }

  const otrosNoEf =
    linea.cta_cte +
    linea.ch_prop +
    linea.ch_terc +
    linea.tarjetas +
    linea.docum +
    linea.c_contab +
    linea.trans_b +
    linea.otros

  return {
    fecha: input.fecha,
    hora: input.hora ?? null,
    concepto: input.concepto,
    tipo_movimiento: input.tipo_movimiento,
    categoria: input.categoria,
    tercero_nombre: input.tercero_nombre ?? null,
    origen_slug: opts.origen_slug,
    destino_slug: opts.destino_slug,
    efectivo: linea.efectivo,
    otros: otrosNoEf,
    monto_total: linea.total,
    cuenta_corriente: linea.cta_cte,
    cheque_propio: linea.ch_prop,
    cheque_tercero: linea.ch_terc,
    tarjeta: linea.tarjetas,
    documento: linea.docum,
    cuenta_contable: linea.c_contab,
    transferencia_bancaria: linea.trans_b,
    nro_comprobante: input.comprobante ?? null,
    observacion: input.observacion ?? null,
    id_usuario: input.id_usuario ?? null,
    usuario_nombre: input.usuario_nombre ?? null,
    origen_importacion: input.origen_importacion ?? 'manual',
    traspaso_id: input.traspaso_id ?? null,
    cierre_id: input.cierre_id ?? null,
    anulado: false,
    medios: linea as unknown as Record<string, number>
  }
}

export type TotalesCajaPeriodo = {
  ingresos: PlanillaMontosLinea
  egresos: PlanillaMontosLinea
  neto: PlanillaMontosLinea
  detalle: { ingresos: number; egresos: number; traspasos: number }
}

function sumarEn(acum: PlanillaMontosLinea, m: PlanillaMontosLinea, sign: 1 | -1): void {
  acum.total += sign * m.total
  acum.cta_cte += sign * m.cta_cte
  acum.efectivo += sign * m.efectivo
  acum.ch_prop += sign * m.ch_prop
  acum.ch_terc += sign * m.ch_terc
  acum.tarjetas += sign * m.tarjetas
  acum.docum += sign * m.docum
  acum.c_contab += sign * m.c_contab
  acum.trans_b += sign * m.trans_b
  acum.otros += sign * m.otros
}

function mediosFromMov(m: CajaMovimiento): PlanillaMontosLinea {
  if (m.monto_total != null && m.monto_total > 0) {
    return {
      total: m.monto_total,
      cta_cte: m.cuenta_corriente ?? 0,
      efectivo: m.efectivo ?? 0,
      ch_prop: m.cheque_propio ?? 0,
      ch_terc: m.cheque_tercero ?? 0,
      tarjetas: m.tarjeta ?? 0,
      docum: m.documento ?? 0,
      c_contab: m.cuenta_contable ?? 0,
      trans_b: m.transferencia_bancaria ?? 0,
      otros: m.otros ?? 0
    }
  }
  return {
    total: m.efectivo + m.otros,
    cta_cte: 0,
    efectivo: m.efectivo,
    ch_prop: 0,
    ch_terc: 0,
    tarjetas: 0,
    docum: 0,
    c_contab: 0,
    trans_b: 0,
    otros: m.otros
  }
}

/** Totales por medio de pago en un periodo y caja. */
export function calcularTotalesCaja(
  movimientos: CajaMovimiento[],
  cajaSlug: string,
  fechaDesde: string,
  fechaHasta: string
): TotalesCajaPeriodo {
  const ingresos = emptyMontos()
  const egresos = emptyMontos()
  let ni = 0
  let ne = 0
  let nt = 0

  for (const m of movimientos) {
    if (m.anulado) continue
    if (m.fecha < fechaDesde || m.fecha > fechaHasta) continue

    const med = mediosFromMov(m)
    const tipo = m.tipo_movimiento ?? (m.destino_slug === cajaSlug ? 'ingreso' : 'egreso')

    if (tipo === 'ingreso' && m.destino_slug === cajaSlug) {
      sumarEn(ingresos, med, 1)
      ni++
    } else if (tipo === 'egreso' && m.origen_slug === cajaSlug) {
      sumarEn(egresos, med, 1)
      ne++
    } else if (tipo === 'traspaso') {
      if (m.origen_slug === cajaSlug) {
        sumarEn(egresos, med, 1)
        nt++
      }
      if (m.destino_slug === cajaSlug) {
        sumarEn(ingresos, med, 1)
        nt++
      }
    } else if (m.origen_slug === cajaSlug) {
      sumarEn(egresos, med, 1)
      ne++
    } else if (m.destino_slug === cajaSlug) {
      sumarEn(ingresos, med, 1)
      ni++
    }
  }

  const neto = emptyMontos()
  sumarEn(neto, ingresos, 1)
  sumarEn(neto, egresos, -1)

  return {
    ingresos,
    egresos,
    neto,
    detalle: { ingresos: ni, egresos: ne, traspasos: nt }
  }
}

function emptyMontos(): PlanillaMontosLinea {
  return {
    total: 0,
    cta_cte: 0,
    efectivo: 0,
    ch_prop: 0,
    ch_terc: 0,
    tarjetas: 0,
    docum: 0,
    c_contab: 0,
    trans_b: 0,
    otros: 0
  }
}

export type CrearTraspasoInput = {
  fecha: string
  caja_origen_slug: string
  caja_destino_slug: string
  comprobante?: string | null
  medios: MediosPagoInput
  observacion?: string | null
  id_usuario?: number | null
  usuario_nombre?: string | null
  confirmar?: boolean
}

export type TraspasoGenerado = {
  traspaso_id: string
  movimientos: [Omit<CajaMovimiento, 'id' | 'created_at'>, Omit<CajaMovimiento, 'id' | 'created_at'>]
}

export function crearTraspasoCaja(input: CrearTraspasoInput): TraspasoGenerado {
  if (input.caja_origen_slug === input.caja_destino_slug) {
    throw new Error('La caja origen y destino deben ser distintas.')
  }
  const traspaso_id = newId()
  const base = {
    fecha: input.fecha,
    hora: null,
    caja_slug: input.caja_origen_slug,
    categoria: 'movimiento_entre_cajas',
    comprobante: input.comprobante ?? null,
    concepto: input.observacion ?? 'Traspaso entre cajas',
    tercero_nombre: null,
    medios: input.medios,
    observacion: input.observacion ?? null,
    id_usuario: input.id_usuario ?? null,
    usuario_nombre: input.usuario_nombre ?? null,
    origen_importacion: 'manual' as const,
    traspaso_id,
    anulado: input.confirmar === false
  }

  const salida = movimientoDesdeMedios(
    {
      ...base,
      tipo_movimiento: 'egreso',
      concepto: `Traspaso salida — ${input.observacion ?? ''}`.trim()
    },
    { origen_slug: input.caja_origen_slug, destino_slug: input.caja_destino_slug }
  )

  const entrada = movimientoDesdeMedios(
    {
      ...base,
      caja_slug: input.caja_destino_slug,
      tipo_movimiento: 'ingreso',
      concepto: `Traspaso entrada — ${input.observacion ?? ''}`.trim()
    },
    { origen_slug: input.caja_origen_slug, destino_slug: input.caja_destino_slug }
  )

  return { traspaso_id, movimientos: [salida, entrada] }
}

export function estadoArqueo(diferencia: number, tolerancia = 0.02): 'correcto' | 'sobrante' | 'faltante' {
  if (Math.abs(diferencia) <= tolerancia) return 'correcto'
  return diferencia > 0 ? 'sobrante' : 'faltante'
}

export type CerrarCajaInput = {
  cierre: Omit<CajaCierre, 'id' | 'created_at'>
  movimientos: CajaMovimiento[]
  tolerancia?: number
}

export function snapshotTotalesCierre(
  cajaSlug: string,
  fechaDesde: string,
  fechaHasta: string,
  movimientos: CajaMovimiento[]
): Record<string, unknown> {
  const t = calcularTotalesCaja(movimientos, cajaSlug, fechaDesde, fechaHasta)
  return {
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    caja_slug: cajaSlug,
    ingresos: t.ingresos,
    egresos: t.egresos,
    neto: t.neto,
    generado_en: new Date().toISOString()
  }
}

export function cierreCerrado(c: CajaCierre): boolean {
  return c.estado_cierre === 'cerrado' || c.estado_cierre === 'observado'
}

export function enrichCierreFromTotales(
  form: Parameters<typeof calcularCierre>[0],
  totales: TotalesCajaPeriodo,
  tolerancia: number
) {
  return calcularCierre(
    {
      ...form,
      ing_ef: totales.ingresos.efectivo,
      egr_ef: totales.egresos.efectivo,
      tarj_sist: totales.ingresos.tarjetas,
      trans: totales.ingresos.trans_b,
      cta_cte: totales.ingresos.cta_cte
    },
    tolerancia
  )
}

export function resolveCajaSlugFromRegistro(cajas: CajaRegistro[], slug: string): CajaRegistro | undefined {
  return cajas.find((c) => c.slug === slug)
}
